"use strict";

const TETRAHEX_ORDER = 4;
const BOARD_RADIUS = 6; // hex-board radius in hex cells; 1 + 3R(R+1) = 127 cells
const SQRT3 = Math.sqrt(3);
const SQRT3_HALF = SQRT3 / 2;

// The board the camera reads for this lab (see ../camera/boards.js).
const CAMERA_BOARD = "hex6";
// Space kept between the piece chips, the screen edges and the controls.
const EDGE_GAP = 4;

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

  return { variants, rotateMap, flipMap, indexByKey };
}

function anchorAtLexMin(cells) {
  const sorted = cells.slice().sort(cellSort);
  const m = sorted[0];
  return sorted.map((c) => ({ q: c.q - m.q, r: c.r - m.r }));
}

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
  status: document.getElementById("status"),
};

const state = {
  ctx: dom.canvas.getContext("2d"),
  board: null,
  boardCells: [],
  boardCellMap: new Map(),
  boardBounds: null,
  view: { scale: 1, offsetX: 0, offsetY: 0, width: 0, height: 0, dpr: 1 },
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
  area: 0,
  status: null,
};

// The camera view inside the board (../camera/inboard.js), while it is open.
const camera = { view: null };

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
  resizeCanvas();
  refreshTray();
  updateAreaChip(0);
  setStatus("hx.s.ready");
  render();
}

function t(key, vars) {
  return window.i18n ? window.i18n.t(key, vars) : key;
}

// Touch screens have no R or F key, so their tooltips leave the key out.
function useTouchTips() {
  if (!window.matchMedia("(pointer: coarse)").matches) return;
  for (const [btn, key] of [[dom.rotateBtn, "hx.rotateTipTouch"], [dom.flipBtn, "hx.flipTipTouch"]]) {
    btn.setAttribute("data-i18n-title", key);
    btn.title = t(key);
  }
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
      shapeKey: canonicalizeShape(r.shape).key,
      variants: variantData.variants,
      variantIndexByKey: variantData.indexByKey,
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

  window.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "Escape" && camera.view) { closeCamera(); return; }
    if (e.key === "r" || e.key === "R") { e.preventDefault(); rotateSelection(); return; }
    if (e.key === "f" || e.key === "F") { e.preventDefault(); flipSelection(); return; }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (!state.selectedPieceId) return;
      e.preventDefault();
      removePiece(state.selectedPieceId);
    }
  });

  bindCamera();
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

/* ---------- size and ring ---------- */

// The board keeps the size the stylesheet gives it; it only shrinks, or moves
// down a little, when the ring of chips would leave the screen or run into
// the controls above it.
function resizeCanvas() {
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

function drawAtSize() {
  const rect = dom.canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (dom.canvas.width !== w) dom.canvas.width = w;
  if (dom.canvas.height !== h) dom.canvas.height = h;
  const padding = 18 * dpr;
  const bw = state.boardBounds.maxX - state.boardBounds.minX;
  const bh = state.boardBounds.maxY - state.boardBounds.minY;
  const scale = Math.min((w - 2 * padding) / bw, (h - 2 * padding) / bh);
  const offsetX = (w - bw * scale) / 2 - state.boardBounds.minX * scale;
  const offsetY = (h - bh * scale) / 2 - state.boardBounds.minY * scale;
  state.view = { scale, offsetX, offsetY, width: w, height: h, dpr };
  render();
  layoutPieceRing();
  if (camera.view && typeof camera.view.refresh === "function") camera.view.refresh();
}

// How far the chips reach past the screen sides, below the screen, and up
// into the toolbar; room = free space under the board for moving it down.
function ringOverflow() {
  const items = [...dom.tray.querySelectorAll(".piece-chip")];
  if (!dom.cameraChip.hidden) items.push(dom.cameraChip);
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const top = dom.toolbar.getBoundingClientRect().bottom + EDGE_GAP;
  let side = 0, below = 0, above = 0, lowest = -Infinity;
  for (const el of items) {
    const b = el.getBoundingClientRect();
    if (b.width === 0) continue;
    side = Math.max(side, EDGE_GAP - b.left, b.right - (vw - EDGE_GAP));
    below = Math.max(below, b.bottom - (vh - EDGE_GAP));
    above = Math.max(above, top - b.top);
    lowest = Math.max(lowest, b.bottom);
  }
  const wrapBottom = dom.boardWrap.getBoundingClientRect().bottom + 24;
  lowest = Math.max(lowest, wrapBottom);
  return { side, below, above, room: vh - EDGE_GAP - lowest };
}

// World point to CSS pixels inside the canvas box (also the camera window).
function worldToCss(p) {
  const { scale, offsetX, offsetY, dpr } = state.view;
  return { x: (p.x * scale + offsetX) / dpr, y: (p.y * scale + offsetY) / dpr };
}

// The board outline, a hexagon with a corner on top: its six corners in CSS
// pixels of the canvas, found from the outermost cell corners.
function boardCorners() {
  const dirs = {
    top: { x: 0, y: -1 },
    upperRight: { x: SQRT3_HALF, y: -0.5 },
    lowerRight: { x: SQRT3_HALF, y: 0.5 },
    bottom: { x: 0, y: 1 },
    lowerLeft: { x: -SQRT3_HALF, y: 0.5 },
    upperLeft: { x: -SQRT3_HALF, y: -0.5 },
  };
  // Support lines of the outline: sides face 0, 60, ... 300 degrees.
  const normals = [0, 60, 120, 180, 240, 300].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return { x: Math.cos(a), y: Math.sin(a) };
  });
  const reach = normals.map((n) => {
    let h = -Infinity;
    for (const c of state.boardCells) {
      for (const v of c.vertices) {
        const p = worldToCss(v);
        h = Math.max(h, p.x * n.x + p.y * n.y);
      }
    }
    return h;
  });
  const meet = (i, j) => {
    const a = normals[i], b = normals[j];
    const det = a.x * b.y - a.y * b.x;
    return { x: (reach[i] * b.y - reach[j] * a.y) / det, y: (a.x * reach[j] - b.x * reach[i]) / det };
  };
  // Sides: 0 right, 1 lower right, 2 lower left, 3 left, 4 upper left, 5 upper right.
  return {
    dirs,
    top: meet(4, 5),
    upperRight: meet(5, 0),
    lowerRight: meet(0, 1),
    bottom: meet(1, 2),
    lowerLeft: meet(2, 3),
    upperLeft: meet(3, 4),
  };
}

