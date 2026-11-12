STRELA CASE — автовыдача NFT-подарков (юзербот)
================================================

Что это: скрипт на твоём VPS входит в аккаунт-склад (как ещё одно устройство Telegram)
и сам передаёт коллекционные подарки игрокам, которые нажали «Вывести».
Если подарка нет на складе или что-то не так — заявка приходит тебе на ручную выдачу, как раньше.

1. API_ID и API_HASH
   Зайди на https://my.telegram.org с аккаунта-склада → API development tools → создай приложение.

2. Ключ
   Игра → админка → «🎁 Автовыдача NFT» → «🔑 Новый ключ» → скопируй UB_KEY и UB_SERVER.

3. На VPS (нужен Python 3.9+):
   mkdir ~/strela-ub && cd ~/strela-ub
   wget <адрес игры>/ub/strela_ub.py
   pip3 install https://github.com/LonamiWebs/Telethon/archive/refs/heads/v1.zip
   nano .env        ← вставь:
       API_ID=12345678
       API_HASH=abcdef...
       UB_KEY=...
       UB_SERVER=https://...
   python3 strela_ub.py login     ← телефон склада, код из Telegram, пароль 2FA
   python3 strela_ub.py           ← проверь, что пишет «Автовыдача запущена»

4. Чтобы работал всегда (systemd):
   sudo nano /etc/systemd/system/strela-ub.service
       [Unit]
       Description=STRELA autogift
       After=network-online.target
       [Service]
       WorkingDirectory=/root/strela-ub
       ExecStart=/usr/bin/python3 /root/strela-ub/strela_ub.py
       Restart=always
       RestartSec=10
       [Install]
       WantedBy=multi-user.target
   sudo systemctl daemon-reload && sudo systemctl enable --now strela-ub
   Логи: journalctl -u strela-ub -f

Важно
- Файл .env (SESSION) = полный доступ к аккаунту-складу. Не отправляй его никому и не клади в GitHub.
- Склад — отдельный аккаунт, не основной: за автоматизацию Telegram может ограничить аккаунт.
- На складе держи звёзды: передача NFT платная (обычно ~25 ★ за подарок).
- Игрок должен иметь @username или хоть раз написать складу — иначе Telegram не даст найти его по ID.
- Выставленные на продажу и недавно полученные подарки скрипт не трогает.
- Выключить: админка → «⏸ Выключить» (старый ключ перестанет работать) или systemctl stop strela-ub.
