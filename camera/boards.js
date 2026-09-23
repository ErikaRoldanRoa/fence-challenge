/* Fence Challenge · printable boards seen by the camera.
 *
 * Every printable board carries four square corner marks (ArUco 4x4 markers).
 * The four ids tell the camera which board it is looking at, so one camera
 * page serves every board. Geometry lives in the same world coordinates the
 * lattice modules use (square cell side 1, hexagon side 1, triangle side 1,
 * y pointing down), so the printed sheet, the camera and the digital board
 * all agree cell by cell.
 *
 * Marker placement rule (boards printed from this file):
 *   side  m = max(1.2, 0.2 * max(W, H))   (W, H: board bounding box)
 *   gap   g = 0.3 * m                      (white quiet zone, > one module)
 *   tl/tr sit above the board, bl/br below it, flush with the left/right
 *   edges of the bounding box. Marker corners are listed in the marker's own
 *   reading order: top-left, top-right, bottom-right, bottom-left.
 *
 * The classic 20 x 20 kit (six taped A4 sheets, ids 50-53 on the corners and
 * 20-43 on the pentomino tiles) predates this file. Its grid position relative
 * to the corner marks varies with how the sheets were taped, so it is located
 * by fitting the grid lines after rectification ("measured" geometry).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("../lattice-square.js"),
      require("../lattice-hex.js"),
      require("../lattice-triangular.js")
    );
  } else {
    root.FenceBoards = factory(root.LatticeSquare, root.LatticeHex, root.LatticeTriangular);
  }
})(typeof self !== "undefined" ? self : this, function (LatticeSquare, LatticeHex, LatticeTriangular) {
  "use strict";

  const LATTICES = { square: LatticeSquare, hexagonal: LatticeHex, triangular: LatticeTriangular };

  // Piece sets are named here and resolved lazily, so this file stays a pure description.
  //   hub-*: the small sets of the three hub cards (defined by the lattice modules)
  //   free-*: every free polyform of the given order (the full lab challenges)
  const BOARDS = [
    {
      id: "sq9",
      lattice: "square",
      spec: { size: 9 },
      pieces: { kind: "hub", set: "TETROMINO_SET" },
      markers: { tl: 100, tr: 101, br: 102, bl: 104 },
      geometry: "printed",
      home: { page: "hub", card: "sq" },
    },
    {
      id: "hex4",
      lattice: "hexagonal",
      spec: { radius: 4 },
      pieces: { kind: "hub", set: "TETRAHEX_SET" },
      markers: { tl: 106, tr: 110, br: 118, bl: 123 },
      geometry: "printed",
      home: { page: "hub", card: "hex" },
    },
    {
      id: "tri4",
      lattice: "triangular",
      spec: { hexSide: 4 },
      pieces: { kind: "hub", set: "HEXIAMOND_SET" },
      markers: { tl: 137, tr: 138, br: 142, bl: 147 },
      geometry: "printed",
      home: { page: "hub", card: "tri" },
    },
    {
      id: "sq20",
      lattice: "square",
      spec: { size: 20 },
      pieces: { kind: "free", order: 5 },
      markers: { tl: 149, tr: 150, br: 158, bl: 159 },
      geometry: "printed",
      home: { page: "square-lab" },
    },
    {
      id: "hex6",
      lattice: "hexagonal",
      spec: { radius: 6 },
      pieces: { kind: "free", order: 4 },
      markers: { tl: 160, tr: 164, br: 166, bl: 167 },
      geometry: "printed",
      home: { page: "hex-lab" },
    },
    {
      id: "tri13",
      lattice: "triangular",
      spec: { hexSide: 13 },
      pieces: { kind: "free", order: 6 },
      markers: { tl: 170, tr: 171, br: 182, bl: 197 },
      geometry: "printed",
      home: { page: "triangle-lab" },
    },
    {
      id: "sq20-classic",
      lattice: "square",
      spec: { size: 20 },
      pieces: { kind: "free", order: 5 },
      markers: { tl: 50, tr: 53, br: 52, bl: 51 },
      geometry: "measured",
      // Where the 20 x 20 grid usually sits inside the quad formed by the four
      // marker centres (fractions along each side). Only a starting point for
      // the grid-line fit; never used on its own.
      gridPrior: { u0: 0.084, u1: 0.916, v0: 0.087, v1: 0.916 },
      // Each classic tile carries one marker on the front (ids 20-31) and one
      // on the back (ids 32-43), in the alphabetical order F I L N P T U V W X Y Z.
      tileMarkers: { front: 20, back: 32, order: ["F", "I", "L", "N", "P", "T", "U", "V", "W", "X", "Y", "Z"] },
      home: { page: "square-lab" },
    },
  ];

  const CORNERS = ["tl", "tr", "br", "bl"];
  const byId = new Map(BOARDS.map((b) => [b.id, b]));

  // Marker id -> what it is.
  const markerIndex = new Map();
  for (const b of BOARDS) {
    for (const c of CORNERS) markerIndex.set(b.markers[c], { kind: "corner", boardId: b.id, corner: c });
    if (b.tileMarkers) {
      b.tileMarkers.order.forEach((name, i) => {
        markerIndex.set(b.tileMarkers.front + i, { kind: "tile", boardId: b.id, piece: name, side: "front" });
        markerIndex.set(b.tileMarkers.back + i, { kind: "tile", boardId: b.id, piece: name, side: "back" });
      });
    }
  }

  function round4(v) {
    return Math.round(v * 10000) / 10000;
  }

  function markerLayout(bounds) {
    const W = bounds.maxX - bounds.minX;
    const H = bounds.maxY - bounds.minY;
    const m = round4(Math.max(1.2, 0.2 * Math.max(W, H)));
    const g = round4(0.3 * m);
    const top = bounds.minY - g - m;
    const bottom = bounds.maxY + g;
    const left = bounds.minX;
    const right = bounds.maxX - m;
    const square = (x, y) => [
      { x, y },
      { x: x + m, y },
      { x: x + m, y: y + m },
      { x, y: y + m },
    ];
    return {
      size: m,
      gap: g,
      corners: {
        tl: square(left, top),
        tr: square(right, top),
        br: square(right, bottom),
        bl: square(left, bottom),
      },
      extent: {
        minX: bounds.minX,
        maxX: bounds.maxX,
        minY: top,
        maxY: bottom + m,
      },
    };
  }

  const geometryCache = new Map();

  /* Everything a sheet, a camera or a test needs about one board:
   *   board    lattice.buildBoard(spec)  (cells with world centroids and vertices)
   *   lattice  the lattice module
   *   markers  { tl: { id, corners:[4 world points] }, ... } for printed boards
   *   extent   bounding box of board plus marks (world units)
   */
  function geometry(boardId) {
    if (geometryCache.has(boardId)) return geometryCache.get(boardId);
    const def = byId.get(boardId);
    if (!def) throw new Error("Unknown board: " + boardId);
    const lattice = LATTICES[def.lattice];
    if (!lattice) throw new Error("Lattice module not loaded: " + def.lattice);
    const board = lattice.buildBoard(def.spec);
    const out = { def, lattice, board, markers: null, extent: { ...board.bounds }, markerSize: null };
    if (def.geometry === "printed") {
      const layout = markerLayout(board.bounds);
      out.markers = {};
      for (const c of CORNERS) out.markers[c] = { id: def.markers[c], corners: layout.corners[c] };
      out.extent = layout.extent;
      out.markerSize = layout.size;
    }
    geometryCache.set(boardId, out);
    return out;
  }

  /* The piece types a board is played with, in the engine's format
   * ({ id, name, cells, color }). Hub boards use the lattice's own card set;
   * lab boards use every free polyform of the given order. */
  function pieceTypes(boardId) {
    const def = byId.get(boardId);
    const lattice = LATTICES[def.lattice];
    if (def.pieces.kind === "hub") {
      const set = lattice[def.pieces.set];
      return set.build(set.shapes);
    }
    return lattice.generateFreePolyforms(def.pieces.order).map((cells, i) => ({
      id: "p" + (i + 1),
      name: "p" + (i + 1),
      cells,
      color: null,
    }));
  }

  return {
    BOARDS,
    CORNERS,
    LATTICES,
    get: (id) => byId.get(id) || null,
    lookupMarker: (markerId) => markerIndex.get(markerId) || null,
    markerIds: () => [...markerIndex.keys()].sort((a, b) => a - b),
    geometry,
    pieceTypes,
    markerLayout,
  };
});
