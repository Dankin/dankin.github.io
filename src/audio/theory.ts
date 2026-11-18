/**
 * 音乐理论数据表（纯数据 + 校验，无 WebAudio / DOM 依赖，可在 node 里直接跑）。
 *
 * 主旋律《冬青里》(Holly Lane)：原创，C 大调，4/4，16 小节 = 64 拍，基础速度 84 BPM。
 *   A  (小节 1-8)  ：开头四小节沿用既有主题 E G C' | B A G | E G A | G E D（原 THEME 的动机），随后重复并转向属和弦。
 *   B  (小节 9-16) ：音区抬高、长音，F-C-Dm-G-Am-F-G-C 回到主音，首尾可无缝循环。
 * 终章可升到 G 大调（+7 半音，全部音仍落在 G 大调内，见 validateTheory）。
 * 平安夜（Franz Gruber 1818，公有领域）只引用前 8 小节做铃声/合唱变奏，见 SILENT_NIGHT，已标注。
 */

export const BASE_BPM = 84;
export const BARS = 16;
export const STEPS_PER_BAR = 8; // 八分音符网格
export const LOOP_STEPS = BARS * STEPS_PER_BAR;

/** 调式表：可用的主音偏移与音阶（pitch class 集合） */
export const KEYS = {
  C: { tonic: 0, name: 'C 大调', pcs: [0, 2, 4, 5, 7, 9, 11] },
  G: { tonic: 7, name: 'G 大调', pcs: [7, 9, 11, 0, 2, 4, 6] },
} as const;
export type KeyName = keyof typeof KEYS;

/** 在 C / G 两种调里都安全的“五声”音（D E G A），音效里的随机叮咚只用它们 */
export const SAFE_PENTA = [62, 64, 67, 69, 74, 76, 79, 81, 86, 88, 91, 93]; // D4 E4 G4 A4 | D5 E5 G5 A5 | D6 E6 G6 A6
/** 暖度“叮”的音阶阶梯（C 大调五声，向上） */
export const WARM_LADDER = [72, 74, 76, 79, 81, 84, 86, 88, 91];

// ———————————————— 和弦 ————————————————
export interface Chord {
  name: string;
  pcs: number[]; // 和弦内音 pitch class
  root: number; // 低音根音 MIDI
  fifth: number; // 低音五音 MIDI
  arp: number[]; // 吉他分解和弦音（4 个）
  pad: number[]; // 弦乐/合唱和声音（4 个）
}
export const CHORDS: Record<string, Chord> = {
  C: { name: 'C', pcs: [0, 4, 7], root: 36, fifth: 43, arp: [48, 55, 60, 64], pad: [55, 60, 64, 67] },
  G: { name: 'G', pcs: [7, 11, 2], root: 43, fifth: 50, arp: [43, 50, 55, 59], pad: [55, 59, 62, 67] },
  Am: { name: 'Am', pcs: [9, 0, 4], root: 45, fifth: 52, arp: [45, 52, 57, 60], pad: [57, 60, 64, 69] },
  F: { name: 'F', pcs: [5, 9, 0], root: 41, fifth: 48, arp: [41, 48, 53, 57], pad: [53, 57, 60, 65] },
  Dm: { name: 'Dm', pcs: [2, 5, 9], root: 38, fifth: 45, arp: [38, 45, 50, 53], pad: [50, 53, 57, 62] },
};
/** 16 小节的和声进行 */
export const PROGRESSION = ['C', 'G', 'Am', 'G', 'C', 'G', 'F', 'G', 'F', 'C', 'Dm', 'G', 'Am', 'F', 'G', 'C'];
export const chordOfBar = (bar: number): Chord => CHORDS[PROGRESSION[((bar % BARS) + BARS) % BARS]];

