/** 第二批角色（docs/08 新增）：豆豆 kevin q1 q2 吴大爷 邮局阿姨 秦阿婆；以及给老周/阿福/阿冬加的道具层 addProps */
import { Spec, G, Pt, blob, paint, limb, stroke, dot, dark, light, rgba, INK, hairCap } from './rig';

const INK_S = '#6b4535';

// ———————— 豆豆：5 岁，蓝雨衣，黄雨靴，什么都要问 为什么 ————————
const doudou: Spec = {
  id: 'doudou', frame: 'kid', kid: true,
  skin: '#f5cfae', hair: '#2e2420', top: '#4f86c6', pants: '#e8b52e', shoes: '#f2c232', accent: '#f2c232', sleeve: '#4f86c6', cheek: '#f08a78',
  rig: { headRx: 13.8, headRy: 12.8, headCy: 27.4, shY: 40.6, hipY: 52, upper: 4.8, fore: 4.6, limbW: 4.4, legW: 5.2 },
  deco: {
    neck: (g) => { const { x, cx, p } = g; blob(x, cx - 3.2 + p.sway, g.torsoTop + 0.6, 9.2, 3.8, dark('#4f86c6', 0.12), { seed: 301, lw: 1.2, n: 10 }); }, // 兜帽堆在后颈
    torso: (g) => { const { x, cx, p, hipY } = g; const sx = p.sway * 0.5; // 雨衣：纽扣、反光条、小口袋
      stroke(x, [[cx + 0.4 + sx, g.torsoTop + 1], [cx + 0.6 + sx * 0.5, hipY]], dark('#4f86c6', 0.35), 0.9);
      for (let i = 0; i < 3; i++) dot(x, cx + 2.2 + sx, g.torsoTop + 3.6 + i * 3.6, 0.95, '#f2c232', INK);
      stroke(x, [[cx - 7 + sx, hipY - 3.6], [cx + 7.4 + sx, hipY - 3.4]], '#f6f0c8', 1.3, { alpha: 0.9 });
    },
    hairFront: (g) => hairCap(g, '#2e2420', { vol: 1.5, fringe: 4.8, part: 2, seed: 305 } as never),
    faceDeco: (g) => { const { x, r } = g; // 门牙缺口般的小圆嘴边 + 好奇的大眼高光
      dot(x, 2.7 + 8.6, 6.2, 0.7, 'rgba(255,255,255,0.0)'); void r;
    },
    lowerFront: (g) => { // 黄雨靴：高筒
      for (const f of [g.footL, g.footR]) {
        const [fx, fy] = f;
        paint(g.x, [[fx - 3.2, fy - 6.4], [fx + 2.8, fy - 6.4], [fx + 3.2, fy - 0.5], [fx - 3.5, fy - 0.5]], '#f2c232', { seed: 306, lw: 1.1, wob: 0.15, hi: 0.5, t: 0.1 });
        blob(g.x, fx + 2.4, fy - 1, 3.2, 1.9, '#e8b21c', { seed: 307, lw: 1, n: 8 });
        stroke(g.x, [[fx - 3.2, fy - 6], [fx + 2.8, fy - 6]], '#d99a10', 0.9);
      }
    },
  },
};

