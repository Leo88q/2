# Лицензионный комплаенс «Пирогеддон»

Чеклист, который закрывает требования Apache 2.0 и правила использования
товарных знаков. Перед каждым публичным релизом — прогонка всех пунктов.

## 1. Apache 2.0 (код google/pienoon и зависимости)

| Требование | Статус | Где |
|---|---|---|
| Копия лицензии при распространении | ✅ | `LICENSE`, `third_party/pienoon/LICENSE`, `third_party/pienoon/LICENSE.txt` |
| Уведомление об авторских правах Google | ✅ | `NOTICE`, экран «Об игре», `third_party/pienoon/README.md` |
| Сохранение заголовков копирайта в исходниках | ✅ | заголовки не изменялись |
| Указание внесённых изменений | ✅ | `third_party/pienoon/README.md` (раздел «Что изменено»), заметки в начале изменённых файлов |
| Атрибуция в документации продукта | ✅ | `README.md` → «Credits», `docs/DEPLOY.md` |

## 2. Товарные знаки Google — что запрещено и что сделано

| Правило | Реализация |
|---|---|
| Нельзя называть продукт «Pie Noon» | Продукт называется **Piegeddon / Пирогеддон** везде: имя пакета `game.piegeddon.*`, app_name, магазинные метаданные |
| Нельзя использовать бренд Google в продвижении | В маркетинге, стори и лендинге Google не упоминается; атрибуция только в разделе «Credits/Об игре» (разрешённое «reasonable use» для указания происхождения) |
| Нельзя использовать товарные знаки сторонних продуктов в промо | Кросс-промо Zooshi удалено (метод `LaunchZooshiSanta` → no-op); deep-link `google.github.io/pienoon` заменён на `link.piegeddon.game` |
| Google Play Games / Cardboard VR не поставляются | VR-intent удалён из манифеста; GPG-код остаётся в исходниках upstream как исторический, но не поставляется в продукт (WebView-оболочка его не собирает; native bring-up заменит GPG на backend Piegeddon) |

## 3. Ассеты и шрифты

- `rawassets/` и `assets/` google/pienoon **не включены в git** и **не поставляются**
  в релизных артефактах продукта (веб-игра и Android-оболочка используют
 оригинальный арт Piegeddon, см. `web/img/`, `web/js/game.js`).
- Перед включением upstream-ассетов в native-сборку обязателен аудит
  файлов `rawassets/` на предмет отдельных лицензий (шрифты/аудио/модели)
  — пункт в `docs/DEPLOY.md` («Native core bring-up», шаг 4).
- Веб-игра использует только системные шрифты; изображения сгенерированы
  для проекта и принадлежат Piegeddon Contributors.

## 4. Лицензия собственного кода

Весь новый код (`backend/`, `web/`, `android/`, `scripts/`) — Apache 2.0,
Copyright 2026 Piegeddon Contributors (текст в `LICENSE`). Файлы с
Apache-заголовком сохраняют его; новые файлы получают короткий заголовок:

```
// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
```

## 5. Публичные страницы, обязательные к релизу

- [x] `NOTICE` в корне репозитория и в APK (в `assets/` Android-оболочки копируется автоматически `scripts/sync_web_assets.sh`)
- [x] Экран «Об игре» с текстом: «Based on Pie Noon by Google, licensed under Apache 2.0. Not endorsed by Google.»
- [ ] `privacy_policy_url` и `license_url` в метаданных App NFT (шаблон: `publish/config.yaml`)
- [ ] Тексты Privacy Policy и ToS опубликованы (задача релиз-менеджера, `docs/DEPLOY.md`)
