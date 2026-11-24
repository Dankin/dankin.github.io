// 角色/小鸟的玩法层:点中小鸟/不点、彩蛋角色点击(characterClick)、礼物堆沿口。
// 画面(飞行/动作/飘字位置)在 ui/scene-art.ts;数值与冷却在 core/sys/characters.ts;这里把它们和 State、总线、音频、飘字接起来。
import { EGG_CHAR_FLOATS } from '../content/eggs.ts';
import { BIRD_APPEAR, BIRD_HIT, BIRD_PECK, BIRD_SPECIAL, STATION_FLOATS } from '../content/finale.ts';
import { bus } from '../core/bus.ts';
import { NEWTON_S } from '../core/events.ts';
import { mods, throughput } from '../core/game.ts';
import { birdHit, birdPeck, characterClick, type CharacterId } from '../core/sys/characters.ts';
import { CHARACTER_REWARD } from '../core/sys/constants.ts';
import { fmt } from '../ui/format.ts';
import { app, hooks } from './ctx.ts';
import { emitSys } from './sys.ts';
import { toast } from './toasts.ts';
import { persist } from './session.ts';

const pick = <T,>(a: ReadonlyArray<T>): T => a[Math.floor(Math.random() * a.length)]!;
const fill = (t: string, n: number): string => t.replace('{n}', fmt(n));

/** 直接送达:加 delivered + coins(与 claimEvent 同口径) */
function grant(apples: number, coins: number): void {
  const s = app.state;
  s.delivered += apples;
  s.coins += coins;
  if (s.wonAt === null && s.delivered >= 8_200_000_000) s.wonAt = s.playSec;
}

/** sys 的 sfx id → 现有音效名(没有的退到 'egg') */
const SFX_MAP: Record<string, string> = {
  'char-newton': 'bonk', 'apple-golden': 'goldenCatch', 'apple-fast': 'appleDrop', 'apple-bounce': 'appleDrop', 'apple-quake': 'bonk',
  'apple-roll': 'appleFly', 'apple-poof': 'spoil', 'apple-land': 'appleDrop', 'bird-hit': 'goldenCatch', 'bird-peck': 'bite',
};
export function playSfx(id: string | undefined, fallback = 'egg'): void {
  const sfx = app.audio.sfx as unknown as { play(n: string): void };
  try {
    sfx.play(id && SFX_MAP[id] ? SFX_MAP[id]! : id && /^(coin|bite|bonk|giftOpen|golden|goldenCatch|egg|rareApple|bugSquash|fanfare)$/.test(id) ? id : fallback);
  } catch { /* 音频未解锁 */ }
}

// ───────────── 小鸟 ─────────────
const birdSeen = (): number => {
  const c = app.state.sys.codex.counters as Record<string, number>;
  return (c.birdHits ?? 0) + (c.birdPecks ?? 0);
};
/** 小鸟出现:气泡文案(第 10 次起带朋友) */
export function birdAppearText(): string {
  const list = BIRD_APPEAR.filter((l) => l.id !== 'bd-a5' || birdSeen() >= 10);
  return pick(list).text;
}

/** 点中:掉羽毛(画面已演)+ 苹果奖励(birdHit 为唯一数值来源)+ 飘字/提示/音效 */
export function onBirdHit(): number {
  const s = app.state;
  const th = throughput(s);
  const r = birdHit(th.flow, mods(s).value, Math.random);
  grant(r.apples, r.coins);
  const o = app.orchard;
  const p = o.spot('crown');
  // 飘字错开:奖励在树冠上方,气泡话晚 0.7 秒、往右挪一截,别糊在一起
  o.floatText(fill(pick(BIRD_HIT.floats), r.apples), p ? p.x - 10 : undefined, p ? p.y - 66 : undefined);
  const bub = pick(BIRD_HIT.bubbles);
  setTimeout(() => app.orchard.floatText(bub, p ? p.x + 40 : undefined, p ? p.y - 96 : undefined), 700);
  const dec24 = new Date(Date.now()).getMonth() === 11;
  toast(app.state.helperLevel > 0 && Math.random() < 0.2 ? BIRD_SPECIAL.withLaoxu : dec24 && Math.random() < 0.5 ? BIRD_SPECIAL.hat : pick(BIRD_HIT.toasts), 3200);
  playSfx('bird-hit', 'goldenCatch');
  bus.emit({ t: 'event', kind: 'bird', phase: 'hit' });
  bus.emit({ t: 'gold', kind: 'bird', apples: r.apples });
  persist();
  hooks.render();
  return r.apples;
}

