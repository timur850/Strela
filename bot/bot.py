# -*- coding: utf-8 -*-
"""
STRELA CASE — бот + мини-апп. Запуск: двойной клик по START.bat
Нужен только Python 3.8+ (без pip-пакетов).
Что делает:
  1) поднимает сайт из папки web/ на http://localhost:PORT
  2) скачивает cloudflared.exe (один раз) и получает бесплатную HTTPS-ссылку *.trycloudflare.com
  3) ставит в боте кнопку меню «Играть» с этой ссылкой и отвечает на /start
Пока окно открыто — бот работает. Закрыл окно — бот выключен.
"""
import json, os, re, hmac, hashlib, subprocess, sys, threading, time, urllib.request, urllib.parse, platform
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial

# ================= НАСТРОЙКИ =================
_HERE = os.path.dirname(os.path.abspath(__file__))


def _token():
    t = os.environ.get("STRELA_TOKEN", "").strip()
    if not t and os.path.exists(os.path.join(_HERE, "token.txt")):
        t = open(os.path.join(_HERE, "token.txt"), encoding="utf-8").read().strip()
    return t


TOKEN = _token()  # токен бота: файл token.txt рядом с bot.py (или переменная STRELA_TOKEN)
PORT = 8080
# Постоянная ссылка на игру (GitHub Pages). Если пусто — бот сам делает временную через Cloudflare/localhost.run
FIXED_URL = os.environ.get("STRELA_FIXED_URL", "")
# Запасная ссылка, если временную получить не удалось
FALLBACK_URL = "https://timur850.github.io/Strela/"
BUTTON_TEXT = "🏝 Играть"
WELCOME = ("🏹 <b>STRELA CASE</b>\n\n"
           "Кейсы, краш, мины, plinko, PvP и подарки с Fragment 🎁\n"
           "Жми кнопку ниже, чтобы открыть игру 👇")
SUPPORT = "@Sdelka_ton"
OWNERS = ["PODONOK_UC_1"]  # владельцы админки (username без @)
OWNER = ", @".join(OWNERS)


def is_owner_name(u):
    return (u or "").lower() in [o.lower() for o in OWNERS]
# ============================================

BASE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(BASE, "web")
API = f"https://api.telegram.org/bot{TOKEN}/"
WEBAPP_URL = None
PROC = None
SETTINGS_FILE = os.path.join(BASE, "settings.json")
_lock = threading.Lock()


def log(*a):
    print(time.strftime("[%H:%M:%S]"), *a, flush=True)


def tg(method, **params):
    data = json.dumps(params).encode()
    req = urllib.request.Request(API + method, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=70) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode() or "{}")


# ---------- 1. локальный сайт ----------
def check_init_data(init_data):
    """Проверка подписи Telegram WebApp initData. Возвращает user dict или None."""
    try:
        pairs = dict(urllib.parse.parse_qsl(init_data, keep_blank_values=True))
        got = pairs.pop("hash", "")
        dcs = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
        secret = hmac.new(b"WebAppData", TOKEN.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(hmac.new(secret, dcs.encode(), hashlib.sha256).hexdigest(), got):
            return None
        return json.loads(pairs.get("user", "{}"))
    except Exception:
        return None


def load_settings():
    try:
        with open(SETTINGS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/settings":
            return self._json(200, load_settings())
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] != "/api/settings":
            return self._json(404, {"ok": False})
        try:
            n = int(self.headers.get("Content-Length", 0))
            if n > 2_000_000:
                return self._json(413, {"ok": False})
            data = json.loads(self.rfile.read(n).decode())
        except Exception:
            return self._json(400, {"ok": False})
        user = check_init_data(data.get("initData", ""))
        if not user:
            return self._json(403, {"ok": False, "err": "bad initData"})
        cur = load_settings()
        admins = [str(x) for x in cur.get("admins", [])]
        if not is_owner_name(user.get("username")) and str(user.get("id")) not in admins:
            return self._json(403, {"ok": False, "err": "not admin"})
        new = data.get("settings") or {}
        if not is_owner_name(user.get("username")):
            new["admins"] = cur.get("admins", [])  # выдавать доступ может только владелец
        with _lock:
            tmp = SETTINGS_FILE + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(new, f, ensure_ascii=False)
            os.replace(tmp, SETTINGS_FILE)
        log(f"Настройки сохранены (@{user.get('username')})")
        return self._json(200, {"ok": True})

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def run_web():
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), partial(Handler, directory=WEB))
    log(f"Сайт запущен: http://localhost:{PORT}")
    srv.serve_forever()


