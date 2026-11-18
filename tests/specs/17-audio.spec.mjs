import { runIfMain } from '../lib/spec.mjs';

// 调 music 的 src/audio/selftest.ts（OfflineAudioContext 渲染，不发声）
const spec = {
  id: '17-audio', title: '音频自检（music 的 src/audio/selftest.ts）', tags: ['audio'], timeout: 240000,
  async run(t) {
    const s = await t.launch({ device: 'desktop', name: 'desk' });
    await s.goto({ fresh: true });
    await s.start();
    const res = await s.page.evaluate(async () => {
      try {
        const m = await import('/src/audio/selftest.ts');
        const r = await m.runSelfTest({ log: false });
        return { ok: r.ok, failures: r.failures, warnings: r.warnings, theory: r.theory, seam: r.seam, ms: r.ms,
                 rows: r.rows.map((x) => ({ g: x.group, n: x.name, pk: x.peak, rms: x.rmsDb, ok: x.ok, note: x.note })) };
      } catch (e) { return { error: String(e) }; }
    });
    if (res.error) { t.fatal(`selftest 无法运行：${res.error}`); }
    t.note('audioSelftest', { ms: res.ms, rows: res.rows.length, seam: res.seam, theory: res.theory, warnings: res.warnings });
    const bad = res.rows.filter((r) => !r.ok);
    t.ok(res.rows.length > 20, `自检覆盖 ${res.rows.length} 项（>20）`);
    t.ok(res.failures.length === 0 && bad.length === 0, `音频自检无失败项（${bad.length} 行异常）`, { detail: { failures: res.failures, bad } });
    t.ok(res.seam?.ok !== false, `音乐循环缝合无爆点`, { detail: res.seam });
    if (res.warnings.length) t.log('警告:', res.warnings.slice(0, 6).join(' | '));
    const peak = Math.max(...res.rows.map((r) => r.pk));
    t.ok(peak < 0.95, `全部渲染峰值 < 0.95（最大 ${peak}）`);
    // 运行时音频状态：静音按钮/AudioContext
    const a = (await s.state()).audio; t.note('audioState', a);
  },
};
export default spec;
await runIfMain(import.meta.url, spec);
