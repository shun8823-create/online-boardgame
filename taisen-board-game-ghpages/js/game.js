'use strict';
/* ===== 対戦エンジン ===== */
let G = null, UIDC = 1;
let RNG = Math.random;
function seedRng(seed) { let a = seed >>> 0; RNG = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/* 座標：側面の列＝A〜G（先行側がG、後攻側がA）、底面の列＝1〜7。例：A1（先行から見て左上） */
const coord = (x, y) => String.fromCharCode(65 + y) + (x + 1);
const rnd = n => Math.floor(RNG() * n);
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1);[a[i], a[j]] = [a[j], a[i]]; } return a; };
const fwd = o => (o === 0 ? -1 : 1);
const rowOf = (o, y) => (o === 0 ? 7 - y : y + 1);
const cellOfRow = (o, r, x) => ({ x, y: o === 0 ? 7 - r : r - 1 });
const inB = (x, y) => x >= 0 && x < 7 && y >= 0 && y < 7;
const U = () => Object.values(G.units);
const isAv = u => u.cid === 'avatar';
const own = i => U().filter(u => u.owner === i);
const chars = i => U().filter(u => u.owner === i && !isAv(u) && !u.hidden);
const allChars = () => U().filter(u => !isAv(u) && !u.hidden);
const at = (x, y) => U().find(u => u.x === x && u.y === y && !u.hidden) || U().find(u => u.x === x && u.y === y);
const hiddenTrap = (x, y) => { const t = G.traps && G.traps[x + ',' + y]; return t && t.hidden ? t : null; };
const hiddenCards = (owner) => [...U().filter(v => v.hidden && !v.dead && v.owner === owner).map(v => ({ x: v.x, y: v.y, ref: v, cid: v.cid, unit: true })), ...Object.keys(G.traps || {}).filter(k => G.traps[k].hidden && G.traps[k].owner === owner).map(k => { const [x, y] = k.split(',').map(Number); return { x, y, ref: G.traps[k], cid: 'thornTrap', unit: false }; })];
const hiddenAt = (x, y) => U().filter(u => u.hidden && !u.dead && u.x === x && u.y === y);
const enemyAt = (x, y, o) => { const t = at(x, y); return t && t.owner !== o && !t.hidden ? t : null; };
const wallAt = (x, y) => G.walls[x + ',' + y];
const cur = () => G.players[G.active];
const abC = (cid, k) => CARDS[cid].ab.includes(k);
const sfx = n => { try { if (typeof UI !== 'undefined' && UI.sfx) UI.sfx(n); } catch (e) { } };
const scAvail = u => (u.st && u.st.paralyze ? (u.scT === G.turn ? 0 : Math.min(u.sc, 1)) : u.sc); // まひ：1ターンにSCを1つしか使えない
const spendSC = (u, n) => { if (n <= 0) return; u.sc -= n; if (u.st && u.st.paralyze) u.scT = G.turn; };
const holdsAttr = (u, scid) => { const a = scid && CARDS[scid].attr; return !!a && charAttrs(u.cid).some(x => a.split('・').includes(x)); };
const tkOn = (u, k) => !!(u.tk && u.tk[k] != null && u.owner === G.active && G.players[u.owner].count === u.tk[k]);
const abU = (u, k) => abC(u.cid, k) || (k === 'berserk' && tkOn(u, 'frenzy')) || (k === 'ambush' && tkOn(u, 'ambush')) || (k === 'counter' && !!u.counter) || (k === 'incinerate' && !!u.attach && u.attach.some(a => a.cid === 'redDragonBreath'));
const nm = u => CARDS[u.cid].name;
const log = s => { G.log.unshift(s); if (G.log.length > 120) G.log.pop(); };
const terrOfRow = r => (r <= 3 ? 'home' : r === 4 ? 'border' : 'enemy');
const terr = u => terrOfRow(rowOf(u.owner, u.y));

function mkUnit(owner, cid, x, y) {
  const c = CARDS[cid];
  const u = { uid: UIDC++, owner, cid, x, y, lp: c.lp, sc: c.sc, spc: c.spc, rspc: c.rspc || 0, acted: 0, placedAt: G.turn, weapon: null, armor: 0, gArmor: 0, tArmor: 0, fArmor: 0, attach: [], st: {}, lpPen: 0, scPen: 0, buffs: [], hidden: false, hiddenSince: 0, dpBonus: 0, uses: {}, dead: false };
  G.units[u.uid] = u;
  return u;
}
function newGame(d0, d1) {
  UIDC = 1;
  G = { turn: 0, active: 0, phase: 'start', over: null, shop: [], shopUsed: [], sanctuaries: {}, traps: {}, units: {}, walls: {}, log: [], assault: null,
    players: [d0, d1].map((d, i) => ({ i, name: i ? '後攻' : '先行', deck: shuffle(d), deckList: [...d], hand: [], grave: [], count: 0, coins: 0, freeBuy: 1, sellUsed: false, spellsUsed: 0, r1Spells: 0, summons: 0, extra: 0, goblinSlots: 0, parade: false, instinct: null, reshuffled: false, avatar: null })) };
  for (const p of G.players) {
    const c = cellOfRow(p.i, 1, 3);
    p.avatar = mkUnit(p.i, 'avatar', c.x, c.y).uid;
    draw(p, 4);
  }
  return G;
}
function draw(p, n = 1) {
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (!p.deck.length) {
      if (!p.reshuffled && p.grave.length) { p.deck = shuffle(p.grave); p.grave = []; p.reshuffled = true; log(`${p.name}：墓地をシャッフルして山札にした`); if (!G.lap) { G.lap = p.name; log(`【二周目突入】${p.name}の山札が尽き、二周目に入った！お互いの全てのキャラクターのOPが+3000される`); if (UI.lap) UI.lap(p.name); } }
      else break;
    }
    p.hand.push(p.deck.shift()); k++;
  }
  return k;
}

/* ステータス */
const isGobName = u => CARDS[u.cid].kind === 'char' && CARDS[u.cid].name.includes('ゴブリン');
const baseLP = u => CARDS[u.cid].lp + (isGobName(u) && G.players[u.owner].parade ? 1500 : 0) + (u.lpBonus || 0) - u.lpPen - (u.trapLoss || 0);
const golemStep = u => (/^golem[123]$/.test(u.cid) ? +u.cid.slice(5) : 0);
const baseSC = u => CARDS[u.cid].sc - u.scPen;
const baseRSpC = u => CARDS[u.cid].rspc || 0; // 魔法耐性用SpC（魔法耐性・超魔法耐性の支払い専用）
const baseSpC = u => CARDS[u.cid].spc + (u.weapon && CARDS[u.weapon].wspc ? CARDS[u.weapon].wspc : 0);
function OP(u) { let v = CARDS[u.cid].op + (u.ambushNow ? 1000 : 0) + (G.lap && CARDS[u.cid].kind === 'char' ? 3000 : 0); if (u.weapon) v += CARDS[u.weapon].wop || 0; for (const a of u.attach) v += CARDS[a.cid].aop || 0; for (const b of u.buffs) if (b.k === 'op') v += b.amt; return v; }
function DP(u) { let v = CARDS[u.cid].dp + u.dpBonus; if (u.weapon) v += CARDS[u.weapon].wdp || 0; for (const b of u.buffs) if (b.k === 'dp') v += b.amt; return v; }
const aop = a => (a.cid === 'fightSpirit' ? 500 : 0);
CARDS.fightSpirit.aop = 500;
const armorTotal = u => u.armor + u.gArmor + u.tArmor + (u.fArmor || 0);
const fArmorCheck = u => { if (u.extra && terr(u) !== 'home') { u.extra = 0; log(`${nm(u)}の「獰猛なる覇者の加護」の効果がホームテリトリーを出たため消えた`); } };
const baseActs = u => (abU(u, 'twoActions') && !assaultOn(u) ? 2 : 1);
const actLimit = u => (u.extra === G.players[u.owner].count && !assaultOn(u) ? Math.min(2, baseActs(u) + 1) : baseActs(u));
const extraOnly = u => u.extra === G.players[u.owner].count && u.acted >= baseActs(u);
const healPen = u => (u.st.burn ? 500 : 0) + (u.st.chill ? 500 : 0) + (u.st.frost ? 1000 : 0);
const healCap = u => baseLP(u); // 回復の上限＝加算後のステータス値（獰猛なる覇者の加護などの直接上昇は含み、混沌の手・本能解放などの一時的な増加は含まない）
function heal(u, n) { n = Math.max(0, n - healPen(u)); const b = healCap(u); if (u.lp < b) u.lp = Math.min(b, u.lp + n); }
function recomputePen(u) {
  const lp = (u.st.poison ? 500 : 0) + (u.st.venom ? 1500 : 0) + (u.st.frost ? 2000 : 0);
  const sc = (u.st.poison ? 1 : 0) + (u.st.venom ? 2 : 0);
  const dl = lp - u.lpPen, ds = sc - u.scPen;
  u.lpPen = lp; u.scPen = sc;
  if (ds > 0) u.sc = Math.max(0, u.sc - ds);
  if (dl > 0) { u.lp -= dl; if (u.lp <= 0) killUnit(u); }
}
function addStatus(u, k) {
  if (u.dead) return;
  const s = u.st;
  if (k === 'burn') s.burn = true;
  else if (k === 'chill') { if (s.frost) { /* 変化なし */ } else if (s.chill) { delete s.chill; s.frost = true; } else s.chill = true; }
  else if (k === 'poison') { if (s.venom) { /* 変化なし */ } else if (s.poison) { delete s.poison; s.venom = true; } else s.poison = true; }
  else if (k === 'paralyze') s.paralyze = true;
  else if (k === 'petrify') s.petrify = G.players[u.owner].count + 1;
  sfx('status'); log(`${nm(u)}が状態異常「${STATUS_NAME[statusKey(u, k)]}」になった`);
  recomputePen(u);
}
const STATUS_NAME = { burn: 'やけど', chill: 'しもやけ', frost: '凍傷', poison: '毒', venom: '猛毒', petrify: '石化', paralyze: 'まひ' };
const statusKey = (u, k) => (k === 'chill' && u.st.frost ? 'frost' : k === 'poison' && u.st.venom ? 'venom' : k);
function statusList(u) { return Object.keys(u.st).filter(k => u.st[k] != null && u.st[k] !== false); }
function cure(u, k) {
  if (k === 'frost') { delete u.st.frost; u.st.chill = true; }
  else if (k === 'venom') { delete u.st.venom; u.st.poison = true; }
  else delete u.st[k];
  recomputePen(u);
  u.sc = Math.min(u.sc, baseSC(u));
}
function killUnit(u) {
  if (u.dead) return;
  u.dead = true; sfx('kill');
  const p = G.players[u.owner];
  if (isAv(u)) { if (!G.over) { G.over = 1 - u.owner; log(`${p.name}のアバターが倒された`); if (UI.gameOver) UI.gameOver(G.over); } }
  else { p.grave.push(u.cid); log(`${nm(u)}が破壊された`); }
  if (u.weapon) p.grave.push(u.weapon);
  for (const a of u.attach) p.grave.push(a.cid);
  delete G.units[u.uid];
}
function damage(u, n, opts) {
  if (u.dead || (u.hidden && !(opts && opts.hit)) || n <= 0) return;
  fArmorCheck(u);
  if (armorTotal(u) > 0) {
    let a = Math.min(u.tArmor, n); u.tArmor -= a; n -= a;
    a = Math.min(u.gArmor, n); u.gArmor -= a; n -= a;
    a = Math.min(u.fArmor || 0, n); u.fArmor -= a; n -= a;
    if (n > 0 && u.armor > 0) { a = Math.min(u.armor, n); u.armor -= a; n -= a; }
  }
  if (n <= 0) return;
  u.lp -= n; sfx('hit');
  if (u.lp <= 0) { killUnit(u); return; }
  if (abU(u, 'superRegen')) heal(u, 1500); else if (abU(u, 'regen')) heal(u, 500);
}

