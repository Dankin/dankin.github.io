import { Play, sleep, go, now, texts } from './lib.mjs';
const run = process.argv[2] || 'a';
const p = await Play.launch('xiaomi-fast-' + run);
const s = p.s;
await s.start({ mode: 'new' });
await go(p, 'windchime', 'chime_ring');
await s.waitStep('xiaomi_story', 'listen', { timeout: 15000 });
await go(p, 'balloon_stall', 'balloon_release');
await s.waitStep('xiaomi_story', 'calm', { timeout: 40000 });
p.log('calm done now=', await now(p));
const snap = async (tag) => { const st = await s.state(); const xm = st.npcs.xiaomi; const near = Object.entries(st.npcs).filter(([id, n]) => id !== 'xiaomi' && n.visible && Math.hypot(n.x - xm.x, n.y - xm.y) < 3.6).map(([id, n]) => id + ':' + Math.hypot(n.x - xm.x, n.y - xm.y).toFixed(1)); p.log(tag, 'now', st.now.toFixed(1), 'near3.6=', near.join(' ') || '-', 'xiaomi', xm.state, 'seq', st.seqRunning); };
await snap('before-speaker');
const t1 = await now(p);
await go(p, 'speaker', 'speaker_prelude');
await snap('after-click');
for (let i = 0; i < 8; i++) { await sleep(1000); const st = await s.state(); if (st.stories.xiaomi_story.done.includes('melody')) { p.log('melody ok @', st.now.toFixed(1)); break; } }
await snap('after-8s');
const r = await p.rec();
p.log('台词:', JSON.stringify(texts(r, t1 - 0.5, t1 + 12).map(t => `${t.now}:${t.tx}`)));
await p.shot('end');
// 第二次尝试
let st = await s.state();
if (!st.stories.xiaomi_story.done.includes('melody')) {
  await sleep(10000); await snap('retry-before'); const t2 = await now(p);
  await go(p, 'speaker', 'speaker_prelude'); await sleep(6000);
  st = await s.state(); p.log('retry result done=', st.stories.xiaomi_story.done.join(','));
  const r2 = await p.rec(); p.log('台词2:', JSON.stringify(texts(r2, t2 - 0.5, t2 + 8).map(t => `${t.now}:${t.tx}`)));
}
await p.close();
