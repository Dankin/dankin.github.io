// UI 框:九宫格(Canvas 手绘 → bake 位图 → 9 片拉伸)+ 按钮 / 图钉 / 11 个关卡图标(48²)。
// 面板/按钮坐标 = 左上角 (x,y) + 宽高 w,h(CSS px/世界单位);图标/图钉与全库一致:(x,y)=底部中心,s=缩放(1=48²)。
// 不使用 shadowBlur。线色 #1b1410。
import { drawApple } from './apple.ts';
import { bake, qOf } from './bake.ts';
import type { C } from './bake.ts';
import { cached } from './bake.ts';
import { F, INK, Ink, TAU, clamp, sparkle } from './ink.ts';
import type { ThingFn, ThingOpt } from './types.ts';

export type PanelKind = 'card' | 'top' | 'narr' | 'inv' | 'news';
export type ButtonTone = 'cream' | 'leaf' | 'wood' | 'apple';
export const PANEL_KINDS: PanelKind[] = ['card', 'top', 'narr', 'inv', 'news'];
export const PANEL_NAMES: Record<PanelKind, string> = { card: '底栏卡(木框羊皮纸)', top: '顶栏(石条)', narr: '旁白框(卷边羊皮纸+封蜡)', inv: '库存条', news: '新闻条' };

const FONT = '"Kaiti SC","STKaiti","KaiTi","PingFang SC",sans-serif';
export const UI_FONT = FONT;

interface PanelDef {
  /** 9 宫格切边宽 */
  inset: number;
  /** 源图尺寸 */
  sw: number;
  sh: number;
  /** 内容区内缩(给调用方排版:left/top/right/bottom) */
  pad: [number, number, number, number];
  draw: (g: C, w: number, h: number) => void;
}

const wood = (g: C, w: number, h: number, seed: number): void => {
  const k = new Ink(g, seed, 2.2, 0.28);
  k.rect(1.5, 1.5, w - 3, h - 3, { fill: F.wood, shade: F.shade2, lw: 2.5, r: 7 });
  k.rect(5.2, 5.2, w - 10.4, h - 10.4, { fill: F.woodDark, lw: 1.5, r: 4, j: 0.15 });
  // 木纹(只放在条带上,拉伸不变形)
  k.line(8, 3.4, w - 8, 3.4, { lw: 0.6, ext: 0, bow: 0.4 });
  k.line(8, h - 3.4, w - 8, h - 3.4, { lw: 0.6, ext: 0, bow: 0.4 });
};

