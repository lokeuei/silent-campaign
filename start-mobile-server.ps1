$port = 8099
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ip = (ipconfig | Select-String -Pattern "IPv4 Address" | Select-Object -First 1).ToString().Split(":")[-1].Trim()

Set-Location $root
Write-Host ""
Write-Host "Silent Campaign is available on this computer at:"
Write-Host "  http://127.0.0.1:$port/"
Write-Host ""
Write-Host "Open this on your phone while it is on the same Wi-Fi/network:"
Write-Host "  http://$ip`:$port/"
Write-Host ""
Write-Host "If your phone cannot connect, allow Python through Windows Firewall or open TCP port $port."
Write-Host "Press Ctrl+C to stop the server."
Write-Host ""

py -m http.server $port --bind 0.0.0.0