/* ===== 移動 ===== */
/* 突撃司令：ホームテリトリー／ボーダーゾーンにいるキャラクターだけが対象（一度対象になれば、移動でエネミーに入っても効果は続く） */
const assaultOn = u => {
  if (!G.assault || G.assault.turn !== G.turn || u.owner !== G.assault.owner || isAv(u) || CARDS[u.cid].race !== G.assault.race) return false;
  if (!G.assault.hit) G.assault.hit = {};
  if (terr(u) !== 'enemy') G.assault.hit[u.uid] = true;
  return !!G.assault.hit[u.uid];
};
const hasShift = u => u.attach.some(a => a.cid === 'shiftForm' && G.players[u.owner].count >= a.since);
const hasHunting = u => tkOn(u, 'chase') || u.attach.some(a => a.cid === 'fightSpirit' && G.players[u.owner].count >= a.since);
/* 行動がすべて終わったか（2回行動・ハンティングの続きがあるなら、まだ終わっていない） */
function actionsDone(u) {
  if (!u || u.dead || u.acted <= 0) return false;
  try {
    if (movesFor(u).length) return false;
    if (hasHunting(u) && !assaultOn(u) && u.uses.hunt !== G.turn && u.owner === G.active && huntTargets(u).length) return false;
  } catch (e) { }
  return true;
}
function canActNow(u) {
  if (u.dead || u.hidden || G.over) return false;
  if (u.owner !== G.active) return false;
  if (u.st.petrify != null) return false;
  if (u.acted >= actLimit(u)) return false;
  if (u.placedAt === G.turn && !isAv(u) && !abU(u, 'haste') && !assaultOn(u) && u.agile !== G.turn) return false;
  return true;
}
function dirsFor(u, assault) {
  const dy = fwd(u.owner);
  const DIAG = [[-1, dy], [1, dy], [-1, -dy], [1, -dy]];
  let dirs = tkOn(u, 'mutate') ? DIAG : hasShift(u) ? [[-1, dy], [1, dy], [-1, -dy], [1, -dy]] : [[0, dy], [-1, 0], [1, 0], [0, -dy]];
  if (assault) dirs = dirs.filter(d => d[1] === dy);
  return dirs;
}
function evalCell(u, x, y) {
  if (!inB(x, y)) return 'out';
  if (wallAt(x, y) && !abU(u, 'flight')) return 'block';
  const t = at(x, y);
  if (!t || t.hidden) return 'empty'; // 非公開のキャラクターがいても、そのマスへは移動できる
  if (t.owner === u.owner) return 'ally';
  return 'enemy';
}
function movesFor(u) {
  if (!canActNow(u)) return [];
  const o = u.owner, dy = fwd(o);
  const assault = assaultOn(u), bers = abU(u, 'berserk');
  const len = assault || bers ? 2 : 1;
  const out = [];
  for (const d of dirsFor(u, assault)) {
    const backPure = d[0] === 0 && d[1] === -dy;
    const noBattle = backPure && !abU(u, 'backBattle') && !abU(u, 'ambush');
    const canHit = t => !noBattle && !(assault && isAv(t)) && !(extraOnly(u) && isAv(t));
    const cells = [];
    for (let k = 1; k <= len; k++) cells.push([u.x + d[0] * k, u.y + d[1] * k]);
    const cost = () => (assault ? 0 : 1 + (bers ? 1 : 0)); // SCは「1回の移動」につき消費（マス数ではない）
    const push = (type, c, steps, path) => { const cs = cost(); if (assault || scAvail(u) >= cs) out.push({ x: c[0], y: c[1], type, steps, cost: cs, path, back: backPure && type === 'attack' }); };
    if (len === 1) {
      const c = cells[0], r = evalCell(u, c[0], c[1]);
      if (r === 'empty') push('move', c, 1, [c]);
      else if (r === 'enemy' && canHit(at(c[0], c[1]))) push('attack', c, 1, [c]);
    } else {
      const a = cells[0], b = cells[1], ra = evalCell(u, a[0], a[1]);
      if (ra === 'enemy') { if (canHit(at(a[0], a[1]))) push('attack', a, 1, [a]); continue; }
      if (ra === 'empty' || ra === 'ally') {
        const rb = evalCell(u, b[0], b[1]);
        if (rb === 'empty') push('move', b, 2, [a, b]);
        else if (rb === 'enemy' && canHit(at(b[0], b[1]))) push('attack', b, 2, [a, b]);
        else if ((rb === 'out' || rb === 'block') && ra === 'empty') push('move', a, 1, [a]);
      }
    }
  }
  if (abU(u, 'assassin') && terr(u) === 'home' && !assault && scAvail(u) >= 1 && hiddenCards(o).some(h => h.x === u.x && h.y === u.y && h.ref !== u && !h.ref.marked)) {
    const seen = new Set(out.map(m => m.x + ',' + m.y));
    for (const h of hiddenCards(o).filter(v => v.ref !== u && !v.ref.marked && !(v.x === u.x && v.y === u.y))) {
      const k = h.x + ',' + h.y; if (seen.has(k)) continue; seen.add(k);
      const r = evalCell(u, h.x, h.y);
      if (r === 'empty') out.push({ x: h.x, y: h.y, type: 'move', steps: 1, cost: 1, path: [[h.x, h.y]] });
      else if (r === 'enemy' && !isAv(at(h.x, h.y)) && !extraOnly(u)) out.push({ x: h.x, y: h.y, type: 'attack', steps: 1, cost: 1, path: [[h.x, h.y]] });
    }
  }
  return out;
}
function huntTargets(u) {
  if (u.dead || u.st.petrify != null) return [];
  const dy = fwd(u.owner), bers = abU(u, 'berserk');
  const cost = 1 + (bers ? 1 : 0);
  if (scAvail(u) < cost) return [];
  const out = [];
  for (const d of dirsFor(u, false)) {
    const backPure = d[0] === 0 && d[1] === -dy;
    if (backPure && !abU(u, 'backBattle') && !abU(u, 'ambush')) continue;
    const x = u.x + d[0], y = u.y + d[1];
    if (evalCell(u, x, y) === 'enemy' && !isAv(at(x, y))) out.push({ x, y, cost, back: backPure });
  }
  return out;
}
const mustMove = u => (u.owner === G.active && (assaultOn(u) || (abU(u, 'berserk') && u.acted === 0)) && movesFor(u).length > 0);

