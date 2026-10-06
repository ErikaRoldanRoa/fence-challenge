/* Hexomino lab · card texts. `label` and `lines` are source references
 * kept as data attributes for the tests, never shown. Each card: one lead
 * sentence, then detail; app.js appends computed values. */
(function (root) {
  "use strict";
  const i = (s) => "<i>" + s + "</i>";
  const sub = (s, t) => i(s) + "<sub>" + t + "</sub>";
  const MINUS = "−";
  const Ref = sub("A", "ref");
  const D = "Δ";
  const vdef = i("v") + " = " + sub("m", "out") + " " + MINUS + " " + sub("m", "in");

  const CHIPS = {
    area: {
      label: "def:fence", lines: "281-292",
      section: { en: "Fences and their Area", fr: "Les barrières et leur aire", de: "Zäune und ihre Fläche" },
      lead: {
        en: "The area is the number of cells in the largest enclosed region.",
        fr: "L’aire est le nombre de cases de la plus grande région enclose.",
        de: "Die Fläche ist die Zahl der Zellen der größten eingeschlossenen Region.",
      },
      detail: {
        en: "Pieces may not overlap and must hang together edge to edge. Free cells connect even through a corner, so a gap at a corner lets the outside in.",
        fr: "Les pièces ne se chevauchent pas et se tiennent arête contre arête. Les cases libres communiquent même par un coin : une fente en coin laisse entrer l’extérieur.",
        de: "Die Teile überlappen nicht und hängen Kante an Kante zusammen. Freie Zellen hängen auch über Ecken zusammen: Eine Lücke an einer Ecke lässt das Äußere herein.",
      },
    },
    record2025: {
      label: "sec:introduction", lines: "95",
      section: { en: "Introduction", fr: "Introduction", de: "Einleitung" },
      lead: {
        en: "In 2025, the best known hexomino fence enclosed 1586 cells.",
        fr: "En 2025, la meilleure barrière d’hexominos connue enfermait 1586 cases.",
        de: "2025 umschloss der beste bekannte Hexomino-Zaun 1586 Zellen.",
      },
      detail: {
        en: "It was found in the 2025 paper by a subset of the authors. Can you do better?",
        fr: "Elle venait de l’article de 2025, écrit par une partie des auteurs. Feras-tu mieux ?",
        de: "Er stammt aus der Arbeit von 2025, von einem Teil der Autor:innen. Schaffst du mehr?",
      },
    },
    thm1597: {
      label: "thm:1597", lines: "1587-1589, 2054-2188, 2190-2211",
      section: { en: "Hexomino Fence", fr: "La barrière d’hexominos", de: "Der Hexomino-Zaun" },
      lead: {
        en: "No fence of the 35 hexominoes encloses more than <b>1597</b> cells.",
        fr: "Aucune barrière des 35 hexominos n’enferme plus de <b>1597</b> cases.",
        de: "Kein Zaun aus den 35 Hexominos umschließt mehr als <b>1597</b> Zellen.",
      },
      detail: {
        en: "Branch and bound with the Minkowski bound narrows the choices of arrows to 6 candidate multisets; dynamic programming then shows that none reaches 1598.<br>All optimal fences share <b>one</b> multiset of arrows: <b>244</b> optimal reference polygons, about <b>1.49·10<sup>21</sup></b> optimal fences.",
        fr: "La séparation et évaluation, avec la borne de Minkowski, réduit les choix de flèches à 6 multiensembles candidats ; la programmation dynamique montre ensuite qu’aucun n’atteint 1598.<br>Toutes les barrières optimales partagent <b>un seul</b> multiensemble de flèches : <b>244</b> polygones de référence optimaux, environ <b>1,49·10<sup>21</sup></b> barrières optimales.",
        de: "Branch and Bound mit der Minkowski-Schranke engt die Wahl der Pfeile auf 6 Kandidaten-Multimengen ein; dynamische Programmierung zeigt dann, dass keine 1598 erreicht.<br>Alle optimalen Zäune teilen <b>eine</b> Multimenge von Pfeilen: <b>244</b> optimale Referenzpolygone, etwa <b>1,49·10<sup>21</sup></b> optimale Zäune.",
      },
    },
    refvec: {
      label: "def:reference-vector", lines: "1638-1675",
      section: { en: "Reference Vectors", fr: "Vecteurs de référence", de: "Referenzvektoren" },
      lead: {
        en: "Each piece becomes one arrow, from the middle of the edge it shares with the previous piece to the middle of the edge it shares with the next.",
        fr: "Chaque pièce devient une flèche, du milieu de l’arête partagée avec la pièce précédente au milieu de celle partagée avec la suivante.",
        de: "Jedes Teil wird zu einem Pfeil, von der Mitte der Kante zum vorigen Teil zur Mitte der Kante zum nächsten.",
      },
      detail: {
        en: "<b class=\"kBlue\">Reference vector</b> " + vdef + ", between the midpoints of the <b class=\"kRed\">attachment edges</b>.<br><b class=\"kPink\">Correction</b> " + D + ": the signed area of the closed path from " + sub("m", "in") + " along the half attachment edge, the piece’s edges facing the region and the other half attachment edge to " + sub("m", "out") + ", then back along " + MINUS + i("v") + "; usually negative, a multiple of 1/8.<br>Rotation " + i("D") + ": the signed turning angle (counterclockwise positive) from the incoming to the outgoing attachment edge, plus 180°.",
        fr: "<b class=\"kBlue\">Vecteur de référence</b> " + vdef + ", entre les milieux des <b class=\"kRed\">arêtes d’attache</b>.<br><b class=\"kPink\">Correction</b> " + D + " : l’aire signée du chemin fermé qui va de " + sub("m", "in") + " par la demi-arête d’attache, les arêtes de la pièce tournées vers la région et l’autre demi-arête jusqu’à " + sub("m", "out") + ", puis revient le long de " + MINUS + i("v") + " ; en général négative, multiple de 1/8.<br>Rotation " + i("D") + " : l’angle tourné, signé (sens trigonométrique positif), de l’arête d’attache entrante à la sortante, plus 180°.",
        de: "<b class=\"kBlue\">Referenzvektor</b> " + vdef + ", zwischen den Mittelpunkten der <b class=\"kRed\">Anschlusskanten</b>.<br><b class=\"kPink\">Korrektur</b> " + D + ": die vorzeichenbehaftete Fläche des geschlossenen Wegs von " + sub("m", "in") + " über die halbe Anschlusskante, die der Region zugewandten Kanten des Teils und die andere halbe Anschlusskante nach " + sub("m", "out") + ", dann zurück entlang " + MINUS + i("v") + "; meist negativ, ein Vielfaches von 1/8.<br>Drehung " + i("D") + ": der vorzeichenbehaftete Drehwinkel (gegen den Uhrzeigersinn positiv) von der ein- zur ausgehenden Anschlusskante, plus 180°.",
      },
    },
    lemma: {
      label: "lem:area-decomposition", lines: "1686-1690, 1771-1773",
      section: { en: "Reference Vectors", fr: "Vecteurs de référence", de: "Referenzvektoren" },
      lead: {
        en: "Area of the fence = signed area of the arrow polygon + the corrections.",
        fr: "Aire de la barrière = aire signée du polygone des flèches + les corrections.",
        de: "Fläche des Zauns = vorzeichenbehaftete Fläche des Pfeilpolygons + die Korrekturen.",
      },
      detail: {
        en: i("A") + " = " + Ref + " + " + sub(D, "1") + " + … + " + sub(D, "k") + ", where " + Ref + " is the signed area of the reference polygon. The corrections depend only on how each piece is used, not on the order of the pieces.",
        fr: i("A") + " = " + Ref + " + " + sub(D, "1") + " + … + " + sub(D, "k") + ", où " + Ref + " est l’aire signée du polygone de référence. Les corrections ne dépendent que de la façon dont chaque pièce est utilisée, pas de l’ordre des pièces.",
        de: i("A") + " = " + Ref + " + " + sub(D, "1") + " + … + " + sub(D, "k") + ", wobei " + Ref + " die vorzeichenbehaftete Fläche des Referenzpolygons ist. Die Korrekturen hängen nur davon ab, wie jedes Teil verwendet wird, nicht von der Reihenfolge.",
      },
    },
    rotation: {
      label: "eq:rotation-sum", lines: "1707-1722",
      section: { en: "Reference Vectors", fr: "Vecteurs de référence", de: "Referenzvektoren" },
      lead: {
        en: "The turning angles add up to exactly one full turn.",
        fr: "Les angles tournés s’additionnent en exactement un tour complet.",
        de: "Die Drehwinkel ergeben zusammen genau eine volle Drehung.",
      },
      detail: {
        en: sub("D", "1") + " + … + " + sub("D", "k") + " = 360°. Most pieces of a good fence turn by 0°; the four <b class=\"kGold\">corner pieces</b> by +90°.",
        fr: sub("D", "1") + " + … + " + sub("D", "k") + " = 360°. Dans une bonne barrière, la plupart des pièces tournent de 0° ; les quatre <b class=\"kGold\">pièces d’angle</b> de +90°.",
        de: sub("D", "1") + " + … + " + sub("D", "k") + " = 360°. In einem guten Zaun drehen die meisten Teile um 0°, die vier <b class=\"kGold\">Eckteile</b> um +90°.",
      },
    },
    p2: {
      label: "sec:8way", lines: "1790-1815",
      section: { en: "8-Way Partitioning", fr: "Partition en 8 directions", de: "Achtfache Aufteilung" },
      lead: {
        en: "Sorted by direction, arrows with fixed directions make the largest polygon: the convex one.",
        fr: "Triées par direction, des flèches de directions fixées forment le plus grand polygone : le convexe.",
        de: "Nach Richtung sortiert bilden Pfeile mit festen Richtungen das größte Polygon: das konvexe.",
      },
      detail: {
        en: "That is the easy case. In <b>Problem P2</b> each arrow may also take any of its 8 rotations and reflections; choosing them is the hard part, solved by dynamic programming that grows four chains: <b class=\"cNE\">NE</b> · <b class=\"cNW\">NW</b> · <b class=\"cSW\">SW</b> · <b class=\"cSE\">SE</b>.",
        fr: "C’est le cas facile. Dans le <b>problème P2</b>, chaque flèche peut aussi prendre ses 8 rotations et réflexions ; les choisir est la partie difficile, résolue par une programmation dynamique qui fait pousser quatre chaînes : <b class=\"cNE\">NE</b> · <b class=\"cNW\">NO</b> · <b class=\"cSW\">SO</b> · <b class=\"cSE\">SE</b>.",
        de: "Das ist der einfache Fall. In <b>Problem P2</b> darf jeder Pfeil auch jede seiner 8 Drehungen und Spiegelungen annehmen; sie zu wählen ist der schwere Teil, gelöst durch dynamische Programmierung, die vier Ketten wachsen lässt: <b class=\"cNE\">NO</b> · <b class=\"cNW\">NW</b> · <b class=\"cSW\">SW</b> · <b class=\"cSE\">SO</b>.",
      },
    },
    bound: {
      label: "sec:minkowski", lines: "1944-2052",
      section: { en: "An Upper Bound via Minkowski Averages", fr: "Une borne supérieure par moyennes de Minkowski", de: "Eine obere Schranke über Minkowski-Mittel" },
      lead: {
        en: "However these arrows are turned, reflected and ordered, their polygon cannot exceed " + sub("F", "M") + ".",
        fr: "Quelle que soit la façon de tourner, refléter et ordonner ces flèches, leur polygone ne dépasse pas " + sub("F", "M") + ".",
        de: "Wie man diese Pfeile auch dreht, spiegelt und ordnet, ihr Polygon übersteigt " + sub("F", "M") + " nicht.",
      },
      detail: {
        en: sub("F", "M") + " is the area of the Minkowski average of the 8 rotated and reflected copies of the polygon, an upper bound for Problem P2. The bound is often remarkably sharp.",
        fr: sub("F", "M") + " est l’aire de la moyenne de Minkowski des 8 copies tournées et reflétées du polygone, une borne supérieure pour le problème P2. La borne est souvent remarquablement serrée.",
        de: sub("F", "M") + " ist die Fläche des Minkowski-Mittels der 8 gedrehten und gespiegelten Kopien des Polygons, eine obere Schranke für Problem P2. Die Schranke ist oft bemerkenswert scharf.",
      },
    },
  };

  if (typeof module !== "undefined" && module.exports) module.exports = CHIPS;
  else root.HX_CHIPS = CHIPS;
})(typeof window !== "undefined" ? window : globalThis);
