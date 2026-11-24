// 苹果品种文案(图鉴用):中文名、搞笑副名、一句图鉴描述、典故、未发现时的剪影提示。
// 纯数据。数值(权重/价值/最低 era)归 src/core/sys/varieties.ts,这里只管字。
// id 与 src/core/sys/varieties.ts 的 AppleKind、plan/20-art.md 的 12+3 款一致:
//   富士红 fuji / 黄元帅 goldenDel / 青苹果 granny / 金苹果 golden / 蛇果 delicious / 粉红佳人 pinkLady
//   红斑 redStreak / 紫玉 purple / 灰银 silver / 虫蛀 worm / 焦糖 caramel / 巨无霸 giant
//   + 肯特之花 kent / 毒苹果 poison / 禁果 forbidden
// 策划稿(plan/10-design.md §4)里的 嘎啦/冰糖心/海棠/青森奇迹 美术清单没有,放在 EXTRA_VARIETIES,
// 未接入数值;要不要上由 lead 定,不用就忽略。
// 约束:desc ≤28 字,nickname ≤8 字,lore ≤60 字。典故里涉及史实的地方措辞留余量("据说""记录"),不下定论。

export type VarietyId =
  | 'fuji' | 'goldenDel' | 'granny' | 'golden' | 'delicious' | 'pinkLady' | 'redStreak'
  | 'purple' | 'silver' | 'worm' | 'caramel' | 'giant' | 'kent' | 'poison' | 'forbidden';

export interface VarietyText {
  id: VarietyId | string;
  /** 图鉴正名(与 core 一致) */
  name: string;
  /** 搞笑副名 */
  nickname: string;
  /** 一句图鉴描述 */
  desc: string;
  /** 典故 */
  lore: string;
  /** 未发现时灰色剪影下的提示(不剧透) */
  hint: string;
}

export const VARIETY_TEXTS: VarietyText[] = [
  {
    id: 'fuji', name: '富士红', nickname: '老实人',
    desc: '最常见,最靠谱,永远在场。',
    lore: '富士苹果由日本育成,名字据说来自育成地藤崎,常被误认成富士山。',
    hint: '树下最先掉的那种。',
  },
  {
    id: 'goldenDel', name: '黄元帅', nickname: '金黄打工人',
    desc: '黄里透绿,甜里带面。',
    lore: '20 世纪初发现于美国西弗吉尼亚的一棵偶然实生树,后来哪儿的果园都有它。',
    hint: '黄黄的,不是金的。',
  },
  {
    id: 'granny', name: '青苹果', nickname: '酸脸先生',
    desc: '酸得很诚实,订单特别爱点它。',
    lore: '以澳大利亚的史密斯奶奶命名,她 19 世纪 60 年代在院子里发现了它。',
    hint: '还没熟?不,它就这样。',
  },
  {
    id: 'delicious', name: '蛇果', nickname: '红衣大侠',
    desc: '深红,发亮,不太笑。',
    lore: '名字里没有蛇。据说是英文 Delicious 的音译,和伊甸园没有关系。',
    hint: '果园壮大之后才见得到。',
  },
  {
    id: 'pinkLady', name: '粉红佳人', nickname: '爱美的人',
    desc: '粉里带红,脆,爱自拍。',
    lore: '澳大利亚育成,学名 Cripps Pink,晚熟,要等一个很长的夏天。',
    hint: '像是把晚霞摘下来了。',
  },
  {
    id: 'redStreak', name: '红斑', nickname: '条纹运动员',
    desc: '红色条纹,跑得很快的样子。',
    lore: '有些苹果披着红条纹,像被日出划了几笔。行话叫"条红"。',
    hint: '山上的苹果,穿着运动服。',
  },
  {
    id: 'caramel', name: '焦糖', nickname: '糖心不糖',
    desc: '咬下去,有一圈蜜。',
    lore: '果肉里糖分多的苹果会透出半透明的"水心",行话叫蜜病,其实没坏。',
    hint: '切开才知道。',
  },
  {
    id: 'purple', name: '紫玉', nickname: '深紫低调',
    desc: '紫得很深,话很少。',
    lore: '紫色来自花青素,和蓝莓、紫甘蓝是一家人。',
    hint: '果城的货架上才有。',
  },
  {
    id: 'silver', name: '灰银', nickname: '月光色',
    desc: '灰银灰银的,像加了滤镜。',
    lore: '没有人说得清它哪来的。看夜班的人说,月亮好的晚上见过。',
    hint: '天上才有的颜色。',
  },
  {
    id: 'worm', name: '虫蛀', nickname: '到此一游',
    desc: '有个洞,有个故事。',
    lore: '每一只虫眼,都是一次未经批准的品尝。点一下,洞就愈合了。',
    hint: '不是每个苹果都完好。',
  },
  {
    id: 'giant', name: '巨无霸', nickname: '占三格',
    desc: '大得不讲道理,一个顶五个。',
    lore: '吉尼斯纪录里最重的苹果约 1.8 公斤,出自日本。这个更大,因为这是游戏。',
    hint: '小心,它在往你这边滚。',
  },
  {
    id: 'golden', name: '金苹果', nickname: '三位女神吵起来了',
    desc: '一闪一闪,据说值一座果山。',
    lore: '神话里,刻着"献给最美者"的金苹果引来了三位女神,后来又引来了特洛伊战争。',
    hint: '金光一闪,别眨眼。',
  },
  {
    id: 'forbidden', name: '禁果', nickname: '树顶那个',
    desc: '长得最高,偷看得最久。',
    lore: '圣经里只写"果子",没说是苹果。是后来的画家,把它画成了苹果。',
    hint: '总是在树顶。',
  },
  {
    id: 'poison', name: '毒苹果', nickname: '不进仓库',
    desc: '红得好看,别咬。点掉它。',
    lore: '格林童话里,王后把毒下在苹果红的那一半。这个仓库不收。',
    hint: '老太太的篮子里。',
  },
  {
    id: 'kent', name: '肯特之花', nickname: '牛顿同款',
    desc: '很老的英国品种,据说有点灵感。',
    lore: '据说牛顿家花园里那棵树结的就是肯特之花。他睡着的时候,它掉了下来。',
    hint: '睡着的人头顶上。',
  },
];

