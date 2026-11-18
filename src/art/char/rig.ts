/**
 * 角色骨架：把“体型 + 姿势 + 装饰”画成一张手绘小人。
 * 视角：略微 3/4 朝右（引擎里用 flipX 表示朝左）；坐标单位见 ink.ts（SS=3 时 1 单位 = 1 位图像素）。
 * 绘制顺序：behind → 后腿/下身 → 躯干 → 后臂 → 脖饰 → 头(后发/脸/前发/脸饰/帽) → 前臂 → 手持物 → lowerFront
 */
import { Ctx, Pt, INK, blob, paint, limb, stroke, dot, ellipsePts, dark, light, mix, rgba, grain, mkc } from './ink';

export interface Rig {
  W: number; H: number; ground: number; cx: number;
  legLen: number; hipY: number; shY: number; sw: number; hw: number; belly: number;
  headCy: number; headRx: number; headRy: number;
  upper: number; fore: number; limbW: number; legW: number; kid: boolean;
}
export function makeRig(kid: boolean, o: Partial<Rig> = {}): Rig {
  const r: Rig = kid
    ? { W: 48, H: 63, ground: 60.5, cx: 24, legLen: 9, hipY: 51, shY: 39, sw: 15, hw: 14, belly: 0, headCy: 26.5, headRx: 12.6, headRy: 11.6, upper: 5.4, fore: 5.2, limbW: 4.6, legW: 5, kid }
    : { W: 48, H: 72, ground: 69.5, cx: 24, legLen: 14, hipY: 55.5, shY: 38, sw: 18.5, hw: 16.5, belly: 0, headCy: 24, headRx: 12, headRy: 11, upper: 7.2, fore: 6.6, limbW: 5, legW: 5.6, kid };
  return { ...r, ...o };
}

export type Eyes = 'open' | 'blink' | 'happy' | 'wide' | 'closed' | 'sad' | 'half';
export type Mouth = 'smile' | 'grin' | 'o' | 'sing' | 'flat' | 'frown' | 'tiny' | 'laugh' | 'smirk' | 'sing2';
export type Brows = 'n' | 'worry' | 'up' | 'angry' | 'happy';
export interface Arm { a: number; b: number }  // 上臂/前臂相对“垂直向下”的角度（弧度，正 = 向 +x 摆）
export interface Pose {
  bob: number; sway: number; squash: number;
  footL: { dx: number; lift: number }; footR: { dx: number; lift: number };
  kneeL: number; kneeR: number;
  armL: Arm; armR: Arm;            // L = 画面左侧(后臂)，R = 画面右侧(前臂)
  tilt: number; headDx: number; headDy: number; look: number;
  eyes: Eyes; mouth: Mouth; brows: Brows; blush: number; sweat: boolean; sparkle?: boolean;
  wheel: number; chairTilt: number; // 轮椅用
  prop?: string;                    // 手持物/姿态标记：'fan' | 'book' | 'brush' ...
  tag?: string;
}
export function pose(p: Partial<Pose> = {}): Pose {
  return {
    bob: 0, sway: 0, squash: 1,
    footL: { dx: -0.8, lift: 0 }, footR: { dx: 0.8, lift: 0 }, kneeL: 0.6, kneeR: 0.6,
    armL: { a: 0.1, b: 0.04 }, armR: { a: -0.12, b: -0.04 },
    tilt: 0, headDx: 0, headDy: 0, look: 0,
    eyes: 'open', mouth: 'smile', brows: 'n', blush: 0.5, sweat: false,
    wheel: 0, chairTilt: 0,
    ...p,
  };
}

