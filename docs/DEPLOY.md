# Piegeddon — продакт деплой (runbook)

Пошагово: от репозитория до живой страницы в Solana dApp Store.
Всё, что требует человека (KYC, ключи, деньги), помечено 🧑‍💻.

---

## 0. Карта репозитория

| Путь | Что это | Статус |
|---|---|---|
| `web/` | Мобильная игра: меню, арена, награды | ✅ прод |
| `backend/` | API: матчи, награды, cNFT-минт, рефералы, комнаты WS | ✅ прод (mock-минт) |
| `android/` | Android-оболочка (WebView + Mobile Wallet Adapter) | ✅ готов к сборке в CI |
| `publish/` | Метаданные dApp Store (config.yaml, media) | ✅ |
| `third_party/pienoon/` | Форк ядра Pie Noon (Apache 2.0, ребрендинг) | ✅ код; ⏳ native bring-up |
| `scripts/` | setup/rebrand/keystore/publish/sync | ✅ |
| `.github/workflows/` | CI, publish, native core | ✅ |

---

## 1. Локальный запуск

```bash
cd backend && npm install && npm test && npm start
# http://localhost:8080  ->  игра (меню → арена → награды)
```

Тесты: `npm test` (24 теста: награды, анти-чит, рефералы, API, идемпотентность).

---

## 2. Продакшн backend

**Docker** (из корня репозитория):
```bash
docker build -f backend/Dockerfile -t piegeddon .
docker run -p 8080:8080 -v piegeddon-data:/data piegeddon
```

**Без Docker**: `WEB_ROOT=/srv/piegeddon/web PIEGEDDON_DATA=/var/lib/piegeddon node backend/dist/src/index.js`

Переменные: `backend/.env.example`. Обязательно:
- `PIEGEDDON_MINT_MODE=solana` + `BUBBLEGUM_TREE` + `NFT_COLLECTION` (см. §4);
- TLS-терминация (Caddy/nginx) перед портом 8080;
- бэкап `data/db.json` (до перехода на Postgres).

---

## 3. Android APK и dApp Store

### 3.1 Keystore (🧑‍💻, один раз)
```bash
./scripts/generate_keystore.sh ./piegeddon.keystore   # ОТДЕЛЬНЫЙ ключ, не Google Play!
```
Сохранить keystore + пароли. Потеря = потеря обновлений приложения.

### 3.2 Сборка
```bash
./scripts/sync_web_assets.sh          # web/ -> android assets + NOTICE/LICENSE
cd android && gradle assembleRelease
# app/build/outputs/apk/release/app-release.apk
```

### 3.3 Регистрация издателя (🧑‍💻)
1. https://publish.solanamobile.com → signup → **KYC/KYB**.
2. Кошелёк издателя (Phantom/Solflare) с **~0.2 SOL** (комиссии + ArDrive).
3. Portal: `Add a dApp` → метаданные из `publish/config.yaml`,
   иконка `publish/media/icon.png`, feature `publish/media/feature.png`.
4. Опубликовать Privacy Policy по URL из конфига (обязательно для App NFT).

### 3.4 Submit релиза
Вручную: Portal → `New Version` → загрузить APK → подписать транзакции.
Через CLI: `./scripts/publish.sh app-release.apk "release notes"`.
Через CI: запустить workflow **Publish dApp Store** (секреты: keystore,
publisher keypair, `DAPP_STORE_API_KEY`).

Ревью: 3–5 рабочих дней. Дальше — апдейты тем же workflow (новый Release NFT).

---

## 4. Включение реального минта cNFT

Код интеграции готов (Umi + mpl-bubblegum, проверен типами). Шаги:

1. 🧑‍💻 Создать payer-ключ (если нет): `solana-keygen new -o piegeddon-payer.json`
   и положить на него SOL (дерево ~$5-10, дальше — доли цента за минт).
2. Создать Merkle-дерево и коллекцию **одной командой**:
   ```bash
   cd backend
   PAYER_KEYPAIR_PATH=./piegeddon-payer.json \
   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com \
   METADATA_BASE_URL=https://api.piegeddon.game \
   node scripts/create_tree.mjs            # --depth 14 --buffer 64 --canopy 10
   ```
   Скрипт печатает готовые `BUBBLEGUM_TREE` и `NFT_COLLECTION`.
