// 故事通关脚本工厂：真实点击（playStory），先按 pre 顺序通前置故事，再通本故事；故事不在数据里则 skip。
import { playStory } from './driver.mjs';
import { runIfMain } from './spec.mjs';
import { sleep } from './session.mjs';

export function storySpec({ file, id, storyId, title, pre = [], checklist = [], timeout = 360000, shots = true, after }) {
  const spec = {
    id, title: `故事·${title}：真实点击通关（点物件→点招式），全程 UI 遮挡检测`, tags: ['story', 'realclick'], timeout,
    async run(t) {
      const s = await t.launch({ device: 'desktop', name: 'desk' });
      await s.goto({ fresh: true });
      await s.start();
      const st0 = await s.state();
      for (const need of [...pre, storyId]) {
        if (!st0.stories?.[need]) t.skip(`数据里还没有故事 ${need}（待 dev-story/product 交付）`);
      }
      const overlapHits = [];
      const leaks = new Set();
      const onTick = async (st) => {
        for (const l of await s.qa('textLeaks')) leaks.add(l.text);
        const ov = await s.qa('overlaps');
        if (ov.length) { overlapHits.push({ at: st.now, ov }); if (overlapHits.length === 1) await s.shot('overlap-first'); }
      };
      for (const p of pre) {
        const r = await playStory(s, p, { t, onTick });
        t.ok(r.ok, `前置故事 ${p} 真实点击通关`, { detail: r });
        if (!r.ok) t.fatal(`前置 ${p} 未通关，终止`);
        await s.waitIdle({ timeout: 90000 }).catch(() => {});
      }
      const r = await playStory(s, storyId, { t, onTick, shotEachStep: shots });
      t.note(storyId, r);
      t.ok(r.ok, `${storyId} 真实点击通关（${(r.ms / 1000).toFixed(0)}s，步骤 ${r.steps.join('>')}）`, { detail: r });
      await s.waitIdle({ timeout: 90000 }).catch(() => {});
      await sleep(1000);
      await s.shot('after-finale');
      const st = await s.state();
      for (const c of checklist) t.ok(st.checklist.includes(c), `清单“${c}”已打勾`, { detail: st.checklist });
      t.ok(st.warmth > 0, `暖度 > 0（${st.warmth}）`);
      t.ok(overlapHits.length === 0, `通关全程气泡/面板/toast/清单无重叠（命中 ${overlapHits.length} 次）`, { detail: overlapHits.slice(0, 3) });
      t.ok((await s.qa('invariants')).length === 0, '通关后世界一致性');
      if (after) await after(t, s);
      t.ok(leaks.size === 0, `通关全程无未翻译 key/undefined 外露（${leaks.size}）`, { bug: leaks.size ? 'BUG-004' : undefined, detail: [...leaks].slice(0, 8) });
    },
  };
  return spec;
}
