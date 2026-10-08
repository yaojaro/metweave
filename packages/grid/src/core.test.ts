/**
 * 渲染内核单测：双线性插值、分级函数两模式、renderToImageData 逐像素断言，
 * 外加仓内冻结基线（corpus/grid tmp 中国域）的像素快照锁——既有要素的渲染回归
 * 由快照兜底（任何内核改动静了像素即红），纪律自温度切片建立。
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  binIndexAt,
  equalStepBreaks,
  interpolateBilinear,
  quantileBreaks,
  renderToImageData,
  thresholdBreaks,
  type ColorScale,
  type Grid,
  type GridStats,
} from "./index";
import { GridError } from "./errors";
import { buildColorScale, capeProfile, tmpProfile } from "./index";

const here = dirname(fileURLToPath(import.meta.url));

/** 最小网格工厂：值按行列式 v(r,c)=base + r*rowStep + c*colStep（默认恒等）。 */
const tinyGrid = (values: number[], nx = 2, ny = 2): Grid => ({
  header: {
    version: 1,
    variable: "TEST",
    level: "sfc",
    unit: "K",
    grid: { nx, ny, la0: 40, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
    stats: {
      min: Math.min(...values),
      max: Math.max(...values),
      p10: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p99: 0,
    },
    meta: {
      referenceTime: "2026-10-04T06:00Z",
      forecastHour: 0,
      source: "test",
      license: "",
      generated: "2026-10-04",
    },
  },
  values: Float32Array.from(values),
});

const statsOf = (over: Partial<GridStats>): GridStats => ({
  min: 0,
  max: 100,
  p10: 10,
  p25: 25,
  p50: 50,
  p75: 75,
  p90: 90,
  p99: 99,
  ...over,
});

/** 渲染产物第 i 个像素（一维序号，行序同网格）的 RGBA 四元组。 */
const pxAt = (img: { data: Uint8ClampedArray }, i: number): readonly number[] =>
  Array.from(img.data.subarray(i * 4, i * 4 + 4));

describe("interpolateBilinear", () => {
  const grid = tinyGrid([0, 10, 20, 30]); // (r,c)：v = 10c + 20r

  it("格点上取原值", () => {
    expect(interpolateBilinear(grid, 40, 100)).toBe(0);
    expect(interpolateBilinear(grid, 40, 101)).toBe(10);
    expect(interpolateBilinear(grid, 39, 100)).toBe(20);
    expect(interpolateBilinear(grid, 39, 101)).toBe(30);
  });

  it("格点间为四点线性权重（中心＝均值）", () => {
    expect(interpolateBilinear(grid, 39.5, 100.5)).toBeCloseTo(15, 6);
    expect(interpolateBilinear(grid, 39.75, 100.25)).toBeCloseTo(7.5, 6);
  });

  it("网格外返回 NaN（半开边界）", () => {
    expect(interpolateBilinear(grid, 40.1, 100)).toBeNaN();
    expect(interpolateBilinear(grid, 39, 99.9)).toBeNaN();
  });

  it("参与格点任一缺测 → NaN（不跨缺测插值）", () => {
    const nanGrid = tinyGrid([0, Number.NaN, 20, 30]);
    expect(interpolateBilinear(nanGrid, 39.5, 100.5)).toBeNaN();
    expect(interpolateBilinear(nanGrid, 40, 100)).toBe(0); // 干净格点不受邻点影响
  });
});

describe("分级函数", () => {
  it("binIndexAt：左闭右开、两端外延、NaN → -1", () => {
    const breaks = [0, 10, 20];
    expect(binIndexAt(-5, breaks)).toBe(0);
    expect(binIndexAt(0, breaks)).toBe(1); // 断点值归上档（左闭右开）
    expect(binIndexAt(9.9, breaks)).toBe(1);
    expect(binIndexAt(10, breaks)).toBe(2);
    expect(binIndexAt(20, breaks)).toBe(3); // ≥ 末断点 → 外延末档
    expect(binIndexAt(Number.NaN, breaks)).toBe(-1);
    expect(binIndexAt(Number.POSITIVE_INFINITY, breaks)).toBe(-1);
  });

  it("equalStepBreaks：均分域出中间断点", () => {
    expect(equalStepBreaks(-40, 40, 20)).toHaveLength(19);
    expect(equalStepBreaks(0, 10, 5)).toEqual([2, 4, 6, 8]);
  });

  it("equalStepBreaks：域与档数非法显式抛错", () => {
    expect(() => equalStepBreaks(10, 10, 5)).toThrow(GridError);
    expect(() => equalStepBreaks(0, 10, 1)).toThrow(GridError);
    expect(() => equalStepBreaks(Number.NaN, 10, 5)).toThrow(GridError);
  });

  it("quantileBreaks：直读八分位梯子", () => {
    expect(quantileBreaks(statsOf({}), [0.1, 0.5, 0.9])).toEqual([10, 50, 90]);
    expect(quantileBreaks(statsOf({}), [0, 1])).toEqual([0, 100]);
    expect(quantileBreaks(statsOf({}), [])).toEqual([]);
  });

  it("quantileBreaks：梯子外分位点抛错（不静默近似）", () => {
    expect(() => quantileBreaks(statsOf({}), [0.125])).toThrow(GridError);
    expect(() => quantileBreaks(statsOf({}), [-0.1])).toThrow(GridError);
  });

  it("quantileBreaks：退化分布（相邻分位同值）显式抛错", () => {
    const degenerate = statsOf({ p25: 50, p50: 50 });
    expect(() => quantileBreaks(degenerate, [0.25, 0.5])).toThrow(GridError);
  });

  it("quantileBreaks：stats 缺测（NaN 分位）抛错", () => {
    expect(() => quantileBreaks(statsOf({ p50: Number.NaN }), [0.5])).toThrow(GridError);
  });

  it("thresholdBreaks：显式业务阈值原样返回（新数组，不别名入参）", () => {
    const thresholds = [1000, 2500, 4000];
    const breaks = thresholdBreaks(thresholds);
    expect(breaks).toEqual(thresholds);
    expect(breaks).not.toBe(thresholds); // 拷贝返回：调用方改入参不污染色标
  });

  it("thresholdBreaks：校验口径与 assertBreaks 一致（非有限/非严格递增抛错；空表＝单档合法）", () => {
    expect(() => thresholdBreaks([2500, 1000])).toThrow(GridError);
    expect(() => thresholdBreaks([1000, 1000])).toThrow(GridError); // 相等不递增
    expect(() => thresholdBreaks([0, Number.NaN])).toThrow(GridError);
    expect(() => thresholdBreaks([Number.POSITIVE_INFINITY])).toThrow(GridError);
    expect(thresholdBreaks([])).toEqual([]); // 空＝恒单档（与 quantileBreaks 空分位点同口径）
  });
});

describe("renderToImageData", () => {
  const scale: ColorScale = {
    breaks: [5],
    colors: ["#0000ff", "#ff0000"], // 低档蓝、高档红
  };

  it("原生分辨率逐像素着色（左闭右开档界）", () => {
    const grid = tinyGrid([0, 10, 0, 10]); // 西半冷、东半暖
    const img = renderToImageData(grid, scale);
    expect(img.width).toBe(2);
    expect(img.height).toBe(2);
    const px = (x: number, y: number): readonly number[] =>
      Array.from(img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));
    expect(px(0, 0)).toEqual([64, 0, 191, 255]); // 低档中心取样 t=0.25：蓝 75%＋红 25%
    expect(px(1, 0)).toEqual([191, 0, 64, 255]); // 高档中心 t=0.75
  });

  it("缺测 NaN → alpha 0（与 opacity 无关）", () => {
    const grid = tinyGrid([0, Number.NaN, 0, Number.NaN]);
    const img = renderToImageData(grid, { ...scale, breaks: [] }, { opacity: 0.5 });
    expect(img.data[7]).toBe(0); // 像素 (1,0) 的 alpha 偏移＝(0×2+1)×4+3
  });

  it("convert 换算后进档（K 场配 °C 断点）", () => {
    const grid = tinyGrid([273.15, 283.15, 273.15, 283.15]); // 0°C / 10°C
    const img = renderToImageData(grid, scale, { convert: (v) => v - 273.15 });
    expect(img.data[0]).toBe(64); // (0,0)=0°C<5 → 低档（蓝向）
    expect(img.data[4]).toBe(191); // (1,0)=10°C≥5 → 高档（红向）
  });

  it("opacity 乘进 alpha", () => {
    const grid = tinyGrid([0, 0, 0, 0]);
    const img = renderToImageData(grid, scale, { opacity: 0.5 });
    expect(img.data[3]).toBe(128); // 255×0.5 四舍五入（Uint8Clamped）
  });

  it("超采样：宽 2×网格时高度按纵横比自适应", () => {
    const grid = tinyGrid([0, 1, 2, 3]);
    const img = renderToImageData(grid, { ...scale, breaks: [] }, { width: 4 });
    expect(img.width).toBe(4);
    expect(img.height).toBe(4);
    expect(img.data.length).toBe(4 * 4 * 4);
  });

  it("降采样宽度取整下限 1", () => {
    const grid = tinyGrid([0, 1, 2, 3]);
    const img = renderToImageData(grid, scale, { width: 1 });
    expect(img.width).toBe(1);
    expect(img.height).toBe(1);
  });

  it("非法色标显式抛错（断点乱序/色带空/坏色值）", () => {
    const grid = tinyGrid([0, 1, 2, 3]);
    expect(() => renderToImageData(grid, { breaks: [10, 5], colors: ["#fff"] })).toThrow(GridError);
    expect(() => renderToImageData(grid, { breaks: [5], colors: [] })).toThrow(GridError);
    expect(() => renderToImageData(grid, { breaks: [5], colors: ["not-a-color"] })).toThrow(
      GridError,
    );
    expect(() => renderToImageData(grid, scale, { width: 0 })).toThrow(GridError);
  });

  it("单停靠色＝纯色填充（无插值伙伴不崩溃、t 无关恒取该色）", () => {
    // 回归锁：单色时旧实现取 colors[-1] 首像素即抛「色带第 -1 项」误导错误
    const grid = tinyGrid([0, 10, 0, 10]);
    const img = renderToImageData(grid, { breaks: [5], colors: ["#33aa66"] });
    expect(img.width).toBe(2);
    for (let i = 0; i < img.data.length; i += 4) {
      expect(Array.from(img.data.subarray(i, i + 4))).toEqual([0x33, 0xaa, 0x66, 255]);
    }
  });
});