// ———————————————— 主旋律 ————————————————
/** [MIDI, 拍数]，每小节合计 4 拍 */
export const MELODY_BARS: [number, number][][] = [
  [[64, 1], [67, 1], [72, 2]], // 1  C   E G C'
  [[71, 1], [69, 1], [67, 2]], // 2  G   B A G
  [[64, 1], [67, 1], [69, 2]], // 3  Am  E G A
  [[67, 1], [64, 1], [62, 2]], // 4  G   G E D
  [[64, 1], [67, 1], [72, 2]], // 5  C   重复
  [[74, 1], [72, 1], [71, 2]], // 6  G   D' C' B
  [[69, 1], [72, 1], [69, 2]], // 7  F   A C' A
  [[67, 1], [71, 1], [74, 2]], // 8  G   G B D'（半终止，引向 B 段）
  [[72, 2], [69, 1], [72, 1]], // 9  F   C' (长) A C'
  [[76, 2], [72, 2]], //          10 C   E' C'
  [[74, 1], [76, 1], [77, 1], [74, 1]], // 11 Dm D' E' F' D'
  [[71, 2], [74, 2]], //            12 G   B D'
  [[76, 2], [74, 1], [72, 1]], //   13 Am  E' D' C'
  [[72, 2], [69, 2]], //            14 F   C' A
  [[74, 1], [71, 1], [67, 2]], //   15 G   D' B G
  [[72, 4]], //                     16 C   C' 全音，回到主音
];
export interface NoteEv { step: number; midi: number; dur: number } // dur 单位：八分音符
export const MELODY: NoteEv[] = (() => {
  const out: NoteEv[] = [];
  MELODY_BARS.forEach((bar, bi) => {
    let s = bi * STEPS_PER_BAR;
    for (const [m, b] of bar) { out.push({ step: s, midi: m, dur: b * 2 }); s += b * 2; }
  });
  return out;
})();
/** step → 该步开始的旋律音 */
export const MELODY_AT: Record<number, NoteEv> = Object.fromEntries(MELODY.map((n) => [n.step, n]));
export function melodyCovering(step: number): NoteEv | undefined {
  const s = ((step % LOOP_STEPS) + LOOP_STEPS) % LOOP_STEPS;
  return MELODY.find((n) => s >= n.step && s < n.step + n.dur);
}

/** 既有的开场主题（保持导出，Game.ts / 旧调用依赖）：[MIDI, 拍数] */
export const THEME: [number, number][] = [
  [64, 1], [67, 1], [72, 2], [71, 1], [69, 1], [67, 2],
  [64, 1], [67, 1], [69, 2], [67, 1], [64, 1], [62, 1], [60, 3],
];
export const PRELUDE: [number, number][] = [[64, 1], [67, 1], [72, 2], [71, 1], [69, 1], [67, 2]];

// ———————————————— 平安夜（公有领域，Gruber 1818）变奏引用 ————————————————
/** [MIDI, 八分音符数]（6/8）。仅前 8 小节，作为铃声/合唱“引用”，在文档与代码中均标注为公有领域曲调。 */
export const SILENT_NIGHT: [number, number][] = [
  [67, 3], [69, 1], [67, 2], [64, 6],
  [67, 3], [69, 1], [67, 2], [64, 6],
  [74, 4], [74, 2], [71, 6],
  [72, 4], [72, 2], [67, 6],
];
/** 引用片段的和声（每 6 个八分音符一个和弦）：C C C C G G C C */
export const SILENT_NIGHT_CHORDS: number[][] = [
  [48, 55, 64], [48, 55, 64], [48, 55, 64], [48, 55, 64],
  [43, 50, 59], [43, 50, 59], [48, 55, 64], [48, 55, 64],
].slice(0, 8);

// ———————————————— 故事动机 ————————————————
export type StoryId = 'xiaomi' | 'afu' | 'laozhou' | 'xiaolan' | 'adong' | 'finale';
export const STORY_IDS: StoryId[] = ['xiaomi', 'afu', 'laozhou', 'xiaolan', 'adong'];
const ALIASES: Record<string, StoryId> = {
  xiaomi: 'xiaomi', mi: 'xiaomi', singer: 'xiaomi', xiaomi_story: 'xiaomi', story_xiaomi: 'xiaomi',
  afu: 'afu', abao: 'afu', courier: 'afu', mailman: 'afu', afu_story: 'afu', story_afu: 'afu',
  laozhou: 'laozhou', zhou: 'laozhou', baker: 'laozhou', laozhou_story: 'laozhou', story_laozhou: 'laozhou',
  xiaolan: 'xiaolan', lan: 'xiaolan', painter: 'xiaolan', xiaolan_story: 'xiaolan', story_xiaolan: 'xiaolan',
  adong: 'adong', dong: 'adong', sled: 'adong', adong_story: 'adong', story_adong: 'adong',
  finale: 'finale', eve: 'finale', xmas_eve: 'finale', christmas_eve: 'finale', finale_story: 'finale', ending: 'finale',
};
export function canonStory(id: string): StoryId | undefined {
  const k = String(id || '').toLowerCase().replace(/[-\s]/g, '_');
  return ALIASES[k];
}

