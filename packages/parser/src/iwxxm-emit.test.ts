// IWXXM 序列化层测试（v0.3 遗留项 5）：IR→XML 生成出口——parseIwxxm 的逆过程。
//
// 三层验证面（合规口径见文件尾「Schematron 子集」组与 docs/iwxxm-notes.md §十.3）：
// ① 往返测试——官方等价对 .xml → parse → serialize → re-parse → IR deep-equal
//   （排除 raw/span/warnings，同语料双通道 34+7 对纪律；生成面无 span 概念——
//   re-parse 产出新鲜 span，比较口径天然排除）；
// ② 结构断言——生成 XML 对照官方样本的元素/命名空间/属性结构检查 + 快照锁定；
// ③ Schematron 子集——官方规则面 queryBinding="xslt2"（需 Saxon/Java，不做全量转译），
//   核心断言子集固化为测试（规则 id 与官方 iwxxm.sch 一一对应）。
//   XSD 全量验证（xmllint + 官方 XSD 树）在施工时点已全绿——依赖 76 文件 schema 树与网络抓取，
//   不入 CI 门禁，结论与复现口径记档于 docs/iwxxm-notes.md §十.3。
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { MetarReport, TafReport } from "@metweave/core";
import { parse, parseTaf } from "./index";
import { parseIwxxm, serializeIwxxm, type IwxxmReport } from "./iwxxm";

const corpusDir = fileURLToPath(new URL("../../../corpus/iwxxm/", import.meta.url));

/** 排除面（raw/span/warnings/cavokSpan）递归剥离后的可比形态——口径同 iwxxm-corpus.test.ts。 */
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

/** 源文档年月提取（往返的日历上下文——IR 无年月位，生成侧按调研报告难点 12 由外部注入）。 */
const calendarOfXml = (xml: string): { year: number; month: number } => {
  const m = /<gml:timePosition>(\d{4})-(\d{2})/.exec(xml);
  if (m === null) throw new Error("夹具缺 gml:timePosition——往返日历上下文无从提取");
  return { year: Number(m[1]), month: Number(m[2]) };
};

/** 观测/预报侧 IR 收窄（夹具错置即显式失败——与 iwxxm-corpus.test.ts 同款）。 */
const asMetar = (r: IwxxmReport): MetarReport => {
  if (r.kind === "taf") throw new Error("预期观测侧 IR，实得预报侧——夹具/调用错置");
  return r;
};
const asTaf = (r: IwxxmReport): TafReport => {
  if (r.kind !== "taf") throw new Error("预期预报侧 IR，实得观测侧——夹具/调用错置");
  return r;
};

/** 往返一轮：xml → parse → serialize → re-parse（返回两份可比 IR 与生成文本）。 */
function roundTrip(
  xml: string,
  version?: "2023-1" | "2025-2",
): {
  first: IwxxmReport;
  second: IwxxmReport;
  generated: string;
} {
  const first = parseIwxxm(xml);
  const generated = serializeIwxxm(first, { calendar: calendarOfXml(xml), version });
  const second = parseIwxxm(generated);
  return { first, second, generated };
}

const readDirXml = (dir: string): Array<{ stem: string; xml: string }> =>
  readdirSync(`${corpusDir}${dir}/`)
    .filter((f) => f.endsWith(".xml"))
    .map((file) => ({
      stem: file.replace(/\.xml$/, ""),
      xml: readFileSync(`${corpusDir}${dir}/${file}`, "utf8"),
    }));

// ---------------------------------------------------------------- ① 往返测试

describe("序列化往返：官方等价对（corpus/iwxxm/metar-pairs 34 站）", () => {
  const all = readDirXml("metar-pairs");

  it("逐站 xml→parse→serialize→re-parse IR deep-equal（排除 raw/span/warnings）", () => {
    const failures: string[] = [];
    for (const { stem, xml } of all) {
      try {
        const { first, second } = roundTrip(xml);
        expect(comparable(second)).toEqual(comparable(first));
      } catch {
        failures.push(stem);
      }
    }
    expect(failures, `往返不等站：${failures.join("、")}`).toHaveLength(0);
  });

  it("生成件命名空间与版本出口（2023-1 族 URI + schemaLocation 提示）", () => {
    for (const { stem, xml } of all) {
      const { generated } = roundTrip(xml);
      expect(generated, stem).toContain('xmlns:iwxxm="http://icao.int/iwxxm/2023-1"');
      expect(generated, stem).toContain(
        '"http://icao.int/iwxxm/2023-1 https://schemas.wmo.int/iwxxm/2023-1/iwxxm.xsd"',
      );
    }
  });

  it("nil 载体保真：CWFD rvr 缺测（nilReason missing）往返不丢三态", () => {
    const cwfd = all.find((p) => p.stem === "CWFD-290000Z");
    if (cwfd === undefined) throw new Error("夹具缺失: CWFD");
    const { first, second } = roundTrip(cwfd.xml);
    expect(asMetar(first).runwayVisualRange?.kind).toBe("missing");
    expect(asMetar(second).runwayVisualRange?.kind).toBe("missing");
  });
});

