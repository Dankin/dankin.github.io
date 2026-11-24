// 背景分层:天空(渐变/日月/星)+ 云(漂移)+ 远山两层 + 地面草地(后景缓存) + 前景草簇(front 层,画在果园之后)。
// 白天/黄昏/夜晚三套;每层预渲染成离屏 Canvas(DPR≤2),每帧只 drawImage + 少量云/星。
import { bake, clearBakeCache, Ctx, PAL, rng, mix, shade, rgba, star4, TAU, Baked, lerp } from './common';

export type BackdropMode = 'day' | 'dusk' | 'night';
export interface BackdropOpts {
  mode?: BackdropMode;
  /** 过渡:从 mode 渐变到 to,k=0..1 */ to?: BackdropMode; k?: number;
  /** 地平线位置(占高度比例,默认 0.58) */ horizon?: number;
  /** 'all'(默认)| 'back'(天空/云/山/地面)| 'front'(前景草簇,画在建筑/树之后) */ layers?: 'all' | 'back' | 'front';
  seed?: number;
  /** 不画云/闪烁星(省性能) */ still?: boolean;
}

interface Theme {
  skyTop: string; skyMid: string; skyHor: string;
  far: string; farShade: string; near: string; nearShade: string; snow: string | null;
  gTop: string; gMid: string; gBot: string; gLine: string; tuft: string; tuftLite: string;
  cloud: string; cloudShade: string; cloudInk: string; cloudA: number;
  stars: number; line: string;
}
const THEMES: Record<BackdropMode, Theme> = {
  day: { skyTop: '#5db7e8', skyMid: '#a4d9f2', skyHor: '#e4f6fb', far: '#a8c6dc', farShade: '#8cb0cc', near: '#7fb27a', nearShade: '#5f9460', snow: '#ffffff',
    gTop: '#a6d85a', gMid: '#7bb83d', gBot: '#4f8a2a', gLine: '#4f8a2a', tuft: '#5aa02c', tuftLite: '#a6d85a', cloud: '#ffffff', cloudShade: '#cfe6f2', cloudInk: '#3a5a78', cloudA: 0.55, stars: 0, line: PAL.ink },
  dusk: { skyTop: '#5a4a8c', skyMid: '#d97a7a', skyHor: '#f7cf8a', far: '#9a6f93', farShade: '#7d5680', near: '#5f6f6a', nearShade: '#465a56', snow: '#f7c9a0',
    gTop: '#9fb04a', gMid: '#6f9a3a', gBot: '#3f6a2a', gLine: '#3f6a2a', tuft: '#4f8a2e', tuftLite: '#b8c85a', cloud: '#ffd6b0', cloudShade: '#e89a8a', cloudInk: '#6a3a50', cloudA: 0.6, stars: 14, line: PAL.ink },
  night: { skyTop: '#0c1530', skyMid: '#1d2a4a', skyHor: '#3a4d86', far: '#2d3c68', farShade: '#222f56', near: '#26405a', nearShade: '#1b3048', snow: '#8ea0d0',
    gTop: '#3c6a4a', gMid: '#2c5238', gBot: '#1d3a2a', gLine: '#16301f', tuft: '#2f5f3a', tuftLite: '#5a8f62', cloud: '#5a6a9a', cloudShade: '#3c4a78', cloudInk: '#0c1530', cloudA: 0.75, stars: 60, line: '#0a0f1e' },
};

