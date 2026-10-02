"use strict";

const HEXIAMOND_ORDER = 6;
// The board: a hexagon of side 10 (600 triangles).
const BOARD_HEX_SIDE = 10;
const SQRT3 = Math.sqrt(3);
const SQRT3_HALF = SQRT3 / 2;
// The board the camera reads for this lab (see ../camera/boards.js).
const CAMERA_BOARD = "tri10";
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
const RING_EDGE_SLOTS = [0.18, 0.4, 0.62, 0.84];
// Space kept between the piece chips, the screen edges and the controls.
const EDGE_GAP = 4;
// The least space between a chip and a control next to the ring.
const CONTROL_GAP = 8;
// When the ring only fits around a smaller board: the step, and the least
// width of the drawn board.
const RING_SHRINK_STEP = 2;
const BOARD_MIN = 120;
// Phones held sideways: the same query as in styles.css.
const SIDEWAYS = window.matchMedia("(orientation: landscape) and (max-height: 500px)");
// Sideways: the top strip, the space kept along the screen edges, between
// the board and the pieces, between the chips, and between the board group
// and the credit; the least chip, and the board group's height.
const SW = { strip: 56, edge: 10, panelGap: 16, gap: 8, creditGap: 16, chip: 44, bar: 56 };
// The smallest size ../play-ui.js gives the area's number.
const AREA_NUM_MIN = 16;
const ROTATE_60 = { reflect: false, rot: 1 };
const REFLECT = { reflect: true, rot: 0 };

const SYMMETRIES = [];
for (let rot = 0; rot < 6; rot += 1) {
  SYMMETRIES.push({ reflect: false, rot });
}
for (let rot = 0; rot < 6; rot += 1) {
  SYMMETRIES.push({ reflect: true, rot });
}

// Names as in the paper (Abbildung 5), keyed by the canonical shape.
const HEXIAMOND_NAMES = new Map([
  ["0,0,0|0,0,1|0,1,0|0,1,1|0,2,0|0,2,1", "rhomboid"],
  ["0,0,1|0,1,0|0,1,1|0,2,0|0,2,1|1,0,0", "crook"],
  ["0,0,1|0,1,0|0,1,1|0,2,0|0,2,1|1,1,0", "crown"],
  ["0,0,0|0,0,1|0,1,0|0,1,1|0,2,0|1,0,0", "sphinx"],
  ["0,0,1|0,1,0|0,1,1|1,1,0|1,1,1|1,2,0", "snake"],
  ["0,0,0|0,0,1|0,1,0|0,1,1|1,0,0|1,1,0", "yacht"],
  ["0,0,0|0,0,1|0,1,0|0,1,1|1,1,0|1,1,1", "chevron"],
  ["0,0,1|0,1,0|0,1,1|0,2,0|1,1,0|1,1,1", "signpost"],
  ["0,0,0|0,0,1|0,1,0|0,1,1|1,0,0|1,0,1", "lobster"],
  ["0,0,0|0,0,1|0,1,0|0,1,1|1,0,1|1,1,0", "shoe"],
  ["0,0,1|0,1,0|0,1,1|1,0,0|1,0,1|1,1,0", "hexagon"],
  ["0,1,0|0,1,1|0,2,0|1,0,1|1,1,0|1,1,1", "butterfly"],
]);

const dom = {
  boardWrap: document.getElementById("board-wrap"),
  canvas: document.getElementById("board-canvas"),
  tray: document.getElementById("piece-tray"),
  toolbar: document.querySelector(".toolbar"),
  actions: document.querySelector(".board-actions"),
  detectAreaBtn: document.getElementById("detect-area"),
  clearBtn: document.getElementById("clear-board"),
  rotateBtn: document.getElementById("rotate-piece"),
  flipBtn: document.getElementById("flip-piece"),
  areaChip: document.getElementById("area-chip"),
  cameraChip: document.getElementById("camera-chip"),
  cameraHost: document.getElementById("camera-host"),
  sideBrand: document.querySelector(".side-brand"),
  boardbar: document.querySelector(".boardbar"),
  status: document.getElementById("status"),
};

const state = {
  ctx: dom.canvas.getContext("2d"),
  board: null,
  boardCells: [],
  boardCellMap: new Map(),
  boardCellEntries: [],
  boardBounds: null,
  view: { scale: 1, offsetX: 0, offsetY: 0, width: 0, height: 0, dpr: 1 },
  // "edges3": the chips on the three upper sides; "edges5": also down the
  // two lower slanted sides, when the upper sides are too short for them;
  // "edges5gap": as edges5, leaving out the stretch where a chip would come
  // near rotate and flip.
  ringMode: "edges3",
  // Extra room (CSS px) around the drawn board inside its square, when the
  // ring only fits around a smaller board.
  boardInset: 0,
  // The board's six corners (world points), found once.
  boardCorners: null,
  pieceTypes: [],
  pieceTypeMap: new Map(),
  selectedTypeId: null,
  selectedPieceId: null,
  freshPieceId: null,
  placedPieces: [],
  nextPieceId: 1,
  draggingPieceId: null,
  enclosedCells: new Set(),
  leakCells: new Set(),
  enclosedRegionCount: 0,
  enclosedLargest: 0,
  area: 0,
  status: null,
};

// The camera view inside the board (../camera/inboard.js), while it is open.
// auto: opened by the page (a printed sheet's QR code), not by a tap;
// hushed: a view closed without a message.
const camera = { view: null, auto: false, hushed: null };

init();

function init() {
  buildBoard();
  buildPieces();
  wireEvents();
  useTouchTips();
  resizeCanvas();
  refreshTray();
  updateAreaChip(0);
  setStatus("tri.s.ready");
  render();
}

function t(key, vars) {
  return window.i18n ? window.i18n.t(key, vars) : key;
}

// Touch screens have no R or F key, so their tooltips leave the key out.
function useTouchTips() {
  if (!window.matchMedia("(pointer: coarse)").matches) return;
  for (const [btn, key] of [[dom.rotateBtn, "tri.rotateTipTouch"], [dom.flipBtn, "tri.flipTipTouch"]]) {
    btn.setAttribute("data-i18n-title", key);
    btn.title = t(key);
  }
}

function pieceName(typeId) {
  const type = state.pieceTypeMap.get(typeId);
  return type ? type.name : typeId;
}

// The area is measured after every change to the board, as on the hub; a
// tap on the area pill reads the verdict out.
function measureLive() {
  const result = computeEnclosedArea();
  state.enclosedCells = result.enclosedSet;
  state.enclosedRegionCount = result.regionCount;
  state.enclosedLargest = result.largestRegion;
  state.leakCells = result.leakCells;
  updateAreaChip(result.area);
}

