/**
 * 区域氛围 + 天气。每个区域是一组“持续底噪（bed）+ 随机点缀事件”，区域切换时交叉淡入淡出；
 * 淡出完成后释放该区域的所有音源（不泄漏）。天气（雨/雪/风）与区域独立叠加。
 */
import { Rig, clamp, pick, rnd, rr } from './rig';
import { SAFE_PENTA } from './theory';
import * as V from './voices';
import { bikeBell, gull, laugh, meow, shipHorn } from './sfx';

export type Region = 'plaza' | 'bakery' | 'slope' | 'alley' | 'bridge' | 'dock';
export const REGIONS: Region[] = ['plaza', 'bakery', 'slope', 'alley', 'bridge', 'dock'];

interface Bed { gain: GainNode; srcs: AudioScheduledSourceNode[]; }
interface Live { bed: Bed; fade: number; next: Record<string, number>; target: number; }

function loopSrc(rig: Rig, buf: AudioBuffer, out: AudioNode, rate = 1): AudioBufferSourceNode {
  const s = rig.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.connect(out); s.start(0, rr(0, buf.duration * 0.9)); return s;
}
function bq(c: BaseAudioContext, type: BiquadFilterType, f: number, q: number, out: AudioNode) { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(out); return b; }
function lfo(c: BaseAudioContext, hz: number, depth: number, target: AudioParam, srcs: AudioScheduledSourceNode[]) {
  const o = c.createOscillator(); o.frequency.value = hz; const g = c.createGain(); g.gain.value = depth; o.connect(g); g.connect(target); o.start(); srcs.push(o);
}

export class Ambience {
  private live = new Map<Region, Live>();
  region: Region | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  // 天气
  private weatherBus: GainNode;
  private rainG: GainNode; private snowG: GainNode; private windG: GainNode;
  private wSrcs: AudioScheduledSourceNode[] = [];
  private w = { rain: 0, snow: 0, wind: 0 };
  private nextDrop = 0; private nextSnow = 0;
  private started = false;

  constructor(private rig: Rig) {
    const c = rig.ctx; const g = () => { const n = c.createGain(); n.gain.value = 0; return n; };
    this.weatherBus = c.createGain(); this.weatherBus.connect(rig.amb);
    this.rainG = g(); this.snowG = g(); this.windG = g();
    this.rainG.connect(this.weatherBus); this.snowG.connect(this.weatherBus); this.windG.connect(this.weatherBus);
  }

  /** 首次需要时再创建天气音源 */
  private startWeather() {
    if (this.started) return; this.started = true; const R = this.rig, c = R.ctx;
    // 雨：粉噪 → 高通 + 带通
    const rh = bq(c, 'highpass', 700, 0.5, this.rainG); const rb = bq(c, 'peaking', 3500, 0.6, rh); rb.gain.value = 5;
    this.wSrcs.push(loopSrc(R, R.noiseP, rb, 1.3));
    // 雪：极轻的高频空气
    const sh = bq(c, 'highpass', 5500, 0.6, this.snowG); this.wSrcs.push(loopSrc(R, R.noiseP, sh, 1.8));
    // 风：棕噪 → 带通，滤波中心随 LFO 摇摆
    const wb = bq(c, 'bandpass', 420, 0.8, this.windG); this.wSrcs.push(loopSrc(R, R.noiseB, wb, 1));
    lfo(c, 0.11, 260, wb.frequency, this.wSrcs); lfo(c, 0.31, 90, wb.frequency, this.wSrcs);
    lfo(c, 0.17, 0.35, this.windG.gain, this.wSrcs); // 阵风起伏（叠加在基础增益上）
    this.ensureTimer();
  }
  setWeather(w: { rain?: number; snow?: number; wind?: number }) {
    if (w.rain !== undefined) this.w.rain = clamp(w.rain, 0, 2);
    if (w.snow !== undefined) this.w.snow = clamp(w.snow, 0, 2);
    if (w.wind !== undefined) this.w.wind = clamp(w.wind, 0, 2);
    if (this.w.rain + this.w.snow + this.w.wind > 0) this.startWeather();
    if (!this.started) return; const t = this.rig.t;
    this.rainG.gain.setTargetAtTime(0.07 * this.w.rain, t, 0.8);
    this.snowG.gain.setTargetAtTime(0.012 * this.w.snow, t, 1.2);
    this.windG.gain.setTargetAtTime(0.085 * this.w.wind, t, 1.0);
  }

