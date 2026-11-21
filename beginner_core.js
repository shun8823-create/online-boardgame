/* ===== 初心者モード：コア処理（DOMに依存しない。ゲームエンジン game.js と同じスコープで動く） =====
   ・進行状況の保存／読み込み（Store 経由）  ・バックアップ／復元  ・一人用の乱数（状態を保存・復元できる）
   ・スナップショット（1手戻し／対戦途中の保存）  ・レッスンの進行管理（Coach）  ・ヒント・危険予告  ・振り返りの集計
   通常モード・オンライン対戦のコードには触れない。 */
const BEGC = (() => {
  const PKEY = 'bgBeginner_v1', RKEY = 'bgResume_v1', PREV = 'bgBackup_prev';
  const ST = () => (typeof Store !== 'undefined' ? Store : null);
  const defProg = () => ({ v: 1, lessons: {}, stages: {}, hints: {}, guides: {}, unlocked: ['p_oudo', 'p_gob'], verbosity: 'mid', assist: false, updated: 0 });
  const normProg = p => { const d = defProg(); if (!p || typeof p !== 'object') return d; const o = { ...d, ...p }; for (const k of ['lessons', 'stages', 'hints', 'guides']) if (!o[k] || typeof o[k] !== 'object') o[k] = {}; if (!Array.isArray(o.unlocked)) o.unlocked = d.unlocked; for (const x of d.unlocked) if (!o.unlocked.includes(x)) o.unlocked.push(x); if (!['full', 'mid', 'min', 'off'].includes(o.verbosity)) o.verbosity = 'mid'; o.assist = !!o.assist; return o; };
  const loadProg = () => normProg(ST() && ST().getJSON(PKEY, null));
  const saveProg = p => { p.updated = Date.now(); return !!(ST() && ST().setJSON(PKEY, p)); };

  /* ---- 一人用の乱数（mulberry32。状態を取り出し・戻せる） ---- */
  function soloRng(seed) { let a = seed >>> 0; const f = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; f.get = () => a; f.set = v => { a = v | 0; }; f.solo = true; return f; }

  /* ---- スナップショット ---- */
  const snap = (extra) => JSON.stringify({ G, uidc: UIDC, rng: RNG && RNG.get ? RNG.get() : null, rev: { turns: REV.turns, plays: REV.plays, deadSeen: REV.deadSeen }, x: extra || null });
  function restore(s) { const o = JSON.parse(s); G = o.G; UIDC = o.uidc; if (o.rng != null && RNG && RNG.set) RNG.set(o.rng); if (o.rev) { REV.turns = o.rev.turns || []; REV.plays = o.rev.plays || {}; REV.deadSeen = o.rev.deadSeen || 0; } return o.x; }
  /* カード定義（能力・効果・数値・関数の中身まで）から署名を作る。定義やルールが変わった保存データは再開させない */
  const cardsSig = () => { const t = JSON.stringify(CARDS, (k, v) => typeof v === 'function' ? 'fn:' + v.toString() : v) + '|' + BEG_BUILD; let h = 0, h2 = 7; for (let i = 0; i < t.length; i++) { h = (h * 31 + t.charCodeAt(i)) | 0; h2 = (h2 * 131 + t.charCodeAt(i)) | 0; } return Object.keys(CARDS).length + ':' + h + ':' + h2; };
  const undo = { stack: [], push(s) { if (this.stack[this.stack.length - 1] !== s) this.stack.push(s); if (this.stack.length > 60) this.stack.shift(); }, clear() { this.stack = []; }, can() { return this.stack.length > 0; },
    pop(cur) { while (this.stack.length) { const s = this.stack.pop(); if (JSON.stringify({ ...JSON.parse(s), x: null, rev: null }) !== JSON.stringify({ ...JSON.parse(cur), x: null, rev: null })) return s; } return null; } };

  /* ---- 対戦途中の保存・再開 ---- */
  function packResume(meta) { return JSON.stringify({ v: 1, build: BEG_BUILD, sig: cardsSig(), ts: Date.now(), meta, snap: snap(null) }); }
  function checkResume(text) {
    let o; try { o = JSON.parse(text); } catch (e) { return { ok: false, err: '保存データが壊れています' }; }
    if (!o || o.v !== 1 || !o.snap || !o.meta) return { ok: false, err: '保存データの形式が違います' };
    if (o.build !== BEG_BUILD) return { ok: false, err: 'ゲームが更新されたため、この対戦は再開できません' };
    if (o.sig !== cardsSig()) return { ok: false, err: 'カードデータが更新されたため、この対戦は再開できません' };
    try {
      const s = JSON.parse(o.snap), g = s.G; if (!g || !g.players || !g.units) return { ok: false, err: '盤面データが不完全です' };
      for (const k in g.units) if (!CARDS[g.units[k].cid]) return { ok: false, err: '未知のカードが含まれています' };
      for (const p of g.players) for (const c of [...p.deck, ...p.hand, ...p.grave, ...(p.deckList || [])]) if (!CARDS[c]) return { ok: false, err: '未知のカードが含まれています' };
      if (g.over != null) return { ok: false, err: '決着済みの対戦です' };
    } catch (e) { return { ok: false, err: '保存データを読めません' }; }
    return { ok: true, o };
  }
  const saveResume = meta => !!(ST() && ST().set(RKEY, packResume(meta)));
  const loadResume = () => { const t = ST() && ST().get(RKEY); if (!t) return null; const r = checkResume(t); return r.ok ? r.o : { bad: r.err }; };
  const clearResume = () => { ST() && ST().remove(RKEY); };

  /* ---- バックアップ／復元 ---- */
  const b64e = s => btoa(unescape(encodeURIComponent(s))), b64d = s => decodeURIComponent(escape(atob(s)));
  const ZONES = ['sea', 'ins'];
  function buildBackup(decks) {
    const set = { sfx: ST() && ST().get('bg_sfx') }; for (const z of ZONES) set['zone_' + z] = ST() && ST().get('bgZone_' + z);
    return { app: 'taisen-board-game', kind: 'backup', v: 1, build: BEG_BUILD, savedAt: new Date().toISOString(), decks: decks.map(d => ({ id: d.id, name: d.name, list: d.list })), beginner: loadProg(), settings: set };
  }
  const backupText = o => 'BGBK1:' + b64e(JSON.stringify(o));
  function parseBackup(text) {
    text = String(text || '').trim(); if (!text) return { ok: false, err: '内容が空です' };
    let o; try { o = text.startsWith('BGBK1:') ? JSON.parse(b64d(text.slice(6).replace(/\s+/g, ''))) : JSON.parse(text); } catch (e) { return { ok: false, err: 'バックアップの形式が正しくありません（壊れている可能性があります）' }; }
    if (!o || o.app !== 'taisen-board-game' || o.kind !== 'backup') return { ok: false, err: 'このゲームのバックアップではありません' };
    if (o.v !== 1) return { ok: false, err: 'バックアップの版が新しすぎます（v' + o.v + '）。ゲームを更新してください' };
    if (!Array.isArray(o.decks)) return { ok: false, err: 'デッキ情報がありません' };
    const warn = [];
    const decks = [];
    for (const d of o.decks) {
      if (!d || typeof d.id !== 'string' || typeof d.name !== 'string' || !d.list || typeof d.list !== 'object') { warn.push('形式の違うデッキを1つ除外しました'); continue; }
      const bad = Object.entries(d.list).filter(([k, n]) => !CARDS[k] || !Number.isInteger(n) || n < 1 || n > 99);
      if (bad.length) { warn.push(`「${d.name}」は未知のカードを含むため除外しました`); continue; }
      decks.push({ id: d.id, name: d.name.slice(0, 40), list: { ...d.list } });
    }
    return { ok: true, data: { decks, beginner: normProg(o.beginner), settings: o.settings || {}, savedAt: o.savedAt || '', build: o.build || '' }, warn };
  }
  function summary(decks, prog) { const cl = Object.keys(prog.stages).filter(k => prog.stages[k] && prog.stages[k].clear).length; return { decks: decks.length, names: decks.map(d => d.name), lessons: Object.keys(prog.lessons).filter(k => prog.lessons[k]).length, stages: cl, unlocked: prog.unlocked.length }; }
  function mergeProg(cur, inc) { const o = normProg(JSON.parse(JSON.stringify(cur))); for (const k of ['lessons', 'hints', 'guides']) for (const x in inc[k]) if (inc[k][x]) o[k][x] = inc[k][x]; for (const x in inc.stages) { const a = o.stages[x], b = inc.stages[x]; if (b && b.clear && !(a && a.clear)) o.stages[x] = b; } for (const d of inc.unlocked) if (!o.unlocked.includes(d)) o.unlocked.push(d); return o; }
  /* 復元：mode='overwrite'（全て置き換え）／'merge'（バックアップ側にあるものを追加）。直前に現在の内容を bgBackup_prev に退避する */
  function applyBackup(data, mode, curDecks) {
    const S = ST(); if (!S) return { ok: false, err: '保存できません' };
    const dk = []; let skipped = 0;
    for (const d of data.decks) { let v; try { v = validateDeck(d.list); } catch (e) { v = { err: ['x'] }; } const hard = (v.err || []).filter(m => !(/^デッキ枚数/.test(m) && deckSize(d.list) < 30)); /* 作成途中（30枚未満）の保存は通常でも可能なので残す。ルール違反（4枚以上・R2超過等）は除外 */
      if (hard.length) { skipped++; continue; } dk.push(d); }
    data = { ...data, decks: dk };
    if (data.decks.length === 0 && skipped > 0 && mode !== 'merge') return { ok: false, err: 'バックアップ内のデッキがすべてルールに合わないため、復元しませんでした（現在のデータはそのままです）' };
    const oldD = S.get('bgDecks_v1'), oldP = S.get(PKEY), oldSfx = S.get('bg_sfx');
    S.set(PREV, backupText(buildBackup(curDecks)));
    let decks, prog;
    if (mode === 'merge') { decks = curDecks.slice(); for (const d of data.decks) if (!decks.some(x => x.id === d.id)) decks.push(d); prog = mergeProg(loadProg(), data.beginner); }
    else { decks = data.decks.slice(); prog = normProg(data.beginner); }
    const ok1 = S.setJSON('bgDecks_v1', decks), ok2 = ok1 && saveProg(prog);
    if (!(ok1 && ok2)) { // どちらか一方でも失敗したら元に戻す（デッキと進行状況を食い違わせない）
      if (oldD == null) S.remove('bgDecks_v1'); else S.set('bgDecks_v1', oldD);
      if (oldP == null) S.remove(PKEY); else S.set(PKEY, oldP);
      return { ok: false, err: '保存に失敗したため、元の状態に戻しました', rolledBack: true };
    }
    const st = data.settings || {}; if (mode !== 'merge') { if (st.sfx != null) S.set('bg_sfx', st.sfx); for (const z of ZONES) if (st['zone_' + z] != null) S.set('bgZone_' + z, st['zone_' + z]); }
    return { ok: true, decks, prog, skipped };
  }
  const hasPrev = () => !!(ST() && ST().get(PREV));
  function undoRestore() { const t = ST() && ST().get(PREV); if (!t) return { ok: false, err: '元に戻せる内容がありません' }; const r = parseBackup(t); if (!r.ok) return r; const S = ST(); S.setJSON('bgDecks_v1', r.data.decks); saveProg(r.data.beginner); const st = r.data.settings || {}; if (st.sfx != null) S.set('bg_sfx', st.sfx); for (const z of ZONES) if (st['zone_' + z] != null) S.set('bgZone_' + z, st['zone_' + z]); S.remove(PREV); return { ok: true, decks: r.data.decks, prog: r.data.beginner }; }

  /* ---- レッスン ---- */
  function applySetup(sp, decks) {
    const dm = decks || ['p_oudo', 'p_gob'], find = id => PRESETS.find(d => d.id === id);
    if (!sp.fresh) { newGame(mk(find(dm[0]).list), mk(find(dm[1]).list)); }
    return sp;
  }
  async function lessonBoard(sp) { // newGame 済みの盤を、レッスン用の固定配置にする（startTurn の後に呼ぶ）
    if (sp.keep) { // 盤・砂壁をそのまま残して「次の自分のターン」にする：味方のSC・行動済みを戻し、相手側は動かさない
      for (const u of Object.values(G.units)) if (u.owner === 0 && !u.dead) { u.sc = CARDS[u.cid].sc; u.spc = CARDS[u.cid].spc; u.acted = 0; }
      G.phase = sp.phase || 'action'; return;
    }
    if (sp.fresh) { for (const u of Object.values(G.units)) if (!isAv(u)) { u.dead = true; delete G.units[u.uid]; } G.walls = {}; for (const u of Object.values(G.units)) if (isAv(u)) { const c = CARDS[u.cid]; u.sc = c.sc; u.spc = c.spc; u.acted = 0; } }
    for (const [o, cid, x, y, props] of sp.units || []) { const u = mkUnit(o, cid, x, y); u.placedAt = G.turn - 2; if (props) Object.assign(u, props); }
    G.players[0].hand = [...(sp.hand || [])]; G.players[1].hand = [...(sp.ehand || [])];
    G.phase = sp.phase || 'main'; if (sp.lap) G.lap = true;
    if (sp.shop) { G.shop = G.shop || []; if (sp.shopItems) { G.shop = sp.shopItems.map(([cid, price]) => ({ cid, price, sold: false })); G.shopUsed = []; } G.players[0].coins = sp.coins || 0; }
  }
  const Coach = {
    lesson: null, i: 0, done: false,
    start(l) { this.lesson = l; this.i = 0; this.done = false; },
    stop() { this.lesson = null; this.i = 0; this.done = false; },
    cur() { return this.lesson && !this.done ? this.lesson.steps[this.i] : null; },
    allow(ev) { const s = this.cur(); if (!s) return true; const e = { ...ev }; if (e.uid && G.units[e.uid]) e.cid = G.units[e.uid].cid; if (s.next) return '説明を読んで「次へ」を押してください'; return s.allow ? s.allow(e) : true; },
    async advance() { const L = this.lesson; if (!L) return; this.i++; if (this.i >= L.steps.length) { this.done = true; return; } const st = L.steps[this.i]; if (st.setup) await lessonBoard(st.setup); },
    async after() { let guard = 0; while (this.cur() && !this.cur().next && this.cur().done && this.cur().done() && guard++ < 8) await this.advance(); },
    async next() { const s = this.cur(); if (s && s.next) await this.advance(); },
    async end() { const s = this.cur(); if (s && s.allow && s.allow({ t: 'end' }) === 'END') await this.advance(); },
    state() { return { id: this.lesson && this.lesson.id, i: this.i, done: this.done }; },
    setState(s) { if (s && this.lesson && s.id === this.lesson.id) { this.i = s.i; this.done = s.done; } },
  };

  /* ---- 危険予告（読み取り専用）：相手の次のターンに、自分のどのキャラが倒されうるか ---- */
  function threats(me) {
    const opp = 1 - me, sv = { active: G.active, turn: G.turn, lap: G.lap }, by = {}, out = [];
    try {
      G.active = opp; G.turn = sv.turn + 1; if (aiLapNext(opp)) G.lap = 'x';
      for (const e of own(opp)) { if (e.dead || e.hidden || e.st.petrify != null) continue; for (const a of aiAttacks(e, true)) (by[a.u.uid] = by[a.u.uid] || []).push({ e, AV: a.AV }); }
    } finally { G.active = sv.active; G.turn = sv.turn; G.lap = sv.lap; }
    for (const m of own(me)) { const l = by[m.uid]; if (!l || m.dead) continue; out.push({ u: m, by: l.map(x => x.e), kill: aiResolve(m, l.map(x => x.AV)) }); }
    return out;
  }
  const avatarThreat = me => threats(me).find(t => isAv(t.u) && t.kill) || null;

  /* ---- 振り返りの集計（読み取り専用。根拠のある事実だけ） ---- */
  const REV = { turns: [], plays: {}, deadSeen: 0, reset() { this.turns = []; this.plays = {}; this.deadSeen = 0; } };
  const enemyDead = me => Object.values(G.units).filter(u => u.owner !== me && u.dead && !isAv(u)).length;
  function recordPlay(cid) { REV.plays[cid] = (REV.plays[cid] || 0) + 1; }
  function recordTurnEnd(me) { // 自分の「ターン終了」の直前に呼ぶ
    const rec = { turn: G.turn, kills: 0, threat: null, missed: [] };
    const d = enemyDead(me); rec.kills = Math.max(0, d - REV.deadSeen); REV.deadSeen = d;
    try { const t = avatarThreat(me); if (t) rec.threat = { by: t.by.map(e => ({ cid: e.cid, at: coord(e.x, e.y) })) }; } catch (e) { }
    const svp = G.phase;
    try {
      G.phase = 'action';
      for (const u of own(me)) { if (u.dead || u.hidden || isAv(u)) continue; for (const a of aiAttacks(u, false)) { if (!isAv(a.u) && !a.u.dead && aiResolve(a.u, [a.AV], true) && !rec.missed.some(m => m.t === a.u.uid)) rec.missed.push({ t: a.u.uid, tcid: a.u.cid, ucid: u.cid, AV: a.AV, at: coord(a.u.x, a.u.y) }); } }
    } catch (e) { } finally { G.phase = svp; }
    REV.turns.push(rec);
  }
  function buildReview(me, deckId, won) {
    const nm = cid => (CARDS[cid] ? CARDS[cid].name.replace(/（.*）/, '') : cid), lines = [];
    const good = REV.turns.filter(t => t.kills > 0).sort((a, b) => b.kills - a.kills)[0];
    if (good) lines.push({ k: '良かった点', t: `ターン${good.turn}：このターンに相手のキャラクターを${good.kills}体倒しました。` });
    else if (!REV.turns.some(t => t.threat) && REV.turns.length >= 3) lines.push({ k: '良かった点', t: `自分のターン終了時に、アバターが次のターンに倒される状況は一度もありませんでした。` });
    const th = REV.turns.filter(t => t.threat);
    if (th.length) { const t = th[th.length - 1]; lines.push({ k: '危ない場面', t: `ターン${t.turn}：ターン終了時に、${t.threat.by.map(b => `${nm(b.cid)}（${b.at}）`).join('・')}が次のターンにアバターを倒せる状態でした（砂壁などで隣のマスを埋める、先に倒すなどの方法もありました）。` }); }
    const ms = REV.turns.filter(t => t.missed.length); if (ms.length) { const t = ms[0], m = t.missed[0]; lines.push({ k: 'もったいない場面', t: `ターン${t.turn}：ターン終了時に、${nm(m.ucid)}で${nm(m.tcid)}（${m.at}）を倒せる攻撃ができる状態でした（攻撃値${m.AV}）。` }); }
    const g = BEG_DECK_GUIDE[deckId], keyCard = { p_oudo: 'fireball', p_gob: 'gobParade', p_wild: 'ferocious' }[deckId];
    if (g && keyCard && CARDS[keyCard] && (G.players[me].deckList || []).includes(keyCard) && !REV.plays[keyCard]) lines.push({ k: '次に試すこと', t: `この対戦では「${nm(keyCard)}」を使いませんでした。${BEG_CARD_GUIDE[keyCard] || ''}` });
    if (!lines.length) lines.push({ k: '振り返り', t: won ? '大きな問題は見つかりませんでした。お疲れさまでした。' : '今回は記録から指摘できる点が見つかりませんでした。' });
    return lines.slice(0, 4);
  }
  return { PKEY, RKEY, defProg, normProg, loadProg, saveProg, soloRng, snap, restore, cardsSig, undo, packResume, checkResume, saveResume, loadResume, clearResume,
    buildBackup, backupText, parseBackup, summary, mergeProg, applyBackup, undoRestore, hasPrev, applySetup, lessonBoard, Coach, threats, avatarThreat, REV, recordPlay, recordTurnEnd, buildReview };
})();
