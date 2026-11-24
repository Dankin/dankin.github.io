// 本目录自用的简化苹果(体积感:深红渐变 + 高光 + 叶 + 粗描边),最终由 art-nature 的 sprite 统一替换。
import { PAL } from '../style.ts';
import { bake, blit, qOf } from './bake.ts';
import type { C } from './bake.ts';
import { INK, TAU } from './ink.ts';

export interface AppleOpt {
  gold?: boolean;
  /** 绿苹果(青苹果) */
  green?: boolean;
  /** 叶子 */
  leaf?: boolean;
  alpha?: number;
}

function paint(g: C, r: number, o: AppleOpt): void {
  const lw = Math.max(0.7, Math.min(1.5, r * 0.17));
  const hi = o.gold ? '#fff4a6' : o.green ? '#d6f08a' : PAL.appleLight;
  const mid = o.gold ? PAL.gold : o.green ? '#8cc63f' : PAL.apple;
  const lo = o.gold ? '#b8820a' : o.green ? '#4f8a2a' : PAL.appleDark;
  const body = () => {
    g.beginPath();
    g.moveTo(0, -r * 0.7);
    g.bezierCurveTo(r * 0.45, -r * 1.02, r * 1.08, -r * 0.55, r * 1.0, r * 0.1);
    g.bezierCurveTo(r * 0.95, r * 0.78, r * 0.45, r * 1.02, 0, r * 0.86);
    g.bezierCurveTo(-r * 0.45, r * 1.02, -r * 0.95, r * 0.78, -r * 1.0, r * 0.1);
    g.bezierCurveTo(-r * 1.08, -r * 0.55, -r * 0.45, -r * 1.02, 0, -r * 0.7);
    g.closePath();
  };
  // 柄
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, -r * 0.6);
  g.quadraticCurveTo(r * 0.06, -r * 1.05, r * 0.28, -r * 1.2);
  g.strokeStyle = INK;
  g.lineWidth = lw * 2.4;
  g.stroke();
  g.strokeStyle = PAL.trunk;
  g.lineWidth = lw * 1.1;
  g.stroke();
  // 体
  body();
  const gr = g.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r * 1.25);
  gr.addColorStop(0, hi);
  gr.addColorStop(0.42, mid);
  gr.addColorStop(1, lo);
  g.fillStyle = gr;
  g.fill();
  // 高光
  g.save();
  g.translate(-r * 0.42, -r * 0.32);
  g.rotate(-0.7);
  g.beginPath();
  g.ellipse(0, 0, r * 0.2, r * 0.36, 0, 0, TAU);
  g.fillStyle = 'rgba(255,255,255,0.88)';
  g.fill();
  g.restore();
  g.beginPath();
  g.arc(-r * 0.14, -r * 0.62, r * 0.07, 0, TAU);
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.fill();
  // 描边
  body();
  g.lineWidth = lw;
  g.lineJoin = 'round';
  g.strokeStyle = INK;
  g.stroke();
  // 叶
  if (o.leaf !== false) {
    g.save();
    g.translate(r * 0.2, -r * 1.12);
    g.rotate(-0.45);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(r * 0.3, -r * 0.5, r * 0.75, -r * 0.18);
    g.quadraticCurveTo(r * 0.4, r * 0.18, 0, 0);
    g.fillStyle = o.green ? '#4f8a2a' : PAL.leaf;
    g.fill();
    g.lineWidth = lw * 0.9;
    g.strokeStyle = INK;
    g.stroke();
    g.restore();
  }
}

const rb = (r: number) => Math.max(1, Math.round(r * 2) / 2);

/** 以 (cx,cy) 为中心,r 为半径(世界单位)画一个体积感苹果 */
export function drawApple(ctx: C, cx: number, cy: number, r: number, o: AppleOpt = {}): void {
  const rr = rb(r);
  const q = qOf(ctx, r / rr);
  const b = bake(`apple|${o.gold ? 'g' : o.green ? 'n' : 'r'}|${o.leaf === false ? 0 : 1}|${rr}`, [-rr * 1.3, -rr * 1.75, rr * 1.3, rr * 1.2], q, (g) => paint(g, rr, o));
  const a = o.alpha ?? 1;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * a;
  blit(ctx, b, cx, cy, r / rr);
  ctx.globalAlpha = prev;
}

/** 一小堆苹果(丘形),用于装载。n 为个数;(x,y)=堆底中心 */
export function appleHeap(ctx: C, x: number, y: number, n: number, r: number, w: number, seedShift = 0): void {
  if (n <= 0) return;
  const maxCap = Math.max(1, Math.floor(w / (r * 1.8)));
  let cap = Math.min(maxCap, Math.max(1, Math.ceil(n * 0.6)));
  const rows: number[] = [];
  let left = n;
  while (left > 0) {
    const m = Math.min(cap, left);
    rows.push(m);
    left -= m;
    cap = Math.max(2, cap - 1);
  }
  rows.forEach((m, ri) => {
    const yy = y - ri * r * 1.3;
    for (let i = 0; i < m; i++) {
      const xx = x + (i - (m - 1) / 2) * r * 1.8 + (((seedShift + ri * 3 + i * 5) % 3) - 1) * r * 0.1;
      drawApple(ctx, xx, yy - r * 0.5, r, { leaf: (ri + i + seedShift) % 3 === 0 });
    }
  });
}
