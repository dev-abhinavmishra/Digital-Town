Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class W4 {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int s);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr a,int x,int y,int w,int hh,uint f);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
'@
# minimize every chrome window that is NOT my test window (hwnd 459554)
Get-Process chrome -ErrorAction SilentlyContinue | ForEach-Object {
  $h = $_.MainWindowHandle
  if ($h -ne 0 -and $h -ne [IntPtr]459554) {
    [W4]::ShowWindow($h, 6) | Out-Null
    Write-Output ("minimized " + $h + " : " + $_.MainWindowTitle)
  }
}
[W4]::SetWindowPos([IntPtr]459554, [IntPtr]::new(-1), 30, 20, 1296, 920, 0x0040) | Out-Null  # TOPMOST+SHOWWINDOW
[W4]::SetForegroundWindow([IntPtr]459554) | Out-Null
Write-Output "raised mine"
