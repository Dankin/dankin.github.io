// preview-art-things.html 的入口:分区展示全部 things。URL 参数:?t=秒(冻结时间) &sec=transport,docks,...
import { drawTransport, TRANSPORT_W } from './transport.ts';
import { drawDock } from './docks.ts';
import type { ThingOpt } from './types.ts';

type C = CanvasRenderingContext2D;
interface Sec {
  id: string;
  title: string;
  w: number;
  h: number;
  draw: (c: C, t: number, o: ThingOpt, z: number) => void;
}
const secs: Sec[] = [];
export function addSection(s: Sec): void {
  secs.push(s);
}

addSection({
  id: 'transport',
  title: '运输 6 档(上排空载,下排载苹果;宽 18/34/70/80/84/44)',
  w: 640,
  h: 200,
  draw(c, t, o) {
    const xs = [40, 100, 190, 310, 430, 560];
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 6; i++) {
        const y = 94 + row * 96;
        c.fillStyle = 'rgba(0,0,0,0.04)';
        c.fillRect(xs[i] - TRANSPORT_W[i] / 2, y - 1, TRANSPORT_W[i], 1);
        drawTransport(c, i, xs[i], y, 1, { ...o, t, load: row ? o.load : 0 });
      }
    }
  },
});

addSection({
  id: 'docks',
  title: '码头/站台 6 档(上排 crates=0,下排 crates=6;pulse 随时间)',
  w: 640,
  h: 220,
  draw(c, t, o) {
    const xs = [48, 130, 235, 345, 460, 575];
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < 6; i++) drawDock(c, i, xs[i], 100 + row * 100, 0.8, { ...o, t, crates: row ? 6 : 0, pulse: (t * 0.5) % 1 });
  },
});

const q = new URLSearchParams(location.search);
const only = q.get('sec')?.split(',');
if (q.has('z')) $z(q.get('z')!);
function $z(v: string): void { const e = document.getElementById('zoom') as HTMLSelectElement; e.innerHTML += `<option selected>${v}</option>`; e.value = v; }
const frozen = q.has('t') ? parseFloat(q.get('t')!) : null;
const root = document.getElementById('root')!;
const $ = (id: string) => document.getElementById(id) as HTMLInputElement;
const cvs: { s: Sec; c: HTMLCanvasElement }[] = [];
for (const s of secs) {
  if (only && !only.includes(s.id)) continue;
  const h = document.createElement('h2');
  h.textContent = s.title;
  root.appendChild(h);
  const c = document.createElement('canvas');
  root.appendChild(c);
  cvs.push({ s, c });
}
function resize(): void {
  const z = parseFloat($('zoom').value) || 1;
  const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
  for (const { s, c } of cvs) {
    c.width = Math.round(s.w * z * dpr);
    c.height = Math.round(s.h * z * dpr);
    c.style.width = s.w * z + 'px';
    c.style.height = s.h * z + 'px';
  }
}
resize();
$('zoom').addEventListener('change', resize);
let t0 = performance.now();
function frame(now: number): void {
  const z = parseFloat($('zoom').value) || 1;
  const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
  const t = frozen ?? ($('anim').checked ? (now - t0) / 1000 : 0);
  let unload = parseFloat($('unload').value);
  if ($('auto').checked) unload = (t * 0.4) % 1;
  const o: ThingOpt = { load: parseFloat($('load').value), move: parseFloat($('move').value), unload, dir: $('flip').checked ? -1 : 1 };
  for (const { s, c } of cvs) {
    const g = c.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.setTransform(z * dpr, 0, 0, z * dpr, 0, 0);
    s.draw(g, t, o, z);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
(window as unknown as { __ready: boolean }).__ready = true;
