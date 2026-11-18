// 复现：先通关小米再通关阿福时，阿福 lull 后走向 [2,34.6] 的路上偶发卡住不动（enter 步骤永不完成）。
// 用法: node repro/afu-enter-stuck.mjs   （最多 4 轮，卡住即导出现场与截图）
import { Session, sleep } from '../lib/session.mjs';
import { playStory } from '../lib/driver.mjs';
for (let run = 0; run < Number(process.env.ROUNDS ?? 4); run++) {
  const s = await Session.launch({ device: 'desktop', name: 'afu-stuck', outDir: process.env.OUT ?? '/tmp/dbgout' });
  await s.goto({ fresh: true }); await s.start();
  await playStory(s, 'xiaomi_story', {});
  let res = null; playStory(s, 'afu_story', {}).then((r) => (res = r));
  const t0 = Date.now(); let stuck = 0, last = '';
  while (!res && Date.now() - t0 < 160000) {
    await sleep(4000);
    const st = await s.state(); const a = st.npcs.afu;
    if (st.stories.afu_story?.done?.includes('lull')) {
      const k = `${a.x},${a.y}`; stuck = k === last ? stuck + 1 : 0; last = k;
      if (stuck >= 3) {
        console.log('STUCK run', run, JSON.stringify(a));
        console.log('npcs', JSON.stringify(st.npcs));
        const d = await s.qa('data');
        console.log('props near afu', JSON.stringify(Object.entries(d.props).filter(([, p]) => Math.hypot(p.pos[0] - a.x, p.pos[1] - a.y) < 4).map(([id, p]) => [id, p.pos])));
        await s.shot('afu-stuck'); break;
      }
    }
  }
  console.log('run', run, 'ok', res?.ok ?? 'running', 'warps', JSON.stringify(Object.entries((await s.state()).npcs).filter(([, n]) => n.warps).map(([k, n]) => [k, n.warps])));
  await s.close(); if (stuck >= 3) break;
}
