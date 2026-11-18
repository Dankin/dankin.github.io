/**
 * 乐段 cue 引擎：把 docs/06「音乐需求」里的每条 cue 落成代码。
 *  - phase_*  : 时段循环底（速度/调/配色/附加层），在下一小节切换。
 *  - *_theme  : 故事主题（核心动机种子 D E G A G，各用自己的乐器），限时，结束后回到时段底。
 *  - 一次性   : lullaby_radio / bread_scent / adong_ramp / adong_finish / xiaolan_melt / laozhou_burnt / adong_slowmo / egg_*
 *  - finale   : 五个动机依次进入 → 《平安夜》(PD) → 主和弦保持 6 秒
 *  - epilogue / night_sandbox : 终章后的循环
 * 所有声音都由 WebAudio 合成；调式限定在 C/G/D 大调五声（D E G A）。
 */
import { Rig, clamp, rnd, rr } from './rig';
import { Music, LayerName } from './music';
import { Sfx } from './sfx';
import { MOTIF_SLOT, StoryId, chordOfBar } from './theory';
import * as V from './voices';

/** 核心动机种子：D E G A G（相对 C 大调引擎，随 transpose 一起移调），[midi, 八分音符数] */
export const SEED: [number, number][] = [[74, 2], [76, 2], [79, 2], [81, 2], [79, 4]];

export type CueName =
  | 'phase_morning' | 'phase_noon' | 'phase_dusk' | 'phase_night'
  | 'xiaomi_theme' | 'afu_theme' | 'laozhou_theme' | 'xiaolan_theme' | 'adong_theme'
  | 'lullaby_radio' | 'lullaby_stop' | 'bread_scent' | 'adong_ramp' | 'adong_finish' | 'adong_slowmo'
  | 'xiaolan_melt' | 'laozhou_burnt'
  | 'finale' | 'finale_coda' | 'epilogue' | 'night_sandbox'
  | 'egg' | 'egg_ding' | 'egg_accordion' | 'egg_cat' | 'egg_bikes' | 'egg_choir'
  | 'theme_stop';

export const CUE_NAMES: CueName[] = [
  'phase_morning', 'phase_noon', 'phase_dusk', 'phase_night',
  'xiaomi_theme', 'afu_theme', 'laozhou_theme', 'xiaolan_theme', 'adong_theme',
  'lullaby_radio', 'lullaby_stop', 'bread_scent', 'adong_ramp', 'adong_finish', 'adong_slowmo',
  'xiaolan_melt', 'laozhou_burnt', 'finale', 'finale_coda', 'epilogue', 'night_sandbox',
  'egg', 'egg_ding', 'egg_accordion', 'egg_cat', 'egg_bikes', 'egg_choir', 'theme_stop',
];

/** 别名：dev-core/故事数据里可能用的名字 */
const ALIAS: Record<string, CueName> = {
  morning: 'phase_morning', noon: 'phase_noon', dusk: 'phase_dusk', night: 'phase_night',
  xiaomi_finale: 'xiaomi_theme', afu_finale: 'afu_theme', laozhou_finale: 'laozhou_theme',
  xiaolan_finale: 'xiaolan_theme', adong_finale: 'adong_theme',
  xiaomi: 'xiaomi_theme', afu: 'afu_theme', laozhou: 'laozhou_theme', xiaolan: 'xiaolan_theme', adong: 'adong_theme',
  radio_lullaby: 'lullaby_radio', lullaby: 'lullaby_radio', radio_stop: 'lullaby_stop',
  scent: 'bread_scent', bread: 'bread_scent', ramp: 'adong_ramp', finish: 'adong_finish', slowmo: 'adong_slowmo',
  melt: 'xiaolan_melt', snow_melt: 'xiaolan_melt', burnt: 'laozhou_burnt', burned: 'laozhou_burnt',
  finale_city: 'finale', game_complete: 'night_sandbox', sandbox: 'night_sandbox',
  egg_1: 'egg_ding', egg_2: 'egg_accordion', egg_3: 'egg_cat', egg_4: 'egg_bikes', egg_5: 'egg_choir',
};

