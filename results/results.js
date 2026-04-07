/**
 * results.js – Study Results page logic.
 *
 * Responsibilities
 *   1. Fetch survey data from /api/responses-summary
 *   2. Render boxplots (Pattern, Outlier, Population) — unchanged behaviour
 *   3. Compute and render the "Statistical Analysis" section:
 *        a. Descriptive statistics (mean, median)
 *        b. Shapiro-Wilk normality test on paired differences
 *        c. Conditional hypothesis test (paired t-test or Wilcoxon)
 *        d. Summary insights
 *        e. D3 grouped bar chart of mean scores
 */

import { mean }                from "./stats/mean.js";
import { median }              from "./stats/median.js";
import { shapiroWilk }         from "./stats/shapiroWilk.js";
import { pairedTTest }         from "./stats/pairedTTest.js";
import { wilcoxonSignedRank }  from "./stats/wilcoxonSignedRank.js";

// ─── Design constants (kept in sync with CSS custom properties) ───────────────
const COLOR_STANDARD = "#2f6fed";
const COLOR_BUBBLE   = "#f59e0b";

// ─── Category definitions used throughout ────────────────────────────────────
const CATEGORIES = [
  {
    key:      "pattern",
    label:    "Pattern Recognition",
    standard: "patternEaseStandard",
    bubble:   "patternEaseBubble",
  },
  {
    key:      "outlier",
    label:    "Outlier Detection",
    standard: "outlierEaseStandard",
    bubble:   "outlierEaseBubble",
  },
  {
    key:      "population",
    label:    "Population Pattern",
    standard: "populationEaseStandard",
    bubble:   "populationEaseBubble",
  },
];

// ════════════════════════════════════════════════════════════════════════════════
// 1. BOXPLOT UTILITIES  (original behaviour, unchanged)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Compute five-number summary + outliers for a numeric array.
 * @param {number[]} arr
 * @returns {object|null}
 */
function boxStats(arr) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;

  const q1          = d3.quantile(sorted, 0.25);
  const med         = d3.quantile(sorted, 0.5);
  const q3          = d3.quantile(sorted, 0.75);
  const iqr         = q3 - q1;
  const lowerFence  = q1 - 1.5 * iqr;
  const upperFence  = q3 + 1.5 * iqr;
  const whiskerLow  = d3.min(sorted.filter((v) => v >= lowerFence));
  const whiskerHigh = d3.max(sorted.filter((v) => v <= upperFence));
  const outlierPts  = sorted.filter((v) => v < lowerFence || v > upperFence);

  return { q1, median: med, q3, whiskerLow, whiskerHigh, outlierPts, values: sorted };
}

/**
 * Draw a two-group boxplot into an SVG element.
 * @param {SVGElement} svgEl
 * @param {{ label: string, color: string, stats: object|null }[]} groups
 */
