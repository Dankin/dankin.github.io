// 运输新增三档:挑扁担工 / 蹦床 / 直升机。签名、选项与 transport.ts 一致(load/move/unload/dir/pulse/seed/t/alpha)。
// 静态件走 bake;扁担、苹果、旋翼、蹦床面等每帧现画(确定性)。
import { appleHeap, drawApple } from './apple.ts';
import { cached } from './bake.ts';
import { F, INK, Ink, TAU, clamp, lerp } from './ink.ts';
import type { C } from './ink.ts';
import { bounce, dropOut, flyOut, heapJig, loadN, place, puffs, wheel } from './transport.ts';
import type { ThingFn, ThingOpt } from './types.ts';

const hash = (n: number, seed: number): number => {
  const v = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/* ───────────────────────── 挑扁担工 (宽约 36) ───────────────────────── */
export const drawPorter: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1, t = o.t ?? 0, mv = o.move ?? 0;
  const bn = bounce(o);
  const ph = t * 7.4 * mv; // 步伐相位(一圈=两步)
  const n = loadN(o, 8);
  const nL = Math.ceil(n / 2), nR = n - nL;
  place(ctx, x, y, s, o, true, (g) => {
    const idle = Math.sin(t * 2.1) * 0.25 * (1 - mv);
    const stepUp = Math.abs(Math.sin(ph)); // 每步一次起伏
    const bodyDy = -stepUp * 1.15 * mv + idle * 0.4 + bn.dip * 0.7;
    const lean = 0.05 * mv; // 前倾
    const sh = [0.4, -19.2 + bodyDy] as const; // 肩
    new Ink(g, seed, 1.9, 0.2).shadow(0, 0.3, 11, 1.5);
    const k = new Ink(g, seed + 3, 1.9, 0.22);

    // 腿(后腿先画)
    const leg = (a: number, back: boolean): void => {
      const hipX = -0.4 + a * 0.2, hipY = -10.8 + bodyDy * 0.5;
      const fx = hipX + Math.sin(ph + (back ? 0 : Math.PI)) * 4.4 * mv + (back ? -1 : 1) * 0.6;
      const lift = Math.max(0, Math.cos(ph + (back ? 0 : Math.PI))) * 2 * mv;
      k.limb(hipX, hipY, fx, -1.2 - lift, 2.6, back ? F.gray : F.cream, 1.8);
      k.ell(fx + 1.1, -0.9 - lift, 2.1, 1.05, { fill: F.gray3, lw: 1.3, j: 0.05 });
    };
    leg(0, true);

    // 躯干(短褂)
    g.save();
    g.translate(0, 0);
    g.rotate(lean);
    k.limb(-0.4, -10.6 + bodyDy * 0.5, sh[0], sh[1] + 1.2, 6.2, F.cream, 1.9);
    k.line(-2.4, -11.2 + bodyDy * 0.5, 2.2, -11.6 + bodyDy * 0.5, { lw: 1, ext: 0, bow: 0 }); // 腰带
    g.restore();
    leg(0, false);

    // 扁担 + 筐(前后两头,弹性摆动)
    const sag = 1.1 + (n > 0 ? 1.6 : 0);
    const half = 17.5;
    const spring = (side: number): number => Math.sin(ph * 2 - 0.6 + side * 0.5) * 1.9 * mv * (n > 0 ? 1 : 0.55) + bn.dip * 0.9;
    const endL: [number, number] = [-half, sh[1] - 0.3 + sag + spring(-1)];
    const endR: [number, number] = [half, sh[1] - 0.3 + sag + spring(1)];
    const bend = (n > 0 ? 1.4 : 0.6) + Math.sin(ph * 2 - 0.2) * 0.35 * mv;
    g.lineCap = 'round';
    const pole = (w: number, col: string): void => {
      g.beginPath();
      g.moveTo(endL[0], endL[1]);
      g.quadraticCurveTo(0.2, sh[1] - 1.2 - bend * 0.4, endR[0], endR[1]);
      g.lineWidth = w;
      g.strokeStyle = col;
      g.stroke();
    };
    pole(3.7, INK);
    pole(1.8, '#d9b87f');
    // 挂筐
    const basket = (e: [number, number], side: number, cnt: number): void => {
      const swing = Math.sin(ph * 2 - 1 + side * 0.7) * 0.17 * mv + Math.sin(t * 1.7 + side) * 0.02 + bn.dip * 0.03 * side;
      g.save();
      g.translate(e[0], e[1]);
      g.rotate(swing);
      // 绳
      g.lineWidth = 1;
      g.strokeStyle = INK;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(-5.4, 6.3);
      g.moveTo(0, 0);
      g.lineTo(5.4, 6.3);
      g.stroke();
      // 苹果堆(在筐前沿后面)
      appleHeap(g, 0, 7.6 + bn.hop * 0.4 + heapJig(t, mv, 14.8, 0.8, side), cnt, 2.2, 10, seed + side);
      cached(g, `porter-bk|${seed}`, [-8, 4, 8, 14], 0, 0, 1, (b) => {
        const kk = new Ink(b, seed + 7, 1.7, 0.25);
        kk.poly([[-6.4, 6.4], [6.4, 6.4], [4.4, 12.6], [-4.4, 12.6]], { fill: F.wood, shade: F.shade2, j: 0.25 });
        kk.rect(-7, 5.4, 14, 2, { fill: F.warm, lw: 1.5, r: 0.8 });
        for (let i = -2; i <= 2; i++) kk.line(i * 2.3, 8, i * 1.8, 12, { lw: 0.7, ext: 0, bow: 0 });
        kk.line(-5.4, 10, 5.4, 10, { lw: 0.8, ext: 0 });
      });
      g.restore();
    };
    basket(endL, -1, nL);
    basket(endR, 1, nR);

    // 手扶扁担(近侧手臂)
    k.limb(sh[0] + 0.4, sh[1] + 1.4, sh[0] + 5, sh[1] - 0.6, 2.5, F.cream, 1.6);
    k.ell(sh[0] + 5.6, sh[1] - 0.8, 1.35, 1.35, { fill: F.skin, lw: 1.2, j: 0.05 });
    // 远侧手(摆臂)
    const arm = Math.sin(ph) * 2.4 * mv;
    k.limb(sh[0] - 0.8, sh[1] + 2, sh[0] - 3.2 + arm, sh[1] + 7.4, 2.3, F.cream, 1.5);
    k.ell(sh[0] - 3.4 + arm, sh[1] + 8, 1.2, 1.2, { fill: F.skin, lw: 1.1, j: 0.05 });

    // 头 + 斗笠
    const hx = sh[0] + 1.4 + lean * 10, hy = sh[1] - 4.8 + (stepUp > 0.7 ? 0.25 : 0);
    k.limb(sh[0] + 0.2, sh[1] + 0.6, hx - 0.2, hy + 2, 2.3, F.skin, 1.4);
    k.ell(hx, hy, 3.5, 3.7, { fill: F.skin, lw: 1.9, j: 0.1 });
    k.dot(hx + 1.7, hy - 0.2, 0.62, INK);
    k.stroke([[hx + 0.9, hy + 1.7], [hx + 2.2, hy + 1.8]], { lw: 0.8 });
    // 斗笠:宽锥形,帽带
    k.stroke([[hx - 1.6, hy + 1.2], [hx - 2.2, hy + 3.2]], { lw: 0.7 });
    k.poly([[hx - 9, hy - 2.3], [hx + 0.4, hy - 9.6], [hx + 9.6, hy - 2.1], [hx + 4, hy - 3.4], [hx - 4, hy - 3.6]], { fill: '#e6cf98', shade: F.shade2, lw: 1.9, j: 0.2 });
    k.line(hx - 4.8, hy - 4.6, hx - 0.6, hy - 8.2, { lw: 0.7, ext: 0, bow: 0 });
    k.line(hx + 0.9, hy - 8.4, hx + 4.2, hy - 4.2, { lw: 0.7, ext: 0, bow: 0 });
    k.line(hx - 9, hy - 2.3, hx + 9.6, hy - 2.1, { lw: 1.7, ext: 0.1, bow: 0.3 });

    // 卸货:两头筐里苹果抛出
    const u = o.unload ?? 0;
    flyOut(g, endR[0], endR[1] + 5, 15, 8, u, 3, 2.2);
    flyOut(g, endL[0], endL[1] + 5, -12, 8, u, 3, 2.2);
    // 脚下尘土
    if (mv > 0.1) {
      for (let i = 0; i < 3; i++) {
        const v = (t * 2.2 * (0.5 + mv) + i / 3) % 1;
        g.save();
        g.globalAlpha *= (1 - v) * 0.8 * mv;
        g.beginPath();
        g.arc(-5 - v * 6, -1.5 - v * 2.5, 0.8 + v * 1.4, 0, TAU);
        g.fillStyle = F.white;
        g.fill();
        g.lineWidth = 0.9;
        g.strokeStyle = INK;
        g.stroke();
        g.restore();
      }
    }
  });
};

