// 角色:分件(腿/身/臂/头/配件)+ 代码动画(待机/摇/接/庆祝/被砸)。(x,y)=脚底中心,约 2.2 头身,s=1 时高约 40 单位。
// o.pose: idle|shake|catch|cheer|hit;o.p 为一次性姿态进度 0..1(不给则自循环);o.t 动画秒;o.dir=-1 朝左。
// 黑白手绘 + 点缀色。身体每帧现画(便宜:~15 个小图形),确定性抖动(同 seed 同形)。
import { drawLaoXu } from './laoxu.ts';
import type { LaoXuState } from './laoxu.ts';
import { drawApple } from './apple.ts';
import { F, INK, Ink, TAU, clamp, ease, lerp, sparkle } from './ink.ts';
import type { C, Pt } from './ink.ts';
import type { Pose, ThingFn, ThingOpt } from './types.ts';

export type CharKind =
  | 'xu' | 'newton' | 'santa' | 'cust1' | 'cust2' | 'cust3'
  | 'crow' | 'manman' | 'haihai' | 'dudu' | 'doorman' | 'duoduo';

export const CHAR_KINDS: CharKind[] = ['xu', 'newton', 'santa', 'cust1', 'cust2', 'cust3', 'crow', 'manman', 'haihai', 'dudu', 'doorman', 'duoduo'];
export const CHAR_NAMES: Record<CharKind, string> = {
  xu: '老徐', newton: '牛顿', santa: '圣诞老人', cust1: '顾客·大妈', cust2: '顾客·小孩', cust3: '顾客·西装', crow: '乌鸦老黑',
  manman: '督察小满', haihai: '海关老海', dudu: '外星人嘟嘟', doorman: '门童', duoduo: '果多多',
};

type Mouth = 'smile' | 'o' | 'open' | 'wave' | 'flat' | 'grin';
type Eyes = 'dot' | 'happy' | 'x' | 'squint';
interface Rg {
  dy: number; lean: number; tilt: number; hdy: number;
  hl: Pt; hr: Pt; mouth: Mouth; eyes: Eyes; stars: number; step: number;
}

const SL: Pt = [-6.2, -19.4];
const SR: Pt = [6.2, -19.4];

function rig(o: ThingOpt): Rg {
  const t = o.t ?? 0;
  const pose: Pose = o.pose ?? 'idle';
  const sw = Math.sin(t * 2.1);
  const r: Rg = {
    dy: sw * 0.3, lean: sw * 0.012, tilt: Math.sin(t * 0.9) * 0.025, hdy: 0,
    hl: [-9.4, -11.5 + sw * 0.7], hr: [9.4, -11.5 - sw * 0.7], mouth: 'smile', eyes: 'dot', stars: 0, step: 0,
  };
  if (pose === 'shake') {
    const ph = Math.sin(t * 10);
    r.hl = [-8.2, -33 + ph * 4.2];
    r.hr = [8.2, -33 - ph * 4.2];
    r.lean = ph * 0.05;
    r.dy = -Math.abs(ph) * 0.8;
    r.mouth = 'o';
    r.eyes = 'squint';
    r.step = ph * 0.8;
  } else if (pose === 'catch') {
    const q = o.p ?? (t * 0.7) % 1;
    const dip = Math.sin(clamp(q, 0, 1) * Math.PI);
    r.hl = [-5.6, -15 + dip * 2.5];
    r.hr = [5.6, -15 + dip * 2.5];
    r.dy = dip * 1.6;
    r.mouth = q > 0.5 ? 'open' : 'smile';
    r.hdy = dip * 0.6;
  } else if (pose === 'cheer') {
    const j = Math.abs(Math.sin(t * 6));
    r.dy = -j * 5;
    r.hl = [-13.5, -38 + Math.sin(t * 12) * 2];
    r.hr = [13.5, -38 - Math.sin(t * 12) * 2];
    r.mouth = 'open';
    r.eyes = 'happy';
    r.tilt = Math.sin(t * 6) * 0.05;
    r.lean = Math.sin(t * 3) * 0.03;
  } else if (pose === 'hit') {
    const q = clamp(o.p ?? (t * 0.55) % 1, 0, 1);
    const k = 1 - ease(q);
    r.dy = 1.6 * k;
    r.tilt = 0.16 * k * Math.sin(t * 22 + 1);
    r.lean = Math.sin(t * 30) * 0.03 * k;
    r.hl = [-9, -32 + Math.sin(t * 20) * 0.6 * k];
    r.hr = [9, -32];
    r.mouth = 'wave';
    r.eyes = q < 0.75 ? 'x' : 'squint';
    r.stars = q < 0.9 ? 1 - q / 0.9 : 0;
  }
  return r;
}

interface Ctx {
  k: Ink; g: C; r: Rg; t: number; o: ThingOpt; seed: number;
}
interface Spec {
  skin: string; coat: string; coat2?: string; pants: string; shoes?: string;
  /** 躯干宽度系数 */
  bw?: number;
  /** 头尺寸系数(以 R=9.5 为基准) */
  hs?: number;
  /** 整体缩放 */
  sc?: number;
  /** 修改姿态(如圣诞老人电话在耳边) */
  fix?: (r: Rg, o: ThingOpt) => void;
  pre?: (c: Ctx) => void;
  body?: (c: Ctx) => void;
  /** 头部后层(假发后半、帽后沿):头局部坐标,原点=头心 */
  headBack?: (c: Ctx) => void;
  /** 面部默认眼嘴之上的头部前层(胡子、帽、头发等) */
  head?: (c: Ctx) => void;
  noFace?: boolean;
  prop?: (c: Ctx) => void;
  /** 在人物之上、不随姿态抖动的东西(气泡/数字) */
  over?: (c: Ctx) => void;
}

