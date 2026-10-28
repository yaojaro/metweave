// @vitest-environment happy-dom
/**
 * gustBand（W-13 风速时序＋阵风标记）可测面：验收口径全量——平均风速折线＋包络带、
 * **阵风按事件独立标记（不连线不铺带）**、缺测时次断线（折线与带双断）、speed 缺而
 * gust 在的时次只画孤点、静风照画、输入面防线。y 映射由刻度公式复算锁。
 */
import { describe, expect, it } from "vitest";
import { gustBand } from "./gust-band";
import type { WindHourlySeries } from "./wind-profile";

/** 12 时次观测样例：中段一缺测时次、个别时次无阵风、末段 speed 缺而 gust 在。 */
const SERIES_12: WindHourlySeries = [
  { time: "00", speed: 3, gust: 6, direction: 220 },
  { time: "01", speed: 4, gust: 8, direction: 225 },
  { time: "02", speed: 5, gust: null, direction: 230 },
  { time: "03", speed: 6, gust: 11, direction: 235 },
  { time: "04", speed: null, gust: null, direction: 240 }, // 整时次缺测
  { time: "05", speed: 8, gust: 14, direction: 245 },
  { time: "06", speed: 9, gust: 16, direction: 250 },
  { time: "07", speed: 0, gust: null, direction: null }, // 静风时次
  { time: "08", speed: 7, gust: 13, direction: 245 },
  { time: "09", speed: null, gust: 18, direction: null }, // speed 缺而 gust 在
  { time: "10", speed: 5, gust: 9, direction: 235 },
  { time: "11", speed: 4, gust: 7, direction: 230 },
];

