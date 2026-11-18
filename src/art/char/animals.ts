/**
 * 动物（art-char）：大黄狗 dog、花猫麻薯 cat_m。同一个四足骨架，参数不同。
 * 面朝右，origin(0.5,1)，画布位图尺寸：dog 84×54，cat 52×40（SS=3 的位图像素，显示 ×ART_SCALE）。
 * 帧键：见 ANIMAL_KEYS。
 */
import { mkc, paint, blob, limb, stroke, dot, grain, dark, light, rgba, INK, Ctx, Pt, ellipsePts } from './ink';

type Mouth = 'closed' | 'open' | 'pant' | 'carry' | 'bark';
type Eyes = 'open' | 'half' | 'closed' | 'wide' | 'happy';
interface Leg { dx: number; lift: number }
interface AP {
  mode: 'stand' | 'lie' | 'sleep' | 'sit' | 'curl' | 'stretch';
  bob: number; legs: [Leg, Leg, Leg, Leg];      // 后近、前近、后远、前远
  hx: number; hy: number; tilt: number;          // 头偏移 / 倾斜
  tail: number; wag: number;                     // 尾巴抬角 / 摆幅
  mouth: Mouth; eyes: Eyes; ears: number;        // ears：>0 后压
  squash: number; sweat?: boolean; blush?: boolean;
}
interface SP {
  id: string; W: number; H: number; bcx: number; bRx: number; bRy: number; legH: number; legW: number; headR: number;
  fur: string; belly: string; ear: string; nose: string; kind: 'dog' | 'cat'; tailL: number;
}

export const ANIMALS: Record<string, SP> = {
  dog: { id: 'dog', W: 92, H: 54, bcx: 44, bRx: 22, bRy: 11.5, legH: 13, legW: 5.2, headR: 10, fur: '#e3a84c', belly: '#f4d791', ear: '#b4742c', nose: '#3b2b25', kind: 'dog', tailL: 15 },
  cat_m: { id: 'cat_m', W: 52, H: 40, bcx: 22, bRx: 12, bRy: 7, legH: 8.5, legW: 3.4, headR: 7.4, fur: '#f6efe2', belly: '#fffaf0', ear: '#e8923a', nose: '#e58f94', kind: 'cat', tailL: 20 },
};

export const ANIMAL_KEYS: Record<string, string[]> = {
  dog: ['0', '1', 'idle_0', 'idle_1', 'walk_0', 'walk_1', 'walk_2', 'walk_3', 'lie_0', 'lie_1', 'sleep_0', 'sleep_1', 'bark_0', 'bark_1', 'sit', 'scared', 'happy'],
  cat_m: ['0', '1', 'idle_0', 'idle_1', 'walk_0', 'walk_1', 'walk_2', 'walk_3', 'carry_0', 'carry_1', 'carry_2', 'carry_3', 'sleep_0', 'sleep_1', 'stretch', 'happy', 'scared'],
};

const L0: Leg = { dx: 0, lift: 0 };
const base = (o: Partial<AP> = {}): AP => ({ mode: 'stand', bob: 0, legs: [L0, L0, L0, L0], hx: 0, hy: 0, tilt: 0, tail: 0.5, wag: 0, mouth: 'closed', eyes: 'open', ears: 0, squash: 1, ...o });

function trot(k: number, S: number): [Leg, Leg, Leg, Leg] {
  // 对角步：后近+前远 同相
  const a = [S, 0, -S, 0][k], b = -a;
  const la = [0, 0, 0, 3][k] ? 3 : 0, lb = [0, 3, 0, 0][k] ? 3 : 0;
  return [{ dx: a, lift: la }, { dx: b, lift: lb }, { dx: b, lift: lb }, { dx: a, lift: la }];
}