3. Заполнить `backend/.env`:
   ```
   PIEGEDDON_MINT_MODE=solana
   SOLANA_RPC_URL=https://<ваш RPC: Helius/Triton>   # публичный RPC не потянет нагрузку
   BUBBLEGUM_TREE=...
   NFT_COLLECTION=...
   PAYER_KEYPAIR_PATH=...
   METADATA_BASE_URL=https://api.piegeddon.game
   ```
4. Репетиция на devnet: `SOLANA_RPC_URL=https://api.devnet.solana.com`
   + devnet-версия `create_tree.mjs` (отдельный payer).

Метаданные cNFT раздаёт сам backend: `GET /api/metadata/:rewardId`
(URI подставляется в `uri` при минте) и `GET /api/metadata/collection`.

Правило экономики: **комиссию за минт платит проект**, игрок никогда не платит.

---

## 5. Native core bring-up (трек 2, «Месяц 5+»)

Форк `google/pienoon` лежит в `third_party/pienoon` (код + ребрендинг).
Риски и план:

1. **Тулчейн 2014-2016**: ant/ndk-build, старый NDK. План: CMake + NDK r26,
   Gradle-сборка `.so` через `externalNativeBuild`. Оценка: 2–3 недели.
2. **23 субмодуля**, часть зеркал мертва (git.sv.nongnu.org, xiph):
   `scripts/setup_game.sh --with-deps` попробует все; недостающие форкаем на GitHub.
3. **Замена Google Play Games** (`gpg_manager`, `gpg_multiplayer`): лидерборды
   и достижения уже есть в `backend` — переключаем на наш API
   (кнопки меню GPG скрыть, вызовы — заглушки).
4. **Ассеты**: `./scripts/setup_game.sh --with-assets` скачивает `rawassets/`;
   перед релизом — **аудит лицензий ассетов** (docs/LICENSE-COMPLIANCE.md, §3).
5. **Cardboard VR** не поставляем (intent уже вырезан в ребрендинге).

Проверка ребрендинга уже автоматизирована: workflow **Native core**.

---

## 6. Known bring-up items (быстро фиксятся при первом CI-прогоне)

| Что | Где | Почему |
|---|---|---|
| ~~Сигнатуры MWA~~ | ✅ сверены с исходниками `clientlib-ktx v2.2.0` | готово |
| ~~Gradle wrapper~~ | ✅ `android/gradlew` + wrapper jar в git | готово |
| ~~Privacy/ToS~~ | ✅ страницы `/privacy.html`, `/terms.html` | готово; нужен деплой на домен |
| Версия `mobile-wallet-adapter-clientlib-ktx` | `android/app/build.gradle.kts` | если Maven Central отдаёт другую — поправить одну строку при первом CI-прогоне |
| Postgres вместо JSON-файла | `backend/src/store.ts` | масштабирование после первых 1k игроков |
| Развёртывание на домене | `deploy/docker-compose.yml` | 🧑‍💻 нужен VPS + DNS `piegeddon.game` + TLS |

---

## 7. Чеклист перед публичным запуском

- [x] `npm test` зелёный (25 тестов)
- [x] Keystore создан (`scripts/generate_keystore.sh`, PKCS#12)
- [x] Privacy Policy и ToS как страницы (`/privacy.html`, `/terms.html`)
- [x] Bubblegum-дерево и коллекция создаются одной командой (`backend/scripts/create_tree.mjs`)
- [ ] APK подписан release-ключом, установлен на телефоне
- [ ] Матч → победа → claim → cNFT приходит на кошелёк (devnet, потом mainnet)
- [ ] Реферальная ссылка `/join/CODE` работает
- [ ] NOTICE/LICENSE внутри APK (scripts/sync_web_assets.sh копирует)
- [ ] Экран «Об игре» показывает атрибуцию Pie Noon / Google
- [ ] Privacy Policy опубликована
- [ ] KYC пройден, App NFT + Release NFT созданы
- [ ] Реклама/маркетинг без брендов Google (docs/LICENSE-COMPLIANCE.md)
