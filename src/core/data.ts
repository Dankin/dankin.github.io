import config from '../data/config.json';
import moves from '../data/moves.json';
import props from '../data/props.json';
import decor from '../data/decor.json';
import npcs from '../data/npcs.json';
import stories from '../data/stories.json';
import sequences from '../data/sequences.json';
import checklist from '../data/checklist.json';
import zh from '../data/zh.json';

export type StimType = 'sound' | 'light' | 'scent' | 'lure' | 'block' | 'company';

export interface MoveDef {
  icon: string; label: string; cooldown: number; sfx?: string; fx?: string; event?: string;
  emit: { type: StimType; tag: string; intensity: number; radius: number; duration?: number; mover?: { to: number[]; speed: number } };
}
export interface Reaction { on: { type: string; tag?: string; min?: number }; do: string; say?: string; secs?: number; emote?: string; [k: string]: any }
export interface NpcDef {
  name: string; home: number[]; speed: number; crowd: boolean; voice: number; kid?: boolean; story?: string; dancer?: boolean; patrol?: boolean;
  look: { hair: string; skin: string; top: string; pants: string; shoes: string; accent: string; style: string; acc?: string };
  waypoints: number[][]; away?: number[][]; idleSay?: string;
  follows?: { type: string; tag: string; say?: string; arrive?: string; chance?: number }[];
  reactions: Reaction[];
  annoy: { window: number; tiers: number[]; quips: string[]; leave: string };
  [k: string]: any;
}
export interface StepDef {
  id: string; kind: 'stimulus' | 'quiet'; requires: string[]; say: string;
  when?: { type: string; tag: string; min: number }; radius?: number; hold?: number; needQuiet?: number;
  fail?: { notRequired: string; notQuiet: string };
  hint: { prop: string; move: string; t: string[] };
  [k: string]: any;
}
export interface StoryDef { npc: string; need: number; finale: string; steps: StepDef[]; [k: string]: any }
export interface PropDef { name: string; pos: number[]; moves: string[]; tex: string; hit: number[]; [k: string]: any }

export const CFG = config as any;
export const MOVES = moves as unknown as Record<string, MoveDef>;
export const PROPS = props as unknown as Record<string, PropDef>;
export const DECOR = decor as { tex: string; pos: number[]; solid?: boolean; scale?: number; [k: string]: any }[];
export const NPCS = npcs as unknown as Record<string, NpcDef>;
export const STORIES = stories as unknown as Record<string, StoryDef>;
export const SEQS = sequences as unknown as Record<string, any[]>;
/** 机关物定义（可选文件 data/mechs.json，缺失则为空） */
const mechFiles = import.meta.glob('../data/mechs.json', { eager: true, import: 'default' }) as Record<string, unknown>;
export const MECHS = (Object.values(mechFiles)[0] ?? {}) as Record<string, any>;
export const CHECKLIST = checklist as { id: string; text: string; points: number; main?: boolean; secret?: boolean; hiddenText?: string }[];
/** 墙段：v=变体（art 的 wall_{side}_{v}），at=沿该边起点的瓦片偏移（缺省 0）。 */
export interface WallSeg { v: string; at?: number }
export interface RegionDef {
  id: string; name: string; bx: number; by: number;
  walls: { ne?: string | WallSeg[]; nw?: string | WallSeg[] };
  map: string[];
  /** 可选：区域氛围/音乐标签，由 product 在 config.json 里给，引擎只透传给 audio.setRegion */
  mood?: string;
}
/** 区块边长（瓦片）。世界 = 区块网格 × BLOCK。 */
export const BLOCK = 20;
/** 旧版 12×12 区块（占位数据）居中补边到 BLOCK 时使用的内容偏移。 */
const LEGACY_BLOCK = 12;
export const REGIONS = CFG.regions as RegionDef[];
export const WORLD_W = (Math.max(...REGIONS.map((r) => r.bx)) + 1) * BLOCK;
export const WORLD_H = (Math.max(...REGIONS.map((r) => r.by)) + 1) * BLOCK;

/**
 * 兼容层：config.world 仍是 36×24（旧 12×12 区块数据）时，
 * - 把每个 12×12 地图居中补边到 20×20（向外复制边缘瓦片）；
 * - 把 props/decor/npcs/sequences/moves/hatStart 的瓦片坐标平移到新区块网格里。
 * product 把 config.world 改成 {w:60,h:40}（并提供 20×20 地图/新坐标）后，兼容层自动关闭。
 */
