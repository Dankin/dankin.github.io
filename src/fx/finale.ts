import Phaser from 'phaser';
import { bus } from '../core/bus';
import { toScreen, clamp, rand, lerp } from '../core/iso';
import { ART_SCALE, NATIVE_SCALE as NS } from '../art/scale';
import { entityPos, registerEntity, setFlag } from '../entities/registry';
import { registerEventFx } from './system';

/** ———— 终章演出特效：灯串逐段接通 / 帽子长出身体变圣诞老人 ———— */

const BULB = [0xffd27a, 0xff8aa8, 0x8ad1ff, 0xa8e88a, 0xffe9a8];

/**
 * 事件 'light:string' {from:[x,y]|id, to:[x,y]|id, s?:秒, z?:挂点高度px, n?:灯泡数}
 * 在两点之间挂一条下垂的灯串，灯泡从 from 到 to 依次亮起，之后持续闪烁（持久 ticker）。
 */
registerEventFx('light:string', ({ fx, scene, args }) => {
  const o = (args?.[0] ?? {}) as { from: any; to: any; s?: number; z?: number; n?: number };
  const pf = Array.isArray(o.from) ? { x: o.from[0], y: o.from[1] } : entityPos(o.from);
  const pt = Array.isArray(o.to) ? { x: o.to[0], y: o.to[1] } : entityPos(o.to);
  if (!pf || !pt) return;
  const a = toScreen(pf.x, pf.y), b = toScreen(pt.x, pt.y);
  const z = o.z ?? 62, n = o.n ?? Math.max(6, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 18));
  const dur = (o.s ?? 1.2) * 1000;
  const bulbs: { img: Phaser.GameObjects.Image; t0: number; ph: number }[] = [];
  const sag = Math.min(40, 14 + Math.hypot(b.x - a.x, b.y - a.y) * 0.12);
  const wire = fx.add(scene.add.graphics().setDepth(9000));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    pts.push({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) - z + Math.sin(k * Math.PI) * sag });
  }
  const t0 = fx.now;
  for (let i = 0; i <= n; i++) {
    const img = fx.add(scene.add.image(pts[i].x, pts[i].y + 3, 'p_glow').setTint(BULB[i % BULB.length]).setBlendMode(Phaser.BlendModes.ADD).setScale(0.001).setDepth(9050));
    bulbs.push({ img, t0: (i / n) * (dur / 1000), ph: rand(0, 6) });
  }
  let lit = 0;
  fx.addTicker((_dt, now) => {
    const el = now - t0;
    wire.clear().lineStyle(2, 0x3a2f30, 0.85);
    const upto = clamp(el / (dur / 1000), 0, 1) * n;
    wire.beginPath(); wire.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= Math.min(n, Math.ceil(upto)); i++) wire.lineTo(pts[i].x, pts[i].y);
    wire.strokePath();
    for (let i = 0; i < bulbs.length; i++) {
      const bl = bulbs[i];
      if (el < bl.t0) continue;
      if (i >= lit) { lit = i + 1; fx.sparkle(bl.img.x, bl.img.y); }
      const tw = 0.75 + 0.25 * Math.sin(now * 4 + bl.ph);
      bl.img.setScale(0.55 * NS * Math.min(1, (el - bl.t0) * 4 + 0.2)).setAlpha(tw);
    }
    return true;
  });
});

/**
 * 事件 'hat:morph' {to:'santa', s, at?}：帽子升到半空，下方长出身体（c_santa_0），帽子落到头顶，
 * 光芒爆发，帽子与身体合一。结束后：flag 'santa'=1，实体 'santa'（世界坐标），事件 'hat:morphed'。
 */