/** 没点:小鸟啄走一点库存(birdPeck 封顶),不做点击压力 */
export function onBirdMiss(): void {
  const s = app.state;
  const th = throughput(s);
  const n = Math.min(s.stock, Math.max(0, birdPeck(s.stock, th.flow)));
  if (n > 0) {
    s.stock = Math.max(0, s.stock - n);
    app.orchard.peckFx();
    const q = app.orchard.spot('pile');
    app.orchard.floatText(`-${fmt(n)}`, q?.x, q ? q.y - 18 : undefined);
  }
  toast(pick(BIRD_PECK.toasts), 3000);
  const p = app.orchard.spot('crown');
  setTimeout(() => app.orchard.floatText(pick(BIRD_PECK.bubbles), p ? p.x + 40 : undefined, p ? p.y - 50 : undefined), 500);
  playSfx('bird-peck', 'bite');
  bus.emit({ t: 'event', kind: 'bird', phase: 'miss' });
  persist();
  hooks.render();
}

// ───────────── 彩蛋角色 ─────────────
interface CharRule {
  id: CharacterId;
  /** EGG_CHAR_FLOATS 的键;station 则取 STATION_FLOATS 的键 */
  key?: string;
  station?: string;
  /** drawCharacterEgg 的角色(null = 只飘字+粒子) */
  art: 'newton' | 'santa' | 'duoduo' | 'dudu' | null;
  /** 角色演出位置(scene.spot id;缺省用点击点) */
  at?: string;
}
const RULES: Record<string, CharRule> = {
  newton: { id: 'newton', key: 'newton', art: null },
  'treetop-fruit': { id: 'snow-white', key: 'eve', art: null },
  'poison-stall': { id: 'snow-white', key: 'snowwhite', art: null },
  'summit-gold': { id: 'runner', key: 'paris', art: null },
  'xu-head-apple': { id: 'archer', key: 'tell', art: null },
  'xu-throat': { id: 'snake', key: 'adam', art: null },
  garage: { id: 'turtleneck', key: 'jobs', art: null },
  moon: { id: 'einstein', key: 'einstein', art: null },
  orange: { id: 'merchant', key: 'orange', art: 'duoduo' },
  elf: { id: 'elf', station: 'elf-wave', art: null, at: 'elf' },
  'sleigh-bell': { id: 'elf', station: 'sleigh-bell', art: 'santa', at: 'sleigh-bell' },
  'reindeer-nose': { id: 'reindeer', station: 'reindeer-nose', art: null, at: 'reindeer-nose' },
  'gift-top': { id: 'elf', station: 'gift-peek', art: null, at: 'gift-top' },
};

const lastAt = new Map<string, number>();
let tapXY: { x: number; y: number } | null = null;
/** routeStageTap 记下点击位置(画布 CSS 像素) */
export function noteTap(x: number, y: number): void {
  tapXY = { x, y };
}

/** 点到彩蛋角色/热点:有演出、飘字、粒子、音效;收益受 60s 冷却(首次必给)。返回是否处理 */
export function charTap(target: string): boolean {
  const rule = RULES[target];
  if (!rule) return false;
  const s = app.state;
  const o = app.orchard;
  const th = throughput(s);
  const spot = rule.at ? o.spot(rule.at) : null;
  const pos = spot ?? tapXY ?? o.spot('crown') ?? { x: 100, y: 100 };
  const last = lastAt.get(target);
  const ready = last === undefined || s.playSec - last >= CHARACTER_REWARD.cooldownS;
  const info = rule.key ? EGG_CHAR_FLOATS[rule.key] : rule.station ? STATION_FLOATS[rule.station] : undefined;
  const r = characterClick(rule.id, th.flow, mods(s).value);
  const ground = spot ? pos.y + 6 : pos.y;
  o.charAct(rule.art, pos.x, rule.art ? ground : pos.y, r.particle, -1);
  if (info?.reaction) o.floatText(info.reaction, pos.x, pos.y - 34);
  if (ready) {
    lastAt.set(target, s.playSec);
    if (r.buff) {
      s.newtonUntil = s.playSec + NEWTON_S;
      o.floatText('灵感!', pos.x, pos.y - 8);
    } else if (r.apples > 0) {
      grant(r.apples, r.coins);
      const f = info && 'floats' in info && info.floats.length ? pick(info.floats) : '+{n}';
      o.floatText(fill(f, r.apples), pos.x, pos.y - 8);
    }
    persist();
    hooks.render();
  }
  playSfx(r.sfx, 'egg');
  return true;
}

// ───────────── 礼物堆沿口(gift-peek 的前置事件) ─────────────
let rimSent = false;
export function checkGiftRim(): void {
  if (rimSent) return;
  const lv = (app.orchard as unknown as { giftLevel?: () => number }).giftLevel?.() ?? 0;
  if (lv >= 0.72) {
    rimSent = true;
    emitSys({ t: 'gift-rim' } as never);
  }
}
