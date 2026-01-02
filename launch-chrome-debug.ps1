$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath)) {
    $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}

if (-not (Test-Path $chromePath)) {
    Write-Host "Could not find Chrome executable." -ForegroundColor Red
    exit 1
}

Write-Host "Closing running Chrome instances..." -ForegroundColor Yellow
Stop-Process -Name "chrome" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "Launching Chrome with Remote Debugging (Port 9222)..." -ForegroundColor Green
Start-Process $chromePath -ArgumentList "--remote-debugging-port=9222"
Write-Host "Done! You can now use Julie with this browser window."
