# Regenerates the minified production assets (.min.*) from the readable sources.
# Requires Node.js + npx (downloads terser / clean-css-cli on first run).
# Run from the pingclass directory. After regenerating, bump the ?v= cache-buster
# in admin-dashboard.html so browsers pick up the new files.
$ErrorActionPreference = 'Stop'

npx --yes terser shared.js -c -m --output shared.min.js
npx --yes terser admin-dashboard.js -c -m --output admin-dashboard.min.js
npx --yes terser onboarding.js -c -m --output onboarding.min.js
npx --yes terser parent-dashboard.js -c -m --output parent-dashboard.min.js
npx --yes terser teacher-dashboard.js -c -m --output teacher-dashboard.min.js
npx --yes clean-css-cli -o shared.min.css shared.css
npx --yes clean-css-cli -o admin-dashboard.min.css admin-dashboard.css
npx --yes clean-css-cli -o parent-dashboard.min.css parent-dashboard.css
npx --yes clean-css-cli -o teacher-dashboard.min.css teacher-dashboard.css

Write-Host "Minified assets regenerated. Remember to bump ?v= in the dashboard HTML files."