function hand(k: Ink, p: Pt, skin: string, r = 1.75, col?: string): void {
  k.ell(p[0], p[1], r, r, { fill: col ?? skin, lw: 1.3, j: 0.08 });
}

function arm(k: Ink, s: Pt, h: Pt, side: 1 | -1, sleeve: string, skin: string, w = 3.3, glove?: string): void {
  const ex = (s[0] + h[0]) / 2 + side * 2.2, ey = (s[1] + h[1]) / 2 + 1.2;
  k.limb(s[0], s[1], ex, ey, w, sleeve, 1.5);
  k.limb(ex, ey, h[0], h[1], w * 0.9, sleeve, 1.5);
  hand(k, h, skin, 1.8, glove);
}

function face(c: Ctx, hx = 0, ey = -0.8): void {
  const { k, g, r, t } = c;
  const blink = (t % 3.7) < 0.12;
  const e = blink && r.eyes === 'dot' ? 'squint' : r.eyes;
  const ex = 3.5;
  if (e === 'dot') {
    k.ell(-ex + hx, ey, 1.05, 1.35, { fill: INK, lw: 0.5, j: 0.02 });
    k.ell(ex + hx, ey, 1.05, 1.35, { fill: INK, lw: 0.5, j: 0.02 });
    g.fillStyle = '#fff';
    g.fillRect(-ex + hx + 0.1, ey - 0.8, 0.5, 0.5);
    g.fillRect(ex + hx + 0.1, ey - 0.8, 0.5, 0.5);
  } else if (e === 'squint') {
    k.line(-ex - 1.3 + hx, ey + 0.4, -ex + 1.2 + hx, ey + 0.4, { lw: 1.3, ext: 0, bow: 0 });
    k.line(ex - 1.2 + hx, ey + 0.4, ex + 1.3 + hx, ey + 0.4, { lw: 1.3, ext: 0, bow: 0 });
  } else if (e === 'happy') {
    k.stroke([[-ex - 1.4 + hx, ey + 0.9], [-ex + hx, ey - 0.8], [-ex + 1.4 + hx, ey + 0.9]], { lw: 1.3, smooth: true });
    k.stroke([[ex - 1.4 + hx, ey + 0.9], [ex + hx, ey - 0.8], [ex + 1.4 + hx, ey + 0.9]], { lw: 1.3, smooth: true });
  } else {
    for (const sx of [-ex, ex]) {
      k.line(sx - 1.1 + hx, ey - 1.1, sx + 1.1 + hx, ey + 1.1, { lw: 1.2, ext: 0, bow: 0 });
      k.line(sx + 1.1 + hx, ey - 1.1, sx - 1.1 + hx, ey + 1.1, { lw: 1.2, ext: 0, bow: 0 });
    }
  }
  const my = 4.2;
  switch (r.mouth) {
    case 'smile': k.stroke([[-2 + hx, my - 0.4], [hx, my + 0.8], [2 + hx, my - 0.4]], { lw: 1.2, smooth: true }); break;
    case 'grin': k.poly([[-3 + hx, my - 0.6], [3 + hx, my - 0.6], [2 + hx, my + 1.8], [-2 + hx, my + 1.8]], { fill: '#fff', lw: 1.1, j: 0.05 }); break;
    case 'o': k.ell(hx, my + 0.4, 1.3, 1.6, { fill: F.gray3, lw: 1.1, j: 0.05 }); break;
    case 'open': k.ell(hx, my + 0.6, 2.3, 1.9, { fill: F.gray3, lw: 1.2, j: 0.05 }); break;
    case 'wave': k.stroke([[-3 + hx, my + 0.6], [-1.5 + hx, my - 0.5], [0 + hx, my + 0.7], [1.5 + hx, my - 0.5], [3 + hx, my + 0.6]], { lw: 1.2, smooth: true }); break;
    default: k.line(-1.8 + hx, my, 1.8 + hx, my, { lw: 1.2, ext: 0, bow: 0 });
  }
}

