// 面板预览:?s=<场景> 打开某个面板,用于截图自检。场景见下方 SCENES。
import { bus } from '../../core/bus.ts';
import { newState } from '../../core/state.ts';
import type { GameAudio } from '../../audio/bgm.ts';
import type { AppleKind } from '../../core/sys/varieties.ts';
import { mountPanels } from './index.ts';

const q = new URLSearchParams(location.search);
if (q.has('still')) document.head.append(Object.assign(document.createElement('style'), { textContent: '*{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}' }));
const scene = q.get('s') ?? 'dock';
const st = newState(Date.now());
if (['gift-read', 'gift-done', 'gift-fail'].includes(new URLSearchParams(location.search).get('s') ?? '')) st.settings.reducedMotion = true;
st.playSec = 2400;
st.coins = 125_000;
st.source.tier = 5;
st.route.tier = 5;
const s = st.sys;
const pl = st.playSec;
s.bag = { fuji: 3, granny: 1, goldenDel: 2, pinkLady: 1 } as typeof s.bag;
s.orders.done = 4;
s.orders.list = [
  { id: 1, want: 'fuji' as AppleKind, qty: 2, rush: false, createdAt: pl - 20, expiresAt: pl + 100, customer: 0, rewardSec: 30 },
  { id: 2, want: 'granny' as AppleKind, qty: 3, rush: true, createdAt: pl - 10, expiresAt: pl + 35, customer: 1, rewardSec: 55 },
  { id: 3, want: 'any', qty: 4, rush: false, createdAt: pl - 60, expiresAt: pl + 70, customer: 2, rewardSec: 40 },
  { id: 4, want: 'purple' as AppleKind, qty: 1, rush: false, createdAt: pl, expiresAt: pl + 120, customer: 0, rewardSec: 20 },
];
if (scene !== 'codex-empty') {
  for (const k of ['fuji', 'goldenDel', 'granny', 'pinkLady', 'redStreak', 'purple', 'worm'] as const) s.codex.kinds[k] = { at: 100, n: 3 };
  for (const e of ['turtleneck', 'newton', 'elf-wave', 'snow-white']) s.codex.eggs[e] = { at: 200, n: 1 };
  for (const a of Object.keys(s.codex.ach).length ? [] : ['first']) s.codex.ach[a] = 300;
}

const store: Record<string, string> = {};
if (scene === 'codex-empty' || scene === 'fresh') store['sta.panels'] = '{}';
const kv = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v) };
const vol: Record<string, number> = { bgm: 0.8, sfx: 1, voice: 0.6 };
const sw = { m: true, s: false, v: false };
const audio = {
  unlock() {}, setMusic: (v: boolean) => (sw.m = v), setSfx: (v: boolean) => (sw.s = v), setVoice: (v: boolean) => (sw.v = v),
  isMusicOn: () => sw.m, isSfxOn: () => sw.s, isVoiceOn: () => sw.v,
  setVolume: (l: string, v: number) => void (vol[l] = v), getVolume: (l: string) => vol[l] ?? 1,
  silentSwitchHint: () => '没听到声音?请检查手机侧面的静音键,并调高音量。', setReducedMotion() {}, sfx: { play() {} },
} as unknown as GameAudio;

function main(): void {
if ((scene === 'gift-done' || scene === 'gift-fail') && !location.hash.startsWith('#g=')) {
  // 由 scripts/make-gift.mjs --pass 苹果 生成(预览固定值,避免预览时现算 PBKDF2)
  const g = 'PdhPClbtbCQVTPb0SACjRLRsFbRKZ0L5oG1a_kJPzKKUmohAAxwm_Ee8KHDrxT2He5r8udp6wGgF_0hItoPaLznlqwoOnRkoCQjSzXAw0ACE_8aloiehQYN4-RmA9Urq0IXkDU2XL18xepmFit2gaEo0HMLLVGyhPf72KBDma9i1TQ';
  history.replaceState(null, '', location.search + '#g=' + g + (scene === 'gift-done' ? '&k=%E8%8B%B9%E6%9E%9C' : '&k=wrong'));
}
const api = mountPanels({
  bus, getState: () => st, audio, kv, debug: scene === 'settings' || scene === 'gift-read', version: 'v5-preview',
  nowMs: () => (scene.startsWith('gift-') && scene !== 'gift-sealed' ? Date.UTC(2026, 11, 24, 3) : Date.UTC(2026, 11, 20, 3)),
  actions: {
    claimOrder: (id) => { const i = s.orders.list.findIndex((o) => o.id === id); if (i >= 0) s.orders.list.splice(i, 1); return { ok: true, reward: 100 }; },
    offer: (W) => ({ spent: W, apples: W / 10 }), offerPreview: (W) => W / 10,
    exportSave: () => '{"v":5,"demo":"这是预览用的存档文本"}', importSave: () => true, resetSave() {}, settingsChanged() {},
  },
});
(window as unknown as { api: typeof api }).api = api;

const go = async (): Promise<void> => {
  switch (scene) {
    case 'narr': api.say('树抖了一下。一个苹果,掉进了你的手里。', 'xu', { force: true }); break;
    case 'narr-long': api.say('这一棵树,已经替你送出了三千二百个苹果。老徐说,够吃到过年了,但是你好像并不打算停下来。', 'xu', { force: true }); break;
    case 'codex': case 'codex-empty': api.openCodex('varieties'); break;
    case 'codex-eggs': api.openCodex('eggs'); break;
    case 'codex-var': api.openCodex('varieties'); setTimeout(() => document.querySelectorAll<HTMLButtonElement>('.panel-cell.on')[2]?.click(), 200); break;
    case 'codex-egg': api.openCodex('eggs'); setTimeout(() => document.querySelectorAll<HTMLButtonElement>('.panel-cell.on')[1]?.click(), 200); break;
    case 'codex-ach': api.openCodex('achievements'); break;
    case 'orders': api.openOrders(); break;
    case 'stage-src': api.showStageCard('src-3'); break;
    case 'stage-src0': api.showStageCard('src-0'); break;
    case 'stage-rt': api.showStageCard('rt-3'); break;
    case 'stage-station': api.showStageCard('station'); break;
    case 'stage-list': for (const id of ['src-0', 'rt-0', 'rt-1', 'station']) api.showStageCard(id, true); setTimeout(() => api.openStageCards(), 50); break;
    case 'offer': api.openOffer(); break;
    case 'settings': api.openSettings(); break;
    case 'gift-sealed': api.openGift(); break;
    case 'gift-open': api.openGift(); break;
    case 'gift-read': api.openGift(); setTimeout(() => document.querySelector<HTMLButtonElement>('.panel-gift-open')?.click(), 300); break;
    case 'gift-done': case 'gift-fail':
      api.openGift();
      setTimeout(() => { document.querySelector<HTMLButtonElement>('.panel-gift-open')?.click(); if (q.has('still')) void fetch('http://127.0.0.1:5199/', { mode: 'no-cors' }).catch(() => {}); }, 300);
      break;
  }
};
void go();
}
void main();
