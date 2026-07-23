const HEXIAMOND_ORDER = 6;
const BOARD_BASE_HEX_SIDE = 11;
const BOARD_EXTRA_TRIANGLE_LAYERS = 2;
const BOARD_HEX_SIDE = BOARD_BASE_HEX_SIDE + BOARD_EXTRA_TRIANGLE_LAYERS;
const SQRT3 = Math.sqrt(3);
const SQRT3_HALF = SQRT3 / 2;
const MARKER_COLORS = [
  "#ff5b7f",
  "#ff9d1e",
  "#ffd84a",
  "#93e03b",
  "#2de2d5",
  "#1bc7ff",
  "#5ea8ff",
  "#7f83ff",
  "#ad73ff",
  "#d866ff",
  "#ff5fb3",
  "#ff9f8e",
];
const HEX_BOARD_FRAME = [
  { x: 0.23, y: 0.07 },
  { x: 0.77, y: 0.07 },
  { x: 0.96, y: 0.5 },
  { x: 0.77, y: 0.93 },
  { x: 0.23, y: 0.93 },
  { x: 0.04, y: 0.5 },
];
const RING_EDGE_SLOTS = [0.18, 0.4, 0.62, 0.84];
const ROTATE_60 = { reflect: false, rot: 1 };
const REFLECT = { reflect: true, rot: 0 };

const SYMMETRIES = [];
for (let rot = 0; rot < 6; rot += 1) {
  SYMMETRIES.push({ reflect: false, rot });
}
for (let rot = 0; rot < 6; rot += 1) {
  SYMMETRIES.push({ reflect: true, rot });
}

const dom = {
  boardWrap: document.querySelector(".board-wrap"),
  canvas: document.getElementById("board-canvas"),
  tray: document.getElementById("piece-tray"),
  detectAreaBtn: document.getElementById("detect-area"),
  clearBtn: document.getElementById("clear-board"),
  rotateBtn: document.getElementById("rotate-piece"),
  flipBtn: document.getElementById("flip-piece"),
  areaChip: document.getElementById("area-chip"),
  cameraChip: document.getElementById("camera-chip"),
  cameraOverlay: document.getElementById("camera-overlay"),
  cameraVideo: document.getElementById("camera-video"),
  cameraCapture: document.getElementById("camera-capture"),
  uploadPhotoInput: document.getElementById("upload-photo"),
  sideBrand: document.querySelector(".side-brand"),
};

const state = {
  ctx: dom.canvas.getContext("2d"),
  boardCells: [],
  boardCellMap: new Map(),
  boardCellEntries: [],
  vertexToCellKeys: new Map(),
  boardBounds: null,
  view: { scale: 1, offsetX: 0, offsetY: 0, width: 0, height: 0 },
  pieceTypes: [],
  pieceTypeMap: new Map(),
  selectedTypeId: null,
  selectedPieceId: null,
  placedPieces: [],
  nextPieceId: 1,
  draggingPieceId: null,
  enclosedCells: new Set(),
  leakCells: new Set(),
  enclosedRegionCount: 0,
  enclosedLargest: 0,
  lastStatus: "",
  cameraStream: null,
  cameraActive: false,
};

init();

function init() {
  buildBoard();
  buildPieces();
  wireEvents();
  resizeCanvas();
  refreshTray();
  setStatus(
    `Hexiamond pipeline ready (${state.pieceTypes.length} free hexiamonds on a ${state.boardCells.length}-triangle hex board).`
  );
  render();
}

function wireEvents() {
  dom.detectAreaBtn.addEventListener("click", () => {
    if (state.cameraActive) {
      closeCameraOverlay();
    }
    const result = computeEnclosedArea();
    state.enclosedCells = result.enclosedSet;
    state.enclosedRegionCount = result.regionCount;
    state.enclosedLargest = result.largestRegion;
    state.leakCells = result.leakCells;
    updateAreaChip(result.area);
    let message = `Enclosed area: ${result.area} triangles across ${result.regionCount} region(s). Largest: ${result.largestRegion}.`;
    if (result.cornerLeak) {
      message += ` Corner leak: the outside slips through a shared vertex, so those cells stay open.`;
    }
    setStatus(message);
    render();
  });

  dom.clearBtn.addEventListener("click", () => {
    if (state.cameraActive) {
      closeCameraOverlay();
    }
    state.placedPieces = [];
    state.selectedPieceId = null;
    state.enclosedCells = new Set();
    state.leakCells = new Set();
    state.enclosedRegionCount = 0;
    state.enclosedLargest = 0;
    updateAreaChip(0);
    setStatus("Board cleared.");
    refreshTray();
    render();
  });

  dom.rotateBtn.addEventListener("click", () => {
    if (state.cameraActive) {
      closeCameraOverlay();
    }
    rotateSelection();
  });

  dom.flipBtn.addEventListener("click", () => {
    if (state.cameraActive) {
      closeCameraOverlay();
    }
    flipSelection();
  });

  dom.cameraChip.addEventListener("click", () => {
    void onCameraChipClick();
  });
  dom.cameraOverlay.addEventListener("click", () => {
    if (state.cameraActive) {
      void captureCameraFrameAndDetect();
    }
  });
  dom.uploadPhotoInput.addEventListener("change", () => {
    void detectFromUploadedPhoto();
  });

  dom.canvas.addEventListener("pointerdown", onPointerDown);
  dom.canvas.addEventListener("pointermove", onPointerMove);
  dom.canvas.addEventListener("pointerup", onPointerUp);
  dom.canvas.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("beforeunload", closeCameraOverlay);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.cameraActive) {
      closeCameraOverlay();
      return;
    }
    if (event.key === "r" || event.key === "R") {
      event.preventDefault();
      rotateSelection();
      return;
    }
    if (event.key === "f" || event.key === "F") {
      event.preventDefault();
      flipSelection();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      if (!state.selectedPieceId) {
        return;
      }
      event.preventDefault();
      const index = state.placedPieces.findIndex((piece) => piece.id === state.selectedPieceId);
      if (index >= 0) {
        const removed = state.placedPieces[index];
        state.placedPieces.splice(index, 1);
        state.selectedPieceId = null;
        state.enclosedCells = new Set();
        state.leakCells = new Set();
        updateAreaChip(0);
        setStatus(`Removed piece ${removed.typeId}.`);
        refreshTray();
        render();
      }
    }
  });
}