function drawBiped(ctx: C, sp: Spec, x: number, y: number, s: number, o: ThingOpt): void {
  const seed = o.seed ?? 1;
  const t = o.t ?? 0;
  const r = rig(o);
  sp.fix?.(r, o);
  const sc = (sp.sc ?? 1) * s;
  const dirF = (o.dir ?? 1) < 0 ? -1 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sc * dirF, sc);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  const k = new Ink(ctx, seed, 1.9, 0.18);
  const c: Ctx = { k, g: ctx, r, t, o, seed };
  const airborne = clamp(-r.dy / 5, 0, 1);
  k.shadow(0, 0.4, 9 - airborne * 2.5, 1.9, 0.2 - airborne * 0.07);
  ctx.save();
  ctx.translate(0, r.dy);
  // 以髋为轴倾斜
  ctx.translate(0, -6);
  ctx.rotate(r.lean);
  ctx.translate(0, 6);
  const bw = sp.bw ?? 1;
  sp.pre?.(c);
  // 腿
  const sh = sp.shoes ?? F.woodDark;
  const lift = Math.max(0, -r.dy) * 0.0;
  for (const sd of [-1, 1] as const) {
    const fx = sd * 3.4 + (sd > 0 ? r.step : -r.step) * 0.5;
    k.limb(sd * 3, -7, fx, -1.2 - lift, 3.4, sp.pants, 1.5);
    k.ell(fx + sd * 0.5, -0.9, 2.9, 1.6, { fill: sh, lw: 1.3, j: 0.08 });
  }
  // 后臂(左,远侧)
  arm(k, SL, r.hl, -1, sp.coat2 ?? sp.coat, sp.skin);
  // 躯干
  k.poly([[-6.6 * bw, -21.2], [6.6 * bw, -21.2], [7.8 * bw, -6.6], [-7.8 * bw, -6.6]], { fill: sp.coat, shade: F.shade, smooth: true, lw: 1.9, j: 0.22 });
  sp.body?.(c);
  // 头
  ctx.save();
  ctx.translate(0, -29.2 + r.hdy);
  ctx.rotate(r.tilt);
  const hs = sp.hs ?? 1.16;
  ctx.scale(hs, hs);
  sp.headBack?.(c);
  k.ell(0, 0, 9.4, 9, { fill: sp.skin, shade: F.shade, lw: 2, j: 0.22 });
  if (!sp.noFace) face(c);
  sp.head?.(c);
  ctx.restore();
  // 前臂
  arm(k, SR, r.hr, 1, sp.coat, sp.skin);
  sp.prop?.(c);
  ctx.restore();
  // 被砸星星
  if (r.stars > 0) {
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * TAU) / 3;
      sparkle(ctx, Math.cos(a) * 9, -42 + r.dy + Math.sin(a) * 2.6, 1.9 * r.stars + 0.4, F.white, a);
    }
  }
  sp.over?.(c);
  ctx.restore();
}

/* ───────── 各角色 Spec ───────── */
const STRAW = '#efdca0';
const NAVY = '#5d6a73';

const XU: Spec = {
  skin: F.skin, coat: F.gray, coat2: F.gray, pants: '#8d8a7c', shoes: F.woodDark,
  body(c) {
    const { k } = c;
    k.poly([[-3.2, -21.2], [0, -14], [3.2, -21.2]], { fill: F.white, lw: 1.3, j: 0.1 });
    k.line(-4.4, -21, -4.6, -8, { lw: 1.1, ext: 0 });
    k.line(4.4, -21, 4.6, -8, { lw: 1.1, ext: 0 });
    k.rect(-2, -12.4, 4, 2.6, { fill: F.warm, lw: 1.1 });
  },
  head(c) {
    const { k, g, t } = c;
    // 白胡子 + 八字胡
    k.poly([[-7.4, 2], [-5, 9], [0, 12.4], [5, 9], [7.4, 2], [3.6, 4.2], [0, 3.4], [-3.6, 4.2]], { fill: F.white, shade: F.shade, smooth: true, lw: 1.6, j: 0.2 });
    k.stroke([[-4.2, 3.2], [-1.4, 2.2], [0, 3.1], [1.4, 2.2], [4.2, 3.2]], { lw: 1.2, smooth: true });
    k.line(-5.2, -3.8, -1.8, -4.5, { lw: 1.7, ext: 0 });
    k.line(5.2, -3.8, 1.8, -4.5, { lw: 1.7, ext: 0 });
    // 草帽
    const bob = Math.sin(t * 2.1) * 0.1;
    g.save();
    g.translate(0, bob);
    k.poly([[-6.6, -6.4], [-5.8, -14.2], [-3, -17.6], [3, -17.6], [5.8, -14.2], [6.6, -6.4]], { fill: STRAW, shade: '#cdb877', smooth: true, lw: 1.8, j: 0.2 });
    k.ell(0, -6.2, 15, 3.4, { fill: STRAW, lw: 2, j: 0.3 });
    k.rect(-6.6, -9.8, 13.2, 2.4, { fill: F.gray2, lw: 1.3 });
    for (let i = 0; i < 6; i++) k.line(-12 + i * 4.6, -6.8, -11 + i * 4.6, -4.6, { lw: 0.7, ext: 0, bow: 0 });
    g.restore();
  },
};

