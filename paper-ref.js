/* Fence Challenge · paper-ref: the labs point into the technical paper by result, never by "the paper".
 *
 * A reference is a key of paper-refs.js (the paper's own LaTeX labels). From it:
 *   PaperRef.label(key)            "Table 4", "Fig. 28", "Thm. 1", "Def. 3", "Lemma 3", "Eq. (13)", "§ 6.3"
 *   PaperRef.pill(key)             a button with that label; it opens the reference
 *   PaperRef.expand(str, mode)     every [[key]] of a string: a pill ("html") or the label ("text")
 *   PaperRef.footer([keys])        a card's footer: the paper's title and the pills
 *   PaperRef.excerpt(key, fn)      a lab shows the data of a result on its page: fn({lang, key}) -> Element | html
 *   PaperRef.open(key, anchor)     what a click on a pill (or on any element with data-ref) does
 * ../i18n.js expands the [[key]] of every string it returns as text, so a string can name a result in a
 * sentence, a bubble or a status line; a lab that writes HTML expands the string itself ("html").
 *
 * The reference opens as a page of the shared math-chip card: above the card the pill was tapped in (with a
 * Back button), or as a card of its own beside the element. It names the result, says where it sits in the
 * paper and on which page, says in a sentence what it shows, shows the data when a lab registered an
 * excerpt, and, once the paper is public (PAPER_REFS.paper.url), links to its page of the paper. */
