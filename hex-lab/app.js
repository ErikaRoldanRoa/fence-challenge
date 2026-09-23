"use strict";
const TETRAHEX_ORDER = 4;
const BOARD_RADIUS = 6; // hex-board radius in hex cells; 1 + 3R(R+1) = 127 cells
const SQRT3 = Math.sqrt(3);
const SQRT3_HALF = SQRT3 / 2;

const PIECE_COLORS = [
  "#3fd8ff", // bar: cyan
  "#ffb84a", // pistol: amber
  "#ff9d9d", // worm: coral
  "#ff7a18", // wave: orange
  "#2dc7d1", // arc: teal
  "#d04e93", // bee: magenta
  "#7a64d7", // propeller: violet
];

// Names as in the paper (Abbildung 4), keyed by the canonical shape.
const TETRAHEX_NAME_BY_KEY = {
  "0,0|0,1|0,2|0,3":    { name: "bar",       ord: 1 },  // 4 in a straight line
  "0,0|0,1|0,2|1,-1":   { name: "worm",      ord: 3 },  // 3 in a row, bent 60 degrees at one end
  "0,0|0,1|0,2|1,0":    { name: "pistol",    ord: 2 },  // 3-in-a-row + 1 branch
  "0,0|0,1|1,-1|1,0":   { name: "bee",       ord: 6 },  // compact 4-cluster
  "0,0|0,1|1,-1|1,1":   { name: "arc",       ord: 5 },  // curved, mirror-sym
  "0,0|0,1|1,-2|1,-1":  { name: "wave",      ord: 4 },  // S-shaped zigzag, half-turn symmetric
  "0,0|1,-2|1,-1|2,-1": { name: "propeller", ord: 7 },  // Y-shape, 3-fold sym
};

const ROTATE_60 = { reflect: false, rot: 1 };
const REFLECT = { reflect: true, rot: 0 };

const SYMMETRIES = [];
for (let rot = 0; rot < 6; rot += 1) SYMMETRIES.push({ reflect: false, rot });
for (let rot = 0; rot < 6; rot += 1) SYMMETRIES.push({ reflect: true, rot });

function cellKey(cell) { return `${cell.q},${cell.r}`; }

function cellSort(a, b) {
  if (a.q !== b.q) return a.q - b.q;
  return a.r - b.r;
}

function cellsKey(cells) {
  return cells.slice().sort(cellSort).map(cellKey).join("|");
}

const HEX_NEIGHBOR_OFFSETS = [
  { dq:  1, dr:  0 },
  { dq:  1, dr: -1 },
  { dq:  0, dr: -1 },
  { dq: -1, dr:  0 },
  { dq: -1, dr:  1 },
  { dq:  0, dr:  1 },
];

function cellNeighbors(cell) {
  return HEX_NEIGHBOR_OFFSETS.map(({ dq, dr }) => ({ q: cell.q + dq, r: cell.r + dr }));
}

function rotate60(cell) { return { q: -cell.r, r: cell.q + cell.r }; }

function reflectQ(cell) { return { q: cell.q + cell.r, r: -cell.r }; }

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
  let bestQ = Infinity, bestR = Infinity;
  for (const c of cells) {
    if (c.q < bestQ || (c.q === bestQ && c.r < bestR)) {
      bestQ = c.q; bestR = c.r;
    }
  }
  return cells.map((c) => ({ q: c.q - bestQ, r: c.r - bestR })).sort(cellSort);
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
  const qFrac = (2 / 3) * px / S;
  const rFrac = (-1 / 3 * px + (SQRT3 / 3) * py) / S;
  const sFrac = -qFrac - rFrac;
  let q = Math.round(qFrac);
  let r = Math.round(rFrac);
  let s = Math.round(sFrac);
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

