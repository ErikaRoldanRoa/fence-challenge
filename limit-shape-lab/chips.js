/* Limit-shape lab · card texts. `label` and `lines` are source references
 * kept as data attributes for the tests, never shown. Each card: one lead
 * sentence, then detail; app.js appends computed values. */
(function (root) {
  "use strict";
  const i = (s) => "<i>" + s + "</i>";
  const f = (s) => "<span class=\"f\">" + s + "</span>";
  const NB = "&#8239;";
  const MINUS = "−";
  const SEC_LIMIT = { en: "The Limit Shape", fr: "La forme limite", de: "Die Grenzform" };
  const SEC_LARGER = { en: "Larger Fences", fr: "Les grandes barrières", de: "Größere Zäune" };
  const SEC_INTRO = { en: "Introduction", fr: "Introduction", de: "Einleitung" };
  const R = i("R"), X = i("X"), Y = i("Y"), C = i("C"), P = i("P");
  const gapF = f("(|" + P + " " + MINUS + " " + C + "| " + MINUS + " " + R + ") / " + R);
  const rF = f(R + " = " + X + " + " + Y);

  const CHIPS = {
    count: {
      label: "sec:introduction, tab:heur, eq:an-asymptot", lines: "86, 2468-2482, 2331-2335",
      section: SEC_INTRO,
      lead: {
        en: "The pieces of " + i("n") + " cells, counted up to turning and flipping.",
        fr: "Les pièces de " + i("n") + " cases, comptées à rotation et retournement près.",
        de: "Die Teile aus " + i("n") + " Zellen, gezählt bis auf Drehung und Spiegelung.",
      },
      detail: {
        en: "12, 35, 108, 369 pieces for 5 to 8 cells; 1285 for 9; 4655 for 10. For 500 cells there are about " + f("2.0·10<sup>300</sup>") + ".",
        fr: "12, 35, 108, 369 pièces pour 5 à 8 cases" + NB + "; 1285 pour 9" + NB + "; 4655 pour 10. Pour 500 cases, il y en a environ " + f("2,0·10<sup>300</sup>") + ".",
        de: "12, 35, 108, 369 Teile für 5 bis 8 Zellen; 1285 für 9; 4655 für 10. Für 500 Zellen sind es etwa " + f("2,0·10<sup>300</sup>") + ".",
      },
    },
    arrow: {
      label: "sec:limit, lem:integer-vector", lines: "2557, 2569-2632, 2645-2647",
      section: SEC_LIMIT,
      lead: {
        en: "Each piece gets one arrow: the longest one between the midpoints of two of its boundary edges.",
        fr: "Chaque pièce reçoit une flèche" + NB + ": la plus longue entre les milieux de deux de ses arêtes de bord.",
        de: "Jedes Teil bekommt einen Pfeil: den längsten zwischen den Mittelpunkten zweier seiner Randkanten.",
      },
      detail: {
        en: "The midpoints have half-integer coordinates, yet the longest arrow always has whole-number coordinates (Lemma). Turned and flipped by the symmetries of the grid, every arrow points between 0° and 45°. When " + i("k") + " arrows tie for the longest, each counts with weight " + f("1/" + i("k")) + ".",
        fr: "Les milieux ont des coordonnées demi-entières, et pourtant la plus longue flèche a toujours des coordonnées entières (lemme). Tournée et retournée par les symétries de la grille, chaque flèche pointe entre 0° et 45°. Quand " + i("k") + " flèches sont ex æquo, chacune compte avec le poids " + f("1/" + i("k")) + ".",
        de: "Die Mittelpunkte haben halbzahlige Koordinaten, und doch hat der längste Pfeil immer ganzzahlige Koordinaten (Lemma). Mit den Symmetrien des Gitters gedreht und gespiegelt, zeigt jeder Pfeil zwischen 0° und 45°. Sind " + i("k") + " Pfeile gleich lang, zählt jeder mit dem Gewicht " + f("1/" + i("k")) + ".",
      },
    },
    loop: {
      label: "sec:limit, fig:chain, tab:heur, tab:hepto-octo, thm:1597", lines: "2706, 2726-2738, 2791-2793, 2468-2482, 2314-2315, 95, 1587",
      section: SEC_LIMIT,
      lead: {
        en: "The loop uses every piece eight times: the arrows sorted by direction, laid end to end, and copied eight times.",
        fr: "La boucle utilise chaque pièce huit fois" + NB + ": les flèches triées par direction, posées bout à bout, puis copiées huit fois.",
        de: "Die Schleife verwendet jedes Teil achtmal: die Pfeile nach Richtung sortiert, aneinandergelegt und achtmal kopiert.",
      },
      detail: {
        en: "Shrunk by 8, so that each piece counts once, its area estimates the largest fence the pieces can build. Below, the estimate next to the paper’s fences.",
        fr: "Réduite d’un facteur 8, pour que chaque pièce compte une fois, son aire estime la plus grande barrière que les pièces peuvent construire. Ci-dessous, l’estimation à côté des barrières de l’article.",
        de: "Um den Faktor 8 verkleinert, sodass jedes Teil einmal zählt, schätzt ihre Fläche den größten Zaun, den die Teile bauen können. Unten die Schätzung neben den Zäunen des Artikels.",
      },
    },
    gap: {
      label: "sec:limit, fig:chain, fig:deviation", lines: "2666-2667, 2706, 2720, 2726-2788",
      section: SEC_LIMIT,
      lead: {
        en: "If the arrows pointed evenly in all directions, the loop would be this circle.",
        fr: "Si les flèches pointaient également dans toutes les directions, la boucle serait ce cercle.",
        de: "Zeigten die Pfeile gleichmäßig in alle Richtungen, wäre die Schleife dieser Kreis.",
      },
      detail: {
        en: C + " is the centre of the loop. The circle passes through the four points where the loop crosses the axes, where the gap is 0 by construction; its radius " + rF + " is the one the loop would have with evenly spread arrows. The gap is " + gapF + ". At 500 cells, on the paper’s curve, the loop bulges out at 45° by 0.40 %; the paper also finds arrows near 0° rare and exact diagonals missing.",
        fr: C + " est le centre de la boucle. Le cercle passe par les quatre points où la boucle croise les axes, où l’écart est nul par construction" + NB + "; son rayon " + rF + " est celui qu’aurait la boucle avec des flèches également réparties. L’écart vaut " + gapF + ". À 500 cases, sur la courbe de l’article, la boucle déborde à 45° de 0,40 %" + NB + "; l’article constate aussi que les flèches proches de 0° sont rares et que les diagonales exactes manquent.",
        de: C + " ist der Mittelpunkt der Schleife. Der Kreis geht durch die vier Punkte, an denen die Schleife die Achsen schneidet und die Abweichung nach Konstruktion 0 ist; sein Radius " + rF + " ist der, den die Schleife bei gleichmäßig verteilten Pfeilen hätte. Die Abweichung gibt an, wie weit die Schleife vom Kreis entfernt ist, relativ zum Radius: " + gapF + ". Bei 500 Zellen, auf der Kurve des Artikels, wölbt sich die Schleife bei 45° um 0,40 % nach außen; der Artikel findet auch Pfeile nahe 0° selten und exakte Diagonalen gar nicht.",
      },
    },
    sample: {
      label: "sec:limit", lines: "2534-2540, 2557",
      section: SEC_LIMIT,
      lead: {
        en: "Too many to list: the lab draws random 500-ominoes with a chain that changes one cell at a time.",
        fr: "Trop nombreux pour les lister" + NB + ": le labo tire des 500-ominos au hasard avec une chaîne qui change une case à la fois.",
        de: "Zu viele zum Aufzählen: Das Labor zieht zufällige 500-Ominos mit einer Kette, die jeweils eine Zelle ändert.",
      },
      detail: {
        en: "Each step removes a random cell and adds a random free cell next to the rest. If the piece falls apart, it stays as it was, and that refused move still counts as a step: counted this way, every 500-omino is equally likely. The loop at 500 cells is the paper’s curve, from millions of sampled 500-ominoes.",
        fr: "Chaque pas retire une case au hasard et ajoute une case libre voisine au hasard. Si la pièce se coupe en deux, elle reste telle quelle, et ce refus compte quand même comme un pas" + NB + ": comptés ainsi, tous les 500-ominos sont également probables. La boucle à 500 cases est la courbe de l’article, issue de millions de 500-ominos tirés au hasard.",
        de: "Jeder Schritt entfernt eine zufällige Zelle und fügt eine zufällige freie Nachbarzelle hinzu. Zerfällt das Teil, bleibt es, wie es war, und dieser abgelehnte Zug zählt trotzdem als Schritt: So gezählt, ist jedes 500-Omino gleich wahrscheinlich. Die Schleife bei 500 Zellen ist die Kurve des Artikels, aus Millionen gezogener 500-Ominos.",
      },
    },
    giant: {
      label: "sec:limit, eq:an-asymptot", lines: "2534, 2720-2721, 2791-2793",
      section: SEC_LIMIT,
      lead: {
        en: "There are about " + f("2.0·10<sup>300</sup>") + " different 500-ominoes.",
        fr: "Il existe environ " + f("2,0·10<sup>300</sup>") + " 500-ominos différents.",
        de: "Es gibt etwa " + f("2,0·10<sup>300</sup>") + " verschiedene 500-Ominos.",
      },
      detail: {
        en: "The loop holds each piece eight times. Shrunk by 8 and scaled to all of them, its area estimates the largest 500-omino fence; the corrections of the pieces are far too small to change it.",
        fr: "La boucle contient chaque pièce huit fois. Réduite d’un facteur 8 et rapportée à toutes, son aire estime la plus grande barrière de 500-ominos" + NB + "; les corrections des pièces sont bien trop petites pour la changer.",
        de: "Die Schleife enthält jedes Teil achtmal. Um den Faktor 8 verkleinert und auf alle hochgerechnet, ergibt ihre Fläche eine Schätzung für den größten Zaun aus 500-Ominos; die Korrekturen der Teile sind viel zu klein, um daran etwas zu ändern.",
      },
    },
  };
  root.LIMIT_CHIPS = CHIPS;
  root.LIMIT_SECTIONS = { SEC_LIMIT, SEC_LARGER, SEC_INTRO };
})(typeof window !== "undefined" ? window : globalThis);
