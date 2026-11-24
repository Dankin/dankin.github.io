// 输入与手感:摇树、音频解锁、手机摇一摇。
import { shake, type ShakeResult } from '../core/game.ts';
import { COMBO_TEXT, SHAKE_TEXT } from '../core/copy.ts';
import { attachMotion, enableMotion, motionSupported } from '../input/motion.ts';
import { $, $o } from './dom.ts';
import { bus } from '../core/bus.ts';
import { app } from './ctx.ts';
import { toast } from './toasts.ts';
import { bp, gp } from './dialogs.ts';
import { rollShake } from './sys.ts';

// ───────────── 手感:摇树 / 苹果噼里啪啦掉下来 ─────────────
let lastShakeText = 0;
let lastShakeSfx = 0;
let tapN = 0;
function onShakeResult(r: ShakeResult): void {
  if (!r.ok) return;
  const now = performance.now();
  if (r.combo > 0 && r.combo % 8 === 0) {
    app.orchard.burst(2 + Math.min(4, r.combo >> 3));
    app.audio.sfx.bonk();
    if (now - lastShakeText > 700) {
      lastShakeText = now;
      app.orchard.floatText(COMBO_TEXT[(r.combo >> 3) % COMBO_TEXT.length]);
    }
  } else if (++tapN % 17 === 0 && now - lastShakeText > 1200) {
    lastShakeText = now;
    app.orchard.floatText(SHAKE_TEXT[tapN % SHAKE_TEXT.length]);
  }
  if (now - lastShakeSfx >= 110) {
    lastShakeSfx = now;
    app.audio.sfx.shake();
  }
}
/** 摇一下树(点画布 / 空格 / 以后手机摇一摇都走这里) */
export function doShake(strength = 1): void {
  const r = shake(app.state);
  if (r.ok) {
    app.orchard.poke(Math.max(1, Math.round(1 + strength)));
    bus.emit({ t: 'shake', combo: r.combo, strength });
    rollShake(r);
  }
  onShakeResult(r);
}

// ───────────── 音频解锁:iOS 要在 pointerup/click 手势里 resume,一直试到 running 为止 ─────────────
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;
export function armAudioUnlock(): void {
  const onGesture = (): void => {
    app.audio.unlock();
    if (app.audio.isRunning()) disarm();
  };
  const arm = (): void => {
    for (const t of UNLOCK_EVENTS) addEventListener(t, onGesture, { capture: true, passive: true });
  };
  const disarm = (): void => {
    for (const t of UNLOCK_EVENTS) removeEventListener(t, onGesture, { capture: true });
  };
  arm();
  // 被系统挂起(来电、切后台)后回到前台:重新挂上
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !app.audio.isRunning()) {
      disarm();
      arm();
    }
  });
}

// ───────────── 手机摇一摇(默认关;独立于存档,存在 localStorage) ─────────────
const MOTION_KEY = 'shake-the-apple.motion';
let detachMotion: (() => void) | null = null;
const motionBtn = $o<HTMLButtonElement>('btnMotion');
function motionStored(): boolean {
  try {
    return localStorage.getItem(MOTION_KEY) === '1';
  } catch {
    return false;
  }
}
function motionStore(on: boolean): void {
  try {
    localStorage.setItem(MOTION_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}
function renderMotionBtn(): void {
  if (motionBtn) motionBtn.textContent = detachMotion ? '摇一摇:开' : '摇一摇:关';
}
function motionShake(strength: number): void {
  // 结局、设置、弹层打开时不响应
  if (document.getElementById('ending') || !$('settings').hidden || !bp.hidden || !gp.hidden) return;
  // 一次真实的摇动 ≈ 三下:按间隔摇,让令牌桶和音效都有喘息
  for (let i = 0; i < 3; i++) setTimeout(() => doShake(strength), i * 110);
}
function startMotion(): void {
  if (detachMotion) return;
  detachMotion = attachMotion(motionShake);
  renderMotionBtn();
}
function stopMotion(): void {
  detachMotion?.();
  detachMotion = null;
  renderMotionBtn();
}
async function turnMotionOn(): Promise<void> {
  const r = await enableMotion();
  if (r === 'on') {
    startMotion();
    motionStore(true);
  } else if (r === 'denied') {
    toast('没拿到传感器权限。iPhone:设置 → Safari → 动作与方向访问。', 5000);
  }
  renderMotionBtn();
}
export function setupMotion(): void {
  if (!motionBtn) return;
  if (!motionSupported()) {
    motionBtn.hidden = true;
    return;
  }
  motionBtn.hidden = false;
  renderMotionBtn();
  motionBtn.addEventListener('click', () => {
    if (detachMotion) {
      stopMotion();
      motionStore(false);
    } else void turnMotionOn();
  });
  // 之前开过:不需要权限弹窗的平台直接恢复;iOS 需要手势,等第一次点击时再请求
  if (motionStored()) {
    const needGesture = typeof (window as unknown as { DeviceMotionEvent?: { requestPermission?: unknown } }).DeviceMotionEvent?.requestPermission === 'function';
    if (!needGesture) startMotion();
    else {
      const once = (): void => {
        removeEventListener('pointerup', once, true);
        void enableMotion().then((r) => {
          if (r === 'on') startMotion();
        });
      };
      addEventListener('pointerup', once, true);
    }
  }
}
