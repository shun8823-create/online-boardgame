'use strict';
/* ===== 対戦エンジン ===== */
let G = null, UIDC = 1;
let RNG = Math.random;
function seedRng(seed) { let a = seed >>> 0; RNG = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/* 座標：側面の列＝A〜G（先行側がG、後攻側がA）、底面の列＝1〜7。例：A1（先行から見て左上） */
const coord = (x, y) => String.fromCharCode(65 + y) + (x + 1);
const rnd = n => Math.floor(RNG() * n);
const rollD6 = () => Math.min(6, 1 + rnd(6) + (G.diceUp && G.diceUp.turn === G.turn ? G.diceUp.n : 0)); // 祝福：このターン出目+1（上限6）
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
/* 武器スロット：weapon（先に装備）と weapon2。「盾」と名のつく武器は他の武器と同時に装備できる（その間、移動に必要なSC+1） */
const wps = u => [u.weapon, u.weapon2].filter(Boolean);
const hasW = (u, id) => u.weapon === id || u.weapon2 === id;
const isShieldW = cid => !!cid && CARDS[cid].name.includes('盾');
const wSum = (u, f) => wps(u).reduce((s, c) => s + (CARDS[c][f] || 0), 0);
const isHeavyW = cid => !!cid && CARDS[cid].weapon && !!CARDS[cid].heavy; // 「重装備」の印をもつ武器（勇者の剣・勇竜剣・烈火剣）：LP4000以上のキャラのみ装備できる
const dualPen = u => (u.weapon && u.weapon2 ? 1 + (wps(u).some(isHeavyW) ? 1 : 0) : 0); // 武器2つ：SC+1（LP4000以上が条件の武器を含むならさらに+1）
const scAvail = u => (u.st && u.st.paralyze ? (u.scT === G.turn ? 0 : Math.min(u.sc, 1)) : u.sc); // まひ：1ターンにSCを1つしか使えない
const spendSC = (u, n) => { if (n <= 0) return; u.sc -= n; if (u.st && u.st.paralyze) u.scT = G.turn; };
const holdsAttr = (u, scid) => { const a = scid && CARDS[scid].attr; return !!a && [...charAttrs(u.cid), ...wps(u).flatMap(c => CARDS[c].wattr || [])].some(x => a.split('・').includes(x)); };
// 奥義（発狂・奇襲・追跡・変異）の効果が有効なターンは、持ち主のターン番号の配列 u.tk[k] で持つ（重ねがけで何ターン分でも持てる）
const tkOn = (u, k) => !!(u.tk && u.tk[k] && u.owner === G.active && u.tk[k].includes(G.players[u.owner].count));
const abU = (u, k) => abC(u.cid, k) || (k === 'berserk' && tkOn(u, 'frenzy')) || (k === 'ambush' && tkOn(u, 'ambush')) || (k === 'counter' && !!u.counter) || (k === 'regen' && dangerLP(u) && holdsWater(u)) || (k === 'dwarf' && abC(u.cid, 'crabGuard') && !u.dead && terr(u) === 'home') || wps(u).some(c => (CARDS[c].wab || []).includes(k)) || (k === 'incinerate' && hasW(u, 'flameSword') && u.flame != null && (G.turn === u.flame || G.turn === u.flame + 1)) || (k === 'incinerate' && !!u.attach && u.attach.some(a => a.cid === 'redDragonBreath'));
const holdsWater = u => [...charAttrs(u.cid), ...wps(u).flatMap(c => CARDS[c].wattr || [])].includes('水');
const dangerLP = u => !!G.players[u.owner].dangerSea && !isAv(u) && !u.dead && terr(u) !== 'enemy'; // 危険海流域：ホーム／ボーダーにいる自分のキャラ
const aquaticOn = u => abC(u.cid, 'aquatic') && waterCount(G.players[1 - u.owner].deckList) < 15; // 水棲：相手のデッキに水属性が15枚以上あると無効
const nm = u => CARDS[u.cid].name;
const HID_Q = '非公開で置きますか？（自分のホームテリトリーに置く）', HID_A = ['非公開で置く', '公開で置く'];
const lnm = u => u.hidden ? '非公開カード' : CARDS[u.cid].name;
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
    players: [d0, d1].map((d, i) => ({ i, name: i ? '後攻' : '先行', deck: shuffle(d), deckList: [...d], hand: [], grave: [], count: 0, coins: 0, freeBuy: 1, sellUsed: false, spellsUsed: 0, r1Spells: 0, summons: 0, extra: 0, goblinSlots: 0, parade: false, instinct: null, reshuffled: false, avatar: null, ap: 0, angelPool: ['angelLow', 'angelMid', 'angelHigh'], angelUsed: {} })) };
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
  syncHB();
  return k;
}

