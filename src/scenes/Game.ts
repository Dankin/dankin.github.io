import Phaser from 'phaser';
import { CFG, CHECKLIST, DECOR, MOVES, MECHS, NPCS, PROPS, WALLS, WORLD_W, WORLD_H, regionAt, StepDef, t, hasKey } from '../core/data';
import { bus } from '../core/bus';
import { audio } from '../core/audio';
import { OX, OY, VIEW_W, VIEW_H, clamp, lerp, lerpColor, rand, toScreen, toTile, dist } from '../core/iso';
import { PX, ART_SCALE, NATIVE_SCALE } from '../art/scale';
import { StimulusSystem } from '../core/stimulus';
import { StoryManager, StoryHost } from '../core/story';
import { Sequencer, SeqHost } from '../core/sequencer';
import { Npc, NpcHost, NPC_K, condOk } from '../entities/Npc';
import { Hat } from '../entities/Hat';
import { MechSystem } from '../entities/Mech';
import { clearEntities, registerEntity, allFlags, loadFlags, clearFlags, moveAllowed, applyMoveEffects } from '../entities/registry';
import { resetNav } from '../entities/nav';
import { FxSystem, FxProp } from '../fx';
import { Bubbles, LayerLike, mkText } from '../ui/bubble';
import { Hud } from '../ui/hud';
import { Minimap } from '../ui/minimap';
import { L, relayout, toUi } from '../ui/layout';
import { CameraRig } from './camrig';
import { Culler } from './cull';
import {
  SaveData, blankSave, loadSave, writeSave, clearSave, loadSettings, saveSettings,
  exportText, importText, downloadSave, pickTextFile,
} from '../core/save';
import type { GroundChunk } from './Boot';

type PropEnt = FxProp;
interface PhaseVals { tint: number; rain: number; snow: number; glow: number; wind: number }

const hex = (s: string) => Phaser.Display.Color.HexStringToColor(s).color;
const parsePhase = (id: string): PhaseVals => { const p = CFG.phases[id] ?? CFG.phases[CFG.startPhase]; return { tint: hex(p.tint), rain: p.rain, snow: p.snow, glow: p.glow, wind: p.wind ?? 0 }; };
/** 墙贴图常量（art-world：ne 起点在左上，nw 以右端为起点；单位为 1x 美术像素，乘 PX 得屏幕像素） */
const WALL_AX = { ne: 0, nw: 160 } as const, WALL_AY = 110;
const LOD_MARGIN = 420;     // NPC/机关 LOD：视野外扩（约 6 格）
const AUTOSAVE_SECS = 12;

export class GameScene extends Phaser.Scene implements NpcHost, StoryHost, SeqHost {
  now = 0; locked = false; stim = new StimulusSystem();
  started = false; debugOn = false;
  hud!: Hud; bubbles!: Bubbles; hat!: Hat; stories!: StoryManager; seq!: Sequencer; fx!: FxSystem; mechs!: MechSystem; minimap!: Minimap;
  rig!: CameraRig;
  npcs: Record<string, Npc> = {};
  props: Record<string, PropEnt> = {};
  warmth = 0;
  region = '';
  phaseId = 'morning';
  playSecs = 0;
  cd: Record<string, number> = {};
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private W!: LayerLike; private U!: LayerLike;
  private cur: PhaseVals = parsePhase('morning');
  private phaseAnim?: { t: number; dur: number; from: PhaseVals; to: PhaseVals };
  private tint!: Phaser.GameObjects.Rectangle;
  private snowImgs: Phaser.GameObjects.Image[] = [];
  private winGlows: Phaser.GameObjects.Image[] = [];
  private rain: { x: number; y: number; v: number; im: Phaser.GameObjects.Image }[] = [];
  private flakes: { x: number; y: number; v: number; r: number; ph: number; im: Phaser.GameObjects.Image }[] = [];
  private focusFn: (() => { x: number; y: number }) | null = null; private focusZ = 1;
  private hintTarget: PropEnt | null = null; private hintMove: string | null = null;
  private arrow!: Phaser.GameObjects.Image;
  private hlCur: string | null = null;
  private noPersonT = 0;
  private dbgG!: Phaser.GameObjects.Graphics; private dbgTexts: Phaser.GameObjects.Text[] = [];
  private pendingProp: string | null = null;
  private culler = new Culler();
  private view = new Phaser.Geom.Rectangle();
  private tScale = 1; private tScaleTo = 1; private tRamp = 0;
  private sub?: Phaser.GameObjects.Text; private subT = 0;
  private possessed = new Set<string>(); private eggs = new Set<string>();
  private saveT = 0; private saveDirty = false;
  private gesture = { id: -1, x: 0, y: 0, t: 0, ui: false, moved: false, pinch: false };
  private pinchD = 0; private pinchZ = 1;
  private onVis = () => { if (document.hidden) this.saveNow(); };
  private onResize = () => this.relayoutUi();
  private zoomSaveT = 0;

  constructor() { super('game'); }

  // ———————————————— 初始化 ————————————————
  create() {
    bus.clear(); clearEntities(); clearFlags(); resetNav();
    this.now = 0; this.locked = false; this.started = false; this.warmth = 0; this.playSecs = 0;
    this.cd = {}; this.winGlows = []; this.snowImgs = []; this.possessed.clear(); this.eggs.clear();
    this.focusFn = null; this.region = ''; this.hintTarget = null; this.hintMove = null; this.pendingProp = null;
    this.tScale = this.tScaleTo = 1; this.culler = new Culler(); this.saveT = 0; this.saveDirty = false;
    this.phaseId = CFG.startPhase; this.cur = parsePhase(this.phaseId); this.phaseAnim = undefined;
    relayout(this.scale);

    this.uiCam = this.cameras.add(0, 0, VIEW_W, VIEW_H);
    this.W = { add: (o) => { this.uiCam.ignore(o); } };
    this.U = { add: (o) => { this.cameras.main.ignore(o); } };
    const w = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.W.add(o); return o; };

