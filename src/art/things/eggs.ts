// 彩蛋角色被点中:专属 1–2 秒动作。drawCharacterEgg(ctx,kind,x,y,s,{p:0..1,t,seed,dir});时长见 EGG_DURATION(秒)。
// 在 drawCharacter 的基础上叠加:身体位移/旋转/压扁 + 道具(灯泡、苹果、橘子、印章、礼物)+ 文字气泡。
import { drawApple } from './apple.ts';
import { drawCharacter, type CharKind } from './characters.ts';
import { drawLaoXu } from './laoxu.ts';
import { F, INK, Ink, TAU, clamp, ease, sparkle } from './ink.ts';
import type { C } from './ink.ts';
import type { ThingFn, ThingOpt } from './types.ts';

/** 每个角色彩蛋动作时长(秒):调用方 p = elapsed / 时长 */
export const EGG_DURATION: Record<CharKind, number> = {
  xu: 1.6, newton: 2, santa: 1.8, cust1: 1.6, cust2: 1.4, cust3: 1.6, crow: 1.4, manman: 1.6, haihai: 1.6, dudu: 2, doorman: 1.5, duoduo: 1.8,
};
export const EGG_LINES: Record<CharKind, string> = {
  xu: '喷!快乐水!', newton: '灵感!', santa: '嚯嚯嚯!', cust1: '再便宜点~', cust2: '耶!', cust3: '成交!', crow: '嘎!我的!', manman: '盖章!',
  haihai: '放行!', dudu: '地球货币!!!', doorman: '您请~', duoduo: '我出三个橘子',
};

function bubble(g: C, x: number, y: number, text: string, a: number): void {
  if (a <= 0) return;
  g.save();
  g.globalAlpha *= clamp(a, 0, 1);
  g.font = 'bold 7px sans-serif';
  const w = g.measureText(text).width + 8;
  const k = new Ink(g, 7, 1.4, 0.08);
  k.rect(x - w / 2, y - 10, w, 11, { fill: '#fffaf0', lw: 1.3, r: 3, j: 0.05 });
  k.poly([[x - 2, y + 0.6], [x + 2, y + 0.6], [x, y + 4]], { fill: '#fffaf0', lw: 1.2, j: 0.02 });
  g.fillStyle = INK;
  g.textAlign = 'center';
  g.fillText(text, x, y - 2);
  g.restore();
}
const stars = (g: C, x: number, y: number, t: number, n = 3, r = 8): void => {
  for (let i = 0; i < n; i++) {
    const a = t * 6 + (i * TAU) / n;
    sparkle(g, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.45, 2.4, i % 2 ? F.gold : F.white, a, true);
  }
};
const bulb = (g: C, x: number, y: number, on: number, t: number): void => {
  const k = new Ink(g, 9, 1.5, 0.08);
  k.ell(x, y, 5, 5.4, { fill: on > 0.3 ? '#fff0a0' : F.white, lw: 1.5, j: 0.04 });
  k.rect(x - 2.4, y + 4.6, 4.8, 3.6, { fill: F.gray2, lw: 1.2, r: 0.6, j: 0.03 });
  k.stroke([[x - 1.6, y + 1], [x, y - 1.6], [x + 1.6, y + 1]], { lw: 0.9 });
  if (on > 0.3) for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + t * 3;
    k.line(x + Math.cos(a) * 8, y + Math.sin(a) * 8, x + Math.cos(a) * 11.4, y + Math.sin(a) * 11.4, { lw: 1.2, ext: 0, bow: 0 });
  }
};
const orange = (g: C, x: number, y: number, r: number): void => {
  const k = new Ink(g, 5, 1.4, 0.06);
  k.ell(x, y, r, r, { fill: '#f2a847', lw: 1.5, j: 0.05 });
  k.dot(x - r * 0.3, y - r * 0.3, r * 0.2, '#fff3d0');
  k.poly([[x, y - r], [x + 2, y - r - 2], [x + 0.2, y - r - 0.4]], { fill: F.leaf, lw: 1, j: 0.02 });
};
const stamp = (g: C, x: number, y: number, r: number, text: string, a: number): void => {
  g.save();
  g.translate(x, y);
  g.rotate(-0.2);
  g.globalAlpha *= clamp(a, 0, 1);
  const k = new Ink(g, 3, 1.8, 0.06);
  k.rect(-r, -r * 0.55, r * 2, r * 1.1, { fill: 'rgba(255,255,255,0.35)', lw: 1.9, r: 2, j: 0.05 });
  g.fillStyle = INK;
  g.font = 'bold 9px sans-serif';
  g.textAlign = 'center';
  g.fillText(text, 0, 3);
  g.restore();
};