// ———————— Kevin：咖啡车老板，鸭舌帽 + 咖啡色围裙，满脸胡茬，爱说英文 ————————
const kevin: Spec = {
  id: 'kevin', frame: 'adult',
  skin: '#f2d3b5', hair: '#6a4a30', top: '#f4efe6', pants: '#476a98', shoes: '#f3efe6', accent: '#6b4730', sleeve: '#f4efe6', cheek: '#e88a78',
  rig: { sw: 18.4, hw: 16.8, upper: 7.2, fore: 6.8 },
  deco: {
    torso: (g) => { const { x, cx, p, hipY } = g; const sx = p.sway * 0.6; // 围裙：胸兜 + 口袋 + 名牌
      paint(x, [[cx - 6.6 + sx, g.torsoTop + 2.6], [cx + 7.2 + sx, g.torsoTop + 2.6], [cx + 9 + sx * 0.6, hipY + 2.6], [cx - 9.2 + sx * 0.6, hipY + 2.6]], '#6b4730', { seed: 310, lw: 1.2, t: 0.16, shade: 0.4 });
      stroke(x, [[cx - 6.6 + sx, g.torsoTop + 2.8], [cx - 9.4 + sx, g.torsoTop]], '#6b4730', 1.2); stroke(x, [[cx + 7.2 + sx, g.torsoTop + 2.8], [cx + 9.6 + sx, g.torsoTop]], '#6b4730', 1.2);
      paint(x, [[cx - 4 + sx, hipY - 4], [cx + 4.4 + sx, hipY - 4], [cx + 4.6 + sx, hipY + 1], [cx - 4.2 + sx, hipY + 1]], '#8a6040', { seed: 311, lw: 0.9, wob: 0.15, shade: 0.3, t: 0.2 });
      paint(x, [[cx + 1 + sx, g.torsoTop + 5.2], [cx + 6 + sx, g.torsoTop + 5.2], [cx + 6 + sx, g.torsoTop + 7.6], [cx + 1 + sx, g.torsoTop + 7.6]], '#fff6e2', { seed: 312, lw: 0.7, wob: 0.1 }); // 名牌
      stroke(x, [[cx + 2 + sx, g.torsoTop + 6.4], [cx + 5 + sx, g.torsoTop + 6.4]], '#a07860', 0.6);
    },
    faceDeco: (g) => { const { x } = g; for (const [a, b] of [[-3, 7.6], [-0.6, 8.6], [2, 9], [4.6, 9], [7, 8.2], [8.8, 6.8], [-5, 6.6], [0.8, 7.2], [5.6, 7.8]]) dot(x, 2.7 + a, b, 0.42, 'rgba(90,60,40,0.75)'); }, // 胡茬
    hat: (g) => { // 鸭舌帽，帽檐朝前
      const { x, r } = g; const rx = r.headRx, ry = r.headRy;
      paint(x, [[-rx - 1, -0.4], [-rx - 0.6, -ry * 0.55], [-rx * 0.5, -ry - 3], [rx * 0.2, -ry - 4], [rx * 0.8, -ry - 2], [rx + 1.2, -ry * 0.3], [rx + 1.2, -1.2], [-rx * 0.1, -3.2]], '#2f3f5a', { seed: 315, lw: 1.35, hi: 0.6 });
      paint(x, [[rx - 1, -2.4], [rx + 8.8, -1.4], [rx + 8.2, 0.4], [rx - 1.4, -0.2]], '#222f45', { seed: 316, lw: 1.1, wob: 0.15, shade: 0.3 });
      dot(x, rx * 0.45, -ry - 0.4, 2, '#f0d6a0', INK); stroke(x, [[rx * 0.45 - 1, -ry - 0.4], [rx * 0.45 + 1, -ry - 0.4]], '#6b4730', 0.7); // 帽徽（咖啡豆）
    },
    hairFront: (g) => { const { x, r } = g; for (const sx of [-1, 1]) blob(x, sx * (r.headRx - 0.8), 1.4, 2.8, 4, '#6a4a30', { seed: 317 + sx, lw: 1, n: 8 }); },
  },
};

