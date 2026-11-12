#!/usr/bin/env bash
# STRELA CASE — установка автовыдачи NFT (юзербот) одной командой.
# Запуск на VPS:  bash <(curl -sL https://<адрес игры>/ub/install.sh)
set -e
SERVER="${UB_SERVER:-https://strela.timalukyang.workers.dev}"
DIR="$HOME/strela-ub"
echo "=== Автовыдача NFT для STRELA CASE ==="
mkdir -p "$DIR" && cd "$DIR"

echo "→ Ставлю Python и нужные пакеты (может занять минуту)…"
if command -v apt-get >/dev/null 2>&1; then (sudo apt-get update -qq && sudo apt-get install -y -qq python3 python3-pip curl) >/dev/null 2>&1 || true; fi
python3 -m pip install -q --break-system-packages https://github.com/LonamiWebs/Telethon/archive/refs/heads/v1.zip 2>/dev/null \
  || python3 -m pip install -q https://github.com/LonamiWebs/Telethon/archive/refs/heads/v1.zip
python3 -m pip install -q --break-system-packages qrcode 2>/dev/null || python3 -m pip install -q qrcode 2>/dev/null || true
curl -sL "$SERVER/ub/strela_ub.py" -o strela_ub.py

if [ ! -f .env ] || ! grep -q '^UB_KEY=' .env; then
  echo
  read -rp "API_ID (с my.telegram.org): " API_ID
  read -rp "API_HASH: " API_HASH
  read -rp "Ключ из админки игры (🔑 Новый ключ): " UB_KEY
  printf 'API_ID=%s\nAPI_HASH=%s\nUB_KEY=%s\nUB_SERVER=%s\n' "$API_ID" "$API_HASH" "$UB_KEY" "$SERVER" > .env
  chmod 600 .env
fi

if ! grep -q '^SESSION=' .env; then
  echo
  echo "→ Вход в аккаунт-склад по QR-коду: Telegram на телефоне (аккаунт-склад) → Настройки → Устройства → Подключить устройство → наведи камеру на QR ниже."
  python3 strela_ub.py login qr
fi

echo "→ Включаю автозапуск…"
if command -v systemctl >/dev/null 2>&1; then
  sudo tee /etc/systemd/system/strela-ub.service >/dev/null <<EOF
[Unit]
Description=STRELA autogift
After=network-online.target
[Service]
WorkingDirectory=$DIR
ExecStart=$(command -v python3) $DIR/strela_ub.py
Restart=always
RestartSec=10
[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload && sudo systemctl enable --now strela-ub && sudo systemctl restart strela-ub
  sleep 3; sudo systemctl --no-pager --lines=5 status strela-ub || true
  echo
  echo "✅ Готово. Автовыдача работает в фоне. Логи: journalctl -u strela-ub -f"
else
  nohup python3 strela_ub.py > ub.log 2>&1 &
  echo "✅ Готово. Автовыдача запущена в фоне. Логи: tail -f $DIR/ub.log"
fi
echo "В админке игры статус должен стать «🟢 Скрипт на связи» в течение минуты."