async function slashTrigger(u) {
  const n = u.attach.filter(a => a.cid === 'windSlash').length;
  for (let k = 0; k < n; k++) {
    if (u.dead || G.over) return;
    const tg = chars(1 - u.owner);
    if (!tg.length) return;
    const r = await UI.pickBoard({ prompt: `ウインドスラッシュ${n > 1 ? `（${k + 1}/${n}）` : ''}：1000ダメージを与える相手キャラを選択`, cells: tg.map(t => [t.x, t.y]), kind: 'target', cancellable: false });
    const t = at(r[0][0], r[0][1]);
    if (!t) continue;
    if (await resist(t, 1, G.players[u.owner])) continue;
    log(`ウインドスラッシュ：${nm(t)}に1000ダメージ`);
    damage(t, 1000);
    UI.render();
  }
}
async function doMove(u, mv) {
  sfx('move');
  const from = { x: u.x, y: u.y };
  if (!assaultOn(u)) spendSC(u, mv.cost);
  u.acted++;
  const o = u.owner;
  for (let i = 0; i < mv.path.length; i++) {
    const [x, y] = mv.path[i];
    const last = i === mv.path.length - 1;
    if (mv.type === 'attack' && last) {
      await slashTrigger(u);
      if (u.dead || G.over) return;
      const d = enemyAt(x, y, o);
      if (!d) { u.x = x; u.y = y; }
      else {
        if (mv.back && abU(u, 'ambush')) u.ambushNow = true;
        let won; try { won = await battle(u, d); } finally { u.ambushNow = false; }
        if (G.over || u.dead) return;
        if (won) { u.x = x; u.y = y; } else { u.x = from.x; u.y = from.y; return; }
      }
    } else {
      u.x = x; u.y = y;
      await slashTrigger(u);
      if (u.dead || G.over) return;
    }
  }
  log(`${nm(u)}が${coord(from.x, from.y)}から${coord(u.x, u.y)}へ移動`);
  await onEntered(u, from);
}
async function onEntered(u, from) {
  const p = G.players[u.owner];
  fArmorCheck(u);
  await trapCheck(u);
  if (u.dead || G.over) return;
  await sanctuaryCheck(u);
  if (instinctActive(p) && terr(u) === 'enemy' && !(from && terrOfRow(rowOf(u.owner, from.y)) === 'enemy')) { u.lp += 1000; log(`本能解放：${nm(u)}のLP+1000`); }
  for (const c of U()) {
    if (c.owner !== u.owner && !c.hidden && abU(c, 'petrify') && !isAv(u) && c.x === u.x && c.y + fwd(c.owner) === u.y) addStatus(u, 'petrify');
  }
  checkAuras();
  if (u.dead || G.over) return;
  UI.render();
  if (hasHunting(u) && !assaultOn(u) && u.uses.hunt !== G.turn) await huntLoop(u);
}
async function huntLoop(u) {
  const mv = huntTargets(u);
  if (!mv.length) return;
  const r = await UI.pickBoard({ prompt: 'ハンティング：攻撃するマスを選択（SC' + mv[0].cost + '消費）', cells: mv.map(m => [m.x, m.y]), kind: 'attack', cancellable: true, cancelLabel: 'ハンティングしない' });
  if (!r) return;
  const m = mv.find(m => m.x === r[0][0] && m.y === r[0][1]);
  spendSC(u, m.cost); u.uses.hunt = G.turn;
  const from = { x: u.x, y: u.y };
  await slashTrigger(u);
  if (u.dead || G.over) return;
  const d = enemyAt(m.x, m.y, u.owner);
  if (!d) return;
  if (m.back && abU(u, 'ambush')) u.ambushNow = true;
  let won; try { won = await battle(u, d); } finally { u.ambushNow = false; }
  if (u.dead || G.over || !won) return;
  u.x = m.x; u.y = m.y;
  await onEntered(u, from);
}
function checkAuras() {
  for (const u of U()) if (u.noSanct && u.noSanct !== sKey(u.x, u.y)) delete u.noSanct;
  for (const u of U()) if (!u.dead) fArmorCheck(u);
  for (const d of U()) {
    if (d.dead || d.hidden || !abU(d, 'incinerate')) continue;
    const fx = d.x, fy = d.y + fwd(d.owner);
    const t = enemyAt(fx, fy, d.owner);
    if (t && !isAv(t)) {
      t.burnT = t.burnT || {};
      if (t.burnT[d.uid] !== G.turn) { t.burnT[d.uid] = G.turn; log(`焼却：${nm(t)}のLPを${d.lp}減らす`); damage(t, d.lp); }
    }
    const fk = sKey(fx, fy);
    if (wallAt(fx, fy) && wallAt(fx, fy).owner !== d.owner) { delete G.walls[fx + ',' + fy]; log('焼却：砂壁が破壊された'); }
    if (G.traps[fk] && G.traps[fk].owner !== d.owner) { delete G.traps[fk]; log('焼却：棘付きトラップが破壊された'); }
    if (G.sanctuaries[fk] && G.sanctuaries[fk].owner !== d.owner) { delete G.sanctuaries[fk]; log('焼却：魔法聖域が破壊された'); }
  }
}

/* ===== バトル ===== */
async function battle(att, def) {
  sfx('clash');
  log(`バトル：${nm(att)}（${coord(att.x, att.y)}）→ ${nm(def)}（${coord(def.x, def.y)}）`);
  UI.render();
  for (const [a, b] of [[att, def], [def, att]]) if (abU(a, 'poisonTouch') && !b.dead) addStatus(b, 'poison');
  for (const [a, b] of [[att, def], [def, att]]) {
    if (abU(a, 'assassinate') && !a.dead && !b.dead && !isAv(b) && String(CARDS[b.cid].race).includes('ヒューム') && b.lp <= 4000) {
      log(`${nm(a)}：バトル前に${nm(b)}（LP${b.lp}のヒューム）を破壊した`); killUnit(b);
      if (a === att) { const g = CARDS[b.cid].rank || 0; G.players[a.owner].coins += g; }
    }
  }
  if (att.dead) return false;
  if (def.dead) return true;
  if (G.over) return false;
  for (const [a, b] of [[att, def], [def, att]]) {
    if (abU(a, 'slime') && b.weapon) {
      const d = 1 + rnd(6); UI.toast(`🎲 スライムのサイコロ：${d}`);
      if (d >= 4) { G.players[b.owner].grave.push(b.weapon); b.weapon = null; b.armor = 0; b.spc = Math.min(b.spc, baseSpC(b)); log(`${nm(b)}の武器が破壊された`); }
    }
  }
  let forced = null;
  for (const side of [att, def]) { if (await goldenPrompt(side)) { forced = side === att ? 'att' : 'def'; break; } }
  const AV = att.lp + OP(att), DV = def.lp + DP(def);
  let win = false;
  if (forced === 'att') win = true;
  else if (forced === 'def') win = false;
  else if (AV >= DV) win = true;
  else { const dmg = Math.max(0, AV - DP(def)); log(`攻撃値${AV} < 防御値${DV}：${nm(def)}に${dmg}ダメージ`); damage(def, dmg); }
  if (!win && abU(def, 'counter') && !def.dead && !att.dead && def.owner !== G.active) { const cv = def.lp + OP(def); log(`カウンター：${nm(def)}がバトルに勝ち、攻撃値${cv}のダメージを${nm(att)}に与える`); damage(att, cv); }
  if (win) { log(`攻撃値${AV}（防御値${DV}）：攻撃側の勝利`); killUnit(def); if (!isAv(def)) { const g = CARDS[def.cid].rank; G.players[att.owner].coins += g; log(`バトルに勝利：${G.players[att.owner].name}の貨幣ゲージ+${g}（${G.players[att.owner].coins}）`); } }
  UI.render();
  return win;
}
/* ゴーレム：魔法耐性・超魔法耐性以外でSpCとして使えるのは1まで */
const spcUsable = u => u.spc;
const canPayAmt = (u, n) => !u.hidden && CARDS[u.cid].spc > 0 && u.st.petrify == null && spcUsable(u) + Math.floor(scAvail(u) / 2) >= n;
const spReduce = (u, n) => (G.curSpell && n >= 2 && holdsAttr(u, G.curSpell) ? n - 1 : n); // 属性一致：SpC2以上のスペルは必要SpC-1
async function payCost(p, n, flt) {
  const n0 = n;
  const cands = own(p.i).filter(u => canPayAmt(u, spReduce(u, n0)) && (!flt || flt(u)));
  if (!cands.length) { UI.toast(`SpC${n}を支払えるキャラクター／アバターがいません`); return null; }
  const r = await UI.pickBoard({ who: p.i, prompt: `SpC${n}を消費するキャラクターを選択`, cells: cands.map(c => [c.x, c.y]), kind: 'pay', cancellable: true });
  if (!r) return null;
  const u = at(r[0][0], r[0][1]);
  n = spReduce(u, n0); if (n < n0) log(`${nm(u)}は属性が一致するため、必要SpCが${n0}から${n}になった`);
  const use = Math.min(spcUsable(u), n), need = n - use, sc = need * 2;
  if (sc > 0) { if (!(await UI.confirm(`⚠ ${nm(u)}はSpCが${need}足りないため、SCを${sc}消費します。使用しますか？`, p.i))) return null; }
  u.spc -= use; spendSC(u, sc);
  return u;
}
async function payTech(p, cands, prompt) {
  const r = await UI.pickBoard({ prompt, cells: cands.map(c => [c.x, c.y]), kind: 'pay', cancellable: true });
  if (!r) return null;
  const u = at(r[0][0], r[0][1]);
  spendSC(u, 1);
  return u;
}
async function goldenPrompt(side) {
  if (isAv(side) || side.dead) return false;
  const p = G.players[side.owner];
  if (!p.hand.includes('goldenBody')) return false;
  if (!own(p.i).some(u => canPayAmt(u, 3))) return false;
  const a = await UI.ask(`【${p.name}に確認】${nm(side)}がバトルします。手札の「黄金の体」（SpC3）を使用しますか？`, ['使用する', '使用しない'], side.owner);
  if (a !== '使用する') return false;
  const py = await payCost(p, 3);
  if (!py) return false;
  p.hand.splice(p.hand.indexOf('goldenBody'), 1); p.grave.push('goldenBody');
  await UI.cutIn('goldenBody');
  side.counter = true; log(`黄金の体：${nm(side)}は必ず勝利し、「カウンター」を得た`);
  await onSpellUsed(p, 'goldenBody');
  return true;
}
const hasResist = u => abU(u, 'magicResist') || abU(u, 'superResist');
async function resist(t, cost, caster, opts = {}) {
  if (!hasResist(t) || t.hidden || t.dead) return false;
  if (!opts.wide && t.owner === caster.i) return false;
  const sup = abU(t, 'superResist');
  const need = sup ? cost : cost + 1;
  const rs = t.uses.sr && t.uses.sr.turn === G.turn ? t.uses.sr.n : 0;
  if (sup && rs >= 2) return false;
  if (t.spc + (t.rspc || 0) < need || t.st.petrify != null) return false;
  const a = await UI.ask(`【${G.players[t.owner].name}に確認】${nm(t)}の${sup ? '超魔法耐性' : '魔法耐性'}：SpC${need}（耐性SpCを先に使用）を支払い、スペルの効果を打ち消しますか？${sup ? `（このターンあと${2 - rs}回）` : ''}`, ['打ち消す', '受ける'], t.owner);
  if (a === '打ち消す') { const fromR = Math.min(t.rspc || 0, need); t.rspc = (t.rspc || 0) - fromR; t.spc -= need - fromR; if (sup) t.uses.sr = { turn: G.turn, n: rs + 1 }; log(`${nm(t)}は${sup ? '超魔法耐性' : '魔法耐性'}でスペルを打ち消した`); return true; }
  return false;
}
/* スペル使用の記録と、氷の魔女の誘発 */
async function onSpellUsed(p, cid) {
  p.spellsUsed++;
  const c = CARDS[cid]; let fire = false;
  if (c.rank >= 2) fire = true; else { p.r1Spells++; if (p.r1Spells % 2 === 0) fire = true; }
  if (!fire) return;
  for (const w of chars(p.i).filter(u => abU(u, 'witchChill'))) {
    const es = foes(p).filter(u => !u.dead);
    if (!es.length) break;
    const t = es[rnd(es.length)];
    log(`${nm(w)}：${nm(t)}が「しもやけ」状態になった`);
    addStatus(t, 'chill');
  }
}
function dwarfRedirect(t, user) {
  if (t.owner === user.i) return t;
  const d = own(t.owner).find(u => abU(u, 'dwarf') && !u.hidden && u !== t && !u.uses.dwarf);
  if (!d) return t;
  d.uses.dwarf = true; log(`庇護：対象が${nm(d)}に変更された`); UI.toast('庇護：対象がドワーフの戦士に変更された');
  return d;
}

