#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/home/manic/www/duty"
API_DIR="$ROOT_DIR/duty-api"
WEB_DIR="$ROOT_DIR/duty-web"
API_ECOSYSTEM="$API_DIR/ecosystem.config.cjs"
WEB_ECOSYSTEM="$WEB_DIR/ecosystem.config.cjs"
PM2="$API_DIR/node_modules/.bin/pm2"

if command -v systemctl >/dev/null 2>&1 && ! systemctl is-active --quiet docker; then
  echo "[deploy] docker start"
  sudo systemctl start docker
elif command -v service >/dev/null 2>&1 && ! service docker status >/dev/null 2>&1; then
  echo "[deploy] docker start"
  sudo service docker start
fi

# echo "[deploy] mysql compose up"
# docker compose -f "$ROOT_DIR/docker-compose.yml" up -d mysql84-duty

echo "[deploy] API build"
npm --prefix "$API_DIR" run build

echo "[deploy] Web build"
npm --prefix "$WEB_DIR" run build

echo "[deploy] PM2 reload"
"$PM2" startOrReload "$API_ECOSYSTEM" --update-env
"$PM2" startOrReload "$WEB_ECOSYSTEM" --update-env
"$PM2" save

echo "[deploy] health check"
curl --fail --silent --show-error --max-time 5 http://127.0.0.1:5050/ >/dev/null
"$PM2" status

echo "[deploy] done"
