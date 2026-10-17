@echo off
title Cuñadas Chic - Sistema de Fardos de Ropa Usada
color 0D
echo ==============================================================================
echo    🌸 CUÑADAS CHIC - GESTION DE FARDOS DE ROPA USADA ^& VINTAGE BOUTIQUE 🌸
echo ==============================================================================
if not exist "node_modules" (
  echo Instalando dependencias necesarias...
  call npm install
)

echo Iniciando servidor Node.js...
echo.
start "" http://localhost:3000
node server.js
pause