function poseOf(id: string, key: string): AP {
  const dog = id === 'dog';
  const S = dog ? 6 : 3.6;
  const k = parseInt(key.split('_')[1] ?? '0', 10) || 0;
  switch (key) {
    case '0': case 'idle_0': return dog ? base({ tail: 0.35, mouth: 'closed' }) : base({ mode: 'sit', tail: 0.2 });
    case 'idle_1': return dog ? base({ tail: 0.55, wag: 1, bob: -0.5, eyes: 'half', mouth: 'pant', hy: -0.5 }) : base({ mode: 'sit', tail: 0.5, eyes: 'half', bob: -0.4 });
    case '1': case 'walk_0': case 'walk_1': case 'walk_2': case 'walk_3': {
      const kk = key === '1' ? 0 : k;
      return base({ bob: [0.8, -0.6, 0.8, -0.6][kk], legs: trot(kk, S), tail: dog ? 0.7 : 0.9, wag: kk % 2 ? 1 : -1, hy: [0.4, -0.4, 0.4, -0.4][kk], mouth: dog ? 'pant' : 'closed' });
    }
    case 'carry_0': case 'carry_1': case 'carry_2': case 'carry_3':
      return base({ bob: [0.6, -0.5, 0.6, -0.5][k], legs: trot(k, S), tail: 1.0, hy: -1, hx: 0.6, tilt: -0.1, mouth: 'carry' });
    case 'lie_0': return base({ mode: 'lie', tail: 0.1, eyes: 'open' });
    case 'lie_1': return base({ mode: 'lie', tail: 0.25, wag: 1, eyes: 'half', bob: -0.4, mouth: 'pant' });
    case 'sleep_0': return base({ mode: dog ? 'sleep' : 'curl', eyes: 'closed', tail: 0.1 });
    case 'sleep_1': return base({ mode: dog ? 'sleep' : 'curl', eyes: dog ? 'half' : 'closed', tail: 0.1, squash: 1.05, bob: -0.5 });
    case 'bark_0': return base({ tail: 0.8, hx: 1.5, hy: -2.5, tilt: -0.22, mouth: 'bark', eyes: 'wide', ears: 0.3, bob: -0.5, legs: [{ dx: -2, lift: 0 }, { dx: 2, lift: 0 }, L0, L0] });
    case 'bark_1': return base({ tail: 0.9, hx: 2.2, hy: -3, tilt: -0.34, mouth: 'open', eyes: 'wide', ears: 0.3, bob: -1.4, legs: [{ dx: -2.5, lift: 0 }, { dx: 2.5, lift: 1 }, L0, L0] });
    case 'sit': return base({ mode: 'sit', tail: 0.2 });
    case 'scared': return base({ bob: 2.5, ears: 1, tail: -0.5, eyes: 'wide', mouth: 'closed', hy: 1.5, hx: -1, legs: [{ dx: -1, lift: 0 }, { dx: 1, lift: 0 }, L0, L0], sweat: true, squash: 0.96 });
    case 'happy': return dog ? base({ tail: 0.85, wag: 1, bob: -1.2, eyes: 'happy', mouth: 'pant', blush: true, hy: -1, legs: [{ dx: -1, lift: 0 }, { dx: 1, lift: 2 }, L0, L0] }) : base({ mode: 'sit', tail: 0.9, eyes: 'happy', blush: true, bob: -0.4 });
    case 'stretch': return base({ mode: 'stretch', eyes: 'closed', tail: 1.3, mouth: 'open' });
  }
  return base();
}

// ———————— 画 ————————
function furPatches(x: Ctx, s: SP, drawPatch: () => void, clip: () => void) {
  x.save(); clip(); x.clip(); drawPatch(); x.restore();
}

function patchCat(x: Ctx, cx: number, cy: number, rx: number, ry: number, rot = 0, big = 1) {
  furPatches(x, ANIMALS.cat_m, () => {
    x.fillStyle = rgba('#e8923a', 0.95);
    x.beginPath(); x.ellipse(cx - rx * 0.1, cy - ry * 0.35, rx * 0.5 * big, ry * 0.7, 0.4, 0, 7); x.fill();
    x.fillStyle = rgba('#3a3030', 0.92);
    x.beginPath(); x.ellipse(cx + rx * 0.55, cy + ry * 0.1, rx * 0.34 * big, ry * 0.6, -0.3, 0, 7); x.fill();
    x.beginPath(); x.ellipse(cx - rx * 0.75, cy + ry * 0.3, rx * 0.22, ry * 0.4, 0.2, 0, 7); x.fill();
  }, () => { x.beginPath(); x.ellipse(cx, cy, rx - 0.7, ry - 0.7, rot, 0, 7); });
}

