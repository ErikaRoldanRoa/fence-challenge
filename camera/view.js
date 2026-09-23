/* Fence Challenge · "Play on paper" page.
 *
 * Opens the camera only after a tap, reads the frames with FenceCamera
 * (camera/core.js) and draws what the board encloses over the picture of
 * the paper. Nothing leaves the device: frames live in memory, the page's
 * security policy forbids network connections.
 *
 * The page state is mirrored on <body> as data-fc-* attributes:
 *   data-fc-state   start | starting | live | tap | paused | stopped | photo | error
 *   data-fc-board   board recognised (or the board hint before that)
 *   data-fc-area    area on the number pill (it changes with the status line)
 *   data-fc-regions number of inside regions, data-fc-leak 1 when a corner leaks
 *   data-fc-markers corner marks seen, data-fc-status current status key
 *   data-fc-stable  1 when the view is settled (always 1 for a photo)
 *   data-fc-held    1 while the drawing shows the last steady view, not this one
 *   data-fc-continue 1 when "Continue on screen" can be used
 *   data-fc-desktop 1 when the device probably has no camera facing the table
 *   data-fc-framed  1 when the page runs inside another page (no camera then)
 *   data-fc-zoom    1 while a photo is shown zoomed on its board
 *   data-fc-core-error 1 after the picture could not be read many times in a row
 */