function wireEvents() {
  dom.detectAreaBtn.addEventListener("click", measure);

  dom.clearBtn.addEventListener("click", () => {
    state.placedPieces = [];
    state.selectedPieceId = null;
    state.freshPieceId = null;
    state.enclosedRegionCount = 0;
    state.enclosedLargest = 0;
    measureLive();
    setStatus("tri.s.cleared");
    refreshTray();
    render();
  });

  dom.rotateBtn.addEventListener("click", () => rotateSelection());
  dom.flipBtn.addEventListener("click", () => flipSelection());

  document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (window.i18n) window.i18n.setLang(btn.getAttribute("data-lang-btn"));
    });
  });
  document.addEventListener("fc-langchange", () => {
    renderStatus();
    updateAreaChip(state.area);
    localizeCameraChip();
    refreshTray();
    resizeCanvas();
  });

  dom.canvas.addEventListener("pointerdown", onPointerDown);
  dom.canvas.addEventListener("pointermove", onPointerMove);
  dom.canvas.addEventListener("pointerup", onPointerUp);
  dom.canvas.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("resize", resizeCanvas);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resizeCanvas);

  window.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape" && camera.view) {
      closeCamera();
      return;
    }
    const dir = window.FencePlay ? window.FencePlay.arrowOf(event, dom.canvas) : null;
    if (dir) {
      const selected = getSelectedPiece();
      if (!selected || state.draggingPieceId) return;
      event.preventDefault();
      movePieceToward(selected, dir);
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
      removePiece(state.selectedPieceId);
    }
  });

  bindCamera();
}

function measure() {
  const result = computeEnclosedArea();
  state.enclosedCells = result.enclosedSet;
  state.enclosedRegionCount = result.regionCount;
  state.enclosedLargest = result.largestRegion;
  state.leakCells = result.leakCells;
  updateAreaChip(result.area);
  // "Fence closed" only for a real fence: one inside, and no corner the
  // outside slips through.
  const parts = [];
  if (result.area === 0 && !result.cornerLeak) parts.push({ key: "tri.s.areaNone" });
  else if (result.area === 0) parts.push({ key: "tri.s.leakOnly" });
  else if (result.regionCount > 1) parts.push({ key: "tri.s.areaSplit", vars: { area: result.area, regions: result.regionCount } });
  else if (result.cornerLeak) parts.push({ key: result.area === 1 ? "tri.s.area1" : "tri.s.area", vars: { area: result.area } });
  else parts.push({ key: result.area === 1 ? "tri.s.fence1" : "tri.s.fence", vars: { area: result.area } });
  if (result.cornerLeak && result.area > 0) parts.push({ key: "tri.s.leak" });
  setStatusParts(parts);
  render();
}

function removePiece(pieceId) {
  const index = state.placedPieces.findIndex((piece) => piece.id === pieceId);
  if (index < 0) {
    return;
  }
  const removed = state.placedPieces[index];
  state.placedPieces.splice(index, 1);
  if (state.selectedPieceId === pieceId) state.selectedPieceId = null;
  if (state.freshPieceId === pieceId) state.freshPieceId = null;
  measureLive();
  setStatus("tri.s.removed", { name: pieceName(removed.typeId) });
  refreshTray();
  render();
}

// The board comes from the shared lattice module, so the lab, the hub and the
// camera judge fences on the same cells with the same rule (fence-analysis.js).
function buildBoard() {
  const board = LatticeTriangular.buildBoard({ hexSide: BOARD_HEX_SIDE });
  state.board = board;
  state.boardCells = board.cells;
  state.boardCellMap = board.map;
  state.boardCellEntries = board.cells;
  state.boardBounds = board.bounds;
}

