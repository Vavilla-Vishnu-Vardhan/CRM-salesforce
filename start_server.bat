@echo off
echo =================================================================
echo        CRM Web Application with Salesforce Integration
echo =================================================================
echo.
echo [1] Initializing local HTTP server on port 8000...
echo [2] Opening web application at http://localhost:8000...
echo.
echo Keep this window open while running the application.
echo To stop the server, press Ctrl+C in this window.
echo.
start "" "http://localhost:8000"
python -m http.server 8000
