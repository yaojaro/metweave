// IWXXM 解析器单元测试：版本容错 / 未知元素 / NIL / CAVOK 让位 / strict 门 / 错误面契约。
// 语料级验收在 iwxxm-corpus.test.ts（官方等价对双通道）；本文件聚焦合成的边界形态。
// TAF 根（v0.3 遗留项 1）的专项测试在本文件「TAF 解析」组；观测侧用例经 parseMetar 收窄。
import { describe, expect, it } from "vitest";
import type { MetarReport, TafReport } from "@metweave/core";
import { MetarParseError } from "@metweave/core";
import { parseIwxxm, tryParseIwxxm, type IwxxmParseOptions, type IwxxmReport } from "./iwxxm";

/** span 切片查看器（undefined 显示占位）——span 定位测试组用。 */
const at = (xml: string, s: { start: number; end: number } | undefined): string =>
  s === undefined ? "(无 span)" : xml.slice(s.start, s.end);

/** 观测侧收窄：本文件 METAR/SPECI 用例的 IR 断言入口（TAF 根走「TAF 解析」组专属夹具）。 */
const asMetar = (r: IwxxmReport): MetarReport => {
  if (r.kind === "taf") throw new Error("预期 METAR/SPECI IR，实得 TAF IR——夹具错置");
  return r;
};
const parseMetar = (xml: string, options?: IwxxmParseOptions): MetarReport =>
  asMetar(parseIwxxm(xml, options));

/** 2023-1 最小合法 METAR 骨架（站名/时组/风/能见度）——各用例在其上做定点变异。 */
const skeleton = (body: string): string => `<?xml version="1.0"?>
<iwxxm:METAR xmlns:iwxxm="http://icao.int/iwxxm/2023-1" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:aixm="http://www.aixm.aero/schema/5.1.1" reportStatus="NORMAL" permissibleUsage="OPERATIONAL">
  <iwxxm:issueTime><gml:TimeInstant gml:id="t1"><gml:timePosition>2026-10-05T00:00:00Z</gml:timePosition></gml:TimeInstant></iwxxm:issueTime>
  <iwxxm:aerodrome><aixm:AirportHeliport><aixm:timeSlice><aixm:AirportHeliportTimeSlice><aixm:locationIndicatorICAO>ZSPD</aixm:locationIndicatorICAO></aixm:AirportHeliportTimeSlice></aixm:timeSlice></aixm:AirportHeliport></iwxxm:aerodrome>
  <iwxxm:observationTime xlink:href="#t1"/>
  ${body}
</iwxxm:METAR>`;

const observation = (inner: string): string =>
  skeleton(
    `<iwxxm:observation><iwxxm:MeteorologicalAerodromeObservation cloudAndVisibilityOK="false">${inner}</iwxxm:MeteorologicalAerodromeObservation></iwxxm:observation>`,
  );

const parseErrorOf = (xml: string): MetarParseError => {
  try {
    parseIwxxm(xml);
  } catch (err) {
    if (err instanceof MetarParseError) return err;
    throw new Error(`预期 MetarParseError，实得 ${String(err)}`, { cause: err });
  }
  throw new Error("预期整体失败，但解析成功了");
};

describe("错误面契约（整体失败）", () => {
  it("非字符串输入 → invalid-input", () => {
    expect(parseErrorOf(null as unknown as string).code).toBe("invalid-input");
  });
  it("无 IWXXM 命名空间声明 → invalid-input（不是 IWXXM 文档）", () => {
    expect(parseErrorOf("<foo><bar/></foo>").code).toBe("invalid-input");
  });
  it("非 XML 文本 → invalid-input（XML 语法失败）", () => {
    expect(parseErrorOf('xmlns:iwxxm="http://icao.int/iwxxm/2023-1" 纯文本').code).toBe(
      "invalid-input",
    );
  });
  it("xlink:href 电码引用含非法百分号 → invalid-input（URIError 不逃逸契约面）", () => {
    const bad = observation(
      `<iwxxm:presentWeather xlink:href="http://codes.wmo.int/bufr4/codeflag/0-20-003/%ZZ"/>`,
    );
    const err = parseErrorOf(bad);
    expect(err.code).toBe("invalid-input");
    expect(err.message).toContain("百分号");
    expect(err.raw).toBe(bad); // 失败样本原文保真
  });
  it("根是 TAF → 不再整体失败（遗留项 1 起真实解析）——行为见「TAF 解析」组", () => {
    // 原「TAF 根 invalid-input」断言随 TAF 支持落位作废：根分派按 kind 走 TafReport 路径
    const taf = tafSkeleton("");
    const r = parseIwxxm(taf);
    expect(r.kind).toBe("taf");
  });
  it("无站名 → missing-station", () => {
    const noStation = skeleton(
      `<iwxxm:observation><iwxxm:MeteorologicalAerodromeObservation cloudAndVisibilityOK="false"/></iwxxm:observation>`,
    ).replace(/<aixm:AirportHeliport>.*<\/aixm:AirportHeliport>/s, "");
    expect(parseErrorOf(noStation).code).toBe("missing-station");
  });
  it("无观测时组 → missing-time", () => {
    const noTime = skeleton("").replace('<iwxxm:observationTime xlink:href="#t1"/>', "");
    expect(parseErrorOf(noTime).code).toBe("missing-time");
  });
  it("strict → unsupported-mode（未实现不静默降级）", () => {
    try {
      parseIwxxm(skeleton(""), { mode: "strict" });
      throw new Error("预期 strict 抛错");
    } catch (err) {
      expect(err).toBeInstanceOf(MetarParseError);
      if (err instanceof MetarParseError) expect(err.code).toBe("unsupported-mode");
    }
  });
});

describe("三态与 NIL", () => {
  it("observation 整体 xsi:nil → IR 最小形态 nil:true（NIL 报）", () => {
    const nil = skeleton(
      `<iwxxm:observation nilReason="http://codes.wmo.int/common/nil/missing" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true"/>`,
    );
    const r = parseMetar(nil);
    expect(r.nil).toBe(true);
    expect(r.station).toBe("ZSPD");
    expect(r.time).toEqual({ day: 5, hour: 0, minute: 0 });
    expect(r.trends).toEqual([]);
    expect(r.runwayStates).toEqual([]);
  });
  it("NIL 选词未识别 → info 告警出声（不静默）", () => {
    const nil = skeleton(
      `<iwxxm:observation nilReason="http://codes.wmo.int/common/nil/what-word" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true"/>`,
    );
    const r = parseMetar(nil);
    expect(r.nil).toBe(true);
    expect(
      r.warnings.some((w) => w.code === "invalid-format" && w.message.includes("what-word")),
    ).toBe(true);
  });
  it("NIL 报 spans:false 紧凑模式同走 compactNode 出口（与非 NIL 主路径口径一致）", () => {
    const nil = skeleton(
      `<iwxxm:observation nilReason="http://codes.wmo.int/common/nil/missing" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true"/>`,
    );
    const full = parseMetar(nil);
    const compacted = parseMetar(nil, { spans: false });
    // NIL 最小形态本无 span——紧凑出口不得引入差异，且产物序列化里不得出现 span 键
    expect(compacted).toEqual(full);
    expect(JSON.stringify(compacted)).not.toContain('"start"');
  });
  it("风组 xsi:nil → wind {kind:'missing'}（span＝nil 元素区间）", () => {
    const r = parseMetar(
      observation(
        `<iwxxm:surfaceWind nilReason="http://codes.wmo.int/common/nil/notObservable" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true"/>`,
      ),
    );
    expect(r.wind?.kind).toBe("missing");
    if (r.wind?.span !== undefined) {
      expect(r.raw.slice(r.wind.span.start, r.wind.span.end)).toMatch(
        /^<iwxxm:surfaceWind[^]*\/>$/,
      );
    }
  });
  it("observation 元素缺席（minOccurs=0）→ 同按 NIL 收", () => {
    const r = parseMetar(skeleton(""));
    expect(r.nil).toBe(true);
  });
});

