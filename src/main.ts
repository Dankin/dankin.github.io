import { SAVE_KEY, GOAL } from './core/constants.ts';
import {
  buy, buyProject, canBuy, canBuyProject, click, cookReady, cost, grabFairest, gravityGain, GRAVITY_EVERY_S,
  clickPieces, globalMult, goldRate, milestoneMult, isUnlocked, isWon, nextStageAt, progress, projectUnlocked, PROJECTS, rate, settle, stageIndex,
  stageProgress, STAGES, tick, UPGRADES, upgradeDef, useCook, addApples,
  BITES, bite, MILESTONE_GLOBAL, breezeBoost, sourcePerSec, SOURCE_IDS, tuning, type SourceId, biteUnlocked, canBite, cookMult, useWitch, witchReady,
  type ProjectId, type UpgradeId,
} from './core/game.ts';
import { newsIndex, tickerLines } from './core/news.ts';
import { world, worldAt } from './core/world.ts';
import { EVENT_NAMES, eventReward, nextEventGap, pickEvent } from './core/events.ts';
import { ACHIEVEMENTS, checkAchievements } from './core/achievements.ts';
import { createAudio } from './audio/bgm.ts';
import { showEnding } from './ui/ending.ts';
import { exportSave, importSave, load, save, storageWritable } from './core/save.ts';
import { newState, type State } from './core/state.ts';
import { equiv, fmt, fmtDuration } from './ui/format.ts';
import { Orchard, RED, type Build } from './ui/orchard.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const kv = localStorage;
const GOLD_TEXT = '#b88700';

// ---- 调试:时间加速(?speed=60 或 ?debug=1 出面板) ----
// 虚拟时钟:游戏里的"现在"= 真实时间 + skewMs;加速时 skewMs 持续累加,所以发布会计时/冷却/金苹果都按加速后的时间走。
let skewMs = 0;
let speed = 1;
const qs = new URLSearchParams(location.search);
const DEBUG = qs.has('debug') || qs.has('speed');
if (qs.has('calm')) world.harvestOn = false; // 关掉收获周期与下雨加成(冒烟测试用,数值恒定)
if (qs.has('speed')) speed = Math.max(1, Math.min(3600, Number(qs.get('speed')) || 1));
const nowMs = (): number => Date.now() + skewMs;

let canSave = true;
let readOnly = false;
let state: State = newState(Date.now());
let orchard: Orchard;
const audio = createAudio();
let sleepAnimUntil = 0;

// 圣诞彩蛋:12/24-25(可用 ?date=2025-12-24 调试)
const xmas = (() => {
  const q = new URLSearchParams(location.search).get('date');
  const d = q ? new Date(q + 'T12:00:00') : new Date();
  return d.getMonth() === 11 && (d.getDate() === 24 || d.getDate() === 25);
})();

// ---- 启动:读档 + 离线补算 ----
function boot(): void {
  canSave = storageWritable(kv);
  const r = load(kv, nowMs());
  state = r.state;
  if (r.kind === 'readonly') {
    readOnly = true;
    toast('存档来自更新的版本,本页只读,不会覆盖存档。');
  } else if (r.kind === 'ok') {
    if (r.fromBackup) toast('主存档损坏,已从备份恢复。');
    settleNow(true);
  }
  $('saveWarn').textContent = canSave ? '' : '当前无法保存(隐私模式?),请定期导出存档。';
}

function settleNow(showToast: boolean): void {
  const r = settle(state, nowMs());
  resetRateSamples();
  if (showToast && r.gain >= 1 && r.awayMs > 60_000) {
    toast(`离开了 ${fmtDuration(r.awayMs)},树送出了 ${fmt(r.gain)} 个苹果${r.capped ? '(离线收益最多算 8 小时)' : ''}。`);
  }
}

function persist(): void {
  if (readOnly || !canSave) return;
  if (!save(kv, state, Date.now())) {
    canSave = false;
    $('saveWarn').textContent = '保存失败(空间不足或隐私模式),请导出存档。';
  }
}

