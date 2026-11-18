/** 每位 NPC 的外观规格与装饰：配色/服饰/特征全部在这里，docs/art-assets.md 的角色设计表与此一一对应 */
import { Spec, G, Deco, Pt, blob, paint, limb, stroke, dot, dark, light, mix, rgba, INK, hairCap, ik, armLimb, ellipsePts } from './rig';

// ———— 通用小件 ————
const bowTie = (g: G, x0: number, y0: number, col: string, s = 1) => {
  const { x } = g;
  paint(x, [[x0, y0], [x0 - 3.6 * s, y0 - 2.2 * s], [x0 - 3.6 * s, y0 + 2.2 * s]], col, { seed: 31, lw: 0.9, wob: 0.15 });
  paint(x, [[x0, y0], [x0 + 3.6 * s, y0 - 2.2 * s], [x0 + 3.6 * s, y0 + 2.2 * s]], col, { seed: 32, lw: 0.9, wob: 0.15 });
  dot(x, x0, y0, 1.3 * s, dark(col, 0.2), INK);
};
const scarfBand = (g: G, col: string, rx = 0) => {
  const { x, r, cx, p } = g;
  blob(x, cx + p.sway * 0.9 + 0.5, g.torsoTop + 0.2, r.sw / 2 + 0.6 + rx, 3.5, col, { seed: 61, lw: 1.2, n: 10 });
  // 围巾针织纹
  for (let i = -3; i <= 3; i++) stroke(x, [[cx + p.sway + i * 2.4, g.torsoTop - 1.8], [cx + p.sway + i * 2.4 + 0.5, g.torsoTop + 2.4]], dark(col, 0.3), 0.7, { alpha: 0.6 });
};
const stripes = (g: G, col: string, x0: number, y0: number, w: number, h: number, n: number) => {
  for (let i = 0; i < n; i++) stroke(g.x, [[x0, y0 + (i * h) / n], [x0 + w * 0.5, y0 + (i * h) / n + 0.6], [x0 + w, y0 + (i * h) / n]], col, 0.9, { alpha: 0.7 });
};
const pigtails = (g: G, hair: string, rib: string) => {
  const { x, r } = g; const rx = r.headRx;
  for (const sx of [-1, 1]) blob(x, sx * (rx + 1.4), 5.8, 3.4, 7.2, hair, { seed: 14 + sx, rot: sx * 0.2, lw: 1.2, n: 10 });
};
const ribbons = (g: G, rib: string) => {
  const { x, r } = g; const rx = r.headRx;
  for (const sx of [-1, 1]) {
    const px = sx * (rx - 0.2), py = -1.4;
    paint(x, [[px, py], [px + sx * 5, py - 3], [px + sx * 5.2, py + 2.6]], rib, { seed: 40 + sx, lw: 0.9, wob: 0.15 });
    paint(x, [[px, py], [px - sx * 1.6, py - 3.4], [px - sx * 0.6, py + 3]], rib, { seed: 44 + sx, lw: 0.9, wob: 0.15 });
    dot(x, px, py, 1.4, dark(rib, 0.2), INK);
  }
};

// ———————— 小米：怯生生爱唱歌的小姑娘，长围巾 ————————
const xiaomi: Spec = {
  id: 'xiaomi', frame: 'adult',
  skin: '#f6d3b3', hair: '#4a3224', top: '#efe5d2', pants: '#4f6590', shoes: '#6a4630', accent: '#c8402f', hand: '#c8402f', sleeve: '#efe5d2', lash: true, cheek: '#f08878',
  rig: { legLen: 11.5, hipY: 57.8, shY: 44, headCy: 31.4, headRx: 12.4, headRy: 11.6, sw: 16.5, hw: 15.5, upper: 6.4, fore: 5.8, limbW: 4.8, legW: 5 },
  deco: {
    hairBack: (g) => pigtails(g, '#4a3224', '#c8402f'),
    hairFront: (g) => { hairCap(g, '#4a3224', { vol: 1.8, fringe: 5.2, part: -3, seed: 4 } as never); ribbons(g, '#c8402f'); },
    // 羽绒外套的绗缝纹
    torso: (g) => { const { x, cx, p } = g; const y0 = g.torsoTop; for (let i = 1; i <= 2; i++) stroke(x, [[cx - 7 + p.sway, y0 + i * 4.6], [cx + p.sway, y0 + i * 4.6 + 0.8], [cx + 7.4 + p.sway, y0 + i * 4.6]], dark('#efe5d2', 0.28), 0.9, { alpha: 0.8 }); stroke(x, [[cx + 0.4 + p.sway, y0 + 1], [cx + 0.6 + p.sway * 0.5, g.hipY]], dark('#efe5d2', 0.35), 0.9); },
    neck: (g) => scarfBand(g, '#c8402f'),
    torsoOver: (g) => { // 围巾长尾，随步伐飘
      const { x, cx, p, torsoTop } = g; const sw = p.sway * 2 + p.bob * 0.6;
      limb(x, [[cx + 3 + p.sway, torsoTop + 3], [cx + 5.5 + sw, torsoTop + 9], [cx + 4.6 + sw * 1.4, torsoTop + 14.5]], 4.2, '#c8402f', { seed: 71 });
      stroke(x, [[cx + 3.6 + sw * 1.2, torsoTop + 13.6], [cx + 6 + sw * 1.4, torsoTop + 14.1]], '#f0d9a0', 1.1, { alpha: 0.9 });
      stroke(x, [[cx + 3.2 + sw * 1.2, torsoTop + 15.2], [cx + 5.6 + sw * 1.4, torsoTop + 15.7]], '#f0d9a0', 1.1, { alpha: 0.9 });
    },
  },
};

