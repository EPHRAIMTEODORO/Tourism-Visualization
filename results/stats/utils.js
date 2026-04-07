/**
 * Shared mathematical utilities used by statistical test modules.
 *
 * References:
 *   Abramowitz & Stegun (1972) – normal CDF approximation
 *   Beasley-Springer-Moro     – normal quantile (inverse CDF)
 *   Lanczos (1964)            – log-gamma function
 *   Numerical Recipes (Press et al.) – regularised incomplete beta function
 */

/**
 * Standard normal CDF Φ(x).
 * Hart's rational polynomial approximation; accurate to ~7 significant figures.
 *
 * @param {number} x
 * @returns {number} probability in [0, 1]
 */
export function normalCDF(x) {
  const t = 1.0 / (1.0 + 0.2316419 * Math.abs(x));
  const poly =
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const pdf = Math.exp((-x * x) / 2.0) / Math.sqrt(2.0 * Math.PI);
  const p = 1.0 - pdf * poly;
  return x >= 0 ? p : 1.0 - p;
}

/**
 * Inverse standard normal CDF (probit) Φ⁻¹(p).
 * Beasley-Springer-Moro rational approximation.
 *
 * @param {number} p – probability in (0, 1)
 * @returns {number} z-score
 */
export function normalQuantile(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1.0 - pLow;

  let q, r;
  if (p < pLow) {
    q = Math.sqrt(-2.0 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1.0)
    );
  }

  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1.0)
    );
  }

  q = Math.sqrt(-2.0 * Math.log(1.0 - p));
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1.0)
  );
}

/**
 * Natural log of the gamma function ln Γ(z).
 * Lanczos approximation (g = 7); accurate to ~15 significant figures.
 *
 * @param {number} z – positive real number
 * @returns {number}
 */
export function lgamma(z) {
  const g = 7;
  const p = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  if (z < 0.5) {
    // Reflection formula: Γ(z)·Γ(1-z) = π/sin(πz)
    return (
      Math.log(Math.PI) -
      Math.log(Math.abs(Math.sin(Math.PI * z))) -
      lgamma(1.0 - z)
    );
  }

  let x = p[0];
  const zz = z - 1.0;
  for (let i = 1; i <= g + 1; i++) x += p[i] / (zz + i);
  const t = zz + g + 0.5;
  return (
    0.5 * Math.log(2.0 * Math.PI) +
    (zz + 0.5) * Math.log(t) -
    t +
    Math.log(x)
  );
}

/**
 * Regularised incomplete beta function I_x(a, b).
 * Uses the continued-fraction expansion via Lentz's method (Numerical Recipes).
 *
 * @param {number} x – evaluation point in [0, 1]
 * @param {number} a – shape parameter a > 0
 * @param {number} b – shape parameter b > 0
 * @returns {number} value in [0, 1]
 */
export function betainc(x, a, b) {
  if (x < 0 || x > 1) return NaN;
  if (x === 0) return 0;
  if (x === 1) return 1;

  const lbeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const bt = Math.exp(a * Math.log(x) + b * Math.log(1.0 - x) - lbeta);

  // Use the continued-fraction representation on the smaller side for convergence
  if (x < (a + 1.0) / (a + b + 2.0)) {
    return (bt * _betaCF(x, a, b)) / a;
  }
  return 1.0 - (bt * _betaCF(1.0 - x, b, a)) / b;
}

/** @private Lentz continued-fraction evaluator for the incomplete beta function. */
function _betaCF(x, a, b) {
  const MAXIT = 200;
  const EPS = 3e-7;
  const FPMIN = 1e-30;

  const qab = a + b;
  const qap = a + 1.0;
  const qam = a - 1.0;

  let c = 1.0;
  let d = 1.0 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1.0 / d;
  let h = d;

  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;

    // Even step
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1.0 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1.0 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1.0 / d;
    h *= d * c;

    // Odd step
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1.0 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1.0 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1.0 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1.0) < EPS) break;
  }

  return h;
}
