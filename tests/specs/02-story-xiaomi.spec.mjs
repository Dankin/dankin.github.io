import { runIfMain } from '../lib/spec.mjs';
import { playStory } from '../lib/driver.mjs';
import { sleep } from '../lib/session.mjs';

const spec = {
  id: '02-story-xiaomi', title: '故事·小米：真实点击通关（点物件→点招式），全程 UI 遮挡检测', tags: ['story', 'realclick'], timeout: 240000,
  async run(t) {
    const s = await t.launch({ device: 'desktop', name: 'desk' });
    await s.goto({ fresh: true });
    await s.start();
    const overlapHits = [];
    let maxBubbles = 0;
    const onTick = async (st) => {
      maxBubbles = Math.max(maxBubbles, st.bubbles.length);
      const ov = await s.qa('overlaps');
      if (ov.length) { overlapHits.push({ at: st.now, ov }); if (overlapHits.length === 1) await s.shot('overlap-first'); }
    };
    const r = await playStory(s, 'xiaomi_story', { t, onTick, shotEachStep: true });
    t.note('xiaomi', r);
    t.ok(r.ok, `小米故事真实点击通关（${(r.ms / 1000).toFixed(0)}s，步骤 ${r.steps.join('>')}）`, { detail: r });
    await s.waitIdle({ timeout: 90000 }).catch(() => {});
    await sleep(1000);
    await s.shot('after-finale');
    const st = await s.state();
    t.ok(st.checklist.includes('xiaomi_sung'), '清单“小米开口唱歌”已打勾', { detail: st.checklist });
    t.ok(st.warmth > 0, `暖度 > 0（${st.warmth}）`);
    t.ok(overlapHits.length === 0, `通关全程气泡/面板/toast/清单无重叠（命中 ${overlapHits.length} 次）`, { detail: overlapHits.slice(0, 3) });
    t.ok((await s.qa('invariants')).length === 0, '通关后世界一致性');
    t.note('maxBubbles', maxBubbles);
  },
};
export default spec;
await runIfMain(import.meta.url, spec);
