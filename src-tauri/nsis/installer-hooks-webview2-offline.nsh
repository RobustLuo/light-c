; ============================================================================
; LuoScope NSIS hooks - WebView2 offline installer
; ============================================================================

!macro NSIS_HOOK_PREINSTALL
  ; 离线包会自带 WebView2 安装器，只处理旧进程锁文件问题，不拦截缺失的 WebView2 Runtime。
  Call LuoScope_CloseRunningProcess
!macroend

Function LuoScope_CloseRunningProcess
  nsExec::ExecToStack 'taskkill /IM "LuoScope.exe" /F'
  Pop $0
  Pop $1
  nsExec::ExecToStack 'taskkill /IM "LightC.exe" /F'
  Pop $0
  Pop $1
  Sleep 800
FunctionEnd