export type MotifInst = 'hum' | 'pizz' | 'wood' | 'piano' | 'trumpet' | 'choir';
export interface MotifNote { at: number; midi: number; dur: number } // at/dur：八分音符
export interface Motif {
  inst: MotifInst;
  notes: MotifNote[]; // 单旋律音（choir 时 midi 可同一 at 多音，形成和弦）
  /** 一次性演出使用的“较长版本”附加（仅 storyMotif 时播放，背景循环里只放 notes） */
  tail?: MotifNote[];
  note: string; // 说明（文档用）
}
/** 逐渐加速的序列：gap0 起始间隔（八分音符），ratio<1 越来越快 */
function accelerando(midis: number[], gap0: number, ratio: number, dur = 1.2): MotifNote[] {
  const out: MotifNote[] = []; let at = 0, gap = gap0;
  for (const m of midis) { out.push({ at, midi: m, dur }); at += gap; gap *= ratio; }
  return out;
}
export const MOTIFS: Record<StoryId, Motif> = {
  // 小米：人声哼唱，童声感，由 E G C' 的主动机 “la-la-laa”
  xiaomi: { inst: 'hum', note: '童声“hm-la”：主动机 E G C′ 再落回 G', notes: [
    { at: 0, midi: 76, dur: 1 }, { at: 1, midi: 79, dur: 1 }, { at: 2, midi: 84, dur: 3 }, { at: 5, midi: 83, dur: 1 }, { at: 6, midi: 79, dur: 2 },
  ], tail: [{ at: 8, midi: 76, dur: 1 }, { at: 9, midi: 79, dur: 1 }, { at: 10, midi: 81, dur: 2 }, { at: 12, midi: 79, dur: 4 }] },
  // 阿福：悄悄加快的小提琴拨弦（上行 C 大三和弦再回落，间隔 ×0.86）
  afu: { inst: 'pizz', note: '拨弦“蹑手蹑脚”：C E G E C E G C′，间隔逐渐缩短', notes: accelerando([60, 64, 67, 64, 60, 64, 67, 72], 1.15, 0.86, 1.2), tail: accelerando([72, 71, 69, 67, 69, 71, 72, 76], 0.9, 0.9, 1.0).map((n) => ({ ...n, at: n.at + 7 })) },
  // 老周：暖色低音木管（单簧管下音区），慢而稳
  laozhou: { inst: 'wood', note: '低音木管：G C E D C，慢速、暖', notes: [
    { at: 0, midi: 55, dur: 2 }, { at: 2, midi: 60, dur: 2 }, { at: 4, midi: 64, dur: 2 }, { at: 6, midi: 62, dur: 1 }, { at: 7, midi: 60, dur: 1 },
  ], tail: [{ at: 8, midi: 57, dur: 2 }, { at: 10, midi: 60, dur: 2 }, { at: 12, midi: 64, dur: 4 }] },
  // 小蓝：钢琴，水彩晕开：Cmaj9 上行琶音，延音踏板
  xiaolan: { inst: 'piano', note: '钢琴水彩：C E G A D″ 琶音上行（add9/6），延音', notes: [
    { at: 0, midi: 72, dur: 2 }, { at: 1, midi: 76, dur: 2 }, { at: 2, midi: 79, dur: 2 }, { at: 3, midi: 81, dur: 2 }, { at: 4, midi: 86, dur: 4 },
  ], tail: [{ at: 8, midi: 84, dur: 2 }, { at: 9, midi: 79, dur: 2 }, { at: 10, midi: 76, dur: 2 }, { at: 11, midi: 72, dur: 5 }] },
  // 阿冬：小号 + 鼓点的“冲线”
  adong: { inst: 'trumpet', note: '小号冲线：G C′ E′ | G′（鼓点八分上滚）', notes: [
    { at: 0, midi: 67, dur: 1 }, { at: 1, midi: 72, dur: 1 }, { at: 2, midi: 76, dur: 2 }, { at: 4, midi: 79, dur: 4 },
  ], tail: [{ at: 8, midi: 79, dur: 1 }, { at: 9, midi: 79, dur: 1 }, { at: 10, midi: 84, dur: 3 }, { at: 13, midi: 83, dur: 1 }, { at: 14, midi: 79, dur: 2 }] },
  // 终章：合唱，C 和弦“啊”；一次性演出（tail）延续 G → Am → F → C
  finale: { inst: 'choir', note: '合唱 C→G→Am→F→C 和弦“啊/哦”（背景只放第一个 C）', notes: [
    { at: 0, midi: 60, dur: 8 }, { at: 0, midi: 64, dur: 8 }, { at: 0, midi: 67, dur: 8 }, { at: 0, midi: 72, dur: 8 },
  ], tail: [
    { at: 8, midi: 55, dur: 4 }, { at: 8, midi: 59, dur: 4 }, { at: 8, midi: 62, dur: 4 }, { at: 8, midi: 67, dur: 4 },
    { at: 12, midi: 57, dur: 4 }, { at: 12, midi: 60, dur: 4 }, { at: 12, midi: 64, dur: 4 }, { at: 12, midi: 69, dur: 4 },
    { at: 16, midi: 53, dur: 4 }, { at: 16, midi: 60, dur: 4 }, { at: 16, midi: 65, dur: 4 }, { at: 16, midi: 69, dur: 4 },
    { at: 20, midi: 60, dur: 10 }, { at: 20, midi: 64, dur: 10 }, { at: 20, midi: 67, dur: 10 }, { at: 20, midi: 72, dur: 10 },
  ] },
};
/** 动机在背景里“永久加入”时的候选小节（按偏好顺序，校验后取第一个无冲突且未被占用的） */
export const MOTIF_PREF_BARS: Record<StoryId, number[]> = {
  xiaomi: [4, 0, 9, 15, 5],
  afu: [9, 4, 0, 15, 13],
  laozhou: [13, 6, 14, 10, 2],
  xiaolan: [10, 2, 6, 12, 9],
  adong: [14, 7, 11, 3, 15],
  finale: [15, 9, 0, 4, 13],
};

