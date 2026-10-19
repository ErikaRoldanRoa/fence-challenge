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
  const R = i("R"), X = i("X"), Y = i("Y"), C = i("C"), P = i("P");
  const gapF = f("(|" + P + " " + MINUS + " " + C + "| " + MINUS + " " + R + ") / " + R);
  const rF = f(R + " = " + X + " + " + Y);

  const CHIPS = {
    count: {
      label: "sec:introduction, sec:larger-fences, tab:heur, eq:an-asymptot", lines: "97, 2389-2392, 2524-2549, 2590",
      section: SEC_LARGER,
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
      label: "sec:limit, lem:integer-vector, fig:longest-edge", lines: "2627-2631, 2643-2656",
      section: SEC_LIMIT,
      lead: {
        en: "Each piece gets its longest arrow: the longest one between the midpoints of two of its boundary edges.",
        fr: "Chaque pièce reçoit sa plus longue flèche" + NB + ": la plus longue entre les milieux de deux de ses arêtes de bord.",
        de: "Jedes Teil bekommt seinen längsten Pfeil: den längsten zwischen den Mittelpunkten zweier seiner Randkanten.",
      },
      detail: {
        en: "One coordinate of each midpoint ends in ½, yet the longest arrow always has whole-number coordinates (Lemma). Turned and flipped by the symmetries of the grid, every arrow points between 0° and 45°. When " + i("k") + " arrows tie for the longest, each counts with weight " + f("1/" + i("k")) + ".",
        fr: "Chaque milieu a une coordonnée qui finit en ½, et pourtant la plus longue flèche a toujours des coordonnées entières (lemme). Tournée et retournée par les symétries de la grille, chaque flèche pointe entre 0° et 45°. Quand " + i("k") + " flèches sont ex æquo, chacune compte avec le poids " + f("1/" + i("k")) + ".",
        de: "Jeder Mittelpunkt hat eine Koordinate, die auf ½ endet, und doch hat der längste Pfeil immer ganzzahlige Koordinaten (Lemma). Mit den Symmetrien des Gitters gedreht und gespiegelt, zeigt jeder Pfeil zwischen 0° und 45°. Sind " + i("k") + " Pfeile gleich lang, zählt jeder mit dem Gewicht " + f("1/" + i("k")) + ".",
      },
    },
    loop: {
      label: "sec:limit, fig:chain, tab:heur, tab:hepto-octo, sec:introduction", lines: "2948-2953, 2975-2985, 3048-3055, 2524-2549, 2357, 2367-2369, 107",
      section: SEC_LIMIT,
      lead: {
        en: "The loop uses every piece eight times: the arrows sorted by direction, laid end to end, and copied eight times.",
        fr: "La boucle utilise chaque pièce huit fois" + NB + ": les flèches triées par direction, posées bout à bout, puis copiées huit fois.",
        de: "Die Schleife verwendet jedes Teil achtmal: die Pfeile nach Richtung sortiert, aneinandergelegt und achtmal kopiert.",
      },
      detail: {
        en: "Shrunk by 8, so that each piece counts once, the loop gives a rough estimate of the largest fence. It ignores how the pieces really fit together, and for small " + i("n") + " it lands above the true maximum. Below, the estimate next to the paper’s fences.",
        fr: "Réduite d’un facteur 8, pour que chaque pièce compte une fois, la boucle donne une estimation grossière de la plus grande barrière. Elle ignore comment les pièces s’assemblent vraiment et, pour les petits " + i("n") + ", elle dépasse le vrai maximum. Ci-dessous, l’estimation à côté des barrières de l’article.",
        de: "Um den Faktor 8 verkleinert, sodass jedes Teil einmal zählt, liefert die Schleife eine grobe Schätzung des größten Zauns. Sie ignoriert, wie die Teile wirklich zusammenpassen, und liegt für kleine " + i("n") + " über dem wahren Maximum. Unten die Schätzung neben den Zäunen des Artikels.",
      },
    },
    gap: {
      label: "sec:limit, fig:chain, fig:deviation, fig:longest-edge", lines: "3612-3624, 3716-3724, 3737, 3751, 3811, 2835",
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
    sample: {
      label: "sec:limit", lines: "3457-3462, 3484-3486",
      section: SEC_LIMIT,
      lead: {
        en: "Too many to list: random 500-ominoes are drawn with a chain that changes one cell at a time.",
        fr: "Trop nombreux pour les lister" + NB + ": on tire des 500-ominos au hasard avec une chaîne qui change une case à la fois.",
        de: "Zu viele zum Aufzählen: Zufällige 500-Ominos werden mit einer Kette gezogen, die jeweils eine Zelle ändert.",
      },
      detail: {
        en: "Each step removes a random cell and adds a random free cell next to the rest. If the piece falls apart, it stays as it was, and that refused move still counts as a step: counted this way, after enough steps, every placed 500-omino (turned and flipped copies counted separately) is about equally likely. The lab shows its chain every 4,000 steps, so neighbouring pictures look alike; the paper keeps one 500-omino every million steps. The loop in the middle is the paper’s: 13.5 million 500-ominoes, about 200 days of computing on one processor.",
        fr: "Chaque pas retire une case au hasard et ajoute une case libre voisine au hasard. Si la pièce se sépare en morceaux, elle reste telle quelle, et ce refus compte quand même comme un pas" + NB + ": comptés ainsi, après assez de pas, tous les 500-ominos posés (copies tournées ou retournées comptées à part) sont à peu près également probables. Le labo montre sa chaîne tous les 4" + NB + "000 pas, si bien que deux images voisines se ressemblent" + NB + "; l’article garde un 500-omino par million de pas. La boucle du milieu est celle de l’article" + NB + ": 13,5 millions de 500-ominos, environ 200 jours de calcul sur un processeur.",
        de: "Jeder Schritt entfernt eine zufällige Zelle und fügt eine zufällige freie Nachbarzelle hinzu. Zerfällt das Teil, bleibt es, wie es war, und dieser abgelehnte Zug zählt trotzdem als Schritt: So gezählt, ist nach genügend Schritten jedes gelegte 500-Omino (gedrehte und gespiegelte Kopien getrennt gezählt) etwa gleich wahrscheinlich. Das Labor zeigt seine Kette alle 4000 Schritte, daher sehen benachbarte Bilder einander ähnlich; der Artikel behält ein 500-Omino pro Million Schritte. Die Schleife in der Mitte ist die des Artikels: 13,5 Millionen 500-Ominos, etwa 200 Tage Rechenzeit eines Prozessors.",
      },
    },
    giant: {
      label: "sec:limit, eq:an-asymptot", lines: "3172, 3839-3851",
      section: SEC_LIMIT,
      lead: {
        en: "There are about " + f("2.0·10<sup>300</sup>") + " different 500-ominoes.",
        fr: "Il existe environ " + f("2,0·10<sup>300</sup>") + " 500-ominos différents.",
        de: "Es gibt etwa " + f("2,0·10<sup>300</sup>") + " verschiedene 500-Ominos.",
      },
      detail: {
        en: "The paper takes the loop of its 13.5 million sampled pieces, eight copies of their sorted arrows, and scales it up as if it were made of all of them, each once. Its area gives a rough estimate of the largest 500-omino fence; the corrections of the pieces are far too small to change it.",
        fr: "L’article prend la boucle de ses 13,5 millions de pièces tirées, huit copies de leurs flèches triées, et l’agrandit comme si elle était faite de toutes les pièces, chacune une fois. Son aire donne une estimation grossière de la plus grande barrière de 500-ominos" + NB + "; les corrections des pièces sont bien trop petites pour la changer.",
        de: "Der Artikel nimmt die Schleife seiner 13,5 Millionen gezogenen Teile, acht Kopien ihrer sortierten Pfeile, und vergrößert sie so, als bestünde sie aus allen Teilen, jedes einmal. Ihre Fläche ergibt eine grobe Schätzung für den größten Zaun aus 500-Ominos; die Korrekturen der Teile sind viel zu klein, um daran etwas zu ändern.",
      },
    },
  };
  root.LIMIT_CHIPS = CHIPS;
  root.LIMIT_SECTIONS = { SEC_LIMIT, SEC_LARGER, SEC_INTRO };
})(typeof window !== "undefined" ? window : globalThis);
