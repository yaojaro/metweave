/**
 * gh 要素档案单测：显示换算（gpm 恒等直读——÷10 dam 候选弃用取舍）、入档头对齐
 * （HGT/500mb——容器头实测）、浅渐进色带形态（Blues 七段低浅高深、单色非发散）、
 * 等距档与等值线对齐（固定域端点与全部断点均为 60 gpm 整数倍、**末断点恰为 5880**
 * ——填色档界与特值线对齐，副高体起最深档）、等值线口径（60 gpm 常规＋5880 特值＋
 * 无加密线）与渲染形态（filled+contours）、特值线几何集成（真实口径在小场上 5880 线
 * 存在且线种 highlighted；场值域不含 5880 时静默无线）、渲染像素方向（低浅高深渐进）——
 * 档案是色标与档位的单一事实来源，本测试锁其口径不被无意改动。
 */
import { describe, expect, it } from "vitest";
import {
  ghProfile,
  buildColorScale,
  equalStepBreaks,
  contoursOf,
  renderToImageData,
  type Grid,
  type GridStats,
} from "../index";

/**
 * 中国域窗 gh_cn.mwgrid 容器头实测 stats（2026-10-06T18Z f000：5109.5–5922.5 gpm，
 * p50 5870.7——连续场，5880 线＝副高锚且在本窗值域内；gpm 存储＝显示同值）。
 */
const CN_STATS: GridStats = {
  min: 5109.49169921875,
  max: 5922.49169921875,
  p10: 5581.171875,
  p25: 5742.69189453125,
  p50: 5870.65185546875,
  p75: 5894.2919921875,
  p90: 5902.171875,
  p99: 5910.73193359375,
};

