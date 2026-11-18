import { runIfMain } from '../lib/spec.mjs';
import { storySpec } from '../lib/storyspec.mjs';
import { sleep } from '../lib/session.mjs';
// 终章：先真实点击通关前 5 条故事，再点亮 5 盏路灯 + 圣诞树；检查终章台词与结尾面板
const spec = storySpec({
  id: '07-story-finale', storyId: 'finale_story', title: '终章', timeout: 1800000,
  pre: ['xiaomi_story', 'afu_story', 'laozhou_story', 'xiaolan_story', 'adong_story'], checklist: [],
  async after(t, s, seen) {
    const all = [...seen];
    const line = all.find((x) => /May all the beauty in the world be blessed/i.test(x)) ?? null;
    t.ok(!!line, '终章台词 "May all the beauty in the world be blessed." 出现过', { detail: line });
    const epi = all.find((x) => /今天，大家都有一点点不一样了/.test(x)) ?? null;
    t.ok(!!epi, '尾声字幕 sub.epi_1（今天，大家都有一点点不一样了）出现过', { detail: epi });
    const ban = all.find((x) => /平安夜 · 通关/.test(x)) ?? null;
    t.ok(!!ban, '通关横幅 banner.complete（平安夜 · 通关。）出现过', { detail: ban });
    // 结尾面板（BUG-007 已修）：banner.complete 后 ~6.2s 弹出，含「继续散步 / 再玩一次」
    const cont = all.find((x) => /继续散步/.test(x)) ?? null;
    const replay = all.find((x) => /再玩一次/.test(x)) ?? null;
    t.ok(!!cont && !!replay, '通关后出现结尾面板（继续散步 / 再玩一次）', { detail: { cont, replay } });
    await s.shot('finale-end');
    // 点「继续散步」：面板应关闭并进入沙盒（可点地面移动）
    const modal = (await s.qa('uiButtons')).filter((b) => (b.depth ?? 0) >= 500 && b.gw > 80).sort((a, b) => a.x - b.x);
    t.note('endPanelButtons', modal.map((b) => [b.label, b.gx0, b.gy0, b.gw, b.gh]));
    if (modal.length) {
      const target = modal[0]; // 左=继续散步
      await s.mouseClick(target.x, target.y); await sleep(1200);
      const after = (await s.qa('uiButtons')).filter((b) => (b.depth ?? 0) >= 500 && b.gw > 80);
      t.ok(after.length === 0, '点「继续散步」后面板关闭，回到沙盒', { detail: after.map((b) => b.label) });
      await s.shot('sandbox-after-end');
    }
    const st = await s.state();
    t.ok(!st.locked && !st.seqRunning, '终章演出结束后解除锁定，可继续游玩（沙盒）', { detail: { locked: st.locked, seq: st.seqRunning } });
  },
});
export default spec;
await runIfMain(import.meta.url, spec);
