/**
 * @metweave/parser — 组级解析共享层（token 游标之上的纯函数与词表）。
 * Group-level parsing shared layer: pure functions and vocabularies above the token cursor.
 *
 * 2026-09-23 批 1.0 自 index.ts 机械迁出（METAR 行为零变化：324 测试零改动 + 语料回放零漂移）——
 * 供 parse()（METAR/SPECI）与 parseTaf()（TAF，批 1 起）共用；本模块不出口包 API（入口仍 index.ts）。
 */
import type {
  AltimeterReading,
  CloudAmount,
  CloudCondition,
  CloudElement,
  ConvectiveType,
  Observed,
  ParseWarning,
  RemarkGroup,
  RemarkKind,
  RunwayStateGroup,
  RunwayVisualRange,
  SkyClearCode,
  Span,
  TemperatureReading,
  TrendElements,
  TrendGroup,
  VisibilityGroup,
  WeatherDescriptor,
  WeatherGroup,
  WeatherPhenomenon,
  WindGroup,
} from "@metweave/core";

export interface Token {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

export const PHENOMENA: readonly WeatherPhenomenon[] = [
  "DZ",
  "RA",
  "SN",
  "SG",
  "IC",
  "PL",
  "GR",
  "GS",
  "UP",
  "BR",
  "FG",
  "FU",
  "VA",
  "DU",
  "SA",
  "HZ",
  "PY",
  "PO",
  "SQ",
  "FC",
  "SS",
  "DS",
];
export const DESCRIPTORS: readonly WeatherDescriptor[] = [
  "MI",
  "PR",
  "BC",
  "DR",
  "BL",
  "SH",
  "TS",
  "FZ",
];
export const TREND_KINDS = new Set<string>(["NOSIG", "BECMG", "TEMPO"]);
/** 趋势段拖词容忍集（无 typed 语义的磨损尾/连接词——收进 trend.raw 静默保真，不产生噪声）：
 *  语料实弹 VNKT 120930Z「NOSIG CB TO NE AND E」（观测员补记磨损尾）与既有回归锁契约
 *  （拖词不告警、原文留 raw）；含裸对流码 CB/TCU（无云量云高位的残缺云信息，无解码面）与
 *  16 方位词、TO/AND 连接词。与「交回正文恢复 typed 语义」的收窄主判据互补：
 *  有语义可恢复的（温露/QNH/$/WS/TX/TN/RVRNO）一律收口交回，纯噪声拖词保持原文静默。 */
export const TREND_FILLER_WORDS = new Set([
  "TO",
  "AND",
  "CB",
  "TCU",
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
]);
/** 趋势段收组判据（封闭清单）：只有趋势合法要素族（WMO 306 FM15 §15.14.2/§15.14.10：风/能见度/现在天气/云，
 *  加趋势专属 NSW 与 CAVOK 顶替）与风组变化组拖带形（dddVddd）可收进趋势段；其余 token 一律收口
 *  交回正文循环——正文各分支自带认组与 unknown-token 出声，语义无损恢复，冲突组自然触发重复组告警。
 *
 *  根因一（2026-09-12 复评实弹）：旧收集循环只认趋势指示组，俄区报文「NOSIG RMK QFE749」把 RMK 段
 *  整段吞进 trends（RU 61/65、KZ 18/18 条命中）、remarks 反而为空。
 *  根因二（2026-09-14 复评实弹）：收口改「白名单补洞」后正文专属组（温露/QNH/$/WS/TX/TN/RVRNO）
 *  仍被静默吞进 trend.raw、typed 语义蒸发——RMK、Rxx/、$ 已是三次逃逸，补洞循环就此终结：
 *  判据反转为规范封闭清单，未来一切新正文分支自动获得「交回正文 + 出声」兜底。
 *  硬边界保留：RMK（含词身粘连 startsWith）与 R 组形态——R 组收口另有 trendCloseWarning 出声。 */
export const isTrendCollectible = (t: Token, next: Token | undefined): boolean => {
  const text = t.text;
  // 段间切换与正文硬边界：下一个趋势指示组、RMK、R 组形态（Rxx/…、R/SNOCLO）一律收口
  if (TREND_KINDS.has(text) || text.startsWith("RMK")) return false;
  if (/^R(\d{2}[RLC]?\/|\/SNOCLO$)/.test(text)) return false;
  // 趋势专属词与天气缺测电码
  if (text === "CAVOK" || text === "NSW" || text === "//") return true;
  // 拖词容忍集（见 TREND_FILLER_WORDS 注：无 typed 语义，静默保真优于 unknown 噪声）
  if (TREND_FILLER_WORDS.has(text)) return true;
  // 磨损时段词（一趋势内第二/三个 AT|TL|FM ddhh——指示组已在，按拖词静默保真；
  // tgftp/归档实弹，回归锁：标准位置时段词零告警）
  if (/^(AT|TL|FM)\d{4}$/.test(text)) return true;
  // 风（含 /////KT 缺测、VRB、P 超上限形）与风组变化组拖带（dddVddd 单独成 token）
  if (parseWindToken(t, next) !== null || /^\d{3}V\d{3}$/.test(text)) return true;
  // 能见度（米制 4 位/NDV/方向组/SM 族/混分数跨 token///// 缺测家族）
  if (parseVisibilityToken(t, next) !== null) return true;
  // 现在天气（VC 邻近/-+ 强度/组合词身/裸 TS；RE 近期天气不属趋势族——交回正文按 recentWeather 认组）
  if (parseWeatherBody(text) !== null) return true;
  // 云（层组/VV/晴空码）
  if (CLOUD_LAYER_PATTERN.test(text) || VV_PATTERN.test(text) || isSkyClear(text)) return true;
  return false;
};
export const SKY_CLEAR_CODES: readonly SkyClearCode[] = ["SKC", "NSC", "NCD", "CLR"];
export const CLOUD_AMOUNTS: readonly CloudAmount[] = ["FEW", "SCT", "BKN", "OVC"];
export const SPEED_UNITS: readonly WindGroup["speed"]["unit"][] = ["kt", "mps", "kmh"];
/** QNH/A 物理可信范围：世界海平面气压极值 870（台风 Tip）–1083.8 hPa（蒙古高压 Agata 1968）——
 *  上界取 1084（极值之上即物理不可能，复评实弹 Q1087 由此拦截），下界 800 留裕量；
 *  A 组（inHg）按同区间镜像换算外圆整为 23.5–32.5（800 hPa ≈ 23.62、1084 ≈ 32.02）。
 *  越界 = 值不可信 → 判缺测 + value-out-of-range 告警（与 Q10054 位数超界同纪律，绝不静默留假值）。 */
export const QNH_HPA_MIN = 800;
export const QNH_HPA_MAX = 1084;
export const ALT_INHG_MIN = 23.5;
export const ALT_INHG_MAX = 32.5;
/** 温度物理可信范围：世界极值 +56.7°C（Death Valley 1913）/ −89.2°C（Vostok 1983），
 *  取 60/−90 留裕量（与 QNH 世界极值门同款纪律）——两位数模板空间内的物理不可能值
 *  （89/85 构造实弹）不可信判缺测，绝不静默留假值。 */
export const TEMP_C_MIN = -90;
export const TEMP_C_MAX = 60;
/** LTG 尾随词表（FMH-1 雷电视词与方位）：放电类型 IC/CG/CC/CA、位置 OHD/ALQDS/DSNT/VCNTY 与 16 方位点。
 *  实弹（tgftp 全 cycle）LTG 后的方位词此前逐个散落成 unknown remarks（ALQDS/OHD/方位词一片）。 */
export const LTG_TAIL_VOCAB = new Set([
  "IC",
  "CG",
  "CC",
  "CA",
  "OHD",
  "ALQDS",
  "DSNT",
  "VCNTY",
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
]);
/** 变化能见度尾组形态（RMK VIS 1/2V2 / VIS 1/4V1/2）：两侧为整数或分数（可带 M/P 阈值前缀）。 */
export const VIS_V_RANGE = /^[MP]?\d+(?:\/\d+)?V[MP]?\d+(?:\/\d+)?$/;
/** 温度预告组形态（TAF TX/TN 混入 METAR 通路：TX25/0907Z = 最高 25°C、09 日 07Z 到达，M 前缀 = 负值）。 */
export const TX_TN_PATTERN = /^(TX|TN)M?\d{2}\/\d{4}Z$/;

// —— E3 首字符位掩码（正文循环分支分流用；可达首字符推导见正文循环内注释）
export const M_WIND = 1 << 0;
export const M_VIS = 1 << 1;
export const M_R = 1 << 2;
export const M_WEATHER = 1 << 3;
export const M_CLOUD = 1 << 4;
export const M_VV = 1 << 5;
export const M_SKY_CLEAR = 1 << 6;
export const M_TEMP = 1 << 7;
export const M_QNH = 1 << 8;
export const M_ALTIMETER_A = 1 << 9;
export const M_VIS_RANGE = 1 << 10;
export const M_DOLLAR = 1 << 11;
export const M_WS_RWY = 1 << 12;

/** 首字符（charCode）→ 候选分支位掩码；0 = 无分支可达（直接落 unknown-token） */
export function maskOf(code: number): number {
  if (code >= 48 && code <= 57) return M_WIND | M_VIS | M_TEMP; // 0-9
  switch (code) {
    case 47: // /
      return M_WIND | M_VIS | M_WEATHER | M_CLOUD | M_TEMP;
    case 86: // V（VRB 风 / VC 天气 / VV / VIS）
      return M_WIND | M_WEATHER | M_VV | M_VIS_RANGE;
    case 77: // M（M1/4SM / MIFG / M10/）
      return M_VIS | M_WEATHER | M_TEMP;
    case 80: // P（P6SM / PL PO PY PR）
      return M_VIS | M_WEATHER;
    case 82: // R（RVRNO / R 组 / RA…）
      return M_R | M_WEATHER;
    case 81: // Q
      return M_QNH;
    case 65: // A（AUTO 词已在前置词位收口，此处仅 A 组）
      return M_ALTIMETER_A;
    case 66: // B
    case 70: // F
      return M_WEATHER | M_CLOUD;
    case 79: // O（现象/描述符无 O 首字母）
      return M_CLOUD;
    case 83: // S
      return M_WEATHER | M_CLOUD | M_SKY_CLEAR;
    case 78: // N
    case 67: // C
      return M_SKY_CLEAR;
    case 68: // D
    case 71: // G
    case 72: // H
    case 73: // I
    case 84: // T
    case 85: // U
    case 45: // -
    case 43: // +
      return M_WEATHER;
    case 36: // $
      return M_DOLLAR;
    case 87: // W（WS 风切变组）
      return M_WS_RWY;
    default:
      return 0;
  }
}

export const isPhenomenon = (s: string): s is WeatherPhenomenon => PHENOMENA.some((p) => p === s);
export const isDescriptor = (s: string): s is WeatherDescriptor => DESCRIPTORS.some((p) => p === s);
export const isCloudAmount = (s: string): s is CloudAmount => CLOUD_AMOUNTS.some((p) => p === s);
export const isSkyClear = (s: string): s is SkyClearCode => SKY_CLEAR_CODES.some((p) => p === s);
export const isSpeedUnit = (s: string): s is WindGroup["speed"]["unit"] =>
  SPEED_UNITS.some((p) => p === s);
export const isConvective = (s: string): s is ConvectiveType => s === "CB" || s === "TCU";

export function tokenize(raw: string): Token[] {
  const tokens: Token[] = [];
  const rx = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(raw)) !== null) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

