/**
 * UI 手绘皮肤（art-char）。用法见 docs/art-assets.md「UI 皮肤」。
 *
 *   import { buildUiSkin, uiNine, UI_SCALE } from '../art/ui';
 *   buildUiSkin(this.textures);                       // Boot 里调用一次（幂等）
 *   const panel = uiNine(this, 'ui_panel_paper', 120, 90, 220, 200);   // 以“屏幕像素”给尺寸，内部处理 ×2 与 9-slice
 *   this.add.image(x, y, 'ui_ic_bell').setScale(UI_SCALE);             // 非 9-slice 的图一律 setScale(UI_SCALE)
 *
 * 所有 UI 纹理按 2× 位图绘制（UI_SS=2，设计单位=屏幕像素），显示时 setScale(0.5)，保证高 DPI / 全屏缩放时依然清晰。
 * 例外：ui_title_bg / ui_end_bg 为 960×540 屏幕像素的整屏插画（1920×1080 位图），同样 setScale(0.5)。
 */
import type Phaser from 'phaser';
import { mkc, paint, blob, stroke, dot, dark, light, mix, rgba, INK, INK_SOFT, rng, grain, halo, smooth, ellipsePts, Pt, Ctx } from './char/ink';
import { buildHat } from './hat';
import { buildCharFrames } from './chars';

export const UI_SS = 2;
export const UI_SCALE = 1 / UI_SS;

/** 9-slice 的切边（设计单位 = 屏幕像素） */
export const UI_NINE: Record<string, { l: number; r: number; t: number; b: number }> = {
  ui_panel_paper: { l: 22, r: 22, t: 22, b: 24 },
  ui_panel_note: { l: 18, r: 18, t: 18, b: 20 },
  ui_btn_on: { l: 16, r: 16, t: 16, b: 18 },
  ui_btn_cd: { l: 16, r: 16, t: 16, b: 18 },
  ui_btn_hi: { l: 16, r: 16, t: 16, b: 18 },
  ui_btn_down: { l: 16, r: 16, t: 16, b: 18 },
  ui_bubble_normal: { l: 20, r: 20, t: 18, b: 20 },
  ui_bubble_shout: { l: 20, r: 20, t: 18, b: 20 },
  ui_bubble_thought: { l: 20, r: 20, t: 18, b: 20 },
  ui_bar_frame: { l: 14, r: 14, t: 8, b: 8 },
  ui_map_frame: { l: 18, r: 18, t: 18, b: 18 },
  ui_toast: { l: 18, r: 18, t: 14, b: 16 },
};

/** 创建 9-slice（宽高以屏幕像素计，已自动 setScale(1/UI_SS)；默认 origin 0.5） */
export function uiNine(scene: Phaser.Scene, key: string, x: number, y: number, w: number, h: number) {
  const n = UI_NINE[key];
  const s = scene.add.nineslice(x, y, key, undefined, w * UI_SS, h * UI_SS, n.l * UI_SS, n.r * UI_SS, n.t * UI_SS, n.b * UI_SS);
  s.setScale(UI_SCALE);
  return s;
}
/** 已有 9-slice 改尺寸（屏幕像素） */
export function uiNineSize(s: Phaser.GameObjects.NineSlice, w: number, h: number) { s.setSize(w * UI_SS, h * UI_SS); return s; }

const KAI = "'Kaiti SC','STKaiti','Xingkai SC','Kaiti TC','KaiTi','Yuanti SC','PingFang SC',serif";
const HAND = "'Bradley Hand','Segoe Print','Snell Roundhand','Noteworthy','Marker Felt',cursive";

function T(w: number, h: number, draw: (x: Ctx) => void, o: { grain?: number; seed?: number; halo?: number } = {}): HTMLCanvasElement {
  const { c, x } = mkc(w * UI_SS, h * UI_SS); x.scale(UI_SS, UI_SS);
  draw(x);
  if (o.grain) { x.save(); x.setTransform(1, 0, 0, 1, 0, 0); grain(x, c.width, c.height, o.seed ?? 5, o.grain); x.restore(); }
  return o.halo ? halo(c, 'rgba(255,248,232,0.85)', o.halo * UI_SS) : c;
}

