import { CFG, DECOR, MAP, WORLD_H, WORLD_W } from '../core/data';

/**
 * 导航：瓦片栅格 A*（8 邻接，不切角）+ 视线拉直。
 * - 不可走：CFG.blockedTiles（默认 ['w']）、CFG.obstacles 矩形 [x0,y0,x1,y1]（瓦片单位，建筑/围栏）、decor 里 solid 的装饰（圆 r）、运行时 addBlocker 的阻挡（公交车、路障…）。
 * - 代价：CFG.tileCost[字符]，默认 路 c=1.0 广场 p=1.1 码头 d=1.2 雪 i=1.3 草 g=1.6 —— 自然偏好走路。
 * - 世界坐标用瓦片单位（与 Npc.x/y 一致），瓦片 (tx,ty) 的中心是 (tx+.5, ty+.5)。
 */
const DEF_COST: Record<string, number> = { c: 1, p: 1.1, d: 1.2, i: 1.3, g: 1.6, b: 1.4 };

interface Blocker { id: string; x0: number; y0: number; x1: number; y1: number }

class Heap {
  a: number[] = []; // 节点下标，按 f 排序
  constructor(private f: Float32Array) {}
  get size() { return this.a.length; }
  push(n: number) {
    const a = this.a, f = this.f; a.push(n);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (f[a[p]] <= f[a[i]]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, f = this.f, top = a[0], last = a.pop()!;
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < a.length && f[a[l]] < f[a[m]]) m = l;
        if (r < a.length && f[a[r]] < f[a[m]]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

export class NavGrid {
  W = WORLD_W; H = WORLD_H;
  base: Uint8Array;           // 1 = 静态不可走
  dyn: Uint8Array;            // 动态阻挡计数
  cost: Float32Array;
  version = 0;
  private blockers = new Map<string, Blocker>();
  private cache = new Map<string, { v: number; path: number[][] | null }>();
  private g: Float32Array; private fs: Float32Array; private from: Int32Array; private closed: Uint8Array;
  private blockedChars: Set<string>;
  searches = 0; // 调试：A* 次数

  constructor() {
    const W = this.W, H = this.H, N = W * H;
    this.base = new Uint8Array(N); this.dyn = new Uint8Array(N); this.cost = new Float32Array(N);
    this.g = new Float32Array(N); this.fs = new Float32Array(N); this.from = new Int32Array(N); this.closed = new Uint8Array(N);
    this.blockedChars = new Set<string>(CFG.blockedTiles ?? ['w']);
    const tc: Record<string, number> = { ...DEF_COST, ...(CFG.tileCost ?? {}) };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = MAP[y]?.[x] ?? 'g';
      this.base[y * W + x] = this.blockedChars.has(ch) ? 1 : 0;
      this.cost[y * W + x] = tc[ch] ?? 1.5;
    }
    for (const o of (CFG.obstacles ?? []) as number[][]) this.rect(o[0], o[1], o[2], o[3], this.base, 1);
    for (const d of DECOR as any[]) if (d.solid) { const r = typeof d.solid === 'number' ? d.solid : 0.5; this.rect(d.pos[0] - r, d.pos[1] - r, d.pos[0] + r, d.pos[1] + r, this.base, 1); }
  }

  private rect(x0: number, y0: number, x1: number, y1: number, arr: Uint8Array, v: number) {
    const W = this.W, H = this.H;
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.floor(y1 - 1e-6)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, Math.floor(x1 - 1e-6)); x++) {
        if (arr === this.dyn) arr[y * W + x] = Math.max(0, arr[y * W + x] + v); else arr[y * W + x] = v;
      }
  }
  /** 运行时阻挡（世界坐标矩形）；同 id 覆盖。 */
  addBlocker(id: string, x0: number, y0: number, x1: number, y1: number) {
    this.removeBlocker(id);
    this.blockers.set(id, { id, x0, y0, x1, y1 });
    this.rect(x0, y0, x1, y1, this.dyn, 1); this.version++;
  }
  removeBlocker(id: string) {
    const b = this.blockers.get(id); if (!b) return;
    this.rect(b.x0, b.y0, b.x1, b.y1, this.dyn, -1); this.blockers.delete(id); this.version++;
  }
  hasBlocker(id: string) { return this.blockers.has(id); }