export const spanOf = (t: Token): Span => ({ start: t.start, end: t.end });

/** 云层组形态（FEW023CB / /////01CB/// 缺测位形态）——正文循环与趋势段结构化共用一份正则防漂移 */
export const CLOUD_LAYER_PATTERN = /^(FEW|SCT|BKN|OVC|\/\/\/)(\d{3}|\/\/\/)(CB|TCU)?(\/\/\/)?$/;
/** VV 组形态（VV / VV/// / VV002）——同上共用 */
export const VV_PATTERN = /^VV(\/\/\/|\d{3})?$/;

/**
 * 趋势段内要素结构化（WMO 306 FM15 §15.14.2：风/能见度/天气/云四族 + 趋势专属 NSW（§15.14.13）与 CAVOK（§15.10）顶替）。
 * best-effort 且静默：认不出的组不产生任何告警（告警面受语料快照锁保护），原文在 raw 保真；
 * 正文循环同款的 token 级解析函数直接复用（parseWindToken/parseVisibilityToken/parseWeatherBody），
 * 组形正则取共享常量。返回 undefined = 没有任何组被识别（如裸 NOSIG）。
 */
export function structureTrendElements(
  tokens: readonly Token[],
  start: number,
): TrendElements | undefined {
  let wind: WindGroup | undefined;
  let visibility: VisibilityGroup | undefined;
  let cavok: TrendElements["cavok"];
  let nsw: TrendElements["nsw"];
  const weather: WeatherGroup[] = [];
  let clouds: CloudCondition | undefined;
  let k = start;
  while (k < tokens.length) {
    const t = tokens[k];
    if (t === undefined) break;
    const next = tokens[k + 1];
    if (t.text === "CAVOK") {
      cavok = { span: spanOf(t) };
      k += 1;
      continue;
    }
    if (t.text === "NSW") {
      nsw = { span: spanOf(t) };
      k += 1;
      continue;
    }
    if (wind === undefined) {
      const w = parseWindToken(t, next);
      if (w !== null && w !== "missing") {
        wind = w.group;
        k += w.consumed;
        continue;
      }
    }
    if (visibility === undefined) {
      const vis = parseVisibilityToken(t, next);
      if (vis !== null && vis.kind === "ok") {
        visibility = vis.group;
        k += vis.consumed;
        continue;
      }
    }
    const wx = parseWeatherBody(t.text);
    if (wx !== null) {
      // 内部信号（outOfOrder/signWithVc）不进 IR；趋势段 tolerant 静默收下
      const { outOfOrder: _outOfOrder, signWithVc: _signWithVc, ...group } = wx;
      weather.push({ ...group, span: spanOf(t) });
      k += 1;
      continue;
    }
    const cloudM = CLOUD_LAYER_PATTERN.exec(t.text);
    if (cloudM !== null) {
      const amountRaw = cloudM[1];
      const heightRaw = cloudM[2];
      const convectiveRaw = cloudM[3];
      clouds = {
        elements: [
          ...(clouds?.elements ?? []),
          {
            kind: "layer",
            amount: amountRaw !== undefined && isCloudAmount(amountRaw) ? amountRaw : null,
            heightFt: {
              value:
                heightRaw !== undefined && heightRaw !== "///"
                  ? Number.parseInt(heightRaw, 10) * 100
                  : null,
              span: spanOf(t),
            },
            convective:
              convectiveRaw !== undefined && isConvective(convectiveRaw)
                ? convectiveRaw
                : undefined,
            span: spanOf(t),
          },
        ],
        ...(clouds?.clear !== undefined ? { clear: clouds.clear } : {}),
      };
      k += 1;
      continue;
    }
    const vvM = VV_PATTERN.exec(t.text);
    if (vvM !== null) {
      const heightRaw = vvM[1];
      clouds = {
        elements: [
          ...(clouds?.elements ?? []),
          {
            kind: "vertical-visibility",
            heightFt: {
              value:
                heightRaw === undefined || heightRaw === "///"
                  ? null
                  : Number.parseInt(heightRaw, 10) * 100,
              span: spanOf(t),
            },
            span: spanOf(t),
          },
        ],
        ...(clouds?.clear !== undefined ? { clear: clouds.clear } : {}),
      };
      k += 1;
      continue;
    }
    if (isSkyClear(t.text)) {
      clouds = { elements: clouds?.elements ?? [], clear: { code: t.text, span: spanOf(t) } };
      k += 1;
      continue;
    }
    k += 1; // 认不出的组：原文保真、静默跳过（tolerant 纪律，绝不静默丢原文）
  }
  if (
    wind === undefined &&
    visibility === undefined &&
    cavok === undefined &&
    nsw === undefined &&
    weather.length === 0 &&
    clouds === undefined
  )
    return undefined;
  return {
    ...(wind !== undefined ? { wind } : {}),
    ...(visibility !== undefined ? { visibility } : {}),
    ...(cavok !== undefined ? { cavok } : {}),
    weather,
    ...(nsw !== undefined ? { nsw } : {}),
    ...(clouds !== undefined ? { clouds } : {}),
  };
}

export function joinSpan(tokens: readonly Token[]): Span {
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  if (first === undefined || last === undefined) return { start: 0, end: 0 };
  return { start: first.start, end: last.end };
}

/**
 * 紧凑模式出口剥除（E1）v2——重建式：遍历构造全新对象（不含 span/cavokSpan 键），零 mutation。
 * 设计权衡（实测驱动，两版对比）：
 * - 构造期逐点跳过 span 的方案在 full 模式引入 ~20% 退化（分支插入组构造热路径），否决；
 * - 旧版出口就地删键（Reflect.deleteProperty）让 V8 把产物退化为 dictionary mode（慢属性）：
 *   实测紧凑吞吐仅全模式 ~32%（23 万 vs 72 万行/秒）、存活对象驻留反升 ~2.2×——此为本版根因修复对象；
 * - 重建式出口一次遍历：full 模式与旧版逐字节同路径（零开销），紧凑产物保持 fast properties
 *   （隐藏类不丢），实测吞吐回到全模式 ~55% 量级（40.6 万 vs 72.8 万行/秒，旧版仅 32%）、
 *   驻留与全模式持平（1.01×，旧版反升 2.21×——数字见 E 批性能冒烟锁注释）。
 * 数组重建新数组、原语透传；对象均为本次 parse 新建（无共享引用），键序保持原插入序（JSON 面稳定）。
 */
export function compactNode<T>(node: T): T {
  if (Array.isArray(node)) {
    const out: unknown[] = [];
    for (const item of node) out.push(compactNode(item));
    // 重建副本与原值同构（仅少 span 键）——与 structuredClone 同款「unknown → T」定型需求，断言无法避免
    // oxlint-disable-next-line no-unsafe-type-assertion
    return out as T;
  }
  if (node === null || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "span" || key === "cavokSpan") continue; // 剥除目标键：不进新对象（而非删除）
    out[key] = compactNode(value);
  }
  // 同上：键值逐项来自原对象（仅滤除 span），与 T 同构
  // oxlint-disable-next-line no-unsafe-type-assertion
  return out as T;
}

/** 天气组合词切分：把「TSRA」拆成描述符 TS + 现象 RA；无法合法切分返回 null。
 *  outOfOrder = 能完整切解但语序不合电码表（描述符出现在现象之后，如 RATS＝RA+TS）——
 *  tolerant 纪律下仍按切解结果收下，由调用方追加 invalid-format 告警。
 *  bare = 描述符单独编报（无现象）——TS 恒合法；SH 仅在 VC 邻近语境内合法（VCSH，
 *  WMO 306 表 4678 注：机场附近有阵性降水但降水类型不可辨），由 parseWeatherBody 收口。 */
export function splitWeatherToken(body: string): {
  descriptor?: WeatherDescriptor;
  phenomena: readonly WeatherPhenomenon[];
  outOfOrder: boolean;
  bare: boolean;
} | null {
  const chunks: string[] = [];
  for (let i = 0; i < body.length; i += 2) chunks.push(body.slice(i, i + 2));
  if (chunks.some((c) => c.length !== 2)) return null;
  const phenomena: WeatherPhenomenon[] = [];
  let descriptor: WeatherDescriptor | undefined;
  let sawPhenomenon = false;
  let outOfOrder = false;
  for (const c of chunks) {
    if (isPhenomenon(c)) {
      phenomena.push(c);
      sawPhenomenon = true;
    } else if (isDescriptor(c) && descriptor === undefined) {
      descriptor = c;
      if (sawPhenomenon) outOfOrder = true; // 电码表语序：描述符须先于现象
    } else return null;
  }
  if (phenomena.length === 0 && descriptor !== "TS" && descriptor !== "SH") return null; // TS/SH 单独编报见 bare 注
  return { descriptor, phenomena, outOfOrder, bare: phenomena.length === 0 };
}

/** 天气组词身解析：VC 邻近 / -+ 强度 / 双字母组合切分。返回 null 表示不是合法天气组。
 *  signWithVc = 强度符与 VC 并存（-VCTSRA 家族，NWS 自动站实弹）：4678 限定槽四选一
 *  （light −/moderate 无符/heavy +/vicinity VC）、FAA AIM 明文互斥——tolerant 纪律下按切解
 *  收下（强度+邻近+现象语义可无损恢复，与 RATS→outOfOrder 容忍同构），由调用方出声。 */
export function parseWeatherBody(text: string): {
  intensity?: "-" | "+";
  proximity: boolean;
  descriptor?: WeatherDescriptor;
  phenomena: readonly WeatherPhenomenon[];
  outOfOrder: boolean;
  signWithVc: boolean;
} | null {
  let rest = text;
  let proximity = false;
  let signWithVc = false;
  if (rest.startsWith("VC")) {
    proximity = true;
    rest = rest.slice(2);
  }
  let intensity: "-" | "+" | undefined;
  const sign = rest.slice(0, 1);
  if (sign === "-" || sign === "+") {
    intensity = sign;
    rest = rest.slice(1);
    // 强度符后随 VC（-VCTSRA / -VCSH）：非规范词序（规范语序 VC 在最前、强度符与 VC 互斥）
    if (rest.startsWith("VC")) {
      proximity = true;
      signWithVc = true;
      rest = rest.slice(2);
    }
  }
  if (rest.length < 2 || rest.length % 2 !== 0) return null;
  const split = splitWeatherToken(rest);
  if (split === null) return null;
  // 裸 SH（无现象）仅在 VC 邻近形态合法（VCSH）；非 VC 的裸 SH 是坏组不收
  if (split.bare && split.descriptor === "SH" && !proximity) return null;
  return {
    intensity,
    proximity,
    descriptor: split.descriptor,
    phenomena: split.phenomena,
    outOfOrder: split.outOfOrder,
    signWithVc,
  };
}