    const bounds = { x0: toScreen(0, WORLD_H).x - 96, x1: toScreen(WORLD_W, 0).x + 96, y0: OY - 150, y1: toScreen(WORLD_W, WORLD_H).y + 70 };
    this.rig = new CameraRig(this.cameras.main, bounds);
    const set = loadSettings(); if (set.zoom) this.rig.setUserZoom(set.zoom);

    // 背景（不随相机滚动；放大到覆盖最小缩放时的可视范围）
    w(this.add.image(VIEW_W / 2, VIEW_H / 2, 'backdrop').setDisplaySize(VIEW_W * 1.7, VIEW_H * 1.7).setDepth(-100).setScrollFactor(0));

    // 地面切块（雪层叠加）
    const gc = this.registry.get('groundChunks') as { ground: GroundChunk[]; ground_snow: GroundChunk[] };
    gc.ground.forEach((c, i) => {
      const g = w(this.add.image(c.x, c.y, c.key).setOrigin(0).setDisplaySize(c.w, c.h).setDepth(-50));
      const sc = gc.ground_snow[i];
      const objs: Phaser.GameObjects.Image[] = [g];
      if (sc) { const s = w(this.add.image(sc.x, sc.y, sc.key).setOrigin(0).setDisplaySize(sc.w, sc.h).setDepth(-49).setAlpha(0)); this.snowImgs.push(s); objs.push(s); }
      this.culler.add(objs, c.x + c.w / 2, c.y + c.h / 2, c.w / 2, c.h / 2);
    });

    // 墙立面（每区块多段）
    for (const wp of WALLS) {
      const key = `wall_${wp.side}_${wp.v}`; if (!this.textures.exists(key)) continue;
      const o = toScreen(wp.tx, wp.ty);
      const img = w(this.add.image(o.x - WALL_AX[wp.side] * PX, o.y - WALL_AY * PX, key).setOrigin(0).setScale(ART_SCALE).setDepth(-40 + o.y * 0.0001));
      const objs: Phaser.GameObjects.Image[] = [img];
      const wins = (this.registry.get(`windows_${wp.side}_${wp.v}`) ?? []) as { x: number; y: number; lit: boolean }[];
      for (const p of wins) if (p.lit) objs.push(this.addWinGlow(img.x + p.x * PX, img.y + p.y * PX));
      this.culler.add(objs, img.x + img.displayWidth / 2, img.y + img.displayHeight / 2, img.displayWidth / 2 + 20, img.displayHeight / 2 + 20);
    }

    // 装饰物
    DECOR.forEach((d) => {
      const s = toScreen(d.pos[0], d.pos[1]);
      const k = (d.scale ?? 1);
      const sh = w(this.add.image(s.x, s.y + 4, 'p_shadow').setScale(0.9 * k * NATIVE_SCALE, 0.7 * k * NATIVE_SCALE).setAlpha(0.35).setDepth(s.y - 1));
      const spr = w(this.add.image(s.x, s.y + 2, 'p_' + d.tex).setOrigin(0.5, 1).setScale(ART_SCALE * k).setDepth(s.y));
      this.culler.add([sh, spr], s.x, s.y - spr.displayHeight / 2, spr.displayWidth / 2 + 20, spr.displayHeight / 2 + 20);
    });

    // 可附身物件 + 特效系统
    this.fx = new FxSystem({
      scene: this, W: this.W, props: this.props, stim: this.stim,
      now: () => this.now, toast: (s, secs) => this.hud.toast(s, secs),
      bubble: (key, anchor, text, secs) => this.bubbles.show(key, anchor, text, secs),
      crowdNear: (x, y, r) => this.crowdNear(x, y, r),
      crowdMembers: (x, y, r) => Object.values(this.npcs).filter((n) => n.def.crowd && n.state !== 'hide' && !n.ghost && dist(n.x, n.y, x, y) < r).map((n) => ({ id: n.id, x: n.x, y: n.y, sx: n.spr.x, sy: n.spr.y })),
      completeCheck: (id) => this.completeCheck(id),
      shake: (ms, amp) => this.cameras.main.shake(ms, amp),
      hat: undefined,
    });
    for (const [id, def] of Object.entries(PROPS)) this.props[id] = this.makeProp(id, def);

    // NPC / 帽子 / 机关
    for (const id of Object.keys(NPCS)) this.npcs[id] = new Npc(this, this, id, this.W);
    this.hat = new Hat(this, this.W, CFG.hatStart[0], CFG.hatStart[1]);
    this.fx.host.hat = this.hat as any;
    registerEntity('hat', () => ({ x: this.hat.x, y: this.hat.y }));
    this.mechs = new MechSystem(this, this.W, this, MECHS as any);
    this.fx.wire(); this.refreshProps();

    this.bubbles = new Bubbles(this, this.U, (x, y) => this.toScr(x, y), () => this.hud.obstacles());
    this.arrow = w(this.add.image(0, 0, 'p_arrow').setScale(ART_SCALE).setDepth(9200).setVisible(false));