function drawBoxPlot(svgEl, groups) {
  const VB_W = 300;
  const VB_H = 240;
  const margin = { top: 16, right: 16, bottom: 32, left: 36 };
  const innerW = VB_W - margin.left - margin.right;
  const innerH = VB_H - margin.top - margin.bottom;

  const svg = d3.select(svgEl).attr("viewBox", `0 0 ${VB_W} ${VB_H}`);
  svg.selectAll("*").remove();

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand()
    .domain(groups.map((d) => d.label))
    .range([0, innerW])
    .padding(0.45);

  const y = d3.scaleLinear().domain([0.5, 5.5]).range([innerH, 0]);

  // Horizontal grid lines
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(""))
    .call((s) => s.select(".domain").remove())
    .call((s) =>
      s.selectAll(".tick line").attr("stroke", "#dfe5ef").attr("stroke-dasharray", "4,3")
    );

  // Y axis
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => d))
    .call((s) => s.select(".domain").remove())
    .call((s) => s.selectAll("text").attr("fill", "#5f6b7a").attr("font-size", "10px"))
    .call((s) => s.selectAll(".tick line").attr("stroke", "#dfe5ef"));

  // X axis
  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickSize(0))
    .call((s) => s.select(".domain").attr("stroke", "#dfe5ef"))
    .call((s) =>
      s.selectAll("text").attr("fill", "#5f6b7a").attr("font-size", "11px").attr("dy", "1.4em")
    );

  // Draw each group
  groups.forEach(({ label, color, stats }, gi) => {
    if (!stats) {
      g.append("text")
        .attr("x", x(label) + x.bandwidth() / 2)
        .attr("y", innerH / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#c0c8d4")
        .attr("font-size", "10px")
        .text("no data");
      return;
    }

    const cx      = x(label) + x.bandwidth() / 2;
    const bw      = x.bandwidth();
    const capHalf = bw * 0.28;

    // Upper whisker
    g.append("line")
      .attr("x1", cx).attr("x2", cx)
      .attr("y1", y(stats.whiskerHigh)).attr("y2", y(stats.q3))
      .attr("stroke", color).attr("stroke-width", 1.5);

    // Lower whisker
    g.append("line")
      .attr("x1", cx).attr("x2", cx)
      .attr("y1", y(stats.q1)).attr("y2", y(stats.whiskerLow))
      .attr("stroke", color).attr("stroke-width", 1.5);

    // Upper cap
    g.append("line")
      .attr("x1", cx - capHalf).attr("x2", cx + capHalf)
      .attr("y1", y(stats.whiskerHigh)).attr("y2", y(stats.whiskerHigh))
      .attr("stroke", color).attr("stroke-width", 1.5);

    // Lower cap
    g.append("line")
      .attr("x1", cx - capHalf).attr("x2", cx + capHalf)
      .attr("y1", y(stats.whiskerLow)).attr("y2", y(stats.whiskerLow))
      .attr("stroke", color).attr("stroke-width", 1.5);

    // IQR box
    g.append("rect")
      .attr("x", x(label))
      .attr("y", y(stats.q3))
      .attr("width", bw)
      .attr("height", y(stats.q1) - y(stats.q3))
      .attr("fill", color)
      .attr("fill-opacity", 0.18)
      .attr("stroke", color)
      .attr("stroke-width", 1.8)
      .attr("rx", 3);

    // Median line
    g.append("line")
      .attr("x1", x(label)).attr("x2", x(label) + bw)
      .attr("y1", y(stats.median)).attr("y2", y(stats.median))
      .attr("stroke", color).attr("stroke-width", 2.5);

    // Jittered individual data points
    stats.values.forEach((v, i) => {
      const jitter = Math.sin(i * 7.3 + gi * 3.1) * bw * 0.2;
      g.append("circle")
        .attr("cx", cx + jitter)
        .attr("cy", y(v))
        .attr("r", 2.8)
        .attr("fill", color)
        .attr("fill-opacity", 0.45);
    });

    // Outlier points (hollow circles)
    stats.outlierPts.forEach((v) => {
      g.append("circle")
        .attr("cx", cx)
        .attr("cy", y(v))
        .attr("r", 3.5)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 1.5);
    });
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// 2. STATISTICAL ANALYSIS – COMPUTATION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Run the full analysis pipeline for all three categories.
 * Returns an array of per-category result objects.
 *
 * @param {object} data – API response object
 * @returns {Array}
 */
function computeAnalysis(data) {
  return CATEGORIES.map(({ key, label, standard: stdKey, bubble: bubKey }) => {
    const std = (data[stdKey] || []).map(Number).filter(Number.isFinite);
    const bub = (data[bubKey] || []).map(Number).filter(Number.isFinite);

    // Paired differences: bubble − standard (indices are aligned per participant)
    const paired = [];
    for (let i = 0; i < Math.min(std.length, bub.length); i++) {
      paired.push(bub[i] - std[i]);
    }

    // Descriptive statistics
    const desc = {
      standardMean:   mean(std),
      standardMedian: median(std),
      bubbleMean:     mean(bub),
      bubbleMedian:   median(bub),
    };

    // Normality test on the paired differences
    const normality = shapiroWilk(paired);

    // Conditional hypothesis test
    let hyp;
    if (normality.normal) {
      const res = pairedTTest(std, bub);
      hyp = { test: "Paired t-test", statLabel: "t", ...res };
    } else {
      const res = wilcoxonSignedRank(std, bub);
      hyp = { test: "Wilcoxon signed-rank", statLabel: "T⁺", stat: res.W, ...res };
    }

    return { key, label, desc, normality, hyp };
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// 3. STATISTICAL ANALYSIS – RENDERING
// ════════════════════════════════════════════════════════════════════════════════

/** Format a number to 3 decimal places, or '—' if not finite. */
function fmt3(v) {
  return Number.isFinite(v) ? v.toFixed(3) : "—";
}

/** Format a number to 4 decimal places. */
function fmt4(v) {
  return Number.isFinite(v) ? v.toFixed(4) : "—";
}

/**
 * Return an HTML badge for a p-value.
 * @param {number} p
 * @returns {string} HTML string
 */
function pBadge(p) {
  if (!Number.isFinite(p)) return `<span class="p-badge p-badge--ns">—</span>`;
  const sig = p < 0.05;
  const cls = sig ? "p-badge--sig" : "p-badge--ns";
  return `<span class="p-badge ${cls}">${fmt4(p)}</span>`;
}

/**
 * Render the full "Statistical Analysis" section into #stats-section.
 * @param {Array} results – output of computeAnalysis()
 * @param {object} data   – raw API data (used for the bar chart)
 */
function renderStatistics(results, data) {
  const section = document.getElementById("stats-section");

  // ── 1. Descriptive Statistics ─────────────────────────────────────────────
  const descRows = results
    .map(
      ({ label, desc }) => `
      <tr>
        <td>${label}</td>
        <td class="cond-standard">${fmt3(desc.standardMean)}</td>
        <td class="cond-standard">${fmt3(desc.standardMedian)}</td>
        <td class="cond-bubble">${fmt3(desc.bubbleMean)}</td>
        <td class="cond-bubble">${fmt3(desc.bubbleMedian)}</td>
      </tr>`
    )
    .join("");

  // ── 2. Normality Test ─────────────────────────────────────────────────────
  const normalityBlocks = results
    .map(({ label, normality }) => {
      const interp =
        normality.normal === null
          ? "Insufficient data"
          : normality.normal
          ? "Normally distributed (p &gt; 0.05)"
          : "Not normally distributed (p ≤ 0.05)";
      return `
      <div class="test-block">
        <div class="category-label">${label}</div>
        <div class="test-row">
          <span class="label">W statistic</span>
          <span class="value">${fmt3(normality.W)}</span>
        </div>
        <div class="test-row">
          <span class="label">p-value</span>
          <span class="value">${pBadge(normality.pValue)}</span>
        </div>
        <p class="interpretation">${interp}</p>
      </div>`;
    })
    .join("");

  // ── 3. Hypothesis Testing ─────────────────────────────────────────────────
  const hypBlocks = results
    .map(({ label, hyp }) => {
      const statValue =
        hyp.statLabel === "t" ? fmt3(hyp.t) : fmt3(hyp.W);
      const dfLine =
        hyp.statLabel === "t" && Number.isFinite(hyp.df)
          ? `<div class="test-row"><span class="label">Degrees of freedom</span><span class="value">${hyp.df}</span></div>`
          : "";
      const nLine =
        hyp.statLabel === "T⁺" && Number.isFinite(hyp.n)
          ? `<div class="test-row"><span class="label">Effective n</span><span class="value">${hyp.n}</span></div>`
          : "";

      const interp = !Number.isFinite(hyp.pValue)
        ? "Insufficient data"
        : hyp.significant
        ? "Significant difference between conditions (p &lt; 0.05)"
        : "No significant difference between conditions (p ≥ 0.05)";

      return `
      <div class="test-block">
        <div class="category-label">${label}</div>
        <div class="test-row">
          <span class="label">Test used</span>
          <span class="value">${hyp.test}</span>
        </div>
        <div class="test-row">
          <span class="label">${hyp.statLabel} statistic</span>
          <span class="value">${statValue}</span>
        </div>
        ${dfLine}${nLine}
        <div class="test-row">
          <span class="label">p-value</span>
          <span class="value">${pBadge(hyp.pValue)}</span>
        </div>
        <p class="interpretation">${interp}</p>
      </div>`;
    })
    .join("");

  // ── 4. Summary Insights ───────────────────────────────────────────────────
  const insightItems = results
    .map(({ label, hyp, desc }) => {
      const sig = hyp.significant;
      const iconCls = sig ? "insight-icon--sig" : "insight-icon--ns";
      const iconChar = sig ? "★" : "–";

      let text;
      if (!Number.isFinite(hyp.pValue)) {
        text = `Insufficient data to draw conclusions for <strong>${label}</strong>.`;
      } else if (sig) {
        const dir =
          desc.bubbleMean > desc.standardMean ? "improved" : "reduced";
        text = `Bubble scatter plots <strong>${dir}</strong> ${label.toLowerCase()} compared to standard scatter plots (p = ${fmt4(hyp.pValue)}).`;
      } else {
        text = `No significant difference found in <strong>${label.toLowerCase()}</strong> between chart types (p = ${fmt4(hyp.pValue)}).`;
      }

      return `
      <li class="insight-item">
        <span class="insight-icon ${iconCls}">${iconChar}</span>
        <span>${text}</span>
      </li>`;
    })
    .join("");

  // ── Inject HTML structure ─────────────────────────────────────────────────
  section.innerHTML = `
    <h2 class="stats-section-title">Statistical Analysis</h2>
    <p class="stats-section-subtitle">
      Paired comparisons between Standard Scatter and Bubble Chart conditions
      across all three ease-rating categories.
    </p>

    <div class="stats-grid">

      <!-- Descriptive Statistics -->
      <div class="stats-card stats-card--wide">
        <h3>Descriptive Statistics</h3>
        <table class="stats-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Standard – Mean</th>
              <th>Standard – Median</th>
              <th>Bubble – Mean</th>
              <th>Bubble – Median</th>
            </tr>
          </thead>
          <tbody>${descRows}</tbody>
        </table>
      </div>

      <!-- Normality Test -->
      <div class="stats-card">
        <h3>Normality Test (Shapiro-Wilk on paired differences)</h3>
        ${normalityBlocks}
      </div>

      <!-- Hypothesis Testing -->
      <div class="stats-card">
        <h3>Hypothesis Testing</h3>
        ${hypBlocks}
      </div>

      <!-- Summary -->
      <div class="stats-card stats-card--wide">
        <h3>Summary Insights</h3>
        <ul class="insight-list">${insightItems}</ul>
      </div>

      <!-- D3 Grouped Bar Chart -->
      <div class="stats-card stats-card--wide">
        <h3>Mean Scores by Category and Condition</h3>
        <div class="bar-chart-container">
          <svg id="chart-means"></svg>
        </div>
        <div class="legend" style="margin-top:16px">
          <span class="legend-item">
            <span class="legend-swatch" style="background:${COLOR_STANDARD}"></span>Standard Scatter
          </span>
          <span class="legend-item">
            <span class="legend-swatch" style="background:${COLOR_BUBBLE}"></span>Bubble Chart
          </span>
        </div>
      </div>

    </div>`;

  // ── 5. D3 Grouped Bar Chart ───────────────────────────────────────────────
  drawMeanBarChart(document.getElementById("chart-means"), results);
}

// ════════════════════════════════════════════════════════════════════════════════
// 4. D3 GROUPED BAR CHART
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Render a grouped bar chart comparing mean scores per category and condition.
 *
 * @param {SVGElement} svgEl
 * @param {Array} results – output of computeAnalysis()
 */
function drawMeanBarChart(svgEl, results) {
  const VB_W  = 700;
  const VB_H  = 320;
  const margin = { top: 24, right: 24, bottom: 64, left: 52 };
  const innerW = VB_W - margin.left - margin.right;
  const innerH = VB_H - margin.top  - margin.bottom;

  const svg = d3
    .select(svgEl)
    .attr("viewBox", `0 0 ${VB_W} ${VB_H}`)
    .attr("aria-label", "Grouped bar chart of mean ease scores by category and condition");

  svg.selectAll("*").remove();

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // ── Scales ────────────────────────────────────────────────────────────────
  const categoryLabels = results.map((r) => r.label);
  const conditions      = ["Standard", "Bubble"];

  // Outer band: one slot per category
  const xCat = d3
    .scaleBand()
    .domain(categoryLabels)
    .range([0, innerW])
    .paddingInner(0.28)
    .paddingOuter(0.14);

  // Inner band: two bars per category slot
  const xCond = d3
    .scaleBand()
    .domain(conditions)
    .range([0, xCat.bandwidth()])
    .padding(0.08);

  const yMax = 5.5;
  const y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]).nice();

  // ── Grid lines ────────────────────────────────────────────────────────────
  g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(""))
    .call((s) => s.select(".domain").remove())
    .call((s) =>
      s.selectAll(".tick line").attr("stroke", "#dfe5ef").attr("stroke-dasharray", "4,3")
    );

  // ── Y axis ────────────────────────────────────────────────────────────────
  g.append("g")
    .call(d3.axisLeft(y).ticks(5))
    .call((s) => s.select(".domain").remove())
    .call((s) =>
      s.selectAll("text").attr("fill", "#5f6b7a").attr("font-size", "12px")
    )
    .call((s) =>
      s.selectAll(".tick line").attr("stroke", "#dfe5ef")
    );

  // Y axis label
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2)
    .attr("y", -40)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b7a")
    .attr("font-size", "12px")
    .text("Mean ease rating (1–5)");

  // ── X axis ────────────────────────────────────────────────────────────────
  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(xCat).tickSize(0))
    .call((s) => s.select(".domain").attr("stroke", "#dfe5ef"))
    .call((s) =>
      s
        .selectAll("text")
        .attr("fill", "#5f6b7a")
        .attr("font-size", "13px")
        .attr("dy", "1.6em")
    );

  // ── Bars ──────────────────────────────────────────────────────────────────
  const colorMap = { Standard: COLOR_STANDARD, Bubble: COLOR_BUBBLE };

  results.forEach(({ label, desc }) => {
    const catGroup = g
      .append("g")
      .attr("transform", `translate(${xCat(label)},0)`);

    const barData = [
      { cond: "Standard", value: desc.standardMean },
      { cond: "Bubble",   value: desc.bubbleMean   },
    ];

    catGroup
      .selectAll("rect")
      .data(barData)
      .join("rect")
      .attr("x",      (d) => xCond(d.cond))
      .attr("y",      (d) => (Number.isFinite(d.value) ? y(d.value) : innerH))
      .attr("width",  xCond.bandwidth())
      .attr("height", (d) =>
        Number.isFinite(d.value) ? Math.max(0, innerH - y(d.value)) : 0
      )
      .attr("fill",   (d) => colorMap[d.cond])
      .attr("fill-opacity", 0.85)
      .attr("rx", 4);

    // Value labels above each bar
    catGroup
      .selectAll("text.bar-label")
      .data(barData)
      .join("text")
      .attr("class", "bar-label")
      .attr("x", (d) => xCond(d.cond) + xCond.bandwidth() / 2)
      .attr("y", (d) =>
        Number.isFinite(d.value) ? y(d.value) - 5 : innerH
      )
      .attr("text-anchor", "middle")
      .attr("fill",      (d) => colorMap[d.cond])
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .text((d) => (Number.isFinite(d.value) ? d.value.toFixed(2) : ""));
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// 5. MAIN ENTRY POINT
// ════════════════════════════════════════════════════════════════════════════════

async function init() {
  const status = document.getElementById("status");

  try {
    const res = await fetch("/api/responses-summary");
    if (!res.ok) throw new Error(`Server responded with HTTP ${res.status}`);
    const data = await res.json();

    const n = (data.patternEaseStandard || []).length;
    status.textContent = `${n} response${n !== 1 ? "s" : ""} recorded.`;

    // ── Boxplots ───────────────────────────────────────────────────────────
    const CHARTS = [
      {
        svgId: "chart-pattern",
        groups: [
          { label: "Standard", color: COLOR_STANDARD, stats: boxStats(data.patternEaseStandard) },
          { label: "Bubble",   color: COLOR_BUBBLE,   stats: boxStats(data.patternEaseBubble)   },
        ],
      },
      {
        svgId: "chart-outlier",
        groups: [
          { label: "Standard", color: COLOR_STANDARD, stats: boxStats(data.outlierEaseStandard) },
          { label: "Bubble",   color: COLOR_BUBBLE,   stats: boxStats(data.outlierEaseBubble)   },
        ],
      },
      {
        svgId: "chart-population",
        groups: [
          { label: "Standard", color: COLOR_STANDARD, stats: boxStats(data.populationEaseStandard) },
          { label: "Bubble",   color: COLOR_BUBBLE,   stats: boxStats(data.populationEaseBubble)   },
        ],
      },
    ];

    CHARTS.forEach(({ svgId, groups }) => {
      drawBoxPlot(document.getElementById(svgId), groups);
    });

    // ── Statistical Analysis ───────────────────────────────────────────────
    const analysisResults = computeAnalysis(data);
    renderStatistics(analysisResults, data);

  } catch (err) {
    status.textContent = `Could not load results: ${err.message}`;
    status.classList.add("error");
    console.error(err);
  }
}

init();
