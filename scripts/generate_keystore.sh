#!/usr/bin/env bash
# Генерация keystore для подписи APK (dApp Store требует ОТДЕЛЬНЫЙ ключ,
# не связанный с Google Play). См. docs/DEPLOY.md.
#
# Использование: ./scripts/generate_keystore.sh [путь-к-keystore]
set -euo pipefail
DEST="${1:-./piegeddon.keystore}"
ALIAS="piegeddon"
if [ -f "$DEST" ]; then
  echo "Файл уже существует: $DEST" >&2
  exit 1
fi
keytool -genkeypair -v \
  -keystore "$DEST" \
  -alias "$ALIAS" \
  -keyalg RSA -keysize 2048 \
  -validity 10000 \
  -storepass "${PIEGEDDON_KEYSTORE_PASSWORD:-changeme}" \
  -keypass "${PIEGEDDON_KEY_PASSWORD:-changeme}" \
  -dname "CN=Piegeddon, O=Piegeddon Contributors, C=RU"

cat <<EOF

[keystore] Создан: $DEST (alias: $ALIAS)
[keystore] Сохраните его и пароли. Потеря = потеря права обновлять приложение!
[keystore] Переменные для сборки:
  export PIEGEDDON_KEYSTORE=$DEST
  export PIEGEDDON_KEYSTORE_PASSWORD=...
  export PIEGEDDON_KEY_ALIAS=$ALIAS
  export PIEGEDDON_KEY_PASSWORD=...
EOF