const NEWTON: Spec = {
  skin: F.skin, coat: '#a8a496', coat2: '#a8a496', pants: F.white, shoes: F.gray3,
  body(c) {
    const { k } = c;
    k.poly([[-3.4, -21.2], [0, -12.4], [3.4, -21.2]], { fill: F.white, lw: 1.3, j: 0.1 });
    k.line(0, -12, 0, -7, { lw: 1.1, ext: 0 });
    for (let i = 0; i < 3; i++) k.ell(0, -11.4 + i * 2.5, 0.85, 0.85, { fill: F.gray3, lw: 0.9, j: 0.03 });
    k.rect(-7.6, -9.6, 5.2, 3.8, { fill: F.white, lw: 1.1, r: 0.6 });
    k.rect(2.4, -9.6, 5.2, 3.8, { fill: F.white, lw: 1.1, r: 0.6 });
  },
  headBack(c) {
    const { k } = c;
    for (const [px, py, rr] of [[-9.2, -2, 4], [-9.6, 3.4, 3.7], [-7.6, 8, 3.2], [9.2, -2, 4], [9.6, 3.4, 3.7], [7.6, 8, 3.2]] as const)
      k.ell(px, py, rr, rr, { fill: F.white, lw: 1.6, j: 0.15 });
  },
  head(c) {
    const { k, g, r } = c;
    // 额前卷发
    for (const [px, py, rr] of [[-6.4, -8, 4], [-2.2, -10.4, 4.2], [2.4, -10.4, 4.2], [6.6, -8, 4], [0, -7, 3]] as const)
      k.ell(px, py, rr, rr, { fill: F.white, lw: 1.6, j: 0.15 });
    if (r.stars > 0) {
      // 头顶肿包
      k.ell(5.5, -9, 2.6, 2.1, { fill: F.cream, lw: 1.2, j: 0.05 });
    }
    g.fillStyle = INK;
  },
};

const SANTA: Spec = {
  skin: F.skin, coat: '#c4574c', coat2: '#c4574c', pants: '#c4574c', shoes: F.gray3, bw: 1.18,
  fix(r, o) {
    if ((o.pose ?? 'idle') === 'idle') r.hr = [6.6, -28];
  },
  body(c) {
    const { k } = c;
    k.rect(-7.4, -7.8, 14.8, 2.2, { fill: F.white, lw: 1.3 });
    k.rect(-7.8, -14, 15.6, 2.6, { fill: F.gray3, lw: 1.3 });
    k.rect(-1.6, -14.2, 3.2, 3, { fill: F.warm, lw: 1.1 });
    k.line(0, -21, 0, -14.4, { lw: 1.6, ext: 0 });
  },
  head(c) {
    const { k, g } = c;
    // 大胡子
    k.poly([[-8.6, -1], [-9, 6], [-4, 12.4], [0, 14], [4, 12.4], [9, 6], [8.6, -1], [3.4, 2.6], [0, 2], [-3.4, 2.6]], { fill: F.white, shade: F.shade, smooth: true, lw: 1.7, j: 0.2 });
    k.stroke([[-4.2, 2.6], [-1.4, 1.4], [0, 2.4], [1.4, 1.4], [4.2, 2.6]], { lw: 1.2, smooth: true });
    // 帽
    k.poly([[-9.6, -4.4], [-8, -13], [-2, -17.6], [8, -14.4], [11, -10], [9.6, -4.4]], { fill: '#c4574c', shade: '#a8453c', smooth: true, lw: 1.8, j: 0.2 });
    k.rect(-10.6, -7.4, 21.2, 3.8, { fill: F.white, lw: 1.7, r: 1.8 });
    k.ell(11.4, -10.6, 2.6, 2.6, { fill: F.white, lw: 1.5, j: 0.1 });
    g.fillStyle = INK;
  },
  prop(c) {
    // 手机(右手在耳边)
    const { k, r, o, t } = c;
    if ((o.pose ?? 'idle') === 'idle') {
      k.rect(r.hr[0] + 0.4, r.hr[1] - 4.6, 3.2, 6.6, { fill: F.gray3, lw: 1.3, r: 0.8 });
      // 音波
      for (let i = 0; i < 2; i++) {
        const u = (t * 1.1 + i * 0.5) % 1;
        c.g.save();
        c.g.globalAlpha *= 1 - u;
        c.g.beginPath();
        c.g.arc(r.hr[0] + 4.5, r.hr[1] - 1.5, 2.6 + u * 4, -0.9, 0.9);
        c.g.lineWidth = 1;
        c.g.strokeStyle = INK;
        c.g.stroke();
        c.g.restore();
      }
    }
  },
};

const CUST1: Spec = {
  skin: F.skin, coat: '#c8c2b0', coat2: '#c8c2b0', pants: F.gray2, shoes: F.gray3, bw: 1.1,
  body(c) {
    const { k } = c;
    k.poly([[-6.6, -21], [6.6, -21], [3.6, -17], [-3.6, -17]], { fill: NAVY, lw: 1.5, j: 0.1 });
    for (let i = 0; i < 3; i++) k.line(-3 + i * 3, -20.4, -2.4 + i * 3, -17.6, { lw: 0.8, ext: 0, bow: 0 });
  },
  headBack(c) {
    c.k.ell(0, -8.4, 5.2, 4.4, { fill: F.gray, lw: 1.7, j: 0.12 }); // 发髻
  },
  head(c) {
    const { k } = c;
    k.poly([[-9.4, 0], [-9.2, -6], [-4, -9.6], [4, -9.6], [9.2, -6], [9.4, 0], [6.4, -4.2], [0, -6.4], [-6.4, -4.2]], { fill: F.gray, shade: F.shade, smooth: true, lw: 1.6, j: 0.15 });
    k.ell(-7, 0.4, 1.2, 1.2, { fill: F.white, lw: 0.9, j: 0.03 });
    k.ell(7, 0.4, 1.2, 1.2, { fill: F.white, lw: 0.9, j: 0.03 });
  },
  prop(c) {
    const { k, r, g } = c;
    const [hx, hy] = r.hr;
    // 菜篮子(手提)
    const by = hy + 5;
    k.stroke([[hx - 5, by - 1.6], [hx - 3.4, hy - 1.6], [hx + 3.4, hy - 1.6], [hx + 5, by - 1.6]], { lw: 1.3, smooth: true });
    drawApple(g, hx - 2, by - 3.2, 2.3, { leaf: false });
    drawApple(g, hx + 2.2, by - 3.4, 2.3, { leaf: true });
    k.poly([[hx - 6, by - 1.8], [hx + 6, by - 1.8], [hx + 4.6, by + 4.8], [hx - 4.6, by + 4.8]], { fill: F.wood, shade: F.shade2, lw: 1.5, j: 0.15 });
    k.line(hx - 5, by + 1.4, hx + 5, by + 1.4, { lw: 0.8, ext: 0, bow: 0 });
  },
};

