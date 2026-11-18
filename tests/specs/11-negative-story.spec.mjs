import { runIfMain } from '../lib/spec.mjs';
import { sleep } from '../lib/session.mjs';

// 负面/边界（故事向）：乱序、提前触发、阿冬尊重性、连点同招、演出中刷新（test-matrix §3/§8）
const spec = {
  id: '11-negative-story', title: '负面·故事向：乱序触发/提前点后续物件/阿冬尊重/连点/演出中刷新', tags: ['negative', 'story'], timeout: 420000,
  async run(t) {
    const s = await t.launch({ device: 'desktop', name: 'desk' });
    await s.goto({ fresh: true });
    await s.start();
    const data = await s.qa('data');
    const doneOf = async () => Object.fromEntries(Object.entries((await s.state()).stories ?? {}).map(([k, v]) => [k, v.done ?? []]));
    const near = async (propId, dy = 1.5) => { const d = data.props[propId]; await s.qa('teleportHat', d.pos[0], d.pos[1] + dy); await sleep(700); };

    // 1. 先于 wake 触发 drop（阿福邮筒），以及早于解锁的后续故事物件
    const base = await doneOf();
    const early = [['mailbox_alley', 'alley_post', '先于 wake 投信'], ['oven', 'oven_stoke', '早晨拨炉火(老周 ember)'], ['bus_door', 'bus_ramp', '早晨放坡道(阿冬 ramp)'], ['tree', 'tree_twinkle', '灯未点就点树(终章 tree)'], ['bike_xl', 'bike_bell', '早晨按大车铃(小蓝 bell)']];
    for (const [prop, move, label] of early) {
      if (!data.props[prop]) { t.note(`${label}: 物件 ${prop} 不存在，跳过`); continue; }
      await s.qa('clearCooldowns');
      await near(prop);
      try { await s.useMove(prop, move); } catch (e) { t.note(`${label}: ${String(e.message).split('\n')[0]}`); }
      await sleep(1500);
      const after = await doneOf();
      const bad = Object.keys(after).filter((k) => (after[k].length) > (base[k]?.length ?? 0) && !/^xiaomi/.test(k));
      t.ok(bad.length === 0, `${label}：不应推进后续故事（${bad.join(',') || '无'}）`, { detail: after });
      const inv = await s.qa('invariants'); t.ok(!inv || inv.ok !== false, `${label}：世界一致性`, { detail: inv });
      await s.shot('early-' + prop);
      await s.page.keyboard.press('Escape'); await s.dismissPanel().catch(() => {});
    }

    // 2. 连点同一招 20 次
    await s.qa('teleportHat', ...data.props.windchime.pos); await sleep(500);
    await s.possess('windchime');
    let accepted = 0;
    for (let i = 0; i < 20; i++) {
      const b = await s.qa('moveButton', 'chime_ring').catch(() => null);
      if (b?.onScreen !== false && b) { await s.page.mouse.click(b.x, b.y); accepted++; }
      await sleep(120);
    }
    await sleep(1500);
    const st2 = await s.state();
    t.note('spam chime_ring', { clicks: accepted, cooldowns: st2.cooldowns });
    t.ok((st2.hat.attachedTo === 'windchime' || !st2.hat.attachedTo) && st2.ready !== false, '连点同招 20 次后游戏仍响应');
    t.ok(!((await s.qa('overlaps')).length), '连点后 UI 无重叠');

    // 3. 阿冬尊重性（P0）：点阿冬 → 不附身，不出现可怜台词；
    await s.qa('setPhase', 'dusk', 0).catch(() => {});
    await sleep(600);
    const npcs = (await s.state()).npcs ?? {};
    const adong = Array.isArray(npcs) ? npcs.find((n) => n.id === 'adong') : npcs.adong;
    if (adong) {
      const pos = adong.pos ?? [adong.x, adong.y];
      await s.qa('teleportHat', pos[0] + 1.5, pos[1] + 1.5); await sleep(900);
      try { await s.clickNpc('adong'); } catch (e) { t.note('clickNpc adong: ' + String(e.message).split('\n')[0]); }
      await sleep(1200);
      const st3 = await s.state();
      t.ok(!st3.hat.attachedTo || st3.hat.attachedTo !== 'adong', '点阿冬：不可被附身（尊重性 P0）', { detail: st3.hat });
      const txt = (await s.qa('visibleTexts')).join('|');
      t.ok(!/可怜|同情|帮你|辛苦了|坐轮椅/.test(txt), '阿冬相关文案无怜悯/标签化用语', { detail: txt.slice(0, 200) });
      const refuse = /自己的轮子自己推/.test(txt);
      t.note('阿冬拒绝台词 "自己的轮子自己推。"', { shown: refuse });
      await s.shot('adong-click');
    } else t.note('阿冬不在 npcs 里（可能 dusk 才出现）');

    // 4. 演出中刷新：终章 finale_city 进行中 reload，不应卡死在锁定
    await s.qa('runSequence', 'finale_city'); await sleep(3000);
    t.ok((await s.state()).seqRunning, '终章演出已开始（刷新前）');
    await s.page.reload(); await s.ensureApi();
    await s.start({ mode: 'continue' }).catch(async () => { await s.start({ mode: 'new' }); });
    await sleep(2000);
    let unlocked = true;
    await s.waitState('s=>!s.locked', { timeout: 15000, msg: '刷新后解除锁定' }).catch(() => { unlocked = false; });
    t.ok(unlocked, '演出中刷新后 ≤15s 不卡锁定（5s 自动解锁）', { detail: await s.state().then((x) => ({ locked: x.locked, seq: x.seqRunning })) });
    // 刷新后还能点地面移动
    const h0 = (await s.state()).hat;
    const gp = await s.qa('groundPoint', h0.x + 2, h0.y + 2); await s.page.mouse.click(gp.x, gp.y); await sleep(1500);
    const h1 = (await s.state()).hat;
    t.ok(h1.moving || h1.x !== h0.x || h1.y !== h0.y || h1.attachedTo, '刷新后仍可操作帽子');
  },
};
export default spec;
await runIfMain(import.meta.url, spec);
