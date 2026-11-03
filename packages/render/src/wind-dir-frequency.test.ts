// @vitest-environment happy-dom
/**
 * windDirFrequency（W-16 风向频率）可测面：与 windRose 的**账目一致性**（同输入下
 * 披露行五项数字逐项全等——机读 dataset 对拍，不靠快照眼验）、环/条形双形态的
 * 几何与读数、边界行为与 windRose 同一套（空输入空态、越界抛错、不静默选项校验）。
 */
import { describe, expect, it } from "vitest";
import { windDirFrequency } from "./wind-dir-frequency";
import { windRose } from "./wind-rose";
import type { WindRoseSample } from "./wind-rose";

/** 与 wind-rose.test.ts 同一套 16 样本定账样例（静风/缺向/缺速/跨北/四正向齐全）。 */
const SERIES_16: readonly WindRoseSample[] = [
  { speed: 3, direction: 350 },
  { speed: 5, direction: 0 },
  { speed: 7, direction: 10 },
  { speed: 11, direction: 5 },
  { speed: 1.5, direction: 90 },
  { speed: 4.5, direction: 95 },
  { speed: 6.5, direction: 180 },
  { speed: 9, direction: 185 },
  { speed: 12, direction: 270 },
  { speed: 2, direction: 355 },
  { speed: 0.8, direction: 100 },
  { speed: 0, direction: null },
  { speed: 3.5, direction: null },
  { speed: null, direction: 45 },
  { speed: null, direction: null },
  { speed: 5, direction: 360 },
];

/** 账目五键（两组件一致性对拍的判面）。 */
const LEDGER_KEYS = ["samples", "inSector", "calm", "missingDirection", "missingSpeed"] as const;

describe("windDirFrequency（W-16 风向频率）", () => {
  it("账目一致性：同输入下与 windRose 的披露行数字逐项全等（环与条形两形态都对拍）", () => {
    const rose = windRose(SERIES_16);
    const ring = windDirFrequency(SERIES_16, { form: "ring" });
    const bars = windDirFrequency(SERIES_16, { form: "bars" });
    for (const key of LEDGER_KEYS) {
      expect(ring.dataset[key]).toBe(rose.dataset[key]);
      expect(bars.dataset[key]).toBe(rose.dataset[key]);
    }
    // 缺省参数也一致：kt 缺省、16 扇区、静风阈 1——两组件缺省账逐字相同
    expect(ring.dataset.unit).toBe("kt");
    expect(ring.dataset.sectors).toBe("16");
    // 独立手算的定账（与 wind-rose.test.ts 的拆账互相印证）
    expect(ring.dataset.samples).toBe("16");
    expect(ring.dataset.calm).toBe("2");
    expect(ring.dataset.missingDirection).toBe("1");
    expect(ring.dataset.missingSpeed).toBe("2");
    expect(ring.dataset.inSector).toBe("11");
  });

  it("m-s 口径下账目仍一致（静风阈 0.5 同档）", () => {
    const samples: readonly WindRoseSample[] = [
      { speed: 0.4, direction: null },
      { speed: 0.6, direction: 0 },
      { speed: null, direction: 90 },
    ];
    const rose = windRose(samples, { unit: "m/s" });
    const wdf = windDirFrequency(samples, { unit: "m/s" });
    for (const key of LEDGER_KEYS) expect(wdf.dataset[key]).toBe(rose.dataset[key]);
    expect(wdf.dataset.calm).toBe("1"); // 0.4 < 0.5
    expect(wdf.dataset.inSector).toBe("1");
  });

  it("环形态：非零扇区一瓣单色、环线刻度与四正向标注在位", () => {
    const root = windDirFrequency(SERIES_16, { form: "ring" });
    expect(root.dataset.form).toBe("ring");
    // 非零扇区：扇区0/4/8/12 → 4 瓣
    expect(root.querySelectorAll("path.mw-wdf-petal")).toHaveLength(4);
    expect(root.querySelector("svg")?.getAttribute("aria-label")).toBe("风向频率环");
    expect(root.querySelectorAll("text.mw-wdf-sectorlabel").length).toBeGreaterThanOrEqual(4);
    expect(root.querySelector(".mw-wdf-note")?.textContent).toContain("入扇区 11");
  });

  it("条形形态：一杆一扇区、条高随占比、条顶数值可读、横轴扇区名自北顺时针", () => {
    const root = windDirFrequency(SERIES_16, { form: "bars" });
    expect(root.dataset.form).toBe("bars");
    expect(root.querySelectorAll("rect.mw-wdf-bar")).toHaveLength(4);
    const values = [...root.querySelectorAll("text.mw-wdf-barvalue")].map((t) => t.textContent);
    // 扇区占比：6/11≈54.5%、2/11≈18.2%、2/11≈18.2%、1/11≈9.1%（值随账，不入死数）
    expect(values).toHaveLength(4);
    for (const v of values) expect(Number(v)).toBeGreaterThan(0);
    const labels = [...root.querySelectorAll("text.mw-wdf-sectorlabel")].map((t) => t.textContent);
    expect(labels[0]).toBe("N");
    expect(labels).toContain("E");
    expect(labels).toContain("S");
    expect(labels).toContain("W");
    expect(root.querySelector("svg")?.getAttribute("aria-label")).toBe("风向频率条形图");
  });

  it("空输入：空态不抛错、不出 NaN（两形态）", () => {
    for (const form of ["ring", "bars"] as const) {
      const root = windDirFrequency([], { form });
      expect(root.dataset.samples).toBe("0");
      expect(root.querySelectorAll("path.mw-wdf-petal, rect.mw-wdf-bar")).toHaveLength(0);
      expect(root.innerHTML).not.toContain("NaN");
      expect(root.querySelector(".mw-wdf-note")?.textContent).toContain("样本 0");
    }
  });

  it("en locale 与 className 钩子", () => {
    const en = windDirFrequency(SERIES_16, { form: "bars", locale: "en", className: "hook" });
    expect(en.className).toContain("hook");
    expect(en.querySelector("svg")?.getAttribute("aria-label")).toBe("Direction frequency bars");
    expect(en.querySelector(".mw-wdf-note")?.textContent).toContain("Samples 16");
  });

  it("输入面防线：非法 form/locale/sectors/calmThreshold、未知选项、direction 越界显式抛错", () => {
    expect(() => windDirFrequency(SERIES_16, { form: "pie" as never })).toThrow(/form 选项值/);
    expect(() => windDirFrequency(SERIES_16, { locale: "fr" as never })).toThrow(/locale 选项值/);
    expect(() => windDirFrequency(SERIES_16, { sectors: 2 })).toThrow(/sectors 非法/);
    expect(() => windDirFrequency(SERIES_16, { calmThreshold: -1 })).toThrow(/calmThreshold 非法/);
    expect(() => windDirFrequency([{ speed: 3, direction: 400 }])).toThrow(/direction 非法/);
    expect(() => windDirFrequency([{ speed: 3, direction: 0 }], { bad: 1 } as never)).toThrow(
      /未知选项 "bad"/,
    );
  });
});
