import Phaser from 'phaser';
import { uiNine } from '../art/ui';
import { fromUi, L } from './layout';

/** 只负责把对象划给某个相机渲染 */
export interface LayerLike { add(o: Phaser.GameObjects.GameObject): unknown }

export const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';

export function mkText(scene: Phaser.Scene, x: number, y: number, str: string, size = 14, color = '#3a2a22', extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
  const tx = scene.add.text(x, y, str, { fontFamily: FONT, fontSize: size + 'px', color, fontStyle: 'bold', ...extra });
  tx.setResolution(2);
  tx.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return tx;
}

export interface Rect { x0: number; y0: number; x1: number; y1: number }
const hit = (a: Rect, b: Rect, m = 4) => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.y0 < b.y1 + m && a.y1 > b.y0 - m;

interface B {
  key: string; cont: Phaser.GameObjects.Container; tail: Phaser.GameObjects.Graphics;
  anchor: () => { x: number; y: number }; t: number; dur: number; w: number; h: number; placed: boolean;
}

/** 对话气泡：画在屏幕空间，自动避开 HUD / 招式面板 / 其他气泡 */
export class Bubbles {
  list: B[] = [];
  /** world → screen */
  constructor(
    private scene: Phaser.Scene, private layer: LayerLike,
    private toScr: (x: number, y: number) => { x: number; y: number },
    private obstacles: () => Rect[],
  ) {}

  show(key: string, anchor: () => { x: number; y: number }, text: string, dur = 3) {
    this.list.filter((b) => b.key === key).forEach((b) => this.kill(b));
    const tx = mkText(this.scene, 0, 0, text, 14, '#3a2a22', { wordWrap: { width: 190, useAdvancedWrap: true }, align: 'center', lineSpacing: 3 });
    const skin = this.scene.textures.exists('ui_bubble_normal');
    const w = Math.max(skin ? 56 : 44, tx.width + (skin ? 34 : 22)), h = tx.height + (skin ? 26 : 16);
    let g: Phaser.GameObjects.GameObject;
    if (skin) { g = uiNine(this.scene, 'ui_bubble_normal', 0, -h / 2, w, h); }
    else {
      const gg = this.scene.add.graphics();
      gg.fillStyle(0x4a3a30, 0.25).fillRoundedRect(-w / 2 + 2, -h + 3, w, h, 10);
      gg.fillStyle(0xfffaf0, 1).fillRoundedRect(-w / 2, -h, w, h, 10);
      gg.lineStyle(2, 0x5a4638, 1).strokeRoundedRect(-w / 2, -h, w, h, 10);
      g = gg;
    }
    tx.setOrigin(0.5, 0.5).setPosition(0, -h / 2);
    const tail = this.scene.add.graphics();
    const cont = this.scene.add.container(0, 0, [g, tail, tx]);
    cont.setDepth(250).setScale(0.2).setAlpha(0);
    this.layer.add(cont);
    this.list.push({ key, cont, tail, anchor, t: 0, dur, w, h, placed: false });
  }

  emote(anchor: () => { x: number; y: number }, str: string) {
    const tx = mkText(this.scene, 0, 0, str, 24, '#d9382c', { stroke: '#ffffff', strokeThickness: 4 });
    tx.setOrigin(0.5, 1).setDepth(245);
    this.layer.add(tx);
    const a = this.toScr(anchor().x, anchor().y);
    tx.setPosition(a.x + 16, a.y - 6);
    this.scene.tweens.add({ targets: tx, y: a.y - 26, duration: 380, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: tx, alpha: 0, delay: 800, duration: 300, onComplete: () => tx.destroy() });
  }

  private kill(b: B) { b.cont.destroy(); this.list = this.list.filter((x) => x !== b); }

  clear() { [...this.list].forEach((b) => this.kill(b)); }

  /** 供 qa：当前可见气泡（主相机屏幕逻辑坐标） */
  qaRects(): { id: string; kind: 'bubble'; x0: number; y0: number; x1: number; y1: number }[] {
    return this.list.filter((b) => b.placed && b.cont.alpha > 0.5 && b.t > 0.2).map((b) => {
      const a = fromUi(b.cont.x - b.w / 2, b.cont.y - b.h), e = fromUi(b.cont.x + b.w / 2, b.cont.y);
      return { id: 'bubble:' + b.key, kind: 'bubble' as const, x0: a.x, y0: a.y, x1: e.x, y1: e.y };
    });
  }

