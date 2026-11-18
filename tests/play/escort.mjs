import { Play, sleep, go, now, snapSave, texts, launchFromSave } from './lib.mjs';
const p = await launchFromSave('escort', process.argv[2] || 'after-noon2');
const s = p.s;
let st = await s.state();
p.log('起点', JSON.stringify({ now: st.now, phase: st.phase, ad: st.stories.adong_story, check: st.checklist }));
const t0 = st.now;
for (const n of [2, 3, 4]) { await go(p, 'lamp_s' + n, 'lamp_glow_lamp_s' + n); p.log('lamp_s' + n, '@', ((await now(p)) - t0).toFixed(1)); }
await sleep(4000);
st = await s.state();
p.log('结果', JSON.stringify({ check: st.checklist, ad: st.stories.adong_story.done, phase: st.phase }));
const r = await p.dump();
p.log('台词', JSON.stringify(texts(r, 0).map(t => `${t.now}:${t.tx}`).filter(x => /灯|光轨|规则|纪录/.test(x))));
p.log('errors', JSON.stringify(s.errors), 'dataWarn', s.dataWarnings.length);
await p.close();
