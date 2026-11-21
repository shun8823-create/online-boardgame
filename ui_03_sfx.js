/* ---------- 画面4: 対戦 ---------- */
function localAsk(msg, btns) { return new Promise(res => { const el = $('#dlg'); let big = ''; if (msg.startsWith('§')) { const i = msg.indexOf('\n'); big = `<div class="dbig">${esc(msg.slice(1, i))}</div>`; msg = msg.slice(i + 1); } const ac = UI.askCid && CARDS[UI.askCid] ? UI.askCid : null; UI.askCid = null; const acH = ac ? `<div class="askcard" data-card="${ac}" style="display:flex;gap:8px;align-items:center;margin:6px 0">${cardHTML(ac, { cls: 'sm' })}<div class="note">使われたカード：<b>${esc(CARDS[ac].name)}</b><br>タップで詳細（効果・消費SpC）を見られます</div></div>` : ''; let btH = ''; const cb = typeof G !== 'undefined' && G && G.curBattle;
    if (cb && cb.att && cb.def && !cb.att.dead && !cb.def.dead) {
      const side = (u, lab) => `<div class="btside o${u.owner}" data-cid="${u.cid}" data-uid="${u.uid}"><div class="btlab">${lab}（${esc(G.players[u.owner].name)}）</div>${cardHTML(u.cid, { cls: 'sm' })}<div class="btnm">${esc(nm(u))}（${coord(u.x, u.y)}）</div><div class="btst">LP${u.lp} OP${OP(u)} DP${DP(u)}${armorTotal(u) > 0 ? ' 装甲' + armorTotal(u) : ''}</div></div>`;
      btH = `<div class="askbt">${side(cb.att, '攻撃側')}<div class="btvs">⚔</div>${side(cb.def, '防御側')}</div><div class="note" style="text-align:center">カードをタップで詳細</div>`;
    }
    el.classList.add('dock'); el.classList.toggle('hascard', !!ac || !!btH); el.innerHTML = `<div class="dbox">${big}${btH}${acH}<p>${esc(msg).replace(/\n/g, '<br>')}</p><div class="dbtn">${btns.map((b, i) => `<button class="btn ${i === 0 ? 'main' : ''}" data-i="${i}">${esc(b)}</button>`).join('')}</div></div>`; el.style.display = 'flex'; el.onclick = e => { { const bs = e.target.closest('.btside'); if (bs) { e.stopPropagation(); showDetail(bs.dataset.cid, bs.dataset.uid); return; } } if (e.target.closest('.askcard')) { e.stopPropagation(); showDetail(ac); return; } const b = e.target.closest('button[data-i]'); if (!b) return; SFX.play('select'); el.style.display = 'none'; el.classList.remove('dock', 'hascard'); el.onclick = null; res(btns[+b.dataset.i]); }; }); }

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
// 複数のカードを選ぶ（墓地から5枚以上など）。選んだカードの位置（番号）の配列を返す
function localPickCards(title, prompt, cids, min, max) {
  return new Promise(res => {
    const el = $('#dlg'), sel = new Set(), mn = Math.min(min || 1, cids.length);
    el.innerHTML = `<div class="dbox pickbox pickmulti"><div class="dbig">${esc(title)}</div><p>${esc(prompt)}</p><div class="pickgrid">${cids.map((c, i) => `<div class="pickc" data-pi="${i}">${cardHTML(c, { cls: 'sm' })}</div>`).join('')}</div><div class="note" style="text-align:center;margin:6px 0">タップで選択／もう一度タップで解除／長押しで詳細</div><div class="dbtn"><button class="btn" data-all>すべて選ぶ</button><button class="btn main" data-ok disabled></button></div></div>`;
    el.style.display = 'flex';
    const upd = () => { const ok = el.querySelector('[data-ok]'); ok.disabled = sel.size < mn; ok.textContent = max ? `決定（${sel.size}／${max}枚選択）` : `決定（${sel.size}枚選択／${mn}枚以上）`; el.querySelectorAll('.pickc').forEach(x => x.classList.toggle('sel', sel.has(+x.dataset.pi))); };
    upd();
    el.onclick = e => {
      if (e.target.closest('[data-ok]')) { if (sel.size >= mn) { SFX.play('select'); el.style.display = 'none'; el.onclick = null; res([...sel].sort((a, b) => a - b)); } return; }
      if (e.target.closest('[data-all]')) { if (max) return; cids.forEach((_, i) => sel.add(i)); SFX.play('select'); upd(); return; }
      const pc = e.target.closest('[data-pi]'); if (!pc || lpFired) return;
      const i = +pc.dataset.pi; if (sel.has(i)) sel.delete(i); else if (!max || sel.size < max) sel.add(i); SFX.play('select'); upd();
    };
  });
}
const SFX = (() => {
  let ctx = null, master = null, last = {}, on = true;
  try { on = Store.get('bg_sfx') !== '0'; } catch (e) { }
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
    set(v) { on = !!v; Store.set('bg_sfx', v ? '1' : '0'); if (on) get(); },
    unlock() { get(); },
    play(n) { try { const now = Date.now(); if (last[n] && now - last[n] < 60) return; last[n] = now; if (S[n]) S[n](); } catch (e) { } },
    card(cid) { this.play(forCard(cid)); },
  };
})();
