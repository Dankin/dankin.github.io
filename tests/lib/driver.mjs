/**
 * 通关驱动：只用真实点击（点物件→点招式按钮），按故事“提示”(state.stories[id].hint) 一步步推进。
 * 不调用 sequence / completeStep 捷径。提示数据来自 stories.json 的 hint.prop/hint.move，
 * 因此该驱动同时验证“提示指向的招式确实能推进故事”。
 */
import { sleep } from './session.mjs';

/**
 * @param {Session} s
 * @param {string} storyId
 * @param {object} o  { t: spec t, maxAttempts, perStepTimeout, onTick: async(state)=>{}, shotEachStep }
 * @returns {{ok:boolean, steps:string[], attempts:Object, ms:number, reason?:string}}
 */
export async function playStory(s, storyId, o = {}) {
  const t0 = Date.now();
  const maxAttempts = o.maxAttempts ?? 6;
  const attempts = {};
  const steps = [];
  const tick = async () => { if (o.onTick) await o.onTick(await s.state()); };
  let idleSince = 0;
  for (let guard = 0; guard < 400; guard++) {
    let st = await s.state();
    const story = st.stories[storyId];
    if (!story) return { ok: false, reason: `故事 ${storyId} 不存在`, steps, attempts, ms: Date.now() - t0 };
    if (story.finished) break;
    // 演出/锁定中先等
    if (st.locked || st.seqRunning) { await s.waitIdle({ timeout: 90000 }).catch(() => {}); await tick(); continue; }
    const cur = story.current;
    if (!cur) { idleSince ||= Date.now(); if (Date.now() - idleSince > 90000) { await s.shot('inactive-bailout').catch(() => {}); const npcs = Object.fromEntries(Object.entries(st.npcs).filter(([k]) => ['afu','laozhou','doudou','xiaolan','adong','xiaomi'].includes(k)).map(([k, v]) => [k, `${v.x},${v.y},${v.state}`])); o.t?.log('inactive 诊断', JSON.stringify({ phase: st.phase, locked: st.locked, seq: st.seqRunning, npcs, stories: Object.fromEntries(Object.entries(st.stories).map(([k, v]) => [k, v.done.join('>') + '|' + v.current])) })); } if (Date.now() - idleSince > 90000) return { ok: false, reason: `故事 ${storyId} 90s 内未激活（phase=${st.phase}，前置未满足？）`, steps, attempts, ms: Date.now() - t0 }; await sleep(500); await tick(); continue; }
    idleSince = 0;  // 无可进行步骤（等待结局等）
    const hint = story.hint;
    if (!hint) return { ok: false, reason: `故事 ${storyId} 步骤 ${cur} 没有 hint，驱动无法推进`, steps, attempts, ms: Date.now() - t0 };
    attempts[cur] = (attempts[cur] ?? 0) + 1;
    if (attempts[cur] > maxAttempts) return { ok: false, reason: `步骤 ${cur} 尝试 ${maxAttempts} 次仍未推进`, steps, attempts, ms: Date.now() - t0 };
    // 被动步骤（near/arrive/timer/quiet…）由 NPC 自己走过去/时间推进，首次先静候，不要重复点招式（重放会让 NPC 重新追逐，步骤永远完不成）
    {
      const kind = (await s.qa('data')).stories?.[storyId]?.steps?.find((x) => x.id === cur)?.kind;
      const stepDef = (await s.qa('data')).stories?.[storyId]?.steps?.find((x) => x.id === cur);
      if (attempts[cur] === 1 && (['near', 'arrive', 'timer', 'quiet', 'count'].includes(kind) || (kind === 'flag' && stepDef?.noHint))) {
        o.t?.log(`… ${storyId}/${cur} 被动步骤(${kind})，静候 NPC`);
        const before0 = story.done.length;
        if (await waitProgress(s, storyId, before0, 45000, tick)) { steps.push(cur); o.t?.log(`✔ ${storyId}/${cur}`, `warmth=${(await s.state()).warmth}`); continue; }
      }
    }
    // 冷却中：等
    const cdKey = `${hint.prop}:${hint.move}`;
    if (st.cooldowns[cdKey]) await sleep(Math.min(st.cooldowns[cdKey], 12) * 1000 + 200);
    // 进入物件所在区域：帽子飞过去(可能需多次点击)。物件不在屏幕内时先 flyTo 物件附近的地面
    const p0 = await s.qa('propPoint', hint.prop);
    if (!p0) return { ok: false, reason: `hint 物件 ${hint.prop} 不存在`, steps, attempts, ms: Date.now() - t0 };
    if (!p0.onScreen) {
      const def = (await s.qa('data')).props[hint.prop];
      await s.flyTo(def.pos[0], def.pos[1] + 1.5, { timeout: 40000 });
    }
    const before = story.done.length;
    try {
      await s.useMove(hint.prop, hint.move);
    } catch (e) {
      // 点击没附身上（被 UI 遮挡/物件移动）：重试
      o.t?.log('useMove 失败:', e.message.split('\n')[0]);
      await s.shot(`retry-${cur}-${attempts[cur]}`).catch(() => {});
      { const st = await s.state(); o.t?.log('  诊断', JSON.stringify({ hat: st.hat, panelOpen: st.panelOpen, locked: st.locked, seq: st.seqRunning, bubbles: (st.bubbles || []).length, toasts: Array.isArray(st.toasts) ? st.toasts.length : st.toasts, cd: st.cooldowns })); }
      await sleep(600);
      continue;
    }
    // 等推进（有些招式有延迟效果，如放气球后孩子跑开再 hold 2.5s）
    const progressed = await waitProgress(s, storyId, before, o.perStepTimeout ?? 32000, tick);
    st = await s.state();
    if (progressed) {
      steps.push(cur);
      o.t?.log(`✔ ${storyId}/${cur}`, `warmth=${st.warmth}`);
      if (o.shotEachStep) await s.shot(`${storyId}-${cur}`).catch(() => {});
      // 关闭面板
      if (st.panelOpen) { await s.page.keyboard.press('Escape').catch(() => {}); }
    } else {
      o.t?.log(`… ${storyId}/${cur} 第 ${attempts[cur]} 次未推进，重试`);
    }
  }
  const st = await s.state();
  const fin = !!st.stories[storyId]?.finished;
  return { ok: fin, steps, attempts, ms: Date.now() - t0, ...(fin ? {} : { reason: '故事未完成' }) };
}