// ---- 提示 ----
let toastTimer = 0;
function toast(msg: string): void {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('on'), 4500);
}

// ---- 实测速率:最近几秒累计送出的增量,包含手摇 ----
const samples: Array<[number, number]> = [];
function resetRateSamples(): void {
  samples.length = 0;
}
function sampleRate(t: number): number {
  samples.push([t, state.delivered]);
  while (samples.length > 2 && t - samples[0][0] > 4000) samples.shift();
  const [t0, d0] = samples[0];
  const span = (t - t0) / 1000;
  return span >= 0.5 ? Math.max(0, (state.delivered - d0) / span) : 0;
}

// 玩家最近的点击频率(次/秒),来源占比条用
const clickSamples: Array<[number, number]> = [];
function sampleCps(t: number): number {
  clickSamples.push([t, state.clicks]);
  while (clickSamples.length > 2 && t - clickSamples[0][0] > 5000) clickSamples.shift();
  const [t0, c0] = clickSamples[0];
  const span = (t - t0) / 1000;
  return span >= 0.5 ? Math.max(0, (state.clicks - c0) / span) : 0;
}

// ---- 来源占比条 ----
const SRC_NAMES: Record<SourceId, string> = { click: '点击', breeze: '微风', gardener: '老徐', tractor: '拖拉机', shaker: '摇树机', drone: '无人机', express: '快递', cloud: '苹果云' };
let cps = 0;
function renderSources(now: number): void {
  const bar = document.getElementById('srcBar');
  if (!bar) return;
  const p = sourcePerSec(state, cps, now);
  const tot = SOURCE_IDS.reduce((a, id) => a + p[id], 0);
  if (tot <= 0) return;
  if (!bar.firstChild) {
    for (const id of SOURCE_IDS) {
      const i = document.createElement('i');
      i.className = `seg s-${id}`;
      i.dataset.src = id;
      i.title = SRC_NAMES[id];
      const on = () => orchard.highlight(id);
      i.addEventListener('pointerenter', on);
      i.addEventListener('pointerdown', on);
      i.addEventListener('pointerleave', () => orchard.highlight(null));
      bar.appendChild(i);
    }
  }
  const legend = document.getElementById('srcLegend');
  const sh = {} as Record<SourceId, number>;
  for (const id of SOURCE_IDS) {
    sh[id] = p[id] / tot;
    const seg = bar.querySelector<HTMLElement>(`.s-${id}`)!;
    seg.style.flex = `${Math.max(sh[id], 0.002)}`;
    seg.classList.toggle('empty', p[id] <= 0);
  }
  if (legend) {
    legend.innerHTML = SOURCE_IDS.filter((id) => p[id] > 0)
      .map((id) => `<span class="lg s-${id}" data-src="${id}"><b></b>${SRC_NAMES[id]} ${Math.round(sh[id] * 100)}%</span>`)
      .join('');
  }
  orchard.setSources(p);
}

// ---- 随机事件 ----
let nextEventAt = 0;
function maybeSpawnEvent(now: number): void {
  if (readOnly || document.hidden || orchard.eventActive) return;
  if (state.delivered < 300) return;
  if (nextEventAt === 0) { nextEventAt = now + nextEventGap() * 1000; return; }
  if (now < nextEventAt) return;
  const kind = pickEvent(worldAt((now - state.startedAt) / 1000).isNight);
  nextEventAt = now + nextEventGap() * 1000;
  orchard.spawnEvent(kind, (hit) => {
    if (!hit) return;
    const gain = eventReward(state, kind, nowMs());
    addApples(state, gain);
    audio.sfx.golden();
    toast(`${EVENT_NAMES[kind]}:+${fmt(gain)} 个苹果`);
  });
}

