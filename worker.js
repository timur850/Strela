// STRELA CASE — бот + мини-апп на Cloudflare Workers (бесплатно, 24/7, без ПК и VPS)
// Секрет BOT_TOKEN задаётся в Cloudflare: Settings → Variables and Secrets.
// После деплоя один раз открой https://<твой-воркер>.workers.dev/setup

import { Game, GameError } from "./game.js";
import { CONFIG } from "./config.js";
const { DEF_TASKS } = globalThis.STRELA;

const OWNERS = CONFIG.OWNERS;                 // владельцы админки — меняются в config.js
const SUPPORT = CONFIG.SUPPORT;               // контакт поддержки
const DEFAULT_ORIGIN = CONFIG.DEFAULT_ORIGIN || ""; // адрес воркера (для автопочинки вебхука)
// токен: секрет BOT_TOKEN в Cloudflare, а если его нет — из config.js
const withCfg = env => env.BOT_TOKEN || !CONFIG.BOT_TOKEN ? env : { ...env, BOT_TOKEN: CONFIG.BOT_TOKEN };
// юзернейм бота узнаём сами (getMe) — чтобы копии работали без правки кода
let _botName = "";
async function botName(env) {
  if (_botName) return _botName;
  let n = await getKey(env, "botname");
  if (!n && env.BOT_TOKEN) { const me = await tg(env, "getMe", {}); if (me.ok) { n = me.result.username; await putKey(env, "botname", n); } }
  if (n) for (const t of DEF_TASKS) if (t.url && t.url.includes("StrelaCase_bot")) t.url = t.url.replace("StrelaCase_bot", n);
  _botName = n || "";
  return _botName;
}
// TON-кошелёк для пополнений (можно поменять в мини-аппе: Админ → 💎 Оплата)
const TON_WALLET = "ВСТАВЬ_СЮДА_АДРЕС_TON_КОШЕЛЬКА";
const TON_STARS = 150;                 // сколько ★ даём за 1 TON (тоже меняется в админке)
const UPDATES = ["message", "pre_checkout_query", "business_connection"];
const hookBad = (r, origin) => r.url !== origin + "/webhook" || UPDATES.some(x => !(r.allowed_updates || []).includes(x));
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
  constructor(state, env) {
    this.state = state; this.env = env;
    // разовая починка: минимальный вывод случайно сохранили как 50100 вместо 50
    state.blockConcurrencyWhile(async () => {
      if (await state.storage.get("mig:minwd50")) return;
      try {
        const raw = await state.storage.get("settings");
        if (raw) { const st = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (+st.minWd === 50100) { st.minWd = 50; await state.storage.put("settings", typeof raw === "string" ? JSON.stringify(st) : st); } }
      } catch (e) { console.log("mig minwd", e); }
      await state.storage.put("mig:minwd50", 1);
    });
  }
  async fetch(req) {
    const key = new URL(req.url).pathname.slice(1) || "settings";
    // игровые операции: всё считается здесь, атомарно, в одном месте
    if (key.startsWith("op/") && req.method === "POST") {
      const b = await req.json(), name = key.slice(3);
      try {
        const res = await new Game(this.state.storage).run(name, b.uid, b.name, b.d || {}, b.admin);
        if (name.startsWith("pvp") || name.startsWith("admin/bc")) await this.schedule();
        return json(res);
      }
      catch (e) { if (e instanceof GameError) return json({ ok: false, err: e.message }); console.log("op error", e); return json({ ok: false, err: "Ошибка сервера" }); }
    }
    if (req.method === "POST") { await this.state.storage.put(key, await req.text()); return new Response("ok"); }
    return new Response((await this.state.storage.get(key)) || (key === "settings" ? "{}" : ""));
  }
  // будильник: итог PvP-раунда и рассылка пачками
  async alarm() {
    const g = new Game(this.state.storage); await g.init();
    try { await g.pvpTick(); } catch (e) { console.log("pvp tick", e); }
    try { await this.bcStep(); } catch (e) { console.log("broadcast", e); }
    await this.schedule();
  }
  async schedule() {
    const s = this.state.storage, g = new Game(s);
    const times = [await g.pvpDue()];
    const job = await s.get("bc:job");
    if (job && !job.done) times.push(job.next || Date.now());
    const t = times.filter(Boolean);
    if (t.length) await s.setAlarm(Math.max(Date.now() + 50, Math.min(...t)));
  }
  async bcStep() {
    const s = this.state.storage, job = await s.get("bc:job");
    if (!job || job.done || (job.next && Date.now() < job.next - 50)) return;
    const origin = (await s.get("origin")) || DEFAULT_ORIGIN;
    const kb = [];
    if (job.btnText && job.btnUrl) kb.push([{ text: job.btnText, url: job.btnUrl }]);
    if (job.play) kb.push([{ text: BUTTON_TEXT, web_app: { url: origin + "/" } }]);
    const end = Math.min(job.ids.length, job.pos + 25);        // ≤ 25 сообщений за раз — в лимитах Telegram и Cloudflare
    for (; job.pos < end; job.pos++) {
      const r = await tg(this.env, "sendMessage", { chat_id: job.ids[job.pos], text: job.text, disable_web_page_preview: true, ...(kb.length ? { reply_markup: { inline_keyboard: kb } } : {}) });
      if (r.ok) job.sent++; else job.failed++;
    }
    if (job.pos >= job.ids.length) { job.done = true; job.finished = Date.now(); } else job.next = Date.now() + 1100;
    await s.put("bc:job", job);
  }
}
const store = env => env.STORE.get(env.STORE.idFromName("main"));
async function loadSettings(env) {
  let st; try { st = JSON.parse(await (await store(env).fetch("https://s/")).text()); } catch { st = {}; }
  if (st.freeGate === undefined && CONFIG.FREE_GATE) st.freeGate = CONFIG.FREE_GATE;   // по умолчанию — из config.js
  return st;
}
// подписан ли игрок на канал (бот должен быть админом канала)
async function isSub(env, channel, uid) {
  const ch = "@" + String(channel || "").replace(/^@|^(?:https?:\/\/)?t\.me\//g, "").replace(/\/$/, "");
  const r = await tg(env, "getChatMember", { chat_id: ch, user_id: uid });
  if (!r.ok) return { ok: false, why: "Бот не может проверить подписку на " + ch + " — админ, добавь бота админом канала" };
  const s = r.result.status;
  const ok = ["creator", "administrator", "member"].includes(s) || (s === "restricted" && r.result.is_member);
  return { ok, why: ok ? "" : "Подпишись на канал " + ch };
}

async function setupBot(env, origin, hookKey, dropPending) {
  await store(env).fetch("https://s/origin", { method: "POST", body: origin });
  const a = await tg(env, "setWebhook", { url: `${origin}/webhook`, secret_token: hookKey, drop_pending_updates: !!dropPending, allowed_updates: UPDATES });
  const b = await tg(env, "setChatMenuButton", { menu_button: { type: "web_app", text: BUTTON_TEXT, web_app: { url: origin + "/" } } });
  await tg(env, "setMyCommands", { commands: [{ command: "start", description: "Открыть STRELA CASE" }, { command: "admin", description: "Админ-панель" }, { command: "id", description: "Мой ID" }, { command: "help", description: "Поддержка" }] });
  return { a, b };
}

const op = async (env, name, uid, uname, d, admin) =>
  (await store(env).fetch("https://s/op/" + name, { method: "POST", body: JSON.stringify({ uid, name: uname, d, admin }) })).json();
const uname = u => u.username ? "@" + u.username : ([u.first_name, u.last_name].filter(Boolean).join(" ") || "Игрок");
const PUBLIC_OPS = new Set(["pvp_state", "me", "case", "egg", "upgrade", "contract", "crash_state", "crash_bet", "crash_cash", "mines_bet", "mines_open", "mines_cash", "plinko", "slots", "pvp", "sell", "sellall", "task_start", "share"]);
const ADMIN_OPS = new Set(["give", "tick", "gift", "stats", "resetstats", "resetall", "resettour", "wd_done", "bc_start", "bc_stop", "bc_test"]);
async function isAdminUser(env, u) {
  if (isOwner(u.username)) return true;
  const st = await loadSettings(env);
  return (st.admins || []).map(String).includes(String(u.id));
}

// владелец открыл мини-апп → запоминаем его чат (в личке chat_id = user id), чтобы заявки на вывод доходили
async function seenOwner(env, u) {
  if (!u || !u.username || !isOwner(u.username)) return;
  const k = "ownerchat:" + u.username.toLowerCase();
  if (!(await getKey(env, k))) await putKey(env, k, String(u.id));
}
const getKey = async (env, k) => (await (await store(env).fetch("https://s/" + k)).text());
const putKey = (env, k, v) => store(env).fetch("https://s/" + k, { method: "POST", body: typeof v === "string" ? v : JSON.stringify(v) });

// ===== АВТОВЫДАЧА КОЛЛЕКЦИОННЫХ ПОДАРКОВ через Telegram Business =====
// Аккаунт-склад (владелец) подключает бота: Настройки → Telegram Business → Чат-боты → @бот,
// права «Подарки и звёзды» (просмотр, передача подарков, передача звёзд).
const giftKey = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
async function bizConn(env) { const r = await getKey(env, "bizconn"); try { return r ? JSON.parse(r) : null; } catch { return null; } }
async function bizGifts(env, conn) {
  const out = []; let offset = "";
  for (let i = 0; i < 10; i++) {
    const r = await tg(env, "getBusinessAccountGifts", { business_connection_id: conn.id, exclude_unlimited: true, limit: 100, ...(offset ? { offset } : {}) });
    if (!r.ok) throw new Error(r.description || "getBusinessAccountGifts");
    for (const g of r.result.gifts || []) if (g.type === "unique") out.push(g);
    offset = r.result.next_offset; if (!offset) break;
  }
  return out;
}
const BIZ_HINTS = [[/active|not found|chat/i, "игрок должен написать любое сообщение складу-аккаунту (в течение 24 ч), потом выдай вручную"],
  [/BALANCE|not enough|STARS/i, "не хватает звёзд на аккаунте-складе для оплаты передачи"],
  [/right|RIGHTS|forbidden/i, "у бота нет прав «Передача подарков/звёзд» в Telegram Business"]];
async function bizTransfer(env, slug, toId) {
  const conn = await bizConn(env);
  if (!conn || !conn.on) return { err: "аккаунт-склад не подключён к боту через Telegram Business" };
  let list; try { list = await bizGifts(env, conn); } catch (e) { return { err: e.message }; }
  const now = Date.now() / 1000, key = giftKey(slug);
  const cand = list.filter(g => giftKey(g.gift.base_name) === key && g.can_be_transferred !== false && !(g.next_transfer_date > now))
    .sort((a, b) => (a.transfer_star_count || 0) - (b.transfer_star_count || 0));
  if (!cand.length) return { err: "такого подарка нет на складе" };
  let last = "";
  for (const g of cand.slice(0, 10)) {   // выставленный на продажу/заблокированный экземпляр пропускаем и пробуем следующий
    const r = await tg(env, "transferGift", { business_connection_id: conn.id, owned_gift_id: g.owned_gift_id, new_owner_chat_id: Number(toId),
      ...(g.transfer_star_count > 0 ? { star_count: g.transfer_star_count } : {}) });
    if (r.ok) return { ok: true, name: g.gift.name || g.gift.base_name };
    last = r.description || "ошибка";
    if (BIZ_HINTS.some(([re]) => re.test(last))) break;   // права/звёзды/чат — другие экземпляры тоже не пройдут
  }
  const h = BIZ_HINTS.find(([re]) => re.test(last));
  return { err: last + (h ? " — " + h[1] : "") };
}

async function handleUpdate(env, origin, upd) {
  // подключение/отключение бота к аккаунту-складу (Telegram Business)
  if (upd.business_connection) {
    const b = upd.business_connection, owner = b.user && isOwner(b.user.username);
    if (owner) {
      const r = b.rights || {};
      await putKey(env, "bizconn", { id: b.id, on: !!b.is_enabled, user: b.user.username, chat: b.user_chat_id, rights: r, t: Date.now() });
      const miss = [["can_view_gifts_and_stars", "просмотр подарков"], ["can_transfer_and_upgrade_gifts", "передача подарков"], ["can_transfer_stars", "передача звёзд"]].filter(([k]) => !r[k]).map(x => x[1]);
      await tg(env, "sendMessage", { chat_id: b.user_chat_id, parse_mode: "HTML", text: b.is_enabled
        ? "✅ <b>Автовыдача подключена</b> — коллекционные подарки с этого аккаунта будут уходить игрокам сами." + (miss.length ? "\n\n⚠️ Включи права бота: " + miss.join(", ") : "")
        : "⛔ Бот отключён от аккаунта — автовыдача коллекционных подарков выключена." }).catch(() => {});
    } else if (b.is_enabled && b.user_chat_id) {
      await tg(env, "sendMessage", { chat_id: b.user_chat_id, text: `⚠️ @${b.user && b.user.username || "этот аккаунт"} не владелец бота — склад для автовыдачи можно подключить только с аккаунта @${OWNERS.join(" / @")}.` }).catch(() => {});
    }
    return;
  }
  // оплата звёздами: Telegram спрашивает «можно?» — отвечаем да (иначе платёж не пройдёт)
  if (upd.pre_checkout_query) {
    const q = upd.pre_checkout_query, ok = String(q.invoice_payload || "").startsWith("dep:");
    await tg(env, "answerPreCheckoutQuery", ok ? { pre_checkout_query_id: q.id, ok: true }
      : { pre_checkout_query_id: q.id, ok: false, error_message: "Платёж устарел, попробуй ещё раз" });
    return;
  }
  const sp = upd.message && upd.message.successful_payment;
  if (sp && sp.currency === "XTR" && String(sp.invoice_payload).startsWith("dep:")) {
    const uid = String(upd.message.from.id), puid = sp.invoice_payload.split(":")[1];
    if (puid === uid && !(await getKey(env, "pay:" + sp.invoice_payload)))
      await putKey(env, "pay:" + sp.invoice_payload, { uid, a: sp.total_amount, charge: sp.telegram_payment_charge_id, claimed: false, t: Date.now() });
    return;
  }
  const msg = upd.message; if (!msg || !msg.text) return;
  // запоминаем чат владельца, чтобы присылать ему заявки на вывод
  if (msg.from && isOwner(msg.from.username) && msg.chat.type === "private") await putKey(env, "ownerchat:" + msg.from.username.toLowerCase(), String(msg.chat.id));
  const chat = msg.chat.id, cmd = msg.text.split(/\s/)[0].split("@")[0];
  const kb = { inline_keyboard: [[{ text: BUTTON_TEXT, web_app: { url: origin + "/" } }],
    [{ text: "💬 Поддержка", url: "https://t.me/" + SUPPORT.replace("@", "") }]] };
  if (cmd === "/start" && msg.from && msg.chat.type === "private") await putKey(env, "bu:" + msg.from.id, "1");
  if (cmd === "/start") {
    const m = msg.text.match(/^\/start(?:@\S+)?\s+ref_(\d{3,15})/);
    if (m && msg.from) await op(env, "ref_bind", msg.from.id, uname(msg.from), { ref: m[1] });
  }
  if (cmd === "/start") await tg(env, "sendMessage", { chat_id: chat, text: WELCOME, parse_mode: "HTML", reply_markup: kb });
  if ((cmd === "/start" || cmd === "/admin") && msg.from && isOwner(msg.from.username)) {
    const pend = await op(env, "admin/wd_count", msg.from.id, "", {}, true);
    if (pend.ok && pend.n) await tg(env, "sendMessage", { chat_id: chat, text: `📤 Ждут выдачи: ${pend.n} заявок на вывод — открой /admin → Статистика` });
  }
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
  else if (cmd === "/wdtest" && msg.from && isOwner(msg.from.username)) {
    const st = await loadSettings(env), lines = [];
    for (const o of OWNERS) lines.push(`@${o}: чат ${(await getKey(env, "ownerchat:" + o.toLowerCase())) || "❌ не сохранён"}`);
    lines.push(`Админы из настроек: ${(st.admins || []).join(", ") || "—"}`);
    let last = ""; try { last = JSON.parse(await getKey(env, "wd:lastnotify") || "null"); } catch {}
    const t = await tg(env, "sendMessage", { chat_id: chat, text: "🧪 Тестовая заявка: если ты это видишь — уведомления сюда доходят." });
    await tg(env, "sendMessage", { chat_id: chat, parse_mode: "HTML", text: "🧪 <b>Проверка заявок на вывод</b>\n\n" + lines.join("\n") +
      `\nТест в этот чат: ${t.ok ? "✅" : "❌ " + (t.description || "")}` +
      (last ? `\n\nПоследняя заявка (${new Date(last.t).toLocaleString("ru-RU", { timeZone: "Europe/Kyiv" })}):\nкому: ${(last.to || []).join(", ") || "никому"}\nдоставлено: ${last.sent}\nошибки: ${(last.errs || []).join("; ") || "нет"}\nавтовыдача: ${last.auto || "—"}` : "\n\nЗаявок после обновления ещё не было.") });
  }
  else if (cmd === "/biz" && msg.from && isOwner(msg.from.username)) {
    const conn = await bizConn(env);
    let t = "🏪 <b>Склад подарков (Telegram Business)</b>\n\n";
    if (!conn || !conn.on) t += "❌ Не подключён.\nОткрой на аккаунте-складе: Настройки → Telegram Business → Чат-боты → добавь этого бота и включи права «Подарки и звёзды».";
    else {
      t += `✅ Подключён: @${conn.user}\n`;
      try {
        const list = await bizGifts(env, conn), cnt = {};
        list.forEach(g => { const k = g.gift.base_name; cnt[k] = (cnt[k] || 0) + 1; });
        const rows = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `• ${k} — ${v} шт.`);
        t += `🎁 Коллекционных на складе: ${list.length}\n` + (rows.slice(0, 40).join("\n") || "пусто");
      } catch (e) { t += "⚠️ Не могу прочитать подарки: " + e.message; }
    }
    await tg(env, "sendMessage", { chat_id: chat, parse_mode: "HTML", text: t });
  }
  else if (cmd === "/help") await tg(env, "sendMessage", { chat_id: chat, text: "Поддержка: " + SUPPORT });
  else await tg(env, "sendMessage", { chat_id: chat, text: "Открой игру кнопкой ниже 👇", reply_markup: kb });
}

