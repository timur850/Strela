// STRELA CASE — серверная часть игр.
// Здесь хранятся баланс, билеты и подарки игроков, и здесь же решается результат каждой игры.
// Мини-апп только показывает анимацию того, что вернул сервер, поэтому подделать выигрыш нельзя.
import "./site/logic.js";
const { makeLogic, EGGS, PVP_BETS, SLOT_BET, SLOT_SYMS, CRASH_K, isStar } = globalThis.STRELA;

const MAX_BET = 1_000_000;
const BOTS = ["moana_sun", "kai.surf", "aloha_x", "ciloxik", "parfem1kh", "meawxxx09", "Darkol", "nemo777", "semmu", "vlad_ton"];
const GAME_NAMES = { case: "Кейс", egg: "Яйца", crash: "Краш", mines: "Мины", plinko: "Plinko", pvp: "PvP", slots: "Слоты", upgrade: "Апгрейд", contract: "Контракты" };

// честный случайный генератор (криптостойкий)
const rand = () => { const a = new Uint32Array(2); crypto.getRandomValues(a); return (a[0] * 2 ** 21 + (a[1] >>> 11)) / 2 ** 53; };
const randInt = n => Math.floor(rand() * n);
const bet = v => { const n = Math.round(Number(v)); return n >= 1 && n <= MAX_BET ? n : 0; };
class GameError extends Error {}
const fail = m => { throw new GameError(m); };

export class Game {
  constructor(storage) { this.s = storage; }

  async settings() {
    const raw = await this.s.get("settings");
    try { return typeof raw === "string" ? JSON.parse(raw || "{}") : (raw || {}); } catch { return {}; }
  }

  async user(uid, name) {
    let u = await this.s.get("u:" + uid);
    this.isNew = !u;
    if (!u) {
      const st = this.st;
      u = { name: name || "Игрок", bal: Math.max(0, Math.round(+st.startBal || 0)), tick: Math.max(0, Math.round(+st.startTick || 0)), inv: [], done: {}, daily: 0, t: Date.now() };
    }
    if (name) u.name = name;
    return u;
  }

  view(u) { return { bal: u.bal, tick: u.tick, inv: u.inv, done: u.done || {}, daily: u.daily || 0, refCount: u.refCount || 0, refEarn: u.refEarn || 0 }; }

  // рефералы: новый игрок пришёл по ссылке → пригласившему 5 🎫 (не больше 30 в день)
  async op_ref_bind(u, uid, d) {
    const ref = String(d.ref || "");
    if (!this.isNew || u.ref || !/^\d{3,15}$/.test(ref) || ref === uid) return {};
    const r = await this.s.get("u:" + ref); if (!r) return {};
    u.ref = ref;
    const day = new Date().toISOString().slice(0, 10);
    if (r.refDay !== day) { r.refDay = day; r.refDayTick = 0; }
    const t = Math.min(5, 30 - (r.refDayTick || 0));
    if (t > 0) { r.tick += t; r.refDayTick = (r.refDayTick || 0) + t; }
    r.refCount = (r.refCount || 0) + 1;
    await this.s.put("u:" + ref, r);
    return { bound: true };
  }
  // 10% от пополнений приглашённого — пригласившему
  async refBonus(u, amount) {
    if (!u.ref || !(amount > 0)) return;
    const b = Math.floor(amount * 0.1); if (!b) return;
    const r = await this.s.get("u:" + u.ref); if (!r) return;
    r.bal += b; r.refEarn = (r.refEarn || 0) + b;
    await this.s.put("u:" + u.ref, r);
  }

  async stat(k, v) {
    if (!v) return;
    const st = (await this.s.get("stats")) || { dep: 0, bets: 0, wins: 0 };
    st[k] = (st[k] || 0) + Math.round(v);
    await this.s.put("stats", st);
  }

  async feed(u, uid, game, gift, amount) {
    if (!(amount > 0)) return;
    const raw = await this.s.get("feed");
    const list = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
    list.unshift({ n: u.name, id: uid, g: game, s: gift && !isStar(gift) ? gift.slug : "", a: Math.round(amount), t: Date.now() });
    await this.s.put("feed", JSON.stringify(list.slice(0, 300)));
  }