// ———————— 阿宝：活泼皮实的小男孩，黄卫衣 ————————
const abao: Spec = {
  id: 'abao', frame: 'kid', kid: true,
  skin: '#f1c79f', hair: '#2a211d', top: '#e8a92e', pants: '#3f6f9f', shoes: '#f1ece0', accent: '#d8433a', cheek: '#ef8a74',
  deco: {
    neck: (g) => { // 兜帽堆在后颈
      const { x, cx, p } = g; blob(x, cx - 3.5 + p.sway, g.torsoTop + 0.5, 9.5, 3.8, dark('#e8a92e', 0.12), { seed: 81, lw: 1.2, n: 10 });
    },
    torso: (g) => { // 袋鼠兜 + 红抽绳
      const { x, cx, p, hipY } = g; const sx = p.sway * 0.4;
      paint(x, [[cx - 6 + sx, hipY - 6], [cx + 6 + sx, hipY - 6], [cx + 7 + sx, hipY - 0.5], [cx - 7 + sx, hipY - 0.5]], dark('#e8a92e', 0.1), { seed: 82, lw: 1, shade: 0.3, t: 0.2 });
      stroke(x, [[cx - 2 + p.sway, g.torsoTop + 1.5], [cx - 2.4 + p.sway, g.torsoTop + 7]], '#d8433a', 1.1);
      stroke(x, [[cx + 2 + p.sway, g.torsoTop + 1.5], [cx + 2.2 + p.sway, g.torsoTop + 6]], '#d8433a', 1.1);
    },
    hairFront: (g) => hairCap(g, '#2a211d', { vol: 1.6, fringe: 3.6, spiky: 2.2, part: 1, seed: 21 } as never),
    faceDeco: (g) => { // 脸颊创可贴
      const { x, r } = g; x.save(); x.translate(r.headRx - 5.2, 5.4); x.rotate(-0.4); x.fillStyle = '#f2d9b0'; x.strokeStyle = INK; x.lineWidth = 0.6; x.fillRect(-2.2, -0.9, 4.4, 1.8); x.strokeRect(-2.2, -0.9, 4.4, 1.8); x.restore();
    },
  },
};

// ———————— 妞妞：爱臭美的小女孩，双丸子头，粉背心 ————————
const niuniu: Spec = {
  id: 'niuniu', frame: 'kid', kid: true,
  skin: '#f6d0b0', hair: '#7a4527', top: '#e27c9c', pants: '#7a5aa0', shoes: '#f2d25a', accent: '#f2d25a', sleeve: '#f6e4cf', lash: true, cheek: '#f08aa0',
  deco: {
    hairBack: (g) => { const { x, r } = g; for (const sx of [-1, 1]) blob(x, sx * (r.headRx - 2.2), -r.headRy - 1.6, 5.3, 5, '#7a4527', { seed: 33 + sx, lw: 1.2, n: 9 }); },
    torso: (g) => { // 粉色小背心 + 星星
      const { x, cx, p } = g; const sx = p.sway * 0.6;
      paint(x, ellipsePts(cx + 0.4 + sx, g.torsoTop + 6.4, 2.7, 2.7, 5, 0.3).map((q, i) => { const a = (i / 5) * Math.PI * 2 - Math.PI / 2, rr = i % 1 === 0 ? 3 : 1.4; return [cx + 0.4 + sx + Math.cos(a) * rr, g.torsoTop + 6.4 + Math.sin(a) * rr] as Pt; }), '#f2d25a', { seed: 91, lw: 0.8, wob: 0.1, t: 0.1 });
    },
    hairFront: (g) => {
      hairCap(g, '#7a4527', { vol: 1.2, fringe: 5.4, part: 0, seed: 30 } as never);
      const { x, r } = g; for (const sx of [-1, 1]) { // 黄色发圈
        blob(x, sx * (r.headRx - 2.2), -r.headRy + 1.1, 3.9, 1.5, '#f2d25a', { seed: 35 + sx, lw: 0.9, n: 8 });
      }
    },
  },
};

// ———————— 桂芳阿姨：广场舞阿姨，烫卷发、紫棉袄、粉扇子 ————————
const aunt: Spec = {
  id: 'aunt', frame: 'adult',
  skin: '#f3cba8', hair: '#4a3640', top: '#8b52a6', pants: '#33303c', shoes: '#f0ece2', accent: '#f0c93a', lash: true, cheek: '#e8707a',
  rig: { sw: 20, hw: 19, belly: 2.6, upper: 7, fore: 6.4, limbW: 5.4, legW: 6, headRx: 12.6, headRy: 11.2 },
  deco: {
    hairBack: (g) => { const { x, r } = g; const rx = r.headRx, ry = r.headRy; const cl: [number, number, number][] = [[-rx - 1, 0, 4.4], [-rx + 0.2, -ry * 0.55, 4.8], [-rx * 0.5, -ry - 1.2, 5], [0, -ry - 2.4, 5.2], [rx * 0.5, -ry - 1.4, 5], [rx - 0.2, -ry * 0.55, 4.8], [rx + 1, 0.4, 4.3], [-rx - 0.6, 5, 3.4], [rx + 0.6, 5.2, 3.3]]; cl.forEach(([a, b, c], i) => blob(x, a, b, c, c * 0.96, '#4a3640', { seed: 100 + i, lw: 1.1, n: 8 })); },
    hairFront: (g) => { // 前额卷刘海
      const { x, r } = g; for (let i = -2; i <= 2; i++) blob(x, 2.5 + i * 4.2, -r.headRy + 3.6 - Math.abs(i) * 0.5, 2.6, 2.3, '#4a3640', { seed: 110 + i, lw: 1, n: 7 });
      dot(x, r.headRx - 3, -r.headRy + 3.6, 1.6, '#f0c93a', INK);
    },
    faceDeco: (g) => { const { x, r } = g; // 红唇 + 金耳环
      dot(x, -r.headRx + 1, 5.2, 1.2, '#f0c93a', INK);
      x.save(); x.fillStyle = 'rgba(210,60,70,0.55)'; x.beginPath(); x.ellipse(3.6, 7.2, 2.3, 0.9, 0, 0, 7); x.fill(); x.restore();
    },
    torso: (g) => { // 紫棉袄：盘扣与暗花
      const { x, cx, p, hipY } = g; const sx = p.sway * 0.6;
      stroke(x, [[cx + 1 + sx, g.torsoTop + 1], [cx + 1.2 + sx * 0.5, hipY + 0.4]], dark('#8b52a6', 0.4), 1);
      for (let i = 0; i < 3; i++) { dot(x, cx + 1.2 + sx - i * 0.1, g.torsoTop + 4.5 + i * 4.8, 1.3, '#f0c93a', INK); }
      for (let i = 0; i < 4; i++) stroke(x, [[cx - 8 + sx, g.torsoTop + 3 + i * 3.6], [cx - 3 + sx, g.torsoTop + 3.6 + i * 3.6]], light('#8b52a6', 0.25), 0.8, { alpha: 0.7 });
    },
    held: (g) => { // 粉扇子（舞蹈/开心时）
      if (g.p.prop !== 'fan') return;
      const { x, handR } = g; x.save(); x.translate(handR[0], handR[1] - 1); x.rotate(-0.5);
      for (let i = -3; i <= 3; i++) { x.beginPath(); x.moveTo(0, 0); x.lineTo(i * 2.2, -9 + Math.abs(i) * 0.9); x.strokeStyle = INK; x.lineWidth = 0.6; x.stroke(); }
      paint(x, [[0, 0], [-7, -8.4], [-3.5, -10.6], [0, -11.2], [3.5, -10.6], [7, -8.4]], '#f08aa6', { seed: 120, lw: 1, wob: 0.2, t: 0.3 });
      stroke(x, [[-5, -8.4], [0, -9.6], [5, -8.4]], '#fff1d0', 0.7, { alpha: 0.8 });
      x.restore();
    },
  },
};

