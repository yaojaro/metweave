/**
 * @metweave/render — 报文卡片：IR → 自包含 DOM 组件。
 *
 * 渐进式自定义的起点：开箱默认样式，样式随组件注入（宿主零配置）；
 * 宿主可通过 className 叠加自己的类名，或绕过本组件直接消费 IR 自建 UI。
 * 双语文案（zh / en）集中一张 locale 表（LOCALE）：行标签、徽章、悬停术语表、
 * 告警映射、日期、跑道状态口径全部入表——禁止散落三元表达式，新增语言 = 新增一列表。
 * 双语文案已按官方标准核对（2026-09-13）：WMO 306 卷 I.1（2019 版）FM15 原文与电码表
 * 0919/0519/1079/0366/4678 + 中国民航《民用航空气象地面观测规范》（AP-117-TM-2021-01R2，
 * 2022-07-01 施行，同时废止 AP-117-TM-02R1）
 * 附录十五/十六逐条对照，待 owner 终审（修订均带测试断言更新）。
 */
import type {
  WindGroup,
  CloudAmount,
  CloudElement,
  RunwayVisualRange,
  VisibilityGroup,
  MetarReport,
  ReportTime,
  RunwayBraking,
  RunwayStateGroup,
  SkyClearCode,
  Span,
  SpeedUnit,
  TrendElements,
  TrendGroup,
  WarningCode,
  WeatherDescriptor,
  WeatherGroup,
  WeatherPhenomenon,
  WindShearGroup,
} from "@metweave/core";
import { toValues } from "@metweave/core";

/**
 * Options for renderCard: display locale, RAW cross-check view, host className, and a deterministic clock for age display.
 * renderCard 的选项：显示语言、RAW 对照视图、宿主类名、龄期显示的确定性时钟注入。
 */
export interface RenderCardOptions {
  /** 显示语言，缺省中文 */
  locale?: "zh" | "en";
  /** 云底/垂直能见度的正面显示单位（悬停恒双语对照）：缺省随 locale——zh 米（中国民航口径）、
   *  en 英尺（报文原生编码即英尺，ICAO/FAA 英文惯例）；显式传入覆盖 locale 缺省。
   *  米恒为本库按 1 ft = 0.3048 m 的换算约值（悬停有换算说明），英尺是原码直读 */
  heightUnit?: "m" | "ft";
  /** 附带 RAW 对照视图（缺测/告警组高亮，悬停显示解释） */
  raw?: boolean;
  /** 宿主附加类名（叠加在组件根类名之后） */
  className?: string;
  /** 数据龄期基准时刻（缺省 new Date()）——时间行追加「N 分钟前」；测试与回放场景注入确定性时钟 */
  now?: Date;
  /** 站点名（来自站点元数据联表，如「Tianjin/Binhai Intl, TJ, CN」）——标题行下方的 muted 站名行；
   *  缺省不渲染（纯 IR 无此信息，四字码之外的名号永远来自调用方的元数据，不捏造） */
  stationTitle?: string;
}

/** renderCard 的合法选项键（运行时校验用——拼错的选项键被静默忽略 = 语言/单位/视图悄悄不符预期，
 *  违反本库不静默纪律；与 addMetarLayer 的选项校验同批落地，2026-09-15 五角色评测） */
const RENDER_CARD_OPTION_KEYS: ReadonlySet<string> = new Set([
  "locale",
  "heightUnit",
  "raw",
  "className",
  "now",
  "stationTitle",
]);

// ---------------------------------------------------------------- locale 表

/**
 * 转换说明气泡「依据」行的条款键——每个可点击组族一枚，中英文案见 LOCALE 两列 `decode.cite`。
 * 每行固定四要素：规范名称、版本、条款号、简要内容（供用户按图索骥去官方原文核查/学习；
 * 逐条款 → 实现 → 回归锁的完整对照见仓库 docs/compliance.md）。
 */
export const DECODE_CITE_KEYS = [
  "cavok",
  "wind",
  "windVariation",
  "visibility",
  "visMinimum",
  "rvr",
  "weather",
  "clouds",
  "skyClear",
  "tempDew",
  "qnh",
  "runwayState",
  "windShear",
  "trend",
] as const;
export type DecodeCiteKey = (typeof DECODE_CITE_KEYS)[number];

/**
 * 逐组族规范依据文案（名称/版本/条款号/简要内容；zh/en 各一列）。
 * 每行供用户按图索骥到官方原文核查——引文经官方原文核对（2026-09-15），
 * 完整条款对照与官方获取途径见仓库 docs/compliance.md；新增组族先在此登记依据。
 */
export const DECODE_CITES: Record<"zh" | "en", Record<DecodeCiteKey, string>> = {
  zh: {
    cavok:
      "WMO 306 卷 I.1（2019 年版）FM 15 §15.10——CAVOK 代替能见度/天气/云组：能见度 ≥10 km、无低云与 CB/TCU、无重要天气",
    wind: "WMO 306 卷 I.1（2019 年版）FM 15 §15.5.1–15.5.6——dddff＝观测前 10 分钟平均风向与平均风速，单位后缀紧跟组后（§15.5.1）；VRB＝风向不定、00000＝静风、G＝阵风、P＝超上限（同节各条）",
    windVariation:
      "WMO 306 卷 I.1（2019 年版）FM 15 §15.5.3——dndndnVdxdxdx＝10 分钟内风向变化 ≥60° 且 <180° 时的两个边界方位（顺时针）",
    visibility:
      "WMO 306 卷 I.1（2019 年版）FM 15 §15.6.1、§15.6.3——VVVV＝主导能见度 4 位米制；9999＝10 km 或以上（上限编码）",
    visMinimum:
      "WMO 306 卷 I.1（2019 年版）FM 15 §15.6.2——VNVNVNVNDv＝最低能见度及其八方位方向（与主导能见度差异显著时编报）",
    rvr: "WMO 306 卷 I.1（2019 年版）FM 15 §15.7.1–15.7.5——跑道视程组：4 位米制值（至多 4 条跑道）、P/M 超界、V 波动、U/D/N 趋势；FT 后缀＝英尺（美制 FMH-1）",
    weather:
      "WMO 306 卷 I.1（2019 年版）FM 15 §15.8 及电码表 4678——现在天气至多三组，语序＝强度/邻近 → 描述符 → 现象；UP＝自动站无法辨识的降水（§15.8.6）",
    clouds:
      "WMO 306 卷 I.1（2019 年版）FM 15 §15.9.1——云量 FEW/SCT/BKN/OVC（八分量）＋云底高（百英尺编报，台阶 30 m/100 ft）；CB/TCU 对流云附标（§15.9.1.7）",
    skyClear:
      "WMO 306 卷 I.1（2019 年版）FM 15 §15.9.1.1——NSC/NCD 无云电码（自动站未探测到云用 NCD）；CLR 为美制电码（美国 FMH-1，FCM-H1-1995）",
    tempDew:
      "WMO 306 卷 I.1（2019 年版）FM 15 §15.11——T'T'/T'dT'd＝整摄氏度气温/露点，负值加 M（M00＝−0.5℃）；美制同形见 FMH-1 §12.6.10",
    qnh: "WMO 306 卷 I.1（2019 年版）FM 15 §15.12——Qxxxx＝QNH 整百帕（不足 1000 前补 0）；Axxxx＝美制高度表设定（隐含两位小数，inHg；FMH-1）",
    runwayState:
      "WMO 306 卷 I.1（2019 年版）FM 15 §15.13.6——跑道状态四段电码按电码表 0919/0519/1079/0366 解码；R/SNOCLO＝关闭，CLRD＝污染清除",
    windShear:
      "WMO 306 卷 I.1（2019 年版）FM 15 §15.13.3——WS RDRDR / WS ALL RWY＝起飞/进近路径低空风切变",
    trend:
      "WMO 306 卷 I.1（2019 年版）FM 15 §15.14——BECMG＝渐变、TEMPO＝短时波动、NOSIG＝无显著变化（§15.14.15）；时段词 FM/TL/AT（§15.14.3）",
  },
  en: {
    cavok:
      "WMO No. 306 Vol I.1 (2019), FM 15 §15.10 — CAVOK replaces visibility/weather/cloud groups: vis ≥10 km, no low cloud or CB/TCU, no significant weather",
    wind: "WMO No. 306 Vol I.1 (2019), FM 15 §15.5.1–15.5.6 — dddff = 10-min mean wind direction and speed, unit suffix follows the group (§15.5.1); VRB variable, 00000 calm, G gust, P above-range (same section)",
    windVariation:
      "WMO No. 306 Vol I.1 (2019), FM 15 §15.5.3 — dndndnVdxdxdx = the two extreme directions when variation is ≥60° and <180° (clockwise)",
    visibility:
      "WMO No. 306 Vol I.1 (2019), FM 15 §15.6.1, §15.6.3 — VVVV = prevailing visibility, 4 digits in metres; 9999 = 10 km or more (ceiling code)",
    visMinimum:
      "WMO No. 306 Vol I.1 (2019), FM 15 §15.6.2 — VNVNVNVNDv = minimum visibility and its compass direction (when markedly different from prevailing)",
    rvr: "WMO No. 306 Vol I.1 (2019), FM 15 §15.7.1–15.7.5 — RVR group: 4-digit metre value (up to 4 runways), P/M beyond-range, V fluctuation, U/D/N trend; FT suffix = feet (US FMH-1)",
    weather:
      "WMO No. 306 Vol I.1 (2019), FM 15 §15.8 and Code table 4678 — up to three groups; order = intensity/proximity → descriptor → phenomenon; UP = precipitation unidentified by automatic station (§15.8.6)",
    clouds:
      "WMO No. 306 Vol I.1 (2019), FM 15 §15.9.1 — amount FEW/SCT/BKN/OVC (oktas) + base height in hundreds of feet (30 m/100 ft steps); CB/TCU convective appendix (§15.9.1.7)",
    skyClear:
      "WMO No. 306 Vol I.1 (2019), FM 15 §15.9.1.1 — NSC/NCD no-cloud codes (NCD = automatic, none detected); CLR is the US code (FMH-1, FCM-H1-1995)",
    tempDew:
      "WMO No. 306 Vol I.1 (2019), FM 15 §15.11 — T'T'/T'dT'd = whole-°C temperature/dewpoint, M prefix for negative (M00 = −0.5 °C); US form in FMH-1 §12.6.10",
    qnh: "WMO No. 306 Vol I.1 (2019), FM 15 §15.12 — Qxxxx = QNH in whole hPa (leading 0 below 1000); Axxxx = US altimeter setting (implied 2 decimals, inHg; FMH-1)",
    runwayState:
      "WMO No. 306 Vol I.1 (2019), FM 15 §15.13.6 — runway-state codes per code tables 0919/0519/1079/0366; R/SNOCLO = closed, CLRD = cleared",
    windShear:
      "WMO No. 306 Vol I.1 (2019), FM 15 §15.13.3 — WS RDRDR / WS ALL RWY = low-level wind shear on the takeoff/approach path",
    trend:
      "WMO No. 306 Vol I.1 (2019), FM 15 §15.14 — BECMG gradual, TEMPO temporary, NOSIG no significant change (§15.14.15); period FM/TL/AT (§15.14.3)",
  },
};

