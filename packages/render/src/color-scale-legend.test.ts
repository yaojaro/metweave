// @vitest-environment happy-dom
/**
 * renderColorScaleLegend 可测面：两种形态的结构契约（分格档界刻度/渐变线性刻度）、
 * 可选件（标题/单位/末档注记/自定义格式化）缺席不画、输入面防线（空色带/未知选项键）、
 * 自足样式只注入一次。像素级观感是浏览器面的验证对象，此处只锁 DOM 结构与刻度定位。
 */
import { describe, expect, it } from "vitest";
import { renderColorScaleLegend } from "./color-scale-legend";

/** 阈值档样例（10m 风的 3/5/10/15/20/30 七档同构缩小版）。 */
const windScale = { breaks: [3, 5, 10], colors: ["#9ec5e8", "#7fb56f", "#f2c94c", "#e06b4a"] };

const ticksOf = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(".mw-csl-tick"));

describe("renderColorScaleLegend（分级色标图例）", () => {
  it("分格缺省形态：每档一格硬色、界值标在格界、末缘外延「+」", () => {
    const root = renderColorScaleLegend(windScale);
    expect(root.tagName).toBe("FIGURE");
    const segs = Array.from(root.querySelectorAll<HTMLElement>(".mw-csl-seg"));
    expect(segs).toHaveLength(4); // 档数＝breaks+1，第几格即第几档（不等距不失真）
    expect(segs.map((s) => s.style.background)).toEqual(windScale.colors);
    const ticks = ticksOf(root);
    expect(ticks.map((t) => t.textContent)).toEqual(["3", "5", "10", "+"]);
    expect(ticks[3]?.style.left).toBe("100%");
    expect(ticks[3]?.classList.contains("mw-csl-last")).toBe(true);
  });

  it("firstEdgeLabel：物理下界（如风速 0）可选标注在首缘；缺省不画首刻度", () => {
    const withEdge = renderColorScaleLegend(windScale, { firstEdgeLabel: "0" });
    const ticks = ticksOf(withEdge);
    expect(ticks[0]?.textContent).toBe("0");
    expect(ticks[0]?.style.left).toBe("0%");
    expect(ticks[0]?.classList.contains("mw-csl-first")).toBe(true);
    expect(ticksOf(renderColorScaleLegend(windScale))).toHaveLength(4); // 无选项＝只有 3 界＋「+」
  });

  it("linear 形态：停靠色连续渐变、首末刻度恒锚两端", () => {
    const root = renderColorScaleLegend(windScale, { mode: "linear" });
    const bar = root.querySelector<HTMLElement>(".mw-csl-bar");
    expect(bar?.style.background).toContain("linear-gradient(90deg");
    for (const c of windScale.colors) expect(bar?.style.background).toContain(c);
    expect(root.querySelectorAll(".mw-csl-seg")).toHaveLength(0); // 渐变无分格
    const ticks = ticksOf(root);
    expect(ticks[0]?.style.left).toBe("0%");
    expect(ticks[0]?.classList.contains("mw-csl-first")).toBe(true);
    expect(ticks.at(-1)?.style.left).toBe("100%");
    expect(ticks.at(-1)?.classList.contains("mw-csl-last")).toBe(true);
  });

  it("linear 近值碰撞右让：相邻中位刻度最小间距 6%，位置单调不减", () => {
    const root = renderColorScaleLegend(
      { breaks: [1, 2, 3], colors: ["#0000ff", "#00ff00", "#ff0000", "#ffff00"] },
      { mode: "linear", tickValues: [0, 0.5, 1, 10] }, // 5% 与 10% 挤在左缘
    );
    const mids = ticksOf(root)
      .map((t) => Number.parseFloat(t.style.left))
      .filter((pct) => pct > 0 && pct < 100);
    expect(mids).toHaveLength(2);
    expect(mids[0] ?? -1).toBeGreaterThanOrEqual(6);
    expect(mids[1] ?? -1).toBeGreaterThanOrEqual((mids[0] ?? 0) + 6);
  });

  it("linear 停配色与刻度同轴对齐：停靠＝档数时各色停在档界的值轴位置（非等距断点换色点不失真）；多停靠维持等分", () => {
    // breaks [1,2,3]、4 色（缺省值轴 1..3）：换色点 0%/0%/50%/100%——刻度 2 的 50% 处恰为
    // [2,3) 档色的起点（此前等分停配色在 33.3%，与刻度系统性错位）
    const aligned = renderColorScaleLegend(
      { breaks: [1, 2, 3], colors: ["#0000ff", "#00ff00", "#ffff00", "#ff0000"] },
      { mode: "linear" },
    );
    const bg = aligned.querySelector<HTMLElement>(".mw-csl-bar")?.style.background ?? "";
    expect(bg).toContain("#00ff00 0.000%"); // 首界 1＝lo（<lo 档在值轴上无宽度）
    expect(bg).toContain("#ffff00 50.000%"); // 界 2 居值轴正中
    expect(bg).toContain("#ff0000 100.000%"); // 末界 3＝hi
    // 多停靠（5 色 3 档，渐变意图）：等分、无位置后缀
    const ramp = renderColorScaleLegend(
      { breaks: [1, 2, 3], colors: ["#0000ff", "#00ff00", "#ff0000", "#ffff00", "#ff00ff"] },
      { mode: "linear" },
    );
    const rampBg = ramp.querySelector<HTMLElement>(".mw-csl-bar")?.style.background ?? "";
    expect(rampBg).not.toContain("%");
  });

  it("可选件：title/firstEdgeLabel 外的注记（unit/topBinNote）与自定义格式化", () => {
    const root = renderColorScaleLegend(windScale, {
      title: "10m 风（m/s）",
      unit: "m/s",
      topBinNote: "≥10",
      formatValue: (v) => `${v} m/s`,
      className: "wf-legend-pos",
    });
    expect(root.querySelector(".mw-csl-title")?.textContent).toBe("10m 风（m/s）");
    expect(root.querySelector(".mw-csl-unit")?.textContent).toBe("m/s");
    expect(root.querySelector(".mw-csl-note")?.textContent).toBe("≥10");
    expect(ticksOf(root)[0]?.textContent).toBe("3 m/s");
    expect(root.className).toContain("mw-csl");
    expect(root.className).toContain("wf-legend-pos");
  });

  it("可选件缺席不画（title/unit/topBinNote 全缺 → 无标题无脚注行）", () => {
    const root = renderColorScaleLegend(windScale);
    expect(root.querySelector(".mw-csl-title")).toBeNull();
    expect(root.querySelector(".mw-csl-foot")).toBeNull();
  });

  it("缺省格式化：整数原样、非整数一位小数", () => {
    const root = renderColorScaleLegend(
      { breaks: [3.25, 5], colors: ["#111111", "#222222", "#333333"] },
      {},
    );
    expect(ticksOf(root).map((t) => t.textContent)).toEqual(["3.3", "5", "+"]);
  });

  it("输入面防线：空色带与未知选项键显式抛错", () => {
    expect(() => renderColorScaleLegend({ breaks: [3], colors: [] })).toThrow(/空色带/);
    expect(() => renderColorScaleLegend(windScale, { bad: 1 } as never)).toThrow(/未知选项 "bad"/);
  });

  it("分格前置：停靠色数≠档数的渐变色标显式报错（格与档会错位——应走 linear）", () => {
    const gradient = {
      breaks: [1, 2, 3],
      colors: ["#0000ff", "#00ff00", "#ff0000", "#ffff00", "#ff00ff"],
    };
    expect(() => renderColorScaleLegend(gradient, {})).toThrow(/colors 5 ≠ breaks＋1 4/);
    // linear 形态不受此限（渐变本就允许多停靠）
    expect(() => renderColorScaleLegend(gradient, { mode: "linear" })).not.toThrow();
  });

  it("自足样式只注入一次（多次渲染 head 里仅一份 style#…）", () => {
    renderColorScaleLegend(windScale);
    renderColorScaleLegend(windScale);
    const styles = Array.from(document.head.querySelectorAll("style")).filter(
      (s) => s.id === "metweave-colorscale-legend-style",
    );
    expect(styles).toHaveLength(1);
  });
});
