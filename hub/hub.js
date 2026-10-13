/* Fence Challenge · the hub of all the labs: the language switch and the
 * BibTeX copy button. Everything else is plain links. */
(function () {
  "use strict";
  var t = function (k) { return window.i18n ? window.i18n.t(k) : k; };

  document.querySelectorAll("[data-lang-btn]").forEach(function (b) {
    b.addEventListener("click", function () { if (window.i18n) window.i18n.setLang(b.getAttribute("data-lang-btn")); });
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