// ———————— 外卖小哥：黄头盔、青色冲锋衣、黄色保温箱 ————————
const courier: Spec = {
  id: 'courier', frame: 'adult',
  skin: '#eabf98', hair: '#2a2a2a', top: '#2b9d8f', pants: '#303844', shoes: '#262626', accent: '#f4c430', cheek: '#e88a6a',
  rig: { sw: 19.5, hw: 17, upper: 7.4, fore: 6.8 },
  deco: {
    behind: (g) => { // 背后的保温箱（脸朝右，背在左边）
      const { x, cx, p } = g; const sx = p.sway * 0.5;
      paint(x, [[cx - 17 + sx, g.torsoTop - 2], [cx - 5 + sx, g.torsoTop - 3], [cx - 4 + sx, g.hipY - 1], [cx - 17.5 + sx, g.hipY + 1]], '#f4c430', { seed: 131, lw: 1.3, t: 0.15 });
      paint(x, [[cx - 17 + sx, g.torsoTop - 2], [cx - 5 + sx, g.torsoTop - 3], [cx - 6 + sx, g.torsoTop + 1.4], [cx - 17.5 + sx, g.torsoTop + 2.6]], light('#f4c430', 0.25), { seed: 132, lw: 1, t: 0.15, shade: 0.2 });
      dot(x, cx - 11 + sx, g.torsoTop + 9, 3, '#fff3cf', INK); stroke(x, [[cx - 12.2 + sx, g.torsoTop + 9], [cx - 10.8 + sx, g.torsoTop + 10], [cx - 9.6 + sx, g.torsoTop + 8]], '#c9822a', 1);
    },
    torso: (g) => { const { x, cx, p } = g; const sx = p.sway * 0.6; // 反光条
      stroke(x, [[cx - 8 + sx, g.hipY - 5], [cx + 0 + sx, g.hipY - 4.2], [cx + 8.4 + sx, g.hipY - 5]], '#e9f4d4', 1.8, { alpha: 0.95 });
      stroke(x, [[cx + 0.6 + sx, g.torsoTop + 1], [cx + 0.8 + sx * 0.5, g.hipY]], dark('#2b9d8f', 0.4), 1);
    },
    torsoOver: (g) => { const { x, cx, p } = g; // 背带
      stroke(x, [[cx - 7.6 + p.sway, g.torsoTop + 0.5], [cx + 4 + p.sway * 0.6, g.hipY - 1]], '#1f6c63', 2.2);
    },
    hairFront: (g) => hairCap(g, '#2a2a2a', { vol: 0.4, fringe: 2.5, seed: 25, sideL: 3.5 } as never),
    hat: (g) => { // 黄头盔 + 帽檐
      const { x, r } = g; const rx = r.headRx, ry = r.headRy;
      paint(x, [[-rx - 1.3, 1.2], [-rx - 1.2, -ry * 0.5], [-rx * 0.6, -ry - 3.6], [0, -ry - 5.2], [rx * 0.6, -ry - 3.7], [rx + 1.1, -ry * 0.45], [rx + 1.4, -1.4], [rx - 1, -3], [rx * 0.3, -4.2], [-rx * 0.5, -3.4], [-rx + 1, -1.6]], '#f4c430', { seed: 140, lw: 1.35, t: 0.5, hi: 0.7, hiAt: [0.3, 0.22] });
      paint(x, [[rx - 3, -3.2], [rx + 5.8, -2.2], [rx + 6.2, -0.4], [rx - 2, -0.6]], dark('#f4c430', 0.18), { seed: 141, lw: 1.1, wob: 0.15, shade: 0.4 });
      stroke(x, [[-rx * 0.3, -ry - 4.8], [-rx * 0.1, -4]], '#fff3c4', 1.4, { alpha: 0.6 });
      stroke(x, [[-1, -ry - 4.7], [-1.6, -4.2]], '#c9962a', 0.9);
    },
  },
};

