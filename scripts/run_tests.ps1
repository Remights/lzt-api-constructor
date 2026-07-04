# Запуск всех 53 автотестов (Windows)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path) | Out-Null
Set-Location ..

Write-Host "=== pytest ===" -ForegroundColor Cyan
python -m pytest tests/ -q
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$nodeTests = @(
    "tests/js_generators.test.js",
    "tests/features_share.test.js",
    "tests/scenario_normalize.test.js",
    "tests/scenario_engine.test.js",
    "tests/scenario_validate.test.js"
)
foreach ($t in $nodeTests) {
    Write-Host "=== node $t ===" -ForegroundColor Cyan
    node $t
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
Write-Host "`nAll 53 tests passed." -ForegroundColor Green