describe("版本分派（2023-1/2025-2 双支持；XSD 实证两版观测容器同构）", () => {
  it("2025-2 命名空间 → 不出版本告警，字段照常落 IR", () => {
    const awc = skeleton(
      `<iwxxm:observation><iwxxm:MeteorologicalAerodromeObservation cloudAndVisibilityOK="false"><iwxxm:airTemperature uom="Cel">23</iwxxm:airTemperature><iwxxm:dewpointTemperature uom="Cel">11</iwxxm:dewpointTemperature></iwxxm:MeteorologicalAerodromeObservation></iwxxm:observation>`,
    ).replace("iwxxm/2023-1", "iwxxm/2025-2");
    const r = parseMetar(awc);
    expect(r.warnings.find((w) => w.code === "invalid-format")).toBeUndefined();
    expect(r.station).toBe("ZSPD");
    expect(r.temperature).toMatchObject({ celsius: 23 });
    expect(r.dewpoint).toMatchObject({ celsius: 11 });
  });
  it("未支持版本（2.1 旧架构族）→ invalid-format(info) 告警点名支持清单 + 尽力解析", () => {
    const old = skeleton(
      `<iwxxm:observation><iwxxm:MeteorologicalAerodromeObservation cloudAndVisibilityOK="false"/></iwxxm:observation>`,
    ).replace("iwxxm/2023-1", "iwxxm/2.1");
    const r = parseMetar(old);
    const warn = r.warnings.find((w) => w.code === "invalid-format");
    expect(warn?.severity).toBe("info");
    expect(warn?.message).toContain("2.1");
    expect(warn?.message).toContain("2023-1/2025-2");
    expect(r.station).toBe("ZSPD");
  });
  it("OM_Observation 包装形态（旧 OM 架构族防御路径，合成样——无真实样本）→ 经 om:result 下钻照常解析", () => {
    const omWrapped = skeleton(
      `<iwxxm:observation><om:OM_Observation xmlns:om="http://www.opengis.net/om/2.0"><om:result><iwxxm:MeteorologicalAerodromeObservation cloudAndVisibilityOK="false"><iwxxm:airTemperature uom="Cel">10</iwxxm:airTemperature></iwxxm:MeteorologicalAerodromeObservation></om:result></om:OM_Observation></iwxxm:observation>`,
    );
    const r = parseMetar(omWrapped);
    expect(r.station).toBe("ZSPD");
    expect(r.temperature).toMatchObject({ celsius: 10 });
  });
});

describe("AWC 2025-2 转换形态（KSEA/KCRW/VIDP 实时流实证）", () => {
  it("OVX 云量层 ＝ VV 形态 → IR vertical-visibility（与 2023-1 译文 verticalVisibility 元素同构）", () => {
    const r = parseMetar(
      observation(
        `<iwxxm:cloud><iwxxm:AerodromeCloud><iwxxm:layer><iwxxm:CloudLayer><iwxxm:amount xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="http://codes.wmo.int/49-2/CloudAmountReportedAtAerodrome/OVX"/><iwxxm:base uom="[ft_i]">100</iwxxm:base></iwxxm:CloudLayer></iwxxm:layer></iwxxm:AerodromeCloud></iwxxm:cloud>`,
      ),
    );
    expect(r.clouds).toMatchObject({
      elements: [{ kind: "vertical-visibility", heightFt: { value: 100 } }],
    });
  });
  it("空 AerodromeCloud 容器（无层/无垂直能见度/无 nilReason）→ clouds 省略 + info 出声", () => {
    const r = parseMetar(observation(`<iwxxm:cloud><iwxxm:AerodromeCloud/></iwxxm:cloud>`));
    expect(r.clouds).toBeUndefined();
    expect(
      r.warnings.some((w) => w.code === "invalid-format" && w.message.includes("云容器为空")),
    ).toBe(true);
  });
});

describe("未知元素与无位元素（不静默纪律）", () => {
  it("观测内未知元素 → unknown-token(info) 跳过出声", () => {
    const r = parseMetar(observation(`<iwxxm:volcanoAlert>RED</iwxxm:volcanoAlert>`));
    const warn = r.warnings.find((w) => w.code === "unknown-token");
    expect(warn?.message).toContain("volcanoAlert");
  });
  it("海况组（seaCondition，IR 无位）→ info 出声跳过", () => {
    const r = parseMetar(
      observation(
        `<iwxxm:seaCondition><iwxxm:AerodromeSeaCondition><iwxxm:seaSurfaceTemperature uom="Cel">15</iwxxm:seaSurfaceTemperature></iwxxm:AerodromeSeaCondition></iwxxm:seaCondition>`,
      ),
    );
    expect(r.warnings.some((w) => w.message.includes("seaCondition"))).toBe(true);
  });
});

describe("CAVOK（cloudAndVisibilityOK）", () => {
  it("true → IR cavok=true，vis/weather/cloud 让位", () => {
    const r = parseMetar(
      observation(
        `<iwxxm:visibility><iwxxm:AerodromeHorizontalVisibility><iwxxm:prevailingVisibility uom="m">10000</iwxxm:prevailingVisibility></iwxxm:AerodromeHorizontalVisibility></iwxxm:visibility>`,
      ).replace('cloudAndVisibilityOK="false"', 'cloudAndVisibilityOK="true"'),
    );
    expect(r.cavok).toBe(true);
    expect(r.visibility).toBeUndefined();
    expect(r.clouds).toBeUndefined();
  });
  it("true 且三组在场 → cross-check-conflict(warning) 矛盾出声（让位照旧）", () => {
    const r = parseMetar(
      observation(
        `<iwxxm:visibility><iwxxm:AerodromeHorizontalVisibility><iwxxm:prevailingVisibility uom="m">8000</iwxxm:prevailingVisibility></iwxxm:AerodromeHorizontalVisibility></iwxxm:visibility>`,
      ).replace('cloudAndVisibilityOK="false"', 'cloudAndVisibilityOK="true"'),
    );
    const warn = r.warnings.find((w) => w.code === "cross-check-conflict");
    expect(warn?.severity).toBe("warning");
    expect(r.visibility).toBeUndefined();
  });
  it("开标签内前位属性值含 > 不截短检索窗：CAVOK 属性仍可定位", () => {
    // XML 属性值合法含 ">"——裸 indexOf(">") 会把它误当标签结束，cavokSpan 检索窗被截短而丢失
    const xml = skeleton(
      `<iwxxm:observation><iwxxm:MeteorologicalAerodromeObservation remark="a>b" cloudAndVisibilityOK="true"/></iwxxm:observation>`,
    );
    const r = parseMetar(xml);
    expect(r.cavok).toBe(true);
    expect(at(xml, r.cavokSpan)).toBe('cloudAndVisibilityOK="true"');
  });
});