describe("序列化往返：TAF 官方等价对（corpus/iwxxm/taf-pairs 7 对，含 CNL/NIL）", () => {
  const all = readDirXml("taf-pairs");

  it("逐对 xml→parse→serialize→re-parse IR deep-equal（CNL EHLW / NIL DAOY 在列）", () => {
    const failures: string[] = [];
    for (const { stem, xml } of all) {
      try {
        const { first, second } = roundTrip(xml);
        expect(comparable(second)).toEqual(comparable(first));
      } catch {
        failures.push(stem);
      }
    }
    expect(failures, `往返不等对：${failures.join("、")}`).toHaveLength(0);
  });

  it("CNL 形态保真：EHLW 生成件带 isCancelReport + cancelledReportValidPeriod", () => {
    const ehlw = all.find((p) => p.stem === "EHLW-131400Z");
    if (ehlw === undefined) throw new Error("夹具缺失: EHLW");
    const { first, generated, second } = roundTrip(ehlw.xml);
    expect(generated).toContain('isCancelReport="true"');
    expect(generated).toContain("<iwxxm:cancelledReportValidPeriod>");
    expect(asTaf(first).cancelled).toBe(true);
    expect(asTaf(second).cancelled).toBe(true);
  });

  it("NIL 形态保真：DAOY 生成件为空载 baseForecast + nilReason missing（官方形同构）", () => {
    const daoy = all.find((p) => p.stem === "DAOY-131100Z");
    if (daoy === undefined) throw new Error("夹具缺失: DAOY");
    const { generated, second } = roundTrip(daoy.xml);
    expect(generated).toContain(
      '<iwxxm:baseForecast nilReason="http://codes.wmo.int/common/nil/missing"/>',
    );
    expect(asTaf(second).nil).toBe(true);
  });
});

describe("序列化往返：AWC 2025-2 实时流语料（corpus/iwxxm/awc）", () => {
  const all = readDirXml("awc");

  it("逐站 2025-2 出口往返 IR deep-equal（版本出口实证面）", () => {
    const failures: string[] = [];
    for (const { stem, xml } of all) {
      try {
        const { first, second, generated } = roundTrip(xml, "2025-2");
        expect(generated, stem).toContain('xmlns:iwxxm="http://icao.int/iwxxm/2025-2"');
        expect(comparable(second), stem).toEqual(comparable(first));
      } catch {
        failures.push(stem);
      }
    }
    expect(failures, `2025-2 往返不等站：${failures.join("、")}`).toHaveLength(0);
  });

  it("2025-2 出口不落跑道状态组（schema 已删该建模——如实不落）", () => {
    // 41 站 AWC 语料本就无跑道状态组（转换器不输出）——出口纪律以合成 IR 锁行为
    const generated = serializeIwxxm(
      {
        kind: "metar",
        raw: "",
        station: "ZBTJ",
        time: { day: 8, hour: 6, minute: 0 },
        flags: { auto: false, corrected: false },
        cavok: false,
        runwayStates: [{ runway: "06L", cleared: false, deposit: 5, coverage: 2, depth: 10 }],
        trends: [],
        remarks: [],
        warnings: [],
      },
      { calendar: { year: 2026, month: 10 }, version: "2025-2" },
    );
    expect(generated).not.toContain("runwayState");
    // 2023-1 出口同 IR 照落
    const as20231 = serializeIwxxm(
      {
        kind: "metar",
        raw: "",
        station: "ZBTJ",
        time: { day: 8, hour: 6, minute: 0 },
        flags: { auto: false, corrected: false },
        cavok: false,
        runwayStates: [{ runway: "06L", cleared: false, deposit: 5, coverage: 2, depth: 10 }],
        trends: [],
        remarks: [],
        warnings: [],
      },
      { calendar: { year: 2026, month: 10 } },
    );
    expect(as20231).toContain("<iwxxm:AerodromeRunwayState");
  });
});

