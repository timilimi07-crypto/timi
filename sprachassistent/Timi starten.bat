@echo off
rem Startet Timi unter Windows: Doppelklick genuegt.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js fehlt. Bitte installieren: https://nodejs.org/ & pause & exit /b 1)
if not exist node_modules call npm install
if not exist .env (copy .env.example .env >nul & echo Bitte trag deinen API-Schluessel in die Datei .env ein. & notepad .env)
set URL=http://localhost:3000
rem Als eigenes App-Fenster oeffnen (Edge oder Chrome)
start "" cmd /c "timeout /t 3 >nul & (start msedge --app=%URL% || start chrome --app=%URL% || start %URL%)"
npm start
