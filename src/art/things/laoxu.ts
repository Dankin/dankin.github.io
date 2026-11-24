// 老徐 v2:大头 Q 版(草帽 + 墨镜 + 白胡子 + 背带裤),8 级形态 × 12 种状态,配套道具独立导出。
// (x,y)=脚底中心,s=1 时全高约 66 世界单位(帽顶到脚底),32px 缩略也能认:宽草帽 + 黑墨镜条 + 白胡子团。
// 确定性:每个部件用独立 seed 的 Ink,状态切换不会让别的部件抖动;全部每帧现画,无 shadowBlur。
import { drawApple } from './apple.ts';
import { F, INK, Ink, TAU, clamp, ease, lerp, sparkle } from './ink.ts';
import type { C, Pt } from './ink.ts';
import type { ThingFn, ThingOpt } from './types.ts';

export type LaoXuState = 'idle' | 'cheer' | 'beat' | 'clap' | 'help' | 'shake' | 'sit' | 'nap' | 'wake' | 'watch' | 'coach' | 'retire';
export const LAOXU_STATES: LaoXuState[] = ['idle', 'cheer', 'beat', 'clap', 'help', 'shake', 'sit', 'nap', 'wake', 'watch', 'coach', 'retire'];
export const LAOXU_STATE_NAMES: Record<LaoXuState, string> = {
  idle: '待机', cheer: '加油', beat: '打拍子', clap: '鼓掌跳', help: '扶树', shake: '抱树摇',
  sit: '马扎', nap: '打盹', wake: '惊醒喷水', watch: '看热闹', coach: '带徒弟', retire: '躺椅',
};
export const LAOXU_LEVEL_NAMES = ['', '草帽老农', '毛巾老农', '花带草帽', '怀表老农', '金边墨镜', '金星徽章', '金边草帽', '金苹果老徐'];

const STRAW = '#efdca0';
const STRAW_D = '#cdb877';
const SHIRT = '#f6efdc';
const DENIM = '#a9bcc4';
const DENIM_D = 'rgba(70,92,104,0.30)';
const BOOT = '#8a5f35';
const AMBER = '#bd813c';
const GOLD = F.gold;

type Mouth = 'smile' | 'grin' | 'open' | 'o' | 'flat' | 'grit' | 'snore' | 'sip';
interface Rig {
  dy: number; dx: number; lean: number; tilt: number; hdy: number;
  hl: Pt; hr: Pt; frontL: boolean;
  sit: number; rec: number;
  brow: number; ang: number; mouth: Mouth; mw: number;
  glassDy: number; hatDy: number; hatRot: number; step: number; stepL: number;
}

const SL: Pt = [-10.4, -23.5];
const SR: Pt = [10.4, -23.5];

/** 两段式手臂(IK):肩→肘→手,肘朝外下弯。返回被夹紧后的手位置 */
function arm(g: C, seed: number, S: Pt, H0: Pt, side: 1 | -1, sleeve: string, L = 10.8): Pt {
  let dx = H0[0] - S[0], dy = H0[1] - S[1];
  let d = Math.hypot(dx, dy) || 1;
  const maxd = L * 2 - 0.6;
  if (d > maxd) { dx = (dx / d) * maxd; dy = (dy / d) * maxd; d = maxd; }
  const H: Pt = [S[0] + dx, S[1] + dy];
  const h = Math.sqrt(Math.max(0, L * L - (d / 2) ** 2));
  let nx = -dy / d, ny = dx / d;
  if (nx * side + ny * 0.7 < 0) { nx = -nx; ny = -ny; }
  const E: Pt = [S[0] + dx / 2 + nx * h, S[1] + dy / 2 + ny * h];
  const k = new Ink(g, seed, 2.2, 0.15);
  k.limb(S[0], S[1], E[0], E[1], 5.4, sleeve, 1.9);
  k.limb(E[0], E[1], H[0], H[1], 5, sleeve, 1.9);
  k.ell(H[0], H[1], 3.7, 3.6, { fill: F.skin, lw: 1.9, j: 0.1 });
  return H;
}

const rays = (g: C, x: number, y: number, r0: number, r1: number, n: number, a0: number, a1: number, seed: number): void => {
  const k = new Ink(g, seed, 1.6, 0.1);
  for (let i = 0; i < n; i++) {
    const a = lerp(a0, a1, n === 1 ? 0.5 : i / (n - 1));
    k.line(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, { lw: 1.7, ext: 0, bow: 0 });
  }
};

const zText = (g: C, ch: string, x: number, y: number, size: number, rot: number, alpha: number): void => {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.globalAlpha *= alpha;
  g.font = `bold ${size * 4}px sans-serif`;
  g.scale(0.25, 0.25);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = size * 1.1;
  g.strokeStyle = INK;
  g.strokeText(ch, 0, 0);
  g.fillStyle = F.white;
  g.fillText(ch, 0, 0);
  g.restore();
};

