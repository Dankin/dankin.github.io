// 生产构建静态审计：体积 / 资源路径 / 泄漏扫描。用法：node 01-build-audit.mjs /tmp/qa-device-build/dist
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import zlib from 'node:zlib';

const DIST = process.argv[2] || '/tmp/qa-device-build/dist';
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(DIST);
const rows = files.map((f) => { const b = readFileSync(f); return { file: relative(DIST, f), raw: b.length, gzip: zlib.gzipSync(b, { level: 9 }).length, br: zlib.brotliCompressSync(b).length }; });
const total = rows.reduce((a, r) => ({ raw: a.raw + r.raw, gzip: a.gzip + r.gzip, br: a.br + r.br }), { raw: 0, gzip: 0, br: 0 });
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith('data:'));
const checks = [];
const ok = (c, m, d) => { checks.push({ ok: !!c, msg: m, detail: d }); };
ok(refs.length > 0 && refs.every((u) => u.startsWith('./') || !/^(\/|https?:)/.test(u)), 'index.html 资源引用均为相对路径', refs);
ok(!/(?:src|href)="\/[^/]/.test(html), 'index.html 无根绝对路径 (/xxx)');
const jsCss = files.filter((f) => /\.(js|css|html)$/.test(f));
const leak = { localhost: [], abs: [], sourcemap: [], http: {}, rootAbs: [] };
for (const f of jsCss) {
  const s = readFileSync(f, 'utf8'); const r = relative(DIST, f);
  if (/localhost|127\.0\.0\.1/.test(s)) leak.localhost.push(r);
  if (/\/Users\/|\/home\/[a-z]|[A-Z]:\\\\Users/.test(s)) leak.abs.push(r);
  if (/sourceMappingURL/.test(s)) leak.sourcemap.push(r);
  for (const m of s.matchAll(/https?:\/\/[A-Za-z0-9.\-]+/g)) leak.http[m[0]] = (leak.http[m[0]] || 0) + 1;
  // 运行时根绝对路径请求（fetch('/x') / import('/src/...')）
  for (const m of s.matchAll(/(?:import|fetch)\(\s*["'`]\/[a-zA-Z@][^"'`]*["'`]/g)) leak.rootAbs.push(r + ': ' + m[0]);
}
ok(!leak.localhost.length, '无 localhost/127.0.0.1 字符串', leak.localhost);
ok(!leak.abs.length, '无本机绝对路径', leak.abs);
ok(!leak.sourcemap.length, '无 sourcemap 引用（不泄漏源码；如需线上排错可另开）', leak.sourcemap);
ok(!leak.rootAbs.length, '无运行时根绝对路径请求', leak.rootAbs);
const hasDebugChunk = files.some((f) => /testApi/.test(f));
const mainJs = rows.filter((r) => r.file.endsWith('.js')).sort((a, b) => b.raw - a.raw)[0];
const mainSrc = readFileSync(join(DIST, mainJs.file), 'utf8');
const debugGate = /get\(["']debug["']\)\s*===\s*["']1["']/.test(mainSrc);
const info = { debugChunkShipped: hasDebugChunk, debugGateInMain: debugGate, selftestChunk: files.some((f) => /selftest/.test(f)) };
const phaserEstimate = (mainSrc.match(/Phaser v?(\d+\.\d+\.\d+)/) || [])[0];
const res = { dist: DIST, files: rows, total, refs, checks, leak, info, phaserEstimate, mainChunk: mainJs.file };
mkdirSync(new URL('./out/', import.meta.url).pathname, { recursive: true });
writeFileSync(new URL('./out/01-build-audit.json', import.meta.url).pathname, JSON.stringify(res, null, 1));
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log('文件', rows.map((r) => `${r.file} raw ${kb(r.raw)} gzip ${kb(r.gzip)} br ${kb(r.br)}`).join('\n    '));
console.log(`合计 raw ${kb(total.raw)} gzip ${kb(total.gzip)} br ${kb(total.br)}`);
for (const c of checks) console.log(c.ok ? '✓' : '✗', c.msg, c.ok ? '' : JSON.stringify(c.detail));
console.log('http 字符串', leak.http, info, phaserEstimate);
process.exit(checks.every((c) => c.ok) ? 0 : 1);
