/* ---------- オンライン：イベントの送受信 ---------- */
const pad6 = n => String(n).padStart(6, '0');
function pushEv(ev) { if (ONL.waiters.length) ONL.waiters.shift()(ev); else ONL.queue.push(ev); }
function take() { return new Promise(res => { if (ONL.queue.length) res(ONL.queue.shift()); else ONL.waiters.push(res); }); }
async function writeEv(ev) { await ONL.col.doc(pad6(ONL.recv + 1)).set(ev); }
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
function leaveOnline() {
  if (ONL) {
    const o = ONL; o.stop = true; ONL = null;
    try { o.unsub && o.unsub(); } catch (e) { }
    if (LOB && LOB.role === 'host') { const db = LOB.db, code = LOB.code; setTimeout(async () => { try { const sn = await db.collection('rooms/' + code + '/ev' + o.seed).get(); for (const d of sn.docs) await db.doc('rooms/' + code + '/ev' + o.seed + '/' + d.id).delete(); await db.doc('rooms/' + code).delete(); } catch (e) { } }, 60000); }
  }
  if (LOB) { try { LOB.unsub && LOB.unsub(); } catch (e) { } LOB = null; }
}

/* ---------- オンライン：部屋（ロビー） ---------- */
let TAB = null;
try { TAB = sessionStorage.getItem('bgTab'); if (!TAB) { TAB = 't' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); sessionStorage.setItem('bgTab', TAB); } } catch (e) { TAB = 't' + Math.random().toString(36).slice(2, 10); }
let LOBERR = '';
async function getDB() { try { return (typeof claude !== 'undefined' && claude && claude.use) ? await claude.use('db') : null; } catch (e) { return null; } }
function lobErr(m) { LOBERR = m; if (screen === 'prep') renderPrep(); }
async function createRoom() {
  LOBERR = ''; const db = await getDB();
  if (!db) return lobErr('オンライン対戦は、Claudeで公開したページ上でのみ使えます（このファイル単体では使えません）。');
  try {
    for (let k = 0; k < 6; k++) {
      const code = String(100000 + Math.floor(Math.random() * 900000));
      const ref = db.doc('rooms/' + code), sn = await ref.get();
      if (sn.exists && Date.now() - (sn.data().created || 0) < 6 * 3600e3) continue;
      await ref.set({ created: Date.now(), host: TAB, guest: null, status: 'lobby', hostReady: false, guestReady: false });
      return enterLobby(db, code, 'host');
    }
    lobErr('部屋番号の確保に失敗しました。もう一度お試しください。');
  } catch (e) { lobErr('部屋を作れませんでした（' + (e.code || e.message) + '）。このページの共有権限が「閲覧のみ」だと書き込めません。'); }
}
async function joinRoom(code) {
  LOBERR = ''; code = String(code).trim();
  if (!/^\d{6}$/.test(code)) return lobErr('6桁の部屋番号を入力してください。');
  const db = await getDB();
  if (!db) return lobErr('オンライン対戦は、Claudeで公開したページ上でのみ使えます。');
  try {
    const ref = db.doc('rooms/' + code), sn = await ref.get();
    if (!sn.exists) return lobErr('その番号の部屋はありません。');
    const r = sn.data();
    if (r.host === TAB) return enterLobby(db, code, 'host');
    if (r.guest === TAB) return enterLobby(db, code, 'guest');
    if (r.guest) return lobErr('その部屋はすでに満員です。');
    await ref.update({ guest: TAB });
    enterLobby(db, code, 'guest');
  } catch (e) { lobErr('入室できませんでした（' + (e.code || e.message) + '）。このページの共有権限が「閲覧のみ」だと書き込めません。'); }
}
function enterLobby(db, code, role) {
  LOB = { db, code, role, room: null, deckId: PREP.a, starting: false, started: null };
  LOB.unsub = db.doc('rooms/' + code).onSnapshot(sn => { if (!LOB) return; LOB.room = sn.exists ? sn.data() : null; onRoomChange(); }, e => lobErr('通信エラー（' + e.code + '）'));
  screen = 'prep'; show();
}
function leaveLobby() { if (ONL) return; if (LOB) { try { LOB.unsub(); } catch (e) { } if (LOB.role === 'host') LOB.db.doc('rooms/' + LOB.code).delete().catch(() => { }); LOB = null; } renderPrep(); }
function onRoomChange() {
  const L = LOB, r = L && L.room; if (!r) { if (screen === 'prep') renderPrep(); return; }
  if (r.status === 'playing' && !ONL && L.started !== r.seed) { L.started = r.seed; startOnline(); return; }
  if (L.role === 'host' && r.status === 'lobby' && r.hostReady && r.guestReady && !L.starting) {
    L.starting = true;
    L.db.doc('rooms/' + L.code).update({ status: 'playing', seed: 1 + Math.floor(Math.random() * 2147483000), seat0: Math.random() < .5 ? 'host' : 'guest' }).catch(() => { L.starting = false; });
  }
  if (screen === 'prep' && !ONL) renderPrep();
}
async function lobReady() {
  const L = LOB; if (!L || !L.room) return;
  const r = L.room, role = L.role, key = role + 'Ready', ref = L.db.doc('rooms/' + L.code);
  try {
    if (r[key]) { await ref.update({ [key]: false }); return; }
    const d = allDecks().find(d => d.id === L.deckId), v = validateDeck(d.list);
    if (v.err.length) return UI.toast('構築ルール違反のデッキでは対戦できません');
    const ids = Object.keys(d.list).sort().flatMap(k => Array(d.list[k]).fill(k));
    await ref.update({ [role + 'Deck']: ids, [role + 'DeckName']: d.name, [key]: true });
  } catch (e) { UI.toast('送信に失敗しました（' + (e.code || e.message) + '）'); }
}
const pubInfo = ids => { const m = {}; for (const id of ids || []) if (CARDS[id] && CARDS[id].rank >= 2 && CARDS[id].kind !== 'char') m[id] = (m[id] || 0) + 1; return Object.entries(m).map(([id, n]) => `${esc(CARDS[id].name)}${n > 1 ? '×' + n : ''}（R${CARDS[id].rank}）`).join('、') || 'なし'; };
function lobbyHTML() {
  if (!LOB) return `<h3 style="margin-top:22px">オンライン対戦</h3><div class="panel"><p class="note">「部屋をつくる」で表示される6桁の番号を相手に伝え、相手が同じ番号を入力して入室します。入室後に各自がデッキを選び、双方が「対戦可能」を押すと始まります。先行・後攻はランダムです。<br>※ 相手にもこのページを共有し、<b>共同編集者（Contributor）以上</b>の権限を付けてください（閲覧のみだと書き込めず、対戦できません）。</p><div class="bar"><button class="btn main" data-act="mkRoom">部屋をつくる</button><span class="note">または</span><input type="text" id="roomcode" inputmode="numeric" maxlength="6" placeholder="部屋番号（6桁）" style="width:150px"><button class="btn" data-act="joinRoom">入室</button></div>${LOBERR ? `<div class="err">${esc(LOBERR)}</div>` : ''}</div>`;
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
  const L = LOB, r = L.room, db = L.db;
  const seat = r.seat0 === L.role ? 0 : 1;
  const d0 = r.seat0 === 'host' ? r.hostDeck : r.guestDeck, d1 = r.seat0 === 'host' ? r.guestDeck : r.hostDeck;
  const me = { db, code: L.code, me: seat, queue: [], waiters: [], recv: 0, pending: false, stop: false, seed: r.seed, got: false };
  ONL = me;
  me.col = db.collection('rooms/' + L.code + '/ev' + r.seed);
  let firstRes; const first = new Promise(res => firstRes = res);
  me.unsub = me.col.onSnapshot(sn => {
    if (ONL !== me) return;
    for (const d of sn.docs) { const n = parseInt(d.id, 10); if (n === me.recv + 1) { me.recv = n; pushEv(d.data()); } }
    if (!me.got) { me.got = true; firstRes(); }
  }, e => UI.toast('通信エラー（' + e.code + '）'));
  await first;
  if (ONL !== me) return;
  seedRng(r.seed);
  UI.pk = null; UI.sel = null; UI.selHand = null; UI.busy = true; UI.wait = null; UI.overShown = false;
  newGame(d0.slice(), d1.slice());
  screen = 'battle'; show();
  UI.toast(`あなたは${seat === 0 ? '先行' : '後攻'}です`);
  await startTurn(0);
  UI.busy = false;
  runLoop();
}