const PANELS: Record<PanelKind, PanelDef> = {
  card: {
    inset: 14, sw: 52, sh: 52, pad: [11, 11, 11, 11],
    draw(g, w, h) {
      wood(g, w, h, 11);
      const k = new Ink(g, 12, 1.6, 0.2);
      k.rect(7.6, 7.6, w - 15.2, h - 15.2, { fill: F.cream, shade: F.shade, lw: 1.6, r: 2.4 });
      // 钉子
      for (const [x, y] of [[4.2, 4.2], [w - 4.2, 4.2], [4.2, h - 4.2], [w - 4.2, h - 4.2]] as const) {
        k.ell(x, y, 1.2, 1.2, { fill: F.gray3, lw: 0.8, j: 0.03 });
      }
      // 羊皮纸斑点
      g.fillStyle = 'rgba(150,120,70,0.12)';
      g.beginPath();
      g.ellipse(w * 0.3, h * 0.35, 8, 5, 0, 0, TAU);
      g.ellipse(w * 0.72, h * 0.66, 10, 6, 0, 0, TAU);
      g.fill();
    },
  },
  top: {
    inset: 10, sw: 40, sh: 32, pad: [8, 4, 8, 8],
    draw(g, w, h) {
      const k = new Ink(g, 21, 2.1, 0.25);
      k.rect(1.4, -4, w - 2.8, h + 2.6, { fill: F.gray, shade: F.shade2, lw: 2.3, r: 4 });
      k.line(3, h * 0.46, w - 3, h * 0.46, { lw: 1, ext: 0 });
      k.line(3, h - 7.4, w - 3, h - 7.4, { lw: 0.9, ext: 0 });
      // 砖缝(只在角部,拉伸安全)
      k.line(8, 3, 8, h * 0.46, { lw: 0.9, ext: 0, bow: 0 });
      k.line(w - 8, h * 0.46, w - 8, h - 7.4, { lw: 0.9, ext: 0, bow: 0 });
      k.line(3, h - 2.4, w - 3, h - 2.4, { lw: 1.2, ext: 0 });
    },
  },
  narr: {
    inset: 16, sw: 56, sh: 44, pad: [16, 9, 16, 9],
    draw(g, w, h) {
      const k = new Ink(g, 31, 2, 0.3);
      k.rect(6, 3.2, w - 12, h - 6.4, { fill: F.cream, shade: F.shade, lw: 1.9, r: 1.5 });
      // 卷边:左右两端
      for (const sd of [0, 1]) {
        const x0 = sd ? w - 11.5 : 1.5;
        k.rect(x0, 0.8, 10, h - 1.6, { fill: F.warm, shade: F.shade2, lw: 2, r: 4.6 });
        k.ell(x0 + 5, 4.6, 3.4, 2.1, { fill: F.cream, lw: 1.2, j: 0.05 });
        k.ell(x0 + 5, h - 4.6, 3.4, 2.1, { fill: F.cream, lw: 1.2, j: 0.05 });
        k.stroke([[x0 + 3.4, 10], [x0 + 5.6, 8.4], [x0 + 6.8, 11]], { lw: 0.8, smooth: true });
      }
      g.fillStyle = 'rgba(150,120,70,0.1)';
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.5, w * 0.3, h * 0.28, 0, 0, TAU);
      g.fill();
    },
  },
  inv: {
    inset: 10, sw: 36, sh: 32, pad: [7, 6, 7, 6],
    draw(g, w, h) {
      const k = new Ink(g, 41, 2.1, 0.22);
      k.rect(1.4, 1.4, w - 2.8, h - 2.8, { fill: F.woodDark, shade: F.shade2, lw: 2.2, r: 5 });
      k.rect(5, 5, w - 10, h - 10, { fill: F.cream, shade: F.shade, lw: 1.5, r: 2.6, j: 0.15 });
      k.line(6.4, 6.8, w - 6.4, 6.8, { lw: 0.7, ext: 0, bow: 0 });
    },
  },
  news: {
    inset: 10, sw: 40, sh: 30, pad: [9, 7, 9, 7],
    draw(g, w, h) {
      const k = new Ink(g, 51, 1.9, 0.2);
      k.rect(1.4, 1.4, w - 2.8, h - 2.8, { fill: F.white, shade: F.shade, lw: 2, r: 2 });
      k.rect(1.4, 1.4, w - 2.8, 4.6, { fill: F.gray2, lw: 1.4, r: 1.6 });
      k.line(4, h - 5.2, w - 4, h - 5.2, { lw: 0.9, ext: 0, bow: 0 });
      k.line(4, h - 3.4, w - 4, h - 3.4, { lw: 0.6, ext: 0, bow: 0 });
      // 折角
      k.poly([[w - 8, h - 1.4], [w - 1.4, h - 8], [w - 1.4, h - 1.4]], { fill: F.gray, lw: 1.1, j: 0.05 });
    },
  },
};

/** 按 inset 把 sw×sh 位图拆 9 片拉伸到 (x,y,w,h) */
function nine(ctx: C, key: string, d: { inset: number; sw: number; sh: number }, draw: (g: C, w: number, h: number) => void, x: number, y: number, w: number, h: number): void {
  const q = qOf(ctx, 1);
  const b = bake(key, [0, 0, d.sw, d.sh], q, (g) => draw(g, d.sw, d.sh));
  const c = b.c as CanvasImageSource;
  const i = d.inset, iq = i * q;
  w = Math.max(w, i * 2);
  h = Math.max(h, i * 2);
  const sx = [0, iq, d.sw * q - iq, d.sw * q];
  const sy = [0, iq, d.sh * q - iq, d.sh * q];
  const dx = [x, x + i, x + w - i, x + w];
  const dy = [y, y + i, y + h - i, y + h];
  for (let r = 0; r < 3; r++)
    for (let col = 0; col < 3; col++)
      ctx.drawImage(c, sx[col], sy[r], sx[col + 1] - sx[col], sy[r + 1] - sy[r], dx[col], dy[r], dx[col + 1] - dx[col], dy[r + 1] - dy[r]);
}

