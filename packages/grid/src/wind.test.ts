/**
 * 风场内核测试：双分量合成 windSpeedGrid（√(u²+v²) 数学、NaN 传播、合成头口径
 * 〔variable WIND/层单位沿 u/stats 现算〕、网格不匹配与量纲不匹配的显式报错）与
 * 风向杆位序列 windBarbsOf（抽稀格位与中心对齐、气象来向口径的数学锚——西风 270/
 * 南风 180、速度同源、静风阈与缺测不出杆、口径非法抛错）。纯函数零 DOM，Node 直测。
 */
import { describe, expect, it } from "vitest";
import {
  windSpeedGrid,
  windBarbsOf,
  windBarbOf,
  streamlinesOf,
  arrowFieldOf,
  windDirectionOf,
  windAt,
  windProfileOf,
  windTimeHeightOf,
  toKnots,
  toMps,
  WIND_BARB_SCALES,
  computeStats,
  GridError,
  type Grid,
  type BarbSpec,
} from "./index";

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

/** 均匀场工厂（nx×ny 全点同 u/v）——方向/速度断言的最小底座（只依赖模块层 gridOf，置模块层）。 */
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

describe("windBarbsOf（风向杆位序列）", () => {
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

/** 编码三元组投影（只比计数——encodedSpeed 的浮点另测）。 */
const codeOf = (speed: number, unit: "m/s" | "kt", calmThreshold = 0): number[] | null => {
  // 编码断言一律显式 calmThreshold: 0（本组测的是编码，不是静风判定；缺省 1 另测）
  const enc = windBarbOf(0, speed, { unit, calmThreshold });
  return enc === null ? null : [enc.pennants, enc.longs, enc.shorts];
};

describe("windBarbOf（单点风羽原语，0.3.2 T1）", () => {
  it("m/s 口径：旗 20／长划 4／短划 2（0/2/4/5/20/33 六锚点）", () => {
    expect(codeOf(0, "m/s")).toEqual([0, 0, 0]);
    expect(codeOf(2, "m/s")).toEqual([0, 0, 1]);
    expect(codeOf(4, "m/s")).toEqual([0, 1, 0]);
    expect(codeOf(5, "m/s")).toEqual([0, 1, 0]); // 向下取整到刻度：5 → 4
    expect(codeOf(20, "m/s")).toEqual([1, 0, 0]);
    expect(codeOf(33, "m/s")).toEqual([1, 3, 0]); // 33 → 32＝20＋4×3
  });

  it("kt 口径：旗 50／长划 10／短划 5（0/5/10/50/65 五锚点）", () => {
    expect(codeOf(0, "kt")).toEqual([0, 0, 0]);
    expect(codeOf(5, "kt")).toEqual([0, 0, 1]);
    expect(codeOf(10, "kt")).toEqual([0, 1, 0]);
    expect(codeOf(50, "kt")).toEqual([1, 0, 0]);
    expect(codeOf(65, "kt")).toEqual([1, 1, 1]); // 50＋10＋5
  });

  it("同一根杆两套口径形态不同（20 m/s＝1 旗；≈39 kt＝3 长划＋1 短划、无旗）", () => {
    expect(codeOf(20, "m/s")).toEqual([1, 0, 0]);
    expect(codeOf(39, "kt")).toEqual([0, 3, 1]);
  });

  it("encodedSpeed ≤ 入参，且差值 < 最小刻度（两口径同断言）", () => {
    for (const unit of ["m/s", "kt"] as const) {
      const min = WIND_BARB_SCALES[unit].short;
      for (const speed of [0, 1.9, 3.99, 20, 33.7, 64.4]) {
        const enc = windBarbOf(0, speed, { unit, calmThreshold: 0 });
        expect(enc).not.toBeNull();
        if (enc === null) continue;
        expect(enc.encodedSpeed).toBeLessThanOrEqual(speed + 1e-6);
        expect(speed - enc.encodedSpeed).toBeLessThan(min + 1e-6);
      }
    }
  });

  it("浮点边界与 v0.3.1 几何实现同算法（19.999999 m/s 不出旗，出 4 长划＋1 短划）", () => {
    expect(codeOf(19.999999, "m/s")).toEqual([0, 4, 1]);
    expect(codeOf(49.999999, "kt")).toEqual([0, 4, 1]);
  });

  it("静风：缺省阈 1（业务惯例，与档案同值）；speed < 阈值 → null，= 阈值照出编码", () => {
    // 缺省即判静风（产品审查 2.6：自绘层与地图层不该一个画一个不画）
    expect(windBarbOf(0, 0)).toBeNull();
    expect(windBarbOf(0, 0.9)).toBeNull();
    expect(windBarbOf(0, 1)).not.toBeNull();
    // 显式传 0＝不判静风：0 风速给零羽编码（有杆无羽，v0.3.1 几何语义）
    expect(windBarbOf(0, 0, { calmThreshold: 0 })).toEqual({
      unit: "m/s",
      pennants: 0,
      longs: 0,
      shorts: 0,
      encodedSpeed: 0,
    });
    // kt 口径阈值同量纲：缺省 1 kt ≈ 0.51 m/s
    expect(windBarbOf(0, 0.4, { unit: "kt" })).toBeNull();
    expect(windBarbOf(0, 1.2, { unit: "kt" })).not.toBeNull();
  });

  it('单位别名："mps" 等价 "m/s"（IR 的 SpeedUnit 写法直接可用）', () => {
    expect(windBarbOf(0, 20, { unit: "mps" })).toEqual(windBarbOf(0, 20, { unit: "m/s" }));
    expect(codeOf(20, "mps" as never)).toEqual([1, 0, 0]);
    expect(windBarbOf(0, 20, { unit: "mps" })?.unit).toBe("m/s"); // 归一化后的规范名
  });

  it("校验：方向越界/非有限、风速负数/非有限、unit 非法、阈值负数、未知选项键", () => {
    expect(() => windBarbOf(-1, 5)).toThrow(/方向非法/);
    expect(() => windBarbOf(361, 5)).toThrow(/方向非法/);
    expect(() => windBarbOf(Number.NaN, 5)).toThrow(/方向非法/);
    expect(() => windBarbOf(0, -0.1)).toThrow(/风速非法/);
    expect(() => windBarbOf(0, Number.POSITIVE_INFINITY)).toThrow(/风速非法/);
    expect(() => windBarbOf(0, 5, { unit: "kmh" as never })).toThrow(/不受支持/);
    expect(() => windBarbOf(0, 5, { calmThreshold: -1 })).toThrow(/静风阈值非法/);
    expect(() => windBarbOf(0, 5, { unit: "kt", signed: true } as never)).toThrow(/未知选项/);
  });

  it("换算工具往返：toKnots / toMps 互为逆运算（口径切换不用自己记常数）", () => {
    for (const mps of [0, 5, 20, 33.5, 75]) {
      expect(toMps(toKnots(mps))).toBeCloseTo(mps, 9);
    }
    expect(toKnots(20)).toBeCloseTo(38.877, 3); // 20 m/s ≈ 38.9 kt（kt 填图的最小刻度 5）
  });

  it("360° 与 0° 同义（正北两种编法都收）", () => {
    expect(windBarbOf(0, 10)).toEqual(windBarbOf(360, 10));
  });
});

/** LOD 测试的杆口径工厂（模块级——不捕获 describe 作用域）。 */
const specOf = (lod?: BarbSpec["lod"]): BarbSpec =>
  lod === undefined ? { step: 2, calmThreshold: 0 } : { step: 2, calmThreshold: 0, lod };

describe("windBarbsOf LOD（按放大档抽稀，0.3.2 T5）", () => {
  it("三档 zoom 杆数递增（放大更密）且格位无重复", () => {
    const [u, v] = uniform(5, 4, 3, 4);
    const lod = [
      { zoom: 0, step: 4 },
      { zoom: 5, step: 2 },
      { zoom: 7, step: 1 },
    ];
    const counts = [0, 5, 7].map((zoom) => windBarbsOf(u, v, specOf(lod), { zoom }).length);
    expect(counts).toEqual([2, 6, 20]);
    for (const zoom of [0, 5, 7]) {
      const barbs = windBarbsOf(u, v, specOf(lod), { zoom });
      const keys = new Set(barbs.map((b) => `${b.lat},${b.lon}`));
      expect(keys.size).toBe(barbs.length);
    }
  });

  it("不传 zoom / 档案无 lod → 与 0.3.1 同结果（回落 spec.step）", () => {
    const [u, v] = uniform(5, 4, 3, 4);
    const base = windBarbsOf(u, v, specOf());
    expect(
      windBarbsOf(
        u,
        v,
        specOf([
          { zoom: 0, step: 4 },
          { zoom: 5, step: 2 },
        ]),
      ),
    ).toEqual(base);
    expect(windBarbsOf(u, v, specOf(), { zoom: 0 })).toEqual(base);
  });

  it("zoom 低于首级 → 用首级（不落到 spec.step）", () => {
    const [u, v] = uniform(5, 4, 3, 4);
    const lod = [
      { zoom: 3, step: 4 },
      { zoom: 6, step: 2 },
    ];
    expect(windBarbsOf(u, v, specOf(lod), { zoom: 0 }).length).toBe(
      windBarbsOf(u, v, specOf(lod), { zoom: 3 }).length,
    );
  });

  it("阶梯校验：空数组／zoom 不递增／step 不递减／step 非整数／zoom 非有限", () => {
    const [u, v] = uniform(2, 2, 3, 4);
    expect(() => windBarbsOf(u, v, specOf([]))).toThrow(/LOD 阶梯为空/);
    expect(() =>
      windBarbsOf(
        u,
        v,
        specOf([
          { zoom: 5, step: 2 },
          { zoom: 5, step: 1 },
        ]),
      ),
    ).toThrow(/zoom 须严格递增/);
    expect(() =>
      windBarbsOf(
        u,
        v,
        specOf([
          { zoom: 0, step: 2 },
          { zoom: 5, step: 4 },
        ]),
      ),
    ).toThrow(/step 须严格递减/);
    expect(() => windBarbsOf(u, v, specOf([{ zoom: 0, step: 1.5 }]))).toThrow(/step 非法/);
    expect(() => windBarbsOf(u, v, specOf([{ zoom: Number.NaN, step: 1 }]))).toThrow(/zoom 非法/);
  });

  it("zoom 非有限数与未知选项键显式抛错", () => {
    const [u, v] = uniform(2, 2, 3, 4);
    expect(() => windBarbsOf(u, v, specOf(), { zoom: Number.NaN })).toThrow(/zoom 非有限数/);
    expect(() => windBarbsOf(u, v, specOf(), { zoom: 3, step: 1 } as never)).toThrow(/未知选项/);
  });
});

/** 流线场工厂：带真几何（nx/ny/la0 可调、lo0=100、格距 1°），值按 (x,y) 现填。 */
const flowFieldOf = (
  nx: number,
  ny: number,
  la0: number,
  fill: (x: number, y: number) => number,
): Grid =>
  gridOf(
    "UGRD",
    Array.from({ length: nx * ny }, (_, i) => fill(i % nx, Math.floor(i / nx))),
    { grid: { nx, ny, la0, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" } },
  );

describe("streamlinesOf（流线积分，v0.3.4 矢量批次首件）", () => {
  it("均匀东风场 → 沿流向东行的平直线族：纬度严格不动、经度严格递增", () => {
    const u = flowFieldOf(9, 5, 4, () => 4);
    const v = flowFieldOf(9, 5, 4, () => 0);
    const lines = streamlinesOf(u, v, { seedSpacing: 4, maxSteps: 50, step: 1, calmThreshold: 1 });
    expect(lines).toHaveLength(6); // x∈{0,4,8} × y∈{0,4}（中心对齐同杆抽稀公式）
    for (const line of lines) {
      expect(line.steps).toBe(line.points.length - 1);
      const lat0 = line.points[0]?.lat;
      expect(lat0).toBeDefined();
      for (const p of line.points) expect(p.lat).toBeCloseTo(lat0 as number, 12); // v≡0 → dy≡0
      for (let i = 1; i < line.points.length; i++) {
        expect(line.points[i]?.lon).toBeGreaterThan(line.points[i - 1]?.lon as number);
      }
    }
  });

  it("出界即止：西缘种子后向零点，全线不越西缘（la0=5 避开 cosφ=1 的整步巧落）", () => {
    const u = flowFieldOf(9, 5, 5, () => 4);
    const v = flowFieldOf(9, 5, 5, () => 0);
    const lines = streamlinesOf(u, v, { seedSpacing: 4, maxSteps: 50, step: 1, calmThreshold: 1 });
    expect(lines).toHaveLength(6);
    for (const line of lines) {
      for (const p of line.points) expect(p.lon).toBeGreaterThanOrEqual(100); // 永不越西缘
    }
    const west = lines.filter((l) => l.points[0]?.lon === 100); // 西缘 x=0 两颗种子（y∈{0,4}）
    expect(west).toHaveLength(2);
  });

  it("maxSteps 单向截断（旋转场不自然收敛）：前+后各 3 步、点数 7", () => {
    const u = flowFieldOf(8, 8, 4, (_x, y) => 3 * (y - 3.5));
    const v = flowFieldOf(8, 8, 4, (x) => 3 * (x - 3.5));
    const lines = streamlinesOf(u, v, {
      seedSpacing: 5,
      maxSteps: 3,
      step: 0.25,
      calmThreshold: 1,
    });
    expect(lines).toHaveLength(4); // x0=floor((7%5)/2)=1 → {1,6}²，四颗全内部种子
    for (const line of lines) {
      expect(line.steps).toBe(6);
      expect(line.points).toHaveLength(7);
    }
  });

  it("刚体旋转场轨迹有界（RK2 保半径），步长减半偏差更小", () => {
    // u=+3(y−6)、v=+3(x−6)（u 沿 lat 轴、v 沿 lon 轴）＝物理旋转场；u 符号填反会
    // 退化成鞍点（双曲流），轨迹理应发散——此测试同时钉住这一坑
    const u = flowFieldOf(13, 13, 6, (_x, y) => 3 * (y - 6));
    const v = flowFieldOf(13, 13, 6, (x) => 3 * (x - 6));
    const drift = (step: number): number => {
      const lines = streamlinesOf(u, v, { seedSpacing: 5, maxSteps: 600, step, calmThreshold: 1 });
      let max = 0;
      for (const line of lines) {
        // 旋转中心＝(106°E, 0°)（lo0=100、xc=6 格；la0=6、yc=6 格 → 纬 0°）
        const rs = line.points.map((p) => Math.hypot(p.lon - 106, p.lat));
        max = Math.max(max, Math.max(...rs) - Math.min(...rs));
      }
      return max;
    };
    const coarse = drift(0.25);
    const fine = drift(0.0625);
    expect(coarse).toBeLessThan(0.1); // 同步长欧拉会外旋（O(h) 漂移），RK2 两档都远小
    expect(fine).toBeLessThan(coarse); // O(h²)：步长减半 → 偏差约缩 4 倍
  });

  it("静风区不出线；阈下调至 0 后出线（阈语义与杆同源）", () => {
    const u = flowFieldOf(6, 6, 4, () => 0.5);
    const v = flowFieldOf(6, 6, 4, () => 0.5);
    expect(streamlinesOf(u, v, { seedSpacing: 2, maxSteps: 10, step: 1 })).toHaveLength(0);
    expect(
      streamlinesOf(u, v, { seedSpacing: 2, maxSteps: 10, step: 1, calmThreshold: 0 }),
    ).not.toHaveLength(0);
  });

  it("缺测区即止（双线性四角任一 NaN 即缺测，不外推）：止步于缺测带之前", () => {
    const u = flowFieldOf(6, 5, 4, (x) => (x <= 2 ? 4 : Number.NaN));
    const v = flowFieldOf(6, 5, 4, () => 0);
    const lines = streamlinesOf(u, v, { seedSpacing: 2, maxSteps: 20, step: 1, calmThreshold: 1 });
    // x∈{0,2,4}：x=4 列自身缺测、x=2 列四角含 x=3 的 NaN → 仅 x=0 列出线（3 条）
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      for (const p of line.points) expect(p.lon).toBeLessThan(102.5);
    }
  });

  it("缺省参数：种子间隔 10（21×21 → 3×3=9 线），步长/步数上限/静风阈各有缺省", () => {
    const u = flowFieldOf(21, 21, 4, () => 6);
    const v = flowFieldOf(21, 21, 4, () => 0);
    expect(streamlinesOf(u, v)).toHaveLength(9);
  });

  it("同场对拍：杆读来向 270（西风），流线沿去向东行——两套口径相反不混", () => {
    const u = flowFieldOf(5, 5, 4, () => 4);
    const v = flowFieldOf(5, 5, 4, () => 0);
    const barbs = windBarbsOf(u, v, { step: 2, calmThreshold: 1 });
    const lines = streamlinesOf(u, v, { seedSpacing: 2, maxSteps: 10, step: 1, calmThreshold: 1 });
    expect(barbs[0]?.direction).toBe(270);
    for (const line of lines) {
      const first = line.points[0]?.lon as number;
      const last = line.points[line.points.length - 1]?.lon as number;
      expect(last).toBeGreaterThan(first);
    }
  });

  it("口径非法与未知选项键显式抛错", () => {
    const u = flowFieldOf(4, 4, 4, () => 4);
    const v = flowFieldOf(4, 4, 4, () => 0);
    expect(() => streamlinesOf(u, v, { step: 0 })).toThrow(/步长非法/);
    expect(() => streamlinesOf(u, v, { seedSpacing: 0 })).toThrow(/种子间隔非法/);
    expect(() => streamlinesOf(u, v, { seedSpacing: 1.5 })).toThrow(/种子间隔非法/);
    expect(() => streamlinesOf(u, v, { maxSteps: 0 })).toThrow(/步数上限非法/);
    expect(() => streamlinesOf(u, v, { calmThreshold: -1 })).toThrow(/静风阈值非法/);
    expect(() => streamlinesOf(u, v, { spacing: 2 } as never)).toThrow(/未知选项/);
  });
});

describe("arrowFieldOf（等长箭头阵，v0.3.4 矢量批次）", () => {
  it("与 windBarbsOf 同 step 同格位、方向逐点同值（对拍契约）", () => {
    const u = flowFieldOf(6, 5, 4, (_x, y) => 3 + y);
    const v = flowFieldOf(6, 5, 4, () => 2);
    const spec = { step: 2, calmThreshold: 1 };
    const arrows = arrowFieldOf(u, v, spec);
    const barbs = windBarbsOf(u, v, spec);
    expect(arrows).toHaveLength(barbs.length);
    for (let i = 0; i < arrows.length; i++) {
      expect(arrows[i]?.lat).toBe(barbs[i]?.lat);
      expect(arrows[i]?.lon).toBe(barbs[i]?.lon);
      expect(arrows[i]?.direction).toBeCloseTo(barbs[i]?.direction as number, 10);
    }
  });

  it("静风与缺测点不出箭", () => {
    const u = flowFieldOf(6, 5, 4, (x) => (x <= 1 ? 0.5 : x <= 3 ? 4 : Number.NaN));
    const v = flowFieldOf(6, 5, 4, () => 0);
    const arrows = arrowFieldOf(u, v, { step: 1, calmThreshold: 1 });
    // 6 列：x≤1 静风（0.5 m/s < 1）不出、x=4/5 缺测不出 → 只有 x=2/3 两列出箭（2×5=10）
    expect(arrows).toHaveLength(10);
    for (const a of arrows) {
      expect(a.lon).toBeGreaterThanOrEqual(102);
      expect(a.lon).toBeLessThanOrEqual(103);
      expect(a.direction).toBeCloseTo(270, 6); // 纯西风：来向 270
    }
  });

  it("step 抽稀中心对齐（5×5 step 2 → 3×3=9）与缺省 step 10（21×21 → 9）", () => {
    const u5 = flowFieldOf(5, 5, 4, () => 6);
    const v5 = flowFieldOf(5, 5, 4, () => 0);
    expect(arrowFieldOf(u5, v5, { step: 2, calmThreshold: 1 })).toHaveLength(9);
    const u21 = flowFieldOf(21, 21, 4, () => 6);
    const v21 = flowFieldOf(21, 21, 4, () => 0);
    expect(arrowFieldOf(u21, v21)).toHaveLength(9);
  });

  it("口径非法与未知选项键显式抛错", () => {
    const u = flowFieldOf(4, 4, 4, () => 4);
    const v = flowFieldOf(4, 4, 4, () => 0);
    expect(() => arrowFieldOf(u, v, { step: 0 })).toThrow(/步长非法/);
    expect(() => arrowFieldOf(u, v, { step: 1.5 })).toThrow(/步长非法/);
    expect(() => arrowFieldOf(u, v, { calmThreshold: -1 })).toThrow(/静风阈值非法/);
    expect(() => arrowFieldOf(u, v, { stride: 2 } as never)).toThrow(/未知选项/);
  });
});

describe("windDirectionOf（气象来向单源公式，v0.3.5 点查询批）", () => {
  it("四轴锚：西风 270／南风 180／东风 90／北风 0（来向口径）", () => {
    expect(windDirectionOf(1, 0)).toBe(270); // 向东吹＝西风来向
    expect(windDirectionOf(0, 1)).toBe(180); // 向北吹＝南风来向
    expect(windDirectionOf(-1, 0)).toBe(90); // 向西吹＝东风来向
    expect(windDirectionOf(0, -1)).toBe(0); // 向南吹＝北风来向（360 归 0）
  });

  it("3-4-5 锚：atan2 权重落在西南象限 216.87°（与杆位/箭头阵同读数）", () => {
    expect(windDirectionOf(3, 4)).toBeCloseTo(216.87, 2);
  });
});

describe("windAt（任意经纬度单点读风——点查询地基）", () => {
  it("格点上取原值：分量/√(u²+v²)/来向齐备（3-4-5 锚）", () => {
    const u = gridOf("UGRD", [3, -3, 0, 6]);
    const v = gridOf("VGRD", [4, 4, -5, 0]);
    const s = windAt(u, v, 40, 100);
    expect(s?.u).toBe(3);
    expect(s?.v).toBe(4);
    expect(s?.speed).toBeCloseTo(5, 10);
    expect(s?.direction).toBeCloseTo(windDirectionOf(3, 4), 10);
    expect(s?.lat).toBe(40);
    expect(s?.lon).toBe(100);
  });

  it("格点间双线性（与粒子平流同一只采样手）：中心＝四点均值", () => {
    const u = gridOf("UGRD", [0, 10, 20, 30]);
    const v = gridOf("VGRD", [0, 0, 0, 0]);
    const s = windAt(u, v, 39.5, 100.5);
    expect(s?.u).toBeCloseTo(15, 6); // (0+10+20+30)/4
    expect(s?.speed).toBeCloseTo(15, 6);
    expect(s?.direction).toBe(270);
  });

  it("场外或任一分量缺测 → null（矢量未知，与色斑/粒子同纪律）", () => {
    const u = gridOf("UGRD", [3, Number.NaN, 0, 6]);
    const v = gridOf("VGRD", [4, 4, -5, 0]);
    expect(windAt(u, v, 40.1, 100)).toBeNull(); // 网格外（半开边界）
    expect(windAt(u, v, 40, 101)).toBeNull(); // 邻点缺测传染
    expect(windAt(u, v, 40, 100)).not.toBeNull(); // 干净格点不受邻点影响
  });

  it("几何不匹配显式抛错（与 windSpeedGrid 同守卫）", () => {
    const u = gridOf("UGRD", [3, -3, 0, 6]);
    const v = gridOf("VGRD", [4, 4, -5, 0], {
      grid: { nx: 3, ny: 2, la0: 40, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
    });
    expect(() => windAt(u, v, 40, 100)).toThrow(GridError);
    expect(() => windAt(u, v, 40, 100)).toThrow(/网格几何不匹配/);
  });
});

// ---------------------------------------------------------------- 廓线/剖面适配器（v0.6 垂直与时间批次）

/** 一层 u/v 均匀场工厂（level 串进 header 供锚解析；meta 可覆写做时刻维——只依赖入参与
 *  模块层 gridOf，故置模块层，与上方 uniform 同纪律）。 */
const layerOf = (
  level: string,
  uu: number,
  vv: number,
  overrides: Partial<Grid["header"]> = {},
): { u: Grid; v: Grid } => ({
  u: gridOf("UGRD", [uu, uu, uu, uu], { level, ...overrides }),
  v: gridOf("VGRD", [vv, vv, vv, vv], { level, ...overrides }),
});

describe("windProfileOf（u/v 多层场 → 多层风廓线）", () => {
  it("逐层采样：速度/方向同 windAt 口径（气象来向公式）、产出按气压降序自下而上", () => {
    const fields = [layerOf("500mb", 3, 0), layerOf("850mb", 0, 4), layerOf("200mb", -5, 0)];
    const profile = windProfileOf(fields, 40, 100);
    expect(profile.map((l) => l.pressure)).toEqual([850, 500, 200]); // 乱序进、自下而上出
    expect(profile.map((l) => l.height)).toEqual([null, null, null]);
    const p850 = profile[0];
    expect(p850?.speed).toBeCloseTo(4, 6);
    expect(p850?.direction).toBeCloseTo(180, 6); // v>0（南风分量）→ 来向 180
    expect(profile[1]?.direction).toBeCloseTo(270, 6); // u>0 → 西风来向 270
    expect(profile[2]?.direction).toBeCloseTo(90, 6); // u<0 → 东风来向 90
  });

  it("层锚解析：显式 pressure/height 优先；header.level 的 mb/hPa/m 形态可解析", () => {
    const explicit = windProfileOf(
      [{ ...layerOf("nonsense-level", 3, 0), pressure: 700 }],
      40,
      100,
    );
    expect(explicit[0]?.pressure).toBe(700);
    const hpa = windProfileOf([{ ...layerOf("300hPa", 3, 0) }], 40, 100);
    expect(hpa[0]?.pressure).toBe(300);
    const agl = windProfileOf([{ ...layerOf("10m", 0, 2) }], 40, 100);
    expect(agl[0]?.height).toBe(10);
    expect(agl[0]?.pressure).toBeNull();
  });

  it("缺测层：场值 NaN 或场外 → 该层 speed/direction 全 null、层位保留", () => {
    const withNaN = layerOf("850mb", Number.NaN, 0);
    const u: Grid = { ...withNaN.u, values: Float32Array.from([Number.NaN, 3, 3, 3]) };
    const profile = windProfileOf([{ u, v: withNaN.v }], 40, 100);
    expect(profile[0]).toEqual({ pressure: 850, height: null, speed: null, direction: null });
    expect(windProfileOf([layerOf("850mb", 3, 0)], 50, 120)[0]?.speed).toBeNull(); // 场外
  });

  it("静风阈：速度低于阈（缺省 1 m/s）→ direction null、speed 保留", () => {
    const profile = windProfileOf([layerOf("850mb", 0.6, 0)], 40, 100);
    expect(profile[0]?.speed).toBeCloseTo(0.6, 6);
    expect(profile[0]?.direction).toBeNull();
    const zero = windProfileOf([layerOf("850mb", 0.6, 0)], 40, 100, { calmThreshold: 0 });
    expect(zero[0]?.direction).toBeCloseTo(270, 6);
  });

  it("防线：空输入/层锚不可解析/双场不配对/未知选项/非法静风阈显式抛错", () => {
    expect(() => windProfileOf([], 40, 100)).toThrow(/至少一层/);
    expect(() => windProfileOf([layerOf("sigma-0.5", 3, 0)], 40, 100)).toThrow(/缺层锚/);
    const mismatch = layerOf("850mb", 3, 0);
    const badV = gridOf("VGRD", [0, 0, 0, 0], {
      grid: { nx: 3, ny: 2, la0: 40, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
    });
    expect(() => windProfileOf([{ u: mismatch.u, v: badV }], 40, 100)).toThrow(/网格几何不匹配/);
    expect(() => windProfileOf([layerOf("850mb", 3, 0)], 40, 100, { zoom: 5 } as never)).toThrow(
      /未知选项 "zoom"/,
    );
    expect(() => windProfileOf([layerOf("850mb", 3, 0)], 40, 100, { calmThreshold: -1 })).toThrow(
      /静风阈值非法/,
    );
  });

  it("同锚重复显式抛错（P2-2 行为锁）：同层两层入参不被 last-wins 静默吞掉", () => {
    expect(() => windProfileOf([layerOf("850mb", 3, 0), layerOf("850mb", 0, 4)], 40, 100)).toThrow(
      /重复层输入（第 2 层的层锚 850hPa 与前层重复）/,
    );
  });

  it("层锚混装显式抛错且带逐层锚清单（P2-10 行为锁）：不把 render 必拒的产物放出去", () => {
    expect(() => windProfileOf([layerOf("850mb", 3, 0), layerOf("10m", 0, 4)], 40, 100)).toThrow(
      /层锚混装（第 1 层 850hPa、第 2 层 10m）/,
    );
    // 多时刻路径同口径（层行维度）
    expect(() =>
      windTimeHeightOf([hourLayerOf("850mb", 0, 1, 1), hourLayerOf("10m", 0, 1, 1)], 40, 100),
    ).toThrow(/层锚混装/);
  });

  it("双分量时效配对校验（P2-3 行为锁）：v 场接错时效显式抛错，不错出矢量", () => {
    const base = hourLayerOf("850mb", 0, 3, 0);
    const vWrongHour = hourLayerOf("850mb", 6, 0, 4); // v 来自另一时效
    expect(() => windProfileOf([{ u: base.u, v: vWrongHour.v }], 40, 100)).toThrow(
      /第 1 层双分量时效不匹配（u 2026-10-06T18:00Z\+0h ≠ v 2026-10-06T18:00Z\+6h）/,
    );
    const vOtherCycle = hourLayerOf("850mb", 0, 0, 4);
    const shiftedV = {
      ...vOtherCycle.v,
      header: {
        ...vOtherCycle.v.header,
        meta: { ...vOtherCycle.v.header.meta, referenceTime: "2026-10-07T00:00Z" },
      },
    };
    expect(() => windProfileOf([{ u: base.u, v: shiftedV }], 40, 100)).toThrow(/时效不匹配/);
  });
});

/** 时刻维工厂：一层一时的 u/v 均匀场（referenceTime 固定单 cycle、forecastHour 可变）。 */
const hourLayerOf = (
  level: string,
  forecastHour: number,
  uu: number,
  vv: number,
): { u: Grid; v: Grid } => {
  const meta = {
    referenceTime: "2026-10-06T18:00Z",
    forecastHour,
    source: "test",
    license: "",
    generated: "2026-10-07",
  };
  return {
    u: gridOf("UGRD", [uu, uu, uu, uu], { level, meta }),
    v: gridOf("VGRD", [vv, vv, vv, vv], { level, meta }),
  };
};

describe("windTimeHeightOf（u/v 多层场 → 多层×多时刻二维序列）", () => {
  it("时刻维：forecastHour 升序、标签＝起报＋时效现算的 ISO 串；层缺场补 null 格", () => {
    const fields = [
      hourLayerOf("850mb", 6, 3, 0),
      hourLayerOf("500mb", 0, 6, 0),
      hourLayerOf("850mb", 0, 0, 4),
    ];
    const data = windTimeHeightOf(fields, 40, 100);
    expect(data.times).toEqual(["2026-10-06T18:00Z", "2026-10-07T00:00Z"]);
    // timeLabel:"short" 直出「日T时Z」短标签（剖面列标签用）；ISO 形态缺省可用不受影响
    const short = windTimeHeightOf(fields, 40, 100, { timeLabel: "short" });
    expect(short.times).toEqual(["06T18Z", "07T00Z"]);
    // 层行按气压降序（自下而上＝地面层在前，与 windProfileOf 同序；显示侧自再排）
    expect(data.levels.map((l) => l.pressure)).toEqual([850, 500]);
    const row850 = data.levels[0];
    const row500 = data.levels[1];
    expect(row500?.cells).toHaveLength(2);
    expect(row500?.cells[1]?.speed).toBeNull(); // f006 的 500 缺场 → null 格（缺测可辨）
    expect(row850?.cells[0]?.speed).toBeCloseTo(4, 6);
    expect(row850?.cells[0]?.direction).toBeCloseTo(180, 6);
    expect(row850?.cells[1]?.direction).toBeCloseTo(270, 6);
  });

  it("多 cycle 混装与重复层输入显式抛错（不静默吸收接线错误）", () => {
    const other = hourLayerOf("850mb", 0, 1, 1);
    // 整层平移到另一 cycle（u/v 同改——跨场时效配对校验由下一条用例单锁）
    const shiftedMeta = { ...other.u.header.meta, referenceTime: "2026-10-07T00:00Z" };
    const shifted = {
      u: { ...other.u, header: { ...other.u.header, meta: shiftedMeta } },
      v: { ...other.v, header: { ...other.v.header, meta: shiftedMeta } },
    };
    expect(() => windTimeHeightOf([shifted, hourLayerOf("500mb", 0, 1, 1)], 40, 100)).toThrow(
      /多 cycle 混装/,
    );
    expect(() =>
      windTimeHeightOf([hourLayerOf("850mb", 0, 1, 1), hourLayerOf("850mb", 0, 2, 2)], 40, 100),
    ).toThrow(/重复层输入/);
  });

  it("referenceTime 不可解析显式抛错；空输入同 windProfileOf 防线", () => {
    const bad = hourLayerOf("850mb", 0, 1, 1);
    // 整层同改（u/v 时效配对在场——坏 referenceTime 由时刻标签现算路径拦）
    const brokenMeta = { ...bad.u.header.meta, referenceTime: "not-a-time" };
    const broken = {
      u: { ...bad.u, header: { ...bad.u.header, meta: brokenMeta } },
      v: { ...bad.v, header: { ...bad.v.header, meta: brokenMeta } },
    };
    expect(() => windTimeHeightOf([broken], 40, 100)).toThrow(/解析不出时刻/);
    expect(() => windTimeHeightOf([], 40, 100)).toThrow(/至少一层/);
    expect(() =>
      windTimeHeightOf([hourLayerOf("850mb", 0, 1, 1)], 40, 100, { step: 2 } as never),
    ).toThrow(/未知选项 "step"/);
    expect(() =>
      windTimeHeightOf([hourLayerOf("850mb", 0, 1, 1)], 40, 100, { timeLabel: "compact" as never }),
    ).toThrow(/timeLabel 形态 "compact" 不受支持/);
  });
});
