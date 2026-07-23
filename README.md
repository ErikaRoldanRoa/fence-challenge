# Fence Challenge

Interactive companion to **"Maximale Zäune mit Polyformen"** (Langlois-Rémillard,
Müßig & Roldán, *Mitteilungen der Deutschen Mathematiker-Vereinigung* **33**(3),
187–199, 2025 — doi:[10.1515/dmvm-2025-0056](https://doi.org/10.1515/dmvm-2025-0056)).

Build fences from polyforms on the three regular tilings of the plane — square,
hexagonal, triangular — and try to enclose the largest possible area. Drag,
rotate, flip and snap the pieces together; the app measures the area you close
off. The maximum for each board is yours to discover.

Available in **Français · Deutsch · English** — switch top-right.

## Play

**[Open the hub](https://erikaroldanroa.github.io/fence-challenge/)** — three
mini-challenges, one per tiling. Solve one to open its full lab.

Or open a lab directly:
[square](square-lab/) · [hexagonal](hex-lab/) · [triangular](triangle-lab/).

## The mathematics

The tilings, the polyforms, and the fence challenges come from the 2025 DMVM
article (DOI above). The computational side — an integer-linear-programming
solver for the optimal fences — lives in its own repository:
[PhoenixSmaug/Pentomino-Farm](https://github.com/PhoenixSmaug/Pentomino-Farm).
This repository is the *playable* companion.

## Run locally

Any static file server works, e.g.

```bash
python3 -m http.server
```

then open `index.html` in a browser.

## Cite

See [`CITATION.cff`](CITATION.cff). Please cite the article (DOI above) and, if
you used the app, this repository.

## License

[MIT](LICENSE).

---

by Dr. Erika Roldán · **THE LEARNING MACHINE** · [erikaroldan.net](https://erikaroldan.net)
