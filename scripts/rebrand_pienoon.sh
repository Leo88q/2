#!/usr/bin/env bash
# Ребрендинг форка google/pienoon -> Piegeddon (см. docs/LICENSE-COMPLIANCE.md).
# Применяется к чистому чекауту google/pienoon. Идемпотентна.
#
# Правила: Apache 2.0 требует сохранить LICENSE/NOTICE и заголовки копирайта,
# поэтому мы НЕ трогаем лицензионные заголовки файлов, а меняем только
# пользовательские идентификаторы и удаляем кросс-промо чужих продуктов.
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"
echo "[rebrand] target: $(pwd)"

python3 - <<'PY'
import re, pathlib

root = pathlib.Path('.')

# --- 1. AndroidManifest.xml: package, VR-intent, deep links -----------------
mf = root / 'AndroidManifest.xml'
s = mf.read_text()
s = s.replace('package="com.google.fpl.pie_noon"', 'package="game.piegeddon.native"')
s = s.replace('                <category android:name="com.google.intent.category.CARDBOARD" />\n', '')
s = s.replace('android:host="google.github.io"', 'android:host="link.piegeddon.game"')
s = s.replace('android:pathPrefix="/pienoon/launch/default"',
              'android:pathPrefix="/native/launch/default"')
mf.write_text(s)
print('[rebrand] AndroidManifest.xml')

# --- 2. strings.xml: название и Google-идентификаторы ----------------------
sv = root / 'res/values/strings.xml'
s = sv.read_text()
s = s.replace('<string name="app_name">Pie Noon</string>',
              '<string name="app_name">Piegeddon</string>')
s = re.sub(r'<string name="app_id">[^<]*</string>',
           '<string name="app_id">0</string>', s)
s = re.sub(r'<string name="service_id">[^<]*</string>',
           '<string name="service_id">piegeddon1</string>', s)
sv.write_text(s)
print('[rebrand] res/values/strings.xml')

# --- 3. Java: пакет game.piegeddon.native, удаление кросс-промо Zooshi -----
for rel in ('src_java/com/google/fpl/pie_noon/PieNoonActivity.java',
            'src_java/com/google/fpl/pie_noon/PieNoonTvActivity.java'):
    p = root / rel
    s = p.read_text()
    s = s.replace('package com.google.fpl.pie_noon;', 'package game.piegeddon.native;')
    # Метод-кросс-промо другого продукта Google -> no-op (сохраняем сигнатуру,
    # JNI-вызовы не ломаются, но чужой продукт больше не рекламируется).
    s = re.sub(
        r'public void LaunchZooshiSanta\(\) \{.*?\n  \}\n',
        'public void LaunchZooshiSanta() {\n'
        '    // Removed in Piegeddon fork: cross-promotion of a third-party product\n'
        '    // is not allowed under our trademark policy (see LICENSE-COMPLIANCE.md).\n'
        '  }\n',
        s, flags=re.S)
    p.write_text(s)
    print('[rebrand]', rel)

new_dir = root / 'src_java/game/piegeddon/native'
new_dir.mkdir(parents=True, exist_ok=True)
for name in ('PieNoonActivity.java', 'PieNoonTvActivity.java'):
    src = root / 'src_java/com/google/fpl/pie_noon' / name
    if src.exists():
        src.rename(new_dir / name)
old = root / 'src_java/com/google/fpl'
import shutil
if old.exists():
    shutil.rmtree(old)
print('[rebrand] src_java -> game/piegeddon/native')
PY

echo "[rebrand] done"
