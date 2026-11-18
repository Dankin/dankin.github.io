/**
 * 全合成音频（无素材）。本文件是门面（facade），真正的合成在 src/audio/*：
 *   rig.ts 混音总线+压缩器+混响 · voices.ts 乐器 · music.ts 分层音乐/动机 · ambience.ts 区域氛围/天气 · sfx.ts 音效 · theory.ts 乐理数据
 * 旧 API（unlock/setMuted/muted/setRain/setLayer/tone/noise/playPhrase/theme/sfx）保持不变。
 * 新 API：setRegion/setWeather/setWarmth/storyMotif/storyDone/duck/setVolume（+ sting/twinkle/setTempo/setTranspose/resetProgress/dispose）。
 */
import { Rig, BusKind, mtof, clamp } from '../audio/rig';
import { Music } from '../audio/music';
import { Sfx, SFX_IDS, SFX_ALIAS } from '../audio/sfx';
import { Cues, CUE_NAMES } from '../audio/cues';
import { Ambience, REGIONS } from '../audio/ambience';
import { THEME as THEME_DATA } from '../audio/theory';

/** 《冬青里》主旋律开头（旧 API 兼容）：[MIDI, 拍数] */
export const THEME: [number, number][] = THEME_DATA;
export { SFX_IDS, SFX_ALIAS, REGIONS, CUE_NAMES };
export type VolumeKind = 'master' | 'music' | 'sfx' | 'ambience' | 'amb';

class AudioEngine {
  ctx?: AudioContext;
  muted = false;
  layer = 0;
  rig?: Rig;
  music?: Music;
  sfxLib?: Sfx;
  amb?: Ambience;
  cues?: Cues;
  private pendCue: [string, unknown] | null = null;

  private vols: Record<BusKind, number> = { master: 1, music: 1, sfx: 1, amb: 1 };
  private pend = { region: null as string | null, rain: 0, snow: 0, wind: 0, warmth: 0, tempo: 1, transpose: 0 };
  private autoStart: ReturnType<typeof setTimeout> | null = null;
  private hooked = false;
  private disposed = false;

  // 旧字段兼容（直接给 tone/noise 的 bus 选项用）
  get master(): GainNode { return this.rig!.master; }
  get sfxBus(): GainNode { return this.rig!.sfx; }
  get musBus(): GainNode { return this.rig!.music; }
  get ambBus(): GainNode { return this.rig!.amb; }
  get unlocked() { return !!this.ctx; }
  get region() { return this.amb?.region ?? this.pend.region; }
  /** 当前音乐层级 0..5 */
  get level() { return this.music?.level ?? this.layer; }

  /** 必须在用户手势（点击/触摸）里调用；可重复调用，只会创建一个 AudioContext */
  unlock() {
    if (this.disposed) return;
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined = typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : undefined;
      if (!AC) return;
      let ctx: AudioContext;
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch { try { ctx = new AC(); } catch { return; } }
      this.ctx = ctx;
      const rig = (this.rig = new Rig(ctx));
      this.music = new Music(rig); this.sfxLib = new Sfx(rig); this.amb = new Ambience(rig); this.cues = new Cues(rig, this.music, this.sfxLib);
      this.sfxLib.onBig = (ms) => rig.duck(ms, 0.55, 0.75);
      (Object.keys(this.vols) as BusKind[]).forEach((k) => rig.setVolume(k, this.vols[k]));
      rig.setMuted(this.muted);
      this.music.baseLayer = this.layer; this.music.tempoMul = this.pend.tempo; this.music.transpose = this.pend.transpose;
      this.sfxLib.warmth = this.pend.warmth; rig.setWarmthTone(this.pend.warmth);
      this.amb.setWeather({ rain: this.pend.rain, snow: this.pend.snow, wind: this.pend.wind });
      if (this.pend.region) this.amb.setRegion(this.pend.region);
      // 部分 iOS 需要在手势里放一个静音 buffer 才算解锁
      try { const b = ctx.createBuffer(1, 1, ctx.sampleRate); const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch { /* */ }
      // 没有人调用 theme() 的话，稍等一下自动开始背景音乐
      this.autoStart = setTimeout(() => this.startMusic(), 1800);
      if (this.pendCue) { const [n, a] = this.pendCue; this.pendCue = null; this.cues.cue(n, a); }
      this.hook();
    }
    void this.ctx.resume().catch(() => undefined);
  }

