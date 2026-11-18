/**
 * 乐器合成（全部 WebAudio 代码合成，无素材）。每个函数把一个音“预约”到 at 时刻，
 * 声音结束后节点自动回收（osc.stop + 断开由 onended 完成），不会泄漏。
 */
import { Rig, mtof, rr } from './rig';

type Ctx = BaseAudioContext;

/** 振荡器 + 自动清理 */
function osc(ctx: Ctx, type: OscillatorType, f: number, at: number, end: number, out: AudioNode, detune = 0): OscillatorNode {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, at); if (detune) o.detune.value = detune;
  o.connect(out); o.start(at); o.stop(end + 0.05);
  o.onended = () => { try { o.disconnect(); } catch { /* ignore */ } };
  return o;
}
/** 打击型包络：快起 + 指数衰减 */
function perc(ctx: Ctx, dest: AudioNode, at: number, peak: number, a: number, dec: number): GainNode {
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), at + a);
  g.gain.exponentialRampToValueAtTime(0.0001, at + a + dec);
  g.connect(dest); return g;
}
/** 持续型包络：起音 + 保持 + 释放 */
function sust(ctx: Ctx, dest: AudioNode, at: number, peak: number, a: number, hold: number, rel: number): GainNode {
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), at + a);
  if (hold > 0) g.gain.setValueAtTime(Math.max(0.0002, peak), at + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, at + a + hold + rel);
  g.connect(dest); return g;
}
function noiseSrc(rig: Rig, at: number, dur: number, out: AudioNode, buf: AudioBuffer = rig.noiseW, rate = 1) {
  const s = rig.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
  s.connect(out); s.start(at, rr(0, Math.max(0, buf.duration - 0.2))); s.stop(at + dur + 0.05);
  s.onended = () => { try { s.disconnect(); } catch { /* ignore */ } };
  return s;
}
function biq(ctx: Ctx, type: BiquadFilterType, f: number, q = 0.7, out?: AudioNode): BiquadFilterNode {
  const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (out) b.connect(out); return b;
}

