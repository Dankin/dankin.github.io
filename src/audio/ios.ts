/**
 * ios.ts — iOS Safari 兼容辅助:平台判断、audioSession、静音键提示、旧版静音 <audio> 兜底。
 * 全部可注入 navigator / document,便于测试。
 */

export interface NavLike {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  audioSession?: { type: string };
}

export const SILENT_HINT = '没听到声音?请检查手机侧面的静音键,并调高音量。';
export const TAP_HINT = '点一下恢复声音';

export function isIOS(nav: NavLike | undefined): boolean {
  if (!nav) return false;
  if (/iP(hone|ad|od)/.test(nav.userAgent ?? '')) return true;
  // iPadOS 13+ 伪装成 Mac
  return nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1;
}

/** Safari 16.4+:声明为"播放"类音频,静音拨片不再静音 WebAudio。成功返回 true */
export function setPlaybackSession(nav: NavLike | undefined): boolean {
  try {
    if (nav?.audioSession) {
      nav.audioSession.type = 'playback';
      return nav.audioSession.type === 'playback';
    }
  } catch {
    /* 忽略 */
  }
  return false;
}

/** 0.1 秒 8kHz 静音 WAV 的 data URI(运行时生成,免内嵌) */
export function silentWavUri(): string {
  const n = 800;
  const b = new Uint8Array(44 + n);
  const dv = new DataView(b.buffer);
  const tag = (o: number, s: string) => [...s].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  tag(0, 'RIFF');
  dv.setUint32(4, 36 + n, true);
  tag(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, 8000, true);
  dv.setUint32(28, 8000, true);
  dv.setUint16(32, 1, true);
  dv.setUint16(34, 8, true);
  tag(36, 'data');
  dv.setUint32(40, n, true);
  b.fill(128, 44); // 8 位无符号 PCM 的静音是 128
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return 'data:audio/wav;base64,' + btoa(s);
}

/** 旧版 iOS 没有 navigator.audioSession:循环播放静音 <audio> 让页面进入"媒体播放"通道(须在手势内调用) */
export function startSilentLoop(doc: Document | undefined): HTMLAudioElement | null {
  try {
    if (!doc) return null;
    const a = doc.createElement('audio');
    a.src = silentWavUri();
    a.loop = true;
    a.setAttribute('playsinline', '');
    a.volume = 0.01;
    void a.play()?.catch(() => {});
    return a;
  } catch {
    return null;
  }
}
