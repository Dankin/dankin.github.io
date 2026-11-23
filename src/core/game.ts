import { GOAL, OFFLINE_CAP_MS, OFFLINE_EFFICIENCY, SHORT_AWAY_MS } from './constants.ts';
import type { ProjectId, State, UpgradeId } from './state.ts';
import { envMult } from './world.ts';

export type { ProjectId, UpgradeId };

export const GOLD_MULT = 25;
export const GOLD_BASE_RATE = 0.02;
export const GOLD_MAX_RATE = 0.2;


export const COOK_MS = 30_000;
export const COOK_CD_MS = 300_000;
export const COOK_MULT = 3;
export const FAIREST_MS = 30_000;
export const FAIREST_MULT = 2;
export const GRAVITY_EVERY_S = 15;
export const WITCH_SKIP_S = 20 * 60;

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  hint: string;
  baseCost: number;
  growth: number;
  /** 累计平安果达到此值才出现 */
  unlockAt: number;
  /** 自动产出每级每秒(仅自动类) */
  perSec?: number;
}

/** 按解锁顺序排列 */
export const UPGRADES: UpgradeDef[] = [
  { id: 'shake', name: '晃晃更健康', hint: '每级:每摇一下多掉 1 个苹果,再多得一点自动产出', baseCost: 10, growth: 1.23, unlockAt: 0 },
  { id: 'breeze', name: '微风(邻居叹气)', hint: '每级:+1 个/秒,并让所有自动产出 +0.3%', baseCost: 15, growth: 1.23, unlockAt: 0, perSec: 1 },
  { id: 'gardener', name: '老徐上班了', hint: '每级:+12 个/秒', baseCost: 981, growth: 1.22, unlockAt: 150, perSec: 12.2 },
  { id: 'branches', name: '枝繁叶茂(没人修剪)', hint: '每级:全部产出 +5%', baseCost: 500, growth: 1.23, unlockAt: 400 },
  { id: 'breed', name: '给锦鲤也改良一下', hint: '每级:金苹果掉率 +1%(上限 20%)', baseCost: 2e3, growth: 1.23, unlockAt: 1500 },
  { id: 'tractor', name: '老徐的拖拉机', hint: '每级:+48 个/秒', baseCost: 222000, growth: 1.24, unlockAt: 1.5e4, perSec: 48.1 },
  { id: 'shaker', name: '摇树机(不累,但吵)', hint: '每级:+82 个/秒', baseCost: 3.11e6, growth: 1.24, unlockAt: 6e4, perSec: 81.6 },
  { id: 'drone', name: '无人机采摘', hint: '每级:+238 个/秒', baseCost: 2.02e8, growth: 1.22, unlockAt: 2.5e6, perSec: 238 },
  { id: 'express', name: '平安快递(不保证平安)', hint: '每级:+333 个/秒', baseCost: 3.15e8, growth: 1.23, unlockAt: 6e7, perSec: 333 },
  { id: 'cloud', name: '苹果云', hint: '每级:+478 个/秒', baseCost: 8.33e8, growth: 1.21, unlockAt: 2e8, perSec: 478 },
];

export const upgradeDef = (id: UpgradeId): UpgradeDef => UPGRADES.find((u) => u.id === id)!;

export interface ProjectDef {
  id: ProjectId;
  name: string;
  desc: string;
  flavor: string;
  cost: number;
  unlockAt: number;
}

export const PROJECTS: ProjectDef[] = [
  { id: 'gravity', name: '万有引力', desc: '每 15 秒,一个苹果自己砸下来,约等于 3 秒的产出', flavor: '据说有人被砸中以后,想通了一件事。', cost: 1500, unlockAt: 500 },
  { id: 'fairest', name: '最美的苹果', desc: '树上偶尔长出一个金光闪闪的苹果,点中它:30 秒产出 ×2', flavor: '"献给最美者。"', cost: 8000, unlockAt: 5000 },
  { id: 'cook', name: '苹果发布会', desc: '开发布会:30 秒产出 ×3,冷却 5 分钟', flavor: '"Good morning."', cost: 5e4, unlockAt: 2e4 },
  { id: 'duo', name: 'iPhone Duo', desc: '每次摇多掉 1 个苹果,全部产出 +25%', flavor: '一次掉两个,这才叫 Duo。', cost: 3e7, unlockAt: 1e7 },
  { id: 'garage', name: '车库里的怪人', desc: '自动产出 ×1.5', flavor: '"Stay hungry. Stay foolish."', cost: 3e8, unlockAt: 2e8 },
  { id: 'doctor', name: '每天一苹果', desc: '全部产出 +20%', flavor: '医生:"我先走了。"', cost: 6e8, unlockAt: 5e8 },
  { id: 'witch', name: '女巫的苹果', desc: '咬一口,睡一觉:立刻得到 20 分钟的自动产出(整局一次)。睡着时离线也不打折', flavor: '红的一半有毒。你选哪一半?', cost: 1.5e9, unlockAt: 1e9 },
  { id: 'onemore', name: '还有一件事', desc: '苹果发布会的加成从 ×3 升到 ×5', flavor: '"One more thing."', cost: 1.2e9, unlockAt: 1.5e9 },
];

