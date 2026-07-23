

const TETRAHEX_ORDER = 4;
const BOARD_RADIUS = 6; // hex-board radius in hex cells; 1 + 3R(R+1) = 127 cells
const SQRT3 = Math.sqrt(3);
const SQRT3_HALF = SQRT3 / 2;

const PIECE_COLORS = [
  "#3fd8ff", // bar      — cyan
  "#ffb84a", // pistol   — amber
  "#ff9d9d", // worm     — coral
  "#ff7a18", // wave     — orange
  "#2dc7d1", // arc      — teal
  "#d04e93", // bee      — magenta
  "#7a64d7", // propeller — violet
];

const TETRAHEX_NAME_BY_KEY = {
  "0,0|0,1|0,2|0,3":    { name: "bar",       ord: 1 },  // 4 in a straight line
  "0,0|0,1|0,2|1,-1":   { name: "worm",      ord: 3 },  // asymmetric zigzag
  "0,0|0,1|0,2|1,0":    { name: "pistol",    ord: 2 },  // 3-in-a-row + 1 branch
  "0,0|0,1|1,-1|1,0":   { name: "bee",       ord: 6 },  // compact 4-cluster
  "0,0|0,1|1,-1|1,1":   { name: "arc",       ord: 5 },  // curved, mirror-sym
  "0,0|0,1|1,-2|1,-1":  { name: "wave",      ord: 4 },  // mirror zigzag
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

function buildBoard(radius) {
  const cells = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      const cell = { q, r };
      const centroid = cellCentroidWorld(cell, 1);
      const vertices = cellWorldVertices(cell, 1);
      cells.push({
        key: cellKey(cell),
        q, r,
        centroid,
        vertices,
        touchesBoundary: false, // filled below
      });
    }
  }
  const cellSet = new Set(cells.map((c) => c.key));
  for (const c of cells) {
    for (const nb of cellNeighbors(c)) {
      if (!cellSet.has(cellKey(nb))) {
        c.touchesBoundary = true;
        break;
      }
    }
  }
  return cells;
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
  sideBrand: document.querySelector(".side-brand"),
};

const state = {
  ctx: dom.canvas.getContext("2d"),
  boardCells: [],
  boardCellMap: new Map(),
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
  enclosedRegionCount: 0,
  enclosedLargest: 0,
  lastStatus: "",
};

init();

function init() {
  state.boardCells = buildBoard(BOARD_RADIUS);
  state.boardCellMap = new Map(state.boardCells.map((c) => [c.key, c]));
  state.boardBounds = computeBounds(state.boardCells);

  buildPieces();

  wireEvents();
  resizeCanvas();
  refreshTray();
  setStatus(
    `Polyhex Fence ready — ${state.pieceTypes.length} tetrahexes on a ${state.boardCells.length}-hex board.`
  );
  render();
}

function computeBounds(cells) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const c of cells) {
    for (const v of c.vertices) {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    }
  }
  return { minX, maxX, minY, maxY };
}

function buildPieces() {
  const free = generateFreePolyhexes(TETRAHEX_ORDER);
  free.sort((a, b) => cellsKey(a).localeCompare(cellsKey(b)));

  if (free.length !== 7) {
    console.warn(`Tetrahex enumeration returned ${free.length} (expected 7).`);
  }

  const raw = free.map((shape) => {
    const meta = TETRAHEX_NAME_BY_KEY[cellsKey(shape)] || { name: "?", ord: 999 };
    return { shape, ...meta };
  });
  raw.sort((a, b) => a.ord - b.ord);

  const types = raw.map((r, index) => {
    const id = r.name === "?" ? `T${index + 1}` : r.name;
    const color = PIECE_COLORS[index % PIECE_COLORS.length];
    const variantData = buildVariants(r.shape);
    return {
      id,
      name: r.name,
      color,
      variants: variantData.variants,
      rotateMap: variantData.rotateMap,
      flipMap: variantData.flipMap,
      spawnVariant: 0,
    };
  });

  state.pieceTypes = types;
  state.pieceTypeMap = new Map(types.map((t) => [t.id, t]));
  if (types.length > 0) state.selectedTypeId = types[0].id;
}

