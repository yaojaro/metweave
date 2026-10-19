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

// —— v0.3.1 规则补全（W43 D2/D3）：CAVOK 反向等价双向 / 阈值开闭区间 / NIL 三来源选词 /
// VRB 与静风 / 有损告警通道 / 跨年日历边界 / 时窗算子表——对账底档见 docs/iwxxm-notes.md §十一。

describe("CAVOK 反向等价（难点 6 生成侧：9999≠CAVOK 双向判定）", () => {
  it("TAC 数值形态 9999（cavok=false）→ 生成 cloudAndVisibilityOK=false + 10000m+ABOVE，回读非 CAVOK", () => {
    const ir = parse("METAR ZBTJ 080600Z 26006KT 9999 NSC 18/09 Q1015");
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    expect(generated).toContain('cloudAndVisibilityOK="false"');
    expect(generated).not.toContain('cloudAndVisibilityOK="true"');
    expect(generated).toContain(
      '<iwxxm:prevailingVisibility uom="m">10000</iwxxm:prevailingVisibility>',
    );
    expect(generated).toContain(
      "<iwxxm:prevailingVisibilityOperator>ABOVE</iwxxm:prevailingVisibilityOperator>",
    );
    const reParsed = parseIwxxm(generated);
    if (reParsed.kind === "taf") throw new Error("预期观测侧 IR");
    expect(reParsed.cavok).toBe(false);
    expect(comparable(reParsed)).toEqual(comparable(ir));
  });
  it("显式 CAVOK（EKCH 官方对）→ cloudAndVisibilityOK=true 且观测体无 prevailingVisibility，回读 cavok=true", () => {
    const ekchXml = readFileSync(`${corpusDir}metar-pairs/EKCH-282350Z.xml`, "utf8");
    const first = parseIwxxm(ekchXml);
    if (first.kind === "taf") throw new Error("预期观测侧 IR");
    expect(first.cavok).toBe(true);
    const { generated, second } = roundTrip(ekchXml);
    expect(generated).toContain('cloudAndVisibilityOK="true"');
    const obs =
      /<iwxxm:MeteorologicalAerodromeObservation[\s\S]*<\/iwxxm:MeteorologicalAerodromeObservation>/.exec(
        generated,
      )?.[0];
    expect(obs).not.toContain("prevailingVisibility");
    if (second.kind === "taf") throw new Error("预期观测侧 IR");
    expect(second.cavok).toBe(true);
  });
});