  idx(x: number, y: number) { return Math.floor(y) * this.W + Math.floor(x); }
  inb(tx: number, ty: number) { return tx >= 0 && ty >= 0 && tx < this.W && ty < this.H; }
  /** 该点（世界坐标）是否可走 */
  walkable(x: number, y: number, ignoreDyn = false) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (!this.inb(tx, ty)) return false;
    const i = ty * this.W + tx;
    return !this.base[i] && (ignoreDyn || !this.dyn[i]);
  }
  /** 找最近的可走瓦片中心（螺旋扩展），用于目标点落在水里/建筑里时 */
  nearestWalkable(x: number, y: number, maxR = 8): [number, number] | null {
    if (this.walkable(x, y)) return [x, y];
    const cx = Math.floor(x), cy = Math.floor(y);
    for (let r = 1; r <= maxR; r++) {
      let best: [number, number] | null = null, bd = 1e9;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = cx + dx, ty = cy + dy;
        if (!this.inb(tx, ty) || !this.walkable(tx + 0.5, ty + 0.5)) continue;
        const d = (tx + 0.5 - x) ** 2 + (ty + 0.5 - y) ** 2;
        if (d < bd) { bd = d; best = [tx + 0.5, ty + 0.5]; }
      }
      if (best) return best;
    }
    return null;
  }
  /** 线段是否全程可走（按 0.25 步长采样，略放宽半径避免贴边卡住） */
  los(x0: number, y0: number, x1: number, y1: number): boolean {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 0.25));
    for (let i = 1; i <= n; i++) { const t = i / n; if (!this.walkable(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; }
    return true;
  }

  /** 带身体宽度的视线（中心线 + 两侧各 m 偏移都可走），用于路径拉直，避免贴着围栏角擦边。 */
  losWide(x0: number, y0: number, x1: number, y1: number, m = 0.22): boolean {
    if (!this.los(x0, y0, x1, y1)) return false;
    const d = Math.hypot(x1 - x0, y1 - y0); if (d < 1e-6) return true;
    const px = (-(y1 - y0) / d) * m, py = ((x1 - x0) / d) * m;
    return this.los(x0 + px, y0 + py, x1 + px, y1 + py) && this.los(x0 - px, y0 - py, x1 - px, y1 - py);
  }

  /** 寻路：返回路径点（世界坐标，不含起点；终点即目标）。无路返回 null。 */
  path(x0: number, y0: number, x1: number, y1: number): number[][] | null {
    if (this.los(x0, y0, x1, y1)) return [[x1, y1]];
    const key = `${Math.floor(x0)},${Math.floor(y0)}>${Math.floor(x1)},${Math.floor(y1)}`;
    const c = this.cache.get(key);
    if (c && c.v === this.version) return c.path ? this.fit(c.path, x0, y0, x1, y1) : null;
    const p = this.search(Math.floor(x0), Math.floor(y0), Math.floor(x1), Math.floor(y1));
    if (this.cache.size > 600) this.cache.clear();
    this.cache.set(key, { v: this.version, path: p });
    return p ? this.fit(p, x0, y0, x1, y1) : null;
  }
  private fit(tiles: number[][], x0: number, y0: number, x1: number, y1: number) {
    // 以实际起点出发做一次视线拉直，终点替换为精确目标
    const pts = tiles.map((q) => [q[0], q[1]]);
    pts[pts.length - 1] = [x1, y1];
    const out: number[][] = []; let cx = x0, cy = y0, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !(j === pts.length - 1 ? this.los(cx, cy, pts[j][0], pts[j][1]) && this.losWide(cx, cy, pts[j][0], pts[j][1], 0.15) : this.losWide(cx, cy, pts[j][0], pts[j][1]))) j--;
      out.push(pts[j]); cx = pts[j][0]; cy = pts[j][1]; i = j + 1;
    }
    return out;
  }
  private search(sx: number, sy: number, gx: number, gy: number): number[][] | null {
    const W = this.W, H = this.H;
    if (!this.inb(sx, sy) || !this.inb(gx, gy)) return null;
    this.searches++;
    // 起点/终点被阻挡时，吸附到最近可走格
    const fixT = (tx: number, ty: number): [number, number] | null => {
      if (this.walkable(tx + 0.5, ty + 0.5)) return [tx, ty];
      const n = this.nearestWalkable(tx + 0.5, ty + 0.5, 6); return n ? [Math.floor(n[0]), Math.floor(n[1])] : null;
    };
    const s = fixT(sx, sy), e = fixT(gx, gy); if (!s || !e) return null;
    const start = s[1] * W + s[0], goal = e[1] * W + e[0];
    this.g.fill(1e9); this.closed.fill(0); this.from.fill(-1);
    const h = (n: number) => { const dx = Math.abs((n % W) - e[0]), dy = Math.abs(((n / W) | 0) - e[1]); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
    const heap = new Heap(this.fs);
    this.g[start] = 0; this.fs[start] = h(start); heap.push(start);
    const D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    let found = false;
    while (heap.size) {
      const n = heap.pop();
      if (this.closed[n]) continue;
      this.closed[n] = 1;
      if (n === goal) { found = true; break; }
      const nx = n % W, ny = (n / W) | 0;
      for (const [dx, dy] of D) {
        const mx = nx + dx, my = ny + dy;
        if (mx < 0 || my < 0 || mx >= W || my >= H) continue;
        const m = my * W + mx;
        if (this.closed[m] || this.base[m] || this.dyn[m]) continue;
        if (dx && dy && (this.base[ny * W + mx] || this.base[my * W + nx] || this.dyn[ny * W + mx] || this.dyn[my * W + nx])) continue; // 不切角
        const step = (dx && dy ? Math.SQRT2 : 1) * (this.cost[m] + this.cost[n]) * 0.5;
        const g2 = this.g[n] + step;
        if (g2 < this.g[m]) { this.g[m] = g2; this.from[m] = n; this.fs[m] = g2 + h(m) * 1.0; heap.push(m); }
      }
    }
    if (!found) return null;
    const out: number[][] = [];
    for (let n = goal; n !== -1; n = this.from[n]) out.push([(n % W) + 0.5, ((n / W) | 0) + 0.5]);
    out.reverse(); out.shift();
    if (!out.length) out.push([e[0] + 0.5, e[1] + 0.5]);
    return out;
  }
}

let _nav: NavGrid | null = null;
/** 全局导航（首次访问时按当前 MAP 构建） */
export function getNav(): NavGrid { if (!_nav) { _nav = new NavGrid(); (globalThis as any).__nav = _nav; } return _nav; }
export function resetNav() { _nav = null; }
