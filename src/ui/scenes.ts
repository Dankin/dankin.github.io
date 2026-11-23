/** 画面下方的"景点街":每个项目一个小场景,从左到右排开,窄屏自动摇移镜头。 */
import { BAND_BG, drawApple, drawBitApple, glow, GOLD, INK, RED, sparklePath, TAU } from './draw.ts';
import { bubble, disc, doctor, ell, eve, limb, ln, maker, poisonApple, pop, push, resetFrame, speaker, textW, txt, witch } from './chars.ts';
import type { Build } from './orchard.ts';

type C = CanvasRenderingContext2D;

export type SceneId = 'sign' | 'phone' | 'stage' | 'onemore' | 'bites' | 'garage' | 'doctor' | 'witch';
export const SCENE_ORDER: SceneId[] = ['sign', 'phone', 'stage', 'onemore', 'bites', 'garage', 'doctor', 'witch'];
const W: Record<SceneId, number> = { sign: 34, phone: 84, stage: 236, onemore: 124, bites: 172, garage: 184, doctor: 140, witch: 178 };
/** 场景设计高度(局部单位) */
const DH = 112;
const GAP = 12;

interface SceneState { t: number; active: boolean; bites: number }

function floorLine(c: C, w: number): void {
  ln(c, 1.4, '#999');
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(w, 0);
  c.stroke();
}

function drawSign(c: C, t: number): void {
  // 最美的苹果:小小一颗悬浮的金苹果,光晕 + 旋转光线 + 闪光粒子
  const cx = 17;
  const bob = Math.sin(t * 2.2) * 3;
  const cy = -52 + bob;
  ln(c, 1.4, '#bbb');
  ell(c, cx, 0, 11 - bob * 0.3, 2.4, 'rgba(0,0,0,.1)', false);
  glow(c, GOLD, cx, cy, 34 + Math.sin(t * 3) * 2, 0.95);
  c.save();
  c.translate(cx, cy);
  c.rotate(t * 0.5);
  c.fillStyle = 'rgba(242,183,5,.55)';
  for (let i = 0; i < 8; i++) {
    c.rotate(TAU / 8);
    c.beginPath();
    c.moveTo(0, -10);
    c.lineTo(-2.2, -23 - (i % 2) * 5);
    c.lineTo(2.2, -23 - (i % 2) * 5);
    c.closePath();
    c.fill();
  }
  c.restore();
  drawApple(c, cx, cy, 10, GOLD, 1.8);
  c.fillStyle = '#fff6c4';
  for (let i = 0; i < 4; i++) {
    const ph = (t * 0.9 + i * 0.25) % 1;
    const a = i * 1.7 + t * 0.6;
    c.globalAlpha = Math.sin(ph * Math.PI);
    sparklePath(c, cx + Math.cos(a) * 22, cy + Math.sin(a) * 18, 1.5 + 3 * Math.sin(ph * Math.PI), ph * 3);
    c.fill();
  }
  c.globalAlpha = 1;
}

function drawPhone(c: C, t: number): void {
  floorLine(c, W.phone);
  ell(c, 42, 0, 30, 3.4, 'rgba(0,0,0,.08)', false);
  ln(c, 1.6);
  const sw = Math.sin(t * 1.6) * 0.06;
  for (let i = 0; i < 2; i++) {
    c.save();
    c.translate(i ? 54 : 30, -32);
    c.rotate((i ? -0.06 : 0.06) + (i ? -sw : sw));
    c.beginPath();
    c.roundRect(-14, -36, 28, 68, 6);
    c.fillStyle = '#fff';
    c.fill();
    c.stroke();
    c.beginPath();
    c.roundRect(-10.5, -31, 21, 56, 3);
    c.fillStyle = INK;
    c.fill();
    drawApple(c, 0, -3, 6.5, RED, 1.2);
    c.restore();
  }
  txt(c, 'Duo', 42, -86, 11);
  // 闪光
  c.fillStyle = GOLD;
  ln(c, 1);
  sparklePath(c, 74, -70 + Math.sin(t * 2.2) * 3, 5, t * 0.7);
  c.fill();
  c.stroke();
}

