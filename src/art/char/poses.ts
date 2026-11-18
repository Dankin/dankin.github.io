/** 姿势库：所有角色共用的帧表。键名即纹理后缀：`c_<id>_<key>` */
import { Pose, pose } from './rig';

export const POSE_KEYS = [
  '0', '1',
  'idle_0', 'idle_1',
  'walk_0', 'walk_1', 'walk_2', 'walk_3',
  'emo_happy', 'emo_scared', 'emo_surprised', 'emo_listen',
  'emo_sing_0', 'emo_sing_1', 'emo_dance_0', 'emo_dance_1',
  'emo_annoyed', 'emo_wave_0', 'emo_wave_1',
] as const;
export type PoseKey = (typeof POSE_KEYS)[number];

/** 只给特定角色烧的额外帧（键后缀）。要加新角色/姿态在这里登记，chars.ts 会自动多画这些帧 */
export const EXTRA_KEYS: Record<string, string[]> = {
  laozhou: ['emo_bake_0', 'emo_bake_1', 'emo_sit'],
  afu: ['emo_gulp', 'emo_letter'],
  adong: ['emo_push_0', 'emo_push_1', 'emo_cheer', 'emo_letter'],
};

const UP = 2.55;  // 手臂举过头的角度

export function poseOf(key: string, kid: boolean): Pose {
  const S = kid ? 2.5 : 3.1;
  const walk = (k: number): Pose => {
    const L = [S, 0, -S, 0][k], R = -L;
    const liftL = [0, 0, 0, 2.6][k], liftR = [0, 2.6, 0, 0][k];
    const sw = [0.55, 0.08, -0.55, -0.08][k]; // 前臂（画面右侧）摆幅，后臂反向
    const bob = [0.9, -0.5, 0.9, -0.5][k];
    return pose({
      bob, sway: [0.3, 0, -0.3, 0][k] * 0.8,
      footL: { dx: L, lift: liftL }, footR: { dx: R, lift: liftR },
      kneeL: liftL > 0 ? 1.4 : 0.5, kneeR: liftR > 0 ? 1.4 : 0.5,
      armL: { a: -sw, b: -sw + (sw < 0 ? 0 : 0.0) - 0.05 }, armR: { a: sw, b: sw + (sw > 0.3 ? 0.55 : 0.1) },
      tilt: [0.03, 0, -0.03, 0][k], eyes: 'open', mouth: 'smile',
      wheel: k * 0.9,
    });
  };
  switch (key) {
    case '0': return pose();
    case '1': return walk(0);
    case 'idle_0': return pose();
    case 'idle_1': return pose({ squash: 1.04, headDy: -0.5, armL: { a: 0.14, b: 0.06 }, armR: { a: -0.16, b: -0.06 }, bob: -0.2, mouth: 'smile' });
    case 'walk_0': return walk(0);
    case 'walk_1': return walk(1);
    case 'walk_2': return walk(2);
    case 'walk_3': return walk(3);
    case 'emo_happy': return pose({
      bob: -2, footL: { dx: -1.8, lift: 1.6 }, footR: { dx: 1.8, lift: 1.6 }, kneeL: 1, kneeR: 1,
      armL: { a: -2.1, b: -2.5 }, armR: { a: 2.1, b: 2.5 }, eyes: 'happy', mouth: 'grin', brows: 'happy', blush: 1, tilt: 0.04, sparkle: true,
    });
    case 'emo_scared': return pose({
      bob: 1.4, sway: -0.9, headDy: 0.9, headDx: -0.6, tilt: -0.06,
      footL: { dx: 0.2, lift: 0 }, footR: { dx: 0.2, lift: 0 }, kneeL: 1.6, kneeR: 1.6,
      armL: { a: 0.6, b: 2.55 }, armR: { a: -0.6, b: -2.55 }, eyes: 'wide', mouth: 'tiny', brows: 'worry', blush: 0.1, sweat: true,
    });
    case 'emo_surprised': return pose({
      bob: -2.6, footL: { dx: -1.4, lift: 1.8 }, footR: { dx: 1.4, lift: 1.8 }, kneeL: 1.2, kneeR: 1.2,
      armL: { a: -1.75, b: -2.05 }, armR: { a: 1.75, b: 2.05 }, eyes: 'wide', mouth: 'o', brows: 'up', blush: 0.2, headDy: -0.8,
    });
    case 'emo_listen': return pose({
      tilt: 0.13, headDx: 0.6, sway: 0.4,
      armL: { a: -1.05, b: -2.85 }, armR: { a: -0.12, b: -0.05 }, eyes: 'open', mouth: 'smile', brows: 'up', blush: 0.7,
    });
    case 'emo_sing_0': return pose({
      headDy: -0.5, tilt: -0.05, sway: -0.2, armL: { a: 0.55, b: 2.45 }, armR: { a: -0.55, b: -2.45 },
      eyes: 'happy', mouth: 'sing', brows: 'happy', blush: 0.9, squash: 1.03,
    });
    case 'emo_sing_1': return pose({
      headDy: -0.8, tilt: 0.07, sway: 0.4, armL: { a: 0.7, b: 2.6 }, armR: { a: -0.7, b: -2.6 },
      eyes: 'happy', mouth: 'sing2', brows: 'happy', blush: 0.9, squash: 1.05, footL: { dx: -1.2, lift: 0 }, footR: { dx: 1.2, lift: 0 },
    });
    case 'emo_dance_0': return pose({
      bob: -1, sway: -0.9, tilt: -0.1, footL: { dx: -2.4, lift: 3 }, footR: { dx: 1.6, lift: 0 }, kneeL: 1.6,
      armL: { a: -UP, b: -2.85 }, armR: { a: 1.0, b: 0.7 }, eyes: 'happy', mouth: 'grin', brows: 'happy', blush: 1, chairTilt: -0.12, prop: 'fan',
    });
    case 'emo_dance_1': return pose({
      bob: -1.4, sway: 0.9, tilt: 0.1, footR: { dx: 2.4, lift: 3 }, footL: { dx: -1.6, lift: 0 }, kneeR: 1.6,
      armR: { a: UP, b: 2.85 }, armL: { a: -1.0, b: -0.7 }, eyes: 'happy', mouth: 'laugh', brows: 'happy', blush: 1, chairTilt: 0.0, prop: 'fan',
    });
    case 'emo_annoyed': return pose({
      eyes: 'half', mouth: 'flat', brows: 'angry', blush: 0, headDy: 0.3,
      armL: { a: -0.95, b: 0.75 }, armR: { a: 0.95, b: -0.75 },
    });
    case 'emo_wave_0': return pose({ armR: { a: 2.25, b: 2.75 }, eyes: 'happy', mouth: 'smile', brows: 'happy', tilt: 0.04, blush: 0.8 });
    case 'emo_wave_1': return pose({ armR: { a: 2.55, b: 2.2 }, eyes: 'happy', mouth: 'grin', brows: 'happy', tilt: -0.02, blush: 0.8 });
    // —— 额外帧 ——
    case 'emo_bake_0': return pose({ prop: 'dough', bob: 0.6, headDy: 0.8, tilt: 0.05, armL: { a: 0.35, b: 0.8 }, armR: { a: 0.6, b: 1.0 }, eyes: 'open', mouth: 'smile', brows: 'n', blush: 0.6 });
    case 'emo_bake_1': return pose({ prop: 'dough', bob: 1.6, headDy: 1.2, tilt: 0.07, armL: { a: 0.4, b: 0.6 }, armR: { a: 0.7, b: 0.8 }, eyes: 'happy', mouth: 'smile', brows: 'n', blush: 0.7 });
    case 'emo_sit': return pose({ prop: 'stool', bob: 7, sway: -0.3, tilt: 0.03, footL: { dx: 5, lift: 0 }, footR: { dx: 7.5, lift: 0 }, kneeL: 2.2, kneeR: 2.2, armL: { a: 0.3, b: 0.25 }, armR: { a: -0.3, b: 0.9 }, eyes: 'half', mouth: 'flat', brows: 'worry', blush: 0.2, headDy: 0.8 });
    case 'emo_gulp': return pose({ squash: 1.07, bob: -0.6, headDy: -0.7, armL: { a: -0.8, b: -1.1 }, armR: { a: 0.8, b: 1.1 }, eyes: 'closed', mouth: 'o', brows: 'worry', blush: 0.2, sweat: true });
    case 'emo_letter': return pose({ prop: 'letter', armR: { a: 1.15, b: 1.75 }, armL: { a: -0.1, b: -0.05 }, eyes: 'open', mouth: 'smile', brows: 'up', blush: 0.6, tilt: 0.04 });
    case 'emo_push_0': return pose({ wheel: 0.4, bob: -0.2, tilt: 0.09, eyes: 'open', mouth: 'grin', brows: 'angry', blush: 0.5, chairTilt: 0.03 });
    case 'emo_push_1': return pose({ wheel: 1.9, bob: 0.4, tilt: 0.1, eyes: 'open', mouth: 'grin', brows: 'angry', blush: 0.5, chairTilt: 0.05 });
    case 'emo_cheer': return pose({ bob: -1.4, armL: { a: -UP, b: -2.7 }, armR: { a: UP, b: 2.7 }, eyes: 'happy', mouth: 'laugh', brows: 'happy', blush: 1, sparkle: true, chairTilt: -0.14, wheel: 0.9 });
  }
  return pose();
}