export const LEGACY_COMPAT = !CFG.world || CFG.world.w < Math.max(...REGIONS.map((r) => r.bx + 1)) * BLOCK;
if (LEGACY_COMPAT) {
  const pad = (BLOCK - LEGACY_BLOCK) >> 1;
  for (const r of REGIONS) {
    if (r.map.length === BLOCK && r.map.every((row) => row.length === BLOCK)) continue;
    const src = r.map, n = src.length, m = src[0]?.length ?? 0;
    const at = (i: number, j: number) => src[Math.max(0, Math.min(n - 1, j - pad))][Math.max(0, Math.min(m - 1, i - pad))];
    r.map = Array.from({ length: BLOCK }, (_, j) => Array.from({ length: BLOCK }, (_, i) => at(i, j)).join(''));
  }
  const mv = (v: number) => v + Math.floor(v / LEGACY_BLOCK) * (BLOCK - LEGACY_BLOCK) + pad;
  const mvp = (a: any) => { if (Array.isArray(a) && a.length >= 2 && typeof a[0] === 'number') { a[0] = mv(a[0]); a[1] = mv(a[1]); } };
  Object.values(PROPS).forEach((p) => mvp(p.pos));
  DECOR.forEach((d) => mvp(d.pos));
  Object.values(NPCS).forEach((n) => { mvp(n.home); n.waypoints?.forEach(mvp); n.away?.forEach(mvp); });
  Object.values(SEQS).forEach((seq) => seq.forEach((a) => { if (a.do === 'walk') mvp(a.to); if (a.do === 'cam') mvp(a.focus); if (a.do === 'crowd') mvp(a.around); }));
  Object.values(MOVES).forEach((m) => { if (m.emit.mover) mvp(m.emit.mover.to); });
  mvp(CFG.hatStart);
  // 全部 12×12 的墙默认落在区块外沿（at=0），不需要平移
}

/** 展开后的墙段摆放表（瓦片坐标 = 该墙段起点；ne 沿 +tx 延伸，nw 沿 +ty 延伸） */
export interface WallPlace { region: string; side: 'ne' | 'nw'; v: string; tx: number; ty: number }
export const WALLS: WallPlace[] = (() => {
  const out: WallPlace[] = [];
  for (const r of REGIONS) {
    for (const side of ['ne', 'nw'] as const) {
      const w = r.walls?.[side];
      if (!w) continue;
      const segs: WallSeg[] = typeof w === 'string' ? [{ v: w, at: 0 }] : w;
      for (const sg of segs) {
        const at = sg.at ?? 0;
        out.push(side === 'ne'
          ? { region: r.id, side, v: sg.v, tx: r.bx * BLOCK + at, ty: r.by * BLOCK }
          : { region: r.id, side, v: sg.v, tx: r.bx * BLOCK, ty: r.by * BLOCK + at });
      }
    }
  }
  return out;
})();

/** 拼接后的整张瓦片图：MAP[ty][tx] */
export const MAP: string[] = (() => {
  const rows = Array.from({ length: WORLD_H }, () => Array<string>(WORLD_W).fill('g'));
  REGIONS.forEach((r) => r.map.forEach((row, j) => [...row].forEach((ch, i) => {
    const y = r.by * BLOCK + j, x = r.bx * BLOCK + i;
    if (rows[y] && x < WORLD_W) rows[y][x] = ch;
  })));
  return rows.map((r) => r.join(''));
})();
export function regionAt(x: number, y: number): RegionDef | undefined {
  const bx = Math.floor(x / BLOCK), by = Math.floor(y / BLOCK);
  return REGIONS.find((r) => r.bx === bx && r.by === by);
}
const STR = zh as Record<string, string | string[]>;

/** 取文本；数组则随机取一条。{0} {1} 为占位符 */
export function t(key: string, ...args: (string | number)[]): string {
  const v = STR[key];
  if (v === undefined) return `[${key}]`;
  let s = Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v;
  args.forEach((a, i) => (s = s.replace(`{${i}}`, String(a))));
  return s;
}
export function hasKey(key: string) { return key in STR; }

