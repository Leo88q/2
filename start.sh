#!/usr/bin/env bash
# Piegeddon — одношаговый запуск: обновление + зависимости + старт.
#
#   ./start.sh
#
# Скрипт сам разрешает конфликт package-lock.json (npm переписывает его
# локально и блокирует git pull) и использует npm ci — он не меняет lock-файл.
set -e
cd "$(dirname "$0")"

echo "[start] обновляю репозиторий…"
# Локальные правки package-lock.json — сгенерированный шум, откатываем безопасно.
git checkout -- backend/package-lock.json 2>/dev/null || true
git pull

echo "[start] ставлю зависимости (npm ci)…"
cd backend
npm ci

echo "[start] запускаю сервер…"
npm start
