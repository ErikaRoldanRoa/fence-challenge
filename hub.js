/* Fence Challenge · hub page: the three cards, their engines, the reference
 * panels, the pieces read by the camera and the tooltips. */
(() => {
  "use strict";

  // Language switch (FR / DE / EN).
  document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
    btn.addEventListener("click", () => i18n.setLang(btn.getAttribute("data-lang-btn")));
  });

  // A board is a fence (the paper's definition) when it encloses some area,
  // in exactly one inside, and no corner lets the outside in.
  function isFence({ area, regionCount, cornerLeak }) {
    return area >= 1 && regionCount === 1 && !cornerLeak;
  }

  // Polite announcements for screen readers: a card's verdict once the
  // board has been still for a moment, and a lab when it unlocks.
  const live = document.getElementById("hubLive");
  const liveTimers = {};
  const liveLast = { sq: "open:0", hex: "open:0", tri: "open:0" };
  const liveUnlocked = {};
  const CARD_TITLE = { sq: "hub.sqTitle", hex: "hub.hexTitle", tri: "hub.triTitle" };
  const CARD_UNLOCKED = { sq: "hub.unlockedSq", hex: "hub.unlockedHex", tri: "hub.unlockedTri" };
  function noteArea(card, info) {
    window.clearTimeout(liveTimers[card]);
    liveTimers[card] = window.setTimeout(() => {
      const vars = { card: i18n.t(CARD_TITLE[card]), n: info.area, k: info.regionCount };
      let key = "hub.liveOpen";
      if (info.cornerLeak) key = "hub.liveLeak";
      else if (info.regionCount > 1) key = "hub.livePockets";
      else if (isFence(info)) key = "hub.liveFence";
      const sig = key + ":" + info.area + ":" + info.regionCount;
      let text = sig === liveLast[card] ? "" : i18n.t(key, vars);
      liveLast[card] = sig;
      if (liveUnlocked[card]) {
        text = (text ? text + " " : "") + i18n.t(CARD_UNLOCKED[card]);
        liveUnlocked[card] = false;
      }
      if (text && live) live.textContent = text;
    }, 900);
  }
  function noteUnlock(card, launch) {
    if (!launch.classList.contains("unlocked")) liveUnlocked[card] = true;
  }


  // Tray chips: the paper's piece name as tooltip and a translated
  // accessible name. The engine's type ids stay as they are (the camera
  // import uses them); only the label shown to the player changes.
  function pieceName(id) {
    const key = "hub.piece." + id;
    const name = i18n.t(key);
    return name === key ? id : name;
  }
  function labelChips(root) {
    root.querySelectorAll(".piece-chip").forEach((chip) => {
      const name = pieceName(chip.dataset.pieceId);
      chip.title = name;
      chip.setAttribute("aria-label", i18n.t("hub.pieceAria", { name }));
    });
  }
  document.addEventListener("fc-langchange", () => {
    document.querySelectorAll(".toyWrap").forEach(labelChips);
  });

  function bindKeyRefresh(root, refresh) {
    document.addEventListener("keydown", (e) => {
      if (!root.matches(":hover") && !root.contains(document.activeElement)) return;
      if (["r", "R", "f", "F", "Delete", "Backspace"].includes(e.key)) {
        setTimeout(refresh, 0); // after the engine's own handler
      }
    });
  }


  (function mountSquareEngine() {
    const root = document.getElementById("engine-sq");
    const areaEl = document.getElementById("area-sq");
    const launch = document.querySelector('[data-launch="sq"]');
    if (!root || !window.PieceEngine || !window.LatticeSquare) return;

    const coin = document.getElementById("coin-sq");
    const coinLab = coin.querySelector(".lab");

    const engine = window.PieceEngine.createPieceEngine({
      root,
      lattice: window.LatticeSquare,
      pieceSet: window.LatticeSquare.TETROMINO_SET,
      board: { size: window.LatticeSquare.BOARD_SIZE_DEFAULT },
      padding: 5, // tighter frame: the 9x9 fills more of the canvas
      callbacks: {
        onArea: (info) => {
          const { area, cornerLeak, regionCount } = info;
          const valid = isFence(info);
          areaEl.textContent = area;
          document.getElementById("pill-sq").classList.toggle("live", valid);
          root.dataset.pockets = regionCount > 1 ? String(regionCount) : "";
          coin.classList.toggle("leak", !!cornerLeak);
          coinLab.textContent = i18n.t("hub.coinLabel");
          if (valid) { noteUnlock("sq", launch); unlock(); }
          noteArea("sq", info);
        },
        onStatus: (msg) => { root.dataset.status = msg; },
        onTrayRendered: () => labelChips(root),
      },
    });
    root._engine = engine;

    function unlock() {
      launch.classList.add("unlocked");
      launch.setAttribute("data-i18n-data-tip", "hub.unlockedSq"); launch.setAttribute("data-tip", i18n.t("hub.unlockedSq"));
      try { localStorage.setItem("unlock-sq", "1"); } catch (e) {}
    }
    try {
      if (localStorage.getItem("unlock-sq") === "1") unlock();
    } catch (e) {}

    const refresh = () => engine.detectArea();
    const canvas = root.querySelector("canvas");
    ["pointerup", "pointercancel"].forEach((t) =>
      canvas.addEventListener(t, refresh));
    root.querySelector("[data-tray]").addEventListener("click", () => {
      setTimeout(refresh, 0);
    });
    bindKeyRefresh(root, refresh);

    document.querySelector('[data-reset="sq"]').addEventListener("click", () => {
      engine.clear();
      engine.detectArea();
    });

    const btnRotate = document.querySelector('[data-rotate="sq"]');
    const btnFlip = document.querySelector('[data-flip="sq"]');

    function flipIsInert() {
      const s = engine.state;
      const piece = s.placedPieces.find((p) => p.id === s.selectedPieceId);
      if (!piece) return false;
      const type = s.pieceTypeMap.get(piece.typeId);
      return !!type && type.flipMap[piece.variantIndex] === piece.variantIndex;
    }
    function rotateIsInert() {
      const s = engine.state;
      const piece = s.placedPieces.find((p) => p.id === s.selectedPieceId);
      if (!piece) return false;
      const type = s.pieceTypeMap.get(piece.typeId);
      return !!type && type.rotateMap[piece.variantIndex] === piece.variantIndex;
    }
    const inertTimers = new WeakMap();
    function reportInert(btn, msg) {
      window.clearTimeout(inertTimers.get(btn));
      btn.classList.remove("inert");
      void btn.offsetWidth; // restart the animation
      btn.classList.add("inert");
      root.dataset.symmetry = msg;
      inertTimers.set(btn, window.setTimeout(() => {
        btn.classList.remove("inert");
      }, 420));
    }

    btnRotate.addEventListener("click", () => {
      const inert = rotateIsInert();
      engine.rotateSelection();
      engine.detectArea();
      if (inert) reportInert(btnRotate, i18n.t("hub.symmRotateInert"));
    });
    btnFlip.addEventListener("click", () => {
      const inert = flipIsInert();
      engine.flipSelection();
      engine.detectArea();
      if (inert) reportInert(btnFlip, i18n.t("hub.symmFlipInert"));
    });
  })();


  (function mountHexEngine() {
    const root = document.getElementById("engine-hex");
    const areaEl = document.getElementById("area-hex");
    const launch = document.querySelector('[data-launch="hex"]');
    if (!root || !window.PieceEngine || !window.LatticeHex) return;

    const engine = window.PieceEngine.createPieceEngine({
      root,
      lattice: window.LatticeHex,
      pieceSet: window.LatticeHex.TETRAHEX_SET,
      board: { radius: window.LatticeHex.BOARD_RADIUS_DEFAULT },
      padding: 5,
      callbacks: {
        onArea: (info) => {
          const { area, regionCount } = info;
          const valid = isFence(info);
          areaEl.textContent = area;
          document.getElementById("pill-hex").classList.toggle("live", valid);
          root.dataset.pockets = regionCount > 1 ? String(regionCount) : "";
          if (valid) { noteUnlock("hex", launch); unlock(); }
          noteArea("hex", info);
        },
        onStatus: (msg) => { root.dataset.status = msg; },
        onTrayRendered: () => labelChips(root),
      },
    });
    root._engine = engine;

    function unlock() {
      launch.classList.add("unlocked");
      launch.setAttribute("data-i18n-data-tip", "hub.unlockedHex"); launch.setAttribute("data-tip", i18n.t("hub.unlockedHex"));
      try { localStorage.setItem("unlock-hex", "1"); } catch (e) {}
    }
    try {
      if (localStorage.getItem("unlock-hex") === "1") unlock();
    } catch (e) {}

    const refresh = () => engine.detectArea();
    const canvas = root.querySelector("canvas");
    ["pointerup", "pointercancel"].forEach((t) => canvas.addEventListener(t, refresh));
    root.querySelector("[data-tray]").addEventListener("click", () => setTimeout(refresh, 0));
    bindKeyRefresh(root, refresh);

    document.querySelector('[data-reset="hex"]').addEventListener("click", () => {
      engine.clear();
      engine.detectArea();
    });

    const btnRotateH = document.querySelector('[data-rotate="hex"]');
    const btnFlipH = document.querySelector('[data-flip="hex"]');
    const inertTimersH = new WeakMap();
    function inertH(kind) {
      const s = engine.state;
      const piece = s.placedPieces.find((p) => p.id === s.selectedPieceId);
      if (!piece) return false;
      const type = s.pieceTypeMap.get(piece.typeId);
      if (!type) return false;
      const map = kind === "rotate" ? type.rotateMap : type.flipMap;
      return map[piece.variantIndex] === piece.variantIndex;
    }
    function reportInertH(btn, msg) {
      window.clearTimeout(inertTimersH.get(btn));
      btn.classList.remove("inert");
      void btn.offsetWidth;
      btn.classList.add("inert");
      root.dataset.symmetry = msg;
      inertTimersH.set(btn, window.setTimeout(() => btn.classList.remove("inert"), 420));
    }
    btnRotateH.addEventListener("click", () => {
      const was = inertH("rotate");
      engine.rotateSelection();
      engine.detectArea();
      if (was) reportInertH(btnRotateH, i18n.t("hub.symmRotateInert"));
    });
    btnFlipH.addEventListener("click", () => {
      const was = inertH("flip");
      engine.flipSelection();
      engine.detectArea();
      if (was) reportInertH(btnFlipH, i18n.t("hub.symmFlipInert"));
    });
  })();


  (function mountTriEngine() {
    const root = document.getElementById("engine-tri");
    const areaEl = document.getElementById("area-tri");
    const launch = document.querySelector('[data-launch="tri"]');
    if (!root || !window.PieceEngine || !window.LatticeTriangular) return;

    const engine = window.PieceEngine.createPieceEngine({
      root,
      lattice: window.LatticeTriangular,
      pieceSet: window.LatticeTriangular.HEXIAMOND_SET,
      board: { hexSide: window.LatticeTriangular.BOARD_HEXSIDE_DEFAULT },
      padding: 5,
      callbacks: {
        onArea: (info) => {
          const { area, cornerLeak, regionCount } = info;
          const valid = isFence(info);
          areaEl.textContent = area;
          document.getElementById("pill-tri").classList.toggle("live", valid);
          document.getElementById("coin-tri").classList.toggle("leak", !!cornerLeak);
          root.dataset.pockets = regionCount > 1 ? String(regionCount) : "";
          if (valid) { noteUnlock("tri", launch); unlock(); }
          noteArea("tri", info);
        },
        onStatus: (msg) => { root.dataset.status = msg; },
        onTrayRendered: () => labelChips(root),
      },
    });
    root._engine = engine;

    function unlock() {
      launch.classList.add("unlocked");
      launch.setAttribute("data-i18n-data-tip", "hub.unlockedTri"); launch.setAttribute("data-tip", i18n.t("hub.unlockedTri"));
      try { localStorage.setItem("unlock-tri", "1"); } catch (e) {}
    }
    try {
      if (localStorage.getItem("unlock-tri") === "1") unlock();
    } catch (e) {}

    const refresh = () => engine.detectArea();
    const canvas = root.querySelector("canvas");
    ["pointerup", "pointercancel"].forEach((t) => canvas.addEventListener(t, refresh));
    root.querySelector("[data-tray]").addEventListener("click", () => setTimeout(refresh, 0));
    bindKeyRefresh(root, refresh);

    document.querySelector('[data-reset="tri"]').addEventListener("click", () => {
      engine.clear();
      engine.detectArea();
    });

    const btnRotateT = document.querySelector('[data-rotate="tri"]');
    const btnFlipT = document.querySelector('[data-flip="tri"]');
    const inertTimersT = new WeakMap();
    function inertT(kind) {
      const s = engine.state;
      const piece = s.placedPieces.find((p) => p.id === s.selectedPieceId);
      if (!piece) return false;
      const type = s.pieceTypeMap.get(piece.typeId);
      if (!type) return false;
      const map = kind === "rotate" ? type.rotateMap : type.flipMap;
      return map[piece.variantIndex] === piece.variantIndex;
    }
    function reportInertT(btn, msg) {
      window.clearTimeout(inertTimersT.get(btn));
      btn.classList.remove("inert");
      void btn.offsetWidth;
      btn.classList.add("inert");
      root.dataset.symmetry = msg;
      inertTimersT.set(btn, window.setTimeout(() => btn.classList.remove("inert"), 420));
    }
    btnRotateT.addEventListener("click", () => {
      const was = inertT("rotate");
      engine.rotateSelection();
      engine.detectArea();
      if (was) reportInertT(btnRotateT, i18n.t("hub.symmRotateInert"));
    });
    btnFlipT.addEventListener("click", () => {
      const was = inertT("flip");
      engine.flipSelection();
      engine.detectArea();
      if (was) reportInertT(btnFlipT, i18n.t("hub.symmFlipInert"));
    });
  })();

  const PANELKEY = { history:"hub.historyBody", fence:"hub.defFence", polyform:"hub.defPolyform" };
  const refChips = document.querySelectorAll("#refChips .refChip");
  const refPanel = document.getElementById("refPanel");
  let activePanel = "polyform";
  function renderPanel() {
    refChips.forEach((c) => c.classList.toggle("on", c.dataset.panel === activePanel));
    if (!window.i18n) return;
    refPanel.classList.toggle("pub", activePanel === "publications");
    if (activePanel === "publications") {
      refPanel.innerHTML =
        '<ul class="pubList">' +
          '<li>' + i18n.t("hub.citeLine") +
            ' <a href="https://doi.org/10.1515/dmvm-2025-0056" target="_blank" rel="noopener">doi:10.1515/dmvm-2025-0056</a>.</li>' +
          '<li>' + i18n.t("hub.pubEnglish", {
            arxiv: '<a href="https://arxiv.org/abs/2607.22379" target="_blank" rel="noopener">arXiv:2607.22379</a>',
          }) + '</li>' +
        '</ul>' +
        '<div class="pubMore">' + i18n.t("hub.citeMoreEn") + ' <a href="https://github.com/ErikaRoldanRoa/fence-challenge/blob/main/CITATION.cff" target="_blank" rel="noopener">CITATION.cff</a>.</div>';
    } else {
      refPanel.textContent = i18n.t(PANELKEY[activePanel]);
    }
  }
  refChips.forEach((c) => c.addEventListener("click", () => { activePanel = c.dataset.panel; renderPanel(); }));
  renderPanel();
  document.addEventListener("fc-langchange", renderPanel);

  // Pieces read from a printed board reach a card in two ways: from the
  // camera page (index.html#paper=<card> with the pieces in sessionStorage)
  // and from the camera opened inside the card. Every piece is checked
  // against this card's own engine before anything changes; anything
  // unexpected leaves the board as it was.
  const PAPER_KEY = "fc-paper-import";
  const LANG_CLEARANCE = 72; // px, matches article.pCard scroll-margin-top
  const PAPER_BOARD = { sq: "sq9", hex: "hex4", tri: "tri4" };
  function checkPlacements(card, boardId, list) {
    const root = document.getElementById("engine-" + card);
    const engine = root && root._engine;
    if (!engine || boardId !== PAPER_BOARD[card]) return null;
    const s = engine.state;
    const lattice = engine.lattice;
    if (!Array.isArray(list) || list.length < 1 || list.length > s.pieceTypes.length) return null;
    const used = new Set();
    const types = new Set();
    const placed = [];
    for (const p of list) {
      if (!p || typeof p !== "object" || typeof p.typeId !== "string") return null;
      const type = s.pieceTypeMap.get(p.typeId);
      if (!type || types.has(p.typeId)) return null;
      if (!Number.isInteger(p.variantIndex) || p.variantIndex < 0) return null;
      const variant = type.variants[p.variantIndex];
      if (!variant || !p.marker || typeof p.marker !== "object") return null;
      const entry = s.board.map.get(lattice.cellKey(p.marker));
      if (!entry || !lattice.markerConstraint(variant, entry)) return null;
      const marker = lattice.bareCell(entry);
      const fields = Object.keys(marker);
      if (Object.keys(p.marker).length !== fields.length) return null;
      if (fields.some((k) => !Number.isInteger(p.marker[k]) || p.marker[k] !== marker[k])) return null;
      for (const rel of variant.cells) {
        const key = lattice.cellKey(lattice.translateCell(rel, marker));
        if (!s.board.map.has(key) || used.has(key)) return null;
        used.add(key);
      }
      types.add(p.typeId);
      placed.push({ id: placed.length + 1, typeId: p.typeId, variantIndex: p.variantIndex, marker });
    }
    return { engine, placed };
  }
  function readPaperPlacements(card, raw) {
    let data;
    try { data = JSON.parse(raw); } catch (e) { return null; }
    if (!data || typeof data !== "object") return null;
    return checkPlacements(card, data.boardId, data.placements);
  }
  function placeOnCard(found) {
    found.engine.setState({ placedPieces: found.placed, selectedPieceId: null });
    found.engine.detectArea();
  }
  function receivePaper() {
    const m = /^#paper=(sq|hex|tri)$/.exec(window.location.hash);
    if (!m) return;
    const card = m[1];
    let raw = null;
    try {
      raw = window.sessionStorage.getItem(PAPER_KEY);
      window.sessionStorage.removeItem(PAPER_KEY);
    } catch (e) { raw = null; }
    try {
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    } catch (e) {}
    const found = raw ? readPaperPlacements(card, raw) : null;
    if (!found) return;
    placeOnCard(found);
    const article = document.getElementById("engine-" + card).closest("article");
    const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Centre the card when it fits below the language switch, otherwise
    // show its top (scroll-margin-top keeps it clear of the switch).
    const room = window.innerHeight - 2 * LANG_CLEARANCE;
    const block = article.getBoundingClientRect().height <= room ? "center" : "start";
    article.scrollIntoView({ block, behavior: still ? "auto" : "smooth" });
    article.classList.remove("arrive");
    void article.offsetWidth; // restart the glow
    article.classList.add("arrive");
    window.setTimeout(() => article.classList.remove("arrive"), 2600);
  }
  receivePaper();
  window.addEventListener("hashchange", receivePaper);

  // The camera inside a card: the small camera icon turns the card's board
  // into the camera window (FenceInboard, loaded with defer after this file)
  // and a second tap closes it. The board keeps the pieces it received.
  // One card films at a time.
  const cams = {};
  let camOpen = null; // card whose camera is on
  function camLabel(card) {
    const btn = cams[card] && cams[card].btn;
    if (!btn) return;
    const on = camOpen === card;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.setAttribute("data-i18n-aria-label", on ? "hub.camClose" : "hub.camAria");
    btn.setAttribute("aria-label", i18n.t(on ? "hub.camClose" : "hub.camAria"));
    btn.setAttribute("data-i18n-data-tip", on ? "hub.camClose" : "hub.camTip");
    btn.setAttribute("data-tip", i18n.t(on ? "hub.camClose" : "hub.camTip"));
    if (tipAnchor === btn) showTip(btn);
  }
  function closeCam(card) {
    const c = cams[card];
    if (!c || !c.session) return;
    const session = c.session;
    c.session = null;
    if (camOpen === card) camOpen = null;
    if (c.observer) { c.observer.disconnect(); c.observer = null; }
    try { session.close(); } catch (e) {}
    camLabel(card);
  }
  function openCam(card) {
    const c = cams[card];
    const root = document.getElementById("engine-" + card);
    const engine = root && root._engine;
    if (!c || !engine || !window.FenceInboard) return;
    if (camOpen && camOpen !== card) closeCam(camOpen);
    const host = root.querySelector(".toy");
    const canvas = root.querySelector("canvas");
    // The engine draws in canvas pixels (world * scale + offset); the camera
    // wants the same point in CSS pixels from the host's padding box.
    const worldToHost = (p) => {
      const v = engine.state.view;
      const cr = canvas.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      const sx = cr.width / (canvas.width || 1);
      const sy = cr.height / (canvas.height || 1);
      return {
        x: cr.left - hr.left - host.clientLeft + (p.x * v.scale + v.offsetX) * sx,
        y: cr.top - hr.top - host.clientTop + (p.y * v.scale + v.offsetY) * sy,
      };
    };
    let session = null;
    const onClose = () => {
      if (c.session === session) {
        c.session = null;
        if (camOpen === card) camOpen = null;
        if (c.observer) { c.observer.disconnect(); c.observer = null; }
        camLabel(card);
      }
    };
    try {
      session = window.FenceInboard.open({
        host,
        boardId: PAPER_BOARD[card],
        worldToHost,
        onPlacements: (placements) => {
          if (c.session !== session) return;
          const found = checkPlacements(card, PAPER_BOARD[card], placements);
          if (found) placeOnCard(found);
        },
        onState: (state) => {
          if (typeof state === "string" && state.indexOf("error") === 0) {
            if (live) live.textContent = i18n.t("hub.camError");
            closeCam(card);
          }
        },
        onClose,
      });
    } catch (e) {
      session = null;
    }
    if (!session) {
      if (live) live.textContent = i18n.t("hub.camError");
      return;
    }
    c.session = session;
    camOpen = card;
    // The board's size follows the card: keep the camera window on it.
    if (typeof ResizeObserver === "function") {
      c.observer = new ResizeObserver(() => { if (c.session) c.session.refresh(); });
      c.observer.observe(host);
    }
    camLabel(card);
  }
  function mountCams() {
    let ok = false;
    try { ok = !!(window.FenceInboard && window.FenceInboard.supported()); } catch (e) { ok = false; }
    document.querySelectorAll("[data-cam]").forEach((btn) => {
      const card = btn.getAttribute("data-cam");
      if (!PAPER_BOARD[card] || !ok) return;
      cams[card] = { btn, session: null, observer: null };
      btn.hidden = false;
      camLabel(card);
      btn.addEventListener("click", () => {
        if (cams[card].session) closeCam(card);
        else openCam(card);
      });
    });
  }

  // Tooltips: one popover shared by every [data-tip], shown on mouse hover,
  // on keyboard focus, or on a tap for elements that do nothing else.
  const tip = document.createElement("div");
  tip.className = "tipPop";
  tip.id = "tipPop";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  document.body.appendChild(tip);
  let tipAnchor = null;
  let lastPointer = "mouse";
  function placeTip(el) {
    const m = 8;
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    tip.style.left = "0px";
    tip.style.top = "0px";
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const pos = el.getAttribute("data-tip-pos") || "";
    let left = r.left + r.width / 2 - w / 2;
    if (/^left/.test(pos)) left = r.left;
    else if (/^right/.test(pos)) left = r.right - w;
    left = Math.max(m, Math.min(left, vw - m - w));
    const above = r.top - 10 - h;
    const below = r.bottom + 10;
    let top = /below/.test(pos) ? below : above;
    if (top === below && below + h > vh - m && above >= m) top = above;
    if (top === above && above < m) top = below;
    tip.style.left = Math.round(left) + "px";
    tip.style.top = Math.round(top) + "px";
  }
  function showTip(el) {
    const text = el.getAttribute("data-tip");
    if (!text) return;
    if (tipAnchor && tipAnchor !== el) tipAnchor.removeAttribute("aria-describedby");
    tipAnchor = el;
    tip.textContent = text;
    tip.hidden = false;
    placeTip(el);
    tip.classList.add("on");
    el.setAttribute("aria-describedby", "tipPop");
  }
  function hideTip() {
    if (tipAnchor) tipAnchor.removeAttribute("aria-describedby");
    tipAnchor = null;
    tip.classList.remove("on");
    tip.hidden = true;
  }
  const tipOf = (target) => (target && target.closest ? target.closest("[data-tip]") : null);
  document.addEventListener("pointerdown", (e) => { lastPointer = e.pointerType || "mouse"; }, true);
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse") return;
    const el = tipOf(e.target);
    if (el && el !== tipAnchor) showTip(el);
  });
  document.addEventListener("pointerout", (e) => {
    if (e.pointerType !== "mouse" || !tipAnchor) return;
    if (tipOf(e.target) === tipAnchor && !tipAnchor.contains(e.relatedTarget)) hideTip();
  });
  document.addEventListener("focusin", (e) => {
    const el = tipOf(e.target);
    if (el && el.matches(":focus-visible")) showTip(el);
  });
  document.addEventListener("focusout", (e) => {
    if (tipAnchor && tipOf(e.target) === tipAnchor) hideTip();
  });
  document.addEventListener("click", (e) => {
    if (lastPointer === "mouse") return;
    const el = tipOf(e.target);
    const passive = el && !el.closest("a[href],button");
    if (passive && el !== tipAnchor) showTip(el);
    else hideTip();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideTip(); });
  window.addEventListener("scroll", hideTip, { passive: true });
  window.addEventListener("resize", hideTip);
  document.addEventListener("fc-langchange", () => { if (tipAnchor) showTip(tipAnchor); });

  // The camera scripts load with defer: they are ready at DOMContentLoaded.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountCams);
  else mountCams();
  document.addEventListener("fc-langchange", () => Object.keys(cams).forEach(camLabel));
})();
