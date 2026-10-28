// @vitest-environment happy-dom
/**
 * windTimeHeight（W-12 时间-高度剖面）可测面：验收口径全量——多层×多时刻格阵
 * （行×列的格数与行序）、风速当色（断点档界→停靠色的同族口径）、风向当标记
 * （逐格箭头旋转角＝去向）、缺测格不着色且专属形态（浅灰底＋对角短划）、内嵌
 * renderColorScaleLegend（与场图家族同一读法）、输入面防线。
 */
import { describe, expect, it } from "vitest";
import { windTimeHeight } from "./wind-time-height";
import type { WindTimeHeightSeries } from "./wind-profile";

/**
 * 取（行 ri × 列 ci）的格内容器：按平移 g 的 translate 坐标定位——格心 x＝46＋ci·22＋11、
 * y＝16＋ri·26＋13（缺省格宽 22／格高 26 的几何；仅用于缺省格宽的断言）。
 */
const barbCell = (root: HTMLElement, ri: number, ci: number): SVGGElement => {
  const holders = [...root.querySelectorAll<SVGGElement>("g")]; // svg> 组合器在 happy-dom 失配——全量取 g（内层 rotate g 不匹配 translate 正则，安全）
  const hit = holders.find((g) => {
    const m = /translate\(([\d.]+) ([\d.]+)\)/.exec(g.getAttribute("transform") ?? "");
    return m !== null && Number(m[1]) === 46 + ci * 22 + 11 && Number(m[2]) === 16 + ri * 26 + 13;
  });
  if (hit === undefined) throw new Error(`格 (${ri},${ci}) 未找到风羽容器`);
  return hit;
};

/**
 * 风羽刻度样例：结构对齐 grid 的 WIND_BARB_SCALES（测试自备数值形态，不在 render
 * 侧复制产线常数——单源纪律的测试面镜像）。
 */
const BARB_SCALES = {
  "m/s": { pennant: 20, long: 4, short: 2 },
  kt: { pennant: 50, long: 10, short: 5 },
} as const;

/** 10m 风家族同款色标（七档七色，与 @metweave/grid 的 windProfile 档案同构样例）。 */
const WIND_SCALE = {
  breaks: [3, 5, 10, 15, 20, 30],
  colors: ["#6271b8", "#3d6ea3", "#4a939f", "#4c9964", "#84963b", "#98565c", "#974b91"],
};

/** 4 层 × 8 时刻样例：夹缺测格（speed null）、无向格（direction null）、静风格。 */
const SERIES_4x8: WindTimeHeightSeries = {
  times: ["00Z", "03Z", "06Z", "09Z", "12Z", "15Z", "18Z", "21Z"],
  levels: [
    {
      pressure: 850,
      cells: [
        { speed: 4, direction: 180 },
        { speed: 7, direction: 190 },
        { speed: null, direction: null },
        { speed: 12, direction: 210 },
        { speed: 9, direction: 205 },
        { speed: 6, direction: 200 },
        { speed: 3, direction: 195 },
        { speed: 2, direction: 185 },
      ],
    },
    {
      pressure: 700,
      cells: [
        { speed: 8, direction: 260 },
        { speed: 11, direction: 265 },
        { speed: 14, direction: 270 },
        { speed: 16, direction: null },
        { speed: 13, direction: 275 },
        { speed: 10, direction: 280 },
        { speed: 9, direction: 285 },
        { speed: 7, direction: 290 },
      ],
    },
    {
      pressure: 500,
      cells: [
        { speed: 18, direction: 290 },
        { speed: 22, direction: 295 },
        { speed: 25, direction: 300 },
        { speed: 31, direction: 305 },
        { speed: 28, direction: 310 },
        { speed: 0, direction: null },
        { speed: 19, direction: 292 },
        { speed: 17, direction: 288 },
      ],
    },
    {
      pressure: 300,
      cells: [
        { speed: 33, direction: 300 },
        { speed: 36, direction: 305 },
        { speed: 40, direction: 310 },
        { speed: 38, direction: 315 },
        { speed: 35, direction: 320 },
        { speed: 32, direction: 310 },
        { speed: 34, direction: 308 },
        { speed: 30, direction: 302 },
      ],
    },
  ],
};

