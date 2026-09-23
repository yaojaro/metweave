/**
 * @metweave/core — IR 数据模型（v0.1 契约草案，待审定）。
 *
 * 设计原则：
 * 1. IR 是解析器（格式 → IR）与渲染内核（IR → 图）之间的唯一契约，本文件即 npm 破坏性变更的边界；
 * 2. 一切产物可序列化为纯 JSON（服务端数据接口可直接返回 IR），零依赖、零类实例；
 * 3. 不静默：解析器看不懂的内容一律带 span 进 warnings[]，永不丢弃；
 * 4. 三态显式建模，判据 = 电码表：只有存在「缺测电码形态」的组用 Observed（风 /////KT、能见度 ////、
 *    RVR RVRNO、天气 //——全契约仅此四组）。组省略（字段 undefined）≠ 缺测（Observed missing）≠ 有值；
 *    missing 覆盖台站明示缺测与解析器判定不可信的值（如 Q10054 → missing + value-out-of-range 告警，
 *    原码经 span 永可回溯）。无缺测形态的字段一律两态 plain。
 * 5. span 统一为 raw 的 UTF-16 码元半开区间 [start, end)，raw.slice(start, end) 即原文片段——
 *    RAW 对照视图、逐组高亮、错误定位的地基，发布后变更即破坏下游。
 *    v0.1 起所有 span 字段可选：parse(raw, { spans: false }) 紧凑模式不携带任何 span
 *    （批量入库/列存场景 JSON 体积约 -30%）——RAW 对照等 span 消费方将优雅降级
 *    （整段高亮退化为无高亮、原码显示退化为 IR 重建，不炸）。
 *
 * 两级建模规则：组级按上述判据用 Observed 或两态 plain；组内子项一律 plain + 自带 span，
 * 子项缺测 = 值字段 | null（云高 {value:number|null,span}、云量位 null——BKN///、///025CB 两形态）。
 * 禁止 Observed 嵌套 Observed。
 *
 * 消费分层：读值用 toValues()（全两态视图，普通消费方的默认入口）；需要区分「缺测 vs 组省略」、
 * 消费告警 span 与 RAW 定位的重度场景（核验/复盘/对照类）才直接进 IR。
 */

// ---------------------------------------------------------------- 基元

/**
 * Source span: half-open UTF-16 code-unit range [start, end) into `raw` — raw.slice(start, end) yields the original fragment.
 * 原文位置：raw 的 UTF-16 码元半开区间 [start, end)，raw.slice(start, end) 即原片段。
 *
 * Multi-element groups (an array carried on an `Observed` — e.g. `runwayVisualRange`, `weather`)
 * carry a **group-level envelope span**: it runs from the first to the last element and does NOT
 * promise that everything inside belongs to the group (a stray token between two RVR groups falls
 * inside the envelope). Exact per-group text is always on the element's own `span` — RAW
 * cross-check highlighting must consume element spans, not the envelope.
 * 多元素组的组级 span 为**外包络**：自首组首至末组末，不承诺区间内皆为该组原文（两组之间
 * 夹带的无关 token 也在包络内）；精确逐组原文恒在各元素自身的 span 上——RAW 对照高亮应消费
 * 元素 span，不应消费包络。
 */
export interface Span {
  readonly start: number;
  readonly end: number;
}

/**
 * Warning severity: info = anomaly kept as reported; warning = questionable but usable; error = seriously doubtful (cards must surface it).
 * 告警严重度：info=如实收下的反常；warning=可疑但可用；error=严重存疑（卡片需醒目提示）。
 *
 * Note: `error` is a reserved tier — the parser currently emits only info/warning (2026-09
 * audit: zero "error" sites). Kept in the union for the full ladder downstream; do not emit
 * without a commensurate discipline case.
 * 注：`error` 为预留档——解析器当前只产出 info/warning（2026-09 审计：解析器零 error 位）。
 * 保留在联合类型中供下游按完整阶梯处理；无相应纪律案例不得启用。
 */
export type WarningSeverity = "info" | "warning" | "error";

/**
 * Machine-readable warning codes (stable keys, add-only; consumers branch on them and map `message` copy themselves).
 * 告警机读码（稳定键，只增不改；消费方据此分流，message 文案自行映射）。
 * 扩展新码属 additive 变更 / Adding a new code is an additive change.
 */
export type WarningCode =
  | "unknown-token" /** 正文里不认识的组（进 warnings 不丢弃） */
  | "invalid-format" /** 认出组但内容不合语法 */
  | "value-out-of-range" /** 数值超物理或条文范围（如 5 位数 QNH Q10054） */
  | "missing-expected" /** 组内必有部分缺测（如 BKN///、/////KT） */
  | "duplicate-group" /** 同族组重复出现（如双能见度组）——tolerant 口径以末组为准，前后值文案随告警、原文经 span/raw 回溯 */
  | "cross-check-conflict"; /** 双轨自洽校验失败（如 RMK T 组与正文 M 组圆整不符） */

/**
 * A single parse warning: stable machine-readable `code`, severity, narrative `message`, and the source `span`.
 * 单条解析告警：稳定机读 code、严重度、叙述 message 与原文 span。
 */
export interface ParseWarning {
  readonly code: WarningCode;
  readonly severity: WarningSeverity;
  /** 人类可读说明（中文，卡片悬停可直接展示；i18n 需求出现时以 code 为键另行映射） */
  readonly message: string;
  readonly span?: Span;
}

