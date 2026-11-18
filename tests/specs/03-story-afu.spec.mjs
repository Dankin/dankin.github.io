import { runIfMain } from '../lib/spec.mjs';
import { storySpec } from '../lib/storyspec.mjs';
const spec = storySpec({ id: '03-story-afu', storyId: 'afu_story', title: '阿福', pre: [], checklist: [],
  // BUG-020 复验：早晨弄堂里（吴大爷/秦阿婆还在原位）踢桶应触发 alley_chat
  async after(t, s) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await t.step('彩蛋 alley_chat：弄堂桶「踢一脚桶」', async () => {
      await s.qa('clearCooldowns'); await s.qa('teleportToRegion', 'alley'); await sleep(1500);
      for (let i = 0; i < 3 && !((await s.state()).checklist ?? []).includes('alley_chat'); i++) {
        await s.possess('bone_bucket').catch(() => {}); await s.clickMoveButton('bucket_clang').catch(() => {}); await sleep(8000);
      }
      t.ok(((await s.state()).checklist ?? []).includes('alley_chat'), '彩蛋 alley_chat（弄堂群聊）可真实触发（BUG-020）');
    });
  } });
export default spec;
await runIfMain(import.meta.url, spec);
