const BOARD_SIZE = 20;
const ORTHOGONAL_NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const EMPTY_SPACE_NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const SAMPLE_OFFSETS = [0.3, 0.5, 0.7];
const CAMERA_TILE_ID = "__camera__";
const GAME_WEBSITE_URL = "https://fence-challenge.org";
const CUSTOM_MARKER_THRESHOLD = 90;
const CUSTOM_MARKER_CELL_THRESHOLD = 140;
const MARKER_TO_BOARD_U_MIN = 0.09;
const MARKER_TO_BOARD_U_MAX = 0.91;
const MARKER_TO_BOARD_V_MIN = 0.08;
const MARKER_TO_BOARD_V_MAX = 0.9;
const USE_DYNAMIC_BOARD_FIT = false;
const USE_GRID_LINE_REFINEMENT = true;
const ALLOW_GRID_MARKER_FALLBACK = false;
const ENABLE_STRICT_GRID_MARKER_AUGMENT = true;
const GRID_AUGMENT_MIN_CONFIDENCE = 0.82;
const GRID_AUGMENT_MIN_MARGIN = 2;
const GRID_AUGMENT_MAX_DISTANCE = 9;

const BOARD_MARKERS = {
  tl: "11111/11111/11011/10111/11111",
  tr: "11111/11111/11001/10111/11111",
  bl: "11111/10111/10011/11111/11111",
  br: "11111/11111/10111/11111/11111",
};

const PIECE_MARKERS = [
  {
    signature: "111111/100101/100101/101111/111011/111111",
    pieceId: "N",
    rel: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, -1],
      [1, 0],
    ],
  },
  {
    signature: "111111/101111/110011/101111/101001/111111",
    pieceId: "F",
    rel: [
      [-1, 0],
      [0, -1],
      [0, 0],
      [0, 1],
      [1, -1],
    ],
  },
  {
    signature: "111111/100111/100111/100101/110101/111111",
    pieceId: "L",
    rel: [
      [0, -2],
      [0, -1],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
  },
  {
    signature: "111111/101001/111111/111011/101001/111111",
    pieceId: "I",
    rel: [
      [0, -2],
      [0, -1],
      [0, 0],
      [0, 1],
      [0, 2],
    ],
  },
  {
    signature: "111111/100001/100011/110111/110001/111111",
    pieceId: "P",
    rel: [
      [0, -1],
      [0, 0],
      [0, 1],
      [1, -1],
      [1, 0],
    ],
  },
  {
    signature: "111111/101101/110111/110001/111101/111111",
    pieceId: "T",
    rel: [
      [-1, 0],
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
    ],
  },
  {
    signature: "111111/111011/111101/111011/111001/111111",
    pieceId: "W",
    rel: [
      [-1, -1],
      [-1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
  },
  {
    signature: "111111/110001/100011/110101/111111/111111",
    pieceId: "U",
    rel: [
      [0, -1],
      [0, 0],
      [0, 1],
      [1, -1],
      [1, 1],
    ],
  },
  {
    signature: "111111/110011/101111/110001/101111/111111",
    pieceId: "V",
    rel: [
      [-2, 0],
      [-1, 0],
      [0, -2],
      [0, -1],
      [0, 0],
    ],
  },
  {
    signature: "111111/110111/110111/111101/110101/111111",
    pieceId: "Y",
    rel: [
      [-1, 0],
      [0, -1],
      [0, 0],
      [0, 1],
      [0, 2],
    ],
  },
  {
    signature: "111111/111001/110111/110011/100001/111111",
    pieceId: "X",
    rel: [
      [-1, 0],
      [0, -1],
      [0, 0],
      [0, 1],
      [1, 0],
    ],
  },
  {
    signature: "111111/110111/100101/100011/101011/111111",
    pieceId: "Z",
    rel: [
      [-1, -1],
      [0, -1],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
  },
  {
    signature: "111111/111111/101101/111011/101101/111111",
    pieceId: "N",
    rel: [
      [-1, -1],
      [-1, 0],
      [0, 0],
      [0, 1],
      [0, 2],
    ],
  },
  {
    signature: "111111/101101/100011/100111/100001/111111",
    pieceId: "F",
    rel: [
      [-1, -1],
      [0, -1],
      [0, 0],
      [0, 1],
      [1, 0],
    ],
  },
  {
    signature: "111111/111111/101111/101011/100011/111111",
    pieceId: "L",
    rel: [
      [-1, 1],
      [0, -2],
      [0, -1],
      [0, 0],
      [0, 1],
    ],
  },
  {
    signature: "111111/100001/111111/100111/101001/111111",
    pieceId: "I",
    rel: [
      [0, -2],
      [0, -1],
      [0, 0],
      [0, 1],
      [0, 2],
    ],
  },
  {
    signature: "111111/111101/101111/110001/110101/111111",
    pieceId: "P",
    rel: [
      [-1, -1],
      [-1, 0],
      [0, -1],
      [0, 0],
      [0, 1],
    ],
  },
  {
    signature: "111111/110011/111001/110001/110011/111111",
    pieceId: "U",
    rel: [
      [-1, -1],
      [-1, 1],
      [0, -1],
      [0, 0],
      [0, 1],
    ],
  },
  {
    signature: "111111/111101/110001/111101/101111/111111",
    pieceId: "W",
    rel: [
      [-1, 1],
      [0, 0],
      [0, 1],
      [1, -1],
      [1, 0],
    ],
  },
  {
    signature: "111111/101011/110011/101111/110101/111111",
    pieceId: "V",
    rel: [
      [0, -2],
      [0, -1],
      [0, 0],
      [1, 0],
      [2, 0],
    ],
  },
  {
    signature: "111111/111001/111011/101111/100111/111111",
    pieceId: "Y",
    rel: [
      [0, -1],
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
    ],
  },
  {
    signature: "111111/111011/101011/111011/101111/111111",
    pieceId: "X",
    rel: [
      [-1, 0],
      [0, -1],
      [0, 0],
      [0, 1],
      [1, 0],
    ],
  },
  {
    signature: "111111/110111/100101/111101/100111/111111",
    pieceId: "Z",
    rel: [
      [-1, 1],
      [0, -1],
      [0, 0],
      [0, 1],
      [1, -1],
    ],
  },
];

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

const ZODIAC_NAMES = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

const PIECE_COLORS = [
  "#ff6b6b",
  "#f59f00",
  "#ffd43b",
  "#94d82d",
  "#38d9a9",
  "#22b8cf",
  "#4dabf7",
  "#748ffc",
  "#9775fa",
  "#da77f2",
  "#f06595",
  "#ffa8a8",
];

const PENTOMINOES = Object.keys(PIECE_DEFINITIONS).map((id, index) => ({
  id,
  name: ZODIAC_NAMES[index],
  color: PIECE_COLORS[index],
  cells: PIECE_DEFINITIONS[id],
}));

const PIECE_BY_ID = new Map(PENTOMINOES.map((piece) => [piece.id, piece]));
const BOARD_MARKER_ENTRIES = Object.entries(BOARD_MARKERS).map(([label, signature]) => ({ label, signature }));
const BOARD_MARKER_LOOKUP = BOARD_MARKER_ENTRIES.map((entry) => ({
  ...entry,
  rotated: buildSignatureRotations(entry.signature, 5),
}));
const PIECE_MARKER_LOOKUP = PIECE_MARKERS.map((entry) => ({
  ...entry,
  rotated: buildSignatureRotations(entry.signature, 6),
}));

const dom = {
  cameraToggle: document.getElementById("camera-toggle"),
  sideBrandLink: document.getElementById("side-brand-link"),
  gamePanel: document.getElementById("panel-game"),
  cameraPanel: document.getElementById("panel-camera"),
  gameLayout: document.querySelector("#panel-game .game-layout"),
  gameToolbar: document.querySelector("#panel-game .game-toolbar"),
  pieceTray: document.getElementById("piece-tray"),
  gameStatus: document.getElementById("game-status"),
  gameMetrics: document.getElementById("game-metrics"),
  rotatePiece: document.getElementById("rotate-piece"),
  flipPiece: document.getElementById("flip-piece"),
  clearBoard: document.getElementById("clear-board"),
  detectGameArea: document.getElementById("detect-game-area"),
  gameBoard: document.getElementById("game-board"),
  cameraInlineStage: document.getElementById("camera-inline-stage"),
  quickTakePicture: document.getElementById("quick-take-picture"),
  cameraStatus: document.getElementById("camera-status"),
  cameraMetrics: document.getElementById("camera-metrics"),
  cameraVideo: document.getElementById("quick-camera-video"),
  cameraCapture: document.getElementById("quick-camera-capture"),
  cameraGrid: document.getElementById("camera-grid"),
  startCamera: document.getElementById("start-camera"),
  stopCamera: document.getElementById("stop-camera"),
  captureFrame: document.getElementById("capture-frame"),
  uploadFrame: document.getElementById("upload-frame"),
  autoQr: document.getElementById("auto-qr"),
  resetCorners: document.getElementById("reset-corners"),
  detectCameraFence: document.getElementById("detect-camera-fence"),
  computeCameraArea: document.getElementById("compute-camera-area"),
  clearCameraMask: document.getElementById("clear-camera-mask"),
  thresholdSlider: document.getElementById("luma-threshold"),
  thresholdValue: document.getElementById("threshold-value"),
};

const gameCtx = dom.gameBoard.getContext("2d");
const captureCtx = dom.cameraCapture.getContext("2d");
const cameraGridCtx = dom.cameraGrid.getContext("2d");

const gameState = {
  selectedPieceId: null,
  activePieceId: null,
  rotation: 0,
  flipped: false,
  placedPieces: new Map(),
  importedMask: makeBoolGrid(false),
  drag: null,
  occupiedBy: makeNullGrid(),
  interiorKeys: new Set(),
  leakKeys: new Set(),
  analysis: null,
  hoverCell: null,
  layout: null,
};

const cameraState = {
  stream: null,
  frameImage: null,
  corners: [],
  boardProjection: null,
  mask: makeBoolGrid(false),
  analysis: null,
  layout: null,
  threshold: Number(dom.thresholdSlider.value),
  qrCount: 0,
  markerCount: 0,
};

const pieceButtons = new Map();

init();

function init() {
  buildPieceTray();
  bindModeToggle();
  bindGameControls();
  bindCameraControls();
  updatePieceTrayState();
  updateGameMetrics();
  updateCameraMetrics();
  syncGameLayoutSize();
  renderGameBoard();
  renderCaptureCanvas();
  renderCameraGrid();
  setGameStatus("Tap an icon to add a tile.");
  setCameraStatus("Align the physical board and tap Take Picture.");
  dom.thresholdValue.textContent = String(cameraState.threshold);
  if (dom.sideBrandLink) {
    dom.sideBrandLink.href = GAME_WEBSITE_URL;
  }
  const requestedMode = new URLSearchParams(window.location.search).get("mode");
  activateMode(requestedMode === "camera" ? "camera" : "game");

  window.addEventListener("resize", () => {
    syncGameLayoutSize();
    renderGameBoard();
    renderCaptureCanvas();
    renderCameraGrid();
  });

  window.addEventListener("beforeunload", () => {
    stopCameraStream();
  });
}

function bindModeToggle() {
  if (!dom.cameraToggle) {
    return;
  }

  dom.cameraToggle.addEventListener("click", () => {
    if (dom.gamePanel.classList.contains("camera-inline-active")) {
      return;
    }
    activateMode("camera");
  });
}

function activateMode(mode) {
  const isGame = mode === "game";
  const isCamera = !isGame;
  dom.gamePanel.classList.add("active");
  dom.gamePanel.classList.toggle("camera-inline-active", isCamera);
  dom.cameraPanel.classList.remove("active");

  if (dom.cameraToggle) {
    dom.cameraToggle.classList.toggle("active", isCamera);
    dom.cameraToggle.setAttribute("aria-pressed", isCamera ? "true" : "false");
  }

  if (isGame) {
    stopCameraStream();
    syncGameLayoutSize();
    renderGameBoard();
  } else {
    syncGameLayoutSize();
    renderGameBoard();
    void startCameraStream();
    setGameStatus("Camera is active. Tap Take Picture.");
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
    gameState.selectedPieceId = null;
    gameState.activePieceId = null;
    gameState.rotation = 0;
    gameState.flipped = false;
    gameState.placedPieces.clear();
    gameState.importedMask = makeBoolGrid(false);
    gameState.drag = null;
    gameState.occupiedBy = makeNullGrid();
    clearGameAnalysis();
    updatePieceTrayState();
    updateGameMetrics();
    renderGameBoard();
    setGameStatus("Board cleared.");
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
    if (!occupant) {
      return;
    }
    if (!gameState.placedPieces.has(occupant)) {
      return;
    }

    gameState.activePieceId = occupant;
    startDraggingPiece(occupant, cell, event.pointerId);
    dom.gameBoard.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  dom.gameBoard.addEventListener("pointermove", (event) => {
    if (gameState.drag && gameState.drag.pointerId === event.pointerId) {
      gameState.drag.pointerCell = eventToCell(event, dom.gameBoard, gameState.layout);
      renderGameBoard();
      return;
    }

    if (!gameState.drag) {
      const cell = eventToCell(event, dom.gameBoard, gameState.layout);
      gameState.hoverCell = cell;
      if (cell && gameState.placedPieces.has(gameState.occupiedBy[cell.y][cell.x])) {
        dom.gameBoard.style.cursor = "grab";
      } else {
        dom.gameBoard.style.cursor = "crosshair";
      }
      renderGameBoard();
    }
  });

  dom.gameBoard.addEventListener("pointerleave", () => {
    if (gameState.drag) {
      return;
    }
    gameState.hoverCell = null;
    renderGameBoard();
  });

  dom.gameBoard.addEventListener("pointerup", (event) => {
    if (gameState.drag && gameState.drag.pointerId === event.pointerId) {
      gameState.drag.pointerCell = eventToCell(event, dom.gameBoard, gameState.layout);
      finishDraggingPiece();
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
    }
  });
}

function bindCameraControls() {
  if (dom.quickTakePicture) {
    dom.quickTakePicture.addEventListener("click", async () => {
      await quickCaptureImportToGame();
    });
  }

  dom.startCamera.addEventListener("click", async () => {
    await startCameraStream();
  });

  dom.stopCamera.addEventListener("click", () => {
    stopCameraStream();
    setCameraStatus("Camera stopped.");
  });

  dom.captureFrame.addEventListener("click", () => {
    captureCurrentFrame();
  });

  dom.uploadFrame.addEventListener("change", (event) => {
    const target = event.target;
    const file = target && target.files && target.files[0] ? target.files[0] : null;
    if (!file) {
      return;
    }
    loadFrameFromFile(file);
    target.value = "";
  });

  dom.autoQr.addEventListener("click", async () => {
    await autoDetectQRCorners();
  });

  dom.resetCorners.addEventListener("click", () => {
    cameraState.corners = [];
    cameraState.boardProjection = null;
    renderCaptureCanvas();
    setCameraStatus("Corners reset. Click 4 board corners again.");
  });

  dom.thresholdSlider.addEventListener("input", () => {
    cameraState.threshold = Number(dom.thresholdSlider.value);
    dom.thresholdValue.textContent = String(cameraState.threshold);
  });

  dom.detectCameraFence.addEventListener("click", () => {
    detectFenceFromFrame();
  });

  dom.computeCameraArea.addEventListener("click", () => {
    computeCameraAreaFromMask();
  });

  dom.clearCameraMask.addEventListener("click", () => {
    cameraState.mask = makeBoolGrid(false);
    cameraState.analysis = null;
    renderCameraGrid();
    updateCameraMetrics();
    setCameraStatus("Detection mask cleared.");
  });

  dom.cameraCapture.addEventListener("click", (event) => {
    if (!cameraState.frameImage) {
      setCameraStatus("Capture a frame before selecting corners.");
      return;
    }

    const point = canvasPixelPointFromEvent(event, dom.cameraCapture);
    if (!point) {
      return;
    }

    if (cameraState.corners.length < 4) {
      cameraState.corners.push(point);
      setCameraStatus(`Corner ${cameraState.corners.length}/4 selected.`);
    } else {
      const nearestIndex = indexOfNearestCorner(point, cameraState.corners);
      cameraState.corners[nearestIndex] = point;
      setCameraStatus("Updated nearest corner point.");
    }
    if (cameraState.corners.length === 4) {
      cameraState.boardProjection = buildBoardProjectionFromBoardCorners(cameraState.corners);
    } else {
      cameraState.boardProjection = null;
    }

    renderCaptureCanvas();
  });

  dom.cameraGrid.addEventListener("click", (event) => {
    const cell = eventToCell(event, dom.cameraGrid, cameraState.layout);
    if (!cell) {
      return;
    }

    cameraState.mask[cell.y][cell.x] = !cameraState.mask[cell.y][cell.x];
    cameraState.analysis = null;
    renderCameraGrid();
    updateCameraMetrics();
    setCameraStatus("Mask cell toggled. Click Compute Area to refresh area.");
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
    drawPiecePreview(preview, piece);
    button.setAttribute("aria-label", `Piece ${piece.id}`);

    button.append(preview);
    button.addEventListener("click", () => {
      handlePieceSelection(piece.id);
    });

    pieceButtons.set(piece.id, button);
    dom.pieceTray.append(button);
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
    setGameStatus("Finish dragging the current piece first.");
    return;
  }

  if (gameState.placedPieces.has(pieceId)) {
    gameState.activePieceId = pieceId;
    setGameStatus("Piece selected on board.");
    updatePieceTrayState();
    renderGameBoard();
    return;
  }

  autoPlacePiece(pieceId);
}

function rotateSelectedPiece() {
  if (gameState.drag) {
    setGameStatus("Release the dragged piece before rotating.");
    return;
  }
  if (tryTransformActivePiece({ rotate: true })) {
    return;
  }
  if (!gameState.selectedPieceId) {
    setGameStatus("Select a piece before rotating.");
    return;
  }
  gameState.rotation = (gameState.rotation + 1) % 4;
  clearGameAnalysis();
  renderGameBoard();
  updatePieceTrayState();
}

function flipSelectedPiece() {
  if (gameState.drag) {
    setGameStatus("Release the dragged piece before flipping.");
    return;
  }
  if (tryTransformActivePiece({ flip: true })) {
    return;
  }
  if (!gameState.selectedPieceId) {
    setGameStatus("Select a piece before flipping.");
    return;
  }
  gameState.flipped = !gameState.flipped;
  clearGameAnalysis();
  renderGameBoard();
  updatePieceTrayState();
}

function autoPlacePiece(pieceId) {
  const piece = PIECE_BY_ID.get(pieceId);
  if (!piece) {
    return;
  }

  const rotation = 0;
  const flipped = false;
  const relativeCells = getOrientedCells(piece.cells, rotation, flipped);
  const anchor = findBestAnchorForCells(relativeCells);
  if (!anchor) {
    setGameStatus("No space left for this tile.");
    return;
  }

  const placed = buildPlacedPiece(piece, rotation, flipped, relativeCells, anchor.x, anchor.y);
  gameState.placedPieces.set(piece.id, placed);
  gameState.selectedPieceId = null;
  gameState.activePieceId = piece.id;
  gameState.rotation = 0;
  gameState.flipped = false;
  rebuildGameOccupancy();
  clearGameAnalysis();
  updatePieceTrayState();
  updateGameMetrics();
  renderGameBoard();
  setGameStatus("Tile added.");
}

function findBestAnchorForCells(relativeCells) {
  const maxX = Math.max(...relativeCells.map((cell) => cell.x));
  const maxY = Math.max(...relativeCells.map((cell) => cell.y));
  const center = (BOARD_SIZE - 1) / 2;
  let best = null;

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (!canPlaceCells(relativeCells, x, y)) {
        continue;
      }
      const cx = x + maxX / 2;
      const cy = y + maxY / 2;
      const distance = Math.abs(cx - center) + Math.abs(cy - center);
      if (!best || distance < best.distance) {
        best = { x, y, distance };
      }
    }
  }

  return best ? { x: best.x, y: best.y } : null;
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
    setGameStatus(rotate ? "Tile rotated." : "Tile flipped.");
  } else {
    gameState.placedPieces.set(pieceId, placed);
    setGameStatus(rotate ? "Cannot rotate here." : "Cannot flip here.");
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

function placeSelectedPiece(anchorX, anchorY) {
  const piece = PIECE_BY_ID.get(gameState.selectedPieceId);
  if (!piece) {
    return;
  }

  const relativeCells = getOrientedCells(piece.cells, gameState.rotation, gameState.flipped);
  if (!canPlaceCells(relativeCells, anchorX, anchorY)) {
    setGameStatus("Invalid placement: piece must stay in bounds and not overlap existing pieces.");
    return;
  }

  const placed = buildPlacedPiece(piece, gameState.rotation, gameState.flipped, relativeCells, anchorX, anchorY);

  gameState.placedPieces.set(piece.id, placed);
  gameState.selectedPieceId = null;
  gameState.rotation = 0;
  gameState.flipped = false;
  rebuildGameOccupancy();
  clearGameAnalysis();
  updatePieceTrayState();
  updateGameMetrics();
  renderGameBoard();
  setGameStatus(`Placed ${piece.name} (${piece.id}).`);
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
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (gameState.importedMask[y][x]) {
        gameState.occupiedBy[y][x] = CAMERA_TILE_ID;
      }
    }
  }
  for (const placed of gameState.placedPieces.values()) {
    for (const cell of placed.cells) {
      gameState.occupiedBy[cell.y][cell.x] = placed.id;
    }
  }
}

function runGameAreaDetection() {
  const blocked = makeBoolGrid(false);
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      blocked[y][x] = Boolean(gameState.occupiedBy[y][x]);
    }
  }

  const analysis = analyzeFence(blocked);
  gameState.analysis = analysis;
  gameState.interiorKeys = new Set(analysis.interiorKeys);
  gameState.leakKeys = new Set(analysis.leakKeys);
  updateGameMetrics();
  renderGameBoard();

  if (analysis.totalArea === 0) {
    setGameStatus(
      analysis.cornerLeak
        ? "Corner leak: the outside slips through a corner, so nothing is enclosed yet."
        : "No enclosed area detected yet.",
    );
    return;
  }

  const largest = analysis.components[0] ? analysis.components[0].size : 0;
  let message = `Fence detected: enclosed area ${analysis.totalArea} unit squares across ${analysis.components.length} region(s). Largest region: ${largest}.`;
  if (analysis.cornerLeak) {
    message += ` Corner leak: the outside slips through a corner, so those cells stay open.`;
  }
  setGameStatus(message);
}

