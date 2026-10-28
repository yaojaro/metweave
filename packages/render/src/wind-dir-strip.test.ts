// @vitest-environment happy-dom
/**
 * windDirStrip（W-14 风向时序条）可测面：验收口径全量——**循环量的接缝处理**
 * （350°→10° 在色环上相邻＝同为红系相邻色相、线性色带会在北向断裂的假象不存在）、
 * 风向→HSL 色相映射公式、静风/缺测两态的专属形态、越界显式抛错（不静默归一——
 * 与 windBarbOf 的方向值域同口径）、罗盘图例与时刻标签。
 */
import { describe, expect, it } from "vitest";
import { windDirStrip } from "./wind-dir-strip";
import type { WindHourlySeries } from "./wind-profile";

/** 12 时次观测样例：跨北接缝（350→10）、静风时次、缺测时次、整圈扫过的收尾。 */
const SERIES_12: WindHourlySeries = [
  { time: "00", speed: 4, direction: 350 },
  { time: "01", speed: 5, direction: 355 },
  { time: "02", speed: 5, direction: 0 },
  { time: "03", speed: 6, direction: 5 },
  { time: "04", speed: 6, direction: 10 },
  { time: "05", speed: 7, direction: 90 },
  { time: "06", speed: 8, direction: 180 },
  { time: "07", speed: 0, direction: null }, // 静风：有观测无方向
  { time: "08", speed: 3, direction: null }, // 方向缺测（有风无向）
  { time: "09", speed: null, direction: null }, // 整时次缺测
  { time: "10", speed: 5, direction: 270 },
  { time: "11", speed: 5, direction: 360 }, // 360 ≡ 0 合法
];

