Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class W3 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int s);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h,int x,int y,int w,int hh,bool r);
}
'@
$h = [IntPtr]459554
[W3]::ShowWindow($h, 9) | Out-Null            # SW_RESTORE
[W3]::MoveWindow($h, 30, 20, 1296, 920, $true) | Out-Null
[W3]::SetForegroundWindow($h) | Out-Null
Write-Output "raised $h"
