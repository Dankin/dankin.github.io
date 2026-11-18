import { runIfMain } from '../lib/spec.mjs';
import { sleep } from '../lib/session.mjs';

// BUG-027：通关结尾面板出现后存档→刷新→继续，应重弹结尾面板；点「继续散步」后再刷新应直接进沙盒
const spec = {
  id: '18-endpanel-persist', title: '结尾面板：存档→刷新→继续 重弹；继续散步后刷新不再弹', tags: ['save', 'story'], timeout: 240000,
  async run(t) {
    const s = await t.launch({ device: 'desktop', name: 'desk' });
    await s.goto({ fresh: true }); await s.start();
    const has = async (re) => (await s.qa('visibleTexts')).some((x) => re.test(x));
    const waitText = async (re, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await has(re)) return true; await sleep(500); } return false; };
    await s.qa('runSequence', 'epilogue');
    t.ok(await waitText(/继续散步/, 40000), '尾声后弹出结尾面板');
    await sleep(14000); // 等自动存档
    const save = await s.qa('readSave');
    t.note('save.extra', save?.value?.extra ?? null);
    t.ok(save?.value?.extra?.ended === true, '存档 extra.ended = true', { detail: save?.value?.extra });
    await s.page.reload(); await s.ensureApi();
    await s.start({ mode: 'continue' });
    t.ok(await waitText(/继续散步/, 8000), '刷新→继续后结尾面板重新弹出');
    await s.shot('end-panel-restored');
    const btn = (await s.qa('uiButtons')).filter((b) => (b.depth ?? 0) >= 500 && b.gw > 80).sort((a, b) => a.x - b.x)[0]; // 左=继续散步，右=再玩一次
    t.ok(!!btn, '面板上有「继续散步」按钮');
    if (btn) { await s.mouseClick(btn.x, btn.y); await sleep(1500); }
    t.ok(!(await has(/继续散步/)), '点「继续散步」后面板关闭');
    await sleep(14000);
    await s.page.reload(); await s.ensureApi();
    await s.start({ mode: 'continue' });
    await sleep(5000);
    t.ok(!(await has(/继续散步/)), '继续散步后再刷新：直接进沙盒，不再弹面板');
    const st = await s.state(); t.ok(!st.locked, '沙盒可操作（未锁定）');
  },
};
export default spec;
await runIfMain(import.meta.url, spec);