/** 单语言全部文案与口径（函数项用于本地语序拼装；新增语言按本接口补一列表）。 */
interface LocaleTable {
  /** 要素行标签 */
  label: {
    wind: string;
    visibility: string;
    weather: string;
    clouds: string;
    temperature: string;
    dewpoint: string;
    altimeter: string;
    rvr: string;
    trend: string;
    runwayState: string;
    windShear: string;
  };
  /** 头部徽章（cavokShort = CAVOK 徽章内直白短译——非专业零悬停可读，精确语义仍在 cavokHint 悬停） */
  badge: { speci: string; metar: string; corrected: string; auto: string; cavokShort: string };
  /** 整组缺测行占位文案（显式缺测电码渲染「缺测」行，与组省略不渲染的口径区分） */
  missingGroup: { wind: string; visibility: string; weather: string; rvr: string };
  /** CAVOK 徽章悬停（CAVOK ≠ 晴空，防业务歧义） */
  cavokHint: string;
  /** 风切变行悬停（WMO 306 FM15 §15.13.3：低层风切变——起飞/进近航径重大危害） */
  windShearNote: string;
  /** 风行（显示值 + 悬停说明） */
  wind: {
    gust: string;
    variable: string;
    missing: string;
    calm: string;
    vrbNote: string;
    calmNote: string;
    variationNote: string;
    hintSep: string;
    unit: Record<SpeedUnit, string>;
    gustOf: (value: number) => string;
    /** 风向变化组行内显示（纯人话：原码只在 RAW 视图与悬停） */
    variationOf: (min: number, max: number) => string;
  };
  /** 云悬停（云量八分量 / 云底折米 / 对流云威胁 / VV） */
  cloud: {
    amount: Record<CloudAmount, string>;
    baseFtMeters: (feet: number, meters: number) => string;
    /** 行内纯译文：云量短名 / 云底米值 / 米值后缀（VV 行用，不带「云底」语义）/ 云量缺测占位 / VV 高度缺测占位 */
    shortAmount: Record<CloudAmount, string>;
    baseShortMeters: (meters: number) => string;
    metersShort: (meters: number) => string;
    /** 英尺正面显示（heightUnit:"ft" 时用，带「云底」语义 / VV 高度后缀） */
    baseShortFeet: (feet: number) => string;
    feetShort: (feet: number) => string;
    /** 米值口径说明（附在悬停末尾）：报文只编英尺，米是本库换算的约值 */
    metersDerivedNote: string;
    amountUnknown: string;
    vvMissing: string;
    heightUnknown: string;
    vvShort: string;
    /** 最低能见度方向组（WMO 15.6.2）解码 */
    minimumOf: (meters: number, direction: string) => string;
    /** 无云电码短语（SKC/NSC/NCD/CLR 语义有别，各给一词——正文云行与趋势内容共用） */
    skyClear: Record<SkyClearCode, string>;
    cbNote: string;
    tcuNote: string;
    vv: string;
  };
  /** RVR 行纯译文拼装（原码 R07R/… 只在 RAW 视图与悬停提示） */
  rvr: {
    runway: (runway: string) => string;
    above: string;
    below: string;
    varying: (min: number, max: number, unit: string) => string;
    unit: { m: string; ft: string };
    trendUp: string;
    trendDown: string;
    trendNoChange: string;
  };
  /** 风切变行纯译文（值不含 WS 电码，电码在悬停与 RAW） */
  ws: {
    all: string;
    runways: (runways: string) => string;
  };
  /** 点击气泡的「转换说明」表头（原码片段 → 含义）＋ 逐组族的规范依据行（名称/版本/条款号/简要内容） */
  decode: {
    title: string;
    code: string;
    /** 依据行前缀（zh「依据」/ en "Basis"） */
    basisLabel: string;
    cite: Record<DecodeCiteKey, string>;
  };
  /** 天气组悬停（WMO 4678 术语表 + 自然语序拼装） */
  wx: {
    phenomena: Record<WeatherPhenomenon, string>;
    descriptors: Record<WeatherDescriptor, string>;
    heavy: string;
    light: string;
    /** 非 TS 族的强度词（zh 小/大——直连现象名词：小雨/大雨/小雪/大雪；TS 族沿用 heavy/light 强/轻） */
    heavyPlain: string;
    lightPlain: string;
    proximityPrefix: string | null;
    proximitySuffix: string | null;
    thunderstorm: string;
    thunderstormWith: (phenom: string) => string;
    /** 描述符+现象的自然语序拼装（zh SH 族拼「阵雨/阵雪」；双空参形态给缺省短语） */
    descCompose: (descriptor: string, phenom: string) => string;
    join: string;
    joinParts: string;
    hazard: string;
  };
  /** 观测时刻 */
  timeText: (t: ReportTime) => string;
  /** 数据龄期分档（观测时刻与 now 的分钟差）：<60 分钟「N 分钟前」；<48 小时「N 小时前」（取整）；以上「N 天前」 */
  ago: (minutes: number) => string;
  /** RVR 行悬停解码（按在场要素拼装：V 波动 / U·D·N 趋势 / P·M 超界前缀） */
  rvrNote: { varying: string; trend: string; beyond: string };
  /** 趋势行悬停（kind 语义 + TL/AT 预计时刻 + 组内要素人话 + WS 内嵌提示——标准与实务变体形态均识别） */
  trendNote: {
    nosig: string;
    becmg: string;
    tempo: string;
    /** 磨损趋势段（时段词在位、指示组传输丢失，kind 'unspecified'） */
    unspecified: string;
    /** 时段词 → 具体时间点（HHMM 折 HH:MM；AT/TL/FM 指示语义由前导词表达，不再重复原词） */
    periodAt: (text: string) => string;
    /** 趋势段内容短语前导词（组内要素人话的开始标记） */
    contentLead: string;
    /** NSW = 趋势时段内无重要天气（WMO 306 FM15 §15.14.3，趋势专属电码） */
    nsw: string;
    windShear: string;
  };
  /** 告警文案：zh 直出 message；en 走每 code 模板 + 原文切片插值（信息粒度对齐 zh），未映射的 code 回退 `code: 原文切片`（信息不丢） */
  warningText: (code: WarningCode, message: string, rawSlice?: string) => string;
  /** 行内多组分隔（zh 全角空格 / en 间隔点） */
  sep: string;
  /** 跑道状态行（WMO 306 FM15 §15.13.6 与电码表 0919/0519/1079/0366；已按官方标准核对 2026-09-13，待 owner 终审） */
  rwy: {
    closed: string;
    closedAll: string;
    cleared: string;
    /** 沉积物类型电码 0–9（§15.13.6.2） */
    deposit: readonly string[];
    /** 覆盖范围电码 1/2/5/9（§15.13.6.1 表 0519） */
    coverage: Readonly<Partial<Record<number, string>>>;
    coverageLabel: string;
    depthLabel: string;
    /** 深度（§15.13.6.1 表 1079）：0 = <1 mm；毫米；≥100 的 92–98 段以厘米显示 */
    depthText: (mm: number) => string;
    friction: (coeff: number) => string;
    brakingLabel: string;
    /** 制动作用五档 + unreliable（§15.13.6.1 表 0366 电码 91–95 / 99） */
    braking: Record<RunwayBraking, string>;
    closedNote: string;
    clearedNote: string;
    wmoNote: string;
    itemSep: string;
  };
  /** 悬停拼接标点（原码 与 解读 之间 / 解读 与 注释 之间） */
  colon: string;
  dash: string;
}

/**
 * en 告警模板（WarningCode 只增不改：未及映射的新 code 运行时回退 `code: 原文切片`）。
 * 每 code 模板 + 原文切片插值（与 zh message 的信息粒度对齐——切片在场即注入括号，
 * 如 "Missing-value code (////) in a normally present group"；切片缺席给无括号形态）。
 */
const WARNINGS_EN: Record<WarningCode, (slice: string) => string> = {
  "unknown-token": (slice) =>
    `Unrecognized group${slice === "" ? "" : ` (${slice})`} — kept verbatim, never dropped`,
  "invalid-format": (slice) =>
    `Group recognized but malformed${slice === "" ? "" : ` (${slice})`} — parsed as best effort`,
  "value-out-of-range": (slice) =>
    `Value outside the plausible range${slice === "" ? "" : ` (${slice})`} — treated as missing`,
  "missing-expected": (slice) =>
    `Missing-value code${slice === "" ? "" : ` (${slice})`} in a normally present group`,
  "duplicate-group": (slice) =>
    `Duplicate group${slice === "" ? "" : ` (${slice})`} — the last occurrence is kept; the displaced earlier value stays traceable via the raw text`,
  "cross-check-conflict": (slice) =>
    `Cross-check conflict${slice === "" ? "" : ` (${slice})`} between groups — values kept as reported`,
};

