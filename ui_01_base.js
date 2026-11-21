'use strict';
/* ===== UI ===== */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let screen = 'cards';
const MOB = () => window.matchMedia && window.matchMedia('(max-width:700px)').matches;
const PCV = () => !MOB() && window.innerWidth > 1000; // パソコン表示（操作を減らす専用UI）
let ONL = null, LOB = null;
const VW = () => (ONL ? ONL.me : G.active);
let userDecks = [];
/* ===== 保存層 Store（localStorage の薄い包み。失敗を検知して警告し、同一セッション内はメモリにも保持する） ===== */
const Store = (() => {
  const mem = {}; let failed = false, warned = false;
  const warn = () => { failed = true; if (warned) return; warned = true; try { if (typeof UI !== 'undefined' && UI.toast) UI.toast('⚠ ブラウザへの保存に失敗しました（容量不足・プライベートモード等）。このままだと閉じるとデータが消えます。「バックアップ」で書き出してください。'); } catch (e) { } };
  return {
    get(k) { if (k in mem) return mem[k]; try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); delete mem[k]; return true; } catch (e) { mem[k] = v; warn(); return false; } },
    remove(k) { delete mem[k]; try { localStorage.removeItem(k); return true; } catch (e) { return false; } },
    getJSON(k, def) { try { const v = this.get(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    setJSON(k, o) { return this.set(k, JSON.stringify(o)); },
    keys(prefix) { const r = new Set(Object.keys(mem)); try { for (let i = 0; i < localStorage.length; i++) r.add(localStorage.key(i)); } catch (e) { } return [...r].filter(k => !prefix || k.startsWith(prefix)); },
    failed: () => failed,
    available() { try { const k = '__bg_probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; } },
  };
})();
try { userDecks = JSON.parse(Store.get('bgDecks_v1') || '[]'); } catch (e) { }
const saveDecks = () => { Store.set('bgDecks_v1', JSON.stringify(userDecks)); };
const allDecks = () => PRESETS.concat(userDecks);
const CARD_IDS = Object.keys(CARDS).filter(k => k !== 'avatar');
const DECK_IDS = CARD_IDS.filter(k => !CARDS[k].token);
const RACES = [...new Set(CARD_IDS.map(k => CARDS[k].race).filter(Boolean))];
const KIND_ORDER = { char: 0, spell: 1, item: 2, tech: 3 };
const F = { kind: 'all', rank: 'all', race: 'all', attr: 'all', q: '' };
const B = { id: null, name: '新しいデッキ', list: {}, F: { kind: 'all', rank: 'all', race: 'all', attr: 'all', q: '' } };
const PREP = { a: 'p_oudo', b: 'p_gob', me: 'p_oudo', ai: 'p_gob', seat: 0 };
const STATUS_ICON = { burn: '🔥', chill: '❄', frost: '🧊', poison: '☠', venom: '☠☠', petrify: '🪨', paralyze: '⚡' };
const STATUS_DESC = { paralyze: 'まひ：1ターンにSCを1つしか使えない（2回行動でも2回目の行動はできない）', burn: 'やけど：回復効果のLP増加が750減る', chill: 'しもやけ：回復効果のLP増加が500減る', frost: '凍傷：回復効果のLP増加が1000減り、LPが2000下がる（ターン終了時に回復しない）', poison: '毒：LP-500・SC-1（ターン終了時に回復しない）', venom: '猛毒：LP-1500・SC-2（ターン終了時に回復しない）', petrify: '石化：SC・SpCを消費する行動や効果を使えない' };

function cardSort(a, b) { const A = CARDS[a], Bc = CARDS[b]; return KIND_ORDER[A.kind] - KIND_ORDER[Bc.kind] || A.rank - Bc.rank || A.name.localeCompare(Bc.name, 'ja'); }
function filterIds(f, deck) {
  return (deck ? DECK_IDS : CARD_IDS).filter(id => {
    const c = CARDS[id];
    if (f.kind !== 'all' && c.kind !== f.kind) return false;
    if (f.rank !== 'all' && String(c.rank) !== f.rank) return false;
    if (f.race !== 'all' && c.race !== f.race) return false;
    if (f.attr && f.attr !== 'all' && !cardAttrs(id).includes(f.attr)) return false;
    if (f.q && !(c.name + c.txt.join('') + (c.cond || '') + (c.cat || '') + (c.race || '') + cardAttrs(id).join('') + '属性').includes(f.q)) return false;
    return true;
  }).sort(cardSort);
}
/* 「」つきの効果（キーワード能力）：カード面には名前だけを出し、タップで詳しい解説を見られる */
const KEYWORDS = ['庇護', '生贄', '狂乱', '魔法耐性', '超魔法耐性', '焼却', '飛翔', '再生', '超再生', '潜伏', '弓使い', '警戒', '月光', '投擲', '超範囲', 'カウンター', 'スペルドロー', 'スペルコレクト', 'ハンティング', 'アサシン', 'ふいうち', '装甲値', '剣士', '光属性', '水棲', 'エレメンタルコレクト', 'ヒール', 'キュア・ディジーズ', 'ホーリーメール', '魔法耐性2', 'エンジェル', 'エンジェルカウント', 'エンジェルポイント'];
function kwOf(t) {
  const r = /^([^：（]{1,10})(（[^）]*）)?：/.exec(t);
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
const GLOSS_WORDS = ['超魔法耐性', '魔法耐性', '焼却', '剣士'];
const inlKw = s => s.replace(/「([^」<]{1,12})」/g, (m, w) => (!(w in ST_WORDS) && (GLOSS_WORDS.includes(w) || (KEYWORDS.includes(w) && glossBody(w).length)) ? `<button type="button" class="kw stk" data-kg="${w}">「${w}」</button>` : m)).replace(/光属性/g, '<button type="button" class="kw stk" data-kg="光属性">光属性</button>');
function glossBody(k) { // 説明が書いてある最初のカードから「k：…」の行を集める
  for (const id in CARDS) { const ls = CARDS[id].txt.filter(t => t.startsWith(k + '：') || t.startsWith(k + '（')).map(t => t.slice(t.indexOf('：') + 1)); if (ls.length) return ls; }
  return [];
}
function showGloss(k) {
  const ls = glossBody(k); if (!ls.length) return;
  let el = document.getElementById('kwpop'); if (!el) { el = document.createElement('div'); el.id = 'kwpop'; document.body.appendChild(el); }
  el.innerHTML = `<div class="kwbox"><div class="kwt">「${esc(k)}」</div>${ls.map(l => `<div class="kwd">${esc(l)}</div>`).join('')}<div class="note">（どこかをタップして閉じる）</div></div>`;
  el.style.display = 'flex'; el.onclick = () => { el.style.display = 'none'; };
}
const chipH = (cls, label, v) => `<span class="chip ${cls}">${label} ${v}</span>`;
function cardHTML(cid, o = {}) {
  const c = CARDS[cid];
  let type = c.kind === 'char' || c.kind === 'avatar' ? `${c.cat}／${c.race || '—'}${c.kind === 'char' && charAttrs(cid).length ? '／' + charAttrs(cid).join('・') + '属性' : ''}` : c.kind === 'spell' ? `スペル${c.equip ? '／装備魔法' : ''}${c.attr ? '／' + c.attr + '属性' : ''}${c.wide ? '／超範囲' : ''}` : c.kind === 'item' ? (c.weapon ? 'アイテム（武器）' : 'アイテム') : (c.token ? 'テクニック（奥義）' : 'テクニック');
  let stats = '';
  if (c.kind === 'char' || c.kind === 'avatar') stats = chipH('lp', 'LP', c.lp) + chipH('op', 'OP', c.op) + chipH('dp', 'DP', c.dp) + chipH('sc', 'SC', c.sc) + chipH('spc', 'SpC', c.spc) + (c.rspc ? chipH('spc', '耐性SpC', c.rspc) : '');
  else if (c.cost) stats = chipH('cost', '消費', c.cost);
  if (c.kind === 'item' && c.sell != null) stats += chipH('sell', '売値', c.sell === 0 && !c.noSell ? 0 : c.sell);
  let text = '';
  if (c.cond) text += `<div class="c-cond"><b>発動条件</b> ${esc(c.cond)}</div>`;
  text += c.txt.map((t, i) => { const k = kwOf(t); return k ? `<p class="kwp"><button type="button" class="kw" data-kw="${cid}|${i}">「${esc(k)}」</button></p>` : `<p>${inlKw(stTxt(esc(t)))}</p>`; }).join('');
  const attrs = (o.uid ? ` data-uid="${o.uid}"` : '');
  return `<div class="card ${c.angel ? 'rankA' : 'rank' + c.rank} k-${c.kind} ${o.cls || ''}" data-card="${cid}"${attrs}><div class="c-head"><span class="c-name">${esc(c.name)}</span><span class="c-rank">${c.angel ? 'AC' + c.ac : 'R' + c.rank}</span></div><div class="c-art${artImgUrl(cid) ? ' img' : ''}">${artSVG(cid)}</div><div class="c-type">${esc(type)}</div><div class="c-text">${text}</div><div class="c-stats">${stats}</div></div>`;
}
const ATTRS = ['火', '水', '風', '土', '雷', '雪', '光', '闇'].filter(a => CARD_IDS.some(id => cardAttrs(id).includes(a))).concat([...new Set(CARD_IDS.flatMap(id => cardAttrs(id)))].filter(a => !['火', '水', '風', '土', '雷', '雪', '光', '闇'].includes(a)));
function filterBar(f, scope) {
  const sel = (key, opts) => `<select data-sel="${scope}.${key}">${opts.map(([v, l]) => `<option value="${v}" ${f[key] === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  return `<div class="bar">${sel('kind', [['all', 'すべての種類'], ['char', 'キャラクター'], ['spell', 'スペル'], ['item', 'アイテム'], ['tech', 'テクニック']])}${sel('rank', [['all', 'すべてのランク'], ['1', 'ランク1'], ['2', 'ランク2'], ['3', 'ランク3']])}${sel('race', [['all', 'すべての種族'], ...RACES.map(r => [r, r])])}${sel('attr', [['all', 'すべての属性'], ...ATTRS.map(a => [a, a + '属性'])])}<input type="search" placeholder="名前・能力で検索" value="${esc(f.q)}" data-in="${scope}.q"></div>`;
}

