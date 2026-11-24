// 新阶段说明卡(王国保卫战风):每个阶段第一次出现时弹一张手绘卡,"知道了"关闭;可从设置/图鉴"重看说明卡"。
// 卡框与缩略图由 art/things 的 drawStageCard 画在 canvas 上,按钮是 DOM(≥44px)。
// 触发:bus 'tier'(升档)自动弹;src-0 / rt-0 / station 这三张由 app 在合适时机调 api.showStageCard(id)。
import { drawStageCard, drawSantaDepot, drawTransport8, TRANSPORT8_NAMES } from '../../art/things/index.ts';
import { drawTree, treeDims } from '../../art/nature/index.ts';
import { STAGE_CARDS, STAGE_CARD_UI, SOURCE_TEXT } from '../../content/stages.ts';
import type { StageCard } from '../../content/stages.ts';
import { anySheetOpen, btn, h, openSheet, reducedMotion, sfx } from './dom.ts';
import { savePrefs } from './store.ts';
import type { PanelPrefs } from './store.ts';
import type { PanelCtx } from './types.ts';

export interface StageCards {
  /** 弹出一张卡;已看过且未 force 则忽略。有别的弹层时排队,弹层关掉后自动补弹 */
  show(id: string, force?: boolean): void;
  /** 回看列表(只列出已看过的) */
  openList(): void;
  /** 每秒调用:补弹排队中的卡 */
  tick(): void;
  seenCount(): number;
  destroy(): void;
}

const CW = 340;
const CH = 196;

const byId = (id: string): StageCard | undefined => STAGE_CARDS.find((c) => c.id === id);

/** body 按句号拆行,每行再按 ~12 字折行 */
function wrapLines(body: string): string[] {
  const out: string[] = [];
  for (const part of body.split(/(?<=[。!?])/)) {
    const s = part.trim();
    for (let i = 0; i < s.length; ) {
      let j = Math.min(s.length, i + 12);
      if (j < s.length && /[,。!?、:;]/.test(s[j])) j++; // 标点不落行首
      out.push(s.slice(i, j));
      i = j;
    }
  }
  return out.slice(0, 5);
}

const subOf = (c: StageCard): string =>
  c.line === 'source' ? `产出 · ${SOURCE_TEXT[c.tier]?.name ?? ''}` : c.line === 'route' ? `运输 · ${TRANSPORT8_NAMES[c.tier] ?? ''}` : '终点';

function thumb(c: StageCard, t: number): (g: CanvasRenderingContext2D, w: number, h: number) => void {
  return (g, w, hh) => {
    if (c.line === 'source') {
      const d = treeDims(c.tier + 1);
      const s = Math.min(w / d.w, hh / d.h) * 0.98;
      drawTree(g, w / 2, hh / 2 - (d.h * s) / 2 + d.ground * s, s, { tier: (c.tier + 1) as 1 | 2 | 3 | 4 | 5, t, ground: false });
    } else if (c.line === 'route') {
      drawTransport8(g, c.tier, 0, w / 2, hh * 0.82, Math.min(w, hh) / 70, { t });
    } else {
      drawSantaDepot(g, w / 2, hh * 0.9, Math.min(w, hh) / 60, { t });
    }
  };
}