/**
 * 解析天气组 token（含 RE 前缀 / VC 邻近 / -+ 强度）。
 * 返回 kind「current」仅当组进入当前天气列表；「recent」= RE 近期天气（另一组位，不参与 weather 三态）；
 * outOfOrder = 词身能切解但语序不合电码表；false = 不是天气组。
 */
/** 强度符适用面（WMO 306 表 4678 注 4）：降水全族可带 -/+；+SS/+FC/+DS 为 4678 表内合法电码
 *  （codes.wmo.int/306/4678 稳定概念：+DS heavy duststorm、+SS heavy sandstorm、+FC 发展完好
 *  漏斗云；加拿大差异版另有官方能见度判据 <5/16 SM）——表内形态照常收下、零告警；
 *  FMH-1 仅对降水族定义强度测定（美国实务不产 +DS），出处为 4678 电码表本身而非 FMH-1 容错。
 *  （2026-09-14 口径归位：旧注释称「+DS 由调用方出声」与实现不符——它本就是表内电码。） */
export const PRECIP_PHENOMENA = new Set<WeatherPhenomenon>([
  "RA",
  "SN",
  "SG",
  "IC",
  "PL",
  "GR",
  "GS",
  "UP",
]);
export function intensityAllowedFor(
  intensity: "-" | "+",
  phenomena: readonly WeatherPhenomenon[],
): boolean {
  if (phenomena.length > 0 && phenomena.every((x) => PRECIP_PHENOMENA.has(x))) return true;
  return intensity === "+" && phenomena.every((x) => x === "SS" || x === "FC" || x === "DS");
}

export function tryWeatherToken(
  t: Token,
  weather: WeatherGroup[],
  recent: WeatherGroup[],
):
  | {
      kind: "current" | "recent";
      outOfOrder: boolean;
      signWithVc: boolean;
      intensityMisuse?: boolean;
    }
  | false {
  const current = parseWeatherBody(t.text);
  if (current !== null) {
    const { outOfOrder, signWithVc, ...group } = current;
    weather.push({ ...group, span: spanOf(t) });
    return {
      kind: "current",
      outOfOrder,
      signWithVc,
      ...(current.intensity !== undefined &&
      !intensityAllowedFor(current.intensity, current.phenomena)
        ? { intensityMisuse: true }
        : {}),
    };
  }
  // RE 前缀（近期天气，15.13.2）：REFC = RE + FC；RE 组不带强度符（15.13.2.1）
  if (t.text.startsWith("RE")) {
    const recentBody = parseWeatherBody(t.text.slice(2));
    if (recentBody !== null) {
      const { outOfOrder, signWithVc: _signWithVc, ...group } = recentBody;
      recent.push({ ...group, span: spanOf(t) });
      return {
        kind: "recent",
        outOfOrder,
        signWithVc: false,
        ...(recentBody.intensity !== undefined ? { intensityMisuse: true } : {}),
      };
    }
  }
  return false;
}

/** 能见度解析结果三路：ok=有值；missing=显式缺测电码（//// 家族）；
 *  invalid=形态合法但值不可信（零分母 1/0SM——解码出 Infinity/NaN 的唯一入口），
 *  由调用方落 missing + value-out-of-range 告警（与 QNH 超界同款纪律，绝不留假值）。 */
export type VisibilityResult =
  | { readonly kind: "ok"; readonly group: VisibilityGroup; readonly consumed: number }
  | {
      readonly kind: "directional";
      readonly group: { readonly value: number; readonly direction: string; readonly span: Span };
      readonly consumed: number;
    }
  | { readonly kind: "missing"; readonly consumed: number }
  | {
      readonly kind: "invalid";
      readonly message: string;
      readonly span: Span;
      readonly consumed: number;
    };

/** 能见度：米制 4 位（可带 NDV 后缀）/ 美制 SM（含混分数跨 token 的预合并、P6SM 超上限）/ //// 缺测家族。 */
export function parseVisibilityToken(t: Token, next: Token | undefined): VisibilityResult | null {
  // 缺测家族两形态（与单位正交）：//// = 米制缺测；////SM = 英里制缺测（加拿大自动站，
  // RMK VIS MISG 佐证）——同为 visibility missing + missing-expected 告警（单位不进 missing 态）
  if (t.text === "////" || t.text === "////SM") return { kind: "missing", consumed: 1 };
  // NDV = No Directional Variation（无方向变化，加拿大自动站惯例后缀）——
  // 语义为「能见度各方向一致」，IR 无落点：剥离丢弃（原码经组 span 回溯），按 4 位主体正常解析
  // 最低能见度方向组（VNVNVNVNDv，如 1200NW）——须在 m4 之前判（带 1–2 位方位后缀）
  const mDir = /^(\d{4})(NE|NW|SE|SW|N|E|S|W)$/.exec(t.text);
  if (mDir !== null) {
    return {
      kind: "directional",
      group: {
        value: Number.parseInt(mDir[1] ?? "0", 10),
        direction: mDir[2] ?? "",
        span: spanOf(t),
      },
      consumed: 1,
    };
  }
  const m4 = /^(\d{4})(NDV)?$/.exec(t.text);
  if (m4 !== null) {
    const digits = m4[1] ?? "";
    const ceiling = digits === "9999";
    // 0000 = 下限编码（<100m，与 9999 上限编码同族）——非实测 0 米，exact=false + beyond below
    const floor = digits === "0000";
    return {
      kind: "ok",
      group: {
        value: Number.parseInt(digits, 10),
        unit: "m",
        exact: !ceiling && !floor,
        ...(ceiling ? { beyond: "above" as const } : {}), // 9999 = 10km 或以上（上限编码）
        ...(floor ? { beyond: "below" as const } : {}), // 0000 = 不足下限（下限编码）
        span: spanOf(t),
      },
      consumed: 1,
    };
  }
  // 混分数跨 token：`1 1/4SM`（裸整数 + 带分数 SM 是一个组）
  if (/^\d$/.test(t.text) && next !== undefined && /^\d\/\d+SM$/.test(next.text)) {
    const whole = Number.parseInt(t.text, 10);
    const parts = next.text.slice(0, -2).split("/");
    const num = parts[0];
    const den = parts[1];
    if (num === undefined || den === undefined) return null;
    if (Number(den) === 0) {
      // 零分母（1 0/0SM）：解码结果 Infinity/NaN——值不可信判缺测（span 覆盖整数与分数两个 token）
      return {
        kind: "invalid",
        message: `能见度混分数分母为零（${t.text} ${next.text}）——解码不出有限值，值不可信判缺测，原码经 span 回溯`,
        span: { start: t.start, end: next.end },
        consumed: 2,
      };
    }
    return {
      kind: "ok",
      group: {
        value: whole + Number(num) / Number(den),
        unit: "sm",
        exact: true,
        span: { start: t.start, end: next.end },
      },
      consumed: 2,
    };
  }
  const sm = /^(M|P)?(\d+)\/(\d+)SM$|^(M|P)?(\d+)SM$/.exec(t.text);
  if (sm !== null) {
    const prefix = sm[1] ?? sm[4];
    const below = prefix === "M";
    const above = prefix === "P"; // P6SM：6 英里以上（美式超上限，FAA/AF 口径）——exact=false，与 9999 同族
    const den = sm[3];
    if (den !== undefined && Number(den) === 0) {
      // 单 token 零分母（1/0SM、0/0SM、M1/0SM——0/0 解码出 NaN，同属值不可信）
      return {
        kind: "invalid",
        message: `能见度分数分母为零（${t.text}）——解码不出有限值，值不可信判缺测，原码经 span 回溯`,
        span: spanOf(t),
        consumed: 1,
      };
    }
    const value =
      sm[2] !== undefined ? Number(sm[2]) / Number(den) : Number.parseInt(sm[5] ?? "0", 10);
    // exact 语义统一：分数（1/2SM、1 1/4SM）与整数本身是精确值；
    // 阈值性编码（M 前缀小于下界、P 前缀大于上界、9999 上限）为 false，beyond 记方向
    return {
      kind: "ok",
      group: {
        value,
        unit: "sm",
        exact: !below && !above,
        ...(below ? { beyond: "below" as const } : {}),
        ...(above ? { beyond: "above" as const } : {}),
        span: spanOf(t),
      },
      consumed: 1,
    };
  }
  return null;
}

export interface WindParsed {
  group: WindGroup;
  consumed: number;
  /** 越界发现（风向位/变化组端点 >360°）：子项判缺测，由调用方落 value-out-of-range 告警 */
  rangeFindings: readonly { message: string; span: Span }[];
  /** 阵风位缺测（27010G//KT）：组照常成立、gust 不设，由调用方落 missing-expected info */
  gustMissing?: boolean;
}

/** 风：33002MPS / VRB02KT / 31015G25KT / /////KT 缺测形态 + 260V050 变化组。 */
export function parseWindToken(t: Token, next: Token | undefined): WindParsed | "missing" | null {
  if (/^\/{5}(KT|MPS|KMH)$/.test(t.text)) return "missing";
  // 部分缺测两形态（速度位 // / 阵风位 //，如 180//KT、27010G//KT）——此前整体落 unknown。
  // 超上限 P 前缀（P99KT/P49MPS，WMO 15.5.6 / AP-117 54 条）：值存原码、beyond 标注超界端
  const m =
    /^(VRB|\d{3}|\/\/\/)(\d{2,3}|P\d{2}|\/\/\/|\/\/)(?:G(\d{2,3}|P\d{2}|\/\/\/|\/\/))?(KT|MPS|KMH)$/.exec(
      t.text,
    );
  if (m === null) return null;
  const span = spanOf(t);
  const dirRaw = m[1] ?? "";
  const speedRaw = m[2] ?? "";
  const unitRaw = (m[4] ?? "kt").toLowerCase();
  if (!isSpeedUnit(unitRaw)) return null;
  if (dirRaw === "///" || speedRaw === "///" || speedRaw === "//") return "missing";
  const variable = dirRaw === "VRB";
  const gustRaw = m[3];
  const speedBeyond = speedRaw.startsWith("P") ? ("above" as const) : undefined;
  const gustBeyond =
    gustRaw !== undefined && gustRaw.startsWith("P") ? ("above" as const) : undefined;
  const rangeFindings: { message: string; span: Span }[] = [];
  // 风向位 0–360（正北可编 360、静风 000 编 0）：越界 = 值不可信 → 子项级判缺测（direction=null），
  // 风组其余子项（风速等）照常保留——两级建模：组内子项缺测 = 值字段 | null
  let direction: number | null = variable ? null : Number.parseInt(dirRaw, 10);
  if (!variable && direction !== null && direction > 360) {
    rangeFindings.push({
      message: `风向越界（${dirRaw}，须 0–360）——风向位判缺测，原码经 span 回溯`,
      span,
    });
    direction = null;
  }
  let consumed = 1;
  let variation: WindGroup["variation"];
  if (next !== undefined && /^\d{3}V\d{3}$/.test(next.text)) {
    const parts = next.text.split("V");
    const min = parts[0];
    const max = parts[1];
    if (min !== undefined && max !== undefined) {
      const minDeg = Number.parseInt(min, 10);
      const maxDeg = Number.parseInt(max, 10);
      if (minDeg > 360 || maxDeg > 360) {
        // 变化组端点同为风向数值（0–360）：任一越界即整组不可信 → 变化组判缺测（组已消费，不留假值）
        rangeFindings.push({
          message: `风向变化组端点越界（${next.text}，须 0–360）——变化组判缺测，原码经 span 回溯`,
          span: spanOf(next),
        });
      } else {
        variation = { min: minDeg, max: maxDeg, span: spanOf(next) };
      }
      consumed = 2;
    }
  }
  // 阵风位缺测双形态：G 后 // （两位斜杠——2 字符场的逐字符惯例）与 /// （三斜杠磨损多一位，
  // 同按缺测建模——任何规范都无三斜杠形态，最合理的来源是 G// 的传输磨损；2026-09-14 补建模：
  // 此前 /// 走 parseInt 产 NaN 零告警入 IR，穿透缺测路由/gustMissing/值域门三道防线）
  const gustMissing = gustRaw === "//" || gustRaw === "///";
  const group: WindGroup = {
    variable,
    direction,
    speed: {
      value: Number.parseInt(speedRaw.startsWith("P") ? speedRaw.slice(1) : speedRaw, 10),
      unit: unitRaw,
      span,
      ...(speedBeyond !== undefined ? { beyond: speedBeyond } : {}),
    },
    gust:
      gustRaw !== undefined && !gustMissing
        ? {
            value: Number.parseInt(gustRaw.startsWith("P") ? gustRaw.slice(1) : gustRaw, 10),
            unit: unitRaw,
            span,
            ...(gustBeyond !== undefined ? { beyond: gustBeyond } : {}),
          }
        : undefined,
    variation,
  };
  return { group, consumed, rangeFindings, ...(gustMissing ? { gustMissing: true } : {}) };
}

