/**
 * @metweave/grid — 双分量风场合成与风向杆位序列（风切片、第十三切片引入）。
 *
 * 两个能力均为纯函数、零 DOM（Node 可测）：
 * - `windSpeedGrid`：u/v 双场 → 风速合成场 √(u²+v²)——**前端派生显示量，存储不动**
 *  （.mwgrid 容器各自原值装载 u/v，合成只发生在渲染/显示侧——docs/10 十五节表 B
 *  「10u/10v 不作独立色斑、渲染目标=风速合成」口径）；
 * - `windBarbsOf`：u/v 双场 × 档案杆口径 → 杆位序列 [{lat, lon, direction, speed}]
 *  （抽稀步长×静风阈，风向 atan2 同源派生）——宿主（@metweave/leaflet 的
 *  addWindBarbLayer）只做矢量装配，几何与数学全在此层（Node 可测）。
 *
 * 缺测语义（与色斑/等值线同一纪律）：u/v 任一分量 NaN → 该点风速 NaN（矢量未知，
 * 透明/不画杆）——Math.hypot 的 NaN 传播天然给出该语义，无需显式分支。
 */
import { GridError } from "./errors";
import { computeStats } from "./format";
import type { Grid } from "./format";
import type { BarbSpec } from "./element";

/**
 * 双场一致性校验：网格几何（nx/ny/la0/lo0/di/dj）与量纲（unit）逐项相等——合成是
 * 逐点配对运算，两场不同网格/不同量纲即数学上不成立，显式抛错（不静默纪律）。
 */
function assertPairedFields(u: Grid, v: Grid): void {
  const gu = u.header.grid;
  const gv = v.header.grid;
  if (
    gu.nx !== gv.nx ||
    gu.ny !== gv.ny ||
    gu.la0 !== gv.la0 ||
    gu.lo0 !== gv.lo0 ||
    gu.di !== gv.di ||
    gu.dj !== gv.dj
  ) {
    throw new GridError(
      "grid-mismatch",
      `双分量场网格几何不匹配（u ${gu.nx}×${gu.ny} @(${gu.la0},${gu.lo0}) ±${gu.di}/${gu.dj}` +
        ` ≠ v ${gv.nx}×${gv.ny} @(${gv.la0},${gv.lo0}) ±${gv.di}/${gv.dj}）——无法逐点配对合成`,
    );
  }
  if (u.header.unit !== v.header.unit) {
    throw new GridError(
      "grid-mismatch",
      `双分量场量纲不匹配（u "${u.header.unit}" ≠ v "${v.header.unit}"）——√(u²+v²) 只在同量纲下成立`,
    );
  }
}

/**
 * u/v 双场 → 风速合成场（√(u²+v²)，逐点 Math.hypot——分量量级悬殊时不溢出）。
 *
 * **存储不动的红线**：u/v 各自的 .mwgrid 原值装载，本函数是显示侧的派生装配——
 * 产物头 variable "WIND"（gen:grid CLI wind 条目 label WIND/10m 同名；分量文件头为
 * UGRD/VGRD，层与单位沿 u 场头——m/s 标量场），stats 对合成值现算（直读产物的
 * 色斑/图例拿到的是风速分布，不是 u 分量分布），meta 沿 u 场头（两文件同 cycle
 * 同源产出）。任一分量 NaN → 该点 NaN（矢量未知；hypot 天然传播）。
 */
export function windSpeedGrid(u: Grid, v: Grid): Grid {
  assertPairedFields(u, v);
  const n = u.values.length;
  const speeds = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    speeds[i] = Math.hypot(u.values[i] ?? Number.NaN, v.values[i] ?? Number.NaN);
  }
  return {
    header: {
      version: 1,
      variable: "WIND",
      level: u.header.level,
      unit: u.header.unit,
      grid: u.header.grid,
      stats: computeStats(speeds),
      meta: u.header.meta,
    },
    values: speeds,
  };
}

/** 一根风向杆：位置（格点中心）＋风向（气象口径）＋合成风速。 */
export interface WindBarb {
  readonly lat: number;
  readonly lon: number;
  /** 风向（气象口径**来向**，0–360°，北 0／东 90／南 180／西 270；由 atan2(v,u) 派生：dir = (270° − atan2 角) mod 360） */
  readonly direction: number;
  /** 合成风速 √(u²+v²)（m/s，与 windSpeedGrid 同源同值——宿主无需二次合成） */
  readonly speed: number;
}

/**
 * 杆口径校验（与 assertBreaks/assertContourSpec 同一道关口纪律）。
 */
function assertBarbSpec(spec: BarbSpec): void {
  if (!Number.isInteger(spec.step) || spec.step < 1) {
    throw new GridError(
      "invalid-scale",
      `风向杆抽稀步长非法（step=${String(spec.step)}，须 ≥1 的整数）`,
    );
  }
  if (!Number.isFinite(spec.calmThreshold) || spec.calmThreshold < 0) {
    throw new GridError(
      "invalid-scale",
      `风向杆静风阈值非法（calmThreshold=${String(spec.calmThreshold)}，须 ≥0 的有限数）`,
    );
  }
}

/**
 * u/v 双场 × 杆口径 → 杆位序列（抽稀格点上的风向/风速，纯函数）。
 *
 * 抽稀＝两向同 step 的格点子采样，起点对网格中心对齐（`floor(((n−1) % step) / 2)`——
 * 中国域 280×208、step 10 时列首 4／行首 3，约 560 个格位）；**缩放无关固定步长**
 * （v1 无 LOD：密度只由档案 step 声明，不随 zoom 变）。方向读格点原值（不插值——
 * 杆是点观测语义，格点值即代表值）。静风阈（calmThreshold）以下与任一分量 NaN 的
 * 格点不出杆（静风无方向可读、缺测无值可画）。风向＝气象来向口径：
 * `dir = (270° − atan2(v, u)·180/π) mod 360`（u>0,v=0 西风 270、v>0,u=0 南风 180）。
 */
export function windBarbsOf(u: Grid, v: Grid, spec: BarbSpec): WindBarb[] {
  assertPairedFields(u, v);
  assertBarbSpec(spec);
  const { nx, ny, la0, lo0, di, dj } = u.header.grid;
  const x0 = Math.floor(((nx - 1) % spec.step) / 2);
  const y0 = Math.floor(((ny - 1) % spec.step) / 2);
  const barbs: WindBarb[] = [];
  for (let y = y0; y < ny; y += spec.step) {
    for (let x = x0; x < nx; x += spec.step) {
      const uu = u.values[y * nx + x] ?? Number.NaN;
      const vv = v.values[y * nx + x] ?? Number.NaN;
      if (Number.isNaN(uu) || Number.isNaN(vv)) continue; // 缺测：矢量未知不画杆
      const speed = Math.hypot(uu, vv);
      if (speed < spec.calmThreshold) continue; // 静风：无方向可读不画杆
      const direction = (((270 - (Math.atan2(vv, uu) * 180) / Math.PI) % 360) + 360) % 360;
      barbs.push({ lat: la0 - y * dj, lon: lo0 + x * di, direction, speed });
    }
  }
  return barbs;
}