async function waitProgress(s, storyId, before, timeout, tick) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const st = await s.state();
    const story = st.stories[storyId];
    if (story.finished || story.done.length > before) return true;
    await tick?.();
    await sleep(300);
  }
  return false;
}

/** 随机“乱点”猴子测试：只用真实点击，覆盖地面/物件/NPC/UI/屏幕外沿 */
export async function monkey(s, { n = 60, seed = 1, onTick, menu = false } = {}) {
  let r = seed >>> 0;
  const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  const vp = s.page.viewportSize();
  const log = [];
  for (let i = 0; i < n; i++) {
    const roll = rnd();
    let x, y, kind;
    if (roll < 0.5) { x = rnd() * vp.width; y = rnd() * vp.height; kind = 'ground'; }
    else if (roll < 0.7) { const ids = Object.keys((await s.state()).npcs); const id = ids[Math.floor(rnd() * ids.length)]; const p = await s.qa('npcPoint', id); if (p?.onScreen) { x = p.x; y = p.y; kind = 'npc:' + id; } else { x = rnd() * vp.width; y = rnd() * vp.height; kind = 'ground'; } }
    else if (roll < 0.85) { const ids = Object.keys((await s.qa('data')).props); const id = ids[Math.floor(rnd() * ids.length)]; const p = await s.qa('propPoint', id); if (p?.onScreen) { x = p.x; y = p.y; kind = 'prop:' + id; } else { x = rnd() * vp.width; y = rnd() * vp.height; kind = 'ground'; } }
    else if (roll < 0.95) { const bs = await s.qa('uiButtons'); const bs2 = menu ? bs : bs.filter((q) => q.qa !== 'ui:menu'); const b = bs2[Math.floor(rnd() * bs2.length)]; if (b) { x = b.x; y = b.y; kind = 'ui:' + (b.qa ?? b.label); } else { x = rnd() * vp.width; y = rnd() * vp.height; kind = 'ground'; } }
    else { x = rnd() < 0.5 ? 1 : vp.width - 1; y = rnd() * vp.height; kind = 'edge'; }
    await s.mouseClick(x, y, { delay: 20 });
    log.push(kind);
    await sleep(60 + rnd() * 300);
    // 乱点可能误开 ☰ 菜单/弹窗（depth≥1000 的全屏遮罩）：Escape→再点菜单键收起；若回到标题则重新开始
    if (!menu) {
      const modal = async () => (await s.qa('uiHitAt', vp.width / 2, vp.height / 2)).some((h) => h.depth >= 1000);
      if (await modal()) {
        log.push('modal');
        if (!(await s.state()).started) { await s.start({ mode: 'continue' }).catch(() => s.start({ mode: 'new' })); }
        else {
          await s.page.keyboard.press('Escape'); await sleep(300);
          if (await modal()) { const mb = (await s.qa('uiButtons')).find((q) => q.qa === 'ui:menu'); if (mb) { await s.mouseClick(mb.x, mb.y); await sleep(400); } }
        }
      }
    }
    if (onTick) await onTick(i, kind);
  }
  return log;
}