// The chips follow the board outline: down the right flank from the middle
// of the upper right side to the middle of the lower right side, then up the
// left flank the same way. Each chip sits just outside the side it faces.
function layoutPieceRing() {
  const chips = [...dom.tray.querySelectorAll(".piece-chip")];
  if (chips.length === 0) return;
  const rect = dom.canvas.getBoundingClientRect();
  if (rect.width === 0) return;
  const c = boardCorners();
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const right = [mid(c.top, c.upperRight), c.upperRight, c.lowerRight, mid(c.lowerRight, c.bottom)];
  const left = [mid(c.bottom, c.lowerLeft), c.lowerLeft, c.upperLeft, mid(c.upperLeft, c.top)];
  const chipBox = chips[0].getBoundingClientRect();
  const half = Math.max(16, Math.max(chipBox.width, chipBox.height) / 2);
  const nRight = Math.ceil(chips.length / 2);
  const spots = [
    ...pointsAlong(right, nRight, half, 6),
    ...pointsAlong(left, chips.length - nRight, half, 6),
  ];
  clearObstacles(spots, half, ringObstacles(rect));
  chips.forEach((chip, index) => {
    const s = spots[index];
    chip.style.left = `${s.x}px`;
    chip.style.top = `${s.y}px`;
  });
}

// The controls that sit on the board itself (camera chip, rotate and flip),
// as boxes in canvas pixels.
function ringObstacles(rect) {
  const boxes = [];
  for (const el of [dom.cameraChip, dom.actions]) {
    if (!el || el.hidden) continue;
    const b = el.getBoundingClientRect();
    if (b.width === 0) continue;
    boxes.push({ l: b.left - rect.left, t: b.top - rect.top, r: b.right - rect.left, b: b.bottom - rect.top });
  }
  return boxes;
}