  // списать ставку
  async charge(u, n) {
    if (!(n > 0)) fail("Неверная ставка");
    if (u.bal < n) fail("Недостаточно звёзд");
    u.bal -= n; await this.stat("bets", n);
  }
  // выдать выигрыш звёздами
  async payout(u, uid, n, game) {
    n = Math.round(n); if (!(n > 0)) return;
    u.bal += n; await this.stat("wins", n); await this.feed(u, uid, game, null, n);
  }
  // выдать подарок (звёзды — сразу на баланс)
  async giveGift(u, uid, g, game) {
    if (isStar(g)) return this.payout(u, uid, g.price, game);
    u.inv.push(g.slug); await this.stat("wins", g.price); await this.feed(u, uid, game, g, g.price);
  }
  invIndex(u, i, slug) {
    i = Number(i);
    if (!(Number.isInteger(i) && i >= 0 && i < u.inv.length) || (slug && u.inv[i] !== slug)) {
      const k = slug ? u.inv.indexOf(slug) : -1;
      if (k < 0) fail("Подарок не найден, обнови страницу");
      return k;
    }
    return i;
  }

  // ===== главная точка входа =====
  async run(op, uid, name, d, isAdmin) {
    this.st = await this.settings();
    this.L = makeLogic(() => this.st, rand);
    uid = String(uid);
    if (op.startsWith("admin/")) {
      if (!isAdmin) fail("Нет доступа");
      return this.admin(op.slice(6), d);
    }
    const u = await this.user(uid, name);
    const banned = (this.st.banned || []).map(String).includes(uid);
    if (banned && op !== "me") fail("Аккаунт заблокирован");
    const fn = this["op_" + op];
    if (!fn) fail("Неизвестное действие");
    const res = (await fn.call(this, u, uid, d || {})) || {};
    await this.s.put("u:" + uid, u);
    return { ok: true, ...res, me: this.view(u) };
  }

  op_me() { return {}; }

  // ---- кейсы ----
  async op_case(u, uid, d) {
    const L = this.L; let c;
    if (d.free === "daily" || d.free === "tick") {
      c = L.FREE(d.free);
      if (d.free === "tick") { if (u.tick < 10) fail("Нужно 10 🎫"); u.tick -= 10; }
      else { if (Date.now() - (u.daily || 0) < 864e5) fail("Кейс доступен раз в 24 часа"); u.daily = Date.now(); }
    } else {
      c = L.CASES().find(x => x.n === d.name);
      if (!c) fail("Кейс не найден");
      if ((this.st.off || {}).cases) fail("Игра выключена");
      await this.charge(u, c.p);
    }
    const g = L.caseGift(c);
    await this.giveGift(u, uid, g, "Кейс " + c.n);
    return { prize: g.slug };
  }

  // ---- яйца ----
  async op_egg(u, uid, d) {
    const price = Math.round(+d.price);
    if (!EGGS.some(e => e[2] === price)) fail("Нет такого яйца");
    if ((this.st.off || {}).eggs) fail("Игра выключена");
    await this.charge(u, price);
    const g = this.L.pickGift(price, this.L.R("eggs"));
    await this.giveGift(u, uid, g, GAME_NAMES.egg);
    return { prize: g.slug };
  }

  // ---- апгрейд ----
  async op_upgrade(u, uid, d) {
    const L = this.L, i = this.invIndex(u, d.i, d.slug);
    const a = L.giftBy(u.inv[i]), b = L.giftBy(String(d.target || ""));
    if (!a || !b || isStar(b) || !(b.price > a.price)) fail("Выбери подарок дороже своего");
    const ch = L.upChance(a.price, b.price);
    u.inv.splice(i, 1); await this.stat("bets", a.price);
    const won = rand() * 100 < ch;
    if (won) await this.giveGift(u, uid, b, GAME_NAMES.upgrade);
    return { won, chance: ch };
  }

