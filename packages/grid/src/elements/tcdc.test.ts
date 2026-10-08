/**
 * tcdc（总云量）要素档案单测：换算口径（恒等）、入档头对齐（TCDC/atm——容器头实测；
 * 短名对齐 gen:grid CLI 键）、灰白渐进色带（纯灰族、浅白→深灰、最深档非墨色）、
 * 有界场等距特例 25%×4 档（业务 4 级制——档界恰为 25 倍数、0/100 贴边堆稳落两端
 * 外延档）、分位推荐不立的失效实证（p75=p90=100 饱和退化直接抛错）、渲染形态与
 * 等值线留位、渲染集成（四档灰阶单调加深、全域着色——零值堆是真值「晴空」不透明）
 * ——档案是色标与档位的单一事实来源，本测试锁其口径不被无意改动。零新能力切片：
 * 档案 + 清单一行即上线，内核零改动。
 */
import { describe, expect, it } from "vitest";
import {
  tcdcProfile,
  buildColorScale,
  equalStepBreaks,
  quantileBreaks,
  binIndexAt,
  renderToImageData,
  type Grid,
  type GridStats,
} from "../index";

/**
 * 中国域窗 tcdc_cn.mwgrid 容器头实测 stats（2026-10-06T18Z f000：0–100%，双峰贴边
 * ——p10=0、p25=0.3、p50=31、p75=p90=p99=100，恰零值 23.9%＋恰 100 占 25.1%）。
 */
const CN_STATS: GridStats = {
  min: 0,
  max: 100,
  p10: 0,
  p25: 0.30000001192092896,
  p50: 31,
  p75: 100,
  p90: 100,
  p99: 100,
};