/** 启动时校验数据引用，返回问题列表（空表示通过） */
/** extraKinds：额外合法的序列动作 id（来自 core/sequencer 的 actionIds()，避免循环依赖，由调用方传入） */
export function validateData(extraKinds: string[] = []): string[] {
  const errs: string[] = [];
  const need = (k: string, where: string) => { if (!hasKey(k)) errs.push(`缺少文本 ${k} (${where})`); };
  for (const [id, m] of Object.entries(MOVES)) need(m.label, `move ${id}`);
  for (const [id, p] of Object.entries(PROPS)) {
    need(p.name, `prop ${id}`);
    (p.moves ?? []).forEach((m) => { if (!MOVES[m]) errs.push(`prop ${id} 引用了不存在的招式 ${m}`); });
  }
  for (const [id, n] of Object.entries(NPCS)) {
    need(n.name, `npc ${id}`);
    if (n.story && !STORIES[n.story]) errs.push(`npc ${id} 引用了不存在的故事 ${n.story}`);
    (n.reactions ?? []).forEach((r) => r.say && need(r.say, `npc ${id} reaction`));
    n.follows?.forEach((f) => f.say && need(f.say, `npc ${id} follows`));
    (n.annoy?.quips ?? []).forEach((q) => need(q, `npc ${id} annoy`));
    if (n.idleSay) need(n.idleSay, `npc ${id} idle`);
  }
  for (const [id, s0] of Object.entries(STORIES)) {
    const s = s0 as any;
    if (s.npc && !NPCS[s.npc]) errs.push(`story ${id} 的 npc ${s.npc} 不存在`);
    if (s.finale && !SEQS[s.finale]) errs.push(`story ${id} 的 finale ${s.finale} 不存在`);
    const steps: any[] = s.steps ?? [];
    const ids = new Set(steps.map((x) => x.id));
    steps.forEach((st) => {
      if (st.say) need(st.say, `story ${id}/${st.id}`);
      (st.requires ?? []).forEach((r: string) => { if (!ids.has(r)) errs.push(`step ${st.id} requires 未知 ${r}`); });
      if (st.hint) {
        if (st.hint.prop && !PROPS[st.hint.prop]) errs.push(`step ${st.id} hint.prop 未知 ${st.hint.prop}`);
        if (st.hint.move && !MOVES[st.hint.move]) errs.push(`step ${st.id} hint.move 未知 ${st.hint.move}`);
        (st.hint.t ?? []).forEach((k: string) => need(k, `step ${st.id} hint`));
      }
      if (st.fail) { if (st.fail.notRequired) need(st.fail.notRequired, st.id); if (st.fail.notQuiet) need(st.fail.notQuiet, st.id); }
    });
  }
  const seqKinds = new Set(['lock', 'say', 'wait', 'walk', 'cam', 'crowd', 'phase', 'sing', 'hat', 'warmth', 'event', 'banner', ...extraKinds]);
  for (const [id, seq] of Object.entries(SEQS)) (seq as any[]).forEach((a, i) => {
    const kind = a.do ?? Object.keys(a)[0];
    if (extraKinds.length && !seqKinds.has(kind) && a.do) errs.push(`sequence ${id}[${i}] 未知动作 ${a.do}`);
    if (a.npc && typeof a.npc === 'string' && !NPCS[a.npc]) errs.push(`sequence ${id}[${i}] 未知 npc ${a.npc}`);
    if (a.key) need(a.key, `sequence ${id}[${i}]`);
    if (a.do === 'phase' && a.id && !CFG.phases[a.id]) errs.push(`sequence ${id}[${i}] 未知 phase ${a.id}`);
  });
  REGIONS.forEach((r) => {
    need(r.name, `region ${r.id}`);
    if (r.map.length !== BLOCK || r.map.some((row) => row.length !== BLOCK)) errs.push(`region ${r.id} 地图必须是 ${BLOCK}×${BLOCK}`);
    for (const side of ['ne', 'nw'] as const) {
      const w = r.walls?.[side];
      if (Array.isArray(w)) w.forEach((sg) => { if (!sg || typeof sg.v !== 'string') errs.push(`region ${r.id} walls.${side} 需要 {v,at?}`); });
    }
  });
  const inW = (a: any, where: string) => { if (Array.isArray(a) && typeof a[0] === 'number' && (a[0] < 0 || a[1] < 0 || a[0] >= WORLD_W || a[1] >= WORLD_H)) errs.push(`${where} 坐标 ${a} 超出世界 ${WORLD_W}×${WORLD_H}`); };
  Object.entries(PROPS).forEach(([id, p]) => inW(p.pos, `prop ${id}`));
  DECOR.forEach((d, i) => inW(d.pos, `decor[${i}]`));
  Object.entries(NPCS).forEach(([id, n]) => { inW(n.home, `npc ${id}.home`); n.waypoints?.forEach((w) => inW(w, `npc ${id}.waypoint`)); });
  CHECKLIST.forEach((c) => need(c.text, `checklist ${c.id}`));
  return errs;
}