const SCREEN = { x: 78, y: -102, w: 148, h: 62 };
function drawStage(c: C, t: number, s: SceneState): void {
  const on = s.active;
  // 灯光(开会时)
  if (on) {
    const sw = Math.sin(t * 1.7) * 18;
    c.fillStyle = 'rgba(242,183,5,.16)';
    for (let i = 0; i < 2; i++) {
      const lx = i ? 214 : 22;
      c.beginPath();
      c.moveTo(lx - 3, -110);
      c.lineTo(lx + 3, -110);
      c.lineTo(lx + 3 + (i ? -50 : 50) + sw, -14);
      c.lineTo(lx - 3 + (i ? -80 : 20) + sw, -14);
      c.closePath();
      c.fill();
    }
  }
  ln(c, 1.6);
  // 灯架
  for (const lx of [22, 214]) {
    c.beginPath();
    c.roundRect(lx - 7, -113, 14, 6, 2);
    c.fillStyle = on ? GOLD : '#fff';
    c.fill();
    c.stroke();
  }
  // 舞台
  c.beginPath();
  c.rect(2, -16, 232, 16);
  c.fillStyle = '#fff';
  c.fill();
  c.stroke();
  ln(c, 1, '#bbb');
  c.beginPath();
  for (let x = 20; x < 232; x += 24) {
    c.moveTo(x, -16);
    c.lineTo(x, 0);
  }
  c.stroke();
  // 大屏幕
  const sc = SCREEN;
  ln(c, 2);
  c.beginPath();
  c.roundRect(sc.x - 4, sc.y - 4, sc.w + 8, sc.h + 8, 5);
  c.fillStyle = INK;
  c.fill();
  c.beginPath();
  c.roundRect(sc.x, sc.y, sc.w, sc.h, 3);
  c.fillStyle = on ? '#14110a' : '#fff';
  c.fill();
  c.save();
  c.beginPath();
  c.rect(sc.x, sc.y, sc.w, sc.h);
  c.clip();
  if (on) {
    glow(c, GOLD, sc.x + sc.w / 2, sc.y + sc.h / 2, 90, 0.35);
    const str = 'One more thing…';
    const tw = textW(c, str, 17) / (c.getTransform().a || 1);
    const loop = sc.w + tw + 16;
    const x0 = sc.x + sc.w + 8 - ((t * 46) % loop);
    drawBitApple(c, x0 - 14, sc.y + sc.h / 2, 7, RED, 1.2, Math.PI + 0.25, '#14110a');
    txt(c, str, x0 + tw / 2 + 2, sc.y + sc.h / 2 + 1, 17, GOLD, 'center', false, 800);
  } else {
    drawBitApple(c, sc.x + sc.w / 2, sc.y + sc.h / 2 + 3, 16, RED, 1.8, Math.PI + 0.25, '#fff');
    ln(c, 1.8);
    c.beginPath();
    c.moveTo(sc.x + sc.w / 2 + 1, sc.y + sc.h / 2 - 12);
    c.quadraticCurveTo(sc.x + sc.w / 2 + 6, sc.y + 8, sc.x + sc.w / 2 + 14, sc.y + 10);
    c.stroke();
  }
  c.restore();
  // 讲者
  speaker(c, 42, -16, 52, { t, active: on, dir: 1 });
  if (!on) {
    const ph = t % 7;
    if (ph < 3) bubble(c, 'Good morning.', 42, -72, 10.5, Math.min(1, ph * 3, (3 - ph) * 3));
  } else {
    bubble(c, 'Wow!', 42 + Math.sin(t * 5) * 2, -72, 10.5);
  }
  // 观众
  for (let i = 0; i < 8; i++) {
    const x = 16 + i * 29.5;
    const bounce = on ? Math.abs(Math.sin(t * 7 + i * 1.3)) * 7 : Math.sin(t * 1.5 + i) * 0.8;
    const y = 3 - bounce;
    ln(c, 1.4);
    c.fillStyle = INK;
    c.beginPath();
    c.arc(x, y + 10, 11.5, Math.PI, 0);
    c.fill();
    c.beginPath();
    c.arc(x, y - 6, 6.2, 0, TAU);
    c.fill();
    // 举手机
    const up = on || i % 3 === 0;
    if (up) {
      const px = x + (i % 2 ? 9 : -9);
      const py = y - 26 - (on ? 3 : 0) + Math.sin(t * 3 + i) * (on ? 2 : 0.5);
      ln(c, 4.2, INK);
      c.beginPath();
      c.moveTo(x + (i % 2 ? 7 : -7), y + 1);
      c.lineTo(px, py + 5);
      c.stroke();
      c.beginPath();
      c.roundRect(px - 3.2, py - 5, 6.4, 10, 1.4);
      c.fillStyle = '#fff';
      c.fill();
      ln(c, 1);
      c.stroke();
      if (on && Math.sin(t * 9 + i * 2.1) > 0.7) glow(c, '#ffffff', px, py, 12, 0.9);
    }
  }
  if (on) {
    c.fillStyle = GOLD;
    ln(c, 1);
    for (let i = 0; i < 3; i++) {
      sparklePath(c, 60 + i * 56 + Math.sin(t * 3 + i) * 6, -118 + ((t * 20 + i * 17) % 22), 4, t * 2 + i);
      c.fill();
    }
  }
}