export interface Spec {
  id: string; kid?: boolean; frame?: 'adult' | 'kid';
  skin: string; hair: string; top: string; pants: string; shoes: string; accent: string;
  sleeve?: string; hand?: string; legCol?: string; noShoes?: boolean;
  rig?: Partial<Rig>;
  eyeCol?: string; lash?: boolean; cheek?: string; ears?: boolean;
  deco: Deco;
  /** 按姿势键微调姿势（轮椅等特殊体型用） */
  mod?: (key: string, p: Pose) => void;
}
export interface G {
  x: Ctx; r: Rig; p: Pose; s: Spec; cx: number;
  hx: number; hy: number;               // 头心（已含 bob/tilt 前的位置）
  shL: Pt; shR: Pt; hipL: Pt; hipR: Pt; footL: Pt; footR: Pt;
  elbL: Pt; elbR: Pt; handL: Pt; handR: Pt;
  torsoTop: number; hipY: number;
}
type H = (g: G) => void;
export interface Deco {
  behind?: H; lower?: H; lowerFront?: H; torso?: H; torsoOver?: H; backArm?: H; neck?: H; neckFront?: H;
  hairBack?: H; hairFront?: H; faceDeco?: H; hat?: H; held?: H; heldBack?: H; frontArm?: H; noLegs?: boolean;
  /** 躯干形状：可选，默认圆角梯形 */
  torsoPts?: (g: G) => Pt[];
  armSleeve?: 'long' | 'short';
}

// ———————————————— 实现 ————————————————
/** 两段骨 IK：返回肘点（dir=+1/-1 选择肘朝向） */
export function ik(sh: Pt, tg: Pt, l1: number, l2: number, dir = 1): { e: Pt; h: Pt } {
  let dx = tg[0] - sh[0], dy = tg[1] - sh[1];
  let d = Math.hypot(dx, dy); const mx = (l1 + l2) * 0.999;
  if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx; }
  const a = Math.atan2(dy, dx), cs = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const t = a + dir * Math.acos(cs);
  const e: Pt = [sh[0] + Math.cos(t) * l1, sh[1] + Math.sin(t) * l1];
  return { e, h: [sh[0] + dx, sh[1] + dy] };
}
export function armLimb(g: G, sh: Pt, a: { e: Pt; h: Pt }, sleeve?: string, hand?: string, seed = 7) {
  const { x, r, s } = g;
  limb(x, [sh, a.e, a.h], r.limbW, sleeve ?? s.sleeve ?? s.top, { seed });
  dot(x, a.h[0], a.h[1] + 0.4, r.kid ? 2.3 : 2.6, hand ?? s.hand ?? s.skin, INK);
}
const dirv = (a: number): Pt => [Math.sin(a), Math.cos(a)];