// ---- 升级与项目面板 ----
interface Row { seen?: boolean; btn: HTMLButtonElement; n: HTMLElement; d: HTMLElement; f: HTMLElement; c: HTMLElement }
function makeRow(): Row {
  const btn = document.createElement('button');
  btn.className = 'up';
  btn.innerHTML = '<span><span class="n"></span><br><span class="d"></span><span class="f"></span></span><span class="c"></span>';
  return {
    btn,
    n: btn.querySelector('.n')!,
    d: btn.querySelector('.d')!,
    f: btn.querySelector('.f')!,
    c: btn.querySelector('.c')!,
  };
}

const upRows = new Map<UpgradeId, Row>();
const projRows = new Map<ProjectId, Row>();
let biteRow: Row;

function buildPanels(): void {
  for (const u of UPGRADES) {
    const row = makeRow();
    row.btn.addEventListener('click', () => {
      if (readOnly) return;
      if (buy(state, u.id)) {
        audio.sfx.buy();
        syncOrchard();
        persist();
        renderPanels();
        renderFast(nowMs());
      }
    });
    $('ups').appendChild(row.btn);
    upRows.set(u.id, row);
  }
  biteRow = makeRow();
  biteRow.btn.addEventListener('click', () => {
    if (readOnly) return;
    if (bite(state)) {
      audio.sfx.bite();
      toast(BITES[state.bites - 1].flavor);
      syncOrchard();
      persist();
      renderPanels();
      renderFast(nowMs());
    }
  });
  $('projs').appendChild(biteRow.btn);
  for (const p of PROJECTS) {
    const row = makeRow();
    row.btn.addEventListener('click', () => {
      if (readOnly) return;
      const now = nowMs();
      if (state.projects[p.id]) {
        if (p.id === 'cook' && useCook(state, now)) {
          const c = orchard.crownPos();
          orchard.floatText(c.x, c.y, 'Good morning.', RED, 22);
          audio.sfx.fanfare();
          toast(`苹果发布会:30 秒产出 ×${cookMult(state)}`);
        } else if (p.id === 'witch' && witchReady(state)) {
          const gain = useWitch(state);
          sleepAnimUntil = performance.now() + 4200;
          audio.sfx.sleep();
          toast(`睡了一觉,醒来多了 ${fmt(gain)} 个苹果。睡着时离线不打折。`);
        }
      } else if (buyProject(state, p.id)) {
        audio.sfx.buy();
        toast(`项目完成:${p.name}`);
        if (p.id === 'fairest') nextFairestIn = 8;
      }
      persist();
      renderPanels();
      renderFast(now);
    });
    $('projs').appendChild(row.btn);
    projRows.set(p.id, row);
  }
}

function setRow(row: Row, o: { show: boolean; teaser?: boolean; owned?: boolean; name: string; desc: string; flavor?: string; cost: string; disabled: boolean; cook?: boolean }): void {
  row.btn.classList.toggle('hidden', !o.show);
  if (!o.show) return;
  row.btn.classList.toggle('teaser', !!o.teaser);
  row.btn.classList.toggle('owned', !!o.owned);
  row.btn.classList.toggle('cook', !!o.cook);
  if (row.n.textContent !== o.name) row.n.textContent = o.name;
  if (row.d.textContent !== o.desc) row.d.textContent = o.desc;
  const fl = o.flavor ? `\n${o.flavor}` : '';
  if (row.f.textContent !== fl) row.f.textContent = fl;
  if (row.c.textContent !== o.cost) row.c.textContent = o.cost;
  if (row.seen && row.btn.disabled && !o.disabled && !o.owned) {
    row.btn.classList.add('justready');
    setTimeout(() => row.btn.classList.remove('justready'), 1600);
  }
  row.seen = true;
  row.btn.disabled = o.disabled;
}

