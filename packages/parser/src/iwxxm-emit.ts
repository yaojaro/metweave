/**
 * @metweave/parser/iwxxm-emit — IR→IWXXM 序列化层：把与 TAC 侧 parse/parseTaf 同一份的
 * MetarReport/TafReport IR 写回 IWXXM XML 文本（2023-1 主出口；2025-2 同供）。解析层
 * （./iwxxm）的逆过程，映射字典同一份（docs/iwxxm-notes.md——「映射表即正向字典」）。
 *
 * 范围（v0.3 遗留项 5，2026-10-08 施工）：
 * - METAR/SPECI（kind 判别根元素）与 TAF 两侧；CNL（isCancelReport + cancelledReportValidPeriod）
 *   与 NIL（METAR observation xsi:nil / TAF 空载 baseForecast + nilReason missing——官方对 DAOY 形态）
 *   都能往返；
 * - 版本：2023-1（运营版）缺省，2025-2 同供（两版观测容器同构；真差异仅 2025-2 删跑道状态建模与
 *   rvr unbounded——序列化侧跑道状态组在 2025-2 出口下如实不落）；
 * - iwxxm-ca 等国家扩展、translationCentre 元数据等来源侧信息不在 IR 里，生成面不捏造
 *   （忠实原则：IR 有什么出什么）。
 *
 * 外部上下文（调研报告难点 11/12 的生成侧落位）：
 * - 日历上下文：IR 时组只有 ddHHMM（无年月位），gml:timePosition 是 xsd:dateTime 绝对时刻——
 *   年月必须由调用方经 calendar 选项注入；缺失即 invalid-input 整体失败（不猜不默认）；
 * - 站点元数据目录：aerodrome 只落 ICAO 四字码的最小合法快照（timeSlice SNAPSHOT + locationIndicatorICAO）；
 *   名称/IATA/ARP/标高不在 IR 里，不捏造。
 *
 * 结构形态全部取官方语料实证（wmo-im/iwxxm-translation Amd79-80-2023 等价对 + ECCC 真实流 +
 * AWC 2025-2 实时流）：nil 载体（Measure 带 uom="N/A"——gml:MeasureType 的 uom 属性必填）、
 * FM 时窗（begin=FM 时刻、end=同时刻 indeterminatePosition="after"——WSSS/VTUO 官方形）、
 * TL 时窗（begin=发报时刻 indeterminate after——ZSPD 官方形）、无时窗趋势（phenomenonTime
 * nilReason missing——EDDP 官方形）、SKC 云量位层形态（ECCC 实证）等。
 *
 * 有损面（TAC 源 IR 的单向损失，与两通道固有分歧同口径记档——详见 notes §十）：
 * - 能见度 sm / 气压 inHg / RVR ft：IWXXM 各元素量纲固定 m/hPa/m（Schematron RVR-1 明文 meanRVR
 *   以米报）——按固定系数折算（系数是本实现常量，非任一转换中心的官方折算表）；
 * - 无云四码：NSC/NCD 走 nilReason 承载（官方主流形态）；SKC 走云量位层形态（ECCC 实证，
 *   49-2 电码表本词无损）；CLR 无官方载体（49-2 电码表无此词）——收敛 nilReason
 *   notDetectedByAutoSystem（与解析侧 CLR/NCD 细辨不可还原同一纪律，回读为 NCD）；
 * - CAVOK 与三组并存的矛盾 IR：按 CAVOK 让位生成（三组不落 XML，与解析侧让位行为对称）；
 * - METAR 趋势 DDHH/DDHH 时窗（TAC 中国主流编法）：IWXXM 趋势时窗只有 AT/UNTIL/FM——窗起窗止
 *   双端点完整落位为 TimePeriod，timeIndicator 按 UNTIL 判读，回读 TL+窗止（窗起不保真）；kind 'unspecified' 趋势无对应 changeIndicator，按 BECOMING
 *   落位（与解析侧「未识别按渐变收」同口径的逆向）；
 * - RVR V 波动形态（min/max）：IWXXM 2023-1 只有 meanRVR 单值位——以 min 值落位（V 端不保真）；
 * - TAF 气温：XSD 一元素必载 TX/TN 双端（max/min + 两个达到时刻全必填）——IR 只有单端或达时刻
 *   缺日（ogimet 方言短形态）的读数组整体不落（不捏造另一端）；多组温度超 IWXXM 承载面——取
 *   首个 TX + 首个 TN 落一元素；
 * - TAF FM 硬时刻无日位（TafChangeAt 只有 GGgg）——日位取有效期起日直投影（锚定语义归展开层）；
 * - TAC 源逐道 SNOCLO 与深度位 99 关闭：XML 侧关闭只有 runwayState nil(inapplicable) 一形
 *  （无逐道载体）——跑道位不保真（回读为全机场形态）；
 * - TAF 基况段 prevailingVisibility/cloud（Schematron TAF-8 必填）：IR 组省略时如实不落（上游
 *   转换中心以补写 10000m+ABOVE 满足该条，本实现不捏造——偏差如实记档）；
 * - 趋势/预报体内的最低能见度（VisibilityGroup.minimum）：XSD 只在观测侧 AerodromeHorizontalVisibility
 *   有该组——观测位照落，趋势/TAF 位不落（XML 源 IR 在这两处本就无此组）；
 * - RMK 附加段：IWXXM 国际模型无位（难点 3），remarks 不落。
 *
 * 合规口径（遗留项 5「另需过 XSD + Schematron 双合规」的落位——详见 notes §十.3）：
 * - XSD：生成件经 xmllint + 官方 XSD 树（GML 3.2.1/AIXM 5.1.1/OM 全依赖，schemas.wmo.int 直取）
 *   全语料验证——施工时点全绿；
 * - Schematron：官方规则面 queryBinding="xslt2"（174 assert，需 Saxon/Java），按预案不做全量转译，
 *   核心断言子集（CAVOK 让位、RVR 量纲 m、cleared 与沉积位互斥、allRunways 与 runway 互斥等）
 *   固化为测试（iwxxm-emit.test.ts「Schematron 子集」组），偏差如实记档（TAF.TAF-8 见上有损面）。
 *
 * 错误面：整体失败抛 MetarParseError（code 沿既有稳定集，不新增）——calendar 缺失/非法、输入非
 * IR 形态、TAF NIL 无 issueTime（XSD 必填，TAC「无时组 NIL」形态在 XML 侧无载体，与解析侧同口径）
 * 走 invalid-input。
 */
import type {
  CloudCondition,
  MetarReport,
  RunwayVisualRange,
  TafChangeGroup,
  TafReport,
  TrendGroup,
  VisibilityGroup,
  WeatherGroup,
  WindGroup,
} from "@metweave/core";
import { MetarParseError } from "@metweave/core";
import type { IwxxmReport } from "./iwxxm";

// ---------------------------------------------------------------- 版本与命名空间

/** 序列化出口版本（解析侧 SUPPORTED_VERSIONS 同集）。 */
export type IwxxmSerializeVersion = "2023-1" | "2025-2";

