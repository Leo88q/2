#!/usr/bin/env bash
# Готовит рабочее дерево нативного ядра Piegeddon (форк google/pienoon).
#
# Использование:
#   ./scripts/setup_game.sh [--with-assets] [--with-deps]
#
#   --with-assets  скачать rawassets/ и сгенерировать assets/ (нужен python2/3
#                  и утилиты из rawassets; для полной сборки APK)
#   --with-deps    инициализировать субмодули dependencies/ (fplbase, motive,
#                  flatbuffers, pindrop, ...). Требует доступ к github и
#                  сторонним git-зеркалам.
#
# Без флагов: клонирует код google/pienoon в third_party/pienoon и применяет
# ребрендинг (scripts/rebrand_pienoon.sh). Этого достаточно для комплаенса,
# ревью кода и подготовки релиза; полная сборка выполняется в CI.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UPSTREAM_URL="https://github.com/google/pienoon.git"
# Зафиксированный коммит upstream (HEAD архивной ветки master на 2026-10).
UPSTREAM_COMMIT="a721180de4d9de3696af3b3734d1ad269975b111"
DEST="$REPO_ROOT/third_party/pienoon"

WITH_ASSETS=0
WITH_DEPS=0
for arg in "$@"; do
  case "$arg" in
    --with-assets) WITH_ASSETS=1 ;;
    --with-deps) WITH_DEPS=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

if [ ! -d "$DEST/.git" ]; then
  echo "[setup] cloning $UPSTREAM_URL @ $UPSTREAM_COMMIT"
  git clone "$UPSTREAM_URL" "$DEST"
  git -C "$DEST" checkout "$UPSTREAM_COMMIT"
fi

echo "[setup] applying Piegeddon rebrand"
"$REPO_ROOT/scripts/rebrand_pienoon.sh" "$DEST"

if [ "$WITH_DEPS" = "1" ]; then
  echo "[setup] fetching dependency submodules (23 repos)"
  git -C "$DEST" submodule update --init --recursive || {
    echo "[setup] WARN: часть субмодулей недоступна (старые зеркала)." >&2
    echo "[setup] См. docs/DEPLOY.md, раздел «Native core bring-up»." >&2
  }
fi

if [ "$WITH_ASSETS" = "1" ]; then
  echo "[setup] assets/ и rawassets/ не входят в git (см. .gitignore)."
  echo "[setup] Восстановите их из upstream: git -C $DEST checkout $UPSTREAM_COMMIT -- assets rawassets"
  git -C "$DEST" checkout "$UPSTREAM_COMMIT" -- assets rawassets || true
fi

cat <<'EOF'

[setup] Готово. Дерево: third_party/pienoon
[setup] Дальше:
  - полная сборка APK (в CI): .github/workflows/native-core.yml
  - публикация:        docs/DEPLOY.md
  - лицензии:          docs/LICENSE-COMPLIANCE.md
EOF