/**
 * Temperature/dewpoint group shape: always dd/dd (M = negative; // on either side = that side missing).
 * 温度/露点组形态：恒为 dd/dd（M = 负；任一侧 // = 该侧缺测）——两位是形态定义本身，不是惯例：
 * WMO 电码表每个符号字母严格对应一位数字（T' 十位 / T 个位，负值加 M），官方示例含补零（01/M12、
 * 00/M00），任何规范版本无一位数形态。两侧 \d{1,2} 曾让裸分数 token（VIS 词丢失的 1/2、2/1——
 * 上游脏输入）被误判为温露组：降序分数捏造假值且完全静默，升序触发误导性温露倒挂告警
 * （2026-09-14 复评收紧）；不匹配即落 unknown-token 出声，原码经 span 回溯。
 * The regex requires the `/` separator — a bare "//" is the weather missing group (see the body loop) and must not be swallowed here.
 * 正则必须有 `/` 分隔——裸 `//` 是天气缺测组（见正文循环），不得被本组吞掉。
 * Exported for direct shape assertions in regression tests (red line: "//" must not match; "1/2"/"2/1" must not match either).
 * 导出供回归测试直接对形态断言（红线：对 "//" 与裸分数均不得匹配）。
 */
export const TEMP_DEW_PATTERN = /^(M?\d{2}|\/\/)\/(M?\d{2}|\/\/)$/;

/** 温度/露点组：恒为 dd/dd 形态（M = 负；// = 缺测 → null，调用方补告警）。 */
export function parseTempDewToken(t: Token): {
  temperature: TemperatureReading | null;
  dewpoint: TemperatureReading | null;
  span: Span;
} | null {
  const read = (raw: string | undefined): TemperatureReading | null => {
    // undefined = 第二组整体缺失（FMH-1 12.6.10 露点缺测形态 24/）；"//" = 显式缺测——
    // 两者同为 null，但 missing-expected 文案由调用方按形态区分
    if (raw === undefined || raw === "//") return null;
    const n = raw.startsWith("M") ? -Number.parseInt(raw.slice(1), 10) : Number.parseInt(raw, 10);
    // −0 归一（M00 → 0）：负零序列化变形（JSON 出 -0），消费方 Object.is 判别出边角差异
    const celsius = n === 0 ? 0 : n;
    return { celsius, span: spanOf(t) };
  };
  const m = TEMP_DEW_PATTERN.exec(t.text);
  if (m === null) {
    // FMH-1 12.6.10 露点缺测形态「24/」（第二组整体省略，同恒两位）——裸 // 与 /// 仍不得匹配
    const trailing = /^(M?\d{2})\/$/.exec(t.text);
    if (trailing === null) return null;
    return { temperature: read(trailing[1]), dewpoint: null, span: spanOf(t) };
  }
  return { temperature: read(m[1]), dewpoint: read(m[2]), span: spanOf(t) };
}

export function beyondRangeOf(flag: string | undefined): "above" | "below" | undefined {
  if (flag === "P") return "above";
  if (flag === "M") return "below";
  return undefined;
}

/** RVR 组：R07R/1800V2200FT / R36/0500V0800D / P·M 超界 / 斜杠趋势（R13/3500FT/N、R07/P6000FT/U）。
 *  R/SNOCLO 与 R10L/SNOCLO 属跑道状态语义（15.13.6.1），由 parseRunwayStateToken 收口。 */
export function parseRvrToken(t: Token): RunwayVisualRange | null {
  // 趋势后缀双形态：无斜杠（0500V0800D，WMO）与斜杠（3500FT/N，FAA/加式——FT 单位标记后带 /D //N //U）
  const m = /^R(\d{2}[RLC]?)\/(P|M)?(\d{4})(?:V(P|M)?(\d{4}))?(FT)?(?:\/([DNU])|([DNU]))?$/.exec(
    t.text,
  );
  if (m === null) return null;
  const minRaw = m[3] ?? "0";
  const maxRaw = m[5];
  const trendRaw = m[7] ?? m[8];
  return {
    runway: m[1] ?? "",
    value: maxRaw === undefined ? Number.parseInt(minRaw, 10) : undefined,
    min: maxRaw !== undefined ? Number.parseInt(minRaw, 10) : undefined,
    max: maxRaw !== undefined ? Number.parseInt(maxRaw, 10) : undefined,
    beyondRange: beyondRangeOf(m[2] ?? m[4]),
    unit: m[6] === "FT" ? "ft" : "m",
    trend:
      trendRaw === "U"
        ? "up"
        : trendRaw === "D"
          ? "down"
          : trendRaw === "N"
            ? "no-change"
            : undefined,
    span: spanOf(t),
  };
}

/** 摩擦两位电码（15.13.6.1 表 0366）解码：01–90 → 摩擦系数 0.01–0.90；91–95 → 制动作用五档；
 *  99 → unreliable；// 或 96–98（电码表未用）→ 两字段皆 undefined（原码经 span 回溯）。 */
export function parseFrictionCode(
  code: string | undefined,
): Pick<RunwayStateGroup, "frictionCoefficient" | "brakingAction"> {
  if (code === undefined || !/^\d{2}$/.test(code)) return {};
  const f = Number.parseInt(code, 10);
  if (f <= 90) return { frictionCoefficient: f / 100 };
  if (f >= 91 && f <= 95)
    return {
      brakingAction: (["poor", "medium-poor", "medium", "medium-good", "good"] as const)[f - 91],
    };
  if (f === 99) return { brakingAction: "unreliable" };
  return {};
}

/** 跑道状态组三形态（WMO 15.13.6）：①六位状态电码（R21/490160：沉积/覆盖/深度/摩擦，位缺测 /）；
 *  ②CLRD 清除家族（R07L/CLRD// 标准、CLRD62 俄区、CLRD/// 非标容忍）；③SNOCLO 关闭（R/SNOCLO 全机场、R10L/SNOCLO 逐跑道）。
 *  覆盖位非法电码（表 0519 外数字）不静默留值：该位判缺测 + findings 交调用方落 invalid-format 告警。 */
export function parseRunwayStateToken(
  t: Token,
): { group: RunwayStateGroup; findings: readonly { message: string; span: Span }[] } | null {
  // ③ SNOCLO（15.13.6.1）：跑道因雪/冰/清雪不可用
  const snoclo = /^R(\d{2}[RLC]?)?\/SNOCLO$/.exec(t.text);
  if (snoclo !== null) {
    return {
      group: { runway: snoclo[1] ?? "", closed: true, cleared: false, span: spanOf(t) },
      findings: [],
    };
  }
  // ② CLRD 家族
  const clrd = /^R(\d{2}[RLC]?)\/CLRD(\d{2}|\/\/|\/\/\/)?$/.exec(t.text);
  if (clrd !== null) {
    return {
      group: {
        runway: clrd[1] ?? "",
        cleared: true,
        ...parseFrictionCode(clrd[2]),
        span: spanOf(t),
      },
      findings: [],
    };
  }
  // ① 六位状态电码：沉积物类型 1 位 + 覆盖范围 1 位 + 深度 2 位 + 摩擦 2 位（各可 / 缺报）
  const num = /^R(\d{2}[RLC]?)\/(\d|\/)(\d|\/)(\d{2}|\/\/)(\d{2}|\/\/)$/.exec(t.text);
  if (num === null) return null;
  const depthCode = num[4] ?? "";
  // 深度解码（15.13.6.1 表 1079）：00–90 = 毫米（00 即 <1mm 记 0）；91 未用判缺测；92–98 = 10–40cm 段记下限；
  // 99 = 跑道不可用（同 SNOCLO 语义 → closed，深度不落值）
  const depthNum = /^\d{2}$/.test(depthCode) ? Number.parseInt(depthCode, 10) : null;
  const depth =
    depthNum === null
      ? null
      : depthNum <= 90
        ? depthNum
        : depthNum === 91
          ? null
          : depthNum === 99
            ? null
            : (depthNum - 90) * 50;
  // 覆盖位电码合法性（15.13.6.1 表 0519）：表内仅 1/2/5/9 与 /——表外数字（0/3/4/6/7/8）为非法电码，
  // 按三态纪律判缺测（null）+ invalid-format 告警，绝不把表外值留在 IR（tgftp 实弹 R24/000062 命中位 2 的 0）
  const coverageCode = num[3] ?? "/";
  const coverageIllegal = coverageCode !== "/" && !"1259".includes(coverageCode);
  const findings: { message: string; span: Span }[] = coverageIllegal
    ? [
        {
          message: `跑道状态覆盖位电码非法（${t.text} 覆盖位 ${coverageCode}——WMO 表 0519 仅用 1/2/5/9 与 /）——该位判缺测，原码经 span 回溯`,
          span: spanOf(t),
        },
      ]
    : [];
  return {
    group: {
      runway: num[1] ?? "",
      closed: depthNum === 99 || undefined,
      cleared: false,
      deposit: num[2] === "/" ? null : Number(num[2]),
      coverage: coverageCode === "/" || coverageIllegal ? null : Number(coverageCode),
      depth,
      ...parseFrictionCode(num[5]),
      span: spanOf(t),
    },
    findings,
  };
}

