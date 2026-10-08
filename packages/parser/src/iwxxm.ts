/**
 * @metweave/parser/iwxxm — IWXXM→IR 解析层：把 IWXXM（2023-1 / 2025-2 双目标版）METAR/SPECI
 * XML 文档解析为与 TAC 侧 `parse` 同一份的 MetarReport IR；TAF 文档解析为与 TAC 侧 `parseTaf`
 * 同一份的 TafReport IR（按根元素分派，kind 位即判别器）。
 *
 * 范围（v0.3 alpha，2026-10-05 owner 定案：IWXXM→IR 先行，IR→IWXXM 留二期；
 * TAF 原留 W43 二期，2026-10-08 提前施工——v0.3 遗留项 1 完结）：
 * - METAR/SPECI（根元素二选一定 ReportKind）与 TAF（→ TafReport）；SIGMET 等其他产品族
 *   整体失败（invalid-input）；
 * - 目标 schema 版本 2023-1 与 2025-2（命名空间 URI 尾段识别，两版观测容器同构——见
 *   observationBodyOf；TAF 侧三版 XSD 逐行同构，见 docs/iwxxm-notes.md §九；2025-2 真实流实证源＝
 *   NOAA AWC aviationweather.gov），其余版本（含 ECCC 3.0 国家扩展流实测形态——TAF 现网主通道）
 *   探测出命名空间后尽力解析 + invalid-format(info) 出声；
 * - 未知元素/属性跳过 + unknown-token(info) 出声，绝不静默（与 TAC 侧同一纪律）。
 *
 * 语义映射底档：docs/iwxxm-notes.md（D0 schema 复核结论表——2023-1/2025-2 XSD 原文 +
 * wmo-im/iwxxm-translation Amd79-80-2023 官方等价对 + AWC 2025-2 实时流三方实证；TAF 施工节 §九——
 * taf.xsd 三版 diff + Amd79-80-2023/taf 官方等价对 7 站 + ECCC 真实流多方实证）；关键映射：
 * - CAVOK ＝ 观测必填布尔属性 cloudAndVisibilityOK（true 时 vis/weather/cloud 让位，与 IR 让位契约同构）；
 * - RVR 趋势 ＝ AerodromeRunwayVisualRange@pastTendency（UPWARD/DOWNWARD/NO_CHANGE →
 *   up/down/no-change；MISSING_VALUE → 无趋势位）；超限 ＝ meanRVROperator ABOVE/BELOW → beyondRange；
 * - VRB ＝ surfaceWind@variableWindDirection 且无 meanWindDirection（带扇区 080V140 时译文也置 true
 *   但保留均值方向——此时 IR variable=false、方向入 direction、扇区入 variation）；
 * - 无云族 ＝ cloud 元素 nilReason 承载（nothingOfOperationalSignificance→NSC、
 *   notDetectedByAutoSystem→NCD，四码细辨不可还原，info 出声）；AWC 2025-2 转换器对无云族
 *   （CLR/NSC/CAVOK）输出空 AerodromeCloud 容器（无层/无垂直能见度/无 nilReason）——
 *   细辨不可还原，按组省略收下 + info 出声；ECCC 真实流另见 SKC 云量位层形态（cloudsOf 内注）；
 * - OVX 云量（天空不明，49-2 云量电码表）＝VV 形态：AWC 转换把 TAC VV 落成 OVX+base 层
 *   （KCRW VV001→OVX/100ft 实证），IR 同构落 vertical-visibility（与 2023-1 官方译文用
 *   verticalVisibility 元素的落位一致）；
 * - NOSIG ＝ trendForecast xsi:nil + noSignificantChange；趋势内 NSW ＝ weather nil
 *   nothingOfOperationalSignificance；
 * - 单位跟组走：uom 属性逐元素判读（m/s / [kn_i] / km/h / m / [ft_i] / hPa / inHg / deg / Cel / mm），
 *   米制云高/VV 换算英尺入 IR（IR 云高以英尺计）；
 * - 时间 ＝ gml:TimeInstant 绝对时刻（含 xlink:href 文档内引用，多指向 issueTime 的同一定义），
 *   UTC 折 ddHHMM 填 IR ReportTime（IR 无年月位，跨月语境由消费方自理——与 TAC 对称的损失）。
 *
 * TAF 侧（v0.3 遗留项 1，→ TafReport）：根 iwxxm:TAF / collect 包裹内 iwxxm:TAF（ECCC 现网形态）。
 * - 有效期 ＝ validPeriod gml:TimePeriod（begin/end 绝对时刻折 ddHH/ddHH 直投影，止时恒 00–23——
 *   TAC 止时 24 午夜特例不再重编，两态等价）；CNL ＝ @isCancelReport + cancelledReportValidPeriod
 *   （译文把被取消窗起点归一化为发报时刻——官方对 EHLW 与 ECCC 实流两方一致，快照口径）；
 * - NIL ＝ baseForecast 缺席或空载属性元素（官方对 DAOY 实证形态：nilReason missing 无内层）；
 * - 变化组 ＝ changeForecast@changeIndicator：FROM→FM（at＝phenomenonTime 起点）、BECOMING→BECMG、
 *   TEMPORARY_FLUCTUATIONS→TEMPO、PROBABILITY_30/40→PROB（连 TEMPORARY_FLUCTUATIONS → withTempo）；
 *   窗口＝phenomenonTime TimePeriod 折 ddHH/ddHH（XSD 明文：TAC FM/TL/AT 由 phenomenonTime 承载）；
 * - 气温组 ＝ baseForecast 的 AerodromeAirTemperatureForecast（maximum/minimumAirTemperature +
 *   Time 时刻，uom Cel）→ IR temperatures（TX/TN 按出现序：XML 最大值元素在前）；
 * - 基况/变化组要素复用 METAR 侧同一套件（surfaceWindOf/visibilityOf/cloudsOf/天气 4678 切解）。
 *
 * raw 保真口径：report.raw ＝输入 XML 原文（IWXXM 侧的「原文」即 XML）；TafReport 的 validity.raw /
 * change.raw / at.raw / window.raw / temperatures[].raw ＝由结构化字段重建的 TAC 形态串
 * （如 "1312/1412"、"BECMG 1314/1316 36014KT 9999 FEW018"）——XML 侧本无 TAC 原文，重建串仅供
 * RAW 视图阅读，不承诺与官方 TAC 逐字符一致（与 METAR 侧 trend.raw 同一口径声明）。
 *
 * span 口径（v0.3 第三期）：IR 值字段的 span ＝该值源元素（或源属性）在 raw（XML 原文）中的
 * UTF-16 半开区间——与 TAC 侧「span 即 raw 的字符区间」同一契约，raw 的语义随通道而异
 * （TAC＝字符电码词位 / IWXXM＝XML 元素区间，见 core ir.ts Span 注释）。定位主路径＝
 * fast-xml-parser 5.11.2 的 captureMetaData（元素级 [startIndex, endIndex) 直取）；无属性纯文本
 * 子元素被解析器折叠成 string 丢元数据，走「父区间内按标签+文本检索」兜底（消歧见
 * childTextSpanOf）。值类布尔属性（cloudAndVisibilityOK）按属性出现区间。填不到的字段如实
 * 留空（span 可选契约，消费方优雅降级）。
 *
 * 告警面：不新增 WarningCode（core 契约零改动）——复用 TAC 侧五码：未知/无位元素 →
 * unknown-token(info)；版本非目标、nilReason 选词未识别、uom 未识别等结构异常 →
 * invalid-format(info)；数值越界 → value-out-of-range(warning)；元素 xsi:nil 的三态组 →
 * missing-expected(info)；CAVOK 与让位组并存等自洽性疑点 → cross-check-conflict(warning)。
 */
import type {
  AltimeterReading,
  CloudCondition,
  CloudElement,
  MetarReport,
  ParseWarning,
  ReportKind,
  RunwayStateGroup,
  RunwayVisualRange,
  SkyClearCode,
  Span,
  TafChangeAt,
  TafChangeGroup,
  TafChangeKind,
  TafChangeWindow,
  TafReport,
  TafTemperatureGroup,
  TafValidityGroup,
  TemperatureReading,
  TrendGroup,
  VisibilityGroup,
  WeatherGroup,
  WindGroup,
} from "@metweave/core";
import { MetarParseError } from "@metweave/core";
import { XMLParser } from "fast-xml-parser";
import { compactNode, parseWeatherBody } from "./groups";

/** XML 文档对象（fast-xml-parser 产物：元素键 + "@_" 前缀属性键 + "#text" 文本键）。 */
type XNode = Record<string, unknown>;

/**
 * Options for `parseIwxxm`: tolerance mode and span carriage (mirrors METAR-side `parse`;
 * strict 校验是路线图项).
 * parseIwxxm 的选项：容忍模式位与 span 携带（与 METAR 侧 parse 同款；strict 留给后续校验层）。
 */
export interface IwxxmParseOptions {
  /** 缺省 tolerant；strict 尚未实现（显式传入即 unsupported-mode 抛错，不静默降级） */
  readonly mode?: "tolerant" | "strict";
  /** 同 ParseOptions.spans：false = 紧凑模式剥除全部 span（第三期起 IWXXM 侧携带 span，本位对齐 TAC 契约） */
  readonly spans?: boolean;
}

// ---------------------------------------------------------------- 解析器与选项固化

/** 可重复元素清单——一律以数组落位（fast-xml-parser 缺省单例折叠会吞掉多组 RVR/云层/趋势）。
 *  注意 timeSlice 不在其列：每个父节点恰一个快照，数组化反而破坏导航。 */
const REPEATABLE_TAGS: ReadonlySet<string> = new Set([
  "rvr",
  "presentWeather",
  "recentWeather",
  "runwayState",
  "trendForecast",
  "layer",
  "runway",
  "meteorologicalInformation",
  "extension",
]);

/**
 * 解析选项显式固化（契约面：uom/nilReason/xlink/gml:id 全在属性里，ignoreAttributes 必须 false；
 * removeNSPrefix 连属性前缀一并剥离——gml:id→@_id、xlink:href→@_href、xsi:nil→@_nil）。
 * 数值一律以字符串落位（parseTagValue false），由本层显式转换——避免精度/进制暗改。
 * captureMetaData：元素节点携带源区间元数据（span 定位主路径，见文件头 span 口径段）。
 */
const PARSER_OPTIONS = {
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  captureMetaData: true,
  isArray: (name: string): boolean => REPEATABLE_TAGS.has(name),
} as const;

/**
 * 模块级单例：fast-xml-parser 的 parse() 无跨调用状态，实例可复用——批量语料回放
 * （一批 40+ 站）免逐报重建解析器实例。
 */
const PARSER = new XMLParser(PARSER_OPTIONS);

// ---------------------------------------------------------------- 命名空间与 nil 词汇

/** 支持版本（命名空间 URI 尾段；XSD 实证两版观测容器同构，字段解析共用一套）。
 *  2023-1＝wmo-im/iwxxm-translation Amd79-80-2023 官方等价对；2025-2＝NOAA AWC 实时流
 *  （schemas.wmo.int/iwxxm/2025-2RC1，转换中心 KKCI/NWS AWC）。 */
