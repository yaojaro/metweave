/**
 * wind（10m 风）要素档案单测：双分量合成口径（variable WIND 对齐合成场、层/单位沿
 * 分量头）、windy 原版克隆色带（七段：灰蓝→钴蓝→青→青绿→黄绿→红棕→品红，2026-10-27
 * owner 定向——从 windy.com 图例 linear-gradient 定义逐色抽取 rgb 换算）、threshold
 * 阈值档＝windy m/s 锚点（3/5/10/15/20/30——蒲福 12 级 32.7 落 30+ 品红档、不看
 * stats 固定可比）、等距/分位不立（单一推荐）、renderForm "filled+barbs" 与风向杆口径
 * （step 10／calmThreshold 1）＋等值线 4 m/s 留位、渲染像素方向（合成风速低浅高深）
 * ＋杆位集成（windBarbsOf 按档案口径）——档案是色标与档位的单一事实来源，本测试锁其
 * 口径不被无意改动。
 */
import { describe, expect, it } from "vitest";
import {
  windProfile,
  buildColorScale,
  windBarbsOf,
  windSpeedGrid,
  renderToImageData,
  type Grid,
  type GridStats,
} from "../index";

/**
 * 中国域窗 windu/windv_cn.mwgrid 双场**合成风速**实测 stats（2026-10-06T18Z f000：
 * √(u²+v²) 现算——min 0.008–max 20.44 m/s、p50 2.56；u/v 分量各自 −13.88–15.87／
 * −20.14–11.46 有符号，不作独立色斑）。档案色标消费的是合成场 stats（装载期
 * windSpeedGrid 现算入头），非分量 stats。
 */
const CN_SPEED_STATS: GridStats = {
  min: 0.008281614631414413,
  max: 20.43553352355957,
  p10: 0.8353166580200195,
  p25: 1.410438060760498,
  p50: 2.558358907699585,
  p75: 4.789395332336426,
  p90: 7.73383092880249,
  p99: 12.125712394714355,
};

