// 真实 CSS 像素触控目标尺寸表（HUD、招式面板、标题屏），按 uiCam 换算。node 06-touch-sizes.mjs desktop,desktop-hd,iphone,android → out/06-touch-sizes.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { Session, DEVICES, sleep } from '../lib/session.mjs';
import { uiTrue, startGame, STABLE_ARGS } from './lib.mjs';
DEVICES['desktop-hd'] = { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 };
DEVICES.iphone = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
DEVICES.android = { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' };
const OUT = new URL('./out/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const list = (process.argv[2] || 'desktop,desktop-hd,iphone,android').split(',');
const res = {};
for (const dev of list) {
  const s = await Session.launch({ device: dev, name: 'touch-' + dev, outDir: OUT + 'touch-' + dev, args: STABLE_ARGS });
  await s.goto({ fresh: true, timeout: 600000 }); await sleep(800);
  const row = { canvas: await s.page.evaluate(() => { const r = window.__game.canvas.getBoundingClientRect(); return { w: +r.width.toFixed(0), h: +r.height.toFixed(0), z: window.__game.scene.getScene('game').uiCam.zoom }; }) };
  const fmt = (arr) => arr.filter((b) => b.depth < 1000 && b.cssW < 900).map((b) => ({ id: b.qa ?? b.label ?? '?', w: b.cssW, h: b.cssH }));
  row.title = (await uiTrue(s)).filter((b) => b.depth >= 1001).map((b) => ({ id: b.qa ?? b.label ?? '?', w: b.cssW, h: b.cssH }));
  await startGame(s, 'new'); await sleep(600);
  row.hud = fmt(await uiTrue(s));
  const hat = (await s.state()).hat; const vp = s.page.viewportSize();
  const cand = Object.entries((await s.qa('data')).props).filter(([, d]) => d.moves?.length).map(([id, d]) => ({ id, dist: Math.hypot(d.pos[0] - hat.x, d.pos[1] - hat.y) })).sort((a, b) => a.dist - b.dist);
  for (const c of cand.slice(0, 8)) { const q = await s.qa('propPoint', c.id); if (q?.onScreen && q.x > 40 && q.y > 40 && q.x < vp.width - 40 && q.y < vp.height - 40) { await s.possess(c.id); break; } }
  await sleep(600);
  row.panel = fmt(await uiTrue(s)).filter((b) => !row.hud.some((h) => h.id === b.id && h.w === b.w));
  row.minSide = Math.min(...[...row.hud, ...row.panel, ...row.title].map((b) => Math.min(b.w, b.h)));
  row.overlaps = await s.qa('overlaps');
  res[dev] = row; console.log(dev, JSON.stringify(row).slice(0, 1200));
  await s.close?.();
}
writeFileSync(OUT + '06-touch-sizes.json', JSON.stringify(res, null, 1));
process.exit(0);