export function createStageCards(ctx: PanelCtx, prefs: PanelPrefs, onChange: () => void): StageCards {
  const queue: string[] = [];
  const save = (): void => {
    savePrefs(ctx, prefs);
    onChange();
  };

  const open = (c: StageCard, replay: boolean): void => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = h('canvas', 'panel-stage-cv') as HTMLCanvasElement;
    // 按视口放大:横屏尽量大,竖屏贴宽;内部仍按 CW×CH 坐标绘制
    const k = Math.max(0.8, Math.min(1.3, (innerWidth - 24) / CW, (innerHeight - 100) / CH));
    cv.width = Math.round(CW * k * dpr);
    cv.height = Math.round(CH * k * dpr);
    cv.style.width = `${Math.round(CW * k)}px`;
    cv.style.height = `${Math.round(CH * k)}px`;
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', `${c.title}。${c.body}`);
    const g = cv.getContext('2d');
    const still = reducedMotion(ctx);
    let alive = true;
    let raf = 0;
    const t0 = performance.now();
    const lines = wrapLines(c.body);
    const frame = (tm: number): void => {
      if (!alive || !g) return;
      const t = still ? 0 : (tm - t0) / 1000;
      g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      g.clearRect(0, 0, CW, CH);
      drawStageCard(g, 6, 6, CW - 12, CH - 12, {
        title: c.title,
        sub: subOf(c),
        lines,
        seed: c.tier * 7 + (c.line === 'route' ? 3 : c.line === 'station' ? 5 : 1),
        t,
        p: still ? undefined : Math.min(1, t / 0.35),
        isNew: !replay,
        thumb: thumb(c, t),
      });
      if (!still || tm - t0 < 120) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const hint = h('p', 'panel-stage-hint', STAGE_CARD_UI.tapHint);
    const ok = btn(STAGE_CARD_UI.button, 'red panel-stage-ok', () => sheet.close());
    const sheet = openSheet(ctx, {
      id: 'panel-stage',
      title: c.title,
      cls: 'panel-stage-sheet',
      noHeader: true,
      passthrough: true,
      onClose: () => {
        alive = false;
        window.clearTimeout(auto);
        cancelAnimationFrame(raf);
      },
    });
    // 首次弹出 8 秒后自动收起(点穿遮罩,场景可继续玩)
    const auto = window.setTimeout(() => sheet.close(), 8000);
    sheet.body.append(cv, h('div', 'panel-stage-acts', ok, hint));
    sfx(ctx, replay ? 'modal' : 'narrOpen');
    if (!replay && !prefs.cardsSeen.includes(c.id)) {
      prefs.cardsSeen.push(c.id);
      save();
    }
    // 防误触:弹出后 pauseMs 内不接受"关闭",按钮此时半透明
    if (!replay) {
      ok.disabled = true;
      window.setTimeout(() => {
        ok.disabled = false;
        hint.classList.add('on');
      }, STAGE_CARD_UI.pauseMs);
    } else hint.classList.add('on');
    ok.focus?.();
  };

  const show = (id: string, force = false): void => {
    const c = byId(id);
    if (!c) return;
    if (!force && (prefs.cardsSeen.includes(id) || queue.includes(id))) return;
    if (anySheetOpen() && !force) {
      queue.push(id);
      return;
    }
    open(c, force && prefs.cardsSeen.includes(id));
  };

  const off = ctx.bus.on('tier', (e) => {
    show(`${e.line === 'source' ? 'src' : 'rt'}-${e.tier}`);
  });

  return {
    show,
    openList() {
      const sheet = openSheet(ctx, { id: 'panel-stagelist', title: STAGE_CARD_UI.replay, cls: 'panel-stagelist-sheet' });
      const seen = STAGE_CARDS.filter((c) => prefs.cardsSeen.includes(c.id));
      if (!seen.length) {
        sheet.body.append(h('p', 'panel-empty', '还没有说明卡。树长大、车换新,都会有一张。'));
        return;
      }
      const grid = h('div', 'panel-stagegrid');
      for (const c of seen) {
        grid.append(
          h('button', 'panel-stagerow', h('b', null, c.title), h('span', null, subOf(c))),
        );
        const b = grid.lastElementChild as HTMLButtonElement;
        b.type = 'button';
        b.addEventListener('click', () => open(c, true));
      }
      sheet.body.append(grid);
    },
    tick() {
      if (queue.length && !anySheetOpen()) {
        const id = queue.shift() as string;
        const c = byId(id);
        if (c && !prefs.cardsSeen.includes(id)) open(c, false);
      }
    },
    seenCount: () => prefs.cardsSeen.length,
    destroy() {
      off();
      queue.length = 0;
    },
  };
}
