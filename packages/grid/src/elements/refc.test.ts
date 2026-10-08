/**
 * refc 要素档案单测：换算口径（dB 存储＝dBZ 显示，恒等）、入档头对齐（REFC/atm——
 * 容器头实测）、色带形态（NWS 反射率标准色标 15 级＋首档无回波灰，每色加倍停靠共
 * 32 项——档中心取样逐档精确命中 NWS 原色的设计锁）、阈值档（NWS 5 dBZ 一档 5–75
 * ×16 档）、−20 无回波哨兵首档透明的渲染断言（哨兵像素 alpha 0、5 dBZ 起正常着色、
 * 透明不波及相邻档、opacity 不复活）、等值线留位——档案是色标与档位的单一事实来源，
 * 本测试锁其口径不被无意改动。本切片内核零改动（阈值档＋档级透明复用 CAPE 切片两能力）。
 */
import { describe, expect, it } from "vitest";
import {
  refcProfile,
  buildColorScale,
  thresholdBreaks,
  binIndexAt,
  renderToImageData,
  type Grid,
  type GridStats,
} from "../index";

/**
 * 中国域窗 refc_cn.mwgrid 容器头实测 stats（2026-10-06T18Z f000：−20.0–41.67 dBZ，
 * p10=p25=p50=−20 无回波哨兵堆约 3/4 点、p75=−19.95 真实弱回波——GRIB 解码落值）。
 */
const CN_STATS: GridStats = {
  min: -20.000003814697266,
  max: 41.66999816894531,
  p10: -20.000003814697266,
  p25: -20.000003814697266,
  p50: -20.000003814697266,
  p75: -19.95000457763672,
  p90: 6.00999641418457,
  p99: 30.12999725341797,
};

