// STRELA CASE — бот + мини-апп на Cloudflare Workers (бесплатно, 24/7, без ПК и VPS)
// Секрет BOT_TOKEN задаётся в Cloudflare: Settings → Variables and Secrets.
// После деплоя один раз открой https://<твой-воркер>.workers.dev/setup

const OWNERS = ["PODONOK_UC_1"];          // владельцы админки (username без @)
const SUPPORT = "@Sdelka_ton";
const DEFAULT_ORIGIN = "https://strela.timalukyang.workers.dev"; // адрес воркера (для автопочинки вебхука)            // контакт поддержки
const BUTTON_TEXT = "🏝 Играть";
const WELCOME = "🏹 <b>STRELA CASE</b>\n\nКейсы, краш, мины, plinko, PvP и подарки с Fragment 🎁\nЖми кнопку ниже, чтобы открыть игру 👇";

const enc = new TextEncoder();
const isOwner = u => OWNERS.some(o => o.toLowerCase() === String(u || "").toLowerCase());
const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", typeof key === "string" ? enc.encode(key) : key,
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}
const hex = b => [...b].map(x => x.toString(16).padStart(2, "0")).join("");
async function sha256hex(s) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)))); }

// Проверка подписи Telegram WebApp initData → user или null
export async function checkInitData(initData, token) {
  try {
    const p = new URLSearchParams(initData);
    const got = p.get("hash"); if (!got) return null;
    p.delete("hash");
    const dcs = [...p.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${k}=${v}`).join("\n");
    const secret = await hmac("WebAppData", token);
    if (hex(await hmac(secret, dcs)) !== got) return null;
    return JSON.parse(p.get("user") || "{}");
  } catch { return null; }
}

async function tg(env, method, params) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(params) });
  return r.json();
}

// ---- хранилище общих настроек админки (Durable Object, SQLite — бесплатно) ----
export class Store {
  constructor(state) { this.state = state; }
  async fetch(req) {
    const key = new URL(req.url).pathname.slice(1) || "settings";
    if (req.method === "POST") { await this.state.storage.put(key, await req.text()); return new Response("ok"); }
    return new Response((await this.state.storage.get(key)) || (key === "settings" ? "{}" : ""));
  }
}
const store = env => env.STORE.get(env.STORE.idFromName("main"));
async function loadSettings(env) { try { return JSON.parse(await (await store(env).fetch("https://s/")).text()); } catch { return {}; } }

async function setupBot(env, origin, hookKey, dropPending) {
  await store(env).fetch("https://s/origin", { method: "POST", body: origin });
  const a = await tg(env, "setWebhook", { url: `${origin}/webhook`, secret_token: hookKey, drop_pending_updates: !!dropPending, allowed_updates: ["message"] });
  const b = await tg(env, "setChatMenuButton", { menu_button: { type: "web_app", text: BUTTON_TEXT, web_app: { url: origin + "/" } } });
  await tg(env, "setMyCommands", { commands: [{ command: "start", description: "Открыть STRELA CASE" }, { command: "admin", description: "Админ-панель" }, { command: "id", description: "Мой ID" }, { command: "help", description: "Поддержка" }] });
  return { a, b };
}

async function handleUpdate(env, origin, upd) {
  const msg = upd.message; if (!msg || !msg.text) return;
  const chat = msg.chat.id, cmd = msg.text.split(/\s/)[0].split("@")[0];
  const kb = { inline_keyboard: [[{ text: BUTTON_TEXT, web_app: { url: origin + "/" } }],
    [{ text: "💬 Поддержка", url: "https://t.me/" + SUPPORT.replace("@", "") }]] };
  if (cmd === "/start") await tg(env, "sendMessage", { chat_id: chat, text: WELCOME, parse_mode: "HTML", reply_markup: kb });
  else if (cmd === "/id") {
    const u = msg.from || {};
    await tg(env, "sendMessage", { chat_id: chat, parse_mode: "HTML",
      text: `Твой ID: <code>${u.id}</code>\nЮзернейм: @${u.username || "—"}\n` +
        (isOwner(u.username) ? "✅ Ты владелец — вкладка «Админ» в мини-аппе доступна." : "Админка доступна только владельцу и тем, кому он выдал доступ по ID.") });
  }
  else if (cmd === "/admin") {
    const u = msg.from || {}, st = await loadSettings(env);
    const ok = isOwner(u.username) || (st.admins || []).map(String).includes(String(u.id));
    if (ok) await tg(env, "sendMessage", { chat_id: chat, text: "🛠 Админ-панель STRELA CASE",
      reply_markup: { inline_keyboard: [[{ text: "🛠 Открыть админку", web_app: { url: origin + "/#admin" } }]] } });
    else await tg(env, "sendMessage", { chat_id: chat, parse_mode: "HTML",
      text: `⛔ Нет доступа.\nТвой юзернейм: @${u.username || "—"}, ID: <code>${u.id}</code>\nАдминка доступна владельцу (@${OWNERS.join(", @")}) и тем, кому он выдал доступ по ID.` });
  }
  else if (cmd === "/help") await tg(env, "sendMessage", { chat_id: chat, text: "Поддержка: " + SUPPORT });
  else await tg(env, "sendMessage", { chat_id: chat, text: "Открой игру кнопкой ниже 👇", reply_markup: kb });
}

export default {
  // каждые 5 минут: если вебхук кто-то снял (например, запустили бота на ПК) — возвращаем
  async scheduled(event, env, ctx) {
    if (!env.BOT_TOKEN) return;
    const origin = (await (await store(env).fetch("https://s/origin")).text()) || DEFAULT_ORIGIN;
    if (!origin) return;
    const w = await tg(env, "getWebhookInfo", {});
    if (w.ok && w.result.url !== origin + "/webhook") {
      const hookKey = (await sha256hex("hook:" + env.BOT_TOKEN)).slice(0, 32);
      await setupBot(env, origin, hookKey, false);
      console.log("webhook restored");
    }
  },

  async fetch(req, env) {
    const url = new URL(req.url), origin = url.origin, path = url.pathname;
    if (!env.BOT_TOKEN && (path === "/setup" || path.startsWith("/webhook")))
      return new Response("Нет секрета BOT_TOKEN. Добавь его в Cloudflare: Settings → Variables and Secrets, потом снова открой /setup", { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
    const hookKey = env.BOT_TOKEN ? (await sha256hex("hook:" + env.BOT_TOKEN)).slice(0, 32) : "";

    // первичная настройка: вебхук + кнопка меню + команды
    if (path === "/setup") {
      const me = await tg(env, "getMe", {});
      if (!me.ok) return new Response("Токен не подходит: " + JSON.stringify(me), { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
      const { a, b } = await setupBot(env, origin, hookKey, true);
      const ok = a.ok && b.ok;
      return new Response(`<meta name=viewport content="width=device-width"><body style="font:18px system-ui;padding:24px;background:#06345a;color:#fff">
        <h2>${ok ? "✅ Готово!" : "⚠️ Что-то не так"}</h2><p>Бот: <b>@${me.result.username}</b></p>
        <p>Вебхук: ${a.ok ? "ok" : JSON.stringify(a)}<br>Кнопка «Играть»: ${b.ok ? "ok" : JSON.stringify(b)}</p>
        <p>Игра: <a style="color:#ffd23f" href="${origin}/">${origin}/</a></p>
        <p>Открой бота в Telegram и нажми /start 🏝</p></body>`, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    // диагностика: куда Telegram шлёт апдейты и последняя ошибка
    if (path === "/status") {
      let w = await tg(env, "getWebhookInfo", {}), repaired = false;
      if (w.ok && w.result.url !== origin + "/webhook") { await setupBot(env, origin, hookKey, false); repaired = true; w = await tg(env, "getWebhookInfo", {}); }
      const r = w.result || {};
      const me = await tg(env, "getMe", {});
      const out = { version: "v6", token_ok: !!me.ok, telegram_error: me.ok ? null : (env.BOT_TOKEN ? me.error_code + " " + me.description : "BOT_TOKEN не задан — добавь его как Secret"), bot: me.ok ? "@" + me.result.username : null, webhook_ok: r.url === origin + "/webhook", repaired, setup_error: repaired && r.url !== origin + "/webhook" ? "setWebhook не сработал" : null, url: r.url || "(пусто — вебхук снят)", pending: r.pending_update_count,
        last_error: r.last_error_message || null, last_error_at: r.last_error_date ? new Date(r.last_error_date * 1000).toISOString() : null };
      return json(out);
    }

    // апдейты от Telegram
    if (path === "/webhook" && req.method === "POST") {
      if (req.headers.get("x-telegram-bot-api-secret-token") !== hookKey) return new Response("forbidden", { status: 403 });
      try { await handleUpdate(env, origin, await req.json()); } catch (e) { console.log("update error", e); }
      return new Response("ok");
    }

    // общие настройки админки
    if (path === "/api/settings") {
      if (req.method === "GET") return json(await loadSettings(env));
      if (req.method === "POST") {
        let data; try { data = await req.json(); } catch { return json({ ok: false }, 400); }
        const user = await checkInitData(data.initData || "", env.BOT_TOKEN || "");
        if (!user) return json({ ok: false, err: "bad initData" }, 403);
        const cur = await loadSettings(env), admins = (cur.admins || []).map(String);
        if (!isOwner(user.username) && !admins.includes(String(user.id))) return json({ ok: false, err: "not admin" }, 403);
        const next = data.settings || {};
        if (!isOwner(user.username)) next.admins = cur.admins || [];   // доступ выдаёт только владелец
        const body = JSON.stringify(next);
        if (body.length > 1_000_000) return json({ ok: false, err: "too big" }, 413);
        await store(env).fetch("https://s/", { method: "POST", body });
        return json({ ok: true });
      }
    }

    // всё остальное — сайт игры
    return env.ASSETS.fetch(req);
  }
};
