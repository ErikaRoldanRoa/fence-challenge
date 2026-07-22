

(function (globalScope) {
  "use strict";

  const SQRT3 = Math.sqrt(3);

  const ROTATE_60 = { reflect: false, rot: 1 };
  const REFLECT = { reflect: true, rot: 0 };

  const SYMMETRIES = [];
  for (let rot = 0; rot < 6; rot += 1) SYMMETRIES.push({ reflect: false, rot });
  for (let rot = 0; rot < 6; rot += 1) SYMMETRIES.push({ reflect: true, rot });

  function cellKey(cell) {
    return `${cell.q},${cell.r}`;
  }

  function parseCellKey(key) {
    const [q, r] = key.split(",").map(Number);
    return { q, r };
  }

  function cellSort(a, b) {
    if (a.q !== b.q) return a.q - b.q;
    return a.r - b.r;
  }

  function cellsKey(cells) {
    return cells.slice().sort(cellSort).map(cellKey).join("|");
  }

  const HEX_NEIGHBOR_OFFSETS = [
    { dq: 1, dr: 0 },
    { dq: 1, dr: -1 },
    { dq: 0, dr: -1 },
    { dq: -1, dr: 0 },
    { dq: -1, dr: 1 },
    { dq: 0, dr: 1 },
  ];

  function cellNeighbors(cell) {
    return HEX_NEIGHBOR_OFFSETS.map(({ dq, dr }) => ({ q: cell.q + dq, r: cell.r + dr }));
  }

  function translateCell(relCell, marker) {
    return { q: relCell.q + marker.q, r: relCell.r + marker.r };
  }

  function bareCell(cell) {
    return { q: cell.q, r: cell.r };
  }

  function rotate60(cell) {
    return { q: -cell.r, r: cell.q + cell.r };
  }

  function reflectQ(cell) {
    return { q: cell.q + cell.r, r: -cell.r };
  }

  function applyRotN(cell, n) {
    let c = cell;
    for (let i = 0; i < ((n % 6) + 6) % 6; i++) c = rotate60(c);
    return c;
  }

  function transformCell(cell, sym) {
    let c = cell;
    if (sym.reflect) c = reflectQ(c);
    c = applyRotN(c, sym.rot);
    return c;
  }

  function normalizeCells(cells) {
    let bestQ = Infinity;
    let bestR = Infinity;
    for (const c of cells) {
      if (c.q < bestQ || (c.q === bestQ && c.r < bestR)) {
        bestQ = c.q;
        bestR = c.r;
      }
    }
    return cells.map((c) => ({ q: c.q - bestQ, r: c.r - bestR })).sort(cellSort);
  }

  function anchorAtLexMin(cells) {
    const sorted = cells.slice().sort(cellSort);
    const m = sorted[0];
    return sorted.map((c) => ({ q: c.q - m.q, r: c.r - m.r }));
  }

  function cellCentroidWorld(cell, S = 1) {
    return { x: S * 1.5 * cell.q, y: S * SQRT3 * (cell.r + cell.q / 2) };
  }

  function cellWorldVertices(cell, S = 1) {
    const { x, y } = cellCentroidWorld(cell, S);
    const out = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      out.push({ x: x + S * Math.cos(a), y: y + S * Math.sin(a) });
    }
    return out;
  }

  function pointToCell(px, py, S = 1) {
    const qFrac = ((2 / 3) * px) / S;
    const rFrac = ((-1 / 3) * px + (SQRT3 / 3) * py) / S;
    const sFrac = -qFrac - rFrac;
    let q = Math.round(qFrac);
    let r = Math.round(rFrac);
    const s = Math.round(sFrac);
    const dq = Math.abs(q - qFrac);
    const dr = Math.abs(r - rFrac);
    const ds = Math.abs(s - sFrac);
    if (dq > dr && dq > ds) q = -r - s;
    else if (dr > ds) r = -q - s;
    return { q, r };
  }

  function canonicalizeShape(cells) {
    let bestKey = "";
    let bestCells = null;
    for (const sym of SYMMETRIES) {
      const transformed = cells.map((c) => transformCell(c, sym));
      const normalized = normalizeCells(transformed);
      const key = cellsKey(normalized);
      if (!bestCells || key < bestKey) {
        bestKey = key;
        bestCells = normalized;
      }
    }
    return { key: bestKey, cells: bestCells };
  }

  function generateFreePolyforms(order) {
    const seed = [{ q: 0, r: 0 }];
    let frontier = new Map();
    frontier.set(cellsKey(seed), seed);

    for (let size = 1; size < order; size += 1) {
      const next = new Map();
      for (const shape of frontier.values()) {
        const occupied = new Set(shape.map(cellKey));
        const candidates = new Map();
        for (const cell of shape) {
          for (const nb of cellNeighbors(cell)) {
            const k = cellKey(nb);
            if (occupied.has(k)) continue;
            candidates.set(k, nb);
          }
        }
        for (const cand of candidates.values()) {
          const canonical = canonicalizeShape([...shape, cand]);
          if (!next.has(canonical.key)) next.set(canonical.key, canonical.cells);
        }
      }
      frontier = next;
    }
    return [...frontier.values()];
  }

  function buildVariants(baseCells) {
    const unique = new Map();
    for (const sym of SYMMETRIES) {
      const transformed = baseCells.map((c) => transformCell(c, sym));
      const anchored = anchorAtLexMin(transformed);
      const key = cellsKey(anchored);
      if (!unique.has(key)) unique.set(key, { key, cells: anchored });
    }

    const variants = [...unique.values()].sort((a, b) => a.key.localeCompare(b.key));
    const indexByKey = new Map(variants.map((v, i) => [v.key, i]));
    const rotateMap = [];
    const flipMap = [];

    variants.forEach((v, i) => {
      const rotKey = cellsKey(anchorAtLexMin(v.cells.map((c) => transformCell(c, ROTATE_60))));
      rotateMap[i] = indexByKey.has(rotKey) ? indexByKey.get(rotKey) : i;

      const flpKey = cellsKey(anchorAtLexMin(v.cells.map((c) => transformCell(c, REFLECT))));
      flipMap[i] = indexByKey.has(flpKey) ? indexByKey.get(flpKey) : i;
    });

    return { variants, rotateMap, flipMap };
  }

  function buildBoard(spec = {}) {
    const radius = spec.radius ?? 6; // polyhex: R=6 → 127 cells
    const cells = [];
    for (let q = -radius; q <= radius; q++) {
      const r1 = Math.max(-radius, -q - radius);
      const r2 = Math.min(radius, -q + radius);
      for (let r = r1; r <= r2; r++) {
        const cell = { q, r };
        cells.push({
          key: cellKey(cell),
          q,
          r,
          centroid: cellCentroidWorld(cell, 1),
          vertices: cellWorldVertices(cell, 1),
          touchesBoundary: false, // filled below
        });
      }
    }

    const map = new Map(cells.map((c) => [c.key, c]));
    for (const c of cells) {
      for (const nb of cellNeighbors(c)) {
        if (!map.has(cellKey(nb))) {
          c.touchesBoundary = true;
          break;
        }
      }
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const c of cells) {
      for (const v of c.vertices) {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
      }
    }

    return { cells, map, bounds: { minX, maxX, minY, maxY }, extras: { radius } };
  }

  function markerConstraint() {
    return true;
  }

  function regionNeighborKeys(key, candidateSet) {
    const reachable = new Set();
    for (const neighbor of cellNeighbors(parseCellKey(key))) {
      const nKey = cellKey(neighbor);
      if (candidateSet.has(nKey)) reachable.add(nKey);
    }
    return reachable;
  }

  function findNearestBoardCell(worldPoint, board, accept = null) {
    const guess = pointToCell(worldPoint.x, worldPoint.y, 1);
    const candidates = [guess, ...cellNeighbors(guess)];
    let best = null;
    let bestD2 = Infinity;
    for (const c of candidates) {
      const entry = board.map.get(cellKey(c));
      if (!entry) continue;
      if (accept && !accept(entry)) continue;
      const dx = entry.centroid.x - worldPoint.x;
      const dy = entry.centroid.y - worldPoint.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = entry;
      }
    }
    return best;
  }

  const TETRAHEX_CELLS = {
    bar:       [[0, 0], [0, 1], [0, 2], [0, 3]],
    worm:      [[0, 0], [0, 1], [0, 2], [1, -1]],
    pistol:    [[0, 0], [0, 1], [0, 2], [1, 0]],
    bee:       [[0, 0], [0, 1], [1, -1], [1, 0]],
    arc:       [[0, 0], [0, 1], [1, -1], [1, 1]],
    wave:      [[0, 0], [0, 1], [1, -2], [1, -1]],
    propeller: [[0, 0], [1, -2], [1, -1], [2, -1]],
  };

  const CARD_TETRAHEX_NAMES = ["arc", "bar", "wave", "worm"];

  const TETRAHEX_COLORS = {
    arc:  "#70ff7a",
    bar:  "#2de2d5",
    wave: "#ffd84a",
    worm: "#ff9d1e",
  };

  const TETRAHEX_SET = {
    order: 4,
    prefix: "H",
    shapes: CARD_TETRAHEX_NAMES.map((name) =>
      TETRAHEX_CELLS[name].map(([q, r]) => ({ q, r }))
    ),
    build(shapes) {
      const byCanonical = new Map(
        CARD_TETRAHEX_NAMES.map((name) => [
          canonicalizeShape(TETRAHEX_CELLS[name].map(([q, r]) => ({ q, r }))).key,
          name,
        ])
      );
      return shapes.map((cells) => {
        const name = byCanonical.get(canonicalizeShape(cells).key);
        if (!name) throw new Error("lattice-hex: unrecognised tetrahex shape.");
        return { id: name, name, cells, color: TETRAHEX_COLORS[name] };
      });
    },
  };

  const BOARD_RADIUS_DEFAULT = 4;

  const latticeHex = {
    name: "hexagonal",
    TETRAHEX_SET,
    TETRAHEX_CELLS,
    BOARD_RADIUS_DEFAULT,
    cellKey,
    parseCellKey,
    cellSort,
    cellsKey,
    cellNeighbors,
    translateCell,
    bareCell,
    cellCentroidWorld,
    cellWorldVertices,
    buildBoard,
    generateFreePolyforms,
    buildVariants,
    markerConstraint,
    regionNeighborKeys,
    findNearestBoardCell,
    _internals: {
      SYMMETRIES,
      ROTATE_60,
      REFLECT,
      HEX_NEIGHBOR_OFFSETS,
      transformCell,
      normalizeCells,
      anchorAtLexMin,
      canonicalizeShape,
      pointToCell,
    },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = latticeHex;
  } else {
    globalScope.LatticeHex = latticeHex;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
