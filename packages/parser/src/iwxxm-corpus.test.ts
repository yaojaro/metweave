// IWXXM 语料双通道测试：官方等价对（wmo-im/iwxxm-translation Amd79-80-2023/metar，34 站 .tac+.xml）
// 逐站断言 parse(x.tac) ≡ parseIwxxm(x.xml)——两侧产出同一份 IR 是 v0.3「IWXXM→IR 解析」的核心验收。
//
// 比较口径（排除面写明理由，不属静默放水）：
// - raw 字段（report.raw 与 trend.raw）：TAC 侧是字符电码原文、XML 侧是 XML 原文/结构化重建串——
//   各源原文本就不同源，比较无意义；
// - 全部 span（含 cavokSpan）：第三期起 XML 侧同样携带 span（源元素/属性区间，见 iwxxm.ts），
//   但两通道的 span 各自索引本通道的 raw（TAC 词位 vs XML 区间）——数值面天然不同源，比较无意义；
// - warnings：两侧告警体系不同源（TAC 词法告警 vs XML 结构告警），语义不对齐，比较无意义。
// 结构性字段（station/time/flags/cavok/三态组/RVR 趋势与超限/天气切解/云层/温露/气压/趋势/跑道状态/
// 风切变）全量 deep-equal，不做选择性豁免。
//
// 两通道固有分歧站（配对困难样本，走单通道快照断言 + 逐站理由）：
// - CYEK：美制单位报文（M1/4SM / A2962）——官方译文把能见度折米（0.25SM→400m+BELOW）、气压折
//   hPa（A2962→1003.0hPa）；TAC 侧 IR 保留 sm/inHg 原单位（单位跟组走契约），数值必然不等；
// - BGTL / VTUO：同为美制 A 组气压（A3033→1027.1hPa、A2987→1011hPa），能见度侧已等价；
// - CWFD：官方译文补充了 rvr nil(missing) 元素（TAC 原文无 RVR 组）——组省略与显式缺测之别，
//   XML 侧如实落 {kind:'missing'}。
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { MetarReport, TafReport } from "@metweave/core";
import { parse, parseTaf } from "./index";
import { parseIwxxm, type IwxxmReport } from "./iwxxm";

const corpusDir = fileURLToPath(new URL("../../../corpus/iwxxm/", import.meta.url));

/** 观测侧收窄：metar-pairs 语料恒为 METAR/SPECI 根（TAF 根归 taf-pairs 专项组）。 */
const asMetar = (r: IwxxmReport): MetarReport => {
  if (r.kind === "taf") throw new Error("预期 METAR/SPECI IR，实得 TAF IR——夹具错置");
  return r;
};
const parseMetarIwxxm = (xml: string): MetarReport => asMetar(parseIwxxm(xml));
/** 预报侧收窄：taf-pairs/eccc 语料恒为 TAF 根。 */
const parseTafIwxxm = (xml: string): TafReport => {
  const r = parseIwxxm(xml);
  if (r.kind !== "taf") throw new Error("预期 TAF IR，实得观测侧 IR——夹具错置");
  return r;
};

/** 排除面（raw/span/warnings/cavokSpan）递归剥离后的可比形态——排除理由见文件头注释。 */
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

interface Pair {
  readonly stem: string;
  readonly tac: string;
  readonly xml: string;
}

const readPairs = (): Pair[] => {
  const dir = `${corpusDir}metar-pairs/`;
  const files = readdirSync(dir).filter((f) => f.endsWith(".xml"));
  return files.map((file) => {
    const stem = file.replace(/\.xml$/, "");
    return {
      stem,
      tac: readFileSync(`${dir}${stem}.tac`, "utf8").trim(),
      xml: readFileSync(`${dir}${file}`, "utf8"),
    };
  });
};

/** 两通道固有分歧站（见文件头逐站理由）——配对困难，走单通道快照。 */
const INHERENT_DIVERGENT = new Set([
  "CYEK-290000Z",
  "BGTL-290039Z",
  "VTUO-290000Z",
  "CWFD-290000Z",
]);

