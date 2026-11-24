// preview-art-things.html 的入口:分区展示全部 things。URL 参数:?t=秒(冻结时间) &sec=transport,docks,...
import { drawTransport, TRANSPORT_W, TRANSPORT_NAMES } from './transports.ts';
import { drawDock } from './docks.ts';
import { CHAR_KINDS, CHAR_NAMES, drawCharacter } from './characters.ts';
import { drawPanel, drawButton, drawPin, drawIcon, PANEL_KINDS, PANEL_NAMES, ICON_IDS, ICON_NAMES } from './ui.ts';
import { drawFlight, drawGoldHalo, drawFirework, drawGiftBox } from './fx.ts';
import { drawApple } from './apple.ts';
import { drawLaoXu, drawStool, drawBench, drawBottle, drawTeaCup, drawRadio, drawRecliner, drawApprentice, LAOXU_STATES, LAOXU_STATE_NAMES, LAOXU_LEVEL_NAMES } from './laoxu.ts';
import { drawTransport8, drawFleet, runPhase, TRANSPORT8_NAMES, TRANSPORT8_BRANCH_NAMES, TRANSPORT8_W, TRANSPORT8_FLIES } from './transports8.ts';
import { drawSantaDepot } from './depot.ts';
import { drawBird, birdFlight, BIRD_STATES, BIRD_KINDS } from './bird.ts';
import { drawCharacterEgg } from './eggs.ts';
import { drawLaoXuAt, LAOXU_SPOTS, LAOXU_SPOT_NAMES } from './laoxu-tree.ts';
import { drawStageCard } from './stagecard.ts';
import type { Pose, ThingOpt } from './types.ts';

type C = CanvasRenderingContext2D;
const INKC = '#1b1410';
interface Sec {
  id: string;
  title: string;
  w: number;
  h: number;
  draw: (c: C, t: number, o: ThingOpt, z: number) => void;
}
const secs: Sec[] = [];
export function addSection(s: Sec): void {
  secs.push(s);
}

addSection({
  id: 'transport',
  title: '运输 9 档(上排空载,下排载苹果;宽 18/36/34/50/70/80/76/84/44)',
  w: 800,
  h: 200,
  draw(c, t, o) {
    const xs = [32, 90, 144, 210, 310, 430, 545, 655, 755];
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 9; i++) {
        const y = 94 + row * 96;
        c.fillStyle = 'rgba(0,0,0,0.04)';
        c.fillRect(xs[i] - TRANSPORT_W[i] / 2, y - 1, TRANSPORT_W[i], 1);
        drawTransport(c, i, xs[i], y, 1, { ...o, t, load: row ? o.load : 0 });
        c.fillStyle = '#888';
        c.font = '8px sans-serif';
        c.textAlign = 'center';
        if (row === 0) c.fillText(TRANSPORT_NAMES[i], xs[i], 8);
      }
    }
  },
});

addSection({
  id: 'docks',
  title: '码头/站台 6 档(上排 crates=0,下排 crates=6;pulse 随时间)',
  w: 640,
  h: 220,
  draw(c, t, o) {
    const xs = [48, 130, 235, 345, 460, 575];
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < 6; i++) drawDock(c, i, xs[i], 100 + row * 100, 0.8, { ...o, t, crates: row ? 6 : 0, pulse: (t * 0.5) % 1 });
  },
});

addSection({
  id: 'chars',
  title: '角色 12 种 × 姿态(idle / shake / catch / cheer / hit)',
  w: 760,
  h: 320,
  draw(c, t, o) {
    const poses: Pose[] = ['idle', 'shake', 'catch', 'cheer', 'hit'];
    c.fillStyle = INKC;
    c.font = '9px sans-serif';
    for (let r = 0; r < 5; r++) {
      c.fillText(poses[r], 2, 50 + r * 60);
      CHAR_KINDS.forEach((k, i) => {
        drawCharacter(c, k, 70 + i * 56, 60 + r * 60, 1, { ...o, t, pose: poses[r], seed: 3, n: 3, p: (o.unload ?? 0) > 0 ? o.unload : undefined, bite: r === 4 && k === 'manman' });
        if (r === 0) c.fillText(CHAR_NAMES[k], 50 + i * 56, 8);
      });
    }
  },
});

