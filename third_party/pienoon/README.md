# third_party/pienoon — нативное ядро «Пирогеддон» (трек 2)

Здесь лежит **кодовая часть** форка [google/pienoon](https://github.com/google/pienoon)
(коммит `a721180de4d9de3696af3b3734d1ad269975b111`, Apache License 2.0),
приведённая к бренд-стандартам Piegeddon.

## Что входит в git

| Директория | Содержимое |
|---|---|
| `src/`, `jni/`, `src_java/` | C++/Java код игры |
| `cmake/`, `CMakeLists.txt`, `custom_rules.xml`, `project.properties` | система сборки |
| `res/`, `AndroidManifest.xml` | Android-ресурсы (переименованы, см. ниже) |
| `tests/`, `scripts/`, `external/`, `disttools/`, `pie_noon_ios/` | тесты и утилиты |
| `LICENSE`, `LICENSE.txt`, `README.upstream.md` | лицензии и документация upstream |

## Что НЕ входит в git (и как получить)

- `assets/`, `rawassets/` (~47 МБ бинарных ассетов) — восстанавливаются командой:
  ```bash
  ./scripts/setup_game.sh --with-assets
  ```
- `dependencies/` (23 субмодуля: fplbase, motive, flatbuffers, pindrop, SDL, …):
  ```bash
  ./scripts/setup_game.sh --with-deps
  ```

## Что изменено (ребрендинг, `scripts/rebrand_pienoon.sh`)

1. `package` → `game.piegeddon.native`; название приложения → **Piegeddon**.
2. Удалён intent-категория Google Cardboard VR (VR-режим не поставляется).
3. Удалено кросс-промо стороннего продукта (метод `LaunchZooshiSanta` → no-op).
4. Google-идентификаторы в `res/values/strings.xml` обнулены.

**Не изменено** (требование Apache 2.0): лицензионные заголовки, `LICENSE`,
`LICENSE.txt`, внутренние идентификаторы (`libpie_noon`, имена классов JNI).
Атрибуция Google показывается в «Об игре» — см. docs/LICENSE-COMPLIANCE.md.

## Статус

Native core bring-up (сборка на современном NDK, замена Google Play Games
на backend-лидерборды Piegeddon) — веха «Месяц 5+» роадмапа. Полная сборка
выполняется в CI: `.github/workflows/native-core.yml`.
Продукт-каналом сейчас является WebView-оболочка `android/` + веб-игра `web/`.
