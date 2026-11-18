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
      const seen = new Set();
      const collect = async () => { for (const x of await s.qa('visibleTexts').catch(() => [])) seen.add(x); };
      const onTick = async (st) => {
        await collect();
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
      // 通关后的演出（终章等）逐帧采集文字，避免错过一闪而过的字幕/横幅
      for (let i = 0; i < 200; i++) { const st1 = await s.state(); await collect(); if (!st1.locked && !st1.seqRunning && i > 3) break; await sleep(500); }
      for (let i = 0; i < 24; i++) { await collect(); await sleep(500); }   // 演出结束后再看 12s（结尾面板在 banner.done 后 6.2s）
      await s.shot('after-finale');
      const st = await s.state();
      { const w = Object.entries(st.npcs ?? {}).filter(([, n]) => n.warps > 0).map(([k, n]) => `${k}:${n.warps}`);
        t.note('npcWarps', { w, logs: s.warpLogs ?? [] });
        // 终章 gather 序列内的行走兜底可接受；afu lull→goto 触发为已知 BUG-011(P3)
        const real = w.filter((x) => !(storyId === 'finale_story') && !x.startsWith('afu:'));
        t.ok(real.length === 0, `主线正常通关无意外 NPC 瞬移（${w.join(',') || 0}）`);
        if (w.some((x) => x.startsWith('afu:'))) t.ok(false, `阿福 lull 后 goto 触发看门狗瞬移（${w.join(',')}）`, { bug: 'BUG-011' }); }
      for (const c of checklist) t.ok(st.checklist.includes(c), `清单“${c}”已打勾`, { detail: st.checklist });
      t.ok(st.warmth > 0, `暖度 > 0（${st.warmth}）`);
      t.ok(overlapHits.length === 0, `通关全程气泡/面板/toast/清单无重叠（命中 ${overlapHits.length} 次）`, { detail: overlapHits.slice(0, 3), ...(overlapHits.every((h) => h.ov.every((o) => /toast/.test(o.a + o.b))) ? { bug: 'BUG-010' } : {}) });
      t.ok((await s.qa('invariants')).length === 0, '通关后世界一致性');
      if (after) await after(t, s, seen);
      t.ok(leaks.size === 0, `通关全程无未翻译 key/undefined 外露（${leaks.size}）`, { bug: leaks.size ? 'BUG-004' : undefined, detail: [...leaks].slice(0, 8) });
    },
  };
  return spec;
}
