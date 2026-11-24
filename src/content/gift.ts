// 礼物页框架文案(纯数据 + 一个倒计时格式化函数)。
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 重要:祝福文字由用户本人亲自书写,不入仓库。                               │
// │ 祝福正文与落款走加密 #g= 链接(密文放在 URL 片段里,运行时用口令/密钥解密), │
// │ 本文件只提供"占位符 + 页面框架文案",不含、也不代写任何祝福内容。   │
// └─────────────────────────────────────────────────────────────────────────┘
//
// 页面渲染顺序(GIFT_RENDER_ORDER):{{GIFT_TEXT}} → {{GIFT_SIGN}} → 收尾句。
//   {{GIFT_TEXT}}  = 解密出来的祝福正文(用户自写)。
//   {{GIFT_SIGN}}  = 解密出来的称呼/落款(用户自写,例如"—— xxx")。
// 解锁时间:本地时间 2026-12-24 00:00(src/core/gift.ts 的 GIFT_DATE / giftOpen)。
//   plan/70 的决策是 UTC+8;若收礼人在别的时区,请 lead 确认(见 PRIVATE_NOTES)。
// ?date= 仅在 ?debug=1 下生效,#g= 密文不受它影响。

import { GIFT_PLACEHOLDER, GIFT_SIGN_PLACEHOLDER } from './story.ts';

export { GIFT_PLACEHOLDER, GIFT_SIGN_PLACEHOLDER };

/** 礼物页的渲染顺序(程序按此顺序逐段淡入) */
export const GIFT_RENDER_ORDER: readonly ('fixedLine' | 'giftText' | 'giftSign' | 'closing')[] = ['giftText', 'giftSign', 'closing'];

export const GIFT_FRAME = {
  /** 盒子上的小字(封印态,12/24 之前) */
  sealedTag: '圣诞节再拆',
  /** 倒计时前缀 */
  countdownPrefix: '还要等',
  /** 到点后的按钮 */
  openButton: '拆开',
  /** 拆之前的一句铺垫(盒子晃一晃) */
  openingLine: '盒子轻轻晃了一下。',
  /** 已取消固定句(用户决定):保留空串键只为兼容旧面板引用,GIFT_RENDER_ORDER 里不再出现 */
  fixedLine: '',
  /** 祝福正文占位:渲染时替换为解密后的用户文字 */
  giftText: GIFT_PLACEHOLDER,
  /** 落款占位:渲染时替换为解密后的落款 */
  giftSign: GIFT_SIGN_PLACEHOLDER,
  /** 读完之后的收尾(游戏自带,不是祝福) */
  closing: '平安夜快乐。',
  /** 关闭页面的按钮 */
  closeButton: '收好了',
  /** 再看一遍 */
  readAgain: '再看一遍',
  /** 重新打开(在设置页里的入口) */
  settingsEntry: '树下的盒子',
} as const;

/** 异常与边角态(不要让用户的礼物页出现空白) */
export const GIFT_ERRORS = {
  /** 日期没到 */
  tooEarly: '还没到时候。树说:圣诞节再拆。',
  /** URL 里没有 #g= */
  noPayload: '这个盒子是空的。链接少了一段,请找送你的人要完整链接。',
  /** 密文解不开(口令不对/链接被截断) */
  decryptFail: '盒子打不开。可能链接被截断了,请重新打开原始链接。',
  /** 浏览器不支持解密 */
  noCrypto: '这个浏览器打不开盒子。换一个新一点的浏览器试试。',
  /** 通用 */
  generic: '盒子出了点小状况。刷新一下,再试一次。',
} as const;

/** 倒计时文案:ms 为距离解锁的毫秒数。≤0 返回空串(此时应显示"拆开"按钮) */
export function giftCountdown(ms: number): string {
  if (ms <= 0) return '';
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${GIFT_FRAME.countdownPrefix} ${d} 天 ${h} 小时`;
  if (h > 0) return `${GIFT_FRAME.countdownPrefix} ${h} 小时 ${m} 分`;
  if (m > 0) return `${GIFT_FRAME.countdownPrefix} ${m} 分钟`;
  return `${GIFT_FRAME.countdownPrefix} ${sec} 秒`;
}

/**
 * 给写礼物的人看的(不会显示在游戏里):写祝福时可以参考的框架。
 * 这些是"问题",不是答案。正文请你自己写,写完走加密链接,不要提交进仓库。
 */
export const GIFT_AUTHOR_PROMPTS: readonly string[] = [
  '称呼:对方在你嘴里平时叫什么?',
  '一件只有你们两个人知道的小事。',
  '这一年里,你想谢谢 ta 的一件事。',
  '一句不用解释的话。',
  '落款:署名、日期、一个小标记,都行。',
];

/** 待 lead/用户确认的事项(给人看,不给程序用) */
export const PRIVATE_NOTES: readonly string[] = [
  '解锁时区:plan/70 为 UTC+8 2026-12-24 00:00;收礼人若不在该时区需确认。',
  '祝福正文与落款由你自己写,走加密 #g= 链接,不进仓库、不进 git 历史。',
];