// ---------- 云 ----------
function cloudSprite(mode: BackdropMode, v: number): Baked {
  const T = THEMES[mode];
  return bake(`bd-cloud|${mode}|${v}`, 170, 80, (c) => {
    const r = rng(v * 13 + 5);
    const base = 62, cs: { x: number; y: number; r: number }[] = [];
    const n = 5 + (v % 2);
    for (let i = 0; i < n; i++) { const x = 28 + (i / (n - 1)) * 114, rr = 16 + Math.sin((i / (n - 1)) * Math.PI) * 14 + r() * 6; cs.push({ x, y: base - rr + 2, r: rr }); }
    cs.push({ x: 85, y: base - 28, r: 24 + r() * 4 });
    // 外轮廓 + 填色(底部压平)
    c.beginPath(); for (const q of cs) { c.moveTo(q.x + q.r, q.y); c.arc(q.x, q.y, q.r, 0, TAU); }
    c.lineWidth = 4.4; c.strokeStyle = rgba(T.cloudInk, T.cloudA); c.stroke(); c.fillStyle = T.cloud; c.fill();
    c.save(); c.clip();
    c.fillStyle = T.cloudShade; c.beginPath(); c.ellipse(90, base + 6, 90, 20, 0, 0, TAU); c.fill(); // 底部阴影
    c.restore();
    c.fillStyle = T.cloud; for (const q of cs.slice(0, 4)) { c.beginPath(); c.arc(q.x - 2, q.y - 3, q.r * 0.55, Math.PI * 1.05, Math.PI * 1.7); c.lineWidth = 2; c.strokeStyle = rgba('#ffffff', 0.9); c.stroke(); }
    c.save(); c.globalCompositeOperation = 'destination-out'; c.fillRect(0, base + 4, 170, 30); c.restore();
    c.beginPath(); c.moveTo(24, base + 3); c.lineTo(146, base + 3); c.lineWidth = 2.4; c.strokeStyle = rgba(T.cloudInk, T.cloudA); c.stroke();
  }, { ax: 85, ay: 40 });
}

// ---------- 山 ----------
function mountainLayer(c: Ctx, w: number, baseY: number, hMin: number, hMax: number, step: number, seed: number, fill: string, shadeC: string, ink: string, lw: number, snow: string | null, alpha: number) {
  const r = rng(seed);
  const pts: [number, number][] = [];
  let x = -step * (0.3 + r() * 0.4);
  const peaks: [number, number, number][] = [];
  pts.push([x, baseY]);
  while (x < w + step) {
    const ph = hMin + r() * (hMax - hMin), pw = step * (0.8 + r() * 0.5);
    const px = x + pw * (0.4 + r() * 0.2);
    pts.push([px, baseY - ph]); peaks.push([px, baseY - ph, pw]);
    x += pw; pts.push([x, baseY - ph * (0.05 + r() * 0.2)]);
  }
  pts.push([x, baseY]);
  const path = () => {
    c.beginPath(); c.moveTo(pts[0][0], baseY + 400);
    c.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = pts[i], [qx, qy] = pts[i - 1];
      const peak = i % 2 === 1;
      if (peak) c.quadraticCurveTo(lerp(qx, px, 0.55), lerp(qy, py, 0.7) + 1, px, py);
      else c.quadraticCurveTo(lerp(qx, px, 0.45), lerp(qy, py, 0.3) - 1, px, py);
    }
    c.lineTo(pts[pts.length - 1][0], baseY + 400); c.closePath();
  };
  c.save(); c.globalAlpha = alpha;
  path(); c.fillStyle = fill; c.fill();
  c.save(); path(); c.clip();
  for (const [px, py, pw] of peaks) { // 背光面(峰右侧)
    c.beginPath(); c.moveTo(px, py); c.lineTo(px + pw * 0.7, baseY + 2); c.lineTo(px + pw * 0.12, baseY + 2); c.lineTo(px - pw * 0.02, py + (baseY - py) * 0.45); c.closePath();
    c.fillStyle = shadeC; c.fill();
    if (snow) {
      const sh = (baseY - py) * 0.26;
      c.beginPath(); c.moveTo(px, py - 1); c.lineTo(px + sh * 0.7, py + sh); c.lineTo(px + sh * 0.35, py + sh * 0.75); c.lineTo(px, py + sh * 1.05); c.lineTo(px - sh * 0.35, py + sh * 0.8); c.lineTo(px - sh * 0.75, py + sh); c.closePath();
      c.fillStyle = snow; c.fill();
    }
  }
  c.restore();
  path(); c.lineWidth = lw; c.strokeStyle = ink; c.stroke();
  c.restore();
}

