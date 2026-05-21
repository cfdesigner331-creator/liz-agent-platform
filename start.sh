#!/bin/sh
set -e

echo "[Start] Iniciando container da Plataforma Liz..."

# Garante que as migrações/sincronizações do SQLite rodem antes do boot
node migrate.mjs

# Executa o servidor standalone compilado pelo Next.js se disponível
if [ -f .next/standalone/server.js ]; then
  echo "[Start] Iniciando servidor standalone Next.js em produção..."
  exec node .next/standalone/server.js
else
  echo "[Start] Servidor standalone não encontrado. Iniciando via npm run start..."
  exec npm run start
fi