// ———————— q1：美妆博主，粉卫衣，波浪长发，永远拿着手机 ————————
const q1: Spec = {
  id: 'q1', frame: 'adult',
  skin: '#f8d8c0', hair: '#c98a46', top: '#f48fb1', pants: '#fbeaf0', shoes: '#fff5f8', accent: '#f48fb1', sleeve: '#f48fb1', lash: true, cheek: '#f27c98',
  rig: { legLen: 14.4, sw: 16.8, hw: 16.2, headRx: 12, headRy: 11.2 },
  deco: {
    hairBack: (g) => { const { x, r } = g; blob(x, 0, 5.4, r.headRx + 2.2, r.headRy + 6.4, '#c98a46', { seed: 321, lw: 1.3, n: 12 });
      for (const sx of [-1, 1]) blob(x, sx * (r.headRx + 0.6), r.headRy + 6.6, 3.6, 3, '#d49a56', { seed: 322 + sx, lw: 1.1, n: 8 }); },
    hairFront: (g) => { hairCap(g, '#c98a46', { vol: 1.2, fringe: 5, part: 3, sideL: 3.5, seed: 325 } as never);
      const { x, r } = g; // 粉色蝴蝶结
      const px = -r.headRx + 2, py = -r.headRy + 2.2;
      paint(x, [[px, py], [px - 4.4, py - 3.2], [px - 4.4, py + 2.6]], '#f2557f', { seed: 326, lw: 0.9, wob: 0.15 }); paint(x, [[px, py], [px + 4.2, py - 3.4], [px + 4.2, py + 2.6]], '#f2557f', { seed: 327, lw: 0.9, wob: 0.15 }); dot(x, px, py, 1.3, '#d03860', INK); },
    torso: (g) => { const { x, cx, p, hipY } = g; const sx = p.sway * 0.5; // 卫衣：爱心图案 + 抽绳
      stroke(x, [[cx - 2 + p.sway, g.torsoTop + 1.4], [cx - 2.4 + p.sway, g.torsoTop + 6.4]], '#fff5f8', 1); stroke(x, [[cx + 2 + p.sway, g.torsoTop + 1.4], [cx + 2.2 + p.sway, g.torsoTop + 5.6]], '#fff5f8', 1);
      const hx = cx + 0.4 + sx, hy = g.torsoTop + 10.6; paint(x, [[hx, hy + 3], [hx - 3.4, hy - 0.6], [hx - 1.8, hy - 2.8], [hx, hy - 1], [hx + 1.8, hy - 2.8], [hx + 3.4, hy - 0.6]], '#fff5f8', { seed: 330, lw: 0.7, wob: 0.1 }); void hipY;
    },
    held: (g) => { const { x } = g; const [hx, hy] = g.handR; // 手机 + 小闪光
      x.save(); x.translate(hx + 1.6, hy - 1.6); x.rotate(-0.25);
      paint(x, [[-2.6, -4.6], [2.6, -4.6], [2.6, 4.2], [-2.6, 4.2]], '#2c2c36', { seed: 331, lw: 1, wob: 0.1 });
      paint(x, [[-1.9, -3.8], [1.9, -3.8], [1.9, 3], [-1.9, 3]], '#aee0f2', { seed: 332, lw: 0.4, wob: 0.05, hi: 0.5 });
      x.restore(); },
  },
};

