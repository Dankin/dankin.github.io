/**
 * 手机摇一摇(DeviceMotion)。
 * - createShakeDetector():纯函数式 feed(),不碰 DOM,可单测。
 * - enableMotion():请求权限(iOS 13+ 必须在手势内调用)。
 * - attachMotion():监听 devicemotion,只在页面可见时挂着,返回 detach。
 * 桌面鼠标甩动不触发(没有 devicemotion 事件)。
 */

export interface ShakeOpts {
  /** 去重力后的加速度阈值,m/s² */
  threshold: number;
  /** 需要几次方向交替的峰值 */
  peaks: number;
  /** 这些峰值必须落在多长的窗口内,ms */
  windowMs: number;
  /** 触发后的冷却,ms */
  cooldownMs: number;
}
export const SHAKE_OPTS: ShakeOpts = { threshold: 12, peaks: 3, windowMs: 600, cooldownMs: 1500 };

export interface ShakeDetector {
  /** 喂一个加速度样本(m/s²,含不含重力都行),t 为毫秒时间戳。摇动成立时返回强度 0.3..1,否则 0。 */
  feed(ax: number, ay: number, az: number, t: number): number;
  reset(): void;
}

export function createShakeDetector(opts: Partial<ShakeOpts> = {}): ShakeDetector {
  const o = { ...SHAKE_OPTS, ...opts };
  // 重力估计(低通),样本减去它 = 用户加速度。传入已去重力的数据也无妨:估计值会趋近 0。
  let gx = 0, gy = 0, gz = 0, primed = false;
  let peaks: { t: number; v: number }[] = [];
  let lastAxis = -1, lastSign = 0;
  let coolUntil = -Infinity;

  const reset = () => {
    peaks = [];
    lastAxis = -1;
    lastSign = 0;
  };

  const feed = (ax: number, ay: number, az: number, t: number): number => {
    if (!primed) {
      gx = ax; gy = ay; gz = az;
      primed = true;
      return 0;
    }
    const a = 0.85;
    gx = a * gx + (1 - a) * ax;
    gy = a * gy + (1 - a) * ay;
    gz = a * gz + (1 - a) * az;
    if (t < coolUntil) return 0;
    const v = [ax - gx, ay - gy, az - gz];
    let k = 0;
    for (let i = 1; i < 3; i++) if (Math.abs(v[i]) > Math.abs(v[k])) k = i;
    const mag = Math.abs(v[k]);
    if (mag < o.threshold) return 0;
    const sign = v[k] > 0 ? 1 : -1;
    // 只数方向交替的峰;同一方向的连续高值不重复计
    if (k === lastAxis && sign === lastSign) return 0;
    lastAxis = k;
    lastSign = sign;
    peaks.push({ t, v: mag });
    while (peaks.length && t - peaks[0].t > o.windowMs) peaks.shift();
    if (peaks.length < o.peaks) return 0;
    const top = Math.max(...peaks.map((p) => p.v));
    reset();
    coolUntil = t + o.cooldownMs;
    return Math.max(0.3, Math.min(1, (top - o.threshold) / 18 + 0.4));
  };

  return { feed, reset };
}

type DME = typeof DeviceMotionEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

/** 这台设备大概率有加速度计吗(桌面浏览器通常没有 → 隐藏开关) */
export function motionSupported(): boolean {
  if (typeof window === 'undefined' || typeof DeviceMotionEvent === 'undefined') return false;
  // 桌面 Chrome 也可能带 requestPermission 桩函数,所以一律要求触控设备(手机/平板)
  return (navigator.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in window;
}

/** 请求权限。iOS 必须在点击等手势内调用。 */
export async function enableMotion(): Promise<'on' | 'denied' | 'unsupported'> {
  if (!motionSupported()) return 'unsupported';
  const req = (DeviceMotionEvent as DME).requestPermission;
  if (typeof req === 'function') {
    try {
      return (await req.call(DeviceMotionEvent)) === 'granted' ? 'on' : 'denied';
    } catch {
      return 'denied';
    }
  }
  return 'on';
}

/** 挂上 devicemotion;页面不可见时自动摘掉。onShake 收到强度 0.3..1。返回 detach。 */
export function attachMotion(onShake: (strength: number) => void, det: ShakeDetector = createShakeDetector()): () => void {
  const onMotion = (e: DeviceMotionEvent): void => {
    const a = e.acceleration && e.acceleration.x !== null ? e.acceleration : e.accelerationIncludingGravity;
    if (!a || a.x === null || a.y === null || a.z === null) return;
    const s = det.feed(a.x, a.y, a.z, performance.now());
    if (s > 0) onShake(s);
  };
  let on = false;
  const sync = (): void => {
    const want = document.visibilityState !== 'hidden';
    if (want && !on) {
      det.reset();
      addEventListener('devicemotion', onMotion);
      on = true;
    } else if (!want && on) {
      removeEventListener('devicemotion', onMotion);
      on = false;
    }
  };
  document.addEventListener('visibilitychange', sync);
  sync();
  return () => {
    document.removeEventListener('visibilitychange', sync);
    if (on) removeEventListener('devicemotion', onMotion);
    on = false;
  };
}