function clearGameAnalysis() {
  gameState.analysis = null;
  gameState.interiorKeys.clear();
  if (gameState.leakKeys) gameState.leakKeys.clear();
}

function syncGameLayoutSize() {
  const panel = dom.gamePanel;
  const toolbar = dom.gameToolbar;
  if (!panel || !toolbar) {
    return;
  }

  const compactLayout = window.matchMedia("(max-width: 1180px)").matches;
  if (compactLayout) {
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

  gameState.layout = { originX, originY, cellSize, boardPx };

  gameCtx.clearRect(0, 0, view.width, view.height);
  gameCtx.fillStyle = "#0f151f";
  gameCtx.fillRect(originX - 2, originY - 2, boardPx + 4, boardPx + 4);

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const px = originX + x * cellSize;
      const py = originY + y * cellSize;
      const key = keyOf(x, y);
      const occupant = gameState.occupiedBy[y][x];

      if (occupant === CAMERA_TILE_ID) {
        gameCtx.fillStyle = "#f59f00";
      } else if (occupant) {
        const piece = PIECE_BY_ID.get(occupant);
        gameCtx.fillStyle = piece ? piece.color : "#888";
      } else if (gameState.interiorKeys.has(key)) {
        gameCtx.fillStyle = "rgba(46, 207, 153, 0.55)";
      } else if (gameState.leakKeys && gameState.leakKeys.has(key)) {
        gameCtx.fillStyle = "rgba(178, 120, 255, 0.35)";
      } else {
        gameCtx.fillStyle = "#121a26";
      }

      gameCtx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
    }
  }

  if (gameState.interiorKeys.size > 0) {
    gameCtx.save();
    gameCtx.shadowBlur = 10;
    gameCtx.shadowColor = "rgba(46, 207, 153, 0.85)";
    gameCtx.fillStyle = "rgba(46, 207, 153, 0.5)";
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        if (gameState.interiorKeys.has(keyOf(x, y))) {
          gameCtx.fillRect(originX + x * cellSize + 1, originY + y * cellSize + 1, cellSize - 2, cellSize - 2);
        }
      }
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
  drawPiecePreviewOnBoard();
  drawDraggingPieceOnBoard();

  gameCtx.strokeStyle = "#5a708f";
  gameCtx.lineWidth = 1.6;
  gameCtx.strokeRect(originX + 0.5, originY + 0.5, boardPx, boardPx);
}

function drawPiecePreviewOnBoard() {
  if (!gameState.selectedPieceId || !gameState.hoverCell) {
    return;
  }

  const piece = PIECE_BY_ID.get(gameState.selectedPieceId);
  if (!piece) {
    return;
  }

  const relativeCells = getOrientedCells(piece.cells, gameState.rotation, gameState.flipped);
  const canPlace = canPlaceCells(relativeCells, gameState.hoverCell.x, gameState.hoverCell.y);
  const { originX, originY, cellSize } = gameState.layout;

  gameCtx.save();
  gameCtx.globalAlpha = 0.48;
  gameCtx.fillStyle = canPlace ? piece.color : "#f36f6f";
  for (const cell of relativeCells) {
    const x = gameState.hoverCell.x + cell.x;
    const y = gameState.hoverCell.y + cell.y;
    if (!isInsideBoard(x, y)) {
      continue;
    }
    const px = originX + x * cellSize;
    const py = originY + y * cellSize;
    gameCtx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
  }
  gameCtx.restore();
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

    const selected = gameState.selectedPieceId === piece.id || gameState.activePieceId === piece.id;
    const placed = gameState.placedPieces.has(piece.id) || (gameState.drag && gameState.drag.pieceId === piece.id);
    button.classList.toggle("selected", selected);
    button.classList.toggle("placed", placed);
  }
}

function updateGameMetrics() {
  const totalArea = gameState.analysis ? gameState.analysis.totalArea : 0;

  dom.gameMetrics.innerHTML = `<div>Area: <strong>${totalArea}</strong></div>`;
}

function setGameStatus(text) {
  dom.gameStatus.textContent = text;
}

function buildPlacedPiece(piece, rotation, flipped, relativeCells, anchorX, anchorY) {
  return {
    id: piece.id,
    name: piece.name,
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
  gameState.selectedPieceId = null;
  gameState.activePieceId = pieceId;
  gameState.hoverCell = null;
  gameState.drag = {
    pointerId,
    pieceId: placed.id,
    name: placed.name,
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
  };

  rebuildGameOccupancy();
  clearGameAnalysis();
  updatePieceTrayState();
  updateGameMetrics();
  dom.gameBoard.style.cursor = "grabbing";
  renderGameBoard();
  setGameStatus(`Dragging ${placed.name} (${placed.id}). Release to drop.`);
}

function finishDraggingPiece(forceRevert = false) {
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
      setGameStatus(`Moved ${drag.name} (${drag.pieceId}).`);
    }
  }

  if (!dropped) {
    gameState.placedPieces.set(drag.pieceId, drag.originalPiece);
    setGameStatus(`Invalid drop. ${drag.name} returned to its previous position.`);
  }

  gameState.activePieceId = drag.pieceId;
  gameState.drag = null;
  rebuildGameOccupancy();
  clearGameAnalysis();
  updatePieceTrayState();
  updateGameMetrics();
  dom.gameBoard.style.cursor = "crosshair";
  renderGameBoard();
}

async function startCameraStream() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setCameraStatus("Camera API not available in this browser.");
    return;
  }

  try {
    stopCameraStream();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
      },
      audio: false,
    });
    cameraState.stream = stream;
    dom.cameraVideo.srcObject = stream;
    await dom.cameraVideo.play();
    setCameraStatus("Camera started. Align board and tap Take Picture.");
  } catch (error) {
    setCameraStatus(`Could not start camera: ${error.message}`);
  }
}

function stopCameraStream() {
  if (!cameraState.stream) {
    dom.cameraVideo.srcObject = null;
    return;
  }

  for (const track of cameraState.stream.getTracks()) {
    track.stop();
  }

  cameraState.stream = null;
  dom.cameraVideo.srcObject = null;
}

async function quickCaptureImportToGame() {
  if (dom.quickTakePicture) {
    dom.quickTakePicture.disabled = true;
  }

  let loadedPieces = 0;
  let usedFallbackQr = false;
  try {
    if (!cameraState.stream || !dom.cameraVideo.videoWidth || !dom.cameraVideo.videoHeight) {
      await startCameraStream();
    }

    captureCurrentFrame();
    if (!cameraState.frameImage) {
      return;
    }

    const markerResult = detectCustomMarkersFromCapture();
    loadedPieces = loadPentominoesFromDetectedMarkers(markerResult);

    if (loadedPieces === 0) {
      const qrCodes = await detectQRCodesFromCapture();
      loadedPieces = await tryLoadPentominoesFromQRCodes(qrCodes);
      usedFallbackQr = loadedPieces > 0;
    }
  } finally {
    if (dom.quickTakePicture) {
      dom.quickTakePicture.disabled = false;
    }
    activateMode("game");
    if (loadedPieces === 0) {
      setGameStatus("No marker detected. Board unchanged.");
    } else if (usedFallbackQr) {
      setGameStatus(`Loaded ${loadedPieces} pentomino${loadedPieces === 1 ? "" : "es"} from QR fallback.`);
    }
  }
}

function setFallbackCornersFromFrame() {
  if (!cameraState.frameImage) {
    return;
  }
  const maxX = Math.max(0, cameraState.frameImage.width - 1);
  const maxY = Math.max(0, cameraState.frameImage.height - 1);
  cameraState.corners = [
    { x: 0, y: 0 },
    { x: maxX, y: 0 },
    { x: maxX, y: maxY },
    { x: 0, y: maxY },
  ];
  cameraState.boardProjection = buildBoardProjectionFromBoardCorners(cameraState.corners);
}