/** 版本 → IWXXM 命名空间 URI（解析侧 IWXXM_NS 同族）。 */
const NS_IWXXM: Readonly<Record<IwxxmSerializeVersion, string>> = {
  "2023-1": "http://icao.int/iwxxm/2023-1",
  "2025-2": "http://icao.int/iwxxm/2025-2",
};
/** 版本 → schemaLocation 提示（解析器不读该属性——消费方 XSD 校验入口用）。 */
const SCHEMA_LOCATION: Readonly<Record<IwxxmSerializeVersion, string>> = {
  "2023-1": "https://schemas.wmo.int/iwxxm/2023-1/iwxxm.xsd",
  "2025-2": "https://schemas.wmo.int/iwxxm/2025-2/iwxxm.xsd",
};
const NS_AIXM = "http://www.aixm.aero/schema/5.1.1";
const NS_GML = "http://www.opengis.net/gml/3.2";
const NS_XLINK = "http://www.w3.org/1999/xlink";
const NS_XSI = "http://www.w3.org/2001/XMLSchema-instance";

// ---------------------------------------------------------------- 电码表 URI（解析侧同源逆向）

/** 4678 现在天气 URI（语料实证：URI 尾段与 TAC w'w' token 同构，如 +TSRA、-SHRASN、SHRASN）。 */
const uriWeather = (token: string): string => `http://codes.wmo.int/306/4678/${token}`;
/** 49-2 云量 URI（SKC/FEW/SCT/BKN/OVC；ECCC SKC 层形态实证）。 */
const uriCloudAmount = (code: string): string =>
  `http://codes.wmo.int/49-2/CloudAmountReportedAtAerodrome/${code}`;
/** 49-2 对流云型 URI（CB/TCU）。 */
const uriConvective = (code: string): string =>
  `http://codes.wmo.int/49-2/SigConvectiveCloudType/${code}`;
/** bufr4 电码表 URI（跑道状态三表：0-20-086 沉积 / 0-20-087 覆盖 / 0-20-089 摩擦）。 */
const uriBufr4 = (table: string, value: number): string =>
  `http://codes.wmo.int/bufr4/codeflag/${table}/${value}`;
/** WMO 通用 nil 词汇 URI。 */
const uriNil = (word: string): string => `http://codes.wmo.int/common/nil/${word}`;
/** 缺测载体选词（语料实证主流：量纲/组缺测 notObservable、RVR 缺测 missing、SKC 云底 inapplicable）。 */
const NIL_OBSERVABLE = "notObservable";
const NIL_MISSING = "missing";
const NIL_INAPPLICABLE = "inapplicable";
const NIL_NOTHING_OF_OPERATIONAL_SIGNIFICANCE = "nothingOfOperationalSignificance";
const NIL_NOT_DETECTED_BY_AUTO_SYSTEM = "notDetectedByAutoSystem";
const NIL_NO_SIGNIFICANT_CHANGE = "noSignificantChange";

// ---------------------------------------------------------------- 量纲换算（TAC 源 IR 的单向折算）

/** 英里 → 米（能见度；IWXXM 量纲固定 m）。 */
const SM_TO_M = 1609.344;
/** 英寸汞柱 → hPa（QNH；IWXXM 仅 hPa——XSD 明文）。 */
const INHG_TO_HPA = 33.8639;
/** 英尺 → 米（RVR；Schematron METAR_SPECI.AerodromeRunwayVisualRange-1 明文 meanRVR 以米报）。 */
const FT_TO_M = 0.3048;

// ---------------------------------------------------------------- 日历上下文（难点 12 生成侧落位）

/**
 * Options for `serializeIwxxm`：版本出口、日历上下文与许可用途占位。
 */
export interface IwxxmSerializeOptions {
  /** 目标版本：缺省 "2023-1"（运营版）；"2025-2" 同供（跑道状态组在 2025-2 出口下如实不落——schema 已删该建模） */
  readonly version?: IwxxmSerializeVersion;
  /**
   * 日历上下文（年月）：IR 时组只有 ddHHMM，绝对时刻（xsd:dateTime）的年月由此注入——
   * 缺失即 invalid-input 整体失败（不猜年月；跨月报文的归属由调用方按发报语境裁定）
   */
  readonly calendar?: { readonly year: number; readonly month: number };
  /**
   * 许可用途位（XSD BasicReportType 必填属性，IR 无来源——schema 占位，缺省 OPERATIONAL）；
   * 测试/演习报文的发布面按需显式传 NON-OPERATIONAL
   */
  readonly permissibleUsage?: "OPERATIONAL" | "NON-OPERATIONAL";
}

/** 年月上下文校验与固化（年 1600–9999 覆盖 xsd:dateTime 实用全域，月 01–12）。 */
function calendarOf(options: IwxxmSerializeOptions | undefined): {
  readonly year: number;
  readonly month: number;
} {
  const cal = options?.calendar;
  if (
    cal === undefined ||
    !Number.isInteger(cal.year) ||
    !Number.isInteger(cal.month) ||
    cal.year < 1600 ||
    cal.year > 9999 ||
    cal.month < 1 ||
    cal.month > 12
  ) {
    throw new MetarParseError(
      "invalid-input",
      JSON.stringify(cal ?? null),
      "IWXXM 序列化需要日历上下文（calendar.year/calendar.month）——IR 时组只有 ddHHMM 无年月位，绝对时刻（gml:timePosition）的年月必须由调用方注入，不猜不默认",
    );
  }
  return cal;
}

/**
 * 绝对时刻拼装（UTC）：年月由 calendar 注入、日时分来自 IR——Date.UTC 归一化承担月末回绕
 * （TAF 止时 24＝次日 00:00，与解析侧「止时直投影恒 00–23、24 午夜特例两态等价」同口径）。
 */
function isoOf(
  cal: { readonly year: number; readonly month: number },
  day: number,
  hour: number,
  minute = 0,
): string {
  return new Date(Date.UTC(cal.year, cal.month - 1, day, hour, minute))
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
}

// ---------------------------------------------------------------- XML 拼装小件

/** 属性值转义（& < > " 四字——XML 1.0 属性值最小集）。 */
const escAttr = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
/** 文本转义（& < > 三字）。 */
const escText = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** 数值 → XML 文本（IR 数值本就有限域——String 即十进制短表示）。 */
const numText = (value: number): string => String(value);

type Attrs = ReadonlyArray<readonly [string, string]>;

/** 序列化画布：行缓冲 + 缩进 + 确定性 gml:id 发号（快照稳定，不引入随机 uuid）。 */
class Emit {
  private readonly lines: string[] = [];
  private depth = 0;
  private seq = 0;

  /** 发一个 gml:id（mw.gen.N——NCName 合法、逐报递增确定性）。 */
  nextId(): string {
    this.seq += 1;
    return `mw.gen.${this.seq}`;
  }

  /** 原样行（XML 序言等）。 */
  line(text: string): void {
    this.lines.push(text);
  }

  open(tag: string, attrs: Attrs = []): void {
    this.lines.push(`${"  ".repeat(this.depth)}<${tag}${this.attrsText(attrs)}>`);
    this.depth += 1;
  }

  close(tag: string): void {
    this.depth -= 1;
    this.lines.push(`${"  ".repeat(this.depth)}</${tag}>`);
  }

  /** 自闭合元素。 */
  void(tag: string, attrs: Attrs = []): void {
    this.lines.push(`${"  ".repeat(this.depth)}<${tag}${this.attrsText(attrs)}/>`);
  }

  /** 带文本元素（文本转义）。 */
  text(tag: string, body: string, attrs: Attrs = []): void {
    this.lines.push(
      `${"  ".repeat(this.depth)}<${tag}${this.attrsText(attrs)}>${escText(body)}</${tag}>`,
    );
  }

  /** 空元素（如 gml:validTime——官方快照形态即空元素）。 */
  empty(tag: string): void {
    this.lines.push(`${"  ".repeat(this.depth)}<${tag}/>`);
  }

  toString(): string {
    return `${this.lines.join("\n")}\n`;
  }

