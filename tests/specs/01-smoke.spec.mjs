import { runIfMain } from '../lib/spec.mjs';
import { sleep } from '../lib/session.mjs';

const spec = {
  id: '01-smoke', title: '冒烟：启动/标题/开始/无 console 错误/基础帧率与资源', tags: ['smoke', 'perf'], timeout: 90000,
  async run(t) {
    const s = await t.launch({ device: 'desktop', name: 'desk' });
    await s.goto({ fresh: true });
    const st0 = await s.state();
    t.ok(st0.ready, '场景 game 已创建，testApi 可用');
    t.ok(!st0.started, '启动后停在标题屏（started=false）');
    await s.shot('title');
    await s.start();
    const st1 = await s.state();
    t.ok(st1.started, '点击标题后开始游戏');
    await sleep(1500);
    await s.shot('start');
    const res = await s.resources();
    t.note('resources', res);
    t.ok(res.renderer === 'WEBGL', `渲染器为 WebGL（${res.renderer}）`);
    const fr = await s.frames(4);
    t.note('frames:desktop-idle', fr);
    t.ok(fr.fps >= 20, `桌面空闲帧率 ≥20fps（SwiftShader 软渲染，实际 ${fr.fps}）`, { detail: fr });
    const inv = await s.qa('invariants');
    t.ok(inv.length === 0, '世界一致性：NPC/物件不在不可走瓦片、不出界', { detail: inv });
    const ov = await s.qa('overlaps');
    t.ok(ov.length === 0, '开场 UI 无遮挡', { detail: ov });
    const tt = await s.qa('touchTargets');
    t.note('uiTargets', tt);
    t.ok(s.dataWarnings.length === 0, `无 [data] 校验警告（${s.dataWarnings.length}）`, { detail: s.dataWarnings.slice(0, 5) });
  },
};
export default spec;
await runIfMain(import.meta.url, spec);
