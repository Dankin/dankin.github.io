// 果园新美术场景(v5):用 src/art 的 backdrop/tree/building/transport/dock/character/fx 画整个场景。
// 与旧 orchard.ts 绘制并行:?art=0 回到旧路径。本文件自带布局(CSS 像素)与动画状态,Orchard 只做手势与公开 API 转发。
import { appleSprite, backdropForHour, drawAppleAt, drawBackdrop, drawBuilding, drawLeaves, appleFxFor, appleLandFx, drawFall, drawLandFx, drawStockPile, drawTree, fallDone, spawnShakeFall, stepFall, treeAnchors, spawnLeaves, stepLeaves, treeAnchorsIdx, treeCrown } from '../art/nature/index.ts';
import type { FallItem, LeafP } from '../art/nature/index.ts';
import { Fireworks, Flights, drawCharacter, drawFleet, drawLaoXuAt, drawGoldHalo, drawSantaDepot, runPhase, TRANSPORT8_FLIES, TRANSPORT8_W } from '../art/things/index.ts';
import type { CharKind } from '../art/things/index.ts';
import { fmt } from './format.ts';
import { APPLE, P, TAU, apple as penApple, circ, clamp, ease, lerp, setUnit, sparkle, text } from './pen.ts';
import type { EventKind, Hit, WorldView } from './orchard.ts';

type C = CanvasRenderingContext2D;

/** 一趟(装→行驶→卸→返回)总秒数,8 档(匀速四段;飞行档更快) */
export const TRIP8 = [12, 12, 11, 9, 11, 8, 7, 6];
const DEPOT_W = 150;
/** 运输档 → 点击目标 id(sys 的 TAP_TARGETS) */
const VEH_TARGET: (string | null)[] = ['gold-basket', 'porter', null, 'truck', null, null, null, null];

interface Part { on: boolean; x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; kind: 0 | 1 | 2; gold: boolean }
interface Float { on: boolean; s: string; x: number; y: number; t: number; col: string }
interface Ev { kind: EventKind; t: number; dur: number; x: number; y: number; cb: (hit: boolean) => void; caught: number }
interface Drop { kind: string; state: string; golden: boolean; x: number; y: number; vy: number; ph: 0 | 1 | 2 | 3; t: number; gy: number; x0: number; rot: number }
interface Visitor { id: string; t: number; ttl: number; x: number; y: number; fromX: number; slot: number; dir: 1 | -1 }

interface Geo {
  land: boolean; U: number;
  gyA: number; gyR: number;
  treeX: number; treeS: number; bldX: number; bldS: number;
  pileX: number; pileY: number; boxX: number; boxY: number;
  r0: number; r1: number; dockX: number; dockS: number; vs: number; kc: number; gs: number;
}

const EMPTY_GEO: Geo = { land: true, U: 1, gyA: 200, gyR: 215, treeX: 150, treeS: 0.7, bldX: 380, bldS: 0.5, pileX: 250, pileY: 205, boxX: 50, boxY: 210, r0: 300, r1: 650, dockX: 740, dockS: 1.1, vs: 1.1, kc: 1.1, gs: 3.4 };

export class ArtScene {
  w = 0; h = 0; dpr = 1; insL = 0; insR = 0;
  reduced = false;
  dark = false;
  sway = 0;
  t = 0;
  wv!: WorldView;
  private g: Geo = EMPTY_GEO;
  private fall: FallItem[] = [];
  private fallCd = 0;
  private landFx: { kind: string; x: number; y: number; t: number }[] = [];
  private fleetT = 0;
  private fleetU: number[] = [];
  private takeoff = 0;
  private recvT = 0;
  private fl = new Flights(14);
  private fw = new Fireworks(8);
  private leaves: LeafP[] = [];
  private parts: Part[] = [];
  private floats: Float[] = [];
  private drops: Drop[] = [];
  private visitors: Visitor[] = [];
  private ev: Ev | null = null;
  private fwV = 0; private pileV = 0; private progT = 0; private progV = 0; private progFull = false;
  private giftPop = 0; private srcPop = 0; private rtPop = 0; private dockPop = 0; private emitAcc = 0;
  private crates = 0; private crateT = 0; private xuPose = 0; private firstW = true;
  private sprFly = appleSprite('fuji', 'fresh', 32);
  private bgBuf: HTMLCanvasElement | null = null;
  private bgKey = '';
  private bgT = -9;

