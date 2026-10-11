# «Пирогеддон» — техническая реализация

Документ дополняет [concept.md](./concept.md). Здесь: архитектура форка, Web3-слой,
экономика cNFT, публикация в dApp Store, лицензионный чеклист и роадмап.

---

## 1. Реальность базы: google/pienoon

Репозиторий [google/pienoon](https://github.com/google/pienoon) (Apache 2.0)
**архивирован 27 июля 2022** и доступен только для чтения [2](https://github.com/google/pienoon).
Это демо-проект Google FPL (FlatBuffers, Motive, MathFu, Pindrop, fplutil),
написанный в 2014–2016 на C++ под OpenGL ES и старый NDK.

Отсюда риски, которые надо заложить в план:
1. **Тулчейн**: оригинальные CMake/Gradle/NDK-скрипты рассчитаны на старые версии.
   Потребуется апгрейд до современного NDK/CMake/Gradle и актуального Android SDK.
   Это самая «тяжёлая» часть месяца 1 — сначала добиться зелёной сборки.
2. **Сервисы Google**: `gpg_manager` (Google Play Games) выкидываем сразу — он и не нужен,
   и требует ключей Google.
3. **VR-режим Cardboard**: для мобильных/ТВ-сценариев не нужен; предлагаю вырезать
   (SDK Cardboard — с отдельными условиями, а бренд «Cardboard» — товарный знак Google).
4. **Сетевой код**: оригинальный Multi-screen режим (ТВ + телефоны как контроллеры)
   уже есть — это наш главный вирусный механик, его сохраняем и развиваем.

**Что берём без изменений:** ядро матча (броски, блоки, зарядка пирога, «last man standing»),
Motive-анимацию, FlatBuffers-конфиги, Pindrop-звук, Multi-screen.

---

## 2. Стратегия интеграции Solana: три пути

| Путь | Описание | Плюсы | Минусы |
|---|---|---|---|
| **A. Нативный форк + Kotlin-модуль** ✅ | C++ ядро как есть; Web3 живёт в Kotlin-слое (MWA), вызывается через JNI | сохраняем готовую игру и Multi-screen; нативная производительность на Android TV | Web3-код придётся писать руками (Kotlin + небольшой backend) |
| B. Unity-ремейк | переписать на Unity + Solana.Unity-SDK | удобный контент-пайплайн, готовые SDK | фактически новая игра 6+ месяцев, теряем Multi-screen «из коробки» |
| C. Гибрид | C++ ядро в Unity-плагине | — | самая худшая связка по стоимости |

**Рекомендация — путь A.** Он соответствует принципу «не переписываем с нуля» и даёт MVP за 2–3 месяца.

### Архитектура (путь A)

```
/app (Android, Kotlin + JNI)
  ├── game-core/        # форк pienoon: C++ (матч, рендер, звук, Multi-screen)
  ├── web3/             # Kotlin-модуль: Mobile Wallet Adapter, сессии, deep links
  └── bridge/           # JNI-мост: события матча → web3/backend

/backend (Node.js/TypeScript)
  ├── match-api         # приём отчётов о матчах (анти-чит: server-authoritative)
  ├── reward-engine     # очередь наград: победы, серии, квесты, рефералы
  ├── mint-service      # Metaplex Umi + Bubblegum: минт cNFT в Merkle-дерево
  └── claim-api         # выдача награды после подключения кошелька

/docs                   # этот репозиторий
```

---

## 3. Web3-слой: как именно

### Кошелёк — Mobile Wallet Adapter (MWA)
- Подключение Phantom / Solflare / Backpack прямо из игры (нативный Android-флоу).
- **Гостевой режим по умолчанию**: жмём «Играть» — играем. Кошелёк не нужен.
- MWA понадобится только в момент, когда игрок захочет **забрать NFT**.

### Free-to-play → конверсия (воронка)

```
Матч (гость) → Победа → баннер «Забери свой первый бесплатный NFT-скин!»
   → MWA: подключить/создать кошелёк
   → backend минтит cNFT (комиссию платим МЫ, не игрок)
   → кнопка «Поделиться победой» → ссылка с гостевым скином
```

### cNFT через Bubblegum (Metaplex)
- Одно Merkle-дерево на коллекцию: 1 000 000 cNFT ≈ <$200 за создание дерева,
  минт — доли цента (стептены: $0.000005–$0.0006 за штуку).
- **Минт от нашего бэкенда** — игрок никогда не платит комиссий и не видит seed-фраз.
  Это же снимает проблему «нет SOL на газ».
- Метаданные: имя вида `Piegeddon · Ломоть славы #0001`, атрибуты фракции/сезона/редкости.

### Реферальные ссылки
- `https://link.piegeddon.game/join/<code>` → установка → при первом входе гостевой
  скин «Зрительский Пирог» обоим. Коды одноразовые, серверные (анти-накрутка).

### Минимальный анти-чит (MVP)
- Игра шлёт signed-отчёт о матче (score, хиты, длительность);
- backend валидирует эвристики (скорость попаданий, дубли матчей) и сам формирует очередь наград.

---

## 4. Публикация в Solana dApp Store

Подтверждённый флоу (Portal + CLI) [1](https://learn.blueshift.gg/en/courses/dapp-store-publishing/solana-dapp-store) [3](https://docs.solanamobile.com/solana-mobile-stack/dapp-store):

1. **APK, не AAB**. Отдельный keystore (ключ Google Play использовать нельзя):
   ```bash
   keytool -genkey -v -keystore dappstore.keystore -alias dappstore \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Регистрация на [publish.solanamobile.com](https://publish.solanamobile.com), **KYC/KYB**.
3. Кошелёк издателя с **~0.2 SOL** (комиссии + хранилище ArDrive/Turbo).
4. Иерархия NFT: **Publisher NFT → App NFT → Release NFT** (каждая версия = новый Release NFT).
5. Portal: `Add a dApp` → метаданные, иконка, скриншоты → `New Version` → APK → подпись транзакций.
6. Ревью ~3–5 рабочих дней; апдейты — через Portal или CLI `@solana-mobile/dapp-store-cli`.
7. Seeker (Gen 2) имеет dApp Store v2 из коробки — это основной канал трафика;
   обычный Android — sideload/APK-сайт.

> Важно для App NFT: нужен `privacy_policy_url` и `license_url` — готовим заранее.

---

## 5. Лицензирование и юридический чеклист

Apache 2.0 разрешает коммерческое использование и модификацию, но обязывает:

- [ ] Сохранить `LICENSE` и заголовки авторских прав Google в файлах.
- [ ] Добавить `NOTICE` с текстом вида:
      ```
      This product includes software developed by Google Inc. (Pie Noon, https://github.com/google/pienoon),
      licensed under the Apache License, Version 2.0.
      ```
- [ ] Переименовать пакет (напр. `com.google.fpl.pie_noon` → `game.piegeddon.app`),
      все строки, иконки, ссылки на `google.github.io/pienoon`.
- [ ] **Не использовать** «Google», «Pie Noon», «FPL», «Nexus Player», «Cardboard» в маркетинге.
- [ ] Проверить отдельные лицензии ассетов в `assets/` и `rawassets/` (шрифты/аудио
      могут отличаться от Apache — аудит перед релизом).
- [ ] Удалить `gpg_manager` (Google Play Games) и VR-модуль Cardboard.
- [ ] Privacy Policy и ToS — как для любого Android-приложения (плюс раскрытие NFT-механик).

---

## 6. Риски и как их снимать

| Риск | Снятие |
|---|---|
| Старый тулчейн pienoon не собирается | заложить 2–3 недели на апгрейд; запасной план — частичная замена рендера |
| Имя занято юридически | финальная проверка по TM-базам USPTO/EUIPO/Rospatent и dApp Store перед брендированием |
| Накрутка наград | серверная валидация матчей, лимиты на аккаунт/девайс |
| «Крипто-страх» игроков | никаких транзакций до момента забрать награду; гостевой режим — дефолт |
| Ревью dApp Store (3–5 дней) | подавать за 2 недели до маркетингового старта |

---

## 7. Дорожная карта (уточнённая)

| Срок | Веха | Критерий готовности |
|---|---|---|
| **Месяц 1** | Форк, ребрендинг, зелёная сборка APK на современном NDK | игра запускается на Android 10+ и Android TV |
| **Месяц 2** | Web3-модуль (MWA) + backend (mint/claim), cNFT-коллекции | победа → подключение кошелька → получен cNFT |
| **Месяц 3** | Контент сезона 1, квесты, реферальные ссылки; регистрация издателя, публикация | APK live в dApp Store |
| **Месяц 4** | Сезон 1 «Первый Ломоть», вирусная кампания (X, Discord), турнир | первые 1 000 матчей, доля claim > 10% |
| **Месяц 5+** | Дуэли 1v1 «на скорость», фан-клубы, турниры с призовым фондом из доходов | PvP-режим в проде |

---

## 8. Источники

- [1](https://learn.blueshift.gg/en/courses/dapp-store-publishing/solana-dapp-store) — Publishing to Solana dApp Store (Publisher → App → Release NFT, Portal/CLI)
- [2](https://github.com/google/pienoon) — google/pienoon (архивирован 27.07.2022, Apache-2.0)
- [3](https://docs.solanamobile.com/solana-mobile-stack/dapp-store) — Solana Mobile Docs: dApp Store (APK, Publisher NFT)
- [4](https://hackmd.io/@manbankat/HJGk-mT2-x) — Build & Publish Your First Solana Mobile dApp (keystore, ~0.2 SOL, KYC)
- [5](https://deepwiki.com/solana-mobile/dapp-publishing) — solana-mobile/dapp-publishing (CLI `@solana-mobile/dapp-store-cli`)

---

## 9. Статус реализации (обновлено)

Реализовано и проверено:

- **Веб-игра** (`web/`): лендинг с лором, ТВ-арена (canvas-движок: броски, зарядка,
  блок, ИИ, раунды, эффекты), пульт-контроллер, multi-screen через WebSocket-комнаты.
- **Backend** (`backend/`): движок наград (первая победа, серии, «Заказ Пекарни»,
  «Ломоть недели»), анти-чит и идемпотентность матчей, реферальные коды,
  mock/solana минт cNFT (Bubblegum), лидерборд сезона — 24 автотеста.
- **Android-оболочка** (`android/`): WebView + MWA-мост `window.PiegeddonWallet`.
- **Публикация**: `publish/config.yaml`, keystore/publish-скрипты, CI-workflows.
- **Лицензии**: `LICENSE`, `NOTICE`, ребрендинг форка, `docs/LICENSE-COMPLIANCE.md`.

Продакт-ранбук: [DEPLOY.md](./DEPLOY.md).