const CUST2: Spec = {
  skin: F.skin, coat: '#aab9bd', coat2: '#aab9bd', pants: F.gray2, shoes: F.woodDark, sc: 0.8, hs: 1.22, bw: 0.95,
  body(c) {
    const { k } = c;
    k.rect(-6.8, -21.4, 13.6, 3.6, { fill: F.white, lw: 1.4, r: 1 });
    k.line(3, -18, 4.2, -10, { lw: 2.6, ext: 0 });
  },
  head(c) {
    const { k, t } = c;
    k.poly([[-9.6, -3], [-8.6, -9.4], [-3, -12.6], [3, -12.6], [8.6, -9.4], [9.6, -3], [4, -5.4], [-4, -5.4]], { fill: F.warm, shade: F.shade2, smooth: true, lw: 1.8, j: 0.15 });
    k.rect(-10.2, -5.8, 20.4, 3, { fill: F.white, lw: 1.5, r: 1.2 });
    k.ell(0.4, -14.6 + Math.sin(t * 2.1) * 0.15, 2.8, 2.8, { fill: F.white, lw: 1.5, j: 0.1 });
  },
};

const CUST3: Spec = {
  skin: F.skin, coat: F.gray2, coat2: F.gray2, pants: '#6b6962', shoes: INK,
  body(c) {
    const { k } = c;
    k.poly([[-2.6, -21.2], [0, -17.4], [2.6, -21.2]], { fill: F.white, lw: 1.2, j: 0.08 });
    k.poly([[-1, -18.4], [1, -18.4], [1.6, -10.4], [0, -8.4], [-1.6, -10.4]], { fill: NAVY, lw: 1.2, j: 0.08 });
  },
  head(c) {
    const { k } = c;
    k.poly([[-9.2, -1.4], [-8.6, -7.4], [-3.6, -9.8], [3.6, -9.8], [8.6, -7.4], [9.2, -1.4], [6, -5.6], [0, -6.6], [-6, -5.6]], { fill: F.gray3, lw: 1.6, j: 0.15 });
    k.ell(-3.5, -0.8, 3, 2.7, { fill: undefined, lw: 1.2, j: 0.05 });
    k.ell(3.5, -0.8, 3, 2.7, { fill: undefined, lw: 1.2, j: 0.05 });
    k.line(-0.6, -0.8, 0.6, -0.8, { lw: 1.1, ext: 0, bow: 0 });
  },
  prop(c) {
    const { k, r } = c;
    const [hx, hy] = r.hr;
    k.rect(hx - 5.4, hy + 1.6, 10.8, 7.6, { fill: F.wood, shade: F.shade2, lw: 1.6, r: 0.8 });
    k.rect(hx - 1.8, hy + 0.2, 3.6, 1.8, { fill: undefined, lw: 1.2 });
    k.ell(hx, hy, 1.7, 1.7, { fill: F.skin, lw: 1.3, j: 0.05 });
  },
};

const MANMAN: Spec = {
  skin: F.skin, coat: F.gray, coat2: F.gray, pants: '#6f7b80', shoes: INK, bw: 0.96,
  fix(r, o) {
    if (o.bite && (o.pose ?? 'idle') === 'idle') r.hr = [3.4, -26];
  },
  body(c) {
    const { k } = c;
    k.rect(-6.6, -14.6, 13.2, 2, { fill: F.gray3, lw: 1.1 });
    k.poly([[-2.8, -21.2], [0, -16.4], [2.8, -21.2]], { fill: F.white, lw: 1.1, j: 0.08 });
    k.ell(4, -17.4, 1.4, 1.5, { fill: F.gold, lw: 0.9, j: 0.04 });
  },
  headBack(c) {
    const { k, t } = c;
    k.ell(-10.2 + Math.sin(t * 2.4) * 0.5, 1.6, 2.6, 4.8, { fill: F.gray3, lw: 1.5, j: 0.1 }); // 马尾
  },
  head(c) {
    const { k } = c;
    k.poly([[-9.6, 1], [-9.2, -5.6], [-4.4, -8.8], [4.4, -8.8], [9.2, -5.6], [9.6, 1], [6, -3.8], [0, -5], [-6, -3.8]], { fill: F.gray3, lw: 1.6, j: 0.15 });
    // 大檐帽
    k.poly([[-8.8, -6], [-8, -13], [8, -13], [8.8, -6]], { fill: F.cream, shade: F.shade, lw: 1.8, j: 0.15 });
    k.rect(-9.6, -7.6, 19.2, 2.6, { fill: F.gray2, lw: 1.6 });
    k.ell(0, -10, 1.6, 1.6, { fill: F.gold, lw: 1, j: 0.04 });
    // 圆眼镜
    k.ell(-3.5, -0.8, 2.8, 2.6, { lw: 1.1, j: 0.05 });
    k.ell(3.5, -0.8, 2.8, 2.6, { lw: 1.1, j: 0.05 });
  },
  prop(c) {
    const { k, r, g, o } = c;
    if (o.bite) {
      drawApple(g, r.hr[0] + 0.4, r.hr[1] + 0.8, 2.6, { leaf: false });
      return;
    }
    const [hx, hy] = r.hl;
    // 写字板(左手)
    k.rect(hx - 4, hy - 4.6, 8.6, 11, { fill: F.cream, lw: 1.5, r: 0.5 });
    for (let i = 0; i < 4; i++) k.line(hx - 2.6, hy - 2 + i * 2.4, hx + 3, hy - 2 + i * 2.4, { lw: 0.7, ext: 0, bow: 0 });
    k.rect(hx - 1.4, hy - 5.6, 3.4, 1.6, { fill: F.gray2, lw: 1.1 });
    hand(k, r.hl, F.skin, 1.7);
  },
};

