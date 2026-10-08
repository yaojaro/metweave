// @vitest-environment happy-dom
// IWXXM 演示页数据链测试（最小验收）：gen 产物（AWC 实时流）可装载、逐站两通道可解析、
// 对照区内嵌官方等价对两通道 IR deep-equal、双通道卡片可渲染。
// 浏览器交互（console 零错误/截图）属手工验收，见施工笔记；本文件锁数据面的机器可断言部分。
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse, parseIwxxm, renderCard, type MetarReport } from "metweave";

/** 观测侧收窄：本数据面恒为 METAR/SPECI（AWC metar 端点/官方 METAR 等价对——TAF IWXXM 是
 *  另一产品族，实况层/对照区不消费；kind 位判别）。 */
const asMetar = (r: ReturnType<typeof parseIwxxm>): MetarReport => {
  if (r.kind === "taf") throw new Error("预期 METAR/SPECI IR，实得 TAF IR——数据面错置");
  return r;
};

import dataFile from "../iwxxm-data.json";
import { altRawsOfIwxxm, tacOfIwxxmRaw } from "./iwxxm-alt-raw";
import { COMPARE_STATIONS, EMBEDDED } from "./iwxxm-samples";

interface StationRow {
  readonly icao: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly fetchSource: string;
  readonly tac: string;
  readonly xml: string;
}

/** 排除 raw/span/warnings 的可比形态（与 corpus 双通道测试同一口径）。 */
function comparable(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(comparable);
  if (typeof node === "object" && node !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "raw" || key === "span" || key === "cavokSpan" || key === "warnings") continue;
      out[key] = comparable(value);
    }
    return out;
  }
  return node;
}