function detectCustomMarkersFromCapture() {
  if (!cameraState.frameImage) {
    return {
      cornersOrdered: [],
      pieces: [],
      markerCount: 0,
      cornerHits: [],
      markerCorners: [],
      selectedCornerHits: [],
      boardProjection: null,
      boardMatches: [],
      estimatedCellSizePx: null,
    };
  }

  const components = findDarkSquareComponents(cameraState.frameImage, CUSTOM_MARKER_THRESHOLD);
  const cornerHits = [];
  const piecesById = new Map();
  const pieceMarkerSizeSamples = [];
  const imageMinSide = Math.min(cameraState.frameImage.width, cameraState.frameImage.height);
  const maxSmallMarkerDim = imageMinSide * 0.048;
  const minCornerMarkerDim = Math.max(24, imageMinSide * 0.03);

  const pieceSamplingConfigs = [
    { threshold: 128, margin: 0.04 },
    { threshold: 140, margin: 0.06 },
    { threshold: 152, margin: 0.08 },
    { threshold: 116, margin: 0.05 },
  ];
  const cornerSamplingConfigs = [
    { threshold: 100, margin: 0.04 },
    { threshold: 112, margin: 0.06 },
    { threshold: 124, margin: 0.08 },
    { threshold: 136, margin: 0.05 },
  ];

  for (const component of components) {
    const pieceMatch = matchMarkerInComponent(
      cameraState.frameImage,
      component,
      PIECE_MARKER_LOOKUP,
      6,
      pieceSamplingConfigs,
      0.38,
    );
    if (pieceMatch) {
      const center = {
        x: component.minX + component.width / 2,
        y: component.minY + component.height / 2,
      };
      const candidate = {
        pieceId: pieceMatch.entry.pieceId,
        center,
        confidence: pieceMatch.confidence,
        distance: pieceMatch.distance,
        markerEntry: pieceMatch.entry,
        markerRotation: pieceMatch.rotation,
        source: "component",
      };
      if (component.width <= maxSmallMarkerDim && component.height <= maxSmallMarkerDim) {
        pieceMarkerSizeSamples.push(Math.min(component.width, component.height));
      }
      const current = piecesById.get(candidate.pieceId);
      if (isBetterPieceMarkerCandidate(current, candidate)) {
        piecesById.set(candidate.pieceId, candidate);
      }
    }

    const cornerMatch = matchMarkerInComponent(
      cameraState.frameImage,
      component,
      BOARD_MARKER_LOOKUP,
      5,
      cornerSamplingConfigs,
      0.5,
    );
    if (cornerMatch) {
      if (component.width < minCornerMarkerDim || component.height < minCornerMarkerDim) {
        continue;
      }
      if (cornerMatch.confidence < 0.62) {
        continue;
      }
      cornerHits.push({
        label: cornerMatch.entry.label,
        confidence: cornerMatch.confidence,
        distance: cornerMatch.distance,
        rotation: mod4(cornerMatch.rotation || 0),
        center: {
          x: component.minX + component.width / 2,
          y: component.minY + component.height / 2,
        },
        width: component.width,
        height: component.height,
        area: component.area,
      });
    }
  }

  const markerCorners = buildMarkerCorners(cornerHits, cameraState.frameImage);
  const selectedCornerHits = selectCornerHitsForMarkerQuad(markerCorners, cornerHits);
  const estimatedCellSizePx = robustMedian(pieceMarkerSizeSamples);
  const boardProjection =
    markerCorners.length === 4
      ? buildBoardProjectionFromMarkerCorners(markerCorners, cameraState.frameImage, estimatedCellSizePx)
      : null;
  const cornersOrdered = boardProjection
    ? boardProjection.boardCorners
    : markerCorners.length === 4
      ? markerCornersToBoardCorners(markerCorners, cameraState.frameImage, estimatedCellSizePx)
      : markerCorners;
  let boardMatches = [];
  if (cornersOrdered.length === 4) {
    boardMatches = detectPieceMarkersFromBoardGrid(cameraState.frameImage, cornersOrdered, boardProjection);
    if (ALLOW_GRID_MARKER_FALLBACK) {
      for (const candidate of boardMatches) {
        const current = piecesById.get(candidate.pieceId);
        const currentSource = current ? String(current.source || "") : "";
        const candidateSource = String(candidate.source || "");
        const shouldUseGridFallback =
          !current ||
          (currentSource !== "component" && isBetterPieceMarkerCandidate(current, candidate)) ||
          (candidateSource === "grid" &&
            currentSource === "component" &&
            current.confidence < 0.72 &&
            candidate.confidence > current.confidence + 0.2);
        if (shouldUseGridFallback) {
          piecesById.set(candidate.pieceId, candidate);
        }
      }
    }
    if (ENABLE_STRICT_GRID_MARKER_AUGMENT) {
      for (const candidate of boardMatches) {
        if (piecesById.has(candidate.pieceId)) {
          continue;
        }
        const margin = toNumberOrDefault(candidate.margin, 0);
        const isStrong =
          candidate.confidence >= GRID_AUGMENT_MIN_CONFIDENCE &&
          candidate.distance <= GRID_AUGMENT_MAX_DISTANCE &&
          margin >= GRID_AUGMENT_MIN_MARGIN;
        if (!isStrong) {
          continue;
        }
        piecesById.set(candidate.pieceId, {
          ...candidate,
          source: "grid-augment",
        });
      }
    }
  }

  cameraState.markerCount = piecesById.size;
  return {
    cornersOrdered,
    pieces: [...piecesById.values()],
    markerCount: piecesById.size,
    cornerHits,
    markerCorners,
    selectedCornerHits,
    boardProjection,
    boardMatches,
    estimatedCellSizePx,
  };
}

function selectCornerHitsForMarkerQuad(markerCorners, cornerHits) {
  if (!Array.isArray(markerCorners) || markerCorners.length !== 4 || !Array.isArray(cornerHits) || cornerHits.length === 0) {
    return [];
  }

  const slots = ["tl", "tr", "br", "bl"];
  const remaining = cornerHits.slice();
  const selected = [];

  for (let i = 0; i < markerCorners.length; i += 1) {
    const corner = markerCorners[i];
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let j = 0; j < remaining.length; j += 1) {
      const hit = remaining[j];
      if (!hit || !hit.center) {
        continue;
      }
      const distance = distanceBetweenPoints(corner, hit.center);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = j;
      }
    }
    if (bestIndex >= 0) {
      const [hit] = remaining.splice(bestIndex, 1);
      selected.push({
        slot: slots[i],
        label: hit.label || null,
        confidence: hit.confidence,
        distance: hit.distance,
        center: hit.center,
        width: hit.width,
        height: hit.height,
        area: hit.area,
        matchDistancePx: bestDistance,
      });
    }
  }

  return selected;
}

function markerCellForReport(marker, cornersOrdered, boardProjection = null) {
  if (marker && marker.markerCell && isInsideBoard(marker.markerCell.x, marker.markerCell.y)) {
    return { x: marker.markerCell.x, y: marker.markerCell.y };
  }
  if (marker && marker.center && Array.isArray(cornersOrdered) && cornersOrdered.length === 4) {
    return pointToBoardCellRounded(marker.center, cornersOrdered, boardProjection);
  }
  return null;
}

function roundForReport(value, digits = 3) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function pointForReport(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return null;
  }
  return {
    x: roundForReport(point.x, 3),
    y: roundForReport(point.y, 3),
  };
}

function buildMarkerDetectionReport(result) {
  const cornersOrdered = result && Array.isArray(result.cornersOrdered) ? result.cornersOrdered : [];
  const pieceMarkers = (result && Array.isArray(result.pieces) ? result.pieces : [])
    .map((marker) => {
      const boardCell = markerCellForReport(marker, cornersOrdered, result ? result.boardProjection : null);
      return {
        pieceId: marker.pieceId || null,
        source: marker.source || "unknown",
        confidence: roundForReport(marker.confidence, 4),
        distance: roundForReport(marker.distance, 3),
        markerRotation: mod4(marker.markerRotation || 0),
        centerPx: pointForReport(marker.center),
        markerCell: boardCell ? { x: boardCell.x, y: boardCell.y } : null,
      };
    })
    .sort((a, b) => {
      if (a.pieceId !== b.pieceId) {
        return String(a.pieceId).localeCompare(String(b.pieceId));
      }
      const byConfidence = (b.confidence || 0) - (a.confidence || 0);
      if (Math.abs(byConfidence) > 1e-9) {
        return byConfidence;
      }
      return String(a.source).localeCompare(String(b.source));
    });

  const uniquePieceIds = [...new Set(pieceMarkers.map((marker) => marker.pieceId).filter(Boolean))].sort();
  const cornerMarkers = (result && Array.isArray(result.cornerHits) ? result.cornerHits : [])
    .map((hit) => ({
      label: hit.label || null,
      confidence: roundForReport(hit.confidence, 4),
      distance: roundForReport(hit.distance, 3),
      centerPx: pointForReport(hit.center),
      widthPx: roundForReport(toNumberOrDefault(hit.width, 0), 2),
      heightPx: roundForReport(toNumberOrDefault(hit.height, 0), 2),
      areaPx: roundForReport(toNumberOrDefault(hit.area, 0), 2),
    }))
    .sort((a, b) => {
      if (a.label !== b.label) {
        return String(a.label).localeCompare(String(b.label));
      }
      return (b.confidence || 0) - (a.confidence || 0);
    });
  const uniqueCornerLabels = [...new Set(cornerMarkers.map((marker) => marker.label).filter(Boolean))].sort();
  const selectedCornerMarkers = (result && Array.isArray(result.selectedCornerHits) ? result.selectedCornerHits : []).map(
    (hit) => ({
      slot: hit.slot || null,
      label: hit.label || null,
      confidence: roundForReport(hit.confidence, 4),
      distance: roundForReport(hit.distance, 3),
      centerPx: pointForReport(hit.center),
      widthPx: roundForReport(toNumberOrDefault(hit.width, 0), 2),
      heightPx: roundForReport(toNumberOrDefault(hit.height, 0), 2),
      areaPx: roundForReport(toNumberOrDefault(hit.area, 0), 2),
      matchDistancePx: roundForReport(toNumberOrDefault(hit.matchDistancePx, 0), 3),
    }),
  );

  return {
    imageSize: cameraState.frameImage
      ? {
          width: cameraState.frameImage.width,
          height: cameraState.frameImage.height,
        }
      : null,
    markerQuadPx: (result && Array.isArray(result.markerCorners) ? result.markerCorners : []).map(pointForReport),
    boardQuadPx: cornersOrdered.map(pointForReport),
    estimatedCellSizePx: roundForReport(result ? result.estimatedCellSizePx : null, 3),
    cornerMarkers,
    uniqueCornerLabels,
    selectedCornerMarkers,
    pieceMarkers,
    uniquePieceIds,
    markerCount: result ? result.markerCount : 0,
  };
}

function detectCustomMarkersReportFromFrame() {
  const result = detectCustomMarkersFromCapture();
  return buildMarkerDetectionReport(result);
}

function loadPentominoesFromDetectedMarkers(result) {
  if (result && Array.isArray(result.cornersOrdered) && result.cornersOrdered.length === 4) {
    cameraState.corners = result.cornersOrdered.map((point) => ({ x: point.x, y: point.y }));
    cameraState.boardProjection =
      (result && result.boardProjection && result.boardProjection.imageToBoard && result.boardProjection.boardToImage)
        ? result.boardProjection
        : buildBoardProjectionFromBoardCorners(cameraState.corners);
  } else {
    setFallbackCornersFromFrame();
  }

  if (cameraState.corners.length !== 4) {
    return 0;
  }

  gameState.selectedPieceId = null;
  gameState.activePieceId = null;
  gameState.rotation = 0;
  gameState.flipped = false;
  gameState.drag = null;
  gameState.importedMask = makeBoolGrid(false);
  gameState.placedPieces.clear();
  rebuildGameOccupancy();

  const pieceMarkers = (result && Array.isArray(result.pieces) ? result.pieces : []).sort(
    (a, b) => b.confidence - a.confidence,
  );
  if (pieceMarkers.length === 0) {
    return 0;
  }

  const occupancy = extractBoardOccupancyFromFrame(cameraState.frameImage, cameraState.corners, cameraState.boardProjection);
  const placementOptionsByPiece = new Map();

  for (const marker of pieceMarkers) {
    if (!PIECE_BY_ID.has(marker.pieceId)) {
      continue;
    }
    const baseMarkerCell = marker.markerCell
      ? { x: marker.markerCell.x, y: marker.markerCell.y }
      : pointToBoardCellRounded(marker.center, cameraState.corners, cameraState.boardProjection);
    if (!baseMarkerCell) {
      continue;
    }

    const options = buildPlacementCandidatesForMarker(marker, baseMarkerCell, occupancy.mask);
    if (options.length > 0) {
      placementOptionsByPiece.set(marker.pieceId, options);
    }
  }

  const assignments = solvePiecePlacements(placementOptionsByPiece);
  let loaded = 0;

  for (const [pieceId, option] of assignments) {
    const piece = PIECE_BY_ID.get(pieceId);
    if (!piece) {
      continue;
    }
    const placed = buildPlacedPiece(
      piece,
      option.rotation,
      option.flipped,
      option.relativeCells,
      option.anchorX,
      option.anchorY,
    );
    gameState.placedPieces.set(piece.id, placed);
    rebuildGameOccupancy();
    loaded += 1;
  }

  if (loaded === 0) {
    return 0;
  }

  clearGameAnalysis();
  updatePieceTrayState();
  runGameAreaDetection();
  const area = gameState.analysis ? gameState.analysis.totalArea : 0;
  setGameStatus(
    `Detected ${pieceMarkers.length} marker${pieceMarkers.length === 1 ? "" : "s"}, placed ${loaded} piece${
      loaded === 1 ? "" : "s"
    }. Area: ${area}.`,
  );
  return loaded;
}

function buildMarkerCorners(cornerHits, frameImage = null) {
  if (!Array.isArray(cornerHits) || cornerHits.length === 0) {
    return [];
  }

  const bySlots = selectMarkerCornersByImageSlots(cornerHits, frameImage);
  if (bySlots) {
    return orientMarkerCornersByLabels(bySlots, cornerHits);
  }

  const strongHits = cornerHits
    .filter((hit) => toNumberOrDefault(hit.confidence, 0) >= 0.7)
    .sort((a, b) => toNumberOrDefault(b.area, 0) - toNumberOrDefault(a.area, 0))
    .slice(0, 8);

  const byGeometry = selectBestCornerQuadFromCandidates(strongHits.length >= 4 ? strongHits : cornerHits);
  if (byGeometry) {
    return byGeometry;
  }

  return [];
}

function orientMarkerCornersByLabels(orderedCorners, cornerHits) {
  if (!Array.isArray(orderedCorners) || orderedCorners.length !== 4) {
    return orderedCorners;
  }
  if (!Array.isArray(cornerHits) || cornerHits.length === 0) {
    return orderedCorners;
  }

  const canonicalLabels = ["tl", "tr", "br", "bl"];
  let best = null;
  let secondBest = null;

  for (let rotation = 0; rotation < 4; rotation += 1) {
    const rotated = orderedCorners.map((_, index) => orderedCorners[(index + rotation) % 4]);
    let score = 0;
    const matchedLabels = new Set();
    let strongMatches = 0;
    for (let i = 0; i < 4; i += 1) {
      const corner = rotated[i];
      let nearest = null;
      let bestDistance = Infinity;
      for (const hit of cornerHits) {
        if (!hit || !hit.center) {
          continue;
        }
        const distance = distanceBetweenPoints(corner, hit.center);
        if (distance < bestDistance) {
          bestDistance = distance;
          nearest = hit;
        }
      }
      if (!nearest) {
        continue;
      }
      const confidence = toNumberOrDefault(nearest.confidence, 0);
      const label = String(nearest.label || "");
      if (label === canonicalLabels[i]) {
        score += 1.4 * confidence;
        if (confidence >= 0.8) {
          strongMatches += 1;
        }
      } else if (label === "tl" || label === "tr" || label === "br" || label === "bl") {
        score -= 0.5 * confidence;
      }
      if (label === "tl" || label === "tr" || label === "br" || label === "bl") {
        matchedLabels.add(label);
      }
    }

    const candidate = {
      score,
      corners: rotated,
      uniqueLabelCount: matchedLabels.size,
      strongMatches,
    };
    if (!best || candidate.score > best.score) {
      secondBest = best;
      best = candidate;
    } else if (!secondBest || candidate.score > secondBest.score) {
      secondBest = candidate;
    }
  }

  if (!best) {
    return orderedCorners;
  }

  const scoreGap = best.score - (secondBest ? secondBest.score : -Infinity);
  const labelsAreReliable = best.uniqueLabelCount === 4 && best.strongMatches >= 3;
  const orientationIsDecisive = Number.isFinite(scoreGap) && scoreGap > 0.75;
  if (!labelsAreReliable || !orientationIsDecisive) {
    return orderedCorners;
  }

  return best.corners;
}