// A chip that would touch one of these controls, or an earlier chip, slides
// a little along its side or away from the board until it is clear.
function clearObstacles(spots, half, boxes) {
  const gap = 3;
  const hits = (p, upto) => {
    for (const b of boxes) {
      if (p.x + half + gap > b.l && p.x - half - gap < b.r && p.y + half + gap > b.t && p.y - half - gap < b.b) return true;
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

// n points spread evenly along a path of corners, pushed outward (away from
// the board centre) so a square chip of half size `half` clears the side.
// Each point also carries its side's outward normal (nx, ny) and direction
// (tx, ty).
function pointsAlong(path, n, half, clearance) {
  const lens = [];
  let total = 0;
  for (let i = 0; i + 1 < path.length; i += 1) {
    const l = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
    lens.push(l);
    total += l;
  }
  const out = [];
  for (let k = 0; k < n; k += 1) {
    let d = ((k + 0.5) / n) * total;
    let i = 0;
    while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i += 1; }
    const a = path[i], b = path[i + 1];
    const tt = lens[i] > 0 ? d / lens[i] : 0;
    const ex = b.x - a.x, ey = b.y - a.y, len = Math.hypot(ex, ey) || 1;
    // The path runs clockwise around the board, so the outward normal of a
    // side is its direction turned a quarter turn to the left on screen.
    const nx = ey / len, ny = -ex / len;
    const off = (Math.abs(nx) + Math.abs(ny)) * half + clearance;
    out.push({ x: a.x + ex * tt + nx * off, y: a.y + ey * tt + ny * off, nx, ny, tx: ex / len, ty: ey / len });
  }
  return out;
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

/* ---------- tray ---------- */

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

function pointerToCanvas(event) {
  const rect = dom.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * dom.canvas.width) / Math.max(1, rect.width),
    y: ((event.clientY - rect.top) * dom.canvas.height) / Math.max(1, rect.height),
  };
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

/* ---------- area and status ---------- */

function updateAreaChip(area) {
  state.area = area;
  dom.areaChip.textContent = t("hx.areaChip", { area });
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

/* ---------- camera inside the board ---------- */

// The camera chip turns the board itself into the camera window: the printed
// board is straightened onto the drawn one, cell on cell, and once the view
// is steady its pieces are put on this board and measured. Tapping the chip
// again closes the camera; the pieces stay.
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
  const key = camera.view ? "hx.cameraClose" : "hx.cameraOpen";
  dom.cameraChip.setAttribute("data-i18n-title", key);
  dom.cameraChip.setAttribute("data-i18n-aria-label", key);
  dom.cameraChip.title = t(key);
  dom.cameraChip.setAttribute("aria-label", t(key));
  dom.cameraChip.setAttribute("aria-pressed", camera.view ? "true" : "false");
  dom.cameraChip.classList.toggle("is-active", Boolean(camera.view));
}

function openCamera() {
  if (camera.view || !cameraSupported()) return;
  state.draggingPieceId = null;
  dom.cameraHost.hidden = false;
  dom.boardWrap.classList.add("camera-mode");
  let view = null;
  try {
    view = window.FenceInboard.open({
      host: dom.cameraHost,
      boardId: CAMERA_BOARD,
      worldToHost: worldToCss,
      onPlacements: cameraPlacements,
      onState: cameraStateChanged,
      onClose: () => cameraClosed(false),
    });
  } catch (e) {
    view = null;
  }
  if (!view) {
    dom.cameraHost.hidden = true;
    dom.boardWrap.classList.remove("camera-mode");
    setStatus("hx.s.camError");
    return;
  }
  camera.view = view;
  document.body.dataset.fcCamera = "starting";
  localizeCameraChip();
}

// quiet: the page is going away, no message.
function closeCamera(quiet = false) {
  const view = camera.view;
  if (!view) return;
  camera.view = null;
  try { view.close(); } catch (e) { /* already closed */ }
  cameraClosed(quiet);
}

// Called when the camera view is gone, whoever closed it.
function cameraClosed(quiet) {
  camera.view = null;
  dom.cameraHost.hidden = true;
  dom.boardWrap.classList.remove("camera-mode");
  document.body.dataset.fcCamera = "stopped";
  localizeCameraChip();
  if (quiet !== true) setStatus("hx.s.camClosed");
}

function cameraStateChanged(value) {
  if (!camera.view) return;
  const s = String(value || "");
  if (s === document.body.dataset.fcCamera) return;
  document.body.dataset.fcCamera = s;
  if (s === "starting") setStatus("hx.s.camStarting");
  else if (s === "searching") setStatus("hx.s.camSearching");
  else if (s === "locked") setStatus("hx.s.camLocked");
  else if (s.indexOf("error") === 0) setStatus("hx.s.camError");
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
  onDetectArea();
}

// placements: [{ typeId, variantIndex, marker }] in the shared lattice's
// terms (camera/boards.js piece types, lattice-hex.js variants). Returns the
// lab's own placed pieces, or null when anything does not check out.
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
    const variants = LatticeHex.buildVariants(type.cells.map((c) => ({ q: c.q, r: c.r }))).variants;
    const vi = item.variantIndex;
    if (!Number.isInteger(vi) || vi < 0 || vi >= variants.length) return null;
    const m = item.marker;
    if (!m || !Number.isInteger(m.q) || !Number.isInteger(m.r)) return null;
    const cells = variants[vi].cells.map((c) => ({ q: c.q + m.q, r: c.r + m.r }));
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
    const variantIndex = own.variantIndexByKey.get(cellsKey(anchorAtLexMin(cells)));
    if (variantIndex === undefined) return null;
    const marker = cells.slice().sort(cellSort)[0];
    pieces.push({ id: state.nextPieceId++, typeId: own.id, variantIndex, marker: { q: marker.q, r: marker.r } });
  }
  return pieces;
}
