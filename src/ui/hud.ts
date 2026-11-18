import Phaser from 'phaser';
import { CHECKLIST, t } from '../core/data';
import { uiNine, uiNineSize } from '../art/ui';
import { ART_SCALE } from '../core/iso';
import { mkText, LayerLike, Rect } from './bubble';
import { L, minTouch, tt, fromUi } from './layout';

type Obj = Phaser.GameObjects.GameObject;

interface MoveBtn { id: string; cont: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Rectangle; cd: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; w: number; ring?: Phaser.Tweens.Tween }

export interface HudCallbacks {
  onMute: () => boolean;
  onDebug: () => void;
  onRecenter?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onNewGame?: () => void;
  onFullscreen?: () => void;
  onZoomReset?: () => void;
}
export interface TitleInfo { hasSave: boolean; summary?: string; corrupt?: boolean }

const PANEL = 0x2b2230, GOLD = 0xf2d58a;
/** 有皮肤贴图则用 9-slice（屏幕像素尺寸），否则回退为矩形 */
function skinBg(scene: Phaser.Scene, key: string, x: number, y: number, w: number, h: number, fb: () => Phaser.GameObjects.Rectangle): any {
  return scene.textures.exists(key) ? uiNine(scene, key, x, y, w, h) : fb();
}
const hilite = (bg: any, on: boolean, fill: number) => { if (bg.setFillStyle) bg.setFillStyle(on ? 0xffe2a0 : fill); else if (on) bg.setTint(0xffe2a0); else bg.clearTint(); };

/** 屏幕空间 UI（坐标均为 UI 空间，见 ui/layout.ts）：暖意条、清单、菜单、招式面板、提示、横幅、标题 */
export class Hud {
  private warmthFill!: Phaser.GameObjects.Rectangle;
  private checkBg!: Phaser.GameObjects.Rectangle;
  private checkTexts: Phaser.GameObjects.Text[] = [];
  private checkHead!: Phaser.GameObjects.Text;
  private checkOpen = true;
  done = new Set<string>();
  private panel?: Phaser.GameObjects.Container;
  private btns: MoveBtn[] = [];
  onToast?: () => void;
  private checkTouched = false; private checkSkin = false; private checkH = 34;
  private help?: Phaser.GameObjects.Text;
  private muteTxt!: Phaser.GameObjects.Text;
  private toastQ: Phaser.GameObjects.Container[] = [];
  private stat: Obj[] = [];            // 随布局重建的常驻元素
  private modal: Obj[] = [];           // 菜单/确认框
  private regionObj?: Phaser.GameObjects.Container;
  private warmth = 0;
  private muted = false;
  private lastVer = -1;
  /** 右上角按钮列下沿（小地图贴在它下面） */
  rightTop = { right: 0, top: 0 };
  panelOpen = false;
  menuOpen = false;
  private panelRect: Rect | null = null;
  private panelTotal = 0; private panelBH = 48;
  private extraObstacles: () => Rect[] = () => [];

  constructor(private scene: Phaser.Scene, private layer: LayerLike, private cb: HudCallbacks) {
    this.checkOpen = L.z <= 1.4;
    this.build();
  }