function buildBoard() {
  const cells = [];
  const map = new Map();
  const vertexToCellKeys = new Map();
  const scanRange = BOARD_HEX_SIDE + 4;

  for (let i = -scanRange; i <= scanRange; i += 1) {
    for (let j = -scanRange; j <= scanRange; j += 1) {
      for (let o = 0; o <= 1; o += 1) {
        const cell = { i, j, o };
        const latticeVertices = cellToLatticeVertices(cell);
        if (!latticeVertices.every(isInsideBoardHex)) {
          continue;
        }
        const key = cellKey(cell);
        const entry = {
          key,
          i,
          j,
          o,
          latticeVertices,
          touchesBoundaryVertex: latticeVertices.some(isBoundaryVertex),
          centroid: cellCentroidWorld(cell),
          vertices: cellWorldVertices(cell),
        };
        cells.push(entry);
        map.set(key, entry);
        for (const vertex of latticeVertices) {
          const vKey = vertexKey(vertex);
          const linked = vertexToCellKeys.get(vKey);
          if (linked) {
            linked.push(key);
          } else {
            vertexToCellKeys.set(vKey, [key]);
          }
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

  state.boardCells = cells;
  state.boardCellMap = map;
  state.boardCellEntries = cells;
  state.vertexToCellKeys = vertexToCellKeys;
  state.boardBounds = { minX, maxX, minY, maxY };
}

function buildPieces() {
  const freeHexiamonds = generateFreePolyiamonds(HEXIAMOND_ORDER);
  freeHexiamonds.sort((a, b) => cellsKey(a).localeCompare(cellsKey(b)));

  const types = freeHexiamonds.map((shape, index) => {
    const id = `H${index + 1}`;
    const color = MARKER_COLORS[index % MARKER_COLORS.length];
    const variantData = buildVariants(shape);
    return {
      id,
      color,
      variants: variantData.variants,
      rotateMap: variantData.rotateMap,
      flipMap: variantData.flipMap,
      spawnVariant: 0,
    };
  });

  state.pieceTypes = types;
  state.pieceTypeMap = new Map(types.map((type) => [type.id, type]));
  if (types.length > 0) {
    state.selectedTypeId = types[0].id;
  }
}

function generateFreePolyiamonds(order) {
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
          if (occupied.has(key)) {
            continue;
          }
          candidates.set(key, neighbor);
        }
      }

      for (const candidate of candidates.values()) {
        const grown = [...shape, candidate];
        const canonical = canonicalizeShape(grown);
        if (!next.has(canonical.key)) {
          next.set(canonical.key, canonical.cells);
        }
      }
    }

    frontier = next;
  }

  return [...frontier.values()];
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

function buildVariants(baseCells) {
  const marker = [...baseCells].sort(cellSort)[0];
  const unique = new Map();

  for (const symmetry of SYMMETRIES) {
    const transformedCells = baseCells.map((cell) => transformCell(cell, symmetry));
    const markerTransformed = transformCell(marker, symmetry);
    const anchored = transformedCells.map((cell) => ({
      i: cell.i - markerTransformed.i,
      j: cell.j - markerTransformed.j,
      o: cell.o,
    }));
    const key = cellsKey(anchored);
    if (!unique.has(key)) {
      unique.set(key, {
        key,
        cells: anchored.sort(cellSort),
        markerO: markerTransformed.o,
      });
    }
  }

  const variants = [...unique.values()].sort((a, b) => a.key.localeCompare(b.key));
  const variantIndexByKey = new Map(variants.map((variant, index) => [variant.key, index]));
  const rotateMap = [];
  const flipMap = [];

  variants.forEach((variant, index) => {
    const rotated = transformAnchoredVariant(variant, ROTATE_60);
    const reflected = transformAnchoredVariant(variant, REFLECT);
    rotateMap[index] = variantIndexByKey.get(rotated.key) ?? index;
    flipMap[index] = variantIndexByKey.get(reflected.key) ?? index;
  });

  return { variants, rotateMap, flipMap };
}

function transformAnchoredVariant(variant, symmetry) {
  const markerCell = { i: 0, j: 0, o: variant.markerO };
  const markerTransformed = transformCell(markerCell, symmetry);
  const transformed = variant.cells.map((cell) => transformCell(cell, symmetry));
  const anchored = transformed.map((cell) => ({
    i: cell.i - markerTransformed.i,
    j: cell.j - markerTransformed.j,
    o: cell.o,
  }));
  const key = cellsKey(anchored);
  return {
    key,
    cells: anchored.sort(cellSort),
    markerO: markerTransformed.o,
  };
}

function refreshTray() {
  dom.tray.innerHTML = "";
  state.pieceTypes.forEach((type, index) => {
    const chip = document.createElement("button");
    chip.className = "piece-chip piece-chip-ring";
    chip.type = "button";
    chip.title = `${type.id}`;

    if (state.selectedTypeId === type.id) {
      chip.classList.add("is-selected");
    }
    if (state.placedPieces.some((piece) => piece.typeId === type.id)) {
      chip.classList.add("is-on-board");
    }

    chip.innerHTML = buildPiecePreviewSvg(type);
    chip.addEventListener("click", () => {
      state.selectedTypeId = type.id;
      const existing = state.placedPieces.find((piece) => piece.typeId === type.id);
      if (existing) {
        state.selectedPieceId = existing.id;
        setStatus(`Selected ${type.id}. Drag it on the board.`);
      } else if (!spawnPiece(type.id)) {
        setStatus(`No available space to place ${type.id}.`);
      }
      refreshTray();
      render();
    });
    dom.tray.appendChild(chip);
  });
  layoutPieceRing();
}

function buildPiecePreviewSvg(type) {
  const variant = type.variants[type.spawnVariant];
  const points = [];
  for (const cell of variant.cells) {
    const verts = cellWorldVertices(cell);
    for (const v of verts) {
      points.push(v);
    }
  }
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const v of points) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const scale = 24 / Math.max(width, height, 0.0001);
  const offsetX = 17 - ((minX + maxX) * 0.5) * scale;
  const offsetY = 17 - ((minY + maxY) * 0.5) * scale;

  const polygons = variant.cells
    .map((cell) => {
      const pts = cellWorldVertices(cell)
        .map((v) => `${(v.x * scale + offsetX).toFixed(2)},${(v.y * scale + offsetY).toFixed(2)}`)
        .join(" ");
      return `<polygon points="${pts}" fill="${type.color}" stroke="rgba(10,20,36,0.8)" stroke-width="0.8"></polygon>`;
    })
    .join("");

  return `<svg viewBox="0 0 34 34" aria-hidden="true">${polygons}</svg>`;
}

