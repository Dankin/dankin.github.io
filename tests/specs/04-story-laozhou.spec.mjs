import { runIfMain } from '../lib/spec.mjs';
import { storySpec } from '../lib/storyspec.mjs';
const spec = storySpec({ id: '04-story-laozhou', storyId: 'laozhou_story', title: '老周面包房', pre: ['xiaomi_story','afu_story'], checklist: [], timeout: 1200000,
  // BUG-020/021 复验：老周线后真实点击 彩蛋招式
  async after(t, s) {
    const done = async () => (await s.state()).checklist ?? [];
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await t.step('彩蛋 queue_dead：老周线后点烤箱「扇出面包香」', async () => {
      await s.qa('clearCooldowns');
      await s.qa('teleportToRegion', 'bakery'); await sleep(1500);
      for (let i = 0; i < 3 && !(await done()).includes('queue_dead'); i++) {
        await s.possess('oven').catch(() => {}); await s.clickMoveButton('oven_waft').catch(() => {}); await sleep(8000);
      }
      t.ok((await done()).includes('queue_dead'), '彩蛋 queue_dead（排队崩了）可真实触发（BUG-021）');
    });
    await t.step('彩蛋 alley_chat：弄堂桶「踢一脚桶」', async () => {
      await s.qa('teleportToRegion', 'alley'); await sleep(1500);
      for (let i = 0; i < 3 && !(await done()).includes('alley_chat'); i++) {
        const e1 = await s.possess('bone_bucket').then(() => '', (e) => 'possess:' + e.message.slice(0, 120));
        const e2 = await s.clickMoveButton('bucket_clang').then(() => '', (e) => 'move:' + e.message.slice(0, 120)); await sleep(8000);
        const st = await s.state();
        t.log('  alley诊断 ' + JSON.stringify({ i, e1, e2, hat: st.hat, region: st.region, phase: st.phase, cd: st.cooldowns, stim: (st.stimuli || []).length, locked: st.locked, seq: st.seqRunning, chk: st.checklist, wu: st.npcs?.uncle_wu, qin: st.npcs?.granny_qin }));
      }
      t.ok((await done()).includes('alley_chat'), '老周线后弄堂群聊仍可触发（吴大爷/秦阿婆应回到弄堂）', { bug: 'BUG-028' });
    });
  } });
export default spec;
await runIfMain(import.meta.url, spec);
