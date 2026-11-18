import { runIfMain } from '../lib/spec.mjs';
import { sleep } from '../lib/session.mjs';

// 视觉验收：各区域 × 各时段 截图归档（人工/视觉比对用）+ 自动检查穿帮（NPC/物件落在水/墙）、UI 重叠、文案外露
const spec = {
  id: '13-shots', title: '视觉验收截图：6 区域 × 4 时段（桌面）+ 手机横屏抽样', tags: ['visual', 'shots'], timeout: 420000,
  async run(t) {
    const s = await t.launch({ device: 'desktop', name: 'desk' });
    await s.goto({ fresh: true }); await s.start();
    const d = await s.qa('data');
    const regions = (d.regions ?? []).map((r) => r.id ?? r);
    const phases = ['morning', 'noon', 'dusk', 'night'];
    const bad = [], ov = [], leaks = new Set();
    for (const ph of phases) {
      await s.qa('setPhase', ph, 0.01); await sleep(900);
      for (const r of regions) {
        await s.qa('teleportToRegion', r); await sleep(1200);
        await s.shot(`${ph}-${r}`);
        bad.push(...(await s.qa('invariants')).map((b) => ({ ph, r, ...b })));
        ov.push(...(await s.qa('overlaps')).map((o) => ({ ph, r, ...o })));
        for (const l of await s.qa('textLeaks')) leaks.add(l.text);
      }
    }
    const uniq = [...new Map(bad.map((b) => [JSON.stringify([b.k, b.id, b.tile]), b])).values()];
    t.ok(uniq.length === 0, `NPC/物件不落在水/墙/界外（${uniq.length} 项）`, { detail: uniq.slice(0, 12) });
    t.ok(ov.length === 0, `各区域各时段无 UI 重叠（${ov.length} 次）`, { detail: ov.slice(0, 5) });
    t.ok(leaks.size === 0, '无文案 key 外露', { detail: [...leaks] });
    // 手机横屏抽样
    const p = await t.launch({ device: 'phone', name: 'phone' });
    await p.goto({ fresh: true }); await p.start();
    for (const r of regions.slice(0, 3)) { await p.qa('teleportToRegion', r); await sleep(1200); await p.shot(`phone-${r}`); }
    t.note('shots', { regions, phases });
  },
};
export default spec;
await runIfMain(import.meta.url, spec);
