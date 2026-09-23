/* Fence Challenge · what a set of placed pieces encloses.
 *
 * Works on any board built by a lattice module (square, hexagonal,
 * triangular) and on any set of occupied cell keys, so the digital board
 * and the camera judge a fence with exactly the same rule. The rule is the
 * one of the paper: the free cells, together with everything beyond the
 * board, must form exactly two edge-connected parts (one inside, one
 * outside) that do not even share a corner.
 *
 *   - the outside floods in from beyond the board through every empty cell
 *     it can reach, passing through shared edges AND shared corners
 *     (lattice.regionNeighborKeys); it starts from every empty cell that
 *     touches the board's rim, even at a single corner;
 *   - the empty cells it cannot reach are enclosed;
 *   - a second flood through shared edges only
 *     (lattice.regionSplitNeighborKeys, or regionNeighborKeys when the
 *     lattice has no corner-only contacts, as on hexagons) starts only from
 *     the empty cells with a whole edge on the rim; the cells the first
 *     flood reaches and this one does not are where the outside slips in
 *     through a corner ("leak" cells). On triangles this includes a rim
 *     triangle that touches the rim only at its tip;
 *   - insides are counted as edge-connected regions of the enclosed cells.
 *
 * analyze({ board, lattice, occupied }) returns
 *   area          number of enclosed cells
 *   enclosedSet   Set of enclosed cell keys (board order)
 *   regionCount   number of edge-connected insides
 *   largestRegion size of the largest inside
 *   regions       Array<Set> of those insides
 *   cornerLeak    true when some cell is reached only through a corner
 *   leakCells     Set of those cells (board order)
 *   leakCount     leakCells.size
 *   outsideSet    Set of empty cells the outside reaches (corners included)
 *   leakVertices  Array<{x,y}>: world points where a leak cell touches, only
 *                 at that point, an empty cell of another edge-connected
 *                 empty region or the space beyond the board, that is where
 *                 the fence is open at a corner. Each point appears once.
 */