// ---------------------------------------------------------------- ② 结构断言（对照官方样本）

describe("结构断言：ZSPD 官方对生成件逐位对照（元素/量纲/属性形态）", () => {
  const zspdXml = readFileSync(`${corpusDir}metar-pairs/ZSPD-290000Z.xml`, "utf8");

  it("值面结构：温露压/风/RVR 四条/云层/趋势与官方样本同构", () => {
    const { generated } = roundTrip(zspdXml);
    // 报头三件 + 最小机场快照
    expect(generated).toContain("<iwxxm:METAR ");
    expect(generated).toContain("<aixm:locationIndicatorICAO>ZSPD</aixm:locationIndicatorICAO>");
    expect(generated).toContain("<aixm:interpretation>SNAPSHOT</aixm:interpretation>");
    // 温露压（量纲精确串）
    expect(generated).toContain('<iwxxm:airTemperature uom="Cel">13</iwxxm:airTemperature>');
    expect(generated).toContain(
      '<iwxxm:dewpointTemperature uom="Cel">13</iwxxm:dewpointTemperature>',
    );
    expect(generated).toContain('<iwxxm:qnh uom="hPa">1018</iwxxm:qnh>');
    // 风（uom m/s + 变风方向布尔显式）
    expect(generated).toContain('<iwxxm:meanWindDirection uom="deg">130</iwxxm:meanWindDirection>');
    expect(generated).toContain('<iwxxm:meanWindSpeed uom="m/s">3</iwxxm:meanWindSpeed>');
    // RVR 四条：17L P2000（ABOVE+MISSING_VALUE→无趋势位？不——ZSPD 官方对 P2000 组带 MISSING_VALUE，
    // IR 无趋势位 → 生成件无 pastTendency——与官方样本的属性面差异如实锁：值+算子全同构）
    expect(generated).toContain('<iwxxm:meanRVR uom="m">2000</iwxxm:meanRVR>');
    expect(generated).toContain("<iwxxm:meanRVROperator>ABOVE</iwxxm:meanRVROperator>");
    expect(generated).toContain("<aixm:designator>17L</aixm:designator>");
    expect(generated).toContain('pastTendency="NO_CHANGE"');
    expect(generated).toContain('pastTendency="UPWARD"');
    // 云层：BKN002 → amount href + base 200 [ft_i]（英尺原值直传）
    expect(generated).toContain(
      'xlink:href="http://codes.wmo.int/49-2/CloudAmountReportedAtAerodrome/BKN"',
    );
    expect(generated).toContain('<iwxxm:base uom="[ft_i]">200</iwxxm:base>');
    // 趋势：BECMG TL0130 → changeIndicator BECOMING + UNTIL + TimePeriod end 01:30
    expect(generated).toContain('changeIndicator="BECOMING"');
    expect(generated).toContain("<iwxxm:timeIndicator>UNTIL</iwxxm:timeIndicator>");
    expect(generated).toMatch(/<gml:endPosition>2023-05-29T01:30:00Z<\/gml:endPosition>/);
    // 趋势天气/云
    expect(generated).toContain('xlink:href="http://codes.wmo.int/306/4678/BR"');
    expect(generated).toContain(
      'xlink:href="http://codes.wmo.int/49-2/CloudAmountReportedAtAerodrome/SCT"',
    );
  });

  it("快照锁定：ZSPD 生成件全文（确定性 gml:id——结构回归即红）", () => {
    const { generated } = roundTrip(zspdXml);
    expect(generated).toMatchSnapshot();
  });

  it("缺失组 nil 载体对照：CYEK 无温露压报文的 notObservable 形态与官方译文同构", () => {
    const cyek = readFileSync(`${corpusDir}metar-pairs/CYEK-290000Z.xml`, "utf8");
    const { generated, second, first } = roundTrip(cyek);
    if (first.kind === "taf" || first.temperature === undefined) {
      expect(generated).toMatch(
        /<iwxxm:airTemperature uom="N\/A" nilReason="http:\/\/codes\.wmo\.int\/common\/nil\/notObservable" xsi:nil="true"\/>/,
      );
    }
    expect(comparable(second)).toEqual(comparable(first));
  });
});

