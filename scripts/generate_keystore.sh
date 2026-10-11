#!/usr/bin/env bash
# Генерация keystore для подписи APK (dApp Store требует ОТДЕЛЬНЫЙ ключ,
# не связанный с Google Play). См. docs/DEPLOY.md.
#
# Использование: ./scripts/generate_keystore.sh [путь-к-keystore]
#
# Пробует keytool (JDK), при его отсутствии — openssl (PKCS#12).
# Оба варианта дают PKCS#12, который Android Gradle Plugin принимает
# с storeType=pkcs12 (настраивается PIEGEDDON_KEYSTORE_TYPE).
set -euo pipefail
DEST="${1:-./piegeddon.keystore}"
ALIAS="${PIEGEDDON_KEY_ALIAS:-piegeddon}"
STOREPASS="${PIEGEDDON_KEYSTORE_PASSWORD:-changeme}"
KEYPASS="${PIEGEDDON_KEY_PASSWORD:-$STOREPASS}"

if [ -f "$DEST" ]; then
  echo "Файл уже существует: $DEST" >&2
  exit 1
fi

if command -v keytool >/dev/null 2>&1; then
  keytool -genkeypair -v \
    -keystore "$DEST" \
    -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 \
    -validity 10000 \
    -storetype pkcs12 \
    -storepass "$STOREPASS" \
    -keypass "$KEYPASS" \
    -dname "CN=Piegeddon, O=Piegeddon Contributors, C=RU"
else
  echo "[keystore] keytool не найден — использую openssl (PKCS#12)"
  TMPKEY="$(mktemp -d)"
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$TMPKEY/key.pem" -out "$TMPKEY/cert.pem" -days 10000 \
    -subj "/CN=Piegeddon/O=Piegeddon Contributors/C=RU" >/dev/null 2>&1
  openssl pkcs12 -export \
    -inkey "$TMPKEY/key.pem" -in "$TMPKEY/cert.pem" \
    -name "$ALIAS" \
    -out "$DEST" \
    -passout "pass:$KEYPASS" >/dev/null 2>&1
  rm -rf "$TMPKEY"
fi

cat <<EOF

[keystore] Создан: $DEST (alias: $ALIAS, storeType: pkcs12)
[keystore] Сохраните его и пароли. Потеря = потеря права обновлять приложение!
[keystore] Переменные для сборки:
  export PIEGEDDON_KEYSTORE=$DEST
  export PIEGEDDON_KEYSTORE_TYPE=pkcs12
  export PIEGEDDON_KEYSTORE_PASSWORD=$STOREPASS
  export PIEGEDDON_KEY_ALIAS=$ALIAS
  export PIEGEDDON_KEY_PASSWORD=$KEYPASS
EOF