  /** 页面隐藏时 suspend 省电；回到前台/再次触摸时 resume（iOS 会把 ctx 置为 interrupted） */
  private hook() {
    if (this.hooked || typeof document === 'undefined') return; this.hooked = true;
    const wake = () => { const c = this.ctx; if (c && !document.hidden && c.state !== 'running' && (c.state as string) !== 'closed') void c.resume().catch(() => undefined); };
    const vis = () => {
      const c = this.ctx; if (!c || (c.state as string) === 'closed') return;
      if (document.hidden) void c.suspend().catch(() => undefined); else wake();
    };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', () => { const c = this.ctx; if (c && (c.state as string) !== 'closed') void c.suspend().catch(() => undefined); });
    window.addEventListener('pageshow', wake);
    for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, wake, { passive: true });
  }

  /** 开始背景音乐（unlock 后自动调用；theme() 会把开始时间推迟到主题句之后） */
  startMusic() { if (this.autoStart) { clearTimeout(this.autoStart); this.autoStart = null; } this.music?.start(); }
  stopMusic() { this.music?.stop(); }

  /** 释放全部资源（热更新/测试）。之后 unlock() 不再有效 */
  dispose() {
    this.disposed = true; if (this.autoStart) clearTimeout(this.autoStart);
    this.cues?.dispose(); this.music?.stop(); this.amb?.stopAll();
    const c = this.ctx; this.ctx = undefined; this.rig = undefined; this.music = undefined; this.sfxLib = undefined; this.amb = undefined; this.cues = undefined;
    if (c && (c.state as string) !== 'closed') void c.close().catch(() => undefined);
  }

  // ———————— 音量 / 静音 / 压低 ————————
  setMuted(m: boolean) { this.muted = m; this.rig?.setMuted(m); }
  /** kind: master|music|sfx|ambience；v: 0..1（相对默认电平的倍数，可 >1 至 1.5） */
  setVolume(kind: VolumeKind, v: number) {
    const k: BusKind = kind === 'ambience' ? 'amb' : kind; this.vols[k] = clamp(v, 0, 1.5); this.rig?.setVolume(k, this.vols[k]);
  }
  getVolume(kind: VolumeKind): number { return this.vols[kind === 'ambience' ? 'amb' : kind]; }
  /** 对白/演出时压低音乐（和环境音）ms 毫秒后自动恢复；depth=音乐留存比例 */
  duck(ms: number, depth = 0.35, ambDepth = 0.55) { this.rig?.duck(ms, depth, ambDepth); }

  // ———————— 音乐 ————————
  /** 旧 API：直接指定音乐层级（0..5）；与“已完成故事数”取较大者 */
  setLayer(n: number) { this.layer = n; if (this.music) { this.music.baseLayer = n; this.music.refreshLayers(); this.startMusic(); } }
  /** 速度倍率（0.7~1.4 合理） */
  setTempo(mul: number) { this.pend.tempo = clamp(mul, 0.5, 1.6); if (this.music) this.music.tempoMul = this.pend.tempo; }
  /** 整体变调（半音，+7 = G 大调）；下个循环生效 */
  setTranspose(semi: number) { this.pend.transpose = Math.round(clamp(semi, -12, 12)); if (this.music) this.music.transpose = this.pend.transpose; }
  /** 新开一局：清空已完成故事与层级 */
  resetProgress() { this.layer = 0; this.pendCue = null; this.cues?.reset(); const m = this.music; if (m) { m.done.clear(); m.finale = false; m.baseLayer = 0; m.refreshLayers(); } }
  /** 故事识别动机（演出开始时）；id 可为 xiaomi/afu/laozhou/xiaolan/adong/finale 或 *_story / npc id。返回时长秒 */
  storyMotif(id: string): number { return this.music?.storyMotif(id) ?? 0; }
  /** 故事完成：庆祝 + 动机并入循环 + 音乐加层；finale 触发《平安夜》尾声 */
  storyDone(id: string) { return this.music?.storyDone(id); }
  /**
   * 乐段 cue（docs/06「音乐需求」）：phase_morning|noon|dusk|night、xiaomi|afu|laozhou|xiaolan|adong 加 _theme、
   * lullaby_radio(arg=秒)、lullaby_stop、bread_scent、adong_ramp、adong_finish、adong_slowmo(arg=秒)、xiaolan_melt、laozhou_burnt、
   * finale(arg='manual' 则不自动接平安夜)、finale_coda、epilogue、night_sandbox、egg 及 egg_ding 等、theme_stop。返回是否识别。
   * unlock 之前调用的 phase 类、epilogue、night_sandbox 会被记下，unlock 后播放。
   */
  cue(name: string, arg?: unknown): boolean {
    if (this.cues) return this.cues.cue(name, arg);
    if (/^(phase_|epilogue|night_sandbox)/.test(name)) { this.pendCue = [name, arg]; return true; }
    return CUE_NAMES.includes(name as never);
  }
  /** 当前 cue 状态（调试/自测用） */
  get cueState() { return this.cues?.current ?? null; }
  get cueLen() { return this.cues?.lastLen ?? 0; }
  /** 短提示乐句 */
  sting(name: 'start' | 'hint' | 'fail' | 'win') { this.music?.sting(name); }
  /** 随机洒几颗铃声 */
  twinkle(n = 3) { this.music?.twinkle(n); }
  /** 暖度 0..100：影响音乐亮度（低通）与 'warm' 叮的音高 */
  setWarmth(w: number) { const v = clamp(w, 0, 100); this.pend.warmth = v; if (this.sfxLib) this.sfxLib.warmth = v; this.rig?.setWarmthTone(v); }

  // ———————— 环境 ————————
  /** 区域氛围（plaza/bakery/slope/alley/bridge/dock），交叉淡入淡出；传 null 关闭 */
  setRegion(id: string | null) { this.pend.region = id; if (this.amb) this.amb.setRegion(id ?? ''); }
  /** 天气：rain/snow/wind 0..1（可 >1），缺省项保持不变 */
  setWeather(w: { rain?: number; snow?: number; wind?: number }) {
    if (w.rain !== undefined) this.pend.rain = w.rain; if (w.snow !== undefined) this.pend.snow = w.snow; if (w.wind !== undefined) this.pend.wind = w.wind;
    this.amb?.setWeather(w);
  }
  /** 旧 API：只设雨量 */
  setRain(v: number) { this.setWeather({ rain: v }); }

  // ———————— 基础合成件（旧 API） ————————
  tone(freq: number, at: number, dur: number, o: { type?: OscillatorType; vol?: number; a?: number; slide?: number; lp?: number; bus?: AudioNode; vib?: number; partial?: number } = {}) {
    const c = this.ctx, rig = this.rig; if (!c || !rig) return;
    const osc = c.createOscillator(); const g = c.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, at);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), at + dur);
    const vol = o.vol ?? 0.2, a = o.a ?? 0.008;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + a);
    g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(dur, a + 0.01));
    let node: AudioNode = osc; let f: BiquadFilterNode | undefined;
    if (o.lp) { f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
    node.connect(g); g.connect(o.bus ?? rig.sfx);
    let l: OscillatorNode | undefined; let lg: GainNode | undefined;
    if (o.vib) { l = c.createOscillator(); lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = freq * 0.012 * o.vib; l.connect(lg); lg.connect(osc.frequency); l.start(at); l.stop(at + dur + 0.05); }
    osc.start(at); osc.stop(at + dur + 0.05);
    osc.onended = () => { try { osc.disconnect(); f?.disconnect(); g.disconnect(); l?.disconnect(); lg?.disconnect(); } catch { /* */ } };
    if (o.partial) this.tone(freq * o.partial, at, dur * 0.7, { ...o, partial: 0, vol: vol * 0.35 });
  }
  noise(at: number, dur: number, o: { vol?: number; lp?: number; hp?: number; bus?: AudioNode; slideLp?: number } = {}) {
    const c = this.ctx, rig = this.rig; if (!c || !rig) return;
    const src = c.createBufferSource(); src.buffer = rig.noiseW; src.loop = true;
    const g = c.createGain();
    g.gain.setValueAtTime(o.vol ?? 0.2, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let node: AudioNode = src; const fs: BiquadFilterNode[] = [];
    if (o.lp !== undefined) {
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.lp, at);
      if (o.slideLp) f.frequency.exponentialRampToValueAtTime(o.slideLp, at + dur);
      node.connect(f); node = f; fs.push(f);
    }
    if (o.hp !== undefined) { const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; node.connect(f); node = f; fs.push(f); }
    node.connect(g); g.connect(o.bus ?? rig.sfx);
    src.start(at, Math.random() * 1.5); src.stop(at + dur + 0.05);
    src.onended = () => { try { src.disconnect(); fs.forEach((x) => x.disconnect()); g.disconnect(); } catch { /* */ } };
  }

  /** 播放一段 [MIDI,拍] 乐句。voice=true 为“哼声”；返回持续秒数（未解锁返回 0） */
  playPhrase(notes: [number, number][], opts: { voice?: boolean; bpm?: number; vol?: number; transpose?: number } = {}) {
    const c = this.ctx, rig = this.rig; if (!c || !rig) return 0;
    const beat = 60 / (opts.bpm ?? 96); let at = c.currentTime + 0.05;
    for (const [m, b] of notes) {
      const f = mtof(m + (opts.transpose ?? 0)), d = b * beat;
      if (opts.voice) {
        this.tone(f, at, d * 0.98, { type: 'triangle', vol: opts.vol ?? 0.2, a: 0.06, lp: 1900, vib: 1, bus: rig.music });
        this.tone(f * 2, at, d * 0.9, { type: 'sine', vol: (opts.vol ?? 0.2) * 0.25, a: 0.08, bus: rig.music });
      } else {
        this.tone(f, at, d * 1.4, { type: 'sine', vol: opts.vol ?? 0.2, a: 0.004, partial: 3.01, bus: rig.music });
      }
      at += d;
    }
    return at - c.currentTime;
  }
  /** 标题主题句；结束后背景音乐淡入 */
  theme(voice: boolean) {
    const sec = this.playPhrase(THEME, { voice, bpm: 88, vol: voice ? 0.22 : 0.2 });
    if (this.ctx) {
      if (this.autoStart) { clearTimeout(this.autoStart); this.autoStart = null; }
      if (!this.music?.running) this.autoStart = setTimeout(() => this.startMusic(), Math.max(0, sec * 1000 - 300));
    }
    return sec;
  }

  /** 离线自检（不发声）：峰值/NaN/各层响度/乐理表。返回 Report，并在控制台打印表格。仅在调用时才加载 selftest 模块 */
  async selfTest(o: { quick?: boolean } = {}) { return (await import('../audio/selftest')).runSelfTest(o); }

  // ———————— 音效 ————————
  /** id 见 SFX_IDS 与别名 SFX_ALIAS（moves.json 的 sfx 字段可直接传）。p：step=地面材质 'grass|snow|wood|stone|sand|carpet'，blip=频率，warm=暖度。
   *  opts.pan -1..1。返回是否真的发声（被限流时 false） */
  sfx(id: string, p?: number | string, opts?: { pan?: number; vol?: number }): boolean { return this.sfxLib?.play(id, p, opts) ?? false; }
}

export const audio = new AudioEngine();
export type { AudioEngine };

// 热更新时释放旧实例，避免重复 AudioContext
{
  const g = globalThis as unknown as { __xmasAudio?: AudioEngine };
  g.__xmasAudio?.dispose();
  g.__xmasAudio = audio;
}