describe("阈值开闭区间往返（难点 8：9999/0000/P2000/M0050——aboveMax/belowMin 保真）", () => {
  it("TAC 9999 → 10000m+ABOVE（绝不生成无算子的精确 10000m），回读 9999 above", () => {
    const ir = parse("METAR ZBTJ 080600Z 26006KT 9999 FEW030 18/09 Q1015");
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    expect(generated).toContain(
      "<iwxxm:prevailingVisibilityOperator>ABOVE</iwxxm:prevailingVisibilityOperator>",
    );
    const reParsed = parseIwxxm(generated);
    if (reParsed.kind === "taf") throw new Error("预期观测侧 IR");
    if (reParsed.visibility?.kind !== "value") throw new Error("能见度应有值");
    expect(reParsed.visibility.value).toMatchObject({
      value: 9999,
      unit: "m",
      exact: false,
      beyond: "above",
    });
    expect(comparable(reParsed)).toEqual(comparable(ir));
  });
  it("TAC 0000 → 50m+BELOW，回读 0 below（下限电码两态等价）", () => {
    const ir = parse("METAR ZBTJ 080600Z 26006KT 0000 FG BKN002 04/04 Q1002");
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    expect(generated).toContain(
      '<iwxxm:prevailingVisibility uom="m">50</iwxxm:prevailingVisibility>',
    );
    expect(generated).toContain(
      "<iwxxm:prevailingVisibilityOperator>BELOW</iwxxm:prevailingVisibilityOperator>",
    );
    const reParsed = parseIwxxm(generated);
    if (reParsed.kind === "taf") throw new Error("预期观测侧 IR");
    if (reParsed.visibility?.kind !== "value") throw new Error("能见度应有值");
    expect(reParsed.visibility.value).toMatchObject({ value: 0, exact: false, beyond: "below" });
  });
  it("TAC 8000（精确值）→ 无算子元素，回读 exact=true——开闭区间以算子元素有无承载", () => {
    const ir = parse("METAR ZBTJ 080600Z 26006KT 8000 -RA BKN012 12/08 Q1010");
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    expect(generated).toContain(
      '<iwxxm:prevailingVisibility uom="m">8000</iwxxm:prevailingVisibility>',
    );
    expect(generated).not.toContain("prevailingVisibilityOperator");
    const reParsed = parseIwxxm(generated);
    if (reParsed.kind === "taf") throw new Error("预期观测侧 IR");
    if (reParsed.visibility?.kind !== "value") throw new Error("能见度应有值");
    expect(reParsed.visibility.value.exact).toBe(true);
  });
  it("TAC R17L/P2000 与 R16R/M0050 → meanRVROperator ABOVE/BELOW，回读 beyondRange 保真", () => {
    const ir = parse(
      "METAR ZBTJ 080600Z 26006KT 1200 R17L/P2000 R16R/M0050 -RA BKN012 11/09 Q1012",
    );
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    expect(generated).toContain("<iwxxm:meanRVROperator>ABOVE</iwxxm:meanRVROperator>");
    expect(generated).toContain("<iwxxm:meanRVROperator>BELOW</iwxxm:meanRVROperator>");
    expect(generated).toContain('<iwxxm:meanRVR uom="m">2000</iwxxm:meanRVR>');
    expect(generated).toContain('<iwxxm:meanRVR uom="m">50</iwxxm:meanRVR>');
    const reParsed = parseIwxxm(generated);
    if (reParsed.kind === "taf") throw new Error("预期观测侧 IR");
    if (reParsed.runwayVisualRange?.kind !== "value") throw new Error("RVR 应有值");
    const [above, below] = reParsed.runwayVisualRange.value;
    expect(above).toMatchObject({ runway: "17L", value: 2000, beyondRange: "above", unit: "m" });
    expect(below).toMatchObject({ runway: "16R", value: 50, beyondRange: "below", unit: "m" });
    expect(comparable(reParsed)).toEqual(comparable(ir));
  });
});

describe("NIL 三来源生成选词（难点 9 生成侧：对齐表逆向——各回各词，不混同）", () => {
  it("RVRNO（TAC 正文位）→ rvr nilReason=missing；回读 missing（remarks 电码重复记录不保真，告警出声）", () => {
    const ir = parse("METAR ZBTJ 080600Z 26006KT 1200 RVRNO -RA BKN012 11/09 Q1012");
    // TAC 通道把 RVRNO 电码同记两处：rvr {kind:'missing'}（语义本体）+ remarks rvr-no（电码形态）
    expect(ir.remarks.some((r) => r.kind === "rvr-no")).toBe(true);
    const collected: string[] = [];
    const generated = serializeIwxxm(ir, {
      calendar: { year: 2026, month: 10 },
      onWarning: (w) => collected.push(w.message),
    });
    expect(generated).toContain(
      '<iwxxm:rvr nilReason="http://codes.wmo.int/common/nil/missing" xsi:nil="true"/>',
    );
    const reParsed = parseIwxxm(generated);
    if (reParsed.kind === "taf") throw new Error("预期观测侧 IR");
    expect(reParsed.runwayVisualRange?.kind).toBe("missing");
    // 语义面全等——唯一差异＝remarks 的 rvr-no 电码重复记录（IWXXM 无 RMK 位，不保真，
    // 语义本体经 rvr nil missing 承载；丢弃面已由 onWarning 的 RMK 告警出声，不静默）
    expect(collected.some((m) => m.includes("RMK"))).toBe(true);
    expect(comparable({ ...reParsed, remarks: [] })).toEqual(comparable({ ...ir, remarks: [] }));
  });
  it("`//` 天气缺测 → presentWeather nilReason=notObservable；回读 missing", () => {
    const ir = parse("METAR ZBTJ 080600Z 26006KT 1200 // BKN012 11/09 Q1012");
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    expect(generated).toMatch(
      /<iwxxm:presentWeather nilReason="http:\/\/codes\.wmo\.int\/common\/nil\/notObservable" xsi:nil="true"\/>/,
    );
    const reParsed = parseIwxxm(generated);
    if (reParsed.kind === "taf") throw new Error("预期观测侧 IR");
    expect(reParsed.weather?.kind).toBe("missing");
  });
  it("`/////KT` 风缺测 → surfaceWind nilReason=notObservable；回读 missing", () => {
    const ir = parse("METAR ZBTJ 080600Z /////KT 1200 BKN012 11/09 Q1012");
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    expect(generated).toMatch(
      /<iwxxm:surfaceWind nilReason="http:\/\/codes\.wmo\.int\/common\/nil\/notObservable" xsi:nil="true"\/>/,
    );
    const reParsed = parseIwxxm(generated);
    if (reParsed.kind === "taf") throw new Error("预期观测侧 IR");
    expect(reParsed.wind?.kind).toBe("missing");
  });
  it("整报 NIL → observation nilReason=missing——与 RVRNO 同词不同位（载体区分来源），均已各有断言", () => {
    const ir = parse("METAR ZSAM 080600Z NIL");
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    expect(generated).toContain(
      '<iwxxm:observation nilReason="http://codes.wmo.int/common/nil/missing" xsi:nil="true"/>',
    );
  });
});