describe("无云族 nilReason 映射（D0 ④：四码收敛为代表电码）", () => {
  it("nothingOfOperationalSignificance → NSC + info 告警（SKC 细辨不可还原）", () => {
    const r = parseMetar(
      observation(
        `<iwxxm:cloud nilReason="http://codes.wmo.int/common/nil/nothingOfOperationalSignificance" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true"/>`,
      ),
    );
    expect(r.clouds?.clear?.code).toBe("NSC");
    expect(r.warnings.some((w) => w.message.includes("SKC/CLR"))).toBe(true);
  });
  it("notDetectedByAutoSystem → NCD", () => {
    const r = parseMetar(
      observation(
        `<iwxxm:cloud nilReason="http://codes.wmo.int/common/nil/notDetectedByAutoSystem" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true"/>`,
      ),
    );
    expect(r.clouds?.clear?.code).toBe("NCD");
  });
});

describe("阈值形态向 TAC 电码收敛（两通道等价的根基）", () => {
  it("能见度 10000+ABOVE → 9999+above（9999 ≥10km 上限电码）", () => {
    const r = parseMetar(
      observation(
        `<iwxxm:visibility><iwxxm:AerodromeHorizontalVisibility><iwxxm:prevailingVisibility uom="m">10000</iwxxm:prevailingVisibility><iwxxm:prevailingVisibilityOperator>ABOVE</iwxxm:prevailingVisibilityOperator></iwxxm:AerodromeHorizontalVisibility></iwxxm:visibility>`,
      ),
    );
    expect(r.visibility?.kind).toBe("value");
    if (r.visibility?.kind === "value") {
      expect(r.visibility.value.value).toBe(9999);
      expect(r.visibility.value.exact).toBe(false);
      expect(r.visibility.value.beyond).toBe("above");
    }
  });
  it("能见度 50+BELOW → 0+below（0000 下限电码）", () => {
    const r = parseMetar(
      observation(
        `<iwxxm:visibility><iwxxm:AerodromeHorizontalVisibility><iwxxm:prevailingVisibility uom="m">50</iwxxm:prevailingVisibility><iwxxm:prevailingVisibilityOperator>BELOW</iwxxm:prevailingVisibilityOperator></iwxxm:AerodromeHorizontalVisibility></iwxxm:visibility>`,
      ),
    );
    expect(r.visibility?.kind).toBe("value");
    if (r.visibility?.kind === "value") {
      expect(r.visibility.value.value).toBe(0);
      expect(r.visibility.value.beyond).toBe("below");
    }
  });
});

describe("uom 容错（单位跟组走）", () => {
  it("风速 uom 未识别 → 风组判缺测 + missing-expected(info)", () => {
    const r = parseMetar(
      observation(
        `<iwxxm:surfaceWind><iwxxm:AerodromeSurfaceWind variableWindDirection="false"><iwxxm:meanWindSpeed uom="furlongs">3</iwxxm:meanWindSpeed></iwxxm:AerodromeSurfaceWind></iwxxm:surfaceWind>`,
      ),
    );
    expect(r.wind?.kind).toBe("missing");
    expect(r.warnings.some((w) => w.code === "missing-expected")).toBe(true);
  });
  it("QNH 越界 → 读数跳过 + value-out-of-range(warning)", () => {
    const r = parseMetar(observation(`<iwxxm:qnh uom="hPa">10054</iwxxm:qnh>`));
    expect(r.altimeter).toBeUndefined();
    expect(r.warnings.some((w) => w.code === "value-out-of-range")).toBe(true);
  });
});

describe("结果式出口", () => {
  it("tryParseIwxxm：失败 {ok:false,error}、成功 {ok:true,report}（与 tryParse 同款契约）", () => {
    expect(tryParseIwxxm("not xml").ok).toBe(false);
    const ok = tryParseIwxxm(observation(""));
    expect(ok.ok).toBe(true);
  });
});

