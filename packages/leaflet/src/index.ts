/**
 * @metweave/leaflet — Leaflet 适配器：报文卡片上图的桥接层。
 * The Leaflet adapter: puts metweave report cards onto a Leaflet map.
 *
 * v0.1 唯一地图适配器；更多地图库适配（MapLibre 等）在路线图上。
 * 兼容契约 = Leaflet overlay 能力：底图瓦片是宿主侧一行 L.tileLayer 配置，本包不做任何绑定，
 * 也不推荐或代理任何底图服务——底图由使用者按自己的授权自行选择。
 */
import type * as Leaflet from "leaflet";
import type {
  CloudCondition,
  CloudElement,
  MetarReport,
  Observed,
  RunwayStateGroup,
  VisibilityGroup,
  WeatherGroup,
  WindGroup,
} from "@metweave/core";
import { toValues, unwrap } from "@metweave/core";
import { renderCard, renderTafCard } from "@metweave/render";
import type { RenderTafCardOptions } from "@metweave/render";
import { expandTaf } from "@metweave/parser";
import type {
  TafExpandAt,
  TafMonthAnchor,
  TafReport,
  TafResolvedConditions,
} from "@metweave/parser";

/**
 * leaflet 惰性装载：import 本包时不再静态加载 leaflet——peer 库是浏览器专属实现，
 * 顶层静态 import 会让 Node/SSR 的模块图在求值期即崩（window is not defined，
 * 2026-09-16 五方实测评测实锤：ESM/CJS 双格式 import 均炸）。改为首次 addMetarLayer
 * 调用时动态 import 并缓存；类型面仍由顶层 import type 提供，宿主类型检查零影响。
 */
let leafletModule: Promise<typeof import("leaflet")> | undefined;
const loadLeaflet = (): Promise<typeof import("leaflet")> => (leafletModule ??= import("leaflet"));

/**
 * One station on the map: parsed report IR + WGS-84 position + optional tooltip title.
 * 地图上的一个站点：已解析报文 IR + WGS-84 坐标 + 可选悬浮标题。
 */
export interface MetarLayerItem {
  /** 已解析的报文 IR */
  report: MetarReport;
  /** 站点坐标（WGS-84 [lat, lon]；用 GCJ-02 底图时的偏移由宿主决定是否校正） */
  position: [number, number];
  /** 站点提示（tooltip 文案，缺省用 IR 站名）。按纯文本处理——不解析 HTML，宿主自传任意串无注入面 */
  title?: string;
}

/**
 * Options for addMetarLayer: popup behavior, pass-through renderCard options, and the condition-color dot mode.
 * addMetarLayer 的选项：弹窗行为、透传 renderCard 的选项、条件色圆点模式。
 */
export interface AddMetarLayerOptions {
  /** 显示语言速记：等价 `card.locale`，同时决定 tooltip 摘要/档位词与弹窗卡片语言；
   *  card.locale 显式传入时以其为准。未知选项运行时抛错（拼写错误不静默） */
  locale?: "zh" | "en";
  /** 点击站点时以弹窗展示报文卡片（缺省开启） */
  popup?: boolean;
  /** 传给 renderCard 的选项 */
  card?: Parameters<typeof renderCard>[1];
  /** marker 按四档气象条件着色（unknown/poor/caution/good 圆点替代默认图钉；缺省 false 保持现状）。
   *  判据为本库自拟的扫视启发式（初稿待审，见 conditionOf 注释）——不对应任何官方飞行天气分类，
   *  不得用作运行判据；
   *  开启时 tooltip 同时追加一行要素摘要（能见度/天气/最差云；NIL 与关键组全缺测站显示「缺报/数据缺测」），
   *  圆点 aria-label 追加档位词（zh「天气好/差…」/ en「Weather …」，语言随 card.locale） */
  conditionColors?: boolean;
}

/** addMetarLayer 的合法选项键（运行时校验用——拼错的选项键静默忽略违反本库不静默纪律） */
const ADD_METAR_LAYER_OPTION_KEYS: ReadonlySet<string> = new Set([
  "locale",
  "popup",
  "card",
  "conditionColors",
]);

/**
 * tooltip 纯文本承载：Leaflet 对 string 内容走 innerHTML——宿主自传的 title 是任意串，
 * 经由 textContent 装载（非 HTML 路径）杜绝标记注入；文案渲染不受影响。
 */
function textCarrier(text: string): HTMLElement {
  const el = document.createElement("span");
  el.textContent = text;
  return el;
}

/** HTML 属性上下文转义（divIcon 的 html 字符串构造用——title/站名不可信面） */
const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });

/** 四档条件色（与卡片 mw-danger/mw-caution 同族色相：灰=不明、红=差、琥珀=注意、绿=好） */
const TIER_COLORS: Record<ConditionTier, string> = {
  unknown: "#8a94a0",
  poor: "#d05656",
  caution: "#e0a13c",
  good: "#3aa657",
};

type ConditionTier = "unknown" | "poor" | "caution" | "good";

/** 档位可读名（aria-label 追加词——a11y 1.4.1：档位信息不只靠颜色传达） */
const TIER_WORDS: Record<"zh" | "en", Record<ConditionTier, string>> = {
  zh: { unknown: "天气不明", poor: "天气差", caution: "天气注意", good: "天气好" },
  en: {
    unknown: "Weather unknown",
    poor: "Weather poor",
    caution: "Weather caution",
    good: "Weather good",
  },
};

/** 降水类现象（caution 判据用，与 WMO 4678 降水族对应——RA/SN/SG/PL/GS/IC/DZ/UP） */
const PRECIP_PHENOMENA: ReadonlySet<string> = new Set([
  "RA",
  "SN",
  "SG",
  "PL",
  "GS",
  "IC",
  "DZ",
  "UP",
]);

