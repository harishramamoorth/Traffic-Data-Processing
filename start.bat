@echo off
echo ===================================================
echo 🚦 Starting Traffic Data Processor (Client + Server)
echo ===================================================

start "Traffic API Server" cmd /k "cd server && npm run dev"
timeout /t 2 >nul
start "Traffic React Client" cmd /k "cd client && npm run dev"

echo.
echo Server: http://localhost:5000
echo Client: http://localhost:5173
echo.
echo Both services are booting up in separate windows.
