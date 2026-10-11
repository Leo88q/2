# Сторонние компоненты

## Ядро third_party/pienoon (форк google/pienoon)

| Компонент | Лицензия | Примечание |
|---|---|---|
| Pie Noon (Google FPL) | Apache 2.0 | атрибуция в `NOTICE` |
| FlatBuffers (google/flatbuffers) | Apache 2.0 | субмодуль |
| MathFu (google/mathfu) | Apache 2.0 | субмодуль |
| Motive (google/motive) | Apache 2.0 | субмодуль |
| Pindrop (google/pindrop) | Apache 2.0 | субмодуль |
| fplbase / fplutil / flatui / breadboard / corgi (Google FPL) | Apache 2.0 | субмодули |
| SDL / SDL_mixer | Zlib | субмодули |
| libwebp | BSD-3-Clause | субмодуль |
| libogg / libvorbis | BSD-3-Clause | субмодули |
| FreeType | FTL / GPL-2.0 (двойная) | используется FTL-вариант |
| Harfbuzz | MIT | субмодуль |
| Bullet Physics | Zlib | субмодуль |
| libunibreak | зlib | субмодуль |
| googletest | BSD-3-Clause | только для тестов |
| cardboard-java | Apache 2.0 | **не поставляется** (VR вырезан) |
| Google Play Games C++ SDK | проприетарный SDK Google | **не поставляется**; код-заглушки не собираются в продукт |

Полные тексты лицензий — в каталогах субмодулей после `./scripts/setup_game.sh --with-deps`.

## Инфраструктура Piegeddon

| Компонент | Лицензия | Где |
|---|---|---|
| Node.js | MIT | рантайм backend |
| express, ws, zod (npm) | MIT | `backend/package.json` |
| @metaplex-foundation/umi, mpl-bubblegum | Apache 2.0 | минт cNFT (`backend/src/mint.ts`) |
| @solana/web3.js | Apache 2.0 | Solana |
| com.solana:mobile-wallet-adapter | Apache 2.0 | Android MWA (`android/`) |
| Android SDK / Gradle / AGP | Apache 2.0 | сборка APK |

Полный список npm-зависимостей с лицензиями: `npm ls --all` в `backend/`.
