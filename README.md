# Fence Challenge

**Alexis Langlois-Rémillard · Mia N. Müßig · Erika Roldán**

An interactive companion to the paper **"Maximale Zäune mit Polyformen"** by
Alexis Langlois-Rémillard, Mia N. Müßig and Erika Roldán (*Mitteilungen der
Deutschen Mathematiker-Vereinigung* **33**(3), 187–199, 2025;
doi:[10.1515/dmvm-2025-0056](https://doi.org/10.1515/dmvm-2025-0056)).

**Play it: https://erikaroldanroa.github.io/fence-challenge/**

## Overview

A *fence* is two or more polyforms placed on a regular tiling so that they
enclose an area: the tiles they leave uncovered must split into exactly two
regions — an inside and an outside — that share no edge, and not even a corner.
The **fence challenge** asks for the largest area you can enclose.

This app lets you build fences by hand on all three regular tilings of the
plane — square (polyominoes), hexagonal (polyhexes) and triangular
(polyiamonds) — dragging, rotating, flipping and snapping the pieces while it
measures the enclosed area. The maximum for each board is left for the player to
discover. The interface is available in French, German and English.

The companion comes in two parts, by the same team. **This repository is the
interactive, playable side.** Its computational counterpart is
[`PhoenixSmaug/Pentomino-Farm`](https://github.com/PhoenixSmaug/Pentomino-Farm) —
a Julia integer-linear-programming solver (Gurobi) that finds and enumerates the
optimal fences across the three tilings.

## Play

- **Hub:** [erikaroldanroa.github.io/fence-challenge](https://erikaroldanroa.github.io/fence-challenge/)
  — three mini-challenges, one per tiling; enclose an area to unlock the full
  lab for each.
- Or open a lab directly:
  [square](square-lab/) · [hexagonal](hex-lab/) · [triangular](triangle-lab/).

To run locally, serve the folder with any static file server — for example
`python3 -m http.server` — and open `index.html`.

## Authors

- **Alexis Langlois-Rémillard** — <https://alexisl-r.github.io/>
- **Mia N. Müßig** — <https://miamuessig.de/>
- **Erika Roldán** — <https://www.erikaroldan.net/>

Listed alphabetically, equal contribution, as on the paper. Interactive app
developed by Dr. Erika Roldán · [The Learning Machine](https://erikaroldan.net).

## Citation

If you use this app, please cite the paper and, optionally, this repository. A
machine-readable entry is in [`CITATION.cff`](CITATION.cff).

> Langlois-Rémillard, A., Müßig, M. N. & Roldán, É. (2025).
> *Maximale Zäune mit Polyformen.* Mitteilungen der Deutschen
> Mathematiker-Vereinigung, **33**(3), 187–199.
> <https://doi.org/10.1515/dmvm-2025-0056>

An English translation is forthcoming on arXiv.

## License

Released under the [MIT License](LICENSE).
