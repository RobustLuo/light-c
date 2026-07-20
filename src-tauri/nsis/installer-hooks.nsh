; ============================================================================
; LuoScope NSIS hooks - normal installer
; ============================================================================

!macro NSIS_HOOK_PREINSTALL
  ; 自动更新或用户手动覆盖安装时，旧进程可能仍占用目标文件，先尝试关闭以避免“无法打开要写入的文件”。
  Call LuoScope_CloseRunningProcess
  ; 常规包不再自动下载 WebView2，避免微软 bootstrapper 在异常环境里创建额外 Edge 快捷方式。
  Call LuoScope_CheckWebView2Runtime
!macroend

Function LuoScope_CloseRunningProcess
  ; 同时尝试关闭更名前后的 exe，避免升级安装时被旧进程占用。
  nsExec::ExecToStack 'taskkill /IM "LuoScope.exe" /F'
  Pop $0
  Pop $1
  nsExec::ExecToStack 'taskkill /IM "LightC.exe" /F'
  Pop $0
  Pop $1
  Sleep 800
FunctionEnd

Function LuoScope_CheckWebView2Runtime
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  Call LuoScope_IsValidWebView2Version
  Pop $1
  StrCmp $1 "1" done

  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  Call LuoScope_IsValidWebView2Version
  Pop $1
  StrCmp $1 "1" done

  ReadRegStr $0 HKCU "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  Call LuoScope_IsValidWebView2Version
  Pop $1
  StrCmp $1 "1" done

  MessageBox MB_OK|MB_ICONSTOP "当前系统未检测到 Microsoft Edge WebView2 Runtime。$\r$\n$\r$\n常规安装包不会再联网自动安装 WebView2，以避免创建额外 Edge 快捷方式或触发异常安装。$\r$\n$\r$\n请从官方 Release 下载 LuoScope_webview2_offline_x64.exe，或先安装 Microsoft Edge WebView2 Runtime 后再运行常规安装包。"
  Abort

  done:
FunctionEnd

Function LuoScope_IsValidWebView2Version
  StrCmp $0 "" invalid
  StrCmp $0 "0.0.0.0" invalid
  Push "1"
  Return

  invalid:
    Push "0"
FunctionEnd