export function drawChar(s: Spec, p: Pose, seedBase = 1): HTMLCanvasElement {
  const r = makeRig(!!(s.frame ? s.frame === 'kid' : s.kid), s.rig);
  const { c, x } = mkc(r.W, r.H);
  const D = s.deco;
  const cx = r.cx;
  const sq = p.squash;
  const hipY = r.hipY + p.bob * 0.55;
  const breath = (sq - 1) * (r.hipY - r.shY);
  const shY = r.shY + p.bob - breath;
  const shift = p.sway;
  const sleeveCol = s.sleeve ?? s.top;
  const handCol = s.hand ?? s.skin;
  const hx0 = cx + shift * 1.2 + p.headDx, hy0 = r.headCy + p.bob + p.headDy - breath;

  const shL: Pt = [cx - r.sw / 2 + 1.2 + shift, shY + 2.2], shR: Pt = [cx + r.sw / 2 - 1.2 + shift, shY + 2.2];
  const arm = (sh: Pt, a: Arm) => {
    const e: Pt = [sh[0] + dirv(a.a)[0] * r.upper, sh[1] + dirv(a.a)[1] * r.upper];
    const h: Pt = [e[0] + dirv(a.b)[0] * r.fore, e[1] + dirv(a.b)[1] * r.fore];
    return { e, h };
  };
  const aL = arm(shL, p.armL), aR = arm(shR, p.armR);
  const hipL: Pt = [cx - r.hw * 0.22 + shift * 0.3, hipY], hipR: Pt = [cx + r.hw * 0.22 + shift * 0.3, hipY];
  const footL: Pt = [hipL[0] + p.footL.dx, r.ground - p.footL.lift], footR: Pt = [hipR[0] + p.footR.dx, r.ground - p.footR.lift];
  const g: G = { x, r, p, s, cx, hx: hx0, hy: hy0, shL, shR, hipL, hipR, footL, footR, elbL: aL.e, elbR: aR.e, handL: aL.h, handR: aR.h, torsoTop: shY, hipY };

  x.save();
  if (p.chairTilt) { x.translate(cx - 4, r.ground); x.rotate(p.chairTilt); x.translate(-(cx - 4), -r.ground); }
  D.behind?.(g);
  // —— 下身 ——
  if (D.lower) D.lower(g);
  else if (!D.noLegs) drawLegs(g);
  // —— 躯干 ——
  D.heldBack?.(g);
  drawTorso(g);
  D.torso?.(g);
  // 后臂
  if (D.backArm) D.backArm(g); else drawArm(g, shL, aL, sleeveCol, handCol, 7);
  D.neck?.(g);
  // —— 头 ——
  drawHead(g);
  // —— 前臂 ——
  if (D.frontArm) D.frontArm(g); else drawArm(g, shR, aR, sleeveCol, handCol, 11);
  D.neckFront?.(g);
  D.torsoOver?.(g);
  D.held?.(g);
  D.lowerFront?.(g);
  x.restore();
  grain(x, r.W, r.H, seedBase * 31 + 5, 0.1);
  return c;
}

function drawLegs(g: G) {
  const { x, r, p, s } = g;
  const pc = s.legCol ?? s.pants, so = s.noShoes ? s.skin : s.shoes;
  const leg = (hip: Pt, foot: Pt, knee: number, seed: number, front: boolean) => {
    const mid: Pt = [(hip[0] + foot[0]) / 2 + knee * 2.2, (hip[1] + foot[1]) / 2 - Math.max(0, (r.legLen - (foot[1] - hip[1])) * 0.0)];
    limb(x, [[hip[0], hip[1] - 1], mid, [foot[0], foot[1] - 2.2]], r.legW, front ? pc : dark(pc, 0.12), { seed });
    // 鞋：脚尖朝 +x
    blob(x, foot[0] + 1.6, foot[1] - 1.6, r.kid ? 4.6 : 5.2, 2.7, so, { seed: seed + 3, hi: 0.6, shade: 0.5, lw: 1.2, n: 9 });
    if (!s.noShoes) { x.save(); x.strokeStyle = rgba('#fff7e0', 0.55); x.lineWidth = 0.9; x.beginPath(); x.moveTo(foot[0] - 2.8, foot[1] - 0.6); x.lineTo(foot[0] + 5.2, foot[1] - 0.6); x.stroke(); x.restore(); }
  };
  // 抬得高的腿画在后面
  const order = p.footL.lift > p.footR.lift ? [0, 1] : [1, 0];
  for (const i of order) {
    if (i === 0) leg(g.hipL, g.footL, p.kneeL, 21, false); else leg(g.hipR, g.footR, p.kneeR, 22, true);
  }
}

function drawTorso(g: G) {
  const { x, r, s, cx, p } = g;
  const sh = g.torsoTop, hp = g.hipY + 1.2, sw = r.sw, hw = r.hw, sx = p.sway;
  const bl = r.belly;
  const pts: Pt[] = g.s.deco.torsoPts ? g.s.deco.torsoPts(g) : [
    [cx - sw / 2 + sx, sh + 1.2], [cx - sw * 0.2 + sx, sh - 0.3], [cx + sw * 0.2 + sx, sh - 0.3], [cx + sw / 2 + sx, sh + 1.2],
    [cx + sw / 2 + 0.7 + bl + sx * 0.6, (sh + hp) / 2], [cx + hw / 2 + bl * 0.8 + sx * 0.3, hp - 1], [cx + hw * 0.25, hp + 1.1],
    [cx - hw * 0.25, hp + 1.1], [cx - hw / 2 - bl * 0.6 + sx * 0.3, hp - 1], [cx - sw / 2 - 0.5 - bl * 0.4 + sx * 0.6, (sh + hp) / 2],
  ];
  paint(x, pts, s.top, { seed: 5, hiAt: [0.3, 0.2] });
}