// ———————— 阿福：邮递员，绿制服、大檐帽、邮包；怕狗 ————————
const afu: Spec = {
  id: 'afu', frame: 'adult',
  skin: '#e9bf9a', hair: '#35291f', top: '#2f7a58', pants: '#3c4a46', shoes: '#2e2a26', accent: '#f0c93a', cheek: '#e88a6a',
  rig: { sw: 19, hw: 17, upper: 7.3, fore: 6.8 },
  deco: {
    torso: (g) => { const { x, cx, p, hipY } = g; const sx = p.sway * 0.6; // 双排扣+领章
      stroke(x, [[cx + 0.4 + sx, g.torsoTop + 1], [cx + 0.6 + sx * 0.5, hipY]], dark('#2f7a58', 0.4), 1);
      for (let i = 0; i < 3; i++) { dot(x, cx - 2 + sx, g.torsoTop + 5 + i * 4.4, 1.1, '#f0c93a', INK); dot(x, cx + 3 + sx, g.torsoTop + 5 + i * 4.4, 1.1, '#f0c93a', INK); }
      paint(x, [[cx - 8.6 + sx, g.torsoTop + 1.4], [cx - 4 + sx, g.torsoTop + 2.4], [cx - 6 + sx, g.torsoTop + 6]], '#e8f0d8', { seed: 151, lw: 0.9, wob: 0.15, shade: 0.2 });
      paint(x, [[cx + 9 + sx, g.torsoTop + 1.4], [cx + 4.6 + sx, g.torsoTop + 2.4], [cx + 6.8 + sx, g.torsoTop + 6]], '#e8f0d8', { seed: 152, lw: 0.9, wob: 0.15, shade: 0.2 });
    },
    torsoOver: (g) => { const { x, cx, p, hipY } = g; const sx = p.sway * 0.6; // 斜挎邮包
      limb(x, [[cx - 6 + sx, g.torsoTop + 0.5], [cx + 0 + sx, g.torsoTop + 9], [cx + 6.5 + sx, hipY - 1]], 2.4, '#7a5030', { seed: 153 });
      paint(x, [[cx + 3 + sx, hipY - 3.4], [cx + 15 + sx, hipY - 3.8], [cx + 15.6 + sx, hipY + 7], [cx + 3.4 + sx, hipY + 7.4]], '#8a5c36', { seed: 154, lw: 1.2, t: 0.15 });
      paint(x, [[cx + 3 + sx, hipY - 3.4], [cx + 15 + sx, hipY - 3.8], [cx + 14.6 + sx, hipY + 1.8], [cx + 3.2 + sx, hipY + 2]], light('#8a5c36', 0.2), { seed: 155, lw: 1, t: 0.15 });
      dot(x, cx + 9.4 + sx, hipY + 2, 1, '#f0c93a', INK);
      paint(x, [[cx + 5.6 + sx, hipY - 7], [cx + 11 + sx, hipY - 7.6], [cx + 11.4 + sx, hipY - 3.6], [cx + 5.8 + sx, hipY - 3.4]], '#fff8e4', { seed: 156, lw: 0.8, wob: 0.15, hi: 0.3 }); // 信封
      stroke(x, [[cx + 5.8 + sx, hipY - 7], [cx + 8.4 + sx, hipY - 5.2], [cx + 11.2 + sx, hipY - 7.4]], INK_S, 0.7);
    },
    hairFront: (g) => hairCap(g, '#35291f', { vol: 0.2, fringe: 2.2, seed: 41, sideL: 3.5 } as never),
    faceDeco: (g) => { const { x, r } = g; // 黑眼圈的疲惫感
      for (const sx of [-1, 1]) stroke(x, [[2.7 + sx * 4.2 - 2, 5], [2.7 + sx * 4.2, 5.5], [2.7 + sx * 4.2 + 2, 5]], '#b4806a', 0.8, { alpha: 0.6 }); void r;
    },
    hat: (g) => { // 邮政绿檐帽
      const { x, r } = g; const rx = r.headRx, ry = r.headRy;
      paint(x, [[-rx - 1, -0.6], [-rx - 0.6, -ry * 0.55], [-rx * 0.55, -ry - 3.2], [rx * 0.2, -ry - 4.2], [rx * 0.8, -ry - 2], [rx + 1.3, -ry * 0.3], [rx + 1.4, -1.4], [-rx * 0.1, -3.6]], '#2f7a58', { seed: 160, lw: 1.35, hi: 0.6 });
      paint(x, [[-rx - 1, -0.6], [rx + 1.4, -1.6], [rx + 1.3, -3.2], [-rx - 0.6, -3.4]], dark('#2f7a58', 0.25), { seed: 161, lw: 1, wob: 0.2, shade: 0.2, t: 0.3 });
      paint(x, [[rx - 1.5, -2.6], [rx + 7.6, -1.8], [rx + 7.4, -0.2], [rx - 1.8, -0.6]], '#1f3a2e', { seed: 162, lw: 1.1, wob: 0.15, shade: 0.3 });
      dot(x, rx * 0.5, -ry - 0.2, 2.1, '#f0c93a', INK); stroke(x, [[rx * 0.5 - 1, -ry - 0.2], [rx * 0.5 + 1, -ry - 0.2]], INK_S, 0.7);
    },
  },
};
const INK_S = '#6b4535';

