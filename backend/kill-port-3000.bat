@echo off
echo Checking process on port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
  echo Killing PID %%a
  taskkill /F /PID %%a
)
echo Done. Now run: npm run dev
