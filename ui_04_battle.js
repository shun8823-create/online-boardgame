function localPick(o) { return new Promise(res => { UI.pk = { o, sel: [], res }; UI.sel = null; UI.selHand = null; renderBattle(); }); } // スマホでも画面位置は動かさない（操作しづらいため）
const UI = {
  hideHand: false, handPage: 0, pk: null, sel: null, selHand: null, busy: false, wait: null, overShown: false,
  render() { if (screen === 'battle') renderBattle(); },
  pickCard(title, prompt, cids, who) { who = who == null ? G.active : who; return ONL ? onlineInput('ans', who, () => localPickCard(title, prompt, cids)) : localPickCard(title, prompt, cids); },
  pickCards(title, prompt, cids, min, who, max) { who = who == null ? G.active : who; return ONL ? onlineInput('ans', who, () => localPickCards(title, prompt, cids, min, max)) : localPickCards(title, prompt, cids, min, max); },
  sfx(n) { SFX.play(n); },
  pause(ms) { return (ONL && ONL.queue && ONL.queue.length) ? Promise.resolve() : new Promise(r => setTimeout(r, ms)); },
  toast(m) { if (!/^🎲/.test(m) && !/のターン$/.test(m)) SFX.play('error'); const d = document.createElement('div'); d.textContent = m; $('#toast').appendChild(d); setTimeout(() => d.remove(), 3000); },
  ask(msg, btns, who) { who = who == null ? G.active : who; return ONL ? onlineInput('ans', who, () => localAsk(msg, btns)) : localAsk(msg, btns); },
  async confirm(msg, who) { return (await UI.ask(msg, ['はい', 'いいえ'], who)) === 'はい'; },
  cutIn(cid) { SFX.card(cid); if (ONL && ONL.queue.length) return Promise.resolve(); return new Promise(res => { const ms = { 1: 500, 2: 1000, 3: 1500 }[CARDS[cid].rank] || 500; const el = $('#cutin'); el.innerHTML = `<div class="cutcard">${cardHTML(cid, { cls: 'sm' })}</div>`; el.style.display = 'flex'; const done = () => { clearTimeout(t); el.style.display = 'none'; el.onclick = null; res(); }; const t = setTimeout(done, ms); el.onclick = done; }); },
  turnOverlay(p) {
    SFX.play('turn');
    const fast = ONL && ONL.queue && ONL.queue.length; // 追いつき再生中は省略
    const show = () => fast ? Promise.resolve() : new Promise(res => {
      let el = document.getElementById('turncut'); if (!el) { el = document.createElement('div'); el.id = 'turncut'; document.body.appendChild(el); }
      el.className = 'o' + p.i; el.innerHTML = `<div class="tcbig">${p.name}</div><div class="tcsub">${p.count}ターン目</div>`; el.style.display = 'flex'; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
      const done = () => { clearTimeout(t); el.style.display = 'none'; el.onclick = null; res(); }; const t = setTimeout(done, 1400); el.onclick = done;
    });
    if (ONL) return show();
    return show().then(() => localAsk(`${p.name}の${p.count}ターン目です。画面を${p.name}のプレイヤーに渡し、相手に手札が見えないようにしてください。`, [`${p.name}：ターン開始`]));
  },  gameOver(w) {
    if (UI.overShown) return; UI.overShown = true;
    SFX.play(ONL && w !== ONL.me ? 'lose' : 'win');
    const wn = G.players[w].name, ln = G.players[1 - w].name;
    const resign = G.log.slice(0, 6).some(l => l.includes('投了した'));
    const you = ONL ? (w === ONL.me) : null;
    const big = ONL ? (you ? '🏆 あなたの勝利！' : '💀 あなたの敗北…') : `🏆 ${wn}の勝利！`;
    const el = document.createElement('div'); el.id = 'gameover'; el.className = 'gameover ' + (you === false ? 'lose' : 'win');
    el.innerHTML = `<div class="gobox"><div class="gobig">${big}</div><div class="gosub">勝者：<b>${wn}</b>${ONL ? (you ? '（あなた）' : '（相手）') : ''}　／　敗者：${ln}</div><div class="gosub small">${resign ? `${ln}が投了しました` : `${ln}のアバターが倒されました`}</div><button class="btn main" id="goback">対戦準備へ戻る</button></div>`;
    document.body.appendChild(el);
    el.querySelector('#goback').onclick = () => { el.remove(); UI.overShown = false; UI.busy = false; UI.pk = null; leaveOnline(); screen = 'prep'; G = null; show(); };
  },
  pickBoard(o) { const who = o.who == null ? G.active : o.who; return ONL ? onlineInput('pick', who, () => localPick(o)) : localPick(o); },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
function paintTh() {
  const th = UI.th;
  document.querySelectorAll('#app .cell').forEach(c => {
    const x = +c.dataset.x, y = +c.dataset.y; let roll = false, hit = false;
    if (th) { const m = s => !!s && (s.type === 'col' ? x === s.idx : y === s.idx); roll = m(th.roll); hit = th.hit.some(m); }
    c.classList.toggle('th-roll', roll); c.classList.toggle('th-hit', hit);
  });
}
/* サンダーストーム：1列あたり約1秒のルーレット演出。選ばれた列は黄色く光る */
UI.thunderStep = async function (s) {
  if (!UI.th) { UI.th = { roll: null, hit: [] }; renderBattle(); }
  const ticks = 12;
  for (let i = 0; i < ticks; i++) { UI.th.roll = { type: s.type, idx: (((s.idx - (ticks - 1 - i)) % 7) + 7) % 7 }; paintTh(); await sleep(50 + i * 7); }
  UI.th.roll = null; UI.th.hit.push(s); paintTh(); await sleep(350);
};
UI.thunderRound = function () { if (UI.th) { UI.th.hit = []; UI.th.roll = null; paintTh(); } };
UI.thunderEnd = async function () { await sleep(600); UI.th = null; paintTh(); };
function finishPick(r) { const pk = UI.pk; UI.pk = null; renderBattle(); pk.res(r); }
const chip = (k, v, b) => `<span class="st-${k} ${v > b ? 'up' : v < b ? 'down' : ''}">${k}${v}${v > b ? '▲' : v < b ? '▼' : ''}</span>`;
function tkTags(u) {
  if (!u.tk) return '';
  const M = { frenzy: '🌀狂', ambush: '🗡奇', chase: '🎯追', mutate: '✖斜' };
  return Object.keys(u.tk).filter(k => M[k] && u.tk[k].some(n => n >= G.players[u.owner].count)).map(k => `<span title="${k}">${M[k]}</span>`).join('');
}
function unitHTML(u) {
  const c = CARDS[u.cid], mineU = u.owner === VW();
  if (u.hidden && !mineU) return `<div class="unit fh foe o${u.owner} ${u.marked ? 'mk' : ''}">${u.marked ? '👁' : '?'}</div>`;
  const st = statusList(u).map(k => STATUS_ICON[k]).join('');
  const aa = armorTotal(u) > 0 ? `<span class="armor">装甲${armorTotal(u)}</span>` : '';
  const eq = (u.weapon ? '⚔' : '') + u.attach.map(a => ({ shiftForm: '↗', windSlash: '🌀', fightSpirit: '🐾', redDragonBreath: '🔥' }[a.cid])).join('') + tkTags(u) + (abU(u, 'incinerate') ? '🔥' : '');
  return `<div class="unit rk${c.rank || 1} ${mineU ? 'mine' : 'foe'} o${u.owner} ${u.hidden ? 'hid' : ''}" data-card="${u.cid}" data-uid="${u.uid}"><div class="uart">${artSVG(u.cid)}</div>${u.hidden ? `<div class="un">${u.sanct ? '聖域' : '潜伏'}${u.marked ? '👁' : ''}</div>` : ''}<div class="stat">${st}${eq}</div><div class="us">${chip('LP', u.lp, baseLP(u))}${chip('OP', OP(u), c.op)}${chip('DP', DP(u), c.dp)}${chip('SC', u.sc, baseSC(u))}${chip('SpC', u.spc, baseSpC(u))}${baseRSpC(u) ? chip('耐', u.rspc || 0, baseRSpC(u)) : ''}${isAv(u) ? chip('移', avLeft(u), avMax(u)) : ''}${aa}</div></div>`;
}
function hlMap() {
  const m = {};
  if (UI.pk) { for (const [x, y] of UI.pk.o.cells) m[x + ',' + y] = 'hl-' + (UI.pk.o.kind || 'target'); for (const [x, y] of UI.pk.sel) m[x + ',' + y] += ' picked'; }
  else if (UI.sel && G.units[UI.sel]) { const u = G.units[UI.sel]; m[u.x + ',' + u.y] = 'hl-sel'; if ((G.phase === 'action' || G.phase === 'main') && (!ONL || G.active === ONL.me)) for (const mv of movesFor(u)) m[mv.x + ',' + mv.y] = (mv.type === 'attack' ? 'hl-attack' : 'hl-move') + (G.phase === 'main' ? ' prev' : ''); }
  return m;
}
function unitActions(u, can) {
  const btn = [];
  const dis = (cond) => (can && cond ? '' : 'disabled');
  if (u.hidden) {
    const rest = u.sanct ? 0 : u.hiddenSince + 3 - G.players[u.owner].count, share = U().some(v => v !== u && !v.dead && v.owner === u.owner && v.x === u.x && v.y === u.y);
    btn.push(`<button class="btn main" data-act="reveal" data-uid="${u.uid}" ${dis(rest <= 0 && !share)}>公開する</button><span class="note">${rest > 0 ? `あと${rest}ターン後から公開可` : share ? '自分のキャラと同じマスでは公開できません' : '相手と同じマスなら公開と同時にバトル'}</span>`);
  } else {
    if (hasArcher(u)) btn.push(`<button class="btn" data-act="archer" data-uid="${u.uid}" ${dis(u.sc >= 1 && u.uses.archer !== G.turn)}>弓使い（サイコロ${archerNeed(u)}以上）</button>`);
    if (hasW(u, 'flameSword')) btn.push(`<button class="btn" data-act="flame" data-uid="${u.uid}" ${dis(!u.flameUsed)}>烈火剣：焼却を得る（ゲーム中1度）</button>`);
    if (abU(u, 'scout')) btn.push(`<button class="btn" data-act="scout" data-uid="${u.uid}" ${dis(u.sc >= 1 && u.uses.scout !== G.turn)}>警戒</button>`);
  }
  return btn.length ? `<div class="panel"><div class="bar">${btn.join('')}</div></div>` : '';
}
UI.peek = function (who, cid, pos) {
  if (ONL && ONL.me !== who) return;
  const el = $('#modal');
  el.innerHTML = `<div class="mbox"><h3>警戒：${esc(pos)}の非公開カード</h3><div style="display:flex;justify-content:center">${cardHTML(cid, { cls: 'full lg' })}</div><div class="note" style="text-align:center">${ONL ? 'あなただけに表示しています' : '※相手に見えないように確認してください'}</div><div class="bar" style="justify-content:center"><button class="btn main" data-act="closeModal">閉じる</button></div></div>`;
  el.style.display = 'flex';
};
const avMv = i => { const a = own(i).find(isAv); return a ? `移動${avLeft(a)}/${avMax(a)}` : ''; };
function renderBattle() {
  const pcv = PCV(), hh = !pcv && UI.hideHand; // パソコンでは盤上の選択中、手札を一時的に隠して盤を広く見せる
  if (!G) { $('#app').innerHTML = '<h2>対戦</h2><p class="note">「対戦準備」から対戦を開始してください。</p>'; return; }
  const ap = cur(), p = G.players[VW()], flip = VW() === 1, hl = hlMap(), mineTurn = !ONL || G.active === ONL.me;
  let cells = '';
  const zOn = k => { try { return Store.get('bgZone_' + k) !== '0'; } catch (e) { return UI['zoneOff_' + k] !== true; } }; // 表示のオン／オフ（初期はオン）
  const zSea = y => zOn('sea') && G.players.some(q => q.dangerSea && rowOf(q.i, y) <= 4), zIns = y => zOn('ins') && G.players.some(q => instinctActive(q) && rowOf(q.i, y) >= 4); // 危険海流域（水色）／本能解放（赤）の効果範囲
  const zBtn = (k, cls, nm) => `<button type="button" class="zleg ${cls} ${zOn(k) ? 'on' : 'off'}" data-act="zone" data-z="${k}" title="タップで範囲表示のオン／オフ">${nm}の範囲：${zOn(k) ? '表示中' : '非表示'}</button>`;
  const zoneLeg = (G.players.some(q => q.dangerSea) ? zBtn('sea', 'zs', '危険海流域') : '') + (G.players.some(q => instinctActive(q)) ? zBtn('ins', 'zi', '本能解放') : '');
  const incin = {}; for (const d of U()) if (!d.dead && !d.hidden && abU(d, 'incinerate')) incin[d.x + ',' + (d.y + fwd(d.owner))] = d.owner;
  for (let ry = 0; ry < 7; ry++) for (let rx = 0; rx < 7; rx++) {
    const x = flip ? 6 - rx : rx, y = flip ? 6 - ry : ry;
    const t = at(x, y), w = wallAt(x, y), row = rowOf(VW(), y), hb = t && !t.hidden ? hiddenAt(x, y) : []; const ftr = (G.traps && G.traps[x + ',' + y] && G.traps[x + ',' + y].hidden && G.traps[x + ',' + y].owner !== VW()) ? G.traps[x + ',' + y] : null;
    const acted = t && t.owner === VW() && actionsDone(t) ? ' acted' : '';
    const inc = incin[x + ',' + y]; cells += `<div class="cell t-${terrOfRow(row)} ${hl[x + ',' + y] || ''}${UI.tgtMark && UI.tgtMark.cells.includes(x + ',' + y) && (u0 => u0 && !u0.dead)(at(x, y)) ? ' tgtmark' : ''}${acted}${inc != null ? ' incin' : ''}${zSea(y) ? ' z-sea' : ''}${zIns(y) ? ' z-ins' : ''}" data-act="cell" data-x="${x}" data-y="${y}" title="${coord(x, y)}">${w ? `<div class="wall">砂壁</div>` : ''}${inc != null ? `<span class="incfx ${inc === VW() ? '' : 'foe'}" title="焼却：このマスの相手キャラクターはLPを減らされ、設置カードは壊される">🔥</span>` : ''}${G.traps && G.traps[x + ',' + y] && !(G.traps[x + ',' + y].hidden && G.traps[x + ',' + y].owner !== VW()) ? `<span class="sbadge trap ${G.traps[x + ',' + y].owner === VW() ? '' : 'foe'}" title="${G.traps[x + ',' + y].hidden ? '非公開カード' : '棘付きトラップ'}">${G.traps[x + ',' + y].hidden ? (G.traps[x + ',' + y].marked ? '👁' : '▲') : '⚠'}</span>` : ''}${G.sanctuaries && G.sanctuaries[x + ',' + y] ? `<span class="sbadge ${G.sanctuaries[x + ',' + y].owner === VW() ? '' : 'foe'}" title="マジックサンクチュアリ">✦</span>` : ''}${t ? unitHTML(t) : (ftr ? `<div class="unit fh foe ${ftr.marked ? 'mk' : ''}">${ftr.marked ? '👁' : '?'}</div>` : '')}${t && !t.hidden && ftr ? `<span class="hbadge foe">${ftr.marked ? '👁' : '?'}</span>` : ''}${hb.map(h => `<span class="hbadge ${h.owner === VW() ? '' : 'foe'}">${h.marked ? '👁' : h.owner === VW() ? '潜' : '?'}</span>`).join('')}</div>`;
  }
  const phaseName = { start: '—', draw: 'ドロー', main: 'メインステップ', action: 'アクションステップ' }[G.phase];
  const showHand = ONL ? true : G.phase !== 'start';
  const handArr = showHand ? p.hand.map((cid, i) => `<div class="hcard ${UI.selHand === i ? 'sel' : ''}" data-act="hand" data-i="${i}">${cardHTML(cid, { cls: 'sm' })}</div>`) : p.hand.map(() => '<div class="back"></div>');
  const hand = handArr.join('');
  const HPER = 8, hpages = Math.max(1, Math.ceil(p.hand.length / HPER)); UI.handPage = Math.min(Math.max(0, UI.handPage || 0), hpages - 1);
  const handPC = `<div class="panel handp"><div class="hphead"><b class="serif">${p.name}の手札（${p.hand.length}）</b>${hpages > 1 ? `<span class="pager"><button class="btn sm" data-act="hpage" data-d="-1" ${UI.handPage === 0 ? 'disabled' : ''}>◀</button><span>${UI.handPage + 1} / ${hpages}</span><button class="btn sm" data-act="hpage" data-d="1" ${UI.handPage >= hpages - 1 ? 'disabled' : ''}>▶</button></span>` : ''}</div><div class="hgrid">${handArr.slice(UI.handPage * HPER, (UI.handPage + 1) * HPER).join('')}</div></div>`;
  const o = G.players[1 - VW()];
  let pkp = '', pkf = '';
  if (UI.pk) {
    const pk = UI.pk.o;
    pkp = `<div class="panel pkpanel ${pcv ? 'pkfloat' : ''}" style="border-color:var(--spc)"><b>${esc(pk.prompt)}</b>${pk.multi ? `<div class="note">${pk.sumLabel ? pk.sumLabel(UI.pk.sel) : `選択中 ${UI.pk.sel.length}`}</div>` : ''}<div class="bar">${pk.multi ? `<button class="btn main" data-act="pkok" ${!pk.validate || pk.validate(UI.pk.sel) ? '' : 'disabled'}>${esc(pk.confirmLabel || '決定')}</button>` : ''}${pk.cancellable === false ? '' : `<button class="btn" data-act="pkcancel">${esc(pk.cancelLabel || 'キャンセル')}</button>`}</div></div>`;
  }
  if (pcv) { pkf = pkp; pkp = ''; } // パソコン：選択の案内とボタンは盤の上に浮かべる
  let selp = '';
  if (UI.selHand != null && p.hand[UI.selHand] && !UI.pk && !pcv) {
    const cid = p.hand[UI.selHand];
    selp = `<div class="panel selinfo">${cardHTML(cid, { cls: 'full' })}<div class="bar"><button class="btn main" data-act="play" ${G.phase === 'main' && !UI.busy && mineTurn ? '' : 'disabled'}>使用 / 配置</button>${sellOf(cid) != null ? `<button class="btn" data-act="sell" ${G.phase === 'main' && !UI.busy && mineTurn && !p.sellUsed && !(G.opt && G.opt.noShop) ? '' : 'disabled'}>売る（+${sellOf(cid)}）${p.sellUsed ? '※今ターン売却済み' : ''}</button>` : ''}<span class="note">${!mineTurn ? '相手のターンです' : G.phase === 'main' ? '' : 'メインステップのみ使用可'}</span></div></div>`;
  } else if (UI.sel && G.units[UI.sel] && !UI.pk) { const su = G.units[UI.sel], sc = CARDS[su.cid]; selp = MOB() ? `<div class="panel strip"><b class="serif">${esc(sc.name.replace(/（.*）/, ''))}</b><span class="badge">${coord(su.x, su.y)}</span><span class="st-LP">LP${su.lp}</span><span class="st-OP">OP${OP(su)}</span><span class="st-DP">DP${DP(su)}</span><span class="st-SC">SC${su.sc}</span><span class="st-SpC">SpC${su.spc}</span>${statusList(su).map(k => STATUS_ICON[k]).join('')}${su.acted ? '<span class="note">行動済</span>' : ''}<button class="btn sm" data-act="udetail" data-uid="${su.uid}">詳細</button></div>` : `<div class="panel selinfo">${unitDetail(su)}</div>`; }
  if (UI.sel && G.units[UI.sel] && !UI.pk && !UI.selHand) { const su = G.units[UI.sel]; if (su.owner === VW()) selp += unitActions(su, G.phase === 'main' && !UI.busy && mineTurn); }
  $('#app').innerHTML = `<div class="turnbar"><span class="badge serif">ターン${G.turn}　${ap.name}（${ap.count}ターン目）${ONL ? (mineTurn ? '【あなたの番】' : (ONL.ai ? '【AIの番】' : '【相手の番】')) : ''}</span>${ONL ? `<span class="badge">あなたは${p.name}</span>` : ''}<span class="badge phasebadge">${phaseName}</span>
  <button class="btn main" data-act="toAction" ${G.phase === 'main' && mineTurn ? '' : 'disabled'}>アクションステップへ</button><button class="btn" data-act="endTurn" ${(G.phase === 'main' || G.phase === 'action') && mineTurn ? '' : 'disabled'}>ターン終了</button>
  ${pcv ? '' : `<button class="btn ${UI.hideHand ? 'on' : ''}" data-act="togHand">${UI.hideHand ? '🃏手札を表示' : '🃏手札を隠す'}</button>`}<button class="btn" data-act="grave" data-i="0">先行墓地(${G.players[0].grave.length})</button><button class="btn" data-act="grave" data-i="1">後攻墓地(${G.players[1].grave.length})</button><button class="btn danger" data-act="giveup" ${mineTurn ? '' : 'disabled'}>投了</button></div>${UI.wait ? `<div id="waitfloat">⏳ ${esc(UI.wait)}</div>` : ''}
  <div class="battle ${hh ? 'nohand' : ''}"><div class="bmain">${pkf}<div class="note" style="margin-bottom:4px">相手（${o.name}）：手札${o.hand.length}枚　山札${o.deck.length}枚　墓地${o.grave.length}枚　<b class="coin">💰${o.coins}</b>　<b class="spcount">スペル使用${o.spellsUsed}回</b>　<b class="spcount">AP${o.ap}</b>　<b class="spcount">アバター${avMv(o.i)}回</b>${G.lap ? '<b class="lapb">🔥二周目：全キャラ狂乱・移動SC-1（アバター除く）</b>' : ''}${G.assault && G.assault.turn === G.turn ? `　<b class="warn">突撃司令：種族「${G.assault.race}」は必ず前進</b>` : ''}</div>
  <div class="boardwrap"><div class="rowlabels">${[0, 1, 2, 3, 4, 5, 6].map(ry => `<span>${String.fromCharCode(65 + (flip ? 6 - ry : ry))}</span>`).join('')}</div><div class="board${flip ? ' flip' : ''}">${cells}</div><div></div><div class="collabels">${[0, 1, 2, 3, 4, 5, 6].map(rx => `<span>${(flip ? 6 - rx : rx) + 1}</span>`).join('')}</div></div>${zoneLeg ? `<div class="zlegs">${zoneLeg}</div>` : ''}
  <div class="note desk-only" style="margin-top:4px">${VW() === 0 ? 'ホーム＝G〜E列／ボーダー＝D列／エネミー＝C〜A列' : 'ホーム＝A〜C列／ボーダー＝D列／エネミー＝E〜G列'}（先行はG列側、後攻はA列側。自分の陣地は画面の下側）。 山札${p.deck.length}枚・墓地${p.grave.length}枚　<b class="coin">💰${p.coins}</b>　<b class="spcount">スペル使用${p.spellsUsed}回</b>　<b class="spcount">AP${p.ap}</b>　<b class="spcount">アバター${avMv(p.i)}回</b>　配置：通常${p.summons}/1${p.extra ? `＋増援${p.extra}` : ''}${p.goblinSlots ? `＋ゴブリン${p.goblinSlots}` : ''}</div></div>
  <div class="bside"><div id="hovp"></div>${pkp}${selp}<div class="panel desk-only logp"><b class="serif">戦況ログ</b><div class="log">${G.log.slice(0, 60).map(l => `<div>${esc(l)}</div>`).join('')}</div></div>${pcv ? handPC : ''}</div>
  ${pcv ? '' : `<div class="bhand ${hh ? 'hid' : ''}"><h3 style="margin:0 0 2px">${p.name}の手札（${p.hand.length}）${hh ? `<span class="note">　${UI.hideHand ? '非表示中' : '選択中のため一時的に非表示'}</span>` : ''}</h3>${hh ? '' : `<div class="hand">${hand}</div>`}</div>`}
  <div class="bshop"><div class="panel desk-only binfo"><b class="serif">自分（${p.name}）</b><div class="kv">山札${p.deck.length}／墓地${p.grave.length}／手札${p.hand.length}<br><b class="coin">💰${p.coins}</b>　<b class="spcount">スペル使用${p.spellsUsed}回</b>　<b class="spcount">AP${p.ap}</b>　<b class="spcount">アバター${avMv(p.i)}回</b><br>配置：通常${p.summons}/1${p.extra ? `＋増援${p.extra}` : ''}${p.goblinSlots ? `＋ゴブリン${p.goblinSlots}` : ''}</div><hr style="border:0;border-top:1px solid #3a4046"><b class="serif">相手（${o.name}）</b><div class="kv">山札${o.deck.length}／墓地${o.grave.length}／手札${o.hand.length}<br><b class="coin">💰${o.coins}</b>　<b class="spcount">スペル使用${o.spellsUsed}回</b>　<b class="spcount">AP${o.ap}</b>　<b class="spcount">アバター${avMv(o.i)}回</b></div></div>${shopHTML(p, G.phase === 'main' && !UI.busy && mineTurn)}</div></div>
  <details class="panel mob-only"><summary class="serif">ログ・山札 ${p.deck.length}枚・墓地 ${p.grave.length}枚・スペル使用 自${p.spellsUsed}／相${o.spellsUsed}・AP 自${p.ap}／相${o.ap}・アバター移動 自${avMv(p.i).slice(2)}／相${avMv(o.i).slice(2)}</summary><div class="log">${G.log.slice(0, 40).map(l => `<div>${esc(l)}</div>`).join('')}</div></details>`;
  paintTh(); pcEnhance();
}

/* 再描画（ターン切り替え時など）で、スマホの手札の横スクロール位置が左端に戻らないようにする */
{ const _renderBattle = renderBattle; renderBattle = function () { const h = document.querySelector('.battle .hand'), x = h ? h.scrollLeft : 0, y = window.scrollY; const r = _renderBattle.apply(this, arguments); if (x) { const h2 = document.querySelector('.battle .hand'); if (h2) h2.scrollLeft = x; } if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y); return r; }; }
