// preview-art-things.html 的入口:分区展示全部 things。URL 参数:?t=秒(冻结时间) &sec=transport,docks,...
import { drawTransport, TRANSPORT_W } from './transport.ts';
import { drawDock } from './docks.ts';
import { CHAR_KINDS, CHAR_NAMES, drawCharacter } from './characters.ts';
import { drawPanel, drawButton, drawPin, drawIcon, PANEL_KINDS, PANEL_NAMES, ICON_IDS, ICON_NAMES } from './ui.ts';
import type { Pose, ThingOpt } from './types.ts';

type C = CanvasRenderingContext2D;
const INKC = '#1b1410';
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

addSection({
  id: 'chars',
  title: '角色 12 种 × 姿态(idle / shake / catch / cheer / hit)',
  w: 760,
  h: 320,
  draw(c, t, o) {
    const poses: Pose[] = ['idle', 'shake', 'catch', 'cheer', 'hit'];
    c.fillStyle = INKC;
    c.font = '9px sans-serif';
    for (let r = 0; r < 5; r++) {
      c.fillText(poses[r], 2, 50 + r * 60);
      CHAR_KINDS.forEach((k, i) => {
        drawCharacter(c, k, 70 + i * 56, 60 + r * 60, 1, { ...o, t, pose: poses[r], seed: 3, n: 3, p: (o.unload ?? 0) > 0 ? o.unload : undefined, bite: r === 4 && k === 'manman' });
        if (r === 0) c.fillText(CHAR_NAMES[k], 50 + i * 56, 8);
      });
    }
  },
});

addSection({
  id: 'ui',
  title: 'UI 框(九宫格拉伸)/ 按钮 / 图钉 / 11 关卡图标',
  w: 760,
  h: 430,
  draw(c, t) {
    c.fillStyle = '#9ec7a0';
    c.fillRect(0, 0, 760, 430);
    c.fillStyle = INKC;
    c.font = '9px sans-serif';
    // 面板:两种尺寸
    let x = 10;
    for (const k of PANEL_KINDS) {
      c.fillStyle = INKC;
      c.fillText(PANEL_NAMES[k], x, 10);
      const r = drawPanel(c, k, x, 14, 140, k === 'top' ? 30 : 56);
      c.fillStyle = INKC;
      c.font = '12px "Kaiti SC",serif';
      c.fillText('苹果 128', r[0] + 2, r[1] + 14);
      c.font = '9px sans-serif';
      x += 150;
    }
    drawPanel(c, 'card', 10, 84, 350, 74);
    const r2 = drawPanel(c, 'narr', 380, 84, 360, 74);
    c.fillStyle = INKC;
    c.font = '13px "Kaiti SC",serif';
    c.fillText('老徐:「树不会骗人,摇一摇就知道。」', r2[0], r2[1] + 22);
    drawPanel(c, 'top', 10, 168, 740, 32);
    drawPanel(c, 'inv', 10, 206, 360, 36);
    drawPanel(c, 'news', 380, 206, 360, 36);
    // 按钮
    const tones = ['cream', 'leaf', 'wood', 'apple'] as const;
    tones.forEach((tn, i) => {
      drawButton(c, 10 + i * 100, 252, 88, 32, '摇一摇', { tone: tn });
      drawButton(c, 10 + i * 100, 290, 88, 32, '按下', { tone: tn, pressed: true });
    });
    drawButton(c, 410, 252, 88, 32, '禁用', { disabled: true });
    drawButton(c, 510, 252, 150, 40, '开始运苹果', { tone: 'apple', font: 16 });
    drawPin(c, 430, 330, 1.4, {});
    drawPin(c, 470, 330, 1.4, { col: '#4c7ec9' });
    drawPin(c, 510, 330, 1, {});
    // 图标
    ICON_IDS.forEach((id, i) => {
      drawIcon(c, id, 36 + i * 64, 380 + Math.sin(t * 2 + i) * 0, 1, { lit: i % 2 === 0, locked: i === 10 });
      c.fillStyle = INKC;
      c.font = '9px sans-serif';
      c.textAlign = 'center';
      c.fillText(ICON_NAMES[id], 36 + i * 64, 424);
      c.textAlign = 'left';
    });
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