function drawOneMore(c: C, t: number, s: SceneState): void {
  floorLine(c, W.onemore);
  ln(c, 2);
  c.beginPath();
  c.moveTo(30, 0);
  c.lineTo(30, -34);
  c.moveTo(94, 0);
  c.lineTo(94, -34);
  c.stroke();
  c.beginPath();
  c.roundRect(6, -108, 112, 76, 7);
  c.fillStyle = INK;
  c.fill();
  c.stroke();
  const on = s.active;
  const flick = on ? 1 : 0.8 + 0.2 * Math.sin(t * 2);
  // 灯泡链
  const ph = Math.floor(t * (on ? 9 : 4));
  const n = 24;
  const rw = 98;
  const rh = 62;
  for (let i = 0; i < n; i++) {
    const f = i / n;
    const per = 2 * (rw + rh);
    let d = f * per;
    let bx: number;
    let by: number;
    if (d < rw) { bx = 12 + d; by = -102; }
    else if ((d -= rw) < rh) { bx = 110; by = -102 + d; }
    else if ((d -= rh) < rw) { bx = 110 - d; by = -40; }
    else { d -= rw; bx = 12; by = -40 - d; }
    const lit = (i + ph) % 3 !== 0;
    disc(c, bx, by, 2.1, lit ? GOLD : '#555', false);
    if (lit) glow(c, GOLD, bx, by, 7, 0.55);
  }
  glow(c, GOLD, 62, -70, 60, 0.18 * flick + (on ? 0.2 : 0));
  txt(c, 'One more', 62, -84, 19, '#fff', 'center', false, 800);
  txt(c, 'thing', 62, -58, 24, on ? GOLD : '#ffe27a', 'center', false, 800);
}