// ———————————————— 组级纯函数（v0.2 批 0.1 抽取） ————————————————
// parse() 内的组级解析闭包/内联块迁出为模块级纯函数：游标位置（tokens+pos）与共享累加器
// （warnings/remarks）一律显式传参，不再闭包捕获 parse() 局部状态——目的：TAF 解析器
// （parseTaf，后续批次）复用组级逻辑。本迁移为零行为变化重构：解析语义、告警文案与
// 顺序、span、消费 token 数保持原样（全量语料回放快照锁定）。

/** 重复组告警（原 parse() 内 dupGroupWarning 闭包）：前值后值原文都进 message——
 *  last-wins 会覆盖 IR 里的前值 span，前值唯一可回溯通道就是这条告警。 */
export function warnDuplicateGroup(
  raw: string,
  warnings: ParseWarning[],
  label: string,
  prevSpan: Span | undefined,
  newSpan: Span | undefined,
): void {
  const prevText =
    prevSpan === undefined ? `（原${label}）` : raw.slice(prevSpan.start, prevSpan.end);
  const newText = newSpan === undefined ? label : raw.slice(newSpan.start, newSpan.end);
  warnings.push({
    code: "duplicate-group",
    severity: "warning",
    message: `重复${label}（前值 ${prevText}，后值 ${newText}）——报文只应有一组${label}，以末组为准，前值经原文回溯`,
    span: newSpan,
  });
}

/** 气压组落位（原 parse() 内 setAltimeter 闭包）：末组为准（last-wins），重复组追加告警不静默；
 *  返回新的（altimeter, altimeterSeen）二元组交调用方落位。 */
export function applyAltimeterReading(
  altimeter: AltimeterReading | undefined,
  altimeterSeen: boolean,
  reading: AltimeterReading,
  raw: string,
  warnings: ParseWarning[],
): { altimeter: AltimeterReading | undefined; altimeterSeen: boolean } {
  if (altimeterSeen) {
    warnDuplicateGroup(raw, warnings, "气压组", altimeter?.span, reading.span);
  }
  return { altimeter: reading, altimeterSeen: true };
}

/** QNH 组解析结果：ok = 可信读数；out-of-range = 值不可信（5 位数或物理范围外，
 *  Q10054 家族脏值），由调用方判缺测 + value-out-of-range 告警；null = 非 Q 组形态。 */
export type AltimeterTokenResult =
  | { readonly kind: "ok"; readonly reading: AltimeterReading }
  | { readonly kind: "out-of-range"; readonly message: string; readonly span: Span };

/** Q（hPa）组：5 位数 QNH 与物理范围外值 = 脏值（Q10054 家族）——绝不静默留假值。 */
export function parseQnhToken(t: Token): AltimeterTokenResult | null {
  const qM = /^Q(\d{4,5})$/.exec(t.text);
  if (qM === null) return null;
  const digits = qM[1] ?? "";
  const hpa = Number.parseInt(digits, 10);
  if (digits.length === 5 || hpa < QNH_HPA_MIN || hpa > QNH_HPA_MAX) {
    return {
      kind: "out-of-range",
      message: `QNH 超出可信范围（${t.text}，合理区间 ${QNH_HPA_MIN}–${QNH_HPA_MAX} hPa）——值不可信判缺测，原码经 span 回溯`,
      span: spanOf(t),
    };
  }
  return { kind: "ok", reading: { value: hpa, unit: "hPa", span: spanOf(t) } };
}

/** A（inHg，隐含小数点）组：物理范围外值判缺测，同 QNH 纪律。 */
export function parseAltimeterAToken(t: Token): AltimeterTokenResult | null {
  const aM = /^A(\d{4})$/.exec(t.text);
  if (aM === null) return null;
  const inhg = Number.parseInt(aM[1] ?? "0", 10) / 100;
  if (inhg < ALT_INHG_MIN || inhg > ALT_INHG_MAX) {
    return {
      kind: "out-of-range",
      message: `高度表设定超出可信范围（${t.text} → ${inhg} inHg，合理区间 ${ALT_INHG_MIN}–${ALT_INHG_MAX}）——值不可信判缺测，原码经 span 回溯`,
      span: spanOf(t),
    };
  }
  return { kind: "ok", reading: { value: inhg, unit: "inHg", span: spanOf(t) } };
}

/** 风组落位与值域校验（原正文循环风组分支内联块，非缺测路径）：NaN 终结防线、三位数
 *  模板上限门（>199 判缺测）、风向/变化组端点越界 findings、阵风缺测 info、VRB 与变化组
 *  并存 cross-check——告警顺序与原分支逐条一致（rangeFindings → gustMissing → VRB 变化组）。 */
export function validateWindGroup(
  t: Token,
  windParsed: WindParsed,
  raw: string,
): { wind: Observed<WindGroup>; warnings: ParseWarning[] } {
  const wg = windParsed.group;
  // 风速模板上限：三位数（≤199，WMO 15.5.6「100 单位以上以精确位数替代两位电码」注至
  // 199；FMH-1 12.6.5.a「two or three digits」）——超 199 即非规范报文（270250KT 构造探针），
  // 按 QNH 超界同款纪律整组不可信判缺测，绝不静默留假值。P 前缀超上限形态（P99KT）合法
  // NaN 终结防线（终结断言，预期不可达）：任何数值入口产 NaN 即整组不可信判缺测。
  // NaN 恰是现有防线的双重盲区——值域门 >199 对 NaN 恒 false、JSON.stringify 消 NaN 为
  // null、fuzz 不变量（2026-09-14 实弹 G/// 之前）无有限性检查——故独立成支并配哨兵不变量
  if (
    !Number.isFinite(wg.speed.value) ||
    (wg.gust !== undefined && !Number.isFinite(wg.gust.value))
  ) {
    return {
      wind: { kind: "missing", span: spanOf(t) },
      warnings: [
        {
          code: "value-out-of-range",
          severity: "warning",
          message: `风组解码出非有限值（${t.text}）——值不可信判缺测，原码经 span 回溯`,
          span: spanOf(t),
        },
      ],
    };
  }
  if (wg.speed.value > 199 || (wg.gust?.value ?? 0) > 199) {
    return {
      wind: { kind: "missing", span: spanOf(t) },
      warnings: [
        {
          code: "value-out-of-range",
          severity: "warning",
          message: `风速超出编码范围（${t.text}，三位数模板上限 199 ${wg.speed.unit}）——值不可信判缺测，原码经 span 回溯`,
          span: spanOf(t),
        },
      ],
    };
  }
  const found: ParseWarning[] = [];
  for (const finding of windParsed.rangeFindings) {
    found.push({
      code: "value-out-of-range",
      severity: "warning",
      message: finding.message,
      span: finding.span,
    });
  }
  if (windParsed.gustMissing === true) {
    found.push({
      code: "missing-expected",
      severity: "info",
      // 缺测电码双形态（G// 标准两位 / G/// 磨损三斜杠）直出原文
      message: `阵风位缺测（${t.text}——G 后斜杠位缺测，组照常成立）`,
      span: spanOf(t),
    });
  }
  if (wg.variable && wg.variation !== undefined) {
    const vs = wg.variation.span;
    found.push({
      code: "cross-check-conflict",
      severity: "info",
      message: `静风变向（VRB）与风向变化组（${
        vs === undefined ? "" : raw.slice(vs.start, vs.end)
      }）并存——VRB 本义方向不定，变化组冗余，报文自洽性存疑`,
      span: vs,
    });
  }
  return { wind: { kind: "value", value: wg, span: spanOf(t) }, warnings: found };
}

/** 能见度组落位（原正文循环能见度分支内联块）：方向组挂靠/脱离主导、缺测不顶替在场值、
 *  零分母 invalid 判缺测、ok 落值——返回新的（visibility, directionalAsPrimary）二元组。 */
export function applyVisibilityToken(
  t: Token,
  visParsed: VisibilityResult,
  state: { visibility: Observed<VisibilityGroup> | undefined; directionalAsPrimary: boolean },
  raw: string,
  warnings: ParseWarning[],
): { visibility: Observed<VisibilityGroup> | undefined; directionalAsPrimary: boolean } {
  const visibility = state.visibility;
  const directionalAsPrimary = state.directionalAsPrimary;
  // 最低能见度方向组（WMO 15.6.2）：挂到已存主导能见度（非重复组不出 duplicate 告警）；
  // 脱离主导能见度单独出现属非规范形态——按能见度收下 + info 出声。
  // directionalAsPrimary = 脱离主导的方向组被按主导收下（非规范状态，解析器局部标记）——
  // 其后再来的方向组是「连挂第二枚」（1200NW 1200NE），同样出声不静默
  //（2026-09-14 独立复评补齐：此前连挂时第二枚静默覆写第一枚）
  if (visParsed.kind === "directional") {
    if (visibility?.kind === "value") {
      if (visibility.value.minimum !== undefined || directionalAsPrimary) {
        warnDuplicateGroup(
          raw,
          warnings,
          "最低能见度方向组",
          visibility.value.minimum?.span,
          spanOf(t),
        );
      }
      return {
        visibility: {
          kind: "value",
          value: {
            ...visibility.value,
            minimum: {
              value: visParsed.group.value,
              direction: visParsed.group.direction,
              span: visParsed.group.span,
            },
          },
          span: visibility.span,
        },
        directionalAsPrimary,
      };
    }
    warnings.push({
      code: "invalid-format",
      severity: "info",
      message: `最低能见度方向组脱离主导能见度（${t.text}）——按能见度收下`,
      span: spanOf(t),
    });
    return {
      visibility: {
        kind: "value",
        value: {
          value: visParsed.group.value,
          unit: "m",
          exact: true,
          span: visParsed.group.span,
        },
      },
      directionalAsPrimary: true,
    };
  }
  if (visibility !== undefined) {
    warnDuplicateGroup(raw, warnings, "能见度组", visibility.span, spanOf(t));
  }
  if (visParsed.kind === "missing") {
    // 已有能见度组时：缺测电码不顶替在场值（duplicate-group 已出声）——
    // 后位 ////（温露位畸形/错位落点）按 last-wins 把 9999 冲成 missing 是纯信息损失
    //（2026-09-15 五角色评测批；WMO 正常报文能见度缺测只出现在能见度槽位，此形态仅见于错位/磨损报文）
    if (visibility === undefined) {
      warnings.push({
        code: "missing-expected",
        severity: "info",
        // 缺测电码两形态直出原文（//// 米制 / ////SM 英里制——加拿大自动站，RMK VIS MISG 佐证）
        message: `能见度组缺测（${t.text}，无法观测能见度）`,
        span: spanOf(t),
      });
      return { visibility: { kind: "missing", span: spanOf(t) }, directionalAsPrimary: false };
    }
    return { visibility, directionalAsPrimary: false };
  }
  if (visParsed.kind === "invalid") {
    warnings.push({
      code: "value-out-of-range",
      severity: "warning",
      message: visParsed.message,
      span: visParsed.span,
    });
    return {
      visibility: { kind: "missing", span: visParsed.span },
      directionalAsPrimary: false,
    };
  }
  return {
    visibility: { kind: "value", value: visParsed.group, span: visParsed.group.span },
    directionalAsPrimary: false,
  };
}