/* ステータス */
const isGobName = u => CARDS[u.cid].kind === 'char' && CARDS[u.cid].name.includes('ゴブリン');
const baseLP = u => (syncHBu(u), CARDS[u.cid].lp) + (isGobName(u) && G.players[u.owner].parade ? 1500 : 0) + (u.lpBonus || 0) + (u.hbA || 0) + wSum(u, 'wlp') - u.lpPen - (u.trapLoss || 0);
const golemStep = u => (/^golem[123]$/.test(u.cid) ? +u.cid.slice(5) : 0);
const baseSC = u => CARDS[u.cid].sc - u.scPen;
// 武器が与える耐性SpC。すでに「魔法耐性」を持つキャラ（自身の能力、または別の武器）には、与える耐性SpCが1に減る
const wRSpC = u => wps(u).reduce((s, c, i, arr) => { const v = CARDS[c].wrspc || 0; if (!v) return s; const had = abC(u.cid, 'magicResist') || arr.some((d, j) => j !== i && (CARDS[d].wab || []).includes('magicResist')); return s + (had ? Math.min(v, 1) : v); }, 0);
const baseRSpC = u => (CARDS[u.cid].rspc || 0) + wRSpC(u); // 魔法耐性用SpC（魔法耐性・超魔法耐性の支払い専用）
const baseSpC = u => CARDS[u.cid].spc + wSum(u, 'wspc');
function OP(u) { let v = CARDS[u.cid].op + (u.ambushNow ? 1000 : 0) + (G.lap && CARDS[u.cid].kind === 'char' ? 3000 : 0); v += wSum(u, 'wop'); for (const a of u.attach) v += CARDS[a.cid].aop || 0; for (const b of u.buffs) if (b.k === 'op') v += b.amt; return v; }
function DP(u) { let v = CARDS[u.cid].dp + u.dpBonus; v += wSum(u, 'wdp'); for (const b of u.buffs) if (b.k === 'dp') v += b.amt; return v; }
const aop = a => (a.cid === 'fightSpirit' ? 500 : 0);
CARDS.fightSpirit.aop = 500;
function breakArmor(u, n) { for (const k of ['tArmor', 'gArmor', 'fArmor', 'armor']) { const d = Math.min(u[k] || 0, n); u[k] = (u[k] || 0) - d; n -= d; if (n <= 0) break; } }
const armorTotal = u => u.armor + u.gArmor + u.tArmor + (u.fArmor || 0);
const fArmorCheck = u => { if (u.extra && terr(u) !== 'home') { u.extra = 0; log(`${lnm(u)}の「獰猛なる覇者の加護」の効果がホームテリトリーを出たため消えた`); } };
const baseActs = u => ((abU(u, 'twoActions') || (u.k2 && abU(u, 'knightCmd'))) && !assaultOn(u) ? 2 : 1);
const actLimit = u => (u.extra === G.players[u.owner].count && !assaultOn(u) ? Math.min(2, baseActs(u) + 1) : baseActs(u));
const extraOnly = u => u.extra === G.players[u.owner].count && u.acted >= baseActs(u);
const healPen = u => (u.st.burn ? 750 : 0) + (u.st.chill ? 500 : 0) + (u.st.frost ? 1000 : 0);
const healCap = u => baseLP(u); // 回復の上限＝加算後のステータス値（獰猛なる覇者の加護などの直接上昇は含み、混沌の手・本能解放などの一時的な増加は含まない）
function heal(u, n) { syncHB(); n = Math.max(0, n - healPen(u)); const b = healCap(u); if (u.lp < b) u.lp = Math.min(b, u.lp + n); }
function recomputePen(u) {
  const lp = (u.st.poison ? 500 : 0) + (u.st.venom ? 1500 : 0) + (u.st.frost ? 2000 : 0) + (u.incPen || 0);
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
  sfx('status'); log(`${lnm(u)}が状態異常「${STATUS_NAME[statusKey(u, k)]}」になった`);
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
/* 装備魔法が外れる時：ブリーズは手札に戻してもよい（確認は次の処理の区切りで行う） */
function dropAttach(t, p) { for (const a of t.attach) { if (a.cid === 'breeze') (G.pendBreeze = G.pendBreeze || []).push(p.i); else p.grave.push(a.cid); } }
async function flushBreeze() {
  while (G && G.pendBreeze && G.pendBreeze.length) {
    const i = G.pendBreeze.shift(), p = G.players[i];
    const back = (await UI.ask('ブリーズ：装備していたキャラクターが盤を離れた、または効果が切れました。ブリーズを手札に戻しますか？', ['手札に戻す', '墓地に送る'], i)) === '手札に戻す';
    if (back) { p.hand.push('breeze'); syncHB(); log(`${p.name}：ブリーズが手札に戻った`); } else { p.grave.push('breeze'); log(`${p.name}：ブリーズが墓地に送られた`); }
    UI.render();
  }
}
function killUnit(u) {
  if (u.dead) return;
  u.dead = true; sfx('kill');
  const p = G.players[u.owner];
  if (isAv(u)) { if (!G.over) { G.over = 1 - u.owner; log(`${p.name}のアバターが倒された`); if (UI.gameOver) UI.gameOver(G.over); } }
  else if (CARDS[u.cid].token) log(`${lnm(u)}が破壊された（デッキ外へ）`); // スペルの効果で出たキャラクターは墓地に行かずデッキ外へ
  else { p.grave.push(u.cid); (G.deadLog = G.deadLog || []).push({ cid: u.cid, owner: u.owner, turn: G.turn }); log(`${lnm(u)}が破壊された`); }
  for (const w of wps(u)) p.grave.push(w);
  dropAttach(u, p);
  delete G.units[u.uid];
}
/* シードラゴン：手札1枚につきLPが上がる（ホーム／ボーダー＝1000、エネミー＝500）。手札の枚数や位置が変わるたびに、増減した分だけ現在LPと上限が動く（減る場合も最低LP1は残り、これで破壊されることはない） */
const seaBonus = u => G.players[u.owner].hand.length * (terr(u) === 'enemy' ? 500 : 1000);
const hbTarget = u => (abC(u.cid, 'seaHand') ? seaBonus(u) : 0) + (dangerLP(u) ? 500 : 0) - (aquaticOn(u) && !isAv(u) && terr(u) === 'enemy' ? 500 : 0); // 手札数によるLP（シードラゴン）＋危険海流域のLP+500－水棲のエネミーでのLP-500
function syncHBu(u) { if (!u || u.dead) return; const nb = hbTarget(u), d = nb - (u.hbA || 0); if (!d) return; u.hbA = nb; u.lp = d > 0 ? u.lp + d : Math.max(1, u.lp + d); }
const isAngel = u => !!u && !isAv(u) && !!CARDS[u.cid].angel;
function angelRecall() { // 盤にエンジェルがいる状態でデッキが0になったら、再びデッキ外へ送られる
  for (const p of G.players) if (!p.deck.length) for (const u of U().filter(v => v.owner === p.i && isAngel(v))) {
    delete G.units[u.uid]; u.dead = true; if (!p.angelPool.includes(u.cid)) p.angelPool.push(u.cid);
    log(`${p.name}の山札が0になったため、${CARDS[u.cid].name}はデッキ外へ送られた`); UI.toast(`${CARDS[u.cid].name}はデッキ外へ送られた`);
  }
}
function syncHB() { if (G) { for (const u of U()) syncHBu(u); angelRecall(); } }
function damage(u, n, opts) {
  syncHB();
  if (u.dead || (u.hidden && !(opts && opts.hit)) || n <= 0) return;
  fArmorCheck(u);
  if (armorTotal(u) > 0 && !(opts && opts.pierce)) {
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
  if (!assault && wps(u).length && abU(u, 'heroDiag') && !u.diagUsed && !(tkOn(u, 'mutate') || hasShift(u))) dirs = dirs.concat(DIAG);
  if (!assault && abU(u, 'omni') && !(tkOn(u, 'mutate') || hasShift(u))) dirs = G.players[u.owner].count % 2 === 0 ? [[0, dy], [-1, 0], [1, 0], [0, -dy]] : DIAG; // エンジェル：使用者の偶数ターンは前後左右、奇数ターンは斜め前方・斜め後方にしか移動できない
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
const breezeN = u => u.attach.filter(a => a.cid === 'breeze').length; // ブリーズ：移動に必要なSC-1（0まで）
/* 水棲／危険海流域：移動先に応じてサイコロ（3以下なら移動SC+1）。出目は1回の行動につき1度だけ振る */
const moveDieKind = (u, y) => {
  if (isAv(u)) return null;
  const t = terrOfRow(rowOf(u.owner, y));
  if (t === 'enemy' && aquaticOn(u)) return '水棲';
  const cz = 1 - u.owner; if (G.players[cz].dangerSea && terrOfRow(rowOf(cz, y)) !== 'enemy') return '危険海流域'; // 危険海流域を使った側（相手）から見てホーム／ボーダー
  return null;
};
const moveSlot = u => G.turn + ':' + u.acted;
const pendingExtra = (u, y) => (!assaultOn(u) && moveDieKind(u, y) && u.mdie && u.mdie.k === moveSlot(u) && u.mdie.d <= 3 ? 1 : 0);
async function moveExtra(u, mv) {
  if (assaultOn(u)) return 0;
  const kind = moveDieKind(u, mv.y); if (!kind) return 0;
  const k = moveSlot(u);
  if (!u.mdie || u.mdie.k !== k) { const d = rollD6(); u.mdie = { k, d }; UI.toast(`🎲 ${kind}：${lnm(u)}の移動のサイコロ ${d}（3以下で消費SC+1）`); log(`${kind}：${lnm(u)}の移動のサイコロ ${d}${d <= 3 ? '（消費SC+1）' : ''}`); }
  return u.mdie.d <= 3 ? 1 : 0;
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
    const cost = () => (assault ? 0 : Math.max(0, 1 + (bers ? 1 : 0) + dualPen(u) - breezeN(u))); // SCは「1回の移動」につき消費（マス数ではない）
    const push = (type, c, steps, path) => { const cs = cost(); if (assault || scAvail(u) >= cs + pendingExtra(u, c[1])) out.push({ x: c[0], y: c[1], type, steps, cost: cs, path, back: backPure && type === 'attack' }); };
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
        else if ((rb === 'out' || rb === 'block' || rb === 'ally') && ra === 'empty') push('move', a, 1, [a]); // 狂乱・突撃司令：2マス先が障害物・盤外・自分のキャラなら1マスで止まる
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
  const cost = Math.max(0, 1 + (bers ? 1 : 0) + dualPen(u) - breezeN(u));
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
    log(`ウインドスラッシュ：${lnm(t)}に1000ダメージ`);
    damage(t, 1000);
    UI.render();
  }
}
async function doMove(u, mv) {
  syncHB();
  const ex = await moveExtra(u, mv);
  if (ex && scAvail(u) < mv.cost + ex) { UI.toast('サイコロの目が3以下で、追加のSCを払えないため移動できません'); log(`${lnm(u)}：追加のSCを払えず移動できなかった`); return; }
  sfx('move');
  const from = { x: u.x, y: u.y };
  if (!assaultOn(u)) spendSC(u, mv.cost + ex);
  u.acted++;
  if (u.mvTurn !== G.turn) { u.mvTurn = G.turn; u.mvN = 0; }
  u.mvN++;
  if (u.k2 && u.mvN >= 2) { u.k2 = false; log(`${lnm(u)}：1ターンに2回移動したため、行動回数が1回に戻った`); }
  if (wps(u).length && abU(u, 'heroDiag') && !u.diagUsed && !(tkOn(u, 'mutate') || hasShift(u)) && mv.path[0][0] !== from.x && mv.path[0][1] !== from.y) { u.diagUsed = true; log(`${lnm(u)}：斜め移動（ゲーム中1回）を使用した`); }
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
  log(`${lnm(u)}が${coord(from.x, from.y)}から${coord(u.x, u.y)}へ移動`);
  await onEntered(u, from);
}
async function onEntered(u, from) {
  const p = G.players[u.owner];
  syncHB();
  fArmorCheck(u);
  if (abU(u, 'knightCmd') && wps(u).length && terr(u) === 'border' && !(from && terrOfRow(rowOf(u.owner, from.y)) === 'border') && !u.k2 && !(u.mvTurn === G.turn && u.mvN >= 2)) { u.k2 = true; log(`${lnm(u)}がボーダーゾーンに入り、行動回数が2回になった`); }
  await trapCheck(u);
  if (u.dead || G.over) return;
  await sanctuaryCheck(u);
  if (!u.dead && !G.over && !u.hidden && hasW(u, 'braveSword') && abU(u, 'swordsman') && !(from && terrOfRow(rowOf(u.owner, from.y)) === 'border') && terr(u) === 'border') await braveStrike(u);
  if (u.dead || G.over) return;
  if (!u.hidden && hasW(u, 'heroSword')) await heroRoll(u);
  if (u.dead || G.over) return;
  if (instinctActive(p) && !u.instinctGot && (terr(u) === 'enemy' || terr(u) === 'border') && !(from && terrOfRow(rowOf(u.owner, from.y)) === terr(u))) { u.instinctGot = true; u.lpBonus = (u.lpBonus || 0) + 1000; u.lp += 1000; log(`本能解放：${lnm(u)}のLP+1000（ステータス上昇）`); } // 1体につき1度だけ。上昇したLPはその後も残る
  for (const c of U()) {
    if (c.owner !== u.owner && !c.hidden && abU(c, 'petrify') && !isAv(u) && c.x === u.x && c.y + fwd(c.owner) === u.y) addStatus(u, 'petrify');
  }
  checkAuras();
  if (u.dead || G.over) return;
  UI.render();
  if (hasHunting(u) && !assaultOn(u) && u.uses.hunt !== G.turn) await huntLoop(u);
}
async function braveStrike(u) {
  const tg = chars(1 - u.owner).filter(t => rowOf(u.owner, t.y) >= 4);
  if (!tg.length) return;
  const r = await UI.pickBoard({ prompt: '勇竜剣：バトルする相手キャラクターを選択（ボーダーゾーン／エネミーテリトリー）', cells: tg.map(t => [t.x, t.y]), kind: 'attack', cancellable: true, cancelLabel: 'バトルしない' });
  if (!r) return;
  const t = at(r[0][0], r[0][1]); if (!t || t.dead) return;
  log(`勇竜剣：${lnm(u)}が${lnm(t)}とバトルする`);
  try { await battle(u, t); } finally { u.ambushNow = false; }
  checkAuras(); UI.render();
}
const HERO_DIE = 6;
async function heroRoll(u) {
  const tg = chars(1 - u.owner);
  if (!tg.length) return;
  const d = rollD6(); UI.toast(`🎲 勇者の剣：サイコロ ${d}（${HERO_DIE}以上でバトル可）`); log(`勇者の剣：サイコロ ${d}`);
  if (d < HERO_DIE) return;
  if ((await UI.ask(`勇者の剣：サイコロ${d}！バトルさせますか？（相手が戦うキャラクターを選びます）`, ['バトルさせる', 'バトルしない'], u.owner)) !== 'バトルさせる') return;
  const r = await UI.pickBoard({ who: 1 - u.owner, prompt: `勇者の剣：${nm(u)}とバトルする自分のキャラクターを選択`, cells: tg.map(t => [t.x, t.y]), kind: 'target', cancellable: false });
  if (!r) return;
  const t = at(r[0][0], r[0][1]); if (!t || t.dead) return;
  log(`勇者の剣：${lnm(u)}が${lnm(t)}とバトルする`);
  try { await battle(u, t); } finally { u.ambushNow = false; }
  checkAuras(); UI.render();
}
async function flameStart(u) {
  if (!u || u.dead || !hasW(u, 'flameSword') || u.flameUsed || u.owner !== G.active || G.phase !== 'main') return;
  u.flameUsed = true; u.flame = G.turn; sfx('fire'); log(`烈火剣：${lnm(u)}は1ターンの間「焼却」を得た（相手のターン終了時まで）`);
  checkAuras(); UI.render();
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
  const pen = {};
  for (const d of U()) {
    if (d.dead || d.hidden || !abU(d, 'incinerate')) continue;
    const t = enemyAt(d.x, d.y + fwd(d.owner), d.owner);
    if (t && !isAv(t)) pen[t.uid] = (pen[t.uid] || 0) + d.lp;
  }
  for (const t of U()) { const n = pen[t.uid] || 0; if ((t.incPen || 0) !== n) { if (n > (t.incPen || 0)) log(`焼却：${lnm(t)}のLPが${n}下がった（その場にいる間）`); t.incPen = n; recomputePen(t); } }
  for (const d of U()) {
    if (d.dead || d.hidden || !abU(d, 'incinerate')) continue;
    const fx = d.x, fy = d.y + fwd(d.owner);
    const fk = sKey(fx, fy);
    if (wallAt(fx, fy) && wallAt(fx, fy).owner !== d.owner) { delete G.walls[fx + ',' + fy]; log('焼却：砂壁が破壊された'); }
    if (G.traps[fk] && G.traps[fk].owner !== d.owner) { delete G.traps[fk]; log('焼却：棘付きトラップが破壊された'); }
    if (G.sanctuaries[fk] && G.sanctuaries[fk].owner !== d.owner) { delete G.sanctuaries[fk]; log('焼却：魔法聖域が破壊された'); }
  }
}

/* ===== バトル ===== */
async function battle(att, def) {
  syncHB();
  sfx('clash');
  log(`バトル：${lnm(att)}（${coord(att.x, att.y)}）→ ${lnm(def)}（${coord(def.x, def.y)}）`);
  UI.render();
  for (const [a, b] of [[att, def], [def, att]]) if (abU(a, 'poisonTouch') && !b.dead) addStatus(b, 'poison');
  for (const [a, b] of [[att, def], [def, att]]) {
    if (abU(a, 'assassinate') && !a.dead && !b.dead && !isAv(b) && String(CARDS[b.cid].race).includes('ヒューム') && b.lp <= 4000) {
      log(`${lnm(a)}：バトル前に${lnm(b)}（LP${b.lp}のヒューム）を破壊した`); killUnit(b);
      if (a === att) { const g = CARDS[b.cid].rank || 0; G.players[a.owner].coins += g; }
    }
  }
  for (const [a, b] of [[att, def], [def, att]]) if (!a.dead && holdsLight(a)) await lightUndead(b, `光属性の${nm(a)}とバトルするため、`);
  if (att.dead) return false;
  if (def.dead) return true;
  if (G.over) return false;
  for (const [a, b] of [[att, def], [def, att]]) {
    if (abU(a, 'slime') && b.weapon) {
      const d = rollD6(); UI.toast(`🎲 スライムのサイコロ：${d}`);
      if (d >= 4) { G.players[b.owner].grave.push(b.weapon); b.weapon = b.weapon2 || null; b.weapon2 = null; if (!b.weapon) b.armor = 0; b.spc = Math.min(b.spc, baseSpC(b)); b.lp = Math.min(b.lp, baseLP(b)); b.rspc = Math.min(b.rspc || 0, baseRSpC(b)); log(`${lnm(b)}の武器が破壊された`); }
    }
  }
  let forced = null;
  for (const side of [att, def]) { if (await goldenPrompt(side)) { forced = side === att ? 'att' : 'def'; break; } }
  for (const [a, b] of [[att, def], [def, att]]) { // 深淵の三又槍：水属性の装備者は、バトル前に相手の装甲値を減らす
    const br = wSum(a, 'wbreak');
    if (br && holdsWater(a) && !a.dead && !b.dead && armorTotal(b) > 0) { breakArmor(b, br); log(`${lnm(a)}：バトル前に${lnm(b)}の装甲値を最大${br}減らした`); }
  }
  const dpCut = wSum(att, 'wfoeDp'), DPd = Math.max(0, DP(def) - dpCut);
  const AV = att.lp + OP(att), DV = def.lp + DPd;
  let win = false;
  if (forced === 'att') win = true;
  else if (forced === 'def') win = false;
  else if (AV >= DV) win = true;
  else { const dmg = Math.max(0, AV - DPd); log(`攻撃値${AV} < 防御値${DV}：${lnm(def)}に${dmg}ダメージ`); damage(def, dmg); }
  if (!win && abU(def, 'counter') && !def.dead && !att.dead && def.owner !== G.active) { const cv = def.lp + OP(def); log(`カウンター：${lnm(def)}がバトルに勝ち、攻撃値${cv}のダメージを${lnm(att)}に与える`); damage(att, cv); }
  if (win) { log(`攻撃値${AV}（防御値${DV}）：攻撃側の勝利`); killUnit(def); if (!isAv(def)) { const g = CARDS[def.cid].rank; G.players[att.owner].coins += g; log(`バトルに勝利：${G.players[att.owner].name}の貨幣ゲージ+${g}（${G.players[att.owner].coins}）`); } }
  { const w = win ? att : def; if (!w.dead && abU(w, 'swordsman') && wps(w).some(c => CARDS[c].name.includes('剣')) && (win || w === def)) { w.lpBonus = (w.lpBonus || 0) + 500; w.lp += 500; log(`剣士：${lnm(w)}が「${CARDS[w.weapon].name}」を装備してバトルに勝ち、LP+500`); } }
  UI.render();
  return win;
}
/* ゴーレム：魔法耐性・超魔法耐性以外でSpCとして使えるのは1まで */
const spcUsable = u => u.spc;
const canPayAmt = (u, n) => !u.hidden && CARDS[u.cid].spc > 0 && u.st.petrify == null && spcUsable(u) + Math.floor(scAvail(u) / 2) >= n;
const isLightSp = sp => !!sp && (CARDS[sp].attr || '').split('・').includes('光');
const holdsLight = u => !isAv(u) && (charAttrs(u.cid).includes('光') || wps(u).some(c => (CARDS[c].wattr || []).includes('光')));
const isUndead = u => !isAv(u) && String(CARDS[u.cid].race).includes('アンデット');
const nonLightSp = sp => !!sp && !!CARDS[sp].attr && CARDS[sp].attr.split('・').some(a => a !== '光');
const priestBlock = (u, sp = G.curSpell) => !isAv(u) && abC(u.cid, 'priest') && nonLightSp(sp); // 神官：光属性以外の属性をもつスペルでは、SpCを消費する対象にできない
const lightPen = (u, sp) => isLightSp(sp) && !isAv(u) && !holdsAttr(u, sp); // 光属性のスペルを光属性を持たないキャラのSpCで使うと+1
const spReduce = (u, n, sp = G.curSpell) => (sp && n >= 2 && holdsAttr(u, sp) ? n - 1 : (lightPen(u, sp) ? n + 1 : n)); // 属性一致：SpC2以上のスペルは必要SpC-1
async function payCost(p, n, flt) {
  const n0 = n;
  const cands = own(p.i).filter(u => canPayAmt(u, spReduce(u, n0)) && !priestBlock(u) && (!flt || flt(u)));
  if (!cands.length) { UI.toast(`SpC${n}を支払えるキャラクター／アバターがいません`); return null; }
  const r = await UI.pickBoard({ who: p.i, prompt: `SpC${n}を消費するキャラクターを選択`, cells: cands.map(c => [c.x, c.y]), kind: 'pay', cancellable: true });
  if (!r) return null;
  const u = at(r[0][0], r[0][1]);
  n = spReduce(u, n0); if (n < n0) log(`${lnm(u)}は属性が一致するため、必要SpCが${n0}から${n}になった`);
  if (n > n0) { u.noSpc = G.turn; log(`${lnm(u)}は光属性を持たないため、必要SpCが${n0}から${n}になり、このターンSC・SpCを回復しない`); UI.toast(`光属性を持たないため消費SpC+1・このターンSC／SpC回復なし`); }
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
  if (!own(p.i).some(u => canPayAmt(u, 3) && !priestBlock(u, 'goldenBody'))) return false;
  const a = await UI.ask(`【${p.name}に確認】${nm(side)}がバトルします。手札の「黄金の体」（SpC3）を使用しますか？`, ['使用する', '使用しない'], side.owner);
  if (a !== '使用する') return false;
  const py = await payCost(p, 3);
  if (!py) return false;
  p.hand.splice(p.hand.indexOf('goldenBody'), 1); p.grave.push('goldenBody');
  await UI.cutIn('goldenBody');
  side.counter = true; log(`黄金の体：${lnm(side)}は必ず勝利し、「カウンター」を得た`);
  await onSpellUsed(p, 'goldenBody');
  return true;
}
/* 魔法耐性は1ターンに1度。「魔法耐性」を重複して持つ数（カード自身の「魔法耐性N」＋武器が与える魔法耐性）だけ、1ターンに使える回数が増える */
const resistMax = u => Math.min(2, (abC(u.cid, 'magicResist') ? (CARDS[u.cid].mres || 1) : 0) + wps(u).filter(c => (CARDS[c].wab || []).includes('magicResist')).length); // 重複は「魔法耐性2」まで（上限2）
const hasResist = u => abU(u, 'magicResist') || abU(u, 'superResist');
async function lightUndead(u, why, spCost) { // 光属性：アンデットのLPのステータスを2000下げる（装甲無視）。スペルの対象にとられた場合は、カードの消費SpCを参照した魔法耐性で防げる
  if (u.dead || u.hidden || !isUndead(u)) return;
  if (spCost != null && await tryResist(u, spCost, null, { wide: true, what: '光属性によるLPのステータス減少' })) { log(`光属性：${lnm(u)}は魔法耐性でLPのステータス減少を防いだ`); return; }
  log(`光属性：${why}アンデットの${lnm(u)}のLPのステータスが2000下がる`); UI.toast(`光属性：${lnm(u)}のLPのステータスが2000下がる`);
  u.lpBonus = (u.lpBonus || 0) - 2000; damage(u, 2000, { hit: true, pierce: true });
}
const spListed = cid => parseInt(String(CARDS[cid].cost).replace(/\D/g, ''), 10) || 0; // カードに記載された消費SpC
async function resist(t, cost, caster, opts = {}) {
  if (isLightSp(G.curSpell)) await lightUndead(t, '光属性のスペルの対象にとられた', spListed(G.curSpell));
  if (t.dead) return true;
  return tryResist(t, cost, caster, opts);
}
async function tryResist(t, cost, caster, opts = {}) {
  if (!hasResist(t) || t.hidden || t.dead) return false;
  if (!opts.wide && t.owner === caster.i) return false;
  const sup = abU(t, 'superResist');
  const need = sup ? cost : cost + 1;
  const rs = t.uses.sr && t.uses.sr.turn === G.turn ? t.uses.sr.n : 0;
  if (sup && rs >= 2) return false;
  const mrN = resistMax(t), mu = t.uses.mr && t.uses.mr.turn === G.turn ? t.uses.mr.n : 0;
  if (!sup && mu >= Math.max(1, mrN)) return false;
  if (t.spc + (t.rspc || 0) < need || t.st.petrify != null) return false;
  const a = await UI.ask(`【${G.players[t.owner].name}に確認】${nm(t)}の${sup ? '超魔法耐性' : '魔法耐性'}：SpC${need}（耐性SpCを先に使用）を支払い、${opts.what || 'スペルの効果'}を打ち消しますか？${sup ? `（このターンあと${2 - rs}回）` : `（このターンあと${Math.max(1, mrN) - mu}回）`}`, ['打ち消す', '受ける'], t.owner);
  if (a === '打ち消す') { const fromR = Math.min(t.rspc || 0, need); t.rspc = (t.rspc || 0) - fromR; t.spc -= need - fromR; if (sup) t.uses.sr = { turn: G.turn, n: rs + 1 }; else t.uses.mr = { turn: G.turn, n: mu + 1 }; log(`${lnm(t)}は${sup ? '超魔法耐性' : '魔法耐性'}で${opts.what ? '光属性の効果' : 'スペル'}を打ち消した`); return true; }
  return false;
}
/* スペル使用の記録と、氷の魔女の誘発 */
async function gainAP(p, n) { // 光属性のスペルを使うたび、使用したプレイヤーにエンジェルポイント（AP）が溜まる。APがACに達したエンジェルは、デッキ外から手札に加わる
  p.ap += n; log(`${p.name}：エンジェルポイント+${n}（AP ${p.ap}）`);
  for (const a of p.angelPool.filter(k => CARDS[k].ac <= p.ap)) { p.angelPool.splice(p.angelPool.indexOf(a), 1); p.hand.push(a); log(`${p.name}：APが${CARDS[a].ac}に達し、デッキ外から${CARDS[a].name}が手札に加わった`); UI.toast(`AP${CARDS[a].ac}：${CARDS[a].name}が手札に加わった`); }
}
async function onSpellUsed(p, cid) {
  p.spellsUsed++;
  if (CARDS[cid].ap) await gainAP(p, CARDS[cid].ap);
  const c = CARDS[cid]; let fire = false;
  if (c.rank >= 2) fire = true; else { p.r1Spells++; if (p.r1Spells % 2 === 0) fire = true; }
  if (!fire) return;
  for (const w of chars(p.i).filter(u => abU(u, 'witchChill'))) {
    const es = foes(p).filter(u => !u.dead);
    if (!es.length) break;
    const t = es[rnd(es.length)];
    log(`${lnm(w)}：${lnm(t)}が「しもやけ」状態になった`);
    addStatus(t, 'chill');
  }
}
function dwarfRedirect(t, user) {
  if (t.owner === user.i) return t;
  const ds = own(t.owner).filter(u => abU(u, 'dwarf') && !u.hidden && u !== t && !u.uses.dwarf); // 対象にされなかった庇護キャラの中からランダムに選ばれる
  if (!ds.length) return t;
  const d = ds.length === 1 ? ds[0] : ds[rnd(ds.length)];
  d.uses.dwarf = true; log(`庇護：対象が${lnm(d)}に変更された`); UI.toast(`庇護：対象が${nm(d)}に変更された`);
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
  if ((p.ban || []).some(b => b.cid === cid && b.turn === G.turn)) { UI.toast(`アクアリターンの効果で、このターンは「${c.name}」を盤に出せません`); return false; }
  if (abC(cid, 'moonCond') && p.spellsUsed < 3) { UI.toast(`このゲーム中にスペルを3回以上使用していないと盤に出せません（現在${p.spellsUsed}回）`); return false; }
  if (abC(cid, 'hobCond') && goblinCount(p) < 9) { UI.toast('デッキに種族ゴブリンが9枚以上ないと場に出せません'); return false; }
  if (abC(cid, 'tigerCond') && wildCount(p) < 10) { UI.toast('デッキに種族ワイルドのキャラが10体以上ないと配置できません'); return false; }
  if (abC(cid, 'crabCond') && p.hand.length - 1 < 5) { UI.toast('手札にこのカードを除いて5枚以上ないと盤に出せません'); return false; }
  if (abC(cid, 'krakenCond') && p.hand.filter((h, i) => i !== idx && cardAttrs(h).includes('水')).length < 4) { UI.toast('手札に水属性のカード（このカードを除く）が4枚以上ないと盤に出せません'); return false; }
  if (abC(cid, 'darkCond') && hiddenCards(p.i).filter(v => rowOf(p.i, v.y) <= 3).length < 2) { UI.toast('ホームテリトリーに非公開カードが2枚以上ないと盤に出せません'); return false; }
  const ang = !!c.angel;
  if (ang && p.reshuffled) { UI.toast('デッキが2周目の時、エンジェルは盤に出せません'); return false; }
  let stealth = false;
  if (abC(cid, 'stealth')) stealth = (await UI.ask(HID_Q, HID_A)) === HID_A[0];
  if (!stealth && !ang && !slotKind(p, c)) { UI.toast('このターンはこれ以上キャラクターを配置できません'); return false; }
  let sac = [], sacSum = 0;
  if (abC(cid, 'sacrifice')) {
    const cand = chars(p.i), total = cand.reduce((s, u) => s + u.lp, 0);
    if (total < 1500) { UI.toast('生贄にできるキャラクターのLP合計が1500に届きません'); return false; }
    const r = await UI.pickBoard({ prompt: '生贄にするキャラクターを選択（LP合計1500以上）', cells: cand.map(u => [u.x, u.y]), multi: true, kind: 'target', confirmLabel: '生贄にして配置', cancellable: true, validate: sel => sel.reduce((s, [x, y]) => s + at(x, y).lp, 0) >= 1500, sumLabel: sel => `生贄LP合計：${sel.reduce((s, [x, y]) => s + at(x, y).lp, 0)}` });
    if (!r) return false;
    sac = r.map(([x, y]) => at(x, y)); sacSum = sac.reduce((s, u) => s + u.lp, 0);
  }
  const freed = new Set(sac.map(u => u.x + ',' + u.y));
  let rows = stealth || ang ? [1, 2, 3] : [1];
  if ((c.name === 'オーガ' || cid === 'vampire') && sacSum >= 4500) rows = [1, 2];
  const cells = [];
  for (const r of rows) for (let x = 0; x < 7; x++) {
    const cc = cellOfRow(p.i, r, x);
    const free = ang ? !U().some(v => !v.dead && v.x === cc.x && v.y === cc.y && !(v.hidden && v.owner === p.i)) : (!at(cc.x, cc.y) || freed.has(cc.x + ',' + cc.y)); // エンジェル：非公開カード以外のカードの無いマス
    if (free && (!wallAt(cc.x, cc.y) || abC(cid, 'flight'))) cells.push([cc.x, cc.y]);
  }
  if (!cells.length) { UI.toast('配置できるマスがありません'); return false; }
  const pick = await UI.pickBoard({ prompt: '配置するマスを選択', cells, kind: 'place', cancellable: true });
  if (!pick) return false;
  if (abC(cid, 'krakenCond')) { // 手札の水属性カード4枚を選んで相手に見せる
    const cands = p.hand.map((h, i) => i).filter(i => i !== idx && cardAttrs(p.hand[i]).includes('水'));
    let sel = cands;
    if (cands.length > 4) {
      const r = UI.pickCards ? await UI.pickCards('クラーケン', `【${p.name}】手札から水属性のカードを4枚選び、相手に見せる`, cands.map(i => p.hand[i]), 4, p.i, 4) : [0, 1, 2, 3];
      sel = [...new Set(r)].slice(0, 4).map(j => cands[j]).filter(v => v != null); for (const i of cands) if (sel.length < 4 && !sel.includes(i)) sel.push(i);
    }
    const names = sel.map(i => CARDS[p.hand[i]].name);
    log(`クラーケン：手札の「${names.join('」「')}」を相手に見せた`); UI.toast(`クラーケン：${names.join('、')}を公開`);
  }
  if (!stealth) await UI.cutIn(cid);
  for (const s of sac) killUnit(s);
  const hi = p.hand.indexOf(cid); p.hand.splice(hi, 1); syncHB();
  if (!stealth && !ang) { const k = slotKind(p, c); if (k === 'goblin') p.goblinSlots--; else if (k === 'normal') p.summons++; else if (k === 'extra') p.extra--; }
  const u = mkUnit(p.i, cid, pick[0][0], pick[0][1]);
  sfx('summon');
  u.lp = baseLP(u);
  u.sacSum = sacSum;
  if (c.startArmor) u.armor = c.startArmor;
  if (stealth) { u.hidden = true; u.hiddenSince = p.count; }
  log(stealth ? `${p.name}：非公開カードを${coord(u.x, u.y)}に置いた` : `${p.name}：${c.name}を${coord(u.x, u.y)}に配置`);
  await etb(u, p, stealth);
  await sanctuaryCheck(u);
  return true;
}
async function spellDraw(u, p, need) { // スペルドロー：サイコロがneed以上ならデッキからランク1のスペルを1枚手札に加える
  const d = rollD6(); UI.toast(`🎲 ${nm(u)}のサイコロ：${d}（d${need}以上で成功）`);
  if (d >= need) {
    const ids = p.deck.map((c, i) => i).filter(i => CARDS[p.deck[i]].kind === 'spell' && CARDS[p.deck[i]].rank === 1);
    if (ids.length) { const i = ids[rnd(ids.length)]; const c = p.deck.splice(i, 1)[0]; p.hand.push(c); log(`${lnm(u)}：スペルドロー（出目${d}）でデッキから「${CARDS[c].name}」を手札に加えた`); }
    else log(`${lnm(u)}：スペルドロー（出目${d}）：加えられるスペルがデッキになかった`);
  } else log(`${lnm(u)}：スペルドロー（出目${d}）：失敗`);
}
async function etb(u, p, stealth) {
  if (abU(u, 'kingEtb')) {
    const n = 1 + Math.floor((u.sacSum || 0) / 3000);
    for (let k = 0; k < n; k++) {
      const head = `${k + 1}回目${n > 1 ? `／全${n}回` : ''}`, ptxt = `【${p.name}】${nm(u)}：デッキ外から手札に加えるテクニックを選ぶ`;
      const id = UI.pickCard ? await UI.pickCard(head, ptxt, ['tkMutate', 'tkFrenzy'], p.i)
        : ({ 変異: 'tkMutate', 発狂: 'tkFrenzy' }[await UI.ask(`§${head}\n${ptxt}\n■変異：${CARDS.tkMutate.txt[0]}\n■発狂：${CARDS.tkFrenzy.txt[0]}`, ['変異', '発狂'], p.i)] || 'tkMutate');
      p.hand.push(id); log(`${lnm(u)}：吸血鬼の王（${k + 1}回目）で「${CARDS[id].name}」を手札に加えた`);
      if (k < n - 1 && UI.pause) { UI.toast(`${k + 1}回目：「${CARDS[id].name}」を手札に加えた`); await UI.pause(200); } // 次の回収までの時間：0.2秒
    }
  }
  if (abU(u, 'witchEtb')) {
    const idx = r => p.deck.map((c, i) => i).filter(i => CARDS[p.deck[i]].kind === 'spell' && CARDS[p.deck[i]].rank === r);
    const d = rollD6(); UI.toast(`🎲 ${nm(u)}のサイコロ：${d}（d4以上でランク2）`);
    let pool = d >= 4 ? idx(2) : [];
    if (!pool.length) pool = idx(1);
    if (pool.length) { const i = pool[rnd(pool.length)]; const cc = p.deck.splice(i, 1)[0]; p.hand.push(cc); log(`${lnm(u)}：スペルコレクト（出目${d}）でデッキから「${CARDS[cc].name}」を手札に加えた`); }
    else log(`${lnm(u)}：スペルコレクト（出目${d}）：加えられるスペルがデッキになかった`);
  }
  if (abU(u, 'elemWater') && waterCount(p.deckList) >= 15) { // エレメンタルコレクト：水（d6以上）
    const idx = r => p.deck.map((c, i) => i).filter(i => cardAttrs(p.deck[i]).includes('水') && CARDS[p.deck[i]].rank === r);
    const d = rollD6(); UI.toast(`🎲 ${nm(u)}のサイコロ：${d}（d6以上でランク2）`);
    let pool = d >= 6 ? idx(2) : [];
    if (!pool.length) pool = idx(1);
    if (pool.length) { const i = pool[rnd(pool.length)]; const cc = p.deck.splice(i, 1)[0]; p.hand.push(cc); log(`${lnm(u)}：エレメンタルコレクト・水（出目${d}）でデッキから「${CARDS[cc].name}」を手札に加えた`); }
    else log(`${lnm(u)}：エレメンタルコレクト・水（出目${d}）：加えられる水属性のカードがデッキになかった`);
  }
  if (abU(u, 'wizDice')) await spellDraw(u, p, CARDS[u.cid].wiz || 4);
  if (abU(u, 'seaEtb')) { // シードラゴン：墓地から5枚以上選んで山札に加えシャッフル（5枚以下なら全て自動）、その後2枚引く
    const g = p.grave; let idx = g.map((_, i) => i);
    if (g.length > 5 && UI.pickCards) idx = await UI.pickCards('シードラゴン', `【${p.name}】墓地から山札に加えるカードを5枚以上選ぶ`, [...g], 5, p.i);
    idx = [...new Set(idx)].filter(i => i >= 0 && i < g.length).sort((a, b) => b - a); if (idx.length < Math.min(5, g.length)) idx = g.map((_, i) => i).sort((a, b) => b - a);
    const back = idx.map(i => g.splice(i, 1)[0]); p.deck.push(...back); p.deck = shuffle(p.deck);
    log(`${lnm(u)}：墓地から${back.length}枚を山札に加えてシャッフルし、2枚引く`); draw(p, 2);
  }
  syncHB();
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
/* 神官：ヒール／キュア・ディジーズ（それぞれ1ターンに1度、SpC1を消費） */
const priestCan = (u, k) => !u.dead && !u.hidden && !isAv(u) && abU(u, k === 'heal' ? 'healA' : 'cureA') && u.uses[k] !== G.turn && u.spc >= 1 && u.st.petrify == null;
async function priestAct(u) {
  if (G.phase !== 'main' || u.owner !== G.active || u.dead) return;
  const ks = ['heal', 'cure'].filter(k => priestCan(u, k));
  if (!ks.length) { UI.toast(abU(u, 'healA') ? 'ヒール・キュア・ディジーズは1ターンに1度ずつ、SpCが1以上必要です' : ''); return; }
  const name = { heal: 'ヒール', cure: 'キュア・ディジーズ' };
  const a = await UI.ask(`${nm(u)}：どの効果を使いますか？（SpC1を消費）`, [...ks.map(k => name[k]), 'キャンセル']);
  const k = ks.find(x => name[x] === a); if (!k) return;
  const t = await pickUnit(chars(u.owner), `${name[k]}の対象（自分のキャラクター）を選択`); if (!t) return;
  if (k === 'cure' && !statusList(t).length) { UI.toast('対象に状態異常がありません'); return; }
  u.spc -= 1; u.uses[k] = G.turn;
  if (k === 'heal') { const b = t.lp; heal(t, 2000); log(`ヒール：${lnm(u)}がSpC1を消費し、${lnm(t)}のLPを回復（${b}→${t.lp}）`); }
  else { const ss = statusList(t), s0 = ss[rnd(ss.length)]; cure(t, s0); log(`キュア・ディジーズ：${lnm(u)}がSpC1を消費し、${lnm(t)}の${STATUS_NAME[s0]}を治療`); }
  UI.toast(`${name[k]}：${nm(t)}`); afterAction();
}
/* エンジェルの効果：メインステップ中にSCを2つ消費し、デッキ外から指定のカードを手札に加える（ゲーム中1度だけ） */
async function angelFetchAct(u) {
  const p = G.players[u.owner], f = CARDS[u.cid].fetch;
  if (G.phase !== 'main' || u.owner !== G.active || u.dead || u.hidden || !f) return;
  if (p.angelUsed[u.cid]) { UI.toast('この効果はゲーム中1度だけ使えます'); return; }
  if (scAvail(u) < 2 || u.st.petrify != null) { UI.toast('SCが2つ必要です'); return; }
  const a = await UI.ask(`${nm(u)}：SCを2つ消費して、デッキ外から「${CARDS[f.cid].name}」を${f.n}枚手札に加えますか？（ゲーム中1度だけ）`, ['使う', 'やめる']);
  if (a !== '使う') return;
  spendSC(u, 2); p.angelUsed[u.cid] = true;
  for (let i = 0; i < f.n; i++) p.hand.push(f.cid);
  log(`${lnm(u)}：SCを2つ消費し、デッキ外から「${CARDS[f.cid].name}」${f.n}枚を手札に加えた`); UI.toast(`${CARDS[f.cid].name}を${f.n}枚手札に加えた`); afterAction();
}
/* 非公開（潜伏）の公開：メインステップ中、必要なターンが経っていればいつでも */
async function revealUnit(u) {
  if (G.phase !== 'main' || u.owner !== G.active || !u.hidden || u.dead) return;
  const p = G.players[u.owner], rest = u.sanct ? 0 : u.hiddenSince + 3 - p.count;
  if (rest > 0) { UI.toast(`潜伏は、あと自分のターン${rest}回後から公開できます`); return; }
  if (U().some(v => v !== u && !v.dead && v.owner === u.owner && v.x === u.x && v.y === u.y)) { UI.toast('自分のキャラクターと同じマスにいる間は公開できません'); return; }
  sfx('reveal'); u.hidden = false; u.marked = false; if (u.sanct) { u.sanct = false; u.noSanct = sKey(u.x, u.y); } log(`${lnm(u)}が姿を現した（${coord(u.x, u.y)}）`);
  const foe = U().find(v => !v.dead && !v.hidden && v.owner !== u.owner && v.x === u.x && v.y === u.y);
  if (foe) { log(`同じマスに${lnm(foe)}がいたため、即座にバトル`); await battle(u, foe); }
}
/* 弓使い（サイコロ）／警戒 */
const archerNeed = u => {
  const c = CARDS[u.cid]; let n = c.archer || null;
  if (hasW(u, 'bowFine')) n = n ? Math.max(1, n - 2) : (String(c.race).includes('エルフ') ? 4 : 6);
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
  const d = rollD6(); UI.toast(`🎲 弓使いのサイコロ：${d}（${need}以上で命中）`);
  if (d >= need) { log(`弓使い：${lnm(u)}の矢が${lnm(t)}に命中（サイコロ${d}）。LP-1000`); damage(t, 1000); } else log(`弓使い：${lnm(u)}の矢は外れた（サイコロ${d}）`);
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
const mine = p => chars(p.i).filter(u => !isAngel(u)), foes = p => chars(1 - p.i);
const seaRoarTargets = p => foes(p).filter(u => rowOf(p.i, u.y) <= 4); // 使用者から見てホームテリトリー／ボーダーゾーン（行は使用者視点）にいる相手のキャラクター
const blizzardTargets = p => foes(p).filter(u => rowOf(p.i, u.y) >= 4);
const breezeOk = u => !isAv(u) && !abC(u.cid, 'noEquipSp'); // 装備魔法は重複装備の制限を受けない
const guardPayer = u => !u.hidden && u.spc >= 1 && u.st.petrify == null && CARDS[u.cid].spc > 0 && spcUsable(u) >= 1;
async function pickUnit(us, prompt) {
  us = us.filter(u => !(isAngel(u) && u.owner === G.active)); // エンジェルは、自分が使うスペル・アイテム・テクニックの対象外
  if (!us.length) { UI.toast('対象にできるキャラクターがいません'); return null; }
  const r = await UI.pickBoard({ prompt, cells: us.map(u => [u.x, u.y]), kind: 'target', cancellable: true });
  return r ? at(r[0][0], r[0][1]) : null;
}
const ferTargets = p => mine(p).filter(u => CARDS[u.cid].cat.includes('モンスター') && CARDS[u.cid].race === 'ワイルド' && terr(u) === 'home' && scAvail(u) >= 1 && u.spc >= 1 && u.st.petrify == null);
const canTechPay = u => u.acted === 0 && scAvail(u) >= 1 && u.st.petrify == null && !u.hidden && !u.dead;
const canEquip = (u, cid) => !isAv(u) && CARDS[u.cid].weapon && (!u.weapon || (!u.weapon2 && isShieldW(cid) !== isShieldW(u.weapon))) && (!isHeavyW(cid) || u.lp >= 4000) && (!u.weapon || u.lp >= 4000) && (cid !== 'wandFine' || CARDS[u.cid].spc >= 1) && (!CARDS[cid].heroOnly || u.cid === 'hero') && (!CARDS[cid].humanoidOnly || String(CARDS[u.cid].cat).includes('ヒューマノイド'));
async function equipWeapon(p, cid) {
  const cs = own(p.i).filter(u => !isAngel(u) && canEquip(u, cid));
  const u = await pickUnit(cs, cid === 'wandFine' ? '上等な魔杖を装備するキャラクター（SpC基礎値1以上）を選択' : '武器を装備するキャラクターを選択');
  if (!u) return false;
  await UI.cutIn(cid);
  const r0 = baseRSpC(u);
  if (u.weapon) u.weapon2 = cid; else u.weapon = cid; if (cid === 'shieldFine') u.armor += 1500; if (CARDS[cid].wspc) u.spc += CARDS[cid].wspc;
  { const w = CARDS[cid]; if (w.wlp) u.lp += w.wlp; if (w.warm) u.armor += w.warm; u.rspc = (u.rspc || 0) + (baseRSpC(u) - r0); }
  log(`${lnm(u)}が${CARDS[cid].name}を装備`);
  return 'kept';
}
const cellsRow1 = p => { const o = []; for (let x = 0; x < 7; x++) { const c = cellOfRow(p.i, 1, x); if (!at(c.x, c.y) && !wallAt(c.x, c.y)) o.push([c.x, c.y]); } return o; };
const EQUIP_HUM = p => own(p.i).some(u => canEquip(u, 'braveSword')) ? null : 'ヒューマノイドで武器を装備できるキャラクターがいません';
const EQP = cid => p => (own(p.i).some(u => canEquip(u, cid)) ? null : '装備できるキャラクターがいません（ランク2の武器・盾との同時装備はLP4000以上が必要です）');
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
  await UI.cutIn(cid); { t.tk = t.tk || {}; const nx = G.players[t.owner].count + 1; t.tk[key] = (t.tk[key] || []).filter(n => n !== nx).concat(nx); } log(`${name}：${lnm(t)}は次の${G.players[t.owner].name}のターンの間「${label}」`); return 'kept'; } });
const rezCands = p => [...new Set((G.deadLog || []).filter(d => d.owner === p.i && d.turn === G.turn - 1 && p.grave.includes(d.cid) && !CARDS[d.cid].token && !(p.ban || []).some(b => b.cid === d.cid && b.turn === G.turn)).map(d => d.cid))]; // 前の相手のターン中に破壊され、墓地にいるキャラクター
const rezCells = p => [0, 1, 2, 3, 4, 5, 6].map(x => cellOfRow(p.i, 1, x)).filter(cc => !at(cc.x, cc.y) && !wallAt(cc.x, cc.y)).map(cc => [cc.x, cc.y]);
const ACT = {
  signpost: { async run(p) { if (!(await payCost(p, 1))) return false; await UI.cutIn('signpost'); const n = draw(p, 2); log(`道標：${n}枚引いた`); return true; } },
  fireball: { can: p => (foes(p).length ? null : '対象にできる相手キャラクターがいません'), async run(p) {
    const t = await pickUnit(foes(p), '火球の対象を選択'); if (!t) return false;
    if (!(await payCost(p, 1))) return false; await UI.cutIn('fireball');
    if (!(await resist(t, 1, p))) { addStatus(t, 'burn'); damage(t, 2000); log(`火球：${lnm(t)}に2000ダメージ`); }
    return true; } },
  spark: { can: p => (foes(p).length ? null : '対象にできる相手キャラクターがいません'), async run(p) {
    const t = await pickUnit(foes(p), 'スパークの対象を選択'); if (!t) return false;
    if (!(await payCost(p, 2))) return false; await UI.cutIn('spark');
    if (!(await resist(t, 2, p))) { damage(t, 2000); log(`スパーク：${lnm(t)}に2000ダメージ`); if (!t.dead) addStatus(t, 'paralyze'); }
    return true; } },
  sandWall: { async run(p) {
    const cells = []; for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) if (!at(x, y) && !wallAt(x, y)) cells.push([x, y]);
    const r = await UI.pickBoard({ prompt: '砂壁を置くマスを選択', cells, kind: 'place', cancellable: true }); if (!r) return false;
    if (!(await payCost(p, 1))) return false; await UI.cutIn('sandWall');
    G.walls[r[0][0] + ',' + r[0][1]] = { owner: p.i, expire: p.count + 3 }; log(`砂壁を${coord(r[0][0], r[0][1])}に設置`); return true; } },
  freezeWind: { can: p => (foes(p).length ? null : '対象にできる相手キャラクターがいません'), async run(p) {
    const t = await pickUnit(foes(p), 'フリーズウインドの対象を選択'); if (!t) return false;
    if (!(await payCost(p, 1))) return false; await UI.cutIn('freezeWind');
    if (!(await resist(t, 1, p))) { t.sc = Math.max(0, t.sc - 4); addStatus(t, 'chill'); log(`フリーズウインド：${lnm(t)}のSC-4`); }
    return true; } },
  shiftForm: { async run(p) {
    const cs = own(p.i).filter(u => !isAngel(u) && !u.attach.some(a => a.cid === 'shiftForm') && !abC(u.cid, 'noEquipSp'));
    const r = await UI.pickBoard({ prompt: '形質変化をつける自分のキャラクター／アバターを選択', cells: cs.map(u => [u.x, u.y]), kind: 'target', cancellable: true }); if (!r) return false;
    const u = at(r[0][0], r[0][1]);
    if (!(await payCost(p, 1))) return false; await UI.cutIn('shiftForm');
    u.attach.push({ cid: 'shiftForm', since: p.count + 1 }); log(`${lnm(u)}に形質変化`); return 'kept'; } },
  teleport: { can: p => (mine(p).length >= 2 ? null : '自分のキャラクターが2体以上必要です'), async run(p) {
    const r = await UI.pickBoard({ prompt: '位置を入れ替える自分のキャラクターを2体選択', cells: mine(p).map(u => [u.x, u.y]), multi: true, kind: 'target', confirmLabel: '入れ替える', cancellable: true, validate: s => s.length === 2 }); if (!r) return false;
    if (!(await payCost(p, 2))) return false; await UI.cutIn('teleport');
    const a = at(r[0][0], r[0][1]), b = at(r[1][0], r[1][1]);
    log(`テレポート：${lnm(a)}（${coord(a.x, a.y)}）と${lnm(b)}（${coord(b.x, b.y)}）を入れ替えた`);
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
    t.gArmor += 1000 * n; log(`魔法壁：${lnm(t)}に装甲${1000 * n}（SpC${a}${c ? '・SC' + c : ''}消費）`); return true; } },
  chaosHand: { can: p => (foes(p).length && mine(p).length ? null : '自分と相手のキャラクターが1体ずつ必要です'), async run(p) {
    const e = await pickUnit(foes(p), '混沌の手：LPを減らす相手キャラを選択'); if (!e) return false;
    const m = await pickUnit(mine(p), '混沌の手：LPを増やす自分のキャラを選択'); if (!m) return false;
    if (!(await payCost(p, 1))) return false; await UI.cutIn('chaosHand');
    if (!(await resist(e, 1, p))) damage(e, 1000);
    m.lp += 1000; m.buffs.push({ k: 'lp', amt: 1000, who: p.i, until: p.count + 2 }); log(`混沌の手：${lnm(m)}のLP+1000（一時）`); return true; } },
  aquaReturn: { can: p => (allChars().some(u => u.lp <= 3000) ? null : 'LP3000以下のキャラクターがいません'), async run(p) {
    const t = await pickUnit(allChars().filter(u => u.lp <= 3000), 'アクアリターンの対象（LP3000以下）を選択'); if (!t) return false;
    if (!(await payCost(p, 2))) return false; await UI.cutIn('aquaReturn');
    if (await resist(t, 1, p)) return true;
    const o = G.players[t.owner]; for (const w of wps(t)) o.grave.push(w); dropAttach(t, o);
    if (!CARDS[t.cid].token) o.hand.push(t.cid); delete G.units[t.uid]; t.dead = true; log(CARDS[t.cid].token ? `アクアリターン：${CARDS[t.cid].name}がデッキ外へ戻った` : `アクアリターン：${CARDS[t.cid].name}が手札に戻った`);
    if (t.owner !== p.i && !CARDS[t.cid].token) { (o.ban = o.ban || []).push({ cid: t.cid, turn: G.turn + 1 }); log(`${o.name}は次のターン、「${CARDS[t.cid].name}」を盤に出せない`); }
    return true; } },
  goldenBody: { can: () => '黄金の体はバトル時にのみ使用できます' },
  dangerSea: { can: p => (p.dangerSea ? '危険海流域の効果はすでに永続しています（重複しません）' : null), async run(p) {
    if (!(await payCost(p, 2))) return false; await UI.cutIn('dangerSea');
    p.dangerSea = true; syncHB(); log('危険海流域：効果が永続する（使用者のホーム／ボーダーの自分のキャラのLP+1000、水属性に再生。相手キャラが使用者のホーム／ボーダーへ移動する際はサイコロ）'); return true; } },
  breeze: { can: p => (mine(p).some(breezeOk) ? null : '装備できる自分のキャラクターがいません'), async run(p) {
    const cs = mine(p).filter(breezeOk);
    const r = await UI.pickBoard({ prompt: 'ブリーズを装備する自分のキャラクターを選択', cells: cs.map(u => [u.x, u.y]), kind: 'target', cancellable: true }); if (!r) return false;
    const u = at(r[0][0], r[0][1]);
    if (!(await payCost(p, 2))) return false; await UI.cutIn('breeze');
    u.attach.push({ cid: 'breeze', since: p.count, until: p.count + 2 }); log(`${lnm(u)}にブリーズ（移動に必要なSC-1）`); return 'kept'; } },
  instinct: { async run(p) {
    if (!(await payCost(p, 2))) return false; await UI.cutIn('instinct');
    const perm = mine(p).filter(u => CARDS[u.cid].race === 'ワイルド').length >= 3;
    p.instinct = { until: p.count + 3, perm }; log(`本能解放${perm ? '（永続）' : ''}`); return true; } },
  seaRoar: { can: p => (waterCount(p.deckList) < 15 && p.hand.length < 2 ? '水属性が15枚未満のデッキでは、使用前に捨てる手札がもう1枚必要です' : seaRoarTargets(p).length ? null : '対象にできる相手キャラクターがいません（相手のホームテリトリー／ボーダーゾーン内が対象）'), async run(p) {
    const t = await pickUnit(seaRoarTargets(p), '海竜の咆哮の対象を選択'); if (!t) return false;
    if (!(await payCost(p, 4))) return false;
    if (waterCount(p.deckList) < 15 && p.hand.length) { // 自分のデッキに水属性が15枚未満なら、使用する前に手札を1枚捨てる
      const di = p.hand.length === 1 ? 0 : ((await UI.pickCards('海竜の咆哮', '水属性のカードが15枚未満のため、使用前に捨てる手札を1枚選んでください', p.hand.slice(), 1, p.i, 1)) || [0])[0];
      const dc = p.hand.splice(di, 1)[0]; p.grave.push(dc); syncHB(); log(`${p.name}：海竜の咆哮の使用前に「${CARDS[dc].name}」を捨てた`);
    }
    await UI.cutIn('seaRoar');
    const n = Math.max(0, p.hand.length - 1); // 捨てた後の手札の枚数から1引いた数
    if (!(await resist(t, 4, p))) { damage(t, 1000 * n); log(`海竜の咆哮：手札（使用後の枚数−1）${n}枚、${lnm(t)}に${1000 * n}ダメージ`); }
    return true; } },
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
        const tg = u; // 庇護はアイテムに対してのみ使える（スペルには使えない）
        log(`落雷：${lnm(tg)}（${coord(tg.x, tg.y)}）に4000ダメージ`);
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
        log(`クリエイトゴーレム：${coord(target.x, target.y)}のゴーレムがステップ${n}になった`); await spellDraw(target, p, 3);
      } else {
        const u = mkUnit(p.i, 'golem1', pos[0], pos[1]); u.armor = 2000;
        log(`クリエイトゴーレム：ゴーレム（ステップ1）を${coord(u.x, u.y)}に配置`); await spellDraw(u, p, 4);
      }
      p.golemRet = p.golemRet || 0;
      if (p.golemRet < 3 && (await UI.ask(`クリエイトゴーレムを山札に戻し、シャッフルしますか？（残り${3 - p.golemRet}回）`, ['山札に戻す', '墓地に置く'])) === '山札に戻す') {
        p.golemRet++; p.deck.push(cid); p.deck = shuffle(p.deck); log('クリエイトゴーレム：山札に戻してシャッフルした'); return 'kept';
      }
      return true;
    } },
  thornTrap: { can: p => (trapCells(p).length ? null : '設置できるマスがありません'), async run(p) {
    const cells = trapCells(p);
    const hid = (await UI.ask(HID_Q, HID_A)) === HID_A[0];
    const r = await UI.pickBoard({ prompt: '配置するマスを選択', cells, kind: 'place', cancellable: true }); if (!r) return false;
    G.traps[sKey(r[0][0], r[0][1])] = { owner: p.i, hidden: hid };
    log(hid ? `${p.name}：非公開カードを${coord(r[0][0], r[0][1])}に置いた` : `棘付きトラップ：${coord(r[0][0], r[0][1])}に設置`); if (!hid) await UI.cutIn('thornTrap'); return true; } },
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
  redDragonBreath: { can: p => (own(p.i).some(u => !isAv(u) && !abC(u.cid, 'noEquipSp') && canPayAmt(u, holdsAttr(u, 'redDragonBreath') ? 2 : 3)) ? null : 'SpC3を支払えるキャラクターがいません（アバターは対象にできません）'), async run(p) {
    const u = await payCost(p, 3, v => !isAv(v) && !abC(v.cid, 'noEquipSp')); if (!u) return false; await UI.cutIn('redDragonBreath');
    u.attach.push({ cid: 'redDragonBreath', since: p.count, until: p.count + 2 }); log(`レッドドラゴンブレス：${lnm(u)}に「焼却」を与えた`); checkAuras(); return 'kept'; } },
  windSlash: { can: p => (mine(p).some(u => !isAv(u) && !abC(u.cid, 'noEquipSp')) ? null : '装備できる自分のキャラクターがいません'), async run(p) {
    const cs = mine(p).filter(u => !isAv(u) && !abC(u.cid, 'noEquipSp'));
    const r = await UI.pickBoard({ prompt: 'ウインドスラッシュを装備する自分のユニットを選択', cells: cs.map(u => [u.x, u.y]), kind: 'target', cancellable: true }); if (!r) return false;
    const u = at(r[0][0], r[0][1]);
    if (!(await payCost(p, 1))) return false; await UI.cutIn('windSlash');
    u.attach.push({ cid: 'windSlash', since: p.count, until: p.count + 2 }); log(`${lnm(u)}にウインドスラッシュ`); return 'kept'; } },
  swordFine: { can: EQP('swordFine'), run: (p, c) => equipWeapon(p, c) },
  heroSword: { can: p => {
    if (own(p.i).some(u => canEquip(u, 'heroSword'))) return null; // 盤に勇者がいるなら通常の武器として装備できる
    if (allChars().some(u => u.cid === 'hero')) return '盤に勇者がいるため配置できません（装備できる勇者もいません）';
    if (!p.deck.includes('hero') && !p.grave.includes('hero')) return 'デッキにも墓地にも勇者がいません';
    return cellsRow1(p).length ? null : '1列目に空きマスがありません'; },
    async run(p, cid) {
      if (own(p.i).some(u => canEquip(u, 'heroSword'))) return equipWeapon(p, cid);
      const src = [p.deck.includes('hero') ? '山札' : null, p.grave.includes('hero') ? '墓地' : null].filter(Boolean);
      const from = src.length > 1 ? await UI.ask('勇者をどこから出しますか？', src) : src[0];
      const cells = cellsRow1(p);
      const pick = await UI.pickBoard({ prompt: '勇者を置くマス（1列目）を選択', cells, kind: 'place', cancellable: true });
      if (!pick) return false;
      await UI.cutIn(cid);
      const z = from === '墓地' ? 'grave' : 'deck'; p[z].splice(p[z].indexOf('hero'), 1); if (z === 'deck') p.deck = shuffle(p.deck);
      const u = mkUnit(p.i, 'hero', pick[0][0], pick[0][1]);
      u.weapon = 'heroSword'; u.lp = baseLP(u); u.rspc = baseRSpC(u);
      sfx('summon'); log(`${p.name}：勇者の剣で${from}から勇者を${coord(u.x, u.y)}に配置し、装備させた`);
      checkAuras(); await sanctuaryCheck(u);
      return 'kept'; } },
  blessing: { can: p => (own(p.i).some(u => canPayAmt(u, spReduce(u, 1, 'blessing'))) ? null : 'SpC1を支払えるキャラクター／アバターがいません'), async run(p, cid) {
    if (!(await payCost(p, 1))) return false; await UI.cutIn(cid);
    draw(p, 1); const cur = G.diceUp && G.diceUp.turn === G.turn ? G.diceUp.n : 0; G.diceUp = { turn: G.turn, n: cur + 1 };
    log(`祝福：カードを1枚引き、このターンのサイコロの目が+${cur + 1}（6が上限）`); UI.toast('このターン、サイコロの目+1（6が上限）');
    return true; } },
  braveSword: { can: EQUIP_HUM, run: (p, c) => equipWeapon(p, c) },
  flameSword: { can: EQP('flameSword'), run: (p, c) => equipWeapon(p, c) },
  bowFine: { can: EQP('bowFine'), run: (p, c) => equipWeapon(p, c) },
  shieldFine: { can: EQP('shieldFine'), run: (p, c) => equipWeapon(p, c) },
  wandFine: { can: EQP('wandFine'), run: (p, c) => equipWeapon(p, c) },
  deepTrident: { can: EQP('deepTrident'), run: (p, c) => equipWeapon(p, c) },
  stoneThrow: { can: () => (allChars().length ? null : '対象がいません'), run: potion(t => { log(`投石：${lnm(t)}に1500ダメージ`); damage(t, 1500); }) },
  staminaPotion: { can: () => (allChars().length ? null : '対象がいません'), run: potion(t => { t.sc += 2; heal(t, 1000); log(`スタミナポーション：${lnm(t)}`); }) },
  magicPotion: { can: () => (allChars().length ? null : '対象がいません'), run: potion(t => { t.spc += 1; heal(t, 1000); log(`マジックポーション：${lnm(t)}`); }) },
  hyperPotion: { can: () => (allChars().length ? null : '対象がいません'), run: potion(t => {
    const ss = statusList(t); if (ss.length) { const k = ss[rnd(ss.length)]; cure(t, k); log(`ハイパーポーション：${lnm(t)}の${STATUS_NAME[k]}を治療`); }
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
    if (!(await resist(t, 1, p))) { addStatus(t, 'petrify'); log(`石化光線：${lnm(t)}が石化した`); }
    return true; } },
  elixir: { can: () => (allChars().length ? null : '対象がいません'), run: potion(t => {
    for (let g = 0; g < 8 && statusList(t).length; g++) for (const k of statusList(t)) cure(t, k);
    t.lp = Math.max(t.lp, healCap(t)); t.sc += 2; t.spc += 1; log(`エリクサー：${lnm(t)}の状態異常を全て治療し、LPを全回復。SC+2・SpC+1`); }) },
  electraHeal: { can: p => (chars(p.i).length ? null : '対象にできる自分のキャラクターがいません'), async run(p) {
    const a = await UI.ask('エレクトラヒール：どちらを使いますか？', ['全員：LP2000回復＋状態異常1つ治療', '1体：LP全回復＋状態異常全治療', 'キャンセル']);
    if (!a || a === 'キャンセル') return false;
    const all = a.startsWith('全員');
    let t = null;
    if (!all) { t = await pickUnit(chars(p.i), 'エレクトラヒールの対象（自分のキャラクター）を選択'); if (!t) return false; }
    if (!(await payCost(p, 3))) return false; await UI.cutIn('electraHeal');
    if (all) {
      for (const u of chars(p.i)) {
        const ss = statusList(u); if (ss.length) { const k = ss[rnd(ss.length)]; cure(u, k); log(`エレクトラヒール：${lnm(u)}の${STATUS_NAME[k]}を治療`); }
        heal(u, 2000);
      }
      log('エレクトラヒール：自分のキャラクター全員のLPを2000回復');
    } else {
      if (await resist(t, 3, p)) return true; if (t.dead) return true;
      for (let g = 0; g < 8 && statusList(t).length; g++) for (const k of statusList(t)) cure(t, k);
      t.lp = Math.max(t.lp, healCap(t)); log(`エレクトラヒール：${lnm(t)}のLPを全回復し、状態異常を全て治療`);
    }
    return true; } },
  holyLight: { can: p => (foes(p).length ? null : '対象にできる相手キャラクターがいません'), async run(p) {
    const t = await pickUnit(foes(p), 'ホーリーライトの対象を選択'); if (!t) return false;
    if (!(await payCost(p, 2))) return false; await UI.cutIn('holyLight');
    if (!(await resist(t, 2, p))) { t.sc = Math.max(0, t.sc - 4); log(`ホーリーライト：${lnm(t)}のSCを4減らした`); }
    return true; } },
  holySmite: { can: p => (foes(p).length ? null : '対象にできる相手キャラクターがいません'), async run(p) {
    const t = await pickUnit(foes(p), 'ホーリースマイトの対象を選択'); if (!t) return false;
    if (!(await payCost(p, 2))) return false; await UI.cutIn('holySmite');
    if (!(await resist(t, 2, p)) && !t.dead) { const d = rollD6(), up = d >= 6 ? 500 : 0; UI.toast(`🎲 ホーリースマイト：サイコロ ${d}${up ? '（ダメージ+500）' : ''}`); log(`ホーリースマイト：サイコロ ${d}、${lnm(t)}に${2000 + up}ダメージ`); damage(t, 2000 + up, { hit: true }); }
    return true; } },
  holyProt: { can: p => (chars(p.i).length ? null : '対象にできる自分のキャラクターがいません'), async run(p) {
    const t = await pickUnit(chars(p.i), 'ホーリープロテクションの対象（自分のキャラクター）を選択'); if (!t) return false;
    if (!(await payCost(p, 2))) return false; await UI.cutIn('holyProt');
    if (await resist(t, 2, p)) return true; if (t.dead) return true;
    const d = rollD6(), up = d >= 6 ? 500 : 0; UI.toast(`🎲 ホーリープロテクション：サイコロ ${d}${up ? '（装甲値+500）' : ''}`); t.gArmor += 1500 + up; log(`ホーリープロテクション：サイコロ ${d}、${lnm(t)}に装甲値${1500 + up}`); return true; } },
  resurrection: {
    can: p => (rezCands(p).length ? (rezCells(p).length ? (own(p.i).some(u => canPayAmt(u, 4) && !priestBlock(u, 'resurrection')) ? null : 'SpC4を支払えるキャラクターがいません') : '1列目に空いているマスがありません') : '前の相手のターン中に破壊され、墓地にいる自分のキャラクターがいません'),
    async run(p) {
      const cs = rezCands(p); let cid = cs[0];
      if (cs.length > 1) { const r = UI.pickCards ? await UI.pickCards('リザレクション', `【${p.name}】蘇らせるキャラクターを選ぶ`, cs, 1, p.i, 1) : [0]; cid = cs[(r && r[0]) || 0] || cs[0]; }
      const r = await UI.pickBoard({ prompt: `${CARDS[cid].name}を置くマスを選択（1列目）`, cells: rezCells(p), kind: 'place', cancellable: true }); if (!r) return false;
      if (!(await payCost(p, 4))) return false; await UI.cutIn('resurrection');
      p.grave.splice(p.grave.indexOf(cid), 1);
      const u = mkUnit(p.i, cid, r[0][0], r[0][1]), c = CARDS[cid];
      u.lpBonus = Math.max(1 - c.lp, Math.min(-1000, 4000 - c.lp)); u.lp = baseLP(u);
      if (c.startArmor) u.armor = c.startArmor;
      sfx('summon'); log(`リザレクション：${lnm(u)}を${coord(u.x, u.y)}に蘇らせた（LPのステータス${u.lpBonus}）`);
      await etb(u, p, false); await sanctuaryCheck(u);
      return true; } },
  shopTicket: { can: () => 'ショップで購入するときに自動で消費されます（使用はできません）', run: async () => false },
  tkFrenzy: tkAct('tkFrenzy', 'frenzy', '狂乱', '発狂'),
  tkAmbush: tkAct('tkAmbush', 'ambush', 'ふいうち', '奇襲'),
  tkChase: tkAct('tkChase', 'chase', 'ハンティング', '追跡'),
  tkMutate: tkAct('tkMutate', 'mutate', '斜め移動のみ', '変異'),
  tkAgile: { can: p => (own(p.i).some(u => !u.hidden && !isAv(u) && u.placedAt === G.turn && u.agile !== G.turn) ? null : 'このターンに配置したキャラクターがいません'), async run(p) {
    const cs = own(p.i).filter(u => !u.hidden && !isAv(u) && !isAngel(u) && u.placedAt === G.turn && u.agile !== G.turn);
    const t = await pickUnit(cs, '俊敏の対象（このターンに配置した自分のキャラクター）を選択'); if (!t) return false;
    await UI.cutIn('tkAgile'); t.agile = G.turn; log(`俊敏：${lnm(t)}は配置したターンから移動できる`); return 'kept'; } },
  ferocious: {
    can: p => (ferTargets(p).length ? null : '自分のホームテリトリーに、SCとSpCが1以上の種族ワイルドのモンスターが必要です'),
    async run(p, cid) {
      const ts = ferTargets(p);
      const t = await pickUnit(ts, '獰猛なる覇者の加護：対象のモンスターを選択（SCとSpCを1ずつ消費）'); if (!t) return false;
      await UI.cutIn('ferocious');
      draw(p, 1);
      spendSC(t, 1); t.spc -= 1; t.extra = p.count + 1; t.lpBonus = (t.lpBonus || 0) + 500; t.lp += 500;
      log(`獰猛なる覇者の加護：${lnm(t)}の次の自分のターンの行動回数+1・LP+500（SC-1・SpC-1）`); return true; } },
  fightSpirit: { can: p => (mine(p).some(u => CARDS[u.cid].race === 'ワイルド' && u.spc >= 1) ? (mine(p).some(canTechPay) ? null : 'SCを消費できるキャラクターがいません') : '現在のSpCが1以上の種族ワイルドが必要です'), async run(p) {
    const u = await payTech(p, mine(p).filter(canTechPay), '闘争心をつけるキャラクターを選択（SCを1消費）'); if (!u) return false;
    await UI.cutIn('fightSpirit'); u.attach.push({ cid: 'fightSpirit', since: p.count + 1 }); log(`${lnm(u)}に闘争心`); return 'kept'; } },
};
async function playHand(idx) {
  const p = cur();
  if (G.phase !== 'main' || G.over) return;
  const cid = p.hand[idx], c = CARDS[cid];
  if (c.kind === 'char') await summon(p, idx);
  else {
    const A = ACT[cid], why = A.can && A.can(p);
    if (why) { UI.toast(why); return; }
    p.hand.splice(idx, 1); syncHB();
    let r = false;
    G.curSpell = c.kind === 'spell' ? cid : null;
    try { r = await A.run(p, cid); } catch (e) { console.error(e); }
    G.curSpell = null;
    if (r === false) { p.hand.splice(Math.min(idx, p.hand.length), 0, cid); syncHB(); }
    else if (r !== 'kept') p.grave.push(cid);
    if (r !== false && c.kind === 'spell') await onSpellUsed(p, cid);
  }
  afterAction();
}
function sanctForce() {
  for (const u of U()) if (u.hidden && u.sanct && !u.dead && baseLP(u) > 4000 && !U().some(v => v !== u && !v.dead && v.owner === u.owner && v.x === u.x && v.y === u.y)) {
    u.hidden = false; u.marked = false; u.sanct = false; u.noSanct = sKey(u.x, u.y); log(`${lnm(u)}のLPが4000を超えたため、強制的に公開された（${coord(u.x, u.y)}）`);
    const foe = U().find(v => !v.dead && !v.hidden && v.owner !== u.owner && v.x === u.x && v.y === u.y);
    if (foe) { log(`同じマスに${lnm(foe)}がいたため、即座にバトル`); battle(u, foe); }
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
  log(`棘付きトラップ：${coord(u.x, u.y)}の${t.hidden ? '非公開だった' : ''}トラップが発動（${lnm(u)}のLPを5000下げる）`);
  await UI.cutIn('thornTrap');
  const before = u.lp; damage(u, 5000);
  if (!u.dead) { const dealt = before - u.lp; if (dealt > 2000) { u.trapLoss = (u.trapLoss || 0) + (dealt - 2000); log(`${lnm(u)}：このダメージのうち回復できるのは2000まで（最大LP-${dealt - 2000}）`); } }
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
  log(`魔法聖域：${lnm(u)}が非公開になった（${coord(u.x, u.y)}）`);
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
    const wt = cand.map(id => Math.round((CARDS[id].shopW || 1) * 2)), tot = wt.reduce((a, b) => a + b, 0);
    let r0 = rnd(tot), ci = 0; while (r0 >= wt[ci]) { r0 -= wt[ci]; ci++; }
    const cid = cand[ci];
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
  sfx('coin'); p.sellUsed = true; p.hand.splice(i, 1); p.hand.push('shopTicket'); syncHB(); p.coins += sellOf(cid);
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
  p.coins -= s.price; s.sold = true; p.hand.push(s.cid); syncHB();
  log(`${p.name}：${CARDS[s.cid].name}を購入（貨幣ゲージ-${s.price}、残り${p.coins}／${how}を消費）`); afterAction();
}

/* ===== ターン進行 ===== */
const instinctActive = p => !!p.instinct && (p.instinct.perm || p.count <= p.instinct.until);
async function startTurn(i) {
  syncHB();
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
      u.attach = u.attach.filter(a => { if (a.until !== undefined && c >= a.until) { if (a.cid === 'breeze') (G.pendBreeze = G.pendBreeze || []).push(p.i); else p.grave.push(a.cid); return false; } return true; });
      if (u.st.petrify != null && c >= u.st.petrify) delete u.st.petrify;
      if (u.tk) for (const k of Object.keys(u.tk)) { u.tk[k] = u.tk[k].filter(n => n > c); if (!u.tk[k].length) delete u.tk[k]; }
    }
  }
  if (p.instinct && !p.instinct.perm && c >= p.instinct.until) p.instinct = null;
  await flushBreeze(); // ブリーズの効果が切れた時も、手札に戻すか選べる
  for (const u of own(p.i)) {
    u.tArmor = 0;
    const b = baseLP(u); if (u.lp < b && !u.incPen) u.lp = b; // 焼却を受けている間はターン終了時にLPが回復しない
    const home = terr(u) !== 'enemy';
    if (u.noSpc !== G.turn) u.sc = Math.max(u.sc, Math.min(baseSC(u), u.sc + (home ? 2 : 1) + (u.sanct ? 1 : 0) + (abU(u, 'superRegen') ? 1 : 0))); // 超再生：ターン終了時のSC回復量+1
    { const pts = u.noSpc === G.turn ? 0 : (home ? 1 : 0) + (u.sanct ? 1 : 0), gap = Math.max(0, baseSpC(u) - u.spc), use = Math.min(gap, pts);
      u.spc = Math.max(u.spc, Math.min(baseSpC(u), u.spc + use));
      // 通常のSpCが優先して回復し、通常のSpCが最大になっている場合のみ、余った分が魔法耐性用SpCの回復に回る
      if (baseRSpC(u) > 0) u.rspc = Math.max(u.rspc || 0, Math.min(baseRSpC(u), (u.rspc || 0) + (pts - use))); }
  }
  if (!(p.i === 0 && p.count === 1)) { p.coins++; log(`${p.name}：ターン終了で貨幣ゲージ+1（${p.coins}）`); }
  await startTurn(1 - p.i);
  return true;
}