describe("透明档（ColorScale.transparentBins）", () => {
  // 3 档（breaks [10,20]）：v=5→bin0、15→bin1、25→bin2、NaN→缺测透明
  const scale: ColorScale = { breaks: [10, 20], colors: ["#000000", "#ffffff"] };
  const grid = tinyGrid([5, 15, 25, Number.NaN]);

  it("命中透明档 alpha 0、RGB 0（与缺测透明同一像素形态，底图透出）", () => {
    const img = renderToImageData(grid, { ...scale, transparentBins: new Set([0]) });
    expect(pxAt(img, 0)).toEqual([0, 0, 0, 0]); // v=5 命中 bin0 透明
    expect(pxAt(img, 3)).toEqual([0, 0, 0, 0]); // NaN 缺测透明（既有语义不变）
  });

  it("相邻档不受牵连：有无透明档的着色档像素逐字节一致（colorAt 取样无副作用）", () => {
    const withT = renderToImageData(grid, { ...scale, transparentBins: new Set([0]) });
    const without = renderToImageData(grid, scale);
    expect(pxAt(withT, 1)).toEqual(pxAt(without, 1)); // bin1 着色不受 bin0 透明牵连
    expect(pxAt(withT, 2)).toEqual(pxAt(without, 2)); // bin2 同
    expect(withT.data[4 + 3]).toBe(255); // 着色档满 alpha
  });

  it("透明档不因整体 opacity 复活；opacity 仍乘非透明档 alpha", () => {
    const img = renderToImageData(
      grid,
      { ...scale, transparentBins: new Set([0]) },
      {
        opacity: 0.5,
      },
    );
    expect(img.data[3]).toBe(0); // 透明档（像素 0）
    expect(img.data[4 + 3]).toBe(128); // 着色档（像素 1）＝255×0.5
  });

  it("缺省不传 transparentBins＝全档着色（既有路径行为不变，快照另由冻结基线锁）", () => {
    const img = renderToImageData(grid, scale);
    expect(img.data[3]).toBe(255); // bin0 正常着色
  });

  it("透明档序号非法显式抛错（非整数/负数/越出档范围）；末档序号合法", () => {
    const legal = renderToImageData(grid, { ...scale, transparentBins: new Set([2]) });
    expect(legal.data[2 * 4 + 3]).toBe(0); // 像素 (0,1)（序号 2）＝bin2＝末档透明
    expect(() => renderToImageData(grid, { ...scale, transparentBins: new Set([3]) })).toThrow(
      GridError,
    ); // 档数=3，合法 0–2
    expect(() => renderToImageData(grid, { ...scale, transparentBins: new Set([-1]) })).toThrow(
      GridError,
    );
    expect(() => renderToImageData(grid, { ...scale, transparentBins: new Set([0.5]) })).toThrow(
      GridError,
    );
  });
});

