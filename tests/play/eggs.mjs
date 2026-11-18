// 彩蛋/清单补全：从通关后的沙盒存档继续（真实点击）
import { Play, sleep, go, now, snapSave, texts, launchFromSave } from './lib.mjs';
const p = await launchFromSave('eggs', 'after-finale');
const s = p.s;
const chk = async () => (await s.state()).checklist;
const step = async (name, fn, wantId) => {
  const t0 = await now(p); const before = await chk();
  try { await fn(); } catch (e) { p.log(name, '异常', e.message.split('\n')[0]); }
  await sleep(1500);
  const after = await chk(); const added = after.filter(x => !before.includes(x));
  const rr = await p.rec();
  p.log(`[${name}] +${((await now(p)) - t0).toFixed(1)}s 新增勾选=${JSON.stringify(added)} 台词=${JSON.stringify(texts(rr, t0 - 0.5).filter(t => t.now > t0 - 0.5 && !/[♪♫♬]/.test(t.tx)).map(t => t.tx).slice(0, 8))}`);
  await p.shot(name);
  return added;
};
const click = async (prop, mv) => go(p, prop, mv);
p.log('起点', JSON.stringify(await chk()));
// 1 信（广场邮筒）
await step('letter_sent', async () => { await click('mailbox', 'mailbox_drop'); await sleep(3000); });
// 2 自动售货机×3
await step('vend_blind', async () => { for (let i = 0; i < 3; i++) { await click('vending', 'vend_cookie'); await sleep(8500); } });
// 3 面包融合（咸/甜 20s 内）
await step('bread_fusion', async () => { await click('sign_salty', 'cheer_salty'); await click('sign_cake', 'cheer_cake'); await sleep(3000); });
// 4 排队死/香味+树灯同时
await step('queue_dead', async () => { await click('bread_cart', 'bread_scent_re'); await click('tree', 'tree_twinkle'); await sleep(3000); });
await snapSave(p, 'eggs1');
// 5 雪人派对 ×3
await step('snowman_party', async () => { for (let i = 0; i < 3; i++) { await click('snowman', 'snowman_pose'); await sleep(2500); } });
// 6 骨头→邮筒（巷子）
await step('bone_mailed', async () => { await click('bone_bucket', 'bone_toss'); await sleep(2000); await click('mailbox_alley', 'alley_post'); await sleep(3000); });
// 7 巷子吵闹
await step('alley_chat', async () => { await click('speaker', 'speaker_blast').catch(()=>{}); await sleep(3000); });
// 8 镜子 → 光环雪人
await step('halo_snowman', async () => { await click('mirror', 'mirror_tilt'); await sleep(3000); });
await snapSave(p, 'eggs2');
// 9 路灯护送 record_run
await step('record_run', async () => { for (const n of [2, 3, 4]) { await click('lamp_s' + n, 'lamp_glow_lamp_s' + n); await sleep(500); } await sleep(3000); });
p.log('最终清单', JSON.stringify(await chk()));
await snapSave(p, 'eggs3');
await p.dump();
p.log('errors', JSON.stringify(s.errors), 'dataWarn', s.dataWarnings.length);
await p.close();
