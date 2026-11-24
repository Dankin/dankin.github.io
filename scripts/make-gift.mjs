#!/usr/bin/env node
// 生成「树下的盒子」加密链接。格式与 src/ui/panels/gift.ts 的 decryptGift 一一对应,改一处必须改另一处:
//   #g=<base64url(salt16 | iv12 | ciphertext+tag)>[&k=<口令>]
//   密钥 = PBKDF2-SHA256(口令, salt, 150000 次) → AES-256-GCM;明文 = UTF-8 JSON {"t":祝福正文,"s":落款}
// 迭代数取 150000(略低于 OWASP 建议的 600000/210000),是为了在手机上解密不卡;口令本身应够长。
//
// 用法:
//   node scripts/make-gift.mjs --pass 口令 --text "祝福正文" --sign "落款" [--text-file gift.txt] [--base https://你的域名/] [--embed]
//   --embed  把口令放进链接(&k=),收礼的人点开即可拆;不加则对方需要手输口令。
//   不写 --pass 则随机生成 4 个词的口令并打印。
import { webcrypto as crypto } from 'node:crypto';
import { readFileSync } from 'node:fs';

const KDF = { iterations: 150000, saltLen: 16, ivLen: 12 };
const args = process.argv.slice(2);
const get = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
const has = (n) => args.includes('--' + n);
if (has('help') || args.length === 0) {
  console.log('node scripts/make-gift.mjs --pass 口令 --text "祝福" --sign "落款" [--text-file f.txt] [--base URL] [--embed]');
  process.exit(args.length === 0 ? 1 : 0);
}

const text = get('text-file') ? readFileSync(get('text-file'), 'utf8').replace(/\s+$/, '') : get('text');
if (!text) { console.error('缺少 --text 或 --text-file'); process.exit(1); }
const sign = get('sign') ?? '';
const words = ['苹果', '平安', '圣诞', '雪夜', '红色', '灯火', '树下', '礼物', '星星', '糖霜', '铃铛', '烟囱'];
const pass = get('pass') ?? Array.from({ length: 4 }, () => words[crypto.getRandomValues(new Uint8Array(1))[0] % words.length]).join('');
const base = get('base') ?? 'http://localhost:5173/';

const b64u = (u8) => Buffer.from(u8).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const salt = crypto.getRandomValues(new Uint8Array(KDF.saltLen));
const iv = crypto.getRandomValues(new Uint8Array(KDF.ivLen));
const enc = new TextEncoder();
const km = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: KDF.iterations }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify({ t: text, s: sign }))));
const out = new Uint8Array(salt.length + iv.length + ct.length);
out.set(salt, 0); out.set(iv, salt.length); out.set(ct, salt.length + iv.length);
const g = b64u(out);

console.log('口令:', pass);
console.log('链接(对方需手输口令):\n' + base + '#g=' + g);
console.log('链接(口令内嵌,点开即拆):\n' + base + '#g=' + g + '&k=' + encodeURIComponent(pass));
if (has('embed')) console.log('\n[--embed] 推荐发送上面第二条。');