function selectMarkerCornersByImageSlots(cornerHits, frameImage = null) {
  if (!Array.isArray(cornerHits) || cornerHits.length < 4) {
    return null;
  }

  const frameWidth =
    frameImage && Number.isFinite(frameImage.width) && frameImage.width > 0
      ? frameImage.width
      : Math.max(1, ...cornerHits.map((hit) => toNumberOrDefault(hit.center ? hit.center.x : 0, 0)));
  const frameHeight =
    frameImage && Number.isFinite(frameImage.height) && frameImage.height > 0
      ? frameImage.height
      : Math.max(1, ...cornerHits.map((hit) => toNumberOrDefault(hit.center ? hit.center.y : 0, 0)));

  const candidates = cornerHits
    .filter((hit) => hit && hit.center)
    .slice()
    .sort((a, b) => {
      const scoreA = toNumberOrDefault(a.confidence, 0) * 3 + Math.log(Math.max(1, toNumberOrDefault(a.area, 0)));
      const scoreB = toNumberOrDefault(b.confidence, 0) * 3 + Math.log(Math.max(1, toNumberOrDefault(b.area, 0)));
      return scoreB - scoreA;
    })
    .slice(0, 12);
  if (candidates.length < 4) {
    return null;
  }

  const slots = [
    { tx: 0, ty: 0 },
    { tx: 1, ty: 0 },
    { tx: 1, ty: 1 },
    { tx: 0, ty: 1 },
  ];
  const used = new Set();
  const chosen = [];

  for (const slot of slots) {
    let bestIndex = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < candidates.length; i += 1) {
      if (used.has(i)) {
        continue;
      }
      const hit = candidates[i];
      const nx = clamp(hit.center.x / frameWidth, 0, 1);
      const ny = clamp(hit.center.y / frameHeight, 0, 1);
      const dist = Math.hypot(nx - slot.tx, ny - slot.ty);
      const confidence = toNumberOrDefault(hit.confidence, 0);
      const areaTerm = Math.log(Math.max(1, toNumberOrDefault(hit.area, 0))) * 0.18;
      const edgePenalty = toNumberOrDefault(hit.distance, 0) * 0.02;
      const score = 2.4 * confidence + areaTerm - 2.2 * dist - edgePenalty;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    if (bestIndex < 0) {
      return null;
    }
    used.add(bestIndex);
    chosen.push(candidates[bestIndex].center);
  }

  return chosen;
}

function selectBestCornerQuadFromCandidates(cornerHits) {
  if (!Array.isArray(cornerHits) || cornerHits.length < 4) {
    return null;
  }

  const usable = cornerHits.filter((hit) => {
    const width = toNumberOrDefault(hit.width, 0);
    const height = toNumberOrDefault(hit.height, 0);
    if (width < 28 || height < 28) {
      return false;
    }
    const aspect = width / Math.max(1, height);
    if (aspect < 0.58 || aspect > 1.7) {
      return false;
    }
    return true;
  });
  if (usable.length < 4) {
    return null;
  }

  const maxArea = Math.max(...usable.map((hit) => toNumberOrDefault(hit.area, 0)));
  const tryThresholds = [0.55, 0.42, 0.3, 0.2];

  let candidatePool = null;
  for (const ratio of tryThresholds) {
    const threshold = maxArea * ratio;
    const pool = usable
      .filter((hit) => toNumberOrDefault(hit.area, 0) >= threshold)
      .sort((a, b) => {
        const scoreA = toNumberOrDefault(a.confidence, 0) * 2 + toNumberOrDefault(a.area, 0) / Math.max(1, maxArea);
        const scoreB = toNumberOrDefault(b.confidence, 0) * 2 + toNumberOrDefault(b.area, 0) / Math.max(1, maxArea);
        return scoreB - scoreA;
      })
      .slice(0, 10);
    if (pool.length >= 4) {
      candidatePool = pool;
      break;
    }
  }

  if (!candidatePool || candidatePool.length < 4) {
    return null;
  }

  let best = null;
  const count = candidatePool.length;
  for (let i = 0; i < count - 3; i += 1) {
    for (let j = i + 1; j < count - 2; j += 1) {
      for (let k = j + 1; k < count - 1; k += 1) {
        for (let l = k + 1; l < count; l += 1) {
          const combo = [candidatePool[i], candidatePool[j], candidatePool[k], candidatePool[l]];
          const evaluation = evaluateCornerCombo(combo, maxArea);
          if (!evaluation) {
            continue;
          }
          if (!best || evaluation.score > best.score) {
            best = evaluation;
          }
        }
      }
    }
  }

  return best ? best.corners : null;
}

function evaluateCornerCombo(combo, maxArea) {
  const points = combo.map((hit) => hit.center);
  const inferred = inferCornersFromPoints(points);
  if (!inferred) {
    return null;
  }
  const [tl, tr, br, bl] = inferred;

  const top = distanceBetweenPoints(tl, tr);
  const bottom = distanceBetweenPoints(bl, br);
  const left = distanceBetweenPoints(tl, bl);
  const right = distanceBetweenPoints(tr, br);
  if (Math.min(top, bottom, left, right) < 120) {
    return null;
  }

  const angleTop = lineAngle(tl, tr);
  const angleBottom = lineAngle(bl, br);
  const angleLeft = lineAngle(tl, bl);
  const angleRight = lineAngle(tr, br);
  const parallelError = angleDifference(angleTop, angleBottom) + angleDifference(angleLeft, angleRight);
  const ratioError = Math.abs(top - bottom) / Math.max(top, bottom) + Math.abs(left - right) / Math.max(left, right);
  const yPairError =
    Math.abs(tl.y - tr.y) / Math.max(1, (left + right) * 0.5) +
    Math.abs(bl.y - br.y) / Math.max(1, (left + right) * 0.5);
  const xPairError =
    Math.abs(tl.x - bl.x) / Math.max(1, (top + bottom) * 0.5) +
    Math.abs(tr.x - br.x) / Math.max(1, (top + bottom) * 0.5);

  const confidenceSum = combo.reduce((sum, hit) => sum + toNumberOrDefault(hit.confidence, 0), 0);
  const areaSum = combo.reduce((sum, hit) => sum + toNumberOrDefault(hit.area, 0), 0);
  const normalizedArea = areaSum / Math.max(1, maxArea);

  const score =
    3.1 * confidenceSum +
    0.09 * normalizedArea -
    40 * parallelError -
    25 * ratioError -
    35 * yPairError -
    20 * xPairError;

  return {
    score,
    corners: [tl, tr, br, bl],
  };
}

function distanceBetweenPoints(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function lineAngle(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function angleDifference(a, b) {
  const tau = Math.PI * 2;
  let d = Math.abs(a - b) % tau;
  if (d > Math.PI) {
    d = tau - d;
  }
  return d;
}

function markerCornersToBoardCorners(markerCorners, frameImage = null, estimatedCellSizePx = null) {
  if (!Array.isArray(markerCorners) || markerCorners.length !== 4) {
    return [];
  }
  const fitted =
    USE_DYNAMIC_BOARD_FIT && frameImage
      ? estimateBoardMarginsFromImage(frameImage, markerCorners, estimatedCellSizePx)
      : null;
  const uMin = fitted ? fitted.uMin : MARKER_TO_BOARD_U_MIN;
  const uMax = fitted ? fitted.uMax : MARKER_TO_BOARD_U_MAX;
  const vMin = fitted ? fitted.vMin : MARKER_TO_BOARD_V_MIN;
  const vMax = fitted ? fitted.vMax : MARKER_TO_BOARD_V_MAX;
  const initial = projectBoardCornersFromMarkerFrame(markerCorners, uMin, uMax, vMin, vMax);
  if (initial.length !== 4) {
    return [];
  }

  if (!USE_GRID_LINE_REFINEMENT || !frameImage) {
    return initial;
  }

  const refined = refineBoardCornersByGridLines(frameImage, initial);
  return selectRefinedBoardCorners(initial, refined);
}

function projectBoardCornersFromMarkerFrame(markerCorners, uMin, uMax, vMin, vMax) {
  const markerProjection = buildMarkerSquareProjection(markerCorners);
  if (!markerProjection || !markerProjection.markerToImage) {
    return [];
  }

  const points = [
    applyHomography(markerProjection.markerToImage, uMin, vMin),
    applyHomography(markerProjection.markerToImage, uMax, vMin),
    applyHomography(markerProjection.markerToImage, uMax, vMax),
    applyHomography(markerProjection.markerToImage, uMin, vMax),
  ];
  if (points.some((point) => !point)) {
    return [];
  }
  return points;
}

function buildMarkerSquareProjection(markerCorners) {
  if (!Array.isArray(markerCorners) || markerCorners.length !== 4) {
    return null;
  }
  const markerSquare = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const markerToImage = computeHomography(markerSquare, markerCorners);
  const imageToMarker = computeHomography(markerCorners, markerSquare);
  if (!markerToImage || !imageToMarker) {
    return null;
  }
  return {
    markerToImage,
    imageToMarker,
  };
}

function buildBoardProjectionFromMarkerCorners(markerCorners, frameImage = null, estimatedCellSizePx = null) {
  if (!Array.isArray(markerCorners) || markerCorners.length !== 4) {
    return null;
  }

  const fitted =
    USE_DYNAMIC_BOARD_FIT && frameImage
      ? estimateBoardMarginsFromImage(frameImage, markerCorners, estimatedCellSizePx)
      : null;
  const uMin = fitted ? fitted.uMin : MARKER_TO_BOARD_U_MIN;
  const uMax = fitted ? fitted.uMax : MARKER_TO_BOARD_U_MAX;
  const vMin = fitted ? fitted.vMin : MARKER_TO_BOARD_V_MIN;
  const vMax = fitted ? fitted.vMax : MARKER_TO_BOARD_V_MAX;

  const boardCorners = projectBoardCornersFromMarkerFrame(
    markerCorners,
    uMin,
    uMax,
    vMin,
    vMax,
  );
  if (boardCorners.length !== 4) {
    return null;
  }

  const cornersForProjection =
    USE_GRID_LINE_REFINEMENT && frameImage
      ? selectRefinedBoardCorners(boardCorners, refineBoardCornersByGridLines(frameImage, boardCorners))
      : boardCorners;

  const boardProjection = buildBoardProjectionFromBoardCorners(cornersForProjection);
  if (!boardProjection) {
    return null;
  }
  return {
    ...boardProjection,
    markerCorners: markerCorners.map((point) => ({ x: point.x, y: point.y })),
  };
}

function buildBoardProjectionFromBoardCorners(boardCorners) {
  if (!Array.isArray(boardCorners) || boardCorners.length !== 4) {
    return null;
  }

  const boardSquare = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];

  const boardToImage = computeHomography(boardSquare, boardCorners);
  const imageToBoard = computeHomography(boardCorners, boardSquare);
  if (!boardToImage || !imageToBoard) {
    return null;
  }

  return {
    boardCorners: boardCorners.map((point) => ({ x: point.x, y: point.y })),
    boardToImage,
    imageToBoard,
  };
}

function computeHomography(srcPoints, dstPoints) {
  if (!Array.isArray(srcPoints) || !Array.isArray(dstPoints) || srcPoints.length !== 4 || dstPoints.length !== 4) {
    return null;
  }

  const A = [];
  const b = [];
  for (let i = 0; i < 4; i += 1) {
    const s = srcPoints[i];
    const d = dstPoints[i];
    if (!s || !d) {
      return null;
    }
    const x = Number(s.x);
    const y = Number(s.y);
    const u = Number(d.x);
    const v = Number(d.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(u) || !Number.isFinite(v)) {
      return null;
    }

    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  const solution = solveLinearSystem(A, b);
  if (!solution || solution.length !== 8 || solution.some((value) => !Number.isFinite(value))) {
    return null;
  }

  return {
    h11: solution[0],
    h12: solution[1],
    h13: solution[2],
    h21: solution[3],
    h22: solution[4],
    h23: solution[5],
    h31: solution[6],
    h32: solution[7],
    h33: 1,
  };
}

function solveLinearSystem(matrix, values) {
  const n = Array.isArray(matrix) ? matrix.length : 0;
  if (!n || !Array.isArray(values) || values.length !== n) {
    return null;
  }
  const m = Array.isArray(matrix[0]) ? matrix[0].length : 0;
  if (m !== n) {
    return null;
  }

  const a = matrix.map((row, index) => [...row, values[index]]);

  for (let col = 0; col < n; col += 1) {
    let pivotRow = col;
    let pivotAbs = Math.abs(a[col][col]);
    for (let row = col + 1; row < n; row += 1) {
      const value = Math.abs(a[row][col]);
      if (value > pivotAbs) {
        pivotAbs = value;
        pivotRow = row;
      }
    }

    if (pivotAbs < 1e-12) {
      return null;
    }

    if (pivotRow !== col) {
      const tmp = a[col];
      a[col] = a[pivotRow];
      a[pivotRow] = tmp;
    }

    const pivot = a[col][col];
    for (let j = col; j <= n; j += 1) {
      a[col][j] /= pivot;
    }

    for (let row = 0; row < n; row += 1) {
      if (row === col) {
        continue;
      }
      const factor = a[row][col];
      if (Math.abs(factor) < 1e-14) {
        continue;
      }
      for (let j = col; j <= n; j += 1) {
        a[row][j] -= factor * a[col][j];
      }
    }
  }

  return a.map((row) => row[n]);
}

function applyHomography(h, x, y) {
  if (!h) {
    return null;
  }
  const xx = Number(x);
  const yy = Number(y);
  if (!Number.isFinite(xx) || !Number.isFinite(yy)) {
    return null;
  }

  const w = h.h31 * xx + h.h32 * yy + h.h33;
  if (!Number.isFinite(w) || Math.abs(w) < 1e-12) {
    return null;
  }

  return {
    x: (h.h11 * xx + h.h12 * yy + h.h13) / w,
    y: (h.h21 * xx + h.h22 * yy + h.h23) / w,
  };
}

function refineBoardCornersByGridLines(frameImage, approxCorners) {
  if (!frameImage || !Array.isArray(approxCorners) || approxCorners.length !== 4) {
    return null;
  }

  const sampleSize = 520;
  const rectified = new Array(sampleSize);
  for (let y = 0; y < sampleSize; y += 1) {
    const row = new Array(sampleSize);
    const v = (y + 0.5) / sampleSize;
    for (let x = 0; x < sampleSize; x += 1) {
      const u = (x + 0.5) / sampleSize;
      const point = bilinearPoint(approxCorners, u, v);
      row[x] = sampleLuminance(frameImage, point.x, point.y);
    }
    rectified[y] = row;
  }

  const colDark = new Array(sampleSize).fill(0);
  const rowDark = new Array(sampleSize).fill(0);
  for (let y = 0; y < sampleSize; y += 1) {
    for (let x = 0; x < sampleSize; x += 1) {
      const dark = 255 - rectified[y][x];
      colDark[x] += dark;
      rowDark[y] += dark;
    }
  }
  for (let i = 0; i < sampleSize; i += 1) {
    colDark[i] /= sampleSize;
    rowDark[i] /= sampleSize;
  }

  const vertical = findAxisByGridLattice(colDark, sampleSize);
  const horizontal = findAxisByGridLattice(rowDark, sampleSize);
  if (!vertical || !horizontal) {
    return null;
  }

  const uMin = clamp(vertical.min / sampleSize, 0, 1);
  const uMax = clamp(vertical.max / sampleSize, 0, 1);
  const vMin = clamp(horizontal.min / sampleSize, 0, 1);
  const vMax = clamp(horizontal.max / sampleSize, 0, 1);
  if (uMax - uMin < 0.5 || vMax - vMin < 0.5) {
    return null;
  }

  return [
    bilinearPoint(approxCorners, uMin, vMin),
    bilinearPoint(approxCorners, uMax, vMin),
    bilinearPoint(approxCorners, uMax, vMax),
    bilinearPoint(approxCorners, uMin, vMax),
  ];
}

function selectRefinedBoardCorners(initialCorners, refinedCorners) {
  if (!Array.isArray(initialCorners) || initialCorners.length !== 4) {
    return refinedCorners || initialCorners;
  }
  if (!Array.isArray(refinedCorners) || refinedCorners.length !== 4) {
    return initialCorners;
  }

  const initialArea = Math.abs(quadrilateralArea(initialCorners));
  const refinedArea = Math.abs(quadrilateralArea(refinedCorners));
  if (!Number.isFinite(initialArea) || !Number.isFinite(refinedArea) || initialArea < 1 || refinedArea < 1) {
    return initialCorners;
  }
  const areaRatio = refinedArea / initialArea;
  if (areaRatio < 0.92 || areaRatio > 1.08) {
    return initialCorners;
  }

  const avgEdge =
    (distanceBetweenPoints(initialCorners[0], initialCorners[1]) +
      distanceBetweenPoints(initialCorners[1], initialCorners[2]) +
      distanceBetweenPoints(initialCorners[2], initialCorners[3]) +
      distanceBetweenPoints(initialCorners[3], initialCorners[0])) /
    4;
  const maxAllowedShift = avgEdge * 0.085;
  for (let i = 0; i < 4; i += 1) {
    if (distanceBetweenPoints(initialCorners[i], refinedCorners[i]) > maxAllowedShift) {
      return initialCorners;
    }
  }

  return refinedCorners;
}

function quadrilateralArea(corners) {
  if (!Array.isArray(corners) || corners.length !== 4) {
    return 0;
  }
  let area2 = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    area2 += a.x * b.y - b.x * a.y;
  }
  return 0.5 * area2;
}

function findAxisByGridLattice(profile, sampleSize) {
  if (!Array.isArray(profile) || profile.length < 80) {
    return null;
  }
  const smoothed = smooth1D(profile, 2);
  const mean = smoothed.reduce((sum, value) => sum + value, 0) / smoothed.length;
  const variance = smoothed.reduce((sum, value) => sum + (value - mean) ** 2, 0) / smoothed.length;
  const std = Math.sqrt(Math.max(variance, 0));
  const threshold = mean + std * 0.2;

  const peaks = [];
  for (let i = 2; i < smoothed.length - 2; i += 1) {
    if (smoothed[i] >= threshold && smoothed[i] > smoothed[i - 1] && smoothed[i] >= smoothed[i + 1]) {
      peaks.push(i);
    }
  }
  if (peaks.length < 8) {
    return null;
  }

  const minStep = sampleSize / 24;
  const maxStep = sampleSize / 16;
  let best = null;
  for (let i = 0; i < peaks.length - 1; i += 1) {
    for (let j = i + 1; j < peaks.length; j += 1) {
      const min = peaks[i];
      const max = peaks[j];
      const step = (max - min) / 20;
      if (step < minStep || step > maxStep) {
        continue;
      }

      let spanInside = true;
      let lineScore = 0;
      let gapScore = 0;
      for (let k = 0; k <= 20; k += 1) {
        const p = min + k * step;
        if (p < 1 || p > smoothed.length - 2) {
          spanInside = false;
          break;
        }
        lineScore += sample1D(smoothed, p);
      }
      if (!spanInside) {
        continue;
      }
      for (let k = 0; k < 20; k += 1) {
        gapScore += sample1D(smoothed, min + (k + 0.5) * step);
      }
      const edgeBoost = 0.22 * (sample1D(smoothed, min) + sample1D(smoothed, max));
      const score = lineScore / 21 - gapScore / 20 + edgeBoost;
      if (!best || score > best.score) {
        best = { score, min, max };
      }
    }
  }

  return best;
}

function smooth1D(values, radius) {
  const out = new Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    let sum = 0;
    let count = 0;
    for (let d = -radius; d <= radius; d += 1) {
      const j = i + d;
      if (j < 0 || j >= values.length) {
        continue;
      }
      sum += values[j];
      count += 1;
    }
    out[i] = sum / Math.max(1, count);
  }
  return out;
}