/** 温度读数物理极值门（世界极值 ±裕量，与 QNH 世界极值门同款纪律）。 */
export const tempOutOfRange = (r: TemperatureReading | null): boolean =>
  r !== null && (r.celsius < TEMP_C_MIN || r.celsius > TEMP_C_MAX);

/** 温度/露点组落位（原正文循环温露分支内联块）：重复组告警、全缺测不顶替在场值、
 *  物理极值门（双侧同超界合并一条告警）、显式缺测 info、温露倒挂 cross-check——
 *  返回新的（temperature, dewpoint）二元组。 */
export function applyTempDewToken(
  t: Token,
  tempParsed: {
    temperature: TemperatureReading | null;
    dewpoint: TemperatureReading | null;
    span: Span;
  },
  state: { temperature: TemperatureReading | undefined; dewpoint: TemperatureReading | undefined },
  raw: string,
  warnings: ParseWarning[],
): { temperature: TemperatureReading | undefined; dewpoint: TemperatureReading | undefined } {
  const temperature = state.temperature;
  const dewpoint = state.dewpoint;
  const dupTemp = temperature !== undefined || dewpoint !== undefined;
  if (dupTemp) {
    warnDuplicateGroup(
      raw,
      warnings,
      "温度组",
      temperature?.span ?? dewpoint?.span,
      tempParsed.span,
    );
  }
  // 已有温露组时：全缺测电码（/////）不顶替在场值（duplicate-group 已出声）——
  // 零信息量形态覆盖真实观测是纯信息损失；带部分值的形态（如 12//）照常 last-wins
  if (dupTemp && tempParsed.temperature === null && tempParsed.dewpoint === null) {
    return { temperature, dewpoint };
  }
  // 温度物理极值门（与 QNH 同款纪律）：超可信范围判缺测 + value-out-of-range，
  // 绝不静默留假值；双侧同时超界合并为一条告警（M91/M95 不重复出声）；
  // 显式缺测（//）另发 missing-expected，两告警互不替代
  const rawTemp = tempParsed.temperature;
  const rawDew = tempParsed.dewpoint;
  const outT = tempOutOfRange(rawTemp);
  const outD = tempOutOfRange(rawDew);
  if (outT || outD) {
    const single = outT ? rawTemp : rawDew;
    const span = outT && outD ? tempParsed.span : single?.span;
    const shown = span === undefined ? `${TEMP_C_MIN}` : raw.slice(span.start, span.end);
    warnings.push({
      code: "value-out-of-range",
      severity: "warning",
      message: `温度超出可信范围（${shown}，合理区间 ${TEMP_C_MIN}–${TEMP_C_MAX}°C）——值不可信判缺测，原码经 span 回溯`,
      span,
    });
  }
  const gatedTemperature = outT ? undefined : (rawTemp ?? undefined);
  const gatedDewpoint = outD ? undefined : (rawDew ?? undefined);
  if (rawTemp === null || rawDew === null) {
    warnings.push({
      code: "missing-expected",
      severity: "info",
      // 形态判别精确到正则（2026-09-14 独立复评收口：endsWith("/") 会把 12// 的标准
      // 缺测与 12/// 的磨损形都误述为 24/ 形态）
      message: /^M?\d{2}\/$/.test(t.text)
        ? "露点位缺测（24/ 形态，FMH-1 12.6.10）"
        : "温度/露点位缺测（//）",
      span: tempParsed.span,
    });
  }
  // 交叉校验：露点不可能高于温度（相对湿度 >100% 物理不可能）——典型传感器故障形态。
  // 两组值照常保留（含 M 负值），矛盾交由告警呈现，绝不静默也不捏造
  if (
    gatedTemperature !== undefined &&
    gatedDewpoint !== undefined &&
    gatedTemperature.celsius < gatedDewpoint.celsius
  ) {
    warnings.push({
      code: "cross-check-conflict",
      severity: "warning",
      message: `温度低于露点（${t.text}）——物理不可能，疑似传感器故障`,
      span: tempParsed.span,
    });
  }
  return { temperature: gatedTemperature, dewpoint: gatedDewpoint };
}

/** 趋势段收口出声（原 parse() 内 trendCloseWarning 闭包）：R 组收口（RVR/跑道状态不属趋势
 *  要素）沿用既有口径出声；其余非趋势组收口（温露/QNH/WS/TX/TN/RVRNO/无法认领 token 等）
 *  同样出声 info：该组交回正文循环认组（typed 语义无损恢复，冲突自然触发重复组告警），
 *  但趋势语境存疑须可观测——不静默。RMK/RMK 粘连与趋势指示组切换（含粘连形
 *  BECMGAT0130——它本身就是趋势指示组，下一步由正文粘连分支认领）、以及规范报尾位 $
 *  （FMH-1：$ 为整报最后一组，趋势段后随 $ 属规范位置）不出声（2026-09-14 独立复评补豁免）。 */
export function warnTrendClose(
  tokens: readonly Token[],
  pos: number,
  warnings: ParseWarning[],
): void {
  const btTok = tokens[pos];
  const bt = btTok?.text;
  if (bt === undefined || btTok === undefined) return;
  if (TREND_KINDS.has(bt) || bt.startsWith("RMK") || bt === "$") return;
  if (/^(BECMG|TEMPO)(AT|TL|FM)\d{4}$/.test(bt)) return; // 粘连指示组：由正文粘连分支认领
  if (/^R(\d{2}[RLC]?\/|\/SNOCLO$)/.test(bt)) {
    warnings.push({
      code: "invalid-format",
      severity: "info",
      message: `趋势段收口于 R 组（${bt}——RVR/跑道状态不属趋势要素，按正文组处理，趋势语境存疑）`,
      span: spanOf(btTok),
    });
    return;
  }
  warnings.push({
    code: "invalid-format",
    severity: "info",
    message: `趋势段收口于非趋势组（${bt}——不属趋势要素族，交回正文认组，趋势语境存疑）`,
    span: spanOf(btTok),
  });
}

/** 趋势段收组（原 parse() 内 collectTrendTokens 闭包）：仅封闭清单内 token 收进 collected
 *  （判据见 isTrendCollectible），其余留在收口位置交回正文循环——三处收集入口
 *  （指示组/粘连/裸时段词）共用一份循环防漂移；返回收口位置。 */
export function collectTrendSegment(
  tokens: readonly Token[],
  pos: number,
  collected: Token[],
): number {
  let idx = pos;
  for (;;) {
    const inner = tokens[idx];
    if (inner === undefined || !isTrendCollectible(inner, tokens[idx + 1])) break;
    collected.push(inner);
    idx += 1;
  }
  return idx;
}

/** 趋势段构造（三形态共用尾半段：标准指示组/粘连/裸时段词分支）：要素结构化复用
 *  structureTrendElements；NOSIG 不做要素结构化（原分支口径），elementsStart 为
 *  结构化起始下标（跳过已收下的指示组/时段词 token）。 */
export function buildTrendGroup(
  kind: TrendGroup["kind"],
  period: TrendGroup["period"],
  collected: readonly Token[],
  elementsStart: number,
): TrendGroup {
  const elements = kind === "nosig" ? undefined : structureTrendElements(collected, elementsStart);
  return {
    kind,
    period,
    ...(elements !== undefined ? { elements } : {}),
    raw: collected.map((c) => c.text).join(" "),
    span: joinSpan(collected),
  };
}

/** 云层组元素构造（原正文循环云层分支内联块）：云量/云高/云型缺测位告警随构造直出；
 *  null = 非云层组形态。趋势段的云层构造为静默口径（structureTrendElements）——
 *  两处行为刻意不同（正文出声、趋势保真静默），不合并。 */
export function cloudLayerElementOf(t: Token, warnings: ParseWarning[]): CloudElement | null {
  const cloudM = CLOUD_LAYER_PATTERN.exec(t.text);
  if (cloudM === null) return null;
  const amountRaw = cloudM[1];
  const heightRaw = cloudM[2];
  const convectiveRaw = cloudM[3];
  const typeMissing = cloudM[4] !== undefined;
  const amountMissing = amountRaw === "///";
  const heightMissing = heightRaw === "///";
  if (heightMissing) {
    warnings.push({
      code: "missing-expected",
      severity: "info",
      message: "云高缺测（///），不捏造基高",
      span: spanOf(t),
    });
  }
  if (amountMissing) {
    warnings.push({
      code: "missing-expected",
      severity: "info",
      message: "云量位缺测（///），探测到云但云量无法观测",
      span: spanOf(t),
    });
  }
  if (typeMissing) {
    warnings.push({
      code: "missing-expected",
      severity: "info",
      message: "云型位缺测（///）",
      span: spanOf(t),
    });
  }
  return {
    kind: "layer",
    amount: amountRaw !== undefined && isCloudAmount(amountRaw) ? amountRaw : null,
    heightFt: {
      value:
        heightRaw !== undefined && heightRaw !== "///"
          ? Number.parseInt(heightRaw, 10) * 100
          : null,
      span: spanOf(t),
    },
    convective:
      convectiveRaw !== undefined && isConvective(convectiveRaw) ? convectiveRaw : undefined,
    span: spanOf(t),
  };
}

/** VV（垂直能见度）元素构造（原正文循环 VV 分支内联块）：缺测电码形态告警、合法数值组
 *  （VV002 = 垂直能见度 200ft）零告警；null = 非 VV 组形态。 */
export function verticalVisibilityElementOf(
  t: Token,
  warnings: ParseWarning[],
): CloudElement | null {
  const vvM = VV_PATTERN.exec(t.text);
  if (vvM === null) return null;
  const heightRaw = vvM[1];
  if (heightRaw === undefined || heightRaw === "///") {
    warnings.push({
      code: "missing-expected",
      severity: "info",
      message:
        heightRaw === "///"
          ? "垂直能见度缺测（VV///，天空全遮蔽但垂直能见度不可测）"
          : "垂直能见度缺测（VV，兼容形态）",
      span: spanOf(t),
    });
  }
  return {
    kind: "vertical-visibility",
    heightFt: {
      value:
        heightRaw === undefined || heightRaw === "///"
          ? null
          : Number.parseInt(heightRaw, 10) * 100,
      span: spanOf(t),
    },
    span: spanOf(t),
  };
}

/** 风切变组识别（原正文循环 WS 分支内联块，四形态：WS ALL RWY / WS RWY ALL /
 *  WS RWY##[RLC] / WS R##[RLC]）：返回识别出的跑道号（或全跑道旗标）、组 span 与消费
 *  token 数；null = 非风切变组（正文循环继续后续分支）。多组累积（runways 连接、
 *  span 首组至末组）由调用方合并。 */
export interface WindShearMatch {
  readonly runway: string | null;
  readonly all: boolean;
  readonly span: Span;
  readonly consumed: number;
}