/** 画面板;(x,y)=左上角。返回内容区 [x,y,w,h] 方便排版。 */
export function drawPanel(ctx: C, kind: PanelKind, x: number, y: number, w: number, h: number, o: ThingOpt = {}): [number, number, number, number] {
  const d = PANELS[kind];
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  nine(ctx, `panel-${kind}`, d, d.draw, x, y, w, h);
  if (kind === 'narr' && o.seal !== false) drawSeal(ctx, x + w - 22, y + h - 6, 0.9, o);
  ctx.restore();
  const p = d.pad;
  return [x + p[0], y + p[1], w - p[0] - p[2], h - p[1] - p[3]];
}

/** 封蜡(旁白框右下) */
export function drawSeal(ctx: C, x: number, y: number, s = 1, o: ThingOpt = {}): void {
  cached(ctx, `seal|${o.seed ?? 1}`, [-9, -18, 9, 2], x, y, s, (g) => {
    const k = new Ink(g, o.seed ?? 1, 1.7, 0.3);
    // 蜡滴
    k.poly([[-6, -5], [-8.4, -2], [-5, -0.6], [-1, -3]], { fill: '#b83a34', lw: 1.3, smooth: true, j: 0.15 });
    k.poly([[8, -10], [8.6, -4], [5, -1.4], [2, -4]], { fill: '#b83a34', lw: 1.3, smooth: true, j: 0.15 });
    k.ell(0, -9.6, 7.8, 7.4, { fill: '#c9443d', shade: 'rgba(80,10,10,0.22)', lw: 1.8, j: 0.3 });
    k.ell(0, -9.6, 5, 4.7, { fill: '#c9443d', lw: 1, j: 0.2 });
    // 压印:苹果轮廓
    k.stroke([[0, -12.2], [2.6, -13], [4, -10.4], [2.6, -7], [0, -7.2], [-2.6, -7], [-4, -10.4], [-2.6, -13], [0, -12.2]], { lw: 0.9, smooth: true });
    k.line(0, -12.2, 0.6, -14.6, { lw: 0.8, ext: 0, bow: 0 });
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(-3.8, -13.6, 1.6, 1);
  });
}

/* ───────── 按钮 ───────── */
const TONES: Record<ButtonTone, [string, string]> = {
  cream: [F.cream, F.gray2],
  leaf: ['#c4de8e', '#7ea14c'],
  wood: ['#e0bb84', '#a8763f'],
  apple: ['#e4574c', '#8c2a24'],
};
const BTN = { inset: 9, sw: 30, sh: 28 };

function drawBtnSrc(tone: ButtonTone, pressed: boolean): (g: C, w: number, h: number) => void {
  return (g, w, h) => {
    const [face, base] = TONES[tone];
    const k = new Ink(g, 61 + tone.length, 2.3, 0.25);
    const dy = pressed ? 2 : 0;
    // 底(2px 深色底)
    k.rect(1.5, 3.4, w - 3, h - 4.8, { fill: base, lw: 2.3, r: 6 });
    // 面
    k.rect(1.5, 1.4 + dy, w - 3, h - 5.2 - dy * 0.0, { fill: face, shade: pressed ? F.shade : undefined, lw: 2.3, r: 6 });
    if (!pressed) {
      // 顶部高光线
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 1.5;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(7, 5.2);
      g.lineTo(w - 7, 5.2);
      g.stroke();
    }
  };
}

