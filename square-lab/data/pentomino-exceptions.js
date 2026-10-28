/* Fence Challenge · square lab: the configurations (orders of the twelve pentominoes around the inside) whose best
 * fence is 1 or 2 cells below what the dynamic programme gives, because its best boundary overlaps itself or leaves the
 * inside in several parts. Each list holds the sorted ranks of the configurations (best-fence.js says how a rank is
 * made), as little-endian 32-bit numbers in base 64. Generated from the tables of the programme, not written by hand. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PentominoExceptions = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  return {
    below1: "4mNIAZJ3SAE=",
    below2: "",
    counts: { below1: 2, below2: 0 },
  };
});