const note = (g: C, x: number, y: number, r: number, rot: number): void => {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = INK;
  g.strokeStyle = INK;
  g.lineWidth = r * 0.34;
  g.lineCap = 'round';
  g.beginPath();
  g.ellipse(0, 0, r * 0.62, r * 0.46, -0.4, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(r * 0.5, -0.1 * r);
  g.lineTo(r * 0.5, -r * 1.9);
  g.quadraticCurveTo(r * 1.5, -r * 1.5, r * 1.2, -r * 0.7);
  g.stroke();
  g.restore();
};

/* ───────────────────────── 道具(独立导出) ───────────────────────── */

/** 小马扎。o.open 0..1:0=折起的一捆,1=打开坐得下;(x,y)=底部中心。 */
export const drawStool: ThingFn = (ctx, x, y, s, o = {}) => {
  const open = clamp(Number(o.open ?? 1), 0, 1);
  const k = new Ink(ctx, (o.seed ?? 1) + 21, 2.1, 0.14);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  const w = lerp(3.6, 12.6, open);
  const top = -14 + (1 - open) * 0.0;
  const sp = lerp(1.2, 10.5, open);
  // X 形腿
  for (const sd of [-1, 1]) {
    k.limb(sd * w * 0.8, top + 1.2, -sd * sp, -0.8, 2.4, F.woodDark, 1.3);
  }
  k.ell(0, top / 2 - 0.4, 1.5, 1.5, { fill: F.gray3, lw: 1.2, j: 0.05 });
  // 座布(帆布 + 缝线)
  k.rect(-w - 0.5, top - 2.4, (w + 0.5) * 2, 3.7, { fill: '#c9d1c8', shade: 'rgba(80,100,95,0.22)', lw: 1.9, r: 1.4, j: 0.12 });
  if (open > 0.6) for (let i = -2; i <= 2; i++) k.line(i * 4.6 - 1, top - 0.6, i * 4.6 + 1, top - 0.6, { lw: 0.7, ext: 0, bow: 0 });
  ctx.restore();
};

/** 小板凳(带徒弟用):四条腿的小木凳。 */
export const drawBench: ThingFn = (ctx, x, y, s, o = {}) => {
  const k = new Ink(ctx, (o.seed ?? 1) + 31, 2.1, 0.14);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  k.limb(-7, -9, -8.6, -0.8, 2.6, F.warm, 1.2);
  k.limb(7, -9, 8.6, -0.8, 2.6, F.warm, 1.2);
  k.limb(-11, -9.6, -13.4, -0.6, 3.1, F.wood, 1.5);
  k.limb(11, -9.6, 13.4, -0.6, 3.1, F.wood, 1.5);
  k.line(-12.2, -4.4, 12.2, -4.4, { lw: 1.6, ext: 0, bow: 0.3 });
  k.rect(-15.5, -13.2, 31, 4.4, { fill: F.wood, shade: F.shade2, lw: 2, r: 1.4, j: 0.15 });
  k.line(-11, -11, -4, -11.2, { lw: 0.8, ext: 0, bow: 0 });
  k.line(3, -10.6, 12, -10.8, { lw: 0.8, ext: 0, bow: 0 });
  ctx.restore();
};

/** 快乐水瓶。(x,y)=瓶底中心;o.grip=true 时 (x,y)=瓶身中部(手握点);o.tilt 弧度(绕握点/瓶底);o.fizz 0..1 冒泡;瓶身手写"快乐水" + 一点红。 */
export const drawBottle: ThingFn = (ctx, x, y, s, o = {}) => {
  const k = new Ink(ctx, (o.seed ?? 1) + 41, 1.9, 0.1);
  const t = o.t ?? 0;
  const tilt = Number(o.tilt ?? 0);
  const fizz = clamp(Number(o.fizz ?? 0), 0, 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.rotate(tilt);
  if (o.grip) ctx.translate(0, 9);
  // 玻璃瓶身
  const body: Pt[] = [[-4.4, 0], [4.4, 0], [4.8, -11.5], [2.8, -15], [2.1, -19.5], [-2.1, -19.5], [-2.8, -15], [-4.8, -11.5]];
  k.poly(body, { fill: '#e8f1ef', smooth: true, lw: 1.9, j: 0.1 });
  // 汽水(琥珀色),液面在颈下
  k.poly([[-4, -0.5], [4, -0.5], [4.4, -11.6], [-4.4, -11.6]], { fill: AMBER, smooth: true, nostroke: true, j: 0 });
  k.line(-4.4, -11.6, 4.4, -11.6, { lw: 0.8, ext: 0, bow: 0 });
  // 标签 + 手写字 + 一点红
  k.rect(-4.7, -9.6, 9.4, 6.6, { fill: F.cream, lw: 1.1, j: 0.05 });
  ctx.save();
  ctx.translate(0, -6.1);
  ctx.scale(0.25, 0.25);
  ctx.font = 'bold 10.4px "Kaiti SC","STKaiti","Comic Sans MS",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.fillText('快乐水', 0, 0);
  ctx.restore();
  k.dot(3.3, -8.5, 0.85, '#d8232a');
  // 瓶盖 + 高光
  k.rect(-2.6, -21.4, 5.2, 2.3, { fill: F.gray3, lw: 1.4, r: 0.8, j: 0.05 });
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-3.2, -2);
  ctx.lineTo(-3.4, -10);
  ctx.stroke();
  if (fizz > 0) {
    for (let i = 0; i < 4; i++) {
      const u = (t * 1.6 + i * 0.27) % 1;
      ctx.globalAlpha *= 1;
      ctx.beginPath();
      ctx.arc(Math.sin(i * 2.3 + t * 3) * 1.5, -23 - u * 7 * fizz, 0.9 + (1 - u) * 0.6, 0, TAU);
      ctx.fillStyle = F.white;
      ctx.fill();
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
  }
  ctx.restore();
};

/** 茶杯(带热气)。(x,y)=杯底中心。 */
export const drawTeaCup: ThingFn = (ctx, x, y, s, o = {}) => {
  const k = new Ink(ctx, (o.seed ?? 1) + 51, 1.9, 0.08);
  const t = o.t ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  k.ell(0, -0.6, 6.2, 1.5, { fill: F.gray, lw: 1.5, j: 0.05 });
  k.ell(5.6, -4.4, 2.5, 2.6, { lw: 1.5, a0: -1.7, a1: 1.7, j: 0.05 });
  k.poly([[-5, -8.4], [5, -8.4], [4, -1.2], [-4, -1.2]], { fill: F.white, shade: F.shade, smooth: true, lw: 1.9, j: 0.08 });
  k.ell(0, -8.4, 5, 1.1, { fill: '#c3a064', lw: 1.2, j: 0.04 });
  k.line(-2.4, -6, -2.6, -3, { lw: 0.8, ext: 0, bow: 0 });
  if (o.steam !== false) {
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const u = (t * 0.55 + i / 3) % 1;
      ctx.globalAlpha *= 1;
      ctx.save();
      ctx.globalAlpha *= (1 - u) * 0.85;
      ctx.beginPath();
      const bx = -2.4 + i * 2.4;
      ctx.moveTo(bx, -9.6 - u * 3);
      ctx.bezierCurveTo(bx + 2.4, -12 - u * 5, bx - 2.4, -14 - u * 6, bx + 0.6, -17 - u * 6);
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
};

/** 收音机(老式,带天线和音符)。o.on 默认 true。(x,y)=底部中心。 */
export const drawRadio: ThingFn = (ctx, x, y, s, o = {}) => {
  const k = new Ink(ctx, (o.seed ?? 1) + 61, 2, 0.1);
  const t = o.t ?? 0;
  const on = o.on !== false;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  const bump = on ? Math.max(0, Math.sin(t * 9)) * 0.5 : 0;
  ctx.translate(0, -bump);
  k.line(6, -14, 13, -25, { lw: 1.3, ext: 0 });
  k.dot(13, -25.4, 1, INK);
  k.rect(-10.5, -14.5, 21, 14.5, { fill: F.warm, shade: F.shade, lw: 2.1, r: 2.4, j: 0.15 });
  k.rect(-8.2, -12.2, 10.6, 10, { fill: F.gray, lw: 1.3, r: 1.2, j: 0.08 });
  for (let i = 0; i < 4; i++) k.line(-6.6 + i * 2.6, -10.4, -6.6 + i * 2.6, -4, { lw: 0.8, ext: 0, bow: 0 });
  k.ell(6.2, -6.4, 2.9, 2.9, { fill: F.white, lw: 1.5, j: 0.05 });
  k.line(6.2, -6.4, 7.6 + Math.sin(t * 0.7) * 0.4, -8.2, { lw: 1, ext: 0, bow: 0 });
  k.rect(3.4, -12.2, 6.2, 2.2, { fill: F.cream, lw: 1, j: 0.04 });
  ctx.translate(0, bump);
  if (on) {
    for (let i = 0; i < 3; i++) {
      const u = (t * 0.5 + i / 3) % 1;
      ctx.save();
      ctx.globalAlpha *= Math.sin(u * Math.PI);
      note(ctx, -5 + Math.sin(u * 6 + i * 2) * 4 + u * 4, -20 - u * 22, 2.2, Math.sin(u * 5 + i) * 0.3);
      ctx.restore();
    }
  }
  ctx.restore();
};

/** 躺椅(侧视,帆布 + 木架)。o.layer: 'back' | 'front' | 不给=全部。(x,y)=底部中心,约 70 宽 × 44 高。 */
export const drawRecliner: ThingFn = (ctx, x, y, s, o = {}) => {
  const layer = o.layer as string | undefined;
  const k = new Ink(ctx, (o.seed ?? 1) + 71, 2.1, 0.14);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (!layer || layer === 'back') {
    // 后腿 + 扶手架
    k.limb(-14, -12, -26, -0.6, 3, F.woodDark, 1.4);
    k.limb(-2, -14, 6, -0.6, 3, F.woodDark, 1.4);
    k.limb(22, -15, 31, -0.6, 3, F.woodDark, 1.4);
    // 帆布吊面:靠背→座→脚托
    const path: Pt[] = [[-38, -41], [-26, -28], [-12, -14.5], [4, -13.6], [20, -15.6], [33, -21]];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    path.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.lineWidth = 10.8;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.lineWidth = 8.6;
    ctx.strokeStyle = '#d2dbd2';
    ctx.stroke();
    ctx.save();
    ctx.setLineDash([2.6, 2.6]);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(80,100,95,0.45)';
    ctx.translate(0.4, 0);
    ctx.beginPath();
    path.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
    ctx.restore();
    // 靠背顶横杆
    k.limb(-40.2, -43.2, -35.6, -38.2, 3.1, F.wood, 1.5);
  }
  if (!layer || layer === 'front') {
    k.limb(-8, -12.4, -17, -0.8, 3.1, F.wood, 1.5);
    k.limb(14, -14, 20.5, -0.8, 3.1, F.wood, 1.5);
    k.ell(-12.6, -6.8, 1.2, 1.2, { fill: F.gray3, lw: 1.1, j: 0.04 });
    k.line(-25, -3.4, 24, -3.4, { lw: 1.1, ext: 0, bow: 0.6 });
    // 扶手
    k.limb(-14, -23.4, 8, -22.6, 3.4, F.wood, 1.5);
  }
  ctx.restore();
};

/** 小徒弟(≈30 高):头巾小子,抱树/摇树。o.pose: 'shake' | 'idle' | 'cheer'。(x,y)=脚底中心,朝右抱树。 */
export const drawApprentice: ThingFn = (ctx, x, y, s, o = {}) => {
  const t = o.t ?? 0;
  const pose = (o.pose as string | undefined) ?? 'shake';
  const seed = (o.seed ?? 1) + 81;
  const ph = Math.sin(t * 11);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * ((o.dir ?? 1) < 0 ? -1 : 1), s);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  const k = new Ink(ctx, seed, 2, 0.14);
  k.shadow(0, 0.3, 8, 1.6, 0.18);
  const jx = pose === 'shake' ? ph * 0.9 : 0;
  const jy = pose === 'cheer' ? -Math.abs(Math.sin(t * 6)) * 3 : pose === 'shake' ? -Math.abs(ph) * 0.5 : Math.sin(t * 2) * 0.2;
  ctx.translate(jx, jy);
  // 腿
  for (const sd of [-1, 1]) {
    k.limb(sd * 2.5, -6, sd * 2.8, -1, 3, '#8d8a7c', 1.4);
    k.ell(sd * 3.2, -0.8, 2.6, 1.4, { fill: BOOT, lw: 1.2, j: 0.05 });
  }
  // 身体
  const lean = pose === 'shake' ? 0.16 : 0;
  ctx.save();
  ctx.translate(0, -6);
  ctx.rotate(lean);
  ctx.translate(0, 6);
  const hands: [Pt, Pt] = pose === 'shake' ? [[9, -15.5], [10.4, -10]] : pose === 'cheer' ? [[-8, -23], [8, -23]] : [[-6.4, -6], [6.4, -6]];
  arm(ctx, seed + 1, [-4.4, -13.4], hands[0], -1, '#aeb8b8', 7.4);
  k.poly([[-5, -15], [5, -15], [6, -5.4], [-6, -5.4]], { fill: '#c7cfc8', shade: F.shade, smooth: true, lw: 1.8, j: 0.12 });
  k.rect(-4, -9, 4, 3.1, { fill: F.warm, lw: 1, j: 0.04 });
  // 头(大)
  const hy = -23.6;
  k.ell(0, hy, 8.4, 7.8, { fill: F.skin, shade: F.shade, lw: 2, j: 0.12 });
  // 头巾(白布条 + 结)
  k.poly([[-8.2, hy - 3], [8.2, hy - 3], [8, hy - 5.4], [-8, hy - 5.4]], { fill: F.white, lw: 1.5, j: 0.05, smooth: true });
  k.poly([[7.6, hy - 4.2], [11.6, hy - 6.4], [10.4, hy - 2.8]], { fill: F.white, lw: 1.2, j: 0.05 });
  k.stroke([[-2, hy - 7.8], [0, hy - 11], [2.4, hy - 8]], { lw: 1.4, smooth: true });
  // 脸:大圆眼 + 汗
  const eo = pose === 'shake' ? 'squint' : 'dot';
  if (eo === 'dot') {
    k.dot(-3, hy + 0.8, 1.15);
    k.dot(3, hy + 0.8, 1.15);
  } else {
    k.line(-4.3, hy + 0.8, -1.8, hy + 0.8, { lw: 1.3, ext: 0, bow: 0 });
    k.line(1.8, hy + 0.8, 4.3, hy + 0.8, { lw: 1.3, ext: 0, bow: 0 });
  }
  k.ell(-5.4, hy + 3.2, 1.6, 1, { fill: '#f1ccb0', nostroke: true, j: 0 });
  k.ell(5.4, hy + 3.2, 1.6, 1, { fill: '#f1ccb0', nostroke: true, j: 0 });
  if (pose === 'shake') k.ell(0, hy + 4.4, 1.5, 1.6, { fill: F.gray3, lw: 1, j: 0.03 });
  else k.stroke([[-1.8, hy + 4], [0, hy + 5.2], [1.8, hy + 4]], { lw: 1.2, smooth: true });
  // 另一手
  arm(ctx, seed + 2, [4.4, -13.4], pose === 'shake' ? [10.6, -19.5] : pose === 'cheer' ? [9, -26] : [6, -6], 1, '#c7cfc8', 7.4);
  ctx.restore();
  if (pose === 'shake') {
    const u = (t * 2.3) % 1;
    ctx.save();
    ctx.globalAlpha *= 1 - u;
    k.ell(-9 - u * 2, hy - 3 + u * 9, 1.1, 1.7, { fill: F.water, lw: 1, j: 0.03 });
    ctx.restore();
  }
  ctx.restore();
};

function trunk(g: C, x: number, w: number, seed: number, wob: number, h = 80): void {
  const k = new Ink(g, seed, 2.2, 0.2);
  g.save();
  g.translate(x, 0);
  g.rotate(wob);
  k.poly([[-w * 0.5 - 2.5, 0], [-w * 0.5, -h * 0.15], [-w * 0.42, -h], [w * 0.42, -h], [w * 0.5, -h * 0.15], [w * 0.5 + 2.5, 0]], { fill: '#d9b27a', shade: 'rgba(110,70,30,0.28)', lw: 2.2, j: 0.3 });
  for (let i = 0; i < 4; i++) k.line(-w * 0.25 + (i % 2) * w * 0.3, -8 - i * 17, -w * 0.25 + (i % 2) * w * 0.3 + 1, -17 - i * 17, { lw: 1, ext: 0, bow: 0.4 });
  g.restore();
}

/* ───────────────────────── 头部 ───────────────────────── */
function head(g: C, seed: number, r: Rig, lv: number, t: number): void {
  const k = new Ink(g, seed + 100, 2.3, 0.2);
  const k2 = new Ink(g, seed + 101, 1.8, 0.1);
  // 耳 + 头
  k2.ell(-16.3, 2.4, 2.6, 3.2, { fill: F.skin, lw: 1.6, j: 0.05 });
  k2.ell(16.3, 2.4, 2.6, 3.2, { fill: F.skin, lw: 1.6, j: 0.05 });
  k.ell(0, 0, 16.6, 15, { fill: F.skin, shade: F.shade, lw: 2.5, j: 0.25 });
  k2.ell(-11.6, 8.2, 3.2, 2.1, { fill: '#f3cdb2', nostroke: true, j: 0 });
  k2.ell(11.6, 8.2, 3.2, 2.1, { fill: '#f3cdb2', nostroke: true, j: 0 });
  // 帽檐在额头的阴影
  g.fillStyle = 'rgba(110,88,52,0.2)';
  g.beginPath();
  g.ellipse(0, -7.4 + r.hatDy * 0.6, 16, 3.2, 0, 0, TAU);
  g.fill();
  // 白胡子(长,尖下巴)
  const beard: Pt[] = [[-16.2, 2], [-15.8, 9.5], [-12.6, 16.2], [-6.4, 20.6], [0, 23.4], [6.4, 20.6], [12.6, 16.2], [15.8, 9.5], [16.2, 2], [11, 8.8], [0, 6.6], [-11, 8.8]];
  k.poly(beard, { fill: F.white, shade: F.shade2, smooth: true, lw: 2.4, j: 0.25 });
  for (const [bx, by, ex, ey] of [[-8.6, 15.4, -7.2, 20], [-2.6, 18, -2, 22.3], [3.6, 18.2, 3.4, 22.2], [9.2, 15.2, 7.8, 19.6]]) k2.stroke([[bx, by], [(bx + ex) / 2 + 0.7, (by + ey) / 2], [ex, ey]], { lw: 0.9, smooth: true });
  // 嘴(在胡子里,靠嘴形表达)
  const my = 14 + (r.mouth === 'sip' ? -0.6 : 0);
  const dark = '#4a3228';
  switch (r.mouth) {
    case 'smile': k2.stroke([[-4.6, my - 1.6], [-1.6, my + 0.8], [1.6, my + 0.8], [4.6, my - 1.6]], { lw: 1.9, smooth: true }); break;
    case 'grin':
      k2.poly([[-6, my - 2.4], [6, my - 2.4], [4.4, my + 3], [0, my + 4.4], [-4.4, my + 3]], { fill: dark, smooth: true, lw: 1.9, j: 0.06 });
      k2.ell(0, my + 3.2, 2.7, 1.3, { fill: '#c9a08e', nostroke: true, j: 0 });
      break;
    case 'open': {
      const h = 3.8 + r.mw * 2.6;
      k2.poly([[-6.8, my - 2.8], [6.8, my - 2.8], [5.8, my + h * 0.5], [0, my + h], [-5.8, my + h * 0.5]], { fill: dark, smooth: true, lw: 1.9, j: 0.06 });
      k2.ell(0, my + h - 1.4, 3.2, 1.5, { fill: '#c9a08e', nostroke: true, j: 0 });
      break;
    }
    case 'o': k2.ell(0, my + 0.6, 2.7, 3.1 + r.mw * 0.8, { fill: dark, lw: 1.7, j: 0.05 }); break;
    case 'sip': k2.ell(1, my + 0.2, 2, 2.2, { fill: dark, lw: 1.5, j: 0.04 }); break;
    case 'snore': k2.ell(0, my + 0.4, 2.2 + r.mw * 1.1, 2 + r.mw * 1.5, { fill: dark, lw: 1.6, j: 0.04 }); break;
    case 'grit':
      k2.rect(-5.8, my - 1.8, 11.6, 4.6, { fill: F.white, lw: 1.8, r: 1.4, j: 0.05 });
      for (const lx of [-2.9, 0, 2.9]) k2.line(lx, my - 1.6, lx, my + 2.6, { lw: 0.8, ext: 0, bow: 0 });
      k2.line(-5.6, my + 0.5, 5.6, my + 0.5, { lw: 0.8, ext: 0, bow: 0 });
      break;
    default: k2.line(-3.4, my, 3.4, my + 0.3, { lw: 1.8, ext: 0, bow: 0 });
  }
  // 八字胡(盖住嘴上沿)
  k.poly([[0, 7.2], [4.2, 6.4], [9.4, 7.6], [12.4, 10.4], [9.4, 11.6], [4.4, 10.4], [0, 10.7], [-4.4, 10.4], [-9.4, 11.6], [-12.4, 10.4], [-9.4, 7.6], [-4.2, 6.4]], { fill: F.white, shade: F.shade, smooth: true, lw: 2.1, j: 0.14 });
  // 鼻
  k2.ell(0, 5.2, 3.4, 2.8, { fill: '#f1c8a8', lw: 1.6, j: 0.05 });
  // 墨镜
  const gy = 1.2 + r.glassDy;
  const gold = lv >= 5;
  for (const sd of [-1, 1]) {
    const L: Pt[] = [[-13.6, -3.1], [-1.9, -3.1], [-1.4, 1.2], [-3.2, 5.4], [-9.4, 5.8], [-12.9, 3.2]].map(([px, py]) => [px * sd, py + gy] as Pt);
    k.poly(L, { fill: INK, smooth: true, lw: 2, j: 0.06 });
    if (gold) k.poly(L.map(([px, py]) => [px * 0.92 - sd * 0.5, (py - gy) * 0.9 + gy + 0.1] as Pt), { smooth: true, lw: 0.9, j: 0.02, nostroke: false, fill: undefined });
    // 反光白线
    g.strokeStyle = 'rgba(255,253,246,0.92)';
    g.lineCap = 'round';
    g.lineWidth = 1.25;
    g.beginPath();
    g.moveTo(sd * -11.6 + 0, gy + 3.1);
    g.lineTo(sd * -8.4, gy - 1.3);
    g.stroke();
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(sd * -7.4, gy + 3.5);
    g.lineTo(sd * -6.2, gy + 1.8);
    g.stroke();
  }
  k.line(-2.2, gy - 1.6, 2.2, gy - 1.6, { lw: 2, ext: 0, bow: 0 });
  k2.line(-13.6, gy - 1.6, -16.4, gy - 1, { lw: 1.7, ext: 0, bow: 0 });
  k2.line(13.6, gy - 1.6, 16.4, gy - 1, { lw: 1.7, ext: 0, bow: 0 });
  // 镜片偶尔闪一下
  const tw = Math.max(0, Math.sin(t * 1.3)) ** 14;
  if (tw > 0.05) sparkle(g, 11.2, gy - 2.6, 2.6 * tw + 0.4, F.white, t * 0.8, false);
  // 眉毛(墨镜上方):brow>0 抬,ang>0 内端下压(用力/生气),<0 内端上扬(担心)
  const by = -5.4 - r.brow * 1.3;
  for (const sd of [-1, 1]) {
    const xi = sd * 3.4, xo = sd * 12.6;
    const yi = by + r.ang * 1.8, yo = by - r.ang * 1.8 + (r.brow > 0.5 ? 0.6 : 0);
    k2.limb(xi, yi, sd * 8, (yi + yo) / 2 - 0.7, 3, F.white, 1.5);
    k2.limb(sd * 8, (yi + yo) / 2 - 0.7, xo, yo, 2.8, F.white, 1.5);
  }
  // ── 草帽
  g.save();
  g.translate(0, r.hatDy);
  g.rotate(r.hatRot);
  const bcy = -13.6;
  k.ell(0, bcy, 26.4, 5.8, { fill: STRAW, shade: STRAW_D, lw: 2.4, j: 0.3 });
  for (let i = -6; i <= 6; i++) k2.line(i * 2.2, bcy + 2.1, i * 4, bcy + 4.9 - Math.abs(i) * 0.14, { lw: 0.8, ext: 0, bow: 0 });
  if (lv >= 7) k2.ell(0, bcy + 0.2, 24.6, 4.7, { lw: 1.2, a0: 0.12, a1: Math.PI - 0.12, j: 0.05 });
  const crown: Pt[] = [[-13.8, bcy + 0.4], [-13.4, bcy - 7], [-9.4, bcy - 12.4], [0, bcy - 14.3], [9.4, bcy - 12.4], [13.4, bcy - 7], [13.8, bcy + 0.4]];
  k.poly(crown, { fill: STRAW, shade: STRAW_D, smooth: true, lw: 2.4, j: 0.25 });
  for (let i = 0; i < 4; i++) k2.stroke([[-9 + i * 6, bcy - 12.6 + Math.abs(i - 1.5) * 1.2], [-9.6 + i * 6.4, bcy - 5.6], [-9 + i * 6.2, bcy - 1]], { lw: 0.75, smooth: true });
  // 帽带
  const bandCol = lv >= 7 ? GOLD : lv >= 3 ? F.leaf : F.gray2;
  k.poly([[-13.7, bcy - 1.2], [13.7, bcy - 1.2], [13.5, bcy - 5.2], [-13.5, bcy - 5.2]], { fill: bandCol, lw: 1.8, j: 0.1, smooth: false });
  if (lv >= 3 && lv < 8) {
    // 叶 + 小花
    k2.poly([[7, bcy - 4], [11.6, bcy - 9.6], [12.6, bcy - 4.6]], { fill: F.leaf, smooth: true, lw: 1.3, j: 0.04 });
    k2.poly([[6, bcy - 4], [3.6, bcy - 9.8], [9, bcy - 5.2]], { fill: '#b3d676', smooth: true, lw: 1.3, j: 0.04 });
    for (let i = 0; i < 5; i++) {
      const a = (i * TAU) / 5;
      k2.ell(7.4 + Math.cos(a) * 2, bcy - 3 + Math.sin(a) * 2, 1.4, 1.4, { fill: F.white, lw: 0.9, j: 0.02 });
    }
    k2.ell(7.4, bcy - 3, 1.1, 1.1, { fill: GOLD, lw: 0.8, j: 0.02 });
  }
  if (lv >= 8) {
    g.save();
    drawApple(g, 7.8, bcy - 6.2, 4.6, { gold: true, leaf: true });
    g.restore();
  }
  g.restore();
}

/* ───────────────────────── 主体 ───────────────────────── */
function baseRig(t: number): Rig {
  const sw = Math.sin(t * 2.1);
  return {
    dy: 0, dx: 0, lean: sw * 0.01, tilt: Math.sin(t * 0.9) * 0.02, hdy: sw * 0.35,
    hl: [-14.4, -8.5 + sw * 0.6], hr: [14.4, -8.5 - sw * 0.6], frontL: false,
    sit: 0, rec: 0, brow: 0.15, ang: 0, mouth: 'smile', mw: 0,
    glassDy: 0, hatDy: 0, hatRot: Math.sin(t * 1.2) * 0.01, step: 0, stepL: 0,
  };
}

export const drawLaoXu: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1;
  const t = o.t ?? 0;
  const lv = clamp(Math.round(Number(o.lv ?? 1)), 1, 8);
  const state = ((o.state as LaoXuState | undefined) ?? 'idle');
  const pIn = typeof o.p === 'number' ? clamp(o.p, 0, 1) : undefined;
  const r = baseRig(t);
  const back: Array<() => void> = [];
  const seatF: Array<() => void> = [];
  const front: Array<() => void> = [];
  const over: Array<() => void> = [];
  const handFront: Array<(h: Pt) => void> = []; // 右手持物:拿到被夹紧后的手位置
  let ox = 0; // 整体横移(coach)
  let showTrunk: { x: number; w: number; wob: number } | null = null;
  const wantTree = o.tree !== false;
  const sitting = state === 'sit' || state === 'nap' || state === 'wake' || state === 'coach';
  // 掏马扎过渡:p<1 时有效(sit/nap/coach)
  const tr = pIn !== undefined && pIn < 1 && (state === 'sit' || state === 'nap' || state === 'coach') ? pIn : undefined;
  let stool = { x: 0, open: 1, on: sitting, held: false };
  if (tr !== undefined) {
    const a = clamp(tr / 0.3, 0, 1), b = clamp((tr - 0.3) / 0.3, 0, 1), c = clamp((tr - 0.6) / 0.4, 0, 1);
    r.sit = ease(c);
    r.lean = 0.18 * Math.sin(a * Math.PI) * (1 - c) + Math.sin(t * 2.1) * 0.01;
    r.mouth = 'o';
    r.brow = 0.4;
    if (tr < 0.3) {
      r.hr = [lerp(15.5, -14, ease(a)), lerp(-10.5, -10, a)]; // 手伸到背后摸
      stool = { x: 0, open: 0, on: false, held: false };
    } else if (tr < 0.45) {
      r.hr = [lerp(-14, 17, ease(b * 2)), lerp(-10, -16, b)];
      stool = { x: 0, open: 0, on: false, held: true };
      r.mouth = 'smile';
    } else {
      stool = { x: lerp(20, 0, ease(c)), open: clamp((tr - 0.45) / 0.15, 0, 1), on: true, held: false };
      r.hr = [lerp(17, 15.5, c), lerp(-12, -10.5, c)];
      r.mouth = 'smile';
    }
    r.hl = [-15.5, -10.5];
    if (stool.held) {
      const sx = r.hr[0], sy = r.hr[1];
      front.push(() => drawStool(ctx, sx + 2, sy + 12, 1, { open: 0, seed, rot: 0 }));
    }
  } else if (state === 'cheer') {
    const j = Math.abs(Math.sin(t * 6));
    r.dy = -j * 5.4;
    r.hl = [-17, -48 + Math.sin(t * 12) * 2.2];
    r.hr = [17, -48 - Math.sin(t * 12) * 2.2];
    r.mouth = 'open';
    r.mw = Math.abs(Math.sin(t * 6)) * 0.6;
    r.brow = 1;
    r.ang = -0.2;
    r.tilt = Math.sin(t * 6) * 0.05;
    r.lean = Math.sin(t * 3) * 0.03;
    r.hdy = -j * 0.5;
    over.push(() => {
      const u = Math.abs(Math.sin(t * 6));
      rays(ctx, -1, -33 + r.dy, 24 + u * 2, 30 + u * 3, 3, -2.7, -2.1, seed + 5);
      rays(ctx, 1, -33 + r.dy, 24 + u * 2, 30 + u * 3, 3, -1.0, -0.4, seed + 6);
    });
  } else if (state === 'beat') {
    const bt = t * 8;
    const dn = Math.sin(bt);
    r.hr = [17, -33 + dn * 7.5];
    r.hl = [-13, -13];
    r.step = Math.max(0, Math.sin(bt - 0.4)) * 2;
    r.hdy = Math.abs(dn) * 0.9;
    r.tilt = Math.sin(t * 4) * 0.05;
    r.lean = Math.sin(t * 4) * 0.02;
    r.mouth = 'o';
    r.mw = Math.abs(Math.sin(t * 4)) * 0.6;
    r.brow = 0.55;
    over.push(() => {
      for (let i = 0; i < 3; i++) {
        const u = (t * 0.7 + i / 3) % 1;
        ctx.save();
        ctx.globalAlpha *= Math.sin(u * Math.PI);
        note(ctx, 26 + Math.sin(u * 6 + i * 2) * 5, -36 - u * 28, 2.6, Math.sin(u * 5 + i) * 0.3);
        ctx.restore();
      }
    });
  } else if (state === 'clap') {
    const c = (Math.sin(t * 11) + 1) / 2;
    const j = Math.abs(Math.sin(t * 5.5));
    r.dy = -j * 4;
    r.hl = [-2 - c * 9, -23 - c * 2];
    r.hr = [2 + c * 9, -23 - c * 2];
    r.frontL = true;
    r.mouth = 'grin';
    r.brow = 0.8;
    r.tilt = Math.sin(t * 5.5) * 0.04;
    over.push(() => {
      if (c < 0.12) rays(ctx, 0, -29 + r.dy, 5, 10, 5, -2.5, -0.65, seed + 7);
    });
  } else if (state === 'help') {
    const pu = Math.sin(t * 3);
    r.lean = 0.12 + pu * 0.012;
    r.dx = pu * 0.5;
    r.hl = [20, -41];
    r.hr = [21, -29];
    r.frontL = true;
    r.mouth = 'grit';
    r.brow = 0.1;
    r.ang = 0.9;
    r.step = 1.5;
    showTrunk = { x: 29, w: 13, wob: Math.sin(t * 3) * 0.004 };
    over.push(() => {
      const u = (t * 1.6) % 1;
      ctx.save();
      ctx.globalAlpha *= 1 - u;
      new Ink(ctx, seed + 9, 1.6, 0.05).ell(-17, -50 + u * 10, 1.4, 2.2, { fill: F.water, lw: 1.2, j: 0.03 });
      ctx.restore();
    });
  } else if (state === 'shake') {
    const ph = Math.sin(t * 11);
    r.lean = 0.1 + ph * 0.025;
    r.dx = ph * 1.1;
    r.hl = [22, -31];
    r.hr = [26, -24];
    r.frontL = true;
    r.mouth = 'grit';
    r.ang = 0.7;
    r.brow = 0.2;
    r.hdy = Math.abs(ph) * 0.6;
    r.tilt = ph * 0.05;
    showTrunk = { x: 30, w: 13, wob: ph * 0.008 };
    over.push(() => {
      for (let i = 0; i < 3; i++) {
        const u = (t * 0.8 + i / 3) % 1;
        const lx = 20 + i * 9 + Math.sin(u * 8 + i) * 4;
        ctx.save();
        ctx.translate(lx, -70 + u * 66);
        ctx.rotate(u * 7 + i);
        ctx.globalAlpha *= Math.min(1, (1 - u) * 3);
        new Ink(ctx, seed + 10 + i, 1.3, 0.02).poly([[0, -2.6], [2, 0], [0, 2.6], [-2, 0]], { fill: F.leaf, lw: 1.1, j: 0.02 });
        ctx.restore();
      }
    });
  } else if (state === 'sit') {
    r.sit = 1;
    const item = (o.item as string | undefined) ?? 'bottle';
    r.hl = [-15, -10];
    if (item === 'paper') {
      const flip = Math.sin(t * 0.8) > 0.93 ? 1 : 0;
      r.hl = [-12.5, -22 + flip * 3];
      r.hr = [12.5, -22 + flip * 3];
      r.frontL = true;
      r.brow = 0.3 + Math.max(0, Math.sin(t * 1.7)) * 0.5;
      r.mouth = 'smile';
      const py = flip * 3;
      handFront.push(() => {
        const k = new Ink(ctx, seed + 12, 1.9, 0.14);
        k.rect(-15.5, -37 + py, 31, 25, { fill: '#efe6cf', shade: F.shade, lw: 2, j: 0.15 });
        k.line(0, -36.5 + py, 0, -12.6 + py, { lw: 1.1, ext: 0, bow: 0.3 });
        k.rect(-13, -34.5 + py, 11, 5, { fill: F.gray2, lw: 1, j: 0.04 });
        for (let i = 0; i < 5; i++) {
          k.line(-13 + (i % 2) * 0.5, -27 + py + i * 2.8, -2.5, -27 + py + i * 2.8, { lw: 0.75, ext: 0, bow: 0 });
          k.line(2.6, -33 + py + i * 2.8, 13 - (i % 3), -33 + py + i * 2.8, { lw: 0.75, ext: 0, bow: 0 });
        }
        k.rect(3, -22 + py, 10, 8, { fill: F.gray, lw: 1, j: 0.04 });
      });
    } else {
      const c = (t / 5) % 1;
      const lift = c < 0.45 ? 0 : c < 0.6 ? ease((c - 0.45) / 0.15) : c < 0.8 ? 1 : 1 - ease((c - 0.8) / 0.2);
      r.hr = [lerp(14, 8, lift), lerp(-9, -24, lift)];
      r.mouth = lift > 0.85 ? 'sip' : c > 0.82 && c < 0.92 ? 'open' : 'smile';
      r.mw = 0.3;
      r.brow = 0.2 + lift * 0.4;
      r.tilt = -lift * 0.05;
      handFront.push((h) => drawBottle(ctx, h[0] + 2, h[1], 1, { grip: true, tilt: lerp(0.0, 0.85, lift), seed, t, fizz: lift < 0.1 ? 0.3 : 0 }));
    }
  } else if (state === 'nap') {
    r.sit = 1;
    const br = Math.sin(t * 1.4);
    r.hdy = 3.4 + br * 0.4;
    r.tilt = 0.14 + br * 0.01;
    r.hatDy = 4;
    r.hatRot = 0.06;
    r.hl = [-6, -13.5 + br * 0.4];
    r.hr = [6, -13.5 + br * 0.4];
    r.frontL = true;
    r.mouth = 'snore';
    r.mw = (br + 1) / 2;
    r.brow = -0.6;
    r.ang = -0.5;
    over.push(() => {
      for (let i = 0; i < 3; i++) {
        const u = (t * 0.33 + i / 3) % 1;
        zText(ctx, 'Z', 18 + u * 9 + i * 1.2, -50 - u * 22, 5.6 + u * 3.6, 0.2 + u * 0.3, Math.sin(Math.min(1, u * 1.4) * Math.PI));
      }
      // 鼻涕泡泡
      const bs = 1.2 + (br + 1) * 1.4;
      ctx.save();
      ctx.globalAlpha *= 0.85;
      new Ink(ctx, seed + 14, 1.2, 0.03).ell(6.4, -32 + 4.4, bs, bs, { fill: 'rgba(255,255,255,0.7)', lw: 1.1, j: 0.03 });
      ctx.restore();
    });
  } else if (state === 'wake') {
    r.sit = 1;
    const pp = pIn ?? (t / 3.4) % 1;
    const asleep = pp < 0.3;
    const jolt = pp >= 0.3 && pp < 0.45 ? (pp - 0.3) / 0.15 : pp >= 0.45 ? 1 : 0;
    const settle = pp >= 0.45 ? ease(clamp((pp - 0.45) / 0.55, 0, 1)) : 0;
    const br = Math.sin(t * 1.4);
    if (asleep) {
      r.hdy = 3.4 + br * 0.4; r.tilt = 0.14; r.hatDy = 4; r.hatRot = 0.06;
      r.hl = [-6, -13.5]; r.hr = [6, -13.5]; r.frontL = true; r.mouth = 'snore'; r.mw = (br + 1) / 2; r.brow = -0.6;
    } else {
      const jj = Math.sin(clamp(jolt, 0, 1) * Math.PI * 0.5);
      r.dy = -7 * jj * (1 - settle * 0.85);
      r.hdy = lerp(3.4, -0.8, jj);
      r.tilt = lerp(0.14, -0.06, jj);
      r.hatDy = lerp(4, -3, jj) * (1 - settle * 0.6);
      r.hatRot = lerp(0.06, -0.18, jj) * (1 - settle);
      r.glassDy = -3.8 * jj * (1 - settle * 0.7);
      r.brow = 1.5;
      r.ang = -0.5;
      r.mouth = 'open';
      r.mw = 1;
      r.hl = [-18, -40 - Math.sin(t * 20) * 1.2 * (1 - settle)];
      r.hr = [14, -20];
      r.frontL = true;
      r.stepL = 1;
    }
    // 喷出快乐水
    if (!asleep) {
      const sp = clamp((pp - 0.34) / 0.5, 0, 1);
      over.push(() => {
        const k = new Ink(ctx, seed + 15, 1.2, 0.02);
        for (let i = 0; i < 14; i++) {
          const u = clamp(((sp * 1.7) - i * 0.035), 0, 1);
          if (u <= 0 || u >= 1 || sp <= 0 || sp >= 1) continue;
          const sx = 2 + u * (32 + (i % 4) * 5);
          const sy = -30 + r.dy + r.hdy * 0.6 - Math.sin(u * 1.6) * (10 + (i % 3) * 3.6) + u * u * 24;
          const rr = 1.3 + ((i * 7) % 3) * 0.5;
          ctx.save();
          ctx.globalAlpha *= 1 - u * u * 0.6;
          k.ell(sx, sy, rr, rr, { fill: i % 3 === 0 ? F.white : AMBER, lw: 1, j: 0.02 });
          ctx.restore();
        }
        zText(ctx, '!', -22, -64 + r.dy, 8, -0.2, jolt > 0 ? 1 : 0);
      });
    }
    handFront.push((h) => drawBottle(ctx, h[0] - 0.5, h[1] + 1, 1, { grip: true, tilt: -0.1, seed, t, fizz: asleep ? 0 : 1 }));
  } else if (state === 'watch') {
    r.hr = [15.5, -50];
    r.hl = [-14, -14];
    r.frontL = false;
    r.tilt = -0.12;
    r.hdy = -1.2 + Math.sin(t * 2.4) * 0.3;
    r.dy = -1.2 + Math.sin(t * 2.4) * 0.3;
    r.mouth = 'o';
    r.mw = 0.5 + Math.sin(t * 3) * 0.3;
    r.brow = 1.1;
    r.stepL = 0;
    over.push(() => {
      zText(ctx, '?', 24, -60 + Math.sin(t * 3) * 1.4, 6, 0.2, 1);
    });
    front.push(() => drawBottle(ctx, -17, -9.6, 1, { grip: true, tilt: 0.08, seed, t }));
  } else if (state === 'coach') {
    r.sit = 1;
    ox = -16;
    const talk = Math.abs(Math.sin(t * 5));
    r.hr = [20, -34];
    r.hl = [-14, -10];
    r.mouth = 'open';
    r.mw = talk * 0.8;
    r.brow = 0.35;
    r.ang = 0.15;
    r.tilt = Math.sin(t * 2.5) * 0.04;
    r.hdy = Math.sin(t * 5) * 0.3;
    if (tr === undefined) {
      over.push(() => {
        rays(ctx, 12, -36, 7, 11, 3, -0.9, 0.15, seed + 16);
        drawApprentice(ctx, 24 - ox + 14, 0, 1, { t, seed, pose: 'shake' });
      });
      showTrunk = { x: 52 - ox, w: 12, wob: Math.sin(t * 11) * 0.007 };
    }
    front.push(() => drawBottle(ctx, -15, -11, 1, { grip: true, tilt: 0.1, seed, t }));
  } else if (state === 'retire') {
    const q = pIn !== undefined ? pIn : 1;
    r.rec = ease(clamp(q, 0, 1));
    r.sit = 0;
    r.mouth = 'smile';
    r.brow = 0.1;
    r.hl = [-10, -10];
    r.hr = [8, -14];
    r.frontL = true;
    r.tilt = Math.sin(t * 0.8) * 0.03;
    r.hdy = Math.sin(t * 1.2) * 0.4;
    r.dy = 0;
  }

  const dirF = (o.dir ?? 1) < 0 ? -1 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * dirF, s);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.translate(ox + r.dx, 0);

  const ground = new Ink(ctx, seed + 3, 2, 0.1);
  const air = clamp(-r.dy / 6, 0, 1);
  ground.shadow(0, 0.4, 15 - air * 4, 2.6, 0.2 - air * 0.07);

  // 躺椅:后层
  if (state === 'retire' && r.rec > 0.01) drawRecliner(ctx, 6, 0, 1, { layer: 'back', seed });
  if (state === 'retire') {
    drawRadio(ctx, 50, 0, 1, { t, seed });
    const tk = new Ink(ctx, seed + 4, 2, 0.12);
    tk.rect(40, -16, 20, 3, { fill: F.wood, lw: 1.8, r: 1, j: 0.08 });
    tk.limb(43, -13, 41.4, -0.6, 2.2, F.woodDark, 1.2);
    tk.limb(57, -13, 58.6, -0.6, 2.2, F.woodDark, 1.2);
  }
  if (showTrunk && wantTree) trunk(ctx, showTrunk.x, showTrunk.w, seed + 2, showTrunk.wob);
  // 马扎/板凳
  if (stool.on && stool.x === 0 && r.sit > 0.5 || (stool.on && tr !== undefined && r.sit <= 0.5)) {
    if (state === 'coach') drawBench(ctx, stool.x, 0, 1, { seed });
    else drawStool(ctx, stool.x, 0, 1, { open: stool.open, seed });
  } else if (stool.on) {
    drawStool(ctx, stool.x, 0, 1, { open: stool.open, seed });
  }
  for (const f of back) f();

  // 身体(含坐姿下沉)
  const sitDy = -4.5 * r.sit;
  const recDy = -9 * r.rec;
  ctx.save();
  ctx.translate(0, r.dy + sitDy + recDy);
  const hipY = -8;
  // 腿
  const lk = new Ink(ctx, seed + 5, 2.2, 0.15);
  if (r.rec > 0.5) {
    // 躺姿:腿向右伸、脚架在脚托上
    const rr = r.rec;
    for (const sd of [-1, 1]) {
      const fx = 28 + sd * 0.4, fy = -9.6 + sd * 1.4 - 6.0 + 8.6 * (1 - rr);
      lk.limb(2, hipY - 7 + 0.7 * sd, 14, hipY - 6.8, 7, DENIM, 1.9);
      lk.limb(14, hipY - 6.8, fx, fy - 4.3 + 6, 6.4, DENIM, 1.9);
      lk.ell(fx + 3, fy + 1.9, 2.4, 3.9, { fill: BOOT, lw: 1.7, j: 0.06 });
    }
  } else {
    for (const sd of [-1, 1] as const) {
      const lift = sd > 0 ? r.step : r.stepL;
      const fx = sd * (5.8 + r.sit * 1.8);
      lk.limb(sd * 4.6, hipY, fx, -1.6 - lift, 7, DENIM, 1.9);
      lk.ell(fx + sd * 1.1, -1.1 - lift, 4.4, 2.5, { fill: BOOT, lw: 1.7, j: 0.06 });
    }
  }
  ctx.restore();

  ctx.save();
  ctx.translate(0, r.dy + sitDy + recDy);
  // 座布前沿(坐下后盖住大腿根)
  if (state === 'retire') { /* 躺椅无座布 */ } else if (r.sit > 0.5 && stool.on) {
    ctx.save();
    ctx.translate(0, -(r.dy + sitDy + recDy));
    if (state === 'coach') {
      // 小板凳台面已画好
    } else {
      const sk = new Ink(ctx, seed + 22, 2.1, 0.14);
      sk.rect(-13.1, -16.4, 26.2, 3.7, { fill: '#c9d1c8', shade: 'rgba(80,100,95,0.22)', lw: 1.9, r: 1.4, j: 0.12 });
    }
    ctx.restore();
  }
  void seatF;
  // 身体绕髋倾斜(躺椅:向后仰)
  const hipPt: Pt = r.rec > 0 ? [-2, -9 - r.rec * 8] : [0, -9];
  ctx.translate(hipPt[0], hipPt[1]);
  ctx.rotate(r.lean - r.rec * 0.78);
  ctx.translate(-hipPt[0], -hipPt[1]);
  if (r.rec > 0) ctx.translate(-2 * r.rec, -8 * r.rec);

  // 远侧手臂(多数在躯干后)
  let hL: Pt | undefined;
  if (!r.frontL) hL = arm(ctx, seed + 6, SL, r.hl, -1, SHIRT);
  // 躯干:衬衫 + 背带裤
  const tk = new Ink(ctx, seed + 7, 2.3, 0.2);
  tk.poly([[-9.8, -26.4], [9.8, -26.4], [11.8, -8.2], [-11.8, -8.2]], { fill: SHIRT, shade: F.shade, smooth: true, lw: 2.3, j: 0.2 });
  tk.poly([[-6.4, -22], [6.4, -22], [7.4, -15.6], [11.4, -15], [12.2, -7.6], [-12.2, -7.6], [-11.4, -15], [-7.4, -15.6]], { fill: DENIM, shade: DENIM_D, smooth: true, lw: 2, j: 0.15 });
  tk.line(-5.8, -22.2, -8.2, -25.8, { lw: 2.6, ext: 0, bow: 0 });
  tk.line(5.8, -22.2, 8.2, -25.8, { lw: 2.6, ext: 0, bow: 0 });
  tk.limb(-5.8, -22.2, -8.2, -25.6, 2.4, DENIM, 1.5);
  tk.limb(5.8, -22.2, 8.2, -25.6, 2.4, DENIM, 1.5);
  tk.rect(2.6, -13.4, 5.6, 4.6, { fill: DENIM, lw: 1.3, j: 0.05 });
  tk.line(2.8, -11.8, 8, -11.8, { lw: 0.7, ext: 0, bow: 0 });
  tk.dot(-6.2, -16.8, 1.1, lv >= 5 ? GOLD : F.gray3);
  tk.dot(6.2, -16.8, 1.1, lv >= 5 ? GOLD : F.gray3);
  // 等级装饰
  if (lv >= 2) {
    // 肩搭毛巾(白底灰条)
    tk.poly([[-10.4, -26.4], [-1.6, -26.6], [-3.6, -17.4], [-7.4, -16.8], [-10.8, -22]], { fill: F.white, shade: F.shade, smooth: true, lw: 1.8, j: 0.08 });
    tk.line(-9, -20.8, -4.6, -20.4, { lw: 0.9, ext: 0, bow: 0 });
    tk.line(-8.4, -18.6, -4.4, -18.4, { lw: 0.9, ext: 0, bow: 0 });
  }
  if (lv >= 4) {
    // 怀表链:由肩带扣挂到口袋
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(6.2, -16.8);
    ctx.quadraticCurveTo(10.2, -10.6, 6, -10.4);
    ctx.stroke();
    tk.ell(5.8, -9.4, 2, 2, { fill: GOLD, lw: 1.1, j: 0.03 });
  }
  if (lv >= 6) {
    // 金星徽章
    sparkle(ctx, -7.6, -11.4, 3.4, GOLD, 0, true);
  }
  // 头
  ctx.save();
  ctx.translate(0 + (r.sit > 0 ? 0 : 0), -38 + r.hdy);
  ctx.rotate(r.tilt);
  head(ctx, seed, r, lv, t);
  ctx.restore();
  // 近侧手臂 + 手持物
  const hR = arm(ctx, seed + 8, SR, r.hr, 1, SHIRT);
  if (r.frontL && hL === undefined) {
    hL = arm(ctx, seed + 6, SL, r.hl, -1, SHIRT);
  }
  for (const f of handFront) f(hR);
  if (state === 'retire') drawTeaCup(ctx, hR[0], hR[1] + 3.6, 1, { t, seed });
  for (const f of front) f();
  ctx.restore();
  // 扶/抱树时树干压在手上
  if (state === 'shake' && showTrunk && wantTree) {
    const k = new Ink(ctx, seed + 30, 1.9, 0.1);
    void k;
  }
  for (const f of over) f();
  // 满级光点
  if (lv >= 7) {
    for (let i = 0; i < (lv >= 8 ? 4 : 2); i++) {
      const a = t * 1.1 + (i * TAU) / 4;
      const u = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7);
      sparkle(ctx, Math.cos(a) * 31, -34 + Math.sin(a) * 25, 1.5 + u * 2.2, lv >= 8 ? '#ffe27a' : F.white, a, false);
    }
  }
  ctx.restore();
};