const HAIHAI: Spec = {
  skin: F.skin, coat: F.cream, coat2: F.cream, pants: '#6f7b80', shoes: INK, bw: 1.22,
  body(c) {
    const { k } = c;
    k.line(0, -21, 0, -6.8, { lw: 1.2, ext: 0 });
    for (let i = 0; i < 3; i++) k.ell(0, -17 + i * 3.6, 0.9, 0.9, { fill: F.gray3, lw: 0.9, j: 0.03 });
    k.poly([[-6.6, -18.4], [-2.4, -18.4], [-3, -14.4], [-6, -14.4]], { fill: F.white, lw: 1.1, j: 0.05 });
    k.rect(-7.6, -9, 15.2, 1.8, { fill: F.gray2, lw: 1 });
  },
  head(c) {
    const { k } = c;
    // 大八字胡
    k.poly([[-8, 3.4], [-4, 1.6], [0, 2.8], [4, 1.6], [8, 3.4], [4.4, 5], [0, 4.2], [-4.4, 5]], { fill: F.gray3, smooth: true, lw: 1.4, j: 0.12 });
    // 大盖帽
    k.poly([[-9.4, -5.6], [-10, -11], [-5, -14.4], [5, -14.4], [10, -11], [9.4, -5.6]], { fill: F.cream, shade: F.shade, smooth: true, lw: 1.9, j: 0.18 });
    k.rect(-9.8, -8, 19.6, 2.8, { fill: F.gray3, lw: 1.5 });
    k.ell(0, -11.2, 2, 1.7, { fill: F.gold, lw: 1, j: 0.04 });
    k.ell(0, -5.2, 10.6, 2, { fill: F.gray2, lw: 1.5, j: 0.1, a0: 0, a1: Math.PI });
  },
  prop(c) {
    const { k, r } = c;
    const [hx, hy] = r.hr;
    // 印章
    k.rect(hx - 2.2, hy - 6.4, 4.4, 4, { fill: F.wood, lw: 1.3, r: 0.6 });
    k.rect(hx - 3.4, hy - 2.6, 6.8, 2.4, { fill: F.gray2, lw: 1.3, r: 0.4 });
    hand(k, r.hr, F.skin, 1.8);
  },
  over(c) {
    // 数数:头顶数字(总数错:1 2 3 2 4…)
    const seq = [1, 2, 3, 2, 4, 5, 3, 6];
    const n = seq[Math.floor((c.t * 1.1) % seq.length)];
    const { g } = c;
    g.save();
    g.fillStyle = INK;
    g.font = '700 6.6px "PingFang SC",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n), 11, -47);
    g.restore();
  },
};

const DUDU: Spec = {
  skin: '#c4e3a6', coat: '#bfc8cc', coat2: '#bfc8cc', pants: '#9aa5aa', shoes: F.gray3, hs: 1.12, bw: 0.9,
  body(c) {
    const { k } = c;
    k.line(-6, -17, 6, -17, { lw: 1.1, ext: 0 });
    k.ell(0, -12.6, 2.2, 2.2, { fill: F.white, lw: 1.1, j: 0.04 });
    k.ell(0, -12.6, 0.8, 0.8, { fill: F.leaf, lw: 0.5, j: 0.02 });
  },
  headBack(c) {
    const { k, t } = c;
    for (const sd of [-1, 1]) {
      const sw = Math.sin(t * 3 + sd) * 1.2;
      k.stroke([[sd * 3.4, -8.2], [sd * 5 + sw * 0.4, -13.6], [sd * 6.6 + sw, -17]], { lw: 1.3, smooth: true });
      k.ell(sd * 6.6 + sw, -18.2, 1.7, 1.7, { fill: F.white, lw: 1.3, j: 0.05 });
    }
  },
  noFace: true,
  head(c) {
    const { k, g, r } = c;
    // 大黑眼
    for (const sd of [-1, 1]) {
      k.ell(sd * 4.2, -0.2, 2.9, 3.6, { fill: INK, lw: 0.6, j: 0.03 });
      g.fillStyle = '#fff';
      g.fillRect(sd * 4.2 - 1.4, -2.4, 1.2, 1.2);
    }
    if (r.mouth === 'open' || r.mouth === 'o') k.ell(0, 5, 1.7, 1.4, { fill: F.gray3, lw: 1, j: 0.04 });
    else k.stroke([[-1.8, 4.6], [0, 5.8], [1.8, 4.6]], { lw: 1.1, smooth: true });
  },
};

