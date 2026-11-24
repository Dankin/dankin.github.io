// 彩蛋判定:55 个,id/奖励/文案以 src/content/eggs.ts(writer)为准,这里只实现触发逻辑。
// 奖励请用 EGG_BY_ID[id].reward(content)发放,hit 里不重复携带。
import { ROUTE_ERA } from '../content.ts';
import { CODEX, LAOXU } from './constants.ts';
import type { CodexState } from './codex.ts';
import type { EggEvent, Snapshot, TapTarget } from './types.ts';
import type { AppleKind } from './varieties.ts';
import type { Rnd } from './util.ts';

interface Ctx {
  snap: Snapshot;
  ev: EggEvent;
  codex: CodexState;
  rnd: Rnd;
  /** 本事件是 login 且今天(UTC+8)第一次 */
  newDay: boolean;
}

const tapIs = (c: Ctx, t: TapTarget): boolean => c.ev.t === 'tap' && c.ev.target === t;
/** 时代:两线较高者(writer 的 minEra) */
const routeEra = (s: Snapshot): number => ROUTE_ERA[s.routeTier] ?? s.routeTier;
const eraMax = (s: Snapshot): number => Math.max(s.sourceTier, routeEra(s));

/** 连点计数:相邻点击间隔 ≤ gap 才累计,到 n 次触发并清零。key 默认用热点名 */
function tapRun(c: Ctx, n: number, gap: number, key?: string, target?: TapTarget): boolean {
  if (c.ev.t !== 'tap') return false;
  const k = key ?? c.ev.target;
  if (c.ev.target !== (target ?? k)) return false;
  const run = (c.codex.tapRun[k] ??= { n: 0, last: -1e9 });
  run.n = c.ev.at - run.last <= gap ? run.n + 1 : 1;
  run.last = c.ev.at;
  if (run.n >= n) {
    run.n = 0;
    return true;
  }
  return false;
}

/** 累计型计数器 */
function bump(c: Ctx, key: string, by = 1): number {
  return (c.codex.counters[key] = (c.codex.counters[key] ?? 0) + by);
}

