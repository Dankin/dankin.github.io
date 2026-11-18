// 仅供 art-char 自检：/src/art/char/preview.html?set=chars|hats|ui|fx&zoom=2&ids=xiaomi,abao
import { buildCharFrames, SPECS } from '../chars';
import { SS } from '../scale';
import { FX_KEYS } from '../fxart';
import { UI_KEYS, UI_SCREEN_KEYS } from '../ui';
import { buildHat, buildAuraRing, buildAuraGlow, buildTrail } from '../hat';

const q = new URLSearchParams(location.search);
const set = q.get('set') ?? 'chars';
const zoom = parseFloat(q.get('zoom') ?? '2');
const app = document.getElementById('app')!;
export function show(parent: HTMLElement, name: string, c: HTMLCanvasElement, k = zoom) {
  const d = document.createElement('div'); d.className = 'c';
  c.style.width = (c.width / SS * k) + 'px'; c.style.height = (c.height / SS * k) + 'px';
  d.appendChild(c); const t = document.createElement('div'); t.textContent = name; d.appendChild(t); parent.appendChild(d);
}
(async () => {
  if (set === 'chars') {
    const ids = (q.get('ids') ?? Object.keys(SPECS).join(',')).split(',');
    const only = q.get('only'); // 逗号分隔帧后缀
    for (const id of ids) {
      const t0 = performance.now();
      const fr = buildCharFrames(id);
      const row = document.createElement('div'); row.className = 'row';
      const h = document.createElement('h4'); h.textContent = id + ' ' + Math.round(performance.now() - t0) + 'ms'; row.appendChild(h);
      const keys = only ? only.split(',') : Object.keys(fr).filter((k) => k !== '0' && k !== '1');
      for (const k of keys) if (fr[k]) show(row, k, fr[k]);
      app.appendChild(row);
    }
  }
  if (set === 'fx') {
    const row = document.createElement('div'); row.className = 'row';
    for (const [k, f] of Object.entries(FX_KEYS)) show(row, k, f(), zoom);
    app.appendChild(row);
  }
  if (set === 'ui' || set === 'screens') {
    const src = set === 'ui' ? UI_KEYS : UI_SCREEN_KEYS; const only = q.get('only')?.split(',');
    const row = document.createElement('div'); row.className = 'row';
    for (const [k, f] of Object.entries(src)) { if (only && !only.includes(k)) continue; show(row, k, f(), zoom * 1.5); }
    app.appendChild(row); app.style.background = q.get('bg') ?? '#6a5a4a';
  }
  if (set === 'scale') { // 游戏内真实显示大小：k = PX(2) × 地图缩放
    const mz = parseFloat(q.get('mz') ?? '0.7');
    app.style.background = q.get('bg') ?? '#e8eef6';
    const row = document.createElement('div'); row.className = 'row'; row.style.alignItems = 'flex-end';
    for (const id of Object.keys(SPECS)) { const fr = buildCharFrames(id); show(row, id, fr[q.get('f') ?? 'walk_1'], 2 * mz); }
    app.appendChild(row);
  }
  if (set === 'hats') {
    const row = document.createElement('div'); row.className = 'row';
    for (let i = 0; i <= 5; i++) show(row, 'hat_' + i, buildHat(i), zoom);
    app.appendChild(row);
    const r2 = document.createElement('div'); r2.className = 'row';
    for (const f of ['blink', 'happy', 'worry'] as const) show(r2, 'hat5_' + f, buildHat(5, f), zoom);
    show(r2, 'aura_ring', buildAuraRing(), zoom); show(r2, 'aura_glow', buildAuraGlow(), zoom);
    show(r2, 'dot', buildTrail('dot'), zoom); show(r2, 'star', buildTrail('star'), zoom); show(r2, 'swirl', buildTrail('swirl'), zoom);
    app.appendChild(r2);
    app.style.background = q.get('bg') ?? '';
  }
  (window as unknown as { __ready: boolean }).__ready = true;
})();
