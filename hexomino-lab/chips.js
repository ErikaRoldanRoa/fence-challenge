/* Hexomino lab · card texts. `label` and `lines` are source references
 * kept as data attributes for the tests, never shown. Each card: one lead
 * sentence, then detail; app.js appends computed values. `q` is the
 * chip's question, its bubble and the card's title. */
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
      q: { en: "How is the area counted?", fr: "Comment l’aire est-elle comptée ?", de: "Wie wird die Fläche gezählt?" },
      label: "def:fence", lines: "281-292",
      section: { en: "Fences and their area", fr: "Les barrières et leur aire", de: "Zäune und ihre Fläche" },
      lead: {
        en: "The area is the number of cells in the largest enclosed region.",
        fr: "L’aire est le nombre de cases de la plus grande région enclose.",
        de: "Die Fläche ist die Zahl der Zellen der größten eingeschlossenen Region.",
      },
      detail: {
        en: "Pieces may not overlap and must hang together edge to edge. Free cells connect even through a corner, so a gap at a corner lets the outside in.",
        fr: "Les pièces ne se chevauchent pas et se tiennent arête contre arête. Les cases libres communiquent même par un coin : une fente en coin laisse entrer l’extérieur.",
        de: "Die Teile überlappen nicht und hängen Kante an Kante zusammen. Freie Zellen hängen auch über Ecken zusammen: Eine Lücke an einer Ecke lässt das Äußere herein.",
      },
    },
    recordPrev: {
      q: { en: "What was the best fence before?", fr: "Quelle était la meilleure barrière avant ?", de: "Was war der beste Zaun davor?" },
      label: "sec:introduction", lines: "95",
      section: { en: "Introduction", fr: "Introduction", de: "Einleitung" },
      lead: {
        en: "Before this work, the best known hexomino fence enclosed 1586 cells.",
        fr: "Avant ce travail, la meilleure barrière d’hexominos connue enfermait 1586 cases.",
        de: "Vor dieser Arbeit umschloss der beste bekannte Hexomino-Zaun 1586 Zellen.",
      },
      detail: {
        en: "This is the previous best fence. Can you do better?",
        fr: "C’est la meilleure barrière précédente. Feras-tu mieux ?",
        de: "Das ist der bisher beste Zaun. Schaffst du mehr?",
      },
    },
    thm1597: {
      q: { en: "Why can no fence do better?", fr: "Pourquoi aucune barrière ne fait-elle mieux ?", de: "Warum geht es nicht besser?" },
      label: "thm:1597", lines: "1587-1589, 2054-2188, 2190-2211",
      section: { en: "Hexomino fences", fr: "Les barrières d’hexominos", de: "Hexomino-Zäune" },
      lead: {
        en: "No fence of the 35 hexominoes encloses more than <b>1597</b> cells.",
        fr: "Aucune barrière des 35 hexominos n’enferme plus de <b>1597</b> cases.",
        de: "Kein Zaun aus den 35 Hexominos umschließt mehr als <b>1597</b> Zellen.",
      },
      detail: {
        en: "Branch and bound with the Minkowski bound ([[sec:minkowski]]), then two closing rules (the turns add up to 360°, [[eq:rotation-sum]]; the parity bits to an even number) and a sharper bound for two of the remaining multisets, narrow the choices of arrows down to 6 candidate multisets; dynamic programming then shows that none reaches 1598.<br>All optimal fences use the same arrows, up to turning and reflecting each one: <b>244</b> optimal reference polygons (up to symmetry), about <b>1.49·10<sup>21</sup></b> optimal fences ([[sec:all-6]]).",
        fr: "La séparation et évaluation avec la borne de Minkowski ([[sec:minkowski]]), puis deux règles de fermeture (les angles font 360°, [[eq:rotation-sum]] ; les bits de parité une somme paire) et une borne plus fine pour deux des multiensembles restants, réduisent les choix de flèches à 6 multiensembles candidats ; la programmation dynamique montre ensuite qu’aucun n’atteint 1598.<br>Toutes les barrières optimales utilisent les mêmes flèches, à rotation et retournement près : <b>244</b> polygones de référence optimaux (à symétrie près), environ <b>1,49·10<sup>21</sup></b> barrières optimales ([[sec:all-6]]).",
        de: "Branch and Bound mit der Minkowski-Schranke ([[sec:minkowski]]), danach zwei Schließregeln (die Drehungen ergeben 360°, [[eq:rotation-sum]]; die Paritätsbits eine gerade Summe) und eine schärfere Schranke für zwei der übrigen Multimengen engen die Wahl der Pfeile auf 6 Kandidaten-Multimengen ein; dynamische Programmierung zeigt dann, dass keine 1598 erreicht.<br>Alle optimalen Zäune verwenden dieselben Pfeile, bis auf Drehen und Spiegeln jedes einzelnen: <b>244</b> optimale Referenzpolygone (bis auf Symmetrie), etwa <b>1,49·10<sup>21</sup></b> optimale Zäune ([[sec:all-6]]).",
      },
    },
    refvec: {
      q: { en: "What is a reference vector?", fr: "Qu’est-ce qu’un vecteur de référence ?", de: "Was ist ein Referenzvektor?" },
      label: "def:reference-vector", lines: "1638-1675",
      section: { en: "Reference vectors", fr: "Vecteurs de référence", de: "Referenzvektoren" },
      lead: {
        en: "Each piece becomes one arrow, from the middle of the edge it shares with the previous piece to the middle of the edge it shares with the next.",
        fr: "Chaque pièce devient une flèche, du milieu de l’arête partagée avec la pièce précédente au milieu de celle partagée avec la suivante.",
        de: "Jedes Teil wird zu einem Pfeil, von der Mitte der Kante zum vorigen Teil zur Mitte der Kante zum nächsten.",
      },
      detail: {
        en: "<b class=\"kBlue\">Reference vector</b> " + vdef + ", between the midpoints of the <b class=\"kRed\">attachment edges</b>.<br><b class=\"kPink\">Correction</b> " + D + ": the signed area of the closed path from " + sub("m", "in") + " along the half attachment edge, the piece’s edges facing the region and the other half attachment edge to " + sub("m", "out") + ", then back along " + MINUS + i("v") + "; usually negative, a multiple of 1/8.<br>Rotation " + i("D") + ": the signed turning angle (counterclockwise positive) from the incoming to the outgoing attachment edge, plus 180°.<br>Parity bit " + i("B") + ": the Manhattan distance between the inner ends of the two attachment edges, modulo 2.",
        fr: "<b class=\"kBlue\">Vecteur de référence</b> " + vdef + ", entre les milieux des <b class=\"kRed\">arêtes d’attache</b>.<br><b class=\"kPink\">Correction</b> " + D + " : l’aire signée du chemin fermé qui va de " + sub("m", "in") + " par la demi-arête d’attache, les arêtes de la pièce tournées vers la région et l’autre demi-arête jusqu’à " + sub("m", "out") + ", puis revient le long de " + MINUS + i("v") + " ; en général négative, multiple de 1/8.<br>Rotation " + i("D") + " : l’angle tourné, signé (sens trigonométrique positif), de l’arête d’attache entrante à la sortante, plus 180°.<br>Bit de parité " + i("B") + " : la distance de Manhattan entre les extrémités intérieures des deux arêtes d’attache, modulo 2.",
        de: "<b class=\"kBlue\">Referenzvektor</b> " + vdef + ", zwischen den Mittelpunkten der <b class=\"kRed\">Anschlusskanten</b>.<br><b class=\"kPink\">Korrektur</b> " + D + ": die vorzeichenbehaftete Fläche des geschlossenen Wegs von " + sub("m", "in") + " über die halbe Anschlusskante, die der Region zugewandten Kanten des Teils und die andere halbe Anschlusskante nach " + sub("m", "out") + ", dann zurück entlang " + MINUS + i("v") + "; meist negativ, ein Vielfaches von 1/8.<br>Drehung " + i("D") + ": der vorzeichenbehaftete Drehwinkel (gegen den Uhrzeigersinn positiv) von der ein- zur ausgehenden Anschlusskante, plus 180°.<br>Paritätsbit " + i("B") + ": der Manhattan-Abstand zwischen den inneren Endpunkten der beiden Anschlusskanten, modulo 2.",
      },
    },
    lemma: {
      q: { en: "How do the arrows give the area?", fr: "Comment les flèches donnent-elles l’aire ?", de: "Wie ergeben die Pfeile die Fläche?" },
      label: "lem:area-decomposition", lines: "1686-1690, 1771-1773",
      section: { en: "Reference vectors", fr: "Vecteurs de référence", de: "Referenzvektoren" },
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
      q: { en: "Why do the turns add up to 360°?", fr: "Pourquoi les angles font-ils 360° ?", de: "Warum ergeben die Drehungen 360°?" },
      label: "eq:rotation-sum", lines: "1707-1722",
      section: { en: "Reference vectors", fr: "Vecteurs de référence", de: "Referenzvektoren" },
      lead: {
        en: "Walking once around the region, you turn exactly once: the turning angles add up to one full turn.",
        fr: "En faisant une fois le tour de la région, on tourne exactement d’un tour : les angles tournés font un tour complet.",
        de: "Wer einmal um die Region herumgeht, dreht sich genau einmal: Die Drehwinkel ergeben zusammen eine volle Drehung.",
      },
      detail: {
        en: sub("D", "1") + " + … + " + sub("D", "k") + " = 360°. Most pieces of a good fence turn by 0°; the four <b class=\"kGold\">corner pieces</b> by +90°.",
        fr: sub("D", "1") + " + … + " + sub("D", "k") + " = 360°. Dans une bonne barrière, la plupart des pièces tournent de 0° ; les quatre <b class=\"kGold\">pièces d’angle</b> de +90°.",
        de: sub("D", "1") + " + … + " + sub("D", "k") + " = 360°. In einem guten Zaun drehen die meisten Teile um 0°, die vier <b class=\"kGold\">Eckteile</b> um +90°.",
      },
    },
    p2: {
      q: { en: "Why sort the arrows?", fr: "Pourquoi trier les flèches ?", de: "Warum die Pfeile sortieren?" },
      label: "sec:8way", lines: "1790-1815",
      section: { en: "Eight-way partitioning", fr: "Partition en huit directions", de: "Achtfache Aufteilung" },
      lead: {
        en: "Sorted by direction, arrows with fixed directions make the largest polygon: the convex one.",
        fr: "Triées par direction, des flèches de directions fixées forment le plus grand polygone : le convexe.",
        de: "Nach Richtung sortiert bilden Pfeile mit festen Richtungen das größte Polygon: das konvexe.",
      },
      detail: {
        en: "That is the easy case. In <b>Problem MaxPolygon</b> each arrow may also take any of its up to 8 rotations and reflections; choosing them is the hard part, solved by dynamic programming that grows four chains: <b class=\"cNE\">NE</b> · <b class=\"cNW\">NW</b> · <b class=\"cSW\">SW</b> · <b class=\"cSE\">SE</b>.",
        fr: "C’est le cas facile. Dans le <b>problème MaxPolygon</b>, chaque flèche peut aussi prendre l’une de ses 8 rotations et réflexions au plus ; les choisir est la partie difficile, résolue par une programmation dynamique qui fait pousser quatre chaînes : <b class=\"cNE\">NE</b> · <b class=\"cNW\">NO</b> · <b class=\"cSW\">SO</b> · <b class=\"cSE\">SE</b>.",
        de: "Das ist der einfache Fall. In <b>Problem MaxPolygon</b> darf jeder Pfeil auch jede seiner bis zu 8 Drehungen und Spiegelungen annehmen; sie zu wählen ist der schwere Teil, gelöst durch dynamische Programmierung, die vier Ketten wachsen lässt: <b class=\"cNE\">NO</b> · <b class=\"cNW\">NW</b> · <b class=\"cSW\">SW</b> · <b class=\"cSE\">SO</b>.",
      },
    },
    bound: {
      q: { en: "How big can the polygon get?", fr: "Jusqu’où le polygone peut-il grandir ?", de: "Wie groß kann das Polygon werden?" },
      label: "sec:minkowski", lines: "1944-2052",
      section: { en: "An upper bound via Minkowski averages", fr: "Une borne supérieure par moyennes de Minkowski", de: "Eine obere Schranke über Minkowski-Mittel" },
      lead: {
        en: "However these arrows are turned, reflected and ordered, their polygon cannot exceed " + sub("F", "M") + ".",
        fr: "Quelle que soit la façon de tourner, retourner et ordonner ces flèches, leur polygone ne dépasse pas " + sub("F", "M") + ".",
        de: "Wie man diese Pfeile auch dreht, spiegelt und ordnet, ihr Polygon übersteigt " + sub("F", "M") + " nicht.",
      },
      detail: {
        en: sub("F", "M") + " is the area of the Minkowski average of the 8 rotated and reflected copies of the polygon, an upper bound for Problem MaxPolygon. The bound is often remarkably sharp.",
        fr: sub("F", "M") + " est l’aire de la moyenne de Minkowski des 8 copies tournées et retournées du polygone, une borne supérieure pour le problème MaxPolygon. La borne est souvent remarquablement serrée.",
        de: sub("F", "M") + " ist die Fläche des Minkowski-Mittels der 8 gedrehten und gespiegelten Kopien des Polygons, eine obere Schranke für Problem MaxPolygon. Die Schranke ist oft bemerkenswert scharf.",
      },
    },
  };

  if (typeof module !== "undefined" && module.exports) module.exports = CHIPS;
  else root.HX_CHIPS = CHIPS;
})(typeof window !== "undefined" ? window : globalThis);
