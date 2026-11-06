'use strict';
/* ===== UI ===== */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let screen = 'cards';
const MOB = () => window.matchMedia && window.matchMedia('(max-width:700px)').matches;
let ONL = null, LOB = null;
const VW = () => (ONL ? ONL.me : G.active);
let userDecks = [];
try { userDecks = JSON.parse(localStorage.getItem('bgDecks_v1') || '[]'); } catch (e) { }
const saveDecks = () => { try { localStorage.setItem('bgDecks_v1', JSON.stringify(userDecks)); } catch (e) { } };
const allDecks = () => PRESETS.concat(userDecks);
const CARD_IDS = Object.keys(CARDS).filter(k => k !== 'avatar');
const DECK_IDS = CARD_IDS.filter(k => !CARDS[k].token);
const RACES = [...new Set(CARD_IDS.map(k => CARDS[k].race).filter(Boolean))];
const KIND_ORDER = { char: 0, spell: 1, item: 2, tech: 3 };
const F = { kind: 'all', rank: 'all', race: 'all', q: '' };
const B = { id: null, name: '新しいデッキ', list: {}, F: { kind: 'all', rank: 'all', race: 'all', q: '' } };
const PREP = { a: 'p_oudo', b: 'p_gob' };
const STATUS_ICON = { burn: '🔥', chill: '❄', frost: '🧊', poison: '☠', venom: '☠☠', petrify: '🪨', paralyze: '⚡' };
const STATUS_DESC = { paralyze: 'まひ：1ターンにSCを1つしか使えない（2回行動でも2回目の行動はできない）', burn: 'やけど：回復効果のLP増加が500減る', chill: 'しもやけ：回復効果のLP増加が500減る', frost: '凍傷：回復効果のLP増加が1000減り、LPが2000下がる（ターン終了時に回復しない）', poison: '毒：LP-500・SC-1（ターン終了時に回復しない）', venom: '猛毒：LP-1500・SC-2（ターン終了時に回復しない）', petrify: '石化：SC・SpCを消費する行動や効果を使えない' };