function drawBites(c: C, t: number, s: SceneState): void {
  const b = s.bites;
  floorLine(c, W.bites);
  const cx = 114;
  glow(c, GOLD, cx, -64, 74 + b * 12, Math.min(1, 0.4 + 0.2 * b));
  // 树干
  ln(c, 1.6);
  c.beginPath();
  c.moveTo(cx - 9, 0);
  c.quadraticCurveTo(cx - 5, -24, cx - 5, -48);
  c.lineTo(cx + 5, -48);
  c.quadraticCurveTo(cx + 5, -24, cx + 9, 0);
  c.closePath();
  c.fillStyle = INK;
  c.fill();
  c.stroke();
  // 树冠
  const cr: ReadonlyArray<readonly [number, number, number]> = [[cx, -68, 23], [cx - 20, -58, 17], [cx + 20, -58, 17], [cx - 8, -86, 15], [cx + 12, -84, 15]];
  ln(c, 3.4);
  for (const k of cr) { c.beginPath(); c.arc(k[0], k[1], k[2], 0, TAU); c.stroke(); }
  c.fillStyle = '#fff';
  for (const k of cr) { c.beginPath(); c.arc(k[0], k[1], k[2], 0, TAU); c.fill(); }
  // 蛇缠在树干上
  const snake = (w: number, col: string): void => {
    c.strokeStyle = col;
    c.lineWidth = w;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    for (let y = 0; y <= 46; y += 3) {
      const x = cx + 9 * Math.sin(y * 0.32 + t * 0.8) * (1 - y / 120);
      if (y) c.lineTo(x, -4 - y);
      else c.moveTo(x, -4);
    }
    c.stroke();
  };
  snake(7 / 1, INK);
  c.setLineDash([3, 3.2]);
  snake(3.6, '#fff');
  c.setLineDash([]);
  const hx = cx + 9 * Math.sin(46 * 0.32 + t * 0.8) * (1 - 46 / 120);
  const hy = -50;
  ln(c, 1.4);
  ell(c, hx + 1, hy, 6, 4.4, '#fff', true, -0.3);
  disc(c, hx + 3, hy - 1, 1, INK, false);
  if (Math.sin(t * 7) > 0.2) {
    ln(c, 1.2, RED);
    c.beginPath();
    c.moveTo(hx + 7, hy);
    c.lineTo(hx + 12, hy + 0.5);
    c.moveTo(hx + 12, hy + 0.5);
    c.lineTo(hx + 14.5, hy - 1.5);
    c.moveTo(hx + 12, hy + 0.5);
    c.lineTo(hx + 14.5, hy + 2.4);
    c.stroke();
  }
  // 禁果
  const fy = -70 + Math.sin(t * 2) * 1.4;
  const fc = b >= 3 ? GOLD : RED;
  if (b >= 1) glow(c, GOLD, cx, fy, 24, 0.5);
  drawBitApple(c, cx, fy, 11, fc, 2, -0.5, '#fff', Math.max(1, b));
  drawApple(c, cx - 22, -56, 6, RED, 1.4);
  drawApple(c, cx + 22, -58, 6, RED, 1.4);
  // 夏娃
  eve(c, 48, 0, 66, { t, bites: b, dir: 1 });
  if (b >= 3) {
    ln(c, 1);
    c.fillStyle = GOLD;
    for (let i = 0; i < 5; i++) {
      const a = t * 0.8 + (i * TAU) / 5;
      sparklePath(c, cx + Math.cos(a) * 46, -62 + Math.sin(a) * 34, 3.8, a * 2);
      c.fill();
    }
  }
}

function drawGarage(c: C, t: number): void {
  floorLine(c, W.garage);
  ln(c, 1.8);
  // 房子
  c.beginPath();
  c.rect(4, -60, 102, 60);
  c.fillStyle = '#fff';
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(-2, -60);
  c.lineTo(55, -88);
  c.lineTo(112, -60);
  c.closePath();
  c.fillStyle = '#fff';
  c.fill();
  c.stroke();
  // 门洞(亮色内部,衬出黑衣小人)
  c.beginPath();
  c.rect(14, -52, 82, 52);
  c.fillStyle = '#d6d6d6';
  c.fill();
  c.stroke();
  // 桌子 + 电脑
  ln(c, 1.5);
  c.beginPath();
  c.moveTo(58, -20);
  c.lineTo(94, -20);
  c.moveTo(62, -20);
  c.lineTo(62, 0);
  c.moveTo(90, -20);
  c.lineTo(90, 0);
  c.stroke();
  c.beginPath();
  c.roundRect(66, -42, 22, 17, 2);
  c.fillStyle = '#fff';
  c.fill();
  c.stroke();
  drawApple(c, 77, -33.5, 4, RED, 1);
  maker(c, 36, 0, 54, { t });
  // 焊接火花
  const sp = Math.floor(t * 12);
  c.fillStyle = GOLD;
  for (let i = 0; i < 4; i++) {
    const r = ((sp * 7 + i * 13) % 17) / 17;
    disc(c, 96 - r * 8 + i * 2, -22 - r * 12 + (i % 2) * 5, 1.2, GOLD, false);
  }
  // 卷帘(半卷起)
  c.fillStyle = '#f4f4f4';
  ln(c, 1.4);
  c.beginPath();
  c.rect(14, -52, 82, 9);
  c.fill();
  c.stroke();
  ln(c, 1, '#aaa');
  c.beginPath();
  c.moveTo(14, -47);
  c.lineTo(96, -47);
  c.stroke();
  // 吊灯泡
  glow(c, GOLD, 24, -34 + Math.sin(t * 2) * 1, 14, 0.7);
  disc(c, 24, -34 + Math.sin(t * 2) * 1, 2.4, GOLD, false);
  // 立牌
  ln(c, 1.6);
  c.beginPath();
  c.moveTo(126, 0);
  c.lineTo(126, -26);
  c.moveTo(168, 0);
  c.lineTo(168, -26);
  c.stroke();
  c.beginPath();
  c.roundRect(114, -62, 68, 38, 4);
  c.fillStyle = '#fff';
  c.fill();
  c.stroke();
  txt(c, 'Stay hungry.', 148, -51, 10.5);
  txt(c, 'Stay foolish.', 148, -34, 10.5);
}