/** 最小网格工厂（与 rh/t850.test 同构）：值按行序西→东，单位＝存储 %。 */
const tinyGrid = (values: number[], nx: number, ny: number): Grid => ({
  header: {
    version: 1,
    variable: "TCDC",
    level: "atm",
    unit: "%",
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

/** 相对亮度（灰阶深浅判据）。 */
const lumaOf = (px: readonly number[]): number =>
  0.299 * (px[0] ?? 0) + 0.587 * (px[1] ?? 0) + 0.114 * (px[2] ?? 0);

/** 灰深（纯灰族十六进制色的 R 通道即亮度，档案停靠判据用）。 */
const greyLevel = (c: string): number => Number.parseInt(c.slice(1, 3), 16);

describe("tcdc（总云量）档案", () => {
  it("显示换算恒等（% 存储＝% 显示，无换算）", () => {
    expect(tcdcProfile.toDisplay(0)).toBe(0);
    expect(tcdcProfile.toDisplay(31)).toBe(31);
    expect(tcdcProfile.toDisplay(100)).toBe(100);
    expect(tcdcProfile.displayUnit).toBe("%");
    expect(tcdcProfile.storageUnit).toBe("%");
  });

  it("入档口径与容器头对齐（TCDC/atm/%——tcdc_cn.mwgrid 实测）；短名对齐 gen CLI 键", () => {
    expect(tcdcProfile.variable).toBe("TCDC");
    expect(tcdcProfile.level).toBe("atm"); // 整层大气（gen ELEMENTS 的 lev_entire_atmosphere）
    expect(tcdcProfile.shortName).toBe("tcdc");
    expect(tcdcProfile.labelZh).toBe("总云量");
    // 短名照 gen:grid CLI 的 ELEMENTS 键（「拉最新」中间件原样转发 CLI，键对齐即直通
    // ——gh≠hgt 键断裂的反例在前）；gen 产物文件名 tcdc_cn.mwgrid 即该键的产物名
  });

  it("色带为灰白渐进（晴→阴＝浅白→深灰）：纯灰族、亮度单调递减、最深档非墨色", () => {
    const stops = tcdcProfile.colorStops;
    expect(stops.length).toBeGreaterThanOrEqual(5);
    for (const c of stops) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    for (const c of stops) {
      const n = Number.parseInt(c.slice(1), 16);
      expect((n >> 16) & 0xff).toBe((n >> 8) & 0xff); // R=G=B（ColorBrewer Greys 族）
      expect((n >> 8) & 0xff).toBe(n & 0xff);
    }
    expect(stops[0]).toBe("#ffffff"); // 晴端纯白（无云＝无内容）
    expect(stops.at(-1)).toBe("#525252"); // 阴端深灰（九级裁去最深两档——非墨色，照 gh/pres 惯例）
    for (let i = 1; i < stops.length; i++) {
      expect(greyLevel(stops[i]!)).toBeLessThan(greyLevel(stops[i - 1]!));
    }
  });

  it("等距档：有界场特例 [0,100]×25%×4 档（业务 4 级制）——断点恰为 25/50/75，0/100 贴边堆稳落两端外延档", () => {
    const { min, max, bins } = tcdcProfile.equal!; // 等距域在位（threshold 要素才可缺席——档案字面量静态可证）
    expect(min).toBe(0);
    expect(max).toBe(100);
    expect(bins).toBe(4); // 25% 一档＝晴/少云/多云/阴四级（表 B「0/25/50/75/100」五个档界值）
    const breaks = equalStepBreaks(min, max, bins);
    expect(breaks).toHaveLength(3);
    expect(breaks).toEqual([25, 50, 75]); // 档界恰为 25 的倍数＝留位等值线 interval 25 的线位
    // binIndexAt 两端外延档语义与物理边界重合：恰零值堆（晴端 23.9%）落第 0 档、
    // 恰 100 贴顶堆（阴端 25.1%）落最外第 3 档（[75,∞) 外延档恰兜住 [75,100]）
    expect(binIndexAt(0, breaks)).toBe(0);
    expect(binIndexAt(24.9, breaks)).toBe(0);
    expect(binIndexAt(25, breaks)).toBe(1); // 恰在断点上归上档（左闭右开）
    expect(binIndexAt(49.9, breaks)).toBe(1);
    expect(binIndexAt(50, breaks)).toBe(2);
    expect(binIndexAt(74.9, breaks)).toBe(2);
    expect(binIndexAt(75, breaks)).toBe(3);
    expect(binIndexAt(100, breaks)).toBe(3);
    // 实测头极值（min 0 / max 100）即物理全域，全落域内两端档
    expect(binIndexAt(CN_STATS.min, breaks)).toBe(0);
    expect(binIndexAt(CN_STATS.max, breaks)).toBe(3);
  });

  it("分位推荐不立（饱和偏高的场分位失效）：实测头 p75=p90=100 同值退化直接抛错", () => {
    // 表 A 全球调研 p50 98.9 饱和偏高（GFS 云量偏差）＋本窗 p75 起全档贴顶 100——
    // 分位断点堆在贴顶值上退化，quantileBreaks 严格递增校验显式抛错（不静默错档）。
    // 单一推荐模式＝等距（固定域即物理全域，跨时次可比）。
    expect(tcdcProfile.quantile).toBeUndefined();
    expect(() => quantileBreaks(CN_STATS, [0.1, 0.25, 0.5, 0.75, 0.9])).toThrow(/严格递增/);
  });

  it("buildColorScale 缺省（等距）产出 3 断点完整色标（无透明档、无 log）", () => {
    const scale = buildColorScale(tcdcProfile, CN_STATS);
    expect(tcdcProfile.defaultMode).toBe("equal");
    expect(scale.breaks).toEqual([25, 50, 75]);
    expect(scale.colors).toBe(tcdcProfile.colorStops);
    // 双峰贴边的两端堆是真值（晴空/满云）非「无信号」——无透明档，全域着色
    expect(scale.transparentBins).toBeUndefined();
    expect(scale.logScale).toBeUndefined(); // 线性定档（% 有界场无需对数）
  });

  it("渲染形态＝filled（表 B 主形态色斑图）；等值线留位口径在位（25%、无特值线、无加密线）", () => {
    expect(tcdcProfile.renderForm).toBe("filled");
    expect(tcdcProfile.contours).toBeDefined();
    expect(tcdcProfile.contours?.interval).toBe(25); // 档界即线位（25/50/75 与 breaks 重合）
    expect(tcdcProfile.contours?.highlighted).toEqual([]); // 云量无特值线惯例
    expect(tcdcProfile.contours?.minorInterval).toBeUndefined(); // 无加密线
  });

  it("渲染集成：四档灰阶单调加深（晴最亮→阴最深、最深档非墨色）、全域着色（零值堆是真值「晴空」不透明）", () => {
    // 一行四值（% 存储）：0（晴）/30（少云）/60（多云）/100（阴）——恰落 0–3 档
    const img = renderToImageData(
      tinyGrid([0, 30, 60, 100], 4, 1),
      buildColorScale(tcdcProfile, CN_STATS),
      { convert: tcdcProfile.toDisplay },
    );
    const rgbaAt = (i: number): readonly number[] =>
      Array.from(img.data.subarray(i * 4, i * 4 + 4));
    const clear = rgbaAt(0);
    const few = rgbaAt(1);
    const cloudy = rgbaAt(2);
    const overcast = rgbaAt(3);
    for (const px of [clear, few, cloudy, overcast]) {
      expect(px[3]).toBe(255); // 全域着色——零值堆是打包真值（晴空）非无信号（与 cape/prate 相反）
    }
    expect(lumaOf(clear)).toBeGreaterThan(lumaOf(few)); // 晴→阴单调加深
    expect(lumaOf(few)).toBeGreaterThan(lumaOf(cloudy));
    expect(lumaOf(cloudy)).toBeGreaterThan(lumaOf(overcast));
    expect(lumaOf(clear)).toBeGreaterThan(230); // 晴端近纯白
    expect(lumaOf(overcast)).toBeGreaterThan(60); // 阴端深灰非墨色（#525252 族取样）
  });
});