/** 圆角矩形的点列（给 paint 用，边上多取点，抖动才像手画） */
function rr(x0: number, y0: number, x1: number, y1: number, r: number, per = 3): Pt[] {
  const out: Pt[] = [];
  const arc = (cx: number, cy: number, a0: number) => { for (let i = 0; i <= 2; i++) { const a = a0 + (i / 2) * (Math.PI / 2); out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  const edge = (ax: number, ay: number, bx: number, by: number) => { for (let i = 1; i <= per; i++) { const t = i / (per + 1); out.push([ax + (bx - ax) * t, ay + (by - ay) * t]); } };
  arc(x0 + r, y0 + r, Math.PI); edge(x0 + r, y0, x1 - r, y0);
  arc(x1 - r, y0 + r, -Math.PI / 2); edge(x1, y0 + r, x1, y1 - r);
  arc(x1 - r, y1 - r, 0); edge(x1 - r, y1, x0 + r, y1);
  arc(x0 + r, y1 - r, Math.PI / 2); edge(x0, y1 - r, x0, y0 + r);
  return out;
}
function softShadow(x: Ctx, pts: Pt[], col = 'rgba(70,40,24,0.32)', blur = 5, dy = 2.5) {
  x.save(); x.shadowColor = col; x.shadowBlur = blur * UI_SS; x.shadowOffsetY = dy * UI_SS; x.shadowOffsetX = 1 * UI_SS;
  x.beginPath(); smooth(x, pts, true, 0.5); x.fillStyle = '#000'; x.fill(); x.restore();
}
/** 手写感虚线内框 */
function dashed(x: Ctx, pts: Pt[], col: string, w = 1, dash: number[] = [5, 4], alpha = 0.55) {
  x.save(); x.setLineDash(dash); x.strokeStyle = col; x.globalAlpha = alpha; x.lineWidth = w; x.beginPath(); smooth(x, pts, true, 0.5); x.stroke(); x.restore();
}

// ———————————————————— 面板 ————————————————————
function panelPaper(): HTMLCanvasElement {
  return T(96, 96, (x) => {
    const p = rr(8, 8, 88, 88, 6);
    softShadow(x, p);
    paint(x, p, '#fbf1d6', { seed: 101, lw: 1.5, wob: 0.55, t: 0.5, hi: 0.3, shade: 0.28 });
    // 纸张纤维 + 手写感虚线内框
    dashed(x, rr(15, 15, 81, 81, 4, 5), '#b98d68', 1, [6, 3.5], 0.5);
    const r = rng(7); for (let i = 0; i < 16; i++) { const px = 13 + r() * 70, py = 13 + r() * 70; stroke(x, [[px, py], [px + 3 + r() * 5, py + r() * 1.4 - 0.7]], 'rgba(170,130,90,0.16)', 0.8); }
  }, { grain: 0.07, seed: 11 });
}
function panelNote(): HTMLCanvasElement { // 小便签（提示 / toast 用）：偏黄，边缘更歪
  return T(72, 56, (x) => {
    const p = rr(6, 6, 66, 50, 4);
    softShadow(x, p, 'rgba(70,40,24,0.28)', 4, 2);
    paint(x, p, '#ffe9a8', { seed: 111, lw: 1.5, wob: 0.8, t: 0.5, hi: 0.35, shade: 0.25 });
    dashed(x, rr(11, 11, 61, 45, 3, 4), '#c49a52', 0.9, [4, 3], 0.45);
  }, { grain: 0.06, seed: 12 });
}
function toast(): HTMLCanvasElement {
  return T(72, 48, (x) => {
    const p = rr(5, 5, 67, 41, 12);
    softShadow(x, p, 'rgba(70,40,24,0.3)', 4, 2);
    paint(x, p, '#fff4d8', { seed: 112, lw: 1.5, wob: 0.5, hi: 0.5, shade: 0.2 });
  }, { grain: 0.05, seed: 13 });
}
function staple(): HTMLCanvasElement {
  return T(26, 16, (x) => {
    paint(x, [[3, 6], [23, 6], [23, 9.2], [3, 9.2]], '#cfd2d6', { seed: 1, lw: 1.1, wob: 0.15, t: 0.1, hi: 0.9, ink: '#5a5560' });
    paint(x, [[3, 6], [5.4, 6], [5.4, 13], [3, 13]], '#b4b8bd', { seed: 2, lw: 0.9, wob: 0.1, t: 0.05, ink: '#5a5560' });
    paint(x, [[20.6, 6], [23, 6], [23, 13], [20.6, 13]], '#b4b8bd', { seed: 3, lw: 0.9, wob: 0.1, t: 0.05, ink: '#5a5560' });
    stroke(x, [[6.4, 6.9], [14, 6.7]], '#fff', 0.9, { alpha: 0.9 });
  });
}
function tape(): HTMLCanvasElement { // 和纸胶带：半透明 + 锯齿端
  return T(56, 20, (x) => {
    const p: Pt[] = [[4, 3], [8, 5], [4, 8], [8, 11], [4, 14], [8, 17], [48, 17], [52, 14], [48, 11], [52, 8], [48, 5], [52, 3], [8, 3]];
    x.save(); x.globalAlpha = 0.82; paint(x, p, '#f6c76a', { seed: 5, lw: 0.9, wob: 0.15, t: 0.02, ink: 'rgba(140,90,40,0.6)', hi: 0.5, shade: 0.1 }); x.restore();
    x.save(); x.globalAlpha = 0.35; x.strokeStyle = '#fff'; x.lineWidth = 1.2; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(12 + i * 7, 4); x.lineTo(8 + i * 7, 16); x.stroke(); } x.restore();
  });
}
function curl(): HTMLCanvasElement { // 右下角卷边（放在面板右下角，origin (1,1)）
  return T(34, 34, (x) => {
    softShadow(x, [[4, 28], [28, 4], [30, 30]], 'rgba(60,30,20,0.4)', 4, 2);
    paint(x, [[3, 29], [27, 4], [30, 30]], '#eadab6', { seed: 8, lw: 1.3, wob: 0.2, t: 0.1, hi: 0.2, shade: 0.7 });
    stroke(x, [[7, 26], [25, 8]], 'rgba(255,248,222,0.8)', 1.4);
  }, { grain: 0.05, seed: 3 });
}
function checkBox(): HTMLCanvasElement {
  return T(22, 22, (x) => { paint(x, [[4, 4.5], [17.6, 3.8], [18.2, 17.4], [3.6, 18]], '#fffaf0', { seed: 3, lw: 1.5, wob: 0.5, t: 0.1, flat: true }); });
}
function checkTick(): HTMLCanvasElement {
  return T(28, 26, (x) => { stroke(x, [[5, 13], [11, 20], [23, 4]], rgba('#7a1f14', 0.35), 5, { alpha: 1 }); stroke(x, [[5, 12.5], [11, 19.5], [23, 3.6]], '#d8382f', 3.4); stroke(x, [[5.4, 12], [10.6, 18]], '#ff8a78', 1, { alpha: 0.7 }); });
}
function strike(): HTMLCanvasElement { // 手画删除线，横向拉伸用
  return T(96, 10, (x) => { stroke(x, [[3, 5.4], [26, 4], [52, 5.6], [76, 4.2], [93, 5]], 'rgba(120,70,50,0.8)', 2.2); });
}

// ———————————————————— 按钮 ————————————————————
function btn(kind: 'on' | 'cd' | 'hi' | 'down'): HTMLCanvasElement {
  return T(72, 56, (x) => {
    const dy = kind === 'down' ? 2.2 : 0;
    const body = rr(7, 6 + dy, 65, 48 + dy - (kind === 'down' ? 0 : 0), 11);
    if (kind === 'hi') { x.save(); const g = x.createRadialGradient(36, 28, 10, 36, 28, 40); g.addColorStop(0, 'rgba(255,230,140,0.85)'); g.addColorStop(1, 'rgba(255,200,90,0)'); x.fillStyle = g; x.fillRect(0, 0, 72, 56); x.restore(); }
    if (kind !== 'down') softShadow(x, rr(7, 8, 65, 50, 11), 'rgba(70,40,24,0.35)', 3, 2);
    const base = kind === 'cd' ? '#d9d6cf' : kind === 'hi' ? '#ffe48a' : '#fff1ce';
    const lip = kind === 'cd' ? '#b9b8b6' : kind === 'hi' ? '#e8b648' : '#e6c98c';
    // 下沿“厚度”
    if (kind !== 'down') paint(x, rr(7, 10, 65, 50, 11), lip, { seed: 130, lw: 1.4, wob: 0.3, flat: true });
    paint(x, body, base, { seed: 131 + kind.length, lw: kind === 'hi' ? 1.9 : 1.5, wob: 0.4, hi: kind === 'cd' ? 0.1 : 0.7, shade: kind === 'cd' ? 0.6 : 0.3, ink: kind === 'hi' ? '#8a4a14' : kind === 'cd' ? '#8a8480' : undefined });
    if (kind === 'cd') { dashed(x, rr(12, 12 + dy, 60, 42 + dy, 7, 4), '#8a8480', 1, [3, 3], 0.7); }
    else dashed(x, rr(12, 12 + dy, 60, 42 + dy, 7, 4), kind === 'hi' ? '#c9852c' : '#c09a6a', 0.9, [4, 3], 0.5);
    if (kind === 'hi') for (const [px, py, r] of [[10, 9, 3.2], [62, 12, 2.4], [58, 44, 2.8]] as const) { stroke(x, [[px - r, py], [px + r, py]], '#fff6c8', 1.1); stroke(x, [[px, py - r], [px, py + r]], '#fff6c8', 1.1); }
  }, { grain: kind === 'cd' ? 0.08 : 0.05, seed: 20 });
}

// ———————————————————— 气泡 ————————————————————
type Tone = 'normal' | 'shout' | 'thought';
const TONE: Record<Tone, { fill: string; ink: string; lw: number; wob: number }> = {
  normal: { fill: '#fffaf0', ink: '#5a4638', lw: 1.5, wob: 0.45 },
  shout: { fill: '#fff0b8', ink: '#8a2a1c', lw: 2.4, wob: 1.1 },
  thought: { fill: '#f1edff', ink: '#6a5a8a', lw: 1.4, wob: 0.5 },
};
function bubble(tone: Tone): HTMLCanvasElement {
  const t = TONE[tone];
  return T(72, 56, (x) => {
    const p = tone === 'shout' ? spiky(36, 28, 29, 21, 16, 3.2, 21) : rr(6, 6, 66, 50, 14);
    softShadow(x, p, 'rgba(70,40,24,0.22)', 3, 2);
    if (tone === 'thought') {
      paint(x, p, t.fill, { seed: 141, lw: 0.1, wob: t.wob, hi: 0.4, shade: 0.2, ink: false });
      x.save(); x.setLineDash([6, 3.6]); x.strokeStyle = t.ink; x.lineWidth = 1.7; x.beginPath(); smooth(x, p, true, 0.5); x.stroke(); x.restore();
    } else paint(x, p, t.fill, { seed: 140 + tone.length, lw: t.lw, wob: t.wob, t: tone === 'shout' ? 0.05 : 0.5, hi: 0.5, shade: 0.2, ink: t.ink });
  }, { grain: 0.04, seed: 21 });
}
function spiky(cx: number, cy: number, rx: number, ry: number, n: number, d: number, seed: number): Pt[] {
  const r = rng(seed); const out: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2; const k = i % 2 ? 1 : 1 + d / Math.max(rx, ry) * (0.8 + r() * 0.5);
    // 超椭圆：更接近圆角矩形的轮廓
    const c = Math.cos(a), s = Math.sin(a); const sx = Math.sign(c) * Math.pow(Math.abs(c), 0.55), sy = Math.sign(s) * Math.pow(Math.abs(s), 0.55);
    out.push([cx + sx * rx * k, cy + sy * ry * k]);
  }
  return out;
}
function bubbleTail(tone: Tone): HTMLCanvasElement {
  const t = TONE[tone];
  return T(30, 28, (x) => {
    if (tone === 'thought') {
      for (const [px, py, r] of [[13, 5, 4.2], [10, 14, 3], [8, 21, 2]] as const) {
        paint(x, ellipsePts(px, py, r, r * 0.92, 9), t.fill, { seed: px, lw: 1.2, wob: 0.15, ink: t.ink, flat: true });
      }
      return;
    }
    const tail: Pt[] = tone === 'shout'
      ? [[7, 1], [20, 1], [15, 8], [22, 12], [11, 14], [8, 24], [6, 13], [1, 9], [8, 7]]
      : [[7, 1.5], [21, 1.5], [14, 11], [9, 24], [10, 12], [6, 6]];
    paint(x, tail, t.fill, { seed: 150, lw: t.lw, wob: tone === 'shout' ? 0.2 : 0.35, t: tone === 'shout' ? 0.03 : 0.3, flat: true, ink: t.ink });
    // 盖掉尾巴顶边，使其和气泡主体连成一块
    x.fillStyle = t.fill; x.fillRect(8.5, -0.5, 11.5, 4);
  });
}

