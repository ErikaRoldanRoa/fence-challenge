/* Fence Challenge · the hub of all the labs: the words in the reader's
 * language, the language switch, the tiles' bubbles and their turn on touch
 * screens, the manual drawer and its paper doors, the BibTeX copy button. */
(function () {
  "use strict";
  var t = function (k) { return window.i18n ? window.i18n.t(k) : k; };

  // Loaded at the end of the body, before the first paint: the words go in now.
  if (window.i18n) window.i18n.apply(document);
  document.documentElement.classList.remove("i18n-wait");

  // A mission's title (the first hub's own string): its number shows on the
  // tile, its name is read out to screen readers only.
  function doors() {
    document.querySelectorAll(".dname[data-door]").forEach(function (el) {
      var parts = t(el.getAttribute("data-door")).split(" · ");
      if (parts.length !== 2) { el.textContent = parts.join(" · "); return; }
      var k = document.createElement("span"), n = document.createElement("span");
      k.className = "kicker"; k.textContent = parts[0];
      n.className = "dtitle visually-hidden"; n.textContent = parts[1];
      el.textContent = "";
      el.appendChild(k); el.appendChild(document.createTextNode(" ")); el.appendChild(n);
    });
  }
  doors();
  document.addEventListener("fc-langchange", doors);

  // Each tile's bubble carries the lab's name as its head line.
  function heads() {
    document.querySelectorAll("[data-head]").forEach(function (el) {
      var h = t(el.getAttribute("data-head"));
      el.setAttribute("data-lab-tip-head", h.split(" · ")[0]);
    });
  }
  heads();
  document.addEventListener("fc-langchange", heads);

  // On a touch screen a first tap turns the tile over (its name, one line,
  // Open); a second tap on it opens the lab. A tap elsewhere turns it back.
  // Mouse and keyboard open the lab at once.
  var touch = false;
  document.addEventListener("pointerdown", function (e) { touch = e.pointerType === "touch"; }, true);
  function unflip(except) {
    document.querySelectorAll(".piece.flipped").forEach(function (p) { if (p !== except) p.classList.remove("flipped"); });
  }
  document.querySelectorAll(".piece").forEach(function (p) {
    p.addEventListener("click", function (e) {
      if (!touch || p.classList.contains("flipped")) return;
      e.preventDefault();
      unflip(p);
      p.classList.add("flipped");
      if (window.labTip) window.labTip.hide();
    });
  });
  document.addEventListener("click", function (e) { if (!e.target.closest || !e.target.closest(".piece")) unflip(null); });

  document.querySelectorAll("[data-lang-btn]").forEach(function (b) {
    b.addEventListener("click", function () { if (window.i18n) window.i18n.setLang(b.getAttribute("data-lang-btn")); });
  });


  // The manual: a drawer on the right. Opens on its button, closes on its
  // cross, on Escape and on a click beside it; focus goes in and comes back.
  var btn = document.getElementById("manualBtn"), man = document.getElementById("manual"),
      shut = document.getElementById("manualClose"), scrim = document.getElementById("scrim");
  function setManual(open, paper) {
    man.classList.toggle("open", open);
    if (open) man.removeAttribute("inert"); else man.setAttribute("inert", "");
    scrim.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (window.labTip) window.labTip.hide();
    if (open) shut.focus({ preventScroll: true }); else (back || btn).focus({ preventScroll: true });
    back = null;
    var block = open && paper && document.getElementById(paper);
    if (block) {
      block.open = true;
      man.scrollTop = Math.max(0, block.offsetTop - 56);
      block.classList.remove("flash"); void block.offsetWidth; block.classList.add("flash");
    }
  }
  var back = null;
  if (btn && man) {
    btn.addEventListener("click", function () { setManual(!man.classList.contains("open")); });
    shut.addEventListener("click", function () { setManual(false); });
    // A paper's strip, or its row label on the board, opens the manual there;
    // closing it comes back to that door.
    document.querySelectorAll("[data-paper]").forEach(function (d) {
      d.addEventListener("click", function () { setManual(true, d.getAttribute("data-paper")); back = d; });
    });
    scrim.addEventListener("click", function () { setManual(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && man.classList.contains("open")) setManual(false);
    });
  }

  // A lifted piece rises above its cell: once it has risen, its bubble moves
  // up with it.
  document.querySelectorAll(".slab").forEach(function (s) {
    s.addEventListener("transitionend", function (e) {
      if (e.propertyName === "transform" && window.labTip && window.labTip.place) window.labTip.place();
    });
  });

  var copy = document.getElementById("copy"), bib = document.getElementById("bibtex"), status = document.getElementById("status");
  var timer = 0;
  function done() {
    copy.classList.add("done");
    copy.setAttribute("data-lab-tip", t("mh.copied"));
    copy.setAttribute("aria-label", t("mh.copied"));
    status.textContent = t("mh.copied");
    if (window.labTip) window.labTip.show(copy);
    window.clearTimeout(timer);
    timer = window.setTimeout(function () {
      copy.classList.remove("done");
      copy.setAttribute("data-lab-tip", t("mh.copy"));
      copy.setAttribute("aria-label", t("mh.copy"));
      status.textContent = "";
      if (window.labTip) window.labTip.hide();
    }, 1600);
  }
  // Fallback without the clipboard API: select the text, the reader copies it.
  function select() {
    var r = document.createRange();
    r.selectNodeContents(bib);
    var s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
    try { if (document.execCommand("copy")) { done(); return; } } catch (e) {}
    bib.focus();
  }
  if (copy && bib) {
    copy.addEventListener("click", function () {
      var text = [].map.call(bib.querySelectorAll('.l'), function (l) { return l.textContent; }).join("\n") + "\n";
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, select);
      } else select();
    });
  }
})();
