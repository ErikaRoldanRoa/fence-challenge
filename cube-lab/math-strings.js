/* Cube lab · the texts of the math chips (FR / DE / EN), read by
 * math-chip.js: title, body and footer per chip. Keys ending in ".f" are
 * the faces-only versions (?conn=6). */
(function () {
  "use strict";
  var NB = " ";

  var fr = {
    "m.sec": "Murailles en trois dimensions",
    "m.ours": "Notre argument, pas dans l’article",

    "m.room.aria": "Les maths : ce qui compte comme intérieur",
    "m.room.title": "Ce qui compte comme intérieur",
    "m.room.body": "Le vide se faufile par les faces, les arêtes et les coins" + NB + ": deux cubes vides sont voisins dès qu’ils ont un seul sommet en commun. L’extérieur, c’est tout ce que ces chemins atteignent depuis le lointain.\nCe qui reste est enfermé. S’il forme plusieurs poches, le volume ne compte que la plus grande (deux poches qui se touchent par un coin n’en font qu’une).",
    "m.room.f.title": "Ce qui compte comme intérieur (faces seules)",
    "m.room.f.body": "Ici le vide ne passe que par les faces" + NB + ": deux cubes vides sont voisins s’ils ont une face entière en commun. L’extérieur, c’est tout ce que ces chemins atteignent depuis le lointain.\nCe qui reste est enfermé. S’il forme plusieurs poches, le volume ne compte que la plus grande (deux poches qui ne se touchent que par une arête ou un coin restent deux).",

    "m.wall.aria": "Les maths : la muraille autour d’une poche de vide",
    "m.wall.title": "La muraille autour du vide",
    "m.wall.body": "Pour enfermer une poche S (toute entière), la muraille doit contenir chaque cube qui a au moins un sommet en commun avec S" + NB + ": l’ensemble N(S) ∖ S, où N(S) est S avec les 26 voisins de chacun de ses cubes.",
    "m.wall.f.title": "La muraille autour du vide (faces seules)",
    "m.wall.f.body": "Pour enfermer une poche S (toute entière) quand le vide ne passe que par les faces, la muraille doit contenir chaque cube qui a une face commune avec S" + NB + ": les 6 voisins par face de chacun de ses cubes, sauf S.",

    "m.cast.aria": "Les maths : le moulage du vide",
    "m.cast.title": "Le moulage du vide",
    "m.cast.body": "Enlève la muraille et la poche S (toute entière) reste seule" + NB + ": la forme du vide que la muraille enfermait.",
    "m.cast52.body": "Enlève la muraille et la poche S (toute entière) reste seule" + NB + ": la forme du vide que la muraille enfermait.\nIci c’est un presque-cube" + NB + ": une boîte de 3 × 4 × 4 avec une couche de 2 × 2 sur une face, 52 cubes.",

    "m.turn.aria": "Les maths : tourner sans jamais retourner",
    "m.turn.title": "Tourner, jamais retourner",
    "m.turn.body": "Une pièce peut prendre jusqu’à 24 positions en tournant, mais tourner ne la retourne jamais en miroir. Pour la plupart des pièces, l’image miroir n’est que la pièce tournée" + NB + "; pour quelques pièces (dites chirales), c’est une autre pièce.\nEn comptant à part les jumelles miroir, il y a 8 tétracubes et 29 pentacubes (7 et 23 sinon).",

    "m.tetra.aria": "Les maths : pourquoi les tétracubes s’arrêtent à un",
    "m.tetra.title": "Pourquoi un, et pas deux",
    "m.tetra.body": "Les 8 tétracubes font 32 cubes. Un cube vide demande ses 26 voisins.\nDeux cubes vides demandent les cubes de deux blocs 3 × 3 × 3, moins les deux cases" + NB + ": deux tels blocs ont au plus 18 cases en commun, donc il faut au moins 54 − 18 − 2 = 34 cubes, et 34 dépasse 32. Une poche plus grande en demande encore plus" + NB + ": les plus petites murailles grandissent, 26, 34, 42, 44, … pour 1, 2, 3, 4 cubes.",

    "m.bound.aria": "Les maths : combien une muraille peut contenir",
    "m.bound.title": "Combien une muraille peut contenir",
    "m.bound.body": "Pour chaque taille, une des meilleures poches, celle dont la muraille N(S) ∖ S est la plus petite, est un presque-cube (une boîte de côtés k ou k + 1, un presque-cube plus petit sur une face)" + NB + ": c’est le théorème de Veomett et Radcliffe.\n52 cubes de vide demandent une muraille de 144 cubes, 53 déjà 146, et les 29 pentacubes n’ont que 145 cubes. La muraille 1 atteint 52" + NB + ": 52 est la réponse.",

    "m.cover.aria": "Les maths : remplir la muraille exactement",
    "m.cover.title": "Remplir la muraille exactement",
    "m.cover.body": "La poche S choisie, bâtir sa muraille est une couverture exacte" + NB + ": chaque case de N(S) ∖ S couverte par exactement un cube, chaque pièce utilisée au plus une fois" + NB + "; une pièce peut dépasser dans des cases hors de N(S), jamais dans S. Les liens dansants de Knuth la résolvent.\nPour la poche de 52" + NB + ": 144 cases à couvrir, 145 cubes, donc exactement un cube dépasse.",

    "m.wallinfo.aria": "Les maths : cette muraille",
    "m.wallinfo.title": "Muraille {k}",
    "m.wallinfo.paper.body": "{p} pièces de {n} cubes, {c} cubes en tout" + NB + "; elle enferme {v} cubes de vide.\nUne muraille de l’article.",
    "m.wallinfo.best.body": "29 pièces de 5 cubes, 145 cubes" + NB + "; elle enferme 52 cubes de vide.\nOn ne peut pas faire mieux" + NB + ": 53 cubes de vide demanderaient une muraille de 146 cubes, et il n’y en a que 145. Ici 144 bordent exactement la poche et un seul dépasse" + NB + ": il faut les 29 pentacubes, tous.",

    "m.roominfo.aria": "Les maths : cette poche de vide",
    "m.roominfo.title": "Une poche de {k} cubes",
    "m.roominfo.title1": "Une poche de 1 cube",
    "m.roominfo.body": "Sa plus petite muraille, N(S) ∖ S, compte {w} cubes. Les {p} pièces de cette étape apportent {c} cubes" + NB + ": {s} de marge.\nUne muraille qui y parvient existe" + NB + ": nous en avons trouvé une.",
    "m.roominfo.f.body": "Sa plus petite muraille, quand seules les faces laissent passer le vide, compte {w6} cubes. Les {p} pièces de cette étape apportent {c} cubes" + NB + ": {s6} de marge.\nUne muraille qui y parvient existe" + NB + ": nous en avons trouvé une."
  };

  var de = {
    "m.sec": "Dreidimensionale Mauern",
    "m.ours": "Unser Argument, nicht im Artikel",

    "m.room.aria": "Die Mathematik: was als innen zählt",
    "m.room.title": "Was als innen zählt",
    "m.room.body": "Leere schlüpft durch Flächen, Kanten und Ecken: Zwei leere Würfel sind Nachbarn, sobald sie einen einzigen Eckpunkt teilen. Außen ist alles, was solche Wege von weit her erreichen.\nWas übrig bleibt, ist eingeschlossen. Zerfällt es in mehrere Hohlräume, zählt nur der größte (Hohlräume, die sich an einer Ecke berühren, sind einer).",
    "m.room.f.title": "Was als innen zählt (nur Flächen)",
    "m.room.f.body": "Hier schlüpft Leere nur durch Flächen: Zwei leere Würfel sind Nachbarn, wenn sie eine ganze Fläche teilen. Außen ist alles, was solche Wege von weit her erreichen.\nWas übrig bleibt, ist eingeschlossen. Zerfällt es in mehrere Hohlräume, zählt nur der größte (Hohlräume, die sich nur an einer Kante oder Ecke berühren, bleiben zwei).",

    "m.wall.aria": "Die Mathematik: die Mauer um einen Hohlraum",
    "m.wall.title": "Die Mauer um die Leere",
    "m.wall.body": "Um einen Hohlraum S (ganz) einzuschließen, muss die Mauer jeden Würfel enthalten, der mit S mindestens einen Eckpunkt teilt: die Menge N(S) ∖ S, wobei N(S) aus S und den 26 Nachbarn jedes seiner Würfel besteht.",
    "m.wall.f.title": "Die Mauer um die Leere (nur Flächen)",
    "m.wall.f.body": "Um einen Hohlraum S (ganz) einzuschließen, wenn Leere nur durch Flächen schlüpft, muss die Mauer jeden Würfel enthalten, der mit S eine Fläche teilt: die 6 Flächennachbarn jedes seiner Würfel, ohne S.",

    "m.cast.aria": "Die Mathematik: der Abguss der Leere",
    "m.cast.title": "Der Abguss der Leere",
    "m.cast.body": "Nimm die Mauer weg, und der Hohlraum S (ganz) steht allein: die Form der Leere, die die Mauer eingeschlossen hat.",
    "m.cast52.body": "Nimm die Mauer weg, und der Hohlraum S (ganz) steht allein: die Form der Leere, die die Mauer eingeschlossen hat.\nHier ist es ein Fast-Würfel: eine 3 × 4 × 4-Kiste mit einer 2 × 2-Schicht auf einer Fläche, 52 Würfel.",

    "m.turn.aria": "Die Mathematik: drehen, nie spiegeln",
    "m.turn.title": "Drehen, nie spiegeln",
    "m.turn.body": "Ein Teil kann durch Drehen bis zu 24 Lagen annehmen, aber Drehen spiegelt es nie. Bei den meisten Teilen ist das Spiegelbild nur das gedrehte Teil; bei einigen (chiralen) Teilen ist es ein anderes Teil.\nZählt man Spiegelzwillinge getrennt, gibt es 8 Tetrakuben und 29 Pentakuben (sonst 7 und 23).",

    "m.tetra.aria": "Die Mathematik: warum die Tetrakuben bei eins aufhören",
    "m.tetra.title": "Warum eins und nicht zwei",
    "m.tetra.body": "Die 8 Tetrakuben haben zusammen 32 Würfel. Ein leerer Würfel braucht alle 26 um sich.\nZwei leere Würfel brauchen die Würfel zweier 3 × 3 × 3-Blöcke ohne die zwei Zellen: Zwei solche Blöcke teilen höchstens 18 Zellen, also braucht es mindestens 54 − 18 − 2 = 34 Würfel, und 34 ist mehr als 32. Größere Hohlräume brauchen noch mehr: Die kleinsten Mauern wachsen, 26, 34, 42, 44, … für 1, 2, 3, 4 Würfel.",

    "m.bound.aria": "Die Mathematik: wie viel eine Mauer fassen kann",
    "m.bound.title": "Wie viel eine Mauer fassen kann",
    "m.bound.body": "Für jede Größe ist einer der besten Hohlräume, der mit der kleinsten Mauer N(S) ∖ S, ein Fast-Würfel (eine Kiste mit Seiten k oder k + 1, auf einer Fläche ein kleinerer Fast-Würfel): der Satz von Veomett und Radcliffe.\n52 leere Würfel brauchen eine Mauer von 144 Würfeln, 53 schon 146, und die 29 Pentakuben haben nur 145 Würfel. Mauer 1 erreicht 52: 52 ist die Antwort.",

    "m.cover.aria": "Die Mathematik: die Mauer genau füllen",
    "m.cover.title": "Die Mauer genau füllen",
    "m.cover.body": "Ist der Hohlraum S gewählt, ist der Bau seiner Mauer eine exakte Überdeckung: jede Zelle von N(S) ∖ S von genau einem Würfel bedeckt, jedes Teil höchstens einmal benutzt; ein Teil darf in Zellen außerhalb von N(S) ragen, nie in S. Knuths Dancing Links lösen sie.\nFür den Hohlraum von 52: 144 Zellen zu bedecken, 145 Würfel, also ragt genau ein Würfel heraus.",

    "m.wallinfo.aria": "Die Mathematik: diese Mauer",
    "m.wallinfo.title": "Mauer {k}",
    "m.wallinfo.paper.body": "{p} Teile aus {n} Würfeln, {c} Würfel insgesamt; sie schließt {v} leere Würfel ein.\nEine Mauer aus dem Artikel.",
    "m.wallinfo.best.body": "29 Teile aus 5 Würfeln, 145 Würfel; sie schließt 52 leere Würfel ein.\nBesser geht es nicht: 53 leere Würfel bräuchten eine Mauer von 146 Würfeln, und es gibt nur 145. Hier säumen 144 genau den Hohlraum, und ein einziger ragt heraus: Alle 29 Pentakuben werden gebraucht.",

    "m.roominfo.aria": "Die Mathematik: dieser Hohlraum",
    "m.roominfo.title": "Ein Hohlraum aus {k} Würfeln",
    "m.roominfo.title1": "Ein Hohlraum aus 1 Würfel",
    "m.roominfo.body": "Seine kleinste Mauer, N(S) ∖ S, hat {w} Würfel. Die {p} Teile dieses Schritts bringen {c} Würfel: {s} Würfel Spielraum.\nEine Mauer, die es schafft, gibt es: Wir haben eine gefunden.",
    "m.roominfo.f.body": "Seine kleinste Mauer, wenn Leere nur durch Flächen schlüpft, hat {w6} Würfel. Die {p} Teile dieses Schritts bringen {c} Würfel: {s6} Würfel Spielraum.\nEine Mauer, die es schafft, gibt es: Wir haben eine gefunden."
  };

  var en = {
    "m.sec": "Three-dimensional walls",
    "m.ours": "Our argument, not in the paper",

    "m.room.aria": "The math: what counts as inside",
    "m.room.title": "What counts as inside",
    "m.room.body": "Emptiness slips through faces, edges and corners: two empty cubes are neighbours as soon as they share a single corner point. The outside is everything such paths reach from far away.\nWhat is left is shut in. If it falls into several pockets, the volume counts only the largest (pockets touching at a corner are one).",
    "m.room.f.title": "What counts as inside (faces only)",
    "m.room.f.body": "Here emptiness slips through faces only: two empty cubes are neighbours when they share a whole face. The outside is everything such paths reach from far away.\nWhat is left is shut in. If it falls into several pockets, the volume counts only the largest (pockets touching only along an edge or at a corner stay two).",

    "m.wall.aria": "The math: the wall around a pocket",
    "m.wall.title": "The wall around the emptiness",
    "m.wall.body": "To shut in a pocket S (all of it), a wall must hold every cube that shares at least a corner point with S: the set N(S) ∖ S, where N(S) is S together with the 26 neighbours of each of its cubes.",
    "m.wall.f.title": "The wall around the emptiness (faces only)",
    "m.wall.f.body": "To shut in a pocket S (all of it) when emptiness slips through faces only, a wall must hold every cube that shares a face with S: the 6 face neighbours of each of its cubes, less S.",

    "m.cast.aria": "The math: the cast of the emptiness",
    "m.cast.title": "The cast of the emptiness",
    "m.cast.body": "Lift the wall away and the pocket S (all of it) stands alone: the shape of the emptiness the wall shut in.",
    "m.cast52.body": "Lift the wall away and the pocket S (all of it) stands alone: the shape of the emptiness the wall shut in.\nHere it is an almost-cube: a 3 × 4 × 4 box with a 2 × 2 layer on one face, 52 cubes.",

    "m.turn.aria": "The math: turning, never flipping",
    "m.turn.title": "Turning, never flipping",
    "m.turn.body": "A piece can take up to 24 positions by turning, but turning never reflects it. For most pieces the mirror image is just the piece turned around; for a few (chiral) pieces it is a different piece.\nCounted with mirror twins apart, there are 8 tetracubes and 29 pentacubes (7 and 23 otherwise).",

    "m.tetra.aria": "The math: why the tetracubes stop at one",
    "m.tetra.title": "Why one, and not two",
    "m.tetra.body": "The 8 tetracubes make 32 cubes. One empty cube needs all 26 around it.\nTwo empty cubes need the cubes of two 3 × 3 × 3 blocks, less the two cells: two such blocks share at most 18 cells, so at least 54 − 18 − 2 = 34 cubes, and 34 is more than 32. Bigger pockets need even more: the smallest walls grow, 26, 34, 42, 44, … for 1, 2, 3, 4 cubes.",

    "m.bound.aria": "The math: how much a wall can hold",
    "m.bound.title": "How much a wall can hold",
    "m.bound.body": "For every size, one of the best rooms, the one with the smallest wall N(S) ∖ S, is an almost-cube (a box with sides k or k + 1, a smaller almost-cube on one face): the theorem of Veomett and Radcliffe.\n52 cubes of emptiness need a wall of 144 cubes, 53 already 146, and the 29 pentacubes have only 145 cubes. Wall 1 reaches 52, so 52 is the answer.",

    "m.cover.aria": "The math: filling the wall exactly",
    "m.cover.title": "Filling the wall exactly",
    "m.cover.body": "Once the room S is chosen, building its wall is an exact cover: every cell of N(S) ∖ S covered by exactly one cube, every piece used at most once; a piece may poke out into cells outside N(S), never into S. Knuth’s dancing links solve it.\nFor the room of 52: 144 cells to cover, 145 cubes, so exactly one cube pokes out.",

    "m.wallinfo.aria": "The math: this wall",
    "m.wallinfo.title": "Wall {k}",
    "m.wallinfo.paper.body": "{p} pieces of {n} cubes, {c} cubes in all; it shuts in {v} cubes of emptiness.\nA wall of the paper.",
    "m.wallinfo.best.body": "29 pieces of 5 cubes, 145 cubes; it shuts in 52 cubes of emptiness.\nNothing does better: 53 cubes of emptiness would need a wall of 146 cubes, and there are only 145. Here 144 line the room exactly and a single one pokes out: all 29 pentacubes are needed.",

    "m.roominfo.aria": "The math: this room",
    "m.roominfo.title": "A room of {k} cubes",
    "m.roominfo.title1": "A room of 1 cube",
    "m.roominfo.body": "Its smallest wall, N(S) ∖ S, has {w} cubes. The {p} pieces of this step bring {c} cubes: {s} to spare.\nA wall that does it exists: we found one.",
    "m.roominfo.f.body": "Its smallest wall, when emptiness slips through faces only, has {w6} cubes. The {p} pieces of this step bring {c} cubes: {s6} to spare.\nA wall that does it exists: we found one."
  };

  function merge(into, from) { for (var k in from) into[k] = from[k]; }
  if (typeof DICT !== "undefined") { merge(DICT.fr, fr); merge(DICT.de, de); merge(DICT.en, en); }
})();
