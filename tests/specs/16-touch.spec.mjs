import { runIfMain } from '../lib/spec.mjs';
import { sleep } from '../lib/session.mjs';

const spec = {
  id: '16-touch', title: '触屏：844×390/667×375 点击移动、点物件、拖动、长按、捏合、按钮尺寸', tags: ['touch'], timeout: 200000,
  async run(t) {
    for (const device of ['phone', 'phone-small']) {
      const s = await t.launch({ device, name: device });
      await s.goto({ fresh: true });
      await s.tap(...(await centre(s)));
      await s.waitState('s=>s.started', { timeout: 6000, msg: '触屏点标题开始' }).catch(() => {});
      t.ok((await s.state()).started, `[${device}] 触屏点击开始游戏`);
      const sz = await s.page.evaluate(() => ({ w: innerWidth, h: innerHeight, sx: scrollX, sy: scrollY, dsw: document.documentElement.scrollWidth }));
      t.ok(sz.sx === 0 && sz.sy === 0 && sz.dsw <= sz.w + 1, `[${device}] 页面无滚动/溢出`, { detail: sz });
      // 点地面移动
      const before = (await s.state()).hat;
      // 选一块周围 2.2 格内没有任何物件、也没被 UI 盖住的空地（否则点中物件会变成"附身"）
      const props = Object.values((await s.qa('data')).props).map((d) => d.pos);
      const cands = [];
      for (let dx = -6; dx <= 6; dx += 1) for (let dy = -6; dy <= 6; dy += 1) {
        const tx = before.x + dx, ty = before.y + dy; if (Math.hypot(dx, dy) < 2.5) continue;
        const md = Math.min(...props.map((q) => Math.hypot(q[0] - tx, q[1] - ty)));
        if (md < 1.3) continue;
        const q = await s.qa('groundPoint', tx, ty);
        if (q?.onScreen && !(await s.qa('uiHitAt', q.x, q.y)).length) cands.push({ ...q, md, tile: await s.qa('tileAt', tx, ty) });
      }
      cands.sort((a, b) => b.md - a.md);
      if (!cands.length) { t.note(`[${device}] 视野内没有空地可点`); continue; }
      let moved = false, tried = [];
      for (const p of cands.slice(0, 8)) {
        await s.tap(p.x, p.y); await sleep(600);
        const mv = (await s.state()).hat; tried.push({ x: Math.round(p.x), y: Math.round(p.y), tile: p.tile, moved: !!(mv.moving || mv.x !== before.x || mv.y !== before.y) });
        if (tried[tried.length - 1].moved) { moved = true; break; }
      }
      t.ok(moved, `[${device}] 触屏点地面帽子移动`, { detail: tried });
      // 按钮尺寸
      const tt = await s.qa('touchTargets');
      const small = tt.filter((x) => Math.min(x.w, x.h) < 44);
      t.ok(small.length === 0, `[${device}] 可点目标均 ≥44px（小于 ${small.length}）`, { bug: small.length ? 'BUG-001' : undefined, detail: small });
      // 拖动/长按/捏合后页面仍然正常
      await s.drag(300, 200, 520, 200);
      await s.longPress(400, 250, 800);
      await s.pinch(420, 195, 20, 120);
      await sleep(500);
      const sz2 = await s.page.evaluate(() => ({ vv: visualViewport.scale, sx: scrollX, sy: scrollY }));
      t.ok(sz2.vv === 1 && sz2.sx === 0 && sz2.sy === 0, `[${device}] 捏合/拖动后页面未缩放/滚动`, { detail: sz2 });
      t.ok((await s.qa('overlaps')).length === 0, `[${device}] 无 UI 重叠`);
      await s.shot('after-gestures');
    }
  },
};
async function centre(s) { const v = s.page.viewportSize(); return [v.width / 2, v.height / 2]; }
export default spec;
await runIfMain(import.meta.url, spec);