/** 策划稿里有、美术清单里没有的 4 款,未接入数值,先留文案备用 */
export const EXTRA_VARIETY_TEXTS: VarietyText[] = [
  {
    id: 'gala', name: '嘎啦', nickname: '小个子',
    desc: '个头不大,甜得很勤奋。',
    lore: '新西兰育成,红黄相间,是水果篮里最安静的一个。',
    hint: '小小的,红黄相间。',
  },
  {
    id: 'rockCandy', name: '冰糖心', nickname: '蜜斑美人',
    desc: '切开像一块琥珀。',
    lore: '果心里的糖分结成半透明的"糖心",要等霜降前后才好。',
    hint: '要等天冷了。',
  },
  {
    id: 'crabapple', name: '海棠', nickname: '迷你队长',
    desc: '迷你,一把能抓一堆。',
    lore: '海棠果是苹果的小亲戚,小到一口一个,酸得可以转行当糖葫芦。',
    hint: '小到差点没看见。',
  },
  {
    id: 'aomori', name: '青森奇迹', nickname: '木村阿公',
    desc: '从不长虫眼,据说是耐心的结果。',
    lore: '日本青森有位果农,不用农药种了近十年才结果。据说邻居都以为他疯了。',
    hint: '十年磨一果。',
  },
];

export const VARIETY_COUNT = VARIETY_TEXTS.length;
export const VARIETY_BY_ID: Record<string, VarietyText> = Object.fromEntries(
  [...VARIETY_TEXTS, ...EXTRA_VARIETY_TEXTS].map((v) => [v.id, v]),
);

/** 图鉴"品种页"的排列顺序(常见→稀有→剧情) */
export const VARIETY_ORDER: VarietyId[] = [
  'fuji', 'goldenDel', 'granny', 'delicious', 'pinkLady', 'redStreak', 'caramel', 'purple',
  'silver', 'worm', 'giant', 'golden', 'forbidden', 'poison', 'kent',
];