/** 最小网格工厂：u/v 同几何成对产出（风向杆/合成集成用）。 */
const pairOf = (uValues: number[], vValues: number[], nx: number, ny: number): [Grid, Grid] => {
  const headerOf = (variable: string, values: number[]): Grid => ({
    header: {
      version: 1,
      variable,
      level: "10m",
      unit: "m s-1",
      grid: { nx, ny, la0: 44, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
      stats: CN_SPEED_STATS,
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
  return [headerOf("UGRD", uValues), headerOf("VGRD", vValues)];
};

/** 十六进制色 → RGB。 */
const rgbOf = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

/** 相对亮度（YlOrBr 单色渐进的单调性判据：低档亮、高档暗）。 */
const lumaOf = (hex: string): number => {
  const [r, g, b] = rgbOf(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

/** 21 格一行（0/10/20 位取定值、其余填 1）——step 10 抽稀格位断言的取值工厂。 */
const rowOf = (a: number, b: number, c: number): number[] =>
  Array.from({ length: 21 }, (_, i) => (i === 0 ? a : i === 10 ? b : i === 20 ? c : 1));

describe("wind（10m 风）档案", () => {
  it("恒等直读（分量与合成同为 m/s，无换算）；显示单位排版惯例 m/s", () => {
    expect(windProfile.toDisplay(5)).toBe(5);
    expect(windProfile.storageUnit).toBe("m s-1"); // 容器头原串
    expect(windProfile.displayUnit).toBe("m/s");
  });

  it("入档口径：variable WIND 对齐合成场（gen CLI wind 条目 label WIND/10m）、层 10m；短名对齐 gen CLI 键", () => {
    // 分量文件头是 UGRD/VGRD（容器实测），档案 variable 对齐 windSpeedGrid 的合成头
    expect(windProfile.variable).toBe("WIND");
    expect(windProfile.level).toBe("10m");
    // 短名照 gen:grid CLI 的 ELEMENTS 键（「拉最新」中间件原样转发 CLI，键对齐即直通；
    // CLI wind 条目单请求双 message 产 windu/windv 双文件）
    expect(windProfile.shortName).toBe("wind");
    expect(windProfile.labelZh).toBe("10m 风");
  });

  it("色带为 windy 原版克隆七段（灰蓝起步→钴蓝→青→青绿→黄绿→红棕→品红收）", () => {
    const stops = windProfile.colorStops;
    expect(stops).toHaveLength(7);
    for (const c of stops) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    // 首档灰蓝（windy 首段原色 rgb(98,113,184)——蓝主导带灰度）
    const [r0, , b0] = rgbOf(stops[0]!);
    expect(b0).toBeGreaterThan(r0);
    // 冷段（0–10 m/s，前三档）：蓝高于红
    for (const c of stops.slice(0, 3)) {
      const [r, , b] = rgbOf(c);
      expect(b).toBeGreaterThan(r);
    }
    // 暖段（15 m/s 起，末三档）：红高于蓝
    for (const c of stops.slice(4)) {
      const [r, , b] = rgbOf(c);
      expect(r).toBeGreaterThan(b);
    }
    // 浅纪律沿旧例：末档品红可读非墨、且深于首档灰蓝
    expect(lumaOf(stops[6]!)).toBeGreaterThan(40);
    expect(lumaOf(stops[6]!)).toBeLessThan(lumaOf(stops[0]!));
  });

  it("threshold 阈值档＝windy m/s 锚点（3/5/10/15/20/30），蒲福 12 级落 30+ 品红档", () => {
    const thresholds = windProfile.thresholds!;
    expect(thresholds).toEqual([3, 5, 10, 15, 20, 30]);
    const scale = buildColorScale(windProfile, CN_SPEED_STATS);
    expect(scale.breaks).toEqual(thresholds); // threshold 模式不看 stats：固定档界＝跨时次可比锚
    expect(scale.colors).toBe(windProfile.colorStops);
    expect(scale.colors).toHaveLength(thresholds.length + 1); // 档数＝断点数+1
    expect(scale.transparentBins).toBeUndefined(); // 风速无「无信号」档（静风是弱信号照画灰蓝档）
    expect(scale.logScale).toBeUndefined();
    // 域容纳：本窗实测 max 20.44 落 20–30 红棕档内；蒲福 12 级界 32.7 落 30+ 品红档（台风极端同色兜底）
    expect(CN_SPEED_STATS.max).toBeLessThan(30);
    expect(32.7).toBeGreaterThan(30);
  });

  it("不立等距/分位推荐（threshold 为唯一推荐——windy 锚点低速加密，等距匀分给不出）", () => {
    expect(windProfile.equal).toBeUndefined();
    expect(windProfile.quantile).toBeUndefined();
    expect(windProfile.defaultMode).toBe("threshold");
  });

  it("渲染形态＝三叠 filled+barbs+contours（0.3.2 T7）；杆口径 step 10＋静风阈 1 m/s＋四级 LOD；等值线 4 m/s 可选叠加", () => {
    expect(windProfile.renderForm).toBe("filled+barbs+contours");
    expect(windProfile.barbs).toEqual({
      step: 10,
      calmThreshold: 1,
      lod: [
        { zoom: 0, step: 20 },
        { zoom: 4, step: 10 },
        { zoom: 6, step: 5 },
        { zoom: 8, step: 3 },
      ],
    });
    // 默认视口档（zoom 4）命中 step 10＝v0.3.1 既有密度（默认观感不变）
    expect(windProfile.barbs?.lod?.find((l) => l.zoom === 4)?.step).toBe(10);
    // 等值线接线（原「留位」）：4 m/s 与填色档界重合；风速场无 L/H 语义、且属可选叠加
    expect(windProfile.contours).toEqual({
      interval: 8,
      highlighted: [],
      centers: false,
      defaultOn: false,
    });
  });

  it("渲染集成：合成场沿档全谱渐进（弱风灰蓝亮、冷段蓝主导、暖段红主导），全域着色（静风照画灰蓝档）", () => {
    // 一行四值合成风速 0.5/4/12/26 → 档 0/1/3/5（灰蓝→钴蓝→青绿→红棕——全谱各段取代表）
    const [u, v] = pairOf([0.5, 4, 12, 26], [0, 0, 0, 0], 4, 1);
    const speed = windSpeedGrid(u, v);
    const img = renderToImageData(speed, buildColorScale(windProfile, CN_SPEED_STATS), {
      convert: windProfile.toDisplay,
    });
    const chan = (i: number): [number, number, number] => {
      const a = img.data.subarray(i * 4, i * 4 + 4);
      return [a[0] ?? 0, a[1] ?? 0, a[2] ?? 0];
    };
    const luma = (i: number): number => {
      const [r, g, b] = chan(i);
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };
    expect(luma(0)).toBeGreaterThan(luma(1)); // 弱风灰档亮于蓝档（起步即区分）
    expect(chan(1)[2]).toBeGreaterThan(chan(1)[0]); // 冷段：蓝高于红
    expect(chan(2)[2]).toBeGreaterThan(chan(2)[0]); // 青绿段：仍冷主导
    expect(chan(3)[0]).toBeGreaterThan(chan(3)[2]); // 暖段：红高于蓝
    for (let i = 0; i < 4; i++) {
      expect(img.data[i * 4 + 3]).toBe(255); // 全域着色（无透明档）
    }
  });

  it("渲染像素＝档案停靠色逐档精确（停靠数＝档数时逐档取停靠原色，不与相邻档混色）", () => {
    // 七列一行取七档代表值 1/4/7/12/17/25/35 → 档 0–6 逐一命中；width 7 时像素中心恰落列中心
    const [u, v] = pairOf([1, 4, 7, 12, 17, 25, 35], [0, 0, 0, 0, 0, 0, 0], 7, 1);
    const speed = windSpeedGrid(u, v);
    const img = renderToImageData(speed, buildColorScale(windProfile, CN_SPEED_STATS), {
      width: 7,
      convert: windProfile.toDisplay,
    });
    expect(img.width).toBe(7);
    expect(img.height).toBe(1);
    for (let bin = 0; bin < 7; bin++) {
      const [r, g, b] = rgbOf(windProfile.colorStops[bin]!);
      expect([img.data[bin * 4], img.data[bin * 4 + 1], img.data[bin * 4 + 2]]).toEqual([r, g, b]);
    }
  });

  it("杆位集成：档案口径出杆（step 10 抽稀格位、静风阈滤除、方向/速度数学锚）", () => {
    // 21×2 小场（step 10 的格位：列 0/10/20、行 0——中心对齐起点恰为 0）：
    // (0,0) 西风 3 m/s（u=3,v=0）、(10,0) 静风 0.5 m/s（阈值内滤除）、(20,0) 北风 4 m/s（v=−4）
    const [u, v] = pairOf(
      [...rowOf(3, 0.5, 0), ...rowOf(3, 0.5, 0)],
      [...rowOf(0, 0, -4), ...rowOf(0, 0, -4)],
      21,
      2,
    );
    const barbs = windBarbsOf(u, v, windProfile.barbs!);
    expect(barbs).toHaveLength(2); // 静风 0.5 < 1 m/s 不出杆
    const west = barbs[0]!;
    expect(west.direction).toBe(270); // u>0,v=0 向东吹＝西风来向 270
    expect(west.speed).toBeCloseTo(3, 6);
    const north = barbs[1]!;
    expect(north.direction).toBe(0); // v<0 向南吹＝北风来向 0（270−(−90)＝360 归一 0）
    expect(north.speed).toBeCloseTo(4, 6);
  });
});