/* ===== 配置 ===== */
const goblinCount = p => p.deckList.filter(c => CARDS[c].race === 'ゴブリン').length;
const wildCount = p => p.deckList.filter(c => CARDS[c].race === 'ワイルド' && CARDS[c].kind === 'char').length;
function slotKind(p, c) {
  if (p.goblinSlots > 0 && c.race === 'ゴブリン' && c.rank === 1) return 'goblin';
  if (p.summons < 1) return 'normal';
  if (p.extra > 0) return 'extra';
  return null;
}
async function summon(p, idx) {
  const cid = p.hand[idx], c = CARDS[cid];
  if (abC(cid, 'moonCond') && p.spellsUsed < 3) { UI.toast(`このゲーム中にスペルを3回以上使用していないと盤に出せません（現在${p.spellsUsed}回）`); return false; }
  if (abC(cid, 'hobCond') && goblinCount(p) < 9) { UI.toast('デッキに種族ゴブリンが9枚以上ないと場に出せません'); return false; }
  if (abC(cid, 'tigerCond') && wildCount(p) < 10) { UI.toast('デッキに種族ワイルドのキャラが10体以上ないと配置できません'); return false; }
  if (abC(cid, 'darkCond') && hiddenCards(p.i).filter(v => rowOf(p.i, v.y) <= 3).length < 2) { UI.toast('ホームテリトリーに非公開カードが2枚以上ないと盤に出せません'); return false; }
  let stealth = false;
  if (abC(cid, 'stealth')) stealth = (await UI.ask('潜伏を使用しますか？（非公開でホームテリトリーに置く）', ['使用する', '使用しない'])) === '使用する';
  if (!stealth && !slotKind(p, c)) { UI.toast('このターンはこれ以上キャラクターを配置できません'); return false; }
  let sac = [], sacSum = 0;
  if (abC(cid, 'sacrifice')) {
    const cand = chars(p.i), total = cand.reduce((s, u) => s + u.lp, 0);
    if (total < 1500) { UI.toast('生贄にできるキャラクターのLP合計が1500に届きません'); return false; }
    const r = await UI.pickBoard({ prompt: '生贄にするキャラクターを選択（LP合計1500以上）', cells: cand.map(u => [u.x, u.y]), multi: true, kind: 'target', confirmLabel: '生贄にして配置', cancellable: true, validate: sel => sel.reduce((s, [x, y]) => s + at(x, y).lp, 0) >= 1500, sumLabel: sel => `生贄LP合計：${sel.reduce((s, [x, y]) => s + at(x, y).lp, 0)}` });
    if (!r) return false;
    sac = r.map(([x, y]) => at(x, y)); sacSum = sac.reduce((s, u) => s + u.lp, 0);
  }
  const freed = new Set(sac.map(u => u.x + ',' + u.y));
  let rows = stealth ? [1, 2, 3] : [1];
  if ((c.name === 'オーガ' || cid === 'vampire') && sacSum >= 4500) rows = [1, 2];
  const cells = [];
  for (const r of rows) for (let x = 0; x < 7; x++) {
    const cc = cellOfRow(p.i, r, x);
    if ((!at(cc.x, cc.y) || freed.has(cc.x + ',' + cc.y)) && (!wallAt(cc.x, cc.y) || abC(cid, 'flight'))) cells.push([cc.x, cc.y]);
  }
  if (!cells.length) { UI.toast('配置できるマスがありません'); return false; }
  const pick = await UI.pickBoard({ prompt: '配置するマスを選択', cells, kind: 'place', cancellable: true });
  if (!pick) return false;
  await UI.cutIn(cid);
  for (const s of sac) killUnit(s);
  const hi = p.hand.indexOf(cid); p.hand.splice(hi, 1);
  if (!stealth) { const k = slotKind(p, c); if (k === 'goblin') p.goblinSlots--; else if (k === 'normal') p.summons++; else if (k === 'extra') p.extra--; }
  const u = mkUnit(p.i, cid, pick[0][0], pick[0][1]);
  sfx('summon');
  u.lp = baseLP(u);
  u.sacSum = sacSum;
  if (stealth) { u.hidden = true; u.hiddenSince = p.count; }
  log(`${p.name}：${c.name}を${coord(u.x, u.y)}に配置${stealth ? '（潜伏）' : ''}`);
  await etb(u, p, stealth);
  await sanctuaryCheck(u);
  return true;
}
async function etb(u, p, stealth) {
  if (abU(u, 'kingEtb')) {
    const n = 1 + Math.floor((u.sacSum || 0) / 3000);
    for (let k = 0; k < n; k++) {
      const head = `${k + 1}回目${n > 1 ? `／全${n}回` : ''}`, ptxt = `【${p.name}】${nm(u)}：デッキ外から手札に加えるテクニックを選ぶ`;
      const id = UI.pickCard ? await UI.pickCard(head, ptxt, ['tkMutate', 'tkFrenzy'], p.i)
        : ({ 変異: 'tkMutate', 発狂: 'tkFrenzy' }[await UI.ask(`§${head}\n${ptxt}\n■変異：${CARDS.tkMutate.txt[0]}\n■発狂：${CARDS.tkFrenzy.txt[0]}`, ['変異', '発狂'], p.i)] || 'tkMutate');
      p.hand.push(id); log(`${nm(u)}：テクニックドロー（${k + 1}回目）で「${CARDS[id].name}」を手札に加えた`);
      if (k < n - 1 && UI.pause) { UI.toast(`${k + 1}回目：「${CARDS[id].name}」を手札に加えた`); await UI.pause(500); }
    }
  }
  if (abU(u, 'witchEtb')) {
    const idx = r => p.deck.map((c, i) => i).filter(i => CARDS[p.deck[i]].kind === 'spell' && CARDS[p.deck[i]].rank === r);
    const d = 1 + rnd(6); UI.toast(`🎲 ${nm(u)}のサイコロ：${d}（d4以上でランク2）`);
    let pool = d >= 4 ? idx(2) : [];
    if (!pool.length) pool = idx(1);
    if (pool.length) { const i = pool[rnd(pool.length)]; const cc = p.deck.splice(i, 1)[0]; p.hand.push(cc); log(`${nm(u)}：スペルコレクト（出目${d}）でデッキから「${CARDS[cc].name}」を手札に加えた`); }
    else log(`${nm(u)}：スペルコレクト（出目${d}）：加えられるスペルがデッキになかった`);
  }
  if (abU(u, 'wizDice')) {
    const d = 1 + rnd(6), need = CARDS[u.cid].wiz || 4; UI.toast(`🎲 ${nm(u)}のサイコロ：${d}（d${need}以上で成功）`);
    if (d >= need) {
      const ids = p.deck.map((c, i) => i).filter(i => CARDS[p.deck[i]].kind === 'spell' && CARDS[p.deck[i]].rank === 1);
      if (ids.length) { const i = ids[rnd(ids.length)]; const c = p.deck.splice(i, 1)[0]; p.hand.push(c); log(`${nm(u)}：デッキから「${CARDS[c].name}」を手札に加えた`); }
    }
  }
  if (u.cid === 'normalGob' && !stealth) {
    if (p.hand.some(h => CARDS[h].kind === 'char' && CARDS[h].race === 'ゴブリン' && CARDS[h].rank === CARDS[u.cid].rank)) { p.goblinSlots++; log('ノーマルゴブリン：追加でゴブリンを1体配置できる'); }
  }
}
async function moonReset(u) {
  if (G.phase !== 'main' || u.owner !== G.active) return;
  const used = u.uses.moon || 0;
  if (used >= 2) { UI.toast('月光はゲーム中2回までです'); return; }
  if (scAvail(u) < 2 || u.st.petrify != null) { UI.toast('SCが2以上必要です'); return; }
  const a = await UI.ask(`月光：SCを2消費して、互いに手札を山札に戻し、3枚ずつ引きますか？（残り${2 - used}回）`, ['使う', 'キャンセル']);
  if (a !== '使う') return;
  spendSC(u, 2); u.uses.moon = used + 1;
  for (const q of G.players) { q.deck.push(...q.hand); q.hand = []; q.deck = shuffle(q.deck); draw(q, 3); }
  log('月光：互いに手札を山札に戻し、3枚ずつ引いた'); UI.render();
}
/* 非公開（潜伏）の公開：メインステップ中、必要なターンが経っていればいつでも */
async function revealUnit(u) {
  if (G.phase !== 'main' || u.owner !== G.active || !u.hidden || u.dead) return;
  const p = G.players[u.owner], rest = u.sanct ? 0 : u.hiddenSince + 3 - p.count;
  if (rest > 0) { UI.toast(`潜伏は、あと自分のターン${rest}回後から公開できます`); return; }
  if (U().some(v => v !== u && !v.dead && v.owner === u.owner && v.x === u.x && v.y === u.y)) { UI.toast('自分のキャラクターと同じマスにいる間は公開できません'); return; }
  sfx('reveal'); u.hidden = false; u.marked = false; if (u.sanct) { u.sanct = false; u.noSanct = sKey(u.x, u.y); } log(`${nm(u)}が姿を現した（${coord(u.x, u.y)}）`);
  const foe = U().find(v => !v.dead && !v.hidden && v.owner !== u.owner && v.x === u.x && v.y === u.y);
  if (foe) { log(`同じマスに${nm(foe)}がいたため、即座にバトル`); await battle(u, foe); }
}
/* 弓使い（サイコロ）／警戒 */
const archerNeed = u => {
  const c = CARDS[u.cid]; let n = c.archer || null;
  if (u.weapon === 'bowFine') n = n ? Math.max(1, n - 2) : (String(c.race).includes('エルフ') ? 4 : 6);
  return n;
};
const hasArcher = u => !!archerNeed(u);
async function archerShot(u) {
  if (G.phase !== 'main' || u.owner !== G.active || u.hidden || u.dead) return;
  const need = archerNeed(u); if (!need) return;
  if (u.uses.archer === G.turn) { UI.toast('弓使いは1ターンに1度だけです'); return; }
  if (scAvail(u) < 1 || u.st.petrify != null) { UI.toast('SCが1以上必要です'); return; }
  const tg = foes(G.players[u.owner]); if (!tg.length) { UI.toast('対象にできる相手キャラクターがいません'); return; }
  const a = await UI.ask(`弓使い：SCを1消費して、相手キャラ1体を狙いますか？（サイコロ${need}以上でLP-1000）`, ['使う', 'キャンセル']);
  if (a !== '使う') return;
  const t = await pickUnit(tg, '弓使い：狙う相手のキャラクターを選択'); if (!t) return;
  spendSC(u, 1); u.uses.archer = G.turn;
  const d = 1 + rnd(6); UI.toast(`🎲 弓使いのサイコロ：${d}（${need}以上で命中）`);
  if (d >= need) { log(`弓使い：${nm(u)}の矢が${nm(t)}に命中（サイコロ${d}）。LP-1000`); damage(t, 1000); } else log(`弓使い：${nm(u)}の矢は外れた（サイコロ${d}）`);
  UI.render();
}
async function scoutWatch(u) {
  if (G.phase !== 'main' || u.owner !== G.active || u.hidden || u.dead) return;
  if (u.uses.scout === G.turn) { UI.toast('警戒は1ターンに1度だけです'); return; }
  if (scAvail(u) < 1 || u.st.petrify != null) { UI.toast('SCが1以上必要です'); return; }
  const hs = hiddenCards(1 - u.owner).filter(v => rowOf(1 - u.owner, v.y) <= 3);
  if (!hs.length) { UI.toast('相手のホームテリトリーに非公開のカードがありません'); return; }
  const a = await UI.ask('警戒：SCを1消費して、相手の非公開カードを1枚確認しますか？', ['使う', 'キャンセル']);
  if (a !== '使う') return;
  const r = await UI.pickBoard({ prompt: '警戒：確認する非公開カードを選択', cells: [...new Set(hs.map(v => v.x + ',' + v.y))].map(s => s.split(',').map(Number)), kind: 'target', cancellable: true });
  if (!r) return;
  const here = hs.filter(v => v.x === r[0][0] && v.y === r[0][1]); if (!here.length) return;
  const t = here.find(v => v.unit) || here[0];
  spendSC(u, 1); u.uses.scout = G.turn; for (const h of here) h.ref.marked = true;
  log(`警戒：${coord(t.x, t.y)}の非公開カードを確認した`);
  if (UI.peek) UI.peek(u.owner, t.cid, coord(t.x, t.y));
  UI.render();
}
async function monkeyThrow(u) {
  if (G.phase !== 'main' || u.owner !== G.active) return;
  const used = u.uses.throw || 0;
  if (used >= 2) { UI.toast('投擲はゲーム中2回までです'); return; }
  if (scAvail(u) < 2 || u.st.petrify != null) { UI.toast('SCが2以上必要です'); return; }
  const a = await UI.ask(`投擲：SCを2消費して手札に「投石」を出現させますか？（残り${2 - used}回）`, ['使う', 'キャンセル']);
  if (a !== '使う') return;
  spendSC(u, 2); u.uses.throw = used + 1; G.players[u.owner].hand.push('stoneThrow'); log('投擲：手札に投石が出現'); UI.render();
}

