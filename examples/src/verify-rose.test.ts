// @vitest-environment happy-dom
/**
 * 验收台统计面板的数据面（0.7 统计批次固化断言）：IEM ZSPD 2024 公有领域逐时观测
 * （构建期从 CSV 派生的 JSON）喂给组件，披露行（样本/静风/缺向/缺速/入扇区）与
 * 构建期独立实算的期望账逐项全等——windRose 披露行数学的**实数据固化锚**（2024
 * 观测公开事实：静风 26、缺向 232、入扇区 8,502），不只靠快照眼验。
 */
import { describe, expect, it } from "vitest";
import { windDirFrequency, windRose } from "metweave";
import roseFile from "../zspd-rose-data.json";
import { LEDGER_KEYS, isZspdRoseData, toSamples } from "./zspd-rose-data";

if (!isZspdRoseData(roseFile))
  throw new Error("zspd-rose-data.json 形态不符（重跑 pnpm gen:zspd-rose 可再生）");
const DATA = roseFile;

describe("zspd-rose-data.json（IEM ZSPD 2024 实数据 × 组件账目）", () => {
  it("全年披露行与构建期实算逐项全等（实数据固化锚：静风 26 · 缺向 232 · 入扇区 8502）", () => {
    const samples = toSamples(DATA.months.flatMap((m) => m.samples));
    const rose = windRose(samples);
    const totals = DATA.expected.totals;
    for (const key of LEDGER_KEYS) {
      expect(rose.dataset[key]).toBe(String(totals[key]));
    }
    // 固化锚：与原始 CSV 逐行实算的公开事实（gen 脚本独立实算互证）
    expect(rose.dataset.samples).toBe("8760");
    expect(rose.dataset.calm).toBe("26");
    expect(rose.dataset.missingDirection).toBe("232");
    expect(rose.dataset.missingSpeed).toBe("0");
    expect(rose.dataset.inSector).toBe("8502");
    // 四桶恰一次划分：和恒等 n
    const n = Number(rose.dataset.samples);
    expect(
      Number(rose.dataset.calm) +
        Number(rose.dataset.missingDirection) +
        Number(rose.dataset.missingSpeed) +
        Number(rose.dataset.inSector),
    ).toBe(n);
    // 两组件同输入披露行逐字对拍（统计单源的机械保证）
    const freq = windDirFrequency(samples);
    for (const key of LEDGER_KEYS) {
      expect(freq.dataset[key]).toBe(rose.dataset[key]);
    }
  });

  it("逐月账与期望全等（12 月各自喂入、样本数对齐 gen 脚本逐月实算）", () => {
    for (const [i, m] of DATA.months.entries()) {
      const rose = windRose(toSamples(m.samples));
      const expected = DATA.expected.months[i];
      expect(expected).toBeDefined();
      for (const key of LEDGER_KEYS) {
        expect(rose.dataset[key]).toBe(String(expected?.[key]));
      }
    }
    // 十二宫格共尺：同一 radiusMax 下 12 张 rim 逐张相同（宿主侧对齐示范的数据面）
    const shared = 50;
    const panels = DATA.months.map((m) => windRose(toSamples(m.samples), { radiusMax: shared }));
    expect(new Set(panels.map((p) => p.dataset.rim))).toEqual(new Set([String(shared)]));
  });
});
