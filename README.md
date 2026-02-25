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

## How to run (Netlify + Neon)
This project uses a Netlify Function to store questionnaire responses in Neon Postgres.

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file from `.env.example` and set your Neon connection string:

```bash
cp .env.example .env
```

3. In Neon SQL editor, create the table and analysis view:

```sql
CREATE TABLE IF NOT EXISTS participant_responses (
	id BIGSERIAL PRIMARY KEY,
	submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	demographics JSONB NOT NULL,
	condition_a JSONB NOT NULL,
	condition_b JSONB NOT NULL,
	comparison JSONB NOT NULL,
	final JSONB NOT NULL,
	raw_response JSONB,
	age_group TEXT,
	major_group TEXT,
	took_course BOOLEAN,
	condition_a_ease SMALLINT CHECK (condition_a_ease BETWEEN 1 AND 5),
	condition_b_ease SMALLINT CHECK (condition_b_ease BETWEEN 1 AND 5),
	easier_visualization TEXT
);

CREATE OR REPLACE VIEW participant_ease_scores AS
SELECT id, submitted_at, 'A'::text AS condition, condition_a_ease AS ease_score
FROM participant_responses
WHERE condition_a_ease IS NOT NULL
UNION ALL
SELECT id, submitted_at, 'B'::text AS condition, condition_b_ease AS ease_score
FROM participant_responses
WHERE condition_b_ease IS NOT NULL;
```

4. Run locally with Netlify:

```bash
npm start
```

Then open the local URL shown by Netlify CLI (usually `http://localhost:8888`).

## Deploy to Netlify
- Push this repo to GitHub.
- Create a Netlify site from the repo.
- In Netlify site settings, add environment variable `DATABASE_URL`.
- Deploy.

The frontend will submit responses to:
- `/.netlify/functions/submit-response`

Box-plot-friendly view:
- `participant_ease_scores`

## Project structure
- index.html
- css/styles.css
- js/script.js
- js/questionnaire.js
- data/Tourist-VisitorsArrivalandExpenditure.csv
- netlify/functions/submit-response.js
- netlify.toml

## Notes
- D3.js v7 is loaded via the CDN in index.html.
- If you add or replace the CSV, ensure the first metadata line is present or update the parser in js/script.js.