function drawArm(g: G, sh: Pt, a: { e: Pt; h: Pt }, sleeve: string, hand: string, seed: number) {
  const { x, r, s } = g;
  limb(x, [sh, a.e, a.h], r.limbW, sleeve, { seed });
  // 袖口/手
  dot(x, a.h[0], a.h[1] + 0.4, r.kid ? 2.3 : 2.6, hand, INK);
  x.save(); x.fillStyle = 'rgba(255,248,222,0.55)'; x.beginPath(); x.arc(a.h[0] - 0.7, a.h[1] - 0.4, 0.8, 0, 7); x.fill(); x.restore();
}

// —— 头 ——
function drawHead(g: G) {
  const { x, r, p, s, hx, hy } = g;
  x.save();
  const pivotY = hy + r.headRy * 0.85;
  x.translate(hx, pivotY); x.rotate(p.tilt); x.translate(0, -r.headRy * 0.85);
  // 现在 (0,0) = 头心
  const D = s.deco;
  D.hairBack?.(g);
  const rx = r.headRx, ry = r.headRy;
  // 耳朵
  if (s.ears !== false) { blob(x, -rx + 0.8, 2, 2.2, 2.7, s.skin, { seed: 41, lw: 1, hi: 0.3 }); }
  // 头
  const pts: Pt[] = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const sn = Math.sin(a);
    // 下半略收，形成圆润下巴；右侧(朝向侧)略饱满
    const kx = 1 + (sn > 0 ? -0.1 * sn : 0) + (Math.cos(a) > 0 ? 0.03 : 0);
    const ky = sn > 0 ? 1 + 0.02 * sn : 1;
    pts.push([Math.cos(a) * rx * kx, sn * ry * ky]);
  }
  paint(x, pts, s.skin, { seed: 9, hiAt: [0.3, 0.3], hi: 0.55, shade: 0.4, lw: 1.35 });
  drawFace(g);
  D.hairFront?.(g);
  D.faceDeco?.(g);
  D.hat?.(g);
  x.restore();
}