// ---------------------------------------------------------------- ② Schematron 子集（规则 id 对应官方 iwxxm.sch）

describe("Schematron 子集断言（官方规则面 xslt2 不做全量转译——核心规则固化，id 一一对应）", () => {
  const zspdXml = readFileSync(`${corpusDir}metar-pairs/ZSPD-290000Z.xml`, "utf8");
  const ekchXml = readFileSync(`${corpusDir}metar-pairs/EKCH-282350Z.xml`, "utf8");
  const sarpXml = readFileSync(`${corpusDir}taf-pairs/SARP-131100Z.xml`, "utf8");

  it("METAR_SPECI.MeteorologicalAerodromeObservation-1：CAVOK true 时 visibility/rvr/presentWeather/cloud 缺席", () => {
    const { generated } = roundTrip(ekchXml);
    const obs =
      /<iwxxm:MeteorologicalAerodromeObservation[\s\S]*<\/iwxxm:MeteorologicalAerodromeObservation>/.exec(
        generated,
      )?.[0];
    expect(obs).toBeDefined();
    const cavok = generated.includes('cloudAndVisibilityOK="true"');
    if (cavok && obs !== undefined) {
      expect(obs).not.toContain("<iwxxm:visibility");
      expect(obs).not.toContain("<iwxxm:rvr");
      expect(obs).not.toContain("<iwxxm:presentWeather");
      expect(obs).not.toContain("<iwxxm:cloud");
    }
  });

  it("METAR_SPECI.MeteorologicalAerodromeTrendForecast-1：趋势 CAVOK true 时 vis/weather/cloud 缺席", () => {
    // 合成矛盾形态锁行为：cavok 让位后 trend elements 不落三组
    const report = parseIwxxm(zspdXml);
    if (report.kind !== "taf") {
      const generated = serializeIwxxm(report, { calendar: calendarOfXml(zspdXml) });
      for (const trend of /<iwxxm:MeteorologicalAerodromeTrendForecast[\s\S]*?<\/iwxxm:MeteorologicalAerodromeTrendForecast>/g.exec(
        generated,
      ) ?? []) {
        if (trend.includes('cloudAndVisibilityOK="true"')) {
          expect(trend).not.toContain("prevailingVisibility");
          expect(trend).not.toContain("<iwxxm:weather");
          expect(trend).not.toContain("<iwxxm:cloud");
        }
      }
    }
  });

  it("TAF.MeteorologicalAerodromeForecast-1：TAF CAVOK true 时 prevailingVisibility/weather/cloud 缺席", () => {
    const { generated } = roundTrip(sarpXml);
    const base = /<iwxxm:baseForecast>[\s\S]*<\/iwxxm:baseForecast>/.exec(generated)?.[0];
    expect(base).toBeDefined();
    if (base !== undefined && base.includes('cloudAndVisibilityOK="true"')) {
      expect(base).not.toContain("prevailingVisibility");
      expect(base).not.toContain("<iwxxm:weather");
      expect(base).not.toContain("<iwxxm:cloud");
    }
  });

  it("METAR_SPECI.AerodromeRunwayVisualRange-1：meanRVR 恒以米报（uom=m）", () => {
    for (const { xml } of readDirXml("metar-pairs")) {
      const { generated } = roundTrip(xml);
      // \s 负先验防误中 meanRVROperator（算子元素无 uom）
      for (const m of generated.matchAll(/<iwxxm:meanRVR\s([^>]*)>/g)) {
        expect(m[1]).toContain('uom="m"');
      }
    }
  });

  it("METAR_SPECI.AerodromeRunwayState-2/-3：cleared 与沉积位互斥、allRunways 与 runway 互斥", () => {
    // 合成 IR 锁行为（官方对语料的跑道状态组无 cleared+沉积并存形态）
    const generated = serializeIwxxm(
      {
        kind: "metar",
        raw: "",
        station: "ZBTJ",
        time: { day: 8, hour: 6, minute: 0 },
        flags: { auto: false, corrected: false },
        cavok: false,
        runwayStates: [
          { runway: "07", cleared: true, frictionCoefficient: 0.62 },
          { runway: "88", cleared: false, deposit: 5 },
        ],
        trends: [],
        remarks: [],
        warnings: [],
      },
      { calendar: { year: 2026, month: 10 } },
    );
    const cleared =
      /<iwxxm:AerodromeRunwayState cleared="true"[^>]*>[\s\S]*?<\/iwxxm:AerodromeRunwayState>/.exec(
        generated,
      )?.[0];
    expect(cleared).toBeDefined();
    expect(cleared).not.toContain("depositType");
    expect(cleared).not.toContain("contamination");
    expect(cleared).not.toContain("depthOfDeposit");
    const allRunways =
      /<iwxxm:AerodromeRunwayState allRunways="true"[^>]*>[\s\S]*?<\/iwxxm:AerodromeRunwayState>/.exec(
        generated,
      )?.[0];
    expect(allRunways).toBeDefined();
    expect(allRunways).not.toContain("<iwxxm:runway");
  });

  it("SPECI 报头与 reportStatus 互斥面：SPECI 恒非 AMENDMENT（观测侧 IR 无 amended 位）", () => {
    for (const { xml } of readDirXml("metar-pairs")) {
      const { generated } = roundTrip(xml);
      if (generated.startsWith("<?xml") && generated.includes("<iwxxm:SPECI ")) {
        expect(generated).not.toContain('reportStatus="AMENDMENT"');
      }
    }
  });
});

