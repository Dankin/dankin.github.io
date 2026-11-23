/** 新增升级的小角色:拖拉机、无人机、苹果云。都是屏幕像素坐标,不分配对象。 */
import { drawApple, glow, GOLD, INK, RED, TAU } from './draw.ts';
import { disc, ell, limb, ln, pop, push, txt } from './chars.ts';

type C = CanvasRenderingContext2D;

/** 拖拉机拉着装满苹果的拖车。dir=1 向右开,拖车在左边。h=拖拉机高(px)。 */
export function tractor(c: C, x: number, y: number, h: number, o: { t: number; dir: number; crates: number }): void {
  push(c, x, y, h / 50);
  c.scale(o.dir, 1);
  ln(c, 2.4);
  ell(c, 0, 0.5, 50, 3, 'rgba(0,0,0,.1)', false);
  const bob = Math.sin(o.t * 24) * 0.7;
  // 拖车
  c.translate(0, bob * 0.5);
  limb(c, -4, -9, -22, -9, 3, INK);
  c.beginPath();
  c.roundRect(-58, -28, 38, 20, 3);
  c.fillStyle = '#e8c27a';
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(-48, -28);
  c.lineTo(-48, -8);
  c.moveTo(-38, -28);
  c.lineTo(-38, -8);
  c.moveTo(-29, -28);
  c.lineTo(-29, -8);
  c.stroke();
  const n = Math.max(1, Math.min(6, o.crates));
  for (let i = 0; i < n; i++) disc(c, -53 + (i % 4) * 8.6, -31 - Math.floor(i / 4) * 6, 4.6, i === n - 1 && n > 3 ? GOLD : RED);
  disc(c, -48, -5, 6, '#444');
  disc(c, -48, -5, 2.2, '#ddd', false);
  disc(c, -30, -5, 6, '#444');
  disc(c, -30, -5, 2.2, '#ddd', false);
  // 车身
  c.beginPath();
  c.roundRect(-2, -30, 30, 15, 3);
  c.fillStyle = RED;
  c.fill();
  c.stroke();
  c.beginPath();
  c.roundRect(24, -23, 19, 9, 3);
  c.fill();
  c.stroke();
  // 驾驶棚 + 司机
  c.beginPath();
  c.moveTo(-1, -30);
  c.lineTo(1, -46);
  c.lineTo(17, -46);
  c.lineTo(19, -30);
  c.closePath();
  c.fillStyle = '#cfe7f5';
  c.fill();
  c.stroke();
  disc(c, 9, -38, 4.2, '#ffd9b8');
  c.fillStyle = '#f4cf63';
  c.beginPath();
  c.ellipse(9, -41.4, 7, 2, 0, 0, TAU);
  c.fill();
  c.stroke();
  // 排气管
  limb(c, 32, -24, 32, -36, 3.4, '#444');
  const pu = (o.t * 1.6) % 1;
  c.globalAlpha = 1 - pu;
  disc(c, 32 + pu * -8, -40 - pu * 14, 2 + pu * 4, '#fff');
  c.globalAlpha = 1;
  // 轮子:后大前小,带转动的辐条
  const rot = o.t * 9;
  for (let i = 0; i < 2; i++) {
    const wx = i ? 34 : 7;
    const wr = i ? 7 : 12;
    disc(c, wx, -wr, wr, '#2a2a2a');
    disc(c, wx, -wr, wr * 0.5, '#ddd');
    c.beginPath();
    c.moveTo(wx + Math.cos(rot) * wr * 0.5, -wr + Math.sin(rot) * wr * 0.5);
    c.lineTo(wx - Math.cos(rot) * wr * 0.5, -wr - Math.sin(rot) * wr * 0.5);
    c.stroke();
  }
  pop(c);
}

