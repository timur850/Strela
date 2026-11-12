#!/usr/bin/env python3
"""
STRELA CASE — автовыдача NFT-подарков (юзербот).

Скрипт входит в аккаунт-склад как ещё одно устройство Telegram и сам передаёт
коллекционные подарки игрокам, которые нажали «Вывести» в игре.

Запуск:
  1) pip install https://github.com/LonamiWebs/Telethon/archive/refs/heads/v1.zip
  2) python3 strela_ub.py login      ← один раз: вход в аккаунт-склад, сохранит SESSION в .env
  3) python3 strela_ub.py            ← работает постоянно (лучше через systemd / screen / pm2)

Файл .env рядом со скриптом:
  API_ID=...          ← с my.telegram.org → API development tools
  API_HASH=...
  UB_KEY=...          ← из админки игры: «🎁 Автовыдача NFT» → «Новый ключ»
  UB_SERVER=https://...workers.dev
  SESSION=...         ← появится сам после «login». Это полный доступ к аккаунту — никому не отдавай!
"""
import asyncio, json, os, re, sys, time, urllib.request

from telethon import TelegramClient, errors
from telethon.sessions import StringSession
from telethon.tl import functions, types

HERE = os.path.dirname(os.path.abspath(__file__))
ENV = os.path.join(HERE, ".env")
POLL = 30          # как часто спрашивать сервер о новых выводах, сек
PAUSE = 8          # пауза между передачами, сек (чтобы Telegram не счёл спамом)