function sample1D(values, index) {
  const i0 = clamp(Math.floor(index), 0, values.length - 1);
  const i1 = clamp(i0 + 1, 0, values.length - 1);
  const t = clamp(index - i0, 0, 1);
  return values[i0] * (1 - t) + values[i1] * t;
}

function estimateBoardMarginsFromImage(frameImage, markerCorners, estimatedCellSizePx = null) {
  if (!frameImage || !Array.isArray(markerCorners) || markerCorners.length !== 4) {
    return null;
  }

  const uMarginCandidates = [];
  for (let margin = 0.07; margin <= 0.17 + 1e-6; margin += 0.01) {
    uMarginCandidates.push(Number(margin.toFixed(3)));
  }
  const vMarginCandidates = [];
  for (let margin = 0.07; margin <= 0.18 + 1e-6; margin += 0.01) {
    vMarginCandidates.push(Number(margin.toFixed(3)));
  }

  let best = null;
  for (const uMargin of uMarginCandidates) {
    const uMin = uMargin;
    const uMax = 1 - uMargin;
    if (uMax - uMin < 0.62 || uMax - uMin > 0.84) {
      continue;
    }

    for (const vTop of vMarginCandidates) {
      for (const vBottom of vMarginCandidates) {
        const vMin = vTop;
        const vMax = 1 - vBottom;
        if (vMax - vMin < 0.62 || vMax - vMin > 0.84) {
          continue;
        }

        const score = scoreBoardRectFromImage(
          frameImage,
          markerCorners,
          uMin,
          uMax,
          vMin,
          vMax,
          estimatedCellSizePx,
        );
        if (!best || score > best.score) {
          best = { score, uMin, uMax, vMin, vMax };
        }
      }
    }
  }

  return best;
}

function scoreBoardRectFromImage(frameImage, markerCorners, uMin, uMax, vMin, vMax, estimatedCellSizePx = null) {
  const markerProjection = buildMarkerSquareProjection(markerCorners);
  if (!markerProjection || !markerProjection.markerToImage) {
    return -Infinity;
  }

  let edge = 0;
  let inner = 0;
  let outer = 0;
  let count = 0;
  const insideDelta = 0.014;
  const outsideDelta = 0.014;

  for (let i = 0; i < BOARD_SIZE; i += 1) {
    const t = (i + 0.5) / BOARD_SIZE;

    const uTop = lerp(uMin, uMax, t);
    edge += sampleLuminanceAtMarkerUV(frameImage, markerProjection, uTop, vMin);
    inner += sampleLuminanceAtMarkerUV(frameImage, markerProjection, uTop, clamp(vMin + insideDelta, 0, 1));
    outer += sampleLuminanceAtMarkerUV(frameImage, markerProjection, uTop, clamp(vMin - outsideDelta, 0, 1));
    count += 1;

    const uBottom = lerp(uMin, uMax, t);
    edge += sampleLuminanceAtMarkerUV(frameImage, markerProjection, uBottom, vMax);
    inner += sampleLuminanceAtMarkerUV(frameImage, markerProjection, uBottom, clamp(vMax - insideDelta, 0, 1));
    outer += sampleLuminanceAtMarkerUV(frameImage, markerProjection, uBottom, clamp(vMax + outsideDelta, 0, 1));
    count += 1;

    const vLeft = lerp(vMin, vMax, t);
    edge += sampleLuminanceAtMarkerUV(frameImage, markerProjection, uMin, vLeft);
    inner += sampleLuminanceAtMarkerUV(frameImage, markerProjection, clamp(uMin + insideDelta, 0, 1), vLeft);
    outer += sampleLuminanceAtMarkerUV(frameImage, markerProjection, clamp(uMin - outsideDelta, 0, 1), vLeft);
    count += 1;

    const vRight = lerp(vMin, vMax, t);
    edge += sampleLuminanceAtMarkerUV(frameImage, markerProjection, uMax, vRight);
    inner += sampleLuminanceAtMarkerUV(frameImage, markerProjection, clamp(uMax - insideDelta, 0, 1), vRight);
    outer += sampleLuminanceAtMarkerUV(frameImage, markerProjection, clamp(uMax + outsideDelta, 0, 1), vRight);
    count += 1;
  }

  const edgeMean = edge / Math.max(1, count);
  const innerMean = inner / Math.max(1, count);
  const outerMean = outer / Math.max(1, count);
  const contrastScore = (innerMean - edgeMean) + (outerMean - edgeMean);
  const symmetryPenalty = Math.abs((uMin + uMax) - 1) * 8 + Math.abs((vMin + vMax) - 1) * 3;

  let markerScalePenalty = 0;
  if (Number.isFinite(estimatedCellSizePx) && estimatedCellSizePx > 1) {
    const tl = applyHomography(markerProjection.markerToImage, uMin, vMin);
    const tr = applyHomography(markerProjection.markerToImage, uMax, vMin);
    const br = applyHomography(markerProjection.markerToImage, uMax, vMax);
    const bl = applyHomography(markerProjection.markerToImage, uMin, vMax);
    if (!tl || !tr || !br || !bl) {
      return contrastScore - symmetryPenalty;
    }
    const avgEdgePx =
      (distanceBetweenPoints(tl, tr) +
        distanceBetweenPoints(tr, br) +
        distanceBetweenPoints(br, bl) +
        distanceBetweenPoints(bl, tl)) /
      4;
    const estimatedCellFromBoard = avgEdgePx / BOARD_SIZE;
    const relativeError = Math.abs(estimatedCellFromBoard - estimatedCellSizePx) / estimatedCellSizePx;
    markerScalePenalty = relativeError * 9;
  }

  return contrastScore - symmetryPenalty - markerScalePenalty;
}

function sampleLuminanceAtMarkerUV(frameImage, markerProjection, u, v) {
  const p = applyHomography(markerProjection.markerToImage, u, v);
  if (!p) {
    return 255;
  }
  return sampleLuminance(frameImage, p.x, p.y);
}

function isBetterPieceMarkerCandidate(current, candidate) {
  if (!candidate) {
    return false;
  }
  if (!current) {
    return true;
  }

  const currentHasCell = Boolean(current.markerCell);
  const candidateHasCell = Boolean(candidate.markerCell);
  if (candidateHasCell && !currentHasCell && candidate.confidence >= current.confidence - 0.08) {
    return true;
  }
  if (candidate.confidence > current.confidence + 0.02) {
    return true;
  }
  if (candidate.distance + 1 < current.distance) {
    return true;
  }
  const candidateSource = String(candidate.source || "");
  const currentSource = String(current.source || "");
  if (candidateSource === "grid" && currentSource === "component") {
    return (
      candidate.confidence > current.confidence + 0.15 &&
      candidate.distance + 2 < current.distance &&
      Boolean(candidate.markerCell)
    );
  }
  if (candidateSource === "grid" && currentSource !== "grid" && candidate.confidence >= current.confidence + 0.05) {
    return true;
  }
  return false;
}

function matchMarkerInComponent(imageData, component, lookup, gridSize, samplingConfigs, maxErrorRatio) {
  let best = null;
  for (const config of samplingConfigs) {
    const signature = sampleMarkerSignatureFromBounds(
      imageData,
      component,
      gridSize,
      config.threshold,
      config.margin,
    );
    const match = matchMarkerSignature(signature, lookup, gridSize, maxErrorRatio);
    if (!match) {
      continue;
    }
    if (!best || match.distance < best.distance || match.confidence > best.confidence) {
      best = match;
    }
  }
  return best;
}

function detectPieceMarkersFromBoardGrid(frameImage, corners, boardProjection = null) {
  if (!frameImage || !Array.isArray(corners) || corners.length !== 4) {
    return [];
  }

  const matches = [];
  const samplingConfigs = [
    { margin: 0.06, thresholdBias: 0, maxErrorRatio: 0.28 },
    { margin: 0.08, thresholdBias: -8, maxErrorRatio: 0.3 },
    { margin: 0.1, thresholdBias: 8, maxErrorRatio: 0.32 },
  ];

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      let best = null;
      for (const config of samplingConfigs) {
        const sample = sampleMarkerSignatureFromBoardCell(
          frameImage,
          corners,
          x,
          y,
          6,
          config.margin,
          config.thresholdBias,
          boardProjection,
        );
        if (!sample || sample.contrast < 18 || sample.darkRatio < 0.44 || sample.darkRatio > 0.95) {
          continue;
        }

        const ranked = matchMarkerSignatureCandidates(sample.signature, PIECE_MARKER_LOOKUP, 6, config.maxErrorRatio);
        if (ranked.length === 0) {
          continue;
        }
        const primary = ranked[0];
        const secondOtherPiece =
          ranked.find((candidate) => candidate.entry.pieceId !== primary.entry.pieceId) || ranked[1] || null;
        const margin = secondOtherPiece ? secondOtherPiece.distance - primary.distance : 999;

        const quality = primary.confidence + sample.contrast / 400 + margin * 0.02;
        if (!best || quality > best.quality || primary.distance < best.distance) {
          best = {
            ...primary,
            quality,
            contrast: sample.contrast,
            margin,
          };
        }
      }

      if (!best || best.confidence < 0.64 || best.distance > 11) {
        continue;
      }

      const center = boardUvToImagePoint(corners, (x + 0.5) / BOARD_SIZE, (y + 0.5) / BOARD_SIZE, boardProjection);
      matches.push({
        pieceId: best.entry.pieceId,
        center,
        confidence: clamp(best.confidence + best.contrast / 600, 0, 1),
        distance: best.distance,
        margin: best.margin,
        markerEntry: best.entry,
        markerRotation: best.rotation,
        markerCell: { x, y },
        source: "grid",
      });
    }
  }

  return matches;
}

