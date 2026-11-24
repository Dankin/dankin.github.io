// 面板层公共类型。mountPanels(ctx) 只依赖这里声明的最小接口,不 import src/app/*。
import type { Bus } from '../../core/bus.ts';
import type { State } from '../../core/state.ts';
import type { GameAudio } from '../../audio/bgm.ts';

/** eng-app 注入的动作钩子;缺哪个,对应按钮就隐藏/置灰 */
export interface PanelActions {
  /** 交付订单:返回是否成功与奖励(果钱)。eng-app 内部 s.coins += reward 并发 toast */
  claimOrder?(id: number): { ok: boolean; reward: number };
  /** 献果:W = 要献出的果钱。返回 null = 未开放 */
  offer?(W: number): { spent: number; apples: number } | null;
  /** 献 W 果钱预计送出多少苹果(用于预览);缺省则不显示预览 */
  offerPreview?(W: number): number;
  /** 献果是否已开放 */
  offerOpen?(): boolean;
  /** 导出存档文本 / 导入存档文本(true = 成功) / 清档重来 */
  exportSave?(): string;
  importSave?(text: string): boolean;
  resetSave?(): void;
  /** 设置变化后(减少动效/暗色…)让 app 立即存档并应用 */
  settingsChanged?(): void;
  /** 玩家关闭礼物页(回到果园) */
  giftClosed?(): void;
}

export interface PanelCtx {
  bus: Bus;
  getState(): State;
  audio?: GameAudio;
  actions?: PanelActions;
  /** 日历意义上的"现在"(礼物门用,?debug&date= 会偏移)。缺省 Date.now */
  nowMs?(): number;
  /** ?debug 已开 */
  debug?: boolean;
  version?: string;
  /** 挂载父节点,缺省 document.body */
  root?: HTMLElement;
  /** 入口按钮停靠:缺省 'float'(场景右上角一小列);传元素 = 把入口按钮放进去;null = 不画入口(自己用 api.open*) */
  dock?: HTMLElement | 'float' | null;
  /** 本地存储(缺省 localStorage) */
  kv?: Pick<Storage, 'getItem' | 'setItem'>;
}

export interface PanelsApi {
  /** 旁白:直接说一句(自定义文案;走队列与冷却) */
  say(text: string, speaker?: string, opts?: { force?: boolean }): void;
  /** 离线回来(分钟);触发 idle-return 旁白 */
  onAway(minutes: number): void;
  /** 进入某时代(= bus 'era'):弹明信片 + 排旁白。已看过的明信片不会重复弹 */
  enterEra(era: number, opts?: { force?: boolean }): void;
  openCodex(tab?: 'varieties' | 'eggs' | 'achievements'): void;
  openMailbox(): void;
  openPostcard(id: string): void;
  openOrders(): void;
  openOffer(): void;
  openSettings(): void;
  /** 礼物页:自动按日期决定封印/开盒;hash 里没有 #g= 时为 noPayload 提示 */
  openGift(opts?: { force?: 'sealed' | 'open' }): void;
  /** 每秒 / 每帧由 eng-app 调一次(订单气泡倒计时、礼物倒计时);不调也能用,内部有 1Hz 定时器 */
  tick?(): void;
  /** 当前是否有全屏面板挡着(eng-app 可据此暂停手势) */
  isModalOpen(): boolean;
  closeAll(): void;
  /** 小红点:图鉴/信箱/订单有新东西 */
  badges(): { codex: number; mailbox: number; orders: number };
  destroy(): void;
}