# ---------- 2. HTTPS-туннель cloudflared ----------
def cloudflared_path():
    win = platform.system() == "Windows"
    name = "cloudflared.exe" if win else "cloudflared"
    path = os.path.join(BASE, name)
    if os.path.exists(path) and os.path.getsize(path) > 1_000_000:
        return path
    if win:
        url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    elif platform.system() == "Darwin":
        sys.exit("На macOS установи cloudflared: brew install cloudflared, и положи его рядом с bot.py")
    else:
        arch = "arm64" if platform.machine() in ("aarch64", "arm64") else "amd64"
        url = f"https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-{arch}"
    log("Скачиваю cloudflared (один раз, ~50 МБ)...")
    urllib.request.urlretrieve(url, path)
    if not win:
        os.chmod(path, 0o755)
    log("cloudflared скачан")
    return path


URL_RE = re.compile(r"https://(?!api\.)[a-z0-9]+(?:-[a-z0-9]+)+\.trycloudflare\.com")
LHR_RE = re.compile(r"https://[a-z0-9-]+\.(?:lhr\.life|localhost\.run)")


def url_ok(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "strela-check"}), timeout=15) as r:
            return r.status == 200 and b"STRELA" in r.read(4000)
    except Exception:
        return False


def _read_url(p, regex, timeout, tag):
    """Читает вывод процесса, пока не встретит ссылку. Возвращает ссылку или None."""
    found, tail = [None], []

    def reader():
        for line in p.stdout:
            line = line.strip()
            if not line:
                continue
            tail.append(line)
            del tail[:-6]
            m = regex.search(line)
            if m and not found[0]:
                found[0] = m.group(0)
    threading.Thread(target=reader, daemon=True).start()
    end = time.time() + timeout
    while time.time() < end and not found[0] and p.poll() is None:
        time.sleep(0.5)
    if not found[0]:
        log(f"[{tag}] ссылку не выдал. Последний ответ:")
        for t in tail[-4:]:
            log("   ", t[:160])
    return found[0]


def tunnel_cloudflare():
    exe = cloudflared_path()
    p = subprocess.Popen([exe, "tunnel", "--url", f"http://127.0.0.1:{PORT}", "--no-autoupdate", "--protocol", "http2"],
                         stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="ignore")
    url = _read_url(p, URL_RE, 40, "Cloudflare")
    if not url:
        p.kill()
    return url, p


def tunnel_localhost_run():
    ssh = "ssh"
    p = subprocess.Popen([ssh, "-T", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=" + os.devnull,
                          "-o", "ServerAliveInterval=30", "-o", "ExitOnForwardFailure=yes",
                          "-R", f"80:127.0.0.1:{PORT}", "nokey@localhost.run"],
                         stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                         text=True, encoding="utf-8", errors="ignore")
    url = _read_url(p, LHR_RE, 40, "localhost.run")
    if not url:
        p.kill()
    return url, p


def start_tunnel():
    """Пробует Cloudflare, если не выходит — localhost.run. Возвращает (ссылка, процесс)."""
    plan = [("Cloudflare", tunnel_cloudflare), ("Cloudflare", tunnel_cloudflare), ("localhost.run", tunnel_localhost_run)]
    for rnd in range(1, 6):
        for name, fn in plan:
            log(f"Получаю ссылку через {name}...")
            try:
                url, p = fn()
            except FileNotFoundError:
                log(f"[{name}] программа не найдена, пропускаю")
                continue
            except Exception as e:
                log(f"[{name}] ошибка: {e}")
                continue
            if url:
                log("Проверяю ссылку", url)
                for _ in range(12):
                    if url_ok(url):
                        break
                    time.sleep(5)
                else:
                    log("Ссылка пока не открывается с этого ПК, но обычно в Telegram она уже работает")
                return url, p
            time.sleep(3)
        wait = 30 * rnd
        log(f"Не получилось (круг {rnd}/5), повтор через {wait} сек")
        time.sleep(wait)
    if FALLBACK_URL:
        log("Временную ссылку получить не удалось — ставлю постоянную:", FALLBACK_URL)
        return FALLBACK_URL, None
    sys.exit("Не удалось получить ссылку. Проверь интернет и запусти снова через 10–15 минут.")


