import { APPLE_DEFS, APPLE_STATES, appleSprite, bakeStats, drawTree, spawnLeaves, stepLeaves, drawLeaves, LeafP, TREE_TIER_NAMES, drawBackdrop, BackdropMode } from './index';

const root = document.getElementById('root')!;
const DPR = Math.min(2, devicePixelRatio || 1);
function mk(w: number, h: number, bg?: string) {
  const c = document.createElement('canvas'); c.width = w * DPR; c.height = h * DPR; c.style.width = w + 'px'; c.style.height = h + 'px';
  const x = c.getContext('2d')!; x.scale(DPR, DPR); if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); } return [c, x] as const;
}
function sec(title: string) { const h = document.createElement('h2'); h.textContent = title; root.appendChild(h); const d = document.createElement('div'); d.className = 'row'; root.appendChild(d); return d; }

function apples() {
  const d = sec('苹果 18 品种 × 5 状态 (64px / 32px)');
  const [c, x] = mk(APPLE_STATES.length * 74 + 130, APPLE_DEFS.length * 74 + 10, '#bfe3f2');
  x.fillStyle = '#7bb83d'; x.fillRect(0, 0, 100, APPLE_DEFS.length * 74 + 10);
  d.appendChild(c);
  x.font = '12px sans-serif'; x.fillStyle = '#1b1410';
  APPLE_DEFS.forEach((a, i) => {
    x.fillText(a.name, 6, i * 74 + 40);
    APPLE_STATES.forEach((s, j) => {
      appleSprite(a.id, s, 64, true).draw(x, 100 + j * 74 + 37, i * 74 + 66);
      appleSprite(a.id, s, 32).draw(x, 100 + j * 74 + 37 + 28, i * 74 + 66);
    });
  });
}
const anims: ((t: number, dt: number) => void)[] = [];
const shakeEl = document.getElementById('shake') as HTMLInputElement, animEl = document.getElementById('anim') as HTMLInputElement;
function trees() {
  const d = sec('树 5 档 (256×320) — 拖动 shake / 勾选动画');
  const [c, x] = mk(5 * 262, 330, '#bfe3f2'); d.appendChild(c);
  const leaves: LeafP[] = [];
  const draw = (t: number, dt: number) => {
    x.clearRect(0, 0, c.width, c.height); x.fillStyle = '#bfe3f2'; x.fillRect(0, 0, 5 * 262, 330);
    const sh = animEl.checked ? Math.abs(Math.sin(t * 0.8)) : +shakeEl.value;
    for (let i = 0; i < 5; i++) drawTree(x, i * 262 + 131, 312, 1, { tier: (i + 1) as 1, shake: sh, t, seed: 1 });
    if (sh > 0.5 && Math.random() < 0.3) spawnLeaves(leaves, 4 * 262 + 131, 150, 2, 90);
    stepLeaves(leaves, dt); drawLeaves(x, leaves);
    x.fillStyle = '#1b1410'; x.font = '12px sans-serif'; TREE_TIER_NAMES.forEach((n, i) => x.fillText(`${i + 1} ${n}`, i * 262 + 6, 322));
  };
  draw(0, 0.016); anims.push(draw);
}
function backdrop() {
  const d = sec('背景 白天/黄昏/夜晚 横屏 844×390 + 竖屏 390×844(树5/树3 放置示意)');
  const modes: BackdropMode[] = ['day', 'dusk', 'night'];
  const items: [BackdropMode, number, number][] = [...modes.map((m) => [m, 844, 390] as [BackdropMode, number, number]), ...modes.map((m) => [m, 390, 844] as [BackdropMode, number, number])];
  const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px'; d.appendChild(wrap);
  for (const [m, w, h] of items) {
    const [c, x] = mk(w, h); wrap.appendChild(c);
    anims.push((t) => {
      drawBackdrop(x, w, h, t, { mode: m, layers: 'back' });
      drawTree(x, w * 0.5, h * 0.9, h > w ? 0.9 : 0.8, { tier: 4, seed: 2 });
      drawBackdrop(x, w, h, t, { mode: m, layers: 'front' });
    });
  }
}
const qs = new URLSearchParams(location.search); if (qs.get('shake')) shakeEl.value = qs.get('shake')!;
const secs: Record<string, () => void> = { apples, trees, backdrop };
const q = new URLSearchParams(location.search).get('sec');
for (const k of Object.keys(secs)) if (!q || q === k) secs[k]();
document.getElementById('info')!.textContent = JSON.stringify(bakeStats());

const sy = +(new URLSearchParams(location.search).get('y') || 0); if (sy) root.style.marginTop = -sy + 'px';

let last = performance.now(), frames = 0, acc = 0;
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (animEl.checked || shakeEl.value !== '0' || true) { const t0 = performance.now(); anims.forEach((f) => f(now / 1000, dt)); acc += performance.now() - t0; frames++; }
  if (frames >= 30) { document.getElementById('fps')!.textContent = `draw ${(acc / frames).toFixed(2)}ms/frame`; frames = 0; acc = 0; }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