// ———————— 老周：六十来岁的面包师，圆肚、白围裙、圆眼镜、白胡子 ————————
const laozhou: Spec = {
  id: 'laozhou', frame: 'adult',
  skin: '#efc8a2', hair: '#ece6da', top: '#6f84a0', pants: '#5a4a3c', shoes: '#4a3a30', accent: '#fff6e2', sleeve: '#6f84a0', cheek: '#e88a7a',
  rig: { legLen: 12, hipY: 57.5, shY: 39.5, headCy: 26, sw: 21, hw: 20.5, belly: 3.4, upper: 6.6, fore: 6.2, limbW: 5.6, legW: 6.2, headRx: 12.6, headRy: 11.2 },
  deco: {
    torso: (g) => { // 白围裙，面粉点，系带
      const { x, cx, p, hipY } = g; const sx = p.sway * 0.5;
      paint(x, [[cx - 7.8 + sx, g.torsoTop + 3], [cx + 8.4 + sx, g.torsoTop + 3], [cx + 11.4 + sx * 0.6, hipY + 3], [cx - 11.4 + sx * 0.6, hipY + 3]], '#fff6e2', { seed: 170, lw: 1.2, t: 0.18, shade: 0.5 });
      stroke(x, [[cx - 7.8 + sx, g.torsoTop + 3.2], [cx - 11 + sx, g.torsoTop + 0.4]], '#e7d9bd', 1.2); stroke(x, [[cx + 8.4 + sx, g.torsoTop + 3.2], [cx + 11 + sx, g.torsoTop + 0.4]], '#e7d9bd', 1.2);
      paint(x, [[cx - 4 + sx, hipY - 3], [cx + 5 + sx, hipY - 3], [cx + 5.4 + sx, hipY + 2.4], [cx - 4.4 + sx, hipY + 2.4]], '#efe3c8', { seed: 171, lw: 0.9, wob: 0.15, shade: 0.3, t: 0.2 });
      const r = [[-5, 8], [3, 12], [6, 6], [-2, 17], [8, 15], [-8, 14]];
      r.forEach(([a, b]) => dot(x, cx + a + sx, g.torsoTop + b, 0.5, 'rgba(255,255,255,0.9)'));
    },
    neck: (g) => { const { x, cx, p } = g; // 肩上的白毛巾
      paint(x, [[cx - 11 + p.sway, g.torsoTop - 0.5], [cx - 5 + p.sway, g.torsoTop - 1.4], [cx - 4 + p.sway, g.torsoTop + 8], [cx - 10.5 + p.sway, g.torsoTop + 9]], '#e8eef0', { seed: 172, lw: 1.1, wob: 0.2, t: 0.2 });
      stroke(x, [[cx - 10 + p.sway, g.torsoTop + 6], [cx - 5 + p.sway, g.torsoTop + 5.4]], '#7f9fb8', 0.9);
    },
    hairBack: (g) => { const { x, r } = g; for (const sx of [-1, 1]) blob(x, sx * (r.headRx - 0.6), 0.4, 3.4, 4.6, '#ece6da', { seed: 175 + sx, lw: 1.1, n: 8 }); },
    faceDeco: (g) => { const { x, r } = g; // 圆眼镜、白胡子、粗白眉、面粉
      const fo = 2.7, ey = 1.6, ex = 4.2;
      for (const sx of [-1, 1]) { x.save(); x.strokeStyle = '#6b4a30'; x.lineWidth = 0.95; x.fillStyle = 'rgba(210,235,255,0.22)'; x.beginPath(); x.ellipse(fo + sx * ex, ey, 3.7, 3.7, 0, 0, 7); x.fill(); x.stroke(); x.fillStyle = 'rgba(255,255,255,0.65)'; x.beginPath(); x.ellipse(fo + sx * ex - 1.2, ey - 1.5, 0.9, 0.55, -0.6, 0, 7); x.fill(); x.restore(); }
      stroke(x, [[fo - ex + 3.6, ey - 0.4], [fo, ey - 0.9], [fo + ex - 3.6, ey - 0.4]], '#6b4a30', 0.9);
      for (const sx of [-1, 1]) blob(x, fo + sx * ex, ey - 4.6, 3.1, 1.2, '#f4efe4', { seed: 180 + sx, lw: 0.7, n: 7, rot: sx * -0.15 });
      paint(x, [[fo - 5.4, 5.6], [fo - 1, 4.8], [fo + 0.6, 5.5], [fo + 4.6, 4.8], [fo + 8, 5.8], [fo + 5, 8.2], [fo + 0.6, 7.4], [fo - 3.5, 8.4]], '#f4efe4', { seed: 183, lw: 0.9, wob: 0.15, t: 0.4 });
      for (const q of [[2, -3], [-6, 3.5], [9, 3]]) dot(x, q[0], q[1], 0.45, 'rgba(255,255,255,0.9)'); void r;
    },
  },
};

// ———————— 小蓝：画家，蓝色贝雷帽，沾满颜料的米色画袍 ————————
const xiaolan: Spec = {
  id: 'xiaolan', frame: 'adult',
  skin: '#f2cfae', hair: '#27355c', top: '#6a97cc', pants: '#3b4968', shoes: '#7a5036', accent: '#e86a52', sleeve: '#6a97cc', lash: true, cheek: '#ee8a80',
  rig: { sw: 17.5, hw: 16, headRx: 11.8, upper: 7.4, fore: 6.9, limbW: 4.7, legW: 5.2 },
  deco: {
    hairBack: (g) => { const { x, r } = g; const rx = r.headRx; // 披肩长发，发尾微蓝
      paint(x, [[-rx - 1.2, -3], [rx + 1, -3], [rx + 3.4, 8], [rx + 1.4, 16], [rx - 2, 17], [-rx + 1.8, 17.6], [-rx - 3.6, 15], [-rx - 3, 5]], '#27355c', { seed: 190, lw: 1.3, t: 0.4, hi: 0.5, hiAt: [0.3, 0.35] });
      stroke(x, [[-rx - 0.6, 6], [-rx - 1.4, 13]], '#4a63a0', 1, { alpha: 0.7 }); stroke(x, [[rx + 0.4, 7], [rx + 1, 13]], '#4a63a0', 1, { alpha: 0.7 });
    },
    hairFront: (g) => hairCap(g, '#27355c', { vol: 0.6, fringe: 6, part: 3, seed: 51, sideL: 7, sideR: 6 } as never),
    hat: (g) => { const { x, r } = g; const rx = r.headRx, ry = r.headRy; // 贝雷帽斜戴
      x.save(); x.rotate(-0.12);
      paint(x, [[-rx - 3, -ry * 0.1], [-rx - 1.4, -ry * 0.85], [-rx * 0.4, -ry - 4.8], [rx * 0.6, -ry - 4.6], [rx + 2.6, -ry * 0.7], [rx + 4.2, -ry * 0.15], [rx * 0.4, -ry * 0.55], [-rx * 0.5, -ry * 0.5]], '#d65a4c', { seed: 195, lw: 1.35, t: 0.5, hi: 0.7, hiAt: [0.32, 0.28] });
      dot(x, -1, -ry - 5.2, 1.3, dark('#d65a4c', 0.3), INK);
      x.restore();
    },
    faceDeco: (g) => { const { x, r } = g; // 耳后的画笔 + 脸颊一抹颜料
      limb(x, [[-r.headRx + 3, -r.headRy + 3], [-r.headRx - 3, -r.headRy - 6]], 1.3, '#b9874a', { seed: 196, lw: 0.7 });
      dot(x, -r.headRx - 3.2, -r.headRy - 6.6, 1.2, '#4aa3b8');
      x.save(); x.strokeStyle = 'rgba(72,170,190,0.75)'; x.lineWidth = 1.3; x.beginPath(); x.moveTo(r.headRx - 5.6, 5.3); x.lineTo(r.headRx - 2.6, 4.7); x.stroke(); x.restore();
    },
    torso: (g) => { const { x, cx, p, hipY } = g; const sx = p.sway * 0.5; // 米色画袍 + 颜料点
      paint(x, [[cx - 9 + sx, g.torsoTop + 1.4], [cx - 3.4 + sx, g.torsoTop + 2], [cx - 4.4 + sx, hipY + 7], [cx - 10.4 + sx, hipY + 6]], '#eadcb8', { seed: 200, lw: 1.1, t: 0.2, shade: 0.4 });
      paint(x, [[cx + 3.4 + sx, g.torsoTop + 2], [cx + 9 + sx, g.torsoTop + 1.4], [cx + 10.4 + sx, hipY + 6], [cx + 4.4 + sx, hipY + 7]], '#eadcb8', { seed: 201, lw: 1.1, t: 0.2, shade: 0.4 });
      const sp: [number, number, string][] = [[-8, 12, '#e86a52'], [-6, 17, '#f2c64b'], [8, 10, '#4aa3b8'], [7, 16, '#e86a52'], [-9, 7, '#7bb86f']];
      sp.forEach(([a, b, c]) => dot(x, cx + a + sx, g.torsoTop + b, 0.9, c));
    },
  },
};

