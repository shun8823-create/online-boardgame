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
const isArmorW = cid => !!cid && CARDS[cid].name.includes('鎧');
const wKind = cid => isShieldW(cid) ? 's' : isArmorW(cid) ? 'a' : 'o'; // 盾・鎧・その他：同じ種類は2つ装備できない
const hasSA = u => wps(u).some(c => isShieldW(c) || isArmorW(c)); // 盾・鎧を装備している
const armorDual = u => !!(u.weapon && u.weapon2 && wps(u).some(isArmorW)); // 鎧と他の武器の同時装備：ターン終了時のSC回復-1
const wSum = (u, f) => wps(u).reduce((s, c) => s + (CARDS[c][f] || 0), 0);
const isHeavyW = cid => !!cid && CARDS[cid].weapon && !!CARDS[cid].heavy; // 「重装備」の印をもつ武器（勇者の剣・勇竜剣・烈火剣）：LP4000以上のキャラのみ装備できる
const dualPen = u => (u.weapon && u.weapon2 && wps(u).some(isShieldW) ? 1 + (wps(u).some(isHeavyW) ? 1 : 0) : 0); // 武器2つ：SC+1（LP4000以上が条件の武器を含むならさらに+1）
const scAvail = u => (u.st && u.st.paralyze ? (u.scT === G.turn ? 0 : Math.min(u.sc, 1)) : u.sc); // まひ：1ターンにSCを1つしか使えない
const spendSC = (u, n) => { if (n <= 0) return; u.sc -= n; if (u.st && u.st.paralyze) u.scT = G.turn; };
const unitAttrs = u => [...charAttrs(u.cid), ...(u.adapt || [])]; // 適応で得た属性を含む
const holdsAttr = (u, scid) => { const a = scid && CARDS[scid].attr; return !!a && [...unitAttrs(u), ...wps(u).flatMap(c => CARDS[c].wattr || [])].some(x => a.split('・').includes(x)); };
// 奥義（発狂・奇襲・追跡・変異）の効果が有効なターンは、持ち主のターン番号の配列 u.tk[k] で持つ（重ねがけで何ターン分でも持てる）
const tkOn = (u, k) => !!(u.tk && u.tk[k] && u.owner === G.active && u.tk[k].includes(G.players[u.owner].count));
const abU = (u, k) => abC(u.cid, k) || (k === 'berserk' && (tkOn(u, 'frenzy') || (!!G.lap && CARDS[u.cid].kind === 'char'))) || (k === 'ambush' && tkOn(u, 'ambush')) || (k === 'counter' && !!u.counter) || (k === 'regen' && dangerLP(u) && holdsWater(u)) || (k === 'dwarf' && abC(u.cid, 'crabGuard') && !u.dead && terr(u) === 'home') || wps(u).some(c => (CARDS[c].wab || []).includes(k)) || (k === 'incinerate' && hasW(u, 'flameSword') && u.flame != null && (G.turn === u.flame || G.turn === u.flame + 1)) || (k === 'incinerate' && !!u.attach && u.attach.some(a => a.cid === 'redDragonBreath')) || (k === 'incinerate' && u.burn != null && (G.turn === u.burn || G.turn === u.burn + 1));
const holdsWater = u => [...unitAttrs(u), ...wps(u).flatMap(c => CARDS[c].wattr || [])].includes('水');
const dangerLP = u => !!G.players[u.owner].dangerSea && !isAv(u) && !u.dead && terr(u) !== 'enemy'; // 危険海流域：ホーム／ボーダーにいる自分のキャラ
const aquaticOn = u => abC(u.cid, 'aquatic') && waterCount(G.players[1 - u.owner].deckList) < 15; // 水棲：相手のデッキに水属性が15枚以上あると無効
const nm = u => CARDS[u.cid].name;
const HID_Q = '非公開で置きますか？（自分のホームテリトリーに置く）', HID_A = ['非公開で置く', '公開で置く'];
const lnm = u => u.hidden ? '非公開カード' : CARDS[u.cid].name;
const log = s => { if (typeof UI !== 'undefined' && UI.aimPend && UI.aimFlush) UI.aimFlush(); G.log.unshift(s); if (G.log.length > 120) G.log.pop(); };
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
      if (!p.reshuffled && p.grave.length) {
        const sg = p.grave.filter(c => c === 'signpost').length; if (sg) { p.grave = p.grave.filter(c => c !== 'signpost'); log(`${p.name}：デッキが2周目に入るため、墓地の「道標（マジックサイン）」${sg}枚をデッキ外に送った`); }
        p.deck = shuffle(p.grave); p.grave = []; p.reshuffled = true; log(`${p.name}：墓地をシャッフルして山札にした`);
        if (!G.lap) { G.lap = p.name; log(`【二周目突入】${p.name}のデッキが2周目に入った。手札・デッキ・墓地・盤の全てのキャラクターが「狂乱」を得て、移動に必要なSCが1減る（狂乱の+1と相殺され、移動のSCは元のまま）`); if (UI.toast) UI.toast('⚠ 二周目突入：全キャラが「狂乱」を得る／移動のSC-1'); } }
      else break;
    }
    p.hand.push(p.deck.shift()); k++;
  }
  syncHB();
  return k;
}