// ———————————————— 打击/拨奏类 ————————————————
/** 钢片琴：基音 + 4 倍音（亮而短）+ 10 倍音点缀 */
export function celesta(rig: Rig, dest: AudioNode, midi: number, at: number, vol = 0.2, ring = 1.5) {
  const c = rig.ctx, f = mtof(midi);
  osc(c, 'sine', f, at, at + ring + 0.1, perc(c, dest, at, vol, 0.003, ring));
  osc(c, 'sine', f * 4, at, at + 0.7, perc(c, dest, at, vol * 0.34, 0.002, 0.45));
  osc(c, 'sine', f * 10.1, at, at + 0.2, perc(c, dest, at, vol * 0.08, 0.001, 0.12));
  osc(c, 'triangle', f * 2, at, at + 0.5, perc(c, dest, at, vol * 0.12, 0.002, 0.3));
}
/** 铃（非谐波部分音）：类似圣诞手铃/ glockenspiel */
export function bell(rig: Rig, dest: AudioNode, midi: number, at: number, vol = 0.15, ring = 2.2) {
  const c = rig.ctx, f = mtof(midi);
  const P: [number, number, number][] = [[1, 1, 1], [2.0, 0.42, 0.7], [2.76, 0.3, 0.5], [5.4, 0.14, 0.28], [8.93, 0.06, 0.15]];
  for (const [r, g, d] of P) { if (f * r > 12000) continue; osc(c, 'sine', f * r, at, at + ring * d + 0.1, perc(c, dest, at, vol * g, 0.002, ring * d)); }
}
/** 吉他拨弦：锯齿 + 低通扫频 + 拨片噪点 */
export function guitar(rig: Rig, dest: AudioNode, midi: number, at: number, vol = 0.14, dec = 0.9) {
  const c = rig.ctx, f = mtof(midi);
  const lp = biq(c, 'lowpass', 3200, 0.6); lp.frequency.setValueAtTime(3200, at); lp.frequency.exponentialRampToValueAtTime(520, at + 0.28);
  const env = perc(c, dest, at, vol, 0.004, dec); lp.connect(env);
  osc(c, 'sawtooth', f, at, at + dec + 0.1, lp); osc(c, 'triangle', f * 2.003, at, at + dec * 0.5 + 0.1, lp, 4);
  // 琴身共鸣
  osc(c, 'sine', f, at, at + dec + 0.1, perc(c, dest, at, vol * 0.5, 0.006, dec * 0.9));
  const hp = biq(c, 'highpass', 3000, 0.7, perc(c, dest, at, vol * 0.18, 0.001, 0.02)); noiseSrc(rig, at, 0.03, hp);
}
/** 小提琴拨弦（阿福）：更脆更短 */
export function pizz(rig: Rig, dest: AudioNode, midi: number, at: number, vol = 0.16) {
  const c = rig.ctx, f = mtof(midi);
  const lp = biq(c, 'lowpass', 4600, 0.7); lp.frequency.setValueAtTime(4600, at); lp.frequency.exponentialRampToValueAtTime(900, at + 0.12);
  lp.connect(perc(c, dest, at, vol, 0.002, 0.34));
  osc(c, 'sawtooth', f, at, at + 0.4, lp); osc(c, 'triangle', f, at, at + 0.4, lp, -5);
  const hp = biq(c, 'bandpass', 2400, 1.2, perc(c, dest, at, vol * 0.22, 0.001, 0.03)); noiseSrc(rig, at, 0.04, hp);
}
/** 低音（圆润的正弦 + 三角） */
export function bass(rig: Rig, dest: AudioNode, midi: number, at: number, vol = 0.22, dur = 0.7) {
  const c = rig.ctx, f = mtof(midi);
  const lp = biq(c, 'lowpass', 520, 0.7, perc(c, dest, at, vol, 0.012, dur));
  osc(c, 'triangle', f, at, at + dur + 0.1, lp); osc(c, 'sine', f, at, at + dur + 0.1, lp);
  osc(c, 'sine', f * 2, at, at + 0.3, perc(c, dest, at, vol * 0.18, 0.01, 0.2));
}
export function kick(rig: Rig, dest: AudioNode, at: number, vol = 0.3) {
  const c = rig.ctx; const o = c.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(130, at); o.frequency.exponentialRampToValueAtTime(46, at + 0.14);
  o.connect(perc(c, dest, at, vol, 0.004, 0.2)); o.start(at); o.stop(at + 0.3); o.onended = () => { try { o.disconnect(); } catch { /* */ } };
}
export function shaker(rig: Rig, dest: AudioNode, at: number, vol = 0.07, len = 0.07) {
  const hp = biq(rig.ctx, 'bandpass', 6800, 1.3, perc(rig.ctx, dest, at, vol, 0.006, len)); noiseSrc(rig, at, len + 0.02, hp);
}
export function woodblock(rig: Rig, dest: AudioNode, at: number, vol = 0.12, f = 900) {
  const c = rig.ctx; osc(c, 'triangle', f, at, at + 0.1, perc(c, dest, at, vol, 0.001, 0.07)); osc(c, 'sine', f * 1.5, at, at + 0.05, perc(c, dest, at, vol * 0.4, 0.001, 0.03));
}
export function snare(rig: Rig, dest: AudioNode, at: number, vol = 0.18) {
  const c = rig.ctx; const hp = biq(c, 'highpass', 1800, 0.7, perc(c, dest, at, vol, 0.002, 0.13)); noiseSrc(rig, at, 0.15, hp);
  osc(c, 'triangle', 190, at, at + 0.1, perc(c, dest, at, vol * 0.5, 0.002, 0.08));
}
export function tom(rig: Rig, dest: AudioNode, at: number, f = 110, vol = 0.22) {
  const c = rig.ctx; const o = c.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(f * 1.6, at); o.frequency.exponentialRampToValueAtTime(f, at + 0.1);
  o.connect(perc(c, dest, at, vol, 0.003, 0.28)); o.start(at); o.stop(at + 0.4); o.onended = () => { try { o.disconnect(); } catch { /* */ } };
}
/** 雪橇铃：多个高频谐波随机错落 */
export function sleighBells(rig: Rig, dest: AudioNode, at: number, vol = 0.07, n = 3) {
  for (let i = 0; i < n; i++) bell(rig, dest, 96 + Math.floor(rr(0, 3)) * 2, at + i * 0.045 + rr(0, 0.01), vol * rr(0.6, 1), 0.4);
}

