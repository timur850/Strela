"""Ставит в index.html метку версии у logic.js и i18n.js (по содержимому файла),
чтобы Telegram не держал старую копию. Запускать перед каждым коммитом:  python3 tools/bump.py"""
import hashlib, re
p = 'site/index.html'; s = open(p).read()
for f in ['logic.js', 'i18n.js']:
    h = hashlib.md5(open('site/' + f, 'rb').read()).hexdigest()[:8]
    s = re.sub(r'src="' + re.escape(f) + r'(\?v=[0-9a-f]+)?"', f'src="{f}?v={h}"', s)
open(p, 'w').write(s)
print('ok')
