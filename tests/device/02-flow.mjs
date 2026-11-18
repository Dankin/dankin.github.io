// 生产构建端到端：标题→新游戏→点地飞行→附身→招式→存档→刷新→继续；0 console error / 0 失败请求；多设备截图与 UI 核对。
// 用法：QA_URL=http://127.0.0.1:5189 node 02-flow.mjs [设备,...]   例：node 02-flow.mjs desktop,desktop-hd,iphone,android,portrait
//       QA_URL 可带子路径：QA_URL=http://127.0.0.1:5190/sub/path
// 注意：QA_URL 不能以 / 结尾。输出 out/02-flow.json 与 out/<设备>/*.png
import { mkdirSync, writeFileSync } from 'node:fs';
import { Session, DEVICES, sleep } from '../lib/session.mjs';
import { BASE_URL } from '../lib/pw.mjs';
import { uiTrue, titleButtons, STABLE_ARGS } from './lib.mjs';

DEVICES['desktop-hd'] = { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 };
DEVICES.iphone = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
DEVICES.android = { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' };
DEVICES.portrait = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true };

async function startGame(s, mode) {
  const vp = s.page.viewportSize();
  for (let i = 0; i < 6 && !(await s.state()).started; i++) {
    const tb = titleButtons(await uiTrue(s));
    if (tb.length >= 2) { const pick = mode === 'continue' ? tb[0] : tb[tb.length - 1]; await s.mouseClick(pick.x, pick.y); }
    else await s.mouseClick(vp.width / 2, vp.height * 0.42);
    await sleep(900);
  }
}
const list = (process.argv[2] || 'desktop,desktop-hd,iphone,android,portrait').split(',');
const OUT = new URL('./out/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const all = [];
let exit = 0;

for (const dev of list) {
  const outDir = OUT + dev; mkdirSync(outDir, { recursive: true });
  const checks = []; const ok = (c, m, d) => { checks.push({ ok: !!c, msg: m, detail: d }); if (!c) exit = 1; console.log(c ? '  ✓' : '  ✗', `[${dev}]`, m, c ? '' : JSON.stringify(d ?? '').slice(0, 300)); };
  const s = await Session.launch({ device: dev, name: dev, outDir, args: process.env.GPU_DEFAULT ? [] : STABLE_ARGS });
  const rec = { device: dev, checks, metrics: {}, shots: [] };
  try {
    const t0 = Date.now();
    await s.goto({ fresh: true, timeout: 600000 });
    rec.metrics.sceneReadyMs = Date.now() - t0;
    await sleep(800);
    const vp = s.page.viewportSize();
    // —— 竖屏：#rotate 遮罩 ——
    const rot = await s.page.evaluate(() => { const r = document.getElementById('rotate'); const cs = getComputedStyle(r); const b = r.getBoundingClientRect(); return { display: cs.display, w: b.width, h: b.height, z: cs.zIndex }; });
    rec.metrics.rotate = rot;
    if (vp.height > vp.width) {
      ok(rot.display !== 'none' && rot.w >= vp.width - 1 && rot.h >= vp.height - 1, '竖屏显示“请横屏游玩”全屏遮罩', rot);
      await s.shot('portrait-overlay');
      // 遮罩下点击不应穿透到游戏
      const top = await s.page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id || document.elementFromPoint(x, y)?.tagName, [vp.width / 2, vp.height / 2]);
      ok(top === 'rotate' || top === 'I' || top === 'BR' || top === 'SMALL' || top === 'DIV', '遮罩位于最上层（点击不穿透）', top);
      await s.close(); all.push(rec); continue;
    } else ok(rot.display === 'none', '横屏时遮罩隐藏', rot);
    const dpr = await s.page.evaluate(() => devicePixelRatio);
    const cv = await s.page.evaluate(() => { const c = window.__game.canvas.getBoundingClientRect(); return { x: c.x, y: c.y, w: c.width, h: c.height, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight, gw: window.__game.scale.gameSize.width, gh: window.__game.scale.gameSize.height }; });
    rec.metrics.canvas = cv; rec.metrics.dpr = dpr;
    ok(cv.sw <= cv.iw + 1 && cv.sh <= cv.ih + 1, '页面无滚动溢出', cv);
    ok(cv.w <= cv.iw + 1 && cv.h <= cv.ih + 1 && (Math.abs(cv.w - cv.iw) < 2 || Math.abs(cv.h - cv.ih) < 2), '画布 FIT 铺满视口（宽或高贴边）', cv);

    // —— 标题屏 ——
    await s.shot('1-title');
    const tt0 = await uiTrue(s);
    rec.metrics.titleButtons = tt0;
    const smallTitle = tt0.filter((b) => Math.min(b.cssW, b.cssH) < 43.5 && b.cssW < 700 && b.depth !== 1000).map((b) => `${b.qa ?? b.depth}:${b.cssW}×${b.cssH}`);
    ok(smallTitle.length === 0, '标题屏可点按钮 CSS ≥44px', smallTitle);

    // —— 新游戏 ——
    await startGame(s, 'new');
    ok((await s.state()).started, '点击标题 → 游戏开始');
    await sleep(800);
    await s.shot('2-started');
    // HUD 按钮尺寸 / 重叠
    const tt = await uiTrue(s);
    const small = tt.filter((b) => Math.min(b.cssW, b.cssH) < 43.5 && b.cssW < 900 && b.depth < 1000);
    rec.metrics.hudTargets = tt;
    ok(small.length === 0, 'HUD 可点按钮 CSS ≥44×44', small.map((b) => `${b.qa ?? b.label}:${b.cssW}×${b.cssH}`));
    const ov = await s.qa('overlaps'); ok(ov.length === 0, 'HUD/气泡/面板 无重叠', ov);

    // —— 点地飞行 ——
    const before = (await s.state()).hat;
    const props = Object.values((await s.qa('data')).props).map((d) => d.pos);
    let p = null, best = 0;
    for (let dx = -7; dx <= 7; dx++) for (let dy = -7; dy <= 7; dy++) {
      if (Math.hypot(dx, dy) < 3) continue;
      const tx = before.x + dx, ty = before.y + dy;
      const md = Math.min(...props.map((q) => Math.hypot(q[0] - tx, q[1] - ty)));
      if (md <= best || md < 1.6) continue;
      const q = await s.qa('groundPoint', tx, ty);
      if (q?.onScreen && q.x > 60 && q.y > 60 && q.x < vp.width - 60 && q.y < vp.height - 60 && !(await s.qa('uiHitAt', q.x, q.y)).length) { p = q; best = md; }
    }
    if (!p) ok(false, '找不到可点空地');
    else {
      await s.mouseClick(p.x, p.y);
      await s.waitState('s=>s.hat.moving', { timeout: 3000 }).catch(() => {});
      await s.waitState('s=>!s.hat.moving', { timeout: 15000 }).catch(() => {});
      const after = (await s.state()).hat;
      ok(Math.hypot(after.x - before.x, after.y - before.y) > 1, '点地面 → 帽子飞行位移', { before, after });
    }
    await s.shot('3-flown');

    // —— 附身 + 招式 ——
    // 选屏幕内最近的、有招式的物件
    const hat = (await s.state()).hat;
    const cand = Object.entries((await s.qa('data')).props).filter(([, d]) => d.moves?.length).map(([id, d]) => ({ id, d, dist: Math.hypot(d.pos[0] - hat.x, d.pos[1] - hat.y) })).sort((a, b) => a.dist - b.dist);
    let chosen = null;
    for (const c of cand.slice(0, 8)) { const q = await s.qa('propPoint', c.id); if (q?.onScreen && q.x > 40 && q.y > 40 && q.x < vp.width - 40 && q.y < vp.height - 40) { chosen = c; break; } }
    if (!chosen) ok(false, '屏幕内无可附身物件');
    else {
      await s.possess(chosen.id);
      const st = await s.state();
      ok(st.hat.attachedTo === chosen.id && st.panelOpen, `点物件 ${chosen.id} → 附身并弹出招式面板`, { att: st.hat.attachedTo, panel: st.panelOpen });
      await s.shot('4-possessed-panel');
      const ttp = await uiTrue(s);
      const smallP = ttp.filter((b) => Math.min(b.cssW, b.cssH) < 43.5 && b.cssW < 900 && b.depth < 1000);
      ok(smallP.length === 0, '招式面板按钮 CSS ≥44×44', smallP.map((b) => `${b.qa ?? b.label}:${b.cssW}×${b.cssH}`));
      const ovp = await s.qa('overlaps'); ok(ovp.length === 0, '面板打开时 UI 无重叠', ovp);
      const mv = chosen.d.moves[0];
      const pre = await s.state();
      { const mb = (await uiTrue(s)).find((b) => b.qa && b.qa.startsWith('move:')); if (mb) await s.mouseClick(mb.x, mb.y); else await s.clickMoveButton(mv); }
      await sleep(1500);
      const post = await s.state();
      ok(Object.keys(post.cooldowns || {}).length > Object.keys(pre.cooldowns || {}).length || post.stimuli.length !== pre.stimuli.length || post.warmth !== pre.warmth || post.locked !== pre.locked, `使用招式 ${mv} 生效`, { pre: [pre.warmth, pre.stimuli.length, pre.cooldowns], post: [post.warmth, post.stimuli.length, post.cooldowns] });
      await s.shot('5-move-used');
      rec.moveUsed = { prop: chosen.id, move: mv };
    }

    // —— 存档 → 刷新 → 继续 ——
    await sleep(500);
    await s.blurFocus(400); // 页面隐藏触发存档
    await sleep(300);
    const sv = await s.qa('readSave', 'christmas-hat/save');
    ok(sv && sv.value && sv.value.v === 1, '页面隐藏时写入 localStorage 存档', sv && { bytes: sv.bytes, keys: sv.keys });
    const beforeHat = (await s.state()).hat;
    s.expectNav = true; await s.page.reload({ waitUntil: 'load', timeout: 600000 }); s.expectNav = false; await s.waitSceneReady(600000);
    await sleep(800);
    await s.shot('6-after-reload-title');
    const stR = await s.state(); ok(!stR.started, '刷新后回到标题');
    const btns = await uiTrue(s);
    const big = titleButtons(btns);
    ok(big.length >= 2, '有存档时标题出现“继续/新游戏”两个按钮', big.map((b) => ({ x: b.x, y: b.y, gw: b.gw })));
    await startGame(s, 'continue');
    await sleep(800);
    const stC = await s.state();
    ok(stC.started, '点击继续进入游戏');
    ok(Math.hypot(stC.hat.x - beforeHat.x, stC.hat.y - beforeHat.y) < 1.5, '继续后帽子位置与存档一致', { beforeHat, now: stC.hat });
    await s.shot('7-continued');

    // —— 渲染帧率（软件渲染，仅供参考） ——
    rec.metrics.frames = await s.frames(3);
    rec.metrics.resources = await s.qa('resources');
    ok(s.errors.length === 0, '全程 0 console error / pageerror / 失败请求 / HTTP≥400', s.errors);
    rec.errors = s.errors; rec.warnings = s.warnings.filter((w) => !/GL Driver Message|willReadFrequently/.test(w)); rec.dataWarnings = s.dataWarnings;
    ok(rec.dataWarnings.length === 0, '无 [data] 校验告警', rec.dataWarnings);
  } catch (e) { ok(false, '脚本异常: ' + (e.stack || e.message).slice(0, 400)); rec.errors = s.errors; }
  rec.shots = s.shots;
  await s.close(); all.push(rec);
}
writeFileSync(OUT + `02-flow-${new URL(BASE_URL).port || 'x'}${new URL(BASE_URL).pathname.replace(/\//g, '_')}.json`, JSON.stringify({ url: BASE_URL, at: new Date().toISOString(), results: all }, null, 1));
console.log(exit ? 'FAIL' : 'PASS');
process.exit(exit);
