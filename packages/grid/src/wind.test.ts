/**
 * 风场内核测试：双分量合成 windSpeedGrid（√(u²+v²) 数学、NaN 传播、合成头口径
 * 〔variable WIND/层单位沿 u/stats 现算〕、网格不匹配与量纲不匹配的显式报错）与
 * 风向杆位序列 windBarbsOf（抽稀格位与中心对齐、气象来向口径的数学锚——西风 270/
 * 南风 180、速度同源、静风阈与缺测不出杆、口径非法抛错）。纯函数零 DOM，Node 直测。
 */
import { describe, expect, it } from "vitest";
import { windSpeedGrid, windBarbsOf, computeStats, GridError, type Grid } from "./index";

/** 最小网格工厂：u/v 同几何（2×2 起步），值按行序西→东。 */
const gridOf = (
  variable: string,
  values: number[],
  overrides: Partial<Grid["header"]> = {},
): Grid => ({
  header: {
    version: 1,
    variable,
    level: "10m",
    unit: "m s-1",
    grid: { nx: 2, ny: 2, la0: 40, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
    stats: computeStats(Float32Array.from(values)),
    meta: {
      referenceTime: "2026-10-06T18:00Z",
      forecastHour: 0,
      source: "test",
      license: "",
      generated: "2026-10-07",
    },
    ...overrides,
  },
  values: Float32Array.from(values),
});

describe("windSpeedGrid（双分量合成）", () => {
  it("√(u²+v²) 逐点合成（3-4-5 锚）", () => {
    const speed = windSpeedGrid(gridOf("UGRD", [3, -3, 0, 6]), gridOf("VGRD", [4, 4, -5, 0]));
    expect([...speed.values].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([5, 5, 5, 6]);
  });

  it("任一分量 NaN → 该点 NaN（矢量未知；hypot 天然传播）", () => {
    const speed = windSpeedGrid(gridOf("UGRD", [Number.NaN, 3]), gridOf("VGRD", [4, Number.NaN]));
    expect(Number.isNaN(speed.values[0])).toBe(true);
    expect(Number.isNaN(speed.values[1])).toBe(true);
  });

  it("合成头口径：variable WIND、层/单位/几何/meta 沿 u 场头，stats 对合成值现算", () => {
    const u = gridOf("UGRD", [3, 3, 3, 3]);
    const v = gridOf("VGRD", [4, 4, 4, 4]);
    const speed = windSpeedGrid(u, v);
    expect(speed.header.variable).toBe("WIND");
    expect(speed.header.level).toBe("10m"); // 沿 u（合成场与分量同层）
    expect(speed.header.unit).toBe("m s-1");
    expect(speed.header.grid).toEqual(u.header.grid);
    expect(speed.header.meta).toEqual(u.header.meta);
    // stats 是风速分布（非 u 分量分布）——色斑/图例直读合成口径的依据
    expect(speed.header.stats.min).toBeCloseTo(5, 6);
    expect(speed.header.stats.max).toBeCloseTo(5, 6);
    expect(speed.header.stats.p50).toBeCloseTo(5, 6);
  });

  it("两场网格几何不匹配 → 显式抛错（不静默错配对）", () => {
    const u = gridOf("UGRD", [1, 2, 3, 4]);
    const v = gridOf("VGRD", [1, 2, 3, 4], {
      grid: { nx: 2, ny: 2, la0: 41, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
    });
    expect(() => windSpeedGrid(u, v)).toThrow(GridError);
    expect(() => windSpeedGrid(u, v)).toThrow(/网格几何不匹配/);
  });

  it("两场量纲不匹配 → 显式抛错（√(u²+v²) 只在同量纲下成立）", () => {
    const u = gridOf("UGRD", [1, 2, 3, 4]);
    const v = gridOf("VGRD", [1, 2, 3, 4], { unit: "kt" });
    expect(() => windSpeedGrid(u, v)).toThrow(/量纲不匹配/);
  });
});

describe("windBarbsOf（风向杆位序列）", () => {
  /** 均匀场工厂（nx×ny 全点同 u/v）——方向/速度断言的最小底座。 */
  const uniform = (nx: number, ny: number, uu: number, vv: number): [Grid, Grid] => {
    const u = gridOf(
      "UGRD",
      Array.from({ length: nx * ny }, () => uu),
    );
    const v = gridOf(
      "VGRD",
      Array.from({ length: nx * ny }, () => vv),
    );
    const geometry = {
      nx,
      ny,
      la0: 40,
      lo0: 100,
      di: 1,
      dj: 1,
      order: "N2S,W2E,row-major",
    } as const;
    u.header.grid = geometry;
    v.header.grid = geometry;
    return [u, v];
  };

  it("气象来向口径：纯西风分量（u>0,v=0）→ 风向 270、纯南风分量（v>0,u=0）→ 180、3-4-5 → 216.87°", () => {
    const [uE, vE] = uniform(4, 4, 3, 0);
    const east = windBarbsOf(uE, vE, { step: 1, calmThreshold: 0 });
    expect(east[0]?.direction).toBe(270); // 向东吹＝西风（来向 270）
    const [uN, vN] = uniform(4, 4, 0, 3);
    const north = windBarbsOf(uN, vN, { step: 1, calmThreshold: 0 });
    expect(north[0]?.direction).toBe(180); // 向北吹＝南风（来向 180）
    const [u34, v34] = uniform(4, 4, 3, 4);
    const sw = windBarbsOf(u34, v34, { step: 1, calmThreshold: 0 });
    expect(sw[0]?.direction).toBeCloseTo(270 - 53.1301, 3); // atan2(4,3)=53.13° → 来向 216.87
    expect(sw[0]?.speed).toBeCloseTo(5, 6); // 速度与 windSpeedGrid 同源同值
  });

  it("抽稀：两向同 step、起点对网格中心对齐（5×4、step 2 → 列 0/2/4 行 0/2 共 6 杆）", () => {
    const [u, v] = uniform(5, 4, 3, 4);
    const barbs = windBarbsOf(u, v, { step: 2, calmThreshold: 0 });
    // 列起点 floor(((5-1)%2)/2)=0 → 0,2,4；行起点 floor(((4-1)%2)/2)=0 → 0,2
    expect(barbs).toHaveLength(6);
    const lons = new Set(barbs.map((b) => b.lon));
    const lats = new Set(barbs.map((b) => b.lat));
    expect(lons).toEqual(new Set([100, 102, 104]));
    expect(lats).toEqual(new Set([40, 38]));
  });

  it("中国域 280×208、step 10 的实际抽稀位（列 4 起、行 3 起——中心对齐）", () => {
    const [u, v] = uniform(280, 208, 3, 4);
    const geometry = {
      nx: 280,
      ny: 208,
      la0: 55,
      lo0: 70,
      di: 0.25,
      dj: 0.25,
      order: "N2S,W2E,row-major",
    } as const;
    u.header.grid = geometry;
    v.header.grid = geometry;
    const barbs = windBarbsOf(u, v, { step: 10, calmThreshold: 0 });
    const first = barbs[0];
    expect(first).toBeDefined();
    expect(first?.lat).toBeCloseTo(55 - 3 * 0.25, 10); // 行首 3（中心对齐）
    expect(first?.lon).toBeCloseTo(70 + 4 * 0.25, 10); // 列首 4
    expect(first?.direction).toBeCloseTo(270 - (Math.atan2(4, 3) * 180) / Math.PI, 10);
    expect(first?.speed).toBeCloseTo(5, 10);
    expect(barbs).toHaveLength(28 * 21); // 28 列 × 21 行＝588 格位（2.5° 一根）
  });

  it("静风阈：风速 < calmThreshold 不出杆（=阈值照出——左开右闭由「低于」语义定）", () => {
    const [u, v] = uniform(4, 4, 0.5, 0); // 风速 0.5
    expect(windBarbsOf(u, v, { step: 1, calmThreshold: 1 })).toHaveLength(0);
    const [u1, v1] = uniform(4, 4, 1, 0); // 风速恰 1
    expect(windBarbsOf(u1, v1, { step: 1, calmThreshold: 1 })).toHaveLength(16);
  });

  it("缺测：任一分量 NaN 的格点不出杆（矢量未知）", () => {
    const u = gridOf("UGRD", [Number.NaN, 3, 3, 3]);
    const v = gridOf("VGRD", [4, 4, 4, 4]);
    const geometry = {
      nx: 4,
      ny: 1,
      la0: 40,
      lo0: 100,
      di: 1,
      dj: 1,
      order: "N2S,W2E,row-major",
    } as const;
    u.header.grid = geometry;
    v.header.grid = geometry;
    const barbs = windBarbsOf(u, v, { step: 1, calmThreshold: 0 });
    expect(barbs).toHaveLength(3); // 首格缺测跳过
  });

  it("口径非法抛错：step 非正整数／calmThreshold 负数／两场不匹配", () => {
    const [u, v] = uniform(2, 2, 3, 4);
    expect(() => windBarbsOf(u, v, { step: 0, calmThreshold: 1 })).toThrow(/步长非法/);
    expect(() => windBarbsOf(u, v, { step: 1.5, calmThreshold: 1 })).toThrow(/步长非法/);
    expect(() => windBarbsOf(u, v, { step: 1, calmThreshold: -0.1 })).toThrow(/静风阈值非法/);
    const vWrong = gridOf("VGRD", [1, 2, 3, 4], {
      grid: { nx: 4, ny: 1, la0: 40, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
    });
    expect(() => windBarbsOf(u, vWrong, { step: 1, calmThreshold: 1 })).toThrow(/不匹配/);
  });
});