  // ———————————————— 区域 ————————————————
  setRegion(id: string) {
    const r = (REGIONS as string[]).includes(id) ? (id as Region) : null;
    if (r === this.region) return; this.region = r;
    const t = this.rig.t;
    for (const [k, lv] of this.live) if (k !== r) { lv.target = 0; lv.bed.gain.gain.setTargetAtTime(0, t, 0.9); lv.fade = t + 5; }
    if (r) {
      let lv = this.live.get(r);
      if (!lv) { lv = { bed: this.buildBed(r), fade: 0, next: {}, target: 1 }; this.live.set(r, lv); }
      lv.target = 1; lv.fade = 0; lv.bed.gain.gain.cancelScheduledValues(t); lv.bed.gain.gain.setTargetAtTime(1, t, 0.9);
    }
    this.ensureTimer();
  }
  private ensureTimer() { if (!this.timer) this.timer = setInterval(() => this.tick(), 250); }
  stopAll() { // 释放全部（页面卸载/测试）
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    for (const lv of this.live.values()) this.free(lv.bed); this.live.clear();
    for (const s of this.wSrcs) { try { s.stop(); s.disconnect(); } catch { /* */ } } this.wSrcs = []; this.started = false;
  }
  private free(b: Bed) { for (const s of b.srcs) { try { s.stop(); s.disconnect(); } catch { /* */ } } try { b.gain.disconnect(); } catch { /* */ } }

  private buildBed(r: Region): Bed {
    const R = this.rig, c = R.ctx; const gain = c.createGain(); gain.gain.value = 0; gain.connect(R.amb); const srcs: AudioScheduledSourceNode[] = [];
    const add = (s: AudioScheduledSourceNode) => { srcs.push(s); return s; };
    const lvl = (v: number, out: AudioNode = gain) => { const g = c.createGain(); g.gain.value = v; g.connect(out); return g; };
    switch (r) {
      case 'plaza': { // 人声嗡嗡：粉噪带通 + 缓慢起伏
        const g = lvl(0.05); const f = bq(c, 'bandpass', 520, 0.7, g); add(loopSrc(R, R.noiseP, f, 1)); lfo(c, 0.13, 0.02, g.gain, srcs);
        const g2 = lvl(0.025); add(loopSrc(R, R.noiseP, bq(c, 'bandpass', 1500, 0.9, g2), 0.8)); lfo(c, 0.21, 0.01, g2.gain, srcs);
        break;
      }
      case 'bakery': { // 炉火：棕噪低频轰 + 噼啪（事件）
        const g = lvl(0.07); add(loopSrc(R, R.noiseB, bq(c, 'lowpass', 600, 0.7, g), 1)); lfo(c, 0.4, 0.02, g.gain, srcs);
        const h = c.createOscillator(); h.type = 'sine'; h.frequency.value = 55; h.connect(lvl(0.012)); h.start(); add(h);
        break;
      }
      case 'slope': { // 造雪机：低频嗡 + 喷雾嘶声 + 风
        const g = lvl(0.035); const lp = bq(c, 'lowpass', 340, 0.7, g);
        for (const [f, dt] of [[58, 0], [87, 6], [116, -5]] as [number, number][]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt; o.connect(lp); o.start(); add(o); if (f === 58) lfo(c, 0.9, 1.2, o.frequency, srcs); }
        const sp = lvl(0.03); add(loopSrc(R, R.noiseP, bq(c, 'bandpass', 2600, 0.9, sp), 1.4)); lfo(c, 0.23, 0.012, sp.gain, srcs);
        const wd = lvl(0.03); add(loopSrc(R, R.noiseB, bq(c, 'bandpass', 380, 0.8, wd), 1));
        break;
      }
      case 'alley': { // 弄堂：很安静的房间底噪 + 远处水滴
        const g = lvl(0.022); add(loopSrc(R, R.noiseP, bq(c, 'lowpass', 380, 0.7, g), 0.7));
        const g2 = lvl(0.01); add(loopSrc(R, R.noiseP, bq(c, 'bandpass', 900, 0.8, g2), 0.9)); lfo(c, 0.09, 0.006, g2.gain, srcs);
        break;
      }
      case 'bridge': { // 水声 + 风
        const g = lvl(0.08); const f = bq(c, 'bandpass', 380, 0.8, g); add(loopSrc(R, R.noiseB, f, 1)); lfo(c, 0.27, 120, f.frequency, srcs); lfo(c, 0.19, 0.02, g.gain, srcs);
        const g2 = lvl(0.035); const f2 = bq(c, 'bandpass', 1300, 1.1, g2); add(loopSrc(R, R.noiseP, f2, 1.1)); lfo(c, 0.41, 420, f2.frequency, srcs);
        const wd = lvl(0.03); add(loopSrc(R, R.noiseB, bq(c, 'bandpass', 520, 0.7, wd), 0.8));
        break;
      }
      case 'dock': { // 海浪低频 + 缆绳（事件）+ 海鸥（事件）+ 汽笛（事件）
        const g = lvl(0.08); const f = bq(c, 'lowpass', 300, 0.6, g); add(loopSrc(R, R.noiseB, f, 0.7)); lfo(c, 0.09, 0.04, g.gain, srcs);
        const g2 = lvl(0.02); add(loopSrc(R, R.noiseP, bq(c, 'bandpass', 800, 0.7, g2), 0.8)); lfo(c, 0.12, 0.012, g2.gain, srcs);
        break;
      }
    }
    return { gain, srcs };
  }