interface Base {
  semi: number; bpm: number; color: Music['color']; mood: LayerName[]; force: LayerName[] | null;
}
const BASES: Record<string, Base> = {
  phase_morning: { semi: 2, bpm: 84, color: 'morning', mood: [], force: null },
  phase_noon: { semi: 7, bpm: 84, color: 'noon', mood: ['guitar'], force: null },
  phase_dusk: { semi: 9, bpm: 84, color: 'dusk', mood: ['strings'], force: null },
  phase_night: { semi: 2, bpm: 72, color: 'night', mood: ['strings'], force: null },
  epilogue: { semi: 2, bpm: 64, color: null, mood: [], force: ['celesta', 'bells'] },
  night_sandbox: { semi: 2, bpm: 72, color: 'sandbox', mood: [], force: ['strings'] },
};

export class Cues {
  private base: Base = BASES.phase_morning;
  private baseName = 'phase_morning';
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private themeId: string | null = null;
  private themeSeq = 0;
  private radio: { g: GainNode; stop: () => void } | null = null;
  /** 最近一次 cue 的预计时长（秒），供测试/字幕对齐 */
  lastLen = 0;
  private lastCue = '';

  constructor(private rig: Rig, private m: Music, private sfx: Sfx) {}

  get current() { return { base: this.baseName, theme: this.themeId, last: this.lastCue }; }

