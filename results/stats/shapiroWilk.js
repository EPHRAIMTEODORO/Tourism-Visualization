/**
 * Shapiro-Wilk normality test.
 *
 * Algorithm  : Royston (1992) AS R94, extended to n ≤ 5000.
 * W statistic: Blom-approximated expected normal order statistics as
 *              a-weights, with Royston polynomial corrections applied to
 *              the two most extreme coefficients (for n ≥ 7).
 * p-value    : Royston (1995) polynomial approximation on log(1 − W).
 *
 * References:
 *   Royston, P. (1992). Approximating the Shapiro-Wilk W-test for
 *     non-normality. Statistics and Computing, 2, 117–119.
 *   Royston, P. (1995). Remark AS R94. Applied Statistics, 44, 547–551.
 *
 * @module stats/shapiroWilk
 */

import { normalCDF, normalQuantile } from "./utils.js";

// ─── Royston polynomial coefficients ────────────────────────────────────────
// c1, c2: a-weight corrections for the largest two order-statistic positions
//         Evaluated at u = 1/√n
const C1 = [0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056];
const C2 = [0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633];

// c3, c4: mu and log(sigma) for the n ∈ [4, 11] p-value transform
//         Evaluated at integer n
const C3 = [0.544235, -0.39978, 0.025054, -0.6714e-3];
const C4 = [1.3822, -0.77857, 0.062767, -0.0020322];

// c5: mu for the n ∈ [12, 5000] p-value transform
//    Evaluated at log(n) — note: c4 is reused for log(sigma)
const C5 = [-1.5861, -0.31082, -0.083751, 0.0038915];

// c6: gamma threshold used in the n ∈ [4, 11] branch
//    Evaluated at integer n
const C6 = [-0.4803, -0.082676, 0.0030302];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Evaluate polynomial Σ coeffs[i] · xⁱ using Horner's method.
 * coeffs = [c₀, c₁, c₂, …] so the constant term is coeffs[0].
 */
function _poly(x, coeffs) {
  let result = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = result * x + coeffs[i];
  }
  return result;
}

/**
 * Expected normal order statistics for a sample of size n.
 * Uses Blom's (1958) continuity-corrected approximation:
 *   m_i = Φ⁻¹((i + 1 − 3/8) / (n + 1/4))   (0-indexed i)
 */
function _blom(n) {
  return Array.from({ length: n }, (_, i) =>
    normalQuantile((i + 1 - 3 / 8) / (n + 1 / 4))
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Shapiro-Wilk normality test.
 *
 * @param {number[]} data – raw observations (non-finite values are removed)
 * @returns {{ W: number, pValue: number, normal: boolean|null }}
 *   W       – test statistic in (0, 1]; 1 = perfectly normal
 *   pValue  – two-tailed p-value
 *   normal  – true when p > 0.05 (fail to reject H₀), false otherwise,
 *             null if sample is too small
 */
export function shapiroWilk(data) {
  const x = [...data]
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  const n = x.length;

  if (n < 3) return { W: NaN, pValue: NaN, normal: null };

  // ── Build a-coefficient vector ───────────────────────────────────────────
  const m = _blom(n);
  const mss = m.reduce((s, v) => s + v * v, 0); // ‖m‖²
  const mNorm = Math.sqrt(mss);

  // Start from the Blom normalisation: a[i] = m[i] / ‖m‖
  const a = m.map((v) => v / mNorm);

  if (n >= 7) {
    // Royston polynomial corrections for the two most extreme positions
    const u = 1.0 / Math.sqrt(n);
    a[n - 1] += _poly(u, C1);
    a[n - 2] += _poly(u, C2);

    // Enforce antisymmetry: a[i] = −a[n−1−i]
    a[0] = -a[n - 1];
    a[1] = -a[n - 2];

    // Re-normalise the middle coefficients so Σ aᵢ² = 1
    const ssqExtremes = 2.0 * (a[n - 1] ** 2 + a[n - 2] ** 2);
    let midMss = 0;
    for (let i = 2; i <= n - 3; i++) midMss += m[i] * m[i];

    const remaining = 1.0 - ssqExtremes;
    if (midMss > 0 && remaining > 0) {
      const phi = Math.sqrt(midMss / remaining);
      for (let i = 2; i <= n - 3; i++) a[i] = m[i] / phi;
    }
  }

  // ── Compute W = b² / SS ──────────────────────────────────────────────────
  const xMean = x.reduce((s, v) => s + v, 0) / n;
  const ss = x.reduce((s, v) => s + (v - xMean) ** 2, 0);

  let b = 0;
  const halfN = Math.floor(n / 2);
  for (let i = 0; i < halfN; i++) {
    b += a[n - 1 - i] * (x[n - 1 - i] - x[i]);
  }

  const W = Math.min(1.0, Math.max(0.0, (b * b) / ss));
  const pValue = _pValue(W, n);

  return { W, pValue, normal: pValue > 0.05 };
}

// ─── P-value approximation ───────────────────────────────────────────────────

/**
 * Royston (1995) polynomial p-value from W and n.
 * @private
 */
function _pValue(W, n) {
  // Special case n = 3 (Shapiro & Wilk 1965, exact formula)
  if (n === 3) {
    const stqr = Math.asin(Math.sqrt(3.0 / 4.0));
    const pw = (6.0 / Math.PI) * (Math.asin(Math.sqrt(W)) - stqr);
    return Math.max(0, Math.min(1, pw));
  }

  if (n <= 11) {
    // n in [4, 11]: y = log(gamma - log(1-W)) is an INCREASING function of W.
    // More normal (W near 1) --> larger y --> larger z --> normalCDF(z) near 1.
    // So use the LOWER tail: p = normalCDF(z).
    const gamma = _poly(n, C6);
    const logArg = gamma - Math.log(1.0 - W);
    if (logArg <= 0) return 1.0; // W near 1, gamma < log(1-W) edge case
    const y     = Math.log(logArg);
    const mu    = _poly(n, C3);
    const sigma = Math.exp(_poly(n, C4));
    const z     = (y - mu) / sigma;
    return Math.max(0, Math.min(1, normalCDF(z)));
  }

  // n in [12, 5000]: y = log(1-W) is a DECREASING function of W.
  // More normal (W near 1) --> more negative y --> more negative z --> 1-normalCDF(z) near 1.
  // So use the UPPER tail: p = 1 - normalCDF(z).
  const y     = Math.log(1.0 - W);
  const mu    = _poly(Math.log(n), C5);
  const sigma = Math.exp(_poly(Math.log(n), C4));
  const z     = (y - mu) / sigma;
  return Math.max(0, Math.min(1, 1.0 - normalCDF(z)));
}