function drawDoctor(c: C, t: number): void {
  floorLine(c, W.doctor);
  const cyc = (t % 9) / 9;
  let dx = 74;
  let run = 0;
  let wave = 0;
  let dir = 1;
  let scared = false;
  let text = 'An apple a day…';
  if (cyc < 0.34) {
    scared = true;
    dx = 74 + Math.sin(t * 30) * 0.8;
  } else if (cyc < 0.58) {
    scared = true;
    run = 1;
    dir = -1;
    dx = 74 - ((cyc - 0.34) / 0.24) * 52;
  } else {
    wave = 1;
    dx = 22;
    text = '…keeps me away!';
  }
  const fade = Math.min(1, cyc * 14, (1 - cyc) * 14);
  // 苹果吉祥物
  const sq = Math.sin(t * 4.2);
  push(c, 112, 0, 1);
  c.scale(1 + 0.05 * sq, 1 - 0.05 * sq);
  ln(c, 1.8);
  ell(c, 0, 0, 20, 3.2, 'rgba(0,0,0,.09)', false);
  drawApple(c, 0, -22, 19, RED, 2);
  disc(c, -6, -22, 1.8, INK, false);
  disc(c, 6, -22, 1.8, INK, false);
  c.beginPath();
  c.arc(0, -19, 5, 0.2, Math.PI - 0.2);
  c.stroke();
  ln(c, 1.6);
  c.beginPath();
  c.moveTo(-18, -22);
  c.lineTo(-27, -30 + Math.sin(t * 8) * 3);
  c.moveTo(18, -22);
  c.lineTo(27, -30 - Math.sin(t * 8) * 3);
  c.stroke();
  pop(c);
  c.globalAlpha = fade;
  doctor(c, dx, 0, 58, { t, dir, run, wave, scared });
  bubble(c, text, Math.max(46, dx + (wave ? 8 : 0)), -68, 10.5, 1);
  c.globalAlpha = 1;
}

function drawWitch(c: C, t: number): void {
  floorLine(c, W.witch);
  ln(c, 1.7);
  // 小屋
  c.beginPath();
  c.rect(6, -42, 60, 42);
  c.fillStyle = '#fff';
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(0, -42);
  c.lineTo(36, -70);
  c.lineTo(72, -42);
  c.closePath();
  c.fillStyle = INK;
  c.fill();
  c.stroke();
  c.beginPath();
  c.rect(50, -80, 9, 18);
  c.fillStyle = '#fff';
  c.fill();
  c.stroke();
  c.beginPath();
  c.roundRect(30, -26, 16, 26, [8, 8, 0, 0]);
  c.fillStyle = INK;
  c.fill();
  c.beginPath();
  c.rect(12, -34, 12, 12);
  c.fillStyle = '#d4b3ff';
  c.fill();
  c.stroke();
  glow(c, '#9b4dff', 18, -28, 18, 0.55 + 0.25 * Math.sin(t * 3));
  // 烟
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.45 + i / 3) % 1;
    c.globalAlpha = 1 - p;
    ln(c, 1.2, '#888');
    c.beginPath();
    c.arc(55 + Math.sin(p * 5 + i) * 4, -84 - p * 26, 3 + p * 5, 0, TAU);
    c.stroke();
  }
  c.globalAlpha = 1;
  // 大锅
  ln(c, 1.7);
  c.beginPath();
  c.moveTo(78, -26);
  c.quadraticCurveTo(76, -4, 98, -4);
  c.quadraticCurveTo(120, -4, 118, -26);
  c.closePath();
  c.fillStyle = INK;
  c.fill();
  c.stroke();
  ell(c, 98, -26, 20, 5, '#8a45e8');
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.8 + i * 0.33) % 1;
    c.globalAlpha = 1 - p * p;
    disc(c, 90 + i * 8, -26 - p * 14, 2 + (i % 2), '#c9a3ff');
  }
  c.globalAlpha = 1;
  // 火
  const fl = Math.sin(t * 14) * 1.5;
  c.fillStyle = RED;
  c.beginPath();
  c.moveTo(88, 0);
  c.lineTo(92, -9 - fl);
  c.lineTo(97, 0);
  c.lineTo(102, -11 + fl);
  c.lineTo(107, 0);
  c.closePath();
  c.fill();
  // 女巫 + 毒苹果
  witch(c, 148, 0, 66, { t, dir: -1 });
  push(c, 148, 0, 0.66);
  c.scale(-1, 1);
  glow(c, '#a04dff', 27, -74 + Math.sin(t * 3) * 1.5, 26, 0.9);
  poisonApple(c, 27, -74 + Math.sin(t * 3) * 1.5, 5.6);
  pop(c);
}