export default {
  // каждые 5 минут: если вебхук кто-то снял (например, запустили бота на ПК) — возвращаем
  async scheduled(event, env, ctx) {
    env = withCfg(env);
    if (!env.BOT_TOKEN) return;
    const origin = (await (await store(env).fetch("https://s/origin")).text()) || DEFAULT_ORIGIN;
    if (!origin) return;
    const w = await tg(env, "getWebhookInfo", {});
    if (w.ok && hookBad(w.result, origin)) {
      const hookKey = (await sha256hex("hook:" + env.BOT_TOKEN)).slice(0, 32);
      await setupBot(env, origin, hookKey, false);
      console.log("webhook restored");
    }
  },

  async fetch(req, env) {
    env = withCfg(env);
    const url = new URL(req.url), origin = url.origin, path = url.pathname;
    await botName(env).catch(() => "");
    if (!env.BOT_TOKEN && (path === "/setup" || path.startsWith("/webhook")))
      return new Response("Нет секрета BOT_TOKEN. Добавь его в Cloudflare: Settings → Variables and Secrets, потом снова открой /setup", { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
    const hookKey = env.BOT_TOKEN ? (await sha256hex("hook:" + env.BOT_TOKEN)).slice(0, 32) : "";

    // первичная настройка: вебхук + кнопка меню + команды
    if (path === "/setup") {
      const me = await tg(env, "getMe", {});
      if (me.ok) { await putKey(env, "botname", me.result.username); _botName = me.result.username; }
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
      if (w.ok && hookBad(w.result, origin)) { await setupBot(env, origin, hookKey, false); repaired = true; w = await tg(env, "getWebhookInfo", {}); }
      const r = w.result || {};
      const me = await tg(env, "getMe", {});
      const out = { version: "v8", token_ok: !!me.ok, telegram_error: me.ok ? null : (env.BOT_TOKEN ? me.error_code + " " + me.description : "BOT_TOKEN не задан — добавь его как Secret"), bot: me.ok ? "@" + me.result.username : null, webhook_ok: r.url === origin + "/webhook", repaired, setup_error: repaired && r.url !== origin + "/webhook" ? "setWebhook не сработал" : null, url: r.url || "(пусто — вебхук снят)", pending: r.pending_update_count,
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
    // настройки этой копии для мини-аппа: юзернейм бота, владельцы, куда слать подарки
    if (path === "/api/cfg") return json({ bot: await botName(env).catch(() => ""), owners: OWNERS, giftAcc: CONFIG.GIFT_ACC, support: SUPPORT });
    if (path === "/api/settings") {
      if (req.method === "GET") return json(await loadSettings(env));
      if (req.method === "POST") {
        let data; try { data = await req.json(); } catch { return json({ ok: false }, 400); }
        const user = await checkInitData(data.initData || "", env.BOT_TOKEN || ""); if (user) await seenOwner(env, user);
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

    // манифест для TON Connect
    if (path === "/tonconnect-manifest.json")
      return new Response(JSON.stringify({ url: origin, name: "STRELA CASE", iconUrl: "https://telegram.org/img/t_logo.png" }),
        { headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });

    // ===== ПОПОЛНЕНИЕ ЗВЁЗДАМИ =====
    if (path === "/api/stars/invoice" && req.method === "POST") {
      let d; try { d = await req.json(); } catch { return json({ ok: false }, 400); }
      const u = await checkInitData(d.initData || "", env.BOT_TOKEN || ""); if (u) await seenOwner(env, u);
      if (!u) return json({ ok: false, err: "Открой игру через бота" }, 403);
      const a = Math.round(Number(d.amount));
      if (!(a >= 1 && a <= 10000)) return json({ ok: false, err: "От 1 до 10 000 ★ за раз" }, 400);
      const payload = `dep:${u.id}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      const r = await tg(env, "createInvoiceLink", { title: `Пополнение ${a} ⭐`, description: "Звёзды на баланс STRELA CASE",
        payload, currency: "XTR", prices: [{ label: `${a} ⭐`, amount: a }] });
      if (!r.ok) return json({ ok: false, err: r.description || "Telegram не создал счёт" });
      return json({ ok: true, link: r.result, payload });
    }
    if (path === "/api/stars/claim" && req.method === "POST") {
      let d; try { d = await req.json(); } catch { return json({ ok: false }, 400); }
      const u = await checkInitData(d.initData || "", env.BOT_TOKEN || ""); if (u) await seenOwner(env, u);
      if (!u) return json({ ok: false }, 403);
      return json(await op(env, "claim_stars", u.id, uname(u), { payload: String(d.payload || "") }));
    }

    // ===== ПОПОЛНЕНИЕ TON =====
    if (path === "/api/ton/info") {
      const st = await loadSettings(env);
      return json({ wallet: (st.tonWallet || TON_WALLET).trim(), rate: Number(st.tonRate) || TON_STARS });
    }
    if (path === "/api/ton/check" && req.method === "POST") {
      let d; try { d = await req.json(); } catch { return json({ ok: false }, 400); }
      const u = await checkInitData(d.initData || "", env.BOT_TOKEN || ""); if (u) await seenOwner(env, u);
      if (!u) return json({ ok: false }, 403);
      const memo = String(d.memo || "");
      if (!memo.startsWith(`S${u.id}-`) || memo.length > 60) return json({ ok: false }, 400);
      if (await getKey(env, "ton:" + memo)) return json({ ok: false, err: "Уже зачислено" });
      const st = await loadSettings(env), wallet = (st.tonWallet || TON_WALLET).trim(), rate = Number(st.tonRate) || TON_STARS;
      const r = await fetch(`https://toncenter.com/api/v2/getTransactions?address=${encodeURIComponent(wallet)}&limit=40&archival=true`).then(x => x.json()).catch(() => null);
      if (!r || !r.ok) return json({ ok: false, wait: true });
      const tx = r.result.find(t => t.in_msg && t.in_msg.message === memo && Number(t.in_msg.value) > 0);
      if (!tx) return json({ ok: false, wait: true });
      const ton = Number(tx.in_msg.value) / 1e9, a = Math.floor(ton * rate);
      const r2 = await op(env, "credit_ton", u.id, uname(u), { memo, ton, a, hash: tx.transaction_id && tx.transaction_id.hash });
      if (r2.ok && r2.already) return json({ ok: false, err: "Уже зачислено" });
      return json({ ...r2, a: r2.got, ton });
    }

    // ===== ЗАЯВКА НА ВЫВОД ПОДАРКА → сообщение владельцу =====
    if (path === "/api/withdraw" && req.method === "POST") {
      let d; try { d = await req.json(); } catch { return json({ ok: false }, 400); }
      const u = await checkInitData(d.initData || "", env.BOT_TOKEN || ""); if (u) await seenOwner(env, u);
      if (!u) return json({ ok: false, err: "Открой игру через бота" }, 403);
      const r = await op(env, "withdraw", u.id, uname(u), { i: d.i, slug: d.slug });
      if (!r.ok) return json(r);
      const w = r.wd, e = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
      // обычный подарок Telegram — бот отправляет сам, за звёзды со своего баланса
      let autoErr = "";
      if (w.tgid) {
        const g = await tg(env, "sendGift", { user_id: u.id, gift_id: String(w.tgid), text: "🏹 Вывод из STRELA CASE" });
        if (g.ok) {
          await op(env, "withdraw_done", u.id, uname(u), { id: w.id });
          for (const o of OWNERS) {
            const chat = await getKey(env, "ownerchat:" + o.toLowerCase());
            if (chat) await tg(env, "sendMessage", { chat_id: chat, parse_mode: "HTML", text: `🤖 Автовыдача: <b>${e(w.name)}</b> (${w.price} ★) → ${e(uname(u))}, ID <code>${u.id}</code>` });
          }
          return json({ ...r, auto: true });
        }
        autoErr = g.description || "ошибка";
      } else {
        // коллекционный подарок — передаём с аккаунта-склада через Telegram Business
        const b = await bizTransfer(env, w.slug, u.id);
        if (b.ok) {
          await op(env, "withdraw_done", u.id, uname(u), { id: w.id });
          for (const o of OWNERS) {
            const chat = await getKey(env, "ownerchat:" + o.toLowerCase());
            if (chat) await tg(env, "sendMessage", { chat_id: chat, parse_mode: "HTML", text: `🤖 Автовыдача: <b>${e(b.name)}</b> (${w.price} ★) → ${e(uname(u))}, ID <code>${u.id}</code>` });
          }
          return json({ ...r, auto: true });
        }
        autoErr = b.err;
      }
      const text = `📤 <b>Заявка на вывод</b>\n\n🎁 Подарок: <b>${e(w.name)}</b>\n⭐ Цена: ${w.price} ★\n` +
        `👤 Игрок: ${e(uname(u))}\n🆔 ID: <code>${u.id}</code>\n🕒 ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Kyiv" })}` +
        (!w.slug.startsWith("r_") ? `\n🔗 https://fragment.com/gifts/${w.slug}` : "") +
        (autoErr ? `\n\n⚠️ Автовыдача не сработала: ${e(autoErr)}\n` + (w.tgid ? "Проверь баланс звёзд бота (@BotFather → бот → Balance) и отправь вручную." : "Отправь вручную или проверь склад командой /biz.") : "");
      const kb = { inline_keyboard: [[{ text: "💬 Написать игроку", url: u.username ? "https://t.me/" + u.username : "tg://user?id=" + u.id }]] };
      // шлём владельцам и всем админам из настроек
      const st = await loadSettings(env), to = new Set();
      for (const o of OWNERS) { const c = await getKey(env, "ownerchat:" + o.toLowerCase()); if (c) to.add(String(c)); }
      for (const a of st.admins || []) to.add(String(a));
      let sent = 0; const errs = [];
      for (const chat of to) {
        let x; try { x = await tg(env, "sendMessage", { chat_id: chat, text, parse_mode: "HTML", reply_markup: kb, disable_web_page_preview: true }); } catch (er) { x = { ok: false, description: String(er) }; }
        if (x.ok) sent++; else errs.push(chat + ": " + (x.description || "?"));
      }
      await putKey(env, "wd:lastnotify", { t: Date.now(), to: [...to], sent, errs, auto: autoErr });
      // даже если сообщение не ушло — заявка остаётся в админке (Статистика → Заявки на вывод), подарок не возвращаем
      if (!sent) console.log("withdraw notify failed", w.id);
      return json({ ...r, queued: !sent });
    }

    // ===== ИГРЫ: результат решает сервер =====
    if (path.startsWith("/api/game/") && req.method === "POST") {
      const name = path.slice(10);
      if (!PUBLIC_OPS.has(name)) return json({ ok: false, err: "Неизвестное действие" }, 404);
      let d; try { d = await req.json(); } catch { return json({ ok: false }, 400); }
      const u = await checkInitData(d.initData || "", env.BOT_TOKEN || ""); if (u) await seenOwner(env, u);
      if (!u) return json({ ok: false, err: "Открой игру через бота в Telegram" }, 403);
      delete d.initData; delete d.gate; delete d.subOk; delete d.subWhy;
      if (name === "case" && d.free === "daily") {          // бесплатный кейс: условия из настроек
        const g = (await loadSettings(env)).freeGate;
        if (g && g.on) {
          d.gate = { on: true, shares: Math.max(0, Math.min(20, Math.round(+g.shares || 0))), channel: String(g.channel || "") };
          if (d.gate.channel) { const s = await isSub(env, d.gate.channel, u.id); d.subOk = s.ok; d.subWhy = s.why; }
        }
      }
      return json(await op(env, name, u.id, uname(u), d));
    }
    // ===== ЗАДАНИЯ: подписку на канал/чат и ссылку в био проверяем через Telegram =====
    if (path === "/api/task" && req.method === "POST") {
      let d; try { d = await req.json(); } catch { return json({ ok: false }, 400); }
      const u = await checkInitData(d.initData || "", env.BOT_TOKEN || ""); if (u) await seenOwner(env, u);
      if (!u) return json({ ok: false, err: "Открой игру через бота в Telegram" }, 403);
      const st = await loadSettings(env);
      const t = (st.tasks || DEF_TASKS).find(x => x.id === d.id && x.on);
      if (!t) return json({ ok: false, err: "Задание не найдено" });
      let verified = false, why = "";
      if (t.type === "channel" || t.type === "chat") {
        const m = String(t.url || "").match(/(?:t\.me\/|@)([A-Za-z0-9_]{4,})\/?$/);
        if (!m) why = "Админ: укажи в задании публичную ссылку вида t.me/канал";
        else {
          const r = await tg(env, "getChatMember", { chat_id: "@" + m[1], user_id: u.id });
          if (!r.ok) why = "Бот не может проверить подписку — админ, добавь бота админом в @" + m[1];
          else {
            const s = r.result.status;
            verified = ["creator", "administrator", "member"].includes(s) || (s === "restricted" && r.result.is_member);
            if (!verified) why = t.type === "chat" ? "Ты ещё не вступил в чат" : "Ты ещё не подписан на канал";
          }
        }
      } else if (t.type === "bio") {
        const r = await tg(env, "getChat", { chat_id: u.id });
        const bio = String((r.ok && r.result.bio) || "").toLowerCase().replace(/^https?:\/\//, "");
        const need = String(t.url || "").toLowerCase().replace(/^https?:\/\//, "").trim();
        verified = !!need && bio.includes(need);
        if (!verified) why = `В описании профиля (био) нет «${t.url}». Если только что добавил — подожди минуту и проверь снова`;
      }
      return json(await op(env, "task", u.id, uname(u), { id: t.id, verified, why }));
    }

    if (path.startsWith("/api/admin/") && req.method === "POST") {
      const name = path.slice(11);
      if (!ADMIN_OPS.has(name)) return json({ ok: false, err: "Неизвестное действие" }, 404);
      let d; try { d = await req.json(); } catch { return json({ ok: false }, 400); }
      const u = await checkInitData(d.initData || "", env.BOT_TOKEN || ""); if (u) await seenOwner(env, u);
      if (!u) return json({ ok: false, err: "Нет доступа" }, 403);
      delete d.initData;
      if (name === "bc_test") {      // пробное сообщение самому себе
        const ok = isOwner(u.username) || (await isAdminUser(env, u));
        if (!ok) return json({ ok: false, err: "Нет доступа" }, 403);
        const origin = (await getKey(env, "origin")) || url.origin, kb = [];
        if (d.btnText && d.btnUrl) kb.push([{ text: String(d.btnText).slice(0, 40), url: String(d.btnUrl) }]);
        if (d.play) kb.push([{ text: BUTTON_TEXT, web_app: { url: origin + "/" } }]);
        const r = await tg(env, "sendMessage", { chat_id: u.id, text: String(d.text || "").slice(0, 4000), disable_web_page_preview: true, ...(kb.length ? { reply_markup: { inline_keyboard: kb } } : {}) });
        return json(r.ok ? { ok: true } : { ok: false, err: "Telegram: " + (r.description || "ошибка") + (r.error_code === 403 ? " — сначала напиши боту /start" : "") });
      }
      // владелец — сразу; остальных админов проверяет само хранилище (без лишнего запроса)
      return json(await op(env, "admin/" + name, u.id, uname(u), d, isOwner(u.username) ? true : "check"));
    }

    // лента выигрышей: кто что выиграл
    if (path === "/api/tour" && req.method === "GET") {
      return json(await op(env, "tour", "0", "", {}, false));
    }
    if (path === "/api/feed" && req.method === "GET") {
      const raw = await (await store(env).fetch("https://s/feed")).text();
      return json(raw ? JSON.parse(raw).slice(0, 100) : []);
    }
    // всё остальное — сайт игры
    const res = await env.ASSETS.fetch(req);
    // подставляем настройки этой копии (владельцы, аккаунт для подарков, юзернейм бота) прямо в страницу
    const ct = res.headers.get("content-type") || "";
    if (res.ok && (ct.includes("text/html") || path.endsWith("logic.js"))) {
      let t = await res.text();
      const bn = await botName(env).catch(() => "");
      t = t.replace(/const OWNERS=\[[^\]]*\];/, "const OWNERS=" + JSON.stringify(OWNERS) + ";")
           .replace(/const GIFT_ACC='[^']*';/, "const GIFT_ACC=" + JSON.stringify(CONFIG.GIFT_ACC) + ";");
      if (bn) t = t.split("StrelaCase_bot").join(bn);
      const h = new Headers(res.headers); h.delete("content-length"); h.delete("etag"); h.set("cache-control", "no-cache");
      return new Response(t, { status: res.status, headers: h });
    }
    const out = new Response(res.body, res);
    out.headers.set("cache-control", "no-cache");
    return out;
  }
};
