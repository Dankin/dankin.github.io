import { APPLE_DEFS, APPLE_STATES, appleSprite, bakeStats } from './index';

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
const secs: Record<string, () => void> = { apples };
const q = new URLSearchParams(location.search).get('sec');
for (const k of Object.keys(secs)) if (!q || q === k) secs[k]();
document.getElementById('info')!.textContent = JSON.stringify(bakeStats());

const sy = +(new URLSearchParams(location.search).get('y') || 0); if (sy) root.style.marginTop = -sy + 'px';