type Test = (c: Ctx) => boolean;
const ROWS: Array<[id: string, test: Test]> = [
  // ── 必现(跟章节/日期) ──
  ['eve', (c) => c.snap.sourceTier >= 1 && tapIs(c, 'treetop-fruit')],
  ['newton', (c) => c.ev.t === 'event' && c.ev.kind === 'newton' && c.ev.claimed],
  ['snow-white', (c) => c.snap.sourceTier >= 2 && tapIs(c, 'poison-stall')],
  ['paris', (c) => c.snap.sourceTier >= 2 && tapIs(c, 'summit-gold')],
  ['big-apple', (c) => c.snap.sourceTier >= 3 && tapIs(c, 'skyline')],
  ['daily', (c) => c.newDay],
  ['xmas-eve', (c) => c.ev.t === 'login' && c.snap.wall.m === 12 && c.snap.wall.d === 24],
  ['xmas-sock', (c) => tapIs(c, 'stocking') && c.snap.wall.m === 12 && c.snap.wall.d >= CODEX.xmasFromDay],

  // ── 可发现 ──
  ['tell', (c) => c.snap.helperLevel >= 1 && tapIs(c, 'xu-head-apple')],
  ['snake', (c) => c.ev.t === 'shake' && c.rnd() < CODEX.snakeP],
  ['adam', (c) => c.snap.helperLevel >= 1 && tapIs(c, 'xu-throat')],
  ['apple-of-eye', (c) => c.snap.helperLevel >= 1 && tapRun(c, 5, CODEX.tapGapS, 'xu')],
  ['pie', (c) => (c.ev.t === 'rot' && bump(c, 'rotCleaned', c.ev.cleaned) >= CODEX.pieRot) || (c.ev.t === 'overflow' && bump(c, 'overflow') >= CODEX.pieRot)],
  ['johnny', (c) => c.ev.t === 'idle' && c.ev.sec >= CODEX.idleEggS],
  ['garage', (c) => routeEra(c.snap) >= 2 && tapIs(c, 'garage')],
  ['turtleneck', (c) => c.snap.sourceTier >= 3 && tapIs(c, 'window-silhouette')],
  ['einstein', (c) => routeEra(c.snap) >= 5 && tapIs(c, 'moon')],
  ['pole-snap', (c) => c.snap.routeTier >= 1 && tapIs(c, 'porter') && bump(c, 'poleTaps') >= 10],
  ['core', (c) => tapIs(c, 'seed-core') && bump(c, 'coreTaps') >= 7],
  ['vinegar', (c) => eraMax(c.snap) >= 1 && tapIs(c, 'vinegar')],
  ['jam', (c) => tapIs(c, 'jam')],
  ['green', (c) => tapIs(c, 'green-apple')],
  ['orange', (c) => eraMax(c.snap) >= 3 && tapIs(c, 'orange')],
  ['daily-news', (c) => tapRun(c, 3, CODEX.tapGapLongS, 'news')],
  ['caterpillar', (c) => !!c.codex.kinds.worm && tapIs(c, 'leaf-under')],
  ['clock', (c) => c.snap.night && tapIs(c, 'clock')],
  ['kimura', (c) => c.ev.t === 'time' && eraMax(c.snap) >= 1 && c.snap.playSec - c.codex.wasteMark.at >= CODEX.noWasteS],
  ['newton-5', (c) => c.ev.t === 'event' && c.ev.kind === 'newton' && c.ev.claimed && bump(c, 'newtonClaims') >= 5],
  ['shake-500', (c) => c.ev.t === 'shake' && c.snap.shakes >= 500],
  ['streak-7', (c) => c.newDay && (c.codex.counters.streak ?? 0) >= 7],
  ['session-60', (c) => c.ev.t === 'time' && c.snap.sessionSec >= 3600],
  ['duoduo-refuse', (c) => c.ev.t === 'refuse' && bump(c, 'refuse') >= 10],
  ['atalanta', (c) => c.ev.t === 'gold' && c.ev.kind === 'tap' && (c.ev.since ?? 99) <= 3 && tapRun2(c)],
  ['idunn', (c) => c.snap.night && eraMax(c.snap) >= 4 && tapIs(c, 'gold-basket')],
  // ── v6:卡车 / 鸟 / 收货站 / 云树 / 星树 ──
  ['truck-horn', (c) => c.snap.routeTier >= 3 && tapRun(c, 5, 1.25, 'truck')],
  ['bird-feather', (c) => c.ev.t === 'event' && c.ev.kind === 'bird' && c.ev.claimed && bump(c, 'birdHits') >= 10],
  ['bird-ignore', (c) => c.ev.t === 'event' && c.ev.kind === 'bird' && !c.ev.claimed && bump(c, 'birdPecks') >= 5],
  ['elf-wave', (c) => tapRun(c, 5, 3, 'elf')],
  ['sleigh-bell', (c) => tapIs(c, 'sleigh-bell')],
  ['gift-peek', (c) => c.ev.t === 'gift-rim' ? ((c.codex.counters.giftRim = 1), false) : tapIs(c, 'gift-top') && !!c.codex.counters.giftRim],
  ['cloud-basket', (c) => c.snap.sourceTier >= 3 && tapIs(c, 'cloud-basket')],
  ['star-lantern', (c) => c.snap.sourceTier >= 4 && lanternSeq(c)],
  ['phone-pun', (c) => tapRun(c, 5, CODEX.tapGapLongS, 'version')],

  // ── 极稀有 ──
  ['triple-event', (c) => c.ev.t === 'time' && c.snap.eventsOnScreen >= 3],
  ['money-tree', (c) => c.ev.t === 'shake' && c.ev.combo >= CODEX.moneyTreeCombo],
  ['three-am', (c) => c.ev.t === 'time' && c.snap.wall.hour === CODEX.nightHour],
  ['laoxu-spray', (c) => c.snap.helperLevel >= LAOXU.slackFromLv && c.snap.laoxuMode === 'slack' && tapIs(c, 'xu') && c.rnd() < LAOXU.sprayP],
  ['laoxu-qc', (c) => c.snap.helperLevel >= LAOXU.slackFromLv && tapRun(c, LAOXU.qcTaps, LAOXU.qcWindowS / (LAOXU.qcTaps - 1), 'xu-qc', 'xu')],
  ['laoxu-bubble', (c) => c.snap.helperLevel >= LAOXU.slackFromLv && c.snap.laoxuMode === 'slack' && c.ev.t === 'hold' && c.ev.target === 'xu' && c.ev.sec >= LAOXU.bubbleHoldS],
  ['bird-hat', (c) => c.ev.t === 'event' && c.ev.kind === 'bird' && c.ev.claimed && c.snap.wall.m === 12 && c.snap.wall.d === 24],
  ['reindeer-nose', (c) => tapRun(c, 3, CODEX.tapGapS, 'reindeer-nose')],
  ['laoxu-sleep', (c) => c.ev.t === 'away' && c.ev.ms >= CODEX.sleeperAwayMs],
  ['title-7', (c) => tapRun(c, 7, CODEX.tapGapLongS, 'title')],
  ['core-82', (c) => c.ev.t === 'win' || (c.ev.t === 'time' && c.snap.progress >= 1)],
  ['shake-5000', (c) => c.ev.t === 'shake' && c.snap.shakes >= 5000],
];