  // ---- контракты ----
  async op_contract(u, uid) {
    const L = this.L;
    if (u.inv.length < 2) fail("Нужно минимум 2 подарка");
    const sum = u.inv.reduce((s, x) => s + ((L.giftBy(x) || {}).price || 0), 0);
    u.inv = []; await this.stat("bets", sum);
    const g = L.pickGift(sum, L.R("upgrade"));
    await this.giveGift(u, uid, g, GAME_NAMES.contract);
    return { prize: g.slug };
  }

  // ---- краш ----
  // У игрока со ставкой точка краша известна только серверу; клиент спрашивает «упало?» через crash_peek.
  async op_crash_bet(u, uid, d) {
    const k = "g:crash:" + uid, cur = await this.s.get(k), now = Date.now();
    if (cur && now < cur.t0 + Math.log(cur.at) / CRASH_K * 1000 + 500) fail("Ставка уже сделана");
    const v = bet(d.bet); if (!v) fail("Неверная ставка");
    await this.charge(u, v);
    const delay = Math.max(0, Math.min(6000, Math.round(+d.delay || 0)));
    await this.s.put(k, { bet: v, t0: now + delay, at: this.L.crashPoint() });
    return { t0: now + delay, now };
  }
  async op_crash_cash(u, uid, d) {
    const k = "g:crash:" + uid, g = await this.s.get(k), now = Date.now();
    if (!g) fail("Нет активной ставки");
    if (now < g.t0) fail("Раунд ещё не начался");
    const m = this.L.crashMult((now - g.t0) / 1000);
    await this.s.delete(k);
    if (m >= g.at) return { crashed: true, at: g.at };
    const shown = Number(d.m);
    const x = Math.max(1, shown >= 1 && shown < m ? shown : m);
    await this.payout(u, uid, g.bet * x, GAME_NAMES.crash);
    return { crashed: false, m: x, win: Math.round(g.bet * x) };
  }
  async op_crash_peek(u, uid) {
    const k = "g:crash:" + uid, g = await this.s.get(k), now = Date.now();
    if (!g) return { crashed: true, gone: true };
    const end = g.t0 + Math.log(g.at) / CRASH_K * 1000;
    if (now >= end) { await this.s.delete(k); return { crashed: true, at: g.at }; }
    return { crashed: false };
  }

  // ---- мины ----
  async op_mines_bet(u, uid, d) {
    const k = "g:mines:" + uid, old = await this.s.get(k);
    if (old) {                                   // брошенная игра: открытые клетки — забираем, ничего не открыто — возврат ставки
      await this.s.delete(k);
      if (old.open.length) await this.payout(u, uid, old.bet * this.L.minesMult(old.n, old.open.length), GAME_NAMES.mines);
      else { u.bal += old.bet; await this.stat("bets", -old.bet); }
    }
    const n = [3, 5, 7].includes(+d.n) ? +d.n : 5, v = bet(d.bet); if (!v) fail("Неверная ставка");
    await this.charge(u, v);
    const N = n * n, bombs = new Set(); while (bombs.size < this.L.minesBombs(n)) bombs.add(randInt(N));
    await this.s.put(k, { n, bet: v, bombs: [...bombs], open: [] });
    return {};
  }
  async op_mines_open(u, uid, d) {
    const k = "g:mines:" + uid, g = await this.s.get(k);
    if (!g) fail("Сначала сделай ставку");
    const i = Math.round(+d.i);
    if (!(i >= 0 && i < g.n * g.n)) fail("Неверная клетка");
    if (g.open.includes(i)) return { safe: true, mult: this.L.minesMult(g.n, g.open.length) };
    if (g.bombs.includes(i)) { await this.s.delete(k); return { safe: false, bombs: g.bombs }; }
    g.open.push(i);
    const mult = this.L.minesMult(g.n, g.open.length);
    if (g.open.length >= g.n * g.n - g.bombs.length) {           // открыл всё — забираем автоматически
      await this.s.delete(k); await this.payout(u, uid, g.bet * mult, GAME_NAMES.mines);
      return { safe: true, mult, done: true, win: Math.round(g.bet * mult), bombs: g.bombs };
    }
    await this.s.put(k, g);
    return { safe: true, mult };
  }
  async op_mines_cash(u, uid) {
    const k = "g:mines:" + uid, g = await this.s.get(k);
    if (!g) fail("Нет активной игры");
    if (!g.open.length) fail("Открой хотя бы одну клетку");
    const mult = this.L.minesMult(g.n, g.open.length);
    await this.s.delete(k); await this.payout(u, uid, g.bet * mult, GAME_NAMES.mines);
    return { mult, win: Math.round(g.bet * mult), bombs: g.bombs };
  }