/** 风速折米/秒（阵风判据统一单位：kt ×0.514444、kmh ÷3.6、mps ×1） */
const toMps = (value: number, unit: "kt" | "mps" | "kmh"): number =>
  unit === "kt" ? value * 0.514444 : unit === "kmh" ? value / 3.6 : value;

/**
 * 四档气象条件分级（判据本库自拟、初稿待审——显示层扫视启发式）：
 * 阈值由本库拟定，**不对应也不代表任何官方飞行天气分类；本库不提供飞行规则判定**（本期无此功能）。
 * 仅供「一眼扫视哪些站值得注意」，不得作为任何运行判据：
 * - unknown（灰）= NIL（台站无观测）或关键组全缺测（能见度与云均缺测且天气缺测/无——按可得要素无从判读）
 * - poor（红）= 能见度 < 1500 m，或 BKN/OVC 云层（含垂直能见度）云底 < 1000 ft，或天气含 TS 族（任何雷暴，含 VC 邻近）
 *   或现象含 GR/VA，或冻降水（FZ 描述符族，冻雨/冻毛毛雨），或 + 强度显著降水，或阵风 ≥ 25 m/s，或云组含 CB/TCU，或跑道关闭
 * - caution（琥珀）= 能见度 1500–5000 m（能见度分档取国内通行 1500/5000 m 口径），或 BKN/OVC 云底 1000–3000 ft，或任何降水族（RA/SN 等），
 *   或 FZ 描述符以外的结冰现象，或阵风 15–25 m/s
 * - good（绿）= 其余（含 CAVOK）
 * 缺测要素不参与限制（按可得要素判，见 conditionOf 内 unknown 判据的例外）；阈值细则随口径审定后修订。
 */
/** 判据输入面（结构子集）：METAR 报与 TAF 展开结果皆可喂（渲染层①，2026-09-23）——
 *  MetarReport 结构性满足本接口；TAF 侧由展开结果投影构造（runwayStates 恒缺省） */
interface ConditionInput {
  readonly nil?: boolean;
  readonly cavok: boolean;
  readonly wind?: Observed<WindGroup>;
  readonly visibility?: Observed<VisibilityGroup>;
  readonly weather?: Observed<readonly WeatherGroup[]>;
  readonly clouds?: CloudCondition;
  readonly runwayStates?: readonly RunwayStateGroup[];
}

function conditionOf(report: ConditionInput): ConditionTier {
  if (report.nil === true) return "unknown";
  const v = {
    wind: unwrap(report.wind),
    visibility: unwrap(report.visibility),
    weather: unwrap(report.weather),
    clouds: report.clouds,
    runwayStates: report.runwayStates ?? [],
  };
  // 关键组全缺测：能见度与云均缺测（云组每个体均为全缺测形态）且天气缺测/无——判读无从下手，灰而非绿
  const visMissing = report.visibility?.kind === "missing";
  const elements = v.clouds?.elements ?? [];
  const cloudsAllMissing =
    !report.cavok &&
    elements.every(
      (e) => e.heightFt.value === null && (e.kind === "vertical-visibility" || e.amount === null),
    );
  const weatherMissingOrNone =
    report.weather === undefined ||
    report.weather.kind === "missing" ||
    (report.weather.kind === "value" && report.weather.value.length === 0);
  if (visMissing && cloudsAllMissing && weatherMissingOrNone) return "unknown";

  // —— poor 判据（任一命中即红）
  const vis = v.visibility;
  if (vis !== undefined) {
    const visMeters = vis.unit === "m" ? vis.value : vis.value * 1609.344;
    if (visMeters < 1500) return "poor";
  }
  const ceilings = elements
    .filter((e): e is Extract<CloudElement, { kind: "layer" }> => e.kind === "layer")
    .filter((e) => e.amount === "BKN" || e.amount === "OVC")
    .map((e) => e.heightFt.value ?? Number.POSITIVE_INFINITY);
  for (const e of elements) {
    if (e.kind === "vertical-visibility")
      ceilings.push(e.heightFt.value ?? Number.POSITIVE_INFINITY);
  }
  const ceiling = ceilings.length > 0 ? Math.min(...ceilings) : Number.POSITIVE_INFINITY;
  if (ceiling < 1000) return "poor";
  for (const g of v.weather ?? []) {
    const thunderstorm = g.descriptor === "TS"; // TS 族：任何雷暴（含 VCTS 邻近雷暴）
    const hailOrAsh = g.phenomena.includes("GR") || g.phenomena.includes("VA");
    const freezing = g.descriptor === "FZ"; // 冻降水族（FZRA/FZDZ 等）——危害与雷暴同级，2026-09-22 运行视角评审升红
    const heavyPrecip =
      g.intensity === "+" &&
      (g.descriptor === "SH" || g.phenomena.some((p) => PRECIP_PHENOMENA.has(p)));
    if (thunderstorm || hailOrAsh || freezing || heavyPrecip) return "poor";
  }
  const gust = v.wind?.gust;
  if (gust !== undefined && toMps(gust.value, gust.unit) >= 25) return "poor";
  const convective = elements.some(
    (e): e is Extract<CloudElement, { kind: "layer" }> =>
      e.kind === "layer" && e.convective !== undefined,
  );
  if (convective) return "poor";
  if (v.runwayStates.some((st) => st.closed === true)) return "poor";

  // —— caution 判据（任一命中即琥珀）
  if (vis !== undefined) {
    const visMeters = vis.unit === "m" ? vis.value : vis.value * 1609.344;
    if (visMeters < 5000) return "caution";
  }
  if (ceiling < 3000) return "caution";
  for (const g of v.weather ?? []) {
    const precip = g.phenomena.some((p) => PRECIP_PHENOMENA.has(p));
    if (precip) return "caution";
  }
  if (gust !== undefined && toMps(gust.value, gust.unit) >= 15) return "caution";
  return "good";
}

