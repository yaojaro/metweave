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
  CloudElement,
  RunwayVisualRange,
  VisibilityGroup,
  MetarReport,
  ReportTime,
  RunwayBraking,
  RunwayStateGroup,
  SkyClearCode,
  Span,
  TrendElements,
  TrendGroup,
  WarningCode,
  WeatherGroup,
  WindShearGroup,
} from "@metweave/core";
import { toValues } from "@metweave/core";
import {
  CAVOK_SHORT,
  CLOUD_GLOSS,
  WX_GLOSS,
  WIND_GLOSS,
  cloudCodeOf,
  cloudTone,
  ftToMeters,
  isCautionWeather,
  isDangerWeather,
  visibilityTone,
  weatherCodeOf,
  weatherGloss,
} from "./gloss";
import type { CloudGloss, WindGloss, WxGloss } from "./gloss";

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
  /** 展示时区偏移（分钟）——owner 9/24 单制指令：观测时刻行只显一个时区。
   *  缺省 null＝UTC；zh 传 480＝北京时（京dd日 HH:MM）；en 无本地时词表恒 UTC。与 renderTafCard 同语义 */
  utcOffsetMinutes?: number | null;
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
  "utcOffsetMinutes",
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
  /** 风行词表（显示值 + 悬停说明；本体在 gloss.ts 单一来源） */
  wind: WindGloss;
  /** 云词表（云量八分量 / 云底折米 / 对流云威胁 / VV；本体在 gloss.ts 单一来源） */
  cloud: CloudGloss;
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
  /** 天气组词表（WMO 4678 术语表 + 自然语序拼装；本体在 gloss.ts 单一来源） */
  wx: WxGloss;
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
    /** 指示组缺失的趋势段（时段词在位、指示组传输丢失，kind 'unspecified'） */
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
      speci: "特殊天气报告",
      metar: "例行报告",
      corrected: "更正报",
      auto: "自动观测",
      cavokShort: CAVOK_SHORT.zh,
    },
    missingGroup: {
      wind: "风组缺测",
      visibility: "能见度组缺测",
      weather: "天气组缺测",
      rvr: "跑道视程缺测（RVRNO）",
    },
    cavokHint: "CAVOK：能见度 ≥10km、5000ft 以下无云无天气，且任意高度无积雨云/浓积云（≠晴空）",
    windShearNote: "低空风切变——起降阶段重大危害（WS，WMO 306 FM15 §15.13.3）",
    wind: WIND_GLOSS.zh,
    cloud: CLOUD_GLOSS.zh,
    wx: WX_GLOSS.zh,
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
      unspecified: "变化趋势段（指示组缺失，渐变/短时不可辨）",
      // 时段词双形态：AT/TL/FM+HHMM 折 HH:MM 出具体时间点；斜杠 DDHH/DDHH（ICAO Annex 3 模板/
      // 中国民航主流编法）折「自 X 日 X 时至 X 日 X 时」——形状不符回退原词防捏造。
      // 注意：本对象的字符串由 scripts/terms.mjs 以 vm 求值抽取，函数体须保持纯 JS（禁 TS 语法）
      periodAt: (text) => {
        const slash = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.exec(text);
        if (slash !== null) {
          return `自 ${slash[1]} 日 ${slash[2]}:00 至 ${slash[3]} 日 ${slash[4]}:00`;
        }
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
      cavokShort: CAVOK_SHORT.en,
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
    wind: WIND_GLOSS.en,
    cloud: CLOUD_GLOSS.en,
    wx: WX_GLOSS.en,
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
        "trend segment with missing change indicator (gradual vs temporary indistinguishable)",
      // HHMM → HH:MM; slash DDHH/DDHH (ICAO Annex 3 template) → "from day X HH:00 to day Y HH:00"
      // (the AT/TL/FM indicator semantics are carried by the leading words, never repeated verbatim;
      // keep function bodies plain JS — scripts/terms.mjs evaluates this object with node:vm)
      periodAt: (text) => {
        const slash = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.exec(text);
        if (slash !== null) {
          return `from day ${slash[1]} ${slash[2]}:00 to day ${slash[3]} ${slash[4]}:00`;
        }
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

/** 悬停解释统一挂载：aria-label 承载读屏通道，点击/Enter/Space 切换气泡（见 root 委托），
 *  悬停联动随行显电码浮签（owner 9/24 统一批）。
 *  原生 title 已移除（2026-09-24 评测批2#6：title 悬停与电码浮签同屏双气泡叠出——TAF 卡此前
 *  已把 title 移行头收口，METAR 卡对齐；人话解读走 aria-label（读屏）＋点击/键盘解码气泡，
 *  电码走浮签，三通道各司其职不再叠出） */
const attachHint = (node: HTMLElement, hint: string): void => {
  node.setAttribute("aria-label", hint); // 读屏通道
  node.classList.add("mw-hint"); // 点击/键盘切换气泡（见 root 委托与 .mw-hint-pop 样式）
  node.tabIndex = 0; // 键盘 Tab 可达（Enter/Space 开合气泡）
  node.dataset.hint = hint; // 气泡文案源（不污染 textContent，RAW 对照原样）
};

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

/** 真实 Date → 北京时显示串（跨月经 Date 真月历换算，2026-09-24 评测 P1 月界批）：
 *  「M月D日 HH:MM」——月位显式，跨月不再有「哪个月」的歧义 */
function zonedClockOf(utc: Date, offsetMinutes: number): string {
  const z = new Date(utc.getTime() + offsetMinutes * 60_000);
  return `${z.getUTCMonth() + 1}月${z.getUTCDate()}日 ${String(z.getUTCHours()).padStart(2, "0")}:${String(z.getUTCMinutes()).padStart(2, "0")}`;
}

/** 观测时刻 → 本地时显示序（单制主显，owner 9/24）：北京时制走真实月历（observeTimeOf 已把
 *  「日/时/分」定到真实 Date——含跨月；跨月显示 10月1日 而非「31日」回绕，2026-09-24 评测 P1 月界批）。
 *  observeTimeOf 无可吻合候选（7 天内日号不吻合的病态输入）时回退 %31 折回显示——残余近似仅显示位：
 *  病态日号本就无从判读真实日期，且龄期行不渲染、档位判读不依赖显示串，无害 */
function fallbackClockOf(t: ReportTime, offsetMinutes: number): string {
  const total = (t.day - 1) * 1440 + t.hour * 60 + t.minute + offsetMinutes;
  const d = (Math.floor(total / 1440) % 31) + 1;
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  return `${String(d).padStart(2, "0")}日 ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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
  border: 1px solid #d8dee4; border-radius: 10px; padding: 12px 14px; max-width: 420px; position: relative;
  /* 限高契约对齐 TAF 卡（owner 9/24 只落了 TAF 侧——多跑道状态组长卡可超视口，批3#10）：
     卡内上下滚动，滚轮隔离由 Leaflet 弹窗内建 disableScrollPropagation 提供 */
  max-height: min(65vh, 680px); overflow-y: auto; }
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
/* 电码浮签（owner 9/24 统一批：与 TAF 卡同款——悬停联动组随行显 RAW 侧电码，零占位零回流） */
.mw-codechip { position: absolute; display: none; z-index: 3; pointer-events: none; white-space: nowrap;
  font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #44546a; background: #f7f9fc; border: 1px solid #cdd7e2; border-radius: 3px; padding: 1px 5px;
  box-shadow: 0 1px 3px rgba(20, 32, 45, 0.15); }
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
.mw-warnings li.mw-warning { color: #7a4d0b; }
.mw-warnings li.mw-error { color: #b3261e; font-weight: 600; }
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
  // 时刻随展示时区单制（owner 9/24）：UTC＝dd日 HH:MM UTC；京＝北京时M月D日 HH:MM（真实月历，en 恒 UTC）；
  // 北京时制经 observeTimeOf 定到的真实 Date 换算（跨月正确——月界批），病态日号回退 %31 近似显示
  const observedAt = observeTimeOf(v.time, now);
  const timeText =
    options.utcOffsetMinutes !== undefined &&
    options.utcOffsetMinutes !== null &&
    options.locale !== "en"
      ? `北京时${observedAt !== null ? zonedClockOf(observedAt, options.utcOffsetMinutes) : fallbackClockOf(v.time, options.utcOffsetMinutes)}`
      : T.timeText(v.time);
  const timeEl = el("div", "mw-time", timeText);
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
        attachHint(text, title); // 词级承载全部通道（aria-label/气泡/浮签）——行级 title 一并退役（批2#6 双气泡收口）
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
      // 严重度 class 钩子（mw-info/mw-warning/mw-error）：下游 CSS 按 severity 分流的挂点
      //（2026-09-16 五方评测反馈：此前仅 info 有钩子，warning/error 无法定向着色）
      const li = el(
        "li",
        w.severity === "info" ? "mw-info" : w.severity === "warning" ? "mw-warning" : "mw-error",
      );
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
  // 键盘契约（2026-09-24 评测 P1 键盘批，两卡同款）：可聚焦元素（.mw-hint）Enter/Space 开合气泡、
  // Esc 关闭；aria-expanded 挂触发元素、气泡经 aria-describedby 接入读屏；联动点亮 mouseover 与 focusin 同路。
  // 切换语义：点已开的收起，点别的换文案，点空白处全收
  const bubble = el("span", "mw-hint-pop");
  bubble.setAttribute("role", "tooltip");
  let bubbleSeq = 0;
  const closeBubble = (): void => {
    bubble.classList.remove("mw-hint-on");
    for (const on of Array.from(root.querySelectorAll<HTMLElement>(".mw-hint.mw-hint-on"))) {
      on.classList.remove("mw-hint-on");
      on.removeAttribute("aria-expanded");
      on.removeAttribute("aria-describedby");
    }
  };
  const openBubble = (hint: HTMLElement): void => {
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
        bubble.append(el("div", "mw-decode-basis", `${T.decode.basisLabel}${T.decode.cite[cite]}`));
      }
    }
    const hr = hint.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    bubble.style.left = `${Math.max(0, hr.left - rr.left)}px`;
    bubble.style.top = `${hr.bottom - rr.top + 4}px`;
    if (bubble.id === "") bubble.id = `mw-hint-pop-${++bubbleSeq}`;
    hint.setAttribute("aria-expanded", "true");
    hint.setAttribute("aria-describedby", bubble.id);
    hint.classList.add("mw-hint-on");
    bubble.classList.add("mw-hint-on");
  };
  /** 开合入口（click 与键盘 Enter/Space 共用）：点已开的收起、点别的换文案 */
  const toggleBubble = (hint: HTMLElement): void => {
    const wasOn = hint.classList.contains("mw-hint-on");
    closeBubble();
    if (!wasOn) openBubble(hint);
  };
  root.addEventListener("click", (ev) => {
    const target = ev.target instanceof HTMLElement ? ev.target : null;
    const hint = target?.closest<HTMLElement>(".mw-hint") ?? null;
    if (hint !== null) toggleBubble(hint);
    else closeBubble();
  });
  root.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      closeBubble();
      return;
    }
    if (ev.key !== "Enter" && ev.key !== " ") return;
    // span 无原生 click 合成：Enter/Space 显式触发同一开合逻辑（评测 P1：注释曾宣称 focus 显示气泡实无实现）
    const target = ev.target instanceof HTMLElement ? ev.target : null;
    const hint = target?.closest<HTMLElement>(".mw-hint") ?? null;
    if (hint !== null) {
      ev.preventDefault(); // Space 不滚动页面
      toggleBubble(hint);
    }
  });
  root.append(bubble);

  // —— 主表 ↔ RAW 双向对照高亮 + 电码浮签（owner 9/24 统一批：联动语言＝点亮＋浮签、不做压暗，与 TAF 卡同口径）：
  // 同一组的两处 data-hint 同字符串（单一来源锁），悬停任一侧即把同组两侧一起点亮，
  // 浮签随行显出该组在 RAW 侧的电码——「这个结论从原文哪里来」一眼可见
  const codeChip = el("span", "mw-codechip");
  const showChip = (near: HTMLElement, codes: string): void => {
    codeChip.textContent = codes;
    codeChip.style.display = "inline-block";
    const rr = root.getBoundingClientRect();
    const nr = near.getBoundingClientRect();
    const chipW = codeChip.offsetWidth;
    const left = Math.max(4, Math.min(nr.right - rr.left - chipW, root.clientWidth - chipW - 4));
    const top = Math.max(0, nr.top - rr.top - codeChip.offsetHeight - 2);
    codeChip.style.left = `${left}px`;
    codeChip.style.top = `${top}px`;
  };
  const setLinked = (key: string | null, near: HTMLElement | null = null): void => {
    const codes: string[] = [];
    for (const node of Array.from(root.querySelectorAll<HTMLElement>("[data-hint]"))) {
      const hit = key !== null && node.dataset.hint === key;
      node.classList.toggle("mw-link", hit);
      if (hit && node.closest(".mw-raw") !== null) codes.push(node.textContent ?? "");
    }
    if (key !== null && near !== null && codes.length > 0) showChip(near, codes.join(" "));
    else codeChip.style.display = "none";
  };
  root.addEventListener("mouseover", (ev) => {
    const target = ev.target instanceof HTMLElement ? ev.target : null;
    const hit = target?.closest<HTMLElement>("[data-hint]") ?? null;
    setLinked(hit === null ? null : (hit.dataset.hint ?? null), hit);
  });
  root.addEventListener("mouseleave", () => setLinked(null));
  // 键盘联动等价（评测 P1：mouseover 委托无 focusin 等价——Tab 聚焦词时点亮+浮签不可达）
  root.addEventListener("focusin", (ev) => {
    const target = ev.target instanceof HTMLElement ? ev.target : null;
    const hit = target?.closest<HTMLElement>("[data-hint]") ?? null;
    setLinked(hit === null ? null : (hit.dataset.hint ?? null), hit);
  });
  root.addEventListener("focusout", (ev) => {
    const to = ev.relatedTarget instanceof HTMLElement ? ev.relatedTarget : null;
    if (to?.closest("[data-hint]") === null || to === null) setLinked(null);
  });
  root.append(codeChip);

  return root;
}
