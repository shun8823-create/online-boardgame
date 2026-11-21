/* ---------- 操作 ---------- */
async function guarded(fn) {
  if (UI.busy) return; UI.busy = true; UI.sel = null; UI.selHand = null;
  try { await fn(); } catch (e) { console.error(e); UI.toast('エラー：' + e.message); }
  UI.busy = false; if (G) afterAction();
}
function onCell(x, y) {
  if (!G || G.over != null) return;
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
    const ab = (!ONL || G.active === ONL.me) ? mainAbility(t) : null;
    if (ab) { // 先に効果を発動するか質問し、キャンセルしたら移動先の表示を見られるようにする
      UI.sel = null; UI.selHand = null; renderBattle();
      localAsk(ab.q, ['発動する', 'キャンセル']).then(r => {
        if (r === '発動する') doAct({ t: ab.t, uid: t.uid });
        else if (G && G.over == null) { UI.sel = t.uid; renderBattle(); }
      });
      return;
    }
    UI.sel = t.uid; UI.selHand = null; renderBattle();
  } else if (t && !t.hidden) { UI.sel = t.uid; UI.selHand = null; renderBattle(); }
  else { UI.sel = null; renderBattle(); }
}
function onClick(e) {
  SFX.unlock();
  if (e.target.closest && e.target.closest('[data-card]')) SFX.play('switch');
  const stEl = e.target.closest('[data-st]');
  if (stEl) { e.stopPropagation(); e.preventDefault(); lpFired = false; showStatus(stEl.dataset.st); return; }
  if (e.target.closest('#kwpop')) return; // 語彙説明を閉じるタップでは、下のカード詳細は閉じない
  const kgEl = e.target.closest('[data-kg]');
  if (kgEl) { e.stopPropagation(); e.preventDefault(); lpFired = false; showGloss(kgEl.dataset.kg); return; }
  const kwEl = e.target.closest('[data-kw]');
  if (kwEl) { e.stopPropagation(); e.preventDefault(); lpFired = false; showKeyword(kwEl.dataset.kw); return; }
  if (lpFired) { lpFired = false; return; }
  { const md = $('#modal'); if (md && md.style.display !== 'none' && md.querySelector('.mbox.detail') && !e.target.closest('[data-act]')) { md.style.display = 'none'; return; } }
  if (PCV() && G && UI.selHand != null && !UI.pk && !e.target.closest('.hpop,.hcard,[data-act=hpage],#dlg,#modal,#bfull')) { // 使用/配置ボタン：他の場所をクリックで消す
    UI.selHand = null; const hp = document.getElementById('hovp'); if (hp) { delete hp.dataset.k; hp.innerHTML = ''; if (hp.parentElement) hp.parentElement.classList.remove('hov'); }
    if (!e.target.closest('[data-act]')) { renderBattle(); return; }
  }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act;
  if (['start', 'startAI', 'mkRoom', 'joinRoom'].includes(a) && deckLocked()) { UI.toast('対戦中です。決着がつくまで他の対戦は始められません（対戦画面で投了すると終了できます）'); return; }
  if (e.target.closest('[data-card]')) { /* カードに触れた音は上で鳴らし済み */ } else if (['hand', 'cell', 'sheetHand', 'grave'].includes(a)) SFX.play('select'); else if (['toAction', 'endTurn', 'play', 'pkok', 'buy', 'sell', 'sheetSell'].includes(a)) SFX.play('tick');
  switch (a) {
    case 'nav': screen = el.dataset.s; show(); break;
    case 'detail': showDetail(el.dataset.card); break;
    case 'sheetPlay': $('#modal').style.display = 'none'; doAct({ t: 'play', i: +el.dataset.i }); break;
    case 'eqdetail': $('#modal').style.display = 'none'; showDetail(el.dataset.wcid, null, +el.dataset.uid); break;
    case 'udetail': $('#modal').style.display = 'none'; showDetail(G.units[+el.dataset.uid].cid, +el.dataset.uid); break;
    case 'goDeck': { const t = $('#deckpanel'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } break;
    case 'goPool': window.scrollTo({ top: 0, behavior: 'smooth' }); break;
    case 'closeModal': $('#modal').style.display = 'none'; break;
    case 'inc': { const id = el.dataset.id; B.list[id] = (B.list[id] || 0) + 1; renderBuilder(); break; }
    case 'dec': { const id = el.dataset.id; if (B.list[id] > 1) B.list[id]--; else delete B.list[id]; renderBuilder(); e.stopPropagation(); break; }
    case 'newDeck': if (deckLocked()) { UI.toast('対戦中はデッキの作成・保存・削除はできません'); break; } B.id = null; B.name = '新しいデッキ'; B.list = {}; renderBuilder(); break;
    case 'dupDeck': if (deckLocked()) { UI.toast('対戦中はデッキの作成・保存・削除はできません'); break; } B.id = null; B.name = ($('#dname').value || 'デッキ') + '（複製）'; renderBuilder(); break;
    case 'delDeck': if (deckLocked()) { UI.toast('対戦中はデッキの作成・保存・削除はできません'); break; } { const did = B.id, dn = (userDecks.find(d => d.id === did) || {}).name; if (!did) { UI.toast('削除できるのは保存済みのデッキです（読み込むか保存してください）'); break; }
      localAsk(`デッキ「${dn}」を削除しますか？（元に戻せません）`, ['削除する', 'キャンセル']).then(r => { if (r !== '削除する') return; userDecks = userDecks.filter(d => d.id !== did); saveDecks(); if (B.id === did) { B.id = null; B.list = {}; B.name = '新しいデッキ'; B.src = null; } UI.toast(`「${dn}」を削除しました`); renderBuilder(); }); break; }
    case 'saveDeck': if (deckLocked()) { UI.toast('対戦中はデッキの作成・保存・削除はできません'); break; } saveDeckAs(false); break;
    case 'saveAs': if (deckLocked()) { UI.toast('対戦中はデッキの作成・保存・削除はできません'); break; } saveDeckAs(true); break;
    case 'start': startBattle(); break;
    case 'startAI': startAI(); break;
    case 'cell': onCell(+el.dataset.x, +el.dataset.y); break;
    case 'hand': if (UI.pk || UI.busy || G.phase === 'start') break; if (MOB()) { showHandSheet(+el.dataset.i); break; } { const i = +el.dataset.i; if (UI.selHand === i && G.phase === 'main' && (!ONL || G.active === ONL.me)) doAct({ t: 'play', i }); else { UI.selHand = i; UI.sel = null; renderBattle(); } } break;
    case 'reveal': doAct({ t: 'reveal', uid: +el.dataset.uid }); break;
    case 'flame': doAct({ t: 'flame', uid: +el.dataset.uid }); break;
    case 'archer': doAct({ t: 'archer', uid: +el.dataset.uid }); break;
    case 'scout': doAct({ t: 'scout', uid: +el.dataset.uid }); break;
    case 'play': { const i = UI.selHand; if (i != null) doAct({ t: 'play', i }); } break;
    case 'sell': { const i = UI.selHand; if (i != null) { UI.selHand = null; confirmSell(i); } } break;
    case 'sheetSell': $('#modal').style.display = 'none'; confirmSell(+el.dataset.i); break;
    case 'buy': { const k = +el.dataset.k, s = shopItems()[k]; if (!s) break; localAsk(`「${CARDS[s.cid].name}」を💰${s.price}で購入します。よろしいですか？`, ['購入する', 'やめる']).then(y => { if (y === '購入する') doAct({ t: 'buy', k }); }); } break;
    case 'pkok': if (UI.pk && (!UI.pk.o.validate || UI.pk.o.validate(UI.pk.sel))) finishPick(UI.pk.sel); break;
    case 'pkcancel': finishPick(null); break;
    case 'toAction': UI.selHand = null; doAct({ t: 'toAction' }); break;
    case 'endTurn': { const f = own(VW()).filter(mustMove); if (f.length) { UI.toast('必ず移動しなければならないキャラクターがいます：' + f.map(nm).join('、')); break; } doAct({ t: 'end' }); } break;
    case 'grave': showGrave(+el.dataset.i); break;
    case 'zone': { const k = el.dataset.z, off = zOnNow(k); Store.set('bgZone_' + k, off ? '0' : '1'); UI['zoneOff_' + k] = off; UI.render(); break; }
    case 'hpage': UI.handPage = (UI.handPage || 0) + (+el.dataset.d); UI.render(); break;
    case 'togHand': UI.hideHand = !UI.hideHand; if (UI.hideHand) UI.selHand = null; UI.render(); break;
    case 'giveup': localAsk(`${G.players[VW()].name}が投了します。よろしいですか？`, ['投了する', 'やめる']).then(y => { if (y === '投了する') doAct({ t: 'giveup' }); }); break;
    case 'mkRoom': createRoom(); break;
    case 'joinRoom': joinRoom(($('#roomcode') || {}).value || ''); break;
    case 'leaveRoom': leaveLobby(); break;
    case 'lobReady': lobReady(); break;
  }
}
function confirmSell(i) {
  const p = G && G.players[VW()], cid = p && p.hand[i]; if (!cid) return;
  localAsk(`「${CARDS[cid].name}」を売ります（+💰${sellOf(cid)}・ショップチケットを1枚受け取る）。よろしいですか？`, ['売る', 'やめる']).then(y => { if (y === '売る') doAct({ t: 'sell', i }); });
}
function startBattle() {
  if (deckLocked()) return;
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
async function execEv(ev) { try { await execEv0(ev); if (G && G.over == null && typeof sanctZeroScan === 'function') await sanctZeroScan(); } finally { if (UI.aimEnd) UI.aimEnd(); } } // 対象の点滅は、この操作の処理が全て終わるまで続ける
async function execEv0(ev) {
  if (!G || G.over != null) return;
  switch (ev.t) {
    case 'play': await playHand(ev.i); break;
    case 'sell': sellCard(ev.i); break;
    case 'buy': buyShop(ev.k); break;
    case 'move': { const u = G.units[ev.uid]; const mv = u && movesFor(u).find(m => m.x === ev.x && m.y === ev.y); if (mv) await doMove(u, mv); break; }
    case 'throw': { const u = G.units[ev.uid]; if (u) await monkeyThrow(u); break; }
    case 'angelFetch': { const u = G.units[ev.uid]; if (u) await angelFetchAct(u); break; }
    case 'frenzyGet': { const u = G.units[ev.uid]; if (u) await frenzyGetAct(u); break; }
    case 'priest': { const u = G.units[ev.uid]; if (u) await priestAct(u); break; }
    case 'twoAct': { const u = G.units[ev.uid]; if (u) await twoActStart(u); break; }
    case 'moon': { const u = G.units[ev.uid]; if (u) await moonReset(u); break; }
    case 'reveal': { const u = G.units[ev.uid]; if (u) await revealUnit(u); break; }
    case 'burn': { const u = G.units[ev.uid]; if (u) await burnStart(u); break; }
    case 'flame': { const u = G.units[ev.uid]; if (u) await flameStart(u); break; }
    case 'archer': { const u = G.units[ev.uid]; if (u) await archerShot(u); break; }
    case 'scout': { const u = G.units[ev.uid]; if (u) await scoutWatch(u); break; }
    case 'toAction': if (G.phase === 'main') G.phase = 'action'; break;
    case 'end': await endTurn(); break;
    case 'giveup': if (G.over == null) { G.over = 1 - G.active; log(`${cur().name}が投了した`); } if (UI.gameOver) UI.gameOver(G.over); break;
  }
  await flushBreeze();
}
async function doAct(ev) {
  if (!G || G.over != null) return;
  if (!ONL) return guarded(() => execEv(ev));
  if (UI.busy || UI.pk || ONL.pending || G.active !== ONL.me) return;
  ONL.pending = true; UI.sel = null; UI.selHand = null;
  try { await writeEv(ev); } catch (e) { ONL.pending = false; UI.toast('送信に失敗しました。もう一度お試しください'); }
}


function zOnNow(k) { try { return Store.get('bgZone_' + k) !== '0'; } catch (e) { return UI['zoneOff_' + k] !== true; } }

const deckLocked = () => !!G && G.over == null; // 対戦中はデッキの作成・保存・削除を禁止する
