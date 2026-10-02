$mine = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
  Where-Object { $_.CommandLine -match 'remote-debugging-port=9223' }
$mine | ForEach-Object {
  $p = Get-Process -Id $_.ProcessId
  if ($p.MainWindowHandle -ne 0) {
    Write-Output ("pid=" + $_.ProcessId + " hwnd=" + $p.MainWindowHandle + " title=" + $p.MainWindowTitle)
  }
}
