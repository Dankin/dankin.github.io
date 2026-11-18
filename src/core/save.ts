/**
 * 存档：localStorage 自动档（1 槽）+ 设置（独立，新游戏不清）。
 *  - 带版本号与迁移链；读取时逐字段校验/截断，损坏的存档备份后降级为“无存档”，永不抛出。
 *  - localStorage 不可用（隐私模式/被禁）时退回内存，游戏照常运行。
 *  - 导出/导入 JSON 文件（浏览器下载 / <input type=file>）。
 */
export const SAVE_VERSION = 1;
const KEY = 'christmas-hat/save';
const KEY_BAK = 'christmas-hat/save.corrupt';
const KEY_SET = 'christmas-hat/settings';

export interface StorySave { done: string[]; finished: boolean }
export interface SaveData {
  v: number;
  savedAt: number;            // Date.now()
  playSecs: number;           // 累计游玩秒数
  stories: Record<string, StorySave>;
  checklist: string[];        // 已完成的清单项
  warmth: number;             // 0~100
  hat: { stage: number; x: number; y: number };
  possessed: string[];        // 已附身过（解锁）的物件
  phase: string;              // 时间阶段 id
  eggs: string[];             // 已发现的彩蛋
  uses: Record<string, number>; // 物件使用次数（彩蛋/成就计数）
  extra: Record<string, unknown>; // 其他模块自管的数据（原样存取）
}
export interface Settings { muted: boolean; zoom?: number }

// —— 存储后端（带内存回退） ——
const mem = new Map<string, string>();
let lsOk: boolean | null = null;
function ls(): Storage | null {
  if (lsOk === false) return null;
  try { const s = window.localStorage; if (lsOk === null) { s.setItem('__t', '1'); s.removeItem('__t'); lsOk = true; } return s; } catch { lsOk = false; return null; }
}
const get = (k: string) => { try { return ls()?.getItem(k) ?? mem.get(k) ?? null; } catch { return mem.get(k) ?? null; } };
const set = (k: string, v: string) => { mem.set(k, v); try { ls()?.setItem(k, v); } catch { /* 配额/禁用：忽略 */ } };
const del = (k: string) => { mem.delete(k); try { ls()?.removeItem(k); } catch { /* */ } };

// —— 校验 / 迁移 ——
const num = (x: unknown, d: number, lo = -1e9, hi = 1e9) => (typeof x === 'number' && isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d);
const strs = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string').slice(0, 500) : []);
const isObj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);

export function blankSave(): SaveData {
  return { v: SAVE_VERSION, savedAt: 0, playSecs: 0, stories: {}, checklist: [], warmth: 0, hat: { stage: 0, x: NaN, y: NaN }, possessed: [], phase: '', eggs: [], uses: {}, extra: {} };
}

/** 迁移链：key = 旧版本号，返回升到下一版的数据 */
const MIGRATIONS: Record<number, (d: any) => any> = {
  // v0（无版本号的早期原型，仅 { done:[], warmth }）→ v1
  0: (d) => ({ ...d, v: 1, stories: d.story ? { [d.story.npc ?? 'xiaomi']: { done: d.story.done ?? [], finished: !!d.story.finished } } : d.stories ?? {} }),
};

export function migrate(raw: any): any {
  let d = raw; let v = isObj(d) && typeof d.v === 'number' ? d.v : 0;
  let guard = 0;
  while (v < SAVE_VERSION && MIGRATIONS[v] && guard++ < 20) { d = MIGRATIONS[v](d); v = d.v ?? v + 1; }
  return d;
}

