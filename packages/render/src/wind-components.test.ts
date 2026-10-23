// @vitest-environment happy-dom
/**
 * 风数值牌与风羽图例（0.3.2 T4/T6）：三态文案（有风/静风/缺测）、单位跟随报文不换算、
 * 未知选项与非法入参显式报错（不静默纪律）、图例的两套刻度由入参驱动（组件不含口径
 * 常量）、单位切换的 aria-pressed 与回调。
 */
import { describe, expect, it, vi } from "vitest";
import { parse } from "@metweave/parser";
import type { MetarReport } from "@metweave/core";
import { renderWindChip } from "./wind-chip";
import { renderWindLegend, type WindLegendUnit } from "./wind-legend";

const metar = (raw: string): MetarReport => parse(raw);

/** 两套口径的刻度（测试里手写；生产侧取自 @metweave/grid 的 WIND_BARB_SCALES）。 */
const UNITS: WindLegendUnit[] = [
  { id: "m/s", label: "m/s", pennant: 20, long: 4, short: 2 },
  { id: "kt", label: "kt", pennant: 50, long: 10, short: 5 },
];

describe("renderWindChip（风数值牌）", () => {
  it("有风三态之一：风向/风速/阵风三行，单位跟随报文不换算", () => {
    const chip = renderWindChip(metar("METAR ZUUU 211200Z 24005G12MPS 3000 BR SCT020 18/16 Q1013"));
    expect(chip.dataset.state).toBe("value");
    const rows = [...chip.querySelectorAll("dt")].map((d) => d.textContent);
    const values = [...chip.querySelectorAll("dd")].map((d) => d.textContent);
    expect(rows).toEqual(["风向", "风速", "阵风"]);
    expect(values[0]).toBe("240°");
    expect(values[1]).toBe("5 m/s"); // 报文单位 mps，原样显示（不折 kt）
    expect(values[2]).toBe("12 m/s");
  });

  it("无阵风则两行（阵风行缺席，不留空行）", () => {
    const chip = renderWindChip(metar("METAR ZUUU 211200Z 24005MPS 3000 BR SCT020 18/16 Q1013"));
    expect(chip.querySelectorAll("dt")).toHaveLength(2);
  });

  it("静风（00000）单行「静风」，state=calm（不显示 0° 0 m/s）", () => {
    const chip = renderWindChip(metar("METAR ZUUU 211200Z 00000MPS 3000 BR SCT020 18/16 Q1013"));
    expect(chip.dataset.state).toBe("calm");
    expect(chip.textContent).toContain("静风");
    expect(chip.querySelectorAll("dt")).toHaveLength(0);
  });

  it("缺测：显式 ///// → state=missing；整组省略 → state=omitted（文案同一条）", () => {
    const missing = renderWindChip(metar("METAR ZUUU 211200Z /////MPS 3000 BR SCT020 18/16 Q1013"));
    expect(missing.dataset.state).toBe("missing");
    expect(missing.textContent).toContain("风组缺测");
    const omitted = renderWindChip(metar("METAR ZUUU 211200Z 3000 BR SCT020 18/16 Q1013"));
    expect(omitted.dataset.state).toBe("omitted");
    expect(omitted.textContent).toContain("风组缺测");
  });

  it("VRB 风向显示「不定」，风速照出", () => {
    const chip = renderWindChip(metar("METAR ZUUU 211200Z VRB03MPS 3000 BR SCT020 18/16 Q1013"));
    expect([...chip.querySelectorAll("dd")].map((d) => d.textContent)[0]).toBe("不定");
  });

  it("en 文案与超上限前缀", () => {
    const chip = renderWindChip(metar("METAR ZUUU 211200Z 240P99MPS 3000 BR SCT020 18/16 Q1013"), {
      locale: "en",
    });
    const values = [...chip.querySelectorAll("dd")].map((d) => d.textContent);
    expect([...chip.querySelectorAll("dt")].map((d) => d.textContent)[0]).toBe("Direction");
    expect(values[1]).toBe(">99 m/s"); // en 册 mps 显示名直用 "m/s"
  });

  it("未知选项与非法 locale 显式抛错", () => {
    const report = metar("METAR ZUUU 211200Z 24005MPS 3000 BR SCT020 18/16 Q1013");
    expect(() => renderWindChip(report, { lang: "zh" } as never)).toThrow(/未知选项/);
    expect(() => renderWindChip(report, { locale: "jp" } as never)).toThrow(/不受支持/);
  });

  it("静风带阵风时阵风不吞（与 card.ts 同口径）", () => {
    const chip = renderWindChip(metar("METAR ZUUU 211200Z 00000G08MPS 3000 BR SCT020 18/16 Q1013"));
    expect(chip.dataset.state).toBe("calm");
    expect(chip.textContent).toContain("静风");
    expect(chip.textContent).toContain("阵风 8 m/s");
  });
});

