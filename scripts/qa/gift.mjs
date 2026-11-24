// 礼物页:SEALED/开盒、UTC+8 边界(冻结 Date.now,非 debug 路径)、#g= 加解密成功/失败。node scripts/qa/gift.mjs [land|port|desk]
import { execFileSync } from 'node:child_process';
import * as L from './lib.mjs';
const vname = process.argv[2] || 'land';
const [W, H] = L.VIEWS[vname];
const R = L.makeReporter('gift-' + vname);
const { srv, base } = await L.serve();
const SECRET = '树下的盒子QA测试祝福:今年的苹果很甜。';
const SIGN = '——QA';
const out = execFileSync('node', ['scripts/make-gift.mjs', '--pass', 'qa-pass-1', '--text', SECRET, '--sign', SIGN, '--base', base], { encoding: 'utf8' });
const links = out.split('\n').filter((l) => l.startsWith(base + '#g='));
const linkPass = links[0].slice(base.length); // #g=...  (需手输口令)
const linkEmbed = links[1].slice(base.length); // #g=...&k=...
R.info('make-gift links', `${links.length} links, g length ${linkPass.length}`);
R.check('make-gift prints 2 links', links.length === 2);
const b = await L.launchBrowser({ base });
await b.view(W, H);
const freeze = (iso) => `(()=>{const T=Date.parse('${iso}');Date.now=()=>T})()`;
const gtxt = () => b.ev('(document.querySelector("#panel-gift")||{}).innerText||""');
const sheetOpen = () => b.ev('!!document.querySelector("#panel-gift")');
async function openGiftVia(query, { preloadSrc, tz, wait = 1000 } = {}) {
  await b.blank?.();
  const ids = [];
  if (tz) await b.tz(tz);
  if (preloadSrc) ids.push(await b.preload(preloadSrc));
  await b.open(query, { wait });
  return ids;
}
async function clickOpenBtn() { return b.ev('(()=>{const e=document.querySelector(".panel-gift-open");if(!e)return false;e.click();return true})()'); }

// ── 1. 真实日期(非 debug,2026-11-24):封印 ──
await b.open('?', { wait: 1000 });
await b.G('(()=>g)()').catch(() => {});
R.info('non-debug: __game exposed?', String(await b.ev('typeof window.__game')));
// ── 2. 边界:冻结时钟 + 多时区,非 debug,走 panels 内部路径需要入口:用 #g= 自动打开(1.2s 后) ──
async function boundaryCase(iso, tz, expectOpen) {
  const pid = await b.preload(freeze(iso));
  await b.tz(tz);
  await b.open(linkEmbed, { wait: 2600 });
  const t = await gtxt();
  const isOpen = await b.ev('!!document.querySelector("#panel-gift .panel-gift-open")');
  R.check(`${iso} tz=${tz} → ${expectOpen ? 'OPEN' : 'SEALED'}`, await sheetOpen() && isOpen === expectOpen && !t.includes(SECRET), `open=${isOpen} text="${t.replace(/\n/g, ' / ').slice(0, 80)}"`);
  await b.unpreload(pid);
}
for (const tz of ['Asia/Shanghai', 'America/Los_Angeles', 'Pacific/Kiritimati', 'UTC']) {
  await boundaryCase('2026-12-23T15:59:59Z', tz, false);
  await boundaryCase('2026-12-23T16:00:00Z', tz, true);
}
await b.tz('Asia/Shanghai');
await boundaryCase('2026-12-23T15:59:59.999Z', 'Asia/Shanghai', false);

// ── 3. 封印态内容、截图 ──
let pid = await b.preload(freeze('2026-12-10T04:00:00Z'));
await b.open(linkEmbed, { wait: 2600 });
await b.shot(`gift_sealed_${vname}`);
const sealedTxt = await gtxt();
R.info('sealed text', sealedTxt.replace(/\n/g, ' / '));
R.check('sealed shows countdown', /还有|天|小时/.test(sealedTxt), sealedTxt.replace(/\n/g, ' / '));
R.check('sealed page does not contain plaintext', !(await b.ev('document.documentElement.innerHTML')).includes(SECRET));
await b.unpreload(pid);

// ── 4. 开盒:内嵌口令 ──
pid = await b.preload(freeze('2026-12-24T04:00:00Z'));
await b.open(linkEmbed, { wait: 2600 });
R.check('embed link: no password input', !(await b.ev('!!document.querySelector(".panel-gift-pass")')));
await b.shot(`gift_open_before_${vname}`);
await clickOpenBtn();
await L.sleep(1500); await b.shot(`gift_opening_${vname}`);
await L.sleep(7000);
let t = await gtxt();
R.check('embed link decrypts to secret text', t.includes(SECRET), t.replace(/\n/g, ' / ').slice(0, 160));
R.check('sign shown', t.includes(SIGN));
await b.shot(`gift_opened_${vname}`);
R.info('opened text', t.replace(/\n/g, ' / '));
// 关闭
await b.ev('document.querySelector("#panel-gift .panel-x, #panel-gift [aria-label=关闭]")?.click()');
await L.sleep(400);
R.info('after close sheet exists?', String(await sheetOpen()));
await b.unpreload(pid);