/** 升级当前的效果,显示在升级名下面 */
function effectText(id: UpgradeId, lv: number): string {
  if (lv <= 0) return '';
  const u = upgradeDef(id);
  let now = '';
  if (id === 'breeze') now = `现在:+${fmt(lv * u.perSec! * milestoneMult(lv) * globalMult(state))}/秒,自动产出 ×${breezeBoost(state).toFixed(2)}`;
  else if (u.perSec) now = `现在:+${fmt(lv * u.perSec * milestoneMult(lv) * globalMult(state))}/秒`;
  else if (id === 'shake') now = `现在:每摇一下掉 ${clickPieces(state)} 个,另加每秒自动产出的 ${(lv * tuning.clickAuto * 100).toFixed(1)}%`;
  else if (id === 'branches') now = `现在:全部产出 +${5 * lv}%`;
  else if (id === 'breed') now = `现在:金苹果掉率 ${Math.round(goldRate(state) * 100)}%`;
  const nextMs = (Math.floor(lv / 25) + 1) * 25;
  const ms = `再 ${nextMs - lv} 级(Lv.${nextMs}):${u.perSec ? '本项 ×2,' : ''}全部产出 ×${MILESTONE_GLOBAL}`;
  return `${now}\n${ms}`;
}

function renderPanels(): void {
  const now = nowMs();
  // 升级:已解锁的显示;下一个未解锁的显示成预告
  let teased = false;
  for (const u of UPGRADES) {
    const row = upRows.get(u.id)!;
    if (isUnlocked(state, u.id)) {
      const lv = state.upgrades[u.id];
      setRow(row, {
        show: true,
        name: lv ? `${u.name}  Lv.${lv}` : u.name,
        desc: u.hint,
        flavor: effectText(u.id, lv),
        cost: fmt(cost(u, lv)),
        disabled: readOnly || !canBuy(state, u.id),
      });
    } else if (!teased) {
      teased = true;
      setRow(row, { show: true, teaser: true, name: '???', desc: `累计送出 ${fmt(u.unlockAt)} 个平安果后出现`, cost: '', disabled: true });
    } else setRow(row, { show: false, name: '', desc: '', cost: '', disabled: true });
  }
  // 项目:一次性,典故都放在这里
  teased = false;
  let anyProj = false;
  for (const p of PROJECTS) {
    const row = projRows.get(p.id)!;
    const owned = state.projects[p.id];
    if (owned) {
      anyProj = true;
      if (p.id === 'cook') {
        const ready = cookReady(state, now);
        const left = Math.ceil((state.buffs.cookReadyAt - now) / 1000);
        setRow(row, {
          show: true, owned: true, cook: ready, name: p.name, desc: p.desc, flavor: p.flavor,
          cost: ready ? '开发布会' : `冷却 ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`,
          disabled: readOnly || !ready,
        });
      } else if (p.id === 'witch' && witchReady(state)) {
        setRow(row, { show: true, owned: true, cook: true, name: p.name, desc: p.desc, flavor: p.flavor, cost: '咬一口', disabled: readOnly });
      } else {
        setRow(row, { show: true, owned: true, name: p.name, desc: p.desc, flavor: p.flavor, cost: '已完成', disabled: true });
      }
    } else if (projectUnlocked(state, p.id)) {
      anyProj = true;
      setRow(row, { show: true, name: p.name, desc: p.desc, flavor: p.flavor, cost: fmt(p.cost), disabled: readOnly || !canBuyProject(state, p.id) });
    } else if (!teased && state.delivered >= 200) {
      teased = true;
      anyProj = true;
      setRow(row, { show: true, teaser: true, name: '???', desc: `累计送出 ${fmt(p.unlockAt)} 个平安果后出现`, cost: '', disabled: true });
    } else setRow(row, { show: false, name: '', desc: '', cost: '', disabled: true });
  }
  // 禁果:三口,按顺序出现
  if (state.bites >= BITES.length) {
    anyProj = true;
    setRow(biteRow, { show: true, owned: true, name: `禁果  ${state.bites}/${BITES.length}`, desc: '全部产出 ×8。苹果的祖先,吃完了。', flavor: BITES[BITES.length - 1].flavor, cost: '已吃完', disabled: true });
  } else if (biteUnlocked(state)) {
    anyProj = true;
    const b = BITES[state.bites];
    setRow(biteRow, { show: true, name: `${b.name}  (${state.bites}/${BITES.length})`, desc: b.desc, flavor: b.flavor, cost: fmt(b.cost), disabled: readOnly || !canBite(state) });
  } else setRow(biteRow, { show: false, name: '', desc: '', cost: '', disabled: true });
  $('projHead').classList.toggle('hidden', !anyProj);
}