function tail(x: Ctx, s: SP, bx: number, by: number, ap: AP, ground?: number) {
  const L = s.tailL, w = s.kind === 'cat' ? 3 : 4.2;
  const th = (s.kind === 'cat' ? ap.tail * 0.55 : ap.tail) + ap.wag * 0.3;
  const dx = -Math.cos(th), dy = -Math.sin(th);
  const mid: Pt = [bx + dx * L * 0.55, by + dy * L * 0.55 + (s.kind === 'cat' ? 0 : 2)];
  const end: Pt = s.kind === 'cat'
    ? [mid[0] + dx * L * 0.25 + 2, mid[1] + dy * L * 0.5 - L * 0.1]
    : [mid[0] + dx * L * 0.3, mid[1] + dy * L * 0.3 - 3];
  if (ground !== undefined) { end[1] = Math.min(end[1], ground - 2); }
  limb(x, [[bx, by], mid, end], w, s.kind === 'cat' ? '#3a3030' : s.fur, { seed: 301, lw: 1.1 });
  if (s.kind === 'dog') dot(x, end[0], end[1], 2.1, light(s.belly, 0.3), INK);
  else dot(x, end[0], end[1], 1.8, '#3a3030', INK);
}

function head(x: Ctx, s: SP, ap: AP, hcx: number, hcy: number, carryEnvelope = false) {
  const r = s.headR;
  x.save(); x.translate(hcx, hcy); x.rotate(ap.tilt);
  const cat = s.kind === 'cat';
  // 后耳
  if (cat) {
    for (const sx of [-1, 0.2]) {
      const ex = sx * r * 0.6 - r * 0.1;
      paint(x, [[ex - 3.2, -r * 0.55], [ex + 0.2, -r - 4.6 + ap.ears * 2], [ex + 3.6, -r * 0.6]], sx < 0 ? '#e8923a' : '#3a3030', { seed: 311 + sx, lw: 1.1, wob: 0.15, t: 0.15 });
    }
  } else {
    const dr = ap.ears * 0.9;
    void dr;
  }
  blob(x, 0, 0, r * 1.08, r, s.fur, { seed: 315, lw: 1.25, n: 13, hiAt: [0.3, 0.3] });
  if (cat) {
    furPatches(x, s, () => { x.fillStyle = rgba('#e8923a', 0.95); x.beginPath(); x.ellipse(-r * 0.3, -r * 0.55, r * 0.7, r * 0.5, 0.3, 0, 7); x.fill(); x.fillStyle = rgba('#3a3030', 0.9); x.beginPath(); x.ellipse(r * 0.7, -r * 0.7, r * 0.4, r * 0.45, 0, 0, 7); x.fill(); },
      () => { x.beginPath(); x.ellipse(0, 0, r * 1.08 - 0.7, r - 0.7, 0, 0, 7); });
    for (const sx of [-1, 1]) stroke(x, [[r * 0.62 + sx * 1.8, r * 0.38 + (sx > 0 ? 0 : 0.4)], [r * 1.45, r * 0.34 + sx * 1.6]], rgba('#4a3a34', 0.6), 0.55);
  } else {
    // 嘴套
    blob(x, r * 0.8, r * 0.38, r * 0.6, r * 0.4, s.belly, { seed: 317, lw: 1.1, n: 10, hi: 0.4 });
  }
  // 前耳（猫）/ 狗额斑
  if (cat) { /* 胡须在上面画了 */ } else {
    furPatches(x, s, () => { x.fillStyle = rgba(s.ear, 0.55); x.beginPath(); x.ellipse(-r * 0.3, -r * 0.6, r * 0.55, r * 0.42, 0.2, 0, 7); x.fill(); }, () => { x.beginPath(); x.ellipse(0, 0, r * 1.08 - 0.7, r - 0.7, 0, 0, 7); });
  }
  if (!cat) blob(x, -r * 0.42, -r * 0.05 + 2, 4, 7.2, s.ear, { seed: 313, lw: 1.1, n: 9, rot: 0.2 + ap.ears * 0.9 });
  // 鼻
  dot(x, r * (cat ? 1.12 : 1.34), r * (cat ? 0.28 : 0.1), cat ? 1.1 : 2, s.nose, INK);
  // 嘴
  const mx = r * (cat ? 1.0 : 1.0), my = r * (cat ? 0.5 : 0.52);
  if (ap.mouth === 'closed') { stroke(x, [[mx - 0.4, my - 0.4], [mx - 1.4, my + 1], [mx - 3.4, my + 0.6]], '#6a3a30', 0.9); if (cat) stroke(x, [[r * 1.1, my - 0.3], [r * 1.25, my + 0.8], [r * 1.5, my + 0.5]], '#6a3a30', 0.7); }
  else if (ap.mouth === 'carry') { /* 叼信：信封盖住嘴 */ }
  else {
    const open = ap.mouth === 'bark' ? 4.6 : ap.mouth === 'open' ? 3.6 : 2.4;
    x.save(); x.fillStyle = '#6a2a28'; x.strokeStyle = INK; x.lineWidth = 0.9;
    x.beginPath(); x.ellipse(mx - 0.8, my + open * 0.35, cat ? 2 : 3.2, open * 0.6 + 0.4, -0.15, 0, 7); x.fill(); x.stroke();
    if (!cat) { x.fillStyle = '#ee7e8a'; x.beginPath(); x.ellipse(mx - 1.2, my + open * 0.6 + 0.8, 1.9, 1.2 + (ap.mouth === 'pant' ? 1.2 : 0), 0, 0, 7); x.fill(); }
    x.restore();
  }
  // 眼
  const ex = r * (cat ? 0.5 : 0.42), ey = r * (cat ? -0.1 : -0.3);
  switch (ap.eyes) {
    case 'open': dot(x, ex, ey, cat ? 1.9 : 1.6, '#2e1f1b'); dot(x, ex - 0.5, ey - 0.6, 0.6, '#fff'); if (cat) { x.save(); x.fillStyle = '#c9a63a'; x.beginPath(); x.ellipse(ex, ey, 2.1, 2.3, 0, 0, 7); x.fill(); x.fillStyle = '#2e1f1b'; x.beginPath(); x.ellipse(ex, ey, 0.8, 1.9, 0, 0, 7); x.fill(); dot(x, ex - 0.6, ey - 0.8, 0.55, '#fff'); x.restore(); } break;
    case 'wide': dot(x, ex, ey, cat ? 2.5 : 2.3, '#fffdf4', INK); dot(x, ex + 0.2, ey + 0.2, 1.1, '#2e1f1b'); break;
    case 'half': stroke(x, [[ex - 1.8, ey - 0.3], [ex, ey + 0.4], [ex + 1.8, ey - 0.3]], INK, 1); x.save(); x.fillStyle = '#2e1f1b'; x.beginPath(); x.ellipse(ex, ey + 0.8, 1.3, 0.7, 0, 0, 7); x.fill(); x.restore(); break;
    case 'closed': stroke(x, [[ex - 1.9, ey], [ex, ey + 1], [ex + 1.9, ey]], INK, 1.05); break;
    case 'happy': stroke(x, [[ex - 1.9, ey + 0.8], [ex, ey - 1], [ex + 1.9, ey + 0.8]], INK, 1.15); break;
  }
  if (ap.eyes !== 'closed') stroke(x, [[ex - 2.6, ey - 3.2], [ex + 2, ey - 3.4 - (ap.eyes === 'wide' ? 0.8 : 0)]], dark(s.fur, 0.45), 0.8, { alpha: 0.7 });
  if (ap.blush) { x.save(); x.fillStyle = 'rgba(238,122,110,0.4)'; x.beginPath(); x.ellipse(ex - 1, r * 0.5, 2.1, 1.2, 0, 0, 7); x.fill(); x.restore(); }
  if (ap.sweat) { x.save(); x.fillStyle = 'rgba(190,226,250,0.95)'; x.strokeStyle = '#5b86a8'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(-r * 0.2, -r - 1); x.quadraticCurveTo(r * 0.1, -r + 3, -r * 0.3, -r + 4); x.quadraticCurveTo(-r * 0.7, -r + 3, -r * 0.2, -r - 1); x.fill(); x.stroke(); x.restore(); }
  if (carryEnvelope || ap.mouth === 'carry') {
    x.save(); x.translate(r * 1.25, r * 0.55); x.rotate(0.3);
    paint(x, [[-3.6, -2.6], [4.6, -2.8], [4.8, 3], [-3.8, 3.2]], '#fff8e4', { seed: 331, lw: 0.95, wob: 0.15, hi: 0.3, t: 0.12 });
    stroke(x, [[-3.4, -2.4], [0.6, 0.6], [4.4, -2.6]], '#8a6a52', 0.7);
    dot(x, 0.8, 1.2, 0.9, '#d8433a');
    x.restore();
  }
  // 项圈（狗）
  if (!cat) {
    x.save(); x.rotate(0); x.strokeStyle = '#c0392b'; x.lineWidth = 2.2; x.lineCap = 'round';
    x.beginPath(); x.moveTo(-r * 0.55, r * 0.78); x.quadraticCurveTo(-r * 0.2, r * 1.12, r * 0.45, r * 0.9); x.stroke(); x.restore();
  }
  x.restore();
}

