/**
 * Median of a numeric array.
 * Non-finite values (NaN, ±Infinity) are silently excluded.
 * Uses the lower-upper average convention for even-length arrays.
 *
 * @param {number[]} arr
 * @returns {number} median, or NaN when the array is empty
 */
export function median(arr) {
  const vals = [...arr]
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  if (vals.length === 0) return NaN;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 === 0
    ? (vals[mid - 1] + vals[mid]) / 2
    : vals[mid];
}