// ———————————————————— 暖意条 / 小地图 ————————————————————
function barFrame(): HTMLCanvasElement {
  return T(120, 28, (x) => {
    const p = rr(3, 3, 117, 25, 11);
    softShadow(x, p, 'rgba(70,40,24,0.3)', 3, 1.8);
    paint(x, p, '#fbefd0', { seed: 161, lw: 1.6, wob: 0.4, hi: 0.5, shade: 0.25 });
    paint(x, rr(7, 7, 113, 21, 7, 4), '#7a5238', { seed: 162, lw: 0.9, wob: 0.25, flat: true, ink: '#3a2418' });
    stroke(x, [[10, 8.8], [60, 8.2], [108, 8.9]], 'rgba(255,230,190,0.25)', 1);
  }, { grain: 0.05, seed: 24 });
}
function barFill(): HTMLCanvasElement {
  return T(256, 14, (x) => {
    const g = x.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, '#ff7a4a'); g.addColorStop(0.55, '#ffb347'); g.addColorStop(1, '#ffe27a');
    x.fillStyle = g; x.beginPath(); smooth(x, rr(0, 1, 256, 13, 5, 10), true, 0.4); x.fill();
    const gg = x.createLinearGradient(0, 0, 0, 14); gg.addColorStop(0, 'rgba(255,248,220,0.55)'); gg.addColorStop(0.5, 'rgba(255,248,220,0)'); gg.addColorStop(1, 'rgba(160,60,20,0.3)');
    x.fillStyle = gg; x.fillRect(0, 0, 256, 14);
    const r = rng(9); for (let i = 0; i < 22; i++) { const px = r() * 250; stroke(x, [[px, 3 + r() * 6], [px + 6 + r() * 8, 3 + r() * 6]], 'rgba(255,255,255,0.22)', 1); }
  }, { grain: 0.05, seed: 26 });
}
function barIcon(): HTMLCanvasElement { // 暖意 = 一团小火 / 暖阳
  return T(34, 38, (x) => {
    paint(x, [[17, 3], [25, 14], [27, 24], [22, 33], [12, 33], [7, 25], [9, 15], [14, 18], [14, 10]], '#ff8a3c', { seed: 3, lw: 1.5, wob: 0.3, hi: 0.5, shade: 0.4 });
    paint(x, [[17, 15], [22, 24], [20, 31], [14, 31], [12, 24]], '#ffd24a', { seed: 4, lw: 1, wob: 0.2, hi: 0.7, ink: '#a9561a' });
    paint(x, [[17, 24], [19.5, 29], [14.6, 29]], '#fff6c8', { seed: 5, lw: 0.6, wob: 0.1, flat: true, ink: false });
  }, { halo: 1.2 });
}
function mapFrame(): HTMLCanvasElement {
  return T(96, 72, (x) => {
    const outer = rr(5, 5, 91, 67, 7), inner = rr(17, 17, 79, 55, 3);
    softShadow(x, outer, 'rgba(70,40,24,0.4)', 5, 2.5);
    paint(x, outer, '#b98a5a', { seed: 171, lw: 1.7, wob: 0.45, hi: 0.6, shade: 0.5 });
    // 木纹
    const r = rng(4); for (let i = 0; i < 10; i++) { const py = 7 + r() * 58; stroke(x, [[8, py], [30 + r() * 20, py + r() * 2 - 1], [88, py + r() * 3 - 1.5]], 'rgba(90,50,24,0.22)', 0.9); }
    // 镂空 + 内沿
    x.save(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); smooth(x, inner, true, 0.3); x.fill(); x.restore();
    x.save(); x.strokeStyle = INK; x.lineWidth = 1.7; x.beginPath(); smooth(x, inner, true, 0.3); x.stroke(); x.restore();
    stroke(x, [[19, 55.4], [60, 56], [78, 55.2]], 'rgba(255,230,180,0.6)', 1.2);
    for (const [px, py] of [[11, 11], [85, 11], [11, 61], [85, 61]] as const) { dot(x, px, py, 2.4, '#e9c25a', INK); dot(x, px - 0.7, py - 0.7, 0.8, '#fff6d0'); }
  }, { grain: 0.07, seed: 27 });
}
function hintArrow(): HTMLCanvasElement {
  return T(40, 52, (x) => {
    paint(x, [[14, 2], [26, 2.4], [26.6, 22], [34, 22], [20, 46], [6, 22], [13.4, 22]], '#ffd24a', { seed: 5, lw: 1.8, wob: 0.35, t: 0.06, hi: 0.8, hiAt: [0.3, 0.2], shade: 0.5 });
    stroke(x, [[17, 6], [17.4, 20]], '#fff6c8', 1.4, { alpha: 0.9 });
  }, { halo: 1.4 });
}
function pulseRing(): HTMLCanvasElement {
  return T(72, 72, (x) => { x.save(); x.setLineDash([9, 5]); x.strokeStyle = INK; x.lineWidth = 4; x.beginPath(); smooth(x, ellipsePts(36, 36, 28, 28, 14), true, 0.5); x.stroke(); x.strokeStyle = '#ffd24a'; x.lineWidth = 2.4; x.stroke(); x.restore(); });
}