  private attrsText(attrs: Attrs): string {
    return attrs.map(([name, value]) => ` ${name}="${escAttr(value)}"`).join("");
  }
}

// ---------------------------------------------------------------- 观测/预报共享组（解析侧 surfaceWindOf/visibilityOf/cloudsOf 的逆向）

/** 风速单位 → uom 精确串（解析侧 SPEED_UOM 逆向；D0 ⑦ 实证串）。 */
const SPEED_UOM_OUT: Readonly<Record<string, string>> = { kt: "[kn_i]", mps: "m/s", kmh: "km/h" };
/** 八方位词 → 度数（解析侧 dirWordOf 的逆向；最低能见度方向组用）。 */
const DIR_8_OUT: Readonly<Record<string, number>> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

/**
 * 风组 → AerodromeSurfaceWind* 元素（观测/趋势/TAF 预报三载体共用，bodyTag 定内层类型）。
 * 子元素顺序沿 XSD sequence：meanWindDirection → meanWindSpeed → Operator → windGustSpeed →
 * Operator → extremeClockwise → extremeCounterClockwise（官方语料实证 clockwise 在前；
 * 扇区两端逆向落位：ccw→min、cw→max 的逆写 max→clockwise、min→counterClockwise）。
 * 阈值风（beyond above）→ meanWindSpeedOperator ABOVE（P49 族同构）。
 */
function emitWind(emit: Emit, bodyTag: string, wind: WindGroup, extraAttrs: Attrs = []): void {
  emit.open("iwxxm:surfaceWind", []);
  emit.open(bodyTag, extraAttrs);
  if (wind.direction !== null) {
    emit.text("iwxxm:meanWindDirection", numText(wind.direction), [["uom", "deg"]]);
  }
  emit.text("iwxxm:meanWindSpeed", numText(wind.speed.value), [
    ["uom", SPEED_UOM_OUT[wind.speed.unit] ?? "m/s"],
  ]);
  if (wind.speed.beyond === "above") {
    emit.text("iwxxm:meanWindSpeedOperator", "ABOVE");
  }
  if (wind.gust !== undefined) {
    emit.text("iwxxm:windGustSpeed", numText(wind.gust.value), [
      ["uom", SPEED_UOM_OUT[wind.gust.unit] ?? "m/s"],
    ]);
    if (wind.gust.beyond === "above") {
      emit.text("iwxxm:windGustSpeedOperator", "ABOVE");
    }
  }
  if (wind.variation !== undefined) {
    emit.text("iwxxm:extremeClockwiseWindDirection", numText(wind.variation.max), [["uom", "deg"]]);
    emit.text("iwxxm:extremeCounterClockwiseWindDirection", numText(wind.variation.min), [
      ["uom", "deg"],
    ]);
  }
  emit.close(bodyTag);
  emit.close("iwxxm:surfaceWind");
}

/** variableWindDirection 属性（预报风载体 use="required"；观测侧官方语料同样显式给值）。 */
const variableAttrOf = (wind: WindGroup): readonly [string, string] => [
  "variableWindDirection",
  wind.variable ? "true" : "false",
];

/** 风组 Observed 载体（观测侧 surfaceWind 为 XSD 必填元素——缺测走 nil notObservable 官方载体）。 */
function emitWindObserved(emit: Emit, observed: MetarReport["wind"], bodyTag: string): void {
  if (observed === undefined || observed.kind === "missing") {
    emit.void("iwxxm:surfaceWind", [
      ["nilReason", uriNil(NIL_OBSERVABLE)],
      ["xsi:nil", "true"],
    ]);
    return;
  }
  emitWind(emit, bodyTag, observed.value, [variableAttrOf(observed.value)]);
}

/** 天气组 → 4678 token（强度/VC/描述符/现象拼装——与解析侧 parseWeatherBody 切解互逆）。 */
const weatherTokenOf = (group: WeatherGroup): string =>
  `${group.intensity ?? ""}${group.proximity ? "VC" : ""}${group.descriptor ?? ""}${group.phenomena.join("")}`;

/** 天气 Observed 载体（missing → nil notObservable；值组逐条 href 4678 URI）。 */
function emitWeatherObserved(emit: Emit, tag: string, observed: MetarReport["weather"]): void {
  if (observed === undefined) return;
  if (observed.kind === "missing") {
    emit.void(tag, [
      ["nilReason", uriNil(NIL_OBSERVABLE)],
      ["xsi:nil", "true"],
    ]);
    return;
  }
  for (const group of observed.value) {
    emit.void(tag, [["xlink:href", uriWeather(weatherTokenOf(group))]]);
  }
}

// ---------------------------------------------------------------- 云组（cloudsOf/cloudNilOf 的逆向）

/** 云底缺测位（ECCC 官方层形态实证：uom="N/A"——gml:MeasureType 的 uom 属性必填，空载以 N/A 占位）。 */
function emitNilBase(emit: Emit): void {
  emit.void("iwxxm:base", [
    ["uom", "N/A"],
    ["xsi:nil", "true"],
    ["nilReason", uriNil(NIL_INAPPLICABLE)],
  ]);
}

/** 无云电码 → 层形态（SKC 官方词无损；ECCC 实证的「云量位 + 云底 nil」载体）。 */
function emitClearLayer(emit: Emit, code: string): void {
  emit.open("iwxxm:layer", []);
  emit.open("iwxxm:CloudLayer", []);
  emit.void("iwxxm:amount", [["xlink:href", uriCloudAmount(code)]]);
  emitNilBase(emit);
  emit.close("iwxxm:CloudLayer");
  emit.close("iwxxm:layer");
}

/**
 * 云组 → cloud 属性元素。三轨落位（解析侧无云族三轨的逆向）：
 * - 元素层/垂直能见度 → AerodromeCloud（观测）或 AerodromeCloudForecast（趋势/TAF，gml:id 必填）；
 * - 纯无云电码：NSC/NCD → cloud nilReason 承载（2023-1 官方主流）；SKC → 云量位层形态（ECCC 实证，
 *   49-2 本词无损）；CLR → nilReason notDetectedByAutoSystem（49-2 电码表无此词，收敛 NCD——D0 ④
 *   细辨不可还原）；
 * - 电码与层并存的矛盾 IR：层照落 + 电码走层形态（NSC/SKC 走 href 保真电码位；CLR 无词不落，
 *   矛盾 IR 本就是 TAC 源反常形态）。
 */