function sampleMarkerSignatureFromBoardCell(
  frameImage,
  corners,
  cellX,
  cellY,
  gridSize,
  marginRatio,
  thresholdBias = 0,
  boardProjection = null,
) {
  const values = [];
  const matrix = [];
  const innerSize = 1 - marginRatio * 2;

  for (let gy = 0; gy < gridSize; gy += 1) {
    const row = [];
    for (let gx = 0; gx < gridSize; gx += 1) {
      let lumaSum = 0;
      let count = 0;
      for (const sy of [0.3, 0.7]) {
        for (const sx of [0.3, 0.7]) {
          const uu = (cellX + marginRatio + ((gx + sx) / gridSize) * innerSize) / BOARD_SIZE;
          const vv = (cellY + marginRatio + ((gy + sy) / gridSize) * innerSize) / BOARD_SIZE;
          const point = boardUvToImagePoint(corners, uu, vv, boardProjection);
          lumaSum += sampleLuminance(frameImage, point.x, point.y);
          count += 1;
        }
      }
      const average = lumaSum / Math.max(1, count);
      row.push(average);
      values.push(average);
    }
    matrix.push(row);
  }

  if (values.length === 0) {
    return null;
  }

  const threshold = clamp(computeOtsuThreshold(values) + thresholdBias, 50, 220);
  const rows = [];
  let darkCount = 0;
  let min = 255;
  let max = 0;

  for (let gy = 0; gy < gridSize; gy += 1) {
    let bits = "";
    for (let gx = 0; gx < gridSize; gx += 1) {
      const luma = matrix[gy][gx];
      if (luma < min) {
        min = luma;
      }
      if (luma > max) {
        max = luma;
      }
      const dark = luma < threshold;
      if (dark) {
        darkCount += 1;
      }
      bits += dark ? "1" : "0";
    }
    rows.push(bits);
  }

  return {
    signature: rows.join("/"),
    darkRatio: darkCount / (gridSize * gridSize),
    contrast: max - min,
  };
}

function extractBoardOccupancyFromFrame(frameImage, corners, boardProjection = null) {
  const lumaGrid = makeNumberGrid(255);
  const samples = [];

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      let lumaSum = 0;
      let count = 0;
      for (const sy of [0.42, 0.5, 0.58]) {
        for (const sx of [0.42, 0.5, 0.58]) {
          const u = (x + sx) / BOARD_SIZE;
          const v = (y + sy) / BOARD_SIZE;
          const point = boardUvToImagePoint(corners, u, v, boardProjection);
          lumaSum += sampleLuminance(frameImage, point.x, point.y);
          count += 1;
        }
      }
      const average = lumaSum / Math.max(1, count);
      lumaGrid[y][x] = average;
      samples.push(average);
    }
  }

  const threshold = computeOtsuThreshold(samples);
  const mask = makeBoolGrid(false);
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      mask[y][x] = lumaGrid[y][x] < threshold;
    }
  }

  return { mask, threshold, lumaGrid };
}

function computeOtsuThreshold(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 150;
  }

  const histogram = new Array(256).fill(0);
  for (const value of values) {
    const bucket = clamp(Math.round(value), 0, 255);
    histogram[bucket] += 1;
  }

  const total = values.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i += 1) {
    sumAll += i * histogram[i];
  }

  let sumBackground = 0;
  let weightBackground = 0;
  let bestThreshold = 150;
  let maxBetween = -1;
  for (let t = 0; t < 256; t += 1) {
    weightBackground += histogram[t];
    if (weightBackground === 0) {
      continue;
    }
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) {
      break;
    }
    sumBackground += t * histogram[t];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sumAll - sumBackground) / weightForeground;
    const between = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (between > maxBetween) {
      maxBetween = between;
      bestThreshold = t;
    }
  }
  return clamp(bestThreshold, 70, 220);
}

function buildPlacementCandidatesForMarker(marker, baseMarkerCell, occupancyMask) {
  const candidateByKey = new Map();
  const markerOffsetOptions = buildMarkerRelativeOffsetOptions(marker);

  const addCandidate = (absoluteCells, markerX, markerY, dx, dy, orientationPenalty = 0) => {
    if (absoluteCells.some((cell) => !isInsideBoard(cell.x, cell.y))) {
      return;
    }

    const pose = resolvePoseForAbsoluteCells(marker.pieceId, absoluteCells);
    if (!pose) {
      return;
    }

    let score = 0;
    for (const cell of absoluteCells) {
      score += occupancyMask[cell.y][cell.x] ? 1.05 : -0.55;
    }
    score += occupancyMask[markerY][markerX] ? 0.85 : -0.2;
    score -= 0.18 * (Math.abs(dx) + Math.abs(dy));
    score -= orientationPenalty;
    if (marker.markerCell && markerX === marker.markerCell.x && markerY === marker.markerCell.y) {
      score += 0.8;
    }
    if ((marker.source || "") === "grid") {
      score += 0.35;
    }
    score += marker.confidence * 0.55;
    score -= marker.distance * 0.03;

    const key = `${cellsKey(absoluteCells)}|${pose.rotation}|${pose.flipped}`;
    const candidate = {
      pieceId: marker.pieceId,
      score,
      markerCell: { x: markerX, y: markerY },
      rotation: pose.rotation,
      flipped: pose.flipped,
      relativeCells: pose.relativeCells,
      anchorX: pose.anchorX,
      anchorY: pose.anchorY,
      absoluteCells,
    };
    const current = candidateByKey.get(key);
    if (!current || candidate.score > current.score) {
      candidateByKey.set(key, candidate);
    }
  };

  for (const dx of [-1, 0, 1]) {
    for (const dy of [-1, 0, 1]) {
      const markerX = baseMarkerCell.x + dx;
      const markerY = baseMarkerCell.y + dy;
      if (!isInsideBoard(markerX, markerY)) {
        continue;
      }

      if (markerOffsetOptions.length > 0) {
        for (let i = 0; i < markerOffsetOptions.length; i += 1) {
          const offsets = markerOffsetOptions[i];
          const absoluteCells = offsets.map(([ox, oy]) => ({
            x: markerX + ox,
            y: markerY + oy,
          }));
          addCandidate(absoluteCells, markerX, markerY, dx, dy, i === 0 ? 0 : 0.12);
        }
      }
    }
  }

  if (candidateByKey.size === 0) {
    const pieceVariants = PIECE_VARIANTS_BY_ID.get(marker.pieceId) || [];
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        const markerX = baseMarkerCell.x + dx;
        const markerY = baseMarkerCell.y + dy;
        if (!isInsideBoard(markerX, markerY)) {
          continue;
        }
        for (const variant of pieceVariants) {
          for (const markerCell of variant.relativeCells) {
            const anchorX = markerX - markerCell.x;
            const anchorY = markerY - markerCell.y;
            const absoluteCells = variant.relativeCells.map((cell) => ({
              x: anchorX + cell.x,
              y: anchorY + cell.y,
            }));
            addCandidate(absoluteCells, markerX, markerY, dx, dy, 0.25);
          }
        }
      }
    }
  }

  return [...candidateByKey.values()].sort((a, b) => b.score - a.score).slice(0, 24);
}

function buildMarkerRelativeOffsetOptions(marker) {
  if (!marker || !marker.markerEntry || !Array.isArray(marker.markerEntry.rel)) {
    return [];
  }

  const rotation = mod4(marker.markerRotation || 0);
  const baseOffsets = marker.markerEntry.rel.map(([x, y]) => [x, y]);
  const options = [
    rotateMarkerOffsetsCounterClockwise(baseOffsets, rotation),
    rotateMarkerOffsetsClockwise(baseOffsets, rotation),
  ];

  const unique = new Map();
  for (const offsets of options) {
    const key = offsets
      .map(([x, y]) => `${x},${y}`)
      .sort()
      .join("|");
    if (!unique.has(key)) {
      unique.set(key, offsets);
    }
  }
  return [...unique.values()];
}

function rotateMarkerOffsetsClockwise(offsets, rotation) {
  let rotated = offsets.map(([x, y]) => [x, y]);
  for (let i = 0; i < mod4(rotation); i += 1) {
    rotated = rotated.map(([x, y]) => [-y, x]);
  }
  return rotated;
}

function rotateMarkerOffsetsCounterClockwise(offsets, rotation) {
  let rotated = offsets.map(([x, y]) => [x, y]);
  for (let i = 0; i < mod4(rotation); i += 1) {
    rotated = rotated.map(([x, y]) => [y, -x]);
  }
  return rotated;
}

function resolvePoseForAbsoluteCells(pieceId, absoluteCells) {
  if (!Array.isArray(absoluteCells) || absoluteCells.length === 0) {
    return null;
  }

  const minX = Math.min(...absoluteCells.map((cell) => cell.x));
  const minY = Math.min(...absoluteCells.map((cell) => cell.y));
  const normalized = absoluteCells.map((cell) => ({
    x: cell.x - minX,
    y: cell.y - minY,
  }));
  const normalizedKey = cellsKey(normalized);
  const variants = PIECE_VARIANTS_BY_ID.get(pieceId) || [];
  for (const variant of variants) {
    if (cellsKey(variant.relativeCells) === normalizedKey) {
      return {
        rotation: variant.rotation,
        flipped: variant.flipped,
        relativeCells: variant.relativeCells,
        anchorX: minX,
        anchorY: minY,
      };
    }
  }

  return {
    rotation: 0,
    flipped: false,
    relativeCells: normalized,
    anchorX: minX,
    anchorY: minY,
  };
}

function solvePiecePlacements(optionsByPiece) {
  const pieceIds = [...optionsByPiece.keys()];
  if (pieceIds.length === 0) {
    return new Map();
  }
  pieceIds.sort((a, b) => optionsByPiece.get(a).length - optionsByPiece.get(b).length);

  const bestOptionScore = pieceIds.map((pieceId) => {
    const options = optionsByPiece.get(pieceId) || [];
    return options.length > 0 ? Math.max(0, options[0].score) : 0;
  });
  const suffix = new Array(pieceIds.length + 1).fill(0);
  for (let i = pieceIds.length - 1; i >= 0; i -= 1) {
    suffix[i] = suffix[i + 1] + bestOptionScore[i];
  }

  let bestCount = 0;
  let bestScore = -Infinity;
  let bestAssignments = new Map();
  const occupied = new Set();
  const current = new Map();

  const cellKey = (cell) => `${cell.x},${cell.y}`;

  const dfs = (index, placedCount, placedScore) => {
    if (placedCount + (pieceIds.length - index) < bestCount) {
      return;
    }
    if (placedCount + (pieceIds.length - index) === bestCount && placedScore + suffix[index] < bestScore) {
      return;
    }

    if (index === pieceIds.length) {
      if (placedCount > bestCount || (placedCount === bestCount && placedScore > bestScore)) {
        bestCount = placedCount;
        bestScore = placedScore;
        bestAssignments = new Map(current);
      }
      return;
    }

    const pieceId = pieceIds[index];
    const options = optionsByPiece.get(pieceId) || [];

    for (const option of options) {
      let overlaps = false;
      for (const cell of option.absoluteCells) {
        if (occupied.has(cellKey(cell))) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) {
        continue;
      }

      for (const cell of option.absoluteCells) {
        occupied.add(cellKey(cell));
      }
      current.set(pieceId, option);
      dfs(index + 1, placedCount + 1, placedScore + option.score);
      current.delete(pieceId);
      for (const cell of option.absoluteCells) {
        occupied.delete(cellKey(cell));
      }
    }

    dfs(index + 1, placedCount, placedScore);
  };

  dfs(0, 0, 0);
  return bestAssignments;
}

function pointToBoardCellRounded(point, corners, boardProjection = null) {
  if (!point || !Array.isArray(corners) || corners.length !== 4) {
    return null;
  }
  const uv = imagePointToBoardUv(point, corners, boardProjection);
  if (!uv) {
    return null;
  }
  const x = clamp(Math.round(uv.u * BOARD_SIZE - 0.5), 0, BOARD_SIZE - 1);
  const y = clamp(Math.round(uv.v * BOARD_SIZE - 0.5), 0, BOARD_SIZE - 1);
  return { x, y };
}

function buildPieceVariants(piece) {
  const unique = new Map();
  for (const flipped of [false, true]) {
    for (let rotation = 0; rotation < 4; rotation += 1) {
      const relativeCells = getOrientedCells(piece.cells, rotation, flipped);
      const key = cellsKey(relativeCells);
      if (!unique.has(key)) {
        unique.set(key, {
          rotation,
          flipped,
          relativeCells,
        });
      }
    }
  }
  return [...unique.values()];
}

const PIECE_VARIANTS_BY_ID = new Map(PENTOMINOES.map((piece) => [piece.id, buildPieceVariants(piece)]));

function cellsKey(cells) {
  return cells
    .map((cell) => `${cell.x},${cell.y}`)
    .sort()
    .join("|");
}

function findDarkSquareComponents(imageData, threshold) {
  const { width, height, data } = imageData;
  const size = width * height;
  const mask = new Uint8Array(size);
  const visited = new Uint8Array(size);
  const components = [];
  const queueX = new Int32Array(size);
  const queueY = new Int32Array(size);

  for (let i = 0, p = 0; i < size; i += 1, p += 4) {
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    if (luma < threshold) {
      mask[i] = 1;
    }
  }

  const minArea = Math.max(90, Math.floor(size * 0.000015));
  const maxArea = Math.floor(size * 0.08);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (!mask[start] || visited[start]) {
        continue;
      }

      let head = 0;
      let tail = 0;
      queueX[tail] = x;
      queueY[tail] = y;
      tail += 1;
      visited[start] = 1;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;

      while (head < tail) {
        const cx = queueX[head];
        const cy = queueY[head];
        head += 1;
        area += 1;

        if (cx < minX) {
          minX = cx;
        }
        if (cx > maxX) {
          maxX = cx;
        }
        if (cy < minY) {
          minY = cy;
        }
        if (cy > maxY) {
          maxY = cy;
        }

        const left = cx - 1;
        const right = cx + 1;
        const up = cy - 1;
        const down = cy + 1;

        if (left >= 0) {
          const idx = cy * width + left;
          if (mask[idx] && !visited[idx]) {
            visited[idx] = 1;
            queueX[tail] = left;
            queueY[tail] = cy;
            tail += 1;
          }
        }
        if (right < width) {
          const idx = cy * width + right;
          if (mask[idx] && !visited[idx]) {
            visited[idx] = 1;
            queueX[tail] = right;
            queueY[tail] = cy;
            tail += 1;
          }
        }
        if (up >= 0) {
          const idx = up * width + cx;
          if (mask[idx] && !visited[idx]) {
            visited[idx] = 1;
            queueX[tail] = cx;
            queueY[tail] = up;
            tail += 1;
          }
        }
        if (down < height) {
          const idx = down * width + cx;
          if (mask[idx] && !visited[idx]) {
            visited[idx] = 1;
            queueX[tail] = cx;
            queueY[tail] = down;
            tail += 1;
          }
        }
      }

      if (area < minArea || area > maxArea) {
        continue;
      }

      const boxWidth = maxX - minX + 1;
      const boxHeight = maxY - minY + 1;
      if (boxWidth < 12 || boxHeight < 12) {
        continue;
      }

      const aspect = boxWidth / boxHeight;
      if (aspect < 0.55 || aspect > 1.45) {
        continue;
      }

      const fill = area / (boxWidth * boxHeight);
      if (fill < 0.38) {
        continue;
      }

      components.push({
        minX,
        minY,
        width: boxWidth,
        height: boxHeight,
        area,
      });
    }
  }

  return components;
}

