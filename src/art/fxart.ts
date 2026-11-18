/**
 * 特效贴图（art-char），供 src/fx 使用。全部前缀 fx_，不与 art-world 的 p_* 冲突。
 * 画布单位 = 位图像素（SS=3 时旧 1 像素=3 单位）；显示缩放用 ART_SCALE。origin 默认 (0.5,0.5)，脚印 / 铃铛波另有说明。
 *  fx_note_0 / fx_note_1 / fx_note_2     单八分音符 / 双连音符 / 四分音符（暖棕描边，叠色填充，可 setTint）
 *  fx_heart / fx_heart_small             爱心 / 小爱心
 *  fx_spark / fx_spark_soft              四角闪光（硬 / 软辉光）
 *  fx_star                               五角小星
 *  fx_snow_0..2                          雪花（点 / 六角 / 绒团），白色，可 setTint / alpha
 *  fx_smoke_0..2                         烟团（灰暖色，半透明，叠加用）
 *  fx_bell_wave_0..2                     铃铛声波（1/2/3 道弧线，朝右；flipX / rotation 使用）
 *  fx_foot_l / fx_foot_r                 脚印（雪地凹痕），origin (0.5,0.5)，朝上
 *  fx_light_glow                         灯串亮光（暖黄柔光团，加色混合）
 *  fx_light_bulb_<r|g|y|b>               灯串灯泡实体（4 色）
 *  fx_puff                               气团（落雪 / 受惊的白烟）
 *  fx_drop                               水滴/汗滴
 *  fx_zzz                                Z 字（睡/累）
 *  fx_exclaim / fx_question / fx_dots / fx_music_bubble   头顶符号（手绘感粗符号，无气泡底）
 */
import { mkc, paint, blob, stroke, dot, dark, light, rgba, INK, rng, grain, halo, Pt, Ctx } from './char/ink';

type Draw = (x: Ctx) => void;
function tex(w: number, h: number, draw: Draw, o: { grain?: number; halo?: number | false; seed?: number } = {}): HTMLCanvasElement {
  const { c, x } = mkc(w, h); draw(x);
  if (o.grain) grain(x, w, h, o.seed ?? 3, o.grain);
  return o.halo === false ? c : halo(c, 'rgba(255,248,232,0.8)', o.halo ?? 1.2);
}
const soft = (x: Ctx, cx: number, cy: number, r: number, col: [number, number, number], a = 1) => {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.45, `rgba(${col},${a * 0.45})`); g.addColorStop(1, `rgba(${col},0)`);
  x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
};

