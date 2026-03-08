const CSV_PATH = "data/Tourist-VisitorsArrivalandExpenditure.csv";
const POP_CSV_PATH = "data/population.csv";

const POP_NAME_MAP = {
  "Bahamas (The)": "Bahamas",
  "C\xf4te d\x92Ivoire": "Côte d\u2019Ivoire"
};

const formatNumber = d3.format(",");
const formatMillions = (value) => `${d3.format(".2f")(value / 1e6)}M`;
const formatBillions = (value) => `$${d3.format(".2f")(value / 1e9)}B`;
const formatPopulation = (value) => `${d3.format(".2f")(value)}M`;

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

// Chart configuration - height will be calculated dynamically based on container width
const chartConfig = {
  height: null, // Calculated dynamically
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

  const xDomain = [0, arrivalsExtent[1] * 1.05];
  const yDomain = [0, expenditureExtent[1] * 1.05];

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
  const height = Math.min(width * 0.8, 800); // Responsive height: maintain aspect ratio, max 800px
  const { margin } = chartConfig;
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
    .scaleExtent([1, 30])
    .extent([[0, 0], [innerWidth, innerHeight]])
    .translateExtent([[0, 0], [innerWidth, innerHeight]])
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
      const popLine = d.population != null
        ? `<br/>Population: ${formatPopulation(d.population)}`
        : "";
      tooltip
        .classed("is-visible", true)
        .attr("aria-hidden", "false")
        .html(
          `<strong>${d.country}</strong><br/>Arrivals: ${formatMillions(
            d.tourist_arrivals
          )} (${d.year})<br/>Expenditure: ${formatBillions(
            d.tourism_expenditure
          )} (${d.year})${popLine}`
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

  // Add zoom controls
  const controls = container
    .append("div")
    .attr("class", "chart-controls");

  controls
    .append("button")
    .attr("class", "zoom-btn")
    .attr("type", "button")
    .attr("aria-label", "Zoom out")
    .text("−")
    .on("click", () => {
      svg.transition()
        .duration(250)
        .call(zoom.scaleBy, 1 / 1.4);
    });

  controls
    .append("button")
    .attr("class", "zoom-btn")
    .attr("type", "button")
    .attr("aria-label", "Zoom in")
    .text("+")
    .on("click", () => {
      svg.transition()
        .duration(250)
        .call(zoom.scaleBy, 1.4);
    });

  controls
    .append("button")
    .attr("class", "reset-zoom-btn")
    .attr("type", "button")
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

  // Sync legend height with chart
  // Subtract sidebar header height (title + search input + spacing)
  legendContainer.style("max-height", `${height - 80}px`);

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

  // Calculate width and height based on active chart container
  const activePanel = document.querySelector('.tab-panel--active');
  const chartContainer = activePanel?.querySelector('.chart-main');
  const sharedWidth = chartContainer?.getBoundingClientRect().width || 600;
  const sharedHeight = Math.min(sharedWidth * 0.8, 800); // Responsive height

  const xScale = d3
    .scaleLinear()
    .domain(xDomain)
    .range([0, sharedWidth - chartConfig.margin.left - chartConfig.margin.right])
    .nice();

  const yScale = d3
    .scaleLinear()
    .domain(yDomain)
    .range([
      sharedHeight - chartConfig.margin.top - chartConfig.margin.bottom,
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

  const maxPopulation = d3.max(data, (d) => d.population) || 1;
  const bubbleScale = d3
    .scaleSqrt()
    .domain([0, maxPopulation])
    .range([4, 30]);

  createScatterPlot({
    elementId: "#bubble-scatter",
    data,
    xScale,
    yScale,
    radiusAccessor: (d) => bubbleScale(d.population),
    chartTitle: "Bubble Scatter Plot (size = population)",
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

  syncQuestionnaireHeight();
}

function syncQuestionnaireHeight() {
  const questionnaireArea = document.querySelector('.questionnaire-area');
  const visualizationArea = document.querySelector('.visualization-area');
  const alignmentNudge = 8;
  if (!questionnaireArea) {
    return;
  }

  if (window.innerWidth <= 1024) {
    questionnaireArea.style.marginTop = '0';
    questionnaireArea.style.height = 'auto';
    return;
  }

  const activePanel = document.querySelector('.tab-panel--active');
  const chartLayout = activePanel?.querySelector('.chart-layout');
  const chartTopOffset = chartLayout && visualizationArea
    ? chartLayout.getBoundingClientRect().top - visualizationArea.getBoundingClientRect().top
    : 0;
  const chartHeight = chartLayout?.getBoundingClientRect().height || 0;

  questionnaireArea.style.marginTop = `${Math.max(0, Math.round(chartTopOffset - alignmentNudge))}px`;
  questionnaireArea.style.height = chartHeight > 0 ? `${Math.round(chartHeight)}px` : 'auto';
}

function parseCsvWithMetadata(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const trimmedText = [lines[1], ...lines.slice(2)].join("\n");
  return d3.csvParse(trimmedText);
}

function buildPopulationMap(rows) {
  const popMap = new Map();

  rows.forEach((row) => {
    let country = row[""]?.trim() || row["Region/Country/Area"]?.trim();
    if (!country) return;

    country = POP_NAME_MAP[country] || country;

    const series = row.Series?.trim();
    if (series !== "Population mid-year estimates (millions)") return;

    const value = parseNumber(row.Value);
    const year = Number(row.Year);
    if (value === null || !Number.isFinite(year)) return;

    const existing = popMap.get(country);
    if (!existing || year > existing.year) {
      popMap.set(country, { year, population: value });
    }
  });

  return popMap;
}

Promise.all([d3.text(CSV_PATH), d3.text(POP_CSV_PATH)])
  .then(([tourismText, popText]) => {
    const tourismRows = parseCsvWithMetadata(tourismText);
    const dataset = buildDataset(tourismRows);
    if (!dataset.length) {
      throw new Error("No valid records found in the CSV file.");
    }

    const popRows = parseCsvWithMetadata(popText);
    const popMap = buildPopulationMap(popRows);

    dataset.forEach((d) => {
      const pop = popMap.get(d.country);
      d.population = pop ? pop.population : null;
    });

    const filteredDataset = dataset.filter((d) => d.population != null);

    appState.dataset = filteredDataset;

    // Initialize tabs and search
    initTabs();
    initSearch();

    // Render charts
    renderCharts(filteredDataset);

    // Handle window resize with debouncing for better performance
    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        renderCharts(filteredDataset);
      }, 250);
    });
  })
  .catch((error) => {
    console.error("Failed to load CSV data", error);
  });
