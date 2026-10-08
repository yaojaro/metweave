/**
 * sp（地面气压）要素档案单测：换算口径（Pa→hPa ÷100）、入档头对齐（PRES/sfc——容器头
 * 实测；短名对齐 gen:grid CLI 键 pres）、浅渐进色带形态（Purples 五段低浅高深〔裁最深四段防双峰场近墨——owner 反馈〕、单色
 * 紫系非发散）、等距档与等值线对齐（固定域 [488,1064] 含全球调研极值 497.8–1059、
 * 档宽 8 hPa 裁量——全部断点为 4 的整数倍，填色档界与 4 hPa 等值线对齐每两线一色界）、
 * 等值线口径（4 hPa 常规＋无加密线〔地形噪声裁量〕＋无特值线）与渲染形态
 * （filled+contours）、等值线几何集成（真实口径小场线值/线种——无 minor 线种）、
 * L/H 中心检测集成（地形如实原则——addContourLayer 缺省开启中心标注）——档案是色标
 * 与档位的单一事实来源，本测试锁其口径不被无意改动。
 */
import { describe, expect, it } from "vitest";
import {
  spProfile,
  buildColorScale,
  equalStepBreaks,
  contoursOf,
  centersOf,
  renderToImageData,
  type Grid,
  type GridStats,
} from "../index";

/**
 * 中国域窗 pres_cn.mwgrid 容器头实测 stats（2026-10-06T18Z f000：497.30–1029.39 hPa，
 * p50 991.70——含地形效应的双峰连续场〔p25 904.77 在高原侧、p90 1013.83 在平原侧，
 * 高原 500 hPa 级极低值非天气低压〕；Pa 存储值）。
 */
const CN_STATS: GridStats = {
  min: 49729.8359375,
  max: 102939.4375,
  p10: 77776.234375,
  p25: 90477.0390625,
  p50: 99169.8359375,
  p75: 101233.8359375,
  p90: 101382.640625,
  p99: 102104.234375,
};