(function (globalScope) {
  "use strict";

  // Per board: cell order, where the outside comes in, neighbour lists as
  // indices, and a vertex index. Built once, reused on every call (the
  // camera calls this on every frame).
  const prepared = new WeakMap();

  function neighborIndexLists(fn, keys, index, all, board) {
    return keys.map((key) => {
      const out = [];
      for (const nKey of fn(key, all, board)) {
        const j = index.get(nKey);
        if (j !== undefined) out.push(j);
      }
      return Int32Array.from(out);
    });
  }

  function prepare(board, lattice) {
    const cached = prepared.get(board);
    if (cached && cached.lattice === lattice) return cached;

    const cells = board.cells;
    const n = cells.length;
    const keys = cells.map((entry) => entry.key);
    const index = new Map(keys.map((key, i) => [key, i]));
    const all = new Set(keys);

    // Where the outside comes in: through a whole edge on the rim (both
    // floods), or through a single rim corner (the flood through corners
    // only; on triangles, a rim triangle can touch the rim at its tip alone).
    const seedEdge = new Uint8Array(n);
    const seedCorner = new Uint8Array(n);
    cells.forEach((entry, i) => {
      const edgeOnRim = lattice.cellNeighbors(entry).some((nb) => !board.map.has(lattice.cellKey(nb)));
      if (edgeOnRim) seedEdge[i] = 1;
      if (edgeOnRim || entry.touchesBoundary) seedCorner[i] = 1;
    });

    const cornerFn = lattice.regionNeighborKeys;
    const edgeFn = lattice.regionSplitNeighborKeys || lattice.regionNeighborKeys;
    const corner = neighborIndexLists(cornerFn, keys, index, all, board);
    const edge = edgeFn === cornerFn ? corner : neighborIndexLists(edgeFn, keys, index, all, board);
    // (on hexagons both floods are one and the same)
    const oneFlood = edge === corner && seedEdge.every((v, i) => v === seedCorner[i]);

    const prep = {
      lattice,
      n,
      keys,
      seedEdge,
      seedCorner,
      oneFlood,
      corner,
      edge,
      vertices: null, // built on first leak
      // scratch buffers reused between calls
      empty: new Uint8Array(n),
      reachCorner: new Uint8Array(n),
      reachEdge: new Uint8Array(n),
      mark: new Int32Array(n),
      queue: new Int32Array(n),
    };
    prepared.set(board, prep);
    return prep;
  }

  // Vertex index: world points of every cell, matched by rounded coordinates
  // so it works for any lattice drawn by cellWorldVertices, and the points
  // on the board's rim (ends of the edges that only one cell has).
  function vertexKey(p) {
    return Math.round(p.x * 1e6) + "," + Math.round(p.y * 1e6);
  }

  function prepareVertices(prep, board, lattice) {
    if (prep.vertices) return prep.vertices;
    const cellsAt = new Map();
    const edgeCount = new Map();
    const cellVertices = board.cells.map((entry, i) => {
      const pts = lattice.cellWorldVertices ? lattice.cellWorldVertices(entry) : entry.vertices;
      const list = pts.map((p) => {
        const key = vertexKey(p);
        let at = cellsAt.get(key);
        if (!at) {
          at = [];
          cellsAt.set(key, at);
        }
        at.push(i);
        return { key, x: p.x, y: p.y };
      });
      list.forEach((v, k) => {
        const w = list[(k + 1) % list.length];
        const e = v.key < w.key ? v.key + "|" + w.key : w.key + "|" + v.key;
        edgeCount.set(e, (edgeCount.get(e) || 0) + 1);
      });
      return list;
    });
    const rim = new Set();
    for (const [e, count] of edgeCount) {
      if (count !== 1) continue;
      const [a, b] = e.split("|");
      rim.add(a);
      rim.add(b);
    }
    prep.vertices = { cellsAt, cellVertices, rim };
    return prep.vertices;
  }

  function flood(prep, seed, adj, reached) {
    const { n, empty, queue } = prep;
    reached.fill(0);
    let head = 0;
    let tail = 0;
    for (let i = 0; i < n; i += 1) {
      if (empty[i] && seed[i]) {
        reached[i] = 1;
        queue[tail++] = i;
      }
    }
    while (head < tail) {
      const list = adj[queue[head++]];
      for (let k = 0; k < list.length; k += 1) {
        const j = list[k];
        if (!empty[j] || reached[j]) continue;
        reached[j] = 1;
        queue[tail++] = j;
      }
    }
  }

  function analyze(input) {
    const { board, lattice, occupied } = input || {};
    if (!board || !lattice) throw new Error("FenceAnalysis.analyze: `board` and `lattice` are required.");
    const occ = occupied || new Set();
    const prep = prepare(board, lattice);
    const { n, keys, empty, reachCorner, reachEdge, mark, queue, edge } = prep;

    for (let i = 0; i < n; i += 1) empty[i] = occ.has(keys[i]) ? 0 : 1;

    flood(prep, prep.seedCorner, prep.corner, reachCorner);
    if (prep.oneFlood) reachEdge.set(reachCorner);
    else flood(prep, prep.seedEdge, edge, reachEdge);

    const enclosedSet = new Set();
    const outsideSet = new Set();
    const leakCells = new Set();
    for (let i = 0; i < n; i += 1) {
      if (!empty[i]) continue;
      if (reachCorner[i]) {
        outsideSet.add(keys[i]);
        if (!reachEdge[i]) leakCells.add(keys[i]);
      } else {
        enclosedSet.add(keys[i]);
      }
    }

    // Insides: edge-connected regions of the enclosed cells.
    const regions = [];
    let largestRegion = 0;
    mark.fill(0);
    for (let s = 0; s < n; s += 1) {
      if (!empty[s] || reachCorner[s] || mark[s]) continue;
      const region = new Set();
      let top = 0;
      queue[top++] = s;
      mark[s] = 1;
      while (top > 0) {
        const i = queue[--top];
        region.add(keys[i]);
        const list = edge[i];
        for (let k = 0; k < list.length; k += 1) {
          const j = list[k];
          if (!empty[j] || reachCorner[j] || mark[j]) continue;
          mark[j] = 1;
          queue[top++] = j;
        }
      }
      regions.push(region);
      if (region.size > largestRegion) largestRegion = region.size;
    }

    const leakVertices = leakCells.size > 0 ? findLeakVertices(prep, board, lattice) : [];

    return {
      area: enclosedSet.size,
      enclosedSet,
      regionCount: regions.length,
      largestRegion,
      cornerLeak: leakCells.size > 0,
      leakCells,
      leakCount: leakCells.size,
      regions,
      outsideSet,
      leakVertices,
    };
  }

  // Label every empty cell with its edge-connected empty region, then keep
  // each vertex where a leak cell meets an empty cell of another region.
  // Two such cells touch only at that point (sharing an edge would put them
  // in the same region), and the outside flows through it. A leak cell has
  // no edge on the rim, so each of its corners on the rim is such a point
  // too: there it meets the space beyond the board.
  function findLeakVertices(prep, board, lattice) {
    const { n, empty, reachCorner, reachEdge, mark, queue, edge } = prep;
    const { cellsAt, cellVertices, rim } = prepareVertices(prep, board, lattice);

    mark.fill(0);
    let label = 0;
    for (let s = 0; s < n; s += 1) {
      if (!empty[s] || mark[s]) continue;
      label += 1;
      let top = 0;
      queue[top++] = s;
      mark[s] = label;
      while (top > 0) {
        const i = queue[--top];
        const list = edge[i];
        for (let k = 0; k < list.length; k += 1) {
          const j = list[k];
          if (!empty[j] || mark[j]) continue;
          mark[j] = label;
          queue[top++] = j;
        }
      }
    }

    const seen = new Set();
    const points = [];
    for (let i = 0; i < n; i += 1) {
      if (!empty[i] || !reachCorner[i] || reachEdge[i]) continue; // leak cells only
      for (const v of cellVertices[i]) {
        if (seen.has(v.key)) continue;
        if (rim.has(v.key)) {
          seen.add(v.key);
          points.push({ x: v.x, y: v.y });
          continue;
        }
        const others = cellsAt.get(v.key);
        for (let k = 0; k < others.length; k += 1) {
          const j = others[k];
          if (j !== i && empty[j] && mark[j] !== mark[i]) {
            seen.add(v.key);
            points.push({ x: v.x, y: v.y });
            break;
          }
        }
      }
    }
    return points;
  }

  const api = { analyze };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalScope.FenceAnalysis = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
