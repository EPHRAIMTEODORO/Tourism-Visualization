/**
 * Arithmetic mean of a numeric array.
 * Non-finite values (NaN, ±Infinity) are silently excluded.
 *
 * @param {number[]} arr
 * @returns {number} mean, or NaN when the array is empty
 */
export function mean(arr) {
  const vals = arr.filter((v) => Number.isFinite(v));
  if (vals.length === 0) return NaN;
  return vals.reduce((sum, v) => sum + v, 0) / vals.length;
}
