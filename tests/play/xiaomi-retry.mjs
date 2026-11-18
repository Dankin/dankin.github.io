import { Play, sleep, go, now, launchFromSave, texts, snapSave } from './lib.mjs';
const p = await launchFromSave('xiaomi-retry', 'after-morning');
const s = p.s;
let st = await s.state();
p.log('继续后:', JSON.stringify({ now: st.now, phase: st.phase, hat: st.hat, xiaomi: st.stories.xiaomi_story, npc: st.npcs.xiaomi, warmth: st.warmth }));
await p.shot('00-continued');
// 小米现在在哪儿，周围有谁
const near = Object.entries(st.npcs).filter(([id, n]) => Math.hypot(n.x - st.npcs.xiaomi.x, n.y - st.npcs.xiaomi.y) < 6).map(([id, n]) => id + '@' + n.x.toFixed(1) + ',' + n.y.toFixed(1));
p.log('小米附近 NPC:', near.join(' '));
await go(p, 'speaker', 'speaker_prelude');
const t1 = await now(p);
for (let i = 0; i < 12; i++) { await sleep(1000); const q = await s.state(); if (q.stories.xiaomi_story.done.includes('melody') || q.seqRunning) { p.log('melody done or seq running @', q.now.toFixed(1)); break; } }
await p.shot('01-after-prelude');
st = await s.state();
p.log('after prelude 1:', JSON.stringify({ stim: st.stimuli, cd: st.cooldowns, xiaomi: st.stories.xiaomi_story, npcx: st.npcs.xiaomi }));
let r = await p.rec();
p.log('台词:', JSON.stringify(texts(r, t1 - 1).map(t => `${t.now}:${t.tx}`)));
await p.waitDone('xiaomi_story', 60000).catch(e => p.log('xiaomi 仍未完成'));
await s.waitIdle({ timeout: 90000 }).catch(() => {});
st = await s.state();
p.log('final:', JSON.stringify({ phase: st.phase, check: st.checklist, stories: Object.fromEntries(Object.entries(st.stories).map(([k, v]) => [k, v.current + '|' + v.finished])) }));
await p.shot('02-final');
r = await p.dump();
p.log('events:', JSON.stringify(r.events.filter(e => ['story','hint','check','phase'].includes(e.k)).map(e => `${e.now} ${e.k} ${e.v}`)));
await snapSave(p, 'after-morning2');
await p.close();
