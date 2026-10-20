/* Limit-shape lab · card texts. `label` and `lines` are source references
 * kept as data attributes for the tests, never shown. Each card: one lead
 * sentence, then detail; app.js appends computed values. */
(function (root) {
  "use strict";
  const i = (s) => "<i>" + s + "</i>";
  const f = (s) => "<span class=\"f\">" + s + "</span>";
  const NB = "&#8239;";
  const MINUS = "−";
  const NBSP = "&#160;";
  const SEC_LIMIT = { en: "The limit shape", fr: "La forme limite", de: "Die Grenzform" };
  const SEC_LARGER = { en: "Larger fences", fr: "Les grandes barrières", de: "Größere Zäune" };
  const SEC_INTRO = { en: "Introduction", fr: "Introduction", de: "Einleitung" };
  const SEC_GREEDY = { en: "Heuristic greedy solver", fr: "Le solveur glouton heuristique", de: "Der heuristische Greedy-Löser" };
  const SEC_REF = { en: "Reference vectors", fr: "Les vecteurs de référence", de: "Referenzvektoren" };
  const R = i("R"), X = i("X"), Y = i("Y"), C = i("K"), P = i("P");
  const gapF = f("(|" + P + " " + MINUS + " " + C + "| " + MINUS + " " + R + ") / " + R);
  const rF = f(R + " = " + X + " + " + Y);

  const CHIPS = {
    count: {
      label: "sec:larger-fences, tab:heur, eq:an-asymptot", lines: "3189-3198, 3403-3430",
      section: SEC_LARGER,
      lead: {
        en: "The pieces of " + i("n") + " cells, counted up to turning and flipping.",
        fr: "Les pièces de " + i("n") + " cases, comptées à rotation et retournement près.",
        de: "Die Teile aus " + i("n") + " Zellen, gezählt bis auf Drehung und Spiegelung.",
      },
      detail: {
        en: "5, 12, 35, 108, 369 pieces for 4 to 8 cells; 1,285 for 9; 4,655 for 10; 17,073 for 11; 63,600 for 12; 238,591 for 13; 901,971 for 14; 3,426,576 for 15. For 500 cells the paper estimates about " + f("2.0·10<sup>300</sup>") + ".",
        fr: "5, 12, 35, 108, 369 pièces pour 4 à 8 cases" + NB + "; 1" + NB + "285 pour 9" + NB + "; 4" + NB + "655 pour 10" + NB + "; 17" + NB + "073 pour 11" + NB + "; 63" + NB + "600 pour 12" + NB + "; 238" + NB + "591 pour 13" + NB + "; 901" + NB + "971 pour 14" + NB + "; 3" + NB + "426" + NB + "576 pour 15. Pour 500 cases, l’article en estime environ " + f("2,0·10<sup>300</sup>") + ".",
        de: "5, 12, 35, 108, 369 Teile für 4 bis 8 Zellen; 1.285 für 9; 4.655 für 10; 17.073 für 11; 63.600 für 12; 238.591 für 13; 901.971 für 14; 3.426.576 für 15. Für 500 Zellen schätzt der Artikel etwa " + f("2,0·10<sup>300</sup>") + ".",
      },
    },
    gap: {
      label: "sec:limit, fig:chain, fig:deviation, fig:longest-edge", lines: "3612-3624, 3716-3724, 3734, 3751, 3811, 2835",
      section: SEC_LIMIT,
      lead: {
        en: "If the arrows pointed evenly in all directions, the loop would come ever closer to this circle.",
        fr: "Si les flèches pointaient également dans toutes les directions, la boucle se rapprocherait de plus en plus de ce cercle.",
        de: "Zeigten die Pfeile gleichmäßig in alle Richtungen, käme die Schleife diesem Kreis immer näher.",
      },
      detail: {
        en: C + " is the centre of the loop, and " + X + ", " + Y + " are the coordinates where one eighth of the loop ends. The circle passes through the four points where the loop crosses the axes, where the gap is 0 by construction; its radius " + rF + " is the one the loop would have with evenly spread arrows. The gap says how far the loop is from the circle, relative to the radius: " + gapF + " for a point " + P + " of the loop. At 500 cells, on the paper’s curve, the loop bulges out by 0.42% at 45° and dips inside, by up to 0.10%, near the axes; the paper shows that a longest arrow is never exactly diagonal. At ×1 that is thinner than the line; the loupe stretches the gap, so that at ×40 the 0.42% looks like 17%.",
        fr: C + " est le centre de la boucle, et " + X + ", " + Y + " sont les coordonnées où finit un huitième de la boucle. Le cercle passe par les quatre points où la boucle croise les axes, où l’écart est nul par construction" + NB + "; son rayon " + rF + " est celui qu’aurait la boucle avec des flèches également réparties. L’écart dit à quelle distance la boucle est du cercle, rapportée au rayon" + NB + ": " + gapF + " pour un point " + P + " de la boucle. À 500 cases, sur la courbe de l’article, la boucle déborde de 0,42" + NB + "% à 45° et rentre à l’intérieur, jusqu’à 0,10" + NB + "%, près des axes" + NB + "; l’article montre qu’une plus longue flèche n’est jamais exactement diagonale. À ×1, c’est plus fin que le trait" + NB + "; la loupe étire l’écart, si bien qu’à ×40 les 0,42" + NB + "% ressemblent à 17" + NB + "%.",
        de: C + " ist der Mittelpunkt der Schleife, und " + X + ", " + Y + " sind die Koordinaten, an denen ein Achtel der Schleife endet. Der Kreis geht durch die vier Punkte, an denen die Schleife die Achsen schneidet und die Abweichung nach Konstruktion 0 ist; sein Radius " + rF + " ist der, den die Schleife bei gleichmäßig verteilten Pfeilen hätte. Die Abweichung gibt an, wie weit die Schleife vom Kreis entfernt ist, relativ zum Radius: " + gapF + " für einen Punkt " + P + " der Schleife. Bei 500 Zellen, auf der Kurve des Artikels, wölbt sich die Schleife bei 45° um 0,42" + NBSP + "% nach außen und liegt nahe den Achsen bis zu 0,10" + NBSP + "% innen; der Artikel zeigt, dass ein längster Pfeil nie genau diagonal ist. Bei ×1 ist das dünner als der Strich; die Lupe dehnt die Abweichung, sodass bei ×40 die 0,42" + NBSP + "% wie 17" + NBSP + "% aussehen.",
      },
    },
    polygonFence: {
      label: "sec:larger-fences, tab:heur, lem:area-decomposition, fig:large-ref-polygons", lines: "3297-3345, 3403-3430, 2108-2117, 2156, 3432-3437",
      section: SEC_GREEDY,
      lead: {
        en: "The greedy fence uses every piece once, almost always with its longest arrow, turned or flipped so that the arrows close up; laid end to end by direction, they make this polygon.",
        fr: "La barrière gloutonne utilise chaque pièce une fois, presque toujours avec sa plus longue flèche, tournée ou retournée pour que les flèches se referment" + NB + "; posées bout à bout par direction, elles font ce polygone.",
        de: "Der Greedy-Zaun verwendet jedes Teil einmal, fast immer mit seinem längsten Pfeil, gedreht oder gespiegelt, sodass sich die Pfeile schließen; nach Richtung aneinandergelegt ergeben sie dieses Polygon.",
      },
      detail: {
        en: "In the drawing, the yellow dots are where the polygon turns, and the pink rings are the four corner pieces. These four, chosen among the pieces whose diagonally opposite corners are (⌈" + i("n") + "/2⌉, ⌈" + i("n") + "/2⌉) apart, are set beforehand, at 45°, with the arrow (⌈" + i("n") + "/2⌉" + NBSP + MINUS + NBSP + "½, ⌈" + i("n") + "/2⌉" + NBSP + MINUS + NBSP + "½). The other arrows are dealt out longest first, each to whichever of the eight arcs keeps the sums as balanced as possible, and a few corrective swaps close the loop. When the parity asks for it, one L-shaped piece is used like a stick of " + i("n") + NBSP + MINUS + NBSP + "1 cells. The polygon is not eight copies of one sector: its eight sectors differ a little. The area of the fence is the polygon’s plus the corrections of the pieces, which are usually negative (the lemma on the area decomposition).",
        fr: "Sur le dessin, les points jaunes sont là où le polygone tourne, et les anneaux roses sont les quatre pièces de coin. Ces quatre pièces, choisies parmi celles dont deux coins opposés en diagonale sont décalés de (⌈" + i("n") + "/2⌉" + NB + "; ⌈" + i("n") + "/2⌉), sont posées d’avance, à 45°, avec la flèche (⌈" + i("n") + "/2⌉" + NBSP + MINUS + NBSP + "½" + NB + "; ⌈" + i("n") + "/2⌉" + NBSP + MINUS + NBSP + "½). Les autres flèches sont distribuées de la plus longue à la plus courte, chacune dans celui des huit arcs qui garde les sommes aussi équilibrées que possible, et quelques échanges correctifs referment la boucle. Quand la parité l’exige, une pièce en L est utilisée comme un bâton de " + i("n") + NBSP + MINUS + NBSP + "1 cases. Le polygone n’est pas huit copies d’un même secteur" + NB + ": ses huit secteurs diffèrent un peu. L’aire de la barrière est celle du polygone plus les corrections des pièces, le plus souvent négatives (le lemme sur la décomposition de l’aire).",
        de: "In der Zeichnung liegen die gelben Punkte dort, wo das Polygon abknickt, und die rosa Ringe sind die vier Eckteile. Diese vier, ausgewählt unter den Teilen, bei denen diagonal gegenüberliegende Ecken um (⌈" + i("n") + "/2⌉; ⌈" + i("n") + "/2⌉) versetzt sind, werden vorab bei 45° festgelegt, mit dem Pfeil (⌈" + i("n") + "/2⌉" + NBSP + MINUS + NBSP + "½; ⌈" + i("n") + "/2⌉" + NBSP + MINUS + NBSP + "½). Die übrigen Pfeile werden vom längsten an verteilt, jeder in denjenigen der acht Bögen, der die Summen möglichst ausgleicht, und einige korrigierende Vertauschungen schließen die Schleife. Verlangt die Parität es, wird ein L-förmiges Teil wie ein Stab aus " + i("n") + NBSP + MINUS + NBSP + "1 Zellen verwendet. Das Polygon besteht nicht aus acht Kopien eines Sektors: Seine acht Sektoren unterscheiden sich ein wenig. Die Fläche des Zauns ist die des Polygons plus die Korrekturen der Teile, die meist negativ sind (das Lemma zur Zerlegung der Fläche).",
      },
    },
    arrowFence: {
      label: "sec:larger-fences, def:reference-vector, sec:limit", lines: "3297-3310, 2071-2092, 3511-3523",
      section: SEC_GREEDY,
      lead: {
        en: "Each piece gets one arrow: its longest, between the midpoints of two of its boundary edges.",
        fr: "Chaque pièce reçoit une flèche" + NB + ": sa plus longue, entre les milieux de deux de ses arêtes de bord.",
        de: "Jedes Teil bekommt einen Pfeil: seinen längsten, zwischen den Mittelpunkten zweier seiner Randkanten.",
      },
      detail: {
        en: "The polygon keeps these arrows, turned or flipped to point anywhere between 0° and 360°. Here they are folded back between 0° and 45°: one dot per kind of arrow, bigger when more pieces share it. Apart from the four corner pieces, which take the diagonal arrow instead (in pink), and sometimes one more piece, every piece keeps its longest arrow. When several arrows tie for the longest, the greedy solver lets the piece’s correction decide.",
        fr: "Le polygone garde ces flèches, tournées ou retournées pour pointer n’importe où entre 0° et 360°. Ici elles sont repliées entre 0° et 45°" + NB + ": un point par sorte de flèche, plus gros quand plus de pièces la partagent. À part les quatre pièces de coin, qui prennent la flèche diagonale à la place (en rose), et parfois une pièce de plus, chaque pièce garde sa plus longue flèche. Quand plusieurs flèches sont ex æquo, le solveur glouton laisse la correction de la pièce décider.",
        de: "Das Polygon behält diese Pfeile, gedreht oder gespiegelt, sodass sie in alle Richtungen von 0° bis 360° zeigen. Hier sind sie wieder zwischen 0° und 45° gefaltet: ein Punkt je Pfeilart, größer, wenn mehr Teile diesen Pfeil teilen. Außer den vier Eckteilen, die stattdessen den diagonalen Pfeil nehmen (in Rosa), und manchmal einem weiteren Teil behält jedes Teil seinen längsten Pfeil. Sind mehrere Pfeile gleich lang, lässt der Greedy-Löser die Korrektur des Teils entscheiden.",
      },
    },
    gapFence: {
      label: "fig:deviation, fig:large-ref-polygons, sec:limit", lines: "3733-3743, 3799-3818, 3432-3437",
      section: SEC_LIMIT,
      lead: {
        en: "The gap says how far the polygon is from a circle, relative to the circle’s radius.",
        fr: "L’écart dit à quelle distance le polygone est d’un cercle, rapportée au rayon du cercle.",
        de: "Die Abweichung gibt an, wie weit das Polygon von einem Kreis entfernt ist, relativ zum Radius des Kreises.",
      },
      detail: {
        en: "The circle is the paper’s: its centre " + C + " is the middle of the polygon’s bounding box and its radius " + R + " is half the box’s height, so it touches the bottom and the top. The gap in a direction is " + gapF + " for the point " + P + " of the polygon in that direction: positive outside the circle, negative inside. Below, the largest gap over the whole polygon, and the range in the sector from south to south-east, the one the paper’s deviation figure shows. As " + i("n") + " grows the gap shrinks slowly, and its largest values stay near the four diagonals, where the corner pieces sit.",
        fr: "Le cercle est celui de l’article" + NB + ": son centre " + C + " est le milieu de la boîte englobante du polygone et son rayon " + R + " est la moitié de la hauteur de la boîte, si bien qu’il touche le bas et le haut. L’écart dans une direction vaut " + gapF + " pour le point " + P + " du polygone dans cette direction" + NB + ": positif à l’extérieur du cercle, négatif à l’intérieur. Ci-dessous, le plus grand écart sur tout le polygone, et l’intervalle dans le secteur du sud au sud-est, celui que montre la figure de l’écart de l’article. Quand " + i("n") + " grandit, l’écart diminue lentement, et ses plus grandes valeurs restent près des quatre diagonales, là où se trouvent les pièces de coin.",
        de: "Der Kreis ist der des Artikels: Sein Mittelpunkt " + C + " ist die Mitte des umschließenden Rechtecks des Polygons, und sein Radius " + R + " ist die halbe Höhe des Rechtecks, sodass er das Rechteck unten und oben berührt. Die Abweichung in einer Richtung ist " + gapF + " für den Punkt " + P + " des Polygons in dieser Richtung: positiv außerhalb des Kreises, negativ innerhalb. Unten die größte Abweichung über das ganze Polygon und der Bereich im Sektor von Süden bis Südosten, den die Abweichungsabbildung des Artikels zeigt. Wächst " + i("n") + ", sinkt die Abweichung langsam, und ihre größten Werte bleiben nahe den vier Diagonalen, wo die Eckteile sitzen.",
      },
    },
    polygonOpt: {
      label: "sec:all-5, sec:all-6, fig:optimal-fence-refpoly, def:reference-vector, lem:area-decomposition, thm:1597", lines: "1659-1881, 1995-1997, 2058-2115, 2788-2829",
      section: SEC_REF,
      lead: {
        en: "The optimal fence uses every piece once, and no fence made of these pieces encloses more cells. A piece’s arrow runs from the midpoint of the edge it shares with the previous piece to the midpoint of the edge it shares with the next one; laid end to end, the arrows make this polygon.",
        fr: "La barrière optimale utilise chaque pièce une fois, et aucune barrière faite de ces pièces n’enclot plus de cases. La flèche d’une pièce va du milieu de l’arête qu’elle partage avec la pièce précédente au milieu de celle qu’elle partage avec la suivante" + NB + "; posées bout à bout, les flèches font ce polygone.",
        de: "Der optimale Zaun verwendet jedes Teil einmal, und kein Zaun aus diesen Teilen umschließt mehr Zellen. Der Pfeil eines Teils führt vom Mittelpunkt der Kante, die es mit dem vorigen Teil teilt, zum Mittelpunkt der Kante, die es mit dem nächsten teilt; aneinandergelegt ergeben die Pfeile dieses Polygon.",
      },
      detail: {
        en: "The pieces go once round the enclosed region, each touching the next along one edge (marked in pink on the pieces). In these fences the arrows already come in order of direction, so the polygon is convex. The yellow dots are where it turns, and the pink rings are the four corner pieces, where the touching edges change between horizontal and vertical. The area of the fence is the polygon’s plus the corrections of the pieces, which are usually negative (the lemma on the area decomposition): below, the lab counts the enclosed cells on the pieces themselves, and the corrections add up to the difference. The polygon shown belongs to one optimal fence. For the pentominoes the paper finds 5,760 optimal fences, with ten different reference polygons; for the hexominoes, 244 different polygons.",
        fr: "Les pièces font une fois le tour de la région enclose, chacune touchant la suivante par une arête (marquée en rose sur les pièces). Dans ces barrières, les flèches viennent déjà par ordre de direction" + NB + ": le polygone est convexe. Les points jaunes sont là où il tourne, et les anneaux roses sont les quatre pièces de coin, où les arêtes de contact passent de l’horizontale à la verticale. L’aire de la barrière est celle du polygone plus les corrections des pièces, le plus souvent négatives (le lemme sur la décomposition de l’aire)" + NB + ": ci-dessous, le labo compte les cases enfermées sur les pièces elles-mêmes, et les corrections font la différence. Le polygone montré est celui d’une barrière optimale. Pour les pentominos, l’article trouve 5" + NB + "760 barrières optimales, avec dix polygones de référence différents" + NB + "; pour les hexominos, 244 polygones différents.",
        de: "Die Teile gehen einmal um das eingeschlossene Gebiet, jedes berührt das nächste an einer Kante (auf den Teilen rosa markiert). In diesen Zäunen kommen die Pfeile schon nach Richtung geordnet, daher ist das Polygon konvex. Die gelben Punkte liegen dort, wo es abknickt, und die rosa Ringe sind die vier Eckteile, bei denen die Berührungskanten zwischen waagerecht und senkrecht wechseln. Die Fläche des Zauns ist die des Polygons plus die Korrekturen der Teile, die meist negativ sind (das Lemma zur Zerlegung der Fläche): Unten zählt das Labor die umschlossenen Zellen an den Teilen selbst, und die Korrekturen ergeben den Unterschied. Das gezeigte Polygon gehört zu einem optimalen Zaun. Für die Pentominos findet der Artikel 5.760 optimale Zäune mit zehn verschiedenen Referenzpolygonen, für die Hexominos 244 verschiedene Polygone.",
      },
    },
    arrowOpt: {
      label: "def:reference-vector, sec:all-5, sec:larger-fences", lines: "1896-1925, 2058-2092, 3297-3310",
      section: SEC_REF,
      lead: {
        en: "A piece’s arrow joins the midpoints of the two edges where it touches the previous and the next piece of the fence.",
        fr: "La flèche d’une pièce joint les milieux des deux arêtes par lesquelles elle touche la pièce précédente et la suivante de la barrière.",
        de: "Der Pfeil eines Teils verbindet die Mittelpunkte der beiden Kanten, an denen es das vorige und das nächste Teil des Zauns berührt.",
      },
      detail: {
        en: "This is the paper’s reference vector of the piece. Where a piece touches its neighbours depends on how the fence closes, so a piece does not always take its longest arrow, the longest one between the midpoints of two of its boundary edges. The four corner pieces touch their neighbours along one horizontal and one vertical edge, so their arrows have half-integer coordinates. Turned and flipped by the symmetries of the grid, an arrow can point anywhere between 0° and 360°; the pair written for a chosen piece is its arrow folded back to " + i("x") + " ≥ " + i("y") + " ≥ 0, as for the kinds of arrows from 7 cells on. Below, how many pieces of this fence take their longest arrow.",
        fr: "C’est le vecteur de référence de la pièce, au sens de l’article. L’endroit où une pièce touche ses voisines dépend de la façon dont la barrière se ferme, si bien qu’une pièce ne prend pas toujours sa plus longue flèche, la plus longue entre les milieux de deux de ses arêtes de bord. Les quatre pièces de coin touchent leurs voisines par une arête horizontale et une arête verticale, donc leurs flèches ont des coordonnées demi-entières. Tournée et retournée par les symétries de la grille, une flèche peut pointer n’importe où entre 0° et 360°" + NB + "; la paire écrite pour une pièce choisie est sa flèche repliée sur " + i("x") + " ≥ " + i("y") + " ≥ 0, comme pour les sortes de flèches à partir de 7 cases. Ci-dessous, combien de pièces de cette barrière prennent leur plus longue flèche.",
        de: "Das ist der Referenzvektor des Teils im Sinne des Artikels. Wo ein Teil seine Nachbarn berührt, hängt davon ab, wie sich der Zaun schließt, sodass ein Teil nicht immer seinen längsten Pfeil nimmt, den längsten zwischen den Mittelpunkten zweier seiner Randkanten. Die vier Eckteile berühren ihre Nachbarn an einer waagerechten und einer senkrechten Kante, daher haben ihre Pfeile halbzahlige Koordinaten. Mit den Symmetrien des Gitters gedreht und gespiegelt, kann ein Pfeil in alle Richtungen von 0° bis 360° zeigen; das Paar, das für ein gewähltes Teil geschrieben wird, ist sein Pfeil, auf " + i("x") + " ≥ " + i("y") + " ≥ 0 zurückgefaltet, wie bei den Pfeilarten ab 7 Zellen. Unten, wie viele Teile dieses Zauns ihren längsten Pfeil nehmen.",
      },
    },
    gapOpt: {
      label: "fig:deviation, fig:large-ref-polygons, sec:limit", lines: "3733-3743, 3799-3818, 3432-3437",
      section: SEC_LIMIT,
      lead: {
        en: "The gap says how far the polygon is from a circle, relative to the circle’s radius.",
        fr: "L’écart dit à quelle distance le polygone est d’un cercle, rapportée au rayon du cercle.",
        de: "Die Abweichung gibt an, wie weit das Polygon von einem Kreis entfernt ist, relativ zum Radius des Kreises.",
      },
      detail: {
        en: "The circle is the paper’s: its centre " + C + " is the middle of the polygon’s bounding box and its radius " + R + " is half the box’s height, so it touches the bottom and the top. The gap in a direction is " + gapF + " for the point " + P + " of the polygon in that direction: positive outside the circle, negative inside. Below, the largest gap over the whole polygon, outwards or inwards. With so few pieces the polygon is far from round; as " + i("n") + " grows it comes closer to the circle.",
        fr: "Le cercle est celui de l’article" + NB + ": son centre " + C + " est le milieu de la boîte englobante du polygone et son rayon " + R + " est la moitié de la hauteur de la boîte, si bien qu’il touche le bas et le haut. L’écart dans une direction vaut " + gapF + " pour le point " + P + " du polygone dans cette direction" + NB + ": positif à l’extérieur du cercle, négatif à l’intérieur. Ci-dessous, le plus grand écart sur tout le polygone, vers l’extérieur ou vers l’intérieur. Avec si peu de pièces, le polygone est loin d’être rond" + NB + "; quand " + i("n") + " grandit, il se rapproche du cercle.",
        de: "Der Kreis ist der des Artikels: Sein Mittelpunkt " + C + " ist die Mitte des umschließenden Rechtecks des Polygons, und sein Radius " + R + " ist die halbe Höhe des Rechtecks, sodass er das Rechteck unten und oben berührt. Die Abweichung in einer Richtung ist " + gapF + " für den Punkt " + P + " des Polygons in dieser Richtung: positiv außerhalb des Kreises, negativ innerhalb. Unten die größte Abweichung über das ganze Polygon, nach außen oder nach innen. Mit so wenigen Teilen ist das Polygon weit von rund entfernt; wächst " + i("n") + ", nähert es sich dem Kreis.",
      },
    },
    sample: {
      label: "sec:limit", lines: "3457-3462, 3484-3486",
      section: SEC_LIMIT,
      lead: {
        en: "Too many to list: random 500-ominoes are drawn with a chain that changes one cell at a time.",
        fr: "Trop nombreux pour les lister" + NB + ": on tire des 500-ominos au hasard avec une chaîne qui change une case à la fois.",
        de: "Zu viele zum Aufzählen: Zufällige 500-Ominos werden mit einer Kette gezogen, die jeweils eine Zelle ändert.",
      },
      detail: {
        en: "Each step removes a random cell and adds a random free cell next to the rest. If the piece falls apart, it stays as it was, and that refused move still counts as a step: counted this way, after enough steps, every placed 500-omino (turned and flipped copies counted separately) is about equally likely. The lab’s chain takes a new 500-omino every 4,000 steps, and the picture follows about twice a second; the paper keeps one 500-omino every million steps. The loop is the paper’s: 13.5 million 500-ominoes, about 200 days of computing on one processor.",
        fr: "Chaque pas retire une case au hasard et ajoute une case libre voisine au hasard. Si la pièce se sépare en morceaux, elle reste telle quelle, et ce refus compte quand même comme un pas" + NB + ": comptés ainsi, après assez de pas, tous les 500-ominos posés (copies tournées ou retournées comptées à part) sont à peu près également probables. La chaîne du labo prend un nouveau 500-omino tous les 4" + NB + "000 pas, et l’image suit environ deux fois par seconde" + NB + "; l’article garde un 500-omino par million de pas. La boucle est celle de l’article" + NB + ": 13,5 millions de 500-ominos, environ 200 jours de calcul sur un processeur.",
        de: "Jeder Schritt entfernt eine zufällige Zelle und fügt eine zufällige freie Nachbarzelle hinzu. Zerfällt das Teil, bleibt es, wie es war, und dieser abgelehnte Zug zählt trotzdem als Schritt: So gezählt, ist nach genügend Schritten jedes gelegte 500-Omino (gedrehte und gespiegelte Kopien getrennt gezählt) etwa gleich wahrscheinlich. Die Kette des Labors nimmt alle 4000 Schritte ein neues 500-Omino, und das Bild folgt etwa zweimal pro Sekunde; der Artikel behält ein 500-Omino pro Million Schritte. Die Schleife ist die des Artikels: 13,5 Millionen 500-Ominos, etwa 200 Tage Rechenzeit eines Prozessors.",
      },
    },
    giant: {
      label: "sec:limit, eq:an-asymptot", lines: "3172, 3839-3851",
      section: SEC_LIMIT,
      lead: {
        en: "The paper estimates about " + f("2.0·10<sup>300</sup>") + " different 500-ominoes, somewhere between about " + f("10<sup>297</sup>") + " and " + f("10<sup>323</sup>") + ".",
        fr: "L’article estime qu’il existe environ " + f("2,0·10<sup>300</sup>") + " 500-ominos différents, quelque part entre environ " + f("10<sup>297</sup>") + " et " + f("10<sup>323</sup>") + ".",
        de: "Der Artikel schätzt etwa " + f("2,0·10<sup>300</sup>") + " verschiedene 500-Ominos, irgendwo zwischen etwa " + f("10<sup>297</sup>") + " und " + f("10<sup>323</sup>") + ".",
      },
      detail: {
        en: "The paper takes the loop of its 13.5 million sampled pieces, eight copies of their sorted arrows (108 million arrows), and scales it up as if it were made of all the 500-ominoes, each once. Its area gives a rough estimate of the largest 500-omino fence; the corrections of the pieces are far too small to change it.",
        fr: "L’article prend la boucle de ses 13,5 millions de pièces tirées, huit copies de leurs flèches triées (108 millions de flèches), et l’agrandit comme si elle était faite de tous les 500-ominos, chacun une fois. Son aire donne une estimation grossière de la plus grande barrière de 500-ominos" + NB + "; les corrections des pièces sont bien trop petites pour la changer.",
        de: "Der Artikel nimmt die Schleife seiner 13,5 Millionen gezogenen Teile, acht Kopien ihrer sortierten Pfeile (108 Millionen Pfeile), und vergrößert sie so, als bestünde sie aus allen 500-Ominos, jedes einmal. Ihre Fläche ergibt eine grobe Schätzung für den größten Zaun aus 500-Ominos; die Korrekturen der Teile sind viel zu klein, um daran etwas zu ändern.",
      },
    },
  };
  root.LIMIT_CHIPS = CHIPS;
  root.LIMIT_SECTIONS = { SEC_LIMIT, SEC_LARGER, SEC_INTRO, SEC_REF };
})(typeof window !== "undefined" ? window : globalThis);
