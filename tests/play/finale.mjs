import { Play, sleep, go, now, snapSave, texts, launchFromSave } from './lib.mjs';
const p = await launchFromSave('finale', 'after-dusk');
const s = p.s;
let st = await s.state();
p.log('继续:', JSON.stringify({ now: st.now, phase: st.phase, fin: st.stories.finale_story.done, cur: st.stories.finale_story.current}));
const M = { t0: await now(p) };
// 等所有人到齐（finale_ready）——玩家看到“人到齐了，灯还黑着”
await sleep(2000);
// 先故意点树（乱序）
for (let k = 0; k < 3; k++) { try { const def = (await s.qa('data')).props['tree']; await s.flyTo(def.pos[0], def.pos[1], { timeout: 40000 }); await s.useMove('tree', 'tree_twinkle'); break; } catch (e) { p.log('tree-first 失败#' + k, e.message.split('\n')[0]); } }
await sleep(2500);
let r = await p.rec(); p.log('树先点 台词:', JSON.stringify(texts(r, M.t0).filter(t => /灯串|树|ready|黑/.test(t.tx)).map(t => `${t.now}:${t.tx}`)));
st = await s.state(); p.log('树先点后 finale', st.stories.finale_story.done.join(','), 'check', st.checklist.join(','));
await p.shot('fin-tree-first');
for (const n of [1, 2, 3, 4, 5]) {
  await go(p, 'lamp_p' + n, 'lamp_glow_lamp_p' + n);
  await s.waitStep('finale_story', 'lamp' + n, { timeout: 15000 }).then(() => p.log('lamp' + n + ' ok', (0))).catch(() => p.log('lamp' + n + ' 未完成'));
}
await p.shot('fin-lamps');
st = await s.state(); p.log('灯后 finale', st.stories.finale_story.done.join(','), st.stories.finale_story.current);
await go(p, 'tree', 'tree_twinkle');
await s.waitState(q => q.locked || q.seqRunning, { timeout: 20000 }).catch(() => p.log('终场未开始'));
M.fin0 = await now(p); p.log('终场开始', M.fin0.toFixed(1));
// 终场锁定期间乱点：连点
for (let i = 0; i < 12; i++) { await s.mouseClick(300 + (i * 70) % 700, 300 + (i * 37) % 300).catch(() => {}); await sleep(400); }
await p.shot('fin-spam');
{ const tEnd = Date.now() + 240000; while (Date.now() < tEnd) { const rr = await p.rec(); if (rr.texts.some(t => /通关/.test(t.tx))) break; await sleep(2000); } }
M.fin1 = await now(p); p.log('finished @', M.fin1.toFixed(1));
await sleep(9000);
await p.shot('fin-end');
const allB = await s.qa('uiButtons'); p.log('all buttons', JSON.stringify(allB.map(b => [b.label, b.qa, b.depth, Math.round(b.x), Math.round(b.y), Math.round(b.gw)])).slice(0, 1200));
r = await p.rec();
p.log('终场台词:', JSON.stringify(texts(r, M.fin0 - 1).filter(t => t.now > M.fin0 - 1).map(t => `${t.now}:${t.tx}`)).slice(0, 3500));
st = await s.state(); p.log('通关后状态', JSON.stringify({ locked: st.locked, seq: st.seqRunning, phase: st.phase, check: st.checklist, warmth: st.warmth, stage: st.hat.stage, panel: st.panelOpen }));
await snapSave(p, 'at-end-panel');
// 真实点击面板左按钮「继续散步」（屏幕坐标 ≈ (530,443)，1280x720）
await s.mouseClick(530, 443); await sleep(1500);
await p.shot('fin-sandbox');
st = await s.state(); p.log('点继续散步后', JSON.stringify({ locked: st.locked, panel: st.panelOpen, seq: st.seqRunning }));
const rr2 = await p.rec(); p.log('面板还在?', rr2.texts.slice(-6).map(t => t.tx).join('|'));
await snapSave(p, 'after-finale');
await p.dump();
p.log('errors', JSON.stringify(s.errors), 'dataWarn', s.dataWarnings.length);
await p.close();