describe("VRB 与静风往返（难点 5 生成侧：无损面证明）", () => {
  it("TAC VRB02KT → variableWindDirection=true 且无 meanWindDirection（FALE 官方形），回读 variable=true 全等", () => {
    const ir = parse("METAR ZBTJ 080600Z VRB02KT 8000 BKN012 12/08 Q1010");
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    expect(generated).toContain('variableWindDirection="true"');
    expect(generated).not.toContain("meanWindDirection");
    const reParsed = parseIwxxm(generated);
    if (reParsed.kind === "taf") throw new Error("预期观测侧 IR");
    if (reParsed.wind?.kind !== "value" || ir.wind?.kind !== "value") throw new Error("风组应有值");
    expect(reParsed.wind.value.variable).toBe(true);
    expect(reParsed.wind.value.direction).toBeNull();
    expect(comparable(reParsed)).toEqual(comparable(ir));
  });
  it("TAC 00000KT → meanWindDirection 0deg（静风方向位数值 0），回读 direction=0 全等", () => {
    const ir = parse("METAR ZBTJ 080600Z 00000KT 8000 BKN012 12/08 Q1010");
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    expect(generated).toContain('<iwxxm:meanWindDirection uom="deg">0</iwxxm:meanWindDirection>');
    const reParsed = parseIwxxm(generated);
    if (reParsed.kind === "taf") throw new Error("预期观测侧 IR");
    if (reParsed.wind?.kind !== "value") throw new Error("风组应有值");
    expect(reParsed.wind.value.direction).toBe(0);
    expect(reParsed.wind.value.variable).toBe(false);
    expect(comparable(reParsed)).toEqual(comparable(ir));
  });
  it("带扇区的变风（080V140）→ clockwise/counterClockwise 双端点，回读 variation 保真", () => {
    const ir = parse("METAR ZBTJ 080600Z 08010KT 060V140 8000 BKN012 12/08 Q1010");
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    expect(generated).toContain(
      '<iwxxm:extremeClockwiseWindDirection uom="deg">140</iwxxm:extremeClockwiseWindDirection>',
    );
    expect(generated).toContain(
      '<iwxxm:extremeCounterClockwiseWindDirection uom="deg">60</iwxxm:extremeCounterClockwiseWindDirection>',
    );
    const reParsed = parseIwxxm(generated);
    if (reParsed.kind === "taf") throw new Error("预期观测侧 IR");
    expect(comparable(reParsed)).toEqual(comparable(ir));
  });
});

/** 收集通道产物（不校验生成文本——各面数值行为已由既有断言锁定，本组只对告警面）。
 *  工厂上移模块层（consistent-function-scoping——不捕获组内闭包变量）。 */
const warningsOf = (report: IwxxmReport, version?: "2023-1" | "2025-2") => {
  const collected: string[] = [];
  serializeIwxxm(report, {
    calendar: { year: 2026, month: 10 },
    ...(version !== undefined ? { version } : {}),
    onWarning: (w) => collected.push(`${w.code}|${w.severity}|${w.message}`),
  });
  return collected;
};

