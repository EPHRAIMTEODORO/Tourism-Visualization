const CSV_PATH = "data/Tourist-VisitorsArrivalandExpenditure.csv";

const formatNumber = d3.format(",");
const formatMillions = (value) => `${d3.format(".2f")(value / 1e6)}M`;
const formatBillions = (value) => `$${d3.format(".2f")(value / 1e9)}B`;

const chartConfig = {
  height: 440,
  margin: { top: 20, right: 24, bottom: 60, left: 68 }
};

const tooltip = d3.select("#tooltip");

function parseNumber(value) {
  if (!value) return null;
  const cleaned = value.replace(/,/g, "").trim();
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function buildDataset(rows) {
  const arrivalsKey = "Tourist/visitor arrivals";
  const expenditureKey = "Tourism expenditure";

  const countryMap = new Map();

  rows.forEach((row) => {
    const rawCountry = row[""]?.trim() || row["Region/Country/Area"]?.trim();
    const country = rawCountry || "";
    const year = Number(row.Year);
    const series = row.Series?.trim();
    const value = parseNumber(row.Value);

    if (!country || !Number.isFinite(year) || !series || value === null) {
      return;
    }

    if (!series.startsWith(arrivalsKey) && !series.startsWith(expenditureKey)) {
      return;
    }

    const yearMap = countryMap.get(country) || new Map();
    const entry = yearMap.get(year) || {
      country,
      year,
      arrivals: null,
      expenditure: null
    };

    if (series.startsWith(arrivalsKey)) {
      entry.arrivals = value * 1000;
    }

    if (series.startsWith(expenditureKey)) {
      entry.expenditure = value * 1_000_000;
    }

    yearMap.set(year, entry);
    countryMap.set(country, yearMap);
  });

  return Array.from(countryMap.values())
    .map((yearMap) => {
      const entries = Array.from(yearMap.values())
        .filter((d) => d.arrivals && d.expenditure)
        .sort((a, b) => b.year - a.year);

      return entries[0] || null;
    })
    .filter(Boolean)
    .map((d) => ({
      country: d.country,
      year: d.year,
      tourist_arrivals: d.arrivals,
      tourism_expenditure: d.expenditure
    }));
}

function buildScales(data) {
  const arrivalsExtent = d3.extent(data, (d) => d.tourist_arrivals);
  const expenditureExtent = d3.extent(data, (d) => d.tourism_expenditure);

  const xDomain = [arrivalsExtent[0] * 0.9, arrivalsExtent[1] * 1.05];
  const yDomain = [expenditureExtent[0] * 0.85, expenditureExtent[1] * 1.05];

  return { xDomain, yDomain };
}

function createScatterPlot({
  elementId,
  data,
  xScale,
  yScale,
  radiusAccessor,
  chartTitle,
  colorScale
}) {
  const container = d3.select(elementId);
  container.selectAll("*").remove();

  const width = container.node().getBoundingClientRect().width || 400;
  const { height, margin } = chartConfig;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", chartTitle);

  const chartGroup = svg
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const xAxis = d3
    .axisBottom(xScale)
    .ticks(5)
    .tickFormat((d) => `${d / 1e6}M`);

  const yAxis = d3
    .axisLeft(yScale)
    .ticks(5)
    .tickFormat((d) => `$${d / 1e9}B`);

  chartGroup
    .append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(yScale).ticks(5).tickSize(-innerWidth).tickFormat(""));

  chartGroup
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(xAxis);

  chartGroup.append("g").attr("class", "axis").call(yAxis);

  chartGroup
    .append("text")
    .attr("class", "axis-label")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 40)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b7a")
    .text("Tourist Arrivals (millions)");

  chartGroup
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -48)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6b7a")
    .text("Tourism Expenditure (USD, billions)");

  const dots = chartGroup
    .selectAll("circle")
    .data(data, (d) => d.country)
    .enter()
    .append("circle")
    .attr("class", "dot")
    .attr("cx", (d) => xScale(d.tourist_arrivals))
    .attr("cy", (d) => yScale(d.tourism_expenditure))
    .attr("fill", (d) => colorScale(d.country))
    .attr("r", 0);

  dots
    .transition()
    .duration(700)
    .attr("r", (d) => radiusAccessor(d));

  dots
    .on("mouseenter", (event, d) => {
      d3.select(event.currentTarget).classed("dot--highlight", true);
      tooltip
        .classed("is-visible", true)
        .attr("aria-hidden", "false")
        .html(
          `<strong>${d.country}</strong><br/>Arrivals: ${formatMillions(
            d.tourist_arrivals
          )} (${d.year})<br/>Expenditure: ${formatBillions(
            d.tourism_expenditure
          )} (${d.year})`
        );
    })
    .on("mousemove", (event) => {
      const offset = 14;
      tooltip
        .style("left", `${event.clientX + offset}px`)
        .style("top", `${event.clientY + offset}px`);
    })
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget).classed("dot--highlight", false);
      tooltip.classed("is-visible", false).attr("aria-hidden", "true");
    });

  const legendList = container.append("div").attr("class", "legend-list");

  const legendItems = legendList
    .selectAll("div")
    .data(data, (d) => d.country)
    .enter()
    .append("div")
    .attr("class", "legend-item");

  legendItems
    .append("span")
    .attr("class", "legend-swatch")
    .style("background-color", (d) => colorScale(d.country));

  legendItems.append("span").text((d) => d.country);
}

function renderCharts(data) {
  const { xDomain, yDomain } = buildScales(data);
  const colorScale = d3
    .scaleOrdinal()
    .domain(data.map((d) => d.country))
    .range(d3.schemeTableau10);

  const sharedWidth = Math.max(
    320,
    document.querySelector(".chart")?.getBoundingClientRect().width || 420
  );

  const xScale = d3
    .scaleLinear()
    .domain(xDomain)
    .range([0, sharedWidth - chartConfig.margin.left - chartConfig.margin.right])
    .nice();

  const yScale = d3
    .scaleLinear()
    .domain(yDomain)
    .range([
      chartConfig.height - chartConfig.margin.top - chartConfig.margin.bottom,
      0
    ])
    .nice();

  createScatterPlot({
    elementId: "#standard-scatter",
    data,
    xScale,
    yScale,
    radiusAccessor: () => 6,
    chartTitle: "Standard Scatter Plot",
    colorScale
  });

  const maxExpenditure = d3.max(data, (d) => d.tourism_expenditure);
  const bubbleScale = d3
    .scaleSqrt()
    .domain([0, maxExpenditure])
    .range([4, 18]);

  createScatterPlot({
    elementId: "#bubble-scatter",
    data,
    xScale,
    yScale,
    radiusAccessor: (d) => bubbleScale(d.tourism_expenditure),
    chartTitle: "Bubble Scatter Plot",
    colorScale
  });
}

function parseCsvWithMetadata(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const trimmedText = [lines[1], ...lines.slice(2)].join("\n");
  return d3.csvParse(trimmedText);
}

d3.text(CSV_PATH)
  .then((text) => {
    const rows = parseCsvWithMetadata(text);
    const dataset = buildDataset(rows);
    if (!dataset.length) {
      throw new Error("No valid records found in the CSV file.");
    }

    renderCharts(dataset);
    window.addEventListener("resize", () => {
      renderCharts(dataset);
    });
  })
  .catch((error) => {
    console.error("Failed to load CSV data", error);
  });
