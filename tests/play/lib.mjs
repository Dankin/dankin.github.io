/**
 * 真实试玩（play-test）工具：只用真实鼠标点击推进；__qa 仅用于读取状态。
 * 在页面内装“录像机”：记录每条新出现的可见文字（NPC 台词/toast/横幅）、故事步骤、提示档位、清单、NPC 状态变化，均带游戏时间。
 */
process.env.QA_URL ??= 'http://127.0.0.1:5299';
const { Session, sleep } = await import('../lib/session.mjs');
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
export { sleep, Session };

export const OUT = new URL('../out/play/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

export const REC_SRC = () => {
  if (window.__rec) return;
  const rec = window.__rec = { texts: [], events: [], seen: new Set(), last: { stories: {}, tiers: {}, check: [], npc: {}, phase: null, region: null }, t0: performance.now() };
  setInterval(() => {
    const q = window.__qa; if (!q) return;
    let st; try { st = q.state(); } catch { return; }
    if (!st || !st.ready) return;
    const now = st.now;
    // 文字
    let vt = []; try { vt = q.visibleTexts(); } catch {}
    const cur = new Set(vt);
    for (const tx of cur) if (!rec.seen.has(tx)) { rec.seen.add(tx); rec.texts.push({ now, wall: Math.round((performance.now() - rec.t0) / 100) / 10, tx, hat: [st.hat?.x, st.hat?.y], region: st.region }); }
    for (const k of [...rec.seen]) if (!cur.has(k)) rec.seen.delete(k);
    const ev = (k, v) => rec.events.push({ now, wall: Math.round((performance.now() - rec.t0) / 100) / 10, k, v });
    if (st.phase !== rec.last.phase) { ev('phase', st.phase); rec.last.phase = st.phase; }
    if (st.region !== rec.last.region) { ev('region', st.region); rec.last.region = st.region; }
    for (const [id, s] of Object.entries(st.stories || {})) {
      const sig = s.done.join('>') + '|' + s.current + '|' + s.finished;
      if (rec.last.stories[id] !== sig) { ev('story', `${id}: [${s.done.join(',')}] cur=${s.current} fin=${s.finished}`); rec.last.stories[id] = sig; }
      const tier = s.hintTier;
      if (tier !== rec.last.tiers[id]) { if (tier >= 0) ev('hint', `${id}/${s.current} tier${tier} -> ${s.hint?.prop}/${s.hint?.move}`); rec.last.tiers[id] = tier; }
    }
    const cl = st.checklist || [];
    for (const c of cl) if (!rec.last.check.includes(c)) ev('check', c);
    rec.last.check = cl;
    for (const [id, n] of Object.entries(st.npcs || {})) {
      if (rec.last.npc[id] !== n.state) { if (['afu','laozhou','doudou','xiaolan','adong','xiaomi','mrs_ellis'].includes(id) || true) ev('npc', `${id}:${rec.last.npc[id]}->${n.state}@${n.x},${n.y}`); rec.last.npc[id] = n.state; }
    }
  }, 200);
};

export class Play {
  constructor(name) { this.name = name; this.logf = join(OUT, `${name}.log`); writeFileSync(this.logf, ''); this.t0 = Date.now(); this.notes = []; }
  static async launch(name, { fresh = true, query = '' } = {}) {
    const p = new Play(name);
    p.s = await Session.launch({ device: 'desktop', name, outDir: join(OUT, name) });
    await p.s.goto({ fresh, query });
    await p.installRec();
    return p;
  }
  async installRec() { await this.s.page.evaluate(REC_SRC); }
  log(...a) { const l = `[${((Date.now() - this.t0) / 1000).toFixed(0).padStart(4)}s] ${a.join(' ')}`; console.log(l); appendFileSync(this.logf, l + '\n'); }
  async rec() { return this.s.page.evaluate(() => ({ texts: window.__rec.texts, events: window.__rec.events })); }
  async dump(file = this.name + '.rec.json') { const r = await this.rec(); writeFileSync(join(OUT, file), JSON.stringify(r, null, 1)); return r; }
  get st() { return this.s.state(); }
  /** 等待游戏 now 过 sec 秒（真实时间，只等不点） */
  async idle(sec) { await sleep(sec * 1000); }
  async shot(n) { return this.s.shot(n); }
  /** 使用招式：附身 + 点按钮，返回是否成功 + 前后清单/步骤差 */
  async move(prop, move) {
    const b = await this.s.state();
    await this.s.useMove(prop, move);
    return b;
  }
  async waitDone(story, timeoutMs = 60000) { return this.s.waitState(`s=>s.stories[${JSON.stringify(story)}]?.finished`, { timeout: timeoutMs, msg: story + ' done' }); }
  async waitStepDone(story, step, timeoutMs = 60000) { return this.s.waitStep(story, step, { timeout: timeoutMs }); }
  async close() { await this.dump().catch(() => {}); await this.s.close(); }
}

/** 玩家动作：必要时先飞到物件附近（真实点击地面），再点物件+招式 */
export async function go(p, prop, move, { retries = 3 } = {}) {
  const s = p.s;
  for (let i = 0; i < retries; i++) {
    const st0 = await s.state();
    if (st0.locked || st0.seqRunning) await s.waitIdle({ timeout: 120000 }).catch(() => {});
    const pt = await s.qa('propPoint', prop);
    if (!pt.onScreen || !s.insideMargin(pt, 20)) {
      const def = (await s.qa('data')).props[prop];
      const dy = [1.5, 3, 4.5][i % 3];   // 物件贴图较高时落点会被物件自身遮住 → 逐次加大偏移
      await s.flyTo(def.pos[0], def.pos[1] + dy, { timeout: 40000 }).catch(() => {});
    }
    try { await s.useMove(prop, move); return true; }
    catch (e) { p.log(`go(${prop},${move}) 失败#${i + 1}: ${e.message.split('\n')[0]}`); await sleep(800); }
  }
  return false;
}
/** 取游戏内当前时间 */
export const now = async (p) => (await p.s.state()).now;
export async function stepsOf(p, story) { const st = await p.s.state(); return st.stories[story]; }
/** 保存存档快照（localStorage 全量）到 out 目录，供后续实验从该点“继续” */
export async function snapSave(p, tag) {
  const dump = await p.s.qa('storageDump');
  writeFileSync(join(OUT, `save-${tag}.json`), JSON.stringify(dump));
  return dump;
}
export function texts(rec, from = 0, to = 1e9) { return rec.texts.filter((t) => t.now >= from && t.now <= to && !/^[☐☑]|暖意|☰|🔊|点地面|圣诞帽帽|Demo|点击任意处|建议开声音|导入存档|一顶被遗忘/.test(t.tx)); }

import { readFileSync } from 'node:fs';
/** 从某个存档快照“继续”：把 localStorage 预置好，再走真实的标题“继续”按钮 */
export async function launchFromSave(name, tag) {
  const dump = JSON.parse(readFileSync(join(OUT, `save-${tag}.json`), 'utf8'));
  const p = new Play(name);
  p.s = await Session.launch({ device: 'desktop', name, outDir: join(OUT, name) });
  await p.s.page.addInitScript((d) => { try { if (!sessionStorage.getItem('__qa_init')) { localStorage.clear(); for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v); sessionStorage.setItem('__qa_init', '1'); } } catch {} }, dump);
  await p.s.goto({ fresh: false });
  await p.installRec();
  await p.s.start({ mode: 'continue' });
  return p;
}