/* ===== カード効果 ===== */
const mine = p => chars(p.i), foes = p => chars(1 - p.i);
const blizzardTargets = p => foes(p).filter(u => rowOf(p.i, u.y) >= 4);
const guardPayer = u => !u.hidden && u.spc >= 1 && u.st.petrify == null && CARDS[u.cid].spc > 0 && spcUsable(u) >= 1;
async function pickUnit(us, prompt) {
  const r = await UI.pickBoard({ prompt, cells: us.map(u => [u.x, u.y]), kind: 'target', cancellable: true });
  return r ? at(r[0][0], r[0][1]) : null;
}
const ferTargets = p => mine(p).filter(u => CARDS[u.cid].cat.includes('モンスター') && CARDS[u.cid].race === 'ワイルド' && terr(u) === 'home' && scAvail(u) >= 1 && u.spc >= 1 && u.st.petrify == null);
const canTechPay = u => u.acted === 0 && scAvail(u) >= 1 && u.st.petrify == null && !u.hidden && !u.dead;
async function equipWeapon(p, cid) {
  const cs = own(p.i).filter(u => !isAv(u) && CARDS[u.cid].weapon && !u.weapon && (cid !== 'wandFine' || CARDS[u.cid].spc >= 1));
  const u = await pickUnit(cs, cid === 'wandFine' ? '上等な魔杖を装備するキャラクター（SpC基礎値1以上）を選択' : '武器を装備するキャラクターを選択');
  if (!u) return false;
  await UI.cutIn(cid);
  u.weapon = cid; if (cid === 'shieldFine') u.armor = 1500; if (CARDS[cid].wspc) u.spc += CARDS[cid].wspc;
  log(`${nm(u)}が${CARDS[cid].name}を装備`);
  return 'kept';
}
const EQUIPPABLE = p => own(p.i).filter(u => !isAv(u) && CARDS[u.cid].weapon && !u.weapon).length ? null : '装備できるキャラクターがいません';
const EQUIP_WAND = p => own(p.i).filter(u => !isAv(u) && CARDS[u.cid].weapon && !u.weapon && CARDS[u.cid].spc >= 1).length ? null : 'SpCの基礎値が1以上で、武器を装備できるキャラクターがいません';
const potion = (f) => async function (p, cid) {
  const t0 = await pickUnit(allChars(), '対象のキャラクターを選択');
  if (!t0) return false;
  const t = dwarfRedirect(t0, p);
  await UI.cutIn(cid);
  f(t);
  return true;
};
const tkAct = (cid, key, label, name) => ({ can: () => (allChars().length ? null : '対象にできるキャラクターがいません'), async run(p) {
  const t = await pickUnit(allChars(), `${name}の対象を選択（次の${'そのキャラクターの持ち主の'}ターンの間「${label}」）`); if (!t) return false;
  await UI.cutIn(cid); (t.tk = t.tk || {})[key] = G.players[t.owner].count + 1; log(`${name}：${nm(t)}は次の${G.players[t.owner].name}のターンの間「${label}」`); return 'kept'; } });