// ———————— q2：上班族，灰蓝西装，红领带，大耳机 ————————
const q2: Spec = {
  id: 'q2', frame: 'adult',
  skin: '#ebc29e', hair: '#1f1a1c', top: '#4d5a74', pants: '#2f3445', shoes: '#26211f', accent: '#c0463a', sleeve: '#4d5a74', cheek: '#e08a70',
  rig: { sw: 18.4, hw: 15.6, upper: 7.2, fore: 6.8 },
  deco: {
    torso: (g) => { const { x, cx, p, hipY } = g; const sx = p.sway * 0.6; // 衬衫领口 + 领带 + 工牌
      paint(x, [[cx - 4 + sx, g.torsoTop + 0.8], [cx + 4.4 + sx, g.torsoTop + 0.8], [cx + 0.2 + sx, hipY - 2]], '#f5f2ea', { seed: 340, lw: 1, wob: 0.1, t: 0.15 });
      paint(x, [[cx - 0.4 + sx, g.torsoTop + 2.2], [cx + 1.8 + sx, g.torsoTop + 2.2], [cx + 2.4 + sx, hipY - 6], [cx + 0.6 + sx, hipY - 3.4], [cx - 1.2 + sx, hipY - 6]], '#c0463a', { seed: 341, lw: 0.9, wob: 0.1, t: 0.2 });
      stroke(x, [[cx - 7 + sx, g.torsoTop + 1], [cx - 1 + sx, g.torsoTop + 10]], dark('#4d5a74', 0.4), 0.9); stroke(x, [[cx + 7.6 + sx, g.torsoTop + 1], [cx + 2 + sx, g.torsoTop + 10]], dark('#4d5a74', 0.4), 0.9);
      paint(x, [[cx + 3 + sx, g.torsoTop + 8], [cx + 7 + sx, g.torsoTop + 8], [cx + 7 + sx, g.torsoTop + 13], [cx + 3 + sx, g.torsoTop + 13]], '#e9f2fa', { seed: 342, lw: 0.8, wob: 0.1 }); },
    faceDeco: (g) => { const { x } = g; for (const sx of [-1, 1]) stroke(x, [[2.7 + sx * 4.2 - 2, 5], [2.7 + sx * 4.2, 5.5], [2.7 + sx * 4.2 + 2, 5]], '#a8786a', 0.8, { alpha: 0.6 }); }, // 黑眼圈
    hairFront: (g) => hairCap(g, '#1f1a1c', { vol: 1.2, fringe: 3, part: -1, seed: 345 } as never),
    hat: (g) => { const { x, r } = g; const rx = r.headRx, ry = r.headRy; // 耳机：头梁 + 两个大耳罩
      stroke(x, [[-rx - 0.6, 1.4], [-rx * 0.8, -ry - 2.2], [0, -ry - 4.4], [rx * 0.8, -ry - 2.2], [rx + 0.6, 1.4]], '#2e3b3a', 2.2);
      stroke(x, [[-rx - 0.6, 1.4], [-rx * 0.8, -ry - 2.2], [0, -ry - 4.4], [rx * 0.8, -ry - 2.2], [rx + 0.6, 1.4]], '#59b7a8', 1.2);
      for (const sx of [-1, 1]) { blob(x, sx * (rx + 1), 2.4, 3.2, 4.6, '#59b7a8', { seed: 346 + sx, lw: 1.2, n: 9 }); blob(x, sx * (rx + 1), 2.4, 1.5, 2.6, dark('#59b7a8', 0.25), { seed: 348 + sx, lw: 0.7, n: 7 }); } },
  },
};

// ———————— 吴大爷：花白稀发、灰白胡渣、酱红棉马甲、拐杖 ————————
const unclewu: Spec = {
  id: 'uncle_wu', frame: 'adult',
  skin: '#e4b996', hair: '#dcd7cd', top: '#cdb98f', pants: '#47463f', shoes: '#2a2623', accent: '#8e3a30', sleeve: '#cdb98f', cheek: '#dc8a70',
  rig: { legLen: 12.4, hipY: 56.6, shY: 40.4, headCy: 27.4, sw: 18, hw: 18, belly: 1.4, upper: 6.6, fore: 6.2, limbW: 5, legW: 5.6, headRx: 12.4, headRy: 11.2 },
  deco: {
    torso: (g) => { const { x, cx, p, hipY } = g; const sx = p.sway * 0.5; // 酱红棉马甲 + 盘扣
      paint(x, [[cx - 6.6 + sx, g.torsoTop + 1.2], [cx - 1 + sx, g.torsoTop + 1.2], [cx - 0.4 + sx, hipY + 1], [cx - 8.6 + sx * 0.6, hipY + 1]], '#8e3a30', { seed: 350, lw: 1.1, t: 0.15, shade: 0.4 });
      paint(x, [[cx + 1.4 + sx, g.torsoTop + 1.2], [cx + 7.6 + sx, g.torsoTop + 1.2], [cx + 9.6 + sx * 0.6, hipY + 1], [cx + 1 + sx, hipY + 1]], '#8e3a30', { seed: 351, lw: 1.1, t: 0.15, shade: 0.4 });
      for (let i = 0; i < 4; i++) stroke(g.x, [[cx - 6 + sx, g.torsoTop + 5 + i * 3.6], [cx - 1 + sx, g.torsoTop + 5.4 + i * 3.6]], dark('#8e3a30', 0.3), 0.8, { alpha: 0.7 });
      for (let i = 0; i < 3; i++) dot(x, cx + 0.2 + sx, g.torsoTop + 3.6 + i * 4, 0.9, '#d8c078', INK); },
    hairBack: (g) => { const { x, r } = g; for (const sx of [-1, 1]) blob(x, sx * (r.headRx - 0.2), 0.2, 3.2, 5.4, '#dcd7cd', { seed: 355 + sx, lw: 1.1, n: 8 }); },
    faceDeco: (g) => { const { x } = g; // 粗白眉、皱纹、花白胡渣
      for (const sx of [-1, 1]) blob(x, 2.7 + sx * 4.2, -3.2, 3.4, 1.3, '#efece4', { seed: 357 + sx, lw: 0.7, n: 7, rot: sx * -0.2 });
      stroke(x, [[2.7 + 5.6, 4.2], [2.7 + 7.2, 4.8]], '#a87b60', 0.6, { alpha: 0.7 }); stroke(x, [[2.7 - 5.6, 3.4], [2.7 - 3.4, 4.2]], '#a87b60', 0.6, { alpha: 0.6 });
      for (const [a, b] of [[-3, 7.8], [0, 8.8], [3, 9], [6, 8.2], [8.4, 6.6], [-5.4, 6.6]]) dot(x, 2.7 + a, b, 0.4, 'rgba(210,205,196,0.9)'); },
    held: (g) => { const { x, r } = g; const [hx, hy] = g.handR; // 拐杖（弯柄）
      stroke(x, [[hx + 1.2, hy + 1], [hx + 1.4, r.ground - 0.6]], '#7a5030', 1.8);
      stroke(x, [[hx + 1.2, hy + 1], [hx + 0.6, hy - 1.6], [hx - 1.6, hy - 2.2], [hx - 2.6, hy - 0.6]], '#7a5030', 1.8);
      dot(x, hx + 1.4, r.ground - 0.4, 1.1, '#2a2623'); },
  },
};