/** 禁果:一共三口,每口全部产出 ×2。按顺序咬。 */
export interface BiteDef { name: string; desc: string; flavor: string; cost: number; unlockAt: number }
export const BITES: BiteDef[] = [
  { name: '禁果·第一口', desc: '全部产出 ×2', flavor: '"别吃那个。"——可是它真的很红。', cost: 6e7, unlockAt: 3e7 },
  { name: '禁果·第二口', desc: '全部产出再 ×2', flavor: '蛇没说话。它只是笑了一下。', cost: 6e8, unlockAt: 3e8 },
  { name: '禁果·第三口', desc: '全部产出再 ×2', flavor: '从此,世界上有了苹果的故事。', cost: 2e9, unlockAt: 3e9 },
];

export const projectDef = (id: ProjectId): ProjectDef => PROJECTS.find((p) => p.id === id)!;

export function cost(def: UpgradeDef, level: number): number {
  return Math.floor(def.baseCost * Math.pow(def.growth, level));
}

/** 每满 25 级,该项产出 ×2 */
export function milestoneMult(level: number): number {
  return Math.pow(2, Math.floor(level / 25));
}

export function goldRate(s: State): number {
  return Math.min(GOLD_MAX_RATE, GOLD_BASE_RATE + 0.01 * s.upgrades.breed);
}

/** 金苹果带来的期望倍率 */
export function goldEV(s: State): number {
  return 1 + goldRate(s) * (GOLD_MULT - 1);
}

/** 每个升级每满 25 级(「里程碑」),全部产出 ×MILESTONE_GLOBAL;让前期升级到后期仍然值得补 */
export const MILESTONE_GLOBAL = 1.05;
export function milestoneCount(s: State): number {
  let n = 0;
  for (const u of UPGRADES) n += Math.floor(s.upgrades[u.id] / 25);
  return n;
}

/** 枝繁叶茂 + iPhone Duo:全局乘数 */
export function globalMult(s: State): number {
  return Math.pow(MILESTONE_GLOBAL, milestoneCount(s)) * (1 + 0.05 * s.upgrades.branches) * (s.projects.duo ? 1.25 : 1) * (s.projects.doctor ? 1.2 : 1) * Math.pow(2, s.bites);
}

export const cookMult = (s: State): number => (s.projects.onemore ? 5 : COOK_MULT);

/** 计时加成(库克发布会、最美的苹果)。now 省略表示不计入。 */
export function buffMult(s: State, now = Infinity): number {
  return (s.buffs.cookUntil > now ? cookMult(s) : 1) * (s.buffs.goldUntil > now ? FAIREST_MULT : 1);
}

/** 每摇一下掉下的苹果个数(未含倍率) */
export function clickPieces(s: State): number {
  return 1 + s.upgrades.shake * milestoneMult(s.upgrades.shake) + (s.projects.duo ? 1 : 0);
}

/** 可调系数(scripts/tune.ts 会改它们):微风每级给自动产出的加成;摇树每级让每次点击额外获得"当前自动产出"的比例 */
export const tuning = { breeze: 0.0032, clickAuto: 0.0021 };

/** 摇树的额外收益:每次点击再得到 摇树等级 × clickAuto × 每秒自动产出(让后期点击仍有分量) */
export function clickBonus(s: State, now = Infinity): number {
  return s.upgrades.shake * tuning.clickAuto * rate(s, now);
}

