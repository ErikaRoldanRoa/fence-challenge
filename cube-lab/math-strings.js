/* Cube lab · the texts of the math chips (FR / DE / EN), read by
 * math-chip.js: title, body and footer per chip. Keys ending in ".f" are
 * the faces-only versions (?conn=6). */
(function () {
  "use strict";
  var NB = " ";

  var fr = {
    "m.sec": "Murailles en trois dimensions",
    "m.ours": "Notre argument, pas dans l’article",

    "m.room.aria": "Qu’est-ce qui compte comme intérieur ?",
    "m.room.title": "Qu’est-ce qui compte comme intérieur ?",
    "m.room.body": "Le vide se faufile par les faces, les arêtes et les coins" + NB + ": deux cubes vides sont voisins dès qu’ils ont un seul sommet en commun. L’extérieur, c’est tout ce que ces chemins atteignent depuis le lointain.\nCe qui reste est enfermé. S’il forme plusieurs poches, le volume ne compte que la plus grande (deux poches qui se touchent par un coin n’en font qu’une).",
    "m.room.f.title": "Qu’est-ce qui compte comme intérieur (faces seules) ?",
    "m.room.f.body": "Ici le vide ne passe que par les faces" + NB + ": deux cubes vides sont voisins s’ils ont une face entière en commun. L’extérieur, c’est tout ce que ces chemins atteignent depuis le lointain.\nCe qui reste est enfermé. S’il forme plusieurs poches, le volume ne compte que la plus grande (deux poches qui ne se touchent que par une arête ou un coin restent deux).",

    "m.wall.aria": "Que doit contenir une muraille ?",
    "m.wall.title": "Que doit contenir une muraille ?",
    "m.wall.body": "Pour enfermer une poche S (toute entière), la muraille doit contenir chaque cube qui a au moins un sommet en commun avec S" + NB + ": l’ensemble N(S) ∖ S, où N(S) est S avec les 26 voisins de chacun de ses cubes.",
    "m.wall.f.title": "Que doit contenir une muraille (faces seules) ?",
    "m.wall.f.body": "Pour enfermer une poche S (toute entière) quand le vide ne passe que par les faces, la muraille doit contenir chaque cube qui a une face commune avec S" + NB + ": les 6 voisins par face de chacun de ses cubes, sauf S.",

    "m.cast.aria": "Qu’est-ce que le moulage ?",
    "m.cast.title": "Qu’est-ce que le moulage ?",
    "m.cast.body": "Enlève la muraille et la poche S (toute entière) reste seule" + NB + ": la forme du vide que la muraille enfermait.",
    "m.cast52.body": "Enlève la muraille et la poche S (toute entière) reste seule" + NB + ": la forme du vide que la muraille enfermait.\nIci c’est un presque-cube" + NB + ": une boîte de 3 × 4 × 4 avec une couche de 2 × 2 sur une face, 52 cubes.",

    "m.turn.aria": "Pourquoi tourner sans retourner ?",
    "m.turn.title": "Pourquoi tourner sans retourner ?",
    "m.turn.body": "Une pièce peut prendre jusqu’à 24 positions en tournant, mais tourner ne la retourne jamais en miroir. Pour la plupart des pièces, l’image miroir n’est que la pièce tournée" + NB + "; pour quelques pièces (dites chirales), c’est une autre pièce.\nEn comptant à part les jumelles miroir, il y a 8 tétracubes et 29 pentacubes (7 et 23 sinon).",

    "m.tetra.aria": "Pourquoi un, et pas deux ?",
    "m.tetra.title": "Pourquoi un, et pas deux ?",
    "m.tetra.body": "Les 8 tétracubes font 32 cubes. Un cube vide demande ses 26 voisins.\nDeux cubes vides demandent les cubes de deux blocs 3 × 3 × 3, moins les deux cases" + NB + ": deux tels blocs ont au plus 18 cases en commun, donc il faut au moins 54 − 18 − 2 = 34 cubes, et 34 dépasse 32. Une poche plus grande en demande encore plus" + NB + ": les plus petites murailles grandissent, 26, 34, 42, 44, … pour 1, 2, 3, 4 cubes.",

    "m.bound.aria": "Combien une muraille peut-elle contenir ?",
    "m.bound.title": "Combien une muraille peut-elle contenir ?",
    "m.bound.body": "Pour chaque taille, une des meilleures poches, celle dont la muraille N(S) ∖ S est la plus petite, est un presque-cube (une boîte de côtés k ou k + 1, un presque-cube plus petit sur une face)" + NB + ": c’est le théorème de Veomett et Radcliffe.\n52 cubes de vide demandent une muraille de 144 cubes, 53 déjà 146, et les 29 pentacubes n’ont que 145 cubes. La muraille 1 atteint 52" + NB + ": 52 est la réponse.",

    "m.cover.aria": "Comment remplir exactement la muraille ?",
    "m.cover.title": "Comment remplir exactement la muraille ?",
    "m.cover.body": "La poche S choisie, bâtir sa muraille est une couverture exacte" + NB + ": chaque case de N(S) ∖ S couverte par exactement un cube, chaque pièce utilisée au plus une fois" + NB + "; une pièce peut dépasser dans des cases hors de N(S), jamais dans S. Les liens dansants de Knuth la résolvent.\nPour la poche de 52" + NB + ": 144 cases à couvrir, 145 cubes, donc exactement un cube dépasse.",

    "m.wallinfo.aria": "Qu’a cette muraille de particulier ?",
    "m.wallinfo.title": "Qu’a cette muraille de particulier ?",
    "m.wallinfo.paper.body": "{p} pièces de {n} cubes, {c} cubes en tout" + NB + "; elle enferme {v} cubes de vide.\nUne muraille de l’article.",
    "m.wallinfo.best.body": "29 pièces de 5 cubes, 145 cubes" + NB + "; elle enferme 52 cubes de vide.\nOn ne peut pas faire mieux" + NB + ": 53 cubes de vide demanderaient une muraille de 146 cubes, et il n’y en a que 145. Ici 144 bordent exactement la poche et un seul dépasse" + NB + ": il faut les 29 pentacubes, tous.",

    "m.roominfo.aria": "Que faut-il pour emballer cette poche ?",
    "m.roominfo.title": "Que faut-il pour emballer cette poche ?",
    "m.roominfo.title1": "Que faut-il pour emballer cette poche ?",
    "m.roominfo.body": "Sa plus petite muraille, N(S) ∖ S, compte {w} cubes. Les {p} pièces de cette étape apportent {c} cubes" + NB + ": {s} de marge.\nUne muraille qui y parvient existe" + NB + ": nous en avons trouvé une.",
    "m.roominfo.f.body": "Sa plus petite muraille, quand seules les faces laissent passer le vide, compte {w6} cubes. Les {p} pièces de cette étape apportent {c} cubes" + NB + ": {s6} de marge.\nUne muraille qui y parvient existe" + NB + ": nous en avons trouvé une."
  };

  var de = {
    "m.sec": "Dreidimensionale Mauern",
    "m.ours": "Unser Argument, nicht im Artikel",

    "m.room.aria": "Was zählt als innen?",
    "m.room.title": "Was zählt als innen?",
    "m.room.body": "Leere schlüpft durch Flächen, Kanten und Ecken: Zwei leere Würfel sind Nachbarn, sobald sie einen einzigen Eckpunkt teilen. Außen ist alles, was solche Wege von weit her erreichen.\nWas übrig bleibt, ist eingeschlossen. Zerfällt es in mehrere Hohlräume, zählt nur der größte (Hohlräume, die sich an einer Ecke berühren, sind einer).",
    "m.room.f.title": "Was zählt als innen (nur Flächen)?",
    "m.room.f.body": "Hier schlüpft Leere nur durch Flächen: Zwei leere Würfel sind Nachbarn, wenn sie eine ganze Fläche teilen. Außen ist alles, was solche Wege von weit her erreichen.\nWas übrig bleibt, ist eingeschlossen. Zerfällt es in mehrere Hohlräume, zählt nur der größte (Hohlräume, die sich nur an einer Kante oder Ecke berühren, bleiben zwei).",

    "m.wall.aria": "Was muss eine Mauer enthalten?",
    "m.wall.title": "Was muss eine Mauer enthalten?",
    "m.wall.body": "Um einen Hohlraum S (ganz) einzuschließen, muss die Mauer jeden Würfel enthalten, der mit S mindestens einen Eckpunkt teilt: die Menge N(S) ∖ S, wobei N(S) aus S und den 26 Nachbarn jedes seiner Würfel besteht.",
    "m.wall.f.title": "Was muss eine Mauer enthalten (nur Flächen)?",
    "m.wall.f.body": "Um einen Hohlraum S (ganz) einzuschließen, wenn Leere nur durch Flächen schlüpft, muss die Mauer jeden Würfel enthalten, der mit S eine Fläche teilt: die 6 Flächennachbarn jedes seiner Würfel, ohne S.",

    "m.cast.aria": "Was ist der Abguss?",
    "m.cast.title": "Was ist der Abguss?",
    "m.cast.body": "Nimm die Mauer weg, und der Hohlraum S (ganz) steht allein: die Form der Leere, die die Mauer eingeschlossen hat.",
    "m.cast52.body": "Nimm die Mauer weg, und der Hohlraum S (ganz) steht allein: die Form der Leere, die die Mauer eingeschlossen hat.\nHier ist es ein Fast-Würfel: eine 3 × 4 × 4-Kiste mit einer 2 × 2-Schicht auf einer Fläche, 52 Würfel.",

    "m.turn.aria": "Warum drehen, nie spiegeln?",
    "m.turn.title": "Warum drehen, nie spiegeln?",
    "m.turn.body": "Ein Teil kann durch Drehen bis zu 24 Lagen annehmen, aber Drehen spiegelt es nie. Bei den meisten Teilen ist das Spiegelbild nur das gedrehte Teil; bei einigen (chiralen) Teilen ist es ein anderes Teil.\nZählt man Spiegelzwillinge getrennt, gibt es 8 Tetrakuben und 29 Pentakuben (sonst 7 und 23).",

    "m.tetra.aria": "Warum eins und nicht zwei?",
    "m.tetra.title": "Warum eins und nicht zwei?",
    "m.tetra.body": "Die 8 Tetrakuben haben zusammen 32 Würfel. Ein leerer Würfel braucht alle 26 um sich.\nZwei leere Würfel brauchen die Würfel zweier 3 × 3 × 3-Blöcke ohne die zwei Zellen: Zwei solche Blöcke teilen höchstens 18 Zellen, also braucht es mindestens 54 − 18 − 2 = 34 Würfel, und 34 ist mehr als 32. Größere Hohlräume brauchen noch mehr: Die kleinsten Mauern wachsen, 26, 34, 42, 44, … für 1, 2, 3, 4 Würfel.",

    "m.bound.aria": "Wie viel kann eine Mauer fassen?",
    "m.bound.title": "Wie viel kann eine Mauer fassen?",
    "m.bound.body": "Für jede Größe ist einer der besten Hohlräume, der mit der kleinsten Mauer N(S) ∖ S, ein Fast-Würfel (eine Kiste mit Seiten k oder k + 1, auf einer Fläche ein kleinerer Fast-Würfel): der Satz von Veomett und Radcliffe.\n52 leere Würfel brauchen eine Mauer von 144 Würfeln, 53 schon 146, und die 29 Pentakuben haben nur 145 Würfel. Mauer 1 erreicht 52: 52 ist die Antwort.",

    "m.cover.aria": "Wie füllt man die Mauer genau?",
    "m.cover.title": "Wie füllt man die Mauer genau?",
    "m.cover.body": "Ist der Hohlraum S gewählt, ist der Bau seiner Mauer eine exakte Überdeckung: jede Zelle von N(S) ∖ S von genau einem Würfel bedeckt, jedes Teil höchstens einmal benutzt; ein Teil darf in Zellen außerhalb von N(S) ragen, nie in S. Knuths Dancing Links lösen sie.\nFür den Hohlraum von 52: 144 Zellen zu bedecken, 145 Würfel, also ragt genau ein Würfel heraus.",

    "m.wallinfo.aria": "Was ist an dieser Mauer besonders?",
    "m.wallinfo.title": "Was ist an dieser Mauer besonders?",
    "m.wallinfo.paper.body": "{p} Teile aus {n} Würfeln, {c} Würfel insgesamt; sie schließt {v} leere Würfel ein.\nEine Mauer aus dem Artikel.",
    "m.wallinfo.best.body": "29 Teile aus 5 Würfeln, 145 Würfel; sie schließt 52 leere Würfel ein.\nBesser geht es nicht: 53 leere Würfel bräuchten eine Mauer von 146 Würfeln, und es gibt nur 145. Hier säumen 144 genau den Hohlraum, und ein einziger ragt heraus: Alle 29 Pentakuben werden gebraucht.",

    "m.roominfo.aria": "Was braucht man, um diesen Hohlraum einzuschließen?",
    "m.roominfo.title": "Was braucht man, um diesen Hohlraum einzuschließen?",
    "m.roominfo.title1": "Was braucht man, um diesen Hohlraum einzuschließen?",
    "m.roominfo.body": "Seine kleinste Mauer, N(S) ∖ S, hat {w} Würfel. Die {p} Teile dieses Schritts bringen {c} Würfel: {s} Würfel Spielraum.\nEine Mauer, die es schafft, gibt es: Wir haben eine gefunden.",
    "m.roominfo.f.body": "Seine kleinste Mauer, wenn Leere nur durch Flächen schlüpft, hat {w6} Würfel. Die {p} Teile dieses Schritts bringen {c} Würfel: {s6} Würfel Spielraum.\nEine Mauer, die es schafft, gibt es: Wir haben eine gefunden."
  };

  var en = {
    "m.sec": "Three-dimensional walls",
    "m.ours": "Our argument, not in the paper",

    "m.room.aria": "What counts as inside?",
    "m.room.title": "What counts as inside?",
    "m.room.body": "Emptiness slips through faces, edges and corners: two empty cubes are neighbours as soon as they share a single corner point. The outside is everything such paths reach from far away.\nWhat is left is shut in. If it falls into several pockets, the volume counts only the largest (pockets touching at a corner are one).",
    "m.room.f.title": "What counts as inside (faces only)?",
    "m.room.f.body": "Here emptiness slips through faces only: two empty cubes are neighbours when they share a whole face. The outside is everything such paths reach from far away.\nWhat is left is shut in. If it falls into several pockets, the volume counts only the largest (pockets touching only along an edge or at a corner stay two).",

    "m.wall.aria": "What must a wall hold?",
    "m.wall.title": "What must a wall hold?",
    "m.wall.body": "To shut in a pocket S (all of it), a wall must hold every cube that shares at least a corner point with S: the set N(S) ∖ S, where N(S) is S together with the 26 neighbours of each of its cubes.",
    "m.wall.f.title": "What must a wall hold (faces only)?",
    "m.wall.f.body": "To shut in a pocket S (all of it) when emptiness slips through faces only, a wall must hold every cube that shares a face with S: the 6 face neighbours of each of its cubes, less S.",

    "m.cast.aria": "What is the cast?",
    "m.cast.title": "What is the cast?",
    "m.cast.body": "Lift the wall away and the pocket S (all of it) stands alone: the shape of the emptiness the wall shut in.",
    "m.cast52.body": "Lift the wall away and the pocket S (all of it) stands alone: the shape of the emptiness the wall shut in.\nHere it is an almost-cube: a 3 × 4 × 4 box with a 2 × 2 layer on one face, 52 cubes.",

    "m.turn.aria": "Why turn but never flip?",
    "m.turn.title": "Why turn but never flip?",
    "m.turn.body": "A piece can take up to 24 positions by turning, but turning never reflects it. For most pieces the mirror image is just the piece turned around; for a few (chiral) pieces it is a different piece.\nCounted with mirror twins apart, there are 8 tetracubes and 29 pentacubes (7 and 23 otherwise).",

    "m.tetra.aria": "Why one, and not two?",
    "m.tetra.title": "Why one, and not two?",
    "m.tetra.body": "The 8 tetracubes make 32 cubes. One empty cube needs all 26 around it.\nTwo empty cubes need the cubes of two 3 × 3 × 3 blocks, less the two cells: two such blocks share at most 18 cells, so at least 54 − 18 − 2 = 34 cubes, and 34 is more than 32. Bigger pockets need even more: the smallest walls grow, 26, 34, 42, 44, … for 1, 2, 3, 4 cubes.",

    "m.bound.aria": "How much can a wall hold?",
    "m.bound.title": "How much can a wall hold?",
    "m.bound.body": "For every size, one of the best rooms, the one with the smallest wall N(S) ∖ S, is an almost-cube (a box with sides k or k + 1, a smaller almost-cube on one face): the theorem of Veomett and Radcliffe.\n52 cubes of emptiness need a wall of 144 cubes, 53 already 146, and the 29 pentacubes have only 145 cubes. Wall 1 reaches 52, so 52 is the answer.",

    "m.cover.aria": "How is the wall filled exactly?",
    "m.cover.title": "How is the wall filled exactly?",
    "m.cover.body": "Once the room S is chosen, building its wall is an exact cover: every cell of N(S) ∖ S covered by exactly one cube, every piece used at most once; a piece may poke out into cells outside N(S), never into S. Knuth’s dancing links solve it.\nFor the room of 52: 144 cells to cover, 145 cubes, so exactly one cube pokes out.",

    "m.wallinfo.aria": "What is special about this wall?",
    "m.wallinfo.title": "What is special about this wall?",
    "m.wallinfo.paper.body": "{p} pieces of {n} cubes, {c} cubes in all; it shuts in {v} cubes of emptiness.\nA wall of the paper.",
    "m.wallinfo.best.body": "29 pieces of 5 cubes, 145 cubes; it shuts in 52 cubes of emptiness.\nNothing does better: 53 cubes of emptiness would need a wall of 146 cubes, and there are only 145. Here 144 line the room exactly and a single one pokes out: all 29 pentacubes are needed.",

    "m.roominfo.aria": "What does it take to wrap this room?",
    "m.roominfo.title": "What does it take to wrap this room?",
    "m.roominfo.title1": "What does it take to wrap this room?",
    "m.roominfo.body": "Its smallest wall, N(S) ∖ S, has {w} cubes. The {p} pieces of this step bring {c} cubes: {s} to spare.\nA wall that does it exists: we found one.",
    "m.roominfo.f.body": "Its smallest wall, when emptiness slips through faces only, has {w6} cubes. The {p} pieces of this step bring {c} cubes: {s6} to spare.\nA wall that does it exists: we found one."
  };

  function merge(into, from) { for (var k in from) into[k] = from[k]; }
  if (typeof DICT !== "undefined") { merge(DICT.fr, fr); merge(DICT.de, de); merge(DICT.en, en); }
})();
