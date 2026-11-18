// 用某次运行的 out/<runId>/*/result.json 重新生成报告：node regen-report.mjs <runId>
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeReport } from './lib/report.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const runId = process.argv[2];
const OUT_ROOT = join(here, 'out');
const dir = join(OUT_ROOT, runId);
const results = readdirSync(dir).sort().map((d) => join(dir, d, 'result.json')).filter(existsSync).map((f) => JSON.parse(readFileSync(f, 'utf8')));
console.log('报告:', await writeReport({ runId, results, outRoot: OUT_ROOT, repoRoot: join(here, '..', '..') }));