describe("windTimeHeight（W-12 时间-高度剖面）", () => {
  it("格阵结构：行×列＝层×时刻、行自上而下＝高度升序（气压降序）、列标签最疏整间隔", () => {
    const root = windTimeHeight(SERIES_4x8, { scale: WIND_SCALE });
    expect(root.dataset.rows).toBe("4");
    expect(root.dataset.cols).toBe("8");
    expect(root.dataset.axis).toBe("pressure");
    const colored = root.querySelectorAll("rect:not(.mw-wth-cellmissing)");
    // 32 格 − 缺测 2 格（850/06Z 与…只有 1 格缺测）＝ 31 着色格
    expect(colored).toHaveLength(31);
    const missing = root.querySelectorAll("rect.mw-wth-cellmissing");
    expect(missing).toHaveLength(1);
    // 行标签自上而下：300→500→700→850（高空在上；末位是轴单位 hPa）
    const rowLabels = [...root.querySelectorAll<SVGElement>(".mw-wth-rowlabel")].map(
      (t) => t.textContent,
    );
    expect(rowLabels).toEqual(["300", "500", "700", "850", "hPa"]);
  });

  it("风速当色：档界映射与场图同族口径（count(breaks ≤ v) 即档序、高档兜底取末色）", () => {
    const root = windTimeHeight(SERIES_4x8, { scale: WIND_SCALE });
    const rects = [...root.querySelectorAll<SVGRectElement>("svg > rect:not(.mw-wth-cellmissing)")];
    // 行序自上而下＝气压 300/500/700/850（ri 0..3）；格 x＝46＋ci·22＋1、y＝16＋ri·26＋1
    const fillOf = (row: number, col: number): string | null => {
      const x = 46 + col * 22 + 1;
      const y = 16 + row * 26 + 1;
      const hit = rects.find(
        (r) => Number(r.getAttribute("x")) === x && Number(r.getAttribute("y")) === y,
      );
      return hit?.getAttribute("fill") ?? null;
    };
    expect(fillOf(0, 0)).toBe(WIND_SCALE.colors[6]); // 300 hPa 00Z：33 m/s ≥30 → 末档品红
    expect(fillOf(3, 7)).toBe(WIND_SCALE.colors[0]); // 850 hPa 21Z：2 m/s <3 → 首档灰蓝
    expect(fillOf(2, 3)).toBe(WIND_SCALE.colors[4]); // 700 hPa 09Z：16 → [15,20) 档（bin＝count(breaks≤v)＝4）
  });

  it("风向当标记：逐格箭头、旋转角＝去向（来向+180）；无向格与缺测格无箭头", () => {
    const root = windTimeHeight(SERIES_4x8, { scale: WIND_SCALE });
    const arrows = root.querySelectorAll("g.mw-wth-arrow");
    // 31 着色格 − 无向格 2（700/09Z 与 500/15Z）＝ 29 枚箭头
    expect(arrows).toHaveLength(29);
    // 850 hPa 行（ri 3）格心 y＝16＋3·26＋13＝107；00Z 列心 x＝57
    const first = [...arrows].find((a) =>
      a.getAttribute("transform")?.startsWith("translate(57 107)"),
    );
    expect(first?.getAttribute("transform")).toContain("rotate(0.0)"); // 来向 180 → 去向 0（指北）
    const second = [...arrows].find((a) =>
      a.getAttribute("transform")?.startsWith("translate(79 107)"),
    );
    expect(second?.getAttribute("transform")).toContain("rotate(10.0)"); // 来向 190 → 去向 10
  });

  it("缺测格：不着色（浅灰底＋对角短划）——与弱风格一眼可分", () => {
    const root = windTimeHeight(SERIES_4x8, { scale: WIND_SCALE });
    const missingCell = root.querySelector("rect.mw-wth-cellmissing");
    expect(missingCell).not.toBeNull();
    expect(missingCell?.getAttribute("x")).toBe("91"); // 850 hPa 行 06Z 列：46＋2·22＋1
    expect(root.querySelector("line.mw-wth-slash")).not.toBeNull();
    expect(missingCell?.getAttribute("fill")).toBeNull(); // 无档色（class 形态着色）
  });

  it("内嵌色标图例：renderColorScaleLegend categorical 形态、断点即刻度（家族同一读法）", () => {
    const root = windTimeHeight(SERIES_4x8, { scale: WIND_SCALE, legendTitle: "风速（m/s）" });
    const legend = root.querySelector(".mw-csl");
    expect(legend).not.toBeNull();
    const ticks = [...root.querySelectorAll<HTMLElement>(".mw-csl-tick")].map((t) => t.textContent);
    expect(ticks).toEqual(["0", "3", "5", "10", "15", "20", "30", "+"]);
    expect(root.querySelector(".mw-csl-title")?.textContent).toBe("风速（m/s）");
  });

  it("列标签按估宽抽稀：ISO 长标签自动稀疏（8 列只示首尾），短标签可示更多枚", () => {
    // ISO 全标（17 字符 × 约 5.5px ≈ 94px）：估宽步长 ceil((94+8)/22)＝5 列——
    // 8 列下示 [0,5]＋末列 7，5 与 7 列距不足再隔掉 5 → 首尾两枚
    const isoTimes = Array.from(
      { length: 8 },
      (_, i) => `2026-10-27T${String(12 + i * 3).padStart(2, "0")}:00Z`,
    );
    const isoRoot = windTimeHeight(
      {
        times: isoTimes,
        levels: [
          { pressure: 500, cells: isoTimes.map(() => ({ speed: 5, direction: 270 })) },
          { pressure: 850, cells: isoTimes.map(() => ({ speed: 3, direction: 180 })) },
        ],
      },
      { scale: WIND_SCALE },
    );
    const isoLabels = [...isoRoot.querySelectorAll<SVGElement>(".mw-wth-collabel")].map(
      (t) => t.textContent,
    );
    expect(isoLabels).toEqual([isoTimes[0], isoTimes[7]]); // 长标签不重叠的最大间隔

    // 短标签（grid 适配器 timeLabel:"short" 的「日T时Z」形态，6 字符）：步长降到 2 列，
    // 8 列示 [0,2,4,7]（末列与 6 挤、隔掉 6）——同一格阵可读密度翻倍以上
    const shortTimes = Array.from(
      { length: 8 },
      (_, i) => `27T${String((12 + i * 3) % 24).padStart(2, "0")}Z`,
    );
    const shortRoot = windTimeHeight(
      {
        times: shortTimes,
        levels: [
          { pressure: 500, cells: shortTimes.map(() => ({ speed: 5, direction: 270 })) },
          { pressure: 850, cells: shortTimes.map(() => ({ speed: 3, direction: 180 })) },
        ],
      },
      { scale: WIND_SCALE },
    );
    const shortLabels = [...shortRoot.querySelectorAll<SVGElement>(".mw-wth-collabel")].map(
      (t) => t.textContent,
    );
    expect(shortLabels).toEqual([shortTimes[0], shortTimes[2], shortTimes[4], shortTimes[7]]);
  });

  it("高度轴行族：height 锚 → 线性高度轴；层锚混装显式抛错", () => {
    const heightSeries: WindTimeHeightSeries = {
      times: ["a", "b", "c"],
      levels: [10, 80, 120].map((h) => ({
        height: h,
        cells: [
          { speed: 2, direction: 180 },
          { speed: 4, direction: 190 },
          { speed: 6, direction: 200 },
        ],
      })),
    };
    const root = windTimeHeight(heightSeries, { scale: WIND_SCALE });
    expect(root.dataset.axis).toBe("height");
    const mixed: WindTimeHeightSeries = {
      times: ["a", "b"],
      levels: [
        { pressure: 850, cells: [{ speed: 1 }, { speed: 2 }] },
        { height: 80, cells: [{ speed: 1 }, { speed: 2 }] },
      ],
    };
    expect(() => windTimeHeight(mixed, { scale: WIND_SCALE })).toThrow(/层锚混装/);
  });

  it("aria-label 走 locale 表（P2-6）＋svg 双尺寸属性（P2-9：width/height 齐备、与 viewBox 同值）", () => {
    const root = windTimeHeight(SERIES_4x8, { scale: WIND_SCALE });
    const svg = root.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-label")).toBe("时间-高度剖面");
    expect(svg?.getAttribute("width")).toBe(svg?.getAttribute("viewBox")?.split(" ")[2]);
    expect(svg?.getAttribute("height")).toBe(svg?.getAttribute("viewBox")?.split(" ")[3]);
    const en = windTimeHeight(SERIES_4x8, { scale: WIND_SCALE, locale: "en" });
    expect(en.querySelector("svg")?.getAttribute("aria-label")).toBe(
      "Wind time-height cross section",
    );
  });

  it("缺省 arrow 零变化＋显式 arrow 同构（回归锁）：barb 模式不传时 DOM 不出现任何风羽元素", () => {
    const def = windTimeHeight(SERIES_4x8, { scale: WIND_SCALE });
    const explicit = windTimeHeight(SERIES_4x8, { scale: WIND_SCALE, windGlyph: "arrow" });
    expect(def.querySelectorAll("g.mw-wth-arrow")).toHaveLength(29);
    expect(explicit.querySelectorAll("g.mw-wth-arrow")).toHaveLength(29);
    for (const root of [def, explicit]) {
      expect(root.querySelector(".mw-wth-barb")).toBeNull();
      expect(root.querySelector(".mw-wth-glyphnote")).toBeNull(); // 说明行只在 barb 模式画
    }
  });

  it("barb 模式：每格一枚完整风羽——杆数＝arrow 模式箭头数、已知格的旗/划计数与刻度一致", () => {
    const barb = windTimeHeight(SERIES_4x8, {
      scale: WIND_SCALE,
      windGlyph: "barb",
      barbScale: BARB_SCALES,
    });
    const staffs = barb.querySelectorAll("line.mw-wth-barb-staff");
    expect(staffs).toHaveLength(29); // 与 arrow 模式同 29 个有向格（缺测/无向格不出）
    expect(barb.querySelectorAll("g.mw-wth-arrow")).toHaveLength(0);
    // 500 hPa 15Z（speed 0、direction null）→ 圆圈静风符号；700 hPa 09Z（16 m/s、无向）→ 无标记
    expect(barb.querySelectorAll("circle.mw-wth-barb-calm")).toHaveLength(1);
    // 500 hPa 行（ri 1）12Z…取 ci 3（31 m/s、来向 305）：m/s 档（20/4/2）＝1 旗 2 长 1 短
    const cell = barbCell(barb, 1, 3);
    expect(cell.querySelectorAll("polygon.mw-wth-barb-pennant")).toHaveLength(1);
    expect(cell.querySelectorAll("line.mw-wth-barb-long")).toHaveLength(2);
    expect(cell.querySelectorAll("line.mw-wth-barb-short")).toHaveLength(1);
    // 300 hPa 00Z（ri 0、ci 0）：33 m/s → 1 旗 3 长 0 短（33−20＝13；13/4＝3 余 1 不足短划）
    const jet = barbCell(barb, 0, 0);
    expect(jet.querySelectorAll("polygon.mw-wth-barb-pennant")).toHaveLength(1);
    expect(jet.querySelectorAll("line.mw-wth-barb-long")).toHaveLength(3);
    expect(jet.querySelectorAll("line.mw-wth-barb-short")).toHaveLength(0);
  });

  it("barb 编码跟 unit 走：同一数字 20，m/s 档＝1 旗、kt 档＝2 长划（刻度单源流入、按档选用）", () => {
    const series: WindTimeHeightSeries = {
      times: ["a", "b"],
      levels: [
        {
          pressure: 500,
          cells: [
            { speed: 20, direction: 270 },
            { speed: 1, direction: 270 },
          ],
        },
        {
          pressure: 850,
          cells: [
            { speed: 3, direction: 180 },
            { speed: 3, direction: 180 },
          ],
        },
      ],
    };
    const ms = windTimeHeight(series, {
      scale: WIND_SCALE,
      windGlyph: "barb",
      barbScale: BARB_SCALES,
    });
    const msCell = barbCell(ms, 0, 0);
    expect(msCell.querySelectorAll("polygon.mw-wth-barb-pennant")).toHaveLength(1);
    const kt = windTimeHeight(series, {
      scale: WIND_SCALE,
      unit: "kt",
      windGlyph: "barb",
      barbScale: BARB_SCALES,
    });
    const ktCell = barbCell(kt, 0, 0);
    expect(ktCell.querySelectorAll("polygon.mw-wth-barb-pennant")).toHaveLength(0);
    expect(ktCell.querySelectorAll("line.mw-wth-barb-long")).toHaveLength(2);
  });

  it("静风格：低于静风阈画圆圈不画杆（缺省阈 1）；阈上无向格无任何标记", () => {
    const series: WindTimeHeightSeries = {
      times: ["a", "b"],
      levels: [
        {
          pressure: 500,
          cells: [
            { speed: 0.5, direction: null },
            { speed: 0.5, direction: 270 },
          ],
        },
        {
          pressure: 850,
          cells: [
            { speed: 2, direction: null },
            { speed: 2, direction: 270 },
          ],
        },
      ],
    };
    const barb = windTimeHeight(series, {
      scale: WIND_SCALE,
      windGlyph: "barb",
      barbScale: BARB_SCALES,
    });
    expect(barb.querySelectorAll("circle.mw-wth-barb-calm")).toHaveLength(2); // 500 行两格皆 <1
    expect(barb.querySelectorAll("line.mw-wth-barb-staff")).toHaveLength(1); // 仅 850/b 格有向且 ≥1
    // 静风阈显式传 0：0.5 不再判静风——有向格出杆、无向格无标记
    const zero = windTimeHeight(series, {
      scale: WIND_SCALE,
      windGlyph: "barb",
      barbScale: BARB_SCALES,
      barbCalmThreshold: 0,
    });
    expect(zero.querySelectorAll("circle.mw-wth-barb-calm")).toHaveLength(0);
    expect(zero.querySelectorAll("line.mw-wth-barb-staff")).toHaveLength(2);
  });

  it("缺测格在 barb 模式维持原形态（灰底斜纹、无任何风羽元素）", () => {
    const barb = windTimeHeight(SERIES_4x8, {
      scale: WIND_SCALE,
      windGlyph: "barb",
      barbScale: BARB_SCALES,
    });
    expect(barb.querySelectorAll("rect.mw-wth-cellmissing")).toHaveLength(1);
    expect(barb.querySelectorAll("line.mw-wth-slash")).toHaveLength(1);
    // 32 格收支：29 杆＋1 静风圈＋1 缺测＋1 无向无标（700/09Z）——缺测格不出任何风羽元素
    expect(
      barb.querySelectorAll("line.mw-wth-barb-staff").length +
        barb.querySelectorAll("circle.mw-wth-barb-calm").length,
    ).toBe(30);
  });

  it("风羽尺寸随格宽自适应降级：≥18 全要素、14 只剩旗＋长划、11 只剩杆；<10 显式抛错", () => {
    const series: WindTimeHeightSeries = {
      times: ["a", "b"],
      levels: [
        {
          pressure: 500,
          cells: [
            { speed: 7, direction: 270 },
            { speed: 7, direction: 270 },
          ],
        },
        {
          pressure: 850,
          cells: [
            { speed: 3, direction: 180 },
            { speed: 3, direction: 180 },
          ],
        },
      ],
    };
    const opts = {
      scale: WIND_SCALE,
      windGlyph: "barb",
      barbScale: BARB_SCALES,
    } as const;
    // 500 行两格 7 m/s（1 长 1 短）、850 行两格 3 m/s（0 长 1 短）
    const full = windTimeHeight(series, { ...opts }); // 缺省格宽 22 → full
    expect(full.querySelectorAll("line.mw-wth-barb-long")).toHaveLength(2);
    expect(full.querySelectorAll("line.mw-wth-barb-short")).toHaveLength(4);
    const mid = windTimeHeight(series, { ...opts, cellWidth: 14 }); // longs-only：短划掐掉
    expect(mid.querySelectorAll("line.mw-wth-barb-long")).toHaveLength(2);
    expect(mid.querySelectorAll("line.mw-wth-barb-short")).toHaveLength(0);
    const low = windTimeHeight(series, { ...opts, cellWidth: 11 }); // staff-only：只剩杆
    expect(low.querySelectorAll("line.mw-wth-barb-staff")).toHaveLength(4);
    expect(low.querySelectorAll("line.mw-wth-barb-long")).toHaveLength(0);
    expect(() => windTimeHeight(series, { ...opts, cellWidth: 9 })).toThrow(/cellWidth 非法/);
  });

  it("标记说明随模式切换：barb 模式画「风羽」说明行（不出现「箭头」字样）、en 走词表、arrow 缺省不画", () => {
    const barb = windTimeHeight(SERIES_4x8, {
      scale: WIND_SCALE,
      windGlyph: "barb",
      barbScale: BARB_SCALES,
    });
    const note = barb.querySelector(".mw-wth-glyphnote")?.textContent ?? "";
    expect(note).toContain("风羽");
    expect(note).not.toContain("箭头");
    expect(note).toContain("圆圈");
    const en = windTimeHeight(SERIES_4x8, {
      scale: WIND_SCALE,
      windGlyph: "barb",
      barbScale: BARB_SCALES,
      locale: "en",
    });
    expect(en.querySelector(".mw-wth-glyphnote")?.textContent).toContain("wind barb");
  });

  it("shaded:false 符号主导形态（行为锁）：色斑色块归零、内嵌色标不画、符号层与缺测形态全保留", () => {
    const bare = windTimeHeight(SERIES_4x8, { scale: WIND_SCALE, shaded: false });
    expect(bare.dataset.shaded).toBe("false");
    // 色斑色块归零：有风速的 31 格不再画 fill 色块（只剩缺测格的浅灰底一枚）
    expect(bare.querySelectorAll("rect:not(.mw-wth-cellmissing)")).toHaveLength(0);
    expect(bare.querySelectorAll("rect.mw-wth-cellmissing")).toHaveLength(1); // 缺测斜纹形态原样
    expect(bare.querySelectorAll("line.mw-wth-slash")).toHaveLength(1);
    // 符号层全保留：箭头 29 枚照画
    expect(bare.querySelectorAll("g.mw-wth-arrow")).toHaveLength(29);
    // 内嵌色标图例不画（无色斑＝色条无对应读法）；缺省 true 时在场（回归对照）
    expect(bare.querySelector(".mw-csl")).toBeNull();
    expect(
      windTimeHeight(SERIES_4x8, { scale: WIND_SCALE }).querySelector(".mw-csl"),
    ).not.toBeNull();
    // 显式 shaded:true 与缺省同构（缺省回归锁）
    expect(windTimeHeight(SERIES_4x8, { scale: WIND_SCALE, shaded: true }).dataset.shaded).toBe(
      "true",
    );
  });

  it("shaded:false 与 barb/静风组合：大格纯风羽形态（参照业务图）——杆/旗/划/静风圈照画、无色块", () => {
    const series: WindTimeHeightSeries = {
      times: ["a", "b"],
      levels: [
        {
          pressure: 500,
          cells: [
            { speed: 31, direction: 305 },
            { speed: 0, direction: null },
          ],
        },
        {
          pressure: 850,
          cells: [
            { speed: 4, direction: 180 },
            { speed: null, direction: null },
          ],
        },
      ],
    };
    const bare = windTimeHeight(series, {
      scale: WIND_SCALE,
      shaded: false,
      cellWidth: 52,
      windGlyph: "barb",
      barbScale: BARB_SCALES,
    });
    expect(bare.dataset.shaded).toBe("false");
    expect(bare.querySelectorAll("rect")).toHaveLength(1); // 仅缺测格浅灰底
    expect(bare.querySelectorAll("line.mw-wth-barb-staff")).toHaveLength(2); // 31 m/s 与 4 m/s 各一杆
    expect(bare.querySelectorAll("polygon.mw-wth-barb-pennant")).toHaveLength(1); // 31 m/s＝1 旗
    expect(bare.querySelectorAll("circle.mw-wth-barb-calm")).toHaveLength(1); // speed 0 → 静风圈
    // 52px 大格＝降级阶梯「全要素」档：短划在场（31＝1旗2长1短）
    expect(bare.querySelectorAll("line.mw-wth-barb-short")).toHaveLength(1);
    expect(bare.querySelector(".mw-wth-glyphnote")?.textContent).toContain("风羽");
  });

  it("shaded 非布尔显式抛错", () => {
    expect(() => windTimeHeight(SERIES_4x8, { scale: WIND_SCALE, shaded: "off" as never })).toThrow(
      /shaded 选项值须为布尔/,
    );
  });

  it("barb 模式防线：缺 barbScale／位权反了／缺当前量纲档显式抛错", () => {
    expect(() => windTimeHeight(SERIES_4x8, { scale: WIND_SCALE, windGlyph: "barb" })).toThrow(
      /windGlyph:"barb" 缺 barbScale/,
    );
    expect(() =>
      windTimeHeight(SERIES_4x8, {
        scale: WIND_SCALE,
        windGlyph: "barb",
        barbScale: {
          "m/s": { pennant: 2, long: 4, short: 20 }, // 位权反了
          kt: { pennant: 50, long: 10, short: 5 },
        },
      }),
    ).toThrow(/barbScale\.\w+\.位权反了|位权反了/);
    expect(() =>
      windTimeHeight(SERIES_4x8, {
        scale: WIND_SCALE,
        unit: "kt",
        windGlyph: "barb",
        barbScale: { "m/s": { pennant: 20, long: 4, short: 2 } }, // JS 调用方只传单键、缺 kt 档
      } as never),
    ).toThrow(/barbScale 缺 "kt" 档/);
    expect(() =>
      windTimeHeight(SERIES_4x8, { scale: WIND_SCALE, windGlyph: "feather" as never }),
    ).toThrow(/windGlyph 选项值 "feather" 不受支持/);
  });

  it("输入面防线：scale 必传、空色带、cells 不对齐、时刻/层数不足、值域、未知选项", () => {
    expect(() => windTimeHeight(SERIES_4x8, {} as never)).toThrow(/缺 scale 选项/);
    expect(() => windTimeHeight(SERIES_4x8, { scale: { breaks: [3], colors: [] } })).toThrow(
      /scale\.colors 为空/,
    );
    const misaligned: WindTimeHeightSeries = {
      times: ["a", "b", "c"],
      levels: [
        { pressure: 850, cells: [{ speed: 1 }, { speed: 2 }, { speed: 3 }] },
        { pressure: 500, cells: [{ speed: 1 }, { speed: 2 }] },
      ],
    };
    expect(() => windTimeHeight(misaligned, { scale: WIND_SCALE })).toThrow(
      /cells 长度 2 ≠ times 长度 3/,
    );
    expect(() =>
      windTimeHeight({ times: ["a"], levels: SERIES_4x8.levels }, { scale: WIND_SCALE }),
    ).toThrow(/时刻数不足（1 < 2）/);
    expect(() =>
      windTimeHeight(
        { times: ["a", "b"], levels: SERIES_4x8.levels.slice(0, 1) },
        { scale: WIND_SCALE },
      ),
    ).toThrow(/层数不足（1 < 2）/);
    expect(() => windTimeHeight(SERIES_4x8, { scale: WIND_SCALE, bad: 1 } as never)).toThrow(
      /未知选项 "bad"/,
    );
    const badSpeed: WindTimeHeightSeries = {
      times: ["a", "b"],
      levels: [
        { pressure: 500, cells: [{ speed: -3 }, { speed: 2 }] },
        { pressure: 850, cells: [{ speed: 1 }, { speed: 2 }] },
      ],
    };
    expect(() => windTimeHeight(badSpeed, { scale: WIND_SCALE })).toThrow(/speed 非法/);
    const badDir: WindTimeHeightSeries = {
      times: ["a", "b"],
      levels: [
        { pressure: 500, cells: [{ speed: 3, direction: 361 }, { speed: 2 }] },
        { pressure: 850, cells: [{ speed: 1 }, { speed: 2 }] },
      ],
    };
    expect(() => windTimeHeight(badDir, { scale: WIND_SCALE })).toThrow(/direction 非法/);
  });
});