addSection({
  id: 'laoxu',
  title: '老徐 v2:8 级(idle)/ 12 状态(lv=o.load*7+1 或 lv=3)/ 掏马扎过渡 / 道具',
  w: 780,
  h: 760,
  draw(c, t, o) {
    c.fillStyle = INKC;
    c.font = '9px sans-serif';
    c.textAlign = 'center';
    const lvSel = o.load === undefined || o.load >= 0.99 ? 3 : Math.max(1, Math.min(8, Math.round(1 + o.load * 7)));
    // 行1:8 级
    for (let i = 0; i < 8; i++) {
      drawLaoXu(c, 50 + i * 95, 90, 1, { lv: i + 1, state: 'idle', t, seed: 5 });
      c.fillText('Lv' + (i + 1) + ' ' + LAOXU_LEVEL_NAMES[i + 1], 50 + i * 95, 108);
    }
    // 12 状态(4 列 × 3 行)
    LAOXU_STATES.forEach((st, i) => {
      const cx = 100 + (i % 4) * 190, cy = 210 + Math.floor(i / 4) * 105;
      c.fillStyle = 'rgba(0,0,0,0.03)';
      c.fillRect(cx - 90, cy - 80, 180, 100);
      c.fillStyle = INKC;
      c.fillText(st + ' ' + LAOXU_STATE_NAMES[st], cx, cy + 16);
      drawLaoXu(c, cx - (st === 'retire' ? 8 : 0), cy, 0.95, { lv: lvSel, state: st, t, seed: 5, p: (o.unload ?? 0) > 0 ? o.unload : undefined });
    });
    // 过渡:掏马扎
    c.fillStyle = INKC;
    c.fillText('掏马扎过渡 p=0.1/0.3/0.4/0.55/0.7/0.85/1', 390, 540);
    [0.1, 0.3, 0.4, 0.55, 0.7, 0.85, 1].forEach((p, i) => drawLaoXu(c, 55 + i * 108, 610, 0.95, { lv: 3, state: 'sit', t, seed: 5, p }));
    // 道具
    c.fillStyle = INKC;
    c.fillText('道具:马扎(折/半/开) 小板凳 快乐水瓶 茶杯 收音机 徒弟(摇/站/欢呼) 躺椅', 390, 640);
    drawStool(c, 40, 700, 1.3, { open: 0 });
    drawStool(c, 90, 700, 1.3, { open: 0.5 });
    drawStool(c, 150, 700, 1.3, { open: 1 });
    drawBench(c, 215, 700, 1.3, {});
    drawBottle(c, 265, 700, 2, { t, fizz: 0.6 });
    drawBottle(c, 305, 700, 2, { t, tilt: 0.7 });
    drawTeaCup(c, 345, 700, 2, { t });
    drawRadio(c, 395, 700, 1.4, { t });
    drawApprentice(c, 440, 700, 1.4, { t, pose: 'shake' });
    drawApprentice(c, 480, 700, 1.4, { t, pose: 'idle' });
    drawApprentice(c, 520, 700, 1.4, { t, pose: 'cheer' });
    drawRecliner(c, 620, 705, 1.4, {});
  },
});

for (const [id, y0, h] of [['lx1', 0, 130], ['lx2', 170, 200], ['lx3', 360, 190], ['lx4', 520, 240]] as const) {
  addSection({
    id,
    title: '老徐裁切 ' + id,
    w: 780,
    h,
    draw(c, t, o, z) {
      const base = secs.find((q) => q.id === 'laoxu');
      c.save();
      c.translate(0, -y0);
      base?.draw(c, t, o, z);
      c.restore();
    },
  });
}

