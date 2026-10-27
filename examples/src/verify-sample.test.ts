// @vitest-environment happy-dom
/**
 * 验收台合成场的**数据面**自检（verify-main.ts 是「import 即挂载」的脚本，不能直接测；
 * 合成场单独成模块就是为了这条能在 node 里跑）。
 *
 * 起因：验收台上 T5 显示「0 根」，而页面判定只看了「稀疏 < 稠密」——0 < 0 也成立时
 * 判据会假绿。合成场必须先在数据面钉死「确实出杆、且密度随 step 变」。
 */
import { describe, expect, it } from "vitest";
import { streamlinesOf, windBarbsOf, windBarbStepAt } from "@metweave/grid";
import { DENSITY_BARBS, sampleWindPair, swirlWindPair } from "./verify-sample";

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

describe("verify 涡旋合成场（V1 流线面板的数据面）", () => {
  it("涡旋场本身成立：中心静风、外围成风、全场有 v 分量（非平直流）", () => {
    const { u, v } = swirlWindPair();
    // 中心格（109.5°E 落在 col 14/15 之间、36.5°N 落在 row 11/12 之间）附近速度最小
    const speedAt = (col: number, row: number): number =>
      Math.hypot(u.values[row * 30 + col] ?? Number.NaN, v.values[row * 30 + col] ?? Number.NaN);
    expect(speedAt(14, 11)).toBeLessThan(2); // 中心附近 <2 m/s
    expect(speedAt(29, 23)).toBeGreaterThan(15); // 东南角外围成风
    const hasV = [...v.values].some((vv) => Math.abs(vv) > 0.5);
    expect(hasV).toBe(true); // 涡旋必有南北分量（对照：sampleWindPair 全场 v=0）
  });

  it("出线：疏/中/密三档都出流线，且种子间隔变小线数变多、全部点在场界内", () => {
    const { u, v } = swirlWindPair();
    const draw = (seedSpacing: number) =>
      streamlinesOf(u, v, { seedSpacing, maxSteps: 400, step: 0.5 });
    const sparse = draw(10);
    const mid = draw(5);
    const dense = draw(3);
    expect(sparse.length).toBeGreaterThan(0);
    expect(mid.length).toBeGreaterThan(sparse.length);
    expect(dense.length).toBeGreaterThan(mid.length);
    for (const line of dense) {
      expect(line.points.length).toBeGreaterThanOrEqual(2);
      for (const p of line.points) {
        expect(p.lat).toBeGreaterThanOrEqual(25);
        expect(p.lat).toBeLessThanOrEqual(48);
        expect(p.lon).toBeGreaterThanOrEqual(95);
        expect(p.lon).toBeLessThanOrEqual(124);
      }
    }
  });

  it("静风核不出线：涡旋中心 0.8° 邻域内没有任何流线点", () => {
    const { u, v } = swirlWindPair();
    const lines = streamlinesOf(u, v, { seedSpacing: 3, maxSteps: 400, step: 0.5 });
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      for (const p of line.points) {
        const r = Math.hypot(p.lon - 109.5, p.lat - 36.5);
        expect(r).toBeGreaterThan(0.8);
      }
    }
  });
});