def load_env():
    cfg = {}
    if os.path.exists(ENV):
        for line in open(ENV, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip()
    cfg.update({k: v for k, v in os.environ.items() if k in ("API_ID", "API_HASH", "UB_KEY", "UB_SERVER", "SESSION")})
    return cfg


def save_env(key, value):
    lines = open(ENV, encoding="utf-8").read().splitlines() if os.path.exists(ENV) else []
    lines = [l for l in lines if not l.startswith(key + "=")] + [f"{key}={value}"]
    with open(ENV, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    try:
        os.chmod(ENV, 0o600)
    except Exception:
        pass


def post(cfg, path, data):
    req = urllib.request.Request(cfg["UB_SERVER"].rstrip("/") + path, data=json.dumps({"key": cfg["UB_KEY"], **data}).encode(),
                                 headers={"Content-Type": "application/json", "User-Agent": "strela-ub/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


norm = lambda s: re.sub(r"[^a-z0-9]", "", (s or "").lower())


def model_of(gift):
    for a in getattr(gift, "attributes", []) or []:
        if isinstance(a, types.StarGiftAttributeModel):
            return a.name
    return ""


async def my_unique_gifts(client):
    """Все коллекционные (NFT) подарки на аккаунте-складе."""
    out, offset = [], ""
    for _ in range(20):
        r = await client(functions.payments.GetSavedStarGiftsRequest(peer=types.InputPeerSelf(), offset=offset, limit=100, exclude_unlimited=True))
        for g in r.gifts:
            if isinstance(g.gift, types.StarGiftUnique) and g.msg_id:
                out.append(g)
        offset = r.next_offset
        if not offset:
            break
    return out


async def find_peer(client, w):
    if w.get("un"):
        try:
            return await client.get_input_entity(w["un"])
        except Exception:
            pass
    try:
        return await client.get_input_entity(int(w["uid"]))   # сработает, если игрок уже писал складу
    except Exception:
        return None


async def give(client, w):
    """Передать игроку подарок нужной коллекции (и модели, если указана). Возвращает (ok, текст)."""
    peer = await find_peer(client, w)
    if not peer:
        return False, "не найден игрок — нет @username, и он не писал аккаунту-складу"
    now = int(time.time())
    want, want_model = norm(w.get("title") or w.get("gname")), norm(w.get("model"))
    cand = []
    for g in await my_unique_gifts(client):
        if norm(g.gift.title) != want:
            continue
        if want_model and norm(model_of(g.gift)) != want_model:
            continue
        if g.can_transfer_at and g.can_transfer_at > now:     # ещё нельзя передавать (недавно получен)
            continue
        if getattr(g.gift, "resell_amount", None):            # выставлен на продажу — не трогаем
            continue
        cand.append(g)
    if not cand:
        return False, "такого подарка нет на складе (или все выставлены на продажу / недавно получены)"
    cand.sort(key=lambda g: g.transfer_stars or 0)
    g = cand[0]
    gift_ref = types.InputSavedStarGiftUser(msg_id=g.msg_id)
    try:
        if g.transfer_stars:   # передача платная — оплачиваем звёздами со склада
            inv = types.InputInvoiceStarGiftTransfer(stargift=gift_ref, to_id=peer)
            form = await client(functions.payments.GetPaymentFormRequest(invoice=inv))
            await client(functions.payments.SendStarsFormRequest(form_id=form.form_id, invoice=inv))
        else:
            await client(functions.payments.TransferStarGiftRequest(stargift=gift_ref, to_id=peer))
        return True, f"{g.gift.title} #{g.gift.num}"
    except errors.FloodWaitError as e:
        await asyncio.sleep(e.seconds + 5)
        return False, f"Telegram попросил подождать {e.seconds} с"
    except errors.RPCError as e:
        hint = {"BALANCE_TOO_LOW": "не хватает звёзд на складе для оплаты передачи"}.get(e.message, "")
        return False, e.message + (f" — {hint}" if hint else "")


async def login(cfg, qr=False):
    client = TelegramClient(StringSession(), int(cfg["API_ID"]), cfg["API_HASH"])
    if qr:   # вход по QR-коду: Telegram на телефоне → Настройки → Устройства → Подключить устройство
        await client.connect()
        q = await client.qr_login()
        while True:
            try:
                import qrcode
                c = qrcode.QRCode(border=1); c.add_data(q.url); c.make(); c.print_ascii(invert=True)
            except ImportError:
                print("QR-ссылка (открой как QR в любом генераторе):", q.url)
            print("Отсканируй QR в Telegram аккаунта-склада: Настройки → Устройства → Подключить устройство.")
            print("Нечем сканировать (консоль на том же телефоне)? Скопируй ссылку ниже, вставь в адресную строку Safari/Chrome и открой — Telegram спросит «Подтвердить вход?»:")
            print("\n    " + q.url + "\n")
            print("Ссылка и QR живут ~30 сек, потом появятся новые.")
            try:
                await q.wait(timeout=30)
                break
            except asyncio.TimeoutError:
                await q.recreate()
            except errors.SessionPasswordNeededError:
                await client.sign_in(password=input("Пароль двухэтапной проверки: "))
                break
    else:
        await client.start()   # спросит телефон, код и пароль 2FA
    me = await client.get_me()
    save_env("SESSION", client.session.save())
    print(f"Готово: вошли как @{me.username or me.id}. SESSION сохранён в .env — никому его не отдавай.")
    await client.disconnect()


async def main():
    cfg = load_env()
    for k in ("API_ID", "API_HASH", "UB_KEY", "UB_SERVER"):
        if not cfg.get(k):
            sys.exit(f"Нет {k} в .env — смотри инструкцию в начале файла")
    if len(sys.argv) > 1 and sys.argv[1] == "login":
        return await login(cfg, qr=len(sys.argv) > 2 and sys.argv[2] == "qr")
    if not cfg.get("SESSION"):
        sys.exit("Сначала: python3 strela_ub.py login")
    client = TelegramClient(StringSession(cfg["SESSION"]), int(cfg["API_ID"]), cfg["API_HASH"])
    await client.connect()
    if not await client.is_user_authorized():
        sys.exit("Сессия недействительна — запусти login заново")
    me = await client.get_me()
    print(f"Автовыдача запущена: склад @{me.username or me.id}")
    while True:
        try:
            q = post(cfg, "/api/ub/take", {})
            if not q.get("ok"):
                print("Сервер:", q.get("err"))
            for w in q.get("list", []):
                ok, info = await give(client, w)
                print(time.strftime("%H:%M:%S"), "✅" if ok else "⚠️", w.get("gname"), "→", w.get("un") or w.get("uid"), "|", info)
                post(cfg, "/api/ub/result", {"id": w["id"], "ok": ok, "err": "" if ok else info})
                await asyncio.sleep(PAUSE)
        except Exception as e:
            print("Ошибка:", e)
        await asyncio.sleep(POLL)


if __name__ == "__main__":
    asyncio.run(main())
