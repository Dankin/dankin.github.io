// 仅供 art-world 自检：http://127.0.0.1:5173/src/art/env/preview.html?set=brush
import { mkTex, paint, pEllipse, pRect, pBlob, pPoly, ink, softShadow, PAL, blob, shade } from '../brush';
import { SS, ART_SCALE, PX, NATIVE_SCALE } from '../scale';
import { OX, OY, toScreen } from '../../core/iso';
import { WALLS, DECOR, PROPS } from '../../core/data';
import { buildGroundChunks } from './ground';
import { buildWall, WALL_VARIANTS } from './facade';
import { buildPropTextures } from './props';
import { buildBackdrops } from './backdrop';
import { buildWeatherTextures } from './weather';

const q = new URLSearchParams(location.search);
const set = q.get('set') ?? 'brush';
const zoom = parseFloat(q.get('zoom') ?? '2');
const app = document.getElementById('app')!;
function show(name: string, c: HTMLCanvasElement, k = zoom) {
  const d = document.createElement('div'); d.className = 'c';
  c.style.width = (c.width / SS * k) + 'px'; c.style.height = (c.height / SS * k) + 'px';
  d.appendChild(c); const t = document.createElement('div'); t.textContent = name; d.appendChild(t); app.appendChild(d);
}
(async () => {
  if (set === 'brush') {
    show('shapes', mkTex(120, 80, (x) => {
      paint(x, pRect(4, 6, 40, 30), { fill: PAL.brick });
      paint(x, pEllipse(70, 22, 18, 14), { fill: PAL.green });
      paint(x, pBlob(100, 22, 14, 12), { fill: PAL.snow, fill2: PAL.snowShade });
      paint(x, pPoly([[10, 50], [50, 44], [60, 70], [12, 74]]), { fill: PAL.wood });
      blob(x, 80, 60, 6, PAL.red); blob(x, 96, 60, 4, PAL.gold); blob(x, 108, 60, 3, PAL.blue);
      ink(x, [[4, 78], [60, 76], [118, 79]], { w: 1.1 });
      softShadow(x, 90, 74, 20, 4);
    }), 5);
  }
  if (set === 'ground') {
    const snow = q.get('snow') === '1';
    const t0 = performance.now();
    const base = buildGroundChunks(false), sn = buildGroundChunks(true);
    const all = base.concat(snow ? sn : []);
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const c of all) { minx = Math.min(minx, c.x); miny = Math.min(miny, c.y); maxx = Math.max(maxx, c.x + c.w); maxy = Math.max(maxy, c.y + c.h); }
    const k = parseFloat(q.get('k') ?? '1');
    const cv = document.createElement('canvas'); cv.width = (maxx - minx) * k; cv.height = (maxy - miny) * k;
    const g = cv.getContext('2d')!; g.imageSmoothingQuality = 'high';
    const only = q.get('only');
    for (const c of all) { if (only && !c.key.endsWith(only)) continue; const t1 = performance.now(); const b = c.build(); console.log(c.key, b.width, b.height, Math.round(performance.now() - t1) + 'ms'); g.drawImage(b, (c.x - minx) * k, (c.y - miny) * k, c.w * k, c.h * k); }
    console.log('total', Math.round(performance.now() - t0) + 'ms');
    app.appendChild(cv);
  }
  if (set === 'wall') {
    const only = q.get('only'); const side = (q.get('side') ?? 'ne') as 'ne' | 'nw';
    for (const v of WALL_VARIANTS) { if (only && !only.includes(v)) continue; const t0 = performance.now(); const w = buildWall(side, v); console.log('wall', v, w.canvas.width, w.canvas.height, Math.round(performance.now() - t0) + 'ms', w.windows.length); show(side + '_' + v, w.canvas, zoom); }
  }
  if (set === 'props') {
    const only = q.get('only')?.split(',');
    const t0 = performance.now(); const T = buildPropTextures(); console.log('props total', Math.round(performance.now() - t0) + 'ms', Object.keys(T).length);
    for (const [k, c] of Object.entries(T)) { if (only && !only.includes(k)) continue; show(k, c, zoom); }
  }
  if (set === 'backdrop') {
    const t0 = performance.now(); const B = buildBackdrops(); console.log('backdrops', Math.round(performance.now() - t0) + 'ms');
    for (const [k, c] of Object.entries(B)) show(k, c, zoom);
  }
  if (set === 'weather') {
    const t0 = performance.now(); const B = buildWeatherTextures(); console.log('weather', Math.round(performance.now() - t0) + 'ms');
    for (const [k, c] of Object.entries(B)) { if (k === 'vignette') continue; show(k, c, zoom); }
    // 雨/雪叠在一张暗底上看
    const cv = document.createElement('canvas'); cv.width = 384; cv.height = 256; const g = cv.getContext('2d')!; g.fillStyle = '#4a4a6a'; g.fillRect(0, 0, 384, 256);
    for (const k of ['rain', 'snowtile_0', 'snowtile_1', 'snowtile_2']) { const t = B[k]; for (let x = 0; x < 384; x += t.width / SS) for (let y = 0; y < 256; y += t.height / SS) g.drawImage(t, x, y, t.width / SS, t.height / SS); }
    document.body.appendChild(cv);
  }
  if (set === 'scene') {
    // 合成一帧“游戏画面”：以瓦片 (tx,ty) 为画面中心，1280×720；night=1 夜景
    const tx = parseFloat(q.get('tx') ?? '10'), ty = parseFloat(q.get('ty') ?? '10'), night = q.get('night') === '1', snow = q.get('snow') === '1';
    const VW = 1280, VH = 720;
    const cv = document.createElement('canvas'); cv.width = VW; cv.height = VH; const g = cv.getContext('2d')!; g.imageSmoothingQuality = 'high';
    const c0 = toScreen(tx, ty); const ox = c0.x - VW / 2, oy = c0.y - VH / 2 - 40;
    const bd = buildBackdrops(); g.drawImage(night ? bd.backdrop_night : bd.backdrop, 0, 0, VW, VH);
    const t0 = performance.now();
    const draw = (c: HTMLCanvasElement, x: number, y: number, k = ART_SCALE, ax = 0, ay = 0) => g.drawImage(c, x - ox - ax, y - oy - ay, c.width * k, c.height * k);
    for (const ch of buildGroundChunks(false)) { if (ch.x + ch.w < ox || ch.x > ox + VW || ch.y + ch.h < oy || ch.y > oy + VH) continue; draw(ch.build(), ch.x, ch.y); }
    if (snow) for (const ch of buildGroundChunks(true)) { if (ch.x + ch.w < ox || ch.x > ox + VW || ch.y + ch.h < oy || ch.y > oy + VH) continue; draw(ch.build(), ch.x, ch.y); }
    const P = buildPropTextures(); const items: { y: number; f: () => void }[] = [];
    const wcache: Record<string, any> = {};
    for (const w of WALLS) {
      const k = w.side + w.v; const W = wcache[k] ?? (wcache[k] = buildWall(w.side, w.v)); const o = toScreen(w.tx, w.ty);
      if (o.x < ox - 700 || o.x > ox + VW + 700 || o.y < oy - 300 || o.y > oy + VH + 400) continue;
      items.push({ y: o.y - 5000, f: () => draw(W.canvas, o.x, o.y, ART_SCALE, W.ax * PX, W.ay * PX) });
    }
    const spr = (tex: string, pos: number[], sc = 1) => { const c = P[tex]; if (!c) return; const s = toScreen(pos[0], pos[1]); if (s.x < ox - 100 || s.x > ox + VW + 100 || s.y < oy - 100 || s.y > oy + VH + 200) return;
      items.push({ y: s.y, f: () => { const sh = P.shadow; g.globalAlpha = 0.4; draw(sh, s.x - sh.width * NATIVE_SCALE * 0.45, s.y + 4 - sh.height * NATIVE_SCALE * 0.35, NATIVE_SCALE * 0.9); g.globalAlpha = 1; draw(c, s.x - c.width * ART_SCALE * sc / 2, s.y + 2 - c.height * ART_SCALE * sc, ART_SCALE * sc); } }); };
    for (const d of DECOR) spr(d.tex, d.pos, d.scale ?? 1);
    for (const p of Object.values(PROPS)) spr(p.tex, p.pos);
    items.sort((a, b) => a.y - b.y).forEach((i) => i.f());
    if (night) { g.fillStyle = 'rgba(27,33,80,0.4)'; g.fillRect(0, 0, VW, VH); }
    console.log('scene', Math.round(performance.now() - t0) + 'ms', 'walls', WALLS.length, 'decor', DECOR.length);
    app.appendChild(cv);
  }
})();