describe("log₁₀ 前置变换（ColorScale.logScale）", () => {
  /** 跨量级一维场（0.05–50，含各档界代表值：8×1 网格逐值成像素）。 */
  const logField = [0.05, 0.1, 0.5, 1, 4.99, 5, 10, 50];
  // prate 口径的线性断点声明（0.1/1/5/10 mm/h）——定档空间等价于对数断点
  // −1/0/log₁₀5/1；黑→白双色带使各档取样色可判（t=(bin+0.5)/5 单调递增）
  const logSpec: ColorScale = {
    breaks: [0.1, 1, 5, 10],
    colors: ["#000000", "#ffffff"],
    logScale: true,
  };

  it("值与断点统一进对数空间：log 模式渲染线性场 ≡ 线性模式渲染预取对数的场", () => {
    const viaLog = renderToImageData(tinyGrid(logField, 8, 1), logSpec);
    const viaLinear = renderToImageData(tinyGrid(logField.map(Math.log10), 8, 1), {
      breaks: logSpec.breaks.map(Math.log10),
      colors: logSpec.colors,
    });
    expect(Array.from(viaLog.data)).toEqual(Array.from(viaLinear.data)); // 断点变换与值变换两侧一致
  });

  it("跨量级档位落位：档序单调着色、恰在阈值上归上档（左闭右开在对数空间保持）", () => {
    // 期望档序（binIndexAt 语义对照）：0.05→0、0.1/0.5→1、1/4.99→2、5→3、10/50→4
    const logBreaks = logSpec.breaks.map(Math.log10);
    expect(logField.map((v) => binIndexAt(Math.log10(v), logBreaks))).toEqual([
      0, 1, 1, 2, 2, 3, 4, 4,
    ]);
    const img = renderToImageData(tinyGrid(logField, 8, 1), logSpec);
    const r = (i: number): number => img.data[i * 4]!;
    const binsOf = [0, 1, 1, 2, 2, 3, 4, 4];
    for (let i = 1; i < logField.length; i++) {
      if (binsOf[i] === binsOf[i - 1]) expect(r(i)).toBe(r(i - 1)); // 同档同色
      else expect(r(i)).toBeGreaterThan(r(i - 1)); // 跨档单调加深
    }
    expect(r(1)).toBe(r(2)); // 0.1 与 0.5 同档（恰在阈值 0.1 上归上档）
    expect(r(6)).toBe(r(7)); // 10 与 50 同档（外延末档）
  });

  it("零值/负值 → log₁₀ −Inf/NaN → 非有限透明通道（与缺测同一像素形态）", () => {
    const img = renderToImageData(tinyGrid([0, -0.001, 0.5, Number.NaN]), logSpec);
    expect(pxAt(img, 0)).toEqual([0, 0, 0, 0]); // log₁₀(0)=−Inf → binIndexAt −1
    expect(pxAt(img, 1)).toEqual([0, 0, 0, 0]); // log₁₀(负)=NaN → 同通道
    expect(pxAt(img, 3)).toEqual([0, 0, 0, 0]); // 缺测（既有语义）
    expect(img.data[2 * 4 + 3]).toBe(255); // 正常档不受牵连
  });

  it("断点非正显式抛错（log₁₀(≤0) 无意义——线性空间合法的 0 断点在 log 模式即红）", () => {
    const grid = tinyGrid([0.5, 1, 5, 10]);
    expect(() => renderToImageData(grid, { ...logSpec, breaks: [0, 1, 5, 10] })).toThrow(GridError);
    expect(() => renderToImageData(grid, { ...logSpec, breaks: [-0.5, 1, 5, 10] })).toThrow(
      GridError,
    );
  });

  it("与档级透明正交：log＋transparentBins 首档微量与零值两通道同形透明", () => {
    const img = renderToImageData(tinyGrid([0, 0.05, 0.5, 5]), {
      ...logSpec,
      transparentBins: new Set([0]),
    });
    expect(pxAt(img, 0)).toEqual([0, 0, 0, 0]); // 恰零值：−Inf 通道
    expect(pxAt(img, 1)).toEqual([0, 0, 0, 0]); // 非零微量（0.05∈bin0）：档级透明
    expect(img.data[2 * 4 + 3]).toBe(255); // bin1 正常着色
    expect(img.data[3 * 4 + 3]).toBe(255); // bin3 正常着色
  });

  it("缺省缺席＝线性定档（logScale 显式 undefined 与不带字段逐字节一致——既有路径零漂移）", () => {
    const grid = tinyGrid([0.05, 0.5, 5, 50]);
    const linear = renderToImageData(grid, {
      breaks: logSpec.breaks,
      colors: logSpec.colors,
    });
    const explicitUndef = renderToImageData(grid, {
      breaks: logSpec.breaks,
      colors: logSpec.colors,
      logScale: undefined,
    });
    expect(Array.from(explicitUndef.data)).toEqual(Array.from(linear.data));
  });
});