/** 最小网格工厂（与 cape/prate/vis.test 同构）：值按行序西→东，单位＝存储 dB。 */
const tinyGrid = (values: number[], nx = 2, ny = 2): Grid => ({
  header: {
    version: 1,
    variable: "REFC",
    level: "atm",
    unit: "dB",
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

/** 十六进制色 → RGB（方向与精确命中断言用） */
const rgbOf = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

describe("refc 档案", () => {
  it("显示换算恒等（dB 存储＝dBZ 显示——dB 即 dBZ，无换算）", () => {
    expect(refcProfile.toDisplay(-20)).toBe(-20);
    expect(refcProfile.toDisplay(0)).toBe(0);
    expect(refcProfile.toDisplay(41.67)).toBeCloseTo(41.67, 10);
    expect(refcProfile.displayUnit).toBe("dBZ");
    expect(refcProfile.storageUnit).toBe("dB"); // 容器头原串
  });

  it("入档口径与容器头对齐（REFC/atm/dB——refc_cn.mwgrid 实测，整层大气）", () => {
    expect(refcProfile.variable).toBe("REFC");
    expect(refcProfile.level).toBe("atm");
    expect(refcProfile.shortName).toBe("refc");
  });

  it("色带为 NWS 反射率标准色标（15 级加倍停靠共 32 项），全部合法且成对相同", () => {
    const stops = refcProfile.colorStops;
    // 16 档（含透明首档）×每色重复两次＝32 停靠：档中心取样恰落同色对内（见下一例）
    expect(stops.length).toBe(32);
    for (const c of stops) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    for (let i = 0; i < stops.length; i += 2) {
      expect(stops[i]).toBe(stops[i + 1]); // 加倍成对——拆对即取样偏离 NWS 原色
    }
    // 首对＝无回波灰（透明档位，NWS 弱/无回波灰）、5 dBZ 位青、末对＝75 dBZ 白
    expect(stops[0]).toBe("#646464");
    expect(stops[2]).toBe("#04e9e7");
    expect(stops.at(-1)).toBe("#fdfdfd");
    // 色相进程方向锁（写反即红）：绿位(20)绿主导、红位(50)红主导、紫位(70)蓝>红、白位 RGB 齐
    const green = rgbOf(stops[10]!); // 20 dBZ #02fd02
    const red = rgbOf(stops[22]!); // 50 dBZ #fd0000
    const purple = rgbOf(stops[28]!); // 70 dBZ #9854c6
    const white = rgbOf(stops[30]!); // 75 dBZ #fdfdfd
    expect(green[1]).toBeGreaterThan(green[0] + 80);
    expect(red[0]).toBeGreaterThan(red[1] + 80);
    expect(purple[2]).toBeGreaterThan(purple[0]);
    expect(white[0]).toBe(white[1]);
    expect(white[1]).toBe(white[2]);
  });

  it("阈值档：NWS 5 dBZ 一档 5–75 共 15 断点×16 档（档界即 NWS 级界），实测分布落位", () => {
    const thresholds = refcProfile.thresholds ?? [];
    expect(thresholds).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75]);
    const breaks = thresholdBreaks(thresholds);
    expect(breaks).toEqual(thresholds); // 显式业务阈值原样（不做均分/分位近似）
    // 左闭右开：恰在阈值上的值归上档；首档 [−∞,5) 兜住哨兵与极弱回波、顶档 [75,∞) 延续 75 级白
    expect(binIndexAt(-20.000003814697266, breaks)).toBe(0); // 无回波哨兵（解码落值）
    expect(binIndexAt(4.99, breaks)).toBe(0); // <5 dBZ 极弱回波（NWS 显示下限以下）
    expect(binIndexAt(5, breaks)).toBe(1);
    expect(binIndexAt(9.99, breaks)).toBe(1);
    expect(binIndexAt(10, breaks)).toBe(2);
    expect(binIndexAt(75, breaks)).toBe(15);
    expect(binIndexAt(Number.MAX_VALUE, breaks)).toBe(15);
    // 中国域窗实测分布落位：哨兵堆（p10=p25=p50）与 p75=−19.95 弱回波全落首档（透明）、
    // p90=6.01 落 [5,10)、p99=30.13 落 [30,35)、max=41.67 落 [40,45)
    expect(binIndexAt(CN_STATS.min, breaks)).toBe(0);
    expect(binIndexAt(CN_STATS.p50, breaks)).toBe(0);
    expect(binIndexAt(CN_STATS.p75, breaks)).toBe(0);
    expect(binIndexAt(CN_STATS.p90, breaks)).toBe(1);
    expect(binIndexAt(CN_STATS.p99, breaks)).toBe(6);
    expect(binIndexAt(CN_STATS.max, breaks)).toBe(8);
  });

  it("−20 哨兵首档透明：哨兵像素 alpha 0、5 dBZ 起正常着色，透明不波及相邻档", () => {
    expect(refcProfile.transparentBins).toEqual([0]);
    const scale = buildColorScale(refcProfile, CN_STATS);
    expect(scale.breaks).toEqual(refcProfile.thresholds);
    expect(scale.colors).toBe(refcProfile.colorStops);
    expect(scale.transparentBins).toEqual(new Set([0]));
    expect(scale.logScale).toBeUndefined(); // 线性定档（dBZ 值域不跨量级）
    // 集成断言：2×2 场＝哨兵 −20.000004（首档）、4.99（首档极弱回波）、5（bin 1）、10（bin 2）
    const img = renderToImageData(tinyGrid([-20.000003814697266, 4.99, 5, 10]), scale);
    const px = (i: number): readonly number[] => Array.from(img.data.subarray(i * 4, i * 4 + 4));
    expect(px(0)).toEqual([0, 0, 0, 0]); // 无回波哨兵——不上色、底图透出（打包真值走显示层透明）
    expect(px(1)).toEqual([0, 0, 0, 0]); // <5 dBZ 极弱回波与哨兵同档同形态（NWS 显示下限以下）
    expect(px(2)).toEqual([...rgbOf("#04e9e7"), 255]); // 5 dBZ 起正常着色且恰为 NWS 5 级青
    expect(px(3)).toEqual([...rgbOf("#019ff4"), 255]); // 相邻档不牵连——10 dBZ 恰为 NWS 10 级蓝
    // 缺测透明（既有语义）与 opacity 不复活（透明档与整体不透明度无关）
    const nanImg = renderToImageData(tinyGrid([Number.NaN, 5, 5, 5]), scale, { opacity: 0.5 });
    const npx = (i: number): readonly number[] =>
      Array.from(nanImg.data.subarray(i * 4, i * 4 + 4));
    expect(npx(0)).toEqual([0, 0, 0, 0]); // 缺测透明
    const half = renderToImageData(tinyGrid([-20.000003814697266, 5, 5, 5]), scale, {
      opacity: 0.5,
    });
    expect(Array.from(half.data.subarray(0, 4))).toEqual([0, 0, 0, 0]); // 哨兵不因滑杆复活
    expect(Array.from(half.data.subarray(4, 8))).toEqual([...rgbOf("#04e9e7"), 128]); // 着色档受滑杆
  });

  it("逐档精确命中 NWS 原色：16 值 4×4 场逐像素等于该档停靠色（加倍停靠的设计锁）", () => {
    const scale = buildColorScale(refcProfile, CN_STATS);
    const levels = [-20, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75];
    const img = renderToImageData(tinyGrid(levels, 4, 4), scale); // 原生分辨率＝逐格点取值
    for (let bin = 0; bin < 16; bin++) {
      const o = bin * 4;
      const px = Array.from(img.data.subarray(o, o + 4));
      if (bin === 0) {
        expect(px).toEqual([0, 0, 0, 0]); // 首档（哨兵/极弱回波）透明
        continue;
      }
      // bin k 的取样位 (k+0.5)/16 落加倍停靠对 [2k, 2k+1] 内——两停靠同色即精确命中
      const [r, g, b] = rgbOf(refcProfile.colorStops[2 * bin]!);
      expect(px).toEqual([r, g, b, 255]);
    }
  });

  it("不立等距/分位推荐（哨兵堆 p10=p25=p50=−20 的分位档塌档失效；阈值档要素单一推荐模式）", () => {
    expect(refcProfile.equal).toBeUndefined();
    expect(refcProfile.quantile).toBeUndefined();
    expect(refcProfile.defaultMode).toBe("threshold");
  });

  it("渲染形态＝色斑图；等值线留位字段口径在位（5 dBZ、无特值线）", () => {
    expect(refcProfile.renderForm).toBe("filled");
    expect(refcProfile.contours).toBeDefined();
    expect(refcProfile.contours?.interval).toBe(5);
    expect(refcProfile.contours?.highlighted).toEqual([]); // 反射率无特值线惯例
  });
});
