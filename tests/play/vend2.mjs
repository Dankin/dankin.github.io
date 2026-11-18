import { Play, sleep, go, now, texts, launchFromSave } from './lib.mjs';
const p = await launchFromSave('vend2', 'after-finale');
const s = p.s;
const st0 = await s.state(); p.log('state keys', Object.keys(st0).join(','));
const flags = async () => { const st = await s.state(); return st.flags?.vend_n ?? (await s.qa('flags'))?.vend_n; };
let n = 0;
for (; n < 16; n++) {
  const st = await s.state();
  if (st.checklist.includes('vend_blind')) break;
  const before = await flags().catch(() => '?');
  await go(p, 'vending', 'vend_cookie').catch(e => p.log('失败', e.message.split('\n')[0]));
  await sleep(500);
  const after = await flags().catch(() => '?');
  const r = await p.rec();
  p.log(`第${n + 1}次 vend_n ${before}->${after}`, JSON.stringify(texts(r, st.now).map(t => t.tx).filter(x => /空盒|咣当|掉/.test(x))));
  await sleep(8200);
}
p.log('vend_blind', (await s.state()).checklist.includes('vend_blind'), '按了', n, '次');
await p.close();
