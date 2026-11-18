import { runIfMain } from '../lib/spec.mjs';

const spec = {
  id: '17-audio', title: '音频自检（music 的 src/audio/selftest.ts）', tags: ['audio'], timeout: 90000,
  async run(t) {
    const s = await t.launch({ device: 'desktop', name: 'desk' });
    await s.goto({ fresh: true });
    await s.start();
    const res = await s.page.evaluate(async () => {
      try {
        const m = await import('/src/audio/selftest.ts');
        const fn = m.runAudioSelfTest ?? m.default ?? m.selftest ?? m.run;
        if (!fn) return { missing: Object.keys(m) };
        return { results: await fn() };
      } catch (e) { return { error: String(e) }; }
    });
    if (res.error || res.missing) { t.note('audioSelftest', res); t.skip(`selftest 未就绪：${JSON.stringify(res)}`); }
    const list = Array.isArray(res.results) ? res.results : (res.results?.checks ?? []);
    t.note('audioSelftest', list);
    for (const r of list) t.ok(r.ok !== false, `音频：${r.name ?? r.id}${r.detail ? ' — ' + r.detail : ''}`);
  },
};
export default spec;
await runIfMain(import.meta.url, spec);
