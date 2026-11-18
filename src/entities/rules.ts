/** 世界级小规则（数据驱动，每帧由 StoryManager.update 调用）：E16 不可附身弹开 / E27 通关后夜晚散步台词 */
import { CFG, t } from '../core/data';
import { dist, pick, clamp } from '../core/iso';
import { hasFlag } from './registry';
import type { Npc } from './Npc';

export interface RulesHost {
  now: number; locked: boolean;
  npcs?: Record<string, Npc>;
  hat?: { x: number; y: number; tx?: number; ty?: number; shake?: number; attachedTo?: string | null };
}

export class WorldRules {
  private bounceCd = 0; private nightT = 60;
  constructor(private host: RulesHost) {}

  update(dt: number) {
    const h = this.host, npcs = h.npcs; if (!npcs || h.locked) return;
    this.bounceCd -= dt;
    const hat = h.hat;
    if (hat && this.bounceCd <= 0 && !hat.attachedTo) {
      for (const n of Object.values(npcs)) {
        if (!n.ext.unpossessable) continue;
        const d = dist(hat.x, hat.y, n.x, n.y);
        if (d >= 1.2) continue;
        const dx = d > 0.01 ? (hat.x - n.x) / d : 1, dy = d > 0.01 ? (hat.y - n.y) / d : 0;
        hat.x += dx * 0.4; hat.y += dy * 0.4;
        if (hat.tx !== undefined) { hat.tx = hat.x; hat.ty = hat.y; }
        hat.shake = 0.4;
        n.say(t('say.adong_mine'), 2.6);
        this.bounceCd = 5;
        break;
      }
    }
    // E27：game_complete 后每 90s 随机一人路过说“平安夜快乐”
    const lines: string[] | undefined = (CFG as any).idleNight;
    if (lines?.length && hasFlag('game_complete')) {
      if ((this.nightT -= dt) <= 0) {
        this.nightT = 90;
        const list = Object.values(npcs).filter((n) => n.def.crowd && !n.ghost && n.state === 'idle');
        if (list.length) pick(list).say(t(pick(lines)), 4);
      }
    }
  }
}