// —— span 源定位（第三期）：IR span ＝源元素/源属性在 raw（XML 原文）中的区间——
// 主路径 captureMetaData 元素元数据；无属性纯文本子元素坍缩成 string 丢元数据，走
// 「宿主区间内按标签+文本检索」兜底（消歧规则见 iwxxm.ts childTextSpanOf 注释）。
// 本组测试同时是对抗样例：同值文本多处出现、同名元素跨父级出现、属性与趋势同名属性并存。
describe("span 源定位（captureMetaData 主路径 + 坍缩兜底）", () => {
  /** 全要素合成样（风含扇区与阵风、四条 RVR、双天气、双云层、温露压、趋势段）——span 切片逐位核对。 */
  const full = observation(`
      <iwxxm:surfaceWind><iwxxm:AerodromeSurfaceWind variableWindDirection="true"><iwxxm:meanWindDirection uom="deg">80</iwxxm:meanWindDirection><iwxxm:meanWindSpeed uom="[kn_i]">10</iwxxm:meanWindSpeed><iwxxm:extremeCounterClockwiseWindDirection uom="deg">60</iwxxm:extremeCounterClockwiseWindDirection><iwxxm:extremeClockwiseWindDirection uom="deg">140</iwxxm:extremeClockwiseWindDirection></iwxxm:AerodromeSurfaceWind></iwxxm:surfaceWind>
      <iwxxm:visibility><iwxxm:AerodromeHorizontalVisibility><iwxxm:prevailingVisibility uom="m">800</iwxxm:prevailingVisibility><iwxxm:minimumVisibility uom="m">600</iwxxm:minimumVisibility><iwxxm:minimumVisibilityDirection uom="deg">90</iwxxm:minimumVisibilityDirection></iwxxm:AerodromeHorizontalVisibility></iwxxm:visibility>
      <iwxxm:rvr><iwxxm:AerodromeRunwayVisualRange pastTendency="UPWARD"><iwxxm:runway><aixm:RunwayDirection xmlns:aixm="http://www.aixm.aero/schema/5.1.1"><aixm:timeSlice><aixm:RunwayDirectionTimeSlice><aixm:designator>17L</aixm:designator></aixm:RunwayDirectionTimeSlice></aixm:timeSlice></aixm:RunwayDirection></iwxxm:runway><iwxxm:meanRVR uom="m">1600</iwxxm:meanRVR></iwxxm:AerodromeRunwayVisualRange></iwxxm:rvr>
      <iwxxm:rvr><iwxxm:AerodromeRunwayVisualRange pastTendency="NO_CHANGE"><iwxxm:runway><aixm:RunwayDirection xmlns:aixm="http://www.aixm.aero/schema/5.1.1"><aixm:timeSlice><aixm:RunwayDirectionTimeSlice><aixm:designator>16R</aixm:designator></aixm:RunwayDirectionTimeSlice></aixm:timeSlice></aixm:RunwayDirection></iwxxm:runway><iwxxm:meanRVR uom="m">600</iwxxm:meanRVR></iwxxm:AerodromeRunwayVisualRange></iwxxm:rvr>
      <iwxxm:presentWeather xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="http://codes.wmo.int/306/4678/+TSRA"/>
      <iwxxm:cloud><iwxxm:AerodromeCloud><iwxxm:layer><iwxxm:CloudLayer><iwxxm:amount xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="http://codes.wmo.int/49-2/CloudAmountReportedAtAerodrome/BKN"/><iwxxm:base uom="[ft_i]">500</iwxxm:base></iwxxm:CloudLayer></iwxxm:layer><iwxxm:layer><iwxxm:CloudLayer><iwxxm:amount xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="http://codes.wmo.int/49-2/CloudAmountReportedAtAerodrome/OVC"/><iwxxm:base uom="[ft_i]">1500</iwxxm:base></iwxxm:CloudLayer></iwxxm:layer></iwxxm:AerodromeCloud></iwxxm:cloud>
      <iwxxm:airTemperature uom="Cel">13</iwxxm:airTemperature><iwxxm:dewpointTemperature uom="Cel">7</iwxxm:dewpointTemperature><iwxxm:qnh uom="hPa">1018</iwxxm:qnh>
    `).replace(
    /<\/iwxxm:METAR>/,
    `  <iwxxm:trendForecast>
    <iwxxm:MeteorologicalAerodromeTrendForecast changeIndicator="BECOMING" cloudAndVisibilityOK="false">
      <iwxxm:phenomenonTime><gml:TimePeriod><gml:beginPosition>2026-10-05T00:00:00Z</gml:beginPosition><gml:endPosition>2026-10-05T01:30:00Z</gml:endPosition></gml:TimePeriod></iwxxm:phenomenonTime>
      <iwxxm:timeIndicator>UNTIL</iwxxm:timeIndicator>
      <iwxxm:prevailingVisibility uom="m">3000</iwxxm:prevailingVisibility>
    </iwxxm:MeteorologicalAerodromeTrendForecast>
  </iwxxm:trendForecast>
</iwxxm:METAR>`,
  );

  it("组级/元素级 span 切片＝源元素全体（captureMetaData 主路径）", () => {
    const r = parseMetar(full);
    if (r.wind?.kind !== "value") throw new Error("风组应有值");
    expect(at(full, r.wind.span)).toMatch(/^<iwxxm:surfaceWind>/);
    expect(at(full, r.wind.span)).toMatch(/<\/iwxxm:surfaceWind>$/);
    expect(at(full, r.wind.value.speed.span)).toBe(
      '<iwxxm:meanWindSpeed uom="[kn_i]">10</iwxxm:meanWindSpeed>',
    );
    // 扇区区间＝两端元素外包络：自 ccw 元素首至 cw 元素末（TAC 080V140 词组的 XML 同构落位）
    const varSpan = r.wind.value.variation?.span;
    if (varSpan === undefined) throw new Error("扇区区间缺席");
    expect(full.slice(varSpan.start, varSpan.end)).toMatch(
      /^<iwxxm:extremeCounterClockwiseWindDirection uom="deg">60<\/iwxxm:extremeCounterClockwiseWindDirection>/,
    );
    expect(full.slice(varSpan.start, varSpan.end)).toMatch(
      /<iwxxm:extremeClockwiseWindDirection uom="deg">140<\/iwxxm:extremeClockwiseWindDirection>$/,
    );
    if (r.visibility?.kind !== "value") throw new Error("能见度应有值");
    expect(at(full, r.visibility.value.span)).toBe(
      '<iwxxm:prevailingVisibility uom="m">800</iwxxm:prevailingVisibility>',
    );
    expect(at(full, r.visibility.value.minimum?.span)).toContain(
      '<iwxxm:minimumVisibility uom="m">600</iwxxm:minimumVisibility>',
    );
    expect(at(full, r.visibility.value.minimum?.span)).toContain(
      '<iwxxm:minimumVisibilityDirection uom="deg">90</iwxxm:minimumVisibilityDirection>',
    );
    // RVR：逐条区间各指本条 rvr 元素；Observed 组级＝外包络
    if (r.runwayVisualRange?.kind !== "value") throw new Error("RVR 应有值");
    const [first, second] = r.runwayVisualRange.value;
    expect(at(full, first?.span)).toMatch(
      /^<iwxxm:rvr><iwxxm:AerodromeRunwayVisualRange pastTendency="UPWARD">/,
    );
    expect(at(full, second?.span)).toMatch(/16R/);
    if (
      r.runwayVisualRange.span !== undefined &&
      first?.span !== undefined &&
      second?.span !== undefined
    ) {
      expect(r.runwayVisualRange.span.start).toBe(first.span.start);
      expect(r.runwayVisualRange.span.end).toBe(second.span.end);
    }
    // 天气组区间＝presentWeather 元素（含 4678 URI 全体）
    if (r.weather?.kind !== "value") throw new Error("天气应有值");
    expect(at(full, r.weather.value[0]?.span)).toBe(
      '<iwxxm:presentWeather xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="http://codes.wmo.int/306/4678/+TSRA"/>',
    );
    // 云层：逐层区间各指本层 CloudLayer
    const layers = r.clouds?.elements ?? [];
    expect(at(full, layers[0]?.span)).toContain("CloudAmountReportedAtAerodrome/BKN");
    expect(at(full, layers[1]?.span)).toContain("CloudAmountReportedAtAerodrome/OVC");
    expect(at(full, layers[1]?.span)).not.toContain("BKN");
    expect(at(full, r.temperature?.span)).toBe(
      '<iwxxm:airTemperature uom="Cel">13</iwxxm:airTemperature>',
    );
    expect(at(full, r.altimeter?.span)).toBe('<iwxxm:qnh uom="hPa">1018</iwxxm:qnh>');
  });

  it("趋势段：span＝trendForecast 元素；period 区间＝指示词至 phenomenonTime 包络（坍缩兜底）", () => {
    const r = parseMetar(full);
    const tr = r.trends[0];
    if (tr === undefined) throw new Error("趋势段缺席");
    expect(at(full, tr.span)).toMatch(/^<iwxxm:trendForecast>/);
    // timeIndicator 是无属性纯文本子元素（坍缩 string）——兜底检索须命中真元素而非别处
    const periodSpan = tr.period?.span;
    if (periodSpan === undefined) throw new Error("时段区间缺席");
    expect(full.slice(periodSpan.start, periodSpan.end)).toContain(
      "<iwxxm:timeIndicator>UNTIL</iwxxm:timeIndicator>",
    );
    expect(full.slice(periodSpan.start, periodSpan.end)).toContain("<iwxxm:phenomenonTime>");
    expect(tr.period?.text).toBe("TL0130");
  });

  it("cavokSpan＝观测开标签上的属性出现区间（趋势元素同名属性不误取）", () => {
    // 病态加强：趋势开标签也带同名属性（XML 合法——不同元素各带一次），观测/趋势两侧各指各的
    const hostile = full
      .replace(
        '<iwxxm:MeteorologicalAerodromeTrendForecast changeIndicator="BECOMING" cloudAndVisibilityOK="false"',
        '<iwxxm:MeteorologicalAerodromeTrendForecast changeIndicator="BECOMING" cloudAndVisibilityOK="true"',
      )
      .replace(
        'MeteorologicalAerodromeObservation cloudAndVisibilityOK="false"',
        'MeteorologicalAerodromeObservation cloudAndVisibilityOK="true"',
      );
    const h = parseMetar(hostile);
    expect(h.cavok).toBe(true);
    if (h.cavokSpan === undefined) throw new Error("cavokSpan 缺席");
    expect(hostile.slice(h.cavokSpan.start, h.cavokSpan.end)).toBe('cloudAndVisibilityOK="true"');
    // 落点＝观测开标签内的出现（文档中首个该属性出现处）
    expect(h.cavokSpan.start).toBe(hostile.indexOf("cloudAndVisibilityOK"));
    // 趋势 cavok 元素区间另指趋势开标签上的属性（位置严格在后）
    const trendCavokSpan = h.trends[0]?.elements?.cavok?.span;
    if (trendCavokSpan === undefined) throw new Error("趋势 cavok span 缺席");
    expect(hostile.slice(trendCavokSpan.start, trendCavokSpan.end)).toBe(
      'cloudAndVisibilityOK="true"',
    );
    expect(trendCavokSpan.start).toBeGreaterThan(h.cavokSpan.start);
  });

  it("对抗：同值文本跨父级多处出现——兜底检索锁定本父级内的出现（ZSPD 四 designator 同构形态）", () => {
    // 两条 RVR 的 designator 同文本（同跑道双向）；RVR 逐条区间互不越界（captureMetaData
    // 按节点定位，天然消歧）。坍缩兜底的跨父级消歧以无 uom 云底验证：
    const hostile = observation(`
      <iwxxm:cloud><iwxxm:AerodromeCloud>
        <iwxxm:layer><iwxxm:CloudLayer><iwxxm:base>200</iwxxm:base></iwxxm:CloudLayer></iwxxm:layer>
        <iwxxm:layer><iwxxm:CloudLayer><iwxxm:base>200</iwxxm:base></iwxxm:CloudLayer></iwxxm:layer>
      </iwxxm:AerodromeCloud></iwxxm:cloud>
    `);
    const r = parseMetar(hostile);
    const layers = r.clouds?.elements ?? [];
    expect(layers).toHaveLength(2);
    // 两层同值无属性云底（坍缩兜底）：各层高度位区间必须落在各自 CloudLayer 区间内
    const firstSpan = layers[0]?.span;
    const secondSpan = layers[1]?.span;
    const firstBase = layers[0]?.heightFt.span;
    const secondBase = layers[1]?.heightFt.span;
    if (firstSpan === undefined || secondSpan === undefined) throw new Error("层区间缺席");
    expect(firstSpan.end).toBeLessThan(secondSpan.start);
    expect(firstBase).toBeDefined();
    expect(secondBase).toBeDefined();
    if (firstBase !== undefined && secondBase !== undefined) {
      expect(firstBase.end).toBeLessThanOrEqual(firstSpan.end);
      expect(secondBase.start).toBeGreaterThanOrEqual(secondSpan.start);
      expect(at(hostile, firstBase)).toBe("<iwxxm:base>200</iwxxm:base>");
      expect(secondBase.start).toBeGreaterThan(firstBase.end); // 两次命中不同位置（按层内位置消歧）
    }
  });

  it("对抗：同名同文本子元素在同一父级重复出现——解析器取值为数组（不可辨），层按缺测收、层区间仍在（病态形态的行为锁）", () => {
    // fast-xml-parser 对重复键自动数组化（textChild 取不到单值）——高度位判缺测 null；
    // 层存在性看键在位（第三期修正：坍缩 string/数组形态不再导致整层蒸发），层区间照填
    const hostile = observation(
      `<iwxxm:cloud><iwxxm:AerodromeCloud>
        <iwxxm:layer><iwxxm:CloudLayer><iwxxm:base>200</iwxxm:base><iwxxm:base>200</iwxxm:base></iwxxm:CloudLayer></iwxxm:layer>
      </iwxxm:AerodromeCloud></iwxxm:cloud>`,
    );
    const r = parseMetar(hostile);
    expect(r.clouds?.elements).toHaveLength(1);
    const layer = r.clouds?.elements[0];
    if (layer === undefined) throw new Error("层缺席");
    expect(layer.kind).toBe("layer");
    if (layer.kind !== "layer") return;
    expect(layer.amount).toBeNull();
    expect(layer.heightFt.value).toBeNull();
    expect(layer.heightFt.span).toBeUndefined(); // 单值不可辨 → 高度位区间不填（不捏造）
    expect(at(hostile, layer.span)).toMatch(/^<iwxxm:CloudLayer>/);
  });

  it("collect 包裹（AWC 真实流形态）：span 索引含包裹层的完整 raw", () => {
    const wrapped = `<?xml version="1.0"?>
<collect:MeteorologicalBulletin xmlns:collect="http://def.wmo.int/metce/2014" xmlns:iwxxm="http://icao.int/iwxxm/2025-2" xmlns:gml="http://www.opengis.net/gml/3.2">
  <collect:meteorologicalInformation>
    <iwxxm:METAR reportStatus="NORMAL">
      <iwxxm:issueTime><gml:TimeInstant gml:id="w1"><gml:timePosition>2026-10-05T06:00:00Z</gml:timePosition></gml:TimeInstant></iwxxm:issueTime>
      <iwxxm:aerodrome><aixm:AirportHeliport xmlns:aixm="http://www.aixm.aero/schema/5.1.1"><aixm:timeSlice><aixm:AirportHeliportTimeSlice><aixm:locationIndicatorICAO>ZSPD</aixm:locationIndicatorICAO></aixm:AirportHeliportTimeSlice></aixm:timeSlice></aixm:AirportHeliport></iwxxm:aerodrome>
      <iwxxm:observationTime xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#w1"/>
      <iwxxm:observation><iwxxm:MeteorologicalAerodromeObservation cloudAndVisibilityOK="false"><iwxxm:airTemperature uom="Cel">23</iwxxm:airTemperature></iwxxm:MeteorologicalAerodromeObservation></iwxxm:observation>
    </iwxxm:METAR>
  </collect:meteorologicalInformation>
</collect:MeteorologicalBulletin>`;
    const r = parseMetar(wrapped);
    const t = r.temperature?.span;
    if (t === undefined) throw new Error("温度区间缺席");
    expect(wrapped.slice(t.start, t.end)).toBe(
      '<iwxxm:airTemperature uom="Cel">23</iwxxm:airTemperature>',
    );
  });

  it("紧凑模式 spans:false → 产物零 span 键（与 TAC 侧 parse 同契约）", () => {
    const r = parseMetar(full, { spans: false });
    const text = JSON.stringify(r);
    expect(text).not.toContain('"span"');
    expect(text).not.toContain('"cavokSpan"');
    expect(r.wind?.kind).toBe("value");
  });
});

