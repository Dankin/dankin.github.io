import { APPLE_DEFS, APPLE_STATES, appleSprite, bakeStats, drawTree, spawnLeaves, stepLeaves, drawLeaves, LeafP, TREE_TIER_NAMES, drawBackdrop, BackdropMode, drawBuilding, BUILDING_NAMES } from './index';

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
const qs0 = new URLSearchParams(location.search);
const anims: ((t: number, dt: number) => void)[] = [];
const shakeEl = document.getElementById('shake') as HTMLInputElement, animEl = document.getElementById('anim') as HTMLInputElement;
function trees() {
  const night = +(qs0.get('night') || 0), bg = night ? '#1d2a4a' : '#bfe3f2', cols = 5, CW = 340, H = 610;
  const d = sec('树 5 档 × 2 变体(上=密植 v0,下=粗壮 v1) — ?night=1 夜景;shake 滑块/动画');
  const leaves: LeafP[] = [];
  for (let v = 0; v < 2; v++) {
    const [c, x] = mk(cols * CW, H, bg); d.appendChild(c); d.appendChild(document.createElement('br'));
    const draw = (t: number, dt: number) => {
      x.clearRect(0, 0, c.width, c.height); x.fillStyle = bg; x.fillRect(0, 0, cols * CW, H);
      const sh = animEl.checked ? Math.abs(Math.sin(t * 0.8)) : +shakeEl.value;
      for (let i = 0; i < cols; i++) {
        const ox = i * CW + CW / 2;
        drawTree(x, ox, H - 20, 1, { tier: (i + 1) as 1, variant: v as 0, shake: sh, t, seed: 1, night });
        if (i === 4 && v === 0) { if (sh > 0.5 && Math.random() < 0.3) spawnLeaves(leaves, ox, H - 200, 2, 90); }
      }
      stepLeaves(leaves, dt); drawLeaves(x, leaves);
      x.fillStyle = night ? '#fff' : '#1b1410'; x.font = '13px sans-serif'; TREE_TIER_NAMES.forEach((n, i) => x.fillText(`${i + 1} ${n} v${v}`, i * CW + 6, H - 4));
    };
    draw(0, 0.016); anims.push(draw);
  }
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
      drawTree(x, w * 0.5, h * 0.9, h > w ? 0.9 : 0.8, { tier: 3, seed: 2 });
      drawBackdrop(x, w, h, t, { mode: m, layers: 'front' });
    });
  }
}
function buildings() {
  const d = sec('生产建筑 5 档 × 2 变体 (480×320)');
  const [c, x] = mk(980, 5 * 330 + 10, '#f3ecd6'); d.appendChild(c);
  x.font = '14px sans-serif';
  for (let t = 1; t <= 5; t++) for (let v = 0; v < 2; v++) {
    const ox = 250 + v * 490, oy = (t - 1) * 330 + 316;
    drawBuilding(x, ox, oy, 1, { tier: t as 1, variant: v as 0, seed: 1 });
    x.fillStyle = '#1b1410'; x.fillText(`${t} ${BUILDING_NAMES[t - 1]} v${v}`, ox - 236, oy - 296);
  }
}
function scene() {
  const d = sec('场景合成:背景+建筑(横 844×390 / 竖 390×844)');
  for (const [w, h, sc] of [[844, 390, 0.62], [390, 844, 0.6]] as const) {
    const [c, x] = mk(w, h); d.appendChild(c);
    anims.push((t) => {
      drawBackdrop(x, w, h, t, { mode: 'day', layers: 'back' });
      drawBuilding(x, w * 0.5, h * 0.93, sc, { tier: 3, variant: 0, ground: false });
      drawBackdrop(x, w, h, t, { mode: 'day', layers: 'front' });
    });
  }
}
function bench() {
  const w = 844, h = 390, [c, x] = mk(w, h); root.appendChild(c);
  const frame = (t: number) => {
    drawBackdrop(x, w, h, t, { mode: 'day', layers: 'back' });
    for (let i = 0; i < 3; i++) drawTree(x, 150 + i * 270, 340, 0.7, { tier: 3 + i % 3 as 3, seed: i, shake: i === 1 ? 0.6 : 0, t });
    drawBuilding(x, 420, 330, 0.5, { tier: 3 });
    for (let i = 0; i < 20; i++) appleSprite(APPLE_DEFS[i % 12].id, 'fresh', 32).draw(x, 40 + i * 38, 300 + (i % 3) * 8);
    drawBackdrop(x, w, h, t, { mode: 'day', layers: 'front' });
  };
  for (let i = 0; i < 20; i++) frame(i / 60);
  const t0 = performance.now(), N = 300; for (let i = 0; i < N; i++) frame(i / 60);
  const ms = (performance.now() - t0) / N; (window as any).__bench = ms;
  document.title = 'BENCH ' + ms.toFixed(3);
  const d = document.createElement('pre'); d.id = 'bench'; d.textContent = `bench full-frame draw: ${ms.toFixed(3)} ms/frame; ` + JSON.stringify(bakeStats()); root.appendChild(d);
}
const qs = new URLSearchParams(location.search); if (qs.get('shake')) shakeEl.value = qs.get('shake')!;
const secs: Record<string, () => void> = { apples, trees, backdrop, buildings, scene, bench };
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
