// STRELA CASE — серверная часть игр.
// Здесь хранятся баланс, билеты и подарки игроков, и здесь же решается результат каждой игры.
// Мини-апп только показывает анимацию того, что вернул сервер, поэтому подделать выигрыш нельзя.
import "./site/logic.js";
const { makeLogic, DEF_TASKS, EGGS, SLOT_BET, SLOT_SYMS, CRASH_K, isStar } = globalThis.STRELA;
const REF_MIN_DEP = 15;   // со скольки ★ пополнения друга пригласивший получает 5 🎫

const MAX_BET = 1_000_000;
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

  view(u) { return { bal: u.bal, tick: u.tick, inv: u.inv, done: u.done || {}, daily: u.daily || 0, shares: u.shares || 0, refCount: u.refCount || 0, refEarn: u.refEarn || 0 }; }

  // рефералы: новый игрок пришёл по ссылке → привязываем. Билеты пригласившему — только когда друг пополнит от 50 ★
  // (защита от накрутки фейк-аккаунтами)
  async op_ref_bind(u, uid, d) {
    const ref = String(d.ref || "");
    if (!this.isNew || u.ref || !/^\d{3,15}$/.test(ref) || ref === uid) return {};
    const r = await this.s.get("u:" + ref); if (!r) return {};
    u.ref = ref;
    r.refCount = (r.refCount || 0) + 1;
    await this.s.put("u:" + ref, r);
    return { bound: true };
  }
  // 10% от пополнений приглашённого — пригласившему
  async refBonus(u, amount) {
    if (!u.ref || !(amount > 0)) return;
    u.depSum = (u.depSum || 0) + Math.round(amount);
    const r = await this.s.get("u:" + u.ref); if (!r) return;
    const b = Math.floor(amount * 0.1);
    if (b) { r.bal += b; r.refEarn = (r.refEarn || 0) + b; }
    if (!u.refPaid && u.depSum >= REF_MIN_DEP) {          // друг реально пополнил → 5 🎫 (не больше 30 в день)
      u.refPaid = 1;
      const day = new Date().toISOString().slice(0, 10);
      if (r.refDay !== day) { r.refDay = day; r.refDayTick = 0; }
      const t = Math.min(5, 30 - (r.refDayTick || 0));
      if (t > 0) { r.tick += t; r.refDayTick = (r.refDayTick || 0) + t; }
    }
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
    u.bal -= n; await this.stat("bets", n); await this.tourAdd(u, n);
  }
  // ===== турнир: недельный оборот ставок реальных игроков =====
  async tourGet() {
    const now = Date.now(); let t = await this.s.get("tour");
    if (!t || now >= t.end) {
      if (t && Object.keys(t.rows || {}).length) await this.s.put("tour:prev", t);
      t = { start: now, end: now + 7 * 864e5, rows: {} }; await this.s.put("tour", t);
    }
    return t;
  }
  async tourAdd(u, n) {
    if (!this.uid || !(n > 0)) return;
    const t = await this.tourGet(), r = t.rows[this.uid] || [u.name, 0];
    r[0] = u.name; r[1] += Math.round(n); t.rows[this.uid] = r;
    await this.s.put("tour", t);
  }
  async tourTop(k = 10) {
    const t = await this.tourGet();
    const top = Object.entries(t.rows).map(([id, [n, v]]) => ({ id, n, v })).sort((a, b) => b.v - a.v).slice(0, k);
    return { end: t.end, count: Object.keys(t.rows).length, top };
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
  async init() { this.st = await this.settings(); this.L = makeLogic(() => this.st, rand); }

  async run(op, uid, name, d, isAdmin) {
    await this.init();
    uid = String(uid);
    if (op.startsWith("pvp")) await this.pvpTick();   // до загрузки игрока: тик может начислить ему выигрыш
    if (op.startsWith("admin/")) {
      const ok = isAdmin === true || (isAdmin === "check" && (this.st.admins || []).map(String).includes(uid));
      if (!ok) fail("Нет доступа");
      return this.admin(op.slice(6), d, isAdmin === true);
    }
    if (op === "tour") return { ok: true, ...(await this.tourTop(10)) };
    this.uid = uid;
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
  // поделился ссылкой (для бесплатного кейса) — считаем, не больше 20
  async op_share(u) { u.shares = Math.min(20, (u.shares || 0) + 1); return { shares: u.shares }; }

  // ---- кейсы ----
  async op_case(u, uid, d) {
    const L = this.L; let c;
    if (d.free === "daily" || d.free === "tick") {
      c = L.FREE(d.free);
      if (d.free === "tick") { if (u.tick < 10) fail("Нужно 10 🎫"); u.tick -= 10; }
      else {
        const gate = d.gate;                      // условия ставит только сервер (worker), не клиент
        const hrs = Math.max(1, Math.min(168, +(gate && gate.hours) || 24));
        const left = (u.daily || 0) + hrs * 36e5 - Date.now();
        if (left > 0) fail(`Кейс доступен раз в ${hrs} ч — через ${Math.ceil(left / 6e4) >= 60 ? Math.ceil(left / 36e5) + " ч" : Math.ceil(left / 6e4) + " мин"}`);
        if (gate && gate.on) {
          if ((u.shares || 0) < gate.shares) fail(`Сначала поделись ссылкой в ${gate.shares} чата (${u.shares || 0}/${gate.shares})`);
          if (gate.channel && d.subOk !== true) fail(d.subWhy || "Подпишись на канал " + gate.channel);
        }
        u.daily = Date.now();                    // отправка в чаты нужна один раз — счётчик не сбрасываем
      }
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
    const roll = rand() * 100, won = roll < ch;              // где остановится стрелка колеса
    if (won) await this.giveGift(u, uid, b, GAME_NAMES.upgrade);
    return { won, chance: ch, roll };
  }

  // ---- контракты ----
  async op_contract(u, uid, d) {
    const L = this.L, items = Array.isArray(d.items) ? d.items.map(String) : [];
    if (items.length < 2) fail("Выбери минимум 2 подарка");
    if (items.length > 30) fail("Максимум 30 подарков за раз");
    const inv = [...u.inv];
    for (const s of items) { const k = inv.indexOf(s); if (k < 0) fail("Подарок не найден, обнови страницу"); inv.splice(k, 1); }
    const sum = items.reduce((s, x) => s + ((L.giftBy(x) || {}).price || 0), 0);
    u.inv = inv; await this.stat("bets", sum);
    const g = L.pickGift(sum, L.R("upgrade"));
    await this.giveGift(u, uid, g, GAME_NAMES.contract);
    return { prize: g.slug };
  }

  // ---- краш: один общий раунд для всех («онлайн») ----
  // Точку краша знает только сервер; игроки узнают её, когда раунд закончился.
  crashEnd(r) { return r.start + Math.log(r.at) / CRASH_K * 1000; }
  async crashRound() {
    const now = Date.now(); let r = await this.s.get("crash:cur");
    if (!r || now >= this.crashEnd(r) + 3000) {                  // 3 секунды паузы после краша
      if (r) { const h = (await this.s.get("crash:hist")) || []; h.unshift(r.at); await this.s.put("crash:hist", h.slice(0, 20)); }
      r = { id: now.toString(36) + randInt(1e4).toString(36), start: now + 6000, at: this.L.crashPoint(), players: [] };   // 6 секунд на ставки
      await this.s.put("crash:cur", r);
    }
    return r;
  }
  async op_crash_state(u, uid) {
    const r = await this.crashRound(), now = Date.now(), done = now >= this.crashEnd(r);
    const g = await this.s.get("g:crash:" + uid);
    const my = g && g.id === r.id ? { bet: g.bet } : null;
    const meP = r.players.find(p => p.id === uid);
    return { id: r.id, now, start: r.start, crashed: done ? r.at : null, hist: (await this.s.get("crash:hist")) || [],
      players: r.players.slice(-30).reverse().map(p => ({ n: p.n, v: p.v, m: p.m || 0, me: p.id === uid ? 1 : 0 })),
      my: my || (meP ? { bet: meP.v, out: meP.m || 0 } : null) };
  }
  async op_crash_bet(u, uid, d) {
    if ((this.st.off || {}).crash) fail("Игра выключена");
    const r = await this.crashRound(), now = Date.now();
    if (now > r.start - 300) fail("Ставки на этот раунд закрыты — подожди следующий");
    if (r.players.some(p => p.id === uid)) fail("Ставка уже сделана");
    const v = bet(d.bet); if (!v) fail("Неверная ставка");
    await this.charge(u, v);
    await this.s.put("g:crash:" + uid, { id: r.id, bet: v, t0: r.start, at: r.at });
    r.players.push({ id: uid, n: u.name, v }); await this.s.put("crash:cur", r);
    return { id: r.id };
  }
  async op_crash_cash(u, uid, d) {
    const k = "g:crash:" + uid, g = await this.s.get(k), r = await this.s.get("crash:cur"), now = Date.now();
    if (!g || !r || g.id !== r.id) fail("Нет активной ставки");
    if (now < g.t0) fail("Раунд ещё не начался");
    const m = this.L.crashMult((now - g.t0) / 1000);
    await this.s.delete(k);
    if (m >= g.at) return { crashed: true, at: g.at };
    const shown = Number(d.m);
    const x = Math.max(1, shown >= 1 && shown < m ? shown : m);
    await this.payout(u, uid, g.bet * x, GAME_NAMES.crash);
    const p = r.players.find(p => p.id === uid); if (p) { p.m = +x.toFixed(2); await this.s.put("crash:cur", r); }
    return { crashed: false, m: x, win: Math.round(g.bet * x) };
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

  // ---- PvP: настоящие игроки в одном общем раунде ----
  // Раунд стартует, когда ставку делает второй игрок: 20 секунд на ставки, потом колесо.
  // Шанс победы = доля ставки в банке. Если соперник не пришёл за 3 минуты — ставка возвращается.
  async creditUser(id, n, game) {
    const w = await this.s.get("u:" + id); if (!w) return;
    n = Math.round(n); w.bal += n; await this.stat("wins", n);
    await this.s.put("u:" + id, w); await this.feed(w, id, game, null, n);
  }
  async pvpTick() {
    const now = Date.now(), cur = await this.s.get("pvp:cur");
    if (!cur || !cur.players.length) return;
    if (cur.endAt && now >= cur.endAt) {
      const bank = cur.players.reduce((a, p) => a + p.v, 0);
      let r = rand() * bank, w = cur.players.findIndex(p => (r -= p.v) < 0); if (w < 0) w = 0;
      const prize = Math.round(bank * (1 - (+this.st.pvpFee || 0) / 100));
      await this.creditUser(cur.players[w].id, prize, GAME_NAMES.pvp);
      await this.s.put("pvp:last", { id: cur.id, players: cur.players, winner: w, prize, bank, at: now });
      await this.s.delete("pvp:cur");
    } else if (!cur.endAt && now - cur.t0 > 180000) {        // никто не пришёл — возврат
      for (const p of cur.players) { const w = await this.s.get("u:" + p.id); if (w) { w.bal += p.v; await this.s.put("u:" + p.id, w); } await this.stat("bets", -p.v); }
      await this.s.put("pvp:last", { id: cur.id, players: cur.players, winner: -1, refund: true, at: now });
      await this.s.delete("pvp:cur");
    }
  }
  // когда разбудить сервер: конец раунда или срок возврата
  async pvpDue() {
    const cur = await this.s.get("pvp:cur");
    if (!cur || !cur.players.length) return null;
    return cur.endAt || cur.t0 + 180000 + 500;
  }
  pvpView(r, uid) {
    if (!r) return null;
    return { id: r.id, players: r.players.map(p => ({ n: p.n, v: p.v, me: p.id === uid ? 1 : 0 })), winner: r.winner, prize: r.prize, refund: !!r.refund, at: r.at,
      endsIn: r.endAt ? Math.max(0, r.endAt - Date.now()) : null, waitLeft: !r.endAt && r.t0 ? Math.max(0, r.t0 + 180000 - Date.now()) : null };
  }
  async op_pvp_state(u, uid) {
    return { cur: this.pvpView(await this.s.get("pvp:cur"), uid), last: this.pvpView(await this.s.get("pvp:last"), uid), due: await this.pvpDue() };
  }
  async op_pvp(u, uid, d) {
    if ((this.st.off || {}).pvp) fail("Игра выключена");
    const v = bet(d.bet); if (!v || v < 10) fail("Минимальная ставка 10 ★");
    const now = Date.now();
    let cur = await this.s.get("pvp:cur");
    if (!cur) cur = { id: now.toString(36) + randInt(1e4).toString(36), t0: now, endAt: null, players: [] };
    if (cur.endAt && now > cur.endAt - 2000) fail("Колесо уже крутится — ставка в следующий раунд через пару секунд");
    if (cur.players.length >= 20 && !cur.players.some(p => p.id === uid)) fail("Раунд заполнен, подожди следующий");
    await this.charge(u, v);
    const me = cur.players.find(p => p.id === uid);
    if (me) { me.v += v; me.n = u.name; } else cur.players.push({ id: uid, n: u.name, v });
    if (!cur.endAt && cur.players.length >= 2) cur.endAt = now + 20000;
    await this.s.put("pvp:cur", cur);
    return { cur: this.pvpView(cur, uid), last: this.pvpView(await this.s.get("pvp:last"), uid), due: await this.pvpDue() };
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
  task(id) { return (this.st.tasks || DEF_TASKS).find(x => x.id === id && x.on); }
  async op_task_start(u, uid, d) {
    const t = this.task(d.id); if (!t) return {};
    u.tstart = u.tstart || {}; if (!u.tstart[t.id]) u.tstart[t.id] = Date.now();
    return {};
  }
  // зовёт только сервер: подписку и био он уже проверил через Telegram
  async op_task(u, uid, d) {
    const t = this.task(d.id);
    if (!t) fail("Задание не найдено");
    u.done = u.done || {};
    if (u.done[t.id]) return { got: 0 };
    if (["channel", "chat", "bio"].includes(t.type) && d.verified !== true) fail(d.why || "Задание не выполнено");
    if (["story", "link"].includes(t.type)) {
      const st = (u.tstart || {})[t.id];
      if (!st) fail("Сначала нажми «Начать»");
      if (Date.now() - st < 15000) fail("Выполни задание и вернись через пару секунд");
    }
    u.done[t.id] = 1; const r = Math.max(0, Math.min(100, Math.round(+t.r || 0))); u.tick += r;
    return { got: r };
  }

  // ---- вывод подарка: убираем из инвентаря и создаём заявку ----
  async op_withdraw(u, uid, d) {
    const last = (await this.s.get("wd:" + uid)) || 0;
    if (Date.now() - Number(last) < 10000) fail("Подожди пару секунд");
    const i = this.invIndex(u, d.i, d.slug), g = this.L.giftBy(u.inv[i]);
    if (!g || isStar(g)) fail("Этот подарок нельзя вывести");
    const minWd = Math.max(0, Math.round(this.st.minWd ?? 50));
    if (g.price < minWd) fail(`Вывод — от ${minWd} ★. Этот подарок можно продать`);
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
  async admin(op, d, owner) {
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
      const j = await this.s.get("bc:job");
      const bc = j ? { total: j.ids.length, sent: j.sent, failed: j.failed, done: j.done, stopped: !!j.stopped, text: j.text.slice(0, 80), t: j.t } : null;
      const aud = new Set(users.map(u => u.id));
      for (const k of (await this.s.list({ prefix: "bu:", limit: 50000 })).keys()) aud.add(k.slice(3));
      return { ok: true, stats, users, withdrawals: [...wq.values()].sort((a, b) => b.t - a.t), bc, audience: aud.size };
    }
    if (op === "bc_start") {
      const text = String(d.text || "").trim().slice(0, 4000);
      if (!text) fail("Напиши текст рассылки");
      const cur = await this.s.get("bc:job");
      if (cur && !cur.done) fail("Предыдущая рассылка ещё идёт");
      const ids = new Set();
      for (const p of ["u:", "bu:"]) for (const k of (await this.s.list({ prefix: p, limit: 50000 })).keys()) { const id = k.slice(p.length); if (/^\d+$/.test(id)) ids.add(id); }
      let btnUrl = String(d.btnUrl || "").trim();
      if (btnUrl && !/^https?:\/\//i.test(btnUrl)) btnUrl = "https://" + btnUrl;
      const job = { text, btnText: String(d.btnText || "").trim().slice(0, 40), btnUrl, play: !!d.play, ids: [...ids], pos: 0, sent: 0, failed: 0, done: false, t: Date.now(), next: Date.now() };
      await this.s.put("bc:job", job);
      return { ok: true, total: job.ids.length };
    }
    if (op === "bc_stop") { const j = await this.s.get("bc:job"); if (j && !j.done) { j.done = true; j.stopped = true; j.finished = Date.now(); await this.s.put("bc:job", j); } return { ok: true }; }
    if (op === "resetall") {   // обнулить баланс/билеты у всех + вся статистика (только владельцы)
      if (!owner) fail("Только для владельца");
      let n = 0, after;
      for (;;) {
        const page = await this.s.list({ prefix: "u:", limit: 500, ...(after ? { startAfter: after } : {}) });
        if (!page.size) break;
        const batch = {};
        for (const [k, u] of page) { u.bal = 0; u.tick = 0; u.refEarn = 0; batch[k] = u; after = k; n++; }
        const keys = Object.keys(batch);
        for (let i = 0; i < keys.length; i += 128) await this.s.put(Object.fromEntries(keys.slice(i, i + 128).map(k => [k, batch[k]])));
        if (page.size < 500) break;
      }
      await this.s.put("stats", { dep: 0, bets: 0, wins: 0 });
      await this.s.delete("feed");
      await this.s.delete(["tour", "tour:prev"]);
      return { ok: true, users: n };
    }
    if (op === "resettour") { await this.s.delete(["tour", "tour:prev"]); return { ok: true }; }
    if (op === "resetstats") { await this.s.put("stats", { dep: 0, bets: 0, wins: 0 }); return { ok: true }; }
    if (op === "wd_count") return { ok: true, n: (await this.s.list({ prefix: "wdq:", limit: 500 })).size };
    if (op === "wd_done") { const k = "wdq:" + String(d.wid || ""), w = await this.s.get(k); if (w) await this.s.delete(k); return { ok: true }; }
    fail("Неизвестное действие");
  }
}

export { GameError };
