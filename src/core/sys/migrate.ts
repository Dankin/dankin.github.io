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

// ───────── v6 → v7(v6 重设计)─────────
// 产出线 6 档 → 5 档:果园/果山/果城/果星/苹果之门 → 老树/巨树/云树/星树。
//   旧 0,1,2,3,4,5 → 新 0,1,2,3,3,4(旧"果星"并入云树,旧"苹果之门"=星树)。
// 运输线 9 档 → 8 档:蹦床删除。旧 0..8 → 新 0,1,2,2,3,4,5,6,7(蹦床并入小推车)。
// 槽位(gates/gatesUnlocked)删除。合并的档取"拥有更高的那档"的单位数/扩建/分支,不重复发放。
export const SOURCE_V6_TO_V7: readonly number[] = [0, 1, 2, 3, 3, 4];
export const ROUTE_V6_TO_V7: readonly number[] = [0, 1, 2, 2, 3, 4, 5, 6, 7];

function remapLine(line: any, map: readonly number[], n: number, unitsDefault: number): any {
  if (!line || !Array.isArray(line.units)) return line;
  const old = map.length;
  const units = Array(n).fill(0);
  const ext = Array(n).fill(0);
  const branch = Array(n).fill(-1);
  const curOld = Math.min(old - 1, Math.max(0, line.tier | 0));
  for (let i = 0; i < old; i++) {
    const to = map[i];
    // 同一个新档由多个旧档合并时,优先保留当前所在旧档(或更高的旧档)的数据
    const better = i >= curOld || units[to] === 0;
    const owned = i <= curOld;
    if (!owned) continue;
    if (better || (line.units[i] ?? 0) > units[to]) {
      units[to] = Math.max(units[to], line.units[i] ?? unitsDefault);
      ext[to] = Math.max(ext[to], line.ext?.[i] ?? 0);
      if ((line.branch?.[i] ?? -1) >= 0) branch[to] = line.branch[i];
    }
  }
  return { ...line, tier: map[curOld], units, ext, branch };
}

function remapTimes(times: any, map: readonly number[]): number[] {
  const out: number[] = [];
  if (!Array.isArray(times)) return out;
  // times[k] = 升到第 k+1 档的时刻
  times.forEach((t: number, k: number) => {
    const to = map[k + 1] - 1;
    if (to >= 0 && map[k + 1] > map[k] && out[to] === undefined) out[to] = t;
  });
  return out;
}

export function migrateV6Redesign(s: any): any {
  const { gates: _g, gatesUnlocked: _gu, ...rest } = s ?? {};
  const out: any = { ...rest };
  out.source = remapLine(s.source, SOURCE_V6_TO_V7, 5, 0);
  out.route = remapLine(s.route, ROUTE_V6_TO_V7, 8, 0);
  if (Array.isArray(s.vehicles)) {
    out.vehicles = s.vehicles.map((v: any) => ({ ...v, tier: ROUTE_V6_TO_V7[Math.min(8, Math.max(0, v.tier | 0))] }));
  }
  if (s.tierTimes) {
    out.tierTimes = { ...s.tierTimes, source: remapTimes(s.tierTimes.source, SOURCE_V6_TO_V7), route: remapTimes(s.tierTimes.route, ROUTE_V6_TO_V7) };
  }
  return out;
}
