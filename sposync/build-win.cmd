@echo off
setlocal
cd /d "%~dp0.."

rem Builds sposync\bin\sposync-win64.exe in a private venv (sposync\venv).
rem Needs Python 3.12 to 3.15: the pinned numpy, pillow and websockets need 3.12 or newer,
rem and PyInstaller 6.22.3 supports Python before 3.16.
rem Set PYTHON to a full python.exe path to pick the interpreter.
rem PYTHON only makes a missing venv, or recreates one that fails the 3.12 to 3.15 check.
rem A valid existing venv is reused, even when PYTHON points to another Python.
rem Exit code 0 = built, 1 = failed. The last printed line is the SHA256.

if not defined PYTHON set "PYTHON=python"
set "VENV=%~dp0venv"

if not exist "%VENV%\Scripts\python.exe" (
  "%PYTHON%" -m venv "%VENV%"
  if errorlevel 1 exit /b 1
)

call :gate
if errorlevel 1 (
  >&2 echo build-win: sposync\venv does not use Python 3.12 to 3.15, recreating it.
  "%PYTHON%" -m venv --clear "%VENV%"
  if errorlevel 1 exit /b 1
  call :gate
)
if errorlevel 1 (
  >&2 echo build-win: Python 3.12 to 3.15 is required.
  >&2 echo build-win: Set PYTHON to the full path of a python.exe from 3.12 to 3.15 and run again.
  exit /b 1
)

rem Wheels only: no package may run a build script at install time.
"%VENV%\Scripts\python.exe" -m pip install --disable-pip-version-check --only-binary=:all: -r sposync\requirements-build.txt
if errorlevel 1 exit /b 1

"%VENV%\Scripts\python.exe" -m PyInstaller --noconfirm --clean --onefile --name sposync-win64 --hide-console hide-early ^
  --specpath build --workpath build --distpath dist ^
  --collect-all textual --collect-all rich --collect-all soundcard ^
  --collect-all numpy --collect-all websockets --collect-all pystray --collect-all PIL ^
  "%CD%\sposync\app.py"
if errorlevel 1 exit /b 1

if not exist sposync\bin mkdir sposync\bin
move /y dist\sposync-win64.exe sposync\bin\sposync-win64.exe >nul
if errorlevel 1 exit /b 1

powershell -NoProfile -Command "(Get-FileHash 'sposync\bin\sposync-win64.exe' -Algorithm SHA256).Hash.ToLower()"
if errorlevel 1 exit /b 1

endlocal
exit /b 0

:gate
"%VENV%\Scripts\python.exe" -c "import sys; sys.exit(not ((3, 12) <= sys.version_info[:2] < (3, 16)))"
exit /b %errorlevel%