/**
 * Group-level three states: kind 'value' = a value; kind 'missing' = explicitly missing — either the station's own missing code (RVRNO, ////, /////KT) or a value the parser deems untrustworthy (out of range / malformed → missing + the matching warning; a fake value never stays in `value`).
 * 组级三态：kind:'value' 有值；kind:'missing' 缺测——含台站明示缺测（RVRNO、////、/////KT）
 * 与解析器判定不可信的值（超界/非法 → missing + 对应告警，绝不把假值留在 value 里）。
 * 字段整体 undefined = 组省略（报文里压根没出现）/ The field being undefined as a whole = the group was omitted (never appeared in the report).
 */
export type Observed<T> =
  | { readonly kind: "value"; readonly value: T; readonly span?: Span }
  | { readonly kind: "missing"; readonly span?: Span };

/**
 * Convenience unwrap: returns the value when present; undefined for explicit missing or an omitted group.
 * 便利取值：有值返回 value，显式缺测/组省略返回 undefined。
 */
export function unwrap<T>(observed: Observed<T> | undefined): T | undefined {
  return observed?.kind === "value" ? observed.value : undefined;
}

// ---------------------------------------------------------------- 度量单位（单位跟组走，禁止报文级全局单位）

/** Speed unit (follows its group). 风速单位（单位跟组走）。 */
export type SpeedUnit = "kt" | "mps" | "kmh";
/** Distance unit (follows its group). 距离单位（单位跟组走）。 */
export type DistanceUnit = "m" | "sm";
/** Pressure unit (follows its group). 气压单位（单位跟组走）。 */
export type PressureUnit = "hPa" | "inHg";

// ---------------------------------------------------------------- 报文级

/**
 * Report kind marker: never inferred from the body (SPECI and METAR share the same body grammar); for IEM's stripped feeds it is injected externally via options.kind, defaulting to 'metar'.
 * 报文类型位：不从正文推断（SPECI 与 METAR 正文语法无差别）；IEM 剥词场景由 options.kind 外部传入，缺省 'metar'。
 */
export type ReportKind = "metar" | "speci";

/**
 * Observation time: day/hour/minute in UTC (two-state mandatory — no missing form; out-of-range values fail the whole report).
 * 观测时刻：日/时/分（UTC）——两态必填（无缺测形态，数值越界 = 整体失败）。
 */
