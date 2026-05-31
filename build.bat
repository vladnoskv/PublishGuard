@echo off
setlocal

cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found on PATH.
  exit /b 1
)

echo.
echo === PublishGuard: typecheck ===
call npm run typecheck
if errorlevel 1 exit /b %errorlevel%

echo.
echo === PublishGuard: tests ===
call npm test
if errorlevel 1 exit /b %errorlevel%

echo.
echo === PublishGuard: workspace build ===
call npm run build
if errorlevel 1 exit /b %errorlevel%

echo.
echo === PublishGuard: VSIX package ===
pushd packages\vscode
call npm run package
set "PACKAGE_EXIT=%errorlevel%"
popd
if not "%PACKAGE_EXIT%"=="0" exit /b %PACKAGE_EXIT%

echo.
echo Build complete. VSIX output is in packages\vscode.
exit /b 0
