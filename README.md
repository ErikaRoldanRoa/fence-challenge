# Fence Challenge

**Alexis Langlois-Rémillard · Mia N. Müßig · Erika Roldán**

An interactive companion to the paper **"Maximale Zäune mit Polyformen"** by
Alexis Langlois-Rémillard, Mia N. Müßig and Erika Roldán (*Mitteilungen der
Deutschen Mathematiker-Vereinigung* **33**(3), 187–199, 2025;
doi:[10.1515/dmvm-2025-0056](https://doi.org/10.1515/dmvm-2025-0056)).

**Play it: https://erikaroldanroa.github.io/fence-challenge/**

## Overview

A *fence* is two or more polyforms placed on a regular tiling so that they
enclose an area: the cells they leave uncovered must split into exactly two
regions, one inside and one outside, that share no edge and not even a corner.
The **fence challenge** asks for the largest area you can enclose.

This app lets you build fences by hand on all three regular tilings of the
plane (square: polyominoes, hexagonal: polyhexes, triangular: polyiamonds),
dragging, rotating, flipping and snapping the pieces while it
measures the enclosed area. The maximum for each board is left for the player to
discover. The interface is available in French, German and English.

The companion comes in two parts, by the same team. **This repository is the
interactive, playable side.** Its computational counterpart is
[`PhoenixSmaug/Pentomino-Farm`](https://github.com/PhoenixSmaug/Pentomino-Farm),
a Julia integer-linear-programming solver (Gurobi) that finds and enumerates the
optimal fences across the three tilings.

## Play

- **Hub:** [erikaroldanroa.github.io/fence-challenge](https://erikaroldanroa.github.io/fence-challenge/):
  three mini-challenges, one per tiling; close a fence to unlock the full lab
  for each.
- Or open a lab directly:
  [square](square-lab/) · [hexagonal](hex-lab/) · [triangular](triangle-lab/).

To run locally, serve the folder with any static file server (for example
`python3 -m http.server`) and open `index.html`.

## Play on paper

Fences can also be built by hand on the table, with a phone watching.

- **Printable kit:** [kit/](kit/) prints a board and its pieces at actual size
  (A4 or A3), for the three hub boards and the three full challenges.
- **Camera:** [camera/](camera/) follows the paper board through the phone's
  camera and lights up the enclosed area right on the picture. A board built on
  paper (the three hub boards and the 20 x 20 square board) can then be
  continued on screen.
- **Private by design:** the picture is analysed on the device and is never
  uploaded or saved. After loading, the page makes no network connections of
  its own (its security policy forbids scripts to open any), so the picture
  never leaves the device.
- The corner marks are standard ArUco markers (4x4 dictionary), so any
  ArUco-aware tool can read the printed sheets.
- Boards from earlier workshops, with a mark on every piece, are also
  recognised.

## Authors

- **Alexis Langlois-Rémillard**: <https://alexisl-r.github.io/>
- **Mia N. Müßig**: <https://miamuessig.de/>
- **Erika Roldán**: <https://www.erikaroldan.net/>

Listed alphabetically, equal contribution, as on the paper. Interactive app
developed by Dr. Erika Roldán · [The Learning Machine](https://erikaroldan.net).

## Citation

If you use this app, please cite the paper and, optionally, this repository. A
machine-readable entry is in [`CITATION.cff`](CITATION.cff).

> Langlois-Rémillard, A., Müßig, M. N. & Roldán, É. (2025).
> *Maximale Zäune mit Polyformen.* Mitteilungen der Deutschen
> Mathematiker-Vereinigung, **33**(3), 187–199.
> <https://doi.org/10.1515/dmvm-2025-0056>

An English version is available on arXiv:

> Langlois-Rémillard, A., Müßig, M. N. & Roldán, É. (2026).
> *Extremal fences with polyforms.* arXiv:2607.22379.
> <https://arxiv.org/abs/2607.22379>

## License

The code of this app is released under the [MIT License](LICENSE).

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
- **Manrope** 4.504 (`fonts/`): SIL Open Font License 1.1, see
  [`fonts/OFL.txt`](fonts/OFL.txt).