/* ───────────────────────── 蹦床 (宽约 50) ───────────────────────── */
export const drawTrampoline: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1, t = o.t ?? 0, mv = o.move ?? 0;
  const bn = bounce(o);
  const nLoad = loadN(o, 8);
  const loadF = clamp(o.load ?? 0, 0, 1);
  const rate = 1.3 * (0.6 + 0.6 * mv);
  const bouncing = mv > 0.05 && nLoad > 0;
  const bt = t * rate;
  const m0 = Math.floor(bt);
  const bph = bt - m0;
  const has = (m: number): boolean => hash(m, seed) < 0.4 + 0.6 * loadF;

  // 床面下陷
  let dep = Math.sin(t * 2.3) * 0.15 + Math.abs(bn.dip) * 1.6;
  if (bouncing && has(m0)) {
    if (bph >= 0.2 && bph < 0.4) dep += 6.2 * Math.sin(((bph - 0.2) / 0.2) * Math.PI);
    else if (bph >= 0.4) dep += -1.6 * Math.sin((bph - 0.4) * Math.PI * 5) * Math.exp(-(bph - 0.4) * 5);
  } else if (bouncing && has(m0 - 1) && bph < 0.6) {
    dep += -1.6 * Math.sin((bph + 0.6) * Math.PI * 5) * Math.exp(-(bph + 0.6) * 5);
  }
  const cy = -14.5;
  const squash = 1 - dep * 0.011;

  place(ctx, x, y, s, o, true, (g) => {
    const k = new Ink(g, seed + 2, 2, 0.25);
    k.shadow(0, 0.3, 26, 2.3);
    // 支腿(随下陷压缩)
    g.save();
    g.translate(0, 0);
    g.scale(1, squash);
    const legAt = (lx: number, back: boolean): void => {
      const kk = new Ink(g, seed + (back ? 5 : 6), 2, 0.18);
      kk.line(lx, cy + 2, lx * (back ? 1.04 : 1.1), back ? -1.2 : 0, { lw: back ? 1.7 : 2.3, ext: 0 });
      if (!back) kk.ell(lx * 1.1, -0.4, 2.8, 0.9, { fill: F.gray2, lw: 1.3, j: 0.05 });
    };
    legAt(-14, true);
    legAt(14, true);
    legAt(-21, false);
    legAt(21, false);
    g.restore();

    const RX = 23.5, RY = 4.6;
    const ring = (lower: boolean): void => {
      g.lineJoin = 'round';
      const path = (): void => {
        g.beginPath();
        if (lower) g.ellipse(0, cy, RX, RY, 0, 0.04, Math.PI - 0.04);
        else g.ellipse(0, cy, RX, RY, 0, 0, TAU);
      };
      path();
      g.lineWidth = 5.2;
      g.strokeStyle = INK;
      g.stroke();
      path();
      g.lineWidth = 3.2;
      g.strokeStyle = F.white;
      g.stroke();
      path();
      g.lineWidth = 3.2;
      g.strokeStyle = F.gray2;
      g.setLineDash([3.4, 3.4]);
      g.stroke();
      g.setLineDash([]);
    };
    ring(false);

    // 弹床面:分扇区条纹 + 中心下陷
    const mx = 20.2, my = 3.5;
    const N = 16;
    const pt = (i: number): [number, number] => {
      const a = (i / N) * TAU;
      const px = Math.cos(a) * mx;
      return [px, cy + Math.sin(a) * my + dep * (1 - (px / mx) ** 2) * 0.55];
    };
    const cen: [number, number] = [0, cy + dep];
    for (let i = 0; i < N; i++) {
      const a = pt(i), b = pt(i + 1);
      g.beginPath();
      g.moveTo(cen[0], cen[1]);
      g.lineTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.closePath();
      g.fillStyle = i % 2 ? F.warm : F.white;
      g.fill();
    }
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const p = pt(i);
      i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]);
    }
    g.lineWidth = 1.8;
    g.strokeStyle = INK;
    g.lineJoin = 'round';
    g.stroke();
    // 粗线放射缝(手绘感)
    const kr = new Ink(g, seed + 9, 1.1, 0.12);
    for (let i = 0; i < N; i += 2) {
      const p = pt(i);
      kr.line(cen[0] + (p[0] - cen[0]) * 0.28, cen[1] + (p[1] - cen[1]) * 0.28, p[0] * 0.96, cy + (p[1] - cy) * 0.96 + dep * 0.02, { lw: 0.5, ext: 0, bow: 0 });
    }
    // 弹簧(环与床面之间,前半圈)
    for (let i = 3; i <= 13; i += 2) {
      const a = pt(i);
      const ang = (i / N) * TAU;
      const bx = Math.cos(ang) * RX, by = cy + Math.sin(ang) * RY;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(lerp(a[0], bx, 0.35) + 0.9, lerp(a[1], by, 0.35));
      g.lineTo(lerp(a[0], bx, 0.65) - 0.9, lerp(a[1], by, 0.65));
      g.lineTo(bx, by);
      g.lineWidth = 0.9;
      g.strokeStyle = INK;
      g.stroke();
    }

    const matY = (px: number): number => cy - 0.5 + dep * (1 - (px / mx) ** 2) * 0.9 + 0.5;
    const r = 3.3;
    const apple = (ax: number, ay: number, sx = 1, sy = 1, i = 0): void => {
      g.save();
      g.translate(ax, ay);
      g.scale(sx, sy);
      drawApple(g, 0, 0, r, { leaf: i % 2 === 0 });
      g.restore();
    };

    if (!bouncing) {
      // 床面上的苹果堆
      if (nLoad > 0) appleHeap(g, 0, matY(0) + 1.2 + bn.hop * 0.4, nLoad, 2.6, 16, seed);
    } else {
      for (let m = m0 - 2; m <= m0 + 1; m++) {
        if (!has(m)) continue;
        const ua = bt - m; // 此苹果的生命进度
        if (ua < -0.55 || ua > 2.05) continue;
        const ax0 = (hash(m, seed + 3) - 0.5) * 7;
        if (ua < 0.2) {
          // 从高处落下
          const f = (ua + 0.55) / 0.75;
          apple(ax0, matY(ax0) - r * 0.9 - (1 - f * f) * 26, 1, 1, m);
        } else if (ua < 0.42) {
          // 压床:随床面下陷再弹起,压扁
          const f = (ua - 0.2) / 0.22;
          const sq = Math.sin(f * Math.PI);
          apple(ax0, matY(ax0) - r * 0.9 + sq * 0.0, 1 + sq * 0.22, 1 - sq * 0.2, m);
        } else {
          // 抛物线飞向远处
          const v = (ua - 0.42) / 1.6;
          const px = ax0 + v * (50 - ax0) + Math.sin(v * 6 + m) * 0.6;
          const py = matY(ax0) - r - Math.sin(Math.min(1, v) * Math.PI) * (30 + hash(m, seed) * 9) + v * 6;
          const stretch = v < 0.1 ? 1 - 0.18 * (1 - v / 0.1) : 1;
          g.save();
          g.globalAlpha *= 1 - clamp((v - 0.82) / 0.18, 0, 1);
          apple(px, py, 1 / stretch * 0.9 + 0.1, stretch, m);
          g.restore();
        }
      }
    }
    // 前半圈压在苹果前
    ring(true);
    flyOut(g, 0, cy - 4, 28, 12, o.unload ?? 0, 6, 3);
  });
};

