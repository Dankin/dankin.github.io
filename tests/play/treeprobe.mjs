import { Play, sleep, launchFromSave } from './lib.mjs';
const p = await launchFromSave('treeprobe', 'after-dusk');
const s = p.s;
const def = (await s.qa('data')).props['tree'];
await s.flyTo(def.pos[0], def.pos[1], { timeout: 40000 }); await sleep(1500);
let st = await s.state();
p.log('hat', JSON.stringify(st.hat), 'tree pt', JSON.stringify(await s.qa('propPoint', 'tree')));
await p.shot('tree');
for (const dy of [0, 1.5, 3]) { await s.flyTo(def.pos[0], def.pos[1] + dy, { timeout: 40000 }); await sleep(1500); p.log('dy', dy, JSON.stringify(await s.qa('propPoint', 'tree'))); }
await p.close();