function emitCloud(
  emit: Emit,
  bodyTag: "iwxxm:AerodromeCloud" | "iwxxm:AerodromeCloudForecast",
  clouds: CloudCondition,
  nillable: boolean,
): void {
  const clear = clouds.clear?.code;
  const hasBody = clouds.elements.length > 0;
  if (!hasBody) {
    if (clear === "SKC") {
      emit.open("iwxxm:cloud", []);
      emit.open(
        bodyTag,
        bodyTag === "iwxxm:AerodromeCloudForecast" ? [["gml:id", emit.nextId()]] : [],
      );
      emitClearLayer(emit, "SKC");
      emit.close(bodyTag);
      emit.close("iwxxm:cloud");
      return;
    }
    if (clear !== undefined) {
      const word =
        clear === "NCD" || clear === "CLR"
          ? NIL_NOT_DETECTED_BY_AUTO_SYSTEM
          : NIL_NOTHING_OF_OPERATIONAL_SIGNIFICANCE;
      // 空载形按元素声明分两轨：nillable（观测/趋势 cloud）＝nilReason + xsi:nil（EFHK 官方形）；
      // 非 nillable（TAF 预报体 cloud——taf.xsd 未声明 nillable）＝裸 nilReason（SARP 官方形）
      emit.void(
        "iwxxm:cloud",
        nillable
          ? [
              ["nilReason", uriNil(word)],
              ["xsi:nil", "true"],
            ]
          : [["nilReason", uriNil(word)]],
      );
      return;
    }
  }
  emit.open("iwxxm:cloud", []);
  emit.open(bodyTag, bodyTag === "iwxxm:AerodromeCloudForecast" ? [["gml:id", emit.nextId()]] : []);
  for (const element of clouds.elements) {
    if (element.kind === "vertical-visibility") {
      if (element.heightFt.value !== null) {
        emit.text("iwxxm:verticalVisibility", numText(element.heightFt.value), [["uom", "[ft_i]"]]);
      } else {
        // VV 高度缺测（TAC VV///）：IWXXM 载体仍需元素在位——nil 空载（回读为元素缺席，如实记损）
        emit.void("iwxxm:verticalVisibility", [
          ["uom", "N/A"],
          ["xsi:nil", "true"],
          ["nilReason", uriNil(NIL_MISSING)],
        ]);
      }
      continue;
    }
    emit.open("iwxxm:layer", []);
    emit.open("iwxxm:CloudLayer", []);
    if (element.amount !== null) {
      emit.void("iwxxm:amount", [["xlink:href", uriCloudAmount(element.amount)]]);
    } else {
      emit.void("iwxxm:amount", [
        ["nilReason", uriNil(NIL_MISSING)],
        ["xsi:nil", "true"],
      ]);
    }
    if (element.heightFt.value !== null) {
      emit.text("iwxxm:base", numText(element.heightFt.value), [["uom", "[ft_i]"]]);
    } else {
      emitNilBase(emit);
    }
    if (element.convective !== undefined) {
      emit.void("iwxxm:cloudType", [["xlink:href", uriConvective(element.convective)]]);
    }
    emit.close("iwxxm:CloudLayer");
    emit.close("iwxxm:layer");
  }
  if (hasBody && clear !== undefined && clear !== "CLR") {
    emitClearLayer(emit, clear);
  }
  emit.close(bodyTag);
  emit.close("iwxxm:cloud");
}

/**
 * 能见度值 → prevailingVisibility + Operator（单位折 m；阈值编码向官方形态收敛——两通道等价根基：
 * TAC 上限电码 9999（≥10km）＝XML 10000m+ABOVE，下限电码 0000（<50m）＝XML 50m+BELOW）。
 */
function emitPrevailingVisibility(emit: Emit, visibility: VisibilityGroup): void {
  const meters =
    visibility.unit === "m" ? visibility.value : Math.round(visibility.value * SM_TO_M);
  const canonical =
    visibility.beyond === "above" && visibility.unit === "m" && visibility.value === 9999
      ? 10000
      : visibility.beyond === "below" && visibility.unit === "m" && visibility.value === 0
        ? 50
        : meters;
  emit.text("iwxxm:prevailingVisibility", numText(canonical), [["uom", "m"]]);
  if (visibility.beyond !== undefined) {
    emit.text(
      "iwxxm:prevailingVisibilityOperator",
      visibility.beyond === "below" ? "BELOW" : "ABOVE",
    );
  }
}

/** 观测侧最低能见度方向组（XSD 仅观测侧 AerodromeHorizontalVisibility 有该组——趋势/预报体不落）。 */
function emitMinimumVisibility(emit: Emit, visibility: VisibilityGroup): void {
  if (visibility.minimum === undefined) return;
  const deg = DIR_8_OUT[visibility.minimum.direction] ?? 0;
  emit.text("iwxxm:minimumVisibility", numText(visibility.minimum.value), [["uom", "m"]]);
  emit.text("iwxxm:minimumVisibilityDirection", numText(deg), [["uom", "deg"]]);
}

// ---------------------------------------------------------------- 机场快照与时组（难点 11/12 生成侧落位）

/** aerodrome → 最小合法 AirportHeliport 快照（timeSlice SNAPSHOT + ICAO 四字码；名称/ARP 不在 IR，不捏造）。 */
function emitAerodrome(emit: Emit, station: string): void {
  emit.open("iwxxm:aerodrome", []);
  emit.open("aixm:AirportHeliport", [["gml:id", emit.nextId()]]);
  emit.open("aixm:timeSlice", []);
  emit.open("aixm:AirportHeliportTimeSlice", [["gml:id", emit.nextId()]]);
  emit.empty("gml:validTime");
  emit.text("aixm:interpretation", "SNAPSHOT");
  emit.text("aixm:locationIndicatorICAO", station);
  emit.close("aixm:AirportHeliportTimeSlice");
  emit.close("aixm:timeSlice");
  emit.close("aixm:AirportHeliport");
  emit.close("iwxxm:aerodrome");
}

/** issueTime → 内联 gml:TimeInstant（返回 gml:id 供 observationTime/phenomenonTime href 引用）。 */
function emitIssueTime(
  emit: Emit,
  cal: { readonly year: number; readonly month: number },
  time: { readonly day: number; readonly hour: number; readonly minute: number },
): string {
  const id = emit.nextId();
  emit.open("iwxxm:issueTime", []);
  emit.open("gml:TimeInstant", [["gml:id", id]]);
  emit.text("gml:timePosition", isoOf(cal, time.day, time.hour, time.minute));
  emit.close("gml:TimeInstant");
  emit.close("iwxxm:issueTime");
  return id;
}

/** 跑道设计器 → aixm:RunwayDirection 最小快照（RVR/风切变/跑道状态共用）。 */
function emitRunwayDirection(emit: Emit, runway: string): void {
  emit.open("iwxxm:runway", []);
  emit.open("aixm:RunwayDirection", [["gml:id", emit.nextId()]]);
  emit.open("aixm:timeSlice", []);
  emit.open("aixm:RunwayDirectionTimeSlice", [["gml:id", emit.nextId()]]);
  emit.empty("gml:validTime");
  emit.text("aixm:interpretation", "SNAPSHOT");
  emit.text("aixm:designator", runway);
  emit.close("aixm:RunwayDirectionTimeSlice");
  emit.close("aixm:timeSlice");
  emit.close("aixm:RunwayDirection");
  emit.close("iwxxm:runway");
}

// ---------------------------------------------------------------- METAR/SPECI 侧

/**
 * RVR 条目 → AerodromeRunwayVisualRange（pastTendency/meanRVROperator 全保真；量纲折 m——
 * Schematron 明文；V 波动形态以 min 值落 meanRVR——IWXXM 无 V 位，见文件头有损面）。
 */
function emitRvrItem(emit: Emit, item: RunwayVisualRange): void {
  emit.open("iwxxm:rvr", []);
  const attrs: [string, string][] = [];
  if (item.trend === "up") attrs.push(["pastTendency", "UPWARD"]);
  else if (item.trend === "down") attrs.push(["pastTendency", "DOWNWARD"]);
  else if (item.trend === "no-change") attrs.push(["pastTendency", "NO_CHANGE"]);
  emit.open("iwxxm:AerodromeRunwayVisualRange", attrs);
  emitRunwayDirection(emit, item.runway);
  const raw = item.value ?? item.min;
  if (raw !== undefined) {
    const meters = item.unit === "ft" ? Math.round(raw * FT_TO_M) : raw;
    emit.text("iwxxm:meanRVR", numText(meters), [["uom", "m"]]);
    if (item.beyondRange !== undefined) {
      emit.text("iwxxm:meanRVROperator", item.beyondRange === "below" ? "BELOW" : "ABOVE");
    }
  }
  emit.close("iwxxm:AerodromeRunwayVisualRange");
  emit.close("iwxxm:rvr");
}