addSection({
  id: 'ui',
  title: 'UI 框(九宫格拉伸)/ 按钮 / 图钉 / 11 关卡图标',
  w: 760,
  h: 430,
  draw(c, t) {
    c.fillStyle = '#9ec7a0';
    c.fillRect(0, 0, 760, 430);
    c.fillStyle = INKC;
    c.font = '9px sans-serif';
    // 面板:两种尺寸
    let x = 10;
    for (const k of PANEL_KINDS) {
      c.fillStyle = INKC;
      c.fillText(PANEL_NAMES[k], x, 10);
      const r = drawPanel(c, k, x, 14, 140, k === 'top' ? 30 : 56);
      c.fillStyle = INKC;
      c.font = '12px "Kaiti SC",serif';
      c.fillText('苹果 128', r[0] + 2, r[1] + 14);
      c.font = '9px sans-serif';
      x += 150;
    }
    drawPanel(c, 'card', 10, 84, 350, 74);
    const r2 = drawPanel(c, 'narr', 380, 84, 360, 74);
    c.fillStyle = INKC;
    c.font = '13px "Kaiti SC",serif';
    c.fillText('老徐:「树不会骗人,摇一摇就知道。」', r2[0], r2[1] + 22);
    drawPanel(c, 'top', 10, 168, 740, 32);
    drawPanel(c, 'inv', 10, 206, 360, 36);
    drawPanel(c, 'news', 380, 206, 360, 36);
    // 按钮
    const tones = ['cream', 'leaf', 'wood', 'apple'] as const;
    tones.forEach((tn, i) => {
      drawButton(c, 10 + i * 100, 252, 88, 32, '摇一摇', { tone: tn });
      drawButton(c, 10 + i * 100, 290, 88, 32, '按下', { tone: tn, pressed: true });
    });
    drawButton(c, 410, 252, 88, 32, '禁用', { disabled: true });
    drawButton(c, 510, 252, 150, 40, '开始运苹果', { tone: 'apple', font: 16 });
    drawPin(c, 430, 330, 1.4, {});
    drawPin(c, 470, 330, 1.4, { col: '#4c7ec9' });
    drawPin(c, 510, 330, 1, {});
    // 图标
    ICON_IDS.forEach((id, i) => {
      drawIcon(c, id, 36 + i * 64, 380 + Math.sin(t * 2 + i) * 0, 1, { lit: i % 2 === 0, locked: i === 10 });
      c.fillStyle = INKC;
      c.font = '9px sans-serif';
      c.textAlign = 'center';
      c.fillText(ICON_NAMES[id], 36 + i * 64, 424);
      c.textAlign = 'left';
    });
  },
});

addSection({
  id: 'fx',
  title: '特效:飞行轨迹(kind0 短弧 / kind1 带拖影)· 金苹果光晕 · 烟花(p=0.1..0.9)· 礼物盒(封印进度 0/.5/1 → 开盖 0.5/1)',
  w: 760,
  h: 300,
  draw(c, t) {
    c.fillStyle = '#cfe8c8';
    c.fillRect(0, 0, 760, 300);
    const k0 = (t * 0.6) % 1;
    drawFlight(c, { x0: 20, y0: 70, x1: 150, y1: 80, arc: 24, kind: 0 }, k0);
    drawFlight(c, { x0: 20, y0: 110, x1: 240, y1: 100, arc: 40, kind: 1 }, k0);
    for (let i = 0; i < 12; i++) {
      c.fillStyle = 'rgba(0,0,0,0.12)';
      const kk = i / 11;
      c.fillRect(20 + 220 * kk, 110 - 10 * kk * 0 - Math.sin(kk * Math.PI) * 40 + (100 - 110) * kk - 1, 1.5, 1.5);
    }
    // 金苹果光晕
    drawGoldHalo(c, 300, 60, 1, { t });
    drawApple(c, 300, 60, 8, { gold: true, leaf: true });
    drawGoldHalo(c, 380, 60, 0.7, { t: t + 1, pulse: (t * 0.7) % 1 });
    drawApple(c, 380, 60, 5.6, { gold: true, leaf: true });
    // 烟花
    for (let i = 0; i < 5; i++) {
      const bx = 470 + i * 58;
      c.fillStyle = '#243049';
      c.fillRect(bx - 28, 6, 56, 120);
      drawFirework(c, bx, 56, 1, { p: 0.1 + i * 0.2, seed: 5 + i * 11 });
    }
    // 礼物盒
    const st = [[0, 0], [0, 0.5], [0, 1], [0.5, 1], [1, 1]];
    st.forEach(([op, pg], i) => drawGiftBox(c, 60 + i * 130, 270, 1.6, { open: op, progress: pg, t }));
    drawGiftBox(c, 710, 270, 1.2, { open: (t * 0.4) % 1, progress: 1, t });
  },
});

addSection({
  id: 't8',
  title: 'v6 运输 8 档 × 2 分支(行:分支0空/分支0载/分支1空/分支1载)',
  w: 800,
  h: 420,
  draw(c, t, o) {
    const xs = [45, 110, 175, 285, 420, 525, 640, 745];
    c.fillStyle = INKC;
    c.font = '9px sans-serif';
    c.textAlign = 'center';
    for (let br = 0; br < 2; br++)
      for (let row = 0; row < 2; row++)
        for (let i = 0; i < 8; i++) {
          const y = 100 + (br * 2 + row) * 100;
          const fl = TRANSPORT8_FLIES[i];
          drawTransport8(c, i, br as 0 | 1, xs[i] + (br === 1 && i === 3 ? -12 : 0), y, 1, { ...o, t, load: row ? (o.load ?? 1) : 0, move: o.move, fly: fl ? 0.3 : undefined });
          if (row === 0 && br === 0) c.fillText(TRANSPORT8_NAMES[i], xs[i], 10);
          if (row === 0) c.fillText(TRANSPORT8_BRANCH_NAMES[i][br] + ' w' + TRANSPORT8_W[i][br], xs[i], y + 12);
        }
  },
});