/** 递归收集 IR 里一切 span/cavokSpan 值（三态/数组/嵌套结构全覆盖）。 */
/** 递归收集 IR 里一切 span/cavokSpan 值（三态/数组/嵌套结构全覆盖）。 */
const collectSpans = (node: unknown, out: Array<{ start: number; end: number }>): void => {
  if (Array.isArray(node)) {
    for (const item of node) collectSpans(item, out);
    return;
  }
  if (typeof node === "object" && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      if (key === "span" || key === "cavokSpan") {
        const s = value as { start?: unknown; end?: unknown };
        if (typeof s.start === "number" && typeof s.end === "number")
          out.push({ start: s.start, end: s.end });
      } else collectSpans(value, out);
    }
  }
};

describe("IWXXM 官方等价对双通道（corpus/iwxxm/metar-pairs）", () => {
  const all = readPairs();
  const pairs = all.filter((p) => !INHERENT_DIVERGENT.has(p.stem));
  const divergent = all.filter((p) => INHERENT_DIVERGENT.has(p.stem));

  it("等价对齐备（.tac/.xml 成对；34 站全量入库）", () => {
    expect(all.length).toBe(34);
    expect(all.length - divergent.length).toBe(30);
  });

  it("逐站双通道 IR deep-equal（排除 raw/span/warnings——见文件头口径说明）", () => {
    const failures: string[] = [];
    for (const pair of pairs) {
      const tacSide = comparable(parse(pair.tac));
      const xmlSide = comparable(parseMetarIwxxm(pair.xml));
      try {
        expect(xmlSide).toEqual(tacSide);
      } catch {
        failures.push(pair.stem);
      }
    }
    expect(failures, `双通道不等价站：${failures.join("、")}`).toHaveLength(0);
  });

  it("TAC 侧全部可解析（官方对语料零整体失败——解析器回归基线）", () => {
    for (const pair of all) expect(() => parse(pair.tac), pair.stem).not.toThrow();
  });

  it("XML 侧全部可解析且站名一致（METAR/SPECI 根、ICAO 四字码）", () => {
    for (const pair of all) {
      const r = parseMetarIwxxm(pair.xml);
      expect(r.station, pair.stem).toMatch(/^[A-Z0-9]{4}$/);
      expect(parse(pair.tac).station, pair.stem).toBe(r.station);
    }
  });

  it("span 不变量（第三期）：全部在库 span 皆为 raw 的有效半开区间，且组级区间切片是 XML 元素形态", () => {
    for (const pair of all) {
      const r = parseMetarIwxxm(pair.xml);
      const spans: Array<{ start: number; end: number }> = [];
      collectSpans(r, spans);
      // NIL 报/无值报文可以零 span，但 34 站等价对全部带正文——至少应有温/压等基础区间
      expect(spans.length, pair.stem).toBeGreaterThan(0);
      for (const s of spans) {
        expect(s.start, pair.stem).toBeGreaterThanOrEqual(0);
        expect(s.end, pair.stem).toBeLessThanOrEqual(pair.xml.length);
        expect(s.end, pair.stem).toBeGreaterThan(s.start);
      }
      // 组级 span（Observed/趋势/云层元素自身）切片应为完整元素（开标签起）；
      // 属性区间（cavokSpan）与外包络（数组组级/扇区）不适用此断言——按已知组级键抽查
      const windSpan = r.wind?.span;
      if (windSpan !== undefined)
        expect(pair.xml.slice(windSpan.start, windSpan.start + 1), pair.stem).toBe("<");
      for (const tr of r.trends) {
        if (tr.span !== undefined)
          expect(pair.xml.slice(tr.span.start, tr.span.start + 1), pair.stem).toBe("<");
      }
    }
  });

  it("分歧站单通道快照：CYEK/BGTL/VTUO 美制单位（译文折 SI）、CWFD 译文补充 rvr 缺测", () => {
    const byStem = new Map(all.map((p) => [p.stem, p]));
    // 美制气压三站：TAC 侧 inHg 原单位、XML 侧官方译文 hPa 折算值（快照锁定具体折算值）
    const inHgStations: Array<[string, number]> = [
      ["CYEK-290000Z", 1003],
      ["BGTL-290039Z", 1027.1],
      ["VTUO-290000Z", 1011],
    ];
    for (const [stem, hpa] of inHgStations) {
      const pair = byStem.get(stem);
      if (pair === undefined) throw new Error(`夹具缺失: ${stem}`);
      const tac = parse(pair.tac);
      const xml = parseMetarIwxxm(pair.xml);
      expect(tac.station).toBe(xml.station);
      expect(tac.time).toEqual(xml.time);
      expect(tac.flags).toEqual(xml.flags);
      expect(tac.altimeter?.unit).toBe("inHg");
      expect(xml.altimeter?.unit).toBe("hPa");
      expect(xml.altimeter?.value).toBe(hpa);
    }
    // CYEK 能见度侧：TAC 0.25SM（below）vs 译文 400m（below）——两侧同为阈值形态
    const cyekPair = byStem.get("CYEK-290000Z");
    if (cyekPair === undefined) throw new Error("夹具缺失: CYEK");
    const cyekTac = parse(cyekPair.tac);
    const cyekXml = parseMetarIwxxm(cyekPair.xml);
    expect(cyekTac.visibility?.kind).toBe("value");
    expect(cyekXml.visibility?.kind).toBe("value");
    if (cyekTac.visibility?.kind === "value" && cyekXml.visibility?.kind === "value") {
      expect(cyekTac.visibility.value.unit).toBe("sm");
      expect(cyekTac.visibility.value.beyond).toBe("below");
      expect(cyekXml.visibility.value.unit).toBe("m");
      expect(cyekXml.visibility.value.value).toBe(400);
      expect(cyekXml.visibility.value.beyond).toBe("below");
    }
    // CWFD：XML 侧 rvr 显式缺测（译文补充），TAC 侧组省略——三态判别的活样例；
    // 第三期起缺测组带 span（nil 元素区间），一并锁定切片形态
    const cwfdPair = byStem.get("CWFD-290000Z");
    if (cwfdPair === undefined) throw new Error("夹具缺失: CWFD");
    expect(parse(cwfdPair.tac).runwayVisualRange).toBeUndefined();
    const cwfdRvr = parseMetarIwxxm(cwfdPair.xml).runwayVisualRange;
    expect(cwfdRvr?.kind).toBe("missing");
    if (cwfdRvr?.span !== undefined) {
      expect(cwfdPair.xml.slice(cwfdRvr.span.start, cwfdRvr.span.end)).toBe(
        '<iwxxm:rvr nilReason="http://codes.wmo.int/common/nil/missing" xsi:nil="true"/>',
      );
    }
  });
});