// ---------------------------------------------------------------- ③ 错误面与 TAC 源 IR 出口

describe("错误面（code 沿既有稳定集——calendar 缺失不猜年月）", () => {
  const zspdXml = readFileSync(`${corpusDir}metar-pairs/ZSPD-290000Z.xml`, "utf8");

  it("calendar 缺失/非法 → MetarParseError(invalid-input)——IR 无年月位，不猜不默认", () => {
    const report = parseIwxxm(zspdXml);
    expect(() => serializeIwxxm(report)).toThrow(/calendar/);
    expect(() => serializeIwxxm(report, { calendar: { year: 2026, month: 13 } })).toThrow(
      /calendar/,
    );
    expect(() => serializeIwxxm(report, { calendar: { year: 2026.5, month: 10 } })).toThrow(
      /calendar/,
    );
    expect(() => serializeIwxxm(report, { calendar: { year: 2026, month: 10 } })).not.toThrow();
  });

  it("非 IR 形态输入 → MetarParseError(invalid-input)", () => {
    expect(() => serializeIwxxm("METAR ZSPD" as unknown as IwxxmReport)).toThrow(/IR/);
    expect(() => serializeIwxxm(null as unknown as IwxxmReport)).toThrow(/IR/);
  });

  it("TAF NIL 无 issueTime → invalid-input（XSD 必填，TAC 无时组 NIL 在 XML 无载体）", () => {
    expect(() =>
      serializeIwxxm(
        {
          kind: "taf",
          raw: "",
          station: "ZSAM",
          nil: true,
          flags: { amended: false, corrected: false },
          cavok: false,
          changes: [],
          temperatures: [],
          remarks: [],
          warnings: [],
        },
        { calendar: { year: 2026, month: 10 } },
      ),
    ).toThrow(/issueTime/);
  });
});

