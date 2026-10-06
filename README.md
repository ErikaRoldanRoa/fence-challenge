# Fence Challenge

How much can a fence of polyforms enclose? Playable labs for two papers on
the question, in the plane and in space.

**Play it: https://erikaroldanroa.github.io/fence-challenge/**

## Optimal Polyomino Fences (2026)

**[Authors]**

The follow-up to the 2025 paper settles the open challenges it left: the
largest fence that the 35 hexominoes can build, found by dynamic programming
and proved optimal, the shape that the best fences of larger pieces tend to,
and walls of polycubes in space, which enclose a volume.

- **Cube lab** ([cube-lab/](cube-lab/)): walls in space. A wall of polycubes
  encloses the empty cubes the outside cannot reach, and the outside slips
  through faces, edges and corners alike. Pieces turn in space but never
  flip: a mirror image is a piece of its own. Two ways to play, with the 8
  tetracubes and with the 29 pentacubes:
  - *explore*: build freely and watch the enclosed volume light up, open the
    walls of the paper, spread them apart, cut them open layer by layer, see
    them from below, and lift the wall away to hold the room alone;
  - *wrap the room*: a room is given, from a single cube upward; build a wall
    that shuts it in. Every room offered has a wall that does it.

  Every element has a small "∑" chip that opens the mathematics behind it,
  with the section of the paper it comes from.
- **Print kit** ([cube-lab/print/](cube-lab/print/)): STL files of every
  tetracube, every pentacube and every room of *wrap the room*, 15 mm cubes
  with 0.15 mm of clearance and 0.6 mm chamfers, laid flat with no support
  wherever a piece allows it, on plates for a 220 x 220 mm bed, with a
  preview of each plate; one zip per kit
  (`python3 cube-lab/tools/make-print.py` rebuilds them).
- **Hexomino lab** ([hexomino-lab/](hexomino-lab/)): the 35 hexominoes and
  the search for their largest fence.
- **Reference-vector lab**: how a fence's area is read from
  the vectors between its pieces' attachment edges.

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

> [Authors] (2026). *Optimal Polyomino Fences.*

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