describe("renderWindLegend（风羽图例）", () => {
  it("两套刻度由入参驱动：缺省第一套，点按钮切到第二套（数字与 aria-pressed 同步）", () => {
    const onChange = vi.fn();
    const legend = renderWindLegend({ units: UNITS, onUnitChange: onChange });
    const buttons = [...legend.querySelectorAll("button")];
    expect(buttons.map((b) => b.textContent)).toEqual(["m/s", "kt"]);
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("true");
    const marks = (): string[] =>
      [...legend.querySelectorAll("li")].map((li) => li.textContent ?? "");
    expect(marks()[0]).toContain("三角旗 20");
    expect(marks()[1]).toContain("长划 4");
    expect(marks()[2]).toContain("短划 2");
    // 切换
    buttons[1]?.click();
    expect(onChange).toHaveBeenCalledWith("kt");
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("true");
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("false");
    expect(marks()[0]).toContain("三角旗 50");
    expect(marks()[1]).toContain("长划 10");
    expect(marks()[2]).toContain("短划 5");
  });

  it("同口径重复点击不触发回调（幂等）", () => {
    const onChange = vi.fn();
    const legend = renderWindLegend({ units: UNITS, onUnitChange: onChange });
    const first = legend.querySelector("button");
    first?.click();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("初始口径可由 unit 指定", () => {
    const legend = renderWindLegend({ units: UNITS, unit: "kt" });
    expect(legend.querySelectorAll("button")[1]?.getAttribute("aria-pressed")).toBe("true");
    expect([...legend.querySelectorAll("li")].map((li) => li.textContent ?? "")[0]).toContain(
      "三角旗 50",
    );
  });

  it("三枚示意 glyph 各一个 svg，且 aria-hidden（读屏靠文字刻度）", () => {
    const legend = renderWindLegend({ units: UNITS });
    const svgs = [...legend.querySelectorAll("svg")];
    expect(svgs).toHaveLength(3);
    for (const svg of svgs) expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it("en 文案", () => {
    const legend = renderWindLegend({ units: UNITS, locale: "en" });
    expect(legend.textContent).toContain("Wind barb legend");
    expect(legend.textContent).toContain("Pennant");
  });

  it("校验：units 空／缺 id／非法刻度／位权反了／重复 id／unit 不在表里／未知选项", () => {
    expect(() => renderWindLegend({ units: [] })).toThrow(/units 为空/);
    expect(() =>
      renderWindLegend({ units: [{ id: "", label: "x", pennant: 20, long: 4, short: 2 }] }),
    ).toThrow(/缺 id\/label/);
    expect(() =>
      renderWindLegend({ units: [{ id: "kt", label: "kt", pennant: 0, long: 10, short: 5 }] }),
    ).toThrow(/pennant 非法/);
    expect(() =>
      renderWindLegend({ units: [{ id: "kt", label: "kt", pennant: 1, long: 10, short: 5 }] }),
    ).toThrow(/位权反了/);
    expect(() =>
      renderWindLegend({
        units: [
          { id: "kt", label: "kt", pennant: 50, long: 10, short: 5 },
          { id: "kt", label: "kt2", pennant: 20, long: 4, short: 2 },
        ],
      }),
    ).toThrow(/重复 id/);
    expect(() => renderWindLegend({ units: UNITS, unit: "mph" })).toThrow(/不在 units 里/);
    expect(() => renderWindLegend({ units: UNITS, theme: "dark" } as never)).toThrow(/未知选项/);
  });
});
