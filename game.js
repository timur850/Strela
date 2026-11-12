// STRELA CASE — серверная часть игр.
// Здесь хранятся баланс, билеты и подарки игроков, и здесь же решается результат каждой игры.
// Мини-апп только показывает анимацию того, что вернул сервер, поэтому подделать выигрыш нельзя.
import "./site/logic.js";
const { makeLogic, DEF_TASKS, EGGS, SLOT_BET, SLOT_SYMS, CRASH_K, isStar, LEVELS, CHICK_D } = globalThis.STRELA;
// онлайн по играм: кто был в игре за последние 5 минут (в памяти, без записи в базу)
const ONLINE = new Map(), ON_TTL = 5 * 60e3;
const FEED_MIN = 50;
const feedOk = (gift, amount) => (gift && !isStar(gift) && !gift.reg) || amount >= FEED_MIN;
const GIFT_BET_OPS = new Set(["crash_bet", "mines_bet", "plinko", "chick_bet"]);
const OP_GAME = { case: "cases", crash_bet: "crash", crash_cash: "crash", crash_state: "crash", mines_bet: "mines", mines_open: "mines", mines_cash: "mines", plinko: "plinko", slots: "slots", chick_bet: "chick", chick_step: "chick", chick_cash: "chick", upgrade: "upgrade", contract: "contracts", egg: "eggs", dig: "dig", pvp: "pvp", pvp_state: "pvp", drop: "drop", hunt_claim: "hunt", hunt_state: "hunt" };
const GAME_IDS = new Set(["app", "chick", "cases", "crash", "mines", "plinko", "slots", "upgrade", "contracts", "eggs", "dig", "pvp", "drop", "hunt", "earn", "free"]);
function onMark(g, uid, staff) { if (staff || !GAME_IDS.has(g) || !uid || uid === "0") return; let m = ONLINE.get(g); if (!m) ONLINE.set(g, m = new Map()); m.set(String(uid), Date.now()); }
function onCounts() { const now = Date.now(), o = {}; for (const [g, m] of ONLINE) { for (const [u, t] of m) if (now - t > ON_TTL) m.delete(u); if (m.size) o[g] = m.size; } return o; }
const REF_MIN_DEP = 15;   // со скольки ★ пополнения друга пригласивший получает 5 🎫
const REF_STEP = 10;   // реф-кейс Friends: 1-й вывод выигрыша — 10 друзей с NFT или Premium, 2-й — 20, 3-й — 30…
const TICKET_CASE = 1;     // сколько 🎫 стоит кейс за билеты
const FREE_NFT_REFS = 5;  // NFT из ежедневного кейса выводится после стольких приглашённых  // сколько друзей с NFT или уровнем 2+ нужно для кейса Friends

const MAX_BET = 1_000_000;
const GAME_NAMES = { dig: "Шахта", case: "Кейс", egg: "Яйца", crash: "Краш", mines: "Мины", plinko: "Plinko", chick: "Цыпа", pvp: "PvP", slots: "Слоты", upgrade: "Апгрейд", contract: "Контракты" };

// честный случайный генератор (криптостойкий)
const rand = () => { const a = new Uint32Array(2); crypto.getRandomValues(a); return (a[0] * 2 ** 21 + (a[1] >>> 11)) / 2 ** 53; };
const randInt = n => Math.floor(rand() * n);
const bet = v => { const n = Math.round(Number(v)); return n >= 1 && n <= MAX_BET ? n : 0; };
class GameError extends Error {}
const fail = m => { throw new GameError(m); };