  // ———————————————— 事件 ————————————————
  /** 离线渲染：从 0 到 until 秒按 250ms 步长触发随机事件（实时由 setInterval 驱动） */
  simulate(until: number) { for (let t = 0; t < until; t += 0.25) this.tick(t); }
  private tick(at?: number) {
    const R = this.rig; const now = at ?? R.t;
    for (const [r, lv] of [...this.live]) {
      if (at === undefined && lv.target === 0 && lv.fade && now > lv.fade) { this.free(lv.bed); this.live.delete(r); continue; }
      if (lv.target === 1) this.events(r, lv, now);
    }
    // 天气事件
    if (this.w.rain > 0.05 && now >= this.nextDrop) { // 屋檐滴水
      this.nextDrop = now + rr(0.25, 1.1) / this.w.rain; const f = rr(900, 2400);
      const o = R.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, now); o.frequency.exponentialRampToValueAtTime(f * 0.6, now + 0.05);
      const g = R.ctx.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.012 * Math.min(1, this.w.rain), now + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      o.connect(g); g.connect(this.weatherBus); o.start(now); o.stop(now + 0.08); o.onended = () => { try { o.disconnect(); g.disconnect(); } catch { /* */ } };
    }
    if (this.w.snow > 0.3 && now >= this.nextSnow) { // 雪落时偶尔一粒微光
      this.nextSnow = now + rr(2.5, 6) / this.w.snow;
      V.bell(R, this.weatherBus, pick(SAFE_PENTA.slice(6)), now, 0.012 * Math.min(1.5, this.w.snow), 1.5);
    }
  }
  private due(lv: Live, key: string, now: number, a: number, b: number, first = 0.5): boolean {
    const n = lv.next[key]; if (n === undefined) { lv.next[key] = now + rr(first, first + (b - a)); return false; }
    if (now < n) return false; lv.next[key] = now + rr(a, b); return true;
  }
  private events(r: Region, lv: Live, now: number) {
    const R = this.rig; const c = R.ctx; const d = lv.bed.gain; const at = now + 0.03;
    const gl = (peak: number, a: number, dec: number, t = at) => { const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); g.connect(d); return g; };
    const nzb = (t: number, dur: number, out: AudioNode) => { const s = c.createBufferSource(); s.buffer = R.noiseW; s.loop = true; s.connect(out); s.start(t, rr(0, 1.5)); s.stop(t + dur + 0.02); s.onended = () => { try { s.disconnect(); } catch { /* */ } }; };
    switch (r) {
      case 'plaza':
        if (this.due(lv, 'voice', now, 0.5, 1.8)) { // 零星的人声“嗯/哦”
          const f = rr(110, 260), dur = rr(0.15, 0.4); const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, at); o.frequency.linearRampToValueAtTime(f * rr(0.85, 1.2), at + dur);
          const e = gl(0.012, 0.04, dur); const b = bq(c, 'bandpass', rr(500, 900), 4, e); o.connect(b); o.start(at); o.stop(at + dur + 0.1); o.onended = () => { try { o.disconnect(); } catch { /* */ } };
        }
        if (this.due(lv, 'chime', now, 3.5, 9, 1.5)) { const n = 1 + Math.floor(rnd() * 3); for (let i = 0; i < n; i++) V.bell(R, d, pick(SAFE_PENTA.slice(4)) + 12, at + i * rr(0.1, 0.3), 0.025, 2.2); }
        if (this.due(lv, 'pigeon', now, 9, 20, 4)) { // 鸽子咕咕
          for (let i = 0; i < 3; i++) { const t = at + i * 0.22, f = rr(310, 380); const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 0.78, t + 0.16);
            const e = gl(0.012, 0.03, 0.14, t); const b = bq(c, 'lowpass', 900, 0.7, e); o.connect(b); o.start(t); o.stop(t + 0.3); o.onended = () => { try { o.disconnect(); } catch { /* */ } }; }
        }
        break;
      case 'bakery':
        if (this.due(lv, 'crackle', now, 0.07, 0.4, 0.2)) { const hp = bq(c, 'highpass', rr(1500, 3200), 0.7, gl(rr(0.02, 0.07), 0.001, rr(0.01, 0.03))); nzb(at, 0.05, hp); }
        if (this.due(lv, 'bell', now, 14, 26, 6)) { V.bell(R, d, 91, at, 0.03, 2); V.bell(R, d, 91, at + 0.22, 0.025, 2); }
        if (this.due(lv, 'accordion', now, 16, 28, 5)) { // 近处的手风琴小句（面包街更近）
          const s0 = [60, 64, 67, 64][Math.floor(rnd() * 4)]; V.accordion(R, d, [s0 + 7, s0 + 12], at, 1.4, 0.03, 0.9); if (rnd() < 0.6) V.accordion(R, d, [s0 + 5, s0 + 9], at + 1.3, 1.6, 0.025, 0.9);
        }
        if (this.due(lv, 'pots', now, 4, 11, 2)) { // 锅碗叮当
          const n = 1 + Math.floor(rnd() * 3); for (let i = 0; i < n; i++) V.woodblock(R, d, at + i * rr(0.08, 0.2), 0.025, rr(1400, 2600));
        }
        break;
      case 'slope':
        if (this.due(lv, 'laugh', now, 6, 13, 3)) laugh(R, d, at, 0.025, true);
        if (this.due(lv, 'gust', now, 7, 15, 2)) { // 一阵风
          const dur = rr(1.2, 2.4), e = gl(0.03, dur * 0.4, dur * 0.6), b = bq(c, 'bandpass', rr(500, 900), 1.2, e); nzb(at, dur + 0.2, b);
        }
        break;
      case 'alley':
        if (this.due(lv, 'cat', now, 12, 22, 4)) meow(R, d, at, 0.05, true, rr(0.9, 1.1));
        if (this.due(lv, 'bike', now, 15, 28, 8)) bikeBell(R, d, at, 0.025, true);
        if (this.due(lv, 'dog', now, 25, 45, 9)) { // 远处狗吠
          const n = rnd() < 0.5 ? 1 : 2; for (let i = 0; i < n; i++) { const t = at + i * 0.32, f = rr(300, 420); const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.16);
            const e = gl(0.018, 0.012, 0.15, t); const b = bq(c, 'bandpass', 700, 2, e); o.connect(b); o.start(t); o.stop(t + 0.25); o.onended = () => { try { o.disconnect(); } catch { /* */ } }; }
        }
        if (this.due(lv, 'hanger', now, 8, 18, 3)) { // 晾衣架风铃（金属叮当）
          const n = 2 + Math.floor(rnd() * 3); for (let i = 0; i < n; i++) V.bell(R, d, pick(SAFE_PENTA.slice(8)) + 12, at + i * rr(0.06, 0.2), 0.012, 1.4);
        }
        if (this.due(lv, 'drip', now, 2, 5, 1)) { const f = rr(1100, 1700); const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, at); o.frequency.exponentialRampToValueAtTime(f * 0.55, at + 0.07); o.connect(gl(0.01, 0.002, 0.08)); o.start(at); o.stop(at + 0.12); o.onended = () => { try { o.disconnect(); } catch { /* */ } }; }
        break;
      case 'bridge':
        if (this.due(lv, 'bubble', now, 0.4, 1.4, 0.3)) { const f = rr(380, 800); const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, at); o.frequency.exponentialRampToValueAtTime(f * 1.9, at + 0.05); o.connect(gl(0.014, 0.004, 0.06)); o.start(at); o.stop(at + 0.1); o.onended = () => { try { o.disconnect(); } catch { /* */ } }; }
        if (this.due(lv, 'steps', now, 7, 16, 3)) { // 木桥上的脚步（两三下，轻）
          const n = 2 + Math.floor(rnd() * 3), gap = rr(0.3, 0.45); for (let i = 0; i < n; i++) { const t = at + i * gap; const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(rr(95, 130), t); o.frequency.exponentialRampToValueAtTime(55, t + 0.08);
            o.connect(gl(0.02, 0.003, 0.09, t)); o.start(t); o.stop(t + 0.14); o.onended = () => { try { o.disconnect(); } catch { /* */ } }; const hp = bq(c, 'bandpass', 1200, 1.5, gl(0.006, 0.002, 0.03, t)); nzb(t, 0.04, hp); }
        }
        break;
      case 'dock':
        if (this.due(lv, 'horn', now, 26, 44, 9)) shipHorn(R, d, at, 0.05, rr(1.4, 2.2), rr(0.95, 1.05));
        if (this.due(lv, 'gull', now, 6, 14, 2)) gull(R, d, at, 0.022);
        if (this.due(lv, 'rope', now, 5, 11, 3)) { // 缆绳吱呀
          const dur = rr(0.25, 0.5); const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(rr(150, 220), at); o.frequency.linearRampToValueAtTime(rr(130, 200), at + dur);
          const b = bq(c, 'bandpass', rr(600, 900), 9, gl(0.016, 0.06, dur)); o.connect(b); o.start(at); o.stop(at + dur + 0.1); o.onended = () => { try { o.disconnect(); } catch { /* */ } };
        }
        break;
    }
  }
}