// ---------- 地面 ----------
function tuft(c: Ctx, x: number, y: number, h: number, T: Theme, r: () => number, lw = 1.6) {
  const n = 3 + ((r() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const a = (i - (n - 1) / 2) * 0.42 + (r() - 0.5) * 0.2, L = h * (0.65 + r() * 0.55), bw = Math.max(1.8, h * 0.13);
    c.save(); c.translate(x, y); c.rotate(a);
    c.beginPath(); c.moveTo(-bw, 0); c.quadraticCurveTo(-bw * 0.5, -L * 0.6, bw * 0.2, -L); c.quadraticCurveTo(bw * 1.1, -L * 0.5, bw, 0); c.closePath();
    c.fillStyle = i % 2 ? T.tuftLite : T.tuft; c.fill(); c.lineWidth = lw; c.strokeStyle = T.line; c.stroke();
    c.restore();
  }
}
function flower(c: Ctx, x: number, y: number, s: number, col: string, T: Theme) {
  c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - s * 1.6); c.lineWidth = 1.4; c.strokeStyle = T.line; c.stroke();
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; c.beginPath(); c.arc(x + Math.cos(a) * s * 0.6, y - s * 1.6 + Math.sin(a) * s * 0.6, s * 0.45, 0, TAU); c.fillStyle = col; c.fill(); c.lineWidth = 1; c.strokeStyle = T.line; c.stroke(); }
  c.beginPath(); c.arc(x, y - s * 1.6, s * 0.4, 0, TAU); c.fillStyle = '#ffe36a'; c.fill();
}