function buildPieces() {
  const freeHexiamonds = generateFreePolyiamonds(HEXIAMOND_ORDER);
  freeHexiamonds.sort((a, b) => cellsKey(a).localeCompare(cellsKey(b)));

  const types = freeHexiamonds.map((shape, index) => {
    const key = cellsKey(shape);
    const name = HEXIAMOND_NAMES.get(key) || `H${index + 1}`;
    const variantData = buildVariants(shape);
    return {
      id: name,
      name,
      shapeKey: canonicalizeShape(shape).key,
      color: MARKER_COLORS[index % MARKER_COLORS.length],
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

// A chip dragged onto the board: the piece lands on the nearest free place
// under the finger and follows it until release.
function onChipDown(event, type) {
  if (!window.FencePlay || camera.view) return;
  let pieceId = null;
  window.FencePlay.trayDrag(event, dom.canvas, (e) => {
    const point = pointerToCanvas(e);
    if (!pieceId) {
      state.selectedTypeId = type.id;
      const existing = state.placedPieces.find((p) => p.typeId === type.id);
      if (existing) {
        state.selectedPieceId = existing.id;
      } else {
        const at = findNearestBoardCell(point, type.variants[type.spawnVariant].markerO);
        if (!at || !spawnPiece(type.id, at)) return;
      }
      pieceId = state.selectedPieceId;
      render();
    }
    const piece = state.placedPieces.find((p) => p.id === pieceId);
    if (!piece) return;
    const nearest = findNearestBoardCell(point, state.pieceTypeMap.get(piece.typeId).variants[piece.variantIndex].markerO);
    if (!nearest || (piece.marker.i === nearest.i && piece.marker.j === nearest.j && piece.marker.o === nearest.o)) return;
    if (!canPlace(piece.typeId, piece.variantIndex, nearest, piece.id)) return;
    piece.marker = { i: nearest.i, j: nearest.j, o: nearest.o };
    measureLive();
    render();
  }, () => {
    const piece = pieceId ? state.placedPieces.find((p) => p.id === pieceId) : null;
    if (!piece) return;
    state.freshPieceId = piece.id; // the next tap on it only selects it
    setStatus("tri.s.placed", { name: pieceName(piece.typeId) });
    refreshTray();
    render();
  });
}

function refreshTray() {
  const focusedType = document.activeElement && document.activeElement.dataset
    ? document.activeElement.dataset.type
    : null;
  dom.tray.innerHTML = "";
  state.pieceTypes.forEach((type) => {
    const chip = document.createElement("button");
    chip.className = "piece-chip piece-chip-ring";
    chip.type = "button";
    chip.dataset.type = type.id;
    chip.title = type.name;
    chip.setAttribute("aria-label", t("tri.piece.aria", { name: type.name }));
    const selected = state.selectedTypeId === type.id;
    chip.setAttribute("aria-pressed", selected ? "true" : "false");

    if (selected) {
      chip.classList.add("is-selected");
    }
    if (state.placedPieces.some((piece) => piece.typeId === type.id)) {
      chip.classList.add("is-on-board");
    }

    chip.innerHTML = buildPiecePreviewSvg(type);
    chip.addEventListener("pointerdown", (event) => onChipDown(event, type));
    chip.addEventListener("click", () => {
      if (window.FencePlay && window.FencePlay.afterTrayDrag()) return;
      state.selectedTypeId = type.id;
      const existing = state.placedPieces.find((piece) => piece.typeId === type.id);
      if (existing) {
        state.selectedPieceId = existing.id;
        setStatus("tri.s.selected", { name: type.name });
      } else if (!spawnPiece(type.id)) {
        setStatus("tri.s.noSpace", { name: type.name });
      }
      refreshTray();
      render();
      const again = dom.tray.querySelector(`[data-type="${type.id}"]`);
      if (again) again.focus();
    });
    dom.tray.appendChild(chip);
  });
  layoutPieceRing();
  if (focusedType) {
    const again = dom.tray.querySelector(`[data-type="${focusedType}"]`);
    if (again) again.focus();
  }
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
  // The piece fills most of its chip, so its cells stay large on a phone.
  const scale = 31 / Math.max(width, height, 0.0001);
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
  // A new piece starts selected, but the next tap on it only confirms the
  // selection: removing it takes a second, deliberate tap.
  state.freshPieceId = piece.id;
  measureLive();
  setStatus("tri.s.placed", { name: pieceName(typeId) });
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

// Arrow keys: the selected piece goes to the nearest free place that way.
function movePieceToward(piece, dir) {
  const from = state.boardCellMap.get(cellKey(piece.marker));
  if (!from) return false;
  const markerO = state.pieceTypeMap.get(piece.typeId).variants[piece.variantIndex].markerO;
  const entries = window.FencePlay.towards(state.boardCellEntries, from.centroid, dir, (e) => e.o === markerO);
  for (const entry of entries) {
    if (!canPlace(piece.typeId, piece.variantIndex, entry, piece.id)) continue;
    piece.marker = { i: entry.i, j: entry.j, o: entry.o };
    state.freshPieceId = piece.id; // the next tap on it only selects it
    measureLive();
    setStatus("tri.s.moved", { name: pieceName(piece.typeId) });
    render();
    return true;
  }
  return false;
}

function rotateSelection() {
  const selected = getSelectedPiece();
  if (selected) {
    const type = state.pieceTypeMap.get(selected.typeId);
    const nextVariant = type.rotateMap[selected.variantIndex];
    if (reorientPlacedPiece(selected, nextVariant)) {
      state.freshPieceId = selected.id; // the next tap on it only selects it
      setStatus("tri.s.rotated", { name: pieceName(selected.typeId) });
      measureLive();
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
      state.freshPieceId = selected.id; // the next tap on it only selects it
      setStatus("tri.s.flipped", { name: pieceName(selected.typeId) });
      measureLive();
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
  if (!nextMarker || !canPlace(piece.typeId, nextVariantIndex, nextMarker, piece.id)) {
    setStatus("tri.s.noRoom", { name: pieceName(piece.typeId) });
    return false;
  }

  piece.variantIndex = nextVariantIndex;
  piece.marker = { i: nextMarker.i, j: nextMarker.j, o: nextMarker.o };
  refreshTray();
  return true;
}

function onPointerDown(event) {
  const point = pointerToCanvas(event);
  const nearest = findNearestBoardCell(point, null);
  if (!nearest) {
    return;
  }

  const occupancy = buildOccupancyMap();
  const occupiedBy = occupancy.get(nearest.key);
  if (occupiedBy) {
    state._downPieceId = occupiedBy;
    state._downWasSelected = state.selectedPieceId === occupiedBy && state.freshPieceId !== occupiedBy;
    state.freshPieceId = null;
    state._didDrag = false;
    state._moved = false;
    state._downClientX = event.clientX;
    state._downClientY = event.clientY;
    state._dragSlop = event.pointerType === "touch" ? 10 : 6;
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
  if (!state.draggingPieceId) {
    return;
  }
  if (!state._didDrag) {
    const mdx = event.clientX - state._downClientX;
    const mdy = event.clientY - state._downClientY;
    const slop = state._dragSlop || 6;
    if (mdx * mdx + mdy * mdy > slop * slop) state._didDrag = true;
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
  if (!state._moved) {
    state._moved = true;
    setStatus("tri.s.moving", { name: pieceName(piece.typeId) });
  }
  measureLive();
  render();
}

function onPointerUp(event) {
  const pieceId = state._downPieceId;
  if (pieceId && !state._didDrag) {
    const piece = state.placedPieces.find((item) => item.id === pieceId);
    // Tap on a piece that was already selected removes it (phones have no
    // Delete key); the first tap on a piece only selects it.
    if (piece && state._downWasSelected) {
      removePiece(pieceId);
    } else if (piece) {
      setStatus("tri.s.selectedTap", { name: pieceName(piece.typeId) });
    }
  }
  if (pieceId && state._moved) {
    const piece = state.placedPieces.find((item) => item.id === pieceId);
    if (piece) setStatus("tri.s.moved", { name: pieceName(piece.typeId) });
    // a piece just moved counts as new: the next tap on it only selects it
    if (piece) state.freshPieceId = pieceId;
  }
  state._moved = false;
  state._downPieceId = null;
  state._downWasSelected = false;
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

// What the placed pieces enclose, judged by the shared rule.
function computeEnclosedArea() {
  const occupied = new Set();
  for (const piece of state.placedPieces) {
    for (const cell of pieceAbsoluteCells(piece)) {
      occupied.add(cellKey(cell));
    }
  }
  return FenceAnalysis.analyze({ board: state.board, lattice: LatticeTriangular, occupied });
}

/* ---------- size and ring ---------- */

// The board keeps the size the stylesheet gives it. When the chips on the
// three upper sides would leave the screen or overlap, they also go down the
// two lower slanted sides, and the board shrinks or moves down only as much
// as the ring needs.
function resizeCanvas() {
  state.boardInset = 0;
  // Phones held sideways: the board on the left, the pieces in a grid on
  // its right (styles.css).
  if (sideways()) {
    layoutSideways();
    return;
  }
  // Narrow screens: the pieces sit in rows under the board (styles.css),
  // the board takes the width the stylesheet gives it.
  if (piecesInRows()) {
    const wrap = dom.boardWrap;
    wrap.style.width = "";
    wrap.style.height = "";
    wrap.style.marginTop = "";
    drawAtSize();
    return;
  }
  for (const mode of ["edges3", "edges5"]) {
    state.ringMode = mode;
    fitBoard();
    if (ringFits()) return;
  }
  // The five sides stay as they are while no chip comes near a control or
  // another chip.
  if (ringClear()) return;
  shrinkForRing();
}

// A chip comes near a control or another chip: the board is drawn smaller
// inside its square, step by step, until every chip keeps 8 px from the
// controls and from the other chips, in the way that needs the least of it
// (never below 120 px); at the same size, the ring all round before the ring
// that leaves out the stretch by rotate and flip. Shrinking the square itself
// would not help: rotate and flip sit on its corner and come closer with it.
// When no size clears the ring, the one that comes nearest.
function shrinkForRing() {
  const wrap = dom.boardWrap;
  // Each way of laying the ring, on the square fitBoard gives it; most: the
  // largest extra room that keeps its drawn board at BOARD_MIN or more.
  const ways = ["edges3", "edges5"].map((mode) => {
    state.ringMode = mode;
    fitBoard();
    const box = dom.canvas.getBoundingClientRect();
    return {
      mode,
      width: wrap.style.width,
      height: wrap.style.height,
      marginTop: wrap.style.marginTop,
      most: Math.floor((Math.min(box.width, box.height) - 20 - BOARD_MIN) / 2),
    };
  });
  ways.push({ ...ways[1], mode: "edges5gap" });
  const lay = (way, inset, paint) => {
    state.ringMode = way.mode;
    wrap.style.width = way.width;
    wrap.style.height = way.height;
    wrap.style.marginTop = way.marginTop;
    state.boardInset = inset;
    drawAtSize(paint);
  };
  let best = { way: ways[1], inset: 0, room: ringRoom() };
  const most = Math.max(...ways.map((way) => way.most));
  for (let inset = 0; inset <= most; inset += RING_SHRINK_STEP) {
    for (const way of ways) {
      if (inset > way.most) continue;
      lay(way, inset, false);
      const room = ringRoom();
      if (room >= CONTROL_GAP) {
        lay(way, inset, true);
        return;
      }
      if (room > best.room) best = { way, inset, room };
    }
  }
  lay(best.way, best.inset, true);
}

/* ---------- phones held sideways ---------- */

function sideways() {
  return SIDEWAYS.matches;
}

// Top strip: rotate and flip on the left, the area pill in the middle, back
// to the hub, print and the language switch on the right. Under it, the
// board on the left in a square as tall as the room (at most 52 % of the
// width); on its right the pieces in a grid of chips as large as fits, then
// erase and the camera, then the credit at the bottom. When the chips would
// fall under 44 px, the board gives up a little width.
function layoutSideways() {
  const root = document.documentElement.style;
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const wrap = dom.boardWrap;
  wrap.style.width = "";
  wrap.style.height = "";
  wrap.style.marginTop = "";
  const top = SW.strip + SW.gap;
  const count = ringItems().length;
  let board = Math.floor(Math.min(vh - top - SW.edge, 0.52 * vw));
  let grid = null;
  let height = 0;
  let barTop = 0;
  const lay = () => {
    const left = SW.edge + board + SW.panelGap;
    const width = vw - SW.edge - left;
    root.setProperty("--sw-board", `${board}px`);
    root.setProperty("--sw-panel-left", `${left}px`);
    root.setProperty("--sw-panel-width", `${width}px`);
    const brand = dom.sideBrand.getBoundingClientRect();
    const floor = brand.height > 0 ? brand.top - SW.creditGap : vh - SW.edge;
    barTop = Math.floor(floor - SW.bar);
    height = barTop - SW.gap - top;
    grid = chipGrid(count, width, height);
  };
  lay();
  if (grid.size < SW.chip) {
    // the widest board that leaves room for chips of 44 px in some grid
    let roomier = 0;
    for (let cols = 1; cols <= count; cols += 1) {
      const rows = Math.ceil(count / cols);
      if (rows * SW.chip + (rows - 1) * SW.gap > height) continue;
      const width = cols * SW.chip + (cols - 1) * SW.gap;
      roomier = Math.max(roomier, Math.min(board, Math.floor(vw - 2 * SW.edge - SW.panelGap - width)));
    }
    if (roomier > 0) {
      board = Math.max(BOARD_MIN, roomier);
      lay();
    }
  }
  root.setProperty("--sw-chip", `${Math.max(SW.chip, grid.size)}px`);
  root.setProperty("--sw-cols", String(grid.cols));
  root.setProperty("--sw-bar-top", `${barTop}px`);
  placeAreaPill(vw);
  drawAtSize();
}

// The largest square chips that show all the pieces in width x height, 8 px
// apart, and how many go in a row (the fewest that give that size).
function chipGrid(count, width, height) {
  let best = { size: 0, cols: Math.max(1, count) };
  for (let cols = 1; cols <= count; cols += 1) {
    const rows = Math.ceil(count / cols);
    const size = Math.floor(Math.min((width + SW.gap) / cols - SW.gap, (height + SW.gap) / rows - SW.gap));
    if (size > best.size) best = { size, cols };
  }
  return best;
}

// The area pill sits in the middle of the strip; it moves aside, just
// enough, only where its number at its smallest, with room for three digits
// as ../play-ui.js sizes it, would come closer than 8 px to flip or to back
// to the hub. The toolbar's side padding centres it there.
function placeAreaPill(vw) {
  const root = document.documentElement.style;
  root.removeProperty("--sw-strip-left");
  root.removeProperty("--sw-strip-right");
  const nav = dom.actions.querySelector(".lab-nav");
  if (!nav) return;
  const lo = dom.flipBtn.getBoundingClientRect().right + SW.gap;
  const hi = nav.getBoundingClientRect().left - SW.gap;
  const pill = dom.detectAreaBtn.getBoundingClientRect();
  const num = dom.areaChip.getBoundingClientRect();
  const px = parseFloat(getComputedStyle(dom.areaChip).fontSize) || AREA_NUM_MIN;
  if (!pill.width || !num.width) return;
  const digit = num.width / Math.max(1, dom.areaChip.textContent.length) / px;
  const widest = pill.width - num.width + 3 * digit * AREA_NUM_MIN;
  const middle = vw / 2;
  const centre = hi - lo >= widest ? clamp(middle, lo + widest / 2, hi - widest / 2) : (lo + hi) / 2;
  if (Math.abs(centre - middle) < 0.05) return;
  if (centre < middle) root.setProperty("--sw-strip-right", `${Math.round((vw - 2 * centre) * 10) / 10}px`);
  else root.setProperty("--sw-strip-left", `${Math.round((2 * centre - vw) * 10) / 10}px`);
}

function fitBoard() {
  const wrap = dom.boardWrap;
  wrap.style.width = "";
  wrap.style.height = "";
  wrap.style.marginTop = "";
  let size = wrap.getBoundingClientRect().width;
  for (let pass = 0; pass < 6; pass += 1) {
    drawAtSize();
    const over = ringOverflow();
    if (over.side <= 0.5 && over.below <= 0.5 && over.above <= 0.5) break;
    if (over.above > 0.5 && over.side <= 0.5 && over.below <= 0.5 && over.room >= over.above) {
      wrap.style.marginTop = `${Math.ceil(over.above)}px`;
      drawAtSize();
      break;
    }
    const next = Math.floor(size - 2 * over.side - Math.max(0, over.below + over.above - over.room) - 2);
    if (next >= size || next < 120) break;
    size = next;
    wrap.style.width = `${size}px`;
    wrap.style.height = `${size}px`;
  }
}

// paint: false lays everything out without drawing (while the ring is fitted).
function drawAtSize(paint = true) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = dom.canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));

  if (dom.canvas.width !== width || dom.canvas.height !== height) {
    dom.canvas.width = width;
    dom.canvas.height = height;
  }

  // sideways the board fills its box, keeping room for its outer line
  const room = sideways() ? 2 : 10;
  const bounds = state.boardBounds;
  const boardWidth = bounds.maxX - bounds.minX;
  const boardHeight = bounds.maxY - bounds.minY;
  const scaleFor = (padding) => Math.min(
    (width - padding * 2) / Math.max(boardWidth, 0.0001),
    (height - padding * 2) / Math.max(boardHeight, 0.0001)
  );
  const scale = scaleFor((room + state.boardInset) * dpr);
  const offsetX = (width - boardWidth * scale) * 0.5 - bounds.minX * scale;
  const offsetY = (height - boardHeight * scale) * 0.5 - bounds.minY * scale;

  // full: the scale without the extra room (the board group keeps its width)
  state.view = { scale, offsetX, offsetY, width, height, dpr, full: scaleFor(room * dpr) };
  placeBoardBar();
  layoutPieceRing();
  if (!paint) return;
  render();
  if (camera.view && typeof camera.view.refresh === "function") camera.view.refresh();
}

// Wide screens: erase and the camera right under the drawn board (play-ui.js).
// Phones, upright or sideways: where the stylesheet puts them.
function placeBoardBar() {
  if (!window.FencePlay || !window.FencePlay.placeBar) return;
  let drawn = null;
  if (!piecesInRows() && !sideways()) {
    const rect = dom.canvas.getBoundingClientRect();
    const b = state.boardBounds;
    const { scale, offsetX, offsetY, dpr, full } = state.view;
    drawn = {
      left: rect.left + (b.minX * scale + offsetX) / dpr,
      right: rect.left + (b.maxX * scale + offsetX) / dpr,
      bottom: rect.top + (b.maxY * scale + offsetY) / dpr,
    };
    // A board drawn smaller for the ring keeps the group as wide as the
    // board at its full size, so the credit keeps its room.
    if (state.boardInset > 0) {
      const grow = ((b.maxX - b.minX) * (full - scale)) / dpr / 2;
      drawn.left -= grow;
      drawn.right += grow;
    }
  }
  window.FencePlay.placeBar(dom.boardbar, dom.sideBrand, drawn);
}

// True when the stylesheet lays the pieces in rows under the board.
function piecesInRows() {
  return getComputedStyle(dom.tray).position === "static";
}

function ringItems() {
  return [...dom.tray.querySelectorAll(".piece-chip")];
}

// The lowest point the ring may reach: the top of the board group (erase and
// the camera, under the board), or the bottom of the screen.
function ringFloor() {
  const vh = window.innerHeight;
  const bar = dom.boardbar ? dom.boardbar.getBoundingClientRect() : null;
  return (bar && bar.height > 0 ? Math.min(vh, bar.top) : vh) - EDGE_GAP;
}

// How far the chips (and rotate and flip, at the top left) reach past the
// screen sides, below the floor, and up into the toolbar, and how far the
// board group under the board reaches below the screen; room = free space
// under everything for moving the board down.
function ringOverflow() {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const floor = ringFloor();
  const top = dom.toolbar.getBoundingClientRect().bottom + EDGE_GAP;
  let side = 0, below = 0, above = 0, lowest = dom.boardWrap.getBoundingClientRect().bottom;
  for (const el of [...ringItems(), dom.actions]) {
    const b = el.getBoundingClientRect();
    if (b.width === 0) continue;
    side = Math.max(side, EDGE_GAP - b.left, b.right - (vw - EDGE_GAP));
    below = Math.max(below, b.bottom - floor);
    above = Math.max(above, top - b.top);
    lowest = Math.max(lowest, b.bottom);
  }
  const bar = dom.boardbar ? dom.boardbar.getBoundingClientRect() : null;
  if (bar && bar.height > 0) {
    below = Math.max(below, bar.bottom - (vh - EDGE_GAP));
    lowest = Math.max(lowest, bar.bottom);
  }
  return { side, below, above, room: vh - EDGE_GAP - lowest };
}

// The ring fits when every chip is on screen, below the toolbar, and clear of
// the other chips and of the controls on the board.
function ringFits() {
  const over = ringOverflow();
  if (over.side > 0.5 || over.below > 0.5 || over.above > 0.5) return false;
  const boxes = ringItems().map((el) => el.getBoundingClientRect());
  const fixed = [dom.actions, dom.sideBrand]
    .filter((el) => el && el.offsetParent !== null)
    .map((el) => el.getBoundingClientRect())
    .filter((b) => b.width > 0);
  const meets = (a, b, m = 0) => a.left - m < b.right && b.left - m < a.right && a.top - m < b.bottom && b.top - m < a.bottom;
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) if (meets(boxes[i], boxes[j])) return false;
    for (const f of fixed) if (meets(boxes[i], f, CONTROL_GAP)) return false;
  }
  return true;
}

// The controls the chips keep 8 px from: rotate, flip, the area (only its
// strip: ../play-ui.js lets it reach lower only into free room), back to the
// hub, print, the language switch, erase, the camera and the credit.
function ringControls() {
  const out = [];
  const add = (el, tall) => {
    if (!el || el.hidden) return;
    const b = el.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) return;
    out.push({ left: b.left, top: b.top, right: b.right, bottom: tall ? Math.min(b.bottom, b.top + tall) : b.bottom });
  };
  add(dom.rotateBtn);
  add(dom.flipBtn);
  add(dom.detectAreaBtn, dom.toolbar.getBoundingClientRect().height);
  dom.actions.querySelectorAll(".lab-nav a").forEach((el) => add(el));
  add(document.querySelector(".langSel"));
  add(dom.clearBtn);
  add(dom.cameraChip);
  add(dom.sideBrand);
  return out;
}

// The least space between a chip and a control or another chip (negative:
// how deep two of them overlap); -Infinity when a chip leaves the screen.
function ringRoom() {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const boxes = ringItems().map((el) => el.getBoundingClientRect()).filter((b) => b.width > 0);
  const controls = ringControls();
  const apart = (a, b) => {
    const dx = Math.max(a.left - b.right, b.left - a.right);
    const dy = Math.max(a.top - b.bottom, b.top - a.bottom);
    return dx < 0 && dy < 0 ? Math.max(dx, dy) : Math.hypot(Math.max(0, dx), Math.max(0, dy));
  };
  let room = Infinity;
  for (let i = 0; i < boxes.length; i += 1) {
    const a = boxes[i];
    if (a.left < EDGE_GAP || a.top < EDGE_GAP || a.right > vw - EDGE_GAP || a.bottom > vh - EDGE_GAP) return -Infinity;
    for (let j = i + 1; j < boxes.length; j += 1) room = Math.min(room, apart(a, boxes[j]));
    for (const c of controls) room = Math.min(room, apart(a, c));
  }
  return room;
}

// The ring is clear when every chip is on screen and keeps 8 px from every
// control and from every other chip.
function ringClear() {
  return ringRoom() >= CONTROL_GAP;
}

function layoutPieceRing() {
  if (!state.boardCellEntries.length) {
    return;
  }

  const rect = dom.canvas.getBoundingClientRect();
  const boardHex = getBoardHexVerticesCss();
  if (!boardHex || rect.width === 0) {
    return;
  }
  if (piecesInRows() || sideways()) {
    for (const el of dom.tray.querySelectorAll(".piece-chip-ring")) {
      el.style.left = "";
      el.style.top = "";
      el.style.transform = "";
      el.style.transformOrigin = "";
    }
    return;
  }

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
  const outwardOf = (a, b) => {
    const edgeVec = { x: b.x - a.x, y: b.y - a.y };
    const edgeLen = Math.hypot(edgeVec.x, edgeVec.y) || 1;
    const midpoint = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
    const toOutside = { x: midpoint.x - center.x, y: midpoint.y - center.y };
    const n1 = { x: -edgeVec.y / edgeLen, y: edgeVec.x / edgeLen };
    const n2 = { x: edgeVec.y / edgeLen, y: -edgeVec.x / edgeLen };
    const dot1 = n1.x * toOutside.x + n1.y * toOutside.y;
    return { edgeVec, edgeLen, normal: dot1 >= 0 ? n1 : n2 };
  };

  let ordered = [];
  if (state.ringMode === "edges3") {
    const chipClearance = 14;
    const edges = [
      { a: boardHex.left, b: boardHex.topLeft },
      { a: boardHex.topLeft, b: boardHex.topRight },
      { a: boardHex.topRight, b: boardHex.right },
    ];
    for (const edgeDef of edges) {
      const { edgeVec, edgeLen, normal } = outwardOf(edgeDef.a, edgeDef.b);
      const outwardPx = Math.abs(normal.x) * halfW + Math.abs(normal.y) * halfH + chipClearance;
      for (const tt of RING_EDGE_SLOTS) {
        ordered.push({
          x: edgeDef.a.x + edgeVec.x * tt + normal.x * outwardPx,
          y: edgeDef.a.y + edgeVec.y * tt + normal.y * outwardPx,
          nx: normal.x,
          ny: normal.y,
          tx: edgeVec.x / edgeLen,
          ty: edgeVec.y / edgeLen,
        });
      }
    }
  } else {
    // Evenly along the five sides that do not face the rotate and flip
    // buttons, from low on the lower left side, over the top, to low on the
    // lower right side.
    const chipClearance = 8;
    const along = (a, b, tt) => ({ x: a.x + (b.x - a.x) * tt, y: a.y + (b.y - a.y) * tt });
    const path = [
      along(boardHex.bottomLeft, boardHex.left, 0.3),
      boardHex.left,
      boardHex.topLeft,
      boardHex.topRight,
      boardHex.right,
      along(boardHex.bottomRight, boardHex.right, 0.3),
    ];
    const lens = [];
    let total = 0;
    for (let i = 0; i + 1 < path.length; i += 1) {
      lens.push(Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y));
      total += lens[i];
    }
    // The chip's place at distance dist along the path.
    const spotAt = (dist) => {
      let d = dist;
      let i = 0;
      while (i < lens.length - 1 && d > lens[i]) {
        d -= lens[i];
        i += 1;
      }
      const a = path[i];
      const b = path[i + 1];
      const { edgeVec, edgeLen, normal } = outwardOf(a, b);
      const tt = lens[i] > 0 ? d / lens[i] : 0;
      const outwardPx = Math.abs(normal.x) * halfW + Math.abs(normal.y) * halfH + chipClearance;
      return {
        x: a.x + edgeVec.x * tt + normal.x * outwardPx,
        y: a.y + edgeVec.y * tt + normal.y * outwardPx,
        nx: normal.x,
        ny: normal.y,
        tx: edgeVec.x / edgeLen,
        ty: edgeVec.y / edgeLen,
      };
    };
    if (state.ringMode === "edges5gap") {
      // Evenly along the stretches of the path where a chip keeps 8 px from
      // rotate and flip, one pixel at a time.
      const half = Math.max(halfW, halfH);
      const near = ringObstacles(rect);
      const free = [];
      for (let d = 0; d <= total; d += 1) {
        const p = spotAt(d);
        if (!nearBox(p, half, CONTROL_GAP, near)) free.push(d);
      }
      for (let k = 0; k < chips.length; k += 1) {
        const at = free.length ? free[Math.min(free.length - 1, Math.floor(((k + 0.5) * free.length) / chips.length))] : ((k + 0.5) * total) / chips.length;
        ordered.push(spotAt(at));
      }
    } else {
      const step = total / chips.length;
      for (let k = 0; ordered.length < chips.length; k += 1) {
        ordered.push(spotAt((k + 0.5) * step));
      }
    }
  }
  clearObstacles(ordered.slice(0, chips.length), Math.max(halfW, halfH), ringObstacles(rect));

  chips.forEach((chip, index) => {
    const anchor = ordered[index % ordered.length];
    chip.style.left = `${anchor.x}px`;
    chip.style.top = `${anchor.y}px`;
  });
}

// The controls next to the ring (rotate and flip), as boxes in canvas pixels.
function ringObstacles(rect) {
  const boxes = [];
  for (const el of [dom.actions]) {
    if (!el || el.hidden) continue;
    const b = el.getBoundingClientRect();
    if (b.width === 0) continue;
    boxes.push({ l: b.left - rect.left, t: b.top - rect.top, r: b.right - rect.left, b: b.bottom - rect.top });
  }
  return boxes;
}

// True when a chip centred on p (half its side) comes within gap of one of
// these boxes.
function nearBox(p, half, gap, boxes) {
  const g = gap + 0.5;
  return boxes.some((b) => p.x + half + g > b.l && p.x - half - g < b.r && p.y + half + g > b.t && p.y - half - g < b.b);
}

// A chip that would come within CONTROL_GAP of one of these controls, or
// touch an earlier chip, slides a little along its side or away from the
// board until it is clear.
function clearObstacles(spots, half, boxes) {
  const gap = 3;
  const boxGap = CONTROL_GAP + 0.5;
  const hits = (p, upto) => {
    for (const b of boxes) {
      if (p.x + half + boxGap > b.l && p.x - half - boxGap < b.r && p.y + half + boxGap > b.t && p.y - half - boxGap < b.b) return true;
    }
    for (let j = 0; j < upto; j += 1) {
      if (Math.abs(spots[j].x - p.x) < 2 * half + gap && Math.abs(spots[j].y - p.y) < 2 * half + gap) return true;
    }
    return false;
  };
  spots.forEach((s, i) => {
    if (!hits(s, i)) return;
    const dirs = [
      { x: s.nx, y: s.ny },
      { x: s.tx, y: s.ty },
      { x: -s.tx, y: -s.ty },
    ];
    for (let step = 2; step <= 48; step += 2) {
      for (const d of dirs) {
        const p = { x: s.x + d.x * step, y: s.y + d.y * step };
        if (!hits(p, i)) {
          s.x = p.x;
          s.y = p.y;
          return;
        }
      }
    }
  });
}

function toCssFromScreen(point) {
  const rect = dom.canvas.getBoundingClientRect();
  const sx = rect.width / Math.max(state.view.width, 1);
  const sy = rect.height / Math.max(state.view.height, 1);
  return { x: point.x * sx, y: point.y * sy };
}

// World point to CSS pixels inside the canvas box (also the camera window).
function worldToCss(point) {
  const dpr = state.view.dpr || 1;
  return {
    x: (point.x * state.view.scale + state.view.offsetX) / dpr,
    y: (point.y * state.view.scale + state.view.offsetY) / dpr,
  };
}

// The board's six corners, in CSS pixels inside the canvas box. They are
// found once, among the cells' corners (the board never changes, and the
// drawing only scales and moves it), so the ring can be laid many times.
function getBoardHexVerticesCss() {
  if (!state.boardCorners) state.boardCorners = findBoardCorners();
  const c = state.boardCorners;
  if (!c) {
    return null;
  }
  const css = (vertex) => toCssFromScreen(worldToScreen(vertex));
  return {
    left: css(c.left),
    right: css(c.right),
    topLeft: css(c.topLeft),
    topRight: css(c.topRight),
    bottomLeft: css(c.bottomLeft),
    bottomRight: css(c.bottomRight),
  };
}

function findBoardCorners() {
  const hull = convexHull(state.boardCellEntries.flatMap((entry) => entry.vertices));
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

/* ---------- drawing ---------- */

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
    // grid lines at 3:1 against the cells, as on the hub; a thin line on a
    // 1x screen is spread over two pixels, so it gets more ink there
    ctx.strokeStyle = (window.devicePixelRatio || 1) < 1.5 ? "rgba(170, 220, 255, 0.3)" : "rgba(170, 220, 255, 0.27)";
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
    if (!isSelected && window.FencePlay) {
      // a darker line around the piece: touching pieces stay apart whatever their colours
      const polys = cells.map((c) => state.boardCellMap.get(cellKey(c))).filter(Boolean).map((e) => e.vertices);
      ctx.save();
      ctx.beginPath();
      for (const [a, b] of window.FencePlay.outerEdges(polys)) {
        const p = worldToScreen(a), q = worldToScreen(b);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
      }
      ctx.lineWidth = Math.max(1.6, state.view.scale * 0.08);
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(4,10,20,0.88)";
      ctx.stroke();
      ctx.restore();
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

/* ---------- area and status ---------- */

function updateAreaChip(area) {
  state.area = area;
  dom.areaChip.textContent = String(area);
}

// Keeps the message as keys so a language switch can render it again.
function setStatus(key, vars) {
  setStatusParts([{ key, vars }]);
}

function setStatusParts(parts) {
  state.status = parts;
  renderStatus();
}

function renderStatus() {
  if (!state.status) {
    return;
  }
  dom.status.textContent = state.status.map((part) => t(part.key, part.vars || undefined)).join(" ");
}

/* ---------- camera inside the board ---------- */

// The camera chip turns the board itself into the camera window, in the
// board's hexagon: the printed board is straightened onto the drawn one, cell
// on cell, and once the view is steady its pieces are put on this board and
// measured. Tapping the chip again closes the camera; the pieces stay.
function cameraSupported() {
  try {
    return Boolean(
      window.FenceInboard &&
        typeof window.FenceInboard.open === "function" &&
        window.FenceInboard.supported() &&
        window.FenceBoards &&
        window.FenceBoards.get(CAMERA_BOARD)
    );
  } catch (e) {
    return false;
  }
}

function bindCamera() {
  // The camera scripts load after this one (defer): decide once they ran.
  const decide = () => {
    dom.cameraChip.hidden = !cameraSupported();
    resizeCanvas();
    cameraFromSheet();
    window.addEventListener("hashchange", cameraFromSheet);
  };
  if (document.readyState === "complete") decide();
  else window.addEventListener("load", decide);
  dom.cameraChip.addEventListener("click", () => {
    if (camera.view) closeCamera();
    else openCamera();
  });
  // Leaving the page always switches the camera off.
  window.addEventListener("pagehide", () => closeCamera(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") closeCamera(true);
  });
}

function localizeCameraChip() {
  const key = camera.view ? "tri.cameraClose" : "tri.cameraOpen";
  dom.cameraChip.setAttribute("data-i18n-title", key);
  dom.cameraChip.setAttribute("data-i18n-aria-label", key);
  dom.cameraChip.title = t(key);
  dom.cameraChip.setAttribute("aria-label", t(key));
  dom.cameraChip.setAttribute("aria-pressed", camera.view ? "true" : "false");
  dom.cameraChip.classList.toggle("is-active", Boolean(camera.view));
}

// A printed sheet's QR code (camera/?board=<id>) lands here as
// index.html#camera: the camera opens inside the board at once.
function cameraFromSheet() {
  if (!/^#camera$/.test(window.location.hash)) return;
  try {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  } catch (e) {
    /* the hash simply stays */
  }
  if (!camera.view && cameraSupported()) openCamera(true);
}

// The camera opened by the page could not start by itself (blocked, or the
// browser waits for a tap): it closes without a message and its chip is lit
// for that tap.
function waitForTap() {
  camera.hushed = camera.view;
  closeCamera(true);
  dom.cameraChip.classList.add("is-ready");
  setStatus("tri.cameraOpen"); // the lit chip, said for screen readers
}

function openCamera(auto = false) {
  if (camera.view || !cameraSupported()) return;
  dom.cameraChip.classList.remove("is-ready");
  state.draggingPieceId = null;
  dom.cameraHost.hidden = false;
  dom.boardWrap.classList.add("camera-mode");
  let view = null;
  try {
    view = window.FenceInboard.open({
      host: dom.cameraHost,
      announce: false, // the page reads the camera states out itself
      boardId: CAMERA_BOARD,
      worldToHost: worldToCss,
      onPlacements: cameraPlacements,
      onState: cameraStateChanged,
      onClose: () => {
        const quiet = camera.hushed === view;
        if (quiet) camera.hushed = null;
        cameraClosed(quiet);
      },
    });
  } catch (e) {
    view = null;
  }
  if (!view) {
    dom.cameraHost.hidden = true;
    dom.boardWrap.classList.remove("camera-mode");
    if (auto) {
      dom.cameraChip.classList.add("is-ready");
      setStatus("tri.cameraOpen");
    }
    else setStatus("tri.s.camError");
    return;
  }
  camera.view = view;
  camera.auto = auto;
  document.body.dataset.fcCamera = "starting";
  localizeCameraChip();
}

// quiet: the page is going away, no message.
function closeCamera(quiet = false) {
  const view = camera.view;
  if (!view) return;
  camera.view = null;
  try {
    view.close();
  } catch (e) {
    /* already closed */
  }
  cameraClosed(quiet);
}

// Called when the camera view is gone, whoever closed it.
function cameraClosed(quiet) {
  camera.view = null;
  dom.cameraHost.hidden = true;
  dom.boardWrap.classList.remove("camera-mode");
  document.body.dataset.fcCamera = "stopped";
  localizeCameraChip();
  if (quiet !== true) setStatus("tri.s.camClosed");
}

function cameraStateChanged(value) {
  if (!camera.view) return;
  const s = String(value || "");
  if (s === "searching" || s === "locked") camera.auto = false;
  if (camera.auto && (s === "stopped" || s.indexOf("error") === 0)) {
    waitForTap();
    return;
  }
  if (s === document.body.dataset.fcCamera) return;
  document.body.dataset.fcCamera = s;
  if (s === "starting") setStatus("tri.s.camStarting");
  else if (s === "searching") setStatus("tri.s.camSearching");
  else if (s === "locked") setStatus("tri.s.camLocked");
  else if (s.indexOf("error") === 0) setStatus("tri.s.camError");
}

// A new steady set of pieces read on paper: checked like an import, then put
// on the board and measured. Anything that does not fit is ignored.
function cameraPlacements(placements, result) {
  if (!camera.view) return;
  const boardId = result && result.boardId ? result.boardId : CAMERA_BOARD;
  const pieces = piecesFromPaper(boardId, placements);
  if (!pieces) return;
  state.placedPieces = pieces;
  state.selectedPieceId = null;
  state.freshPieceId = null;
  state.draggingPieceId = null;
  refreshTray();
  measure();
}

// placements: [{ typeId, variantIndex, marker }] in the shared lattice's
// terms (camera/boards.js piece types, lattice-triangular.js variants).
// Returns the lab's own placed pieces, or null when anything does not check
// out.
function piecesFromPaper(boardId, list) {
  const Boards = window.FenceBoards;
  if (!Boards || boardId !== CAMERA_BOARD || !Array.isArray(list)) return null;
  if (list.length > state.pieceTypes.length) return null;
  let types;
  try {
    types = new Map(Boards.pieceTypes(boardId).map((type) => [type.id, type]));
  } catch (e) {
    return null;
  }
  const usedTypes = new Set();
  const taken = new Set();
  const pieces = [];
  for (const item of list) {
    if (!item || typeof item !== "object") return null;
    const type = types.get(item.typeId);
    if (!type || usedTypes.has(item.typeId)) return null;
    usedTypes.add(item.typeId);
    const variants = LatticeTriangular.buildVariants(type.cells.map((c) => ({ i: c.i, j: c.j, o: c.o }))).variants;
    const vi = item.variantIndex;
    if (!Number.isInteger(vi) || vi < 0 || vi >= variants.length) return null;
    const m = item.marker;
    if (!m || !Number.isInteger(m.i) || !Number.isInteger(m.j) || m.o !== variants[vi].markerO) return null;
    const cells = variants[vi].cells.map((c) => ({ i: c.i + m.i, j: c.j + m.j, o: c.o }));
    for (const cell of cells) {
      const key = cellKey(cell);
      if (!state.boardCellMap.has(key) || taken.has(key)) return null;
      taken.add(key);
    }
    // The same shape among this lab's pieces, in the orientation that covers
    // exactly these cells.
    const shapeKey = canonicalizeShape(cells).key;
    const own = state.pieceTypes.find((p) => p.shapeKey === shapeKey);
    if (!own || pieces.some((p) => p.typeId === own.id)) return null;
    const placed = ownPlacement(own, cells);
    if (!placed) return null;
    pieces.push({ id: state.nextPieceId++, typeId: own.id, variantIndex: placed.variantIndex, marker: placed.marker });
  }
  return pieces;
}

// The variant of a lab piece and its marker cell that cover exactly `cells`.
function ownPlacement(type, cells) {
  const target = cellsKey(cells);
  const first = [...cells].sort(cellSort)[0];
  for (let vi = 0; vi < type.variants.length; vi += 1) {
    const v = type.variants[vi];
    const r0 = v.cells[0];
    if (r0.o !== first.o) continue;
    const marker = { i: first.i - r0.i, j: first.j - r0.j, o: v.markerO };
    const covered = v.cells.map((c) => ({ i: c.i + marker.i, j: c.j + marker.j, o: c.o }));
    if (cellsKey(covered) === target) return { variantIndex: vi, marker };
  }
  return null;
}

/* ---------- lattice ---------- */

function pointerToCanvas(event) {
  const rect = dom.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * dom.canvas.width) / Math.max(1, rect.width),
    y: ((event.clientY - rect.top) * dom.canvas.height) / Math.max(1, rect.height),
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
