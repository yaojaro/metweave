/**
 * t850（850hPa 温度）要素档案单测：换算口径（K→°C −273.15）、入档头对齐（TMP/850mb
 * ——容器头实测；短名对齐 gen:grid CLI 键 t850）、色带与 tmp 同款发散热带（蓝-白-红、
 * 白心中位）、等距档与 tmp 同域（对称 [−40,40] 使 0°C 恰为档界兼白心、断点全 4 的
 * 整数倍与留位等值线对齐、域含全球调研极值——极低落外延档）、分位档（实测头分位
 * 严格递增、经 toDisplay 进 °C 空间）、渲染形态（filled+contours 等温线接线、
 * centers false 不出 L/H 中心——owner 2026-10-07 定案）与
 * 渲染集成（冷蓝/冰点白/暖红的走带方向）——档案是色标与档位的单一事实来源，本测试
 * 锁其口径不被无意改动。
 */
import { describe, expect, it } from "vitest";
import {
  t850Profile,
  buildColorScale,
  equalStepBreaks,
  quantileBreaks,
  binIndexAt,
  renderToImageData,
  type Grid,
  type GridStats,
} from "../index";

/**
 * 中国域窗 t850_cn.mwgrid 容器头实测 stats（2026-10-06T18Z f000：258.59–300.22K＝
 * −14.56–27.07°C，p50 16.73°C——连续近高斯；K 存储值）。
 */
const CN_STATS: GridStats = {
  min: 258.5890808105469,
  max: 300.2190856933594,
  p10: 274.6390686035156,
  p25: 282.049072265625,
  p50: 289.87908935546875,
  p75: 291.799072265625,
  p90: 292.9290771484375,
  p99: 296.1790771484375,
};

