@echo off
setlocal
chcp 65001 >nul
pushd "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.23 or newer is required. Install it from https://nodejs.org/
  pause
  popd
  exit /b 1
)
node "scripts\run-local.mjs" %*
if errorlevel 1 (
  echo.
  echo Local demo could not start. Read the error above.
  pause
  popd
  exit /b 1
)
popd
endlocal