function nameFromShape(cells) {
  const cellSet = new Set(cells.map(cellKey));
  let maxDeg = 0;
  let edges = 0;
  for (const c of cells) {
    let deg = 0;
    for (const nb of cellNeighbors(c)) {
      if (cellSet.has(cellKey(nb))) deg += 1;
    }
    if (deg > maxDeg) maxDeg = deg;
    edges += deg;
  }
  edges /= 2;

  const degList = [];
  for (const c of cells) {
    let deg = 0;
    for (const nb of cellNeighbors(c)) if (cellSet.has(cellKey(nb))) deg += 1;
    degList.push(deg);
  }
  degList.sort();
  const sig = degList.join(",") + "|" + edges;

  return null;
}

function wireEvents() {
  dom.detectAreaBtn.addEventListener("click", onDetectArea);
  dom.clearBtn.addEventListener("click", onClear);
  dom.rotateBtn.addEventListener("click", () => rotateSelection());
  dom.flipBtn.addEventListener("click", () => flipSelection());

  // The camera chip is handled globally by cam-note.js: the click is blocked and a clean,
  // trilingual "mixed-reality outreach" tooltip is set. No per-lab handler (it would only
  // re-expose internal notes on a public surface).

  dom.canvas.addEventListener("pointerdown", onPointerDown);
  dom.canvas.addEventListener("pointermove", onPointerMove);
  dom.canvas.addEventListener("pointerup", onPointerUp);
  dom.canvas.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("resize", resizeCanvas);

  window.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); rotateSelection(); return; }
    if (e.key === "f" || e.key === "F") { e.preventDefault(); flipSelection(); return; }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (!state.selectedPieceId) return;
      e.preventDefault();
      const i = state.placedPieces.findIndex((p) => p.id === state.selectedPieceId);
      if (i >= 0) {
        state.placedPieces.splice(i, 1);
        state.selectedPieceId = null;
        state.enclosedCells = new Set();
        updateAreaChip(0);
        refreshTray();
        render();
      }
    }
  });
}

function onDetectArea() {
  const result = computeEnclosedArea();
  state.enclosedCells = result.enclosedSet;
  state.enclosedRegionCount = result.regionCount;
  state.enclosedLargest = result.largestRegion;
  updateAreaChip(result.area);
  setStatus(
    `Enclosed area: ${result.area} hexes across ${result.regionCount} region(s). Largest: ${result.largestRegion}.`
  );
  render();
}

function onClear() {
  state.placedPieces = [];
  state.selectedPieceId = null;
  state.enclosedCells = new Set();
  state.enclosedRegionCount = 0;
  state.enclosedLargest = 0;
  updateAreaChip(0);
  setStatus("Board cleared.");
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
  state.enclosedCells = new Set();
  updateAreaChip(0);
  setStatus(`Placed ${typeId}.`);
  return true;
}

