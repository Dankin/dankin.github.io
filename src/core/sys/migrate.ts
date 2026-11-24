// 存档迁移:v4 → v5 运输线从 6 档扩成 9 档(加 挑扁担工/蹦床/直升机)。
// 旧档的运输档索引 0..5(篮子/小推车/卡车/货船/飞机/传送门)映射到新索引 0,2,4,5,7,8,
// 新增的中间档(1/3/6)为"未拥有"。纯函数,不依赖 state.ts。
export const ROUTE_OLD_TO_NEW: readonly number[] = [0, 2, 4, 5, 7, 8];
const ROUTE_N = 9;

export function migrateRouteTiers(s: any): any {
  const r = s?.route;
  if (!r || !Array.isArray(r.units) || r.units.length >= ROUTE_N) return s;
  const units = Array(ROUTE_N).fill(0);
  const ext = Array(ROUTE_N).fill(0);
  const branch = Array(ROUTE_N).fill(-1);
  ROUTE_OLD_TO_NEW.forEach((to, from) => {
    units[to] = r.units[from] ?? 0;
    ext[to] = r.ext?.[from] ?? 0;
    branch[to] = r.branch?.[from] ?? -1;
  });
  const tier = ROUTE_OLD_TO_NEW[Math.min(5, Math.max(0, r.tier | 0))];
  const vehicles = Array.isArray(s.vehicles) ? s.vehicles.map((v: any) => ({ ...v, tier: ROUTE_OLD_TO_NEW[Math.min(5, Math.max(0, v.tier | 0))] })) : s.vehicles;
  const rt = s.tierTimes?.route;
  // tierTimes.route[k] = 升到第 k+1 档的时刻;只搬已拥有的档
  const routeTimes: number[] = [];
  if (Array.isArray(rt)) rt.forEach((t: number, k: number) => { routeTimes[ROUTE_OLD_TO_NEW[k + 1] - 1] = t; });
  return {
    ...s,
    route: { ...r, tier, units, ext, branch },
    vehicles,
    tierTimes: { ...s.tierTimes, route: routeTimes },
  };
}
