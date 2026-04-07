/**
 * Wilcoxon signed-rank test (two-tailed).
 *
 * A non-parametric alternative to the paired t-test that does not assume
 * normality of the difference distribution.
 *
 * Algorithm:
 *   1. Compute paired differences d_i = b_i − a_i.
 *   2. Discard zero differences (ties at zero).
 *   3. Rank the absolute differences |d_i|, averaging tied ranks.
 *   4. Compute T⁺ = sum of ranks for positive differences.
 *   5. Use a normal approximation (valid for n ≥ 8) with continuity
 *      correction; adjust variance for tied ranks.
 *
 * References:
 *   Wilcoxon, F. (1945). Individual comparisons by ranking methods.
 *   Zar, J.H. (2010). Biostatistical Analysis, 5th ed., §9.5.
 *
 * @module stats/wilcoxonSignedRank
 */

import { normalCDF } from "./utils.js";

/**
 * Wilcoxon signed-rank test.
 *
 * @param {number[]} a – condition A values
 * @param {number[]} b – condition B values (same length, index-aligned)
 * @returns {{
 *   W: number,        W statistic (T⁺, sum of positive ranks)
 *   z: number,        z-score (normal approximation)
 *   pValue: number,   two-tailed p-value
 *   n: number,        effective sample size (after removing zero differences)
 *   significant: boolean
 * }}
 */
export function wilcoxonSignedRank(a, b) {
  // ── Step 1: paired differences ───────────────────────────────────────────
  const diffs = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (Number.isFinite(a[i]) && Number.isFinite(b[i])) {
      diffs.push(b[i] - a[i]);
    }
  }

  // ── Step 2: remove zero differences ─────────────────────────────────────
  const nonZero = diffs.filter((d) => d !== 0);
  const n = nonZero.length;

  if (n < 1) {
    return { W: NaN, z: NaN, pValue: 1, n: 0, significant: false };
  }

  // ── Step 3: rank |d_i| with average ranks for ties ──────────────────────
  const indexed = nonZero.map((d, i) => ({ d, abs: Math.abs(d), i }));
  indexed.sort((x, y) => x.abs - y.abs);

  const ranks = new Array(n);
  let k = 0;
  while (k < n) {
    let j = k;
    // Find end of tie group
    while (j < n - 1 && indexed[j + 1].abs === indexed[k].abs) j++;
    const avgRank = (k + 1 + j + 1) / 2; // average of 1-based ranks
    for (let m = k; m <= j; m++) ranks[indexed[m].i] = avgRank;
    k = j + 1;
  }

  // ── Step 4: T⁺ ──────────────────────────────────────────────────────────
  let Tplus = 0;
  for (let i = 0; i < n; i++) {
    if (nonZero[i] > 0) Tplus += ranks[i];
  }

  // ── Step 5: normal approximation with continuity correction and tie ──────
  //   correction to the variance
  //
  //   E[T⁺]   = n(n+1)/4
  //   Var[T⁺] = n(n+1)(2n+1)/24  −  Σ_j t_j(t_j²−1)/48
  //             where t_j = size of j-th tie group
  const mu = (n * (n + 1)) / 4.0;
  let varBase = (n * (n + 1) * (2 * n + 1)) / 24.0;

  // Tie correction: group by absolute value
  const tieGroups = {};
  for (const { abs } of indexed) {
    tieGroups[abs] = (tieGroups[abs] || 0) + 1;
  }
  let tieCorrection = 0;
  for (const t of Object.values(tieGroups)) {
    if (t > 1) tieCorrection += t * (t * t - 1);
  }
  varBase -= tieCorrection / 48.0;

  const sigma = Math.sqrt(Math.max(varBase, 1e-10));

  // Continuity correction: ±0.5 toward the mean
  const correction = Tplus >= mu ? -0.5 : 0.5;
  const z = (Tplus - mu + correction) / sigma;
  const pValue = Math.max(0, Math.min(1, 2.0 * Math.min(normalCDF(z), 1.0 - normalCDF(z))));

  return { W: Tplus, z, pValue, n, significant: pValue < 0.05 };
}