// —— TAF 解析（v0.3 遗留项 1）：根 iwxxm:TAF → TafReport（与 TAC 侧 parseTaf 同一份 IR）。
// 合成边界形态在此；官方等价对双通道与 ECCC 真实流语料在 iwxxm-corpus.test.ts。

/** 最小合法 TAF 骨架（站名/发布时组/有效期/基况段体/变化组序列）——各用例在其上做定点变异。 */
const tafSkeleton = (body: string, changes = ""): string => `<?xml version="1.0"?>
<iwxxm:TAF xmlns:iwxxm="http://icao.int/iwxxm/2023-1" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:aixm="http://www.aixm.aero/schema/5.1.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" reportStatus="NORMAL" permissibleUsage="OPERATIONAL">
  <iwxxm:issueTime><gml:TimeInstant gml:id="i1"><gml:timePosition>2026-10-05T00:40:00Z</gml:timePosition></gml:TimeInstant></iwxxm:issueTime>
  <iwxxm:aerodrome><aixm:AirportHeliport><aixm:timeSlice><aixm:AirportHeliportTimeSlice><aixm:locationIndicatorICAO>ZSPD</aixm:locationIndicatorICAO></aixm:AirportHeliportTimeSlice></aixm:timeSlice></aixm:AirportHeliport></iwxxm:aerodrome>
  <iwxxm:validPeriod><gml:TimePeriod><gml:beginPosition>2026-10-05T01:00:00Z</gml:beginPosition><gml:endPosition>2026-10-05T13:00:00Z</gml:endPosition></gml:TimePeriod></iwxxm:validPeriod>
  <iwxxm:baseForecast>
    <iwxxm:MeteorologicalAerodromeForecast cloudAndVisibilityOK="false">
      <iwxxm:phenomenonTime><gml:TimePeriod><gml:beginPosition>2026-10-05T01:00:00Z</gml:beginPosition><gml:endPosition>2026-10-05T07:00:00Z</gml:endPosition></gml:TimePeriod></iwxxm:phenomenonTime>
      ${body}
    </iwxxm:MeteorologicalAerodromeForecast>
  </iwxxm:baseForecast>
  ${changes}
</iwxxm:TAF>`;