/** 最小网格工厂（与 prmsl.test 同构）：值按行序西→东，单位＝存储 gpm（恒等直读）。 */
const tinyGrid = (values: number[], nx = 2, ny = 2): Grid => ({
  header: {
    version: 1,
    variable: "HGT",
    level: "500mb",
    unit: "gpm",
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

/** 十六进制色 → RGB。 */
const rgbOf = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

/** 相对亮度（Blues 单色渐进的单调性判据：低档亮、高档暗）。 */
const lumaOf = (hex: string): number => {
  const [r, g, b] = rgbOf(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

describe("gh 档案", () => {
  it("显示换算 gpm 恒等直读（存储＝显示同单位；÷10 dam 候选弃用——5880 是 gpm 口径锚）", () => {
    expect(ghProfile.toDisplay(5109.49169921875)).toBe(5109.49169921875);
    expect(ghProfile.toDisplay(5880)).toBe(5880);
    expect(ghProfile.storageUnit).toBe("gpm"); // 容器头原串
    expect(ghProfile.displayUnit).toBe("gpm");
  });

  it("入档口径与容器头对齐（HGT/500mb——gh_cn.mwgrid 实测，500hPa 位势高度）", () => {
    expect(ghProfile.variable).toBe("HGT");
    expect(ghProfile.level).toBe("500mb");
    expect(ghProfile.shortName).toBe("gh");
    expect(ghProfile.labelZh).toBe("500hPa 高度");
  });

  it("色带为 Blues 内七段浅渐进（低浅高深、单色蓝系非发散、裁去最深两档）", () => {
    const stops = ghProfile.colorStops;
    expect(stops).toHaveLength(7);
    for (const c of stops) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    // 单色渐进：蓝主导且亮度单调下降（浅→深），红通道不随档抬升（非发散色）
    for (const c of stops) {
      const [r, , b] = rgbOf(c);
      expect(b).toBeGreaterThan(r);
    }
    for (let i = 1; i < stops.length; i++) {
      expect(lumaOf(stops[i]!)).toBeLessThan(lumaOf(stops[i - 1]!));
    }
    const last = rgbOf(stops[6]!); // 高端最深蓝（裁去 Blues 最深两档 #08519c/#08306b 不上场）
    expect(last[2]).toBeGreaterThan(last[0] + 60);
    expect(lumaOf(stops[6]!)).toBeGreaterThan(40); // 浅填色纪律：最深档仍是可读蓝非墨色
  });

  it("等距固定域 [5040,5940]×60 gpm×15 档：全部断点为 60 的倍数、末断点恰为 5880（档界即等值线位）", () => {
    const equal = ghProfile.equal!;
    expect(equal).toEqual({ min: 5040, max: 5940, bins: 15 });
    const scale = buildColorScale(ghProfile, CN_STATS);
    expect(scale.breaks).toEqual(equalStepBreaks(5040, 5940, 15));
    expect(scale.breaks).toHaveLength(14);
    for (const b of scale.breaks) {
      expect(b % 60).toBe(0); // 档界与 60 gpm 等值线天然对齐（域端点为 60 的倍数）
    }
    expect(scale.breaks[0]).toBe(5100);
    expect(scale.breaks[13]).toBe(5880); // 末断点＝特值线：副高体 [5880,∞) 起最深档
    expect(scale.colors).toBe(ghProfile.colorStops);
    expect(scale.transparentBins).toBeUndefined(); // 等值线主导：全域浅填色、无透明档
    expect(scale.logScale).toBeUndefined();
  });

  it("不立分位推荐（分位断点不落 60 gpm 倍数、与等值线错位失去对齐价值——单一推荐）", () => {
    expect(ghProfile.quantile).toBeUndefined();
    expect(ghProfile.defaultMode).toBe("equal");
  });

  it("渲染形态＝filled+contours（等值线主导）；等值线口径 60 gpm 常规＋5880 特值＋无加密线", () => {
    expect(ghProfile.renderForm).toBe("filled+contours");
    expect(ghProfile.contours).toBeDefined();
    expect(ghProfile.contours?.interval).toBe(60);
    expect(ghProfile.contours?.highlighted).toEqual([5880]); // 副高锚（gpm 口径直读 5880）
    expect(ghProfile.contours?.minorInterval).toBeUndefined(); // 500hPa 高度图惯例不加密
  });

  it("渲染集成：色斑像素沿档渐进（低＝浅亮、高＝深蓝，5880 以上最深档），全域着色", () => {
    // 一行四值（gpm）：5150（浅）/5400（中浅）/5725（中深）/5875（深）→ 档 1/6/11/13
    const img = renderToImageData(
      tinyGrid([5100, 5500, 5800, 5900], 4, 1),
      buildColorScale(ghProfile, CN_STATS),
      { convert: ghProfile.toDisplay },
    );
    const rgbaAt = (i: number): [number, number, number, number] => {
      const a = img.data.subarray(i * 4, i * 4 + 4);
      return [a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, a[3] ?? 0];
    };
    const luma = (i: number): number => {
      const [r, g, b] = rgbaAt(i);
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };
    expect(luma(0)).toBeGreaterThan(luma(1)); // 低高度浅、高高度深（Blues 单调渐进）
    expect(luma(1)).toBeGreaterThan(luma(2));
    expect(luma(2)).toBeGreaterThan(luma(3));
    const deep = rgbaAt(3);
    expect(deep[2]).toBeGreaterThan(deep[0] + 60); // 高端蓝主导
    for (let i = 0; i < 4; i++) expect(rgbaAt(i)[3]).toBe(255); // 全域着色（无透明档）
  });

  it("特值线几何集成：值域含 5880 的场上 5880 线存在且线种 highlighted（兼为 60 倍数仍归特值）", () => {
    // 1×5 行（gpm）：5740..5900 步 40——threshold (5740,5900) 内 60 倍数＝5760/5820/5880
    const grid = tinyGrid([5740, 5780, 5820, 5860, 5900], 5, 1);
    const lines = contoursOf(grid, ghProfile.contours!, ghProfile.toDisplay);
    expect(lines.map((l) => l.value)).toEqual([5760, 5820, 5880]);
    expect(lines.map((l) => l.kind)).toEqual(["major", "major", "highlighted"]);
    // 5880 线有实环可描（特值线不是空声明——几何在）
    expect(lines[2]?.rings.length).toBeGreaterThan(0);
  });

  it("场值域不含 5880 时特值线静默缺席（场外特值跳过，非错误）——隆冬场常态", () => {
    // 1×5 行全低于 5880：threshold (5240,5400) 内 60 倍数＝5280/5340，无 5880 线
    const grid = tinyGrid([5240, 5280, 5320, 5360, 5400], 5, 1);
    const lines = contoursOf(grid, ghProfile.contours!, ghProfile.toDisplay);
    expect(lines.map((l) => l.value)).toEqual([5280, 5340]);
    expect(lines.map((l) => l.kind)).toEqual(["major", "major"]);
  });
});