/** 仓内冻结基线（corpus/grid tmp 中国域 f32，eccodes 权威产出）装载：像素快照锁的数据面。 */
const loadFrozenGrid = (): Grid => {
  const raw = readFileSync(join(here, "..", "..", "..", "corpus", "grid", "gfs-tmp-2m-cn.f32"));
  const n = raw.byteLength / 4;
  const values = new Float32Array(n);
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  for (let i = 0; i < n; i++) values[i] = dv.getFloat32(i * 4);
  return {
    header: {
      ...tinyGrid([]).header,
      grid: { nx: 280, ny: 208, la0: 55, lo0: 70, di: 0.25, dj: 0.25, order: "N2S,W2E,row-major" },
      variable: "TMP",
      level: "2m",
      unit: "K",
      stats: {
        min: Number.NaN,
        max: Number.NaN,
        p10: Number.NaN,
        p25: Number.NaN,
        p50: Number.NaN,
        p75: Number.NaN,
        p90: Number.NaN,
        p99: Number.NaN,
      },
    },
    values,
  };
};

describe("buildColorScale 档位空间契约", () => {
  it("分位分支断点经 toDisplay 进显示单位（与等距分支同空间——渲染与图例共用不换算）", () => {
    // 存储单位 K、分位梯 p10=283.15K(10°C)/p25=288.15K(15°C)/p50=293.15K(20°C)…
    const stats = statsOf({
      min: 263.15,
      max: 313.15,
      p10: 283.15,
      p25: 288.15,
      p50: 293.15,
      p75: 298.15,
      p90: 303.15,
      p99: 308.15,
    });
    const quantileTmp: typeof tmpProfile = { ...tmpProfile, defaultMode: "quantile" };
    const scale = buildColorScale(quantileTmp, stats);
    expect(scale.breaks).toEqual([10, 15, 20, 25, 30]); // °C，非 K
  });

  it("等距分支断点即档案显示域（tmp 缺省）", () => {
    const scale = buildColorScale(tmpProfile, statsOf({}));
    expect(scale.breaks).toHaveLength(19);
    expect(scale.breaks[0]).toBe(-36);
    expect(scale.breaks[18]).toBe(36);
  });

  it("threshold 分支断点即档案阈值（显示空间直用）＋透明档随档案进色标（stats 全缺测也不读）", () => {
    const nanStats = statsOf({
      min: Number.NaN,
      max: Number.NaN,
      p10: Number.NaN,
      p25: Number.NaN,
      p50: Number.NaN,
      p75: Number.NaN,
      p90: Number.NaN,
      p99: Number.NaN,
    });
    const scale = buildColorScale(capeProfile, nanStats);
    expect(scale.breaks).toEqual([1000, 2500, 4000]); // 阈值档不读场统计（跨时次可比）
    expect(scale.colors).toBe(capeProfile.colorStops);
    expect(scale.transparentBins).toEqual(new Set([0])); // 档案数组声明 → 色标 Set
  });

  it("缺省模式缺对应推荐参数显式抛错（threshold 缺阈值/equal 缺域/quantile 缺分位点）", () => {
    // 类型面三组推荐参数均可选（threshold 要素不背不用的等距域）——运行时兜底防笔误
    expect(() => buildColorScale({ ...capeProfile, thresholds: undefined }, statsOf({}))).toThrow(
      GridError,
    );
    expect(() => buildColorScale({ ...tmpProfile, equal: undefined }, statsOf({}))).toThrow(
      GridError,
    );
    expect(() =>
      buildColorScale({ ...tmpProfile, defaultMode: "quantile", quantile: undefined }, statsOf({})),
    ).toThrow(GridError);
  });
});