/** 无人机:四个旋翼 + 吊着一个小篮子,篮里有苹果。s=机身宽(px) */
export function drone(c: C, x: number, y: number, s: number, o: { t: number; tilt: number; full: number }): void {
  push(c, x, y, s / 40);
  c.rotate(o.tilt);
  ln(c, 2.2);
  // 吊绳 + 篮子
  c.beginPath();
  c.moveTo(-6, 4);
  c.lineTo(-8, 15);
  c.moveTo(6, 4);
  c.lineTo(8, 15);
  c.stroke();
  c.beginPath();
  c.moveTo(-10, 15);
  c.lineTo(10, 15);
  c.lineTo(8, 24);
  c.lineTo(-8, 24);
  c.closePath();
  c.fillStyle = '#e8c27a';
  c.fill();
  c.stroke();
  if (o.full > 0.15) {
    disc(c, -3.4, 13.5, 4.4, RED);
    if (o.full > 0.55) disc(c, 3.6, 13.8, 4.4, GOLD);
  }
  // 旋翼臂
  limb(c, -6, -2, -18, -6, 3, '#ccc');
  limb(c, 6, -2, 18, -6, 3, '#ccc');
  const f = Math.sin(o.t * 60);
  for (let i = 0; i < 2; i++) {
    const rx = i ? 18 : -18;
    ln(c, 1.6);
    c.beginPath();
    c.ellipse(rx, -8, 10 * (0.55 + 0.45 * Math.abs(f)), 1.6, 0, 0, TAU);
    c.fillStyle = 'rgba(255,255,255,.7)';
    c.fill();
    c.stroke();
    disc(c, rx, -7, 1.6, INK, false);
  }
  // 机身
  c.beginPath();
  c.ellipse(0, 0, 11, 6.5, 0, 0, TAU);
  c.fillStyle = '#fff';
  c.fill();
  ln(c, 2.2);
  c.stroke();
  disc(c, 0, 0.5, 2.5, Math.sin(o.t * 8) > 0 ? RED : '#7a1a1f', false);
  pop(c);
}

/** 苹果云:云体 + "上传中…" + 进度点。lv 越高越大越亮。 */
export function cloud(c: C, x: number, y: number, w: number, o: { t: number; lv: number; prog: number }): void {
  const bright = Math.min(1, 0.35 + o.lv * 0.06);
  glow(c, GOLD, x, y, w * 0.95, 0.18 + bright * 0.5);
  push(c, x, y, w / 100);
  ln(c, 2.4);
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(-42, 12);
  c.bezierCurveTo(-58, 12, -58, -10, -38, -9);
  c.bezierCurveTo(-38, -30, -12, -34, -4, -20);
  c.bezierCurveTo(6, -38, 38, -32, 36, -8);
  c.bezierCurveTo(56, -10, 58, 12, 42, 12);
  c.closePath();
  c.fill();
  c.stroke();
  // 云里的苹果轮廓(小)
  drawApple(c, -24, -2, 6.5, RED, 1.6);
  txt(c, '上传中…', 6, -6, 9.5, INK, 'center', false, 800);
  // 进度条
  const bw = 46;
  c.beginPath();
  c.roundRect(-17, 2, bw, 5.5, 2.7);
  c.fillStyle = '#e9e9e9';
  c.fill();
  c.lineWidth = 1.2 / (w / 100);
  c.stroke();
  c.beginPath();
  c.roundRect(-17, 2, Math.max(4, bw * o.prog), 5.5, 2.7);
  c.fillStyle = GOLD;
  c.fill();
  // 三个跳动的点
  for (let i = 0; i < 3; i++) disc(c, 20 + i * 5, -6 - Math.max(0, Math.sin(o.t * 6 - i * 0.9)) * 2.4, 1.3, INK, false);
  pop(c);
}

/** 远处的小鸟(V 形,拍翅) */
export function bird(c: C, x: number, y: number, s: number, t: number): void {
  const f = Math.sin(t * 9) * 0.45;
  c.strokeStyle = '#555';
  c.lineWidth = Math.max(1.2, s * 0.14);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x - s, y - s * (0.3 + f));
  c.quadraticCurveTo(x - s * 0.4, y - s * (0.1 + f * 0.5), x, y);
  c.quadraticCurveTo(x + s * 0.4, y - s * (0.1 + f * 0.5), x + s, y - s * (0.3 + f));
  c.stroke();
}