function note(kind: 0 | 1 | 2): HTMLCanvasElement {
  return tex(30, 38, (x) => {
    const col = '#ffffff';
    if (kind === 0) { // 八分音符
      stroke(x, [[19.5, 27], [19.6, 8]], INK, 3.2); stroke(x, [[19.5, 27], [19.6, 8]], col, 1.8);
      paint(x, [[19.6, 8], [26, 12], [25.6, 19], [22, 22]], col, { seed: 4, lw: 1.1, wob: 0.1, t: 0.4 });
      blob(x, 14, 28.6, 6.2, 4.7, col, { seed: 5, lw: 1.3, rot: -0.4, n: 9 });
    } else if (kind === 1) { // 双连音符
      stroke(x, [[11, 27], [11, 8]], INK, 3.2); stroke(x, [[11, 27], [11, 8]], col, 1.8);
      stroke(x, [[25, 24], [25, 4.6]], INK, 3.2); stroke(x, [[25, 24], [25, 4.6]], col, 1.8);
      paint(x, [[10.5, 8], [25.6, 4], [25.6, 9.6], [10.5, 13.6]], col, { seed: 6, lw: 1.2, wob: 0.1, t: 0.1 });
      blob(x, 6, 28.6, 5.6, 4.4, col, { seed: 7, lw: 1.3, rot: -0.4, n: 9 }); blob(x, 20.4, 25.6, 5.6, 4.4, col, { seed: 8, lw: 1.3, rot: -0.4, n: 9 });
    } else { // 四分音符
      stroke(x, [[19.5, 27], [19.6, 7]], INK, 3.2); stroke(x, [[19.5, 27], [19.6, 7]], col, 1.8);
      blob(x, 14, 28.6, 6.2, 4.7, col, { seed: 9, lw: 1.3, rot: -0.4, n: 9 });
    }
  }, { halo: 1.4 });
}
function heart(w: number): HTMLCanvasElement {
  const k = w / 34;
  return tex(w, w * 0.92, (x) => {
    x.scale(k, k);
    paint(x, [[17, 28], [8, 20], [4.4, 13], [6.6, 7.6], [11.4, 6.4], [15.2, 9], [17, 12], [18.8, 9], [22.6, 6.4], [27.4, 7.6], [29.6, 13], [26, 20]], '#ff5a6e', { seed: 10, lw: 1.5, t: 0.5, hi: 0.9, hiAt: [0.28, 0.3] });
    stroke(x, [[9.4, 11], [11.6, 9.4]], '#ffe7e0', 1.5, { alpha: 0.95 });
  }, { halo: 1.2 });
}
function spark(soft_: boolean): HTMLCanvasElement {
  return tex(36, 36, (x) => {
    if (soft_) soft(x, 18, 18, 17, [255, 238, 170], 0.95);
    const pts: Pt[] = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 2.8 : 15; pts.push([18 + Math.cos(a) * r, 18 + Math.sin(a) * r * (i % 4 === 0 ? 1 : 0.85)]); }
    paint(x, pts, '#fff4b0', { seed: 11, lw: 0.9, wob: 0.1, t: 0.08, hi: 0.5, ink: soft_ ? false : '#a9741a', flat: soft_ });
    dot(x, 18, 18, 2.4, '#ffffff');
  }, { halo: soft_ ? false : 1.2 });
}
function star(): HTMLCanvasElement {
  return tex(32, 32, (x) => {
    const pts: Pt[] = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 6.4 : 14; pts.push([16 + Math.cos(a) * r, 17 + Math.sin(a) * r]); }
    paint(x, pts, '#ffd84a', { seed: 12, lw: 1.3, wob: 0.15, t: 0.05, hi: 0.9, hiAt: [0.36, 0.34] });
  });
}
function flake(i: number): HTMLCanvasElement {
  return tex(i === 2 ? 22 : 24, i === 2 ? 22 : 24, (x) => {
    if (i === 0) { soft(x, 12, 12, 11, [255, 255, 255], 1); dot(x, 12, 12, 4.4, '#ffffff'); stroke(x, [[9.6, 10], [11, 8.8]], '#dfeaff', 1, { alpha: 0.9 }); }
    else if (i === 1) { x.strokeStyle = '#ffffff'; x.lineWidth = 2; for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI; x.beginPath(); x.moveTo(12 - Math.cos(a) * 10, 12 - Math.sin(a) * 10); x.lineTo(12 + Math.cos(a) * 10, 12 + Math.sin(a) * 10); x.stroke(); for (const s of [-1, 1]) { const bx = 12 + Math.cos(a) * 6.4 * s, by = 12 + Math.sin(a) * 6.4 * s; for (const d of [-0.7, 0.7]) { x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + Math.cos(a + d) * 3.4 * s, by + Math.sin(a + d) * 3.4 * s); x.stroke(); } } } x.strokeStyle = 'rgba(180,200,235,0.7)'; x.lineWidth = 0.6; }
    else { soft(x, 11, 11, 10, [255, 255, 255], 0.9); const r = rng(5); for (let k = 0; k < 5; k++) dot(x, 11 + (r() - 0.5) * 7, 11 + (r() - 0.5) * 7, 3 + r() * 1.6, 'rgba(255,255,255,0.95)'); }
  }, { halo: false });
}
function smoke(i: number): HTMLCanvasElement {
  const s = 44 + i * 6;
  return tex(s, s, (x) => {
    const r = rng(20 + i);
    for (let k = 0; k < 7; k++) { const a = r() * 6.28, d = r() * s * 0.2; soft(x, s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, s * (0.22 + r() * 0.16), [235, 222, 206], 0.8); }
    for (let k = 0; k < 3; k++) soft(x, s * (0.4 + r() * 0.1) , s * (0.4 + r() * 0.1), s * 0.18, [255, 250, 238], 0.8);
  }, { halo: false, grain: 0.05, seed: 3 + i });
}
function bellWave(n: number): HTMLCanvasElement {
  return tex(48, 56, (x) => {
    for (let k = 0; k < n; k++) {
      const R = 10 + k * 11; const a0 = -0.8 + k * 0.05, a1 = 0.8 - k * 0.05;
      x.beginPath(); for (let i = 0; i <= 14; i++) { const a = a0 + (a1 - a0) * (i / 14); const rr = R + Math.sin(i * 1.7 + k) * 0.5; const px = 6 + Math.cos(a) * rr, py = 28 + Math.sin(a) * rr * 1.25; i ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.strokeStyle = INK; x.lineWidth = 4.2 - k * 0.6; x.stroke(); x.strokeStyle = k % 2 ? '#fff0b8' : '#ffd96a'; x.lineWidth = 2.6 - k * 0.5; x.stroke();
    }
  }, { halo: 1 });
}
function foot(left: boolean): HTMLCanvasElement {
  return tex(16, 26, (x) => {
    const sx = left ? -0.6 : 0.6;
    const base = 'rgba(120,138,170,0.55)';
    paint(x, [[8 + sx, 3], [12.4, 8], [12, 15.6], [9.6, 19.4], [6.4, 19.4], [4.4, 14.4], [4.8, 8]], base, { seed: left ? 3 : 4, ink: false, flat: true, wob: 0.25, t: 0.5 });
    paint(x, [[8, 21], [10.8, 21.4], [11.4, 24], [8.4, 24.8], [5.8, 24]], base, { seed: left ? 5 : 6, ink: false, flat: true, wob: 0.2 });
    stroke(x, [[5.6, 8], [5.4, 14]], 'rgba(255,255,255,0.8)', 1.1);
  }, { halo: false });
}
function bulb(col: string): HTMLCanvasElement {
  return tex(16, 20, (x) => {
    paint(x, [[5, 6], [11, 6], [11.6, 9.6], [8, 11.8], [4.4, 9.6]].map(([a, b]) => [a, b + 0.2] as Pt), '#4a4040', { seed: 1, lw: 0.9, wob: 0.1, flat: true });
    paint(x, [[8, 18], [3.4, 14.4], [3.6, 9.6], [8, 8.4], [12.4, 9.6], [12.6, 14.4]], col, { seed: 2, lw: 1.1, wob: 0.15, hi: 0.9, hiAt: [0.32, 0.36] });
  });
}
function lightGlow(): HTMLCanvasElement {
  return tex(64, 64, (x) => { soft(x, 32, 32, 31, [255, 214, 120], 0.95); soft(x, 32, 32, 12, [255, 250, 220], 1); }, { halo: false });
}
function puff(): HTMLCanvasElement {
  return tex(34, 28, (x) => { for (const [a, b, r] of [[10, 17, 8], [18, 12, 9.4], [26, 17, 7.4], [17, 19, 8]] as const) blob(x, a, b, r, r * 0.92, '#fffaf2', { seed: a, lw: 1.1, n: 9, shade: 0.3 }); }, { halo: false });
}
function drop(): HTMLCanvasElement {
  return tex(16, 22, (x) => { paint(x, [[8, 2], [12.4, 12], [10.6, 18], [5.4, 18], [3.6, 12]], '#8fd3ff', { seed: 1, lw: 1.1, wob: 0.1, hi: 0.9, hiAt: [0.3, 0.5] }); });
}
function zzz(): HTMLCanvasElement {
  return tex(40, 40, (x) => {
    for (const [px, py, s] of [[4, 4, 14], [18, 14, 11], [28, 24, 8]] as const) { const p: Pt[] = [[px, py], [px + s, py], [px, py + s], [px + s, py + s]]; stroke(x, p, INK, 3.6); stroke(x, p, '#c8dcff', 2.1); }
  }, { halo: 1 });
}
function sym(kind: 'exclaim' | 'question' | 'dots' | 'music'): HTMLCanvasElement {
  return tex(28, 36, (x) => {
    const ink = (pts: Pt[], w = 4.6) => { stroke(x, pts, INK, w + 1.6); stroke(x, pts, '#ff5a3c', w); stroke(x, pts.map(([a, b]) => [a - 0.5, b - 0.4] as Pt), '#ffb09a', 1.1, { alpha: 0.8 }); };
    if (kind === 'exclaim') { ink([[14, 4], [14.6, 14], [14, 22]], 5.4); blob(x, 14, 29.5, 3.2, 3.2, '#ff5a3c', { seed: 2, lw: 1.2, n: 8 }); }
    else if (kind === 'question') { ink([[7, 10], [10, 4.6], [17, 4.2], [21, 9], [18, 15], [14, 19], [14, 22]], 4.6); blob(x, 14, 29.5, 3.2, 3.2, '#ff5a3c', { seed: 3, lw: 1.2, n: 8 }); }
    else if (kind === 'dots') { for (const px of [5, 14, 23]) blob(x, px, 24, 3, 3, '#7a6a8a', { seed: px, lw: 1.1, n: 8 }); }
    else { blob(x, 11, 26, 5, 3.8, '#8a6ad0', { seed: 4, lw: 1.2, rot: -0.4, n: 9 }); stroke(x, [[15.4, 24.6], [15.6, 6]], INK, 3.4); stroke(x, [[15.4, 24.6], [15.6, 6]], '#8a6ad0', 1.9); paint(x, [[15.6, 6], [22.6, 10.6], [20, 14]], '#8a6ad0', { seed: 5, lw: 1, wob: 0.1 }); }
  }, { halo: 1.4 });
}

export const FX_KEYS: Record<string, () => HTMLCanvasElement> = {
  fx_note_0: () => note(0), fx_note_1: () => note(1), fx_note_2: () => note(2),
  fx_heart: () => heart(34), fx_heart_small: () => heart(20),
  fx_spark: () => spark(false), fx_spark_soft: () => spark(true), fx_star: star,
  fx_snow_0: () => flake(0), fx_snow_1: () => flake(1), fx_snow_2: () => flake(2),
  fx_smoke_0: () => smoke(0), fx_smoke_1: () => smoke(1), fx_smoke_2: () => smoke(2),
  fx_bell_wave_0: () => bellWave(1), fx_bell_wave_1: () => bellWave(2), fx_bell_wave_2: () => bellWave(3),
  fx_foot_l: () => foot(true), fx_foot_r: () => foot(false),
  fx_light_glow: lightGlow,
  fx_light_bulb_r: () => bulb('#ff5a4a'), fx_light_bulb_g: () => bulb('#6fd36a'), fx_light_bulb_y: () => bulb('#ffd84a'), fx_light_bulb_b: () => bulb('#5aa8ff'),
  fx_puff: puff, fx_drop: drop, fx_zzz: zzz,
  fx_exclaim: () => sym('exclaim'), fx_question: () => sym('question'), fx_dots: () => sym('dots'), fx_music_bubble: () => sym('music'),
};

export function registerFxTextures(textures: { exists(k: string): boolean; addCanvas(k: string, c: HTMLCanvasElement): unknown }): string[] {
  const out: string[] = [];
  for (const [k, f] of Object.entries(FX_KEYS)) if (!textures.exists(k)) { textures.addCanvas(k, f()); out.push(k); }
  return out;
}
void dark; void light; void rgba;
