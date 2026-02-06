# Tourism Visualization

Research demo comparing a standard scatter plot with a bubble scatter plot for tourism analysis using D3.js.

## Features
- Side-by-side scatter and bubble charts with shared axes for direct comparison
- Bubble size mapped to tourism expenditure
- Tooltip with country name, arrivals, expenditure, and year
- Per-country color legend
- Responsive layout with Flexbox and SVG viewBox scaling

## Data
The data is loaded from:
- data/Tourist-VisitorsArrivalandExpenditure.csv

The CSV contains a metadata header in the first line, followed by the column header row.
Expected columns (names in the file):
- Region/Country/Area
- Year
- Series
- Value

Series values used by the visualization:
- Tourist/visitor arrivals (thousands)
- Tourism expenditure (millions of US dollars)

Processing notes:
- Arrivals are converted from thousands to absolute counts.
- Expenditure is converted from millions of USD to absolute USD.
- For each country, the latest year with both arrivals and expenditure is used.

## How to run
Because the CSV is loaded via fetch, run a local server from the project root:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.

## Project structure
- index.html
- css/styles.css
- js/script.js
- data/Tourist-VisitorsArrivalandExpenditure.csv

## Notes
- D3.js v7 is loaded via the CDN in index.html.
- If you add or replace the CSV, ensure the first metadata line is present or update the parser in js/script.js.