addSection({
  id: 'fleet',
  title: '4 段行程车队(装货/行驶/卸货/返回;n=3 与 n=9→×N);每行一档分支 0/1 交替',
  w: 800,
  h: 420,
  draw(c, t, o) {
    for (let i = 0; i < 8; i++) {
      const y = 36 + i * 50;
      c.fillStyle = 'rgba(0,0,0,0.05)';
      c.fillRect(30, y, 640, 1);
      c.fillStyle = INKC;
      c.font = '9px sans-serif';
      c.textAlign = 'left';
      c.fillText(TRANSPORT8_NAMES[i] + ' ' + runPhase(t / 8).name, 4, y - 14);
      drawFleet(c, i, y, 0.6, { ...o, t, n: i === 4 ? 9 : 3, cycle: 8, x0: 70, x1: 600, branch: (i % 2) as 0 | 1, seed: i + 1 });
    }
  },
});

addSection({
  id: 'depot',
  title: '圣诞老人收货站:level 0/.3/.7/1 + 收货过程 + 雪橇起飞(用载量=level,装卸=receive)',
  w: 800,
  h: 330,
  draw(c, t, o) {
    const lv = [0, 0.3, 0.7, 1];
    lv.forEach((l, i) => drawSantaDepot(c, 70 + i * 195, 120, 0.62, { ...o, t, level: l, receive: i === 1 ? (t * 0.5) % 1 : 0, seed: 2 }));
    const tk = [0.0, 0.35, 0.7];
    tk.forEach((v, i) => drawSantaDepot(c, 90 + i * 260, 290, 0.62, { ...o, t, level: 1, takeoff: v, seed: 2 }));
  },
});

addSection({
  id: 'bird',
  title: '鸟:3 种 × 5 状态(站/飞/起飞/降落/被点中,p 取 0.15/0.4/0.65/0.9)+ 下排弧线巡游(起飞→弧线飞→降落)',
  w: 800,
  h: 420,
  draw(c, t, o) {
    c.fillStyle = INKC;
    c.font = '9px sans-serif';
    c.textAlign = 'center';
    BIRD_KINDS.forEach((kd, r) => {
      BIRD_STATES.forEach((st, i) => {
        const ps = [0.15, 0.4, 0.65, 0.9];
        const n = st === 'perch' || st === 'fly' ? 1 : 4;
        for (let j = 0; j < n; j++) {
          const bx = 40 + i * 152 + (n === 1 ? 40 : j * 38 - 20);
          c.fillStyle = 'rgba(0,0,0,0.05)';
          c.fillRect(bx - 12, 60 + r * 60, 24, 1);
          drawBird(c, bx, 60 + r * 60, 1.5, { ...o, t: t + j * 0.13, kind: kd, state: st, p: n === 1 ? undefined : ps[j], seed: r + 1 });
        }
        if (r === 0) { c.fillStyle = INKC; c.fillText(st, 40 + i * 152 + 40, 10); }
      });
    });
    c.fillStyle = 'rgba(0,0,0,0.12)';
    c.fillRect(40, 300, 720, 1);
    for (let b = 0; b < 3; b++) {
      const u = ((t * 0.18 + b / 3) % 1);
      const f = birdFlight(u, 60, 300, 740, 300, 60);
      drawBird(c, f.x, f.y, 1.6, { ...o, t: t + b, kind: BIRD_KINDS[b], state: f.state, p: f.p, dir: f.dir, seed: b + 3 });
    }
    drawBird(c, 750, 300, 1.6, { ...o, t, state: 'perch', dir: -1, kind: 'dove' });
  },
});

addSection({
  id: 'egg',
  title: '彩蛋角色被点中动作:12 角色 × p=0.15/0.35/0.55/0.8(气泡文字见 EGG_LINES)',
  w: 800,
  h: 520,
  draw(c, t, o) {
    CHAR_KINDS.forEach((k, i) => {
      const ps = [0.15, 0.35, 0.55, 0.8];
      const col = i % 3, row = Math.floor(i / 3);
      for (let j = 0; j < 4; j++) {
        const bx = 40 + col * 260 + j * 62, by = 110 + row * 120;
        drawCharacterEgg(c, k, bx, by, 1, { ...o, t, p: ps[j], seed: 3 });
      }
      c.fillStyle = INKC; c.font = '9px sans-serif'; c.textAlign = 'left';
      c.fillText(CHAR_NAMES[k], 8 + col * 260, 26 + row * 120);
    });
  },
});