const ACT = {
  signpost: { async run(p) { if (!(await payCost(p, 1))) return false; await UI.cutIn('signpost'); const n = draw(p, 2); log(`道標：${n}枚引いた`); return true; } },
  fireball: { can: p => (foes(p).length ? null : '対象にできる相手キャラクターがいません'), async run(p) {
    const t = await pickUnit(foes(p), '火球の対象を選択'); if (!t) return false;
    if (!(await payCost(p, 1))) return false; await UI.cutIn('fireball');
    if (!(await resist(t, 1, p))) { addStatus(t, 'burn'); damage(t, 2000); log(`火球：${nm(t)}に2000ダメージ`); }
    return true; } },
  spark: { can: p => (foes(p).length ? null : '対象にできる相手キャラクターがいません'), async run(p) {
    const t = await pickUnit(foes(p), 'スパークの対象を選択'); if (!t) return false;
    if (!(await payCost(p, 2))) return false; await UI.cutIn('spark');
    if (!(await resist(t, 2, p))) { damage(t, 2000); log(`スパーク：${nm(t)}に2000ダメージ`); if (!t.dead) addStatus(t, 'paralyze'); }
    return true; } },
  sandWall: { async run(p) {
    const cells = []; for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) if (!at(x, y) && !wallAt(x, y)) cells.push([x, y]);
    const r = await UI.pickBoard({ prompt: '砂壁を置くマスを選択', cells, kind: 'place', cancellable: true }); if (!r) return false;
    if (!(await payCost(p, 1))) return false; await UI.cutIn('sandWall');
    G.walls[r[0][0] + ',' + r[0][1]] = { owner: p.i, expire: p.count + 3 }; log(`砂壁を${coord(r[0][0], r[0][1])}に設置`); return true; } },
  freezeWind: { can: p => (foes(p).length ? null : '対象にできる相手キャラクターがいません'), async run(p) {
    const t = await pickUnit(foes(p), 'フリーズウインドの対象を選択'); if (!t) return false;
    if (!(await payCost(p, 1))) return false; await UI.cutIn('freezeWind');
    if (!(await resist(t, 1, p))) { t.sc = Math.max(0, t.sc - 4); addStatus(t, 'chill'); log(`フリーズウインド：${nm(t)}のSC-4`); }
    return true; } },
  shiftForm: { async run(p) {
    const cs = own(p.i).filter(u => !u.attach.some(a => a.cid === 'shiftForm'));
    const r = await UI.pickBoard({ prompt: '形質変化をつける自分のキャラクター／アバターを選択', cells: cs.map(u => [u.x, u.y]), kind: 'target', cancellable: true }); if (!r) return false;
    const u = at(r[0][0], r[0][1]);
    if (!(await payCost(p, 1))) return false; await UI.cutIn('shiftForm');
    u.attach.push({ cid: 'shiftForm', since: p.count + 1 }); log(`${nm(u)}に形質変化`); return 'kept'; } },
  teleport: { can: p => (mine(p).length >= 2 ? null : '自分のキャラクターが2体以上必要です'), async run(p) {
    const r = await UI.pickBoard({ prompt: '位置を入れ替える自分のキャラクターを2体選択', cells: mine(p).map(u => [u.x, u.y]), multi: true, kind: 'target', confirmLabel: '入れ替える', cancellable: true, validate: s => s.length === 2 }); if (!r) return false;
    if (!(await payCost(p, 2))) return false; await UI.cutIn('teleport');
    const a = at(r[0][0], r[0][1]), b = at(r[1][0], r[1][1]);
    log(`テレポート：${nm(a)}（${coord(a.x, a.y)}）と${nm(b)}（${coord(b.x, b.y)}）を入れ替えた`);
    [a.x, b.x] = [b.x, a.x]; [a.y, b.y] = [b.y, a.y];
    await sanctuaryCheck(a); await sanctuaryCheck(b); return true; } },
  reinforce: { async run(p) { if (!(await payCost(p, 2))) return false; await UI.cutIn('reinforce'); draw(p, 1); p.extra++; log('増援召喚：追加で1体召喚できる'); return true; } },
  magicGuard: { can: p => (!mine(p).length ? '対象にできる自分のキャラクターがいません' : own(p.i).some(guardPayer) ? null : 'SpC1以上のキャラクター／アバターが必要です'), async run(p) {
    const t = await pickUnit(mine(p), '魔法壁の対象（自分のキャラクター）を選択'); if (!t) return false;
    const cands = own(p.i).filter(guardPayer);
    const r = await UI.pickBoard({ who: p.i, prompt: '魔法壁：SpC／SCを消費するキャラクターを選択（SpC1以上）', cells: cands.map(c => [c.x, c.y]), kind: 'pay', cancellable: true }); if (!r) return false;
    const u = at(r[0][0], r[0][1]);
    const maxN = Math.min(8, spcUsable(u) + Math.floor(scAvail(u) / 2));
    const labels = [];
    for (let n = 1; n <= maxN; n++) { const a = Math.min(spcUsable(u), n), c = (n - a) * 2; labels.push(`${n}回分（SpC${a}${c ? '＋SC' + c : ''}）→ 装甲${1000 * n}`); }
    const ans = await UI.ask(`魔法壁：どれだけ消費しますか？（SpCが尽きたら2SCごとに1回分）`, [...labels, 'キャンセル'], p.i);
    const n = labels.indexOf(ans) + 1; if (n < 1) return false;
    const a = Math.min(spcUsable(u), n), c = (n - a) * 2;
    u.spc -= a; spendSC(u, c);
    await UI.cutIn('magicGuard');
    t.gArmor += 1000 * n; log(`魔法壁：${nm(t)}に装甲${1000 * n}（SpC${a}${c ? '・SC' + c : ''}消費）`); return true; } },
  chaosHand: { can: p => (foes(p).length && mine(p).length ? null : '自分と相手のキャラクターが1体ずつ必要です'), async run(p) {
    const e = await pickUnit(foes(p), '混沌の手：LPを減らす相手キャラを選択'); if (!e) return false;
    const m = await pickUnit(mine(p), '混沌の手：LPを増やす自分のキャラを選択'); if (!m) return false;
    if (!(await payCost(p, 1))) return false; await UI.cutIn('chaosHand');
    if (!(await resist(e, 1, p))) damage(e, 1000);
    m.lp += 1000; m.buffs.push({ k: 'lp', amt: 1000, who: p.i, until: p.count + 2 }); log(`混沌の手：${nm(m)}のLP+1000（一時）`); return true; } },
  aquaReturn: { can: p => (allChars().some(u => u.lp <= 3000) ? null : 'LP3000以下のキャラクターがいません'), async run(p) {
    const t = await pickUnit(allChars().filter(u => u.lp <= 3000), 'アクアリターンの対象（LP3000以下）を選択'); if (!t) return false;
    if (!(await payCost(p, 1))) return false; await UI.cutIn('aquaReturn');
    if (await resist(t, 1, p)) return true;
    const o = G.players[t.owner]; if (t.weapon) o.grave.push(t.weapon); for (const a of t.attach) o.grave.push(a.cid);
    o.hand.push(t.cid); delete G.units[t.uid]; t.dead = true; log(`アクアリターン：${CARDS[t.cid].name}が手札に戻った`); return true; } },
  goldenBody: { can: () => '黄金の体はバトル時にのみ使用できます' },
  instinct: { async run(p) {
    if (!(await payCost(p, 2))) return false; await UI.cutIn('instinct');
    const perm = mine(p).filter(u => CARDS[u.cid].race === 'ワイルド').length >= 3;
    p.instinct = { until: p.count + 3, perm }; log(`本能解放${perm ? '（永続）' : ''}`); return true; } },
  blizzard: { can: p => (blizzardTargets(p).length ? null : '対象にできる相手キャラクターがいません（ボーダーゾーン／エネミーテリトリー内が対象）'), async run(p) {
    if (!(await payCost(p, 4))) return false; await UI.cutIn('blizzard');
    for (const t of blizzardTargets(p)) {
      if (t.dead) continue;
      if (await resist(t, 4, p)) continue;
      t.sc = Math.max(0, t.sc - 3); addStatus(t, 'chill');
    }
    log('終焉のブリザード：相手キャラが「しもやけ」状態になりSC-3'); return true; } },
  thunderStorm: { async run(p) {
    if (!(await payCost(p, 4))) return false; await UI.cutIn('thunderStorm');
    for (const u of chars(p.i).filter(u => terr(u) === 'home')) u.tArmor += 4000;
    log('サンダーストーム：ホームテリトリーの自分のキャラに装甲値4000（このターン限り）');
    const flying = (type, i) => allChars().some(u => abU(u, 'flight') && (type === 'col' ? u.x : u.y) === i);
    const pick = (type, excl) => { const c = [0, 1, 2, 3, 4, 5, 6].filter(i => !excl.includes(i)); const w = c.map(i => (flying(type, i) ? 2 : 1)); let r = RNG() * w.reduce((a, b) => a + b, 0); for (let k = 0; k < c.length; k++) { r -= w[k]; if (r < 0) return c[k]; } return c[c.length - 1]; };
    const rounds = ['col', 'row', 'col'];
    for (const type of rounds) {
      if (G.over) break;
      const chosen = [];
      if (UI.thunderRound) UI.thunderRound();
      for (let k = 0; k < 3; k++) {
        const idx = pick(type, chosen); chosen.push(idx);
        log(`サンダーストーム：${type === 'col' ? idx + 1 + '列' : String.fromCharCode(65 + idx) + '列'}に落雷`);
        if (UI.thunderStep) await UI.thunderStep({ type, idx });
      }
      const hit = U().filter(u => !isAv(u) && !u.dead && chosen.includes(type === 'col' ? u.x : u.y)).sort((a, b) => a.uid - b.uid);
      for (const u of hit) {
        if (u.dead) continue;
        if (await resist(u, 2, p, { wide: true })) continue;
        let tg = u;
        const dw = own(u.owner).find(d => abU(d, 'dwarf') && !d.hidden && !d.dead && d !== u && !d.uses.dwarf);
        if (dw && (await UI.confirm(`【${G.players[u.owner].name}に確認】庇護：${nm(dw)}が${nm(u)}の代わりに雷のダメージを受けますか？（ゲーム中1度だけ）`, u.owner))) { dw.uses.dwarf = true; tg = dw; log(`庇護：${nm(dw)}が代わりに受けた`); }
        log(`落雷：${nm(tg)}（${coord(tg.x, tg.y)}）に4000ダメージ`);
        damage(tg, 4000, { hit: true });
      }
      checkAuras(); UI.render();
    }
    if (UI.thunderEnd) await UI.thunderEnd();
    return true; } },
  createGolem: {
    can: p => {
      const cells = [0, 1, 2, 3, 4, 5, 6].filter(x => { const cc = cellOfRow(p.i, 1, x); return !at(cc.x, cc.y) && !wallAt(cc.x, cc.y); });
      return cells.length || own(p.i).some(u => golemStep(u) && golemStep(u) < 3) ? null : '配置できるマスも、進められるゴーレムもありません';
    },
    async run(p, cid) {
      const ups = own(p.i).filter(u => !u.hidden && golemStep(u) && golemStep(u) < 3);
      const cells = [0, 1, 2, 3, 4, 5, 6].map(x => cellOfRow(p.i, 1, x)).filter(cc => !at(cc.x, cc.y) && !wallAt(cc.x, cc.y)).map(cc => [cc.x, cc.y]);
      let mode = 'new';
      if (ups.length && cells.length) { const a = await UI.ask('クリエイトゴーレム：どちらを行いますか？', ['新しく出す', 'ステップを進める', 'キャンセル']); if (a === 'キャンセル') return false; mode = a === '新しく出す' ? 'new' : 'up'; }
      else if (ups.length) mode = 'up';
      let target = null, pos = null;
      if (mode === 'up') { const r = await UI.pickBoard({ prompt: 'ステップを進めるゴーレムを選択', cells: ups.map(u => [u.x, u.y]), kind: 'target', cancellable: true }); if (!r) return false; target = at(r[0][0], r[0][1]); }
      else { const r = await UI.pickBoard({ prompt: 'ゴーレムを配置するマスを選択', cells, kind: 'place', cancellable: true }); if (!r) return false; pos = r[0]; }
      if (!(await payCost(p, mode === 'up' ? 2 + golemStep(target) : 2))) return false;
      await UI.cutIn('createGolem');
      if (mode === 'up') {
        const n = golemStep(target) + 1;
        target.cid = 'golem' + n; target.lp += 2000; target.rspc = (target.rspc || 0) + 1;
        log(`クリエイトゴーレム：${coord(target.x, target.y)}のゴーレムがステップ${n}になった`);
      } else {
        const u = mkUnit(p.i, 'golem1', pos[0], pos[1]); u.armor = 2000;
        log(`クリエイトゴーレム：ゴーレム（ステップ1）を${coord(u.x, u.y)}に配置`);
      }
      p.golemRet = p.golemRet || 0;
      if (p.golemRet < 3 && (await UI.ask(`クリエイトゴーレムを山札に戻し、シャッフルしますか？（残り${3 - p.golemRet}回）`, ['山札に戻す', '墓地に置く'])) === '山札に戻す') {
        p.golemRet++; p.deck.push(cid); p.deck = shuffle(p.deck); log('クリエイトゴーレム：山札に戻してシャッフルした'); return 'kept';
      }
      return true;
    } },
  thornTrap: { can: p => (trapCells(p).length ? null : '設置できるマスがありません'), async run(p) {
    const cells = trapCells(p);
    const r = await UI.pickBoard({ prompt: '棘付きトラップを設置するマス（自分のホームテリトリー）を選択', cells, kind: 'place', cancellable: true }); if (!r) return false;
    const hid = (await UI.ask('棘付きトラップを非公開で置きますか？', ['非公開で置く', '公開で置く'])) === '非公開で置く';
    G.traps[sKey(r[0][0], r[0][1])] = { owner: p.i, hidden: hid };
    log(`棘付きトラップ：${hid ? '非公開で' : ''}${coord(r[0][0], r[0][1])}に設置`); if (!hid) await UI.cutIn('thornTrap'); return true; } },
  magicSanctuary: { async run(p) {
    const cells = [];
    for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) if (rowOf(p.i, y) <= 3 && !G.sanctuaries[sKey(x, y)]) cells.push([x, y]);
    if (!cells.length) { UI.toast('設置できるマスがありません'); return false; }
    const r = await UI.pickBoard({ prompt: '魔法聖域を設置するマス（自分のホームテリトリー）を選択', cells, kind: 'place', cancellable: true }); if (!r) return false;
    if (!(await payCost(p, 1))) return false; await UI.cutIn('magicSanctuary');
    const k = sKey(r[0][0], r[0][1]); G.sanctuaries[k] = { owner: p.i };
    log(`魔法聖域：${coord(r[0][0], r[0][1])}に設置`);
    for (const u of U().filter(u => u.owner === p.i && !u.dead && !u.hidden && !isAv(u) && u.x === r[0][0] && u.y === r[0][1])) await sanctuaryCheck(u);
    return true; } },
  redDragonBreath: { can: p => (own(p.i).some(u => !isAv(u) && canPayAmt(u, holdsAttr(u, 'redDragonBreath') ? 2 : 3)) ? null : 'SpC3を支払えるキャラクターがいません（アバターは対象にできません）'), async run(p) {
    const u = await payCost(p, 3, v => !isAv(v)); if (!u) return false; await UI.cutIn('redDragonBreath');
    u.attach.push({ cid: 'redDragonBreath', since: p.count, until: p.count + 2 }); log(`レッドドラゴンブレス：${nm(u)}に「焼却」を与えた`); checkAuras(); return 'kept'; } },
  windSlash: { async run(p) {
    const cs = mine(p).filter(u => !isAv(u));
    const r = await UI.pickBoard({ prompt: 'ウインドスラッシュを装備する自分のユニットを選択', cells: cs.map(u => [u.x, u.y]), kind: 'target', cancellable: true }); if (!r) return false;
    const u = at(r[0][0], r[0][1]);
    if (!(await payCost(p, 1))) return false; await UI.cutIn('windSlash');
    u.attach.push({ cid: 'windSlash', since: p.count, until: p.count + 2 }); log(`${nm(u)}にウインドスラッシュ`); return 'kept'; } },
  swordFine: { can: EQUIPPABLE, run: (p, c) => equipWeapon(p, c) },
  bowFine: { can: EQUIPPABLE, run: (p, c) => equipWeapon(p, c) },
  shieldFine: { can: EQUIPPABLE, run: (p, c) => equipWeapon(p, c) },
  wandFine: { can: EQUIP_WAND, run: (p, c) => equipWeapon(p, c) },
  stoneThrow: { can: () => (allChars().length ? null : '対象がいません'), run: potion(t => { log(`投石：${nm(t)}に1500ダメージ`); damage(t, 1500); }) },
  staminaPotion: { can: () => (allChars().length ? null : '対象がいません'), run: potion(t => { t.sc += 2; heal(t, 1000); log(`スタミナポーション：${nm(t)}`); }) },
  magicPotion: { can: () => (allChars().length ? null : '対象がいません'), run: potion(t => { t.spc += 1; heal(t, 1000); log(`マジックポーション：${nm(t)}`); }) },
  hyperPotion: { can: () => (allChars().length ? null : '対象がいません'), run: potion(t => {
    const ss = statusList(t); if (ss.length) { const k = ss[rnd(ss.length)]; cure(t, k); log(`ハイパーポーション：${nm(t)}の${STATUS_NAME[k]}を治療`); }
    heal(t, 2000); }) },
  gobFlute: { async run(p) {
    await UI.cutIn('gobFlute');
    const pool = [];
    p.deck.forEach((c, i) => { if (CARDS[c].race === 'ゴブリン') pool.push(['deck', i]); });
    p.grave.forEach((c, i) => { if (CARDS[c].race === 'ゴブリン') pool.push(['grave', i]); });
    const pick = shuffle(pool).slice(0, 2);
    const got = pick.map(([z, i]) => CARDS[p[z][i]].name);
    const rm = { deck: [], grave: [] }; pick.forEach(([z, i]) => rm[z].push(i));
    for (const z of ['deck', 'grave']) { rm[z].sort((a, b) => b - a).forEach(i => p.hand.push(p[z].splice(i, 1)[0])); }
    log(`ゴブリンの笛：${got.join('、') || 'なし'}を手札に加えた`); return true; } },
  gobParade: { can: p => (mine(p).filter(u => CARDS[u.cid].race === 'ゴブリン' && CARDS[u.cid].cat === 'モンスター').length >= 3 ? (p.parade ? 'すでに効果が適用されています' : (mine(p).some(canTechPay) ? null : 'SCを消費できるキャラクターがいません')) : '種族ゴブリンのモンスターが3体以上必要です'), async run(p) {
    const cs = mine(p).filter(u => CARDS[u.cid].race === 'ゴブリン' && CARDS[u.cid].cat === 'モンスター' && canTechPay(u));
    const u = await payTech(p, cs, 'SCを1消費するゴブリンを選択（行動済みは選べません）'); if (!u) return false;
    await UI.cutIn('gobParade'); p.parade = true;
    for (const x of mine(p)) if (isGobName(x)) x.lp += 1500;
    log('ゴブリンパレード：ゴブリンのLP+1500（永続）'); return true; } },
  assault: { can: p => (mine(p).some(u => canTechPay(u) && mine(p).filter(v => CARDS[v.cid].race === CARDS[u.cid].race).length >= 3) ? null : '同じ種族が3体以上いて、SCを消費できるキャラクターが必要です'), async run(p) {
    const cs = mine(p).filter(u => canTechPay(u) && mine(p).filter(v => CARDS[v.cid].race === CARDS[u.cid].race).length >= 3);
    const u = await payTech(p, cs, 'SCを1消費するキャラクターを選択（同じ種族が突撃します）'); if (!u) return false;
    await UI.cutIn('assault'); G.assault = { owner: p.i, race: CARDS[u.cid].race, turn: G.turn, hit: {} };
    log(`突撃司令：種族「${CARDS[u.cid].race}」は必ず2マス前進する`); return true; } },
  petrifyRay: { can: p => (foes(p).length ? null : '対象にできる相手キャラクターがいません'), async run(p) {
    const t = await pickUnit(foes(p), '石化光線の対象を選択'); if (!t) return false;
    if (!(await payCost(p, 1))) return false; await UI.cutIn('petrifyRay');
    if (!(await resist(t, 1, p))) { addStatus(t, 'petrify'); log(`石化光線：${nm(t)}が石化した`); }
    return true; } },
  elixir: { can: () => (allChars().length ? null : '対象がいません'), run: potion(t => {
    for (let g = 0; g < 8 && statusList(t).length; g++) for (const k of statusList(t)) cure(t, k);
    t.lp = Math.max(t.lp, healCap(t)); t.sc += 2; t.spc += 1; log(`エリクサー：${nm(t)}の状態異常を全て治療し、LPを全回復。SC+2・SpC+1`); }) },
  shopTicket: { can: () => 'ショップで購入するときに自動で消費されます（使用はできません）', run: async () => false },
  tkFrenzy: tkAct('tkFrenzy', 'frenzy', '狂乱', '発狂'),
  tkAmbush: tkAct('tkAmbush', 'ambush', 'ふいうち', '奇襲'),
  tkChase: tkAct('tkChase', 'chase', 'ハンティング', '追跡'),
  tkMutate: tkAct('tkMutate', 'mutate', '斜め移動のみ', '変異'),
  tkAgile: { can: p => (own(p.i).some(u => !u.hidden && !isAv(u) && u.placedAt === G.turn && u.agile !== G.turn) ? null : 'このターンに配置したキャラクターがいません'), async run(p) {
    const cs = own(p.i).filter(u => !u.hidden && !isAv(u) && u.placedAt === G.turn && u.agile !== G.turn);
    const t = await pickUnit(cs, '俊敏の対象（このターンに配置した自分のキャラクター）を選択'); if (!t) return false;
    await UI.cutIn('tkAgile'); t.agile = G.turn; log(`俊敏：${nm(t)}は配置したターンから移動できる`); return 'kept'; } },
  ferocious: {
    can: p => (ferTargets(p).length ? null : '自分のホームテリトリーに、SCとSpCが1以上の種族ワイルドのモンスターが必要です'),
    async run(p, cid) {
      const ts = ferTargets(p);
      const t = await pickUnit(ts, '獰猛なる覇者の加護：対象のモンスターを選択（SCとSpCを1ずつ消費）'); if (!t) return false;
      await UI.cutIn('ferocious');
      draw(p, 1);
      spendSC(t, 1); t.spc -= 1; t.extra = p.count + 1; t.lpBonus = (t.lpBonus || 0) + 500; t.lp += 500;
      log(`獰猛なる覇者の加護：${nm(t)}の次の自分のターンの行動回数+1・LP+500（SC-1・SpC-1）`); return true; } },
  fightSpirit: { can: p => (mine(p).some(u => CARDS[u.cid].race === 'ワイルド' && u.spc >= 1) ? (mine(p).some(canTechPay) ? null : 'SCを消費できるキャラクターがいません') : '現在のSpCが1以上の種族ワイルドが必要です'), async run(p) {
    const u = await payTech(p, mine(p).filter(canTechPay), '闘争心をつけるキャラクターを選択（SCを1消費）'); if (!u) return false;
    await UI.cutIn('fightSpirit'); u.attach.push({ cid: 'fightSpirit', since: p.count + 1 }); log(`${nm(u)}に闘争心`); return 'kept'; } },
};
async function playHand(idx) {
  const p = cur();
  if (G.phase !== 'main' || G.over) return;
  const cid = p.hand[idx], c = CARDS[cid];
  if (c.kind === 'char') await summon(p, idx);
  else {
    const A = ACT[cid], why = A.can && A.can(p);
    if (why) { UI.toast(why); return; }
    p.hand.splice(idx, 1);
    let r = false;
    G.curSpell = c.kind === 'spell' ? cid : null;
    try { r = await A.run(p, cid); } catch (e) { console.error(e); }
    G.curSpell = null;
    if (r === false) p.hand.splice(Math.min(idx, p.hand.length), 0, cid);
    else if (r !== 'kept') p.grave.push(cid);
    if (r !== false && c.kind === 'spell') await onSpellUsed(p, cid);
  }
  afterAction();
}
function sanctForce() {
  for (const u of U()) if (u.hidden && u.sanct && !u.dead && baseLP(u) > 4000 && !U().some(v => v !== u && !v.dead && v.owner === u.owner && v.x === u.x && v.y === u.y)) {
    u.hidden = false; u.marked = false; u.sanct = false; u.noSanct = sKey(u.x, u.y); log(`${nm(u)}のLPが4000を超えたため、強制的に公開された（${coord(u.x, u.y)}）`);
    const foe = U().find(v => !v.dead && !v.hidden && v.owner !== u.owner && v.x === u.x && v.y === u.y);
    if (foe) { log(`同じマスに${nm(foe)}がいたため、即座にバトル`); battle(u, foe); }
  }
}
function afterAction() { sanctForce(); checkAuras(); UI.render(); if (G.over) UI.gameOver(G.over); }

