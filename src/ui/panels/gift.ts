// 礼物页:SEALED(未到 12/24 UTC+8)与开盒两态。祝福正文不在仓库里,走加密 #g= 链接,运行时用 Web Crypto 解密。
//
// 链接格式:  https://…/#g=<base64url(salt16 | iv12 | ciphertext)>[&k=<口令>]
//   密钥 = PBKDF2-SHA256(口令, salt, 150000 次) → AES-256-GCM;明文 = UTF-8 JSON {"t":"祝福正文","s":"落款"}
//   口令来源:链接里的 k=(make-gift --embed 生成),否则打开礼物时让收礼人输入。
//   生成脚本:scripts/make-gift.mjs(与本文件的 decryptGift 互通,改格式要两边一起改)。
import { drawFirework, drawGiftBox } from '../../art/things/index.ts';
import { GIFT_ERRORS, GIFT_FRAME, GIFT_RENDER_ORDER, giftCountdown } from '../../content/gift.ts';
import { ENDING } from '../../content/story.ts';
import { BTN } from '../../content/ui.ts';
import { GIFT_DATE, giftOpen } from '../../core/gift.ts';
import { btn, h, openSheet, reducedMotion, sfx } from './dom.ts';
import type { PanelCtx } from './types.ts';

export const GIFT_KDF = { name: 'PBKDF2', hash: 'SHA-256', iterations: 150000, saltLen: 16, ivLen: 12 } as const;
export interface GiftPayload {
  t: string;
  s: string;
}
export class GiftError extends Error {
  constructor(public code: keyof typeof GIFT_ERRORS) {
    super(code);
  }
}

const b64uToBytes = (s: string): Uint8Array => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b + '='.repeat((4 - (b.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const bytesToB64u = (u: Uint8Array): string => {
  let s = '';
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** 从 location.hash 取出 {g, k};没有 #g= 返回 null */
export function parseGiftHash(hash: string): { g: string; k: string | null } | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const g = p.get('g');
  return g ? { g: g.replace(/\s+/g, ''), k: p.get('k') } : null;
}

async function deriveKey(pass: string, salt: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new GiftError('noCrypto');
  const base = await subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', hash: GIFT_KDF.hash, salt: salt as BufferSource, iterations: GIFT_KDF.iterations }, base, { name: 'AES-GCM', length: 256 }, false, usage);
}

export async function decryptGift(payloadB64u: string, pass: string): Promise<GiftPayload> {
  let raw: Uint8Array;
  try {
    raw = b64uToBytes(payloadB64u);
  } catch {
    throw new GiftError('decryptFail');
  }
  if (raw.length < GIFT_KDF.saltLen + GIFT_KDF.ivLen + 17) throw new GiftError('decryptFail');
  const salt = raw.slice(0, GIFT_KDF.saltLen);
  const iv = raw.slice(GIFT_KDF.saltLen, GIFT_KDF.saltLen + GIFT_KDF.ivLen);
  const ct = raw.slice(GIFT_KDF.saltLen + GIFT_KDF.ivLen);
  const key = await deriveKey(pass, salt, ['decrypt']);
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct as BufferSource);
    const j = JSON.parse(new TextDecoder().decode(pt)) as Partial<GiftPayload>;
    return { t: String(j.t ?? ''), s: String(j.s ?? '') };
  } catch {
    throw new GiftError('decryptFail');
  }
}

/** 浏览器里也能加密(预览/测试用);正式生成请用 scripts/make-gift.mjs */
export async function encryptGift(p: GiftPayload, pass: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(GIFT_KDF.saltLen));
  const iv = crypto.getRandomValues(new Uint8Array(GIFT_KDF.ivLen));
  const key = await deriveKey(pass, salt, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(JSON.stringify(p))));
  const out = new Uint8Array(salt.length + iv.length + ct.length);
  out.set(salt, 0);
  out.set(iv, salt.length);
  out.set(ct, salt.length + iv.length);
  return bytesToB64u(out);
}

export interface Gift {
  open(force?: 'sealed' | 'open'): void;
  hasPayload(): boolean;
}