  /** 新开一局：停掉主题/收音机，回到清晨底 */
  reset() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear(); this.themeSeq++; this.themeId = null;
    this.radio?.stop(); this.radio = null;
    this.m.motifsEnabled = true; this.m.mood = []; this.m.color = null;
    this.base = BASES.phase_morning; this.baseName = 'phase_morning';
  }

  dispose() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.radio?.stop(); this.radio = null;
  }

  /** 离线渲染（selftest）：true 时 later() 立即同步执行（tail=true 的收尾任务跳过），且不启动实时调度 */
  sync = false;
  private later(ms: number, fn: () => void, tail = false) {
    if (this.sync) { if (!tail) fn(); return 0 as unknown as ReturnType<typeof setTimeout>; }
    const id = setTimeout(() => { this.timers.delete(id); fn(); }, Math.max(0, ms));
    this.timers.add(id);
    return id;
  }

  /** 把基础状态（时段/终章）应用到 Music；smooth=true 则对齐到下一小节 */
  private applyBase(smooth: boolean) {
    const M = this.m, b = this.base;
    const run = () => {
      M.tempoMul = b.bpm / 84; M.transpose = b.semi; M.color = b.color; M.mood = [...b.mood];
      M.forceLayers = b.force ? [...b.force] : null;
      this.onKey?.(b.semi);
      M.refreshLayers();
    };
    if (smooth && M.running) {
      const d = Math.max(0, M.secToNextBar() * 1000 - 40);
      this.later(d, run);
    } else run();
  }
  /** 调式变化回调（ambience 的调式跟随） */
  onKey: ((semi: number) => void) | null = null;

  /** 主入口。返回 true 表示 cue 名已识别。arg 因 cue 而异（见 docs/06 §6）。 */
  cue(raw: string, arg?: unknown): boolean {
    const key = String(raw || '').toLowerCase().replace(/[\s-]+/g, '_');
    const name = (ALIAS[key] || key) as CueName;
    if (!CUE_NAMES.includes(name)) return false;
    this.lastCue = name; this.lastLen = 0;
    const R = this.rig, M = this.m;
    if (name.startsWith('egg')) { this.sfx.play(name, undefined, { force: true }); this.lastLen = this.sfx.len(name === 'egg' ? 'egg_ding' : name); return true; }
    switch (name) {
      case 'phase_morning': case 'phase_noon': case 'phase_dusk': case 'phase_night':
      case 'epilogue': case 'night_sandbox':
        this.endTheme(false);
        M.finale = name === 'epilogue' ? M.finale : M.finale; // 终章标记由 storyDone 管
        M.motifsEnabled = true;
        this.base = BASES[name]; this.baseName = name;
        if (!M.running && !this.sync) M.start();
        this.applyBase(true);
        this.lastLen = name === 'epilogue' ? 20 : 0;
        return true;
      case 'xiaomi_theme': this.theme(name, 84, 2, 30, ['guitar'], (t, sd, bar, id) => {
        const hum = (m: number, at: number, v: number) => SEED.reduce((acc, [n, e]) => { V.hum(R, M.colorBus, n + m, at + acc.t, e * sd, v, 'a'); return { t: acc.t + e * sd }; }, { t: 0 });
        hum(this.semiNow(), t, 0.15);                                              // 单人哼唱
        this.later((t + bar * 2 - R.t) * 1000, () => { if (this.stale(id)) return; hum(this.semiNow(), t + bar * 2, 0.13); hum(this.semiNow() + 12, t + bar * 2, 0.05); });
        this.later((t + bar * 4 - R.t) * 1000 - 40, () => { if (this.stale(id)) return; M.transpose = 7; this.onKey?.(7); }); // 上扬到 G
        this.later((t + bar * 4 - R.t) * 1000, () => { if (this.stale(id)) return; const s = this.semiNow(); hum(s, t + bar * 4, 0.14); hum(s + 12, t + bar * 4, 0.07); SEED.reduce((a, [n, e]) => { V.celesta(R, M.colorBus, n + 12 + s, t + bar * 4 + a * sd, 0.1, 1.8); return a + e; }, 0); });
        this.later((t + bar * 6 - R.t) * 1000, () => { if (this.stale(id)) return; const s = this.semiNow(); hum(s, t + bar * 6, 0.14); V.choir(R, M.colorBus, [60 + s, 64 + s, 67 + s], t + bar * 6 + 4 * sd, bar * 2, 0.045); });
      }); return true;
      case 'afu_theme': this.theme(name, 76, 7, 25, [], (t, sd, bar, id) => {
        const flute = (at: number, dn = 0) => SEED.reduce((a, [n, e]) => { V.flute(R, M.colorBus, n + this.semiNow() + dn, at + a * sd, e * sd * 0.95, 0.07); return a + e; }, 0);
        flute(t);
        this.later((t + bar * 4 - R.t) * 1000, () => { if (this.stale(id)) return; SEED.reduce((a, [n, e]) => { V.wood(R, M.colorBus, n + this.semiNow() - 12, t + bar * 4 + a * sd, e * sd, 0.1); return a + e; }, 0); });
        // 蹑手蹑脚的低音拨弦：每拍一个，根音/五音交替
        const nb = M.nextBar().bar;
        for (let b = 0; b < 8; b++) {
          const ch = chordOfBar(nb + b);
          for (let q = 0; q < 4; q++) V.pizz(R, M.colorBus, (q % 2 ? ch.fifth : ch.root) + 12 + this.semiNow(), t + b * bar + q * 2 * sd, 0.1 + (b >= 4 ? 0.02 : 0));
        }
      }); return true;
      case 'laozhou_theme': this.theme(name, 92, 2, 30, ['guitar'], (t, sd, bar, id) => {
        this.sfx.play('oven_stoke', undefined, { force: true });
        const acc = (at: number, dn: number, bright: number, v: number) => SEED.reduce((a, [n, e]) => { V.accordion(R, M.colorBus, [n + this.semiNow() + dn], at + a * sd, e * sd * 1.05, v, bright); return a + e; }, 0);
        acc(t + 0.2, -12, 1, 0.07);
        this.later((t + bar * 3 - R.t) * 1000, () => { if (this.stale(id)) return; acc(t + bar * 3, -12, 1, 0.07); acc(t + bar * 3, 0, 2.2, 0.03); /* 口琴：亮音色高八度 */ });
        this.later((t + bar * 6 - R.t) * 1000, () => { if (this.stale(id)) return; acc(t + bar * 6, 0, 2.2, 0.04); const ch = chordOfBar(M.nextBar().bar); V.accordion(R, M.colorBus, ch.pad.map((m) => m + this.semiNow()), t + bar * 6, bar * 1.6, 0.04); });
      }); return true;
      case 'xiaolan_theme': this.theme(name, 72, 2, 40, ['strings'], (t, sd, bar, id) => {
        const pi = (at: number, s: number, dn = 0) => SEED.reduce((a, [n, e]) => { V.piano(R, M.colorBus, n + s + dn, at + a * sd, 0.12, e * sd * 1.2); V.bell(R, M.colorBus, n + s + 24, at + a * sd + 0.03, 0.03, 2.8); return a + e; }, 0);
        pi(t, this.semiNow());
        this.later((t + bar * 3 - R.t) * 1000, () => { if (this.stale(id)) return; pi(t + bar * 3, this.semiNow(), -12); pi(t + bar * 3 + 2 * sd, this.semiNow(), 0); });
        this.later((t + bar * 6 - R.t) * 1000 - 40, () => { if (this.stale(id)) return; M.transpose = 4; this.onKey?.(4); }); // 小调感 → 转亮（D → E）
        this.later((t + bar * 6 - R.t) * 1000, () => { if (this.stale(id)) return; pi(t + bar * 6, this.semiNow()); V.choir(R, M.colorBus, [60 + this.semiNow(), 64 + this.semiNow(), 67 + this.semiNow()], t + bar * 6, bar * 2, 0.04); });
        this.later((t + bar * 9 - R.t) * 1000, () => { if (this.stale(id)) return; pi(t + bar * 9, this.semiNow(), 12); });
      }); return true;
      case 'adong_theme': this.adongTheme(); return true;
      case 'theme_stop': this.endTheme(true); return true;
      case 'lullaby_radio': this.lullaby(typeof arg === 'number' ? arg : 12); return true;
      case 'lullaby_stop': this.radio?.stop(); return true;
      case 'bread_scent': this.breadScent(); return true;
      case 'adong_ramp': {
        const t = R.t + 0.03;
        V.trumpet(R, R.sfx, 67 + this.semiNow(), t, 0.7, 0.12); V.bell(R, R.sfx, 91 + this.semiNow(), t + 0.5, 0.1, 2.4);
        R.duck(900, 0.6, 0.8); this.lastLen = 2; return true;
      }
      case 'adong_finish': {
        const t = R.t + 0.02;
        V.bell(R, R.sfx, 96, t, 0.14, 3.2); V.bell(R, R.sfx, 100, t + 0.08, 0.1, 2.6);
        V.sleighBells(R, R.sfx, t + 0.02, 0.07, 8); this.lastLen = 2.5; return true;
      }
      case 'adong_slowmo': {
        const sec = typeof arg === 'number' ? clamp(arg, 1, 20) : 6;
        const prev = M.tempoMul; M.tempoMul = 80 / 84; this.later(sec * 1000, () => { M.tempoMul = prev; }, true);
        R.duck(sec * 1000, 0.6, 0.8); this.lastLen = sec; return true;
      }
      case 'xiaolan_melt': this.melt(); return true;
      case 'laozhou_burnt': {
        const t = R.t + 0.05;
        V.trombone(R, R.sfx, 55, t, 0.9, 0.12, -5); V.trombone(R, R.sfx, 53, t + 1.0, 1.3, 0.11, -7);
        R.duck(2400, 0.5, 0.8); this.lastLen = 2.8; return true;
      }
      case 'finale': this.finale(arg !== 'manual'); return true;
      case 'finale_coda': this.finaleCoda(); return true;
    }
    return false;
  }

  /** 当前调（相对 C 的半音数） */
  private semiNow() { return this.m.transpose; }
  private stale(id: number) { return id !== this.themeSeq; }

  /** 结束主题：回到时段底。restore=false 时只清标记（紧接着会设新的 base） */
  private endTheme(restore: boolean) {
    this.themeSeq++; this.themeId = null;
    if (restore) this.applyBase(true);
  }

  /** 通用主题壳：设速度/调/附加层，在下一小节落地，到点回基础底 */
  private theme(name: string, bpm: number, semi: number, seconds: number, mood: LayerName[],
    body: (t: number, sd: number, bar: number, id: number) => void) {
    const M = this.m, R = this.rig;
    if (!M.running && !this.sync) M.start();
    const id = ++this.themeSeq; this.themeId = name; this.lastLen = seconds;
    const sd = 30 / bpm, bar = sd * 8;
    const t0 = M.nextBar().t;
    const go = () => {
      if (this.stale(id)) return;
      M.tempoMul = bpm / 84; M.transpose = semi; M.mood = [...this.base.mood, ...mood]; M.forceLayers = null;
      this.onKey?.(semi); M.refreshLayers();
    };
    this.later((t0 - R.t) * 1000 - 60, go);
    this.later((t0 - R.t) * 1000, () => { if (!this.stale(id)) body(Math.max(t0, R.t + 0.02), sd, bar, id); });
    this.later((t0 - R.t + seconds) * 1000, () => { if (!this.stale(id)) { this.themeId = null; this.applyBase(true); } }, true);
  }

  // ───────────────────────── 阿冬：起跑前静默 4 拍，冲线爆开 ─────────────────────────
  private adongTheme() {
    const M = this.m, R = this.rig;
    if (!M.running && !this.sync) M.start();
    const id = ++this.themeSeq; this.themeId = 'adong_theme'; this.lastLen = 70;
    const bpm = 120, sd = 30 / bpm, beat = sd * 2, bar = sd * 8;
    const t0 = M.nextBar().t;
    this.later((t0 - R.t) * 1000 - 60, () => {
      if (this.stale(id)) return;
      R.duck(4 * beat * 1000 + 200, 0.03, 0.4);                  // 起跑前 4 拍几乎静默
      M.tempoMul = bpm / 84; M.transpose = 7; M.mood = ['perc', 'strings', 'bass']; M.forceLayers = null; this.onKey?.(7); M.refreshLayers();
    });
    const tGo = t0 + 4 * beat;
    this.later((tGo - R.t) * 1000 - 30, () => {
      if (this.stale(id)) return;
      const C = M.colorBus, s = this.semiNow();
      for (let i = 0; i < 8; i++) V.snare(R, C, tGo - 0.5 + i * sd * 0.5, 0.05 + i * 0.012);   // 小军鼓滚奏
      const seed = (at: number, dn: number) => SEED.reduce((a, [n, e]) => { V.trumpet(R, C, n + s + dn, at + a * sd, e * sd * 0.8, 0.1); return a + e; }, 0);
      const bars = Math.floor((70 - 4 * beat) / bar);
      for (let b = 0; b < bars; b++) {
        const at = tGo + b * bar;
        if (b % 4 === 0) this.later((at - R.t) * 1000 - 20, () => { if (!this.stale(id)) seed(at, b % 8 === 4 ? 12 : 0); });
        this.later((at - R.t) * 1000 - 20, () => {
          if (this.stale(id)) return;
          for (let q = 0; q < 4; q++) { V.kick(R, C, at + q * beat, 0.2); if (q % 2) V.snare(R, C, at + q * beat, 0.09); }
          const ch = chordOfBar(M.nextBar().bar);
          for (let q = 0; q < 8; q++) V.pizz(R, C, ch.arp[q % 4] + 12 + s, at + q * sd + beat * 0.0, 0.08);
        });
      }
    });
    this.later((t0 - R.t + 70) * 1000, () => { if (!this.stale(id)) { this.themeId = null; this.cue('adong_finish'); this.applyBase(true); } }, true);
  }

  // ───────────────────────── 收音机摇篮曲：八音盒 + 底噪 + 低保真 ─────────────────────────
  private lullaby(len: number) {
    const R = this.rig, c = R.ctx; this.radio?.stop();
    const t = R.t + 0.05, ms = len * 1000;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + 0.4);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 320;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 1.2;
    g.connect(hp); hp.connect(lp); lp.connect(R.sfx); lp.connect(R.reverb);
    // 慢速调幅（磁带抖动）
    const wob = c.createOscillator(), wd = c.createGain(); wob.frequency.value = 0.8; wd.gain.value = 0.06;
    wob.connect(wd); wd.connect(g.gain); wob.start(t); wob.stop(t + len + 1);
    // 底噪
    const hiss = c.createBufferSource(); hiss.buffer = R.noiseP; hiss.loop = true;
    const hf = c.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 2400; hf.Q.value = 0.5;
    const hg = c.createGain(); hg.gain.value = 0.012; hiss.connect(hf); hf.connect(hg); hg.connect(g);
    hiss.start(t); hiss.stop(t + len + 0.8);
    // 偶发爆音
    for (let i = 0; i < len * 2; i++) if (rnd() < 0.45) {
      const at = t + rnd() * len; const s = c.createBufferSource(); s.buffer = R.noiseW; const e = c.createGain();
      e.gain.setValueAtTime(0.03, at); e.gain.exponentialRampToValueAtTime(0.0001, at + 0.012);
      s.connect(e); e.connect(g); s.start(at, rnd()); s.stop(at + 0.02);
    }
    // 旋律：C 大调、64 BPM，原创短句（改自核心动机）
    const eighth = 30 / 64;
    const tune: [number, number][] = [[76, 2], [79, 2], [81, 2], [79, 2], [76, 2], [74, 2], [72, 4],
    [74, 2], [76, 2], [79, 2], [76, 2], [74, 2], [72, 2], [67, 4], [72, 8]];
    let at = t + 0.3, i = 0;
    for (const [m, e] of tune) {
      if (at - t > len - 0.5) break;
      V.musicBox(R, g, m, at, 0.12);
      if (e >= 4) V.hum(R, g, m - 12, at, Math.min(e * eighth, 1.6), 0.03, 'o');
      at += e * eighth; i++;
    }
    R.duck(ms + 600, 0.18, 0.5);                                // 其他乐层压低，让收音机成为主角
    this.lastLen = len;
    const stop = () => {
      const now = R.t; g.gain.cancelScheduledValues(now); g.gain.setTargetAtTime(0.0001, now, 0.08);
      R.duck(300, 1, 1);
      setTimeout(() => { try { g.disconnect(); hp.disconnect(); lp.disconnect(); } catch { /* ignore */ } }, 1200);
      if (this.radio?.g === g) this.radio = null;
    };
    this.radio = { g, stop };
    this.later(ms + 1500, () => { if (this.radio?.g === g) stop(); }, true);
  }

  // ───────────────────────── 面包香味飘向小蓝：手风琴飘远、混响变湿 ─────────────────────────
  private breadScent() {
    const R = this.rig, c = R.ctx, t = R.t + 0.05;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(600, t + 5.5);
    const dry = c.createGain(); dry.gain.setValueAtTime(0.5, t); dry.gain.linearRampToValueAtTime(0.0001, t + 6);
    const wet = c.createGain(); wet.gain.setValueAtTime(0.5, t); wet.gain.linearRampToValueAtTime(1.6, t + 5);
    lp.connect(dry); dry.connect(R.music); lp.connect(wet); wet.connect(R.reverb);
    const s = this.semiNow();
    const notes = [[55, 60, 64], [57, 60, 64], [55, 62, 67]];
    notes.forEach((ch, i) => V.accordion(R, lp, ch.map((m) => m + s), t + i * 1.4, 2.4, 0.05, 0.8));
    V.bell(R, lp, 88 + s, t + 3.6, 0.04, 3); V.bell(R, lp, 91 + s, t + 4.2, 0.03, 3);
    this.lastLen = 6;
    setTimeout(() => { try { lp.disconnect(); dry.disconnect(); wet.disconnect(); } catch { /* ignore */ } }, 8500);
  }

  // ───────────────────────── 雪人融化：钢琴音高下滑半音再回升 ─────────────────────────
  private melt() {
    const R = this.rig, c = R.ctx, t = R.t + 0.03, s = this.semiNow();
    const f0 = 440 * Math.pow(2, (76 + s - 69) / 12);
    for (const [k, v] of [[1, 0.1], [2, 0.04], [3, 0.02]] as [number, number][]) {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(f0 * k, t); o.frequency.linearRampToValueAtTime(f0 * k * 0.9439, t + 0.9); o.frequency.linearRampToValueAtTime(f0 * k, t + 1.7);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      o.connect(g); g.connect(R.sfx); g.connect(R.reverb); o.start(t); o.stop(t + 2.3);
      o.onended = () => { try { o.disconnect(); g.disconnect(); } catch { /* ignore */ } };
    }
    V.bell(R, R.sfx, 95 + s, t + 1.7, 0.05, 2.5);
    R.duck(2200, 0.6, 0.8); this.lastLen = 2.3;
  }

  // ───────────────────────── 终章：五动机依次进入 → 平安夜 → 主和弦保持 ─────────────────────────
  private finaleCoda(): number {
    const M = this.m, R = this.rig, s = M.transpose;
    const t = M.nextBar().t;
    const dur = M.finaleCoda(t);                       // 平安夜 8 小节引用（PD）
    // 最后一句落在主和弦并保持 6 秒
    const tEnd = t + dur;
    V.choir(R, R.music, [60 + s, 64 + s, 67 + s, 72 + s], tEnd - 0.2, 6.4, 0.06);
    V.strings(R, R.music, [48 + s, 55 + s, 60 + s, 64 + s], tEnd - 0.2, 6.4, 0.05);
    V.bell(R, R.music, 84 + s, tEnd, 0.08, 5); V.bell(R, R.music, 91 + s, tEnd + 0.15, 0.06, 5);
    R.duck(dur * 1000 + 6400, 0.45, 0.6);
    this.lastLen = dur + 6.4;
    return this.lastLen;
  }

  private finale(auto: boolean) {
    const M = this.m, R = this.rig;
    this.endTheme(false);
    if (!M.running && !this.sync) M.start();
    this.base = { semi: 2, bpm: 72, color: null, mood: ['strings'], force: null };
    this.baseName = 'finale';
    M.motifsEnabled = false;                      // 背景动机槽位关掉：由这里按顺序亲自安排
    this.applyBase(false);
    const order: StoryId[] = ['xiaomi', 'afu', 'laozhou', 'xiaolan', 'adong'];
    const layerIn: LayerName[] = ['guitar', 'bass', 'hum', 'perc', 'bells'];
    const bar = M.barSeconds, loop = M.loopSeconds;
    let tPrev = M.nextBar().t - 2 * bar, endAll = tPrev;
    order.forEach((id, i) => {
      let t = M.timeOfBar(MOTIF_SLOT[id]);
      while (t < tPrev + 3 * bar) t += loop;
      tPrev = t;
      const len = M.playMotif(id, t, true, M.colorBus, 0.85);
      endAll = Math.max(endAll, t + len);
      this.later((t - R.t) * 1000, () => { if (this.themeSeq >= 0) { this.base.mood.push(layerIn[i]); M.mood = [...this.base.mood]; M.refreshLayers(); } });
    });
    const tCoda = endAll + bar * 0.5;
    this.lastLen = tCoda - R.t + 17 + 6;
    if (auto) this.later((tCoda - R.t) * 1000 - 100, () => {
      M.finale = true; M.refreshLayers(); M.motifsEnabled = true; this.finaleCoda();
    });
  }
}
