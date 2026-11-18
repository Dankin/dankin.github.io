/**
 * 音频自检（浏览器内运行；OfflineAudioContext 渲染，不发声）。
 * 用法（给 qa）：
 *   控制台:  await (await import('/src/audio/selftest.ts')).runSelfTest()      // dev server 下
 *   或:      await window.__audioSelfTest()                                    // 本模块被 import 后可用
 *   或:      await audio.selfTest()                                            // 经 src/core/audio.ts 动态加载
 * 返回 Report，同时 console.table 打印；report.ok === false 时看 report.failures。
 *
 * 检查项（阈值）：峰值 < 0.95；无 NaN/Infinity；直流偏移 < 0.02；各层/音效不是静音（RMS > -70 dBFS）；
 *   叠加最坏情形（满层音乐 + 区域氛围 + 天气 + 全部音效同时触发）峰值仍 < 0.95；循环缝合（loop seam）无爆点；乐理表无冲突。
 */
import { Rig, seedRandom } from './rig';
import { LAYER_NAMES, LayerName, Music } from './music';
import { SFX_IDS, Sfx } from './sfx';
import { Cues, CUE_NAMES } from './cues';
import { Ambience, REGIONS } from './ambience';
import { STORY_IDS, validateTheory } from './theory';

export interface Row { group: string; name: string; seconds: number; peak: number; rmsDb: number; peakDb: number; nan: number; dc: number; ok: boolean; note?: string }
export interface Report { ok: boolean; rows: Row[]; failures: string[]; warnings: string[]; theory: ReturnType<typeof validateTheory>; seam: { jump: number; typical: number; ok: boolean } | null; ms: number }

const SR = 22050; // 自检用较低采样率，加快渲染；合成逻辑与采样率无关
const PEAK_LIMIT = 0.95;
const db = (x: number) => (x <= 1e-9 ? -180 : 20 * Math.log10(x));

type Setup = (c: OfflineAudioContext, rig: Rig) => void | (() => void);
async function render(seconds: number, setup: Setup, opts: { bypassLimiter?: boolean } = {}): Promise<Float32Array[]> {
  const c = new OfflineAudioContext(2, Math.ceil(seconds * SR), SR);
  const rig = new Rig(c, { bypassLimiter: opts.bypassLimiter });
  const cleanup = setup(c, rig);
  const buf = await c.startRendering();
  if (cleanup) cleanup();
  return [buf.getChannelData(0), buf.getChannelData(1)];
}
function stats(ch: Float32Array[]) {
  let peak = 0, sum = 0, n = 0, nan = 0, dc = 0;
  for (const d of ch) for (let i = 0; i < d.length; i++) { const v = d[i]; if (!Number.isFinite(v)) { nan++; continue; } const a = Math.abs(v); if (a > peak) peak = a; sum += v * v; dc += v; n++; }
  return { peak, rms: Math.sqrt(sum / Math.max(1, n)), nan, dc: Math.abs(dc / Math.max(1, n)) };
}
function row(group: string, name: string, seconds: number, ch: Float32Array[], extra: { quiet?: boolean; minRmsDb?: number } = {}): Row {
  const s = stats(ch); const minDb = extra.minRmsDb ?? -70;
  const bad = s.nan > 0 || s.peak >= PEAK_LIMIT || s.dc > 0.02 || db(s.rms) < minDb;
  const note = s.nan ? 'NaN!' : s.peak >= PEAK_LIMIT ? 'clip' : s.dc > 0.02 ? 'DC' : db(s.rms) < minDb ? 'silent' : undefined;
  return { group, name, seconds: +seconds.toFixed(2), peak: +s.peak.toFixed(3), peakDb: +db(s.peak).toFixed(1), rmsDb: +db(s.rms).toFixed(1), nan: s.nan, dc: +s.dc.toFixed(4), ok: !bad, note };
}