function generateFreePolyhexes(order) {
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
        const grown = [...shape, cand];
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
    const rot = v.cells.map((c) => transformCell(c, ROTATE_60));
    const rotAnchored = anchorAtLexMin(rot);
    const rotKey = cellsKey(rotAnchored);
    rotateMap[i] = indexByKey.has(rotKey) ? indexByKey.get(rotKey) : i;

    const flp = v.cells.map((c) => transformCell(c, REFLECT));
    const flpAnchored = anchorAtLexMin(flp);
    const flpKey = cellsKey(flpAnchored);
    flipMap[i] = indexByKey.has(flpKey) ? indexByKey.get(flpKey) : i;
  });

  return { variants, rotateMap, flipMap };
}

function anchorAtLexMin(cells) {
  const sorted = cells.slice().sort(cellSort);
  const m = sorted[0];
  return sorted.map((c) => ({ q: c.q - m.q, r: c.r - m.r }));
}

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
  board: null,
  boardCells: [],
  boardCellMap: new Map(),
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
  enclosedRegionCount: 0,
  enclosedLargest: 0,
  status: null,
};

// Inner margin of the drawing, in CSS pixels.
const CANVAS_PADDING = 18;
// Outward normals (degrees, y down) of the six sides of the board outline.
// The board is a pointy-top hexagon, so two sides are vertical.
const OUTLINE_NORMALS = [0, 60, 120, 180, 240, 300];
const CHIP_CLEARANCE = 6;
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
  // The board comes from the shared lattice module, so the lab, the hub and
  // the camera judge fences on the same cells with the same rule
  // (fence-analysis.js).
  state.board = LatticeHex.buildBoard({ radius: BOARD_RADIUS });
  state.boardCells = state.board.cells;
  state.boardCellMap = state.board.map;
  state.boardBounds = state.board.bounds;

  buildPieces();
  wireEvents();
  useTouchTips();
  refreshTray();
  updateAreaChip(0);
  setStatus("hx.s.ready");
  fitLayout();
}

// Touch screens have no R or F key, so their tooltips leave the key out.
function useTouchTips() {
  if (!window.matchMedia("(pointer: coarse)").matches) return;
  for (const [btn, key] of [[dom.rotateBtn, "hx.rotateTipTouch"], [dom.flipBtn, "hx.flipTipTouch"]]) {
    btn.setAttribute("data-i18n-title", key);
    btn.title = t(key);
  }
}

function t(key, vars) {
  return window.i18n ? window.i18n.t(key, vars) : key;
}

function buildPieces() {
  const free = generateFreePolyhexes(TETRAHEX_ORDER);
  free.sort((a, b) => cellsKey(a).localeCompare(cellsKey(b)));

  const raw = free.map((shape) => {
    const meta = TETRAHEX_NAME_BY_KEY[cellsKey(shape)] || { name: "", ord: 999 };
    return { shape, ...meta };
  });
  raw.sort((a, b) => a.ord - b.ord);

  const types = raw.map((r, index) => {
    const id = r.name || `T${index + 1}`;
    const color = PIECE_COLORS[index % PIECE_COLORS.length];
    const variantData = buildVariants(r.shape);
    return {
      id,
      name: id,
      color,
      variants: variantData.variants,
      rotateMap: variantData.rotateMap,
      flipMap: variantData.flipMap,
      spawnVariant: 0,
    };
  });

  state.pieceTypes = types;
  state.pieceTypeMap = new Map(types.map((type) => [type.id, type]));
  if (types.length > 0) state.selectedTypeId = types[0].id;
}

function pieceName(typeId) {
  const type = state.pieceTypeMap.get(typeId);
  return type ? type.name : typeId;
}

function wireEvents() {
  dom.detectAreaBtn.addEventListener("click", onDetectArea);
  dom.clearBtn.addEventListener("click", onClear);
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

  window.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "r" || e.key === "R") { e.preventDefault(); rotateSelection(); return; }
    if (e.key === "f" || e.key === "F") { e.preventDefault(); flipSelection(); return; }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (!state.selectedPieceId) return;
      e.preventDefault();
      removePiece(state.selectedPieceId);
    }
  });
}