function spawnPiece(typeId, preferredCell = null) {
  const type = state.pieceTypeMap.get(typeId);
  if (!type) {
    return false;
  }
  const existing = state.placedPieces.find((piece) => piece.typeId === typeId);
  if (existing) {
    state.selectedPieceId = existing.id;
    return true;
  }

  const variantIndex = type.spawnVariant;
  const variant = type.variants[variantIndex];
  const target =
    preferredCell && preferredCell.o === variant.markerO && canPlace(typeId, variantIndex, preferredCell, null)
      ? preferredCell
      : findBestMarkerCell(typeId, variantIndex);

  if (!target) {
    return false;
  }

  const piece = {
    id: state.nextPieceId++,
    typeId,
    variantIndex,
    marker: { i: target.i, j: target.j, o: target.o },
  };
  state.placedPieces.push(piece);
  state.selectedPieceId = piece.id;
  state.enclosedCells = new Set();
  state.leakCells = new Set();
  updateAreaChip(0);
  setStatus(`Placed ${typeId}.`);
  return true;
}

function findBestMarkerCell(typeId, variantIndex, preferredWorld = { x: 0, y: 0 }, ignorePieceId = null) {
  const type = state.pieceTypeMap.get(typeId);
  if (!type) {
    return null;
  }
  const markerOrientation = type.variants[variantIndex].markerO;
  const candidates = state.boardCellEntries
    .filter((entry) => entry.o === markerOrientation)
    .map((entry) => ({
      entry,
      dist2: squaredDistance(entry.centroid, preferredWorld),
    }))
    .sort((a, b) => a.dist2 - b.dist2);

  for (const candidate of candidates) {
    if (canPlace(typeId, variantIndex, candidate.entry, ignorePieceId)) {
      return candidate.entry;
    }
  }
  return null;
}

function rotateSelection() {
  const selected = getSelectedPiece();
  if (selected) {
    const type = state.pieceTypeMap.get(selected.typeId);
    const nextVariant = type.rotateMap[selected.variantIndex];
    if (reorientPlacedPiece(selected, nextVariant)) {
      setStatus(`Rotated ${selected.typeId}.`);
      state.enclosedCells = new Set();
      state.leakCells = new Set();
      updateAreaChip(0);
      render();
    }
    return;
  }

  if (!state.selectedTypeId) {
    return;
  }
  const type = state.pieceTypeMap.get(state.selectedTypeId);
  type.spawnVariant = type.rotateMap[type.spawnVariant];
  refreshTray();
  render();
}

function flipSelection() {
  const selected = getSelectedPiece();
  if (selected) {
    const type = state.pieceTypeMap.get(selected.typeId);
    const nextVariant = type.flipMap[selected.variantIndex];
    if (reorientPlacedPiece(selected, nextVariant)) {
      setStatus(`Flipped ${selected.typeId}.`);
      state.enclosedCells = new Set();
      state.leakCells = new Set();
      updateAreaChip(0);
      render();
    }
    return;
  }

  if (!state.selectedTypeId) {
    return;
  }
  const type = state.pieceTypeMap.get(state.selectedTypeId);
  type.spawnVariant = type.flipMap[type.spawnVariant];
  refreshTray();
  render();
}

function reorientPlacedPiece(piece, nextVariantIndex) {
  if (nextVariantIndex === piece.variantIndex) {
    return true;
  }
  const type = state.pieceTypeMap.get(piece.typeId);
  if (!type) {
    return false;
  }
  const oldMarkerEntry = state.boardCellMap.get(cellKey(piece.marker));
  const preferred = oldMarkerEntry ? oldMarkerEntry.centroid : cellCentroidWorld(piece.marker);
  const nextMarker = findBestMarkerCell(piece.typeId, nextVariantIndex, preferred, piece.id);
  if (!nextMarker) {
    setStatus(`No room to reorient ${piece.typeId} at this moment.`);
    return false;
  }

  if (!canPlace(piece.typeId, nextVariantIndex, nextMarker, piece.id)) {
    setStatus(`No valid placement after reorientation for ${piece.typeId}.`);
    return false;
  }

  piece.variantIndex = nextVariantIndex;
  piece.marker = { i: nextMarker.i, j: nextMarker.j, o: nextMarker.o };
  refreshTray();
  return true;
}

