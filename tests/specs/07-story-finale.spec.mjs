import { runIfMain } from '../lib/spec.mjs';
import { storySpec } from '../lib/storyspec.mjs';
import { sleep } from '../lib/session.mjs';
// 终章：先真实点击通关前 5 条故事，再点亮 5 盏路灯 + 圣诞树；检查终章台词与结尾面板
const spec = storySpec({
  id: '07-story-finale', storyId: 'finale_story', title: '终章', timeout: 1800000,
  pre: ['xiaomi_story', 'afu_story', 'laozhou_story', 'xiaolan_story', 'adong_story'], checklist: [],
  async after(t, s) {
    // 终章演出结束后应出现终章台词与结尾面板（banner.done 后约 6.2s）
    let found = null;
    for (let i = 0; i < 60 && !found; i++) {
      const tx = await s.qa('visibleTexts');
      found = tx.find((x) => /May all the beauty in the world be blessed/i.test(x)) ?? null;
      if (!found) await sleep(1500);
    }
    t.ok(!!found, '终章台词 "May all the beauty in the world be blessed." 出现', { detail: found });
    await s.shot('finale-line');
    await sleep(8000);
    await s.shot('finale-end');
    const btns = await s.qa('uiButtons');
    t.ok(btns.length > 0, '结尾面板有可点按钮（重玩/关闭）', { detail: btns.map((b) => b.qa ?? b.label) });
  },
});
export default spec;
await runIfMain(import.meta.url, spec);