/** 每摇一下的期望收益 */
export function clickEV(s: State, now = Infinity): number {
  return clickPieces(s) * globalMult(s) * goldEV(s) * buffMult(s, now) + clickBonus(s, now);
}

/** 微风:每级让所有自动产出 +1% */
export const breezeBoost = (s: State): number => 1 + tuning.breeze * s.upgrades.breeze;

/** 自动产出每秒(不含金苹果期望与计时加成) */
export function autoBase(s: State): number {
  let sum = 0;
  for (const u of UPGRADES) {
    if (u.perSec) sum += s.upgrades[u.id] * u.perSec * milestoneMult(s.upgrades[u.id]);
  }
  return sum * globalMult(s) * (s.projects.garage ? 1.5 : 1) * breezeBoost(s);
}

/** 每秒自动产出(含金苹果期望、收获周期与下雨;now 为真实/调试时钟毫秒) */
export function rate(s: State, now = Infinity): number {
  return autoBase(s) * goldEV(s) * buffMult(s, now) * envMult((now - s.startedAt) / 1000);
}

/** 产出来源。各来源「每秒苹果」之和 = 当前总收入,用于来源占比条和画面上的流水线 */
export const SOURCE_IDS = ['click', 'breeze', 'gardener', 'tractor', 'shaker', 'drone', 'express', 'cloud'] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

/** cps = 玩家平均每秒点击数。微风的「自动产出 +x%」部分算在微风头上。 */
export function sourcePerSec(s: State, cps: number, now = Infinity): Record<SourceId, number> {
  const out = Object.fromEntries(SOURCE_IDS.map((id) => [id, 0])) as Record<SourceId, number>;
  const boost = breezeBoost(s);
  const k = globalMult(s) * (s.projects.garage ? 1.5 : 1) * goldEV(s) * buffMult(s, now) * envMult((now - s.startedAt) / 1000);
  let auto = 0;
  for (const u of UPGRADES) {
    if (!u.perSec) continue;
    const v = (s.upgrades[u.id] * u.perSec * milestoneMult(s.upgrades[u.id]) * k * boost) / boost;
    out[u.id as SourceId] = v;
    auto += v;
  }
  const extra = auto * boost - auto; // 微风 +x% 的部分
  out.breeze += extra;
  out.click = cps * clickEV(s, now);
  return out;
}

export function addApples(s: State, n: number): void {
  s.apples += n;
  s.delivered += n;
}

export interface ClickResult {
  value: number;
  pieces: number;
  golds: number;
}

/** 摇一下:每个苹果独立掷骰,有概率是金苹果(价值 ×25) */
export function click(s: State, opt: { now?: number; rng?: () => number } = {}): ClickResult {
  const rng = opt.rng ?? Math.random;
  const pieces = clickPieces(s);
  const gr = goldRate(s);
  let golds = 0;
  if (pieces <= 60) {
    for (let i = 0; i < pieces; i++) if (rng() < gr) golds++;
  } else {
    golds = Math.round(pieces * gr);
  }
  const bonus = clickBonus(s, opt.now);
  const value = globalMult(s) * buffMult(s, opt.now) * (pieces + (GOLD_MULT - 1) * golds) + bonus;
  s.clicks += 1;
  addApples(s, value);
  return { value, pieces, golds };
}

export function canBuy(s: State, id: UpgradeId): boolean {
  return s.apples >= cost(upgradeDef(id), s.upgrades[id]);
}

export function isUnlocked(s: State, id: UpgradeId): boolean {
  return s.delivered >= upgradeDef(id).unlockAt;
}

export function buy(s: State, id: UpgradeId): boolean {
  const def = upgradeDef(id);
  const c = cost(def, s.upgrades[id]);
  if (s.apples < c) return false;
  s.apples -= c;
  s.upgrades[id] += 1;
  return true;
}

export function projectUnlocked(s: State, id: ProjectId): boolean {
  return s.delivered >= projectDef(id).unlockAt;
}

export function canBuyProject(s: State, id: ProjectId): boolean {
  return !s.projects[id] && s.apples >= projectDef(id).cost;
}

export function buyProject(s: State, id: ProjectId): boolean {
  if (!canBuyProject(s, id)) return false;
  s.apples -= projectDef(id).cost;
  s.projects[id] = true;
  return true;
}

export function cookReady(s: State, now: number): boolean {
  return s.projects.cook && s.buffs.cookReadyAt <= now;
}