/** 基况段标配（风+能见度）——非相关用例的填充体。 */
const TAF_BASE_WIND_VIS = `<iwxxm:surfaceWind><iwxxm:AerodromeSurfaceWindForecast variableWindDirection="false"><iwxxm:meanWindDirection uom="deg">140</iwxxm:meanWindDirection><iwxxm:meanWindSpeed uom="[kn_i]">8</iwxxm:meanWindSpeed></iwxxm:AerodromeSurfaceWindForecast></iwxxm:surfaceWind><iwxxm:prevailingVisibility uom="m">10000</iwxxm:prevailingVisibility><iwxxm:prevailingVisibilityOperator>ABOVE</iwxxm:prevailingVisibilityOperator>`;

/** 变化组夹具（changeIndicator + 时窗 + 组内要素）。 */
const tafChange = (indicator: string, begin: string, end: string, inner: string): string =>
  `<iwxxm:changeForecast><iwxxm:MeteorologicalAerodromeForecast cloudAndVisibilityOK="false" changeIndicator="${indicator}"><iwxxm:phenomenonTime><gml:TimePeriod><gml:beginPosition>${begin}</gml:beginPosition><gml:endPosition>${end}</gml:endPosition></gml:TimePeriod></iwxxm:phenomenonTime>${inner}</iwxxm:MeteorologicalAerodromeForecast></iwxxm:changeForecast>`;

/** TAF 侧收窄：TAF 用例的 IR 断言入口（观测侧根在此即为夹具错置）。 */
const tafOf = (xml: string): TafReport => {
  const r = parseIwxxm(xml);
  if (r.kind !== "taf") throw new Error("预期 TAF IR，实得观测侧 IR——夹具错置");
  return r;
};

/** 宿主时区拨到 +8 再复原：旧实现按宿主本地时区解析（23:30 → 次日 07:30），UTC 折算后恒
 *  23:30——两读法在该时区下分得开，回归（退回 Date.parse 直读）即红。 */
