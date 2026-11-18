import Phaser from 'phaser';
import type { LayerLike } from '../ui/bubble';
import { toScreen, dist, clamp } from '../core/iso';
import { WORLD_W, WORLD_H } from '../core/data';
import { ART_SCALE, NATIVE_SCALE as NS } from '../art/scale';

/** 玩家的圣诞帽：在瓦片坐标里飘行，z 为离地高度(像素) */
export class Hat {
  x: number; y: number; z = 24;
  tx: number; ty: number; tz = 24;
  stage = 0; t = 0; speed = 5.5;
  attachedTo: string | null = null;
  arrivedCb?: () => void;
  spr: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image;
  trailT = 0; shake = 0; glowLevel = 0.2;
  moving = false;

  constructor(private scene: Phaser.Scene, layer: LayerLike, x: number, y: number) {
    this.x = this.tx = x; this.y = this.ty = y;
    this.shadow = scene.add.image(0, 0, 'p_shadow').setScale(0.5 * NS).setAlpha(0.45);
    this.glow = scene.add.image(0, 0, 'p_glow').setScale(1.3 * NS).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.2);
    this.spr = scene.add.image(0, 0, 'hat_0').setOrigin(0.5, 0.8).setScale(ART_SCALE);
    layer.add(this.shadow); layer.add(this.glow); layer.add(this.spr);
  }

  setStage(n: number) { this.stage = n; this.spr.setTexture(`hat_${n}`); }

  flyTo(x: number, y: number, z = 24, cb?: () => void) {
    this.tx = clamp(x, 0.3, WORLD_W - 0.3); this.ty = clamp(y, 0.3, WORLD_H - 0.3); this.tz = z; this.arrivedCb = cb;
  }

  get screen() { const s = toScreen(this.x, this.y); return { x: s.x, y: s.y - this.z }; }

  update(dt: number, sparkle: (x: number, y: number) => void) {
    this.t += dt;
    const d = dist(this.x, this.y, this.tx, this.ty);
    const spd = this.attachedTo || this.arrivedCb ? this.speed * 1.9 : this.speed;
    this.moving = d > 0.05 || Math.abs(this.z - this.tz) > 0.5;
    if (d > 0.04) {
      const step = Math.min(d, Math.max(1.2, spd * Math.min(1, d / 1.2 + 0.35)) * dt);
      this.x += ((this.tx - this.x) / d) * step; this.y += ((this.ty - this.y) / d) * step;
    }
    this.z += (this.tz - this.z) * Math.min(1, dt * 9);
    if (d <= 0.06 && Math.abs(this.z - this.tz) < 1.5 && this.arrivedCb) { const f = this.arrivedCb; this.arrivedCb = undefined; f(); }
    const s = toScreen(this.x, this.y);
    const idle = this.attachedTo ? 0 : Math.sin(this.t * 3) * 3;
    const sy = s.y - this.z + idle;
    this.shake = Math.max(0, this.shake - dt);
    const sh = this.shake > 0 ? Math.sin(this.t * 60) * 5 * (this.shake / 0.4) : 0;
    const lean = this.moving ? clamp((this.tx - this.x) * 0.12, -0.25, 0.25) : Math.sin(this.t * 2) * 0.05;
    const sc = (this.attachedTo ? 1.6 + Math.sin(this.t * 4) * 0.06 : 2) * NS; // 旧 setScale(k) → k*NS；k=2 即 ART_SCALE
    this.spr.setPosition(s.x + sh, sy).setRotation(lean + sh * 0.02).setScale(sc).setDepth(4000);
    this.glow.setPosition(s.x, sy).setDepth(3999).setAlpha(this.glowLevel * (0.85 + Math.sin(this.t * 3) * 0.15)).setScale((1.1 + this.glowLevel * 0.9) * NS);
    this.shadow.setPosition(s.x, s.y - 2).setDepth(3998).setScale(clamp(0.55 - this.z / 260, 0.18, 0.55) * NS, 0.18 * NS).setAlpha(this.attachedTo ? 0 : 0.4);
    if (this.moving) {
      this.trailT -= dt;
      if (this.trailT <= 0) { this.trailT = 0.05; sparkle(s.x + (Math.random() - 0.5) * 8, sy + 6); }
    }
  }
}
