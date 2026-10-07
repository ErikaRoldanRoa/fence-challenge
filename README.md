# Fence Challenge

How much can a fence of polyforms enclose? Playable labs for two papers on
the question, in the plane and in space.

**Play it: https://erikaroldanroa.github.io/fence-challenge/**

## Optimal Polyomino Fences (2026)

**Maximilian Brömme · [Alexis Langlois-Rémillard](https://alexisl-r.github.io/) ·
Mykhailo Lyader · [Mia N. Müßig](https://miamuessig.de/) ·
Helmut Podhaisky · Maximilian Prietzel ·
[Erika Roldán](https://www.erikaroldan.net/) · Günter Rote · Daniel Yu**

Paper: on arXiv soon; the arXiv link and the journal reference will appear
here once available.

The labs, one per result:

- **Cube lab** ([cube-lab/](cube-lab/)): the 29 pentacubes can enclose a
  volume of at most 52 cubes, and a wall reaching 52 exists; walls of
  hexacubes (1331) and heptacubes (25544) show how far larger pieces go.
  Build walls freely or wrap a given room, cut them open, spread them apart,
  and lift the wall away to hold the room alone. Printable pieces:
  [cube-lab/print/](cube-lab/print/).
- **Hexomino lab** ([hexomino-lab/](hexomino-lab/)): the largest fence the
  35 hexominoes can build encloses 1597 cells. Build your own, reveal the
  optimal one, and switch to its arrow view, where each piece becomes one
  vector and sorting the vectors by direction shows the idea behind the
  proof.
- **Limit-shape lab** ([limit-shape-lab/](limit-shape-lab/)): the best fences
  of very large pieces are close to round but not round: at 500 cells their
  shape bulges out by 0.4 % at the diagonal. Give every piece its longest
  arrow, sort the arrows into a loop, step the size up to 500 cells, and look
  through the loupe at where the loop leaves the circle.
- **Pentomino DP lab** ([pentomino-dp-lab/](pentomino-dp-lab/)): with the 12
  pentominoes, the order of the pieces decides the area: every order reaches
  at least 111, the best reach 128. Choose pieces and an order, watch the
  dynamic program spread step by step, and see the best fence for that order
  close and count its area.

Every element of a lab has a small "∑" chip that opens the mathematics
behind it, with the section of the paper it comes from. One hub bringing all
the labs together is coming.

## Maximale Zäune mit Polyformen (2025)

**[Alexis Langlois-Rémillard](https://alexisl-r.github.io/) ·
[Mia N. Müßig](https://miamuessig.de/) ·
[Erika Roldán](https://www.erikaroldan.net/)**

*Mitteilungen der Deutschen Mathematiker-Vereinigung* **33**(3), 187–199,
2025; doi:[10.1515/dmvm-2025-0056](https://doi.org/10.1515/dmvm-2025-0056).

A *fence* is two or more polyforms placed on a regular tiling so that they
enclose an area: the cells they leave uncovered must split into exactly two
regions, one inside and one outside, that share no edge and not even a corner.
The **fence challenge** asks for the largest area you can enclose.

The labs let you build fences by hand on all three regular tilings of the
plane (square: polyominoes, hexagonal: polyhexes, triangular: polyiamonds),
dragging, rotating, flipping and snapping the pieces while it
measures the enclosed area. The maximum for each board is left for the player to
discover. The interface is available in French, German and English.

The companion comes in two parts, by the same team. **This repository is the
interactive, playable side.** Its computational counterpart is
[`PhoenixSmaug/Pentomino-Farm`](https://github.com/PhoenixSmaug/Pentomino-Farm),
a Julia integer-linear-programming solver (Gurobi) that finds and enumerates the
optimal fences across the three tilings.

- **Hub:** [erikaroldanroa.github.io/fence-challenge](https://erikaroldanroa.github.io/fence-challenge/):
  three mini-challenges, one per tiling; close a fence to unlock the full lab
  for each.
- Or open a lab directly:
  [square](square-lab/) · [hexagonal](hex-lab/) · [triangular](triangle-lab/).

### Play on paper

Fences can also be built by hand on the table, with a phone watching.

- **Printable kit:** [kit/](kit/) prints a board and its pieces on A4 or A3,
  with colour ink only, for the three hub boards and the three full
  challenges. The print icon on each hub card opens its sheets.
- **Camera in the board:** the camera icon on each hub card and lab turns the
  board itself into the camera window. Once the four corner marks are found,
  the paper board is straightened cell on cell under the digital one, the
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

Each lab carries the authors of the paper it accompanies, listed
alphabetically, equal contribution, as on each paper. Interactive labs
developed by Dr. Erika Roldán · [The Learning Machine](https://erikaroldan.net).

## Run locally

Serve the folder with any static file server (for example
`python3 -m http.server`) and open `index.html`. Tests of the cube lab:
`node cube-lab/test/geometry.test.js` and `python3 cube-lab/test/browser.py OUTDIR`.

## Citation

If you use these labs, please cite the paper they accompany and, optionally,
this repository. A machine-readable entry is in [`CITATION.cff`](CITATION.cff).

> Brömme, M., Langlois-Rémillard, A., Lyader, M., Müßig, M. N., Podhaisky, H.,
> Prietzel, M., Roldán, É., Rote, G. & Yu, D. (2026).
> *Optimal Polyomino Fences.* In preparation.

> Langlois-Rémillard, A., Müßig, M. N. & Roldán, É. (2025).
> *Maximale Zäune mit Polyformen.* Mitteilungen der Deutschen
> Mathematiker-Vereinigung, **33**(3), 187–199.
> <https://doi.org/10.1515/dmvm-2025-0056>

An English version of the 2025 paper is available on arXiv:

> Langlois-Rémillard, A., Müßig, M. N. & Roldán, É. (2026).
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