describe("冻结基线渲染（像素快照锁）", () => {
  it("tmp 档案缺省档渲染冻结基线：尺寸/取值面/像素 sha 快照", () => {
    const grid = loadFrozenGrid();
    grid.header.stats = {
      min: 264.27,
      max: 311.87,
      p10: 280.2,
      p25: 284.7,
      p50: 291.7,
      p75: 301.3,
      p90: 303.6,
      p99: 308.5,
    };
    const scale = buildColorScale(tmpProfile, grid.header.stats);
    expect(scale.breaks).toHaveLength(19); // 等距 20 档 ×4°C
    const img = renderToImageData(grid, scale, {
      convert: tmpProfile.toDisplay,
      width: 280,
      opacity: 0.85,
    });
    expect(img.width).toBe(280);
    expect(img.height).toBe(208);
    let transparent = 0;
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i] === 0) transparent++;
    expect(transparent).toBe(0); // 基线零缺测
    // 快照锁：像素阵列 sha256——内核任何改动动了 tmp 渲染像素即红（纪律：既有要素快照锁死）
    const sha = createHash("sha256").update(img.data).digest("hex");
    expect(sha).toMatchInlineSnapshot(
      `"9c08011f9c7d1fcc58a2e4cf13e5c83f18aa458a6f3840772b1856faa1790098"`,
    );
  });
});