  // ---- plinko ----
  async op_plinko(u, uid, d) {
    const risk = [0, 1, 2].includes(+d.risk) ? +d.risk : 0, v = bet(d.bet); if (!v) fail("Неверная ставка");
    await this.charge(u, v);
    const path = Array.from({ length: 8 }, () => rand() < .5 ? 1 : 0), k = path.reduce((a, b) => a + b, 0);
    const mult = this.L.PM(risk)[k];
    await this.payout(u, uid, v * mult, GAME_NAMES.plinko);
    return { path, k, mult, win: Math.round(v * mult) };
  }

  // ---- слоты ----
  async op_slots(u, uid) {
    await this.charge(u, SLOT_BET);
    const res = [0, 1, 2].map(() => SLOT_SYMS[randInt(SLOT_SYMS.length)]);
    const mult = this.L.slotsMult(res);
    await this.payout(u, uid, SLOT_BET * mult, GAME_NAMES.slots);
    return { res, mult, win: Math.round(SLOT_BET * mult) };
  }

  // ---- PvP (колесо с соперниками) ----
  async op_pvp(u, uid, d) {
    const v = Math.round(+d.bet); if (!PVP_BETS.includes(v)) fail("Неверная ставка");
    await this.charge(u, v);
    const names = [...BOTS].sort(() => rand() - .5), k = 1 + randInt(4);
    const players = [{ n: u.name, v, me: 1 }];
    for (let i = 0; i < k; i++) players.push({ n: names[i], v: [100, 250, 500, 1000, 2500][randInt(5)] });
    players.sort(() => rand() - .5);
    const bank = players.reduce((s, p) => s + p.v, 0);
    let r = rand() * bank, w = players.findIndex(p => (r -= p.v) < 0); if (w < 0) w = 0;
    const prize = Math.round(bank * (1 - (+this.st.pvpFee || 0) / 100));
    if (players[w].me) await this.payout(u, uid, prize, GAME_NAMES.pvp);
    return { players, winner: w, prize };
  }

  // ---- продажа подарков ----
  async op_sell(u, uid, d) {
    const i = this.invIndex(u, d.i, d.slug), g = this.L.giftBy(u.inv[i]);
    u.inv.splice(i, 1); u.bal += g ? g.price : 0;
    return { got: g ? g.price : 0 };
  }
  async op_sellall(u) {
    const s = u.inv.reduce((a, x) => a + ((this.L.giftBy(x) || {}).price || 0), 0);
    u.inv = []; u.bal += s; return { got: s };
  }

  // ---- задания → билеты ----
  async op_task(u, uid, d) {
    const t = (this.st.tasks || []).find(x => x.id === d.id && x.on);
    if (!t) fail("Задание не найдено");
    u.done = u.done || {};
    if (u.done[t.id]) return { got: 0 };
    u.done[t.id] = 1; const r = Math.max(0, Math.min(100, Math.round(+t.r || 0))); u.tick += r;
    return { got: r };
  }