// ---- 每帧都要更新的部分 ----
let shownApples = '';
let shownNews = -1;
let lastStage = -1;
let measured = 0;

function renderFast(nowMs: number): void {
  const a = fmt(state.apples);
  if (a !== shownApples) {
    shownApples = a;
    $('apples').textContent = a;
  }
  $('rate').textContent = measured >= 0.05 ? `+${fmt(measured)}/秒` : '';
  // 加成倒计时
  const buffs: string[] = [];
  if (state.buffs.cookUntil > nowMs) buffs.push(`苹果发布会 ×${cookMult(state)} · ${Math.ceil((state.buffs.cookUntil - nowMs) / 1000)} 秒`);
  if (state.buffs.goldUntil > nowMs) buffs.push(`最美的苹果 ×2 · ${Math.ceil((state.buffs.goldUntil - nowMs) / 1000)} 秒`);
  const bt = buffs.join('    ');
  if ($('buffs').textContent !== bt) $('buffs').textContent = bt;
}

/** 低频:阶段条、总进度、折算、新闻 */
function renderSlow(): void {
  const d = state.delivered;
  const idx = stageIndex(d);
  const next = nextStageAt(d);
  $('stageName').textContent = `第 ${idx + 1} 期 · ${STAGES[idx].name}`;
  const eta = measured > 0.05 ? (next - d) / measured : Infinity;
  const etaText = eta === Infinity ? '摇几下就知道要多久' : eta > 86_400 ? '还要很久' : `约 ${fmtDuration(eta * 1000)}`;
  $('stageNext').textContent =
    idx + 1 < STAGES.length
      ? `下一期「${STAGES[idx + 1].name}」· 累计 ${fmt(next)} · ${etaText}`
      : `终点 · 累计 ${fmt(GOAL)} · ${etaText}`;
  const sp = stageProgress(d) * 100;
  ($('stageBar') as HTMLElement).style.width = `${sp.toFixed(1)}%`;
  $('stageBar').parentElement!.setAttribute('aria-valuenow', sp.toFixed(0));

  $('goalBox').classList.toggle('hidden', d < 100);
  const p = progress(state);
  ($('goalBar') as HTMLElement).style.width = `${(p * 100).toFixed(3)}%`;
  $('goalBar').parentElement!.setAttribute('aria-valuenow', (p * 100).toFixed(1));
  $('goalNum').textContent = `${fmt(d)} / ${fmt(GOAL)}`;
  $('equiv').textContent = equiv(d);

  const ni = newsIndex(d);
  if (ni !== shownNews) {
    shownNews = ni;
    renderTicker(d);
  }
  if (idx !== lastStage) {
    if (lastStage >= 0 && idx > lastStage) {
      toast(`第 ${idx + 1} 期「${STAGES[idx].name}」:果园里又长出了新的树`);
      audio.sfx.stage();
      document.body.classList.add('stageup');
      setTimeout(() => document.body.classList.remove('stageup'), 1300);
    }
    lastStage = idx;
    audio.setIntensity(idx);
  }
  for (const a of checkAchievements(state, nowMs())) {
    toast(`成就:${a.name} —— ${a.desc}`);
    renderAchievements(true);
  }
  renderAchievements(false);
  syncOrchard();
  renderNextGoal();
}

// ---- 跑马灯与成就 ----
function renderTicker(d: number): void {
  const lines = tickerLines(d);
  if (xmas) lines.splice(1, 0, '平安夜快乐。苹果的"苹"和平安的"平",是一个音。', '圣诞树上挂的不是苹果,是平安果。');
  const html = lines.map((t) => `<span class="ni">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`).join('');
  const track = document.getElementById('newsTrack');
  if (!track) {
    $('news').textContent = lines[0];
    return;
  }
  track.innerHTML = html + html;
  const chars = lines.reduce((a, t) => a + t.length + 4, 0);
  track.style.setProperty('--news-dur', `${Math.max(60, Math.round((chars * 15) / 45))}s`);
}