(function () {
  "use strict";
  var D = window.PAPER_REFS;
  if (!D) return;
  var EXCERPTS = {};
  var TOKEN = /\[\[([a-z]+:[A-Za-z0-9_-]+)\]\]/g;
  // [short, long]: the paper's own words, whatever the language of the page
  var NAMES = {
    table: ["Table", "Table"], figure: ["Fig.", "Figure"], theorem: ["Thm.", "Theorem"], lemma: ["Lemma", "Lemma"],
    definition: ["Def.", "Definition"], equation: ["Eq.", "Equation"], section: ["§", "Section"],
  };

  function lang() { return window.i18n ? window.i18n.get() : "en"; }
  function tr(k, v) { return window.i18n ? window.i18n.t(k, v) : k; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  function has(key) { return !!(D.refs[key] && D.text[key]); }
  function num(r) { return r.kind === "equation" ? "(" + r.num + ")" : r.num; }
  function label(key) { var r = D.refs[key]; return NAMES[r.kind][0] + " " + num(r); }
  function longLabel(key) { var r = D.refs[key]; return NAMES[r.kind][1] + " " + num(r); }
  // "Figure 28, page 39 of the paper: tap to read more"
  function tip(key) { return tr("pr.tip", { what: longLabel(key), page: D.refs[key].page }); }

  // The button that names a result. A section's pill may carry its title ("§ 6.3 The limit shape"), and a pill on a number
  // of a table may say which column it is (o.col): the page brings that column into view. It is a span in the text, not a
  // <button> box, so that it wraps like the words around it; the label (the name and the number) never splits.
  function pill(key, o) {
    if (!has(key)) return esc(key);
    var r = D.refs[key], lab = label(key), ttl = o && o.title && r.title ? r.title : "", tp = esc(tip(key));
    return '<span class="paper-ref" role="button" tabindex="0" data-ref="' + key + '"' + (o && o.col ? ' data-col="' + esc(o.col) + '"' : "") +
      ' data-lab-tip="' + tp + '" title="' + tp + '" aria-label="' + esc(lab + (ttl ? " " + ttl : "") + ", " + tr("pr.page", { p: r.page })) + '">' +
      '<span class="nb">' + esc(lab) + "</span>" + (ttl ? " " + esc(ttl) : "") + "</span>";
  }
  function expand(str, mode) {
    return String(str).replace(TOKEN, function (m, key) {
      if (!has(key)) return m;
      return mode === "html" ? pill(key) : label(key);
    });
  }
  function footer(keys) {
    var ks = (keys || []).filter(has);
    if (!ks.length) return "";
    // the dot stays with what comes before it, so that no line starts with one
    return '<span class="paper-ref-title">' + esc(D.paper.title) + "</span>\u00a0· " +
      ks.map(function (k) { return pill(k, { title: true }); }).join("\u00a0· ");
  }

  function excerptFor(key) {
    var f = EXCERPTS[key];
    if (!f) return null;
    try { return f({ lang: lang(), key: key }) || null; } catch (e) { console.error(e); return null; }
  }
  // The results a section holds, in the paper's order.
  function inside(key) {
    return Object.keys(D.text).filter(function (k) { return D.text[k].in === key; }).sort(function (a, b) {
      return D.refs[a].page - D.refs[b].page || D.refs[a].num.localeCompare(D.refs[b].num, "en", { numeric: true });
    });
  }
  // The content of a reference page, for the shared card (cube-lab/math-chip.js).
  function content(key, col) {
    var r = D.refs[key], x = D.text[key], l = lang();
    var c = {
      focus: col || "",
      kicker: D.paper.title + " · " + tr("pr.page", { p: r.page }).replace(/ (\d+)$/, "\u00a0$1"),   // "page 34" never splits
      title: r.kind === "section" ? longLabel(key) + " · " + r.title : longLabel(key),
      where: x.in ? tr("pr.in") + " " + pill(x.in, { title: true }) : "",
      lead: expand(x[l] || x.en, "html"),
      math: x.math,
      excerpt: excerptFor(key),
      data: { refKey: key },   // data-ref-key: never data-ref, which would make the whole card a pill
    };
    var held = r.kind === "section" ? inside(key) : [];
    if (held.length) c.body = tr("pr.inside") + " " + held.map(function (k) { return pill(k, { title: true }); }).join(" · ");
    if (D.paper.url) c.action = { href: D.paper.url.replace(/#.*$/, "") + "#page=" + r.page, label: tr("pr.open", { p: r.page }) };
    else c.note = tr("pr.soon");
    return c;
  }

  function open(key, anchor) {
    var mc = window.mathChip;
    if (!has(key) || !mc || !mc.show) return false;
    var col = anchor && anchor.getAttribute ? anchor.getAttribute("data-col") : "";
    // The page follows its control: a lab's token names another result when the size changes, and the page open from it follows.
    var fn = function () { var k = anchor && anchor.getAttribute && anchor.getAttribute("data-ref"); return content(k && has(k) ? k : key, col); };
    if (mc.isOpen && mc.isOpen()) {
      // opened from inside the card: Back returns to this very pill
      var sel = '[data-ref="' + key + '"]', host = anchor && anchor.closest ? anchor.closest(".math-pop") : null;
      var i = host ? Array.prototype.indexOf.call(host.querySelectorAll(sel), anchor) : -1;
      mc.push(fn, i >= 0 ? { sel: sel, i: i } : null);
    } else mc.show(anchor || document.body, fn);
    return true;
  }
  // Any element with data-ref opens its reference: the pills, and the labs' own tokens.
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("[data-ref]") : null;
    if (!b || !has(b.getAttribute("data-ref"))) return;
    e.preventDefault();
    e.stopPropagation();
    open(b.getAttribute("data-ref"), b);
  }, true);

  // The pills and the labs' own tokens are spans with a role: Enter and Space open the reference too.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var b = e.target && e.target.closest ? e.target.closest("[data-ref]") : null;
    if (!b || b.tagName === "BUTTON" || !has(b.getAttribute("data-ref"))) return;
    e.preventDefault();
    b.click();
  }, true);

  window.PaperRef = {
    data: D, has: has, label: label, longLabel: longLabel, tip: tip, pill: pill, expand: expand, footer: footer,
    content: content, open: open,
    excerpt: function (key, fn) { EXCERPTS[key] = fn; },
  };
})();