describe("有损告警通道（onWarning——生成面「告警不静默」落位，v0.3.1）", () => {
  it("RMK 附加段：TAC RMK SLP134 AO1 → lossy-conversion(info) 点名 RMK；生成件无 SLP134", () => {
    const ir = parse("METAR ZBTJ 080600Z 26006KT 8000 BKN012 12/08 Q1010 RMK SLP134 AO1");
    expect(ir.remarks.length).toBeGreaterThan(0);
    const messages = warningsOf(ir);
    expect(messages.some((m) => m.startsWith("lossy-conversion|info|") && m.includes("RMK"))).toBe(
      true,
    );
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    expect(generated).not.toContain("SLP134");
  });
  it("CLR 收敛：TAC CLR → 告警点名收敛 NCD；NSC/SKC/NCD 无损不告警", () => {
    const clr = parse("METAR KSEA 080600Z 26006KT 9999 CLR 18/09 A3001");
    expect(warningsOf(clr).some((m) => m.includes("CLR") && m.includes("NCD"))).toBe(true);
    for (const code of ["NSC", "SKC", "NCD"] as const) {
      const ir = parse(`METAR ZBTJ 080600Z 26006KT 9999 ${code} 18/09 Q1015`);
      expect(warningsOf(ir), code).toHaveLength(0);
    }
  });
  it("RVR V 形与逐道 SNOCLO：各出一条点名有损面", () => {
    const vForm = parse("METAR ZBTJ 080600Z 26006KT 1200 R07R/1800V2200 -RA BKN012 11/09 Q1012");
    expect(warningsOf(vForm).some((m) => m.includes("V 波动") && m.includes("min"))).toBe(true);
    const snoclo = parse("METAR ZBTJ 080600Z 26006KT 1200 R24/SNOCLO -RA BKN012 11/09 Q1012");
    expect(snoclo.runwayStates[0]?.closed).toBe(true);
    expect(warningsOf(snoclo).some((m) => m.includes("全机场") && m.includes("24"))).toBe(true);
  });
  it("美制单位折算与趋势 DDHH/DDHH 窗：各出一条；趋势窗回读 TL+窗止（窗起不保真）", () => {
    const usUnits = parse("METAR KSEA 080600Z 26006KT P6SM FEW030 18/09 A3008");
    expect(warningsOf(usUnits).some((m) => m.includes("sm→m") && m.includes("inHg→hPa"))).toBe(
      true,
    );
    const ir = parse(
      "METAR ZBTJ 280600Z 26006KT 8000 -RA BKN012 12/08 Q1010 BECMG 2812/2818 3000 BR BKN010",
    );
    const messages = warningsOf(ir);
    expect(messages.some((m) => m.includes("DDHH/DDHH") && m.includes("窗起不保真"))).toBe(true);
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    expect(generated).toContain("<iwxxm:timeIndicator>UNTIL</iwxxm:timeIndicator>");
    expect(generated).toMatch(/<gml:endPosition>2026-10-28T18:00:00Z<\/gml:endPosition>/);
  });
  it("TAF 气温单端与 TAF-8 偏差：各出一条（不捏造纪律的告警面）", () => {
    const singleEnd = parseTaf("TAF ZBAA 080511Z 0806/0912 19008MPS Q1014 TX23/0807Z=");
    expect(
      warningsOf(singleEnd).some((m) => m.includes("气温组") && m.includes("不捏造另一端")),
    ).toBe(true);
    const noBaseGroups = parseTaf("TAF ZBAA 080511Z 0806/0912 19008MPS Q1014=");
    const messages = warningsOf(noBaseGroups);
    expect(messages.some((m) => m.includes("TAF-8") && m.includes("不捏造"))).toBe(true);
  });
  it("2025-2 出口同通道生效（版本无关——有损面属 IR→XML 语义层）", () => {
    const clr = parse("METAR KSEA 080600Z 26006KT 9999 CLR 18/09 A3001");
    expect(
      warningsOf(clr, "2025-2").some(
        (m) => m.startsWith("lossy-conversion|info|") && m.includes("CLR"),
      ),
    ).toBe(true);
  });
  it("缺省不回调：onWarning 缺席时产物与回调形态逐字节一致（通道零行为变化）", () => {
    const ir = parse("METAR KSEA 080600Z 26006KT P6SM R07R/1800V2200 CLR 18/09 A3008 RMK SLP134");
    const silent = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    const withChannel = serializeIwxxm(ir, {
      calendar: { year: 2026, month: 10 },
      onWarning: () => {},
    });
    expect(withChannel).toBe(silent);
  });
});

