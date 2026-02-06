const CSV_PATH = "data/Tourist-VisitorsArrivalandExpenditure.csv";

const formatNumber = d3.format(",");
const formatMillions = (value) => `${d3.format(".2f")(value / 1e6)}M`;
const formatBillions = (value) => `$${d3.format(".2f")(value / 1e9)}B`;

// Application state
const appState = {
  activeTab: 'standard',
  searchFilters: {
    standard: '',
    bubble: ''
  },
  selectedCountries: {
    standard: null,
    bubble: null
  },
  dataset: null
};

/**
 * Initialize tab navigation
 */
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-nav__button');

  tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const chartType = e.currentTarget.dataset.chart;
      switchTab(chartType);
    });
  });
}

/**
 * Switch between tabs
 */
function switchTab(chartType) {
  if (appState.activeTab === chartType) return;

  appState.activeTab = chartType;

  // Update tab buttons
  document.querySelectorAll('.tab-nav__button').forEach(btn => {
    const isActive = btn.dataset.chart === chartType;
    btn.classList.toggle('tab-nav__button--active', isActive);
    btn.setAttribute('aria-selected', isActive);
  });

  // Update tab panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    const isActive = panel.id === `${chartType}-scatter-panel`;
    panel.classList.toggle('tab-panel--active', isActive);
  });

  // Re-render the active chart (for proper sizing)
  setTimeout(() => {
    renderCharts(appState.dataset);
  }, 50);
}

/**
 * Initialize search inputs
 */
function initSearch() {
  const searchStandard = document.getElementById('search-standard');
  const searchBubble = document.getElementById('search-bubble');

  searchStandard.addEventListener('input', (e) => {
    appState.searchFilters.standard = e.target.value.toLowerCase();
    filterLegendAndChart('standard');
  });

  searchBubble.addEventListener('input', (e) => {
    appState.searchFilters.bubble = e.target.value.toLowerCase();
    filterLegendAndChart('bubble');
  });
}

/**
 * Filter legend items and chart dots based on search
 */
function filterLegendAndChart(chartType) {
  const searchTerm = appState.searchFilters[chartType];
  const selectedCountry = appState.selectedCountries[chartType];
  const legendContainer = document.getElementById(`legend-${chartType}`);
  const chartElement = document.getElementById(`${chartType}-scatter`);

  // Filter legend items
  const legendItems = legendContainer.querySelectorAll('.legend-item');
  legendItems.forEach(item => {
    const countryName = item.textContent.toLowerCase();
    const matches = countryName.includes(searchTerm);
    item.classList.toggle('legend-item--hidden', !matches && searchTerm !== '');
  });

  // Filter chart dots - consider both search and selection
  if (searchTerm === '' && !selectedCountry) {
    // Show all dots normally
    chartElement.querySelectorAll('.dot').forEach(dot => {
      dot.classList.remove('dot--dimmed', 'dot--highlighted');
    });
  } else if (searchTerm !== '') {
    // Search is active - dim non-matching, highlight matching
    chartElement.querySelectorAll('.dot').forEach(dot => {
      const countryData = d3.select(dot).datum();
      const matches = countryData.country.toLowerCase().includes(searchTerm);
      dot.classList.toggle('dot--dimmed', !matches);
      dot.classList.toggle('dot--highlighted', matches);
    });
  } else if (selectedCountry) {
    // Only selection is active - handled by updateCountrySelection
    updateCountrySelection(chartType);
  }
}

/**
 * Add legend item interactivity
 */
function addLegendInteractivity(chartType) {
  const legendContainer = document.getElementById(`legend-${chartType}`);
  const chartElement = document.getElementById(`${chartType}-scatter`);

  legendContainer.querySelectorAll('.legend-item').forEach(item => {
    const countryName = item.querySelector('span:last-child').textContent;

    // Click to select/deselect country
    item.addEventListener('click', () => {
      const currentlySelected = appState.selectedCountries[chartType];

      if (currentlySelected === countryName) {
        // Deselect if clicking the same country
        appState.selectedCountries[chartType] = null;
      } else {
        // Select new country
        appState.selectedCountries[chartType] = countryName;
      }

      updateCountrySelection(chartType);
    });

    // Hover to highlight
    item.addEventListener('mouseenter', () => {
      // Only highlight if no country is selected
      if (!appState.selectedCountries[chartType]) {
        chartElement.querySelectorAll('.dot').forEach(dot => {
          const dotData = d3.select(dot).datum();
          if (dotData.country === countryName) {
            dot.classList.add('dot--highlight');
          }
        });
      }
    });

    item.addEventListener('mouseleave', () => {
      // Remove highlight only if no country is selected
      if (!appState.selectedCountries[chartType]) {
        chartElement.querySelectorAll('.dot').forEach(dot => {
          dot.classList.remove('dot--highlight');
        });
      }
    });
  });
}

/**
 * Update chart and legend based on selected country
 */
function updateCountrySelection(chartType) {
  const selectedCountry = appState.selectedCountries[chartType];
  const legendContainer = document.getElementById(`legend-${chartType}`);
  const chartElement = document.getElementById(`${chartType}-scatter`);

  // Update legend items
  legendContainer.querySelectorAll('.legend-item').forEach(item => {
    const countryName = item.querySelector('span:last-child').textContent;
    if (selectedCountry === countryName) {
      item.classList.add('legend-item--selected');
    } else {
      item.classList.remove('legend-item--selected');
    }
  });

  // Update chart dots
  if (selectedCountry) {
    chartElement.querySelectorAll('.dot').forEach(dot => {
      const dotData = d3.select(dot).datum();
      if (dotData.country === selectedCountry) {
        dot.classList.remove('dot--dimmed');
        dot.classList.add('dot--highlighted');
        // Bring selected dot to front (render on top)
        d3.select(dot).raise();
      } else {
        dot.classList.add('dot--dimmed');
        dot.classList.remove('dot--highlighted');
      }
    });
  } else {
    // Clear selection - restore all dots
    chartElement.querySelectorAll('.dot').forEach(dot => {
      dot.classList.remove('dot--dimmed', 'dot--highlighted');
    });
  }
}