const withTzShanghai = <T>(run: () => T): T => {
  const saved = process.env.TZ;
  process.env.TZ = "Asia/Shanghai";
  try {
    return run();
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
};

describe("timePosition 时区标记（无标记按 UTC 折算 + invalid-format(info) 告警）", () => {
  it("instantOf 路径（issueTime/observationTime 无标记）：UTC 折算 + 告警", () => {
    const r = withTzShanghai(() =>
      parseMetar(
        observation(
          '<iwxxm:surfaceWind><iwxxm:AerodromeSurfaceWind><iwxxm:meanWindSpeed uom="[kn_i]">8</iwxxm:meanWindSpeed></iwxxm:AerodromeSurfaceWind></iwxxm:surfaceWind>',
        ).replace("2026-10-05T00:00:00Z", "2026-10-05T23:30:00"),
      ),
    );
    expect(r.time).toEqual({ day: 5, hour: 23, minute: 30 });
    expect(
      r.warnings.some((w) => w.code === "invalid-format" && /无时区标记/.test(w.message)),
    ).toBe(true);
  });

  it("positionOf 路径（validPeriod 端点无标记）：UTC 折算 + 告警", () => {
    const r = withTzShanghai(() =>
      tafOf(
        tafSkeleton(TAF_BASE_WIND_VIS)
          .replace(
            "<gml:beginPosition>2026-10-05T01:00:00Z</gml:beginPosition>",
            "<gml:beginPosition>2026-10-05T23:00:00</gml:beginPosition>",
          )
          .replace(
            "<gml:endPosition>2026-10-05T13:00:00Z</gml:endPosition>",
            "<gml:endPosition>2026-10-06T11:00:00</gml:endPosition>",
          ),
      ),
    );
    expect(r.validity).toMatchObject({ startDay: 5, startHour: 23, endDay: 6, endHour: 11 });
    expect(
      r.warnings.some((w) => w.code === "invalid-format" && /无时区标记/.test(w.message)),
    ).toBe(true);
  });

  it("带 Z / 带 ±hh:mm 偏移：行为不变、零告警（带偏移的折 UTC 照旧）", () => {
    const z = withTzShanghai(() =>
      parseMetar(
        observation(
          '<iwxxm:surfaceWind><iwxxm:AerodromeSurfaceWind><iwxxm:meanWindSpeed uom="[kn_i]">8</iwxxm:meanWindSpeed></iwxxm:AerodromeSurfaceWind></iwxxm:surfaceWind>',
        ).replace("2026-10-05T00:00:00Z", "2026-10-05T23:30:00Z"),
      ),
    );
    expect(z.time).toEqual({ day: 5, hour: 23, minute: 30 });
    expect(z.warnings.some((w) => /无时区标记/.test(w.message))).toBe(false);
    const offset = withTzShanghai(() =>
      parseMetar(
        observation(
          '<iwxxm:surfaceWind><iwxxm:AerodromeSurfaceWind><iwxxm:meanWindSpeed uom="[kn_i]">8</iwxxm:meanWindSpeed></iwxxm:AerodromeSurfaceWind></iwxxm:surfaceWind>',
        ).replace("2026-10-05T00:00:00Z", "2026-10-06T07:30:00+08:00"),
      ),
    );
    expect(offset.time).toEqual({ day: 5, hour: 23, minute: 30 }); // 折 UTC（+8 → 前一日 23:30）
    expect(offset.warnings.some((w) => /无时区标记/.test(w.message))).toBe(false);
  });

  it("trendPeriodOf 兜底路径（UNTIL + 内联 TimePeriod 端点无标记）：UTC 折算 + 告警", () => {
    // 兜底路径＝instantOf 解不到 TimeInstant、落到 TimePeriod 端点直读（trendTimePeriod）——
    // 该端点同样经 UTC 折算单一出口，非 UTC 宿主下不再随宿主时区漂移
    const r = withTzShanghai(() =>
      parseMetar(
        observation(
          '<iwxxm:surfaceWind><iwxxm:AerodromeSurfaceWind><iwxxm:meanWindSpeed uom="[kn_i]">8</iwxxm:meanWindSpeed></iwxxm:AerodromeSurfaceWind></iwxxm:surfaceWind>',
        ).replace(
          /<\/iwxxm:METAR>/,
          `  <iwxxm:trendForecast>
            <iwxxm:MeteorologicalAerodromeTrendForecast changeIndicator="BECOMING" cloudAndVisibilityOK="false">
              <iwxxm:phenomenonTime><gml:TimePeriod><gml:beginPosition>2026-10-05T00:00:00Z</gml:beginPosition><gml:endPosition>2026-10-05T01:30:00</gml:endPosition></gml:TimePeriod></iwxxm:phenomenonTime>
              <iwxxm:timeIndicator>UNTIL</iwxxm:timeIndicator>
            </iwxxm:MeteorologicalAerodromeTrendForecast>
          </iwxxm:trendForecast>
        </iwxxm:METAR>`,
        ),
      ),
    );
    const trend = r.trends[0];
    if (trend === undefined || trend.kind === "nosig") throw new Error("趋势段缺席");
    expect(trend.period?.text).toBe("TL0130"); // UTC 折算（本地读法将误得 TL0930）
    expect(
      r.warnings.some((w) => w.code === "invalid-format" && /无时区标记/.test(w.message)),
    ).toBe(true);
  });
});

describe("TAF 解析（v0.3 遗留项 1：根 iwxxm:TAF → TafReport）", () => {
  it("报头三件：站名/发布时组/有效期（ddHH/ddHH 直投影 + 重建串）", () => {
    const r = tafOf(tafSkeleton(TAF_BASE_WIND_VIS));
    expect(r.kind).toBe("taf");
    expect(r.station).toBe("ZSPD");
    expect(r.issueTime).toEqual({ day: 5, hour: 0, minute: 40 });
    expect(r.validity).toMatchObject({ startDay: 5, startHour: 1, endDay: 5, endHour: 13 });
    expect(r.validity?.raw).toBe("0501/0513");
    expect(r.flags).toEqual({ amended: false, corrected: false });
    expect(r.nil).toBeUndefined();
    expect(r.cancelled).toBeUndefined();
  });
  it("基况段要素组：风（[kn_i]→kt）/能见度（10000+ABOVE→9999 阈值收敛）三态落位", () => {
    const r = tafOf(tafSkeleton(TAF_BASE_WIND_VIS));
    expect(r.wind).toMatchObject({
      kind: "value",
      value: { direction: 140, speed: { value: 8, unit: "kt" } },
    });
    expect(r.visibility?.kind).toBe("value");
    if (r.visibility?.kind === "value") {
      expect(r.visibility.value).toMatchObject({
        value: 9999,
        unit: "m",
        exact: false,
        beyond: "above",
      });
    }
    expect(r.cavok).toBe(false);
  });
  it("变化组四型：FROM→FM 硬时刻 / BECOMING→窗 / TEMPORARY_FLUCTUATIONS→TEMPO / PROBABILITY_30→PROB30", () => {
    const r = tafOf(
      tafSkeleton(
        TAF_BASE_WIND_VIS,
        tafChange("FROM", "2026-10-05T07:00:00Z", "2026-10-05T13:00:00Z", TAF_BASE_WIND_VIS) +
          tafChange("BECOMING", "2026-10-05T03:00:00Z", "2026-10-05T05:00:00Z", "") +
          tafChange("TEMPORARY_FLUCTUATIONS", "2026-10-05T02:00:00Z", "2026-10-05T04:00:00Z", "") +
          tafChange("PROBABILITY_30", "2026-10-05T04:00:00Z", "2026-10-05T06:00:00Z", ""),
      ),
    );
    expect(r.changes).toHaveLength(4);
    const [fm, becmg, tempo, prob] = r.changes;
    expect(fm?.kind).toBe("FM");
    expect(fm?.at).toMatchObject({ hour: 7, minute: 0 });
    expect(fm?.at?.raw).toBe("FM0700");
    expect(becmg?.kind).toBe("BECMG");
    expect(becmg?.window).toMatchObject({ startDay: 5, startHour: 3, endDay: 5, endHour: 5 });
    expect(becmg?.window?.raw).toBe("0503/0505");
    expect(tempo?.kind).toBe("TEMPO");
    expect(prob).toMatchObject({ kind: "PROB", probability: 30 });
    expect(prob?.withTempo).toBeUndefined();
  });
  it("PROBABILITY_30_TEMPORARY_FLUCTUATIONS → PROB30 TEMPO（withTempo 位）", () => {
    const r = tafOf(
      tafSkeleton(
        TAF_BASE_WIND_VIS,
        tafChange(
          "PROBABILITY_30_TEMPORARY_FLUCTUATIONS",
          "2026-10-05T04:00:00Z",
          "2026-10-05T06:00:00Z",
          "",
        ),
      ),
    );
    expect(r.changes[0]).toMatchObject({ kind: "PROB", probability: 30, withTempo: true });
  });
  it("未识别 changeIndicator → invalid-format(info) 出声按渐变收（不静默）", () => {
    const r = tafOf(
      tafSkeleton(
        TAF_BASE_WIND_VIS,
        tafChange("SOME_NEW_KIND", "2026-10-05T04:00:00Z", "2026-10-05T06:00:00Z", ""),
      ),
    );
    expect(r.changes[0]?.kind).toBe("BECMG");
    expect(r.warnings.some((w) => w.message.includes("changeIndicator 未识别"))).toBe(true);
  });
  it("气温预告（TX/TN 并载一元素）→ temperatures 按出现序展开 + M 负值重建", () => {
    const r = tafOf(
      tafSkeleton(
        TAF_BASE_WIND_VIS +
          `<iwxxm:temperature><iwxxm:AerodromeAirTemperatureForecast><iwxxm:maximumAirTemperature uom="Cel">26</iwxxm:maximumAirTemperature><iwxxm:maximumAirTemperatureTime><gml:TimeInstant><gml:timePosition>2026-10-05T20:00:00Z</gml:timePosition></gml:TimeInstant></iwxxm:maximumAirTemperatureTime><iwxxm:minimumAirTemperature uom="Cel">-3</iwxxm:minimumAirTemperature><iwxxm:minimumAirTemperatureTime><gml:TimeInstant><gml:timePosition>2026-10-06T02:00:00Z</gml:timePosition></gml:TimeInstant></iwxxm:minimumAirTemperatureTime></iwxxm:AerodromeAirTemperatureForecast></iwxxm:temperature>`,
      ),
    );
    expect(
      r.temperatures.map(({ extremum, celsius, at: atTime, raw }) => ({
        extremum,
        celsius,
        at: atTime,
        raw,
      })),
    ).toEqual([
      { extremum: "max", celsius: 26, at: { day: 5, hour: 20 }, raw: "TX26/0520Z" },
      { extremum: "min", celsius: -3, at: { day: 6, hour: 2 }, raw: "TNM03/0602Z" },
    ]);
  });
  it("CNL：isCancelReport + cancelledReportValidPeriod → cancelled:true，有效期保留，正文截断", () => {
    const cnl = `<?xml version="1.0"?>
<iwxxm:TAF xmlns:iwxxm="http://icao.int/iwxxm/2023-1" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:aixm="http://www.aixm.aero/schema/5.1.1" reportStatus="AMENDMENT" isCancelReport="true" permissibleUsage="OPERATIONAL">
  <iwxxm:issueTime><gml:TimeInstant gml:id="i1"><gml:timePosition>2026-10-08T02:04:00Z</gml:timePosition></gml:TimeInstant></iwxxm:issueTime>
  <iwxxm:aerodrome><aixm:AirportHeliport><aixm:timeSlice><aixm:AirportHeliportTimeSlice><aixm:locationIndicatorICAO>CYCO</aixm:locationIndicatorICAO></aixm:AirportHeliportTimeSlice></aixm:timeSlice></aixm:AirportHeliport></iwxxm:aerodrome>
  <iwxxm:cancelledReportValidPeriod><gml:TimePeriod><gml:beginPosition>2026-10-08T02:04:00Z</gml:beginPosition><gml:endPosition>2026-10-08T13:00:00Z</gml:endPosition></gml:TimePeriod></iwxxm:cancelledReportValidPeriod>
</iwxxm:TAF>`;
    const r = tafOf(cnl);
    expect(r.cancelled).toBe(true);
    expect(r.flags).toEqual({ amended: true, corrected: false });
    expect(r.validity).toMatchObject({ startDay: 8, startHour: 2, endDay: 8, endHour: 13 });
    expect(r.wind).toBeUndefined();
    expect(r.changes).toEqual([]);
  });
  it("NIL：baseForecast 空载属性元素（nilReason missing，官方对 DAOY 形态）→ nil:true 最小形态", () => {
    const nil = tafSkeleton("")
      .replace(/<iwxxm:validPeriod>.*<\/iwxxm:validPeriod>/s, "")
      .replace(
        /<iwxxm:baseForecast>.*<\/iwxxm:baseForecast>/s,
        '<iwxxm:baseForecast nilReason="http://codes.wmo.int/common/nil/missing"/>',
      );
    const r = tafOf(nil);
    expect(r.nil).toBe(true);
    expect(r.validity).toBeUndefined();
    expect(r.station).toBe("ZSPD");
    expect(r.issueTime).toEqual({ day: 5, hour: 0, minute: 40 });
    expect(r.changes).toEqual([]);
    expect(r.temperatures).toEqual([]);
  });
  it("版本：ECCC iwxxm 3.0 命名空间 → invalid-format(info) 出声 + 尽力解析（现网 TAF 主通道）", () => {
    const eccc = tafSkeleton(TAF_BASE_WIND_VIS).replace("iwxxm/2023-1", "iwxxm/3.0");
    const r = tafOf(eccc);
    const warn = r.warnings.find((w) => w.code === "invalid-format");
    expect(warn?.severity).toBe("info");
    expect(warn?.message).toContain("3.0");
    expect(r.station).toBe("ZSPD");
    expect(r.validity?.raw).toBe("0501/0513");
  });
  it("collect 包裹内 iwxxm:TAF（ECCC 真实流形态）→ 解析成功", () => {
    const wrapped = `<?xml version="1.0"?>
<collect:MeteorologicalBulletin xmlns:collect="http://def.wmo.int/collect/2014" xmlns:gml="http://www.opengis.net/gml/3.2">
  <collect:meteorologicalInformation>
    ${tafSkeleton(TAF_BASE_WIND_VIS).replace(/^<\?xml version="1\.0"\?>\n/, "")}
  </collect:meteorologicalInformation>
</collect:MeteorologicalBulletin>`;
    const r = tafOf(wrapped);
    expect(r.station).toBe("ZSPD");
    expect(r.changes).toEqual([]);
  });
  it("错误面：非 NIL/CNL 报缺 validPeriod → missing-validity；issueTime 缺失 → missing-time", () => {
    const noValidity = tafSkeleton(TAF_BASE_WIND_VIS).replace(
      /<iwxxm:validPeriod>.*<\/iwxxm:validPeriod>/s,
      "",
    );
    expect(parseErrorOf(noValidity).code).toBe("missing-validity");
    const badValidity = tafSkeleton(TAF_BASE_WIND_VIS).replace(
      "<gml:beginPosition>2026-10-05T01:00:00Z</gml:beginPosition>",
      '<gml:beginPosition indeterminatePosition="before"/>',
    );
    expect(parseErrorOf(badValidity).code).toBe("missing-validity");
    const noIssue = tafSkeleton(TAF_BASE_WIND_VIS).replace(
      /<iwxxm:issueTime>.*<\/iwxxm:issueTime>/s,
      "",
    );
    expect(parseErrorOf(noIssue).code).toBe("missing-time");
  });
  it("CAVOK：基况段 cloudAndVisibilityOK=true → 三组让位（在位即矛盾出声）", () => {
    const cavokXml = tafSkeleton(
      TAF_BASE_WIND_VIS +
        '<iwxxm:cloud><iwxxm:AerodromeCloudForecast><iwxxm:layer><iwxxm:CloudLayer><iwxxm:amount xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="http://codes.wmo.int/49-2/CloudAmountReportedAtAerodrome/BKN"/><iwxxm:base uom="[ft_i]">500</iwxxm:base></iwxxm:CloudLayer></iwxxm:layer></iwxxm:AerodromeCloudForecast></iwxxm:cloud>',
    ).replace('cloudAndVisibilityOK="false"', 'cloudAndVisibilityOK="true"');
    const r = tafOf(cavokXml);
    expect(r.cavok).toBe(true);
    expect(r.visibility).toBeUndefined();
    expect(r.clouds).toBeUndefined();
    expect(r.warnings.some((w) => w.code === "cross-check-conflict")).toBe(true);
  });
  it("ECCC SKC 云量位层形态（云量 SKC + 云底 nil）→ clear 电码收下（层形态三轨之一）", () => {
    const skcXml = tafSkeleton(
      '<iwxxm:cloud><iwxxm:AerodromeCloudForecast><iwxxm:layer><iwxxm:CloudLayer><iwxxm:amount xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="http://codes.wmo.int/49-2/CloudAmountReportedAtAerodrome/SKC"/><iwxxm:base uom="N/A" xsi:nil="true" nilReason="http://codes.wmo.int/common/nil/inapplicable"/></iwxxm:CloudLayer></iwxxm:layer></iwxxm:AerodromeCloudForecast></iwxxm:cloud>',
    );
    const r = tafOf(skcXml);
    expect(r.clouds).toMatchObject({ elements: [], clear: { code: "SKC" } });
  });
  it("基况段天气 nil（nothingOfOperationalSignificance）→ 组省略 + info（TAC 基况语汇无 NSW 位）", () => {
    const nswXml = tafSkeleton(
      TAF_BASE_WIND_VIS +
        '<iwxxm:weather nilReason="http://codes.wmo.int/common/nil/nothingOfOperationalSignificance"/>',
    );
    const r = tafOf(nswXml);
    expect(r.weather).toBeUndefined();
    expect(r.warnings.some((w) => w.message.includes("NSW"))).toBe(true);
  });
  it("spans:false 紧凑模式同供（TAF 出口同走 compactNode）", () => {
    const full = tafSkeleton(TAF_BASE_WIND_VIS);
    const compacted = tafOf(full);
    const compactJson = JSON.stringify(parseIwxxm(full, { spans: false }));
    expect(JSON.stringify(compacted)).toContain('"span"');
    expect(compactJson).not.toContain('"span"');
    expect(compactJson).not.toContain('"cavokSpan"');
  });
  it("span 不变量：validity/变化组组级区间切片＝property wrapper 元素形态", () => {
    const xml = tafSkeleton(
      TAF_BASE_WIND_VIS,
      tafChange("BECOMING", "2026-10-05T03:00:00Z", "2026-10-05T05:00:00Z", TAF_BASE_WIND_VIS),
    );
    const r = tafOf(xml);
    const vs = r.validity?.span;
    if (vs === undefined) throw new Error("有效期区间缺席");
    expect(xml.slice(vs.start, vs.start + 1)).toBe("<");
    expect(xml.slice(vs.start, vs.end)).toContain("<gml:beginPosition>");
    const cs = r.changes[0]?.span;
    if (cs === undefined) throw new Error("变化组区间缺席");
    expect(xml.slice(cs.start, cs.start + 1)).toBe("<");
    expect(xml.slice(cs.start, cs.end)).toMatch(/^<iwxxm:changeForecast>/);
    expect(xml.slice(cs.start, cs.end)).toMatch(/<\/iwxxm:changeForecast>$/);
  });
  it("变化组 raw 重建串（结构化字段 → TAC 形态，非原文口径）", () => {
    const r = tafOf(
      tafSkeleton(
        TAF_BASE_WIND_VIS,
        tafChange(
          "FROM",
          "2026-10-05T08:00:00Z",
          "2026-10-05T13:00:00Z",
          '<iwxxm:surfaceWind><iwxxm:AerodromeSurfaceWindForecast variableWindDirection="false"><iwxxm:meanWindDirection uom="deg">180</iwxxm:meanWindDirection><iwxxm:meanWindSpeed uom="[kn_i]">12</iwxxm:meanWindSpeed><iwxxm:windGustSpeed uom="[kn_i]">22</iwxxm:windGustSpeed></iwxxm:AerodromeSurfaceWindForecast></iwxxm:surfaceWind>',
        ),
      ),
    );
    expect(r.changes[0]?.raw).toBe("FM0800 18012G22KT");
  });
});