// ———————————————— 持续音类 ————————————————
/** 弦乐垫：每个音两把锯齿略失谐 + 低通；起音慢、释放慢 */
export function strings(rig: Rig, dest: AudioNode, midis: number[], at: number, dur: number, vol = 0.05) {
  const c = rig.ctx;
  for (const m of midis) {
    const f = mtof(m);
    const lp = biq(c, 'lowpass', 1400, 0.4);
    const env = sust(c, dest, at, vol, Math.min(0.7, dur * 0.4), Math.max(0, dur - 0.7 - Math.min(0.7, dur * 0.4)), 0.9); lp.connect(env);
    const end = at + dur + 1;
    osc(c, 'sawtooth', f, at, end, lp, -8); osc(c, 'sawtooth', f, at, end, lp, 8);
  }
}
/** 童声哼唱：锯齿声源 + 双共振峰（m=闭口哼鸣 / a=la 张口 / o） */
export function hum(rig: Rig, dest: AudioNode, midi: number, at: number, dur: number, vol = 0.12, vowel: 'm' | 'a' | 'o' = 'm') {
  const c = rig.ctx, f = mtof(midi);
  const F: Record<string, [number, number]> = { m: [300, 950], a: [800, 1250], o: [500, 900] };
  const [f1, f2] = F[vowel];
  const env = sust(c, dest, at, vol, 0.06, Math.max(0, dur - 0.22), 0.2);
  const sum = c.createGain(); sum.gain.value = 1; sum.connect(env);
  const src = c.createGain(); src.gain.value = 1;
  const o1 = osc(c, 'sawtooth', f, at, at + dur + 0.3, src); o1.detune.setValueAtTime(-18, at); o1.detune.linearRampToValueAtTime(0, at + 0.08);
  // 颤音：延迟起振
  const lfo = c.createOscillator(); lfo.frequency.value = 5.4; const lg = c.createGain(); lg.gain.setValueAtTime(0, at); lg.gain.linearRampToValueAtTime(14, at + Math.min(0.5, dur));
  lfo.connect(lg); lg.connect(o1.detune); lfo.start(at); lfo.stop(at + dur + 0.3); lfo.onended = () => { try { lfo.disconnect(); lg.disconnect(); } catch { /* */ } };
  // 两个共振峰（l→a：f1 从 400 升到目标）
  const b1 = biq(c, 'bandpass', vowel === 'a' ? 420 : f1, 5, undefined); if (vowel === 'a') b1.frequency.linearRampToValueAtTime(f1, at + 0.12);
  const b2 = biq(c, 'bandpass', f2, 7);
  const g1 = c.createGain(); g1.gain.value = 1.4; const g2 = c.createGain(); g2.gain.value = 0.9;
  src.connect(b1); b1.connect(g1); g1.connect(sum); src.connect(b2); b2.connect(g2); g2.connect(sum);
  osc(c, 'sine', f, at, at + dur + 0.3, (() => { const g = c.createGain(); g.gain.value = 0.35; g.connect(sum); return g; })());
  // 轻微气声
  const hp = biq(c, 'bandpass', 4500, 1, perc(c, sum, at, 0.04, 0.02, Math.min(0.2, dur))); noiseSrc(rig, at, 0.25, hp);
}
let oddWave: PeriodicWave | null = null; let oddCtx: BaseAudioContext | null = null;
function oddHarmonics(c: BaseAudioContext): PeriodicWave {
  if (oddWave && oddCtx === c) return oddWave;
  const N = 24; const re = new Float32Array(N), im = new Float32Array(N);
  for (let n = 1; n < N; n += 2) im[n] = 1 / n; // 奇次谐波：类单簧管
  oddWave = c.createPeriodicWave(re, im); oddCtx = c; return oddWave;
}
/** 低音木管（单簧管/巴松感）：奇次谐波 + 低通 + 慢起音 + 颤音 */
export function wood(rig: Rig, dest: AudioNode, midi: number, at: number, dur: number, vol = 0.15) {
  const c = rig.ctx, f = mtof(midi);
  const lp = biq(c, 'lowpass', 1100, 0.9); const env = sust(c, dest, at, vol, 0.09, Math.max(0, dur - 0.3), 0.25); lp.connect(env);
  const o = c.createOscillator(); o.setPeriodicWave(oddHarmonics(c)); o.frequency.value = f; o.connect(lp); o.start(at); o.stop(at + dur + 0.4);
  o.onended = () => { try { o.disconnect(); } catch { /* */ } };
  const lfo = c.createOscillator(); lfo.frequency.value = 4.6; const lg = c.createGain(); lg.gain.setValueAtTime(0, at); lg.gain.linearRampToValueAtTime(8, at + 0.5);
  lfo.connect(lg); lg.connect(o.detune); lfo.start(at); lfo.stop(at + dur + 0.4); lfo.onended = () => { try { lfo.disconnect(); lg.disconnect(); } catch { /* */ } };
  osc(c, 'sine', f / 2, at, at + dur + 0.4, perc(c, dest, at, vol * 0.25, 0.09, dur)); // 暖色低八度
  const hp = biq(c, 'bandpass', 2200, 1, perc(c, dest, at, vol * 0.05, 0.02, 0.12)); noiseSrc(rig, at, 0.2, hp);
}
/** 钢琴（小蓝）：三个部分音 + 琴槌 + 随音高变化的衰减 */
export function piano(rig: Rig, dest: AudioNode, midi: number, at: number, vol = 0.16, dur = 1.6) {
  const c = rig.ctx, f = mtof(midi); const dec = Math.max(0.5, Math.min(2.6, dur * 1.3, 4.5 - midi / 24));
  osc(c, 'sine', f, at, at + dec + 0.1, perc(c, dest, at, vol, 0.004, dec));
  osc(c, 'triangle', f * 2.001, at, at + dec * 0.6 + 0.1, perc(c, dest, at, vol * 0.4, 0.003, dec * 0.6));
  osc(c, 'sine', f * 3.003, at, at + dec * 0.4 + 0.1, perc(c, dest, at, vol * 0.18, 0.003, dec * 0.4));
  osc(c, 'sine', f * 4.01, at, at + dec * 0.2 + 0.1, perc(c, dest, at, vol * 0.08, 0.002, dec * 0.2));
  const bp = biq(c, 'bandpass', Math.min(5000, f * 5), 1.2, perc(c, dest, at, vol * 0.2, 0.001, 0.025)); noiseSrc(rig, at, 0.04, bp);
}
/** 小号（阿冬）：锯齿 + 低通随起音打开 */
export function trumpet(rig: Rig, dest: AudioNode, midi: number, at: number, dur: number, vol = 0.12) {
  const c = rig.ctx, f = mtof(midi);
  const lp = biq(c, 'lowpass', 700, 1.1); lp.frequency.setValueAtTime(700, at); lp.frequency.exponentialRampToValueAtTime(3600, at + 0.06); lp.frequency.exponentialRampToValueAtTime(2200, at + Math.max(0.12, dur));
  const pk = biq(c, 'peaking', 1300, 1.2); pk.gain.value = 6; lp.connect(pk);
  pk.connect(sust(c, dest, at, vol, 0.03, Math.max(0, dur - 0.18), 0.14));
  const o1 = osc(c, 'sawtooth', f, at, at + dur + 0.25, lp); osc(c, 'square', f, at, at + dur + 0.25, lp, 3);
  o1.detune.setValueAtTime(-30, at); o1.detune.linearRampToValueAtTime(0, at + 0.05);
}
/** 合唱（终章）：每个音 3 把锯齿失谐 + “啊”共振峰 */
export function choir(rig: Rig, dest: AudioNode, midis: number[], at: number, dur: number, vol = 0.06) {
  const c = rig.ctx; const a = Math.min(0.8, dur * 0.35);
  const out = sust(c, dest, at, vol, a, Math.max(0, dur - a - 0.4), 1.0);
  const sum = c.createGain(); sum.gain.value = 1; sum.connect(out);
  const form = biq(c, 'peaking', 700, 2); form.gain.value = 8; const form2 = biq(c, 'peaking', 1100, 2); form2.gain.value = 5;
  const lp = biq(c, 'lowpass', 2800, 0.5); form.connect(form2); form2.connect(lp); lp.connect(sum);
  const lfo = c.createOscillator(); lfo.frequency.value = 4.9; const lg = c.createGain(); lg.gain.value = 9; lfo.connect(lg);
  const end = at + dur + 1.2; lfo.start(at); lfo.stop(end); lfo.onended = () => { try { lfo.disconnect(); lg.disconnect(); } catch { /* */ } };
  for (const m of midis) {
    const f = mtof(m);
    for (const d of [-10, 0, 10]) { const o = osc(c, 'sawtooth', f, at, end, form, d); lg.connect(o.detune); }
  }
}

