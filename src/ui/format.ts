/** 中文数字格式:万、亿、万亿 */
export function fmt(n: number): string {
  if (!isFinite(n)) return '∞';
  if (n < 1e4) return n < 10 && n % 1 ? n.toFixed(1) : Math.floor(n).toString();
  const [div, unit] = n < 1e8 ? [1e4, '万'] : n < 1e12 ? [1e8, '亿'] : [1e12, '万亿'];
  const v = n / div;
  const s = v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0);
  return (s.includes('.') ? s.replace(/\.?0+$/, '') : s) + unit;
}

export function fmtDuration(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 1) return '不到 1 分钟';
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  return `${h} 小时 ${m % 60} 分钟`;
}

const f1 = (n: number) => (n < 10 ? n.toFixed(1) : Math.floor(n).toLocaleString('en-US'));

/** 把苹果总数折成看得见的东西。取"不超过当前数量的最大单位"。 */
const EQUIV: Array<[number, (n: number) => string]> = [
  [6, (n) => `${f1(n)} 袋苹果`],
  [50, (n) => `${f1(n)} 箱苹果`],
  [4e3, (n) => `${f1(n)} 托盘苹果`],
  [1e5, (n) => `${f1(n)} 卡车苹果(每车 20 吨)`],
  [2.4e7, (n) => `${f1(n)} 个上海的人口,每人一个`],
  [5e7, (n) => `${f1(n)} 艘万吨货轮的苹果`],
  [1.4e9, (n) => `${f1(n)} 个中国的人口,每人一个`],
  [8.2e9, () => '地球上每个人,都有一个苹果'],
];

export function equiv(n: number): string {
  let hit = -1;
  for (let i = 0; i < EQUIV.length; i++) if (n >= EQUIV[i][0]) hit = i;
  if (hit < 0) return '';
  const [size, label] = EQUIV[hit];
  return '≈ ' + label(n / size);
}