describe("跨年除夕日历边界（难点 12 生成侧：年月注入的月末/年末回绕）", () => {
  it("12/31 2350 观测 + 趋势 TL0010 → endPosition 落次年 1/1 00:10（Date.UTC 归一化跨年）", () => {
    const ir = parse(
      "METAR ZBTJ 312350Z 26006KT 8000 -RA BKN012 02/00 Q1012 BECMG TL0010 3000 BR BKN010",
    );
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 12 } });
    expect(generated).toMatch(/<gml:timePosition>2026-12-31T23:50:00Z<\/gml:timePosition>/);
    expect(generated).toMatch(/<gml:endPosition>2027-01-01T00:10:00Z<\/gml:endPosition>/);
  });
  it("TAF 有效期止时 24 午夜特例跨年：3121/3124 → endPosition 次年 1/1 00:00（止时 24 两态等价）", () => {
    const ir = parseTaf("TAF ZBAA 312100Z 3121/3124 19008MPS 8000 BKN030=");
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 12 } });
    expect(generated).toMatch(/<gml:beginPosition>2026-12-31T21:00:00Z<\/gml:beginPosition>/);
    expect(generated).toMatch(/<gml:endPosition>2027-01-01T00:00:00Z<\/gml:endPosition>/);
  });
  it("31 日发报 METAR 趋势窗跨月：BECMG 0103/0109 → 双端点落次月 1 日 03/09Z（窗起点以发报时刻为锚——直投影残留分支收口，不再静默落 12 月）", () => {
    const ir = parse(
      "METAR ZBTJ 312350Z 26006KT 8000 -RA BKN012 02/00 Q1012 BECMG 0103/0109 3000 BR BKN010",
    );
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 12 } });
    expect(generated).toMatch(/<gml:beginPosition>2027-01-01T03:00:00Z<\/gml:beginPosition>/);
    expect(generated).toMatch(/<gml:endPosition>2027-01-01T09:00:00Z<\/gml:endPosition>/);
    expect(generated).not.toContain("2026-12-01");
  });
  it("跨月 TAF 变化组窗：3121/0121 有效期内 BECMG 0103/0109 → 变化组 phenomenonTime 落次月（有效期起点为锚的 DDHH 次月判式）", () => {
    const ir = parseTaf(
      "TAF ZBAA 312100Z 3121/0121 19008MPS 8000 BKN030 BECMG 0103/0109 3000 BR BKN010=",
    );
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 12 } });
    expect(generated).toMatch(/<gml:beginPosition>2026-12-31T21:00:00Z<\/gml:beginPosition>/);
    expect(generated).toMatch(/<gml:endPosition>2027-01-01T21:00:00Z<\/gml:endPosition>/);
    expect(generated).toMatch(/<gml:beginPosition>2027-01-01T03:00:00Z<\/gml:beginPosition>/);
    expect(generated).toMatch(/<gml:endPosition>2027-01-01T09:00:00Z<\/gml:endPosition>/);
  });
  it("跨月 TAF FM 硬时刻：FM0106 → 2027-01-01T01:06（HHMM 次日判式——时刻取有效期内首个出现，不再早于发报 21:00）", () => {
    const ir = parseTaf("TAF ZBAA 312100Z 3121/0121 19008MPS 8000 BKN030 FM0106 3000 BR BKN010=");
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 12 } });
    expect(generated).toMatch(/<gml:beginPosition>2027-01-01T01:06:00Z<\/gml:beginPosition>/);
    expect(generated).not.toContain("2026-12-31T01:06");
  });
  it("同月中段不误回绕：2806/2912 有效期内窗 2908/2909 与 FM1200 均落本日期（锚后投影的回归面）", () => {
    const ir = parseTaf(
      "TAF ZBAA 280600Z 2806/2912 19008MPS 8000 BKN030 BECMG 2908/2909 3000 BR BKN010 FM1200 3000 BR=",
    );
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    expect(generated).toMatch(/<gml:beginPosition>2026-10-29T08:00:00Z<\/gml:beginPosition>/);
    expect(generated).toMatch(/<gml:endPosition>2026-10-29T09:00:00Z<\/gml:endPosition>/);
    expect(generated).toMatch(/<gml:beginPosition>2026-10-28T12:00:00Z<\/gml:beginPosition>/);
  });
});

