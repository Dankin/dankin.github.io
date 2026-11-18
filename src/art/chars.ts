/**
 * 角色纹理构建（art-char）。纹理键约定见 docs/art-assets.md：
 *   c_<id>_0 / c_<id>_1                 兼容旧键（站立 / 迈步）
 *   c_<id>_idle_0..1                    呼吸待机
 *   c_<id>_walk_0..3                    走路 4 帧
 *   c_<id>_emo_<happy|scared|surprised|listen|sing_0|sing_1|dance_0|dance_1|annoyed|wave_0|wave_1>
 * 画布尺寸 = 旧源尺寸 × SS：成人 16×24、孩子 16×21（旧 16×24/16×21 源尺寸，SS=3 时 48×72 / 48×63），脚底在底边上方约 0.5 个旧像素，origin(0.5,1)。
 */
import { drawChar, Spec } from './char/rig';
import { SPECS, ALIAS } from './char/specs';
import { POSE_KEYS, EXTRA_KEYS, poseOf } from './char/poses';
import { SPECS2, addProps } from './char/specs2';
import { isAnimal, buildAnimalFrames } from './char/animals';

export interface NpcLookLike { hair?: string; skin?: string; top?: string; pants?: string; shoes?: string; accent?: string; style?: string; acc?: string }
export interface NpcLike { look?: NpcLookLike; kid?: boolean }

const BY_STYLE: Record<string, string> = { pigtails: 'xiaomi', short: 'abao', bun2: 'niuniu', perm: 'aunt', helmet: 'courier' };

const PROPPED = new Set(['laozhou', 'afu', 'adong']);
const PROP_CACHE: Record<string, Spec> = {};
/** 全部有专属造型的角色 id（含动物），Boot 可据此补注册 npcs.json 里没有的 id */
export const ALL_CHAR_IDS: string[] = [...Object.keys(SPECS), ...Object.keys(SPECS2), 'dog', 'cat_m'];

/** 查找 / 兜底：未知 id 用 look.style 借已有角色的造型，再套上 look 的配色 */
export function specFor(id: string, n?: NpcLike): Spec {
  const sid = ALIAS[id] ?? id;
  if (SPECS[sid]) return PROPPED.has(sid) ? (PROP_CACHE[sid] ??= addProps(SPECS[sid])) : SPECS[sid];
  if (SPECS2[sid]) return SPECS2[sid];
  const l = n?.look ?? {};
  const base = SPECS[BY_STYLE[l.style ?? ''] ?? (n?.kid ? 'abao' : 'xiaomi')];
  return { ...base, id, frame: n?.kid ? 'kid' : 'adult', skin: l.skin ?? base.skin, hair: l.hair ?? base.hair, top: l.top ?? base.top, pants: l.pants ?? base.pants, shoes: l.shoes ?? base.shoes, accent: l.accent ?? base.accent, sleeve: l.top ?? base.sleeve };
}

/** 画出一个角色的全部帧（键为后缀，如 'walk_2'）。'0' 与 '1' 为兼容旧键 */
export function buildCharFrames(id: string, n?: NpcLike): Record<string, HTMLCanvasElement> {
  if (isAnimal(id)) return buildAnimalFrames(id);
  const s = specFor(id, n);
  const kid = s.frame ? s.frame === 'kid' : !!s.kid;
  const out: Record<string, HTMLCanvasElement> = {};
  let seed = 1; for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  for (const k of [...POSE_KEYS, ...(EXTRA_KEYS[ALIAS[id] ?? id] ?? [])]) {
    if (k === '1' && out.walk_0) { out['1'] = out.walk_0; continue; }
    if (k === '0' && out.idle_0) { out['0'] = out.idle_0; continue; }
    const p = poseOf(k, kid);
    s.mod?.(k, p);
    out[k] = drawChar(s, p, seed);
  }
  return out;
}

/** 注册到 Phaser 纹理管理器；返回注册的键数组 */
export function registerCharTextures(textures: { exists(k: string): boolean; addCanvas(k: string, c: HTMLCanvasElement): unknown }, npcs: Record<string, NpcLike>): string[] {
  const keys: string[] = [];
  const all: Record<string, NpcLike> = { ...npcs };
  for (const id of ALL_CHAR_IDS) if (!(id in all)) all[id] = {}; // npcs.json 没写的专属造型角色也注册
  for (const [id, n] of Object.entries(all)) {
    const fr = buildCharFrames(id, n);
    for (const [k, c] of Object.entries(fr)) { const key = `c_${id}_${k}`; if (!textures.exists(key)) { textures.addCanvas(key, c); keys.push(key); } }
  }
  return keys;
}
export { SPECS };
