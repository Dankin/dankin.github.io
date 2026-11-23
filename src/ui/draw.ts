export const RED = '#e0202a';
export const GOLD = '#f2b705';
export const INK = '#111';

type C = CanvasRenderingContext2D;

export function drawApple(c: C, x: number, y: number, r: number, color: string, line = 2): void {
  c.fillStyle = color;
  c.strokeStyle = INK;
  c.lineWidth = line;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.beginPath(); // 高光
  c.strokeStyle = '#fff';
  c.lineWidth = Math.max(1, line * 0.7);
  c.arc(x, y, r * 0.62, Math.PI * 1.1, Math.PI * 1.45);
  c.stroke();
  c.beginPath(); // 叶柄
  c.strokeStyle = INK;
  c.lineWidth = line;
  c.moveTo(x, y - r);
  c.lineTo(x + r * 0.25, y - r * 1.5);
  c.stroke();
}

export const TAU = Math.PI * 2;
export const BAND_BG = '#f3f3f3';

/** 四角星/闪光(只建路径,调用方 fill/stroke) */
export function sparklePath(c: C, x: number, y: number, r: number, rot = 0): void {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    const rr = i % 2 ? r * 0.38 : r;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i) c.lineTo(px, py);
    else c.moveTo(px, py);
  }
  c.closePath();
}

const glows = new Map<string, HTMLCanvasElement>();
/** 预渲染径向光晕(每种颜色只建一次),用 drawImage 贴,避免每帧建渐变 */
export function glow(c: C, color: string, x: number, y: number, r: number, alpha: number): void {
  if (alpha <= 0.01) return;
  let g = glows.get(color);
  if (!g) {
    g = document.createElement('canvas');
    g.width = g.height = 96;
    const gc = g.getContext('2d')!;
    const grd = gc.createRadialGradient(48, 48, 0, 48, 48, 48);
    grd.addColorStop(0, color);
    grd.addColorStop(0.35, color + '99');
    grd.addColorStop(1, color + '00');
    gc.fillStyle = grd;
    gc.fillRect(0, 0, 96, 96);
    glows.set(color, g);
  }
  const pa = c.globalAlpha;
  c.globalAlpha = pa * Math.min(1, alpha);
  c.drawImage(g, x - r, y - r, r * 2, r * 2);
  c.globalAlpha = pa;
}

/** 咬了 n 口的苹果:ang 为第一口缺口方向(弧度),bg 为缺口露出的底色 */
export function drawBitApple(c: C, x: number, y: number, r: number, color: string, line: number, ang: number, bg: string, n = 1): void {
  drawApple(c, x, y, r, color, line);
  for (let i = 0; i < n; i++) {
    const a = ang + i * 1.25;
    const rr = r * (i === 0 ? 0.46 : 0.4);
    const nx = x + Math.cos(a) * r * 0.98;
    const ny = y + Math.sin(a) * r * 0.98;
    c.save();
    c.beginPath();
    c.arc(x, y, r + line, 0, TAU);
    c.clip();
    c.fillStyle = bg;
    c.beginPath();
    c.arc(nx, ny, rr, 0, TAU);
    c.fill();
    c.restore();
    c.save();
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.clip();
    c.strokeStyle = INK;
    c.lineWidth = line;
    c.beginPath();
    c.arc(nx, ny, rr, 0, TAU);
    c.stroke();
    c.restore();
  }
}

let goldSpr: HTMLCanvasElement | null = null;
/** 精致的金苹果(渐变 + 高光 + 叶子),一次预渲染,画时只 drawImage。x,y 为苹果中心,r 为半径 */
export function goldApple(c: C, x: number, y: number, r: number): void {
  if (!goldSpr) {
    const S = 160;
    goldSpr = document.createElement('canvas');
    goldSpr.width = goldSpr.height = S;
    const g = goldSpr.getContext('2d')!;
    const m = S / 2;
    const R = S * 0.34;
    const body = (): void => {
      g.beginPath();
      g.moveTo(m, m - R * 0.78);
      g.bezierCurveTo(m + R * 0.5, m - R * 1.25, m + R * 1.35, m - R * 0.55, m + R * 1.1, m + R * 0.35);
      g.bezierCurveTo(m + R * 0.9, m + R * 1.05, m + R * 0.35, m + R * 1.2, m, m + R * 1.0);
      g.bezierCurveTo(m - R * 0.35, m + R * 1.2, m - R * 0.9, m + R * 1.05, m - R * 1.1, m + R * 0.35);
      g.bezierCurveTo(m - R * 1.35, m - R * 0.55, m - R * 0.5, m - R * 1.25, m, m - R * 0.78);
      g.closePath();
    };
    const grd = g.createRadialGradient(m - R * 0.4, m - R * 0.4, R * 0.1, m, m, R * 1.5);
    grd.addColorStop(0, '#fff6b0');
    grd.addColorStop(0.35, '#ffd83a');
    grd.addColorStop(0.8, '#f2b705');
    grd.addColorStop(1, '#c98a00');
    body();
    g.fillStyle = grd;
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = INK;
    g.lineJoin = 'round';
    g.stroke();
    // 高光
    g.strokeStyle = 'rgba(255,255,255,.9)';
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(m, m + R * 0.05, R * 0.78, Math.PI * 1.08, Math.PI * 1.42);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.beginPath();
    g.ellipse(m - R * 0.55, m - R * 0.35, R * 0.13, R * 0.2, -0.5, 0, TAU);
    g.fill();
    // 茎与叶
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(m, m - R * 0.72);
    g.quadraticCurveTo(m + R * 0.05, m - R * 1.15, m + R * 0.22, m - R * 1.3);
    g.stroke();
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(m + R * 0.5, m - R * 1.18, R * 0.34, R * 0.16, -0.5, 0, TAU);
    g.fill();
    g.lineWidth = 3.5;
    g.stroke();
  }
  c.drawImage(goldSpr, x - r * 1.22, y - r * 1.25, r * 2.45, r * 2.45);
}