// ———————— 邮局阿姨：浅绿马甲、蓝色套袖、红框眼镜、短发 ————————
const postaunt: Spec = {
  id: 'post_aunt', frame: 'adult',
  skin: '#f1cdaa', hair: '#2c2626', top: '#eef2e8', pants: '#3d4a52', shoes: '#33302c', accent: '#2f7a58', sleeve: '#6a8fc4', cheek: '#ec8e7c', lash: true,
  rig: { sw: 18, hw: 17.4, belly: 0.8, headRx: 12.2 },
  deco: {
    torso: (g) => { const { x, cx, p, hipY } = g; const sx = p.sway * 0.6; // 邮政绿马甲 + 黄色“邮”徽
      paint(x, [[cx - 8 + sx, g.torsoTop + 0.8], [cx + 8.4 + sx, g.torsoTop + 0.8], [cx + 9.2 + sx * 0.6, hipY + 1], [cx - 9.2 + sx * 0.6, hipY + 1]], '#5da384', { seed: 360, lw: 1.2, t: 0.16, shade: 0.4 });
      stroke(x, [[cx + 0.4 + sx, g.torsoTop + 1], [cx + 0.4 + sx * 0.5, hipY]], dark('#5da384', 0.4), 0.9);
      dot(x, cx - 4 + sx, g.torsoTop + 5.4, 2, '#f0c93a', INK); stroke(x, [[cx - 5 + sx, g.torsoTop + 5.4], [cx - 3 + sx, g.torsoTop + 5.4]], INK_S, 0.6);
      paint(x, [[cx + 2 + sx, hipY - 5], [cx + 7 + sx, hipY - 5], [cx + 7 + sx, hipY - 0.6], [cx + 2 + sx, hipY - 0.6]], dark('#5da384', 0.15), { seed: 361, lw: 0.8, wob: 0.1 }); },
    hairBack: (g) => { const { x, r } = g; blob(x, 0, 3.2, r.headRx + 1.2, r.headRy + 2.2, '#2c2626', { seed: 362, lw: 1.2, n: 11 }); },
    hairFront: (g) => hairCap(g, '#2c2626', { vol: 1, fringe: 4.6, part: 1, sideL: 3, sideR: 3, seed: 363 } as never),
    faceDeco: (g) => { const { x } = g; const fo = 2.7, ex = 4.2, ey = 1.6; // 红框方眼镜 + 链子
      x.save(); x.strokeStyle = '#c0392b'; x.lineWidth = 1; x.fillStyle = 'rgba(210,235,255,0.2)';
      for (const sx of [-1, 1]) { x.beginPath(); x.rect(fo + sx * ex - 3.3, ey - 2.8, 6.6, 5.4); x.fill(); x.stroke(); }
      x.restore(); stroke(x, [[fo - ex + 3.3, ey - 1], [fo + ex - 3.3, ey - 1]], '#c0392b', 0.9); },
    held: (g) => { const { x } = g; const [hx, hy] = g.handR; // 邮戳
      blob(x, hx + 1.4, hy - 1.4, 2.6, 1.6, '#c0392b', { seed: 365, lw: 0.9, n: 8 }); paint(x, [[hx - 0.2, hy - 2.6], [hx + 3, hy - 2.6], [hx + 3, hy - 5.6], [hx - 0.2, hy - 5.6]], '#6a4a32', { seed: 366, lw: 0.9, wob: 0.1 }); },
  },
};

