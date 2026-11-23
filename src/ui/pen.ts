/** v4 线稿画笔:主题色板 + 局部单位 + 常用形状。所有形状都是 描边 + 填充。 */
export const TAU = Math.PI * 2;
type C = CanvasRenderingContext2D;

export const P = {
  ink: '#1d1a17',
  paper: '#f4f1ea',
  ground: '#ebe7dc',
  f0: '#fbfaf6',
  f1: '#e7e3d9',
  f2: '#cfcabd',
  f3: '#a39e91',
  dim: '#8d887c',
};
export let APPLE = '#d9342b';
export let GOLDC = '#e0a800';
export let DARK = false;

export function setTheme(dark: boolean): void {
  DARK = dark;
  APPLE = '#e0382e';
  if (dark) {
    P.ink = '#ece8dc';
    P.paper = '#16171b';
    P.ground = '#1d1f24';
    P.f0 = '#262830';
    P.f1 = '#2f323b';
    P.f2 = '#434752';
    P.f3 = '#6a6f7c';
    P.dim = '#8a8f9c';
    GOLDC = '#f2b705';
  } else {
    P.ink = '#1d1a17';
    P.paper = '#f4f1ea';
    P.ground = '#ebe7dc';
    P.f0 = '#fbfaf6';
    P.f1 = '#e7e3d9';
    P.f2 = '#cfcabd';
    P.f3 = '#a39e91';
    P.dim = '#8d887c';
    GOLDC = '#e0a800';
  }
}

/* 局部单位:K = 当前 1 局部单位对应的屏幕像素,用于保持线宽恒定 */
let K = 1;
const ks: number[] = [];
export function setUnit(k: number): void {
  K = k;
  ks.length = 0;
}
export const unit = (): number => K;
export function sv(c: C, x: number, y: number, s = 1, rot = 0): void {
  c.save();
  c.translate(x, y);
  if (rot) c.rotate(rot);
  if (s !== 1) c.scale(s, s);
  ks.push(K);
  K *= s;
}
export function rs(c: C): void {
  c.restore();
  K = ks.pop() ?? 1;
}
export function pen(c: C, px = 1.5, col: string = P.ink): void {
  c.lineWidth = px / K;
  c.strokeStyle = col;
  c.lineCap = 'round';
  c.lineJoin = 'round';
}

export function circ(c: C, x: number, y: number, r: number, fill: string | null = P.f0, line = 1.5): void {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (line > 0) {
    pen(c, line);
    c.stroke();
  }
}
export function rect(c: C, x: number, y: number, w: number, h: number, fill: string | null = P.f0, line = 1.5, r = 0): void {
  c.beginPath();
  if (r > 0) c.roundRect(x, y, w, h, r);
  else c.rect(x, y, w, h);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (line > 0) {
    pen(c, line);
    c.stroke();
  }
}
export function poly(c: C, pts: number[], fill: string | null = P.f0, line = 1.5, close = true): void {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  if (close) c.closePath();
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (line > 0) {
    pen(c, line);
    c.stroke();
  }
}
export function seg(c: C, x1: number, y1: number, x2: number, y2: number, px = 1.5, col: string = P.ink): void {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  pen(c, px, col);
  c.stroke();
}
/** 多个圆的并集,只留外轮廓 */
export function blob(c: C, cs: number[], fill: string = P.f1, line = 1.6): void {
  pen(c, line * 2);
  for (let i = 0; i < cs.length; i += 3) {
    c.beginPath();
    c.arc(cs[i], cs[i + 1], cs[i + 2], 0, TAU);
    c.stroke();
  }
  c.fillStyle = fill;
  for (let i = 0; i < cs.length; i += 3) {
    c.beginPath();
    c.arc(cs[i], cs[i + 1], cs[i + 2], 0, TAU);
    c.fill();
  }
}
/** 苹果:红 + 描边 + 叶柄 + 高光 */
export function apple(c: C, x: number, y: number, r: number, line = 1.2): void {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fillStyle = APPLE;
  c.fill();
  pen(c, line);
  c.stroke();
  if (r * K > 3.2) {
    seg(c, x, y - r, x + r * 0.25, y - r * 1.5, line);
    c.beginPath();
    c.arc(x, y, r * 0.58, Math.PI * 1.1, Math.PI * 1.45);
    pen(c, Math.max(0.8, line * 0.7), 'rgba(255,255,255,.85)');
    c.stroke();
  }
}
/** 苹果形轮廓路径(用于大门/大厦) */
export function applePath(c: C, x: number, y: number, r: number): void {
  c.beginPath();
  c.moveTo(x, y - r * 0.7);
  c.bezierCurveTo(x + r * 0.5, y - r * 1.15, x + r * 1.25, y - r * 0.5, x + r * 1.02, y + r * 0.3);
  c.bezierCurveTo(x + r * 0.85, y + r * 0.98, x + r * 0.3, y + r * 1.12, x, y + r * 0.92);
  c.bezierCurveTo(x - r * 0.3, y + r * 1.12, x - r * 0.85, y + r * 0.98, x - r * 1.02, y + r * 0.3);
  c.bezierCurveTo(x - r * 1.25, y - r * 0.5, x - r * 0.5, y - r * 1.15, x, y - r * 0.7);
  c.closePath();
}
export function sparkle(c: C, x: number, y: number, r: number, col: string = P.ink, rot = 0): void {
  c.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = rot + (i * Math.PI) / 2;
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  pen(c, 1.3, col);
  c.stroke();
  c.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = rot + Math.PI / 4 + (i * Math.PI) / 2;
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
  }
  c.stroke();
}
const FONT = '-apple-system, "PingFang SC", "Helvetica Neue", sans-serif';
/** 文字,px 为屏幕像素 */
export function text(c: C, s: string, x: number, y: number, px: number, col: string = P.ink, align: CanvasTextAlign = 'center', weight = 700): void {
  c.font = `${weight} ${px / K}px ${FONT}`;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillStyle = col;
  c.fillText(s, x, y);
}
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const ease = (t: number): number => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