function onPointerDown(event) {
  if (state.cameraActive) {
    void captureCameraFrameAndDetect();
    return;
  }
  const point = pointerToCanvas(event);
  const nearest = findNearestBoardCell(point, null);
  if (!nearest) {
    return;
  }

  const occupancy = buildOccupancyMap();
  const occupiedBy = occupancy.get(nearest.key);
  if (occupiedBy) {
    state._downPieceId = occupiedBy;
    state._downWasSelected = state.selectedPieceId === occupiedBy;
    state._didDrag = false;
    state._downClientX = event.clientX;
    state._downClientY = event.clientY;
    state.selectedPieceId = occupiedBy;
    state.draggingPieceId = occupiedBy;
    dom.canvas.setPointerCapture(event.pointerId);
    refreshTray();
    render();
    return;
  }
  state._downPieceId = null;

  if (!state.selectedTypeId) {
    return;
  }
  if (spawnPiece(state.selectedTypeId, nearest)) {
    refreshTray();
    render();
  }
}

function onPointerMove(event) {
  if (state.cameraActive) {
    return;
  }
  if (!state.draggingPieceId) {
    return;
  }
  if (!state._didDrag) {
    const mdx = event.clientX - state._downClientX;
    const mdy = event.clientY - state._downClientY;
    if (mdx * mdx + mdy * mdy > 36) state._didDrag = true;
  }
  const piece = state.placedPieces.find((item) => item.id === state.draggingPieceId);
  if (!piece) {
    return;
  }
  const type = state.pieceTypeMap.get(piece.typeId);
  const markerOrientation = type.variants[piece.variantIndex].markerO;
  const point = pointerToCanvas(event);
  const nearest = findNearestBoardCell(point, markerOrientation);
  if (!nearest) {
    return;
  }

  if (
    piece.marker.i === nearest.i &&
    piece.marker.j === nearest.j &&
    piece.marker.o === nearest.o
  ) {
    return;
  }

  if (!canPlace(piece.typeId, piece.variantIndex, nearest, piece.id)) {
    return;
  }
  piece.marker = { i: nearest.i, j: nearest.j, o: nearest.o };
  state._didDrag = true;
  state.enclosedCells = new Set();
  state.leakCells = new Set();
  updateAreaChip(0);
  render();
}

function onPointerUp(event) {
  // Tap (no drag) on an already-selected piece removes it — phones have no Delete key.
  if (state._downPieceId && !state._didDrag && state._downWasSelected) {
    const index = state.placedPieces.findIndex((piece) => piece.id === state._downPieceId);
    if (index >= 0) {
      const removed = state.placedPieces[index];
      state.placedPieces.splice(index, 1);
      state.selectedPieceId = null;
      state.enclosedCells = new Set();
      state.leakCells = new Set();
      updateAreaChip(0);
      setStatus(`Removed piece ${removed.typeId}.`);
      refreshTray();
      render();
    }
  }
  state._downPieceId = null;
  if (state.draggingPieceId) {
    setStatus("Drag to move a piece. Edge-only fences enclose area.");
  }
  state.draggingPieceId = null;
  if (dom.canvas.hasPointerCapture(event.pointerId)) {
    dom.canvas.releasePointerCapture(event.pointerId);
  }
}

function getSelectedPiece() {
  if (!state.selectedPieceId) {
    return null;
  }
  return state.placedPieces.find((piece) => piece.id === state.selectedPieceId) ?? null;
}

function pieceAbsoluteCells(piece, variantIndex = piece.variantIndex, marker = piece.marker) {
  const type = state.pieceTypeMap.get(piece.typeId);
  const variant = type.variants[variantIndex];
  return variant.cells.map((cell) => ({
    i: cell.i + marker.i,
    j: cell.j + marker.j,
    o: cell.o,
  }));
}

function canPlace(typeId, variantIndex, markerCell, ignorePieceId = null) {
  const type = state.pieceTypeMap.get(typeId);
  if (!type) {
    return false;
  }
  const variant = type.variants[variantIndex];
  if (markerCell.o !== variant.markerO) {
    return false;
  }

  const occupancy = buildOccupancyMap(ignorePieceId);
  for (const rel of variant.cells) {
    const abs = {
      i: rel.i + markerCell.i,
      j: rel.j + markerCell.j,
      o: rel.o,
    };
    const key = cellKey(abs);
    if (!state.boardCellMap.has(key)) {
      return false;
    }
    if (occupancy.has(key)) {
      return false;
    }
  }
  return true;
}

function buildOccupancyMap(ignorePieceId = null) {
  const occupancy = new Map();
  for (const piece of state.placedPieces) {
    if (piece.id === ignorePieceId) {
      continue;
    }
    for (const cell of pieceAbsoluteCells(piece)) {
      occupancy.set(cellKey(cell), piece.id);
    }
  }
  return occupancy;
}

