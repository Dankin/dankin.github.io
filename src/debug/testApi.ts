/**
 * QA 测试钩子（仅 ?debug=1 或测试脚本动态加载，不进正式流程）。
 * 挂到 window.__qa。所有读取状态的函数都对内部结构做“鸭子类型”容错：
 * 内部字段改名时返回 null/空，而不是抛错；具体缺口见 game/tests/README.md「依赖的内部字段」。
 *
 * 接入方式（dev-core 在 main.ts 末尾）：
 *   if (new URLSearchParams(location.search).get('debug') === '1') import('./debug/testApi').then((m) => m.installTestApi(game));
 * 在 dev server 下，测试脚本即使没接入也会 `import('/src/debug/testApi.ts')` 自行加载。
 */
import { CFG, MAP, NPCS, PROPS, REGIONS, STORIES, CHECKLIST, MOVES, WORLD_W, WORLD_H, BLOCK, t } from '../core/data';
import { toScreen } from '../core/iso';

type Any = any;
interface Rect { x0: number; y0: number; x1: number; y1: number }
interface Block extends Rect { id: string; kind: string }

const GAME_KEY = 'game';

export function installTestApi(game: Any = (window as Any).__game) {
  const sc = (): Any => game.scene.getScene(GAME_KEY);
  const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
  const hit = (a: Rect, b: Rect, m = 0) => a.x0 < b.x1 - m && a.x1 > b.x0 + m && a.y0 < b.y1 - m && a.y1 > b.y0 + m;
  const inter = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

  // ———————————————— 坐标换算 ————————————————
  /** 游戏逻辑屏幕坐标(0..960,0..540) → 浏览器页面坐标 */
  const gameToPage = (gx: number, gy: number) => {
    const r = game.canvas.getBoundingClientRect();
    const gw = game.scale.gameSize.width, gh = game.scale.gameSize.height;
    return { x: r.left + (gx / gw) * r.width, y: r.top + (gy / gh) * r.height };
  };
  /** 世界像素坐标(经主相机) → 游戏逻辑屏幕坐标 */
  const worldToGame = (wx: number, wy: number) => {
    const c = sc().cameras.main, v = c.worldView;
    return { x: c.x + (wx - v.x) * c.zoom, y: c.y + (wy - v.y) * c.zoom };
  };
  const worldToPage = (wx: number, wy: number) => { const g = worldToGame(wx, wy); return gameToPage(g.x, g.y); };
  /** 瓦片坐标 + 离地高度 → 页面坐标 */
  const tileToPage = (tx: number, ty: number, z = 0) => { const s = toScreen(tx, ty); return worldToPage(s.x, s.y - z); };
  const visibleTile = (px: number, py: number) => {
    const g = game.scale.gameSize, r = game.canvas.getBoundingClientRect();
    const gx = ((px - r.left) / r.width) * g.width, gy = ((py - r.top) / r.height) * g.height;
    return gx >= 0 && gy >= 0 && gx <= g.width && gy <= g.height;
  };

  // ———————————————— 物件 / NPC 位置 ————————————————
  const propEnt = (id: string): Any => sc().props?.[id];
  /** 物件可点击中心（页面坐标）。优先用运行时实体，否则回退到数据 */
  const propPoint = (id: string) => {
    const e = propEnt(id), def: Any = (PROPS as Any)[id];
    if (!def) return null;
    const hw = def.hit?.[0] ?? 40, hh = def.hit?.[1] ?? 60;
    const s = e && e.sx !== undefined ? { x: e.sx, y: e.sy } : toScreen(def.pos[0], def.pos[1]);
    const p = worldToPage(s.x, s.y - hh * 0.5);
    const g = worldToGame(s.x, s.y - hh * 0.5);
    const zoom = sc().cameras.main.zoom;
    return { x: p.x, y: p.y, gx: g.x, gy: g.y, w: hw * zoom, h: hh * zoom, onScreen: visibleTile(p.x, p.y) };
  };
  const npcEnt = (id: string): Any => sc().npcs?.[id];
  const npcPoint = (id: string) => {
    const n = npcEnt(id); if (!n?.spr) return null;
    const p = worldToPage(n.spr.x, n.spr.y - 28);
    return { x: p.x, y: p.y, onScreen: visibleTile(p.x, p.y) };
  };
  const groundPoint = (tx: number, ty: number) => { const p = tileToPage(tx, ty, 0); return { x: p.x, y: p.y, onScreen: visibleTile(p.x, p.y) }; };
  const tileAt = (x: number, y: number) => (MAP as string[])[Math.floor(y)]?.[Math.floor(x)] ?? '?';

  // ———————————————— 交互控件枚举（招式按钮 / 开始按钮等） ————————————————
  /** 递归取容器内文本 */
  const textsOf = (o: Any, out: string[] = []) => {
    if (!o) return out;
    if (typeof o.text === 'string' && o.type === 'Text') out.push(o.text);
    if (o.list) for (const c of o.list) textsOf(c, out);
    return out;
  };
  const worldVisible = (o: Any) => {
    for (let n = o; n; n = n.parentContainer) if (!n.visible || n.alpha < 0.05) return false;
    return true;
  };
  /**
   * 列出当前所有可交互且可见的显示对象（含 setData('qa', ...) 标识、文字标签、游戏屏幕包围盒、页面中心坐标）。
   * 按钮的稳定标识：dev 在按钮对象上 setData('qa','move:<id>') / 'ui:<name>'。
   */
  const uiButtons = () => {
    const out: Any[] = [];
    const walk = (o: Any, parentLabel: string[]) => {
      if (!o) return;
      const isInter = !!o.input?.enabled;
      if (isInter && worldVisible(o)) {
        let b: Any = null;
        try { b = o.getBounds(); } catch { /* ignore */ }
        if (b && b.width > 0) {
          const label = (o.parentContainer ? textsOf(o.parentContainer) : textsOf(o)).join(' ').trim() || textsOf(o).join(' ');
          const c = gameToPage(b.centerX, b.centerY);
          out.push({ qa: o.getData?.('qa') ?? o.parentContainer?.getData?.('qa') ?? null, label, gx0: b.x, gy0: b.y, gw: b.width, gh: b.height, x: c.x, y: c.y, depth: o.depth });
        }
      }
      if (o.list) for (const c of o.list) walk(c, parentLabel);
    };
    for (const o of sc().children.list) walk(o, []);
    return out;
  };
  /** 招式按钮：按 qa 标识 move:<id>，或按文案（zh label）匹配 */
  const moveButton = (moveId: string) => {
    const btns = uiButtons();
    const label = (MOVES as Any)[moveId] ? t((MOVES as Any)[moveId].label) : moveId;
    return btns.find((b) => b.qa === 'move:' + moveId) ?? btns.find((b) => b.label.includes(label)) ?? null;
  };
  /** 点击点上命中的可交互对象（用于判断“真实鼠标点这里会不会被 UI 吃掉”） */
  const uiHitAt = (px: number, py: number) => {
    const g = game.scale.gameSize, r = game.canvas.getBoundingClientRect();
    const gx = ((px - r.left) / r.width) * g.width, gy = ((py - r.top) / r.height) * g.height;
    return uiButtons().filter((b) => gx >= b.gx0 && gx <= b.gx0 + b.gw && gy >= b.gy0 && gy <= b.gy0 + b.gh);
  };

  // ———————————————— 状态导出 ————————————————
  const storiesOf = (): Any[] => {
    const s = sc();
    if (Array.isArray(s.stories?.list)) return s.stories.list;
    if (s.stories && typeof s.stories === 'object') return Object.values(s.stories);
    return s.story ? [s.story] : [];
  };
  const storyInfo = (st: Any) => {
    let cur: Any = null;
    try { cur = st.current?.(); } catch { /* ignore */ }
    const def = (STORIES as Any)[st.id] ?? {};
    return {
      id: st.id, finished: !!st.finished, done: [...(st.done ?? [])], need: def.need ?? null,
      total: def.steps?.length ?? null, current: cur?.id ?? null,
      hint: cur?.hint ? { prop: cur.hint.prop, move: cur.hint.move } : null,
      hintTier: st.hintTier ?? null, lastProgress: st.lastProgress ?? null,
    };
  };
  const state = () => {
    const s = sc();
    if (!s) return { ready: false };
    const hat = s.hat, hud = s.hud;
    const npcs: Any = {};
    for (const [id, n] of Object.entries<Any>(s.npcs ?? {})) {
      npcs[id] = { x: round(n.x), y: round(n.y), state: n.state, tile: tileAt(n.x, n.y), moving: !!n.moving, visible: n.spr?.visible !== false, alpha: round(n.spr?.alpha ?? 1) };
    }
    const stories: Any = {};
    for (const st of storiesOf()) stories[st.id] = storyInfo(st);
    const stim = (s.stim?.active ?? []).map((a: Any) => ({ type: a.type, tag: a.tag, x: round(a.x), y: round(a.y), source: a.source, intensity: a.intensity, radius: a.radius }));
    const cds: Any = {};
    for (const [k, v] of Object.entries<number>(s.cd ?? {})) { const left = v - s.now; if (left > 0) cds[k] = round(left); }
    return {
      ready: true,
      started: !!s.started, locked: !!s.locked, now: round(s.now ?? 0), warmth: round(s.warmth ?? 0),
      region: s.region ?? null, phase: s.phaseId ?? (window as Any).__qaPhase ?? null,
      seqRunning: !!s.seq?.running,
      panelOpen: !!hud?.panelOpen,
      hat: hat ? { x: round(hat.x), y: round(hat.y), z: round(hat.z), stage: hat.stage, attachedTo: hat.attachedTo ?? null, moving: !!hat.moving, tile: tileAt(hat.x, hat.y) } : null,
      cam: { zoom: round(s.cameras.main.zoom, 3), cx: round(s.cameras.main.worldView.centerX, 1), cy: round(s.cameras.main.worldView.centerY, 1) },
      stories, npcs,
      checklist: [...(hud?.done ?? [])],
      checklistTotal: CHECKLIST.length,
      stimuli: stim, cooldowns: cds,
      bubbles: (s.bubbles?.list ?? []).map((b: Any) => b.key),
      toasts: (hud?.toastQ ?? []).length,
      audio: audioState(),
      world: { w: WORLD_W, h: WORLD_H, block: BLOCK },
    };
  };
  const audioState = () => {
    try { const a = (window as Any).__audio; return a ? { muted: !!a.muted, ctx: a.ctx?.state ?? null } : null; } catch { return null; }
  };

  // ———————————————— 调试动作（捷径，仅用于测试夹具/压测，真实通关脚本不要用） ————————————————
  const teleportHat = (tx: number, ty: number, z = 24) => {
    const h = sc().hat; h.x = h.tx = tx; h.y = h.ty = ty; h.z = h.tz = z; h.attachedTo = null; h.arrivedCb = undefined;
    return state().hat;
  };
  const regionCenter = (id: string) => {
    const r: Any = (REGIONS as Any[]).find((x) => x.id === id); if (!r) return null;
    return { x: r.bx * BLOCK + BLOCK / 2, y: r.by * BLOCK + BLOCK / 2 };
  };
  const teleportToRegion = (id: string) => { const c = regionCenter(id); if (!c) return null; return teleportHat(c.x, c.y); };
  const teleportNpc = (id: string, tx: number, ty: number) => {
    const n = npcEnt(id); if (!n) return false;
    n.x = tx; n.y = ty; const p = toScreen(tx, ty); n.spr?.setPosition?.(p.x, p.y); return true;
  };
  /** 同步空转 N 秒游戏逻辑（不渲染，约 20ms 一步），快进昼夜/冷却/NPC 行为 */
  const advance = (seconds: number) => {
    const s = sc(); const steps = Math.ceil(seconds / 0.05);
    for (let i = 0; i < steps; i++) s.update(s.now * 1000, 50);
    return round(s.now);
  };
  /** 持续加速：每个真实帧跑 k 次 update（同时加速 tween / delayedCall）。k=1 还原 */
  const setSpeed = (k: number) => {
    const s = sc();
    if (!s.__qaOrigUpdate) s.__qaOrigUpdate = s.update.bind(s);
    s.update = (a: number, b: number) => { for (let i = 0; i < k; i++) s.__qaOrigUpdate(a, b); };
    s.tweens.timeScale = k; s.time.timeScale = k;
    return k;
  };
  const setPhase = (id: string, secs = 0.01) => {
    const s = sc(); (window as Any).__qaPhase = id;
    if (typeof s.setPhase === 'function') { s.setPhase(id, secs); return true; }
    return false;
  };
  const hookPhase = () => {
    const s = sc(); if (!s || s.__qaPhaseHooked || typeof s.setPhase !== 'function') return;
    const o = s.setPhase.bind(s); s.__qaPhaseHooked = true;
    s.setPhase = (id: string, secs: number) => { (window as Any).__qaPhase = id; return o(id, secs); };
  };
  const setWarmth = (v: number) => { const s = sc(); s.addWarmth?.(v - s.warmth); return s.warmth; };
  const runSequence = (id: string) => { sc().runSequence?.(id); return !!(sc().seq?.running); };
  /** 捷径：直接把故事某步标为完成（走 story.complete，触发后续 bus 事件）。真实通关脚本不要用 */
  const completeStep = (storyId: string, stepId: string) => {
    const st = storiesOf().find((x) => x.id === storyId); if (!st) return false;
    const step = (STORIES as Any)[storyId]?.steps?.find((x: Any) => x.id === stepId); if (!step) return false;
    st.complete?.(step); return true;
  };
  /** 捷径：不点击直接使用招式 */
  const useMove = (propId: string, moveId: string) => { sc().useMove(propId, moveId); return true; };
  const clearCooldowns = () => { sc().cd = {}; return true; };

  // ———————————————— 存档 ————————————————
  const storageDump = () => {
    const o: Any = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; o[k] = localStorage.getItem(k); }
    return o;
  };
  const resetSave = () => { localStorage.clear(); return true; };
  const readSave = (key?: string) => {
    const d = storageDump(); const keys = Object.keys(d);
    const k = key ?? keys.find((x) => /christmas|hat|save/i.test(x)) ?? keys[0];
    if (!k) return null;
    let v: Any = d[k]; try { v = JSON.parse(v); } catch { /* raw */ }
    return { key: k, value: v, bytes: (d[k] ?? '').length, keys };
  };

  // ———————————————— UI 遮挡检测 ————————————————
  const bounds = (o: Any): Rect | null => {
    try { const b = o.getBounds(); return { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height }; } catch { return null; }
  };
  /** 收集当前所有“语义 UI 块”（屏幕逻辑坐标）。优先使用 scene.hud/bubbles 的 qaRects()，缺失则退回私有字段 */
  const uiBlocks = (): Block[] => {
    const s = sc(); const out: Block[] = []; if (!s) return out;
    const push = (id: string, kind: string, r: Rect | null) => { if (r && r.x1 > r.x0 && r.y1 > r.y0) out.push({ id, kind, ...r }); };
    const hud = s.hud, bub = s.bubbles;
    if (typeof hud?.qaRects === 'function') for (const b of hud.qaRects()) push(b.id, b.kind, b);
    else if (hud) {
      push('warmth', 'hud', { x0: 14, y0: 14, x1: 204, y1: 44 });
      push('topbtn', 'hud', { x0: 868, y0: 8, x1: 954, y1: 48 });
      if (hud.checkBg) push('checklist', 'hud', bounds(hud.checkBg));
      if (hud.panelBox) push('panel', 'panel', hud.panelBox);
      (hud.toastQ ?? []).forEach((c: Any, i: number) => { if (c.alpha > 0.5) push('toast' + i, 'toast', bounds(c)); });
    }
    if (typeof bub?.qaRects === 'function') for (const b of bub.qaRects()) push(b.id, b.kind, b);
    else for (const b of bub?.list ?? []) {
      if (b.t < 0.35 || b.cont.alpha < 0.5 || b.cont.scaleX < 0.95) continue; // 等动画稳定
      push('bubble:' + b.key, 'bubble', { x0: b.cont.x - b.w / 2, y0: b.cont.y - b.h, x1: b.cont.x + b.w / 2, y1: b.cont.y });
    }
    return out;
  };
  const OVERLAP_RULES: [string, string][] = [['bubble', 'bubble'], ['bubble', 'hud'], ['bubble', 'panel'], ['bubble', 'toast'], ['panel', 'hud'], ['panel', 'toast'], ['toast', 'hud']];
  /** 返回重叠对（面积 > minArea 像素²）以及越界块。空数组 = 无遮挡 */
  const overlaps = (minArea = 80) => {
    const bl = uiBlocks(); const bad: Any[] = [];
    const gw = game.scale.gameSize.width, gh = game.scale.gameSize.height;
    for (let i = 0; i < bl.length; i++) for (let j = i + 1; j < bl.length; j++) {
      const a = bl[i], b = bl[j];
      const ok = OVERLAP_RULES.some(([k1, k2]) => (a.kind === k1 && b.kind === k2) || (a.kind === k2 && b.kind === k1));
      if (!ok) continue;
      // toast 与 hud 里的 warmth/checklist：toast 在清单上方叠加也是用户反馈过的问题，同样计入
      const area = inter(a, b);
      if (area > minArea) bad.push({ a: a.id, b: b.id, area: Math.round(area), ra: rr(a), rb: rr(b) });
    }
    for (const b of bl) if (b.kind === 'bubble' || b.kind === 'toast' || b.kind === 'panel') {
      if (b.x0 < -2 || b.y0 < -2 || b.x1 > gw + 2 || b.y1 > gh + 2) bad.push({ a: b.id, b: 'OFFSCREEN', area: 0, ra: rr(b) });
    }
    return bad;
  };
  const rr = (r: Rect) => [Math.round(r.x0), Math.round(r.y0), Math.round(r.x1), Math.round(r.y1)];
  /** 所有可见文本是否被屏幕边缘裁切 */
  /** 文案泄漏检测：可见文本里出现未翻译的 key（如 [idle.doudou] / say.xxx）、undefined/NaN/null 等 */
  /** 当前可见的全部文字（用于断言台词/横幅/结尾字幕确实出现） */
  const visibleTexts = (): string[] => {
    const s = sc(); const out: string[] = [];
    const walk = (o: Any) => {
      if (!o) return;
      if (o.type === 'Text' && worldVisible(o) && typeof o.text === 'string' && o.text.trim()) out.push(o.text.trim());
      if (o.list) for (const c of o.list) walk(c);
    };
    for (const o of s.children.list) walk(o);
    return out;
  };
  const textLeaks = () => {
    const s = sc(); const bad: Any[] = [];
    const reKey = /^\[?(?:[a-z][a-z0-9_]*\.)+[a-z0-9_]+\]?$/i;
    const reInline = /\[[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+\]|\b(?:undefined|NaN|\[object Object\])\b/;
    const walk = (o: Any) => {
      if (!o) return;
      if (o.type === 'Text' && worldVisible(o) && typeof o.text === 'string' && o.text) {
        const txt: string = o.text.trim();
        if (reKey.test(txt) || reInline.test(txt)) bad.push({ text: txt.slice(0, 40) });
      }
      if (o.list) for (const c of o.list) walk(c);
    };
    for (const o of s.children.list) walk(o);
    return bad;
  };
  const clippedTexts = () => {
    const s = sc(); const gw = game.scale.gameSize.width, gh = game.scale.gameSize.height; const bad: Any[] = [];
    const cam = s.cameras.main;
    const walk = (o: Any) => {
      if (!o) return;
      if (o.type === 'Text' && worldVisible(o) && o.text) {
        // 仅检查 UI 层（被主相机忽略的）
        if ((o.cameraFilter & cam.id) !== 0) {
          const b = bounds(o);
          if (b && (b.x0 < -2 || b.y0 < -2 || b.x1 > gw + 2 || b.y1 > gh + 2)) bad.push({ text: o.text.slice(0, 24), r: rr(b) });
        }
      }
      if (o.list) for (const c of o.list) walk(c);
    };
    for (const o of s.children.list) walk(o);
    return bad;
  };

  // ———————————————— 世界一致性 ————————————————
  const BLOCKED: string[] = (CFG as Any).blockedTiles ?? ['w'];
  /** NPC 是否站在水里 / 出界 / NaN；物件是否悬空在水里。tilesBlocked 默认 ['w'] */
  const invariants = (blocked: string[] = BLOCKED) => {
    const s = sc(); const bad: Any[] = [];
    for (const [id, n] of Object.entries<Any>(s.npcs ?? {})) {
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) { bad.push({ k: 'npc-nan', id }); continue; }
      if (n.x < 0 || n.y < 0 || n.x > WORLD_W || n.y > WORLD_H) bad.push({ k: 'npc-out', id, x: round(n.x), y: round(n.y) });
      const ch = tileAt(n.x, n.y);
      if (blocked.includes(ch) && n.state !== 'hide') bad.push({ k: 'npc-blocked-tile', id, tile: ch, x: round(n.x), y: round(n.y), state: n.state });
    }
    for (const [id, p] of Object.entries<Any>(PROPS)) {
      const ch = tileAt(p.pos[0], p.pos[1]);
      if (blocked.includes(ch)) bad.push({ k: 'prop-on-blocked', id, tile: ch, pos: p.pos });
    }
    const h = s.hat;
    if (h && (!Number.isFinite(h.x) || h.x < 0 || h.y < 0 || h.x > WORLD_W || h.y > WORLD_H)) bad.push({ k: 'hat-out', x: h.x, y: h.y });
    return bad;
  };
  /** 同一屏内 NPC 堆叠（两人几乎重合） */
  const npcStacking = (eps = 0.25) => {
    const s = sc(); const ids = Object.keys(s.npcs ?? {}); const bad: Any[] = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = s.npcs[ids[i]], b = s.npcs[ids[j]];
      if (a.state === 'hide' || b.state === 'hide') continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) < eps) bad.push({ a: ids[i], b: ids[j], at: [round(a.x), round(a.y)] });
    }
    return bad;
  };

  // ———————————————— 性能 / 资源 ————————————————
  const resources = () => {
    const s = sc();
    const tex = game.textures;
    const keys: string[] = tex.getTextureKeys?.() ?? Object.keys(tex.list ?? {});
    let texBytes = 0;
    for (const k of keys) {
      const f = tex.get(k)?.getSourceImage?.();
      if (f && f.width && f.height) texBytes += f.width * f.height * 4;
    }
    const mem: Any = (performance as Any).memory;
    return {
      textures: keys.length, textureMB: round(texBytes / 1048576, 1),
      displayObjects: s?.children?.length ?? null, tweens: s?.tweens?.getTweens?.().length ?? null,
      particles: s?.parts?.length ?? null, timers: s?.time?._active?.length ?? null,
      jsHeapMB: mem ? round(mem.usedJSHeapSize / 1048576, 1) : null,
      gameFps: round(game.loop?.actualFps ?? 0, 1),
      renderer: game.renderer?.type === 2 ? 'WEBGL' : 'CANVAS',
      glRenderer: (() => { try { const gl = game.renderer.gl; const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : null; } catch { return null; } })(),
    };
  };
  /** 采样 secs 秒的 rAF 帧间隔（ms）。返回 fps、p50/p95/p99/max 以及 >50ms 的卡顿帧数 */
  const frameSample = (secs = 3) => new Promise<Any>((res) => {
    const ts: number[] = []; const t0 = performance.now();
    const step = (t: number) => {
      ts.push(t);
      if (t - t0 < secs * 1000) requestAnimationFrame(step);
      else {
        const d: number[] = []; for (let i = 1; i < ts.length; i++) d.push(ts[i] - ts[i - 1]);
        d.sort((a, b) => a - b);
        const q = (p: number) => d[Math.min(d.length - 1, Math.floor(d.length * p))] ?? 0;
        const total = ts[ts.length - 1] - ts[0];
        res({ frames: d.length, fps: round((d.length / total) * 1000, 1), p50: round(q(0.5), 1), p95: round(q(0.95), 1), p99: round(q(0.99), 1), max: round(d[d.length - 1] ?? 0, 1), jank50: d.filter((x) => x > 50).length });
      }
    };
    requestAnimationFrame(step);
  });

  // ———————————————— 触屏按钮尺寸 ————————————————
  /** 所有可交互控件的 CSS 像素尺寸（页面坐标，已含缩放），用于检查 ≥44px 触屏命中区 */
  const touchTargets = () => {
    const r = game.canvas.getBoundingClientRect();
    const kx = r.width / game.scale.gameSize.width, ky = r.height / game.scale.gameSize.height;
    return uiButtons().map((b) => ({ qa: b.qa, label: b.label.slice(0, 24), cssW: round(b.gw * kx, 1), cssH: round(b.gh * ky, 1) }));
  };

  const api = {
    version: 1,
    scene: sc, game,
    // 换算
    gameToPage, worldToPage, tileToPage, propPoint, npcPoint, groundPoint, tileAt, regionCenter,
    // 控件
    uiButtons, moveButton, uiHitAt, touchTargets,
    // 状态
    state, storyInfo, resources, frameSample, storageDump, readSave,
    // 动作（捷径）
    teleportHat, teleportToRegion, teleportNpc, advance, setSpeed, setPhase, setWarmth, runSequence, completeStep, useMove, clearCooldowns, resetSave,
    // 检测
    uiBlocks, overlaps, clippedTexts, textLeaks, visibleTexts, invariants, npcStacking,
    // 数据快照（供脚本读取，不必在 node 侧重复解析）
    data: () => ({ props: PROPS, npcs: Object.keys(NPCS), stories: STORIES, moves: MOVES, checklist: CHECKLIST, regions: REGIONS, phases: Object.keys((CFG as Any).phases ?? {}), world: { w: WORLD_W, h: WORLD_H, block: BLOCK } }),
  };
  (window as Any).__qa = api;
  // 场景可能尚未创建，等待后挂 phase 钩子
  const tryHook = () => { try { hookPhase(); } catch { /* ignore */ } if (!sc()?.__qaPhaseHooked) setTimeout(tryHook, 300); };
  tryHook();
  return api;
}

if (typeof window !== 'undefined' && (window as Any).__game && !(window as Any).__qa) installTestApi();