/** locale 表本体：zh 列保持既有口径（测试回归锁），en 列按航空英文惯用（QNH/RVR 等缩写保留）。 */
const LOCALE: Record<"zh" | "en", LocaleTable> = {
  zh: {
    label: {
      wind: "风",
      visibility: "能见度",
      weather: "天气",
      clouds: "云",
      temperature: "气温",
      dewpoint: "露点",
      altimeter: "修正海压",
      rvr: "跑道视程",
      trend: "趋势",
      runwayState: "跑道状态",
      windShear: "风切变",
    },
    badge: {
      speci: "特殊报告",
      metar: "例行报告",
      corrected: "更正报",
      auto: "自动观测",
      cavokShort: "能见度佳、低云与天气无碍",
    },
    missingGroup: {
      wind: "风组缺测",
      visibility: "能见度组缺测",
      weather: "天气组缺测",
      rvr: "跑道视程缺测（RVRNO）",
    },
    cavokHint: "CAVOK：能见度 ≥10km、5000ft 以下无云无天气，且任意高度无积雨云/浓积云（≠晴空）",
    windShearNote: "低空风切变——起降阶段重大危害（WS，WMO 306 FM15 §15.13.3）",
    wind: {
      gust: "阵风",
      variable: "风向不定",
      missing: "风向缺测",
      calm: "静风",
      vrbNote: "VRB = 风向不定（全向）",
      calmNote: "静风 = 风速为零",
      variationNote: "风向变化范围 = 风向在两个边界值之间变动（10 分钟观测时段内、顺时针方向编报）",
      hintSep: "；",
      unit: {
        kt: "kt = 节（海里/小时）",
        mps: "mps = 米/秒",
        kmh: "kmh = 千米/小时",
      },
      gustOf: (value) => `（阵风 ${value}）`,
      variationOf: (min, max) => `（风向在 ${deg3(min)}° 与 ${deg3(max)}° 间变动）`,
    },
    cloud: {
      amount: {
        FEW: "少云：约 1–2 个量（1/8–2/8）",
        SCT: "疏云：约 3–4 个量（3/8–4/8）",
        BKN: "多云：约 5–7 个量（5/8–7/8）",
        OVC: "阴：8 个量（8/8，天空全遮蔽）",
      },
      shortAmount: { FEW: "少云", SCT: "疏云", BKN: "多云", OVC: "阴" },
      baseShortMeters: (meters) => `，云底约 ${meters} 米`,
      metersShort: (meters) => ` 约 ${meters} 米`,
      /** 英尺正面显示（heightUnit:"ft" 时用；英尺是报文原码直读，不加「约」） */
      baseShortFeet: (feet) => `，云底 ${feet} 英尺`,
      feetShort: (feet) => ` ${feet} 英尺`,
      metersDerivedNote:
        "（米为本库按 1 英尺 = 0.3048 米换算；报文只编英尺且以百英尺为台阶，故米值为约值）",
      amountUnknown: "云量缺测",
      vvMissing: "垂直能见度缺测",
      heightUnknown: "云底缺测",
      vvShort: "垂直能见度",
      baseFtMeters: (feet, meters) => `，云底 ${feet} 英尺 ≈ ${meters} 米`,
      minimumOf: (meters, direction) => `最低能见度 ${meters} 米（${direction} 方向）`,
      skyClear: {
        SKC: "无云（人工观测）",
        NSC: "无显著云",
        NCD: "无云（自动站未探测）",
        CLR: "无云（自动观测）",
      },
      cbNote: "（CB 积雨云：雷暴、冰雹、强颠簸风险）",
      tcuNote: "（TCU 浓积云：强颠簸与积冰风险）",
      vv: "VV = 垂直能见度：天空全遮蔽时能见的垂直高度",
    },
    wx: {
      phenomena: {
        DZ: "毛毛雨",
        RA: "雨",
        SN: "雪",
        SG: "米雪",
        IC: "冰晶",
        PL: "冰粒",
        GR: "冰雹",
        GS: "小雹和/或霰",
        UP: "未知降水",
        BR: "轻雾",
        FG: "雾",
        FU: "烟",
        VA: "火山灰",
        DU: "浮尘",
        SA: "沙",
        HZ: "霾",
        PY: "浪花",
        PO: "尘/沙旋风（尘卷风）",
        SQ: "飑",
        FC: "漏斗云",
        SS: "沙暴",
        DS: "尘暴",
      },
      descriptors: {
        MI: "浅",
        PR: "部分",
        BC: "散片",
        DR: "低吹",
        BL: "高吹",
        SH: "阵性",
        TS: "雷暴",
        FZ: "冻",
      },
      heavy: "强",
      light: "轻",
      // 非 TS 族强度词（民航局规范口径：+RA 大雨、-SN 小雪——「强雨/轻雨」废止）
      heavyPlain: "大",
      lightPlain: "小",
      proximityPrefix: "机场附近有",
      proximitySuffix: null,
      thunderstorm: "雷暴",
      thunderstormWith: (phenom) => `雷暴伴${phenom}`,
      // SH 族拼「阵雨/阵雪」（「阵性雨」废止）；双空参（VCSH）给全称短语
      descCompose: (descriptor, phenom) =>
        descriptor === "阵性"
          ? phenom === ""
            ? "阵性降水（类型不可辨）"
            : `阵${phenom}`
          : phenom === ""
            ? descriptor
            : `${descriptor}${phenom}`,
      join: "、",
      joinParts: "",
      hazard: "（飞行威胁大）",
    },
    timeText: (t) =>
      `${String(t.day).padStart(2, "0")}日 ${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")} UTC`,
    ago: (minutes) =>
      minutes < 60
        ? `（${minutes} 分钟前）`
        : minutes < 48 * 60
          ? `（${Math.floor(minutes / 60)} 小时前）`
          : `（${Math.floor(minutes / 1440)} 天前）`,
    rvrNote: {
      varying: "V = 观测时段内在两极值间波动",
      trend: "U/D/N = 上升/下降/无变化",
      beyond: "P/M 前缀 = 超出上限/低于下限",
    },
    rvr: {
      runway: (runway) => `跑道 ${runway}`,
      above: "高于 ",
      below: "低于 ",
      varying: (min, max, unit) => `在 ${min} 与 ${max} ${unit}间变动`,
      unit: { m: "米", ft: "英尺" },
      trendUp: "，趋势上升",
      trendDown: "，趋势下降",
      trendNoChange: "，趋势无变化",
    },
    ws: {
      all: "全部跑道受影响",
      runways: (runways) => `跑道 ${runways} 受影响`,
    },
    decode: {
      title: "转换说明（原码 → 含义）",
      code: "原码",
      basisLabel: "依据：",
      cite: DECODE_CITES.zh,
    },
    trendNote: {
      nosig: "无重要变化",
      becmg: "渐变（逐步转变）",
      tempo: "短时波动（临时性变化）",
      unspecified: "磨损趋势段（指示组缺失，渐变/短时不可辨）",
      // HHMM 折 HH:MM 出具体时间点（时段词已在解析面锁定 AT/TL/FM+4 位，形状不符回退原词防捏造）
      periodAt: (text) => {
        const m = /^(AT|TL|FM)(\d{2})(\d{2})$/.exec(text);
        if (m === null) return `预计时刻 ${text}`;
        const hm = `${m[2]}:${m[3]}`;
        return m[1] === "TL" ? `持续至 ${hm}` : m[1] === "FM" ? `自 ${hm} 起` : `预计时刻 ${hm}`;
      },
      contentLead: "趋向：",
      nsw: "NSW = 趋势时段内无重要天气",
      windShear: "趋势内含风切变（WS）——起降注意",
    },
    warningText: (_code, message) => message,
    sep: "　",
    rwy: {
      closed: "跑道关闭",
      closedAll: "全机场跑道关闭",
      cleared: "已清除",
      deposit: [
        "清洁且干燥",
        "潮湿",
        "湿或积水",
        "雾凇或霜覆盖",
        "干雪",
        "湿雪",
        "雪浆",
        "冰",
        "压实或滚压雪",
        "冻结轮辙或脊",
      ],
      coverage: { 1: "<10%", 2: "11–25%", 5: "26–50%", 9: "51–100%" },
      coverageLabel: "覆盖 ",
      depthLabel: "深度 ",
      depthText: (mm) =>
        mm === 0 ? "<1 mm" : mm === 400 ? "40 cm 或以上" : mm >= 100 ? `${mm / 10} cm` : `${mm} mm`,
      friction: (coeff) => `摩擦系数 ${coeff.toFixed(2)}`,
      brakingLabel: "制动作用 ",
      braking: {
        poor: "差",
        "medium-poor": "较差",
        medium: "中",
        "medium-good": "较好",
        good: "好",
        unreliable: "不可靠（摩擦数值不可靠）",
      },
      closedNote:
        "跑道不可用（深度位 99＝因雪/雪浆/冰/大雪堆/清雪作业关闭，深度未报；SNOCLO＝机场因大量积雪关闭）",
      clearedNote: "CLRD：跑道污染已清除（后随摩擦两位或 //）",
      wmoNote:
        "WMO 306 FM15 §15.13.6 跑道状态电码（电码表 0919/0519/1079/0366；已按官方标准核对 2026-09-13，待 owner 终审）",
      itemSep: "，",
    },
    colon: "：",
    dash: "——",
  },
  en: {
    label: {
      wind: "Wind",
      visibility: "Visibility",
      weather: "Weather",
      clouds: "Clouds",
      temperature: "Temperature",
      dewpoint: "Dewpoint",
      altimeter: "QNH",
      rvr: "RVR",
      trend: "Trend",
      runwayState: "Runway state",
      windShear: "Wind shear",
    },
    badge: {
      speci: "SPECI",
      metar: "METAR",
      corrected: "COR",
      auto: "AUTO",
      cavokShort: "good visibility; no low cloud or significant weather",
    },
    missingGroup: {
      wind: "Wind group missing",
      visibility: "Visibility group missing",
      weather: "Weather group missing",
      rvr: "RVR unavailable (RVRNO)",
    },
    cavokHint:
      "CAVOK: visibility ≥10 km, no cloud below 5000 ft, no significant weather, and no CB/TCU at any height",
    windShearNote:
      "Low-level wind shear — a major hazard during takeoff and landing (WS, WMO 306 FM15 §15.13.3)",
    wind: {
      gust: "Gust",
      variable: "Variable",
      missing: "Wind direction missing",
      calm: "Calm",
      vrbNote: "VRB = variable direction (all sectors)",
      calmNote: "Calm = wind speed zero",
      variationNote:
        "wind direction variation = the two extreme directions between which the wind varied (clockwise order)",
      hintSep: "; ",
      unit: {
        kt: "kt = knots (nautical miles per hour)",
        mps: "mps = meters per second",
        kmh: "kmh = kilometers per hour",
      },
      gustOf: (value) => ` (Gust ${value})`,
      variationOf: (min, max) => `(wind varying between ${deg3(min)}° and ${deg3(max)}°)`,
    },
    cloud: {
      amount: {
        FEW: "Few: 1–2 oktas (1/8–2/8)",
        SCT: "Scattered: 3–4 oktas (3/8–4/8)",
        BKN: "Broken: 5–7 oktas (5/8–7/8)",
        OVC: "Overcast: 8 oktas (8/8, sky fully covered)",
      },
      shortAmount: { FEW: "few", SCT: "scattered", BKN: "broken", OVC: "overcast" },
      baseShortMeters: (meters) => `, base ≈ ${meters} m`,
      metersShort: (meters) => ` ≈ ${meters} m`,
      /** Feet face display (heightUnit:"ft"; feet are read straight from the coded report — no "≈") */
      baseShortFeet: (feet) => `, base ${feet} ft`,
      feetShort: (feet) => ` ${feet} ft`,
      metersDerivedNote:
        " (metres are converted by this library at 1 ft = 0.3048 m; the report codes cloud base in feet in 100 ft steps, so the metre value is approximate)",
      amountUnknown: "cloud amount not reported",
      vvMissing: "vertical visibility not reported",
      heightUnknown: "cloud base not reported",
      vvShort: "vertical visibility",
      baseFtMeters: (feet, meters) => `, base ${feet} ft ≈ ${meters} m`,
      minimumOf: (meters, direction) => `minimum visibility ${meters} m (${direction})`,
      skyClear: {
        SKC: "no clouds (manual observation)",
        NSC: "no significant clouds",
        NCD: "no clouds detected (automatic station)",
        CLR: "no clouds (automatic observation)",
      },
      cbNote: " (CB cumulonimbus: thunderstorm, hail, severe turbulence risk)",
      tcuNote: " (TCU towering cumulus: severe turbulence and icing risk)",
      vv: "VV = vertical visibility: height visible when the sky is fully obscured",
    },
    wx: {
      phenomena: {
        DZ: "drizzle",
        RA: "rain",
        SN: "snow",
        SG: "snow grains",
        IC: "ice crystals",
        PL: "ice pellets",
        GR: "hail",
        GS: "small hail and/or snow pellets",
        UP: "unknown precipitation",
        BR: "mist",
        FG: "fog",
        FU: "smoke",
        VA: "volcanic ash",
        DU: "widespread dust",
        SA: "sand",
        HZ: "haze",
        PY: "spray",
        PO: "dust/sand whirls (dust devils)",
        SQ: "squalls",
        FC: "funnel cloud (tornado or waterspout)",
        SS: "sandstorm",
        DS: "duststorm",
      },
      descriptors: {
        MI: "shallow",
        PR: "partial",
        BC: "patches",
        DR: "low drifting",
        BL: "blowing",
        SH: "showers",
        TS: "thunderstorm",
        FZ: "freezing",
      },
      heavy: "Heavy",
      light: "Light",
      heavyPlain: "Heavy",
      lightPlain: "Light",
      proximityPrefix: null,
      proximitySuffix: " in vicinity",
      thunderstorm: "thunderstorm",
      thunderstormWith: (phenom) => `thunderstorm with ${phenom}`,
      descCompose: (descriptor, phenom) =>
        descriptor === "showers"
          ? phenom === ""
            ? "showers (type indistinguishable)"
            : `${phenom} showers`
          : phenom === ""
            ? descriptor
            : `${descriptor} ${phenom}`,
      join: " and ",
      joinParts: " ",
      hazard: " (major flight hazard)",
    },
    timeText: (t) =>
      `Day ${t.day}, ${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")} UTC`,
    ago: (minutes) =>
      minutes < 60
        ? ` (${minutes} min ago)`
        : minutes < 48 * 60
          ? ` (${Math.floor(minutes / 60)} h ago)`
          : ` (${Math.floor(minutes / 1440)} d ago)`,
    rvrNote: {
      varying: "V = varying between two extreme values during the period",
      trend: "U/D/N = up/down/no change",
      beyond: "P/M prefix = above the upper / below the lower limit",
    },
    rvr: {
      runway: (runway) => `Runway ${runway}`,
      above: "above ",
      below: "below ",
      varying: (min, max, unit) => `varying between ${min} and ${max} ${unit}`,
      unit: { m: "m", ft: "ft" },
      trendUp: ", trend up",
      trendDown: ", trend down",
      trendNoChange: ", no change",
    },
    ws: {
      all: "all runways affected",
      runways: (runways) => `runways ${runways} affected`,
    },
    decode: {
      title: "How this was decoded (code → meaning)",
      code: "Code",
      basisLabel: "Basis: ",
      cite: DECODE_CITES.en,
    },
    trendNote: {
      nosig: "no significant change expected",
      becmg: "gradual change",
      tempo: "temporary fluctuations",
      unspecified:
        "worn trend segment (change indicator lost; gradual vs temporary indistinguishable)",
      // HHMM → HH:MM (the AT/TL/FM indicator semantics are carried by the leading words, never repeated verbatim)
      periodAt: (text) => {
        const m = /^(AT|TL|FM)(\d{2})(\d{2})$/.exec(text);
        if (m === null) return `expected at ${text}`;
        const hm = `${m[2]}:${m[3]}`;
        return m[1] === "TL" ? `until ${hm}` : m[1] === "FM" ? `from ${hm}` : `at ${hm}`;
      },
      contentLead: "expected: ",
      nsw: "NSW = no significant weather in the trend period",
      windShear: "wind shear embedded in the trend (WS) — caution on takeoff/landing",
    },
    warningText: (code, _message, rawSlice) =>
      WARNINGS_EN[code] !== undefined
        ? WARNINGS_EN[code](rawSlice ?? "")
        : rawSlice !== undefined && rawSlice !== ""
          ? `${code}: ${rawSlice}`
          : code,
    sep: " · ",
    rwy: {
      closed: "Runway closed",
      closedAll: "All runways closed",
      cleared: "Cleared",
      deposit: [
        "clear and dry",
        "damp",
        "wet and water patches",
        "rime and frost covered",
        "dry snow",
        "wet snow",
        "slush",
        "ice",
        "compacted or rolled snow",
        "frozen ruts or ridges",
      ],
      coverage: { 1: "<10%", 2: "11–25%", 5: "26–50%", 9: "51–100%" },
      coverageLabel: "coverage ",
      depthLabel: "depth ",
      depthText: (mm) =>
        mm === 0 ? "<1 mm" : mm === 400 ? "≥40 cm" : mm >= 100 ? `${mm / 10} cm` : `${mm} mm`,
      friction: (coeff) => `friction ${coeff.toFixed(2)}`,
      brakingLabel: "braking ",
      braking: {
        poor: "poor",
        "medium-poor": "medium/poor",
        medium: "medium",
        "medium-good": "medium/good",
        good: "good",
        unreliable: "unreliable",
      },
      closedNote:
        "runway non-operational (depth digit 99 = closed due to snow/slush/ice/large drifts/runway clearance, depth not reported; SNOCLO = aerodrome closed due to extreme deposit of snow)",
      clearedNote: "CLRD: contamination cleared (followed by two friction digits or //)",
      wmoNote:
        "WMO 306 FM15 §15.13.6 runway state code (code tables 0919/0519/1079/0366; verified against official WMO tables 2026-09-13, pending owner review)",
      itemSep: ", ",
    },
    colon: ": ",
    dash: " — ",
  },
};