// ———————— 阿冬：轮椅少年，赛车手气质，橙色外套 + 格子毯 ————————
const WCOL = '#8a96a6', WDARK = '#566170';
const wheelAt = (g: G): { c: Pt; r: number } => ({ c: [g.cx - 4, g.r.ground - 12.2], r: 12 });
const adong: Spec = {
  id: 'adong', frame: 'adult',
  skin: '#e9c09a', hair: '#1f1b1a', top: '#e8762c', pants: '#2f3a52', shoes: '#f0ece2', accent: '#f4d35e', sleeve: '#e8762c', hand: '#2b2b2e', cheek: '#e88a6a',
  rig: { hipY: 55, shY: 38, headCy: 24.5, sw: 18.5, hw: 16, upper: 7.2, fore: 6.8, limbW: 5 },
  deco: {
    noLegs: true,
    behind: (g) => { const { x, cx, ground } = { ...g, ground: g.r.ground }; // 推手：椅背管 + 橡胶握把 + 小铃铛
      limb(x, [[cx - 8.5, 58], [cx - 9.5, 41], [cx - 14.6, 38.5]], 2.2, WCOL, { seed: 210, lw: 0.9 });
      limb(x, [[cx - 14.2, 38.7], [cx - 18.2, 37.6]], 3.2, '#3b3030', { seed: 211, lw: 0.9 });
      dot(x, cx - 10, 41.6, 1.4, '#f4d35e', INK); void ground;
    },
    lower: (g) => { const { x, cx, r, p } = g; // 座椅 + 大腿 + 小腿 + 脚踏板 + 前小轮
      const sy = 58;
      limb(x, [[cx - 9, sy + 0.5], [cx + 4, sy + 0.2]], 3.4, WDARK, { seed: 212, lw: 0.9 }); // 坐垫座管
      limb(x, [[cx + 9, sy + 1], [cx + 13.5, r.ground - 8], [cx + 13, r.ground - 2.6]], 2, WCOL, { seed: 213, lw: 0.9 }); // 前叉
      // 大腿与小腿
      limb(x, [[g.cx - 1.5, g.hipY + 1], [cx + 8, sy - 2]], 6.2, '#2f3a52', { seed: 214 });
      limb(x, [[cx + 8, sy - 2], [cx + 11.6, r.ground - 11]], 5.2, '#2f3a52', { seed: 215 });
      paint(x, [[cx + 8, r.ground - 7.8], [cx + 20, r.ground - 7.4], [cx + 20, r.ground - 5.2], [cx + 7.4, r.ground - 5.6]], WCOL, { seed: 216, lw: 0.9, wob: 0.12, t: 0.2 });
      blob(x, cx + 14, r.ground - 9.6, 5.6, 2.9, '#f0ece2', { seed: 217, lw: 1.2, n: 9 });
      stroke(x, [[cx + 11, r.ground - 8.6], [cx + 18, r.ground - 8.6]], '#e8762c', 1);
      // 小脚轮
      blob(x, cx + 13, r.ground - 3, 3.2, 3.2, '#3b3430', { seed: 218, lw: 1, n: 8 }); dot(x, cx + 13, r.ground - 3, 1, WCOL);
      void p;
    },
    torso: (g) => { const { x, cx, r, p } = g; const sx = p.sway * 0.5; // 赛手号码布
      paint(x, [[cx - 5 + sx, g.torsoTop + 5], [cx + 5 + sx, g.torsoTop + 4.6], [cx + 5.4 + sx, g.torsoTop + 13], [cx - 5.2 + sx, g.torsoTop + 13.4]], '#fff3d8', { seed: 220, lw: 1, wob: 0.15, t: 0.2 });
      stroke(x, [[cx - 2.4 + sx, g.torsoTop + 7.4], [cx + 2.6 + sx, g.torsoTop + 7.2], [cx - 0.6 + sx, g.torsoTop + 12]], '#d8433a', 1.4);
      stroke(x, [[cx - 8.4 + sx, g.torsoTop + 2], [cx - 8.8 + sx, g.hipY]], '#fff3d8', 1.3, { alpha: 0.9 });
      // 格子毯盖在腿上，系得整整齐齐
      const bl: Pt[] = [[cx - 6, 51.8], [cx + 2, 51], [cx + 9, 53.2], [cx + 15.4, 59.6], [cx + 15, 66.6], [cx + 11, 67.6], [cx + 8, 62], [cx + 2, 60.4], [cx - 5, 60.6]];
      paint(x, bl, '#b8473b', { seed: 221, lw: 1.3, t: 0.4 });
      x.save(); x.beginPath(); (function sm(){ x.moveTo(bl[0][0], bl[0][1]); for (let i = 1; i < bl.length; i++) x.lineTo(bl[i][0], bl[i][1]); x.closePath(); })(); x.clip();
      x.strokeStyle = 'rgba(247,226,170,0.85)'; x.lineWidth = 1; for (let i = -2; i < 8; i++) { x.beginPath(); x.moveTo(cx - 6 + i * 3.4, 49); x.lineTo(cx - 2 + i * 3.4, 70); x.stroke(); }
      x.strokeStyle = 'rgba(60,40,70,0.5)'; x.lineWidth = 1; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(cx - 8, 52 + i * 3); x.lineTo(cx + 18, 52 + i * 3 + 3.6); x.stroke(); }
      x.restore();
      for (let i = 0; i < 4; i++) stroke(x, [[cx + 13.4 + i * 0.6, 62.6 + i * 1.2], [cx + 14.6 + i * 0.6, 64.8 + i * 1.2]], '#f2e6c0', 0.9);
      // 近侧大轮（半透明辐条）
      const w = wheelAt(g); const wr = w.r;
      x.save(); x.strokeStyle = 'rgba(60,45,40,0.9)'; x.lineWidth = 2.4; x.beginPath(); x.arc(w.c[0], w.c[1], wr, 0, Math.PI * 2); x.stroke();
      x.strokeStyle = 'rgba(220,206,180,0.9)'; x.lineWidth = 0.9; x.beginPath(); x.arc(w.c[0], w.c[1], wr - 0.2, 0.2, Math.PI * 1.4); x.stroke();
      x.strokeStyle = WCOL; x.lineWidth = 1; x.beginPath(); x.arc(w.c[0], w.c[1], wr - 2.1, 0, Math.PI * 2); x.stroke();
      x.strokeStyle = 'rgba(95,105,120,0.9)'; x.lineWidth = 0.7;
      for (let i = 0; i < 8; i++) { const a = p.wheel + (i / 8) * Math.PI * 2; x.beginPath(); x.moveTo(w.c[0], w.c[1]); x.lineTo(w.c[0] + Math.cos(a) * (wr - 2.2), w.c[1] + Math.sin(a) * (wr - 2.2)); x.stroke(); }
      x.restore();
      dot(x, w.c[0], w.c[1], 2, WDARK, INK); dot(x, w.c[0] - 0.4, w.c[1] - 0.5, 0.7, '#e6edf4'); void r;
    },
    hairFront: (g) => hairCap(g, '#1f1b1a', { vol: 1.2, fringe: 3.2, spiky: 1.8, part: 2, seed: 61 } as never),
    hat: (g) => { const { x, r } = g; const rx = r.headRx, ry = r.headRy; // 护目镜推在额头上 + 小圆耳机？只留护目镜
      limb(x, [[-rx - 0.6, -ry * 0.35], [0, -ry * 0.5], [rx + 0.6, -ry * 0.3]], 2.6, '#2b2b2e', { seed: 230, lw: 0.8 });
      for (const sx of [-0.55, 0.45]) { x.save(); x.fillStyle = 'rgba(244,211,94,0.9)'; x.strokeStyle = INK; x.lineWidth = 0.9; x.beginPath(); x.ellipse(sx * rx + 1.6, -ry * 0.48, 3.6, 2.9, 0, 0, 7); x.fill(); x.stroke(); x.fillStyle = 'rgba(255,255,255,0.7)'; x.beginPath(); x.ellipse(sx * rx + 0.4, -ry * 0.48 - 1, 1.2, 0.7, -0.5, 0, 7); x.fill(); x.restore(); }
    },
    frontArm: (g) => { const { x, r, p, shR } = g; // 双手搭在推圈上，随车轮转动
      const w = wheelAt(g); const th = -1.15 + Math.sin(p.wheel * 1.0) * 0.4;
      const tgt: Pt = [w.c[0] + Math.cos(th) * (w.r - 1.2), w.c[1] + Math.sin(th) * (w.r - 1.2)];
      const hand = p.armR.a > 1.3 ? { e: g.elbR, h: g.handR } : ik(shR, tgt, r.upper, r.fore, -1);
      armLimb(g, shR, hand, '#e8762c', '#2b2b2e', 11); void x;
    },
    backArm: (g) => { const { r, p, shL } = g; // 另一只手放在毯子上 / 扶着轮
      const hand = p.armL.a < -1.3 ? { e: g.elbL, h: g.handL } : ik(shL, [g.cx + 3, 54.6], r.upper, r.fore, 1);
      armLimb(g, shL, hand, '#d0671f', '#2b2b2e', 7);
    },
  },
  mod: (key, p) => {
    if (key.startsWith('walk')) { p.bob *= 0.3; p.footL = { dx: 0, lift: 0 }; p.footR = { dx: 0, lift: 0 }; p.eyes = 'open'; p.mouth = 'smirk'; p.brows = 'angry'; p.tilt = 0.04; p.sway = 0.6; }
    if (key.startsWith('idle') || key === '0') { p.mouth = 'smirk'; p.brows = 'n'; }
    if (key === 'emo_dance_0' || key === 'emo_dance_1') { p.chairTilt = key.endsWith('0') ? -0.2 : 0; p.armL = { a: -2.4, b: -2.8 }; p.armR = { a: 2.4, b: 2.8 }; p.mouth = 'laugh'; p.bob = -1; }
    if (key === 'emo_happy') { p.chairTilt = -0.12; p.bob = -1; }
    if (key.startsWith('emo_sing')) { p.armL = { a: -0.8, b: 0.5 }; p.armR = { a: 0.8, b: -0.5 }; }
    p.footL = { dx: 0, lift: 0 }; p.footR = { dx: 0, lift: 0 };
  },
};


