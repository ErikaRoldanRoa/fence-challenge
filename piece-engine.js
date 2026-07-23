

(function (globalScope) {
  "use strict";

  const DEFAULT_COLORS = [
    "#ff5b7f", "#ff9d1e", "#ffd84a", "#93e03b", "#2de2d5", "#1bc7ff",
    "#5ea8ff", "#7f83ff", "#ad73ff", "#d866ff", "#ff5fb3", "#ff9f8e",
  ];

  function createPieceEngine(options) {
    const {
      root,
      lattice,
      pieceSet = {},
      board: boardSpec = {},
      callbacks = {},
      padding = 10,
      enableKeys = true,
    } = options || {};

    if (!root) throw new Error("createPieceEngine: `root` is required.");
    if (!lattice) throw new Error("createPieceEngine: `lattice` is required.");

    const dom = {
      root,
      canvas: options.canvas || root.querySelector("canvas"),
      tray: options.tray || root.querySelector("[data-tray]") || null,
    };
    if (!dom.canvas) {
      throw new Error("createPieceEngine: no canvas found in `root`.");
    }

    const emit = {
      status: callbacks.onStatus || (() => {}),
      area: callbacks.onArea || (() => {}),
      selection: callbacks.onSelectionChange || (() => {}),
      tray: callbacks.onTrayRendered || (() => {}),
    };

    const state = {
      ctx: dom.canvas.getContext("2d"),
      board: null,
      view: { scale: 1, offsetX: 0, offsetY: 0, width: 0, height: 0, dpr: 1 },
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
      leakCells: new Set(),
      lastStatus: "",
      hovered: false,
      destroyed: false,
    };

    const listeners = []; // MUST-FIX: every binding is unbound in destroy()
    function bind(target, type, handler, opts) {
      target.addEventListener(type, handler, opts);
      listeners.push(() => target.removeEventListener(type, handler, opts));
    }

    function buildPieces() {
      const shapes = pieceSet.shapes
        ? pieceSet.shapes.map((s) => s.map((c) => Object.assign({}, c)))
        : lattice.generateFreePolyforms(pieceSet.order);

      shapes.sort((a, b) => lattice.cellsKey(a).localeCompare(lattice.cellsKey(b)));

      const described = pieceSet.build
        ? pieceSet.build(shapes, lattice)
        : shapes.map((cells, index) => ({
            id: `${pieceSet.prefix || "P"}${index + 1}`,
            cells,
          }));

      const colors = pieceSet.colors || DEFAULT_COLORS;
      const types = described.map((desc, index) => {
        const cells = desc.cells.map((c) => Object.assign({}, c)); // deep clone
        const variantData = lattice.buildVariants(cells);
        return {
          id: desc.id,
          name: desc.name || desc.id,
          color: desc.color || colors[index % colors.length],
          variants: variantData.variants,
          rotateMap: variantData.rotateMap,
          flipMap: variantData.flipMap,
          spawnVariant: 0, // per-instance, never shared
        };
      });

      state.pieceTypes = types;
      state.pieceTypeMap = new Map(types.map((t) => [t.id, t]));
      if (types.length > 0) state.selectedTypeId = types[0].id;
    }

    function getSelectedPiece() {
      if (!state.selectedPieceId) return null;
      return state.placedPieces.find((p) => p.id === state.selectedPieceId) || null;
    }

    function pieceAbsoluteCells(piece, variantIndex = piece.variantIndex, marker = piece.marker) {
      const type = state.pieceTypeMap.get(piece.typeId);
      const variant = type.variants[variantIndex];
      return variant.cells.map((c) => lattice.translateCell(c, marker));
    }

    function buildOccupancyMap(ignorePieceId = null) {
      const occupancy = new Map();
      for (const piece of state.placedPieces) {
        if (piece.id === ignorePieceId) continue;
        for (const cell of pieceAbsoluteCells(piece)) {
          occupancy.set(lattice.cellKey(cell), piece.id);
        }
      }
      return occupancy;
    }

    function canPlace(typeId, variantIndex, markerCell, ignorePieceId = null) {
      const type = state.pieceTypeMap.get(typeId);
      if (!type) return false;
      const variant = type.variants[variantIndex];
      if (!variant) return false;
      if (!lattice.markerConstraint(variant, markerCell)) return false;

      const occupancy = buildOccupancyMap(ignorePieceId);
      for (const rel of variant.cells) {
        const key = lattice.cellKey(lattice.translateCell(rel, markerCell));
        if (!state.board.map.has(key)) return false;
        if (occupancy.has(key)) return false;
      }
      return true;
    }

    function findBestMarkerCell(typeId, variantIndex, preferredWorld = { x: 0, y: 0 }, ignorePieceId = null) {
      const type = state.pieceTypeMap.get(typeId);
      if (!type) return null;
      const variant = type.variants[variantIndex];

      const candidates = state.board.cells
        .filter((entry) => lattice.markerConstraint(variant, entry))
        .map((entry) => ({ entry, dist2: squaredDistance(entry.centroid, preferredWorld) }))
        .sort((a, b) => a.dist2 - b.dist2);

      for (const candidate of candidates) {
        if (canPlace(typeId, variantIndex, candidate.entry, ignorePieceId)) {
          return candidate.entry;
        }
      }
      return null;
    }

    function spawnPiece(typeId, preferredCell = null) {
      const type = state.pieceTypeMap.get(typeId);
      if (!type) return false;
      const existing = state.placedPieces.find((p) => p.typeId === typeId);
      if (existing) {
        setSelectedPieceId(existing.id);
        return true;
      }

      const variantIndex = type.spawnVariant;
      const preferredWorld = preferredCell
        ? state.board.map.get(lattice.cellKey(preferredCell))?.centroid ?? boardCenterWorld()
        : boardCenterWorld();
      const target =
        preferredCell && canPlace(typeId, variantIndex, preferredCell, null)
          ? preferredCell
          : findBestMarkerCell(typeId, variantIndex, preferredWorld);

      if (!target) return false;

      const piece = {
        id: state.nextPieceId++,
        typeId,
        variantIndex,
        marker: lattice.bareCell(target),
      };
      state.placedPieces.push(piece);
      setSelectedPieceId(piece.id);
      resetArea();
      setStatus(`Placed ${typeId}.`);
      return true;
    }

    function reorientPlacedPiece(piece, nextVariantIndex) {
      if (nextVariantIndex === piece.variantIndex) return true;
      const type = state.pieceTypeMap.get(piece.typeId);
      if (!type) return false;

      const oldEntry = state.board.map.get(lattice.cellKey(piece.marker));
      const preferred = oldEntry ? oldEntry.centroid : lattice.cellCentroidWorld(piece.marker);
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
      piece.marker = lattice.bareCell(nextMarker);
      refreshTray();
      return true;
    }

    function reorientBy(mapName, verb) {
      const selected = getSelectedPiece();
      if (selected) {
        const type = state.pieceTypeMap.get(selected.typeId);
        const next = type[mapName][selected.variantIndex];
        if (next === selected.variantIndex) {
          setStatus(`${selected.typeId} is symmetric under ${verb.toLowerCase()}.`);
          return;
        }
        if (reorientPlacedPiece(selected, next)) {
          setStatus(`${verb} ${selected.typeId}.`);
          resetArea();
          render();
        }
        return;
      }
      if (!state.selectedTypeId) return;
      const type = state.pieceTypeMap.get(state.selectedTypeId);
      type.spawnVariant = type[mapName][type.spawnVariant]; // instance-local
      refreshTray();
      render();
    }

    const rotateSelection = () => reorientBy("rotateMap", "Rotated");
    const flipSelection = () => reorientBy("flipMap", "Flipped");

    function removePiece(pieceId = state.selectedPieceId) {
      const index = state.placedPieces.findIndex((p) => p.id === pieceId);
      if (index < 0) return false;
      const removed = state.placedPieces[index];
      state.placedPieces.splice(index, 1);
      if (state.selectedPieceId === pieceId) setSelectedPieceId(null);
      resetArea();
      setStatus(`Removed piece ${removed.typeId}.`);
      refreshTray();
      render();
      return true;
    }

    function clear() {
      state.placedPieces = [];
      setSelectedPieceId(null);
      resetArea();
      setStatus("Board cleared.");
      refreshTray();
      render();
    }

    const regionSplitNeighborKeys =
      lattice.regionSplitNeighborKeys || lattice.regionNeighborKeys;

    function enclosedUnder(occupied, neighborFn) {
      const emptyKeys = state.board.cells
        .map((entry) => entry.key)
        .filter((key) => !occupied.has(key));
      const emptySet = new Set(emptyKeys);
      const outsideVisited = new Set();
      const queue = [];

      for (const entry of state.board.cells) {
        if (!emptySet.has(entry.key)) continue;
        const touchesOutside =
          entry.touchesBoundary ||
          lattice.cellNeighbors(entry).some((n) => !state.board.map.has(lattice.cellKey(n)));
        if (touchesOutside) {
          outsideVisited.add(entry.key);
          queue.push(entry.key);
        }
      }

      while (queue.length > 0) {
        const key = queue.shift();
        for (const nKey of neighborFn(key, emptySet, state.board)) {
          if (!emptySet.has(nKey) || outsideVisited.has(nKey)) continue;
          outsideVisited.add(nKey);
          queue.push(nKey);
        }
      }

      return emptyKeys.filter((key) => !outsideVisited.has(key));
    }

    function computeEnclosedArea() {
      const occupied = new Set();
      for (const piece of state.placedPieces) {
        for (const cell of pieceAbsoluteCells(piece)) occupied.add(lattice.cellKey(cell));
      }

      const enclosed = enclosedUnder(occupied, lattice.regionNeighborKeys);
      const enclosedSet = new Set(enclosed);

      const enclosedStrict = new Set(enclosedUnder(occupied, regionSplitNeighborKeys));
      const leakCells = new Set();
      for (const key of enclosedStrict) if (!enclosedSet.has(key)) leakCells.add(key);

      const visited = new Set();
      let regionCount = 0;
      let largestRegion = 0;

      for (const start of enclosed) {
        if (visited.has(start)) continue;
        regionCount += 1;
        let regionSize = 0;
        const regionQueue = [start];
        visited.add(start);

        while (regionQueue.length > 0) {
          const key = regionQueue.pop();
          regionSize += 1;
          for (const nKey of regionSplitNeighborKeys(key, enclosedSet, state.board)) {
            if (!enclosedSet.has(nKey) || visited.has(nKey)) continue;
            visited.add(nKey);
            regionQueue.push(nKey);
          }
        }
        if (regionSize > largestRegion) largestRegion = regionSize;
      }

      return {
        area: enclosed.length,
        enclosedSet,
        regionCount,
        largestRegion,
        cornerLeak: leakCells.size > 0,
        leakCells,
      };
    }

    function detectArea() {
      const result = computeEnclosedArea();
      state.enclosedCells = result.enclosedSet;
      state.enclosedRegionCount = result.regionCount;
      state.enclosedLargest = result.largestRegion;
      state.leakCells = result.leakCells;
      emit.area({
        area: result.area,
        regionCount: result.regionCount,
        largestRegion: result.largestRegion,
        cornerLeak: result.cornerLeak,
        leakCount: result.leakCells.size,
      });
      setStatus(
        `Enclosed area: ${result.area} across ${result.regionCount} region(s). Largest: ${result.largestRegion}.`
      );
      render();
      return result;
    }

    function onPointerDown(event) {
      if (!viewReady()) return; // guard: no hit-testing before first layout
      state._downPieceId = null;
      state._didDrag = false;
      const point = pointerToCanvas(event);
      const nearest = lattice.findNearestBoardCell(screenToWorld(point), state.board, null);
      if (!nearest) return;

      const occupancy = buildOccupancyMap();
      const occupiedBy = occupancy.get(nearest.key);
      if (occupiedBy) {
        state._downPieceId = occupiedBy;
        state._downWasSelected = state.selectedPieceId === occupiedBy;
        setSelectedPieceId(occupiedBy);
        state.draggingPieceId = occupiedBy;
        try { dom.canvas.setPointerCapture(event.pointerId); } catch (e) {  }
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
      if (!state.draggingPieceId || !viewReady()) return;
      const piece = state.placedPieces.find((p) => p.id === state.draggingPieceId);
      if (!piece) return;
      const type = state.pieceTypeMap.get(piece.typeId);
      const variant = type.variants[piece.variantIndex];
      const point = pointerToCanvas(event);
      const nearest = lattice.findNearestBoardCell(screenToWorld(point), state.board, (entry) =>
        lattice.markerConstraint(variant, entry)
      );
      if (!nearest) return;
      if (lattice.cellKey(nearest) === lattice.cellKey(piece.marker)) return;
      if (!canPlace(piece.typeId, piece.variantIndex, nearest, piece.id)) return;

      piece.marker = lattice.bareCell(nearest);
      state._didDrag = true;
      resetArea();
      render();
    }

    function onPointerUp(event) {
      // Tap (no drag) on an already-selected piece removes it — the phone
      // equivalent of the Delete key, which touch devices do not have.
      if (state._downPieceId && !state._didDrag && state._downWasSelected) {
        removePiece(state._downPieceId);
      }
      state._downPieceId = null;
      if (state.draggingPieceId) {
        setStatus("Drag to move a piece. Edge-only fences enclose area.");
      }
      state.draggingPieceId = null;
      try {
        if (dom.canvas.hasPointerCapture(event.pointerId)) {
          dom.canvas.releasePointerCapture(event.pointerId);
        }
      } catch (e) {  }
    }

    function onKeyDown(event) {
      if (!state.hovered && !dom.root.contains(document.activeElement)) return;
      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        rotateSelection();
      } else if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        flipSelection();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        if (!state.selectedPieceId) return;
        event.preventDefault();
        removePiece(state.selectedPieceId);
      }
    }

    function refreshTray() {
      if (!dom.tray) return;
      dom.tray.innerHTML = "";
      const chips = [];
      state.pieceTypes.forEach((type) => {
        const chip = document.createElement("button");
        chip.className = "piece-chip";
        chip.type = "button";
        chip.title = type.id;
        chip.dataset.pieceId = type.id;
        if (state.selectedTypeId === type.id) chip.classList.add("is-selected");
        if (state.placedPieces.some((p) => p.typeId === type.id)) chip.classList.add("is-on-board");
        chip.innerHTML = buildPiecePreviewSvg(type);
        bindChip(chip, type);
        dom.tray.appendChild(chip);
        chips.push(chip);
      });
      emit.tray(chips);
    }

    function bindChip(chip, type) {
      chip.addEventListener("click", () => {
        state.selectedTypeId = type.id;
        const existing = state.placedPieces.find((p) => p.typeId === type.id);
        if (existing) {
          setSelectedPieceId(existing.id);
          setStatus(`Selected ${type.id}. Drag it on the board.`);
        } else if (!spawnPiece(type.id)) {
          setStatus(`No available space to place ${type.id}.`);
        }
        refreshTray();
        render();
      });
    }

    function buildPiecePreviewSvg(type) {
      const variant = type.variants[type.spawnVariant];
      const polys = variant.cells.map((cell) => lattice.cellWorldVertices(cell));
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const verts of polys) {
        for (const v of verts) {
          if (v.x < minX) minX = v.x;
          if (v.x > maxX) maxX = v.x;
          if (v.y < minY) minY = v.y;
          if (v.y > maxY) maxY = v.y;
        }
      }
      const scale = 24 / Math.max(maxX - minX, maxY - minY, 0.0001);
      const ox = 17 - ((minX + maxX) * 0.5) * scale;
      const oy = 17 - ((minY + maxY) * 0.5) * scale;
      const shapes = polys
        .map((verts) => {
          const pts = verts
            .map((v) => `${(v.x * scale + ox).toFixed(2)},${(v.y * scale + oy).toFixed(2)}`)
            .join(" ");
          return `<polygon points="${pts}" fill="${type.color}" stroke="rgba(10,20,36,0.8)" stroke-width="0.8"></polygon>`;
        })
        .join("");
      return `<svg viewBox="0 0 34 34" aria-hidden="true">${shapes}</svg>`;
    }

    function resize() {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const rect = dom.canvas.getBoundingClientRect();
      const cssW = rect.width || dom.canvas.width || 1;
      const cssH = rect.height || dom.canvas.height || 1;
      const width = Math.max(1, Math.round(cssW * dpr));
      const height = Math.max(1, Math.round(cssH * dpr));
      if (dom.canvas.width !== width) dom.canvas.width = width;
      if (dom.canvas.height !== height) dom.canvas.height = height;

      const pad = padding * dpr;
      const b = state.board.bounds;
      const bw = b.maxX - b.minX;
      const bh = b.maxY - b.minY;
      const scale = Math.min(
        (width - pad * 2) / Math.max(bw, 0.0001),
        (height - pad * 2) / Math.max(bh, 0.0001)
      );
      state.view = {
        scale,
        offsetX: (width - bw * scale) * 0.5 - b.minX * scale,
        offsetY: (height - bh * scale) * 0.5 - b.minY * scale,
        width,
        height,
        dpr,
      };
      render();
    }

    function render() {
      const ctx = state.ctx;
      const { width, height } = state.view;
      if (!ctx || width <= 0 || height <= 0) return;
      ctx.clearRect(0, 0, width, height);
      drawCells(state.board.cells, "rgba(40, 70, 110, 0.32)", "rgba(170, 220, 255, 0.34)", 1);
      drawEnclosed();
      drawLeak();
      drawPlacedPieces();
    }

    function tracePath(ctx, verts) {
      const pts = verts.map(worldToScreen);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
    }

    function drawCells(entries, fill, stroke, lw) {
      const ctx = state.ctx;
      ctx.save();
      for (const entry of entries) {
        tracePath(ctx, entry.vertices);
        ctx.fillStyle = fill;
        ctx.fill();
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = Math.max(0.7, lw * (state.view.dpr || 1));
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    function drawEnclosed() {
      if (state.enclosedCells.size === 0) return;
      const entries = [];
      for (const key of state.enclosedCells) {
        const entry = state.board.map.get(key);
        if (entry) entries.push(entry);
      }
      const clean = !state.leakCells || state.leakCells.size === 0;
      if (clean) {
        // a real, leak-free enclosure — light it up like neon
        const ctx = state.ctx;
        ctx.save();
        ctx.shadowBlur = 15 * (state.view.dpr || 1);
        ctx.shadowColor = "rgba(45, 246, 172, 0.85)";
        drawCells(entries, "rgba(45, 246, 172, 0.52)", "rgba(140, 255, 214, 0.95)", 1.8);
        ctx.restore();
      } else {
        // an area that leaks through a corner — keep it muted so the leak reads as the problem
        drawCells(entries, "rgba(45, 246, 172, 0.24)", "rgba(45, 246, 172, 0.5)", 1.1);
      }
    }

    function drawLeak() {
      if (!state.leakCells || state.leakCells.size === 0) return;
      const ctx = state.ctx;
      const entries = [];
      for (const key of state.leakCells) {
        const entry = state.board.map.get(key);
        if (entry) entries.push(entry);
      }
      ctx.save();
      ctx.setLineDash([4 * (state.view.dpr || 1), 3 * (state.view.dpr || 1)]);
      drawCells(entries, "rgba(178, 120, 255, 0.20)", "rgba(200, 150, 255, 0.85)", 1.4);
      ctx.restore();
    }

    function drawPlacedPieces() {
      const ctx = state.ctx;
      for (const piece of state.placedPieces) {
        const type = state.pieceTypeMap.get(piece.typeId);
        const isSelected = piece.id === state.selectedPieceId;
        for (const cell of pieceAbsoluteCells(piece)) {
          const entry = state.board.map.get(lattice.cellKey(cell));
          if (!entry) continue;
          tracePath(ctx, entry.vertices);
          ctx.fillStyle = type.color;
          ctx.fill();
          ctx.lineWidth = isSelected
            ? Math.max(1.6, state.view.scale * 0.065)
            : Math.max(0.8, state.view.scale * 0.04);
          ctx.strokeStyle = isSelected ? "rgba(248,252,255,0.95)" : "rgba(10,22,34,0.36)";
          ctx.stroke();
        }
      }
    }

    function getState() {
      return {
        placedPieces: state.placedPieces.map((p) => ({
          id: p.id,
          typeId: p.typeId,
          variantIndex: p.variantIndex,
          marker: Object.assign({}, p.marker),
        })),
        selectedTypeId: state.selectedTypeId,
        selectedPieceId: state.selectedPieceId,
        area: state.enclosedCells.size,
      };
    }

    function setState(next = {}) {
      if (Array.isArray(next.placedPieces)) {
        state.placedPieces = next.placedPieces.map((p) => ({
          id: p.id,
          typeId: p.typeId,
          variantIndex: p.variantIndex,
          marker: Object.assign({}, p.marker),
        }));
        state.nextPieceId = state.placedPieces.reduce((m, p) => Math.max(m, p.id), 0) + 1;
      }
      if ("selectedTypeId" in next) state.selectedTypeId = next.selectedTypeId;
      setSelectedPieceId("selectedPieceId" in next ? next.selectedPieceId : null);
      resetArea();
      refreshTray();
      render();
    }

    function viewReady() {
      return Number.isFinite(state.view.scale) && state.view.scale > 0;
    }

    function setSelectedPieceId(id) {
      if (state.selectedPieceId === id) return;
      state.selectedPieceId = id;
      emit.selection(id);
    }

    function setStatus(message) {
      state.lastStatus = message;
      emit.status(message);
    }

    function resetArea() {
      state.enclosedCells = new Set();
      state.enclosedRegionCount = 0;
      state.enclosedLargest = 0;
      state.leakCells = new Set();
      emit.area({ area: 0, regionCount: 0, largestRegion: 0, cornerLeak: false, leakCount: 0 });
    }

    function boardCenterWorld() {
      const b = state.board.bounds;
      return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
    }

    function squaredDistance(a, b) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return dx * dx + dy * dy;
    }

    function pointerToCanvas(event) {
      const rect = dom.canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) * dom.canvas.width) / (rect.width || dom.canvas.width),
        y: ((event.clientY - rect.top) * dom.canvas.height) / (rect.height || dom.canvas.height),
      };
    }

    function worldToScreen(p) {
      return {
        x: p.x * state.view.scale + state.view.offsetX,
        y: p.y * state.view.scale + state.view.offsetY,
      };
    }

    function screenToWorld(p) {
      return {
        x: (p.x - state.view.offsetX) / state.view.scale,
        y: (p.y - state.view.offsetY) / state.view.scale,
      };
    }

    function destroy() {
      if (state.destroyed) return;
      state.destroyed = true;
      while (listeners.length) listeners.pop()();
      if (resizeObserver) resizeObserver.disconnect();
      if (dom.tray) dom.tray.innerHTML = "";
      state.placedPieces = [];
      state.enclosedCells = new Set();
    }

    state.board = lattice.buildBoard(boardSpec);
    buildPieces();
    resize(); // establishes state.view BEFORE any pointer event can arrive
    refreshTray();

    bind(dom.canvas, "pointerdown", onPointerDown);
    bind(dom.canvas, "pointermove", onPointerMove);
    bind(dom.canvas, "pointerup", onPointerUp);
    bind(dom.canvas, "pointercancel", onPointerUp);
    bind(dom.root, "pointerenter", () => { state.hovered = true; });
    bind(dom.root, "pointerleave", () => { state.hovered = false; });
    bind(window, "resize", resize);
    if (enableKeys) bind(document, "keydown", onKeyDown);

    let resizeObserver = null;
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(() => { if (!state.destroyed) resize(); });
      resizeObserver.observe(dom.canvas);
    }

    setStatus(
      `${lattice.name} board ready — ${state.pieceTypes.length} pieces on ${state.board.cells.length} cells.`
    );
    render();

    return {
      spawnPiece,
      canPlace,
      rotateSelection,
      flipSelection,
      reorientPlacedPiece,
      removePiece,
      clear,
      computeEnclosedArea,
      detectArea,
      getState,
      setState,
      render,
      resize,
      destroy,
      get lattice() { return lattice; },
      get state() { return state; },
      get pieceTypes() { return state.pieceTypes; },
    };
  }

  const api = { createPieceEngine, DEFAULT_COLORS };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalScope.PieceEngine = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