/** 飞行威胁标注（复评定案：VA/GR/TS 优先） */
const isFlightHazard = (g: WeatherGroup): boolean =>
  g.phenomena.includes("VA") || g.phenomena.includes("GR") || g.descriptor === "TS";

/** 悬停解释统一挂载：title 与 aria-label 同挂同文。
 *  title 单押触屏无 hover、键盘不可聚焦、默认读屏不朗读（三重不可达）；
 *  aria-label 让同一文案进入可编程访问面（读屏/辅助技术可读）。 */
const attachHint = (node: HTMLElement, hint: string): void => {
  node.title = hint; // 桌面悬停原生气泡保留
  node.setAttribute("aria-label", hint); // 读屏通道
  node.classList.add("mw-hint"); // 点击/键盘切换气泡（见 root 委托与 .mw-hint-pop 样式）
  node.tabIndex = 0; // 键盘 Tab 可达（:focus-visible 显示气泡）
  node.dataset.hint = hint; // 气泡文案源（不污染 textContent，RAW 对照原样）
};

/** 风向三位补零（变程 20°–90° 的电码形态 020V090） */
const deg3 = (deg: number): string => String(deg).padStart(3, "0");

/** 数据龄期观测时刻推定：report.time 只编 日/时/分（无年月）。
 *  假设（显示层口径，初稿）：报文龄期不超过数小时——取 now（UTC）当日为基准向前逐日回退，
 *  第一个「不晚于 now 且日号吻合」的候选即观测时刻（跨日/跨月由 Date.UTC 的日期回绕自动处理）；
 *  回退上限 7 天防病态输入，无可吻合候选（如日 31 落在短月窗口）返回 null——龄期行不渲染。 */
function observeTimeOf(t: ReportTime, now: Date): Date | null {
  const nowMs = now.getTime();
  const base = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    t.hour,
    t.minute,
  );
  for (let offset = 0; offset <= 7; offset += 1) {
    const ms = base - offset * 86_400_000;
    if (ms > nowMs) continue;
    if (new Date(ms).getUTCDate() === t.day) return new Date(ms);
  }
  return null;
}

/** 能见度折米（单位跟组走；1 SM = 1609.344 m 精确换算） */
const visibilityMeters = (vis: {
  value: number;
  unit: "m" | "sm";
  exact: boolean;
  beyond?: "above" | "below";
}): number => (vis.unit === "m" ? vis.value : vis.value * 1609.344);

/** 降水类现象（着色判据用，与 WMO 4678 降水族对应） */
const PRECIP_PHENOMENA: ReadonlySet<WeatherPhenomenon> = new Set([
  "RA",
  "SN",
  "SG",
  "PL",
  "GS",
  "IC",
  "DZ",
  "UP",
]);

/**
 * 危险值分级（值着色口径，本库自拟，初稿待审）：
 * 只是「一眼扫视哪些组更值得注意」的显示层启发式，阈值由本库拟定——
 * **不对应、也不代表任何官方飞行天气分类；本库不提供也不承诺飞行规则判定**（本期无此功能）：
 * - danger（红系 mw-danger）：天气描述符含 TS（雷暴）或现象含 GR（冰雹）或强度 +（强）；
 *   云层含 CB/TCU（对流云）；能见度 < 1500 m；RVR < 800 m；跑道关闭。
 * - caution（橙系 mw-caution）：降水类现象（RA/SN/SG/PL/GS/IC/DZ/UP）或 FZ 描述符（结冰族）；
 *   能见度 1500–4800 m。
 * 阈值与分级细则随术语表版本审定后修订。
 */
const isDangerWeather = (g: WeatherGroup): boolean =>
  g.descriptor === "TS" || g.phenomena.includes("GR") || g.intensity === "+";

const isCautionWeather = (g: WeatherGroup): boolean =>
  !isDangerWeather(g) &&
  (g.descriptor === "FZ" || g.phenomena.some((p) => PRECIP_PHENOMENA.has(p)));

/**
 * 低云底着色（判据本库自拟、初稿待审——显示层扫视口径，非标准分级、非运行判据）：
 * BKN/OVC 云底 < 1000 ft → mw-danger；1000–3000 ft → mw-caution；
 * VV 组任意 → mw-caution，VV < 400 ft → mw-danger。
 * 对流云（CB/TCU）恒 danger（威胁优先于云底档位）；缺测云高不捏造档位不着色。
 */
const cloudTone = (layer: CloudElement): "mw-danger" | "mw-caution" | undefined => {
  if (layer.kind === "vertical-visibility") {
    const v = layer.heightFt.value;
    return v !== null && v < 400 ? "mw-danger" : "mw-caution";
  }
  if (layer.amount !== "BKN" && layer.amount !== "OVC") return undefined;
  const h = layer.heightFt.value;
  if (h === null) return undefined;
  if (h < 1000) return "mw-danger";
  if (h <= 3000) return "mw-caution";
  return undefined;
};

const visibilityTone = (vis: {
  value: number;
  unit: "m" | "sm";
  exact: boolean;
  beyond?: "above" | "below";
}): "mw-danger" | "mw-caution" | undefined => {
  const meters = visibilityMeters(vis);
  if (meters < 1500) return "mw-danger";
  if (meters < 4800) return "mw-caution";
  return undefined;
};

/** 由 IR 重建天气组原码（span 缺席时的显示回退；亦用于 tooltip 摘要）：VC/强度/描述符/现象依电码序拼回 */
const weatherCodeOf = (g: WeatherGroup): string =>
  `${g.proximity ? "VC" : ""}${g.intensity ?? ""}${g.descriptor ?? ""}${g.phenomena.join("")}`;

/** 由 IR 重建云层原码（span 缺席时的显示回退；缺测位还原为 ///） */
const cloudCodeOf = (layer: CloudElement): string => {
  if (layer.kind === "vertical-visibility") {
    return `VV${layer.heightFt.value === null ? "///" : deg3(layer.heightFt.value / 100)}`;
  }
  const height =
    layer.heightFt.value === null ? "///" : deg3(Math.round(layer.heightFt.value / 100));
  return `${layer.amount ?? "///"}${height}${layer.convective ?? ""}`;
};

/** 天气组短语合成：强度词 + 邻近词 + 描述符与现象的自然语序拼装（+TSRA → 强雷暴伴雨 / Heavy thunderstorm with rain）。
 *  强度词分两路（zh）：TS 族用 强/轻（强雷暴伴雨），其余用 大/小直连现象名词（小雨/大雨/小雪/大雪）。 */
function weatherGloss(g: WeatherGroup, wx: LocaleTable["wx"]): string {
  const parts: string[] = [];
  const isThunderstorm = g.descriptor === "TS";
  if (g.intensity === "+") parts.push(isThunderstorm ? wx.heavy : wx.heavyPlain);
  else if (g.intensity === "-") parts.push(isThunderstorm ? wx.light : wx.lightPlain);
  if (wx.proximityPrefix !== null && g.proximity) parts.push(wx.proximityPrefix);
  const phenom = g.phenomena.map((p) => wx.phenomena[p] ?? p).join(wx.join);
  if (g.descriptor === undefined) {
    if (phenom !== "") parts.push(phenom);
  } else if (g.descriptor === "TS") {
    parts.push(phenom === "" ? wx.thunderstorm : wx.thunderstormWith(phenom));
  } else {
    parts.push(wx.descCompose(wx.descriptors[g.descriptor] ?? g.descriptor, phenom));
  }
  let phrase = parts.join(wx.joinParts);
  if (wx.proximitySuffix !== null && g.proximity) phrase += wx.proximitySuffix;
  return isFlightHazard(g) ? `${phrase}${wx.hazard}` : phrase;
}

/** 跑道状态行文本：跑道号 + 关闭/清除 + 污染物 + 覆盖 + 深度 + 摩擦/制动（WMO §15.13.6 电码表）。 */
function runwayStateText(st: RunwayStateGroup, rwy: LocaleTable["rwy"]): string {
  const parts: string[] = [];
  const id = st.runway === "" ? undefined : `R${st.runway}`;
  if (st.closed === true) {
    parts.push(id === undefined ? rwy.closedAll : `${id} ${rwy.closed}`);
  } else {
    if (id !== undefined) parts.push(id);
    if (st.cleared) parts.push(rwy.cleared);
    if (!st.cleared) {
      if (st.deposit !== null && st.deposit !== undefined) {
        parts.push(rwy.deposit[st.deposit] ?? String(st.deposit));
      }
      const coverage =
        st.coverage === null || st.coverage === undefined ? undefined : rwy.coverage[st.coverage];
      if (coverage !== undefined) parts.push(`${rwy.coverageLabel}${coverage}`);
      if (st.depth !== null && st.depth !== undefined) {
        parts.push(`${rwy.depthLabel}${rwy.depthText(st.depth)}`);
      }
    }
  }
  if (st.frictionCoefficient !== undefined) parts.push(rwy.friction(st.frictionCoefficient));
  if (st.brakingAction !== undefined) {
    parts.push(`${rwy.brakingLabel}${rwy.braking[st.brakingAction] ?? st.brakingAction}`);
  }
  return parts.join(rwy.itemSep);
}

/**
 * 英尺云底折米：1 ft = 0.3048 m 的精确换算，四舍五入到整米——不做档位圆整，避免引入额外偏差。
 * 报文本身只编英尺（百英尺台阶），米值是本库换算出来的，所以显示层一律标「约/≈」：
 * 精确的是换算，不是被测量。
 */
const ftToMeters = (ft: number): number => Math.round(ft * 0.3048);

const visTextOf = (g: VisibilityGroup): string =>
  g.unit === "m"
    ? g.beyond === "below"
      ? "<50 m"
      : g.exact
        ? `${g.value} m`
        : "≥10 km"
    : g.beyond === "below"
      ? `<${g.value} SM`
      : g.beyond === "above"
        ? `>${g.value} SM`
        : `${g.value} SM`;

/** RVR 数值按电码惯例补齐 4 位（R36/M0050D 的 0050；IR 数值化丢前导零由显示层还原） */
const rvrPad = (n: number): string => String(n).padStart(4, "0");

const STYLE_ID = "mw-card-style";