/** 天气组显示码：span 在位取原码，缺席由 IR 重建（摘要行的要素原样口径） */
function weatherCode(report: MetarReport, g: WeatherGroup): string {
  return g.span === undefined
    ? `${g.proximity ? "VC" : ""}${g.intensity ?? ""}${g.descriptor ?? ""}${g.phenomena.join("")}`
    : report.raw.slice(g.span.start, g.span.end);
}

/** 云层显示码：span 在位取原码，缺席由 IR 重建（缺测位还原为 ///） */
function cloudCode(report: MetarReport, layer: CloudElement): string {
  if (layer.span === undefined) {
    if (layer.kind === "vertical-visibility") {
      return `VV${layer.heightFt.value === null ? "///" : String(Math.round(layer.heightFt.value / 100)).padStart(3, "0")}`;
    }
    const height =
      layer.heightFt.value === null
        ? "///"
        : String(Math.round(layer.heightFt.value / 100)).padStart(3, "0");
    return `${layer.amount ?? "///"}${height}${layer.convective ?? ""}`;
  }
  return report.raw.slice(layer.span.start, layer.span.end);
}

/**
 * tooltip 第二行要素摘要（扫视初筛）：`2500m +TSRA BKN030CB` 式——
 * 能见度 / 最显著天气（优先 TS/GR/+ 强度族）/ 最差云（对流云优先，否则最低 BKN/OVC，VV 兜底）。
 * NIL 站显示「缺报（NIL）」、关键组全缺测站显示「数据缺测」（与 conditionOf 的 unknown 判据同款口径）。
 */
function summarizeReport(report: MetarReport, locale: "zh" | "en"): string {
  if (report.nil === true) return locale === "en" ? "No report (NIL)" : "缺报（NIL）";
  if (report.cavok) return "CAVOK";
  const v = toValues(report);
  // 关键组全缺测（能见度与云均缺测且天气缺测/无）：要素摘要无从拼起，显示缺测占位而非空行
  const elements = v.clouds?.elements ?? [];
  const visMissing = report.visibility?.kind === "missing";
  const cloudsAllMissing =
    !report.cavok &&
    elements.every(
      (e) => e.heightFt.value === null && (e.kind === "vertical-visibility" || e.amount === null),
    );
  const weatherMissingOrNone =
    report.weather === undefined ||
    report.weather.kind === "missing" ||
    (report.weather.kind === "value" && report.weather.value.length === 0);
  if (visMissing && cloudsAllMissing && weatherMissingOrNone)
    return locale === "en" ? "Data missing" : "数据缺测";
  const parts: string[] = [];
  const vis = v.visibility;
  if (vis !== undefined) {
    parts.push(
      vis.unit === "m"
        ? vis.exact
          ? `${vis.value} m`
          : "≥10 km"
        : vis.beyond === "below"
          ? `<${vis.value} SM`
          : vis.beyond === "above"
            ? `>${vis.value} SM`
            : `${vis.value} SM`,
    );
  }
  const weather = v.weather ?? [];
  const significant =
    weather.find(
      (g) => g.descriptor === "TS" || g.phenomena.includes("GR") || g.intensity === "+",
    ) ?? weather[0];
  if (significant !== undefined) parts.push(weatherCode(report, significant));
  const layers = v.clouds?.elements ?? [];
  const convective = layers.find(
    (e): e is Extract<CloudElement, { kind: "layer" }> =>
      e.kind === "layer" && e.convective !== undefined,
  );
  const ceilingLayer = layers
    .filter((e): e is Extract<CloudElement, { kind: "layer" }> => e.kind === "layer")
    .filter((e) => e.amount === "BKN" || e.amount === "OVC")
    .reduce<Extract<CloudElement, { kind: "layer" }> | undefined>(
      (lowest, e) =>
        lowest === undefined ||
        (e.heightFt.value ?? Number.POSITIVE_INFINITY) <
          (lowest.heightFt.value ?? Number.POSITIVE_INFINITY)
          ? e
          : lowest,
      undefined,
    );
  const vertical = layers.find((e) => e.kind === "vertical-visibility");
  const worstCloud = convective ?? ceilingLayer ?? vertical;
  if (worstCloud !== undefined) parts.push(cloudCode(report, worstCloud));
  else if (v.clouds?.clear !== undefined) parts.push(v.clouds.clear.code);
  return parts.join(" ");
}

/** tooltip 内容节点：标题行 + 要素摘要行（两行皆纯文本装载；locale 决定摘要占位词语言） */
function tooltipContent(
  item: MetarLayerItem,
  withSummary: boolean,
  locale: "zh" | "en",
): HTMLElement {
  const container = document.createElement("span");
  container.append(textCarrier(item.title ?? item.report.station));
  if (withSummary) {
    container.append(
      document.createElement("br"),
      textCarrier(summarizeReport(item.report, locale)),
    );
  }
  return container;
}

/** Escape 关闭已开弹窗的监听只挂一次/地图（多图层叠加不重复绑定） */
const escapeBoundMaps = new WeakSet<Leaflet.Map>();

/**
 * Put a set of report stations onto a Leaflet map: markers + tooltips + card popups. Returns a removable layer group.
 * 把一组报文站点挂上地图：标记 + tooltip + 卡片弹窗。返回可整体移除的图层组。
 * @param map - A Leaflet map instance. Leaflet 地图实例。
 * @param items - Stations to plot (report + position + title). 待上图的站点列表。
 * @param options - See AddMetarLayerOptions. 见 AddMetarLayerOptions。
 *
 * 异步（v0.2 起为 Promise）：leaflet 由首次调用时动态装载——本包可在任何模块图（含 Node/SSR
 * 预渲染流水线）中 import 而不触雷，代价是上图动作需 await。
 */