describe("TAC 源 IR 出口（有损面按 notes §十记档——单位折算与四码收敛的实证锁定）", () => {
  it("美制单位折算：P6SM/sm 与 inHg QNH 按固定系数折 m/hPa（回读 IR 单位恒 SI）", () => {
    const ir = parse("METAR ZBTJ 080600Z 26006KT P6SM FEW030 18/09 A3008");
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    const reParsed = parseIwxxm(generated);
    if (reParsed.kind === "taf") throw new Error("预期观测侧 IR");
    // P6SM = ≥6SM 上限编码 → 折 9656m + ABOVE（回读 exact=false、beyond=above——SM 原单位不保真）
    expect(reParsed.visibility?.kind).toBe("value");
    if (reParsed.visibility?.kind === "value") {
      expect(reParsed.visibility.value.unit).toBe("m");
      expect(reParsed.visibility.value.beyond).toBe("above");
    }
    // A3008 → 1018.6 hPa（A 组隐含小数点，30.08 × 33.8639 → 一位小数）
    expect(reParsed.altimeter?.unit).toBe("hPa");
    expect(reParsed.altimeter?.value).toBeCloseTo(1018.6, 1);
    // 生成件量纲面
    expect(generated).toContain('uom="[kn_i]">6<');
    expect(generated).toContain(
      "<iwxxm:prevailingVisibilityOperator>ABOVE</iwxxm:prevailingVisibilityOperator>",
    );
  });

  it("无云四码收敛：NSC 走 nilReason 承载、SKC 走云量位层形态（往返保真）；CLR 收敛 NCD（如实记损）", () => {
    const nsc = parse("METAR ZBTJ 080600Z 26006KT 9999 NSC 18/09 Q1015");
    const genNsc = serializeIwxxm(nsc, { calendar: { year: 2026, month: 10 } });
    // 观测侧 cloud nillable——合法空载形＝nilReason + xsi:nil（EFHK 官方形）
    expect(genNsc).toContain(
      '<iwxxm:cloud nilReason="http://codes.wmo.int/common/nil/nothingOfOperationalSignificance" xsi:nil="true"/>',
    );
    const skc = parse("METAR ZBTJ 080600Z 26006KT 9999 SKC 18/09 Q1015");
    const genSkc = serializeIwxxm(skc, { calendar: { year: 2026, month: 10 } });
    expect(genSkc).toContain(
      'xlink:href="http://codes.wmo.int/49-2/CloudAmountReportedAtAerodrome/SKC"',
    );
    expect(genSkc).toContain(
      '<iwxxm:base uom="N/A" xsi:nil="true" nilReason="http://codes.wmo.int/common/nil/inapplicable"/>',
    );
    // SKC 往返保真（层形态回读即 SKC）
    const reSkc = parseIwxxm(genSkc);
    if (reSkc.kind === "taf") throw new Error("预期观测侧 IR");
    expect(reSkc.clouds?.clear?.code).toBe("SKC");
    // CLR：49-2 无此词 → 收敛 notDetectedByAutoSystem（回读 NCD——文档面已记损）
    const clr = parse("METAR KSEA 080600Z 26006KT 9999 CLR 18/09 A3001");
    const genClr = serializeIwxxm(clr, { calendar: { year: 2026, month: 10 } });
    expect(genClr).toContain(
      '<iwxxm:cloud nilReason="http://codes.wmo.int/common/nil/notDetectedByAutoSystem" xsi:nil="true"/>',
    );
    const reClr = parseIwxxm(genClr);
    if (reClr.kind === "taf") throw new Error("预期观测侧 IR");
    expect(reClr.clouds?.clear?.code).toBe("NCD");
  });

  it("趋势段保真：BECMG TL0130 3000 BR SCT004 BKN020 生成件与官方 ZSPD 趋势同构", () => {
    const ir = parse(
      "METAR ZSPD 290000Z 13003MPS 0800 FG BKN002 13/13 Q1018 BECMG TL0130 3000 BR SCT004 BKN020",
    );
    const generated = serializeIwxxm(ir, { calendar: { year: 2023, month: 5 } });
    expect(generated).toContain('changeIndicator="BECOMING"');
    expect(generated).toContain("<iwxxm:timeIndicator>UNTIL</iwxxm:timeIndicator>");
    expect(generated).toMatch(/<gml:endPosition>2023-05-29T01:30:00Z<\/gml:endPosition>/);
    const reParsed = parseIwxxm(generated);
    if (reParsed.kind === "taf") throw new Error("预期观测侧 IR");
    expect(comparable(reParsed)).toEqual(comparable(ir));
  });

  it("NOSIG 载体：nil noSignificantChange 往返保真", () => {
    const ir = parse("METAR EDDH 282350Z 24010KT 9999 -RA BKN012 07/05 Q0989 NOSIG=");
    const generated = serializeIwxxm(ir, { calendar: { year: 2023, month: 5 } });
    expect(generated).toContain(
      '<iwxxm:trendForecast nilReason="http://codes.wmo.int/common/nil/noSignificantChange" xsi:nil="true"/>',
    );
    const reParsed = parseIwxxm(generated);
    if (reParsed.kind === "taf") throw new Error("预期观测侧 IR");
    expect(reParsed.trends[0]?.kind).toBe("nosig");
    expect(comparable(reParsed)).toEqual(comparable(ir));
  });

  it("TAC 侧 TAF 全要素：有效期/基况/变化组/温组往返（FM 日位取起日直投影）", () => {
    const ir = parseTaf(
      "TAF ZBAA 080511Z 0806/0912 19008MPS 6000 -SHRA BKN030 TX23/0807Z TN14/0821Z BECMG 0814/0816 22010G15MPS CAVOK=",
    );
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    const reParsed = parseIwxxm(generated);
    if (reParsed.kind !== "taf") throw new Error("预期预报侧 IR");
    expect(comparable(reParsed)).toEqual(comparable(ir));
    // 温组形态：一元素并载 TX/TN（官方 SARP 形同构）
    expect(generated).toContain("<iwxxm:AerodromeAirTemperatureForecast>");
    expect(generated).toContain(
      '<iwxxm:maximumAirTemperature uom="Cel">23</iwxxm:maximumAirTemperature>',
    );
    expect(generated).toContain(
      '<iwxxm:minimumAirTemperature uom="Cel">14</iwxxm:minimumAirTemperature>',
    );
  });

  it("NIL METAR 合成往返：observation xsi:nil 载体，最小形态不丢", () => {
    const ir = parse("METAR ZSAM 080600Z NIL");
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    expect(generated).toContain(
      '<iwxxm:observation nilReason="http://codes.wmo.int/common/nil/missing" xsi:nil="true"/>',
    );
    const reParsed = parseIwxxm(generated);
    if (reParsed.kind === "taf") throw new Error("预期观测侧 IR");
    expect(reParsed.nil).toBe(true);
    expect(comparable(reParsed)).toEqual(comparable(ir));
  });

  it("TAC 侧 CNL 往返：isCancelReport + cancelledReportValidPeriod，取消位/修订位/有效期全保真", () => {
    const ir = parseTaf("TAF AMD ZBAA 080511Z 0806/0912 CNL=");
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    expect(generated).toContain('isCancelReport="true"');
    expect(generated).toContain('reportStatus="AMENDMENT"');
    expect(generated).toContain("<iwxxm:cancelledReportValidPeriod>");
    const reParsed = parseIwxxm(generated);
    if (reParsed.kind !== "taf") throw new Error("预期预报侧 IR");
    expect(reParsed.cancelled).toBe(true);
    expect(comparable(reParsed)).toEqual(comparable(ir));
  });
});