const SUPPORTED_VERSIONS: ReadonlySet<string> = new Set(["2023-1", "2025-2"]);
/** 消息面用的版本清单字样。 */
const SUPPORTED_VERSION_TEXT = "2023-1/2025-2";
/** 文档内一切 xmlns 声明 → 提取 IWXXM 家族 URI（前缀名任意，含缺省命名空间）。 */
const NS_DECLARATION = /xmlns(?::[A-Za-z_][\w.-]*)?="([^"]+)"/g;
const IWXXM_NS = /^https?:\/\/icao\.int\/iwxxm\/([^"/]+)\/?$/i;

/** WMO 通用 nil 词汇（样例实证全 URI 形态；词尾即语义键）。 */
const NIL_NOTHING_OF_OPERATIONAL_SIGNIFICANCE = "nothingOfOperationalSignificance";
const NIL_NOT_DETECTED_BY_AUTO_SYSTEM = "notDetectedByAutoSystem";
const NIL_NO_SIGNIFICANT_CHANGE = "noSignificantChange";
/** 样例实证出现过的全部词（未识别词出声不静默，语义按「缺测」收）。 */
const KNOWN_NIL_WORDS: ReadonlySet<string> = new Set([
  NIL_NOTHING_OF_OPERATIONAL_SIGNIFICANCE,
  NIL_NOT_DETECTED_BY_AUTO_SYSTEM,
  NIL_NO_SIGNIFICANT_CHANGE,
  "missing",
  "unknown",
  "inapplicable",
  "withheld",
  "notObservable",
]);

/** nilReason 词提取（容忍全 URI 与裸词两种形态）。 */
const nilWordOf = (raw: string | undefined): string | undefined => {
  if (raw === undefined) return undefined;
  const tail = raw.split("/").pop() ?? raw;
  return tail.length > 0 ? tail : undefined;
};

/** 未识别 nilReason 词的统一出声（不静默纪律：选词即语义，语义不明的缺测须可观测）。 */
function warnUnknownNil(
  where: string,
  word: string | undefined,
  warnings: ParseWarning[],
  span?: Span,
): void {
  if (word !== undefined && !KNOWN_NIL_WORDS.has(word)) {
    warnings.push({
      code: "invalid-format",
      severity: "info",
      message: `${where} nilReason 选词未识别（${word}）——按缺测/无观测收下`,
      ...(span !== undefined ? { span } : {}),
    });
  }
}

// ---------------------------------------------------------------- uom 词表（D0 ⑦ 实证串）

const SPEED_UOM: Readonly<Record<string, WindGroup["speed"]["unit"]>> = {
  "m/s": "mps",
  "[kn_i]": "kt",
  "km/h": "kmh",
};
const PRESSURE_UOM: Readonly<Record<string, AltimeterReading["unit"]>> = {
  hPa: "hPa",
  inHg: "inHg",
};
const RVR_UNIT: Readonly<Record<string, RunwayVisualRange["unit"]>> = { m: "m", "[ft_i]": "ft" };
/** 米→英尺（IR 云高/VV 以英尺计；换算四舍五入——TAC 云高本就百英尺粒度）。 */
const mToFt = (m: number): number => Math.round(m * 3.28084);
/** 风向八方位词（TAC 最低能见度方向组是 N/NE/… 词，XML 侧是度数）。 */
const DIR_8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
const dirWordOf = (deg: number): (typeof DIR_8)[number] => DIR_8[Math.round(deg / 45) % 8] ?? "N";

// ---------------------------------------------------------------- 数值门（与 TAC 侧同判据）

const QNH_HPA_MIN = 800;
const QNH_HPA_MAX = 1084;
const ALT_INHG_MIN = 23.5;
const ALT_INHG_MAX = 32.5;
const TEMP_C_MIN = -90;
const TEMP_C_MAX = 60;

// ---------------------------------------------------------------- 节点取值小件

const isObj = (x: unknown): x is XNode => typeof x === "object" && x !== null && !Array.isArray(x);
const firstOf = (x: unknown): unknown => (Array.isArray(x) ? x[0] : x);
/** 属性键统一走 "@_"（removeNSPrefix 已剥前缀：xlink:href→@_href、gml:id→@_id、xsi:nil→@_nil）。 */
const attr = (node: XNode | undefined, name: string): string | undefined => {
  const v = node?.[`@_${name}`];
  return typeof v === "string" ? v : undefined;
};
const child = (node: XNode | undefined, key: string): unknown => node?.[key];
const objChild = (node: XNode | undefined, key: string): XNode | undefined => {
  const v = child(node, key);
  return isObj(v) ? v : undefined;
};
/** 首元素对象访问：可重复标签（runway 等）被数组化后，取首个元素——多值场景由调用方自行遍历。 */
const objChildFirst = (node: XNode | undefined, key: string): XNode | undefined => {
  const v = firstOf(child(node, key));
  return isObj(v) ? v : undefined;
};
const textChild = (node: XNode | undefined, key: string): string | undefined => {
  const v = child(node, key);
  if (typeof v === "string") return v;
  if (isObj(v)) {
    const t = v["#text"];
    return typeof t === "string" ? t : undefined;
  }
  return undefined;
};
/** 子节点数值（元素体或 {#text,uom} 混合体的文本值）。 */
const numChild = (node: XNode | undefined, key: string): number | undefined => {
  const text = textChild(node, key);
  if (text === undefined) return undefined;
  const v = Number(text);
  return Number.isFinite(v) ? v : undefined;
};
const isNil = (node: XNode | undefined): boolean => attr(node, "nil") === "true";
/**
 * nil 属性元素判别（两形态同收）：xsi:nil="true"（观测/RVR 侧主流形态）与仅带 nilReason 的空载
 * 属性元素（TAF 官方对 SARP/OIZC 的 nil 云、DAOY 的 NIL 报 baseForecast 实证——无 xsi:nil）。
 * 语义等价：property wrapper 无内层语义体 + 词汇缺测声明。
 */
const isNilProp = (node: XNode | undefined): boolean =>
  isNil(node) || attr(node, "nilReason") !== undefined;
/** xlink:href 尾段（电码表条目键，如 …/4678/+TSRA → "+TSRA"；URL 解码容忍 %2B 形态）。 */
const codeTailOf = (node: XNode | undefined): string | undefined => {
  const href = attr(node, "href");
  if (href === undefined) return undefined;
  const segments = href.split("/");
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const seg = segments[i];
    if (seg !== undefined && seg.length > 0) return decodeURIComponent(seg);
  }
  return undefined;
};

// ---------------------------------------------------------------- 源定位（span 载体，第三期）

/**
 * captureMetaData 元数据的取用键（XMLParser 静态符号——Node/浏览器均有 Symbol，直取）。
 * 第三方类型面把 symbol 原语标注为 Symbol 接口，反射键需收窄回原语类型。
 */
// oxlint-disable-next-line no-unsafe-type-assertion
const META_KEY: symbol = XMLParser.getMetaDataSymbol() as symbol;

/**
 * 元素节点的源区间（captureMetaData 主路径）：[startIndex, endIndex) 覆盖元素全体（开标签至
 * 闭合标签，自闭合元素含 "/>"）。非对象节点 / 无元数据 / 区间退化 → undefined。
 * 取值走 Reflect.get（符号键无字符串索引可用），形状经运行时判别收窄——零类型断言。
 */
const spanOf = (node: unknown): Span | undefined => {
  if (!isObj(node)) return undefined;
  const md: unknown = Reflect.get(node, META_KEY);
  if (!isObj(md)) return undefined;
  const start: unknown = md["startIndex"];
  const end: unknown = md["endIndex"];
  if (typeof start === "number" && typeof end === "number" && end > start) {
    return { start, end };
  }
  return undefined;
};

/** RegExp 特殊字符转义（标签名/文本/属性值进正则前的统一出口）。 */
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 最小实体解码（与 fast-xml-parser 的 processEntities 同词表——兜底检索的文本比对用）。 */
const decodeEntities = (text: string): string => {
  let out = text;
  for (const [re, rep] of [
    [/&lt;/g, "<"],
    [/&gt;/g, ">"],
    [/&quot;/g, '"'],
    [/&apos;/g, "'"],
    [/&amp;/g, "&"],
  ] as const) {
    out = out.replace(re, rep);
  }
  return out;
};

/**
 * 无属性纯文本子元素的兜底定位：fast-xml-parser 把 `<tag>text</tag>`（无属性）折叠成 string，
 * 元数据随之丢失——在宿主元素区间内按「标签名（命名空间前缀任意）+ 文本内容」检索该元素全体。
 * 消歧：同名同文本在宿主内多处出现时按出现序数（ordinal，缺省首个）；文本不符的匹配不计数
 * （同名异文本不构成歧义）；检索越出宿主区间即止（同名元素在其他父级下不误取）。找不到 →
 * undefined，调用方如实留空该 span。
 */
const childTextSpanOf = (
  raw: string,
  host: Span | undefined,
  tag: string,
  text: string,
  ordinal = 0,
): Span | undefined => {
  if (host === undefined) return undefined;
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${escapeRegExp(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${escapeRegExp(tag)}\\s*>`,
    "g",
  );
  re.lastIndex = host.start;
  let hit = 0;
  for (let m = re.exec(raw); m !== null; m = re.exec(raw)) {
    const closeEnd = m.index + m[0].length;
    if (closeEnd > host.end) break; // 越出宿主区间（含闭合标签跨界）——其他父级下的同名元素不取
    if (decodeEntities(m[1] ?? "").trim() === text.trim()) {
      if (hit === ordinal) return { start: m.index, end: closeEnd };
      hit += 1;
    }
  }
  return undefined;
};

/**
 * 子元素区间（两路合一）：对象子元素直取元数据；坍缩成 string 的纯文本子元素走兜底检索。
 * （IWXXM 值元素带 uom/xlink 属性时恒为对象——兜底实际命中面：timeIndicator、designator 等词元素。）
 */
const childSpanOf = (
  raw: string,
  parent: XNode | undefined,
  key: string,
  text?: string,
): Span | undefined => {
  const direct = objChild(parent, key);
  if (direct !== undefined) return spanOf(direct);
  const value = text ?? textChild(parent, key);
  return value === undefined ? undefined : childTextSpanOf(raw, spanOf(parent), key, value);
};

/**
 * 值类布尔属性的源区间（cloudAndVisibilityOK 等）：元素开标签内检索 `name="value"`（单双引号
 * 皆容）。区间即属性出现本身——RAW 联动高亮落在该属性上（与 TAC 侧 CAVOK 词位同构的可见性）。
 */
const attrSpanOf = (
  raw: string,
  host: Span | undefined,
  name: string,
  value: string,
): Span | undefined => {
  if (host === undefined) return undefined;
  // 开标签终点＝首个不在引号内的 ">"（XML 属性值合法含 ">"，裸 indexOf 会把引号内的
  // ">" 误当标签结束、截短检索窗——见属性值含 > 的回归测试）
  let openEnd = -1;
  let quote = "";
  for (let i = host.start; i < host.end; i += 1) {
    const ch = raw[i];
    if (quote !== "") {
      if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ">") {
      openEnd = i;
      break;
    }
  }
  if (openEnd < 0) return undefined;
  const m = new RegExp(`${escapeRegExp(name)}\\s*=\\s*(["'])${escapeRegExp(value)}\\1`).exec(
    raw.slice(host.start, openEnd),
  );
  return m === null
    ? undefined
    : { start: host.start + m.index, end: host.start + m.index + m[0].length };
};

/** 外包络（多元素组组级 span / 双元素合成组用——契约见 core Span 注释：首组首至末组末）。 */
const envelopeOf = (...spans: Array<Span | undefined>): Span | undefined => {
  const list = spans.filter((s): s is Span => s !== undefined);
  if (list.length === 0) return undefined;
  return {
    start: Math.min(...list.map((s) => s.start)),
    end: Math.max(...list.map((s) => s.end)),
  };
};
/** 跑道设计器：RunwayDirection→timeSlice→RunwayDirectionTimeSlice→designator（SNAPSHOT 快照）；
 *  支持 xlink:href="#gml:id" 文档内引用（runwayState 复用 RVR 段定义的 RunwayDirection——URMT 官方对实证）。 */
function runwayDesignatorOf(
  runwayNode: XNode | undefined,
  gmlIds: Map<string, XNode>,
): string | undefined {
  if (runwayNode === undefined) return undefined;
  const href = attr(runwayNode, "href");
  const resolved =
    href !== undefined && href.startsWith("#") ? gmlIds.get(href.slice(1)) : undefined;
  const node = resolved ?? runwayNode;
  // 引用目标既可能是 RunwayDirection 本体（URMT 形态），也可能是包着它的容器（内联形态）
  const dir =
    objChildFirst(node, "RunwayDirection") ??
    (objChild(node, "timeSlice") !== undefined ? node : undefined);
  if (dir === undefined) return undefined;
  const ts = objChild(dir, "timeSlice");
  const slice = objChild(ts, "RunwayDirectionTimeSlice");
  return textChild(slice, "designator") ?? textChild(ts, "designator");
}

// ---------------------------------------------------------------- 时间

/** gml:id 索引：文档内 xlink:href="#id" 引用解析（observationTime 通常引用 issueTime 的 TimeInstant）。 */
function indexGmlIds(root: XNode, map: Map<string, XNode> = new Map()): Map<string, XNode> {
  for (const [key, value] of Object.entries(root)) {
    if (key.startsWith("@_")) continue;
    if (Array.isArray(value)) {
      for (const item of value) if (isObj(item)) indexGmlIds(item, map);
    } else if (isObj(value)) {
      const id = attr(value, "id");
      if (id !== undefined) map.set(id, value);
      indexGmlIds(value, map);
    }
  }
  return map;
}

/**
 * 无时区标记检测（ISO 8601 尾缀 Z / ±hh:mm / ±hhmm / ±hh——缺席即无标记）。
 * 无标记的 dateTime（如 2026-10-05T23:30:00）经 Date.parse 按宿主本地时区解释——跨机器
 * IR 非确定（WMO 时间量本应全 UTC），故按 UTC 折算并向 warnings 记一条 info 告警。
 */
const ZONE_MARKED_RE = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/;

/** timePosition 字串 → UTC 毫秒（单一出口）：无时区标记时按 UTC 解析（确定性）并向
 *  warnings 记账；带 Z/偏移的字串走 Date.parse 原路径，行为不变。 */
function parseTimePositionMs(pos: string, where: string, warnings: ParseWarning[]): number {
  if (!ZONE_MARKED_RE.test(pos)) {
    warnings.push({
      code: "invalid-format",
      severity: "info",
      message: `${where} 无时区标记（${pos}）——按 UTC 折算收下`,
    });
    return Date.parse(`${pos}Z`);
  }
  return Date.parse(pos);
}

/**
 * 解析 gml:TimeInstant/gml:timePosition 绝对时刻（ISO 8601，可带时差；折 UTC）。
 * 三种载体形态同收：TimeInstant 本体（xlink 解引用所得）、包裹 TimeInstant 的 property 元素
 * （TAF issueTime 内联形态——ECCC 真实流全式）、直带 timePosition 的节点。
 * 返回 UTC 日/时/分三件——IR ReportTime 无年月位（TAC 对称损失，跨月语境归消费方）。
 */
function instantOf(
  node: XNode | undefined,
  gmlIds: Map<string, XNode>,
  warnings: ParseWarning[],
): { day: number; hour: number; minute: number } | undefined {
  if (node === undefined) return undefined;
  const href = attr(node, "href");
  const resolved =
    href !== undefined && href.startsWith("#") ? gmlIds.get(href.slice(1)) : undefined;
  const carrier = resolved ?? node;
  // 包裹形态下钻一层（观测侧 observationTime 恒 href 直指 TimeInstant 本体，不受影响）
  const instant = objChild(carrier, "TimeInstant") ?? carrier;
  const pos = textChild(instant, "timePosition");
  if (pos === undefined) return undefined;
  const ms = parseTimePositionMs(pos, "timePosition", warnings);
  if (Number.isNaN(ms)) return undefined;
  const d = new Date(ms);
  return { day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}

// ---------------------------------------------------------------- 天气电码（4678 URI → WeatherGroup）

/**
 * 单个 4678 电码 URI 条目 → WeatherGroup（强度/VC/描述符/现象切解复用 TAC 侧 parseWeatherBody
 * 同一判式——URI 尾段与 TAC w'w' token 同构，如 "+TSRA"、"SHRASN"、"VCSH"；D0 实证）。
 * 近期天气（recentWeather 元素）同函数切解（RE 前缀已由元素位承载，URI 只给现象体）。
 */
function weatherGroupOfCode(
  code: string,
  where: string,
  warnings: ParseWarning[],
): WeatherGroup | undefined {
  const body = parseWeatherBody(code);
  if (body === null) {
    warnings.push({
      code: "unknown-token",
      severity: "info",
      message: `${where} 电码表引用无法切解（${code}）——已跳过该天气组`,
    });
    return undefined;
  }
  if (body.outOfOrder) {
    warnings.push({
      code: "invalid-format",
      severity: "warning",
      message: `${where} 天气电码语序不合电码表（${code}：描述符须先于现象）——已按切解结果收下`,
    });
  }
  if (body.signWithVc) {
    warnings.push({
      code: "invalid-format",
      severity: "info",
      message: `${where} 天气电码强度符与 VC 并存（${code}）——已按切解结果收下`,
    });
  }
  return {
    intensity: body.intensity,
    proximity: body.proximity,
    descriptor: body.descriptor,
    phenomena: body.phenomena,
  };
}

// ---------------------------------------------------------------- 观测子组解析

/** surfaceWind 载体拆包（观测=AerodromeSurfaceWind；趋势=AerodromeSurfaceWindTrendForecast）。 */
function windBodyOf(windObj: XNode): XNode {
  return (
    objChild(windObj, "AerodromeSurfaceWind") ??
    objChild(windObj, "AerodromeSurfaceWindTrendForecast") ??
    objChild(windObj, "AerodromeSurfaceWindForecast") ??
    windObj
  );
}

/** 带 uom 的速度读数（meanWindSpeed / windGustSpeed；operator ABOVE → beyond above，P49 族同构）。 */
function speedReading(body: XNode, key: string): WindGroup["speed"] | undefined {
  const node = objChild(body, key);
  if (node === undefined || isNil(node)) return undefined;
  const value = numChild(body, key);
  if (value === undefined) return undefined;
  const unit = SPEED_UOM[attr(node, "uom") ?? ""];
  if (unit === undefined) return undefined;
  const op = textChild(body, `${key}Operator`);
  return {
    value,
    unit,
    ...(op === "ABOVE" ? { beyond: "above" as const } : {}),
    ...(spanOf(node) !== undefined ? { span: spanOf(node) } : {}),
  };
}

/** AerodromeSurfaceWind → IR WindGroup；风速缺测/单位不可辨 → "missing"（三态组）。 */
function surfaceWindOf(
  windObj: XNode,
  where: string,
  warnings: ParseWarning[],
  raw: string,
): WindGroup | "missing" {
  const body = windBodyOf(windObj);
  const variable = attr(body, "variableWindDirection") === "true";
  const direction = numChild(body, "meanWindDirection") ?? null;
  const speed = speedReading(body, "meanWindSpeed");
  const gust = speedReading(body, "windGustSpeed");
  if (speed === undefined) {
    warnings.push({
      code: "missing-expected",
      severity: "info",
      message: `${where}平均风速缺测或单位不可辨——风组判缺测`,
    });
    return "missing";
  }
  if (direction !== null && (direction < 0 || direction > 360)) {
    warnings.push({
      code: "value-out-of-range",
      severity: "warning",
      message: `${where}风向越界（${direction}° > 360°）——方向位不可信判缺测`,
    });
  }
  // 扇区两端元素（官方译文带 uom="deg" 恒为对象；坍缩形态走兜底检索）
  const ccwSpan = childSpanOf(raw, body, "extremeCounterClockwiseWindDirection");
  const cwSpan = childSpanOf(raw, body, "extremeClockwiseWindDirection");
  const ccw = numChild(body, "extremeCounterClockwiseWindDirection");
  const cw = numChild(body, "extremeClockwiseWindDirection");
  const variation =
    ccw !== undefined && cw !== undefined && ccw >= 0 && ccw <= 360 && cw >= 0 && cw <= 360
      ? {
          min: ccw,
          max: cw,
          ...(envelopeOf(ccwSpan, cwSpan) !== undefined
            ? { span: envelopeOf(ccwSpan, cwSpan) }
            : {}),
        }
      : undefined;
  // VRB 语义（D0 ③）：variable 且无均值方向 ＝全向（IR variable 承载）；
  // 带扇区的 variable 译文形态（080V140 族）有均值方向——IR variable=false，扇区走 variation
  return {
    variable: variable && direction === null,
    direction: direction !== null && direction >= 0 && direction <= 360 ? direction : null,
    speed,
    ...(gust !== undefined ? { gust } : {}),
    ...(variation !== undefined ? { variation } : {}),
  };
}

/** AerodromeHorizontalVisibility → IR VisibilityGroup（9999 族 → 10000m+ABOVE 同构落位）。 */
function visibilityOf(
  host: XNode,
  warnings: ParseWarning[],
  raw: string,
): VisibilityGroup | undefined {
  const body = objChild(host, "AerodromeHorizontalVisibility") ?? host;
  const node = objChild(body, "prevailingVisibility");
  const value = numChild(body, "prevailingVisibility");
  if (node === undefined || isNil(node) || value === undefined) return undefined;
  const op = textChild(body, "prevailingVisibilityOperator");
  if (op !== undefined && op !== "ABOVE" && op !== "BELOW") {
    warnings.push({
      code: "invalid-format",
      severity: "info",
      message: `能见度关系算子未识别（${op}）——按精确值收下`,
    });
  }
  const minValue = numChild(body, "minimumVisibility");
  const minDirDeg = numChild(body, "minimumVisibilityDirection");
  // 最低能见度方向组区间＝minimumVisibility 至 minimumVisibilityDirection 两元素外包络（WMO
  // 15.6.2 的 VNVNVNVNDv 在 XML 拆成两个兄弟元素——包络即 TAC 词组区间的同构落位）
  const minimumSpan =
    minValue !== undefined && minDirDeg !== undefined
      ? envelopeOf(
          childSpanOf(raw, body, "minimumVisibility"),
          childSpanOf(raw, body, "minimumVisibilityDirection"),
        )
      : undefined;
  // 阈值形态向 IR/TAC 电码收敛（两通道等价的根基）：TAC 上限电码 9999＝XML「10000m+ABOVE」，
  // 下限电码 0000＝XML「50m+BELOW」（XSD 明文：at least 10000 → 10000+above；less than 50 → 50+below）。
  // 其他数值（非标准 ABOVE/BELOW 值）保留原值 + beyond 标注，不硬折。
  const canonical =
    op === "ABOVE" && value === 10000 ? 9999 : op === "BELOW" && value === 50 ? 0 : value;
  const visSpan = spanOf(node);
  return {
    value: canonical,
    unit: "m",
    exact: op === undefined,
    ...(op === "ABOVE"
      ? { beyond: "above" as const }
      : op === "BELOW"
        ? { beyond: "below" as const }
        : {}),
    ...(minValue !== undefined && minDirDeg !== undefined
      ? {
          minimum: {
            value: minValue,
            direction: dirWordOf(minDirDeg),
            ...(minimumSpan !== undefined ? { span: minimumSpan } : {}),
          },
        }
      : {}),
    ...(visSpan !== undefined ? { span: visSpan } : {}),
  };
}

/** AerodromeRunwayVisualRange → IR RunwayVisualRange（pastTendency/meanRVROperator 全保真落位）。 */
function rvrOf(
  rvrObj: XNode,
  gmlIds: Map<string, XNode>,
  warnings: ParseWarning[],
): RunwayVisualRange | undefined {
  const body = objChild(rvrObj, "AerodromeRunwayVisualRange") ?? rvrObj;
  const designator = runwayDesignatorOf(objChildFirst(body, "runway"), gmlIds);
  const node = objChild(body, "meanRVR");
  const value = numChild(body, "meanRVR");
  if (node === undefined || isNil(node) || value === undefined) {
    warnings.push({
      code: "invalid-format",
      severity: "info",
      message: `RVR 组 meanRVR 缺测（${designator ?? "未知跑道"}）——该跑道条目跳过`,
    });
    return undefined;
  }
  const unit = RVR_UNIT[attr(node, "uom") ?? "m"];
  if (unit === undefined) {
    warnings.push({
      code: "invalid-format",
      severity: "info",
      message: `RVR 单位未识别（uom="${attr(node, "uom") ?? "无"}"）——该跑道条目跳过`,
    });
    return undefined;
  }
  const op = textChild(body, "meanRVROperator");
  const tendency = attr(body, "pastTendency");
  const rvrSpan = spanOf(rvrObj);
  return {
    runway: designator ?? "",
    value,
    ...(op === "ABOVE"
      ? { beyondRange: "above" as const }
      : op === "BELOW"
        ? { beyondRange: "below" as const }
        : {}),
    unit,
    // MISSING_VALUE / 缺省 ＝无趋势位（TAC 无后缀同构；ZSPD 官方对 P2000 组实证）
    ...(tendency === "UPWARD"
      ? { trend: "up" as const }
      : tendency === "DOWNWARD"
        ? { trend: "down" as const }
        : tendency === "NO_CHANGE"
          ? { trend: "no-change" as const }
          : {}),
    ...(rvrSpan !== undefined ? { span: rvrSpan } : {}),
  };
}

/** 云层族：AerodromeCloud（观测）与 AerodromeCloudForecast（趋势）共用层结构。 */
function cloudsOf(
  cloudObj: XNode,
  where: string,
  warnings: ParseWarning[],
  raw: string,
): CloudCondition | undefined {
  const body =
    objChild(cloudObj, "AerodromeCloud") ??
    objChild(cloudObj, "AerodromeCloudForecast") ??
    cloudObj;
  const elements: CloudElement[] = [];
  let clearCode: { code: SkyClearCode; span?: Span } | undefined;
  const vvNode = objChild(body, "verticalVisibility");
  const vv = numChild(body, "verticalVisibility");
  if (vvNode !== undefined && !isNil(vvNode) && vv !== undefined) {
    const uom = attr(vvNode, "uom") ?? "m";
    const vvSpan = spanOf(vvNode) ?? childSpanOf(raw, body, "verticalVisibility");
    elements.push({
      kind: "vertical-visibility",
      heightFt: {
        value: uom === "[ft_i]" ? vv : mToFt(vv),
        ...(vvSpan !== undefined ? { span: vvSpan } : {}),
      },
      ...(vvSpan !== undefined ? { span: vvSpan } : {}),
    });
  }
  const layers = Array.isArray(body["layer"]) ? (body["layer"] as unknown[]) : [];
  for (const rawLayer of layers) {
    if (!isObj(rawLayer)) continue;
    const layer = objChild(rawLayer, "CloudLayer") ?? rawLayer;
    const amountTail = codeTailOf(objChild(layer, "amount"));
    const baseNode = objChild(layer, "base");
    const baseNum = numChild(layer, "base");
    // 层区间＝CloudLayer 语义体（amount/base/cloudType 三位）；仅剩容器层时退容器区间
    const layerSpan = spanOf(objChild(rawLayer, "CloudLayer") ?? rawLayer);
    let heightFt: number | null = null;
    let heightSpan: Span | undefined;
    if (baseNode !== undefined && !isNil(baseNode) && baseNum !== undefined) {
      heightFt = attr(baseNode, "uom") === "[ft_i]" ? baseNum : mToFt(baseNum);
      heightSpan = spanOf(baseNode);
    } else if (baseNum !== undefined) {
      // 无属性坍缩形态（无 uom——按米折算与值路径同判）：兜底检索定位
      const baseText = textChild(layer, "base");
      heightFt = mToFt(baseNum);
      heightSpan =
        baseText === undefined ? undefined : childTextSpanOf(raw, layerSpan, "base", baseText);
    }
    // 层存在性判据＝元素在位（键存在即可——无属性纯文本形态被折叠成 string、重复键成数组，
    // 均非对象；amount 元素 nil → 云量位缺测 null；base nil → 高度位缺测 null）——与 TAC
    // 「/////////」全缺测层同构（EHJR/SCCH 官方对实证）；三元素全然缺席才不是层
    if (
      layer["amount"] === undefined &&
      layer["base"] === undefined &&
      layer["cloudType"] === undefined
    )
      continue;
    // OVX（天空不明，49-2 云量电码表）＝VV 形态：AWC 2025-2 转换把 TAC VV 落成 OVX+base 层
    // （KCRW VV001→OVX/100ft 实证）；IR 落 vertical-visibility——与 2023-1 官方译文用
    // verticalVisibility 元素的落位一致，两通道对 VV 报文同构。base 缺测时无法承载高度位——
    // 该层按不可辨跳过出声（样本未覆盖该形态）。
    if (amountTail === "OVX") {
      if (heightFt !== null) {
        elements.push({
          kind: "vertical-visibility",
          heightFt: { value: heightFt, ...(heightSpan !== undefined ? { span: heightSpan } : {}) },
          ...(layerSpan !== undefined ? { span: layerSpan } : {}),
        });
      } else {
        warnings.push({
          code: "invalid-format",
          severity: "info",
          message: `${where}OVX 层缺云底（天空不明但高度位缺测）——该层不可辨跳过`,
        });
      }
      continue;
    }
    // ECCC 真实流（2026-10-08 LTCN32 实证）：无云电码以「云量位 SKC/NSC + 云底 nil(inapplicable)」
    // 的层形态承载——49-2 云量电码表本词、显式 URI 电码无信息损失，按 clear 电码收下（层形态是
    // ECCC 编法，与 nilReason 承载 / AWC 空容器两形态三轨并存）；带真实云底的同名词照常按层收
    //（amount 位 null + invalid-format 出声，走下方未识别电码路径）。
    if ((amountTail === "SKC" || amountTail === "NSC") && heightFt === null) {
      if (clearCode === undefined) {
        clearCode = { code: amountTail, ...(layerSpan !== undefined ? { span: layerSpan } : {}) };
      }
      continue;
    }
    const typeTail = codeTailOf(objChild(layer, "cloudType"));
    const amountKnown =
      amountTail === "FEW" || amountTail === "SCT" || amountTail === "BKN" || amountTail === "OVC";
    elements.push({
      kind: "layer",
      amount: amountKnown ? amountTail : null,
      heightFt: { value: heightFt, ...(heightSpan !== undefined ? { span: heightSpan } : {}) },
      ...(typeTail === "CB" || typeTail === "TCU" ? { convective: typeTail } : {}),
      ...(layerSpan !== undefined ? { span: layerSpan } : {}),
    });
    if (amountTail !== undefined && !amountKnown) {
      warnings.push({
        code: "invalid-format",
        severity: "info",
        message: `${where}云量电码未识别（${amountTail}）——云量位判缺测`,
      });
    }
  }
  // 空云容器（在位但无层/无垂直能见度/无 nilReason）：AWC 2025-2 转换器对无云族（TAC CLR/NSC）
  // 与 CAVOK 报的输出形态（KSEA CLR / VIDP NSC / ZSPD CAVOK 实证）——SKC/CLR/NSC/NCD 细辨
  // 不可还原，按组省略收下 + info 出声（与无云族 nilReason 承载同一纪律）。
  if (
    layers.length === 0 &&
    vvNode === undefined &&
    elements.length === 0 &&
    clearCode === undefined
  ) {
    warnings.push({
      code: "invalid-format",
      severity: "info",
      message: `${where}云容器为空（无层/无垂直能见度/无 nilReason——AWC 转换的无云族/CAVOK 形态）——细辨不可还原，按组省略收下`,
    });
  }
  return elements.length > 0 || clearCode !== undefined
    ? { elements, clear: clearCode }
    : undefined;
}

/**
 * 无云族 nil 云元素 → CloudCondition（D0 ④：nilReason 承载，四码收敛为代表电码二词，
 * SKC/CLR 细辨不可还原，info 出声）。观测与趋势/TAF 预报共用一套。
 * 返回 undefined ＝选词未识别（调用方按组省略收下——告警已在此出声）。
 */
function cloudNilOf(cloudProp: XNode, warnings: ParseWarning[]): CloudCondition | undefined {
  const word = nilWordOf(attr(cloudProp, "nilReason"));
  const cloudSpan = spanOf(cloudProp);
  if (
    word === NIL_NOTHING_OF_OPERATIONAL_SIGNIFICANCE ||
    word === NIL_NOT_DETECTED_BY_AUTO_SYSTEM
  ) {
    const code: SkyClearCode = word === NIL_NOT_DETECTED_BY_AUTO_SYSTEM ? "NCD" : "NSC";
    warnings.push({
      code: "invalid-format",
      severity: "info",
      message: `无云族经 IWXXM nilReason 承载（${word}）——映射为代表电码 ${code}，SKC/CLR 细辨不可还原`,
      ...(cloudSpan !== undefined ? { span: cloudSpan } : {}),
    });
    return {
      elements: [],
      clear: { code, ...(cloudSpan !== undefined ? { span: cloudSpan } : {}) },
    };
  }
  warnings.push({
    code: "invalid-format",
    severity: "info",
    message: `云组 nilReason 选词未识别（${word ?? "无"}）——按组省略收下`,
    ...(cloudSpan !== undefined ? { span: cloudSpan } : {}),
  });
  return undefined;
}

/** bufr4 电码表 URI 尾段 → 数值（…/0-20-089/66 → 66）。 */
const codeNumOf = (node: XNode | undefined): number | undefined =>
  numChild({ v: codeTailOf(node) }, "v");

/** 跑道状态组：AerodromeRunwayState → IR RunwayStateGroup（bufr4 电码表 URI → 数值/档位）。 */
function runwayStateOf(
  stateObj: XNode,
  gmlIds: Map<string, XNode>,
  warnings: ParseWarning[],
): RunwayStateGroup {
  const body = objChild(stateObj, "AerodromeRunwayState") ?? stateObj;
  const allRunways = attr(body, "allRunways") === "true";
  const fromPrevious = attr(body, "fromPreviousReport") === "true";
  const runwayNode = objChildFirst(body, "runway");
  // R88（全部跑道）/R99（重复上份）在 TAC 是跑道号特殊电码——XML 侧以布尔位承载，此处按 IR
  // 自身的电码词汇回填（88/99），保持两通道 IR 同构（D0 复核：ESMS/EKRK 官方对实证；
  // EKRK 的 R99 形态＝runway 元素带 nilReason 而无 xsi:nil，无设计器即按重复上份收）
  const designator = runwayDesignatorOf(runwayNode, gmlIds);
  const runway = allRunways ? "88" : (designator ?? (fromPrevious ? "99" : ""));
  const cleared = attr(body, "cleared") === "true";
  const depositElem = objChild(body, "depositType");
  const contaminationElem = objChild(body, "contamination");
  const depthElem = objChild(body, "depthOfDeposit");
  const frictionElem = objChild(body, "estimatedSurfaceFrictionOrBrakingAction");
  // 缺席位语义（与 TAC 两侧同构的关键）：CLRD 清除族（TAC 无沉积/覆盖位）→ 字段省略；
  // 六位电码族的「/」位在 XML 侧是元素缺席——同报其他状态位在场即视为槽位存在但缺报（null）
  //（EETN 官方对：0///95 → contamination 缺席但 deposit/depth/friction 在场 → coverage:null）
  const slotMissing =
    !cleared &&
    (depositElem !== undefined ||
      contaminationElem !== undefined ||
      depthElem !== undefined ||
      frictionElem !== undefined);
  const deposit =
    depositElem !== undefined ? (codeNumOf(depositElem) ?? null) : slotMissing ? null : undefined;
  const coverageTail = contaminationElem === undefined ? undefined : codeNumOf(contaminationElem);
  const coverageKnown =
    coverageTail === 1 || coverageTail === 2 || coverageTail === 5 || coverageTail === 9;
  if (coverageTail !== undefined && !coverageKnown) {
    warnings.push({
      code: "invalid-format",
      severity: "warning",
      message: `跑道覆盖范围电码表外（${coverageTail}——表 0519 仅 1/2/5/9）——该位判缺测`,
    });
  }
  const depthNode = depthElem;
  const depth =
    depthNode === undefined
      ? slotMissing
        ? null
        : undefined
      : isNil(depthNode)
        ? null
        : numChild(body, "depthOfDeposit");
  const frictionTail = codeNumOf(objChild(body, "estimatedSurfaceFrictionOrBrakingAction"));
  let frictionCoefficient: number | undefined;
  let brakingAction: RunwayStateGroup["brakingAction"];
  if (frictionTail !== undefined && frictionTail >= 1 && frictionTail <= 90) {
    frictionCoefficient = frictionTail / 100;
  } else if (
    frictionTail === 91 ||
    frictionTail === 92 ||
    frictionTail === 93 ||
    frictionTail === 94 ||
    frictionTail === 95 ||
    frictionTail === 99
  ) {
    brakingAction =
      frictionTail === 91
        ? "poor"
        : frictionTail === 92
          ? "medium-poor"
          : frictionTail === 93
            ? "medium"
            : frictionTail === 94
              ? "medium-good"
              : frictionTail === 95
                ? "good"
                : "unreliable";
  }
  return {
    runway,
    cleared: cleared,
    ...(deposit !== undefined ? { deposit } : {}),
    ...(coverageKnown
      ? { coverage: coverageTail }
      : coverageTail !== undefined || slotMissing
        ? { coverage: null }
        : {}),
    ...(depth !== undefined ? { depth } : {}),
    ...(frictionCoefficient !== undefined ? { frictionCoefficient } : {}),
    ...(brakingAction !== undefined ? { brakingAction } : {}),
  };
}

// ---------------------------------------------------------------- 趋势组

/** TrendForecastTimeIndicator → TAC 时段词（AT/UNTIL→TL/FROM→FM；时刻取 phenomenonTime 折 HHMM）。 */
function trendPeriodOf(
  trend: XNode,
  gmlIds: Map<string, XNode>,
  raw: string,
  warnings: ParseWarning[],
): { text: string; span?: Span } | undefined {
  const indicator = textChild(trend, "timeIndicator");
  if (indicator !== "AT" && indicator !== "UNTIL" && indicator !== "FROM") return undefined;
  const word = indicator === "AT" ? "AT" : indicator === "UNTIL" ? "TL" : "FM";
  const phenomenon = objChild(trend, "phenomenonTime");
  if (phenomenon === undefined) return undefined;
  const href = attr(phenomenon, "href");
  const carrier =
    href !== undefined && href.startsWith("#")
      ? (gmlIds.get(href.slice(1)) ?? phenomenon)
      : phenomenon;
  // AT ＝ TimeInstant（硬时刻）；TL 取 TimePeriod 终点、FM 取起点（VTUO/WSSS/ZSPD 官方对实证）
  const instant = instantOf(carrier, gmlIds, warnings);
  // 时段区间＝指示词元素（坍缩 string，兜底检索）至 phenomenonTime 元素（对象直取）的外包络——
  // XML 把 TAC 一个时段词拆成两处编码，包络即该词组在源里的完整落点
  const periodSpan = envelopeOf(
    childTextSpanOf(raw, spanOf(trend), "timeIndicator", indicator),
    spanOf(phenomenon),
  );
  if (instant !== undefined) {
    return {
      text: `${word}${String(instant.hour).padStart(2, "0")}${String(instant.minute).padStart(2, "0")}`,
      ...(periodSpan !== undefined ? { span: periodSpan } : {}),
    };
  }
  const period = objChild(carrier, "TimePeriod");
  const pos = word === "FM" ? textChild(period, "beginPosition") : textChild(period, "endPosition");
  if (pos === undefined) return undefined;
  const ms = parseTimePositionMs(pos, "trendTimePeriod", warnings);
  if (Number.isNaN(ms)) return undefined;
  const d = new Date(ms);
  return {
    text: `${word}${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}`,
    ...(periodSpan !== undefined ? { span: periodSpan } : {}),
  };
}

/** 静音版风组重建（trend.raw 重建用，不出告警）。 */
function windRebuildOf(windObj: XNode): WindGroup | undefined {
  const body = windBodyOf(windObj);
  const speed = speedReading(body, "meanWindSpeed");
  if (speed === undefined) return undefined;
  const direction = numChild(body, "meanWindDirection") ?? null;
  const gust = speedReading(body, "windGustSpeed");
  return {
    variable: attr(body, "variableWindDirection") === "true" && direction === null,
    direction,
    speed,
    ...(gust !== undefined ? { gust } : {}),
  };
}

/** 预报/趋势要素体的 TAC 形态重建（METAR 趋势与 TAF 基况/变化组共用——结构键同套）。
 *  产出顺序沿 TAC 惯例：风、能见度、天气（含 NSW）、CAVOK、云层。 */
function forecastBodyParts(host: XNode): string[] {
  const parts: string[] = [];
  const wind = objChild(host, "surfaceWind");
  if (wind !== undefined) {
    const w = windRebuildOf(wind);
    if (w !== undefined) {
      const unitWord = w.speed.unit === "kt" ? "KT" : w.speed.unit === "mps" ? "MPS" : "KMH";
      const gust = w.gust !== undefined ? `G${w.gust.value}` : "";
      parts.push(
        `${w.direction === null ? "VRB" : String(w.direction).padStart(3, "0")}${w.speed.value}${gust}${unitWord}`,
      );
    }
  }
  const vis = numChild(host, "prevailingVisibility");
  if (vis !== undefined) parts.push(String(Math.round(vis)).padStart(4, "0"));
  const weathers = Array.isArray(host["weather"]) ? (host["weather"] as unknown[]) : [];
  for (const w of weathers) {
    if (!isObj(w)) continue;
    if (isNilProp(w)) {
      parts.push("NSW");
      continue;
    }
    const tail = codeTailOf(w);
    if (tail !== undefined) parts.push(tail);
  }
  if (attr(host, "cloudAndVisibilityOK") === "true") parts.push("CAVOK");
  const cloud = objChild(host, "cloud");
  if (cloud !== undefined) {
    const body = objChild(cloud, "AerodromeCloudForecast") ?? cloud;
    const layers = Array.isArray(body["layer"]) ? (body["layer"] as unknown[]) : [];
    for (const raw of layers) {
      if (!isObj(raw)) continue;
      const layer = objChild(raw, "CloudLayer") ?? raw;
      const amount = codeTailOf(objChild(layer, "amount"));
      const base = numChild(layer, "base");
      const type = codeTailOf(objChild(layer, "cloudType"));
      if (amount !== undefined) {
        parts.push(
          `${amount}${base !== undefined ? String(Math.round(base / 100)).padStart(3, "0") : "///"}${type ?? ""}`,
        );
      }
    }
  }
  return parts;
}

/** 趋势段 TAC 形态重建（结构化字段 → 可读串；非 TAC 原文，仅供 RAW 视图——见文件头 raw 口径）。 */
function rebuildTrendRaw(
  kind: "becmg" | "tempo",
  period: string | undefined,
  trend: XNode,
): string {
  return [
    kind === "tempo" ? "TEMPO" : "BECMG",
    ...(period !== undefined ? [period] : []),
    ...forecastBodyParts(trend),
  ].join(" ");
}

/** 趋势段要素（TrendElements 同构：风/能见度/天气/云/CAVOK/NSW）；TAF 变化组复用同一套
 * （where 标注告警出处，缺省「趋势」＝METAR 侧）。 */
function trendElementsOf(
  trend: XNode,
  warnings: ParseWarning[],
  raw: string,
  where = "趋势",
): TrendGroup["elements"] {
  const windProp = objChild(trend, "surfaceWind");
  const wind: WindGroup | undefined =
    windProp === undefined
      ? undefined
      : (() => {
          const w = surfaceWindOf(windProp, `${where}风组`, warnings, raw);
          return w === "missing" ? undefined : w;
        })();
  const visibility = visibilityOf(trend, warnings, raw);
  const weathers: WeatherGroup[] = [];
  let nsw = false;
  let nswSpan: Span | undefined;
  const wxProps = trend["weather"];
  if (wxProps !== undefined) {
    const list = Array.isArray(wxProps) ? wxProps : [wxProps];
    for (const item of list) {
      if (!isObj(item)) continue;
      if (isNilProp(item)) {
        // NSW ＝ 趋势内天气 nil nothingOfOperationalSignificance（LTCN 官方对实证；
        // isNilProp 兼收 TAF 侧仅带 nilReason 的空载属性形态）
        const word = nilWordOf(attr(item, "nilReason"));
        if (word === NIL_NOTHING_OF_OPERATIONAL_SIGNIFICANCE) {
          nsw = true;
          nswSpan = spanOf(item);
        } else warnUnknownNil(`${where}天气`, word, warnings, spanOf(item));
        continue;
      }
      const tail = codeTailOf(item);
      if (tail === undefined) continue;
      const g = weatherGroupOfCode(tail, `${where}天气`, warnings);
      if (g !== undefined) {
        const itemSpan = spanOf(item);
        weathers.push(itemSpan !== undefined ? { ...g, span: itemSpan } : g);
      }
    }
  }
  const cloudProp = objChild(trend, "cloud");
  const clouds =
    cloudProp === undefined
      ? undefined
      : isNilProp(cloudProp)
        ? cloudNilOf(cloudProp, warnings)
        : cloudsOf(cloudProp, where, warnings, raw);
  const cavokOn = attr(trend, "cloudAndVisibilityOK") === "true";
  const cavokSpan = attrSpanOf(raw, spanOf(trend), "cloudAndVisibilityOK", "true");
  const hasAny =
    wind !== undefined ||
    visibility !== undefined ||
    weathers.length > 0 ||
    clouds !== undefined ||
    nsw ||
    cavokOn;
  if (!hasAny) return undefined;
  return {
    ...(wind !== undefined ? { wind } : {}),
    ...(visibility !== undefined ? { visibility } : {}),
    ...(cavokOn ? { cavok: cavokSpan !== undefined ? { span: cavokSpan } : {} } : {}),
    weather: weathers,
    ...(nsw ? { nsw: nswSpan !== undefined ? { span: nswSpan } : {} } : {}),
    ...(clouds !== undefined ? { clouds } : {}),
  };
}

// ---------------------------------------------------------------- TAF（v0.3 遗留项 1：→ TafReport）

/** TAF 根已知子元素——之外 unknown-token(info) 出声（extension 块按已知键静默跳过，与观测侧同纪律）。 */
const KNOWN_TAF_ROOT_KEYS: ReadonlySet<string> = new Set([
  "issueTime",
  "aerodrome",
  "validPeriod",
  "cancelledReportValidPeriod",
  "baseForecast",
  "changeForecast",
  "extension",
]);

/** 预报元素（MeteorologicalAerodromeForecast）已知子元素——基况段与变化组共用一套键。 */
const KNOWN_FORECAST_KEYS: ReadonlySet<string> = new Set([
  "phenomenonTime",
  "prevailingVisibility",
  "prevailingVisibilityOperator",
  "surfaceWind",
  "weather",
  "cloud",
  "temperature",
  "extension",
]);

/** ddHH 二位日时拼装（有效期/变化窗/气温时刻的 TAC 形态重建共用）。 */
const ddhhOf = (t: { day: number; hour: number }): string =>
  `${String(t.day).padStart(2, "0")}${String(t.hour).padStart(2, "0")}`;

/** xlink:href="#gml:id" 文档内引用解析（无引用/解析不中 → 原元素；MGGT 基况 phenomenonTime 引用 validPeriod 实证）。 */
function resolvedOf(prop: XNode, gmlIds: Map<string, XNode>): XNode {
  const href = attr(prop, "href");
  if (href === undefined || !href.startsWith("#")) return prop;
  return gmlIds.get(href.slice(1)) ?? prop;
}

/** TimePeriod 端点绝对时刻（begin/end position → UTC 日时分；indeterminate/缺失/不可解析 → undefined）。 */
function positionOf(
  node: XNode | undefined,
  key: string,
  warnings: ParseWarning[],
): { day: number; hour: number; minute: number } | undefined {
  const pos = textChild(node, key);
  if (pos === undefined) return undefined;
  const ms = parseTimePositionMs(pos, key, warnings);
  if (Number.isNaN(ms)) return undefined;
  const d = new Date(ms);
  return { day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}

/**
 * 有效期载体（validPeriod，CNL 报退 cancelledReportValidPeriod——被取消报的覆盖窗；官方对 EHLW 与
 * ECCC 实流均把该窗起点归一化为发报时刻，两方一致故按原文直读）→ ddHH/ddHH 直投影。
 * 三态：value＝投影成功；absent＝载体缺失或端点不可解析；invalid＝数值越界。
 */
function tafValidityOf(
  root: XNode,
  gmlIds: Map<string, XNode>,
  warnings: ParseWarning[],
):
  | { readonly kind: "value"; readonly validity: TafValidityGroup; readonly fromCancelled: boolean }
  | { readonly kind: "absent" }
  | { readonly kind: "invalid" } {
  const prop = objChild(root, "validPeriod") ?? objChild(root, "cancelledReportValidPeriod");
  if (prop === undefined) return { kind: "absent" };
  const period = objChild(resolvedOf(prop, gmlIds), "TimePeriod") ?? resolvedOf(prop, gmlIds);
  const begin = positionOf(period, "beginPosition", warnings);
  const end = positionOf(period, "endPosition", warnings);
  if (begin === undefined || end === undefined) return { kind: "absent" };
  const span = spanOf(prop);
  const validity: TafValidityGroup = {
    startDay: begin.day,
    startHour: begin.hour,
    endDay: end.day,
    endHour: end.hour,
    // raw ＝重建串（XML 无 TAC 原文——口径见文件头；止时直投影恒 00–23，TAC 止时 24 午夜特例不重编）
    raw: `${ddhhOf(begin)}/${ddhhOf(end)}`,
    ...(span !== undefined ? { span } : {}),
  };
  if (
    validity.startDay < 1 ||
    validity.startDay > 31 ||
    validity.startHour > 23 ||
    validity.endDay < 1 ||
    validity.endDay > 31 ||
    validity.endHour > 23
  ) {
    return { kind: "invalid" };
  }
  return {
    kind: "value",
    validity,
    fromCancelled: objChild(root, "validPeriod") === undefined,
  };
}

/** changeIndicator → TAC 变化组三件（kind/probability/withTempo）；known=false ＝未识别词（调用方出声后按渐变收）。 */
function changeKindOf(change: string | undefined): {
  readonly kind: TafChangeKind;
  readonly probability?: 30 | 40;
  readonly withTempo?: boolean;
  readonly known: boolean;
} {
  switch (change) {
    case "BECOMING":
      return { kind: "BECMG", known: true };
    case "TEMPORARY_FLUCTUATIONS":
      return { kind: "TEMPO", known: true };
    case "FROM":
      return { kind: "FM", known: true };
    case "PROBABILITY_30":
      return { kind: "PROB", probability: 30, known: true };
    case "PROBABILITY_40":
      return { kind: "PROB", probability: 40, known: true };
    case "PROBABILITY_30_TEMPORARY_FLUCTUATIONS":
      return { kind: "PROB", probability: 30, withTempo: true, known: true };
    case "PROBABILITY_40_TEMPORARY_FLUCTUATIONS":
      return { kind: "PROB", probability: 40, withTempo: true, known: true };
    case undefined:
    default:
      // 缺失/未识别词同径：按渐变收 + known=false 出声（不静默纪律）
      return { kind: "BECMG", known: false };
  }
}

/**
 * 变化组时窗（XSD 明文：TAC FM/TL/AT 由 phenomenonTime 承载——TimePeriod begin＝FM 硬时刻或窗
 * 起点、end＝窗终点；TimeInstant＝AT 硬时刻，TAF 变化组语汇无 AT，按零长窗收下出声）。
 * span＝phenomenonTime property wrapper 区间（源锚点，覆盖起止两端）。
 */
function tafTimingOf(
  forecast: XNode,
  kind: TafChangeKind,
  gmlIds: Map<string, XNode>,
  warnings: ParseWarning[],
): { readonly at?: TafChangeAt; readonly window?: TafChangeWindow } {
  const out: { at?: TafChangeAt; window?: TafChangeWindow } = {};
  const phenProp = objChild(forecast, "phenomenonTime");
  if (phenProp === undefined) {
    warnings.push({
      code: "invalid-format",
      severity: "info",
      message: "变化组缺 phenomenonTime 时窗——按无窗收下（与 TAC 侧变化组缺窗同口径出声）",
      ...(spanOf(forecast) !== undefined ? { span: spanOf(forecast) } : {}),
    });
    return out;
  }
  const periodSpan = spanOf(phenProp);
  const resolved = resolvedOf(phenProp, gmlIds);
  const period = objChild(resolved, "TimePeriod") ?? resolved;
  const begin = positionOf(period, "beginPosition", warnings);
  const end = positionOf(period, "endPosition", warnings);
  if (kind === "FM") {
    // FROM：begin 即 FM 硬时刻（到分钟；XSD 文档——FM 窗的起点）
    if (begin === undefined) {
      warnings.push({
        code: "invalid-format",
        severity: "info",
        message: "FM 组起点时刻缺失或不可解析——按无硬时刻收下",
        ...(periodSpan !== undefined ? { span: periodSpan } : {}),
      });
      return out;
    }
    out.at = {
      hour: begin.hour,
      minute: begin.minute,
      raw: `FM${String(begin.hour).padStart(2, "0")}${String(begin.minute).padStart(2, "0")}`,
      ...(periodSpan !== undefined ? { span: periodSpan } : {}),
    };
    return out;
  }
  if (begin !== undefined && end !== undefined) {
    out.window = {
      startDay: begin.day,
      startHour: begin.hour,
      endDay: end.day,
      endHour: end.hour,
      raw: `${ddhhOf(begin)}/${ddhhOf(end)}`,
      ...(periodSpan !== undefined ? { span: periodSpan } : {}),
    };
  } else {
    // TimeInstant 硬时刻（AT 形态）或端点残缺——TAC 变化组语汇无 AT，零长窗/无窗均出声不静默
    const instant =
      begin ?? (period === resolved ? instantOf(resolved, gmlIds, warnings) : undefined);
    if (instant === undefined) {
      warnings.push({
        code: "invalid-format",
        severity: "info",
        message: "变化组时窗不可解析（phenomenonTime 起止端点缺失）——按无窗收下",
        ...(periodSpan !== undefined ? { span: periodSpan } : {}),
      });
    } else {
      warnings.push({
        code: "invalid-format",
        severity: "info",
        message: "变化组时窗为硬时刻形态（TimeInstant——TAF 变化组语汇无 AT 电码）——按零长窗收下",
        ...(periodSpan !== undefined ? { span: periodSpan } : {}),
      });
      out.window = {
        startDay: instant.day,
        startHour: instant.hour,
        endDay: instant.day,
        endHour: instant.hour,
        raw: `${ddhhOf(instant)}/${ddhhOf(instant)}`,
        ...(periodSpan !== undefined ? { span: periodSpan } : {}),
      };
    }
  }
  return out;
}

/** 变化组 raw 重建的组头（FM#### / BECMG ddHH/ddHH / TEMPO… / PROB30[ TEMPO]…；重建串口径见文件头）。 */
function changeHeadTextOf(
  head: ReturnType<typeof changeKindOf>,
  timing: ReturnType<typeof tafTimingOf>,
): string {
  if (head.kind === "FM") return timing.at !== undefined ? timing.at.raw : "FM";
  const word =
    head.kind === "BECMG"
      ? "BECMG"
      : head.kind === "TEMPO"
        ? "TEMPO"
        : `PROB${head.probability ?? ""}${head.withTempo === true ? " TEMPO" : ""}`;
  return timing.window !== undefined ? `${word} ${timing.window.raw}` : word;
}

/**
 * baseForecast 的气温预告（AerodromeAirTemperatureForecast——XSD 明文仅基况段承载）→ IR temperatures。
 * XML 一元素并载 TX/TN 两位（maximum 在前），按出现序展开；单位非摄氏度/越界/时刻缺失的读数跳过出声
 * （IR at 必填，绝不捏造时刻）。
 */
function tafTemperaturesOf(
  forecast: XNode,
  gmlIds: Map<string, XNode>,
  warnings: ParseWarning[],
): TafTemperatureGroup[] {
  const out: TafTemperatureGroup[] = [];
  const raw = forecast["temperature"];
  if (raw === undefined) return out;
  const list = Array.isArray(raw) ? raw : [raw];
  for (const prop of list) {
    if (!isObj(prop)) continue;
    const body = objChild(prop, "AerodromeAirTemperatureForecast") ?? prop;
    for (const [valueKey, timeKey, extremum, word] of [
      ["maximumAirTemperature", "maximumAirTemperatureTime", "max", "TX"],
      ["minimumAirTemperature", "minimumAirTemperatureTime", "min", "TN"],
    ] as const) {
      if (body[valueKey] === undefined) continue; // 该位未编报
      const valueProp = objChild(body, valueKey);
      const value = numChild(body, valueKey);
      if (valueProp === undefined || isNilProp(valueProp) || value === undefined) {
        warnings.push({
          code: "invalid-format",
          severity: "info",
          message: `气温预告 ${word} 位缺测或不可解析——该读数跳过`,
        });
        continue;
      }
      if (attr(valueProp, "uom") !== "Cel") {
        warnings.push({
          code: "invalid-format",
          severity: "info",
          message: `气温预告单位非摄氏度（uom="${attr(valueProp, "uom") ?? "无"}"）——该读数跳过`,
          ...(spanOf(valueProp) !== undefined ? { span: spanOf(valueProp) } : {}),
        });
        continue;
      }
      if (value < TEMP_C_MIN || value > TEMP_C_MAX) {
        warnings.push({
          code: "value-out-of-range",
          severity: "warning",
          message: `气温预告越界（${value}°C 超物理范围）——该读数不可信跳过`,
          ...(spanOf(valueProp) !== undefined ? { span: spanOf(valueProp) } : {}),
        });
        continue;
      }
      const timeProp = objChild(body, timeKey);
      const time = instantOf(timeProp, gmlIds, warnings);
      if (time === undefined) {
        warnings.push({
          code: "invalid-format",
          severity: "info",
          message: `气温预告 ${word} 达到时刻缺失或不可解析——该读数跳过（时刻位必填，不捏造）`,
        });
        continue;
      }
      const span = envelopeOf(spanOf(valueProp), spanOf(timeProp));
      out.push({
        extremum,
        celsius: value,
        at: { day: time.day, hour: time.hour },
        raw: `${word}${value < 0 ? "M" : ""}${String(Math.round(Math.abs(value))).padStart(2, "0")}/${ddhhOf(time)}Z`,
        ...(span !== undefined ? { span } : {}),
      });
    }
  }
  return out;
}

/**
 * 解析单份 IWXXM TAF（2023-1/2025-2 结构；iwxxm 3.0 现网主通道——ECCC 真实流——XSD diff 实证
 * 三版逐行同构，字段解析零分叉）为 TafReport——与 TAC 侧 parseTaf 同一份契约。
 * 输入 root 已由主入口定位（直根或 collect 包裹内 iwxxm:TAF）；warnings 由主入口创建并透传
 * （版本告警已在其中）。整体失败（无站名/无发布时组/时组越界/有效期缺失或越界）抛 MetarParseError。
 */
function parseTafIwxxmBody(
  xml: string,
  root: XNode,
  warnings: ParseWarning[],
  iwxxmVersion: string,
): TafReport {
  const gmlIds = indexGmlIds(root);

  // —— 报头：站名（与 METAR 同一 aerodrome 导航；旧 OM 架构族的版本提示同款）
  const airport = objChild(
    objChild(objChild(objChild(root, "aerodrome"), "AirportHeliport"), "timeSlice"),
    "AirportHeliportTimeSlice",
  );
  const station = textChild(airport, "locationIndicatorICAO");
  if (station === undefined || !/^[A-Z0-9]{4}$/.test(station)) {
    throw new MetarParseError(
      "missing-station",
      xml,
      `无法识别站名（aerodrome→locationIndicatorICAO 缺失或非四字码：${station ?? "无"}${
        !SUPPORTED_VERSIONS.has(iwxxmVersion)
          ? `；文档版本 ${iwxxmVersion} 非支持版本 ${SUPPORTED_VERSION_TEXT}——旧版（2.1/2016-2018 OM 架构族）的站点导航结构不同，本解析器面向 2023-1/2025-2 的结构`
          : ""
      }）`,
    );
  }
  // —— 发布时组（issueTime：XSD 必填，NIL 报亦然——TAC 无时组 NIL 形态在 XML 侧无载体）
  const issueTime = instantOf(objChild(root, "issueTime"), gmlIds, warnings);
  if (issueTime === undefined) {
    throw new MetarParseError(
      "missing-time",
      xml,
      "无法识别发布时组（issueTime 缺失或 timePosition 不可解析）",
    );
  }
  if (issueTime.day < 1 || issueTime.day > 31 || issueTime.hour > 23 || issueTime.minute > 59) {
    throw new MetarParseError(
      "invalid-time",
      xml,
      `发布时刻越界（日${issueTime.day}/时${issueTime.hour}/分${issueTime.minute}）`,
    );
  }

  // —— 标志位与 NIL/CNL 判别（reportStatus：AMENDMENT↔TAC AMD、CORRECTION↔TAC COR；
  //  CNL＝@isCancelReport，官方对 EHLW 与 ECCC 实流 LTCN23AAA 双实证）
  const amended = attr(root, "reportStatus") === "AMENDMENT";
  const corrected = attr(root, "reportStatus") === "CORRECTION";
  const cancelled = attr(root, "isCancelReport") === "true";

  const baseProp = objChild(root, "baseForecast");
  const base =
    baseProp === undefined ? undefined : objChild(baseProp, "MeteorologicalAerodromeForecast");

  const validityResult = tafValidityOf(root, gmlIds, warnings);

  // —— NIL：baseForecast 缺席或空载属性元素（官方对 DAOY 实证形态：nilReason missing 无内层，
  //  无 validPeriod）＝台站无预报——IR 最小形态（与 TAC「站名后 NIL」同语义）
  if (base === undefined && !cancelled) {
    warnUnknownNil("NIL 报 baseForecast", nilWordOf(attr(baseProp, "nilReason")), warnings);
    if (validityResult.kind === "invalid") {
      warnings.push({
        code: "invalid-format",
        severity: "info",
        message: "NIL 报有效期数值越界——NIL 优先，有效期位不载",
      });
    }
    return {
      kind: "taf",
      raw: xml,
      station,
      issueTime,
      nil: true,
      ...(validityResult.kind === "value" ? { validity: validityResult.validity } : {}),
      flags: { amended, corrected },
      cavok: false,
      changes: [],
      temperatures: [],
      remarks: [],
      warnings,
    };
  }

  // —— 有效期整体失败判定（非 NIL 报；TAC 同序——有效期先于 CNL 判别解析）
  if (validityResult.kind === "invalid") {
    throw new MetarParseError(
      "invalid-validity",
      xml,
      "有效期数值越界（validPeriod 端点折 ddHH/ddHH 出界——日 01–31 / 时 00–23）",
    );
  }
  if (validityResult.kind === "absent") {
    throw new MetarParseError(
      "missing-validity",
      xml,
      "无法识别有效期组（validPeriod 缺失或 begin/end 不可解析——NIL 缺报除外）",
    );
  }
  const validity = validityResult.validity;

  // —— CNL：预报取消——有效期仍在（发布与覆盖窗信息不丢），正文到此截断（与 TAC CNL 同语义）
  if (cancelled) {
    if (base !== undefined) {
      warnings.push({
        code: "cross-check-conflict",
        severity: "warning",
        message:
          "isCancelReport=true（取消报）与 baseForecast 并存（取消报无正文语义）——按取消收，正文不解析，矛盾出声",
      });
    }
    return {
      kind: "taf",
      raw: xml,
      station,
      issueTime,
      validity,
      cancelled: true,
      flags: { amended, corrected },
      cavok: false,
      changes: [],
      temperatures: [],
      remarks: [],
      warnings,
    };
  }

  // —— 基况段（baseForecast 内层预报体；复用观测侧同一套要素解析件）
  // 类型收口：base 缺席且非取消的形态已在上方 NIL 分支返回——此处不可达，防御性失败保持类型完备
  if (base === undefined) {
    throw new MetarParseError("missing-validity", xml, "无法识别基况段（baseForecast 缺失）");
  }
  const forecast = base;
  const cavok = attr(forecast, "cloudAndVisibilityOK") === "true";
  // cavokSpan＝cloudAndVisibilityOK 属性出现区间（与观测侧同契约——变化组元素上同名属性不误取）
  const cavokSpan = cavok
    ? attrSpanOf(xml, spanOf(forecast), "cloudAndVisibilityOK", "true")
    : undefined;
  if (attr(forecast, "changeIndicator") !== undefined) {
    warnings.push({
      code: "invalid-format",
      severity: "info",
      message:
        "基况段带 changeIndicator（baseForecast 无变化语义——XSD 明文该属性须在变化组）——照常收下",
      ...(spanOf(forecast) !== undefined ? { span: spanOf(forecast) } : {}),
    });
  }

  let wind: TafReport["wind"];
  const surfaceWindProp = objChild(forecast, "surfaceWind");
  if (surfaceWindProp !== undefined) {
    if (isNilProp(surfaceWindProp)) {
      warnUnknownNil(
        "风组",
        nilWordOf(attr(surfaceWindProp, "nilReason")),
        warnings,
        spanOf(surfaceWindProp),
      );
      wind = {
        kind: "missing",
        ...(spanOf(surfaceWindProp) !== undefined ? { span: spanOf(surfaceWindProp) } : {}),
      };
    } else {
      const w = surfaceWindOf(surfaceWindProp, "风组", warnings, xml);
      wind =
        w === "missing"
          ? {
              kind: "missing",
              ...(spanOf(surfaceWindProp) !== undefined ? { span: spanOf(surfaceWindProp) } : {}),
            }
          : {
              kind: "value",
              value: w,
              ...(spanOf(surfaceWindProp) !== undefined ? { span: spanOf(surfaceWindProp) } : {}),
            };
    }
  }

  let visibility: TafReport["visibility"];
  const visNode = objChild(forecast, "prevailingVisibility");
  if (visNode !== undefined) {
    const v = visibilityOf(forecast, warnings, xml);
    visibility =
      v === undefined
        ? { kind: "missing" }
        : {
            kind: "value",
            value: v,
            ...(spanOf(visNode) !== undefined ? { span: spanOf(visNode) } : {}),
          };
  }

  let weather: TafReport["weather"];
  const wxProps = forecast["weather"];
  if (wxProps !== undefined) {
    const first = firstOf(wxProps);
    if (isObj(first) && isNilProp(first)) {
      // 基况段 nil 天气：nothingOfOperationalSignificance＝无重要天气预告（NSW 语义）——
      // TAC 基况语汇无 NSW 位（NSW 属变化组），按组省略收下；missing/未识别词按缺测收
      const word = nilWordOf(attr(first, "nilReason"));
      if (word === NIL_NOTHING_OF_OPERATIONAL_SIGNIFICANCE) {
        warnings.push({
          code: "invalid-format",
          severity: "info",
          message:
            "基况段天气 nil（nothingOfOperationalSignificance——无重要天气预告）：TAC 基况语汇无 NSW 位，按组省略收下",
          ...(spanOf(first) !== undefined ? { span: spanOf(first) } : {}),
        });
      } else {
        warnUnknownNil("基况段天气", word, warnings, spanOf(first));
        weather = {
          kind: "missing",
          ...(spanOf(first) !== undefined ? { span: spanOf(first) } : {}),
        };
      }
    } else {
      const list = Array.isArray(wxProps) ? wxProps : [wxProps];
      const groups: WeatherGroup[] = [];
      for (const item of list) {
        if (!isObj(item) || isNilProp(item)) continue;
        const tail = codeTailOf(item);
        if (tail === undefined) continue;
        const g = weatherGroupOfCode(tail, "基况段天气", warnings);
        if (g !== undefined) {
          const itemSpan = spanOf(item);
          groups.push(itemSpan !== undefined ? { ...g, span: itemSpan } : g);
        }
      }
      if (groups.length > 0) {
        const env = envelopeOf(...groups.map((g) => g.span));
        weather = { kind: "value", value: groups, ...(env !== undefined ? { span: env } : {}) };
      }
    }
  }

  let clouds: CloudCondition | undefined;
  const cloudProp = objChild(forecast, "cloud");
  if (cloudProp !== undefined) {
    clouds = isNilProp(cloudProp)
      ? cloudNilOf(cloudProp, warnings)
      : cloudsOf(cloudProp, "基况段", warnings, xml);
  }

  const temperatures = tafTemperaturesOf(forecast, gmlIds, warnings);

  // —— CAVOK 让位自洽（与观测侧同款：true 时三组不应在场；在场即矛盾出声、让位照旧）
  if (cavok && (visibility !== undefined || weather !== undefined || clouds !== undefined)) {
    warnings.push({
      code: "cross-check-conflict",
      severity: "warning",
      message:
        "cloudAndVisibilityOK=true 与能见度/天气/云组并存（CAVOK 语义要求三组让位）——按 CAVOK 收，矛盾出声",
    });
  }
  if (cavok) {
    visibility = undefined;
    weather = undefined;
    clouds = undefined;
  }

  // —— 变化组序列（changeForecast×n：changeIndicator ↔ FM/BECMG/TEMPO/PROB[ TEMPO]；
  //  时窗＝phenomenonTime，要素复用 trendElementsOf——TAF 变化组与 METAR 趋势段同构）
  const changes: TafChangeGroup[] = [];
  const changeProps = root["changeForecast"];
  if (changeProps !== undefined) {
    const list = Array.isArray(changeProps) ? changeProps : [changeProps];
    for (const item of list) {
      if (!isObj(item)) continue;
      const body = objChild(item, "MeteorologicalAerodromeForecast");
      if (body === undefined) {
        warnings.push({
          code: "invalid-format",
          severity: "info",
          message: "变化组缺内层预报体（MeteorologicalAerodromeForecast）——该组跳过",
          ...(spanOf(item) !== undefined ? { span: spanOf(item) } : {}),
        });
        continue;
      }
      const head = changeKindOf(attr(body, "changeIndicator"));
      if (!head.known) {
        warnings.push({
          code: "invalid-format",
          severity: "info",
          message: `变化组 changeIndicator 未识别（${attr(body, "changeIndicator") ?? "无"}）——按渐变收下`,
          ...(spanOf(item) !== undefined ? { span: spanOf(item) } : {}),
        });
      }
      const timing = tafTimingOf(body, head.kind, gmlIds, warnings);
      const elements = trendElementsOf(body, warnings, xml, "变化组");
      changes.push({
        kind: head.kind,
        ...(head.probability !== undefined ? { probability: head.probability } : {}),
        ...(head.withTempo === true ? { withTempo: true } : {}),
        ...(timing.at !== undefined ? { at: timing.at } : {}),
        ...(timing.window !== undefined ? { window: timing.window } : {}),
        ...(elements !== undefined ? { elements } : {}),
        raw: `${changeHeadTextOf(head, timing)} ${forecastBodyParts(body).join(" ")}`.trim(),
        // 变化组区间＝changeForecast property wrapper 元素全体（raw 是重建串非原文，span 是源锚点）
        ...(spanOf(item) !== undefined ? { span: spanOf(item) } : {}),
      });
      // 变化组内未知元素出声（温度组只应在基况段——XSD 明文；在位即出声跳过）
      for (const key of Object.keys(body)) {
        if (key.startsWith("@_") || KNOWN_FORECAST_KEYS.has(key)) continue;
        warnings.push({
          code: "unknown-token",
          severity: "info",
          message: `变化组内未知元素（${key}）——已跳过，原文经 raw 保真`,
        });
      }
    }
  }

  // —— 基况段/根级未知元素出声（不静默纪律；#text 混排键除外——fast-xml-parser 文本键）
  for (const key of Object.keys(forecast)) {
    if (key.startsWith("@_") || key === "#text" || KNOWN_FORECAST_KEYS.has(key)) continue;
    warnings.push({
      code: "unknown-token",
      severity: "info",
      message: `基况段内未知元素（${key}）——已跳过，原文经 raw 保真`,
    });
  }
  for (const key of Object.keys(root)) {
    if (key.startsWith("@_") || key === "#text" || KNOWN_TAF_ROOT_KEYS.has(key)) continue;
    warnings.push({
      code: "unknown-token",
      severity: "info",
      message: `TAF 根内未知元素（${key}）——已跳过，原文经 raw 保真`,
    });
  }

  return {
    kind: "taf",
    raw: xml,
    station,
    issueTime,
    validity,
    flags: { amended, corrected },
    ...(wind !== undefined ? { wind } : {}),
    ...(visibility !== undefined ? { visibility } : {}),
    ...(weather !== undefined ? { weather } : {}),
    ...(clouds !== undefined ? { clouds } : {}),
    cavok,
    ...(cavokSpan !== undefined ? { cavokSpan } : {}),
    changes,
    temperatures,
    remarks: [],
    warnings,
  };
}

// ---------------------------------------------------------------- 观测容器定位（版本分派层）

/**
 * observation 容器定位——版本间结构差异的唯一分叉点，字段解析逻辑两版本共用一套：
 * - 2023-1 / 2025-2（两版 XSD 实证：observation 均为 MeteorologicalAerodromeObservationPropertyType）：
 *   `iwxxm:observation` 直达 `iwxxm:MeteorologicalAerodromeObservation`——官方等价对（Amd79-80-2023）
 *   与 AWC 2025-2 实时流双方样本一致；
 * - 旧 OM 架构族（2.1/2016-2018）：`om:OM_Observation` 包装、观测体挂 om:result 下——防御性
 *   下钻兼容（该族站点导航结构不同，实际输入在 missing-station 层提前失败；此路径为结构演化
 *   预留，现存语料无样本验证）。
 */
function observationBodyOf(observationProp: XNode | undefined): XNode | undefined {
  const direct = objChild(observationProp, "MeteorologicalAerodromeObservation");
  if (direct !== undefined) return direct;
  const om = objChild(observationProp, "OM_Observation");
  if (om === undefined) return undefined;
  return objChild(objChild(om, "result"), "MeteorologicalAerodromeObservation");
}

// ---------------------------------------------------------------- 主入口

/** collect:MeteorologicalBulletin（WMO collect 2014）包裹下按文档序找首个 METAR/SPECI/TAF
 *  （ECCC 真实流形态——TAF 公报一裹多报，METAR/SPECI 优先序在先以兼容混裹形态）。 */
function unbundleCollect(bulletin: XNode): { root: XNode; kind: ReportKind | "taf" } | undefined {
  const infos = bulletin["meteorologicalInformation"];
  const list: unknown[] = Array.isArray(infos) ? infos : infos !== undefined ? [infos] : [];
  for (const item of list) {
    if (!isObj(item)) continue;
    if (isObj(item.METAR)) return { root: item.METAR, kind: "metar" };
    if (isObj(item.SPECI)) return { root: item.SPECI, kind: "speci" };
    if (isObj(item.TAF)) return { root: item.TAF, kind: "taf" };
  }
  return undefined;
}

/**
 * parseIwxxm 的产物：按根元素分派——METAR/SPECI → MetarReport（观测侧 IR）、TAF → TafReport
 * （预报侧 IR）。两份 IR 的 `kind` 位即判别器（"metar"/"speci" vs "taf"），消费方据此收窄。
 */
export type IwxxmReport = MetarReport | TafReport;

/**
 * Parse one IWXXM METAR/SPECI/TAF XML document into the same IR as the TAC-side `parse`/`parseTaf`.
 * 解析单份 IWXXM（2023-1/2025-2 目标版）METAR/SPECI/TAF XML 为 IR——与 TAC 侧同契约，按根分派。
 *
 * Throws MetarParseError on whole-document failure（非字符串输入 / 非 XML / 无 IWXXM 命名空间 /
 * 根非 METAR-SPECI-TAF（含 SIGMET 等其他产品族）/ 无站名 / 无时组 / 时组越界 / TAF 无有效期或
 * 有效期越界 / strict 未实现 / xlink:href 电码引用含非法百分号编码）；
 * 未知元素与结构异常进 warnings[]，绝不静默。
 * @param xml - IWXXM 文档原文（原样保真于 report.raw）。
 * @param options - 见 IwxxmParseOptions（容忍模式位）。
 */
export function parseIwxxm(xml: string, options?: IwxxmParseOptions): IwxxmReport {
  if (typeof xml !== "string") {
    throw new MetarParseError(
      "invalid-input",
      String(xml),
      `parseIwxxm 需要一个 IWXXM XML 文档字符串，收到 ${xml === null ? "null" : typeof xml}`,
    );
  }
  try {
    return parseIwxxmBody(xml, options);
  } catch (err) {
    // 契约：整体失败必为 MetarParseError。URIError 来自 decodeURIComponent（xlink:href
    // 尾段含非法百分号编码，如 %ZZ）——输入缺陷而非实现缺陷，收敛为 invalid-input；
    // 其余异常原样上抛（不吞实现缺陷，与 tryParseIwxxm 同哲学）。
    if (err instanceof URIError) {
      throw new MetarParseError(
        "invalid-input",
        xml,
        `xlink:href 电码引用含非法百分号编码（${err.message}）——输入不是合法 IWXXM 文档`,
      );
    }
    throw err;
  }
}

function parseIwxxmBody(xml: string, options?: IwxxmParseOptions): IwxxmReport {
  if ((options?.mode ?? "tolerant") === "strict") {
    throw new MetarParseError(
      "unsupported-mode",
      xml,
      "IWXXM 侧 strict 模式尚未实现——请省略 mode 或显式传 'tolerant'",
    );
  }
  const warnings: ParseWarning[] = [];

  // —— 版本探测：文档内一切 xmlns 声明里找 IWXXM 家族 URI（前缀任意，含缺省命名空间）
  let iwxxmVersion: string | undefined;
  for (const m of xml.matchAll(NS_DECLARATION)) {
    const hit = IWXXM_NS.exec(m[1] ?? "");
    if (hit !== null) {
      iwxxmVersion = hit[1];
      break;
    }
  }
  if (iwxxmVersion === undefined) {
    throw new MetarParseError(
      "invalid-input",
      xml,
      '未找到 IWXXM 命名空间声明（xmlns…="http://icao.int/iwxxm/…"）——输入不是 IWXXM 文档',
    );
  }
  if (!SUPPORTED_VERSIONS.has(iwxxmVersion)) {
    warnings.push({
      code: "invalid-format",
      severity: "info",
      message: `IWXXM 版本 ${iwxxmVersion} 非支持版本（${SUPPORTED_VERSION_TEXT}）——按同名空间元素尽力解析`,
    });
  }

  // —— 结构解析（选项固化见 PARSER_OPTIONS 注释；PARSER 为模块级单例，parse 无跨调用状态）
  let parsed: unknown;
  try {
    parsed = PARSER.parse(xml);
  } catch (err) {
    throw new MetarParseError(
      "invalid-input",
      xml,
      `XML 语法解析失败（${err instanceof Error ? err.message : String(err)}）——输入不是合法 XML 文档`,
    );
  }
  const doc: XNode = isObj(parsed) ? parsed : {};

  // —— 根定位：METAR/SPECI/TAF 直根，或 collect 包裹（ECCC 真实流形态）
  let kind: ReportKind | "taf";
  let root: XNode;
  if (isObj(doc.METAR)) {
    root = doc.METAR;
    kind = "metar";
  } else if (isObj(doc.SPECI)) {
    root = doc.SPECI;
    kind = "speci";
  } else if (isObj(doc.TAF)) {
    root = doc.TAF;
    kind = "taf";
  } else if (isObj(doc.MeteorologicalBulletin)) {
    const found = unbundleCollect(doc.MeteorologicalBulletin);
    if (found === undefined) {
      throw new MetarParseError(
        "invalid-input",
        xml,
        "collect 包裹内未找到 METAR/SPECI/TAF 报文——输入不是本解析器的目标文档",
      );
    }
    ({ root, kind } = found);
  } else {
    throw new MetarParseError(
      "invalid-input",
      xml,
      "根元素不是 iwxxm:METAR / iwxxm:SPECI / iwxxm:TAF——输入不是本解析器的目标文档",
    );
  }

  // 紧凑模式（spans:false）：出口重建式剥除全部 span（与 TAC 侧 parse 同一 compactNode 实现）。
  // 定义在首个出口（TAF/NIL 早退）之前——TAF 与 NIL 报同样走紧凑收口，与非 NIL 主路径口径一致。
  const compact = options?.spans === false;

  // —— TAF 分派（v0.3 遗留项 1）：独立 IR 根（TafReport），版本告警已在 warnings 中
  if (kind === "taf") {
    const report = parseTafIwxxmBody(xml, root, warnings, iwxxmVersion);
    return compact ? compactNode(report) : report;
  }

  const gmlIds = indexGmlIds(root);

  // —— 报头：站名 / 观测时组 / 标志位（featureOfInterest 的机场坐标不入 IR——IR 无此位，快照原样在 raw）
  const airport = objChild(
    objChild(objChild(objChild(root, "aerodrome"), "AirportHeliport"), "timeSlice"),
    "AirportHeliportTimeSlice",
  );
  const station = textChild(airport, "locationIndicatorICAO");
  if (station === undefined || !/^[A-Z0-9]{4}$/.test(station)) {
    throw new MetarParseError(
      "missing-station",
      xml,
      `无法识别站名（aerodrome→locationIndicatorICAO 缺失或非四字码：${station ?? "无"}${
        !SUPPORTED_VERSIONS.has(iwxxmVersion)
          ? `；文档版本 ${iwxxmVersion} 非支持版本 ${SUPPORTED_VERSION_TEXT}——旧版（2.1/2016-2018 OM 架构族）的站点导航结构不同，本解析器面向 2023-1/2025-2 的结构`
          : ""
      }）`,
    );
  }
  const time = instantOf(objChild(root, "observationTime"), gmlIds, warnings);
  if (time === undefined) {
    throw new MetarParseError(
      "missing-time",
      xml,
      "无法识别观测时组（observationTime 缺失或 timePosition 不可解析）",
    );
  }
  if (time.day < 1 || time.day > 31 || time.hour > 23 || time.minute > 59) {
    throw new MetarParseError(
      "invalid-time",
      xml,
      `观测时刻越界（日${time.day}/时${time.hour}/分${time.minute}）`,
    );
  }
  // AMENDMENT 是「修订」非「更正」（与 TAC 侧 AMD 同判），IR 无 amended 位——只认 CORRECTION
  const corrected = attr(root, "reportStatus") === "CORRECTION";
  const auto = attr(root, "automatedStation") === "true";

  // —— NIL：observation 整体缺失或 xsi:nil ＝台站无观测——IR 最小形态（nilReason 词未识别时出声）
  const observationProp = objChild(root, "observation");
  const observation = observationBodyOf(observationProp);
  if (observation === undefined) {
    warnUnknownNil("NIL 报 observation", nilWordOf(attr(observationProp, "nilReason")), warnings);
    const nilReport: MetarReport = {
      kind,
      raw: xml,
      nil: true,
      station,
      time,
      flags: { auto, corrected },
      cavok: false,
      trends: [],
      runwayStates: [],
      remarks: [],
      warnings,
    };
    return compact ? compactNode(nilReport) : nilReport;
  }

  // —— 观测主体
  const cavok = attr(observation, "cloudAndVisibilityOK") === "true";
  // cavokSpan＝cloudAndVisibilityOK 属性出现区间（观测开标签内检索——趋势元素上同名属性不误取）
  const cavokSpan = cavok
    ? attrSpanOf(xml, spanOf(observation), "cloudAndVisibilityOK", "true")
    : undefined;

  let wind: MetarReport["wind"];
  const surfaceWindProp = objChild(observation, "surfaceWind");
  if (surfaceWindProp !== undefined) {
    if (isNil(surfaceWindProp)) {
      warnUnknownNil(
        "风组",
        nilWordOf(attr(surfaceWindProp, "nilReason")),
        warnings,
        spanOf(surfaceWindProp),
      );
      wind = {
        kind: "missing",
        ...(spanOf(surfaceWindProp) !== undefined ? { span: spanOf(surfaceWindProp) } : {}),
      };
    } else {
      const w = surfaceWindOf(surfaceWindProp, "风组", warnings, xml);
      wind =
        w === "missing"
          ? {
              kind: "missing",
              ...(spanOf(surfaceWindProp) !== undefined ? { span: spanOf(surfaceWindProp) } : {}),
            }
          : {
              kind: "value",
              value: w,
              ...(spanOf(surfaceWindProp) !== undefined ? { span: spanOf(surfaceWindProp) } : {}),
            };
    }
  }

  let visibility: MetarReport["visibility"];
  const visProp = objChild(observation, "visibility");
  if (visProp !== undefined) {
    if (isNil(visProp)) {
      warnUnknownNil("能见度组", nilWordOf(attr(visProp, "nilReason")), warnings, spanOf(visProp));
      visibility = {
        kind: "missing",
        ...(spanOf(visProp) !== undefined ? { span: spanOf(visProp) } : {}),
      };
    } else {
      const v = visibilityOf(visProp, warnings, xml);
      if (v !== undefined)
        visibility = {
          kind: "value",
          value: v,
          ...(spanOf(visProp) !== undefined ? { span: spanOf(visProp) } : {}),
        };
      else
        visibility = {
          kind: "missing",
          ...(spanOf(visProp) !== undefined ? { span: spanOf(visProp) } : {}),
        };
    }
  }

  let runwayVisualRange: MetarReport["runwayVisualRange"];
  const rvrProps = observation["rvr"];
  if (rvrProps !== undefined) {
    const first = firstOf(rvrProps);
    if (isObj(first) && isNil(first)) {
      warnUnknownNil("RVR 组", nilWordOf(attr(first, "nilReason")), warnings, spanOf(first));
      runwayVisualRange = {
        kind: "missing",
        ...(spanOf(first) !== undefined ? { span: spanOf(first) } : {}),
      };
    } else {
      const list = Array.isArray(rvrProps) ? rvrProps : [rvrProps];
      const rvrs: RunwayVisualRange[] = [];
      for (const item of list) {
        if (!isObj(item)) continue;
        const rvr = rvrOf(item, gmlIds, warnings);
        if (rvr !== undefined) rvrs.push(rvr);
      }
      // 组级 span＝外包络（契约见 core Span 注释）：首条 rvr 元素首至末条末；逐条区间在各元素 span
      if (rvrs.length > 0) {
        const rvrEnvelope = envelopeOf(...rvrs.map((r) => r.span));
        runwayVisualRange = {
          kind: "value",
          value: rvrs,
          ...(rvrEnvelope !== undefined ? { span: rvrEnvelope } : {}),
        };
      }
    }
  }

  let weather: MetarReport["weather"];
  let recentWeather: WeatherGroup[] | undefined;
  const wxProps = observation["presentWeather"];
  if (wxProps !== undefined) {
    const first = firstOf(wxProps);
    if (isObj(first) && isNil(first)) {
      warnUnknownNil("天气组", nilWordOf(attr(first, "nilReason")), warnings, spanOf(first));
      weather = {
        kind: "missing",
        ...(spanOf(first) !== undefined ? { span: spanOf(first) } : {}),
      };
    } else {
      const list = Array.isArray(wxProps) ? wxProps : [wxProps];
      const groups: WeatherGroup[] = [];
      for (const item of list) {
        if (!isObj(item) || isNil(item)) continue;
        const tail = codeTailOf(item);
        if (tail === undefined) continue;
        const g = weatherGroupOfCode(tail, "现在天气", warnings);
        if (g !== undefined) {
          const itemSpan = spanOf(item);
          groups.push(itemSpan !== undefined ? { ...g, span: itemSpan } : g);
        }
      }
      // 组级 span＝外包络（同 RVR 口径）
      if (groups.length > 0) {
        const wxEnvelope = envelopeOf(...groups.map((g) => g.span));
        weather = {
          kind: "value",
          value: groups,
          ...(wxEnvelope !== undefined ? { span: wxEnvelope } : {}),
        };
      }
    }
  }
  const recentProps = observation["recentWeather"];
  if (recentProps !== undefined) {
    const list = Array.isArray(recentProps) ? recentProps : [recentProps];
    const groups: WeatherGroup[] = [];
    for (const item of list) {
      if (!isObj(item) || isNil(item)) continue;
      const tail = codeTailOf(item);
      if (tail === undefined) continue;
      const g = weatherGroupOfCode(tail, "近期天气", warnings);
      if (g !== undefined) {
        const itemSpan = spanOf(item);
        groups.push(itemSpan !== undefined ? { ...g, span: itemSpan } : g);
        if (g.intensity !== undefined) {
          warnings.push({
            code: "invalid-format",
            severity: "info",
            message: `近期天气组带强度符（${tail}——RE 组无强度位）——已收下`,
            ...(itemSpan !== undefined ? { span: itemSpan } : {}),
          });
        }
      }
    }
    if (groups.length > 0) recentWeather = groups;
  }

  let clouds: CloudCondition | undefined;
  const cloudProp = objChild(observation, "cloud");
  if (cloudProp !== undefined && isNilProp(cloudProp)) {
    // 无云族：nilReason 承载（D0 ④）——四码收敛为代表电码，细辨不可还原，info 出声
    clouds = cloudNilOf(cloudProp, warnings);
  } else if (cloudProp !== undefined) {
    clouds = cloudsOf(cloudProp, "观测", warnings, xml);
  }

  let temperature: TemperatureReading | undefined;
  let dewpoint: TemperatureReading | undefined;
  for (const [key, isTemp] of [
    ["airTemperature", true],
    ["dewpointTemperature", false],
  ] as const) {
    const node = objChild(observation, key);
    const value = numChild(observation, key);
    if (node === undefined || isNil(node) || value === undefined) continue;
    if (attr(node, "uom") !== "Cel") {
      warnings.push({
        code: "invalid-format",
        severity: "info",
        message: `${key} 单位非摄氏度（uom="${attr(node, "uom") ?? "无"}"）——该读数跳过`,
      });
      continue;
    }
    if (value < TEMP_C_MIN || value > TEMP_C_MAX) {
      warnings.push({
        code: "value-out-of-range",
        severity: "warning",
        message: `${key} 越界（${value}°C 超物理范围）——该读数不可信跳过`,
      });
      continue;
    }
    if (isTemp)
      temperature = {
        celsius: value,
        ...(spanOf(node) !== undefined ? { span: spanOf(node) } : {}),
      };
    else
      dewpoint = { celsius: value, ...(spanOf(node) !== undefined ? { span: spanOf(node) } : {}) };
  }

  let altimeter: AltimeterReading | undefined;
  const qnhNode = objChild(observation, "qnh");
  const qnhValue = numChild(observation, "qnh");
  if (qnhNode !== undefined && !isNil(qnhNode) && qnhValue !== undefined) {
    const unit = PRESSURE_UOM[attr(qnhNode, "uom") ?? ""];
    if (unit === undefined) {
      warnings.push({
        code: "invalid-format",
        severity: "info",
        message: `QNH 单位未识别（uom="${attr(qnhNode, "uom") ?? "无"}"）——气压读数跳过`,
        ...(spanOf(qnhNode) !== undefined ? { span: spanOf(qnhNode) } : {}),
      });
    } else if (
      (unit === "hPa" && (qnhValue < QNH_HPA_MIN || qnhValue > QNH_HPA_MAX)) ||
      (unit === "inHg" && (qnhValue < ALT_INHG_MIN || qnhValue > ALT_INHG_MAX))
    ) {
      warnings.push({
        code: "value-out-of-range",
        severity: "warning",
        message: `QNH 越界（${qnhValue} ${unit}）——气压读数不可信跳过`,
        ...(spanOf(qnhNode) !== undefined ? { span: spanOf(qnhNode) } : {}),
      });
    } else {
      altimeter = {
        value: qnhValue,
        unit,
        ...(spanOf(qnhNode) !== undefined ? { span: spanOf(qnhNode) } : {}),
      };
    }
  }

  // —— 风切变（NTAA 官方对：runway 设计器列表 + allRunways 布尔）
  let windShear: MetarReport["windShear"];
  const shearProp = objChild(observation, "windShear");
  if (shearProp !== undefined && !isNil(shearProp)) {
    const body = objChild(shearProp, "AerodromeWindShear") ?? shearProp;
    const runwayNodes = Array.isArray(body["runway"]) ? (body["runway"] as unknown[]) : [];
    const runways: string[] = [];
    for (const rn of runwayNodes) {
      if (!isObj(rn)) continue;
      const designator = runwayDesignatorOf(rn, gmlIds);
      if (designator !== undefined) runways.push(designator);
    }
    windShear = {
      runways,
      allRunways: attr(body, "allRunways") === "true",
      ...(spanOf(shearProp) !== undefined ? { span: spanOf(shearProp) } : {}),
    };
  }

  // —— 跑道状态组（D0 复核：IWXXM 2023-1 有专门建模——调研报告难点 2「无对应元素」结论已证伪）
  const runwayStates: RunwayStateGroup[] = [];
  const stateProps = observation["runwayState"];
  if (stateProps !== undefined) {
    const list = Array.isArray(stateProps) ? stateProps : [stateProps];
    for (const item of list) {
      if (!isObj(item)) continue;
      if (isNil(item)) {
        // runwayState nil(inapplicable) ＝全机场跑道关闭（XSD 注释实证；TAC R/SNOCLO 同构）
        runwayStates.push({
          runway: "",
          closed: true,
          cleared: false,
          deposit: null,
          coverage: null,
          depth: null,
          ...(spanOf(item) !== undefined ? { span: spanOf(item) } : {}),
        });
        continue;
      }
      const st = runwayStateOf(item, gmlIds, warnings);
      runwayStates.push(spanOf(item) !== undefined ? { ...st, span: spanOf(item) } : st);
    }
  }

  // —— 未知/无位观测子元素出声（已知键之外的元素名；seaCondition 单列说明）
  const KNOWN_OBS_KEYS: ReadonlySet<string> = new Set([
    "airTemperature",
    "dewpointTemperature",
    "qnh",
    "surfaceWind",
    "visibility",
    "rvr",
    "presentWeather",
    "cloud",
    "recentWeather",
    "windShear",
    "seaCondition",
    "runwayState",
    "extension",
  ]);
  for (const key of Object.keys(observation)) {
    if (key.startsWith("@_") || KNOWN_OBS_KEYS.has(key)) {
      if (key === "seaCondition") {
        warnings.push({
          code: "unknown-token",
          severity: "info",
          message: "海况组（seaCondition）在 IR 无对应位——已跳过（原文经 raw 可回溯）",
        });
      }
      continue;
    }
    warnings.push({
      code: "unknown-token",
      severity: "info",
      message: `观测内未知元素（${key}）——已跳过，原文经 raw 保真`,
    });
  }

  // —— CAVOK 让位自洽（XML 侧同款：true 时三组不应在场；在场即矛盾出声、让位照旧）
  if (cavok && (visibility !== undefined || weather !== undefined || clouds !== undefined)) {
    warnings.push({
      code: "cross-check-conflict",
      severity: "warning",
      message:
        "cloudAndVisibilityOK=true 与能见度/天气/云组并存（CAVOK 语义要求三组让位）——按 CAVOK 收，矛盾出声",
    });
  }
  if (cavok) {
    visibility = undefined;
    weather = undefined;
    clouds = undefined;
  }

  // —— 趋势组
  const trends: TrendGroup[] = [];
  const trendProps = root["trendForecast"];
  if (trendProps !== undefined) {
    const list = Array.isArray(trendProps) ? trendProps : [trendProps];
    for (const item of list) {
      if (!isObj(item)) continue;
      if (isNil(item)) {
        // NOSIG ＝ trendForecast xsi:nil + noSignificantChange（EETN/EKCH 官方对实证）
        const word = nilWordOf(attr(item, "nilReason"));
        if (word !== NIL_NO_SIGNIFICANT_CHANGE) {
          warnings.push({
            code: "invalid-format",
            severity: "info",
            message: `趋势组 nilReason 选词未识别（${word ?? "无"}）——按无显著变化收下`,
            ...(spanOf(item) !== undefined ? { span: spanOf(item) } : {}),
          });
        }
        trends.push({
          kind: "nosig",
          raw: "NOSIG",
          ...(spanOf(item) !== undefined ? { span: spanOf(item) } : {}),
        });
        continue;
      }
      const trend = objChild(item, "MeteorologicalAerodromeTrendForecast") ?? item;
      const change = attr(trend, "changeIndicator");
      const trendKind: "becmg" | "tempo" = change === "TEMPORARY_FLUCTUATIONS" ? "tempo" : "becmg";
      if (change !== "TEMPORARY_FLUCTUATIONS" && change !== "BECOMING") {
        warnings.push({
          code: "invalid-format",
          severity: "info",
          message: `趋势 changeIndicator 未识别（${change ?? "无"}）——按渐变收下`,
          ...(spanOf(trend) !== undefined ? { span: spanOf(trend) } : {}),
        });
      }
      const period = trendPeriodOf(trend, gmlIds, xml, warnings);
      trends.push({
        kind: trendKind,
        ...(period !== undefined ? { period } : {}),
        elements: trendElementsOf(trend, warnings, xml),
        raw: rebuildTrendRaw(trendKind, period?.text, trend),
        // 趋势段区间＝trendForecast 元素全体（raw 是重建串非原文，span 才是 XML 源锚点）
        ...(spanOf(item) !== undefined ? { span: spanOf(item) } : {}),
      });
    }
  }

  // 紧凑模式（spans:false）：出口重建式剥除全部 span（与 TAC 侧 parse 同一 compactNode 实现）
  const report: MetarReport = {
    kind,
    raw: xml,
    station,
    time,
    flags: { auto, corrected },
    cavok,
    ...(cavokSpan !== undefined ? { cavokSpan } : {}),
    ...(wind !== undefined ? { wind } : {}),
    ...(visibility !== undefined ? { visibility } : {}),
    ...(runwayVisualRange !== undefined ? { runwayVisualRange } : {}),
    ...(weather !== undefined ? { weather } : {}),
    ...(recentWeather !== undefined ? { recentWeather } : {}),
    ...(clouds !== undefined ? { clouds } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(dewpoint !== undefined ? { dewpoint } : {}),
    ...(altimeter !== undefined ? { altimeter } : {}),
    trends,
    runwayStates,
    ...(windShear !== undefined ? { windShear } : {}),
    remarks: [],
    warnings,
  };
  return compact ? compactNode(report) : report;
}

/** Result-style parse outcome: never throws for parse-level failures — branch on `ok`（与 tryParse 同款）。 */
export type TryParseIwxxmResult =
  | { readonly ok: true; readonly report: IwxxmReport }
  | { readonly ok: false; readonly error: MetarParseError };

/** `parseIwxxm` 的问题式变体：整体失败返回 `{ ok:false, error }`，成功返回 `{ ok:true, report }`。 */
export function tryParseIwxxm(xml: string, options?: IwxxmParseOptions): TryParseIwxxmResult {
  try {
    return { ok: true, report: parseIwxxm(xml, options) };
  } catch (err) {
    if (err instanceof MetarParseError) return { ok: false, error: err };
    throw err;
  }
}

// 序列化层（v0.3 遗留项 5）：IR→IWXXM 生成出口——与本文件解析出口同子路径供给
//（./iwxxm 单入口双出口：体积敏感消费方一个子路径拿全双向；实现与施工底档见 ./iwxxm-emit 与
// docs/iwxxm-notes.md §十，映射字典同一份——本文件的解析即它的逆过程）
export { serializeIwxxm } from "./iwxxm-emit";
export type { IwxxmSerializeOptions, IwxxmSerializeVersion } from "./iwxxm-emit";
