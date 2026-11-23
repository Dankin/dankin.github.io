import { GOLD, INK, RED, TAU, sparklePath } from './draw.ts';

type C = CanvasRenderingContext2D;
const FONT = '-apple-system, "PingFang SC", "Helvetica Neue", sans-serif';

/* ---------- 局部坐标栈:push 之后,1 个局部单位 = S 个屏幕像素 ---------- */
let S = 1;
const stack: number[] = [];
let depth = 0;
export function resetFrame(): void {
  S = 1;
  depth = 0;
}
export function push(c: C, x: number, y: number, k: number): void {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  stack[depth++] = S;
  S *= k;
}
export function pop(c: C): void {
  c.restore();
  S = stack[--depth];
}
export const scale = (): number => S;

/** 设线宽(按屏幕像素)与线稿样式 */
export function ln(c: C, px = 1.6, color: string = INK): void {
  c.lineWidth = Math.max(px, 1) / S;
  c.strokeStyle = color;
  c.lineCap = 'round';
  c.lineJoin = 'round';
}

export function disc(c: C, x: number, y: number, r: number, fill: string | null, stroke = true): void {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) c.stroke();
}

export function ell(c: C, x: number, y: number, rx: number, ry: number, fill: string | null, stroke = true, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, TAU);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) c.stroke();
}

/** 带描边的粗线段(肢体) */
export function limb(c: C, x1: number, y1: number, x2: number, y2: number, w: number, fill: string): void {
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.strokeStyle = INK;
  c.lineWidth = w + 2.6 / S;
  c.stroke();
  c.strokeStyle = fill;
  c.lineWidth = w;
  c.stroke();
}

/** 文字:px 为屏幕像素字号 */
export function txt(c: C, str: string, x: number, y: number, px: number, color: string = INK, align: CanvasTextAlign = 'center', halo = false, weight = 700): void {
  c.save();
  c.translate(x, y);
  c.scale(1 / S, 1 / S);
  c.font = `${weight} ${px}px ${FONT}`;
  c.textAlign = align;
  c.textBaseline = 'middle';
  if (halo) {
    c.lineWidth = 3;
    c.strokeStyle = '#fff';
    c.lineJoin = 'round';
    c.strokeText(str, 0, 0);
  }
  c.fillStyle = color;
  c.fillText(str, 0, 0);
  c.restore();
}

const wcache = new Map<string, number>();
/** 文字宽度(屏幕像素),带缓存 */
export function textW(c: C, str: string, px: number, weight = 700): number {
  const key = `${weight}|${px}|${str}`;
  let w = wcache.get(key);
  if (w === undefined) {
    c.save();
    c.font = `${weight} ${px}px ${FONT}`;
    w = c.measureText(str).width;
    c.restore();
    wcache.set(key, w);
  }
  return w;
}