export function drawFace(g: G) {
  const { x, r, p, s } = g;
  const rx = r.headRx, ry = r.headRy;
  const fo = 2.7 + p.look;                    // 脸朝右偏
  const ey = 1.6, ex = 4.2, eyeCol = s.eyeCol ?? '#33201c';
  const E = (sx: number) => {
    const px = fo + sx * ex, py = ey;
    switch (p.eyes) {
      case 'open': case 'half': case 'sad': {
        const hh = p.eyes === 'half' ? 1.3 : 2.5;
        x.save(); x.fillStyle = eyeCol; x.beginPath(); x.ellipse(px, py, 1.9, hh, 0, 0, 7); x.fill(); x.restore();
        if (p.eyes !== 'half') { dot(x, px - 0.55, py - 0.9, 0.75, '#fffaf0'); dot(x, px + 0.6, py + 0.9, 0.35, 'rgba(255,255,255,0.7)'); }
        else stroke(x, [[px - 2, py - 1.2], [px, py - 1.6], [px + 2, py - 1.1]], INK, 0.9);
        break;
      }
      case 'wide':
        x.save(); x.fillStyle = '#fffdf4'; x.strokeStyle = INK; x.lineWidth = 0.9; x.beginPath(); x.ellipse(px, py, 2.7, 3.2, 0, 0, 7); x.fill(); x.stroke(); x.restore();
        dot(x, px + 0.2, py + 0.2, 1.1, eyeCol); dot(x, px - 0.2, py - 0.4, 0.45, '#fff');
        break;
      case 'blink': case 'closed':
        stroke(x, [[px - 2, py + 0.2], [px, py + 0.9], [px + 2, py + 0.2]], INK, 1.15); break;
      case 'happy':
        stroke(x, [[px - 2.1, py + 1], [px, py - 1.5], [px + 2.1, py + 1]], INK, 1.3); break;
    }
    if (s.lash && p.eyes !== 'wide') stroke(x, [[px + sx * 1.6, py - 0.8], [px + sx * 3, py - 1.9]], INK, 0.8);
  };
  E(-1); E(1);
  // 腮红
  if (p.blush > 0) {
    x.save(); x.fillStyle = rgba(s.cheek ?? '#ee7a6e', 0.42 * p.blush + 0.1);
    for (const sx of [-1, 1]) { x.beginPath(); x.ellipse(fo + sx * (ex + 0.4), ey + 3.7, 2.1, 1.3, 0, 0, 7); x.fill(); }
    x.restore();
  }
  // 鼻
  stroke(x, [[fo + 0.4, ey + 2.8], [fo + 1.2, ey + 3.5], [fo + 0.2, ey + 3.9]], dark(s.skin, 0.45), 0.8, { alpha: 0.8 });
  // 眉
  const by = ey - 3.6;
  const [dIn, dOut, lift] = ({ n: [0, 0, 0], worry: [-1.3, 0.7, 0], angry: [1.2, -0.5, 0], up: [-0.4, -0.4, -1.2], happy: [-0.2, 0.3, -0.3] } as Record<string, number[]>)[p.brows];
  for (const sx of [-1, 1]) {
    const ox = fo + sx * ex, ix = ox - sx * 1.9, outx = ox + sx * 1.9;
    stroke(x, [[ix, by + dIn + lift], [ox, by - 0.5 + lift + (dIn + dOut) * 0.2], [outx, by + dOut + lift]], '#5b3a2a', 1);
  }
  // 嘴
  const mx = fo + 0.9, my = ey + 5.6;
  switch (p.mouth) {
    case 'smile': stroke(x, [[mx - 2.2, my - 0.4], [mx, my + 1.2], [mx + 2.2, my - 0.5]], '#8a3f35', 1.1); break;
    case 'smirk': stroke(x, [[mx - 1.6, my + 0.1], [mx + 0.4, my + 0.6], [mx + 2.6, my - 1]], '#8a3f35', 1.1); break;
    case 'tiny': stroke(x, [[mx - 1, my + 0.2], [mx + 1, my + 0.2]], '#8a3f35', 1); break;
    case 'flat': stroke(x, [[mx - 1.6, my + 0.3], [mx + 1.6, my + 0.3]], '#8a3f35', 1.05); break;
    case 'frown': stroke(x, [[mx - 1.8, my + 1], [mx, my - 0.3], [mx + 1.8, my + 1]], '#8a3f35', 1.1); break;
    case 'o': x.save(); x.fillStyle = '#6a2a28'; x.strokeStyle = INK; x.lineWidth = 0.8; x.beginPath(); x.ellipse(mx, my + 0.8, 1.7, 2.2, 0, 0, 7); x.fill(); x.stroke(); x.fillStyle = '#e88a82'; x.beginPath(); x.ellipse(mx, my + 1.7, 1, 0.8, 0, 0, 7); x.fill(); x.restore(); break;
    case 'sing': case 'sing2': case 'grin': case 'laugh': {
      const w = p.mouth === 'grin' ? 3.2 : p.mouth === 'laugh' ? 3.6 : 2.2, h = p.mouth === 'grin' ? 2.2 : p.mouth === 'laugh' ? 3 : p.mouth === 'sing2' ? 2.4 : 3.1;
      x.save(); x.fillStyle = '#6a2a28'; x.strokeStyle = INK; x.lineWidth = 0.85;
      x.beginPath(); x.moveTo(mx - w, my - 0.2); x.quadraticCurveTo(mx, my - 0.6, mx + w, my - 0.2); x.quadraticCurveTo(mx + w * 0.9, my + h, mx, my + h + 0.2); x.quadraticCurveTo(mx - w * 0.9, my + h, mx - w, my - 0.2); x.fill(); x.stroke();
      x.clip(); x.fillStyle = '#f08a80'; x.beginPath(); x.ellipse(mx + 0.3, my + h, w * 0.7, h * 0.55, 0, 0, 7); x.fill();
      if (p.mouth === 'grin' || p.mouth === 'laugh') { x.fillStyle = '#fffaf0'; x.fillRect(mx - w + 0.5, my - 0.5, w * 2 - 1, 1.2); }
      x.restore(); break;
    }
  }
  if (p.sweat) { // 汗滴
    x.save(); x.fillStyle = 'rgba(190,226,250,0.95)'; x.strokeStyle = '#5b86a8'; x.lineWidth = 0.7;
    x.beginPath(); x.moveTo(rx - 2, -ry + 4.5); x.quadraticCurveTo(rx + 1.8, -ry + 8.5, rx - 0.6, -ry + 9.5); x.quadraticCurveTo(rx - 3.2, -ry + 8.6, rx - 2, -ry + 4.5); x.fill(); x.stroke(); x.restore();
  }
}