function cardSort(a, b) { const A = CARDS[a], Bc = CARDS[b]; return KIND_ORDER[A.kind] - KIND_ORDER[Bc.kind] || A.rank - Bc.rank || A.name.localeCompare(Bc.name, 'ja'); }
function filterIds(f, deck) {
  return (deck ? DECK_IDS : CARD_IDS).filter(id => {
    const c = CARDS[id];
    if (f.kind !== 'all' && c.kind !== f.kind) return false;
    if (f.rank !== 'all' && String(c.rank) !== f.rank) return false;
    if (f.race !== 'all' && c.race !== f.race) return false;
    if (f.q && !(c.name + c.txt.join('') + (c.cond || '') + (c.cat || '') + (c.race || '')).includes(f.q)) return false;
    return true;
  }).sort(cardSort);
}
/* 「」つきの効果（キーワード能力）：カード面には名前だけを出し、タップで詳しい解説を見られる */
const KEYWORDS = ['庇護', '生贄', '狂乱', '魔法耐性', '超魔法耐性', '焼却', '飛翔', '再生', '超再生', '潜伏', '弓使い', '警戒', '月光', '投擲', '超範囲', 'カウンター', 'スペルドロー', 'スペルコレクト', 'ハンティング', 'アサシン', 'ふいうち', '装甲値'];
function kwOf(t) {
  const r = /^([^：（]{1,8})(（[^）]*）)?：/.exec(t);
  return r && KEYWORDS.includes(r[1]) ? r[1] + (r[2] || '') : null;
}
function showStatus(k) {
  if (!STATUS_DESC[k]) return;
  let el = document.getElementById('kwpop'); if (!el) { el = document.createElement('div'); el.id = 'kwpop'; document.body.appendChild(el); }
  const d = STATUS_DESC[k], i = d.indexOf('：');
  el.innerHTML = `<div class="kwbox"><div class="kwt">${STATUS_ICON[k]} 状態異常「${esc(STATUS_NAME[k])}」</div><div class="kwd">${esc(i >= 0 ? d.slice(i + 1) : d)}</div><div class="note">（どこかをタップして閉じる）</div></div>`;
  el.style.display = 'flex'; el.onclick = () => { el.style.display = 'none'; };
}
function showKeyword(ref) {
  const [cid, i] = ref.split('|'), t = CARDS[cid] && CARDS[cid].txt[+i]; if (!t) return;
  const k = kwOf(t), body = t.slice(t.indexOf('：') + 1);
  let el = document.getElementById('kwpop'); if (!el) { el = document.createElement('div'); el.id = 'kwpop'; document.body.appendChild(el); }
  el.innerHTML = `<div class="kwbox"><div class="kwt">「${esc(k)}」</div><div class="kwd">${esc(body)}</div><div class="note">${esc(CARDS[cid].name)}　（どこかをタップして閉じる）</div></div>`;
  el.style.display = 'flex'; el.onclick = () => { el.style.display = 'none'; };
}
const ST_WORDS = { 'やけど': 'burn', 'しもやけ': 'chill', '凍傷': 'frost', '猛毒': 'venom', '毒': 'poison', '石化': 'petrify', 'まひ': 'paralyze' };
const stTxt = s => s.replace(/「(やけど|しもやけ|凍傷|猛毒|毒|石化|まひ)」/g, (m, w) => `<button type="button" class="kw stk" data-st="${ST_WORDS[w]}">「${w}」</button>`);
const chipH = (cls, label, v) => `<span class="chip ${cls}">${label} ${v}</span>`;
function cardHTML(cid, o = {}) {
  const c = CARDS[cid];
  let type = c.kind === 'char' || c.kind === 'avatar' ? `${c.cat}／${c.race || '—'}${c.kind === 'char' && charAttrs(cid).length ? '／' + charAttrs(cid).join('・') + '属性' : ''}` : c.kind === 'spell' ? `スペル${c.equip ? '／装備魔法' : ''}${c.attr ? '／' + c.attr + '属性' : ''}${c.wide ? '／超範囲' : ''}` : c.kind === 'item' ? (c.weapon ? 'アイテム（武器）' : 'アイテム') : 'テクニック';
  let stats = '';
  if (c.kind === 'char' || c.kind === 'avatar') stats = chipH('lp', 'LP', c.lp) + chipH('op', 'OP', c.op) + chipH('dp', 'DP', c.dp) + chipH('sc', 'SC', c.sc) + chipH('spc', 'SpC', c.spc) + (c.rspc ? chipH('spc', '耐性SpC', c.rspc) : '');
  else if (c.cost) stats = chipH('cost', '消費', c.cost);
  if (c.kind === 'item' && c.sell != null) stats += chipH('sell', '売値', c.sell === 0 && !c.noSell ? 0 : c.sell);
  let text = '';
  if (c.cond) text += `<div class="c-cond"><b>発動条件</b> ${esc(c.cond)}</div>`;
  text += c.txt.map((t, i) => { const k = kwOf(t); return k ? `<p class="kwp"><button type="button" class="kw" data-kw="${cid}|${i}">「${esc(k)}」</button></p>` : `<p>${stTxt(esc(t))}</p>`; }).join('');
  const attrs = (o.uid ? ` data-uid="${o.uid}"` : '');
  return `<div class="card rank${c.rank} k-${c.kind} ${o.cls || ''}" data-card="${cid}"${attrs}><div class="c-head"><span class="c-name">${esc(c.name)}</span><span class="c-rank">R${c.rank}</span></div><div class="c-art${artImgUrl(cid) ? ' img' : ''}">${artSVG(cid)}</div><div class="c-type">${esc(type)}</div><div class="c-text">${text}</div><div class="c-stats">${stats}</div></div>`;
}
function filterBar(f, scope) {
  const sel = (key, opts) => `<select data-sel="${scope}.${key}">${opts.map(([v, l]) => `<option value="${v}" ${f[key] === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  return `<div class="bar">${sel('kind', [['all', 'すべての種類'], ['char', 'キャラクター'], ['spell', 'スペル'], ['item', 'アイテム'], ['tech', 'テクニック']])}${sel('rank', [['all', 'すべてのランク'], ['1', 'ランク1'], ['2', 'ランク2'], ['3', 'ランク3']])}${sel('race', [['all', 'すべての種族'], ...RACES.map(r => [r, r])])}<input type="search" placeholder="名前・能力で検索" value="${esc(f.q)}" data-in="${scope}.q"></div>`;
}

/* ---------- 画面1: カード一覧 ---------- */
function renderCards() {
  $('#app').innerHTML = `<h2>カード一覧</h2><p class="note">カードをクリックで詳細。長押し（右クリック）でも全体を表示できます。能力・ステータスは各カードに記載。「」つきの効果はタップで詳しい解説が見られます。</p>${filterBar(F, 'F')}<div class="grid" id="grid"></div>`;
  fillGrid();
}
function fillGrid() {
  const ids = filterIds(F);
  $('#grid').innerHTML = ids.length ? ids.map(id => `<div class="gcard" data-act="detail" data-card="${id}">${cardHTML(id, { cls: 'full' })}</div>`).join('') : '<p class="note">該当するカードがありません</p>';
}

/* ---------- 画面2: デッキ構築 ---------- */
function loadDeck(id) {
  const d = allDecks().find(d => d.id === id);
  if (d) { B.id = d.preset ? null : d.id; B.name = d.preset ? d.name + '（コピー）' : d.name; B.list = { ...d.list }; B.src = d.id; }
}
function renderBuilder() {
  const v = validateDeck(B.list);
  const ids = Object.keys(B.list).filter(k => B.list[k] > 0).sort(cardSort);
  $('#app').innerHTML = `<h2>デッキ構築</h2>
  <div class="bar"><select data-sel="loadDeck"><option value="">— 保存済みデッキを読み込む —</option>${allDecks().map(d => `<option value="${d.id}">${esc(d.name)}${d.preset ? '（標準）' : ''}</option>`).join('')}</select>
  <button class="btn" data-act="newDeck">新規</button><button class="btn" data-act="dupDeck">複製</button><button class="btn danger" data-act="delDeck" ${B.id ? '' : 'disabled'}>削除</button></div>
  <div class="builder"><div><div class="minibar mob-only"><b class="${deckSize(B.list) === 30 && !v.err.length ? 'ok' : 'err'}">${deckSize(B.list)}/30枚${v.err.length ? '　✖' + v.err.length : ''}</b><span class="note">R1:${v.r[0]} R2:${v.r[1]} R3:${v.r[2]}</span><button class="btn sm" data-act="goDeck">デッキ確認・保存 ↓</button></div><h3>カードプール</h3>${filterBar(B.F, 'BF')}<p class="note">タップで1枚追加。「−」で削除。長押しで効果の全体表示。</p><div class="grid" id="pool"></div></div>
  <div><div class="panel sticky" id="deckpanel"><button class="btn sm mob-only" data-act="goPool" style="margin-bottom:6px">↑ カードを追加する</button><input type="text" id="dname" value="${esc(B.name)}" style="width:100%;margin-bottom:8px" placeholder="デッキ名">
  <div class="bar"><button class="btn main" data-act="saveDeck">保存</button><button class="btn" data-act="saveAs">名前を付けて保存</button></div>
  <div class="pinfo"><b class="${v.r[0] + v.r[1] + v.r[2] === 30 ? 'ok' : 'err'}">${deckSize(B.list)} / 30枚</b><span class="note">R1:${v.r[0]}　R2:${v.r[1]}　R3:${v.r[2]}</span></div>
  ${v.err.map(e => `<div class="err">✖ ${esc(e)}</div>`).join('')}${v.warn.map(e => `<div class="warn">⚠ ${esc(e)}</div>`).join('')}${!v.err.length ? '<div class="ok">✔ 構築ルールに違反していません</div>' : ''}
  <div style="max-height:52vh;overflow:auto;margin-top:8px">${ids.map(id => `<div class="drow" data-card="${id}"><span class="r">R${CARDS[id].rank}</span><span class="n">${esc(CARDS[id].name)}</span><b>×${B.list[id]}</b><button class="btn sm" data-act="dec" data-id="${id}">−</button><button class="btn sm" data-act="inc" data-id="${id}">＋</button></div>`).join('') || '<p class="note">カードを追加してください</p>'}</div></div></div></div>`;
  fillPool();
}
function fillPool() {
  const ids = filterIds(B.F, true);
  $('#pool').innerHTML = ids.map(id => { const n = B.list[id] || 0; return `<div class="gcard" data-act="inc" data-id="${id}" data-card="${id}">${n ? `<span class="cnt">×${n}</span>` : ''}${cardHTML(id, { cls: 'sm' })}</div>`; }).join('');
}
function saveDeckAs(asNew) {
  const name = ($('#dname').value || '').trim() || '名無しデッキ'; B.name = name;
  if (!asNew && B.id) { const d = userDecks.find(d => d.id === B.id); if (d) { d.name = name; d.list = { ...B.list }; saveDecks(); UI.toast('保存しました'); renderBuilder(); return; } }
  const d = { id: 'u' + Date.now(), name, list: { ...B.list } }; userDecks.push(d); B.id = d.id; saveDecks(); UI.toast('「' + name + '」を保存しました'); renderBuilder();
}

/* ---------- 画面3: 対戦準備 ---------- */
function renderPrep() {
  const opt = cur => allDecks().map(d => `<option value="${d.id}" ${d.id === cur ? 'selected' : ''}>${esc(d.name)}</option>`).join('');
  const info = id => { const d = allDecks().find(d => d.id === id); const v = validateDeck(d.list); return `<div class="note">${deckSize(d.list)}枚　R1:${v.r[0]} R2:${v.r[1]} R3:${v.r[2]}</div>${v.err.map(e => `<div class="err">✖ ${esc(e)}</div>`).join('')}${v.warn.map(e => `<div class="warn">⚠ ${esc(e)}</div>`).join('')}`; };
  const okA = !validateDeck(allDecks().find(d => d.id === PREP.a).list).err.length, okB = !validateDeck(allDecks().find(d => d.id === PREP.b).list).err.length;
  $('#app').innerHTML = `<h2>対戦準備</h2><h3>同じ端末で対戦</h3><div class="mrow"><div class="panel" style="min-width:300px"><h3>先行</h3><select data-sel="prep.a">${opt(PREP.a)}</select>${info(PREP.a)}</div>
  <div class="panel" style="min-width:300px"><h3>後攻</h3><select data-sel="prep.b">${opt(PREP.b)}</select>${info(PREP.b)}</div></div>
  <p class="note">同じデッキを両者が選ぶこともできます。この版は<b>1台の端末で交代して遊ぶ</b>形式です（ターン開始時に画面を渡す確認が出ます）。オンラインで遊ぶ場合は、下の「オンライン対戦」を使ってください。</p>
  <button class="btn main" data-act="start" ${okA && okB ? '' : 'disabled'}>対戦開始</button>${okA && okB ? '' : '<span class="err"> 構築ルール違反のデッキでは開始できません</span>'}${lobbyHTML()}`;
}

/* ---------- 画面4: 対戦 ---------- */
function localAsk(msg, btns) { return new Promise(res => { const el = $('#dlg'); let big = ''; if (msg.startsWith('§')) { const i = msg.indexOf('\n'); big = `<div class="dbig">${esc(msg.slice(1, i))}</div>`; msg = msg.slice(i + 1); } el.innerHTML = `<div class="dbox">${big}<p>${esc(msg).replace(/\n/g, '<br>')}</p><div class="dbtn">${btns.map((b, i) => `<button class="btn ${i === 0 ? 'main' : ''}" data-i="${i}">${esc(b)}</button>`).join('')}</div></div>`; el.style.display = 'flex'; el.onclick = e => { const b = e.target.closest('button[data-i]'); if (!b) return; SFX.play('select'); el.style.display = 'none'; el.onclick = null; res(btns[+b.dataset.i]); }; }); }

/* ---------- 効果音（Web Audio で合成。外部ファイル不要） ---------- */
/* カード選択ダイアログ：手札と同じ見た目。タップで選択、ダブルタップ／確定ボタンで決定、長押しで詳細 */
function localPickCard(title, prompt, cids) {
  return new Promise(res => {
    const el = $('#dlg'); let sel = null, lastT = 0, lastC = null;
    el.innerHTML = `<div class="dbox pickbox"><div class="dbig">${esc(title)}</div><p>${esc(prompt)}</p><div class="pickrow">${cids.map(c => `<div class="pickc" data-pc="${c}">${cardHTML(c, { cls: 'sm' })}</div>`).join('')}</div><div class="note" style="text-align:center;margin:6px 0">タップで選択／ダブルタップか確定ボタンで決定／長押しで詳細</div><div class="dbtn"><button class="btn main" data-ok disabled>このカードを手札に加える</button></div></div>`;
    el.style.display = 'flex';
    const done = c => { SFX.play('select'); el.style.display = 'none'; el.onclick = null; res(c); };
    el.onclick = e => {
      if (e.target.closest('[data-ok]')) { if (sel) done(sel); return; }
      const pc = e.target.closest('[data-pc]'); if (!pc || lpFired) return;
      const c = pc.dataset.pc, now = Date.now();
      if (c === lastC && now - lastT < 400) { done(c); return; }
      lastC = c; lastT = now; sel = c; SFX.play('select');
      el.querySelectorAll('.pickc').forEach(x => x.classList.toggle('sel', x === pc));
      el.querySelector('[data-ok]').disabled = false;
    };
  });
}
const SFX = (() => {
  let ctx = null, master = null, last = {}, on = true;
  try { on = localStorage.getItem('bg_sfx') !== '0'; } catch (e) { }
  const get = () => {
    if (!on) return null;
    try {
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); master = ctx.createGain(); master.gain.value = .45; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000; master.connect(lp); lp.connect(ctx.destination); }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  };
  const tone = (f, d, type = 'sine', v = .3, to = null, at = 0) => {
    const c = get(); if (!c) return; const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + Math.min(.02, d / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + d + .05);
  };
  const noise = (d, f = 1000, type = 'lowpass', v = .3, to = null, at = 0, q = 1) => {
    const c = get(); if (!c) return; const t = c.currentTime + at, n = Math.max(1, Math.floor(c.sampleRate * d)), b = c.createBuffer(1, n, c.sampleRate), a = b.getChannelData(0);
    for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = b; const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t); if (to) fl.frequency.exponentialRampToValueAtTime(to, t + d);
    const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t);
  };
  const arp = (fs, step = .09, type = 'sine', v = .22, d = .25) => fs.forEach((f, i) => tone(f, d, type, v, null, i * step));
  const S = {
    // カードに触れた時：軽いスイッチを押したような「カチッ」
    switch: () => { noise(.012, 3200, 'highpass', .1); tone(1650, .03, 'triangle', .07, 1050); noise(.01, 2200, 'bandpass', .06, null, .032, 2); tone(900, .03, 'triangle', .04, 650, .032); },
    select: () => tone(700, .04, 'sine', .08),
    tick: () => tone(640, .035, 'sine', .07),
    draw: () => noise(.05, 3000, 'bandpass', .05),
    error: () => tone(300, .1, 'sine', .09, 200),
    move: () => { noise(.05, 400, 'lowpass', .09); tone(180, .07, 'sine', .09, 120); },
    summon: () => { tone(392, .18, 'triangle', .09); tone(587, .26, 'triangle', .08, null, .08); noise(.1, 500, 'lowpass', .05); },
    clash: () => { noise(.08, 2000, 'bandpass', .11, 900, 0, 2); tone(240, .1, 'triangle', .07, 140); },
    hit: () => { noise(.06, 1000, 'lowpass', .11); tone(160, .07, 'sine', .09, 80); },
    kill: () => { tone(260, .3, 'triangle', .09, 90); noise(.2, 700, 'lowpass', .09, 200); },
    status: () => tone(330, .2, 'sine', .07, 200),
    reveal: () => tone(420, .2, 'sine', .09, 700),
    coin: () => { tone(1175, .08, 'triangle', .07); tone(1568, .18, 'triangle', .07, null, .07); },
    turn: () => { tone(494, .12, 'triangle', .09); tone(659, .18, 'triangle', .09, null, .1); },
    fire: () => { noise(.4, 600, 'lowpass', .11, 2200); noise(.3, 2500, 'highpass', .035, 4000, .05); },
    wind: () => noise(.5, 500, 'bandpass', .1, 1800, 0, 1.2),
    thunder: () => { noise(.05, 5000, 'highpass', .12); noise(.5, 300, 'lowpass', .15, 90, .03); tone(70, .4, 'sine', .12, 45, .03); },
    water: () => { tone(660, .2, 'sine', .08, 380); tone(880, .16, 'sine', .055, 500, .08); },
    earth: () => { tone(90, .25, 'sine', .15, 55); noise(.15, 350, 'lowpass', .09); },
    ice: () => arp([1568, 2093, 2637], .06, 'sine', .055, .28),
    magic: () => arp([523, 784, 1047], .07, 'sine', .075, .25),
    heal: () => arp([523, 659, 784], .09, 'sine', .085, .3),
    dark: () => { tone(130, .4, 'triangle', .09, 90); noise(.3, 250, 'lowpass', .06); },
    trap: () => { noise(.06, 3500, 'highpass', .11); tone(900, .15, 'triangle', .065, 500, .01); },
    sword: () => { noise(.1, 3500, 'highpass', .08, 6500); tone(1300, .08, 'triangle', .05, 800); },
    bow: () => { noise(.08, 2200, 'bandpass', .09, 700, 0, 2); tone(280, .06, 'triangle', .06, 140); },
    dragon: () => { tone(100, .45, 'triangle', .11, 60); noise(.4, 500, 'lowpass', .09, 1800); },
    win: () => arp([523, 659, 784, 1047], .12, 'triangle', .13, .45),
    lose: () => arp([392, 349, 311, 262], .22, 'sine', .11, .55),
  };
  const BY_CARD = { thornTrap: 'trap', darkAssassin: 'dark', elixir: 'heal', staminaPotion: 'heal', magicPotion: 'heal', hyperPotion: 'heal', goblinFlute: 'magic', redDragonBreath: 'dragon', redDragon: 'dragon', moonDragon: 'magic', magicSanctuary: 'magic', swordFine: 'sword', shieldFine: 'sword', bowFine: 'bow', darkAssassinX: 'dark', goldenBody: 'magic', ferocious: 'dragon', fightSpirit: 'dragon', instinct: 'dragon', assault: 'sword', stoneThrow: 'earth', petrifyRay: 'dark', aquaReturn: 'water', sandWall: 'earth' };
  const BY_ATTR = { '火': 'fire', '風': 'wind', '雷': 'thunder', '水': 'water', '土': 'earth', '雪': 'ice', '氷': 'ice' };
  const forCard = cid => {
    if (BY_CARD[cid]) return BY_CARD[cid];
    const c = CARDS[cid]; if (!c) return 'magic';
    if (c.attr) return BY_ATTR[c.attr.split('・')[0]] || 'magic';
    return c.kind === 'item' ? (c.weapon ? 'sword' : 'heal') : c.kind === 'char' ? 'summon' : 'magic';
  };
  return {
    get on() { return on; },
    set(v) { on = !!v; try { localStorage.setItem('bg_sfx', v ? '1' : '0'); } catch (e) { } if (on) get(); },
    unlock() { get(); },
    play(n) { try { const now = Date.now(); if (last[n] && now - last[n] < 60) return; last[n] = now; if (S[n]) S[n](); } catch (e) { } },
    card(cid) { this.play(forCard(cid)); },
  };
})();
function localPick(o) { return new Promise(res => { UI.pk = { o, sel: [], res }; UI.sel = null; UI.selHand = null; renderBattle(); if (MOB()) try { window.scrollTo(0, 0); } catch (e) { } }); }
const UI = {
  hideHand: false, pk: null, sel: null, selHand: null, busy: false, wait: null, overShown: false,
  render() { if (screen === 'battle') renderBattle(); },
  pickCard(title, prompt, cids, who) { who = who == null ? G.active : who; return ONL ? onlineInput('ans', who, () => localPickCard(title, prompt, cids)) : localPickCard(title, prompt, cids); },
  sfx(n) { SFX.play(n); },
  pause(ms) { return (ONL && ONL.queue && ONL.queue.length) ? Promise.resolve() : new Promise(r => setTimeout(r, ms)); },
  toast(m) { if (!/^🎲/.test(m) && !/のターン$/.test(m)) SFX.play('error'); const d = document.createElement('div'); d.textContent = m; $('#toast').appendChild(d); setTimeout(() => d.remove(), 3000); },
  ask(msg, btns, who) { who = who == null ? G.active : who; return ONL ? onlineInput('ans', who, () => localAsk(msg, btns)) : localAsk(msg, btns); },
  async confirm(msg, who) { return (await UI.ask(msg, ['はい', 'いいえ'], who)) === 'はい'; },
  cutIn(cid) { SFX.card(cid); if (ONL && ONL.queue.length) return Promise.resolve(); return new Promise(res => { const ms = { 1: 500, 2: 1000, 3: 1500 }[CARDS[cid].rank] || 500; const el = $('#cutin'); el.innerHTML = `<div class="cutcard">${cardHTML(cid, { cls: 'sm' })}</div>`; el.style.display = 'flex'; const done = () => { clearTimeout(t); el.style.display = 'none'; el.onclick = null; res(); }; const t = setTimeout(done, ms); el.onclick = done; }); },
  turnOverlay(p) { SFX.play('turn'); if (ONL) { UI.toast(`${p.name}のターン`); return Promise.resolve(); } return localAsk(`${p.name}のターン${p.count + 1}です。画面を${p.name}のプレイヤーに渡し、相手に手札が見えないようにしてください。`, [`${p.name}：ターン開始`]); },
  gameOver(w) {
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
UI.lap = function (name) {
  try { let el = document.getElementById('lapbn'); if (!el) { el = document.createElement('div'); el.id = 'lapbn'; document.body.appendChild(el); }
    el.innerHTML = `<div class="lapbox"><div class="lapt">⚠ 二周目突入！</div><div class="lapd">${esc(name)}の山札が尽きました</div><div class="lapd"><b>お互いの全てのキャラクターのOP +3000</b></div></div>`;
    el.style.display = 'flex'; clearTimeout(UI._lapT); UI._lapT = setTimeout(() => { el.style.display = 'none'; }, 4200); el.onclick = () => { el.style.display = 'none'; }; if (typeof sfx === 'function') sfx('status'); } catch (e) { }
};
UI.thunderStep = async function (s) {
  if (!UI.th) { UI.th = { roll: null, hit: [] }; if (MOB()) try { window.scrollTo(0, 0); } catch (e) { } renderBattle(); }
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
  return Object.keys(u.tk).filter(k => M[k] && u.tk[k] >= G.players[u.owner].count).map(k => `<span title="${k}">${M[k]}</span>`).join('');
}
function unitHTML(u) {
  const c = CARDS[u.cid], mineU = u.owner === VW();
  if (u.hidden && !mineU) return `<div class="unit fh foe ${u.marked ? 'mk' : ''}">${u.marked ? '👁' : '?'}</div>`;
  const st = statusList(u).map(k => STATUS_ICON[k]).join('');
  const aa = armorTotal(u) > 0 ? `<span class="armor">装甲${armorTotal(u)}</span>` : '';
  const eq = (u.weapon ? '⚔' : '') + u.attach.map(a => ({ shiftForm: '↗', windSlash: '🌀', fightSpirit: '🐾', redDragonBreath: '🔥' }[a.cid])).join('') + tkTags(u) + (abC(u.cid, 'incinerate') ? '🔥' : '');
  return `<div class="unit rk${c.rank || 1} ${mineU ? 'mine' : 'foe'} ${u.hidden ? 'hid' : ''}" data-card="${u.cid}" data-uid="${u.uid}"><div class="uart">${artSVG(u.cid)}</div>${u.hidden ? `<div class="un">${u.sanct ? '聖域' : '潜伏'}${u.marked ? '👁' : ''}</div>` : ''}<div class="stat">${st}${eq}</div><div class="us">${chip('LP', u.lp, baseLP(u))}${chip('OP', OP(u), c.op)}${chip('DP', DP(u), c.dp)}${chip('SC', u.sc, baseSC(u))}${chip('SpC', u.spc, baseSpC(u))}${baseRSpC(u) ? chip('耐', u.rspc || 0, baseRSpC(u)) : ''}${aa}</div></div>`;
}
function hlMap() {
  const m = {};
  if (UI.pk) { for (const [x, y] of UI.pk.o.cells) m[x + ',' + y] = 'hl-' + (UI.pk.o.kind || 'target'); for (const [x, y] of UI.pk.sel) m[x + ',' + y] += ' picked'; }
  else if (UI.sel && G.units[UI.sel]) { const u = G.units[UI.sel]; m[u.x + ',' + u.y] = 'hl-sel'; if (G.phase === 'action' && (!ONL || G.active === ONL.me)) for (const mv of movesFor(u)) m[mv.x + ',' + mv.y] = mv.type === 'attack' ? 'hl-attack' : 'hl-move'; }
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
function renderBattle() {
  if (!G) { $('#app').innerHTML = '<h2>対戦</h2><p class="note">「対戦準備」から対戦を開始してください。</p>'; return; }
  const ap = cur(), p = G.players[VW()], flip = VW() === 1, hl = hlMap(), mineTurn = !ONL || G.active === ONL.me;
  let cells = '';
  const incin = {}; for (const d of U()) if (!d.dead && !d.hidden && abU(d, 'incinerate')) incin[d.x + ',' + (d.y + fwd(d.owner))] = d.owner;
  for (let ry = 0; ry < 7; ry++) for (let rx = 0; rx < 7; rx++) {
    const x = flip ? 6 - rx : rx, y = flip ? 6 - ry : ry;
    const t = at(x, y), w = wallAt(x, y), row = rowOf(VW(), y), hb = t && !t.hidden ? hiddenAt(x, y) : [];
    const acted = t && t.owner === VW() && actionsDone(t) ? ' acted' : '';
    const inc = incin[x + ',' + y]; cells += `<div class="cell t-${terrOfRow(row)} ${hl[x + ',' + y] || ''}${acted}${inc != null ? ' incin' : ''}" data-act="cell" data-x="${x}" data-y="${y}" title="${coord(x, y)}">${w ? `<div class="wall">砂壁</div>` : ''}${inc != null ? `<span class="incfx ${inc === VW() ? '' : 'foe'}" title="焼却：このマスの相手キャラクターはLPを減らされ、設置カードは壊される">🔥</span>` : ''}${G.traps && G.traps[x + ',' + y] && true ? `<span class="sbadge trap ${G.traps[x + ',' + y].owner === VW() ? '' : 'foe'}" title="${G.traps[x + ',' + y].hidden ? '非公開カード' : '棘付きトラップ'}">${G.traps[x + ',' + y].hidden ? (G.traps[x + ',' + y].marked ? '👁' : '▲') : '⚠'}</span>` : ''}${G.sanctuaries && G.sanctuaries[x + ',' + y] ? `<span class="sbadge ${G.sanctuaries[x + ',' + y].owner === VW() ? '' : 'foe'}" title="マジックサンクチュアリ">✦</span>` : ''}${t ? unitHTML(t) : ''}${hb.map(h => `<span class="hbadge ${h.owner === VW() ? '' : 'foe'}">${h.marked ? '👁' : h.owner === VW() ? '潜' : '?'}</span>`).join('')}</div>`;
  }
  const phaseName = { start: '—', draw: 'ドロー', main: 'メインステップ', action: 'アクションステップ' }[G.phase];
  const showHand = ONL ? true : G.phase !== 'start';
  const hand = showHand ? p.hand.map((cid, i) => `<div class="hcard ${UI.selHand === i ? 'sel' : ''}" data-act="hand" data-i="${i}">${cardHTML(cid, { cls: 'sm' })}</div>`).join('') : p.hand.map(() => '<div class="back"></div>').join('');
  const o = G.players[1 - VW()];
  let pkp = '';
  if (UI.pk) {
    const pk = UI.pk.o;
    pkp = `<div class="panel pkpanel" style="border-color:var(--spc)"><b>${esc(pk.prompt)}</b>${pk.multi ? `<div class="note">${pk.sumLabel ? pk.sumLabel(UI.pk.sel) : `選択中 ${UI.pk.sel.length}`}</div>` : ''}<div class="bar">${pk.multi ? `<button class="btn main" data-act="pkok" ${!pk.validate || pk.validate(UI.pk.sel) ? '' : 'disabled'}>${esc(pk.confirmLabel || '決定')}</button>` : ''}${pk.cancellable === false ? '' : `<button class="btn" data-act="pkcancel">${esc(pk.cancelLabel || 'キャンセル')}</button>`}</div></div>`;
  }
  let selp = '';
  if (UI.selHand != null && p.hand[UI.selHand] && !UI.pk) {
    const cid = p.hand[UI.selHand];
    selp = `<div class="panel">${cardHTML(cid, { cls: 'full' })}<div class="bar"><button class="btn main" data-act="play" ${G.phase === 'main' && !UI.busy && mineTurn ? '' : 'disabled'}>使用 / 配置</button>${sellOf(cid) != null ? `<button class="btn" data-act="sell" ${G.phase === 'main' && !UI.busy && mineTurn && !p.sellUsed ? '' : 'disabled'}>売る（+${sellOf(cid)}）${p.sellUsed ? '※今ターン売却済み' : ''}</button>` : ''}<span class="note">${!mineTurn ? '相手のターンです' : G.phase === 'main' ? '' : 'メインステップのみ使用可'}</span></div></div>`;
  } else if (UI.sel && G.units[UI.sel] && !UI.pk) { const su = G.units[UI.sel], sc = CARDS[su.cid]; selp = MOB() ? `<div class="panel strip"><b class="serif">${esc(sc.name.replace(/（.*）/, ''))}</b><span class="badge">${coord(su.x, su.y)}</span><span class="st-LP">LP${su.lp}</span><span class="st-OP">OP${OP(su)}</span><span class="st-DP">DP${DP(su)}</span><span class="st-SC">SC${su.sc}</span><span class="st-SpC">SpC${su.spc}</span>${statusList(su).map(k => STATUS_ICON[k]).join('')}${su.acted ? '<span class="note">行動済</span>' : ''}<button class="btn sm" data-act="udetail" data-uid="${su.uid}">詳細</button></div>` : `<div class="panel">${unitDetail(su)}</div>`; }
  if (UI.sel && G.units[UI.sel] && !UI.pk && !UI.selHand) { const su = G.units[UI.sel]; if (su.owner === VW()) selp += unitActions(su, G.phase === 'main' && !UI.busy && mineTurn); }
  $('#app').innerHTML = `<div class="turnbar"><span class="badge serif">ターン${G.turn}　${ap.name}（${ap.count}ターン目）${ONL ? (mineTurn ? '【あなたの番】' : '【相手の番】') : ''}</span>${ONL ? `<span class="badge">あなたは${p.name}</span>` : ''}<span class="badge">${phaseName}</span>
  ${G.phase === 'main' && mineTurn ? '<button class="btn main" data-act="toAction">アクションステップへ</button>' : ''}${(G.phase === 'main' || G.phase === 'action') && mineTurn ? '<button class="btn" data-act="endTurn">ターン終了</button>' : ''}
  <button class="btn ${UI.hideHand ? 'on' : ''}" data-act="togHand">${UI.hideHand ? '🃏手札を表示' : '🃏手札を隠す'}</button><button class="btn" data-act="grave" data-i="0">先行墓地(${G.players[0].grave.length})</button><button class="btn" data-act="grave" data-i="1">後攻墓地(${G.players[1].grave.length})</button>${mineTurn ? '<button class="btn danger" data-act="giveup">投了</button>' : ''}</div>${UI.wait ? `<div class="panel warn">⏳ ${esc(UI.wait)}</div>` : ''}
  <div class="battle ${UI.hideHand ? 'nohand' : ''}"><div class="bmain"><div class="note" style="margin-bottom:4px">相手（${o.name}）：手札${o.hand.length}枚　山札${o.deck.length}枚　墓地${o.grave.length}枚　<b class="coin">💰${o.coins}</b>　<b class="spcount">スペル使用${o.spellsUsed}回</b>${G.lap ? '<b class="lapb">🔥二周目：全キャラOP+3000</b>' : ''}${G.assault && G.assault.turn === G.turn ? `　<b class="warn">突撃司令：種族「${G.assault.race}」は必ず前進</b>` : ''}</div>
  <div class="boardwrap"><div class="rowlabels">${[0, 1, 2, 3, 4, 5, 6].map(ry => `<span>${String.fromCharCode(65 + (flip ? 6 - ry : ry))}</span>`).join('')}</div><div class="board${flip ? ' flip' : ''}">${cells}</div><div></div><div class="collabels">${[0, 1, 2, 3, 4, 5, 6].map(rx => `<span>${(flip ? 6 - rx : rx) + 1}</span>`).join('')}</div></div>
  <div class="note desk-only" style="margin-top:4px">${VW() === 0 ? 'ホーム＝G〜E列／ボーダー＝D列／エネミー＝C〜A列' : 'ホーム＝A〜C列／ボーダー＝D列／エネミー＝E〜G列'}（先行はG列側、後攻はA列側。自分の陣地は画面の下側）。 山札${p.deck.length}枚・墓地${p.grave.length}枚　<b class="coin">💰${p.coins}</b>　<b class="spcount">スペル使用${p.spellsUsed}回</b>　配置：通常${p.summons}/1${p.extra ? `＋増援${p.extra}` : ''}${p.goblinSlots ? `＋ゴブリン${p.goblinSlots}` : ''}</div></div>
  <div class="bside">${pkp}${selp}<div class="panel desk-only logp"><b class="serif">戦況ログ</b><div class="log">${G.log.slice(0, 60).map(l => `<div>${esc(l)}</div>`).join('')}</div></div></div>
  <div class="bhand ${UI.hideHand ? 'hid' : ''}"><h3 style="margin:0 0 2px">${p.name}の手札（${p.hand.length}）${UI.hideHand ? '<span class="note">　非表示中</span>' : ''}</h3>${UI.hideHand ? '' : `<div class="hand">${hand}</div>`}</div>
  <div class="bshop"><div class="panel desk-only binfo"><b class="serif">自分（${p.name}）</b><div class="kv">山札${p.deck.length}／墓地${p.grave.length}／手札${p.hand.length}<br><b class="coin">💰${p.coins}</b>　<b class="spcount">スペル使用${p.spellsUsed}回</b><br>配置：通常${p.summons}/1${p.extra ? `＋増援${p.extra}` : ''}${p.goblinSlots ? `＋ゴブリン${p.goblinSlots}` : ''}</div><hr style="border:0;border-top:1px solid #3a4046"><b class="serif">相手（${o.name}）</b><div class="kv">山札${o.deck.length}／墓地${o.grave.length}／手札${o.hand.length}<br><b class="coin">💰${o.coins}</b>　<b class="spcount">スペル使用${o.spellsUsed}回</b></div></div>${shopHTML(p, G.phase === 'main' && !UI.busy && mineTurn)}</div></div>
  <details class="panel mob-only"><summary class="serif">ログ・山札 ${p.deck.length}枚・墓地 ${p.grave.length}枚・スペル使用 自${p.spellsUsed}／相${o.spellsUsed}</summary><div class="log">${G.log.slice(0, 40).map(l => `<div>${esc(l)}</div>`).join('')}</div></details>`;
  paintTh();
}
function unitDetail(u) {
  const c = CARDS[u.cid];
  const sts = statusList(u).map(k => `<button type="button" class="tag bad stbtn" data-st="${k}">${STATUS_ICON[k]} ${STATUS_NAME[k]}</button>`).join('') || '<span class="note">なし</span>';
  const desc = statusList(u).map(k => `<div class="note">${STATUS_DESC[k]}</div>`).join('');
  const buffs = [];
  if (u.dpBonus) buffs.push(`生贄によるDP+${u.dpBonus}`);
  if (G.lap && CARDS[u.cid].kind === 'char') buffs.push('二周目突入によるOP+3000');
  for (const b of u.buffs) buffs.push(`${b.k.toUpperCase()}+${b.amt}（一時）`);
  if (u.weapon) buffs.push(`装備：${CARDS[u.weapon].name}`);
  if (u.tk) for (const [k, n] of Object.entries(u.tk)) { const nm2 = { frenzy: '発狂：「狂乱」', ambush: '奇襲：「ふいうち」', chase: '追跡：「ハンティング」', mutate: '変異：斜め移動のみ' }[k]; if (nm2 && n >= G.players[u.owner].count) buffs.push(`${nm2}（${n === G.players[u.owner].count ? 'このターンのみ' : '次のターンのみ'}）`); }
  if (u.agile === G.turn) buffs.push('俊敏：配置したターンから移動できる');
  for (const a of u.attach) buffs.push(`${CARDS[a.cid].name}${a.since > G.players[u.owner].count ? '（次のターンから有効）' : ''}`);
  return `<b class="serif">${esc(c.name)}</b> <span class="note">（${G.players[u.owner].name}）</span><div class="kv"><span class="st-LP">LP ${u.lp}/${baseLP(u)}</span>　<span class="st-OP">OP ${OP(u)}</span>　<span class="st-DP">DP ${DP(u)}</span>　<span class="st-SC">SC ${u.sc}/${baseSC(u)}</span>　<span class="st-SpC">SpC ${u.spc}/${baseSpC(u)}</span>${baseRSpC(u) ? `　<span class="st-SpC">耐性SpC ${u.rspc || 0}/${baseRSpC(u)}</span><br><span class="note">耐性SpC：魔法耐性・超魔法耐性の支払い専用。SpCより先に使う。</span>` : ''}${armorTotal(u) ? `<br><span class="armor">装甲値 ${armorTotal(u)}（LPとは別の値。受けるダメージを先に肩代わりする）</span>` : ''}<br><b>状態異常</b> ${sts}${desc}<b>強化・装備</b> ${buffs.join('、') || 'なし'}<br><b>位置</b> ${coord(u.x, u.y)}　<b>領域</b> ${{ home: 'ホームテリトリー', border: 'ボーダーゾーン', enemy: 'エネミーテリトリー' }[terr(u)]}　${u.acted ? '<b>行動済</b>' : '未行動'}${u.placedAt === G.turn && !isAv(u) ? '　（配置したターン）' : ''}</div>${c.txt.map(t => `<p class="note">${esc(t)}</p>`).join('')}<div class="note">長押しでカード全体を表示</div>`;
}
function showDetail(cid, uid) {
  const el = $('#modal');
  let extra = '';
  if (uid && G && G.units[uid]) extra = `<div class="panel" style="max-width:300px">${unitDetail(G.units[uid])}</div>`;
  el.innerHTML = `<div class="mbox detail"><div class="mrow">${cardHTML(cid, { cls: 'full lg' })}${extra}</div><div class="bar" style="justify-content:flex-end"><button class="btn main" data-act="closeModal">閉じる</button></div></div>`;
  el.style.display = 'flex';
}
function shopHTML(p, can) {
  const items = shopItems();
  if (!items.length) return '';
  const row = (s, k) => `<div class="shoprow${s.sold ? ' sold' : ''}"><span class="n" data-card="${s.cid}">${esc(CARDS[s.cid].name)}<small>（R${CARDS[s.cid].rank}）</small></span><b>💰${s.price}</b><button class="btn sm" data-act="buy" data-k="${k}" ${!can || s.sold || p.coins < s.price || !canBuyRight(p) ? 'disabled' : ''}>${s.sold ? '売切' : '購入'}</button></div>`;
  const n = G.shop.length;
  return `<div class="panel shop"><b class="serif">🏪 アイテムショップ</b> <span class="note">所持💰${p.coins}</span><div class="note">購入権：${p.freeBuy > 0 ? '無料の購入権あり（1回）' : p.hand.includes('shopTicket') ? 'ショップチケット×' + p.hand.filter(c => c === 'shopTicket').length : '<span class="warn">なし（ショップチケットが必要）</span>'}</div>${G.shop.map((s, k) => row(s, k)).join('')}${G.shopUsed && G.shopUsed.length ? `<div class="note" style="margin-top:6px">売却品（売られたカード・買値。2往復で消えます）</div>${G.shopUsed.map((s, k) => row(s, n + k)).join('')}` : ''}<div class="note">ターンが1往復するたびに入れ替わります（共有・各1個）</div></div>`;
}
function showHandSheet(i) {
  const p = G.players[VW()], cid = p.hand[i]; if (!cid) return;
  const mineTurn = !ONL || G.active === ONL.me, can = G.phase === 'main' && !UI.busy && mineTurn;
  const el = $('#modal');
  el.innerHTML = `<div class="mbox"><div style="display:flex;justify-content:center">${cardHTML(cid, { cls: 'full lg' })}</div><div class="bar" style="justify-content:center"><button class="btn main" data-act="sheetPlay" data-i="${i}" ${can ? '' : 'disabled'}>使用 / 配置</button>${sellOf(cid) != null ? `<button class="btn" data-act="sheetSell" data-i="${i}" ${can && !p.sellUsed ? '' : 'disabled'}>売る（+${sellOf(cid)}）</button>` : ''}<button class="btn" data-act="closeModal">閉じる</button></div>${can ? '' : `<div class="note" style="text-align:center">${!mineTurn ? '相手のターンです' : 'メインステップのみ使用できます'}</div>`}</div>`;
  el.style.display = 'flex';
}
function showGrave(i) {
  const g = G.players[i].grave, el = $('#modal');
  el.innerHTML = `<div class="mbox"><h3>${G.players[i].name}の墓地（${g.length}枚）</h3><div class="grid">${g.map(c => cardHTML(c, { cls: 'sm' })).join('') || '<p class="note">墓地は空です</p>'}</div><div class="bar" style="justify-content:flex-end"><button class="btn main" data-act="closeModal">閉じる</button></div></div>`;
  el.style.display = 'flex';
}

/* ---------- 操作 ---------- */
async function guarded(fn) {
  if (UI.busy) return; UI.busy = true; UI.sel = null; UI.selHand = null;
  try { await fn(); } catch (e) { console.error(e); UI.toast('エラー：' + e.message); }
  UI.busy = false; if (G) afterAction();
}
function onCell(x, y) {
  if (!G || G.over) return;
  if (UI.pk) {
    const pk = UI.pk, k = x + ',' + y;
    if (!pk.o.cells.some(c => c[0] === x && c[1] === y)) return;
    if (!pk.o.multi) return finishPick([[x, y]]);
    const i = pk.sel.findIndex(c => c[0] === x && c[1] === y);
    if (i >= 0) pk.sel.splice(i, 1); else pk.sel.push([x, y]);
    return renderBattle();
  }
  if (UI.busy || G.phase === 'start') return;
  let t = at(x, y);
  const hMine = U().find(u => u.hidden && !u.dead && u.owner === VW() && u.x === x && u.y === y);
  if (hMine && (!t || t.owner !== VW() || t.hidden || UI.sel === t.uid)) t = hMine;
  if (UI.sel && G.units[UI.sel] && G.phase === 'action') {
    const u = G.units[UI.sel], mv = movesFor(u).find(m => m.x === x && m.y === y);
    if (mv && (!ONL || G.active === ONL.me)) return doAct({ t: 'move', uid: u.uid, x, y });
  }
  if (t && t.owner === VW()) {
    UI.sel = t.uid; UI.selHand = null; renderBattle();
    if (G.phase === 'main' && abU(t, 'throw') && (!ONL || G.active === ONL.me)) doAct({ t: 'throw', uid: t.uid });
    if (G.phase === 'main' && abU(t, 'moonReset') && (!ONL || G.active === ONL.me)) doAct({ t: 'moon', uid: t.uid });
  } else if (t && !t.hidden) { UI.sel = t.uid; UI.selHand = null; renderBattle(); }
  else { UI.sel = null; renderBattle(); }
}
function onClick(e) {
  SFX.unlock();
  if (e.target.closest && e.target.closest('[data-card]')) SFX.play('switch');
  const stEl = e.target.closest('[data-st]');
  if (stEl) { e.stopPropagation(); e.preventDefault(); lpFired = false; showStatus(stEl.dataset.st); return; }
  const kwEl = e.target.closest('[data-kw]');
  if (kwEl) { e.stopPropagation(); e.preventDefault(); lpFired = false; showKeyword(kwEl.dataset.kw); return; }
  if (lpFired) { lpFired = false; return; }
  { const md = $('#modal'); if (md && md.style.display !== 'none' && md.querySelector('.mbox.detail') && !e.target.closest('[data-act]')) { md.style.display = 'none'; return; } }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act;
  if (e.target.closest('[data-card]')) { /* カードに触れた音は上で鳴らし済み */ } else if (['hand', 'cell', 'sheetHand', 'grave'].includes(a)) SFX.play('select'); else if (['toAction', 'endTurn', 'play', 'pkok', 'buy', 'sell', 'sheetSell'].includes(a)) SFX.play('tick');
  switch (a) {
    case 'nav': screen = el.dataset.s; show(); break;
    case 'detail': showDetail(el.dataset.card); break;
    case 'sheetPlay': $('#modal').style.display = 'none'; doAct({ t: 'play', i: +el.dataset.i }); break;
    case 'udetail': $('#modal').style.display = 'none'; showDetail(G.units[+el.dataset.uid].cid, +el.dataset.uid); break;
    case 'goDeck': { const t = $('#deckpanel'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } break;
    case 'goPool': window.scrollTo({ top: 0, behavior: 'smooth' }); break;
    case 'closeModal': $('#modal').style.display = 'none'; break;
    case 'inc': { const id = el.dataset.id; B.list[id] = (B.list[id] || 0) + 1; renderBuilder(); break; }
    case 'dec': { const id = el.dataset.id; if (B.list[id] > 1) B.list[id]--; else delete B.list[id]; renderBuilder(); e.stopPropagation(); break; }
    case 'newDeck': B.id = null; B.name = '新しいデッキ'; B.list = {}; renderBuilder(); break;
    case 'dupDeck': B.id = null; B.name = ($('#dname').value || 'デッキ') + '（複製）'; renderBuilder(); break;
    case 'delDeck': if (B.id && confirm('このデッキを削除しますか？')) { userDecks = userDecks.filter(d => d.id !== B.id); saveDecks(); B.id = null; B.list = {}; B.name = '新しいデッキ'; renderBuilder(); } break;
    case 'saveDeck': saveDeckAs(false); break;
    case 'saveAs': saveDeckAs(true); break;
    case 'start': startBattle(); break;
    case 'cell': onCell(+el.dataset.x, +el.dataset.y); break;
    case 'hand': if (UI.pk || UI.busy || G.phase === 'start') break; if (MOB()) { showHandSheet(+el.dataset.i); break; } { const i = +el.dataset.i; if (UI.selHand === i && G.phase === 'main' && (!ONL || G.active === ONL.me)) doAct({ t: 'play', i }); else { UI.selHand = i; UI.sel = null; renderBattle(); } } break;
    case 'reveal': doAct({ t: 'reveal', uid: +el.dataset.uid }); break;
    case 'archer': doAct({ t: 'archer', uid: +el.dataset.uid }); break;
    case 'scout': doAct({ t: 'scout', uid: +el.dataset.uid }); break;
    case 'play': { const i = UI.selHand; if (i != null) doAct({ t: 'play', i }); } break;
    case 'sell': { const i = UI.selHand; if (i != null) { UI.selHand = null; doAct({ t: 'sell', i }); } } break;
    case 'sheetSell': $('#modal').style.display = 'none'; doAct({ t: 'sell', i: +el.dataset.i }); break;
    case 'buy': doAct({ t: 'buy', k: +el.dataset.k }); break;
    case 'pkok': if (UI.pk && (!UI.pk.o.validate || UI.pk.o.validate(UI.pk.sel))) finishPick(UI.pk.sel); break;
    case 'pkcancel': finishPick(null); break;
    case 'toAction': UI.selHand = null; doAct({ t: 'toAction' }); break;
    case 'endTurn': { const f = own(VW()).filter(mustMove); if (f.length) { UI.toast('必ず移動しなければならないキャラクターがいます：' + f.map(nm).join('、')); break; } doAct({ t: 'end' }); } break;
    case 'grave': showGrave(+el.dataset.i); break;
    case 'togHand': UI.hideHand = !UI.hideHand; if (UI.hideHand) UI.selHand = null; UI.render(); break;
    case 'giveup': localAsk(`${cur().name}が投了します。よろしいですか？`, ['投了する', 'やめる']).then(y => { if (y === '投了する') doAct({ t: 'giveup' }); }); break;
    case 'mkRoom': createRoom(); break;
    case 'joinRoom': joinRoom(($('#roomcode') || {}).value || ''); break;
    case 'leaveRoom': leaveLobby(); break;
    case 'lobReady': lobReady(); break;
  }
}
function startBattle() {
  const da = allDecks().find(d => d.id === PREP.a), db = allDecks().find(d => d.id === PREP.b);
  UI.pk = null; UI.sel = null; UI.selHand = null; UI.busy = false;
  newGame(mk(da.list), mk(db.list));
  screen = 'battle'; show();
  startTurn(0);
}
function show() {
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.s === screen));
  ({ cards: renderCards, builder: renderBuilder, prep: renderPrep, battle: renderBattle })[screen]();
}

/* ---------- 操作の実行（ローカル／オンライン共通） ---------- */
async function execEv(ev) {
  if (!G || G.over) return;
  switch (ev.t) {
    case 'play': await playHand(ev.i); break;
    case 'sell': sellCard(ev.i); break;
    case 'buy': buyShop(ev.k); break;
    case 'move': { const u = G.units[ev.uid]; const mv = u && movesFor(u).find(m => m.x === ev.x && m.y === ev.y); if (mv) await doMove(u, mv); break; }
    case 'throw': { const u = G.units[ev.uid]; if (u) await monkeyThrow(u); break; }
    case 'moon': { const u = G.units[ev.uid]; if (u) await moonReset(u); break; }
    case 'reveal': { const u = G.units[ev.uid]; if (u) await revealUnit(u); break; }
    case 'archer': { const u = G.units[ev.uid]; if (u) await archerShot(u); break; }
    case 'scout': { const u = G.units[ev.uid]; if (u) await scoutWatch(u); break; }
    case 'toAction': if (G.phase === 'main') G.phase = 'action'; break;
    case 'end': await endTurn(); break;
    case 'giveup': if (!G.over) { G.over = 1 - G.active; log(`${cur().name}が投了した`); } if (UI.gameOver) UI.gameOver(G.over); break;
  }
}
async function doAct(ev) {
  if (!G || G.over) return;
  if (!ONL) return guarded(() => execEv(ev));
  if (UI.busy || UI.pk || ONL.pending || G.active !== ONL.me) return;
  ONL.pending = true; UI.sel = null; UI.selHand = null;
  try { await writeEv(ev); } catch (e) { ONL.pending = false; UI.toast('送信に失敗しました。もう一度お試しください'); }
}

/* ---------- オンライン（PeerJS によるP2P通信：サーバー不要） ----------
   ・ホストが6桁の部屋番号を発行（PeerJSのIDは "taisen-bg-" + 部屋番号）
   ・ゲストがその番号を入力して接続（ブラウザ同士が直接つながる。最初の接続の取り次ぎだけ PeerJS の公開ブローカーを使う）
   ・全ての操作を「連番つきイベント」として互いに送り、両方のブラウザが同じ乱数の種で同じ順に再生するため、盤面は常に一致する */
const PEER_PREFIX = 'taisen-bg-';
let PEER = null, CONN = null, EARLY = {};
let LOBERR = '';
function lobErr(m) { LOBERR = m; if (screen === 'prep') renderPrep(); }
function loadPeerJS() {
  return new Promise((res, rej) => {
    if (window.Peer) return res();
    const urls = ['https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js', 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'];
    let i = 0;
    const next = () => {
      if (window.Peer) return res();
      if (i >= urls.length) return rej(new Error('PeerJSを読み込めませんでした'));
      const s = document.createElement('script'); s.src = urls[i++]; s.onload = () => (window.Peer ? res() : next()); s.onerror = next; document.head.appendChild(s);
    };
    next();
  });
}
function openPeer(id) {
  return new Promise((res, rej) => {
    let opened = false;
    const p = id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
    p.on('open', () => { opened = true; PEER = p; res(p); });
    p.on('error', e => { if (!opened) { try { p.destroy(); } catch (_) { } rej(e); } else UI.toast('通信エラー：' + (e.type || e.message)); });
    p.on('disconnected', () => { if (opened && !p.destroyed) { try { p.reconnect(); } catch (_) { } } });
    setTimeout(() => { if (!opened) { try { p.destroy(); } catch (_) { } rej({ type: 'timeout' }); } }, 15000);
  });
}
function closeNet() {
  try { CONN && CONN.close(); } catch (e) { }
  try { PEER && PEER.destroy(); } catch (e) { }
  CONN = null; PEER = null; EARLY = {};
}
const netSend = m => { try { if (CONN && CONN.open) CONN.send(m); } catch (e) { } };

/* --- イベントの送受信 --- */
function pushEv(ev) { if (ONL.waiters.length) ONL.waiters.shift()(ev); else ONL.queue.push(ev); }
function take() { return new Promise(res => { if (ONL.queue.length) res(ONL.queue.shift()); else ONL.waiters.push(res); }); }
function flushEv(o) { while (o.buf[o.recv + 1] !== undefined) { const e = o.buf[o.recv + 1]; delete o.buf[o.recv + 1]; o.recv++; pushEv(e); } }
function netEv(n, ev) { const o = ONL; if (!o) { EARLY[n] = ev; return; } if (n <= o.recv) return; o.buf[n] = ev; flushEv(o); }
async function writeEv(ev) {
  if (!CONN || !CONN.open) throw new Error('相手と接続されていません');
  const n = ONL.recv + 1; netSend({ k: 'ev', n, ev }); netEv(n, ev);
}
async function onlineInput(kind, who, localFn) {
  if (ONL.queue.length && ONL.queue[0].t === kind) return (await take()).v;
  if (who === ONL.me) {
    const v = await localFn();
    await writeEv({ t: kind, v: v === undefined ? null : v });
    return (await take()).v;
  }
  UI.wait = `${G.players[who].name}の入力を待っています…`; renderBattle();
  const ev = await take();
  UI.wait = null;
  return ev.v;
}
async function runLoop() {
  const me = ONL;
  while (ONL === me && !me.stop) {
    const ev = await take();
    if (ONL !== me || me.stop) break;
    me.pending = false; UI.busy = true; UI.wait = null;
    try { await execEv(ev); } catch (e) { console.error(e); UI.toast('エラー：' + e.message); }
    if (ONL !== me) break;
    UI.busy = false;
    if (G) afterAction();
  }
}

/* --- 接続の管理 --- */
function setupConn(conn) {
  conn.on('data', onNet);
  conn.on('close', () => onNetClose(conn));
  conn.on('error', () => onNetClose(conn));
}
function onNetClose(conn) {
  if (CONN !== conn) return;
  CONN = null;
  if (ONL && !ONL.stop) {
    if (!G || !G.over) { UI.wait = '相手との接続が切れました。もう一度対戦するには「部屋を出る」から入り直してください。'; UI.toast('相手との接続が切れました'); if (screen === 'battle') renderBattle(); }
  } else if (LOB && LOB.role === 'host' && LOB.room) {
    LOB.room.guest = false; LOB.room.guestReady = false; LOB.starting = false; if (screen === 'prep') renderPrep();
  } else if (LOB && LOB.role === 'guest') { lobErr('部屋の主との接続が切れました。'); LOB = null; renderPrep(); }
}
function onNet(m) {
  if (!m) return;
  if (m.k === 'ev') return netEv(m.n, m.ev);
  if (m.k === 'room' && LOB && LOB.role === 'guest') { LOB.room = m.room; onRoomChange(); return; }
  if (m.k === 'patch' && LOB && LOB.role === 'host') { LOB.room = Object.assign(LOB.room || {}, m.patch); netSend({ k: 'room', room: LOB.room }); onRoomChange(); return; }
  if (m.k === 'hello' && LOB && LOB.role === 'host' && LOB.room) { LOB.room.guest = true; netSend({ k: 'room', room: LOB.room }); if (screen === 'prep') renderPrep(); return; }
  if (m.k === 'full') { lobErr('その部屋はすでに満員です。'); closeNet(); LOB = null; renderPrep(); }
}
function roomUpdate(patch) {
  const L = LOB; if (!L) return;
  if (L.role === 'host') { L.room = Object.assign(L.room || {}, patch); netSend({ k: 'room', room: L.room }); onRoomChange(); }
  else netSend({ k: 'patch', patch });
}
function leaveOnline() {
  if (ONL) { ONL.stop = true; ONL = null; }
  closeNet(); LOB = null;
}

/* ---------- オンライン：部屋（ロビー） ---------- */
async function createRoom() {
  LOBERR = ''; closeNet();
  try { await loadPeerJS(); } catch (e) { return lobErr('通信ライブラリ（PeerJS）を読み込めませんでした。ネット接続を確認してください。'); }
  try {
    let ok = false;
    for (let k = 0; k < 8 && !ok; k++) {
      const code = String(100000 + Math.floor(Math.random() * 900000));
      try { await openPeer(PEER_PREFIX + code); ok = code; } catch (e) { if (e && e.type === 'unavailable-id') continue; throw e; }
    }
    if (!ok) return lobErr('部屋番号の確保に失敗しました。もう一度お試しください。');
    PEER.on('connection', conn => {
      if (CONN && CONN.open) { conn.on('open', () => { try { conn.send({ k: 'full' }); } catch (e) { } setTimeout(() => conn.close(), 400); }); return; }
      CONN = conn; setupConn(conn);
      const onOpen = () => { if (LOB && LOB.room) { LOB.room.guest = true; LOB.room.guestReady = false; netSend({ k: 'room', room: LOB.room }); if (screen === 'prep') renderPrep(); } };
      if (conn.open) onOpen(); else conn.on('open', onOpen);
    });
    enterLobby(ok, 'host');
  } catch (e) { lobErr('部屋を作れませんでした（' + ((e && (e.type || e.message)) || '不明') + '）。'); }
}
async function joinRoom(code) {
  LOBERR = ''; code = String(code).trim();
  if (!/^\d{6}$/.test(code)) return lobErr('6桁の部屋番号を入力してください。');
  closeNet();
  try { await loadPeerJS(); } catch (e) { return lobErr('通信ライブラリ（PeerJS）を読み込めませんでした。ネット接続を確認してください。'); }
  try {
    await openPeer(null);
    await new Promise((res, rej) => {
      const conn = PEER.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json' });
      const to = setTimeout(() => rej({ type: 'timeout' }), 15000);
      PEER.once('error', e => { clearTimeout(to); rej(e); });
      CONN = conn; setupConn(conn);
      conn.on('open', () => { clearTimeout(to); netSend({ k: 'hello' }); res(); });
    });
    enterLobby(code, 'guest');
  } catch (e) {
    closeNet();
    lobErr(e && e.type === 'peer-unavailable' ? 'その番号の部屋はありません。' : e && e.type === 'timeout' ? '接続できませんでした（時間切れ）。番号と、相手がまだ部屋を開いているかを確認してください。' : '入室できませんでした（' + ((e && (e.type || e.message)) || '不明') + '）。');
  }
}
function enterLobby(code, role) {
  LOB = { code, role, room: role === 'host' ? { created: Date.now(), guest: false, status: 'lobby', hostReady: false, guestReady: false } : null, deckId: PREP.a, starting: false, started: null };
  screen = 'prep'; show();
}
function leaveLobby() { if (ONL) return; closeNet(); LOB = null; renderPrep(); }
function onRoomChange() {
  const L = LOB, r = L && L.room; if (!r) { if (screen === 'prep') renderPrep(); return; }
  if (r.status === 'playing' && !ONL && L.started !== r.seed) { L.started = r.seed; startOnline(); return; }
  if (L.role === 'host' && r.status === 'lobby' && r.hostReady && r.guestReady && r.guest && !L.starting) {
    L.starting = true;
    roomUpdate({ status: 'playing', seed: 1 + Math.floor(Math.random() * 2147483000), seat0: Math.random() < .5 ? 'host' : 'guest' });
    return;
  }
  if (screen === 'prep' && !ONL) renderPrep();
}
async function lobReady() {
  const L = LOB; if (!L || !L.room) return;
  const r = L.room, role = L.role, key = role + 'Ready';
  if (r[key]) { roomUpdate({ [key]: false }); return; }
  const d = allDecks().find(d => d.id === L.deckId), v = validateDeck(d.list);
  if (v.err.length) return UI.toast('構築ルール違反のデッキでは対戦できません');
  const ids = Object.keys(d.list).sort().flatMap(k => Array(d.list[k]).fill(k));
  roomUpdate({ [role + 'Deck']: ids, [role + 'DeckName']: d.name, [key]: true });
}
const pubInfo = ids => { const m = {}; for (const id of ids || []) if (CARDS[id] && CARDS[id].rank >= 2 && CARDS[id].kind !== 'char') m[id] = (m[id] || 0) + 1; return Object.entries(m).map(([id, n]) => `${esc(CARDS[id].name)}${n > 1 ? '×' + n : ''}（R${CARDS[id].rank}）`).join('、') || 'なし'; };
function lobbyHTML() {
  if (!LOB) return `<h3 style="margin-top:22px">オンライン対戦</h3><div class="panel"><p class="note">「部屋をつくる」で表示される6桁の番号を相手に伝え、相手が同じ番号を入力して入室します。入室後に各自がデッキを選び、双方が「対戦可能」を押すと始まります。先行・後攻はランダムです。<br>※ 相手と同じページ（同じURL）を開いてください。通信はブラウザ同士の直接接続（P2P）で、サーバーは要りません。</p><div class="bar"><button class="btn main" data-act="mkRoom">部屋をつくる</button><span class="note">または</span><input type="text" id="roomcode" inputmode="numeric" maxlength="6" placeholder="部屋番号（6桁）" style="width:150px"><button class="btn" data-act="joinRoom">入室</button></div>${LOBERR ? `<div class="err">${esc(LOBERR)}</div>` : ''}</div>`;
  const r = LOB.room || {}, role = LOB.role, opp = role === 'host' ? 'guest' : 'host';
  const d = allDecks().find(d => d.id === LOB.deckId) || allDecks()[0], v = validateDeck(d.list), ready = !!r[role + 'Ready'];
  const myIds = Object.keys(d.list).flatMap(k => Array(d.list[k]).fill(k));
  const starting = r.status === 'playing';
  return `<h3 style="margin-top:22px">オンライン対戦　<span class="badge serif">部屋番号 ${esc(LOB.code)}</span></h3><div class="mrow">
  <div class="panel" style="min-width:300px"><b>あなた（${role === 'host' ? '部屋の主' : '入室者'}）</b><br><select data-sel="lob.deck" ${ready ? 'disabled' : ''}>${allDecks().map(x => `<option value="${x.id}" ${x.id === LOB.deckId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
  <div class="note">${deckSize(d.list)}枚　R1:${v.r[0]} R2:${v.r[1]} R3:${v.r[2]}</div>${v.err.map(e => `<div class="err">✖ ${esc(e)}</div>`).join('')}
  <div class="note">相手に公開される情報（キャラ以外のランク2以上）：${pubInfo(myIds)}</div>
  <div class="bar"><button class="btn ${ready ? '' : 'main'}" data-act="lobReady" ${starting || (!ready && v.err.length) ? 'disabled' : ''}>${ready ? '✔ 対戦可能（クリックで取り消し）' : '対戦可能'}</button></div></div>
  <div class="panel" style="min-width:300px"><b>相手</b><br>${r[opp] ? (r[opp + 'Ready'] ? `<span class="ok">✔ 対戦可能</span><div class="note">デッキ：${esc(r[opp + 'DeckName'] || '')}</div><div class="note">公開情報（キャラ以外のランク2以上）：${pubInfo(r[opp + 'Deck'])}</div>` : '<span class="warn">入室済み・デッキ選択中…</span>') : '<span class="note">相手の入室を待っています…</span>'}</div></div>
  <p class="note">${starting ? '対戦を開始します…' : '双方が「対戦可能」を押すと、先行・後攻がランダムに決まって開始します。'}</p><div class="bar"><button class="btn danger" data-act="leaveRoom" ${starting ? 'disabled' : ''}>部屋を出る</button></div>`;
}

async function startOnline() {
  const L = LOB, r = L.room;
  const seat = r.seat0 === L.role ? 0 : 1;
  const d0 = r.seat0 === 'host' ? r.hostDeck : r.guestDeck, d1 = r.seat0 === 'host' ? r.guestDeck : r.hostDeck;
  const me = { code: L.code, me: seat, queue: [], waiters: [], recv: 0, buf: Object.assign({}, EARLY), pending: false, stop: false, seed: r.seed, got: true };
  EARLY = {};
  ONL = me;
  seedRng(r.seed);
  UI.pk = null; UI.sel = null; UI.selHand = null; UI.busy = true; UI.wait = null; UI.overShown = false;
  newGame(d0.slice(), d1.slice());
  screen = 'battle'; show();
  UI.toast(`あなたは${seat === 0 ? '先行' : '後攻'}です`);
  await startTurn(0);
  UI.busy = false;
  flushEv(me);
  runLoop();
}

/* ---------- イベント ---------- */
let lpTimer = null, lpFired = false;
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('[data-card]'); if (!el) return;
  lpFired = false; clearTimeout(lpTimer);
  lpTimer = setTimeout(() => { lpFired = true; showDetail(el.dataset.card, el.dataset.uid); }, 500);
});
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => document.addEventListener(ev, () => clearTimeout(lpTimer)));
document.addEventListener('scroll', () => clearTimeout(lpTimer), true);
document.addEventListener('contextmenu', e => { const el = e.target.closest('[data-card]'); if (el) { e.preventDefault(); lpFired = false; showDetail(el.dataset.card, el.dataset.uid); } });
document.addEventListener('click', onClick);
document.addEventListener('change', e => {
  const s = e.target.dataset.sel; if (!s) return;
  const v = e.target.value;
  if (s === 'loadDeck') { if (v) { loadDeck(v); renderBuilder(); } return; }
  if (s === 'prep.a') { PREP.a = v; renderPrep(); return; }
  if (s === 'prep.b') { PREP.b = v; renderPrep(); return; }
  if (s === 'lob.deck') { if (LOB) { LOB.deckId = v; renderPrep(); } return; }
  const [sc, k] = s.split('.');
  if (sc === 'F') { F[k] = v; renderCards(); } else { B.F[k] = v; renderBuilder(); }
});
document.addEventListener('input', e => {
  const s = e.target.dataset.in;
  if (s === 'F.q') { F.q = e.target.value; fillGrid(); }
  else if (s === 'BF.q') { B.F.q = e.target.value; fillPool(); }
  else if (e.target.id === 'dname') B.name = e.target.value;
});
document.querySelectorAll('nav button').forEach(b => b.dataset.act = 'nav');
{ const sb = document.getElementById('sfxbtn'); if (sb) { const paint = () => { sb.textContent = SFX.on ? '🔊' : '🔇'; }; paint(); sb.onclick = e => { e.stopPropagation(); SFX.set(!SFX.on); paint(); SFX.play('select'); }; } }
show();
