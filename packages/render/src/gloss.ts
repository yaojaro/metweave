/**
 * @metweave/render — 人话词表内核：card（METAR 卡）与 taf-card（TAF 分段明细）共用的
 * 天气短语单一来源。The plain-language gloss kernel shared by the METAR card and the TAF
 * segment view.
 * 本模块不进包公共出口（内部共享件）：两处渲染取同一份词表与拼装函数，禁止各自抄录
 * （wx 现象/描述符、云量短名、风词、英尺折米等以本文件为唯一真相）。
 * 术语册抽取链：card.ts#LOCALE 经 scripts/terms.mjs 以本文件常量入作用域求值（同 DECODE_CITES 先例）。
 */
import type {
  CloudAmount,
  CloudElement,
  SkyClearCode,
  SpeedUnit,
  WeatherDescriptor,
  WeatherGroup,
  WeatherPhenomenon,
} from "@metweave/core";

/** 风向三位补零（变程 20°–90° 的电码形态 020V090） */
const deg3 = (deg: number): string => String(deg).padStart(3, "0");

/** 英尺云底折米：1 ft = 0.3048 m 的精确换算，四舍五入到整米——精确的是换算，不是被测量，
 *  故显示层一律标「约/≈」 */
export const ftToMeters = (ft: number): number => Math.round(ft * 0.3048);

/** 风行词表（显示值 + 悬停说明；函数项用于本地语序拼装） */
export interface WindGloss {
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
}

