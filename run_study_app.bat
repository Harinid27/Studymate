@echo off
echo Starting StudyMate Collaborative Mode...
echo.
echo Killing any existing Python processes on port 5001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5001') do taskkill /f /pid %%a >nul 2>&1

echo.
echo Starting the application...
python collaborative_mode.py

echo.
echo Application stopped.
pause
