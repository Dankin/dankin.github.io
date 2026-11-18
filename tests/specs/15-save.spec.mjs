import { runIfMain } from '../lib/spec.mjs';
import { sleep } from '../lib/session.mjs';

const spec = {
  id: '15-save', title: '存档：刷新恢复、坏存档、清档（N-08/N-09）', tags: ['save'], timeout: 200000,
  async run(t) {
    const s = await t.launch({ device: 'desktop', name: 'desk' });
    await s.goto({ fresh: true });
    await s.start();
    await s.qa('setWarmth', 40);
    await s.qa('advance', 5);
    await sleep(14000); // 等自动存档（12s 周期）
    const dump = await s.qa('storageDump');
    t.ok(Object.keys(dump).length > 0, '游戏写入了 localStorage', { detail: Object.keys(dump) });
    const w0 = (await s.state()).warmth;
    await s.reload({ fresh: false });
    await s.start({ mode: 'continue' });
    const st = await s.state();
    t.ok(Math.abs(st.warmth - w0) < 5, `刷新后暖度恢复（${w0}→${st.warmth}）`);
    // 坏存档
    for (const [k] of Object.entries(dump)) await s.page.evaluate((key) => localStorage.setItem(key, '{not json'), k);
    await s.reload({ fresh: false });
    const st2 = await s.state();
    t.ok(!!st2, '坏存档（非 JSON）不崩溃，仍可进入');
    for (const [k] of Object.entries(dump)) await s.page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ v: 9999, junk: 1 })), k);
    await s.reload({ fresh: false });
    t.ok(!!(await s.state()), '坏存档（未来版本/缺字段）不崩溃');
  },
};
export default spec;
await runIfMain(import.meta.url, spec);