// Any change to the board makes the last measurement stale.
function resetMeasure() {
  state.enclosedCells = new Set();
  updateAreaChip(0);
}

function removePiece(pieceId) {
  const i = state.placedPieces.findIndex((p) => p.id === pieceId);
  if (i < 0) return;
  const removed = state.placedPieces[i];
  state.placedPieces.splice(i, 1);
  if (state.selectedPieceId === pieceId) state.selectedPieceId = null;
  if (state.freshPieceId === pieceId) state.freshPieceId = null;
  resetMeasure();
  setStatus("hx.s.removed", { name: pieceName(removed.typeId) });
  refreshTray();
  render();
}

function onDetectArea() {
  const result = computeEnclosedArea();
  state.enclosedCells = result.enclosedSet;
  state.enclosedRegionCount = result.regionCount;
  state.enclosedLargest = result.largestRegion;
  updateAreaChip(result.area);
  // Hexagons never meet at a corner only, so there is no corner leak here:
  // one inside of area at least 1 is a closed fence.
  if (result.area === 0) setStatus("hx.s.areaNone");
  else if (result.regionCount > 1) setStatus("hx.s.areaSplit", { area: result.area, regions: result.regionCount });
  else if (result.area === 1) setStatus("hx.s.fence1");
  else setStatus("hx.s.fence", { area: result.area });
  render();
}

function onClear() {
  state.placedPieces = [];
  state.selectedPieceId = null;
  state.freshPieceId = null;
  state.enclosedCells = new Set();
  state.enclosedRegionCount = 0;
  state.enclosedLargest = 0;
  updateAreaChip(0);
  setStatus("hx.s.cleared");
  refreshTray();
  render();
}

function getSelectedPiece() {
  if (!state.selectedPieceId) return null;
  return state.placedPieces.find((p) => p.id === state.selectedPieceId) || null;
}

function pieceAbsoluteCells(piece, variantIndex = piece.variantIndex, marker = piece.marker) {
  const type = state.pieceTypeMap.get(piece.typeId);
  const variant = type.variants[variantIndex];
  return variant.cells.map((c) => ({ q: c.q + marker.q, r: c.r + marker.r }));
}

function canPlace(typeId, variantIndex, markerCell, ignorePieceId = null) {
  const type = state.pieceTypeMap.get(typeId);
  if (!type) return false;
  const variant = type.variants[variantIndex];
  const absolute = variant.cells.map((c) => ({ q: c.q + markerCell.q, r: c.r + markerCell.r }));

  for (const ac of absolute) {
    if (!state.boardCellMap.has(cellKey(ac))) return false;
  }
  const blocked = new Set();
  for (const p of state.placedPieces) {
    if (p.id === ignorePieceId) continue;
    for (const c of pieceAbsoluteCells(p)) blocked.add(cellKey(c));
  }
  for (const ac of absolute) {
    if (blocked.has(cellKey(ac))) return false;
  }
  return true;
}

function findBestMarkerCell(typeId, variantIndex, preferredWorld, ignorePieceId = null) {
  const candidates = state.boardCells
    .map((entry) => ({
      entry,
      d2: (entry.centroid.x - preferredWorld.x) ** 2 + (entry.centroid.y - preferredWorld.y) ** 2,
    }))
    .sort((a, b) => a.d2 - b.d2);
  for (const cand of candidates) {
    if (canPlace(typeId, variantIndex, cand.entry, ignorePieceId)) return cand.entry;
  }
  return null;
}

