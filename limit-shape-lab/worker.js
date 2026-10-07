/* Fence Challenge · limit-shape lab: the heavy work, off the page's thread.
 * "pieces": every free n-omino with its longest arrows.
 * "giant": a running chain of 500-ominoes, one sample every 8 n proposals,
 * started from a 500-omino that already went through a burn-in. */
importScripts("sampler.js?v=20261007i", "data/start500.js?v=20261007i");

var S = self.LimitSampler;
var chain = null, running = false, samples = 0, left = 0;

function piecesFor(n) {
  return S.enumerateFree(n).map(function (cells) {
    var dm = S.diameters(cells);
    return { cells: cells, pairs: dm.pairs, vecs: S.sampleVectors(cells) };
  });
}

function giantSlice() {
  if (!running) return;
  var t0 = Date.now();
  if (left <= 0) left = S.gap(chain.n);
  while (left > 0 && Date.now() - t0 < 40) { chain.step(); left--; }
  if (left <= 0) {
    samples++;
    var cells = chain.cells();
    self.postMessage({ type: "giant", cells: cells, pairs: S.diameters(cells).pairs, samples: samples });
  }
  setTimeout(giantSlice, 0);
}

self.onmessage = function (e) {
  var m = e.data || {};
  if (m.cmd === "pieces") {
    self.postMessage({ type: "pieces", n: m.n, id: m.id, pieces: piecesFor(m.n) });
  } else if (m.cmd === "giant") {
    if (m.run && !running) {
      if (!chain) {
        chain = new S.Chain(1, m.seed || 1);
        chain.load(self.LIMIT_START500);
        var cells = chain.cells();
        self.postMessage({ type: "giant", cells: cells, pairs: S.diameters(cells).pairs, samples: samples });
      }
      running = true;
      giantSlice();
    } else if (!m.run) running = false;
  }
};