function paintBack(c: Ctx, w: number, h: number, mode: BackdropMode, hz: number, seed: number) {
  const T = THEMES[mode], r = rng(seed * 977 + mode.length * 31);
  const hy = Math.round(h * hz);
  // 天空
  const sg = c.createLinearGradient(0, 0, 0, hy);
  sg.addColorStop(0, T.skyTop); sg.addColorStop(0.55, T.skyMid); sg.addColorStop(1, T.skyHor);
  c.fillStyle = sg; c.fillRect(0, 0, w, hy + 2);
  // 星
  if (T.stars) {
    const n = Math.round((T.stars * w * hy) / (844 * 230));
    for (let i = 0; i < n; i++) {
      const x = r() * w, y = r() * hy * (mode === 'dusk' ? 0.4 : 0.85), s = 1 + r() * 2.2;
      star4(c, x, y, s * 1.6, 0.3); c.fillStyle = rgba('#fff8d0', mode === 'dusk' ? 0.5 : 0.5 + r() * 0.5); c.fill();
    }
  }
  // 日 / 月
  const u = Math.min(w, h);
  if (mode === 'day') {
    const sx = w * 0.82, sy = hy * 0.22, g = c.createRadialGradient(sx, sy, 4, sx, sy, u * 0.3);
    g.addColorStop(0, 'rgba(255,248,200,0.95)'); g.addColorStop(0.35, 'rgba(255,240,170,0.35)'); g.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, hy);
    c.beginPath(); c.arc(sx, sy, u * 0.05, 0, TAU); c.fillStyle = '#ffe36a'; c.fill(); c.lineWidth = 2.6; c.strokeStyle = PAL.ink; c.stroke();
    c.beginPath(); c.arc(sx - u * 0.015, sy - u * 0.015, u * 0.018, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.7)'; c.fill();
  } else if (mode === 'dusk') {
    const sx = w * 0.3, sy = hy - u * 0.02, g = c.createRadialGradient(sx, sy, 4, sx, sy, u * 0.5);
    g.addColorStop(0, 'rgba(255,214,120,0.95)'); g.addColorStop(0.3, 'rgba(255,160,100,0.45)'); g.addColorStop(1, 'rgba(255,160,100,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, hy);
    c.beginPath(); c.arc(sx, sy, u * 0.075, Math.PI, TAU); c.closePath(); c.fillStyle = '#ffb347'; c.fill(); c.lineWidth = 2.6; c.strokeStyle = PAL.ink; c.stroke();
  } else {
    const sx = w * 0.78, sy = hy * 0.24, mr = u * 0.06;
    const g = c.createRadialGradient(sx, sy, mr * 0.6, sx, sy, mr * 4); g.addColorStop(0, 'rgba(200,215,255,0.45)'); g.addColorStop(1, 'rgba(200,215,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, hy);
    const ix = sx + mr * 0.45, iy = sy - mr * 0.15, ir = mr * 0.95;
    c.save(); c.beginPath(); c.arc(sx, sy, mr, 0, TAU); c.clip();
    c.beginPath(); c.rect(sx - mr - 2, sy - mr - 2, mr * 2 + 4, mr * 2 + 4); c.arc(ix, iy, ir, 0, TAU); c.fillStyle = '#f4efd0'; c.fill('evenodd'); c.restore();
    c.beginPath(); c.arc(sx, sy, mr, Math.PI * 0.55, Math.PI * 1.45); c.arc(ix, iy, ir, Math.PI * 1.25, Math.PI * 0.75, true); c.closePath();
    c.lineWidth = 2.4; c.strokeStyle = T.line; c.stroke();
  }
  // 远山两层
  const step = Math.max(110, Math.min(w, h * 1.8) * 0.3), mh = Math.min(hy, w * 0.5);
  mountainLayer(c, w, hy + 2, mh * 0.2, mh * 0.38, step * 1.15, seed * 3 + 1, T.far, T.farShade, rgba(T.line, 0.55), 1.8, T.snow, 1);
  mountainLayer(c, w, hy + 2, mh * 0.08, mh * 0.2, step * 0.8, seed * 3 + 2, T.near, T.nearShade, rgba(T.line, 0.9), 2.4, null, 1);
  // 近山脚下薄雾
  const fg = c.createLinearGradient(0, hy - hy * 0.1, 0, hy + 2); fg.addColorStop(0, rgba(T.skyHor, 0)); fg.addColorStop(1, rgba(T.skyHor, mode === 'night' ? 0.18 : 0.45));
  c.fillStyle = fg; c.fillRect(0, hy - hy * 0.1, w, hy * 0.1 + 2);
  // 地面
  const gg = c.createLinearGradient(0, hy, 0, h); gg.addColorStop(0, T.gTop); gg.addColorStop(0.3, T.gMid); gg.addColorStop(1, T.gBot);
  c.fillStyle = gg; c.fillRect(0, hy, w, h - hy);
  // 地平线:手绘抖线
  c.beginPath(); for (let x = 0; x <= w + 16; x += 16) { const y = hy + (r() - 0.5) * 2; x ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.lineWidth = 3; c.strokeStyle = T.line; c.stroke();
  // 横向草纹(越远越密越短)
  c.lineWidth = 1.6; c.strokeStyle = rgba(T.gLine, 0.55);
  const gh = h - hy;
  for (let i = 0; i < 36; i++) {
    const t = Math.pow(r(), 1.5), y = hy + 6 + t * (gh - 8), len = 8 + t * 40, x = r() * w;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + len * 0.5, y - 2 - t * 3, x + len, y + 0.5); c.stroke();
  }
  // 草簇与小花
  const nT = Math.round((w * gh) / 5200);
  for (let i = 0; i < nT; i++) { const t = Math.pow(r(), 1.3), y = hy + 8 + t * (gh - 14); tuft(c, r() * w, y, 7 + t * 14, T, r, 1.2 + t); }
  if (mode !== 'night') { const cols = ['#ffffff', '#ff9ec0', '#ffd24a']; for (let i = 0; i < nT / 3; i++) { const t = r(), y = hy + 14 + t * (gh - 20); flower(c, r() * w, y, 2.2 + t * 2.4, cols[i % 3], T); } }
}

function paintFront(c: Ctx, w: number, fh: number, mode: BackdropMode, seed: number) {
  const T = THEMES[mode], r = rng(seed * 313 + 17);
  // 底边草带:深色底 + 大草簇
  const g = c.createLinearGradient(0, fh * 0.55, 0, fh); g.addColorStop(0, rgba(T.gBot, 0)); g.addColorStop(1, rgba(shade(T.gBot, 0.8), 0.9));
  c.fillStyle = g; c.fillRect(0, 0, w, fh);
  const n = Math.max(4, Math.round(w / 70));
  for (let i = 0; i < n; i++) tuft(c, (i + r() * 0.8) * (w / n) + 8, fh - 4 - r() * 8, 22 + r() * 16, T, r, 2.2);
}

const Order: BackdropMode[] = ['night', 'dusk', 'day'];
/** 昼夜时钟 → 模式/过渡。hour 0..24 */
export function backdropForHour(hour: number): { mode: BackdropMode; to?: BackdropMode; k?: number } {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 7 && h < 16.5) return { mode: 'day' };
  if (h >= 16.5 && h < 17.5) return { mode: 'day', to: 'dusk', k: h - 16.5 };
  if (h >= 17.5 && h < 19) return { mode: 'dusk' };
  if (h >= 19 && h < 20) return { mode: 'dusk', to: 'night', k: h - 19 };
  if (h >= 20 || h < 5) return { mode: 'night' };
  if (h >= 5 && h < 6) return { mode: 'night', to: 'dusk', k: h - 5 };
  return { mode: 'dusk', to: 'day', k: h - 6 };
}
void Order;

