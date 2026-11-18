import { allFlags, entityIds } from './registry';
import { getNav } from './nav';

/**
 * 玩法层调试快照（给 qa testApi / 控制台用）。传入 GameScene（鸭子类型，缺的字段忽略）。
 * 用法：window.__dbg = () => gameplaySnapshot(scene)
 */
export function gameplaySnapshot(scene: any) {
  const now: number = scene.now ?? 0;
  const npcs = scene.npcs ? Object.values<any>(scene.npcs).map((n) => (n.debug ? n.debug() : { id: n.id, x: n.x, y: n.y, state: n.state })) : [];
  const nav = getNav();
  return {
    t: +now.toFixed(1),
    phase: scene.phaseId ?? null,
    stories: scene.stories?.debug?.() ?? [],
    npcs,
    stimuli: scene.stim?.debug?.(now) ?? [],
    mechs: scene.mechs?.debug?.() ?? [],
    seq: scene.seq ? { running: scene.seq.running, current: scene.seq.current, queued: [...(scene.seq.queued ?? [])], bg: scene.seq.bgRunning ?? 0 } : null,
    flags: allFlags(),
    entities: entityIds(),
    nav: { searches: nav.searches, version: nav.version },
    fx: scene.fx?.debug?.() ?? null,
  };
}