function spawnPiece(typeId, preferredCell = null) {
  const type = state.pieceTypeMap.get(typeId);
  if (!type) return false;
  const existing = state.placedPieces.find((p) => p.typeId === typeId);
  if (existing) {
    state.selectedPieceId = existing.id;
    return true;
  }
  const variantIndex = type.spawnVariant;
  const preferredWorld = preferredCell
    ? state.boardCellMap.get(cellKey(preferredCell))?.centroid ?? { x: 0, y: 0 }
    : { x: 0, y: 0 };
  const target = preferredCell && canPlace(typeId, variantIndex, preferredCell, null)
    ? preferredCell
    : findBestMarkerCell(typeId, variantIndex, preferredWorld);
  if (!target) return false;
  const piece = {
    id: state.nextPieceId++,
    typeId,
    variantIndex,
    marker: { q: target.q, r: target.r },
  };
  state.placedPieces.push(piece);
  state.selectedPieceId = piece.id;
  // A new piece starts selected, but the next tap on it only confirms the
  // selection: removing it takes a second, deliberate tap.
  state.freshPieceId = piece.id;
  resetMeasure();
  setStatus("hx.s.placed", { name: pieceName(typeId) });
  return true;
}

function rotateSelection() {
  const sel = getSelectedPiece();
  if (sel) {
    const type = state.pieceTypeMap.get(sel.typeId);
    const next = type.rotateMap[sel.variantIndex];
    if (next === sel.variantIndex) {
      setStatus("hx.s.symRot", { name: pieceName(sel.typeId) });
      return;
    }
    if (reorient(sel, next)) {
      setStatus("hx.s.rotated", { name: pieceName(sel.typeId) });
      resetMeasure();
      render();
    }
    return;
  }
  if (!state.selectedTypeId) return;
  const type = state.pieceTypeMap.get(state.selectedTypeId);
  type.spawnVariant = type.rotateMap[type.spawnVariant];
  refreshTray();
  render();
}

function flipSelection() {
  const sel = getSelectedPiece();
  if (sel) {
    const type = state.pieceTypeMap.get(sel.typeId);
    const next = type.flipMap[sel.variantIndex];
    if (next === sel.variantIndex) {
      setStatus("hx.s.symFlip", { name: pieceName(sel.typeId) });
      return;
    }
    if (reorient(sel, next)) {
      setStatus("hx.s.flipped", { name: pieceName(sel.typeId) });
      resetMeasure();
      render();
    }
    return;
  }
  if (!state.selectedTypeId) return;
  const type = state.pieceTypeMap.get(state.selectedTypeId);
  type.spawnVariant = type.flipMap[type.spawnVariant];
  refreshTray();
  render();
}

function reorient(piece, nextVariant) {
  if (nextVariant === piece.variantIndex) return true;
  const old = state.boardCellMap.get(cellKey(piece.marker));
  const preferred = old ? old.centroid : { x: 0, y: 0 };
  const newMarker = findBestMarkerCell(piece.typeId, nextVariant, preferred, piece.id);
  if (!newMarker) {
    setStatus("hx.s.noRoom", { name: pieceName(piece.typeId) });
    return false;
  }
  piece.variantIndex = nextVariant;
  piece.marker = { q: newMarker.q, r: newMarker.r };
  refreshTray();
  return true;
}

function onPointerDown(event) {
  state._downPieceId = null;
  state._didDrag = false;
  state._moved = false;
  state._downClientX = event.clientX;
  state._downClientY = event.clientY;
  state._dragSlop = event.pointerType === "touch" ? 10 : 6;
  const point = pointerToCanvas(event);
  const nearest = findNearestBoardCell(point);
  if (!nearest) return;

  const occupancy = buildOccupancyMap();
  const occupiedBy = occupancy.get(nearest.key);
  if (occupiedBy) {
    state._downPieceId = occupiedBy;
    state._downWasSelected = state.selectedPieceId === occupiedBy && state.freshPieceId !== occupiedBy;
    state.freshPieceId = null;
    state.selectedPieceId = occupiedBy;
    state.draggingPieceId = occupiedBy;
    dom.canvas.setPointerCapture(event.pointerId);
    refreshTray();
    render();
    return;
  }
  if (!state.selectedTypeId) return;
  if (spawnPiece(state.selectedTypeId, nearest)) {
    refreshTray();
    render();
  }
}

