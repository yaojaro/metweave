// @vitest-environment happy-dom
/**
 * wind-barb-glyph（W-12 barb 模式的几何内核）可测面：计数算术与 grid `windBarbOf`
 * 同式（对**调用方传入的刻度**求值——档位常数单源在 grid，此处锁算术不锁常数）、
 * 降级阶梯边界（18/12/10 的显式定义）、静风符号、杆的来向旋转。计数经构建出的
 * glyph DOM 图元类名读出（内部函数不经公开面）。
 */
import { describe, expect, it } from "vitest";
import { barbGlyphEl, barbGlyphLevelOf, calmGlyphEl } from "./wind-barb-glyph";
import type { WindBarbScaleInput } from "./wind-profile";

/** 刻度样例（数值形态对齐 grid 的 WIND_BARB_SCALES，测试自备——不在 render 复制产线常数）。 */
const MS_SCALE = { pennant: 20, long: 4, short: 2 } as const;
const KT_SCALE = { pennant: 50, long: 10, short: 5 } as const;

/** 一枚 glyph 里各图元的计数（旗=polygon、长划/短划/杆=line 按类名分桶）。 */
const partsOf = (glyph: SVGGElement): { p: number; l: number; s: number; staff: number } => ({
  p: glyph.querySelectorAll("polygon.mw-wth-barb-pennant").length,
  l: glyph.querySelectorAll("line.mw-wth-barb-long").length,
  s: glyph.querySelectorAll("line.mw-wth-barb-short").length,
  staff: glyph.querySelectorAll("line.mw-wth-barb-staff").length,
});

const glyphOf = (speed: number, scale: WindBarbScaleInput) =>
  barbGlyphEl({ direction: 270, speed, scale, level: "full", size: 16 });

describe("wind-barb-glyph（风羽几何内核）", () => {
  it("计数与 windBarbOf 同式（贪心分解、短划至多一枚）：38 m/s＝1 旗 4 长 1 短", () => {
    expect(partsOf(glyphOf(38, MS_SCALE))).toEqual({ p: 1, l: 4, s: 1, staff: 1 });
    // 短划容差（同 windBarbOf 的 1e-6）：余数距一短划差不足 1e-6 仍计短划
    expect(partsOf(glyphOf(5.9999999, MS_SCALE)).s).toBe(1);
    expect(partsOf(glyphOf(5.9, MS_SCALE)).s).toBe(0);
  });

  it("两套刻度同构异数：50 kt＝1 旗；45 kt＝0 旗 4 长 1 短；20 m/s＝1 旗（同数字不同档）", () => {
    expect(partsOf(glyphOf(50, KT_SCALE))).toEqual({ p: 1, l: 0, s: 0, staff: 1 });
    expect(partsOf(glyphOf(45, KT_SCALE))).toEqual({ p: 0, l: 4, s: 1, staff: 1 });
    expect(partsOf(glyphOf(20, MS_SCALE)).p).toBe(1);
    expect(partsOf(glyphOf(20, KT_SCALE)).l).toBe(2); // 20 kt＝2 长划——档随刻度走
  });

  it("杆指来向：direction 进 rotate（270° 西风→杆指西），羽在杆 x＞0 侧（北半球惯例）", () => {
    const glyph = glyphOf(12, MS_SCALE);
    expect(glyph.getAttribute("transform")).toBe("rotate(270)");
    const staff = glyph.querySelector("line.mw-wth-barb-staff");
    expect(staff?.getAttribute("x1")).toBe("0");
    const long = glyph.querySelector("line.mw-wth-barb-long");
    expect(Number(long?.getAttribute("x2"))).toBeGreaterThan(0); // 羽梢在杆右侧
  });

  it("降级阶梯边界（显式定义）：≥18 全要素、12–17 旗＋长划无短划、10–11 只画杆", () => {
    expect(barbGlyphLevelOf(18)).toBe("full");
    expect(barbGlyphLevelOf(17.9)).toBe("longs-only");
    expect(barbGlyphLevelOf(12)).toBe("longs-only");
    expect(barbGlyphLevelOf(11.9)).toBe("staff-only");
    // 7 m/s＝1 长 1 短：full 有短划、longs-only 掐短划、staff-only 只剩杆
    const args = { direction: 0, speed: 7, scale: MS_SCALE, size: 16 } as const;
    expect(partsOf(barbGlyphEl({ ...args, level: "full" })).s).toBe(1);
    expect(partsOf(barbGlyphEl({ ...args, level: "longs-only" })).s).toBe(0);
    expect(partsOf(barbGlyphEl({ ...args, level: "longs-only" })).l).toBe(1);
    const staffOnly = barbGlyphEl({ ...args, level: "staff-only" });
    expect(partsOf(staffOnly)).toEqual({ p: 0, l: 0, s: 0, staff: 1 });
  });

  it("静风符号：圆圈（气象惯例——有观测无方向，不画杆）", () => {
    const calm = calmGlyphEl(16);
    expect(calm.tagName).toBe("circle");
    expect(calm.classList.contains("mw-wth-barb-calm")).toBe(true);
    expect(calm.getAttribute("r")).toBe("3.52"); // 0.22×16
  });
});