function sampleMarkerSignatureFromBounds(imageData, bounds, gridSize, threshold, marginRatio = 0.06) {
  const { width, data } = imageData;
  const left = bounds.minX + bounds.width * marginRatio;
  const top = bounds.minY + bounds.height * marginRatio;
  const innerWidth = bounds.width * (1 - marginRatio * 2);
  const innerHeight = bounds.height * (1 - marginRatio * 2);
  const rows = [];

  for (let gy = 0; gy < gridSize; gy += 1) {
    let rowBits = "";
    for (let gx = 0; gx < gridSize; gx += 1) {
      const x0 = Math.floor(left + (gx * innerWidth) / gridSize);
      const x1 = Math.floor(left + ((gx + 1) * innerWidth) / gridSize);
      const y0 = Math.floor(top + (gy * innerHeight) / gridSize);
      const y1 = Math.floor(top + ((gy + 1) * innerHeight) / gridSize);

      let lumaSum = 0;
      let count = 0;
      const sx0 = Math.max(bounds.minX, x0);
      const sx1 = Math.min(bounds.minX + bounds.width - 1, x1);
      const sy0 = Math.max(bounds.minY, y0);
      const sy1 = Math.min(bounds.minY + bounds.height - 1, y1);
      for (let y = sy0; y <= sy1; y += 1) {
        for (let x = sx0; x <= sx1; x += 1) {
          const index = (y * width + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          lumaSum += 0.299 * r + 0.587 * g + 0.114 * b;
          count += 1;
        }
      }
      const average = lumaSum / Math.max(1, count);
      rowBits += average < threshold ? "1" : "0";
    }
    rows.push(rowBits);
  }

  return rows.join("/");
}

function matchMarkerSignatureCandidates(observed, lookup, gridSize, maxErrorRatio = null) {
  if (!observed) {
    return [];
  }

  const observedBits = signatureToBits(observed);
  if (!observedBits || observedBits.length !== gridSize * gridSize) {
    return [];
  }

  const candidates = [];
  for (const entry of lookup) {
    for (let rotation = 0; rotation < entry.rotated.length; rotation += 1) {
      const candidateBits = signatureToBits(entry.rotated[rotation]);
      if (!candidateBits || candidateBits.length !== observedBits.length) {
        continue;
      }
      const distance = hammingDistance(observedBits, candidateBits);
      candidates.push({
        entry,
        rotation,
        distance,
        confidence: 1 - distance / observedBits.length,
      });
    }
  }

  if (candidates.length === 0) {
    return [];
  }
  candidates.sort((a, b) => a.distance - b.distance || b.confidence - a.confidence);

  if (maxErrorRatio == null) {
    return candidates;
  }

  const maxDistance = Math.floor(observedBits.length * maxErrorRatio);
  return candidates.filter((candidate) => candidate.distance <= maxDistance);
}

function matchMarkerSignature(observed, lookup, gridSize, maxErrorRatio) {
  const candidates = matchMarkerSignatureCandidates(observed, lookup, gridSize, maxErrorRatio);
  if (candidates.length === 0) {
    return null;
  }
  return candidates[0];
}

function rotateRelativeOffsets(offsets, rotation) {
  return offsets.map(([rawX, rawY]) => {
    let x = rawX;
    let y = rawY;
    for (let i = 0; i < rotation; i += 1) {
      const nx = y;
      const ny = -x;
      x = nx;
      y = ny;
    }
    return [x, y];
  });
}

function buildSignatureRotations(signature, size) {
  const rotations = [];
  let matrix = signatureToMatrix(signature, size);
  if (!matrix) {
    return rotations;
  }

  for (let i = 0; i < 4; i += 1) {
    rotations.push(matrixToSignature(matrix));
    matrix = rotateMatrixClockwise(matrix);
  }
  return rotations;
}

function signatureToMatrix(signature, size) {
  const rows = String(signature).split("/");
  if (rows.length !== size) {
    return null;
  }
  const matrix = [];
  for (const row of rows) {
    if (row.length !== size) {
      return null;
    }
    matrix.push([...row]);
  }
  return matrix;
}

function matrixToSignature(matrix) {
  return matrix.map((row) => row.join("")).join("/");
}

function rotateMatrixClockwise(matrix) {
  const size = matrix.length;
  const next = Array.from({ length: size }, () => Array.from({ length: size }, () => "0"));
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      next[x][size - 1 - y] = matrix[y][x];
    }
  }
  return next;
}

function signatureToBits(signature) {
  return String(signature).replace(/\//g, "");
}

function hammingDistance(a, b) {
  if (a.length !== b.length) {
    return Number.POSITIVE_INFINITY;
  }
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      distance += 1;
    }
  }
  return distance;
}

function mod4(value) {
  const normalized = Number(value) % 4;
  return normalized < 0 ? normalized + 4 : normalized;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function robustMedian(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const sorted = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (sorted.length === 0) {
    return null;
  }
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function applyCameraMaskToGame(mask) {
  gameState.selectedPieceId = null;
  gameState.activePieceId = null;
  gameState.rotation = 0;
  gameState.flipped = false;
  gameState.drag = null;
  gameState.placedPieces.clear();
  gameState.importedMask = mask.map((row) => row.slice());
  rebuildGameOccupancy();
  clearGameAnalysis();
  runGameAreaDetection();
  updatePieceTrayState();
  renderGameBoard();

  let fenceCells = 0;
  for (const row of gameState.importedMask) {
    for (const filled of row) {
      if (filled) {
        fenceCells += 1;
      }
    }
  }
  const area = gameState.analysis ? gameState.analysis.totalArea : 0;
  setGameStatus(`Imported ${fenceCells} cells from camera. Enclosed area: ${area}.`);
}

function captureCurrentFrame() {
  const video = dom.cameraVideo;
  if (!video.videoWidth || !video.videoHeight) {
    setCameraStatus("No live camera frame available. Start camera first.");
    return;
  }

  dom.cameraCapture.width = video.videoWidth;
  dom.cameraCapture.height = video.videoHeight;
  captureCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
  cameraState.frameImage = captureCtx.getImageData(0, 0, video.videoWidth, video.videoHeight);
  cameraState.corners = [];
  cameraState.boardProjection = null;
  cameraState.qrCount = 0;
  cameraState.markerCount = 0;
  renderCaptureCanvas();
  setCameraStatus("Frame captured. Running board detection.");
}

function loadFrameFromFile(file) {
  const reader = new FileReader();

  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      dom.cameraCapture.width = width;
      dom.cameraCapture.height = height;
      captureCtx.drawImage(image, 0, 0, width, height);
      cameraState.frameImage = captureCtx.getImageData(0, 0, width, height);
      cameraState.corners = [];
      cameraState.boardProjection = null;
      cameraState.qrCount = 0;
      cameraState.markerCount = 0;
      renderCaptureCanvas();
      setCameraStatus(`Loaded image ${file.name}. Tap Take Picture to detect markers.`);
    };
    image.onerror = () => {
      setCameraStatus("Could not decode the selected image.");
    };
    image.src = String(reader.result);
  };

  reader.onerror = () => {
    setCameraStatus("Could not read the selected image.");
  };

  reader.readAsDataURL(file);
}

async function detectQRCodesFromCapture() {
  if (!cameraState.frameImage) {
    return [];
  }

  if (!("BarcodeDetector" in window)) {
    cameraState.qrCount = 0;
    return [];
  }

  try {
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const codes = await detector.detect(dom.cameraCapture);
    cameraState.qrCount = codes.length;
    return codes;
  } catch (error) {
    setCameraStatus(`QR detection error: ${error.message}`);
    cameraState.qrCount = 0;
    return [];
  }
}

async function autoDetectQRCorners(prefetchedCodes = null) {
  if (!cameraState.frameImage) {
    setCameraStatus("Capture a frame before running QR detection.");
    return;
  }

  let codes = prefetchedCodes;
  if (!Array.isArray(codes)) {
    codes = await detectQRCodesFromCapture();
  } else {
    cameraState.qrCount = codes.length;
  }

  if (!codes || codes.length === 0) {
    setCameraStatus("No QR codes detected.");
    return;
  }

  const taggedCorners = detectCornerMarkersFromCodes(codes);
  if (taggedCorners) {
    cameraState.corners = taggedCorners;
    cameraState.boardProjection = buildBoardProjectionFromBoardCorners(cameraState.corners);
    renderCaptureCanvas();
    setCameraStatus("Board corners detected from tagged QR markers.");
    return;
  }

  const centers = codes
    .map((code) => qrCenterPoint(code))
    .filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y));

  if (centers.length < 4) {
    setCameraStatus(`Detected ${centers.length} QR code(s). Need at least 4 for auto corners.`);
    return;
  }

  const inferred = inferCornersFromPoints(centers);
  if (!inferred) {
    setCameraStatus("Could not infer corner ordering from QR detections.");
    return;
  }

  cameraState.corners = inferred;
  cameraState.boardProjection = buildBoardProjectionFromBoardCorners(cameraState.corners);
  renderCaptureCanvas();
  setCameraStatus(`Auto-selected corners from ${centers.length} QR detections.`);
}

function qrCenterPoint(code) {
  if (Array.isArray(code.cornerPoints) && code.cornerPoints.length > 0) {
    const total = code.cornerPoints.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 },
    );
    return {
      x: total.x / code.cornerPoints.length,
      y: total.y / code.cornerPoints.length,
    };
  }

  if (code.boundingBox) {
    return {
      x: code.boundingBox.x + code.boundingBox.width / 2,
      y: code.boundingBox.y + code.boundingBox.height / 2,
    };
  }

  return null;
}

function inferCornersFromPoints(points) {
  if (points.length < 4) {
    return null;
  }

  const used = new Set();
  const pick = (scoreFn, pickMax) => {
    let bestIndex = -1;
    let bestScore = pickMax ? -Infinity : Infinity;

    for (let i = 0; i < points.length; i += 1) {
      if (used.has(i)) {
        continue;
      }
      const score = scoreFn(points[i]);
      if (pickMax ? score > bestScore : score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) {
      return null;
    }

    used.add(bestIndex);
    return points[bestIndex];
  };

  const topLeft = pick((point) => point.x + point.y, false);
  const bottomRight = pick((point) => point.x + point.y, true);
  const topRight = pick((point) => point.x - point.y, true);
  const bottomLeft = pick((point) => point.x - point.y, false);

  if (!topLeft || !topRight || !bottomRight || !bottomLeft) {
    return null;
  }

  return [topLeft, topRight, bottomRight, bottomLeft];
}

function detectCornerMarkersFromCodes(codes) {
  const corners = { tl: null, tr: null, br: null, bl: null };
  for (const code of codes) {
    const label = parseCornerLabel(code.rawValue || "");
    if (!label) {
      continue;
    }
    const center = qrCenterPoint(code);
    if (!center) {
      continue;
    }
    corners[label] = center;
  }
  if (!corners.tl || !corners.tr || !corners.br || !corners.bl) {
    return null;
  }
  return [corners.tl, corners.tr, corners.br, corners.bl];
}

function parseCornerLabel(value) {
  const text = String(value || "").trim().toUpperCase();
  if (!text) {
    return null;
  }

  const table = {
    BOARD_TL: "tl",
    BOARD_TR: "tr",
    BOARD_BR: "br",
    BOARD_BL: "bl",
    TL: "tl",
    TR: "tr",
    BR: "br",
    BL: "bl",
  };

  if (table[text]) {
    return table[text];
  }

  const compactMatch = text.match(/(?:BOARD|CORNER)[\s:_-]*([TBRL]{2})/i);
  if (!compactMatch) {
    return null;
  }
  return table[compactMatch[1].toUpperCase()] || null;
}

async function tryLoadPentominoesFromQRCodes(codes) {
  if (!Array.isArray(codes) || codes.length === 0) {
    return 0;
  }

  const parsedPieces = [];
  for (const code of codes) {
    const parsed = parsePieceQrPayload(code.rawValue || "");
    if (!parsed) {
      continue;
    }
    parsed.center = qrCenterPoint(code);
    parsedPieces.push(parsed);
  }

  if (parsedPieces.length === 0) {
    return 0;
  }

  const needsProjectedPosition = parsedPieces.some((piece) => !Number.isFinite(piece.x) || !Number.isFinite(piece.y));
  if (needsProjectedPosition) {
    const taggedCorners = detectCornerMarkersFromCodes(codes);
    if (taggedCorners) {
      cameraState.corners = taggedCorners;
      cameraState.boardProjection = buildBoardProjectionFromBoardCorners(cameraState.corners);
    } else {
      await autoDetectQRCorners(codes);
    }
    if (cameraState.corners.length !== 4) {
      return 0;
    }
  }

  gameState.selectedPieceId = null;
  gameState.activePieceId = null;
  gameState.rotation = 0;
  gameState.flipped = false;
  gameState.drag = null;
  gameState.importedMask = makeBoolGrid(false);
  gameState.placedPieces.clear();
  rebuildGameOccupancy();

  let loaded = 0;
  for (const pieceData of parsedPieces) {
    const piece = PIECE_BY_ID.get(pieceData.id);
    if (!piece) {
      continue;
    }
    if (gameState.placedPieces.has(piece.id)) {
      continue;
    }

    const rotation = ((pieceData.rotation % 4) + 4) % 4;
    const flipped = Boolean(pieceData.flip);
    const relativeCells = getOrientedCells(piece.cells, rotation, flipped);

    let cellX = pieceData.x;
    let cellY = pieceData.y;
    if ((!Number.isFinite(cellX) || !Number.isFinite(cellY)) && pieceData.center) {
      const mapped = pointToBoardCell(pieceData.center, cameraState.corners, cameraState.boardProjection);
      if (!mapped) {
        continue;
      }
      cellX = mapped.x;
      cellY = mapped.y;
    }

    if (!Number.isFinite(cellX) || !Number.isFinite(cellY)) {
      continue;
    }

    const offsetX = Number.isFinite(pieceData.offsetX) ? pieceData.offsetX : 0;
    const offsetY = Number.isFinite(pieceData.offsetY) ? pieceData.offsetY : 0;
    const anchorX = Math.round(cellX - offsetX);
    const anchorY = Math.round(cellY - offsetY);

    if (!canPlaceCells(relativeCells, anchorX, anchorY)) {
      continue;
    }

    const placed = buildPlacedPiece(piece, rotation, flipped, relativeCells, anchorX, anchorY);
    gameState.placedPieces.set(piece.id, placed);
    rebuildGameOccupancy();
    loaded += 1;
  }

  if (loaded === 0) {
    return 0;
  }

  clearGameAnalysis();
  updatePieceTrayState();
  runGameAreaDetection();
  setGameStatus(`Loaded ${loaded} detected pentomino${loaded === 1 ? "" : "es"} from QR.`);
  return loaded;
}

function parsePieceQrPayload(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text) {
    return null;
  }

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      const id = String(parsed.id || parsed.piece || parsed.pentomino || "").trim().toUpperCase();
      if (!PIECE_BY_ID.has(id)) {
        return null;
      }
      return {
        id,
        x: toNumberOrNaN(parsed.x ?? parsed.col),
        y: toNumberOrNaN(parsed.y ?? parsed.row),
        rotation: toNumberOrDefault(parsed.rotation ?? parsed.r, 0),
        flip: toBool(parsed.flip ?? parsed.f),
        offsetX: toNumberOrDefault(parsed.offsetX ?? parsed.ox, 0),
        offsetY: toNumberOrDefault(parsed.offsetY ?? parsed.oy, 0),
      };
    } catch {
      return null;
    }
  }

  const compact = text.match(
    /^(?:PENTO|PIECE|TILE)\s*[:#-]\s*([FILNPTUVWXYZ])(?:\s*[:#-]\s*(-?\d+)\s*[:#-]\s*(-?\d+)\s*[:#-]\s*(-?\d+)\s*[:#-]\s*(0|1))?/i,
  );
  if (compact) {
    const id = compact[1].toUpperCase();
    return {
      id,
      x: toNumberOrNaN(compact[2]),
      y: toNumberOrNaN(compact[3]),
      rotation: toNumberOrDefault(compact[4], 0),
      flip: toBool(compact[5]),
      offsetX: 0,
      offsetY: 0,
    };
  }

  const kv = parseKeyValuePayload(text);
  const id = String(kv.id || kv.piece || kv.pentomino || "").trim().toUpperCase();
  if (!PIECE_BY_ID.has(id)) {
    return null;
  }
  return {
    id,
    x: toNumberOrNaN(kv.x ?? kv.col),
    y: toNumberOrNaN(kv.y ?? kv.row),
    rotation: toNumberOrDefault(kv.rotation ?? kv.r, 0),
    flip: toBool(kv.flip ?? kv.f),
    offsetX: toNumberOrDefault(kv.offsetx ?? kv.ox, 0),
    offsetY: toNumberOrDefault(kv.offsety ?? kv.oy, 0),
  };
}

