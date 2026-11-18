import Phaser from 'phaser';
import { MAP, WORLD_W, WORLD_H, REGIONS, BLOCK, t, regionAt } from '../core/data';
import { toTile } from '../core/iso';
import { L, minTouch } from './layout';
import { mkText, type LayerLike, type Rect } from './bubble';

const COL: Record<string, string> = { p: '#e8d9b0', c: '#a3a0a8', g: '#8cbf6a', r: '#b8745f', i: '#d4e8f4', w: '#5a90c8', d: '#9c7b53' };
const TEX_W = 400; // 小地图纹理宽（显示时缩放），高 = TEX_W/2 * ... 见 u

/** 迷你地图：等距菱形缩略图 + 帽子点 + 视口框；点击/拖动 → onNav(tx,ty) */
export class Minimap {
  private img!: Phaser.GameObjects.Image;
  private g: Phaser.GameObjects.Graphics;
  private zone: Phaser.GameObjects.Zone;
  private labels: Phaser.GameObjects.Text[] = [];
  private u = TEX_W / (WORLD_W + WORLD_H);   // 纹理里每格宽度单位
  private texH = Math.ceil(((WORLD_W + WORLD_H) * this.u) / 2) + 2;
  private disp = 1; private ox = 0; private oy = 0;
  private ver = -1;
  private anchor = { right: 0, top: 0 };
  private lastKey = '';
  hidden = false;

  constructor(private scene: Phaser.Scene, layer: LayerLike, private onNav: (tx: number, ty: number) => void) {
    const key = 'minimap_base';
    if (!scene.textures.exists(key)) {
      const c = scene.textures.createCanvas(key, TEX_W, this.texH)!;
      const x = c.getContext(); const u = this.u;
      x.clearRect(0, 0, TEX_W, this.texH);
      for (let ty = 0; ty < WORLD_H; ty++) for (let tx = 0; tx < WORLD_W; tx++) {
        const ch = MAP[ty]?.[tx] ?? 'g';
        x.fillStyle = COL[ch] ?? COL.g;
        const cx = (tx - ty + WORLD_H) * u, cy = ((tx + ty) * u) / 2;
        x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + u, cy + u / 2); x.lineTo(cx, cy + u); x.lineTo(cx - u, cy + u / 2); x.closePath(); x.fill();
      }
      c.refresh();
    }
    this.img = scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(40);
    const bg = scene.add.graphics().setDepth(39); this.bg = bg;
    this.g = scene.add.graphics().setDepth(42);
    this.zone = scene.add.zone(0, 0, 10, 10).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(43);
    layer.add(bg); layer.add(this.img); layer.add(this.g); layer.add(this.zone);
    for (const r of REGIONS) {
      const tx = r.bx * BLOCK + BLOCK / 2, ty = r.by * BLOCK + BLOCK / 2;
      const lb = mkText(scene, 0, 0, t(r.name), 11, '#33261c', { stroke: '#fff7e6', strokeThickness: 3 }).setOrigin(0.5).setDepth(41);
      (lb as any)._tile = [tx, ty]; (lb as any)._id = r.id; lb.setVisible(false); layer.add(lb); this.labels.push(lb);
    }
    const go = (p: Phaser.Input.Pointer, lp: { x: number; y: number }) => this.nav(lp.x, lp.y, p);
    this.zone.on('pointerdown', (p: Phaser.Input.Pointer, lx: number, ly: number) => go(p, { x: lx, y: ly }));
    this.zone.on('pointermove', (p: Phaser.Input.Pointer, lx: number, ly: number) => { if (p.isDown) go(p, { x: lx, y: ly }); });
  }
  private bg: Phaser.GameObjects.Graphics;

  /** zone 本地坐标（0..w,0..h，已含显示缩放）→ 世界格 */
  private nav(lx: number, ly: number, _p: Phaser.Input.Pointer) {
    const u = this.u * this.disp;
    const a = (lx - WORLD_H * u) / u, b = (ly / u) * 2 / 1;  // a = tx-ty (cx=(tx-ty+H)u), b = (tx+ty) (cy=(tx+ty)u/2)
    const tx = (a + b) / 2, ty = (b - a) / 2;
    this.onNav(Math.max(0.5, Math.min(WORLD_W - 0.5, tx)), Math.max(0.5, Math.min(WORLD_H - 0.5, ty)));
  }

  /** 布局：放在 HUD 右上按钮下方 */
  layout(anchor: { right: number; top: number }) { this.anchor = anchor; this.ver = -1; }

  get size() { return { w: TEX_W * this.disp, h: this.texH * this.disp }; }
  rect(): Rect | null {
    if (this.hidden) return null;
    const s = this.size; return { x0: this.ox - 4, y0: this.oy - 4, x1: this.ox + s.w + 4, y1: this.oy + s.h + 4 };
  }
  setHidden(h: boolean) { this.hidden = h; this.img.setVisible(!h); this.g.setVisible(!h); this.bg.setVisible(!h); this.zone.input!.enabled = !h;  }

  update(hat: { x: number; y: number }, corners: { x: number; y: number }[], force = false) {
    if (this.ver !== L.version) {
      this.ver = L.version;
      const wDisp = Phaser.Math.Clamp(Math.round(L.w * 0.17), 150, 230);
      this.disp = wDisp / TEX_W;
      const s = this.size;
      this.ox = this.anchor.right - s.w; this.oy = this.anchor.top + 6;
      this.img.setPosition(this.ox, this.oy).setScale(this.disp);
      this.zone.setPosition(this.ox, this.oy).setSize(s.w, s.h);
      this.zone.input!.hitArea.setSize(s.w, s.h);
      this.bg.clear().fillStyle(0x1b1626, 0.55).fillRoundedRect(this.ox - 4, this.oy - 4, s.w + 8, s.h + 8, 8)
        .lineStyle(1.5, 0xffe9b8, 0.5).strokeRoundedRect(this.ox - 4, this.oy - 4, s.w + 8, s.h + 8, 8);
      force = true;
    }
    const key = `${hat.x.toFixed(1)},${hat.y.toFixed(1)}|${corners.map((c) => c.x.toFixed(0) + ',' + c.y.toFixed(0)).join(';')}|${this.hidden}`;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    const u = this.u * this.disp;
    const px = (tx: number, ty: number) => ({ x: this.ox + (tx - ty + WORLD_H) * u, y: this.oy + ((tx + ty) * u) / 2 });
    for (const lb of this.labels) { const [tx, ty] = (lb as any)._tile; const p = px(tx, ty); lb.setPosition(p.x, p.y + u * 0.5); lb.setVisible(!this.hidden && (lb as any)._id === regionAt(hat.x, hat.y)?.id); }
    this.g.clear();
    // 视口框
    this.g.lineStyle(1.5, 0xffffff, 0.9);
    this.g.beginPath();
    corners.forEach((c, i) => { const tt = toTile(c.x, c.y); const p = px(tt.x, tt.y); if (i === 0) this.g.moveTo(p.x, p.y); else this.g.lineTo(p.x, p.y); });
    this.g.closePath(); this.g.strokePath();
    // 帽子
    const h = px(hat.x, hat.y);
    this.g.fillStyle(0xe8453c, 1).fillCircle(h.x, h.y, 3.5).lineStyle(1.5, 0xffffff, 1).strokeCircle(h.x, h.y, 3.5);
  }
}
void minTouch;
