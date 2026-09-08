#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="${HOME}/djousse-tech-md"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  pkg update -y
  pkg install -y nodejs-lts git
fi

if [ ! -d node_modules ]; then
  npm ci --omit=dev --ignore-scripts --no-audit --no-fund
fi

export DB_TYPE=sqlite
export MULTI_ACCOUNT_ENABLED=false
export ENGINE_TYPE=baileys
export PORT="${PORT:-3000}"

if command -v termux-wake-lock >/dev/null 2>&1; then
  termux-wake-lock || true
fi

mkdir -p session data
exec node index.cjs