/** 起一套音乐（离线）：mutate(m) 设置层/故事，再调度 bars 小节 */
function musicSetup(bars: number, mutate: (m: Music) => void, tempo = 1): Setup {
  return (c, rig) => {
    const m = new Music(rig); m.tempoMul = tempo; mutate(m); m.refreshLayers(true);
    m.resetClock(0.05); m.scheduleUntil(0.05 + bars * m.barSeconds);
  };
}

export async function runSelfTest(o: { quick?: boolean; log?: boolean } = {}): Promise<Report> {
  const t0 = performance.now(); const rows: Row[] = []; const failures: string[] = []; const warnings: string[] = [];
  const log = o.log !== false;
  seedRandom(20261225); // 固定随机，保证可复现
  const full = new Music(new Rig(new OfflineAudioContext(1, 1, SR)));
  const bar = full.barSeconds; const tail = 2.5;

  // 1) 乐理表
  const theory = validateTheory(); if (!theory.ok) failures.push('theory: ' + theory.issues.join('; '));

  // 2) 每层单独（16 小节）：响度报告
  const BARS_L = o.quick ? 4 : 16;
  for (const L of LAYER_NAMES) {
    const sec = BARS_L * bar + tail;
    const ch = await render(sec, musicSetup(BARS_L, (m) => { m.forceLayers = [L as LayerName]; if (L === 'motif') STORY_IDS.forEach((s) => m.done.add(s)); }));
    rows.push(row('layer', L, sec, ch, { minRmsDb: L === 'motif' ? -85 : -70 }));
  }
  // 3) 等级 0..5 + 终章 混合
  for (let lv = 0; lv <= 5; lv++) {
    const sec = BARS_L * bar + tail;
    const ch = await render(sec, musicSetup(BARS_L, (m) => { m.baseLayer = lv; STORY_IDS.slice(0, lv).forEach((s) => m.done.add(s)); }));
    rows.push(row('mix', `level ${lv}`, sec, ch));
  }
  {
    const sec = BARS_L * bar + tail;
    const ch = await render(sec, musicSetup(BARS_L, (m) => { STORY_IDS.forEach((s) => m.done.add(s)); m.done.add('finale'); m.finale = true; }));
    rows.push(row('mix', 'finale (all layers)', sec, ch));
  }
  // 4) 一次性：动机、完成、sting、尾声
  for (const id of [...STORY_IDS, 'finale'] as const) {
    const ch = await render(8, (c, rig) => { const m = new Music(rig); m.storyMotif(id); });
    rows.push(row('motif', id, 8, ch, { minRmsDb: -80 }));
    const ch2 = await render(id === 'finale' ? 16 : 5, (c, rig) => { const m = new Music(rig); m.storyDone(id); m.stop(); });
    rows.push(row('storyDone', id, id === 'finale' ? 16 : 5, ch2));
  }
  for (const s of ['start', 'hint', 'fail', 'win'] as const) { const ch = await render(3, (c, rig) => new Music(rig).sting(s)); rows.push(row('sting', s, 3, ch)); }

  // 5) 每个 SFX（含不同参数）
  const sfxCases: Array<[string, number | string | undefined]> = SFX_IDS.map((id) => [id, undefined]);
  for (const mat of ['grass', 'snow', 'wood', 'stone', 'sand', 'carpet']) sfxCases.push(['step', mat]);
  sfxCases.push(['warm', 5], ['warm', 50], ['warm', 95], ['blip', 880]);
  for (const [id, p] of sfxCases) {
    const L = new Sfx(new Rig(new OfflineAudioContext(1, 1, SR))).len(id) + 0.8;
    const ch = await render(L, (c, rig) => { const s = new Sfx(rig); s.play(id, p, { force: true }); });
    rows.push(row('sfx', p === undefined ? id : `${id}:${p}`, L, ch));
  }
  // 5b) 限流：1 秒内对 step/pop 连发 40 次，实际发声数应远小于 40，且不爆
  {
    let played = 0;
    const ch = await render(2.5, (c, rig) => {
      const s = new Sfx(rig);
      // 离线时钟不走，用 force:false + 手动推进“假时间”：直接统计 recent 窗口（8/250ms）
      for (let i = 0; i < 40; i++) if (s.play(i % 2 ? 'pop' : 'step', 'stone')) played++;
    });
    const r = row('sfx', 'throttle burst x40', 2.5, ch); r.note = `played ${played}/40`; if (played > 8) { r.ok = false; r.note += ' (限流失效)'; } rows.push(r);
  }

  // 6) 区域氛围与天气
  const AMB_S = o.quick ? 12 : 30;
  for (const r of REGIONS) {
    const ch = await render(AMB_S, (c, rig) => { const a = new Ambience(rig); a.setRegion(r); a.simulate(AMB_S); return () => a.stopAll(); });
    rows.push(row('region', r, AMB_S, ch));
  }
  for (const [name, w] of [['rain', { rain: 1.2 }], ['snow', { snow: 1.5 }], ['wind', { wind: 1 }], ['storm', { rain: 1.5, wind: 1.5, snow: 1 }]] as const) {
    const ch = await render(10, (c, rig) => { const a = new Ambience(rig); a.setWeather(w); a.simulate(10); return () => a.stopAll(); });
    rows.push(row('weather', name, 10, ch));
  }

  // 7) 最坏叠加：满层音乐 + 码头氛围 + 暴风雨 + 全部音效同一瞬间（force）
  {
    const sec = 8; const sf = SFX_IDS;
    const ch = await render(sec, (c, rig) => {
      const m = new Music(rig); STORY_IDS.forEach((s) => m.done.add(s)); m.done.add('finale'); m.finale = true; m.refreshLayers(true); m.resetClock(0.05); m.scheduleUntil(sec);
      const a = new Ambience(rig); a.setRegion('dock'); a.setWeather({ rain: 1.5, wind: 1.5, snow: 1 }); a.simulate(sec);
      const s = new Sfx(rig); for (const id of sf) s.play(id, undefined, { force: true });
      m.storyMotif('adong'); m.sting('win');
      return () => a.stopAll();
    });
    rows.push(row('worst', 'everything at once', sec, ch));
  }
  // 7b) 不开限幅器时的原始峰值（仅报告：说明压缩器+软限幅确有作用）
  {
    const ch = await render(6, (c, rig) => { const s = new Sfx(rig); for (const id of ['blast', 'tree', 'chime', 'cheer', 'sparkle', 'door']) s.play(id, undefined, { force: true }); }, { bypassLimiter: true });
    const r = row('worst', 'sfx pile (limiter bypassed)', 6, ch); r.ok = r.nan === 0; r.note = (r.note ? r.note + ' ' : '') + '仅报告'; rows.push(r);
  }

  // 7b) cue：同步模式把整段排进离线渲染，查峰值/NaN（长 cue 渲染其前 N 秒）
  {
    const cueSec: Record<string, number> = { adong_theme: 12, xiaolan_theme: 14, xiaomi_theme: 14, afu_theme: 12, laozhou_theme: 12, finale: 40, finale_coda: 28, lullaby_radio: 13 };
    for (const name of CUE_NAMES) {
      if (name === 'theme_stop' || name === 'lullaby_stop' || name.startsWith('egg')) continue;
      if (o.quick && !['phase_noon', 'adong_theme', 'finale', 'lullaby_radio', 'bread_scent', 'xiaolan_melt'].includes(name)) continue;
      const sec = cueSec[name] ?? (name.startsWith('phase_') || name === 'epilogue' || name === 'night_sandbox' ? 12 : 6);
      const ch = await render(sec, (c, rig) => {
        const m = new Music(rig), s = new Sfx(rig), cu = new Cues(rig, m, s); cu.sync = true;
        m.baseLayer = name === 'finale' || name === 'finale_coda' ? 5 : 2; m.refreshLayers(true);
        if (name === 'finale' || name === 'finale_coda') STORY_IDS.forEach((x) => m.done.add(x));
        cu.cue(name); m.resetClock(0.05); m.scheduleUntil(sec + 0.2);   // 先应用 cue（改层/调式/配色），再排音乐步
        return () => cu.dispose();
      });
      rows.push(row('cue', name, sec, ch, { minRmsDb: -90 }));
    }
  }

  // 8) 循环缝合：4 倍速渲染 2 个循环，检查缝处一阶差分是否出现爆点
  let seam: Report['seam'] = null;
  {
    const tempo = 4; const loopSec = full.loopSeconds / tempo; const total = loopSec * 2 + 1;
    const ch = await render(total, (c, rig) => { const m = new Music(rig); m.tempoMul = tempo; m.baseLayer = 5; m.refreshLayers(true); m.resetClock(0.05); m.scheduleUntil(0.05 + loopSec * 2); });
    const d = ch[0]; const seamIdx = Math.round((0.05 + loopSec) * SR); const w = Math.round(0.05 * SR);
    let jump = 0, typical = 0;
    for (let i = seamIdx - w; i < seamIdx + w; i++) jump = Math.max(jump, Math.abs(d[i] - d[i - 1]));
    const diffs: number[] = []; for (let i = Math.round(SR * 0.5); i < seamIdx - 2 * w; i += 7) diffs.push(Math.abs(d[i] - d[i - 1]));
    diffs.sort((a, b) => a - b); typical = diffs[Math.floor(diffs.length * 0.999)] || 0.01;
    seam = { jump: +jump.toFixed(4), typical: +typical.toFixed(4), ok: jump <= Math.max(typical * 1.6, 0.05) };
    if (!seam.ok) warnings.push(`loop seam: 缝处最大一阶差分 ${seam.jump} > 典型 ${seam.typical}×1.6`);
  }

  for (const r of rows) if (!r.ok) failures.push(`${r.group}/${r.name}: ${r.note ?? 'fail'} (peak ${r.peak}, rms ${r.rmsDb} dB)`);
  // 响度平衡提示：音乐满混应比单个 sfx 峰值低（sfx 要“压得过”音乐）
  const mixFull = rows.find((r) => r.name === 'finale (all layers)'); const sfxBlast = rows.find((r) => r.group === 'sfx' && r.name === 'blast');
  if (mixFull && sfxBlast && mixFull.rmsDb > -14) warnings.push(`满混音乐 RMS ${mixFull.rmsDb} dB 偏响（>-14）`);
  if (mixFull && mixFull.rmsDb < -38) warnings.push(`满混音乐 RMS ${mixFull.rmsDb} dB 偏轻（<-38）`);
  const rep: Report = { ok: failures.length === 0, rows, failures, warnings, theory, seam, ms: Math.round(performance.now() - t0) };
  seedRandom(null);
  if (log) {
    console.log(`[audio selftest] ${rep.ok ? 'PASS' : 'FAIL'} in ${rep.ms} ms  rows=${rows.length}`);
    console.table(rows.map((r) => ({ group: r.group, name: r.name, sec: r.seconds, peak: r.peak, 'peak dB': r.peakDb, 'rms dB': r.rmsDb, nan: r.nan, ok: r.ok ? '✓' : '✗', note: r.note ?? '' })));
    if (failures.length) console.warn('failures:', failures); if (warnings.length) console.warn('warnings:', warnings);
    console.log('theory:', theory.ok ? 'OK (C/G major, motifs clash-free)' : theory.issues, 'seam:', seam);
  }
  return rep;
}

if (typeof window !== 'undefined') (window as unknown as { __audioSelfTest?: typeof runSelfTest }).__audioSelfTest = runSelfTest;
