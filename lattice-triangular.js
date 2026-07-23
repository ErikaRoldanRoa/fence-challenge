

(function (globalScope) {
  "use strict";

  const SQRT3_HALF = Math.sqrt(3) / 2;

  const ROTATE_60 = { reflect: false, rot: 1 };
  const REFLECT = { reflect: true, rot: 0 };

  const SYMMETRIES = [];
  for (let rot = 0; rot < 6; rot += 1) SYMMETRIES.push({ reflect: false, rot });
  for (let rot = 0; rot < 6; rot += 1) SYMMETRIES.push({ reflect: true, rot });

  function cellKey(cell) {
    return `${cell.i},${cell.j},${cell.o}`;
  }

  function parseCellKey(key) {
    const [i, j, o] = key.split(",").map(Number);
    return { i, j, o };
  }

  function vertexKey(vertex) {
    return `${vertex.i},${vertex.j}`;
  }

  function cellSort(a, b) {
    return a.i - b.i || a.j - b.j || a.o - b.o;
  }

  function cellsKey(cells) {
    return [...cells]
      .sort(cellSort)
      .map((cell) => `${cell.i},${cell.j},${cell.o}`)
      .join("|");
  }

  function cellNeighbors(cell) {
    if (cell.o === 0) {
      return [
        { i: cell.i, j: cell.j, o: 1 },
        { i: cell.i, j: cell.j - 1, o: 1 },
        { i: cell.i - 1, j: cell.j, o: 1 },
      ];
    }
    return [
      { i: cell.i, j: cell.j, o: 0 },
      { i: cell.i, j: cell.j + 1, o: 0 },
      { i: cell.i + 1, j: cell.j, o: 0 },
    ];
  }

  function translateCell(relCell, marker) {
    return { i: relCell.i + marker.i, j: relCell.j + marker.j, o: relCell.o };
  }

  function bareCell(cell) {
    return { i: cell.i, j: cell.j, o: cell.o };
  }

  function cellToLatticeVertices(cell) {
    if (cell.o === 0) {
      return [
        { i: cell.i, j: cell.j },
        { i: cell.i + 1, j: cell.j },
        { i: cell.i, j: cell.j + 1 },
      ];
    }
    return [
      { i: cell.i + 1, j: cell.j + 1 },
      { i: cell.i + 1, j: cell.j },
      { i: cell.i, j: cell.j + 1 },
    ];
  }

  function latticeToWorld(point) {
    return { x: point.i + 0.5 * point.j, y: point.j * SQRT3_HALF };
  }

  function cellWorldVertices(cell) {
    return cellToLatticeVertices(cell).map(latticeToWorld);
  }

  function cellCentroidWorld(cell) {
    const v = cellWorldVertices(cell);
    return {
      x: (v[0].x + v[1].x + v[2].x) / 3,
      y: (v[0].y + v[1].y + v[2].y) / 3,
    };
  }

  function rotatePoint60(point) {
    return { i: -point.j, j: point.i + point.j };
  }

  function transformPoint(point, symmetry) {
    let transformed = { i: point.i, j: point.j };
    if (symmetry.reflect) {
      transformed = { i: transformed.i + transformed.j, j: -transformed.j };
    }
    for (let step = 0; step < symmetry.rot; step += 1) {
      transformed = rotatePoint60(transformed);
    }
    return transformed;
  }

  function vertsToCell(vertices) {
    const set = new Set(vertices.map((v) => `${v.i},${v.j}`));
    for (const v of vertices) {
      if (set.has(`${v.i + 1},${v.j}`) && set.has(`${v.i},${v.j + 1}`)) {
        return { i: v.i, j: v.j, o: 0 };
      }
    }
    for (const v of vertices) {
      if (set.has(`${v.i - 1},${v.j}`) && set.has(`${v.i},${v.j - 1}`)) {
        return { i: v.i - 1, j: v.j - 1, o: 1 };
      }
    }
    throw new Error("Invalid transformed cell");
  }

  function transformCell(cell, symmetry) {
    return vertsToCell(cellToLatticeVertices(cell).map((v) => transformPoint(v, symmetry)));
  }

  function normalizeCells(cells) {
    let minI = Number.POSITIVE_INFINITY;
    let minJ = Number.POSITIVE_INFINITY;
    for (const cell of cells) {
      for (const vertex of cellToLatticeVertices(cell)) {
        if (vertex.i < minI) minI = vertex.i;
        if (vertex.j < minJ) minJ = vertex.j;
      }
    }
    return cells
      .map((cell) => ({ i: cell.i - minI, j: cell.j - minJ, o: cell.o }))
      .sort(cellSort);
  }

  function canonicalizeShape(cells) {
    let bestKey = "";
    let bestCells = null;
    for (const symmetry of SYMMETRIES) {
      const transformed = cells.map((cell) => transformCell(cell, symmetry));
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
    const seed = [{ i: 0, j: 0, o: 0 }];
    let frontier = new Map();
    frontier.set(cellsKey(seed), seed);

    for (let size = 1; size < order; size += 1) {
      const next = new Map();
      for (const shape of frontier.values()) {
        const occupied = new Set(shape.map(cellKey));
        const candidates = new Map();
        for (const cell of shape) {
          for (const neighbor of cellNeighbors(cell)) {
            const key = cellKey(neighbor);
            if (occupied.has(key)) continue;
            candidates.set(key, neighbor);
          }
        }
        for (const candidate of candidates.values()) {
          const canonical = canonicalizeShape([...shape, candidate]);
          if (!next.has(canonical.key)) next.set(canonical.key, canonical.cells);
        }
      }
      frontier = next;
    }
    return [...frontier.values()];
  }

  function transformAnchoredVariant(variant, symmetry) {
    const transformed = variant.cells.map((cell) => transformCell(cell, symmetry));
    const markerTransformed = [...transformed].sort(cellSort)[0];
    const anchored = transformed.map((cell) => ({
      i: cell.i - markerTransformed.i,
      j: cell.j - markerTransformed.j,
      o: cell.o,
    }));
    return {
      key: cellsKey(anchored),
      cells: anchored.sort(cellSort),
      markerO: markerTransformed.o,
    };
  }

  function buildVariants(baseCells) {
    const marker = [...baseCells].sort(cellSort)[0];
    const unique = new Map();

    for (const symmetry of SYMMETRIES) {
      const transformedCells = baseCells.map((cell) => transformCell(cell, symmetry));
      const markerTransformed = [...transformedCells].sort(cellSort)[0];
      const anchored = transformedCells.map((cell) => ({
        i: cell.i - markerTransformed.i,
        j: cell.j - markerTransformed.j,
        o: cell.o,
      }));
      const key = cellsKey(anchored);
      if (!unique.has(key)) {
        unique.set(key, { key, cells: anchored.sort(cellSort), markerO: markerTransformed.o });
      }
    }

    const variants = [...unique.values()].sort((a, b) => a.key.localeCompare(b.key));
    const variantIndexByKey = new Map(variants.map((variant, index) => [variant.key, index]));
    const rotateMap = [];
    const flipMap = [];

    variants.forEach((variant, index) => {
      const rotated = transformAnchoredVariant(variant, ROTATE_60);
      const reflected = transformAnchoredVariant(variant, REFLECT);
      const r = variantIndexByKey.get(rotated.key);
      const f = variantIndexByKey.get(reflected.key);
      if (r === undefined || f === undefined) {
        throw new Error(
          `lattice-triangular buildVariants: orbit not closed at variant ${index} ` +
          `(rotate=${r === undefined ? "MISS" : r}, flip=${f === undefined ? "MISS" : f}). ` +
          `Anchoring is inconsistent; see the anchor-convention note above.`
        );
      }
      rotateMap[index] = r;
      flipMap[index] = f;
    });

    return { variants, rotateMap, flipMap };
  }

  function buildBoard(spec = {}) {
    const hexSide = spec.hexSide ?? 13; // hexiamond: 11 base + 2 extra layers
    const scanRange = hexSide + 4;

    const isInsideBoardHex = (v) => Math.max(Math.abs(v.i), Math.abs(v.j), Math.abs(v.i + v.j)) <= hexSide;
    const isBoundaryVertex = (v) => Math.max(Math.abs(v.i), Math.abs(v.j), Math.abs(v.i + v.j)) === hexSide;

    const cells = [];
    const map = new Map();
    const vertexToCellKeys = new Map();

    for (let i = -scanRange; i <= scanRange; i += 1) {
      for (let j = -scanRange; j <= scanRange; j += 1) {
        for (let o = 0; o <= 1; o += 1) {
          const cell = { i, j, o };
          const latticeVertices = cellToLatticeVertices(cell);
          if (!latticeVertices.every(isInsideBoardHex)) continue;
          const key = cellKey(cell);
          const entry = {
            key,
            i,
            j,
            o,
            latticeVertices,
            touchesBoundary: latticeVertices.some(isBoundaryVertex),
            centroid: cellCentroidWorld(cell),
            vertices: cellWorldVertices(cell),
          };
          cells.push(entry);
          map.set(key, entry);
          for (const vertex of latticeVertices) {
            const vKey = vertexKey(vertex);
            const linked = vertexToCellKeys.get(vKey);
            if (linked) linked.push(key);
            else vertexToCellKeys.set(vKey, [key]);
          }
        }
      }
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const entry of cells) {
      for (const v of entry.vertices) {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
      }
    }

    return {
      cells,
      map,
      bounds: { minX, maxX, minY, maxY },
      extras: { hexSide, vertexToCellKeys },
    };
  }

  function markerConstraint(variant, cell) {
    return cell.o === variant.markerO;
  }

  function regionNeighborKeys(key, candidateSet, board) {
    const reachable = new Set();
    const cell = parseCellKey(key);
    for (const neighbor of cellNeighbors(cell)) {
      const nKey = cellKey(neighbor);
      if (candidateSet.has(nKey)) reachable.add(nKey);
    }

    const entry = board.map.get(key);
    if (!entry) return reachable;
    for (const vertex of entry.latticeVertices) {
      const linked = board.extras.vertexToCellKeys.get(vertexKey(vertex));
      if (!linked) continue;
      for (const linkedKey of linked) {
        if (linkedKey !== key && candidateSet.has(linkedKey)) reachable.add(linkedKey);
      }
    }
    return reachable;
  }

  function regionSplitNeighborKeys(key, candidateSet) {
    const reachable = new Set();
    const cell = parseCellKey(key);
    for (const neighbor of cellNeighbors(cell)) {
      const nKey = cellKey(neighbor);
      if (candidateSet.has(nKey)) reachable.add(nKey);
    }
    return reachable;
  }

  const NEAREST_THRESHOLD_2 = 0.74 * 0.74;

  function findNearestBoardCell(worldPoint, board, accept = null) {
    let best = null;
    let bestDist2 = Number.POSITIVE_INFINITY;
    for (const entry of board.cells) {
      if (accept && !accept(entry)) continue;
      const dx = entry.centroid.x - worldPoint.x;
      const dy = entry.centroid.y - worldPoint.y;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < bestDist2) {
        bestDist2 = dist2;
        best = entry;
      }
    }
    return best && bestDist2 <= NEAREST_THRESHOLD_2 ? best : null;
  }

  const HEXIAMOND_CELLS = {
    H1: [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1], [0, 2, 0], [0, 2, 1]],
    H2: [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]],
    H3: [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1], [1, 1, 0], [1, 1, 1]],
  };

  const HEXIAMOND_NAMES = ["H1", "H2", "H3"];
  const HEXIAMOND_COLORS = { H1: "#2ff3ff", H2: "#b278ff", H3: "#ffd84a" };

  const HEXIAMOND_SET = {
    order: 6,
    prefix: "X",
    shapes: HEXIAMOND_NAMES.map((n) =>
      HEXIAMOND_CELLS[n].map(([i, j, o]) => ({ i, j, o }))
    ),
    build(shapes) {
      const byCanonical = new Map(
        HEXIAMOND_NAMES.map((n) => [
          canonicalizeShape(HEXIAMOND_CELLS[n].map(([i, j, o]) => ({ i, j, o }))).key,
          n,
        ])
      );
      return shapes.map((cells) => {
        const name = byCanonical.get(canonicalizeShape(cells).key);
        if (!name) throw new Error("lattice-triangular: unrecognised hexiamond shape.");
        return { id: name, name, cells, color: HEXIAMOND_COLORS[name] };
      });
    },
  };

  const TRI_BOARD_HEXSIDE_DEFAULT = 4;

  const latticeTriangular = {
    name: "triangular",
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
    HEXIAMOND_SET,
    BOARD_HEXSIDE_DEFAULT: TRI_BOARD_HEXSIDE_DEFAULT,
    _internals: {
      SYMMETRIES,
      ROTATE_60,
      REFLECT,
      transformCell,
      transformPoint,
      normalizeCells,
      canonicalizeShape,
      cellToLatticeVertices,
      latticeToWorld,
      vertexKey,
      vertsToCell,
    },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = latticeTriangular;
  } else {
    globalScope.LatticeTriangular = latticeTriangular;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