// ———————————————— 追加：音乐需求 cue 用的乐器（docs/06 音乐需求）————————————————
/** 手风琴（老周）：每个音 2 把轻微失谐的方波/锯齿 + 颤音 + 簧片带通，可以多个音同时按下（和弦） */
export function accordion(rig: Rig, dest: AudioNode, midis: number[], at: number, dur: number, vol = 0.07, bright = 1) {
  const c = rig.ctx;
  const out = sust(c, dest, at, vol, 0.08, Math.max(0, dur - 0.3), 0.22);
  const lp = biq(c, 'lowpass', 2200 * bright, 0.7, out); const body = biq(c, 'peaking', 900, 1.2, lp); body.gain.value = 5;
  const trem = c.createGain(); trem.gain.value = 1; trem.connect(body);
  const lfo = c.createOscillator(); lfo.frequency.value = 5.6; const lg = c.createGain(); lg.gain.value = 0.12; lfo.connect(lg); lg.connect(trem.gain);
  lfo.start(at); lfo.stop(at + dur + 0.5); lfo.onended = () => { try { lfo.disconnect(); lg.disconnect(); } catch { /* */ } };
  const per = 1 / Math.sqrt(Math.max(1, midis.length));
  for (const m of midis) {
    const f = mtof(m); const g = c.createGain(); g.gain.value = per; g.connect(trem);
    osc(c, 'sawtooth', f, at, at + dur + 0.4, g, -7); osc(c, 'square', f, at, at + dur + 0.4, g, 6);
  }
  const hp = biq(c, 'bandpass', 2500, 1, perc(c, dest, at, vol * 0.1, 0.01, 0.12)); noiseSrc(rig, at, 0.18, hp); // 风箱“噗”
}
/** 竹笛：基音 + 轻微 2 倍音 + 气声，慢起音与颤音 */
export function flute(rig: Rig, dest: AudioNode, midi: number, at: number, dur: number, vol = 0.08) {
  const c = rig.ctx, f = mtof(midi);
  const env = sust(c, dest, at, vol, 0.12, Math.max(0, dur - 0.4), 0.3);
  const o = osc(c, 'sine', f, at, at + dur + 0.4, env); osc(c, 'sine', f * 2, at, at + dur + 0.4, perc(c, env, at, 0.12, 0.2, dur));
  const lfo = c.createOscillator(); lfo.frequency.value = 5.2; const lg = c.createGain(); lg.gain.setValueAtTime(0, at); lg.gain.linearRampToValueAtTime(10, at + 0.7);
  lfo.connect(lg); lg.connect(o.detune); lfo.start(at); lfo.stop(at + dur + 0.4); lfo.onended = () => { try { lfo.disconnect(); lg.disconnect(); } catch { /* */ } };
  const bp = biq(c, 'bandpass', Math.min(6000, f * 3), 1.4, sust(c, dest, at, vol * 0.1, 0.1, Math.max(0, dur - 0.3), 0.2)); noiseSrc(rig, at, dur + 0.4, bp);
}
/** 远处鸟鸣：两三个快速上扬的小啾 */
export function chirp(rig: Rig, dest: AudioNode, at: number, vol = 0.03) {
  const c = rig.ctx; const n = 2 + Math.floor(rr(0, 3)); const f = rr(2600, 3600);
  for (let i = 0; i < n; i++) {
    const t = at + i * rr(0.09, 0.14); const g = perc(c, dest, t, vol, 0.01, 0.07);
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.45, t + 0.06); o.connect(g);
    o.start(t); o.stop(t + 0.12); o.onended = () => { try { o.disconnect(); } catch { /* */ } };
  }
}
/** 古筝：三角波拨弦 + 泛音 + 拨后上滑（“滑音”）；harmonic=true 为泛音（更空灵） */
export function guzheng(rig: Rig, dest: AudioNode, midi: number, at: number, vol = 0.1, harmonic = false) {
  const c = rig.ctx, f = mtof(midi) * (harmonic ? 2 : 1);
  const g = perc(c, dest, at, vol, 0.003, harmonic ? 1.6 : 1.1);
  const o = c.createOscillator(); o.type = harmonic ? 'sine' : 'triangle'; o.frequency.setValueAtTime(harmonic ? f : f * 0.97, at); if (!harmonic) o.frequency.exponentialRampToValueAtTime(f, at + 0.06);
  o.connect(g); o.start(at); o.stop(at + 1.8); o.onended = () => { try { o.disconnect(); } catch { /* */ } };
  osc(c, 'sine', f * 3.01, at, at + 0.5, perc(c, dest, at, vol * 0.25, 0.002, 0.3));
}
/** 八音盒：高频短促的金属梳齿 + 轻微失谐 */
export function musicBox(rig: Rig, dest: AudioNode, midi: number, at: number, vol = 0.1) {
  const c = rig.ctx, f = mtof(midi);
  osc(c, 'sine', f, at, at + 1.2, perc(c, dest, at, vol, 0.002, 1.1), rr(-6, 6));
  osc(c, 'sine', f * 5.4, at, at + 0.3, perc(c, dest, at, vol * 0.3, 0.001, 0.2));
  osc(c, 'triangle', f * 2.01, at, at + 0.5, perc(c, dest, at, vol * 0.25, 0.002, 0.35));
  const hp = biq(c, 'highpass', 5000, 0.7, perc(c, dest, at, vol * 0.1, 0.001, 0.02)); noiseSrc(rig, at, 0.04, hp);
}
/** 滑稽长号：下滑音（第一炉烤焦） */
export function trombone(rig: Rig, dest: AudioNode, midi: number, at: number, dur: number, vol = 0.12, slide = -5) {
  const c = rig.ctx, f = mtof(midi);
  const lp = biq(c, 'lowpass', 1100, 0.9); const out = sust(c, dest, at, vol, 0.05, Math.max(0, dur - 0.25), 0.2); lp.connect(out);
  const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, at + dur * 0.35); o.frequency.exponentialRampToValueAtTime(f * Math.pow(2, slide / 12), at + dur);
  o.connect(lp); o.start(at); o.stop(at + dur + 0.3); o.onended = () => { try { o.disconnect(); } catch { /* */ } };
}