export const drawCharacterEgg = (ctx: C, kind: CharKind, x: number, y: number, s: number, o: ThingOpt = {}): void => {
  const p = clamp((o.p as number | undefined) ?? 0, 0, 1);
  const t = o.t ?? 0;
  const d = o.dir ?? 1;
  const seed = o.seed ?? 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * d, s);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  const base = (dx: number, dy: number, rot: number, sx: number, sy: number, pose: ThingOpt['pose'], pp?: number): void => {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(rot);
    ctx.scale(sx, sy);
    if (kind === 'xu') drawLaoXu(ctx, 0, 0, 0.62, { lv: 3, state: pose === 'cheer' ? 'cheer' : 'wake', t, p: pp ?? p, seed, tree: false });
    else drawCharacter(ctx, kind, 0, 0, 1, { t, pose: pose ?? 'idle', p: pp, seed, n: 3, bite: kind === 'manman' && (pp ?? 0) > 0.4 });
    ctx.restore();
  };
  const hop = (k: number, h: number): number => -Math.abs(Math.sin(k * Math.PI)) * h;
  switch (kind) {
    case 'newton': {
      // 苹果落下→砸头→晕→灯泡亮
      const fall = clamp(p / 0.28, 0, 1);
      const hit = p > 0.28;
      const sq = hit && p < 0.42 ? 1 - Math.sin(((p - 0.28) / 0.14) * Math.PI) * 0.12 : 1;
      base(0, 0, 0, 1 / sq, sq, hit && p < 0.55 ? 'hit' : p > 0.55 ? 'cheer' : 'idle');
      if (!hit) drawApple(ctx, 2, -78 + ease(fall) * 40, 5, { leaf: true });
      else if (p < 0.5) { drawApple(ctx, 8 + (p - 0.28) * 60, -38 + Math.sin((p - 0.28) * 14) * -14 + (p - 0.28) * 90, 5, { leaf: true }); stars(ctx, 0, -52, t, 3, 9); }
      if (p > 0.5) { bulb(ctx, 0, -66 - Math.sin((p - 0.5) * 10) * 1, clamp((p - 0.5) / 0.1, 0, 1), t); bubble(ctx, 22, -52, EGG_LINES.newton, 1); }
      break;
    }
    case 'santa': {
      const jp = (p * 3) % 1;
      base(0, hop(jp, p < 0.9 ? 6 : 0), Math.sin(p * 14) * 0.06, 1, 1, 'cheer');
      bubble(ctx, 0, -62 + hop(jp, 6), EGG_LINES.santa, p < 0.9 ? 1 : 1 - (p - 0.9) * 10);
      if (p > 0.45) { // 抛礼物
        const u = clamp((p - 0.45) / 0.5, 0, 1);
        const gx = 14 + u * 28, gy = -34 - Math.sin(u * Math.PI) * 28 + u * 28;
        const k = new Ink(ctx, 11, 1.5, 0.06);
        ctx.save(); ctx.translate(gx, gy); ctx.rotate(u * 9);
        k.rect(-4, -4, 8, 8, { fill: F.cream, lw: 1.4, j: 0.04 });
        k.line(0, -4, 0, 4, { lw: 1.2, ext: 0, bow: 0 });
        k.line(-4, 0, 4, 0, { lw: 1.2, ext: 0, bow: 0 });
        ctx.restore();
      }
      break;
    }
    case 'crow': {
      const jp = clamp(p / 0.5, 0, 1);
      base(ease(clamp((p - 0.5) / 0.5, 0, 1)) * 36, hop(jp, 14) - clamp((p - 0.5) / 0.5, 0, 1) * 26, 0, 1, 1, 'cheer');
      if (p < 0.5) drawApple(ctx, 18, -2, 4, { leaf: true });
      else drawApple(ctx, 6 + ease((p - 0.5) * 2) * 36, -14 - ease((p - 0.5) * 2) * 26, 4, { leaf: true });
      bubble(ctx, -4, -48, EGG_LINES.crow, p < 0.9 ? 1 : 0);
      break;
    }
    case 'manman': case 'haihai': {
      const down = Math.sin(clamp(p / 0.4, 0, 1) * Math.PI);
      base(0, 0, 0.1 * down, 1, 1 - 0.04 * down, 'catch');
      stamp(ctx, 14, -4 - (1 - down) * 18, 12, kind === 'manman' ? '合格' : '放行', p > 0.2 ? 1 : 0);
      bubble(ctx, 0, -60, EGG_LINES[kind], p > 0.5 && p < 0.95 ? 1 : 0);
      break;
    }
    case 'dudu': {
      const up = ease(clamp(p / 0.4, 0, 1)) * (1 - ease(clamp((p - 0.75) / 0.25, 0, 1)));
      base(0, -up * 24, Math.sin(p * 30) * 0.12 * up, 1, 1, 'cheer');
      if (up > 0) { // 光柱
        ctx.save(); ctx.globalAlpha *= 0.28 * up;
        ctx.fillStyle = '#e9f6f0';
        ctx.beginPath(); ctx.moveTo(-8, -70); ctx.lineTo(8, -70); ctx.lineTo(18, 2); ctx.lineTo(-18, 2); ctx.closePath(); ctx.fill();
        ctx.restore();
        stars(ctx, 0, -30 - up * 24, t, 4, 14);
      }
      bubble(ctx, 0, -66 - up * 24, EGG_LINES.dudu, up > 0.4 ? 1 : 0);
      break;
    }
    case 'doorman': {
      const bow = Math.sin(clamp(p / 0.6, 0, 1) * Math.PI);
      base(0, bow * 2, 0.5 * bow, 1, 1, 'idle');
      bubble(ctx, 0, -60, EGG_LINES.doorman, p > 0.2 && p < 0.9 ? 1 : 0);
      if (p > 0.3) sparkle(ctx, 18, -36, 3, F.gold, t * 3, true);
      break;
    }
    case 'duoduo': {
      base(0, 0, 0, 1, 1, 'cheer');
      for (let i = 0; i < 3; i++) {
        const u = clamp((p - i * 0.18) / 0.5, 0, 1);
        if (u > 0 && u < 1) orange(ctx, 10 + u * 34 * (1 + i * 0.2), -36 - Math.sin(u * Math.PI) * 24 + u * 28, 3.4);
      }
      bubble(ctx, 0, -64, EGG_LINES.duoduo, p > 0.2 && p < 0.95 ? 1 : 0);
      break;
    }
    case 'xu': {
      base(0, 0, 0, 1, 1, 'idle');
      bubble(ctx, 0, -64, EGG_LINES.xu, p > 0.1 && p < 0.9 ? 1 : 0);
      break;
    }
    default: {
      // 顾客:大妈叉腰晃头、小孩蹦跳转圈、西装拍手
      const jp = (p * (kind === 'cust2' ? 3 : 2)) % 1;
      base(0, kind === 'cust2' ? hop(jp, 8) : 0, kind === 'cust2' ? Math.sin(p * 30) * 0.05 : Math.sin(p * 18) * 0.07, 1, 1, 'cheer');
      bubble(ctx, 0, -60, EGG_LINES[kind], p > 0.1 && p < 0.9 ? 1 : 0);
      if (p > 0.4 && kind === 'cust3') for (let i = 0; i < 3; i++) { const u = (p * 2 + i / 3) % 1; ctx.save(); ctx.globalAlpha *= 1 - u; ctx.fillStyle = F.gold; ctx.font = 'bold 7px sans-serif'; ctx.fillText('¥', -16 + i * 14, -40 - u * 18); ctx.restore(); }
    }
  }
  ctx.restore();
};
export const drawEgg: ThingFn = (ctx, x, y, s, o = {}) => drawCharacterEgg(ctx, ((o.kind as CharKind) ?? 'newton'), x, y, s, o);
