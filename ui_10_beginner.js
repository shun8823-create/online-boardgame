/* ---------- 初心者モード（入門）の画面 ----------
   レッスン／入門対戦／デッキガイド／バックアップ・復元／設定。ゲームエンジン・通常モードの処理には手を入れず、
   既存の関数を「包む」形で、初心者モードの時（BEG.on）だけ動く。オンライン・同じ端末対戦では何も起きない。 */
const BEG = { on: false, kind: null, id: null, seat: 0, hints: false, shop: true, ended: false, ret: false, meDeck: null, aiDeck: null, bubble: null, open: true, collapsed: false };
(function () {
  let prog = BEGC.loadProg(), BUI = { restore: null, code: '', msg: '', sel: {} };
  const saveP = () => { if (!BEGC.saveProg(prog)) UI.toast('⚠ 進行状況を保存できませんでした'); };
  const wrap = (o, k, fn) => { const f = o[k]; o[k] = function (...a) { return fn.call(this, f, ...a); }; };
  const findDeck = id => BEG_DECKS[id] || allDecks().find(d => d.id === id);
  const deckName = id => { const d = findDeck(id); return d ? d.name : id; };
  const fmtT = t => { try { const d = new Date(t); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; } catch (e) { return ''; } };
  const stable = () => !!G && !!ONL && ONL.ai && G.over == null && !UI.busy && !UI.pk && !ONL.pending && !ONL.aiBusy && !(ONL.queue && ONL.queue.length) && G.active === ONL.me;

  /* ===== ナビ：⑤入門 ===== */
  { const nav = document.querySelector('nav'); if (nav && !nav.querySelector('[data-s=beg]')) { const b = document.createElement('button'); b.dataset.s = 'beg'; b.textContent = '① 入門'; nav.insertBefore(b, nav.firstChild); } }
  const _show = show;
  show = function () { if (screen === 'beg') { document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.s === 'beg')); renderBeg(); paintCoach(); return; } const r = _show.apply(this, arguments); paintCoach(); return r; };

  /* ===== 入門メニュー ===== */
  const stageOpen = i => i === 0 || !!(prog.stages[BEG_STAGES[i - 1].id] && prog.stages[BEG_STAGES[i - 1].id].clear);
  const decksOpen = () => prog.unlocked.filter(id => PRESETS.some(p => p.id === id));
  function renderBeg() {
    const lock = deckLocked(), rs = BEGC.loadResume();
    const cleared = BEG_STAGES.filter(s => prog.stages[s.id] && prog.stages[s.id].clear).length, doneL = BEG_LESSONS.filter(l => prog.lessons[l.id]).length;
    const optD = (sel, ids) => ids.map(id => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(deckName(id))}</option>`).join('');
    let h = `<h2>${GUIDE.icon} 入門モード</h2><div class="panel begintro"><b>${esc(GUIDE.name)}</b>：${esc(GUIDE.tone.start)}<br><span class="note">レッスン ${doneL}/${BEG_LESSONS.length} 完了　／　入門対戦 ${cleared}/${BEG_STAGES.length} クリア。通常モードのルール・カード・AIの強さは同じです。説明は設定でいつでも減らせます。</span></div>`;
    if (lock && !BEG.on) h += `<div class="panel" style="border-color:#c0392b"><b>対戦中です。</b>決着がつくまで、レッスン・入門対戦は始められません。<button class="btn sm" data-act="nav" data-s="battle">対戦画面へ</button></div>`;
    if (BEG.on) h += `<div class="panel" style="border-color:#c9a45a"><b>${BEG.kind === 'lesson' ? 'レッスン' : '入門対戦'}の途中です。</b><button class="btn main" data-act="nav" data-s="battle">続ける</button></div>`;
    if (rs && !BEG.on) h += rs.bad ? `<div class="panel"><b>中断した対戦</b>：${esc(rs.bad)}　<button class="btn sm" data-beg="dropResume">破棄する</button></div>`
      : `<div class="panel" style="border-color:#c9a45a"><b>▶ 中断した対戦があります</b>：${esc((BEG_STAGES.find(s => s.id === rs.meta.id) || {}).title || '')}（ターン${(() => { try { return JSON.parse(rs.snap).G.turn; } catch (e) { return '?'; } })()}・${fmtT(rs.ts)}保存）<br><button class="btn main" data-beg="resume" ${lock ? 'disabled' : ''}>続きから</button> <button class="btn sm" data-beg="dropResume">破棄する</button></div>`;
    h += `<h3>レッスン</h3><div class="grid" style="gap:8px">${BEG_LESSONS.map(l => `<div class="panel" style="width:250px;margin:0"><b>${prog.lessons[l.id] ? '✅ ' : ''}${l.id}　${esc(l.title)}</b><div class="note">${esc(l.learn)}（約${l.mins}分）</div><button class="btn ${prog.lessons[l.id] ? '' : 'main'}" data-beg="lesson" data-id="${l.id}" ${lock ? 'disabled' : ''}>${prog.lessons[l.id] ? 'もう一度' : 'はじめる'}</button></div>`).join('')}</div>`;
    h += `<h3>入門対戦</h3><p class="note">AIと1人で対戦します。AIの強さは通常モードと同じです。危険な時は案内が知らせ、「↩ 戻す」で自分の手番の中なら1手ずつ戻せます。途中で中断して、続きから再開もできます。</p><div class="grid" style="gap:8px">`;
    BEG_STAGES.forEach((s, i) => {
      const op = stageOpen(i), c = prog.stages[s.id] && prog.stages[s.id].clear, ids = decksOpen(); const sel = BUI.sel[s.id] || {};
      const me = s.me || sel.me || ids[0], ai = s.ai || sel.ai || ids[0];
      h += `<div class="panel" style="width:300px;margin:0;${op ? '' : 'opacity:.5'}"><b>${c ? '✅ ' : op ? '' : '🔒 '}${s.id}　${esc(s.title)}</b><div class="note">${esc(s.intro)}</div>
      <div class="note" style="margin-top:4px">あなた：${s.me ? '<b>' + esc(deckName(s.me)) + '</b>' : `<select data-begsel="${s.id}.me">${optD(me, ids)}</select>`}　相手：${s.ai ? '<b>' + esc(deckName(s.ai)) + '</b>' : `<select data-begsel="${s.id}.ai">${optD(ai, ids)}</select>`}</div>
      <div class="note">${s.shop ? 'ショップあり' : 'ショップなし'}／${s.hints ? '案内あり' : '案内なし'}${s.unlock ? '／勝つと「' + esc(deckName(s.unlock)) + '」が開放' : ''}</div>
      <button class="btn ${c ? '' : 'main'}" data-beg="stage" data-id="${s.id}" ${op && !lock ? '' : 'disabled'}>${c ? 'もう一度' : '開始'}</button></div>`;
    });
    h += `</div><h3>デッキの特徴と戦い方</h3>${decksOpen().map(id => { const g = BEG_DECK_GUIDE[id]; return g ? `<details class="panel"><summary><b>${esc(g.title)}</b></summary><p>${esc(g.feat)}</p><ol>${g.flow.map(f => `<li>${esc(f)}</li>`).join('')}</ol><p><b>切り札：</b>${esc(g.trump)}</p><p class="note">⚠ ${esc(g.care)}</p></details>` : ''; }).join('')}${prog.unlocked.includes('p_wild') ? '' : '<p class="note">🔒 ワイルドデッキは、ステージS3をクリアすると開放されます。</p>'}`;
    h += `<h3>用語集</h3><details class="panel"><summary>用語をひらく（配置（召喚）・SC・攻撃値など）</summary>${Object.entries(BEG_GLOSS).map(([k, v]) => `<p><b>${esc(k)}</b>：${esc(v)}</p>`).join('')}</details>`;
    h += `<h3>設定</h3><div class="panel"><label>案内の量：<select data-begsel="verbosity">${[['full', 'しっかり'], ['mid', 'ほどほど（初期）'], ['min', '最小（危険予告のみ）'], ['off', 'オフ']].map(([v, t]) => `<option value="${v}" ${prog.verbosity === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <div class="note">一度見たヒントは自動では出しません。「しっかり」では状況が繰り返すたびに表示します。</div>
      <label style="display:block;margin-top:8px"><input type="checkbox" data-begsel="assist" ${prog.assist ? 'checked' : ''}> 通常モードでも「危険予告」を表示する（初期はオフ。通常モードの他の表示・操作は変わりません）</label>
      <div style="margin-top:8px"><button class="btn sm" data-beg="resetHints">ヒントをもう一度見る（既読をリセット）</button></div></div>`;
    h += `<h3>バックアップ・復元</h3><div class="panel"><p class="note">デッキ・入門の進行状況・設定を書き出せます。ブラウザのデータを消す前や、別の端末へ移す時にお使いください。</p>
      <button class="btn" data-beg="exportFile">📁 ファイルに書き出す</button> <button class="btn" data-beg="exportText">📋 コピー用テキストを表示</button>
      ${BUI.code ? `<textarea readonly rows="4" style="width:100%;margin-top:6px" id="begcode">${esc(BUI.code)}</textarea><button class="btn sm" data-beg="copyCode">コピー</button>` : ''}
      <hr style="border-color:#333a40"><b>復元</b>：<input type="file" id="begfile" accept=".json,application/json,text/plain"> または貼り付け：<br><textarea rows="2" style="width:100%" id="begpaste" placeholder="BGBK1: で始まるテキスト、またはJSON"></textarea><button class="btn" data-beg="parsePaste" ${lock ? 'disabled' : ''}>内容を確認</button>${lock ? '<span class="note"> 対戦中は復元できません</span>' : ''}
      ${BUI.msg ? `<div class="${BUI.msg.startsWith('✖') ? 'err' : 'ok'}" style="margin-top:6px">${esc(BUI.msg)}</div>` : ''}${restoreHTML()}
      ${BEGC.hasPrev() ? '<div style="margin-top:8px"><button class="btn sm" data-beg="undoRestore">↩ 直前の復元を取り消す</button></div>' : ''}</div>`;
    $('#app').innerHTML = h;
  }
  function restoreHTML() {
    const R = BUI.restore; if (!R) return '';
    const cur = BEGC.summary(userDecks, BEGC.loadProg()), inc = BEGC.summary(R.res.data.decks, R.res.data.beginner);
    const row = (t, a, b) => `<tr><td>${t}</td><td>${a}</td><td>${b}</td></tr>`;
    return `<div class="panel" style="border-color:#c9a45a;margin-top:8px"><b>復元の確認</b>${R.res.warn.length ? '<div class="warn">' + R.res.warn.map(esc).join('<br>') + '</div>' : ''}
    <table class="note" style="width:100%;text-align:left"><tr><th></th><th>今のデータ</th><th>バックアップ${R.res.data.savedAt ? '（' + esc(fmtT(R.res.data.savedAt)) + '）' : ''}</th></tr>
    ${row('自作デッキ', cur.decks + '個：' + esc(cur.names.join('、') || 'なし'), inc.decks + '個：' + esc(inc.names.join('、') || 'なし'))}${row('完了レッスン', cur.lessons + '本', inc.lessons + '本')}${row('クリアしたステージ', cur.stages, inc.stages)}${row('開放済みデッキ', cur.unlocked, inc.unlocked)}</table>
    ${R.step === 2 ? `<div class="err"><b>この操作で、今のデッキ・進行状況・設定が上書きされます。</b>（直前の内容は自動で退避され、復元後に「取り消す」で戻せます）</div><button class="btn danger" data-beg="doOverwrite">本当に上書きして復元</button> <button class="btn" data-beg="cancelRestore">やめる</button>`
      : `<button class="btn danger" data-beg="askOverwrite">上書きして復元…</button> <button class="btn" data-beg="doMerge">統合して復元（バックアップにあるものを追加）</button> <button class="btn" data-beg="cancelRestore">キャンセル</button>`}</div>`;
  }
  const refresh = () => { if (screen === 'beg') { const y = window.scrollY; renderBeg(); window.scrollTo(0, y); } };
  const readAny = text => { const res = BEGC.parseBackup(text); if (!res.ok) { BUI.restore = null; BUI.msg = '✖ ' + res.err; } else { BUI.restore = { res, step: 1 }; BUI.msg = ''; } refresh(); };
  function afterRestore(r) {
    if (!r.ok) { BUI.msg = '✖ ' + (r.err || '保存に失敗しました'); BUI.restore = null; return refresh(); }
    userDecks.length = 0; r.decks.forEach(d => userDecks.push(d)); prog = BEGC.loadProg(); BUI.restore = null; BUI.msg = '復元しました' + (r.skipped ? `（ルールに合わないデッキ${r.skipped}件は除外）` : '') + '（「直前の復元を取り消す」で戻せます）'; try { SFX.set(Store.get('bg_sfx') !== '0'); const sb = document.getElementById('sfxbtn'); if (sb) sb.textContent = SFX.on ? '🔊' : '🔇'; } catch (e) { } refresh();
  }
  document.addEventListener('change', e => {
    if (e.target.id === 'begfile') { const f = e.target.files && e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => readAny(String(rd.result)); rd.onerror = () => { BUI.msg = '✖ ファイルを読めませんでした'; refresh(); }; rd.readAsText(f); return; }
    const k = e.target.dataset && e.target.dataset.begsel; if (!k) return;
    if (k === 'verbosity') { prog.verbosity = e.target.value; saveP(); BEG.hints = BEG.hints && prog.verbosity !== 'off'; return; }
    if (k === 'assist') { prog.assist = e.target.checked; saveP(); return; }
    const [sid, w] = k.split('.'); BUI.sel[sid] = { ...(BUI.sel[sid] || {}), [w]: e.target.value };
  });
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-beg]'); if (!el) return; const a = el.dataset.beg, id = el.dataset.id;
    switch (a) {
      case 'lesson': return startLesson(id);
      case 'stage': return startStage(id);
      case 'resume': return resumeStage();
      case 'dropResume': BEGC.clearResume(); return refresh();
      case 'resetHints': prog.hints = {}; prog.guides = {}; saveP(); BUI.msg = 'ヒントを最初から表示します'; return refresh();
      case 'exportFile': { const t = JSON.stringify(BEGC.buildBackup(userDecks), null, 1), d = new Date(), n = `taisen-backup-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`; try { const u = URL.createObjectURL(new Blob([t], { type: 'application/json' })), l = document.createElement('a'); l.href = u; l.download = n; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000); BUI.msg = `「${n}」を書き出しました。ダウンロードできない環境では「コピー用テキスト」をお使いください。`; } catch (err) { BUI.msg = '✖ ファイルに書き出せませんでした。コピー用テキストをお使いください'; } return refresh(); }
      case 'exportText': BUI.code = BEGC.backupText(BEGC.buildBackup(userDecks)); BUI.msg = ''; return refresh();
      case 'copyCode': { const ta = document.getElementById('begcode'); if (!ta) return; ta.select(); let ok = false; try { if (navigator.clipboard) { navigator.clipboard.writeText(ta.value); ok = true; } else ok = document.execCommand('copy'); } catch (err) { try { ok = document.execCommand('copy'); } catch (e2) { } } UI.toast(ok ? 'コピーしました' : '選択しました。長押し／Ctrl+C でコピーしてください'); return; }
      case 'parsePaste': { const t = document.getElementById('begpaste'); return readAny(t ? t.value : ''); }
      case 'askOverwrite': if (BUI.restore) BUI.restore.step = 2; return refresh();
      case 'cancelRestore': BUI.restore = null; return refresh();
      case 'doOverwrite': if (BUI.restore && !deckLocked()) return afterRestore(BEGC.applyBackup(BUI.restore.res.data, 'overwrite', userDecks)); return;
      case 'doMerge': if (BUI.restore && !deckLocked()) return afterRestore(BEGC.applyBackup(BUI.restore.res.data, 'merge', userDecks)); return;
      case 'undoRestore': { const r = BEGC.undoRestore(); if (!r.ok) { BUI.msg = '✖ ' + r.err; return refresh(); } userDecks.length = 0; r.decks.forEach(d => userDecks.push(d)); prog = BEGC.loadProg(); BUI.msg = '復元を取り消しました'; return refresh(); }
      case 'undo': return doUndo();
      case 'next': return coachNext();
      case 'skipLesson': return coachSkip();
      case 'quitLesson': return leaveSession(true);
      case 'suspend': return suspendStage();
      case 'toggleCoach': BEG.collapsed = !BEG.collapsed; return paintCoach();
      case 'nextLesson': { const i = BEG_LESSONS.findIndex(l => l.id === BEG.id); leaveSession(false); const n = BEG_LESSONS[i + 1]; return n ? startLesson(n.id) : (screen = 'beg', show()); }
      case 'review': { const p = document.getElementById('begreview'); if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none'; return; }
    }
  });

  /* ===== セッションの開始・終了 ===== */
  const mkONL = seat => ({ ai: true, me: seat, queue: [], waiters: [], recv: 0, buf: {}, pending: false, stop: false, seed: 0, got: true });
  function begin(kind, id) {
    BEG.on = true; BEG.kind = kind; BEG.id = id; BEG.ended = false; BEG.bubble = null; BEG.collapsed = false; BEG.ret = false;
    RNG = BEGC.soloRng((Math.random() * 4294967296) >>> 0); BEGC.undo.clear(); BEGC.REV.reset(); UI.pk = null; UI.sel = null; UI.selHand = null; UI.busy = true; UI.wait = null; UI.overShown = false;
  }
  async function startLesson(id) {
    if (deckLocked()) return UI.toast('対戦中です。決着がつくまで始められません');
    const L = BEG_LESSONS.find(l => l.id === id); if (!L) return;
    begin('lesson', id); BEG.hints = false; BEG.seat = 0; ONL = mkONL(0); AI.sides = new Set(); BEGC.Coach.start(L);
    BEGC.applySetup(L.setup, ['p_oudo', 'p_gob']); G.players[1].name = '相手'; screen = 'battle'; show();
    await startTurn(0); await BEGC.lessonBoard(L.setup); UI.busy = false; UI.render(); runLoop(); paintCoach();
  }
  async function startStage(id) {
    if (deckLocked()) return UI.toast('対戦中です。決着がつくまで始められません');
    const i = BEG_STAGES.findIndex(s => s.id === id), s = BEG_STAGES[i]; if (!s || !stageOpen(i)) return;
    const ids = decksOpen(), sel = BUI.sel[id] || {}, me = s.me || sel.me || ids[0], ai = s.ai || sel.ai || ids[0];
    const dm = findDeck(me), da = findDeck(ai); if (!dm || !da) return;
    if (BEGC.loadResume() && !(await confirmBox('中断した対戦があります。新しく始めると、中断した対戦は破棄されます。よろしいですか？'))) return;
    BEGC.clearResume(); begin('stage', id); BEG.hints = s.hints && prog.verbosity !== 'off'; BEG.shop = s.shop; BEG.seat = 0; BEG.meDeck = me; BEG.aiDeck = ai; BEG.stageKey = id; BEG._abSeen = {};
    ONL = mkONL(0); AI.sides = new Set([1]); newGame(mk(dm.list), mk(da.list)); G.players[1].name = 'AI'; G.opt = { coach: true }; if (!s.shop) G.opt.noShop = true; screen = 'battle'; show();
    UI.toast(`あなたは先行です（相手：AI）。${s.shop ? '' : 'このステージではショップは使いません。'}`);
    startTurn(0).then(() => { UI.busy = false; runLoop(); paintCoach(); });
  }
  function resumeStage() {
    if (deckLocked()) return; const r = BEGC.loadResume(); if (!r || r.bad) return;
    const m = r.meta; begin('stage', m.id); BEG.hints = m.hints && prog.verbosity !== 'off'; BEG.shop = m.shop; BEG.seat = m.seat; BEG.meDeck = m.me; BEG.aiDeck = m.ai;
    ONL = mkONL(m.seat); AI.sides = new Set([1 - m.seat]); BEG._abSeen = {}; BEGC.restore(r.snap); if (m.rev) Object.assign(BEGC.REV, m.rev);
    screen = 'battle'; show(); UI.busy = false; UI.toast('中断した対戦を再開しました'); runLoop(); paintCoach();
  }
  function metaNow() { return { kind: 'stage', id: BEG.id, seat: BEG.seat, me: BEG.meDeck, ai: BEG.aiDeck, shop: BEG.shop, hints: BEG.hints, rev: { turns: BEGC.REV.turns, plays: BEGC.REV.plays, deadSeen: BEGC.REV.deadSeen } }; }
  function suspendStage() {
    if (BEG.kind !== 'stage' || !G) return;
    if (!stable()) return UI.toast('AIの手番・処理中は中断できません。自分の手番になってからお試しください');
    if (!BEGC.saveResume(metaNow())) return UI.toast('⚠ 保存できませんでした（容量不足など）。中断せずに続けてください');
    leaveSession(false, true); UI.toast('中断しました。入門メニューの「続きから」で再開できます');
  }
  function leaveSession(toMenu, keepResume) {
    const o = ONL; if (o) { o.stop = true; } ONL = null; AI.sides = new Set(); G = null; RNG = Math.random; BEG.on = false; BEGC.Coach.stop(); BEGC.undo.clear(); UI.pk = null; UI.sel = null; UI.busy = false;
    const go = document.getElementById('gameover'); if (go) go.remove(); UI.overShown = false; UI.aimEnd && UI.aimEnd();
    if (toMenu !== false || keepResume) { screen = 'beg'; show(); } paintCoach();
  }

  /* ===== 既存関数の「包み」（BEG.on の時だけ働く） ===== */
  const confirmBox = msg => new Promise(res => { const d = document.createElement('div'); d.className = 'begdlg'; d.innerHTML = `<div class="dbox"><p>${esc(msg)}</p><div class="dbtn"><button class="btn" data-x="0">キャンセル</button><button class="btn main" data-x="1">はい</button></div></div>`; d.onclick = e => { const b = e.target.closest('[data-x]'); if (b) { d.remove(); res(b.dataset.x === '1'); } }; document.body.appendChild(d); });
  const _doAct = doAct;
  doAct = async function (ev) {
    if (!BEG.on || !ONL || !ONL.ai || !G) return _doAct.apply(this, arguments);
    if (G.over != null || UI.busy || UI.pk || ONL.pending || ONL.aiBusy || G.active !== ONL.me) return _doAct.apply(this, arguments);
    if (BEG.kind === 'lesson') {
      if (ev.t === 'giveup') return UI.toast('レッスンは「やめる」ボタンで戻れます');
      const a = BEGC.Coach.allow(ev);
      if (a === 'END') { await BEGC.Coach.end(); await afterCoach(); return; }
      if (a !== true) { UI.toast(a); flashCoach(); return; }
    } else if (!BEG.shop && (ev.t === 'sell' || ev.t === 'buy')) return UI.toast('このステージではショップは使いません');
    if (ev.t === 'end') { if (BEG.kind === 'stage') BEGC.recordTurnEnd(ONL.me); BEGC.undo.clear(); }
    else if (ev.t !== 'giveup') { BEGC.undo.push(BEGC.snap(BEG.kind === 'lesson' ? BEGC.Coach.state() : null)); if (ev.t === 'play') { const c = G.players[ONL.me].hand[ev.i]; if (c) BEGC.recordPlay(c); } }
    return _doAct.apply(this, arguments);
  };
  const _exec = execEv;
  execEv = async function (ev) { try { return await _exec.apply(this, arguments); } finally { if (BEG.on && G) { try { await afterCoach(); } catch (e) { console.error(e); } } } };
  async function afterCoach() { if (BEG.kind === 'lesson') { await BEGC.Coach.after(); if (BEGC.Coach.done && !BEG.ended) { BEG.ended = true; const l = BEGC.Coach.lesson; prog.lessons[l.id] = true; saveP(); } UI.render(); } paintCoach(); }
  async function coachNext() { await BEGC.Coach.next(); await afterCoach(); }
  async function coachSkip() { const L = BEGC.Coach.lesson; if (!L) return; if (!(await confirmBox('このレッスンをスキップします（完了にはなりません）。よろしいですか？'))) return; leaveSession(true); }
  async function doUndo() {
    if (!BEG.on || BEG.kind == null) return;
    if (!stable()) return UI.toast('今は戻せません（処理中、またはAIの手番です）。自分の手番の中だけ戻せます');
    const s = BEGC.undo.pop(BEGC.snap(null)); if (!s) return UI.toast('これ以上は戻せません（ターンの開始時点です）');
    const x = BEGC.restore(s); if (BEG.kind === 'lesson') BEGC.Coach.setState(x);
    UI.sel = null; UI.selHand = null; UI.pk = null; BEG.ended = false; UI.render(); paintCoach(); UI.toast('1手戻しました');
  }
  wrap(UI, 'turnOverlay', function (o, ...a) { if (BEG.on && BEG.kind === 'lesson') return Promise.resolve(); return o.apply(this, a); });
  wrap(UI, 'gameOver', function (o, w) {
    if (BEG.on && BEG.kind === 'lesson') { afterCoach(); return; }
    const r = o.call(this, w);
    if (BEG.on && BEG.kind === 'stage' && !BEG.ended) { BEG.ended = true; try { onStageEnd(w); } catch (e) { console.error(e); } }
    return r;
  });
  const _leave = leaveOnline;
  leaveOnline = function () { const was = BEG.on, ret = BEG.ret; const r = _leave.apply(this, arguments); if (was) { BEG.on = false; BEGC.Coach.stop(); BEGC.undo.clear(); RNG = Math.random; if (ret) setTimeout(() => { screen = 'beg'; show(); }, 0); paintCoach(); } return r; };

  function onStageEnd(w) {
    BEGC.clearResume(); const won = w === BEG.seat, st = BEG_STAGES.find(s => s.id === BEG.id); let msg = '';
    if (won && st) {
      const first = !(prog.stages[st.id] && prog.stages[st.id].clear); prog.stages[st.id] = { clear: true, turns: G.turn, at: Date.now(), deck: BEG.meDeck };
      if (st.unlock && !prog.unlocked.includes(st.unlock)) { prog.unlocked.push(st.unlock); msg = `🎉 「${deckName(st.unlock)}」が開放されました！`; }
      if (first && st.id === 'S5') msg += ' 🎓 卒業おめでとうございます。通常モードでも、ここで覚えたことが使えます。';
      saveP();
    }
    const box = document.querySelector('#gameover .gobox'); if (!box) return;
    const gb = box.querySelector('#goback'); if (gb) { gb.textContent = '入門メニューへ戻る'; BEG.ret = true; }
    if (!msg) return; // 振り返りの表示は行わない（メッセージがある時だけ追加）
    const ex = document.createElement('div'); ex.innerHTML = `<div class="gosub">${esc(msg)}</div>`;
    box.insertBefore(ex, gb || null);
  }

  /* ===== 案内役（コーチ）の表示 ===== */
  function flashCoach() { const c = document.getElementById('coach'); if (c) { c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); } }
  function paintCoach() {
    let c = document.getElementById('coach'); const show_ = BEG.on && screen === 'battle' && G;
    document.body.classList.toggle('coachon', !!show_);
    if (!show_) { if (c) c.style.display = 'none'; document.body.style.setProperty('--coachh', '0px'); const d = document.getElementById('begdanger'); if (d && !assistOn()) d.style.display = 'none'; applyHl(); return; }
    if (!c) { c = document.createElement('div'); c.id = 'coach'; document.body.appendChild(c); }
    c.style.display = 'block'; c.classList.toggle('mini', BEG.collapsed);
    const un = `<button class="btn sm" data-beg="undo" title="自分の手番の中で、1手ずつ戻せます">↩ 戻す</button>`;
    let body = '';
    if (BEG.kind === 'lesson') {
      const C = BEGC.Coach, L = C.lesson, s = C.cur();
      if (C.done) body = `<div class="coachsay"><b>${esc(GUIDE.tone.done)}</b>「${esc(L.title)}」が完了しました。</div><div class="coachbtn"><button class="btn main" data-beg="nextLesson">${BEG_LESSONS.findIndex(l => l.id === L.id) < BEG_LESSONS.length - 1 ? '次のレッスンへ' : '入門メニューへ'}</button><button class="btn" data-beg="quitLesson">入門メニューへ</button></div>`;
      else body = `<div class="coachsay">${esc(s ? s.say : '')}</div><div class="coachbtn">${s && s.next ? '<button class="btn main" data-beg="next">次へ</button>' : ''}${un}<button class="btn sm" data-beg="skipLesson">スキップ</button><button class="btn sm" data-beg="quitLesson">やめる</button></div><div class="note">${esc(L.id)} ${esc(L.title)}　${C.i + 1}/${L.steps.length}</div>`;
    } else {
      body = `<div class="coachsay">${BEG.bubble ? esc(BEG.bubble) : esc(GUIDE.tone.start)}</div><div class="coachbtn">${un}<button class="btn sm" data-beg="suspend" title="今の対戦を保存して入門メニューへ">💾 中断</button></div>`;
    }
    c.innerHTML = `<div class="coachhead"><span class="coachico">${GUIDE.icon}</span><b>${esc(GUIDE.name)}</b><button class="btn sm" data-beg="toggleCoach">${BEG.collapsed ? '▲' : '▼'}</button></div>${BEG.collapsed ? '' : body}`;
    applyHl(); syncCoachH();
  }
  function syncCoachH() { // スマホ：案内役は画面上部に固定。ページ全体をその高さだけ下げ、ボタン類と重ならないようにする
    const c = document.getElementById('coach'), on = c && c.style.display !== 'none' && document.body.classList.contains('coachon');
    if (on && BEG.kind === 'stage') { // 対戦中は案内の枠の高さを縮めない（文章の長さで画面全体が上下に動かないように）
      const key = (BEG.id || '') + '|' + !!BEG.collapsed + '|' + window.innerWidth; if (BEG._chKey !== key) { BEG._chKey = key; BEG._ch = 0; c.style.minHeight = ''; }
      c.style.minHeight = BEG._ch + 'px'; if (c.offsetHeight > BEG._ch) BEG._ch = c.offsetHeight; c.style.minHeight = BEG._ch + 'px';
    } else if (c) c.style.minHeight = '';
    document.body.style.setProperty('--coachh', on && window.innerWidth <= 1000 ? c.offsetHeight + 'px' : '0px');
    if (c && !c._ro && window.ResizeObserver) { c._ro = new ResizeObserver(() => syncCoachH()); c._ro.observe(c); }
  }
  window.addEventListener('resize', () => syncCoachH());
  function applyHl() {
    document.querySelectorAll('.coachhl').forEach(n => n.classList.remove('coachhl'));
    if (!(BEG.on && BEG.kind === 'lesson' && screen === 'battle' && G)) return; const s = BEGC.Coach.cur(); if (!s || !s.hl) return;
    if (s.hl.cells) for (const [x, y] of s.hl.cells) { const n = document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`); if (n) n.classList.add('coachhl'); }
    if (s.hl.card) { const hand = G.players[0].hand; document.querySelectorAll('.hcard[data-i]').forEach(n => { if (hand[+n.dataset.i] === s.hl.card) n.classList.add('coachhl'); }); } // カードIDで光らせる（選択中に手札の並びがずれても別のカードは光らない）
    if (s.hl.hand != null) document.querySelectorAll(`.hcard[data-i="${s.hl.hand}"]`).forEach(n => n.classList.add('coachhl'));
    if (s.hl.btn) document.querySelectorAll(`[data-act="${s.hl.btn}"]`).forEach(n => n.classList.add('coachhl'));
  }
  const assistOn = () => prog.assist && !BEG.on && !!G && screen === 'battle' && G.over == null;
  function say(text, key, always) { // 案内役のひとこと。key は「一度だけ」の既読管理用
    if (prog.verbosity === 'off') return; if (key && !always && prog.hints[key]) return;
    if (key) { prog.hints[key] = true; saveP(); } BEG.bubble = text; BEG.collapsed = false; paintCoach();
  }
  let tickT = null, saveT = null;
  function tick() {
    try {
      const mine = G && ONL ? ONL.me : (G ? G.active : 0), myTurn = G && G.over == null && G.active === mine && (G.phase === 'main' || G.phase === 'action');
      let d = document.getElementById('begdanger'); if (!d) { d = document.createElement('div'); d.id = 'begdanger'; document.body.appendChild(d); }
      const want = (BEG.on && BEG.kind === 'stage' && BEG.hints && prog.verbosity !== 'off') || assistOn();
      let th = null; if (want && myTurn && screen === 'battle') th = BEGC.avatarThreat(mine);
      if (th) { d.style.display = 'block'; d.textContent = `⚠ アバターが狙われています：${th.by.map(e => `${CARDS[e.cid].name.replace(/（.*）/, '')}（${coord(e.x, e.y)}）`).join('・')}`; } else d.style.display = 'none';
      if (BEG.on && BEG.kind === 'stage' && BEG.hints && myTurn && screen === 'battle' && prog.verbosity !== 'off') {
        const p = G.players[mine], full = prog.verbosity === 'full', min = prog.verbosity === 'min';
        if (!min) {
          if (p.deck.length <= 5 && !G.lap) say(BEG_HINTS.lap5.say, 'lap5', full);
          if (own(mine).some(u => !u.dead && !isAv(u) && u.acted > 0 && u.sc === 0)) say(BEG_HINTS.sc0.say, 'sc0', full);
          if (own(1 - mine).some(u => !u.dead && !isAv(u) && u.lp < baseLP(u))) say(BEG_HINTS.chip.say, 'chip', full);
          { // 庇護・魔法耐性・飛翔（砂壁の近く）のキャラが盤に出たら、その試合で最初の1回は必ず説明する
            const seen = BEG._abSeen || (BEG._abSeen = {}), alive = Object.values(G.units).filter(u => !u.dead && !u.hidden);
            const walls = Object.keys(G.walls || {}).map(k => k.split(',').map(Number));
            const nm = u => CARDS[u.cid].name.replace(/（.*）/, '');
            const f = alive.find(u => !isAv(u) && abU(u, 'dwarf') && !seen.dwarf), r = alive.find(u => !isAv(u) && hasResist(u) && !seen.magicResist), fl = alive.find(u => abU(u, 'flight') && !seen.flight && walls.some(w => Math.max(Math.abs(w[0] - u.x), Math.abs(w[1] - u.y)) <= 2));
            const ab = f ? ['dwarf', f] : r ? ['magicResist', r] : fl ? ['flight', fl] : null;
            BEG._abTick = !!ab; if (ab) { seen[ab[0]] = true; BEG.bubble = `【${nm(ab[1])}（${coord(ab[1].x, ab[1].y)}）】` + BEG_ABIL[ab[0]]; BEG.collapsed = false; paintCoach(); }
          }
          if (BEG.shop && G.turn >= 3) say(BEG_HINTS.shop.say, 'shop', false);
          if (!BEG._abTick && G.phase === 'main') for (const c of p.hand) if (BEG_CARD_GUIDE[c] && (full || !prog.guides[c])) { if (!prog.guides[c] || full) { const first = !prog.guides[c]; if (first) { prog.guides[c] = true; saveP(); } if (first || (full && BEG.bubble !== `【${CARDS[c].name.replace(/（.*）/, '')}】${BEG_CARD_GUIDE[c]}`)) { BEG.bubble = `【${CARDS[c].name.replace(/（.*）/, '')}】${BEG_CARD_GUIDE[c]}`; BEG.collapsed = false; paintCoach(); } break; } }
        }
      }
    } catch (e) { console.error(e); }
  }
  wrap(window, 'renderBattle', function (o, ...a) { const r = o.apply(this, a); applyHl(); clearTimeout(tickT); tickT = setTimeout(tick, 250); if (BEG.on && BEG.kind === 'stage') { clearTimeout(saveT); saveT = setTimeout(() => { if (BEG.on && BEG.kind === 'stage' && stable()) BEGC.saveResume(metaNow()); }, 600); } return r; });
})();