export function parseWindShearSequence(
  t: Token,
  tok1: Token | undefined,
  tok2: Token | undefined,
): WindShearMatch | null {
  const designator = tok1 !== undefined ? /^RWY(\d{2}[RLC]?)$/.exec(tok1.text) : null;
  const stdDesignator = tok1 !== undefined ? /^R(\d{2}[RLC]?)$/.exec(tok1.text) : null;
  // 全跑道两形态：标准 WS ALL RWY 与词序倒置变体 WS RWY ALL
  const isAll =
    (tok1?.text === "ALL" && tok2?.text === "RWY") ||
    (tok1?.text === "RWY" && tok2?.text === "ALL");
  if (designator === null && stdDesignator === null && !isAll) return null;
  const endTok = isAll ? tok2 : tok1;
  const startSpan = spanOf(t);
  const endSpan = endTok !== undefined ? spanOf(endTok) : startSpan;
  return {
    runway:
      designator !== null
        ? (designator[1] ?? "")
        : stdDesignator !== null
          ? (stdDesignator[1] ?? "")
          : null,
    all: isAll,
    span: { start: startSpan.start, end: endSpan.end },
    consumed: isAll ? 3 : 2,
  };
}

/** RVRNO 落位（正文位，原正文循环 RVRNO 分支内联块）：与 RVR 值组并存 = 矛盾形态出声、
 *  值组按跑道级明细保留；否则 rvr 显式缺测 + missing-expected；remarks 一律留痕 rvr-no。
 *  返回新的 rvr 值。 */
export function applyRvrNoBodyToken(
  t: Token,
  rvr: Observed<readonly RunwayVisualRange[]> | undefined,
  raw: string,
  warnings: ParseWarning[],
  remarks: RemarkGroup[],
): Observed<readonly RunwayVisualRange[]> | undefined {
  let next = rvr;
  if (rvr?.kind === "value") {
    const prevText = rvr.span === undefined ? "" : raw.slice(rvr.span.start, rvr.span.end);
    warnings.push({
      code: "cross-check-conflict",
      severity: "info",
      message: `RVRNO（站级：应报而缺）与 RVR 值组并存（${prevText}）——矛盾形态，值组按跑道级明细保留，RVRNO 经 remarks/raw 可回溯`,
      span: spanOf(t),
    });
  } else {
    warnings.push({
      code: "missing-expected",
      severity: "info",
      message: "RVR 设备在但明示不可用（RVRNO）",
      span: spanOf(t),
    });
    next = { kind: "missing", span: spanOf(t) };
  }
  remarks.push({ kind: "rvr-no", raw: t.text, span: spanOf(t) });
  return next;
}

/** 反向次序矛盾出声（RVRNO 在前、值组在后，原 RVR 值组分支内联块）：可解读为传感器恢复，
 *  值组按明细保留——与正序矛盾并存同一文案口径（见 applyRvrNoBodyToken 注释）。 */
export function warnRvrNoThenValues(
  t: Token,
  prevSpan: Span | undefined,
  raw: string,
  warnings: ParseWarning[],
): void {
  const prevText = prevSpan === undefined ? "" : raw.slice(prevSpan.start, prevSpan.end);
  warnings.push({
    code: "cross-check-conflict",
    severity: "info",
    message: `RVRNO（站级：应报而缺）与后随 RVR 值组并存（${prevText}）——矛盾形态，值组按跑道级明细保留（可解读为传感器恢复），RVRNO 经 remarks/raw 可回溯`,
    span: spanOf(t),
  });
}

/** RVR 全斜杠缺测（R##/#### 标准 5 斜杠与磨损 4 斜杠形态，原正文循环内联块）：判缺测 +
 *  missing-expected（4 斜杠另附磨损 info）；null = 非本组形态。
 *  依据：WMO 306 FM15 RVR 值位恒四位（VRVRVRVR），全斜杠即数值缺测（斜杠逐位填充的缺测惯例）。 */
export function applyRvrSlashToken(
  t: Token,
  warnings: ParseWarning[],
): Observed<readonly RunwayVisualRange[]> | null {
  const rvrSlash = /^R\d{2}[RLC]?(\/{4,5})$/.exec(t.text);
  if (rvrSlash === null) return null;
  warnings.push({
    code: "missing-expected",
    severity: "info",
    message: `RVR 组缺测（${t.text}——跑道号在位、视程值位全斜杠）`,
    span: spanOf(t),
  });
  if ((rvrSlash[1] ?? "").length === 4) {
    warnings.push({
      code: "invalid-format",
      severity: "info",
      message: `RVR 缺测段磨损（${t.text}——4 位斜杠对标准 5 位（分离符 + 四位值位），少一位；按缺测收下）`,
      span: spanOf(t),
    });
  }
  return { kind: "missing", span: spanOf(t) };
}

/** 当前天气三态收口（原正文循环后内联块）：仅有实组时给值；RE-only 报文 weather 保持
 *  undefined（组省略 ≠ 缺测）；组级 span 首组至末组。 */
export function observedWeatherOf(
  weatherList: readonly WeatherGroup[],
): Observed<readonly WeatherGroup[]> | undefined {
  if (weatherList.length === 0) return undefined;
  const first = weatherList[0];
  const last = weatherList[weatherList.length - 1];
  if (first !== undefined && last !== undefined) {
    return {
      kind: "value",
      value: [...weatherList],
      span:
        first.span !== undefined && last.span !== undefined
          ? { start: first.span.start, end: last.span.end }
          : undefined,
    };
  }
  return undefined;
}

/** CAVOK 交叉校验的正文状态快照（cavokCrossCheck 入参，批 0.1 显式化）。 */
export interface CavokCrossCheckState {
  readonly cavokSpan: Span | undefined;
  readonly visibility: Observed<VisibilityGroup> | undefined;
  readonly weatherList: readonly WeatherGroup[];
  readonly rvr: Observed<readonly RunwayVisualRange[]> | undefined;
  readonly cloudElements: readonly CloudElement[];
}

/** CAVOK 三面交叉校验（能见度/天气/云，原 parse() 内 cavokConflicts 闭包）。词位时对
 *  「前序」组校验；正文循环收口后对「后续」组再校验——CAVOK 让位发生在词位，其后再出现
 *  的矛盾组此前静默并存（CAVOK BKN012 形态）。判据词位/词后完全一致：确定矛盾才告警
 *  （下界编码/真值天气/低云或对流云；缺测云高不判）。告警 span 统一指 CAVOK 词位
 *  （既有契约：矛盾双方中「主张」所在）。 */
export function cavokCrossCheck(
  state: CavokCrossCheckState,
  whenLabel: string,
  raw: string,
  warnings: ParseWarning[],
): void {
  const at = state.cavokSpan;
  const visibility = state.visibility;
  if (visibility?.kind === "value") {
    const g = visibility.value;
    const meters = g.unit === "m" ? g.value : g.value * 1609.344;
    const visRaw =
      visibility.span === undefined
        ? `${g.value} ${g.unit}`
        : raw.slice(visibility.span.start, visibility.span.end);
    const definitelyBelow =
      g.beyond === "below" ||
      (g.unit === "sm" && visRaw.startsWith("M")) ||
      (g.exact && meters < 10_000);
    if (definitelyBelow) {
      warnings.push({
        code: "cross-check-conflict",
        severity: "warning",
        message: `CAVOK 与${whenLabel}能见度组矛盾（${visRaw}，CAVOK 语义要求 ≥10km）——让位照旧，报文自洽性存疑`,
        span: at,
      });
    }
  }
  if (state.weatherList.length > 0) {
    const wxRaw = state.weatherList
      .map(
        (g) =>
          `${g.proximity ? "VC" : ""}${g.intensity ?? ""}${g.descriptor ?? ""}${g.phenomena.join("")}`,
      )
      .join(" ");
    warnings.push({
      code: "cross-check-conflict",
      severity: "warning",
      message: `CAVOK 与${whenLabel}天气组矛盾（${wxRaw}，CAVOK 语义要求无重要天气）——让位照旧，报文自洽性存疑`,
      span: at,
    });
  }
  if (state.rvr !== undefined && state.rvr.kind === "value") {
    const rvrRaw =
      state.rvr.span === undefined ? "" : raw.slice(state.rvr.span.start, state.rvr.span.end);
    warnings.push({
      code: "cross-check-conflict",
      severity: "warning",
      message: `CAVOK 与${whenLabel}RVR 组矛盾（${rvrRaw}——AP-117 第 140 条：CAVOK 代替能见度、跑道视程、现在天气和云）——让位照旧，报文自洽性存疑`,
      span: at,
    });
  }
  const cloudConflict = state.cloudElements.some((e) => {
    if (e.kind === "layer" && e.convective !== undefined) return true;
    const h = e.heightFt.value;
    return h !== null && h < 5_000;
  });
  if (cloudConflict) {
    const cloudRaw = state.cloudElements
      .map(
        (e) =>
          `${e.kind === "layer" ? (e.amount ?? "///") : "VV"}${
            e.heightFt.value === null
              ? "///"
              : String(Math.round(e.heightFt.value / 100)).padStart(3, "0")
          }${e.kind === "layer" ? (e.convective ?? "") : ""}`,
      )
      .join(" ");
    warnings.push({
      code: "cross-check-conflict",
      severity: "warning",
      message: `CAVOK 与${whenLabel}云组矛盾（${cloudRaw}，CAVOK 语义要求 5000ft 以下无云且无 CB/TCU）——让位照旧，报文自洽性存疑`,
      span: at,
    });
  }
}

/** RMK 段整体（原 parse() 内 RMK while 循环迁出）：认组粒度收下 FMH-1 附加信息与俄区
 *  国家组，未知 ≠ 错误（不进 warnings，收 'unknown' remark）；RVRNO 在 RMK 位与正文位
 *  同口径（并存矛盾出声、值组明细保留）。游标（tokens+start）与累加器（remarks/warnings）
 *  显式传参；返回 rvr 终态与段末位置。 */