const chartConfig = {
  height: 600,
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
  colorScale,
  legendContainerId
}) {
  const container = d3.select(elementId);
  container.selectAll("*").remove();

  // Only render if the parent tab panel is active
  const parentPanel = container.node().closest('.tab-panel');
  if (!parentPanel || !parentPanel.classList.contains('tab-panel--active')) {
    return;
  }

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

  // Create a clip path to prevent dots from overflowing
  svg.append("defs")
    .append("clipPath")
    .attr("id", `clip-${elementId.replace('#', '')}`)
    .append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight);

  // Create zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.5, 10])
    .extent([[0, 0], [innerWidth, innerHeight]])
    .on("zoom", zoomed);

  // Apply zoom to svg
  svg.call(zoom);

  // Create scales that will be updated on zoom
  let currentXScale = xScale.copy();
  let currentYScale = yScale.copy();

  const xAxis = d3
    .axisBottom(currentXScale)
    .ticks(5)
    .tickFormat((d) => `${d / 1e6}M`);

  const yAxis = d3
    .axisLeft(currentYScale)
    .ticks(5)
    .tickFormat((d) => `$${d / 1e9}B`);

  // Grid
  const gridGroup = chartGroup.append("g").attr("class", "grid");

  // Axes
  const xAxisGroup = chartGroup
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(xAxis);

  const yAxisGroup = chartGroup.append("g").attr("class", "axis").call(yAxis);

  // Axis labels
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

  // Dots group with clip path
  const dotsGroup = chartGroup
    .append("g")
    .attr("clip-path", `url(#clip-${elementId.replace('#', '')})`);

  const dots = dotsGroup
    .selectAll("circle")
    .data(data, (d) => d.country)
    .enter()
    .append("circle")
    .attr("class", "dot")
    .attr("cx", (d) => currentXScale(d.tourist_arrivals))
    .attr("cy", (d) => currentYScale(d.tourism_expenditure))
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

  // Update grid
  function updateGrid() {
    gridGroup.selectAll("*").remove();
    gridGroup.call(
      d3.axisLeft(currentYScale)
        .ticks(5)
        .tickSize(-innerWidth)
        .tickFormat("")
    );
  }

  updateGrid();

  // Zoom function
  function zoomed(event) {
    // Update scales based on zoom transform
    currentXScale = event.transform.rescaleX(xScale);
    currentYScale = event.transform.rescaleY(yScale);

    // Update axes
    xAxisGroup.call(
      d3.axisBottom(currentXScale)
        .ticks(5)
        .tickFormat((d) => `${d / 1e6}M`)
    );
    yAxisGroup.call(
      d3.axisLeft(currentYScale)
        .ticks(5)
        .tickFormat((d) => `$${d / 1e9}B`)
    );

    // Update grid
    updateGrid();

    // Update dot positions
    dots
      .attr("cx", (d) => currentXScale(d.tourist_arrivals))
      .attr("cy", (d) => currentYScale(d.tourism_expenditure));
  }

  // Add reset zoom button
  const resetButton = container
    .append("button")
    .attr("class", "reset-zoom-btn")
    .text("Reset Zoom")
    .on("click", () => {
      svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity);
    });

  // CREATE LEGEND IN SIDEBAR
  const legendContainer = d3.select(legendContainerId);
  legendContainer.selectAll("*").remove();

  const legendList = legendContainer
    .append("div")
    .attr("class", "legend-list");

  const legendItems = legendList
    .selectAll("div")
    .data(data.sort((a, b) => a.country.localeCompare(b.country)), (d) => d.country)
    .enter()
    .append("div")
    .attr("class", "legend-item");

  legendItems
    .append("span")
    .attr("class", "legend-swatch")
    .style("background-color", (d) => colorScale(d.country));

  legendItems
    .append("span")
    .text((d) => d.country);

  // Add legend interactivity
  const chartType = elementId.includes('standard') ? 'standard' : 'bubble';
  addLegendInteractivity(chartType);
}

function renderCharts(data) {
  appState.dataset = data;

  const { xDomain, yDomain } = buildScales(data);
  const colorScale = d3
    .scaleOrdinal()
    .domain(data.map((d) => d.country))
    .range(d3.schemeTableau10);

  // Calculate width based on active chart container
  const activePanel = document.querySelector('.tab-panel--active');
  const chartContainer = activePanel?.querySelector('.chart-main');
  const sharedWidth = chartContainer?.getBoundingClientRect().width || 600;

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
    colorScale,
    legendContainerId: "#legend-standard"
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
    colorScale,
    legendContainerId: "#legend-bubble"
  });

  // Reapply any active search filters
  if (appState.searchFilters.standard) {
    filterLegendAndChart('standard');
  }
  if (appState.searchFilters.bubble) {
    filterLegendAndChart('bubble');
  }

  // Reapply any active country selections
  if (appState.selectedCountries.standard) {
    updateCountrySelection('standard');
  }
  if (appState.selectedCountries.bubble) {
    updateCountrySelection('bubble');
  }
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

    appState.dataset = dataset;

    // Initialize tabs and search
    initTabs();
    initSearch();

    // Render charts
    renderCharts(dataset);

    // Handle window resize
    window.addEventListener("resize", () => {
      renderCharts(dataset);
    });
  })
  .catch((error) => {
    console.error("Failed to load CSV data", error);
  });