/** 最小网格工厂（与 prmsl/gh.test 同构）：值按行序西→东，单位＝存储 Pa。 */
const tinyGrid = (values: number[], nx = 2, ny = 2): Grid => ({
  header: {
    version: 1,
    variable: "PRES",
    level: "sfc",
    unit: "Pa",
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

/** 相对亮度（Purples 单色渐进的单调性判据：低档亮、高档暗）。 */
const lumaOf = (hex: string): number => {
  const [r, g, b] = rgbOf(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

describe("sp（地面气压）档案", () => {
  it("显示换算 Pa→hPa（÷100，换算只在档案层——转换器不动数值语义）", () => {
    expect(spProfile.toDisplay(49729.8359375)).toBeCloseTo(497.298359375, 10);
    expect(spProfile.toDisplay(102939.4375)).toBeCloseTo(1029.394375, 10);
    expect(spProfile.storageUnit).toBe("Pa"); // 容器头原串
    expect(spProfile.displayUnit).toBe("hPa");
  });

  it("入档口径与容器头对齐（PRES/sfc——pres_cn.mwgrid 实测）；短名对齐 gen:grid CLI 键", () => {
    expect(spProfile.variable).toBe("PRES");
    expect(spProfile.level).toBe("sfc");
    // 短名照 gen:grid CLI 的 ELEMENTS 键（「拉最新」中间件原样转发 CLI，键对齐即直通）；
    // gen 产物文件名 pres_cn.mwgrid 即该键的产物名
    expect(spProfile.shortName).toBe("pres");
    expect(spProfile.labelZh).toBe("地面气压");
  });

  it("色带为 Purples 内五段浅渐进（低浅高深、单色紫系非发散、裁去最深四段——双峰场深端防墨）", () => {
    const stops = spProfile.colorStops;
    expect(stops).toHaveLength(5);
    for (const c of stops) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    // 单色渐进：紫主导（蓝超红且蓝超绿——紫＝红蓝混合、绿最低位）且亮度单调下降（浅→深）
    for (const c of stops) {
      const [r, g, b] = rgbOf(c);
      expect(b).toBeGreaterThan(r);
      expect(b).toBeGreaterThan(g);
    }
    for (let i = 1; i < stops.length; i++) {
      expect(lumaOf(stops[i]!)).toBeLessThan(lumaOf(stops[i - 1]!));
    }
    const last = rgbOf(stops[4]!); // 高端最深＝#9e9ac8 中浅紫（裁去 #807dba/#6a51a3/#54278f/#3f007d 四段）
    expect(last[2]).toBeGreaterThan(last[0] - 10); // 蓝仍不小弱于红（紫系不滑向纯蓝）
    expect(lumaOf(stops[4]!)).toBeGreaterThan(140); // 浅填色纪律：最深档可读非墨色（七段版 #6a51a3 luma≈98 视觉近黑的教训）
  });

  it("等距固定域 [488,1064]×8 hPa×72 档：全部断点为 4 的倍数（档界即等值线位）且域含极值", () => {
    const equal = spProfile.equal!;
    expect(equal).toEqual({ min: 488, max: 1064, bins: 72 });
    const scale = buildColorScale(spProfile, CN_STATS);
    expect(scale.breaks).toEqual(equalStepBreaks(488, 1064, 72));
    expect(scale.breaks).toHaveLength(71);
    for (const b of scale.breaks) {
      expect(b % 4).toBe(0); // 档界与 4 hPa 常规等值线对齐（断点全 8 倍数——每两线一色界）
    }
    expect(scale.breaks[0]).toBe(496);
    expect(scale.breaks[70]).toBe(1056);
    expect(scale.colors).toBe(spProfile.colorStops);
    expect(scale.transparentBins).toBeUndefined(); // 等值线主导：全域浅填色、无透明档
    expect(scale.logScale).toBeUndefined();
    // 域容纳实测与全球调研极值（本窗 497.30–1029.39、表 A 497.8–1059——地形极值在场内）
    expect(spProfile.toDisplay(CN_STATS.min)).toBeGreaterThan(488);
    expect(spProfile.toDisplay(CN_STATS.max)).toBeLessThan(1064);
  });

  it("不立分位推荐（地形双峰分布使分位断点塌向两峰间、不落 4 hPa 倍数与等值线错位——单一推荐）", () => {
    expect(spProfile.quantile).toBeUndefined();
    expect(spProfile.defaultMode).toBe("equal");
  });

  it("渲染形态＝filled+contours（等值线主导）；等值线口径 8 hPa 常规＋无加密线＋无特值线", () => {
    expect(spProfile.renderForm).toBe("filled+contours");
    expect(spProfile.contours).toBeDefined();
    expect(spProfile.contours?.interval).toBe(16); // 4→16 可读性两步裁量（高原坡面线束 87→~22 条，详见档案头注）
    expect(spProfile.contours?.minorInterval).toBeUndefined(); // 地形噪声裁量：不加密
    expect(spProfile.contours?.highlighted).toEqual([]); // 气压无 tmp 0°C/gh 5880 类锚线
  });

  it("渲染集成：色斑像素沿档渐进（低＝浅亮、高＝深紫），全域着色", () => {
    // 一行四值（Pa）：520（高原级浅）/760（中浅）/940（中深）/1020（平原级深）→ 档 4/34/56/66
    const img = renderToImageData(
      tinyGrid([52000, 76000, 94000, 102000], 4, 1),
      buildColorScale(spProfile, CN_STATS),
      { convert: spProfile.toDisplay },
    );
    const rgbaAt = (i: number): [number, number, number, number] => {
      const a = img.data.subarray(i * 4, i * 4 + 4);
      return [a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, a[3] ?? 0];
    };
    const luma = (i: number): number => {
      const [r, g, b] = rgbaAt(i);
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };
    expect(luma(0)).toBeGreaterThan(luma(1)); // 低气压浅、高气压深（Purples 单调渐进）
    expect(luma(1)).toBeGreaterThan(luma(2));
    expect(luma(2)).toBeGreaterThan(luma(3));
    const deep = rgbaAt(3);
    expect(deep[2]).toBeGreaterThan(deep[1]); // 高端紫主导（蓝红混合、绿最低）
    for (let i = 0; i < 4; i++) expect(rgbaAt(i)[3]).toBe(255); // 全域着色（无透明档）
  });

  it("等值线集成：真实口径在小场上出 16 的倍数常规线，无加密线（kind 全 major）", () => {
    // 1×9 行（Pa→hPa 996..1028 步 4）：threshold (996,1028) 内 16 倍数＝1008/1024
    const grid = tinyGrid(
      [99600, 100000, 100400, 100800, 101200, 101600, 102000, 102400, 102800],
      9,
      1,
    );
    const lines = contoursOf(grid, spProfile.contours!, spProfile.toDisplay);
    expect(lines.map((l) => l.value)).toEqual([1008, 1024]);
    // 步 4 的场 4 倍数中的非 16 倍数（1000/1004/…）也不出线——interval 16 可读性裁量
    // （4 hPa 在高原坡面退化为线束，详见档案头注）；全线 kind＝major（无 minorInterval）
    expect(lines.map((l) => l.kind)).toEqual(["major", "major"]);
    expect(lines[0]?.rings.length).toBeGreaterThan(0); // 线有实环可描（几何在）
  });

  it("L/H 中心集成：坑场出一个 low（hPa 值）、倒坑场出一个 high（对称）——地形如实原则", () => {
    const bowl: number[] = [];
    const dome: number[] = [];
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const d = Math.max(Math.abs(y - 4), Math.abs(x - 4));
        bowl.push((1000 + d * 3) * 100); // Pa 存储
        dome.push((1012 - d * 3) * 100);
      }
    }
    const lows = centersOf(tinyGrid(bowl, 9, 9), {
      convert: spProfile.toDisplay,
      radius: 3,
    }).filter((c) => c.kind === "low");
    expect(lows).toHaveLength(1);
    expect(lows[0]?.value).toBe(1000); // hPa（显示空间检测）
    const highs = centersOf(tinyGrid(dome, 9, 9), {
      convert: spProfile.toDisplay,
      radius: 3,
    }).filter((c) => c.kind === "high");
    expect(highs).toHaveLength(1);
    expect(highs[0]?.value).toBe(1012);
  });
});