export interface ReportTime {
  /** 日（01–31）时（00–23）分（00–59），UTC。时组为两态必填（无缺测形态）——数值越界 = 不可信时组，解析器按整体失败处理，绝不把假值留在 IR */
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

/**
 * The wind group: direction/speed/gust plus the optional direction-variation sector (260V050).
 * 风组：风向/风速/阵风，及可选的风向变化扇区（260V050）。
 */
export interface WindGroup {
  /** VRB 全向风：direction 为 null 且 variable = true（风向缺测 ≠ 全向，两回事） */
  readonly variable: boolean;
  /** 度数 0–360，保留原码（正北可编 360，静风 000 编 0）；VRB → null；越界（>360°）→ null + value-out-of-range 告警（子项级判缺测，值不可信）。环绕计算由消费方负责 */
  readonly direction: number | null;
  readonly speed: {
    readonly value: number;
    readonly unit: SpeedUnit;
    readonly span?: Span;
    /** 超上限前缀形态（P99KT/P49MPS，WMO 15.5.6 / AP-117 54 条）：值存原码、beyond 标注超界端；三位数精确值（100–199）不带 beyond */
    readonly beyond?: "above";
  };
  /** 阵风 G 组（P 前缀超上限形态同速度位） */
  readonly gust?: {
    readonly value: number;
    readonly unit: SpeedUnit;
    readonly span?: Span;
    readonly beyond?: "above";
  };
  /** 风向变化组 260V050（扇区摆动，非瞬时波动）；min/max 为顺时针起止端点，min 可大于 max（跨 0°，如 330V030），角度差须按环绕计算；任一端点越界（>360°）→ 变化组判缺测（undefined）+ value-out-of-range 告警，风组本体不受牵连 */
  readonly variation?: { readonly min: number; readonly max: number; readonly span?: Span };
}

/**
 * The visibility group: value + unit, plus threshold-coding flags (9999 / 0000 / P6SM / M-prefix are not exact readings).
 * 能见度组：数值 + 单位，及阈值性编码标志（9999 / 0000 / P6SM / M 前缀非实测值）。
 */
export interface VisibilityGroup {
  /** 米或英里；SM 混分数（1 1/4SM）折十进制 1.25；NDV 后缀（无方向变化）剥离丢弃、原码经 span 回溯；0000 存 0（下限编码，非实测 0 米） */
  readonly value: number;
  readonly unit: DistanceUnit;
  /** false = 阈值性编码（9999 ≥10km 上限、0000 <50m 下限、P6SM ≥6SM 美式超上限、M 前缀 <下界），true = 实测值 */
  readonly exact: boolean;
  /** 阈值方向（与 exact=false 配对出现）：above = 大于/等于上界编码（9999、P 前缀），below = 小于下界（0000、M 前缀）——
   *  显示层据此选 >/< 前缀（M1/4SM → <0.25 SM、P6SM → >6 SM、9999 → ≥10 km、0000 → <50 m；
   *  0000 下限口径：AP-117 第 69 条「小于 50 米编 0000」，WMO 15.6.3 由最小档位 50 m 推出） */
  readonly beyond?: "above" | "below";
  /** 最低能见度方向组（WMO 15.6.2 VNVNVNVNDv：主导能见度后随 1200NW）——挂主导组上，非重复组不出 duplicate 告警 */
  readonly minimum?: { readonly value: number; readonly direction: string; readonly span?: Span };
  readonly span?: Span;
}

/**
 * Runway visual range (RVR): single-value or V-varying form, P/M beyond-range prefix, U/D/N trend, per-group unit (m or ft).
 * 跑道视程（RVR）：单值或 V 波动形态、P/M 超界前缀、U/D/N 趋势、单位跟组走（米或英尺）。
 */
export interface RunwayVisualRange {
  /** 跑道号含方位后缀，如 '07L' */
  readonly runway: string;
  /** 单值形态（R07R/0150） */
  readonly value?: number;
  /** 波动形态（R07R/1800V2200） */
  readonly min?: number;
  readonly max?: number;
  /** 超界前缀：数值一律存原码（P2000 → 2000），beyondRange 标注超界端——P/M 前缀是 RVR 标准编报形态（超过最大/低于最小可编值），不作告警；V 形态仅一端超界（1400VP2000）时 beyondRange 指向该端 */
  readonly beyondRange?: "above" | "below";
  /** 单位跟组走：北美带 FT 后缀为英尺，默认米（同一套数据两种单位并存） */
  readonly unit: "m" | "ft";
  /** 趋势后缀 U/D/N */
  readonly trend?: "up" | "down" | "no-change";
  readonly span?: Span;
}

/**
 * Weather intensity sign: -/+ only qualify precipitation and FC/SS/DS; no sign = moderate.
 * 天气强度符：-/+ 只配降水与 FC/SS/DS；无符 = 中等。
 */
export type WeatherIntensity = "-" | "+";
/** Weather descriptor code (WMO 4678: MI/PR/BC/DR/BL/SH/TS/FZ). 天气描述符电码（WMO 4678）。 */
export type WeatherDescriptor = "MI" | "PR" | "BC" | "DR" | "BL" | "SH" | "TS" | "FZ";
/** Weather phenomenon code (WMO 4678 letter set). 天气现象电码（WMO 4678 字母集）。 */
export type WeatherPhenomenon =
  | "DZ"
  | "RA"
  | "SN"
  | "SG"
  | "IC"
  | "PL"
  | "GR"
  | "GS"
  | "UP"
  | "BR"
  | "FG"
  | "FU"
  | "VA"
  | "DU"
  | "SA"
  | "HZ"
  | "PY"
  | "PO"
  | "SQ"
  | "FC"
  | "SS"
  | "DS";

/**
 * One present-weather group: optional intensity, VC proximity, optional descriptor, phenomenon list.
 * 单个现在天气组：可选强度、VC 邻近、可选描述符、现象列表。
 */
export interface WeatherGroup {
  readonly intensity?: WeatherIntensity;
  /** VC = 机场附近（5–10km 可见性限定），非本场上空 */
  readonly proximity: boolean;
  readonly descriptor?: WeatherDescriptor;
  readonly phenomena: readonly WeatherPhenomenon[];
  readonly span?: Span;
}

/** Cloud amount (okta classes). 云量电码（八分量档）。 */
export type CloudAmount = "FEW" | "SCT" | "BKN" | "OVC";
/** Sky-clear family codes (SKC/NSC/NCD/CLR — semantics differ, original code kept). 无云家族电码（语义有别，保留原码）。 */
export type SkyClearCode = "SKC" | "NSC" | "NCD" | "CLR";
/** Convective cloud type (cumulonimbus / towering cumulus). 对流云型（积雨云/浓积云）。 */
export type ConvectiveType = "CB" | "TCU";

interface CloudLayerBase {
  /** 高度英尺；/// 缺测 → value:null + missing-expected 告警（绝不捏造基高） */
  readonly heightFt: { readonly value: number | null; readonly span?: Span };
  readonly span?: Span;
}

/**
 * A cloud layer (amount + base height + optional convective type); amount/height slots carry null when missing.
 * 云层（云量 + 云底高 + 可选对流云型）；云量/云高缺测位为 null。
 */
export interface CloudLayer extends CloudLayerBase {
  readonly kind: "layer";
  /** 云量位缺测（///025CB，15.9.1.6：探测到对流云但云量无法观测）→ null + missing-expected 告警（组内子项第二例外） */
  readonly amount: CloudAmount | null;
  readonly convective?: ConvectiveType;
}

/**
 * The VV group: sky-obscured vertical visibility replacing the whole cloud section; orthogonal to the visibility group.
 * VV 组：顶替整块云组的天空全遮蔽态，与能见度组正交。
 */
export interface VerticalVisibility extends CloudLayerBase {
  readonly kind: "vertical-visibility";
}

/** A cloud-section element: a layer or a vertical-visibility group. 云组元素：云层或垂直能见度组。 */
export type CloudElement = CloudLayer | VerticalVisibility;

/**
 * The cloud condition: layer/vertical-visibility elements plus the sky-clear code when present.
 * 天空状况：云层/垂直能见度元素列表，及在位时的无云电码。
 */
export interface CloudCondition {
  readonly elements: readonly CloudElement[];
  /** 无云五兄弟：SKC（人工无云）/ NSC（有云但不显著）/ NCD（自动无探测）/ CLR（美式自动）——语义有别，保留原码 */
  readonly clear?: { readonly code: SkyClearCode; readonly span?: Span };
}

/**
 * A temperature/dewpoint reading in degrees Celsius.
 * 温度/露点读数（摄氏度）。
 */
export interface TemperatureReading {
  /** 摄氏度；−0.5°C 编 M00 → 0（负零符号经 RMK T 组兜回，原码经 span 回溯） */
  readonly celsius: number;
  readonly span?: Span;
}

/**
 * An altimeter setting: decoded physical value + unit (Q1008 → 1008 hPa; A3022 → 30.22 inHg).
 * 高度表设定：解码后的物理值 + 单位（Q1008 → 1008 hPa；A3022 → 30.22 inHg）。
 */
export interface AltimeterReading {
  /** 解码后十进制物理值：Q1008 → 1008（hPa）；A3022 → 30.22（inHg，隐含小数点）——原码经 span 回溯 */
  readonly value: number;
  readonly unit: PressureUnit;
  readonly span?: Span;
}

/**
 * The trend group: kind + period + structured inner elements (see TrendElements) + raw text.
 * 趋势组：指示组种类 + 时段 + 组内要素结构化（见 TrendElements）+ 原文。
 * span/raw cover the whole trend segment (indicator + period + all element groups, e.g. "BECMG AT0550 22015G25MPS 1000 +TSRA");
 * span/raw 覆盖整个趋势段（指示组 + 时段 + 全部要素组，如「BECMG AT0550 22015G25MPS 1000 +TSRA」）；
 * period.span covers only the period word itself; for NOSIG the span is the NOSIG word.
 * period.span 仅时段词本身；nosig 的 span 即 NOSIG 词。
 */
/** Trend indicator kind (NOSIG / BECMG / TEMPO; 'unspecified' = worn segment led by a bare period word with the change indicator lost — IEM 归档 2026-09 实弹 128 次). 趋势指示组种类。 */
export type TrendKind = "nosig" | "becmg" | "tempo" | "unspecified";

/**
 * Structured inner elements of one trend segment (WMO 306 FM15 §15.14.3: wind / visibility /
 * present weather / cloud families, plus the trend-only NSW code and CAVOK replacement).
 * Best-effort and silent: groups the grammar cannot recognize stay verbatim in `raw` and produce
 * no warnings (the parse-warning surface is snapshot-locked); `undefined` = no inner group was
 * recognized at all (e.g. bare NOSIG).
 * 趋势段内要素结构化（WMO 306 FM15 §15.14.3：风/能见度/天气/云四族，外加趋势专属电码 NSW 与
 * CAVOK 顶替形态）。best-effort 且静默：语法认不出的组原样保留在 raw、不产生告警（告警面受
 * 快照锁保护）；undefined = 组内没有任何可识别要素（如裸 NOSIG）。
 */
export interface TrendElements {
  readonly wind?: WindGroup;
  readonly visibility?: VisibilityGroup;
  /** CAVOK（§15.14.3：趋势内顶替能见度/天气/云三族的形态） */
  readonly cavok?: { readonly span?: Span };
  /** 现在天气组（§15.14.3.2 w'w'；恒为数组，空数组 = 无天气组被识别） */
  readonly weather: readonly WeatherGroup[];
  /** NSW（§15.14.3：趋势时段内无重要天气——趋势专属电码，正文无此组） */
  readonly nsw?: { readonly span?: Span };
  /** 天空状况（§15.14.3.3 NsNsNshshshs / VV / NSC 家族）；仅当云族有组被识别时在位 */
  readonly clouds?: CloudCondition;
}

/**
 * One trend group (NOSIG / BECMG / TEMPO with optional period word; worn segments whose indicator
 * was lost in transmission enter with kind 'unspecified' plus an invalid-format warning — the
 * period word keeps leading the segment so the inner elements are still fenced out of the body);
 * inner elements are structured additively in `elements` (TrendElements).
 * 单个趋势组（NOSIG / BECMG / TEMPO，时段词可选；传输磨损丢指示组的趋势段以 kind 'unspecified'
 * 进入并附 invalid-format 告警——时段词照旧引导收段，要素组不再散落正文）；组内要素经 `elements`
 * 以 additive 方式结构化（见 TrendElements）。
 */
export interface TrendGroup {
  readonly kind: TrendKind;
  /** FM/AT/TL 时段（如 AT0040，WMO 306 FM15 §15.14.3）；v0.1 保留原词 */
  readonly period?: { readonly text: string; readonly span?: Span };
  /** 组内要素结构化（best-effort、静默；undefined = 无可识别要素；NOSIG 语义上无要素） */
  readonly elements?: TrendElements;
  readonly raw: string;
  readonly span?: Span;
}

/**
 * Braking action (WMO 306 FM15 §15.13.6.1 code table 0366, friction codes 91–95, five classes); 99 = unreliable (the friction number cannot be trusted).
 * 制动作用（WMO 306 FM15 §15.13.6.1 表 0366 摩擦电码 91–95 五档）；99 = unreliable（摩擦数值不可信）。
 */
export type RunwayBraking =
  | "poor" /** 91 */
  | "medium-poor" /** 92 */
  | "medium" /** 93 */
  | "medium-good" /** 94 */
  | "good" /** 95 */
  | "unreliable"; /** 99：设备在积雪/雪浆中测值不可信 */

/**
 * The runway state group (WMO 306 FM15 §15.13.6 — runway state codes appended to METAR; being displaced by ICAO GRF since 2020, still common on GTS in winter). Three forms share this group: the six-digit state code, the CLRD family, and SNOCLO closure.
 * 跑道状态组（WMO 306 FM15 §15.13.6——METAR 附带的跑道状态电码；ICAO 全球报告格式 GRF
 * 2020 年推广后渐被 RCR 取代，GTS 通路冬季仍常见）。三类形态共用本组：
 * ①六位状态电码：R21/490160 = 沉积物类型 1 位 + 覆盖范围 1 位 + 深度 2 位 + 摩擦 2 位；
 * ②CLRD 清除家族：R07L/CLRD//（WMO 标准，摩擦缺测）与 R06L/CLRD62（俄区惯例，摩擦 0.62）；
 * ③SNOCLO 关闭：R/SNOCLO（全机场）与 R10L/SNOCLO（逐跑道）——跑道因雪/冰/清雪不可用。
 *
 * 电码表依据（WMO 306 FM15，均按 additive 契约解码）：
 * - 跑道号特殊值（§15.13.6.1 注）：88 = 全部跑道、99 = 重复上一份跑道状态报告；
 * - 沉积物类型（§15.13.6.2）：0 干燥 / 1 潮湿 / 2 湿或积水 / 3 雾凇或霜覆盖 / 4 干雪 /
 *   5 湿雪 / 6 雪浆 / 7 冰 / 8 压实或滚压雪 / 9 冻结轮辙或脊；/ = 缺报；
 * - 覆盖范围（§15.13.6.1，表 0519）：1 ≤10% / 2 11–25% / 5 26–50% / 9 51–100%；/ = 缺报；
 *   表外数字（0/3/4/6/7/8）= 非法电码 → 该位判缺测（null）+ invalid-format 告警；
 * - 深度（§15.13.6.1 表 1079）：00 = <1mm 记 0；01–90 = 毫米；92–98 = 10–40cm 段记下限毫米
 *   （92→100 … 98→400，98 为 40cm 以上）；91 电码表未用判缺测；99 = 跑道不可用
 *   （同 SNOCLO 语义 → closed=true）；// = 深度操作上不显著或缺报；
 * - 摩擦（§15.13.6.1 表 0366）：01–90 = 摩擦系数 0.01–0.90；91–95 = 制动作用五档（RunwayBraking）；
 *   99 = 数值不可靠；// = 缺报。
 */
export interface RunwayStateGroup {
  /** 跑道号（含方位字母，如 '06L'）；'' = R/SNOCLO 全机场形态 */
  readonly runway: string;
  /** 关闭：SNOCLO（§15.13.6.1）或六位电码深度位 99（跑道不可用） */
  readonly closed?: boolean;
  /** CLRD：跑道污染已清除（后随摩擦两位或 //） */
  readonly cleared: boolean;
  /** 沉积物类型电码 0–9（§15.13.6.2 表 0919）；null = /（缺报） */
  readonly deposit?: number | null;
  /** 覆盖范围电码 1/2/5/9（§15.13.6.1 表 0519——仅此四值与 /，其余数字为表外非法码）；null = /（缺报）或非法码（判缺测 + invalid-format 告警，绝不留表外值） */
  readonly coverage?: number | null;
  /** 深度毫米（§15.13.6.1 表 1079；92–98 段记下限）；深度位 99（跑道不可用）与 //（不显著/缺报）均记 null，由 closed 与 span 回溯区分 */
  readonly depth?: number | null;
  /** 摩擦系数 0.01–0.90（§15.13.6.1 表 0366 电码 01–90 折十进制；CLRD62 → 0.62 俄区惯例同族） */
  readonly frictionCoefficient?: number;
  /** 制动作用（§15.13.6.1 表 0366 电码 91–95 五档与 99 不可靠）——与摩擦系数互斥出现 */
  readonly brakingAction?: RunwayBraking;
  readonly span?: Span;
}

/**
 * Wind shear group (WMO 306 FM15 §15.13.3 / ICAO Annex 3 template — the `WS` body group).
 * 风切变组（WMO 306 FM15 §15.13.3 / ICAO Annex 3 模板——正文组 `WS`）。
 *
 * Flight-safety semantics: low-level wind shear on the approach/departure path is a
 * major hazard during takeoff and landing (sudden airspeed loss/gain); the group is
 * therefore rendered with danger-level highlighting.
 * 飞行安全语义：起降通道上的低空风切变是起飞/着陆阶段的重大危害（空速骤变），
 * 渲染层按危险级着色提示。
 *
 * Forms carried: the ICAO/WMO standard `WS ALL RWY` (all runways, allRunways=true) and
 * `WS RDRDR` (e.g. `WS R24`); the regional-practice variants `WS RWY02L` / `WS RWY18`
 * (literal `RWY` prefix before the designator) and `WS RWY ALL` (word order inverted)
 * are accepted equivalently — all four forms parse warning-free; multiple groups in one
 * report accumulate into one field (runways concat, span covers first-to-last group).
 * 承载形态：ICAO/WMO 标准的 `WS ALL RWY`（全部跑道，allRunways=true）与 `WS RDRDR`
 * （如 `WS R24`，IEM 归档实弹 544 次、中国区多发且为近月主流）；中国区实务变体
 * `WS RWY02L` / `WS RWY18`（设计器带字面 RWY 前缀）与 `WS RWY ALL`（词序倒置）同等
 * 认组——四形态均零告警解析；同报多组累积为一个字段（runways 连接、span 覆盖首组至末组）。
 */
export interface WindShearGroup {
  /** Runway designators (with position letter, e.g. '02L', '18'); empty when only an ALL form is reported. 指定跑道设计器（含方位字母）；仅报 ALL 形态时为空数组 */
  readonly runways: readonly string[];
  /** An all-runways form (`WS ALL RWY` standard / `WS RWY ALL` variant) was reported. 报有全跑道形态（标准 `WS ALL RWY` / 变体 `WS RWY ALL`） */
  readonly allRunways: boolean;
  readonly span?: Span;
}

/**
 * RMK 附加段：认组粒度收下（在 RMK 处切换语法状态机，不用 WMO 语法解 RMK）。
 * 已识别种类见 RemarkKind；未识别片段 kind='unknown'——RMK 本是各国外挂槽，未知 ≠ 错误，
 * 故不进 warnings（warnings 留给正文异常），防止噪音爆炸。
 * 少数正文位「认组收下」的组（维护符 $、变化能见度 VIS nVn、TAF 混入通路的 TX/TN）
 * 同走本槽（kind 各自标注）——正文里它们不是异常，不值得告警面，但需要一个 IR 落点。
 */
/**
 * Recognized RMK group kinds (group-level recognition; unknown fragments stay kind 'unknown' and never enter warnings — RMK is a national annex slot, unknown ≠ error).
 * RMK 认组种类（认组粒度收下；未识别片段 kind 'unknown'，不进 warnings——RMK 是各国附加段槽位，未知 ≠ 错误）。
 */
export type RemarkKind =
  | "auto-type" /** AO1 / AO2 */
  | "sea-level-pressure" /** SLP134（省略式补位规则归解析器内部） */
  | "precise-temperature" /** T 组（十分位，精度高于正文 M 组，同要素双写取高者） */
  | "precip-1h" /** P 组（英寸百分位，P0101 = 1.01 in） */
  | "precip-window" /** 6RRRR / 7RRRR（窗口语义由观测时刻决定） */
  | "snow-depth" /** 4/sss */
  | "ice-accretion" /** I1/I3/I6nnn */
  | "snow-increase" /** SNINCR 6/2（时增积雪/总积雪，英寸，两 token 一组） */
  | "pressure-tendency" /** 5appp（3h 变压） */
  | "peak-wind" /** PK WND dddff/GGgg */
  | "phenomenon-began-ended" /** FZRAB43E50 / FUNNEL CLOUD B2355 E06 */
  | "surface-visibility" /** SFC VIS n（SFC 尾串是 FC 误报大户） */
  | "variable-visibility" /** VIS nnnnVnnnn */
  | "vis-no" /** VISNO（能见度不可测） */
  | "rvr-no" /** RVRNO（RVR 不可用，美式报文置于备注区形态） */
  | "temp-extrema-24h" /** 4 组九位 40sssTTT（24h 最高/最低温度） */
  | "temp-extrema-6h" /** 1/2 组（6h 最高/最低温度） */
  | "wind-shift" /** WSHFT 1409（风向转变） */
  | "pressure-change" /** PRESRR / PRESFR（气压升降） */
  | "maintenance" /** 报尾 $（维护检查中，数据可靠性存疑） */
  | "lightning" /** LTG 系列 */
  | "thunderstorm-sensor" /** TSNO（美网高频）：雷暴传感器不工作——雷暴探测不可用，非无雷暴 */
  | "cloud-base-height" /** QBB（俄区国家组）：云底高度（米，3 位直读，与正文云组互为印证） */
  | "aerodrome-pressure" /** QFE（俄区国家组）：场面气压——QFE749 = 749 mmHg；QFE746/0995 = 746 mmHg / 995 hPa 双单位（760 mmHg = 1013.25 hPa 标准大气互证）；四位直读 hPa（QFE1003）。认组粒度收下不解码数值，原码经 span 可取 */
  | "temperature-forecast" /** TX/TN（TAF 温度预告组混入 METAR 通路，ICAO Annex 3 附录五）：TX25/0907Z = 最高 25°C 于 09 日 07Z 到达；认组收下 raw 保真，不解码数值 */
  | "twr-visibility" /** TWR VIS n（塔台能见度，FMH-1 12.7.1.f） */
  | "sectoral-visibility" /** VIS <方位> n（分区能见度，FMH-1 12.7.1.h） */
  | "cig-not-available" /** CIGNO（云高计不可用，FMH-1 12.7.1.p 族） */
  | "ceiling" /** CIG hhh（云高，百英尺） */
  | "ceiling-variation" /** CIG hhhVhhh（云高波动） */
  | "ceiling-at-location" /** CIG hhh LOC（局地云高） */
  | "precip-not-available" /** PNO（降水传感器不可用，FMH-1 12.7.2.g） */
  | "fzr-not-available" /** FZRANO（冻雨传感器不可用，FMH-1 12.7.2.g） */
  | "chino" /** CHINO（天空状况传感器不可用，FMH-1 12.7.2.g） */
  | "cloud-type-8group" /** 8/CCC（低/中/高云型电码 0–9，X 未知，/ 缺测，FMH-1 12.7.2.b） */
  | "snow-water-equivalent" /** 933RRR（积雪水当量，英寸百分之一，FMH-1 12.7.2.a） */
  | "unknown";

/**
 * One RMK group: recognized kind + verbatim raw + span.
 * 单个 RMK 组：认组 kind + 原文 raw + span。
 */
export interface RemarkGroup {
  readonly kind: RemarkKind;
  readonly raw: string;
  readonly span?: Span;
}

// ---------------------------------------------------------------- 报告

/**
 * The parsed METAR/SPECI report — the IR root. Every product is plain serializable JSON; three-state groups (wind/visibility/RVR/weather) distinguish omitted vs missing vs value.
 * 解析后的 METAR/SPECI 报文——IR 根。产物为纯 JSON 可序列化；四个三态组（风/能见度/RVR/天气）区分省略/缺测/有值。
 */
export interface MetarReport {
  readonly kind: ReportKind;
  /** 原文保真（取数源 raw 字段原样，不重排不改写） */
  readonly raw: string;
  /** NIL = 台站无观测的运行凭据（站点监测场景需要区分「无观测」与「未取到」）；
   *  NIL 报文产出最小形态 {station, time, nil:true, raw, warnings:[]}，正文组不解析（本就无正文） */
  readonly nil?: boolean;
  /** 无站名组 = 整体解析失败，不是字段级三态 */
  readonly station: string;
  /** 日时组 ddHHMMZ（UTC）；同理，无时组 = 整体解析失败 */
  readonly time: ReportTime;
  /** 正交标志位：AUTO 位与 COR 位（类型位见 kind）——两两正交，禁止合并成一个「类型」字段 */
  readonly flags: {
    readonly auto: boolean;
    readonly corrected: boolean;
  };
  /** CAVOK：能见度 ≥10km + 无低云 + 无天气三关全过；此时 vis/weather/cloud 三组让位（词位见 cavokSpan） */
  readonly cavok: boolean;
  readonly cavokSpan?: Span;
  /** 组省略 = undefined；显式缺测（/////KT）= { kind:'missing' } */
  readonly wind?: Observed<WindGroup>;
  readonly visibility?: Observed<VisibilityGroup>;
  /** RVRNO（设备存在但明示不可用）= { kind:'missing' }；组省略 = undefined；有值 = 数组。
   *  数组级 span 为首组至末组的外包络（契约见 Span 注释）；精确逐组区间在各元素 span。 */
  readonly runwayVisualRange?: Observed<readonly RunwayVisualRange[]>;
  /** 天气组缺省 = undefined；// （自动站无法观测天气）= { kind:'missing' }。
   *  数组级 span 为首组至末组的外包络（契约见 Span 注释）；精确逐组区间在各元素 span。 */
  readonly weather?: Observed<readonly WeatherGroup[]>;
  /** RE 近期天气组（15.13.2，至多三组，位于补充信息段、趋势段之前；强度恒缺省——不入 trends，无缺测形态故不套 Observed） */
  readonly recentWeather?: readonly WeatherGroup[];
  /** 天空组无整组缺测电码（子项缺测由云高/云量位兜住）；CAVOK 时整组让位为 undefined */
  readonly clouds?: CloudCondition;
  readonly temperature?: TemperatureReading;
  readonly dewpoint?: TemperatureReading;
  /** RMK T 组十分位精度（高于正文 M 组，同要素双写取高者）。
   *  v0.1 暂不填充——解析器把 T 组认进 remarks（kind 'precise-temperature'，原文经 span 可取）；
   *  数值化解计划随 strict 校验模式落地，届时填充不属破坏性变更（optional 字段）。 */
  readonly preciseTemperature?: TemperatureReading;
  /** 同 preciseTemperature：RMK T 组露点十分位。v0.1 暂不填充，原文在 remarks 可取。 */
  readonly preciseDewpoint?: TemperatureReading;
  readonly altimeter?: AltimeterReading;
  /** RMK SLP（与 A 组差 1–2 hPa 属正常姊妹关系，非脏数据）。
   *  v0.1 暂不填充——原文在 remarks（kind 'sea-level-pressure'）可取；数值化解计划随 strict 校验模式落地。 */
  readonly seaLevelPressure?: AltimeterReading;
  readonly trends: readonly TrendGroup[];
  /** 跑道状态组（§15.13.6 三形态：六位电码 / CLRD / SNOCLO——SNOCLO 自 v0.1 开发期的 runwayVisualRange missing 迁入，未发布故非破坏性）；空数组 = 报文无跑道状态组 */
  readonly runwayStates: readonly RunwayStateGroup[];
  /** 风切变组（§15.13.3，标准 `WS ALL RWY` / `WS RDRDR`，实务变体同等认组——飞行安全重大危害项，见 WindShearGroup）；undefined = 报文无风切变组 */
  readonly windShear?: WindShearGroup;
  readonly remarks: readonly RemarkGroup[];
  /** 永远存在，可为空数组 */
  readonly warnings: readonly ParseWarning[];
}

// ---------------------------------------------------------------- TAF（FM 51，v0.2 批 1 起）

/**
 * TAF 有效期组 ddHH/ddHH：预报覆盖的时间窗（发布时组之后、基况组之前）。
 * The TAF validity period ddHH/ddHH.
 */
export interface TafValidityGroup {
  /** 起日 01–31（日期数值保真；跨月回绕与时长推导属展开层，解析层不做月历推断） */
  readonly startDay: number;
  /** 起时 00–23 */
  readonly startHour: number;
  /** 止日 01–31 */
  readonly endDay: number;
  /** 止时 00–24——24 = 预报终于午夜（WMO 51.8.1 Note 1 的合法特例，非越界） */
  readonly endHour: number;
  /** 原文保真（如 `0106/0206`） */
  readonly raw: string;
  readonly span?: Span;
}

/**
 * The parsed TAF report — the forecast-side IR root, parallel to MetarReport (observation side).
 * 解析后的 TAF 报文——预报侧 IR 根，与 MetarReport（观测侧）平行。
 *
 * v0.2 批 1 骨架范围：报头（电头/站名/发布时组/有效期）与告警面；基况段字段类型先行落位、
 * 解析填充随后续批次（字段为 optional，additive 填充不破坏契约）；变化组（FM/BECMG/TEMPO/PROB）
 * 与气温组（TX/TN）的字段随对应批次再入册。
 */
export interface TafReport {
  readonly kind: "taf";
  /** 原文保真（含传输层终止符 `=`——剥离属传输层惯例，解析层如实保留原文） */
  readonly raw: string;
  /** NIL 占**有效期组位** = 台站无预报（缺报凭据；与 METAR 侧 nil 同语义）。此时无 validity，正文组不解析 */
  readonly nil?: boolean;
  /** CNL 占**风组位** = 预报取消——有效期仍在（发布与覆盖窗信息保留），正文到此截断 */
  readonly cancelled?: boolean;
  /** 无站名组 = 整体解析失败，不是字段级三态 */
  readonly station: string;
  /** 发布时组 ddHHMMZ（UTC）；非 NIL 报必填——缺失即 missing-time 整体失败。
   *  NIL 缺报的实测形态可无时组（`TAF ZSAM NIL=`，教材 §2 真实形态），故整体可选 */
  readonly issueTime?: ReportTime;
  /** 有效期组；nil 时 undefined（NIL 占其位） */
  readonly validity?: TafValidityGroup;
  /** 正交标志位：AMD 修订（取代此前发布）与 COR 更正——修订 ≠ 更正，禁止合并成一个字段 */
  readonly flags: {
    readonly amended: boolean;
    readonly corrected: boolean;
  };
  /** 基况段（有效期后、首个变化组前）——与 METAR 组类型同构（复用观测侧类型是 TAF 渲染/判据复用的根基） */
  readonly wind?: Observed<WindGroup>;
  readonly visibility?: Observed<VisibilityGroup>;
  readonly weather?: Observed<readonly WeatherGroup[]>;
  readonly clouds?: CloudCondition;
  /** CAVOK 同 METAR 三关语义；此时 vis/weather/clouds 让位 */
  readonly cavok: boolean;
  readonly cavokSpan?: Span;
  readonly remarks: readonly RemarkGroup[];
  /** 永远存在，可为空数组 */
  readonly warnings: readonly ParseWarning[];
}

// ---------------------------------------------------------------- 解析契约与语义工具

/**
 * Options for `parse`: tolerance mode (v0.1 tolerant only), external kind override, span carriage (compact mode drops all spans).
 * parse 的选项：容忍模式（v0.1 仅 tolerant）、外部类型位注入、span 携带（紧凑模式剥除全部 span）。
 */
export interface ParseOptions {
  /** 缺省 tolerant；strict 留给服务端校验接口（报文格式自动核对，路线图项）——
   *  v0.1 尚未实现：显式传 strict 会抛 MetarParseError{code:'unsupported-mode'}（类型已预留，additive 落地不破坏契约） */
  readonly mode?: "tolerant" | "strict";
  /** 外部元数据覆盖类型位（IEM 剥词场景）；缺省按正文词，无词 → 'metar' */
  readonly kind?: ReportKind;
  /** 缺省 true；false = 紧凑模式：IR 不携带任何 span（JSON 体积约 -30%，批量入库/列存场景）。
   *  spans:false 时 RAW 对照等 span 消费方优雅降级（见本文件头部设计原则第 5 条） */
  readonly spans?: boolean;
}

/**
 * Options for `parseTaf`: tolerance mode and span carriage (kind is fixed 'taf' by report nature — no external override, unlike METAR's IEM-stripped feeds).
 * parseTaf 的选项：容忍模式与 span 携带（类型位由报文本性固定为 'taf'，无外部注入场景——不同于 METAR 的 IEM 剥词源）。
 */
export interface TafParseOptions {
  /** 同 ParseOptions.mode：v0.2 尚未实现 strict，显式传即 unsupported-mode 报错（不静默降级） */
  readonly mode?: "tolerant" | "strict";
  /** 同 ParseOptions.spans：false = 紧凑模式剥除全部 span */
  readonly spans?: boolean;
}

// ---------------------------------------------------------------- 统一取值视图（普通消费方的默认入口）

/**
 * The all-two-state view type: derived automatically from the IR (adding IR fields updates the view — it can never drift).
 * 全两态视图类型：由 IR 自动派生（IR 加字段视图自动跟随，永不漂移）。
 * The four three-state groups flatten to "value | undefined" (explicit missing and omitted share one shape); all other fields pass through unchanged.
 * 四个三态组投平为「值 | undefined」（缺测与组省略同形）；其余字段原样透传。
 */
export type Values<R> = {
  [K in keyof R]: NonNullable<R[K]> extends Observed<infer T> ? T | undefined : R[K];
};

/** The two-state view of MetarReport (the default consumer entry). MetarReport 的两态视图（普通消费方默认入口）。 */
export type MetarValues = Values<MetarReport>;

/**
 * One projection to the all-two-state view; consume MetarReport directly only for three-state discrimination and warning spans.
 * 一次投影得到全两态视图；需要三态判别与告警 span 的重度场景才直接消费 MetarReport。
 */
export function toValues(report: MetarReport): MetarValues {
  return {
    ...report,
    wind: unwrap(report.wind),
    visibility: unwrap(report.visibility),
    runwayVisualRange: unwrap(report.runwayVisualRange),
    weather: unwrap(report.weather),
  };
}