function computeEnclosedArea() {
  const occupied = new Set();
  for (const piece of state.placedPieces) {
    for (const cell of pieceAbsoluteCells(piece)) {
      occupied.add(cellKey(cell));
    }
  }

  const emptyKeys = state.boardCellEntries
    .map((entry) => entry.key)
    .filter((key) => !occupied.has(key));
  const emptySet = new Set(emptyKeys);
  const outsideVisited = new Set();
  const queue = [];

  for (const entry of state.boardCellEntries) {
    if (!emptySet.has(entry.key)) {
      continue;
    }
    const neighbors = cellNeighbors(entry);
    const touchesOutside =
      entry.touchesBoundaryVertex ||
      neighbors.some((neighbor) => !state.boardCellMap.has(cellKey(neighbor)));
    if (touchesOutside) {
      outsideVisited.add(entry.key);
      queue.push(entry.key);
    }
  }

  while (queue.length > 0) {
    const key = queue.shift();
    for (const nKey of getReachableNeighborKeys(key, emptySet)) {
      if (!emptySet.has(nKey) || outsideVisited.has(nKey)) {
        continue;
      }
      outsideVisited.add(nKey);
      queue.push(nKey);
    }
  }

  const enclosed = emptyKeys.filter((key) => !outsideVisited.has(key));
  const enclosedSet = new Set(enclosed);

  // Second flood, edge-only: a cell sealed edge-to-edge but still reachable by the outside
  // through a shared vertex is a "corner leak" — enclosed under strict walls, but not under the
  // real vertex-aware rule. leakCells = strict-enclosed \ actually-enclosed. Mirrors the hub witness.
  const outsideStrict = new Set();
  const strictQueue = [];
  for (const entry of state.boardCellEntries) {
    if (!emptySet.has(entry.key)) {
      continue;
    }
    const touchesOutside =
      entry.touchesBoundaryVertex ||
      cellNeighbors(entry).some((neighbor) => !state.boardCellMap.has(cellKey(neighbor)));
    if (touchesOutside) {
      outsideStrict.add(entry.key);
      strictQueue.push(entry.key);
    }
  }
  while (strictQueue.length > 0) {
    const key = strictQueue.shift();
    for (const nKey of edgeOnlyNeighborKeys(key, emptySet)) {
      if (!emptySet.has(nKey) || outsideStrict.has(nKey)) {
        continue;
      }
      outsideStrict.add(nKey);
      strictQueue.push(nKey);
    }
  }
  const leakCells = new Set();
  for (const key of emptyKeys) {
    if (!outsideStrict.has(key) && !enclosedSet.has(key)) {
      leakCells.add(key);
    }
  }

  const visited = new Set();
  let regionCount = 0;
  let largestRegion = 0;

  for (const start of enclosed) {
    if (visited.has(start)) {
      continue;
    }
    regionCount += 1;
    let regionSize = 0;
    const regionQueue = [start];
    visited.add(start);

    while (regionQueue.length > 0) {
      const key = regionQueue.pop();
      regionSize += 1;
      for (const nKey of getReachableNeighborKeys(key, enclosedSet)) {
        if (!enclosedSet.has(nKey) || visited.has(nKey)) {
          continue;
        }
        visited.add(nKey);
        regionQueue.push(nKey);
      }
    }
    if (regionSize > largestRegion) {
      largestRegion = regionSize;
    }
  }

  return {
    area: enclosed.length,
    enclosedSet,
    regionCount,
    largestRegion,
    leakCells,
    cornerLeak: leakCells.size > 0,
  };
}

// Edge-only reachability (no shared-vertex hop) — the strict-wall view used to detect corner leaks.
function edgeOnlyNeighborKeys(key, candidateSet) {
  const reachable = new Set();
  const cell = parseCellKey(key);
  for (const neighbor of cellNeighbors(cell)) {
    const nKey = cellKey(neighbor);
    if (candidateSet.has(nKey)) {
      reachable.add(nKey);
    }
  }
  return reachable;
}

function getReachableNeighborKeys(key, candidateSet) {
  const reachable = new Set();
  const cell = parseCellKey(key);
  for (const neighbor of cellNeighbors(cell)) {
    const nKey = cellKey(neighbor);
    if (candidateSet.has(nKey)) {
      reachable.add(nKey);
    }
  }

  const entry = state.boardCellMap.get(key);
  if (!entry) {
    return reachable;
  }
  for (const vertex of entry.latticeVertices) {
    const linked = state.vertexToCellKeys.get(vertexKey(vertex));
    if (!linked) {
      continue;
    }
    for (const linkedKey of linked) {
      if (linkedKey !== key && candidateSet.has(linkedKey)) {
        reachable.add(linkedKey);
      }
    }
  }
  return reachable;
}

function resizeCanvas() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = dom.canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));

  if (dom.canvas.width !== width || dom.canvas.height !== height) {
    dom.canvas.width = width;
    dom.canvas.height = height;
  }

  const padding = 10 * dpr;
  const bounds = state.boardBounds;
  const boardWidth = bounds.maxX - bounds.minX;
  const boardHeight = bounds.maxY - bounds.minY;
  const scale = Math.min(
    (width - padding * 2) / Math.max(boardWidth, 0.0001),
    (height - padding * 2) / Math.max(boardHeight, 0.0001)
  );
  const offsetX = (width - boardWidth * scale) * 0.5 - bounds.minX * scale;
  const offsetY = (height - boardHeight * scale) * 0.5 - bounds.minY * scale;

  state.view = { scale, offsetX, offsetY, width, height };
  layoutPieceRing();
  render();
}

function render() {
  const ctx = state.ctx;
  const { width, height } = state.view;
  if (width <= 0 || height <= 0) {
    return;
  }
  ctx.clearRect(0, 0, width, height);

  drawBoardBase();
  drawEnclosedCells();
  drawLeakCells();
  drawPlacedPieces();
}

