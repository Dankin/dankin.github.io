#!/usr/bin/env node
/**
 * 回归套件入口： node run-all.mjs [--only 02,03] [--tag smoke] [--list] [--no-report]
 * 按文件名顺序串行运行 specs/*.spec.mjs，输出 docs/qa/report-<日期时间>.md
 */
import { readdirSync, mkdirSync, writeFileSync, existsSync, readFileSync, copyFileSync } from 'node:fs';
import { join, dirname, relative, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runSpec, stamp } from './lib/spec.mjs';
import { OUT_ROOT } from './lib/session.mjs';
import { writeReport } from './lib/report.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const only = (opt('--only') ?? '').split(',').filter(Boolean);
const tag = opt('--tag');
let files = readdirSync(join(here, 'specs')).filter((f) => f.endsWith('.spec.mjs')).sort();
if (only.length) files = files.filter((f) => only.some((o) => f.startsWith(o) || f.includes(o)));
const specs = [];
for (const f of files) { const m = await import(pathToFileURL(join(here, 'specs', f)).href); if (!tag || (m.default.tags ?? []).includes(tag)) specs.push(m.default); }
if (args.includes('--list')) { for (const s of specs) console.log(s.id.padEnd(28), (s.tags ?? []).join(','), s.title); process.exit(0); }

const runId = stamp();
process.env.QA_RUN_ID = runId;
console.log(`QA run ${runId}: ${specs.length} 个用例`);
const results = [];
for (const spec of specs) {
  console.log(`\n▶ ${spec.id}  ${spec.title}`);
  results.push(await runSpec(spec, { runId }));
}
const summary = { pass: 0, fail: 0, known: 0, skip: 0 };
for (const r of results) summary[r.status] = (summary[r.status] ?? 0) + 1;
console.log(`\n结果: 通过 ${summary.pass}  失败 ${summary.fail}  已知缺陷 ${summary.known}  跳过 ${summary.skip}`);
if (!args.includes('--no-report')) {
  const file = await writeReport({ runId, results, outRoot: OUT_ROOT, repoRoot: join(here, '..', '..') });
  console.log('报告:', file);
}
process.exit(summary.fail ? 1 : 0);