// ———————————————————— 图标（招式 / 常用） ————————————————————
const IC = 44;
const ic = (d: (x: Ctx) => void) => T(IC, IC, d, { halo: 1.2 });
const ICONS: Record<string, () => HTMLCanvasElement> = {
  ui_ic_bell: () => ic((x) => {
    paint(x, [[22, 6], [30, 11], [32, 22], [37, 31], [7, 31], [12, 22], [14, 11]], '#f2c23c', { seed: 1, lw: 1.5, wob: 0.3, hi: 0.8, hiAt: [0.32, 0.3] });
    dot(x, 22, 4.8, 2.2, '#f2c23c', INK); dot(x, 22, 36, 3.4, '#b8801c', INK); stroke(x, [[14, 28.6], [30, 28.6]], 'rgba(120,70,10,0.6)', 1.2); stroke(x, [[16, 14], [15.4, 21]], '#fff6c8', 1.6, { alpha: 0.9 });
  }),
  ui_ic_balloon: () => ic((x) => {
    stroke(x, [[22, 31], [19, 36], [24, 40], [21, 43]], INK_SOFT, 1.2);
    paint(x, [[22, 31], [18.6, 35], [25.4, 35]], '#d8382f', { seed: 2, lw: 1.2, wob: 0.1, flat: true });
    blob(x, 22, 17, 12, 14.4, '#ff5a6e', { seed: 3, lw: 1.6, n: 12, hi: 0.9, hiAt: [0.3, 0.26] });
  }),
  ui_ic_pop: () => ic((x) => {
    const p: Pt[] = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 9 : 19; p.push([22 + Math.cos(a) * r, 22 + Math.sin(a) * r]); }
    paint(x, p, '#ffd24a', { seed: 4, lw: 1.5, wob: 0.3, t: 0.04, hi: 0.7 });
    paint(x, p.map(([a, b]) => [22 + (a - 22) * 0.55, 22 + (b - 22) * 0.55] as Pt), '#ff7a4a', { seed: 5, lw: 0.9, wob: 0.2, t: 0.04, flat: true, ink: false });
  }),
  ui_ic_speaker_soft: () => ic((x) => { speaker(x, 1); stroke(x, [[32, 15], [32, 28]], INK, 3.6); stroke(x, [[32, 15], [32, 28]], '#9a7ad8', 2); dot(x, 29.8, 29, 2.8, '#9a7ad8', INK); }),
  ui_ic_speaker_loud: () => ic((x) => { speaker(x, 3); }),
  ui_ic_lamp: () => ic((x) => {
    x.save(); const g = x.createRadialGradient(22, 18, 2, 22, 18, 22); g.addColorStop(0, 'rgba(255,236,150,0.9)'); g.addColorStop(1, 'rgba(255,210,100,0)'); x.fillStyle = g; x.fillRect(0, 0, IC, IC); x.restore();
    blob(x, 22, 17, 9.6, 10.6, '#ffe27a', { seed: 6, lw: 1.5, n: 11, hi: 0.9, hiAt: [0.3, 0.28] });
    paint(x, [[16, 25], [28, 25], [27, 31], [17, 31]], '#8a7a6a', { seed: 7, lw: 1.3, wob: 0.15, hi: 0.5 }); stroke(x, [[17, 28], [27, 28]], INK, 1);
    paint(x, [[17, 31], [27, 31], [25, 36], [19, 36]], '#5a4a40', { seed: 8, lw: 1.2, wob: 0.1, flat: true });
  }),
  ui_ic_snowman: () => ic((x) => {
    blob(x, 22, 30, 11.5, 10.4, '#fffaf2', { seed: 9, lw: 1.5, n: 11, shade: 0.6 }); blob(x, 22, 14, 8, 7.8, '#fffaf2', { seed: 10, lw: 1.5, n: 10, shade: 0.6 });
    paint(x, [[14, 8.6], [30, 8.4], [28, 4], [24, 2.6], [20, 2.6], [16, 4]], '#3a3a4a', { seed: 11, lw: 1.2, wob: 0.15, flat: true }); stroke(x, [[13, 8.6], [31, 8.4]], INK, 1.6);
    paint(x, [[22, 14.4], [31, 16], [22, 17]], '#ff8a2a', { seed: 12, lw: 1, wob: 0.1, flat: true });
    dot(x, 19, 12.4, 1.1, INK); dot(x, 25, 12.4, 1.1, INK); for (const py of [25, 30, 35]) dot(x, 22, py, 1.2, INK);
    stroke(x, [[13, 19.8], [31, 19.8]], '#d8382f', 3);
  }),
  ui_ic_tree: () => ic((x) => {
    paint(x, [[19.6, 33], [24.4, 33], [24.4, 41], [19.6, 41]], '#8a5a34', { seed: 13, lw: 1.2, wob: 0.15, flat: true });
    for (const [y0, y1, hw, s] of [[20, 35, 15, 14], [11, 25, 12, 15], [4, 16, 8.4, 16]] as const) paint(x, [[22, y0 - (y1 - y0) * 0.7], [22 + hw, y1], [22 - hw, y1]], '#3f9a58', { seed: s, lw: 1.5, wob: 0.3, t: 0.12, hi: 0.7, shade: 0.5 });
    for (const [px, py, c] of [[17, 27, '#ff5a6e'], [27, 22, '#ffd24a'], [20, 15, '#6fb8ff'], [25, 31, '#ffd24a'], [14, 33, '#ffd24a'], [29, 32, '#ff5a6e']] as const) dot(x, px, py, 1.8, c, INK);
    const s: Pt[] = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 2.2 : 5; s.push([22 + Math.cos(a) * r, 2.8 + Math.sin(a) * r]); } paint(x, s, '#ffe27a', { seed: 17, lw: 0.9, wob: 0.1, t: 0.04, flat: true });
  }),
  ui_ic_mail: () => ic((x) => {
    paint(x, [[5, 11], [39, 10], [40, 34], [4, 35]], '#fffaf0', { seed: 18, lw: 1.6, wob: 0.35, t: 0.1, hi: 0.5 });
    stroke(x, [[5.4, 11.4], [22, 24], [39, 10.6]], INK, 1.5); stroke(x, [[5, 34.6], [17, 22.4]], INK_SOFT, 1); stroke(x, [[39.4, 34], [27, 22.4]], INK_SOFT, 1);
    paint(x, [[22, 31], [17.6, 26.6], [18.2, 23.6], [22, 24.6], [25.8, 23.6], [26.4, 26.6]], '#d8382f', { seed: 19, lw: 1, wob: 0.12, flat: true });
  }),
  ui_ic_cat: () => ic((x) => {
    paint(x, [[7, 20], [8, 5], [16, 11], [28, 11], [36, 5], [37, 20], [34, 33], [22, 38], [10, 33]], '#f0a64a', { seed: 20, lw: 1.6, wob: 0.3, t: 0.15, hi: 0.7, shade: 0.5 });
    for (const sx of [-1, 1]) { paint(x, [[22 + sx * 12.6, 7.4], [22 + sx * 9.6, 12], [22 + sx * 15, 14]], '#ffb8b0', { seed: 21, lw: 0.8, wob: 0.1, flat: true, ink: false }); blob(x, 22 + sx * 7.4, 21, 2.4, 3, '#2a1c18', { seed: 22 + sx, lw: 0, n: 8, flat: true }); dot(x, 22 + sx * 7.4 - 0.7, 19.6, 0.9, '#fff'); stroke(x, [[22 + sx * 11, 27], [22 + sx * 20, 25.6]], INK, 0.9); stroke(x, [[22 + sx * 11, 29.6], [22 + sx * 20, 31]], INK, 0.9); }
    paint(x, [[19.6, 26], [24.4, 26], [22, 28.8]], '#d8586a', { seed: 24, lw: 0.8, wob: 0.05, flat: true }); stroke(x, [[22, 28.8], [20, 31], [17.6, 30]], INK, 0.9); stroke(x, [[22, 28.8], [24, 31], [26.4, 30]], INK, 0.9);
  }),
  ui_ic_hat: () => T(IC, IC, (x) => { const h = buildHat(1, 'happy'); x.drawImage(h, 2, 6, 40, 30); }, {}),
  ui_ic_heart: () => ic((x) => { paint(x, [[22, 38], [8, 25], [5, 15], [9, 8], [16, 7], [22, 13], [28, 7], [35, 8], [39, 15], [36, 25]], '#ff5a6e', { seed: 25, lw: 1.6, wob: 0.3, hi: 0.9, hiAt: [0.3, 0.3] }); }),
  ui_ic_close: () => ic((x) => { stroke(x, [[11, 11], [33, 33]], INK, 5.4); stroke(x, [[33, 11], [11, 33]], INK, 5.4); stroke(x, [[11, 11], [33, 33]], '#fff4d8', 2.6); stroke(x, [[33, 11], [11, 33]], '#fff4d8', 2.6); }),
  ui_ic_lock: () => ic((x) => { stroke(x, [[14, 20], [14, 12], [22, 6], [30, 12], [30, 20]], INK, 5); stroke(x, [[14, 20], [14, 12], [22, 6], [30, 12], [30, 20]], '#b8b4ae', 2.6); paint(x, [[9, 20], [35, 20], [35, 38], [9, 38]], '#e8c46a', { seed: 26, lw: 1.5, wob: 0.2, t: 0.12, hi: 0.7 }); dot(x, 22, 28, 2.4, INK); stroke(x, [[22, 29], [22, 33]], INK, 1.8); }),
};
function speaker(x: Ctx, waves: number) {
  paint(x, [[6, 15], [14, 15], [24, 7], [24, 37], [14, 29], [6, 29]], '#8a6a4a', { seed: 30, lw: 1.5, wob: 0.2, t: 0.1, hi: 0.6 });
  stroke(x, [[9, 17], [14, 17]], '#e9c9a0', 1.3);
  if (waves === 3) for (let k = 0; k < 3; k++) { const R = 6 + k * 5; x.beginPath(); for (let i = 0; i <= 10; i++) { const a = -0.9 + (1.8 * i) / 10; const px = 24 + Math.cos(a) * R, py = 22 + Math.sin(a) * R * 1.4; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.strokeStyle = INK; x.lineWidth = 3.4 - k * 0.4; x.stroke(); x.strokeStyle = k === 2 ? '#fff0b8' : '#ffd24a'; x.lineWidth = 1.9 - k * 0.3; x.stroke(); }
}

// ———————————————————— 整屏插画 ————————————————————
function sky(x: Ctx, w: number, h: number, stops: [number, string][]) {
  const g = x.createLinearGradient(0, 0, 0, h); for (const [t, c] of stops) g.addColorStop(t, c); x.fillStyle = g; x.fillRect(0, 0, w, h);
}
function hill(x: Ctx, y: number, amp: number, col: string, seed: number, w = 960, h = 540, lw = 1.4) {
  const r = rng(seed); const pts: Pt[] = [[-20, h + 20]]; for (let i = 0; i <= 10; i++) pts.push([-20 + (w + 40) * (i / 10), y + Math.sin(i * 0.9 + seed) * amp + (r() - 0.5) * amp * 0.4]); pts.push([w + 20, h + 20]);
  paint(x, pts, col, { seed, lw, wob: 0.8, t: 0.5, hi: 0.3, shade: 0.3 });
}
function house(x: Ctx, cx: number, gy: number, w: number, h: number, wall: string, roof: string, seed: number, lit = true) {
  const x0 = cx - w / 2;
  paint(x, [[x0, gy], [x0 + w, gy], [x0 + w, gy - h], [x0, gy - h]], wall, { seed, lw: 1.6, wob: 0.6, t: 0.1, hi: 0.4, shade: 0.5 });
  paint(x, [[x0 - 6, gy - h + 2], [cx, gy - h - w * 0.42], [x0 + w + 6, gy - h + 2]], roof, { seed: seed + 1, lw: 1.6, wob: 0.6, t: 0.08, hi: 0.5, shade: 0.5 });
  // 屋顶积雪
  paint(x, [[x0 - 7, gy - h + 3], [x0 - 2, gy - h - w * 0.15], [cx, gy - h - w * 0.46], [x0 + w + 2, gy - h - w * 0.15], [x0 + w + 7, gy - h + 3], [x0 + w * 0.8, gy - h - 2], [cx + w * 0.1, gy - h + 1], [x0 + w * 0.3, gy - h - 2]], '#fffaf2', { seed: seed + 2, lw: 1.2, wob: 0.5, t: 0.2, shade: 0.4 });
  const dw = w * 0.22; paint(x, [[cx - dw / 2, gy], [cx + dw / 2, gy], [cx + dw / 2, gy - h * 0.46], [cx - dw / 2, gy - h * 0.46]], '#7a4a2e', { seed: seed + 3, lw: 1.2, wob: 0.3, t: 0.1, flat: true });
  for (const sx of [-1, 1]) { const wx = cx + sx * w * 0.3; paint(x, [[wx - w * 0.09, gy - h * 0.78], [wx + w * 0.09, gy - h * 0.78], [wx + w * 0.09, gy - h * 0.5], [wx - w * 0.09, gy - h * 0.5]], lit ? '#ffd86a' : '#9ab0c8', { seed: seed + 4 + sx, lw: 1.2, wob: 0.2, t: 0.1, flat: true }); if (lit) { x.save(); const g = x.createRadialGradient(wx, gy - h * 0.64, 2, wx, gy - h * 0.64, w * 0.4); g.addColorStop(0, 'rgba(255,214,110,0.4)'); g.addColorStop(1, 'rgba(255,214,110,0)'); x.fillStyle = g; x.fillRect(wx - w * 0.4, gy - h * 0.64 - w * 0.4, w * 0.8, w * 0.8); x.restore(); } }
}
function bigTree(x: Ctx, cx: number, gy: number, s: number, seed: number, lights = true) {
  paint(x, [[cx - 7 * s, gy], [cx + 7 * s, gy], [cx + 6 * s, gy - 22 * s], [cx - 6 * s, gy - 22 * s]], '#8a5a34', { seed, lw: 1.5, wob: 0.4, flat: true });
  const tiers = [[gy - 14 * s, gy - 62 * s, 54 * s], [gy - 50 * s, gy - 108 * s, 44 * s], [gy - 94 * s, gy - 150 * s, 34 * s], [gy - 136 * s, gy - 190 * s, 24 * s]] as const;
  tiers.forEach(([yb, yt, hw], i) => paint(x, [[cx, yt - 10 * s], [cx + hw * 0.6, yt + (yb - yt) * 0.5], [cx + hw, yb], [cx + hw * 0.4, yb - 5 * s], [cx, yb + 2 * s], [cx - hw * 0.4, yb - 5 * s], [cx - hw, yb], [cx - hw * 0.6, yt + (yb - yt) * 0.5]], i % 2 ? '#3f9a58' : '#37895a', { seed: seed + i, lw: 1.7, wob: 0.8, t: 0.1, hi: 0.7, shade: 0.55 }));
  const st: Pt[] = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 6 * s : 14 * s; st.push([cx + Math.cos(a) * r, gy - 200 * s + Math.sin(a) * r]); }
  paint(x, st, '#ffd84a', { seed: seed + 9, lw: 1.4, wob: 0.3, t: 0.04, hi: 0.9 });
  if (lights) { const r = rng(seed); const cols = ['#ff5a4a', '#ffd84a', '#6fb8ff', '#6fd36a']; for (let i = 0; i < 26; i++) { const t = r(); const yy = gy - 30 * s - t * 150 * s; const hw = (54 - t * 36) * s * 0.78; const px = cx + (r() * 2 - 1) * hw; x.save(); const g = x.createRadialGradient(px, yy, 0, px, yy, 11 * s); g.addColorStop(0, 'rgba(255,236,160,0.7)'); g.addColorStop(1, 'rgba(255,236,160,0)'); x.fillStyle = g; x.fillRect(px - 12 * s, yy - 12 * s, 24 * s, 24 * s); x.restore(); dot(x, px, yy, 2.6 * s, cols[i % 4], INK); } }
}
function snowFlakes(x: Ctx, w: number, h: number, n: number, seed: number, maxR = 3) {
  const r = rng(seed); for (let i = 0; i < n; i++) { const px = r() * w, py = r() * h, rr_ = 0.8 + r() * maxR; x.fillStyle = `rgba(255,255,255,${0.45 + r() * 0.5})`; x.beginPath(); x.arc(px, py, rr_, 0, 7); x.fill(); }
}
const FRAME_CACHE: Record<string, Record<string, HTMLCanvasElement>> = {};
function placeChar(x: Ctx, id: string, cx: number, gy: number, k: number, key = 'idle_0', flip = false) {
  const fs = (FRAME_CACHE[id] ??= buildCharFrames(id)); const fr = fs[key] ?? fs['idle_0']; const w = fr.width / 3 * k * 1.3, h = fr.height / 3 * k * 1.3;
  x.save(); x.translate(cx, gy); if (flip) x.scale(-1, 1);
  x.fillStyle = 'rgba(70,50,90,0.22)'; x.beginPath(); x.ellipse(0, -1, w * 0.3, w * 0.07, 0, 0, 7); x.fill();
  x.drawImage(fr, -w / 2, -h + 2, w, h); x.restore();
}