/** 从内联 background 里取色相角（happy-dom 可能对颜色串做规范化——用正则容差）。 */
const hueOfCell = (cell: HTMLElement | undefined): number => {
  const m = /hsl\(\s*(\d+(?:\.\d+)?)/i.exec(cell?.style.background ?? "");
  return m === null ? -1 : Number(m[1]);
};

describe("windDirStrip（W-14 风向时序条）", () => {
  it("接缝核心：350°→10° 跨北相邻——色相角＝风向角，同族红系相邻（无断裂色）", () => {
    const root = windDirStrip(SERIES_12);
    const cells = [...root.querySelectorAll<HTMLElement>(".mw-wds-cell")];
    expect(cells).toHaveLength(12);
    // 色环映射：350 与 10 分别落在色相环的红系两侧——相邻不等于相同（循环量的正确形态）
    expect(hueOfCell(cells[0])).toBe(350);
    expect(hueOfCell(cells[4])).toBe(10);
    // 正交锚：0°（与 360° 同点）与 180°/90°/270° 各就各位
    expect(hueOfCell(cells[2])).toBe(0);
    expect(hueOfCell(cells[5])).toBe(90);
    expect(hueOfCell(cells[6])).toBe(180);
    expect(hueOfCell(cells[10])).toBe(270);
    expect(hueOfCell(cells[11])).toBe(0); // 360 ≡ 0 同色（循环量闭合）
  });

  it("色差单调性：00→04 五格从 350 爬到 10（环上步进逐格 ≈5°，无跨带跳变）", () => {
    const root = windDirStrip(SERIES_12);
    const cells = [...root.querySelectorAll<HTMLElement>(".mw-wds-cell")];
    const hues = [0, 1, 2, 3, 4].map((i) => hueOfCell(cells[i]));
    // 环上最短步进逐格 ≤5.5°：350→355→0→5→10（线性色带在此会 350→0 硬跳 350°）
    for (let i = 1; i < hues.length; i += 1) {
      const step = Math.abs((hues[i] ?? 0) - (hues[i - 1] ?? 0));
      const ringStep = Math.min(step, 360 - step);
      expect(ringStep).toBeLessThanOrEqual(5.5);
    }
  });

  it("静风与缺测两态：专属形态可辨（calm 灰底圆点、miss 斜纹），data-state 机读", () => {
    const root = windDirStrip(SERIES_12);
    const cells = [...root.querySelectorAll<HTMLElement>(".mw-wds-cell")];
    expect(cells[7]?.classList.contains("mw-wds-calm")).toBe(true);
    expect(cells[7]?.dataset.state).toBe("calm");
    expect(cells[8]?.classList.contains("mw-wds-miss")).toBe(true);
    expect(cells[8]?.dataset.state).toBe("missing");
    expect(cells[9]?.dataset.state).toBe("missing");
    // 有方向格带 data-dir 机读
    expect(cells[0]?.dataset.dir).toBe("350");
  });

  it("罗盘图例：八方位色片与条上同公式同色（北 0°＝红系），附静风/缺测图例与读法注", () => {
    const root = windDirStrip(SERIES_12);
    const chips = [
      ...root.querySelectorAll<HTMLElement>(
        ".mw-wds-chip:not(.mw-wds-chip-calm):not(.mw-wds-chip-miss)",
      ),
    ].filter((c) => c.tagName === "I");
    expect(chips).toHaveLength(8);
    expect(hueOfCell(chips[0])).toBe(0); // 北＝0°（红系）——与条上 0° 同色
    expect(hueOfCell(chips[4])).toBe(180); // 南
    const legend = root.querySelector(".mw-wds-legend")?.textContent ?? "";
    expect(legend).toContain("静风");
    expect(legend).toContain("缺测");
    expect(root.querySelector(".mw-wds-note")?.textContent).toContain("色环循环无缝");
  });

  it("时刻标签：最疏整间隔布列（12 时次 → 每 2 格一枚＋末格）", () => {
    const root = windDirStrip(SERIES_12);
    const labels = [...root.querySelectorAll<HTMLElement>(".mw-wds-label")].map(
      (l) => l.textContent,
    );
    expect(labels).toEqual(["00", "02", "04", "06", "08", "10", "11"]);
  });

  it("输入面防线：越界方向显式抛错（循环量的归一是供数方的事）、时次数、未知选项", () => {
    expect(() =>
      windDirStrip([...SERIES_12.slice(0, 11), { time: "12", speed: 3, direction: 361 }]),
    ).toThrow(/direction 非法/);
    expect(() =>
      windDirStrip([...SERIES_12.slice(0, 11), { time: "12", speed: 3, direction: -10 }]),
    ).toThrow(/direction 非法/);
    expect(() =>
      windDirStrip([...SERIES_12.slice(0, 11), { time: "12", speed: -1, direction: 10 }]),
    ).toThrow(/speed 非法/);
    expect(() => windDirStrip(SERIES_12.slice(0, 1))).toThrow(/时次数不足（1 < 2）/);
    expect(() => windDirStrip(SERIES_12, { bad: 1 } as never)).toThrow(/未知选项 "bad"/);
  });

  it("色带 aria-label 走 locale 表（P2-6 行为锁）：缺省中文、en 英文", () => {
    const zh = windDirStrip(SERIES_12);
    expect(zh.querySelector(".mw-wds-strip")?.getAttribute("aria-label")).toBe("风向时序条");
    const en = windDirStrip(SERIES_12, { locale: "en" });
    expect(en.querySelector(".mw-wds-strip")?.getAttribute("aria-label")).toBe(
      "Wind direction strip",
    );
  });

  it("可选件与 en 文案：title/className/locale（八方位走 N/NE/… 词表）", () => {
    const en = windDirStrip(SERIES_12, { locale: "en", title: "Direction", className: "hook" });
    expect(en.querySelector(".mw-wds-title")?.textContent).toBe("Direction");
    expect(en.className).toContain("hook");
    const legend = en.querySelector(".mw-wds-legend")?.textContent ?? "";
    expect(legend).toContain("Calm");
    expect(legend).toContain("Missing");
    const zh = windDirStrip(SERIES_12, { title: "风向" });
    expect(zh.querySelector(".mw-wds-legend")?.textContent).toContain("北");
  });
});
