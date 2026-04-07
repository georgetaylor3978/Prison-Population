@echo off
REM ============================================================
REM  Prison Statistics Dashboard — GitHub Deployment Script
REM  Repo: https://github.com/georgetaylor3978/Prison-Population
REM  Run this script from the "Prison Pop" folder (or anywhere)
REM  after updating the CSV data file each year.
REM ============================================================

REM Change to the directory where this .bat lives
cd /d "%~dp0"

REM Stage all changes (new data file, code updates, etc.)
git add -A

REM Prompt for a commit message (defaults to "Update data and dashboard")
set /p MSG="Commit message (press Enter for default): "
if "%MSG%"=="" set MSG=Update data and dashboard

git commit -m "%MSG%"

REM Push to GitHub Pages / main branch
git push origin main

echo.
echo ✅  Push complete!
echo     Live site: https://georgetaylor3978.github.io/Prison-Population/
echo.
pause
