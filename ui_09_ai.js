/* ---------- AIと対戦（1人用） ----------
   オンライン対戦の仕組み（イベントを1本のキューで処理する runLoop）をそのまま使い、
   相手側のイベント・選択肢への回答だけをAI（game.js の AI）が出す。通信は行わない。 */
(function () {
  const wrap = (obj, k, fn) => { const o = obj[k]; obj[k] = function (...a) { return fn.call(this, o, ...a); }; };
  const aiOn = who => !!ONL && !!ONL.ai && AI.is(who);
  wrap(UI, 'ask', function (o, msg, btns, who) { who = who == null ? G.active : who; return aiOn(who) ? Promise.resolve(AI.ask(msg, btns, who)) : o.call(this, msg, btns, who); });
  wrap(UI, 'pickBoard', function (o, opt) { const who = opt.who == null ? G.active : opt.who; return aiOn(who) ? Promise.resolve(AI.pick(opt)) : o.call(this, opt); });
  /* どのカードが何を対象にしたかを、双方の画面に出す（対象マスの強調＋上部の帯）。
     対象を選んだ時点では「保留」にしておき、SpC等の支払いも済んで効果の発動が確定した時（カードのカットイン／最初のログ）に表示する */
  wrap(UI, 'pickBoard', async function (o, opt) {
    const r = await o.call(this, opt);
    try {
      if (r && r.length && (opt.kind === 'target' || opt.kind === 'attack')) {
        const who = opt.who == null ? G.active : opt.who;
        const cur = G.curSrc && CARDS[G.curSrc] ? CARDS[G.curSrc].name : null;
        const pr = String(opt.prompt || '').replace(/（.*?）/g, ''), i = pr.indexOf('：');
        const src = cur || (i > 0 ? pr.slice(0, i) : pr.replace(/(の)?(対象|相手|自分).*$/, '').slice(0, 12)) || '効果';
        const names = r.map(c => { const u = at(c[0], c[1]); return (u && !u.dead ? (u.hidden ? '非公開カード' : nm(u)) : '（マス）') + '（' + coord(c[0], c[1]) + '）'; });
        UI.aimPend = { who, src, names, cells: r.map(c => c[0] + ',' + c[1]) };
      }
    } catch (e) { console.error(e); }
    return r;
  });
  let aimTimer = null;
  UI.aimFlush = async function (ms) { // 待たない。点滅は aimEnd（処理の終了）まで続け、帯だけ約1.6秒で消す
    const a = UI.aimPend; UI.aimPend = null;
    if (!a || (ONL && ONL.queue && ONL.queue.length)) return Promise.resolve();
    try {
      UI.tgtMark = { cells: a.cells, until: Infinity, who: a.who };
      let bar = document.getElementById('aimbar'); if (!bar) { bar = document.createElement('div'); bar.id = 'aimbar'; document.body.appendChild(bar); }
      bar.className = 'o' + a.who; bar.textContent = `🎯 ${G.players[a.who].name}：【${a.src}】→ 対象：${a.names.join('、')}`; bar.style.display = 'block';
      clearTimeout(aimTimer); aimTimer = setTimeout(() => { bar.style.display = 'none'; }, 1600);
      UI.render();
    } catch (e) { console.error(e); }
    if (ms) await sleep(ms);
  };
  UI.aimEnd = function () {
    UI.aimPend = null; clearTimeout(aimTimer);
    const bar = document.getElementById('aimbar'); if (bar) bar.style.display = 'none';
    if (UI.tgtMark) { UI.tgtMark = null; try { UI.render(); } catch (e) { } }
  };
  wrap(UI, 'cutIn', async function (o, cid) { const r = await o.call(this, cid); await UI.aimFlush(500); return r; }); // カードのカットイン後、対象を点滅させて0.5秒おいてから効果を処理する
  /* バトル開始前の演出待ち（0.5〜2.5秒のランダム）：黄金の体などの有無を相手に悟らせない。見た目だけの待ちで、状態や乱数には影響しない */
  UI.suspense = async function (att, def) {
    if (!att || !def || (ONL && ONL.queue && ONL.queue.length)) return;
    const ms = 500 + Math.random() * 2000, v = VW();
    UI.wait = v === att.owner ? `${G.players[def.owner].name}の入力を待っています…` : 'バトル開始までお待ちください…';
    try { UI.render(); } catch (e) { }
    await sleep(ms);
    UI.wait = null; try { UI.render(); } catch (e) { }
  };
  /* 盤上のキャラクターの効果発動カットイン（0.5秒・ターンプレイヤーの色） */
  UI.abilityCut = async function (u) {
    if (!u || (ONL && ONL.queue && ONL.queue.length)) return;
    let el = document.getElementById('abcut'); if (!el) { el = document.createElement('div'); el.id = 'abcut'; document.body.appendChild(el); }
    el.className = 'o' + G.active; el.textContent = `${nm(u)}の効果発動`; el.style.display = 'flex'; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
    await sleep(500); el.style.display = 'none';
  };
  wrap(UI, 'pickCard', function (o, title, prompt, cids, who) { who = who == null ? G.active : who; return aiOn(who) ? Promise.resolve(cids[0]) : o.call(this, title, prompt, cids, who); });
  wrap(UI, 'pickCards', function (o, title, prompt, cids, min, who, max) { who = who == null ? G.active : who; return aiOn(who) ? Promise.resolve(AI.cards(title, prompt, cids, min, who, max)) : o.call(this, title, prompt, cids, min, who, max); });
  wrap(UI, 'toast', function (o, m) { if (ONL && ONL.ai && ONL.aiBusy && !/^🎲/.test(m)) return; return o.call(this, m); }); // AIが試して失敗した操作のエラーは出さない
  const _write = writeEv; writeEv = async function (ev) { if (ONL && ONL.ai) { pushEv(ev); return; } return _write.apply(this, arguments); };
  const _exec = execEv; execEv = async function (ev) { try { return await _exec(ev); } finally { if (ONL && ONL.ai && ONL.done) { const d = ONL.done; ONL.done = null; d(); } } };
  const _leave = leaveOnline; leaveOnline = function () { if (ONL && ONL.ai) { ONL.stop = true; ONL = null; AI.sides = new Set(); return; } return _leave.apply(this, arguments); };
  const _start = startTurn; startTurn = async function (i) { await _start(i); if (ONL && ONL.ai && AI.is(i) && G && !AI.over()) setTimeout(aiTurnGo, 50); };

  async function aiTurnGo() {
    const o = ONL; if (!o || !o.ai || o.aiRun || !G || AI.over() || !AI.is(G.active)) return;
    o.aiRun = true; o.aiBusy = true;
    try {
      while (ONL === o && (UI.busy || UI.pk)) await sleep(60); // 直前のイベント処理の終了待ち
      await AI.runTurn(async ev => {
        if (ONL !== o || o.stop) throw new Error('stop');
        while (UI.pk) await sleep(100);
        await sleep(450);
        if (ONL !== o || o.stop) throw new Error('stop');
        const d = new Promise(r => { o.done = r; }); pushEv(ev); await d; await sleep(150);
      });
    } catch (e) { if (e.message !== 'stop') console.error(e); }
    finally { o.aiBusy = false; o.aiRun = false; }
  }

  window.startAI = function () {
    if (deckLocked()) return;
    const dm = allDecks().find(d => d.id === PREP.me), da = allDecks().find(d => d.id === PREP.ai), seat = PREP.seat;
    if (!dm || !da) return;
    const me = { ai: true, me: seat, queue: [], waiters: [], recv: 0, buf: {}, pending: false, stop: false, seed: 0, got: true };
    ONL = me; AI.sides = new Set([1 - seat]);
    UI.pk = null; UI.sel = null; UI.selHand = null; UI.busy = true; UI.wait = null; UI.overShown = false;
    newGame(seat === 0 ? mk(dm.list) : mk(da.list), seat === 0 ? mk(da.list) : mk(dm.list));
    G.players[1 - seat].name = 'AI';
    screen = 'battle'; show();
    UI.toast(`あなたは${seat === 0 ? '先行' : '後攻'}です（相手：AI）`);
    startTurn(0).then(() => { UI.busy = false; runLoop(); });
  };
})();
