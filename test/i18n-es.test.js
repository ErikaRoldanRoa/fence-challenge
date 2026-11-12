/* Spanish on the pages that speak it (the square, hex and triangle labs and the camera), every other page as before.
 *   node test/i18n-es.test.js       (from the repository root)
 * A page names the languages it speaks in <html data-langs="…">; the shared engine (i18n.js) offers and accepts only
 * those, and a page without the attribute speaks French, German and English as always. Checked here: each Spanish page
 * has a Spanish string for every key of its French dictionary and for the shared keys it uses, with the same
 * {placeholders}, Spanish punctuation (¿ ¡) and no em dash; the in-lab camera's own table likewise; the declarations and
 * pickers of every page that loads the engine; the engine's choice of language with and without Spanish. A witness
 * copy of the dictionaries (one key removed, one placeholder renamed) must fail exactly those two checks. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

let count = 0;
const failures = [];
function check(cond, msg) {
  count++;
  if (!cond) { failures.push(msg); console.log("  FAIL " + msg); }
}

const ES_PAGES = ["square-lab", "hex-lab", "triangle-lab", "camera"];
const SAME_AS_EN = new Set(["sq.brand.line"]); // the name and the author, the same in every language

// every page of the site that loads the shared engine
function htmlFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = dir ? dir + "/" + e.name : e.name;
    if (e.isDirectory()) { if (!/^(archive|test|vendor|node_modules|\.git)$/.test(e.name)) out.push(...htmlFiles(rel)); }
    else if (e.name.endsWith(".html")) out.push(rel);
  }
  return out;
}
const ENGINE_PAGES = htmlFiles("").filter((f) => /<script[^>]+src="(\.\.\/)*i18n\.js[?"]/.test(read(f)));

// ---- the dictionaries ----
function engine({ langs = null, stored = null, phone = "en", phones = null, languages, blocked = false } = {}, pageDir = null) {
  const store = new Map();
  if (stored) store.set("fc-lang", stored);
  const events = [];
  const html = { lang: "", getAttribute: (a) => (a === "data-langs" ? langs : null) };
  const doc = { readyState: "complete", documentElement: html, querySelectorAll: () => [], addEventListener() {}, dispatchEvent: (e) => events.push(e) };
  const ctx = vm.createContext({
    window: {}, document: doc, console,
    navigator: { language: phones ? phones[0] : phone, languages: languages !== undefined ? languages : phones || [phone] },
    localStorage: blocked ? { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } }
      : { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; },
  });
  vm.runInContext(read("i18n.js") + "\n;this.DICT = DICT;", ctx, { filename: "i18n.js" });
  if (pageDir) vm.runInContext(read(pageDir + "/i18n.js"), ctx, { filename: pageDir + "/i18n.js" });
  return { i18n: ctx.window.i18n, DICT: ctx.DICT, store, events, html };
}
function ownDict(pageDir) { // the page's own keys, apart from the shared ones
  const ctx = vm.createContext({ console });
  vm.runInContext("var DICT = {fr: {}, de: {}, en: {}};\n" + read(pageDir + "/i18n.js") + "\n;this.DICT = DICT;", ctx, { filename: pageDir + "/i18n.js" });
  return ctx.DICT;
}
function inboardStrings() {
  const src = read("camera/inboard.js");
  const m = src.match(/const STRINGS = (\{[\s\S]*?\n  \});/);
  const nb = src.match(/const NB = "([^"]*)";/);
  return vm.runInNewContext("(" + m[1] + ")", { NB: nb ? nb[1] : " " });
}
// the shared keys a page names in its HTML and scripts (keys built at run time are the page's own)
function sharedKeysUsed(pageDir, shared) {
  let src = read(pageDir + "/index.html");
  for (const f of fs.readdirSync(path.join(ROOT, pageDir))) if (f.endsWith(".js") && f !== "i18n.js") src += read(pageDir + "/" + f);
  const used = new Set();
  for (const m of src.matchAll(/data-(?:i18n(?:-[a-z-]+)?|arm)="([^"]+)"/g)) used.add(m[1]);
  for (const m of src.matchAll(/\bt\(\s*["']([a-zA-Z0-9_.]+)["']/g)) used.add(m[1]);
  return [...used].filter((k) => k in shared);
}

const PH = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(" ");
function audit(name, fr, en, es) { // failures, as messages
  const out = [];
  for (const k of Object.keys(fr)) {
    if (!(k in es)) { out.push(`${name}: no Spanish for ${k}`); continue; }
    const v = String(es[k]);
    if (PH(v) !== PH(fr[k])) out.push(`${name} ${k}: placeholders «${PH(v)}», French «${PH(fr[k])}»`);
    if (en && v === en[k] && !SAME_AS_EN.has(k)) out.push(`${name} ${k}: the Spanish is the English («${v}»)`);
    if (/\u2014/.test(v)) out.push(`${name} ${k}: an em dash`);
    if (/!/.test(v) && !/¡/.test(v)) out.push(`${name} ${k}: « ! » without « ¡ »`);
    const q = v.replace(/«\?»/g, "");
    if (/\?/.test(q) && !/¿/.test(q)) out.push(`${name} ${k}: « ? » without « ¿ »`);
    if (!v.trim()) out.push(`${name} ${k}: empty`);
  }
  for (const k of Object.keys(es)) if (!(k in fr)) out.push(`${name}: Spanish key ${k} has no French`);
  return out;
}

const base = engine().DICT;
const baseEs = base.es || {};
check(Object.keys(baseEs).length > 0, "the shared dictionary has a Spanish part");
const sharedEs = {};
for (const k of Object.keys(base.en)) if (k.startsWith("common.")) sharedEs[k] = true;
for (const p of ES_PAGES) {
  const d = ownDict(p);
  check(Object.keys(d.fr).length > 20, `${p}: its French dictionary is read (${Object.keys(d.fr).length} keys)`);
  for (const f of audit(p, d.fr, d.en, d.es || {})) check(false, f);
  for (const k of new Set([...Object.keys(d.en || {}), ...Object.keys(d.de || {})])) if (!(k in d.fr) && !(k in (d.es || {}))) check(false, `${p}: no Spanish for ${k}, a key of the English or German only`);
  for (const k of sharedKeysUsed(p, base.en)) sharedEs[k] = true;
}
const sharedFr = {}, sharedEn = {};
for (const k of Object.keys(sharedEs)) { sharedFr[k] = base.fr[k]; sharedEn[k] = base.en[k]; }
check(Object.keys(sharedFr).length >= 8, `the shared keys of the Spanish pages are found (${Object.keys(sharedFr).join(", ")})`);
const sharedOnlyEs = {};
for (const k of Object.keys(sharedFr)) if (k in baseEs) sharedOnlyEs[k] = baseEs[k];
for (const f of audit("shared", sharedFr, sharedEn, sharedOnlyEs)) check(false, f);
for (const k of Object.keys(baseEs)) check(k in sharedFr, `shared: the Spanish key ${k} is one a Spanish page uses`);

const IB = inboardStrings();
check(IB.es && Object.keys(IB.fr).length >= 10, `the in-lab camera's table has Spanish (${IB.es ? Object.keys(IB.es).length : 0} of ${Object.keys(IB.fr).length})`);
for (const f of audit("camera/inboard.js", IB.fr, IB.en, IB.es || {})) check(false, f);
for (const k of new Set([...Object.keys(IB.en || {}), ...Object.keys(IB.de || {})])) if (!(k in IB.fr) && !(k in (IB.es || {}))) check(false, `camera/inboard.js: no Spanish for ${k}, a key of the English or German only`);

// the witness: one key removed, one placeholder renamed; exactly those two must fail
{
  const d = ownDict("square-lab");
  const es = Object.assign({}, d.es || {});
  if (es["sq.s.moved"] && es["sq.t.count"]) {
    delete es["sq.s.moved"];
    es["sq.t.count"] = es["sq.t.count"].replace("{all}", "{todas}");
    const got = audit("witness", d.fr, d.en, es);
    check(got.length === 2 && got.some((f) => f.includes("sq.s.moved")) && got.some((f) => f.includes("sq.t.count")), `the witness fails exactly its two changes (${got.join(" | ")})`);
  } else check(false, "the witness: the square lab has no Spanish to change");
}

// ---- the declarations and pickers ----
check(ENGINE_PAGES.length >= 10, `the pages that load the engine are found (${ENGINE_PAGES.length})`);
for (const f of ENGINE_PAGES) {
  const src = read(f), dir = path.dirname(f);
  const htmlTag = (src.match(/<html\b[^>]*>/) || [""])[0];
  const decl = (htmlTag.match(/\bdata-langs="([^"]*)"/) || [null, null])[1];
  const buttons = [...src.matchAll(/<button\b[^>]*\bdata-lang-btn="(\w+)"[^>]*>/g)];
  const codes = buttons.map((b) => b[1]);
  if (ES_PAGES.includes(dir)) {
    check(decl === "fr de en es", `${f}: declares « fr de en es » (${decl})`);
    check(codes.join(" ") === "fr de en es", `${f}: its picker is FR DE EN ES (${codes.join(" ")})`);
    const esBtn = buttons.find((b) => b[1] === "es");
    check(esBtn && /\blang="es"/.test(esBtn[0]) && />ES<\/button>/.test(src.slice(esBtn.index, esBtn.index + esBtn[0].length + 12)), `${f}: the ES button is marked lang="es" and reads ES`);
  } else {
    check(decl === null || !/\bes\b/.test(decl), `${f}: does not declare Spanish (${decl})`);
    check(!codes.includes("es"), `${f}: no ES button`);
  }
}

// ---- the engine ----
const SQ = "square-lab";
{
  const e = engine({});
  check(JSON.stringify(e.i18n.SUPPORTED) === '["fr","de","en"]', `a page without data-langs speaks fr de en (${e.i18n.SUPPORTED})`);
}
{
  const e = engine({ langs: "fr de en es", stored: "es" }, SQ);
  check(e.i18n.get() === "es" && e.html.lang === "es", `Spanish page, Spanish stored: Spanish (${e.i18n.get()}, lang ${e.html.lang})`);
  check(e.i18n.t("sq.t.case") === "Vitrina de trofeos" && e.i18n.t("common.clear") === "Borrar", `Spanish page in Spanish: its strings and the shared ones (${e.i18n.t("sq.t.case")}, ${e.i18n.t("common.clear")})`);
}
{
  const e = engine({ stored: "es", phone: "en-GB" });
  check(e.i18n.get() === "en" && e.store.get("fc-lang") === "es", `page without Spanish, Spanish stored: English, and the stored choice kept (${e.i18n.get()}, ${e.store.get("fc-lang")})`);
}
{
  const e = engine({ stored: "es", phone: "es-ES" });
  check(e.i18n.get() === "en", `page without Spanish, Spanish stored, phone in Spanish: English (${e.i18n.get()})`);
}
{
  const e = engine({ stored: "es", phone: "fr-CH" });
  check(e.i18n.get() === "fr" && e.store.get("fc-lang") === "es", `page without Spanish, Spanish stored, phone in French: French, the choice kept (${e.i18n.get()})`);
}
for (const [phones, onEs, onOther] of [[["ca-ES", "es-ES", "en"], "es", "en"], [["eu", "es"], "es", "en"], [["it-IT", "fr-FR"], "fr", "fr"], [["pt-BR"], "en", "en"], [["gl-ES", "en-GB", "es"], "en", "en"]]) {
  const a = engine({ langs: "fr de en es", phones }, SQ), b = engine({ phones });
  check(a.i18n.get() === onEs && b.i18n.get() === onOther, `phone languages ${phones.join(",")}: ${onEs} on a Spanish page, ${onOther} elsewhere (${a.i18n.get()}, ${b.i18n.get()})`);
}
for (const [phone, want] of [["es-ES", "es"], ["es-MX", "es"], ["es", "es"], ["ca-ES", "en"], ["de-CH", "de"], ["fr", "fr"]]) {
  const e = engine({ langs: "fr de en es", phone }, SQ);
  check(e.i18n.get() === want && e.store.size === 0, `Spanish page, nothing stored, phone ${phone}: ${want}, nothing written (${e.i18n.get()})`);
}
{
  const e = engine({ phone: "es-ES" });
  check(e.i18n.get() === "en", `page without Spanish, phone in Spanish: English (${e.i18n.get()})`);
}
{
  const e = engine({ langs: "fr de en es", stored: "de", phone: "es-ES" }, SQ);
  check(e.i18n.get() === "de", `Spanish page, German stored, phone in Spanish: German, the choice wins (${e.i18n.get()})`);
}
{
  const e = engine({ phone: "en" });
  e.i18n.setLang("es");
  check(e.i18n.get() === "en" && e.store.size === 0 && e.events.length === 0, `page without Spanish: setLang("es") changes nothing, writes nothing, fires nothing (${e.i18n.get()}, ${e.store.size}, ${e.events.length})`);
}
{
  const e = engine({ langs: "fr de en es", phone: "en" }, SQ);
  e.i18n.setLang("es");
  check(e.i18n.get() === "es" && e.store.get("fc-lang") === "es" && e.events.length === 1 && e.events[0].detail.lang === "es", `Spanish page: setLang("es") switches, stores, fires once (${e.i18n.get()}, ${e.store.get("fc-lang")}, ${e.events.length})`);
}
{
  const e = engine({ langs: "  fr de\ten es xx ", phone: "es" }, SQ);
  check(JSON.stringify(e.i18n.SUPPORTED) === '["fr","de","en","es"]' && e.i18n.get() === "es", `the declaration is read through extra spaces, and a language with no dictionary is left out (${e.i18n.SUPPORTED})`);
}
{
  const e = engine({ langs: "xx toString constructor __proto__", phone: "fr" });
  check(JSON.stringify(e.i18n.SUPPORTED) === '["fr","de","en"]', `a declaration with no known language falls back to fr de en (${e.i18n.SUPPORTED})`);
}

{
  const e = engine({ langs: "fr de en es", phones: ["es-ES"], blocked: true }, SQ);
  const first = e.i18n.get();
  let threw = false;
  try { e.i18n.setLang("fr"); } catch (err) { threw = true; }
  check(first === "es" && !threw && e.i18n.get() === "fr", `storage blocked: the phone's language (${first}), and a tap still switches, without an error (${e.i18n.get()})`);
}
for (const languages of [[], null]) {
  const e = engine({ langs: "fr de en es", phone: "es-AR", languages }, SQ);
  check(e.i18n.get() === "es", `no list of the phone's languages (${JSON.stringify(languages)}): its one language, Spanish (${e.i18n.get()})`);
}
for (const [phones, langs, want] of [[["frr-DE", "de-DE"], null, "de"], [["esu"], "fr de en es", "en"], [["es_ES"], "fr de en es", "es"]]) {
  const e = engine({ langs, phones }, langs ? SQ : null);
  check(e.i18n.get() === want, `phone languages ${phones.join(",")}: ${want}, a language being the two letters before the region (${e.i18n.get()})`);
}
{
  const a = engine({ langs: "fr de en es", phone: "es" }, SQ), b = engine({ phone: "fr" });
  const safe = (e, k) => { try { return e.i18n.t(k); } catch (err) { return "threw"; } };
  const keys = ["constructor", "toString", "__proto__", "hasOwnProperty"];
  check(keys.every((k) => safe(a, k) === k && safe(b, k) === k), `a key named like a property of every object is an unknown key (${keys.map((k) => safe(a, k)).join(", ")})`);
}

console.log(failures.length ? `i18n-es: ${failures.length} of ${count} assertions failed` : `i18n-es: all ${count} assertions passed`);
process.exit(failures.length ? 1 : 0);