function paw(x: Ctx, s: SP, p: Pt, near: boolean) {
  blob(x, p[0] + 1.2, p[1] - 0.8, s.kind === 'cat' ? 3.2 : 4.4, s.kind === 'cat' ? 1.9 : 2.5, near ? (s.kind === 'cat' ? '#fffaf0' : light(s.belly, 0.1)) : dark(s.belly, 0.1), { seed: 321, lw: 1, n: 8, hi: 0.5 });
}

function drawAnimal(id: string, key: string): HTMLCanvasElement {
  const s = ANIMALS[id]; const ap = poseOf(id, key);
  const { c, x } = mkc(s.W, s.H);
  const gy = s.H - 3;
  const cat = s.kind === 'cat';
  const furCol = (near: boolean) => near ? (cat ? '#fffaf0' : s.fur) : dark(cat ? '#e6dccb' : s.fur, 0.18);
  const bodyFill = s.fur;
  const bcx = s.bcx + (ap.mode === 'sit' ? 2 : 0);

  const leg = (att: Pt, lg: Leg, near: boolean, seed: number, front: boolean) => {
    const foot: Pt = [att[0] + lg.dx, gy - lg.lift];
    const knee: Pt = [(att[0] + foot[0]) / 2 + (front ? 1 : -1.6), (att[1] + foot[1]) / 2];
    limb(x, [att, knee, [foot[0], foot[1] - 1.6]], s.legW, furCol(near), { seed, lw: 1.1 });
    paw(x, s, foot, near);
  };

  const bodyBlob = (cx: number, cy: number, rx: number, ry: number, rot = 0) => {
    blob(x, cx, cy, rx, ry, bodyFill, { seed: 303, lw: 1.35, n: 14, rot, hiAt: [0.3, 0.25] });
    // 肚皮浅色
    furPatches(x, s, () => { x.fillStyle = rgba(s.belly, 0.9); x.beginPath(); x.ellipse(cx + 1, cy + ry * 0.82, rx * 0.85, ry * 0.5, rot, 0, 7); x.fill(); }, () => { x.beginPath(); x.ellipse(cx, cy, rx - 0.7, ry - 0.7, rot, 0, 7); });
    if (cat) patchCat(x, cx, cy, rx, ry, rot);
    else furPatches(x, s, () => { x.fillStyle = rgba(s.ear, 0.5); x.beginPath(); x.ellipse(cx - rx * 0.2, cy - ry * 0.55, rx * 0.5, ry * 0.5, 0.3, 0, 7); x.fill(); }, () => { x.beginPath(); x.ellipse(cx, cy, rx - 0.7, ry - 0.7, rot, 0, 7); });
  };

  // 地面小影
  x.save(); x.fillStyle = 'rgba(70,45,30,0.16)'; x.beginPath(); x.ellipse(bcx + 2, gy + 0.6, s.bRx * 1.05, 2.2, 0, 0, 7); x.fill(); x.restore();

  const sq = ap.squash;
  if (ap.mode === 'stand' || ap.mode === 'stretch') {
    const stretch = ap.mode === 'stretch';
    const by = gy - s.legH - s.bRy * 0.55 + ap.bob + (stretch ? 4 : 0);
    const hindA: Pt = [bcx - s.bRx * 0.62, by + s.bRy * 0.4], frontA: Pt = [bcx + s.bRx * 0.6, by + s.bRy * 0.4];
    const L = ap.legs;
    if (stretch) { // 伸懒腰：屁股翘、前爪向前伸、头低
      tail(x, s, bcx - s.bRx * 0.9, by - s.bRy * 0.7, ap);
      leg(hindA, L[2], false, 12, false);
      limb(x, [[bcx + s.bRx * 0.5, by + 2], [bcx + s.bRx * 1.1, gy - 3], [bcx + s.bRx * 1.7, gy - 1.5]], s.legW, furCol(true), { seed: 14, lw: 1.1 });
      paw(x, s, [bcx + s.bRx * 1.7, gy], true);
      bodyBlob(bcx - 1, by - 3, s.bRx * 1.02, s.bRy * 0.95, -0.35);
      leg(hindA, L[0], true, 11, false);
      head(x, s, ap, bcx + s.bRx * 1.35, gy - s.headR * 0.9, false);
    } else {
      tail(x, s, bcx - s.bRx * 0.92, by - s.bRy * 0.15, ap);
      leg(hindA, L[2], false, 12, false); leg(frontA, L[3], false, 13, true);
      bodyBlob(bcx, by, s.bRx * (2 - sq) * 0.5 + s.bRx * 0.5 * sq, s.bRy * sq);
      leg(hindA, L[0], true, 11, false); leg(frontA, L[1], true, 10, true);
      head(x, s, ap, bcx + s.bRx * 0.95 + ap.hx + (cat ? 0 : 2), by - s.bRy * (cat ? 0.7 : 0.95) + ap.hy - (cat ? 1 : 0), false);
    }
  } else if (ap.mode === 'sit') {
    const sc = cat ? 1 : 0.8;
    const by = gy - s.bRy * 1.35 + ap.bob;
    tail(x, s, bcx - s.bRx * 0.55, gy - 2.5, { ...ap, tail: 0.15 + ap.tail * 0.5 }, gy);
    // 后腿侧面的大腿
    blob(x, bcx - 3, gy - s.bRy * 0.75, s.bRx * 0.62, s.bRy * 0.85, dark(bodyFill, 0.05), { seed: 305, lw: 1.2, n: 11 });
    bodyBlob(bcx + 0.5, by, s.bRx * 0.66 * sc + 2, s.bRy * 1.38 * sc + 1, 0.2);
    // 前腿竖直
    limb(x, [[bcx + s.bRx * 0.4, gy - s.bRy * 1.5 * sc], [bcx + s.bRx * 0.5, gy - 3]], s.legW, furCol(true), { seed: 15, lw: 1.1 });
    paw(x, s, [bcx + s.bRx * 0.5 + 0.5, gy], true);
    blob(x, bcx - 4, gy - 1.6, s.bRx * 0.6, 2.4, dark(bodyFill, 0.05), { seed: 307, lw: 1.1, n: 8 });
    head(x, s, ap, bcx + s.bRx * 0.55 + ap.hx, by - s.bRy * 1.25 * sc + ap.hy + (cat ? 0 : 2), false);
  } else if (ap.mode === 'lie' || ap.mode === 'sleep') {
    const by = gy - s.bRy * 0.88 + ap.bob * 0.6;
    const sleep = ap.mode === 'sleep';
    tail(x, s, bcx - s.bRx * 0.95, by + 1.5, { ...ap, tail: 0.05 + ap.wag * 0.05 }, gy);
    bodyBlob(bcx, by, s.bRx * (sleep ? 1.02 : 1.0) * (2 - sq) * 0.5 + s.bRx * 0.5 * sq, s.bRy * 0.95 * sq);
    blob(x, bcx - s.bRx * 0.4, gy - s.bRy * 0.6, s.bRx * 0.5, s.bRy * 0.7, dark(bodyFill, 0.06), { seed: 309, lw: 1.1, n: 10 });
    blob(x, bcx - s.bRx * 0.2, gy - 2, s.bRx * 0.55, 2.4, furCol(false), { seed: 310, lw: 1, n: 8 });
    // 头 + 前爪
    if (sleep) {
      head(x, s, { ...ap, tilt: 0.12 }, bcx + s.bRx * 1.12, gy - s.headR * 0.9 - 0.5, false);
      blob(x, bcx + s.bRx * 1.18, gy - 2.4, 6.4, 2.8, furCol(true), { seed: 316, lw: 1.1, n: 8 });
      blob(x, bcx + s.bRx * 1.5, gy - 2.2, 5.4, 2.6, light(s.belly, 0.1), { seed: 317, lw: 1.1, n: 8 });
    } else {
      limb(x, [[bcx + s.bRx * 0.55, gy - s.bRy * 0.7], [bcx + s.bRx * 1.2, gy - 3.2]], s.legW, furCol(true), { seed: 318, lw: 1.1 });
      blob(x, bcx + s.bRx * 1.38, gy - 2.3, 5.4, 2.6, light(s.belly, 0.1), { seed: 319, lw: 1.1, n: 8 });
      head(x, s, ap, bcx + s.bRx * 0.98 + ap.hx, gy - s.bRy * 1.75 + ap.hy, false);
    }
  } else if (ap.mode === 'curl') { // 猫：团成一团
    const by = gy - s.bRy * 1.05 + ap.bob * 0.7;
    bodyBlob(bcx, by, s.bRx * 1.02 * (2 - sq) * 0.5 + s.bRx * 0.5 * sq, s.bRy * 1.12 * sq);
    // 尾巴环抱
    limb(x, [[bcx - s.bRx * 0.9, by + 1], [bcx - s.bRx * 0.5, gy - 1.2], [bcx + s.bRx * 0.7, gy - 1.6], [bcx + s.bRx * 1.05, gy - 4]], 3.2, '#3a3030', { seed: 320, lw: 1.1 });
    head(x, s, { ...ap, tilt: 0.45, eyes: 'closed' }, bcx + s.bRx * 0.82, gy - s.headR * 0.95, false);
    blob(x, bcx + s.bRx * 0.9, gy - 2, 4, 2, '#fffaf0', { seed: 322, lw: 1, n: 8 });
  }
  grain(x, s.W, s.H, 7 + id.length, 0.1);
  void ellipsePts;
  return c;
}

export function buildAnimalFrames(id: string): Record<string, HTMLCanvasElement> {
  const keys = ANIMAL_KEYS[id]; const out: Record<string, HTMLCanvasElement> = {};
  for (const k of keys) {
    if (k === '0' && out.idle_0) { out['0'] = out.idle_0; continue; }
    if (k === '1' && out.walk_0) { out['1'] = out.walk_0; continue; }
    out[k] = drawAnimal(id, k);
  }
  return out;
}
export const isAnimal = (id: string) => id in ANIMALS;
