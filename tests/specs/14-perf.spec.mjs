import { runIfMain } from '../lib/spec.mjs';
import { sleep } from '../lib/session.mjs';

const spec = {
  id: '14-perf', title: '性能：帧时间/资源（空闲、移动、各区域、低性能 CPU4x）', tags: ['perf'], timeout: 300000,
  async run(t) {
    for (const [device, name] of [['desktop', 'desk'], ['lowend', 'low']]) {
      const s = await t.launch({ device, name });
      await s.goto({ fresh: true });
      await s.start();
      const idle = await s.qa('frameSample', 4);
      t.note(`frames:${name}-idle`, idle);
      t.ok(idle.fps >= (device === 'lowend' ? 12 : 30), `[${name}] 空闲 fps≥${device === 'lowend' ? 12 : 30}（${idle.fps?.toFixed?.(1)}）`);
      const d = await s.qa('data');
      for (const r of d.regions ?? []) {
        await s.qa('teleportToRegion', r.id ?? r); await sleep(800);
        const f = await s.qa('frameSample', 3);
        t.note(`frames:${name}-${r.id ?? r}`, f);
        t.ok(f.fps >= (device === 'lowend' ? 10 : 25), `[${name}] 区域 ${r.id ?? r} fps≥${device === 'lowend' ? 10 : 25}（${f.fps?.toFixed?.(1)}，p95=${f.p95?.toFixed?.(0)}ms）`);
      }
      const res = await s.resources();
      t.note(`resources:${name}`, res);
      t.ok(res.textures < 1200, `[${name}] 纹理数合理 <1200（${res.textures}，${res.textureMB}MB）`);
    }
  },
};
export default spec;
await runIfMain(import.meta.url, spec);
