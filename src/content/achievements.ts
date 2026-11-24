// 成就文案(纯数据)。id 与 src/core/sys/codex.ts 的 ACHIEVEMENTS 一一对应(26 个)。
// title = 成就名(可覆盖 core 里的占位名),text = 解锁时/列表里的一句话(≤24 字)。
// 奖励(若有)归 systems,这里只管字。

export interface AchText { title: string; text: string }

export const ACH_TEXT: Record<string, AchText> = {
  'first-shake': { title: '第一摇', text: '树抖了一下,像在说"好吧"。' },
  'shakes-100': { title: '摇了一百下', text: '手腕开始有自己的意见。' },
  'shakes-1000': { title: '手腕发烫', text: '一千下。树也认识你了。' },
  'shakes-5000': { title: '摇树宗师', text: '师父说:摇到极致,就是不摇。' },
  'combo-30': { title: '连摇 30', text: '树请求暂停。驳回。' },
  'tier-1': { title: '升了第一档', text: '一档一档,也是路。' },
  'tier-3': { title: '两线三档', text: '车和树,都长高了。' },
  'tier-5': { title: '两线满档', text: '到头了。其实是到门口。' },
  'helpers-5': { title: '五个帮手', text: '老徐终于有伴了。' },
  'p-1': { title: '送出 1%', text: '八千二百万个,开张。' },
  'p-10': { title: '送出 10%', text: '十分之一,圣诞老人在鼓掌。' },
  'p-50': { title: '过半', text: '四十一亿个。日历开始着急。' },
  'p-90': { title: '送出 90%', text: '还差一成,雪橇铃已经响了。' },
  'p-100': { title: '82 亿', text: '一个不多,一个不少。' },
  'order-1': { title: '第一单', text: '有人要货,你给了。' },
  'order-10': { title: '十单老顾客', text: '他们说,下次还找你。' },
  'order-30': { title: '三十单', text: '你被写进了顾客的小本子。' },
  'pest-10': { title: '除虫十只', text: '虫子联合会发来了抗议。' },
  'pest-50': { title: '除虫五十只', text: '虫子联合会换了个办公室。' },
  'offer-1': { title: '第一次献果', text: '献出去的,会回来的。' },
  'gold-1': { title: '见过金苹果', text: '它只闪了一下,你记了一辈子。' },
  'kinds-5': { title: '图鉴五种', text: '苹果不止一种红。' },
  'kinds-all': { title: '品种齐全', text: '十五种,一个不落。' },
  'eggs-5': { title: '彩蛋五个', text: '你开始往角落里看了。' },
  'eggs-15': { title: '彩蛋十五个', text: '树说:你是不是闲得慌?' },
  'eggs-all': { title: '彩蛋全收集', text: '没有什么能逃过你的手指。' },
};