function rotateSelection() {
  const sel = getSelectedPiece();
  if (sel) {
    const type = state.pieceTypeMap.get(sel.typeId);
    const next = type.rotateMap[sel.variantIndex];
    if (next === sel.variantIndex) {
      setStatus(`${sel.typeId} has rotational symmetry under 60°.`);
      return;
    }
    if (reorient(sel, next)) {
      setStatus(`Rotated ${sel.typeId}.`);
      state.enclosedCells = new Set();
      updateAreaChip(0);
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
      setStatus(`${sel.typeId} has reflective symmetry.`);
      return;
    }
    if (reorient(sel, next)) {
      setStatus(`Flipped ${sel.typeId}.`);
      state.enclosedCells = new Set();
      updateAreaChip(0);
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
    setStatus(`No room to reorient ${piece.typeId}.`);
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
  const point = pointerToCanvas(event);
  const nearest = findNearestBoardCell(point);
  if (!nearest) return;

  const occupancy = buildOccupancyMap();
  const occupiedBy = occupancy.get(nearest.key);
  if (occupiedBy) {
    state._downPieceId = occupiedBy;
    state._downWasSelected = state.selectedPieceId === occupiedBy;
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
  const piece = state.placedPieces.find((p) => p.id === state.draggingPieceId);
  if (!piece) return;
  const point = pointerToCanvas(event);
  const nearest = findNearestBoardCell(point);
  if (!nearest) return;
  if (piece.marker.q === nearest.q && piece.marker.r === nearest.r) return;
  if (!canPlace(piece.typeId, piece.variantIndex, nearest, piece.id)) return;
  piece.marker = { q: nearest.q, r: nearest.r };
  state._didDrag = true;
  state.enclosedCells = new Set();
  updateAreaChip(0);
  render();
}

function onPointerUp(event) {
  // Tap (no drag) on an already-selected piece removes it — phones have no Delete key.
  if (state._downPieceId && !state._didDrag && state._downWasSelected) {
    const i = state.placedPieces.findIndex((p) => p.id === state._downPieceId);
    if (i >= 0) {
      state.placedPieces.splice(i, 1);
      state.selectedPieceId = null;
      state.enclosedCells = new Set();
      updateAreaChip(0);
      refreshTray();
      render();
    }
  }
  state._downPieceId = null;
  state.draggingPieceId = null;
  try { dom.canvas.releasePointerCapture(event.pointerId); } catch (e) {  }
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

function computeEnclosedArea() {
  const occupied = new Set();
  for (const piece of state.placedPieces) {
    for (const cell of pieceAbsoluteCells(piece)) occupied.add(cellKey(cell));
  }
  const empties = state.boardCells.filter((c) => !occupied.has(c.key));
  const emptySet = new Set(empties.map((c) => c.key));
  const outsideSet = new Set();
  const queue = [];

  for (const c of empties) {
    let touchesOutside = c.touchesBoundary;
    if (!touchesOutside) {
      for (const nb of cellNeighbors(c)) {
        const nk = cellKey(nb);
        if (!state.boardCellMap.has(nk)) { touchesOutside = true; break; }
      }
    }
    if (touchesOutside) {
      outsideSet.add(c.key);
      queue.push(c.key);
    }
  }

  while (queue.length > 0) {
    const k = queue.shift();
    const cell = state.boardCellMap.get(k);
    for (const nb of cellNeighbors(cell)) {
      const nk = cellKey(nb);
      if (!emptySet.has(nk) || outsideSet.has(nk)) continue;
      outsideSet.add(nk);
      queue.push(nk);
    }
  }

  const enclosed = empties.filter((c) => !outsideSet.has(c.key));
  const enclosedSet = new Set(enclosed.map((c) => c.key));

  const visited = new Set();
  const regions = [];
  for (const c of enclosed) {
    if (visited.has(c.key)) continue;
    const region = [];
    const q = [c.key];
    visited.add(c.key);
    while (q.length > 0) {
      const k = q.shift();
      region.push(k);
      const cell = state.boardCellMap.get(k);
      for (const nb of cellNeighbors(cell)) {
        const nk = cellKey(nb);
        if (enclosedSet.has(nk) && !visited.has(nk)) {
          visited.add(nk);
          q.push(nk);
        }
      }
    }
    regions.push(region);
  }

  const area = enclosed.length;
  const regionCount = regions.length;
  const largest = regions.reduce((m, r) => Math.max(m, r.length), 0);
  return { area, regionCount, largestRegion: largest, enclosedSet };
}

function resizeCanvas() {
  const rect = dom.canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  dom.canvas.width = w;
  dom.canvas.height = h;
  const padding = 18 * dpr;
  const bw = state.boardBounds.maxX - state.boardBounds.minX;
  const bh = state.boardBounds.maxY - state.boardBounds.minY;
  const scale = Math.min((w - 2 * padding) / bw, (h - 2 * padding) / bh);
  const offsetX = (w - bw * scale) / 2 - state.boardBounds.minX * scale;
  const offsetY = (h - bh * scale) / 2 - state.boardBounds.minY * scale;
  state.view = { scale, offsetX, offsetY, width: w, height: h, dpr };
  render();
  layoutPieceRing();
}

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

function refreshTray() {
  dom.tray.innerHTML = "";
  state.pieceTypes.forEach((type) => {
    const chip = document.createElement("button");
    chip.className = "piece-chip piece-chip-ring";
    chip.type = "button";
    chip.title = type.id;
    if (state.selectedTypeId === type.id) chip.classList.add("is-selected");
    if (state.placedPieces.some((p) => p.typeId === type.id)) chip.classList.add("is-on-board");
    chip.innerHTML = buildPiecePreviewSvg(type);
    chip.addEventListener("click", () => {
      state.selectedTypeId = type.id;
      const existing = state.placedPieces.find((p) => p.typeId === type.id);
      if (existing) {
        state.selectedPieceId = existing.id;
        setStatus(`Selected ${type.id}. Drag it on the board.`);
      } else if (!spawnPiece(type.id)) {
        setStatus(`No available space for ${type.id}.`);
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

function layoutPieceRing() {
  const chips = dom.tray.querySelectorAll(".piece-chip-ring");
  if (chips.length === 0) return;
  const rect = dom.canvas.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  const TL = { x: 0.23 * W, y: 0.07 * H };
  const TR = { x: 0.77 * W, y: 0.07 * H };
  const R  = { x: 0.96 * W, y: 0.50 * H };
  const BR = { x: 0.77 * W, y: 0.93 * H };
  const BL = { x: 0.23 * W, y: 0.93 * H };
  const L  = { x: 0.04 * W, y: 0.50 * H };
  const edges = [
    { a: TR, b: R },   // top-right edge
    { a: R,  b: BR },  // bottom-right edge
    { a: BL, b: L },   // bottom-left edge (going up)
    { a: L,  b: TL },  // top-left edge (going up)
  ];
  const center = { x: W / 2, y: H / 2 };
  const lens = edges.map((e) => Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y));
  const total = lens.reduce((a, b) => a + b, 0);
  const N = chips.length;
  const chipRect = chips[0].getBoundingClientRect();
  const halfDim = Math.max(20, Math.max(chipRect.width, chipRect.height) * 0.5);
  const outwardOffset = halfDim + 6;
  const CORNER_MARGIN = 0.12;
  chips.forEach((chip, index) => {
    let t = ((index + 0.5) / N) * total;
    let pickEdge = edges[edges.length - 1];
    let pickT = 1;
    for (let i = 0; i < edges.length; i++) {
      if (t <= lens[i]) { pickEdge = edges[i]; pickT = t / lens[i]; break; }
      t -= lens[i];
    }
    pickT = CORNER_MARGIN + pickT * (1 - 2 * CORNER_MARGIN);
    const ex = pickEdge.a.x + (pickEdge.b.x - pickEdge.a.x) * pickT;
    const ey = pickEdge.a.y + (pickEdge.b.y - pickEdge.a.y) * pickT;
    let nx = ex - center.x;
    let ny = ey - center.y;
    const nlen = Math.hypot(nx, ny) || 1;
    nx /= nlen; ny /= nlen;
    chip.style.left = `${ex + nx * outwardOffset}px`;
    chip.style.top = `${ey + ny * outwardOffset}px`;
  });
}

function pointerToCanvas(event) {
  const rect = dom.canvas.getBoundingClientRect();
  const dpr = state.view.dpr || 1;
  return {
    x: (event.clientX - rect.left) * dpr,
    y: (event.clientY - rect.top) * dpr,
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

function updateAreaChip(area) {
  dom.areaChip.textContent = `Area: ${area}`;
}

function setStatus(msg) {
  state.lastStatus = msg;
  if (dom.sideBrand) dom.sideBrand.title = msg;
}

if (typeof window !== "undefined") {
  window.PolyhexFenceApp = {
    cellKey, cellsKey, cellNeighbors, cellCentroidWorld, cellWorldVertices,
    pointToCell, transformCell, normalizeCells, canonicalizeShape,
    generateFreePolyhexes, buildVariants,
    SYMMETRIES, HEX_NEIGHBOR_OFFSETS,
    state,
    buildBoard,
    computeEnclosedArea,
  };
}
