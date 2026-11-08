@echo off
rem Double-click to start the LessonLoop Java backend on http://localhost:8000
cd /d "%~dp0"
if not exist target\lessonloop-backend.jar (
  echo The jar is missing. Build it first:  mvn package -DskipTests
  pause
  exit /b 1
)
set PORT=8000
echo Starting backend on http://localhost:8000  (close this window to stop it)
java --enable-native-access=ALL-UNNAMED -jar target\lessonloop-backend.jar
pause