/**
 * 跑道状态条目 → runwayState（88→allRunways / 99→fromPreviousReport——与解析侧同一电码词汇回填的
 * 逆向）。关闭组（SNOCLO/深度 99）：XML 唯一载体＝nil(inapplicable)——逐道形态无载体，跑道位不保真。
 */
function emitRunwayState(emit: Emit, group: MetarReport["runwayStates"][number]): void {
  if (group.closed === true) {
    emit.void("iwxxm:runwayState", [
      ["nilReason", uriNil(NIL_INAPPLICABLE)],
      ["xsi:nil", "true"],
    ]);
    return;
  }
  const attrs: [string, string][] = [];
  if (group.runway === "88") attrs.push(["allRunways", "true"]);
  if (group.runway === "99") attrs.push(["fromPreviousReport", "true"]);
  if (group.cleared) attrs.push(["cleared", "true"]);
  emit.open("iwxxm:runwayState", []);
  emit.open("iwxxm:AerodromeRunwayState", attrs);
  if (group.runway !== "88" && group.runway !== "99" && group.runway !== "") {
    emitRunwayDirection(emit, group.runway);
  }
  if (group.deposit !== undefined && group.deposit !== null) {
    emit.void("iwxxm:depositType", [["xlink:href", uriBufr4("0-20-086", group.deposit)]]);
  }
  if (group.coverage !== undefined && group.coverage !== null) {
    emit.void("iwxxm:contamination", [["xlink:href", uriBufr4("0-20-087", group.coverage)]]);
  }
  if (group.depth !== undefined && group.depth !== null) {
    emit.text("iwxxm:depthOfDeposit", numText(group.depth), [["uom", "mm"]]);
  }
  if (group.frictionCoefficient !== undefined) {
    // 摩擦系数 → 0-20-089 两位电码（解析侧 /100 的逆向；round 对齐）
    emit.void("iwxxm:estimatedSurfaceFrictionOrBrakingAction", [
      ["xlink:href", uriBufr4("0-20-089", Math.round(group.frictionCoefficient * 100))],
    ]);
  } else if (group.brakingAction !== undefined) {
    const code = {
      poor: 91,
      "medium-poor": 92,
      medium: 93,
      "medium-good": 94,
      good: 95,
      unreliable: 99,
    }[group.brakingAction];
    emit.void("iwxxm:estimatedSurfaceFrictionOrBrakingAction", [
      ["xlink:href", uriBufr4("0-20-089", code ?? 99)],
    ]);
  }
  emit.close("iwxxm:AerodromeRunwayState");
  emit.close("iwxxm:runwayState");
}

/** 风切变 → windShear（AerodromeWindShear allRunways + 逐道 RunwayDirection）。 */
function emitWindShear(emit: Emit, shear: NonNullable<MetarReport["windShear"]>): void {
  emit.open("iwxxm:windShear", []);
  emit.open("iwxxm:AerodromeWindShear", [["allRunways", shear.allRunways ? "true" : "false"]]);
  for (const runway of shear.runways) {
    emitRunwayDirection(emit, runway);
  }
  emit.close("iwxxm:AerodromeWindShear");
  emit.close("iwxxm:windShear");
}

/**
 * 趋势时窗 → phenomenonTime（官方三形态）：
 * - TL（UNTIL）：begin＝发报时刻 indeterminatePosition="after"、end＝TL 时刻（ZSPD 官方形）；
 * - FM（FROM）：begin＝FM 时刻、end＝同时刻 indeterminate after（WSSS/VTUO 官方形）；
 *   DDHH//DDHH（TAC 中国主流趋势窗）双端点完整落位——timeIndicator 按 UNTIL 判读，
 *   回读 TL+窗止（窗起不保真，文件头有损面）；
 * - AT：gml:TimeInstant 硬时刻；
 * - 无时段词：phenomenonTime nilReason missing（EDDP 官方形）。
 *
 * 日位锚定：AT/TL/FM 时段词是 HHMM（时+分，无日位——与 TAF 的 ddHH 不同）——日位锚发报日，
 * 时刻早于发报时刻按次日回绕（跨午夜 TL 的日历归属与 TAC 阅读惯例一致；IR 往返只比较 HHMM，
 * 日位仅服务 xsd:dateTime 合法性）。
 */
function trendDayOf(
  issueTime: { readonly day: number; readonly hour: number; readonly minute: number },
  hour: number,
  minute: number,
): number {
  const sameDay = hour > issueTime.hour || (hour === issueTime.hour && minute >= issueTime.minute);
  return sameDay ? issueTime.day : (issueTime.day % 31) + 1;
}

function emitTrendPhenomenonTime(
  emit: Emit,
  cal: { readonly year: number; readonly month: number },
  trend: TrendGroup,
  issueTime: { readonly day: number; readonly hour: number; readonly minute: number },
): void {
  const period = trend.period?.text;
  if (period === undefined) {
    emit.void("iwxxm:phenomenonTime", [["nilReason", uriNil(NIL_MISSING)]]);
    return;
  }
  const atMatch = /^(AT|TL|FM)(\d{2})(\d{2})$/.exec(period);
  const windowMatch = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.exec(period);
  emit.open("iwxxm:phenomenonTime", []);
  if (atMatch !== null) {
    const hour = Number(atMatch[2]);
    const minute = Number(atMatch[3]);
    const day = trendDayOf(issueTime, hour, minute);
    if (atMatch[1] === "AT") {
      emit.open("gml:TimeInstant", [["gml:id", emit.nextId()]]);
      emit.text("gml:timePosition", isoOf(cal, day, hour, minute));
      emit.close("gml:TimeInstant");
      emit.close("iwxxm:phenomenonTime");
      return;
    }
    let beginIso: string;
    let endIso: string;
    let beginIndeterminate = false;
    let endIndeterminate = false;
    if (atMatch[1] === "TL") {
      beginIso = isoOf(cal, issueTime.day, issueTime.hour, issueTime.minute);
      beginIndeterminate = true;
      endIso = isoOf(cal, day, hour, minute);
    } else {
      // FROM：begin＝FM 时刻、end＝同时刻 indeterminate after（WSSS/VTUO 官方形）
      beginIso = isoOf(cal, day, hour, minute);
      endIso = beginIso;
      endIndeterminate = true;
    }
    emitTimePeriod(emit, beginIso, endIso, beginIndeterminate, endIndeterminate);
    emit.close("iwxxm:phenomenonTime");
    return;
  }
  if (windowMatch !== null) {
    // DDHH//DDHH（TAC 中国主流趋势窗）：双端点完整落位，timeIndicator 按 UNTIL 判读——回读 TL+窗止、窗起不保真
    emitTimePeriod(
      emit,
      isoOf(cal, Number(windowMatch[1]), Number(windowMatch[2])),
      isoOf(cal, Number(windowMatch[3]), Number(windowMatch[4])),
      false,
      false,
    );
    emit.close("iwxxm:phenomenonTime");
    return;
  }
  // 不可辨时段词（理论不可达——TAC 侧已保证形态）：按无窗收
  emit.close("iwxxm:phenomenonTime");
  emit.void("iwxxm:phenomenonTime", [["nilReason", uriNil(NIL_MISSING)]]);
}

