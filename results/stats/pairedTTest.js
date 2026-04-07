/**
 * Paired two-tailed t-test.
 *
 * Tests H₀: μ_d = 0 where d_i = b_i − a_i (paired differences).
 * The p-value is computed exactly using the regularised incomplete beta
 * function (Student's t-distribution with df = n − 1):
 *
 *   p = I_{df/(df+t²)}(df/2, 1/2)
 *
 * Reference: Abramowitz & Stegun (1972), §26.7.
 *
 * @module stats/pairedTTest
 */

import { betainc } from "./utils.js";

/**
 * Paired two-tailed t-test.
 *
 * @param {number[]} a – condition A values
 * @param {number[]} b – condition B values (same length, index-aligned)
 * @returns {{
 *   t: number,
 *   df: number,
 *   pValue: number,
 *   significant: boolean,
 *   meanDiff: number
 * }}
 */
export function pairedTTest(a, b) {
  // Build paired differences d = b − a, keeping only finite pairs
  const diffs = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (Number.isFinite(a[i]) && Number.isFinite(b[i])) {
      diffs.push(b[i] - a[i]);
    }
  }

  const n = diffs.length;
  if (n < 2) {
    return { t: NaN, df: NaN, pValue: NaN, significant: false, meanDiff: NaN };
  }

  const dBar = diffs.reduce((s, v) => s + v, 0) / n;
  const variance =
    diffs.reduce((s, v) => s + (v - dBar) ** 2, 0) / (n - 1);
  const se = Math.sqrt(variance / n);

  if (se === 0) {
    // No variance in the differences.
    // If meanDiff is also 0 → no effect whatsoever (p = 1).
    // If meanDiff ≠ 0 → effect is perfectly consistent across all pairs → p → 0.
    const noEffect = dBar === 0;
    return {
      t:           noEffect ? 0 : Infinity,
      df:          n - 1,
      pValue:      noEffect ? 1 : 0,
      significant: !noEffect,
      meanDiff:    dBar,
    };
  }

  const t = dBar / se;
  const df = n - 1;

  // Two-tailed p-value via regularised incomplete beta function
  // P = I_x(df/2, 1/2) where x = df / (df + t²)
  const x = df / (df + t * t);
  const pValue = Math.max(0, Math.min(1, betainc(x, df / 2.0, 0.5)));

  return { t, df, pValue, significant: pValue < 0.05, meanDiff: dBar };
}
