// 模拟 GitHub Pages / Cloudflare 的静态托管：严格 404（无 SPA 回退）、gzip/br 压缩、可选子路径前缀、请求日志。
// 用法：node static-server.mjs <dist目录> <端口> [前缀如 /sub/path]
import http from 'node:http';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import zlib from 'node:zlib';

const [, , DIR = '.', PORT = '5189', PREFIX = ''] = process.argv;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.map': 'application/json' };
const cache = new Map();
export const log = [];
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = decodeURIComponent(u.pathname);
  const entry = { url: req.url, status: 404 };
  const finish = (code, body, headers = {}) => { entry.status = code; log.push(entry); res.writeHead(code, headers); res.end(body); };
  if (u.pathname === '/__log') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(log.splice(0))); }
  if (PREFIX) { if (!p.startsWith(PREFIX)) return finish(404, 'not found'); p = p.slice(PREFIX.length) || '/'; }
  if (p.endsWith('/')) p += 'index.html';
  const file = join(DIR, normalize(p));
  if (!file.startsWith(normalize(DIR)) || !existsSync(file) || !statSync(file).isFile()) return finish(404, '404 not found', { 'content-type': 'text/plain' });
  const ext = extname(file);
  const ae = String(req.headers['accept-encoding'] || '');
  const enc = /\bbr\b/.test(ae) ? 'br' : /\bgzip\b/.test(ae) ? 'gzip' : '';
  const compressible = ['.html', '.js', '.css', '.json', '.svg'].includes(ext);
  const k = file + '|' + (compressible ? enc : '');
  if (!cache.has(k)) {
    let b = readFileSync(file);
    if (compressible && enc === 'br') b = zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } });
    else if (compressible && enc === 'gzip') b = zlib.gzipSync(b, { level: 6 });
    cache.set(k, b);
  }
  const body = cache.get(k);
  const h = { 'content-type': MIME[ext] || 'application/octet-stream', 'content-length': body.length, 'cache-control': 'max-age=600', vary: 'Accept-Encoding' };
  if (compressible && enc) h['content-encoding'] = enc;
  finish(200, body, h);
});
srv.listen(Number(PORT), '127.0.0.1', () => console.log(`static ${DIR} → http://127.0.0.1:${PORT}${PREFIX}/`));