let achKey = '';
function renderAchievements(force: boolean): void {
  const list = document.getElementById('achList');
  if (!list) return;
  const key = String(Object.keys(state.achievements).length);
  if (!force && key === achKey) return;
  achKey = key;
  list.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const done = !!state.achievements[a.id];
    const div = document.createElement('div');
    div.className = `ach ${done ? 'done' : 'locked'}`;
    div.innerHTML = '<span class="n"></span><span class="d"></span>';
    div.querySelector('.n')!.textContent = done ? a.name : '???';
    div.querySelector('.d')!.textContent = done ? a.desc : `线索:${a.hint}`;
    list.appendChild(div);
  }
  const tab = document.getElementById('tabAch');
  if (tab) tab.textContent = `成就 ${Object.keys(state.achievements).length}/${ACHIEVEMENTS.length}`;
}

// ---- 下一步目标:永远告诉玩家在攒什么 ----
let goalShown = '';
function renderNextGoal(): void {
  const box = document.getElementById('nextGoal');
  if (!box) return;
  const cands: Array<{ name: string; cost: number }> = [];
  for (const u of UPGRADES) if (isUnlocked(state, u.id) && !(u.id === 'breed' && goldRate(state) >= 0.2)) cands.push({ name: u.name, cost: cost(u, state.upgrades[u.id]) });
  for (const p of PROJECTS) if (!state.projects[p.id] && projectUnlocked(state, p.id)) cands.push({ name: p.name, cost: p.cost });
  if (state.bites < BITES.length && biteUnlocked(state)) cands.push({ name: BITES[state.bites].name, cost: BITES[state.bites].cost });
  let text = '';
  let frac = 0;
  if (cands.length) {
    cands.sort((a, b) => a.cost - b.cost);
    const c = cands[0];
    frac = Math.min(1, state.apples / c.cost);
    if (state.apples >= c.cost) text = `可以买了:${c.name}`;
    else {
      const eta = measured > 0.05 ? (c.cost - state.apples) / measured : Infinity;
      text = `下一步:${c.name} · 还差 ${fmt(c.cost - state.apples)}${eta < 86_400 ? ` · 约 ${fmtDuration(eta * 1000)}` : ''}`;
    }
  }
  const key = text;
  box.classList.toggle('hidden', !text);
  if (key !== goalShown) {
    goalShown = key;
    const t = document.getElementById('nextGoalText');
    if (t) t.textContent = text;
  }
  const bar = document.getElementById('nextGoalBar');
  if (bar) bar.style.width = `${(frac * 100).toFixed(1)}%`;
}

let orchardKey = '';
function syncOrchard(): void {
  const trees = STAGES[stageIndex(state.delivered)].trees;
  const u = state.upgrades;
  const p = state.projects;
  const build: Build = {
    shake: u.shake, breeze: u.breeze, gardener: u.gardener, branches: u.branches, breed: u.breed,
    shaker: u.shaker, express: u.express, tractor: u.tractor, drone: u.drone, cloud: u.cloud,
    gravity: p.gravity, fairest: p.fairest, cook: p.cook, duo: p.duo,
    cookActive: state.buffs.cookUntil > nowMs(),
    bites: state.bites, garage: p.garage, doctor: p.doctor, witch: p.witch, onemore: p.onemore,
    sleeping: performance.now() < sleepAnimUntil,
  };
  const key = `${trees}:${Object.values(build).join(',')}`;
  if (key !== orchardKey) {
    orchardKey = key;
    orchard.setState(trees, build);
  }
}