// ———————————————— 校验 ————————————————
export interface Issue { level: 'error' | 'warn'; msg: string }
const pc = (m: number) => ((m % 12) + 12) % 12;
/** 小二度 / 大七度 / 小九度 = 刺耳 */
const harsh = (a: number, b: number) => { const d = Math.abs(a - b) % 12; return d === 1 || d === 11; };

/** 动机音在第 bar 小节 step=0 起播时，与和弦/旋律的冲突列表 */
export function motifClashes(id: StoryId, bar: number): string[] {
  const out: string[] = []; const m = MOTIFS[id]; const ch = chordOfBar(bar);
  const chordMidis = [ch.root, ...ch.pad];
  for (const n of m.notes) {
    const s = bar * STEPS_PER_BAR + Math.round(n.at);
    if (n.at + n.dur > STEPS_PER_BAR + 1) out.push(`${id}: 音超出小节(at=${n.at},dur=${n.dur})`);
    // 对和弦：持续 ≥2 的音不能与和弦音构成小二度
    if (n.dur >= 2) for (const c of chordMidis) if (harsh(n.midi, c)) { out.push(`${id}@bar${bar + 1}: ${n.midi} 与和弦音 ${c} 刺耳`); break; }
    // 对旋律：同时发声不能小二度/大七度（动机 vs 主旋律）
    const mel = melodyCovering(s);
    if (mel && harsh(n.midi, mel.midi) && Math.abs(n.midi - mel.midi) < 24) out.push(`${id}@bar${bar + 1}: ${n.midi} 与旋律 ${mel.midi} 刺耳`);
  }
  return out;
}
/** 为每个动机挑选互不重叠、无冲突的背景小节 */
export const MOTIF_SLOT: Record<StoryId, number> = (() => {
  const used = new Set<number>(); const out = {} as Record<StoryId, number>;
  for (const id of Object.keys(MOTIFS) as StoryId[]) {
    let pick = -1;
    for (const b of MOTIF_PREF_BARS[id]) if (!used.has(b) && motifClashes(id, b).length === 0) { pick = b; break; }
    if (pick < 0) for (let b = 0; b < BARS; b++) if (!used.has(b) && motifClashes(id, b).length === 0) { pick = b; break; }
    if (pick >= 0) used.add(pick);
    out[id] = pick;
  }
  return out;
})();