// —— 通用头发工具（局部头坐标）——
export function hairCap(g: G, col: string, o: { vol?: number; fringe?: number; part?: number; sideL?: number; sideR?: number; seed?: number; spiky?: number } = {}) {
  const { x, r } = g; const rx = r.headRx, ry = r.headRy;
  const v = o.vol ?? 1.6, f = o.fringe ?? 4.2, pt = o.part ?? -2, sl = o.sideL ?? 2.2, sr = o.sideR ?? 1.2;
  const top: Pt[] = [
    [-rx - 0.6, sl], [-rx - 0.4, -ry * 0.45], [-rx * 0.62, -ry - v * 0.55], [-2, -ry - v - 0.4], [rx * 0.35, -ry - v * 0.9], [rx * 0.82, -ry * 0.78], [rx + 0.4, -ry * 0.18], [rx + 0.3, sr],
  ];
  const fr: Pt[] = [
    [rx - 1.4, -1.2], [rx * 0.55, -f * 0.55 - 1], [rx * 0.15, -f - 0.5], [pt, -f * 0.55], [-rx * 0.35, -f - 0.4], [-rx * 0.75, -f * 0.6], [-rx + 1.2, 0],
  ];
  if (o.spiky) {
    const sp: Pt[] = [];
    top.forEach((p, i) => { sp.push(p); if (i > 1 && i < 6) { const q = top[i + 1]; sp.push([(p[0] + q[0]) / 2 + 0.6, Math.min(p[1], q[1]) - o.spiky!]); } });
    paint(x, [...sp, ...fr], col, { seed: o.seed ?? 12, t: 0.28, hi: 0.5, hiAt: [0.3, 0.28] });
  } else paint(x, [...top, ...fr], col, { seed: o.seed ?? 12, hi: 0.55, hiAt: [0.3, 0.3] });
  // 发丝笔触
  stroke(g.x, [[-rx * 0.1, -ry - v * 0.6], [-rx * 0.3, -ry * 0.55]], dark(col, 0.35), 0.8, { alpha: 0.6 });
  stroke(g.x, [[rx * 0.35, -ry - v * 0.5], [rx * 0.55, -ry * 0.55]], dark(col, 0.35), 0.8, { alpha: 0.6 });
}
export { blob, paint, limb, stroke, dot, ellipsePts, dark, light, mix, rgba, INK };
export type { Ctx, Pt };
