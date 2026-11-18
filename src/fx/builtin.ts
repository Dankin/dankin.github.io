import Phaser from 'phaser';
import { t } from '../core/data';
import { clamp, pick } from '../core/iso';
import { ART_SCALE, NATIVE_SCALE as NS } from '../art/scale';
import { registerEventFx, registerFx, registerRig } from './system';
import type { FxProp } from './types';
import { getFlag } from '../entities/registry';
import './finale';

/** ———— 招式特效（从 Game.playFx 迁移） ———— */
registerFx('chime', ({ fx, prop, scene, top }) => {
  if (prop?.tubes) scene.tweens.add({ targets: prop.tubes, rotation: { from: 0.45, to: 0 }, duration: 1800, ease: 'Elastic.Out' });
  fx.notes(top.x, top.y + 20, 3);
});

registerFx('balloon', ({ fx, prop, stim }) => {
  if (!prop || !stim) return;
  fx.bindToStim(stim, [0, 1, 2, 3, 4].map((i) => 'p_balloon_' + i), [[-14, 0], [0, -16], [14, -4], [-5, -28], [9, -34]], ART_SCALE);
});

registerFx('shock', ({ fx, host, prop, stim, top }) => {
  const big = (stim?.intensity ?? 0) >= 1;
  const h = prop?.top ?? 40;
  fx.ring(top.x, top.y + h * 0.4, 0xffffff, big ? 4.5 : 3);
  if (big) fx.ring(top.x, top.y + h * 0.4, 0xffd27a, 6);
  host.shake(big ? 260 : 140, big ? 0.006 : 0.003);
  fx.floatText(top.x, top.y, big ? '嗡——！！' : '啪！', big ? 30 : 24);
});

registerFx('notes', ({ fx, top }) => fx.notes(top.x, top.y + 10, 5));

registerFx('lamp', ({ fx, prop, top }) => { if (prop) prop.pulse = 1; fx.sparkleBurst(top.x, top.y + 14, 8, 0xffd27a); });

registerFx('pose', ({ fx, prop, top }) => {
  if (!prop) return;
  prop.pose = (prop.pose + 1) % 3; prop.spr.setTexture('p_snowman_' + prop.pose);
  fx.sparkleBurst(top.x, top.y + 20, 8, 0xffffff); fx.hearts(top.x, top.y + 10, 1);
});

registerFx('tree', ({ fx, top }) => fx.sparkleBurst(top.x, top.y + 40, 14, 0xff9ab0));

registerFx('letter', ({ fx, host, scene, prop, top }) => {
  if (!prop) return;
  const o = fx.add(scene.add.image(prop.sx - 6, prop.sy - prop.top - 50, 'p_envelope').setScale(ART_SCALE).setDepth(prop.sy + 2).setAngle(-20));
  scene.tweens.add({ targets: o, y: prop.sy - prop.top * 0.55, angle: 8, duration: 700, ease: 'Quad.In' });
  scene.tweens.add({ targets: o, alpha: 0, delay: 650, duration: 200, onComplete: () => o.destroy() });
  scene.time.delayedCall(700, () => fx.sparkleBurst(prop.sx, prop.sy - prop.top * 0.55, 8, 0xfff0b0));
  host.bubble('mail', () => top, t('letter.say'), 2.4);
});

/** ———— 事件特效（从 Game.wireEvents 迁移；checklist 勾选见 checklist.json 的 on 字段，由 FxSystem.wire 自动接线） ———— */
registerEventFx('tree_lit', ({ host }) => {
  const p = host.props.tree; if (!p) return;
  p.data = p.data ?? {}; p.data.flash = 7; p.uses++;
  const anchor = () => ({ x: p.sx, y: p.sy - p.top });
  if (p.uses === 5) host.bubble('tree', anchor, (t('tree.egg') as unknown as string[])[0] ?? '', 3);
  if (p.uses === 10) host.bubble('tree', anchor, (t('tree.egg') as unknown as string[])[1] ?? '', 3.5);
});

registerEventFx('letter_sent', ({ host, scene }) => {
  const items = t('letter.items') as unknown as string[] | string;
  const text = Array.isArray(items) ? pick(items) : items;
  scene.time.delayedCall(900, () => host.toast(text, 5));
});

registerEventFx('snowman_pose', ({ host, fx, scene }) => {
  scene.time.delayedCall(4200, () => {
    const p = host.props.snowman; if (!p) return;
    if (host.crowdNear(p.x, p.y, 3) >= 2) {
      for (const n of host.crowdMembers(p.x, p.y, 3)) fx.hearts(n.sx, n.sy - 46, 2);
      host.completeCheck('snowman_party');
    }
  });
});

/** ———— 物件 rig ———— */
registerRig('windchime', {
  setup(p: FxProp, fx) {
    p.tubes = fx.scene.add.image(p.sx, p.sy - 14, 'p_chime_tubes').setOrigin(0.5, 0).setScale(ART_SCALE).setDepth(p.sy + 1);
    p.tubes.y = p.sy - p.top + 30; fx.add(p.tubes);
  },
});

registerRig('lamp', {
  setup(p, fx) {
    p.lamp = fx.scene.add.image(p.sx, p.sy - p.top + 10, 'p_glow').setScale(1.3 * NS).setTint(0xffd27a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(9100);
    fx.add(p.lamp);
  },
  tick(p, dt, fx, glow = 0) {
    if (!p.lamp) return;
    p.pulse = Math.max(0, p.pulse - dt / 2.2);
    const lit = getFlag('lit:' + p.id) ? 1 : 0; // 终章/故事点亮的灯：白天也亮
    p.lamp.setAlpha(clamp(Math.max(glow * 0.8, lit * 0.95) + p.pulse, 0, 1) * (0.9 + 0.1 * Math.sin(fx.now * 5 + p.x)));
  },
});

registerRig('tree', {
  setup(p, fx) {
    p.lights = fx.scene.add.image(p.sx, p.sy + 2, 'p_tree_lights').setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(p.sy + 1).setAlpha(0);
    fx.add(p.lights);
  },
  tick(p, dt, fx, glow = 0) {
    if (!p.lights) return;
    const d = (p.data = p.data ?? {});
    d.flash = Math.max(0, (d.flash ?? 0) - dt);
    let a = glow * 0.65;
    if (d.flash > 0) a = Math.max(a, 0.8 + 0.2 * Math.sin(fx.now * 18));
    p.lights.setAlpha(clamp(a, 0, 1));
  },
});

// E18：moves.json 的 fx id
registerFx('confetti', ({ fx, top }) => fx.confetti(top.x, top.y + 10, 30));
registerFx('snow_puff', ({ fx, top }) => fx.snowPuff(top.x, top.y + 20, 14));
registerFx('sparkle', ({ fx, top }) => fx.sparkleBurst(top.x, top.y + 14, 12));
registerFx('hearts', ({ fx, top }) => fx.hearts(top.x, top.y + 6, 5));