/** 最小网格工厂（与 tmp/pres.test 同构）：值按行序西→东，单位＝存储 K。 */
const tinyGrid = (values: number[], nx: number, ny: number): Grid => ({
  header: {
    version: 1,
    variable: "TMP",
    level: "850mb",
    unit: "K",
    grid: { nx, ny, la0: 40, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
    stats: CN_STATS,
    meta: {
      referenceTime: "2026-10-06T18:00Z",
      forecastHour: 0,
      source: "test",
      license: "",
      generated: "2026-10-07",
    },
  },
  values: Float32Array.from(values),
});

/** 相对亮度（白心带判据：冰点像素为全场最亮档）。 */
const lumaOf = (px: readonly number[]): number =>
  0.299 * (px[0] ?? 0) + 0.587 * (px[1] ?? 0) + 0.114 * (px[2] ?? 0);

/** 通道极差（低饱和判据：白心带通道差小）。 */
const spreadOf = (px: readonly number[]): number =>
  Math.max(px[0] ?? 0, px[1] ?? 0, px[2] ?? 0) - Math.min(px[0] ?? 0, px[1] ?? 0, px[2] ?? 0);

describe("t850（850hPa 温度）档案", () => {
  it("显示换算 K→°C（−273.15），冰点对齐", () => {
    expect(t850Profile.toDisplay(273.15)).toBeCloseTo(0, 10);
    expect(t850Profile.toDisplay(300.2190856933594)).toBeCloseTo(27.0690856933594, 10);
    expect(t850Profile.storageUnit).toBe("K"); // 容器头原串
    expect(t850Profile.displayUnit).toBe("°C");
  });

  it("入档口径与容器头对齐（TMP/850mb——t850_cn.mwgrid 实测）；短名对齐 gen:grid CLI 键", () => {
    expect(t850Profile.variable).toBe("TMP");
    expect(t850Profile.level).toBe("850mb");
    // 短名照 gen:grid CLI 的 ELEMENTS 键（「拉最新」中间件原样转发 CLI，键对齐即直通
    // ——gh≠hgt 键断裂的反例在前）；gen 产物文件名 t850_cn.mwgrid 即该键的产物名
    expect(t850Profile.shortName).toBe("t850");
    expect(t850Profile.labelZh).toBe("850hPa 温度");
  });

  it("色带与 tmp 同款发散热带蓝-白-红：首尾冷/暖、中位近白、全部合法十六进制", () => {
    const stops = t850Profile.colorStops;
    expect(stops.length).toBeGreaterThanOrEqual(5);
    for (const c of stops) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    const [first, mid, last] = [stops[0], stops[Math.floor((stops.length - 1) / 2)], stops.at(-1)];
    expect(first).toBe("#2166ac"); // 冷端蓝（与 tmp 逐字段同构——「同 2t 带」）
    expect(last).toBe("#b2182b"); // 暖端红
    expect(mid).toBe("#f7f7f7"); // 白心
  });

  it("等距档与 tmp 同域 [-40,40]×20：对称域使 0°C 恰为档界（白心对齐）且断点全 4 的倍数", () => {
    const { min, max, bins } = t850Profile.equal!; // 等距域在位（threshold 要素才可缺席——档案字面量静态可证）
    expect(min).toBe(-40);
    expect(max).toBe(40);
    expect(bins).toBe(20);
    const breaks = equalStepBreaks(min, max, bins);
    expect(breaks).toHaveLength(19);
    expect(breaks[9]).toBeCloseTo(0, 10); // 第 10 断点＝0°C（对称域中点——色带白心钉 0°C）
    expect((breaks[1] ?? 0) - (breaks[0] ?? 0)).toBeCloseTo(4, 10); // 4°C 步长
    for (const b of breaks) expect(Math.abs(b % 4)).toBe(0); // 档界即留位等值线（interval 4）线位（负断点取绝对值防 −0 口径）
    // 域对全球调研极值（表 A 224.1–304.2K）的容纳：高端落域内、极低落两端外延档（设计语义）
    expect(binIndexAt(t850Profile.toDisplay(304.2), breaks)).toBeLessThan(bins);
    expect(binIndexAt(t850Profile.toDisplay(304.2), breaks)).toBeGreaterThan(0);
    expect(binIndexAt(t850Profile.toDisplay(224.1), breaks)).toBe(0);
    // 中国域窗实测（−14.56–27.07°C）全落域内
    expect(binIndexAt(t850Profile.toDisplay(CN_STATS.min), breaks)).toBeGreaterThan(0);
    expect(binIndexAt(t850Profile.toDisplay(CN_STATS.max), breaks)).toBeLessThan(bins);
  });

  it("分位数档：五分位点全在预计算八分位梯子上，断点经 toDisplay 进 °C 空间", () => {
    // 连续近高斯场分位档不失效（对照 cape/prate 零值堆反例）——「同 2t 带」双模式一并继承
    const breaks = quantileBreaks(CN_STATS, t850Profile.quantile!);
    expect(breaks).toHaveLength(5);
    // quantileBreaks 返回存储单位（K），档案装配经 toDisplay 进显示空间（buildColorScale 口径）
    expect(t850Profile.quantile).toEqual([0.1, 0.25, 0.5, 0.75, 0.9]);
    for (let i = 1; i < breaks.length; i++) expect(breaks[i]!).toBeGreaterThan(breaks[i - 1]!); // 严格递增无退化
    expect(breaks.map(t850Profile.toDisplay).map((v) => Math.round(v * 100) / 100)).toEqual([
      1.49, 8.9, 16.73, 18.65, 19.78,
    ]); // 实测头分位（°C）
  });

  it("buildColorScale 缺省（等距）产出 19 断点完整色标", () => {
    const scale = buildColorScale(t850Profile, CN_STATS);
    expect(t850Profile.defaultMode).toBe("equal");
    expect(scale.breaks).toHaveLength(19);
    expect(scale.colors).toBe(t850Profile.colorStops);
    expect(scale.transparentBins).toBeUndefined(); // 连续场无透明档（全域着色）
    expect(scale.logScale).toBeUndefined(); // 线性定档（近高斯场无需对数）
  });

  it("渲染形态＝filled+contours（等温线接线——owner 2026-10-07 定案「只描等值线，不标注中心」）；口径 4°C＋0°C 特值线＋centers false", () => {
    expect(t850Profile.renderForm).toBe("filled+contours");
    expect(t850Profile.contours).toBeDefined();
    expect(t850Profile.contours?.interval).toBe(4);
    expect(t850Profile.contours?.minorInterval).toBeUndefined(); // 无加密线（与 tmp 同构）
    // 850hPa 零度层＝降水形态判据常识锚（雨雪分界参考）——0°C 走特值线红字
    expect(t850Profile.contours?.highlighted).toEqual([0]);
    // L/H 中心标注是气压习语（冷中心≠低压）——温度场声明关闭，只描线不出中心
    expect(t850Profile.contours?.centers).toBe(false);
  });

  it("渲染集成：冷端蓝主导、冰点近白、暖端红主导（发散走带方向）", () => {
    // 一行三值（K 存储）：250（−23.2°C 冷）/273.15（0°C 冰点）/300（26.9°C 暖）
    const img = renderToImageData(
      tinyGrid([250, 273.15, 300], 3, 1),
      buildColorScale(t850Profile, CN_STATS),
      { convert: t850Profile.toDisplay },
    );
    const rgbaAt = (i: number): readonly number[] =>
      Array.from(img.data.subarray(i * 4, i * 4 + 4));
    const cold = rgbaAt(0);
    const ice = rgbaAt(1);
    const warm = rgbaAt(2);
    expect(cold[2]!).toBeGreaterThan(cold[0]!); // 冷＝蓝主导
    expect(warm[0]!).toBeGreaterThan(warm[2]!); // 暖＝红主导
    expect(lumaOf(ice)).toBeGreaterThan(lumaOf(cold)); // 冰点近白（全场最亮档）
    expect(lumaOf(ice)).toBeGreaterThan(lumaOf(warm));
    expect(spreadOf(ice)).toBeLessThan(20); // 低饱和＝白心带（0°C 落白心侧档）
    for (let i = 0; i < 3; i++) expect(rgbaAt(i)[3]).toBe(255); // 全域着色（无透明档）
  });
});
