# Fence Challenge

How much can a fence of polyforms enclose? Playable labs for three papers on
the question, in the plane and in space.

**Play it: https://erikaroldanroa.github.io/fence-challenge/hub/**

## The hub

[hub/](hub/) gathers all the labs on one board. Each grid is an island
(squares, hexagons, triangles, and the cubes below them), each lab is one
tile, and the rows run from the three warm-up missions to the labs of the
first paper and then of *Optimal Polyomino Fences*. A tile shows only its
drawing; pointing at it shows its name and its question, and on a phone a
first tap turns it over and a second tap opens the lab. Under the board, the
papers and their authors; the manual on the right holds each paper with its
abstract once it is public, its links, and how to cite the labs. The interface is available in
French, German and English.

## Optimal Polyomino Fences (2026)

**[Alexis Langlois-Rémillard](https://alexisl-r.github.io/) · [Mia N. Müßig](https://miamuessig.de/) ·
Helmut Podhaisky · [Erika Roldan](https://www.erikaroldan.net/) · Günter Rote ·
Maximilian Brömme · Matthes Norden · Maximilian Prietzel · Daniel Yu ·
Mykhailo Lyader**

Paper: on arXiv soon; the arXiv link and the journal reference will appear
here once available.

The labs, one per result:

- **Cube lab** ([cube-lab/](cube-lab/)): the 29 pentacubes can enclose a
  volume of at most 52 cubes, and a wall reaching 52 exists; the best
  walls found so far for hexacubes (1331) and heptacubes (25872) show how
  far larger pieces go.
  Build walls freely or wrap a given room, cut them open, spread them apart,
  and lift the wall away to hold the room alone. Printable pieces:
  [cube-lab/print/](cube-lab/print/).
- **Hexomino lab** ([hexomino-lab/](hexomino-lab/)): the largest fence the
  35 hexominoes can build encloses 1597 cells. Build your own, reveal the
  optimal one, and switch to its arrow view, where each piece becomes one
  vector and sorting the vectors by direction shows the idea behind the
  proof.
- **Limit-shape lab** ([limit-shape-lab/](limit-shape-lab/)): at 500 cells,
  the longest arrows of 13.5 million random 500-ominoes, sorted into a loop,
  stay within 0.42 % of a circle. Give every piece its longest arrow, sort the
  arrows into a loop, step the size up to 500 cells, and look through the
  loupe at where the loop leaves the circle.
- **Pentomino DP lab** ([pentomino-dp-lab/](pentomino-dp-lab/)): with the 12
  pentominoes, the order of the pieces decides the area: every order reaches
  at least 111, the best reach 128. Choose pieces and an order, watch the
  dynamic program spread step by step, and see the best fence for that order
  close and count its area.

Every element of a lab has a small "∑" chip that opens the mathematics
behind it, with the section of the paper it comes from.

## The follow-up in the Mitteilungen der DMV

In German, in preparation, by the authors of *Optimal Polyomino Fences*. It
answers challenges 11, 12 and 13 of the first paper, which the labs above
let you try: the hexomino lab (challenge 11), the pentomino DP lab
(challenge 12) and the cube lab (challenge 13).

## Maximale Zäune mit Polyformen (2025)

**[Alexis Langlois-Rémillard](https://alexisl-r.github.io/) ·
[Mia N. Müßig](https://miamuessig.de/) ·
[Erika Roldan](https://www.erikaroldan.net/)**

*Mitteilungen der Deutschen Mathematiker-Vereinigung* **33**(3), 187–199,
2025; doi:[10.1515/dmvm-2025-0056](https://doi.org/10.1515/dmvm-2025-0056).

A *fence* is two or more polyforms placed on a regular tiling so that they
enclose an area: the cells they leave uncovered must split into exactly two
regions, one inside and one outside, that share no edge and not even a corner.
The **fence challenge** asks for the largest area you can enclose.

The labs let you build fences by hand on all three regular tilings of the
plane (square: polyominoes, hexagonal: polyhexes, triangular: polyiamonds),
dragging, rotating, flipping and snapping the pieces while the lab
measures the enclosed area. The maximum for each board is left for the player to
discover. The interface is available in French, German and English.

- **The first Fence Challenge page:** [erikaroldanroa.github.io/fence-challenge](https://erikaroldanroa.github.io/fence-challenge/):
  three mini-challenges, one per tiling; close a fence to unlock the full lab
  for each. It is the page for workshops and outreach, with the printable kit
  and the camera below, and the three warm-up tiles of the hub open its
  missions.
- Or open a lab directly:
  [square](square-lab/) · [hexagonal](hex-lab/) · [triangular](triangle-lab/).

### Play on paper

Fences can also be built by hand on the table, with a phone watching.

- **Printable kit:** [kit/](kit/) prints a board and its pieces on A4 or A3,
  with colour ink only, for the three mission boards and the three full
  challenges. The print icon on each mission card of the first Fence
  Challenge page opens its sheets.
- **Camera in the board:** the camera icon on each mission card and in each
  lab of the first paper turns the board itself into the camera window. Once
  the four corner marks are found, the paper board is straightened cell on
  cell under the digital one, the
  enclosed area lights up, and the pieces read on paper are placed on the
  board when they hold still. [camera/](camera/) is the same camera as a page
  of its own, with a photo mode.
- **No guessing:** covered cells that no set of the kit's pieces explains (a
  pencil or a scrap of paper on the board, a piece far off its cells) are
  never judged; the camera keeps the last state it could explain.
- **Private by design:** the picture is analysed on the device and is never
  uploaded or saved. After loading, the page makes no network connections of
  its own (its security policy forbids scripts to open any), so the picture
  never leaves the device.
- The corner marks are standard ArUco markers (4x4 dictionary), so any
  ArUco-aware tool can read the printed sheets.
- Boards from earlier workshops, with a mark on every piece, are also
  recognised.

## Authors

The hub names the authors of each paper, in the order of that paper; in
the labs of the first paper, the credit line links to that paper and names
its authors in its tooltip. Interactive labs developed by Dr. Erika Roldan ·
[The Learning Machine](https://erikaroldan.net).

## Run locally

Serve the folder with any static file server (for example
`python3 -m http.server`) and open `hub/`. The tests, from the repository
root, with the server running on port 8000 where a base address is asked:

- unit tests: `node cube-lab/test/geometry.test.js`,
  `node hexomino-lab/test/fence-math.test.js`,
  `node limit-shape-lab/test/limit-math.test.js`,
  `node pentomino-dp-lab/test/dp.test.js`
- the labs in a browser: `python3 cube-lab/test/browser.py OUTDIR`,
  `python3 hexomino-lab/test/ui_check.py http://localhost:8000/ OUTDIR`,
  `python3 limit-shape-lab/test/ui_check.py http://localhost:8000/ OUTDIR`,
  `python3 pentomino-dp-lab/test/browser.py OUTDIR`
- the hub and the layout of every lab:
  `python3 test/hub_check.py http://localhost:8000/ OUTDIR`,
  `python3 test/labs_layout.py http://localhost:8000/`

## Citation

If you use these labs, please cite the paper they accompany and, optionally,
this repository. A machine-readable entry is in [`CITATION.cff`](CITATION.cff).

> Langlois-Rémillard, A., Müßig, M. N., Podhaisky, H., Roldan, E., Rote, G.,
> Brömme, M., Norden, M., Prietzel, M., Yu, D. & Lyader, M. (2026).
> *Optimal Polyomino Fences.* In preparation.

The labs themselves:

```bibtex
@misc{FenceChallenge,
  author       = {Langlois-R{\'e}millard, Alexis and M{\"u}{\ss}ig, Mia N. and Podhaisky, Helmut and Roldan, Erika and Rote, G{\"u}nter and Br{\"o}mme, Maximilian and Norden, Matthes and Prietzel, Maximilian and Yu, Daniel and Lyader, Mykhailo},
  title        = {Fence Challenge: interactive labs for polyomino fences and polycube walls},
  year         = {2026},
  howpublished = {\url{https://erikaroldanroa.github.io/fence-challenge/hub/}}
}
```

To point to one lab, cite this entry together with the lab's address:

| Lab | Address |
|---|---|
| Cube lab | https://erikaroldanroa.github.io/fence-challenge/cube-lab/ |
| Hexomino lab | https://erikaroldanroa.github.io/fence-challenge/hexomino-lab/ |
| Limit-shape lab | https://erikaroldanroa.github.io/fence-challenge/limit-shape-lab/ |
| Pentomino DP lab | https://erikaroldanroa.github.io/fence-challenge/pentomino-dp-lab/ |

> Langlois-Rémillard, A., Müßig, M. N. & Roldan, E. (2025).
> *Maximale Zäune mit Polyformen.* Mitteilungen der Deutschen
> Mathematiker-Vereinigung, **33**(3), 187–199.
> <https://doi.org/10.1515/dmvm-2025-0056>

An English version of the 2025 paper is available on arXiv:

> Langlois-Rémillard, A., Müßig, M. N. & Roldan, E. (2026).
> *Extremal fences with polyforms.* arXiv:2607.22379.
> <https://arxiv.org/abs/2607.22379>

## License

The code of these labs is released under the [MIT License](LICENSE).

### Third-party components

These components keep their own licences; see the licence file in each
folder.

- **js-aruco2** 2.0.0 (`vendor/js-aruco2/`): the two vendored scripts,
  `cv.js` and `aruco.js`, are under the MIT licence. The upstream licence file,
  [`vendor/js-aruco2/LICENSE.txt`](vendor/js-aruco2/LICENSE.txt), kept exactly
  as published (Windows-1252 text), gathers the notices of everything the
  library builds on: MIT for js-aruco2, BSD for ArUco, the OpenCV licence
  (BSD style), the full GNU LGPLv3 text for the parts derived from AForge.NET
  (those parts are not included here) and MIT for StackBoxBlur. The ArUco
  dictionary data in `vendor/js-aruco2/dictionaries/aruco_4x4_1000.js` comes
  from OpenCV and is under the 3-clause BSD licence printed at the top of that
  file.
- **qrcode-generator** 2.0.4 (`vendor/qrcode-generator/qrcode.js`): MIT, see
  [`vendor/qrcode-generator/LICENSE.txt`](vendor/qrcode-generator/LICENSE.txt).
- **three.js** r147 (`vendor/three/three.min.js`): MIT, see
  [`vendor/three/LICENSE`](vendor/three/LICENSE).
- **Manrope** 4.504 (`fonts/`): SIL Open Font License 1.1, see
  [`fonts/OFL.txt`](fonts/OFL.txt).
