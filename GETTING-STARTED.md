# Запуск Piegeddon на MacBook с нуля

Полная последовательность: клонирование → зависимости → локальный запуск.

## 0. Проверить, что есть git и Node.js

```bash
cd /Users/zlata/Desktop/PIEGEDDON

git --version
node --version
```

Нужен **Node.js 20+** (лучше 22) и git. Если чего-то нет:

```bash
# Установить Homebrew (если нет):
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Установить Node.js и git:
brew install node git
```

## 1. Клонировать репозиторий

```bash
cd /Users/zlata/Desktop/PIEGEDDON

git clone -b arena/04a6e8e8-2 https://github.com/Leo88q/2.git piegeddon

cd piegeddon
```

> Если репозиторий приватный — сначала `gh auth login` (или клонируй
> через GitHub Desktop / SSH-URL `git@github.com:Leo88q/2.git`).

## 2. Установить зависимости

```bash
cd backend
npm install
```

## 3. Запустить

```bash
npm start
```

Увидишь:

```
[piegeddon] static web root: .../web
[piegeddon] server on http://0.0.0.0:8080 (mint: mock, season: Сезон 1: Первый Ломоть)
```

## 4. Открыть игру

| Страница | URL |
|---|---|
| Главная (лендинг) | http://localhost:8080 |
| Арена (открой на ТВ/большом экране) | http://localhost:8080/tv.html |
| Пульт (на телефоне) | http://localhost:8080/play.html |

**Мультиплеер в одной Wi-Fi-сети:** на телефоне открой
`http://<IP-макбука>:8080/play.html` и введи код комнаты с экрана арены.
Узнать IP макбука: `ipconfig getifaddr en0`.

## 5. Тесты (по желанию)

```bash
npm test
```

## Остановить

В терминале с сервером: `Ctrl + C`.

---

### Android-оболочка (опционально)

Нужны JDK 17 и Android SDK (Android Studio):

```bash
./scripts/sync_web_assets.sh
cd android
./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```