/* ───────────────────────── 直升机 (宽约 76) ───────────────────────── */
export const drawHelicopter: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1, t = o.t ?? 0, mv = o.move ?? 0;
  const bn = bounce(o);
  const n = loadN(o, 8);
  place(ctx, x, y, s, o, true, (g) => {
    const hover = Math.sin(t * 2.1) * 1.1 + Math.sin(t * 5.3) * 0.25 * (1 - mv) + bn.dip * 0.6;
    const nose = 0.06 * mv + Math.sin(t * 1.3) * 0.01;
    // 地面影(随高度缩小)
    new Ink(g, seed, 2, 0.2).shadow(0, 0.3, 17 - hover * 0.6 - 3 * mv, 1.6, 0.14);
    g.save();
    g.translate(0, hover - 0.5);
    g.translate(5, -44);
    g.rotate(nose);
    g.translate(-5, 44);

    // 吊篮(悬在机腹吊钩下,摆动)
    const px = 8, py = -31.4;
    const th = Math.sin(t * 2.3) * 0.04 + mv * (0.17 + Math.sin(t * 3.1) * 0.035) - hover * 0.004;
    g.save();
    g.translate(px, py);
    g.rotate(th);
    const L = 13;
    g.lineWidth = 1.1;
    g.strokeStyle = INK;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-8.4, L);
    g.moveTo(0, 0);
    g.lineTo(8.4, L);
    g.moveTo(0, 0);
    g.lineTo(0, L - 1);
    g.stroke();
    // 苹果堆 + 网兜
    appleHeap(g, 0, L + 0.8 + bn.hop * 0.5, n, 2.5, 15, seed);
    if (n > 0) {
      g.save();
      g.globalAlpha *= 0.55;
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(-8.6, L);
      g.quadraticCurveTo(-5, L - 8.4, 0, L - 7.6);
      g.quadraticCurveTo(5, L - 8.4, 8.6, L);
      g.moveTo(-4.4, L);
      g.quadraticCurveTo(-2, L - 6, 0, L - 7.6);
      g.moveTo(4.4, L);
      g.quadraticCurveTo(2, L - 6, 0, L - 7.6);
      g.stroke();
      g.restore();
    }
    cached(g, `heli-crate|${seed}`, [-11, L - 1, 11, L + 11], 0, 0, 1, (b) => {
      const kk = new Ink(b, seed + 4, 1.9, 0.25);
      kk.rect(-9.4, L, 18.8, 9, { fill: F.wood, shade: F.shade2, lw: 1.9, r: 0.8, j: 0.25 });
      kk.line(-9.2, L + 3, 9.2, L + 3, { lw: 0.9, ext: 0, bow: 0 });
      kk.line(-9.2, L + 6.2, 9.2, L + 6.2, { lw: 0.9, ext: 0, bow: 0 });
      kk.line(-3.4, L, -3.4, L + 9, { lw: 0.8, ext: 0, bow: 0 });
      kk.line(3.4, L, 3.4, L + 9, { lw: 0.8, ext: 0, bow: 0 });
    });
    g.restore();

    // 机身(baked)
    cached(g, `heli|${seed}`, [-44, -62, 30, -26], 0, 0, 1, (b) => {
      const k = new Ink(b, seed, 2.1, 0.28);
      // 尾梁 + 尾翼
      k.poly([[-6, -47.5], [-33.5, -49.4], [-35, -46], [-8, -38.6]], { fill: F.cream, shade: F.shade2, lw: 2, j: 0.2 });
      k.poly([[-31, -48.4], [-37.6, -58.5], [-32.4, -58.6], [-27, -48.8]], { fill: F.white, shade: F.shade, lw: 1.9, j: 0.2 });
      k.poly([[-26, -46.4], [-30.6, -42.4], [-26.4, -42], [-21.4, -45.2]], { fill: F.gray, lw: 1.6, j: 0.15 });
      // 起落架滑橇 + 支架
      k.line(-6, -37.6, -4, -30.4, { lw: 1.9, ext: 0 });
      k.line(16, -37.6, 14, -30.4, { lw: 1.9, ext: 0 });
      k.line(-10, -29.6, 24, -29.6, { lw: 2.5, ext: 0, bow: 0.5 });
      k.line(24, -29.6, 27.6, -32, { lw: 2.1, ext: 0 });
      // 旋翼桅
      k.rect(2.6, -57, 3.4, 6, { fill: F.gray2, lw: 1.6, j: 0.1 });
      // 舱体:圆润气泡
      k.poly([[-9, -47], [-5, -53], [6, -54.6], [17, -52], [24.5, -45.5], [24, -39.6], [14, -36], [-2, -35.6], [-9, -39.6]], { fill: F.white, shade: F.shade2, smooth: true, lw: 2.4, j: 0.28 });
      // 前窗(玻璃)
      k.poly([[11.4, -51.4], [18.6, -49.6], [22.8, -44.6], [22.4, -41.6], [11, -41.4]], { fill: '#e8f3f4', lw: 1.7, j: 0.12, smooth: true });
      k.line(15, -50.6, 15.4, -41.6, { lw: 1.1, ext: 0, bow: 0 });
      k.line(13, -45.6, 15, -47.6, { lw: 0.8, ext: 0, bow: 0 }); // 玻璃反光
      // 侧窗 + 舱门线
      k.poly([[-3.4, -49.6], [3.4, -50.4], [3.2, -43.2], [-3.6, -43.2]], { fill: '#e8f3f4', lw: 1.5, j: 0.1 });
      k.line(7.4, -50.6, 7.6, -37.2, { lw: 1.3, ext: 0, bow: 0 });
      k.line(-8, -42.8, 24, -41.4, { lw: 0.9, ext: 0 });
      // 腹部吊钩
      k.ell(8, -35.8, 1.4, 1.4, { fill: F.gray3, lw: 1.3, j: 0.05 });
      // 机头小灯
      k.ell(23.4, -42.6, 1, 1, { fill: F.gold, lw: 1, j: 0.03 });
    });

    // 尾桨(小,快转)
    const tr = t * 30 * Math.max(0.2, mv);
    {
      const tx = -36.6, ty = -51.4;
      g.save();
      g.globalAlpha *= 0.3 + 0.25 * mv;
      g.beginPath();
      g.ellipse(tx, ty, 1.5, 5.6, 0, 0, TAU);
      g.fillStyle = F.gray2;
      g.fill();
      g.restore();
      const bl = Math.abs(Math.cos(tr)) * 5.4 + 0.5;
      new Ink(g, seed + 6, 1.5, 0).line(tx, ty - bl, tx, ty + bl, { lw: 1.6, ext: 0, bow: 0 });
      new Ink(g, seed + 6, 1.2, 0).dot(tx, ty, 1, F.gray3);
    }
    // 主旋翼:慢转 → 模糊盘
    const rot = t * 26 * Math.max(0.15, mv);
    const hubX = 4.3, hubY = -57.4;
    g.save();
    g.globalAlpha *= 0.14 + 0.22 * mv;
    g.beginPath();
    g.ellipse(hubX, hubY, 34, 2.9, 0, 0, TAU);
    g.fillStyle = F.gray3;
    g.fill();
    g.restore();
    g.lineCap = 'round';
    for (const sd of [-1, 1]) {
      const ex = hubX + 33 * Math.cos(rot + (sd < 0 ? Math.PI : 0));
      const ey = hubY + 2.4 * Math.sin(rot + (sd < 0 ? Math.PI : 0)) * 0.9;
      g.beginPath();
      g.moveTo(hubX, hubY);
      g.lineTo(ex, ey);
      g.lineWidth = 3.4;
      g.strokeStyle = INK;
      g.stroke();
      g.beginPath();
      g.moveTo(hubX, hubY);
      g.lineTo(ex, ey);
      g.lineWidth = 1.6;
      g.strokeStyle = F.gray2;
      g.stroke();
    }
    new Ink(g, seed + 8, 1.5, 0).ell(hubX, hubY, 2.1, 1.6, { fill: F.gray3, lw: 1.4, j: 0.03 });
    g.restore();

    // 前飞速度线 + 旋翼风:空载悬停时地面尘圈
    if (mv > 0.05) {
      for (let i = 0; i < 3; i++) {
        const u = (t * 2.4 + i / 3) % 1;
        const yy = -52 + i * 8 + hover;
        g.save();
        g.globalAlpha *= (1 - u) * mv;
        new Ink(g, seed + 40 + i, 1.3, 0.1).line(-46 - u * 18, yy, -38 - u * 18, yy, { lw: 1.3, ext: 0 });
        g.restore();
      }
    } else {
      for (let i = 0; i < 2; i++) {
        const u = (t * 1.1 + i / 2) % 1;
        g.save();
        g.globalAlpha *= (1 - u) * 0.6;
        g.beginPath();
        g.ellipse(6, -0.5, 6 + u * 18, 0.9 + u * 1.2, 0, 0, TAU);
        g.lineWidth = 1;
        g.strokeStyle = INK;
        g.stroke();
        g.restore();
      }
    }
    // 空投
    dropOut(g, px + 2, -31.4 + 18 + hover, 24, o.unload ?? 0, 6, 2.6);
    void puffs;
    void wheel;
  });
};

export type { C, ThingOpt };
