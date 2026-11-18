import { runIfMain } from '../lib/spec.mjs';
import { sleep } from '../lib/session.mjs';

// BUG-022 提前按小米前奏应有反馈；BUG-026 vend_blind 连按 3 次保底；BUG-020 弄堂群聊（早晨）
const spec = {
  id: '19-eggs-feedback', title: '彩蛋/失败反馈：前奏提前按、贩卖机保底、弄堂群聊', tags: ['story', 'neg', 'egg'], timeout: 240000,
  async run(t) {
    const s = await t.launch({ device: 'desktop', name: 'desk' });
    await s.goto({ fresh: true }); await s.start();
    const done = async () => (await s.state()).checklist ?? [];
    const texts = async () => new Set(await s.qa('visibleTexts'));

    await t.step('BUG-026 贩卖机连按 3 次必出 vend_blind', async () => {
      const d = await s.qa('data'); const [x, y] = d.props.vending.pos;
      await s.qa('teleportHat', x - 1, y + 1); await sleep(1500);
      let n = 0;
      for (; n < 3; n++) { await s.qa('clearCooldowns'); await s.possess('vending'); await s.clickMoveButton('vend_cookie'); await sleep(2500); if ((await done()).includes('vend_blind')) break; }
      t.ok((await done()).includes('vend_blind'), `vend_blind 在 ≤3 次按下内触发（实际 ${n + 1} 次）`, { bug: undefined });
    });

    await t.step('BUG-022 提前按小米前奏有反馈（不静默）', async () => {
      const d = await s.qa('data'); const [x, y] = d.props.speaker.pos;
      await s.qa('teleportHat', x + 1, y + 1); await sleep(1500);
      await s.qa('clearCooldowns'); await s.possess('speaker');
      const before = await texts();
      await s.clickMoveButton('speaker_prelude'); await sleep(1500);
      const after = await texts();
      const fresh = [...after].filter((x) => !before.has(x));
      t.note('prelude 反馈', fresh);
      t.ok(fresh.length > 0, '提前按前奏后 1.5s 内出现新的气泡/字幕/toast 反馈', { detail: fresh });
    });

    await t.step('BUG-020 早晨弄堂踢桶触发 alley_chat', async () => {
      await s.qa('clearCooldowns'); await s.qa('teleportToRegion', 'alley'); await sleep(1500);
      for (let i = 0; i < 3 && !(await done()).includes('alley_chat'); i++) { await s.possess('bone_bucket').catch(() => {}); await s.clickMoveButton('bucket_clang').catch(() => {}); await sleep(8000); }
      t.ok((await done()).includes('alley_chat'), 'alley_chat 已勾选');
    });
  },
};
export default spec;
await runIfMain(import.meta.url, spec);