/** 沉睡动画里的白雪公主玻璃棺剪影。(x,y) 为棺底中心,单位为屏幕像素 */
export function snowWhite(c: C, x: number, y: number, k: number, t: number, a: number): void {
  push(c, x, y, k);
  c.globalAlpha = a;
  ln(c, 1.5, '#cfe0ff');
  // 底座
  c.beginPath();
  c.roundRect(-46, -14, 92, 14, 3);
  c.fillStyle = '#25345f';
  c.fill();
  c.stroke();
  // 玻璃罩
  c.beginPath();
  c.moveTo(-42, -14);
  c.lineTo(-42, -30);
  c.quadraticCurveTo(-40, -44, -22, -44);
  c.lineTo(22, -44);
  c.quadraticCurveTo(40, -44, 42, -30);
  c.lineTo(42, -14);
  c.closePath();
  c.fillStyle = 'rgba(190,215,255,.18)';
  c.fill();
  c.stroke();
  // 公主剪影
  c.fillStyle = '#0d1530';
  c.beginPath();
  c.ellipse(-26, -22, 6.5, 6.5, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.roundRect(-20, -26, 56, 12, 6);
  c.fill();
  c.fillStyle = RED;
  c.beginPath();
  c.arc(-26, -29.5, 4.2, Math.PI, 0);
  c.fill();
  // 手里的苹果
  drawApple(c, 12, -29, 4.5, '#7b2fd0', 1);
  // 高光
  ln(c, 1.4, 'rgba(255,255,255,.55)');
  c.beginPath();
  c.moveTo(-34, -38);
  c.lineTo(-24, -40);
  c.stroke();
  // Zzz
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.5 + i / 3) % 1;
    c.globalAlpha = a * Math.sin(p * Math.PI);
    txt(c, 'Z', -10 + i * 14 + p * 16, -50 - p * 38, 12 + i * 4 + p * 4, '#dbe6ff', 'center', false, 800);
  }
  c.globalAlpha = 1;
  pop(c);
}

const DRAW: Record<SceneId, (c: C, t: number, s: SceneState) => void> = {
  sign: (c, t) => drawSign(c, t),
  phone: (c, t) => drawPhone(c, t),
  stage: drawStage,
  onemore: drawOneMore,
  bites: drawBites,
  garage: (c, t) => drawGarage(c, t),
  doctor: (c, t) => drawDoctor(c, t),
  witch: (c, t) => drawWitch(c, t),
};

