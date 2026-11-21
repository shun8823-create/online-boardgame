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
  <button class="btn" data-act="newDeck" ${deckLocked() ? 'disabled' : ''}>新規</button><button class="btn" data-act="dupDeck" ${deckLocked() ? 'disabled' : ''}>複製</button><button class="btn danger" data-act="delDeck" ${B.id && !deckLocked() ? '' : 'disabled'}>削除</button></div>${deckLocked() ? '<div class="note warn">対戦中のため、デッキの作成・保存・削除はできません（対戦を終えると使えます）。</div>' : ''}
  <div class="builder"><div><div class="minibar mob-only"><b class="${deckSize(B.list) === 30 && !v.err.length ? 'ok' : 'err'}">${deckSize(B.list)}/30枚${v.err.length ? '　✖' + v.err.length : ''}</b><span class="note">R1:${v.r[0]} R2:${v.r[1]} R3:${v.r[2]}</span><button class="btn sm" data-act="goDeck">デッキ確認・保存 ↓</button></div><h3>カードプール</h3>${filterBar(B.F, 'BF')}<p class="note">タップで1枚追加。「−」で削除。長押しで効果の全体表示。</p><div class="grid" id="pool"></div></div>
  <div><div class="panel sticky" id="deckpanel"><button class="btn sm mob-only" data-act="goPool" style="margin-bottom:6px">↑ カードを追加する</button><input type="text" id="dname" value="${esc(B.name)}" style="width:100%;margin-bottom:8px" placeholder="デッキ名">
  <div class="bar"><button class="btn main" data-act="saveDeck" ${deckLocked() ? 'disabled' : ''}>保存</button><button class="btn" data-act="saveAs" ${deckLocked() ? 'disabled' : ''}>名前を付けて保存</button><button class="btn danger" data-act="delDeck" ${B.id && !deckLocked() ? '' : 'disabled'}>削除</button></div>
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
  const okM = !validateDeck(allDecks().find(d => d.id === PREP.me).list).err.length, okI = !validateDeck(allDecks().find(d => d.id === PREP.ai).list).err.length;
  const aiHTML = `<h3>AIと対戦（1人用）</h3><div class="mrow"><div class="panel" style="min-width:300px"><h3>あなたのデッキ</h3><select data-sel="prep.me">${opt(PREP.me)}</select>${info(PREP.me)}<div class="note" style="margin-top:6px">手番：<select data-sel="prep.seat"><option value="0" ${PREP.seat === 0 ? 'selected' : ''}>先行</option><option value="1" ${PREP.seat === 1 ? 'selected' : ''}>後攻</option></select></div></div>
  <div class="panel" style="min-width:300px"><h3>AIのデッキ</h3><select data-sel="prep.ai">${opt(PREP.ai)}</select>${info(PREP.ai)}</div></div>
  <button class="btn main" data-act="startAI" ${okM && okI && !deckLocked() ? '' : 'disabled'}>AIと対戦開始</button>${okM && okI ? '' : '<span class="err"> 構築ルール違反のデッキでは開始できません</span>'}<p class="note">AIは盤面・手札を見て、キャラの配置・スペル／アイテムの使用・購入・移動・攻撃を自動で行う簡易的なものです（アビリティの起動や非公開の駆け引きは行いません）。</p><hr>`;
  const lockHTML = deckLocked() ? `<div class="panel" style="border-color:#c0392b"><b>対戦中です。</b>決着がつくまで、他の対戦（AI・同じ端末・オンライン）は始められません。<button class="btn sm" data-act="nav" data-s="battle">対戦画面に戻る</button></div>` : '';
  $('#app').innerHTML = `<h2>対戦準備</h2>${lockHTML}${aiHTML}<h3>同じ端末で対戦</h3><div class="mrow"><div class="panel" style="min-width:300px"><h3>先行</h3><select data-sel="prep.a">${opt(PREP.a)}</select>${info(PREP.a)}</div>
  <div class="panel" style="min-width:300px"><h3>後攻</h3><select data-sel="prep.b">${opt(PREP.b)}</select>${info(PREP.b)}</div></div>
  <p class="note">同じデッキを両者が選ぶこともできます。この版は<b>1台の端末で交代して遊ぶ</b>形式です（ターン開始時に画面を渡す確認が出ます）。オンラインで遊ぶ場合は、下の「オンライン対戦」を使ってください。</p>
  <button class="btn main" data-act="start" ${okA && okB && !deckLocked() ? '' : 'disabled'}>対戦開始</button>${okA && okB ? '' : '<span class="err"> 構築ルール違反のデッキでは開始できません</span>'}${lobbyHTML()}`;
}

