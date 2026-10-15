#!/bin/bash
# STRELA CASE — установка бота на VPS одной командой:
#   curl -fsSL https://raw.githubusercontent.com/timur850/Strela/main/bot/install.sh | sudo bash -s -- ТОКЕН_БОТА
set -e
TOKEN="$1"
DIR=/opt/strela
RAW=https://raw.githubusercontent.com/timur850/Strela/main
[ "$(id -u)" = 0 ] || { echo "Запусти через sudo"; exit 1; }
mkdir -p "$DIR/web"
if [ -n "$TOKEN" ]; then echo -n "$TOKEN" > "$DIR/token.txt"; chmod 600 "$DIR/token.txt"; fi
[ -s "$DIR/token.txt" ] || { echo "Укажи токен бота: ... | sudo bash -s -- ТОКЕН"; exit 1; }
echo "== Ставлю нужные программы"
if ! command -v python3 >/dev/null || ! command -v ssh >/dev/null; then
  (apt-get update -y && apt-get install -y python3 curl openssh-client) >/dev/null 2>&1 || yum install -y python3 curl openssh-clients >/dev/null 2>&1 || true
fi
echo "== Скачиваю бота и игру"
curl -fsSL "$RAW/bot/bot.py" -o "$DIR/bot.py"
curl -fsSL "$RAW/index.html" -o "$DIR/web/index.html"
sed -i 's#<!-- В боте добавь: <script src="https://telegram.org/js/telegram-web-app.js"></script> -->#<script src="https://telegram.org/js/telegram-web-app.js"></script>#' "$DIR/web/index.html"
if [ ! -x "$DIR/cloudflared" ]; then
  A=amd64; [ "$(uname -m)" = "aarch64" ] && A=arm64
  curl -fsSL -o "$DIR/cloudflared" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$A" && chmod +x "$DIR/cloudflared" || echo "cloudflared не скачался — будет запасной способ"
fi
cat > /etc/systemd/system/strela.service <<UNIT
[Unit]
Description=STRELA CASE bot + mini app
After=network-online.target
Wants=network-online.target
[Service]
WorkingDirectory=$DIR
ExecStart=/usr/bin/python3 -u $DIR/bot.py
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable strela >/dev/null 2>&1
systemctl restart strela
echo "== Запускаю, подожди ~30 сек"
sleep 30
journalctl -u strela -n 12 --no-pager -o cat
echo
echo "ГОТОВО. Бот работает 24/7 без ПК и сам стартует после перезагрузки сервера."
echo "Логи: journalctl -u strela -f   Перезапуск: systemctl restart strela   Обновить: запусти эту же команду ещё раз"