/** 当前是否应该出现在街上(发布会/灯牌只在发布会进行期间出现) */
function isOn(id: SceneId, b: Build): boolean {
  switch (id) {
    case 'sign': return b.fairest;
    case 'phone': return b.duo;
    case 'stage': return b.cook && b.cookActive;
    case 'onemore': return b.onemore && b.cookActive;
    case 'bites': return b.bites > 0;
    case 'garage': return b.garage;
    case 'doctor': return b.doctor;
    case 'witch': return b.witch;
  }
}
/** 是否"已拥有"(用于新解锁提示);发布会/灯牌拥有但不一定在场 */
function isOwned(id: SceneId, b: Build): boolean {
  if (id === 'stage') return b.cook;
  if (id === 'onemore') return b.onemore;
  return isOn(id, b);
}

export class Street {
  private want: Record<SceneId, boolean> = { sign: false, phone: false, stage: false, onemore: false, bites: false, garage: false, doctor: false, witch: false };
  private pres: Record<SceneId, number> = { sign: 0, phone: 0, stage: 0, onemore: 0, bites: 0, garage: 0, doctor: 0, witch: 0 };
  private owned: SceneId[] = [];
  private vis: SceneId[] = [];
  private xs: number[] = [];
  private total = 0;
  private pan = 0;
  private target = 0;
  private curId: SceneId | null = null;
  private timer = 0;
  private snap = true;
  private first = true;
  private sc = 1;
  private lastW = 1;
  private lastH = 1;
  private lastBand = 0;
  private panning = false;
  private spx: Record<string, number> = {};
  private spw: Record<string, number> = {};
  private spv: Record<string, boolean> = {};
  private pend: SceneId | null = null;
  private pendHold = 5;

  /** 更新状态;返回本次新解锁的场景 */
  sync(b: Build): SceneId[] {
    const prev = this.owned;
    this.owned = SCENE_ORDER.filter((id) => isOwned(id, b));
    for (const id of SCENE_ORDER) {
      this.want[id] = isOn(id, b);
      if (this.first) this.pres[id] = this.want[id] ? 1 : 0;
    }
    this.first = false;
    this.layout();
    return this.owned.filter((id) => !prev.includes(id));
  }

  private layout(): void {
    this.vis.length = 0;
    this.xs.length = 0;
    let x = 8;
    for (const id of SCENE_ORDER) {
      const p = this.pres[id];
      if (p < 0.004) continue;
      const e = p * p * (3 - 2 * p);
      this.vis.push(id);
      this.xs.push(x);
      x += W[id] * e + GAP * e;
    }
    this.total = Math.max(16, x - GAP + 8);
    if (this.curId && !this.vis.includes(this.curId)) this.curId = null;
  }

  has(): boolean {
    for (const id of SCENE_ORDER) if (this.want[id] || this.pres[id] > 0.004) return true;
    return false;
  }

  /** 镜头移到某个场景并停留 hold 秒 */
  focus(id: SceneId, hold = 5): void {
    if (!this.want[id] || this.pres[id] < 0.3) { this.pend = id; this.pendHold = hold; return; }
    this.curId = id;
    this.timer = -hold;
  }

  /** 场景在屏幕上的位置,用于飘字与涟漪 */
  anchor(id: SceneId): { x: number; y: number } {
    const i = this.vis.indexOf(id);
    const y = this.lastH - this.lastBand * 0.6;
    if (i < 0) return { x: this.lastW / 2, y };
    if (!this.panning) return { x: (this.xs[i] + W[id] / 2) * this.sc + this.fitShift(), y };
    return { x: this.lastW / 2, y };
  }

  private fitShift(): number {
    return Math.max(0, (this.lastW - this.total * this.sc) / 2);
  }

  /** 当前镜头里的场景 id */
  current(): SceneId | null { return this.curId; }