// ———————— 秦阿婆：白发盘髻、碎花袄、紫披肩、爱八卦 ————————
const grannyqin: Spec = {
  id: 'granny_qin', frame: 'adult',
  skin: '#ecc7a5', hair: '#e8e2d8', top: '#d2849a', pants: '#6a5a6a', shoes: '#7a4a3a', accent: '#8a6fa0', sleeve: '#d2849a', cheek: '#ec8a86',
  rig: { legLen: 12, hipY: 57, shY: 41, headCy: 27.4, sw: 18.8, hw: 19, belly: 2.2, upper: 6.4, fore: 6, headRx: 12.4, headRy: 11.2, limbW: 5, legW: 5.6 },
  deco: {
    torso: (g) => { const { x, cx, p } = g; const sx = p.sway * 0.5; // 碎花
      for (const [a, b, c] of [[-5, 6, '#fff0c8'], [3, 9, '#fff0c8'], [-1, 14, '#fff0c8'], [6, 15, '#fff0c8'], [-6, 15, '#fff0c8'], [1, 4, '#fff0c8']] as [number, number, string][]) { dot(x, cx + a + sx, g.torsoTop + b, 1, c); dot(x, cx + a + sx, g.torsoTop + b, 0.4, '#e29a3a'); } },
    neckFront: (g) => { const { x, cx, p } = g; const sx = p.sway * 0.8; // 紫披肩 + 流苏
      paint(x, [[cx - 9.8 + sx, g.torsoTop - 0.6], [cx + 10.4 + sx, g.torsoTop - 0.6], [cx + 8 + sx, g.torsoTop + 7], [cx + 0.4 + sx, g.torsoTop + 11], [cx - 7.6 + sx, g.torsoTop + 7]], '#8a6fa0', { seed: 370, lw: 1.2, t: 0.16, shade: 0.4 });
      for (let i = 0; i < 6; i++) stroke(x, [[cx - 6.8 + sx + i * 2.7, g.torsoTop + 7.6 + (i === 2 || i === 3 ? 2.6 : 0)], [cx - 6.8 + sx + i * 2.7, g.torsoTop + 9.6 + (i === 2 || i === 3 ? 2.6 : 0)]], '#6a5282', 0.8); },
    hairBack: (g) => { const { x, r } = g; blob(x, -1.2, -r.headRy - 3.4, 6.4, 5.4, '#e8e2d8', { seed: 372, lw: 1.2, n: 10 }); stroke(x, [[-4, -r.headRy - 3], [1.6, -r.headRy - 4.6]], '#b8aea0', 0.7); },
    hairFront: (g) => { hairCap(g, '#e8e2d8', { vol: 0.8, fringe: 3, part: -1, sideL: 3, seed: 373 } as never); const { x, r } = g; stroke(x, [[-2, -r.headRy - 4], [3, -r.headRy - 1.4]], '#c0392b', 1.2); dot(x, 3.4, -r.headRy - 1.2, 1.1, '#c0392b', INK); }, // 红发簪
    faceDeco: (g) => { const { x } = g; stroke(x, [[2.7 + 6.6, 3.6], [2.7 + 8, 4.4]], '#b88a70', 0.6, { alpha: 0.7 }); stroke(x, [[2.7 - 6.4, 3.4], [2.7 - 4.8, 4.2]], '#b88a70', 0.6, { alpha: 0.6 });
      for (const sx of [-1, 1]) blob(x, 2.7 + sx * 4.2, -3.6, 3, 0.9, '#f2eee6', { seed: 375 + sx, lw: 0.6, n: 7, rot: sx * -0.15 }); },
  },
};

