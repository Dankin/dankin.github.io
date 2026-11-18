import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, basename, relative } from 'node:path';

const ICON = { pass: '✅', fail: '❌', known: '🟡', skip: '⏭️' };

export async function writeReport({ runId, results, outRoot, repoRoot }) {
  const qaDir = join(repoRoot, 'docs', 'qa');
  const shotDir = join(qaDir, 'screenshots', runId);
  mkdirSync(shotDir, { recursive: true });
  const link = (abs) => { const dst = join(shotDir, basename(abs)); try { copyFileSync(abs, dst); } catch { return null; } return `screenshots/${runId}/${basename(abs)}`; };
  const cnt = { pass: 0, fail: 0, known: 0, skip: 0 };
  results.forEach((r) => cnt[r.status]++);
  const total = results.length;
  const checksAll = results.flatMap((r) => r.checks);
  const L = [];
  L.push(`# QA 回归报告 ${runId}`, '');
  L.push(`- 用例 ${total}：✅ 通过 ${cnt.pass} / ❌ 失败 ${cnt.fail} / 🟡 已知缺陷 ${cnt.known} / ⏭️ 跳过 ${cnt.skip}`);
  L.push(`- 断言 ${checksAll.length}：通过 ${checksAll.filter((c) => c.ok).length}，失败 ${checksAll.filter((c) => !c.ok).length}`);
  const errs = results.reduce((n, r) => n + r.errors.length, 0);
  L.push(`- console/页面错误总数：${errs}；数据校验警告：${results.reduce((n, r) => n + r.dataWarnings.length, 0)}`);
  L.push(`- 总耗时 ${(results.reduce((n, r) => n + r.duration, 0) / 1000).toFixed(0)}s；环境：Chrome(headless, SwiftShader 软渲染) / Playwright`);
  L.push('', '## 用例一览', '', '| 用例 | 结果 | 断言 | 耗时 | 说明 |', '|---|---|---|---|---|');
  for (const r of results) {
    const c = r.checks;
    L.push(`| ${r.id} | ${ICON[r.status]} ${r.status} | ${c.filter((x) => x.ok).length}/${c.length} | ${(r.duration / 1000).toFixed(1)}s | ${r.title}${r.skipReason ? '（' + r.skipReason + '）' : ''} |`);
  }
  // 失败详情
  const bad = results.filter((r) => r.status === 'fail' || r.status === 'known');
  if (bad.length) {
    L.push('', '## 失败 / 已知缺陷详情', '');
    for (const r of bad) {
      L.push(`### ${r.id} ${r.title}`);
      for (const c of r.checks.filter((x) => !x.ok)) {
        L.push(`- ${c.bug ? '🟡 ' + c.bug + ' ' : '❌ '}${c.sev ? '[' + c.sev + '] ' : ''}${c.msg}`);
        if (c.detail !== undefined) L.push('  ```json', '  ' + JSON.stringify(c.detail).slice(0, 600), '  ```');
      }
      L.push('');
    }
  }
  // 性能
  const perf = [];
  for (const r of results) for (const [k, v] of Object.entries(r.notes)) if (k.startsWith('frames:') && v && v.fps !== undefined) perf.push([r.id, k.slice(7), v]);
  if (perf.length) {
    L.push('', '## 帧率 / 帧时间（SwiftShader 软件渲染，数值仅作相对比较；真机更好）', '', '| 用例 | 场景 | fps | p50ms | p95ms | p99ms | max | >50ms帧 |', '|---|---|---|---|---|---|---|---|');
    for (const [id, k, v] of perf) L.push(`| ${id} | ${k} | ${v.fps} | ${v.p50} | ${v.p95} | ${v.p99} | ${v.max} | ${v.jank50} |`);
  }
  const resRows = results.filter((r) => r.notes.resources).map((r) => [r.id, r.notes.resources]);
  if (resRows.length) {
    L.push('', '## 资源', '', '| 用例 | 纹理数 | 纹理MB | 显示对象 | tween | JS堆MB |', '|---|---|---|---|---|---|');
    for (const [id, v] of resRows) L.push(`| ${id} | ${v.textures} | ${v.textureMB} | ${v.displayObjects} | ${v.tweens} | ${v.jsHeapMB ?? '-'} |`);
  }
  // 音频自检
  const au = results.find((r) => r.notes.audioSelftest);
  if (au) {
    L.push('', '## 音频自检（src/audio/selftest.ts）', '', '```json', JSON.stringify(au.notes.audioSelftest, null, 2).slice(0, 3000), '```');
  }
  // 其他指标
  const other = [];
  for (const r of results) for (const [k, v] of Object.entries(r.notes)) if (!k.startsWith('frames:') && !k.startsWith('perf:') && !['resources', 'audioSelftest', 'uiTargets'].includes(k)) other.push([r.id, k, v]);
  if (other.length) {
    L.push('', '## 指标', '');
    for (const [id, k, v] of other) L.push(`- ${id} · ${k}: \`${String(JSON.stringify(v ?? null)).slice(0, 300)}\``);
  }
  const tt = results.find((r) => r.notes.uiTargets);
  if (tt) {
    L.push('', '## 可交互控件尺寸（桌面 FIT 缩放后 CSS px；触屏要求 ≥44px）', '', '| 控件 | 宽 | 高 |', '|---|---|---|');
    for (const b of tt.notes.uiTargets) L.push(`| ${b.qa ?? b.label} | ${b.cssW} | ${b.cssH} |`);
  }
  // console 错误
  const errRows = results.flatMap((r) => r.errors.map((e) => [r.id, e]));
  L.push('', '## Console / 页面错误', '');
  if (!errRows.length) L.push('无。');
  else for (const [id, e] of errRows.slice(0, 40)) L.push(`- ${id} [${e.kind}] ${String(e.text).slice(0, 300)}`);
  const dw = results.flatMap((r) => r.dataWarnings.map((w) => [r.id, w]));
  if (dw.length) { L.push('', '## 数据校验警告', ''); for (const [id, w] of dw.slice(0, 40)) L.push(`- ${id} ${String(w).slice(0, 300)}`); }
  // 截图
  L.push('', '## 截图', '');
  for (const r of results) {
    if (!r.shots.length) continue;
    L.push(`### ${r.id}`, '');
    for (const abs of r.shots.slice(0, 24)) { const rel = link(abs); if (rel) L.push(`![${basename(abs)}](${rel})`); }
    L.push('');
  }
  const file = join(qaDir, `report-${runId}.md`);
  writeFileSync(file, L.join('\n'));
  writeFileSync(join(qaDir, 'report-latest.md'), L.join('\n'));
  return file;
}
