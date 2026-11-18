import type Phaser from 'phaser';

type Obj = Phaser.GameObjects.GameObject & { setVisible(v: boolean): unknown };
interface Item { os: Obj[]; x: number; y: number; hw: number; hh: number; vis: boolean }

/** 视口裁剪：屏外对象 setVisible(false)，只在视图变化时重算。中心点 + 半宽半高 的矩形判交。 */
export class Culler {
  private items: Item[] = [];
  private lx = NaN; private ly = NaN; private lz = NaN;
  visible = 0;
  get total() { return this.items.length; }
  add(os: (Phaser.GameObjects.GameObject | undefined)[], x: number, y: number, hw: number, hh: number) {
    this.items.push({ os: os.filter(Boolean) as Obj[], x, y, hw, hh, vis: true });
  }
  /** view = camera.worldView；margin 额外外扩（像素） */
  update(view: Phaser.Geom.Rectangle, zoom: number, margin = 120, force = false) {
    if (!force && Math.abs(view.x - this.lx) < 16 && Math.abs(view.y - this.ly) < 16 && zoom === this.lz) return;
    this.lx = view.x; this.ly = view.y; this.lz = zoom;
    const x0 = view.x - margin, x1 = view.right + margin, y0 = view.y - margin, y1 = view.bottom + margin;
    let n = 0;
    for (const it of this.items) {
      const v = it.x + it.hw >= x0 && it.x - it.hw <= x1 && it.y + it.hh >= y0 && it.y - it.hh <= y1;
      if (v) n++;
      if (v !== it.vis) { it.vis = v; for (const o of it.os) o.setVisible(v); }
    }
    this.visible = n;
  }
}