/** 按钮(左上角 x,y;h 含 2px 底)。label 居中;o.pressed 沉下 2px;o.tone 色调;o.disabled 变灰 */
export function drawButton(ctx: C, x: number, y: number, w: number, h: number, label = '', o: ThingOpt & { tone?: ButtonTone; disabled?: boolean; font?: number } = {}): void {
  const tone = (o.tone as ButtonTone | undefined) ?? 'cream';
  const pressed = !!o.pressed;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.disabled) ctx.globalAlpha *= 0.55;
  nine(ctx, `btn-${tone}-${pressed ? 1 : 0}`, BTN, drawBtnSrc(tone, pressed), x, y, w, h);
  if (label) {
    ctx.fillStyle = tone === 'apple' ? '#fffdf6' : INK;
    const fs = o.font ?? Math.max(10, Math.min(18, (h - 4) * 0.6));
    ctx.font = `700 ${fs}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + (h - 3) / 2 + (pressed ? 2 : 0) + 0.5);
  }
  ctx.restore();
}

/* ───────── 图钉 ───────── */
export const drawPin: ThingFn = (ctx, x, y, s, o = {}) => {
  const col = (o.col as string | undefined) ?? '#c9443d';
  cached(ctx, `pin|${col}|${o.seed ?? 1}`, [-6, -16, 6, 1], x, y, s, (g) => {
    const k = new Ink(g, o.seed ?? 1, 1.7, 0.18);
    k.line(0, -5, 0, -0.4, { lw: 1.5, ext: 0 }); // 针
    k.ell(0, -0.4, 3, 0.9, { fill: INK, lw: 0.4, j: 0.03, nostroke: true });
    k.rect(-3.2, -9, 6.4, 4, { fill: F.gray2, lw: 1.5, r: 1 });
    k.ell(0, -12.4, 5, 4.6, { fill: col, shade: 'rgba(80,10,10,0.2)', lw: 1.8, j: 0.15 });
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath();
    g.ellipse(-1.8, -14, 1.4, 0.9, -0.5, 0, TAU);
    g.fill();
  });
};

/* ───────── 11 个关卡图标(48²) ───────── */
export type IconId = 'belt' | 'glove' | 'chant' | 'brand' | 'wash' | 'wax' | 'juice' | 'pack' | 'cold' | 'rush' | 'string';
export const ICON_IDS: IconId[] = ['belt', 'glove', 'chant', 'brand', 'wash', 'wax', 'juice', 'pack', 'cold', 'rush', 'string'];
export const ICON_NAMES: Record<IconId, string> = {
  belt: '流水线', glove: '摇树手套', chant: '号子', brand: '品牌', wash: '洗果', wax: '打蜡', juice: '榨汁', pack: '包装', cold: '冷链', rush: '加急', string: '红绳',
};
/** content.ts 的 GateId 与图标的对应(red→string) */
export const GATE_ICON: Record<string, IconId> = {
  wash: 'wash', wax: 'wax', rush: 'rush', pack: 'pack', juice: 'juice', cold: 'cold', red: 'string', belt: 'belt', brand: 'brand', glove: 'glove', chant: 'chant',
};

function pic(id: IconId, g: C, k: Ink): void {
  const A = (x: number, y: number, r = 5, leaf = false): void => drawApple(g, x, y, r, { leaf });
  switch (id) {
    case 'belt': {
      k.rect(-17, -3, 34, 8, { fill: F.gray2, shade: F.shade2, lw: 2, r: 4 });
      for (let i = 0; i < 6; i++) k.line(-13 + i * 5.4, -1.6, -11.4 + i * 5.4, 3.6, { lw: 0.8, ext: 0, bow: 0 });
      k.ell(-12.6, 1, 3, 3, { fill: F.white, lw: 1.5, j: 0.05 });
      k.ell(12.6, 1, 3, 3, { fill: F.white, lw: 1.5, j: 0.05 });
      A(-9, -8, 5, true);
      A(2, -8, 5);
      A(13, -8, 4.2);
      k.line(-8, -17.6, 8, -17.6, { lw: 0, ext: 0 });
      break;
    }
    case 'glove': {
      k.poly([[-8, 12], [-10, 2], [-10.6, -8], [-7, -9], [-5.6, -1], [-5, -13], [-1.4, -14], [-0.8, -2], [0.6, -15], [4.4, -14], [3.8, -2], [6, -10], [9.4, -8], [7, 2], [11, 0], [12, 4], [6, 12]], {
        fill: F.cream, shade: F.shade2, smooth: true, lw: 2, j: 0.2,
      });
      k.rect(-9.6, 10.6, 17.6, 5.6, { fill: F.gray2, lw: 1.8, r: 1.4 });
      k.line(-6, 6, -1, 7.4, { lw: 0.9, ext: 0, bow: 0 });
      break;
    }
    case 'chant': {
      k.poly([[-16, -10], [-14, -15], [14, -15], [16, -10], [16, 4], [14, 8], [4, 8], [-3, 14], [-3, 8], [-14, 8], [-16, 4]], { fill: F.white, shade: F.shade, smooth: true, lw: 2, j: 0.2 });
      const g2 = g;
      g2.fillStyle = INK;
      g2.font = `700 12px ${FONT}`;
      g2.textAlign = 'center';
      g2.textBaseline = 'middle';
      g2.fillText('嘿哟', 0, -3.4);
      // 音符
      k.ell(14, -18, 2.4, 1.8, { fill: INK, lw: 0.6, j: 0.03 });
      k.line(16.2, -18, 16.2, -26, { lw: 1.4, ext: 0 });
      k.line(16.2, -26, 20, -24, { lw: 1.4, ext: 0 });
      break;
    }
    case 'brand': {
      k.poly([[-12, -14], [12, -14], [12, 6], [0, 14], [-12, 6]], { fill: F.cream, shade: F.shade, lw: 2.1, j: 0.25 });
      k.ell(0, -9.4, 1.6, 1.6, { fill: F.white, lw: 1.3, j: 0.05 });
      sparkle(g, 0, 2, 7, F.gold, 0, true);
      k.line(-8.6, -14, -8.6, -18.6, { lw: 1.2, ext: 0 });
      k.line(8.6, -14, 8.6, -18.6, { lw: 1.2, ext: 0 });
      break;
    }
    case 'wash': {
      k.poly([[-14, -4], [14, -4], [11, 12], [-11, 12]], { fill: F.water, shade: F.waterDark, lw: 2, j: 0.2 });
      A(-5, -4, 5, true);
      A(5, -5, 4.6);
      k.ell(0, -3.6, 14, 2.4, { fill: undefined, lw: 1.5, j: 0.1, a0: 0, a1: Math.PI });
      for (const [bx, by, br] of [[-9, -14, 2.4], [-1, -17, 1.8], [8, -13, 2.8], [13, -19, 1.6]] as const) k.ell(bx, by, br, br, { fill: F.white, lw: 1.3, j: 0.05 });
      break;
    }
    case 'wax': {
      A(0, 2, 11, true);
      sparkle(g, -8, -13, 4, F.white, 0.3, true);
      sparkle(g, 11, -8, 3, F.white, 0, true);
      sparkle(g, 9, 12, 2.4, F.white, 0.7, true);
      break;
    }
    case 'juice': {
      k.poly([[-9, -10], [9, -10], [7, 13], [-7, 13]], { fill: '#f1d9a0', shade: F.shade2, lw: 2, j: 0.2 });
      k.line(-8, -4, 8, -4, { lw: 1.1, ext: 0, bow: 0 });
      k.line(3, -10, 8, -20, { lw: 2.2, ext: 0 });
      // 苹果片
      k.ell(-9, -10, 6, 6, { fill: F.white, lw: 1.7, j: 0.1, a0: Math.PI, a1: TAU });
      k.ell(-9, -10, 3.2, 3.2, { fill: F.cream, lw: 1, j: 0.05, a0: Math.PI, a1: TAU });
      break;
    }
    case 'pack': {
      k.poly([[-13, -4], [0, -10], [13, -4], [13, 11], [0, 16], [-13, 11]], { fill: F.wood, shade: F.shade2, lw: 2, j: 0.25 });
      k.line(0, -10, 0, 16, { lw: 1.4, ext: 0, bow: 0 });
      k.line(-13, -4, 0, 2, { lw: 1.4, ext: 0, bow: 0 });
      k.line(13, -4, 0, 2, { lw: 1.4, ext: 0, bow: 0 });
      k.poly([[-3.4, -9], [3.4, -9], [3.4, 1.4], [-3.4, 1.4]], { fill: F.cream, lw: 1.2, j: 0.08 });
      A(0, -14, 4.6, true);
      break;
    }
    case 'cold': {
      // 雪花
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3 + Math.PI / 6;
        const dx = Math.cos(a) * 15, dy = Math.sin(a) * 15;
        k.line(-dx, -dy, dx, dy, { lw: 2, ext: 0 });
        for (const sd of [-1, 1]) {
          const bx = dx * 0.62 * sd, by = dy * 0.62 * sd;
          k.line(bx, by, bx + Math.cos(a + 1) * 4.6 * sd, by + Math.sin(a + 1) * 4.6 * sd, { lw: 1.5, ext: 0 });
          k.line(bx, by, bx + Math.cos(a - 1) * 4.6 * sd, by + Math.sin(a - 1) * 4.6 * sd, { lw: 1.5, ext: 0 });
        }
      }
      k.ell(0, 0, 3, 3, { fill: F.water, lw: 1.5, j: 0.05 });
      break;
    }
    case 'rush': {
      k.ell(0, 2, 13, 13, { fill: F.white, shade: F.shade, lw: 2.1, j: 0.2 });
      k.rect(-2.6, -14, 5.2, 3.6, { fill: F.gray2, lw: 1.5 });
      k.line(0, 2, 0, -7, { lw: 1.7, ext: 0 });
      k.line(0, 2, 6, 5, { lw: 1.7, ext: 0 });
      k.poly([[3, -3], [-3, 4], [0, 4], [-2, 11], [5, 2], [1.4, 2]], { fill: F.gold, lw: 1.3, j: 0.05 });
      for (let i = 0; i < 3; i++) k.line(-22, -4 + i * 6, -15 + (i % 2) * 2, -4 + i * 6, { lw: 1.4, ext: 0 });
      break;
    }
    case 'string': {
      k.ell(0, 4, 0, 0, { nostroke: true });
      A(0, 4, 10, true);
      // 红绳:绕苹果 + 蝴蝶结
      g.save();
      g.strokeStyle = '#7a2420';
      g.lineWidth = 3.4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-9.4, 2);
      g.quadraticCurveTo(0, 9, 9.4, 2);
      g.stroke();
      g.strokeStyle = '#e8c27a';
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(-9.4, 2);
      g.quadraticCurveTo(0, 9, 9.4, 2);
      g.stroke();
      g.restore();
      k.poly([[0, 5.6], [-8, 1], [-8, 10], [0, 6]], { fill: '#e8c27a', lw: 1.4, j: 0.08 });
      k.poly([[0, 5.6], [8, 1], [8, 10], [0, 6]], { fill: '#e8c27a', lw: 1.4, j: 0.08 });
      k.ell(0, 5.8, 2.2, 2.2, { fill: F.warm, lw: 1.3, j: 0.05 });
      k.stroke([[-1, 8], [-5, 15], [-7, 18]], { lw: 1.4, smooth: true });
      k.stroke([[1, 8], [5, 15], [8, 17]], { lw: 1.4, smooth: true });
      break;
    }
  }
}

/** 关卡图标:48² 圆章底 + 图案。(x,y)=底部中心;o.lit 高亮(已购);o.locked 变灰 */
export const drawIcon = (ctx: C, id: IconId, x: number, y: number, s: number, o: ThingOpt & { lit?: boolean; locked?: boolean } = {}): void => {
  const lit = !!o.lit, locked = !!o.locked;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (locked) ctx.globalAlpha *= 0.5;
  cached(ctx, `icon|${id}|${lit ? 1 : 0}`, [-24, -48, 24, 0], x, y, s, (g) => {
    const k = new Ink(g, 71 + ICON_IDS.indexOf(id) * 3, 2.2, 0.3);
    k.ell(0, -24, 22, 22, { fill: lit ? '#fbf1c9' : F.cream, shade: F.shade, lw: 2.5, j: 0.35 });
    k.ell(0, -24, 18.6, 18.6, { fill: undefined, lw: 0.9, j: 0.2 });
    g.save();
    g.translate(0, -24);
    g.scale(0.92, 0.92);
    pic(id, g, k);
    g.restore();
  });
  ctx.restore();
};
void clamp;