function drawBoardBase() {
  const ctx = state.ctx;
  ctx.save();
  ctx.lineWidth = Math.max(0.7, state.view.scale * 0.03);

  for (const cell of state.boardCellEntries) {
    const verts = cell.vertices.map(worldToScreen);
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    ctx.lineTo(verts[1].x, verts[1].y);
    ctx.lineTo(verts[2].x, verts[2].y);
    ctx.closePath();
    ctx.fillStyle = "rgba(40, 70, 110, 0.32)";
    ctx.fill();
    ctx.strokeStyle = "rgba(170, 220, 255, 0.18)";
    ctx.stroke();
  }

  const boardOutline = convexHull(
    state.boardCellEntries.flatMap((entry) => entry.vertices).map(worldToScreen)
  );
  if (boardOutline.length >= 3) {
    ctx.beginPath();
    ctx.moveTo(boardOutline[0].x, boardOutline[0].y);
    for (let i = 1; i < boardOutline.length; i += 1) {
      ctx.lineTo(boardOutline[i].x, boardOutline[i].y);
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(48, 188, 255, 0.9)";
    ctx.lineWidth = Math.max(1.2, state.view.scale * 0.05);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEnclosedCells() {
  if (state.enclosedCells.size === 0) {
    return;
  }
  const ctx = state.ctx;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  ctx.save();
  ctx.shadowBlur = 15 * dpr;
  ctx.shadowColor = "rgba(45, 246, 172, 0.85)";
  for (const key of state.enclosedCells) {
    const cell = state.boardCellMap.get(key);
    if (!cell) {
      continue;
    }
    const verts = cell.vertices.map(worldToScreen);
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    ctx.lineTo(verts[1].x, verts[1].y);
    ctx.lineTo(verts[2].x, verts[2].y);
    ctx.closePath();
    ctx.fillStyle = "rgba(45, 246, 172, 0.52)";
    ctx.fill();
  }
  ctx.restore();
}

function drawLeakCells() {
  if (!state.leakCells || state.leakCells.size === 0) {
    return;
  }
  const ctx = state.ctx;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  ctx.save();
  ctx.setLineDash([4 * dpr, 3 * dpr]);
  for (const key of state.leakCells) {
    const cell = state.boardCellMap.get(key);
    if (!cell) {
      continue;
    }
    const verts = cell.vertices.map(worldToScreen);
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    ctx.lineTo(verts[1].x, verts[1].y);
    ctx.lineTo(verts[2].x, verts[2].y);
    ctx.closePath();
    ctx.fillStyle = "rgba(178, 120, 255, 0.20)";
    ctx.fill();
    ctx.strokeStyle = "rgba(200, 150, 255, 0.85)";
    ctx.lineWidth = 1.4 * dpr;
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlacedPieces() {
  const ctx = state.ctx;
  for (const piece of state.placedPieces) {
    const type = state.pieceTypeMap.get(piece.typeId);
    const isSelected = piece.id === state.selectedPieceId;
    const cells = pieceAbsoluteCells(piece);

    for (const cell of cells) {
      const boardCell = state.boardCellMap.get(cellKey(cell));
      if (!boardCell) {
        continue;
      }
      const verts = boardCell.vertices.map(worldToScreen);
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      ctx.lineTo(verts[1].x, verts[1].y);
      ctx.lineTo(verts[2].x, verts[2].y);
      ctx.closePath();
      ctx.fillStyle = type.color;
      ctx.fill();
      ctx.lineWidth = isSelected ? Math.max(1.6, state.view.scale * 0.065) : Math.max(0.8, state.view.scale * 0.04);
      ctx.strokeStyle = isSelected ? "rgba(248,252,255,0.95)" : "rgba(10,22,34,0.36)";
      ctx.stroke();
    }
  }
}

function findNearestBoardCell(point, orientation = null) {
  const worldPoint = screenToWorld(point);
  let best = null;
  let bestDist2 = Number.POSITIVE_INFINITY;
  for (const entry of state.boardCellEntries) {
    if (orientation !== null && entry.o !== orientation) {
      continue;
    }
    const dist2 = squaredDistance(entry.centroid, worldPoint);
    if (dist2 < bestDist2) {
      bestDist2 = dist2;
      best = entry;
    }
  }
  const threshold = (0.74 * 0.74);
  if (best && bestDist2 <= threshold) {
    return best;
  }
  return null;
}

function updateAreaChip(area) {
  dom.areaChip.textContent = `Area: ${area}`;
}

function setStatus(message) {
  state.lastStatus = message;
}

async function onCameraChipClick() {
  if (!state.cameraActive) {
    await openCameraOverlay();
    return;
  }
  await captureCameraFrameAndDetect();
}

async function openCameraOverlay() {
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    dom.uploadPhotoInput.click();
    setStatus("Camera API not available. Upload a photo instead.");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
      },
      audio: false,
    });
    state.cameraStream = stream;
    dom.cameraVideo.srcObject = stream;
    await dom.cameraVideo.play();
    dom.cameraOverlay.hidden = false;
    dom.boardWrap.classList.add("camera-mode");
    dom.cameraChip.classList.add("is-active");
    state.cameraActive = true;
    setStatus("Camera opened.");
  } catch (error) {
    dom.uploadPhotoInput.click();
    setStatus("Camera permission denied or unavailable. Upload a photo instead.");
  }
}

function closeCameraOverlay() {
  if (state.cameraStream) {
    for (const track of state.cameraStream.getTracks()) {
      track.stop();
    }
  }
  state.cameraStream = null;
  dom.cameraVideo.srcObject = null;
  dom.cameraOverlay.hidden = true;
  dom.boardWrap.classList.remove("camera-mode");
  dom.cameraChip.classList.remove("is-active");
  state.cameraActive = false;
}

async function captureCameraFrameAndDetect() {
  if (!state.cameraActive) {
    await openCameraOverlay();
    return;
  }

  try {
    const video = dom.cameraVideo;
    const capture = dom.cameraCapture;
    const frameWidth = video.videoWidth || dom.canvas.width;
    const frameHeight = video.videoHeight || dom.canvas.height;
    if (!frameWidth || !frameHeight) {
      setStatus("Camera frame not ready yet.");
      return;
    }
    capture.width = frameWidth;
    capture.height = frameHeight;
    const ctx = capture.getContext("2d");
    ctx.drawImage(video, 0, 0, frameWidth, frameHeight);

    const detection = runPolyiamondMarkerPipeline(capture);
    applyDetectedPolyiamondState(detection);
  } catch (error) {
    setStatus("Capture failed. Try again.");
  } finally {
    closeCameraOverlay();
  }
}

async function detectFromUploadedPhoto() {
  const file = dom.uploadPhotoInput.files?.[0];
  if (!file) {
    return;
  }

  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = objectUrl;
  }).catch(() => null);
  URL.revokeObjectURL(objectUrl);
  if (!image.width || !image.height) {
    setStatus("Could not read the uploaded photo.");
    return;
  }

  const capture = dom.cameraCapture;
  capture.width = image.width;
  capture.height = image.height;
  const ctx = capture.getContext("2d");
  ctx.drawImage(image, 0, 0, image.width, image.height);

  const detection = runPolyiamondMarkerPipeline(capture);
  applyDetectedPolyiamondState(detection);
  if (state.cameraActive) {
    closeCameraOverlay();
  }
  dom.uploadPhotoInput.value = "";
}

