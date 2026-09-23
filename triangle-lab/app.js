"use strict";

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
const ROTATE_60 = { reflect: false, rot: 1 };
const REFLECT = { reflect: true, rot: 0 };

const SYMMETRIES = [];
for (let rot = 0; rot < 6; rot += 1) {
  SYMMETRIES.push({ reflect: false, rot });
}
for (let rot = 0; rot < 6; rot += 1) {
  SYMMETRIES.push({ reflect: true, rot });
}

// Names and order as in the paper (Abbildung 5), keyed by the canonical shape.
const HEXIAMOND_NAMES = [
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
];

const dom = {
  stage: document.getElementById("stage"),
  boardWrap: document.getElementById("board-wrap"),
  canvas: document.getElementById("board-canvas"),
  tray: document.getElementById("piece-tray"),
  detectAreaBtn: document.getElementById("detect-area"),
  clearBtn: document.getElementById("clear-board"),
  rotateBtn: document.getElementById("rotate-piece"),
  flipBtn: document.getElementById("flip-piece"),
  areaValue: document.getElementById("area-value"),
  status: document.getElementById("status"),
};

const state = {
  ctx: dom.canvas.getContext("2d"),
  boardCells: [],
  boardCellMap: new Map(),
  boardCellEntries: [],
  board: null,
  boardBounds: null,
  view: { scale: 1, offsetX: 0, offsetY: 0, width: 0, height: 0 },
  layout: { mode: "ring", cw: 0, ch: 0, padL: 0, padT: 0, slots: [] },
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
  status: null,
};

// Inner margin of the drawing, in CSS pixels.
const CANVAS_PADDING = 10;
// Outward normals (degrees, y down) of the six sides of the board outline.
// The board is a flat-top hexagon.
const OUTLINE_NORMALS = [30, 90, 150, 210, 270, 330];
const RING_SIDE_SLOTS = [0.18, 0.4, 0.62, 0.84];
const CHIP_CLEARANCE = 8;
// Controls in a side column and the board filling the rest of the screen:
// the same condition as in styles.css.
const WIDE = window.matchMedia("(min-width: 640px) and (min-aspect-ratio: 5/4)");
// Space between two chips, and between the chips and the board.
const CHIP_GAP = 8;
// Smallest board side tried, in CSS pixels.
const MIN_BOARD = 160;
// The ring is kept when its board is at least this share of the largest.
const RING_PREFERENCE = 0.97;

init();

function init() {
  buildBoard();
  buildPieces();
  wireEvents();
  useTouchTips();
  refreshTray();
  updateAreaChip(0);
  setStatus("tri.s.ready");
  fitLayout();
}

// Touch screens have no R or F key, so their tooltips leave the key out.
function useTouchTips() {
  if (!window.matchMedia("(pointer: coarse)").matches) return;
  for (const [btn, key] of [[dom.rotateBtn, "tri.rotateTipTouch"], [dom.flipBtn, "tri.flipTipTouch"]]) {
    btn.setAttribute("data-i18n-title", key);
    btn.title = t(key);
  }
}

function t(key, vars) {
  return window.i18n ? window.i18n.t(key, vars) : key;
}

function pieceName(typeId) {
  const type = state.pieceTypeMap.get(typeId);
  return type ? type.name : typeId;
}

function resetMeasure() {
  state.enclosedCells = new Set();
  state.leakCells = new Set();
  updateAreaChip(0);
}

