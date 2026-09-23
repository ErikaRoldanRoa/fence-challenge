/* Fence Challenge · shared strings (FR / DE / EN): common.* and the hub.
 * Each other page adds its own keys from the i18n.js in its folder. */
var DICT = {
 "fr": {
  "common.detectArea": "Mesurer l’aire",
  "common.clear": "Effacer",
  "common.areaLabel": "Aire",
  "common.langLabel": "Langue",
  "hub.citeChip": "♦ LRMR25 · DMVM 2025",
  "hub.citeTip": "Langlois-Rémillard, Müßig, Roldán. Maximale Zäune mit Polyformen. DMVM Mitteilungen 33(3), 187–199, 2025.",
  "hub.sqTitle": "Mission I · Le damier",
  "hub.sqKicker": "Défi 1 · pavage carré",
  "hub.hexTitle": "Mission II · Le nid d’abeilles",
  "hub.hexKicker": "4 tétrahexes · pavage hexagonal",
  "hub.triTitle": "Mission III · Le champ de triangles",
  "hub.triKicker": "3 hexiamonds · pavage triangulaire",
  "hub.goalTip": "Enclos la plus grande aire possible.",
  "hub.goalAria": "But de la mission",
  "hub.rotateTip": "Tourne la pièce choisie (touche R)",
  "hub.rotateAria": "Tourne la pièce choisie",
  "hub.flipTip": "Retourne la pièce choisie (touche F)",
  "hub.flipAria": "Retourne la pièce choisie",
  "hub.resetTip": "Efface la barrière",
  "hub.resetAria": "Efface la barrière",
  "hub.helpAria": "Comment jouer",
  "hub.helpSq": "Choisis une pièce, glisse-la en place. ⟳ tourne, ⇄ retourne, touche-la pour l’enlever. Ferme la barrière pour enclore une aire.",
  "hub.helpHex": "Choisis une pièce, glisse-la en place. ⟳ tourne, ⇄ retourne, touche-la pour l’enlever. Ferme la barrière pour enclore une aire.",
  "hub.helpTri": "Choisis une pièce, glisse-la en place. ⟳ tourne, ⇄ retourne, touche-la pour l’enlever. Ferme la barrière pour enclore une aire.",
  "hub.launchSqTip": "Ferme une barrière ici (aire ≥ 1) pour ouvrir le labo du Défi 2 · 12 pentominos",
  "hub.launchSqAria": "Ouvrir le labo du Défi 2",
  "hub.launchHexTip": "Ferme une barrière (aire ≥ 1) pour débloquer",
  "hub.launchHexAria": "Ouvrir le Défi 3",
  "hub.launchTriTip": "Ferme une barrière (aire ≥ 1) pour débloquer",
  "hub.launchTriAria": "Ouvrir le Défi 4",
  "hub.unlockedSq": "Débloqué : ouvre le labo du Défi 2 · 12 pentominos",
  "hub.unlockedHex": "Débloqué : ouvre le labo du Défi 3 · 7 tétrahexes",
  "hub.unlockedTri": "Débloqué : ouvre le labo du Défi 4 · 12 hexiamonds",
  "hub.areaTip": "Aire actuellement enclose sur ton plateau",
  "hub.coinSqTip": "Sur le pavage carré, deux cases peuvent se toucher par un coin sans partager d’arête. Si ta barrière ne se ferme que par un tel coin, l’extérieur se faufile par ce coin : le coin ne ferme rien. Ce témoin s’allume quand ça arrive sur ton plateau.",
  "hub.coinLabel": "fuite par un coin",
  "hub.coinTriTip": "Sur le pavage triangulaire, 6 triangles se rencontrent à chaque coin ; deux d’entre eux peuvent donc s’y toucher sans partager d’arête. Si ta barrière ne se ferme que par un tel coin, l’extérieur se faufile par ce coin : le coin ne ferme rien. Ce témoin s’allume quand ça arrive sur ton plateau.",
  "hub.symmRotateInert": "cette pièce ne change pas quand tu la tournes",
  "hub.symmFlipInert": "dans cette orientation, la pièce est son propre reflet",
  "hub.citeLine": "<strong>Langlois-Rémillard, A., Müßig, M. N., &amp; Roldán, E.</strong> (2025). <em>Maximale Zäune mit Polyformen.</em> Mitteilungen der Deutschen Mathematiker-Vereinigung 33(3), 187–199.",
  "hub.citeMoreEn": "Citation lisible par machine dans",
  "hub.vocPolyform": "Polyforme",
  "hub.defPolyform": "Une forme faite de cases d’un pavage régulier, jointes arête contre arête. Sur les carrés ce sont des polyominos, sur les triangles des polyiamonds, et sur les hexagones des polyhexes.",
  "hub.credit": "par",
  "hub.liveOpen": "{card} : aire {n}.",
  "hub.livePockets": "{card} : aire {n} en {k} intérieurs séparés. Une barrière n’en enferme qu’un.",
  "hub.liveLeak": "{card} : aire {n}, mais l’extérieur se faufile par un coin.",
  "hub.liveFence": "{card} : barrière fermée, aire {n}.",
  "hub.refAria": "Pour aller plus loin",
  "hub.appsAria": "Les trois défis",
  "hub.paperCamera": "Ouvrir la caméra",
  "hub.paperKit": "Imprimer le kit",
  "hub.paperBody": "Imprime un plateau et ses pièces, découpe-les et construis ta barrière sur la table. La caméra de ton téléphone suit tes pièces et allume l’intérieur enclos sur l’image de ton plateau ; l’image reste sur ton appareil.",
  "hub.paperTitle": "Jouer sur papier",
  "hub.camAria": "Jouer sur papier avec la caméra",
  "hub.camTip": "Jouer sur papier : la caméra lit ton plateau imprimé",
  "hub.historyTitle": "Histoire",
  "hub.historyBody": "La ferme de pentominos est un casse-tête classique. F. V. Feser l’a posée en 1968, et Martin Gardner l’a rendue célèbre en 1973 dans sa chronique du Scientific American, en mettant son lectorat au défi de battre sa meilleure barrière. L’informaticien Donald Knuth en avait alors déjà trouvé une plus grande, qu’il avait envoyée directement à Gardner. Takakazu Shimauchi a publié en 1978 la première démonstration complète du maximum.",
  "hub.infoSq": "Ferme une barrière (aire ≥ 1) pour débloquer, puis touche 🚀 pour le défi complet avec 12 pentominos.",
  "hub.infoHex": "Ferme une barrière (aire ≥ 1) pour débloquer, puis touche 🚀 pour le défi complet avec 7 tétrahexes.",
  "hub.infoTri": "Ferme une barrière (aire ≥ 1) pour débloquer, puis touche 🚀 pour le défi complet avec 12 hexiamonds.",
  "hub.infoAria": "Comment débloquer cette carte",
  "hub.vocFence": "Barrière",
  "hub.defFence": "Une barrière, ce sont deux polyformes ou plus qui enferment une aire. Les cases qu’elle laisse libres forment exactement un intérieur et un extérieur, qui ne se touchent jamais, pas même par un coin. Sur les pavages carré et triangulaire, deux cases peuvent se toucher par un coin sans partager d’arête (sur les hexagones, jamais) : la barrière doit donc se fermer arête contre arête. Le but est d’enclore la plus grande aire.",
  "hub.pieceAria": "Pièce {name}",
  "hub.piece.H1": "rhomboid",
  "hub.piece.H2": "shoe",
  "hub.piece.H3": "chevron",
  "hub.chipPublications": "Publications",
  "hub.pubEnglish": "Version anglaise : <em>Extremal fences with polyforms</em>, {arxiv} (2026)."
 },
 "de": {
  "common.detectArea": "Fläche messen",
  "common.clear": "Löschen",
  "common.areaLabel": "Fläche",
  "common.langLabel": "Sprache",
  "hub.citeChip": "♦ LRMR25 · DMVM 2025",
  "hub.citeTip": "Langlois-Rémillard, Müßig, Roldán. Maximale Zäune mit Polyformen. DMVM Mitteilungen 33(3), 187–199, 2025.",
  "hub.sqTitle": "Mission I · Das Schachbrett",
  "hub.sqKicker": "Rätsel 1 · quadratische Parkettierung",
  "hub.hexTitle": "Mission II · Die Bienenwabe",
  "hub.hexKicker": "4 Tetrahexe · hexagonale Parkettierung",
  "hub.triTitle": "Mission III · Das Dreiecksfeld",
  "hub.triKicker": "3 Hexiamonds · dreieckige Parkettierung",
  "hub.goalTip": "Umschließe die größtmögliche Fläche.",
  "hub.goalAria": "Ziel der Mission",
  "hub.rotateTip": "Dreh das gewählte Teil (Taste R)",
  "hub.rotateAria": "Dreh das gewählte Teil",
  "hub.flipTip": "Spiegle das gewählte Teil (Taste F)",
  "hub.flipAria": "Spiegle das gewählte Teil",
  "hub.resetTip": "Lösch den Zaun",
  "hub.resetAria": "Lösch den Zaun",
  "hub.helpAria": "So wird gespielt",
  "hub.helpSq": "Wähle ein Teil, zieh es an seinen Platz. ⟳ dreht, ⇄ spiegelt, tippe es an zum Entfernen. Schließ den Zaun, um eine Fläche einzuschließen.",
  "hub.helpHex": "Wähle ein Teil, zieh es an seinen Platz. ⟳ dreht, ⇄ spiegelt, tippe es an zum Entfernen. Schließ den Zaun, um eine Fläche einzuschließen.",
  "hub.helpTri": "Wähle ein Teil, zieh es an seinen Platz. ⟳ dreht, ⇄ spiegelt, tippe es an zum Entfernen. Schließ den Zaun, um eine Fläche einzuschließen.",
  "hub.launchSqTip": "Schließ hier einen Zaun (Fläche ≥ 1), um das Rätsel-2-Labor zu öffnen · 12 Pentominos",
  "hub.launchSqAria": "Das Rätsel-2-Labor öffnen",
  "hub.launchHexTip": "Schließ einen Zaun (Fläche ≥ 1), um das Labor freizuschalten",
  "hub.launchHexAria": "Rätsel 3 öffnen",
  "hub.launchTriTip": "Schließ einen Zaun (Fläche ≥ 1), um das Labor freizuschalten",
  "hub.launchTriAria": "Rätsel 4 öffnen",
  "hub.unlockedSq": "Freigeschaltet: Öffne das Rätsel-2-Labor · 12 Pentominos",
  "hub.unlockedHex": "Freigeschaltet: Öffne das Rätsel-3-Labor · 7 Tetrahexe",
  "hub.unlockedTri": "Freigeschaltet: Öffne das Rätsel-4-Labor · 12 Hexiamonds",
  "hub.areaTip": "Aktuell auf deinem Spielfeld umschlossene Fläche",
  "hub.coinSqTip": "Auf der quadratischen Parkettierung können sich zwei Felder an einer Ecke berühren, ohne eine Kante zu teilen. Wenn sich dein Zaun nur über eine solche Ecke schließt, schlüpft das Außen durch diese Ecke herein: Die Ecke schließt nichts. Diese Anzeige leuchtet auf, wenn das auf deinem Spielfeld passiert.",
  "hub.coinLabel": "Ecke undicht",
  "hub.coinTriTip": "Auf der dreieckigen Parkettierung treffen an jeder Ecke 6 Dreiecke zusammen, sodass sich zwei von ihnen dort berühren können, ohne eine Kante zu teilen. Wenn sich dein Zaun nur über eine solche Ecke schließt, schlüpft das Außen durch diese Ecke herein: Die Ecke schließt nichts. Diese Anzeige leuchtet auf, wenn das auf deinem Spielfeld passiert.",
  "hub.symmRotateInert": "dieses Teil bleibt bei Drehung unverändert",
  "hub.symmFlipInert": "in dieser Ausrichtung ist das Teil sein eigenes Spiegelbild",
  "hub.citeLine": "<strong>Langlois-Rémillard, A., Müßig, M. N., &amp; Roldán, E.</strong> (2025). <em>Maximale Zäune mit Polyformen.</em> Mitteilungen der Deutschen Mathematiker-Vereinigung 33(3), 187–199.",
  "hub.citeMoreEn": "Maschinenlesbare Zitation in",
  "hub.vocPolyform": "Polyform",
  "hub.defPolyform": "Eine Form aus Feldern einer regulären Parkettierung, Kante an Kante verbunden. Auf Quadraten sind das Polyominos, auf Dreiecken Polyiamonds und auf Sechsecken Polyhexe.",
  "hub.credit": "von",
  "hub.liveOpen": "{card}: Fläche {n}.",
  "hub.livePockets": "{card}: Fläche {n}, verteilt auf {k} getrennte Innenbereiche. Ein Zaun umschließt nur einen.",
  "hub.liveLeak": "{card}: Fläche {n}, aber das Außen schlüpft durch eine Ecke herein.",
  "hub.liveFence": "{card}: Zaun geschlossen, Fläche {n}.",
  "hub.refAria": "Zum Weiterlesen",
  "hub.appsAria": "Die drei Rätsel",
  "hub.paperCamera": "Kamera öffnen",
  "hub.paperKit": "Vorlage drucken",
  "hub.paperBody": "Druck ein Spielfeld und seine Teile aus, schneide die Teile aus und bau deinen Zaun auf dem Tisch. Die Kamera deines Handys folgt den Teilen und lässt den Innenbereich auf dem Bild deines Spielfelds leuchten; das Bild bleibt auf deinem Gerät.",
  "hub.paperTitle": "Auf Papier spielen",
  "hub.camAria": "Mit der Kamera auf Papier spielen",
  "hub.camTip": "Auf Papier spielen: Die Kamera liest dein gedrucktes Spielfeld",
  "hub.historyTitle": "Geschichte",
  "hub.historyBody": "Die Pentomino-Farm ist ein klassisches Rätsel. Sie geht auf F. V. Feser (1968) zurück; Martin Gardner machte sie 1973 in seiner Kolumne im Scientific American berühmt und forderte die Leserschaft heraus, seinen besten Zaun zu übertreffen. Der Informatiker Donald Knuth hatte zu diesem Zeitpunkt bereits einen größeren gefunden und ihn direkt an Gardner geschickt. Takakazu Shimauchi veröffentlichte 1978 den ersten vollständigen Beweis für das Maximum.",
  "hub.infoSq": "Schließ einen Zaun (Fläche ≥ 1), um das Labor freizuschalten, dann tipp auf 🚀 für die volle Herausforderung mit 12 Pentominos.",
  "hub.infoHex": "Schließ einen Zaun (Fläche ≥ 1), um das Labor freizuschalten, dann tipp auf 🚀 für die volle Herausforderung mit 7 Tetrahexen.",
  "hub.infoTri": "Schließ einen Zaun (Fläche ≥ 1), um das Labor freizuschalten, dann tipp auf 🚀 für die volle Herausforderung mit 12 Hexiamonds.",
  "hub.infoAria": "So funktioniert diese Karte",
  "hub.vocFence": "Zaun",
  "hub.defFence": "Ein Zaun besteht aus zwei oder mehr Polyformen, die eine Fläche einschließen. Die freien Felder bilden genau zwei zusammenhängende Bereiche, einen Innenbereich und das Außen, die sich nie berühren, nicht einmal an einer Ecke. Auf der quadratischen und der dreieckigen Parkettierung können sich zwei Felder an einer Ecke berühren, ohne eine Kante zu teilen (auf Sechsecken nie): Der Zaun muss sich deshalb Kante an Kante schließen. Ziel ist es, die größte Fläche einzuschließen.",
  "hub.pieceAria": "Teil {name}",
  "hub.piece.H1": "rhomboid",
  "hub.piece.H2": "shoe",
  "hub.piece.H3": "chevron",
  "hub.chipPublications": "Publikationen",
  "hub.pubEnglish": "Englische Fassung: <em>Extremal fences with polyforms</em>, {arxiv} (2026)."
 },
 "en": {
  "common.detectArea": "Measure area",
  "common.clear": "Clear",
  "common.areaLabel": "Area",
  "common.langLabel": "Language",
  "hub.citeChip": "♦ LRMR25 · DMVM 2025",
  "hub.citeTip": "Langlois-Rémillard, Müßig, Roldán. Maximale Zäune mit Polyformen. DMVM Mitteilungen 33(3), 187–199, 2025.",
  "hub.sqTitle": "Mission I · The chessboard",
  "hub.sqKicker": "Challenge 1 · square tiling",
  "hub.hexTitle": "Mission II · The honeycomb",
  "hub.hexKicker": "4 tetrahexes · hexagonal tiling",
  "hub.triTitle": "Mission III · The field of triangles",
  "hub.triKicker": "3 hexiamonds · triangular tiling",
  "hub.goalTip": "Find the largest area you can enclose.",
  "hub.goalAria": "Goal of the mission",
  "hub.rotateTip": "Rotate the selected piece (R key)",
  "hub.rotateAria": "Rotate the selected piece",
  "hub.flipTip": "Flip the selected piece (F key)",
  "hub.flipAria": "Flip the selected piece",
  "hub.resetTip": "Clear the fence",
  "hub.resetAria": "Clear the fence",
  "hub.helpAria": "How to play",
  "hub.helpSq": "Pick a piece, drag it into place. ⟳ rotates, ⇄ flips, tap it to remove. Close the fence to enclose an area.",
  "hub.helpHex": "Pick a piece, drag it into place. ⟳ rotates, ⇄ flips, tap it to remove. Close the fence to enclose an area.",
  "hub.helpTri": "Pick a piece, drag it into place. ⟳ rotates, ⇄ flips, tap it to remove. Close the fence to enclose an area.",
  "hub.launchSqTip": "Close a fence here (area ≥ 1) to open the Challenge 2 lab · 12 pentominoes",
  "hub.launchSqAria": "Open the Challenge 2 lab",
  "hub.launchHexTip": "Close a fence (area ≥ 1) to unlock",
  "hub.launchHexAria": "Open Challenge 3",
  "hub.launchTriTip": "Close a fence (area ≥ 1) to unlock",
  "hub.launchTriAria": "Open Challenge 4",
  "hub.unlockedSq": "Unlocked: open the Challenge 2 lab · 12 pentominoes",
  "hub.unlockedHex": "Unlocked: open the Challenge 3 lab · 7 tetrahexes",
  "hub.unlockedTri": "Unlocked: open the Challenge 4 lab · 12 hexiamonds",
  "hub.areaTip": "Area currently enclosed on your board",
  "hub.coinSqTip": "On the square tiling, two cells can touch at a corner without sharing an edge. If your fence closes only through such a corner, the outside slips in through it: the corner closes nothing. This indicator lights up when that happens on your board.",
  "hub.coinLabel": "corner leak",
  "hub.coinTriTip": "On the triangular tiling, 6 triangles meet at each corner, so two of them can touch there without sharing an edge. If your fence closes only through such a corner, the outside slips in through it: the corner closes nothing. This indicator lights up when that happens on your board.",
  "hub.symmRotateInert": "this piece is unchanged by rotation",
  "hub.symmFlipInert": "in this orientation, the piece is its own mirror image",
  "hub.citeLine": "<strong>Langlois-Rémillard, A., Müßig, M. N., &amp; Roldán, E.</strong> (2025). <em>Maximale Zäune mit Polyformen.</em> Mitteilungen der Deutschen Mathematiker-Vereinigung 33(3), 187–199.",
  "hub.citeMoreEn": "Machine-readable citation in",
  "hub.vocPolyform": "Polyform",
  "hub.defPolyform": "A shape made of cells of a regular tiling, joined edge to edge. On squares these are polyominoes, on triangles polyiamonds, and on hexagons polyhexes.",
  "hub.credit": "by",
  "hub.liveOpen": "{card}: area {n}.",
  "hub.livePockets": "{card}: area {n} in {k} separate inside regions. A fence encloses just one.",
  "hub.liveLeak": "{card}: area {n}, but the outside slips in through a corner.",
  "hub.liveFence": "{card}: fence closed, area {n}.",
  "hub.refAria": "Going further",
  "hub.appsAria": "The three challenges",
  "hub.paperCamera": "Open the camera",
  "hub.paperKit": "Print the kit",
  "hub.paperBody": "Print a board and its pieces, cut them out and build your fence on the table. Your phone’s camera follows the pieces and lights up the inside on the picture of your board; the picture stays on your device.",
  "hub.paperTitle": "Play on paper",
  "hub.camAria": "Play on paper with the camera",
  "hub.camTip": "Play on paper: the camera reads your printed board",
  "hub.historyTitle": "History",
  "hub.historyBody": "The pentomino farm is a classic puzzle. F. V. Feser posed it in 1968, and Martin Gardner made it famous in his 1973 Scientific American column, daring readers to beat his best fence. By then, the computer scientist Donald Knuth had already found a larger one and sent it straight to Gardner. Takakazu Shimauchi published the first complete proof of the maximum in 1978.",
  "hub.infoSq": "Close a fence (area ≥ 1) to unlock, then tap 🚀 for the full challenge with 12 pentominoes.",
  "hub.infoHex": "Close a fence (area ≥ 1) to unlock, then tap 🚀 for the full challenge with 7 tetrahexes.",
  "hub.infoTri": "Close a fence (area ≥ 1) to unlock, then tap 🚀 for the full challenge with 12 hexiamonds.",
  "hub.infoAria": "How this card works",
  "hub.vocFence": "Fence",
  "hub.defFence": "A fence is two or more polyforms that enclose an area. The cells it leaves free form exactly one inside and one outside, which never touch, not even at a corner. On the square and triangular tilings, two cells can touch at a corner without sharing an edge (on hexagons they never can), so the fence must close edge to edge. The goal is to enclose the largest area.",
  "hub.pieceAria": "Piece {name}",
  "hub.piece.H1": "rhomboid",
  "hub.piece.H2": "shoe",
  "hub.piece.H3": "chevron",
  "hub.chipPublications": "Publications",
  "hub.pubEnglish": "English version: <em>Extremal fences with polyforms</em>, {arxiv} (2026)."
 }
};

