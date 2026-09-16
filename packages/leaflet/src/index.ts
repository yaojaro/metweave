/**
 * @metweave/leaflet — Leaflet 适配器：报文卡片上图的桥接层。
 * The Leaflet adapter: puts metweave report cards onto a Leaflet map.
 *
 * v0.1 唯一地图适配器；更多地图库适配（MapLibre 等）在路线图上。
 * 兼容契约 = Leaflet overlay 能力：底图瓦片是宿主侧一行 L.tileLayer 配置，本包不做任何绑定，
 * 也不推荐或代理任何底图服务——底图由使用者按自己的授权自行选择。
 */
import type * as Leaflet from "leaflet";
import type { CloudElement, MetarReport, WeatherGroup } from "@metweave/core";
import { toValues } from "@metweave/core";
import { renderCard } from "@metweave/render";

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
 * - poor（红）= 能见度 < 1500 m，或云底 < 1000 ft，或天气含 TS 族（任何雷暴，含 VC 邻近）
 *   或现象含 GR/VA，或 + 强度显著降水，或阵风 ≥ 25 m/s，或云组含 CB/TCU，或跑道关闭
 * - caution（琥珀）= 能见度 1500–4800 m，或云底 1000–3000 ft，或任何降水族（RA/SN 等），
 *   或 FZ 族（结冰），或阵风 15–25 m/s
 * - good（绿）= 其余（含 CAVOK）
 * 缺测要素不参与限制（按可得要素判，见 conditionOf 内 unknown 判据的例外）；阈值细则随口径审定后修订。
 */
function conditionOf(report: MetarReport): ConditionTier {
  if (report.nil === true) return "unknown";
  const v = toValues(report);
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
    const heavyPrecip =
      g.intensity === "+" &&
      (g.descriptor === "SH" || g.phenomena.some((p) => PRECIP_PHENOMENA.has(p)));
    if (thunderstorm || hailOrAsh || heavyPrecip) return "poor";
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
    if (visMeters < 4800) return "caution";
  }
  if (ceiling < 3000) return "caution";
  for (const g of v.weather ?? []) {
    const freezing = g.descriptor === "FZ";
    const precip = g.phenomena.some((p) => PRECIP_PHENOMENA.has(p));
    if (freezing || precip) return "caution";
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