function onPointerMove(event) {
  if (!state.draggingPieceId) return;
  if (!state._didDrag) {
    const mdx = event.clientX - state._downClientX;
    const mdy = event.clientY - state._downClientY;
    const slop = state._dragSlop || 6;
    if (mdx * mdx + mdy * mdy > slop * slop) state._didDrag = true;
  }
  const piece = state.placedPieces.find((p) => p.id === state.draggingPieceId);
  if (!piece) return;
  const point = pointerToCanvas(event);
  const nearest = findNearestBoardCell(point);
  if (!nearest) return;
  if (piece.marker.q === nearest.q && piece.marker.r === nearest.r) return;
  if (!canPlace(piece.typeId, piece.variantIndex, nearest, piece.id)) return;
  piece.marker = { q: nearest.q, r: nearest.r };
  state._didDrag = true;
  if (!state._moved) {
    // The measurement no longer describes the board: say what happened.
    state._moved = true;
    setStatus("hx.s.moving", { name: pieceName(piece.typeId) });
  }
  resetMeasure();
  render();
}

function onPointerUp(event) {
  const pieceId = state._downPieceId;
  if (pieceId && !state._didDrag) {
    const piece = state.placedPieces.find((p) => p.id === pieceId);
    // Tap on a piece that was already selected removes it (phones have no
    // Delete key); the first tap on a piece only selects it.
    if (piece && state._downWasSelected) removePiece(pieceId);
    else if (piece) setStatus("hx.s.selectedTap", { name: pieceName(piece.typeId) });
  }
  if (pieceId && state._moved) {
    const piece = state.placedPieces.find((p) => p.id === pieceId);
    if (piece) setStatus("hx.s.moved", { name: pieceName(piece.typeId) });
  }
  state._moved = false;
  state._downPieceId = null;
  state._downWasSelected = false;
  state.draggingPieceId = null;
  try { dom.canvas.releasePointerCapture(event.pointerId); } catch (e) { /* not captured */ }
}

function buildOccupancyMap(ignorePieceId = null) {
  const occ = new Map();
  for (const p of state.placedPieces) {
    if (p.id === ignorePieceId) continue;
    for (const c of pieceAbsoluteCells(p)) {
      occ.set(cellKey(c), p.id);
    }
  }
  return occ;
}

// What the placed pieces enclose, judged by the shared rule.
function computeEnclosedArea() {
  const occupied = new Set();
  for (const piece of state.placedPieces) {
    for (const cell of pieceAbsoluteCells(piece)) occupied.add(cellKey(cell));
  }
  return FenceAnalysis.analyze({ board: state.board, lattice: LatticeHex, occupied });
}

/* ---------- layout ---------- */