/** gml:TimePeriod 双端点拼装（indeterminate="after" 端仍带时刻文本——ZSPD/WSSS 官方形即此）。 */
function emitTimePeriod(
  emit: Emit,
  beginIso: string,
  endIso: string,
  beginIndeterminate: boolean,
  endIndeterminate: boolean,
): void {
  emit.open("gml:TimePeriod", [["gml:id", emit.nextId()]]);
  if (beginIndeterminate) {
    emit.text("gml:beginPosition", beginIso, [["indeterminatePosition", "after"]]);
  } else {
    emit.text("gml:beginPosition", beginIso);
  }
  if (endIndeterminate) {
    emit.text("gml:endPosition", endIso, [["indeterminatePosition", "after"]]);
  } else {
    emit.text("gml:endPosition", endIso);
  }
  emit.close("gml:TimePeriod");
}

/** 趋势/变化组共享要素落位（TrendElements → 预报体元素；XSD 无最低能见度位——见文件头有损面）。 */
function emitTrendElements(
  emit: Emit,
  bodyTag: string,
  elements: TrendGroup["elements"],
  trendNillable: boolean,
): void {
  if (elements === undefined) return;
  if (elements.cavok === undefined && elements.visibility !== undefined) {
    emitPrevailingVisibility(emit, elements.visibility);
  }
  if (elements.wind !== undefined) {
    // variableWindDirection 仅观测/预报风载体可带（TrendForecast 型无该属性——XSD 实证，EDDP 官方形）
    const attrs =
      bodyTag === "iwxxm:AerodromeSurfaceWindTrendForecast" ? [] : [variableAttrOf(elements.wind)];
    emitWind(emit, bodyTag, elements.wind, attrs);
  }
  if (elements.nsw !== undefined) {
    emit.void("iwxxm:weather", [["nilReason", uriNil(NIL_NOTHING_OF_OPERATIONAL_SIGNIFICANCE)]]);
  } else if (elements.weather.length > 0) {
    for (const group of elements.weather) {
      emit.void("iwxxm:weather", [["xlink:href", uriWeather(weatherTokenOf(group))]]);
    }
  }
  if (elements.clouds !== undefined) {
    emitCloud(emit, "iwxxm:AerodromeCloudForecast", elements.clouds, trendNillable);
  }
}

/** 趋势组 → trendForecast（NOSIG＝nil noSignificantChange；BECMG/TEMPO 走 TrendForecast 元素）。 */
function emitTrend(
  emit: Emit,
  cal: { readonly year: number; readonly month: number },
  trend: TrendGroup,
  issueTime: { readonly day: number; readonly hour: number; readonly minute: number },
): void {
  if (trend.kind === "nosig") {
    emit.void("iwxxm:trendForecast", [
      ["nilReason", uriNil(NIL_NO_SIGNIFICANT_CHANGE)],
      ["xsi:nil", "true"],
    ]);
    return;
  }
  emit.open("iwxxm:trendForecast", []);
  // changeIndicator 必填：unspecified（TAC 指示组丢失形态）无对应枚举——按 BECOMING 落位
  //（与解析侧「未识别按渐变收」同口径的逆向，往返后 kind 归 becmg，如实记损）
  const attrs: Attrs = [
    ["gml:id", emit.nextId()],
    ["changeIndicator", trend.kind === "tempo" ? "TEMPORARY_FLUCTUATIONS" : "BECOMING"],
    ["cloudAndVisibilityOK", trend.elements?.cavok !== undefined ? "true" : "false"],
  ];
  emit.open("iwxxm:MeteorologicalAerodromeTrendForecast", attrs);
  emitTrendPhenomenonTime(emit, cal, trend, issueTime);
  const period = trend.period?.text;
  if (period !== undefined) {
    const indicator = period.startsWith("AT") ? "AT" : period.startsWith("FM") ? "FROM" : "UNTIL";
    emit.text("iwxxm:timeIndicator", indicator);
  }
  emitTrendElements(emit, "iwxxm:AerodromeSurfaceWindTrendForecast", trend.elements, true);
  emit.close("iwxxm:MeteorologicalAerodromeTrendForecast");
  emit.close("iwxxm:trendForecast");
}

/**
 * METAR/SPECI IR → iwxxm:METAR/iwxxm:SPECI XML 文本。
 * 元素顺序沿 XSD sequence（airTemperature → dewpointTemperature → qnh → surfaceWind → visibility
 * → rvr → presentWeather → cloud → recentWeather → windShear → runwayState → trendForecast）。
 */
function emitMetar(
  emit: Emit,
  report: MetarReport,
  cal: { readonly year: number; readonly month: number },
  version: IwxxmSerializeVersion,
  permissibleUsage: "OPERATIONAL" | "NON-OPERATIONAL",
): void {
  const rootTag = report.kind === "speci" ? "iwxxm:SPECI" : "iwxxm:METAR";
  emit.open(rootTag, [
    ["xmlns:aixm", NS_AIXM],
    ["xmlns:gml", NS_GML],
    ["xmlns:iwxxm", NS_IWXXM[version]],
    ["xmlns:xlink", NS_XLINK],
    ["xmlns:xsi", NS_XSI],
    ["xsi:schemaLocation", `${NS_IWXXM[version]} ${SCHEMA_LOCATION[version]}`],
    ["reportStatus", report.flags.corrected ? "CORRECTION" : "NORMAL"],
    ["automatedStation", report.flags.auto ? "true" : "false"],
    ["permissibleUsage", permissibleUsage],
    ["gml:id", emit.nextId()],
  ]);
  const issueId = emitIssueTime(emit, cal, report.time);
  emitAerodrome(emit, report.station);
  emit.void("iwxxm:observationTime", [["xlink:href", `#${issueId}`]]);

  if (report.nil === true) {
    // NIL：observation xsi:nil + nilReason missing（2023-1 主流选词；官方 NIL 等价对未取得，
    // 2.1 样例选词 missing——解析侧 warnUnknownNil 对已知词静默，往返无损）
    emit.void("iwxxm:observation", [
      ["nilReason", uriNil(NIL_MISSING)],
      ["xsi:nil", "true"],
    ]);
    emit.close(rootTag);
    return;
  }

  emit.open("iwxxm:observation", []);
  emit.open("iwxxm:MeteorologicalAerodromeObservation", [
    ["gml:id", emit.nextId()],
    ["cloudAndVisibilityOK", report.cavok ? "true" : "false"],
  ]);

  // —— 温露压（XSD 必填元素：缺测走 nil notObservable 官方载体，量纲空载 uom="N/A"）
  for (const [tag, reading] of [
    ["iwxxm:airTemperature", report.temperature],
    ["iwxxm:dewpointTemperature", report.dewpoint],
  ] as const) {
    if (reading === undefined) {
      emit.void(tag, [
        ["uom", "N/A"],
        ["nilReason", uriNil(NIL_OBSERVABLE)],
        ["xsi:nil", "true"],
      ]);
    } else {
      emit.text(tag, numText(reading.celsius), [["uom", "Cel"]]);
    }
  }
  if (report.altimeter === undefined) {
    emit.void("iwxxm:qnh", [
      ["uom", "N/A"],
      ["nilReason", uriNil(NIL_OBSERVABLE)],
      ["xsi:nil", "true"],
    ]);
  } else {
    // QNH 仅 hPa（XSD 明文）——inHg 源按固定系数折算（换算表因转换中心而异，本系数是本实现常量）
    const hPa =
      report.altimeter.unit === "hPa"
        ? report.altimeter.value
        : Math.round(report.altimeter.value * INHG_TO_HPA * 10) / 10;
    emit.text("iwxxm:qnh", numText(hPa), [["uom", "hPa"]]);
  }

  // —— 风（XSD 必填元素；缺测 → nil notObservable）
  emitWindObserved(emit, report.wind, "iwxxm:AerodromeSurfaceWind");

  // —— CAVOK 让位（与解析侧让位行为对称：true 时三组不落 XML）
  const cavok = report.cavok;
  if (!cavok && report.visibility !== undefined) {
    if (report.visibility.kind === "missing") {
      emit.void("iwxxm:visibility", [
        ["nilReason", uriNil(NIL_OBSERVABLE)],
        ["xsi:nil", "true"],
      ]);
    } else {
      emit.open("iwxxm:visibility", []);
      emit.open("iwxxm:AerodromeHorizontalVisibility", []);
      emitPrevailingVisibility(emit, report.visibility.value);
      emitMinimumVisibility(emit, report.visibility.value);
      emit.close("iwxxm:AerodromeHorizontalVisibility");
      emit.close("iwxxm:visibility");
    }
  }
  if (!cavok && report.runwayVisualRange !== undefined) {
    if (report.runwayVisualRange.kind === "missing") {
      emit.void("iwxxm:rvr", [
        ["nilReason", uriNil(NIL_MISSING)],
        ["xsi:nil", "true"],
      ]);
    } else {
      for (const item of report.runwayVisualRange.value) {
        emitRvrItem(emit, item);
      }
    }
  }
  if (!cavok) {
    emitWeatherObserved(emit, "iwxxm:presentWeather", report.weather);
  }
  if (!cavok && report.clouds !== undefined) {
    emitCloud(emit, "iwxxm:AerodromeCloud", report.clouds, true);
  }
  for (const group of report.recentWeather ?? []) {
    emit.void("iwxxm:recentWeather", [["xlink:href", uriWeather(weatherTokenOf(group))]]);
  }
  if (report.windShear !== undefined) {
    emitWindShear(emit, report.windShear);
  }
  if (version !== "2025-2") {
    // 2025-2 已整体删除跑道状态建模（XSD diff 实证）——该出口下如实不落（忠实出口，IR 数据不受影响）
    for (const group of report.runwayStates) {
      emitRunwayState(emit, group);
    }
  }
  emit.close("iwxxm:MeteorologicalAerodromeObservation");
  emit.close("iwxxm:observation");

  for (const trend of report.trends) {
    emitTrend(emit, cal, trend, report.time);
  }
  emit.close(rootTag);
}

