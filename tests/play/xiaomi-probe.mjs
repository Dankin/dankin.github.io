import { Play, sleep, go, now, texts } from './lib.mjs';
const p = await Play.launch('xiaomi-probe');
const s = p.s;
await s.start({ mode: 'new' });
await go(p, 'windchime', 'chime_ring');
await s.waitStep('xiaomi_story', 'listen', { timeout: 15000 });
await go(p, 'balloon_stall', 'balloon_release');
await s.waitStep('xiaomi_story', 'calm', { timeout: 40000 });
// 采样：小米位置/状态，直到点喇叭
const sampler = setInterval(async () => { try { const st = await s.state(); p.log('xm', st.now.toFixed(1), JSON.stringify([st.npcs.xiaomi.x, st.npcs.xiaomi.y, st.npcs.xiaomi.state, st.npcs.xiaomi.moving]), 'stim', JSON.stringify(st.stimuli.map(x => x.type + ':' + x.tag + ':' + x.intensity + '@' + x.x + ',' + x.y))); } catch {} }, 1000);
await go(p, 'speaker', 'speaker_prelude');
await sleep(9000);
clearInterval(sampler);
const st = await s.state(); p.log('done', st.stories.xiaomi_story.done.join(','));
await p.close();