/* ===== マジックサンクチュアリ ===== */
const sKey = (x, y) => x + ',' + y;
const trapCells = p => { const out = []; for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) if (rowOf(p.i, y) <= 3 && !G.traps[sKey(x, y)]) out.push([x, y]); return out; };
async function trapCheck(u) {
  if (!u || u.dead || isAv(u) || u.hidden) return;
  const k = sKey(u.x, u.y), t = G.traps[k];
  if (!t || t.owner === u.owner || abU(u, 'flight')) return;
  delete G.traps[k];
  log(`棘付きトラップ：${coord(u.x, u.y)}の${t.hidden ? '非公開だった' : ''}トラップが発動（${nm(u)}のLPを5000下げる）`);
  await UI.cutIn('thornTrap');
  const before = u.lp; damage(u, 5000);
  if (!u.dead) { const dealt = before - u.lp; if (dealt > 2000) { u.trapLoss = (u.trapLoss || 0) + (dealt - 2000); log(`${nm(u)}：このダメージのうち回復できるのは2000まで（最大LP-${dealt - 2000}）`); } }
  UI.render();
}
async function sanctuaryCheck(u) {
  if (!u || u.dead || isAv(u) || u.hidden || abU(u, 'flight')) return;
  const k = sKey(u.x, u.y);
  if (u.noSanct && u.noSanct !== k) delete u.noSanct;
  const s = G.sanctuaries[k];
  if (!s || s.owner !== u.owner || u.noSanct === k || baseLP(u) > 4000) return;
  const a = await UI.ask(`【${G.players[u.owner].name}に確認】魔法聖域：${nm(u)}を非公開にしますか？（SCとSpCのターン終了時の回復量+1）`, ['非公開にする', 'しない'], u.owner);
  if (a !== '非公開にする') return;
  if (!u.hidden) u.marked = true; // 隠れる前の姿は相手に見えているので「警戒」と同じ印をつける
  u.hidden = true; u.sanct = true; u.hiddenSince = G.players[u.owner].count;
  log(`魔法聖域：${nm(u)}が非公開になった（${coord(u.x, u.y)}）`);
}

