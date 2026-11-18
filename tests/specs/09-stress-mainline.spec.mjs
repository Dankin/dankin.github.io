import { runIfMain } from '../lib/spec.mjs';
import { sleep } from '../lib/session.mjs';
import { playStory, monkey } from '../lib/driver.mjs';

// 整条主线真实点击通关 + 通关后沙盒 30 游戏分钟加速压力（乱点 + 跨区域 + 资源/堆内存/不变量采样）。慢：默认不进回归，--slow 或 --only 09 才跑。
const CHAIN = ['xiaomi_story', 'afu_story', 'laozhou_story', 'xiaolan_story', 'adong_story', 'finale_story'];
const spec = {
  id: '09-stress-mainline', title: '压力：整条主线真实点击 + 30 游戏分钟沙盒加速乱点', tags: ['stress', 'slow'], timeout: 2400000,
  async run(t) {
    const s = await t.launch({ device: 'desktop', name: 'desk' });
    await s.goto({ fresh: true });
    await s.start();
    const t0 = Date.now();
    const samples = [];
    const sample = async (label) => {
      const [res, heap, st] = await Promise.all([s.qa('resources'), s.page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null)), s.state()]);
      samples.push({ label, wall: (Date.now() - t0) / 1000, now: st.now, heapMB: heap, tex: res.textures, objs: res.objects ?? res.displayObjects ?? null, warmth: st.warmth });
      return samples.at(-1);
    };
    await sample('start');
    for (const id of CHAIN) {
      const r = await playStory(s, id, { t, onTick: undefined });
      t.ok(r.ok, `主线 ${id} 真实点击通关（${(r.ms / 1000).toFixed(0)}s）`, { detail: r });
      if (!r.ok) t.fatal(`${id} 未通关，终止压力测试`);
      await s.waitIdle({ timeout: id === 'finale_story' ? 240000 : 90000 }).catch(() => {});
      await sample(id);
    }
    // 终章面板：点“继续散步”
    for (let i = 0; i < 30; i++) {
      const m = (await s.qa('uiButtons')).filter((b) => (b.depth ?? 0) >= 1000 && b.gw > 80).sort((a, b) => a.gx0 - b.gx0);
      if (m.length) { await s.mouseClick(m[0].x, m[0].y); break; }
      await sleep(1000);
    }
    await sleep(1500);
    const mainlineGameMin = (await s.state()).now / 60;
    t.note('mainline', { wallMin: (Date.now() - t0) / 60000, gameMin: mainlineGameMin });
    // 沙盒 30 游戏分钟：每轮 advance 60s + 乱点 6 次 + 随机传送区域 + 采样
    const regions = (await s.qa('data')).regions?.map((r) => r.id ?? r) ?? [];
    const bad = [];
    const startNow = (await s.state()).now;
    for (let round = 0; round < 30; round++) {
      await s.qa('advance', 60);
      await monkey(s, { n: 6, seed: 100 + round });
      if (regions.length) { await s.qa('teleportToRegion', regions[round % regions.length]); await sleep(400); }
      const inv = await s.qa('invariants'); if (inv?.length) bad.push({ round, inv });
      const ov = await s.qa('overlaps'); if (ov?.length) bad.push({ round, ov });
      const lk = await s.qa('textLeaks'); if (lk?.length) bad.push({ round, lk });
      const st = await s.state();
      if (!(st.warmth >= 0 && st.warmth <= 100) || !Number.isFinite(st.hat.x) || !Number.isFinite(st.hat.y)) bad.push({ round, warmth: st.warmth, hat: st.hat });
      if (round % 5 === 4) { await sample(`sandbox-${round + 1}`); await s.shot(`sandbox-${round + 1}`); }
    }
    const endNow = (await s.state()).now;
    t.ok(endNow - startNow >= 29 * 60, `沙盒推进约 30 游戏分钟（实际 ${((endNow - startNow) / 60).toFixed(1)} min）`);
    t.ok(bad.length === 0, `30 轮乱点/跨区域：不变量/重叠/文案外露/暖度范围 全部正常（${bad.length} 次异常）`, { detail: bad.slice(0, 5) });
    const f = await s.qa('frameSample', 4); t.note('frames:end', f);
    t.ok(f.fps >= 20, `压力后空闲 fps ≥ 20（${f.fps?.toFixed?.(1)}）`);
    const first = samples.find((x) => x.label === 'sandbox-5'), last = samples.at(-1);
    t.note('samples', samples);
    if (first?.heapMB && last?.heapMB) t.ok(last.heapMB < first.heapMB * 2 + 50, `JS 堆无明显泄漏（${first.heapMB.toFixed(0)}→${last.heapMB.toFixed(0)} MB）`);
    t.ok(last.tex <= samples[0].tex + 40 && last.tex < 1200, `纹理数稳定无增长（开局 ${samples[0].tex} → 压力后 ${last.tex}，允许 +40）`);
    const npcs = await s.qa('npcStacking'); t.ok(!npcs?.length, `NPC 无重叠堆叠`, { detail: npcs });
  },
};
export default spec;
await runIfMain(import.meta.url, spec);