let lastSize = '';
function backCache(w: number, h: number, mode: BackdropMode, hz: number, seed: number) {
  const size = `${w}x${h}`;
  if (size !== lastSize) { clearBakeCache('bd-'); lastSize = size; } // 尺寸变了:丢弃旧尺寸缓存,避免堆积
  return bake(`bd-back|${mode}|${w}x${h}|${hz.toFixed(3)}|${seed}`, w, h, (c) => paintBack(c, w, h, mode, hz, seed), { ax: 0, ay: 0 });
}
function frontCache(w: number, h: number, mode: BackdropMode, seed: number) {
  const fh = Math.round(Math.min(90, h * 0.14));
  return bake(`bd-front|${mode}|${w}x${h}|${seed}`, w, fh, (c) => paintFront(c, w, fh, mode, seed), { ax: 0, ay: fh });
}

const CLOUDS: { u: number; y: number; sp: number; sc: number; v: number }[] = [
  { u: 0.1, y: 0.16, sp: 7, sc: 1.0, v: 0 }, { u: 0.45, y: 0.3, sp: 4, sc: 0.7, v: 1 }, { u: 0.7, y: 0.1, sp: 9, sc: 1.2, v: 2 }, { u: 0.92, y: 0.36, sp: 5, sc: 0.8, v: 3 }, { u: 0.28, y: 0.4, sp: 3, sc: 0.55, v: 0 },
];
function drawClouds(ctx: Ctx, w: number, hy: number, time: number, mode: BackdropMode, alpha: number) {
  const nC = Math.min(CLOUDS.length, Math.max(3, Math.round(w / 220)));
  for (let i = 0; i < nC; i++) {
    const q = CLOUDS[i], cw = 170 * q.sc * (hy > 300 ? 1.1 : 0.9), span = w + cw * 2;
    const x = ((q.u * span + time * q.sp) % span) - cw;
    cloudSprite(mode, q.v).draw(ctx, x + cw / 2, q.y * hy + 20, q.sc * (hy > 300 ? 1.1 : 0.9), alpha * (mode === 'night' ? 0.8 : 1));
  }
}
let starSprite: Baked | null = null;
function drawTwinkle(ctx: Ctx, w: number, hy: number, time: number, alpha: number) {
  starSprite ??= bake('bd-star', 16, 16, (c) => { star4(c, 8, 8, 7, 0.28); c.fillStyle = '#fff8d0'; c.fill(); }, { ax: 8, ay: 8 });
  const r = rng(99);
  for (let i = 0; i < 8; i++) { const x = r() * w, y = r() * hy * 0.7, ph = r() * TAU; starSprite.draw(ctx, x, y, 0.7 + 0.5 * (0.5 + 0.5 * Math.sin(time * 2 + ph)), alpha * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * 1.7 + ph)))); }
}

/**
 * 画背景。w,h 为画布逻辑尺寸;time 为秒(云漂移、星闪烁用)。
 * 典型用法:drawBackdrop(ctx,w,h,t,{layers:'back'}) → 画树/果园 → drawBackdrop(ctx,w,h,t,{layers:'front'})
 */
export function drawBackdrop(ctx: Ctx, w: number, h: number, time = 0, o: BackdropOpts = {}) {
  w = Math.round(w); h = Math.round(h);
  const mode = o.mode ?? 'day', hz = o.horizon ?? 0.58, seed = o.seed ?? 1, layers = o.layers ?? 'all';
  const hy = h * hz, k = o.to && o.to !== mode ? Math.max(0, Math.min(1, o.k ?? 0)) : 0;
  if (layers !== 'front') {
    backCache(w, h, mode, hz, seed).draw(ctx, 0, 0);
    if (k > 0) backCache(w, h, o.to!, hz, seed).draw(ctx, 0, 0, 1, k);
    if (!o.still) {
      if (mode === 'night' || o.to === 'night') drawTwinkle(ctx, w, hy, time, mode === 'night' ? 1 - k : k);
      drawClouds(ctx, w, hy, time, mode, 1 - k * 0.6);
      if (k > 0) drawClouds(ctx, w, hy, time, o.to!, k);
    }
  }
  if (layers !== 'back') {
    const f = frontCache(w, h, mode, seed); f.draw(ctx, 0, h);
    if (k > 0) frontCache(w, h, o.to!, seed).draw(ctx, 0, h, 1, k);
  }
}
export const _mixUnused = mix;