describe("gustBand（W-13 风速时序＋阵风标记）", () => {
  it("折线＋包络带：连续段各一条折线一枚带；缺测时次双断（04、09 两处断点三段）", () => {
    const root = gustBand(SERIES_12);
    expect(root.dataset.samples).toBe("12");
    const curves = root.querySelectorAll("polyline.mw-gb-curve");
    const bands = root.querySelectorAll("polygon.mw-gb-band");
    expect(curves).toHaveLength(3); // 00–03／05–08／10–11
    expect(bands).toHaveLength(3);
    const pts = [...curves].map((c) => (c.getAttribute("points") ?? "").split(" ").length);
    expect(pts).toEqual([4, 4, 2]);
  });

  it("阵风按事件标记：9 枚独立点（时次间不连线——阵风是事件性观测，连线＝编造）", () => {
    const root = gustBand(SERIES_12);
    const gusts = root.querySelectorAll("circle.mw-gb-gust");
    expect(gusts).toHaveLength(9); // 12 时次中 gust 在场的 9 个
    expect(root.dataset.gusts).toBe("9");
    // 不存在任何把阵风点连起来的线/带：阵风元素只有点与自平均点的竖茎
    const stems = root.querySelectorAll("line.mw-gb-stem");
    expect(stems).toHaveLength(8); // 09 时次 speed 缺 → 孤点无茎
  });

  it("y 映射锚：max＝18 → 刻度步 5、顶格 20；阵风点 y 由公式复算", () => {
    const root = gustBand(SERIES_12);
    // 纵轴刻度先于横轴时刻标签入 DOM：0..20 步 5（其后是 00/02/… 时刻标签）
    const ticks = [...root.querySelectorAll<SVGElement>(".mw-gb-ticktext")]
      .map((t) => t.textContent)
      .filter((t): t is string => t !== null);
    expect(ticks.slice(0, 5)).toEqual(["0", "5", "10", "15", "20"]);
    // 阵风点序＝gust 在场的时次序（00/01/03/05/06/08/09/10/11）：第 5 枚＝06 时次 gust 16
    const gust06 = [...root.querySelectorAll<SVGCircleElement>("circle.mw-gb-gust")][4];
    expect(Number(gust06?.getAttribute("cy"))).toBeCloseTo(52.4, 1); // 14 + (1−16/20)·192
  });

  it("speed 缺而 gust 在（09 时次）：孤点无竖茎（无从引茎）；静风时次（07）点在 0 线", () => {
    const root = gustBand(SERIES_12);
    // xOf(9) = 40 + 9/11 · (640−40−14)；gust 18 的孤点在该 x 上
    const x9 = 40 + (9 / 11) * (640 - 40 - 14);
    const orphan = [...root.querySelectorAll<SVGCircleElement>("circle.mw-gb-gust")].find(
      (c) => Math.abs(Number(c.getAttribute("cx")) - x9) < 0.05,
    );
    expect(orphan).toBeDefined();
    // 静风 07 在折线上：y ＝底(14+192=206)——0 风速贴基线
    const curvePts = root.querySelectorAll("polyline.mw-gb-curve")[1]?.getAttribute("points") ?? "";
    expect(curvePts).toContain("206.0");
  });

  it("量纲声明与图例：unit kt 只声明不换算；图例行两枚（平均风速线＋阵风点）", () => {
    const kt = gustBand(
      SERIES_12.map((s) => ({ ...s, speed: s.speed, gust: s.gust })),
      { unit: "kt", title: "逐时风", className: "hook" },
    );
    expect(kt.dataset.unit).toBe("kt");
    expect(kt.querySelector(".mw-gb-title")?.textContent).toBe("逐时风");
    expect(kt.className).toContain("hook");
    expect(kt.querySelectorAll(".mw-gb-note span")).toHaveLength(2);
    expect(gustBand(SERIES_12).querySelector(".mw-gb-title")).toBeNull();
  });

  it("孤立单点补点标记（P2-8 行为锁）：前后皆缺测的时次不再整时次消失", () => {
    const withSolo: WindHourlySeries = [
      { time: "00", speed: 3 },
      { time: "01", speed: 4 }, // 成段（00–01）
      { time: "02", speed: null }, // 缺测
      { time: "03", speed: 7 }, // 孤立单点（前后皆缺测）
      { time: "04", speed: null }, // 缺测
      { time: "05", speed: 5 },
      { time: "06", speed: 6 }, // 成段（05–06）
    ];
    const root = gustBand(withSolo);
    const solo = root.querySelectorAll("circle.mw-gb-solo");
    expect(solo).toHaveLength(1);
    expect(solo[0]?.querySelector("title")?.textContent).toBe("孤立时次风速");
    // 孤点坐标落在该时次的风速值上：x = 40 + 3/6·586、yMax 8 → y = 14 + (1−7/8)·192 = 38
    expect(Number(solo[0]?.getAttribute("cx"))).toBeCloseTo(40 + (3 / 6) * 586, 1);
    expect(Number(solo[0]?.getAttribute("cy"))).toBeCloseTo(38, 1);
    // 其余两段折线照常（孤点不进折线）
    expect(root.querySelectorAll("polyline.mw-gb-curve")).toHaveLength(2);
  });

  it("aria-label 走 locale 表（P2-6）＋svg 双尺寸属性（P2-9：width/height 齐备、与 viewBox 同值）", () => {
    const root = gustBand(SERIES_12);
    const svg = root.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-label")).toBe("风速时序与阵风标记");
    expect(svg?.getAttribute("width")).toBe(svg?.getAttribute("viewBox")?.split(" ")[2]);
    expect(svg?.getAttribute("height")).toBe(svg?.getAttribute("viewBox")?.split(" ")[3]);
    const en = gustBand(SERIES_12, { locale: "en" });
    expect(en.querySelector("svg")?.getAttribute("aria-label")).toBe("Wind speed and gust");
  });

  it("输入面防线：时次数不足、值域非法、未知选项显式抛错", () => {
    expect(() => gustBand(SERIES_12.slice(0, 1))).toThrow(/时次数不足（1 < 2）/);
    expect(() => gustBand([...SERIES_12.slice(0, 11), { time: "12", speed: -1 }])).toThrow(
      /speed 非法/,
    );
    expect(() => gustBand([...SERIES_12.slice(0, 11), { time: "12", gust: -5 }])).toThrow(
      /gust 非法/,
    );
    expect(() => gustBand([...SERIES_12.slice(0, 11), { time: "", speed: 3 }])).toThrow(
      /缺时刻标签/,
    );
    expect(() => gustBand(SERIES_12, { bad: 1 } as never)).toThrow(/未知选项 "bad"/);
    expect(() => gustBand(SERIES_12, { unit: "kmh" as never })).toThrow(/不受支持/);
  });
});
