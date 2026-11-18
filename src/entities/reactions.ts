import type { Npc } from './Npc';
import type { Stimulus } from '../core/stimulus';
import type { ReactionX } from './types';
import { bus } from '../core/bus';

/**
 * 反应注册表：reactions[].do 的实现。新增反应只需 registerReaction('名字', fn)。
 * 内置：hide listen startle dance flee approach lookUp freeze pose goto none
 */
export type ReactFn = (n: Npc, r: ReactionX, s: Stimulus, I: number) => void;
const R = new Map<string, ReactFn>();
export const registerReaction = (id: string, fn: ReactFn) => { R.set(id, fn); };
export const reactionIds = () => [...R.keys()];
export function runReaction(n: Npc, r: ReactionX, s: Stimulus, I: number) { (R.get(r.do) ?? R.get('none')!)(n, r, s, I); }

registerReaction('none', () => {});
registerReaction('hide', (n, r) => n.hide(r.secs ?? 8));
registerReaction('listen', (n) => n.setState('listen', 2.2));
registerReaction('startle', (n) => n.setState('startle', 1.1));
registerReaction('dance', (n, r) => n.setState('dance', r.secs ?? 4));
/** 逃离现象源：secs 逃多久，dist 逃多远，speed 速度倍率，to 逃向（'home' 或 [x,y]） */
registerReaction('flee', (n, r, s) => n.startFlee({ x: s.x, y: s.y }, r.secs ?? 5, r.speed ?? 1.8, r.dist ?? 6, r.to));
/** 被吸引走过去（气味/诱饵）：停在 stop 距离外，到达时 bus.emit(arrive) */
registerReaction('approach', (n, r, s) => n.startChase(s, { type: s.type, tag: s.tag, arrive: r.arrive }, r.secs ?? 14));
/** 抬头看（灯/气球/天上）：at 缺省看向现象位置 */
registerReaction('lookUp', (n, r, s) => {
  n.lookAt = r.at ? { x: r.at[0], y: r.at[1] } : { x: s.x, y: s.y };
  n.setState('lookup', r.secs ?? 3);
});
registerReaction('freeze', (n, r) => n.setState('freeze', r.secs ?? 2.5));
registerReaction('pose', (n, r) => { n.setState('pose', r.secs ?? 4); n.pose = r.pose ?? ''; });
registerReaction('goto', (n, r) => {
  if (!r.to || r.to === 'home') return;
  n.setOrder({ kind: 'goto', x: r.to[0], y: r.to[1], speed: r.speed ?? 1, onArrive: () => { if (r.arrive) bus.emit(r.arrive, n.id); n.clearOrder(); } });
});