    // 昼夜遮罩 + 天气
    this.tint = w(this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W * 3, VIEW_H * 3, 0xffffff).setDepth(9000).setScrollFactor(0).setBlendMode(Phaser.BlendModes.MULTIPLY));
    if (!this.textures.exists('dc_rain')) {
      const c = this.textures.createCanvas('dc_rain', 4, 16)!; const cx = c.getContext(); cx.strokeStyle = '#dfe8f2'; cx.lineWidth = 1.6; cx.beginPath(); cx.moveTo(3.2, 0.5); cx.lineTo(0.8, 15.5); cx.stroke(); c.refresh();
      const f = this.textures.createCanvas('dc_flake', 8, 8)!; const fx = f.getContext(); const gr = fx.createRadialGradient(4, 4, 0, 4, 4, 4); gr.addColorStop(0, '#fff'); gr.addColorStop(0.6, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); fx.fillStyle = gr; fx.fillRect(0, 0, 8, 8); f.refresh();
    }
    for (let i = 0; i < 150; i++) { const im = this.add.image(0, 0, 'dc_rain').setOrigin(0.5, 1).setVisible(false).setDepth(50); this.U.add(im); this.rain.push({ x: rand(0, VIEW_W), y: rand(0, VIEW_H), v: rand(520, 760), im }); }
    for (let i = 0; i < 90; i++) { const r = rand(1.2, 2.8); const im = this.add.image(0, 0, 'dc_flake').setScale(r / 3.2).setVisible(false).setDepth(50); this.U.add(im); this.flakes.push({ x: rand(0, VIEW_W), y: rand(0, VIEW_H), v: rand(26, 60), r, ph: rand(0, 6), im }); }

    // 逻辑系统 + UI
    this.stories = new StoryManager(this);
    this.seq = new Sequencer(this);
    this.hud = new Hud(this, this.U, {
      onMute: () => { audio.setMuted(!audio.muted); saveSettings({ ...loadSettings(), muted: audio.muted }); return audio.muted; },
      onDebug: () => { this.debugOn = !this.debugOn; this.dbgG.clear(); this.dbgTexts.forEach((x) => x.setVisible(this.debugOn)); },
      onRecenter: () => { this.rig.follow = true; },
      onZoomReset: () => { this.rig.setUserZoom(1); this.rig.follow = true; },
      onFullscreen: () => { if (this.scale.isFullscreen) this.scale.stopFullscreen(); else this.scale.startFullscreen(); },
      onExport: () => { downloadSave(this.collect()); this.hud.notice(t('ui.exported')); },
      onImport: () => { void this.importFile(); },
      onNewGame: () => this.hud.confirm(tx('ui.confirm_new', '开始新游戏？当前进度会被清除。'), () => this.restart('new')),
    });
    this.hud.setMuted(set.muted); audio.setMuted(set.muted);
    this.minimap = new Minimap(this, this.U, (tx, ty) => { this.release(); this.rig.follow = true; this.hat.flyTo(clamp(tx, 0.5, WORLD_W - 0.5), clamp(ty, 0.5, WORLD_H - 0.5), 24); });
    this.minimap.setHidden(true);
    this.hud.setExtraObstacles(() => { const r = this.minimap.rect(); return r ? [r] : []; });
    this.dbgG = this.add.graphics().setDepth(9800); this.W.add(this.dbgG);
    Object.keys(NPCS).forEach(() => { const x = mkText(this, 0, 0, '', 11, '#00ff88').setDepth(9801).setVisible(false); this.W.add(x); this.dbgTexts.push(x); });
    this.applyPhase(this.cur);
    this.relayoutUi();

    { const hs = this.hat.screen; this.rig.snap(hs.x, hs.y); }
    this.cullNow(true);

    this.wireEvents();
    this.input.addPointer(1);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => this.onDown(p, over));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => { this.rig.setUserZoom(this.rig.userZ * (dy > 0 ? 0.9 : 1.1)); this.zoomSaveT = 1; });
    this.input.keyboard?.on('keydown-F', () => { if (this.debugOn && !this.seq.running) this.runSequence('xiaomi_finale'); });
    this.scale.on('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVis); window.addEventListener('pagehide', this.onVis);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize); document.removeEventListener('visibilitychange', this.onVis); window.removeEventListener('pagehide', this.onVis);
      Object.values(this.npcs).forEach((n) => (n as any).destroy?.()); this.mechs.destroy(); this.seq.dispose(); clearEntities();
    });

    // 标题 / 自动开始
    const auto = this.registry.get('autostart') as 'new' | 'continue' | undefined; this.registry.remove('autostart');
    const ls = loadSave();
    if (auto === 'new') { clearSave(); this.begin(null); }
    else if (auto === 'continue' && ls.ok) this.begin(ls.data);
    else {
      this.hud.title(
        { hasSave: ls.ok, summary: ls.ok ? this.summaryOf(ls.data) : undefined, corrupt: !ls.ok && ls.reason === 'corrupt' },
        {
          onNew: () => { clearSave(); this.begin(null); },
          onContinue: () => this.begin(ls.ok ? ls.data : null),
          onImport: () => { void this.importFile(); },
        },
      );
    }
  }

  private summaryOf(d: SaveData) { return `${Math.max(1, Math.round(d.playSecs / 60))} min · ♥ ${Math.round(d.warmth)} · ${d.checklist.length}/${CHECKLIST.length}`; }

  /** 开始游戏：data=null 为新游戏，否则读档 */
  private begin(data: SaveData | null) {
    audio.unlock(); audio.resetProgress();
    if (data) this.applySave(data);
    this.started = true; this.stories.lastProgress = this.now;
    this.minimap.setHidden(false);
    const r = regionAt(this.hat.x, this.hat.y); this.region = r?.id ?? ''; audio.setRegion(r?.id ?? null);
    if (data) this.hud.hideHelp();
    this.saveNow();
  }

  private restart(mode: 'new' | 'continue') {
    if (mode === 'new') clearSave();
    this.registry.set('autostart', mode);
    this.scene.restart();
  }

  private async importFile() {
    const txt = await pickTextFile(); if (txt === null) return;
    const r = txt ? importText(txt) : ({ ok: false, error: 'empty' } as const);
    if (!r.ok) { this.hud.notice(tx('ui.import_fail', '存档文件无法识别')); return; }
    writeSave(r.data); this.restart('continue');
  }

  // ———————————————— 存档 ————————————————
  collect(): SaveData {
    const d = blankSave();
    d.playSecs = this.playSecs; d.stories = this.stories.serialize(); d.checklist = [...this.hud.done];
    d.warmth = this.warmth; d.hat = { stage: (this.hat as any).stage ?? 0, x: this.hat.x, y: this.hat.y };
    d.possessed = [...this.possessed]; d.phase = this.phaseId; d.eggs = [...this.eggs];
    d.uses = Object.fromEntries(Object.values(this.props).map((p) => [p.id, p.uses]).filter(([, n]) => (n as number) > 0));
    d.extra = { flags: allFlags() };
    return d;
  }
  saveNow() { if (!this.started) return; this.saveDirty = false; writeSave(this.collect()); }
  private applySave(d: SaveData) {
    this.stories.load(d.stories as any);
    for (const [id, st] of Object.entries(d.stories)) if (st.finished) audio.storyDone(id);
    this.hud.setDone(d.checklist);
    this.warmth = d.warmth; this.hud.setWarmth(d.warmth); audio.setWarmth(d.warmth); this.hat.glowLevel = 0.2 + d.warmth * 0.006;
    this.hat.setStage(d.hat.stage);
    if (isFinite(d.hat.x) && isFinite(d.hat.y)) { const h = this.hat as any; h.x = h.tx = clamp(d.hat.x, 0.5, WORLD_W - 0.5); h.y = h.ty = clamp(d.hat.y, 0.5, WORLD_H - 0.5); }
    d.possessed.forEach((p) => this.possessed.add(p)); d.eggs.forEach((e) => this.eggs.add(e));
    for (const [id, n] of Object.entries(d.uses)) if (this.props[id]) this.props[id].uses = n;
    const fl = (d.extra as any)?.flags; if (fl && typeof fl === 'object') loadFlags(fl);
    this.playSecs = d.playSecs;
    if (d.phase && CFG.phases[d.phase]) { this.phaseId = d.phase; this.cur = parsePhase(d.phase); this.applyPhase(this.cur); }
    this.refreshProps();
    const hs = this.hat.screen; this.rig.snap(hs.x, hs.y); this.cullNow(true);
  }

  // ———————————————— 布局（UI 缩放 / 小地图） ————————————————
  private relayoutUi() {
    relayout(this.scale);
    this.uiCam.setZoom(L.z).centerOn(VIEW_W / 2, VIEW_H / 2);
    this.hud.relayout();
    this.minimap.layout(this.hud.rightTop);
  }

  private addWinGlow(x: number, y: number) {
    const g = this.add.image(x, y, 'p_glow').setScale(0.42 * NATIVE_SCALE * 3).setTint(0xffc66b).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(9100);
    this.W.add(g); this.winGlows.push(g); return g;
  }

  /** E2：道具按 when{phase,flag,notFlag} 显隐、texIf 按 flag 换贴图 */
  private refreshProps() {
    for (const p of Object.values(this.props)) {
      const d = p.def as any;
      if (d.when) {
        const on = condOk(d.when, this.phaseId); const off = !on;
        if ((p as any).off !== off) { (p as any).off = off; p.spr.setAlpha(off ? 0 : 1); p.sh.setAlpha(off ? 0 : 0.35); if (off && this.hat.attachedTo === p.id) this.release(); }
      }
      if (d.texIf) {
        const hit = (d.texIf as { flag: string; tex: string }[]).find((r) => condOk({ flag: r.flag }, this.phaseId));
        const want = 'p_' + (hit ? hit.tex : d.tex);
        if (this.textures.exists(want) && p.spr.texture.key !== want) p.spr.setTexture(want);
      }
    }
  }

  private makeProp(id: string, def: any): PropEnt {
    const s = toScreen(def.pos[0], def.pos[1]);
    const sh = this.add.image(s.x, s.y + 2, 'p_shadow').setScale((def.tex === 'tree' ? 1.2 : 0.8) * NATIVE_SCALE, 0.7 * NATIVE_SCALE).setAlpha(0.35).setDepth(s.y - 1);
    const spr = this.add.image(s.x, s.y + 2, 'p_' + def.tex).setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(s.y);
    this.W.add(sh); this.W.add(spr);
    const e: PropEnt = { id, def, x: def.pos[0], y: def.pos[1], sx: s.x, sy: s.y, top: spr.displayHeight, spr, sh, uses: 0, pose: 0, pulse: 0 };
    this.fx.rigProp(e);
    registerEntity('prop:' + id, () => ({ x: e.x, y: e.y }));
    const extra = [e.tubes, e.lamp, e.lights].filter(Boolean) as Phaser.GameObjects.Image[];
    this.culler.add([sh, spr, ...extra], s.x, s.y - spr.displayHeight / 2, spr.displayWidth / 2 + 60, spr.displayHeight / 2 + 60);
    return e;
  }

  private wireEvents() {
    bus.on('story:step', () => { this.addWarmth(8); this.saveDirty = true; });
    bus.on('story:done', (id: string) => { audio.storyDone(id); this.saveNow(); });
    bus.on('story:unlock', (id: string) => { audio.storyMotif(id); });
    bus.on('xiaomi_sung', () => this.completeCheck('xiaomi_sung'));
    bus.on('kids_chased_balloon', () => this.completeCheck('kids_chased_balloon'));
    bus.on('egg', (id: string) => { if (!this.eggs.has(id)) { this.eggs.add(id); this.saveDirty = true; } });
    bus.on('cam:to', (o: { x?: number; y?: number; zoom?: number; target?: string }) => {
      this.focusZ = o.zoom ?? 1;
      if (o.target === 'hat') this.focusFn = () => this.hat.screen;
      else if (o.target && this.npcs[o.target]) { const n = this.npcs[o.target]; this.focusFn = () => ({ x: n.spr.x, y: n.spr.y - 40 }); }
      else if (o.x !== undefined && o.y !== undefined) { const p = toScreen(o.x, o.y); this.focusFn = () => p; }
      else this.focusFn = () => ({ x: this.rig.cx, y: this.rig.cy });
    });
    bus.on('cam:release', () => { this.focusFn = null; this.rig.focus = null; this.rig.follow = true; });
    bus.on('cam:shake', (o: { k?: number; ms?: number }) => this.cameras.main.shake(o?.ms ?? 300, clamp(o?.k ?? 0.4, 0, 1) * 0.008));
    bus.on('time:scale', (o: { k: number; ramp?: number }) => { this.tScaleTo = clamp(o?.k ?? 1, 0.1, 2); this.tRamp = Math.max(0.01, o?.ramp ?? 0.4); });
    bus.on('weather', (o: { snow?: number; rain?: number; s?: number }) => {
      const to = { ...this.cur }; if (o.snow !== undefined) to.snow = clamp(o.snow, 0, 1); if (o.rain !== undefined) to.rain = clamp(o.rain, 0, 1);
      this.phaseAnim = { t: 0, dur: Math.max(0.01, o.s ?? 2), from: { ...this.cur }, to: { ...this.cur, snow: to.snow, rain: to.rain } };
    });
    bus.on('flag', () => this.refreshProps());
    bus.on('subtitle', (o: { text: string; dur?: number; style?: string }) => this.showSubtitle(o));
    bus.on('audio:cue', (cue: string, arg?: unknown) => { (audio as any).cue?.(cue, arg); });
  }

  private showSubtitle(o: { text: string; dur?: number; style?: string }) {
    if (!o?.text) return;
    const txt = hasKey(o.text) ? (t(o.text) as unknown as string) : o.text;
    const size = o.style === 'final' ? 34 : o.style === 'big' ? 28 : 20;
    if (!this.sub) { this.sub = mkText(this, 0, 0, '', size, '#fff6dc', { align: 'center', stroke: '#2a1f33', strokeThickness: 4, wordWrap: { width: 900 } }).setOrigin(0.5).setDepth(9700); this.U.add(this.sub); }
    const letter = o.style === 'letter';
    this.sub.setFontSize(letter ? 22 : size).setText(txt).setAlpha(1).setVisible(true);
    if (letter) this.sub.setColor('#4a3322').setStroke('#fff3d6', 0).setBackgroundColor('#f6e7c1').setPadding(24, 16, 24, 16).setFontFamily('"Kaiti SC","STKaiti","KaiTi",serif');
    else this.sub.setColor('#fff6dc').setStroke('#2a1f33', 4).setBackgroundColor('').setPadding(0, 0, 0, 0);
    this.sub.setPosition(L.x0 + L.w / 2, o.style === 'final' ? L.y0 + L.h * 0.5 : L.y0 + L.h - 80);
    this.subT = Math.max(1, o.dur ?? 3);
    (audio as any).duck?.(2500);
  }

  // ———————————————— 通用小工具 ————————————————
  sleep(s: number) { return new Promise<void>((r) => this.time.delayedCall(s * 1000, r)); }
  say(npc: Npc, text: string, dur = 3) { this.bubbles.show(npc.id, () => npc.anchor, text, dur); }
  emote(npc: Npc, e: string) { this.bubbles.emote(() => npc.anchor, e); }
  sparkle(x: number, y: number) { this.fx.sparkle(x, y); }
  sparkleBurst(x: number, y: number, n = 10, color = 0xffe08a) { this.fx.sparkleBurst(x, y, n, color); }
  ring(x: number, y: number, color = 0xffffff, to = 2.4) { this.fx.ring(x, y, color, to); }
  notes(x: number, y: number, n = 3) { this.fx.notes(x, y, n); }
  hearts(x: number, y: number, n = 3) { this.fx.hearts(x, y, n); }
  npc(id: string) { return this.npcs[id]; }
  runSequence(id: string) { return this.seq.run(id); }
  crowdNear(x: number, y: number, r: number) { let c = 0; for (const n of Object.values(this.npcs)) if (n.def.crowd && n.state !== 'hide' && !n.ghost && dist(n.x, n.y, x, y) < r) c++; return c; }

  addWarmth(n: number) {
    this.warmth = clamp(this.warmth + n, 0, 100); this.hud.setWarmth(this.warmth); audio.setWarmth(this.warmth);
    this.hat.glowLevel = 0.2 + this.warmth * 0.006;
    if (n >= 6) audio.sfx('warm');
  }
  completeCheck(id: string) {
    if (!this.hud.complete(id)) return;
    const it = CHECKLIST.find((c) => c.id === id); if (!it) return;
    if (it.points) this.addWarmth(it.points);
    if (!it.main) { this.hud.toast('☑ ' + t(it.text), 3.2); audio.sfx('sparkle'); }
    const hs = this.hat.screen; this.sparkleBurst(hs.x, hs.y, 12);
    this.saveNow();
  }

  // SeqHost
  setLock(on: boolean) { this.locked = on; if (on) { this.hud.hidePanel(); this.hat.attachedTo = null; this.hat.arrivedCb = undefined; } }
  camFocus(npcId: string | null, zoom: number, _s: number) {
    if (!npcId) { this.focusFn = null; this.rig.focus = null; return; }
    const n = this.npcs[npcId]; this.focusZ = zoom; this.focusFn = () => ({ x: n.spr.x, y: n.spr.y - 40 });
  }
  /** 世界像素 → UI 空间（气泡/面板用） */
  toScr(x: number, y: number) {
    const r = this.rig;
    return toUi((x - r.cx) * r.z + VIEW_W / 2, (y - r.cy) * r.z + VIEW_H / 2);
  }
  crowd(mode: string, hearts: boolean, around?: string) {
    const an = around ? (this.npcs[around] ?? this.props[around]) : undefined;
    const c = an ? { x: an.x, y: an.y } : { x: this.hat.x, y: this.hat.y };
    const slots = [[-1.3, 0.9], [1.4, 1], [1.7, -0.5], [-1.6, -0.4]];
    let i = 0;
    for (const n of Object.values(this.npcs)) {
      if (!n.def.crowd) continue;
      if (mode === 'gather') {
        const sl = slots[i++ % slots.length]; n.noReact = true; n.hearts = false;
        void n.scriptWalk(clamp(c.x + sl[0], 0.5, WORLD_W - 0.5), clamp(c.y + sl[1], 0.5, WORLD_H - 0.5)).then(() => { n.scriptFace = { x: c.x, y: c.y }; });
      } else if (mode === 'listen') { n.scriptFace = { x: c.x, y: c.y }; n.hearts = hearts; }
      else { n.noReact = false; n.hearts = false; n.scriptFace = undefined; n.scriptDest = undefined; n.setState('idle'); }
    }
  }
  setPhase(id: string, s: number) {
    if (!CFG.phases[id]) return;
    this.phaseId = id; bus.emit('phase', id); this.refreshProps(); this.phaseAnim = { t: 0, dur: Math.max(0.01, s), from: { ...this.cur }, to: parsePhase(id) }; this.saveDirty = true;
  }
  sing(npcId: string, secs: number) {
    const n = this.npcs[npcId]; if (!n) return;
    n.setState('sing'); n.singUntil = this.now + secs; audio.theme(true); this.time.delayedCall(7500, () => audio.setLayer(1));
  }
  hatStage(n: number) {
    this.hat.setStage(n); const hs = this.hat.screen;
    this.sparkleBurst(hs.x, hs.y, 22, 0xfff0b0); this.ring(hs.x, hs.y + 10, 0xffe9a8, 3); audio.sfx('warm');
    this.hud.toast(t('ui.hat_stage' + n), 4); this.saveNow();
  }
  banner(key: string) {
    this.hud.banner(t(key));
    if (key === 'banner.done') this.time.delayedCall(6200, () => this.hud.endPanel(() => undefined, () => this.restart('new')));
  }
  showHint(tier: number, step: StepDef) {
    const h = (step as any).hint; if (!h) return;
    this.hud.toast(t(h.t[Math.min(tier, 2)]), 5.5);
    this.hintTarget = tier >= 1 ? this.props[h.prop] ?? null : null; this.hintMove = tier >= 2 ? h.move : null;
  }
  clearHint() { this.hintTarget = null; this.hintMove = null; this.arrow.setVisible(false); }

  // ———————————————— 输入：点按 / 拖动平移 / 双指缩放 ————————————————
  private onDown(p: Phaser.Input.Pointer, over: unknown[]) {
    audio.unlock();
    const g = this.gesture;
    if (g.id < 0 || !this.input.activePointer.isDown) { g.id = p.id; g.x = p.x; g.y = p.y; g.t = performance.now(); g.ui = over.length > 0; g.moved = false; g.pinch = false; this.pinchD = 0; }
  }
  private onMove(p: Phaser.Input.Pointer) {
    const g = this.gesture; if (g.id < 0) return;
    const p1 = this.input.pointer1, p2 = this.input.pointer2;
    if (p1.isDown && p2.isDown && !g.ui) {
      const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      if (!this.pinchD) { this.pinchD = d; this.pinchZ = this.rig.userZ; } else { this.rig.setUserZoom(this.pinchZ * d / this.pinchD); this.zoomSaveT = 1; }
      g.pinch = true; g.moved = true; return;
    }
    if (g.ui || !p.isDown || p.id !== g.id || g.pinch) return;
    if (!g.moved && Phaser.Math.Distance.Between(p.x, p.y, g.x, g.y) > 10) g.moved = true;
    if (g.moved && !this.rig.focus) this.rig.panByScreen(p.x - p.prevPosition.x, p.y - p.prevPosition.y);
  }
  private onUp(p: Phaser.Input.Pointer) {
    const g = this.gesture;
    if (p.id !== g.id) return;
    const ok = !g.ui && !g.moved && !g.pinch && performance.now() - g.t < 700;
    if (!this.input.pointer1.isDown && !this.input.pointer2.isDown) { g.id = -1; this.pinchD = 0; }
    if (ok) this.onTap(p);
  }

  private onTap(p: Phaser.Input.Pointer) {
    if (!this.started || this.locked) return;
    const pt = this.cameras.main.getWorldPoint(p.x, p.y);
    const hits = Object.values(this.props).sort((a, b) => b.sy - a.sy);
    for (const pr of hits) {
      if ((pr as any).off) continue;
      const hw = pr.def.hit[0], hh = pr.def.hit[1];
      if (Math.abs(pt.x - pr.sx) <= hw / 2 + 6 && pt.y <= pr.sy + 6 && pt.y >= pr.sy - hh - 6) { this.possess(pr.id); return; }
    }
    for (const n of Object.values(this.npcs)) {
      if (n.state === 'hide' || n.ghost || !n.spr.visible) continue;
      if (Math.abs(pt.x - n.spr.x) < 22 * NPC_K && pt.y < n.spr.y + 4 && pt.y > n.spr.y - 60 * NPC_K) {
        if (this.now > this.noPersonT) { this.hud.toast(t('ui.no_person'), 3.6); this.noPersonT = this.now + 4; }
        this.hat.shake = 0.4; audio.sfx('clank'); return;
      }
    }
    this.release();
    const tl = toTile(pt.x, pt.y);
    this.rig.follow = true;
    this.hat.flyTo(clamp(tl.x, 0.5, WORLD_W - 0.5), clamp(tl.y, 0.5, WORLD_H - 0.5), 24);
    this.ring(pt.x, pt.y, 0xffffff, 1.0);
  }

  private release() {
    if (this.hat.attachedTo || this.pendingProp) {
      audio.sfx('release'); const hs = this.hat.screen; this.ring(hs.x, hs.y + 6, 0xffe9a8, 1.6);
    }
    this.hat.attachedTo = null; this.pendingProp = null; this.hud.hidePanel(); this.hlCur = null;
  }

  private possess(id: string) {
    const p = this.props[id]; if (!p) return;
    this.pendingProp = id; this.rig.follow = true;
    this.hat.flyTo(p.x, p.y, p.top + 8, () => {
      if (this.pendingProp !== id) return;
      this.hat.attachedTo = id; this.possessed.add(id); this.saveDirty = true;
      this.ring(p.sx, p.sy - p.top * 0.5, 0xfff0b0, 1.6);
      const hs = this.hat.screen; this.sparkleBurst(hs.x, hs.y, 10);
      this.hud.hideHelp();
      const moves = p.def.moves.map((m: string) => ({ id: m, icon: MOVES[m].icon, label: t(MOVES[m].label) }));
      const pa = this.panelAnchor(p);
      this.hud.showPanel(t(p.def.name), moves, pa.x, pa.y, (m) => this.useMove(id, m));
    });
    audio.sfx('possess');
  }

  private panelAnchor(p: PropEnt) {
    const top = this.toScr(p.sx, p.sy - p.top), bot = this.toScr(p.sx, p.sy);
    return top.y - 40 < L.y0 + 130 ? { x: bot.x, y: bot.y + 64 } : { x: top.x, y: top.y - 40 };
  }

  private useMove(propId: string, moveId: string) {
    if (this.locked) return;
    const p = this.props[propId], mv = MOVES[moveId]; if (!p || !mv) return;
    const key = `${propId}:${moveId}`;
    if (this.now < (this.cd[key] ?? 0)) { this.hud.toast(t('ui.cooling'), 1.2); return; }
    const al = moveAllowed(mv as any);
    if (!al.ok) { if (al.failSay) this.hud.toast(t(al.failSay), 3.2); else this.hud.toast(t('ui.cooling'), 1.2); return; }
    this.cd[key] = this.now + mv.cooldown;
    const s = this.stim.emit(mv, p.x, p.y, propId, this.now);
    if (mv.sfx) audio.sfx(mv.sfx);
    const k = ART_SCALE;
    p.spr.setScale(k * 0.925, k * 1.175); this.tweens.add({ targets: p.spr, scaleX: k, scaleY: k, duration: 320, ease: 'Back.Out' });
    this.fx.play(mv.fx, p, s, mv);
    if (mv.event) bus.emit(mv.event);
    const pick = applyMoveEffects(mv as any);
    if (pick) {
      if (pick.say) this.hud.toast(t(pick.say), 3.2);
      if (pick.fx) this.fx.play(pick.fx, p, s, mv);
      if (pick.event) bus.emit(pick.event);
    }
    if (!s.sustained) for (const n of Object.values(this.npcs)) n.perceive(s, this.now);
    this.stories.onStimulus(s);
    this.saveDirty = true;
  }

  // ———————————————— 昼夜 / 天气 ————————————————
  private applyPhase(v: PhaseVals) {
    this.tint.setFillStyle(v.tint);
    this.snowImgs.forEach((s) => s.setAlpha(clamp(v.snow * 1.2, 0, 1)));
    this.stim.weather = v.rain > 0.5 ? 'rain' : v.snow > 0.5 ? 'snow' : 'clear';
    audio.setWeather({ rain: v.rain, snow: v.snow, wind: v.wind });
  }

  private updatePhase(dt: number) {
    const a = this.phaseAnim;
    if (a) {
      a.t += dt; const k = clamp(a.t / a.dur, 0, 1);
      this.cur = { tint: lerpColor(a.from.tint, a.to.tint, k), rain: lerp(a.from.rain, a.to.rain, k), snow: lerp(a.from.snow, a.to.snow, k), glow: lerp(a.from.glow, a.to.glow, k), wind: lerp(a.from.wind, a.to.wind, k) };
      this.applyPhase(this.cur);
      if (k >= 1) this.phaseAnim = undefined;
    }
    const v = this.cur;
    for (let i = 0; i < this.winGlows.length; i++) this.winGlows[i].setAlpha(v.glow * (0.55 + 0.08 * Math.sin(this.now * 1.7 + i * 2.1)));
    const x0 = L.x0, y0 = L.y0, x1 = L.x0 + L.w, y1 = L.y0 + L.h, W = L.w;
    const nr = v.rain > 0.02 ? Math.floor(this.rain.length * Math.min(1, v.rain + 0.2)) : 0;
    for (let i = 0; i < this.rain.length; i++) {
      const r = this.rain[i];
      if (i >= nr) { if (r.im.visible) r.im.setVisible(false); continue; }
      r.y += r.v * dt; r.x -= r.v * 0.18 * dt;
      if (r.y > y1 + 8 || r.y < y0 - 8) { r.y = y0 - 8 + rand(0, 12); r.x = rand(x0, x1 + 100); }
      if (r.x < x0 - 20) r.x += W + 40;
      r.im.setPosition(r.x, r.y).setAlpha(0.5 * v.rain).setVisible(true);
    }
    const ns = v.snow > 0.02 ? Math.floor(this.flakes.length * Math.min(1, v.snow + 0.1)) : 0;
    for (let i = 0; i < this.flakes.length; i++) {
      const f = this.flakes[i];
      if (i >= ns) { if (f.im.visible) f.im.setVisible(false); continue; }
      f.y += f.v * dt; f.x += Math.sin(this.now * 1.3 + f.ph) * 14 * dt + v.wind * 8 * dt;
      if (f.y > y1 + 4 || f.y < y0 - 8) { f.y = y0 - 4; f.x = rand(x0, x1); }
      if (f.x < x0 - 10) f.x += W + 20; else if (f.x > x1 + 10) f.x -= W + 20;
      f.im.setPosition(f.x, f.y).setAlpha(0.9 * v.snow).setVisible(true);
    }
  }

  // ———————————————— 每帧 ————————————————
  update(_: number, delta: number) {
    const dtRaw = Math.min(0.05, delta / 1000);
    if (this.tScale !== this.tScaleTo) { this.tScale += (this.tScaleTo - this.tScale) * Math.min(1, dtRaw / this.tRamp * 3); if (Math.abs(this.tScale - this.tScaleTo) < 0.01) this.tScale = this.tScaleTo; this.time.timeScale = this.tScale; this.tweens.timeScale = this.tScale; }
    const dt = dtRaw * this.tScale;
    this.now += dt;
    if (this.started) { this.playSecs += dtRaw; this.saveT += dtRaw; if (this.saveT > AUTOSAVE_SECS) { this.saveT = 0; if (this.saveDirty || true) this.saveNow(); } }
    if (this.zoomSaveT > 0 && (this.zoomSaveT -= dtRaw) <= 0) saveSettings({ ...loadSettings(), zoom: this.rig.userZ });
    this.stim.update(dt, this.now);

    // 相机
    if (this.focusFn) this.rig.focus = { ...this.focusFn(), z: this.focusZ }; else this.rig.focus = null;
    if (this.hat.attachedTo) this.rig.follow = true;
    const hs = this.hat.screen;
    this.rig.update(dtRaw, hs);
    const z = this.rig.z, vw = VIEW_W / z, vh = VIEW_H / z;
    this.view.setTo(this.rig.cx - vw / 2, this.rig.cy - vh / 2, vw, vh);
    this.cullNow(false);

    // 实体
    const mx = LOD_MARGIN, v = this.view;
    const inView = (sx: number, sy: number) => sx > v.x - mx && sx < v.right + mx && sy > v.y - mx && sy < v.bottom + mx;
    for (const n of Object.values(this.npcs)) n.update(dt, this.now, inView(n.spr.x, n.spr.y) ? 0 : 1);
    this.mechs.update(dt, this.now, (x, y) => { const s = toScreen(x, y); return inView(s.x, s.y); });
    this.hat.update(dt, (x, y) => this.sparkle(x, y));
    this.fx.update(dt, this.cur.glow);
    this.updatePhase(dt);
    this.bubbles.update(dt);
    if (this.started) this.stories.update(dt);

    // 区域
    const r = regionAt(this.hat.x, this.hat.y);
    if (r && r.id !== this.region) {
      const first = !this.region; this.region = r.id; audio.setRegion(r.id);
      if (this.started && !first) this.hud.regionTitle(t(r.name));
    }
    this.minimap.update(this.hat, [{ x: v.x, y: v.y }, { x: v.right, y: v.y }, { x: v.right, y: v.bottom }, { x: v.x, y: v.bottom }], false);

    // 字幕
    if (this.sub && this.subT > 0) { this.subT -= dtRaw; if (this.subT < 0.6) this.sub.setAlpha(Math.max(0, this.subT / 0.6)); if (this.subT <= 0) this.sub.setVisible(false); }

    this.updateHintUi(dt);
    if (this.debugOn) this.drawDebug();
  }

  private cullNow(force: boolean) {
    this.view.width = this.view.width || VIEW_W; this.view.height = this.view.height || VIEW_H;
    this.culler.update(this.view, this.rig.z, 160, force);
  }

  private updateHintUi(dt: number) {
    const pr = this.hintTarget;
    if (pr && !this.locked && this.hat.attachedTo !== pr.id) this.arrow.setVisible(true).setPosition(pr.sx, pr.sy - pr.top - 22 + Math.sin(this.now * 5) * 5);
    else this.arrow.setVisible(false);
    const want = this.hud.panelOpen && this.hat.attachedTo && this.hintTarget?.id === this.hat.attachedTo ? this.hintMove : null;
    if (want !== this.hlCur) { this.hud.highlightMove(want); this.hlCur = want; }
    const at = this.hat.attachedTo;
    if (at && this.props[at]) {
      const pa = this.panelAnchor(this.props[at]); this.hud.movePanel(pa.x, pa.y, dt);
      for (const m of this.props[at].def.moves as string[]) { const left = (this.cd[`${at}:${m}`] ?? 0) - this.now; this.hud.setCooldown(m, left > 0 ? left / MOVES[m].cooldown : 0); }
    }
  }

  private drawDebug() {
    const g = this.dbgG; g.clear();
    for (const { s } of this.stim.recent) { const p = toScreen(s.x, s.y); g.lineStyle(1, 0xff5577, 0.7); g.strokeEllipse(p.x, p.y, s.radius * 64, s.radius * 32); }
    g.lineStyle(1, 0x55ccff, 0.6);
    for (const p of Object.values(this.props)) g.strokeRect(p.sx - p.def.hit[0] / 2, p.sy - p.def.hit[1], p.def.hit[0], p.def.hit[1]);
    Object.values(this.npcs).forEach((n, i) => { const tx = this.dbgTexts[i]; if (tx) tx.setVisible(true).setPosition(n.spr.x - 20, n.spr.y - 80).setText(`${n.id}:${n.state}`); });
  }
}

const tx = (key: string, fb: string) => (hasKey(key) ? (t(key) as unknown as string) : fb);
void OX;