/* Fence Challenge · i18n (FR / DE / EN). Self-contained, no dependencies. */
(function () {
  "use strict";
  var SUPPORTED = ["fr", "de", "en"];
  function detect() {
    try { var s = localStorage.getItem("fc-lang"); if (s && SUPPORTED.indexOf(s) >= 0) return s; } catch (e) {}
    var n = (navigator.language || "en").slice(0, 2).toLowerCase();
    return SUPPORTED.indexOf(n) >= 0 ? n : "en";
  }
  var lang = detect();
  function t(key, vars) {
    var s = (DICT[lang] && DICT[lang][key]);
    if (s == null) s = (DICT.en && DICT.en[key]);
    if (s == null) s = key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return (k in vars) ? vars[k] : m; });
    return s;
  }
  function applyAttr(root, attr) {
    var els = root.querySelectorAll("[data-i18n-" + attr + "]");
    for (var i = 0; i < els.length; i++) els[i].setAttribute(attr, t(els[i].getAttribute("data-i18n-" + attr)));
  }
  function apply(root) {
    root = root || document;
    var n = root.querySelectorAll("[data-i18n]"), i;
    for (i = 0; i < n.length; i++) n[i].textContent = t(n[i].getAttribute("data-i18n"));
    ["title", "aria-label", "placeholder", "data-tip"].forEach(function (a) { applyAttr(root, a); });
    if (document.documentElement) document.documentElement.lang = lang;
    var b = document.querySelectorAll("[data-lang-btn]");
    for (i = 0; i < b.length; i++) b[i].setAttribute("aria-pressed", b[i].getAttribute("data-lang-btn") === lang ? "true" : "false");
  }
  function setLang(l) {
    if (SUPPORTED.indexOf(l) < 0) return;
    lang = l;
    try { localStorage.setItem("fc-lang", l); } catch (e) {}
    apply(document);
    document.dispatchEvent(new CustomEvent("fc-langchange", { detail: { lang: l } }));
  }
  window.i18n = { t: t, apply: apply, setLang: setLang, get: function () { return lang; }, SUPPORTED: SUPPORTED };
  if (document.readyState !== "loading") apply(document);
  else document.addEventListener("DOMContentLoaded", function () { apply(document); });
})();