// ---------------------------------------------------------------- TAF 侧

/** 变化组头 → changeIndicator 枚举（七值全覆盖；PROB 无概率位按 30 归一——见文件头有损面）。 */
function changeIndicatorOf(change: TafChangeGroup): string {
  if (change.kind === "FM") return "FROM";
  if (change.kind === "BECMG") return "BECOMING";
  if (change.kind === "TEMPO") return "TEMPORARY_FLUCTUATIONS";
  const prob = change.probability === 40 ? "PROBABILITY_40" : "PROBABILITY_30";
  return change.withTempo === true ? `${prob}_TEMPORARY_FLUCTUATIONS` : prob;
}

/**
 * 变化组时窗 → phenomenonTime（XSD 明文：TAC FM/TL/AT 由它承载；TAF 预报体 phenomenonTime 恒
 * gml:TimePeriod）。FM：begin＝FM 时刻（日位取有效期起日直投影——TafChangeAt 无日位，锚定归展开层）、
 * end＝同时刻 indeterminate after；带窗：begin/end 直投影（止时 24 经 Date.UTC 归一为次日 00:00——
 * 两态等价口径与解析侧一致）。
 */
function emitTafPhenomenonTime(
  emit: Emit,
  cal: { readonly year: number; readonly month: number },
  change: TafChangeGroup,
  startDay: number,
): void {
  emit.open("iwxxm:phenomenonTime", []);
  emit.open("gml:TimePeriod", [["gml:id", emit.nextId()]]);
  if (change.kind === "FM" && change.at !== undefined) {
    const beginIso = isoOf(cal, startDay, change.at.hour, change.at.minute);
    emit.text("gml:beginPosition", beginIso);
    emit.text("gml:endPosition", beginIso, [["indeterminatePosition", "after"]]);
  } else if (change.window !== undefined) {
    emit.text("gml:beginPosition", isoOf(cal, change.window.startDay, change.window.startHour));
    emit.text("gml:endPosition", isoOf(cal, change.window.endDay, change.window.endHour));
  } else {
    // FM 无时刻 / 变化组无窗（理论不可达——解析侧已保证 FM 必带 at）：起点按有效期起日 00:00 占位
    const beginIso = isoOf(cal, startDay, 0);
    emit.text("gml:beginPosition", beginIso);
    emit.text("gml:endPosition", beginIso, [["indeterminatePosition", "after"]]);
  }
  emit.close("gml:TimePeriod");
  emit.close("iwxxm:phenomenonTime");
}

/**
 * 气温预告 → AerodromeAirTemperatureForecast。XSD 一元素必载 TX/TN 双端（max/min + 两时刻全必填）：
 * IR 仅有单端、或某端达时刻缺日（ogimet 方言短形态）时该组整体不落（不捏造另一端/时刻——与解析侧
 * 「时刻缺失跳过出声」同一纪律的生成面）；多组温度取首个 TX + 首个 TN 落一元素（IWXXM 承载面上限）。
 */
function emitTafTemperatures(
  emit: Emit,
  cal: { readonly year: number; readonly month: number },
  report: TafReport,
): void {
  const max = report.temperatures.find((t) => t.extremum === "max" && t.at.day !== undefined);
  const min = report.temperatures.find((t) => t.extremum === "min" && t.at.day !== undefined);
  // 可选链守卫一并收窄 day 位（find 谓词的类型面不会自动收窄——零断言纪律）
  if (max?.at.day === undefined || min?.at.day === undefined) return;
  emit.open("iwxxm:temperature", []);
  emit.open("iwxxm:AerodromeAirTemperatureForecast", []);
  emit.text("iwxxm:maximumAirTemperature", numText(max.celsius), [["uom", "Cel"]]);
  emit.open("iwxxm:maximumAirTemperatureTime", []);
  emit.open("gml:TimeInstant", [["gml:id", emit.nextId()]]);
  emit.text("gml:timePosition", isoOf(cal, max.at.day, max.at.hour));
  emit.close("gml:TimeInstant");
  emit.close("iwxxm:maximumAirTemperatureTime");
  emit.text("iwxxm:minimumAirTemperature", numText(min.celsius), [["uom", "Cel"]]);
  emit.open("iwxxm:minimumAirTemperatureTime", []);
  emit.open("gml:TimeInstant", [["gml:id", emit.nextId()]]);
  emit.text("gml:timePosition", isoOf(cal, min.at.day, min.at.hour));
  emit.close("gml:TimeInstant");
  emit.close("iwxxm:minimumAirTemperatureTime");
  emit.close("iwxxm:AerodromeAirTemperatureForecast");
  emit.close("iwxxm:temperature");
}

/**
 * TAF IR → iwxxm:TAF XML 文本。CNL（isCancelReport + cancelledReportValidPeriod）与
 * NIL（空载 baseForecast + nilReason missing，官方对 DAOY 形态）都能往返。
 * NIL 无 issueTime（TAC「无时组 NIL」形态）在 XML 侧无载体——XSD 必填，缺失即整体失败（不捏造）。
 */