export function validateTheory(): { ok: boolean; issues: Issue[]; table: string[] } {
  const issues: Issue[] = []; const table: string[] = [];
  const C = new Set<number>(KEYS.C.pcs), G = new Set<number>(KEYS.G.pcs);
  const err = (msg: string) => issues.push({ level: 'error', msg });
  const warn = (msg: string) => issues.push({ level: 'warn', msg });
  if (PROGRESSION.length !== BARS || MELODY_BARS.length !== BARS) err('小节数不为 16');
  MELODY_BARS.forEach((bar, bi) => {
    const beats = bar.reduce((s, n) => s + n[1], 0);
    if (beats !== 4) err(`小节 ${bi + 1} 拍数 ${beats} ≠ 4`);
    const ch = CHORDS[PROGRESSION[bi]];
    let pos = 0;
    const row: string[] = [];
    for (const [m, b] of bar) {
      if (!C.has(pc(m))) err(`小节 ${bi + 1} 旋律音 ${m} 不在 C 大调内`);
      if (!G.has(pc(m + 7))) err(`小节 ${bi + 1} 旋律音 ${m}+7 不在 G 大调内`);
      const strong = pos === 0 || pos === 2; // 强拍
      const inChord = ch.pcs.includes(pc(m));
      const clash = ch.pcs.some((p) => harsh(p, pc(m)));
      if (clash) { if (strong || b >= 2) err(`小节 ${bi + 1}(${ch.name}) 强拍/长音 ${m} 与和弦小二度冲突`); else warn(`小节 ${bi + 1}(${ch.name}) 弱拍经过音 ${m} 与和弦小二度（经过音，允许）`); }
      row.push(`${m}${inChord ? '' : '*'}×${b}`);
      pos += b;
    }
    table.push(`bar${String(bi + 1).padStart(2)} ${ch.name.padEnd(2)} | ${row.join(' ')}   (*=非和弦音)`);
  });
  for (const [name, ch] of Object.entries(CHORDS)) {
    for (const m of [ch.root, ch.fifth, ...ch.arp, ...ch.pad]) {
      if (!C.has(pc(m))) err(`和弦 ${name} 音 ${m} 不在 C 大调内`);
      if (!G.has(pc(m + 7))) err(`和弦 ${name} 音 ${m}+7 不在 G 大调内`);
    }
    for (const m of ch.arp) if (!ch.pcs.includes(pc(m))) err(`和弦 ${name} 分解音 ${m} 不是和弦内音`);
  }
  for (const m of SAFE_PENTA) { if (!C.has(pc(m)) || !G.has(pc(m + 7)) || !G.has(pc(m))) err(`SAFE_PENTA ${m} 不同时属于 C 与 G 大调`); }
  for (const m of WARM_LADDER) if (!C.has(pc(m))) err(`WARM_LADDER ${m} 不在 C 大调内`);
  for (const [m] of SILENT_NIGHT) if (!C.has(pc(m))) err(`平安夜引用音 ${m} 不在 C 大调`);
  for (const id of Object.keys(MOTIFS) as StoryId[]) {
    const mo = MOTIFS[id];
    for (const n of [...mo.notes, ...(mo.tail || [])]) {
      if (!C.has(pc(n.midi))) err(`动机 ${id} 音 ${n.midi} 不在 C 大调`);
      if (!G.has(pc(n.midi + 7))) err(`动机 ${id} 音 ${n.midi}+7 不在 G 大调`);
    }
    const slot = MOTIF_SLOT[id];
    if (slot < 0) err(`动机 ${id} 找不到无冲突的背景小节`);
    else table.push(`motif ${id.padEnd(8)} ${mo.inst.padEnd(8)} 背景小节 bar${slot + 1} (${PROGRESSION[slot]})  ${mo.note}`);
  }
  return { ok: !issues.some((i) => i.level === 'error'), issues, table };
}
