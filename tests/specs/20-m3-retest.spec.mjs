import { runIfMain } from '../lib/spec.mjs';
import { sleep } from '../lib/session.mjs';
import { playStory } from '../lib/driver.mjs';

// M3 复测：BUG-023（小蓝 pose 门未开 → “……缺点什么。”）/ BUG-024（阿冬 公交到站前不给误导提示）/ BUG-025（故事完成后彩蛋 halo_snowman 仍可获得）
// 全程真实点击（链：小米→阿福→老周→小蓝→阿冬）
class Stop extends Error {}
const spec = {
  id: '20-m3-retest', title: 'M3 复测 BUG-023/024/025（真实点击链）', tags: ['story', 'retest', 'slow'], timeout: 1500000,
  async run(t) {
    const s = await t.launch({ device: 'desktop', name: 'desk' });
    await s.goto({ fresh: true }); await s.start();
    const texts = async () => s.qa('visibleTexts');
    const waitText = async (re, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await texts()).some((x) => re.test(x))) return true; await sleep(250); } return false; };
    for (const id of ['xiaomi_story', 'afu_story', 'laozhou_story']) {
      const r = await playStory(s, id, { t, perStepTimeout: 32000 });
      t.ok(r.ok, `前置 ${id} 真实点击通关`, { detail: r });
      if (!r.ok) t.fatal('前置失败');
    }
    // —— BUG-023：小蓝线，bike 未完成时点雪人“摆姿势”应冒“……缺点什么。”
    let pose = null;
    try {
      await playStory(s, 'xiaolan_story', { t, perStepTimeout: 32000, onTick: async (st) => { if (st.stories.xiaolan_story?.current === 'bike' || st.stories.xiaolan_story?.done?.includes('smell')) throw new Stop(); } });
    } catch (e) { if (!(e instanceof Stop)) throw e; }
    const xl = (await s.state()).stories.xiaolan_story;
    t.note('小蓝进度', { current: xl.current, done: xl.done });
    t.ok(!xl.done.includes('pose'), '尚未 pose（pose 门未开：bike 未完成或车未停稳）');
    try { await s.page.keyboard.press('Escape'); } catch {}
    await s.useMove('snowman_r', 'snowman_pose_r');
    pose = await waitText(/缺点什么/, 4000);
    await s.shot('bug023-pose-gated');
    t.ok(pose, 'BUG-023 门未开时点“摆姿势”有“……缺点什么。”反馈');
    // 继续通关小蓝
    const r4 = await playStory(s, 'xiaolan_story', { t, perStepTimeout: 40000 });
    t.ok(r4.ok, '小蓝线继续真实点击通关', { detail: r4 });
    // —— BUG-025：小蓝故事已完成后，转镜子仍应得到 halo_snowman
    await s.teleportToRegion?.('alley').catch(() => {});
    const d = (await s.qa('data')).props.mirror;
    await s.flyTo(d.pos[0], d.pos[1] + 1.5, { timeout: 40000 }).catch(() => {});
    let egg = false;
    for (let i = 0; i < 4 && !egg; i++) {
      try { await s.useMove('mirror', 'mirror_tilt'); } catch (e) { t.log('mirror useMove', e.message.split('\n')[0]); }
      await sleep(1500); egg = (await s.state()).checklist.includes?.('halo_snowman') ?? false;
      if (!egg) { const ck = (await s.state()).checklist; egg = JSON.stringify(ck).includes('halo_snowman'); }
      if (!egg) await sleep(3500);
    }
    await s.shot('bug025-halo');
    t.ok(egg, 'BUG-025 小蓝故事完成后转镜子仍获得彩蛋 halo_snowman');
    // —— BUG-024：阿冬线，公交到站前无误导提示；到站后提示指向 bus_door
    const t0 = Date.now(); let pre = null, post = null, arrive = null;
    while (Date.now() - t0 < 200000) {
      const st = await s.state(); const a = st.stories.adong_story;
      if (a?.current === 'ramp') {
        const flag = st.flags?.bus_arrived ?? st.world?.flags?.bus_arrived ?? null;
        if (!a.hint && pre === null) pre = { t: Math.round((Date.now() - t0) / 1000), hint: a.hint };
        if (a.hint) { post = { t: Math.round((Date.now() - t0) / 1000), hint: a.hint }; break; }
      }
      await sleep(1000);
    }
    t.note('阿冬 ramp 提示时间线', { pre, post });
    t.ok(!!post, 'BUG-024 公交到站后 ramp 提示出现', { detail: post });
    t.ok(post?.hint?.prop === 'bus_door', 'ramp 提示指向 bus_door');
    t.ok(post && post.t <= 90, `公交在黄昏开始后 ≤90s 到站（${post?.t}s）`);
    const r6 = await playStory(s, 'adong_story', { t, perStepTimeout: 40000 });
    t.ok(r6.ok, '阿冬线真实点击通关', { detail: r6 });
  },
};
export default spec;
await runIfMain(import.meta.url, spec);
