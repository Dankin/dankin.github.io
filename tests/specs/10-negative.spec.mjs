import { runIfMain } from '../lib/spec.mjs';
import { monkey } from '../lib/driver.mjs';
import { sleep } from '../lib/session.mjs';

const spec = {
  id: '10-negative', title: '负面/边界：乱点、冷却连点、骚扰NPC、点人、失焦缩放（N-01~N-04,N-12,N-13,N-16）', tags: ['negative'], timeout: 300000,
  async run(t) {
    const s = await t.launch({ device: 'desktop', name: 'desk' });
    await s.goto({ fresh: true });
    // N-01 标题屏乱点 + 开场后猴子测试
    await s.mouseClick(480, 270); // 开始
    await sleep(500);
    for (const seed of [1, 2, 3]) {
      const r = await monkey(s, { n: 60, seed });
      const st = await s.state();
      t.ok(!st.locked || (await s.waitState('s=>!s.locked', { timeout: 20000 }).then(() => true, () => false)), `N-01 猴子 seed=${seed}：locked 不会永久为真`);
      t.ok((await s.qa('invariants')).length === 0, `N-01 猴子 seed=${seed}：世界一致性`, { detail: await s.qa('invariants') });
      const ov = await s.qa('overlaps'); t.ok(ov.length === 0, `N-01 猴子 seed=${seed}：UI 无遮挡`, { detail: ov });
      t.note(`monkey${seed}`, r?.counts ?? r);
    }
    await s.shot('after-monkey');
    const w = (await s.state()).warmth;
    t.ok(w >= 0 && w <= 100, `N-16 暖度在界内（${w}）`);

    // N-02 冷却连点：同一招式连点 20 次
    const st = await s.state();
    const wind = 'windchime';
    {
      const pos = (await s.qa('data')).props[wind]?.pos;
      if (pos) await s.qa('teleportHat', pos[0] + 1.5, pos[1] + 1.5);
      await sleep(600);
    }
    t.log?.('N-02');
    try {
      await s.possess(wind);
      const before = (await s.state()).bubbles.length;
      let clicks = 0;
      for (let i = 0; i < 20; i++) { try { await s.clickMoveButton('chime_ring', { timeout: 800 }); clicks++; } catch { break; } await sleep(60); }
      await sleep(1500);
      const s2 = await s.state();
      t.ok(s2.bubbles.length <= before + 6, `N-02 冷却中连点 ${clicks} 次，气泡数受控（${s2.bubbles.length}）`);
      t.ok((await s.qa('overlaps')).length === 0, 'N-02 连点后无 UI 重叠');
    } catch (e) { t.ok(false, 'N-02 无法完成：' + e.message); }

    // N-03/04 骚扰 NPC：连点同一个 NPC 30 次
    await s.dismissPanel();
    const npcs = Object.keys((await s.state()).npcs);
    let target = null;
    for (const id of npcs) { const p = await s.qa('npcPoint', id); if (p?.onScreen) { target = id; break; } }
    if (target) {
      let n = 0;
      for (let i = 0; i < 30; i++) { try { await s.clickNpc(target); n++; } catch { break; } await sleep(80); }
      await sleep(600);
      const s3 = await s.state();
      t.ok((Array.isArray(s3.toasts) ? s3.toasts.length : s3.toasts) <= 2, `N-03 连点 NPC ${n} 次，toast 不堆叠（${Array.isArray(s3.toasts) ? s3.toasts.length : s3.toasts}）`);
      t.ok(!s3.hat.attachedTo || !npcs.includes(s3.hat.attachedTo), 'N-04 帽子没有附身到人');
      t.ok((await s.qa('overlaps')).length === 0, 'N-03 骚扰 NPC 后无 UI 重叠');
      await s.shot('annoy-npc');
    } else t.note('N-03', '屏内无 NPC，跳过');

    // N-12 缩放/失焦
    for (const [w2, h2] of [[1920, 1080], [960, 540], [390, 844], [1280, 720]]) {
      await s.resize(w2, h2);
      const ov = await s.qa('overlaps');
      t.ok(ov.length === 0, `N-12 ${w2}×${h2} 下无 UI 重叠`, { detail: ov });
      await s.shot(`resize-${w2}x${h2}`);
    }
    const t0 = (await s.state()).now;
    await s.blurFocus(3000);
    const t1 = (await s.state()).now;
    t.ok(t1 - t0 < 30, `N-12 失焦 3s 后游戏时间不暴涨（Δ${(t1 - t0).toFixed(1)}s）`);
  },
};
export default spec;
await runIfMain(import.meta.url, spec);
