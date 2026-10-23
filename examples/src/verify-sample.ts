/**
 * 验收台的合成场（「七项自检」用的自带数据）：一对 u/v 场 + 一份压小量级的杆口径。
 *
 * 单独成文件是为了能在 node（vitest）里直接测——`verify-main.ts` 是「import 即挂载」的
 * 脚本，不能被测试导入；合成场本身是纯数据，必须能脱离 DOM 验证（否则页面假绿没人知道）。
 */
import { parseGrid, serializeGrid, windProfile, type Grid, type GridHeader } from "@metweave/grid";
import type { BarbSpec, ElementProfile } from "@metweave/grid";

/**
 * 网格规模：30×24、1° 网格覆盖 48N→25N／95E→124E（zoom 4–7 的视口都放得下）。
 * 注意 `la0` 是**北界**：`windBarbsOf` 按 `lat = la0 - y*dj` 往南推（N2S 行序）。
 */
const NX = 30;
const NY = 24;

const windHeaderOf = (variable: string): GridHeader => ({
  version: 1,
  variable,
  level: "10m",
  unit: "m s-1",
  grid: { nx: NX, ny: NY, la0: 48, lo0: 95, di: 1, dj: 1, order: "N2S,W2E,row-major" },
  stats: { min: 0, max: 32, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p99: 0 },
  meta: {
    referenceTime: "2026-10-23T00:00Z",
    forecastHour: 0,
    source: "verify 合成场",
    license: "",
    generated: "2026-10-23",
  },
});

/**
 * 一对 u/v 分量场：u 自西向东 2 → 32 m/s 递增、v 恒 0（全场西风，来向 270°）。
 * 西侧三列置 0（成片静风区，用来看「静风不出杆」）。
 */
export const sampleWindPair = (): { u: Grid; v: Grid } => {
  const uValues: number[] = [];
  const vValues: number[] = [];
  for (let row = 0; row < NY; row++) {
    for (let col = 0; col < NX; col++) {
      const base = col < 3 ? 0 : 2 + ((col - 3) / (NX - 4)) * 30;
      uValues.push(Math.round(base * 100) / 100);
      vValues.push(0);
    }
  }
  return {
    u: parseGrid(serializeGrid(windHeaderOf("UGRD"), uValues)),
    v: parseGrid(serializeGrid(windHeaderOf("VGRD"), vValues)),
  };
};

/** 杆密度口径（把缺省 step 与 LOD 阶梯压到小场能看出差别的量级）。 */
export const DENSITY_BARBS: BarbSpec = {
  ...(windProfile.barbs ?? { step: 10, calmThreshold: 1 }),
  step: 8,
  lod: [
    { zoom: 3, step: 12 },
    { zoom: 5, step: 8 },
    { zoom: 7, step: 4 },
    { zoom: 9, step: 2 },
  ],
};

/** 档案变体：色斑色标沿用 windProfile，只换杆口径（其余与真实档案一致）。 */
export const DENSITY_PROFILE: ElementProfile = {
  ...windProfile,
  renderForm: "filled+barbs",
  barbs: DENSITY_BARBS,
};