const DOORMAN: Spec = {
  skin: F.skin, coat: F.gray3, coat2: F.gray3, pants: F.gray2, shoes: INK, sc: 1.05, bw: 1.02,
  fix(r, o) {
    if ((o.pose ?? 'idle') === 'idle') {
      r.hl = [-5.4, -13];
      r.hr = [5.4, -13];
      r.dy *= 0.3;
      r.lean = 0;
      r.mouth = 'flat';
    }
  },
  body(c) {
    const { k } = c;
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) k.ell(sd * 2.4, -18.4 + i * 3.6, 0.95, 0.95, { fill: F.gold, lw: 0.8, j: 0.03 });
    k.line(0, -21, 0, -6.6, { lw: 1.1, ext: 0 });
    k.rect(-7.6, -10.6, 15.2, 1.7, { fill: F.white, lw: 1 });
  },
  head(c) {
    const { k } = c;
    // 高筒制帽
    k.rect(-6.6, -23, 13.2, 14, { fill: F.gray3, shade: '#4b4741', lw: 1.9, r: 1.4, j: 0.18 });
    k.rect(-6.8, -12.6, 13.6, 2.6, { fill: F.gold, lw: 1.3 });
    k.ell(0, -8.6, 10.4, 2.4, { fill: F.gray3, lw: 1.7, j: 0.12 });
    // 眉
    k.line(-5, -3.2, -2, -3.6, { lw: 1.4, ext: 0 });
    k.line(5, -3.2, 2, -3.6, { lw: 1.4, ext: 0 });
  },
  prop(c) {
    const { k, r } = c;
    hand(k, r.hl, F.white, 2);
    hand(k, r.hr, F.white, 2);
  },
};

const DUODUO: Spec = {
  skin: F.skin, coat: '#8d8a7c', coat2: '#8d8a7c', pants: '#7a776c', shoes: INK, bw: 1.32, sc: 0.98,
  body(c) {
    const { k } = c;
    for (let i = -3; i <= 3; i++) k.line(i * 2.3, -20.6, i * 2.7, -7.6, { lw: 0.6, ext: 0, bow: 0 });
    k.poly([[-2.6, -21], [0, -19.2], [2.6, -21], [2.6, -17.6], [0, -19.2], [-2.6, -17.6]], { fill: F.white, lw: 1.2, j: 0.05 });
    k.ell(0, -14, 1.2, 1.2, { fill: F.gold, lw: 1, j: 0.03 });
  },
  head(c) {
    const { k, t } = c;
    // 小胡子、单片眼镜
    k.stroke([[-4.6, 3.6], [-2, 2.6], [0, 3.4], [2, 2.6], [4.6, 3.6]], { lw: 1.7, smooth: true });
    k.ell(3.5, -0.8, 3.2, 3, { lw: 1.2, j: 0.05 });
    k.stroke([[6.4, 0.6], [8.2, 6], [7, 10]], { lw: 0.8, smooth: true });
    // 礼帽
    k.rect(-6.4, -17.4, 12.8, 10.4, { fill: F.gray3, shade: '#4b4741', lw: 1.9, r: 1.3, j: 0.15 });
    k.rect(-6.6, -10.6, 13.2, 2.2, { fill: F.white, lw: 1.2 });
    k.ell(0, -6.8, 10.6, 2.3, { fill: F.gray3, lw: 1.7, j: 0.12 });
    void t;
  },
  prop(c) {
    const { k, r } = c;
    const [hx, hy] = r.hr;
    // 钱袋(橙子价码)
    k.poly([[hx - 4, hy + 8], [hx - 5.6, hy + 3], [hx - 2, hy + 0.4], [hx + 2, hy + 0.4], [hx + 5.6, hy + 3], [hx + 4, hy + 8]], { fill: F.cream, shade: F.shade, smooth: true, lw: 1.6, j: 0.1 });
    k.line(hx - 2.4, hy + 0.6, hx + 2.4, hy + 0.6, { lw: 1.4 });
    c.g.fillStyle = INK;
    c.g.font = '700 5px "PingFang SC",sans-serif';
    c.g.textAlign = 'center';
    c.g.textBaseline = 'middle';
    c.g.fillText('¥', hx, hy + 4.8);
    hand(k, r.hr, F.skin, 1.8);
  },
};

const SPECS: Partial<Record<CharKind, Spec>> = {
  xu: XU, newton: NEWTON, santa: SANTA, cust1: CUST1, cust2: CUST2, cust3: CUST3, manman: MANMAN, haihai: HAIHAI, dudu: DUDU, doorman: DOORMAN, duoduo: DUODUO,
};

