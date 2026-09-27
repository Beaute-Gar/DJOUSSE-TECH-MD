#!/bin/bash
# DJOUSSE TECH - DMARRAGE DU BOT (npm start)
# Compatible : Linux, macOS, VPS, termux
cd "$(dirname "$0")"
export NODE_ENV=production

if [ ! -d node_modules ]; then
  echo "[!] node_modules introuvable. Installation en cours..."
  npm install
fi

echo ""
echo "============================================================="
echo "  DJOUSSE-TECH-MD - Demarrage du bot (npm start)"
echo "============================================================="
echo ""
npm start
