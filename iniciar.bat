@echo off
title Projeto Anjos - Setup e Inicializacao
color 0b

echo ===================================================
echo     INICIALIZANDO PROJETO ANJOS...
echo ===================================================
echo.

echo [0/2] Verificando configuracoes (.env)...
if not exist "apps\web\.env" (
    if exist "apps\web\.env.example" (
        echo Criando .env na Web...
        copy "apps\web\.env.example" "apps\web\.env" >nul
        echo.
        echo [ATENCAO] Configure DATABASE_URL e JWT_SECRET em apps\web\.env antes de usar em producao.
    )
)

echo.
echo [1/2] Instalando dependencias do projeto...
call npm install
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar dependencias.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/2] Iniciando o servidor de desenvolvimento (web)...
echo A aplicacao (frontend + API) executara em http://localhost:3000
echo Banco de dados: PostgreSQL (Supabase) via DATABASE_URL.
echo.
call npm run dev

pause
