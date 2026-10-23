// @vitest-environment happy-dom
/**
 * 验收台合成场的**数据面**自检（verify-main.ts 是「import 即挂载」的脚本，不能直接测；
 * 合成场单独成模块就是为了这条能在 node 里跑）。
 *
 * 起因：验收台上 T5 显示「0 根」，而页面判定只看了「稀疏 < 稠密」——0 < 0 也成立时
 * 判据会假绿。合成场必须先在数据面钉死「确实出杆、且密度随 step 变」。
 */
import { describe, expect, it } from "vitest";
import { windBarbsOf, windBarbStepAt } from "@metweave/grid";
import { DENSITY_BARBS, sampleWindPair } from "./verify-sample";

const barbsAt = (step: number) => {
  const { u, v } = sampleWindPair();
  return windBarbsOf(u, v, { ...DENSITY_BARBS, step, lod: undefined });
};

describe("verify 合成场（七项验收台的数据面）", () => {
  it("出杆：最疏档也 ≥4 根，且 step 变小杆数变大", () => {
    const sparse = barbsAt(12);
    const mid = barbsAt(8);
    const dense = barbsAt(4);
    expect(sparse.length).toBeGreaterThanOrEqual(4);
    expect(mid.length).toBeGreaterThan(sparse.length);
    expect(dense.length).toBeGreaterThan(mid.length);
  });

  it("杆位落在网格范围内，方向＝来向 270°（全场西风 u>0、v=0）", () => {
    const barbs = barbsAt(12);
    for (const barb of barbs) {
      expect(barb.lat).toBeGreaterThanOrEqual(25);
      expect(barb.lat).toBeLessThanOrEqual(48);
      expect(barb.lon).toBeGreaterThanOrEqual(95);
      expect(barb.lon).toBeLessThanOrEqual(124);
    }
    // 西侧三列是静风区（u=0），其余点应为正西风
    const windy = barbs.filter((b) => b.lon >= 98);
    expect(windy.length).toBeGreaterThan(0);
    for (const barb of windy) expect(barb.direction).toBeCloseTo(270, 6);
  });

  it("LOD 阶梯：zoom 3/5/7/9 对应 step 12/8/4/2（放大更密）", () => {
    expect([3, 5, 7, 9].map((z) => windBarbStepAt(DENSITY_BARBS, z))).toEqual([12, 8, 4, 2]);
  });
});