registerEventFx('hat:morph', ({ fx, host, scene, args }) => {
  const o = (args?.[0] ?? {}) as { to?: string; s?: number; at?: any };
  const hat = host.hat; if (!hat) return;
  const total = (o.s ?? 4) * 1000;
  const at = Array.isArray(o.at) ? { x: o.at[0], y: o.at[1] } : o.at ? entityPos(o.at) : undefined;
  if (at) hat.flyTo(at.x, at.y, 40);
  const key = scene.textures.exists('c_santa_0') ? 'c_santa_0' : scene.textures.exists('c_xiaomi_0') ? 'c_xiaomi_0' : undefined;
  const gx = () => hat.x, gy = () => hat.y;
  const g = toScreen(gx(), gy());
  const body = key ? fx.add(scene.add.image(g.x, g.y, key).setOrigin(0.5, 1).setScale(0, 0).setAlpha(0).setDepth(g.y)) : undefined;
  const sh = fx.add(scene.add.image(g.x, g.y - 2, 'p_shadow').setScale(0).setAlpha(0.4).setDepth(g.y - 1));
  fx.ring(g.x, g.y - 20, 0xffe08a, 3.2);
  scene.tweens.add({ targets: [], duration: 1, onComplete: () => {} });
  // 阶段 1：身体从地面“长”出来（弹性），帽子停在头的高度
  const head = 58;
  hat.flyTo(hat.x, hat.y, head + 18);
  const prog = { k: 0 };
  scene.tweens.add({
    targets: prog, k: 1, duration: total * 0.65, ease: 'Back.Out', delay: total * 0.15,
    onUpdate: () => {
      const s = toScreen(gx(), gy());
      if (body) { body.setPosition(s.x, s.y).setScale(ART_SCALE * (0.4 + prog.k * 0.6), ART_SCALE * prog.k).setAlpha(clamp(prog.k * 2, 0, 1)).setDepth(s.y); }
      sh.setPosition(s.x, s.y - 2).setScale(0.9 * NS * prog.k, 0.35 * NS * prog.k).setDepth(s.y - 1);
      if (Math.random() < 0.5) fx.sparkle(s.x + rand(-18, 18), s.y - rand(0, 54) * prog.k);
    },
    onComplete: () => {
      const s = toScreen(gx(), gy());
      fx.sparkleBurst(s.x, s.y - head, 26, 0xffe08a); fx.ring(s.x, s.y - head, 0xffffff, 5);
      host.shake(220, 0.004);
      hat.setStage(6);
      setFlag('santa', 1);
      registerEntity('santa', () => ({ x: gx(), y: gy() }));
      bus.emit('hat:morphed', { x: gx(), y: gy() });
    },
  });
  // 阶段 2：身体合一后帽子“戴上”并淡出，只留身体上的帽
  scene.tweens.add({
    targets: hat.spr, alpha: { from: 1, to: 0 }, delay: total * 0.85, duration: total * 0.15,
    onComplete: () => { hat.glow.setAlpha(0); },
  });
  // 身体持续跟随帽子（后续序列可以让它走：帽子是移动载体）
  fx.addTicker((_dt, now) => {
    if (!body) return false;
    const s = toScreen(gx(), gy());
    if (prog.k >= 1) body.setPosition(s.x, s.y).setDepth(s.y).setScale(ART_SCALE).setFlipX(Math.sin(now * 0.6) > 0.8);
    sh.setPosition(s.x, s.y - 2).setDepth(s.y - 1);
    return true;
  });
});

/** 事件 'fx:play' {id, at, args}：从序列里播放任意注册的 fx（无 prop，只有坐标） */
registerEventFx('fx:play', ({ fx, args }) => {
  const o = (args?.[0] ?? {}) as { id: string; at?: any };
  const p = Array.isArray(o.at) ? { x: o.at[0], y: o.at[1] } : o.at ? entityPos(o.at) : undefined;
  if (!p) { fx.play(o.id, undefined, undefined); return; }
  const s = toScreen(p.x, p.y);
  if (o.id === 'sparkle') fx.sparkleBurst(s.x, s.y - 20, 14);
  else if (o.id === 'hearts') fx.hearts(s.x, s.y - 40, 6);
  else if (o.id === 'notes') fx.notes(s.x, s.y - 40, 5);
  else if (o.id === 'confetti') fx.confetti(s.x, s.y - 50, 36);
  else if (o.id === 'snow_puff') fx.snowPuff(s.x, s.y - 20, 16);
  else if (o.id === 'ring') fx.ring(s.x, s.y - 10, 0xffe08a, 4);
  else fx.play(o.id, undefined, undefined);
});