const KYIV = "Europe/Kyiv";
function kyivOff(t) { try { const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: KYIV, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(t).map(x => [x.type, +x.value])); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000; } catch { return 0; } }
function monthBounds(t = Date.now()) {          // [начало месяца, начало следующего] по Киеву
  const k = new Date(t + kyivOff(t)), y = k.getUTCFullYear(), m = k.getUTCMonth();
  const at = (yy, mm) => { const g = Date.UTC(yy, mm, 1); return g - kyivOff(g - kyivOff(g)); };
  return [at(y, m), at(y, m + 1)];
}
function dayKey(t = Date.now()) { try { return new Date(t).toLocaleDateString("sv-SE", { timeZone: KYIV }); } catch { return new Date(t).toISOString().slice(0, 10); } }
// неделя с понедельника 00:00 UTC
function weekStart(t = Date.now()) { const d = new Date(t); const day = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day); }
const weekKey = () => new Date(weekStart()).toISOString().slice(0, 10), weekEnd = () => weekStart() + 7 * 864e5;
// до полуночи по Киеву
function dayEnd(t = Date.now()) { try { const [h, m, s] = new Intl.DateTimeFormat("en-GB", { timeZone: KYIV, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(t).split(":").map(Number); return t + (86400 - h * 3600 - m * 60 - s) * 1000; } catch { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); } }
const DROP_PRIZES = [[5, 40], [10, 30], [15, 15], [25, 10], [50, 5]];   // [звёзд, вес]
/* ===== охота за сокровищами: у каждого игрока свои 5 тайников, каждую неделю новые ===== */
const HUNT_EMO = ["🐚", "🦪", "🐙", "🦀", "⭐"];
const HUNT_PRIZES = [[10, 45], [15, 30], [25, 18], [50, 7]];
const pick = a => a[randInt(a.length)];
const HUNT_TYPES = {
  case:     L => { const C = L.CASES().filter(c => c.p > 0 && c.p <= 1500); const c = pick(C.length ? C : L.CASES()); return { name: c.n }; },
  dig:      () => ({ depth: pick([6, 10, 14]) }),
  crash:    () => ({ m: pick([2, 2.5, 3]) }),
  mines:    () => ({ k: pick([3, 4, 5]) }),
  plinko:   () => ({}),
  upgrade:  () => ({ max: pick([40, 50, 60]) }),
  egg:      () => { const e = pick(EGGS); return { price: e[2] }; },
  contract: () => ({ n: pick([3, 4]) }),
  slots:    () => ({}),
};
/* понятное задание: что именно сделать (без загадок и без везения — выполнил условие, сокровище твоё) */
const HUNT_TXT = {
  case: s => `Открой кейс «${s.name}»`, dig: s => `Шахта: докопай до глубины ${s.depth} м`, crash: s => `Краш: забери ставку на ×${s.m} или выше`,
  mines: s => `Мины: открой ${s.k} ${s.k < 5 ? "клетки" : "клеток"} и забери выигрыш`, plinko: () => "Плинко: попади шариком в крайнюю лунку (слева или справа)",
  upgrade: s => `Апгрейд: выиграй с шансом ${s.max}% или меньше`, egg: s => `Кокосы: открой кокос за ★ ${s.price}`,
  contract: s => `Контракт: обменяй сразу ${s.n} подарка или больше`, slots: () => "Слоты: собери 3 одинаковых символа",
};
const HUNT_GO = { case: "cases", dig: "dig", crash: "crash", mines: "mines", plinko: "plinko", upgrade: "upgrade", egg: "eggs", contract: "contracts", slots: "slots" };
const HUNT_CHECK = {
  case: (s, e) => e.name === s.name, dig: (s, e) => e.depth >= s.depth, crash: (s, e) => e.m >= s.m, mines: (s, e) => e.open >= s.k,
  plinko: (s, e) => e.k <= 1 || e.k >= 7, upgrade: (s, e) => e.won && e.chance <= s.max, egg: (s, e) => e.price === s.price,
  contract: (s, e) => e.n >= s.n, slots: (s, e) => e.three,
};

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

  view(u) { return { bal: u.bal, tick: u.tick, inv: u.inv, done: u.done || {}, daily: u.daily || 0, shares: u.shares || 0, freeLock: u.freeLock || [], refQ: u.refQ || 0, refDaily: u.refDaily || 0, refD: { ref: u.refDaily || 0, ...(u.refD || {}) }, promoCase: u.promoCase || 0, refLock: u.refLock || [], refF: u.refF || 0, refNeed: REF_STEP * ((u.refWd || 0) + 1), refPaid: u.refPaid || 0, refMe: u.ref ? (u.refq ? 1 : 0) : -1, refWdFee: this.st.rwdFee ?? 150, refCount: u.refCount || 0, refEarn: u.refEarn || 0, fdbOk: this.fdbOk(u), hunt: this.huntView(u), ps: u.ps || null, lvl: u.lvl || 0, nick: u.nick || null, hist: u.hist || [] }; }

  // рефералы: новый игрок пришёл по ссылке → привязываем. Билеты пригласившему — только когда друг пополнит от 50 ★
  // (защита от накрутки фейк-аккаунтами)
  async op_ref_bind(u, uid, d) {
    const ref = String(d.ref || "");
    if (!this.isNew || u.ref || !/^\d{3,15}$/.test(ref) || ref === uid) return {};
    const r = await this.s.get("u:" + ref); if (!r) return {};
    u.ref = ref;
    r.refCount = (r.refCount || 0) + 1;
    if (r.refCount % 3 === 0) {                     // каждые 3 приглашённых — 1 🎫 (не больше 10 в день)
      const day = new Date().toISOString().slice(0, 10);
      if (r.refDay !== day) { r.refDay = day; r.refDayTick = 0; }
      if ((r.refDayTick || 0) < 10) { r.tick += 1; r.refDayTick = (r.refDayTick || 0) + 1; }
    }
    r.refs = (r.refs || []).concat(uid).slice(-300);   // список приглашённых — для кейса Friends
    await this.s.put("u:" + ref, r);
    return { bound: true };
  }
  // 10% от пополнений приглашённого — пригласившему
  // бонус за первое пополнение: один раз, только с настоящего платежа (звёзды / TON / CryptoBot)
  fdbCfg() { const c = this.st.fdb || {}; return { on: c.on !== false, min: Math.max(1, +c.min || 100), pct: Math.max(0, Math.min(100, +c.pct || 10)), max: Math.max(0, +c.max || 300) }; }
  fdbOk(u) { return !u.fdb && !(u.depSum > 0 && !u.depN); }      // кто пополнял ещё до этой функции — не считается «первым»
  depDone(u, a) {
    const c = this.fdbCfg(); let b = 0;
    if (c.on && this.fdbOk(u) && a >= c.min) {
      b = Math.min(c.max, Math.floor(a * c.pct / 100));
      u.fdb = Date.now();
      if (b > 0) { u.bal += b; this.hist(u, { k: "dep", m: "bonus", a: b }); }
    }
    u.depN = (u.depN || 0) + 1; if (u.depTot != null) u.depTot += Math.round(a);
    return b;
  }
  async refBonus(u, amount) {
    if (!u.ref || !(amount > 0)) return;
    u.depSum = (u.depSum || 0) + Math.round(amount);
    const r = await this.s.get("u:" + u.ref); if (!r) return;
    const b = Math.floor(amount * 0.1);
    if (b) { r.bal += b; r.refEarn = (r.refEarn || 0) + b; }
    await this.s.put("u:" + u.ref, r);
  }

  async stat(k, v) {
    if (!v || this.isStaff) return;
    const st = (await this.s.get("stats")) || { dep: 0, bets: 0, wins: 0 };
    st[k] = (st[k] || 0) + Math.round(v);
    await this.s.put("stats", st);
    const dk = "sd:" + dayKey(), dd = (await this.s.get(dk)) || {};   // то же по дням — для графиков в админке
    dd[k] = (dd[k] || 0) + Math.round(v); await this.s.put(dk, dd);
  }

  // статистика по отдельной игре: сколько раз играли, сколько выиграли, сколько поставили и выплатили
  async gstat(game, betSum, paid) {
    if (this.isStaff) return;
    const all = (await this.s.get("gstats")) || {};
    const g = all[game] || (all[game] = { n: 0, w: 0, bet: 0, pay: 0 });
    g.n++; if (paid > 0) g.w++;
    g.bet += Math.round(betSum); g.pay += Math.round(paid);
    await this.s.put("gstats", all);
  }
  // аналитика по играм по дням (Киев): gd:YYYY-MM-DD → { game: [игр, ставки, выплаты] } + gd:all за всё время
  gameKey(op, d) {
    if (op === "case") return d && d.free ? (d.free === "ref" ? "ref" : "free") : "case";
    const m = /^(crash|mines|chick|pvp|hunt)/.exec(op || ""); if (m) return m[1];
    if (["dig", "egg", "upgrade", "contract", "plinko", "slots"].includes(op)) return op;
    return "bonus";                                // уровни, задания, промо, дроп, заработок — раздача без ставки
  }
  async gday(bet, pay, gk = this._gk) {
    if (this.isStaff || !gk || !(bet || pay > 0)) return;
    for (const k of ["gd:" + dayKey(), "gd:all"]) {
      const o = (await this.s.get(k)) || {}, r = o[gk] || (o[gk] = [0, 0, 0]);
      if (bet) { r[0] += bet > 0 ? 1 : -1; r[1] += Math.round(bet); }   // отрицательная ставка — возврат
      if (pay > 0) r[2] += Math.round(pay);
      await this.s.put(k, o);
    }
  }

  async feed(u, uid, game, gift, amount) {
    if (!(amount > 0) || this.isStaff) return;
    if (!feedOk(gift, amount)) return;                 // в LIVE: только от 50 ★ и любые NFT
    const raw = await this.s.get("feed");
    const list = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
    list.unshift({ n: u.name, id: uid, g: game, s: gift && !isStar(gift) ? gift.slug : "", a: Math.round(amount), t: Date.now() });
    await this.s.put("feed", JSON.stringify(list.slice(0, 300)));
  }

  // списать ставку
  async charge(u, n) {
    if (!(n > 0)) fail("Неверная ставка");
    if (u.bal < n) fail("Недостаточно звёзд");
    u.bal -= n; await this.stat("bets", n); await this.gday(n, 0); await this.tourAdd(u, n);
    const ps = u.ps || (u.ps = { t: 0, g: 0, w: 0, best: null, fav: {} });   // личная статистика игрока
    ps.t += Math.round(n); ps.g++; const op = this._op || "?"; ps.fav[op] = (ps.fav[op] || 0) + 1;
  }
  async depTotal(u, uid) {                        // сколько ★ игрок пополнил реальными платежами (кэш в u.depTot)
    if (u.depTot != null) return u.depTot;
    let sum = 0;
    for (const pre of ["pay:", "ton:", "cp:"]) {
      let after = null;
      for (let k = 0; k < 30; k++) {
        const page = await this.s.list({ prefix: pre, limit: 1000, ...(after ? { startAfter: after } : {}) });
        for (const [, raw] of page) { const x = typeof raw === "string" ? JSON.parse(raw) : raw; if (x && String(x.uid) === String(uid) && (pre !== "pay:" || x.claimed !== false)) sum += +x.a || 0; }
        if (page.size < 1000) break; after = [...page.keys()].pop();
      }
    }
    u.depTot = sum; return sum;
  }
  refLocked(u, slug) { const lk = (u.refLock || []).filter(s => s === slug).length; return lk > 0 && lk >= u.inv.filter(s => s === slug).length; }
  noRefLock(u, slug) { if (this.refLocked(u, slug)) fail("Подарок из реф-кейса можно только вывести — продать, поставить или обменять его нельзя"); }
  // друг засчитывается для вывода из реф-кейса: пришёл по ссылке, открыл реф-кейс в мини-аппе, есть Telegram Premium или NFT
  // ===== мульти-аккаунты: одно устройство (метка в мини-аппе) или один IP (хэш, сам IP не храним) =====
  async track(u, uid, d) {
    if (this.isStaff || !d) return;
    for (const [t, h] of [["dv", d._dv], ["ip", d._ip]]) {
      if (!h || !/^[a-z0-9]{6,32}$/i.test(h)) continue;
      const key = t + "H", arr = u[key] || (u[key] = []);
      if (arr.includes(h)) continue;
      u[key] = [h, ...arr].slice(0, t === "ip" ? 8 : 4);
      const ik = "ix:" + t + ":" + h, ix = (await this.s.get(ik)) || [];
      if (!ix.includes(uid)) { ix.push(uid); await this.s.put(ik, ix.slice(-40)); }
    }
  }
  async linked(u, uid) {                          // { другой uid: {dv, ip} }
    const out = {};
    for (const t of ["dv", "ip"]) for (const h of u[t + "H"] || []) {
      const ix = (await this.s.get("ix:" + t + ":" + h)) || [];
      if (t === "ip" && ix.length > 15) continue;  // общий IP оператора/кафе — не улика
      for (const o of ix) if (o !== uid) (out[o] = out[o] || {})[t] = 1;
    }
    return out;
  }
  async multiRef(u, uid) {                        // приглашённый — тот же человек, что пригласивший?
    if (!u.ref) return "";
    const l = (await this.linked(u, uid))[u.ref];
    return l ? (l.dv ? "одно устройство" : "один IP") : "";
  }
  async refFreeCount(u) {
    if (!u.ref || !u.refq || !u.rOpen || u.refFc) return;
    if (u.refMul || (u.refMul = await this.multiRef(u, this.uid))) return;
    const r = await this.s.get("u:" + u.ref); if (!r) return;
    u.refFc = 1; u.refFcAt = Date.now(); r.refF = (r.refF || 0) + 1; await this.s.put("u:" + u.ref, r);
  }
  lockedTake(u, slug) {                           // забирает из инвентаря «заблокированный» экземпляр? (NFT из бесплатного кейса)
    const lk = (u.freeLock || []).filter(s => s === slug).length, have = u.inv.filter(s => s === slug).length;
    if (lk && lk >= have) { u.freeLock.splice(u.freeLock.indexOf(slug), 1); return true; }
    return false;
  }
  async unBet(u, uid, n) {                         // возврат ставки — убираем её и из оборота турнира / статистики игрока
    n = Math.round(n); if (!(n > 0) || !uid) return;
    const t = await this.tourGet(), r = t.rows[uid]; if (r) { r[1] = Math.max(0, r[1] - n); if (!r[1]) delete t.rows[uid]; await this.s.put("tour", t); }
    if (u.ps) { u.ps.t = Math.max(0, u.ps.t - n); u.ps.g = Math.max(0, u.ps.g - 1); }
  }
  async betNoCharge(u, n) {                       // ставка подарком (апгрейд, контракт): в оборот игрока и турнир
    n = Math.round(n); if (!(n > 0)) return; await this.gday(n, 0); await this.tourAdd(u, n);
    const ps = u.ps || (u.ps = { t: 0, g: 0, w: 0, best: null, fav: {} });
    ps.t += n; ps.g++; const op = this._op || "?"; ps.fav[op] = (ps.fav[op] || 0) + 1;
  }
  psWin(u, v, slug, game) {
    const ps = u.ps || (u.ps = { t: 0, g: 0, w: 0, best: null, fav: {} });
    ps.w++; if (!ps.best || v > ps.best.v) ps.best = { v: Math.round(v), s: slug || "", g: game || "" };
  }
  hist(u, e) { u.hist = [{ ...e, t: Date.now() }, ...(u.hist || [])].slice(0, 40); }
  // ===== турнир: недельный оборот ставок реальных игроков =====
  async tourGet() {                              // турнир на календарный месяц (по Киеву), топ-3 получают подарки
    const now = Date.now(); let t = await this.s.get("tour");
    if (t && !t.monthly && now < t.end) { const [ms, me] = monthBounds(now); t.start = ms; t.end = me; t.monthly = 1; await this.s.put("tour", t); }
    if (!t || now >= t.end) {
      if (t && Object.keys(t.rows || {}).length) {
        const P = this.tourPrizes(), cand = Object.entries(t.rows).filter(([id]) => !this.isStaffId(id)).map(([id, [n, v]]) => ({ id, n, v })).sort((a, b) => b.v - a.v), top = [];
        for (const c of cand) { if (top.length >= P.length) break; const w = await this.s.get("u:" + c.id); if (w && (await this.depTotal(w, c.id)) > 0) { await this.s.put("u:" + c.id, w); top.push(c); } }   // призы — только тем, кто пополнял
        t.won = [];
        for (let i = 0; i < top.length; i++) {          // призы — сразу в инвентарь победителям
          const w = await this.s.get("u:" + top[i].id); if (!w) continue;
          (w.inv = w.inv || []).push(P[i]); await this.s.put("u:" + top[i].id, w);
          t.won.push({ ...top[i], prize: P[i], place: i + 1 });
        }
        await this.s.put("tour:prev", t);
      }
      const [ms, me] = monthBounds(now);
      t = { start: ms, end: me, rows: {}, monthly: 1 }; await this.s.put("tour", t);
    }
    return t;
  }
  tourPrizes() { const p = Array.isArray(this.st.tourPrizes) && this.st.tourPrizes.length ? this.st.tourPrizes : ["mythmask", "jinglebells", "snowmittens"]; return p.filter(x => this.L.giftBy(x)).slice(0, 10); }
  async tourAdd(u, n) {
    if (!this.uid || !(n > 0) || this.isStaff || (this.st.tourBan || []).map(String).includes(String(this.uid))) return;
    const t = await this.tourGet(), r = t.rows[this.uid] || [u.name, 0];
    r[0] = u.name; r[1] += Math.round(n); t.rows[this.uid] = r;
    await this.s.put("tour", t);
  }
  // итоги прошлой недели (если неделя кончилась, а новую ещё никто не начал — берём её)
  async tourPrev(k = 50) {
    let t = await this.s.get("tour");
    if (!t || Date.now() < t.end) t = await this.s.get("tour:prev");
    if (!t || !t.rows) return null;
    const top = Object.entries(t.rows).filter(([id]) => !this.isStaffId(id)).map(([id, [n, v]]) => ({ id, n, v })).sort((a, b) => b.v - a.v).slice(0, k);
    return { start: t.start, end: t.end, count: Object.keys(t.rows).length, top, won: t.won || [] };
  }
  async tourTop(k = 10) {
    const t = await this.tourGet();
    const top = Object.entries(t.rows).filter(([id]) => !this.isStaffId(id)).map(([id, [n, v]]) => ({ id, n, v })).sort((a, b) => b.v - a.v).slice(0, k);
    return { end: t.end, count: Object.keys(t.rows).length, top };
  }
  // выдать выигрыш звёздами
  async payout(u, uid, n, game) {
    n = Math.round(n); if (!(n > 0)) return;
    u.bal += n; await this.stat("wins", n); await this.gday(0, n); await this.feed(u, uid, game, null, n); this.psWin(u, n, "", game);
  }
  // выдать подарок (звёзды — сразу на баланс)
  async giveGift(u, uid, g, game) {
    if (isStar(g)) return this.payout(u, uid, g.price, game);
    u.inv.push(g.slug); await this.stat("wins", g.price); await this.gday(0, g.price); await this.feed(u, uid, game, g, g.price); this.psWin(u, g.price, g.slug, game);
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
  async init() {
    this.st = await this.settings(); this.L = makeLogic(() => this.st, rand);
    // персонал (владельцы + админы): их игра не идёт в статистику, турнир, ленту, онлайн и общие фонды
    const own = await this.s.list({ prefix: "ownerchat:" });
    this.staff = new Set([...(this.st.admins || []).map(String), ...[...own.values()].map(String)]);
  }
  isStaffId(id) { return !!this.staff && this.staff.has(String(id)); }

  async run(op, uid, name, d, isAdmin) {
    await this.init();
    uid = String(uid);
    if (op.startsWith("pvp")) await this.pvpTick();   // до загрузки игрока: тик может начислить ему выигрыш
    this.isStaff = false;
    if (op.startsWith("admin/")) {
      const ok = isAdmin === true || (isAdmin === "check" && (this.st.admins || []).map(String).includes(uid));
      if (!ok) fail("Нет доступа");
      return this.admin(op.slice(6), d, isAdmin === true);
    }
    if (op === "nick_due") {                       // кого перепроверить по тегу в нике (раз в 4 ч на игрока)
      const now = Date.now(), ids = [];
      for (const [k, t] of await this.s.list({ prefix: "nk:" })) { if (+t <= now) ids.push(k.slice(3)); if (ids.length >= 25) break; }
      return { ok: true, ids };
    }
    if (op === "nick_drop") {                      // тег убран — сбросить прогресс
      const u = await this.s.get("u:" + d.id); await this.s.delete("nk:" + d.id);
      if (u && u.nick) { u.nick = null; await this.s.put("u:" + d.id, u); return { ok: true, dropped: true }; }
      return { ok: true };
    }
    if (op === "nick_ok") { await this.s.put("nk:" + d.id, Date.now() + 4 * 36e5); return { ok: true }; }
    if (op === "remind_due") {                    // кому пора напомнить про бесплатный кейс (вызывает только cron)
      if (this.st.remind === false) return { ok: true, ids: [] };
      const now = Date.now(), ids = [], del = [];
      for (const k of (await this.s.list({ prefix: "rem:", limit: 40 })).keys()) {
        const [, t, id] = k.split(":"); if (+t > now) break;
        del.push(k); if (now - +t < 6 * 36e5) ids.push(id);          // старше 6 ч — не шлём (бот был выключен и т.п.)
      }
      if (del.length) await this.s.delete(del);
      const raw = await this.s.get("feed"), list = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
      const best = list.filter(e => now - e.t < 6 * 36e5 && !this.isStaffId(e.id) && feedOk(e.s ? this.L.giftBy(e.s) : null, e.a))
        .sort((a, b) => (b.s ? 1 : 0) - (a.s ? 1 : 0) || b.a - a.a)[0] || null;
      return { ok: true, ids, win: best && { id: best.id, s: best.s, a: best.a, t: best.t, gift: best.s ? (this.L.giftBy(best.s) || {}).name : "" } };
    }
    if (op === "feedget") {                       // лента для игроков: без персонала, от 50 ★ или NFT
      const raw = await this.s.get("feed"), list = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
      return { ok: true, list: list.filter(e => !this.isStaffId(e.id) && feedOk(e.s ? this.L.giftBy(e.s) : null, e.a)).slice(0, 100) };
    }
    if (op === "online") { if (d && d.g) onMark(String(d.g), uid, this.isStaffId(uid)); return { ok: true, on: onCounts() }; }
    if (op === "tour") { await this.tourGet(); const p = await this.tourPrev(3); return { ok: true, ...(await this.tourTop(10)), prizes: this.tourPrizes(), prev: p && { end: p.end, top: p.top.map(r => ({ n: r.n, v: r.v })), won: (p.won || []).map(w => ({ n: w.n, v: w.v, prize: w.prize, place: w.place })) } }; }
    this.uid = uid; this.isStaff = this.isStaffId(uid);
    const u = await this.user(uid, name);
    const banned = (this.st.banned || []).map(String).includes(uid);
    if (banned && op !== "me") fail("Аккаунт заблокирован");
    const fn = this["op_" + op];
    if (!fn) fail("Неизвестное действие");
    this._hf = null; this._op = op; this._gk = this.gameKey(op, d); this.huntEnsure(u);
    if (GIFT_BET_OPS.has(op) && d && d.gi != null) {   // ставка подарком: подарок уходит, его цена становится ставкой (выигрыш — звёздами)
      const i = this.invIndex(u, d.gi, d.gs), gf = this.L.giftBy(u.inv[i]);
      if (!gf || isStar(gf)) fail("Этот подарок нельзя поставить"); if (gf.price > MAX_BET) fail("Подарок слишком дорогой для ставки");
      this.noRefLock(u, gf.slug);
      u.inv.splice(i, 1); u.bal += gf.price; d.bet = gf.price; await this.stat("giftbet", gf.price);
    }
    const res = (await fn.call(this, u, uid, d || {})) || {};
    if (this._hf) res.hunt = this._hf;
    if (OP_GAME[op]) onMark(OP_GAME[op], uid, this.isStaff);
    onMark("app", uid, this.isStaff);
    if (u.refLock && u.refLock.length) { const left = {}; for (const s of u.inv) left[s] = (left[s] || 0) + 1; u.refLock = u.refLock.filter(s => left[s]-- > 0); }
    await this.track(u, uid, d);
    if (d && d._prem && u.ref && !u.refq && !u.refBan && !(u.refMul || (u.refMul = await this.multiRef(u, uid)))) {   // приглашённый с Telegram Premium (подпись Telegram) — засчитываем при любом действии в игре
      const r = await this.s.get("u:" + u.ref);
      if (r) { u.refq = 1; u.refWhy = "Premium"; u.refAt = Date.now(); r.refQ = (r.refQ || 0) + 1;
        if (u.rOpen && !u.refFc) { u.refFc = 1; u.refFcAt = Date.now(); r.refF = (r.refF || 0) + 1; }
        await this.s.put("u:" + u.ref, r); }
    }
    if (u.freeLock && u.freeLock.length) {           // блокировка не может быть больше, чем таких подарков в инвентаре
      const left = {}; for (const s of u.inv) left[s] = (left[s] || 0) + 1;
      u.freeLock = u.freeLock.filter(s => left[s]-- > 0);
    }
    await this.s.put("u:" + uid, u);
    if (this.isNew) await this.stat("new", 1);
    return { ok: true, ...res, me: this.view(u) };
  }

  op_me() { return {}; }
  async op_level_claim(u) {                      // забрать награду за следующий достигнутый уровень
    const next = (u.lvl || 0) + 1, L = LEVELS[next], t = (u.ps && u.ps.t) || 0;
    if (!L) fail("Максимальный рейтинг уже получен");
    if (t < L[1]) fail(`Нужен оборот ${L[1]} ★`);
    u.lvl = next; u.bal += L[2]; await this.stat("lvl", L[2]); await this.gday(0, L[2], "bonus");
    return { got: L[2], lvl: next, name: L[0] };
  }
  // «Поставь в ник»: этап 1 — тег в имени и био, этап 2 — держать 24 ч, этап 3 — награда раз в день (зависит от уровня)
  nickReward(u) {
    const r = (this.st.nick && Array.isArray(this.st.nick.r) ? this.st.nick.r : [3, 7, 15, 30]).map(v => Math.max(0, Math.round(+v || 0)));
    const t = (u.ps && u.ps.t) || 0; let i = 0; while (i + 1 < LEVELS.length && t >= LEVELS[i + 1][1]) i++;
    return r[i === 0 ? 0 : i <= 2 ? 1 : i <= 4 ? 2 : 3] || 0;
  }
  async op_nick(u, uid, d) {                      // вызывает только сервер: d.ok — тег найден в имени и био
    if (this.st.nick && this.st.nick.on === false) fail("Задание сейчас выключено");
    if (d.act === "start") {
      if (!d.ok) fail(d.why || "Тег не найден");
      if (!u.nick || !u.nick.s) u.nick = { s: Date.now(), day: "" };
      await this.s.put("nk:" + uid, Date.now() + 4 * 36e5);
      return { nick: u.nick };
    }
    if (!u.nick || !u.nick.s) fail("Сначала пройди этап 1");
    if (!d.ok) { u.nick = null; await this.s.delete("nk:" + uid); return { lost: true, why: (d.why || "Тег убран") + " — прогресс сброшен, начни заново" }; }
    if (Date.now() - u.nick.s < 864e5) fail("Подожди 24 часа с начала");
    const day = dayKey(); if (u.nick.day === day) fail("Сегодня награда уже получена — приходи завтра");
    const r = this.nickReward(u); u.nick.day = day; u.bal += r; await this.stat("nick", r); await this.gday(0, r, "bonus");
    return { got: r, nick: u.nick };
  }
  async op_wallet(u, uid) {                      // мои заявки на вывод, которые ещё не выполнены
    const q = await this.s.list({ prefix: "wdq:", limit: 1000 }), open = [];
    for (const [, w] of q) if (w && w.uid === uid) open.push({ id: w.id, s: w.slug, n: w.gname, a: w.price, t: w.t });
    return { open };
  }
  // друг прошёл проверку (NFT или уровень 2+) — засчитываем пригласившему один раз. Вызывает только сервер
  async op_ref_qualify(u, uid, d) {
    if (u.refq || !u.ref || u.refBan) return { done: false };
    if (u.refMul || (u.refMul = await this.multiRef(u, uid))) return { done: false, mul: u.refMul };
    u.refq = 1; u.refWhy = String(d.why || "").slice(0, 40); u.refAt = Date.now();
    const r = await this.s.get("u:" + u.ref); if (!r) return { done: false };
    r.refQ = (r.refQ || 0) + 1;
    if (u.rOpen && !u.refFc) { u.refFc = 1; u.refFcAt = Date.now(); r.refF = (r.refF || 0) + 1; }
    await this.s.put("u:" + u.ref, r);
    return { done: true };
  }
  // кого из моих приглашённых ещё не засчитали (до 15 за раз)
  async op_ref_pending(u) {
    const out = [];
    for (const id of (u.refs || []).slice().reverse()) {
      if (out.length >= 15) break;
      const f = await this.s.get("u:" + id);
      if (f && !f.refq) out.push(String(id));
    }
    return { ids: out };
  }
  // ---- промокоды: создаёт админ (звёзды, билеты или промо-кейс), лимит активаций, у каждого игрока — один раз ----
  async op_promo(u, uid, d) {
    const code = String(d.code || "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,32}$/.test(code)) fail("Введи промокод");
    const p = await this.s.get("promo:" + code);
    if (!p || p.off) fail("Такого промокода нет");
    if (p.exp && Date.now() > p.exp) fail("Срок действия промокода закончился");
    if ((p.used || 0) >= p.max) fail("Промокод закончился — все активации использованы");
    if ((u.promos || []).includes(code)) fail("Ты уже активировал этот промокод");
    if (p.dep && (await this.depTotal(u, uid)) < p.dep) fail(`Промокод работает после пополнения от ★ ${p.dep}`);
    p.used = (p.used || 0) + 1; p.last = [{ id: uid, n: u.name, t: Date.now() }, ...(p.last || [])].slice(0, 100);
    await this.s.put("promo:" + code, p);
    u.promos = [...(u.promos || []), code].slice(-200);
    if (p.t === "stars") { u.bal += p.v; await this.gday(0, p.v, "bonus"); } else if (p.t === "tick") u.tick += p.v; else u.promoCase = (u.promoCase || 0) + p.v;
    return { t: p.t, v: p.v, code };
  }
  // поделился ссылкой (для бесплатного кейса) — считаем, не больше 20
  async op_share(u) { u.shares = Math.min(20, (u.shares || 0) + 1); return { shares: u.shares }; }

  // ---- Шахта (майнкрафт): рулетка кирки, кирка падает и копает, верстак/TNT. Всё считает сервер ----
  async op_dig(u, uid, d) {
    if ((this.st.off || {}).dig) fail("Игра выключена");
    const v = bet(d.bet); if (!v) fail("Неверная ставка");
    const S = globalThis.STRELA, K = S.DIG_KS.includes(+d.k) ? +d.k : 1;
    await this.charge(u, v);
    const tp = this.st.digTier;                    // шансы кирок из админки (%, по умолчанию 60/30/10)
    const r = S.digRun(rand, K, tp), unit = this.L.R("dig") / S.digM(K, tp);
    const win = S.digPay(r.ev, v, unit);
    if (win) await this.payout(u, uid, win, GAME_NAMES.dig);
    await this.huntHit(u, uid, { t: "dig", depth: Math.max(0, ...r.ev.map(e => e.y || 0)) }, v);
    return { world: r.world, tier: r.tier, k: K, unit, win, bet: v, x: +(win / v).toFixed(2) };
  }

  // ---- кейсы ----
  async op_case(u, uid, d) {
    const L = this.L; let c;
    if (d.free && !L.FREE_KEYS().includes(d.free)) fail("Этот кейс удалён");
    if (d.free === "ref") {                       // реф-кейс Friends: бесплатно раз в 24 ч, выигрыш заблокирован до приглашения друзей
      c = L.FREE("ref");
      const left = (u.refDaily || 0) + 864e5 - Date.now();
      if (left > 0) fail(`Кейс ${c.n} — раз в 24 ч, через ${left >= 36e5 ? Math.ceil(left / 36e5) + " ч" : Math.ceil(left / 6e4) + " мин"}`);
      u.refDaily = Date.now();
    } else if (d.free === "promo") {             // промо-кейс: открывается за активированный промокод
      c = L.FREE("promo");
      if (!((u.promoCase || 0) > 0)) fail("Нет промо-кейсов — сначала активируй промокод");
      u.promoCase--;
    } else if (d.free === "daily" || d.free === "tick") {
      c = L.FREE(d.free);
      if (d.free === "tick") { if (u.tick < TICKET_CASE) fail(`Нужно ${TICKET_CASE} 🎫`); u.tick -= TICKET_CASE; }
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
        if (u.remK) await this.s.delete(u.remK);  // напоминание: бот напишет, когда кейс снова будет доступен
        u.remK = "rem:" + String(u.daily + hrs * 36e5).padStart(15, "0") + ":" + uid; await this.s.put(u.remK, 1);
      }
    } else {
      c = L.CASES().find(x => x.n === d.name);
      if (!c) fail("Кейс не найден");
      if ((this.st.off || {}).cases) fail("Игра выключена");
      const n = Math.max(1, Math.min(5, Math.floor(+d.n) || 1));   // открытие 1–5 кейсов за раз
      await this.charge(u, c.p * n);
      const prizes = [];
      for (let k = 0; k < n; k++) { const gk = L.caseGift(c); await this.giveGift(u, uid, gk, "Кейс " + c.n); prizes.push(gk.slug); }
      await this.huntHit(u, uid, { t: "case", name: c.n }, c.p);
      return { prize: prizes[0], prizes };
    }
    const g = L.caseGift(c);
    await this.giveGift(u, uid, g, "Кейс " + c.n);
    if (d.free === "daily" && !isStar(g)) (u.freeLock = u.freeLock || []).push(g.slug);   // NFT из ежедневного — вывод после 5 приглашённых
    if (d.free === "ref") { if (!isStar(g)) (u.refLock = u.refLock || []).push(g.slug); u.rOpen = 1; await this.refFreeCount(u); }   // только вывести, и только после друзей
    return { prize: g.slug, prizes: [g.slug] };
  }

  // ---- заработок: заявки на оплату роликов TikTok / Shorts ----
  async op_earn_apply(u, uid, d) {
    const url = String(d.url || "").trim().slice(0, 300);
    if (!/^https?:\/\/([\w-]+\.)*(tiktok\.com|youtube\.com|youtu\.be)\//i.test(url)) fail("Нужна ссылка на ролик TikTok или YouTube Shorts");
    const views = Math.max(0, Math.min(1e9, Math.round(+d.views || 0)));
    if (views < 1000) fail("Укажи просмотры — от 1 000");
    const kind = ["gameplay", "gifts", "creative"].includes(d.kind) ? d.kind : "gameplay";
    const mine = [...(await this.s.list({ prefix: "earn:" })).values()].filter(e => e.uid === uid);
    if (mine.some(e => e.url === url)) fail("Заявка на этот ролик уже есть — за одно видео одна заявка");
    if (mine.filter(e => e.st === "new").length >= 3) fail("У тебя уже 3 заявки на проверке — дождись ответа");
    if (mine.some(e => Date.now() - e.t < 120000)) fail("Подожди пару минут перед следующей заявкой");
    const id = Date.now().toString(36) + randInt(1e6).toString(36);
    const e = { id, uid, name: u.name, url, views, kind, note: String(d.note || "").slice(0, 300), t: Date.now(), st: "new" };
    await this.s.put("earn:" + id, e);
    return { earn: e };
  }
  async op_earn_mine(u, uid) {
    const L = [...(await this.s.list({ prefix: "earn:" })).values()].filter(e => e.uid === uid).sort((a, b) => b.t - a.t).slice(0, 20);
    return { list: L.map(e => ({ url: e.url, views: e.views, kind: e.kind, t: e.t, st: e.st, paid: e.paid || 0, why: e.why || "" })) };
  }

  // ---- охота за сокровищами ----
  huntCfg() { const c = this.st.hunt || {}; return { on: c.on !== false, minBet: Math.max(1, Math.round(c.minBet ?? 25)), prizes: Array.isArray(c.prizes) && c.prizes.length ? c.prizes : HUNT_PRIZES }; }
  huntEnsure(u) {
    const c = this.huntCfg(); if (!c.on) return;
    const k = weekKey();
    if (u.hunt && u.hunt.k === k && !u.hunt.v2) { u.hunt.spots = u.hunt.spots.map(s => s.got ? s : { ...s, ...HUNT_TYPES[s.t](this.L) }); u.hunt.v2 = 1; }   // старые загадки → понятные задания
    if (u.hunt && u.hunt.k === k) return;
    const types = Object.keys(HUNT_TYPES).sort(() => rand() - .5).slice(0, 5);   // 5 разных мест из 9, у каждого игрока свои
    u.hunt = { k, v2: 1, spots: types.map((t, i) => ({ t, e: HUNT_EMO[i], got: false, ...HUNT_TYPES[t](this.L) })), claimed: false };
  }
  huntView(u) {
    const c = this.huntCfg(); if (!c.on || !u.hunt || u.hunt.k !== weekKey()) return c.on ? null : { off: true };
    return { spots: u.hunt.spots.map(s => ({ e: s.e, got: s.got, hint: HUNT_TXT[s.t] ? HUNT_TXT[s.t](s) : s.hint, go: HUNT_GO[s.t] })), claimed: u.hunt.claimed, end: weekEnd() };
  }
  async huntHit(u, uid, ev, amount) {
    const c = this.huntCfg(); if (!c.on || this._hf) return;
    if (amount != null && amount < c.minBet) return;            // мелкие ставки не считаются
    this.huntEnsure(u); const H = u.hunt; if (!H || H.claimed) return;
    for (const s of H.spots) {
      if (s.got || s.t !== ev.t || !HUNT_CHECK[s.t](s, ev)) continue;
      s.got = true; this._hf = { e: s.e, n: H.spots.filter(x => x.got).length }; return;
    }
  }
  async op_hunt_state(u) {
    const w = (await this.s.get("hunt:win:" + weekKey())) || [];
    return { cfg: { prizes: this.huntCfg().prizes, minBet: this.huntCfg().minBet }, winners: w.slice(0, 10) };
  }
  async op_hunt_claim(u, uid) {
    const c = this.huntCfg(); if (!c.on) fail("Охота сейчас выключена");
    this.huntEnsure(u); const H = u.hunt;
    if (H.claimed) fail("Сундук этой недели уже открыт");
    if (!H.spots.every(s => s.got)) fail("Сначала найди все 5 сокровищ");
    let r = rand() * c.prizes.reduce((a, x) => a + x[1], 0), v = c.prizes[0][0];
    for (const [a, w] of c.prizes) { if ((r -= w) <= 0) { v = a; break; } }
    H.claimed = true; await this.payout(u, uid, v, "Охота за сокровищами");
    const k = "hunt:win:" + weekKey(), W = (await this.s.get(k)) || []; if (!this.isStaff) { W.push({ n: u.name, v, t: Date.now() }); await this.s.put(k, W.slice(0, 50)); }
    return { prize: v };
  }

  // ---- дроп: раз в день (или неделю) на игрока, общий фонд на период ----
  dropCfg() { const c = this.st.drop || {}, week = c.period === "week";
    return { on: c.on !== false, period: week ? "week" : "day", budget: Math.max(0, Math.round(c.budget ?? (week ? 1000 : 200))), prizes: Array.isArray(c.prizes) && c.prizes.length ? c.prizes : DROP_PRIZES,
      key: week ? "w" + weekKey() : "d" + dayKey(), end: week ? weekEnd() : dayEnd() }; }
  async op_drop_state(u) {
    const c = this.dropCfg(), w = c.key, p = (await this.s.get("drop:" + w)) || { spent: 0, n: 0 };
    return { drop: { on: c.on, budget: c.budget, spent: p.spent, n: p.n, prizes: c.prizes, done: u.dropW === w, end: c.end, period: c.period } };
  }
  async op_drop(u, uid) {
    const c = this.dropCfg(), w = c.key;
    if (!c.on) fail("Дроп сейчас выключен");
    if (u.dropW === w) fail(c.period === "week" ? "Ты уже забрал дроп на этой неделе" : "Дроп уже забран сегодня — приходи завтра");
    const k = "drop:" + w, p = (await this.s.get(k)) || { spent: 0, n: 0 }, left = c.budget - p.spent;
    const ok = c.prizes.filter(([v]) => v <= left);
    if (!ok.length) fail(c.period === "week" ? "Фонд недели закончился — новый дроп в понедельник" : "Фонд на сегодня закончился — новый дроп завтра");
    let r = rand() * ok.reduce((a, x) => a + x[1], 0), v = ok[0][0];
    for (const [a, wt] of ok) { if ((r -= wt) <= 0) { v = a; break; } }
    if (!this.isStaff) { p.spent += v; p.n++; await this.s.put(k, p); }   // персонал не тратит общий фонд
    u.dropW = w; u.bal += v; await this.stat("drop", v); await this.gday(0, v, "bonus"); await this.feed(u, uid, "Дроп", null, v);
    return { prize: v, drop: { on: c.on, budget: c.budget, spent: p.spent, n: p.n, prizes: c.prizes, done: true, end: c.end, period: c.period } };
  }

  // ---- яйца ----
  async op_egg(u, uid, d) {
    const price = Math.round(+d.price);
    if (!EGGS.some(e => e[2] === price)) fail("Нет такого яйца");
    if ((this.st.off || {}).eggs) fail("Игра выключена");
    await this.charge(u, price);
    const g = this.L.pickGift(price, this.L.R("eggs"));
    await this.giveGift(u, uid, g, GAME_NAMES.egg);
    await this.huntHit(u, uid, { t: "egg", price }, price);
    return { prize: g.slug };
  }

  // ---- апгрейд ----
  async op_upgrade(u, uid, d) {
    const L = this.L, i = this.invIndex(u, d.i, d.slug);
    const a = L.giftBy(u.inv[i]), b = L.giftBy(String(d.target || ""));
    if (!a || !b || isStar(b) || !(b.price > a.price)) fail("Выбери подарок дороже своего");
    const ch = L.upChance(a.price, b.price);
    this.noRefLock(u, a.slug);
    const wasLocked = this.lockedTake(u, a.slug);
    u.inv.splice(i, 1); await this.stat("bets", a.price); await this.betNoCharge(u, a.price);
    const roll = rand() * 100, won = roll < ch;              // где остановится стрелка колеса
    if (won) { await this.giveGift(u, uid, b, GAME_NAMES.upgrade); if (wasLocked && !isStar(b)) (u.freeLock = u.freeLock || []).push(b.slug); }   // блок вывода переходит на новый подарок
    (u.glog = u.glog || []).unshift({ k: "up", a: a.slug, b: b.slug, ch: +ch.toFixed(2), roll: +roll.toFixed(2), won, t: Date.now() }); u.glog = u.glog.slice(0, 50);
    await this.gstat("upgrade", a.price, won ? b.price : 0);
    await this.huntHit(u, uid, { t: "upgrade", won, chance: ch }, a.price);
    return { won, chance: ch, roll };
  }

  // ---- контракты ----
  async op_contract(u, uid, d) {
    const L = this.L, items = Array.isArray(d.items) ? d.items.map(String) : [];
    if (items.length < 2) fail("Выбери минимум 2 подарка");
    if (items.length > 30) fail("Максимум 30 подарков за раз");
    for (const s of new Set(items)) { const lk = (u.refLock || []).filter(x => x === s).length; if (lk && items.filter(x => x === s).length > u.inv.filter(x => x === s).length - lk) fail("Подарок из реф-кейса можно только вывести — продать, поставить или обменять его нельзя"); }
    let wasLocked = false; for (const s of new Set(items)) { const lk = (u.freeLock || []).filter(x => x === s).length, have = u.inv.filter(x => x === s).length, use = items.filter(x => x === s).length; if (lk && use > have - lk) wasLocked = true; }
    const inv = [...u.inv];
    for (const s of items) { const k = inv.indexOf(s); if (k < 0) fail("Подарок не найден, обнови страницу"); inv.splice(k, 1); }
    const sum = items.reduce((s, x) => s + ((L.giftBy(x) || {}).price || 0), 0);
    u.inv = inv; await this.stat("bets", sum); await this.betNoCharge(u, sum);
    const g = L.pickGift(sum, L.R("contract"));
    await this.giveGift(u, uid, g, GAME_NAMES.contract);
    if (wasLocked && !isStar(g)) (u.freeLock = u.freeLock || []).push(g.slug);
    await this.gstat("contract", sum, g.price);
    await this.huntHit(u, uid, { t: "contract", n: items.length }, sum);
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
    await this.huntHit(u, uid, { t: "crash", m: x }, g.bet);
    return { crashed: false, m: x, win: Math.round(g.bet * x) };
  }

  // ---- мины ----
  async op_mines_bet(u, uid, d) {
    const k = "g:mines:" + uid, old = await this.s.get(k);
    if (old) {                                   // брошенная игра: открытые клетки — забираем, ничего не открыто — возврат ставки
      await this.s.delete(k);
      if (old.open.length) await this.payout(u, uid, old.bet * this.L.minesMult(old.n, old.open.length), GAME_NAMES.mines);
      else { u.bal += old.bet; await this.stat("bets", -old.bet); await this.gday(-old.bet, 0); await this.unBet(u, this.uid, old.bet); }
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
      await this.huntHit(u, uid, { t: "mines", open: g.open.length }, g.bet);
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
    await this.huntHit(u, uid, { t: "mines", open: g.open.length }, g.bet);
    return { mult, win: Math.round(g.bet * mult), bombs: g.bombs };
  }

  // ---- Цыпа: переходи дорогу, на каждой полосе множитель растёт, забрать можно в любой момент ----
  async op_chick_state(u, uid) { const g = await this.s.get("g:chick:" + uid); return { g: g ? { d: g.d, bet: g.bet, step: g.step } : null }; }
  async op_chick_bet(u, uid, d) {
    const k = "g:chick:" + uid, old = await this.s.get(k);
    if (old) {                                   // брошенный забег: пройденные полосы — забираем, не начинал — возврат
      await this.s.delete(k);
      if (old.step) await this.payout(u, uid, old.bet * this.L.chickMult(old.d, old.step), GAME_NAMES.chick);
      else { u.bal += old.bet; await this.stat("bets", -old.bet); await this.gday(-old.bet, 0); await this.unBet(u, this.uid, old.bet); }
    }
    const df = [0, 1, 2, 3].includes(+d.d) ? +d.d : 0, v = bet(d.bet); if (!v) fail("Неверная ставка");
    await this.charge(u, v);
    await this.s.put(k, { d: df, bet: v, step: 0 });
    return { d: df, step: 0 };
  }
  async op_chick_step(u, uid) {
    const k = "g:chick:" + uid, g = await this.s.get(k);
    if (!g) fail("Сначала сделай ставку");
    const [p, lanes] = CHICK_D[g.d] || CHICK_D[0];
    if (rand() >= p) { await this.s.delete(k); return { dead: true, step: g.step + 1 }; }
    g.step++;
    const mult = this.L.chickMult(g.d, g.step);
    if (g.step >= lanes) {                       // дошла до конца — выигрыш сам
      await this.s.delete(k); await this.payout(u, uid, g.bet * mult, GAME_NAMES.chick);
      return { step: g.step, mult, done: true, win: Math.round(g.bet * mult) };
    }
    await this.s.put(k, g);
    return { step: g.step, mult };
  }
  async op_chick_cash(u, uid) {
    const k = "g:chick:" + uid, g = await this.s.get(k);
    if (!g) fail("Нет активной игры");
    if (!g.step) fail("Сделай хотя бы один шаг");
    const mult = this.L.chickMult(g.d, g.step);
    await this.s.delete(k); await this.payout(u, uid, g.bet * mult, GAME_NAMES.chick);
    return { mult, win: Math.round(g.bet * mult), step: g.step };
  }

  // ---- plinko ----
  async op_plinko(u, uid, d) {
    const risk = [0, 1, 2].includes(+d.risk) ? +d.risk : 0, v = bet(d.bet); if (!v) fail("Неверная ставка");
    await this.charge(u, v);
    const path = Array.from({ length: 8 }, () => rand() < .5 ? 1 : 0), k = path.reduce((a, b) => a + b, 0);
    const mult = this.L.PM(risk)[k];
    await this.payout(u, uid, v * mult, GAME_NAMES.plinko);
    await this.huntHit(u, uid, { t: "plinko", k }, v);
    return { path, k, mult, win: Math.round(v * mult) };
  }

  // ---- слоты ----
  async op_slots(u, uid) {
    await this.charge(u, SLOT_BET);
    const res = [0, 1, 2].map(() => SLOT_SYMS[randInt(SLOT_SYMS.length)]);
    const mult = this.L.slotsMult(res);
    await this.payout(u, uid, SLOT_BET * mult, GAME_NAMES.slots);
    await this.huntHit(u, uid, { t: "slots", three: res[0] === res[1] && res[1] === res[2] }, SLOT_BET);
    return { res, mult, win: Math.round(SLOT_BET * mult) };
  }

  // ---- PvP: настоящие игроки в одном общем раунде ----
  // Раунд стартует, когда ставку делает второй игрок: 20 секунд на ставки, потом колесо.
  // Шанс победы = доля ставки в банке. Если соперник не пришёл за 3 минуты — ставка возвращается.
  async creditUser(id, n, game) {
    const w = await this.s.get("u:" + id); if (!w) return;
    n = Math.round(n); w.bal += n; await this.stat("wins", n); await this.gday(0, n, "pvp");
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
      for (const p of cur.players) { const w = await this.s.get("u:" + p.id); if (w) { w.bal += p.v; await this.unBet(w, p.id, p.v); await this.gday(-p.v, 0, "pvp"); await this.s.put("u:" + p.id, w); } await this.stat("bets", -p.v); }
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
    if (g) this.noRefLock(u, g.slug);
    u.inv.splice(i, 1); u.bal += g ? g.price : 0;
    return { got: g ? g.price : 0 };
  }
  async op_sellall(u) {
    const keep = [...(u.refLock || [])], out = [], sold = [];   // подарки из реф-кейса остаются
    for (const x of u.inv) { const k = keep.indexOf(x); if (k >= 0) { keep.splice(k, 1); out.push(x); } else sold.push(x); }
    const s = sold.reduce((a, x) => a + ((this.L.giftBy(x) || {}).price || 0), 0);
    u.inv = out; u.bal += s; return { got: s };
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
    const minWd = Math.max(0, Math.round(this.st.minWd ?? 100));
    const needDep = Math.max(0, Math.round(this.st.wdNeedDep ?? 100));     // вывод — только после пополнения
    const refL = this.refLocked(u, g.slug), refNeed = REF_STEP * ((u.refWd || 0) + 1);
    if (needDep && !this.isStaff && !refL) { const dt = await this.depTotal(u, uid); if (dt < needDep) fail(`Вывод доступен после пополнения от ${needDep} ★ (пополнено ${dt} ★). Подарок можно продать или сыграть им`); }
    if (g.price < minWd && !refL) fail(`Вывод — от ${minWd} ★. Этот подарок можно продать`);
    if (refL && (u.refF || 0) < refNeed) fail(`Подарок из реф-кейса можно вывести, когда пригласишь ${refNeed} друзей (${u.refF || 0}/${refNeed}). Друг засчитывается, когда заходит по твоей ссылке, открывает реф-кейс и у него есть Telegram Premium или NFT`);
    if (refL && !((u.refPaid || 0) > 0)) fail(`Оплати вывод ${this.st.rwdFee ?? 150} ★ с баланса Telegram`);   // вывод из реф-кейса — за звёзды Telegram
    const lockN = (u.freeLock || []).filter(s => s === g.slug).length, haveN = u.inv.filter(s => s === g.slug).length;
    if (lockN && lockN >= haveN && (u.refCount || 0) < FREE_NFT_REFS)
      fail(`NFT из бесплатного кейса можно вывести, когда пригласишь ${FREE_NFT_REFS} друзей (${u.refCount || 0}/${FREE_NFT_REFS})`);
    const pct = refL ? 0 : Math.max(0, Math.min(50, +(this.st.wdFee ?? 5) || 0)), fee = pct ? Math.ceil(g.price * pct / 100) : 0;   // комиссия за вывод, ★ с баланса
    if (fee && (u.bal || 0) < fee) fail(`Комиссия за вывод — ${fee} ★ (${pct}%). Пополни баланс`);
    u.inv.splice(i, 1);
    if (refL) { u.refLock.splice(u.refLock.indexOf(g.slug), 1); u.refWd = (u.refWd || 0) + 1; u.refPaid--; }   // следующий вывод из реф-кейса — на 10 друзей больше
    if (fee) { u.bal -= fee; await this.stat("fee", fee); }
    const id = Date.now().toString(36) + randInt(1e6).toString(36);
    await this.s.put("wdq:" + id, { id, uid, name: u.name, un: String(d.un || "").slice(0, 40), slug: g.slug, gname: g.name, price: g.price, fee, refL: refL ? 1 : 0, ub: d.ub && !g.tgid ? 1 : 0, t: Date.now(), st: "new" });
    await this.s.put("wd:" + uid, Date.now()); this.hist(u, { k: "wd", id, s: g.slug, a: g.price, fee });
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
    if (w.fee) u.bal = (u.bal || 0) + w.fee;     // комиссию возвращаем
    if (w.refL) { (u.refLock = u.refLock || []).push(w.slug); u.refWd = Math.max(0, (u.refWd || 0) - 1); u.refPaid = (u.refPaid || 0) + 1; }
    u.hist = (u.hist || []).filter(h => h.id !== w.id);
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
    if (p.kind === "rwd") { u.refPaid = (u.refPaid || 0) + 1; await this.stat("rwdfee", p.a); return { rwd: 1, got: 0 }; }   // оплата вывода из реф-кейса
    u.bal += p.a; await this.stat("dep", p.a); this.hist(u, { k: "dep", m: "stars", a: p.a }); const bonus = this.depDone(u, p.a); await this.stat("fdb", bonus); await this.refBonus(u, p.a);
    return { got: p.a, bonus };
  }
  async op_credit_ton(u, uid, d) {          // вызывает только сервер после проверки сети
    const key = "ton:" + d.memo;
    if (await this.s.get(key)) return { got: 0, already: true };
    if (d.hash && await this.s.get("tonh:" + d.hash)) return { got: 0, already: true };
    const a = Math.max(0, Math.floor(+d.a || 0));
    await this.s.put(key, JSON.stringify({ uid, ton: d.ton, a, hash: d.hash, t: Date.now() }));
    if (d.hash) await this.s.put("tonh:" + d.hash, 1);
    u.bal += a; await this.stat("dep", a); this.hist(u, { k: "dep", m: "ton", a, ton: d.ton }); const bonus = this.depDone(u, a); await this.stat("fdb", bonus); await this.refBonus(u, a);
    return { got: a, ton: d.ton, bonus };
  }

  async op_credit_ext(u, uid, d) {          // вызывает только сервер: покупка в STRELA STARS «на баланс казино» (проверено секретом EXT_KEY)
    const key = "ext:" + d.id;
    if (await this.s.get(key)) return { got: 0, already: true };
    const a = Math.max(0, Math.floor(+d.a || 0));
    await this.s.put(key, JSON.stringify({ uid, a, from: d.from || "", t: Date.now() }));
    u.bal += a; await this.stat("dep", a); this.hist(u, { k: "dep", m: "strela", a }); const bonus = this.depDone(u, a); await this.stat("fdb", bonus); await this.refBonus(u, a);
    return { got: a, bonus };
  }
  async op_credit_cp(u, uid, d) {           // вызывает только сервер после проверки счёта в CryptoBot
    const key = "cp:" + d.id;
    if (await this.s.get(key)) return { got: 0, already: true };
    const a = Math.max(0, Math.floor(+d.a || 0));
    await this.s.put(key, JSON.stringify({ uid, a, usd: d.usd, t: Date.now() }));
    u.bal += a; await this.stat("dep", a); this.hist(u, { k: "dep", m: "cp", a, usd: d.usd }); const bonus = this.depDone(u, a); await this.stat("fdb", bonus); await this.refBonus(u, a);
    return { got: a, usd: d.usd, bonus };
  }

  // ===== админка =====
  async admin(op, d, owner) {
    const id = String(d.id || "").trim();
    const needId = () => { if (!/^\d{3,15}$/.test(id)) fail("Неверный ID"); };
    const save = async u => { await this.s.put("u:" + id, u); return { ok: true, user: { id, ...this.view(u), name: u.name } }; };
    if (op === "refs") {                          // кого пригласил игрок и кто из них засчитан (для проверки накрутки)
      const r = await this.s.get("u:" + String(d.id || "")); if (!r) fail("Игрок не найден");
      const ids = (r.refs || []).slice().reverse();
      const list = (await Promise.all(ids.map(async id => { const f = await this.s.get("u:" + id); return f ? { id, mul: f.refMul || (await this.multiRef(f, id)), n: f.name || "", q: !!f.refq, why: f.refWhy || "", at: f.refAt || 0, open: !!f.rOpen, fc: !!f.refFc, fcAt: f.refFcAt || 0, ban: !!f.refBan, dep: f.depTot || 0, seen: f.seen || 0 } : { id, gone: 1 }; }))).filter(x => !x.gone);
      return { ok: true, id: String(d.id), n: r.name || "", refCount: r.refCount || 0, refQ: r.refQ || 0, refF: r.refF || 0, refNeed: 10 * ((r.refWd || 0) + 1), refWd: r.refWd || 0, list };
    }
    if (op === "refundo") {                       // снять засчитанного друга (накрутка): у пригласившего −1, повторно не засчитается
      const f = await this.s.get("u:" + String(d.id || "")); if (!f || !f.ref) fail("Это не приглашённый игрок");
      const r = await this.s.get("u:" + f.ref);
      if (r) { if (f.refFc) r.refF = Math.max(0, (r.refF || 0) - 1); if (f.refq) r.refQ = Math.max(0, (r.refQ || 0) - 1); await this.s.put("u:" + f.ref, r); }
      f.refFc = 0; f.refq = 0; f.refBan = 1; await this.s.put("u:" + String(d.id), f);
      return { ok: true };
    }
    if (op === "multi") {                         // группы аккаунтов с общим устройством / IP
      const par = {}, f = x => (par[x] === undefined ? (par[x] = x) : par[x] === x ? x : (par[x] = f(par[x]))), un = (a, b) => { par[f(a)] = f(b); };
      const why = {};
      for (const t of ["dv", "ip"]) for (const [, ix] of await this.s.list({ prefix: "ix:" + t + ":", limit: 50000 })) {
        const ids = (ix || []).filter(x => !this.isStaffId(x)); if (ids.length < 2 || (t === "ip" && ids.length > 15)) continue;
        for (const x of ids) { un(x, ids[0]); (why[x] = why[x] || {})[t] = 1; }
      }
      const groups = {};
      for (const x of Object.keys(par)) (groups[f(x)] = groups[f(x)] || []).push(x);
      const out = [];
      for (const ids of Object.values(groups)) {
        if (ids.length < 2) continue;
        const us = []; let dv = 0, refIn = 0, dep = 0;
        for (const id of ids.slice(0, 25)) {
          const x = await this.s.get("u:" + id); if (!x) continue;
          if (why[id] && why[id].dv) dv = 1; if (x.ref && ids.includes(String(x.ref))) refIn++; dep += x.depSum || 0;
          us.push({ id, n: x.name, dep: x.depSum || 0, bal: x.bal || 0, inv: (x.inv || []).length, ref: x.ref || "", refF: x.refF || 0, dv: !!(why[id] && why[id].dv), banned: (this.st.banned || []).map(String).includes(id) });
        }
        out.push({ n: ids.length, dv, refIn, dep, us, score: dv * 3 + Math.min(refIn, 5) * 2 + (dep ? 0 : 1) + ids.length * 0.2 });
      }
      out.sort((a, b) => b.score - a.score);
      return { ok: true, groups: out.slice(0, 60), total: out.length };
    }
    if (op === "uinfo") {                         // полная карточка игрока: по ID или @юзернейму
      let uid = String(d.q || "").trim().replace(/^@/, ""), u = null;
      if (/^\d{3,15}$/.test(uid)) u = await this.s.get("u:" + uid);
      else {
        const want = uid.toLowerCase(); let after = null;
        for (let k = 0; k < 50 && !u; k++) {
          const page = await this.s.list({ prefix: "u:", limit: 1000, ...(after ? { startAfter: after } : {}) });
          for (const [key, x] of page) if (String(x.name || "").replace(/^@/, "").toLowerCase() === want) { u = x; uid = key.slice(2); break; }
          if (page.size < 1000) break; after = [...page.keys()].pop();
        }
      }
      if (!u) fail("Игрок не найден");
      const deps = [];                                // все подтверждённые пополнения из журналов платежей
      for (const [pre, m] of [["pay:", "stars"], ["ton:", "ton"], ["cp:", "cp"]]) {
        let after = null;
        for (let k = 0; k < 30; k++) {
          const page = await this.s.list({ prefix: pre, limit: 1000, ...(after ? { startAfter: after } : {}) });
          for (const [, raw] of page) { const x = typeof raw === "string" ? JSON.parse(raw) : raw; if (x && String(x.uid) === uid && (m !== "stars" || x.claimed !== false)) deps.push({ m, a: x.a, t: x.t, ton: x.ton, usd: x.usd }); }
          if (page.size < 1000) break; after = [...page.keys()].pop();
        }
      }
      deps.sort((a, b) => b.t - a.t);
      const wq = [...(await this.s.list({ prefix: "wdq:", limit: 1000 })).values()].filter(w => w.uid === uid);
      const fr = await this.s.get("feed"), feedAll = fr ? (typeof fr === "string" ? JSON.parse(fr) : fr) : [];
      const wins = feedAll.filter(e => String(e.id) === uid).slice(0, 50);
      const tr = (await this.tourGet()).rows[uid];
      const ref = u.ref ? await this.s.get("u:" + u.ref) : null;
      const lk = await this.linked(u, uid), links = [];
      for (const [id, f] of Object.entries(lk).slice(0, 30)) { const x = await this.s.get("u:" + id); links.push({ id, n: x ? x.name : id, dv: !!f.dv, ip: !!f.ip, dep: x ? x.depSum || 0 : 0, refMe: x && x.ref === uid, myRef: u.ref === id }); }
      return { ok: true, links, refMul: u.refMul || "", u: { id: uid, name: u.name, bal: u.bal, tick: u.tick, inv: u.inv, ps: u.ps || null, hist: u.hist || [], depSum: u.depSum || 0,
        ref: u.ref ? { id: u.ref, name: ref && ref.name } : null, refCount: u.refCount || 0, refEarn: u.refEarn || 0, daily: u.daily || 0, nick: u.nick || null,
        lvl: u.lvl || 0, fdb: u.fdb || 0, glog: u.glog || [], banned: (this.st.banned || []).map(String).includes(uid), staff: this.isStaffId(uid) }, deps, wq, wins, tour: tr ? tr[1] : 0, tourBan: (this.st.tourBan || []).map(String).includes(uid) };
    }
    if (op === "promo_list") {                    // все промокоды: сколько активаций, кто активировал
      const L = [...(await this.s.list({ prefix: "promo:" })).values()].sort((a, b) => (b.t0 || 0) - (a.t0 || 0));
      return { ok: true, list: L };
    }
    if (op === "promo_save") {                    // создать / изменить: код, что даёт, сколько, лимит активаций, срок, мин. пополнение
      const code = String(d.code || "").trim().toUpperCase();
      if (!/^[A-Z0-9_-]{2,32}$/.test(code)) fail("Код: 2–32 символа, латиница, цифры, - и _");
      const t = ["stars", "tick", "case"].includes(d.t) ? d.t : fail("Выбери, что даёт промокод");
      const v = Math.round(+d.v || 0); if (!(v >= 1 && v <= (t === "stars" ? 100000 : 100))) fail("Неверное количество");
      const max = Math.round(+d.max || 0); if (!(max >= 1 && max <= 1e6)) fail("Неверный лимит активаций");
      const old = (await this.s.get("promo:" + code)) || {};
      const days = +d.days || 0, p = { ...old, code, t, v, max, dep: Math.max(0, Math.round(+d.dep || 0)), off: !!d.off, exp: days > 0 ? (old.exp && d.keepExp ? old.exp : Date.now() + days * 864e5) : 0, used: old.used || 0, t0: old.t0 || Date.now() };
      await this.s.put("promo:" + code, p);
      return { ok: true };
    }
    if (op === "promo_del") { await this.s.delete("promo:" + String(d.code || "").toUpperCase()); return { ok: true }; }
    if (op === "tourkick") {                      // убрать игрока из турнира (обнулить его оборот и не считать дальше)
      needId(); const t = await this.tourGet(); delete t.rows[id]; await this.s.put("tour", t);
      const st = await this.settings(); st.tourBan = [...new Set([...(st.tourBan || []).map(String), id])];
      await this.s.put("settings", typeof (await this.s.get("settings")) === "string" ? JSON.stringify(st) : st);
      return { ok: true };
    }
    if (op === "earn_list") {
      const L = [...(await this.s.list({ prefix: "earn:" })).values()].sort((a, b) => (a.st === "new") - (b.st === "new") || b.t - a.t).reverse().slice(0, 100);
      return { ok: true, list: L };
    }
    if (op === "earn_done") {
      const k = "earn:" + String(d.eid || ""), e = await this.s.get(k); if (!e) fail("Заявка не найдена");
      if (e.st !== "new") fail("Заявка уже обработана");
      if (d.pay) {
        const a = Math.round(+d.amount); if (!(a > 0)) fail("Укажи сумму");
        const u = await this.user(e.uid); u.bal += a; await this.s.put("u:" + e.uid, u); await this.stat("earn", a); await this.gday(0, a, "bonus");
        e.st = "paid"; e.paid = a;
      } else { e.st = "rejected"; e.why = String(d.why || "").slice(0, 200); }
      e.done = Date.now(); await this.s.put(k, e);
      return { ok: true, earn: e };
    }
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
      let total = all.size, after = all.size ? [...all.keys()].pop() : null;   // реальное число игроков: дочитываем всех по страницам
      while (after && total % 1000 === 0) {
        const page = await this.s.list({ prefix: "u:", limit: 1000, startAfter: after });
        if (!page.size) break;
        for (const k of page.keys()) { aud.add(k.slice(2)); after = k; }
        total += page.size; if (page.size < 1000) break;
      }
      for (const k of (await this.s.list({ prefix: "bu:", limit: 50000 })).keys()) aud.add(k.slice(3));
      const gstats = (await this.s.get("gstats")) || {};
      const gd = [...(await this.s.list({ prefix: "gd:2", reverse: true, limit: 31 })).entries()].map(([k, v]) => ({ d: k.slice(3), g: v })), gdAll = (await this.s.get("gd:all")) || {};
      const days = [...(await this.s.list({ prefix: "sd:", reverse: true, limit: 60 })).entries()].map(([k, v]) => ({ d: k.slice(3), ...v })).reverse();
      await this.tourGet(); const tourPrev = await this.tourPrev(50);
      if (tourPrev) for (const r of tourPrev.top) { const cu = await this.s.get("u:" + r.id); if (cu && cu.name && /^@/.test(cu.name)) r.n = cu.name; }   // актуальный @ из профиля
      for (const id of this.staff) if (all.has("u:" + id)) total--;
      return { ok: true, stats, gstats, gd, gdAll, today: dayKey(), days, tourPrev, total, users, withdrawals: [...wq.values()].sort((a, b) => b.t - a.t), bc, audience: aud.size };
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
      await this.s.delete(["feed", "gstats"]);
      await this.s.delete(["tour", "tour:prev"]);
      return { ok: true, users: n };
    }
    if (op === "resettour") { await this.s.delete(["tour", "tour:prev"]); return { ok: true }; }
    if (op === "resetstats") { await this.s.put("stats", { dep: 0, bets: 0, wins: 0 }); await this.s.delete(["gstats", "gd:all"]); const sd = [...(await this.s.list({ prefix: "sd:" })).keys(), ...(await this.s.list({ prefix: "gd:" })).keys()]; for (let i = 0; i < sd.length; i += 100) await this.s.delete(sd.slice(i, i + 100)); return { ok: true }; }
    if (op === "refs") {
      const r = await this.s.get("u:" + id); if (!r) return { ok: true, rows: [] };
      const rows = [];
      for (const fid of (r.refs || []).slice(-40).reverse()) { const f = await this.s.get("u:" + fid); rows.push({ id: fid, name: f && f.name, q: !!(f && f.refq), why: f && f.refWhy }); }
      return { ok: true, refQ: r.refQ || 0, rows };
    }
    if (op === "ub_take") {                       // юзербот забирает заявки на автовыдачу (по одной, чтобы не отправить дважды)
      const out = [], now = Date.now();
      for (const [k, w] of await this.s.list({ prefix: "wdq:", limit: 1000 })) {
        if (w.st !== "new" || !w.ub || (w.ubAt && now - w.ubAt < 30 * 6e4)) continue;   // взятую заявку повторно не отдаём 30 мин
        w.ubAt = now; await this.s.put(k, w); out.push({ id: w.id, uid: w.uid, un: w.un || "", slug: w.slug, gname: w.gname, price: w.price });
        if (out.length >= (d.n || 3)) break;
      }
      return { ok: true, list: out };
    }
    if (op === "ub_result") {                     // итог: выдано — закрываем заявку; ошибка — заявка остаётся на ручную выдачу
      const k = "wdq:" + String(d.id || ""), w = await this.s.get(k); if (!w) return { ok: true, gone: 1 };
      if (d.ok) { await this.s.delete(k); return { ok: true, w }; }
      w.ub = 0; w.ubErr = String(d.err || "ошибка").slice(0, 200); await this.s.put(k, w); return { ok: true, w };
    }
    if (op === "wd_count") return { ok: true, n: (await this.s.list({ prefix: "wdq:", limit: 500 })).size };
    if (op === "wd_done") { const k = "wdq:" + String(d.wid || ""), w = await this.s.get(k); if (w) await this.s.delete(k); return { ok: true }; }
    fail("Неизвестное действие");
  }
}

export { GameError };