function emitTaf(
  emit: Emit,
  report: TafReport,
  cal: { readonly year: number; readonly month: number },
  version: IwxxmSerializeVersion,
  permissibleUsage: "OPERATIONAL" | "NON-OPERATIONAL",
): void {
  if (report.nil === true && report.issueTime === undefined) {
    throw new MetarParseError(
      "invalid-input",
      report.station,
      "TAF NIL 报无发布时组（issueTime）——XSD 必填，TAC「无时组 NIL」形态在 IWXXM 侧无载体，无法序列化",
    );
  }
  const rootAttrs: [string, string][] = [
    ["xmlns:aixm", NS_AIXM],
    ["xmlns:gml", NS_GML],
    ["xmlns:iwxxm", NS_IWXXM[version]],
    ["xmlns:xlink", NS_XLINK],
    ["xmlns:xsi", NS_XSI],
    ["xsi:schemaLocation", `${NS_IWXXM[version]} ${SCHEMA_LOCATION[version]}`],
    // reportStatus 必填：修订优先于更正（枚举单值，两态并存的 IR 按修订落位）
    [
      "reportStatus",
      report.flags.amended ? "AMENDMENT" : report.flags.corrected ? "CORRECTION" : "NORMAL",
    ],
    ["permissibleUsage", permissibleUsage],
    ["gml:id", emit.nextId()],
  ];
  if (report.cancelled === true) {
    rootAttrs.push(["isCancelReport", "true"]);
  }
  emit.open("iwxxm:TAF", rootAttrs);
  emitIssueTime(emit, cal, report.issueTime ?? { day: 1, hour: 0, minute: 0 });
  emitAerodrome(emit, report.station);

  // —— 有效期：CNL 走 cancelledReportValidPeriod（被取消报的覆盖窗），常规走 validPeriod
  let validPeriodId: string | undefined;
  if (report.validity !== undefined) {
    const validity = report.validity;
    validPeriodId = emit.nextId();
    const tag =
      report.cancelled === true ? "iwxxm:cancelledReportValidPeriod" : "iwxxm:validPeriod";
    emit.open(tag, []);
    emit.open("gml:TimePeriod", [["gml:id", validPeriodId]]);
    emit.text("gml:beginPosition", isoOf(cal, validity.startDay, validity.startHour));
    emit.text("gml:endPosition", isoOf(cal, validity.endDay, validity.endHour));
    emit.close("gml:TimePeriod");
    emit.close(tag);
  }

  if (report.nil === true) {
    // NIL：空载属性元素（官方对 DAOY 实证形态——nilReason missing 无 xsi:nil 无内层）
    emit.void("iwxxm:baseForecast", [["nilReason", uriNil(NIL_MISSING)]]);
    emit.close("iwxxm:TAF");
    return;
  }
  if (report.cancelled === true) {
    // CNL：取消报无正文（与解析侧「按取消收、正文截断」对称）
    emit.close("iwxxm:TAF");
    return;
  }

  // —— 基况段（元素顺序沿 XSD sequence：phenomenonTime → prevailingVisibility → surfaceWind
  //  → weather → cloud → temperature）
  emit.open("iwxxm:baseForecast", []);
  emit.open("iwxxm:MeteorologicalAerodromeForecast", [
    ["gml:id", emit.nextId()],
    ["cloudAndVisibilityOK", report.cavok ? "true" : "false"],
  ]);
  // phenomenonTime 引用 validPeriod（SARP 官方对形态——基况段覆盖窗即有效期）
  if (validPeriodId !== undefined) {
    emit.void("iwxxm:phenomenonTime", [["xlink:href", `#${validPeriodId}`]]);
  } else {
    emit.void("iwxxm:phenomenonTime", [["nilReason", uriNil(NIL_MISSING)]]);
  }
  if (!report.cavok && report.visibility !== undefined) {
    if (report.visibility.kind === "missing") {
      emit.void("iwxxm:prevailingVisibility", [
        ["uom", "N/A"],
        ["nilReason", uriNil(NIL_OBSERVABLE)],
        ["xsi:nil", "true"],
      ]);
    } else {
      emitPrevailingVisibility(emit, report.visibility.value);
    }
  }
  if (report.wind !== undefined && report.wind.kind === "value") {
    emitWind(emit, "iwxxm:AerodromeSurfaceWindForecast", report.wind.value, [
      variableAttrOf(report.wind.value),
    ]);
  } else if (report.wind !== undefined) {
    emit.void("iwxxm:surfaceWind", [
      ["nilReason", uriNil(NIL_OBSERVABLE)],
      ["xsi:nil", "true"],
    ]);
  }
  emitWeatherObserved(emit, "iwxxm:weather", report.weather);
  if (report.clouds !== undefined) {
    emitCloud(emit, "iwxxm:AerodromeCloudForecast", report.clouds, false);
  }
  emitTafTemperatures(emit, cal, report);
  emit.close("iwxxm:MeteorologicalAerodromeForecast");
  emit.close("iwxxm:baseForecast");

  // —— 变化组序列（changeIndicator 七枚举 ↔ FM/BECMG/TEMPO/PROB[ TEMPO]）
  for (const change of report.changes) {
    emit.open("iwxxm:changeForecast", []);
    emit.open("iwxxm:MeteorologicalAerodromeForecast", [
      ["gml:id", emit.nextId()],
      ["changeIndicator", changeIndicatorOf(change)],
      ["cloudAndVisibilityOK", change.elements?.cavok !== undefined ? "true" : "false"],
    ]);
    emitTafPhenomenonTime(
      emit,
      cal,
      change,
      report.validity?.startDay ?? report.issueTime?.day ?? 1,
    );
    emitTrendElements(emit, "iwxxm:AerodromeSurfaceWindForecast", change.elements, false);
    emit.close("iwxxm:MeteorologicalAerodromeForecast");
    emit.close("iwxxm:changeForecast");
  }
  emit.close("iwxxm:TAF");
}

// ---------------------------------------------------------------- 主入口

/**
 * Serialize one parsed report (MetarReport/TafReport — the same IR as the TAC-side parsers) into an
 * IWXXM XML document text. 把解析产物 IR（观测侧或预报侧，kind 位判别）写回 IWXXM XML 文本——
 * parseIwxxm 的逆过程，映射字典同一份（docs/iwxxm-notes.md）。
 *
 * Throws MetarParseError（code 沿既有稳定集）on: calendar 上下文缺失或非法（IR 无年月位——绝对时刻
 * 必须由调用方注入）、输入非 IR 形态、TAF NIL 无 issueTime（XSD 必填）。IR 携带的一切照实落位；
 * IR 没有的（站点名称/坐标、translationCentre、国家扩展）不捏造。
 * @param report - parse/parseTaf/parseIwxxm 产出的 IR（kind 位判别）。
 * @param options - 见 IwxxmSerializeOptions（版本、日历上下文、许可用途占位）。
 */
export function serializeIwxxm(report: IwxxmReport, options?: IwxxmSerializeOptions): string {
  if (typeof report !== "object" || report === null || !("kind" in report)) {
    throw new MetarParseError(
      "invalid-input",
      String(report),
      "serializeIwxxm 需要 parse/parseTaf/parseIwxxm 产出的 IR 对象（kind 位判别），收到非 IR 形态",
    );
  }
  const cal = calendarOf(options);
  const version = options?.version ?? "2023-1";
  const permissibleUsage = options?.permissibleUsage ?? "OPERATIONAL";
  const emit = new Emit();
  emit.line('<?xml version="1.0" encoding="UTF-8"?>');
  if (report.kind === "taf") {
    emitTaf(emit, report, cal, version, permissibleUsage);
  } else {
    emitMetar(emit, report, cal, version, permissibleUsage);
  }
  return emit.toString();
}