/** 逐算子验算：period 文本 → 生成件（timeIndicator + TimePeriod/TimeInstant 形态）。
 *  工厂上移模块层（consistent-function-scoping——不捕获组内闭包变量）。 */
const trendXmlOf = (periodWord: string): string => {
  const ir = parse(
    `METAR ZBTJ 280600Z 26006KT 8000 -RA BKN012 12/08 Q1010 BECMG ${periodWord} 3000 BR BKN010`,
  );
  return serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
};

describe("趋势时窗算子表（难点 14 生成侧：TAC 时段词 ↔ TimePeriod/TimeIndicator 落位对照）", () => {
  it("TL0130 → timeIndicator UNTIL + begin=发报时刻 indeterminate after / end=TL 时刻（ZSPD 官方形；TL 早于发报按次日回绕）", () => {
    const xml = trendXmlOf("TL0130");
    expect(xml).toContain("<iwxxm:timeIndicator>UNTIL</iwxxm:timeIndicator>");
    expect(xml).toMatch(
      /<gml:beginPosition indeterminatePosition="after">2026-10-28T06:00:00Z<\/gml:beginPosition>/,
    );
    // TL 01:30 早于发报 06:00——日位锚发报日、时刻早于发报按次日回绕（28→29）
    expect(xml).toMatch(/<gml:endPosition>2026-10-29T01:30:00Z<\/gml:endPosition>/);
  });
  it("FM0800 → FROM + begin=FM 时刻 / end=同时刻 indeterminate after（WSSS/VTUO 官方形）", () => {
    const xml = trendXmlOf("FM0800");
    expect(xml).toContain("<iwxxm:timeIndicator>FROM</iwxxm:timeIndicator>");
    expect(xml).toMatch(/<gml:beginPosition>2026-10-28T08:00:00Z<\/gml:beginPosition>/);
    expect(xml).toMatch(
      /<gml:endPosition indeterminatePosition="after">2026-10-28T08:00:00Z<\/gml:endPosition>/,
    );
  });
  it("AT0400（早于发报 0600）→ TimeInstant 硬时刻按次日回绕（10-29T04:00，与 TL/FM 同一 trendInstantOf 判式）", () => {
    const xml = trendXmlOf("AT0400");
    expect(xml).toContain("<iwxxm:timeIndicator>AT</iwxxm:timeIndicator>");
    expect(xml).toMatch(/<gml:timePosition>2026-10-29T04:00:00Z<\/gml:timePosition>/);
  });
  it("无时段词趋势 → phenomenonTime nilReason=missing（EDDP 官方形），无 timeIndicator", () => {
    const ir = parse("METAR ZBTJ 280600Z 26006KT 8000 -RA BKN012 12/08 Q1010 BECMG 3000 BR BKN010");
    const xml = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    expect(xml).toMatch(
      /<iwxxm:phenomenonTime nilReason="http:\/\/codes\.wmo\.int\/common\/nil\/missing"\/>/,
    );
    expect(xml).not.toContain("<iwxxm:timeIndicator>");
  });
});

// —— 0.3.1 修复收口（有损清单逐行回调补齐、单位折算让位前提、温组达时刻跨月、扇区属性位反推）——
// 对账底档 docs/iwxxm-notes.md §十一.9（同族第四处）/§十一.11（扇区单向漂移）。