/* ===== 貨幣ゲージ・アイテムショップ ===== */
const soldPrice = cid => (sellOf(cid) === 0 ? 1 : sellOf(cid) * 2); // 売値0のカードは、売っても貨幣ゲージは増えず、ショップの買値は1になる
const sellOf = cid => (CARDS[cid].kind === 'item' && CARDS[cid].sell != null && !CARDS[cid].noSell ? CARDS[cid].sell : null);
const canBuyRight = p => p.freeBuy > 0 || p.hand.includes('shopTicket');
function refreshShop() {
  const pool = r => Object.keys(CARDS).filter(id => CARDS[id].kind === 'item' && CARDS[id].sell > 0 && CARDS[id].rank === r);
  const shop = [];
  for (let k = 0; k < 3; k++) {
    const r = rnd(100) < 5 ? 2 : 1;
    let cand = pool(r).filter(id => !shop.some(s => s.cid === id));
    if (!cand.length) cand = pool(3 - r).filter(id => !shop.some(s => s.cid === id));
    if (!cand.length) break;
    const cid = cand[rnd(cand.length)];
    shop.push({ cid, price: CARDS[cid].sell * 2, sold: false });
  }
  G.shop = shop;
  const keep = [];
  for (const s of G.shopUsed || []) {
    if (s.sold) continue;
    s.age++;
    if (s.age >= 2) { G.players[s.from].grave.push(s.cid); log(`アイテムショップ：売却品「${CARDS[s.cid].name}」が期限切れで墓地へ`); } else keep.push(s);
  }
  G.shopUsed = keep;
  log(`アイテムショップ入れ替え：${shop.map(s => CARDS[s.cid].name + '(' + s.price + ')').join('、')}`);
}
const shopItems = () => [...G.shop, ...(G.shopUsed || [])];
function sellCard(i) {
  const p = cur(); if (G.phase !== 'main' || G.over) return;
  const cid = p.hand[i]; if (!cid || sellOf(cid) == null) return;
  if (p.sellUsed) { UI.toast('カードを売れるのは1ターンに1回までです'); return; }
  sfx('coin'); p.sellUsed = true; p.hand.splice(i, 1); p.hand.push('shopTicket'); p.coins += sellOf(cid);
  G.shopUsed.push({ cid, price: soldPrice(cid), age: 0, from: p.i, used: true, sold: false });
  log(`${p.name}：${CARDS[cid].name}を売って貨幣ゲージ+${sellOf(cid)}（${p.coins}）。ショップに買値${soldPrice(cid)}で並んだ。ショップチケットを1枚入手`); afterAction();
}
function buyShop(k) {
  sfx('coin');
  const p = cur(); if (G.phase !== 'main' || G.over) return;
  const s = shopItems()[k]; if (!s || s.sold) { UI.toast('すでに売り切れです'); return; }
  if (p.coins < s.price) { UI.toast(`貨幣ゲージが足りません（必要${s.price}／所持${p.coins}）`); return; }
  if (!canBuyRight(p)) { UI.toast('購入権利がありません（無料の購入権は使用済み。ショップチケットが必要です）'); return; }
  let how;
  if (p.freeBuy > 0) { p.freeBuy--; how = '無料の購入権'; } else { p.hand.splice(p.hand.indexOf('shopTicket'), 1); p.grave.push('shopTicket'); how = 'ショップチケット'; }
  p.coins -= s.price; s.sold = true; p.hand.push(s.cid);
  log(`${p.name}：${CARDS[s.cid].name}を購入（貨幣ゲージ-${s.price}、残り${p.coins}／${how}を消費）`); afterAction();
}

/* ===== ターン進行 ===== */
const instinctActive = p => !!p.instinct && (p.instinct.perm || p.count <= p.instinct.until);
async function startTurn(i) {
  G.active = i; const p = G.players[i];
  if (i === 0) refreshShop();
  G.turn++; p.count++; p.r1Spells = 0; p.sellUsed = false; p.summons = 0; p.extra = 0; p.goblinSlots = 0; G.assault = null;
  for (const u of own(i)) u.acted = 0;
  G.phase = 'start'; UI.render();
  await UI.turnOverlay(p);
  draw(p, 1); log(`--- ${p.name}のターン${p.count} ---`);
  G.phase = 'draw'; UI.render();
  G.phase = 'main'; afterAction();
}
async function endTurn() {
  const p = cur();
  if (G.over) return false;
  const forced = own(p.i).filter(mustMove);
  if (forced.length) { UI.toast(`必ず移動しなければならないキャラクターがいます：${forced.map(nm).join('、')}`); return false; }
  const c = p.count;
  for (const k of Object.keys(G.walls)) if (G.walls[k].owner === p.i && c >= G.walls[k].expire) { delete G.walls[k]; log('砂壁が崩れた'); }
  for (const u of U()) {
    u.buffs = u.buffs.filter(b => { if (b.who === p.i && G.players[b.who].count >= b.until) { if (b.k === 'lp') u.lp = Math.max(1, u.lp - b.amt); return false; } return true; });
    if (u.owner === p.i) {
      u.attach = u.attach.filter(a => { if (a.until !== undefined && c >= a.until) { p.grave.push(a.cid); return false; } return true; });
      if (u.st.petrify != null && c >= u.st.petrify) delete u.st.petrify;
      if (u.tk) for (const k of Object.keys(u.tk)) if (u.tk[k] <= c) delete u.tk[k];
    }
  }
  if (p.instinct && !p.instinct.perm && c >= p.instinct.until) p.instinct = null;
  for (const u of own(p.i)) {
    u.tArmor = 0;
    const b = baseLP(u); if (u.lp < b) u.lp = b;
    const home = terr(u) !== 'enemy';
    u.sc = Math.max(u.sc, Math.min(baseSC(u), u.sc + (home ? 2 : 1) + (u.sanct ? 1 : 0)));
    { const pts = (home ? 1 : 0) + (u.sanct ? 1 : 0), gap = Math.max(0, baseSpC(u) - u.spc), use = Math.min(gap, pts);
      u.spc = Math.max(u.spc, Math.min(baseSpC(u), u.spc + use));
      // 通常のSpCが優先して回復し、通常のSpCが最大になっている場合のみ、余った分が魔法耐性用SpCの回復に回る
      if (baseRSpC(u) > 0) u.rspc = Math.max(u.rspc || 0, Math.min(baseRSpC(u), (u.rspc || 0) + (pts - use))); }
  }
  if (!(p.i === 0 && p.count === 1)) { p.coins++; log(`${p.name}：ターン終了で貨幣ゲージ+1（${p.coins}）`); }
  await startTurn(1 - p.i);
  return true;
}