// ———————— 圣诞老人（终章）：由帽子“长出身体”，圆肚、白胡子、红袍、黑靴 ————————
const santa: Spec = {
  id: 'santa', frame: 'adult',
  skin: '#f3c9a6', hair: '#fffaf0', top: '#d8382f', pants: '#d8382f', shoes: '#2b2220', accent: '#fffaf0', sleeve: '#d8382f', hand: '#fffaf0', cheek: '#ee7a6e',
  rig: { sw: 22, hw: 21.5, belly: 4.6, upper: 7, fore: 6.4, limbW: 6.2, legW: 6.6, headRx: 12.6, headRy: 11.2, legLen: 11 },
  deco: {
    torso: (g) => { const { x, cx, p, hipY } = g; const sx = p.sway * 0.5;
      // 白毛边前襟 + 黑腰带金扣
      paint(x, [[cx - 1.8 + sx, g.torsoTop + 1], [cx + 2.6 + sx, g.torsoTop + 1], [cx + 3 + sx * 0.6, hipY + 1], [cx - 2.2 + sx * 0.6, hipY + 1]], '#fffaf0', { seed: 300, lw: 1, t: 0.3, shade: 0.4 });
      paint(x, [[cx - 11.5 + sx, hipY - 5.6], [cx + 12 + sx, hipY - 6], [cx + 12.2 + sx, hipY - 1.6], [cx - 11.6 + sx, hipY - 1.2]], '#2b2220', { seed: 301, lw: 1, wob: 0.2, shade: 0.3 });
      paint(x, [[cx - 2.6 + sx, hipY - 6.6], [cx + 3 + sx, hipY - 6.6], [cx + 3 + sx, hipY - 0.4], [cx - 2.6 + sx, hipY - 0.4]], '#f2c23c', { seed: 302, lw: 0.9, wob: 0.12, hi: 0.8 });
      paint(x, [[cx - 1 + sx, hipY - 5], [cx + 1.4 + sx, hipY - 5], [cx + 1.4 + sx, hipY - 2], [cx - 1 + sx, hipY - 2]], '#a9741a', { seed: 303, lw: 0.6, wob: 0.1, flat: true });
      // 下摆白边
      paint(x, [[cx - 11.8 + sx * 0.6, hipY + 3], [cx + 12.4 + sx * 0.6, hipY + 3], [cx + 12.6 + sx * 0.6, hipY + 6.4], [cx - 12 + sx * 0.6, hipY + 6.4]], '#fffaf0', { seed: 304, lw: 1.1, wob: 0.3, shade: 0.4 });
    },
    neck: (g) => { const { x, cx, p } = g; blob(x, cx + p.sway * 0.9 + 0.4, g.torsoTop + 0.6, 12, 3.2, '#fffaf0', { seed: 305, lw: 1.1, n: 12 }); },
    hairBack: (g) => { const { x, r } = g; for (const sx of [-1, 1]) blob(x, sx * (r.headRx - 0.4), 3, 3.4, 6, '#fffaf0', { seed: 310 + sx, lw: 1.1, n: 8 }); },
    hairFront: (g) => hairCap(g, '#fffaf0', { vol: 0.4, fringe: 1.8, seed: 61, sideL: 3 } as never),
    faceDeco: (g) => { const { x, r } = g; // 大白胡子、浓白眉、红鼻头
      for (const sx of [-1, 1]) blob(x, 2.7 + sx * 4.2, -2.2, 3.4, 1.5, '#fffaf0', { seed: 320 + sx, lw: 0.8, n: 8, rot: sx * -0.2 });
      paint(x, [[-r.headRx + 0.6, 3.6], [-1, 4.4], [2.8, 3.8], [7.2, 4.4], [r.headRx + 1, 3.6], [r.headRx - 1, 11], [5, 17], [1, 18.6], [-3, 17], [-r.headRx + 3, 11]], '#fffaf0', { seed: 330, lw: 1.2, t: 0.45, hi: 0.7 });
      blob(x, 3, 5.4, 4.6, 1.8, '#fffaf0', { seed: 331, lw: 0.9, n: 9 });
      dot(x, 3, 3.2, 1.6, '#ee8a78', INK);
    },
    hat: (g) => { const { x, r } = g; const rx = r.headRx, ry = r.headRy;
      paint(x, [[-rx - 1.4, -1], [-rx - 0.8, -ry * 0.6], [-rx * 0.3, -ry - 5], [rx * 0.6, -ry - 6.4], [rx * 1.3, -ry - 2.4], [rx * 1.8, 2.4], [rx * 1.2, 3.4], [rx * 0.8, -ry * 0.3], [rx * 0.4, -3.4], [-rx * 0.5, -2.4]], '#d8382f', { seed: 340, lw: 1.35, t: 0.45, hi: 0.7, hiAt: [0.3, 0.25] });
      blob(x, rx * 1.65, 3.6, 3.3, 3.3, '#fffaf0', { seed: 341, lw: 1.2, n: 9 });
      paint(x, [[-rx - 2.4, -3.4], [rx + 2, -4.8], [rx + 2.4, -0.6], [-rx - 2.2, 0.8]], '#fffaf0', { seed: 342, lw: 1.2, wob: 0.3, shade: 0.35 });
      dot(x, rx * 0.5, -ry - 3.2, 0.1, '#fffaf0');
    },
  },
};

export const SPECS: Record<string, Spec> = { xiaomi, abao, niuniu, aunt, courier, afu, laozhou, xiaolan, adong, santa };
/** 在 data/npcs.json 里换名/别名时的映射（product 可以改 id，这里兜底） */
export const ALIAS: Record<string, string> = { postman: 'afu', baker: 'laozhou', painter: 'xiaolan', wheelchair: 'adong', delivery: 'courier' };
void ([] as Deco[]);
void mix; void rgba; void dot;