export function createGift(ctx: PanelCtx, onChange: () => void): Gift {
  // 启动时记下 hash(应用之后可能清掉它)
  let stash = typeof location !== 'undefined' ? parseGiftHash(location.hash) : null;
  const now = (): number => ctx.nowMs?.() ?? Date.now();

  function open(force?: 'sealed' | 'open'): void {
    const live = typeof location !== 'undefined' ? parseGiftHash(location.hash) : null;
    if (live) stash = live;
    const unlocked = force ? force === 'open' : giftOpen(now());
    const reduced = reducedMotion(ctx);
    let raf = 0;
    let alive = true;
    const sheet = openSheet(ctx, {
      id: 'panel-gift',
      title: GIFT_FRAME.settingsEntry,
      cls: 'panel-gift-sheet',
      noHeader: true,
      onClose: () => {
        alive = false;
        cancelAnimationFrame(raf);
        ctx.actions?.giftClosed?.();
        onChange();
      },
    });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = 220;
    const H = 150;
    const cv = h('canvas', 'panel-gift-cv') as HTMLCanvasElement;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', unlocked ? '树下的盒子' : '封着的盒子');
    const g = cv.getContext('2d');
    let openAmt = 0;
    let wobble = 0;
    let burst = -1;
    let t0 = performance.now();
    const frame = (tm: number): void => {
      if (!alive || !g) return;
      const t = reduced ? 0 : (tm - t0) / 1000;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      if (burst >= 0) {
        const p = Math.min(1, (tm - burst) / 1300);
        drawFirework(g, 50, 52, 1.1, { p, seed: 3 });
        drawFirework(g, 172, 46, 0.9, { p: Math.max(0, p - 0.15), seed: 8 });
        if (p >= 1) burst = -1;
      }
      const pulse = !unlocked || openAmt > 0 || reduced ? 0 : ((t % 4) / 4 > 0.85 ? ((t % 4) / 4 - 0.85) / 0.15 : 0);
      drawGiftBox(g, W / 2, H - 8, 3.6, { open: openAmt, progress: unlocked ? 1 : 0.7, t: t + wobble, pulse });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const stage = h('div', 'panel-gift-stage', cv);
    const lines = h('div', 'panel-gift-lines');
    lines.setAttribute('aria-live', 'polite');
    const acts = h('div', 'panel-gift-acts');
    sheet.body.append(stage, lines, acts);
    sheet.body.classList.add('panel-gift-body');

    // ── SEALED ──
    if (!unlocked) {
      const cd = h('p', 'panel-gift-cd');
      const upd = (): void => {
        cd.textContent = giftCountdown(GIFT_DATE - now());
      };
      upd();
      const iv = window.setInterval(() => (alive ? upd() : clearInterval(iv)), 1000);
      for (const l of ENDING.sealed) lines.append(h('p', 'panel-gift-l in', l.text));
      lines.append(h('p', 'panel-gift-tag', GIFT_FRAME.sealedTag), cd);
      acts.append(btn(BTN.close, '', () => sheet.close()));
      return;
    }

    // ── 可开 ──
    let pass = stash?.k ?? '';
    const needPass = !!stash && !stash.k;
    const input = h('input', 'panel-gift-pass') as HTMLInputElement;
    input.type = 'password';
    input.autocomplete = 'off';
    input.placeholder = '口令(送你的人告诉你的)';
    input.setAttribute('aria-label', '口令');
    const say = (cls: string, text: string): HTMLElement => {
      const p = h('p', 'panel-gift-l ' + cls, text);
      lines.append(p);
      requestAnimationFrame(() => p.classList.add('in'));
      return p;
    };
    const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, reduced ? 0 : ms));

    const showOpenBtn = (): void => {
      acts.replaceChildren();
      if (needPass) acts.append(input);
      acts.append(btn(GIFT_FRAME.openButton, 'red panel-gift-open', () => void run()));
    };
    let running = false;
    async function run(): Promise<void> {
      if (running) return;
      if (needPass) pass = input.value;
      if (needPass && !pass) {
        input.focus();
        return;
      }
      running = true;
      lines.replaceChildren();
      acts.replaceChildren();
      // 解密与开盒动画并行
      let result: Promise<GiftPayload>;
      if (!stash) {
        result = ctx.debug ? Promise.resolve({ t: GIFT_FRAME.giftText, s: GIFT_FRAME.giftSign }) : Promise.reject(new GiftError('noPayload'));
      } else result = decryptGift(stash.g, pass);
      const settled = result.then(
        (v) => ({ ok: true as const, v }),
        (e: unknown) => ({ ok: false as const, e }),
      );
      say('fix', GIFT_FRAME.openingLine);
      t0 = performance.now();
      if (!reduced) {
        const w0 = performance.now();
        await new Promise<void>((res) => {
          const s = (tm: number): void => {
            const p = (tm - w0) / 900;
            wobble = Math.sin(p * 30) * 0.12 * (1 - p);
            if (p >= 1 || !alive) return res();
            requestAnimationFrame(s);
          };
          requestAnimationFrame(s);
        });
        wobble = 0;
      }
      const r = await settled;
      if (!alive) return;
      if (!r.ok) {
        running = false;
        const code = r.e instanceof GiftError ? r.e.code : 'generic';
        lines.replaceChildren();
        say('err', GIFT_ERRORS[code]);
        acts.append(btn(BTN.retry ?? '再试一次', '', () => showOpenBtn()), btn(BTN.close, 'ghost', () => sheet.close()));
        if (needPass) input.select();
        return;
      }
      sfx(ctx, 'giftOpen');
      const o0 = performance.now();
      await new Promise<void>((res) => {
        const s = (tm: number): void => {
          openAmt = reduced ? 1 : Math.min(1, (tm - o0) / 700);
          if (openAmt >= 1 || !alive) return res();
          requestAnimationFrame(s);
        };
        requestAnimationFrame(s);
      });
      if (!reduced) burst = performance.now();
      lines.replaceChildren();
      const payload = r.v;
      for (const k of GIFT_RENDER_ORDER) {
        if (!alive) return;
        if (k === 'fixedLine') say('fix', GIFT_FRAME.fixedLine);
        else if (k === 'giftText') say('text', payload.t);
        else if (k === 'giftSign') {
          if (payload.s) say('sign', payload.s);
        } else say('close', GIFT_FRAME.closing);
        await wait(k === 'giftText' ? 1600 : 900);
      }
      running = false;
      acts.replaceChildren(
        btn(GIFT_FRAME.closeButton, 'red', () => sheet.close()),
        btn(GIFT_FRAME.readAgain, 'ghost', () => {
          openAmt = 0;
          showOpenBtn();
          lines.replaceChildren();
        }),
      );
    }
    showOpenBtn();
  }

  return { open, hasPayload: () => !!stash };
}
