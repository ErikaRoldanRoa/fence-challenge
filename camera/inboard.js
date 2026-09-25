/* Fence Challenge · the camera inside a board.
 *
 * FenceInboard.open({ host, boardId, worldToHost, onPlacements, onState, onClose })
 * turns the board drawn inside `host` into a camera window of the same shape:
 *   1. until the printed board is found, the window shows the camera picture
 *      itself, cut to the board's outline;
 *   2. once its corner marks are read, the paper board is straightened onto
 *      the digital one, cell on cell: every point of the board is looked up in
 *      the camera picture through the homography (WebGL; Canvas 2D triangles
 *      when WebGL is missing), and the inside and the corner leaks are drawn
 *      over it in the digital board's own style;
 *   3. when the view is steady and the pieces on paper are whole pieces of the
 *      board's set, onPlacements(placements, result) hands them over (a set of
 *      at least one piece, each new set once).
 * close() stops the camera and removes the window; the page keeps what it did
 * with the pieces. Hiding or leaving the page stops the camera as well (a tap
 * on the window starts it again). Frames stay in this page's memory: nothing
 * is recorded or sent.
 *
 *   host         positioned element exactly covering the board's drawing area
 *   boardId      a board of camera/boards.js: sq9, hex4, tri4, sq20, hex6, tri13
 *   worldToHost  {x, y} in the board's world units -> CSS pixels from the
 *                host's padding box; call refresh() when it changes
 *   onState      "starting" | "searching" | "locked" | "stopped" | "error:<kind>"
 *                (kind: denied, busy, none, unsupported, reader)
 *   onClose      runs once, when the window has closed
 *   announce     false when the page reads these states out itself (by default
 *                the window has its own polite line for screen readers)
 * Callbacks always run after open() has returned.
 *
 * Needs FenceCamera (camera/core.js), FenceBoards (camera/boards.js),
 * FenceAnalysis, the lattice modules and js-aruco2, and a camera API in a
 * secure context: supported() tells.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(root);
  } else {
    root.FenceInboard = factory(root);
  }
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  const PROCESS_LONG_SIDE = 640; // frames are read at this size, as on the camera page
  const READS_PER_SECOND = 15; // on average; frames arrive on screen refreshes, so gaps vary
  const READ_BURST = 2; // a late frame may be followed by an early one
  const LOCK_MARKS = 3; // corner marks needed before the board is first straightened
  const LOCK_ERROR = 2.5; // and how well they must agree (pixels of the read frame)
  const LOST_MS = 1000; // without the board this long, the camera picture comes back
  const STEADY_MS = 200; // the drawing brightens again once the view is steady this long
  const READ_FAILS_MAX = 10; // frames in a row that could not be read before saying so
  const FIND_ANNOUNCE_MS = 1000; // "show the corners" is read out only if it lasts
  const MESH_2D_MAX = 320; // Canvas 2D: more cell triangles than this use a coarser mesh
  const MESH_2D_STEPS = 12; // that mesh's squares per side
  const SEAM_PX = 0.75; // Canvas 2D triangles overlap by this much, so no seam shows
  const CROP_PAD = 4; // frame pixels kept around the board for the texture
  const CROP_STEP = 64; // the texture's size grows in steps of this many pixels
  const OUTSIDE = [12, 14, 20]; // colour where the camera picture has no pixels
  const CONSTRAINTS = {
    audio: false,
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
  };

  // The digital board's colours (piece-engine.js): a real fence glows neon,
  // an inside that leaks or is not alone stays muted, leaking cells are violet.
  // Inside a fence the paper opens onto the digital board: dark cells with
  // neon edges, so the lit area is never mistaken for a coloured piece.
  const STYLE = {
    fenceFill: "rgba(8, 14, 26, 0.9)",
    fenceStroke: "rgba(140, 255, 214, 0.95)",
    fenceGlow: "rgba(45, 246, 172, 0.85)",
    mutedFill: "rgba(8, 14, 26, 0.62)",
    mutedStroke: "rgba(45, 246, 172, 0.5)",
    leakFill: "rgba(178, 120, 255, 0.20)",
    leakStroke: "rgba(200, 150, 255, 0.85)",
    outline: "rgba(72, 208, 255, 0.9)",
    doubtFill: "rgba(255, 255, 255, 0.12)",
    doubtStroke: "rgba(255, 255, 255, 0.9)",
  };

  // Words for screen readers and tooltips (the window itself shows icons only).
  const NB = " ";
  const STRINGS = {
    fr: {
      "cam.videoLabel": "Image de la caméra, avec ta barrière dessinée par-dessus",
      "cam.starting": "La caméra s’ouvre…",
      "cam.s.find": "Montre les quatre carrés des coins.",
      "cam.boardFound": "Plateau reconnu" + NB + ":",
      "cam.board.square": "Carrés · {w} × {h}",
      "cam.board.cells": "{lattice} · {n} cases",
      "cam.lattice.hexagonal": "Hexagones",
      "cam.lattice.triangular": "Triangles",
      "cam.s.stopped": "La caméra est éteinte. Touche «" + NB + "Reprendre" + NB + "» pour la rallumer.",
      "cam.resume": "Reprendre",
      "cam.retry": "Réessayer",
      "cam.in.denied": "La caméra est bloquée. Tu peux l’autoriser dans les réglages du navigateur.",
      "cam.in.busy": "Une autre application utilise la caméra. Ferme-la et réessaie.",
      "cam.in.none": "Aucune caméra trouvée sur cet appareil.",
      "cam.in.unsupported": "Ce navigateur ne peut pas ouvrir la caméra ici.",
      "cam.in.reader": "L’image ne peut pas être lue pour l’instant. Recharge la page pour réessayer.",
    },
    de: {
      "cam.videoLabel": "Kamerabild, dein Zaun ist darüber gezeichnet",
      "cam.starting": "Die Kamera öffnet sich…",
      "cam.s.find": "Zeig alle vier Eckquadrate.",
      "cam.boardFound": "Spielfeld erkannt:",
      "cam.board.square": "Quadrate · {w} × {h}",
      "cam.board.cells": "{lattice} · {n} Felder",
      "cam.lattice.hexagonal": "Sechsecke",
      "cam.lattice.triangular": "Dreiecke",
      "cam.s.stopped": "Die Kamera ist aus. Tipp auf „Weiter“, um sie wieder einzuschalten.",
      "cam.resume": "Weiter",
      "cam.retry": "Nochmal versuchen",
      "cam.in.denied": "Die Kamera ist gesperrt. Du kannst sie in den Browser-Einstellungen erlauben.",
      "cam.in.busy": "Eine andere App benutzt gerade die Kamera. Schließ sie und versuch es noch einmal.",
      "cam.in.none": "Auf diesem Gerät wurde keine Kamera gefunden.",
      "cam.in.unsupported": "Dieser Browser kann die Kamera hier nicht öffnen.",
      "cam.in.reader": "Das Bild lässt sich gerade nicht lesen. Lade die Seite neu, um es noch einmal zu versuchen.",
    },
    en: {
      "cam.videoLabel": "Camera picture with your fence drawn over it",
      "cam.starting": "Opening the camera…",
      "cam.s.find": "Show all four corner squares.",
      "cam.boardFound": "Board found:",
      "cam.board.square": "Squares · {w} × {h}",
      "cam.board.cells": "{lattice} · {n} cells",
      "cam.lattice.hexagonal": "Hexagons",
      "cam.lattice.triangular": "Triangles",
      "cam.s.stopped": "The camera is off. Tap Resume to turn it back on.",
      "cam.resume": "Resume",
      "cam.retry": "Try again",
      "cam.in.denied": "The camera is blocked. You can allow it in your browser settings.",
      "cam.in.busy": "Another app is using the camera. Close it and try again.",
      "cam.in.none": "No camera was found on this device.",
      "cam.in.unsupported": "This browser cannot open the camera here.",
      "cam.in.reader": "The picture cannot be read right now. Reload the page to try again.",
    },
  };

  const ICONS = {
    camera:
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.5 8.2h3.6l1.7-2.6h6.4l1.7 2.6h3.6v10.6H3.5z"/><circle cx="12" cy="13.3" r="3.3"/></svg>',
    off:
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.5 8.2h3.6l1.7-2.6h6.4l1.7 2.6h3.6v10.6H3.5z"/><circle cx="12" cy="13.3" r="3.3"/><path d="M4 3.8l16 16.4"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="fill" d="M8.5 5.6v12.8L19 12z"/></svg>',
  };

  const VS = [
    "attribute vec2 aPos;",
    "attribute vec2 aWorld;",
    "uniform vec2 uSize;",
    "varying vec2 vWorld;",
    "void main() {",
    "  vWorld = aWorld;",
    "  gl_Position = vec4(aPos.x / uSize.x * 2.0 - 1.0, 1.0 - aPos.y / uSize.y * 2.0, 0.0, 1.0);",
    "}",
  ].join("\n");

  // Each pixel of the board: host pixel -> world point (interpolated, exact
  // for the boards' affine drawing transforms) -> camera picture through H.
  const FS = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "uniform mat3 uH;",
    "uniform sampler2D uTex;",
    "uniform vec3 uOut;",
    "varying vec2 vWorld;",
    "void main() {",
    "  vec3 q = uH * vec3(vWorld, 1.0);",
    "  vec2 uv = q.xy / q.z;",
    "  if (q.z <= 0.0 || uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {",
    "    gl_FragColor = vec4(uOut, 1.0);",
    "  } else {",
    "    gl_FragColor = vec4(texture2D(uTex, uv).rgb, 1.0);",
    "  }",
    "}",
  ].join("\n");

  /* --------------------------------------------------------- availability */

  function framed() {
    try {
      return root.top !== root.self;
    } catch (e) {
      return true;
    }
  }

  function modulesReady() {
    const C = root.FenceCamera;
    const B = root.FenceBoards;
    return !!(
      C && typeof C.createTracker === "function" &&
      B && typeof B.geometry === "function" && typeof B.get === "function" &&
      root.FenceAnalysis && typeof root.FenceAnalysis.analyze === "function" &&
      root.AR && root.CV &&
      (root.LatticeSquare || root.LatticeHex || root.LatticeTriangular)
    );
  }

  // Inside another site's frame the camera never starts (as on the camera page).
  function supported() {
    try {
      if (typeof document === "undefined" || typeof navigator === "undefined") return false;
      if (root.isSecureContext === false) return false;
      const md = navigator.mediaDevices;
      if (!md || typeof md.getUserMedia !== "function") return false;
      if (framed()) return false;
      return modulesReady();
    } catch (e) {
      return false;
    }
  }

  /* -------------------------------------------------------------- strings */

  function language() {
    let l = "";
    try {
      l = root.i18n && typeof root.i18n.get === "function" ? root.i18n.get() : "";
    } catch (e) {
      l = "";
    }
    if (!l && typeof document !== "undefined" && document.documentElement) l = document.documentElement.lang || "";
    l = String(l || "en").slice(0, 2).toLowerCase();
    return STRINGS[l] ? l : "en";
  }

  function t(key, vars) {
    let s = STRINGS[language()][key];
    if (s == null) s = STRINGS.en[key] || "";
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
    return s;
  }

  function boardLabel(boardId) {
    const B = root.FenceBoards;
    const def = B && B.get(boardId);
    if (!def) return "";
    if (def.lattice === "square") return t("cam.board.square", { w: def.spec.size, h: def.spec.size });
    let n = B.geometry(boardId).board.cells.length;
    try {
      n = new Intl.NumberFormat(language()).format(n);
    } catch (e) {
      n = String(n);
    }
    return t("cam.board.cells", { lattice: t("cam.lattice." + def.lattice), n });
  }

  /* ------------------------------------------------------ board geometry */

  // World geometry of a board, shared by every window on it: its distinct
  // vertices, each cell as vertex indices, the cells cut into triangles (fans:
  // every cell is convex) and the outline as one loop of vertices.
  const meshes = new Map();

  function vertexKey(p) {
    return Math.round(p.x * 10000) + "," + Math.round(p.y * 10000);
  }

  function boardMesh(boardId) {
    if (meshes.has(boardId)) return meshes.get(boardId);
    const geometry = root.FenceBoards.geometry(boardId);
    const cells = geometry.board.cells;
    const verts = [];
    const index = new Map();
    const vid = (p) => {
      const k = vertexKey(p);
      let i = index.get(k);
      if (i === undefined) {
        i = verts.length;
        index.set(k, i);
        verts.push({ x: p.x, y: p.y });
      }
      return i;
    };
    const cellVerts = new Map();
    const tris = [];
    for (const cell of cells) {
      const ids = cell.vertices.map(vid);
      cellVerts.set(cell.key, ids);
      for (let i = 1; i + 1 < ids.length; i += 1) tris.push(ids[0], ids[i], ids[i + 1]);
    }
    // Edges of exactly one cell form the outline; walk them as one loop.
    const uses = new Map();
    for (const ids of cellVerts.values()) {
      for (let i = 0; i < ids.length; i += 1) {
        const a = ids[i];
        const b = ids[(i + 1) % ids.length];
        const k = a < b ? a + "," + b : b + "," + a;
        const hit = uses.get(k);
        if (hit) hit.n += 1;
        else uses.set(k, { a, b, n: 1 });
      }
    }
    const around = new Map();
    for (const e of uses.values()) {
      if (e.n !== 1) continue;
      if (!around.has(e.a)) around.set(e.a, []);
      if (!around.has(e.b)) around.set(e.b, []);
      around.get(e.a).push(e.b);
      around.get(e.b).push(e.a);
    }
    const loop = [];
    const first = around.keys().next().value;
    if (first !== undefined) {
      let prev = -1;
      let cur = first;
      while (loop.length <= around.size) {
        loop.push(cur);
        const nb = around.get(cur) || [];
        const nxt = nb[0] !== prev ? nb[0] : nb[1];
        prev = cur;
        cur = nxt;
        if (cur === first || cur === undefined) break;
      }
    }
    const b = geometry.board.bounds;
    const mesh = { geometry, verts, index, cellVerts, tris, loop, bounds: b };
    meshes.set(boardId, mesh);
    return mesh;
  }

  /* --------------------------------------------------------------- WebGL */

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function createGL(canvas) {
    const attrs = { alpha: true, antialias: true, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false };
    let gl = null;
    try {
      gl = canvas.getContext("webgl", attrs) || canvas.getContext("experimental-webgl", attrs);
    } catch (e) {
      gl = null;
    }
    if (!gl) return null;
    const vs = compile(gl, gl.VERTEX_SHADER, VS);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.deleteProgram(prog);
      return null;
    }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    return {
      gl,
      prog,
      tex,
      vbuf: gl.createBuffer(),
      ibuf: gl.createBuffer(),
      count: 0,
      texW: 0,
      texH: 0,
      loc: {
        aPos: gl.getAttribLocation(prog, "aPos"),
        aWorld: gl.getAttribLocation(prog, "aWorld"),
        uSize: gl.getUniformLocation(prog, "uSize"),
        uH: gl.getUniformLocation(prog, "uH"),
        uTex: gl.getUniformLocation(prog, "uTex"),
        uOut: gl.getUniformLocation(prog, "uOut"),
      },
    };
  }

  function releaseGL(g) {
    if (!g) return;
    const gl = g.gl;
    try {
      gl.deleteTexture(g.tex);
      gl.deleteBuffer(g.vbuf);
      gl.deleteBuffer(g.ibuf);
      gl.deleteProgram(g.prog);
      const lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
    } catch (e) {
      /* the context is gone already */
    }
  }

  /* ---------------------------------------------------------- homographies */

  function mul3(A, B) {
    const out = new Array(9);
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        out[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
      }
    }
    return out;
  }

  function apply3(H, x, y) {
    const w = H[6] * x + H[7] * y + H[8];
    return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w, w };
  }

  // The affine map sending triangle (a, b, c) onto triangle (p, q, r), as
  // canvas transform arguments, or null for a flat triangle.
  function affine(a, b, c, p, q, r) {
    const det = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
    if (!det || !isFinite(det)) return null;
    const ia = (c.y - a.y) / det;
    const ib = -(c.x - a.x) / det;
    const ic = -(b.y - a.y) / det;
    const id = (b.x - a.x) / det;
    const m11 = (q.x - p.x) * ia + (r.x - p.x) * ic;
    const m12 = (q.x - p.x) * ib + (r.x - p.x) * id;
    const m21 = (q.y - p.y) * ia + (r.y - p.y) * ic;
    const m22 = (q.y - p.y) * ib + (r.y - p.y) * id;
    return [m11, m21, m12, m22, p.x - m11 * a.x - m12 * a.y, p.y - m21 * a.x - m22 * a.y];
  }

  /* ---------------------------------------------------------------- open */

  function open(options) {
    const o = options || {};
    const host = o.host;
    const boardId = o.boardId;
    const doc = typeof document !== "undefined" ? document : null;
    const s = {
      closed: false,
      state: "",
      token: 0, // bumps to cancel a camera start that is still waiting
      startToken: -1, // token of the start in progress
      loop: 0, // bumps to cancel a running frame loop
      stream: null,
      track: null,
      tracker: null,
      busy: false,
      tokens: READ_BURST, // reads allowed now (refilled at READS_PER_SECOND)
      tokensAt: 0,
      lastVideoTime: -1,
      readFails: 0,
      result: null, // last result read for this board
      locked: false,
      lastGoodAt: 0,
      steadySince: 0,
      held: false,
      delivered: null, // the last piece set handed over
      shown: null, // what the straightened view shows: { H, pw, ph, frame }
      frames: [null, null], // full-size copies of camera frames (two, so the one shown stays intact)
      nextFrame: 0,
      small: null,
      proc: null,
      crop: null, // the part of the shown frame around the board, for the texture
      gl: null,
      ctx2d: null,
      mode: "", // "gl" or "2d"
      cssW: 0,
      cssH: 0,
      hv: null, // host positions of the mesh vertices (x, y pairs, CSS pixels)
      centre: { x: 0, y: 0 },
      cellPx: 0,
      mesh2d: null,
      anim: 0,
      findTimer: 0,
      announced: "",
      hostPosition: null,
      listeners: [],
      observer: null,
      relayoutQueued: 0,
    };
    const handle = { close, refresh };

    // Every callback runs later, in order, never inside open() or a draw.
    function later(fn) {
      Promise.resolve().then(() => {
        try {
          fn();
        } catch (e) {
          /* nothing else depends on it */
        }
      });
    }
    function call(name, ...args) {
      const fn = o[name];
      if (typeof fn !== "function") return;
      later(() => {
        if (name === "onPlacements" && s.closed) return;
        try {
          fn(...args);
        } catch (e) {
          /* the page's own handler failed; the camera carries on */
        }
      });
    }

    if (!doc || !host || typeof host.appendChild !== "function" || typeof o.worldToHost !== "function") {
      s.closed = true;
      call("onState", "error:unsupported");
      call("onClose");
      return handle;
    }

    /* ------------------------------------------------------------ the DOM */

    const make = (tag, cls) => {
      const e = doc.createElement(tag);
      if (cls) e.className = cls;
      return e;
    };
    const wrap = make("div", "fc-inboard");
    wrap.dataset.state = "starting";
    wrap.dataset.board = String(boardId || "");
    const video = make("video", "fc-inboard-video");
    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.setAttribute("disablepictureinpicture", "");
    video.setAttribute("aria-hidden", "true");
    let view = make("canvas", "fc-inboard-view");
    view.setAttribute("aria-hidden", "true");
    const over = make("canvas", "fc-inboard-over");
    over.setAttribute("aria-hidden", "true");
    const veil = make("div", "fc-inboard-veil");
    veil.setAttribute("aria-hidden", "true");
    const shield = make("div", "fc-inboard-shield");
    shield.setAttribute("aria-hidden", "true");
    const busyIcon = make("span", "fc-inboard-busy");
    busyIcon.setAttribute("aria-hidden", "true");
    busyIcon.innerHTML = ICONS.camera;
    const act = make("button", "fc-inboard-act");
    act.type = "button";
    act.hidden = true;
    const label = make("div", "fc-inboard-sr");
    label.setAttribute("role", "img");
    const live = make("p", "fc-inboard-sr");
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    wrap.append(video, view, veil, over, shield, busyIcon, act, label, live);

    let mesh = null;
    try {
      if (supported() && root.FenceBoards.get(boardId)) mesh = boardMesh(boardId);
    } catch (e) {
      mesh = null;
    }

    try {
      if (root.getComputedStyle && root.getComputedStyle(host).position === "static") {
        s.hostPosition = host.style.position;
        host.style.position = "relative";
      }
    } catch (e) {
      /* the host keeps its own positioning */
    }
    host.appendChild(wrap);

    const reduceMotion = root.matchMedia ? root.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

    function listen(target, type, fn, opts) {
      if (!target || typeof target.addEventListener !== "function") return;
      target.addEventListener(type, fn, opts);
      s.listeners.push(() => target.removeEventListener(type, fn, opts));
    }

    /* ----------------------------------------------------------- states */

    function setState(next) {
      if (s.closed && next !== "stopped") return;
      if (s.state === next) return;
      s.state = next;
      wrap.dataset.state = next;
      paintControls();
      call("onState", next);
    }

    // What the window shows: "camera" (the picture cut to the board) or
    // "board" (the straightened paper board).
    function setView(which) {
      wrap.dataset.view = which;
    }

    function paintControls() {
      const st = s.state;
      const err = st.indexOf("error:") === 0;
      busyIcon.hidden = st !== "starting";
      act.hidden = !(err || st === "stopped") || s.closed;
      if (err) {
        act.innerHTML = ICONS.off;
        act.setAttribute("aria-label", t("cam.retry"));
        act.title = t("cam.in." + st.slice(6)) || t("cam.retry");
      } else if (st === "stopped") {
        act.innerHTML = ICONS.play;
        act.setAttribute("aria-label", t("cam.resume"));
        act.title = t("cam.resume");
      }
      label.setAttribute("aria-label", t("cam.videoLabel"));
    }

    // One polite line for screen readers; the window itself has no text.
    function say(text) {
      if (o.announce === false || !text || text === s.announced) return;
      s.announced = text;
      const line = doc.createElement("span");
      line.textContent = text + " ";
      live.appendChild(line);
      while (live.childNodes.length > 3) live.removeChild(live.firstChild);
    }

    function announceFind() {
      clearTimeout(s.findTimer);
      s.findTimer = setTimeout(() => {
        if (!s.closed && s.state === "searching") say(t("cam.s.find"));
      }, FIND_ANNOUNCE_MS);
    }

    /* ----------------------------------------------------------- camera */

    function errorKind(err) {
      const name = (err && err.name) || "";
      if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "denied";
      if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "busy";
      if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "none";
      return "unsupported";
    }

    function fail(kind) {
      stopTracks();
      unlock();
      setView("camera");
      setState("error:" + kind);
      say(t("cam.in." + kind));
      drawOverlay();
    }

    function stopStream(stream) {
      if (!stream) return;
      stream.getTracks().forEach((tr) => tr.stop());
      if (s.stream === stream) {
        s.stream = null;
        s.track = null;
      }
      if (video.srcObject === stream) video.srcObject = null;
    }

    function stopTracks() {
      s.loop += 1;
      s.token += 1;
      s.busy = false;
      if (s.stream) s.stream.getTracks().forEach((tr) => tr.stop());
      s.stream = null;
      s.track = null;
      if (video.srcObject) {
        try {
          video.pause();
        } catch (e) {
          /* nothing to pause */
        }
        video.srcObject = null;
      }
    }

    async function startCamera() {
      if (s.closed) return;
      if (!mesh || !supported()) {
        fail("unsupported");
        return;
      }
      if (s.state === "starting" && s.startToken === s.token) return; // a start is already waiting
      // Each start has its own token: one overtaken (the page hidden, the
      // window closed) stops its own stream when it finally arrives.
      const token = ++s.token;
      s.startToken = token;
      s.loop += 1;
      unlock();
      setView("camera");
      setState("starting");
      say(t("cam.starting"));
      drawOverlay();
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
      } catch (err) {
        if (token === s.token && !s.closed) fail(errorKind(err));
        return;
      }
      if (token !== s.token || s.closed) {
        stopStream(stream);
        return;
      }
      if (s.stream && s.stream !== stream) stopStream(s.stream);
      s.stream = stream;
      s.track = stream.getVideoTracks()[0] || null;
      if (s.track) {
        s.track.addEventListener("ended", () => {
          if (s.stream === stream && !s.closed) suspend();
        });
      }
      video.srcObject = stream;
      let played = true;
      try {
        await video.play();
      } catch (e) {
        played = false; // the browser wants a tap before the picture plays
      }
      if (token === s.token && !video.videoWidth) {
        await new Promise((resolve) => {
          const done = () => {
            video.removeEventListener("loadedmetadata", done);
            resolve();
          };
          video.addEventListener("loadedmetadata", done);
          setTimeout(done, 3000);
        });
      }
      if (token !== s.token || s.closed || s.stream !== stream) {
        stopStream(stream);
        return;
      }
      s.startToken = -1;
      try {
        if (!s.tracker) s.tracker = root.FenceCamera.createTracker({ boardId });
        else if (s.tracker.reset) s.tracker.reset();
      } catch (e) {
        fail("unsupported");
        return;
      }
      s.result = null;
      s.readFails = 0;
      s.held = false;
      s.steadySince = 0;
      if (!played) {
        setState("stopped");
        drawOverlay();
        return;
      }
      goLive();
    }

    function goLive() {
      setView("camera");
      setState("searching");
      announceFind();
      drawOverlay();
      runLoop();
    }

    // The page is hidden or left: the camera stops; a tap starts it again.
    function suspend() {
      if (s.closed) return;
      const was = s.state;
      stopTracks();
      if (was.indexOf("error:") === 0) return;
      setState("stopped");
      say(t("cam.s.stopped"));
      drawOverlay();
    }

    function resume() {
      if (s.closed) return;
      if (s.state === "stopped" && s.stream && s.track && s.track.readyState === "live") {
        // the picture only waited for a tap
        const stream = s.stream;
        video.play().then(
          () => {
            if (!s.closed && s.stream === stream && s.state === "stopped") goLive();
          },
          () => {}
        );
        return;
      }
      if (s.state === "stopped" || s.state.indexOf("error:") === 0) startCamera();
    }

    /* ------------------------------------------------------- frame loop */

    // One read at a time, about 15 per second on average: a 15 fps camera is
    // read frame by frame, a faster one every other frame or so.
    function runLoop() {
      const token = ++s.loop;
      const useVFC = typeof video.requestVideoFrameCallback === "function";
      s.tokens = READ_BURST;
      s.tokensAt = performance.now();
      const next = () => {
        if (token !== s.loop || s.closed) return;
        if (useVFC) video.requestVideoFrameCallback(tick);
        else requestAnimationFrame(tick);
      };
      const tick = () => {
        if (token !== s.loop || s.closed) return;
        const now = performance.now();
        s.tokens = Math.min(READ_BURST, s.tokens + ((now - s.tokensAt) * READS_PER_SECOND) / 1000);
        s.tokensAt = now;
        const fresh = useVFC || video.currentTime !== s.lastVideoTime;
        if (fresh && !s.busy && s.tokens >= 1 && video.readyState >= 2 && video.videoWidth > 0) {
          s.tokens -= 1;
          s.lastVideoTime = video.currentTime;
          readFrame(now, token);
        }
        next();
      };
      next();
    }

    function canvasOf(holder, w, h, opts) {
      if (!holder) {
        const canvas = doc.createElement("canvas");
        holder = { canvas, ctx: canvas.getContext("2d", opts), w: 0, h: 0 };
      }
      if (holder.w !== w || holder.h !== h) {
        holder.canvas.width = holder.w = w;
        holder.canvas.height = holder.h = h;
      }
      return holder;
    }

    // Copy the frame once at full size: the straightened view and the reading
    // then come from the very same picture. The reading gets a small copy
    // (at most PROCESS_LONG_SIDE), scaled down by the browser as on the camera page.
    function grab() {
      const w = video.videoWidth;
      const h = video.videoHeight;
      const i = s.nextFrame;
      s.frames[i] = canvasOf(s.frames[i], w, h, { alpha: false });
      const frame = s.frames[i];
      frame.ctx.drawImage(video, 0, 0, w, h);
      const scale = Math.min(1, PROCESS_LONG_SIDE / Math.max(w, h));
      const pw = Math.max(1, Math.round(w * scale));
      const ph = Math.max(1, Math.round(h * scale));
      const resized = !s.proc || s.proc.w !== pw || s.proc.h !== ph;
      s.small = canvasOf(s.small, pw, ph, { alpha: false });
      s.proc = canvasOf(s.proc, pw, ph, { willReadFrequently: true });
      if (resized && s.tracker && s.tracker.reset) s.tracker.reset();
      s.small.ctx.drawImage(frame.canvas, 0, 0, pw, ph);
      s.proc.ctx.drawImage(s.small.canvas, 0, 0);
      return { image: s.proc.ctx.getImageData(0, 0, pw, ph), frame, pw, ph };
    }

    function readFrame(now, token) {
      let got;
      let out = null;
      let failed = false;
      try {
        got = grab();
        out = s.tracker.process(got.image, { now });
      } catch (e) {
        out = null;
        failed = true;
      }
      if (out && typeof out.then === "function") {
        s.busy = true;
        out.then(
          (result) => {
            if (token !== s.loop || s.closed) return;
            s.busy = false;
            if (result) accept(result, got, performance.now());
          },
          () => {
            if (token !== s.loop || s.closed) return;
            s.busy = false;
            readFailed();
          }
        );
      } else if (out) {
        accept(out, got, now);
      } else if (failed) {
        readFailed();
      }
    }

    function readFailed() {
      s.readFails += 1;
      if (s.readFails >= READ_FAILS_MAX) fail("reader");
    }

    /* -------------------------------------------------------- results */

    function unlock() {
      s.locked = false;
      s.shown = null;
    }

    function accept(result, got, now) {
      s.readFails = 0;
      const ours = result.boardId === boardId;
      if (ours) s.result = result;
      const q = result.quality || {};
      const usable =
        ours && !!result.H &&
        (s.locked || (result.fresh && q.markerCount >= LOCK_MARKS && (q.reprojError == null || q.reprojError <= LOCK_ERROR)));
      if (usable) {
        s.lastGoodAt = now;
        s.shown = { H: result.H, pw: got.pw, ph: got.ph, frame: got.frame };
        s.nextFrame = s.frames.indexOf(got.frame) === 0 ? 1 : 0;
        drawView(true);
        if (!s.locked) {
          s.locked = true;
          setView("board");
          setState("locked");
          clearTimeout(s.findTimer);
          say(t("cam.boardFound") + " " + boardLabel(boardId));
        }
      } else if (s.locked && now - s.lastGoodAt > LOST_MS) {
        unlock();
        setView("camera");
        setState("searching");
        announceFind();
      }
      updateHeld(result, now);
      drawOverlay();
      deliver(result);
    }

    // While hands move over the board, or the paper has not settled, the
    // drawing shows the last steady state, dimmed.
    function updateHeld(result, now) {
      const busy = !result.H || result.fresh === false || result.handsLikely || !result.stable || result.boardId !== boardId;
      if (busy) {
        s.held = true;
        s.steadySince = 0;
      } else {
        if (!s.steadySince) s.steadySince = now;
        if (now - s.steadySince >= STEADY_MS) s.held = false;
      }
    }

    function deliver(result) {
      if (!s.locked || result.boardId !== boardId || !result.stable || !result.piecesComplete) return;
      if (result.unexplained && result.unexplained.size) return;
      if (!Array.isArray(result.pieces) || result.pieces.length === 0) return;
      const list = result.pieces.map((p) => ({ typeId: p.typeId, variantIndex: p.variantIndex, marker: Object.assign({}, p.marker) }));
      const sig = list
        .map((p) => JSON.stringify([p.typeId, p.variantIndex, p.marker]))
        .sort()
        .join("|");
      if (sig === s.delivered) return;
      s.delivered = sig;
      call("onPlacements", list, result);
    }

    /* ------------------------------------------------------------ layout */

    function refresh() {
      if (s.closed) return;
      s.relayoutQueued = 0;
      layout();
      drawView(false);
      drawOverlay();
    }

    function queueRefresh() {
      if (s.closed || s.relayoutQueued) return;
      s.relayoutQueued = requestAnimationFrame(refresh);
    }

    function hostPoint(p) {
      let q = null;
      try {
        q = o.worldToHost({ x: p.x, y: p.y });
      } catch (e) {
        q = null;
      }
      return q && isFinite(q.x) && isFinite(q.y) ? q : { x: NaN, y: NaN };
    }

    function layout() {
      const w = host.clientWidth;
      const h = host.clientHeight;
      const dpr = root.devicePixelRatio || 1;
      s.cssW = w;
      s.cssH = h;
      const bw = Math.max(1, Math.round(w * dpr));
      const bh = Math.max(1, Math.round(h * dpr));
      for (const c of [view, over]) {
        if (c.width !== bw) c.width = bw;
        if (c.height !== bh) c.height = bh;
      }
      if (!mesh || !w || !h) {
        s.hv = null;
        return;
      }
      const hv = new Float32Array(mesh.verts.length * 2);
      mesh.verts.forEach((p, i) => {
        const q = hostPoint(p);
        hv[2 * i] = q.x;
        hv[2 * i + 1] = q.y;
      });
      s.hv = hv;
      // The picture and the dark veil are cut to the board's outline; so is the
      // part of the window that catches taps (outside it, the page stays usable).
      const pts = mesh.loop.map((i) => hv[2 * i].toFixed(2) + "px " + hv[2 * i + 1].toFixed(2) + "px");
      const clip = pts.length >= 3 ? "polygon(" + pts.join(", ") + ")" : "";
      for (const e of [video, veil, shield]) {
        e.style.clipPath = clip;
        e.style.webkitClipPath = clip;
      }
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const i of mesh.loop) {
        x0 = Math.min(x0, hv[2 * i]);
        x1 = Math.max(x1, hv[2 * i]);
        y0 = Math.min(y0, hv[2 * i + 1]);
        y1 = Math.max(y1, hv[2 * i + 1]);
      }
      s.centre = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
      for (const e of [busyIcon, act]) {
        e.style.left = s.centre.x.toFixed(1) + "px";
        e.style.top = s.centre.y.toFixed(1) + "px";
      }
      // one cell's edge on screen, for the size of the leak rings
      const ids = mesh.cellVerts.get(mesh.geometry.board.cells[Math.floor(mesh.geometry.board.cells.length / 2)].key);
      s.cellPx = Math.hypot(hv[2 * ids[1]] - hv[2 * ids[0]], hv[2 * ids[1] + 1] - hv[2 * ids[0] + 1]);
      if (s.mode === "gl") uploadMesh();
      else s.mesh2d = null;
    }

    /* ------------------------------------------------ the straightened view */

    function setupView() {
      const g = createGL(view);
      if (g) {
        s.gl = g;
        s.mode = "gl";
        view.addEventListener("webglcontextlost", onContextLost);
        return;
      }
      useCanvas2D();
    }

    // Without WebGL (or once it is lost), triangles drawn with Canvas 2D.
    function useCanvas2D() {
      if (s.gl) {
        view.removeEventListener("webglcontextlost", onContextLost);
        s.gl = null;
        const fresh = make("canvas", "fc-inboard-view");
        fresh.setAttribute("aria-hidden", "true");
        fresh.width = view.width;
        fresh.height = view.height;
        wrap.replaceChild(fresh, view);
        view = fresh;
      }
      s.mode = "2d";
      s.ctx2d = view.getContext("2d");
      s.mesh2d = null;
    }

    function onContextLost(e) {
      e.preventDefault();
      if (s.closed) return;
      useCanvas2D();
      drawView(false);
    }

    function uploadMesh() {
      const g = s.gl;
      if (!g || !s.hv) return;
      const gl = g.gl;
      const n = mesh.verts.length;
      const data = new Float32Array(n * 4);
      for (let i = 0; i < n; i += 1) {
        data[4 * i] = s.hv[2 * i];
        data[4 * i + 1] = s.hv[2 * i + 1];
        data[4 * i + 2] = mesh.verts[i].x;
        data[4 * i + 3] = mesh.verts[i].y;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, g.vbuf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      if (!g.count) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.ibuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.tris), gl.STATIC_DRAW);
        g.count = mesh.tris.length;
      }
    }

    // Only the part of the frame around the board goes to the texture: a
    // whole camera frame can take tens of milliseconds to upload on some
    // browsers. Whole pixels, a size in steps of CROP_STEP (kept while it still
    // fits, so the texture is rarely made anew).
    function cropFor(sh, g) {
      const W = sh.frame.canvas.width;
      const Hh = sh.frame.canvas.height;
      const kx = W / sh.pw;
      const ky = Hh / sh.ph;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const i of mesh.loop) {
        const q = apply3(sh.H, mesh.verts[i].x, mesh.verts[i].y);
        if (!(q.w > 0)) return { x: 0, y: 0, w: W, h: Hh };
        // frame coordinates with pixel edges at whole numbers
        const x = (q.x + 0.5) * kx;
        const y = (q.y + 0.5) * ky;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
      x0 = Math.max(0, x0 - CROP_PAD);
      y0 = Math.max(0, y0 - CROP_PAD);
      x1 = Math.min(W, x1 + CROP_PAD);
      y1 = Math.min(Hh, y1 + CROP_PAD);
      if (!(x1 > x0 && y1 > y0)) return { x: 0, y: 0, w: W, h: Hh };
      let w = Math.min(W, Math.ceil((x1 - x0) / CROP_STEP) * CROP_STEP);
      let h = Math.min(Hh, Math.ceil((y1 - y0) / CROP_STEP) * CROP_STEP);
      if (g.texW >= w && g.texH >= h && g.texW <= Math.min(W, w + 2 * CROP_STEP) && g.texH <= Math.min(Hh, h + 2 * CROP_STEP)) {
        w = g.texW;
        h = g.texH;
      }
      const x = Math.max(0, Math.min(W - w, Math.floor((x0 + x1) / 2 - w / 2)));
      const y = Math.max(0, Math.min(Hh - h, Math.floor((y0 + y1) / 2 - h / 2)));
      return { x, y, w, h };
    }

    // H maps the world to pixels of the read frame (centres at whole
    // numbers); the texture holds the crop c of the full-size frame and wants
    // 0..1 across it.
    function worldToTexture(sh, c) {
      const kx = sh.frame.canvas.width / sh.pw;
      const ky = sh.frame.canvas.height / sh.ph;
      return mul3([kx / c.w, 0, (0.5 * kx - c.x) / c.w, 0, ky / c.h, (0.5 * ky - c.y) / c.h, 0, 0, 1], sh.H);
    }

    function drawView(newFrame) {
      const sh = s.shown;
      if (!sh || !s.hv || s.closed) return;
      if (s.mode === "gl") drawGL(sh, newFrame);
      else if (s.mode === "2d") draw2D(sh);
    }

    function drawGL(sh, newFrame) {
      const g = s.gl;
      const gl = g.gl;
      if (gl.isContextLost()) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, g.tex);
      if (newFrame || !g.texW) {
        const c = cropFor(sh, g);
        s.crop = canvasOf(s.crop, c.w, c.h, { alpha: false });
        s.crop.ctx.drawImage(sh.frame.canvas, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
        const src = s.crop.canvas;
        if (g.texW !== c.w || g.texH !== c.h) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
          g.texW = c.w;
          g.texH = c.h;
        } else {
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
        }
        g.crop = c;
      }
      if (!g.count) uploadMesh();
      gl.viewport(0, 0, view.width, view.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(g.prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.vbuf);
      gl.enableVertexAttribArray(g.loc.aPos);
      gl.vertexAttribPointer(g.loc.aPos, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(g.loc.aWorld);
      gl.vertexAttribPointer(g.loc.aWorld, 2, gl.FLOAT, false, 16, 8);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.ibuf);
      const M = worldToTexture(sh, g.crop);
      // (GLSL matrices are given column by column)
      gl.uniformMatrix3fv(g.loc.uH, false, new Float32Array([M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]]));
      gl.uniform2f(g.loc.uSize, s.cssW, s.cssH);
      gl.uniform1i(g.loc.uTex, 0);
      gl.uniform3f(g.loc.uOut, OUTSIDE[0] / 255, OUTSIDE[1] / 255, OUTSIDE[2] / 255);
      gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_SHORT, 0);
    }

    // Triangles for Canvas 2D: the cells' own, or a square mesh over the board
    // for boards with many cells (the outline clip keeps the board's shape).
    function mesh2d() {
      if (s.mesh2d) return s.mesh2d;
      const world = [];
      const hostPts = [];
      if (mesh.tris.length / 3 <= MESH_2D_MAX) {
        for (let i = 0; i < mesh.tris.length; i += 1) {
          const v = mesh.tris[i];
          world.push(mesh.verts[v]);
          hostPts.push({ x: s.hv[2 * v], y: s.hv[2 * v + 1] });
        }
      } else {
        const b = mesh.bounds;
        const n = MESH_2D_STEPS;
        const grid = [];
        for (let r = 0; r <= n; r += 1) {
          for (let c = 0; c <= n; c += 1) {
            const p = { x: b.minX + ((b.maxX - b.minX) * c) / n, y: b.minY + ((b.maxY - b.minY) * r) / n };
            grid.push({ p, h: hostPoint(p) });
          }
        }
        const at = (r, c) => grid[r * (n + 1) + c];
        for (let r = 0; r < n; r += 1) {
          for (let c = 0; c < n; c += 1) {
            for (const tri of [[at(r, c), at(r, c + 1), at(r + 1, c + 1)], [at(r, c), at(r + 1, c + 1), at(r + 1, c)]]) {
              for (const g of tri) {
                world.push(g.p);
                hostPts.push(g.h);
              }
            }
          }
        }
      }
      s.mesh2d = { world, host: hostPts };
      return s.mesh2d;
    }

    function outlinePath(ctx, sx, sy) {
      ctx.beginPath();
      mesh.loop.forEach((v, k) => {
        const x = s.hv[2 * v] * sx;
        const y = s.hv[2 * v + 1] * sy;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
    }

    function draw2D(sh) {
      const ctx = s.ctx2d;
      if (!ctx) return;
      const src = sh.frame.canvas;
      const sx = view.width / s.cssW;
      const sy = view.height / s.cssH;
      const kx = src.width / sh.pw;
      const ky = src.height / sh.ph;
      const m = mesh2d();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, view.width, view.height);
      ctx.save();
      outlinePath(ctx, sx, sy);
      ctx.clip();
      ctx.fillStyle = "rgb(" + OUTSIDE.join(",") + ")";
      ctx.fillRect(0, 0, view.width, view.height);
      ctx.imageSmoothingEnabled = true;
      for (let i = 0; i < m.world.length; i += 3) {
        const img = [];
        const dst = [];
        let ok = true;
        for (let k = 0; k < 3; k += 1) {
          const w = m.world[i + k];
          const q = apply3(sh.H, w.x, w.y);
          if (!(q.w > 0)) ok = false;
          // world -> frame canvas coordinates (pixel edges at whole numbers)
          img.push({ x: (q.x + 0.5) * kx, y: (q.y + 0.5) * ky });
          dst.push({ x: m.host[i + k].x * sx, y: m.host[i + k].y * sy });
        }
        if (!ok) continue;
        const T = affine(img[0], img[1], img[2], dst[0], dst[1], dst[2]);
        if (!T) continue;
        const cx = (dst[0].x + dst[1].x + dst[2].x) / 3;
        const cy = (dst[0].y + dst[1].y + dst[2].y) / 3;
        ctx.save();
        ctx.beginPath();
        dst.forEach((p, k) => {
          const d = Math.hypot(p.x - cx, p.y - cy) || 1;
          const x = p.x + ((p.x - cx) / d) * SEAM_PX;
          const y = p.y + ((p.y - cy) / d) * SEAM_PX;
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.clip();
        ctx.setTransform(T[0], T[1], T[2], T[3], T[4], T[5]);
        ctx.drawImage(src, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }

    /* ------------------------------------------------------------ overlay */

    function drawOverlay() {
      cancelAnimationFrame(s.anim);
      s.anim = 0;
      if (s.closed) return;
      const ctx = over.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, over.width, over.height);
      if (!s.hv || !s.cssW || !s.cssH) return;
      const sx = over.width / s.cssW;
      const sy = over.height / s.cssH;
      const px = (sx + sy) / 2;
      const P = (v) => ({ x: s.hv[2 * v] * sx, y: s.hv[2 * v + 1] * sy });
      const cellPath = (key) => {
        const ids = mesh.cellVerts.get(key);
        if (!ids) return false;
        ctx.beginPath();
        ids.forEach((v, k) => {
          const p = P(v);
          if (k === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        return true;
      };
      // Per cell, as the digital board draws them.
      const cells = (keys, fill, stroke, lw) => {
        for (const key of keys) {
          if (!cellPath(key)) continue;
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.strokeStyle = stroke;
          ctx.lineWidth = Math.max(0.7, lw * px);
          ctx.stroke();
        }
      };

      const a = s.locked && s.result ? s.result.analysis : null;
      // Cells in view that the kit's pieces do not explain: the state drawn
      // is the last one explained, held and dimmed, and it does not glow.
      const doubt = !!(s.result && s.result.unexplained && s.result.unexplained.size);
      let pulsing = false;
      if (a) {
        ctx.save();
        ctx.globalAlpha = s.held ? 0.4 : 1;
        if (a.enclosedSet && a.enclosedSet.size) {
          const clean = !a.cornerLeak && a.regionCount === 1;
          ctx.save();
          if (clean) {
            if (!doubt) {
              // the glow breathes slowly: no piece on the paper ever does
              const breath = reduceMotion.matches || s.held ? 0.5 : 0.5 + 0.5 * Math.sin((performance.now() / 1600) * Math.PI * 2);
              if (!reduceMotion.matches && !s.held) pulsing = true;
              ctx.shadowBlur = (10 + 14 * breath) * px;
              ctx.shadowColor = STYLE.fenceGlow;
            }
            cells(a.enclosedSet, STYLE.fenceFill, STYLE.fenceStroke, 2.2);
          } else {
            cells(a.enclosedSet, STYLE.mutedFill, STYLE.mutedStroke, 1.1);
          }
          ctx.restore();
        }
        if (a.leakCells && a.leakCells.size) {
          ctx.save();
          ctx.setLineDash([4 * px, 3 * px]);
          cells(a.leakCells, STYLE.leakFill, STYLE.leakStroke, 1.4);
          ctx.restore();
        }
        // Where the outside slips in: a ring with a bright core, so it reads by shape too.
        if (a.leakVertices && a.leakVertices.length) {
          const base = Math.max(9 * px, Math.min(18 * px, 0.4 * s.cellPx * px));
          const phase = reduceMotion.matches ? 0 : Math.sin((performance.now() / 1400) * Math.PI * 2);
          pulsing = !reduceMotion.matches && !s.held;
          const rr = base * (1 + 0.14 * phase);
          for (const w of a.leakVertices) {
            const i = mesh.index.get(vertexKey(w));
            const p = i !== undefined ? P(i) : (() => {
              const q = hostPoint(w);
              return { x: q.x * sx, y: q.y * sy };
            })();
            if (!isFinite(p.x) || !isFinite(p.y)) continue;
            ctx.beginPath();
            ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(7, 6, 10, 0.85)";
            ctx.lineWidth = 5 * px;
            ctx.stroke();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2.4 * px;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(p.x, p.y, rr * 0.42, 0, Math.PI * 2);
            ctx.fillStyle = "#ff3bd4";
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // Cells the kit's pieces do not explain (a crooked piece, a pencil on
      // the board): a soft pulse on them, so the player sees what to put
      // straight. Still when motion is reduced.
      if (s.locked && doubt) {
        const phase = reduceMotion.matches ? 1 : 0.5 + 0.5 * Math.sin((performance.now() / 1100) * Math.PI * 2);
        if (!reduceMotion.matches) pulsing = true;
        ctx.save();
        ctx.globalAlpha = 0.3 + 0.5 * phase;
        cells(s.result.unexplained, STYLE.doubtFill, STYLE.doubtStroke, 1.6);
        ctx.restore();
      }

      // The window's edge, in the colour of the board's outline.
      outlinePath(ctx, sx, sy);
      ctx.strokeStyle = STYLE.outline;
      ctx.lineWidth = 1.5 * px;
      ctx.lineJoin = "round";
      ctx.stroke();

      if (pulsing && s.state === "locked") s.anim = requestAnimationFrame(drawOverlay);
    }

    /* ------------------------------------------------------------- close */

    function close() {
      if (s.closed) return;
      stopTracks();
      s.closed = true;
      unlock();
      cancelAnimationFrame(s.anim);
      cancelAnimationFrame(s.relayoutQueued);
      clearTimeout(s.findTimer);
      s.listeners.forEach((off) => off());
      s.listeners = [];
      if (s.observer) s.observer.disconnect();
      s.observer = null;
      view.removeEventListener("webglcontextlost", onContextLost);
      releaseGL(s.gl);
      s.gl = null;
      s.ctx2d = null;
      s.tracker = null;
      s.frames = [null, null];
      s.small = null;
      s.proc = null;
      s.crop = null;
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      if (s.hostPosition !== null) host.style.position = s.hostPosition;
      s.state = "";
      setState("stopped");
      call("onClose");
    }

    /* ------------------------------------------------------------ wiring */

    act.addEventListener("click", (e) => {
      e.stopPropagation();
      resume();
    });
    // A tap anywhere on the stopped (or failed) window starts the camera again.
    shield.addEventListener("click", () => {
      if (s.state === "stopped" || s.state.indexOf("error:") === 0) resume();
    });
    listen(doc, "visibilitychange", () => {
      if (doc.visibilityState === "hidden") suspend();
    });
    listen(root, "pagehide", suspend);
    listen(root, "pageshow", (e) => {
      if (e.persisted && (s.state === "starting" || s.state === "searching" || s.state === "locked")) suspend();
    });
    listen(root, "resize", queueRefresh);
    listen(root, "orientationchange", queueRefresh);
    listen(doc, "fc-langchange", () => {
      paintControls();
    });
    listen(doc, "keydown", (e) => {
      if (e.key === "Escape" && !e.defaultPrevented) close();
    });
    if (reduceMotion && typeof reduceMotion.addEventListener === "function") {
      listen(reduceMotion, "change", () => drawOverlay());
    }
    if (typeof root.ResizeObserver === "function") {
      s.observer = new root.ResizeObserver(queueRefresh);
      s.observer.observe(host);
    }

    setView("camera");
    if (mesh) setupView();
    layout();
    paintControls();
    drawOverlay();
    if (!mesh || !supported()) {
      later(() => {
        if (!s.closed) fail("unsupported");
      });
      return handle;
    }
    // The tracker prepares the board's tables now, while the camera opens.
    setTimeout(() => {
      if (s.closed || s.tracker) return;
      try {
        s.tracker = root.FenceCamera.createTracker({ boardId });
      } catch (e) {
        s.tracker = null;
      }
    }, 0);
    startCamera();
    return handle;
  }

  return { open, supported };
});