export function parseRemarkSegment(
  tokens: readonly Token[],
  start: number,
  raw: string,
  remarks: RemarkGroup[],
  warnings: ParseWarning[],
  rvrIn: Observed<readonly RunwayVisualRange[]> | undefined,
): { rvr: Observed<readonly RunwayVisualRange[]> | undefined; next: number } {
  let rvr = rvrIn;
  let i = start;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === undefined) break;
    const text = t.text;
    const push = (remarkKind: RemarkKind, consumed = 1): void => {
      const slice = tokens.slice(i, i + consumed);
      remarks.push({
        kind: remarkKind,
        raw: slice.map((c) => c.text).join(" "),
        span: joinSpan(slice),
      });
      i += consumed;
    };

    if (text === "AO1" || text === "AO2" || text === "A01" || text === "A02") {
      // A01/A02 数字形态：tgftp 通路实弹 268 站次（与 FMH-1 字母形态 AO1/AO2 并存）
      push("auto-type");
      continue;
    }
    if (/^SLP(\d{3}|NO)$/.test(text)) {
      push("sea-level-pressure");
      continue;
    }
    if (/^T[01]\d{7}(T[01]\d{7})?$/.test(text) || /^T[01]\d{3}$/.test(text)) {
      push("precise-temperature");
      continue;
    }
    if (/^P\d{4}$/.test(text)) {
      push("precip-1h");
      continue;
    }
    if (/^[67](?:\d{4}|\/{4})$/.test(text)) {
      // 6/7 组降水窗口（3/24h）：量值 4 位；//// = 窗口降水缺测（FMH-1 实弹 6////，tgftp 语料 17 处）
      push("precip-window");
      continue;
    }
    if (/^4\/\d{3}$/.test(text)) {
      push("snow-depth");
      continue;
    }
    if (/^I[136]\d{3}$/.test(text)) {
      // FMH-1 冰积组 = I + 间隔位(1/3/6h) + 3 位量值（I1001 → 1 小时 0.01 英寸）；
      // 旧正则 \d{4} 多吞一位致 I1001 形态全数落 unknown（2026-09-12 复评命中）
      push("ice-accretion");
      continue;
    }
    if (/^5[0-8]\d{3}$/.test(text)) {
      push("pressure-tendency");
      continue;
    }
    // 24h 温度极值组：现行 FMH-1 为 9 位（4 + 最高[符号位 3 位] + 最低[符号位 3 位]，
    // 如 401280089 = 最高 +12.8 / 最低 +8.9；符号位 1 = 负），IEM/tgftp 实弹全数 9 位；
    // 8 位旧形态兼容保留
    if (/^4(?:[01]\d{3}[01]\d{3}|\d{7})$/.test(text)) {
      push("temp-extrema-24h");
      continue;
    }
    if (/^[12]\d{4}$/.test(text)) {
      push("temp-extrema-6h");
      continue;
    }
    if (text === "PK" && tokens[i + 1]?.text === "WND") {
      push("peak-wind", 3);
      continue;
    }
    if (text === "WSHFT" && tokens[i + 1] !== undefined) {
      push("wind-shift", 2);
      continue;
    }
    if (text === "PRESRR" || text === "PRESFR") {
      push("pressure-change");
      continue;
    }
    if (text === "VISNO") {
      push("vis-no");
      continue;
    }
    if (text === "TSNO") {
      // TSNO（美网高频）：雷暴传感器不工作——雷暴探测不可用（≠无雷暴），认组不再 unknown
      push("thunderstorm-sensor");
      continue;
    }
    if (text === "RVRNO") {
      // RMK 位与正文位同口径（方案一）：并存矛盾出声、值组明细保留（终态不改），
      // RVRNO 自身留痕 remarks——见正文 RVRNO 位注释
      if (rvr?.kind === "value") {
        const prevText = rvr.span === undefined ? "" : raw.slice(rvr.span.start, rvr.span.end);
        warnings.push({
          code: "cross-check-conflict",
          severity: "info",
          message: `RVRNO（站级：应报而缺）与 RVR 值组并存（${prevText}）——矛盾形态，值组按跑道级明细保留，RVRNO 经 remarks/raw 可回溯`,
          span: spanOf(t),
        });
      } else {
        rvr = { kind: "missing", span: spanOf(t) };
      }
      push("rvr-no");
      continue;
    }
    if (text === "SFC" && tokens[i + 1]?.text === "VIS") {
      // 分数尾 token（SFC VIS 2 1/2）一并吸收，不再散落 unknown（FMH-1 12.7.1.f）
      const frac = /^\d\/\d(SM)?$/.test(tokens[i + 3]?.text ?? "") ? 1 : 0;
      push("surface-visibility", 3 + frac);
      continue;
    }
    if (text === "TWR" && tokens[i + 1]?.text === "VIS") {
      // TWR VIS 塔台能见度（FMH-1 12.7.1.f，值可为分数对）
      const frac = /^\d\/\d(SM)?$/.test(tokens[i + 3]?.text ?? "") ? 1 : 0;
      push("twr-visibility", 3 + frac);
      continue;
    }
    const visDirNext = tokens[i + 1]?.text;
    const RMK_VIS_DIR = /^(N|NE|E|SE|S|SW|W|NW)$/;
    const RMK_VIS_VAL = /^[MP]?\d+(\/\d+)?(SM)?$/;
    if (
      text === "VIS" &&
      visDirNext !== undefined &&
      RMK_VIS_DIR.test(visDirNext) &&
      tokens[i + 2] !== undefined
    ) {
      // 分区能见度（方位在前）VIS <方位> <量值>〔<方位> <量值>…〕（FMH-1 12.7.1.h，量值可为整数+分数对）
      // 多扇区实弹（PANC：VIS E 10 SE 10 S 10）整段并组保真，后续方位对不再散落 unknown
      const frac = /^\d\/\d(SM)?$/.test(tokens[i + 3]?.text ?? "") ? 1 : 0;
      let consumed = 3 + frac;
      for (let j = i + consumed; ;) {
        const dir = tokens[j]?.text;
        if (dir === undefined || !RMK_VIS_DIR.test(dir)) break;
        const val = tokens[j + 1]?.text;
        if (val === undefined || !RMK_VIS_VAL.test(val)) break;
        const pair = /^\d+$/.test(val) && /^\d\/\d(SM)?$/.test(tokens[j + 2]?.text ?? "") ? 3 : 2;
        consumed += pair;
        j += pair;
      }
      push("sectoral-visibility", consumed);
      continue;
    }
    if (text === "VIS" && visDirNext !== undefined && RMK_VIS_VAL.test(visDirNext)) {
      // 分区能见度（量值在前）VIS <量值>〔<方位>〕（FMH-1 12.7.1.h；PANC 实弹：VIS 1 1/2 N）
      let consumed = 2; // VIS + 量值
      if (/^\d+$/.test(visDirNext) && /^\d\/\d(SM)?$/.test(tokens[i + 2]?.text ?? ""))
        consumed += 1; // 整数+分数对
      if (
        tokens[i + consumed]?.text !== undefined &&
        RMK_VIS_DIR.test(tokens[i + consumed]?.text ?? "")
      )
        consumed += 1;
      push("sectoral-visibility", consumed);
      continue;
    }
    if (/^CIGNO$/.test(text)) {
      // 云高计不可用（FMH-1 12.7.1.p 族，与 VISNO/TSNO/RVRNO 同族口径）
      push("cig-not-available");
      continue;
    }
    const cigNext = tokens[i + 1]?.text;
    if (text === "CIG" && cigNext !== undefined) {
      // CIG hhhVhhh 波动 / CIG hhh LOC / CIG hhh（FMH-1 12.7.1.p）
      const nxt = cigNext;
      if (/^\d{3}V\d{3}$/.test(nxt)) {
        push("ceiling-variation", 2);
        continue;
      }
      if (/^\d{3}$/.test(nxt)) {
        if (tokens[i + 2]?.text === "LOC") {
          push("ceiling-at-location", 3);
          continue;
        }
        push("ceiling", 2);
        continue;
      }
    }
    if (text === "PNO") {
      // 降水传感器不可用（FMH-1 12.7.2.g 族）
      push("precip-not-available");
      continue;
    }
    if (text === "FZRANO") {
      push("fzr-not-available");
      continue;
    }
    if (text === "CHINO") {
      push("chino");
      continue;
    }
    if (/^8\/[0-9X/]{3}$/.test(text)) {
      // 8/CCC 云型组（低/中/高云型电码 0–9，X 未知，/ 缺测；FMH-1 12.7.2.b）
      push("cloud-type-8group");
      continue;
    }
    if (/^933\d{3}$/.test(text)) {
      // 933RRR 积雪水当量（英寸百分之一；FMH-1 12.7.2.a）
      push("snow-water-equivalent");
      continue;
    }
    if (text === "FUNNEL" && tokens[i + 1]?.text === "CLOUD") {
      push("phenomenon-began-ended", 2);
      continue;
    }
    if (text === "LTG") {
      // 多 token 聚合：LTG 后按词表（LTG_TAIL_VOCAB）连收 + 词表词后夹带至多一个 1–2 位
      // 数字距离 token（FMH-1 ch.12：自动站雷电视频距离为海里裸数字，如 LTG ALQDS CG 12 OHD——
      // 数字须跟在词表词后，LTG 直连裸数字无出处）。聚合仍被词表外 token 截断；
      // 数字吸收以「前一吸收 token ∈ 词表」为前置且至多一个——防无关散落数字被静默吞进
      // lightning remark（2026-09-14 收紧：实现此前与注释声明不符，语料 229 处 LTG 零裸数字）
      let consumed = 1;
      let prevInVocab = false;
      let digitsAbsorbed = 0;
      for (;;) {
        const nextTok = tokens[i + consumed];
        if (nextTok === undefined) break;
        if (LTG_TAIL_VOCAB.has(nextTok.text)) {
          consumed += 1;
          prevInVocab = true;
          continue;
        }
        if (prevInVocab && digitsAbsorbed === 0 && /^\d{1,2}$/.test(nextTok.text)) {
          consumed += 1;
          digitsAbsorbed += 1;
          prevInVocab = false;
          continue;
        }
        break;
      }
      push("lightning", Math.min(consumed, tokens.length - i));
      continue;
    }
    if (text === "SNINCR" && /^\d+\/\d+$/.test(tokens[i + 1]?.text ?? "")) {
      // SNINCR <时增>/<总量>（英寸，两 token 一组）——积雪增率，2026-09-12 复评补建模
      push("snow-increase", 2);
      continue;
    }
    if (text === "VIS" && VIS_V_RANGE.test(tokens[i + 1]?.text ?? "")) {
      // 变化能见度 VIS 1/2V2（IR RemarkKind 'variable-visibility' 声明补实现）
      push("variable-visibility", 2);
      continue;
    }
    // began/ended 家族（FZRAB43E50 合并形态 / RAB42·RAE50 拆分形态 / B43 裸起止）——
    // 边界收紧（2026-09-12）：词身须能按天气组切解（FZRA/RA/TS…），俄区 QBB（云底高度，
    // 国家组）等非天气字母组不再被 [A-Z]{2,8} 前缀误吞进本类
    const beganMerged = /^([A-Z]{2,8})B\d{2,4}(?:E\d{2,4})?$/.exec(text);
    const beganSplit = /^([A-Z]{2})[BE]\d{2,4}$/.exec(text);
    const beganBodyOk = (m: RegExpExecArray | null): boolean =>
      m !== null && splitWeatherToken(m[1] ?? "") !== null;
    if (beganBodyOk(beganMerged) || beganBodyOk(beganSplit) || /^[BE]\d{2,4}$/.test(text)) {
      push("phenomenon-began-ended");
      continue;
    }
    if (/^QBB\d{3}$/.test(text)) {
      // QBB（俄区国家组）：云底高度（米，3 位直读，与正文云组互为印证）
      push("cloud-base-height");
      continue;
    }
    if (/^QFE\d{3,4}(\/\d{3,4})?$/.test(text)) {
      // QFE（俄区国家组）：场面气压。值语义（查证 2026-09-12）：三位数 = 毫米汞柱（QFE749 = 749 mmHg，
      // 俄区惯例报 mmHg 场压）；双段 QFE746/0995 = 746 mmHg 与 995 hPa 双单位（760 mmHg = 1013.25 hPa
      // 标准大气换算互证，metar-taf.com 俄区实报 RMK R08L/QFE741/0988 同族）；四位数直读 hPa（QFE1003）。
      // 认组粒度收下不解码数值（RemarkGroup 无值槽；单位歧义风险由「不解码」规避），原码经 span 可取
      push("aerodrome-pressure");
      continue;
    }
    if (text === "$") {
      push("maintenance");
      continue;
    }
    push("unknown");
  }
  return { rvr, next: i };
}
