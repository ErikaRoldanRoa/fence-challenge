/* The labs' references into the technical paper: the registry (paper-refs.js), the labels it makes (paper-ref.js)
 * and every place of the labs that names a result of the paper.
 *   node test/paper-refs.test.js       (from the repository root)
 * What this cannot know is whether the numbers are the paper's: that is checked against the paper's own build by
 * the generator of the registry's numbers (its --check), which lives with the paper and not in this repository. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

let count = 0;
const failures = [];
function check(cond, msg) {
  count++;
  if (!cond) { failures.push(msg); console.log("  FAIL " + msg); }
}

// the component only needs a window, a document that takes listeners, and the translation helper's two functions
global.window = global;
global.document = { addEventListener() {} };
const STR = {
  en: { "pr.tip": "{what}, page {page} of the paper: tap to read more", "pr.page": "page {p}" },
};
window.i18n = { get: () => "en", t: (k, v) => (STR.en[k] || k).replace(/\{(\w+)\}/g, (m, x) => (v && x in v ? v[x] : m)) };
require(path.join(ROOT, "paper-refs.js"));
require(path.join(ROOT, "paper-ref.js"));
const D = window.PAPER_REFS, PR = window.PaperRef;

// ---- the registry itself ----
const keys = Object.keys(D.text), refKeys = Object.keys(D.refs);
check(keys.length > 30, `the registry holds ${keys.length} results`);
check(JSON.stringify(keys.slice().sort()) === JSON.stringify(refKeys.slice().sort()), "every text has its generated number and every number its text");
const KINDS = ["table", "figure", "theorem", "lemma", "definition", "equation", "section"];
const TOKEN = /\[\[([a-z]+:[A-Za-z0-9_-]+)\]\]/g;
// what a visitor is still meant to find must not be written on a page of the registry: the maxima, the counts of optimal fences,
// in whatever way digits are grouped (1597, 1,597, 1.597, 1 597 with a space or a narrow one)
const SPOILER_NUMBERS = ["1597", "1598", "1586", "1588", "5760", "25872", "1331", "1633", "37446", "1489028", "244", "111", "128", "52"];
const plain = (t) => t.replace(/(\d)[ .,\u202f\u00a0\u2009](?=\d{3}(?!\d))/g, "$1");
const SPOILERS = { test: (t) => SPOILER_NUMBERS.some((n) => new RegExp("(^|[^\\d.,])" + n + "(?!\\d)").test(plain(t))) };
check(["1597", "1,597", "1.597", "1 597", "1\u202f597", "5,760", "5.760", "128 cells", "(111)"].every((t) => SPOILERS.test(t)) && !SPOILERS.test("0.128 and 1,5974 and page 35 of 3,520"), "the spoiler check sees every way of writing a maximum and nothing else");
for (const k of keys) {
  const r = D.refs[k], x = D.text[k];
  check(r && KINDS.includes(r.kind), `${k}: a known kind`);
  check(typeof r.num === "string" && r.num.length > 0 && /^[\dab.]+$/.test(r.num), `${k}: a number as the paper prints it (${r && r.num})`);
  check(Number.isInteger(r.page) && r.page >= 1 && r.page <= 80, `${k}: a page (${r && r.page})`);
  if (r.kind === "section") check(typeof r.title === "string" && r.title.length > 2 && !/[$\\{}]/.test(r.title), `${k}: a plain-text section title`);
  if (x.in) {
    check(D.refs[x.in] && D.refs[x.in].kind === "section", `${k}: its place (${x.in}) is a section`);
    check(D.refs[x.in] && D.refs[x.in].page <= r.page, `${k}: on page ${r.page}, not before its section (page ${D.refs[x.in] && D.refs[x.in].page})`);
  }
  // a formula, when the paper has one, is HTML of italics, subscripts and superscripts only, the same in every language
  if (x.math !== undefined) {
    check(typeof x.math === "string" && /^([^<>]|<\/?(i|sub|sup)>)+$/.test(x.math) && !SPOILERS.test(x.math) && !/\u2014/.test(x.math), `${k}: its formula is plain HTML of i, sub and sup: ${x.math}`);
    check(["definition", "lemma", "equation"].includes(r.kind), `${k}: only a definition, a lemma or an equation has a formula`);
  }
  for (const l of ["en", "fr", "de"]) {
    const t = x[l];
    check(typeof t === "string" && t.length > 20, `${k}/${l}: a sentence`);
    check(!/—/.test(t), `${k}/${l}: no em dash`);
    check(!/\b2025\b/.test(t), `${k}/${l}: no year 2025 in a lab`);
    check(!SPOILERS.test(t), `${k}/${l}: no maximum or count of optimal fences written on a reference page`);
    for (const m of t.matchAll(TOKEN)) check(D.text[m[1]], `${k}/${l}: [[${m[1]}]] is a result of the registry`);
  }
}
check(new Set(keys.map((k) => PR.label(k))).size === keys.length, "no two results share a label");

// ---- the labels ----
const L = {
  "tab:heur": ["Table 4", "Table 4"], "fig:deviation": ["Fig. 28", "Figure 28"], "thm:1597": ["Thm. 1", "Theorem 1"], "def:reference-vector": ["Def. 3", "Definition 3"],
  "lem:area-decomposition": ["Lemma 3", "Lemma 3"], "eq:an-asymptot": ["Eq. (13)", "Equation (13)"], "sec:limit": ["§ 6.3", "Section 6.3"],
};
for (const [k, [s, l]] of Object.entries(L)) {
  check(PR.label(k) === s, `${k}: the short label is ${s}: ${PR.label(k)}`);
  check(PR.longLabel(k) === l, `${k}: the long label is ${l}: ${PR.longLabel(k)}`);
}
check(PR.expand("see [[tab:heur]] and [[sec:limit]]", "text") === "see Table 4 and § 6.3", "a token becomes its label in a plain string");
check(/^see <span class="paper-ref" role="button" tabindex="0" data-ref="tab:heur" data-lab-tip="[^"]+" title="[^"]+" aria-label="Table 4, page \d+"><span class="nb">Table 4<\/span><\/span>$/.test(PR.expand("see [[tab:heur]]", "html")) && PR.expand("see [[tab:heur]]", "html").includes("Table 4, page " + D.refs["tab:heur"].page + "\""), "and a pill in HTML, with the page the registry gives: " + PR.expand("see [[tab:heur]]", "html"));
check(PR.expand("a [[nope:key]] b", "text") === "a [[nope:key]] b", "an unknown token is left as it is, where a test sees it");
check(PR.pill("sec:limit", { title: true }).includes('<span class="nb">§ 6.3</span> The limit shape</span>'), "a section's pill may carry its title, the number staying whole");
check(PR.footer(["sec:limit", "fig:chain", "not:there"]).split('class="paper-ref"').length === 3, "a footer keeps the keys it knows");
check(!/ ·/.test(PR.footer(["sec:limit", "fig:chain"]).replace(/\u00a0·/g, "")), "and its dots stay with what comes before them (no line starts with one)");
check(PR.footer(["", "x"]) === "", "and is empty when it knows none");
check(["eq:an-asymptot", "eq:rotation-sum", "eq:cell-cover", "lem:area-decomposition", "def:reference-vector"].every((k) => D.text[k].math), "the equations, the lemma and the definition the labs cite carry their formula");
check(PR.content("sec:limit").body.split("paper-ref").length === 5, "a section page lists the four results it holds: " + PR.content("sec:limit").body);
check(PR.content("fig:deviation").body === undefined && PR.content("eq:an-asymptot").math === D.text["eq:an-asymptot"].math, "a figure page lists nothing; an equation page carries its formula");
check(PR.tip("fig:deviation") === "Figure 28, page " + D.refs["fig:deviation"].page + " of the paper: tap to read more", "the bubble of a pill says what and where: " + PR.tip("fig:deviation"));
const html = PR.expand("[[tab:heur]]", "html");
check(!/["<>&]/.test(PR.label("tab:heur")) && html.includes("&") === false, "labels need no escaping");

// ---- every place of the labs that names a result names one of the registry ----
const FILES = ["limit-shape-lab/app.js", "limit-shape-lab/chips.js", "limit-shape-lab/i18n.js", "limit-shape-lab/index.html",
  "hexomino-lab/app.js", "hexomino-lab/chips.js", "hexomino-lab/i18n.js", "hexomino-lab/index.html",
  "cube-lab/app.js", "cube-lab/index.html", "cube-lab/math-strings.js", "cube-lab/math-chip.js",
  "pentomino-dp-lab/app.js", "pentomino-dp-lab/index.html", "pentomino-dp-lab/i18n.js"];
const used = new Map();
function use(k, where) { if (!used.has(k)) used.set(k, []); used.get(k).push(where); }
for (const f of FILES) {
  const s = read(f);
  for (const m of s.matchAll(TOKEN)) use(m[1], f);
  for (const m of s.matchAll(/data-ref="([^"]+)"/g)) use(m[1], f);
  for (const m of s.matchAll(/data-paper-label="([^"]*)"/g)) m[1].split(/\s+/).filter(Boolean).forEach((k) => use(k, f));
  for (const m of s.matchAll(/(?:pill|excerpt|tip|fenceRef)\(\s*"([a-z]+:[A-Za-z0-9_-]+)"/g)) use(m[1], f);
  for (const m of s.matchAll(/refs: \[([^\]]*)\]/g)) [...m[1].matchAll(/"([^"]+)"/g)].forEach((q) => use(q[1], f));
  for (const m of s.matchAll(/label: "([a-z]+:[^"]*)"/g)) {
    // hexomino cards: the label is the key; the limit lab's lists keep the paper's other labels for the tests
    if (f.startsWith("hexomino-lab")) m[1].split(/[\s,]+/).forEach((k) => use(k, f));
  }
  for (const m of s.matchAll(/FENCE_REF = \{([^}]*)\}/g)) [...m[1].matchAll(/"([^"]+)"/g)].forEach((q) => use(q[1], f));
  for (const m of s.matchAll(/FROM = \{([^}]*)\}/g)) [...m[1].matchAll(/"([a-z]+:[^"]+)"/g)].forEach((q) => q[1].split(/\s+/).forEach((k) => use(k, f)));
  for (const m of s.matchAll(/setAttribute\("data-paper-label", ([^)]*)\)/g)) [...m[1].matchAll(/"([a-z]+:[^"]+)"/g)].forEach((q) => q[1].split(/\s+/).forEach((k) => use(k, f)));
}
for (const [k, where] of used) check(D.text[k], `${k} (used in ${[...new Set(where)].join(", ")}) is a result of the registry`);
const idle = keys.filter((k) => !used.has(k) && !keys.some((o) => D.text[o].in === k || [...D.text[o].en.matchAll(TOKEN)].some((m) => m[1] === k)));
check(idle.length === 0, `every result of the registry is used by a lab: ${idle.join(", ")}`);

// ---- no value is « from the paper » ----
const VAGUE = /"(?:ls\.live\.paper)"|:\s*"(?:from the paper|d’après l’article|laut Artikel)"/;
for (const f of ["limit-shape-lab/i18n.js", "limit-shape-lab/chips.js", "limit-shape-lab/app.js"]) check(!VAGUE.test(read(f)), `${f}: no tag that says « from the paper » and names nothing`);
check(/PAPER = \{ title: "Optimal Polyomino Fences", url: null \}/.test(read("paper-refs.js")), "the paper is not linked until it is public (PAPER.url is null)");
// when it is public, one line gives its address: a full https address of the paper itself, which takes #page=N (not an abstract page)
check(D.paper.url === null || (/^https:\/\/[^\s#]+$/.test(D.paper.url) && !/\/abs\//.test(D.paper.url)), "the paper's address, once set, is a full https address of the paper, not of its abstract page");
// the pill is text that wraps like the words around it: a span with a role, its label never split, nothing that could cover a line above or below
const CSS = read("paper-ref.css");
check(/\.paper-ref \{[^}]*display: inline;/.test(CSS) && !/\.paper-ref::after/.test(CSS) && !/\.paper-ref \{[^}]*white-space: nowrap/.test(CSS), "the pill is inline text with no touch box of its own that reaches into the next line");

if (failures.length) { console.log(`paper-refs: ${failures.length} of ${count} failed`); process.exit(1); }
console.log(`paper-refs: all ${count} assertions passed`);