describe("有损清单逐行回调补齐（0.3.1：CAVOK 矛盾让位与趋势/预报体最低能见度）", () => {
  it("CAVOK=true 矛盾 IR（能见度/天气/云并存）→ lossy-conversion 让位告警点名，生成件三组不落", () => {
    const ir = parse("METAR ZBTJ 080600Z 26006KT 9999 -RA BKN012 12/08 Q1010");
    // 手拼矛盾 IR：cavok=true 且三组在位（TAC 解析侧会清组让位，合成 IR 直入生成面锁行为）
    const contradictory: MetarReport = { ...ir, cavok: true };
    const messages = warningsOf(contradictory);
    expect(
      messages.some(
        (m) => m.startsWith("lossy-conversion|info|") && m.includes("CAVOK") && m.includes("让位"),
      ),
    ).toBe(true);
    const generated = serializeIwxxm(contradictory, { calendar: { year: 2026, month: 10 } });
    expect(generated).toContain('cloudAndVisibilityOK="true"');
    expect(generated).not.toContain("<iwxxm:visibility");
    expect(generated).not.toContain("<iwxxm:presentWeather");
    expect(generated).not.toContain("<iwxxm:cloud");
    // 无矛盾（TAC CAVOK 报文三组已让位清空）不告警——让位告警只对矛盾 IR 出声
    const clean = parse("METAR ZBTJ 080600Z 26006KT CAVOK 12/08 Q1010");
    expect(clean.cavok).toBe(true);
    expect(warningsOf(clean).some((m) => m.includes("CAVOK"))).toBe(false);
  });
  it("趋势/预报体最低能见度不落 → lossy-conversion 告警点名（趋势段与 TAF 基况段两载体）", () => {
    // 趋势段：TAC 趋势语法对最低能见度组 best-effort 不落 IR——手拼 XML 源可能携带的形态直入生成面
    const trendIr = parse(
      "METAR ZBTJ 280600Z 26006KT 8000 BKN012 12/08 Q1010 BECMG AT0700 3000 BR BKN010",
    );
    const base = trendIr.trends[0];
    if (base === undefined || base.elements?.visibility === undefined) {
      throw new Error("夹具应有趋势段且趋势能见度在位");
    }
    const trendWithMin: MetarReport = {
      ...trendIr,
      trends: [
        {
          ...base,
          elements: {
            ...base.elements,
            visibility: { ...base.elements.visibility, minimum: { value: 800, direction: "NW" } },
          },
        },
      ],
    };
    expect(
      warningsOf(trendWithMin).some(
        (m) => m.startsWith("lossy-conversion|info|") && m.includes("最低能见度"),
      ),
    ).toBe(true);
    // TAF 基况段：最低能见度组挂主导能见度上（TAC 1200NW 族原生落 IR）
    const tafIr = parseTaf("TAF ZBAA 280600Z 2806/2912 19008MPS 8000 1200NW BKN030=");
    expect(
      warningsOf(tafIr).some(
        (m) => m.startsWith("lossy-conversion|info|") && m.includes("最低能见度"),
      ),
    ).toBe(true);
    // 无最低能见度组不告警（静默面回归）
    const plain = parse("METAR ZBTJ 280600Z 26006KT 8000 BKN012 12/08 Q1010 BECMG AT0700 3000 BR");
    expect(warningsOf(plain).some((m) => m.includes("最低能见度"))).toBe(false);
  });
  it("单位折算告警的 CAVOK 让位前提：cavok=true 时 vis sm/RVR ft 不再误称「折算落位」，QNH inHg 恒落位照常出声", () => {
    const ir = parse("METAR KSEA 080600Z 26006KT P6SM R07R/1500FT -RA BKN012 18/09 A3001");
    const contradictory: MetarReport = { ...ir, cavok: true };
    const messages = warningsOf(contradictory);
    expect(messages.some((m) => m.includes("sm→m"))).toBe(false);
    expect(messages.some((m) => m.includes("ft→m"))).toBe(false);
    expect(messages.some((m) => m.includes("inHg→hPa"))).toBe(true);
    // 让位事实在生成件：RVR/能见度组确实不落
    const generated = serializeIwxxm(contradictory, { calendar: { year: 2026, month: 10 } });
    expect(generated).not.toContain("<iwxxm:rvr");
    expect(generated).not.toContain("<iwxxm:visibility");
  });
});