  constructor(private c: C) {
    for (let i = 0; i < 56; i++) this.parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, kind: 0, gold: false });
    for (let i = 0; i < 4; i++) this.floats.push({ on: false, s: '', x: 0, y: 0, t: 0, col: P.ink });
  }

  /* ───────── 布局 ───────── */
  resize(w: number, h: number, dpr: number, insL: number, insR: number): void {
    this.w = w; this.h = h; this.dpr = dpr; this.insL = insL; this.insR = insR;
    this.bgKey = '';
    this.layout();
  }

  private layout(): void {
    const { w, h, insL, insR } = this;
    const land = w / h >= 1.05;
    const aw = w - insL - insR;
    const g = { ...EMPTY_GEO } as Geo;
    g.land = land;
    if (land) {
      const U = Math.min(h / 277, aw / 844);
      g.U = U;
      g.gyA = Math.round(h * 0.8);
      g.gyR = Math.round(h * 0.85);
      g.treeS = Math.min((g.gyA - 6) / 300, aw * 0.34 / 256);
      g.treeX = insL + aw * 0.19;
      g.bldS = Math.min((g.gyA * 0.78) / 300, aw * 0.3 / 480);
      g.bldX = insL + aw * 0.5;
      g.pileX = g.treeX + g.treeS * 100;
      g.pileY = g.gyA + 8 * U;
      g.boxX = Math.max(insL + 26 * U, g.treeX - g.treeS * 112);
      g.boxY = g.gyA + 12 * U;
      g.dockS = 1.15 * U;
      g.dockX = insL + aw - 56 * g.dockS;
      g.vs = 1.15 * U;
      g.kc = 1.15 * U;
      g.gs = clamp(3.4 * U, 2.8, 5);
      g.r0 = g.pileX + 44 * U;
      g.r1 = g.dockX - 52 * g.dockS;
    } else {
      const U = aw / 390;
      g.U = U;
      g.gyA = Math.round(h * 0.64);
      g.gyR = Math.round(h * 0.87);
      g.treeS = Math.min((g.gyA - 10) / 300, aw * 0.84 / 256);
      g.treeX = insL + aw * 0.38;
      g.bldS = Math.min(aw * 0.5 / 480, (g.gyA * 0.5) / 300);
      g.bldX = insL + aw * 0.8;
      g.pileX = g.treeX + g.treeS * 100;
      g.pileY = g.gyA + 10 * U;
      g.boxX = insL + aw * 0.1;
      g.boxY = g.gyA + 16 * U;
      g.dockS = 1.05 * U;
      g.dockX = insL + 56 * g.dockS + 4 * U;
      g.vs = 1.05 * U;
      g.kc = 1.1 * U;
      g.gs = clamp(3.2 * U, 2.8, 4.5);
      g.r0 = insL + aw - 46 * U;
      g.r1 = g.dockX + 52 * g.dockS;
    }
    this.g = g;
  }

  private tierOf(): number { return clamp(Math.round(this.wv?.srcTier ?? 0) + 1, 1, 5); }
  /** 路线上 u(0..1)的位置(起点=装货处,终点=码头) */
  private at(u: number): { x: number; y: number } { return { x: lerp(this.g.r0, this.g.r1, u), y: this.g.gyR }; }
  private crown(): { x: number; y: number; rx: number; ry: number } {
    const c = treeCrown(this.tierOf() as 1, 7);
    return { x: this.g.treeX + c.x * this.g.treeS, y: this.g.gyA + c.y * this.g.treeS, rx: c.rx * this.g.treeS, ry: c.ry * this.g.treeS };
  }
  private emit(): { x: number; y: number } {
    const c = this.crown();
    return { x: c.x + (Math.random() - 0.5) * c.rx * 1.2, y: c.y + c.ry * (0.1 + Math.random() * 0.5) };
  }

  /* ───────── 公开 ───────── */
  setProgress(frac: number): void {
    const f = Math.max(0, Math.min(1, frac || 0));
    const p = f <= 1e-9 ? 0 : (Math.log10(f) + 9) / 9;
    if (p - this.progT > 0.02) this.giftPop = 1;
    this.progT = p;
    const full = f >= 1;
    if (full && !this.progFull) {
      this.giftPop = 1;
      this.ring(this.g.boxX, this.g.boxY - 20 * this.g.U, true);
      this.fw.burst(this.g.boxX, this.g.boxY - 70 * this.g.U, 1.1 * this.g.U);
    }
    this.progFull = full;
  }

  setWorld(wv: WorldView): void {
    const o = this.wv;
    const first = this.firstW;
    this.firstW = false;
    const g = this.g;
    if (!first && o) {
      if (wv.srcTier !== o.srcTier) {
        this.srcPop = 1;
        const c = this.crown();
        this.ring(g.treeX, c.y, true);
        this.say('升级!', g.treeX, c.y - c.ry - 10 * g.U, P.ink);
        this.fw.burst(g.treeX, c.y - c.ry * 0.5, 0.8 * g.U);
      } else if (wv.srcUnits.some((n, i) => n > (o.srcUnits[i] ?? 0))) {
        this.srcPop = 0.7;
        this.ring(g.treeX, this.crown().y, false);
      }
      if (wv.rtTier !== o.rtTier) {
        this.rtPop = 1;
        this.dockPop = 1;
        this.ring(g.dockX, g.gyR - 30 * g.dockS, true);
        this.say('升级!', g.dockX, g.gyR - 80 * g.dockS, P.ink);
      } else if (wv.rtVehicles > o.rtVehicles) {
        this.rtPop = 0.7;
        this.ring(g.r0, g.gyR - 14 * g.vs, false);
      }
    }
    this.wv = wv;
    this.syncVehs();
  }

  /** Orchard.shakeTap 转发 */
  kick(a: number): void { this.sway = Math.min(1, this.sway + a); this.xuPose = 0.6; }

  poke(n = 2): void {
    this.sway = Math.min(1, this.sway + 0.7);
    this.xuPose = 0.7;
    const e = this.emit();
    const g = this.g;
    if (!this.shakeFall()) for (let i = 0; i < n; i++) this.fl.spawn(e.x + (Math.random() - 0.5) * 12, e.y, g.pileX + (Math.random() - 0.5) * 16 * g.U, g.pileY - 6 * g.U, 0.62, 12 * g.U, 0);
    for (let i = 0; i < 3; i++) this.part(e.x, e.y, (Math.random() - 0.5) * 60, -30 - Math.random() * 30, 0.5, 2, 0, false);
    if (!this.reduced) spawnLeaves(this.leaves, e.x, e.y, 3, 30 * g.U);
  }

  /** 摇树:按源头档 dropPattern 生成落果/小枝/落叶粒子;返回是否生成 */
  private shakeFall(): boolean {
    if (this.reduced || this.fallCd > 0 || this.fall.length > 70) return false;
    this.fallCd = 0.4;
    const variant = (this.wv.srcVariant ?? 0) > 0 ? 1 : 0;
    const a = treeAnchors(this.tierOf(), variant, 7, 1);
    this.fall.push(...spawnShakeFall(this.tierOf(), a, Math.random));
    return true;
  }

  burst(n = 3): void {
    const e = this.emit();
    const g = this.g;
    for (let i = 0; i < n; i++) this.fl.spawn(e.x, e.y, g.dockX + (Math.random() - 0.5) * 30 * g.U, g.gyR - 28 * g.dockS, 1 + Math.random() * 0.4, (70 + Math.random() * 40) * g.U, 1);
  }

  floatText(s: string, x?: number, y?: number): void {
    const c = this.crown();
    this.say(s, x ?? this.g.treeX, y ?? c.y - c.ry - 6 * this.g.U, P.ink);
  }

  spawnEvent(kind: EventKind, cb: (hit: boolean) => void): void {
    if (this.ev) return;
    this.ev = { kind, t: 0, dur: kind === 'meteor' ? 5 : kind === 'bird' ? 9 : 12, x: -99, y: -99, cb, caught: 0 };
    this.evPos(this.ev);
  }
  eventActive(): boolean { return this.ev !== null; }

  /** 摇树掉落一个苹果:从树冠落下 → 弹一下 → 滚进堆场 */
  dropApple(kind: string, state: string, golden = false): void {
    if (this.drops.length >= 10) this.drops.shift();
    const e = this.emit();
    const g = this.g;
    this.drops.push({ kind: golden ? 'golden' : kind, state, golden, x: e.x, y: e.y, vy: 0, ph: 0, t: 0, gy: g.gyA + (6 + Math.random() * 8) * g.U, x0: e.x, rot: 0 });
    this.sway = Math.min(1, this.sway + 0.3);
  }

  addVisitor(id: string, ttlSec = 8): void {
    const old = this.visitors.find((v) => v.id === id);
    if (old) { old.ttl = old.t + ttlSec; return; }
    if (this.visitors.length >= 4) return;
    const slot = this.visitors.length;
    const g = this.g;
    const sx = this.visitorSpot(id, slot);
    const fromRight = sx > this.w * 0.5;
    this.visitors.push({ id, t: 0, ttl: ttlSec, x: sx, y: this.visitorY(id), fromX: fromRight ? this.w + 40 * g.U : -40 * g.U, slot, dir: fromRight ? -1 : 1 });
  }
  clearVisitors(): void { for (const v of this.visitors) v.ttl = Math.min(v.ttl, v.t + 0.01); }

  private visitorSpot(id: string, slot: number): number {
    const g = this.g;
    if (id.startsWith('cust')) return g.dockX - (g.land ? 70 : -70) * g.U * 0.9 + (g.land ? -1 : 1) * slot * 30 * g.U;
    if (id === 'xu') return g.pileX + 26 * g.U;
    if (id === 'newton') return g.treeX - g.treeS * 70;
    if (id === 'santa') return g.land ? g.boxX + 34 * g.U : g.boxX + 40 * g.U;
    if (id === 'duoduo') return g.boxX + 30 * g.U;
    return g.pileX + (60 + slot * 28) * g.U;
  }
  private visitorY(id: string): number {
    const g = this.g;
    if (id.startsWith('cust')) return g.gyR + 12 * g.U;
    return g.pileY + 6 * g.U;
  }

  /* ───────── 命中 ───────── */
  private evR(): number { return Math.max(30 * this.g.U, 24); }
  evHit(x: number, y: number): boolean {
    const e = this.ev;
    if (!e || e.caught) return false;
    const cy = e.kind === 'newton' ? e.y - 18 * this.g.U : e.y;
    return Math.hypot(x - e.x, y - cy) < this.evR();
  }
  catchEv(): void {
    const e = this.ev;
    if (!e) return;
    e.caught = 0.8;
    this.ring(e.x, e.y, true);
    for (let i = 0; i < 8; i++) this.part(e.x, e.y, (Math.random() - 0.5) * 120, -50 - Math.random() * 50, 0.7, 3, 1, true);
    e.cb(true);
  }
  private inTree(x: number, y: number): boolean {
    const g = this.g;
    const c = this.crown();
    return Math.abs(x - g.treeX) < Math.max(c.rx, 40 * g.treeS) * 1.05 && y < g.gyA + 6 && y > c.y - c.ry * 1.1;
  }
  hit(x: number, y: number): Hit {
    if (this.ev && this.evHit(x, y)) return 'event';
    if (this.inTree(x, y)) return 'source';
    const g = this.g;
    const dw = DEPOT_W * 0.55 * g.dockS;
    if (Math.abs(x - g.dockX) < dw / 2 && y < g.gyR + 6 && y > g.gyR - 70 * g.dockS) return 'dock';
    return 'none';
  }

  private pestPos(p: { side: -1 | 1; pos: number }): { x: number; y: number } {
    const g = this.g;
    const edge = p.side < 0 ? this.insL + 6 : this.w - this.insR - 6;
    const tx = g.treeX + p.side * 34 * g.U;
    return { x: lerp(edge, tx, clamp(p.pos, 0, 1)), y: g.gyA + 10 * g.U + Math.sin(this.t * 6 + p.side) * 0.8 };
  }
  private orderPos(i: number): { x: number; y: number } {
    const g = this.g;
    const dirx = g.land ? -1 : 1;
    return { x: g.dockX + dirx * (g.dockS * 52 + 14 * g.U + i * 34 * g.U), y: g.gyR + 15 * g.U };
  }

  /** 场景热点 → sys 的 TAP_TARGETS id(没有对应物返回 null) */
  tapTarget(x: number, y: number): string | null {
    const g = this.g;
    const wv = this.wv;
    if (this.ev?.kind === 'newton' && this.evHit(x, y)) return 'newton';
    for (const p of wv.pests ?? []) {
      const q = this.pestPos(p);
      if (Math.hypot(x - q.x, y - (q.y - 8 * g.U)) < 26 * Math.max(1, g.U)) return `pest:${p.id}`;
    }
    const ods = (wv.orders ?? []).slice(0, 3);
    for (let i = 0; i < ods.length; i++) {
      const q = this.orderPos(i);
      if (Math.abs(x - q.x) < 24 * g.kc && y > q.y - 74 * g.kc && y < q.y + 4) return `order:${ods[i].id}`;
    }
    if ((wv.rot ?? 0) > 0 && Math.abs(x - g.pileX) < 44 * g.U && y > g.pileY - 30 * g.U && y < g.pileY + 8 * g.U) return 'rot';
    for (const v of this.visitors) {
      if (Math.abs(x - v.x) < 22 * g.kc && y > v.y - 48 * g.kc && y < v.y + 4) {
        if (v.id === 'newton') return 'newton';
        if (v.id === 'xu') return 'xu';
      }
    }
    const xp = this.xuPos();
    if (xp && Math.abs(x - xp.x) < 24 * g.kc && y > xp.y - 52 * g.kc && y < xp.y + 8) return 'xu';
    // 车辆
    const kind = clamp(Math.round(wv.rtTier), 0, 7);
    const target = VEH_TARGET[kind];
    if (target) {
      const n = Math.min(4, Math.max(1, wv.rtVehicles));
      for (let i = 0; i < n; i++) {
        const p = this.vehPos(i, n);
        const hw = (TRANSPORT8_W[kind]?.[wv.rtBranch > 0 ? 1 : 0] ?? 40) * g.vs * 0.6;
        if (Math.abs(x - p.x) < hw && y > p.y - 50 * g.vs && y < p.y + 6) return target;
      }
    }
    // 月亮(夜间右上)
    if (this.isNight() && x > this.w * 0.68 && y < g.gyA * 0.3) return 'moon';
    // 建筑
    const tier = this.bldTier();
    if (tier > 0) {
      const bw = 480 * g.bldS * 0.5;
      const bh = 300 * g.bldS;
      if (Math.abs(x - g.bldX) < bw && y < g.gyA && y > g.gyA - bh) {
        if (tier === 3) return y < g.gyA - bh * 0.5 ? 'skyline' : x < g.bldX - bw * 0.4 ? 'garage' : null;
        if (tier === 2 && y < g.gyA - bh * 0.7) return 'summit-gold';
      }
    }
    // 树冠顶的果 / 树下落叶
    const c = this.crown();
    if (Math.abs(x - c.x) < c.rx * 0.5 && y < c.y - c.ry * 0.45 && y > c.y - c.ry * 1.1) return 'treetop-fruit';
    if (Math.abs(x - g.treeX) < 46 * g.U && y > g.gyA && y < g.gyA + 22 * g.U) return 'leaf-under';
    return null;
  }

  worldPos(): { src: [number, number]; dock: [number, number] } {
    const g = this.g;
    return { src: [g.treeX, g.gyA], dock: [g.dockX, g.gyR] };
  }

  /* ───────── 状态同步 ───────── */
  private syncVehs(): void {
    const n = Math.min(4, Math.max(1, this.wv.rtVehicles));
    while (this.fleetU.length < n) this.fleetU.push(-1);
    this.fleetU.length = n;
  }
  private fleetCycle(): number { return TRIP8[clamp(Math.round(this.wv.rtTier), 0, 7)] / Math.max(0.6, 0.6 + Math.log10(1 + this.wv.carry) * 0.12); }
  private vehPos(i: number, n: number): { x: number; y: number; phase: number } {
    const g = this.g;
    const kind = clamp(Math.round(this.wv.rtTier), 0, 7);
    const r = runPhase(this.fleetT / this.fleetCycle() + i / n, TRANSPORT8_FLIES[kind]);
    return { x: lerp(g.r0, g.r1, r.pos), y: g.gyR - (Number(r.o.fly) || 0) * 26 * g.vs, phase: r.phase };
  }
  /** 老徐站位(null=未雇) */
  private xuPos(): { x: number; y: number; spot: 'ground' | 'treehouse' | 'basket' | 'top' } | null {
    const lv = this.wv.helpers ?? 0;
    if (lv <= 0) return null;
    const g = this.g;
    const idx = clamp(Math.round(this.wv.srcTier ?? 0), 0, 4);
    if (idx >= 2) {
      const a = treeAnchorsIdx(idx, g.treeS, (this.wv.srcVariant ?? 0) as 0 | 1);
      const spot = idx === 2 ? 'treehouse' : idx === 3 ? 'basket' : 'top';
      const q = a[spot];
      if (q) return { x: g.treeX + q.x, y: g.gyA + q.y, spot };
    }
    return { x: g.pileX + 26 * g.U, y: g.pileY + 8 * g.U, spot: 'ground' };
  }

  private isNight(): boolean {
    const h = this.hour();
    return h >= 19.5 || h < 5.5;
  }
  private hour(): number {
    const h = this.wv?.hour;
    return typeof h === 'number' && isFinite(h) ? ((h % 24) + 24) % 24 : this.dark ? 23 : 12;
  }
  private bldTier(): number { return clamp(Math.round(this.wv?.srcTier ?? 0), 0, 5); }

  private ring(x: number, y: number, big: boolean): void { this.part(x, y, 0, 0, big ? 0.7 : 0.5, big ? 26 * this.g.U : 15 * this.g.U, 2, big); }
  private part(x: number, y: number, vx: number, vy: number, life: number, size: number, kind: 0 | 1 | 2, gold: boolean): void {
    for (const p of this.parts) {
      if (p.on) continue;
      Object.assign(p, { on: true, x, y, vx, vy, life: 0, max: life, size, kind, gold });
      return;
    }
  }
  private say(s: string, x: number, y: number, col: string): void {
    let f = this.floats.find((q) => !q.on);
    if (!f) f = this.floats.reduce((a, b) => (a.t > b.t ? a : b));
    Object.assign(f, { on: true, s, x, y, t: 0, col });
  }

  /* ───────── 更新 ───────── */
  update(dt: number): void {
    const wv = this.wv;
    const g = this.g;
    this.t += dt;
    const rm = this.reduced;
    this.sway = Math.max(0, this.sway - dt * 1.6);
    this.xuPose = Math.max(0, this.xuPose - dt);
    this.fwV += ((wv.shake ?? 0) - this.fwV) * Math.min(1, dt * 6);
    this.progV += (this.progT - this.progV) * Math.min(1, dt * 3);
    this.pileV += (clamp(wv.stock01, 0, 1) * 22 - this.pileV) * Math.min(1, dt * 4);
    for (const k of ['giftPop', 'srcPop', 'rtPop', 'dockPop'] as const) this[k] = Math.max(0, this[k] - dt * 2.2);
    this.crateT -= dt;
    if (this.crateT <= 0) { this.crateT = 1.1; if (this.crates > 0) this.crates--; }

    // 树上自动掉果入堆
    if (wv.stock01 < 0.985 && !rm) {
      this.emitAcc += dt * clamp(0.45 + Math.log10(1 + wv.produce) * 0.9, 0.45, 4.5);
      while (this.emitAcc >= 1) {
        this.emitAcc -= 1;
        const e = this.emit();
        this.fl.spawn(e.x, e.y, g.pileX + (Math.random() - 0.5) * 18 * g.U, g.pileY - 8 * g.U, 0.6, 10 * g.U, 0);
      }
    } else this.emitAcc = 0;

    // 车队:统一时钟;头车到达卸货段 → 收货
    {
      const kind = clamp(Math.round(wv.rtTier), 0, 7);
      const cyc = this.fleetCycle();
      this.fleetT += dt;
      const n = Math.min(4, Math.max(1, wv.rtVehicles));
      this.syncVehs();
      for (let i = 0; i < n; i++) {
        const u = (this.fleetT / cyc + i / n) % 1;
        const prev = this.fleetU[i];
        this.fleetU[i] = u;
        if (prev >= 0 && prev < 0.5 && u >= 0.5 && wv.stock01 >= 0.02) {
          this.dockPop = 1;
          this.recvT = 1;
          this.crates = Math.min(10, this.crates + 1);
          this.crateT = 1.1;
          if (wv.perTrip) this.say(`+${fmt(wv.perTrip)}`, g.dockX, g.gyR - 78 * g.dockS, APPLE);
          this.part(g.dockX, g.gyR - 36 * g.dockS, 0, -10, 0.6, 4, 1, true);
        }
      }
      void kind;
      this.recvT = Math.max(0, this.recvT - dt * 1.2);
      // 终点满了(礼物送齐):雪橇升空远去,约 5 秒后循环
      if (this.progFull && this.progV >= 0.999) this.takeoff = this.takeoff >= 1 ? 1 : Math.min(1, this.takeoff + dt / 5);
      else this.takeoff = Math.max(0, this.takeoff - dt);
    }

    this.fl.update(dt, (f) => {
      if (f.kind === 1) {
        this.dockPop = Math.max(this.dockPop, 0.7);
        this.part(f.x1, f.y1, 0, -10, 0.5, 3, 1, true);
      }
    });
    this.fw.update(dt);
    if (this.leaves.length) stepLeaves(this.leaves, dt);

    // 摇树落果:落地的苹果按品种 landFx,然后飞进库存堆
    this.fallCd = Math.max(0, this.fallCd - dt);
    if (this.fall.length) {
      const landed = stepFall(this.fall, dt);
      for (const f of landed) {
        const x = g.treeX + f.x * g.treeS, y = g.gyA + f.y * g.treeS;
        this.landFx.push({ kind: f.kind, x, y, t: 0 });
        this.fl.spawn(x, y - 4 * g.U, g.pileX + (Math.random() - 0.5) * 16 * g.U, g.pileY - 6 * g.U, 0.5 + Math.random() * 0.2, 14 * g.U, 0);
        f.type = 'leaf'; f.scale = 0; // 苹果已转为飞行体,本体不再画
      }
      for (let i = this.fall.length - 1; i >= 0; i--) { const f = this.fall[i]; if (f.landed && f.landT > (f.type === 'leaf' ? 1.4 : 0.7)) this.fall.splice(i, 1); }
      if (fallDone(this.fall)) this.fall.length = 0;
    }
    for (let i = this.landFx.length - 1; i >= 0; i--) { this.landFx[i].t += dt; if (this.landFx[i].t > 1.2) this.landFx.splice(i, 1); }

    // 掉落苹果
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.t += dt;
      if (d.ph === 0) {
        d.vy += 900 * g.U * dt * (appleFxFor(d.kind).fastFall ?? 1);
        d.y += d.vy * dt;
        d.rot += dt * 4;
        if (d.y >= d.gy) { d.y = d.gy; d.vy = -d.vy * 0.35; d.ph = d.vy > -30 ? 3 : 0; d.t = 0; this.part(d.x, d.y, 0, -8, 0.3, 2, 0, false); d.x0 = d.x; }
      } else if (d.ph === 3) {
        // 落地展示品种效果,再滚进堆
        const hold = appleFxFor(d.kind).bounce || appleFxFor(d.kind).quake || appleFxFor(d.kind).roll ? 0.6 : 0.18;
        if (d.t > hold) { d.ph = 1; d.t = 0; d.x0 = d.x; }
      } else if (d.ph === 1) {
        const k = clamp(d.t / 0.7, 0, 1);
        d.x = lerp(d.x0, g.pileX, ease(k));
        d.y = d.gy + (g.pileY - d.gy) * k - Math.sin(k * Math.PI) * 4;
        d.rot += dt * 6;
        if (k >= 1) { d.ph = 2; d.t = 0; this.pileV += 1; }
      } else if (d.t > 0.25) this.drops.splice(i, 1);
    }

    // 粒子/飘字
    for (const p of this.parts) {
      if (!p.on) continue;
      p.life += dt;
      if (p.life >= p.max) { p.on = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind !== 2) p.vy += 120 * dt;
    }
    for (const f of this.floats) { if (!f.on) continue; f.t += dt; if (f.t > 1.3) f.on = false; }

    // 访客
    for (let i = this.visitors.length - 1; i >= 0; i--) {
      const v = this.visitors[i];
      v.t += dt;
      if (v.t > v.ttl + 0.9) this.visitors.splice(i, 1);
    }

    // 事件
    const e = this.ev;
    if (e) {
      e.t += dt;
      this.evPos(e);
      if (e.caught > 0) { e.caught -= dt; if (e.caught <= 0) this.ev = null; }
      else if (e.t >= e.dur) { this.ev = null; e.cb(false); }
    }
  }

  private evPos(e: Ev): void {
    const g = this.g;
    const f = e.t / e.dur;
    if (e.kind === 'bird') {
      e.x = lerp(-24, this.w + 24, f);
      e.y = g.gyA * 0.3 + Math.sin(f * 9) * 8 * g.U;
    } else if (e.kind === 'meteor') {
      e.x = lerp(this.w * 0.88, this.w * 0.3, f);
      e.y = lerp(-10, g.gyA - 24 * g.U, f);
    } else {
      e.x = lerp(this.w + 24, -24, f);
      e.y = g.gyA + 10 * g.U;
    }
  }

  /* ───────── 绘制 ───────── */
  draw(showHint: boolean): void {
    const c = this.c;
    const { w, h, dpr, g } = this;
    const wv = this.wv;
    const t = this.t;
    const rm = this.reduced;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    setUnit(1);
    c.globalAlpha = 1;

    // 背景(天空/远山/草地):缓存到离屏,每 0.25s 刷新(云漂移)
    this.paintBack(t);
    c.drawImage(this.bgBuf!, 0, 0, w, h);

    // 建筑(生产档)
    const bt = this.bldTier();
    if (bt > 0) {
      const pop = 1 + 0.06 * Math.sin(this.srcPop * Math.PI);
      drawBuilding(c, g.bldX, g.gyA, g.bldS * pop, { tier: bt as 1, variant: ((wv.srcVariant ?? 0) & 1) as 0 | 1 });
    }

    // 树
    const shake = rm ? 0 : clamp(this.sway * 1.1 + this.fwV * 0.45, 0, 1);
    const tpop = 1 + 0.08 * Math.sin(this.srcPop * Math.PI) * (this.srcPop > 0 ? 1 : 0);
    drawTree(c, g.treeX, g.gyA, g.treeS * tpop, { tier: this.tierOf() as 1, variant: ((wv.srcVariant ?? 0) > 0 ? 1 : 0) as 0 | 1, seed: 7, shake, t, fruit: 0.8 });
    if (this.fall.length) drawFall(c, this.fall, g.treeX, g.gyA, g.treeS);
    for (const f of this.landFx) drawLandFx(c, f.kind, f.t, f.x, f.y, g.treeS * 0.5);
    if (this.leaves.length) drawLeaves(c, this.leaves, 1);

    // 礼物盒
    // 终点礼物堆已并入圣诞老人收货站(drawSantaDepot level=送达进度)

    // 堆场
    this.drawPile(c);
    if (wv.stock01 >= 0.985) { setUnit(1); text(c, '运不完 →', g.r0 + (g.land ? 40 : -40) * g.U, g.gyR - 34 * g.U, 11 * Math.max(1, g.U), APPLE); }
    else if (wv.stock01 < 0.03 && wv.carry > wv.produce * 1.6) text(c, '货不够', g.pileX, g.pileY - 30 * g.U, 11 * Math.max(1, g.U), P.dim);

    // 关卡
    // 码头
    this.drawDockAndVehicles(c);
    // 烂果
    this.drawRot(c);
    // 访客与老徐
    this.drawPeople(c);
    this.drawOrders(c);
    this.drawPests(c);
    if (wv.gold) this.drawGold(c);
    // 掉落苹果
    this.drawDrops(c);
    // 飞行苹果
    const spr = this.sprFly;
    const m = spr.meta!;
    this.fl.draw(c, { sprite: (cc, x, y, r) => drawAppleAt(cc, spr, x, y, r / m.r), r0: 6 * g.U, r1: 6.5 * g.U, reduceMotion: rm });
    this.fw.draw(c);
    this.drawEvent(c);
    this.drawParts(c);
    if (wv.weather === 'rain' || wv.weather === 'snow') this.drawWeather(c, wv.weather);
    if (showHint) this.drawHint(c);
    c.globalAlpha = 1;
    // 浮字
    for (const f of this.floats) {
      if (!f.on) continue;
      const k = f.t / 1.3;
      c.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      text(c, f.s, f.x, f.y - ease(k) * 26 * g.U, 14 * Math.max(1, g.U * 0.9), f.col);
    }
    c.globalAlpha = 1;
    if (wv.combo >= 3) {
      const cr = this.crown();
      text(c, `连摇 ×${wv.combo}`, g.treeX, cr.y - cr.ry - 16 * g.U, 11 * Math.max(1, g.U), P.dim);
    }
    // 前景草(盖住车轮底边)
    drawBackdrop(c, w, h, t, { ...backdropForHour(this.hour()), layers: 'front', still: rm });
  }

  private paintBack(t: number): void {
    const { w, h, dpr } = this;
    const hr = this.hour();
    const key = `${w}x${h}@${dpr}|${Math.round(hr * 4)}|${this.reduced ? 1 : 0}`;
    if (!this.bgBuf) this.bgBuf = document.createElement('canvas');
    const cvs = this.bgBuf;
    const resized = cvs.width !== Math.round(w * dpr) || cvs.height !== Math.round(h * dpr);
    if (resized) { cvs.width = Math.round(w * dpr); cvs.height = Math.round(h * dpr); this.bgKey = ''; }
    if (key === this.bgKey && t - this.bgT < 0.25) return;
    if (key === this.bgKey && this.reduced) return;
    this.bgKey = key;
    this.bgT = t;
    const b = cvs.getContext('2d')!;
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.clearRect(0, 0, w, h);
    drawBackdrop(b, w, h, t, { ...backdropForHour(hr), layers: 'back', still: this.reduced });
  }

  private drawPile(c: C): void {
    const g = this.g;
    const lv = clamp(this.pileV / 22, 0, 1);
    if (lv <= 0.01) return;
    drawStockPile(c, g.pileX, g.pileY, g.treeS * 0.62, lv, { seed: 5 });
  }

  private drawDockAndVehicles(c: C): void {
    const g = this.g;
    const wv = this.wv;
    const kind = clamp(Math.round(wv.rtTier), 0, 7);
    const pop = 1 + 0.06 * Math.sin(this.dockPop * Math.PI);
    if (kind === 4) this.drawWater(c);
    // 终点:圣诞老人收货站(礼物堆=送达进度;最终档雪橇升空)
    drawSantaDepot(c, g.dockX, g.gyR, g.dockS * 0.55 * pop, { level: clamp(this.progV, 0, 1), receive: this.recvT, takeoff: this.takeoff, t: this.t });
    // 车队:四段匀速;竖屏 r0>r1 时镜像
    const n = Math.min(4, Math.max(1, wv.rtVehicles));
    const vpop = 1 + 0.08 * Math.sin(this.rtPop * Math.PI);
    c.save();
    const flip = g.r1 < g.r0;
    if (flip) c.scale(-1, 1);
    drawFleet(c, kind, g.gyR, g.vs * vpop, { n, cycle: this.fleetCycle(), x0: flip ? -g.r0 : g.r0, x1: flip ? -g.r1 : g.r1, branch: (wv.rtBranch > 0 ? 1 : 0), t: this.fleetT, seed: 3 });
    c.restore();
    if (wv.rtVehicles > 4) {
      const W = (TRANSPORT8_W[kind]?.[wv.rtBranch > 0 ? 1 : 0] ?? 40) * g.vs;
      const dir = flip ? 1 : -1;
      text(c, `×${wv.rtVehicles}`, g.r0 + dir * (W / 2 + 14 * g.U), g.gyR - 6, 12 * Math.max(1, g.U), P.ink);
    }
  }

  private drawRot(c: C): void {
    const n = Math.min(6, Math.round(this.wv.rot ?? 0));
    if (n <= 0) return;
    const g = this.g;
    const spr = appleSprite('fuji', 'rotten', 40);
    const s = (5.4 * g.U) / spr.meta!.r;
    for (let i = 0; i < n; i++) {
      const x = g.pileX + ((i % 3) - 1) * 13 * g.U + (i > 2 ? 6 * g.U : 0);
      const y = g.pileY - 4 * g.U + (i > 2 ? -9 * g.U : 3 * g.U);
      drawAppleAt(c, spr, x, y, s);
      if (!this.reduced) {
        c.globalAlpha = 0.5;
        c.fillStyle = '#8a9a3a';
        const k = (this.t * 0.6 + i * 0.37) % 1;
        c.beginPath(); c.arc(x + Math.sin(k * 7 + i) * 3, y - 6 * g.U - k * 12 * g.U, 1.4 * g.U, 0, TAU); c.fill();
        c.globalAlpha = 1;
      }
    }
  }

  private drawPests(c: C): void {
    const g = this.g;
    for (const p of this.wv.pests ?? []) {
      const q = this.pestPos(p);
      if (/crow|bird|鸟|鸦/.test(p.kind)) {
        drawCharacter(c, 'crow', q.x, q.y - 4 * g.U, 0.9 * g.kc, { t: this.t, dir: (-p.side) as 1 | -1, seed: p.id });
        continue;
      }
      // 虫:墨线小毛虫,朝树爬
      const dir = -p.side;
      c.save();
      c.translate(q.x, q.y);
      c.scale(dir * 1.25 * g.U, 1.25 * g.U);
      c.strokeStyle = P.ink; c.lineWidth = 1.2; c.fillStyle = /worm|蛀|虫/.test(p.kind) ? '#e9d9a8' : '#8fb04a';
      const wob = this.reduced ? 0 : Math.sin(this.t * 9 + p.id) * 1.2;
      for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(-k * 3.6, -3 + (k % 2 ? wob : -wob) * 0.5, 3.2 - k * 0.2, 0, TAU); c.fill(); c.stroke(); }
      c.beginPath(); c.arc(3.4, -3.6, 0.8, 0, TAU); c.fillStyle = P.ink; c.fill();
      c.restore();
    }
  }

  private drawOrders(c: C): void {
    const g = this.g;
    const ods = (this.wv.orders ?? []).slice(0, 3);
    const spr = appleSprite('fuji', 'fresh', 32);
    for (let i = 0; i < ods.length; i++) {
      const o = ods[i];
      const q = this.orderPos(i);
      const kind = (`cust${1 + (((o.customer | 0) % 3) + 3) % 3}`) as CharKind;
      drawCharacter(c, kind, q.x, q.y, g.kc, { t: this.t, pose: 'idle', dir: (g.land ? 1 : -1) as 1 | -1, seed: o.customer });
      // 气泡
      const bx = q.x, by = q.y - 62 * g.kc;
      const bw = 40 * Math.max(1, g.U), bh = 18 * Math.max(1, g.U);
      const urgent = o.expiresIn < 6 && !this.reduced && Math.floor(this.t * 3) % 2 === 0;
      c.save();
      c.fillStyle = P.paper; c.strokeStyle = urgent ? APPLE : P.ink; c.lineWidth = 1.4;
      c.beginPath(); c.roundRect(bx - bw / 2, by - bh / 2, bw, bh, 6); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(bx - 4, by + bh / 2); c.lineTo(bx, by + bh / 2 + 5); c.lineTo(bx + 4, by + bh / 2); c.fillStyle = P.paper; c.fill(); c.stroke();
      drawAppleAt(c, spr, bx - bw * 0.26, by + 0.5, (6 * Math.max(1, g.U)) / spr.meta!.r);
      c.restore();
      text(c, `×${o.qty}`, bx + bw * 0.16, by + 4, 11 * Math.max(1, g.U * 0.9), P.ink);
    }
  }

  private drawGold(c: C): void {
    const g = this.g;
    const cr = this.crown();
    const x = cr.x + cr.rx * 0.2, y = cr.y - cr.ry * 0.78;
    drawGoldHalo(c, x, y, 1.6 * g.U, { t: this.t });
    const spr = appleSprite('golden', 'shiny', 40);
    drawAppleAt(c, spr, x, y, (8 * g.U) / spr.meta!.r);
  }

  /** 船道:码头到装货点之间的一条水面 */
  private drawWater(c: C): void {
    const g = this.g;
    const x0 = Math.min(g.r0, g.r1) - 30 * g.U, x1 = Math.max(g.r0, g.r1) + 30 * g.U;
    const y0 = g.gyR - 9 * g.U, hh = 20 * g.U;
    c.save();
    const gr = c.createLinearGradient(0, y0, 0, y0 + hh);
    gr.addColorStop(0, this.isNight() ? '#2c4a6a' : '#9ccbe0');
    gr.addColorStop(1, this.isNight() ? '#1d3550' : '#6fa9c8');
    c.fillStyle = gr;
    c.beginPath(); c.roundRect(x0, y0, x1 - x0, hh, hh / 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.2;
    c.beginPath();
    for (let x = x0 + 20 * g.U; x < x1 - 20 * g.U; x += 34 * g.U) {
      const ph = this.reduced ? 0 : Math.sin(this.t * 1.6 + x * 0.05) * 2;
      c.moveTo(x + ph, y0 + hh * 0.45); c.quadraticCurveTo(x + 6 * g.U + ph, y0 + hh * 0.3, x + 12 * g.U + ph, y0 + hh * 0.45);
    }
    c.stroke();
    c.restore();
  }

  private charKind(id: string): CharKind | null {
    switch (id) {
      case 'xu': case 'newton': case 'santa': case 'cust1': case 'cust2': case 'cust3': case 'crow': case 'manman': case 'haihai': case 'dudu': case 'doorman': case 'duoduo': return id;
      default: return null;
    }
  }

  private drawPeople(c: C): void {
    const g = this.g;
    const wv = this.wv;
    const t = this.t;
    // 老徐:按等级(helpers=1..8)+状态(xuMode);巨树起住树屋/吊篮/树顶
    const xp = this.xuPos();
    if (xp && !this.visitors.some((v) => v.id === 'xu')) {
      const mode = wv.xuMode ?? 'work';
      const ground = xp.spot === 'ground';
      const woke = this.xuPose > 0 && mode !== 'work';
      const state = woke ? 'wake' : mode === 'nap' ? 'nap' : mode === 'watch' ? 'watch' : mode === 'slack' ? (ground ? 'sit' : 'idle') : ground ? (this.xuPose > 0 ? 'shake' : 'help') : this.xuPose > 0 ? 'cheer' : 'clap';
      drawLaoXuAt(c, xp.spot, xp.x, xp.y, ground ? g.kc * 0.62 : Math.max(0.7, g.kc * 0.8), { lv: clamp(Math.round(wv.helpers ?? 1), 1, 8), t, dir: -1, seed: 5, state } as never);
    }
    for (const v of this.visitors) {
      const kind = this.charKind(v.id);
      if (!kind) continue;
      const inK = ease(clamp(v.t / 0.9, 0, 1));
      const outK = v.t > v.ttl ? ease(clamp((v.t - v.ttl) / 0.9, 0, 1)) : 0;
      const x = lerp(v.fromX, v.x, inK) + (v.fromX - v.x) * outK;
      const walking = inK < 1 || outK > 0;
      const dir = (walking ? (outK > 0 ? -v.dir : v.dir) : (v.x > this.w * 0.5 ? -1 : 1)) as 1 | -1;
      if (kind === 'crow') {
        const cr = this.crown();
        drawCharacter(c, 'crow', cr.x + cr.rx * 0.5, cr.y - cr.ry * 0.9, 0.9 * g.kc, { t, dir: -1, seed: 2 });
        continue;
      }
      drawCharacter(c, kind, x, v.y, g.kc, { t, pose: walking ? 'idle' : kind.startsWith('cust') ? 'cheer' : 'idle', dir, seed: 9 + v.slot });
    }
  }

  private drawDrops(c: C): void {
    const g = this.g;
    for (const d of this.drops) {
      const spr = appleSprite(d.kind, d.state as 'fresh', 48);
      const m = spr.meta!;
      const s = (9 * g.U) / m.r;
      if (d.golden) drawGoldHalo(c, d.x, d.y, 1.4 * g.U, { t: this.t, alpha: d.ph === 2 ? 1 - d.t / 0.25 : 1 });
      drawAppleAt(c, spr, d.x, d.y - (d.ph === 0 ? 0 : 8 * g.U * 0.4), s, d.ph === 2 ? 1 - d.t / 0.25 : 1);
    }
  }

  private drawEvent(c: C): void {
    const e = this.ev;
    if (!e) return;
    const g = this.g;
    const t = this.t;
    const a = e.caught > 0 ? e.caught / 0.8 : 1;
    c.globalAlpha = a;
    if (e.kind === 'bird') {
      drawCharacter(c, 'crow', e.x, e.y, 1.1 * g.kc, { t, dir: 1, seed: 4, pose: e.caught > 0 ? 'hit' : 'idle' });
    } else if (e.kind === 'newton') {
      drawCharacter(c, 'newton', e.x, e.y, g.kc, { t, dir: -1, pose: e.caught > 0 ? 'catch' : 'idle', p: e.caught > 0 ? 1 - e.caught / 0.8 : undefined, seed: 6 });
    } else {
      // 流星:带金色拖尾的苹果
      const f = e.t / e.dur;
      const tx = this.w * 0.88, ty = -10;
      c.save();
      c.lineCap = 'round';
      const dx = e.x - tx, dy = e.y - ty;
      const L = Math.hypot(dx, dy) || 1;
      const tail = Math.min(L, 90 * g.U);
      const grad = c.createLinearGradient(e.x, e.y, e.x - (dx / L) * tail, e.y - (dy / L) * tail);
      grad.addColorStop(0, 'rgba(255,214,90,0.9)');
      grad.addColorStop(1, 'rgba(255,214,90,0)');
      c.strokeStyle = grad;
      c.lineWidth = 6 * g.U;
      c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.x - (dx / L) * tail, e.y - (dy / L) * tail); c.stroke();
      c.restore();
      drawGoldHalo(c, e.x, e.y, 1.7 * g.U, { t, alpha: a });
      const spr = appleSprite('golden', 'shiny', 48);
      drawAppleAt(c, spr, e.x, e.y, (11 * g.U) / spr.meta!.r, a);
      void f;
    }
    c.globalAlpha = 1;
  }

  private drawParts(c: C): void {
    const g = this.g;
    for (const p of this.parts) {
      if (!p.on) continue;
      const k = p.life / p.max;
      c.globalAlpha = 1 - k;
      const col = p.gold ? '#f2b705' : P.ink;
      if (p.kind === 2) {
        c.beginPath();
        c.arc(p.x, p.y, p.size * (0.3 + k * 0.9), 0, TAU);
        c.strokeStyle = p.gold ? '#f2b705' : P.ink;
        c.lineWidth = 2;
        c.stroke();
      } else if (p.kind === 1) sparkle(c, p.x, p.y, p.size * (1 - k * 0.4) * Math.max(1, g.U), col, k * 3);
      else { c.beginPath(); c.arc(p.x, p.y, p.size * 0.6, 0, TAU); c.fillStyle = col; c.fill(); }
    }
    c.globalAlpha = 1;
  }

  private drawWeather(c: C, kind: string): void {
    const { w, h, t } = this;
    const n = this.reduced ? 18 : 46;
    c.save();
    if (kind === 'rain') {
      c.strokeStyle = this.isNight() ? 'rgba(190,210,235,0.55)' : 'rgba(70,100,150,0.7)';
      c.lineWidth = 1.5;
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const x = ((i * 97.13) % 1) * w + ((i * 53) % w);
        const px = ((i * 0.6180339) % 1) * w;
        const y = (((t * 1.3 + i * 0.173) % 1) * (h + 30)) - 15;
        c.moveTo(px, y); c.lineTo(px - 3, y + 11);
        void x;
      }
      c.stroke();
    } else {
      c.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < n; i++) {
        const px = (((i * 0.6180339) % 1) * w + Math.sin(t * 0.8 + i) * 8 + w) % w;
        const y = (((t * 0.22 + i * 0.137) % 1) * (h + 10)) - 5;
        c.beginPath(); c.arc(px, y, 1.6 + (i % 3) * 0.5, 0, TAU); c.fill();
      }
    }
    c.restore();
  }

  /** 首次引导:树冠上方一根手指轻点 */
  private drawHint(c: C): void {
    const g = this.g;
    const cr = this.crown();
    const cyc = this.reduced ? 0.3 : (this.t % 1.6) / 1.6;
    const tap = Math.sin(Math.min(1, cyc / 0.35) * Math.PI);
    const k = Math.max(1, g.U * 1.2);
    const x = g.treeX + cr.rx * 0.3;
    const y = cr.y + cr.ry * 0.1;
    c.save();
    c.translate(x, y + tap * 5 * k);
    c.rotate(-0.35);
    c.scale(k * 2.4, k * 2.4);
    c.globalAlpha = 0.92;
    c.fillStyle = P.f0;
    c.strokeStyle = P.ink;
    c.lineWidth = 1.2 / (k * 2.4);
    c.beginPath(); c.roundRect(-1.7, -2, 3.4, 9, 1.7); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(-3.6, 5.2, 7.2, 5.6, 2.4); c.fill(); c.stroke();
    c.restore();
    if (!this.reduced && cyc > 0.15 && cyc < 0.8) {
      const kk = (cyc - 0.15) / 0.65;
      c.globalAlpha = 1 - kk;
      c.beginPath(); c.arc(x, y, 6 + kk * 22 * k, 0, TAU);
      c.strokeStyle = '#f2b705'; c.lineWidth = 2; c.stroke();
      c.globalAlpha = 1;
    }
  }
}

void penApple;