(function () {
  "use strict";

  const PROCESS_LONG_SIDE = 640; // live frames are analysed at this size
  const PHOTO_LONG_SIDE = 2560; // stills keep more detail
  const STATUS_DWELL_MS = 450; // a new status must hold this long before it shows
  const HANDS_HOLD_MS = 1300; // "hands" stays up this long after the last busy frame
  const BOARD_TAG_MS = 2600; // how long the recognised board's name stays up
  const CHEER_MS = 1600; // the neon pulse of the first closed fence
  const CHEERED_KEY = "fc-paper-cheered";
  const MIN_FRAME_MS = 60; // at most about 15 analysed frames per second
  const START_TIMEOUT_MS = 5000; // then the photo is offered while the camera keeps trying
  const STEADY_MS = 200; // a view counts as steady again after this long
  const FIND_AGAIN_MS = 1500; // once a board was found, "show the corners" waits this long
  const FIND_ANNOUNCE_MS = 1000; // "show the corners" is read out only if it lasts
  const READ_FAILS_MAX = 10; // frames in a row that could not be read before saying so
  const ZOOM_MARGIN = 0.06; // room around the board when a photo is zoomed on it
  const ZOOM_MIN_GAIN = 1.2; // zoom only when it makes the board clearly larger
  const CONTINUE_BOARDS = new Set(["sq9", "hex4", "tri4", "sq20", "sq20-classic"]);
  const IMPORT_KEY = "fc-paper-import";
  const COUNT_FIRST_KEY = "fc-paper-count-first";
  const CONSTRAINTS = {
    audio: false,
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
  };

  // Overlay palette. Neon green is the digital board's enclosure colour and
  // lights up a real fence only. Any other inside region gets a muted tint,
  // never the neon and never the violet of the corner leaks.
  const FENCE_TINT = [45, 246, 172];
  const OTHER_TINTS = [
    [226, 196, 140],
    [150, 186, 226],
    [226, 160, 140],
    [200, 204, 214],
  ];
  // Words in camera names that mean it faces away from the screen.
  const REAR_LABEL = /\b(back|rear|environment|world)\b|arri[eè]re|r[uü]ck|trasera|posteriore|traseira|achter/i;

  const $ = (id) => document.getElementById(id);
  const el = {
    body: document.body,
    stage: $("stage"),
    video: $("video"),
    still: $("still"),
    overlay: $("overlay"),
    stageLabel: $("stageLabel"),
    sheet: $("sheet"),
    sheetMsg: $("sheetMsg"),
    actions: $("sheetActions"),
    startBtn: $("startBtn"),
    startLabel: $("startLabel"),
    photoBtn: $("photoBtn"),
    photoLabel: $("photoLabel"),
    phoneBlock: $("phoneBlock"),
    qr: $("qr"),
    ownTab: $("ownTab"),
    zoomBtn: $("zoomBtn"),
    photoInput: $("photoInput"),
    kitLink: $("kitLink"),
    closeBtn: $("closeBtn"),
    countBtn: $("countBtn"),
    dock: $("dock"),
    status: $("status"),
    announce: $("announce"),
    pill: $("pill"),
    areaNum: $("areaNum"),
    pauseBtn: $("pauseBtn"),
    torchBtn: $("torchBtn"),
    photoAgainBtn: $("photoAgainBtn"),
    useCameraBtn: $("useCameraBtn"),
    continueBtn: $("continueBtn"),
    continueWhy: $("continueWhy"),
    boardTag: $("boardTag"),
    boardTagName: $("boardTagName"),
    metaDescription: document.querySelector('meta[name="description"]'),
  };
  const t = (key, vars) => (window.i18n ? window.i18n.t(key, vars) : key);
  const Boards = window.FenceBoards;
  const Camera = window.FenceCamera;

  const params = new URLSearchParams(location.search);
  const hint = Boards && Boards.get(params.get("board")) ? params.get("board") : null;

  const reduceMotion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const homeScreenIOS = window.navigator.standalone === true;
  const cameraApi = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const coarsePointer = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  // Inside another site's frame the camera never starts: that site could
  // cover the page with its own buttons.
  const framed = (() => {
    try {
      return window.top !== window.self;
    } catch (e) {
      return true;
    }
  })();

  const st = {
    mode: "start",
    stream: null,
    track: null,
    torch: false,
    tracker: null,
    loop: 0, // bumps to cancel a running frame loop
    startToken: 0, // bumps to cancel a camera start that is still waiting
    startTimer: 0,
    slowStart: false, // the camera takes long to open: the photo is offered meanwhile
    cameraError: null,
    needsTap: false, // the browser wants a tap before the picture plays
    busy: false, // an analysis is still running
    lastVideoTime: -1,
    lastProcessAt: -Infinity,
    proc: null, // { canvas, ctx, w, h }
    result: null,
    frameScale: 1, // media pixels per analysed pixel
    view: null, // displayed media rectangle
    boardCache: new Map(),
    countFirst: false,
    revealed: null, // area value the player chose to reveal
    area: 0,
    placements: null,
    held: false, // the drawing is the last steady view (hands, or not settled yet)
    steadySince: 0,
    frozen: false, // the still canvas holds the last camera frame (paused or stopped)
    announced: null, // last status read out to screen readers
    status: null, // { key, vars } on screen
    pending: null,
    pendingAt: 0,
    pendingTimer: 0,
    anim: 0,
    cameraFailed: false,
    fromSheet: true, // the camera is being started from the start sheet
    settings: {},
    handsUntil: 0, // "hands" is held until this time (performance.now)
    taggedBoard: null, // board whose name was shown for this camera run or photo
    tagBoard: null, // board named by the tag on screen
    tagTimer: 0,
    cheered: false, // the first closed fence of this visit was celebrated
    cheerAt: 0,
    desktop: !coarsePointer, // probably no camera facing the table: offer the phone
    boardSeen: false, // a board was recognised in this camera run or photo
    findTimer: 0,
    shownArea: 0, // the number on the pill, set together with the status line
    steadyResult: null, // the last result read from a steady view (or a photo)
    placementsBoard: null,
    readFails: 0, // frames in a row the reader could not handle
    zoom: true, // photos open zoomed on their board
    zoomRect: null, // { x, y, w, h } in picture pixels, or null
    photoOffered: false, // the photo is offered on a phone (after a failure, say)
  };

  try {
    st.countFirst = localStorage.getItem(COUNT_FIRST_KEY) === "1";
  } catch (e) {
    st.countFirst = false;
  }
  try {
    st.cheered = sessionStorage.getItem(CHEERED_KEY) === "1";
  } catch (e) {
    st.cheered = false;
  }

  /* ---------------------------------------------------------------- modes */

  function setMode(mode) {
    st.mode = mode;
    el.body.dataset.fcState = mode;
    const onSheet = mode === "start" || mode === "error" || (mode === "starting" && st.fromSheet);
    el.sheet.hidden = !onSheet;
    el.dock.hidden = onSheet;
    if (onSheet) hideBoardTag();
    el.countBtn.hidden = onSheet;
    const photo = mode === "photo";
    if (mode === "live" || onSheet) st.frozen = false;
    // Paused or stopped, the last camera frame stays on screen under its drawing.
    const still = photo || (st.frozen && !onSheet);
    el.video.hidden = still;
    el.still.hidden = !still;
    el.pauseBtn.hidden = photo;
    el.photoAgainBtn.hidden = !photo;
    el.useCameraBtn.hidden = !(photo && cameraApi && !st.cameraFailed && !framed);
    if (!photo) setZoomRect(null);
    el.torchBtn.hidden = photo || !torchSupported();
    el.stageLabel.setAttribute("data-i18n-aria-label", photo ? "cam.photoLabel" : "cam.videoLabel");
    el.stageLabel.setAttribute("aria-label", t(photo ? "cam.photoLabel" : "cam.videoLabel"));
    paintStartButtons();
    const paused = mode === "paused" || mode === "stopped" || mode === "tap";
    el.pauseBtn.dataset.paused = paused ? "true" : "false";
    const pauseKey = mode === "tap" ? "cam.start" : paused ? "cam.resume" : "cam.pause";
    el.pauseBtn.setAttribute("data-i18n-aria-label", pauseKey);
    el.pauseBtn.setAttribute("data-i18n-title", pauseKey);
    el.pauseBtn.setAttribute("aria-label", t(pauseKey));
    el.pauseBtn.setAttribute("title", t(pauseKey));
    if (mode === "paused") showStatus({ key: "paused" }, true);
    if (mode === "stopped") showStatus({ key: "stopped" }, true);
    if (mode === "tap") showStatus({ key: "tap" }, true);
    paintContinue();
    fitStage();
    layout();
    render();
  }

  // Start (or "Try again") and the photo button. After a failure, while the
  // camera takes long to open, or on a computer (whose camera faces the
  // player, not the table), the photo is the main action and comes first.
  function paintStartButtons() {
    const waiting = st.mode === "starting" && !st.slowStart;
    const retry = st.mode === "error" || (st.mode === "starting" && st.slowStart);
    el.startBtn.hidden = !cameraApi || !Camera || framed;
    el.startBtn.disabled = waiting;
    const key = waiting ? "cam.starting" : retry ? "cam.retry" : "cam.start";
    el.startLabel.setAttribute("data-i18n", key);
    el.startLabel.textContent = t(key);
    el.photoBtn.hidden = !st.photoOffered && !st.desktop;
    const photoKey = st.desktop ? "cam.photoPick" : "cam.photo";
    el.photoLabel.setAttribute("data-i18n", photoKey);
    el.photoLabel.textContent = t(photoKey);
    paintPhoneBlock();
    const photoFirst = !el.photoBtn.hidden && (retry || el.startBtn.hidden || st.desktop);
    el.startBtn.classList.toggle("primary", !photoFirst);
    el.startBtn.classList.toggle("secondary", photoFirst);
    el.photoBtn.classList.toggle("primary", photoFirst);
    el.photoBtn.classList.toggle("secondary", !photoFirst);
    const first = photoFirst ? el.photoBtn : el.startBtn;
    if (el.actions && el.actions.firstElementChild !== first) {
      const had = document.activeElement === first;
      el.actions.insertBefore(first, el.actions.firstElementChild);
      if (had) first.focus({ preventScroll: true });
    }
  }

  function sheetMessage(key) {
    el.sheetMsg.dataset.key = key || "";
    el.sheetMsg.textContent = key ? t(key) : "";
  }

  function showPhotoOption(show) {
    st.photoOffered = show;
    el.photoBtn.hidden = !show && !st.desktop;
  }

  /* ------------------------------------------- on a computer: use a phone */

  // The address of this page, with its board, for the QR code.
  function pageAddress() {
    return location.origin + location.pathname + (hint ? "?board=" + encodeURIComponent(hint) : "");
  }

  // A QR code drawn here (no network): white quiet zone, one dark path.
  function drawQr(text) {
    if (typeof window.qrcode !== "function") return false;
    let qr;
    try {
      qr = window.qrcode(0, "M");
      qr.addData(text, "Byte");
      qr.make();
    } catch (e) {
      return false;
    }
    const n = qr.getModuleCount();
    const q = 4;
    const size = n + 2 * q;
    let d = "";
    for (let r = 0; r < n; r += 1) {
      let c = 0;
      while (c < n) {
        if (!qr.isDark(r, c)) {
          c += 1;
          continue;
        }
        const start = c;
        while (c < n && qr.isDark(r, c)) c += 1;
        d += "M" + (start + q) + " " + (r + q) + "h" + (c - start) + "v1h" + (start - c) + "z";
      }
    }
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + size + " " + size);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("shape-rendering", "crispEdges");
    const bg = document.createElementNS(NS, "rect");
    bg.setAttribute("width", String(size));
    bg.setAttribute("height", String(size));
    bg.setAttribute("fill", "#ffffff");
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "#0b0a0e");
    svg.appendChild(bg);
    svg.appendChild(path);
    el.qr.replaceChildren(svg);
    el.qr.dataset.text = text;
    return true;
  }

  function paintPhoneBlock() {
    const show = st.desktop && st.mode !== "photo";
    if (show && el.qr.dataset.text !== pageAddress() && !drawQr(pageAddress())) {
      el.phoneBlock.hidden = true;
      el.body.dataset.fcDesktop = st.desktop ? "1" : "0";
      return;
    }
    el.phoneBlock.hidden = !show;
    el.body.dataset.fcDesktop = st.desktop ? "1" : "0";
  }

  // Once the browser names its cameras (after the permission), a camera that
  // faces the table settles the question; on a touch device only a clear
  // answer (every camera reports its direction, none faces the table) turns
  // the phone hint on.
  async function checkCameras() {
    const md = navigator.mediaDevices;
    if (!md || typeof md.enumerateDevices !== "function") return;
    let list;
    try {
      list = await md.enumerateDevices();
    } catch (e) {
      return;
    }
    const cams = (list || []).filter((d) => d.kind === "videoinput");
    const facing = (d) => {
      try {
        const caps = typeof d.getCapabilities === "function" ? d.getCapabilities() : null;
        return caps && Array.isArray(caps.facingMode) ? caps.facingMode : null;
      } catch (e) {
        return null;
      }
    };
    const rear = cams.some((d) => {
      const f = facing(d);
      return (f && f.indexOf("environment") >= 0) || REAR_LABEL.test(d.label || "");
    });
    const named = cams.length > 0 && cams.every((d) => !!d.label);
    let desktop = st.desktop;
    if (rear) desktop = false;
    else if (named && !coarsePointer) desktop = true;
    else if (named && cams.every((d) => (facing(d) || []).length > 0)) desktop = true;
    if (desktop !== st.desktop) {
      st.desktop = desktop;
      paintStartButtons();
    }
  }

  // Move the keyboard focus only when it was lost (on <body>) or sits in a
  // part of the page that has just been hidden.
  function focusIfLost(target, from) {
    const a = document.activeElement;
    const lost = !a || a === document.body || a === document.documentElement || (from && from.contains(a));
    if (lost && target && !target.hidden) target.focus({ preventScroll: true });
  }

  /* --------------------------------------------------------------- camera */

  function errorKey(err) {
    const name = (err && err.name) || "";
    if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "cam.err.denied";
    if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "cam.err.busy";
    if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "cam.err.none";
    return "cam.err.unsupported";
  }

  function failCamera(key) {
    st.cameraFailed = true;
    st.cameraError = key;
    stopTracks();
    st.fromSheet = true;
    showPhotoOption(true);
    setMode("error");
    sheetMessage(key);
    el.body.dataset.fcCameraError = key.replace("cam.err.", "");
    focusIfLost(el.photoBtn, el.sheet);
  }

  function clearStartTimer() {
    clearTimeout(st.startTimer);
    st.startTimer = 0;
  }

  // The camera has not answered for a while (a permission question left open,
  // a stuck device): offer the photo and a new try, and keep waiting meanwhile.
  function slowStart(token) {
    if (token !== st.startToken || st.mode !== "starting") return;
    st.slowStart = true;
    st.fromSheet = true;
    showPhotoOption(true);
    setMode("starting");
    sheetMessage("cam.err.slow");
    el.body.dataset.fcCameraError = "slow";
    focusIfLost(el.photoBtn, el.sheet);
  }

  function stopStream(stream) {
    if (!stream) return;
    stream.getTracks().forEach((tr) => tr.stop());
    if (st.stream === stream) {
      st.stream = null;
      st.track = null;
      st.torch = false;
    }
    if (el.video.srcObject === stream) el.video.srcObject = null;
  }

  async function startCamera() {
    if (framed) return;
    if (!cameraApi || !Camera) {
      failCamera("cam.err.unsupported");
      return;
    }
    if (st.mode === "starting" && !st.slowStart) return;
    // Each start gets its own token: a request that is overtaken (a new tap,
    // the page hidden, a photo chosen, Close) stops its own stream.
    const token = ++st.startToken;
    const from = st.mode;
    const resuming = from === "paused" && !!st.tracker;
    if (from !== "starting") st.fromSheet = from === "start" || from === "error";
    st.slowStart = false;
    clearStartTimer();
    setMode("starting");
    if (st.fromSheet) sheetMessage(homeScreenIOS ? "cam.err.homeScreen" : "");
    else showStatus({ key: "starting" }, true);
    st.startTimer = setTimeout(() => slowStart(token), START_TIMEOUT_MS);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
    } catch (err) {
      if (token === st.startToken) failCamera(errorKey(err));
      return;
    }
    if (token !== st.startToken || st.mode !== "starting") {
      stopStream(stream);
      return;
    }
    clearStartTimer();
    if (st.stream && st.stream !== stream) stopStream(st.stream);
    st.stream = stream;
    st.track = stream.getVideoTracks()[0] || null;
    st.torch = false;
    if (st.track) {
      st.track.addEventListener("ended", () => {
        if (st.stream === stream) {
          stopTracks();
          if (st.mode === "live" || st.mode === "tap") setMode("stopped");
        }
      });
      try {
        st.settings = st.track.getSettings ? st.track.getSettings() : {};
      } catch (e) {
        st.settings = {};
      }
    }
    el.video.srcObject = stream;
    let played = true;
    try {
      await el.video.play();
    } catch (e) {
      played = false; // autoplay refused: the player starts the picture with a tap
    }
    if (token === st.startToken && !el.video.videoWidth) {
      await new Promise((resolve) => {
        const done = () => {
          el.video.removeEventListener("loadedmetadata", done);
          resolve();
        };
        el.video.addEventListener("loadedmetadata", done);
        setTimeout(done, 3000);
      });
    }
    if (token !== st.startToken || st.mode !== "starting" || st.stream !== stream) {
      stopStream(stream);
      return;
    }
    st.cameraFailed = false;
    st.cameraError = null;
    delete el.body.dataset.fcCameraError;
    sheetMessage("");
    if (!st.tracker) st.tracker = Camera.createTracker({ boardId: hint });
    else if (!resuming && st.tracker.reset) st.tracker.reset();
    if (!resuming) {
      st.result = null;
      st.taggedBoard = null;
      st.boardSeen = false;
      st.held = false;
      st.steadyResult = null;
      st.shownArea = 0;
      setPlacements(null);
    }
    st.status = null;
    st.announced = null;
    st.handsUntil = 0;
    st.readFails = 0;
    delete el.body.dataset.fcCoreError;
    checkCameras();
    const fromSheet = st.fromSheet;
    if (!played) {
      st.needsTap = true;
      setMode("tap");
      focusIfLost(el.pauseBtn, el.sheet);
      return;
    }
    goLive();
    if (fromSheet) focusIfLost(el.pauseBtn, el.sheet);
  }

  function goLive() {
    st.needsTap = false;
    setMode("live");
    showStatus(st.result ? statusFor(st.result, false) : { key: "find" }, true);
    updateTorchButton();
    runLoop();
  }

  function stopTracks() {
    st.loop += 1;
    st.startToken += 1;
    clearStartTimer();
    st.slowStart = false;
    st.needsTap = false;
    st.busy = false;
    if (st.stream) st.stream.getTracks().forEach((tr) => tr.stop());
    st.stream = null;
    st.track = null;
    st.torch = false;
    if (el.video.srcObject) {
      try {
        el.video.pause();
      } catch (e) {
        /* nothing to pause */
      }
      el.video.srcObject = null;
    }
  }

  // Keep the last camera frame on screen (the drawing stays over it).
  function freezeFrame() {
    const v = el.video;
    if (!v.videoWidth || !v.videoHeight || v.readyState < 2) {
      st.frozen = false;
      return;
    }
    const c = el.still;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    try {
      c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
      st.frozen = true;
    } catch (e) {
      st.frozen = false;
    }
  }

  function torchSupported() {
    if (!st.track || !st.track.getCapabilities) return false;
    try {
      const caps = st.track.getCapabilities();
      return !!(caps && caps.torch);
    } catch (e) {
      return false;
    }
  }

  function updateTorchButton() {
    el.torchBtn.hidden = st.mode === "photo" || !torchSupported();
    el.torchBtn.setAttribute("aria-pressed", st.torch ? "true" : "false");
  }

  async function toggleTorch() {
    const track = st.track;
    if (!track) return;
    const next = !st.torch;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      if (st.track === track) st.torch = next; // the light changes only when the device agreed
    } catch (e) {
      /* the light stays as it was */
    }
    updateTorchButton();
  }

  // Pause turns the camera off; the last frame stays on screen.
  function pause() {
    if (st.mode !== "live") return;
    freezeFrame();
    stopTracks();
    setMode("paused");
  }

  function resume() {
    if (st.mode === "tap" && st.stream && st.track && st.track.readyState === "live") {
      const stream = st.stream;
      el.video.play().then(
        () => {
          if (st.mode === "tap" && st.stream === stream) goLive();
        },
        () => {}
      );
      return;
    }
    if (st.mode !== "paused" && st.mode !== "stopped" && st.mode !== "tap") return;
    startCamera();
  }

  // Stop the camera whenever the page is hidden; the player resumes with a tap.
  function suspend() {
    const was = st.mode;
    if (was === "live") freezeFrame();
    stopTracks();
    if (was === "live" || was === "tap") setMode("stopped");
    else if (was === "starting") setMode(st.fromSheet ? "start" : "stopped");
  }

  /* ----------------------------------------------------------- frame loop */

  // One analysis at a time, at most about 15 per second.
  function runLoop() {
    const token = ++st.loop;
    const video = el.video;
    const useVFC = typeof video.requestVideoFrameCallback === "function";
    const next = () => {
      if (token !== st.loop || st.mode !== "live") return;
      if (useVFC) video.requestVideoFrameCallback(tick);
      else requestAnimationFrame(tick);
    };
    const tick = () => {
      if (token !== st.loop || st.mode !== "live") return;
      const now = performance.now();
      const fresh = useVFC || video.currentTime !== st.lastVideoTime;
      if (fresh && !st.busy && now - st.lastProcessAt >= MIN_FRAME_MS && video.readyState >= 2 && video.videoWidth > 0) {
        st.lastVideoTime = video.currentTime;
        st.lastProcessAt = now;
        let out = null;
        let failed = false;
        try {
          out = st.tracker.process(grab(video, video.videoWidth, video.videoHeight), { now });
        } catch (e) {
          out = null;
          failed = true;
        }
        if (out && typeof out.then === "function") {
          st.busy = true;
          out.then(
            (result) => {
              if (token !== st.loop) return;
              st.busy = false;
              if (st.mode === "live" && result) {
                readOk();
                accept(result, false);
              }
            },
            () => {
              if (token !== st.loop) return;
              st.busy = false;
              readFailed();
            }
          );
        } else if (out) {
          readOk();
          accept(out, false);
        } else if (failed) {
          readFailed();
        }
      }
      next();
    };
    next();
  }

  // A frame the reader could not handle. After many in a row the page says
  // so (quietly: no console output), instead of asking for the corners forever.
  function readFailed() {
    st.readFails += 1;
    if (st.readFails < READ_FAILS_MAX || el.body.dataset.fcCoreError === "1") return;
    el.body.dataset.fcCoreError = "1";
    showStatus({ key: "reader" }, true);
  }

  function readOk() {
    st.readFails = 0;
    if (el.body.dataset.fcCoreError) delete el.body.dataset.fcCoreError;
  }

  // Draw the frame into a small analysis canvas (at most PROCESS_LONG_SIDE).
  function grab(source, w, h) {
    const scale = Math.min(1, PROCESS_LONG_SIDE / Math.max(w, h));
    const pw = Math.max(1, Math.round(w * scale));
    const ph = Math.max(1, Math.round(h * scale));
    if (!st.proc) {
      const canvas = document.createElement("canvas");
      st.proc = { canvas, ctx: canvas.getContext("2d", { willReadFrequently: true }), w: 0, h: 0 };
    }
    const p = st.proc;
    if (p.w !== pw || p.h !== ph) {
      p.canvas.width = p.w = pw;
      p.canvas.height = p.h = ph;
      if (st.tracker && st.tracker.reset) st.tracker.reset();
    }
    p.ctx.drawImage(source, 0, 0, pw, ph);
    st.frameScale = w / pw;
    return p.ctx.getImageData(0, 0, pw, ph);
  }

  /* ---------------------------------------------------------------- photo */

  function pickPhoto() {
    el.photoInput.value = "";
    el.photoInput.click();
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("unreadable"));
      };
      img.src = url;
    });
  }

  async function analysePhoto(file) {
    if (!file) return;
    stopTracks();
    st.result = null;
    st.taggedBoard = null;
    st.boardSeen = false;
    st.held = false;
    st.announced = null;
    st.steadyResult = null;
    st.shownArea = 0;
    st.zoom = true;
    setZoomRect(null);
    readOk();
    setPlacements(null);
    const fromSheet = !el.sheet.hidden;
    setMode("photo");
    if (fromSheet) focusIfLost(el.photoAgainBtn, el.sheet);
    showStatus({ key: "reading" }, true);
    let loaded;
    try {
      loaded = await loadImage(file);
    } catch (e) {
      // Not a picture this browser can open (a HEIC file on some computers,
      // a damaged file, not an image at all).
      if (st.mode !== "photo") return;
      el.still.width = el.still.height = 0; // no picture to show
      photoFailed("photoFile");
      return;
    }
    const { img, url } = loaded;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const scale = Math.min(1, PHOTO_LONG_SIDE / Math.max(w, h));
    const still = el.still;
    still.width = Math.max(1, Math.round(w * scale));
    still.height = Math.max(1, Math.round(h * scale));
    const ctx = still.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, still.width, still.height);
    URL.revokeObjectURL(url);
    layout();
    // Let the photo paint before the heavier analysis runs.
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    let result = null;
    try {
      const image = ctx.getImageData(0, 0, still.width, still.height);
      result = await Promise.resolve(Camera.snapshot(image, hint ? { boardId: hint } : {}));
    } catch (e) {
      result = null;
    }
    if (st.mode !== "photo") return;
    st.frameScale = 1;
    if (!result || !result.H) {
      photoFailed("photoError");
      return;
    }
    accept(result, true);
  }

  // key: photoFile (the file is not a picture) or photoError (no board on it).
  function photoFailed(key) {
    st.result = null;
    showStatus({ key, area: 0 }, true);
    updateReadout(null, true);
    render();
  }

  /* ---------------------------------------------------- results and status */

  function accept(result, photo) {
    st.result = result;
    const now = performance.now();
    if (!photo && result.handsLikely) st.handsUntil = now + HANDS_HOLD_MS;
    // The first frame that finds the board replaces "show the corners" at once,
    // so the line never contradicts the board's name shown above the picture.
    const found = !!result.H && !!result.boardId && !st.boardSeen;
    if (found) st.boardSeen = true;
    if (result.boardId && result.boardId !== st.taggedBoard) {
      st.taggedBoard = result.boardId;
      showBoardTag(result.boardId);
    }
    showStatus(statusFor(result, photo), photo || found);
    updateHeld(result, photo, now);
    updateReadout(result, photo);
    updatePlacements(result, photo);
    if (photo) setZoomRect(zoomRectFor(result));
    render();
  }

  // The drawing always shows the last steady board. While hands are over it,
  // or the paper has changed and not settled yet, that drawing is only a
  // memory: it is dimmed, the number stops glowing and "Continue on screen"
  // waits for the next steady view.
  function updateHeld(result, photo, now) {
    if (photo) {
      st.held = false;
      st.steadySince = 0;
    } else {
      const handsShown = !!st.status && st.status.key === "hands";
      const busy = !result.H || result.fresh === false || result.handsLikely || !result.stable || handsShown;
      if (busy) {
        st.held = true;
        st.steadySince = 0;
      } else {
        if (!st.steadySince) st.steadySince = now;
        if (now - st.steadySince >= STEADY_MS) st.held = false;
      }
    }
    el.body.dataset.fcHeld = st.held ? "1" : "0";
  }

  function analysisOf(result) {
    return (result && result.analysis) || null;
  }

  function isRealFence(a) {
    return !!a && a.area >= 1 && a.regionCount === 1 && !a.cornerLeak;
  }

  function statusFor(result, photo) {
    if (!result || !result.H) return { key: "find" };
    // Hands come and go while pieces are placed: once seen, "hands" is held
    // for a moment so the line stays calm instead of flickering.
    const handsShown = st.status && st.status.key === "hands" && performance.now() < st.handsUntil;
    if (!photo && (result.handsLikely || handsShown)) return { key: "hands" };
    if (!photo && !result.stable) {
      // While the view settles again (a piece moved), the board shown is the
      // last steady one: keep describing it rather than flashing "hold steady".
      const held = st.status && !["find", "steady", "starting", "paused", "stopped", "reading", "photoError", "photoFile", "reader"].includes(st.status.key);
      if (!held) return { key: "steady" };
    }
    // A verdict carries the area it shows on the pill, so the number and the
    // line always change together.
    const a = analysisOf(result);
    if (!result.occupied || result.occupied.size === 0 || !a) return { key: "empty", area: 0 };
    if (a.cornerLeak) return { key: "leak", area: a.area };
    if (a.regionCount >= 2) return { key: "pockets", vars: { n: a.regionCount }, area: a.area };
    if (a.area >= 1) return hiddenFor(a.area) ? { key: "fenceCount", area: a.area } : { key: "fence", vars: { n: a.area }, area: a.area };
    return { key: "open", area: 0 };
  }

  const STATUS_TEXT = {
    find: "cam.s.find",
    steady: "cam.s.steady",
    hands: "cam.s.hands",
    empty: "cam.s.empty",
    open: "cam.s.open",
    fence: "cam.s.fence",
    fenceCount: "cam.s.fenceCount",
    leak: "cam.s.leak",
    pockets: "cam.s.pockets",
    paused: "cam.s.paused",
    stopped: "cam.s.stopped",
    tap: "cam.s.tap",
    reading: "cam.s.reading",
    starting: "cam.starting",
    photoError: "cam.err.photo",
    photoFile: "cam.err.photoFile",
    reader: "cam.err.reader",
  };

  function sameStatus(a, b) {
    return !!a && !!b && a.key === b.key && a.area === b.area && JSON.stringify(a.vars || null) === JSON.stringify(b.vars || null);
  }

  // One calm status line: a new message must hold for a moment before it
  // replaces the current one, so flickering detections never chatter.
  function showStatus(next, immediate) {
    if (!next) return;
    const fixed = { paused: "paused", stopped: "stopped", tap: "tap" }[st.mode];
    if (fixed && next.key !== fixed) return;
    // While the board's name is on screen, it is found: never ask for the corners.
    if (next.key === "find" && st.tagBoard && st.status) return;
    const now = performance.now();
    if (sameStatus(next, st.status)) {
      st.pending = null;
      clearTimeout(st.pendingTimer);
      return;
    }
    // Leaving "show the corners" is always good news: no wait.
    if (immediate || !st.status || st.status.key === "find") {
      commitStatus(next);
      return;
    }
    // Once a board was found, a short loss of the corners is not worth a message.
    const dwell = next.key === "find" && st.boardSeen ? FIND_AGAIN_MS : STATUS_DWELL_MS;
    if (!sameStatus(next, st.pending)) {
      st.pending = next;
      st.pendingAt = now;
      clearTimeout(st.pendingTimer);
      const expected = next;
      st.pendingTimer = setTimeout(() => {
        if (sameStatus(st.pending, expected)) commitStatus(expected);
      }, dwell);
      return;
    }
    if (now - st.pendingAt >= dwell) commitStatus(next);
  }

  function commitStatus(next) {
    clearTimeout(st.pendingTimer);
    st.pending = null;
    st.status = next;
    el.body.dataset.fcStatus = next.key;
    // Only a verdict changes the number; "hands" or "hold steady" keep the last one.
    if (typeof next.area === "number" && next.area !== st.shownArea) {
      st.shownArea = next.area;
      if (st.revealed !== next.area) st.revealed = null;
    }
    paintStatus();
    paintArea();
    announceStatus(next);
    if (next.key === "fence" || next.key === "fenceCount") cheer();
  }

  // Screen readers hear a status only when the verdict changes: the passing
  // "hands" and "hold steady" lines are for the eyes, and a verdict that comes
  // back unchanged after a hand has passed is not read out again.
  // "Show the corners" is read only if it lasts, so a board found within a
  // second is announced by its name alone.
  const QUIET_STATUS = new Set(["hands", "steady"]);
  function announceStatus(next) {
    clearTimeout(st.findTimer);
    if (QUIET_STATUS.has(next.key)) return;
    if (next.key === "find") {
      st.findTimer = setTimeout(() => {
        if (st.status === next) sayStatus(next);
      }, FIND_ANNOUNCE_MS);
      return;
    }
    sayStatus(next);
  }

  function sayStatus(next) {
    const sig = next.key + " " + JSON.stringify(next.vars || null);
    if (sig === st.announced) return;
    st.announced = sig;
    say(t(STATUS_TEXT[next.key] || next.key, next.vars));
  }

  // One polite live region for the whole page. Each message is added as a
  // new line, so a message that follows another closely does not cut it off.
  function say(text) {
    if (!el.announce || !text) return;
    const line = document.createElement("span");
    line.textContent = text + " ";
    el.announce.appendChild(line);
    while (el.announce.childNodes.length > 3) el.announce.removeChild(el.announce.firstChild);
  }

  // The first closed fence of a visit gets a short pulse of the neon.
  function cheer() {
    if (st.cheered) return;
    st.cheered = true;
    try {
      sessionStorage.setItem(CHEERED_KEY, "1");
    } catch (e) {
      /* it may simply cheer again next time */
    }
    el.body.dataset.fcCheered = "1";
    if (reduceMotion.matches) return;
    st.cheerAt = performance.now();
    el.pill.classList.remove("cheer");
    void el.pill.offsetWidth;
    el.pill.classList.add("cheer");
    render();
  }

  /* ------------------------------------------------ the board it recognised */

  function boardLabel(boardId) {
    const def = Boards && Boards.get(boardId);
    if (!def) return "";
    if (def.geometry === "measured") return t("cam.board.classic", { w: def.spec.size, h: def.spec.size });
    if (def.lattice === "square") return t("cam.board.square", { w: def.spec.size, h: def.spec.size });
    let n = Boards.geometry(boardId).board.cells.length;
    try {
      n = new Intl.NumberFormat(window.i18n ? window.i18n.get() : "en").format(n);
    } catch (e) {
      n = String(n);
    }
    return t("cam.board.cells", { lattice: t("cam.lattice." + def.lattice), n });
  }

  // Name the board for a moment, so the player knows the right sheet is seen.
  function showBoardTag(boardId) {
    st.tagBoard = boardId;
    el.boardTagName.textContent = boardLabel(boardId);
    say(t("cam.boardFound") + " " + boardLabel(boardId));
    el.boardTag.hidden = false;
    el.boardTag.classList.remove("out");
    el.body.dataset.fcBoardTag = boardId;
    clearTimeout(st.tagTimer);
    st.tagTimer = setTimeout(() => {
      el.boardTag.classList.add("out");
      st.tagTimer = setTimeout(hideBoardTag, 400);
    }, BOARD_TAG_MS);
  }

  function hideBoardTag() {
    clearTimeout(st.tagTimer);
    st.tagBoard = null;
    el.boardTag.hidden = true;
    el.boardTag.classList.remove("out");
  }

  function paintStatus() {
    const s = st.status;
    el.status.textContent = s ? t(STATUS_TEXT[s.key] || s.key, s.vars) : "";
    let tone = "";
    if (s && (s.key === "fence" || s.key === "fenceCount")) tone = "fence";
    else if (s && s.key === "leak") tone = "leak";
    el.status.dataset.tone = tone;
  }

  // In "count first" mode a closed fence's number stays hidden until the
  // player taps it; a number revealed stays revealed while it holds.
  function hiddenFor(area) {
    return st.countFirst && area >= 1 && st.revealed !== area;
  }

  function numberHidden() {
    return hiddenFor(st.shownArea);
  }

  function updateReadout(result, photo) {
    const a = analysisOf(result);
    const b = el.body.dataset;
    b.fcRegions = String(a ? a.regionCount : 0);
    b.fcLeak = a && a.cornerLeak ? "1" : "0";
    b.fcMarkers = String(result && result.quality ? result.quality.markerCount || 0 : 0);
    b.fcBoard = (result && result.boardId) || hint || "";
    if (photo) b.fcStable = "1";
    else if (result) b.fcStable = result.stable ? "1" : "0";
    paintArea();
  }

  // The pill glows only for a closed fence that the line announces, on a steady view.
  function pillLive() {
    return !!st.status && st.status.key === "fence" && !st.held;
  }

  function paintArea() {
    el.body.dataset.fcArea = String(st.shownArea);
    paintPill(pillLive());
  }

  function paintPill(live) {
    const hidden = numberHidden();
    el.pill.classList.toggle("live", !!live && !hidden);
    el.pill.classList.toggle("hiddenNum", hidden);
    const text = hidden ? "?" : String(st.shownArea);
    if (el.areaNum.textContent !== text) {
      el.areaNum.textContent = text;
      if (!hidden && live && !reduceMotion.matches) {
        el.pill.classList.remove("pop");
        void el.pill.offsetWidth;
        el.pill.classList.add("pop");
      }
    }
    // A button only while there is a hidden number to reveal; otherwise it is
    // plain text ("area 3") that the status line already describes.
    if (hidden) {
      el.pill.setAttribute("role", "button");
      el.pill.tabIndex = 0;
      el.pill.setAttribute("aria-label", t("cam.reveal"));
    } else {
      if (document.activeElement === el.pill) el.countBtn.focus({ preventScroll: true });
      el.pill.removeAttribute("role");
      el.pill.removeAttribute("tabindex");
      el.pill.removeAttribute("aria-label");
    }
  }

  function reveal() {
    if (!numberHidden()) return;
    st.revealed = st.shownArea;
    const focused = document.activeElement === el.pill;
    if (st.result) showStatus(statusFor(st.result, st.mode === "photo"), true);
    paintArea();
    if (focused && !el.countBtn.hidden) el.countBtn.focus({ preventScroll: true });
  }

  function setCountFirst(on) {
    st.countFirst = on;
    st.revealed = null;
    el.countBtn.setAttribute("aria-pressed", on ? "true" : "false");
    try {
      localStorage.setItem(COUNT_FIRST_KEY, on ? "1" : "0");
    } catch (e) {
      /* the choice just isn't remembered */
    }
    if (st.result && (st.mode === "live" || st.mode === "photo")) showStatus(statusFor(st.result, st.mode === "photo"), true);
    paintArea();
  }

  /* ------------------------------------------------ continue on the screen */

  // Both live frames and stills carry the whole pieces the core matched to
  // the accepted cells (or none when no set of kit pieces covers them).
  // "Continue on screen" follows steady views only: a hand passing over the
  // board, or a moment of shake, keeps the last steady pieces (and the
  // button as it was); it changes only when a steady view changes the pieces.
  function updatePlacements(result, photo) {
    const boardId = (result && result.boardId) || hint;
    const eligible = !!boardId && CONTINUE_BOARDS.has(boardId);
    el.continueBtn.hidden = !eligible;
    if (st.placementsBoard && result && result.boardId && result.boardId !== st.placementsBoard) {
      st.steadyResult = null;
      setPlacements(null);
    }
    if (!photo && st.held) {
      paintContinue();
      return;
    }
    st.steadyResult = result;
    const whole = eligible && !!result && Array.isArray(result.pieces) && result.pieces.length > 0 && result.piecesComplete !== false;
    setPlacements(whole ? result.pieces : null, whole ? result.boardId : null);
  }

  function setPlacements(placements, boardId) {
    const next = placements
      ? placements.map((p) => ({ typeId: p.typeId, variantIndex: p.variantIndex, marker: Object.assign({}, p.marker) }))
      : null;
    if (JSON.stringify(next) !== JSON.stringify(st.placements)) st.placements = next;
    st.placementsBoard = next ? boardId || null : null;
    paintContinue();
  }

  // Why "Continue on screen" cannot be used yet, or "" when it can. The
  // reason comes from the last steady view too, so it does not flicker.
  function continueReason() {
    if (st.placements) return "";
    const r = st.steadyResult;
    if (!r) return st.result && st.result.boardId ? "wait" : "find";
    if (!r.boardId) return "find";
    return r.occupied && r.occupied.size ? "pieces" : "empty";
  }

  function paintContinue() {
    const why = el.continueBtn.hidden ? "" : continueReason();
    const ok = !el.continueBtn.hidden && !why;
    el.continueBtn.disabled = !ok;
    el.body.dataset.fcContinue = ok ? "1" : "0";
    el.continueWhy.hidden = el.continueBtn.hidden;
    el.continueWhy.dataset.key = why;
    el.continueWhy.textContent = why ? t("cam.why." + why) : "";
  }

  function homeUrl(boardId, paper) {
    const def = boardId && Boards ? Boards.get(boardId) : null;
    if (!def) return "../index.html";
    const home = def.home || {};
    if (home.page === "hub") return "../index.html" + (paper ? "#paper=" + home.card : "");
    return "../" + home.page + "/index.html" + (paper ? "#paper" : "");
  }

  function continueOnScreen() {
    const boardId = st.placementsBoard;
    if (!boardId || !st.placements || continueReason()) return;
    const payload = { boardId, placements: st.placements };
    try {
      sessionStorage.setItem(IMPORT_KEY, JSON.stringify(payload));
    } catch (e) {
      return;
    }
    stopTracks();
    location.href = homeUrl(boardId, true);
  }

  function close() {
    stopTracks();
    let back = null;
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      if (ref && ref.origin === location.origin && !/\/camera\/?/.test(ref.pathname)) back = ref.href;
    } catch (e) {
      back = null;
    }
    if (back && window.history.length > 1) {
      window.history.back();
      return;
    }
    location.href = back || homeUrl(hint, false);
  }

  /* ------------------------------------------------------------- drawing */

  // Give the stage the room left by the top bar and the dock (below it, or
  // beside it on landscape phones).
  function fitStage() {
    const rootStyle = document.documentElement.style;
    const bar = document.querySelector(".topbar").getBoundingClientRect();
    let top = 0;
    let right = 0;
    let bottom = 0;
    rootStyle.setProperty("--dock-top", Math.round(bar.bottom + 4) + "px");
    if (!el.dock.hidden) {
      top = Math.max(0, Math.round(bar.bottom));
      const d = el.dock.getBoundingClientRect();
      if (d.left > 1) {
        // Landscape: the bar and the dock share the right-hand column.
        right = Math.max(0, Math.round(window.innerWidth - d.left));
        top = 0;
      } else {
        // The picture ends above the status line, so the line never hides a
        // corner mark; the line keeps a fixed height, so the picture never jumps.
        const line = el.status.getBoundingClientRect();
        bottom = Math.max(0, Math.round(window.innerHeight - line.top + 6));
      }
    }
    rootStyle.setProperty("--stage-top", top + "px");
    rootStyle.setProperty("--stage-right", right + "px");
    rootStyle.setProperty("--stage-bottom", bottom + "px");
  }

  /* ------------------------------------------------------ photo zoom */

  // The part of a photo worth looking at: the board and its corner marks,
  // with a little room around. null when zooming would barely help.
  function zoomRectFor(result) {
    if (!result || !result.H || !result.boardId || !Boards || !Camera) return null;
    const iw = el.still.width;
    const ih = el.still.height;
    if (!iw || !ih) return null;
    const k = st.frameScale;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const add = (x, y) => {
      if (!isFinite(x) || !isFinite(y)) return;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    };
    for (const [a, b] of boardDrawing(result.boardId).boundary) {
      for (const w of [a, b]) {
        const m = Camera.project(result.H, w);
        add(m.x * k, m.y * k);
      }
    }
    for (const m of result.markers || []) {
      for (const p of (m && m.imageCorners) || []) add(p.x * k, p.y * k);
    }
    if (!(x1 > x0 && y1 > y0)) return null;
    const pad = ZOOM_MARGIN * Math.max(x1 - x0, y1 - y0);
    x0 = Math.max(0, x0 - pad);
    y0 = Math.max(0, y0 - pad);
    x1 = Math.min(iw, x1 + pad);
    y1 = Math.min(ih, y1 + pad);
    const rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    // How much larger the board gets on the stage, compared with the whole photo.
    const cw = el.stage.clientWidth || iw;
    const ch = el.stage.clientHeight || ih;
    const gain = Math.min(cw / rect.w, ch / rect.h) / Math.min(cw / iw, ch / ih);
    return gain >= ZOOM_MIN_GAIN ? rect : null;
  }

  function setZoomRect(rect) {
    st.zoomRect = rect;
    el.zoomBtn.hidden = !rect || st.mode !== "photo";
    el.zoomBtn.setAttribute("aria-pressed", st.zoom ? "true" : "false");
    el.body.dataset.fcZoom = rect && st.zoom && st.mode === "photo" ? "1" : "0";
  }

  function toggleZoom() {
    if (st.mode !== "photo" || !st.zoomRect) return;
    st.zoom = !st.zoom;
    setZoomRect(st.zoomRect);
    render();
  }

  // Where the media is drawn inside the stage (object-fit: contain), or,
  // for a photo zoomed on its board, how it is scaled and cropped. The
  // drawing canvas covers the visible part of the media only.
  function layout() {
    const still = !el.still.hidden;
    const media = still ? el.still : el.video;
    const iw = still ? el.still.width : el.video.videoWidth;
    const ih = still ? el.still.height : el.video.videoHeight;
    const cw = el.stage.clientWidth;
    const ch = el.stage.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    const c = el.overlay;
    const crop = still && st.mode === "photo" && st.zoom ? st.zoomRect : null;
    const ms = el.still.style;
    if (!crop && ms.width) ms.left = ms.top = ms.width = ms.height = "";
    if (!iw || !ih || !cw || !ch || media.hidden) {
      st.view = null;
      c.style.width = c.style.height = "0px";
      return;
    }
    const rx = crop ? crop.x : 0;
    const ry = crop ? crop.y : 0;
    const rw = crop ? crop.w : iw;
    const rh = crop ? crop.h : ih;
    const s = Math.min(cw / rw, ch / rh);
    // Top-left corner of the whole media, in stage pixels (negative when cropped).
    const ox = (cw - rw * s) / 2 - rx * s;
    const oy = (ch - rh * s) / 2 - ry * s;
    const dw = iw * s;
    const dh = ih * s;
    if (crop) {
      ms.left = ox + "px";
      ms.top = oy + "px";
      ms.width = dw + "px";
      ms.height = dh + "px";
    }
    // The visible part of the media.
    const left = Math.max(0, ox);
    const top = Math.max(0, oy);
    const vw = Math.min(cw, ox + dw) - left;
    const vh = Math.min(ch, oy + dh) - top;
    const bw = Math.max(1, Math.round(vw * dpr));
    const bh = Math.max(1, Math.round(vh * dpr));
    const v = st.view;
    if (!v || v.left !== left || v.top !== top || v.vw !== vw || v.vh !== vh || v.dpr !== dpr) {
      c.style.left = left + "px";
      c.style.top = top + "px";
      c.style.width = vw + "px";
      c.style.height = vh + "px";
      if (c.width !== bw) c.width = bw;
      if (c.height !== bh) c.height = bh;
    }
    // Backing pixels per media pixel, and where the media's origin falls on
    // the canvas (exact, so rounding never shifts lines).
    const kx = (s * bw) / vw;
    const ky = (s * bh) / vh;
    st.view = { iw, ih, cw, ch, dpr, s, left, top, vw, vh, kx, ky, ox: (ox - left) * (bw / vw), oy: (oy - top) * (bh / vh) };
  }

  function boardDrawing(boardId) {
    if (st.boardCache.has(boardId)) return st.boardCache.get(boardId);
    const geometry = Boards.geometry(boardId);
    const cells = new Map();
    for (const cell of geometry.board.cells) cells.set(cell.key, cell);
    const drawing = { geometry, cells, boundary: boundaryEdges(geometry.board.cells), sets: new Map() };
    st.boardCache.set(boardId, drawing);
    return drawing;
  }

  // Edges used by exactly one of the given cells: the outline of the set.
  function boundaryEdges(cells) {
    const vkey = (p) => Math.round(p.x * 1000) + "," + Math.round(p.y * 1000);
    const edges = new Map();
    for (const cell of cells) {
      const vs = cell.vertices;
      for (let i = 0; i < vs.length; i += 1) {
        const a = vs[i];
        const b = vs[(i + 1) % vs.length];
        const ka = vkey(a);
        const kb = vkey(b);
        const k = ka < kb ? ka + "|" + kb : kb + "|" + ka;
        const hit = edges.get(k);
        if (hit) hit.n += 1;
        else edges.set(k, { a, b, n: 1 });
      }
    }
    const out = [];
    for (const e of edges.values()) if (e.n === 1) out.push([e.a, e.b]);
    return out;
  }

  function outlineOf(drawing, keys) {
    const sig = [...keys].sort().join(" ");
    let hit = drawing.sets.get(sig);
    if (!hit) {
      const cells = [];
      for (const k of keys) if (drawing.cells.has(k)) cells.push(drawing.cells.get(k));
      hit = boundaryEdges(cells);
      if (drawing.sets.size > 64) drawing.sets.clear();
      drawing.sets.set(sig, hit);
    }
    return hit;
  }

  function render() {
    cancelAnimationFrame(st.anim);
    st.anim = 0;
    layout();
    const c = el.overlay;
    const ctx = c.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const v = st.view;
    if (!v) return;
    const photo = st.mode === "photo";
    const active = st.mode === "live" || photo || (st.frozen && !el.still.hidden);
    if (!active) return;
    const r = st.result;
    // No drawing without a homography read from the paper.
    if (!r || !r.H || !r.boardId || !Boards || !Camera) {
      if (st.mode === "live") drawGuide(ctx, v);
      return;
    }
    // The last steady board over a picture that may have changed: dimmed,
    // without glow, until the next steady view.
    const held = !photo && (st.held || r.fresh === false);
    const drawing = boardDrawing(r.boardId);
    const kx = v.kx * st.frameScale;
    const ky = v.ky * st.frameScale;
    const ox = v.ox;
    const oy = v.oy;
    const H = r.H;
    const memo = new Map();
    const proj = (p) => {
      const k = p.x + "," + p.y;
      let q = memo.get(k);
      if (!q) {
        const m = Camera.project(H, p);
        q = { x: m.x * kx + ox, y: m.y * ky + oy };
        memo.set(k, q);
      }
      return q;
    };
    const px = v.dpr; // one CSS pixel in backing pixels
    const a = analysisOf(r);
    const real = isRealFence(a);
    const glow = real && !held;
    // 0..1 while the first-fence pulse runs (two soft beats), else 0.
    const since = st.cheerAt ? performance.now() - st.cheerAt : Infinity;
    const cheering = since < CHEER_MS && !reduceMotion.matches;
    const boost = cheering && glow ? Math.pow(Math.sin((since / CHEER_MS) * Math.PI * 2), 2) * (1 - (0.4 * since) / CHEER_MS) : 0;
    if (!cheering) st.cheerAt = 0;
    ctx.save();
    ctx.globalAlpha = held ? 0.4 : 1;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // 1. Inside regions: the neon for a real fence, muted tints otherwise.
    if (a && a.area > 0) {
      const regions = a.regions && a.regions.length ? a.regions : [a.enclosedSet];
      regions.forEach((region, i) => {
        const tint = real ? FENCE_TINT : OTHER_TINTS[i % OTHER_TINTS.length];
        const rgb = tint.join(",");
        ctx.save();
        if (glow) {
          ctx.shadowBlur = (16 + 30 * boost) * px;
          ctx.shadowColor = "rgba(" + rgb + ",0.85)";
        }
        ctx.beginPath();
        for (const key of region) {
          const cell = drawing.cells.get(key);
          if (cell) polygon(ctx, cell.vertices.map(proj));
        }
        ctx.fillStyle = "rgba(" + rgb + "," + (real ? 0.5 + 0.32 * boost : 0.26) + ")";
        ctx.fill();
        ctx.restore();
        ctx.save();
        if (!real) ctx.setLineDash([5 * px, 4 * px]);
        strokeEdges(ctx, outlineOf(drawing, region), proj, real ? "rgba(160,255,222,0.95)" : "rgba(" + rgb + ",0.8)", (real ? 2.2 : 1.6) * px);
        ctx.restore();
      });
    }

    // 2. Cells the outside reaches only through a corner.
    if (a && a.leakCells && a.leakCells.size) {
      ctx.save();
      ctx.beginPath();
      for (const key of a.leakCells) {
        const cell = drawing.cells.get(key);
        if (cell) polygon(ctx, cell.vertices.map(proj));
      }
      ctx.fillStyle = "rgba(178,120,255,0.18)";
      ctx.fill();
      ctx.setLineDash([4 * px, 3 * px]);
      strokeEdges(ctx, outlineOf(drawing, a.leakCells), proj, "rgba(210,170,255,0.85)", 1.4 * px);
      ctx.restore();
    }

    // 3. Occupied cells: a thin bright outline, a little inside the cell.
    if (r.occupied && r.occupied.size) {
      ctx.beginPath();
      for (const key of r.occupied) {
        const cell = drawing.cells.get(key);
        if (!cell) continue;
        const cx = cell.centroid.x;
        const cy = cell.centroid.y;
        polygon(ctx, cell.vertices.map((p) => proj({ x: cx + (p.x - cx) * 0.86, y: cy + (p.y - cy) * 0.86 })));
      }
      ctx.strokeStyle = "rgba(7,6,10,0.45)";
      ctx.lineWidth = 3.2 * px;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.lineWidth = 1.4 * px;
      ctx.stroke();
    }

    // 4. The board outline.
    strokeEdges(ctx, drawing.boundary, proj, "rgba(7,6,10,0.4)", 4 * px);
    strokeEdges(ctx, drawing.boundary, proj, "rgba(255,255,255,0.78)", 1.6 * px);

    // 5. Brackets on the corner marks that are seen.
    if (Array.isArray(r.markers)) {
      for (const m of r.markers) {
        if (m && m.imageCorners && m.imageCorners.length === 4) {
          drawBrackets(ctx, m.imageCorners.map((p) => ({ x: p.x * kx + ox, y: p.y * ky + oy })), px);
        }
      }
    }

    // 6. Corner leaks: a ring with a bright core, so it reads by shape too.
    let pulsing = false;
    if (a && a.leakVertices && a.leakVertices.length) {
      const scale = cellScale(drawing, proj);
      const base = Math.max(9 * px, Math.min(18 * px, 0.4 * scale));
      const phase = reduceMotion.matches ? 0 : Math.sin((performance.now() / 1400) * Math.PI * 2);
      pulsing = !reduceMotion.matches;
      for (const w of a.leakVertices) {
        const p = proj(w);
        const rr = base * (1 + 0.14 * phase);
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(7,6,10,0.85)";
        ctx.lineWidth = 5 * px;
        ctx.stroke();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.4 * px;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = "#ff3bd4";
        ctx.fill();
      }
    }
    ctx.restore();
    if (pulsing || cheering) st.anim = requestAnimationFrame(render);
  }

  function polygon(ctx, pts) {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  }

  function strokeEdges(ctx, edges, proj, color, width) {
    ctx.beginPath();
    for (const [p, q] of edges) {
      const a = proj(p);
      const b = proj(q);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  // Typical on-screen size of one cell edge, in backing pixels.
  function cellScale(drawing, proj) {
    const cells = drawing.geometry.board.cells;
    const cell = cells[Math.floor(cells.length / 2)];
    const a = proj(cell.vertices[0]);
    const b = proj(cell.vertices[1]);
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function drawBrackets(ctx, q, px) {
    const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4;
    const cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
    const out = q.map((p) => ({ x: cx + (p.x - cx) * 1.28, y: cy + (p.y - cy) * 1.28 }));
    ctx.beginPath();
    for (let i = 0; i < 4; i += 1) {
      const p = out[i];
      const prev = out[(i + 3) % 4];
      const next = out[(i + 1) % 4];
      ctx.moveTo(p.x + (prev.x - p.x) * 0.26, p.y + (prev.y - p.y) * 0.26);
      ctx.lineTo(p.x, p.y);
      ctx.lineTo(p.x + (next.x - p.x) * 0.26, p.y + (next.y - p.y) * 0.26);
    }
    ctx.strokeStyle = "rgba(7,6,10,0.5)";
    ctx.lineWidth = 4.5 * px;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 2.2 * px;
    ctx.stroke();
  }

  // Before the board is found: four soft corners suggest how to frame it.
  function drawGuide(ctx, v) {
    const w = el.overlay.width;
    const h = el.overlay.height;
    const px = v.dpr;
    const inset = Math.min(w, h) * 0.1;
    const len = Math.min(w, h) * 0.08;
    const x0 = inset;
    const y0 = inset;
    const x1 = w - inset;
    const y1 = h - inset;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, y0 + len); ctx.lineTo(x0, y0); ctx.lineTo(x0 + len, y0);
    ctx.moveTo(x1 - len, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + len);
    ctx.moveTo(x1, y1 - len); ctx.lineTo(x1, y1); ctx.lineTo(x1 - len, y1);
    ctx.moveTo(x0 + len, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - len);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(7,6,10,0.35)";
    ctx.lineWidth = 5 * px;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2.5 * px;
    ctx.stroke();
    ctx.restore();
  }

  /* --------------------------------------------------------------- wiring */

  function translate() {
    document.title = t("cam.pageTitle");
    if (el.metaDescription) el.metaDescription.setAttribute("content", t("cam.metaDescription"));
    if (st.tagBoard) el.boardTagName.textContent = boardLabel(st.tagBoard);
    el.stageLabel.setAttribute("aria-label", t(el.stageLabel.getAttribute("data-i18n-aria-label")));
    if (el.sheetMsg.dataset.key) el.sheetMsg.textContent = t(el.sheetMsg.dataset.key);
    paintStatus();
    paintArea();
    paintContinue();
    paintStartButtons();
  }

  function init() {
    if (hint) {
      el.body.dataset.fcBoard = hint;
      if (hint === "sq20-classic") el.kitLink.hidden = true;
      else el.kitLink.href = "../kit/?board=" + encodeURIComponent(hint);
    }
    el.countBtn.setAttribute("aria-pressed", st.countFirst ? "true" : "false");
    // Keep the button's place from the start, so the picture does not move when it appears.
    el.continueBtn.hidden = !(hint && CONTINUE_BOARDS.has(hint));
    if (framed) {
      el.body.dataset.fcFramed = "1";
      sheetMessage("cam.err.framed");
      el.ownTab.href = location.href;
      el.ownTab.hidden = false;
      showPhotoOption(true);
    } else if (!cameraApi || !Camera) {
      st.cameraError = "cam.err.unsupported";
      sheetMessage("cam.err.unsupported");
      showPhotoOption(true);
    } else if (homeScreenIOS) {
      sheetMessage("cam.err.homeScreen");
      showPhotoOption(true);
    }

    el.startBtn.addEventListener("click", startCamera);
    el.photoBtn.addEventListener("click", pickPhoto);
    el.photoAgainBtn.addEventListener("click", pickPhoto);
    el.useCameraBtn.addEventListener("click", startCamera);
    el.zoomBtn.addEventListener("click", toggleZoom);
    el.photoInput.addEventListener("change", () => analysePhoto(el.photoInput.files && el.photoInput.files[0]));
    el.closeBtn.addEventListener("click", close);
    el.pauseBtn.addEventListener("click", () => (st.mode === "live" ? pause() : resume()));
    el.torchBtn.addEventListener("click", toggleTorch);
    el.countBtn.addEventListener("click", () => setCountFirst(!st.countFirst));
    el.pill.addEventListener("click", reveal);
    el.pill.addEventListener("keydown", (e) => {
      if (el.pill.getAttribute("role") !== "button") return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        reveal();
      }
    });
    // When the browser asks for a tap before the picture plays, any tap on it
    // will do. On a photo, a tap switches between the board and the whole picture.
    el.stage.addEventListener("click", (e) => {
      if (e.target && e.target.closest && e.target.closest("button")) return;
      if (st.mode === "tap") resume();
      else if (st.mode === "photo") toggleZoom();
    });
    el.continueBtn.addEventListener("click", continueOnScreen);
    document.querySelectorAll("[data-lang-btn]").forEach((b) => {
      b.addEventListener("click", () => window.i18n && window.i18n.setLang(b.getAttribute("data-lang-btn")));
    });
    document.addEventListener("fc-langchange", translate);

    const relayout = () => {
      fitStage();
      layout();
      render();
    };
    window.addEventListener("resize", relayout);
    window.addEventListener("orientationchange", relayout);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", relayout);
    el.video.addEventListener("resize", relayout);
    el.video.addEventListener("loadedmetadata", relayout);
    if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", () => render());
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(relayout);
      ro.observe(el.dock);
      ro.observe(document.querySelector(".topbar"));
      ro.observe(el.stage);
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") suspend();
    });
    window.addEventListener("pagehide", suspend);
    window.addEventListener("pageshow", (e) => {
      if (!e.persisted) return;
      if (st.mode === "starting") setMode(st.fromSheet ? "start" : "stopped");
      else if (st.mode === "live" || st.mode === "tap") {
        stopTracks();
        setMode("stopped");
      }
    });

    if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === "function") {
      navigator.mediaDevices.addEventListener("devicechange", checkCameras);
    }

    setMode("start");
    translate();
    checkCameras();

    // Let the camera reader get the hinted board ready while the player reads
    // the sheet, once the page has painted.
    if (hint && Camera && typeof Camera.prepare === "function") {
      requestAnimationFrame(() =>
        setTimeout(() => {
          try {
            Camera.prepare(hint);
          } catch (e) {
            /* the board is then prepared on its first frame */
          }
        }, 0)
      );
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