export function useCook(s: State, now: number): boolean {
  if (!cookReady(s, now)) return false;
  s.buffs.cookUntil = now + COOK_MS;
  s.buffs.cookReadyAt = now + COOK_CD_MS;
  return true;
}

export function grabFairest(s: State, now: number): void {
  s.buffs.goldUntil = Math.max(s.buffs.goldUntil, now) + FAIREST_MS;
}

/** 万有引力一次砸下的苹果:约 3 秒产出,开局没有自动产出时按 3 次摇算 */
export function gravityGain(s: State, now: number): number {
  return Math.max(rate(s, now), clickEV(s, now)) * 3;
}

export const biteUnlocked = (s: State): boolean => s.bites < BITES.length && s.delivered >= BITES[s.bites].unlockAt;
export const canBite = (s: State): boolean => biteUnlocked(s) && s.apples >= BITES[s.bites].cost;
export function bite(s: State): boolean {
  if (!canBite(s)) return false;
  s.apples -= BITES[s.bites].cost;
  s.bites += 1;
  return true;
}

export const witchReady = (s: State): boolean => s.projects.witch && !s.witchUsed;
/** 女巫苹果:睡一觉,直接得到 20 分钟的自动产出。睡着期间离线按 100% 结算。 */
export function useWitch(s: State): number {
  if (!witchReady(s)) return 0;
  s.witchUsed = true;
  s.sleeping = true;
  const gain = rate(s) * WITCH_SKIP_S;
  addApples(s, gain);
  return gain;
}

/** 推进 dt 秒的自动产出 */
export function tick(s: State, dtSec: number, now = Infinity): number {
  const gain = rate(s, now) * dtSec;
  if (gain > 0) addApples(s, gain);
  return gain;
}

export function progress(s: State): number {
  return Math.min(1, s.delivered / GOAL);
}

export function isWon(s: State): boolean {
  return s.delivered >= GOAL;
}

// ---- 期(阶段):树越来越多,从一棵树扩张到苹果谷 ----

export interface StageDef {
  name: string;
  at: number;
  trees: number;
}

export const STAGES: StageDef[] = [
  { name: '一棵树', at: 0, trees: 1 },
  { name: '小院', at: 2e3, trees: 3 },
  { name: '果园', at: 1e5, trees: 7 },
  { name: '山坡果园', at: 1e7, trees: 13 },
  { name: '苹果谷', at: 1e8, trees: 21 },
  { name: '苹果之乡', at: 1e9, trees: 31 },
];

export function stageIndex(delivered: number): number {
  let i = 0;
  for (let k = 0; k < STAGES.length; k++) if (delivered >= STAGES[k].at) i = k;
  return i;
}

/** 本期进度 0..1,按对数刻度(数值指数增长,线性条会一直看起来没动) */
export function stageProgress(delivered: number): number {
  const i = stageIndex(delivered);
  const cur = STAGES[i].at;
  const next = i + 1 < STAGES.length ? STAGES[i + 1].at : GOAL;
  const a = Math.log(cur + 1);
  const b = Math.log(next + 1);
  return Math.min(1, Math.max(0, (Math.log(delivered + 1) - a) / (b - a)));
}

/** 下一期的门槛;最后一期之后是终点 */
export function nextStageAt(delivered: number): number {
  const i = stageIndex(delivered);
  return i + 1 < STAGES.length ? STAGES[i + 1].at : GOAL;
}

export interface SettleResult {
  gain: number;
  awayMs: number;
  capped: boolean;
}

/**
 * 离线补算:按 lastSeen 一次闭式结算,不循环。离线时不计入计时加成。
 * 时钟回拨(dt<0)时不给收益,只重置 lastSeen。
 */
export function settle(s: State, now: number): SettleResult {
  const dt = now - s.lastSeen;
  s.lastSeen = now;
  if (dt <= 0) return { gain: 0, awayMs: 0, capped: false };
  const eff = dt < SHORT_AWAY_MS || s.sleeping ? 1 : OFFLINE_EFFICIENCY;
  const t = Math.min(dt, OFFLINE_CAP_MS);
  const gain = rate(s) * (t / 1000) * eff;
  if (gain > 0) addApples(s, gain);
  s.sleeping = false;
  return { gain, awayMs: dt, capped: dt > OFFLINE_CAP_MS };
}