function parseKeyValuePayload(text) {
  const map = {};
  const parts = text.split(/[;,|]/);
  for (const part of parts) {
    const [rawKey, rawValue] = part.split(/[:=]/);
    if (!rawKey || rawValue === undefined) {
      continue;
    }
    map[rawKey.trim().toLowerCase()] = rawValue.trim();
  }
  return map;
}

function toNumberOrNaN(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function toNumberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toBool(value) {
  if (typeof value === "boolean") {
    return value;
  }
  const text = String(value ?? "").trim().toLowerCase();
  return text === "1" || text === "true" || text === "yes";
}

function boardUvToImagePoint(corners, u, v, boardProjection = null) {
  if (boardProjection && boardProjection.boardToImage) {
    const projected = applyHomography(boardProjection.boardToImage, u, v);
    if (projected) {
      return projected;
    }
  }
  return bilinearPoint(corners, u, v);
}

function imagePointToBoardUv(point, corners, boardProjection = null) {
  if (boardProjection && boardProjection.imageToBoard) {
    const projected = applyHomography(boardProjection.imageToBoard, point.x, point.y);
    if (projected) {
      return { u: clamp(projected.x, 0, 1), v: clamp(projected.y, 0, 1) };
    }
  }
  return invertBilinearPoint(corners, point);
}

function pointToBoardCell(point, corners, boardProjection = null) {
  if (!point || !Array.isArray(corners) || corners.length !== 4) {
    return null;
  }
  const uv = imagePointToBoardUv(point, corners, boardProjection);
  if (!uv) {
    return null;
  }
  const x = clamp(Math.floor(uv.u * BOARD_SIZE), 0, BOARD_SIZE - 1);
  const y = clamp(Math.floor(uv.v * BOARD_SIZE), 0, BOARD_SIZE - 1);
  return { x, y };
}

function invertBilinearPoint(corners, point) {
  const [tl, tr, br, bl] = corners;
  let u = 0.5;
  let v = 0.5;

  for (let i = 0; i < 12; i += 1) {
    const predicted = bilinearPoint(corners, u, v);
    const dx = point.x - predicted.x;
    const dy = point.y - predicted.y;

    const dU = {
      x: (1 - v) * (tr.x - tl.x) + v * (br.x - bl.x),
      y: (1 - v) * (tr.y - tl.y) + v * (br.y - bl.y),
    };
    const dV = {
      x: (1 - u) * (bl.x - tl.x) + u * (br.x - tr.x),
      y: (1 - u) * (bl.y - tl.y) + u * (br.y - tr.y),
    };

    const det = dU.x * dV.y - dU.y * dV.x;
    if (Math.abs(det) < 1e-8) {
      break;
    }

    const stepU = (dx * dV.y - dy * dV.x) / det;
    const stepV = (dy * dU.x - dx * dU.y) / det;
    u = clamp(u + stepU, 0, 1);
    v = clamp(v + stepV, 0, 1);

    if (Math.abs(stepU) < 1e-4 && Math.abs(stepV) < 1e-4) {
      return { u, v };
    }
  }

  return { u, v };
}

function detectFenceFromFrame() {
  if (!cameraState.frameImage) {
    setCameraStatus("Capture a frame before detection.");
    return;
  }
  if (cameraState.corners.length !== 4) {
    setCameraStatus("Select 4 board corners before detection.");
    return;
  }

  const mask = makeBoolGrid(false);
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      let lumaSum = 0;
      let count = 0;

      for (const sy of SAMPLE_OFFSETS) {
        for (const sx of SAMPLE_OFFSETS) {
          const u = (x + sx) / BOARD_SIZE;
          const v = (y + sy) / BOARD_SIZE;
          const point = boardUvToImagePoint(cameraState.corners, u, v, cameraState.boardProjection);
          lumaSum += sampleLuminance(cameraState.frameImage, point.x, point.y);
          count += 1;
        }
      }

      const averageLuma = lumaSum / Math.max(1, count);
      mask[y][x] = averageLuma < cameraState.threshold;
    }
  }

  cameraState.mask = mask;
  cameraState.analysis = analyzeFence(mask);
  renderCameraGrid();
  updateCameraMetrics();

  const totalArea = cameraState.analysis.totalArea;
  setCameraStatus(`Detection complete. Enclosed area: ${totalArea}.`);
}

function computeCameraAreaFromMask() {
  cameraState.analysis = analyzeFence(cameraState.mask);
  renderCameraGrid();
  updateCameraMetrics();

  const totalArea = cameraState.analysis.totalArea;
  const regions = cameraState.analysis.components.length;
  setCameraStatus(`Computed from current mask: area ${totalArea}, regions ${regions}.`);
}

function renderCaptureCanvas() {
  if (!cameraState.frameImage) {
    const view = prepareCanvas(dom.cameraCapture, captureCtx, 240);
    captureCtx.clearRect(0, 0, view.width, view.height);
    captureCtx.fillStyle = "#0f141c";
    captureCtx.fillRect(0, 0, view.width, view.height);
    captureCtx.fillStyle = "#8aa0b7";
    captureCtx.font = "16px Manrope";
    captureCtx.textAlign = "center";
    captureCtx.fillText("Capture a frame to begin corner calibration", view.width / 2, view.height / 2);
    return;
  }

  dom.cameraCapture.width = cameraState.frameImage.width;
  dom.cameraCapture.height = cameraState.frameImage.height;
  captureCtx.putImageData(cameraState.frameImage, 0, 0);

  if (cameraState.corners.length > 0) {
    captureCtx.strokeStyle = "#3fb8ff";
    captureCtx.lineWidth = 3;
    captureCtx.beginPath();
    captureCtx.moveTo(cameraState.corners[0].x, cameraState.corners[0].y);
    for (let i = 1; i < cameraState.corners.length; i += 1) {
      captureCtx.lineTo(cameraState.corners[i].x, cameraState.corners[i].y);
    }
    if (cameraState.corners.length === 4) {
      captureCtx.closePath();
      captureCtx.fillStyle = "rgba(63, 184, 255, 0.12)";
      captureCtx.fill();
    }
    captureCtx.stroke();

    for (let i = 0; i < cameraState.corners.length; i += 1) {
      const point = cameraState.corners[i];
      captureCtx.beginPath();
      captureCtx.fillStyle = "#2ecf99";
      captureCtx.arc(point.x, point.y, 8, 0, Math.PI * 2);
      captureCtx.fill();

      captureCtx.fillStyle = "#0d1117";
      captureCtx.font = "bold 12px Manrope";
      captureCtx.textAlign = "center";
      captureCtx.fillText(String(i + 1), point.x, point.y + 4);
    }
  }
}

function renderCameraGrid() {
  const view = prepareCanvas(dom.cameraGrid, cameraGridCtx, 280);
  const pad = 12;
  const cellSize = Math.max(8, Math.floor(Math.min((view.width - pad * 2) / BOARD_SIZE, (view.height - pad * 2) / BOARD_SIZE)));
  const boardPx = cellSize * BOARD_SIZE;
  const originX = Math.floor((view.width - boardPx) / 2);
  const originY = Math.floor((view.height - boardPx) / 2);
  cameraState.layout = { originX, originY, cellSize, boardPx };

  const interiorKeys = cameraState.analysis ? new Set(cameraState.analysis.interiorKeys) : new Set();

  cameraGridCtx.clearRect(0, 0, view.width, view.height);
  cameraGridCtx.fillStyle = "#0f151f";
  cameraGridCtx.fillRect(originX - 2, originY - 2, boardPx + 4, boardPx + 4);

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const px = originX + x * cellSize;
      const py = originY + y * cellSize;
      const key = keyOf(x, y);

      if (cameraState.mask[y][x]) {
        cameraGridCtx.fillStyle = "#f59f00";
      } else if (interiorKeys.has(key)) {
        cameraGridCtx.fillStyle = "rgba(46, 207, 153, 0.4)";
      } else {
        cameraGridCtx.fillStyle = "#121a26";
      }

      cameraGridCtx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
    }
  }

  cameraGridCtx.strokeStyle = "#2a374a";
  cameraGridCtx.lineWidth = 1;
  for (let i = 0; i <= BOARD_SIZE; i += 1) {
    const lineX = originX + i * cellSize + 0.5;
    const lineY = originY + i * cellSize + 0.5;

    cameraGridCtx.beginPath();
    cameraGridCtx.moveTo(lineX, originY);
    cameraGridCtx.lineTo(lineX, originY + boardPx);
    cameraGridCtx.stroke();

    cameraGridCtx.beginPath();
    cameraGridCtx.moveTo(originX, lineY);
    cameraGridCtx.lineTo(originX + boardPx, lineY);
    cameraGridCtx.stroke();
  }

  cameraGridCtx.strokeStyle = "#5a708f";
  cameraGridCtx.lineWidth = 1.6;
  cameraGridCtx.strokeRect(originX + 0.5, originY + 0.5, boardPx, boardPx);
}

function updateCameraMetrics() {
  let fenceCells = 0;
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (cameraState.mask[y][x]) {
        fenceCells += 1;
      }
    }
  }

  const totalArea = cameraState.analysis ? cameraState.analysis.totalArea : 0;
  const regions = cameraState.analysis ? cameraState.analysis.components.length : 0;
  const largest = cameraState.analysis && cameraState.analysis.components.length > 0 ? cameraState.analysis.components[0].size : 0;

  dom.cameraMetrics.innerHTML = [
    `<div>Detected fence cells: <strong>${fenceCells}</strong></div>`,
    `<div>Enclosed area: <strong>${totalArea}</strong></div>`,
    `<div>Regions: <strong>${regions}</strong> (largest <strong>${largest}</strong>)</div>`,
    `<div>Markers seen: <strong>${cameraState.markerCount}</strong> (QR fallback: <strong>${cameraState.qrCount}</strong>)</div>`,
  ].join("");
}

function setCameraStatus(text) {
  dom.cameraStatus.textContent = text;
}

function analyzeFence(blocked) {
  const visited = makeBoolGrid(false);
  const queue = [];

  const enqueue = (x, y) => {
    visited[y][x] = true;
    queue.push({ x, y });
  };

  for (let x = 0; x < BOARD_SIZE; x += 1) {
    if (!blocked[0][x] && !visited[0][x]) {
      enqueue(x, 0);
    }
    if (!blocked[BOARD_SIZE - 1][x] && !visited[BOARD_SIZE - 1][x]) {
      enqueue(x, BOARD_SIZE - 1);
    }
  }

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    if (!blocked[y][0] && !visited[y][0]) {
      enqueue(0, y);
    }
    if (!blocked[y][BOARD_SIZE - 1] && !visited[y][BOARD_SIZE - 1]) {
      enqueue(BOARD_SIZE - 1, y);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head];
    head += 1;

    for (const [dx, dy] of EMPTY_SPACE_NEIGHBORS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (!isInsideBoard(nx, ny) || blocked[ny][nx] || visited[ny][nx]) {
        continue;
      }
      enqueue(nx, ny);
    }
  }

  const interiorMask = makeBoolGrid(false);
  const interiorKeys = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (!blocked[y][x] && !visited[y][x]) {
        interiorMask[y][x] = true;
        interiorKeys.push(keyOf(x, y));
      }
    }
  }

  // Strict (4-connected) outside flood: treats corners as sealed. A cell enclosed here but
  // reached by the 8-connected outside flood leaks through a corner. leakKeys = those cells.
  const strictVisited = makeBoolGrid(false);
  const strictQueue = [];
  const strictEnqueue = (x, y) => {
    strictVisited[y][x] = true;
    strictQueue.push({ x, y });
  };
  for (let x = 0; x < BOARD_SIZE; x += 1) {
    if (!blocked[0][x] && !strictVisited[0][x]) strictEnqueue(x, 0);
    if (!blocked[BOARD_SIZE - 1][x] && !strictVisited[BOARD_SIZE - 1][x]) strictEnqueue(x, BOARD_SIZE - 1);
  }
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    if (!blocked[y][0] && !strictVisited[y][0]) strictEnqueue(0, y);
    if (!blocked[y][BOARD_SIZE - 1] && !strictVisited[y][BOARD_SIZE - 1]) strictEnqueue(BOARD_SIZE - 1, y);
  }
  let strictHead = 0;
  while (strictHead < strictQueue.length) {
    const current = strictQueue[strictHead];
    strictHead += 1;
    for (const [dx, dy] of ORTHOGONAL_NEIGHBORS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (!isInsideBoard(nx, ny) || blocked[ny][nx] || strictVisited[ny][nx]) {
        continue;
      }
      strictEnqueue(nx, ny);
    }
  }
  const leakKeys = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (!blocked[y][x] && !strictVisited[y][x] && visited[y][x]) {
        leakKeys.push(keyOf(x, y));
      }
    }
  }

  const components = [];
  const seen = makeBoolGrid(false);

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (!interiorMask[y][x] || seen[y][x]) {
        continue;
      }

      const componentQueue = [{ x, y }];
      seen[y][x] = true;
      let size = 0;

      for (let i = 0; i < componentQueue.length; i += 1) {
        const node = componentQueue[i];
        size += 1;

        for (const [dx, dy] of ORTHOGONAL_NEIGHBORS) {
          const nx = node.x + dx;
          const ny = node.y + dy;
          if (!isInsideBoard(nx, ny) || seen[ny][nx] || !interiorMask[ny][nx]) {
            continue;
          }
          seen[ny][nx] = true;
          componentQueue.push({ x: nx, y: ny });
        }
      }

      components.push({ size });
    }
  }

  components.sort((a, b) => b.size - a.size);

  return {
    totalArea: interiorKeys.length,
    components,
    interiorKeys,
    leakKeys,
    cornerLeak: leakKeys.length > 0,
  };
}

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

function canvasPixelPointFromEvent(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }

  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  return { x, y };
}

function indexOfNearestCorner(point, corners) {
  let bestIndex = 0;
  let bestDistance = Infinity;

  for (let i = 0; i < corners.length; i += 1) {
    const dx = corners[i].x - point.x;
    const dy = corners[i].y - point.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function bilinearPoint(corners, u, v) {
  const [tl, tr, br, bl] = corners;
  return {
    x: (1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + u * v * br.x + (1 - u) * v * bl.x,
    y: (1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + u * v * br.y + (1 - u) * v * bl.y,
  };
}

function sampleLuminance(imageData, x, y) {
  const px = clamp(Math.round(x), 0, imageData.width - 1);
  const py = clamp(Math.round(y), 0, imageData.height - 1);
  const index = (py * imageData.width + px) * 4;
  const data = imageData.data;
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  return 0.299 * r + 0.587 * g + 0.114 * b;
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

function makeBoolGrid(initialValue) {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => Boolean(initialValue)));
}

function makeNumberGrid(initialValue) {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => Number(initialValue)));
}

function keyOf(x, y) {
  return `${x},${y}`;
}

if (typeof window !== "undefined") {
  window.FenceChallengeDebug = window.FenceChallengeDebug || {};
  window.FenceChallengeDebug.detectCustomMarkersFromCapture = detectCustomMarkersFromCapture;
  window.FenceChallengeDebug.buildMarkerDetectionReport = buildMarkerDetectionReport;
  window.FenceChallengeDebug.detectCustomMarkersReportFromFrame = detectCustomMarkersReportFromFrame;
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