function titleBg(): HTMLCanvasElement {
  return T(960, 540, (x) => {
    sky(x, 960, 540, [[0, '#8aa4d8'], [0.38, '#f6c4b0'], [0.62, '#ffe2b8'], [1, '#fff3d8']]);
    // 初升的太阳
    x.save(); const g = x.createRadialGradient(700, 300, 6, 700, 300, 230); g.addColorStop(0, 'rgba(255,248,214,1)'); g.addColorStop(0.3, 'rgba(255,226,160,0.6)'); g.addColorStop(1, 'rgba(255,214,150,0)'); x.fillStyle = g; x.fillRect(430, 70, 540, 460); x.restore();
    hill(x, 330, 14, '#c8b6d8', 3); hill(x, 372, 14, '#e8d6dc', 4);
    for (const [cx, w, h, wl, rf, s] of [[110, 74, 52, '#f2d6b0', '#c25a4a', 40], [220, 60, 44, '#e8c6a0', '#5a7aa8', 44], [800, 84, 58, '#f4dcb8', '#b8604a', 48], [900, 62, 46, '#ead0aa', '#6a8a6a', 52], [330, 56, 40, '#f0d2ac', '#a85a6a', 56]] as const) house(x, cx, 395 + (cx % 7), w, h, wl, rf, s);
    // 烟囱烟
    x.save(); x.fillStyle = 'rgba(255,250,240,0.55)'; for (const [px, py, r] of [[132, 322, 7], [140, 308, 9], [150, 292, 11], [818, 318, 8], [826, 302, 10]] as const) { x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); } x.restore();
    hill(x, 410, 10, '#fffaf2', 6); hill(x, 462, 12, '#ffffff', 7, 960, 540, 1.6);
    bigTree(x, 640, 470, 1.18, 60);
    // 角色小剧场
    placeChar(x, 'xiaomi', 430, 488, 1.9, 'idle_0'); placeChar(x, 'abao', 480, 496, 1.9, 'emo_happy'); placeChar(x, 'laozhou', 355, 484, 1.8, 'idle_1'); placeChar(x, 'adong', 800, 500, 1.8, 'idle_0', true);
    placeChar(x, 'aunt', 880, 486, 1.9, 'emo_dance_0');
    // 脚印
    x.fillStyle = 'rgba(150,170,205,0.4)'; for (let i = 0; i < 9; i++) { x.beginPath(); x.ellipse(60 + i * 38, 510 + (i % 2) * 8, 6, 3, 0.1, 0, 7); x.fill(); }
    snowFlakes(x, 960, 540, 90, 3, 2.6);
  }, { grain: 0.05, seed: 31 });
}
function endBg(): HTMLCanvasElement {
  return T(960, 540, (x) => {
    sky(x, 960, 540, [[0, '#1c2250'], [0.45, '#3a3a7a'], [0.75, '#8a5a8a'], [1, '#e8a888']]);
    const r = rng(15); for (let i = 0; i < 70; i++) { const px = r() * 960, py = r() * 300, s = 0.6 + r() * 1.6; x.fillStyle = `rgba(255,248,214,${0.5 + r() * 0.5})`; x.beginPath(); x.arc(px, py, s, 0, 7); x.fill(); if (s > 1.7) { stroke(x, [[px - 4, py], [px + 4, py]], 'rgba(255,248,214,0.8)', 0.8); stroke(x, [[px, py - 4], [px, py + 4]], 'rgba(255,248,214,0.8)', 0.8); } }
    // 大月亮 + 光晕
    x.save(); const g = x.createRadialGradient(780, 120, 10, 780, 120, 150); g.addColorStop(0, 'rgba(255,248,220,0.9)'); g.addColorStop(0.3, 'rgba(255,238,190,0.35)'); g.addColorStop(1, 'rgba(255,238,190,0)'); x.fillStyle = g; x.fillRect(600, -40, 360, 320); x.restore();
    blob(x, 780, 120, 40, 40, '#fff4d0', { seed: 3, lw: 1.5, n: 14, hi: 0.4, shade: 0.35 });
    hill(x, 360, 16, '#5a4a8a', 8); hill(x, 400, 12, '#7a5a96', 9);
    for (const [cx, w, h, wl, rf, s] of [[90, 80, 56, '#d8b090', '#7a4a5a', 61], [210, 64, 46, '#cfa684', '#4a5a88', 64], [820, 86, 60, '#dab492', '#8a4a4a', 67], [920, 60, 44, '#c8a07e', '#4a6a5a', 70], [320, 58, 42, '#d4aa88', '#7a4a6a', 73], [720, 60, 44, '#d4aa88', '#4a5a88', 76]] as const) house(x, cx, 420 + (cx % 5), w, h, wl, rf, s);
    hill(x, 438, 10, '#f2eaf6', 12); hill(x, 478, 12, '#fffaf6', 13);
    bigTree(x, 480, 480, 1.35, 77);
    placeChar(x, 'santa', 600, 492, 2.2, 'emo_wave_0'); placeChar(x, 'xiaomi', 360, 494, 2, 'emo_happy'); placeChar(x, 'adong', 250, 500, 1.8, 'idle_0'); placeChar(x, 'abao', 400, 502, 1.7, 'emo_dance_1'); placeChar(x, 'laozhou', 690, 496, 1.9, 'idle_0', true);
    snowFlakes(x, 960, 540, 110, 5, 2.4);
  }, { grain: 0.05, seed: 33 });
}
function titleLogo(): HTMLCanvasElement {
  return T(560, 170, (x) => {
    const text = '圣诞帽帽'; const r = rng(77); const sz = 112; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < text.length; i++) {
        const cx = 90 + i * 126 + (r() - 0.5) * 6, cy = 88 + Math.sin(i * 1.6) * 6 + (r() - 0.5) * 4, rot = (r() - 0.5) * 0.14;
        x.save(); x.translate(cx, cy); x.rotate(rot); x.font = `900 ${sz}px ${KAI}`;
        if (pass === 0) { x.lineWidth = 20; x.strokeStyle = 'rgba(255,248,232,0.95)'; x.strokeText(text[i], 0, 0); }
        else if (pass === 1) { x.lineWidth = 6; x.strokeStyle = INK; x.strokeText(text[i], 3, 4); x.fillStyle = '#e0453a'; x.fillText(text[i], 3.5, 4.5); }
        else { x.fillStyle = i % 2 ? '#fffaf0' : '#ffe9dc'; x.fillText(text[i], 0, 0); x.lineWidth = 1.4; x.strokeStyle = '#a02a20'; x.strokeText(text[i], 0, 0); }
        x.restore();
      }
    }
    // 雪帽 + 点点雪
    const sx = 90, sy = 40; paint(x, [[sx - 34, sy + 6], [sx - 20, sy - 22], [sx + 6, sy - 28], [sx + 30, sy - 14], [sx + 36, sy + 6]], '#d8382f', { seed: 90, lw: 2, wob: 0.8, hi: 0.7 }); blob(x, sx + 34, sy - 6, 9, 9, '#fffaf0', { seed: 91, lw: 1.8, n: 9 }); paint(x, [[sx - 40, sy + 8], [sx + 38, sy + 4], [sx + 40, sy + 18], [sx - 38, sy + 20]], '#fffaf0', { seed: 92, lw: 1.8, wob: 0.6, shade: 0.3 });
    const g = rng(5); for (let i = 0; i < 24; i++) { x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); x.arc(20 + g() * 520, 30 + g() * 120, 1 + g() * 2.2, 0, 7); x.fill(); }
    // 下划手绘波浪线
    stroke(x, [[40, 156], [150, 150], [280, 158], [420, 150], [524, 156]], INK, 4.2); stroke(x, [[40, 155], [150, 149], [280, 157], [420, 149], [524, 155]], '#ffd24a', 2.4);
  }, {});
}
function endLine(): HTMLCanvasElement {
  return T(640, 64, (x) => {
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `italic 34px ${HAND}`; x.lineJoin = 'round';
    x.lineWidth = 8; x.strokeStyle = 'rgba(40,24,60,0.7)'; x.strokeText('May all the beauty in the world be blessed.', 320, 32);
    x.fillStyle = '#fff4d0'; x.fillText('May all the beauty in the world be blessed.', 320, 32);
  });
}