export async function addMetarLayer(
  map: Leaflet.Map,
  items: readonly MetarLayerItem[],
  options: AddMetarLayerOptions = {},
): Promise<Leaflet.LayerGroup> {
  // 未知选项运行时抛错：拼写错误的选项被静默忽略 = 显示语言/行为悄悄不符预期（2026-09-15
  // 五角色评测实测：顶层 locale 此前被静默忽略，popup 整卡仍中文）。中文提示 = v0.1 message 语言契约。
  for (const key of Object.keys(options)) {
    if (!ADD_METAR_LAYER_OPTION_KEYS.has(key)) {
      throw new Error(
        `addMetarLayer 收到未知选项 "${key}"——卡片级选项（locale/raw/className…）需包在 card 里传，可用项见 AddMetarLayerOptions`,
      );
    }
  }
  // 语言解析单一出口：card.locale 显式传入 > 顶层 locale 速记 > zh；非法值清晰报错不裸崩
  const locale = options.card?.locale ?? options.locale ?? "zh";
  if (locale !== "zh" && locale !== "en") {
    // never 收窄后的宽化中转：模板表达式不接受 never 字面量类型
    const bad: string = locale;
    throw new Error(`addMetarLayer 的 locale 选项值 "${bad}" 不受支持（可用："zh" | "en"）`);
  }
  const L = await loadLeaflet();
  const group = L.layerGroup();
  for (const item of items) {
    const name = item.title ?? item.report.station;
    // alt 写入图标 img 的 alt 属性：marker 在读屏下 role=button，可访问名称 = 站名（WCAG 4.1.2）
    let marker: Leaflet.Marker;
    if (options.conditionColors === true) {
      // 圆点 divIcon 无 img——alt 失效，改以 role=img + aria-label 保住可访问名称（内容经 HTML 转义）；
      // aria-label 追加档位词（a11y 1.4.1：档位不只靠颜色传达；语言随 card.locale，缺省中文）
      const tier = conditionOf(item.report);
      const label = `${name} · ${TIER_WORDS[locale][tier]}`;
      marker = L.marker(item.position, {
        icon: L.divIcon({
          className: "mw-cond-icon",
          html: `<span role="img" aria-label="${escapeHtml(label)}" class="mw-dot mw-dot-${tier}" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${TIER_COLORS[tier]};border:2px solid #fff;box-shadow:0 0 2px rgba(0,0,0,.4)"></span>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
      });
    } else {
      marker = L.marker(item.position, { alt: name });
    }
    marker.bindTooltip(tooltipContent(item, options.conditionColors === true, locale));
    if (options.popup ?? true) {
      // 弹窗内容是 renderCard 的 DOM 元素（createElement/textContent 构建），本就走非 HTML 路径；
      // maxWidth 420 = 卡片设计宽（Leaflet 缺省 300 会压窄）
      // 元数据联表得到的站名随弹窗进卡片站名行（title = "ICAO 站名"，剥掉 ICAO 前缀）；调用方显式传入时以其为准
      const cardOpts: Parameters<typeof renderCard>[1] = { ...options.card };
      if (cardOpts.locale === undefined && options.locale !== undefined) {
        cardOpts.locale = options.locale;
      }
      const stationName =
        item.title !== undefined && item.title.startsWith(`${item.report.station} `)
          ? item.title.slice(item.report.station.length + 1)
          : undefined;
      if (cardOpts.stationTitle === undefined && stationName !== undefined) {
        cardOpts.stationTitle = stationName;
      }
      marker.bindPopup(renderCard(item.report, cardOpts), { maxWidth: 420 });
      marker.on("popupopen", () => {
        // 触屏双浮层消除：弹窗打开即收起 tooltip
        marker.closeTooltip();
        // 焦点移入弹窗首个可聚焦元素（Leaflet 关闭按钮）——键盘与读屏可直达
        const focusTarget = marker
          .getPopup()
          ?.getElement()
          ?.querySelector<HTMLElement>("a.leaflet-popup-close-button, button, [href]");
        focusTarget?.focus();
      });
    }
    marker.addTo(group);
  }
  if (!escapeBoundMaps.has(map)) {
    escapeBoundMaps.add(map);
    // 地图容器键盘路径：Escape 关闭已开弹窗（closePopup 对未开弹窗是空操作）
    map.getContainer().addEventListener("keydown", (event) => {
      if (event.key === "Escape") map.closePopup();
    });
  }
  group.addTo(map);
  return group;
}

// ---------------------------------------------------------------- TAF 图层（v0.2 渲染层①：预报当观测渲）

/** TAF 展开结果 → 判据输入面投影（runwayStates 恒缺省——TAF 无跑道状态语汇） */
function asConditionInput(c: TafResolvedConditions, nilLike: boolean): ConditionInput {
  return {
    nil: nilLike,
    cavok: c.cavok,
    ...(c.wind !== undefined ? { wind: { kind: "value" as const, value: c.wind } } : {}),
    ...(c.visibility !== undefined
      ? { visibility: { kind: "value" as const, value: c.visibility } }
      : {}),
    ...(c.weather.length > 0 ? { weather: { kind: "value" as const, value: c.weather } } : {}),
    ...(c.clouds !== undefined ? { clouds: c.clouds } : {}),
  };
}

/** 天气组紧凑码（TAF 摘要用）：-SHRA / TSRA / +SN */
const wxCompact = (g: WeatherGroup): string =>
  `${g.intensity ?? ""}${g.proximity ? "VC" : ""}${g.descriptor ?? ""}${g.phenomena.join("")}`;

/** TAF 展开摘要（一行）：CAVOK 或 能见度 · 天气 · 云（对齐 summarizeReport 的要素序） */
function summarizeTaf(c: TafResolvedConditions, locale: "zh" | "en"): string {
  if (c.cavok) return "CAVOK";
  const parts: string[] = [];
  if (c.visibility !== undefined) {
    const vis = c.visibility;
    parts.push(
      vis.unit === "m"
        ? vis.exact
          ? `${vis.value} m`
          : "≥10 km"
        : `${vis.beyond === "below" ? "<" : vis.beyond === "above" ? ">" : ""}${vis.value} SM`,
    );
  }
  const significant =
    c.weather.find(
      (g) => g.descriptor === "TS" || g.phenomena.includes("GR") || g.intensity === "+",
    ) ?? c.weather[0];
  if (significant !== undefined) parts.push(wxCompact(significant));
  let lowest: { e: Extract<CloudElement, { kind: "layer" }>; ft: number } | undefined;
  for (const e of c.clouds?.elements ?? []) {
    if (e.kind !== "layer") continue;
    const ft = e.heightFt.value ?? Number.POSITIVE_INFINITY;
    if (lowest === undefined || ft < lowest.ft) lowest = { e, ft };
  }
  if (lowest !== undefined && lowest.e.amount !== null) {
    parts.push(
      `${lowest.e.amount}${String(Math.round(lowest.ft / 100)).padStart(3, "0")}${lowest.e.convective ?? ""}`,
    );
  }
  if (parts.length === 0) return locale === "en" ? "No elements" : "无要素组";
  return parts.join(" · ");
}

export interface TafLayerItem {
  /** 已解析的 TAF 报文 IR */
  report: TafReport;
  /** 站点坐标（WGS-84 [lat, lon]） */
  position: [number, number];
  /** 站点提示（tooltip 文案，缺省用 IR 站名） */
  title?: string;
}

/**
 * Options for addTafLayer: expansion instant, month anchor, locale, popup.
 * addTafLayer 的选项：展开时刻、月锚、语言、弹窗。
 */
export interface AddTafLayerOptions {
  /** 显示语言（缺省 zh） */
  locale?: "zh" | "en";
  /** 展开时刻（UTC）；缺省 = 有效期起点 */
  at?: TafExpandAt;
  /** 月锚天数（B3 跨月回绕，有效期起日所在月）；缺省 31 */
  anchorDays?: number;
  /** 点击站点时以弹窗展示预报摘要（缺省开启；层② 的完整 TAF 卡片在后续版本） */
  popup?: boolean;
  /** renderTafCard 透传（raw/className/stationTitle/utcOffsetMinutes——宿主定制 TAF 卡；at 由图层按当前时刻注入） */
  card?: Omit<RenderTafCardOptions, "locale" | "at">;
}

const ADD_TAF_LAYER_OPTION_KEYS: ReadonlySet<string> = new Set([
  "locale",
  "at",
  "anchorDays",
  "popup",
  "card",
]);

/**
 * Put parsed TAF stations onto a Leaflet map as forecast markers at one instant — the four-tier
 * dot, tooltip and popup are driven by `expandTaf` (renderer layer ①: forecast-as-observation).
 * 把一组 TAF 站点按同一时刻的预报值挂上地图：四档圆点/tooltip/弹窗全部由 expandTaf 展开
 * 结果驱动（渲染层①「预报当观测渲」——判据/圆点/摘要与 METAR 侧同一条管线）。
 * 档位判据为本库自拟扫视启发式（同 conditionOf 注释）——**预报值套判据同样不得用作运行判据**，
 * tooltip/弹窗均显式标注「预报」，不与实况混淆。
 */
export async function addTafLayer(
  map: Leaflet.Map,
  items: readonly TafLayerItem[],
  options: AddTafLayerOptions = {},
): Promise<Leaflet.LayerGroup> {
  for (const key of Object.keys(options)) {
    if (!ADD_TAF_LAYER_OPTION_KEYS.has(key)) {
      throw new Error(`addTafLayer 收到未知选项 "${key}"（可用项见 AddTafLayerOptions）`);
    }
  }
  const locale = options.locale ?? "zh";
  if (locale !== "zh" && locale !== "en") {
    const bad: string = locale;
    throw new Error(`addTafLayer 的 locale 选项值 "${bad}" 不受支持（可用："zh" | "en"）`);
  }
  const L = await loadLeaflet();
  const group = L.layerGroup();
  await populateTafLayer(map, group, items, options, L);
  group.addTo(map);
  return group;
}

/** 常显站码标签样式（评测签派 P0-1：无站码＝「有红的看不出是谁红的」）；缩放门控类由 zoomend 维护 */
const TAF_LAYER_STYLE_ID = "mw-taf-layer-style";
const injectTafLayerStyle = (): void => {
  if (document.getElementById(TAF_LAYER_STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = TAF_LAYER_STYLE_ID;
  style.append(
    document.createTextNode(
      ".mw-code-label { position:absolute; left:15px; top:-3px; white-space:nowrap; font:600 10px/1.4 system-ui,sans-serif; color:#2c3e50; text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff; pointer-events:none; }" +
        ".mw-hide-codes .mw-code-label { display:none; }",
    ),
  );
  document.head.append(style);
};
const codeZoomBound = new WeakSet<Leaflet.Map>();
/** zoom ≥ 5 常显 ICAO 码，低于则收（38 站全显互相压盖；评测签派 P0-1 的缩放分级折中） */
const bindCodeZoom = (map: Leaflet.Map): void => {
  if (codeZoomBound.has(map)) return;
  codeZoomBound.add(map);
  const container = map.getContainer();
  const toggle = (): void => {
    container.classList.toggle("mw-hide-codes", map.getZoom() < 5);
  };
  map.on("zoomend", toggle);
  toggle();
};

/** 各层当前展开时刻（setTafLayerTime 换时刻不再清层重建——marker 原地 setIcon/setTooltipContent，评测工程 P2-1） */
const tafLayerAt = new WeakMap<Leaflet.LayerGroup, TafExpandAt>();
/** marker → 其 TafLayerItem（换时刻原地更新时的数据面） */
const tafMarkerItems = new WeakMap<Leaflet.Marker, TafLayerItem>();
/** marker → 弹窗内容刷新函数（复测 N1/N2：刷新不走合成 popupopen——真实打开才移焦点，刷新按当前时刻重算置顶提示） */
const tafPopupRefresh = new WeakMap<Leaflet.Marker, (popup: Leaflet.Popup) => void>();

/** 查看时刻是否在该报文有效期外（含窗前/窗后——出窗＝灰点「预报未生效/已过期」） */
/** 日时 → 分钟序（出窗比较用；TAF 无月，同报文语境内日号自洽） */
const absDayHour = (d: number, h: number): number => (d - 1) * 1440 + h * 60;

const outOfValidity = (r: TafReport, at: TafExpandAt): boolean => {
  const v = r.validity;
  if (v === undefined || r.nil === true || r.cancelled === true) return false;
  const atAbs = absDayHour(at.day, at.hour) + at.minute;
  return (
    atAbs < absDayHour(v.startDay, v.startHour) ||
    atAbs >= absDayHour(v.endDay < v.startDay ? v.endDay + 31 : v.endDay, v.endHour)
  );
};

/** 单站展开视觉态（首建与换时刻共用——tier/摘要/提示单一来源） */
function tafMarkerState(
  item: TafLayerItem,
  at: TafExpandAt,
  anchor: TafMonthAnchor,
  locale: "zh" | "en",
): { tier: ConditionTier; label: string; summary: string; notes: string[] } {
  const r = item.report;
  const name = item.title ?? r.station;
  const noTimeline = r.nil === true || r.cancelled === true;
  const v = r.validity;
  let tier: ConditionTier = "unknown";
  let summary = r.nil === true ? "缺报（NIL）" : r.cancelled === true ? "预报取消（CNL）" : "";
  const notes: string[] = [];
  if (!noTimeline && v !== undefined && outOfValidity(r, at)) {
    // 出窗：灰 unknown（签派复测 N2——「无有效预报」本身是运行信息；卡内有对应出界提示行）
    const early = absDayHour(at.day, at.hour) < absDayHour(v.startDay, v.startHour);
    notes.push(early ? "预报尚未生效（按发布时基况显示）" : "预报已过期（按末段显示）");
    return {
      tier: "unknown",
      label: `${name} · 预报${early ? "未生效" : "已过期"}`,
      summary,
      notes,
    };
  }
  if (!noTimeline && v !== undefined) {
    const expansion = expandTaf(r, at, anchor);
    tier = conditionOf(asConditionInput(expansion.conditions, false));
    summary = summarizeTaf(expansion.conditions, locale);
    if (expansion.uncertain)
      notes.push(
        locale === "en" ? "Transition band — timing uncertain" : "过渡带（变化时刻不确定）",
      );
    if (expansion.tempo !== undefined) {
      const tempoSummary = summarizeTaf(
        {
          ...expansion.conditions,
          ...expansion.tempo.conditions,
          weather: expansion.tempo.conditions.weather ?? [],
          cavok: expansion.tempo.conditions.cavok,
        },
        locale,
      );
      notes.push((locale === "en" ? "TEMPO bursts: " : "TEMPO 发作可能：") + tempoSummary);
    }
  } else if (v !== undefined) {
    notes.push(`有效期 ${v.raw}`);
  }
  return {
    tier,
    label: `${name} · ${locale === "en" ? "Forecast " : "预报"}${TIER_WORDS[locale][tier]}`,
    summary,
    notes,
  };
}

/** 点位 divIcon（含常显 ICAO 站码标签）与悬停 tooltip 内容 */
function tafMarkerIcon(
  L: typeof import("leaflet"),
  item: TafLayerItem,
  state: { tier: ConditionTier; label: string; summary: string; notes: string[] },
): { icon: Leaflet.DivIcon; tip: HTMLElement } {
  const name = item.title ?? item.report.station;
  const marker = L.divIcon({
    className: "mw-cond-icon",
    html: `<span role="img" aria-label="${escapeHtml(state.label)}" class="mw-dot mw-dot-${state.tier}" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${TIER_COLORS[state.tier]};border:2px solid #fff;box-shadow:0 0 2px rgba(0,0,0,.4)"></span><span class="mw-code-label" aria-hidden="true">${escapeHtml(item.report.station)}</span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
  return { icon: marker, tip: tafTipContent(name, state) };
}

function tafTipContent(name: string, state: { summary: string; notes: string[] }): HTMLElement {
  const tip = document.createElement("span");
  tip.append(textCarrier(name));
  if (state.summary !== "") tip.append(document.createElement("br"), textCarrier(state.summary));
  for (const n of state.notes) tip.append(document.createElement("br"), textCarrier(n));
  return tip;
}

/** TAF 标记构建核心：addTafLayer 首建用（标记构建 + 常显站码 + 惰性弹窗） */
async function populateTafLayer(
  map: Leaflet.Map,
  group: Leaflet.LayerGroup,
  items: readonly TafLayerItem[],
  options: AddTafLayerOptions,
  L: typeof import("leaflet"),
): Promise<void> {
  const anchor: TafMonthAnchor = { daysIn: options.anchorDays ?? 31 };
  const locale = options.locale ?? "zh";
  for (const item of items) {
    const r = item.report;
    const noTimeline = r.nil === true || r.cancelled === true;
    const v = r.validity;
    const at: TafExpandAt = noTimeline
      ? { day: v?.startDay ?? 0, hour: v?.startHour ?? 0, minute: 0 }
      : (options.at ?? { day: v?.startDay ?? 0, hour: v?.startHour ?? 0, minute: 0 });
    const state = tafMarkerState(item, at, anchor, locale);
    const { icon, tip } = tafMarkerIcon(L, item, state);
    const marker = L.marker(item.position, { icon });
    tafMarkerItems.set(marker, item);
    marker.bindTooltip(tip);

    if (options.popup ?? true) {
      // 惰性弹窗（评测工程 P2-1）：占位 DOM 只在 popupopen 时换真卡——滑杆换时刻不清层，重开即见新时刻卡
      marker.bindPopup(document.createElement("div"), { maxWidth: 420 });
      // 刷新函数（复测 N1/N2）：按层当前时刻重展开取 notes（置顶提示随换时刻更新，与 tooltip 同源），
      // 只重建卡片内容不动焦点——焦点移入仅发生在真实 popupopen（键盘拖滑杆不再被抢焦）
      const refresh = (popup: Leaflet.Popup): void => {
        const current = tafLayerAt.get(group) ?? at;
        const fresh = tafMarkerState(item, noTimeline ? at : current, anchor, locale);
        const cardOpts: RenderTafCardOptions = {
          locale,
          raw: true,
          ...(noTimeline ? {} : { at: current }),
          ...options.card,
        };
        if (cardOpts.stationTitle === undefined && item.title !== undefined) {
          const stationName = item.title.startsWith(`${r.station} `)
            ? item.title.slice(r.station.length + 1)
            : undefined;
          if (stationName !== undefined) cardOpts.stationTitle = stationName;
        }
        const card = renderTafCard(r, cardOpts);
        if (fresh.notes.length > 0) {
          const lead = document.createElement("p");
          lead.style.margin = "0 0 4px";
          lead.className = "mw-taf-meta";
          for (const [i, n] of fresh.notes.entries()) {
            if (i > 0) lead.append(document.createElement("br"));
            lead.append(textCarrier(n));
          }
          card.prepend(lead);
        }
        popup.setContent(card);
      };
      tafPopupRefresh.set(marker, refresh);
      marker.on("popupopen", (e) => {
        if (e.popup === undefined) return;
        marker.closeTooltip();
        refresh(e.popup);
        const focusTarget = e.popup
          .getElement()
          ?.querySelector<HTMLElement>("a.leaflet-popup-close-button, button, [href]");
        focusTarget?.focus();
      });
    }
    marker.addTo(group);
  }
  if (!escapeBoundMaps.has(map)) {
    escapeBoundMaps.add(map);
    map.getContainer().addEventListener("keydown", (event) => {
      if (event.key === "Escape") map.closePopup();
    });
  }
  injectTafLayerStyle();
  bindCodeZoom(map);
  // 层级当前时刻：仅显式 at 时设全局态；缺省各站自有效期起（弹窗回退 marker 自身 at）
  if (options.at !== undefined) tafLayerAt.set(group, options.at);
}

// ---------------------------------------------------------------- TAF 时间轴（v0.2 渲染层③：全图统一时刻）

/**
 * Re-expand every TAF marker at a new instant — in-place icon/tooltip update, no rebuild.
 * 全图统一换时刻（评测工程 P2-1 瘦身版）：各标记原地 setIcon/setTooltipContent，不再清层重建——
 * 换时刻不销毁已开弹窗（打开中的弹窗即时换内容）、无 DOM/监听器 churn（38 站滑杆拖动不再百卡重建）。
 * 展开是纯函数、遍历同步，无 clearLayers/populate 竞态窗口（旧代际令牌机制随重建路径一并退役）。
 */
export async function setTafLayerTime(
  map: Leaflet.Map,
  layer: Leaflet.LayerGroup,
  items: readonly TafLayerItem[],
  options: AddTafLayerOptions = {},
): Promise<Leaflet.LayerGroup> {
  void map;
  void items; // 签名保留（公开 API 契约）：原地更新路径经 markerItems 拿数据，不再需要整表
  const L = await loadLeaflet();
  const anchor: TafMonthAnchor = { daysIn: options.anchorDays ?? 31 };
  const locale = options.locale ?? "zh";
  // 缺省 at：保持层当前时刻（不回退到非法 0 日——复测 N5；层尚无时刻时退各站自身有效期起点）
  const at = options.at ??
    tafLayerAt.get(layer) ?? {
      day: items[0]?.report.validity?.startDay ?? 1,
      hour: items[0]?.report.validity?.startHour ?? 0,
      minute: 0,
    };
  if (options.at !== undefined) tafLayerAt.set(layer, options.at);
  const openRefresh: Leaflet.Marker[] = [];
  layer.eachLayer((ml) => {
    if (!(ml instanceof L.Marker)) return; // 层内非 marker（弹窗代理等）跳过
    const marker: Leaflet.Marker = ml;
    const item = tafMarkerItems.get(marker);
    if (item === undefined) return;
    const r = item.report;
    const noTimeline = r.nil === true || r.cancelled === true;
    const v = r.validity;
    const own: TafExpandAt = noTimeline
      ? { day: v?.startDay ?? 0, hour: v?.startHour ?? 0, minute: 0 }
      : at;
    const state = tafMarkerState(item, own, anchor, locale);
    const { icon, tip } = tafMarkerIcon(L, item, state);
    marker.setIcon(icon);
    marker.setTooltipContent(tip);
    if (marker.isPopupOpen()) openRefresh.push(marker);
  });
  // 已开弹窗即时换内容：走刷新函数（不动焦点——键盘拖滑杆不被抢焦，复测 N1；notes 按新时刻重算，N2）
  for (const marker of openRefresh) {
    const popup = marker.getPopup();
    if (popup === undefined) continue;
    tafPopupRefresh.get(marker)?.(popup);
  }
  return layer;
}

/** 时刻展示串（控件与卡片共用口径；en 无「日」字） */
const fmtTafAt = (at: TafExpandAt, locale: "zh" | "en" = "zh"): string =>
  locale === "zh"
    ? `${String(at.day).padStart(2, "0")}日 ${String(at.hour).padStart(2, "0")}:${String(at.minute).padStart(2, "0")}Z`
    : `Day ${String(at.day).padStart(2, "0")} ${String(at.hour).padStart(2, "0")}:${String(at.minute).padStart(2, "0")} Z`;

/** 控件本地时括注（评测共识①：zh 缺省北京时；日回绕按 31 折回——显示位近似） */
const fmtTafLt = (at: TafExpandAt, offset: number, tag: string): string => {
  const total = (at.day - 1) * 1440 + at.hour * 60 + at.minute + offset;
  const d = (Math.floor(total / 1440) % 31) + 1;
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  return `（${tag}${String(d).padStart(2, "0")}日${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}）`;
};

export interface TafTimeControlOptions {
  /** 受控图层与数据（每次拨动全量重展开） */
  layer: Leaflet.LayerGroup;
  items: readonly TafLayerItem[];
  /** addTafLayer 的其余选项（locale/anchorDays/popup/card） */
  layerOptions?: Omit<AddTafLayerOptions, "at">;
  /** 步进分钟数（滑杆一格），缺省 60 */
  stepMinutes?: number;
  /** 滑杆零点时刻；缺省自动取各站最早有效期起点 */
  from?: TafExpandAt;
  /** 滑杆终点时刻；缺省自动取各站最晚有效期止（评测共识⑤：滑杆窗对齐数据，不再盲拖出界） */
  to?: TafExpandAt;
  /** 显示语言（缺省 zh；en 不加「日」字与京时括注——评测工程 P2-3 i18n 漏网） */
  locale?: "zh" | "en";
  /** 本地时括注偏移（分钟）；zh 缺省 480＝北京时，null 关闭 */
  utcOffsetMinutes?: number | null;
  /** 时刻变更回调（拿到当前时刻，供宿主联动外部 UI） */
  onTime?: (at: TafExpandAt) => void;
}

/**
 * A framework-free time-scrub control element for a TAF layer: one range input drives every
 * station's re-expansion (renderer layer ③). Host mounts it anywhere; pure DOM, no Leaflet control
 * inheritance required.
 * TAF 图层的时间滑杆控件（零框架纯 DOM）：一个 range 输入驱动全图各站重展开；宿主自行挂载定位。
 */
export function createTafTimeControl(
  map: Leaflet.Map,
  options: TafTimeControlOptions,
): HTMLElement {
  const step = options.stepMinutes ?? 60;
  const locale = options.locale ?? "zh";
  const ltOffset =
    options.utcOffsetMinutes !== undefined
      ? options.utcOffsetMinutes
      : locale === "zh"
        ? 480
        : null;
  const box = document.createElement("div");
  box.className = "mw-taf-timectrl";
  box.style.cssText =
    "display:flex;gap:8px;align-items:center;padding:6px 10px;background:#fff;border:1px solid #d8dee6;border-radius:8px;font:12px/1.4 system-ui,sans-serif;color:#1c2733";
  const label = document.createElement("span"); // 读屏走 input 的 aria-valuetext（复测 N6：双通道会逐格双朗读）
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.step = "1";
  input.setAttribute("aria-label", locale === "en" ? "forecast time" : "预报时刻");
  // 滑杆零点/终点：显式指定 > 各站最早起点/最晚止点（评测共识⑤：窗对齐数据；止点按各自报文回绕归一到绝对序再取最大）
  const from: TafExpandAt =
    options.from ??
    options.items.reduce<TafExpandAt>(
      (acc, it) => {
        const v = it.report.validity;
        if (v === undefined) return acc;
        const cand = { day: v.startDay, hour: v.startHour, minute: 0 };
        if (acc.day === 0 && acc.hour === 0) return cand;
        return cand.day < acc.day || (cand.day === acc.day && cand.hour < acc.hour) ? cand : acc;
      },
      { day: 0, hour: 0, minute: 0 },
    );
  let toAbsMax: number | null = null;
  for (const it of options.items) {
    const v = it.report.validity;
    if (v === undefined) continue;
    const endDay = v.endDay < v.startDay ? v.endDay + 31 : v.endDay;
    const abs = (endDay - 1) * 1440 + v.endHour * 60;
    if (toAbsMax === null || abs > toAbsMax) toAbsMax = abs;
  }
  const fromAbs = (from.day - 1) * 1440 + from.hour * 60 + from.minute;
  const toAbs = toAbsMax ?? fromAbs + 100 * step; // 无任何有效期数据时回退百格
  const spanSteps = Math.max(1, Math.round((toAbs - fromAbs) / step));
  input.max = String(spanSteps);
  const atOfValue = (value: number): TafExpandAt => {
    const base = from.day * 1440 + from.hour * 60 + from.minute + value * step;
    return {
      day: Math.floor(base / 1440),
      hour: Math.floor((base % 1440) / 60),
      minute: base % 60,
    };
  };
  const apply = (at: TafExpandAt): void => {
    const text =
      fmtTafAt(at, locale) +
      (ltOffset !== null && locale === "zh" ? fmtTafLt(at, ltOffset, "京") : "");
    label.textContent = text;
    input.setAttribute("aria-valuetext", text); // 读屏不朗读裸格值（评测工程 P2-3）
    void setTafLayerTime(map, options.layer, options.items, { ...options.layerOptions, at });
    options.onTime?.(at);
  };
  // rAF 合帧（评测工程 P2-1）：拖动的高频 input 每帧至多一次全图更新
  let rafPending = false;
  input.addEventListener("input", () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      apply(atOfValue(Number(input.value)));
    });
  });
  // 缺省落在第 0 格；宿主可用 setTafLayerTime 自定初始时刻后拨动
  apply(atOfValue(0));
  box.append(input, label);
  // 端点标注（复测小白#11：无刻度无范围的「盲拖」——两端起止时刻各带京时，10px 灰字通栏）
  const ticks = document.createElement("div");
  ticks.style.cssText =
    "display:flex;justify-content:space-between;width:100%;font-size:10px;color:#6b7785";
  const ltText = (at: TafExpandAt): string =>
    ltOffset !== null && locale === "zh" ? fmtTafLt(at, ltOffset, "京") : "";
  const tickL = document.createElement("span");
  tickL.textContent = `${fmtTafAt(from, locale)}${ltText(from)}`;
  const tickR = document.createElement("span");
  tickR.textContent = `${fmtTafAt(atOfValue(spanSteps), locale)}${ltText(atOfValue(spanSteps))}`;
  ticks.append(tickL, tickR);
  box.append(ticks);
  return box;
}