  // ---- вывод подарка: убираем из инвентаря и создаём заявку ----
  async op_withdraw(u, uid, d) {
    const last = (await this.s.get("wd:" + uid)) || 0;
    if (Date.now() - Number(last) < 10000) fail("Подожди пару секунд");
    const i = this.invIndex(u, d.i, d.slug), g = this.L.giftBy(u.inv[i]);
    if (!g || isStar(g)) fail("Этот подарок нельзя вывести");
    u.inv.splice(i, 1);
    const id = Date.now().toString(36) + randInt(1e6).toString(36);
    await this.s.put("wdq:" + id, { id, uid, name: u.name, slug: g.slug, gname: g.name, price: g.price, t: Date.now(), st: "new" });
    await this.s.put("wd:" + uid, Date.now());
    return { wd: { id, slug: g.slug, name: g.name, price: g.price, tgid: g.tgid || null } };
  }
  async op_withdraw_done(u, uid, d) {           // бот сам отправил подарок — закрываем заявку
    const k = "wdq:" + d.id, w = await this.s.get(k);
    if (w && w.uid === uid) await this.s.delete(k);
    return {};
  }
  async op_withdraw_undo(u, uid, d) {           // уведомление не ушло — возвращаем подарок
    const k = "wdq:" + d.id, w = await this.s.get(k);
    if (!w || w.uid !== uid || w.st !== "new") return {};
    await this.s.delete(k); await this.s.delete("wd:" + uid); u.inv.push(w.slug);
    return {};
  }

  // ---- пополнения (зачисление только по подтверждённому платежу) ----
  async op_claim_stars(u, uid, d) {
    const key = "pay:" + String(d.payload || ""), raw = await this.s.get(key);
    if (!raw) return { wait: true };
    const p = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (p.uid !== uid) fail("Чужой платёж");
    if (p.claimed) return { got: 0, already: true };
    p.claimed = true; await this.s.put(key, JSON.stringify(p));
    u.bal += p.a; await this.stat("dep", p.a); await this.refBonus(u, p.a);
    return { got: p.a };
  }
  async op_credit_ton(u, uid, d) {          // вызывает только сервер после проверки сети
    const key = "ton:" + d.memo;
    if (await this.s.get(key)) return { got: 0, already: true };
    if (d.hash && await this.s.get("tonh:" + d.hash)) return { got: 0, already: true };
    const a = Math.max(0, Math.floor(+d.a || 0));
    await this.s.put(key, JSON.stringify({ uid, ton: d.ton, a, hash: d.hash, t: Date.now() }));
    if (d.hash) await this.s.put("tonh:" + d.hash, 1);
    u.bal += a; await this.stat("dep", a); await this.refBonus(u, a);
    return { got: a, ton: d.ton };
  }

  // ===== админка =====
  async admin(op, d) {
    const id = String(d.id || "").trim();
    const needId = () => { if (!/^\d{3,15}$/.test(id)) fail("Неверный ID"); };
    const save = async u => { await this.s.put("u:" + id, u); return { ok: true, user: { id, ...this.view(u), name: u.name } }; };
    if (op === "give") { needId(); const a = Math.round(+d.amount); if (!a) fail("Укажи количество"); const u = await this.user(id); u.bal = Math.max(0, u.bal + a); return save(u); }
    if (op === "tick") { needId(); const a = Math.round(+d.amount); if (!a) fail("Укажи количество"); const u = await this.user(id); u.tick = Math.max(0, u.tick + a); return save(u); }
    if (op === "gift") { needId(); const g = this.L.giftBy(String(d.slug || "")); if (!g) fail("Нет такого подарка"); const u = await this.user(id); if (isStar(g)) u.bal += g.price; else u.inv.push(g.slug); return save(u); }
    if (op === "stats") {
      const stats = (await this.s.get("stats")) || { dep: 0, bets: 0, wins: 0 };
      const all = await this.s.list({ prefix: "u:", limit: 1000 });
      const users = [...all.entries()].map(([k, u]) => ({ id: k.slice(2), name: u.name, bal: u.bal, tick: u.tick, inv: u.inv.length }));
      users.sort((a, b) => b.bal - a.bal);
      const wq = await this.s.list({ prefix: "wdq:", limit: 200 });
      return { ok: true, stats, users, withdrawals: [...wq.values()].sort((a, b) => b.t - a.t) };
    }
    if (op === "resetstats") { await this.s.put("stats", { dep: 0, bets: 0, wins: 0 }); return { ok: true }; }
    if (op === "wd_done") { const k = "wdq:" + String(d.wid || ""), w = await this.s.get(k); if (w) await this.s.delete(k); return { ok: true }; }
    fail("Неизвестное действие");
  }
}

export { GameError };
