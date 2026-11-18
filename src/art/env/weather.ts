/**
 * 天气 / 昼夜 / 光效纹理（键名由 index.ts 以 p_ 前缀注册；全部为旧源尺寸×SS 的小图）。
 * 使用建议（dev-core）：
 *  - p_rain：64×64 无缝雨丝，tileSprite 斜向滚动（x:-1.2, y:+9 /帧），叠 2 层不同 scale/alpha 即有景深。
 *  - p_snowtile_0/1/2：128×128 无缝飘雪（远/中/近），tileSprite 以不同速度下落+正弦漂移。
 *  - p_flake_0..2：单片雪花，粒子发射器用（ADD 或 NORMAL）。
 *  - p_ripple：水面涟漪圈（雨落水面/鱼跃），scale 0.3→1 并淡出。
 *  - p_glint：水面反光条 64×16，ADD 混合，随时间 alpha 闪烁。
 *  - p_winlight：窗口暖光（一块柔光矩形，ADD），贴在 facade 窗位（WallTex.windows[].x/y）。
 *  - p_pool：路灯地面光池（等距椭圆，ADD，origin 0.5），夜间 alpha 0.6。
 *  - p_beam：门窗斜射光束（ADD）。 p_godray：黄昏体积光长条（ADD，alpha .25）。
 *  - p_vignette：480×270 暗角（NORMAL，scrollFactor 0，setScale(ART_SCALE*… 同 backdrop)）。
 *  - p_smoke：烟/蒸汽软团（炉灶、渡轮），NORMAL。 p_star：夜空星点十字闪。
 */
import { mkTex, rng, rgba, radial, lin, type Ctx } from '../brush';

const T: Record<string, HTMLCanvasElement> = {};
const def = (key: string, w: number, h: number, draw: (x: Ctx, r: ReturnType<typeof rng>) => void, seed = 1) => { T[key] = mkTex(w, h, (x, r) => draw(x, r), { seed, paper: 0, grain: 0 }); };

/** 可无缝平铺：在四边环绕位置重复绘制 */
function wrapDraw(x: Ctx, W: number, H: number, f: (dx: number, dy: number) => void) { for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) f(dx, dy); }

def('rain', 64, 64, (x, r) => {
  x.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const px = r() * 64, py = r() * 64, len = 7 + r() * 8, a = 0.25 + r() * 0.4, w = 0.35 + r() * 0.3;
    wrapDraw(x, 64, 64, (dx, dy) => { x.strokeStyle = rgba('#dfe9f5', a); x.lineWidth = w; x.beginPath(); x.moveTo(px + dx, py + dy); x.lineTo(px + dx - len * 0.12, py + dy + len); x.stroke(); });
  }
}, 21);

[[0, 12, 1.4, 2.1], [1, 16, 2.0, 3.0], [2, 10, 3.0, 4.4]].forEach(([i, n, r0, r1]) => def('snowtile_' + i, 128, 128, (x, r) => {
  for (let k = 0; k < n * 2; k++) {
    const px = r() * 128, py = r() * 128, rr = r0 + r() * (r1 - r0), a = 0.55 + r() * 0.4;
    wrapDraw(x, 128, 128, (dx, dy) => { const cx = px + dx, cy = py + dy; x.fillStyle = radial(x, cx, cy, rr * 1.8, [[0, rgba('#ffffff', a)], [0.5, rgba('#fff6fa', a * 0.8)], [1, rgba('#fff6fa', 0)]]); x.fillRect(cx - rr * 2, cy - rr * 2, rr * 4, rr * 4); });
  }
}, 30 + i));

[0, 1, 2].forEach((i) => def('flake_' + i, 8, 8, (x) => {
  x.fillStyle = radial(x, 4, 4, 3.8, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,248,252,0.85)'], [1, 'rgba(255,248,252,0)']]); x.fillRect(0, 0, 8, 8);
  if (i === 2) { x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 0.5; for (let a = 0; a < 3; a++) { x.beginPath(); x.moveTo(4 - Math.cos(a * 1.05) * 3.2, 4 - Math.sin(a * 1.05) * 3.2); x.lineTo(4 + Math.cos(a * 1.05) * 3.2, 4 + Math.sin(a * 1.05) * 3.2); x.stroke(); } }
}, 40 + i));