// ---------------------------------------------------------------- ④ 紧凑模式与 SUBPATH 一致性

describe("选项面：spans:false 紧凑 IR 序列化与常规一致（生成面无 span 概念）", () => {
  it("紧凑模式 IR 生成件与常规模式逐字节一致", () => {
    const xml = readFileSync(`${corpusDir}metar-pairs/ZSPD-290000Z.xml`, "utf8");
    const full = parseIwxxm(xml);
    const compact = parseIwxxm(xml, { spans: false });
    const options = { calendar: calendarOfXml(xml) };
    expect(serializeIwxxm(compact, options)).toBe(serializeIwxxm(full, options));
  });

  it("TAC 侧 parse 紧凑 IR 同样可序列化（与 TAC 主入口的 IR 契约同源）", () => {
    const compact = parse("METAR ZBTJ 080600Z 26006KT 9999 FEW030 18/09 Q1015", { spans: false });
    expect(() => serializeIwxxm(compact, { calendar: { year: 2026, month: 10 } })).not.toThrow();
  });
});

describe("TAC 主入口产出 IR 的序列化冒烟（parse → serializeIwxxm 跨入口契约）", () => {
  it("观测侧与预报侧 IR 均可生成（kind 位判别）", () => {
    const metar = parse("METAR ZBTJ 080600Z 26006KT 9999 FEW030 18/09 Q1015");
    expect(serializeIwxxm(metar, { calendar: { year: 2026, month: 10 } })).toContain(
      "<iwxxm:METAR ",
    );
    const speci = parse("SPECI ZBTJ 080615Z 30012G18KT 3000 TSRA BKN010CB 17/14 Q1012");
    expect(serializeIwxxm(speci, { calendar: { year: 2026, month: 10 } })).toContain(
      "<iwxxm:SPECI ",
    );
    const taf = parseTaf("TAF ZBAA 080511Z 0806/0912 19008MPS 6000 BKN030=");
    expect(serializeIwxxm(taf, { calendar: { year: 2026, month: 10 } })).toContain("<iwxxm:TAF ");
  });
});