const CARD_CSS = `
.mw-card { font: 13px/1.6 system-ui, sans-serif; color: #1c2733; background: #fff;
  border: 1px solid #d8dee4; border-radius: 10px; padding: 12px 14px; max-width: 420px; }
.mw-card h2 { margin: 0; font-size: 15px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.mw-card .mw-time { color: #6b7785; margin: 2px 0 8px; font-size: 12px; }
.mw-card .mw-time.mw-stale { color: #8a5a12; font-weight: 600; }
.mw-card .mw-station { margin: -4px 0 6px; color: #6b7785; font-size: 12px; }
.mw-badge { display: inline-block; font-size: 11px; padding: 0 6px; border-radius: 999px;
  border: 1px solid #c3cfdb; color: #44546a; background: #f2f6fa; }
.mw-badge .mw-badge-sub { margin-left: 4px; opacity: 0.72; font-weight: 400; }
.mw-badge.mw-warn { border-color: #e0b478; color: #8a5a12; background: #fdf3e2; }
.mw-badge.mw-cavok { border-color: #79b791; color: #1e6b40; background: #eaf6ee; }
.mw-card [data-hint].mw-link { background: #fdeeb9; outline: 1px solid #e0b478; border-radius: 4px; }
.mw-decode { margin-top: 6px; padding-top: 6px; border-top: 1px dashed #5a6b7d; }
.mw-decode-title { display: block; font-weight: 600; margin-bottom: 4px; }
.mw-decode-row { display: flex; gap: 6px; align-items: baseline; }
.mw-decode-code { flex: none; color: #1c2733; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  background: #f2f6fa; padding: 0 4px; border-radius: 4px; }
.mw-decode-arrow { flex: none; color: #93a7bd; }
.mw-decode-basis { margin-top: 6px; padding-top: 5px; border-top: 1px dashed #5a6b7d;
  color: #c3d2e0; font-size: 11px; line-height: 1.55; }
.mw-rows { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 0; }
.mw-rows dt { color: #6b7785; }
.mw-rows dd { margin: 0; }
.mw-rows dd .mw-rwy-closed { color: #a02c2c; font-weight: 600; }
.mw-card .mw-danger { color: #a02c2c; font-weight: 600; }
.mw-card .mw-caution { color: #8a5a12; font-weight: 600; }
.mw-raw { margin: 10px 0 0; padding: 8px; border-radius: 6px; background: #f6f8fa;
  font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: pre-wrap; word-break: break-all; }
/* 已知组虚线（RAW 对照唯一可见通道）：#b6c2ce 对 #f6f8fa 背景 1.70:1（WCAG 1.4.11 AA 失败）
   → #7f8c9a 对 #f6f8fa 背景 3.22:1（对纯白 3.43:1），按 WCAG 2.x 相对亮度公式实测取值 */
.mw-raw span { border-bottom: 1px dashed #7f8c9a; cursor: help; }
.mw-raw span.mw-bad { border-bottom: 1px solid #d05656; color: #a02c2c; }
/* 人话提示第三通道：点击/键盘聚焦切换气泡（title 悬停之外，触屏与键盘可达） */
.mw-card { position: relative; }
.mw-hint { position: relative; }
/* 可点击性统一视觉语言：所有带提示的元素与 RAW 词组同款——虚线下划线 + 问号光标 */
.mw-card .mw-hint { border-bottom: 1px dashed #7f8c9a; cursor: help; }
.mw-hint:focus-visible { outline: 2px solid #4a90d9; outline-offset: 1px; }
.mw-hint-pop { display: none; position: absolute; z-index: 40;
  width: max-content; max-width: 480px;
  padding: 6px 9px; border-radius: 6px; background: #24313f; color: #fff;
  font-size: 12px; line-height: 1.5; text-align: left; white-space: normal;
  box-shadow: 0 2px 10px rgba(20, 32, 45, 0.35); }
.mw-hint-pop.mw-hint-on { display: block; }
.mw-warnings { margin: 8px 0 0; padding: 0; list-style: none; }
.mw-warnings li { font-size: 12px; color: #7a4d0b; }
.mw-warnings li.mw-info { color: #6b7785; }
`;