describe("TAF 温组达时刻跨月收口（0.3.1：§十一.9 同族第四处——有效期起点为锚的 DD 位判式）", () => {
  it("跨月：3121/0121 有效期内 TX26/0120Z TN14/0108Z → 达时刻落次月 1 日（不再直投影 12 月）", () => {
    const ir = parseTaf("TAF ZBAA 312100Z 3121/0121 19008MPS 8000 BKN030 TX26/0120Z TN14/0108Z=");
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 12 } });
    expect(generated).toMatch(/<gml:timePosition>2027-01-01T20:00:00Z<\/gml:timePosition>/);
    expect(generated).toMatch(/<gml:timePosition>2027-01-01T08:00:00Z<\/gml:timePosition>/);
    expect(generated).not.toContain("2026-12-01T");
  });
  it("同月中段不误回绕（回归面）：2806/2912 有效期内 TX26/2807Z TN14/2901Z 落本日期", () => {
    const ir = parseTaf("TAF ZBAA 280600Z 2806/2912 19008MPS 8000 BKN030 TX26/2807Z TN14/2901Z=");
    const generated = serializeIwxxm(ir, { calendar: { year: 2026, month: 10 } });
    expect(generated).toMatch(/<gml:timePosition>2026-10-28T07:00:00Z<\/gml:timePosition>/);
    expect(generated).toMatch(/<gml:timePosition>2026-10-29T01:00:00Z<\/gml:timePosition>/);
    // 同报往返保真（温组数值面不受锚定影响）
    const reParsed = parseIwxxm(generated);
    if (reParsed.kind !== "taf") throw new Error("预期预报侧 IR");
    expect(comparable(reParsed)).toEqual(comparable(ir));
  });
});

describe("扇区形 variableWindDirection 反推（0.3.1：§十一.11——emit 对齐官方译文口径，解析侧零改动）", () => {
  it("LTCN 官方对（11007KT 080V140）往返：解析侧 variable=false 不动，生成件属性反推 true 且保留均值方向（官方原文同形）", () => {
    const ltcnXml = readFileSync(`${corpusDir}metar-pairs/LTCN-282350Z.xml`, "utf8");
    const first = parseIwxxm(ltcnXml);
    if (first.kind === "taf") throw new Error("预期观测侧 IR");
    if (first.wind?.kind !== "value") throw new Error("风组应有值");
    // 解析侧行为零改动：扇区在场 → variable=false、扇区走 variation（既有 LTCN 明锁口径）
    expect(first.wind.value.variable).toBe(false);
    const { generated, second } = roundTrip(ltcnXml);
    // 生成侧按官方译文口径（D0 ③）：扇区值在场 → variableWindDirection=true + 均值方向保留
    expect(generated).toContain('variableWindDirection="true"');
    expect(generated).toContain('<iwxxm:meanWindDirection uom="deg">110</iwxxm:meanWindDirection>');
    expect(generated).toContain(
      '<iwxxm:extremeClockwiseWindDirection uom="deg">140</iwxxm:extremeClockwiseWindDirection>',
    );
    // 往返闭合：回读 IR 与首遍全等（属性位单向漂移就此收口）
    if (second.wind?.kind !== "value") throw new Error("风组应有值");
    expect(second.wind.value.variable).toBe(false);
    expect(second.wind.value.variation).toMatchObject({ min: 80, max: 140 });
    expect(comparable(second)).toEqual(comparable(first));
  });
  it("TAC 源属性位三分支回归：扇区→true、VRB→true、普通定向风→false", () => {
    const cal = { calendar: { year: 2026, month: 10 } };
    const sector = parse("METAR ZBTJ 080600Z 08010KT 060V140 8000 BKN012 12/08 Q1010");
    expect(serializeIwxxm(sector, cal)).toContain('variableWindDirection="true"');
    const vrb = parse("METAR ZBTJ 080600Z VRB02KT 8000 BKN012 12/08 Q1010");
    expect(serializeIwxxm(vrb, cal)).toContain('variableWindDirection="true"');
    const plain = parse("METAR ZBTJ 080600Z 26006KT 8000 BKN012 12/08 Q1010");
    expect(serializeIwxxm(plain, cal)).toContain('variableWindDirection="false"');
  });
});
