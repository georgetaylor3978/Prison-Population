# Prison Statistics Dashboard

Interactive dashboard for Canadian provincial/territorial correctional program data.

**Source:** Statistics Canada, Table 35-10-0154-01  
**Live Dashboard:** https://georgetaylor3978.github.io/Prison-Population/

## Features
- Light & dark theme toggle
- Date range selector (default 2010–most recent)
- Multi-metric selection with colour pills
- KPI cards showing latest values and growth over period
- Trends over time line chart
- Custody breakdown stacked chart (Sentenced / Remand / Other)
- Community supervision stacked bar chart (Probation / Conditional / Parole)
- Year-over-year growth table

## Updating Data
1. Download the latest CSV from [Stats Can Table 35-10-0154-01](https://www150.statcan.gc.ca/t1/tbl1/en/cv!recreate.action?pid=3510015401)
2. Replace `3510015401_databaseLoadingData.csv` in this folder
3. Run `update.bat` to push to GitHub

## Dev / Local Preview
Open `index.html` via a local web server (e.g., VS Code Live Server) — required because the CSV is loaded via `fetch()`.