// ── 5. 手输口令:错口令 → 失败文案,可重试;对口令 → 成功 ──
pid = await b.preload(freeze('2026-12-24T04:00:00Z'));
await b.open(linkPass, { wait: 2600 });
R.check('pass link shows password input', await b.ev('!!document.querySelector(".panel-gift-pass")'));
await b.ev('(()=>{const i=document.querySelector(".panel-gift-pass");i.value="wrong";})()');
await clickOpenBtn(); await L.sleep(3500);
t = await gtxt();
R.check('wrong password → error text, no plaintext', /打不开/.test(t) && !t.includes(SECRET), t.replace(/\n/g, ' / ').slice(0, 120));
await b.shot(`gift_wrongpass_${vname}`);
// 再试一次
await b.ev('(()=>{const bt=[...document.querySelectorAll("#panel-gift button")].find(x=>/再试/.test(x.textContent));bt&&bt.click()})()');
await L.sleep(300);
await b.ev('(()=>{const i=document.querySelector(".panel-gift-pass");i.value="qa-pass-1";})()');
await clickOpenBtn(); await L.sleep(8500);
t = await gtxt();
R.check('retry with right password decrypts', t.includes(SECRET), t.replace(/\n/g, ' / ').slice(0, 120));
await b.unpreload(pid);

// ── 6. 截断/篡改的链接 ──
pid = await b.preload(freeze('2026-12-24T04:00:00Z'));
const trunc = linkEmbed.replace(/&k=.*/, '').slice(0, 60) + '&k=qa-pass-1';
await b.open(trunc, { wait: 2600 });
await clickOpenBtn(); await L.sleep(3500);
t = await gtxt();
R.check('truncated link → decryptFail text', /打不开/.test(t), t.replace(/\n/g, ' / ').slice(0, 120));
const tampered = linkEmbed.replace(/(#g=.{40})./, (m, p) => p + (m.slice(-1) === 'A' ? 'B' : 'A'));
await b.open(tampered, { wait: 2600 });
await clickOpenBtn(); await L.sleep(3500);
t = await gtxt();
R.check('tampered ciphertext → decryptFail text', /打不开/.test(t), t.replace(/\n/g, ' / ').slice(0, 120));
await b.open('#g=!!!notbase64&k=x', { wait: 2600 });
await clickOpenBtn(); await L.sleep(3000);
t = await gtxt();
R.check('garbage hash → error not crash', /打不开|空的/.test(t), t.replace(/\n/g, ' / ').slice(0, 120));
await b.unpreload(pid);

// ── 7. 无 payload(非 debug,时钟已过 12/24):通过结局卡/手动入口应报"盒子是空的" ──
// 入口:debug 下用 panels().openGift() 无 hash
await b.open('?debug=1&date=2026-12-24', { wait: 1200 });
await b.G('(()=>g.panels().openGift())()');
await L.sleep(500);
R.check('debug + date=2026-12-24 → opens (UTC+8 noon)', await b.ev('!!document.querySelector("#panel-gift .panel-gift-open")'));
await b.shot(`gift_debug_open_${vname}`);
await b.open('?debug=1&date=2026-12-23', { wait: 1200 });
await b.G('(()=>g.panels().openGift())()');
await L.sleep(500);
R.check('debug + date=2026-12-23 → sealed', !(await b.ev('!!document.querySelector("#panel-gift .panel-gift-open")')) && /还有|天|小时/.test(await gtxt()), (await gtxt()).replace(/\n/g, ' / ').slice(0, 100));
// 非 debug 的 ?date= 无效
await b.open('?date=2026-12-24', { wait: 1200 });
R.info('non-debug ?date= ignored', await b.ev('typeof window.__game'));
await b.open(linkEmbed + '', { wait: 2600 });
R.check('non-debug real clock (2026-11 today) + #g= → sealed', !(await b.ev('!!document.querySelector("#panel-gift .panel-gift-open")')) && await sheetOpen());
R.check('no console errors/exceptions', b.errors().length === 0, JSON.stringify(b.errors().slice(0, 8)));
R.info('warnings', JSON.stringify(b.logs.filter((l) => !b.errors().includes(l)).slice(0, 8)));
R.save(`qa/gift-${vname}.json`);
b.close(); srv.close(); process.exit(0);
