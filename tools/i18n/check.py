"""Показывает русские строки интерфейса, у которых ещё нет английского перевода.
Запуск из корня проекта:  python3 tools/i18n/check.py
Новые переводы добавляй в tools/i18n/tr3.py, потом:  python3 tools/i18n/build.py site/i18n.js"""
import json, os, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, here)
import tr1, tr2, tr3
T = {**tr1.T, **tr2.T, **tr3.T}
out = subprocess.run([sys.executable, os.path.join(here, 'extract.py'), 'site/index.html', 'logic.js', 'game.js', 'worker.js'], capture_output=True, text=True).stdout
d = json.loads(out)
miss = [k for k in d['keys'] if k not in T]
print('Без перевода:', len(miss))
for k in miss: print(' ', k)