  draw(c: C, w: number, h: number, bandH: number, t: number, dt: number, b: Build, popOf: (id: SceneId) => number, reduced: boolean): void {
    // 出现/退场动画
    for (const id of SCENE_ORDER) {
      const goal = this.want[id] ? 1 : 0;
      const p = this.pres[id];
      if (p === goal) continue;
      this.pres[id] = reduced ? goal : goal > p ? Math.min(goal, p + dt * 1.5) : Math.max(goal, p - dt * 1.2);
    }
    this.layout();
    if (this.pend && this.pres[this.pend] > 0.3) { const id = this.pend; this.pend = null; this.focus(id, this.pendHold); }
    const n = this.vis.length;
    for (const id of SCENE_ORDER) this.spv[id] = false;
    if (!n || bandH < 20) return;
    resetFrame();
    const sc = Math.max(0.45, (bandH - 12) / DH);
    this.sc = sc;
    this.lastW = w;
    this.lastH = h;
    this.lastBand = bandH;
    const viewW = w / sc;
    this.panning = this.total > viewW + 1;
    // 镜头:自动轮播 / 发布会进行时盯住舞台 / 沉睡时盯住女巫
    if (b.cookActive && this.pres.stage > 0.5) { this.curId = 'stage'; this.timer = 0; }
    else if (b.sleeping && this.pres.witch > 0.5) { this.curId = 'witch'; this.timer = 0; }
    else if (n > 1 && this.panning && !reduced) {
      this.timer += dt;
      if (this.timer > 3.8) {
        const i = this.curId ? this.vis.indexOf(this.curId) : -1;
        this.curId = this.vis[(i + 1) % n];
        this.timer = 0;
      }
    }
    if (!this.curId) this.curId = this.vis[0];
    const ci = Math.max(0, this.vis.indexOf(this.curId));
    if (this.panning) {
      const id = this.vis[ci];
      const tc = this.xs[ci] + W[id] / 2;
      this.target = Math.max(0, Math.min(this.total - viewW, tc - viewW / 2));
    } else this.target = 0;
    if (this.snap || reduced) { this.pan = this.target; this.snap = false; }
    else this.pan += (this.target - this.pan) * (1 - Math.exp(-dt * 2.4));
    const shift = this.panning ? 0 : this.fitShift();
    const baseY = h - Math.max(5, bandH * 0.07);
    c.save();
    c.beginPath();
    c.rect(0, h - bandH, w, bandH);
    c.clip();
    const st: SceneState = { t, active: false, bites: b.bites };
    for (let i = 0; i < n; i++) {
      const id = this.vis[i];
      const p = this.pres[id];
      const e = p * p * (3 - 2 * p);
      const sx = this.xs[i] * sc - this.pan * sc + shift;
      const wpx = W[id] * sc * e;
      if (sx + wpx < -10 || sx > w + 10) continue;
      this.spx[id] = sx + wpx / 2;
      this.spw[id] = wpx;
      this.spv[id] = e > 0.7;
      st.active = id === 'stage' || id === 'onemore' ? b.cookActive : false;
      const grow = 0.55 + 0.45 * e;
      c.globalAlpha = Math.min(1, e * 1.4);
      push(c, sx + wpx / 2, baseY + (1 - e) * 46 * sc, sc * popOf(id) * grow);
      c.translate(-W[id] / 2, 0);
      DRAW[id](c, t, st);
      pop(c);
    }
    c.globalAlpha = 1;
    c.restore();
    // 页码点
    if (n > 1 && this.panning) {
      const y = h - bandH + 6;
      const x0 = w / 2 - (n - 1) * 5;
      for (let i = 0; i < n; i++) {
        c.fillStyle = i === ci ? '#111' : '#bbb';
        c.beginPath();
        c.arc(x0 + i * 10, y, i === ci ? 2.4 : 1.8, 0, TAU);
        c.fill();
      }
    }
  }

  /** 当前可见的景点(屏幕 x):传送带上的苹果经过它们 */
  spots(out: Array<{ id: string; x: number; w: number }>): number {
    let n = 0;
    for (const id of SCENE_ORDER) {
      if (!this.spv[id]) continue;
      const o = out[n] ?? (out[n] = { id, x: 0, w: 0 });
      o.id = id;
      o.x = this.spx[id];
      o.w = this.spw[id];
      n++;
    }
    return n;
  }

  /** 命中检测(屏幕坐标);只在街区带内有效 */
  hit(px: number, py: number): SceneId | null {
    if (py < this.lastH - this.lastBand || py > this.lastH) return null;
    let best: SceneId | null = null;
    let bd = 1e9;
    for (const id of SCENE_ORDER) {
      if (!this.spv[id]) continue;
      const d = Math.abs(px - this.spx[id]);
      if (d < Math.max(24, this.spw[id] / 2) && d < bd) { bd = d; best = id; }
    }
    return best;
  }
}