export const UI_KEYS: Record<string, () => HTMLCanvasElement> = {
  ui_panel_paper: panelPaper, ui_panel_note: panelNote, ui_toast: toast,
  ui_staple: staple, ui_tape: tape, ui_curl: curl, ui_check_box: checkBox, ui_check_tick: checkTick, ui_strike: strike,
  ui_btn_on: () => btn('on'), ui_btn_cd: () => btn('cd'), ui_btn_hi: () => btn('hi'), ui_btn_down: () => btn('down'),
  ui_bubble_normal: () => bubble('normal'), ui_bubble_shout: () => bubble('shout'), ui_bubble_thought: () => bubble('thought'),
  ui_bubble_tail_normal: () => bubbleTail('normal'), ui_bubble_tail_shout: () => bubbleTail('shout'), ui_bubble_tail_thought: () => bubbleTail('thought'),
  ui_bar_frame: barFrame, ui_bar_fill: barFill, ui_bar_icon: barIcon, ui_map_frame: mapFrame,
  ui_arrow: hintArrow, ui_pulse_ring: pulseRing,
  ...ICONS,
};
/** 大图单独注册（体积大，按需调用 registerUiScreens 或在 Title/End 场景 preload 前调用） */
export const UI_SCREEN_KEYS: Record<string, () => HTMLCanvasElement> = { ui_title_bg: titleBg, ui_title_logo: titleLogo, ui_end_bg: endBg, ui_end_line: endLine };

type TexMgr = { exists(k: string): boolean; addCanvas(k: string, c: HTMLCanvasElement): unknown };
export function buildUiSkin(textures: TexMgr, opts: { screens?: boolean } = {}): string[] {
  const out: string[] = [];
  for (const [k, f] of Object.entries(UI_KEYS)) if (!textures.exists(k)) { textures.addCanvas(k, f()); out.push(k); }
  if (opts.screens) out.push(...registerUiScreens(textures));
  return out;
}
export function registerUiScreens(textures: TexMgr): string[] {
  const out: string[] = [];
  for (const [k, f] of Object.entries(UI_SCREEN_KEYS)) if (!textures.exists(k)) { textures.addCanvas(k, f()); out.push(k); }
  return out;
}
void dark; void light; void mix;