function ensureStyle(): void {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CARD_CSS;
  document.head.append(style);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const badge = (text: string, kind?: "warn" | "cavok", sub?: string): HTMLElement => {
  const cls = kind === undefined ? "mw-badge" : `mw-badge mw-${kind}`;
  const node = el("span", cls, text);
  if (sub !== undefined) node.append(el("span", "mw-badge-sub", sub));
  return node;
};

/**
 * Render a report card: takes the IR, returns a self-contained mountable DOM element (styles injected, zero dependencies).
 * 渲染报文卡片：输入 IR，输出可直接挂载的 DOM 元素（样式随组件注入，零依赖）。
 * @param report - Parsed IR (MetarReport). 已解析的 IR。
 * @param options - See RenderCardOptions. 见 RenderCardOptions。
 */

export function renderCard(report: MetarReport, options: RenderCardOptions = {}): HTMLElement {
  // 未知选项运行时抛错（2026-09-15 五角色评测批）：拼错的选项键被静默忽略 = 语言/单位/视图
  // 悄悄不符预期，违反本库不静默纪律；中文提示 = v0.1 message 语言契约（英文文案按 code 查 EN_MESSAGES）
  for (const key of Object.keys(options)) {
    if (!RENDER_CARD_OPTION_KEYS.has(key)) {
      throw new Error(
        `renderCard 收到未知选项 "${key}"——拼错的选项不会生效，可用项见 RenderCardOptions`,
      );
    }
  }
  ensureStyle();
  // 选项值校验：非法 locale/heightUnit 值给清晰报错，不以裸 TypeError 崩在内部取表
  if (options.locale !== undefined && LOCALE[options.locale] === undefined) {
    throw new Error(
      `renderCard 的 locale 选项值 "${options.locale}" 不受支持（可用："zh" | "en"）`,
    );
  }
  if (
    options.heightUnit !== undefined &&
    options.heightUnit !== "m" &&
    options.heightUnit !== "ft"
  ) {
    // never 收窄后的宽化中转：模板表达式不接受 never 字面量类型
    const bad: string = options.heightUnit;
    throw new Error(`renderCard 的 heightUnit 选项值 "${bad}" 不受支持（可用："m" | "ft"）`);
  }
  const T = LOCALE[options.locale ?? "zh"];
  // 云底/垂直能见度正面单位：显式 heightUnit > locale 缺省（en 英尺 = 报文原生编码，zh 米 = 民航口径）
  const heightUnit = options.heightUnit ?? (options.locale === "en" ? "ft" : "m");
  const v = toValues(report);
  const rawText = report.raw;
  const now = options.now ?? new Date();
  // —— 转换说明注册表（点击气泡第二层「原码 → 含义」）：键 = 悬停提示字符串（单一来源锁），
  // 主表与 RAW 两侧点击同一组取到同一份转换表；构造器集中定义在提示语单一来源区之后。
  // cite = 该组族转换依据的规范条款键（气泡底部「依据」行：名称/版本/条款号/简要内容）
  type DecodeRow = { code: string; text: string };
  const decodeByHint = new Map<string, { rows: DecodeRow[]; cite?: DecodeCiteKey }>();
  const registerDecode = (hint: string, rows: DecodeRow[], cite?: DecodeCiteKey): void => {
    if (hint !== "" && !decodeByHint.has(hint)) decodeByHint.set(hint, { rows, cite });
  };

  const root = el("div", "mw-card");
  if (options.className !== undefined) root.classList.add(options.className);

  // —— 头部：站名 + 报文类型徽章 + 更正/自动徽章
  const head = el("h2");
  head.append(el("span", undefined, v.station));
  // 类型徽章二选一：SPECI 只挂「特殊报告」（复评命中：曾无条件双挂例行+特殊）
  head.append(badge(v.kind === "speci" ? T.badge.speci : T.badge.metar));
  if (v.flags.corrected) head.append(badge(T.badge.corrected, "warn"));
  if (v.flags.auto) head.append(badge(T.badge.auto));
  if (v.cavok) {
    // 原码「CAVOK」在前保专业扫读，直白短译随行（非专业零悬停可读）；完整定义仍在悬停（≠晴空防歧义）
    const cavokBadge = badge("CAVOK", "cavok", T.badge.cavokShort);
    attachHint(cavokBadge, T.cavokHint);
    registerDecode(T.cavokHint, [{ code: "CAVOK", text: T.cavokHint }], "cavok");
    head.append(cavokBadge);
  }
  root.append(head);
  // —— 站名行（可选）：元数据联表才有的信息，永远来自调用方，IR 无此字段不捏造
  if (options.stationTitle !== undefined && options.stationTitle !== "") {
    root.append(el("p", "mw-station", options.stationTitle));
  }

  // —— 时间行：电码时刻 + 数据龄期（「43 分钟前」比时刻本身更直接支撑判读；超 60 分钟标橙）
  const timeEl = el("div", "mw-time", T.timeText(v.time));
  const observedAt = observeTimeOf(v.time, now);
  if (observedAt !== null) {
    const ageMinutes = Math.round((now.getTime() - observedAt.getTime()) / 60_000);
    if (ageMinutes >= 0) {
      timeEl.append(` ${T.ago(ageMinutes)}`);
      if (ageMinutes > 60) timeEl.classList.add("mw-stale");
    }
  }
  root.append(timeEl);

  // —— 要素行（value 为节点片段时按片段挂载；title/aria-label 提供人话悬停——文案集中在 locale 表，初稿待审）
  const rows = el("dl", "mw-rows");
  const row = (label: string, value: string | Node, title?: string, tone?: string): void => {
    const dd = el("dd");
    if (typeof value === "string") {
      const text = el("span", undefined, value);
      dd.append(text);
      // 提示双挂载：内联 span 承载 affordance（下划线贴文字 + 点击气泡），
      // dd 保留原生 title（悬停面更大，行级语义兼容）
      if (title !== undefined && title !== "") {
        attachHint(text, title);
        dd.title = title;
        dd.setAttribute("aria-label", title); // C1 三重可达契约：title 必同挂 aria-label
      }
    } else {
      dd.append(value);
    }
    if (tone !== undefined) dd.classList.add(tone);
    rows.append(el("dt", undefined, label), dd);
  };
  const rawSlice = (span: Span | undefined): string =>
    span === undefined ? "" : rawText.slice(span.start, span.end);

  // —— 逐要素解码（行显示文本与 RAW 词组气泡同源同口径；非专业逐 token 点读，专业一眼主值）
  const windBasicOf = (w: WindGroup): string => {
    const calm = !w.variable && w.direction === 0 && w.speed.value === 0;
    const gust = w.gust === undefined ? "" : T.wind.gustOf(w.gust.value);
    return calm
      ? `${T.wind.calm}${gust}`
      : `${w.variable ? T.wind.variable : w.direction === null ? T.wind.missing : `${w.direction}°`} ${w.speed.beyond === "above" ? ">" : ""}${w.speed.value} ${w.speed.unit}${gust}`;
  };
  const windBasicHintOf = (w: WindGroup): string => {
    const calm = !w.variable && w.direction === 0 && w.speed.value === 0;
    return `${T.wind.unit[w.speed.unit] ?? ""}${w.variable ? `${T.wind.hintSep}${T.wind.vrbNote}` : ""}${calm ? `${T.wind.hintSep}${T.wind.calmNote}` : ""}`;
  };

  const rvrTextOf = (r: RunwayVisualRange): string => {
    const prefixOf = (n: number): string =>
      `${r.beyondRange === "above" ? "P" : r.beyondRange === "below" ? "M" : ""}${rvrPad(n)}`;
    const value =
      r.value !== undefined
        ? prefixOf(r.value)
        : r.beyondRange === "above"
          ? `${rvrPad(r.min ?? 0)}V${prefixOf(r.max ?? 0)}`
          : r.beyondRange === "below"
            ? `${prefixOf(r.min ?? 0)}V${rvrPad(r.max ?? 0)}`
            : `${rvrPad(r.min ?? 0)}V${rvrPad(r.max ?? 0)}`;
    const trendSuffix =
      r.trend === "up" ? "/U" : r.trend === "down" ? "/D" : r.trend === "no-change" ? "/N" : "";
    return `R${r.runway}/${value}${r.unit === "ft" ? "FT" : ""}${trendSuffix}`;
  };
  // —— 主表纯译文构造器（2026-09-15 口径：主表给人读，原码只在 RAW 视图与悬停提示）——
  const rvrHumanOf = (r: RunwayVisualRange): string => {
    const unit = T.rvr.unit[r.unit === "ft" ? "ft" : "m"];
    const lead =
      r.beyondRange === "above" ? T.rvr.above : r.beyondRange === "below" ? T.rvr.below : "";
    const value =
      r.value !== undefined
        ? `${lead}${r.value} ${unit}`
        : `${lead}${T.rvr.varying(r.min ?? 0, r.max ?? 0, unit)}`;
    const trend =
      r.trend === "up"
        ? T.rvr.trendUp
        : r.trend === "down"
          ? T.rvr.trendDown
          : r.trend === "no-change"
            ? T.rvr.trendNoChange
            : "";
    return `${T.rvr.runway(r.runway)}${T.colon}${value}${trend}`;
  };
  // 云底/垂直能见度正面高度短语（单位随 heightUnit；英尺 = 原码直读不加「约」，米 = 换算约值）
  const cloudFaceBase = (feet: number): string =>
    heightUnit === "ft" ? T.cloud.baseShortFeet(feet) : T.cloud.baseShortMeters(ftToMeters(feet));
  const cloudFaceHeight = (feet: number): string =>
    heightUnit === "ft" ? T.cloud.feetShort(feet) : T.cloud.metersShort(ftToMeters(feet));
  const cloudHumanOf = (layer: CloudElement): string => {
    if (layer.kind === "vertical-visibility") {
      return layer.heightFt.value === null
        ? T.cloud.vvMissing
        : `${T.cloud.vvShort}${cloudFaceHeight(layer.heightFt.value)}`;
    }
    const amountPart =
      layer.amount === null ? T.cloud.amountUnknown : (T.cloud.shortAmount[layer.amount] ?? "");
    const heightPart = layer.heightFt.value === null ? "" : cloudFaceBase(layer.heightFt.value);
    const convectiveNote =
      layer.convective === "CB"
        ? T.cloud.cbNote
        : layer.convective === "TCU"
          ? T.cloud.tcuNote
          : "";
    return `${amountPart}${heightPart}${convectiveNote}`;
  };
  const cloudHintOf = (layer: CloudElement, code: string): string => {
    const metersNote = layer.heightFt.value === null ? "" : T.cloud.metersDerivedNote;
    if (layer.kind === "vertical-visibility") {
      return `${code}${T.colon}${T.cloud.vv}${metersNote}`;
    }
    if (layer.amount === null) return code; // 云量缺测无从解码，仅回 code
    const heightMeters = layer.heightFt.value === null ? null : ftToMeters(layer.heightFt.value);
    const convectiveNote =
      layer.convective === "CB"
        ? T.cloud.cbNote
        : layer.convective === "TCU"
          ? T.cloud.tcuNote
          : "";
    return `${code}${T.colon}${T.cloud.amount[layer.amount] ?? ""}${
      layer.heightFt.value !== null && heightMeters !== null
        ? T.cloud.baseFtMeters(layer.heightFt.value, heightMeters)
        : ""
    }${convectiveNote}${metersNote}`;
  };

  // —— 提示语单一来源（主表行与 RAW 对照两处挂同一字符串，杜绝两边各拼一套的漂移）：
  // 每组族的悬停文案只在此拼装一次，行渲染与 RAW 标注分别取用；新增组族先入此表
  const windHintOf = (w: WindGroup): string =>
    `${T.label.wind}${T.colon}${windBasicOf(w)}${T.wind.hintSep}${windBasicHintOf(w)}`;
  const windVarHintOf = (wv: NonNullable<WindGroup["variation"]>): string =>
    `${T.wind.variationOf(wv.min, wv.max)}${T.colon}${T.wind.variationNote}`;
  const visHintOf = (g: VisibilityGroup): string =>
    `${T.label.visibility}${T.colon}${visTextOf(g)}`;
  const visMinimumHintOf = (mn: NonNullable<VisibilityGroup["minimum"]>): string =>
    `${T.label.visibility}${T.colon}${T.cloud.minimumOf(mn.value, mn.direction)}`;
  const skyClearHintOf = (code: SkyClearCode): string =>
    `${code}${T.colon}${T.cloud.skyClear[code] ?? code}`;
  // RVR 悬停解码（按该跑道在场要素拼装，无该要素不出现该句）；纯值无注时回退行标签义
  const rvrHintOf = (r: RunwayVisualRange): string => {
    const notes: string[] = [];
    if (r.max !== undefined) notes.push(T.rvrNote.varying);
    if (r.trend !== undefined) notes.push(T.rvrNote.trend);
    if (r.beyondRange !== undefined) notes.push(T.rvrNote.beyond);
    return notes.length > 0
      ? `${rvrTextOf(r)}${T.colon}${notes.join(T.wind.hintSep)}`
      : `${T.label.rvr}${T.colon}${rvrTextOf(r)}`;
  };
  const wxHintOf = (g: WeatherGroup, code: string): string =>
    `${code}${T.colon}${weatherGloss(g, T.wx)}`;
  const rwyHintOf = (st: RunwayStateGroup, code: string): string => {
    const notes =
      st.closed === true
        ? [T.rwy.closedNote, T.rwy.wmoNote]
        : st.cleared
          ? [T.rwy.clearedNote, T.rwy.wmoNote]
          : [T.rwy.wmoNote];
    return `${code}${T.colon}${runwayStateText(st, T.rwy)}${T.dash}${notes.join(T.dash)}`;
  };
  const wsHintOf = (code: string): string => `${code}${T.colon}${T.windShearNote}`;
  // 温露同 token（dd/dd 一组）点哪边都是完整解读——两行共用同一合并提示
  const tempDewParts: string[] = [];
  if (v.temperature !== undefined)
    tempDewParts.push(`${T.label.temperature}${T.colon}${v.temperature.celsius}°C`);
  if (v.dewpoint !== undefined)
    tempDewParts.push(`${T.label.dewpoint}${T.colon}${v.dewpoint.celsius}°C`);
  const tempDewHint = tempDewParts.join(T.wind.hintSep);
  const qnhHint =
    v.altimeter === undefined
      ? ""
      : `${T.label.altimeter}${T.colon}${v.altimeter.value} ${
          v.altimeter.unit === "hPa" ? "hPa" : "inHg"
        }`;
  // 趋势段内容短语（组内要素逐族人话，复用正文同款拼装）
  const trendContentGloss = (elements: TrendElements | undefined): string[] => {
    if (elements === undefined) return [];
    const parts: string[] = [];
    if (elements.cavok !== undefined) parts.push(T.cavokHint);
    if (elements.wind !== undefined) parts.push(`${T.label.wind} ${windBasicOf(elements.wind)}`);
    if (elements.visibility !== undefined)
      parts.push(`${T.label.visibility} ${visTextOf(elements.visibility)}`);
    for (const g of elements.weather) parts.push(weatherGloss(g, T.wx));
    if (elements.nsw !== undefined) parts.push(T.trendNote.nsw);
    const trClouds = elements.clouds;
    if (trClouds !== undefined) {
      if (trClouds.clear !== undefined) parts.push(skyClearHintOf(trClouds.clear.code));
      for (const layer of trClouds.elements) {
        if (layer.kind === "vertical-visibility") {
          parts.push(
            layer.heightFt.value === null
              ? T.cloud.vvMissing
              : `${T.cloud.vvShort}${cloudFaceHeight(layer.heightFt.value)}`,
          );
        } else if (layer.amount !== null || layer.convective !== undefined) {
          // 对流云风险注不受云量缺测拦截（与云行行内短译同口径：威胁零点击可见）
          const amountPart = layer.amount === null ? "" : (T.cloud.shortAmount[layer.amount] ?? "");
          const convectiveNote =
            layer.convective === "CB"
              ? T.cloud.cbNote
              : layer.convective === "TCU"
                ? T.cloud.tcuNote
                : "";
          parts.push(
            `${amountPart}${
              layer.heightFt.value === null ? "" : cloudFaceBase(layer.heightFt.value)
            }${convectiveNote}`,
          );
        }
      }
    }
    return parts;
  };
  const trendKindNote = (tr: TrendGroup): string =>
    tr.kind === "nosig"
      ? T.trendNote.nosig
      : tr.kind === "becmg"
        ? T.trendNote.becmg
        : tr.kind === "tempo"
          ? T.trendNote.tempo
          : T.trendNote.unspecified;
  const trendHintOf = (tr: TrendGroup): string => {
    const notes = [trendKindNote(tr)];
    if (tr.period !== undefined) notes.push(T.trendNote.periodAt(tr.period.text));
    const content = trendContentGloss(tr.elements);
    if (content.length > 0) notes.push(`${T.trendNote.contentLead}${content.join(T.sep)}`);
    if (/WS\s+(?:ALL\s+RWY|R\d{2}[LCR]?|RWY\d{2}[LCR]?|RWY\s+ALL)/.test(tr.raw))
      notes.push(T.trendNote.windShear);
    return `${tr.raw}${T.colon}${notes.join(T.wind.hintSep)}`;
  };
  // 趋势行纯译文：kind 语义 + 时段 + 组内要素人话（原码原文只在悬停与 RAW）
  const trendHumanOf = (tr: TrendGroup): string => {
    const parts: string[] = [trendKindNote(tr)];
    if (tr.period !== undefined) parts.push(T.trendNote.periodAt(tr.period.text));
    const content = trendContentGloss(tr.elements);
    if (content.length > 0) parts.push(`${T.trendNote.contentLead}${content.join(T.sep)}`);
    return parts.join(T.wind.hintSep);
  };

  // —— 转换说明（点击气泡第二层）：逐 token 「原码 → 含义」，展示结论如何从原文转换而来。
  // 注册键 = 悬停提示字符串（单一来源锁）：主表与 RAW 两侧点击同一组，取到同一份转换表。
  // 注册表本体声明在 renderCard 顶部（CAVOK 徽章在头部更早注册）；构造器在本区集中定义
  const windDecodeRows = (w: WindGroup, raw: string): DecodeRow[] => {
    const m = /^(VRB|\d{3})(\d{2,3})(G\d{2,3})?(KT|MPS|KMH)?$/.exec(raw);
    const dir = m?.[1];
    const speedTok = m?.[2];
    if (dir === undefined || speedTok === undefined) return [{ code: raw, text: windBasicOf(w) }];
    const list: DecodeRow[] = [];
    if (dir === "VRB") list.push({ code: "VRB", text: T.wind.vrbNote });
    else
      list.push({
        code: dir,
        text: `风向 ${w.direction === null ? T.wind.missing : `${w.direction}°`}`,
      });
    list.push({ code: speedTok, text: `风速 ${w.speed.value} ${w.speed.unit}` });
    const gustTok = m?.[3];
    if (gustTok !== undefined && w.gust !== undefined)
      list.push({ code: gustTok, text: `${T.wind.gust} ${w.gust.value} ${w.speed.unit}` });
    const unitTok = m?.[4];
    const unitKey = (["kt", "mps", "kmh"] as const).find((u) => u === unitTok);
    if (unitKey !== undefined && unitTok !== undefined)
      list.push({ code: unitTok, text: T.wind.unit[unitKey] });
    return list;
  };
  const windVarDecodeRows = (wv: NonNullable<WindGroup["variation"]>): DecodeRow[] => [
    { code: rawSlice(wv.span), text: T.wind.variationOf(wv.min, wv.max) },
    { code: "V", text: T.wind.variationNote },
  ];
  const visDecodeRows = (g: VisibilityGroup): DecodeRow[] => [
    { code: rawSlice(g.span), text: visTextOf(g) },
  ];
  const visMinDecodeRows = (mn: NonNullable<VisibilityGroup["minimum"]>): DecodeRow[] => [
    { code: rawSlice(mn.span), text: T.cloud.minimumOf(mn.value, mn.direction) },
  ];
  const rvrDecodeRows = (r: RunwayVisualRange): DecodeRow[] => {
    const list: DecodeRow[] = [{ code: rawSlice(r.span), text: rvrHumanOf(r) }];
    if (r.max !== undefined) list.push({ code: "V", text: T.rvrNote.varying });
    if (r.trend !== undefined)
      list.push({
        code: r.trend === "up" ? "U" : r.trend === "down" ? "D" : "N",
        text: T.rvrNote.trend,
      });
    if (r.beyondRange !== undefined)
      list.push({ code: r.beyondRange === "above" ? "P" : "M", text: T.rvrNote.beyond });
    if (r.unit === "ft") list.push({ code: "FT", text: T.rvr.unit.ft });
    return list;
  };
  const wxDecodeRows = (g: WeatherGroup, code: string): DecodeRow[] => {
    const list: DecodeRow[] = [];
    // 强度词与主表短译同源：TS 族用 强/轻，其余族用 小/大（否则 -RA 解码出「轻雨」与主表「小雨」打架）
    const lightWord = g.descriptor === "TS" ? T.wx.light : T.wx.lightPlain;
    const heavyWord = g.descriptor === "TS" ? T.wx.heavy : T.wx.heavyPlain;
    if (g.intensity === "+") list.push({ code: "+", text: heavyWord });
    if (g.intensity === "-") list.push({ code: "-", text: lightWord });
    if (g.proximity)
      list.push({ code: "VC", text: T.wx.proximitySuffix ?? T.wx.proximityPrefix ?? "" });
    if (g.descriptor !== undefined)
      list.push({ code: g.descriptor, text: T.wx.descriptors[g.descriptor] ?? "" });
    for (const p of g.phenomena) list.push({ code: p, text: T.wx.phenomena[p] ?? "" });
    if (list.length === 0) list.push({ code, text: weatherGloss(g, T.wx) });
    return list;
  };
  const cloudDecodeRows = (layer: CloudElement, code: string): DecodeRow[] => {
    const list: DecodeRow[] = [{ code, text: cloudHumanOf(layer) }];
    if (layer.kind === "vertical-visibility") return list;
    if (layer.amount !== null)
      list.push({ code: layer.amount, text: T.cloud.amount[layer.amount] ?? "" });
    else list.push({ code: "///", text: T.cloud.amountUnknown });
    if (layer.heightFt.value !== null)
      list.push({
        code: String(layer.heightFt.value).padStart(3, "0"),
        text: T.cloud
          .baseFtMeters(layer.heightFt.value, ftToMeters(layer.heightFt.value))
          .replace(/^[，,]\s*/, ""),
      });
    else list.push({ code: "///", text: T.cloud.heightUnknown });
    if (layer.convective !== undefined)
      list.push({
        code: layer.convective,
        text: layer.convective === "CB" ? T.cloud.cbNote : T.cloud.tcuNote,
      });
    return list;
  };
  const skyClearDecodeRows = (code: SkyClearCode): DecodeRow[] => [
    { code, text: T.cloud.skyClear[code] ?? code },
  ];
  const tempDewDecodeRows = (): DecodeRow[] => {
    const list: DecodeRow[] = [];
    if (report.temperature !== undefined)
      list.push({
        code: rawSlice(report.temperature.span),
        text: `${T.label.temperature} ${report.temperature.celsius}°C`,
      });
    if (report.dewpoint !== undefined)
      list.push({
        code: rawSlice(report.dewpoint.span),
        text: `${T.label.dewpoint} ${report.dewpoint.celsius}°C`,
      });
    return list;
  };
  const qnhDecodeRows = (value: number, unit: string): DecodeRow[] => {
    const g = report.altimeter;
    return [
      {
        code: g === undefined ? "" : rawSlice(g.span),
        text: `${T.label.altimeter} ${value} ${unit}`,
      },
    ];
  };
  const rwyDecodeRows = (st: RunwayStateGroup, code: string): DecodeRow[] => {
    const list: DecodeRow[] = [{ code, text: runwayStateText(st, T.rwy) }];
    if (st.closed === true) list.push({ code: "SNOCLO", text: T.rwy.closedNote });
    if (st.cleared) list.push({ code: "CLRD", text: T.rwy.clearedNote });
    return list;
  };
  const wsDecodeRows = (wsCode: string, ws: WindShearGroup): DecodeRow[] => [
    { code: wsCode, text: ws.allRunways ? T.ws.all : T.ws.runways(ws.runways.join(" ")) },
    { code: "WS", text: T.windShearNote },
  ];
  const trendDecodeRows = (tr: TrendGroup): DecodeRow[] => {
    const list: DecodeRow[] = [{ code: tr.raw, text: trendHumanOf(tr) }];
    const lead = tr.raw.split(/\s+/)[0] ?? "";
    // 指示组行仅在与整段原文不同词时补出（NOSIG 单 token：raw 与 lead 同词，不重复出两行）
    if (lead !== "" && lead !== tr.raw) list.push({ code: lead, text: trendKindNote(tr) });
    if (tr.period !== undefined)
      list.push({ code: tr.period.text, text: T.trendNote.periodAt(tr.period.text) });
    return list;
  };

  // 行序 = 电码判读序：风 → 能见度 → RVR → 天气 → 云 → 温 → 露 → QNH → 跑道状态 → 趋势
  const wind = v.wind;
  if (wind !== undefined) {
    // 风向缺测（越界判 null）时风行照常渲染：缺测子项显示缺测文案，风速不连坐；
    // 静风（00000KT：非全向、000°、0 风速）显示「静风」而非「0° 0 kt」
    // 风组拆分两点击单元：基本要素（风向+风速+阵风，恒在）与变化组（可选要素）——
    // 语义各自独立，点读更专注；下划线也随之收短
    const windFrag = document.createDocumentFragment();
    const basic = el("span", undefined, windBasicOf(wind));
    attachHint(basic, windHintOf(wind));
    registerDecode(windHintOf(wind), windDecodeRows(wind, rawSlice(report.wind?.span)), "wind");
    windFrag.append(basic);
    if (wind.variation !== undefined) {
      windFrag.append(document.createTextNode(" "));
      const vSpan = el(
        "span",
        undefined,
        T.wind.variationOf(wind.variation.min, wind.variation.max),
      );
      attachHint(vSpan, windVarHintOf(wind.variation));
      registerDecode(
        windVarHintOf(wind.variation),
        windVarDecodeRows(wind.variation),
        "windVariation",
      );
      windFrag.append(vSpan);
    }
    row(T.label.wind, windFrag);
  } else if (report.wind?.kind === "missing") {
    // 整组缺测（显式电码 /////KT）渲染占位行——「此处本应有风」的位置感（与组省略不渲染的口径区分）
    row(T.label.wind, T.missingGroup.wind);
  }
  const vis = v.visibility;
  if (vis !== undefined) {
    // 阈值方向由 IR beyond 驱动：M 前缀 < 下界、P 前缀 > 上界；9999 = 10km 或以上（上限编码折 ≥10 km）
    // 米制 beyond 三分（WMO 15.6.3 / AP-117 69 条）：below = 下限编码（0000 → <50 m，此前
    // 误渲染「≥10 km」的反向错误即此处无 below 落点）；above = 上限编码（9999 → ≥10 km）
    // 两个点击单元：主导能见度与最低能见度方向组各自可点（与 RAW 标注一一对应）
    const visFrag = document.createDocumentFragment();
    const visSpan = el("span", undefined, visTextOf(vis));
    attachHint(visSpan, visHintOf(vis));
    registerDecode(visHintOf(vis), visDecodeRows(vis), "visibility");
    visFrag.append(visSpan);
    if (vis.minimum !== undefined) {
      visFrag.append(document.createTextNode(" "));
      const mnSpan = el(
        "span",
        undefined,
        T.cloud.minimumOf(vis.minimum.value, vis.minimum.direction),
      );
      attachHint(mnSpan, visMinimumHintOf(vis.minimum));
      registerDecode(visMinimumHintOf(vis.minimum), visMinDecodeRows(vis.minimum), "visMinimum");
      visFrag.append(mnSpan);
    }
    row(T.label.visibility, visFrag, undefined, visibilityTone(vis));
  } else if (report.visibility?.kind === "missing") {
    row(T.label.visibility, T.missingGroup.visibility);
  }
  const rvr = v.runwayVisualRange;
  if (rvr !== undefined && rvr.length > 0) {
    // 行保真：P/M 超界前缀与 U/D/N 趋势后缀原样保留（超界端数值存原码，前缀由 beyondRange 还原）
    // 逐跑道点击单元：提示语按该跑道在场要素拼装（与 RAW 逐组标注一一对应）
    // 低 RVR 危险着色（< 800 m，英尺组按 0.3048 折米比较；初稿待审见 visibilityTone 注）
    const rvrMeters = Math.min(
      ...rvr.map((r) => {
        const feet = r.unit === "ft";
        const values = [r.value ?? r.min ?? Number.POSITIVE_INFINITY];
        if (r.max !== undefined) values.push(r.max);
        return Math.min(...values) * (feet ? 0.3048 : 1);
      }),
    );
    const rvrFrag = document.createDocumentFragment();
    let rvrFirst = true;
    for (const r of rvr) {
      if (!rvrFirst) rvrFrag.append(document.createTextNode(T.sep));
      rvrFirst = false;
      const piece = el("span", undefined, rvrHumanOf(r));
      attachHint(piece, rvrHintOf(r));
      registerDecode(rvrHintOf(r), rvrDecodeRows(r), "rvr");
      rvrFrag.append(piece);
    }
    row(T.label.rvr, rvrFrag, undefined, rvrMeters < 800 ? "mw-danger" : undefined);
  } else if (report.runwayVisualRange?.kind === "missing") {
    row(T.label.rvr, T.missingGroup.rvr);
  }
  const weather = v.weather;
  if (weather !== undefined && weather.length > 0) {
    // 纯译文主表：值 = 人话短译（危险组着色保留）；原码只在悬停提示（wxHintOf 以原码开头）与 RAW 视图
    const frag = document.createDocumentFragment();
    let wxFirst = true;
    for (const g of weather) {
      if (!wxFirst) frag.append(document.createTextNode(T.sep));
      wxFirst = false;
      const code = rawSlice(g.span) || weatherCodeOf(g);
      const piece = el(
        "span",
        isDangerWeather(g) ? "mw-danger" : isCautionWeather(g) ? "mw-caution" : undefined,
        weatherGloss(g, T.wx) || code,
      );
      attachHint(piece, wxHintOf(g, code));
      registerDecode(wxHintOf(g, code), wxDecodeRows(g, code), "weather");
      frag.append(piece);
    }
    row(T.label.weather, frag);
  } else if (report.weather?.kind === "missing") {
    row(T.label.weather, T.missingGroup.weather);
  }
  const clouds = v.clouds;
  if (clouds !== undefined) {
    // 纯译文主表：每层直接给人话（云量 + 云底折米 + 对流云风险注）；
    // 原码（FEW026 等）只在悬停提示与 RAW 对照；对流云（CB/TCU）值着红
    const frag = document.createDocumentFragment();
    let first = true;
    if (clouds.clear !== undefined) {
      // 无云状态给结论词（SKC/NSC/NCD/CLR 语义有别）；原码在悬停与 RAW
      const piece = el("span", undefined, T.cloud.skyClear[clouds.clear.code] ?? clouds.clear.code);
      attachHint(piece, skyClearHintOf(clouds.clear.code));
      registerDecode(
        skyClearHintOf(clouds.clear.code),
        skyClearDecodeRows(clouds.clear.code),
        "skyClear",
      );
      frag.append(piece);
      first = false;
    }
    for (const layer of clouds.elements) {
      if (!first) frag.append(document.createTextNode(T.sep));
      first = false;
      const code = rawSlice(layer.span) || cloudCodeOf(layer);
      const convective = layer.kind === "layer" && layer.convective !== undefined;
      const piece = el("span", convective ? "mw-danger" : cloudTone(layer), cloudHumanOf(layer));
      attachHint(piece, cloudHintOf(layer, code));
      registerDecode(cloudHintOf(layer, code), cloudDecodeRows(layer, code), "clouds");
      frag.append(piece);
    }
    row(T.label.clouds, frag);
  }
  // 温/露：dd/dd 同 token 的两半，点哪边都给完整解读（与 RAW 单标注同提示语）
  registerDecode(tempDewHint, tempDewDecodeRows(), "tempDew");
  if (v.temperature !== undefined)
    row(T.label.temperature, `${v.temperature.celsius}°C`, tempDewHint);
  if (v.dewpoint !== undefined) row(T.label.dewpoint, `${v.dewpoint.celsius}°C`, tempDewHint);
  if (v.altimeter !== undefined) {
    registerDecode(
      qnhHint,
      qnhDecodeRows(v.altimeter.value, v.altimeter.unit === "hPa" ? "hPa" : "inHg"),
      "qnh",
    );
    row(
      T.label.altimeter,
      v.altimeter.unit === "hPa" ? `${v.altimeter.value} hPa` : `${v.altimeter.value} inHg`,
      qnhHint,
    );
  }
  // —— 跑道状态行（签派要点：解析了不让 UI 蒸发；closed 醒目、CLRD 标注、悬停带 WMO 语义初稿）
  if (v.runwayStates.length > 0) {
    const frag = document.createDocumentFragment();
    let rwFirst = true;
    for (const st of v.runwayStates) {
      if (!rwFirst) frag.append(document.createTextNode(T.sep));
      rwFirst = false;
      const piece = el(
        "span",
        st.closed === true ? "mw-rwy-closed mw-danger" : undefined,
        runwayStateText(st, T.rwy),
      );
      const code = rawSlice(st.span) || runwayStateText(st, T.rwy);
      attachHint(piece, rwyHintOf(st, code));
      registerDecode(rwyHintOf(st, code), rwyDecodeRows(st, code), "runwayState");
      frag.append(piece);
    }
    row(T.label.runwayState, frag);
  }
  // —— 风切变行（WMO 306 FM15 §15.13.3，危险级着色——起降阶段重大危害；行序在跑道状态之后趋势之前）
  if (v.windShear !== undefined) {
    const ws = v.windShear;
    const wsCode =
      rawSlice(ws.span) || (ws.allRunways ? "WS ALL RWY" : `WS RWY ${ws.runways.join(" ")}`);
    // 纯译文主表：值给人话（全部跑道 / 跑道 07 09）；WS 电码保留在悬停与 RAW
    const wsValue = ws.allRunways ? T.ws.all : T.ws.runways(ws.runways.join(" "));
    registerDecode(wsHintOf(wsCode), wsDecodeRows(wsCode, ws), "windShear");
    row(T.label.windShear, wsValue, wsHintOf(wsCode), "mw-danger");
  }
  if (v.trends.length > 0) {
    // 趋势行纯译文：kind 语义 + 时段 + 组内要素人话；原文（NOSIG/BECMG…）在悬停与 RAW 对照
    const frag = document.createDocumentFragment();
    let trFirst = true;
    for (const tr of v.trends) {
      if (!trFirst) frag.append(document.createTextNode(T.sep));
      trFirst = false;
      const piece = el("span", undefined, trendHumanOf(tr));
      attachHint(piece, trendHintOf(tr));
      registerDecode(trendHintOf(tr), trendDecodeRows(tr), "trend");
      frag.append(piece);
    }
    row(T.label.trend, frag);
  }
  root.append(rows);

  // —— 告警（warnings 的 UI 面）：zh 直出 message；en 走 WarningCode 映射
  //（未映射的新 code 回退 `code: 原文切片`——信息不丢，三条不同缺测不再同一句泛化英文）
  if (report.warnings.length > 0) {
    const list = el("ul", "mw-warnings");
    for (const w of report.warnings) {
      const li = el("li", w.severity === "info" ? "mw-info" : undefined);
      li.textContent = `${w.severity === "info" ? "ℹ" : "⚠"} ${T.warningText(w.code, w.message, rawSlice(w.span))}`;
      list.append(li);
    }
    root.append(list);
  }

  // —— RAW 对照视图：按 span 切原文，已知组与告警高亮（span 缺席的组优雅降级：不高亮不炸）
  if (options.raw === true) {
    const rawBox = el("div", "mw-raw");
    const marks: Array<{
      start: number;
      end: number;
      title: string;
      bad?: boolean;
      tone?: "mw-danger" | "mw-caution";
    }> = [];
    const collect = (
      span: Span | undefined,
      title: string,
      bad = false,
      tone?: "mw-danger" | "mw-caution",
    ): void => {
      if (span !== undefined && span.end > span.start) marks.push({ ...span, title, bad, tone });
    };
    // RAW 对照是语义场景：组级 span 从 IR 取（视图层不含组级 span；缺测组由同 span 的告警高亮）。
    // 提示语一律取自上方单一来源构建函数——与主表行同一字符串，两边永不漂移
    if (report.wind?.kind === "value") {
      collect(report.wind.span, windHintOf(report.wind.value));
      const wv = report.wind.value.variation;
      if (wv !== undefined) {
        collect(wv.span, windVarHintOf(wv));
      }
    }
    if (report.visibility?.kind === "value") {
      collect(
        report.visibility.span,
        visHintOf(report.visibility.value),
        false,
        visibilityTone(report.visibility.value),
      );
      if (report.visibility.value.minimum !== undefined) {
        const mn = report.visibility.value.minimum;
        collect(mn.span, visMinimumHintOf(mn));
      }
    }
    if (report.runwayVisualRange?.kind === "value") {
      // 行级危险口径与主表一致（最低端 < 800 m，英尺折米）
      const rvrMetersRaw = Math.min(
        ...report.runwayVisualRange.value.map((r) => {
          const values = [r.value ?? r.min ?? Number.POSITIVE_INFINITY];
          if (r.max !== undefined) values.push(r.max);
          return Math.min(...values) * (r.unit === "ft" ? 0.3048 : 1);
        }),
      );
      const rvrTone = rvrMetersRaw < 800 ? "mw-danger" : undefined;
      for (const r of report.runwayVisualRange.value) collect(r.span, rvrHintOf(r), false, rvrTone);
    }
    if (report.weather?.kind === "value") {
      for (const g of report.weather.value)
        collect(
          g.span,
          wxHintOf(g, rawSlice(g.span) || weatherCodeOf(g)),
          false,
          isDangerWeather(g) ? "mw-danger" : isCautionWeather(g) ? "mw-caution" : undefined,
        );
    }
    if (report.clouds !== undefined) {
      for (const e of report.clouds.elements)
        collect(
          e.span,
          cloudHintOf(e, rawSlice(e.span) || cloudCodeOf(e)),
          false,
          e.kind === "layer" && e.convective !== undefined ? "mw-danger" : cloudTone(e),
        );
      if (report.clouds.clear !== undefined)
        collect(report.clouds.clear.span, skyClearHintOf(report.clouds.clear.code));
    }
    for (const st of report.runwayStates)
      collect(
        st.span,
        rwyHintOf(st, rawSlice(st.span) || runwayStateText(st, T.rwy)),
        false,
        st.closed === true ? "mw-danger" : undefined,
      );
    if (report.windShear !== undefined)
      collect(
        report.windShear.span,
        wsHintOf(
          rawSlice(report.windShear.span) ||
            (report.windShear.allRunways
              ? "WS ALL RWY"
              : `WS RWY ${report.windShear.runways.join(" ")}`),
        ),
        false,
        "mw-danger",
      );
    // 温/露/QNH 补标注（此前 RAW 无高亮——非专业逐 token 点读覆盖面补全）。
    // 温露同 token（dd/dd 一组）：两 span 完全重合，拆两条会相互覆盖只剩先到者——
    // 合并单条标注，点哪边都是完整解读（主表温/露两行同提示语）
    if (report.temperature !== undefined || report.dewpoint !== undefined)
      collect(report.temperature?.span ?? report.dewpoint?.span, tempDewHint);
    if (report.altimeter !== undefined) collect(report.altimeter.span, qnhHint);
    for (const w of report.warnings)
      collect(w.span, T.warningText(w.code, w.message, rawSlice(w.span)), true);
    // 趋势段与 CAVOK 词位：主表可点（趋势行/徽章），RAW 同样高亮同提示语——覆盖率对齐
    for (const tr of report.trends) collect(tr.span, trendHintOf(tr));
    if (report.cavok) collect(report.cavokSpan, T.cavokHint);
    // 同 start 时告警/缺测（bad）优先：组级 span 让位于告警区间，缺测组才能高亮并悬停解释
    marks.sort((a, b) => a.start - b.start || Number(b.bad === true) - Number(a.bad === true));
    let cursor = 0;
    for (const mark of marks) {
      if (mark.start < cursor) continue; // 重叠区间跳过（告警与组重叠时以先到者为准）
      if (mark.start > cursor)
        rawBox.append(document.createTextNode(rawText.slice(cursor, mark.start)));
      const piece = el(
        "span",
        mark.bad ? "mw-bad" : mark.tone,
        rawText.slice(mark.start, mark.end),
      );
      attachHint(piece, mark.title);
      rawBox.append(piece);
      cursor = mark.end;
    }
    if (cursor < rawText.length) rawBox.append(document.createTextNode(rawText.slice(cursor)));
    root.append(rawBox);
  }

  // 人话提示的点击/键盘通道：title 悬停之外，触屏点击与键盘聚焦同样可读——
  // 单一气泡按提示词定位，监听委托在卡片根上（Leaflet popup 搬移 DOM 时随行生效）。
  // 切换语义：点已开的收起，点别的换文案，点空白处全收；Esc 收起
  const bubble = el("span", "mw-hint-pop");
  bubble.setAttribute("role", "tooltip");
  root.addEventListener("click", (ev) => {
    const target = ev.target instanceof HTMLElement ? ev.target : null;
    const hint = target?.closest<HTMLElement>(".mw-hint") ?? null;
    const wasOn = hint?.classList.contains("mw-hint-on") ?? false;
    for (const on of Array.from(root.querySelectorAll(".mw-hint.mw-hint-on"))) {
      on.classList.remove("mw-hint-on");
    }
    bubble.classList.remove("mw-hint-on");
    if (hint !== null && !wasOn) {
      const hintText = hint.dataset.hint ?? hint.getAttribute("aria-label") ?? "";
      const decodeRows = decodeByHint.get(hintText);
      // 先清空历史内容：气泡只展示本次点击的那一份转换说明（append 不清空，必须显式清）
      bubble.textContent = "";
      if (decodeRows === undefined) {
        bubble.textContent = hintText;
      } else {
        // 点击 = 「这个结论怎么来的」：逐 token 原码 → 含义 的转换说明表
        bubble.append(el("strong", "mw-decode-title", T.decode.title));
        for (const r of decodeRows.rows) {
          const line = el("div", "mw-decode-row");
          line.append(
            el("span", "mw-decode-code", r.code),
            el("span", "mw-decode-arrow", "→"),
            el("span", "mw-decode-text", r.text),
          );
          bubble.append(line);
        }
        // 底部规范依据行：名称/版本/条款号/简要内容——供用户按图索骥核查原文（教学面）
        const cite = decodeRows.cite;
        if (cite !== undefined) {
          bubble.append(
            el("div", "mw-decode-basis", `${T.decode.basisLabel}${T.decode.cite[cite]}`),
          );
        }
      }
      const hr = hint.getBoundingClientRect();
      const rr = root.getBoundingClientRect();
      bubble.style.left = `${Math.max(0, hr.left - rr.left)}px`;
      bubble.style.top = `${hr.bottom - rr.top + 4}px`;
      hint.classList.add("mw-hint-on");
      bubble.classList.add("mw-hint-on");
    }
  });
  root.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      bubble.classList.remove("mw-hint-on");
      for (const on of Array.from(root.querySelectorAll(".mw-hint.mw-hint-on"))) {
        on.classList.remove("mw-hint-on");
      }
    }
  });
  root.append(bubble);

  // —— 主表 ↔ RAW 双向对照高亮：同一组的两处 data-hint 同字符串（单一来源锁），
  // 悬停任一侧即把同组两侧一起点亮——「这个结论从原文哪里来」一眼可见
  const setLinked = (key: string | null): void => {
    for (const node of Array.from(root.querySelectorAll<HTMLElement>("[data-hint]"))) {
      if (key === null) node.classList.remove("mw-link");
      else if (node.dataset.hint === key) node.classList.add("mw-link");
      else node.classList.remove("mw-link");
    }
  };
  root.addEventListener("mouseover", (ev) => {
    const target = ev.target instanceof HTMLElement ? ev.target : null;
    const hit = target?.closest<HTMLElement>("[data-hint]") ?? null;
    setLinked(hit === null ? null : (hit.dataset.hint ?? null));
  });
  root.addEventListener("mouseleave", () => setLinked(null));

  return root;
}