/* ───────── 乌鸦老黑(非人形) ───────── */
function oneCrow(g: C, x: number, y: number, s: number, o: ThingOpt, seed: number, hat: boolean): void {
  const t = o.t ?? 0;
  const pose: Pose = o.pose ?? 'idle';
  const k = new Ink(g, seed, 1.9, 0.18);
  const hop = pose === 'cheer' ? Math.abs(Math.sin(t * 6)) * 5 : pose === 'shake' ? Math.abs(Math.sin(t * 10)) * 1 : Math.max(0, Math.sin(t * 1.7 + seed)) ** 6 * 2.5;
  const bob = Math.sin(t * 2.1 + seed) * 0.25;
  const flap = pose === 'cheer' ? Math.sin(t * 14) * 0.7 : pose === 'hit' ? Math.sin(t * 25) * 0.6 : Math.sin(t * 2.4 + seed) * 0.08;
  const dirF = (o.dir ?? 1) < 0 ? -1 : 1;
  g.save();
  g.translate(x, y);
  g.scale(s * dirF, s);
  k.shadow(0, 0.3, 7 - hop * 0.4, 1.6, 0.18);
  g.translate(0, -hop + bob);
  const BLK = '#3a3531';
  // 腿
  k.line(-1.8, -6, -2, -0.4, { lw: 1.5, ext: 0 });
  k.line(1.8, -6, 2, -0.4, { lw: 1.5, ext: 0 });
  k.line(-3.6, -0.3, -0.6, -0.3, { lw: 1.4, ext: 0 });
  k.line(0.4, -0.3, 3.4, -0.3, { lw: 1.4, ext: 0 });
  // 尾
  k.poly([[-6, -12], [-12.4, -9], [-11, -7], [-5, -8.6]], { fill: BLK, lw: 1.6, j: 0.12 });
  // 身体
  k.ell(0, -12.4, 7.6, 7, { fill: BLK, lw: 1.9, j: 0.2 });
  k.ell(1.4, -9.4, 4.4, 3.8, { fill: '#6f6a64', lw: 1, j: 0.1, nostroke: true });
  // 翅膀
  g.save();
  g.translate(-0.4, -14);
  g.rotate(flap);
  k.poly([[-1, -2.6], [-6.4, 3.6], [-1.6, 6], [2.4, 2]], { fill: '#4a443f', smooth: true, lw: 1.5, j: 0.12 });
  g.restore();
  // 头
  k.ell(5, -19.6, 4.9, 4.6, { fill: BLK, lw: 1.8, j: 0.15 });
  k.poly([[8.8, -19.8], [14, -18.2], [8.6, -16.8]], { fill: '#e0b35a', lw: 1.5, j: 0.08 });
  // 墨镜
  k.rect(3.8, -22, 5.6, 2.4, { fill: INK, lw: 0.8, r: 0.8 });
  k.line(3.8, -21, 1.4, -20.4, { lw: 1, ext: 0, bow: 0 });
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.fillRect(4.8, -21.6, 1.2, 0.6);
  if (hat) {
    k.ell(5, -23.6, 6.4, 1.5, { fill: F.gray, lw: 1.4, j: 0.1 });
    k.poly([[2, -23.8], [2.6, -28], [7.8, -28], [8.4, -23.8]], { fill: F.gray, shade: F.shade2, lw: 1.5, j: 0.1 });
    k.rect(2.2, -25.2, 6, 1.1, { fill: INK, lw: 0.5 });
  }
  g.restore();
}

export const drawCrow: ThingFn = (ctx, x, y, s, o = {}) => {
  const n = clamp(Math.round(o.n ?? 1), 1, 3);
  const seed = o.seed ?? 1;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  const d = (o.dir ?? 1) < 0 ? -1 : 1;
  if (n >= 3) oneCrow(ctx, x - 17 * s * d, y - 1.5 * s, s * 0.78, { ...o, t: (o.t ?? 0) + 0.7 }, seed + 5, false);
  if (n >= 2) oneCrow(ctx, x + 17 * s * d, y - 1 * s, s * 0.82, { ...o, t: (o.t ?? 0) + 1.3 }, seed + 9, false);
  oneCrow(ctx, x, y, s, o, seed, true);
  ctx.restore();
};

/** 通用入口:kind 取 CHAR_KINDS */
export function drawCharacter(ctx: C, kind: CharKind, x: number, y: number, s: number, o: ThingOpt = {}): void {
  if (kind === 'crow') return drawCrow(ctx, x, y, s, o);
  if (kind === 'xu') {
    const map: Record<string, LaoXuState> = { idle: 'idle', shake: 'shake', catch: 'help', cheer: 'cheer', hit: 'wake' };
    return drawLaoXu(ctx, x, y, s * 0.62, { ...o, state: (o.state as LaoXuState | undefined) ?? map[o.pose ?? 'idle'] ?? 'idle' });
  }
  const sp = SPECS[kind];
  if (sp) drawBiped(ctx, sp, x, y, s, o);
}

const mk = (kind: CharKind): ThingFn => (ctx, x, y, s, o) => drawCharacter(ctx, kind, x, y, s, o);
export const drawXu = mk('xu');
export const drawNewton = mk('newton');
export const drawSanta = mk('santa');
export const drawCustomer1 = mk('cust1');
export const drawCustomer2 = mk('cust2');
export const drawCustomer3 = mk('cust3');
export const drawManman = mk('manman');
export const drawHaihai = mk('haihai');
export const drawDudu = mk('dudu');
export const drawDoorman = mk('doorman');
export const drawDuoduo = mk('duoduo');
void lerp;