/** 七盏星灯依次点(1→7),相邻间隔 ≤ 4 秒;点错序号从头(点到 1 号算第一盏) */
function lanternSeq(c: Ctx): boolean {
  if (c.ev.t !== 'tap') return false;
  const m = /^star-lantern-(\d)$/.exec(c.ev.target);
  if (!m) return false;
  const k = +m[1];
  const run = (c.codex.tapRun['lantern'] ??= { n: 0, last: -1e9 });
  const inTime = c.ev.at - run.last <= 4;
  run.n = k === run.n + 1 && (inTime || run.n === 0) ? k : k === 1 ? 1 : 0;
  run.last = c.ev.at;
  if (run.n >= 7) {
    run.n = 0;
    return true;
  }
  return false;
}

/** 金苹果追上:飘走前 3 秒内连点中 2 次 */
function tapRun2(c: Ctx): boolean {
  if (c.ev.t !== 'gold') return false;
  const run = (c.codex.tapRun['gold'] ??= { n: 0, last: -1e9 });
  run.n = c.ev.at - run.last <= CODEX.goldChaseS ? run.n + 1 : 1;
  run.last = c.ev.at;
  if (run.n >= 2) {
    run.n = 0;
    return true;
  }
  return false;
}

/** 可重复触发的彩蛋(每日首登):图鉴只记第一次,但每次都发奖励 */
const REPEATABLE = new Set(['daily']);
/** 触发即点亮的图鉴品种 */
export const EGG_KIND_UNLOCK: Record<string, AppleKind> = {
  eve: 'forbidden', 'snow-white': 'poison', green: 'granny', paris: 'golden',
};

export const EGG_IDS: string[] = ROWS.map(([id]) => id);
export const EGG_COUNT = EGG_IDS.length;

export interface EggHit {
  id: string;
  /** 第一次发现(图鉴点亮);repeatable 的后续触发为 false 但仍发奖 */
  first: boolean;
}

/** 距上次登录日的天数(YYYY-MM-DD);格式错误返回 NaN */
export function dayDiff(a: string, b: string): number {
  const f = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((f(b) - f(a)) / 86400000);
}

/**
 * 彩蛋判定:每个总线事件调一次,返回本次触发的彩蛋(可能多个)。
 * 副作用:更新 codex 的计数器/连点状态/已发现表/登录日/连续登录,不改其他状态。
 * rnd 只用于"摇树 1/300 掉蛇"。
 */
export function checkEggs(snap: Snapshot, ev: EggEvent, codex: CodexState, rnd: Rnd = Math.random): EggHit[] {
  // 木村奇迹:任何浪费(溢出或腐烂)重置"零浪费"计时
  const wasteNow = snap.wasted + snap.rotTotal;
  if (wasteNow > codex.wasteMark.wasted) codex.wasteMark = { wasted: wasteNow, at: snap.playSec };
  const newDay = ev.t === 'login' && snap.wall.day !== codex.lastLoginDay;
  if (newDay) {
    codex.counters.streak = codex.lastLoginDay && dayDiff(codex.lastLoginDay, snap.wall.day) === 1 ? (codex.counters.streak ?? 0) + 1 : 1;
  }
  const hits: EggHit[] = [];
  const c: Ctx = { snap, ev, codex, rnd, newDay };
  for (const [id, test] of ROWS) {
    const seen = codex.eggs[id];
    if (seen && !REPEATABLE.has(id)) continue;
    if (!test(c)) continue;
    const rec = (codex.eggs[id] ??= { at: snap.playSec, n: 0 });
    rec.n++;
    hits.push({ id, first: rec.n === 1 });
    const k = EGG_KIND_UNLOCK[id];
    if (k && !codex.kinds[k]) codex.kinds[k] = { at: snap.playSec, n: 1 };
  }
  if (newDay) codex.lastLoginDay = snap.wall.day;
  return hits;
}