  update(dt: number) {
    const taken: Rect[] = [...this.obstacles()];
    const k = 1 - Math.exp(-dt * 16);
    for (const b of [...this.list]) {
      b.t += dt;
      if (b.t > b.dur + 0.35) { this.kill(b); continue; }
      const a = this.toScr(b.anchor().x, b.anchor().y);
      const hw = b.w / 2;
      const rectAt = (x: number, y: number): Rect => ({ x0: x - hw, y0: y - b.h, x1: x + hw, y1: y });
      const ok = (x: number, y: number) => x - hw >= L.x0 + 6 && x + hw <= L.x0 + L.w - 6 && y - b.h >= L.y0 + 6 && y <= L.y0 + L.h - 6 && !taken.some((r) => hit(rectAt(x, y), r));
      const px = Phaser.Math.Clamp(a.x, L.x0 + hw + 6, L.x0 + L.w - hw - 6), py = Phaser.Math.Clamp(a.y - 12, L.y0 + b.h + 8, L.y0 + L.h - 6);
      let bx = px, by = py;
      if (!ok(px, py)) {
        let best = Infinity;
        const cands: [number, number][] = [];
        for (const r of taken) {
          cands.push([px, r.y0 - 5], [px, r.y1 + 5 + b.h], [r.x0 - 5 - hw, py], [r.x1 + 5 + hw, py]);
          cands.push([px, a.y + 34 + b.h]);
        }
        // 兜底：围绕锚点按环形网格搜索最近的空位
        for (let dy = -240; dy <= 240; dy += 14) for (let dx = -300; dx <= 300; dx += 20) cands.push([px + dx, py + dy]);
        for (const [cx, cy] of cands) {
          if (!ok(cx, cy)) continue;
          const cost = Math.abs(cx - px) * 1.2 + Math.abs(cy - py);
          if (cost < best) { best = cost; bx = cx; by = cy; }
        }
      }
      if (!b.placed) { b.cont.setPosition(bx, by); b.placed = true; }
      else if (taken.some((r) => hit(rectAt(b.cont.x, b.cont.y), r))) b.cont.setPosition(bx, by);
      else {
        // 平滑移动，但若途中会撞到别的气泡/HUD 则直接到位
        const nx = b.cont.x + (bx - b.cont.x) * k, ny = b.cont.y + (by - b.cont.y) * k;
        if (taken.some((r) => hit(rectAt(nx, ny), r))) b.cont.setPosition(bx, by); else b.cont.setPosition(nx, ny);
      }
      taken.push(rectAt(b.cont.x, b.cont.y), rectAt(bx, by));
      const pop = Math.min(1, b.t / 0.14);
      const out = b.t > b.dur ? 1 - (b.t - b.dur) / 0.35 : 1;
      b.cont.setScale(0.2 + 0.8 * pop * (2 - pop));
      b.cont.setAlpha(out);
      // 小尾巴指向说话者
      const tx = Phaser.Math.Clamp(a.x - b.cont.x, -hw + 14, hw - 14);
      const below = a.y - 8 - b.cont.y;       // 说话者在气泡下方的距离
      b.tail.clear();
      if (below > 6) {
        const tip = Math.min(below, 30);
        b.tail.fillStyle(0xfffaf0, 1).fillTriangle(tx - 6, -1, tx + 6, -1, tx, tip);
        b.tail.lineStyle(2, 0x5a4638, 1).lineBetween(tx - 6, 0, tx, tip).lineBetween(tx + 6, 0, tx, tip);
      } else if (a.y - 30 < b.cont.y - b.h) {
        const tip = -b.h - Math.min(b.cont.y - b.h - a.y + 30, 26);
        b.tail.fillStyle(0xfffaf0, 1).fillTriangle(tx - 6, -b.h + 1, tx + 6, -b.h + 1, tx, tip);
        b.tail.lineStyle(2, 0x5a4638, 1).lineBetween(tx - 6, -b.h, tx, tip).lineBetween(tx + 6, -b.h, tx, tip);
      }
    }
  }
}
