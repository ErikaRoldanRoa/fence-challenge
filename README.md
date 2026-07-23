# Fence Challenge

The interactive companion to **"Maximale Zäune mit Polyformen"** by **Alexis
Langlois-Rémillard, Mia N. Müßig, and Érika Roldán** — *Mitteilungen der
Deutschen Mathematiker-Vereinigung* **33**(3), 187–199, 2025
(doi:[10.1515/dmvm-2025-0056](https://doi.org/10.1515/dmvm-2025-0056)). An English
translation is forthcoming on arXiv.

Build fences from polyforms on the three regular tilings of the plane — square,
hexagonal and triangular — and try to enclose the largest possible area. Drag,
rotate, flip and snap the pieces together; the app measures the area you close
off, and the maximum for each board is yours to discover.

Available in **Français · Deutsch · English**.

## Play

**[Open the hub](https://erikaroldanroa.github.io/fence-challenge/)** — three
mini-challenges, one per tiling; solve one to open its full lab. Or go straight
to a lab: [square](square-lab/) · [hexagonal](hex-lab/) · [triangular](triangle-lab/).

## Two companions to the paper

This repository is the **playable** companion — build the fences by hand and
watch the enclosed area grow.

Its **computational** counterpart, by the same team, is
**[`PhoenixSmaug/Pentomino-Farm`](https://github.com/PhoenixSmaug/Pentomino-Farm)**
(Mia N. Müßig): a Julia integer-linear-programming solver that finds and
enumerates the optimal fences across the three tilings — the code behind the
maxima the paper reports.

## Authors

**Alexis Langlois-Rémillard · Mia N. Müßig · Érika Roldán** — alphabetical, equal
contribution, as on the paper.
Interactive app developed by Érika Roldán · [The Learning Machine](https://erikaroldan.net).

## Run locally

Any static file server works, e.g. `python3 -m http.server`, then open
`index.html` in a browser.

## Cite

See [`CITATION.cff`](CITATION.cff). Please cite the paper (DOI above) and, if you
used the app, this repository.

## License

[MIT](LICENSE).