def('ripple', 32, 16, (x) => {
  x.save(); x.translate(16, 8); x.scale(1, 0.45);
  x.strokeStyle = 'rgba(235,245,255,0.8)'; x.lineWidth = 1.2; x.beginPath(); x.arc(0, 0, 13, 0, 6.3); x.stroke();
  x.strokeStyle = 'rgba(235,245,255,0.35)'; x.lineWidth = 2.2; x.beginPath(); x.arc(0, 0, 8, 0.4, 5.9); x.stroke(); x.restore();
});
def('glint', 64, 16, (x, r) => {
  for (let i = 0; i < 18; i++) { const px = 4 + r() * 56, py = 2 + r() * 12, l = 3 + r() * 9; x.strokeStyle = rgba('#fff6d8', 0.3 + r() * 0.6); x.lineWidth = 0.5 + r() * 0.4; x.lineCap = 'round'; x.beginPath(); x.moveTo(px - l / 2, py); x.lineTo(px + l / 2, py); x.stroke(); }
}, 51);
def('winlight', 24, 24, (x) => {
  x.fillStyle = radial(x, 12, 12, 12, [[0, 'rgba(255,230,160,0.95)'], [0.45, 'rgba(255,196,110,0.5)'], [1, 'rgba(255,180,90,0)']]); x.fillRect(0, 0, 24, 24);
  x.fillStyle = 'rgba(255,244,200,0.9)'; x.fillRect(8, 7, 8, 10);
});
def('pool', 64, 32, (x) => {
  x.save(); x.translate(32, 16); x.scale(1, 0.5); x.fillStyle = radial(x, 0, 0, 32, [[0, 'rgba(255,220,140,0.8)'], [0.5, 'rgba(255,200,110,0.38)'], [1, 'rgba(255,190,100,0)']]); x.fillRect(-32, -32, 64, 64); x.restore();
});
def('beam', 32, 64, (x) => {
  x.fillStyle = lin(x, 0, 0, 0, 64, [[0, 'rgba(255,224,150,0.7)'], [1, 'rgba(255,224,150,0)']]); x.beginPath(); x.moveTo(8, 0); x.lineTo(24, 0); x.lineTo(32, 64); x.lineTo(0, 64); x.closePath(); x.fill();
});
def('godray', 96, 128, (x) => {
  for (let i = 0; i < 5; i++) { const ox = 8 + i * 18; x.fillStyle = lin(x, 0, 0, 0, 128, [[0, 'rgba(255,230,170,0.5)'], [1, 'rgba(255,230,170,0)']]); x.beginPath(); x.moveTo(ox, 0); x.lineTo(ox + 8 + (i % 2) * 4, 0); x.lineTo(ox + 30, 128); x.lineTo(ox + 14, 128); x.closePath(); x.fill(); }
});
def('vignette', 480, 270, (x) => {
  x.fillStyle = radial(x, 240, 135, 300, [[0, 'rgba(40,20,70,0)'], [0.6, 'rgba(40,20,70,0.05)'], [1, 'rgba(30,14,56,0.55)']]); x.fillRect(0, 0, 480, 270);
});
def('smoke', 16, 16, (x, r) => {
  for (let i = 0; i < 4; i++) { const cx = 5 + r() * 6, cy = 5 + r() * 6, rr = 3 + r() * 2.4; x.fillStyle = radial(x, cx, cy, rr, [[0, 'rgba(250,245,245,0.8)'], [0.6, 'rgba(240,235,240,0.4)'], [1, 'rgba(240,235,240,0)']]); x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); }
}, 61);
def('star', 9, 9, (x) => {
  x.fillStyle = radial(x, 4.5, 4.5, 4.5, [[0, 'rgba(255,248,215,1)'], [1, 'rgba(255,248,215,0)']]); x.fillRect(0, 0, 9, 9);
  x.fillStyle = '#fff'; x.fillRect(4.1, 0.6, 0.8, 7.8); x.fillRect(0.6, 4.1, 7.8, 0.8);
});

export function buildWeatherTextures(): Record<string, HTMLCanvasElement> { return T; }
export const WEATHER_KEYS = Object.keys(T);
