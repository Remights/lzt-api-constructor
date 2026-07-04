# Скачивает Font Awesome и QRCode в web/vendor/ (офлайн UI).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$vendor = Join-Path $root "web\vendor"
$woffDir = Join-Path $vendor "fontawesome\webfonts"
New-Item -ItemType Directory -Force -Path "$vendor\fontawesome\css", $woffDir | Out-Null

$fa = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1"
Invoke-WebRequest -Uri "$fa/css/all.min.css" -OutFile "$vendor\fontawesome\css\all.min.css" -UseBasicParsing
foreach ($f in @("fa-solid-900.woff2", "fa-regular-400.woff2", "fa-brands-400.woff2")) {
    $out = Join-Path $woffDir $f
    Invoke-WebRequest -Uri "$fa/webfonts/$f" -OutFile $out -UseBasicParsing
    if ((Get-Item $out).Length -lt 5000) { throw "Bad webfont: $f" }
}

$qrUrls = @(
    "https://cdn.jsdelivr.net/npm/qrcode@1.2.2/build/qrcode.min.js",
    "https://unpkg.com/qrcode@1.2.2/build/qrcode.min.js"
)
$qrOut = Join-Path $vendor "qrcode.min.js"
$ok = $false
foreach ($u in $qrUrls) {
    try {
        Invoke-WebRequest -Uri $u -OutFile $qrOut -UseBasicParsing
        if ((Get-Item $qrOut).Length -gt 10000) { $ok = $true; break }
    } catch { Write-Host "Skip $u" }
}
if (-not $ok) { throw "Failed to download qrcode.min.js" }

Write-Host "OK: vendor assets (css + 3 webfonts + qrcode)"
