// 乱序/重复/打扰 + 存档→刷新→继续（早晨：小米+阿福）
import { Play, sleep, go, now, snapSave, texts, launchFromSave } from './lib.mjs';
const p = await Play.launch('chaos1');
let s = p.s;
await s.start({ mode: 'new' });
const stories = async () => { const st = await s.state(); return JSON.stringify(Object.fromEntries(Object.entries(st.stories).map(([k, v]) => [k, `${v.finished ? 'F' : ''}${v.done.join('+')}`]))); };
const seen = async (from) => texts(await p.rec(), from).map(t => `${t.now}:${t.tx}`).filter(x => !/[♪♫♬]/.test(x));
let t0 = await now(p);
p.log('=== 乱序：先做后面的步骤');
for (const [pr, mv] of [['radio', 'radio_lullaby'], ['mailbox_alley', 'alley_post'], ['fish_rack', 'fish_swing'], ['speaker', 'speaker_prelude'], ['snowman', 'snowman_pose'], ['balloon_stall', 'balloon_pop']]) {
  await go(p, pr, mv).catch(e => p.log(pr, '失败', e.message.split('\n')[0]));
  await sleep(1200);
  p.log(`${pr}/${mv} @${((await now(p)) - t0).toFixed(1)}`, await stories());
}
p.log('乱序台词', JSON.stringify((await seen(t0)).slice(0, 25)));
await snapSave(p, 'chaos-ooo');
p.log('=== 重复：同一招连点');
for (let i = 0; i < 8; i++) { await go(p, 'windchime', 'chime_ring').catch(() => {}); }
p.log('chime×8', await stories());
for (let i = 0; i < 4; i++) { await go(p, 'speaker', 'speaker_blast').catch(() => {}); }
p.log('blast×4', await stories(), 'warmth', (await s.state()).warmth);
p.log('=== 正规通关小米');
await go(p, 'balloon_stall', 'balloon_release');
await s.waitStep('xiaomi_story', 'calm', { timeout: 60000 }).catch(e => p.log('calm 未完成'));
for (let i = 0; i < 5; i++) {
  if ((await s.state()).stories.xiaomi_story.finished) break;
  await go(p, 'speaker', 'speaker_prelude').catch(() => {});
  await sleep(20000);
  p.log('prelude 尝试', i + 1, await stories());
}
await p.waitDone('xiaomi_story', 60000).catch(() => p.log('xiaomi 未完成'));
await s.waitIdle({ timeout: 60000 }).catch(() => {});
p.log('小米后', await stories(), 'phase', (await s.state()).phase);
p.log('=== 阿福：wake 后存档→刷新→继续');
await go(p, 'fish_rack', 'fish_swing');
await s.waitStep('afu_story', 'wake', { timeout: 30000 }).catch(() => p.log('wake 未完成'));
await snapSave(p, 'chaos-afu-wake');
p.log('存档点', await stories());
await p.dump('chaos1-a.rec.json');
await p.close();
// 刷新 + 继续
const p2 = await launchFromSave('chaos1b', 'chaos-afu-wake');
s = p2.s;
p2.log('继续后', await stories(), JSON.stringify((await s.state()).hat));
await go(p2, 'mailbox_alley', 'alley_post');
await s.waitStep('afu_story', 'drop', { timeout: 40000 }).catch(() => p2.log('drop 未完成'));
await s.waitIdle({ timeout: 60000 }).catch(() => {});
// 再次中途存档（drop 后，猫送信途中结束后）
await snapSave(p2, 'chaos-afu-drop');
await go(p2, 'radio', 'radio_lullaby');
await s.waitStep('afu_story', 'lull', { timeout: 40000 }).catch(() => p2.log('lull 未完成'));
await p2.waitDone('afu_story', 120000).catch(() => p2.log('afu 未完成'));
await s.waitIdle({ timeout: 60000 }).catch(() => {});
await sleep(3000);
const st = await s.state();
p2.log('阿福后', await stories(), 'phase', st.phase, 'check', JSON.stringify(st.checklist));
await snapSave(p2, 'chaos-after-morning');
p2.log('errors', JSON.stringify(s.errors), 'dataWarn', s.dataWarnings.length);
await p2.dump('chaos1-b.rec.json');
await p2.close();
