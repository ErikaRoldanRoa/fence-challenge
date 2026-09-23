/* Fence Challenge · camera core.
 *
 * Reads a printed board from camera frames and says which cells are covered:
 *   1. find the square corner marks (ArUco 4x4 markers, only the ids our
 *      boards use, at most one wrong bit);
 *   2. fit a homography from the board's world coordinates to the image,
 *      using every corner of every mark in view;
 *   3. look at each cell through that map, a little inside its outline, and
 *      compare it with the paper around it (brightness, and colour once the
 *      colour of the light is removed);
 *   4. smooth the result over time and accept a new state only when the
 *      board has been still for a moment, so a hand over the board holds the
 *      last picture instead of changing it;
 *   5. read the covered cells as whole pieces of the board's set where they
 *      can be (which also drops the colour a piece spills onto the cells
 *      next to it), then judge them with FenceAnalysis, the rule the screen
 *      uses. A state that is not whole pieces looking like cut pieces (a
 *      fingertip, a pen or a hand resting on the board) is accepted only
 *      after a long still moment, and never as pieces.
 * The classic 20 x 20 kit (corner ids 50-53, one mark on every tile) is
 * located by its printed grid lines, checked against the print, and its
 * tiles are read from their marks.
 *
 * Requires the globals AR and CV (js-aruco2), FenceBoards and FenceAnalysis.
 * World coordinates are the lattice modules' (y down). Image coordinates are
 * pixels of the image passed in ({ width, height, data } with RGBA bytes),
 * pixel centres at whole numbers. A homography is an array of 9 numbers,
 * row by row, and maps world points to image points unless said otherwise.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(true);
  } else {
    root.FenceCamera = factory(false);
  }
})(typeof self !== "undefined" ? self : this, function (isNode) {
  "use strict";

  const scope = typeof globalThis !== "undefined" ? globalThis : {};

  function dep(name) {
    if (scope[name]) return scope[name];
    if (isNode) {
      if (name === "AR") {
        const AR = require("../vendor/js-aruco2/aruco.js").AR;
        require("../vendor/js-aruco2/dictionaries/aruco_4x4_1000.js");
        return AR;
      }
      if (name === "CV") return require("../vendor/js-aruco2/cv.js").CV;
      if (name === "FenceBoards") return require("./boards.js");
      if (name === "FenceAnalysis") return require("../fence-analysis.js");
    }
    throw new Error("FenceCamera needs " + name + " to be loaded first.");
  }

  const clock = () =>
    typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();

  // Tuning. Distances are in cell units unless noted.
  const TUNING = {
    shrink: 0.65, // cells are sampled inside their outline shrunk toward the centre
    chromaLow: 0.06, // colour (after white balance) that still counts as paper
    chromaHigh: 0.14, // colour that surely is a piece
    darkLow: 0.25, // darkness relative to the local paper that still counts as paper (soft shadows stay below)
    darkHigh: 0.45, // darkness that surely is a piece
    cellOn: 0.5, // share of a cell that must look like a piece (single frame)
    cellMaybe: 0.3, // below cellOn but enough for a whole-piece reading to use it
    emaTau: 90, // ms, time constant of the per-cell smoothing
    holdOn: 0.5, // smoothed level that turns a cell on
    holdOff: 0.38, // smoothed level that turns it off again
    settleSmall: 250, // ms of stillness before the first state, or a few cells taken away, are accepted
    settleLarge: 600, // ms of stillness before new covered cells (or many taken away) are accepted
    doubtMs: 2500, // new covered cells that do not look like whole pieces wait this long unchanged
    pieceChecks: 2, // frames in a row a new piece must look like a cut piece of the kit
    trustSupport: 0.7, // and the mean reading of its cells (a pen along a row of large cells reads less)
    paperInk: 0.5, // reading above which a sample next to a piece is not paper
    sameColour: 0.2, // a sample that close to a piece's colour (divided by the paper's) is that piece's
    rimOut: 0.3, // how far beyond the board's rim that paper is looked for (world units)
    motionJump: 0.35, // per-frame score jump that counts as movement (in two cells side by side)
    motionQuiet: 300, // ms without movement before changes may settle
    switchFrames: 3, // frames in a row another board must win before the tracker follows it
    coverFrames: 4, // a corner mark not read this many frames in a row,
    coverMs: 150, // and for this long, may be covered by a hand
    forgetMs: 1500, // one not read for longer is left out (glare, a spare piece, a poor print)
    handsMotionMs: 1000, // a covered mark means hands this long after the last movement, or after it went out of sight
    steadyMs: 300, // a mark going out of sight counts as a movement only after being read without a break this long
    holdPx: 2, // one mark alone keeps the last map while it moves less than this (per 640 px)
    tileMemory: 2000, // ms a classic tile stays known after its mark was last read
    lockFrames: 5, // classic board: frames in a row its grid must be found the same way before its marks' places are learned
    lockMiss: 3, // frames in a row the print must disagree before they are forgotten
    minValidShare: 0.6, // share of a cell's samples that must fall inside the image
    paperChroma: 0.08, // colour below which a cell may be (shaded) paper
    shadeRank: 0.6, // which of the nearby paper shades sets the local white (0 darkest, 1 lightest)
    triShrink: 0.5, // the same for triangles, whose sides are much closer to the centre
    // Faint colour with no shade at all is what a coloured piece spills onto
    // the paper next to it (blur, the colour blocks of JPEG): without
    // darkness, a sample needs stronger colour to count as a piece.
    bareChromaLow: 0.16, // chromaLow for a sample that is not darker than the paper
    bareChromaHigh: 0.3, // chromaHigh for such a sample
    bareDark: 0.05, // up to this darkness the bare thresholds apply
    fullDark: 0.2, // from this darkness on the usual ones (linear in between)
    cellStrong: 0.75, // a cell this covered is surely under a piece
    pieceSupport: 0.6, // mean reading of the cells under a piece that is placed
    searchMs: 100, // time for one search for whole pieces (reconstruct's default)
    optionalShare: 4, // a search looks at most at this many times the pieces' area in optional cells
    photoSearchMs: 250, // all the searches for one photo together
    liveSearchMs: 25, // the same for a live frame that accepts a new state
  };

  // ---------------------------------------------------------------------------
  // Homographies

  function project(H, p) {
    const w = H[6] * p.x + H[7] * p.y + H[8];
    return {
      x: (H[0] * p.x + H[1] * p.y + H[2]) / w,
      y: (H[3] * p.x + H[4] * p.y + H[5]) / w,
    };
  }

  function multiply(A, B) {
    const out = new Array(9);
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        out[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
      }
    }
    return out;
  }

  function normalizeH(H) {
    const s = H[8];
    if (Math.abs(s) > 1e-12) return H.map((v) => v / s);
    const n = Math.hypot.apply(null, H) || 1;
    return H.map((v) => v / n);
  }

  function invert(H) {
    const [a, b, c, d, e, f, g, h, i] = H;
    const A = e * i - f * h;
    const B = f * g - d * i;
    const C = d * h - e * g;
    const det = a * A + b * B + c * C;
    if (!det || !Number.isFinite(det)) return null;
    return normalizeH([
      A / det, (c * h - b * i) / det, (b * f - c * e) / det,
      B / det, (a * i - c * g) / det, (c * d - a * f) / det,
      C / det, (b * g - a * h) / det, (a * e - b * d) / det,
    ]);
  }

  // Similarity that moves the points' centroid to 0 and their mean distance to sqrt(2).
  function normalizer(pts) {
    let cx = 0;
    let cy = 0;
    for (const p of pts) {
      cx += p.x;
      cy += p.y;
    }
    cx /= pts.length;
    cy /= pts.length;
    let d = 0;
    for (const p of pts) d += Math.hypot(p.x - cx, p.y - cy);
    d /= pts.length;
    return { cx, cy, s: d > 1e-12 ? Math.SQRT2 / d : 1 };
  }

  // Eigenvector of the smallest eigenvalue of a symmetric n x n matrix (cyclic Jacobi).
  function smallestEigenvector(M, n) {
    const a = Float64Array.from(M);
    const v = new Float64Array(n * n);
    for (let i = 0; i < n; i += 1) v[i * n + i] = 1;
    let scale = 0;
    for (let i = 0; i < n * n; i += 1) scale += a[i] * a[i];
    for (let sweep = 0; sweep < 64; sweep += 1) {
      let off = 0;
      for (let p = 0; p < n; p += 1) for (let q = p + 1; q < n; q += 1) off += a[p * n + q] * a[p * n + q];
      if (off <= 1e-30 * scale) break;
      for (let p = 0; p < n; p += 1) {
        for (let q = p + 1; q < n; q += 1) {
          const apq = a[p * n + q];
          if (Math.abs(apq) < 1e-300) continue;
          const theta = (a[q * n + q] - a[p * n + p]) / (2 * apq);
          const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
          const c = 1 / Math.sqrt(t * t + 1);
          const s = t * c;
          for (let k = 0; k < n; k += 1) {
            const akp = a[k * n + p];
            const akq = a[k * n + q];
            a[k * n + p] = c * akp - s * akq;
            a[k * n + q] = s * akp + c * akq;
          }
          for (let k = 0; k < n; k += 1) {
            const apk = a[p * n + k];
            const aqk = a[q * n + k];
            a[p * n + k] = c * apk - s * aqk;
            a[q * n + k] = s * apk + c * aqk;
          }
          for (let k = 0; k < n; k += 1) {
            const vkp = v[k * n + p];
            const vkq = v[k * n + q];
            v[k * n + p] = c * vkp - s * vkq;
            v[k * n + q] = s * vkp + c * vkq;
          }
        }
      }
    }
    let best = 0;
    for (let i = 1; i < n; i += 1) if (a[i * n + i] < a[best * n + best]) best = i;
    const out = new Array(n);
    for (let k = 0; k < n; k += 1) out[k] = v[k * n + best];
    return out;
  }

  /* Normalized direct linear transform, least squares over all pairs (>= 4).
   * Returns H with dst ~ H * src. */
  function homography(src, dst) {
    const n = Math.min(src.length, dst.length);
    if (n < 4) throw new Error("FenceCamera.homography: at least 4 point pairs are needed.");
    const ns = normalizer(src.slice(0, n));
    const nd = normalizer(dst.slice(0, n));
    const M = new Float64Array(81);
    const row = new Float64Array(9);
    const add = () => {
      for (let i = 0; i < 9; i += 1) {
        const ri = row[i];
        if (ri === 0) continue;
        for (let j = 0; j < 9; j += 1) M[i * 9 + j] += ri * row[j];
      }
    };
    for (let i = 0; i < n; i += 1) {
      const x = (src[i].x - ns.cx) * ns.s;
      const y = (src[i].y - ns.cy) * ns.s;
      const u = (dst[i].x - nd.cx) * nd.s;
      const v = (dst[i].y - nd.cy) * nd.s;
      row[0] = -x; row[1] = -y; row[2] = -1; row[3] = 0; row[4] = 0; row[5] = 0;
      row[6] = u * x; row[7] = u * y; row[8] = u;
      add();
      row[0] = 0; row[1] = 0; row[2] = 0; row[3] = -x; row[4] = -y; row[5] = -1;
      row[6] = v * x; row[7] = v * y; row[8] = v;
      add();
    }
    const h = smallestEigenvector(M, 9);
    const Ts = [ns.s, 0, -ns.s * ns.cx, 0, ns.s, -ns.s * ns.cy, 0, 0, 1];
    const TdInv = [1 / nd.s, 0, nd.cx, 0, 1 / nd.s, nd.cy, 0, 0, 1];
    return normalizeH(multiply(TdInv, multiply(h, Ts)));
  }

  function scaleH(H, s) {
    return normalizeH(multiply([s, 0, 0, 0, s, 0, 0, 0, 1], H));
  }

  // ---------------------------------------------------------------------------
  // Image helpers

  function lumAt(d, w, h, x, y) {
    if (x < 0) x = 0;
    else if (x > w - 1.001) x = w - 1.001;
    if (y < 0) y = 0;
    else if (y > h - 1.001) y = h - 1.001;
    const x0 = x | 0;
    const y0 = y | 0;
    const fx = x - x0;
    const fy = y - y0;
    const i = (y0 * w + x0) * 4;
    const j = i + w * 4;
    const l00 = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const l10 = 0.299 * d[i + 4] + 0.587 * d[i + 5] + 0.114 * d[i + 6];
    const l01 = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
    const l11 = 0.299 * d[j + 4] + 0.587 * d[j + 5] + 0.114 * d[j + 6];
    return (l00 * (1 - fx) + l10 * fx) * (1 - fy) + (l01 * (1 - fx) + l11 * fx) * fy;
  }

  function greyAt(g, w, h, x, y) {
    if (x < 0) x = 0;
    else if (x > w - 1.001) x = w - 1.001;
    if (y < 0) y = 0;
    else if (y > h - 1.001) y = h - 1.001;
    const x0 = x | 0;
    const y0 = y | 0;
    const fx = x - x0;
    const fy = y - y0;
    const i = y0 * w + x0;
    return (g[i] * (1 - fx) + g[i + 1] * fx) * (1 - fy) + (g[i + w] * (1 - fx) + g[i + w + 1] * fx) * fy;
  }

  // Area-averaging downscale of an RGBA image by factor s (0 < s < 1).
  function downscale(img, s) {
    const W = img.width;
    const H = img.height;
    const w = Math.max(1, Math.round(W * s));
    const h = Math.max(1, Math.round(H * s));
    const src = img.data;
    const out = new Uint8ClampedArray(w * h * 4);
    const fx = W / w;
    const fy = H / h;
    for (let y = 0; y < h; y += 1) {
      const y0 = Math.floor(y * fy);
      const y1 = Math.max(y0 + 1, Math.min(H, Math.floor((y + 1) * fy)));
      for (let x = 0; x < w; x += 1) {
        const x0 = Math.floor(x * fx);
        const x1 = Math.max(x0 + 1, Math.min(W, Math.floor((x + 1) * fx)));
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (let yy = y0; yy < y1; yy += 1) {
          let i = (yy * W + x0) * 4;
          for (let xx = x0; xx < x1; xx += 1, i += 4) {
            r += src[i];
            g += src[i + 1];
            b += src[i + 2];
            a += src[i + 3];
          }
        }
        const n = (y1 - y0) * (x1 - x0);
        const o = (y * w + x) * 4;
        out[o] = r / n;
        out[o + 1] = g / n;
        out[o + 2] = b / n;
        out[o + 3] = a / n;
      }
    }
    return { width: w, height: h, data: out };
  }

  // ---------------------------------------------------------------------------
  // Marker detection

  const DICTIONARY = "FENCE_CHALLENGE_4X4";
  let dictionaryIds = null;

  // A js-aruco2 dictionary holding only the ids our boards use, with the codes
  // of the standard ARUCO_4X4_1000 dictionary (so any ArUco tool reads the kit).
  function ensureDictionary(AR) {
    if (dictionaryIds && AR.DICTIONARIES[DICTIONARY]) return dictionaryIds;
    const base = AR.DICTIONARIES.ARUCO_4X4_1000;
    if (!base) throw new Error("FenceCamera needs the ARUCO_4X4_1000 dictionary to be loaded first.");
    const ids = dep("FenceBoards").markerIds();
    AR.DICTIONARIES[DICTIONARY] = { nBits: 16, tau: 2, codeList: ids.map((id) => base.codeList[id]) };
    dictionaryIds = ids;
    return ids;
  }

  function quadArea(q) {
    let s = 0;
    for (let i = 0; i < 4; i += 1) {
      const a = q[i];
      const b = q[(i + 1) % 4];
      s += a.x * b.y - b.x * a.y;
    }
    return Math.abs(s) / 2;
  }

  function quadCenter(q) {
    return { x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4, y: (q[0].y + q[1].y + q[2].y + q[3].y) / 4 };
  }

  function insideQuad(q, p) {
    let sign = 0;
    for (let i = 0; i < 4; i += 1) {
      const a = q[i];
      const b = q[(i + 1) % 4];
      const cr = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      if (cr === 0) continue;
      const s = cr > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
    return true;
  }

  // Point of a quad at marker coordinates (u, v) in [0, 1] (bilinear, fine for small quads).
  function quadPoint(q, u, v) {
    const ax = q[0].x + (q[1].x - q[0].x) * u;
    const ay = q[0].y + (q[1].y - q[0].y) * u;
    const bx = q[3].x + (q[2].x - q[3].x) * u;
    const by = q[3].y + (q[2].y - q[3].y) * u;
    return { x: ax + (bx - ax) * v, y: ay + (by - ay) * v };
  }

  /* Cheap test before decoding: a mark has a dark ring (its black border)
   * inside a lighter quiet zone. Rejects the many white grid cells. */
  const RING = [0.25, 0.5, 0.75];
  function darkRing(g, w, h, q) {
    let ring = 0;
    let out = 0;
    let n = 0;
    for (const t of RING) {
      const pts = [
        [t, 1 / 12, t, -1 / 12],
        [t, 11 / 12, t, 13 / 12],
        [1 / 12, t, -1 / 12, t],
        [11 / 12, t, 13 / 12, t],
      ];
      for (const [ui, vi, uo, vo] of pts) {
        const a = quadPoint(q, ui, vi);
        const b = quadPoint(q, uo, vo);
        ring += greyAt(g, w, h, a.x, a.y);
        out += greyAt(g, w, h, b.x, b.y);
        n += 1;
      }
    }
    ring /= n;
    out /= n;
    return out - ring > Math.max(12, 0.2 * out);
  }

  function fitLine(xs, ys, n) {
    let mx = 0;
    let my = 0;
    for (let i = 0; i < n; i += 1) {
      mx += xs[i];
      my += ys[i];
    }
    mx /= n;
    my /= n;
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (let i = 0; i < n; i += 1) {
      const dx = xs[i] - mx;
      const dy = ys[i] - my;
      sxx += dx * dx;
      sxy += dx * dy;
      syy += dy * dy;
    }
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let err = 0;
    for (let i = 0; i < n; i += 1) {
      const d = (xs[i] - mx) * -dy + (ys[i] - my) * dx;
      err += d * d;
    }
    return { x: mx, y: my, dx, dy, rms: Math.sqrt(err / n) };
  }

  function intersect(a, b) {
    const den = a.dx * b.dy - a.dy * b.dx;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((b.x - a.x) * b.dy - (b.y - a.y) * b.dx) / den;
    return { x: a.x + a.dx * t, y: a.y + a.dy * t };
  }

  /* Sub-pixel corners: along each side, find the strongest dark-to-light step
   * going outward, fit a line through those points, and intersect the lines.
   * Keeps the original corners whenever the fit is not convincing. */
  const EDGE_XS = new Float64Array(16);
  const EDGE_YS = new Float64Array(16);
  const PROFILE = new Float64Array(64);
  function refineCorners(g, w, h, c) {
    const lines = [];
    let reachMax = 0;
    for (let k = 0; k < 4; k += 1) {
      const a = c[k];
      const b = c[(k + 1) % 4];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 12) return c;
      const nx = dy / len; // outward normal of a clockwise quad (y down)
      const ny = -dx / len;
      const reach = Math.min(6, Math.max(1.5, len / 12));
      reachMax = Math.max(reachMax, reach);
      const step = 0.5;
      const J = Math.ceil(reach / step);
      let m = 0;
      for (let s = 0; s < 9; s += 1) {
        const t = 0.18 + s * 0.08;
        const px = a.x + dx * t;
        const py = a.y + dy * t;
        for (let j = -J - 1; j <= J + 1; j += 1) {
          PROFILE[j + J + 1] = greyAt(g, w, h, px + nx * j * step, py + ny * j * step);
        }
        let best = 0;
        let bestVal = 20; // minimum step, in grey levels over one pixel
        let found = false;
        for (let j = -J; j <= J; j += 1) {
          const grad = PROFILE[j + J + 2] - PROFILE[j + J];
          if (grad > bestVal) {
            bestVal = grad;
            best = j;
            found = true;
          }
        }
        if (!found) continue;
        let sub = 0;
        if (best > -J && best < J) {
          const g0 = PROFILE[best + J + 1] - PROFILE[best + J - 1];
          const g2 = PROFILE[best + J + 3] - PROFILE[best + J + 1];
          const den = g0 - 2 * bestVal + g2;
          if (den < 0) sub = (0.5 * (g0 - g2)) / den;
        }
        const off = (best + sub) * step;
        EDGE_XS[m] = px + nx * off;
        EDGE_YS[m] = py + ny * off;
        m += 1;
      }
      if (m < 5) return c;
      const line = fitLine(EDGE_XS, EDGE_YS, m);
      if (line.rms > 0.8) return c;
      lines.push(line);
    }
    const out = [];
    for (let k = 0; k < 4; k += 1) {
      const p = intersect(lines[(k + 3) % 4], lines[k]);
      if (!p || Math.hypot(p.x - c[k].x, p.y - c[k].y) > reachMax + 1.5) return c;
      out.push(p);
    }
    return out;
  }

  // Drop detections nested inside a larger one (the same mark found twice).
  function dedupe(list) {
    const sorted = list
      .map((m) => ({ m, area: quadArea(m.corners) }))
      .sort((a, b) => b.area - a.area);
    const keep = [];
    for (const s of sorted) {
      const c = quadCenter(s.m.corners);
      if (keep.some((k) => insideQuad(k.m.corners, c))) continue;
      keep.push(s);
    }
    return keep.map((k) => k.m).sort((a, b) => a.id - b.id);
  }

  /* createDetector() -> { detect(image) }
   * detect returns [{ id, corners: [4 points], hamming }] with the corners in
   * the mark's own reading order (top-left, top-right, bottom-right,
   * bottom-left of the printed code), in image pixels. */
  function createDetector(options) {
    const opts = Object.assign({ refine: true }, options);
    const AR = dep("AR");
    const CV = dep("CV");
    const ids = ensureDictionary(AR);
    const det = new AR.Detector({ dictionaryName: DICTIONARY, maxHammingDistance: 2 });
    let bw = 0;
    let bh = 0;

    // Reusable buffers, sized once per frame size.
    function buffers(w, h) {
      if (w === bw && h === bh) return;
      det.grey = new CV.Image(w, h, new Uint8Array(w * h));
      det.thres = new CV.Image(w, h, new Uint8Array(w * h));
      det.binary = new Int32Array((w + 2) * (h + 2));
      det.homography = new CV.Image(0, 0, new Uint8Array(49 * 49));
      bw = w;
      bh = h;
    }

    function detect(image) {
      const w = image.width;
      const h = image.height;
      buffers(w, h);
      CV.grayscale(image, det.grey);
      CV.adaptiveThreshold(det.grey, det.thres, 2, 7);
      const contours = CV.findContours(det.thres, det.binary);
      let candidates = det.findCandidates(contours, Math.max(w, h) * 0.01, 0.05, 10);
      candidates = det.clockwiseCorners(candidates);
      candidates = det.notTooNear(candidates, 10);
      const g = det.grey.data;
      candidates = candidates.filter((q) => darkRing(g, w, h, q));
      const found = det.findMarkers(det.grey, candidates, 49);
      const out = [];
      for (const m of found) {
        let corners = m.corners.map((p) => ({ x: p.x, y: p.y }));
        if (opts.refine) corners = refineCorners(g, w, h, corners);
        out.push({ id: ids[m.id], corners, hamming: m.hammingDistance });
      }
      return dedupe(out);
    }

    return { detect, ids: ids.slice() };
  }

  // ---------------------------------------------------------------------------
  // The classic kit's tiles

  /* Cells of each classic tile relative to its mark, in the mark's own reading
   * frame (x toward the mark's right, y down, the mark's cell at 0,0). Read
   * from the printed tile sheet; the square lab's marker table gives the same
   * cells once its rotations are undone. Fronts 20-31, backs 32-43. */
  const TILE_CELLS = {
    20: [[-1, 0], [0, -1], [0, 0], [0, 1], [1, -1]],
    21: [[0, -2], [0, -1], [0, 0], [0, 1], [0, 2]],
    22: [[0, -2], [0, -1], [0, 0], [0, 1], [1, 1]],
    23: [[0, 0], [0, 1], [0, 2], [1, -1], [1, 0]],
    24: [[0, -1], [0, 0], [0, 1], [1, -1], [1, 0]],
    25: [[-1, 0], [0, 0], [0, 1], [0, 2], [1, 0]],
    26: [[-1, -1], [-1, 0], [0, 0], [1, -1], [1, 0]],
    27: [[0, -2], [0, -1], [0, 0], [1, 0], [2, 0]],
    28: [[-1, -1], [-1, 0], [0, 0], [0, 1], [1, 1]],
    29: [[-1, 0], [0, -1], [0, 0], [0, 1], [1, 0]],
    30: [[-1, 0], [0, -1], [0, 0], [0, 1], [0, 2]],
    31: [[-1, -1], [0, -1], [0, 0], [0, 1], [1, 1]],
    32: [[-1, -1], [0, -1], [0, 0], [0, 1], [1, 0]],
    33: [[0, -2], [0, -1], [0, 0], [0, 1], [0, 2]],
    34: [[-1, 1], [0, -2], [0, -1], [0, 0], [0, 1]],
    35: [[-1, -1], [-1, 0], [0, 0], [0, 1], [0, 2]],
    36: [[-1, -1], [-1, 0], [0, -1], [0, 0], [0, 1]],
    37: [[-1, 0], [0, 0], [0, 1], [0, 2], [1, 0]],
    38: [[-1, -1], [-1, 0], [0, 0], [1, -1], [1, 0]],
    39: [[-2, 0], [-1, 0], [0, -2], [0, -1], [0, 0]],
    40: [[-1, 1], [0, 0], [0, 1], [1, -1], [1, 0]],
    41: [[-1, 0], [0, -1], [0, 0], [0, 1], [1, 0]],
    42: [[0, -1], [0, 0], [0, 1], [0, 2], [1, 0]],
    43: [[-1, 1], [0, -1], [0, 0], [0, 1], [1, -1]],
  };

  // Quarter turns (clockwise on paper, y down) that bring the mark's reading
  // frame onto the board: 0 when the mark reads upright on the board.
  function quarterTurns(wc) {
    const ex = wc[1].x - wc[0].x + (wc[2].x - wc[3].x);
    const ey = wc[1].y - wc[0].y + (wc[2].y - wc[3].y);
    const fx = wc[3].x - wc[0].x + (wc[2].x - wc[1].x);
    const fy = wc[3].y - wc[0].y + (wc[2].y - wc[1].y);
    if (ex * fy - ey * fx <= 0) return -1; // seen mirrored: not a real tile
    const ax = ex + fy;
    const ay = ey - fx;
    return (((Math.round(Math.atan2(ay, ax) / (Math.PI / 2)) % 4) + 4) % 4);
  }

  /* A classic tile seen at world corners wc -> its cells on the board, or
   * null when the mark cannot be a tile lying on the grid (wrong size, not
   * square with the grid, or far from a cell centre). */
  function tileFromWorld(id, wc, board) {
    const rel = TILE_CELLS[id];
    if (!rel) return null;
    const info = dep("FenceBoards").lookupMarker(id);
    const turns = quarterTurns(wc);
    if (turns < 0) return null;
    let side = 0;
    let tilt = 0;
    for (let k = 0; k < 4; k += 1) {
      const a = wc[k];
      const b = wc[(k + 1) % 4];
      side += Math.hypot(b.x - a.x, b.y - a.y) / 4;
      const ang = Math.abs(Math.atan2(b.y - a.y, b.x - a.x)) % (Math.PI / 2);
      tilt = Math.max(tilt, Math.min(ang, Math.PI / 2 - ang));
    }
    if (side < 0.55 || side > 1.35 || tilt > 0.35) return null;
    const c = quadCenter(wc);
    const mx = Math.round(c.x);
    const my = Math.round(c.y);
    if (Math.abs(c.x - mx) > 0.45 || Math.abs(c.y - my) > 0.45) return null;
    const cells = rel.map(([x, y]) => {
      let rx = x;
      let ry = y;
      for (let i = 0; i < turns; i += 1) {
        const t = rx;
        rx = -ry;
        ry = t;
      }
      return (mx + rx) + "," + (my + ry);
    });
    if (!cells.every((k) => board.map.has(k))) return null;
    return {
      id,
      piece: info ? info.piece : null,
      side: info ? info.side : null,
      cells,
      center: c,
      offset: Math.max(Math.abs(c.x - mx), Math.abs(c.y - my)),
    };
  }

  // ---------------------------------------------------------------------------
  // Boards: sample layouts, paper anchors, marker geometry

  const CLASSIC_MARK_SIDE = 2.04; // side of a classic corner mark, in cells (measured on prints)
  const MARK_CORNERS = ["tl", "tr", "br", "bl"];

  function vertexKey(v) {
    return Math.round(v.x * 1000) + ":" + Math.round(v.y * 1000);
  }

  const boardCache = new Map();

  function boardInfo(boardId) {
    const cached = boardCache.get(boardId);
    if (cached) return cached;
    const FB = dep("FenceBoards");
    const geometry = FB.geometry(boardId);
    const cells = geometry.board.cells;
    const n = cells.length;

    // Sample points: the centre, and for every vertex and every edge midpoint
    // of the shrunk cell, one point on its outline and one half way in.
    const pts = [];
    const start = new Int32Array(n + 1);
    cells.forEach((cell, i) => {
      start[i] = pts.length / 2;
      const c = cell.centroid;
      const v = cell.vertices;
      const S = geometry.lattice.name === "triangular" ? TUNING.triShrink : TUNING.shrink;
      pts.push(c.x, c.y);
      for (let k = 0; k < v.length; k += 1) {
        const a = v[k];
        const b = v[(k + 1) % v.length];
        const corner = { x: c.x + S * (a.x - c.x), y: c.y + S * (a.y - c.y) };
        const mid = { x: c.x + S * ((a.x + b.x) / 2 - c.x), y: c.y + S * ((a.y + b.y) / 2 - c.y) };
        for (const p of [corner, mid]) {
          pts.push(p.x, p.y);
          pts.push(c.x + 0.5 * (p.x - c.x), c.y + 0.5 * (p.y - c.y));
        }
      }
    });
    start[n] = pts.length / 2;

    const ext = geometry.extent;
    const norm = {
      cx: (ext.minX + ext.maxX) / 2,
      cy: (ext.minY + ext.maxY) / 2,
      sx: Math.max(1e-6, (ext.maxX - ext.minX) / 2),
      sy: Math.max(1e-6, (ext.maxY - ext.minY) / 2),
    };
    const basis = new Float64Array(6 * n);
    cells.forEach((cell, i) => quadBasis(basis, i * 6, (cell.centroid.x - norm.cx) / norm.sx, (cell.centroid.y - norm.cy) / norm.sy));

    // Cells around each cell (centroids within a radius holding about 14
    // cells), for the local shading estimate.
    const outline = cells[0].vertices;
    let area = 0;
    for (let k = 0; k < outline.length; k += 1) {
      const a = outline[k];
      const b = outline[(k + 1) % outline.length];
      area += a.x * b.y - b.x * a.y;
    }
    const radius = Math.max(1.8, Math.sqrt((14 * Math.abs(area / 2)) / Math.PI));
    // (centroids sorted into square buckets one radius wide: only the 3 x 3
    // buckets around a cell can hold its neighbours)
    const buckets = new Map();
    const bucketOf = (p) => Math.floor(p.x / radius) + ":" + Math.floor(p.y / radius);
    cells.forEach((cell, j) => {
      const key = bucketOf(cell.centroid);
      let list = buckets.get(key);
      if (!list) buckets.set(key, (list = []));
      list.push(j);
    });
    const nearList = [];
    const nearStart = new Int32Array(n + 1);
    const found = [];
    for (let i = 0; i < n; i += 1) {
      nearStart[i] = nearList.length;
      const ci = cells[i].centroid;
      const bx = Math.floor(ci.x / radius);
      const by = Math.floor(ci.y / radius);
      found.length = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const list = buckets.get(bx + dx + ":" + (by + dy));
          if (!list) continue;
          for (const j of list) {
            const cj = cells[j].centroid;
            if (Math.hypot(ci.x - cj.x, ci.y - cj.y) <= radius) found.push(j);
          }
        }
      }
      found.sort((a, b) => a - b);
      for (const j of found) nearList.push(j);
    }
    nearStart[n] = nearList.length;
    const indexOf = new Map(cells.map((c, i) => [c.key, i]));
    const adjList = [];
    const adjStart = new Int32Array(n + 1);
    cells.forEach((cell, i) => {
      adjStart[i] = adjList.length;
      for (const nb of geometry.lattice.cellNeighbors(cell)) {
        const j = indexOf.get(geometry.lattice.cellKey(nb));
        if (j !== undefined) adjList.push(j);
      }
    });
    adjStart[n] = adjList.length;
    // Cells sharing at least a corner.
    const byVertex = new Map();
    cells.forEach((cell, i) => {
      for (const v of cell.vertices) {
        const vk = vertexKey(v);
        let list = byVertex.get(vk);
        if (!list) byVertex.set(vk, (list = []));
        list.push(i);
      }
    });
    const touchList = [];
    const touchStart = new Int32Array(n + 1);
    cells.forEach((cell, i) => {
      touchStart[i] = touchList.length;
      const seen = new Set([i]);
      for (const v of cell.vertices) {
        for (const j of byVertex.get(vertexKey(v))) {
          if (seen.has(j)) continue;
          seen.add(j);
          touchList.push(j);
        }
      }
    });
    touchStart[n] = touchList.length;

    const classic = geometry.def.geometry === "measured";
    const info = {
      id: boardId,
      geometry,
      board: geometry.board,
      lattice: geometry.lattice,
      classic,
      n,
      keys: cells.map((c) => c.key),
      samples: Float64Array.from(pts),
      sampleStart: start,
      norm,
      basis,
      near: Int32Array.from(nearList),
      nearStart,
      adj: Int32Array.from(adjList),
      adjStart,
      touch: Int32Array.from(touchList),
      touchStart,
      byVertex,
      rims: null, // rim edges of each cell (see rimEdges)
      index: indexOf,
      nominal: classic ? classicNominal(geometry) : printedMarkers(geometry),
      types: FB.pieceTypes(boardId),
      pieceArea: 0,
      ready: false, // prepare() has run
    };
    info.pieceArea = info.types.reduce((sum, t) => sum + t.cells.length, 0);
    boardCache.set(boardId, info);
    return info;
  }

  function printedMarkers(geometry) {
    const out = {};
    for (const c of ["tl", "tr", "br", "bl"]) out[c] = geometry.markers[c].corners.map((p) => ({ x: p.x, y: p.y }));
    return out;
  }

  // Where the classic corner marks usually are, from the registry's grid prior.
  function classicNominal(geometry) {
    const p = geometry.def.gridPrior;
    const size = geometry.def.spec.size;
    const su = size / (p.u1 - p.u0);
    const sv = size / (p.v1 - p.v0);
    const x0 = -0.5 - p.u0 * su;
    const y0 = -0.5 - p.v0 * sv;
    const half = CLASSIC_MARK_SIDE / 2;
    const square = (cx, cy) => [
      { x: cx - half, y: cy - half },
      { x: cx + half, y: cy - half },
      { x: cx + half, y: cy + half },
      { x: cx - half, y: cy + half },
    ];
    return { tl: square(x0, y0), tr: square(x0 + su, y0), br: square(x0 + su, y0 + sv), bl: square(x0, y0 + sv) };
  }

  /* World points that are plain paper: half a module outside every mark, the
   * white band between the marks and the board (printed boards), or the
   * margin just outside the grid (classic board). */
  function paperAnchors(info, markerWorld) {
    const pts = [];
    for (const corner of ["tl", "tr", "br", "bl"]) {
      const q = markerWorld[corner];
      if (!q) continue;
      const side = Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y);
      const out = side / 12;
      for (let k = 0; k < 4; k += 1) {
        const a = q[k];
        const b = q[(k + 1) % 4];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const nx = (b.y - a.y) / len;
        const ny = -(b.x - a.x) / len;
        for (const t of [0.2, 0.5, 0.8]) {
          pts.push({ x: a.x + (b.x - a.x) * t + nx * out, y: a.y + (b.y - a.y) * t + ny * out });
        }
      }
    }
    const b = info.board.bounds;
    if (info.classic) {
      const size = info.geometry.def.spec.size;
      for (let t = 0; t < size; t += 1) {
        pts.push({ x: t, y: -1.05 }, { x: t, y: size + 0.05 }, { x: -1.05, y: t }, { x: size + 0.05, y: t });
      }
    } else {
      const gap = dep("FenceBoards").markerLayout(b).gap;
      const count = Math.max(4, Math.round(b.maxX - b.minX));
      for (let i = 0; i < count; i += 1) {
        const x = b.minX + ((i + 0.5) * (b.maxX - b.minX)) / count;
        pts.push({ x, y: b.minY - gap / 2 }, { x, y: b.maxY + gap / 2 });
      }
    }
    return pts;
  }

  function pieceTypesFor(info) {
    return info.types;
  }

  /* prepare(boardId) builds ahead of time what the camera needs for one
   * board: where each cell is sampled, which cells are near each other, the
   * fence rule's tables and the shapes of the pieces. Then the frame on
   * which the board is first recognised costs no more than the next ones.
   * The tracker does it for the board it is given as a hint; a page can
   * call it earlier, before the camera starts. Returns false for an
   * unknown board. */
  function prepare(boardId) {
    if (!dep("FenceBoards").get(boardId)) return false;
    const info = boardInfo(boardId);
    if (!info.ready) {
      emptyAnalysis(info);
      boardLandings(info.board, info.lattice);
      for (const t of info.types) variantsOf(info.lattice, t);
      rimEdges(info);
      ensureDictionary(dep("AR"));
      info.ready = true;
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Finding the board in a frame

  // Corner marks of each board among the detections: Map boardId -> Map corner -> marker.
  function cornersByBoard(markers) {
    const FB = dep("FenceBoards");
    const byBoard = new Map();
    for (const m of markers) {
      const info = FB.lookupMarker(m.id);
      if (!info || info.kind !== "corner") continue;
      let byCorner = byBoard.get(info.boardId);
      if (!byCorner) {
        byCorner = new Map();
        byBoard.set(info.boardId, byCorner);
      }
      const prev = byCorner.get(info.corner);
      if (!prev || quadArea(m.corners) > quadArea(prev.corners)) byCorner.set(info.corner, m);
    }
    return byBoard;
  }

  function pickBoard(byBoard, prefer) {
    let best = null;
    let bestScore = -1;
    for (const [id, byCorner] of byBoard) {
      let score = byCorner.size;
      prefer.forEach((p, i) => {
        if (p === id) score += 0.5 / (i + 1);
      });
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    return best;
  }

  /* Fit the world -> image homography from the visible corner marks of one
   * board, dropping a mark that disagrees with the others (only when the
   * marks' world positions are exact, i.e. `strict`). */
  function fitMarks(byCorner, markerWorld, strict) {
    let used = [];
    for (const corner of ["tl", "tr", "br", "bl"]) {
      const m = byCorner.get(corner);
      if (m && markerWorld[corner]) used.push({ corner, marker: m, world: markerWorld[corner] });
    }
    if (used.length === 0) return null;
    for (;;) {
      const src = [];
      const dst = [];
      for (const u of used) {
        for (let k = 0; k < 4; k += 1) {
          src.push(u.world[k]);
          dst.push(u.marker.corners[k]);
        }
      }
      const H = homography(src, dst);
      let worst = -1;
      let worstErr = 0;
      let sum = 0;
      used.forEach((u, i) => {
        let err = 0;
        for (let k = 0; k < 4; k += 1) {
          const p = project(H, u.world[k]);
          const e = Math.hypot(p.x - u.marker.corners[k].x, p.y - u.marker.corners[k].y);
          sum += e * e;
          err = Math.max(err, e);
        }
        const side = Math.sqrt(quadArea(u.marker.corners));
        const tol = Math.max(2.5, 0.08 * side);
        if (err > tol && err / tol > worstErr) {
          worstErr = err / tol;
          worst = i;
        }
      });
      if (strict && worst >= 0 && used.length > 2) {
        used = used.filter((_, i) => i !== worst);
        continue;
      }
      if (!orientationOk(H, used)) return null;
      return { H, used, reprojError: Math.sqrt(sum / (used.length * 4)) };
    }
  }

  /* Classic board, before its marks are measured: the registry's grid prior
   * is given relative to the four mark centres, so fit from those (exact),
   * or from the nominal mark squares when a mark is missing. */
  function fitClassicPrior(byCorner, nominal) {
    if (byCorner.size < 4) return fitMarks(byCorner, nominal, false);
    const src = [];
    const dst = [];
    const used = [];
    for (const corner of ["tl", "tr", "br", "bl"]) {
      const m = byCorner.get(corner);
      src.push(quadCenter(nominal[corner]));
      dst.push(quadCenter(m.corners));
      used.push({ corner, marker: m, world: nominal[corner] });
    }
    const H = homography(src, dst);
    if (!orientationOk(H, used)) return null;
    return { H, used, reprojError: 0 };
  }

  /* Locate a board: exact marks for printed boards; for the classic board the
   * marks measured so far (or the prior), then its grid lines. For the
   * classic board the fit also says whether the grid found agrees with the
   * print (`structure`: true, false, or null when that could not be told;
   * see refineClassicGrid and refineGridProjective) and with the tile marks
   * read in the same image (`markers`, optional): most of them near a cell
   * centre, and none that the grid moved by a whole cell would keep on the
   * board while this one loses it. */
  function locate(image, info, byCorner, learned, markers) {
    if (!info.classic) {
      const fit = fitMarks(byCorner, info.nominal, true);
      if (fit) fit.world = info.nominal;
      return fit;
    }
    const fit = learned ? fitMarks(byCorner, learned, true) : fitClassicPrior(byCorner, info.nominal);
    if (!fit) return null;
    fit.world = learned || info.nominal;
    const size = info.geometry.def.spec.size;
    let H = fit.H;
    let rms = null;
    let structure = null;
    // Once the marks are measured the map is already close: one look along
    // the lines is enough. Otherwise start with the straight-line stage.
    for (let pass = 0; pass < (learned ? 0 : 2); pass += 1) {
      const g = refineClassicGrid(image, H, size);
      if (!g.ok) break;
      H = g.H;
      rms = Math.max(g.fits[0].rms, g.fits[1].rms);
      structure = g.structure;
    }
    // a wider first look when the straight-line stage could not settle
    for (let pass = 0; pass < (learned ? 1 : 3); pass += 1) {
      const g = refineGridProjective(image, H, size, pass === 0 && rms === null && !learned ? 0.45 : 0.3);
      if (!g.ok) break;
      H = g.H;
      rms = g.rms;
      structure = g.structure;
    }
    fit.gridOk = rms !== null;
    fit.structure = fit.gridOk ? structure : null;
    if (fit.gridOk) {
      fit.H = H;
      // residual of the fitted grid lines, in pixels (cell size near the board centre)
      const c = size / 2;
      const a = project(H, { x: c, y: c });
      const b = project(H, { x: c + 1, y: c });
      fit.reprojError = Math.hypot(b.x - a.x, b.y - a.y) * rms;
      if (markers) {
        const t = tileEvidence(H, markers, info.board);
        if (t.total && (t.better || 2 * t.near < t.total)) fit.structure = false;
      }
    }
    return fit;
  }

  /* Classic board: the tile marks read in an image, against a grid map: how
   * many sit near a cell centre, and whether the grid moved by a whole cell
   * in some direction would keep more of the tiles on the board (it would,
   * were the grid locked one cell off next to tiles at the rim). */
  function tileEvidence(H, markers, board) {
    const out = { total: 0, near: 0, better: false };
    const Hinv = invert(H);
    if (!Hinv) return out;
    const kept = new Array(9).fill(0);
    for (const m of markers) {
      if (!TILE_CELLS[m.id]) continue;
      const wc = m.corners.map((p) => project(Hinv, p));
      out.total += 1;
      const c = quadCenter(wc);
      if (Math.abs(c.x - Math.round(c.x)) <= 0.45 && Math.abs(c.y - Math.round(c.y)) <= 0.45) out.near += 1;
      for (let s = 0; s < 9; s += 1) {
        const dx = (s % 3) - 1;
        const dy = Math.floor(s / 3) - 1;
        if (tileFromWorld(m.id, wc.map((p) => ({ x: p.x + dx, y: p.y + dy })), board)) kept[s] += 1;
      }
    }
    out.better = kept.some((v) => v > kept[4]);
    return out;
  }

  // The map must keep the paper's orientation (a mirror means a wrong fit).
  function orientationOk(H, used) {
    const w = used[0].world;
    const a = project(H, w[0]);
    const b = project(H, w[1]);
    const c = project(H, w[3]);
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0;
  }

  /* Classic board: find the 21 + 21 printed grid lines around where the
   * current map puts them and correct the map so line k sits at -0.5 + k.
   * The comb of 21 lines is looked for within about a third of a cell of
   * where the map puts it. When the map is off by half a cell or more (the
   * sheets are not always taped the same way), the comb lands on the
   * neighbouring lines and still matches 20 of the 21. So the comb one cell
   * to each side is tried as well, and the one that fits the print is kept:
   * its two outer lines are strong (the grid's border) and one cell beyond
   * them there is only margin. Returns { H, ok, fits, structure } with the
   * corrected map (structure: true when on each axis exactly one comb
   * fitted, null when that could not be told). */
  const GRID_BINS = 20;
  const GRID_REACH = 3.5; // the profiles run this many cells beyond the grid on each side
  const GRID_EDGE = 0.5; // an outer line is at least this strong, as a share of a typical line
  const GRID_MARGIN = 0.2; // one cell beyond it, no line stronger than this share
  const GRID_CONTRAST = 8; // grey levels a typical line must stand out by for these tests
  function refineClassicGrid(img, H, size) {
    const d = img.data;
    const w = img.width;
    const h = img.height;
    const X0 = -GRID_REACH;
    const nb = (size + 2 * GRID_REACH) * GRID_BINS;
    const prof = new Float64Array(nb);
    const hp = new Float64Array(nb);
    const tmp = new Float64Array(size);
    const fits = [];
    for (let axis = 0; axis < 2; axis += 1) {
      for (let b = 0; b < nb; b += 1) {
        const t = X0 + (b + 0.5) / GRID_BINS;
        let m = 0;
        for (let j = 0; j < size; j += 1) {
          const X = axis === 0 ? t : j;
          const Y = axis === 0 ? j : t;
          const iw = H[6] * X + H[7] * Y + H[8];
          const x = (H[0] * X + H[1] * Y + H[2]) / iw;
          const y = (H[3] * X + H[4] * Y + H[5]) / iw;
          if (x < 0 || y < 0 || x > w - 1 || y > h - 1) continue;
          tmp[m] = 255 - lumAt(d, w, h, x, y);
          m += 1;
        }
        if (m < size * 0.5) {
          prof[b] = NaN;
          continue;
        }
        // mean of the lighter 70 % (pieces are dark everywhere, lines only here)
        const view = tmp.subarray(0, m).sort();
        const keep = Math.max(1, Math.round(m * 0.7));
        let s = 0;
        for (let i = 0; i < keep; i += 1) s += view[i];
        prof[b] = s / keep;
      }
      const half = GRID_BINS / 2;
      for (let b = 0; b < nb; b += 1) {
        if (Number.isNaN(prof[b])) {
          hp[b] = 0;
          continue;
        }
        let s = 0;
        let c = 0;
        for (let k = Math.max(0, b - half); k <= Math.min(nb - 1, b + half); k += 1) {
          if (!Number.isNaN(prof[k])) {
            s += prof[k];
            c += 1;
          }
        }
        hp[b] = Math.max(0, prof[b] - s / c);
      }
      const at = (pos) => {
        const f = (pos - X0) * GRID_BINS - 0.5;
        const i = Math.floor(f);
        if (i < 0 || i >= nb - 1) return 0;
        const r = f - i;
        return hp[i] * (1 - r) + hp[i + 1] * r;
      };
      // coarse search over offset and pitch
      let comb = { score: -1, a: -0.5, p: 1 };
      for (let p = 0.97; p <= 1.0301; p += 0.002) {
        for (let a = -0.85; a <= -0.15; a += 0.5 / GRID_BINS) {
          let s = 0;
          for (let k = 0; k <= size; k += 1) s += at(a + p * k);
          if (s > comb.score) comb = { score: s, a, p };
        }
      }
      // the same comb one cell to each side, against the print
      const peakNear = (pos) => {
        const lo = Math.max(0, Math.floor((pos - 0.2 - X0) * GRID_BINS));
        const hi = Math.min(nb - 1, Math.ceil((pos + 0.2 - X0) * GRID_BINS));
        let v = 0;
        for (let i = lo; i <= hi; i += 1) if (hp[i] > v) v = hp[i];
        return v;
      };
      const fitting = [];
      for (const shift of [0, -1, 1]) {
        const a0 = comb.a + shift * comb.p;
        const inner = [];
        for (let k = 1; k < size; k += 1) inner.push(peakNear(a0 + comb.p * k));
        inner.sort((x, y) => x - y);
        const typical = inner[inner.length >> 1];
        const edge = Math.min(peakNear(a0), peakNear(a0 + comb.p * size));
        const margin = Math.max(peakNear(a0 - comb.p), peakNear(a0 + comb.p * (size + 1)));
        if (typical >= GRID_CONTRAST && edge >= GRID_EDGE * typical && margin <= GRID_MARGIN * typical) fitting.push({ a0, gap: edge - margin });
      }
      if (fitting.length) comb.a = fitting.sort((x, y) => y.gap - x.gap)[0].a0;
      // refine every line locally, then least squares with outlier rejection
      const pos = [];
      for (let k = 0; k <= size; k += 1) {
        const c = comb.a + comb.p * k;
        let bi = -1;
        let bv = 0;
        const lo = Math.max(1, Math.floor((c - 0.2 - X0) * GRID_BINS));
        const hi = Math.min(nb - 2, Math.ceil((c + 0.2 - X0) * GRID_BINS));
        for (let i = lo; i <= hi; i += 1) {
          if (hp[i] > bv) {
            bv = hp[i];
            bi = i;
          }
        }
        if (bi < 0) continue;
        const den = hp[bi - 1] - 2 * hp[bi] + hp[bi + 1];
        const sub = den < 0 ? (0.5 * (hp[bi - 1] - hp[bi + 1])) / den : 0;
        pos.push({ k, x: X0 + (bi + 0.5 + sub) / GRID_BINS, wgt: bv });
      }
      let a = comb.a;
      let p = comb.p;
      let rms = 1;
      let kept = pos;
      for (let it = 0; it < 3 && kept.length >= 4; it += 1) {
        let sw = 0;
        let sk = 0;
        let sx = 0;
        let skk = 0;
        let skx = 0;
        for (const q of kept) {
          sw += q.wgt;
          sk += q.wgt * q.k;
          sx += q.wgt * q.x;
          skk += q.wgt * q.k * q.k;
          skx += q.wgt * q.k * q.x;
        }
        const det = sw * skk - sk * sk;
        if (!(det > 0)) break;
        p = (sw * skx - sk * sx) / det;
        a = (sx - p * sk) / sw;
        let e = 0;
        for (const q of kept) e += (q.x - a - p * q.k) ** 2;
        rms = Math.sqrt(e / kept.length);
        const next = kept.filter((q) => Math.abs(q.x - a - p * q.k) < 0.12);
        if (next.length === kept.length) break;
        kept = next;
      }
      // contrast: line peaks against the level between lines
      let peak = 0;
      for (const q of kept) peak += q.wgt;
      peak /= Math.max(1, kept.length);
      let between = 0;
      let nbetween = 0;
      for (let b = 0; b < nb; b += 1) {
        const u = (X0 + (b + 0.5) / GRID_BINS - a) / p;
        if (u < 0 || u > size || Math.abs(u - Math.round(u)) * p < 0.25) continue;
        between += hp[b];
        nbetween += 1;
      }
      between /= Math.max(1, nbetween);
      fits.push({ a, p, rms, lines: kept.length, contrast: peak / (between + 1), structure: fitting.length === 1 ? true : null });
    }
    const ok = fits.every((f) => f.lines >= size * 0.6 && f.rms < 0.08 && f.contrast > 3 && Math.abs(f.p - 1) < 0.03);
    const A = [fits[0].p, 0, fits[0].a + 0.5 * fits[0].p, 0, fits[1].p, fits[1].a + 0.5 * fits[1].p, 0, 0, 1];
    return { H: normalizeH(multiply(H, A)), ok, fits, structure: fits.every((f) => f.structure) ? true : null };
  }

  /* Classic board, second stage: measure every grid line along its length
   * (in pieces a few cells long), then fit the homography C that puts all
   * those measured points back on their lines. Each point on a vertical line
   * x = x_k gives the linear condition c1.P - x_k c3.P = 0 (c1, c2, c3 the
   * rows of C), and similarly for horizontal lines, so C comes from one
   * homogeneous least squares problem. Corrects the perspective error that
   * an approximate mark geometry leaves. The places one cell beyond the two
   * outer lines are looked at too: there the print has only margin, and the
   * outer lines are strong (`structure`: false when the map is a whole cell
   * off, see below). Returns { H, ok, rms, structure }. */
  function refineGridProjective(img, H, size, half) {
    const d = img.data;
    const w = img.width;
    const h = img.height;
    const SEG = 4; // cells per piece of line
    const HALF = half || 0.3; // search half width, in cells
    const STEPS = Math.round(2 * HALF * GRID_BINS);
    const prof = new Float64Array(STEPS + 1);
    const obs = []; // { axis, P: {x, y}, target, wgt }
    // line strengths per axis: [inner lines], [outer lines low, high], [margins low, high]
    const inner = [[], []];
    const outer = [[[], []], [[], []]];
    const margin = [[[], []], [[], []]];
    for (let axis = 0; axis < 2; axis += 1) {
      for (let k = -1; k <= size + 1; k += 1) {
        const line = -0.5 + k;
        for (let s0 = 0; s0 < size; s0 += SEG) {
          const s1 = Math.min(size, s0 + SEG);
          for (let i = 0; i <= STEPS; i += 1) {
            const t = line - HALF + i / GRID_BINS;
            let sum = 0;
            let cnt = 0;
            for (let j = s0; j < s1; j += 1) {
              const X = axis === 0 ? t : j;
              const Y = axis === 0 ? j : t;
              const iw = H[6] * X + H[7] * Y + H[8];
              const x = (H[0] * X + H[1] * Y + H[2]) / iw;
              const y = (H[3] * X + H[4] * Y + H[5]) / iw;
              if (x < 0 || y < 0 || x > w - 1 || y > h - 1) continue;
              sum += 255 - lumAt(d, w, h, x, y);
              cnt += 1;
            }
            prof[i] = cnt ? sum / cnt : NaN;
          }
          let mean = 0;
          let n = 0;
          for (let i = 0; i <= STEPS; i += 1) {
            if (!Number.isNaN(prof[i])) {
              mean += prof[i];
              n += 1;
            }
          }
          if (n < STEPS * 0.8) continue;
          mean /= n;
          let bi = -1;
          let bv = 0;
          for (let i = 1; i < STEPS; i += 1) {
            const v = prof[i] - mean;
            if (v > bv) {
              bv = v;
              bi = i;
            }
          }
          if (k < 0 || k > size) {
            margin[axis][k < 0 ? 0 : 1].push(bv);
            continue;
          }
          if (k === 0 || k === size) outer[axis][k === 0 ? 0 : 1].push(bv);
          else inner[axis].push(bv);
          if (bi < 0 || bv < 12) continue; // no clear line here (covered by a piece)
          const y0 = prof[bi - 1];
          const y1 = prof[bi];
          const y2 = prof[bi + 1];
          const den = y0 - 2 * y1 + y2;
          const sub = den < 0 ? (0.5 * (y0 - y2)) / den : 0;
          const at = line - HALF + (bi + sub) / GRID_BINS;
          const mid = (s0 + s1 - 1) / 2;
          obs.push({ axis, P: axis === 0 ? { x: at, y: mid } : { x: mid, y: at }, target: line, wgt: Math.min(bv, 80) });
        }
      }
    }
    const perAxis = [0, 0];
    for (const o of obs) perAxis[o.axis] += 1;
    if (perAxis[0] < size || perAxis[1] < size) return { H, ok: false, rms: null };
    // normalise world coordinates around the board centre
    const c0 = (size - 1) / 2;
    const sc = 2 / size;
    let kept = obs;
    let C = null;
    let rms = null;
    const limits = [0.3, 0.15, 0.1, 0.1]; // outlier limits, tightened as the fit improves
    for (let it = 0; it < limits.length; it += 1) {
      const M = new Float64Array(81);
      const row = new Float64Array(9);
      for (const o of kept) {
        const px = (o.P.x - c0) * sc;
        const py = (o.P.y - c0) * sc;
        const tg = (o.target - c0) * sc;
        row.fill(0);
        const base = o.axis === 0 ? 0 : 3;
        row[base] = px;
        row[base + 1] = py;
        row[base + 2] = 1;
        row[6] = -tg * px;
        row[7] = -tg * py;
        row[8] = -tg;
        for (let a = 0; a < 9; a += 1) {
          if (row[a] === 0) continue;
          for (let b = 0; b < 9; b += 1) M[a * 9 + b] += o.wgt * row[a] * row[b];
        }
      }
      const cn = smallestEigenvector(M, 9);
      // back to world units: C = N^-1 * Cn * N with N(p) = (p - c0) * sc
      const N = [sc, 0, -sc * c0, 0, sc, -sc * c0, 0, 0, 1];
      const Ninv = [1 / sc, 0, c0, 0, 1 / sc, c0, 0, 0, 1];
      C = normalizeH(multiply(Ninv, multiply(cn, N)));
      let e = 0;
      const next = [];
      for (const o of kept) {
        const q = project(C, o.P);
        const r = (o.axis === 0 ? q.x : q.y) - o.target;
        e += r * r;
        if (Math.abs(r) < limits[it]) next.push(o);
      }
      rms = Math.sqrt(e / kept.length);
      if (next.length < 2 * size) break;
      if (next.length === kept.length && it >= 2) break;
      kept = next;
    }
    // the correction must be small: board corners move by less than a cell
    let move = 0;
    for (const p of [{ x: -0.5, y: -0.5 }, { x: size - 0.5, y: -0.5 }, { x: size - 0.5, y: size - 0.5 }, { x: -0.5, y: size - 0.5 }]) {
      const q = project(C, p);
      move = Math.max(move, Math.hypot(q.x - p.x, q.y - p.y));
    }
    const Cinv = invert(C);
    const ok = !!Cinv && rms !== null && rms < 0.06 && move < 1.5;
    // Against the print: true when every side agrees, false when one
    // disagrees, null when a side could not be measured (out of the picture,
    // too little contrast). Medians: a piece may hide a stretch of a line.
    const mid = (list) => (list.length ? list.slice().sort((a, b) => a - b)[list.length >> 1] : NaN);
    let structure = true;
    for (let axis = 0; axis < 2; axis += 1) {
      const typical = mid(inner[axis]);
      for (let side = 0; side < 2; side += 1) {
        const e = mid(outer[axis][side]);
        const m = mid(margin[axis][side]);
        if (!(typical >= GRID_CONTRAST) || Number.isNaN(e) || Number.isNaN(m)) {
          if (structure === true) structure = null;
        } else if (e < GRID_EDGE * typical || m > GRID_MARGIN * typical) {
          structure = false;
        }
      }
    }
    return { H: ok ? normalizeH(multiply(H, Cinv)) : H, ok, rms, structure };
  }

  // ---------------------------------------------------------------------------
  // Measuring the cells

  function quadBasis(out, o, X, Y) {
    out[o] = 1;
    out[o + 1] = X;
    out[o + 2] = Y;
    out[o + 3] = X * X;
    out[o + 4] = X * Y;
    out[o + 5] = Y * Y;
  }

  // Weighted least squares of a quadratic surface (6 coefficients) by Gaussian elimination.
  const NE = new Float64Array(42);
  function solveQuad(m, basis, values, weights, coef) {
    NE.fill(0);
    for (let i = 0; i < m; i += 1) {
      const wgt = weights[i];
      if (!(wgt > 0)) continue;
      const o = i * 6;
      const v = values[i];
      for (let r = 0; r < 6; r += 1) {
        const br = basis[o + r] * wgt;
        for (let c = r; c < 6; c += 1) NE[r * 7 + c] += br * basis[o + c];
        NE[r * 7 + 6] += br * v;
      }
    }
    for (let r = 0; r < 6; r += 1) {
      for (let c = 0; c < r; c += 1) NE[r * 7 + c] = NE[c * 7 + r];
      NE[r * 7 + r] += 1e-6; // tiny ridge keeps a flat fit when data is thin
    }
    for (let col = 0; col < 6; col += 1) {
      let piv = col;
      for (let r = col + 1; r < 6; r += 1) if (Math.abs(NE[r * 7 + col]) > Math.abs(NE[piv * 7 + col])) piv = r;
      if (piv !== col) {
        for (let c = 0; c < 7; c += 1) {
          const t = NE[col * 7 + c];
          NE[col * 7 + c] = NE[piv * 7 + c];
          NE[piv * 7 + c] = t;
        }
      }
      const div = NE[col * 7 + col];
      if (Math.abs(div) < 1e-12) return false;
      for (let r = 0; r < 6; r += 1) {
        if (r === col) continue;
        const f = NE[r * 7 + col] / div;
        if (f === 0) continue;
        for (let c = col; c < 7; c += 1) NE[r * 7 + c] -= f * NE[col * 7 + c];
      }
    }
    for (let r = 0; r < 6; r += 1) coef[r] = NE[r * 7 + 6] / NE[r * 7 + r];
    return true;
  }

  function evalQuad(coef, basis, o) {
    return coef[0] * basis[o] + coef[1] * basis[o + 1] + coef[2] * basis[o + 2] +
      coef[3] * basis[o + 3] + coef[4] * basis[o + 4] + coef[5] * basis[o + 5];
  }

  // Per-board scratch buffers for measureCells (allocated once per board).
  function scratchFor(info, holder) {
    if (holder.scratch && holder.scratch.id === info.id) return holder.scratch;
    const total = info.sampleStart[info.n];
    const maxPts = info.n + 256;
    holder.scratch = {
      id: info.id,
      rgb: new Float32Array(total * 3),
      valid: new Uint8Array(total),
      lums: new Float64Array(64),
      fitBasis: new Float64Array(maxPts * 6),
      fitL: new Float64Array(maxPts),
      fitR: new Float64Array(maxPts),
      fitG: new Float64Array(maxPts),
      fitB: new Float64Array(maxPts),
      fitW: new Float64Array(maxPts),
      fitCell: new Int32Array(maxPts),
      cellR: new Float64Array(info.n),
      cellG: new Float64Array(info.n),
      cellB: new Float64Array(info.n),
      shade: new Float64Array(info.n),
      medL: new Float64Array(info.n),
      spreadL: new Float64Array(info.n),
      shadeMed: new Float64Array(info.n),
      grey: new Uint8Array(info.n),
      queue: new Int32Array(info.n),
      paperLike: new Uint8Array(info.n),
      factor: new Float64Array(info.n),
      vals: new Float64Array(256),
      scores: new Float32Array(info.n),
      cR: null, // the paper's colour surfaces of the last frame (see inkAt)
      cG: null,
      cB: null,
    };
    return holder.scratch;
  }

  function readRGB(d, w, h, x, y, out, o) {
    const x0 = x | 0;
    const y0 = y | 0;
    const fx = x - x0;
    const fy = y - y0;
    const i = (y0 * w + x0) * 4;
    const j = i + w * 4;
    const a = (1 - fx) * (1 - fy);
    const b = fx * (1 - fy);
    const c = (1 - fx) * fy;
    const e = fx * fy;
    out[o] = d[i] * a + d[i + 4] * b + d[j] * c + d[j + 4] * e;
    out[o + 1] = d[i + 1] * a + d[i + 5] * b + d[j + 1] * c + d[j + 5] * e;
    out[o + 2] = d[i + 2] * a + d[i + 6] * b + d[j + 2] * c + d[j + 6] * e;
  }

  /* Score every cell: the share of its samples that do not look like the
   * paper around it. The paper's local colour is a smooth surface fitted to
   * the cells and anchors that look like paper (robust, iterated). Returns
   * the scratch's Float32Array of scores (NaN where too little is visible). */
  function measureCells(img, info, H, anchors, holder) {
    const sc = scratchFor(info, holder);
    const d = img.data;
    const w = img.width;
    const h = img.height;
    const n = info.n;
    const S = info.samples;
    const start = info.sampleStart;
    const total = start[n];
    const xmax = w - 1.001;
    const ymax = h - 1.001;
    const { rgb, valid } = sc;
    for (let i = 0; i < total; i += 1) {
      const X = S[2 * i];
      const Y = S[2 * i + 1];
      const iw = H[6] * X + H[7] * Y + H[8];
      const x = (H[0] * X + H[1] * Y + H[2]) / iw;
      const y = (H[3] * X + H[4] * Y + H[5]) / iw;
      if (!(iw > 0 && x >= 0 && y >= 0 && x <= xmax && y <= ymax)) {
        valid[i] = 0;
        continue;
      }
      valid[i] = 1;
      readRGB(d, w, h, x, y, rgb, i * 3);
    }

    // Paper candidates: each cell's brighter half, then the anchors.
    const { fitBasis, fitL, fitR, fitG, fitB, fitW, fitCell, lums, cellR, cellG, cellB } = sc;
    let m = 0;
    for (let c = 0; c < n; c += 1) {
      cellR[c] = NaN;
      sc.medL[c] = NaN;
      let cnt = 0;
      for (let i = start[c]; i < start[c + 1]; i += 1) {
        if (!valid[i]) continue;
        lums[cnt] = 0.299 * rgb[i * 3] + 0.587 * rgb[i * 3 + 1] + 0.114 * rgb[i * 3 + 2];
        cnt += 1;
      }
      if (cnt < (start[c + 1] - start[c]) * TUNING.minValidShare) continue;
      const med = median(lums, cnt);
      sc.medL[c] = med;
      sc.spreadL[c] = lums[Math.floor(0.8 * (cnt - 1))] - lums[Math.floor(0.2 * (cnt - 1))];
      let r = 0;
      let g = 0;
      let b = 0;
      let k = 0;
      for (let i = start[c]; i < start[c + 1]; i += 1) {
        if (!valid[i]) continue;
        const l = 0.299 * rgb[i * 3] + 0.587 * rgb[i * 3 + 1] + 0.114 * rgb[i * 3 + 2];
        if (l < med - 1e-9) continue;
        r += rgb[i * 3];
        g += rgb[i * 3 + 1];
        b += rgb[i * 3 + 2];
        k += 1;
      }
      for (let q = 0; q < 6; q += 1) fitBasis[m * 6 + q] = info.basis[c * 6 + q];
      fitR[m] = r / k;
      fitG[m] = g / k;
      fitB[m] = b / k;
      fitL[m] = 0.299 * fitR[m] + 0.587 * fitG[m] + 0.114 * fitB[m];
      fitCell[m] = c;
      cellR[c] = fitR[m];
      cellG[c] = fitG[m];
      cellB[c] = fitB[m];
      m += 1;
    }
    const norm = info.norm;
    const tmp = [0, 0, 0];
    for (const p of anchors) {
      if (m >= fitW.length) break;
      const q = project(H, p);
      if (!(q.x >= 0 && q.y >= 0 && q.x <= xmax && q.y <= ymax)) continue;
      readRGB(d, w, h, q.x, q.y, tmp, 0);
      quadBasis(fitBasis, m * 6, (p.x - norm.cx) / norm.sx, (p.y - norm.cy) / norm.sy);
      fitR[m] = tmp[0];
      fitG[m] = tmp[1];
      fitB[m] = tmp[2];
      fitL[m] = 0.299 * tmp[0] + 0.587 * tmp[1] + 0.114 * tmp[2];
      fitCell[m] = -1;
      m += 1;
    }
    const scores = sc.scores;
    if (m < 3) {
      scores.fill(NaN);
      sc.cR = sc.cG = sc.cB = null;
      return scores;
    }

    // Robust fit of the paper's brightness: cells darker than the surface
    // (pieces) and much brighter (glare) lose their weight.
    const cL = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < m; i += 1) fitW[i] = 1;
    let ok = true;
    for (let it = 0; it < 5 && ok; it += 1) {
      ok = solveQuad(m, fitBasis, fitL, fitW, cL);
      if (!ok) break;
      for (let i = 0; i < m; i += 1) {
        const f = Math.max(1, evalQuad(cL, fitBasis, i * 6));
        const r = fitL[i] / f - 1;
        fitW[i] = r < -0.12 ? 0 : r < -0.05 ? (r + 0.12) / 0.07 : r > 0.15 ? 0.25 : 1;
      }
    }
    let wsum = 0;
    for (let i = 0; i < m; i += 1) wsum += fitW[i];
    const cR = [0, 0, 0, 0, 0, 0];
    const cG = [0, 0, 0, 0, 0, 0];
    const cB = [0, 0, 0, 0, 0, 0];
    if (!ok || wsum < 6 || !solveQuad(m, fitBasis, fitR, fitW, cR) ||
        !solveQuad(m, fitBasis, fitG, fitW, cG) || !solveQuad(m, fitBasis, fitB, fitW, cB)) {
      // Too little paper to fit a surface: use the brightest cells' colour everywhere.
      const order = Array.from({ length: m }, (_, i) => i).sort((a, b) => fitL[b] - fitL[a]);
      const top = order.slice(0, Math.max(1, Math.round(m * 0.3)));
      const avg = (arr) => top.reduce((s, i) => s + arr[i], 0) / top.length;
      cR.fill(0);
      cG.fill(0);
      cB.fill(0);
      cR[0] = avg(fitR);
      cG[0] = avg(fitG);
      cB[0] = avg(fitB);
    }

    // Local shading: a soft shadow is narrower than the smooth surface can
    // follow. Around each cell, the paper-like cells (colourless, not black)
    // say how much darker the paper is there than the surface says.
    // Grey pieces (a kit printed in black and white) are colourless too, but
    // meet white paper with a sharp step, where a shadow fades in: dark
    // colourless cells next to bright paper, and the same grey joined to
    // them, are left out.
    const { shade, shadeMed, medL, spreadL, grey, queue, paperLike, factor, vals } = sc;
    for (let c = 0; c < n; c += 1) {
      paperLike[c] = 0;
      grey[c] = 0;
      if (Number.isNaN(cellR[c])) continue;
      const o = c * 6;
      const wr = Math.max(8, evalQuad(cR, info.basis, o));
      const wg = Math.max(8, evalQuad(cG, info.basis, o));
      const wb = Math.max(8, evalQuad(cB, info.basis, o));
      const nr = cellR[c] / wr;
      const ng = cellG[c] / wg;
      const nb = cellB[c] / wb;
      const hi = Math.max(nr, ng, nb);
      const lo = Math.min(nr, ng, nb);
      shade[c] = 0.299 * nr + 0.587 * ng + 0.114 * nb;
      const wl = 0.299 * wr + 0.587 * wg + 0.114 * wb;
      shadeMed[c] = medL[c] / wl;
      spreadL[c] /= wl;
      if (hi - lo < TUNING.paperChroma && shade[c] > 0.3) paperLike[c] = 1;
    }
    const adj = info.adj;
    const adjStart = info.adjStart;
    let qn = 0;
    // (a shadow edge running through a cell leaves that cell uneven; a step
    // counts as sharp only between two even cells)
    for (let c = 0; c < n; c += 1) {
      if (!paperLike[c] || shadeMed[c] >= 0.72 || spreadL[c] > 0.1) continue;
      for (let k = adjStart[c]; k < adjStart[c + 1]; k += 1) {
        const j = adj[k];
        if (paperLike[j] && spreadL[j] <= 0.1 && shadeMed[j] >= 0.85 && shadeMed[j] - shadeMed[c] >= 0.25) {
          grey[c] = 1;
          queue[qn] = c;
          qn += 1;
          break;
        }
      }
    }
    for (let qi = 0; qi < qn; qi += 1) {
      const c = queue[qi];
      for (let k = adjStart[c]; k < adjStart[c + 1]; k += 1) {
        const j = adj[k];
        if (grey[j] || !paperLike[j] || shadeMed[j] >= 0.72 || Math.abs(shadeMed[j] - shadeMed[c]) > 0.08) continue;
        grey[j] = 1;
        queue[qn] = j;
        qn += 1;
      }
    }
    // All the pieces together cover only so many cells: a larger grey patch
    // is a shadow after all.
    if (qn > info.pieceArea) {
      for (let c0 = 0; c0 < n; c0 += 1) {
        if (grey[c0] !== 1) continue;
        let head = 0;
        let tail = 0;
        queue[tail++] = c0;
        grey[c0] = 2;
        while (head < tail) {
          const c = queue[head++];
          for (let k = adjStart[c]; k < adjStart[c + 1]; k += 1) {
            const j = adj[k];
            if (grey[j] !== 1) continue;
            grey[j] = 2;
            queue[tail++] = j;
          }
        }
        const keep = tail <= info.pieceArea ? 3 : 0;
        for (let i = 0; i < tail; i += 1) grey[queue[i]] = keep;
      }
    }
    const near = info.near;
    const nearStart = info.nearStart;
    for (let c = 0; c < n; c += 1) {
      let cnt = 0;
      for (let k = nearStart[c]; k < nearStart[c + 1] && cnt < vals.length; k += 1) {
        const j = near[k];
        if (paperLike[j] && !grey[j]) {
          vals[cnt] = shade[j];
          cnt += 1;
        }
      }
      if (cnt < 4) {
        factor[c] = 1;
        continue;
      }
      median(vals, cnt); // sorts the first cnt values
      const f = vals[Math.floor(TUNING.shadeRank * (cnt - 1))];
      factor[c] = f < 0.5 ? 0.5 : f > 1.05 ? 1.05 : f;
    }

    // (inkOf's rule, written out: this loop runs for every sample of every frame)
    const { chromaLow, chromaHigh, darkLow, darkHigh, minValidShare, bareDark, fullDark } = TUNING;
    const bareChromaLow = info.classic ? chromaLow : TUNING.bareChromaLow;
    const bareChromaHigh = info.classic ? chromaHigh : TUNING.bareChromaHigh;
    for (let c = 0; c < n; c += 1) {
      const o = c * 6;
      const wr = Math.max(8, evalQuad(cR, info.basis, o) * factor[c]);
      const wg = Math.max(8, evalQuad(cG, info.basis, o) * factor[c]);
      const wb = Math.max(8, evalQuad(cB, info.basis, o) * factor[c]);
      let sum = 0;
      let cnt = 0;
      for (let i = start[c]; i < start[c + 1]; i += 1) {
        if (!valid[i]) continue;
        const nr = rgb[i * 3] / wr;
        const ng = rgb[i * 3 + 1] / wg;
        const nb = rgb[i * 3 + 2] / wb;
        const dark = 1 - (0.299 * nr + 0.587 * ng + 0.114 * nb);
        const hi = nr > ng ? (nr > nb ? nr : nb) : ng > nb ? ng : nb;
        const lo = nr < ng ? (nr < nb ? nr : nb) : ng < nb ? ng : nb;
        const shaded = dark <= bareDark ? 0 : dark >= fullDark ? 1 : (dark - bareDark) / (fullDark - bareDark);
        const cLow = bareChromaLow + (chromaLow - bareChromaLow) * shaded;
        const cHigh = bareChromaHigh + (chromaHigh - bareChromaHigh) * shaded;
        let ink = (hi - lo - cLow) / (cHigh - cLow);
        const byDark = (dark - darkLow) / (darkHigh - darkLow);
        if (byDark > ink) ink = byDark;
        sum += ink < 0 ? 0 : ink > 1 ? 1 : ink;
        cnt += 1;
      }
      scores[c] = cnt >= (start[c + 1] - start[c]) * minValidShare ? sum / cnt : NaN;
    }
    sc.cR = cR;
    sc.cG = cG;
    sc.cB = cB;
    return scores;
  }

  /* How much one sample looks like a piece, from 0 (paper) to 1, given its
   * colour divided by the colour of the paper around it: the rule of
   * measureCells (which writes it out in its loop), for single samples. */
  function inkOf(nr, ng, nb, classic) {
    const dark = 1 - (0.299 * nr + 0.587 * ng + 0.114 * nb);
    const hi = nr > ng ? (nr > nb ? nr : nb) : ng > nb ? ng : nb;
    const lo = nr < ng ? (nr < nb ? nr : nb) : ng < nb ? ng : nb;
    // (the classic kit's tiles carry printed pictures with pale parts: there,
    // faint colour keeps counting as it did)
    const bareLow = classic ? INK_CHROMA_LOW : INK_BARE_LOW;
    const bareHigh = classic ? INK_CHROMA_HIGH : INK_BARE_HIGH;
    const shaded = dark <= INK_BARE_DARK ? 0 : dark >= INK_FULL_DARK ? 1 : (dark - INK_BARE_DARK) / (INK_FULL_DARK - INK_BARE_DARK);
    const cLow = bareLow + (INK_CHROMA_LOW - bareLow) * shaded;
    const cHigh = bareHigh + (INK_CHROMA_HIGH - bareHigh) * shaded;
    let ink = (hi - lo - cLow) / (cHigh - cLow);
    const byDark = (dark - INK_DARK_LOW) / (INK_DARK_HIGH - INK_DARK_LOW);
    if (byDark > ink) ink = byDark;
    return ink < 0 ? 0 : ink > 1 ? 1 : ink;
  }
  const INK_CHROMA_LOW = TUNING.chromaLow;
  const INK_CHROMA_HIGH = TUNING.chromaHigh;
  const INK_BARE_LOW = TUNING.bareChromaLow;
  const INK_BARE_HIGH = TUNING.bareChromaHigh;
  const INK_DARK_LOW = TUNING.darkLow;
  const INK_DARK_HIGH = TUNING.darkHigh;
  const INK_BARE_DARK = TUNING.bareDark;
  const INK_FULL_DARK = TUNING.fullDark;

  /* One more sample, anywhere on the board's plane (world X, Y): the same
   * reading as a cell's samples, against the paper found by the last
   * measureCells on this scratch, with the local shading of cell c. NaN
   * outside the image. */
  const INK_RGB = [0, 0, 0];
  const INK_BASIS = new Float64Array(6);
  const INK_NORM = [0, 0, 0]; // that sample's colour divided by the paper's
  function inkAt(img, info, sc, H, X, Y, c) {
    if (!sc.cR) return NaN;
    const iw = H[6] * X + H[7] * Y + H[8];
    const x = (H[0] * X + H[1] * Y + H[2]) / iw;
    const y = (H[3] * X + H[4] * Y + H[5]) / iw;
    if (!(iw > 0 && x >= 0 && y >= 0 && x <= img.width - 1.001 && y <= img.height - 1.001)) return NaN;
    readRGB(img.data, img.width, img.height, x, y, INK_RGB, 0);
    const norm = info.norm;
    quadBasis(INK_BASIS, 0, (X - norm.cx) / norm.sx, (Y - norm.cy) / norm.sy);
    const f = sc.factor[c];
    const wr = Math.max(8, evalQuad(sc.cR, INK_BASIS, 0) * f);
    const wg = Math.max(8, evalQuad(sc.cG, INK_BASIS, 0) * f);
    const wb = Math.max(8, evalQuad(sc.cB, INK_BASIS, 0) * f);
    INK_NORM[0] = INK_RGB[0] / wr;
    INK_NORM[1] = INK_RGB[1] / wg;
    INK_NORM[2] = INK_RGB[2] / wb;
    return inkOf(INK_NORM[0], INK_NORM[1], INK_NORM[2], info.classic);
  }

  function median(arr, n) {
    // insertion sort of a short prefix
    for (let i = 1; i < n; i += 1) {
      const v = arr[i];
      let j = i - 1;
      while (j >= 0 && arr[j] > v) {
        arr[j + 1] = arr[j];
        j -= 1;
      }
      arr[j + 1] = v;
    }
    return n % 2 ? arr[(n - 1) >> 1] : 0.5 * (arr[n / 2 - 1] + arr[n / 2]);
  }

  // ---------------------------------------------------------------------------
  // Pieces from covered cells

  // The variants of a piece shape (lattice.buildVariants), made once.
  const variantCache = new WeakMap(); // lattice -> Map(shape -> variants)
  function variantsOf(lattice, type) {
    let byShape = variantCache.get(lattice);
    if (!byShape) variantCache.set(lattice, (byShape = new Map()));
    const shape = type.cells.map((c) => lattice.cellKey(c)).join("|");
    let variants = byShape.get(shape);
    if (!variants) {
      variants = lattice.buildVariants(type.cells.map((c) => Object.assign({}, c))).variants;
      byShape.set(shape, variants);
    }
    return { shape, variants };
  }

  /* Per board, kept between searches: cell indices, side neighbours, and for
   * each piece shape where each of its variants lands from each anchor cell
   * (filled in anchor by anchor, the first time a search needs it). */
  const landingCache = new WeakMap(); // board -> { index, adj, byShape }
  function boardLandings(board, lattice) {
    let bl = landingCache.get(board);
    if (!bl) {
      const index = new Map(board.cells.map((c, i) => [c.key, i]));
      const adj = board.cells.map((c) => {
        const out = [];
        for (const nb of lattice.cellNeighbors(c)) {
          const j = index.get(lattice.cellKey(nb));
          if (j !== undefined) out.push(j);
        }
        return out;
      });
      bl = { index, adj, byShape: new Map() };
      landingCache.set(board, bl);
    }
    return bl;
  }

  function landingsOf(bl, board, shape, variants) {
    let table = bl.byShape.get(shape);
    if (!table) {
      const n = board.cells.length;
      const V = variants.length;
      const size = variants[0].cells.length;
      table = {
        V,
        size,
        done: new Uint8Array(n),
        fits: new Uint8Array(n * V),
        cells: n < 32768 ? new Int16Array(n * V * size) : new Int32Array(n * V * size),
      };
      bl.byShape.set(shape, table);
    }
    return table;
  }

  function fillLandings(table, a, board, lattice, variants, index) {
    const entry = board.cells[a];
    const { V, size } = table;
    for (let vi = 0; vi < V; vi += 1) {
      const variant = variants[vi];
      let ok = lattice.markerConstraint(variant, entry);
      const o = (a * V + vi) * size;
      for (let k = 0; ok && k < size; k += 1) {
        const b = index.get(lattice.cellKey(lattice.translateCell(variant.cells[k], entry)));
        if (b === undefined) ok = false;
        else table.cells[o + k] = b;
      }
      table.fits[a * V + vi] = ok ? 1 : 0;
    }
    table.done[a] = 1;
  }

  /* reconstruct(geometry, occupied, pieceTypes, { maxEachType }) -> placements
   * [{ typeId, variantIndex, marker, cells }] in the piece engine's format
   * (variant indices from lattice.buildVariants, marker = the placed copy of
   * the variant's anchor cell) covering exactly the occupied cells, each type
   * used at most maxEachType times; null when no such cover exists, or when
   * none is found within the search budget (`budget` search steps, and
   * `timeLimit` milliseconds, or until the clock reaches `deadline`; the
   * clock is watched from the start, preparation included).
   * Option `optional`: cells that may be covered but need not be. Only those
   * a piece touching an occupied cell can reach are used, nearest first, and
   * at most `optionalShare` times the area of all the pieces (the clearest
   * first when there are more). A cover that uses none of them is looked
   * for first (unless `exactFirst` is false); otherwise, among the covers
   * found in time, the one that needs the fewest and clearest of them wins
   * (`score(key)`, a cell's reading in [0, 1], says how covered a cell
   * looks). */
  function reconstruct(geometry, occupied, pieceTypes, options) {
    const opts = options || {};
    const maxEach = opts.maxEachType == null ? 1 : opts.maxEachType;
    const budget = opts.budget || 200000;
    const deadline = opts.deadline != null ? opts.deadline : clock() + (opts.timeLimit == null ? TUNING.searchMs : opts.timeLimit);
    const lattice = geometry.lattice;
    const board = geometry.board;
    const required = [...new Set(occupied)];
    for (const k of required) if (!board.map.has(k)) return null;
    if (required.length === 0) return [];
    // More covered cells than all the pieces can cover: no need to search.
    const capacity = pieceTypes.reduce((sum, t) => sum + maxEach * t.cells.length, 0);
    if (required.length > capacity) return null;
    const bl = boardLandings(board, lattice);
    const bIndex = bl.index;
    // The usable cells, as board indices: the occupied ones, then optional
    // ones outward from them.
    const usable = required.map((k) => bIndex.get(k));
    if (opts.optional) {
      const optional = new Set();
      const isReq = new Set(usable);
      for (const k of opts.optional) {
        const b = bIndex.get(k);
        if (b !== undefined && !isReq.has(b)) optional.add(b);
      }
      const reach = Math.max(0, ...pieceTypes.map((t) => t.cells.length - 1));
      const cap = TUNING.optionalShare * capacity;
      let added = 0;
      let front = usable.slice();
      for (let step = 0; step < reach && front.length && optional.size && added < cap; step += 1) {
        if (clock() > deadline) return null;
        let next = [];
        for (const b of front) {
          for (const nb of bl.adj[b]) {
            if (!optional.has(nb)) continue;
            optional.delete(nb);
            next.push(nb);
          }
        }
        if (added + next.length > cap) {
          if (opts.score) {
            const s = new Map(next.map((b) => [b, opts.score(board.cells[b].key)]));
            next.sort((x, y) => s.get(y) - s.get(x));
          }
          next = next.slice(0, cap - added);
        }
        for (const b of next) usable.push(b);
        added += next.length;
        front = next;
      }
    }
    const nK = usable.length;
    const keys = usable.map((b) => board.cells[b].key);
    const kIdx = new Int32Array(board.cells.length).fill(-1); // board index -> usable index
    usable.forEach((b, j) => (kIdx[b] = j));
    const isRequired = new Uint8Array(nK);
    isRequired.fill(1, 0, required.length);
    // Cost of covering a cell that need not be covered: how empty it looks.
    const cellCost = new Float64Array(nK);
    keys.forEach((k, j) => {
      if (isRequired[j]) return;
      const s = opts.score ? opts.score(k) : 0;
      cellCost[j] = 1 - (s > 0 ? (s < 1 ? s : 1) : 0);
    });

    const types = [];
    const cands = [];
    const byCell = keys.map(() => []);
    let steps = 0;
    for (let t = 0; t < pieceTypes.length; t += 1) {
      const type = pieceTypes[t];
      const { shape, variants } = variantsOf(lattice, type);
      types.push({ id: type.id, name: type.name, variants });
      const table = landingsOf(bl, board, shape, variants);
      const { V, size } = table;
      for (let vi = 0; vi < V; vi += 1) {
        for (let j0 = 0; j0 < nK; j0 += 1) {
          if ((++steps & 63) === 0 && clock() > deadline) return null;
          const a = usable[j0];
          if (!table.done[a]) fillLandings(table, a, board, lattice, variants, bIndex);
          if (!table.fits[a * V + vi]) continue;
          const o = (a * V + vi) * size;
          const cells = [];
          let fits = true;
          let needed = false;
          let cost = 0;
          for (let k = 0; k < size; k += 1) {
            const j = kIdx[table.cells[o + k]];
            if (j < 0) {
              fits = false;
              break;
            }
            if (isRequired[j]) needed = true;
            cost += cellCost[j];
            cells.push(j);
          }
          if (!fits || !needed) continue;
          const ci = cands.length;
          cands.push({ t, vi, marker: lattice.bareCell(board.cells[a]), cells, cost });
          for (const j of cells) byCell[j].push(ci);
        }
      }
    }
    // Try the placements that need the fewest doubtful cells first.
    const hasCost = cands.some((c) => c.cost > 0);
    if (hasCost) {
      const costOf = Float64Array.from(cands, (c) => c.cost);
      for (const list of byCell) if (list.length > 1) list.sort((a, b) => costOf[a] - costOf[b]);
    }

    // Cells next to each other among the usable ones, for the region test.
    const nbStart = new Int32Array(nK + 1);
    const nbList = [];
    for (let j = 0; j < nK; j += 1) {
      nbStart[j] = nbList.length;
      for (const b of bl.adj[usable[j]]) {
        const i = kIdx[b];
        if (i >= 0) nbList.push(i);
      }
    }
    nbStart[nK] = nbList.length;
    const sizes = types.map((t) => t.variants[0].cells.length);
    const kMin = Math.min(...sizes);
    const kMax = Math.max(...sizes);
    const oneSize = kMin === kMax;

    // Exact cover, most constrained cell first; once a cover is found, only
    // cheaper ones are looked for.
    const covered = new Uint8Array(keys.length);
    const used = new Int32Array(types.length);
    const seen = new Int32Array(keys.length);
    const queue = new Int32Array(keys.length);
    let stamp = 0;
    let piecesLeft = maxEach * types.length;
    const chosen = [];
    let cover = null;
    let coverCost = Infinity;
    let nodes = 0;
    let stopped = false;
    let stopAt = deadline;
    const viable = (ci) => {
      const c = cands[ci];
      if (used[c.t] >= maxEach) return false;
      for (const j of c.cells) if (covered[j]) return false;
      return true;
    };
    // Each group of free cells holding a required cell must still fit whole
    // pieces, and all the groups together must not need more pieces than
    // are left.
    const regionsOk = () => {
      stamp += 1;
      let need = 0;
      for (let j0 = 0; j0 < keys.length; j0 += 1) {
        if (!isRequired[j0] || covered[j0] || seen[j0] === stamp) continue;
        let head = 0;
        let tail = 0;
        let u = 0;
        let r = 0;
        queue[tail++] = j0;
        seen[j0] = stamp;
        while (head < tail) {
          const j = queue[head++];
          u += 1;
          if (isRequired[j]) r += 1;
          for (let q = nbStart[j]; q < nbStart[j + 1]; q += 1) {
            const i = nbList[q];
            if (covered[i] || seen[i] === stamp) continue;
            seen[i] = stamp;
            queue[tail++] = i;
          }
        }
        if (u < kMin || (oneSize && u === r && r % kMin !== 0)) return false;
        need += Math.ceil(r / kMax);
        if (need > piecesLeft) return false;
      }
      return true;
    };
    const solve = (cost) => {
      nodes += 1;
      // (the clock is read at every step: on a big board one step can take a
      // millisecond)
      if (nodes > budget || clock() > stopAt) {
        stopped = true;
        return;
      }
      if (!regionsOk()) return;
      let bestList = null;
      let bestCount = Infinity;
      for (let j = 0; j < keys.length; j += 1) {
        if (!isRequired[j] || covered[j]) continue;
        const list = [];
        for (const ci of byCell[j]) {
          if (viable(ci) && cost + cands[ci].cost < coverCost) {
            list.push(ci);
            if (list.length >= bestCount) break;
          }
        }
        if (list.length === 0) return;
        if (list.length < bestCount) {
          bestCount = list.length;
          bestList = list;
          if (bestCount === 1) break;
        }
      }
      if (!bestList) {
        if (!cover) {
          // A first cover: look a little longer for a cheaper one.
          const now = clock();
          stopAt = Math.min(deadline, now + 2 * (now - phaseStart) + 2);
        }
        cover = chosen.slice();
        coverCost = Math.min(coverCost, cost);
        return;
      }
      for (const ci of bestList) {
        const c = cands[ci];
        if (cost + c.cost >= coverCost) continue;
        used[c.t] += 1;
        piecesLeft -= 1;
        for (const j of c.cells) covered[j] = 1;
        chosen.push(ci);
        solve(cost + c.cost);
        chosen.pop();
        for (const j of c.cells) covered[j] = 0;
        piecesLeft += 1;
        used[c.t] -= 1;
        if (stopped || coverCost <= 0) return;
      }
    };
    // First a cover that needs no optional cell at all (with part of the
    // time), then any cover.
    let phaseStart = clock();
    if (opts.exactFirst !== false || !hasCost) {
      coverCost = 1e-9;
      stopAt = hasCost ? phaseStart + 0.4 * (deadline - phaseStart) : deadline;
      solve(0);
    }
    if (!cover && hasCost && clock() < deadline) {
      coverCost = Infinity;
      stopped = false;
      phaseStart = clock();
      stopAt = deadline;
      solve(0);
    }
    if (!cover) return null;
    return cover.map((ci) => {
      const c = cands[ci];
      const out = {
        typeId: types[c.t].id,
        variantIndex: c.vi,
        marker: c.marker,
        cells: c.cells.map((j) => keys[j]),
      };
      if (types[c.t].name) out.name = types[c.t].name;
      return out;
    });
  }

  // The engine placement of a known set of absolute cells, if it is one of the types.
  function placementForCells(geometry, pieceTypes, cells, exclude, deadline) {
    const set = new Set(cells);
    for (const type of pieceTypes) {
      if (exclude && exclude.has(type.id)) continue;
      if (type.cells.length !== cells.length) continue;
      const found = reconstruct(geometry, set, [type], { maxEachType: 1, budget: 2000, deadline });
      if (found && found.length === 1) return found[0];
    }
    return null;
  }

  // Pentomino letters by shape, from the classic tile table (fronts 20-31).
  let letterByShape = null;
  function shapeKey(cells) {
    let best = null;
    for (let f = 0; f < 2; f += 1) {
      for (let r = 0; r < 4; r += 1) {
        const pts = cells.map(([x, y]) => {
          let px = f ? -x : x;
          let py = y;
          for (let i = 0; i < r; i += 1) {
            const t = px;
            px = -py;
            py = t;
          }
          return [px, py];
        });
        const mx = Math.min(...pts.map((p) => p[0]));
        const my = Math.min(...pts.map((p) => p[1]));
        const key = pts
          .map((p) => (p[0] - mx) + ":" + (p[1] - my))
          .sort()
          .join("|");
        if (best === null || key < best) best = key;
      }
    }
    return best;
  }
  function letterFor(cellKeys) {
    if (!letterByShape) {
      letterByShape = new Map();
      const FB = dep("FenceBoards");
      for (let id = 20; id <= 31; id += 1) letterByShape.set(shapeKey(TILE_CELLS[id]), FB.lookupMarker(id).piece);
    }
    if (cellKeys.length !== 5) return null;
    return letterByShape.get(shapeKey(cellKeys.map((k) => k.split(",").map(Number)))) || null;
  }

  /* Whole pieces for a set of covered cells. Tiles that were read come
   * first; the other covered cells must then be covered exactly by the
   * board's other pieces, each used once. In order of preference:
   *   1. the covered cells as they are;
   *   2. without the weak cells that touch a clearly covered one (colour or
   *      shadow spilling over from the piece next to them), in small groups
   *      only, so a pale piece is never dropped whole; some of them may stay;
   *   3. with borderline cells (`maybe`) added, so a pale corner of a piece
   *      is not lost;
   *   4. both.
   * Within a step, the cover needing the fewest and clearest extra cells
   * wins, and every piece placed must lie mostly on cells that look covered
   * (printed boards; the classic kit skips step 2 and this rule).
   * No cell is ever added that does not look at least borderline. `score(key)`
   * is a cell's reading in [0, 1]; all the searches share `timeLimit`
   * milliseconds. Returns { occupied, pieces, complete }; without a cover,
   * `occupied` holds the covered cells as they were read. */
  function wholePieces(info, onSet, maybe, tiles, score, timeLimit) {
    const deadline = clock() + timeLimit;
    const types = pieceTypesFor(info);
    const placed = [];
    const usedTypes = new Set();
    const taken = new Set();
    for (const t of tiles) {
      if (t.cells.some((k) => taken.has(k))) continue;
      const p = placementForCells(info.geometry, types, t.cells, usedTypes, deadline);
      if (!p) continue;
      p.tile = t.id;
      placed.push(p);
      usedTypes.add(p.typeId);
      for (const k of t.cells) taken.add(k);
    }
    const free = types.filter((t) => !usedTypes.has(t.id));
    const rest = new Set([...onSet].filter((k) => !taken.has(k)));
    const extra = [...maybe].filter((k) => !taken.has(k) && !onSet.has(k));
    // (the classic kit's tiles carry pictures with pale parts and are read by
    // their marks: there, no covered cell is left out, and a piece placed
    // needs no minimum reading)
    const printed = !info.classic;
    const soft = printed ? spilledCells(info, rest, taken, score, Math.min(...free.map((t) => t.cells.length))) : new Set();
    const hard = soft.size ? new Set([...rest].filter((k) => !soft.has(k))) : rest;
    const attempts = [[rest, [], true]];
    if (soft.size) attempts.push([hard, [...soft], true]);
    if (extra.length) attempts.push([rest, extra, false]);
    if (soft.size && extra.length) attempts.push([hard, [...soft].concat(extra), false]);
    let others = null;
    for (let i = 0; i < attempts.length; i += 1) {
      const [required, optional, exactFirst] = attempts[i];
      const now = clock();
      if (now > deadline) break;
      // the first step (the usual one) may take half the time; the others
      // share what is left
      const until = now + (deadline - now) * (i === 0 && attempts.length > 1 ? 0.5 : 1 / (attempts.length - i));
      const found = reconstruct(info.geometry, required, free, { maxEachType: 1, optional, score, deadline: until, exactFirst });
      if (found && (!printed || found.every((p) => p.cells.reduce((sum, k) => sum + score(k), 0) >= TUNING.pieceSupport * p.cells.length))) {
        others = found;
        break;
      }
    }
    const complete = others !== null;
    const pieces = complete || placed.length ? placed.concat(others || []) : null;
    namePieces(info, pieces);
    const occupied = new Set(taken);
    if (others) {
      for (const p of others) for (const k of p.cells) occupied.add(k);
    } else {
      for (const k of onSet) occupied.add(k);
    }
    return { occupied, pieces, complete };
  }

  /* Weak covered cells that touch a clearly covered cell (or a tile), in
   * groups (cells sharing a side) smaller than the smallest piece: what a
   * piece spills onto its neighbours, never a whole piece. */
  function spilledCells(info, rest, taken, score, smallest) {
    const { index, touch, touchStart, adj, adjStart, keys } = info;
    const weak = new Set();
    for (const k of rest) {
      if (score(k) >= TUNING.cellStrong) continue;
      const c = index.get(k);
      for (let t = touchStart[c]; t < touchStart[c + 1]; t += 1) {
        const nk = keys[touch[t]];
        if (taken.has(nk) || (rest.has(nk) && score(nk) >= TUNING.cellStrong)) {
          weak.add(k);
          break;
        }
      }
    }
    const soft = new Set();
    const done = new Set();
    for (const k0 of weak) {
      if (done.has(k0)) continue;
      const group = [k0];
      done.add(k0);
      for (let g = 0; g < group.length; g += 1) {
        const c = index.get(group[g]);
        for (let a = adjStart[c]; a < adjStart[c + 1]; a += 1) {
          const nk = keys[adj[a]];
          if (!weak.has(nk) || done.has(nk)) continue;
          done.add(nk);
          group.push(nk);
        }
      }
      if (group.length < smallest) for (const k of group) soft.add(k);
    }
    return soft;
  }

  function namePieces(info, placements) {
    if (!placements) return placements;
    const square5 = info.lattice.name === "square" && pieceTypesFor(info).every((t) => t.cells.length === 5);
    for (const p of placements) {
      if (square5) {
        const letter = letterFor(p.cells);
        if (letter) p.name = letter;
      }
    }
    return placements;
  }

  // ---------------------------------------------------------------------------
  // Does a new piece look like a cut piece of the kit?

  /* Edges of each cell that no other cell of the board shares (its rim
   * edges), with their outward normals; an empty list for inner cells. */
  function rimEdges(info) {
    if (info.rims) return info.rims;
    info.rims = info.board.cells.map((cell, i) => {
      const v = cell.vertices;
      const c = cell.centroid;
      const out = [];
      for (let k = 0; k < v.length; k += 1) {
        const a = v[k];
        const b = v[(k + 1) % v.length];
        const onA = info.byVertex.get(vertexKey(a));
        const onB = info.byVertex.get(vertexKey(b));
        if (onA.some((j) => j !== i && onB.includes(j))) continue;
        let nx = b.y - a.y;
        let ny = a.x - b.x;
        const len = Math.hypot(nx, ny) || 1;
        nx /= len;
        ny /= len;
        if (((a.x + b.x) / 2 - c.x) * nx + ((a.y + b.y) / 2 - c.y) * ny < 0) {
          nx = -nx;
          ny = -ny;
        }
        out.push({ a, b, nx, ny });
      }
      return out;
    });
    return info.rims;
  }

  /* A cut piece lies on its own cells and nowhere else. So, in this frame:
   *   - where its outline turns inward (a corner where the piece takes more
   *     than half the turn), the cells in that notch that no other piece
   *     covers do not show the piece's colour near the corner;
   *   - beyond its edges on the board's rim, the margin does not show the
   *     piece's colour.
   * A round thing such as a fingertip cannot cover a piece's cells without
   * spilling into its notches, and a finger, a hand or a pen reaching in
   * from outside the board runs on over the margin. Something else next to
   * a piece (a shadow, a hand beside it, another piece) has another colour
   * and does not count. `cells` are the piece's board indices, `covered`
   * those of every covered cell (other pieces may fill the notches). */
  function looksLikePiece(img, info, sc, H, cells, covered) {
    const board = info.board.cells;
    const depths = NOTCH_DEPTHS[info.lattice.name] || NOTCH_DEPTHS.square;
    const ref = pieceColour(info, sc, cells);
    const mine = new Set(cells);
    const done = new Set();
    // the piece's colour at a world point near it
    const spills = (X, Y, c) => {
      if (!(inkAt(img, info, sc, H, X, Y, c) > TUNING.paperInk)) return false;
      if (!ref) return true;
      const d = Math.max(Math.abs(INK_NORM[0] - ref[0]), Math.abs(INK_NORM[1] - ref[1]), Math.abs(INK_NORM[2] - ref[2]));
      return d <= TUNING.sameColour;
    };
    for (const c of cells) {
      const cell = board[c];
      const nv = cell.vertices.length;
      for (const v of cell.vertices) {
        const vk = vertexKey(v);
        if (done.has(vk)) continue;
        done.add(vk);
        const around = info.byVertex.get(vk);
        let count = 0;
        for (const j of around) if (mine.has(j)) count += 1;
        // the piece's angle at v (count * (nv - 2) / nv half turns) is at most half a turn
        if (count * (nv - 2) <= nv) continue;
        for (const j of around) {
          if (mine.has(j) || covered.has(j)) continue;
          const o = board[j].centroid;
          for (const q of depths) if (spills(v.x + (o.x - v.x) * q, v.y + (o.y - v.y) * q, j)) return false;
        }
      }
      for (const e of rimEdges(info)[c]) {
        for (const t of RIM_STEPS) {
          if (spills(e.a.x + (e.b.x - e.a.x) * t + e.nx * TUNING.rimOut, e.a.y + (e.b.y - e.a.y) * t + e.ny * TUNING.rimOut, c)) return false;
        }
      }
    }
    return true;
  }
  // how far into a notch cell its samples go, as a share of the way from the
  // corner to that cell's centre (a triangle's centre is close to its sides:
  // there the samples go deeper, clear of a piece cut a little large)
  const NOTCH_DEPTHS = { square: [0.4, 0.6], hexagonal: [0.4, 0.6], triangular: [0.8, 1] };
  const RIM_STEPS = [0.25, 0.5, 0.75];

  /* The colour of a piece (divided by the paper's), per channel the median
   * over the samples of its cells that surely show a piece; null when there
   * are too few. */
  function pieceColour(info, sc, cells) {
    const r = [];
    const g = [];
    const b = [];
    const { rgb, valid } = sc;
    for (const c of cells) {
      const o = c * 6;
      const wr = Math.max(8, evalQuad(sc.cR, info.basis, o) * sc.factor[c]);
      const wg = Math.max(8, evalQuad(sc.cG, info.basis, o) * sc.factor[c]);
      const wb = Math.max(8, evalQuad(sc.cB, info.basis, o) * sc.factor[c]);
      for (let i = info.sampleStart[c]; i < info.sampleStart[c + 1]; i += 1) {
        if (!valid[i]) continue;
        const nr = rgb[i * 3] / wr;
        const ng = rgb[i * 3 + 1] / wg;
        const nb = rgb[i * 3 + 2] / wb;
        if (inkOf(nr, ng, nb, info.classic) < 0.8) continue;
        r.push(nr);
        g.push(ng);
        b.push(nb);
      }
    }
    if (r.length < 3) return null;
    const mid = (list) => list.sort((x, y) => x - y)[list.length >> 1];
    return [mid(r), mid(g), mid(b)];
  }

  function pieceKey(p) {
    return p.cells.slice().sort().join("|");
  }

  // ---------------------------------------------------------------------------
  // Live tracking

  function emptyAnalysis(info) {
    return dep("FenceAnalysis").analyze({ board: info.board, lattice: info.lattice, occupied: new Set() });
  }

  function isInside(img, pts, margin) {
    return pts.every((p) => p.x >= margin && p.y >= margin && p.x <= img.width - 1 - margin && p.y <= img.height - 1 - margin);
  }

  /* createTracker({ boardId }) -> { process(image, { now }), reset(), boardId }
   * boardId is only a hint: any board is recognised by its corner marks (two
   * are needed to recognise a board, one is enough to keep following it).
   * The hinted board is prepared at once (see prepare).
   *
   * process(image, { now }) takes one frame (640 px on the long side is
   * plenty; `now` in milliseconds, as from performance.now()) and returns:
   *   boardId, geometry  the board followed (kept while it is out of view)
   *   markers            its corner marks read in this frame [{ id, corner, imageCorners }]
   *   tiles              classic tiles known [{ id, piece, side, cells, imageCorners }]
   *   H, Hinv            world -> image for this frame and its inverse:
   *                        - two corner marks or more read: fitted to them
   *                          (fresh is true);
   *                        - one mark only: the map of the last frame read from
   *                          two marks or more, while this mark has moved by
   *                          less than `holdPx` since then (the camera is
   *                          still; fresh is false);
   *                        - otherwise null (no mark, or one mark that moved):
   *                          nothing can be drawn over the paper in this frame.
   *                      Whatever H is, boardId, occupied, analysis and pieces
   *                      are those of the board followed.
   *   quality            { markerCount, reprojError } (error in pixels; with
   *                      the map kept from before, the error of the one mark)
   *   cells              Map key -> { score: this frame (null when not seen), p: smoothed };
   *                      empty when H is null
   *   raw                cells that look covered in this frame alone
   *   occupied           the accepted cells. A new state is accepted once the
   *                      board has been still for a moment (`settleSmall`
   *                      for the first state and a few cells taken away,
   *                      `settleLarge` for new covered cells), when it is
   *                      made of whole pieces of the board's set and its new
   *                      pieces look like cut pieces in `pieceChecks` frames
   *                      in a row (well covered, and nothing of their colour
   *                      in their notches or beyond the rim: see
   *                      looksLikePiece). Any other new state is accepted
   *                      only once it has not changed for `doubtMs` (the
   *                      first state excepted: nothing was accepted before).
   *   analysis           FenceAnalysis of `occupied`
   *   pieces             whole pieces for `occupied` (see reconstruct) that
   *                      the camera vouches for, or null
   *   piecesComplete     true when `pieces` cover `occupied` exactly and the
   *                      camera vouches for all of them (only then may they
   *                      be carried on screen). Pieces accepted in doubt are
   *                      vouched for later, once they look right.
   *   doubtful           a new state is waiting because it does not look like
   *                      whole pieces of the kit (it is accepted only after
   *                      `doubtMs`, and without those pieces)
   *   stable             this frame agrees with `occupied` and nothing moves
   *   handsLikely        something moved over the board a moment ago; while a
   *                      corner mark has been hidden for a few frames in a row,
   *                      that moment lasts longer (`handsMotionMs`, counted
   *                      from the last movement or from when the mark, read
   *                      steadily until then, went out of sight). A mark
   *                      missing in single frames, read only now and then, or
   *                      missing for long with nothing moving, is not taken
   *                      for a hand.
   *   fresh              H was fitted in this frame (two marks or more); new
   *                      states are accepted only from such frames
   *   changed            `occupied` was accepted anew on this frame
   */
  function createTracker(options) {
    const opts = Object.assign({}, options);
    const detector = createDetector();
    let st = null;
    // (the board given as a hint is made ready now rather than on the frame
    // that first finds it)
    if (opts.boardId) prepare(opts.boardId);

    function reset() {
      st = {
        boardId: null,
        info: null,
        holder: {},
        learned: null, // classic board: world corners of its marks, measured on the prints
        lock: null, // classic board: { frames, marks } while its grid is being found the same way
        lockMiss: 0, // classic board: frames in a row the print disagreed with the learned marks
        p: null,
        on: null,
        last: null,
        jumped: null,
        lastTime: null,
        committed: new Set(),
        committedOn: null,
        analysis: null,
        hasCommit: false,
        pendingKey: null,
        pendingSince: 0,
        pendingWhole: null, // whole pieces found for the pending state (see wholeFor)
        pendingChecks: 0, // frames in a row its new pieces looked like cut pieces
        lastMotion: -Infinity,
        seen: new Map(), // corner -> last time it was read
        missing: new Map(), // corner -> frames in a row it was not read
        readSince: new Map(), // corner -> start of its current run of frames read
        leftAt: new Map(), // corner -> when, read steadily until then, it went out of sight
        lastMap: null, // { H, Hinv, corners: Map corner -> image corners } of the last frame read from two marks or more
        tiles: new Map(), // classic tile id -> { tile, lastSeen }
        pieces: null,
        piecesComplete: false,
        trusted: new Set(), // pieces accepted as cut pieces of the kit (pieceKey)
        doubt: null, // { pieces, covered, checks }: whole pieces accepted without trusting the new ones
        switchTo: null,
        switchCount: 0,
      };
    }
    reset();

    function useBoard(boardId) {
      const info = boardInfo(boardId);
      st.boardId = boardId;
      st.info = info;
      st.learned = null;
      st.lock = null;
      st.lockMiss = 0;
      st.p = new Float32Array(info.n);
      st.on = new Uint8Array(info.n);
      st.last = new Float32Array(info.n).fill(NaN);
      st.jumped = new Uint8Array(info.n);
      st.lastTime = null;
      st.committed = new Set();
      st.committedOn = new Uint8Array(info.n);
      st.analysis = emptyAnalysis(info);
      st.hasCommit = false;
      st.pendingKey = null;
      st.pendingWhole = null;
      st.pendingChecks = 0;
      st.trusted = new Set();
      st.doubt = null;
      st.seen = new Map();
      st.missing = new Map();
      st.readSince = new Map();
      st.leftAt = new Map();
      st.lastMap = null;
      st.tiles = new Map();
      st.pieces = null;
      st.piecesComplete = false;
      st.switchTo = null;
      st.switchCount = 0;
    }

    function result(extra) {
      const info = st.info;
      return Object.assign(
        {
          boardId: st.boardId,
          geometry: info ? info.geometry : null,
          markers: [],
          tiles: [],
          H: null,
          Hinv: null,
          quality: { markerCount: 0, reprojError: null },
          cells: new Map(),
          occupied: new Set(st.committed),
          raw: new Set(),
          analysis: st.analysis,
          pieces: st.pieces,
          piecesComplete: st.piecesComplete,
          stable: false,
          handsLikely: false,
          fresh: false,
          changed: false,
          doubtful: false,
        },
        extra
      );
    }

    // Classic board: the places of its marks on the board are learned once
    // its grid has been found the same way, in agreement with the print, in
    // several frames in a row; later frames start from them and only look
    // near there. They are forgotten when the print disagrees for a few
    // frames in a row (the grid would be locked a whole cell off). A frame
    // that cannot tell (a hand on the grid, its margin out of the picture)
    // counts for neither.
    function classicLock(fit, H) {
      if (st.learned) {
        if (fit.structure === true) {
          st.lockMiss = 0;
          if (fit.used.length === 4) st.learned = learnMarks(st.learned, fit.used, H);
        } else if (fit.structure === false && (st.lockMiss += 1) >= TUNING.lockMiss) {
          st.learned = null;
          st.lock = null;
          st.lockMiss = 0;
        }
        return;
      }
      if (fit.structure !== true || fit.used.length < 4) {
        st.lock = null;
        return;
      }
      const marks = learnMarks(null, fit.used, H);
      if (st.lock && sameMarks(st.lock.marks, marks)) {
        st.lock.frames += 1;
        st.lock.marks = learnMarks(st.lock.marks, fit.used, H);
      } else {
        st.lock = { frames: 1, marks };
      }
      if (st.lock.frames >= TUNING.lockFrames) {
        st.learned = st.lock.marks;
        st.lock = null;
        st.lockMiss = 0;
      }
    }

    // The whole pieces of the state waiting to be accepted (at most once per
    // state: the search takes a few milliseconds).
    function wholeFor(info, tiles) {
      const n = info.n;
      const onSet = new Set();
      const maybe = new Set();
      for (let c = 0; c < n; c += 1) {
        if (st.on[c]) onSet.add(info.keys[c]);
        else if (st.p[c] >= TUNING.cellMaybe) maybe.add(info.keys[c]);
      }
      const p = st.p;
      const index = info.index;
      const tileCells = new Set();
      for (const t of tiles) for (const k of t.cells) tileCells.add(k);
      const score = (k) => (tileCells.has(k) ? 1 : p[index.get(k)]);
      const whole = wholePieces(info, onSet, maybe, tiles, score, TUNING.liveSearchMs);
      whole.covered = new Set([...whole.occupied].map((k) => index.get(k)));
      return whole;
    }

    // Do the pieces the camera does not vouch for yet look like cut pieces
    // in this frame: well covered, and nothing of theirs beyond their cells?
    // (tiles are vouched for by their marks)
    function newPiecesLookRight(image, info, H, pieces, covered) {
      for (const p of pieces) {
        if (p.tile != null || st.trusted.has(pieceKey(p))) continue;
        const cells = p.cells.map((k) => info.index.get(k));
        let sum = 0;
        for (const c of cells) sum += st.p[c];
        if (sum < TUNING.trustSupport * cells.length) return false;
        if (!looksLikePiece(image, info, st.holder.scratch, H, cells, covered)) return false;
      }
      return true;
    }

    function hasNewPieces(pieces) {
      return pieces.some((p) => p.tile == null && !st.trusted.has(pieceKey(p)));
    }

    // Accept the pending state. Without `trust`, only the pieces the camera
    // vouched for before (and tiles) are kept, piecesComplete is false, and
    // the whole cover waits in `doubt` until its new pieces look right.
    function commit(info, w, trust) {
      st.committedOn.set(st.on);
      st.committed = w.occupied;
      if (trust) {
        st.pieces = w.pieces;
        st.piecesComplete = true;
        st.trusted = new Set(w.pieces.map(pieceKey));
        st.doubt = null;
      } else {
        const kept = (w.pieces || []).filter((p) => p.tile != null || st.trusted.has(pieceKey(p)));
        st.pieces = kept.length ? kept : null;
        st.piecesComplete = false;
        st.trusted = new Set(kept.map(pieceKey));
        st.doubt = w.complete ? { pieces: w.pieces, covered: w.covered, checks: 0 } : null;
      }
      st.analysis = dep("FenceAnalysis").analyze({ board: info.board, lattice: info.lattice, occupied: st.committed });
      st.pendingKey = null;
      st.pendingWhole = null;
      st.pendingChecks = 0;
      st.hasCommit = true;
    }

    function process(image, frameOptions) {
      const now = frameOptions && frameOptions.now != null ? frameOptions.now : clock();
      const markers = detector.detect(image);
      const byBoard = cornersByBoard(markers);

      // Which board: the one whose corner marks are seen, sticking to the
      // current one unless another wins clearly for a few frames in a row.
      const prefer = [st.boardId, opts.boardId].filter(Boolean);
      const best = pickBoard(byBoard, prefer);
      // A board is first recognised from two of its corner marks (one mark
      // read with a corrected bit could be chance); once tracked, one is enough.
      let clear = false;
      if (best && best !== st.boardId) {
        const cur = st.boardId ? byBoard.get(st.boardId) : null;
        clear = byBoard.get(best).size >= 2 && (!cur || byBoard.get(best).size > cur.size);
      }
      if (clear) {
        st.switchCount = st.switchTo === best ? st.switchCount + 1 : 1;
        st.switchTo = best;
        if (!st.boardId || st.switchCount >= TUNING.switchFrames) useBoard(best);
      } else {
        // any frame that does not clearly favour that board starts the count again
        st.switchTo = null;
        st.switchCount = 0;
      }
      if (!st.boardId) return result({});
      const info = st.info;
      const byCorner = byBoard.get(st.boardId) || new Map();
      // Each corner mark: when it was last read, how many frames in a row it
      // has not been, and when, after being read without a break for a
      // while, it went out of sight (a glimpse now and then does not count).
      for (const corner of MARK_CORNERS) {
        const missed = st.missing.get(corner);
        if (byCorner.has(corner)) {
          if (missed !== 0) st.readSince.set(corner, now);
          st.seen.set(corner, now);
          st.missing.set(corner, 0);
        } else {
          if (missed === 0) {
            const last = st.seen.get(corner);
            if (last - st.readSince.get(corner) >= TUNING.steadyMs) st.leftAt.set(corner, last);
          }
          st.missing.set(corner, (missed || 0) + 1);
        }
      }
      if (byCorner.size === 0) return result({});

      const fit = locate(image, info, byCorner, st.learned, markers);
      if (!fit) return result({});
      const markerWorld = fit.world;
      const trusted = fit.used.length >= 2;
      const marks = fit.used.map((u) => ({ id: u.marker.id, corner: u.corner, imageCorners: u.marker.corners }));
      let H = fit.H;
      let Hinv = null;
      let reprojError = fit.reprojError;
      if (trusted) {
        if (info.classic) classicLock(fit, H);
        Hinv = invert(H);
        if (!Hinv) return result({});
        st.lastMap = { H, Hinv, corners: new Map(fit.used.map((u) => [u.corner, u.marker.corners])) };
      } else {
        // One mark alone cannot place the board: a map fitted to one small
        // square is off by whole cells at the far side. The map of the last
        // frame read from two marks or more is kept while this mark stays
        // where it was then (the camera has not moved); otherwise this frame
        // has no map, and the board and its state are simply kept.
        const u = fit.used[0];
        const then = st.lastMap && st.lastMap.corners.get(u.corner);
        const tol = TUNING.holdPx * Math.max(1, Math.max(image.width, image.height) / 640);
        let moved = !then;
        let sum = 0;
        for (let k = 0; k < 4 && !moved; k += 1) {
          const d = Math.hypot(u.marker.corners[k].x - then[k].x, u.marker.corners[k].y - then[k].y);
          if (d > tol) moved = true;
          const q = project(st.lastMap.H, u.world[k]);
          sum += (q.x - u.marker.corners[k].x) ** 2 + (q.y - u.marker.corners[k].y) ** 2;
        }
        reprojError = Math.sqrt(sum / 4);
        if (moved) {
          st.pendingKey = null;
          return result({
            markers: marks,
            quality: { markerCount: 1, reprojError: null },
            handsLikely: now - st.lastMotion < TUNING.motionQuiet,
          });
        }
        H = st.lastMap.H;
        Hinv = st.lastMap.Hinv;
      }

      const anchors = paperAnchors(info, markerWorld);
      const scores = measureCells(image, info, H, anchors, st.holder);

      // Classic tiles: their cells are covered. A tile read in a recent frame
      // keeps its cells while its cells still look covered (its small mark is
      // not read in every frame).
      const tiles = [];
      if (info.classic) {
        const index = info.index;
        for (const m of markers) {
          if (!TILE_CELLS[m.id]) continue;
          const tile = tileFromWorld(m.id, m.corners.map((p) => project(Hinv, p)), info.board);
          if (!tile) continue;
          tile.imageCorners = m.corners;
          st.tiles.set(m.id, { tile, lastSeen: now });
        }
        for (const [id, mem] of st.tiles) {
          const idx = mem.tile.cells.map((k) => index.get(k));
          let sum = 0;
          let cnt = 0;
          for (const i of idx) {
            if (!Number.isNaN(scores[i])) {
              sum += scores[i];
              cnt += 1;
            }
          }
          const seenNow = mem.lastSeen === now;
          const gone = cnt && sum / cnt < TUNING.cellMaybe;
          if (!seenNow && (now - mem.lastSeen > TUNING.tileMemory || gone)) {
            st.tiles.delete(id);
            // (a tile only forgotten, its cells still covered, is no movement)
            if (!gone) for (const i of idx) st.last[i] = NaN;
            continue;
          }
          tiles.push(mem.tile);
          for (const i of idx) scores[i] = 1;
        }
      }

      // Smoothing, movement and hysteresis.
      const n = info.n;
      const dt = st.lastTime == null ? Infinity : Math.max(1, now - st.lastTime);
      const alpha = 1 - Math.exp(-dt / TUNING.emaTau);
      const jumped = st.jumped;
      const jumps = [];
      const cells = new Map();
      const raw = new Set();
      for (let c = 0; c < n; c += 1) {
        const s = scores[c];
        const key = info.keys[c];
        if (Number.isNaN(s)) {
          cells.set(key, { score: null, p: st.p[c] });
          continue;
        }
        if (s >= TUNING.cellOn) raw.add(key);
        if (!Number.isNaN(st.last[c]) && Math.abs(s - st.last[c]) > TUNING.motionJump) {
          jumped[c] = 1;
          jumps.push(c);
        }
        st.last[c] = s;
        if (trusted) {
          st.p[c] = st.lastTime == null ? s : st.p[c] + alpha * (s - st.p[c]);
          if (st.on[c]) {
            if (st.p[c] < TUNING.holdOff) st.on[c] = 0;
          } else if (st.p[c] >= TUNING.holdOn) {
            st.on[c] = 1;
          }
        }
        cells.set(key, { score: s, p: st.p[c] });
      }
      if (trusted) st.lastTime = now;
      // Movement: the readings of two cells side by side jumped in this
      // frame. (One cell alone is noise; a share of the whole board would
      // miss something as small as a fingertip arriving.)
      let motion = false;
      for (let i = 0; i < jumps.length && !motion; i += 1) {
        const c = jumps[i];
        for (let k = info.adjStart[c]; k < info.adjStart[c + 1]; k += 1) {
          if (jumped[info.adj[k]]) {
            motion = true;
            break;
          }
        }
      }
      for (const c of jumps) jumped[c] = 0;
      if (motion) st.lastMotion = now;

      // A corner mark read before that should be in view, but has not been
      // read for a few frames in a row: something may cover it. One missed
      // read is not enough (blur), and a mark left unread much longer
      // (glare, a spare piece on it, a poor print) is left out, so the
      // board keeps settling from its other marks.
      let covered = false;
      let coveredAt = -Infinity; // when the latest covered mark went out of sight
      for (const corner of MARK_CORNERS) {
        if (byCorner.has(corner) || !markerWorld[corner]) continue;
        const last = st.seen.get(corner);
        if (last === undefined) continue;
        if (now - last > TUNING.forgetMs) {
          st.seen.delete(corner);
          continue;
        }
        if (st.missing.get(corner) < TUNING.coverFrames || now - last < TUNING.coverMs) continue;
        const q = markerWorld[corner].map((p) => project(H, p));
        if (isInside(image, q, 2)) {
          covered = true;
          const left = st.leftAt.get(corner);
          if (left !== undefined) coveredAt = Math.max(coveredAt, left);
        }
      }
      // Hands: something moved over the board just now. While a mark is
      // covered, that moment lasts longer, counted from the last movement or
      // from when the mark, steadily read until then, went out of sight (a
      // hand coming to rest on it).
      const moment = now - Math.max(st.lastMotion, coveredAt);
      const handsLikely = now - st.lastMotion < TUNING.motionQuiet || (covered && moment < TUNING.handsMotionMs);

      // Accept a new state once it has held still long enough: the first one
      // and a few cells taken away soon, new covered cells a little later.
      // The new state must also be made of whole pieces of the kit, and its
      // new pieces must look like cut pieces (looksLikePiece) in frames in a
      // row. Otherwise (a fingertip, a pen or a hand resting on the board,
      // which may also hide pieces or be read as paper) it is accepted only
      // once it has not changed for `doubtMs`, and then without the pieces
      // the camera cannot vouch for (piecesComplete false), so nothing of it
      // is carried on screen. The first state has nothing to keep instead:
      // it is accepted at once, with the same caution about its pieces.
      let diff = 0;
      let added = 0;
      for (let c = 0; c < n; c += 1) {
        if (st.on[c] === st.committedOn[c]) continue;
        diff += 1;
        if (st.on[c]) added += 1;
      }
      let changed = false;
      let doubtful = false;
      if (!trusted || handsLikely) {
        st.pendingKey = null;
      } else if (diff === 0) {
        st.pendingKey = null;
        if (!st.hasCommit) {
          st.hasCommit = true;
          st.pieces = [];
          st.piecesComplete = true;
          changed = true;
        } else if (st.doubt) {
          // pieces accepted in doubt are vouched for once they look right
          // (for instance once a piece has been put straight)
          const d = st.doubt;
          d.checks = newPiecesLookRight(image, info, H, d.pieces, d.covered) ? d.checks + 1 : 0;
          if (d.checks >= TUNING.pieceChecks) {
            st.pieces = d.pieces;
            st.piecesComplete = true;
            st.trusted = new Set(d.pieces.map(pieceKey));
            st.doubt = null;
            changed = true;
          }
        }
      } else {
        const key = onKey(st.on);
        if (key !== st.pendingKey) {
          st.pendingKey = key;
          st.pendingSince = now;
          st.pendingWhole = null;
          st.pendingChecks = 0;
        } else {
          const maxOrder = Math.max(...pieceTypesFor(info).map((t) => t.cells.length));
          const large = diff > 2 * maxOrder + 2;
          const wait = !st.hasCommit ? TUNING.settleSmall : added > 0 || large ? TUNING.settleLarge : TUNING.settleSmall;
          if (now - st.pendingSince >= wait) {
            if (!st.pendingWhole) st.pendingWhole = wholeFor(info, tiles);
            const w = st.pendingWhole;
            const fresh = w.complete && hasNewPieces(w.pieces);
            const looks = w.complete && (!fresh || newPiecesLookRight(image, info, H, w.pieces, w.covered));
            st.pendingChecks = looks ? st.pendingChecks + 1 : 0;
            const trust = looks && (!fresh || st.pendingChecks >= TUNING.pieceChecks);
            if (trust || (!st.hasCommit && !looks) || now - st.pendingSince >= TUNING.doubtMs) {
              commit(info, w, trust);
              changed = true;
            } else {
              doubtful = !looks;
            }
          }
        }
      }

      return result({
        markers: marks,
        tiles,
        H,
        Hinv,
        quality: { markerCount: fit.used.length, reprojError },
        cells,
        raw,
        stable: trusted && !handsLikely && diff === 0,
        handsLikely,
        fresh: trusted,
        changed,
        doubtful,
      });
    }

    return {
      process,
      reset,
      get boardId() {
        return st.boardId;
      },
    };
  }

  function onKey(on) {
    let s = "";
    for (let i = 0; i < on.length; i += 1) if (on[i]) s += i + ",";
    return s;
  }

  // The same places for the marks in two measurements, within a fraction of a
  // cell (a grid locked one cell off moves them by a whole cell).
  function sameMarks(a, b) {
    for (const corner of MARK_CORNERS) {
      if (!a[corner] || !b[corner]) return false;
      for (let k = 0; k < 4; k += 1) {
        if (Math.hypot(a[corner][k].x - b[corner][k].x, a[corner][k].y - b[corner][k].y) > 0.3) return false;
      }
    }
    return true;
  }

  // Classic board: remember where its marks sit in world coordinates.
  function learnMarks(prev, used, H) {
    const Hinv = invert(H);
    if (!Hinv) return prev;
    const next = prev ? Object.assign({}, prev) : {};
    for (const u of used) {
      const w = u.marker.corners.map((p) => project(Hinv, p));
      const old = prev && prev[u.corner];
      next[u.corner] = old ? old.map((p, k) => ({ x: p.x + 0.3 * (w[k].x - p.x), y: p.y + 0.3 * (w[k].y - p.y) })) : w;
    }
    return next;
  }

  // ---------------------------------------------------------------------------
  // One careful look at a still image

  function mergeScales(list) {
    // same id found at several scales: keep the detection from the finest one
    const out = [];
    for (const m of list.sort((a, b) => b.scale - a.scale)) {
      const c = quadCenter(m.corners);
      const side = Math.sqrt(quadArea(m.corners));
      if (out.some((o) => o.id === m.id && Math.hypot(quadCenter(o.corners).x - c.x, quadCenter(o.corners).y - c.y) < side * 0.5)) continue;
      out.push(m);
    }
    return out;
  }

  // Resample the board area into an upright image (ppu pixels per cell).
  function rectify(img, H, x0, y0, x1, y1, ppu) {
    const w = Math.round((x1 - x0) * ppu);
    const h = Math.round((y1 - y0) * ppu);
    const data = new Uint8ClampedArray(w * h * 4);
    const d = img.data;
    const W = img.width;
    const Hh = img.height;
    const px = [0, 0, 0];
    for (let j = 0; j < h; j += 1) {
      const Y = y0 + (j + 0.5) / ppu;
      for (let i = 0; i < w; i += 1) {
        const X = x0 + (i + 0.5) / ppu;
        const iw = H[6] * X + H[7] * Y + H[8];
        let x = (H[0] * X + H[1] * Y + H[2]) / iw;
        let y = (H[3] * X + H[4] * Y + H[5]) / iw;
        const o = (j * w + i) * 4;
        data[o + 3] = 255;
        if (!(x >= 0 && y >= 0 && x <= W - 1.001 && y <= Hh - 1.001)) {
          data[o] = data[o + 1] = data[o + 2] = 255;
          continue;
        }
        readRGB(d, W, Hh, x, y, px, 0);
        data[o] = px[0];
        data[o + 1] = px[1];
        data[o + 2] = px[2];
      }
    }
    return { width: w, height: h, data };
  }

  /* snapshot(image, { boardId }) -> the same fields as a tracker frame, from
   * one image at full resolution (marks read at several sizes; for the
   * classic kit every tile mark is read on an upright copy of the board).
   * `pieces` are placements for the digital board (see reconstruct), null
   * when the covered cells are not whole pieces; for the classic kit they
   * hold the tiles read even when the other cells are not whole pieces
   * (`piecesComplete` false). A piece no tile mark vouches for must also
   * look like a cut piece (see looksLikePiece), or it is left out and
   * `piecesComplete` is false. */
  function snapshot(image, options) {
    const opts = options || {};
    const stillDetector = createDetector(); // its buffers go with it once the photo is read
    // Marks are read at several sizes: large for the small tile marks, small
    // when the photo is blurred (the detector looks at edges a few pixels wide).
    const L = Math.max(image.width, image.height);
    let found = [];
    let work = null;
    const done = [];
    const pass = (target) => {
      const s = Math.min(1, target / L);
      if (done.some((x) => Math.abs(x - s) < 0.05)) return;
      done.push(s);
      const img = s < 1 ? downscale(image, s) : image;
      if (!work) work = { img, s };
      for (const m of stillDetector.detect(img)) {
        found.push({ id: m.id, hamming: m.hamming, scale: s, corners: m.corners.map((p) => ({ x: p.x / s, y: p.y / s })) });
      }
    };
    const enough = () => {
      const v = cornersByBoard(mergeScales(found.slice()));
      for (const byCorner of v.values()) if (byCorner.size === 4) return true;
      return false;
    };
    pass(1920);
    pass(1280);
    if (!enough()) pass(800);
    if (!enough()) pass(560);
    found = mergeScales(found);

    const byBoard = cornersByBoard(found);
    for (const [id, byCorner] of byBoard) if (byCorner.size < 2) byBoard.delete(id);
    const boardId = pickBoard(byBoard, [opts.boardId].filter(Boolean));
    const base = {
      boardId: boardId || null,
      geometry: null,
      markers: [],
      tiles: [],
      H: null,
      Hinv: null,
      quality: { markerCount: 0, reprojError: null },
      cells: new Map(),
      occupied: new Set(),
      raw: new Set(),
      analysis: null,
      stable: false,
      handsLikely: false,
      fresh: false,
      changed: false,
      pieces: null,
    };
    if (!boardId) return base;
    const info = boardInfo(boardId);
    base.geometry = info.geometry;
    base.analysis = emptyAnalysis(info);
    const byCorner = new Map();
    for (const [corner, m] of byBoard.get(boardId)) {
      byCorner.set(corner, Object.assign({}, m, { corners: m.corners.map((p) => ({ x: p.x * work.s, y: p.y * work.s })) }));
    }
    // locate in the working copy, then express the map in the input's pixels
    const inWork = (m) => ({ id: m.id, corners: m.corners.map((p) => ({ x: p.x * work.s, y: p.y * work.s })) });
    const fit = locate(work.img, info, byCorner, null, info.classic ? found.filter((m) => TILE_CELLS[m.id]).map(inWork) : null);
    if (!fit) return base;
    const H = scaleH(fit.H, 1 / work.s);
    fit.reprojError /= work.s;
    fit.used.forEach((u) => {
      u.marker = byBoard.get(boardId).get(u.corner);
    });
    const markerWorld = info.classic ? learnMarks(null, fit.used, H) : info.nominal;
    const Hinv = invert(H);
    if (!Hinv) return base;
    // A corner mark that should be in the photo but was not read: something covers it.
    let covered = false;
    for (const corner of ["tl", "tr", "br", "bl"]) {
      if (byCorner.has(corner)) continue;
      const q = (markerWorld[corner] || info.nominal[corner]).map((p) => project(H, p));
      if (isInside(image, q, 2)) covered = true;
    }

    const holder = {};
    const Hw = scaleH(H, work.s);
    const scores = measureCells(work.img, info, Hw, paperAnchors(info, markerWorld), holder);

    const tiles = [];
    const tileCells = new Set();
    if (info.classic) {
      // Tiles from the image passes, then from an upright copy of the board
      // where every tile mark is square and large.
      const byId = new Map();
      for (const m of found) {
        const t = tileFromWorld(m.id, m.corners.map((p) => project(Hinv, p)), info.board);
        if (t) {
          t.imageCorners = m.corners;
          byId.set(m.id, t);
        }
      }
      const size = info.geometry.def.spec.size;
      const ppu = 48;
      const r0 = -1.5;
      const r1 = size + 0.5;
      const rect = rectify(image, H, r0, r0, r1, r1, ppu);
      for (const m of stillDetector.detect(rect)) {
        if (!TILE_CELLS[m.id]) continue;
        const wc = m.corners.map((p) => ({ x: r0 + (p.x + 0.5) / ppu, y: r0 + (p.y + 0.5) / ppu }));
        const t = tileFromWorld(m.id, wc, info.board);
        if (!t) continue;
        t.imageCorners = wc.map((p) => project(H, p));
        byId.set(m.id, t);
      }
      for (const t of [...byId.values()].sort((a, b) => a.id - b.id)) {
        tiles.push(t);
        for (const k of t.cells) tileCells.add(k);
      }
    }

    const cells = new Map();
    const raw = new Set();
    const maybe = new Set();
    info.keys.forEach((key, c) => {
      const s = scores[c];
      const tile = tileCells.has(key);
      cells.set(key, { score: Number.isNaN(s) ? null : s, p: tile ? 1 : Number.isNaN(s) ? 0 : s });
      if (tile || s >= TUNING.cellOn) raw.add(key);
      else if (s >= TUNING.cellMaybe) maybe.add(key);
    });

    // Pieces for the digital board (pale corners of pieces recovered, colour
    // spilled next to a piece left out).
    const score = (k) => {
      if (tileCells.has(k)) return 1;
      const s = scores[info.index.get(k)];
      return Number.isNaN(s) ? 0 : s;
    };
    const whole = wholePieces(info, raw, maybe, tiles, score, TUNING.photoSearchMs);
    const occupied = whole.occupied;
    let pieces = whole.pieces;
    let piecesComplete = whole.complete;
    // Pieces no tile mark vouches for must look like cut pieces: a fingertip
    // or a pen in the photo is never carried on screen as a piece.
    if (whole.complete) {
      const covered = new Set([...occupied].map((k) => info.index.get(k)));
      const looks = (p) => p.cells.reduce((sum, k) => sum + score(k), 0) >= TUNING.trustSupport * p.cells.length &&
        looksLikePiece(work.img, info, holder.scratch, Hw, p.cells.map((k) => info.index.get(k)), covered);
      const doubted = pieces.filter((p) => p.tile == null && !looks(p));
      if (doubted.length) {
        piecesComplete = false;
        pieces = pieces.filter((p) => !doubted.includes(p));
        if (!pieces.length) pieces = null;
      }
    }
    const analysis = dep("FenceAnalysis").analyze({ board: info.board, lattice: info.lattice, occupied });

    return Object.assign(base, {
      markers: fit.used.map((u) => ({ id: u.marker.id, corner: u.corner, imageCorners: u.marker.corners })),
      tiles,
      H,
      Hinv,
      quality: { markerCount: fit.used.length, reprojError: fit.reprojError },
      cells,
      occupied,
      raw,
      analysis,
      stable: !covered,
      handsLikely: covered,
      fresh: true,
      changed: true,
      pieces,
      piecesComplete,
    });
  }

  return {
    createDetector,
    homography,
    project,
    invert,
    prepare,
    createTracker,
    snapshot,
    reconstruct,
    TILE_CELLS,
  };
});