/** 对话气泡,(x,y) 为尖角位置 */
export function bubble(c: C, str: string, x: number, y: number, px: number, alpha = 1, color: string = INK): void {
  const tw = textW(c, str, px);
  c.save();
  c.translate(x, y);
  c.scale(1 / S, 1 / S);
  c.globalAlpha *= alpha;
  const bw = tw + 14;
  const bh = px + 10;
  c.fillStyle = '#fff';
  c.strokeStyle = INK;
  c.lineWidth = 1.5;
  c.lineJoin = 'round';
  c.beginPath();
  c.roundRect(-bw / 2, -bh - 7, bw, bh, 8);
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(-4, -8);
  c.lineTo(0, 0);
  c.lineTo(4.5, -8);
  c.fillStyle = '#fff';
  c.fill();
  c.beginPath();
  c.moveTo(-4, -7.5);
  c.lineTo(0, 0);
  c.lineTo(4.5, -7.5);
  c.stroke();
  c.beginPath();
  c.moveTo(-3, -7.2);
  c.lineTo(3.6, -7.2);
  c.strokeStyle = '#fff';
  c.lineWidth = 2.4;
  c.stroke();
  c.font = `700 ${px}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = color;
  c.fillText(str, 0, -7 - bh / 2 + 0.5);
  c.restore();
}

/* ============================ 牛顿 ============================ */
const CURLS: ReadonlyArray<readonly [number, number, number]> = [
  [-10, -5, 9], [-14, 7, 8], [-11, 18, 7.5], [15, -1, 8], [17, 10, 7], [-1, -13, 10], [10, -11, 9], [-7, -12, 9],
];

export interface NewtonOpt {
  t: number;
  /** 被砸的强度包络 0..1 */
  hit: number;
  /** 圣诞:戴红帽? 不用,留作扩展 */
  still?: boolean;
}

/** 坐着看书的牛顿,脚在 (x,y),总高约 h 像素 */
export function newton(c: C, x: number, y: number, h: number, o: NewtonOpt): void {
  push(c, x, y, h / 100);
  const t = o.t;
  const hit = o.hit;
  ln(c, 1.5);
  ell(c, 8, 1, 30, 3.4, 'rgba(0,0,0,.09)', false);
  // 腿:马裤 + 白袜 + 黑鞋
  limb(c, 0, -14, 17, -27, 10, '#ececec');
  limb(c, 17, -27, 31, -6, 7, '#fff');
  ell(c, 35, -3, 8.5, 4.2, INK, false);
  c.save();
  c.translate(0, -14);
  c.rotate(hit * 0.3);
  c.translate(0, 14);
  // 长礼服
  c.beginPath();
  c.moveTo(-11, -60);
  c.quadraticCurveTo(0, -67, 11, -60);
  c.lineTo(16, -22);
  c.quadraticCurveTo(14, -8, -2, -8);
  c.lineTo(-24, -9);
  c.quadraticCurveTo(-22, -34, -11, -60);
  c.closePath();
  c.fillStyle = INK;
  c.fill();
  c.stroke();
  c.fillStyle = '#fff';
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.arc(3 + i, -52 + i * 8, 1.3, 0, TAU);
    c.fill();
  }
  // 领巾
  c.beginPath();
  c.moveTo(-1, -62);
  c.lineTo(11, -62);
  c.lineTo(5, -50);
  c.closePath();
  c.fillStyle = '#fff';
  c.fill();
  ln(c, 1.2);
  c.stroke();
  ln(c, 1.5);
  // 手臂 + 书
  limb(c, 3, -57, 17, -43, 8, INK);
  c.beginPath();
  c.moveTo(11, -47);
  c.lineTo(33, -43);
  c.lineTo(31, -29);
  c.lineTo(9, -33);
  c.closePath();
  c.fillStyle = '#fff';
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(21, -45);
  c.lineTo(20, -31);
  c.stroke();
  ln(c, 1);
  c.beginPath();
  for (let i = 0; i < 3; i++) {
    c.moveTo(13, -43 + i * 3.4);
    c.lineTo(19, -42 + i * 3.4);
    c.moveTo(23, -42 + i * 3.4);
    c.lineTo(30, -40.6 + i * 3.4);
  }
  c.stroke();
  ln(c, 1.5);
  disc(c, 12, -41, 3.4, '#fff');
  // 头 + 假发
  const sink = hit * 7;
  const hx = 5;
  const hy = -76 + sink + Math.sin(t * 1.4) * 0.8 * (1 - hit);
  for (let i = 0; i < CURLS.length; i++) {
    const k = CURLS[i];
    disc(c, hx + k[0], hy + k[1], k[2], '#fff');
  }
  disc(c, hx + 1, hy + 4, 9.6, '#fff');
  ln(c, 1.2);
  c.beginPath();
  for (let i = 0; i < CURLS.length; i++) {
    const k = CURLS[i];
    c.moveTo(hx + k[0] + k[2] * 0.45, hy + k[1]);
    c.arc(hx + k[0], hy + k[1], k[2] * 0.45, 0, Math.PI * 1.5);
  }
  c.stroke();
  disc(c, hx + 1, hy + 4, 9.6, '#fff');
  ln(c, 1.5);
  c.fillStyle = INK;
  if (hit > 0.12) {
    c.beginPath();
    c.moveTo(hx - 5.5, hy + 1);
    c.lineTo(hx - 1.5, hy + 3.2);
    c.lineTo(hx - 5.5, hy + 5.4);
    c.moveTo(hx + 8.5, hy + 1);
    c.lineTo(hx + 4.5, hy + 3.2);
    c.lineTo(hx + 8.5, hy + 5.4);
    c.stroke();
    ell(c, hx + 2, hy + 10.5, 2.2, 3, INK, false);
  } else {
    disc(c, hx - 2.5, hy + 4.2, 1.3, INK, false);
    disc(c, hx + 5, hy + 4.2, 1.3, INK, false);
    c.beginPath();
    c.moveTo(hx - 5, hy + 1);
    c.lineTo(hx - 0.5, hy + 1.6);
    c.moveTo(hx + 3, hy + 1.6);
    c.lineTo(hx + 8, hy + 1);
    c.stroke();
    c.beginPath();
    c.arc(hx + 2, hy + 9.5, 2.2, 0.2, Math.PI - 0.2);
    c.stroke();
  }
  c.beginPath();
  c.moveTo(hx + 9, hy + 4.5);
  c.quadraticCurveTo(hx + 13, hy + 8, hx + 9, hy + 9);
  c.stroke();
  c.restore();
  if (hit > 0.05) {
    ln(c, 1);
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + i * 2.09;
      sparklePath(c, hx + Math.cos(a) * 14, hy - 20 + Math.sin(a) * 4, 4, a);
      c.fillStyle = GOLD;
      c.fill();
      c.stroke();
    }
  }
  pop(c);
}

/* ============================ 园丁老徐 ============================ */
export interface GardenerOpt {
  t: number;
  dir: number;
  /** 走路相位(弧度),<0 表示不走 */
  walk: number;
  /** 伸手摇树 0..1 */
  reach: number;
  /** 擦汗 0..1 */
  wipe: number;
  /** 圣诞红帽 */
  xmas: boolean;
  /** 换皮:0 草帽背心 / 1 黄色安全帽橙工装 / 2 金色外骨骼 */
  lv?: number;
}

const DENIM = '#3f74b8';
const SHIRT = '#8fd08a';
const SKIN = '#ffd9b8';
const STRAW = '#f4cf63';

export function gardener(c: C, x: number, y: number, h: number, o: GardenerOpt): void {
  push(c, x, y, h / 100);
  const lv = o.lv ?? 0;
  const TOP = lv === 0 ? SHIRT : lv === 1 ? '#f59a3b' : '#f2c94c';
  const BOT = lv === 0 ? DENIM : lv === 1 ? '#d9701a' : '#6f7b8c';
  c.scale(o.dir, 1);
  const walking = o.walk >= 0;
  const sw = walking ? Math.sin(o.walk) : 0;
  const bob = walking ? Math.abs(Math.cos(o.walk)) * 1.8 : Math.sin(o.t * 2) * 0.5;
  ln(c, 2.4);
  ell(c, 0, 0.5, 15, 2.6, 'rgba(0,0,0,.09)', false);
  // 腿(背带裤)+ 靴子
  limb(c, -5, -30, -5 + sw * 6, -5, 9, BOT);
  limb(c, 5, -30, 5 - sw * 6, -5, 9, BOT);
  ln(c, 2.4);
  ell(c, -5 + sw * 6 + 1, -2.5, 6.5, 3.4, INK, false);
  ell(c, 5 - sw * 6 + 1, -2.5, 6.5, 3.4, INK, false);
  c.translate(0, -bob);
  // 后臂
  limb(c, -10, -58, -15 - sw * 3, -38, 8, TOP);
  ln(c, 2.4);
  // 衬衫身体
  c.beginPath();
  c.roundRect(-13, -64, 26, 38, 8);
  c.fillStyle = TOP;
  c.fill();
  c.stroke();
  // 背带裤胸兜
  c.beginPath();
  c.roundRect(-10.5, -50, 21, 24, [3, 3, 7, 7]);
  c.fillStyle = BOT;
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(-8, -50);
  c.lineTo(-9, -63);
  c.moveTo(8, -50);
  c.lineTo(9, -63);
  c.stroke();
  // 兜里的小苹果
  disc(c, 0, -38, 3.4, RED);
  // 围巾
  const flap = Math.sin(o.t * 5) * 2;
  c.beginPath();
  c.moveTo(5, -62);
  c.quadraticCurveTo(14 + flap, -56, 13 + flap, -45);
  c.lineTo(8 + flap * 0.6, -46);
  c.quadraticCurveTo(8, -54, 2, -58);
  c.closePath();
  c.fillStyle = RED;
  c.fill();
  c.stroke();
  ell(c, 0, -65, 13, 4.6, RED);
  // 头
  disc(c, 0, -81, 16, SKIN);
  // 脸
  const blink = Math.sin(o.t * 1.7) > 0.985;
  c.fillStyle = INK;
  if (o.wipe > 0.2 || blink) {
    c.beginPath();
    c.arc(-5.5, -80, 2.4, Math.PI * 1.1, Math.PI * 1.9);
    c.arc(5.5, -80, 2.4, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
  } else {
    disc(c, -5.5, -80, 1.9, INK, false);
    disc(c, 5.5, -80, 1.9, INK, false);
  }
  ell(c, -9.5, -75, 3.4, 2.2, 'rgba(224,32,42,.35)', false);
  ell(c, 9.5, -75, 3.4, 2.2, 'rgba(224,32,42,.35)', false);
  if (o.reach > 0.3) ell(c, 0, -73.5, 2.6, 2.6, INK, false);
  else {
    c.beginPath();
    c.arc(0, -75.5, 4, Math.PI * 0.12, Math.PI * 0.88);
    c.stroke();
  }
  // 帽子:草帽 / 圣诞红帽
  if (lv >= 1 && !o.xmas) {
    const hc = lv === 1 ? '#ffd23a' : '#f2c94c';
    c.beginPath();
    c.arc(0, -90, 15, Math.PI, 0);
    c.closePath();
    c.fillStyle = hc;
    c.fill();
    c.stroke();
    c.fillStyle = hc;
    c.fillRect(-19, -91.5, 38, 4.5);
    c.strokeRect(-19, -91.5, 38, 4.5);
    c.beginPath();
    c.moveTo(0, -105);
    c.lineTo(0, -91.5);
    c.stroke();
    if (lv === 2) {
      disc(c, 0, -98, 3, '#fff');
      c.fillStyle = 'rgba(255,255,255,.55)';
      c.fillRect(-9, -87, 18, 3);
    }
  } else if (o.xmas) {
    c.beginPath();
    c.moveTo(-15, -90);
    c.quadraticCurveTo(-4, -118, 14 + Math.sin(o.t * 3) * 2, -104);
    c.lineTo(15, -90);
    c.closePath();
    c.fillStyle = RED;
    c.fill();
    c.stroke();
    ell(c, 0, -90, 17, 4.2, '#fff');
    disc(c, 14 + Math.sin(o.t * 3) * 2, -104, 3.6, '#fff');
  } else {
    c.beginPath();
    c.arc(0, -90, 13, Math.PI, 0);
    c.closePath();
    c.fillStyle = STRAW;
    c.fill();
    c.stroke();
    ell(c, 0, -89, 26, 6.4, STRAW);
    c.fillStyle = RED;
    c.fillRect(-13, -95, 26, 4);
    ln(c, 1.4, '#a8791f');
    c.beginPath();
    c.moveTo(-18, -88);
    c.lineTo(-14, -87.5);
    c.moveTo(-6, -84.5);
    c.lineTo(-3, -84.2);
    c.moveTo(12, -85);
    c.lineTo(16, -86);
    c.moveTo(-4, -96);
    c.lineTo(-3, -91);
    c.moveTo(4, -96);
    c.lineTo(5, -91);
    c.stroke();
    ln(c, 2.4);
  }
  // 前臂:休息 / 伸手摇树 / 擦汗
  let hx = 14 + sw * 2;
  let hy = -37;
  const r = o.reach;
  const w = o.wipe;
  if (r > 0) {
    const sh = Math.sin(o.t * 22) * (lv >= 2 ? 4.4 : 2.2) * r;
    hx += (27 - hx) * r + sh;
    hy += (-96 - hy) * r;
  } else if (w > 0) {
    hx += (9 - hx) * w;
    hy += (-90 - hy) * w + Math.sin(o.t * 12) * 1.5 * w;
  }
  if (lv >= 2) {
    // 金色外骨骼机甲臂
    const mx = (10 + hx) / 2 + 3;
    const my = (-58 + hy) / 2;
    limb(c, 10, -58, mx, my, 12, '#f2c94c');
    limb(c, mx, my, hx, hy, 12, '#f2c94c');
    ln(c, 2.4);
    disc(c, mx, my, 5, '#cfd6de');
    disc(c, 10, -58, 7, '#f2c94c');
    c.beginPath();
    c.arc(hx, hy, 7, 0, TAU);
    c.fillStyle = '#cfd6de';
    c.fill();
    c.stroke();
    ln(c, 2);
    c.beginPath();
    c.moveTo(hx - 2, hy - 6);
    c.lineTo(hx - 2, hy - 11);
    c.moveTo(hx + 3, hy - 6);
    c.lineTo(hx + 3, hy - 11);
    c.stroke();
    ln(c, 2.4);
  } else {
    limb(c, 10, -58, hx, hy, 8, TOP);
    ln(c, 2.4);
    disc(c, hx, hy, 4.4, SKIN);
  }
  if (w > 0.3) {
    ell(c, hx - 1, hy - 2.5, 7, 3.2, '#fff', true, -0.4);
    // 汗滴
    const d = (o.t * 1.6) % 1;
    c.beginPath();
    c.moveTo(-19, -86 + d * 6);
    c.quadraticCurveTo(-23, -80 + d * 6, -19, -78 + d * 6);
    c.quadraticCurveTo(-15, -80 + d * 6, -19, -86 + d * 6);
    c.fillStyle = '#bfe3ff';
    c.fill();
    c.stroke();
  }
  pop(c);
}

/** 水桶(装苹果) */
export function bucket(c: C, x: number, y: number, h: number): void {
  push(c, x, y, h / 40);
  ln(c, 1.4);
  c.beginPath();
  c.arc(0, -26, 12, Math.PI * 1.05, Math.PI * 1.95);
  c.stroke();
  disc(c, -4, -29, 4.8, RED);
  disc(c, 5, -29, 4.8, RED);
  disc(c, 0, -33, 4.8, RED);
  c.beginPath();
  c.moveTo(-13, -26);
  c.lineTo(-10, 0);
  c.lineTo(10, 0);
  c.lineTo(13, -26);
  c.closePath();
  c.fillStyle = '#fff';
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(-12, -17);
  c.lineTo(12, -17);
  c.stroke();
  pop(c);
}

/** 小梯子:底部在 (x,y),向 dir 方向斜靠 */
export function ladder(c: C, x: number, y: number, h: number, dir: number): void {
  push(c, x, y, h / 100);
  c.scale(dir, 1);
  ln(c, 1.5);
  c.beginPath();
  c.moveTo(-6, 0);
  c.lineTo(8, -100);
  c.moveTo(8, 0);
  c.lineTo(20, -100);
  for (let i = 1; i < 6; i++) {
    const f = i / 6;
    c.moveTo(-6 + 14 * f, -100 * f);
    c.lineTo(8 + 12 * f, -100 * f);
  }
  c.stroke();
  pop(c);
}

/* ============================ 发布会讲者(黑衣剪影) ============================ */
export function speaker(c: C, x: number, y: number, h: number, o: { t: number; active: boolean; dir: number }): void {
  push(c, x, y, h / 100);
  c.scale(o.dir, 1);
  ln(c, 1.4);
  c.fillStyle = INK;
  // 腿
  limb(c, -5, -40, -5, -3, 9, INK);
  limb(c, 5, -40, 5, -3, 9, INK);
  // 身体
  c.beginPath();
  c.roundRect(-13, -72, 26, 38, 8);
  c.fill();
  // 头(剪影)
  disc(c, 0, -85, 12, INK, false);
  // 手臂:激动时挥舞
  const sw = o.active ? Math.sin(o.t * 6) : 0;
  limb(c, 11, -66, 23 + sw * 3, o.active ? -92 + sw * 6 : -50, 7, INK);
  limb(c, -11, -66, -18, -46, 7, INK);
  // 耳麦
  c.strokeStyle = '#fff';
  c.lineWidth = 1.4 / S;
  c.beginPath();
  c.arc(0, -86, 8.5, Math.PI * 1.1, Math.PI * 1.6);
  c.stroke();
  pop(c);
}

/* ============================ 车库里的小人(黑高领 + 牛仔裤 + 圆眼镜) ============================ */
export function maker(c: C, x: number, y: number, h: number, o: { t: number }): void {
  push(c, x, y, h / 100);
  ln(c, 1.5);
  // 凳子
  c.beginPath();
  c.moveTo(-12, -22);
  c.lineTo(8, -22);
  c.moveTo(-9, -22);
  c.lineTo(-10, 0);
  c.moveTo(5, -22);
  c.lineTo(6, 0);
  c.stroke();
  // 牛仔裤
  limb(c, 0, -26, 18, -26, 10, '#9aa8bd');
  limb(c, 18, -26, 20, -4, 8.5, '#9aa8bd');
  ell(c, 24, -3, 8, 3.8, '#e8e8e8');
  // 黑高领
  c.beginPath();
  c.roundRect(-11, -62, 22, 40, 7);
  c.fillStyle = INK;
  c.fill();
  c.stroke();
  ell(c, 1, -63, 7, 4, INK);
  // 头 + 圆眼镜 + 小短发
  disc(c, 2, -75, 11, '#fff');
  c.beginPath();
  c.arc(2, -77, 11, Math.PI * 1.05, Math.PI * 1.95);
  c.fillStyle = INK;
  c.fill();
  ln(c, 1.2);
  c.beginPath();
  c.arc(5, -75, 3.6, 0, TAU);
  c.moveTo(16.4, -75);
  c.arc(12.8, -75, 3.6, 0, TAU);
  c.moveTo(8.6, -75);
  c.lineTo(9.2, -75);
  c.stroke();
  disc(c, 5.6, -74.6, 1, INK, false);
  disc(c, 13.2, -74.6, 1, INK, false);
  c.beginPath();
  c.arc(9.5, -70, 2.3, 0.2, Math.PI - 0.2);
  c.stroke();
  ln(c, 1.5);
  // 手敲键盘
  const k = Math.sin(o.t * 15) * 1.6;
  limb(c, 6, -56, 18, -42, 7, INK);
  limb(c, 18, -42, 31, -35 + k, 6, INK);
  disc(c, 32, -35 + k, 3, '#fff');
  pop(c);
}

/* ============================ 医生 ============================ */
export function doctor(c: C, x: number, y: number, h: number, o: { t: number; dir: number; run: number; wave: number; scared: boolean }): void {
  push(c, x, y, h / 100);
  c.scale(o.dir, 1);
  ln(c, 1.5);
  const ph = o.t * (o.run > 0 ? 16 : 0);
  const sw = Math.sin(ph) * 8 * o.run;
  ell(c, 0, 0.5, 16, 2.6, 'rgba(0,0,0,.09)', false);
  c.rotate(o.run * 0.12);
  limb(c, -4, -24, -4 + sw, -4, 7, INK);
  limb(c, 4, -24, 4 - sw, -4, 7, INK);
  ell(c, -3 + sw + 2, -2.5, 6, 3, INK, false);
  ell(c, 5 - sw + 2, -2.5, 6, 3, INK, false);
  // 白大褂
  c.beginPath();
  c.moveTo(-12, -62);
  c.lineTo(12, -62);
  c.lineTo(19, -12);
  c.lineTo(-19, -12);
  c.closePath();
  c.fillStyle = '#fff';
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(0, -62);
  c.lineTo(0, -12);
  c.moveTo(-5, -62);
  c.lineTo(0, -52);
  c.lineTo(5, -62);
  c.stroke();
  // 听诊器
  c.beginPath();
  c.moveTo(-8, -62);
  c.quadraticCurveTo(-9, -42, 0, -40);
  c.quadraticCurveTo(9, -42, 8, -62);
  c.stroke();
  disc(c, 4, -38, 3, '#bbb');
  // 公文包
  c.beginPath();
  c.roundRect(-30, -32, 13, 10, 2);
  c.fillStyle = '#ddd';
  c.fill();
  c.stroke();
  limb(c, -11, -58, -22, -33, 6, '#fff');
  // 头 + 额镜
  disc(c, 0, -76, 13, '#fff');
  c.beginPath();
  c.moveTo(-12.5, -80);
  c.lineTo(12.5, -80);
  c.stroke();
  disc(c, 0, -84, 5, '#ddd');
  disc(c, 0, -84, 1.5, INK, false);
  if (o.scared) {
    disc(c, -4.5, -76, 2.6, '#fff');
    disc(c, 4.5, -76, 2.6, '#fff');
    disc(c, -4.5, -76, 0.9, INK, false);
    disc(c, 4.5, -76, 0.9, INK, false);
    c.beginPath();
    c.moveTo(-4, -70);
    c.quadraticCurveTo(-2, -72, 0, -70);
    c.quadraticCurveTo(2, -68, 4, -70);
    c.stroke();
    const d = (o.t * 1.8) % 1;
    c.beginPath();
    c.moveTo(-17, -86 + d * 8);
    c.quadraticCurveTo(-21, -80 + d * 8, -17, -78 + d * 8);
    c.quadraticCurveTo(-13, -80 + d * 8, -17, -86 + d * 8);
    c.fillStyle = '#bfe3ff';
    c.fill();
    c.stroke();
  } else {
    disc(c, -4.5, -76, 1.5, INK, false);
    disc(c, 4.5, -76, 1.5, INK, false);
    c.beginPath();
    c.arc(0, -72.5, 3.5, 0.2, Math.PI - 0.2);
    c.stroke();
  }
  // 挥手
  const wv = Math.sin(o.t * 10) * 8 * o.wave;
  limb(c, 11, -58, 26 + wv * 0.4, -78 + wv * 0.2 + (1 - o.wave) * 28, 6, '#fff');
  disc(c, 26 + wv * 0.4, -78 + wv * 0.2 + (1 - o.wave) * 28, 3.4, '#fff');
  pop(c);
}

/* ============================ 女巫 ============================ */
export function witch(c: C, x: number, y: number, h: number, o: { t: number; dir: number }): void {
  push(c, x, y, h / 100);
  c.scale(o.dir, 1);
  ln(c, 1.5);
  ell(c, 0, 0.5, 20, 2.8, 'rgba(0,0,0,.1)', false);
  // 长袍
  c.beginPath();
  c.moveTo(-10, -58);
  c.lineTo(10, -58);
  c.quadraticCurveTo(18, -30, 26, -4);
  c.lineTo(-26, -4);
  c.quadraticCurveTo(-18, -30, -10, -58);
  c.closePath();
  c.fillStyle = INK;
  c.fill();
  c.stroke();
  // 左臂搅拌
  const st = Math.sin(o.t * 3) * 3;
  limb(c, -8, -54, -20 + st, -34, 6, INK);
  // 头发
  ln(c, 1.2);
  c.beginPath();
  c.moveTo(-9, -70);
  c.quadraticCurveTo(-16, -62, -12 + st * 0.3, -52);
  c.moveTo(9, -70);
  c.quadraticCurveTo(15, -62, 12, -54);
  c.stroke();
  ln(c, 1.5);
  // 脸
  disc(c, 0, -72, 11, '#fff');
  c.beginPath();
  c.moveTo(9, -73);
  c.lineTo(19, -69);
  c.lineTo(9, -66);
  c.fillStyle = '#fff';
  c.fill();
  c.stroke();
  disc(c, 4, -75, 1.4, INK, false);
  c.beginPath();
  c.moveTo(0, -79);
  c.lineTo(7, -77);
  c.moveTo(-1, -64);
  c.quadraticCurveTo(3, -61, 7, -64);
  c.stroke();
  // 尖帽
  ell(c, 0, -80, 22, 5, INK);
  c.beginPath();
  c.moveTo(-12, -82);
  c.quadraticCurveTo(-6, -106, 10 + Math.sin(o.t * 2) * 2, -121);
  c.quadraticCurveTo(3, -104, 12, -82);
  c.closePath();
  c.fillStyle = INK;
  c.fill();
  c.stroke();
  c.fillStyle = GOLD;
  c.fillRect(-11, -87, 21, 3.4);
  // 右臂举毒苹果
  limb(c, 9, -54, 24, -66, 6, INK);
  disc(c, 26, -67, 3, '#fff');
  pop(c);
}

/** 毒苹果(紫光):在当前坐标系里的 (x,y),r 为半径。调用方负责光晕 */
export function poisonApple(c: C, x: number, y: number, r: number): void {
  ln(c, 1.4);
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fillStyle = '#7b2fd0';
  c.fill();
  c.stroke();
  c.beginPath();
  c.strokeStyle = '#e6d2ff';
  c.lineWidth = 1 / S;
  c.arc(x, y, r * 0.6, Math.PI * 1.1, Math.PI * 1.45);
  c.stroke();
  ln(c, 1.4);
  c.beginPath();
  c.moveTo(x, y - r);
  c.lineTo(x + r * 0.25, y - r * 1.5);
  c.stroke();
}

/* ============================ 夏娃剪影 ============================ */
export function eve(c: C, x: number, y: number, h: number, o: { t: number; bites: number; dir: number }): void {
  push(c, x, y, h / 100);
  c.scale(o.dir, 1);
  ln(c, 1.4);
  const b = o.bites;
  ell(c, 0, 0.5, 14, 2.4, 'rgba(0,0,0,.09)', false);
  // 长发
  c.beginPath();
  c.moveTo(-9, -82);
  c.quadraticCurveTo(-20, -60, -13, -34 + Math.sin(o.t * 2) * 2);
  c.lineTo(-5, -50);
  c.closePath();
  c.fillStyle = INK;
  c.fill();
  // 裙
  c.beginPath();
  c.moveTo(-8, -58);
  c.lineTo(8, -58);
  c.quadraticCurveTo(14, -30, 18, -2);
  c.lineTo(-18, -2);
  c.quadraticCurveTo(-14, -30, -8, -58);
  c.closePath();
  c.fillStyle = '#222';
  c.fill();
  c.stroke();
  // 手伸向果实
  const reach = 0.6 + 0.4 * Math.sin(o.t * 2.4);
  limb(c, 7, -56, 20 + reach * 4, -76 - reach * 8, 5.5, '#222');
  disc(c, 21 + reach * 4, -77 - reach * 8, 3, '#fff');
  limb(c, -7, -56, -12, -34, 5.5, '#222');
  // 头
  disc(c, 0, -72, 10.5, '#fff');
  c.beginPath();
  c.arc(0, -74, 10.8, Math.PI * 0.95, Math.PI * 2.05);
  c.fillStyle = INK;
  c.fill();
  ln(c, 1.3);
  if (b >= 3) {
    c.beginPath();
    c.arc(2.5, -73, 2, Math.PI * 1.1, Math.PI * 1.9);
    c.arc(7.5, -73, 2, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
    c.beginPath();
    c.arc(5, -69, 3.4, 0.1, Math.PI - 0.1);
    c.stroke();
    ln(c, 2, GOLD);
    ell(c, 0, -90, 10, 3, null);
  } else if (b === 2) {
    disc(c, 3, -72.5, 1.3, INK, false);
    disc(c, 8, -72.5, 1.3, INK, false);
    c.beginPath();
    c.arc(6, -69, 3, 0.2, Math.PI - 0.5);
    c.stroke();
  } else {
    disc(c, 3, -72.5, 1.5, INK, false);
    disc(c, 8, -72.5, 1.5, INK, false);
    ell(c, 6, -68, 1.5, 2, null);
  }
  pop(c);
}

export { RED, GOLD };