  private A<T extends Obj>(o: T, d = 100, keep = false): T {
    this.layer.add(o); (o as any).setDepth?.(d);
    if (!keep) this.stat.push(o);
    return o;
  }
  /** 触控按钮：可视底板 + 不小于 minTouch() 的命中区 */
  private btn(cx: number, cy: number, w: number, h: number, label: string, size: number, fn: () => void, list: Obj[], depth = 100, fill = 0xfff1cf, color = '#3a2a22') {
    const bg = skinBg(this.scene, 'ui_btn_on', cx, cy, w, h, () => this.scene.add.rectangle(cx, cy, w, h, fill, 1).setStrokeStyle(3, 0x5a4638));
    const tx = mkText(this.scene, cx, cy, label, size, color).setOrigin(0.5);
    const mt = minTouch();
    const zone = this.scene.add.zone(cx, cy, Math.max(w, mt), Math.max(h, mt)).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => hilite(bg, true, fill)); zone.on('pointerout', () => hilite(bg, false, fill));
    zone.on('pointerdown', () => { this.scene.tweens.add({ targets: [bg, tx], scale: { from: 0.94, to: 1 }, duration: 140 }); fn(); });
    for (const o of [bg, tx, zone]) { this.layer.add(o); (o as any).setDepth(depth); list.push(o); }
    return { bg, tx, zone };
  }

  /** 按当前布局（L）重建常驻 HUD；窗口尺寸/旋转变化时调用 */
  relayout() {
    if (this.lastVer === L.version) return;
    this.toastQ.forEach((o) => { this.scene.tweens.killTweensOf(o); o.destroy(); }); this.toastQ = [];
    if (!this.checkTouched) this.checkOpen = L.z <= 1.4;
    this.build();
  }

  private build() {
    this.lastVer = L.version;
    const scene = this.scene;
    this.stat.forEach((o) => o.destroy()); this.stat = []; this.checkTexts = [];
    const A = this.A.bind(this);
    const x0 = L.x0 + 14, y0 = L.y0 + 14;
    // 暖意条
    A(scene.add.rectangle(x0, y0, 200, 32, PANEL, 0.55).setOrigin(0, 0).setStrokeStyle(2, GOLD, 0.8));
    A(scene.add.image(x0 + 18, y0 + 16, 'hat_0').setScale(1.4 * ART_SCALE / 2));
    A(mkText(scene, x0 + 38, y0 + 7, t('ui.warmth'), 14, '#fff1c8'));
    A(scene.add.rectangle(x0 + 82, y0 + 9, 106, 14, 0x000000, 0.45).setOrigin(0, 0));
    this.warmthFill = A(scene.add.rectangle(x0 + 84, y0 + 11, 1, 10, 0xffc04a).setOrigin(0, 0), 101);
    this.setWarmth(this.warmth);
    // 右上：菜单 / 声音
    const S = Math.max(40, minTouch()); const gap = 8;
    const cy = L.y0 + 14 + S / 2;
    const rx = L.x0 + L.w - 14 - S / 2;
    this.menuBtn(rx, cy, S, '☰', () => this.openMenu());
    this.muteTxt = this.menuBtn(rx - S - gap, cy, S, this.muted ? '🔇' : '🔊', () => { this.muted = this.cb.onMute(); this.muteTxt.setText(this.muted ? '🔇' : '🔊'); });
    this.rightTop = { right: L.x0 + L.w - 14, top: L.y0 + 14 + S + gap };
    // 清单
    this.checkBg = A(skinBg(scene, 'ui_panel_note', x0 + 131, y0 + 40 + 5, 262, 10, () => scene.add.rectangle(x0, y0 + 40, 262, 10, PANEL, 0.58).setOrigin(0, 0).setStrokeStyle(2, GOLD, 0.6)), 99);
    this.checkSkin = this.checkBg.type === 'NineSlice';
    this.checkHead = A(mkText(scene, x0 + 14, y0 + 47, '', 15, this.checkSkin ? '#7a3a1e' : '#ffe9a8'));
    const hz = A(scene.add.zone(x0 + 131, y0 + 40 + 17, 262, Math.max(34, minTouch())).setInteractive({ useHandCursor: true }));
    hz.on('pointerdown', () => { this.checkTouched = true; this.checkOpen = !this.checkOpen; this.renderChecklist(); });
    CHECKLIST.forEach(() => this.checkTexts.push(A(mkText(scene, 0, 0, '', 14, '#f4ead8', { wordWrap: { width: 238 } }))));
    this.renderChecklist();
    // 帮助
    if (!this.help || !this.help.active) this.help = undefined;
    this.help = A(mkText(scene, L.x0 + L.w / 2, L.y0 + L.h - 14, t('ui.help'), 14, '#ffffff', { stroke: '#2b2230', strokeThickness: 4, align: 'center', wordWrap: { width: L.w - 40 } }).setOrigin(0.5, 1), 100, true);
    this.stat.push(this.help);
    if (this.helpHidden) { this.help.destroy(); this.help = undefined; }
  }
  private helpHidden = false;

  private menuBtn(cx: number, cy: number, S: number, glyph: string, fn: () => void) {
    const bg = this.A(this.scene.add.rectangle(cx, cy, S, S, PANEL, 0.6).setStrokeStyle(2, GOLD, 0.8));
    const tx = this.A(mkText(this.scene, cx, cy, glyph, Math.round(S * 0.5), '#ffffff').setOrigin(0.5));
    const z = this.A(this.scene.add.zone(cx, cy, Math.max(S, minTouch()), Math.max(S, minTouch())).setInteractive({ useHandCursor: true }));
    z.setData('qa', glyph === '☰' ? 'ui:menu' : 'ui:mute');
    z.on('pointerdown', () => { this.scene.tweens.add({ targets: [bg, tx], scale: { from: 0.9, to: 1 }, duration: 140 }); fn(); });
    return tx;
  }

  /** 气泡需要避开的 UI 矩形（UI 空间） */
  obstacles(): Rect[] {
    const S = Math.max(40, minTouch());
    const r: Rect[] = [
      { x0: L.x0 + 8, y0: L.y0 + 8, x1: L.x0 + 282, y1: L.y0 + 54 + this.checkH + 6 },
      { x0: L.x0 + L.w - 14 - (2 * S + 8) - 6, y0: L.y0 + 8, x1: L.x0 + L.w - 8, y1: L.y0 + 14 + S + 6 },
      ...this.extraObstacles(),
    ];
    if (this.panelRect) r.push(this.panelRect);
    if (this.toastQ.length) r.push({ x0: L.x0 + L.w / 2 - 320, y0: L.y0 + 34, x1: L.x0 + L.w / 2 + 320, y1: L.y0 + 40 + this.toastQ.length * 50 });
    return r;
  }
  setExtraObstacles(fn: () => Rect[]) { this.extraObstacles = fn; }

  /** 供 qa 校验的稳定 UI 块（主相机屏幕逻辑坐标 0..1280 × 0..720） */
  qaRects(): { id: string; kind: 'hud' | 'panel' | 'toast' | 'bubble'; x0: number; y0: number; x1: number; y1: number }[] {
    const cv = (r: Rect) => { const a = fromUi(r.x0, r.y0), b = fromUi(r.x1, r.y1); return { x0: a.x, y0: a.y, x1: b.x, y1: b.y }; };
    const out: { id: string; kind: 'hud' | 'panel' | 'toast' | 'bubble'; x0: number; y0: number; x1: number; y1: number }[] = [];
    const S = Math.max(40, minTouch());
    out.push({ id: 'hud:warmth', kind: 'hud', ...cv({ x0: L.x0 + 14, y0: L.y0 + 14, x1: L.x0 + 214, y1: L.y0 + 46 }) });
    out.push({ id: 'hud:checklist', kind: 'hud', ...cv({ x0: L.x0 + 14, y0: L.y0 + 54, x1: L.x0 + 276, y1: L.y0 + 54 + this.checkH }) });
    out.push({ id: 'hud:menu', kind: 'hud', ...cv({ x0: L.x0 + L.w - 14 - (2 * S + 8), y0: L.y0 + 14, x1: L.x0 + L.w - 14, y1: L.y0 + 14 + S }) });
    const mm = this.extraObstacles()[0]; if (mm) out.push({ id: 'hud:minimap', kind: 'hud', ...cv(mm) });
    if (this.panel && this.panelRect) {
      const c = this.panel;
      for (const b of this.btns) out.push({ id: 'move:' + b.id, kind: 'panel', ...cv({ x0: c.x + (b.bg.x - b.w / 2), y0: c.y - this.panelBH / 2, x1: c.x + (b.bg.x + b.w / 2), y1: c.y + this.panelBH / 2 }) });
    }
    this.toastQ.forEach((c, i) => { const b = c.getBounds(); const a = fromUi(b.x, b.y), e = fromUi(b.right, b.bottom); out.push({ id: 'toast:' + i, kind: 'toast', x0: a.x, y0: a.y, x1: e.x, y1: e.y }); });
    return out;
  }
  /** 面板占用的矩形 (UI 空间)，用于其它 UI 避让 */
  get panelBox() { return this.panelRect; }

  hideHelp() {
    this.helpHidden = true;
    const h = this.help; if (!h) return; this.help = undefined;
    this.scene.tweens.add({ targets: h, alpha: 0, duration: 600, onComplete: () => h.destroy() });
  }

  setWarmth(v: number) { this.warmth = v; if (this.warmthFill?.active) this.warmthFill.width = Math.max(1, Math.min(100, v)); }
  setMuted(m: boolean) { this.muted = m; if (this.muteTxt?.active) this.muteTxt.setText(m ? '🔇' : '🔊'); }

  // —— 清单 ——
  complete(id: string) {
    if (this.done.has(id)) return false;
    this.done.add(id); this.renderChecklist();
    const idx = CHECKLIST.findIndex((c) => c.id === id);
    const tx = this.checkTexts[idx];
    if (tx) this.scene.tweens.add({ targets: tx, scale: { from: 1.25, to: 1 }, duration: 400, ease: 'Back.Out' });
    return true;
  }
  /** 读档：直接设置已完成项（不播动画） */
  setDone(ids: string[]) { this.done = new Set(ids); this.renderChecklist(); }
  renderChecklist() {
    if (!this.checkHead?.active) return;
    const x0 = L.x0 + 14, y0 = L.y0 + 14;
    const total = CHECKLIST.filter((c) => !c.secret).length;
    const n = CHECKLIST.filter((c) => !c.secret && this.done.has(c.id)).length;
    this.checkHead.setText(`${this.checkOpen ? '▾' : '▸'} ${t('ui.checklist')}  ${n}/${total}`);
    let y = y0 + 74;
    CHECKLIST.forEach((c, i) => {
      const tx = this.checkTexts[i];
      const d = this.done.has(c.id);
      const label = c.secret && !d ? t(c.hiddenText!) : t(c.text);
      const sk = this.checkSkin;
      tx.setText(`${d ? '☑' : '☐'} ${label}`).setColor(d ? (sk ? '#3f7d36' : '#9be28f') : c.secret ? (sk ? '#8a7a70' : '#b9aebf') : (sk ? '#3a2a22' : '#f4ead8'));
      tx.setVisible(this.checkOpen).setPosition(x0 + 14, y).setOrigin(0, 0);
      y += tx.height + 4;
    });
    const ch = this.checkOpen ? y - (y0 + 40) + 8 : 34;
    this.checkH = ch;
    if (this.checkSkin) { uiNineSize(this.checkBg as any, 262, ch); (this.checkBg as any).setPosition(x0 + 131, y0 + 40 + ch / 2); } else this.checkBg.setSize(262, ch);
  }

  // —— 提示条 / 区域名 ——
  toast(text: string, dur = 3.4) {
    const tx = mkText(this.scene, 0, 0, text, 16, '#fff6dc', { align: 'center', wordWrap: { width: Math.min(560, L.w - 60) } });
    const w = tx.width + 28, h = tx.height + 14;
    const bg = skinBg(this.scene, 'ui_toast', 0, 0, w, h, () => this.scene.add.rectangle(0, 0, w, h, PANEL, 0.82).setStrokeStyle(2, GOLD, 0.9));
    if (bg.type === 'NineSlice') tx.setColor('#3a2a22');
    tx.setOrigin(0.5);
    const cx = L.x0 + L.w / 2, cy = L.y0 + 56;
    const c = this.scene.add.container(cx, cy, [bg, tx]).setDepth(300).setAlpha(0);
    this.layer.add(c);
    this.toastQ.forEach((o) => this.scene.tweens.add({ targets: o, y: o.y + h + 6, duration: 200 }));
    this.toastQ.push(c);
    this.onToast?.();
    this.scene.tweens.add({ targets: c, alpha: 1, y: cy + 10, duration: 250 });
    this.scene.tweens.add({ targets: c, alpha: 0, delay: dur * 1000, duration: 400, onComplete: () => { c.destroy(); this.toastQ = this.toastQ.filter((x) => x !== c); } });
  }
  /** 进入新区域的地名牌 */
  regionTitle(name: string) {
    this.regionObj?.destroy();
    const tx = mkText(this.scene, 0, 0, name, 30, '#fff6dc', { stroke: '#2b2230', strokeThickness: 6 }).setOrigin(0.5);
    const line = this.scene.add.rectangle(0, 26, Math.max(120, tx.width + 40), 3, GOLD, 0.9);
    const c = this.scene.add.container(L.x0 + L.w / 2, L.y0 + L.h * 0.22, [tx, line]).setDepth(250).setAlpha(0);
    this.layer.add(c);
    this.regionObj = c;
    this.scene.tweens.add({ targets: c, alpha: 1, duration: 450 });
    this.scene.tweens.add({ targets: c, alpha: 0, delay: 2600, duration: 700, onComplete: () => { c.destroy(); if (this.regionObj === c) this.regionObj = undefined; } });
  }

  // —— 招式面板（UI 空间坐标） ——
  showPanel(name: string, moves: { id: string; icon: string; label: string }[], sx: number, sy: number, onUse: (id: string) => void) {
    this.hidePanel();
    const bh = Math.max(48, minTouch()), gap = 8;
    // 窄屏（手机）时按钮窄一点，仍保证 ≥44 CSS px 高与宽
    const bw = Math.min(158, Math.max(minTouch(), (L.w - 40 - gap * (moves.length - 1)) / moves.length));
    const total = moves.length * bw + (moves.length - 1) * gap;
    const cx = Phaser.Math.Clamp(sx, L.x0 + total / 2 + 12, L.x0 + L.w - total / 2 - 12);
    const cy = Math.max(sy, L.y0 + 110);
    const cont = this.scene.add.container(cx, cy).setDepth(200);
    const tag = mkText(this.scene, 0, -bh / 2 - 6, `${name}`, 14, '#fff1c8', { stroke: '#2b2230', strokeThickness: 4 }).setOrigin(0.5, 1);
    cont.add(tag);
    this.btns = moves.map((m, i) => {
      const x = -total / 2 + bw / 2 + i * (bw + gap);
      const bg = skinBg(this.scene, 'ui_btn_on', x, 0, bw, bh, () => this.scene.add.rectangle(x, 0, bw, bh, 0xfff1cf, 1).setStrokeStyle(3, 0x5a4638)).setInteractive({ useHandCursor: true });
      const cd = this.scene.add.rectangle(x - bw / 2, 0, bw, bh, PANEL, 0.5).setOrigin(0, 0.5);
      cd.width = 0;
      const ic = mkText(this.scene, x - bw / 2 + 10, 0, m.icon, 24, '#000000').setOrigin(0, 0.5);
      const lb = mkText(this.scene, x - bw / 2 + 44, 0, m.label, 15, '#3a2a22').setOrigin(0, 0.5);
      const c = this.scene.add.container(0, 0, [bg, cd, ic, lb]);
      cont.add(c);
      bg.setData('qa', 'move:' + m.id);
      bg.on('pointerover', () => hilite(bg, true, 0xfff1cf));
      bg.on('pointerout', () => hilite(bg, false, 0xfff1cf));
      bg.on('pointerdown', () => { this.scene.tweens.add({ targets: c, scale: { from: 0.92, to: 1 }, duration: 160 }); onUse(m.id); });
      return { id: m.id, cont: c, bg, cd, label: lb, w: bw } as MoveBtn;
    });
    cont.setScale(0.4).setAlpha(0);
    this.layer.add(cont);
    this.scene.tweens.add({ targets: cont, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
    this.panelTotal = total; this.panelBH = bh;
    this.panel = cont; this.panelOpen = true;
    this.panelRect = { x0: cx - total / 2 - 4, y0: cy - bh / 2 - 28, x1: cx + total / 2 + 4, y1: cy + bh / 2 + 4 };
  }
  /** 让面板平滑跟随目标位置（UI 空间） */
  movePanel(sx: number, sy: number, dt: number) {
    const c = this.panel; if (!c) return;
    const total = this.panelTotal, bh = this.panelBH;
    const tx = Phaser.Math.Clamp(sx, L.x0 + total / 2 + 12, L.x0 + L.w - total / 2 - 12), ty = Phaser.Math.Clamp(sy, L.y0 + 100, L.y0 + L.h - 40);
    const k = 1 - Math.exp(-dt * 10);
    c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
    this.panelRect = { x0: c.x - total / 2 - 4, y0: c.y - bh / 2 - 50, x1: c.x + total / 2 + 4, y1: c.y + bh / 2 + 4 };
  }
  hidePanel() {
    if (!this.panel) return;
    this.panelRect = null; const p = this.panel; this.panel = undefined; this.btns = []; this.panelOpen = false;
    this.scene.tweens.add({ targets: p, scale: 0.5, alpha: 0, duration: 140, onComplete: () => p.destroy() });
  }
  /** frac: 0 = 可用, 1 = 刚用过 */
  setCooldown(id: string, frac: number) {
    const b = this.btns.find((x) => x.id === id);
    if (b) b.cd.width = b.w * Phaser.Math.Clamp(frac, 0, 1);
  }
  highlightMove(id: string | null) {
    this.btns.forEach((b) => {
      b.ring?.stop(); b.ring = undefined; (b.bg as any).setStrokeStyle ? (b.bg as any).setStrokeStyle(3, 0x5a4638) : (b.bg as any).clearTint(); b.cont.setScale(1);
      if (b.id === id) {
        (b.bg as any).setStrokeStyle ? (b.bg as any).setStrokeStyle(4, 0xe8452c) : (b.bg as any).setTint(0xffb0a0);
        b.ring = this.scene.tweens.add({ targets: b.cont, scale: { from: 1, to: 1.1 }, yoyo: true, repeat: -1, duration: 420 });
      }
    });
  }

  // —— 横幅 / 结尾 ——
  banner(text: string) {
    const tx = mkText(this.scene, 0, 0, text, 22, '#fff6dc', { align: 'center', wordWrap: { width: Math.min(640, L.w - 80) } }).setOrigin(0.5);
    const w = tx.width + 48, h = tx.height + 30;
    const bg = skinBg(this.scene, 'ui_panel_paper', 0, 0, w, h, () => this.scene.add.rectangle(0, 0, w, h, PANEL, 0.88).setStrokeStyle(3, GOLD));
    if (bg.type === 'NineSlice') tx.setColor('#3a2a22');
    const by = L.y0 + L.h - 100;
    const c = this.scene.add.container(L.x0 + L.w / 2, by + 20, [bg, tx]).setDepth(400).setAlpha(0);
    this.layer.add(c);
    this.scene.tweens.add({ targets: c, alpha: 1, y: by, duration: 500 });
    this.scene.tweens.add({ targets: c, alpha: 0, delay: 6000, duration: 600, onComplete: () => c.destroy() });
  }
  endPanel(onClose: () => void, onReplay?: () => void, full = false) {
    const list: Obj[] = [];
    const cx = L.x0 + L.w / 2, cy = L.y0 + L.h / 2;
    const sk = this.scene.textures.exists('ui_panel_paper');
    const bg = skinBg(this.scene, 'ui_panel_paper', cx, cy, Math.min(660, L.w - 40), 280, () => this.scene.add.rectangle(cx, cy, Math.min(660, L.w - 40), 280, PANEL, 0.92).setStrokeStyle(4, GOLD));
    const h = mkText(this.scene, cx, cy - 80, (full ? tt('banner.full_title', '平安夜 · 通关') : t('banner.end_title')), 30, sk ? '#9a3a22' : '#ffe9a8').setOrigin(0.5);
    const b = mkText(this.scene, cx, cy - 8, (full ? tt('banner.full_body', '整座城都亮了。\n愿世间所有的美好，都被祝福。\n你可以继续散步，或者再玩一次。') : t('banner.end_body')), 17, sk ? '#3a2a22' : '#f4ead8', { align: 'center', lineSpacing: 6, wordWrap: { width: Math.min(600, L.w - 80) } }).setOrigin(0.5);
    list.push(bg, h, b);
    list.forEach((o) => { this.layer.add(o); (o as any).setDepth(500); });
    const close = () => { this.scene.tweens.add({ targets: list, alpha: 0, duration: 400, onComplete: () => list.forEach((o) => o.destroy()) }); onClose(); };
    const bh = Math.max(48, minTouch());
    this.btn(onReplay ? cx - 110 : cx, cy + 82, 190, bh, tt('ui.keep_exploring', '继续散步'), 19, close, list, 501);
    if (onReplay) this.btn(cx + 110, cy + 82, 190, bh, tt('ui.play_again', '再玩一次'), 19, () => { close(); onReplay(); }, list, 501, 0xe8dcc4);
    list.forEach((o) => (o as any).setAlpha?.(0));
    this.scene.tweens.add({ targets: list, alpha: 1, duration: 600 });
  }

  // —— 菜单 / 确认框 ——
  private closeModal() { this.modal.forEach((o) => o.destroy()); this.modal = []; this.menuOpen = false; }
  private dim(): Phaser.GameObjects.Rectangle {
    const d = this.scene.add.rectangle(L.x0 + L.w / 2, L.y0 + L.h / 2, L.w + 4, L.h + 4, 0x1c1626, 0.6).setInteractive();
    this.layer.add(d); d.setDepth(900); this.modal.push(d);
    return d;
  }
  openMenu() {
    if (this.menuOpen) { this.closeModal(); return; }
    this.menuOpen = true;
    const items: { label: string; fn: () => void; keep?: boolean }[] = [];
    if (this.cb.onRecenter) items.push({ label: tt('ui.menu_recenter', '📍 回到帽子'), fn: this.cb.onRecenter });
    if (this.cb.onZoomReset) items.push({ label: tt('ui.menu_zoom_reset', '🔍 视角复位'), fn: this.cb.onZoomReset });
    if (this.cb.onFullscreen) items.push({ label: tt('ui.menu_fullscreen', '⛶ 全屏'), fn: this.cb.onFullscreen });
    if (this.cb.onExport) items.push({ label: tt('ui.menu_export', '💾 导出存档'), fn: this.cb.onExport });
    if (this.cb.onImport) items.push({ label: tt('ui.menu_import', '📂 导入存档'), fn: this.cb.onImport });
    if (this.cb.onNewGame) items.push({ label: tt('ui.menu_new', '🔄 重新开始'), fn: () => this.confirm(tt('ui.confirm_new', '重新开始会清除当前进度（可先导出存档）。确定吗？'), this.cb.onNewGame!), keep: true });
    items.push({ label: tt('ui.menu_debug', '🐞 调试信息'), fn: this.cb.onDebug });
    const bh = Math.max(48, minTouch()), bw = 240, gap = 8;
    const H = items.length * (bh + gap) + 70;
    const cx = L.x0 + L.w / 2, cy = L.y0 + L.h / 2;
    this.dim().on('pointerdown', () => this.closeModal());
    const sk = this.scene.textures.exists('ui_panel_paper');
    const bg = skinBg(this.scene, 'ui_panel_paper', cx, cy, bw + 50, H, () => this.scene.add.rectangle(cx, cy, bw + 50, H, PANEL, 0.95).setStrokeStyle(3, GOLD));
    const title = mkText(this.scene, cx, cy - H / 2 + 24, tt('ui.menu', '菜单'), 18, sk ? '#7a3a1e' : '#ffe9a8').setOrigin(0.5);
    for (const o of [bg, title]) { this.layer.add(o); (o as any).setDepth(901); this.modal.push(o); }
    items.forEach((it, i) => {
      this.btn(cx, cy - H / 2 + 62 + bh / 2 + i * (bh + gap), bw, bh, it.label, 17, () => { if (!it.keep) this.closeModal(); it.fn(); }, this.modal, 902);
    });
  }
  confirm(text: string, onYes: () => void) {
    this.closeModal(); this.menuOpen = true;
    const cx = L.x0 + L.w / 2, cy = L.y0 + L.h / 2, bh = Math.max(48, minTouch());
    this.dim();
    const sk = this.scene.textures.exists('ui_panel_paper');
    const bg = skinBg(this.scene, 'ui_panel_paper', cx, cy, Math.min(520, L.w - 40), 220, () => this.scene.add.rectangle(cx, cy, Math.min(520, L.w - 40), 220, PANEL, 0.96).setStrokeStyle(3, GOLD));
    const tx = mkText(this.scene, cx, cy - 36, text, 17, sk ? '#3a2a22' : '#fff6dc', { align: 'center', wordWrap: { width: Math.min(460, L.w - 80) }, lineSpacing: 5 }).setOrigin(0.5);
    for (const o of [bg, tx]) { this.layer.add(o); (o as any).setDepth(901); this.modal.push(o); }
    this.btn(cx - 85, cy + 62, 150, bh, tt('ui.yes', '确定'), 18, () => { this.closeModal(); onYes(); }, this.modal, 902);
    this.btn(cx + 85, cy + 62, 150, bh, tt('ui.no', '取消'), 18, () => this.closeModal(), this.modal, 902);
  }
  notice(text: string) { this.toast(text, 4.2); }

  // —— 标题 ——
  title(info: TitleInfo, h: { onNew: () => void; onContinue: () => void; onImport?: () => void }) {
    const objs: Obj[] = [];
    const cx = L.x0 + L.w / 2, cy = L.y0 + L.h / 2;
    const add = <T extends Obj>(o: T) => { this.layer.add(o); (o as any).setDepth(1000); objs.push(o); return o; };
    const dim = add(this.scene.add.rectangle(cx, cy, L.w + 4, L.h + 4, 0x1c1626, 0.8).setInteractive());
    const k = Math.min(1, L.h / 540);
    const hat = add(this.scene.add.image(cx, cy - 170 * k, 'hat_0').setScale(5 * ART_SCALE / 2));
    add(mkText(this.scene, cx, cy - 100 * k, t('ui.title'), Math.round(64 * Math.max(0.7, k)), '#ffe9a8', { stroke: '#7a2a1e', strokeThickness: 8 }).setOrigin(0.5));
    add(mkText(this.scene, cx, cy - 44 * k, t('ui.subtitle'), 18, '#f4ead8').setOrigin(0.5));
    add(mkText(this.scene, cx, cy + 16 * k, t('ui.intro'), 18, '#fff6dc', { wordWrap: { width: L.w - 60 }, align: 'center' }).setOrigin(0.5));
    let started = false;
    const go = (fn: () => void) => { if (started) return; started = true; fn(); this.scene.tweens.add({ targets: objs, alpha: 0, duration: 600, onComplete: () => objs.forEach((o) => o.destroy()) }); };
    const bh = Math.max(52, minTouch());
    if (!info.hasSave) {
      const st = add(mkText(this.scene, cx, cy + 96 * k, t('ui.start'), 22, '#ffffff', { stroke: '#2b2230', strokeThickness: 5 }).setOrigin(0.5));
      add(mkText(this.scene, cx, cy + 130 * k, t('ui.start_note'), 14, '#cfc3d6').setOrigin(0.5));
      this.scene.tweens.add({ targets: st, alpha: 0.35, yoyo: true, repeat: -1, duration: 700 });
      dim.on('pointerdown', () => go(h.onNew));
    } else {
      if (info.summary) add(mkText(this.scene, cx, cy + 62 * k, info.summary, 14, '#cfc3d6').setOrigin(0.5));
      const yy = cy + 112 * k;
      const b1 = this.btn(cx - 120, yy, 210, bh, tt('ui.continue', '继续'), 22, () => go(h.onContinue), objs, 1001, 0xffe9a8);
      this.btn(cx + 120, yy, 210, bh, tt('ui.new_game', '新游戏'), 22, () => this.confirm(tt('ui.confirm_new', '重新开始会清除当前进度（可先导出存档）。确定吗？'), () => go(h.onNew)), objs, 1001);
      void b1;
      add(mkText(this.scene, cx, yy + bh / 2 + 28, t('ui.start_note'), 13, '#cfc3d6').setOrigin(0.5));
    }
    if (info.corrupt) add(mkText(this.scene, cx, L.y0 + L.h - 70, tt('ui.save_corrupt', '上次的存档损坏了，已为你开始新游戏（旧档已备份）。'), 14, '#ffb4a4').setOrigin(0.5));
    if (h.onImport) {
      const imp = this.btn(cx, L.y0 + L.h - 34, 190, Math.max(36, minTouch() - 6), tt('ui.menu_import', '📂 导入存档'), 15, h.onImport, objs, 1001, 0xe8dcc4);
      void imp;
    }
    this.scene.tweens.add({ targets: hat, y: hat.y + 8, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.InOut' });
  }
}
