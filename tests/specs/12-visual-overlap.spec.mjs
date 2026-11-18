import { runIfMain } from '../lib/spec.mjs';
import { sleep } from '../lib/session.mjs';

// 遍历所有区域 × 昼夜阶段：截图 + 遮挡 + 穿帮 + 文本裁切。分辨率：桌面 + 手机横屏
const spec = {
  id: '12-visual-overlap', title: '视觉：区域×昼夜截图、UI 遮挡、穿帮（NPC 入水/建筑、物件悬空、出界）', tags: ['visual'], timeout: 300000,
  async run(t) {
    for (const device of ['desktop', 'phone']) {
      const s = await t.launch({ device, name: device === 'phone' ? 'phone' : 'desk' });
      await s.goto({ fresh: true });
      await s.start();
      const d = await s.qa('data');
      const regions = d.regions ?? [];
      const phases = d.phases ?? ['morning', 'noon', 'dusk', 'night'];
      t.ok(regions.length > 0, `[${device}] 读到区域列表（${regions.length}）`);
      for (const r of regions) {
        await s.qa('teleportToRegion', r.id ?? r);
        await sleep(600);
        for (const ph of phases) {
          await s.qa('setPhase', ph.id ?? ph, 0);
          await sleep(500);
          const key = `${r.id ?? r}-${ph.id ?? ph}`;
          await s.shot(key);
          const ov = await s.qa('overlaps');
          t.ok(ov.length === 0, `[${device}] ${key} UI 无重叠`, { detail: ov });
          const clip = await s.qa('clippedTexts');
          t.ok(clip.length === 0, `[${device}] ${key} 文本无裁切`, { detail: clip });
          const leak = await s.qa('textLeaks');
          t.ok(leak.length === 0, `[${device}] ${key} 无未翻译 key/undefined 外露`, { bug: leak.length ? 'BUG-004' : undefined, detail: leak.slice(0, 6) });
          const inv = await s.qa('invariants');
          t.ok(inv.length === 0, `[${device}] ${key} 世界一致性（无入水/入建筑/悬空/出界）`, { detail: inv });
        }
      }
      if (device === 'phone') {
        const tt = await s.qa('touchTargets');
        const small = tt.filter((x) => Math.min(x.w, x.h) < 44);
        t.ok(small.length === 0, `[phone] 可点目标均 ≥44px（小于的 ${small.length} 个）`, { bug: small.length ? 'BUG-001' : undefined, detail: small });
        t.note('uiTargets', tt);
      }
    }
  },
};
export default spec;
await runIfMain(import.meta.url, spec);
