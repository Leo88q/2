# ПИРОГЕДДОН / PIEGEDDON

**Многопользовательская вечериночная аркада** о картонных героях, которые бросаются пирогами —
с наградами в виде cNFT на Solana. Платформа: Solana dApp Store (Seeker) и Android (телефоны, ТВ).
Сессия — 2–5 минут. Вход бесплатный, кошелёк подключается только за наградой.

> Игровое ядро основано на `google/pienoon` (Apache 2.0). Атрибуция: `NOTICE`.
> Продукт не аффилирован с Google; бренд «Pie Noon» не используется.

## Статус: продакт деплой готов ✅

| Компонент | Состояние |
|---|---|
| Веб-игра (лендинг + ТВ-арена + пульт, multi-screen по WS) | ✅ играбельно |
| Backend (матчи, награды, рефералы, комнаты, cNFT-минт) | ✅ 25 тестов; реальный Bubblegum-минт + метаданные Metaplex |
| Android-оболочка (WebView + Mobile Wallet Adapter) | ✅ исходники + CI-сборка APK |
| Публикация dApp Store (config.yaml, keystore PKCS#12, CLI/CI workflow) | ✅ runbook: [docs/DEPLOY.md](docs/DEPLOY.md) |
| Создание дерева/коллекции cNFT | ✅ `backend/scripts/create_tree.mjs` |
| Privacy Policy / ToS (нужны для App NFT) | ✅ `/privacy.html`, `/terms.html` |
| Форк ядра Pie Noon (ребрендинг, лицензии) | ✅ код в `third_party/pienoon`; native bring-up — веха «Месяц 5+» |

## Быстрый старт

```bash
cd backend && npm install && npm test && npm start
# http://localhost:8080 — лендинг, /tv.html — арена, /play.html — пульт
```

## Структура

```
web/                  игра: лендинг, арена (ТВ), контроллер (телефон)
backend/              API + WebSocket-комнаты + движок наград + минт cNFT
android/              Android-оболочка (game.piegeddon.app) + MWA-мост
publish/              метаданные Solana dApp Store (config.yaml, media)
third_party/pienoon/  форк google/pienoon (Apache 2.0, ребрендинг)
scripts/              setup/keystore/publish/sync
docs/                 концепт, реализация, деплой, лицензии
```

## Документы

| Документ | О чём |
|---|---|
| [docs/concept.md](docs/concept.md) | Название, мир «Картония», история, фракции, NFT-коллекции |
| [docs/implementation.md](docs/implementation.md) | Архитектура, Solana-интеграция, роадмап |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Продакт деплой: backend, APK, dApp Store, минт |
| [docs/LICENSE-COMPLIANCE.md](docs/LICENSE-COMPLIANCE.md) | Apache 2.0, товарные знаки, атрибуция |
| [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md) | Сторонние компоненты и лицензии |

## Коротко о лоре

Картонный мир чуть не погиб в **Пирогеддоне** — последней битве за Золотой Пирог.
Фракции подписали Кондитерский Пакт: теперь споры решает телешоу «Пирогеддон»,
а победители забирают Ломтья Золотого Пирога. Игрок — новичок, только что вырезанный из картона.

## Credits

This product includes software developed by Google Inc. (Pie Noon,
https://github.com/google/pienoon), licensed under the Apache License, Version 2.0.
Not endorsed by or affiliated with Google.

## Лицензия

Apache License 2.0 — см. [LICENSE](LICENSE) и [NOTICE](NOTICE).
