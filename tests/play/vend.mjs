import { Play, sleep, go, now, texts, launchFromSave } from './lib.mjs';
const p = await launchFromSave('vend', 'after-finale');
const s = p.s;
let n = 0;
for (; n < 14; n++) {
  const st = await s.state();
  if (st.checklist.includes('vend_blind')) break;
  await go(p, 'vending', 'vend_cookie').catch(e => p.log('失败', e.message.split('\n')[0]));
  await sleep(8500);
  const r = await p.rec();
  p.log(`第${n + 1}次`, JSON.stringify(texts(r, st.now).map(t => t.tx).filter(x => /盲|袜|树|饼干|惊喜|掉/.test(x))));
}
p.log('vend_blind', (await s.state()).checklist.includes('vend_blind'), '按了', n, '次');
await p.close();
