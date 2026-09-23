/* Fence Challenge · square lab: 12 pentominoes on a 20 x 20 board. */
(function () {
  "use strict";

  const BOARD_SIZE = 20;
  // A pointer that travels less than this (CSS px) is a tap, not a drag.
  const TAP_SLOP_MOUSE = 6;
  const TAP_SLOP_TOUCH = 10;

  // "Continue on screen" from the camera page (see ../camera/view.js).
  const PAPER_IMPORT_KEY = "fc-paper-import";
  // Printed boards whose pieces can land here: the 20 x 20 kit with its own
  // corner marks, and the classic kit (corner ids 50 to 53).
  const PAPER_BOARDS = new Set(["sq20", "sq20-classic"]);
  const CAMERA_BOARD = "sq20";

  // One column below this width; must match the media query in styles.css.
  const COMPACT_LAYOUT_QUERY = "(max-width: 1180px)";

  // Board cells for ../fence-analysis.js, built on first use.
  let fenceBoard = null;

  const PIECE_DEFINITIONS = {
    F: [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    I: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ],
    L: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 3],
    ],
    P: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
    ],
    N: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
      [1, 3],
    ],
    T: [
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 1],
      [1, 2],
    ],
    U: [
      [0, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    V: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ],
    W: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    X: [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    Y: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 1],
    ],
    Z: [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
  };

  // Each piece keeps its own colour.
  const PIECE_COLORS = {
    F: "#ff6b6b",
    I: "#f59f00",
    L: "#ffd43b",
    N: "#38d9a9",
    P: "#94d82d",
    T: "#22b8cf",
    U: "#4dabf7",
    V: "#748ffc",
    W: "#9775fa",
    X: "#da77f2",
    Y: "#f06595",
    Z: "#ffa8a8",
  };

  // Pieces are named by the letters used in the paper.
  const PENTOMINOES = Object.keys(PIECE_DEFINITIONS).map((id) => ({
    id,
    color: PIECE_COLORS[id],
    cells: PIECE_DEFINITIONS[id],
  }));

  // The enclosed inside glows neon green; cells the outside reaches through
  // a corner are tinted violet.
  const INSIDE_FILL = "rgba(46, 207, 153, 0.55)";
  const INSIDE_GLOW = "rgba(46, 207, 153, 0.85)";
  const INSIDE_GLOW_FILL = "rgba(46, 207, 153, 0.5)";
  const LEAK_FILL = "rgba(178, 120, 255, 0.35)";

  const PIECE_BY_ID = new Map(PENTOMINOES.map((piece) => [piece.id, piece]));

  const dom = {
    gamePanel: document.getElementById("panel-game"),
    pieceTray: document.getElementById("piece-tray"),
    gameStatus: document.getElementById("game-status"),
    areaValue: document.getElementById("area-value"),
    rotatePiece: document.getElementById("rotate-piece"),
    flipPiece: document.getElementById("flip-piece"),
    clearBoard: document.getElementById("clear-board"),
    detectGameArea: document.getElementById("detect-game-area"),
    gameBoard: document.getElementById("game-board"),
    gameToolbar: document.querySelector("#panel-game .game-toolbar"),
    cameraToggle: document.getElementById("camera-toggle"),
    cameraFrame: document.getElementById("board-camera-frame"),
    cameraHost: document.getElementById("board-camera-host"),
  };

  const gameCtx = dom.gameBoard.getContext("2d");

  const gameState = {
    activePieceId: null,
    // A piece just placed from the tray: the next tap on it selects it instead of removing it.
    freshPieceId: null,
    placedPieces: new Map(),
    drag: null,
    occupiedBy: makeNullGrid(),
    interiorKeys: new Set(),
    leakKeys: new Set(),
    analysis: null,
    layout: null,
    status: null,
  };

  const pieceButtons = new Map();

  // The camera view inside the board (../camera/inboard.js), while it is open.
  const cameraState = {
    view: null,
    frameKey: "",
  };

  init();

  function init() {
    buildPieceTray();
    bindLanguageButtons();
    bindGameControls();
    bindCamera();
    updatePieceTrayState();
    updateGameMetrics();
    setStatus("sq.s.start");
    relayout();

    window.addEventListener("resize", relayout);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(relayout);
    }

    document.addEventListener("fc-langchange", () => {
      localizePieceTray();
      localizeCameraToggle();
      renderStatus();
      relayout();
    });

    window.addEventListener("hashchange", importFromPaper);
    importFromPaper();
  }

  function relayout() {
    syncGameLayoutSize();
    renderGameBoard();
    placeCameraFrame();
  }

  function t(key, vars) {
    return window.i18n ? window.i18n.t(key, vars) : key;
  }

  function bindLanguageButtons() {
    for (const button of document.querySelectorAll("[data-lang-btn]")) {
      button.addEventListener("click", () => {
        if (window.i18n) window.i18n.setLang(button.getAttribute("data-lang-btn"));
      });
    }
  }

  function bindGameControls() {
    dom.rotatePiece.addEventListener("click", () => {
      rotateSelectedPiece();
    });

    dom.flipPiece.addEventListener("click", () => {
      flipSelectedPiece();
    });

    dom.clearBoard.addEventListener("click", () => {
      gameState.activePieceId = null;
      gameState.freshPieceId = null;
      gameState.placedPieces.clear();
      gameState.drag = null;
      gameState.occupiedBy = makeNullGrid();
      clearGameAnalysis();
      updatePieceTrayState();
      updateGameMetrics();
      renderGameBoard();
      setStatus("sq.s.cleared");
    });

    dom.detectGameArea.addEventListener("click", () => {
      runGameAreaDetection();
    });

    dom.gameBoard.addEventListener("pointerdown", (event) => {
      const cell = eventToCell(event, dom.gameBoard, gameState.layout);
      if (!cell) {
        return;
      }

      const occupant = gameState.occupiedBy[cell.y][cell.x];
      if (!occupant || !gameState.placedPieces.has(occupant)) {
        return;
      }

      const wasActive = gameState.activePieceId === occupant && gameState.freshPieceId !== occupant;
      gameState.freshPieceId = null;
      gameState.activePieceId = occupant;
      startDraggingPiece(occupant, cell, event.pointerId);
      if (gameState.drag) {
        gameState.drag.downX = event.clientX;
        gameState.drag.downY = event.clientY;
        gameState.drag.slop = event.pointerType === "touch" ? TAP_SLOP_TOUCH : TAP_SLOP_MOUSE;
        gameState.drag.moved = false;
        gameState.drag.wasActive = wasActive;
      }
      dom.gameBoard.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    dom.gameBoard.addEventListener("pointermove", (event) => {
      if (gameState.drag && gameState.drag.pointerId === event.pointerId) {
        if (!gameState.drag.moved) {
          const mdx = event.clientX - gameState.drag.downX;
          const mdy = event.clientY - gameState.drag.downY;
          const slop = gameState.drag.slop;
          if (mdx * mdx + mdy * mdy > slop * slop) gameState.drag.moved = true;
        }
        gameState.drag.pointerCell = eventToCell(event, dom.gameBoard, gameState.layout);
        renderGameBoard();
        return;
      }

      if (!gameState.drag) {
        const cell = eventToCell(event, dom.gameBoard, gameState.layout);
        const overPiece = cell && gameState.placedPieces.has(gameState.occupiedBy[cell.y][cell.x]);
        dom.gameBoard.style.cursor = overPiece ? "grab" : "crosshair";
      }
    });

    dom.gameBoard.addEventListener("pointerup", (event) => {
      if (gameState.drag && gameState.drag.pointerId === event.pointerId) {
        gameState.drag.pointerCell = eventToCell(event, dom.gameBoard, gameState.layout);
        if (!gameState.drag.moved && gameState.drag.wasActive) {
          // A tap on the selected piece removes it (the touch equivalent of Delete).
          deleteDraggedPiece();
        } else if (!gameState.drag.moved) {
          // A tap on any other piece selects it and leaves it where it is.
          finishDraggingPiece(true, "sq.s.selected");
        } else {
          finishDraggingPiece();
        }
        if (dom.gameBoard.hasPointerCapture(event.pointerId)) {
          dom.gameBoard.releasePointerCapture(event.pointerId);
        }
      }
    });

    dom.gameBoard.addEventListener("pointercancel", () => {
      if (!gameState.drag) {
        return;
      }
      finishDraggingPiece(true);
    });

    window.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const tag = document.activeElement ? document.activeElement.tagName : "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "r") {
        event.preventDefault();
        rotateSelectedPiece();
      } else if (key === "f") {
        event.preventDefault();
        flipSelectedPiece();
      } else if ((key === "delete" || key === "backspace") && !gameState.drag && gameState.activePieceId) {
        event.preventDefault();
        removeActivePiece();
      }
    });
  }

  function buildPieceTray() {
    dom.pieceTray.innerHTML = "";

    for (const piece of PENTOMINOES) {
      const button = document.createElement("button");
      button.className = "piece-btn";
      button.type = "button";
      button.setAttribute("data-piece-id", piece.id);

      const preview = document.createElement("canvas");
      preview.width = 42;
      preview.height = 42;
      preview.className = "piece-preview";
      preview.setAttribute("aria-hidden", "true");
      drawPiecePreview(preview, piece);

      button.append(preview);
      button.addEventListener("click", () => {
        handlePieceSelection(piece.id);
      });

      pieceButtons.set(piece.id, button);
      dom.pieceTray.append(button);
    }
    localizePieceTray();
  }

  function localizePieceTray() {
    for (const [id, button] of pieceButtons) {
      const label = t("sq.piece", { name: id });
      button.setAttribute("aria-label", label);
      button.title = label;
    }
  }

  function drawPiecePreview(canvas, piece) {
    const ctx = canvas.getContext("2d");
    const cells = normalizeCells(piece.cells);
    const maxX = Math.max(...cells.map((cell) => cell.x));
    const maxY = Math.max(...cells.map((cell) => cell.y));
    const cellSize = 7;
    const pieceWidth = (maxX + 1) * cellSize;
    const pieceHeight = (maxY + 1) * cellSize;
    const ox = Math.floor((canvas.width - pieceWidth) / 2);
    const oy = Math.floor((canvas.height - pieceHeight) / 2);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const cell of cells) {
      const px = ox + cell.x * cellSize;
      const py = oy + cell.y * cellSize;
      ctx.fillStyle = piece.color;
      ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.strokeRect(px + 1.5, py + 1.5, cellSize - 3, cellSize - 3);
    }
  }

  function handlePieceSelection(pieceId) {
    if (gameState.drag) {
      setStatus("sq.s.releaseFirst");
      return;
    }

    if (gameState.placedPieces.has(pieceId)) {
      gameState.activePieceId = pieceId;
      gameState.freshPieceId = null;
      setStatus("sq.s.selected", { name: pieceId });
      updatePieceTrayState();
      renderGameBoard();
      return;
    }

    autoPlacePiece(pieceId);
  }

  function rotateSelectedPiece() {
    if (gameState.drag) {
      setStatus("sq.s.releaseFirst");
      return;
    }
    if (!tryTransformActivePiece({ rotate: true })) {
      setStatus("sq.s.selectFirst");
    }
  }

  function flipSelectedPiece() {
    if (gameState.drag) {
      setStatus("sq.s.releaseFirst");
      return;
    }
    if (!tryTransformActivePiece({ flip: true })) {
      setStatus("sq.s.selectFirst");
    }
  }

  function removeActivePiece() {
    const pieceId = gameState.activePieceId;
    if (!pieceId || !gameState.placedPieces.has(pieceId)) {
      return;
    }
    gameState.placedPieces.delete(pieceId);
    gameState.activePieceId = null;
    gameState.freshPieceId = null;
    rebuildGameOccupancy();
    clearGameAnalysis();
    updatePieceTrayState();
    updateGameMetrics();
    renderGameBoard();
    setStatus("sq.s.removed", { name: pieceId });
  }

  function autoPlacePiece(pieceId) {
    const piece = PIECE_BY_ID.get(pieceId);
    if (!piece) {
      return;
    }

    const relativeCells = getOrientedCells(piece.cells, 0, false);
    const anchor = findCentralAnchorForCells(relativeCells);
    if (!anchor) {
      setStatus("sq.s.noSpace", { name: pieceId });
      return;
    }

    const placed = buildPlacedPiece(piece, 0, false, relativeCells, anchor.x, anchor.y);
    gameState.placedPieces.set(piece.id, placed);
    gameState.activePieceId = piece.id;
    gameState.freshPieceId = piece.id;
    rebuildGameOccupancy();
    clearGameAnalysis();
    updatePieceTrayState();
    updateGameMetrics();
    renderGameBoard();
    setStatus("sq.s.added", { name: pieceId });
  }

  function findCentralAnchorForCells(relativeCells) {
    const maxX = Math.max(...relativeCells.map((cell) => cell.x));
    const maxY = Math.max(...relativeCells.map((cell) => cell.y));
    const center = (BOARD_SIZE - 1) / 2;
    let nearest = null;

    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        if (!canPlaceCells(relativeCells, x, y)) {
          continue;
        }
        const cx = x + maxX / 2;
        const cy = y + maxY / 2;
        const distance = Math.abs(cx - center) + Math.abs(cy - center);
        if (!nearest || distance < nearest.distance) {
          nearest = { x, y, distance };
        }
      }
    }

    return nearest ? { x: nearest.x, y: nearest.y } : null;
  }

  function tryTransformActivePiece({ rotate = false, flip = false }) {
    const pieceId = gameState.activePieceId;
    if (!pieceId) {
      return false;
    }
    const placed = gameState.placedPieces.get(pieceId);
    if (!placed) {
      return false;
    }

    const piece = PIECE_BY_ID.get(pieceId);
    const nextRotation = rotate ? (placed.rotation + 1) % 4 : placed.rotation;
    const nextFlipped = flip ? !placed.flipped : placed.flipped;
    const relativeCells = getOrientedCells(piece.cells, nextRotation, nextFlipped);
    const anchor = anchorFromPlacedPiece(placed);

    gameState.placedPieces.delete(pieceId);
    rebuildGameOccupancy();
    const canTransform = canPlaceCells(relativeCells, anchor.x, anchor.y);
    if (canTransform) {
      const updated = buildPlacedPiece(piece, nextRotation, nextFlipped, relativeCells, anchor.x, anchor.y);
      gameState.placedPieces.set(pieceId, updated);
      setStatus(rotate ? "sq.s.rotated" : "sq.s.flipped", { name: pieceId });
    } else {
      gameState.placedPieces.set(pieceId, placed);
      setStatus(rotate ? "sq.s.cannotRotate" : "sq.s.cannotFlip", { name: pieceId });
    }

    rebuildGameOccupancy();
    clearGameAnalysis();
    updatePieceTrayState();
    updateGameMetrics();
    renderGameBoard();
    return true;
  }

  function anchorFromPlacedPiece(placed) {
    return {
      x: Math.min(...placed.cells.map((cell) => cell.x)),
      y: Math.min(...placed.cells.map((cell) => cell.y)),
    };
  }

  function canPlaceCells(cells, anchorX, anchorY) {
    for (const cell of cells) {
      const x = anchorX + cell.x;
      const y = anchorY + cell.y;
      if (!isInsideBoard(x, y)) {
        return false;
      }
      if (gameState.occupiedBy[y][x]) {
        return false;
      }
    }
    return true;
  }

  function rebuildGameOccupancy() {
    gameState.occupiedBy = makeNullGrid();
    for (const placed of gameState.placedPieces.values()) {
      for (const cell of placed.cells) {
        gameState.occupiedBy[cell.y][cell.x] = placed.id;
      }
    }
  }

  function runGameAreaDetection() {
    const occupied = new Set();
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        if (gameState.occupiedBy[y][x]) {
          occupied.add(keyOf(x, y));
        }
      }
    }

    const analysis = analyzeFence(occupied);
    gameState.analysis = analysis;
    gameState.interiorKeys = new Set(analysis.interiorKeys);
    gameState.leakKeys = new Set(analysis.leakKeys);
    updateGameMetrics();
    renderGameBoard();
    setStatus(...areaStatus(analysis));
  }

  // The verdict uses the shared rule (../fence-analysis.js), the same one the
  // hub and the camera use, on the lab's occupancy.
  function analyzeFence(occupied) {
    const lattice = window.LatticeSquare;
    if (!fenceBoard) {
      fenceBoard = lattice.buildBoard({ size: BOARD_SIZE });
    }
    const result = window.FenceAnalysis.analyze({ board: fenceBoard, lattice, occupied });
    return {
      totalArea: result.area,
      regionCount: result.regionCount,
      interiorKeys: [...result.enclosedSet],
      leakKeys: [...result.leakCells],
      cornerLeak: result.cornerLeak,
    };
  }

  function areaStatus(analysis) {
    const area = analysis.totalArea;
    const count = analysis.regionCount;
    if (area === 0) {
      return analysis.cornerLeak ? ["sq.s.leak"] : ["sq.s.noArea"];
    }
    if (count === 1) {
      const key = analysis.cornerLeak ? "sq.s.fenceLeak" : "sq.s.fence";
      return [area === 1 ? key + "1" : key, { area }];
    }
    return [analysis.cornerLeak ? "sq.s.pocketsLeak" : "sq.s.pockets", { area, count }];
  }

  function clearGameAnalysis() {
    gameState.analysis = null;
    gameState.interiorKeys.clear();
    gameState.leakKeys.clear();
  }

  // Wide screens: the board is as large as the screen allows, with the
  // pieces on its left and the credit on its right (sizes in styles.css).
  // Narrow screens stack everything in one column and need no sizes here.
  function syncGameLayoutSize() {
    const panel = dom.gamePanel;
    const toolbar = dom.gameToolbar;
    if (!panel || !toolbar) {
      return;
    }

    if (window.matchMedia(COMPACT_LAYOUT_QUERY).matches) {
      panel.style.removeProperty("--board-size");
      panel.style.removeProperty("--toolbar-height");
      return;
    }

    const panelRect = panel.getBoundingClientRect();
    if (!panelRect.width || !panelRect.height) {
      return;
    }

    const panelStyles = getComputedStyle(panel);
    const labelWidth = Number.parseFloat(panelStyles.getPropertyValue("--label-width")) || 26;
    const dockWidth = Number.parseFloat(panelStyles.getPropertyValue("--dock-width")) || 58;
    const dockGap = Number.parseFloat(panelStyles.getPropertyValue("--dock-gap")) || 6;
    const paddingX = (Number.parseFloat(panelStyles.paddingLeft) || 0) + (Number.parseFloat(panelStyles.paddingRight) || 0);
    const paddingY = (Number.parseFloat(panelStyles.paddingTop) || 0) + (Number.parseFloat(panelStyles.paddingBottom) || 0);

    const toolbarHeight = Math.ceil(toolbar.getBoundingClientRect().height) || 38;
    const rowGap = 6;
    const safetyPad = 6;
    const sideWidth = labelWidth + dockWidth + dockGap * 2;
    const availableWidth = panelRect.width - paddingX - sideWidth - safetyPad;
    const availableHeight = panelRect.height - paddingY - toolbarHeight - rowGap - safetyPad;
    const boardSize = clamp(Math.floor(Math.min(availableWidth, availableHeight)), 320, 1200);

    panel.style.setProperty("--board-size", `${boardSize}px`);
    panel.style.setProperty("--toolbar-height", `${toolbarHeight}px`);
  }

  function renderGameBoard() {
    const view = prepareCanvas(dom.gameBoard, gameCtx, 320);
    const pad = 14;
    const cellSize = Math.max(8, Math.floor(Math.min((view.width - pad * 2) / BOARD_SIZE, (view.height - pad * 2) / BOARD_SIZE)));
    const boardPx = cellSize * BOARD_SIZE;
    const originX = Math.floor((view.width - boardPx) / 2);
    const originY = Math.floor((view.height - boardPx) / 2);

    gameState.layout = { originX, originY, cellSize, boardPx, viewWidth: view.width, viewHeight: view.height };

    gameCtx.clearRect(0, 0, view.width, view.height);
    gameCtx.fillStyle = "#0f151f";
    gameCtx.fillRect(originX - 2, originY - 2, boardPx + 4, boardPx + 4);

    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        const px = originX + x * cellSize;
        const py = originY + y * cellSize;
        const key = keyOf(x, y);
        const occupant = gameState.occupiedBy[y][x];

        if (occupant) {
          const piece = PIECE_BY_ID.get(occupant);
          gameCtx.fillStyle = piece ? piece.color : "#888";
        } else if (gameState.interiorKeys.has(key)) {
          gameCtx.fillStyle = INSIDE_FILL;
        } else if (gameState.leakKeys.has(key)) {
          gameCtx.fillStyle = LEAK_FILL;
        } else {
          gameCtx.fillStyle = "#121a26";
        }

        gameCtx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
      }
    }

    if (gameState.interiorKeys.size > 0) {
      gameCtx.save();
      gameCtx.shadowBlur = 10;
      gameCtx.shadowColor = INSIDE_GLOW;
      gameCtx.fillStyle = INSIDE_GLOW_FILL;
      for (const key of gameState.interiorKeys) {
        const [x, y] = key.split(",").map(Number);
        gameCtx.fillRect(originX + x * cellSize + 1, originY + y * cellSize + 1, cellSize - 2, cellSize - 2);
      }
      gameCtx.restore();
    }

    gameCtx.strokeStyle = "#2a374a";
    gameCtx.lineWidth = 1;
    for (let i = 0; i <= BOARD_SIZE; i += 1) {
      const lineX = originX + i * cellSize + 0.5;
      const lineY = originY + i * cellSize + 0.5;

      gameCtx.beginPath();
      gameCtx.moveTo(lineX, originY);
      gameCtx.lineTo(lineX, originY + boardPx);
      gameCtx.stroke();

      gameCtx.beginPath();
      gameCtx.moveTo(originX, lineY);
      gameCtx.lineTo(originX + boardPx, lineY);
      gameCtx.stroke();
    }

    drawActivePieceOutline();
    drawDraggingPieceOnBoard();

    gameCtx.strokeStyle = "#5a708f";
    gameCtx.lineWidth = 1.6;
    gameCtx.strokeRect(originX + 0.5, originY + 0.5, boardPx, boardPx);
  }

  function drawActivePieceOutline() {
    if (!gameState.activePieceId || (gameState.drag && gameState.drag.pieceId === gameState.activePieceId)) {
      return;
    }
    const placed = gameState.placedPieces.get(gameState.activePieceId);
    if (!placed) {
      return;
    }

    const { originX, originY, cellSize } = gameState.layout;
    gameCtx.save();
    gameCtx.strokeStyle = "rgba(255,255,255,0.9)";
    gameCtx.lineWidth = 2;
    for (const cell of placed.cells) {
      const px = originX + cell.x * cellSize;
      const py = originY + cell.y * cellSize;
      gameCtx.strokeRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
    }
    gameCtx.restore();
  }

  function drawDraggingPieceOnBoard() {
    if (!gameState.drag || !gameState.drag.pointerCell) {
      return;
    }

    const { originX, originY, cellSize } = gameState.layout;
    const anchorX = gameState.drag.pointerCell.x - gameState.drag.grabOffset.x;
    const anchorY = gameState.drag.pointerCell.y - gameState.drag.grabOffset.y;
    const canDrop = canPlaceCells(gameState.drag.relativeCells, anchorX, anchorY);

    gameCtx.save();
    gameCtx.globalAlpha = 0.62;
    gameCtx.fillStyle = canDrop ? gameState.drag.color : "#f36f6f";
    for (const cell of gameState.drag.relativeCells) {
      const x = anchorX + cell.x;
      const y = anchorY + cell.y;
      if (!isInsideBoard(x, y)) {
        continue;
      }
      const px = originX + x * cellSize;
      const py = originY + y * cellSize;
      gameCtx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
    }
    gameCtx.restore();
  }

  function updatePieceTrayState() {
    for (const piece of PENTOMINOES) {
      const button = pieceButtons.get(piece.id);
      if (!button) {
        continue;
      }

      const selected = gameState.activePieceId === piece.id;
      const placed = gameState.placedPieces.has(piece.id) || (gameState.drag && gameState.drag.pieceId === piece.id);
      button.classList.toggle("selected", selected);
      button.classList.toggle("placed", Boolean(placed));
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    }
  }

  function updateGameMetrics() {
    const totalArea = gameState.analysis ? gameState.analysis.totalArea : 0;
    dom.areaValue.textContent = String(totalArea);
  }

  // The status is kept as a key plus values so it can be shown again in another language.
  function setStatus(key, vars) {
    gameState.status = { key, vars: vars || null, prefix: null };
    renderStatus();
  }

  function renderStatus() {
    const status = gameState.status;
    if (!status) {
      dom.gameStatus.textContent = "";
      return;
    }
    const text = t(status.key, status.vars || undefined);
    const prefix = status.prefix ? t(status.prefix.key, status.prefix.vars) + " " : "";
    dom.gameStatus.textContent = prefix + text;
  }

  function buildPlacedPiece(piece, rotation, flipped, relativeCells, anchorX, anchorY) {
    return {
      id: piece.id,
      color: piece.color,
      rotation,
      flipped,
      cells: relativeCells.map((cell) => ({
        x: anchorX + cell.x,
        y: anchorY + cell.y,
      })),
    };
  }

  function startDraggingPiece(pieceId, grabbedCell, pointerId) {
    if (gameState.drag) {
      return;
    }

    const placed = gameState.placedPieces.get(pieceId);
    if (!placed) {
      return;
    }

    const anchorX = Math.min(...placed.cells.map((cell) => cell.x));
    const anchorY = Math.min(...placed.cells.map((cell) => cell.y));
    const relativeCells = placed.cells.map((cell) => ({
      x: cell.x - anchorX,
      y: cell.y - anchorY,
    }));

    gameState.placedPieces.delete(pieceId);
    gameState.activePieceId = pieceId;
    gameState.drag = {
      pointerId,
      pieceId: placed.id,
      color: placed.color,
      rotation: placed.rotation,
      flipped: placed.flipped,
      relativeCells,
      grabOffset: {
        x: grabbedCell.x - anchorX,
        y: grabbedCell.y - anchorY,
      },
      pointerCell: grabbedCell,
      originalPiece: placed,
      hadAnalysis: gameState.analysis,
    };

    rebuildGameOccupancy();
    clearGameAnalysis();
    updatePieceTrayState();
    updateGameMetrics();
    dom.gameBoard.style.cursor = "grabbing";
    renderGameBoard();
    setStatus("sq.s.dragging", { name: placed.id });
  }

  function deleteDraggedPiece() {
    if (!gameState.drag) {
      return;
    }
    const drag = gameState.drag;
    // The piece was lifted off the board when the pointer went down; not putting
    // it back returns it to the tray.
    gameState.activePieceId = null;
    gameState.freshPieceId = null;
    gameState.drag = null;
    rebuildGameOccupancy();
    clearGameAnalysis();
    updatePieceTrayState();
    updateGameMetrics();
    dom.gameBoard.style.cursor = "crosshair";
    setStatus("sq.s.removed", { name: drag.pieceId });
    renderGameBoard();
  }

  // Drops the dragged piece where the pointer is, or puts it back. A plain tap
  // (restoreKey given) puts it back untouched and keeps the measured area.
  function finishDraggingPiece(forceRevert = false, restoreKey = null) {
    if (!gameState.drag) {
      return;
    }

    const drag = gameState.drag;
    let dropped = false;

    if (!forceRevert && drag.pointerCell) {
      const anchorX = drag.pointerCell.x - drag.grabOffset.x;
      const anchorY = drag.pointerCell.y - drag.grabOffset.y;
      if (canPlaceCells(drag.relativeCells, anchorX, anchorY)) {
        const piece = PIECE_BY_ID.get(drag.pieceId);
        const placed = buildPlacedPiece(piece, drag.rotation, drag.flipped, drag.relativeCells, anchorX, anchorY);
        gameState.placedPieces.set(drag.pieceId, placed);
        dropped = true;
        setStatus("sq.s.moved", { name: drag.pieceId });
      }
    }

    if (!dropped) {
      gameState.placedPieces.set(drag.pieceId, drag.originalPiece);
      setStatus(restoreKey || "sq.s.invalidDrop", { name: drag.pieceId });
    }

    gameState.activePieceId = drag.pieceId;
    gameState.drag = null;
    rebuildGameOccupancy();
    clearGameAnalysis();
    if (restoreKey && drag.hadAnalysis) {
      // Nothing moved: the board is the one that was measured.
      gameState.analysis = drag.hadAnalysis;
      gameState.interiorKeys = new Set(drag.hadAnalysis.interiorKeys);
      gameState.leakKeys = new Set(drag.hadAnalysis.leakKeys);
    }
    updatePieceTrayState();
    updateGameMetrics();
    dom.gameBoard.style.cursor = "crosshair";
    renderGameBoard();
  }

  /* ------------------------------------------------ pieces from paper */

  // Reads what the camera page left in sessionStorage and, if every piece
  // checks out, replaces the board with it. Anything unexpected is ignored
  // and the current board stays as it is.
  function importFromPaper() {
    if (!/^#paper$/.test(window.location.hash)) {
      return;
    }
    let raw = null;
    try {
      raw = window.sessionStorage.getItem(PAPER_IMPORT_KEY);
      window.sessionStorage.removeItem(PAPER_IMPORT_KEY);
    } catch (e) {
      raw = null;
    }
    try {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch (e) {
      /* the hash simply stays */
    }
    if (!raw) {
      return;
    }

    let placements = null;
    try {
      placements = placementsFromPaper(JSON.parse(raw));
    } catch (e) {
      placements = null;
    }
    if (!placements || placements.size === 0) {
      return;
    }
    showPaperPieces(placements);
  }

  // Replaces the board with the pieces read from paper, then measures.
  function showPaperPieces(placements) {
    if (gameState.drag) {
      finishDraggingPiece(true);
    }
    gameState.placedPieces = placements;
    gameState.activePieceId = null;
    gameState.freshPieceId = null;
    gameState.drag = null;
    rebuildGameOccupancy();
    runGameAreaDetection();
    updatePieceTrayState();
    if (placements.size > 0) {
      gameState.status.prefix = { key: "sq.s.imported", vars: { count: placements.size } };
      renderStatus();
    }
  }

  // payload = { boardId, placements: [{ typeId, variantIndex, marker: {x, y} }] }
  // Returns a Map pieceId -> placed piece, or null when anything does not fit.
  // An empty list is refused unless allowEmpty (the live camera may see an
  // empty board).
  function placementsFromPaper(payload, allowEmpty = false) {
    const Boards = window.FenceBoards;
    const lattice = window.LatticeSquare;
    if (!Boards || !lattice || !payload || typeof payload !== "object") return null;
    if (!PAPER_BOARDS.has(payload.boardId)) return null;
    const list = payload.placements;
    if (!Array.isArray(list) || list.length > PENTOMINOES.length) return null;
    if (list.length === 0 && !allowEmpty) return null;

    const types = new Map(Boards.pieceTypes(payload.boardId).map((type) => [type.id, type]));
    const usedTypes = new Set();
    const taken = new Set();
    const result = new Map();

    for (const item of list) {
      if (!item || typeof item !== "object") return null;
      const type = types.get(item.typeId);
      if (!type || usedTypes.has(item.typeId)) return null;
      usedTypes.add(item.typeId);

      const variants = lattice.buildVariants(type.cells.map((c) => ({ x: c.x, y: c.y }))).variants;
      const vi = item.variantIndex;
      if (!Number.isInteger(vi) || vi < 0 || vi >= variants.length) return null;
      const marker = item.marker;
      if (!marker || !Number.isInteger(marker.x) || !Number.isInteger(marker.y)) return null;

      const cells = variants[vi].cells.map((rel) => ({ x: rel.x + marker.x, y: rel.y + marker.y }));
      for (const cell of cells) {
        const key = keyOf(cell.x, cell.y);
        if (!isInsideBoard(cell.x, cell.y) || taken.has(key)) return null;
        taken.add(key);
      }

      const match = matchPentomino(cells);
      if (!match || result.has(match.piece.id)) return null;
      const anchorX = Math.min(...cells.map((cell) => cell.x));
      const anchorY = Math.min(...cells.map((cell) => cell.y));
      result.set(
        match.piece.id,
        buildPlacedPiece(match.piece, match.rotation, match.flipped, match.relativeCells, anchorX, anchorY),
      );
    }
    return result;
  }

  // Finds which of the 12 pieces covers exactly these cells, and in which
  // orientation (rotation, flip) the lab would draw it.
  function matchPentomino(cells) {
    const target = cellsSignature(normalizeCells(cells.map((cell) => [cell.x, cell.y])));
    for (const piece of PENTOMINOES) {
      for (const flipped of [false, true]) {
        for (let rotation = 0; rotation < 4; rotation += 1) {
          const relativeCells = getOrientedCells(piece.cells, rotation, flipped);
          if (cellsSignature(relativeCells) === target) {
            return { piece, rotation, flipped, relativeCells };
          }
        }
      }
    }
    return null;
  }

  function cellsSignature(cells) {
    return cells
      .map((cell) => keyOf(cell.x, cell.y))
      .sort()
      .join("|");
  }

  /* ------------------------------------------------ camera inside the board */

  // The camera chip turns the board itself into the camera window: the
  // printed board is straightened onto the drawn one, cell on cell, and once
  // the view is steady its pieces are put on the digital board. Tapping the
  // chip again closes the camera; the pieces stay.
  function cameraSupported() {
    try {
      return Boolean(
        window.FenceInboard &&
          typeof window.FenceInboard.open === "function" &&
          window.FenceInboard.supported() &&
          window.FenceBoards &&
          window.FenceBoards.get(CAMERA_BOARD),
      );
    } catch (e) {
      return false;
    }
  }

  function bindCamera() {
    const chip = dom.cameraToggle;
    if (!chip) {
      return;
    }
    chip.hidden = !cameraSupported();
    chip.addEventListener("click", () => {
      if (cameraState.view) {
        closeCamera();
      } else {
        openCamera();
      }
    });
    // Leaving the page always switches the camera off.
    window.addEventListener("pagehide", () => closeCamera(true));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        closeCamera(true);
      }
    });
  }

  function openCamera() {
    if (cameraState.view || !cameraSupported()) {
      return;
    }
    if (gameState.drag) {
      finishDraggingPiece(true);
    }
    dom.cameraFrame.hidden = false;
    cameraState.frameKey = "";
    placeCameraFrame();
    let view = null;
    try {
      view = window.FenceInboard.open({
        host: dom.cameraHost,
        boardId: CAMERA_BOARD,
        worldToHost: cellToHost,
        onPlacements: cameraPlacements,
        onState: cameraStateChanged,
        onClose: cameraClosed,
      });
    } catch (e) {
      view = null;
    }
    if (!view) {
      dom.cameraFrame.hidden = true;
      setStatus("sq.s.camError");
      return;
    }
    cameraState.view = view;
    document.body.dataset.fcCamera = "starting";
    localizeCameraToggle();
  }

  // quiet: the page is going away, no message.
  function closeCamera(quiet = false) {
    const view = cameraState.view;
    if (!view) {
      return;
    }
    cameraState.view = null;
    try {
      view.close();
    } catch (e) {
      /* already closed */
    }
    cameraClosed(quiet);
  }

  // Called when the camera view is gone, whoever closed it.
  function cameraClosed(quiet) {
    cameraState.view = null;
    dom.cameraFrame.hidden = true;
    document.body.dataset.fcCamera = "stopped";
    localizeCameraToggle();
    if (quiet !== true) {
      setStatus("sq.s.camClosed");
    }
  }

  function cameraStateChanged(state) {
    if (!cameraState.view) {
      return;
    }
    const value = String(state || "");
    document.body.dataset.fcCamera = value;
    if (value === "starting") {
      setStatus("sq.s.camStarting");
    } else if (value === "searching") {
      setStatus("sq.s.camSearching");
    } else if (value === "locked") {
      setStatus("sq.s.camLocked");
    } else if (value.indexOf("error") === 0) {
      setStatus("sq.s.camError");
    }
  }

  // A new steady set of pieces read on paper: checked with the same rules as
  // "Continue on screen", then put on the board and measured.
  function cameraPlacements(placements, result) {
    if (!cameraState.view) {
      return;
    }
    const boardId = result && result.boardId ? result.boardId : CAMERA_BOARD;
    const pieces = placementsFromPaper({ boardId, placements }, true);
    if (!pieces) {
      return;
    }
    showPaperPieces(pieces);
    document.body.dataset.fcArea = String(gameState.analysis ? gameState.analysis.totalArea : 0);
  }

  // World point of the square lattice (cell (x, y) is centred at (x, y)) to
  // CSS pixels inside the camera host, which covers the drawn grid exactly.
  function cellToHost(point) {
    const layout = gameState.layout;
    const size = layout ? cameraCellSize() : 0;
    return {
      x: (point.x + 0.5) * size,
      y: (point.y + 0.5) * size,
    };
  }

  // One cell in CSS pixels (the canvas is drawn at its CSS size).
  function cameraCellSize() {
    const layout = gameState.layout;
    const scale = layout.viewWidth ? dom.gameBoard.clientWidth / layout.viewWidth : 1;
    return layout.cellSize * scale;
  }

  // Lays the camera frame exactly over the drawn grid, and tells the camera
  // view when that place changes.
  function placeCameraFrame() {
    const layout = gameState.layout;
    if (!cameraState.view && dom.cameraFrame.hidden) {
      return;
    }
    if (!layout) {
      return;
    }
    const canvas = dom.gameBoard;
    const scale = layout.viewWidth ? canvas.clientWidth / layout.viewWidth : 1;
    const left = canvas.offsetLeft + canvas.clientLeft + layout.originX * scale;
    const top = canvas.offsetTop + canvas.clientTop + layout.originY * scale;
    const size = layout.boardPx * scale;
    const key = [left, top, size].map((v) => v.toFixed(2)).join(",");
    if (key === cameraState.frameKey) {
      return;
    }
    cameraState.frameKey = key;
    const style = dom.cameraFrame.style;
    style.left = `${left}px`;
    style.top = `${top}px`;
    style.width = `${size}px`;
    style.height = `${size}px`;
    if (cameraState.view && typeof cameraState.view.refresh === "function") {
      try {
        cameraState.view.refresh();
      } catch (e) {
        /* the next resize tries again */
      }
    }
  }

  function localizeCameraToggle() {
    const chip = dom.cameraToggle;
    if (!chip) {
      return;
    }
    const open = Boolean(cameraState.view);
    const key = open ? "sq.cam.close" : "sq.cam.open";
    chip.setAttribute("data-i18n-aria-label", key);
    chip.setAttribute("data-i18n-title", key);
    chip.setAttribute("aria-label", t(key));
    chip.title = t(key);
    chip.setAttribute("aria-pressed", open ? "true" : "false");
    chip.classList.toggle("active", open);
  }

  /* ------------------------------------------------ helpers */

  function getOrientedCells(cells, rotation, flipped) {
    const transformed = cells.map((cell) => {
      let x = cell[0];
      let y = cell[1];

      if (flipped) {
        x = -x;
      }

      for (let i = 0; i < rotation; i += 1) {
        const nextX = y;
        const nextY = -x;
        x = nextX;
        y = nextY;
      }

      return { x, y };
    });

    return normalizeCells(transformed.map((cell) => [cell.x, cell.y]));
  }

  function normalizeCells(cells) {
    const objects = cells.map((cell) => ({ x: cell[0], y: cell[1] }));
    const minX = Math.min(...objects.map((cell) => cell.x));
    const minY = Math.min(...objects.map((cell) => cell.y));
    return objects.map((cell) => ({ x: cell.x - minX, y: cell.y - minY }));
  }

  function eventToCell(event, canvas, layout) {
    if (!layout) {
      return null;
    }

    const point = canvasCssPointFromEvent(event, canvas);
    if (!point) {
      return null;
    }

    const x = Math.floor((point.x - layout.originX) / layout.cellSize);
    const y = Math.floor((point.y - layout.originY) / layout.cellSize);
    if (!isInsideBoard(x, y)) {
      return null;
    }
    return { x, y };
  }

  function canvasCssPointFromEvent(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function prepareCanvas(canvas, ctx, minSize) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(minSize, Math.floor(rect.width));
    const height = Math.max(minSize, Math.floor(rect.height));
    const targetWidth = Math.floor(width * dpr);
    const targetHeight = Math.floor(height * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
  }

  function isInsideBoard(x, y) {
    return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
  }

  function makeNullGrid() {
    return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));
  }

  function keyOf(x, y) {
    return `${x},${y}`;
  }

  function clamp(value, min, max) {
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  }
})();
