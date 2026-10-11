#!/usr/bin/env bash
# Публикация Piegeddon в Solana dApp Store через CLI.
# Предпосылки (см. docs/DEPLOY.md):
#   1. KYC/KYB пройден на https://publish.solanamobile.com
#   2. Publisher NFT создан (Portal или: dapp-store create publisher)
#   3. В кошельке издателя ~0.2 SOL
#   4. APK подписан release-ключом (scripts/generate_keystore.sh)
#   5. export DAPP_STORE_API_KEY=... (Portal -> Settings -> API keys)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEYPAIR="${DAPP_STORE_KEYPAIR:-$HOME/.config/solana/publisher.json}"
APK="${1:-}"
WHATS_NEW="${2:-Piegeddon season 1 release}"

if [ -z "$APK" ] || [ ! -f "$APK" ]; then
  echo "Использование: ./scripts/publish.sh <путь-к-apk> [release notes]" >&2
  exit 2
fi

echo "[publish] validate"
npx --yes @solana-mobile/dapp-store-cli validate -k "$KEYPAIR" -b "$(dirname "$APK")"

echo "[publish] submit release: $APK"
npx --yes @solana-mobile/dapp-store-cli publish submit \
  -k "$KEYPAIR" \
  --a "$APK" \
  --whats-new "$WHATS_NEW"

echo "[publish] Готово. Ревью 3-5 рабочих дней, статус приходит на email издателя."