export const WIND_GLOSS: Record<"zh" | "en", WindGloss> = {
  zh: {
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
  en: {
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
};

/** 云悬停与短译词表（云量八分量 / 云底折米 / 对流云威胁 / VV / 无云电码） */
export interface CloudGloss {
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
}

export const CLOUD_GLOSS: Record<"zh" | "en", CloudGloss> = {
  zh: {
    amount: {
      FEW: "少云：约 1–2 个量（1/8–2/8）",
      SCT: "疏云：约 3–4 个量（3/8–4/8）",
      BKN: "多云：约 5–7 个量（5/8–7/8）",
      OVC: "阴：8 个量（8/8，天空全遮蔽）",
    },
    shortAmount: { FEW: "少云", SCT: "疏云", BKN: "多云", OVC: "阴" },
    baseShortMeters: (meters) => `，云底约 ${meters} 米`,
    metersShort: (meters) => ` 约 ${meters} 米`,
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
  en: {
    amount: {
      FEW: "Few: 1–2 oktas (1/8–2/8)",
      SCT: "Scattered: 3–4 oktas (3/8–4/8)",
      BKN: "Broken: 5–7 oktas (5/8–7/8)",
      OVC: "Overcast: 8 oktas (8/8, sky fully covered)",
    },
    shortAmount: { FEW: "few", SCT: "scattered", BKN: "broken", OVC: "overcast" },
    baseShortMeters: (meters) => `, base ≈ ${meters} m`,
    metersShort: (meters) => ` ≈ ${meters} m`,
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
};

/** 天气组悬停词表（WMO 4678 术语表 + 自然语序拼装） */
export interface WxGloss {
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
}

export const WX_GLOSS: Record<"zh" | "en", WxGloss> = {
  zh: {
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
  en: {
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
};

/** CAVOK 徽章/分段行的直白短译（非专业零悬停可读；完整定义在 card 悬停——≠晴空防歧义） */
export const CAVOK_SHORT: Record<"zh" | "en", string> = {
  zh: "能见度佳、低云与天气无碍",
  en: "good visibility; no low cloud or significant weather",
};

/** 飞行威胁标注（复评定案：VA/GR/TS 优先） */
const isFlightHazard = (g: WeatherGroup): boolean =>
  g.phenomena.includes("VA") || g.phenomena.includes("GR") || g.descriptor === "TS";

/** 由 IR 重建天气组原码（span 缺席时的显示回退；亦用于 tooltip 摘要）：VC/强度/描述符/现象依电码序拼回 */
export const weatherCodeOf = (g: WeatherGroup): string =>
  `${g.proximity ? "VC" : ""}${g.intensity ?? ""}${g.descriptor ?? ""}${g.phenomena.join("")}`;

/** 由 IR 重建云层原码（span 缺席时的显示回退；缺测位还原为 ///） */
export const cloudCodeOf = (layer: CloudElement): string => {
  if (layer.kind === "vertical-visibility") {
    return `VV${layer.heightFt.value === null ? "///" : deg3(layer.heightFt.value / 100)}`;
  }
  const height =
    layer.heightFt.value === null ? "///" : deg3(Math.round(layer.heightFt.value / 100));
  return `${layer.amount ?? "///"}${height}${layer.convective ?? ""}`;
};

/** 天气组短语合成：强度词 + 邻近词 + 描述符与现象的自然语序拼装（+TSRA → 强雷暴伴雨 / Heavy thunderstorm with rain）。
 *  强度词分两路（zh）：TS 族用 强/轻（强雷暴伴雨），其余用 大/小直连现象名词（小雨/大雨/小雪/大雪）。 */
export function weatherGloss(g: WeatherGroup, wx: WxGloss): string {
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

// ---------------------------------------------------------------- 扫视色调判据（card 行色与 taf-card 分段色点共用）

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
 * - danger（红系 mw-danger）：天气描述符含 TS（雷暴）或 FZ（冻降水族，2026-09-22 运行视角评审升红）或现象含 GR（冰雹）或强度 +（强）；
 *   云层含 CB/TCU（对流云）；能见度 < 1500 m；RVR < 800 m；跑道关闭。
 * - caution（橙系 mw-caution）：降水类现象（RA/SN/SG/PL/GS/IC/DZ/UP）；
 *   能见度 1500–5000 m（能见度分档取国内通行 1500/5000 m 口径）。
 * 阈值与分级细则随术语表版本审定后修订。
 */
export const isDangerWeather = (g: WeatherGroup): boolean =>
  g.descriptor === "TS" ||
  g.descriptor === "FZ" ||
  g.phenomena.includes("GR") ||
  g.intensity === "+";

export const isCautionWeather = (g: WeatherGroup): boolean =>
  !isDangerWeather(g) &&
  (g.descriptor === "FZ" || g.phenomena.some((p) => PRECIP_PHENOMENA.has(p)));

/**
 * 低云底着色（判据本库自拟、初稿待审——显示层扫视口径，非标准分级、非运行判据）：
 * BKN/OVC 云底 < 1000 ft → mw-danger；1000–3000 ft → mw-caution；
 * VV 组任意 → mw-caution，VV < 400 ft → mw-danger。
 * 对流云（CB/TCU）恒 danger（威胁优先于云底档位）；缺测云高不捏造档位不着色。
 */
export const cloudTone = (layer: CloudElement): "mw-danger" | "mw-caution" | undefined => {
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

export const visibilityTone = (vis: {
  value: number;
  unit: "m" | "sm";
  exact: boolean;
  beyond?: "above" | "below";
}): "mw-danger" | "mw-caution" | undefined => {
  const meters = visibilityMeters(vis);
  if (meters < 1500) return "mw-danger";
  if (meters < 5000) return "mw-caution";
  return undefined;
};

/** 双日界引用（UTC/北京时双日界引用加上」）：北京时制下展示时刻的日期与报文 UTC
 *  日期不同日时，括注 UTC 日号——防与 RAW 电码/外部 UTC 源对表错位（如「北京时9月25日 02:00（UTC 24日）」）。
 *  同日返回空串；UTC 单制（offset null）调用方不调本函数；病态折回显示路径无真实 UTC 锚，同样不调。 */
export const utcDayRefText = (
  shifted: Date,
  utcY: number,
  utcMo: number,
  utcD: number,
  locale: "zh" | "en",
): string =>
  shifted.getUTCFullYear() === utcY &&
  shifted.getUTCMonth() + 1 === utcMo &&
  shifted.getUTCDate() === utcD
    ? ""
    : locale === "en"
      ? ` (UTC ${utcMo}/${utcD})`
      : `（UTC ${utcMo}月${utcD}日）`;