function runPolyiamondMarkerPipeline(frameCanvas) {
  const ctx = frameCanvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, frameCanvas.width, frameCanvas.height);
  const data = image.data;
  let darkPixels = 0;
  const sampleStep = Math.max(1, Math.floor((frameCanvas.width * frameCanvas.height) / 140000));
  for (let i = 0; i < data.length; i += 4 * sampleStep) {
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (luma < 52) {
      darkPixels += 1;
    }
  }
  const sampledPixels = Math.ceil(data.length / (4 * sampleStep));
  const darkRatio = sampledPixels > 0 ? darkPixels / sampledPixels : 0;

  return {
    ok: false,
    detectedMarkers: 0,
    darkRatio,
    placements: [],
  };
}

function applyDetectedPolyiamondState(detection) {
  if (!detection.ok) {
    setStatus(
      `Camera frame captured. Marker pipeline hook is live (dark ratio ${detection.darkRatio.toFixed(3)}).`
    );
    return;
  }
  state.placedPieces = detection.placements;
  state.selectedPieceId = null;
  state.enclosedCells = new Set();
  state.leakCells = new Set();
  state.enclosedLargest = 0;
  state.enclosedRegionCount = 0;
  updateAreaChip(0);
  refreshTray();
  render();
}

function pointerToCanvas(event) {
  const rect = dom.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * dom.canvas.width) / rect.width,
    y: ((event.clientY - rect.top) * dom.canvas.height) / rect.height,
  };
}

function worldToScreen(point) {
  return {
    x: point.x * state.view.scale + state.view.offsetX,
    y: point.y * state.view.scale + state.view.offsetY,
  };
}

function screenToWorld(point) {
  return {
    x: (point.x - state.view.offsetX) / state.view.scale,
    y: (point.y - state.view.offsetY) / state.view.scale,
  };
}

function layoutPieceRing() {
  if (!state.boardCellEntries.length) {
    return;
  }

  const rect = dom.canvas.getBoundingClientRect();
  const boardHex = getBoardHexVerticesCss();
  if (!boardHex) {
    return;
  }
  applyCameraWindowPath(boardHex, rect);
  layoutCameraChip(rect, boardHex);
  layoutSideBrand(rect, boardHex);

  const chips = [...dom.tray.querySelectorAll(".piece-chip-ring")];
  if (chips.length === 0) {
    return;
  }
  const center = {
    x: (boardHex.left.x + boardHex.right.x) * 0.5,
    y: (boardHex.topLeft.y + boardHex.bottomLeft.y) * 0.5,
  };
  const chipRect = chips[0].getBoundingClientRect();
  const halfW = Math.max(16, chipRect.width * 0.5);
  const halfH = Math.max(16, chipRect.height * 0.5);
  const chipClearance = 14;
  const edges = [
    { a: boardHex.left, b: boardHex.topLeft },
    { a: boardHex.topLeft, b: boardHex.topRight },
    { a: boardHex.topRight, b: boardHex.right },
  ];
  const ordered = [];
  for (const edgeDef of edges) {
    const a = edgeDef.a;
    const b = edgeDef.b;
    const edgeVec = { x: b.x - a.x, y: b.y - a.y };
    const edgeLen = Math.hypot(edgeVec.x, edgeVec.y) || 1;
    const midpoint = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
    const toOutside = { x: midpoint.x - center.x, y: midpoint.y - center.y };

    const n1 = { x: -edgeVec.y / edgeLen, y: edgeVec.x / edgeLen };
    const n2 = { x: edgeVec.y / edgeLen, y: -edgeVec.x / edgeLen };
    const dot1 = n1.x * toOutside.x + n1.y * toOutside.y;
    const normal = dot1 >= 0 ? n1 : n2;
    const outwardPx = Math.abs(normal.x) * halfW + Math.abs(normal.y) * halfH + chipClearance;

    for (const t of RING_EDGE_SLOTS) {
      const edgeX = a.x + edgeVec.x * t;
      const edgeY = a.y + edgeVec.y * t;
      ordered.push({
        x: edgeX + normal.x * outwardPx,
        y: edgeY + normal.y * outwardPx,
      });
    }
  }

  chips.forEach((chip, index) => {
    const anchor = ordered[index % ordered.length];
    chip.style.left = `${anchor.x}px`;
    chip.style.top = `${anchor.y}px`;
  });
}

function applyCameraWindowPath(boardHex, rect) {
  const points = [
    boardHex.topLeft,
    boardHex.topRight,
    boardHex.right,
    boardHex.bottomRight,
    boardHex.bottomLeft,
    boardHex.left,
  ];
  const polygon = points
    .map((point) => `${((point.x / rect.width) * 100).toFixed(4)}% ${((point.y / rect.height) * 100).toFixed(4)}%`)
    .join(", ");
  dom.boardWrap.style.setProperty("--camera-window-path", `polygon(${polygon})`);
}

function layoutCameraChip(rect = dom.canvas.getBoundingClientRect(), boardHex = getBoardHexVerticesCss()) {
  if (!boardHex) {
    return;
  }
  const topRightVertex = boardHex.topRight;
  const center = {
    x: (boardHex.left.x + boardHex.right.x) * 0.5,
    y: (boardHex.topLeft.y + boardHex.bottomLeft.y) * 0.5,
  };
  const vx = topRightVertex.x - center.x;
  const vy = topRightVertex.y - center.y;
  const len = Math.hypot(vx, vy) || 1;
  const outward = 28;
  const x = topRightVertex.x + (vx / len) * outward;
  const y = topRightVertex.y + (vy / len) * outward;
  const chipHalf = 16;
  const clampedX = clamp(x, chipHalf, rect.width - chipHalf);
  const clampedY = clamp(y, chipHalf, rect.height - chipHalf);
  dom.cameraChip.style.left = `${clampedX}px`;
  dom.cameraChip.style.top = `${clampedY}px`;
  dom.cameraChip.style.right = "auto";
}

