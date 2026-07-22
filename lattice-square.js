

(function (globalScope) {
  "use strict";

  const SYMMETRIES = [];
  for (let rot = 0; rot < 4; rot += 1) SYMMETRIES.push({ reflect: false, rot });
  for (let rot = 0; rot < 4; rot += 1) SYMMETRIES.push({ reflect: true, rot });

  const ROTATE_90 = { reflect: false, rot: 1 };
  const REFLECT = { reflect: true, rot: 0 };

  const ORTHOGONAL_NEIGHBORS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];

  const EMPTY_SPACE_NEIGHBORS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  function cellKey(cell) {
    return `${cell.x},${cell.y}`;
  }

  function parseCellKey(key) {
    const [x, y] = key.split(",").map(Number);
    return { x, y };
  }

  function cellSort(a, b) {
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  }

  function cellsKey(cells) {
    return cells.slice().sort(cellSort).map(cellKey).join("|");
  }

  function cellNeighbors(cell) {
    return ORTHOGONAL_NEIGHBORS.map(([dx, dy]) => ({ x: cell.x + dx, y: cell.y + dy }));
  }

  function cellNeighbors8(cell) {
    return EMPTY_SPACE_NEIGHBORS.map(([dx, dy]) => ({ x: cell.x + dx, y: cell.y + dy }));
  }

  function translateCell(relCell, marker) {
    return { x: relCell.x + marker.x, y: relCell.y + marker.y };
  }

  function bareCell(cell) {
    return { x: cell.x, y: cell.y };
  }

  function rotate90(cell) {
    return { x: cell.y, y: -cell.x };
  }

  function reflectX(cell) {
    return { x: -cell.x, y: cell.y };
  }

  function transformCell(cell, sym) {
    let c = { x: cell.x, y: cell.y };
    if (sym.reflect) c = reflectX(c);
    const n = ((sym.rot % 4) + 4) % 4;
    for (let i = 0; i < n; i += 1) c = rotate90(c);
    return c;
  }

  function normalizeCells(cells) {
    let minX = Infinity;
    let minY = Infinity;
    for (const c of cells) {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
    }
    return cells.map((c) => ({ x: c.x - minX, y: c.y - minY })).sort(cellSort);
  }

  function anchorAtLexMin(cells) {
    const sorted = cells.slice().sort(cellSort);
    const m = sorted[0];
    return sorted.map((c) => ({ x: c.x - m.x, y: c.y - m.y }));
  }

  function cellCentroidWorld(cell) {
    return { x: cell.x, y: cell.y };
  }

  function cellWorldVertices(cell) {
    const { x, y } = cell;
    return [
      { x: x - 0.5, y: y - 0.5 },
      { x: x + 0.5, y: y - 0.5 },
      { x: x + 0.5, y: y + 0.5 },
      { x: x - 0.5, y: y + 0.5 },
    ];
  }

  function pointToCell(px, py) {
    return { x: Math.round(px), y: Math.round(py) };
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
    const seed = [{ x: 0, y: 0 }];
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
      const rotKey = cellsKey(anchorAtLexMin(v.cells.map((c) => transformCell(c, ROTATE_90))));
      rotateMap[i] = indexByKey.has(rotKey) ? indexByKey.get(rotKey) : i;

      const flpKey = cellsKey(anchorAtLexMin(v.cells.map((c) => transformCell(c, REFLECT))));
      flipMap[i] = indexByKey.has(flpKey) ? indexByKey.get(flpKey) : i;
    });

    return { variants, rotateMap, flipMap };
  }

  const BOARD_SIZE_DEFAULT = 9;

  function buildBoard(spec = {}) {
    const size = spec.size ?? BOARD_SIZE_DEFAULT;
    const cells = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const cell = { x, y };
        cells.push({
          key: cellKey(cell),
          x,
          y,
          centroid: cellCentroidWorld(cell),
          vertices: cellWorldVertices(cell),
          touchesBoundary: x === 0 || y === 0 || x === size - 1 || y === size - 1,
        });
      }
    }

    const map = new Map(cells.map((c) => [c.key, c]));

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

    return { cells, map, bounds: { minX, maxX, minY, maxY }, extras: { size } };
  }

  function markerConstraint() {
    return true;
  }

  function regionNeighborKeys(key, candidateSet) {
    const reachable = new Set();
    for (const neighbor of cellNeighbors8(parseCellKey(key))) {
      const nKey = cellKey(neighbor);
      if (candidateSet.has(nKey)) reachable.add(nKey);
    }
    return reachable;
  }

  function regionSplitNeighborKeys(key, candidateSet) {
    const reachable = new Set();
    for (const neighbor of cellNeighbors(parseCellKey(key))) {
      const nKey = cellKey(neighbor);
      if (candidateSet.has(nKey)) reachable.add(nKey);
    }
    return reachable;
  }

  function findNearestBoardCell(worldPoint, board, accept = null) {
    const guess = pointToCell(worldPoint.x, worldPoint.y);
    const candidates = [guess, ...cellNeighbors8(guess)];
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

  const TETROMINO_CELLS = {
    i: [[0, 0], [1, 0], [2, 0], [3, 0]],
    l: [[0, 0], [0, 1], [0, 2], [1, 2]],
    n: [[0, 0], [0, 1], [1, 1], [1, 2]],
    o: [[0, 0], [1, 0], [0, 1], [1, 1]],
    t: [[0, 0], [1, 0], [2, 0], [1, 1]],
  };

  const TETROMINO_NAMES = ["i", "l", "n", "o", "t"];

  const TETROMINO_COLORS = {
    i: "#ff5b7f",
    l: "#ff9d1e",
    n: "#2de2d5",
    o: "#7f83ff",
    t: "#ffd84a",
  };

  const TETROMINO_SET = {
    order: 4,
    prefix: "T",
    shapes: TETROMINO_NAMES.map((name) =>
      TETROMINO_CELLS[name].map(([x, y]) => ({ x, y }))
    ),
    build(shapes) {
      const byCanonical = new Map(
        TETROMINO_NAMES.map((name) => [
          canonicalizeShape(TETROMINO_CELLS[name].map(([x, y]) => ({ x, y }))).key,
          name,
        ])
      );
      return shapes.map((cells) => {
        const name = byCanonical.get(canonicalizeShape(cells).key);
        if (!name) throw new Error("lattice-square: unrecognised tetromino shape.");
        return { id: name, name, cells, color: TETROMINO_COLORS[name] };
      });
    },
  };

  const latticeSquare = {
    name: "square",
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
    regionSplitNeighborKeys,
    findNearestBoardCell,
    TETROMINO_SET,
    BOARD_SIZE_DEFAULT,
    _internals: {
      SYMMETRIES,
      ROTATE_90,
      REFLECT,
      ORTHOGONAL_NEIGHBORS,
      EMPTY_SPACE_NEIGHBORS,
      cellNeighbors8,
      transformCell,
      normalizeCells,
      anchorAtLexMin,
      canonicalizeShape,
      pointToCell,
      TETROMINO_CELLS,
      TETROMINO_NAMES,
      TETROMINO_COLORS,
    },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = latticeSquare;
  } else {
    globalScope.LatticeSquare = latticeSquare;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