describe("IWXXM 演示数据链（AWC 实时流产物）", () => {
  it("gen 产物在库且 ≥20 站（多站上图的下限），fetchSource 为 awc-live 或兜底 corpus-local", () => {
    const data = dataFile as { stations: StationRow[]; fetchSource: string };
    expect(data.stations.length).toBeGreaterThanOrEqual(20);
    expect(["awc-live", "corpus-local"]).toContain(data.fetchSource);
    for (const s of data.stations) expect(s.fetchSource, s.icao).toBe(data.fetchSource);
  });

  it("产物逐站：XML 与 TAC 都可解析、站名一致、坐标有界（渲染上图的机器验收）", () => {
    const data = dataFile as { stations: StationRow[] };
    for (const s of data.stations) {
      const xml = asMetar(parseIwxxm(s.xml));
      const tac = parse(s.tac);
      expect(xml.station, s.icao).toBe(tac.station);
      expect(Math.abs(s.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(s.lon)).toBeLessThanOrEqual(180);
    }
  });
});

describe("对照区内嵌官方等价对（2023-1 静态样例）", () => {
  it("三站齐备（ZSPD/EKCH/EETN），两通道 IR deep-equal（排除 raw/span/warnings）", () => {
    expect(EMBEDDED.map((s) => s.icao)).toEqual([...COMPARE_STATIONS]);
    for (const sample of EMBEDDED) {
      expect(comparable(parse(sample.tac)), sample.icao).toEqual(
        comparable(asMetar(parseIwxxm(sample.xml))),
      );
    }
  });

  it("两通道卡片都能渲染出 DOM", () => {
    for (const sample of EMBEDDED) {
      const tacCard = renderCard(parse(sample.tac), { raw: true });
      const xmlCard = renderCard(asMetar(parseIwxxm(sample.xml)), { raw: true });
      expect(tacCard.querySelector("h2 span")?.textContent).toBe(sample.icao);
      expect(xmlCard.querySelector("h2 span")?.textContent).toBe(sample.icao);
    }
  });

  // —— 第三期：对照区联动闭环的机器核验清单（三样本逐份过）——
  // 每份样本：XML 卡 RAW 视图存在按 span 高亮的 XML 片段（元素形态或 cavok 属性形态）；
  // 主表每个联动字段的提示键在 RAW 侧有对应高亮段（悬停字段 → XML 区间可点亮）。
  it("三样本核验清单：XML 卡 RAW 有 span 高亮段，主表字段键在 XML 侧有对应段（联动闭环）", () => {
    for (const sample of EMBEDDED) {
      const report = asMetar(parseIwxxm(sample.xml));
      const card = renderCard(report, { raw: true });
      const rawBox = card.querySelector(".mw-raw");
      if (rawBox === null) throw new Error(`${sample.icao}: RAW 视图缺席`);
      const rawPieces = [...rawBox.querySelectorAll<HTMLElement>("span[data-hint]")];
      // 基线：每份样本至少有风/温/压等基础片段
      expect(rawPieces.length, `${sample.icao}: XML 高亮段数`).toBeGreaterThanOrEqual(3);
      // 片段形态：XML 元素全体（"<" 开头）或 CAVOK 属性出现（EKCH 的 cavokSpan）——皆为 raw 的逐位切片
      for (const piece of rawPieces) {
        expect(piece.textContent ?? "", `${sample.icao}: 片段非源切片形态`).toMatch(
          /^(<|cloudAndVisibilityOK="true")/,
        );
        expect(sample.xml.includes(piece.textContent ?? ""), `${sample.icao}: 片段非原文子串`).toBe(
          true,
        );
      }
      // 主表侧联动字段（dd 内带提示的词）逐一在 RAW 侧找到同键段
      const mainKeys = [...card.querySelectorAll<HTMLElement>("dd span[data-hint]")].map(
        (n) => n.dataset.hint ?? "",
      );
      const rawKeys = new Set(rawPieces.map((n) => n.dataset.hint ?? ""));
      for (const key of mainKeys) {
        if (key === "") continue;
        expect(
          rawKeys.has(key),
          `${sample.icao}: 主表键在 XML 侧无高亮段（${key.slice(0, 24)}…）`,
        ).toBe(true);
      }
    }
  });
});

// —— 第四期：原文区双编码视图（AWC 内嵌源 TAC → altRaws）——
// 快照样本用 corpus 冻结语料（corpus/iwxxm/awc，41 站 2026-10-05 冻结；.tac 即 gen:iwxxm 按
// `<!--TAC: …-->` 注释抽取的同源产物）——测试不依赖网络与 gen 产物。
describe("原文区双编码视图（AWC 内嵌源 TAC → altRaws，corpus 冻结语料）", () => {
  // happy-dom 环境的全局 URL 不支持 file: 基准解析——改走 fileURLToPath(import.meta.url) 直取
  //（本文件路径）再 path.resolve 上溯，与 parser 语料测试同一落点
  const awcDir = `${path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../corpus/iwxxm/awc")}/`;
  const pairs = readdirSync(awcDir)
    .filter((f) => f.endsWith(".xml"))
    .map((f) => {
      const stem = f.replace(/\.xml$/, "");
      return {
        stem,
        tac: readFileSync(`${awcDir}${stem}.tac`, "utf8").trim(),
        xml: readFileSync(`${awcDir}${f}`, "utf8"),
      };
    });

  it("抽取与 gen 同源：全站 ir.raw 内抽出的源 TAC 与冻结 .tac 副本逐站相等", () => {
    expect(pairs.length).toBeGreaterThanOrEqual(20);
    for (const p of pairs) {
      expect(tacOfIwxxmRaw(asMetar(parseIwxxm(p.xml)).raw), p.stem).toBe(p.tac);
    }
  });

  it("降级路径：非 AWC 源（官方等价对 XML 无内嵌注释）抽不出 TAC → altRaws 空数组＝无 tab", () => {
    for (const sample of EMBEDDED) {
      expect(tacOfIwxxmRaw(sample.xml), sample.icao).toBeNull();
      const alts = altRawsOfIwxxm(asMetar(parseIwxxm(sample.xml)));
      expect(alts, sample.icao).toEqual([]);
      // 无 tab：单 XML 视图直出（不出现 tab 组）
      const card = renderCard(asMetar(parseIwxxm(sample.xml)), {
        raw: true,
        altRaws: altRawsOfIwxxm,
      });
      expect(card.querySelector(".mw-raw-tabs")).toBeNull();
      expect(card.querySelectorAll(".mw-raw").length).toBe(1);
    }
  });

  it("完整链（AWC 样本）：抽 TAC → parse 得 TAC IR → 弹窗卡双 tab，切换后 TAC 原文完整可见", () => {
    const sample = pairs[0]!;
    const report = asMetar(parseIwxxm(sample.xml));
    const alts = altRawsOfIwxxm(report);
    expect(alts.length).toBe(1);
    expect(alts[0]!.label).toBe("TAC（源电码）");
    expect(alts[0]!.report.station).toBe(report.station);
    expect(alts[0]!.report.raw).toBe(sample.tac);
    // 地图弹窗卡同款选项：raw + altRaws（与 iwxxm-main.ts addMetarLayer 的 card 透传一致）
    const card = renderCard(report, { raw: true, altRaws: altRawsOfIwxxm });
    const tabs = [...card.querySelectorAll<HTMLButtonElement>("button.mw-raw-tab")];
    expect(tabs.map((b) => b.textContent)).toEqual(["IWXXM（XML）", "TAC（源电码）"]);
    // 切到 TAC tab：TAC 面板可见且原文逐字保真（raw 保真契约在备选视图同样成立）
    tabs[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const panels = [...card.querySelectorAll<HTMLElement>(".mw-raw-panel")];
    expect(panels[1]?.hasAttribute("hidden")).toBe(false);
    expect(panels[1]?.textContent).toBe(sample.tac);
    expect(panels[0]?.hasAttribute("hidden")).toBe(true);
  });
});