/** 把任意对象清洗成合法 SaveData（未知字段丢弃，坏字段取默认）。无法识别时返回 null。 */
export function sanitize(raw: unknown): SaveData | null {
  const d0 = migrate(raw);
  if (!isObj(d0)) return null;
  // 至少要有一个我们认识的字段，否则当作无效文件
  if (!('stories' in d0 || 'checklist' in d0 || 'warmth' in d0 || 'hat' in d0)) return null;
  const out = blankSave();
  out.v = SAVE_VERSION;
  out.savedAt = num(d0.savedAt, 0, 0);
  out.playSecs = num(d0.playSecs, 0, 0, 1e7);
  if (isObj(d0.stories)) for (const [k, s] of Object.entries(d0.stories)) if (isObj(s)) out.stories[k.slice(0, 40)] = { done: strs(s.done), finished: !!s.finished };
  out.checklist = strs(d0.checklist);
  out.warmth = num(d0.warmth, 0, 0, 100);
  if (isObj(d0.hat)) out.hat = { stage: Math.round(num(d0.hat.stage, 0, 0, 9)), x: num(d0.hat.x, NaN), y: num(d0.hat.y, NaN) };
  out.possessed = strs(d0.possessed);
  out.phase = typeof d0.phase === 'string' ? d0.phase.slice(0, 40) : '';
  out.eggs = strs(d0.eggs);
  if (isObj(d0.uses)) for (const [k, n] of Object.entries(d0.uses)) if (typeof n === 'number' && isFinite(n)) out.uses[k.slice(0, 40)] = Math.max(0, Math.min(9999, Math.round(n)));
  if (isObj(d0.extra)) { try { out.extra = JSON.parse(JSON.stringify(d0.extra)); } catch { /* */ } }
  return out;
}

export type LoadResult = { ok: true; data: SaveData } | { ok: false; reason: 'none' | 'corrupt' };

export function loadSave(): LoadResult {
  const txt = get(KEY);
  if (!txt) return { ok: false, reason: 'none' };
  try {
    const data = sanitize(JSON.parse(txt));
    if (data) return { ok: true, data };
  } catch { /* 落到下面的备份逻辑 */ }
  set(KEY_BAK, txt); del(KEY);          // 备份损坏档，降级为无存档
  console.warn('[save] 存档损坏，已备份到', KEY_BAK);
  return { ok: false, reason: 'corrupt' };
}
export const hasSave = () => loadSave().ok;
export function writeSave(d: SaveData): boolean {
  try { d.v = SAVE_VERSION; d.savedAt = Date.now(); set(KEY, JSON.stringify(d)); return true; } catch { return false; }
}
export const clearSave = () => del(KEY);

// —— 设置 ——
export function loadSettings(): Settings {
  try { const o = JSON.parse(get(KEY_SET) ?? '{}'); return { muted: !!o.muted, zoom: typeof o.zoom === 'number' ? num(o.zoom, 1, 0.7, 1.5) : undefined }; } catch { return { muted: false }; }
}
export function saveSettings(s: Settings) { set(KEY_SET, JSON.stringify(s)); }

// —— 导入 / 导出 ——
export function exportText(d: SaveData): string { return JSON.stringify({ ...d, v: SAVE_VERSION, savedAt: Date.now(), game: 'christmas-hat' }, null, 1); }
export function importText(text: string): { ok: true; data: SaveData } | { ok: false; error: string } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'json' }; }
  const data = sanitize(raw);
  return data ? { ok: true, data } : { ok: false, error: 'shape' };
}
export function downloadSave(d: SaveData) {
  const blob = new Blob([exportText(d)], { type: 'application/json' });
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  a.href = URL.createObjectURL(blob); a.download = `christmas-hat-save-${ts}.json`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
/** 弹出文件选择，读成文本（用户取消返回 null） */
export function pickTextFile(): Promise<string | null> {
  return new Promise((res) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json'; inp.style.display = 'none';
    inp.onchange = () => {
      const f = inp.files?.[0]; inp.remove();
      if (!f) return res(null);
      if (f.size > 2_000_000) return res('');
      const r = new FileReader(); r.onload = () => res(String(r.result ?? '')); r.onerror = () => res(''); r.readAsText(f);
    };
    inp.oncancel = () => { inp.remove(); res(null); };
    document.body.appendChild(inp); inp.click();
  });
}
