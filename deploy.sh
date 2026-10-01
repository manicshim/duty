#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/home/manic/www/duty"
API_DIR="$ROOT_DIR/duty-api"
WEB_DIR="$ROOT_DIR/duty-web"
ECOSYSTEM="$API_DIR/ecosystem.config.cjs"

if command -v systemctl >/dev/null 2>&1 && ! systemctl is-active --quiet docker; then
  echo "[deploy] docker start"
  sudo systemctl start docker
elif command -v service >/dev/null 2>&1 && ! service docker status >/dev/null 2>&1; then
  echo "[deploy] docker start"
  sudo service docker start
fi

echo "[deploy] mysql compose up"
docker compose -f "$ROOT_DIR/docker-compose.yml" up -d mysql84-duty

echo "[deploy] API build"
npm --prefix "$API_DIR" run build

echo "[deploy] Web build"
npm --prefix "$WEB_DIR" run build

echo "[deploy] PM2 reload"
pm2 startOrReload "$ECOSYSTEM" --update-env
pm2 save

if command -v systemctl >/dev/null 2>&1; then
  echo "[deploy] nginx reload"
  sudo systemctl reload nginx
else
  echo "[deploy] systemctl not found, skip nginx reload"
fi

echo "[deploy] done"
