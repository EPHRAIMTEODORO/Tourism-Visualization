# Tourism Visualization

Research demo that compares a standard scatter plot and a bubble scatter plot for tourism analysis using D3.js.

## Features
- Standard scatter plot with fixed-radius points
- Bubble scatter plot with size mapped to tourism expenditure
- Shared axes for direct comparison
- Tooltip with country name, arrivals, expenditure, and year
- Per-country color legend
- Responsive layout using Flexbox

## Data
The data is loaded from:
- data/Tourist-VisitorsArrivalandExpenditure.csv

The visualization uses the latest year where both arrivals and expenditure are available for each country.

## How to run
Open index.html in a browser. If you use a local web server, place the project root as the server root so the CSV can be loaded.

## Project structure
- index.html
- css/styles.css
- js/script.js
- data/Tourist-VisitorsArrivalandExpenditure.csv