function cssNumber(name, fallback) {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
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
    for (const c of state.boardCells) {
      for (const v of c.vertices) {
        const px = v.x * view.scale + view.offsetX;
        const py = v.y * view.scale + view.offsetY;
        h = Math.max(h, px * n.x + py * n.y);
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

// Chip centres around the outline, clockwise from the upper-left side:
// two on each upper side, one on each lower side and one below the bottom tip.
function ringSlots(view, chip) {
  const { lines, corners } = boardOutline(view);
  const half = chip / 2;
  const slots = [];
  const onSide = (k, tt) => {
    const a = corners[(k + lines.length - 1) % lines.length];
    const b = corners[k];
    const n = lines[k].n;
    const off = (Math.abs(n.x) + Math.abs(n.y)) * half + CHIP_CLEARANCE;
    slots.push({ x: a.x + (b.x - a.x) * tt + n.x * off, y: a.y + (b.y - a.y) * tt + n.y * off });
  };
  onSide(4, 0.3);
  onSide(4, 0.72);
  onSide(5, 0.28);
  onSide(5, 0.7);
  onSide(1, 0.45);
  const tip = corners[1];
  slots.push({ x: tip.x, y: tip.y + half + CHIP_CLEARANCE });
  onSide(2, 0.55);
  return slots;
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
  if (!cw || !ch) return;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(cw * dpr));
  const h = Math.max(1, Math.round(ch * dpr));
  if (dom.canvas.width !== w) dom.canvas.width = w;
  if (dom.canvas.height !== h) dom.canvas.height = h;
  const padding = CANVAS_PADDING * dpr;
  const bw = state.boardBounds.maxX - state.boardBounds.minX;
  const bh = state.boardBounds.maxY - state.boardBounds.minY;
  const scale = Math.min((w - 2 * padding) / bw, (h - 2 * padding) / bh);
  const offsetX = (w - bw * scale) / 2 - state.boardBounds.minX * scale;
  const offsetY = (h - bh * scale) / 2 - state.boardBounds.minY * scale;
  state.view = { scale, offsetX, offsetY, width: w, height: h, dpr };
  render();
  layoutPieceRing();
}

function layoutPieceRing() {
  const chips = dom.tray.querySelectorAll(".piece-chip");
  const { slots, padL, padT } = state.layout;
  if (chips.length === 0 || !slots || slots.length === 0) return;
  chips.forEach((chip, index) => {
    const s = slots[index % slots.length];
    chip.style.left = `${padL + s.x}px`;
    chip.style.top = `${padT + s.y}px`;
  });
}

/* ---------- tray ---------- */

function refreshTray() {
  dom.tray.innerHTML = "";
  state.pieceTypes.forEach((type) => {
    const chip = document.createElement("button");
    chip.className = "piece-chip";
    chip.type = "button";
    chip.title = type.name;
    chip.setAttribute("aria-label", t("hx.piece.aria", { name: type.name }));
    const selected = state.selectedTypeId === type.id;
    chip.setAttribute("aria-pressed", selected ? "true" : "false");
    if (selected) chip.classList.add("is-selected");
    if (state.placedPieces.some((p) => p.typeId === type.id)) chip.classList.add("is-on-board");
    chip.innerHTML = buildPiecePreviewSvg(type);
    chip.addEventListener("click", () => {
      state.selectedTypeId = type.id;
      const existing = state.placedPieces.find((p) => p.typeId === type.id);
      if (existing) {
        state.selectedPieceId = existing.id;
        setStatus("hx.s.selected", { name: type.name });
      } else if (!spawnPiece(type.id)) {
        setStatus("hx.s.noSpace", { name: type.name });
      }
      refreshTray();
      render();
      const again = dom.tray.querySelector(`[data-type="${type.id}"]`);
      if (again) again.focus();
    });
    chip.dataset.type = type.id;
    dom.tray.appendChild(chip);
  });
  layoutPieceRing();
}

/* ---------- drawing ---------- */

function render() {
  const ctx = state.ctx;
  const { width: w, height: h } = state.view;
  ctx.clearRect(0, 0, w, h);
  drawBoardBase();
  drawEnclosedCells();
  drawPlacedPieces();
}

function drawBoardBase() {
  const ctx = state.ctx;
  const { scale, offsetX, offsetY } = state.view;
  for (const c of state.boardCells) {
    ctx.beginPath();
    const verts = c.vertices;
    ctx.moveTo(verts[0].x * scale + offsetX, verts[0].y * scale + offsetY);
    for (let i = 1; i < verts.length; i++) {
      ctx.lineTo(verts[i].x * scale + offsetX, verts[i].y * scale + offsetY);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(40, 70, 110, 0.32)";
    ctx.fill();
    ctx.lineWidth = 1 * (state.view.dpr || 1);
    ctx.strokeStyle = "rgba(170, 220, 255, 0.18)";
    ctx.stroke();
  }
}

function drawEnclosedCells() {
  if (state.enclosedCells.size === 0) return;
  const ctx = state.ctx;
  const { scale, offsetX, offsetY } = state.view;
  for (const k of state.enclosedCells) {
    const c = state.boardCellMap.get(k);
    if (!c) continue;
    ctx.beginPath();
    const verts = c.vertices;
    ctx.moveTo(verts[0].x * scale + offsetX, verts[0].y * scale + offsetY);
    for (let i = 1; i < verts.length; i++) {
      ctx.lineTo(verts[i].x * scale + offsetX, verts[i].y * scale + offsetY);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(63, 246, 172, 0.36)";
    ctx.fill();
    ctx.strokeStyle = "rgba(45, 246, 172, 0.6)";
    ctx.lineWidth = 1.5 * (state.view.dpr || 1);
    ctx.stroke();
  }
}

function drawPlacedPieces() {
  const ctx = state.ctx;
  const { scale, offsetX, offsetY } = state.view;
  for (const piece of state.placedPieces) {
    const type = state.pieceTypeMap.get(piece.typeId);
    const isSelected = piece.id === state.selectedPieceId;
    for (const cell of pieceAbsoluteCells(piece)) {
      const entry = state.boardCellMap.get(cellKey(cell));
      if (!entry) continue;
      ctx.beginPath();
      const verts = entry.vertices;
      ctx.moveTo(verts[0].x * scale + offsetX, verts[0].y * scale + offsetY);
      for (let i = 1; i < verts.length; i++) {
        ctx.lineTo(verts[i].x * scale + offsetX, verts[i].y * scale + offsetY);
      }
      ctx.closePath();
      ctx.fillStyle = type.color;
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#ffffff" : "rgba(10, 20, 36, 0.85)";
      ctx.lineWidth = (isSelected ? 2.2 : 1.0) * (state.view.dpr || 1);
      ctx.stroke();
    }
  }
}

function buildPiecePreviewSvg(type) {
  const variant = type.variants[type.spawnVariant];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const polys = [];
  for (const cell of variant.cells) {
    const verts = cellWorldVertices(cell, 1);
    for (const v of verts) {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    }
    polys.push(verts);
  }
  const w = maxX - minX, h = maxY - minY;
  const scale = 24 / Math.max(w, h, 0.001);
  const ox = 17 - ((minX + maxX) / 2) * scale;
  const oy = 17 - ((minY + maxY) / 2) * scale;
  const ps = polys
    .map((verts) => {
      const pts = verts
        .map((v) => `${(v.x * scale + ox).toFixed(2)},${(v.y * scale + oy).toFixed(2)}`)
        .join(" ");
      return `<polygon points="${pts}" fill="${type.color}" stroke="rgba(10,20,36,0.85)" stroke-width="0.7"/>`;
    })
    .join("");
  return `<svg viewBox="0 0 34 34" aria-hidden="true">${ps}</svg>`;
}

function findNearestBoardCell(point) {
  const { scale, offsetX, offsetY } = state.view;
  const wx = (point.x - offsetX) / scale;
  const wy = (point.y - offsetY) / scale;
  const guess = pointToCell(wx, wy, 1);
  const candidates = [guess, ...cellNeighbors(guess)];
  let best = null, bestD2 = Infinity;
  for (const c of candidates) {
    const entry = state.boardCellMap.get(cellKey(c));
    if (!entry) continue;
    const dx = entry.centroid.x - wx;
    const dy = entry.centroid.y - wy;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { bestD2 = d2; best = entry; }
  }
  return best;
}

function pointerToCanvas(event) {
  const rect = dom.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * dom.canvas.width) / Math.max(1, rect.width),
    y: ((event.clientY - rect.top) * dom.canvas.height) / Math.max(1, rect.height),
  };
}

/* ---------- area and status ---------- */

function updateAreaChip(area) {
  dom.areaValue.textContent = String(area);
}

// Keeps the message as a key so a language switch can render it again.
function setStatus(key, vars) {
  state.status = { key, vars: vars || null };
  renderStatus();
}

function renderStatus() {
  if (!state.status) return;
  dom.status.textContent = t(state.status.key, state.status.vars || undefined);
}
