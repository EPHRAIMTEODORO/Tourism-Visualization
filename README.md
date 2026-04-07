# Tourism Visualization

An academic research project that uses interactive D3.js visualizations to study how different chart types affect the readability of tourism data. Participants complete a structured questionnaire after viewing both a standard scatter plot and a bubble scatter plot, rating how easy each was to interpret across three tasks. Responses are stored in a Neon Postgres database via Netlify Functions, and a live results page performs full statistical analysis on the collected data.

---

## Purpose

This project is a within-subjects usability study comparing two chart types:

- **Standard Scatter Plot** — tourist arrivals vs. expenditure, one point per country
- **Bubble Scatter Plot** — same data with bubble size encoding a third variable (population)

Participants rate each chart on three ease dimensions (1 = very difficult, 5 = very easy):

| Dimension | What it measures |
|---|---|
| Pattern Recognition | How easily overall trends are spotted |
| Outlier Detection | How easily unusual data points are identified |
| Population Pattern | How easily population size differences are interpreted |

The study uses a counterbalanced order to control for learning effects.

---

## Features

### Main Visualization (`/`)
- Side-by-side standard scatter plot and bubble scatter plot with shared axes
- Bubble size mapped to tourist expenditure
- Per-country color legend with interactive tooltips (country, arrivals, expenditure, year)
- Responsive SVG layout using Flexbox and `viewBox` scaling
- Data sourced from UN tourism CSV (`data/Tourist-VisitorsArrivalandExpenditure.csv`)

### Questionnaire (`/`)
- Multi-step survey flow embedded alongside the visualizations
- Collects demographics (age group, field of study, prior data vis experience)
- Records Likert-scale ease ratings per condition
- Token-gated submission to prevent duplicate responses
- Submits to Neon Postgres via a Netlify serverless function

### Results Page (`/results/`)
- Fetches live data from the database on every page load — no hardcoded values
- **Boxplots** — distribution of ease ratings per condition for all three categories
- **Statistical Analysis** section:
  - Descriptive statistics (mean and median per condition per category)
  - Shapiro-Wilk normality test on paired differences (Royston AS R94 algorithm)
  - Conditional hypothesis testing — paired t-test if normal, Wilcoxon signed-rank if not
  - p-values highlighted visually (red badge = significant, green = not significant)
  - Auto-generated human-readable summary conclusions
  - D3 grouped bar chart comparing mean scores across conditions and categories

### Admin (`/admin/`)
- Internal view of collected responses

---

## Project Structure

```
index.html                        # Main visualization + questionnaire
css/styles.css                    # Styles for main page
js/script.js                      # D3 scatter and bubble chart rendering
js/questionnaire.js               # Multi-step questionnaire logic
data/
  Tourist-VisitorsArrivalandExpenditure.csv
  population.csv
results/
  index.html                      # Results page (structure only)
  results.css                     # Results page styles
  results.js                      # Boxplots + statistical analysis rendering
  stats/
    utils.js                      # normalCDF, normalQuantile, betainc, lgamma
    mean.js
    median.js
    shapiroWilk.js                # Royston (1992/1995) AS R94
    pairedTTest.js                # Exact p-value via incomplete beta function
    wilcoxonSignedRank.js         # Normal approximation with tie correction
netlify/
  functions/
    _responses-store.js           # Shared DB pool + validation utilities
    api-register.js               # POST /api/register
    api-responses.js              # GET /api/responses
    api-responses-summary.js      # GET /api/responses-summary
    api-tokens.js                 # GET /api/tokens
    api-validate-token.js         # POST /api/validate-token
    submit-response.js            # POST /api/submit-response
admin/
  index.html
netlify.toml
```

---

## Running Locally

1. **Install dependencies:**

```bash
npm install
```

2. **Set up your environment:**

Create a `.env` file in the project root:

```bash
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
```

3. **Start the dev server:**

```bash
npm start
```

Then open **http://localhost:8888** in your browser.

- Main visualization: `http://localhost:8888/`
- Results page: `http://localhost:8888/results/`
- Admin: `http://localhost:8888/admin/`

The Netlify CLI handles both static file serving and serverless function routing automatically.

---

## Database Setup (Neon Postgres)

Run this in the Neon SQL editor to create the required table:

```sql
CREATE TABLE IF NOT EXISTS questionnaire_responses (
  id                          BIGSERIAL PRIMARY KEY,
  submitted_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  participant_id              TEXT NOT NULL UNIQUE,
  condition_a_pattern_ease    SMALLINT CHECK (condition_a_pattern_ease BETWEEN 1 AND 5),
  condition_a_outlier_ease    SMALLINT CHECK (condition_a_outlier_ease BETWEEN 1 AND 5),
  condition_a_population_ease SMALLINT CHECK (condition_a_population_ease BETWEEN 1 AND 5),
  condition_b_pattern_ease    SMALLINT CHECK (condition_b_pattern_ease BETWEEN 1 AND 5),
  condition_b_outlier_ease    SMALLINT CHECK (condition_b_outlier_ease BETWEEN 1 AND 5),
  condition_b_population_ease SMALLINT CHECK (condition_b_population_ease BETWEEN 1 AND 5)
);
```

---

## Deploying to Netlify

1. Push the repo to GitHub.
2. Create a new Netlify site linked to the repo.
3. In **Site settings → Environment variables**, add `DATABASE_URL`.
4. Deploy — Netlify builds and serves everything automatically.

---

## Data Notes

- CSV source: UN tourism statistics
- First line of the CSV is a metadata header; the parser skips it
- Arrivals are stored in thousands and converted to absolute counts at render time
- Expenditure is stored in millions of USD and converted to absolute USD at render time
- For each country, the latest year with both arrivals and expenditure present is used
- D3.js v7 is loaded via CDN in all HTML files