function wireEvents() {
  dom.detectAreaBtn.addEventListener("click", () => {
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
  });

  dom.clearBtn.addEventListener("click", () => {
    state.placedPieces = [];
    state.selectedPieceId = null;
    state.freshPieceId = null;
    state.enclosedRegionCount = 0;
    state.enclosedLargest = 0;
    resetMeasure();
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
    refreshTray();
    fitLayout();
  });

  dom.canvas.addEventListener("pointerdown", onPointerDown);
  dom.canvas.addEventListener("pointermove", onPointerMove);
  dom.canvas.addEventListener("pointerup", onPointerUp);
  dom.canvas.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("resize", fitLayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitLayout);

  window.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
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
  resetMeasure();
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
  const byKey = new Map(freeHexiamonds.map((shape) => [cellsKey(shape), shape]));
  const named = HEXIAMOND_NAMES.filter(([key]) => byKey.has(key)).map(([key, name]) => ({ name, shape: byKey.get(key) }));
  const known = new Set(HEXIAMOND_NAMES.map(([key]) => key));
  freeHexiamonds
    .filter((shape) => !known.has(cellsKey(shape)))
    .forEach((shape, index) => named.push({ name: `H${index + 1}`, shape }));

  // Each piece keeps the colour it always had: colours follow the sorted
  // shape keys, while the tray follows the paper's order.
  const colourRank = new Map(
    freeHexiamonds
      .map((shape) => cellsKey(shape))
      .sort((a, b) => a.localeCompare(b))
      .map((key, rank) => [key, rank])
  );
  const types = named.map((entry) => {
    const variantData = buildVariants(entry.shape);
    const rank = colourRank.get(cellsKey(entry.shape));
    return {
      id: entry.name,
      name: entry.name,
      color: MARKER_COLORS[rank % MARKER_COLORS.length],
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
  state.pieceTypes.forEach((type) => {
    const chip = document.createElement("button");
    chip.className = "piece-chip";
    chip.type = "button";
    chip.title = type.name;
    chip.dataset.type = type.id;
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
    chip.addEventListener("click", () => {
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
  // A new piece starts selected, but the next tap on it only confirms the
  // selection: removing it takes a second, deliberate tap.
  state.freshPieceId = piece.id;
  resetMeasure();
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

function rotateSelection() {
  const selected = getSelectedPiece();
  if (selected) {
    const type = state.pieceTypeMap.get(selected.typeId);
    const nextVariant = type.rotateMap[selected.variantIndex];
    if (reorientPlacedPiece(selected, nextVariant)) {
      setStatus("tri.s.rotated", { name: pieceName(selected.typeId) });
      resetMeasure();
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
      setStatus("tri.s.flipped", { name: pieceName(selected.typeId) });
      resetMeasure();
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
    setStatus("tri.s.noRoom", { name: pieceName(piece.typeId) });
    return false;
  }

  if (!canPlace(piece.typeId, nextVariantIndex, nextMarker, piece.id)) {
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
    // The measurement no longer describes the board: say what happened.
    state._moved = true;
    setStatus("tri.s.moving", { name: pieceName(piece.typeId) });
  }
  resetMeasure();
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

/* ---------- layout ---------- */

function cssNumber(name, fallback) {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
}

// Height of everything on the page except the board stage.
function heightAroundStage() {
  const main = dom.stage.parentElement;
  const app = main.parentElement;
  const px = (el, prop) => parseFloat(getComputedStyle(el)[prop]) || 0;
  let h = px(app, "paddingTop") + px(app, "paddingBottom");
  for (const el of app.children) if (el !== main) h += el.offsetHeight;
  const kids = [...main.children];
  h += px(main, "paddingTop") + px(main, "paddingBottom") + px(main, "rowGap") * (kids.length - 1);
  for (const el of kids) if (el !== dom.stage) h += el.offsetHeight;
  return h;
}

// Canvas size that fits the board into a box of w x h CSS pixels.
function canvasForBox(w, h) {
  const b = state.boardBounds;
  const bw = Math.max(b.maxX - b.minX, 0.0001);
  const bh = Math.max(b.maxY - b.minY, 0.0001);
  const scale = Math.max(0.0001, Math.min((w - 2 * CANVAS_PADDING) / bw, (h - 2 * CANVAS_PADDING) / bh));
  return { cw: Math.floor(bw * scale + 2 * CANVAS_PADDING), ch: Math.floor(bh * scale + 2 * CANVAS_PADDING) };
}

// Board transform for a canvas of cw x ch CSS pixels (same formula as
// resizeCanvas, without the device pixel ratio).
function viewForCanvas(cw, ch) {
  const b = state.boardBounds;
  const bw = Math.max(b.maxX - b.minX, 0.0001);
  const bh = Math.max(b.maxY - b.minY, 0.0001);
  const scale = Math.max(0.0001, Math.min((cw - 2 * CANVAS_PADDING) / bw, (ch - 2 * CANVAS_PADDING) / bh));
  return {
    scale,
    offsetX: (cw - bw * scale) * 0.5 - b.minX * scale,
    offsetY: (ch - bh * scale) * 0.5 - b.minY * scale,
  };
}

// The board outline: the tightest hexagon around every cell, as support
// lines {n, h} (outward normal, distance) and corners (line k meets k+1).
function boardOutline(view) {
  const lines = OUTLINE_NORMALS.map((deg) => {
    const a = (deg * Math.PI) / 180;
    const n = { x: Math.cos(a), y: Math.sin(a) };
    let h = -Infinity;
    for (const entry of state.boardCellEntries) {
      for (const v of entry.vertices) {
        h = Math.max(h, (v.x * view.scale + view.offsetX) * n.x + (v.y * view.scale + view.offsetY) * n.y);
      }
    }
    return { n, h };
  });
  const corners = lines.map((l1, k) => {
    const l2 = lines[(k + 1) % lines.length];
    const det = l1.n.x * l2.n.y - l1.n.y * l2.n.x;
    return {
      x: (l1.h * l2.n.y - l2.h * l1.n.y) / det,
      y: (l1.n.x * l2.h - l2.n.x * l1.h) / det,
    };
  });
  return { lines, corners };
}

// Chip centres along the three upper sides, clockwise from the left corner.
function ringSlots(view, chip) {
  const { lines, corners } = boardOutline(view);
  const half = chip / 2;
  const slots = [];
  for (const k of [3, 4, 5]) {
    const a = corners[(k + lines.length - 1) % lines.length];
    const b = corners[k];
    const n = lines[k].n;
    const off = (Math.abs(n.x) + Math.abs(n.y)) * half + CHIP_CLEARANCE;
    for (const tt of RING_SIDE_SLOTS) {
      slots.push({ x: a.x + (b.x - a.x) * tt + n.x * off, y: a.y + (b.y - a.y) * tt + n.y * off });
    }
  }
  return slots;
}

// Chip centres in rows under a board of cw x ch pixels.
function traySlots(cw, ch, chip, count) {
  const perRow = Math.max(1, Math.floor((cw + CHIP_GAP) / (chip + CHIP_GAP)));
  const rows = Math.ceil(count / perRow);
  const slots = [];
  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / perRow);
    const inRow = row < rows - 1 ? perRow : count - perRow * (rows - 1);
    const col = i - row * perRow;
    const rowWidth = inRow * chip + (inRow - 1) * CHIP_GAP;
    slots.push({
      x: (cw - rowWidth) / 2 + chip / 2 + col * (chip + CHIP_GAP),
      y: ch + CHIP_GAP + chip / 2 + row * (chip + CHIP_GAP),
    });
  }
  return { slots, height: CHIP_GAP + rows * chip + (rows - 1) * CHIP_GAP };
}

// Three ways to set out the piece chips. Each returns the canvas box, the
// padding around it for the chips, and the chip centres in canvas pixels.

// Around the board outline.
function ringLayout(availW, availH, chip) {
  const half = chip / 2 + 2;
  let pads = { l: 0, r: 0, t: 0, b: 0 };
  let box = canvasForBox(availW, availH);
  let slots = [];
  for (let pass = 0; pass < 4; pass += 1) {
    slots = ringSlots(viewForCanvas(box.cw, box.ch), chip);
    pads = { l: 0, r: 0, t: 0, b: 0 };
    for (const s of slots) {
      pads.l = Math.max(pads.l, half - s.x);
      pads.r = Math.max(pads.r, s.x + half - box.cw);
      pads.t = Math.max(pads.t, half - s.y);
      pads.b = Math.max(pads.b, s.y + half - box.ch);
    }
    // Keep the board centred horizontally.
    pads.l = pads.r = Math.ceil(Math.max(pads.l, pads.r));
    pads.t = Math.ceil(pads.t);
    pads.b = Math.ceil(pads.b);
    box = canvasForBox(Math.max(MIN_BOARD, availW - pads.l - pads.r), Math.max(MIN_BOARD, availH - pads.t - pads.b));
  }
  slots = ringSlots(viewForCanvas(box.cw, box.ch), chip);
  return { mode: "ring", box, pads, slots };
}

// In columns on both sides of the board, centred on it.
function railLayout(availW, availH, chip, count) {
  const perCol = Math.max(1, Math.floor((availH + CHIP_GAP) / (chip + CHIP_GAP)));
  const leftCount = Math.ceil(count / 2);
  const cols = Math.ceil(leftCount / perCol);
  const railW = cols * (chip + CHIP_GAP);
  const box = canvasForBox(Math.max(MIN_BOARD, availW - 2 * railW), availH);
  const slots = [];
  const place = (start, n, side) => {
    for (let k = 0; k < n; k += 1) {
      const col = Math.floor(k / perCol);
      const row = k - col * perCol;
      const inCol = Math.min(perCol, n - col * perCol);
      const colH = inCol * chip + (inCol - 1) * CHIP_GAP;
      const dx = CHIP_GAP + chip / 2 + col * (chip + CHIP_GAP);
      slots[start + k] = {
        x: side < 0 ? -dx : box.cw + dx,
        y: box.ch / 2 - colH / 2 + chip / 2 + row * (chip + CHIP_GAP),
      };
    }
  };
  place(0, leftCount, -1);
  place(leftCount, count - leftCount, 1);
  const rows = Math.min(perCol, leftCount);
  const extra = Math.max(0, Math.ceil((rows * chip + (rows - 1) * CHIP_GAP - box.ch) / 2));
  return { mode: "rails", box, pads: { l: railW, r: railW, t: extra, b: extra }, slots };
}

// In rows under the board.
function trayLayout(availW, availH, chip, count) {
  const trayH = (w) => traySlots(w, 0, chip, count).height;
  let box = canvasForBox(availW, Math.max(MIN_BOARD, availH - trayH(availW)));
  // A narrower board may need one more row of chips.
  box = canvasForBox(availW, Math.max(MIN_BOARD, availH - trayH(box.cw)));
  const tray = traySlots(box.cw, box.ch, chip, count);
  return { mode: "tray", box, pads: { l: 0, r: 0, t: 0, b: tray.height }, slots: tray.slots };
}

// A layout is usable when no two chips overlap and it fits the space.
function layoutFits(layout, availW, availH, chip) {
  const { box, pads, slots } = layout;
  if (box.cw + pads.l + pads.r > availW + 1) return false;
  if (box.ch + pads.t + pads.b > availH + 1) return false;
  const min = chip + 2;
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      if (Math.abs(slots[i].x - slots[j].x) < min && Math.abs(slots[i].y - slots[j].y) < min) return false;
    }
  }
  return true;
}

// Size the board to the space the rest of the page leaves, and pick the chip
// layout that gives the largest board. The ring around the board is kept
// whenever it costs little.
function fitLayout() {
  const chip = cssNumber("--chip", 40);
  const count = state.pieceTypes.length;
  const wide = WIDE.matches;
  if (wide) dom.stage.style.height = "";
  const availW = dom.stage.clientWidth;
  const availH = wide ? dom.stage.clientHeight : Math.max(260, window.innerHeight - heightAroundStage());

  const candidates = [
    ringLayout(availW, availH, chip),
    railLayout(availW, availH, chip, count),
    trayLayout(availW, availH, chip, count),
  ];
  const scaleOf = (l) => viewForCanvas(l.box.cw, l.box.ch).scale;
  const usable = candidates.filter((l) => l.mode === "tray" || layoutFits(l, availW, availH, chip));
  let chosen = usable[0];
  for (const l of usable) if (scaleOf(l) > scaleOf(chosen)) chosen = l;
  const ring = usable.find((l) => l.mode === "ring");
  if (ring && scaleOf(ring) >= RING_PREFERENCE * scaleOf(chosen)) chosen = ring;

  const { box, pads, slots } = chosen;
  state.layout = { mode: chosen.mode, cw: box.cw, ch: box.ch, padL: pads.l, padT: pads.t, slots };
  const wrapW = box.cw + pads.l + pads.r;
  const wrapH = box.ch + pads.t + pads.b;
  if (!wide) dom.stage.style.height = `${wrapH}px`;
  dom.boardWrap.style.width = `${wrapW}px`;
  dom.boardWrap.style.height = `${wrapH}px`;
  dom.canvas.style.left = `${pads.l}px`;
  dom.canvas.style.top = `${pads.t}px`;
  dom.canvas.style.width = `${box.cw}px`;
  dom.canvas.style.height = `${box.ch}px`;
  resizeCanvas();
}

function resizeCanvas() {
  const { cw, ch } = state.layout;
  if (!cw || !ch) {
    return;
  }
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(cw * dpr));
  const height = Math.max(1, Math.round(ch * dpr));

  if (dom.canvas.width !== width || dom.canvas.height !== height) {
    dom.canvas.width = width;
    dom.canvas.height = height;
  }

  const padding = CANVAS_PADDING * dpr;
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

function layoutPieceRing() {
  const chips = [...dom.tray.querySelectorAll(".piece-chip")];
  const { slots, padL, padT } = state.layout;
  if (chips.length === 0 || !slots || slots.length === 0) {
    return;
  }
  chips.forEach((chip, index) => {
    const anchor = slots[index % slots.length];
    chip.style.left = `${padL + anchor.x}px`;
    chip.style.top = `${padT + anchor.y}px`;
  });
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
  dom.areaValue.textContent = String(area);
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
