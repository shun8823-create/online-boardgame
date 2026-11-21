/* ---------- イベント ---------- */
let lpTimer = null, lpFired = false;
function showBoardFull() { // パソコン：盤をA〜G・1〜7の表示ごと画面いっぱいに表示
  const bw = document.querySelector('.boardwrap'); if (!bw) return;
  let ov = document.getElementById('bfull'); if (ov) ov.remove();
  ov = document.createElement('div'); ov.id = 'bfull'; ov.dataset.t = Date.now();
  const cl = bw.cloneNode(true); cl.querySelectorAll('[data-act],[data-card]').forEach(n => { n.removeAttribute('data-act'); n.removeAttribute('data-card'); });
  ov.appendChild(cl); document.body.appendChild(ov);
  let cs = 100; const W = window.innerWidth - 32, H = window.innerHeight - 32;
  for (let k = 0; k < 4; k++) { ov.style.setProperty('--cs', cs + 'px'); const r = cl.getBoundingClientRect(); const f = Math.min(W / r.width, H / r.height); if (Math.abs(f - 1) < 0.01) break; cs = Math.max(30, cs * f - (f < 1 ? 0.5 : 0)); }
  ov.style.setProperty('--cs', cs.toFixed(1) + 'px');
  ov.onclick = () => { if (Date.now() - +ov.dataset.t < 400) return; ov.remove(); };
}
document.addEventListener('pointerdown', e => {
  if (PCV() && screen === 'battle' && !e.target.closest('#bfull') && e.button === 0) { const ce = e.target.closest('.board .cell'); if (ce && !ce.querySelector('.unit') && !e.target.closest('[data-card]')) { lpFired = false; clearTimeout(lpTimer); lpTimer = setTimeout(() => { lpFired = true; showBoardFull(); }, 600); return; } }
  const el = e.target.closest('[data-card]'); if (!el) return;
  lpFired = false; clearTimeout(lpTimer);
  lpTimer = setTimeout(() => { lpFired = true; showDetail(el.dataset.card, el.dataset.uid); }, 500);
});
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => document.addEventListener(ev, () => clearTimeout(lpTimer)));
document.addEventListener('scroll', () => clearTimeout(lpTimer), true);
document.addEventListener('contextmenu', e => { const el = e.target.closest('[data-card]'); if (el) { e.preventDefault(); lpFired = false; showDetail(el.dataset.card, el.dataset.uid); } });
document.addEventListener('click', onClick);
document.addEventListener('change', e => {
  const s = e.target.dataset.sel; if (!s) return;
  const v = e.target.value;
  if (s === 'loadDeck') { if (v) { loadDeck(v); renderBuilder(); } return; }
  if (s === 'prep.a') { PREP.a = v; renderPrep(); return; }
  if (s === 'prep.b') { PREP.b = v; renderPrep(); return; }
  if (s === 'prep.me') { PREP.me = v; renderPrep(); return; }
  if (s === 'prep.ai') { PREP.ai = v; renderPrep(); return; }
  if (s === 'prep.seat') { PREP.seat = +v; renderPrep(); return; }
  if (s === 'lob.deck') { if (LOB) { LOB.deckId = v; renderPrep(); } return; }
  const [sc, k] = s.split('.');
  if (sc === 'F') { F[k] = v; renderCards(); } else { B.F[k] = v; renderBuilder(); }
});
document.addEventListener('input', e => {
  const s = e.target.dataset.in;
  if (s === 'F.q') { F.q = e.target.value; fillGrid(); }
  else if (s === 'BF.q') { B.F.q = e.target.value; fillPool(); }
  else if (e.target.id === 'dname') B.name = e.target.value;
});
document.querySelectorAll('nav button').forEach(b => b.dataset.act = 'nav');
{ const sb = document.getElementById('sfxbtn'); if (sb) { const paint = () => { sb.textContent = SFX.on ? '🔊' : '🔇'; }; paint(); sb.onclick = e => { e.stopPropagation(); SFX.set(!SFX.on); paint(); SFX.play('select'); }; } }
show();
