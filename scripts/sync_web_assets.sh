#!/usr/bin/env bash
# Копирует веб-игру в Android-оболочку (assets/web) перед сборкой APK.
# Также кладёт NOTICE (требование Apache 2.0 при распространении).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/android/app/src/main/assets/web"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$ROOT/web/." "$DEST/"
cp "$ROOT/NOTICE" "$DEST/NOTICE.txt"
cp "$ROOT/LICENSE" "$DEST/LICENSE.txt"
echo "[sync] web -> $DEST ($(find "$DEST" -type f | wc -l) files)"