addSection({
  id: 'xutree',
  title: '老徐新树档站位:地面 / 树屋 / 吊篮 / 树顶彩灯(状态 watch、cheer、clap)',
  w: 800,
  h: 340,
  draw(c, t, o) {
    const sts = ['watch', 'cheer', 'clap'] as const;
    LAOXU_SPOTS.forEach((sp, i) => {
      c.fillStyle = INKC; c.font = '9px sans-serif'; c.textAlign = 'center';
      c.fillText(LAOXU_SPOT_NAMES[sp], 100 + i * 195, 12);
      sts.forEach((st, j) => drawLaoXuAt(c, sp, 100 + i * 195 - 0, 130 + j * 100 - (sp === 'ground' ? 0 : 0), 1, { ...o, t, state: st, lv: 4, seed: 2 }));
    });
  },
});

addSection({
  id: 'stagecard',
  title: '新阶段说明卡(木框羊皮纸缎带 + 缩略图槽 + NEW);p=弹入',
  w: 760,
  h: 300,
  draw(c, t, o) {
    c.fillStyle = '#8fb892';
    c.fillRect(0, 0, 760, 300);
    const defs = [
      { title: '巨树', sub: '第 3 档 · 软梯与树屋', lines: ['老徐搬进了树屋', '摇一摇,苹果更多'] },
      { title: '双轮板车', sub: '运输 · 第 4 档', lines: ['壮汉拉着走', '一趟能拉十几个'] },
    ];
    defs.forEach((d, i) => {
      const x = 20 + i * 370, y = 40;
      drawStageCard(c, x, y, 340, 130, { ...d, t, seed: 3 + i, thumb: (g, w, h) => { i ? drawTransport8(g, 3, 1, w / 2, h - 6, 0.6, { t, load: 1 }) : drawApple(g, w / 2, h - 14, 14, { leaf: true }); } });
    });
    drawStageCard(c, 20, 190, 340, 100, { title: '新阶段', lines: ['弹入中 p=' + ((t * 0.6) % 1).toFixed(2)], t, p: (t * 0.6) % 1, isNew: true });
  },
});

const q = new URLSearchParams(location.search);
const only = q.get('sec')?.split(',');
if (q.has('z')) $z(q.get('z')!);
function $z(v: string): void { const e = document.getElementById('zoom') as HTMLSelectElement; e.innerHTML += `<option selected>${v}</option>`; e.value = v; }
const frozen = q.has('t') ? parseFloat(q.get('t')!) : null;
const root = document.getElementById('root')!;
const $ = (id: string) => document.getElementById(id) as HTMLInputElement;
const cvs: { s: Sec; c: HTMLCanvasElement }[] = [];
for (const s of secs) {
  if (only && !only.includes(s.id)) continue;
  const h = document.createElement('h2');
  h.textContent = s.title;
  root.appendChild(h);
  const c = document.createElement('canvas');
  root.appendChild(c);
  cvs.push({ s, c });
}
function resize(): void {
  const z = parseFloat($('zoom').value) || 1;
  const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
  for (const { s, c } of cvs) {
    c.width = Math.round(s.w * z * dpr);
    c.height = Math.round(s.h * z * dpr);
    c.style.width = s.w * z + 'px';
    c.style.height = s.h * z + 'px';
  }
}
resize();
$('zoom').addEventListener('change', resize);
let t0 = performance.now();
function frame(now: number): void {
  const z = parseFloat($('zoom').value) || 1;
  const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
  const t = frozen ?? ($('anim').checked ? (now - t0) / 1000 : 0);
  let unload = parseFloat($('unload').value);
  if ($('auto').checked) unload = (t * 0.4) % 1;
  const o: ThingOpt = { load: parseFloat($('load').value), move: parseFloat($('move').value), unload, dir: $('flip').checked ? -1 : 1 };
  for (const { s, c } of cvs) {
    const g = c.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.setTransform(z * dpr, 0, 0, z * dpr, 0, 0);
    s.draw(g, t, o, z);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
(window as unknown as { __ready: boolean }).__ready = true;