// ---- 摇 ----
function onShake(px: number, py: number): void {
  if (readOnly) return;
  const now = nowMs();
  if (orchard.hitFairest(px, py)) {
    orchard.fairest = null;
    grabFairest(state, now);
    audio.sfx.golden();
    orchard.floatText(px, py - 10, '最美的苹果!', GOLD_TEXT, 22);
    toast('最美的苹果:30 秒产出 ×2');
    nextFairestIn = 45 + Math.random() * 60;
    persist();
    return;
  }
  const r = click(state, { now });
  orchard.poke();
  r.golds > 0 ? audio.sfx.golden() : audio.sfx.shake();
  orchard.drop(r.pieces, r.golds);
  orchard.floatText(px, py - 8, '+' + fmt(r.value), r.golds > 0 ? GOLD_TEXT : '#111', 18);
  renderFast(now);
}

// ---- 主循环:100ms 固定 tick,渲染用 rAF ----
let nextFairestIn = 20;
let gravAcc = 0;
let dropAcc = 0;
let won = false;

function step(dt: number, now: number): void {
  if (readOnly) return;
  const g = tick(state, dt, now);
  void g;
  // 自动产出的视觉:最多每秒掉 6 个(流水线画面由 orchard.setSources 驱动)
  dropAcc += Math.min(rate(state, now), 6) * dt;
  while (dropAcc >= 1) {
    dropAcc -= 1;
    orchard.drop(1);
  }
  if (state.projects.gravity) {
    gravAcc += dt;
    if (gravAcc >= GRAVITY_EVERY_S) {
      gravAcc = 0;
      const gain = gravityGain(state, now);
      addApples(state, gain);
      const c = orchard.crownPos();
      orchard.gravityHit();
      audio.sfx.bonk();
      orchard.floatText(c.x, c.y, `万有引力 +${fmt(gain)}`, '#555', 16);
    }
  }
  if (state.projects.fairest && !orchard.fairest) {
    nextFairestIn -= dt;
    if (nextFairestIn <= 0) {
      orchard.spawnFairest();
      nextFairestIn = 45 + Math.random() * 60;
    }
  }
}

function renderDebug(): void {
  const el = document.getElementById('dbgSpeed');
  if (el) el.textContent = `×${speed}`;
}

function setupDebug(): void {
  if (!DEBUG) return;
  const box = document.createElement('div');
  box.id = 'dbg';
  box.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99;display:flex;flex-wrap:wrap;gap:4px;align-items:center;max-width:94vw;padding:4px 6px;background:#111c;color:#fff;font:12px/1.2 system-ui;border-radius:8px';
  const mk = (label: string, fn: () => void): void => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'padding:3px 7px;border-radius:5px;border:1px solid #888;background:#333;color:#fff;font:inherit;cursor:pointer';
    b.onclick = fn;
    box.appendChild(b);
  };
  box.append('调试 ');
  const cur = document.createElement('b');
  cur.id = 'dbgSpeed';
  box.appendChild(cur);
  for (const v of [1, 10, 60, 600, 3600]) mk(`×${v}`, () => { speed = v; });
  const skip = (sec: number) => () => {
    // 快进:按当前速率直接结算 sec 秒,并推进虚拟时钟
    const g = tick(state, sec, nowMs());
    skewMs += sec * 1000;
    toast(`快进 ${fmtDuration(sec * 1000)},+${fmt(g)}`);
  };
  mk('+10分', skip(600));
  mk('+1小时', skip(3600));
  mk('+10亿', () => { addApples(state, 1e9); });
  document.body.appendChild(box);
}