def set_menu():
    r = tg("setChatMenuButton", menu_button={"type": "web_app", "text": BUTTON_TEXT, "web_app": {"url": WEBAPP_URL}})
    log("Кнопка меню:", "ok" if r.get("ok") else r)


def watchdog():
    """Если туннель упал (пропал интернет и т.п.) — поднимаем новый и обновляем кнопку."""
    global WEBAPP_URL, PROC
    fails = 0
    while True:
        time.sleep(60)
        if PROC is None:
            continue
        dead = PROC.poll() is not None
        if not dead and url_ok(WEBAPP_URL):
            fails = 0
            continue
        fails += 1
        if dead or fails >= 3:
            log("Туннель не отвечает — перезапускаю...")
            try:
                PROC.kill()
            except Exception:
                pass
            WEBAPP_URL, PROC = start_tunnel()
            log("Новая ссылка:", WEBAPP_URL)
            set_menu()
            fails = 0


# ---------- 3. бот ----------
def keyboard():
    return {"inline_keyboard": [[{"text": BUTTON_TEXT, "web_app": {"url": WEBAPP_URL}}],
                                [{"text": "💬 Поддержка", "url": f"https://t.me/{SUPPORT.lstrip('@')}"}]]}


def setup_bot():
    me = tg("getMe")
    if not me.get("ok"):
        sys.exit(f"Токен не подходит: {me}")
    log(f"Бот: @{me['result']['username']}")
    tg("deleteWebhook", drop_pending_updates=True)
    set_menu()
    tg("setMyCommands", commands=[{"command": "start", "description": "Открыть STRELA CASE"},
                                  {"command": "help", "description": "Поддержка"}])
    return me["result"]["username"]


def handle(upd):
    msg = upd.get("message")
    if not msg or "text" not in msg:
        return
    chat = msg["chat"]["id"]
    text = msg["text"].split()[0].split("@")[0]
    if text == "/start":
        tg("sendMessage", chat_id=chat, text=WELCOME, parse_mode="HTML", reply_markup=keyboard())
        u = msg.get("from", {})
        log(f"/start от {u.get('first_name')} (@{u.get('username')}, id {u.get('id')})")
    elif text == "/id":
        u = msg.get("from", {})
        is_owner = is_owner_name(u.get("username"))
        tg("sendMessage", chat_id=chat, parse_mode="HTML",
           text=f"Твой ID: <code>{u.get('id')}</code>\nЮзернейм: @{u.get('username') or '—'}\n"
                + ("✅ Ты владелец — вкладка «Админ» в мини-аппе доступна." if is_owner else
                   f"Админка доступна только @{OWNER} и тем, кому он выдал доступ по ID."))
    elif text == "/help":
        tg("sendMessage", chat_id=chat, text=f"Поддержка: {SUPPORT}")
    else:
        tg("sendMessage", chat_id=chat, text="Открой игру кнопкой ниже 👇", reply_markup=keyboard())


def polling():
    offset = 0
    while True:
        try:
            r = tg("getUpdates", offset=offset, timeout=50)
            for upd in r.get("result", []):
                offset = upd["update_id"] + 1
                try:
                    handle(upd)
                except Exception as e:
                    log("Ошибка обработки:", e)
        except Exception as e:
            log("Нет связи с Telegram, повтор через 5 сек:", e)
            time.sleep(5)


if __name__ == "__main__":
    if not TOKEN:
        sys.exit("Нет токена бота. Положи его в файл token.txt рядом с bot.py")
    if not os.path.exists(os.path.join(WEB, "index.html")):
        sys.exit("Нет файла web/index.html")
    if FIXED_URL:
        WEBAPP_URL = FIXED_URL
        log("Мини-апп (GitHub Pages):", WEBAPP_URL)
        name = setup_bot()
    else:
        threading.Thread(target=run_web, daemon=True).start()
        WEBAPP_URL, PROC = start_tunnel()
        log("Мини-апп доступен по ссылке:", WEBAPP_URL)
        name = setup_bot()
        threading.Thread(target=watchdog, daemon=True).start()
    log(f"Готово! Открой https://t.me/{name} и нажми /start или кнопку «Играть».")
    log("Не закрывай это окно — иначе бот выключится. Ctrl+C — остановить.")
    try:
        polling()
    except KeyboardInterrupt:
        pass
    finally:
        if PROC:
            PROC.terminate()
