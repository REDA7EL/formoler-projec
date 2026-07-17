@echo off
echo Starting Campaign Manager App...

echo [1/2] Starting Node.js Backend Server...
start "Backend Server" cmd /k "cd backend && npm start"

echo [2/2] Starting React + Electron Frontend...
start "Frontend Electron" cmd /k "cd frontend && npm run electron:dev"

echo Both services are starting up! You can close this window.
