# Wait for the private loopback server before opening the browser.
$ErrorActionPreference = "SilentlyContinue"
$url = "http://127.0.0.1:3000"
for ($attempt = 0; $attempt -lt 60; $attempt++) {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
      Start-Process $url
      exit 0
    }
  } catch { }
  Start-Sleep -Seconds 1
}
Write-Host "JR Roofing preview did not start within 60 seconds. Check the launcher window for errors."
exit 1
