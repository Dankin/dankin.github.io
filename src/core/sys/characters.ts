// 彩蛋角色(牛顿等)与鸟的点击收益。纯函数:调用方(eng-app)把结果加到 State 上,并发 EggEvent。
// 动作/飘字/音效是视觉层:这里只给 id、动作时长与收益。文案(飘字)由 writer 在 content 里按 id 提供。
import { BIRD, CHARACTER_REWARD } from './constants.ts';
import type { Rnd } from './util.ts';

export const CHARACTER_IDS = ['newton', 'snow-white', 'snake', 'seed-sower', 'turtleneck', 'einstein', 'archer', 'farmer', 'runner', 'merchant', 'elf', 'reindeer'] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];

export interface CharacterDef {
  id: CharacterId;
  /** 对应的彩蛋 id(图鉴记录;null = 没有专属彩蛋,只记角色) */
  eggId: string | null;
  /** 专属动作时长(秒,1–2) */
  actionS: number;
  /** 收益倍率:× CHARACTER_REWARD.baseSec 秒的送达量 */
  mul: number;
  /** 收益类型:apples = 直接送达;buff = 牛顿(10 秒摇树翻倍,用 events.NEWTON_S) */
  kind: 'apples' | 'buff';
  /** 音效/粒子 id */
  sfx: string;
  particle: 'sparkle' | 'leaf' | 'star' | 'snow' | 'gold';
}

const C = (id: CharacterId, eggId: string | null, actionS: number, mul: number, sfx: string, particle: CharacterDef['particle'], kind: CharacterDef['kind'] = 'apples'): CharacterDef =>
  ({ id, eggId, actionS, mul, kind, sfx, particle });

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  newton: C('newton', 'newton-5', 1.6, 0, 'char-newton', 'star', 'buff'),
  'snow-white': C('snow-white', 'eve', 1.5, 1, 'char-snow', 'sparkle'),
  snake: C('snake', 'adam', 1.2, 0.8, 'char-snake', 'leaf'),
  'seed-sower': C('seed-sower', 'johnny', 1.8, 1.2, 'char-sower', 'leaf'),
  turtleneck: C('turtleneck', 'garage', 1.5, 1.4, 'char-click', 'sparkle'),
  einstein: C('einstein', 'einstein', 1.6, 1, 'char-think', 'star'),
  archer: C('archer', 'tell', 1.4, 1, 'char-arrow', 'leaf'),
  farmer: C('farmer', 'kimura', 1.8, 1.2, 'char-farm', 'leaf'),
  runner: C('runner', 'atalanta', 1.2, 0.8, 'char-run', 'gold'),
  merchant: C('merchant', 'duoduo-refuse', 1.5, 0.6, 'char-coin', 'gold'),
  elf: C('elf', 'elf-wave', 1, 0.8, 'char-elf', 'snow'),
  reindeer: C('reindeer', 'reindeer-nose', 1.2, 0.8, 'char-reindeer', 'snow'),
};

export interface Reward {
  apples: number;
  coins: number;
}
const reward = (flow: number, value: number, sec: number): Reward => {
  const apples = Math.max(1, Math.floor(Math.max(0, flow) * sec));
  return { apples, coins: apples * Math.max(0, value) };
};

export interface CharacterClick extends Reward {
  id: CharacterId;
  eggId: string | null;
  actionS: number;
  sfx: string;
  particle: CharacterDef['particle'];
  /** true = 牛顿 buff(调用方设 newtonUntil) */
  buff: boolean;
}

/** 点击彩蛋角色:flow = 当前送达速率(个/秒),value = 每苹果价值。 */
export function characterClick(id: CharacterId, flow: number, value: number): CharacterClick {
  const d = CHARACTERS[id];
  const r = d.kind === 'buff' ? { apples: 0, coins: 0 } : reward(flow, value, CHARACTER_REWARD.baseSec * d.mul);
  return { ...r, id, eggId: d.eggId, actionS: d.actionS, sfx: d.sfx, particle: d.particle, buff: d.kind === 'buff' };
}

/** 点中鸟:小额苹果 + 几根羽毛。 */
export function birdHit(flow: number, value: number, rnd: Rnd): Reward & { feathers: number } {
  const [a, b] = BIRD.feathers;
  return { ...reward(flow, value, BIRD.hitSec), feathers: a + Math.floor(rnd() * (b - a + 1)) };
}

/** 鸟没被点:啄走的库存量(苹果个数)。不超过库存的 peckMaxShare 和 peckMaxApples,库存很少时可能为 0,不会致命。 */
export function birdPeck(stock: number, flow: number): number {
  const byFlow = Math.max(0, flow) * BIRD.peckSec;
  const cap = Math.min(Math.max(0, stock) * BIRD.peckMaxShare, BIRD.peckMaxApples);
  return Math.floor(Math.min(byFlow, cap));
}
