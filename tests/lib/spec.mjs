/**
 * 用例运行器。每个 specs/*.spec.mjs 导出 default：
 *   export default { id, title, tags:[], timeout, run: async (t) => {...} }
 * 单文件可直接 `node specs/xxx.spec.mjs` 运行（文件末尾 `await runIfMain(import.meta.url, spec)`）。
 *
 * t API：
 *   t.launch(opts)            启动 Session（device/name/...），自动在结束时关闭并汇总 console 错误
 *   t.ok(cond,msg,{bug,sev,detail})   断言；失败不中断。bug: 已知缺陷编号 → 状态记为 known 而非 fail
 *   t.eq(a,b,msg,opts) / t.near(a,b,tol,msg) / t.fatal(msg)（失败并中断）
 *   t.note(key,val)           写入报告“指标”
 *   t.skip(reason)            跳过
 *   t.step(name, fn)          带耗时的步骤
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Session, OUT_ROOT } from './session.mjs';

export class Skip extends Error {}
export class Fatal extends Error {}

export async function runSpec(spec, { runId = process.env.QA_RUN_ID || stamp(), quiet = false } = {}) {
  const outDir = join(OUT_ROOT, runId, spec.id);
  mkdirSync(outDir, { recursive: true });
  const res = { id: spec.id, title: spec.title, tags: spec.tags ?? [], status: 'pass', checks: [], notes: {}, shots: [], errors: [], dataWarnings: [], warnings: [], steps: [], duration: 0, startedAt: new Date().toISOString(), runId };
  const sessions = [];
  const log = (...a) => { if (!quiet) console.log(`  [${spec.id}]`, ...a); };
  const t = {
    outDir,
    log,
    async launch(opts = {}) {
      const s = await Session.launch({ outDir, name: opts.name ?? `s${sessions.length}`, ...opts });
      sessions.push(s);
      return s;
    },
    ok(cond, msg, o = {}) {
      const c = { ok: !!cond, msg, ...(o.detail !== undefined ? { detail: o.detail } : {}), ...(o.bug ? { bug: o.bug } : {}), ...(o.sev ? { sev: o.sev } : {}) };
      res.checks.push(c);
      log(c.ok ? '✓' : (o.bug ? '△' : '✗'), msg, c.ok ? '' : (o.detail !== undefined ? JSON.stringify(o.detail).slice(0, 300) : ''));
      return c.ok;
    },
    eq(a, b, msg, o) { return t.ok(JSON.stringify(a) === JSON.stringify(b), `${msg}（期望 ${JSON.stringify(b)}，实际 ${JSON.stringify(a)}）`, o); },
    near(a, b, tol, msg, o) { return t.ok(Math.abs(a - b) <= tol, `${msg}（期望 ${b}±${tol}，实际 ${a}）`, o); },
    fatal(msg, detail) { t.ok(false, msg, { detail }); throw new Fatal(msg); },
    note(k, v) { res.notes[k] = v; },
    skip(reason) { throw new Skip(reason); },
    async step(name, fn) {
      const t0 = Date.now(); log('→', name);
      try { return await fn(); } finally { res.steps.push({ name, ms: Date.now() - t0 }); }
    },
  };
  const t0 = Date.now();
  let timer;
  try {
    await Promise.race([
      spec.run(t),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`用例超时 ${(spec.timeout ?? 180000) / 1000}s`)), spec.timeout ?? 180000); }),
    ]);
  } catch (e) {
    if (e instanceof Skip) { res.status = 'skip'; res.skipReason = e.message; }
    else if (e instanceof Fatal) { /* 已记录 */ }
    else { res.checks.push({ ok: false, msg: '脚本异常: ' + (e?.message ?? e), detail: String(e?.stack ?? '').split('\n').slice(0, 5).join('\n') }); log('✗ 异常', e?.message); }
    // 失败现场截图
    for (const s of sessions) { try { await s.shot('FAIL-' + Date.now() % 100000); } catch {} }
  } finally {
    clearTimeout(timer);
  }
  // 汇总 console 错误
  for (const s of sessions) {
    res.errors.push(...s.errors.map((e) => ({ session: s.name, ...e })));
    res.dataWarnings.push(...s.dataWarnings);
    res.warnings.push(...s.warnings.slice(0, 20));
    res.shots.push(...s.shots);
    if (s.perf) res.notes[`perf:${s.name}`] = s.perf;
  }
  if (res.status !== 'skip') {
    if (res.errors.length && !spec.allowErrors) res.checks.push({ ok: false, msg: `console/页面错误 ${res.errors.length} 条`, detail: res.errors.slice(0, 5), sev: 'P1' });
    const hardFail = res.checks.some((c) => !c.ok && !c.bug);
    const known = res.checks.some((c) => !c.ok && c.bug);
    res.status = hardFail ? 'fail' : known ? 'known' : 'pass';
  }
  res.duration = Date.now() - t0;
  for (const s of sessions) await s.close();
  writeFileSync(join(outDir, 'result.json'), JSON.stringify(res, null, 2));
  log(`== ${res.status.toUpperCase()} (${(res.duration / 1000).toFixed(1)}s) ${res.checks.filter((c) => c.ok).length}/${res.checks.length}`);
  return res;
}

export function stamp() {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** 允许 `node specs/x.spec.mjs` 单独运行 */
export async function runIfMain(metaUrl, spec) {
  if (process.argv[1] && metaUrl === 'file://' + process.argv[1]) {
    const r = await runSpec(spec);
    process.exit(r.status === 'fail' ? 1 : 0);
  }
}
