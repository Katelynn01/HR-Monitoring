@echo off
set PATH=C:\Program Files\nodejs;%PATH%
echo ========================================================
echo HR Monitoring System Setup
echo ========================================================
echo.
echo Installing dependencies. This might take a few minutes...
call npm install --legacy-peer-deps --no-audit --no-fund
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Dependencies failed to install. Please check your internet connection.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Starting the development server...
call npm run dev
pause