// —— TAF IWXXM（v0.3 遗留项 1，2026-10-08 施工）：官方等价对双通道 + ECCC 真实流。

/** 公报内拆分全部 iwxxm:TAF（ECCC 文件每份 TAF 元素自带 xmlns 声明——非贪婪配对即安全，
 *  与 scripts/gen-iwxxm.mjs 的 splitReports 同式同源）。span 收集复用文件上方 collectSpans。 */
const splitTafs = (raw: string): string[] =>
  [...raw.matchAll(/<iwxxm:TAF\b[\s\S]*?<\/iwxxm:TAF>/g)].map((m) => m[0]);

describe("TAF 官方等价对双通道（corpus/iwxxm/taf-pairs，wmo-im/iwxxm-translation Amd79-80-2023/taf）", () => {
  const dir = `${corpusDir}taf-pairs/`;
  const files = readdirSync(dir).filter((f) => f.endsWith(".xml"));
  const pairs = files.map((file) => {
    const stem = file.replace(/\.xml$/, "");
    return {
      stem,
      // 官方 .tac 首行是 WMO 公报头（FTXX99 …）——TAC 报文自身从 TAF 词起（剥词源同律）
      tac: readFileSync(`${dir}${stem}.tac`, "utf8").split("\n").slice(1).join("\n").trim(),
      xml: readFileSync(`${dir}${file}`, "utf8"),
    };
  });

  it("等价对齐备（官方 TAF 用例集 6 站 7 对：NIL/CNL/CAVOK/温组/AMD/COR/PROB30 TEMPO/NSC 全形态）", () => {
    expect(pairs.length).toBe(7);
  });

  it("TAC 侧全部可解析（parseTaf，官方对语料零整体失败）", () => {
    for (const pair of pairs) expect(() => parseTaf(pair.tac), pair.stem).not.toThrow();
  });
  it("XML 侧全部可解析且站名一致（TAF 根、ICAO 四字码）", () => {
    for (const pair of pairs) {
      const r = parseTafIwxxm(pair.xml);
      expect(r.station, pair.stem).toMatch(/^[A-Z0-9]{4}$/);
      expect(parseTaf(pair.tac).station, pair.stem).toBe(r.station);
    }
  });

  // 逐站双通道 deep-equal（排除 raw/span/warnings/cavokSpan——排除理由同 metar-pairs 文件头）：
  // 可全等站＝译文无加写的三站（SARP×2 与 NIL 报 DAOY）。
  // 固有分歧站（译文加写/归一化，与 METAR 侧 CYEK 族同纪律——单通道断言 + 逐站理由）：
  // - DAAV / MGGT：变化组内 TAC 未列能见度（＝沿承不重报），译文补写 prevailingVisibility
  //   10000m+ABOVE 显式位——IR 结构真相层「组内所列」口径下 XML 侧多出能见度组，结构性分歧；
  // - OIZC：同上（TEMPO 1312/1317 一组补写）；
  // - EHLW（CNL）：译文把被取消窗起点归一化为发报时刻（TAC 1309 起 vs XML 14:00 起——
  //   cancelledReportValidPeriod 语义按译文口径直读）。
  it("逐站双通道 IR deep-equal：SARP（CAVOK）×2 与 DAOY（NIL）三对全等（排除 raw/span/warnings）", () => {
    const equalStems = new Set(["DAOY-131100Z", "SARP-131100Z", "SARP-131251Z"]);
    const failures: string[] = [];
    for (const pair of pairs) {
      if (!equalStems.has(pair.stem)) continue;
      const tacSide = comparable(parseTaf(pair.tac));
      const xmlSide = comparable(parseTafIwxxm(pair.xml));
      try {
        expect(xmlSide).toEqual(tacSide);
      } catch {
        failures.push(pair.stem);
      }
    }
    expect(failures, `双通道不等价站：${failures.join("、")}`).toHaveLength(0);
  });

  it("固有分歧站：DAAV/MGGT/OIZC 译文补写变化组能见度、EHLW CNL 窗起点归一化（单通道逐点锁定）", () => {
    const byStem = new Map(pairs.map((p) => [p.stem, p]));
    // DAAV：官方用例主打形态（PROB30 TEMPO + TCU）——基况/时窗/云层两通道全等，分歧仅在变化组补写位
    const daav = byStem.get("DAAV-131700Z");
    if (daav === undefined) throw new Error("夹具缺失: DAAV");
    const daavTac = parseTaf(daav.tac);
    const daavXml = parseTafIwxxm(daav.xml);
    // 有效期两通道全等（1318/1418——直投影与 TAC 电码同值）
    expect(daavTac.validity).toMatchObject({
      startDay: 13,
      startHour: 18,
      endDay: 14,
      endHour: 18,
    });
    expect(daavXml.validity).toMatchObject({
      startDay: 13,
      startHour: 18,
      endDay: 14,
      endHour: 18,
    });
    expect(daavTac.changes.map((c) => c.kind)).toEqual(daavXml.changes.map((c) => c.kind));
    expect(daavXml.changes[0]?.elements?.clouds?.elements[0]).toMatchObject({
      kind: "layer",
      amount: "FEW",
      heightFt: { value: 2300 },
      convective: "TCU",
    });
    expect(daavTac.changes[0]?.elements?.clouds?.elements[0]).toMatchObject({
      kind: "layer",
      amount: "FEW",
      heightFt: { value: 2300 },
      convective: "TCU",
    });
    // TAC 组内未列能见度、XML 译文补写 10000+ABOVE——分歧点本身锁形态（9999 阈值收敛同观测侧）
    expect(daavTac.changes[0]?.elements?.visibility).toBeUndefined();
    expect(daavXml.changes[0]?.elements?.visibility).toMatchObject({
      value: 9999,
      beyond: "above",
    });

    // MGGT：COR 报 + TX/TN 温组——修正位与温组两通道全等（含时次），分歧同 DAAV（变化组补写）
    const mggt = byStem.get("MGGT-131141Z");
    if (mggt === undefined) throw new Error("夹具缺失: MGGT");
    const mggtTac = parseTaf(mggt.tac);
    const mggtXml = parseTafIwxxm(mggt.xml);
    expect(mggtTac.flags).toEqual({ amended: false, corrected: true });
    expect(mggtXml.flags).toEqual({ amended: false, corrected: true });
    expect(mggtTac.temperatures.map((t) => [t.extremum, t.celsius, t.at])).toEqual(
      mggtXml.temperatures.map((t) => [t.extremum, t.celsius, t.at]),
    );
    expect(mggtXml.temperatures[0]).toMatchObject({
      extremum: "max",
      celsius: 26,
      at: { day: 13, hour: 20 },
    });
    expect(mggtXml.temperatures[1]).toMatchObject({
      extremum: "min",
      celsius: 16,
      at: { day: 13, hour: 12 },
    });

    // OIZC：NSC（云 nilReason）与 m/s 风——基况段全等；TEMPO 1312/1317 补写位为唯一分歧
    const oizc = byStem.get("OIZC-131130Z");
    if (oizc === undefined) throw new Error("夹具缺失: OIZC");
    const oizcTac = parseTaf(oizc.tac);
    const oizcXml = parseTafIwxxm(oizc.xml);
    expect(comparable(oizcXml.wind)).toEqual(comparable(oizcTac.wind));
    expect(comparable(oizcXml.clouds)).toEqual(comparable(oizcTac.clouds));
    expect(oizcXml.changes[1]?.elements?.visibility).toMatchObject({ value: 7000, exact: true });
    expect(oizcXml.changes[1]?.elements?.clouds).toMatchObject({ clear: { code: "NSC" } });

    // EHLW：CNL——取消位与发报时组全等，被取消窗起点为译文归一化（TAC 09Z vs XML 14Z）
    const ehlw = byStem.get("EHLW-131400Z");
    if (ehlw === undefined) throw new Error("夹具缺失: EHLW");
    const ehlwTac = parseTaf(ehlw.tac);
    const ehlwXml = parseTafIwxxm(ehlw.xml);
    expect(ehlwTac.cancelled).toBe(true);
    expect(ehlwXml.cancelled).toBe(true);
    expect(ehlwTac.validity).toMatchObject({ startDay: 13, startHour: 9, endDay: 13, endHour: 21 });
    expect(ehlwXml.validity).toMatchObject({
      startDay: 13,
      startHour: 14,
      endDay: 13,
      endHour: 21,
    });
  });

  it("span 不变量（TAF 侧）：全部在库 span 皆为 raw 的有效半开区间，组级切片是 XML 元素形态", () => {
    for (const pair of pairs) {
      const r = parseTafIwxxm(pair.xml);
      const spans: Array<{ start: number; end: number }> = [];
      collectSpans(r, spans);
      for (const s of spans) {
        expect(s.start, pair.stem).toBeGreaterThanOrEqual(0);
        expect(s.end, pair.stem).toBeLessThanOrEqual(pair.xml.length);
        expect(s.end, pair.stem).toBeGreaterThan(s.start);
      }
      const vs = r.validity?.span;
      if (vs !== undefined) expect(pair.xml.slice(vs.start, vs.start + 1), pair.stem).toBe("<");
      for (const c of r.changes) {
        if (c.span !== undefined)
          expect(pair.xml.slice(c.span.start, c.span.start + 1), pair.stem).toBe("<");
      }
    }
  });
});

