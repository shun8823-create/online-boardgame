/* ---------- パソコン専用：操作を減らす補助 ---------- */
function fitBoard() { // パソコン：盤が画面に収まるようマスの大きさを自動調整（スクロール不要に）
  if (!PCV() || screen !== 'battle') return;
  const b = document.querySelector('.battle'), c = document.querySelector('.board .cell'), bm = document.querySelector('.bmain'), sd = document.querySelector('.bside'); if (!b || !c || !bm) return;
  if (sd) { document.documentElement.style.setProperty('--sideh', Math.max(300, window.innerHeight - sd.getBoundingClientRect().top - 12) + 'px'); const hg = sd.querySelector('.hgrid'); if (hg) document.documentElement.style.setProperty('--hz', Math.max(0.3, ((hg.clientWidth - 18) / 4) / 190).toFixed(3)); hg.style.minHeight = ''; const pr = document.createElement('div'); pr.className = 'hcard'; pr.style.cssText = `visibility:hidden;position:absolute;width:${(hg.clientWidth - 18) / 4}px`; pr.innerHTML = cardHTML(Object.keys(CARDS)[0], { cls: 'sm' }); hg.appendChild(pr); const ch = pr.getBoundingClientRect().height; pr.remove(); if (ch > 20) hg.style.minHeight = (ch * 2 + 6).toFixed(1) + 'px'; } // 手札が1段でも、手札欄は縦2段分の高さに固定（戦況ログの大きさを一定に）
  b.style.removeProperty('--cs'); let cs = c.getBoundingClientRect().height;
  for (let k = 0; k < 4; k++) {
    const over = bm.lastElementChild.getBoundingClientRect().bottom + 20 - window.innerHeight; if (Math.abs(over) <= 3) break;
    const n = Math.max(36, Math.min(150, cs - over / 7)); if (Math.abs(n - cs) < 0.5) break; cs = n; b.style.setProperty('--cs', cs.toFixed(1) + 'px');
  }
}
function selPreview() { // 手札を選んでいる間、マウスが外れても選択中カードの詳細を左上に表示
  const hp = document.getElementById('hovp'); if (!PCV() || !G || !hp || hp.dataset.k || UI.selHand == null || UI.pk) return;
  const cid = G.players[VW()].hand[UI.selHand]; if (!cid) return;
  hp.dataset.k = 's' + UI.selHand; hp.innerHTML = `<div class="panel">${cardHTML(cid, { cls: 'full' })}</div>`; if (hp.parentElement) hp.parentElement.classList.add('hov');
}
window.addEventListener('resize', () => { try { fitBoard(); } catch (e) { } });
function pcEnhance() {
  document.querySelectorAll('.hpop').forEach(e => e.remove());
  if (PCV() && G) { const sh = document.querySelector('.bshop'); if (sh && !sh.querySelector('.kbdp')) sh.insertAdjacentHTML('beforeend', '<div class="panel desk-only kbdp"><b>⌨ キーボード操作</b><br><kbd>1</kbd>〜<kbd>8</kbd> 表示中の手札を選ぶ　<kbd>←</kbd><kbd>→</kbd> 手札のページ<br><kbd>Enter</kbd> 使用／配置<br><kbd>A</kbd> アクションステップへ　<kbd>E</kbd> ターン終了<br><kbd>Esc</kbd> 取り消し<br>確認ダイアログは <kbd>1</kbd><kbd>2</kbd>…／<kbd>Enter</kbd><br>右クリックで詳細、ダブルクリックで使用。空きマス長押しで盤を拡大</div>'); try { fitBoard(); selPreview(); } catch (e) { } }
  if (!PCV() || !G || UI.pk || UI.selHand == null) return;
  const p = G.players[VW()], cid = p.hand[UI.selHand], sel = document.querySelector('.hcard.sel'); if (!cid || !sel) return;
  const mt = !ONL || G.active === ONL.me, okm = G.phase === 'main' && !UI.busy && mt;
  const d = document.createElement('div'); d.className = 'hpop';
  d.innerHTML = `<button class="btn main" data-act="play" ${okm ? '' : 'disabled'}>使用 / 配置</button>${sellOf(cid) != null ? `<button class="btn" data-act="sell" ${okm && !p.sellUsed && !(G.opt && G.opt.noShop) ? '' : 'disabled'}>売る（+${sellOf(cid)}）</button>` : ''}<span class="note">${!mt ? '相手のターンです' : G.phase === 'main' ? 'ダブルクリックでも使用' : 'メインステップのみ使用可'}</span>`;
  document.body.appendChild(d);
  const r = sel.getBoundingClientRect(); d.style.left = Math.max(8, Math.min(r.left, window.innerWidth - d.offsetWidth - 8)) + 'px'; const hpn = document.querySelector('.handp'); d.style.bottom = (window.innerHeight - (hpn ? hpn.getBoundingClientRect().top : r.top) + 6) + 'px';
}
function hoverPreview(e) {
  if (!PCV() || !G || screen !== 'battle') return;
  const hp = document.getElementById('hovp'); if (!hp) return;
  let html = '';
  const h = e.target.closest && e.target.closest('.hcard'), c = e.target.closest && e.target.closest('.cell');
  if (h) { const cid = G.players[VW()].hand[+h.dataset.i]; if (cid) html = cardHTML(cid, { cls: 'full' }); }
  else if (c) {
    const x = +c.dataset.x, y = +c.dataset.y; let t = at(x, y);
    const hm = U().find(q => q.hidden && !q.dead && q.owner === VW() && q.x === x && q.y === y); if (hm && (!t || t.hidden)) t = hm;
    if (t && (!t.hidden || t.owner === VW())) html = unitDetail(t);
  }
  const key = html ? (h ? 'h' + h.dataset.i : 'c' + c.dataset.x + c.dataset.y) : '';
  if (hp.dataset.k === key) return; hp.dataset.k = key;
  hp.innerHTML = html ? `<div class="panel">${html}</div>` : '';
  const side = hp.parentElement; if (side) side.classList.toggle('hov', !!html);
  if (!html) selPreview();
}
document.addEventListener('mouseover', hoverPreview);
document.addEventListener('mouseout', e => { if (!e.relatedTarget || !(e.relatedTarget.closest && e.relatedTarget.closest('.hcard,.cell'))) { const hp = document.getElementById('hovp'); if (hp && hp.dataset.k) { hp.dataset.k = ''; hp.innerHTML = ''; hp.parentElement.classList.remove('hov'); selPreview(); } } });
document.addEventListener('dblclick', e => { if (!PCV() || !e.target.closest('.hcard')) return; const b = document.querySelector('.hpop [data-act=play]:not([disabled])'); if (b) b.click(); });
document.addEventListener('keydown', e => {
  if (!PCV() || !G || screen !== 'battle') return;
  const t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  const dl = document.getElementById('dlg'), mo = document.getElementById('modal'), modalOpen = mo && mo.style.display === 'flex';
  if (dl && dl.style.display === 'flex' && !e.ctrlKey && !e.metaKey && !e.altKey) { // 確認ダイアログ：数字キーで選択、Enterで既定
    const bs = [...dl.querySelectorAll('.dbtn button[data-i]')];
    if (bs.length && !dl.querySelector('.pickbox')) { if (/^[1-9]$/.test(e.key) && bs[+e.key - 1]) { e.preventDefault(); bs[+e.key - 1].click(); } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (dl.querySelector('.dbtn button.main[data-i]') || bs[0]).click(); } }
    return;
  }
  if (!modalOpen && !UI.pk && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const k = e.key.toLowerCase(), click = s => { const b = document.querySelector(s); if (b && !b.disabled) { e.preventDefault(); b.click(); return true; } return false; };
    if (/^[1-8]$/.test(k)) { const hc = document.querySelectorAll('.hcard')[+k - 1]; if (hc) { e.preventDefault(); hc.click(); } return; }
    if (k === 'arrowleft') { click('[data-act=hpage][data-d="-1"]'); return; }
    if (k === 'arrowright') { click('[data-act=hpage][data-d="1"]'); return; }
    if (k === 'enter') { click('.hpop [data-act=play]'); return; }
    if (k === 'a') { click('[data-act=toAction]'); return; }
    if (k === 'e') { click('[data-act=endTurn]'); return; }
  }
  if (e.key === 'Escape') {
    { const bf = document.getElementById('bfull'); if (bf) { bf.remove(); return; } }
    const m = document.getElementById('modal');
    if (m && m.style.display === 'flex') { m.style.display = 'none'; return; }
    if (UI.pk) { if (UI.pk.o.cancellable !== false) finishPick(null); return; }
    if (UI.selHand != null || UI.sel) { UI.selHand = null; UI.sel = null; renderBattle(); }
  } else if (e.key === 'Enter' && UI.pk && UI.pk.o.multi && (!UI.pk.o.validate || UI.pk.o.validate(UI.pk.sel))) { e.preventDefault(); finishPick(UI.pk.sel); }
});
function eqBtns(u) {
  const ids = [...new Set([...wps(u), ...u.attach.map(a => a.cid)].filter(Boolean))];
  return ids.length ? `<div class="eqrow">${ids.map(id => `<button type="button" class="btn sm eqb" data-act="eqdetail" data-wcid="${id}" data-uid="${u.uid}">${CARDS[id].kind === 'item' ? '⚔' : '✦'} ${esc(CARDS[id].name)}　カードを見る ▶</button>`).join('')}</div>` : '';
}
function unitDetail(u) {
  const c = CARDS[u.cid];
  const sts = statusList(u).map(k => `<button type="button" class="tag bad stbtn" data-st="${k}">${STATUS_ICON[k]} ${STATUS_NAME[k]}</button>`).join('') || '<span class="note">なし</span>';
  const desc = statusList(u).map(k => `<div class="note">${STATUS_DESC[k]}</div>`).join('');
  const buffs = [];
  if (u.dpBonus) buffs.push(`生贄によるDP+${u.dpBonus}`);
  if (u.adapt && u.adapt.length) buffs.push(`適応で得た属性：${u.adapt.join('・')}`);
  if (G.lap && CARDS[u.cid].kind === 'char') buffs.push('二周目突入：「狂乱」を得る・移動のSC-1');
  for (const b of u.buffs) buffs.push(`${b.k.toUpperCase()}+${b.amt}（一時）`);
  if (u.weapon) buffs.push(`装備：${wps(u).map(c => CARDS[c].name).join('・')}`);
  if (dualPen(u)) buffs.push('盾と他の武器を同時装備：移動のSC+1');
  if (armorDual(u)) buffs.push('鎧と他の武器を同時装備：ターン終了時のSC回復-1');
  if (hasSA(u) && CARDS[u.cid].spc >= 2) buffs.push('盾・鎧の装備：元のSpCが1まで下がる');
  if (resistMax(u) > 1 && !abU(u, 'superResist')) buffs.push(`魔法耐性${resistMax(u)}（1ターンに${resistMax(u)}回）`);
  if (wps(u).length && abU(u, 'heroDiag') && !u.diagUsed) buffs.push('斜め移動可（ゲーム中1回）');
  if (u.tk) for (const [k, ns] of Object.entries(u.tk)) { const c0 = G.players[u.owner].count, now = ns.includes(c0), nxt = ns.includes(c0 + 1), later = ns.some(n => n > c0 + 1); const nm2 = { frenzy: '発狂：「狂乱」', ambush: '奇襲：「ふいうち」', chase: '追跡：「ハンティング」', mutate: '変異：斜め移動のみ' }[k]; if (nm2 && (now || nxt || later)) buffs.push(`${nm2}（${[now ? 'このターン' : '', nxt ? '次のターン' : '', later ? 'その先のターン' : ''].filter(Boolean).join('と')}）`); }
  if (u.agile === G.turn) buffs.push('俊敏：配置したターンから移動できる');
  if (u.k2 && abC(u.cid, 'knightCmd')) buffs.push('騎士団長：行動回数2回（1ターンに2回移動すると1回に戻る）');
  for (const a of u.attach) buffs.push(`${CARDS[a.cid].name}${a.since > G.players[u.owner].count ? '（次のターンから有効）' : ''}`);
  return `<b class="serif">${esc(c.name)}</b> <span class="note">（${G.players[u.owner].name}）</span><div class="kv"><span class="st-LP">LP ${u.lp}/${baseLP(u)}</span>　<span class="st-OP">OP ${OP(u)}</span>　<span class="st-DP">DP ${DP(u)}</span>　<span class="st-SC">SC ${u.sc}/${baseSC(u)}</span>　<span class="st-SpC">SpC ${u.spc}/${baseSpC(u)}</span>${isAv(u) ? `　<span class="note">移動 残り${avLeft(u)}/${avMax(u)}回</span>` : ''}${baseRSpC(u) ? `　<span class="st-SpC">耐性SpC ${u.rspc || 0}/${baseRSpC(u)}</span><br><span class="note">耐性SpC：魔法耐性・超魔法耐性の支払い専用。SpCより先に使う。</span>` : ''}${armorTotal(u) ? `<br><span class="armor">装甲値 ${armorTotal(u)}（LPとは別の値。受けるダメージを先に肩代わりする）</span>` : ''}<br><b>状態異常</b> ${sts}${desc}<br><b>強化・装備</b> ${buffs.join('、') || 'なし'}${eqBtns(u)}<br><b>位置</b> ${coord(u.x, u.y)}　<b>領域</b> ${{ home: 'ホームテリトリー', border: 'ボーダーゾーン', enemy: 'エネミーテリトリー' }[terr(u)]}　${u.acted ? '<b>行動済</b>' : '未行動'}${u.placedAt === G.turn && !isAv(u) ? '　（配置したターン）' : ''}</div>${c.txt.map(t => `<p class="note">${esc(t)}</p>`).join('')}<div class="note">長押しでカード全体を表示</div>`;
}
function showDetail(cid, uid, backUid) {
  const el = $('#modal');
  let extra = '';
  if (uid && G && G.units[uid]) extra = `<div class="panel" style="max-width:300px">${unitDetail(G.units[uid])}</div>`;
  el.innerHTML = `<div class="mbox detail"><div class="mrow">${cardHTML(cid, { cls: 'full lg' + (uid && G && G.units[uid] ? ' own' + G.units[uid].owner : '') })}${extra}</div><div class="bar" style="justify-content:flex-end">${backUid && G.units[backUid] ? `<button class="btn" data-act="udetail" data-uid="${backUid}">◀ ${esc(CARDS[G.units[backUid].cid].name)}に戻る</button>` : ''}<button class="btn main" data-act="closeModal">閉じる</button></div></div>`;
  el.style.display = 'flex';
}
function shopHTML(p, can) {
  if (G.opt && G.opt.noShop) return '<div class="panel shop"><b class="serif">🏪 アイテムショップ</b><div class="note warn">このステージではショップは使えません（売る・買うはできません）</div></div>';
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
function showFoeR2() { // 相手デッキのランク2のカード（キャラ以外）。手札にあるかどうかは分からない
  const o = G.players[1 - VW()], cnt = {}; o.deckList.forEach(c => { if (CARDS[c].kind !== 'char' && CARDS[c].rank === 2) cnt[c] = (cnt[c] || 0) + 1; });
  const ids = Object.keys(cnt), el = $('#modal');
  el.innerHTML = `<div class="mbox"><h3>${esc(o.name)}のデッキのランク2カード（キャラ以外）</h3><p class="note">デッキに入っているカードの一覧です。いま手札にあるか、山札・墓地のどこにあるかは分かりません。</p><div class="grid">${ids.map(c => `<div style="position:relative">${cardHTML(c, { cls: 'sm' })}<b class="badge" style="position:absolute;right:2px;top:2px">×${cnt[c]}</b></div>`).join('') || '<p class="note">キャラ以外のランク2カードは入っていません</p>'}</div><div class="bar" style="justify-content:flex-end"><button class="btn main" data-act="closeModal">閉じる</button></div></div>`;
  el.style.display = 'flex';
}
function showGrave(i) {
  const g = G.players[i].grave, el = $('#modal');
  el.innerHTML = `<div class="mbox"><h3>${G.players[i].name}の墓地（${g.length}枚）</h3><div class="grid">${g.map(c => cardHTML(c, { cls: 'sm' })).join('') || '<p class="note">墓地は空です</p>'}</div><div class="bar" style="justify-content:flex-end"><button class="btn main" data-act="closeModal">閉じる</button></div></div>`;
  el.style.display = 'flex';
}