function layoutSideBrand(rect = dom.canvas.getBoundingClientRect(), boardHex = getBoardHexVerticesCss()) {
  if (!dom.sideBrand || !boardHex) {
    return;
  }

  const center = {
    x: (boardHex.left.x + boardHex.right.x) * 0.5,
    y: (boardHex.topLeft.y + boardHex.bottomLeft.y) * 0.5,
  };

  const a = boardHex.bottomRight;
  const b = boardHex.right;
  const edgeVec = { x: b.x - a.x, y: b.y - a.y };
  const edgeLen = Math.hypot(edgeVec.x, edgeVec.y) || 1;
  const anchorT = 0.52;
  const edgePoint = {
    x: a.x + edgeVec.x * anchorT,
    y: a.y + edgeVec.y * anchorT,
  };
  const toOutside = {
    x: edgePoint.x - center.x,
    y: edgePoint.y - center.y,
  };
  const n1 = { x: -edgeVec.y / edgeLen, y: edgeVec.x / edgeLen };
  const n2 = { x: edgeVec.y / edgeLen, y: -edgeVec.x / edgeLen };
  const dot1 = n1.x * toOutside.x + n1.y * toOutside.y;
  const normal = dot1 >= 0 ? n1 : n2;
  const offset = 34;
  const x = edgePoint.x + normal.x * offset;
  const y = edgePoint.y + normal.y * offset;
  const angleDeg = (Math.atan2(edgeVec.y, edgeVec.x) * 180) / Math.PI;

  dom.sideBrand.style.left = `${x}px`;
  dom.sideBrand.style.top = `${y}px`;
  dom.sideBrand.style.transformOrigin = "50% 50%";
  dom.sideBrand.style.transform = `translate(-50%, -50%) rotate(${angleDeg.toFixed(2)}deg)`;
}

function toCssFromScreen(point) {
  const rect = dom.canvas.getBoundingClientRect();
  const sx = rect.width / Math.max(state.view.width, 1);
  const sy = rect.height / Math.max(state.view.height, 1);
  return { x: point.x * sx, y: point.y * sy };
}

function getBoardHexVerticesCss() {
  const points = state.boardCellEntries.flatMap((entry) =>
    entry.vertices.map((vertex) => toCssFromScreen(worldToScreen(vertex)))
  );
  const hull = convexHull(points);
  if (hull.length < 6) {
    return null;
  }

  const dirs = {
    right: { x: 1, y: 0 },
    topRight: { x: 0.5, y: -SQRT3_HALF },
    topLeft: { x: -0.5, y: -SQRT3_HALF },
    left: { x: -1, y: 0 },
    bottomLeft: { x: -0.5, y: SQRT3_HALF },
    bottomRight: { x: 0.5, y: SQRT3_HALF },
  };

  const extreme = (dir) =>
    hull.reduce((best, point) => {
      const scoreBest = best.x * dir.x + best.y * dir.y;
      const scorePoint = point.x * dir.x + point.y * dir.y;
      return scorePoint > scoreBest ? point : best;
    }, hull[0]);

  return {
    left: extreme(dirs.left),
    right: extreme(dirs.right),
    topLeft: extreme(dirs.topLeft),
    topRight: extreme(dirs.topRight),
    bottomLeft: extreme(dirs.bottomLeft),
    bottomRight: extreme(dirs.bottomRight),
  };
}

function isInsideBoardHex(vertex) {
  const i = vertex.i;
  const j = vertex.j;
  const k = i + j;
  return Math.max(Math.abs(i), Math.abs(j), Math.abs(k)) <= BOARD_HEX_SIDE;
}

function isBoundaryVertex(vertex) {
  const i = vertex.i;
  const j = vertex.j;
  const k = i + j;
  return Math.max(Math.abs(i), Math.abs(j), Math.abs(k)) === BOARD_HEX_SIDE;
}

function latticeToWorld(point) {
  return {
    x: point.i + 0.5 * point.j,
    y: point.j * SQRT3_HALF,
  };
}

function cellWorldVertices(cell) {
  return cellToLatticeVertices(cell).map(latticeToWorld);
}

function cellCentroidWorld(cell) {
  const vertices = cellWorldVertices(cell);
  return {
    x: (vertices[0].x + vertices[1].x + vertices[2].x) / 3,
    y: (vertices[0].y + vertices[1].y + vertices[2].y) / 3,
  };
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
  const transformedVertices = cellToLatticeVertices(cell).map((vertex) =>
    transformPoint(vertex, symmetry)
  );
  return vertsToCell(transformedVertices);
}

function transformPoint(point, symmetry) {
  let transformed = { i: point.i, j: point.j };
  if (symmetry.reflect) {
    transformed = {
      i: transformed.i + transformed.j,
      j: -transformed.j,
    };
  }
  for (let step = 0; step < symmetry.rot; step += 1) {
    transformed = rotatePoint60(transformed);
  }
  return transformed;
}

function rotatePoint60(point) {
  return {
    i: -point.j,
    j: point.i + point.j,
  };
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
    .map((cell) => ({
      i: cell.i - minI,
      j: cell.j - minJ,
      o: cell.o,
    }))
    .sort(cellSort);
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

function cellSort(a, b) {
  return a.i - b.i || a.j - b.j || a.o - b.o;
}

function cellKey(cell) {
  return `${cell.i},${cell.j},${cell.o}`;
}

function vertexKey(vertex) {
  return `${vertex.i},${vertex.j}`;
}

function parseCellKey(key) {
  const [i, j, o] = key.split(",").map(Number);
  return { i, j, o };
}

function cellsKey(cells) {
  return [...cells]
    .sort(cellSort)
    .map((cell) => `${cell.i},${cell.j},${cell.o}`)
    .join("|");
}

function squaredDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function convexHull(points) {
  if (points.length < 4) {
    return points;
  }
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);

  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function cross(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