describe("ECCC 真实流样本（corpus/iwxxm/eccc，TAF IWXXM——遗留项 1 起真实解析）", () => {
  const dir = `${corpusDir}eccc/`;
  const files = readdirSync(dir).filter((f) => f.endsWith(".xml"));

  it("样本在库（两日实测取材：2026-10-05 基线两份 + 2026-10-08 多形态四份）", () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
  });

  it("collect 包裹 + iwxxm 3.0：尽力解析成功 + invalid-format(info) 版本出声（版本容错回归锁）", () => {
    for (const file of files) {
      const xml = readFileSync(`${dir}${file}`, "utf8");
      const r = parseTafIwxxm(xml);
      expect(r.station, file).toMatch(/^[A-Z0-9]{4}$/);
      expect(
        r.warnings.some((w) => w.code === "invalid-format" && w.message.includes("3.0")),
        file,
      ).toBe(true);
    }
  });

  it("公报内全部 TAF 可解析：站名/有效期/变化组 kind 值域（ FM/BECMG/TEMPO/PROB）全量过筛", () => {
    let total = 0;
    const kindsSeen = new Set<string>();
    for (const file of files) {
      const xml = readFileSync(`${dir}${file}`, "utf8");
      for (const doc of splitTafs(xml)) {
        total += 1;
        const r = parseTafIwxxm(doc);
        expect(r.station).toMatch(/^[A-Z0-9]{4}$/);
        expect(r.validity, r.station).toBeDefined();
        expect(r.issueTime).toBeDefined();
        for (const c of r.changes) kindsSeen.add(c.kind);
        // span 不变量（全量逐报）
        const spans: Array<{ start: number; end: number }> = [];
        collectSpans(r, spans);
        for (const s of spans) {
          expect(s.start).toBeGreaterThanOrEqual(0);
          expect(s.end).toBeLessThanOrEqual(doc.length);
        }
      }
    }
    expect(total).toBeGreaterThan(20);
    const kindsList = [...kindsSeen];
    kindsList.sort();
    expect(kindsList).toEqual(["BECMG", "FM", "PROB", "TEMPO"]);
  });

  it("CNL 真实流形态（20261008 LTCN23AAA：AMENDMENT + isCancelReport）→ cancelled 报解析落位", () => {
    const xml = readFileSync(`${dir}20261008-00Z-LTCN23AAA.xml`, "utf8");
    const cnl = splitTafs(xml)
      .map((doc) => parseTafIwxxm(doc))
      .find((r) => r.cancelled);
    expect(cnl).toBeDefined();
    expect(cnl?.station).toBe("CYCO");
    expect(cnl?.flags).toEqual({ amended: true, corrected: false });
    expect(cnl?.validity).toMatchObject({ startDay: 8, startHour: 2, endDay: 8, endHour: 13 });
    expect(cnl?.changes).toEqual([]);
  });

  it("ECCC SKC 云量位层形态（20261008 LTCN32）→ clear 电码收下", () => {
    const xml = readFileSync(`${dir}20261008-00Z-LTCN32.xml`, "utf8");
    const withSkc = splitTafs(xml)
      .map((doc) => parseTafIwxxm(doc))
      .find(
        (r) =>
          r.clouds?.clear !== undefined ||
          r.changes.some((c) => c.elements?.clouds?.clear !== undefined),
      );
    expect(withSkc).toBeDefined();
  });
});

describe("旧版官方样例（corpus/iwxxm/extras）", () => {
  it("iwxxm 2.1 OM 架构族 NIL 样例：明确整体失败（站点导航结构不同），不静默乱解", () => {
    const xml = readFileSync(`${corpusDir}extras/NIL-Amd77-2016.xml`, "utf8");
    expect(() => parseIwxxm(xml)).toThrow(/2\.1/);
  });
});
