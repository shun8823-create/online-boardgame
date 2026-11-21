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
let HB = null, LASTRX = 0;
function stopHB() { if (HB) { clearInterval(HB); HB = null; } }
/* 対戦中に通信が切れたら、通信が切れた側を強制的に敗北にする。
   切れたのが自分か相手かは、自分の回線（ブラウザのオンライン状態・シグナリングサーバーとの接続）で判定する：
   自分の回線が落ちていれば自分の負け、自分の回線が生きているのに相手との接続だけが切れたなら相手の負け */
function declareDisconnect(why) {
  if (!ONL || ONL.stop || !G || G.over != null) return;
  const iAmOff = navigator.onLine === false || !!(PEER && PEER.disconnected);
  const loser = iAmOff ? ONL.me : 1 - ONL.me;
  G.over = 1 - loser; ONL.stop = true; stopHB();
  log(`${G.players[loser].name}は通信が切れたため敗北した（${why}）`);
  UI.toast(iAmOff ? '通信が切れたため、あなたの敗北となりました' : '相手との通信が切れたため、あなたの勝利となりました');
  if (UI.gameOver) UI.gameOver(G.over);
  if (screen === 'battle') renderBattle();
}
function setupConn(conn) {
  conn.on('data', onNet);
  conn.on('close', () => onNetClose(conn));
  conn.on('error', () => onNetClose(conn));
  stopHB(); LASTRX = Date.now(); let lastTick = Date.now();
  HB = setInterval(() => { // 3秒ごとに生存確認を送り、20秒間なにも届かなければ切断とみなす（自分の画面が止まっていた間は数えない）
    const now = Date.now(), gap = now - lastTick; lastTick = now;
    if (CONN !== conn) return stopHB();
    netSend({ k: 'hb' });
    if (gap > 8000) { LASTRX = now; return; }
    if (ONL && !ONL.stop && G && G.over == null && now - LASTRX > 20000) { const c = CONN; CONN = null; try { c && c.close(); } catch (e) { } declareDisconnect('応答なし'); }
  }, 3000);
}
function onNetClose(conn) {
  if (CONN !== conn) return;
  CONN = null; stopHB();
  if (ONL && !ONL.stop) {
    if (G && G.over == null) { declareDisconnect('接続切断'); }
    else if (!G || G.over == null) { UI.wait = '相手との接続が切れました。もう一度対戦するには「部屋を出る」から入り直してください。'; UI.toast('相手との接続が切れました'); if (screen === 'battle') renderBattle(); }
  } else if (LOB && LOB.role === 'host' && LOB.room) {
    LOB.room.guest = false; LOB.room.guestReady = false; LOB.starting = false; if (screen === 'prep') renderPrep();
  } else if (LOB && LOB.role === 'guest') { lobErr('部屋の主との接続が切れました。'); LOB = null; renderPrep(); }
}
function onNet(m) {
  if (!m) return;
  LASTRX = Date.now(); if (m.k === 'hb') return;
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