/* ステータス */
const isGobCard = cid => cid !== 'gobFlute' && CARDS[cid].name.includes('ゴブリン'); // 「ゴブリン」と名のつくカード（ゴブリンの笛を除く）
const isGobName = u => CARDS[u.cid].kind === 'char' && CARDS[u.cid].name.includes('ゴブリン');
const baseLP = u => (syncHBu(u), CARDS[u.cid].lp) + (isGobName(u) && G.players[u.owner].parade ? 1500 : 0) + (u.lpBonus || 0) + (u.hbA || 0) + wSum(u, 'wlp') - u.lpPen - (u.trapLoss || 0);
function adaptFrom(g, payer) { // 適応：生成のためにSpCを消費したキャラクターの属性を受け継ぐ
  if (!g || !payer || g === payer) return;
  const add = unitAttrs(payer).filter(a => !unitAttrs(g).includes(a));
  if (add.length) { g.adapt = [...(g.adapt || []), ...add]; log(`適応：${lnm(g)}が${add.join('・')}属性を得た`); }
}
const golemStep = u => (/^golem[123]$/.test(u.cid) ? +u.cid.slice(5) : 0);
const baseSC = u => CARDS[u.cid].sc - u.scPen;
// 武器が与える耐性SpC。すでに「魔法耐性」を持つキャラ（自身の能力、または別の武器）には、与える耐性SpCが1に減る
const wRSpC = u => wps(u).reduce((s, c, i, arr) => { const v = CARDS[c].wrspc || 0; if (!v) return s; const had = abC(u.cid, 'magicResist') || arr.some((d, j) => j !== i && (CARDS[d].wab || []).includes('magicResist')); return s + (had ? Math.min(v, 1) : v); }, 0);
const baseRSpC = u => (CARDS[u.cid].rspc || 0) + wRSpC(u); // 魔法耐性用SpC（魔法耐性・超魔法耐性の支払い専用）
const baseSpC = u => (hasSA(u) && CARDS[u.cid].spc >= 2 ? 1 : CARDS[u.cid].spc) + wSum(u, 'wspc'); // 盾・鎧：元のSpCが2以上なら1まで下がる
function OP(u) { let v = CARDS[u.cid].op + (u.ambushNow ? 1000 : 0); v += wSum(u, 'wop'); for (const a of u.attach) v += CARDS[a.cid].aop || 0; for (const b of u.buffs) if (b.k === 'op') v += b.amt; return v; }
function DP(u) { let v = CARDS[u.cid].dp + u.dpBonus; v += wSum(u, 'wdp'); for (const b of u.buffs) if (b.k === 'dp') v += b.amt; return v; }
const aop = a => (a.cid === 'fightSpirit' ? 500 : 0);
CARDS.fightSpirit.aop = 500;
function breakArmor(u, n) { for (const k of ['tArmor', 'gArmor', 'fArmor', 'armor']) { const d = Math.min(u[k] || 0, n); u[k] = (u[k] || 0) - d; n -= d; if (n <= 0) break; } }
const armorTotal = u => u.armor + u.gArmor + u.tArmor + (u.fArmor || 0);
const armorRoom = u => (hasW(u, 'armorFine') ? Math.max(0, CARDS.armorFine.armorCap - armorTotal(u)) : Infinity); // 上等な鎧：装備している間、装甲値は2000より増えない
const addArmor = (u, k, n) => { u[k] = (u[k] || 0) + Math.min(n, armorRoom(u)); };
const fArmorCheck = u => { if (u.extra && terr(u) !== 'home') { u.extra = 0; log(`${lnm(u)}の「獰猛なる覇者の加護」の効果がホームテリトリーを出たため消えた`); } };
const baseActs = u => (((abU(u, 'twoActions') && u.twoOn === G.turn) || (u.k2 && abU(u, 'knightCmd'))) && !assaultOn(u) ? 2 : 1);
const avMax = u => (CARDS[u.cid].maxMove || 4) + (u.mvUp || 0); // アバターがゲーム中に動ける回数の上限（限界突破で増える）
const avLeft = u => Math.max(0, avMax(u) - (u.mvDone || 0));
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
  if (isAv(u)) { if (G.over == null) { G.over = 1 - u.owner; log(`${p.name}のアバターが倒された`); if (UI.gameOver) UI.gameOver(G.over); } }
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
  if (u.dead || u.hidden || G.over != null) return false;
  if (u.owner !== G.active) return false;
  if (u.st.petrify != null) return false;
  if (u.acted >= actLimit(u)) return false;
  if (isAv(u) && avLeft(u) <= 0) return false;
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
    const cost = () => (assault ? 0 : Math.max(0, 1 + (bers ? 1 : 0) + dualPen(u) - breezeN(u) - (G.lap && !isAv(u) ? 1 : 0))); // SCは「1回の移動」につき消費（マス数ではない）
    const push = (type, c, steps, path) => { const cs = cost(); if (assault || scAvail(u) >= cs + pendingExtra(u, c[1])) out.push({ x: c[0], y: c[1], type, steps, cost: cs, path, back: backPure && type === 'attack' }); };
    if (len === 1) {
      const c = cells[0], r = evalCell(u, c[0], c[1]);
      if (r === 'empty') push('move', c, 1, [c]);
      else if (r === 'enemy' && canHit(at(c[0], c[1]))) push('attack', c, 1, [c]);
    } else {
      const a = cells[0], b = cells[1], ra = evalCell(u, a[0], a[1]);
      if (ra === 'enemy') { if (canHit(at(a[0], a[1]))) push('attack', a, 1, [a]); continue; }
      if (ra === 'empty' || (ra === 'ally' && assault)) { // 狂乱では自分のキャラは通り抜けられない（盤外・障害物と同じ）。突撃司令のみ通り抜けられる
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
  const cost = Math.max(0, 1 + (bers ? 1 : 0) + dualPen(u) - breezeN(u) - (G.lap && !isAv(u) ? 1 : 0));
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
    if (u.dead || G.over != null) return;
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
  u.acted++; if (isAv(u)) u.mvDone = (u.mvDone || 0) + 1;
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
      if (u.dead || G.over != null) return;
      const d = enemyAt(x, y, o);
      if (!d) { u.x = x; u.y = y; }
      else {
        if (mv.back && abU(u, 'ambush')) u.ambushNow = true;
        let won; try { won = await battle(u, d); } finally { u.ambushNow = false; }
        if (G.over != null || u.dead) return;
        if (won) { u.x = x; u.y = y; } else { u.x = from.x; u.y = from.y; return; }
      }
    } else {
      u.x = x; u.y = y;
      await slashTrigger(u);
      if (u.dead || G.over != null) return;
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
  if (u.dead || G.over != null) return;
  await sanctuaryCheck(u);
  if (!u.dead && G.over == null && !u.hidden && hasW(u, 'braveSword') && abU(u, 'swordsman') && !(from && terrOfRow(rowOf(u.owner, from.y)) === 'border') && terr(u) === 'border' && !u.uses.braveDone) { u.uses.braveDone = true; await braveStrike(u); } // 初めてボーダーゾーンに入った時のみ
  if (u.dead || G.over != null) return;
  if (!u.hidden && hasW(u, 'heroSword')) await heroRoll(u);
  if (u.dead || G.over != null) return;
  if (instinctActive(p) && !u.instinctGot && (terr(u) === 'enemy' || terr(u) === 'border') && !(from && terrOfRow(rowOf(u.owner, from.y)) === terr(u))) { u.instinctGot = true; u.lpBonus = (u.lpBonus || 0) + 1000; u.lp += 1000; log(`本能解放：${lnm(u)}のLP+1000（ステータス上昇）`); } // 1体につき1度だけ。上昇したLPはその後も残る
  for (const c of U()) {
    if (c.owner !== u.owner && !c.hidden && abU(c, 'petrify') && !isAv(u) && c.x === u.x && c.y + fwd(c.owner) === u.y) addStatus(u, 'petrify');
  }
  checkAuras();
  if (u.dead || G.over != null) return;
  UI.render();
  if (hasHunting(u) && !assaultOn(u) && u.uses.hunt !== G.turn) await huntLoop(u);
}
async function braveStrike(u) {
  const tg = chars(1 - u.owner).filter(t => rowOf(u.owner, t.y) >= 4);
  if (!tg.length) return;
  if ((await UI.ask(`勇竜剣：${nm(u)}がボーダーゾーンに入った。相手が選んだキャラクター1体とバトルしますか？`, ['バトルする', 'バトルしない'], u.owner)) !== 'バトルする') return;
  const r = await UI.pickBoard({ who: 1 - u.owner, prompt: `勇竜剣：${nm(u)}とバトルする自分のキャラクターを選択`, cells: tg.map(t => [t.x, t.y]), kind: 'target', cancellable: false });
  const t = (r && r[0] && at(r[0][0], r[0][1])) || tg[0]; if (!t || t.dead) return; // 相手が選ぶ（選べなかった場合のみ先頭）
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
/* レッドドラゴン：メインステップ中にSpC1で、次の自分のターンのはじめまで「焼却」を得る（2回まで） */
async function burnStart(u) {
  if (!u || u.dead || u.hidden || !abU(u, 'burnAct') || u.owner !== G.active || G.phase !== 'main' || u.st.petrify != null) return;
  const n = u.uses.burnN || 0; if (n >= 3 || u.spc < 1 || (u.burn != null && G.turn === u.burn)) return;
  if (UI.abilityCut) await UI.abilityCut(u); 
  u.spc -= 1; u.uses.burnN = n + 1; u.burn = G.turn; sfx('fire'); log(`${lnm(u)}：SpCを1つ消費し、次の自分のターンのはじめまで「焼却」を得た（${n + 1}/3回目）`);
  checkAuras(); UI.render();
}
async function flameStart(u) {
  if (!u || u.dead || !hasW(u, 'flameSword') || u.flameUsed || u.owner !== G.active || G.phase !== 'main') return;
  if (UI.abilityCut) await UI.abilityCut(u); 
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
  if (u.dead || G.over != null) return;
  const d = enemyAt(m.x, m.y, u.owner);
  if (!d) return;
  if (m.back && abU(u, 'ambush')) u.ambushNow = true;
  let won; try { won = await battle(u, d); } finally { u.ambushNow = false; }
  if (u.dead || G.over != null || !won) return;
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
async function battle(att, def) { // 確認ダイアログ（黄金の体など）が「誰と誰のバトルか」を表示できるよう、バトル中は組を記録しておく
  G.curBattle = { att, def };
  try { if (UI.suspense) await UI.suspense(att, def); return await battle0(att, def); } finally { G.curBattle = null; }
}
async function battle0(att, def) {
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
  if (G.over != null) return false;
  for (const [a, b] of [[att, def], [def, att]]) {
    if (abU(a, 'slime') && b.weapon) {
      const d = rollD6(); UI.toast(`🎲 スライムのサイコロ：${d}`);
      if (d >= 4) { const wd = b.weapon; G.players[b.owner].grave.push(wd); b.weapon = b.weapon2 || null; b.weapon2 = null; b.armor = Math.max(0, b.armor - (CARDS[wd].warm || 0)); b.spc = Math.min(b.spc, baseSpC(b)); b.lp = Math.min(b.lp, baseLP(b)); b.rspc = Math.min(b.rspc || 0, baseRSpC(b)); log(`${lnm(b)}の武器が破壊された`); }
    }
  }
  let forced = null;
  for (const side of [att, def]) { if (await goldenPrompt(side)) { forced = side === att ? 'att' : 'def'; break; } }
  for (const [a, b] of [[att, def], [def, att]]) { // 深淵の三又槍：水属性の装備者は、バトル前に相手の装甲値を減らす
    const br = wSum(a, 'wbreak');
    if (br && holdsWater(a) && !a.dead && !b.dead && armorTotal(b) > 0) { breakArmor(b, br); log(`${lnm(a)}：バトル前に${lnm(b)}の装甲値を最大${br}減らした`); }
  }
  const dpCut = wSum(att, 'wfoeDp'), DPd = Math.max(Math.min(0, DP(def)), DP(def) - dpCut); // DPはマイナスになることがある（その分防御値が減る）
  const AV = att.lp + OP(att), DV = def.lp + DPd;
  let win = false, coinWin = false;
  if (forced === 'att') win = true;
  else if (forced === 'def') win = false;
  else if (AV >= DV && armorTotal(def) <= 0) win = true;
  else if (AV >= DV) { // 装甲がある相手：攻撃値からDPを引いた残りを装甲が先に受け、最後にLPが受ける。LPが0以下になれば破壊（攻撃側の勝ち）
    const dmg = Math.max(0, AV - DPd); log(`攻撃値${AV} ≥ 防御値${DV}：攻撃値からDP${DPd}を引いた${dmg}を、装甲→LPの順に${lnm(def)}が受ける`); damage(def, dmg);
    if (def.dead) { win = true; log(`攻撃値${AV}（防御値${DV}）：装甲を貫いて攻撃側の勝利`); coinWin = true; }
  } else { const dmg = Math.max(0, AV - DPd); log(`攻撃値${AV} < 防御値${DV}：${lnm(def)}に${dmg}ダメージ`); damage(def, dmg); }
  if (!win && abU(def, 'counter') && !def.dead && !att.dead && def.owner !== G.active) { const cv = def.lp + OP(def); log(`カウンター：${lnm(def)}がバトルに勝ち、攻撃値${cv}のダメージを${lnm(att)}に与える`); damage(att, cv); }
  if (win) { if (!coinWin) log(`攻撃値${AV}（防御値${DV}）：攻撃側の勝利`); killUnit(def); if (!isAv(def)) { const g = CARDS[def.cid].rank; G.players[att.owner].coins += g; log(`バトルに勝利：${G.players[att.owner].name}の貨幣ゲージ+${g}（${G.players[att.owner].coins}）`); } }
  { const w = win ? att : def; if (!w.dead && abU(w, 'swordsman') && wps(w).some(c => CARDS[c].name.includes('剣')) && (win || w === def)) { w.lpBonus = (w.lpBonus || 0) + 500; w.lp += 500; log(`剣士：${lnm(w)}が「${CARDS[w.weapon].name}」を装備してバトルに勝ち、LP+500`); } }
  UI.render();
  return win;
}
/* ゴーレム：魔法耐性・超魔法耐性以外でSpCとして使えるのは1まで */
const spcUsable = u => u.spc;
const canPayAmt = (u, n) => !u.hidden && CARDS[u.cid].spc > 0 && u.st.petrify == null && spcUsable(u) + Math.floor(scAvail(u) / 2) >= n;
const isLightSp = sp => !!sp && (CARDS[sp].attr || '').split('・').includes('光');
const holdsLight = u => !isAv(u) && (unitAttrs(u).includes('光') || wps(u).some(c => (CARDS[c].wattr || []).includes('光')));
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
  if (sc > 0) { u.noSpc = G.turn; log(`${lnm(u)}はSCを消費してスペルを使ったため、このターン終了時にSC・SpCを回復しない`); }
  return u;
}
async function payTech(p, cands, prompt, costOf = () => 1) {
  const r = await UI.pickBoard({ prompt, cells: cands.map(c => [c.x, c.y]), kind: 'pay', cancellable: true });
  if (!r) return null;
  const u = at(r[0][0], r[0][1]);
  spendSC(u, costOf(u));
  return u;
}
/* バトルの結果予測（黄金の体を使えるかの判定用）。攻撃側の勝ち＝防御側が破壊される、防御側の勝ち＝防御側が受けるダメージ（攻撃値−DP）が0 */
function battleForecast(att, def) {
  const dpCut = wSum(att, 'wfoeDp'), DPd = Math.max(Math.min(0, DP(def)), DP(def) - dpCut);
  const AV = att.lp + OP(att), dmg = Math.max(0, AV - DPd);
  let arm = armorTotal(def); const br = wSum(att, 'wbreak'); if (br && holdsWater(att) && arm > 0) arm = Math.max(0, arm - br); // 深淵の三又槍による装甲減少（バトル前）
  return { dmg, attWins: dmg >= def.lp + arm, defWins: dmg <= 0 };
}
async function goldenPrompt(side) {
  if (isAv(side) || side.dead) return false;
  { const cb = G.curBattle; if (cb && (cb.att === side || cb.def === side)) { const f = battleForecast(cb.att, cb.def); if (side === cb.att ? f.attWins : f.defWins) return false; } } // すでにバトルに勝てるキャラクターには使えない
  if (CARDS[side.cid].cat !== 'ヒューマノイド') return false; // ヒューマノイド以外（モンスター等）をもつキャラクターは対象にできない
  const p = G.players[side.owner];
  if (!p.hand.includes('goldenBody')) return false;
  if (!own(p.i).some(u => canPayAmt(u, spReduce(u, 3, 'goldenBody')) && !priestBlock(u, 'goldenBody'))) return false;
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
  const listed = G.curSpell ? spListed(G.curSpell) : 0; // 魔法耐性が参照するのは、実際に消費されたSpCではなく、カードに記載された消費SpC
  if (listed) cost = listed;
  const need = sup ? cost : cost + 1;
  const rs = t.uses.sr && t.uses.sr.turn === G.turn ? t.uses.sr.n : 0;
  if (sup && rs >= 2) return false;
  const mrN = resistMax(t), mu = t.uses.mr && t.uses.mr.turn === G.turn ? t.uses.mr.n : 0;
  if (!sup && mu >= Math.max(1, mrN)) return false;
  if (t.spc + (t.rspc || 0) < need || t.st.petrify != null) return false;
  UI.askCid = G.curSrc || G.curSpell || null; // 打ち消す前に、何のカードを使われているか詳細を見られるようにする
  const a = await UI.ask(`【${G.players[t.owner].name}に確認】${nm(t)}の${sup ? '超魔法耐性' : '魔法耐性'}：SpC${need}（耐性SpCを先に使用）を支払い、${opts.what || 'スペルの効果'}を打ち消しますか？${sup ? `（このターンあと${2 - rs}回）` : `（このターンあと${Math.max(1, mrN) - mu}回）`}`, ['打ち消す', '受ける'], t.owner);
  UI.askCid = null;
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
  if (abC(cid, 'moonCond') && p.spellsUsed < 4) { UI.toast(`このゲーム中にスペルを4回以上使用していないと盤に出せません（現在${p.spellsUsed}回）`); return false; }
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
async function spellCollect(u, p, need) { // スペルコレクト：サイコロがneed以上ならランク2、そうでなければランク1のスペルをデッキからランダムに1枚手札に加える
  const idx = r => p.deck.map((c, i) => i).filter(i => CARDS[p.deck[i]].kind === 'spell' && CARDS[p.deck[i]].rank === r);
  const d = rollD6(); UI.toast(`🎲 ${nm(u)}のサイコロ：${d}（d${need}以上でランク2）`);
  let pool = d >= need ? idx(2) : [];
  if (!pool.length) pool = idx(1);
  if (pool.length) { const i = pool[rnd(pool.length)]; const cc = p.deck.splice(i, 1)[0]; p.hand.push(cc); log(`${lnm(u)}：スペルコレクト（出目${d}）でデッキから「${CARDS[cc].name}」を手札に加えた`); }
  else log(`${lnm(u)}：スペルコレクト（出目${d}）：加えられるスペルがデッキになかった`);
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
    await spellCollect(u, p, 4);
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
  if (u.spc < 2 || u.st.petrify != null) { UI.toast('SpCが2以上必要です'); return; }
  if (UI.abilityCut) await UI.abilityCut(u); 
  u.spc -= 2; u.uses.moon = used + 1;
  for (const q of G.players) { q.deck.push(...q.hand); q.hand = []; q.deck = shuffle(q.deck); draw(q, 3); }
  log('月光：互いに手札を山札に戻し、3枚ずつ引いた'); UI.render();
}
/* 神官：ヒール／キュア・ディジーズ（それぞれ1ターンに1度、SpC1を消費） */
const priestCan = (u, k) => !u.dead && !u.hidden && !isAv(u) && abU(u, { heal: 'healA', cure: 'cureA', mail: 'mailA' }[k]) && u.uses[k] !== G.turn && u.spc >= 1 && u.st.petrify == null;
async function priestAct(u) {
  if (G.phase !== 'main' || u.owner !== G.active || u.dead) return;
  const ks = ['heal', 'cure', 'mail'].filter(k => priestCan(u, k));
  if (!ks.length) { UI.toast(abU(u, 'healA') ? 'ヒール・キュア・ディジーズ・ホーリーメールは1ターンに1度ずつ、SpCが1以上必要です' : ''); return; }
  const name = { heal: 'ヒール', cure: 'キュア・ディジーズ', mail: 'ホーリーメール' };
  const a = await UI.ask(`${nm(u)}：どの効果を使いますか？（SpC1を消費）`, [...ks.map(k => name[k]), 'キャンセル']);
  const k = ks.find(x => name[x] === a); if (!k) return;
  if (k === 'mail') { // ホーリーメール：SpC1を消費してサイコロを振り、6以上ならデッキから光属性のスペルをランダムに1枚手札に加える
    const p = G.players[u.owner]; if (UI.abilityCut) await UI.abilityCut(u); u.spc -= 1; u.uses.mail = G.turn;
    const d = rollD6(); UI.toast(`🎲 ホーリーメール：サイコロ ${d}`);
    if (d >= 6) {
      const ids = p.deck.map((c, i) => i).filter(i => CARDS[p.deck[i]].kind === 'spell' && cardAttrs(p.deck[i]).includes('光'));
      if (ids.length) { const i = ids[rnd(ids.length)], c = p.deck.splice(i, 1)[0]; p.hand.push(c); syncHB(); log(`ホーリーメール：${lnm(u)}がSpC1を消費（出目${d}）、デッキから「${CARDS[c].name}」を手札に加えた`); UI.toast(`ホーリーメール：${CARDS[c].name}を手札に加えた`); }
      else log(`ホーリーメール：${lnm(u)}がSpC1を消費（出目${d}）、デッキに光属性のスペルがなかった`);
    } else log(`ホーリーメール：${lnm(u)}がSpC1を消費（出目${d}）、失敗`);
    afterAction(); return;
  }
  const t = await pickUnit(chars(u.owner), `${name[k]}の対象（自分のキャラクター）を選択`); if (!t) return;
  if (k === 'cure' && !statusList(t).length) { UI.toast('対象に状態異常がありません'); return; }
  if (UI.abilityCut) await UI.abilityCut(u); u.spc -= 1; u.uses[k] = G.turn;
  if (k === 'heal') { const b = t.lp; heal(t, 2000); log(`ヒール：${lnm(u)}がSpC1を消費し、${lnm(t)}のLPを回復（${b}→${t.lp}）`); }
  else { const ss = statusList(t), s0 = ss[rnd(ss.length)]; cure(t, s0); log(`キュア・ディジーズ：${lnm(u)}がSpC1を消費し、${lnm(t)}の${STATUS_NAME[s0]}を治療`); }
  UI.toast(`${name[k]}：${nm(t)}`); afterAction();
}
/* エンジェルの効果：メインステップ中にSCを2つ消費し、デッキ外から指定のカードを手札に加える（ゲーム中1度だけ） */
/* メインステップ中にユニットをタップして起動する効果：いま使えるものがあれば {t:イベント名, q:確認文} を返す（使えなければnull）。
   確認はタップした側の画面だけで行い（localAsk）、「発動する」を選んだ時だけイベントを送る。キャンセルなら移動先の表示に進む */
/* ストームイーグル：メインステップ中にSC1を消費して、そのターン2回行動できる（ゲーム中3回まで） */
const twoActCan = u => abU(u, 'twoActions') && (u.uses.twoN || 0) < 3 && u.twoOn !== G.turn && !assaultOn(u) && u.acted < 2 && scAvail(u) >= 1;
async function twoActStart(u) {
  if (G.phase !== 'main' || u.owner !== G.active || u.dead || u.hidden || u.st.petrify != null || !twoActCan(u)) return;
  if (UI.abilityCut) await UI.abilityCut(u);
  spendSC(u, 1); u.uses.twoN = (u.uses.twoN || 0) + 1; u.twoOn = G.turn;
  log(`${lnm(u)}：SCを1つ消費し、このターン2回行動できる（${u.uses.twoN}/3回目）`); UI.toast('このターン2回行動できます'); afterAction();
}
function mainAbility(u) {
  if (!u || G.phase !== 'main' || u.owner !== G.active || u.dead || u.hidden || isAv(u) || u.st.petrify != null) return null;
  const p = G.players[u.owner];
  if (abU(u, 'throw') && (u.uses.throw || 0) < 2 && scAvail(u) >= 2) return { t: 'throw', q: `投擲：SCを2消費して手札に「投石」を出現させますか？（残り${2 - (u.uses.throw || 0)}回）` };
  if (twoActCan(u)) return { t: 'twoAct', q: `${nm(u)}：SCを1消費して、このターン2回行動しますか？（残り${3 - (u.uses.twoN || 0)}回）` };
  const f = CARDS[u.cid].fetch;
  if (abU(u, 'angelFetch') && f && !p.angelUsed[u.cid] && scAvail(u) >= 2) return { t: 'angelFetch', q: `${nm(u)}：SCを2つ消費して、デッキ外から「${CARDS[f.cid].name}」を${f.n}枚手札に加えますか？（ゲーム中1度だけ）` };
  if (['heal', 'cure', 'mail'].some(k => priestCan(u, k))) return { t: 'priest', q: `${nm(u)}：ヒール／キュア・ディジーズ／ホーリーメールを使いますか？（SpC1を消費）` };
  if (abU(u, 'burnAct') && (u.uses.burnN || 0) < 3 && u.spc >= 1 && !(u.burn != null && G.turn === u.burn)) return { t: 'burn', q: `${nm(u)}：SpCを1つ消費して、次の自分のターンのはじめまで「焼却」を得ますか？（残り${3 - (u.uses.burnN || 0)}回）` };
  if (abU(u, 'frenzyGet') && !u.uses.frenzyGet && u.spc >= 2) return { t: 'frenzyGet', q: `${nm(u)}：SpCを2つ消費して、奥義「発狂」を1枚手札に加えますか？（ゲーム中1度だけ）` };
  if (abU(u, 'moonReset') && (u.uses.moon || 0) < 2 && u.spc >= 2) return { t: 'moon', q: `月光：SpCを2消費して、互いに手札を山札に戻し、3枚ずつ引きますか？（残り${2 - (u.uses.moon || 0)}回）` };
  return null;
}
/* オーガ：メインステップ中にSpC2を消費して奥義「発狂」を1枚手札に加える（ゲーム中1度） */
async function frenzyGetAct(u) {
  if (G.phase !== 'main' || u.owner !== G.active || u.dead || u.hidden || !abU(u, 'frenzyGet')) return;
  if (u.uses.frenzyGet || u.spc < 2 || u.st.petrify != null) return; // 使えない時は何もしない（タップは選択・移動範囲の確認にも使うため）
  if (UI.abilityCut) await UI.abilityCut(u); 
  u.spc -= 2; u.uses.frenzyGet = 1; G.players[u.owner].hand.push('tkFrenzy');
  log(`${lnm(u)}：SpCを2つ消費し、奥義「発狂」を手札に加えた`); UI.toast('発狂を手札に加えた'); afterAction();
}
async function angelFetchAct(u) {
  const p = G.players[u.owner], f = CARDS[u.cid].fetch;
  if (G.phase !== 'main' || u.owner !== G.active || u.dead || u.hidden || !f) return;
  if (p.angelUsed[u.cid]) { UI.toast('この効果はゲーム中1度だけ使えます'); return; }
  if (scAvail(u) < 2 || u.st.petrify != null) { UI.toast('SCが2つ必要です'); return; }
  if (UI.abilityCut) await UI.abilityCut(u); 
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
  if (UI.abilityCut) await UI.abilityCut(u); 
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
  const mk = here.filter(v => v.ref.marked);
  if (mk.length) { // すでに警戒の印がついている非公開カード：持ち主の手札に戻せる
    const c = await UI.ask('警戒の印がついた非公開カードです。どうしますか？', ['持ち主の手札に戻す', '確認する', 'キャンセル']);
    if (c === 'キャンセル' || !c) return;
    if (c === '持ち主の手札に戻す') {
      if (UI.abilityCut) await UI.abilityCut(u); spendSC(u, 1); u.uses.scout = G.turn; const o = G.players[1 - u.owner];
      for (const h of mk) {
        if (h.unit) { const v = h.ref; for (const w of wps(v)) o.grave.push(w); dropAttach(v, o); if (!CARDS[v.cid].token) o.hand.push(v.cid); delete G.units[v.uid]; v.dead = true; }
        else { delete G.traps[h.x + ',' + h.y]; o.hand.push(h.cid); }
      }
      log(`警戒：${coord(t.x, t.y)}の印のついた非公開カードを持ち主（${o.name}）の手札に戻した`);
      if (typeof syncHB === 'function') syncHB(); checkAuras(); UI.render(); return;
    }
  }
  if (UI.abilityCut) await UI.abilityCut(u); spendSC(u, 1); u.uses.scout = G.turn; for (const h of here) h.ref.marked = true;
  log(`警戒：${coord(t.x, t.y)}の非公開カードを確認した`);
  if (UI.peek) UI.peek(u.owner, t.cid, coord(t.x, t.y));
  UI.render();
}
async function monkeyThrow(u) {
  if (G.phase !== 'main' || u.owner !== G.active) return;
  const used = u.uses.throw || 0;
  if (used >= 2) { UI.toast('投擲はゲーム中2回までです'); return; }
  if (scAvail(u) < 2 || u.st.petrify != null) { UI.toast('SCが2以上必要です'); return; }
  if (UI.abilityCut) await UI.abilityCut(u); 
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
const fairyTargets = p => mine(p).filter(u => CARDS[u.cid].txt.some(t => /スペル(ドロー|コレクト)/.test(t)) && !u.hidden && scAvail(u) >= 1 && u.spc >= 1 && u.st.petrify == null);
const ferTargets = p => mine(p).filter(u => CARDS[u.cid].cat.includes('モンスター') && CARDS[u.cid].race === 'ワイルド' && terr(u) === 'home' && scAvail(u) >= 1 && u.spc >= 1 && u.st.petrify == null);
const fsCost = u => (CARDS[u.cid].rank === 3 ? 3 : 1); // 闘争心：ランク3のキャラクターだけSC3
const fsPayable = u => canTechPay(u) && scAvail(u) >= fsCost(u);
const canTechPay = u => u.acted === 0 && scAvail(u) >= 1 && u.st.petrify == null && !u.hidden && !u.dead;
/* 装備できない理由（装備できるならnull） */
function whyNoEquip(u, cid) {
  const c = CARDS[cid], me = CARDS[u.cid];
  if (isAv(u)) return 'アバターは武器を装備できません';
  if (!(me.weapon || (me.armorOnly && isArmorW(cid)))) return me.armorOnly ? `${me.name}は「鎧」と名のつく武器しか装備できません` : `${me.name}は武器を装備できません`;
  if (u.weapon) {
    if (u.weapon2) return '武器を2つ装備済みです';
    if (wKind(cid) === wKind(u.weapon) && wKind(cid) !== 'o') return `すでに「${wKind(cid) === 's' ? '盾' : '鎧'}」と名のつく武器を装備しています`;
    if (wKind(cid) === 'o' && wKind(u.weapon) === 'o') return '「盾」「鎧」以外の武器は、他の武器と同時に装備できません';
    if ((isShieldW(cid) || isShieldW(u.weapon)) && u.lp < 4000) return '盾との同時装備にはLP4000以上が必要です';
  }
  if (isHeavyW(cid) && u.lp < 4000) return 'この武器はLP4000以上のキャラクターにしか装備できません';
  if (cid === 'wandFine' && me.spc < 1) return '上等な魔杖はSpCの基礎値が1以上のキャラクターにしか使えません';
  if (c.heroOnly && u.cid !== 'hero') return '「勇者」にしか装備できません';
  if (c.humanoidOnly && !String(me.cat).includes('ヒューマノイド')) return 'ヒューマノイドにしか装備できません';
  return null;
}
const canEquip = (u, cid) => whyNoEquip(u, cid) === null;
async function equipWeapon(p, cid) {
  const cs = own(p.i).filter(u => !isAngel(u) && canEquip(u, cid));
  const u = await pickUnit(cs, cid === 'wandFine' ? '上等な魔杖を装備するキャラクター（SpC基礎値1以上）を選択' : '武器を装備するキャラクターを選択');
  if (!u) return false;
  await UI.cutIn(cid);
  const r0 = baseRSpC(u);
  const sp0 = baseSpC(u);
  if (u.weapon) u.weapon2 = cid; else u.weapon = cid; if (CARDS[cid].wspc) u.spc += CARDS[cid].wspc;
  if (baseSpC(u) < sp0) u.spc = Math.min(u.spc, baseSpC(u)); // 盾・鎧：元のSpCが1まで下がる（現在のSpCも基礎値まで）
  { const w = CARDS[cid]; if (w.wlp) u.lp += w.wlp; if (w.warm) addArmor(u, 'armor', w.warm); u.rspc = (u.rspc || 0) + (baseRSpC(u) - r0); }
  log(`${lnm(u)}が${CARDS[cid].name}を装備`);
  return 'kept';
}
const cellsRow1 = p => { const o = []; for (let x = 0; x < 7; x++) { const c = cellOfRow(p.i, 1, x); if (!at(c.x, c.y) && !wallAt(c.x, c.y)) o.push([c.x, c.y]); } return o; };
const EQUIP_HUM = p => own(p.i).some(u => canEquip(u, 'braveSword')) ? null : 'ヒューマノイドで武器を装備できるキャラクターがいません';
const EQP = cid => p => { const us = own(p.i).filter(u => !isAv(u) && !isAngel(u)); if (us.some(u => canEquip(u, cid))) return null; if (!us.length) return '装備できるキャラクターがいません（盤上にキャラクターがいません）'; const rs = [...new Set(us.map(u => whyNoEquip(u, cid)))]; return '装備できるキャラクターがいません（' + rs.slice(0, 3).join('／') + '）'; };
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
    if (!(await resist(t, 2, p))) { if (armorTotal(t) > 0) { breakArmor(t, 1000); log(`スパーク：${lnm(t)}の装甲値を1000減らした`); } damage(t, 2000); log(`スパーク：${lnm(t)}に2000ダメージ`); if (!t.dead) addStatus(t, 'paralyze'); }
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
  magicGuard: { can: p => (!mine(p).length ? '対象にできる自分のキャラクターがいません' : own(p.i).some(u => guardPayer(u) && spcUsable(u) + Math.floor(scAvail(u) / 2) >= 2) ? null : '追加で払う分を含め、SpC（SC2でSpC1の代用）が合計2以上あるキャラクター／アバターが必要です'), async run(p) {
    const t = await pickUnit(mine(p), '魔法壁の対象（自分のキャラクター）を選択'); if (!t) return false;
    const cands = own(p.i).filter(u => guardPayer(u) && spcUsable(u) + Math.floor(scAvail(u) / 2) >= 2);
    const r = await UI.pickBoard({ who: p.i, prompt: '魔法壁：SpC／SCを消費するキャラクターを選択（基本SpC1＋追加1以上）', cells: cands.map(c => [c.x, c.y]), kind: 'pay', cancellable: true }); if (!r) return false;
    const u = at(r[0][0], r[0][1]);
    const maxN = Math.min(8, spcUsable(u) + Math.floor(scAvail(u) / 2) - 1); // 追加で払える回数（基本の1を除く）
    const labels = [];
    for (let n = 1; n <= maxN; n++) { const a = Math.min(spcUsable(u), n + 1), c = (n + 1 - a) * 2; labels.push(`装甲${1000 * n}（合計SpC${a}${c ? '＋SC' + c : ''}）`); }
    const ans = await UI.ask(`魔法壁：基本のSpC1に加え、追加でどれだけ消費しますか？（SpCが尽きたら2SCごとに1回分）`, [...labels, 'キャンセル'], p.i);
    const n = labels.indexOf(ans) + 1; if (n < 1) return false;
    const a = Math.min(spcUsable(u), n + 1), c = (n + 1 - a) * 2;
    u.spc -= a; spendSC(u, c);
    if (c > 0) { u.noSpc = G.turn; log(`${lnm(u)}はSCを消費してスペルを使ったため、このターン終了時にSC・SpCを回復しない`); }
    await UI.cutIn('magicGuard');
    addArmor(t, 'gArmor', 1000 * n); log(`魔法壁：${lnm(t)}に装甲${1000 * n}（SpC${a}${c ? '・SC' + c : ''}消費）`); return true; } },
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
  limitBreak: { can: p => (own(p.i).some(isAv) ? (own(p.i).some(u => canPayAmt(u, spReduce(u, 1, 'limitBreak')) && !priestBlock(u, 'limitBreak')) ? null : 'SpC1を支払えるキャラクターがいません') : 'アバターがいません'), async run(p) {
    const av = own(p.i).find(isAv); if (!av) return false;
    if (!(await payCost(p, 1))) return false; await UI.cutIn('limitBreak');
    av.mvUp = (av.mvUp || 0) + 2;
    log(`限界突破：アバターの最大移動回数が${avMax(av)}回になった（残り${avLeft(av)}回）`); return true; } },
  goldenBody: { can: () => '黄金の体はバトル時にのみ使用できます' },
  dangerSea: { can: p => (p.dangerSea ? '危険海流域の効果はすでに永続しています（重複しません）' : null), async run(p) {
    if (!(await payCost(p, 2))) return false; await UI.cutIn('dangerSea');
    p.dangerSea = true; syncHB(); log('危険海流域：効果が永続する（使用者のホーム／ボーダーの自分のキャラのLP+500、水属性に再生。相手キャラが使用者のホーム／ボーダーへ移動する際はサイコロ）'); return true; } },
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
  seaRoar: { can: p => (seaRoarTargets(p).length ? null : '対象にできる相手キャラクターがいません（相手のホームテリトリー／ボーダーゾーン内が対象）'), async run(p) {
    const t = await pickUnit(seaRoarTargets(p), '海竜の咆哮の対象を選択'); if (!t) return false;
    if (!(await payCost(p, 4))) return false;
    await UI.cutIn('seaRoar');
    const n = Math.max(0, p.hand.length - 1); // 現時点の手札（このカードを除く）の枚数から1引いた数
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
    for (const u of chars(p.i).filter(u => terr(u) === 'home')) addArmor(u, 'tArmor', 4000);
    log('サンダーストーム：ホームテリトリーの自分のキャラに装甲値4000（このターン限り）');
    const flying = (type, i) => allChars().some(u => abU(u, 'flight') && (type === 'col' ? u.x : u.y) === i);
    const pick = (type, excl) => { const c = [0, 1, 2, 3, 4, 5, 6].filter(i => !excl.includes(i)); const w = c.map(i => (flying(type, i) ? 2 : 1)); let r = RNG() * w.reduce((a, b) => a + b, 0); for (let k = 0; k < c.length; k++) { r -= w[k]; if (r < 0) return c[k]; } return c[c.length - 1]; };
    const rounds = ['col', 'row', 'col'];
    for (const type of rounds) {
      if (G.over != null) break;
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
      const payer = await payCost(p, mode === 'up' ? 2 + golemStep(target) : 2); if (!payer) return false;
      await UI.cutIn('createGolem');
      if (mode === 'up') {
        const n = golemStep(target) + 1;
        target.cid = 'golem' + n; target.lp += 2000; target.rspc = (target.rspc || 0) + 1;
        log(`クリエイトゴーレム：${coord(target.x, target.y)}のゴーレムがステップ${n}になった`); adaptFrom(target, payer); if (n >= 3) await spellCollect(target, p, 5); else await spellDraw(target, p, 3);
      } else {
        const u = mkUnit(p.i, 'golem1', pos[0], pos[1]); u.armor = 2000; adaptFrom(u, payer);
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
  redDragonBreath: { can: p => (own(p.i).some(u => !isAv(u) && !abC(u.cid, 'noEquipSp') && canPayAmt(u, spReduce(u, 3, 'redDragonBreath'))) ? null : 'SpC3を支払えるキャラクターがいません（アバターは対象にできません）'), async run(p) {
    const u = await payCost(p, 3, v => !isAv(v) && !abC(v.cid, 'noEquipSp')); if (!u) return false; await UI.cutIn('redDragonBreath');
    u.attach.push({ cid: 'redDragonBreath', since: p.count, until: p.count + 2 }); log(`レッドドラゴンブレス：${lnm(u)}に「焼却」を与えた`); checkAuras(); return 'kept'; } },
  windSlash: { can: p => (mine(p).some(u => !isAv(u) && !abC(u.cid, 'noEquipSp')) ? null : '装備できる自分のキャラクターがいません'), async run(p) {
    const cs = mine(p).filter(u => !isAv(u) && !abC(u.cid, 'noEquipSp'));
    const r = await UI.pickBoard({ prompt: 'ウインドスラッシュを装備する自分のユニットを選択', cells: cs.map(u => [u.x, u.y]), kind: 'target', cancellable: true }); if (!r) return false;
    const u = at(r[0][0], r[0][1]);
    if (!(await payCost(p, 1))) return false; await UI.cutIn('windSlash');
    u.attach.push({ cid: 'windSlash', since: p.count, until: p.count + 2 }); log(`${lnm(u)}にウインドスラッシュ`); return 'kept'; } },
  armorFine: { can: EQP('armorFine'), run: (p, c) => equipWeapon(p, c) },
  chaosArmor: { can: EQP('chaosArmor'), run: (p, c) => equipWeapon(p, c) },
  swordFine: { can: EQP('swordFine'), run: (p, c) => equipWeapon(p, c) },
  heroSword: { can: p => {
    if (own(p.i).some(u => canEquip(u, 'heroSword'))) return null; // 盤に勇者がいるなら通常の武器として装備できる
    if (own(p.i).some(u => u.cid === 'hero')) return '自分の盤に勇者がいるため配置できません（装備できる勇者もいません）';
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
    p.deck.forEach((c, i) => { if (isGobCard(c)) pool.push(['deck', i]); });
    p.grave.forEach((c, i) => { if (isGobCard(c)) pool.push(['grave', i]); });
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
    if (!(await payCost(p, 2))) return false; await UI.cutIn('petrifyRay');
    if (!(await resist(t, 2, p))) { addStatus(t, 'petrify'); log(`石化光線：${lnm(t)}が石化した`); }
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
    if (!(await payCost(p, 3))) return false; await UI.cutIn('holySmite');
    if (!(await resist(t, 3, p)) && !t.dead) { const d = rollD6(), up = d >= 6 ? 500 : 0; UI.toast(`🎲 ホーリースマイト：サイコロ ${d}${up ? '（ダメージ+500）' : ''}`); log(`ホーリースマイト：サイコロ ${d}、${lnm(t)}に${2000 + up}ダメージ`); damage(t, 2000 + up, { hit: true }); }
    return true; } },
  holyProt: { can: p => (chars(p.i).length ? null : '対象にできる自分のキャラクターがいません'), async run(p) {
    const t = await pickUnit(chars(p.i), 'ホーリープロテクションの対象（自分のキャラクター）を選択'); if (!t) return false;
    if (!(await payCost(p, 3))) return false; await UI.cutIn('holyProt');
    if (await resist(t, 3, p)) return true; if (t.dead) return true;
    const d = rollD6(), up = d >= 6 ? 500 : 0; UI.toast(`🎲 ホーリープロテクション：サイコロ ${d}${up ? '（装甲値+500）' : ''}`); addArmor(t, 'gArmor', 1500 + up); log(`ホーリープロテクション：サイコロ ${d}、${lnm(t)}に装甲値${1500 + up}`); return true; } },
  resurrection: {
    can: p => (rezCands(p).length ? (rezCells(p).length ? (own(p.i).some(u => canPayAmt(u, spReduce(u, 4, 'resurrection')) && !priestBlock(u, 'resurrection')) ? null : 'SpC4を支払えるキャラクターがいません') : '1列目に空いているマスがありません') : '前の相手のターン中に破壊され、墓地にいる自分のキャラクターがいません'),
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
  fairyDance: {
    can: p => (fairyTargets(p).length ? null : '自分の盤に、スペルドローまたはスペルコレクトをもち、SCとSpCが1以上のキャラクターが必要です'),
    async run(p) {
      const t = await pickUnit(fairyTargets(p), '妖精の舞：SC1とSpC1を消費するキャラクターを選択'); if (!t) return false;
      await UI.cutIn('fairyDance');
      spendSC(t, 1); t.spc -= 1;
      const pool = []; p.grave.forEach((c, i) => { if (CARDS[c].kind === 'spell' && CARDS[c].rank === 1 && cardAttrs(c).length) pool.push(i); });
      const n = Math.min(pool.length, 2), pick = shuffle(pool).slice(0, n);
      const got = pick.map(i => p.grave[i]); pick.sort((a, b) => b - a).forEach(i => p.grave.splice(i, 1)); got.forEach(c => p.hand.push(c));
      log(`妖精の舞：${lnm(t)}のSC1・SpC1を消費。墓地から${got.length ? got.map(c => `「${CARDS[c].name}」`).join('') : 'なし'}を手札に加えた`); return true; } },
  fightSpirit: { can: p => (mine(p).some(u => CARDS[u.cid].race === 'ワイルド' && u.spc >= 1) ? (mine(p).some(fsPayable) ? null : 'SCを消費できるキャラクターがいません（ランク3は3必要）') : '現在のSpCが1以上の種族ワイルドが必要です'), async run(p) {
    const u = await payTech(p, mine(p).filter(fsPayable), '闘争心をつけるキャラクターを選択（SCを1消費。ランク3は3消費）', fsCost); if (!u) return false;
    await UI.cutIn('fightSpirit'); u.attach.push({ cid: 'fightSpirit', since: p.count + 1 }); log(`${lnm(u)}に闘争心`); return 'kept'; } },
};
async function playHand(idx) {
  const p = cur();
  if (G.phase !== 'main' || G.over != null) return;
  const cid = p.hand[idx], c = CARDS[cid];
  if (c.kind === 'char') await summon(p, idx);
  else {
    const A = ACT[cid], why = A.can && A.can(p);
    if (why) { UI.toast(why); return; }
    p.hand.splice(idx, 1); syncHB();
    let r = false;
    G.curSpell = c.kind === 'spell' ? cid : null; G.curSrc = cid;
    try { r = await A.run(p, cid); } catch (e) { console.error(e); }
    G.curSpell = null; G.curSrc = null; UI.aimPend = null; // 発動しなかった（キャンセル等）対象表示は捨てる
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
function afterAction() { sanctForce(); checkAuras(); UI.render(); if (G.over != null) UI.gameOver(G.over); }

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
async function sanctZeroScan() { // SCとSpCがどちらも0になった聖域上のキャラクターに、非公開にするか確認（0でなくなればまた聞ける）
  for (const u of U()) {
    if (u.dead || isAv(u) || u.hidden) continue;
    if (u.sc > 0 || u.spc > 0) { u.zAsk = false; continue; }
    if (!u.zAsk) await sanctuaryCheck(u);
  }
}
async function sanctuaryCheck(u) {
  if (!u || u.dead || isAv(u) || u.hidden || abU(u, 'flight')) return;
  const k = sKey(u.x, u.y);
  if (u.noSanct && u.noSanct !== k) delete u.noSanct;
  const s = G.sanctuaries[k];
  const zero = u.sc <= 0 && u.spc <= 0;
  if (!s || s.owner !== u.owner || u.noSanct === k || baseLP(u) > 4000) return;
  const a = await UI.ask(`【${G.players[u.owner].name}に確認】魔法聖域：${nm(u)}を非公開にしますか？（SCとSpCのターン終了時の回復量+1）`, ['非公開にする', 'しない'], u.owner);
  if (a !== '非公開にする') { if (zero) u.zAsk = true; return; }
  if (!u.hidden) u.marked = true; // 隠れる前の姿は相手に見えているので「警戒」と同じ印をつける
  u.hidden = true; u.sanct = true; u.hiddenSince = G.players[u.owner].count;
  log(`魔法聖域：${lnm(u)}が非公開になった（${coord(u.x, u.y)}）`);
}

/* ===== 貨幣ゲージ・アイテムショップ ===== */
const soldPrice = cid => (sellOf(cid) === 0 ? 1 : sellOf(cid) * 2); // 売値0のカードは、売っても貨幣ゲージは増えず、ショップの買値は1になる
const sellOf = cid => (CARDS[cid].kind === 'item' && CARDS[cid].sell != null && !CARDS[cid].noSell ? CARDS[cid].sell : null);
const noShop = () => !!(G && G.opt && G.opt.noShop); // 入門対戦の「ショップなし」ステージ用（AIにも適用）。通常対戦では G.opt が無く常に false
/* 入門で教えている定石（道標先使い・砂壁のタイミング・アイテムは売らない）をAIにも守らせる */
const coachAI = () => true; // 入門対戦だけでなく、通常のAI対戦でも守らせる（AIが手を選ぶ時だけ使われるので、人間同士のオンライン対戦には影響しない）
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
  const p = cur(); if (G.phase !== 'main' || G.over != null) return;
  if (noShop()) { UI.toast('このステージではショップは使えません'); return; }
  const cid = p.hand[i]; if (!cid || sellOf(cid) == null) return;
  if (p.sellUsed) { UI.toast('カードを売れるのは1ターンに1回までです'); return; }
  sfx('coin'); p.sellUsed = true; p.hand.splice(i, 1); p.hand.push('shopTicket'); syncHB(); p.coins += sellOf(cid);
  G.shopUsed.push({ cid, price: soldPrice(cid), age: 0, from: p.i, used: true, sold: false });
  log(`${p.name}：${CARDS[cid].name}を売って貨幣ゲージ+${sellOf(cid)}（${p.coins}）。ショップに買値${soldPrice(cid)}で並んだ。ショップチケットを1枚入手`); afterAction();
}
function buyShop(k) {
  const p = cur(); if (G.phase !== 'main' || G.over != null) return;
  if (noShop()) { UI.toast('このステージではショップは使えません'); return; }
  sfx('coin');
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
  if (G.over != null) return false;
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
    if (u.noSpc !== G.turn) u.sc = Math.max(u.sc, Math.min(baseSC(u), u.sc + Math.max(0, (home ? 2 : 1) + (u.sanct ? 1 : 0) + (abU(u, 'superRegen') ? 1 : 0) - (armorDual(u) ? 1 : 0)))); // 超再生：ターン終了時のSC回復量+1
    { const pts = u.noSpc === G.turn ? 0 : (home ? 1 : 0) + (u.sanct ? 1 : 0), gap = Math.max(0, baseSpC(u) - u.spc), use = Math.min(gap, pts);
      u.spc = Math.max(u.spc, Math.min(baseSpC(u), u.spc + use));
      // 通常のSpCが優先して回復し、通常のSpCが最大になっている場合のみ、余った分が魔法耐性用SpCの回復に回る
      if (baseRSpC(u) > 0) u.rspc = Math.max(u.rspc || 0, Math.min(baseRSpC(u), (u.rspc || 0) + (pts - use))); }
  }
  if (!(p.i === 0 && p.count === 1)) { p.coins++; log(`${p.name}：ターン終了で貨幣ゲージ+1（${p.coins}）`); }
  await startTurn(1 - p.i);
  return true;
}

/* ===== AI対戦：思考ルーチン =====
   盤面の判断だけを行う（DOM・通信には触れない）。ゲームのルール・カード効果・ターン進行は変更しない。
   考え方：
   1. 候補手（カードの使用・能力・購入・売却・移動／攻撃）を列挙する。
   2. 各候補を「盤面のコピー」の上で実際のエンジンで実行し（カード効果・戦闘・トラップなどが全て本物の処理になる）、
      結果の盤面を評価関数で採点する。複数手先（カードの組み合わせ、削り→とどめ、など）はビーム探索で読む。
   3. 評価関数は、戦力（LP・攻撃値・DP・装甲・能力・SC/SpC）、前進度、アバターの危険度（相手が次のターンに
      アバターや味方を倒せるか）、こちらの攻撃機会、手札・貨幣ゲージ、設置物などを合計した「バランス型」。
   読みに使うコピーでは、相手の手札・非公開の罠・山札の順番は見ない（人間と同じ条件にするため）。 */
const AI = {
  sides: new Set(), failed: new Set(), dec: null,
  cfg: { budget: 1200, depthMain: 3, depthAct: 4, width: [12, 6, 4, 3], variants: [7, 5], eps: 0.04 }, // budget＝1回の判断に使う最大時間（ミリ秒）
  is: who => AI.sides.has(who),
  key: ev => ev.t + ':' + (ev.cid || ev.k || ev.uid || '') + ':' + (ev.x == null ? '' : ev.x + ',' + ev.y) + (ev.i == null ? '' : '#' + ev.i),
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  over: () => !!G && (G.over === 0 || G.over === 1), // ※ G.over は勝者の席番号（先行が勝つと 0）なので、0 も「終了」として扱う

  /* ---------- 選択（UI.pickBoard / UI.ask / UI.pickCards の代わり） ---------- */
  /* 読みの最中は「何番目の選択肢を選ぶか」を探索側が指定する。実行時は、読みで選んだ手順をそのまま再現する */
  decide(who, n) {
    const d = AI.dec;
    if (!d || d.me !== who || n <= 1) return 0;
    const k = d.i++;
    if (d.mode === 'sim') { d.rec.push(n); const w = d.choices[k]; return w != null && w < n ? w : 0; }
    return d.counts && d.counts[k] === n && d.choices[k] != null && d.choices[k] < n ? d.choices[k] : 0;
  },
  pick(o) {
    const a = o.who == null ? G.active : o.who, cells = o.cells || [];
    if (!cells.length) return null;
    const us = cells.map(c => ({ c, u: at(c[0], c[1]) }));
    if (o.multi) {
      if (!o.validate) return o.cancellable ? null : cells.slice(0, 2);
      const sel = [];
      for (const e of us.slice().sort((x, y) => (x.u ? aiUnitVal(x.u) : 0) - (y.u ? aiUnitVal(y.u) : 0))) { sel.push(e.c); if (o.validate(sel)) return sel; }
      return o.cancellable ? null : sel;
    }
    const ranked = aiRankCells(o, a, us);
    if (!ranked.length) return o.cancellable ? null : [cells[0]];
    const r = ranked[AI.decide(a, ranked.length)];
    return r ? [r] : null; // null＝キャンセル（ハンティングしない 等）
  },
  /* 選択肢への回答（UI.ask の代わり）。SC消費の警告は断る。魔法耐性は使う。それ以外は先頭（使う／はい）を基本に、探索で別案も試す */
  ask(msg, btns, who) {
    const a = who == null ? (G ? G.active : 0) : who;
    if (/^⚠/.test(msg)) return btns.find(b => /いいえ|やめる|キャンセル/.test(b)) || btns[btns.length - 1];
    if (/打ち消しますか/.test(msg)) return btns[0];
    let order = btns.slice();
    if (msg === HID_Q) order = [HID_A[1], HID_A[0]]; // 非公開は探索で別案として試す
    return order[AI.decide(a, order.length)];
  },
  cards(title, prompt, cids, min, who, max) { const n = Math.min(max || min || 1, cids.length); return Array.from({ length: n }, (_, i) => i); },
  sig() { return JSON.stringify([G.phase, G.active, G.players.map(q => [q.hand.length, q.coins, q.deck.length, q.grave.length, q.freeBuy, q.sellUsed ? 1 : 0]), U().map(u => [u.uid, u.x, u.y, u.lp, u.sc, u.spc, u.rspc, u.acted, u.dead ? 1 : 0, u.hidden ? 1 : 0, u.weapon, u.armor, armorTotal(u)])]); },

  /* ---------- 思考の入口 ---------- */
  async choose() {
    const me = G.active, F = AI.failed, t0 = AI.now(), deadline = t0 + AI.cfg.budget;
    const stop = G.phase === 'main' ? { t: 'toAction' } : { t: 'end' };
    const res = await aiSearch(me, deadline, F);
    if (!res) return { ev: stop };
    return res;
  },
  /* 自分（AI）の手番を終わりまで進める。exec(ev) はイベントを実行して完了を待つ関数 */
  async runTurn(exec, maxSteps = 80) {
    AI.failed.clear();
    for (let n = 0; n < maxSteps; n++) {
      if (!G || AI.over() || !AI.is(G.active)) return;
      const me = G.active; let d;
      try { d = await AI.choose(); } catch (e) { console.error('AI思考エラー', e); d = { ev: G.phase === 'main' ? { t: 'toAction' } : { t: 'end' } }; }
      const ev = d.ev, s0 = AI.sig();
      AI.dec = d.choices ? { mode: 'real', me, choices: d.choices, counts: d.counts, i: 0, rec: [] } : null;
      try { await exec(ev); } finally { AI.dec = null; }
      if (!G || AI.over() || G.active !== me) return;
      if (AI.sig() === s0) { if (ev.t === 'end') return; AI.failed.add(AI.key(ev)); }
    }
  },
};

/* ===== 評価 ===== */
const AIW_AB = { flight: 0.7, magicResist: 0.5, superResist: 0.9, regen: 0.5, superRegen: 0.9, haste: 0.6, twoActions: 0.5, assassin: 0.5, assassinate: 0.6, ambush: 0.4, counter: 0.5, petrify: 0.7, poisonTouch: 0.4, swordsman: 0.4, heroDiag: 0.3, omni: 0.3, knightCmd: 0.6, backBattle: 0.3, stealth: 0.3, berserk: -0.2, archer: 0.4, scout: 0.3, priest: 0.3, healA: 0.3, sacrifice: -0.2, wizDice: 0.3, witchEtb: 0.4, witchChill: 0.4, elemWater: 0.3, seaHand: 0.3, kingEtb: 0.3, burnAct: 0.5, moonReset: 0.4, crabGuard: 0.4, throw: 0.4, aquatic: 0.1 };
const aiHandVal = cid => { const c = CARDS[cid]; if (!c) return 0.3; if (cid === 'shopTicket') return 0; if (c.kind === 'char') return 1 + (c.rank || 1) * 0.35; if (c.kind === 'item') return 0.9 + (c.sell || 0) * 0.08; if (c.kind === 'tech') return 0.6; return 0.8 + ((c.rank || 1) - 1) * 0.3; };
const aiLp = u => Math.max(u.lp, baseLP(u)); // ターン終了時に回復するので、回復後のLPで強さを見る
function aiUnitVal(u) {
  const c = CARDS[u.cid]; if (isAv(u)) return 0;
  let v = 1.2 + (c.rank || 1) * 0.5 + aiLp(u) / 1000 * 0.8 + Math.max(0, OP(u)) / 1000 * 1.5 + DP(u) / 1000 * 0.7 + armorTotal(u) / 1000 * 0.7;
  for (const a of c.ab) v += AIW_AB[a] != null ? AIW_AB[a] : 0.1;
  v += 0.12 * Math.min(u.sc + 2, baseSC(u)) + 0.2 * u.spc + 0.1 * (u.rspc || 0) + wps(u).length * 0.4;
  for (const k in u.st) v -= u.st[k] != null && k === 'petrify' ? 2 : 0.5;
  if (u.hidden) v += 0.3;
  return Math.max(0.3, v);
}
const aiDist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
/* 片方のプレイヤーの「盤面・手札・資源」の得点 */
function aiSideScore(s) {
  const p = G.players[s], foeAv = own(1 - s).find(isAv); let v = 0;
  for (const u of own(s)) {
    if (u.dead || isAv(u)) continue;
    const aggr = Math.min(1.3, (aiLp(u) + OP(u)) / 4000);
    v += aiUnitVal(u) + 0.2 * (rowOf(s, u.y) - 1) * aggr;
    if (foeAv && !u.hidden && aiLp(u) + OP(u) >= 2000) { const d = aiDist(u, foeAv) - 1; if (d < 5) v += (5 - Math.max(1, d)) * 0.35 * aggr; } // 相手アバターへの接近（圧力）
  }
  const av = own(s).find(isAv); if (av) v -= 0.8 * (rowOf(s, av.y) - 1) + 0.25 * (av.mvDone || 0) + 0.3 * Math.abs(av.x - 3); // アバターは奥にいる方が安全（動き回らない）
  for (const k in G.walls) if (G.walls[k].owner === s) v += 0.5;
  for (const k in G.traps) if (G.traps[k].owner === s) v += 1.2;
  for (const k in G.sanctuaries) if (G.sanctuaries[k].owner === s) v += 0.4;
  /* 手札：多すぎる手札は（出せる数に限りがあるので）価値が逓減する */
  const hv = p.hand.filter(c => c !== 'shopTicket').map(aiHandVal).sort((a, b) => b - a);
  hv.forEach((x, i) => { v += x * 0.55 * (i < 5 ? 1 : 0.5); });
  /* 貨幣・購入権利：貨幣は使い道（購入）が限られるので、たまりすぎると価値が下がる。購入権利は「買いたい物が買える」時だけ価値がある */
  const lapF = G.lap ? 0.5 : 1, rights = p.hand.filter(c => c === 'shopTicket').length + (p.freeBuy > 0 ? 1 : 0);
  v += (0.3 * Math.min(p.coins, 8) + 0.05 * Math.max(0, p.coins - 8)) * lapF;
  const buyable = p.coins >= 4 ? 1 : 0.35;
  v += ((rights >= 1 ? 0.35 : 0) + (rights >= 2 ? 0.12 : 0) + (rights >= 3 ? 0.03 : 0)) * buyable * lapF;
  /* 売却品が相手の手に渡る損失：自分が売って、まだショップに残っているカード（相手が安く買える） */
  const opp = G.players[1 - s], oppCan = opp.freeBuy > 0 || opp.hand.includes('shopTicket');
  for (const it of G.shopUsed || []) if (it.from === s && !it.sold && oppCan && opp.coins >= it.price) v -= 0.3 * aiHandVal(it.cid);
  return v;
}

/* 相手が次のターンに（2回行動・ハンティングも含めて）攻撃できる先。盤面は一時的に書き換えて必ず戻す */
function aiAttacks(e, fresh) {
  const out = [], sv = { acted: e.acted, x: e.x, y: e.y, sc: e.sc, two: e.twoOn };
  const add = (tgt, back, via) => { if (tgt && !tgt.dead && tgt.owner !== e.owner) out.push({ u: tgt, AV: e.lp + OP(e) + (back && abU(e, 'ambush') ? 1000 : 0), e, via }); };
  try {
    if (fresh) e.acted = 0;
    if (fresh && abU(e, 'twoActions') && (e.uses.twoN || 0) < 3 && scAvail(e) >= 1 && !assaultOn(e)) e.twoOn = G.turn; // 2回行動（SC1）
    const first = movesFor(e);
    for (const mv of first) {
      if (mv.type === 'attack') add(at(mv.x, mv.y), mv.back);
      else if (actLimit(e) >= 2 || hasHunting(e)) {
        e.x = mv.x; e.y = mv.y; e.acted = sv.acted + 1; e.sc = sv.sc - mv.cost;
        if (actLimit(e) >= 2) for (const m2 of movesFor(e)) if (m2.type === 'attack') add(at(m2.x, m2.y), m2.back, 2);
        if (hasHunting(e) && e.uses.hunt !== G.turn) for (const h of huntTargets(e)) add(at(h.x, h.y), h.back, 'h');
        e.x = sv.x; e.y = sv.y; e.acted = sv.acted; e.sc = sv.sc;
      }
    }
    if (hasHunting(e) && e.uses.hunt !== G.turn) for (const h of huntTargets(e)) add(at(h.x, h.y), h.back, 'h');
  } finally { e.acted = sv.acted; e.x = sv.x; e.y = sv.y; e.sc = sv.sc; e.twoOn = sv.two; }
  return out;
}
/* 攻撃値の列（弱い順に使う）で、そのキャラクターが破壊されるか。バトルの規則に合わせる：AV≥DVで勝ち（装甲があれば装甲→LPの順に受ける）、負けても AV−DP のダメージを受ける */
function aiResolve(def, avs, cur) { // cur：現在のLPのまま（回復前）で判定する
  let lp = cur ? def.lp : aiLp(def), arm = armorTotal(def); const dp = DP(def);
  for (const AV of avs.slice().sort((a, b) => a - b)) {
    const DPd = dp, DV = lp + DPd;
    if (AV >= DV && arm <= 0) return true;
    const dmg = Math.max(0, AV - DPd), a = Math.min(arm, dmg); arm -= a; lp -= dmg - a;
    if (lp <= 0) return true;
  }
  return false;
}
/* 温存の判断：相手のキャラクターにダメージを与えるだけで倒しきれないカード・能力は使わない。
   「倒しきれる」＝同じターンに、他のカード・能力のダメージや、味方のバトル（削り→とどめ）で破壊できる見込みがある場合 */
const aiHp = u => u.lp + armorTotal(u);
function aiChipInfo(st, rootHp) { // 相手の盤面が、元より減った（chip）／消えた（kill）か
  return aiWith(st, () => { let chip = false, kill = false; for (const k in rootHp) { const u = G.units[k]; if (!u || u.dead) kill = true; else if (aiHp(u) < rootHp[k]) chip = true; } return { chip, kill }; });
}
function aiKillableNow(st, me, rootHp) { // ダメージを受けた相手を、今ある味方の攻撃で倒せるか（現在のLP・装甲のまま判定）
  return aiWith(st, () => {
    const by = {};
    for (const u of own(me)) { if (u.dead || u.hidden || u.st.petrify != null) continue; for (const a of aiAttacks(u, false)) (by[a.u.uid] = by[a.u.uid] || []).push(a.AV); }
    for (const k in by) { const tg = G.units[k]; if (tg && !tg.dead && tg.owner !== me && !isAv(tg) && rootHp[k] != null && aiHp(tg) < rootHp[k] && aiResolve(tg, by[k], true)) return true; }
    return false;
  });
}
/* 相手の次のターンの脅威（味方の損失・アバターの危険）を、点数（マイナス）にする */
/* 山札が尽きている側は、次のドロー（ターン開始）で二周目に入る → 全キャラクターが「狂乱」（2マス移動）を得る */
const aiLapNext = s => { const q = G.players[s]; return !G.lap && !q.deck.length && !q.reshuffled && q.grave.length > 0; };
function aiDanger(me) {
  const opp = 1 - me, sv = { active: G.active, turn: G.turn, lap: G.lap }, by = {}; let d = 0;
  try {
    G.active = opp; G.turn = sv.turn + 1;
    if (aiLapNext(opp)) G.lap = 'x'; // 相手の次のドローで二周目に入る（先読み）
    for (const e of own(opp)) { if (e.dead || e.hidden || e.st.petrify != null) continue; for (const a of aiAttacks(e, true)) (by[a.u.uid] = by[a.u.uid] || []).push(a.AV); }
    /* アバターへの「2〜3ターン先」の脅威：次に動いて隣接→その次に攻撃、という接近を早めに止める */
    const av = own(me).find(isAv);
    if (av && !by[av.uid]) {
      const mine = own(me).filter(u => !u.dead && !u.hidden && !isAv(u) && u.st.petrify == null);
      for (const e of own(opp)) {
        if (e.dead || e.hidden || isAv(e) || e.st.petrify != null) continue;
        if (!aiResolve(av, [e.lp + OP(e)])) continue; // アバターを倒せる強さがない
        const r = (abU(e, 'berserk') || (abU(e, 'twoActions') && scAvail(e) >= 1)) ? 2 : 1, dd = aiDist(e, av), k = Math.ceil(dd / r);
        if (k < 2 || k > 3) continue;
        const avs = []; for (const u of mine) { const ru = abU(u, 'berserk') ? 2 : 1; if (aiDist(u, e) <= ru + 1) avs.push(u.lp + OP(u)); }
        const covered = avs.length && aiResolve(e, avs);
        d -= k === 2 ? (covered ? 4 : 25) : (covered ? 1 : 6);
      }
      /* アバターの隣のマスが空いていると、そこへ敵が入り込める。自分のキャラクターや砂壁で埋めておくと時間を稼げる */
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = av.x + dx, ny = av.y + dy; if (nx < 0 || ny < 0 || nx > 6 || ny > 6 || at(nx, ny) || G.walls[sKey(nx, ny)]) continue;
        let n = 0; for (const e of own(opp)) if (!e.dead && !isAv(e) && e.st.petrify == null && e.lp + OP(e) >= 2000 && Math.abs(e.x - nx) + Math.abs(e.y - ny) <= 3) n++;
        d -= 0.35 * Math.min(2, n);
      }
    }
  } finally { G.active = sv.active; G.turn = sv.turn; G.lap = sv.lap; }
  for (const m of own(me)) {
    const l = by[m.uid]; if (!l) continue;
    const kill = aiResolve(m, l);
    if (isAv(m)) d -= kill ? 500 : 3;
    else if (kill) d -= aiUnitVal(m) * 0.75;
    else d -= 0.15 * l.length;
  }
  return d;
}
/* こちらがこのターンにまだ使える攻撃の機会（倒せる相手がいるか）。実際に倒せば得点が確定するので、見込みは割り引く */
function aiTactics(me) {
  if (G.active !== me) return 0;
  const by = {}; let t = 0;
  for (const u of own(me)) { if (u.dead || u.hidden || u.st.petrify != null) continue; for (const a of aiAttacks(u, false)) (by[a.u.uid] = by[a.u.uid] || []).push(a.AV); }
  for (const k in by) { const tg = G.units[k]; if (!tg || tg.dead || tg.owner === me) continue; if (aiResolve(tg, by[k])) t += isAv(tg) ? 300 : aiUnitVal(tg) * 0.5; }
  return t;
}
/* 次の自分のターンに攻撃できる見込み（今ターンもう行動し終えたキャラクターの、動いた後の位置から）。敵アバターに届く配置・自分の二周目突入の直前の配置を評価する */
function aiPotential(me) {
  const foeAv = own(1 - me).find(isAv); if (!foeAv) return 0;
  const sv = { active: G.active, turn: G.turn, lap: G.lap }, by = {}; let t = 0;
  try {
    G.active = me; G.turn = sv.turn + (sv.active === me ? 2 : 1);
    if (aiLapNext(me)) G.lap = 'x'; // 自分の次のドローで二周目：狂乱で2マス動ける
    for (const u of own(me)) {
      if (u.dead || u.hidden || u.st.petrify != null || isAv(u)) continue;
      if (sv.active === me && !(u.acted > 0)) continue; // まだ動いていないキャラは、今ターンの攻撃機会（aiTactics）として数える
      if (aiDist(u, foeAv) > 4) continue;
      for (const a of aiAttacks(u, true)) (by[a.u.uid] = by[a.u.uid] || []).push(a.AV);
    }
  } finally { G.active = sv.active; G.turn = sv.turn; G.lap = sv.lap; }
  for (const k in by) { const tg = G.units[k]; if (!tg || tg.dead || tg.owner === me) continue; if (aiResolve(tg, by[k])) t += isAv(tg) ? 40 : aiUnitVal(tg) * 0.2; }
  return t;
}
function aiEval(me) {
  if (G.over === 0 || G.over === 1) return G.over === me ? 1e6 : -1e6;
  return aiSideScore(me) - 1.12 * aiSideScore(1 - me) + aiDanger(me) + aiTactics(me) + aiPotential(me);
}

/* ===== 選択肢の並べ替え（先頭が既定の選択） ===== */
function aiRankCells(o, who, us) {
  const foe = us.filter(e => e.u && e.u.owner !== who), mine = us.filter(e => e.u && e.u.owner === who), empty = us.filter(e => !e.u);
  const byVal = (l, dir) => l.slice().sort((x, y) => dir * (aiUnitVal(y.u) - aiUnitVal(x.u)));
  let r;
  if (o.kind === 'pay') {
    const need = +((/SpC(\d+)/.exec(o.prompt || '') || [])[1]) || 1;
    r = us.slice().sort((x, y) => { const sx = x.u ? (x.u.spc >= need ? 0 : 10) + (isAv(x.u) ? -2 : 0) + aiUnitVal(x.u) * 0.2 - x.u.spc * 0.3 : 99, sy = y.u ? (y.u.spc >= need ? 0 : 10) + (isAv(y.u) ? -2 : 0) + aiUnitVal(y.u) * 0.2 - y.u.spc * 0.3 : 99; return sx - sy; });
  } else if (o.kind === 'place') {
    r = us.slice().sort((x, y) => (Math.abs(x.c[0] - 3) + Math.abs(rowOf(who, x.c[1]) - 1) * 0.6) - (Math.abs(y.c[0] - 3) + Math.abs(rowOf(who, y.c[1]) - 1) * 0.6));
  } else if (o.kind === 'attack') {
    r = us.slice().sort((x, y) => (y.u ? aiUnitVal(y.u) : 0) - (x.u ? aiUnitVal(x.u) : 0));
  } else {
    const harm = ['petrifyRay', 'spark', 'fireball', 'freezeWind', 'holySmite', 'seaRoar', 'blizzard', 'redDragonBreath', 'stoneThrow', 'chaosHand', 'windSlash'].includes(G.curSrc) || /ダメージ|相手/.test(o.prompt || '') && !/自分/.test(o.prompt || '');
    const fl = byVal(foe, 1), ml = byVal(mine, 1), first = harm ? fl : ml, second = harm ? ml : fl;
    r = []; for (let i = 0; i < Math.max(first.length, second.length); i++) { if (first[i]) r.push(first[i]); if (second[i] && i < 2) r.push(second[i]); }
    r = r.concat(second.slice(2), empty);
  }
  const out = r.map(e => e.c);
  if (o.cancellable && o.kind === 'attack') out.push(null);
  return out;
}

/* ===== 盤面のコピーと、コピーの上での実行（本物のエンジンをそのまま使う） ===== */
function aiClone(g, me) {
  const c = JSON.parse(JSON.stringify(g, (k, v) => (k === 'log' ? [] : v)));
  for (const p of c.players) p.deck = shuffle(p.deck);
  const op = c.players[1 - me]; op.hand = op.hand.map(() => 'shopTicket'); // 相手の手札は見ない（枚数だけ）
  for (const k of Object.keys(c.traps || {})) if (c.traps[k].owner !== me && c.traps[k].hidden) delete c.traps[k]; // 相手の非公開の罠は見えない
  return c;
}
async function aiRun(state, me, ev, choices, fn) {
  const sv = { G, RNG, UIDC, ui: {} };
  const dec = { mode: 'sim', me, choices: choices || [], i: 0, rec: [] };
  let sd = 1234567 + ((state.turn || 0) * 977);
  RNG = () => { sd = (sd + 0x6D2B79F5) | 0; let t = Math.imul(sd ^ (sd >>> 15), 1 | sd); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (const k of Object.keys(UI)) if (typeof UI[k] === 'function') { sv.ui[k] = UI[k]; UI[k] = async () => { }; }
  const savedDec = AI.dec; AI.dec = dec;
  UI.ask = async (msg, btns, who) => { who = who == null ? G.active : who; return who === me ? AI.ask(msg, btns, who) : (/打ち消しますか/.test(msg) ? btns[0] : btns[0]); };
  UI.confirm = async (msg, who) => (await UI.ask(msg, ['はい', 'いいえ'], who)) === 'はい';
  UI.pickBoard = async o => { const who = o.who == null ? G.active : o.who; return AI.pick(o.who == null ? Object.assign({}, o, { who }) : o); };
  UI.pickCard = async (t, p, cids) => cids[0];
  UI.pickCards = async (...a) => AI.cards(...a);
  G = state;
  try { return await fn(dec); }
  finally { G = sv.G; RNG = sv.RNG; UIDC = sv.UIDC; for (const k in sv.ui) UI[k] = sv.ui[k]; AI.dec = savedDec; }
}
async function aiExec(ev) {
  const u = ev.uid != null ? G.units[ev.uid] : null;
  switch (ev.t) {
    case 'play': await playHand(ev.i); break;
    case 'sell': sellCard(ev.i); break;
    case 'buy': buyShop(ev.k); break;
    case 'move': { const mv = u && movesFor(u).find(m => m.x === ev.x && m.y === ev.y); if (mv) await doMove(u, mv); break; }
    case 'throw': if (u) await monkeyThrow(u); break;
    case 'angelFetch': if (u) await angelFetchAct(u); break;
    case 'frenzyGet': if (u) await frenzyGetAct(u); break;
    case 'priest': if (u) await priestAct(u); break;
    case 'twoAct': if (u) await twoActStart(u); break;
    case 'moon': if (u) await moonReset(u); break;
    case 'reveal': if (u) await revealUnit(u); break;
    case 'burn': if (u) await burnStart(u); break;
    case 'flame': if (u) await flameStart(u); break;
    case 'archer': if (u) await archerShot(u); break;
    case 'scout': if (u) await scoutWatch(u); break;
    case 'toAction': if (G.phase === 'main') G.phase = 'action'; break;
  }
  if (typeof flushBreeze === 'function') await flushBreeze();
  if (!AI.over()) await sanctZeroScan();
}
/* state の上で ev を実行し、{state, counts, changed} を返す（state 自体は壊さず、コピーに対して実行する） */
async function aiSim(state, me, ev, choices) {
  const copy = JSON.parse(JSON.stringify(state)), sig0 = aiSigOf(copy);
  return aiRun(copy, me, ev, choices, async dec => {
    try { await aiExec(ev); } catch (e) { return { state: copy, counts: dec.rec, changed: false, err: e }; }
    return { state: copy, counts: dec.rec, changed: aiSigOf(G) !== sig0 };
  });
}
function aiSigOf(g) { const sv = G; G = g; try { return AI.sig(); } finally { G = sv; } }
function aiWith(state, fn) { const sv = G; G = state; try { return fn(); } finally { G = sv; } }
/* 評価（盤面を差し替えて計算する） */
const aiScore = (state, me) => aiWith(state, () => aiEval(me));

/* ===== 候補手の列挙 ===== */
function aiGen(state, me, F, deep) {
  return aiWith(state, () => {
    const p = G.players[me], out = [], okEv = ev => !F.has(AI.key(ev));
    if (G.phase === 'main') {
      const seen = new Set();
      p.hand.forEach((cid, i) => {
        if (cid === 'shopTicket' || seen.has('p' + cid)) return;
        const c = CARDS[cid];
        if (c.kind !== 'char') { const A = ACT[cid]; if (!A || (A.can && A.can(p))) return; }
        seen.add('p' + cid);
        if (coachAI() && cid === 'sandWall') { // 砂壁：敵が自分のアバターの近く（3マス以内）に来てから。早く置くと崩れて意味がない
          const av = own(me).find(isAv), near = av && G.units && Object.values(G.units).some(e => !e.dead && !e.hidden && e.owner !== me && !isAv(e) && !abU(e, 'flight') && Math.max(Math.abs(e.x - av.x), Math.abs(e.y - av.y)) <= 3);
          if (!near) return;
        }
        const ev = { t: 'play', i, cid }; if (okEv(ev)) out.push(ev);
      });
      if (coachAI() && p.deck.length > 3) { const k = out.find(e => e.t === 'play' && e.cid === 'signpost'); if (k) return { evs: [k], forced: false }; } // ドロー効果のカードは先に使う
      if (!noShop() && canBuyRight(p)) shopItems().forEach((s, k) => { if (s && !s.sold && p.coins >= s.price) { const ev = { t: 'buy', k }; if (okEv(ev)) out.push(ev); } });
      if (!noShop() && !p.sellUsed) p.hand.forEach((cid, i) => { if (sellOf(cid) != null && !seen.has('s' + cid) && !coachAI()) { seen.add('s' + cid); const ev = { t: 'sell', i }; if (okEv(ev)) out.push(ev); } });
      for (const u of own(me)) {
        if (u.dead || isAv(u)) continue;
        const ma = mainAbility(u); if (ma && !(ma.t === 'twoAct')) { const ev = { t: ma.t, uid: u.uid }; if (okEv(ev)) out.push(ev); }
        if (u.hidden && !u.sanct) { const ev = { t: 'reveal', uid: u.uid }; if (okEv(ev)) out.push(ev); }
        if (hasW(u, 'flameSword') && !u.flameUsed) { const ev = { t: 'flame', uid: u.uid }; if (okEv(ev)) out.push(ev); }
        if (abU(u, 'archer') && !u.hidden) { const ev = { t: 'archer', uid: u.uid }; if (okEv(ev)) out.push(ev); }
        if (abU(u, 'scout') && !u.hidden) { const ev = { t: 'scout', uid: u.uid }; if (okEv(ev)) out.push(ev); }
      }
      return { evs: out, forced: false };
    }
    const forced = own(me).filter(mustMove), pool = forced.length ? forced : own(me), mv = [];
    for (const u of pool) { if (u.dead) continue; for (const m of movesFor(u)) { const ev = { t: 'move', uid: u.uid, x: m.x, y: m.y }; if (okEv(ev)) mv.push({ ev, atk: m.type === 'attack', prog: (m.y - u.y) * fwd(me), av: isAv(u) }); } }
    if (deep && mv.length > 10) { // 深い読みでは、攻撃と前進の有望な手に絞る
      const atk = mv.filter(m => m.atk), rest = mv.filter(m => !m.atk).sort((a, b) => b.prog - a.prog).slice(0, 6);
      return { evs: atk.concat(rest).map(m => m.ev), forced: forced.length > 0 };
    }
    return { evs: mv.map(m => m.ev), forced: forced.length > 0 };
  });
}

/* ===== 探索 ===== */
/* メインステップの終わりの評価：その後のアクションステップで1手動かした場合の最良の評価値（突撃司令・闘争心など、動きを助けるカードの価値を測る） */
async function aiQuiet(state, me, F, deadline) {
  const r = await aiSim(state, me, { t: 'toAction' }, []); if (r.err) return -Infinity;
  let best = aiScore(r.state, me); const g = aiGen(r.state, me, F, true);
  for (const ev of g.evs) { if (AI.now() > deadline) break; const m = await aiSim(r.state, me, ev, []); if (m.err || !m.changed) continue; best = Math.max(best, aiScore(m.state, me)); }
  return best;
}
const aiYield = () => new Promise(r => setTimeout(r, 0));
async function aiSearch(me, deadline, F) {
  const cfg = AI.cfg, root = aiClone(G, me), isMain = G.phase === 'main';
  const v0 = aiScore(root, me), top = aiGen(root, me, F, false);
  if (!top.evs.length) return null;
  let lastYield = AI.now();
  const tick = async () => { if (AI.now() - lastYield > 40) { await aiYield(); lastYield = AI.now(); } };
  const nodes = [], rootHp = aiWith(root, () => { const m = {}; for (const e of own(1 - me)) if (!e.dead && !isAv(e)) m[e.uid] = aiHp(e); return m; });
  const okSt = st => { const c = aiChipInfo(st, rootHp); return c.kill || (c.chip && aiKillableNow(st, me, rootHp)); };
  const mkNode = (ev, choices, r) => { const c = isMain ? aiChipInfo(r.state, rootHp) : { chip: false, kill: false }; return { ev, choices, counts: r.counts, state: r.state, v: aiScore(r.state, me), gate: c.chip && !c.kill, ok: false }; };
  /* 第1手：既定の選択に加えて、最初の2つの選択（対象・配置・SpCの支払い・非公開にするか等）の別案も試す */
  for (const ev of top.evs) {
    if (AI.now() > deadline && nodes.length) break;
    await tick();
    const r0 = await aiSim(root, me, ev, []);
    if (r0.err) { F.add(AI.key(ev)); continue; }
    if (!r0.changed) { F.add(AI.key(ev)); continue; }
    nodes.push(mkNode(ev, [], r0));
    const n0 = r0.counts[0] || 0, n1 = r0.counts[1] || 0;
    for (let a = 1; a < Math.min(n0, cfg.variants[0]); a++) {
      if (AI.now() > deadline) break;
      const r = await aiSim(root, me, ev, [a]); if (r.err || !r.changed) continue;
      nodes.push(mkNode(ev, [a], r));
    }
    for (let b = 1; b < Math.min(n1, cfg.variants[1]); b++) {
      if (AI.now() > deadline) break;
      const r = await aiSim(root, me, ev, [0, b]); if (r.err || !r.changed) continue;
      nodes.push(mkNode(ev, [0, b], r));
    }
  }
  if (!nodes.length) return null;
  nodes.sort((a, b) => b.v - a.v);
  /* 第2手以降：上位の手の先を読み、「その手を含む最良の手順」の価値を求める（削り→とどめ、カードの組み合わせ） */
  const maxDepth = isMain ? cfg.depthMain : cfg.depthAct;
  const deepen = async (node, depth, root0) => {
    let best = node.v; root0 = root0 || node;
    if (depth >= maxDepth || AI.now() > deadline || AI.over() === true) return best;
    const g = aiGen(node.state, me, F, true);
    const kids = [];
    for (const ev of g.evs) {
      if (AI.now() > deadline) break;
      await tick();
      const r = await aiSim(node.state, me, ev, []); if (r.err || !r.changed) continue;
      kids.push({ state: r.state, v: aiScore(r.state, me) });
      if (root0.gate && !root0.ok && okSt(r.state)) root0.ok = true; // この手のダメージで、同じターンに倒しきれる手順が見つかった
    }
    kids.sort((a, b) => b.v - a.v);
    for (const k of kids.slice(0, cfg.width[Math.min(depth, cfg.width.length - 1)] >> 1 || 1)) {
      const sub = await deepen(k, depth + 1, root0);
      best = Math.max(best, sub);
    }
    if (kids.length) best = Math.max(best, kids[0].v);
    return best;
  };
  const W = Math.min(nodes.length, cfg.width[0]);
  for (const n of nodes) if (n.gate && okSt(n.state)) n.ok = true;
  for (let i = 0; i < W; i++) { nodes[i].seq = await deepen(nodes[i], 1); }
  for (let i = W; i < nodes.length; i++) nodes[i].seq = nodes[i].v;
  /* メインステップ：上位の手は、その後の動き（アクションステップの1手）まで含めて評価する。何もしない場合も同じ基準で比べる */
  let vBase = v0;
  if (isMain) {
    const qd = deadline + 250;
    vBase = Math.max(v0, await aiQuiet(root, me, F, qd));
    nodes.sort((a, b) => Math.max(b.seq, b.v) - Math.max(a.seq, a.v));
    for (const n of nodes.slice(0, 5)) { if (n.gate && !n.ok) continue; const q = await aiQuiet(n.state, me, F, qd); n.seq = Math.max(n.seq, q); }
  }
  for (const n of nodes) if (n.gate && !n.ok) { n.seq = -1e9; n.v = -1e9; } // 倒しきれないダメージだけの手は使わず、温存する
  const score = n => Math.max(n.seq, n.v), tb = n => score(n) + 0.01 * n.v;
  nodes.sort((a, b) => tb(b) - tb(a));
  const forced = top.forced, best = nodes[0];
  if (AI.debug) AI.debug({ v0, nodes: nodes.slice(0, 6).map(n => ({ ev: n.ev, ch: n.choices, v: n.v, seq: n.seq })), forced });
  if (!forced && score(best) <= vBase + cfg.eps) return null; // 何もしない方が良い（フェーズを進める／ターンを終える）
  return { ev: best.ev, choices: best.choices, counts: best.counts };
}