function loop(): void {
  let last = performance.now();
  let acc = 0;
  let sinceSave = 0;
  let slow = 0;
  const frame = (t: number) => {
    const raw = (t - last) / 1000;
    last = t;
    if (raw > 5) settleNow(true); // 后台冻结后回来:一次闭式结算
    const dt = Math.min(raw, 1);
    if (speed > 1) skewMs += dt * (speed - 1) * 1000;
    const now = nowMs();
    acc += dt * speed;
    // 加速时拉大步长,每帧最多 20 步
    const chunk = Math.max(0.1, acc / 20);
    while (acc >= chunk && acc >= 0.1) {
      acc -= chunk;
      step(chunk, now);
    }
    sinceSave += dt;
    if (sinceSave >= 15) {
      sinceSave = 0;
      persist();
    }
    measured = sampleRate(now);
    cps = sampleCps(performance.now());
    orchard.setClock((now - state.startedAt) / 1000);
    orchard.frame(dt);
    renderFast(now);
    if (DEBUG) renderDebug();
    slow += dt;
    if (slow >= 0.25) {
      slow = 0;
      renderSlow();
      renderPanels();
      renderSources(now);
      maybeSpawnEvent(now);
    }
    if (isWon(state) && !won) {
      won = true;
      audio.sfx.fanfare();
      showEnding(state, () => undefined, () => {
        state = newState(Date.now());
        readOnly = false;
        afterStateReplaced();
        persist();
      });
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function stagePoint(e: PointerEvent): { x: number; y: number } {
  const r = $('stage').getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function wire(): void {
  const stage = $('stage');
  stage.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const p = stagePoint(e);
    onShake(p.x, p.y);
  });
  stage.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const c = orchard.crownPos();
      onShake(c.x, c.y);
    }
  });
  addEventListener('resize', () => orchard.resize());
  addEventListener('pointerdown', () => audio.unlock(), { capture: true });
  addEventListener('keydown', () => audio.unlock(), { capture: true });
  setupSoundToggle();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) persist();
    else settleNow(true);
  });
  addEventListener('pagehide', persist);
  addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) settleNow(true);
  });
  // 多标签页:别的标签页写了存档,就停止本页保存,避免互相覆盖
  addEventListener('storage', (e) => {
    if (e.key === SAVE_KEY && !readOnly) {
      readOnly = true;
      toast('检测到另一个标签页在玩,本页已暂停。刷新后继续。');
    }
  });
  $('btnExport').addEventListener('click', async () => {
    const text = exportSave(state);
    try {
      await navigator.clipboard.writeText(text);
      toast('存档已复制到剪贴板。');
    } catch {
      prompt('复制下面的存档文本:', text);
    }
  });
  $('btnImport').addEventListener('click', () => {
    const text = prompt('粘贴存档文本:');
    if (!text) return;
    const s = importSave(text);
    if (!s) return toast('存档无效。');
    state = s;
    readOnly = false;
    settleNow(false);
    afterStateReplaced();
    persist();
    toast('导入成功。');
  });
  $('btnReset').addEventListener('click', () => {
    if (!confirm('确定重新开始?当前进度会被清除。')) return;
    state = newState(Date.now());
    readOnly = false;
    afterStateReplaced();
    persist();
  });
}

function setupSoundToggle(): void {
  let btn = document.getElementById('btnSound') as HTMLButtonElement | null;
  if (!btn) {
    const ref = $('btnExport');
    btn = document.createElement('button');
    btn.id = 'btnSound';
    btn.className = ref.className;
    ref.parentElement!.insertBefore(btn, ref);
  }
  const apply = () => {
    audio.setMusic(state.settings.sound);
    audio.setSfx(state.settings.sound);
    btn!.textContent = state.settings.sound ? '声音:开' : '声音:关';
  };
  btn.addEventListener('click', () => {
    state.settings.sound = !state.settings.sound;
    audio.unlock();
    apply();
    persist();
  });
  apply();
}

function afterStateReplaced(): void {
  orchardKey = '';
  lastStage = -1;
  shownNews = -1;
  achKey = '';
  won = false;
  resetRateSamples();
  renderSlow();
  renderPanels();
}

boot();
if (xmas) document.body.classList.add('xmas');
won = isWon(state);
orchard = new Orchard($('cv') as HTMLCanvasElement);
orchard.christmas = xmas;
orchard.reducedMotion = state.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
buildPanels();
wire();
renderSlow();
renderPanels();
renderFast(nowMs());
setupDebug();
loop();