export const SPECS2: Record<string, Spec> = { doudou, kevin, q1, q2, uncle_wu: unclewu, post_aunt: postaunt, granny_qin: grannyqin };

// ———————— 道具层（由 pose.prop 触发）：letter 信 / dough 面团+案板 / stool 凳子 / gulp 无 ————————
const isP = (g: G, k: string) => (g.p.prop ?? '') === k || (g.p.prop ?? '').split(',').includes(k);
export function addProps(s: Spec): Spec {
  const oh = s.deco.held, ob = s.deco.behind, olf = s.deco.lowerFront;
  const deco = { ...s.deco };
  deco.behind = (g: G) => {
    ob?.(g);
    if (isP(g, 'stool')) { const { x, cx, r } = g; const y = r.ground - 11; // 小板凳
      paint(x, [[cx - 12, y], [cx + 3, y], [cx + 3, y + 2.6], [cx - 12, y + 2.6]], '#a87a4a', { seed: 400, lw: 1.1, wob: 0.1, hi: 0.4 });
      stroke(x, [[cx - 10.6, y + 2.6], [cx - 11.4, r.ground - 0.4]], '#7a5230', 1.6); stroke(x, [[cx + 1.6, y + 2.6], [cx + 2.4, r.ground - 0.4]], '#7a5230', 1.6); }
  };
  deco.held = (g: G) => {
    oh?.(g);
    const { x } = g;
    if (isP(g, 'letter')) { const [hx, hy] = g.handR; x.save(); x.translate(hx + 2.4, hy - 2.4); x.rotate(-0.2);
      paint(x, [[-5.4, -3.6], [5.6, -3.8], [5.8, 3.8], [-5.6, 4]], '#fff8e4', { seed: 401, lw: 1, wob: 0.15, hi: 0.4, t: 0.1 });
      stroke(x, [[-5.2, -3.4], [0.2, 0.8], [5.4, -3.6]], '#8a6a52', 0.8); dot(x, 0.4, 1.4, 1.2, '#d8433a', INK); x.restore(); }
    if (isP(g, 'dough')) { const [hx, hy] = g.handR; // 面团，随手按压起伏
      const sq = 1 + Math.sin(g.p.bob * 2) * 0.1;
      blob(x, hx + 1, hy + 1.6, 7.4, 3.6 * sq, '#f6ecd2', { seed: 402, lw: 1.1, n: 11, hi: 0.5 });
      for (const q of [[-3, 0], [1, 1.2], [4, -0.2]]) dot(x, hx + 1 + q[0], hy + 1 + q[1], 0.5, 'rgba(255,255,255,0.9)');
      for (const q of [[6, -4], [8, -6], [3, -7]]) dot(x, hx + q[0], hy + q[1], 0.7, 'rgba(255,255,255,0.7)'); } // 面粉飞起
  };
  deco.lowerFront = (g: G) => {
    olf?.(g);
    if (isP(g, 'dough')) { const { x, cx, r } = g; const top = g.handR[1] + 3.6; // 案板：挡住下半身
      paint(x, [[cx - 11, top], [cx + 23.5, top], [cx + 23.5, top + 3], [cx - 11, top + 3]], '#c79a62', { seed: 403, lw: 1.2, wob: 0.1, hi: 0.5 });
      paint(x, [[cx - 9, top + 3], [cx + 22, top + 3], [cx + 22, r.ground + 0.2], [cx - 9, r.ground + 0.2]], '#9a6e40', { seed: 404, lw: 1.2, wob: 0.1, shade: 0.4 });
      stroke(x, [[cx + 6, top + 6], [cx + 6, r.ground - 3]], '#7a5230', 0.8, { alpha: 0.6 }); }
  };
  return { ...s, deco };
}
void light; void rgba; void limb; type _P = Pt;
