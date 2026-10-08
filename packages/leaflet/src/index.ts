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
// 判据核心单源在 @metweave/core（v0.3 方案 C 下沉——leaflet 站点档位与 render 卡片行色
// 双消费点归位，根治 0.1.2 式「两包同改」）；本包保留展示面（TIER_COLORS/TIER_WORDS）与注入接线
import {
  assertConditionTier,
  conditionTierOf,
  isConditionUnknown,
  metarTierOf,
} from "@metweave/core";
import type { ConditionInput, ConditionTier } from "@metweave/core";
import {
  buildColorScale,
  renderToImageData,
  contoursOf,
  centersOf,
  windBarbsOf,
  type ColorScale,
} from "@metweave/grid";
import type { ElementProfile, Grid } from "@metweave/grid";
import { renderCard, renderTafCard, summarizeTafConditions } from "@metweave/render";
import type { RenderTafCardOptions, TafCalendarAnchor } from "@metweave/render";
import { expandTaf } from "@metweave/parser";
import type {
  TafExpandAt,
  TafMonthAnchor,
  TafReport,
  TafResolvedConditions,
} from "@metweave/parser";

// 公开选项（AddTafLayerOptions.at / TafTimeControlOptions.initialAt）以 TafExpandAt 为形参、
// TafLayerItem.report 以 TafReport 为形参——类型随包再导出，宿主（如 examples）不必穿透到 @metweave/parser 取型
export type { TafExpandAt, TafReport, TafCalendarAnchor };

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
   *  判据为本库自拟的扫视启发式（初稿待审，见 @metweave/core 的 conditionTierOf 注释）——不对应任何官方飞行天气分类，
   *  不得用作运行判据；
   *  开启时 tooltip 同时追加一行要素摘要（能见度/天气/最差云；NIL 与关键组全缺测站显示「缺报/数据缺测」），
   *  圆点 aria-label 追加档位词（zh「天气好/差…」/ en「Weather …」，语言随 card.locale） */
  conditionColors?: boolean;
  /** 档位判据注入（v0.3 方案 C：合法替换通道——承认内置判据不权威，就给整体换掉的把手）：
   *  `(report) => ConditionTier` 自定判据函数，缺省走 @metweave/core 的内置判据（metarTierOf）。
   *  一处注入三层生效：① 圆点色 ② aria 档位词 ③ 弹窗卡片（tierOf 转发给 renderCard，
   *  卡根写 data-tier 机读档位、行色与内置判据同源 core 单源管线）。三层生效前提：
   *  ①② 需 conditionColors: true，③ 恒生效（卡片档位标识不依赖圆点模式）。
   *  注入函数每站会被调用两次（conditionColors: true 且弹窗开启时——圆点层一次、卡片层一次；
   *  判据应为纯函数，带副作用的自定判据须自知此重复求值）。宿主同传顶层 tierOf 与
   *  card.tierOf 时 card 级优先（顶层仅在 card 级缺席时转发）。
   *  返回值运行时校验 ∈ ConditionTier 合法值集（core 的 CONDITION_TIERS 单源）：非法档位串
   *  （如 "por"）与注入函数抛错同口径失败。不静默纪律：注入函数抛错＝整次 addMetarLayer
   *  调用失败（Promise 拒绝、整层不上图）——绝不静默回退内置判据（回退即「注入悄悄不生效」）。 */
  tierOf?: (report: MetarReport) => ConditionTier;
  /** bindPopup 选项透传（autoPanPadding 族等——宿主为固定悬浮层留避让边时用；
   *  本库缺省只设 maxWidth=卡片设计宽，宿主显式键覆盖之） */
  popupOptions?: Leaflet.PopupOptions;
}

/** addMetarLayer 的合法选项键（运行时校验用——拼错的选项键静默忽略违反本库不静默纪律） */
const ADD_METAR_LAYER_OPTION_KEYS: ReadonlySet<string> = new Set([
  "locale",
  "popup",
  "card",
  "conditionColors",
  "tierOf",
  "popupOptions",
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

/** 四档条件档位名（@metweave/core 判据单源的类型；随包再导出——宿主不必穿透取型，2026-09-24 评测批2#3） */
export type { ConditionTier };

/**
 * 四档条件色单一来源（2026-09-24 评测批2#3：图例/面板/圆点色值不一致——两套色系并存）。
 * 宿主图例与列表色点应引用本表而非自抄色值（编译期同源，显示层永不漂移）；
 * 与卡片 mw-danger/mw-caution 同族色相：灰=不明、红=差、琥珀=注意、绿=好
 */
export const TIER_COLORS: Record<ConditionTier, string> = {
  unknown: "#8a94a0",
  poor: "#d05656",
  caution: "#e0a13c",
  good: "#3aa657",
};

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

// —— 档位判据（四档气象条件分级）已下沉 @metweave/core 判据单源（tier 模块）：
// conditionTierOf（TAF 投影输入面）/ metarTierOf（METAR 直收）——判据语义、诚实声明与
// WS/SQ 增补注记一律见 core 的 tier 模块注释；本包只做消费接线与展示（圆点/aria/弹窗）。

/** 圆点层档位求值：注入在位时校验返回值 ∈ CONDITION_TIERS（core 单源合法值集）——非法档位
 *  串（如 "por"）会静默破相（背景/aria 双 undefined），与注入函数抛错同口径整次调用失败；
 *  内置判据（metarTierOf）免检：返回面由 core 类型与测试面恒锁合法。 */
function resolveDotTier(
  report: MetarReport,
  tierOf: ((report: MetarReport) => ConditionTier) | undefined,
): ConditionTier {
  if (tierOf === undefined) return metarTierOf(report);
  const tier = tierOf(report);
  assertConditionTier(tier);
  return tier;
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
 * NIL 站显示「缺报（NIL）」、关键组全缺测站显示「数据缺测」（与 conditionTierOf 的 unknown 判据同款口径）。
 */
function summarizeReport(report: MetarReport, locale: "zh" | "en"): string {
  if (report.nil === true) return locale === "en" ? "No report (NIL)" : "缺报（NIL）";
  if (report.cavok) return "CAVOK";
  const v = toValues(report);
  // 关键组全缺测（判据单源谓词，与 conditionTierOf 灰档同款口径）：要素摘要无从拼起，
  // 显示缺测占位而非空行
  if (isConditionUnknown(report)) return locale === "en" ? "Data missing" : "数据缺测";
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
  // 最显著天气优先集：TS/FZ 描述符族、GR 冰雹、+ 强度（与 core danger 集对齐——FZ 此前
  // 缺席属单源化残留，冻降水组优先于普通降水组入选摘要）
  const significant =
    weather.find(
      (g) =>
        g.descriptor === "TS" ||
        g.descriptor === "FZ" ||
        g.phenomena.includes("GR") ||
        g.intensity === "+",
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
      // aria-label 追加档位词（a11y 1.4.1：档位不只靠颜色传达；语言随 card.locale，缺省中文）。
      // 档位判据：宿主注入 tierOf 优先（方案 C 合法替换通道），缺省走 core 内置判据；
      // 注入函数抛错或返回非法档位即整次调用失败（不 try/catch 吞错——回退内置判据＝注入悄悄不生效）
      const tier = resolveDotTier(item.report, options.tierOf);
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
      // tierOf 注入转发（一处注入三层生效的第三层）：弹窗卡片档位标识与注入判据一致
      if (cardOpts.tierOf === undefined && options.tierOf !== undefined) {
        cardOpts.tierOf = options.tierOf;
      }
      const stationName =
        item.title !== undefined && item.title.startsWith(`${item.report.station} `)
          ? item.title.slice(item.report.station.length + 1)
          : undefined;
      if (cardOpts.stationTitle === undefined && stationName !== undefined) {
        cardOpts.stationTitle = stationName;
      }
      marker.bindPopup(renderCard(item.report, cardOpts), {
        maxWidth: 420,
        ...options.popupOptions,
      });
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

/** TAF 展开结果 → 判据输入面投影（runwayStates/windShear 恒缺省——TAF 语汇无跑道状态与风切变组位） */
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

/**
 * TAF 展开摘要（一行，人话优先——2026-09-24 评测批2#4：旧电码串「≥10 km · -TSRA · SCT040」
 * 对非专业是密码；现复用 @metweave/render 的 gloss 词表单一来源，tooltip/置顶提示同款）：
 * 「能见度 ≥10 km · 雷暴伴雨（飞行威胁大） · 疏云，云底约 700 米」；电码在卡内 RAW 区可查。
 */
function summarizeTaf(c: TafResolvedConditions, locale: "zh" | "en"): string {
  if (c.cavok) return "CAVOK";
  const text = summarizeTafConditions(c, locale);
  if (text !== "") return text;
  return locale === "en" ? "No elements" : "无要素组";
}

export interface TafLayerItem {
  /** 已解析的 TAF 报文 IR */
  report: TafReport;
  /** 站点坐标（WGS-84 [lat, lon]） */
  position: [number, number];
  /** 站点提示（tooltip 文案，缺省用 IR 站名） */
  title?: string;
  /** 月锚（真实年月，month 1–12）：该报文日号归属的日历月——在位且层带 calendarAnchor 时，
   *  层连续序 at 在展开/渲染前归一到本报锚月（跨月报池各自正确，2026-09-24 评测 P1 月界批）；
   *  缺席时走层全局 anchorDays 的 %31 折回（显示位残余近似，见 anchorize 注释） */
  monthAnchor?: TafCalendarAnchor;
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
  /** 日历月锚（2026-09-24 评测 P1 月界批）：at 视为「自该月 1 日起的连续日序」（day 可超月长），
   *  与各 item.monthAnchor 联用把 at 归一到每报锚月——跨月报池（如 9 月末混入 10 月 1 日生效报）
   *  展开与显示各报正确；在位时忽略 anchorDays（月天数按真实月历逐报计算） */
  calendarAnchor?: TafCalendarAnchor;
  /** 点击站点时以弹窗展示预报摘要（缺省开启；层② 的完整 TAF 卡片在后续版本） */
  popup?: boolean;
  /** renderTafCard 透传（raw/className/stationTitle/utcOffsetMinutes——宿主定制 TAF 卡；
   *  at/monthAnchor 由图层按当前时刻与各报锚注入，不接受层级传入） */
  card?: Omit<RenderTafCardOptions, "locale" | "at" | "monthAnchor">;
  /** bindPopup 选项透传（autoPanPadding 族等——宿主为固定悬浮层留避让边时用；
   *  本库缺省只设 maxWidth=卡片设计宽 480，宿主显式键覆盖之） */
  popupOptions?: Leaflet.PopupOptions;
}

const ADD_TAF_LAYER_OPTION_KEYS: ReadonlySet<string> = new Set([
  "locale",
  "at",
  "anchorDays",
  "calendarAnchor",
  "popup",
  "card",
  "popupOptions",
]);

/**
 * Put parsed TAF stations onto a Leaflet map as forecast markers at one instant — the four-tier
 * dot, tooltip and popup are driven by `expandTaf` (renderer layer ①: forecast-as-observation).
 * 把一组 TAF 站点按同一时刻的预报值挂上地图：四档圆点/tooltip/弹窗全部由 expandTaf 展开
 * 结果驱动（渲染层①「预报当观测渲」——判据/圆点/摘要与 METAR 侧同一条管线）。
 * 档位判据为本库自拟扫视启发式（口径见 @metweave/core 的 tier 模块注释）——**预报值套判据同样不得用作运行判据**，
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
/** zoom ≥ 5 常显 ICAO 码，低于则收（39 站全显互相压盖；评测签派 P0-1 的缩放分级折中）。
 *  生命周期注：本监听绑在 map 容器上、不随层移除（WeakSet 防重复绑定）——同容器重建 map
 *  的宿主场景会残留旧监听，监听体幂等无害；彻底规避请换容器或销毁 map。 */
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
/** 各层的日历月锚（2026-09-24 评测 P1 月界批）：at 连续序「自该月 1 日起」的基准月 */
const tafLayerCalendar = new WeakMap<Leaflet.LayerGroup, TafCalendarAnchor>();
/** 各层的可变 card 选项覆盖（时区单制：setTafLayerTime 带 card 即合并——切时区不清层重建、
 *  滑杆换时刻不带 card 不回退；弹窗刷新读此处而非建层闭包，已开弹窗即时随时区换内容） */
const tafLayerCard = new WeakMap<
  Leaflet.LayerGroup,
  Omit<RenderTafCardOptions, "locale" | "at" | "monthAnchor">
>();
/** marker → 其 TafLayerItem（换时刻原地更新时的数据面） */
const tafMarkerItems = new WeakMap<Leaflet.Marker, TafLayerItem>();
/** marker → 弹窗内容刷新函数（复测 N1/N2：刷新不走合成 popupopen——真实打开才移焦点，刷新按当前时刻重算置顶提示） */
const tafPopupRefresh = new WeakMap<Leaflet.Marker, (popup: Leaflet.Popup) => void>();

/** 查看时刻是否在该报文有效期外（含窗前/窗后——出窗＝灰点「预报未生效/已过期」） */
/** 日时 → 分钟序（出窗比较用；TAF 无月，同报文语境内日号自洽） */
const absDayHour = (d: number, h: number): number => (d - 1) * 1440 + h * 60;

/** 真实月历：某年月的天数（2026-09-24 评测 P1 月界批） */
const daysInMonthOf = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** 年月 → 序数（锚距比较用） */
const calendarIndex = (c: TafCalendarAnchor): number => c.year * 12 + (c.month - 1);

/**
 * 单站时刻归一（2026-09-24 评测 P1 月界批）：
 * - 显式层时刻 contAt（calendarAnchor 基的连续日序，可超月长）→ 经 anchorize 换算到本报锚月；
 * - contAt 缺省（层尚无统一时刻）→ 各站自身有效期起点（已在本报锚内，原样直用，月天数按报锚真月历）。
 * 返回喂 expandTaf/tafMarkerState 的 at+daysIn，cal 供 renderTafCard 走真月历显示。
 */
function stationNorm(
  item: TafLayerItem,
  contAt: TafExpandAt | undefined,
  layerCal: TafCalendarAnchor | undefined,
  fallbackDaysIn: number,
): { at: TafExpandAt; daysIn: number; cal?: TafCalendarAnchor } {
  const v = item.report.validity;
  const ownStart: TafExpandAt = { day: v?.startDay ?? 0, hour: v?.startHour ?? 0, minute: 0 };
  const itemCal = item.monthAnchor;
  if (contAt === undefined) {
    return {
      at: ownStart,
      daysIn: itemCal !== undefined ? daysInMonthOf(itemCal.year, itemCal.month) : fallbackDaysIn,
      cal: itemCal,
    };
  }
  return anchorize(item, contAt, layerCal, fallbackDaysIn);
}

/**
 * 层连续序 at → 该报锚月内的归一（2026-09-24 评测 P1 月界批，跨月报池收口）：
 * item.monthAnchor 与层 calendarAnchor 都在位时，把 at 的连续日序（自层锚月 1 日起、可超月长）
 * 换算到本报锚月内的日号，并按真实月历给该月天数（供报文 validity 回绕）——月末跨月的
 * 混合报池（9 月末的在效报 + 10 月 1 日生效报）展开与显示各报正确。
 * 缺任一锚（或锚病态相差超 24 个月）时原样返回 + 层全局 anchorDays 的 %31 折回——残余近似
 * 仅显示与回绕位：报文本身无月份，无锚即无从换算；档位判读的要素合成不依赖日号显示 */
function anchorize(
  item: TafLayerItem,
  at: TafExpandAt,
  layerCal: TafCalendarAnchor | undefined,
  fallbackDaysIn: number,
): { at: TafExpandAt; daysIn: number; cal?: TafCalendarAnchor } {
  const itemCal = item.monthAnchor;
  if (itemCal === undefined || layerCal === undefined) {
    return { at, daysIn: fallbackDaysIn };
  }
  const diff = calendarIndex(itemCal) - calendarIndex(layerCal);
  if (diff < -24 || diff > 24) {
    return { at, daysIn: fallbackDaysIn }; // 病态锚距（脏数据防御）：折回近似兜底
  }
  // 报锚月 1 日相对层锚月 1 日的天数（逐月累加，双向）
  let firstCont = 1;
  let y = layerCal.year;
  let m = layerCal.month;
  for (let i = 0; i < Math.abs(diff); i += 1) {
    if (diff > 0) {
      firstCont += daysInMonthOf(y, m);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    } else {
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      firstCont -= daysInMonthOf(y, m);
    }
  }
  return {
    at: { ...at, day: at.day - (firstCont - 1) },
    daysIn: daysInMonthOf(itemCal.year, itemCal.month),
    cal: itemCal,
  };
}

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
  let summary =
    r.nil === true
      ? locale === "en"
        ? "No report (NIL)"
        : "缺报（NIL）"
      : r.cancelled === true
        ? locale === "en"
          ? "Forecast cancelled (CNL)"
          : "预报取消（CNL）"
        : "";
  const notes: string[] = [];
  if (!noTimeline && v !== undefined && outOfValidity(r, at)) {
    // 出窗：灰 unknown（签派复测 N2——「无有效预报」本身是运行信息；卡内有对应出界提示行）
    const early = absDayHour(at.day, at.hour) < absDayHour(v.startDay, v.startHour);
    notes.push(
      early
        ? locale === "en"
          ? "Forecast not yet in effect (showing issued base conditions)"
          : "预报尚未生效（按发布时基况显示）"
        : locale === "en"
          ? "Forecast expired (showing the last segment)"
          : "预报已过期（按末段显示）",
    );
    return {
      tier: "unknown",
      label: `${name} · ${locale === "en" ? `Forecast ${early ? "not yet in effect" : "expired"}` : `预报${early ? "未生效" : "已过期"}`}`,
      summary,
      notes,
    };
  }
  if (!noTimeline && v !== undefined) {
    const expansion = expandTaf(r, at, anchor);
    // 发作窗内档位/摘要按「主导段 + TEMPO 叠加」合成态（实测批：雷雨发作窗圆点不升档＝
    // 图上永远看不到危险窗——叠加合并式与下方提示语同一份，单一来源不漂移）。
    // spread 即继承：tempo 未列的要素（含天气）沿用主导段——FM 51 语义「变化组只改所列要素」，
    // NSW（显式无天气）与整列替换由 expand 层三态契约表达（weather 省略≠[]）
    const effective =
      expansion.tempo !== undefined
        ? { ...expansion.conditions, ...expansion.tempo.conditions }
        : expansion.conditions;
    tier = conditionTierOf(asConditionInput(effective, false));
    summary = summarizeTaf(effective, locale);
    if (expansion.uncertain)
      notes.push(
        locale === "en" ? "Transition band — timing uncertain" : "过渡带（变化时刻不确定）",
      );
    if (expansion.tempo !== undefined) {
      // 提示语只标注双态语义（发作态摘要即上方 summary，不重复整段）
      notes.push(
        locale === "en"
          ? "TEMPO bursts possible — summary shows burst conditions"
          : "含 TEMPO 间歇变化——摘要为发作时刻状态",
      );
    }
  } else if (v !== undefined) {
    notes.push(locale === "en" ? `Validity ${v.raw}` : `有效期 ${v.raw}`);
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
  const fallbackDaysIn = options.anchorDays ?? 31;
  const layerCal = options.calendarAnchor;
  const locale = options.locale ?? "zh";
  if (layerCal !== undefined) tafLayerCalendar.set(group, layerCal); // 月界批：层连续序 at 的基准月
  tafLayerCard.set(group, options.card ?? {}); // 可变 card 覆盖的初值（setTafLayerTime 带 card 时合并更新）
  for (const item of items) {
    // 月界批：显式 at ＝层连续序（calendarAnchor 基）→ 归一到本报锚月；缺省各站自起点（报锚内原值）
    const norm = stationNorm(item, options.at, layerCal, fallbackDaysIn);
    const state = tafMarkerState(item, norm.at, { daysIn: norm.daysIn }, locale);
    const { icon, tip } = tafMarkerIcon(L, item, state);
    const marker = L.marker(item.position, { icon });
    tafMarkerItems.set(marker, item);
    marker.bindTooltip(tip);

    if (options.popup ?? true) {
      // 惰性弹窗（评测工程 P2-1）：占位 DOM 只在 popupopen 时换真卡——滑杆换时刻不清层，重开即见新时刻卡；
      // maxWidth 480 = 卡片设计宽（加宽指令，renderTafCard max-width 同步）
      marker.bindPopup(document.createElement("div"), { maxWidth: 480, ...options.popupOptions });
      // 刷新函数（复测 N1/N2）：按层当前时刻重展开取 notes（置顶提示随换时刻更新，与 tooltip 同源），
      // 只重建卡片内容不动焦点——焦点移入仅发生在真实 popupopen（键盘拖滑杆不再被抢焦）；
      // card 选项读层的可变覆盖（tafLayerCard）而非建层闭包——切时区后已开弹窗即时换内容（）；
      // 报文数据面同样现读 item.report（方案B：宿主原位换报——如按查看时刻切换上一周期在效报——
      // 换报后已开弹窗即时跟随新报，捕获建层时的 r/noTimeline 会停在旧报）；
      // 月界批：层连续序 current 归一到本报锚月再喂展开/渲染（跨月报池各报正确），card 注入本月锚
      const refresh = (popup: Leaflet.Popup): void => {
        const rNow = item.report;
        const noTimelineNow = rNow.nil === true || rNow.cancelled === true;
        // 月界批：层连续序 currentCont 归一到本报锚月再喂展开/渲染（跨月报池各报正确），card 注入本月锚；
        // 层尚无统一时刻（未传 at）→ 各站自身起点（报锚内原值）
        const currentCont = tafLayerAt.get(group);
        const normNow = stationNorm(
          item,
          noTimelineNow ? undefined : currentCont,
          tafLayerCalendar.get(group),
          fallbackDaysIn,
        );
        const fresh = tafMarkerState(item, normNow.at, { daysIn: normNow.daysIn }, locale);
        const cardOpts: RenderTafCardOptions = {
          locale,
          raw: true,
          ...(currentCont === undefined || noTimelineNow ? {} : { at: normNow.at }),
          ...tafLayerCard.get(group),
        };
        if (normNow.cal !== undefined) cardOpts.monthAnchor = normNow.cal;
        if (cardOpts.stationTitle === undefined && item.title !== undefined) {
          const stationName = item.title.startsWith(`${rNow.station} `)
            ? item.title.slice(rNow.station.length + 1)
            : undefined;
          if (stationName !== undefined) cardOpts.stationTitle = stationName;
        }
        const card = renderTafCard(rNow, cardOpts);
        // 卡内限高滚动（）的滚轮隔离由 Leaflet 弹窗内建 disableScrollPropagation(contentNode)
        // 提供（只截传播不拦默认滚动——实测勿再叠加自带监听：纯冗余）；行为锁见 index.test.ts C14
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

/**
 * METAR 档位判据公共面（@metweave/core 判据单源的随包再导出，tafTierOf 同款管线）：
 * 实况面板/图例等消费方与圆点同一判据（数据直读，不从 DOM 回流——批3#14 口径）；
 * 宿主按自身运行标准重分档请走 `addMetarLayer` 的 `tierOf` 注入通道，本函数恒为内置缺省判据。
 */
export { metarTierOf } from "@metweave/core";

/** METAR 要素摘要公共面（summarizeReport 薄包装）：「2500m +TSRA BKN030CB」式扫视摘要。 */
export function summarizeMetarConditions(report: MetarReport, locale: "zh" | "en"): string {
  return summarizeReport(report, locale);
}

/** 单站某时刻的档位（数据直读，2026-09-24 评测批3#14）：与地图圆点同一判据管线
 *  （含出窗灰、TEMPO 发作窗升档、NIL/CNL 灰）——宿主面板/对比基准不再从 marker DOM
 *  className 正则回读（状态经渲染产物回流的工程债收口），DOM 只做展示。
 *  at 语义同 addTafLayer：calendarAnchor 在位时为层连续序（逐报归一），否则为报锚内日号。 */
export function tafTierOf(
  item: TafLayerItem,
  at: TafExpandAt,
  options: { anchorDays?: number; calendarAnchor?: TafCalendarAnchor } = {},
): ConditionTier {
  const norm = stationNorm(item, at, options.calendarAnchor, options.anchorDays ?? 31);
  return tafMarkerState(item, norm.at, { daysIn: norm.daysIn }, "zh").tier;
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
  const fallbackDaysIn = options.anchorDays ?? 31;
  const locale = options.locale ?? "zh";
  if (options.calendarAnchor !== undefined) tafLayerCalendar.set(layer, options.calendarAnchor);
  // 缺省 at：保持层当前时刻（不回退到非法 0 日——复测 N5；层尚无时刻时退各站自身有效期起点）
  const at = options.at ??
    tafLayerAt.get(layer) ?? {
      day: items[0]?.report.validity?.startDay ?? 1,
      hour: items[0]?.report.validity?.startHour ?? 0,
      minute: 0,
    };
  if (options.at !== undefined) tafLayerAt.set(layer, options.at);
  // card 覆盖合并（时区单制）：带 card 即更新层的可变覆盖并刷新已开弹窗；不带（滑杆换时刻）不回退
  if (options.card !== undefined) {
    tafLayerCard.set(layer, { ...tafLayerCard.get(layer), ...options.card });
  }
  const openRefresh: Leaflet.Marker[] = [];
  layer.eachLayer((ml) => {
    if (!(ml instanceof L.Marker)) return; // 层内非 marker（弹窗代理等）跳过
    const marker: Leaflet.Marker = ml;
    const item = tafMarkerItems.get(marker);
    if (item === undefined) return;
    // 月界批：显式/既有层连续序 at 归一到本报锚月（缺省回退各站自身有效期起点，报锚内原值）
    const norm = stationNorm(item, at, tafLayerCalendar.get(layer), fallbackDaysIn);
    const state = tafMarkerState(item, norm.at, { daysIn: norm.daysIn }, locale);
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

/** 控件时刻显示·本地时（时区单制）：tag+M月D日HH:MM——月位显式（2026-09-24 评测 P1 月界批）：
 *  calendarAnchor 在位时走真实月历（at 为自锚月 1 日起的连续日序，day>31 按进位恒正确、跨月不回绕）；
 *  缺席时按 31 天折回（残余近似仅显示位：无月语境无从判读真实月份，控件值本身不受影响） */
const fmtTafZone = (
  at: TafExpandAt,
  offset: number,
  tag: string,
  cal?: TafCalendarAnchor,
): string => {
  if (cal !== undefined && at.day >= 1) {
    // 日号超锚月长度（如 9 月锚的 31）＝连续序进位（10 月 1 日），Date.UTC 自动进位恒正确
    //（月吻合守卫曾把进位误判病态回退折回——2026-09-24 复验收口；电码日号不超当月，无需守卫）
    const z = new Date(
      Date.UTC(cal.year, cal.month - 1, at.day, at.hour, at.minute) + offset * 60_000,
    );
    return `${tag}${z.getUTCMonth() + 1}月${z.getUTCDate()}日${String(z.getUTCHours()).padStart(2, "0")}:${String(z.getUTCMinutes()).padStart(2, "0")}`;
  }
  const total = (at.day - 1) * 1440 + at.hour * 60 + at.minute + offset;
  const d = (Math.floor(total / 1440) % 31) + 1;
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  return `${tag}${String(d).padStart(2, "0")}日${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** TafExpandAt ↔ 绝对分钟序（窗/刻度格计算共用；day-1 基准使跨日差值可直接加减） */
const tafAbsOf = (at: TafExpandAt): number => (at.day - 1) * 1440 + at.hour * 60 + at.minute;
const tafAtOfAbs = (abs: number): TafExpandAt => ({
  day: Math.floor(abs / 1440) + 1,
  hour: Math.floor((abs % 1440) / 60),
  minute: abs % 60,
});

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
  /** 轴内刻度间隔（分钟；缺省＝仅两端起止标注）。刻度对齐整点（自窗内首个对齐刻度起），
   *  日界（展示时区的 00 时）标 dd日，标签随展示时区单制——底部时间轴批 */
  tickEveryMinutes?: number;
  /** 显示语言（缺省 zh；en 不加「日」字与本地时——评测工程 P2-3 i18n 漏网） */
  locale?: "zh" | "en";
  /** 展示时区偏移（分钟）——单制：缺省 null＝UTC 单制；zh 传 480＝北京时单制（标签与两端标注同随） */
  utcOffsetMinutes?: number | null;
  /** 日历月锚（2026-09-24 评测 P1 月界批）：滑杆零点所在真实年月（month 1–12）——from/to/at 视为
   *  自该月 1 日起的连续日序（day 可超月长），北京时标签走真实月历、跨月不回绕；缺省 31 天折回显示 */
  calendarAnchor?: TafCalendarAnchor;
  /** 初始时刻（缺省＝滑杆零点）；时区切换等重建控件场景用来保住当前拨动位置（落到最近格） */
  initialAt?: TafExpandAt;
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
  const ltOffset = options.utcOffsetMinutes ?? null; // 单制：缺省 UTC（旧 zh 缺省京时括注退役）
  const cal = options.calendarAnchor; // 月界批：真月历锚（缺省 31 天折回显示）
  const zoneText = (at: TafExpandAt): string =>
    ltOffset !== null && locale === "zh"
      ? fmtTafZone(at, ltOffset, "北京时", cal)
      : fmtTafAt(at, locale);
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
  const fromAbs = tafAbsOf(from);
  // 显式 to 优先（时间轴批：宿主自定「现在+24h」窗）——此前该选项有文档无接线，静默忽略违不静默纪律，本批修
  const toAbs =
    options.to !== undefined ? tafAbsOf(options.to) : (toAbsMax ?? fromAbs + 100 * step);
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
    const text = zoneText(at);
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
  // 初始位置：缺省第 0 格；initialAt 落到最近格（时区切换重建控件不丢当前时刻）
  const idxOf = (at: TafExpandAt): number =>
    Math.max(
      0,
      Math.min(
        spanSteps,
        Math.round(
          (at.day * 1440 +
            at.hour * 60 +
            at.minute -
            (from.day * 1440 + from.hour * 60 + from.minute)) /
            step,
        ),
      ),
    );
  input.value = String(idxOf(options.initialAt ?? from));
  apply(atOfValue(Number(input.value)));
  box.append(input, label);
  if (options.tickEveryMinutes !== undefined) {
    // 轴内刻度（底部时间轴批）：对齐整点的等距标注（自窗内首个对齐刻度起），
    // 日界（展示时区 00 时）标 dd日、其余标 HH:MM，随展示时区单制；终点恒标注（right 锚防溢出）
    const every = Math.max(step, options.tickEveryMinutes);
    const first = Math.ceil((fromAbs + 1) / every) * every;
    const total = toAbs - fromAbs;
    const axis = document.createElement("div");
    axis.style.cssText =
      "position:relative;height:15px;margin-top:4px;width:100%;font-size:10px;color:#6b7785";
    /** 刻度短标签：整点 HH:00；展示时区 00 时＝日界 M月D日（calendarAnchor 真月历，月界批） */
    const tickText = (at: TafExpandAt): string => {
      if (ltOffset !== null && locale === "zh") {
        if (cal !== undefined && at.day >= 1) {
          const z = new Date(
            Date.UTC(cal.year, cal.month - 1, at.day, at.hour, at.minute) + ltOffset * 60_000,
          );
          return z.getUTCHours() === 0 && z.getUTCMinutes() === 0
            ? `北京时${z.getUTCMonth() + 1}月${z.getUTCDate()}日`
            : `北京时${String(z.getUTCHours()).padStart(2, "0")}:${String(z.getUTCMinutes()).padStart(2, "0")}`;
        }
        const z = tafAtOfAbs(tafAbsOf(at) + ltOffset);
        const day = ((z.day - 1) % 31) + 1; // 无锚折回（残余近似仅显示位，见 fmtTafZone 注释）
        return z.hour === 0 && z.minute === 0
          ? `北京时${String(day).padStart(2, "0")}日`
          : `北京时${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;
      }
      return at.hour === 0 && at.minute === 0
        ? `${String(at.day).padStart(2, "0")}日`
        : `${String(at.hour).padStart(2, "0")}:${String(at.minute).padStart(2, "0")}`;
    };
    const addTick = (abs: number, anchorRight = false): void => {
      const s = document.createElement("span");
      s.textContent = tickText(tafAtOfAbs(abs));
      s.style.cssText = anchorRight
        ? "position:absolute;right:0;white-space:nowrap"
        : `position:absolute;left:${(((abs - fromAbs) / total) * 100).toFixed(3)}%;transform:translateX(-50%);white-space:nowrap`;
      axis.append(s);
    };
    // 与终点相距不足一格的尾刻度跳过（防标签相撞）
    for (let a = first; a <= toAbs - every / 2; a += every) addTick(a);
    addTick(toAbs, true);
    box.append(axis);
    return box;
  }
  // 端点标注（复测小白#11：无刻度无范围的「盲拖」——两端起止时刻随展示时区单制，10px 灰字通栏）
  const ticks = document.createElement("div");
  ticks.style.cssText =
    "display:flex;justify-content:space-between;width:100%;font-size:10px;color:#6b7785";
  const tickL = document.createElement("span");
  tickL.textContent = zoneText(from);
  const tickR = document.createElement("span");
  tickR.textContent = zoneText(atOfValue(spanSteps));
  ticks.append(tickL, tickR);
  box.append(ticks);
  return box;
}

// ---------------------------------------------------------------- 格点填色图层（v0.3：色斑图）

/**
 * Options for addGridLayer: render resolution and fill opacity.
 * addGridLayer 的选项：渲染分辨率与色斑不透明度。
 */
export interface AddGridLayerOptions {
  /** 渲染宽（像素列）；缺省 = 2 × 网格列数（超采样——逐像素对场值双线性取样而非放大
   *  已着色像素，档界平滑无网眼；GFS 中国域 280 列 ×2 仍是亚毫秒级渲染）。内存注：产物经
   *  canvas 转 PNG dataURL，全球 0.25°（1440 列 → 2880px）尚可，更密网格请显式传较小
   *  width 钳制（移动端超大 canvas 有内存压力），或直接用 @metweave/grid 的
   *  renderToImageData 自行出图。 */
  width?: number;
  /** 色斑不透明度（0–1，缺省 0.6——色斑可辨且底图地名/省界仍可见）。经 `L.imageOverlay`
   *  原生图层不透明度生效（像素不预乘）：宿主可对返回的叠加层 `setOpacity(v)` 原地调节、
   *  不必重建层；缺测区恒透明不受影响。传入值收敛到 [0, 1]（与内核 renderToImageData 同口径） */
  opacity?: number;
  /** 自定义分级色标（业务定制位）：完整覆盖档案缺省的档位与色带。断点须写在**显示单位
   *  空间**（与 profile.toDisplay 换算后的场值比对，如 tmp 档案用 °C 断点）；严格递增、
   *  色带合法（#rgb/#rgba/#rrggbb/#rrggbbaa，alpha < 255 即半透明档），非法即抛错不静默。
   *  缺省 = 档案缺省模式（buildColorScale(profile, stats)）——色标与档位的内置推荐口径
   *  仍是单一事实来源，本选项只在使用方按自身业务需要覆盖时介入。用法两式：
   *  ① `equalStepBreaks`/`quantileBreaks` 生成断点 ＋ 自有色带；② 从档案派生：
   *  `{ ...tmpProfile, colorStops: myColors, equal: { min: 0, max: 40, bins: 8 } }`
   *  后把派生档案传入 profile 参数（部分定制走这条路，无需本选项） */
  scale?: ColorScale;
}

/** 色斑层专用 pane 名：瓦片底图（tilePane，z 200）之上、矢量/标记/弹窗层（≥ 400）之下 */
const GRID_PANE = "mw-grid";
/** GRID_PANE 的 z-index：Leaflet 内置 pane 空隙位（tilePane 200 与 overlayPane 400 之间） */
const GRID_PANE_Z = 350;

/** addGridLayer 的合法选项键（运行时校验用——拼错的选项键静默忽略违反本库不静默纪律） */
const ADD_GRID_LAYER_OPTION_KEYS: ReadonlySet<string> = new Set(["width", "opacity", "scale"]);

/**
 * 格点 → 图层贴图边界（Leaflet LatLngBoundsExpression：[西南, 北东]）。
 * 网格头几何是格点中心坐标（la0 北界首行、lo0 西界首列）；贴图按像元边界外延半格
 * （north = la0+dj/2、south = 末行-dj/2、west = lo0-di/2、east = 末列+di/2）——
 * 与 renderToImageData 的像素中心采样几何一致，像素与地理一一对齐不歪半格。
 * 纯函数（不触 Leaflet），宿主自行 fitBounds/裁剪可用。
 */
export function gridOverlayBounds(grid: Grid): [[number, number], [number, number]] {
  const { nx, ny, la0, lo0, di, dj } = grid.header.grid;
  const north = la0 + dj / 2;
  const south = la0 - (ny - 1) * dj - dj / 2;
  const west = lo0 - di / 2;
  const east = lo0 + (nx - 1) * di + di / 2;
  return [
    [south, west],
    [north, east],
  ];
}

/**
 * Put a gridded scalar field onto a Leaflet map as a filled-contour (色斑图) image layer.
 * 把一个格点标量场以色斑图形态贴上 Leaflet 地图：要素档案（色标/档位/量纲换算的单一
 * 事实来源）＋ viz-ready 场 → 逐像素渲染 → canvas PNG → `L.imageOverlay` 贴网格几何边界。
 *
 * 档位取档案缺省模式（等距/分位数——分位数直读容器头预计算八分位）；换要素＝换档案
 * 文件，本 API 不动。图层挂独立 pane（`mw-grid`，z 350）——色斑恒在瓦片底图之上、
 * 宿主的矢量/标记/弹窗层之下，与各层装载次序无关。返回叠加层（可 map.removeLayer
 * 整层移除；不透明度 `setOpacity` 原地调；换层数据用 remove+add，原地 setData 的
 * 优化留后续版本）。异步：leaflet 惰性装载（同 addMetarLayer）。
 */
export async function addGridLayer(
  map: Leaflet.Map,
  grid: Grid,
  profile: ElementProfile,
  options: AddGridLayerOptions = {},
): Promise<Leaflet.ImageOverlay> {
  for (const key of Object.keys(options)) {
    if (!ADD_GRID_LAYER_OPTION_KEYS.has(key)) {
      throw new Error(`addGridLayer 收到未知选项 "${key}"（可用项见 AddGridLayerOptions）`);
    }
  }
  const opacity = Math.min(Math.max(options.opacity ?? 0.6, 0), 1);
  // scale 覆盖位：使用方业务定制（断点+色带完整替换）；缺省走档案口径。断点空间契约
  // （显示单位）与非法校验由 renderToImageData 的 assertBreaks/色带预检统一把守。
  const scale = options.scale ?? buildColorScale(profile, grid.header.stats);
  // opacity 不进像素（内核保持 alpha 满档）：由 L.imageOverlay 的图层不透明度承载，
  // 宿主 setOpacity 原地调节不重建层——两次乘算（像素预乘 × 图层 opacity）不会出现
  const image = renderToImageData(grid, scale, {
    width: options.width ?? grid.header.grid.nx * 2,
    convert: profile.toDisplay,
  });
  // Canvas 2D → PNG data URL：渲染本体是零 DOM 的 renderToImageData（Node 可测），
  // 此处仅做位图封装——无 2D 能力的宿主（SSR/测试环境）显式报错不静默
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    throw new Error(
      "addGridLayer 需要 Canvas 2D 能力（当前宿主环境不可用——SSR/无头环境请改用 @metweave/grid 的 renderToImageData 自行出图）",
    );
  }
  // createImageData+set 而非 new ImageData(data)：DOM 类型上后者要 Uint8ClampedArray<ArrayBuffer>，
  // 渲染产物声明为 ArrayBufferLike（Node 侧同构零 DOM）；set 拷贝两者都收，无类型体操
  const imageData = ctx.createImageData(image.width, image.height);
  imageData.data.set(image.data);
  ctx.putImageData(imageData, 0, 0);
  // 独立 pane：色斑压在瓦片底图之上、宿主的矢量/标记/弹窗层之下（同图叠加实况站点的产品
  // 形态不再依赖装载次序）；幂等建 pane（换要素 remove+add 多次调用安全）
  if (map.getPane(GRID_PANE) === undefined) {
    map.createPane(GRID_PANE).style.zIndex = String(GRID_PANE_Z);
  }
  const L = await loadLeaflet();
  const overlay = L.imageOverlay(canvas.toDataURL("image/png"), gridOverlayBounds(grid), {
    interactive: false,
    pane: GRID_PANE,
    opacity,
  });
  overlay.addTo(map);
  return overlay;
}

// ---------------------------------------------------------------- 等值线叠层（v0.3 气压切片：等值线主导形态）

/** 等值线层专用 pane 名：色斑层（mw-grid，z 350）之上、矢量/标记/弹窗层（≥400）之下 */
const CONTOUR_PANE = "mw-grid-contour";
/** CONTOUR_PANE 的 z-index：色斑 350 与 overlayPane 400 之间的空隙位 */
const CONTOUR_PANE_Z = 360;

/** addContourLayer 的合法选项键（运行时校验用——拼错的选项键静默忽略违反本库不静默纪律） */
const ADD_CONTOUR_LAYER_OPTION_KEYS: ReadonlySet<string> = new Set([
  "color",
  "highlightColor",
  "labels",
  "minor",
  "centers",
]);

/** 等值线层标注样式（一次性注入的**纯结构**样式：白底/挖空描边、字号、定位；L/H 中心
 *  的固定配色。颜色不进 CSS——每层标注 span 以内联 style 携带本层色值：全局样式烤色
 *  在同图二次异色层上会固化首色（线随选项而标注不随，独立审查 P2 修复）） */
const CONTOUR_STYLE_ID = "mw-contour-style";
const injectContourStyle = (): void => {
  if (document.getElementById(CONTOUR_STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = CONTOUR_STYLE_ID;
  style.append(
    document.createTextNode(
      ".mw-contour-icon { width:0; height:0; pointer-events:none; }" +
        ".mw-contour-icon > span { position:absolute; transform:translate(-50%,-50%); white-space:nowrap;" +
        " font:600 10.5px/1 system-ui,sans-serif;" +
        " text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff,0 0 3px #fff; }" +
        // 特值线标注加粗（5880 一类认知锚醒目，气象读图惯例；色随线走 span 内联）
        ".mw-contour-icon > span.mw-contour-hl { font-weight:700; }" +
        ".mw-center-icon { width:0; height:0; pointer-events:none; text-align:center; }" +
        ".mw-center-icon > span { position:absolute; transform:translate(-50%,-50%); white-space:nowrap;" +
        " display:flex; flex-direction:column; align-items:center; gap:0; }" +
        ".mw-center-letter { font:700 17px/1.1 system-ui,sans-serif; letter-spacing:.5px; }" +
        ".mw-center-low .mw-center-letter { color:#c0392b; }" +
        ".mw-center-high .mw-center-letter { color:#1f5fa8; }" +
        ".mw-center-val { font:600 9.5px/1.1 system-ui,sans-serif; color:#2c3e50;" +
        " text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff; }",
    ),
  );
  document.head.append(style);
};

/** 线种 → polyline 样式（常规 1.4/加密 0.7/特值 2.2；加密线降透明度退后视觉层级）。
 *  特值线基色独立于常规线（highlightColor 缺省副高红——气象惯例特值线红色加粗）。 */
const CONTOUR_STROKE: Record<
  "major" | "minor" | "highlighted",
  { weight: number; opacity: number }
> = {
  highlighted: { weight: 2.2, opacity: 0.95 },
  major: { weight: 1.4, opacity: 0.9 },
  minor: { weight: 0.7, opacity: 0.55 },
};

/**
 * Options for addContourLayer: line color, label/center/minor-line toggles.
 * addContourLayer 的选项：线色与标注/加密线开关。
 */
export interface AddContourLayerOptions {
  /** 等值线基色（缺省深灰蓝 #33506b——浅填色上可辨、不与 L（红）/H（蓝）中心标注撞色；
   *  线与数值标注同步着色，每层各自携带——异色多层同图不串色） */
  color?: string;
  /**
   * 特值线基色（缺省副高红 #c0392b——气象惯例特值线红色加粗，如 500hPa 高度的 5880
   * gpm 副高线；档案 contours.highlighted 点名的线走此色，数值标注同步着色加粗。
   * 与 L 中心红同族色值：线与字母是两类视觉对象，不视为撞色）
   */
  highlightColor?: string;
  /** 等值线数值标注（缺省开启；只标常规线与特值线——加密细线按气象惯例不标值） */
  labels?: boolean;
  /** 次密度加密细线（缺省开启；档案 contours 未声明 minorInterval 时自然没有加密线） */
  minor?: boolean;
  /** 低压「L」/高压「H」中心标注（缺省开启——含中心值，prmsl 的内容锚） */
  centers?: boolean;
}

/** HTML 属性上下文转义（色值嵌入 style 属性防断裂——色串含引号/尖括号已属非法 CSS，
 *  转义兜底使其只表现为无效色而非破坏标注 DOM） */
const escapeAttrValue = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** 等值线值格式化：整数原样、非整数保留一位小数（与面板图例 fmtValue 同口径）。 */
const fmtContourValue = (v: number): string =>
  Number.isInteger(v) ? `${v}` : `${Math.round(v * 10) / 10}`;

/**
 * Put contour lines + labels + L/H centers of a gridded field onto a Leaflet map (SVG vector layer).
 * 把一个格点场的等值线形态贴上 Leaflet 地图：内核 `contoursOf` 出等值线几何（d3-contour
 * 闭合环，显示单位空间）→ SVG polyline 逐环描线（4 hPa 常规线粗、2 hPa 加密细线、特值线
 * 红色加粗——档案 `contours` 口径驱动）＋常规线沿程数值标注（白底/挖空描边、恒定像素字号——
 * SVG/标记缩放不失真；特值线〔如 500hPa 高度 5880 副高线〕标注随线着色加粗）＋`centersOf`
 * 低压「L」/高压「H」中心标注（含中心值，气象读图惯例）。
 *
 * 与 `addGridLayer`（色斑栅格层）正交组合：色斑在下（pane mw-grid，z 350）、等值线与
 * 标注在上（pane mw-grid-contour，z 360）、宿主矢量/标记/弹窗层再上（≥400）——等值线
 * 主导形态（如 prmsl）由调用方两函数先后装配。档案缺 contours 口径显式抛错（留位要素
 * 未接线即红，不静默空层）。几何与检测全部来自 @metweave/grid 纯函数（Node 可测），
 * 本函数只做矢量装配。异步：leaflet 惰性装载（同 addGridLayer）。
 */
export async function addContourLayer(
  map: Leaflet.Map,
  grid: Grid,
  profile: ElementProfile,
  options: AddContourLayerOptions = {},
): Promise<Leaflet.LayerGroup> {
  for (const key of Object.keys(options)) {
    if (!ADD_CONTOUR_LAYER_OPTION_KEYS.has(key)) {
      throw new Error(`addContourLayer 收到未知选项 "${key}"（可用项见 AddContourLayerOptions）`);
    }
  }
  const spec = profile.contours;
  if (spec === undefined) {
    throw new Error(
      `要素 ${profile.shortName} 档案缺等值线口径（contours）——留位要素未接线，无法描线`,
    );
  }
  const color = options.color ?? "#33506b";
  const highlightColor = options.highlightColor ?? "#c0392b";
  const withLabels = options.labels ?? true;
  const withMinor = options.minor ?? true;
  const withCenters = options.centers ?? true;

  const lines = contoursOf(grid, spec, profile.toDisplay);
  const L = await loadLeaflet();
  if (map.getPane(CONTOUR_PANE) === undefined) {
    map.createPane(CONTOUR_PANE).style.zIndex = String(CONTOUR_PANE_Z);
  }
  // renderer 首位入组：polylines 经 options.renderer 复用它渲染；renderer 本体随组进退——
  // removeLayer(group) 时一并回收（否则 renderer 经 polyline 挂 map 后不在返回组里，
  // 反复 remove+add 会在 pane 累积空 SVG 容器直至 map 销毁）
  const renderer = L.svg({ pane: CONTOUR_PANE, padding: 0.8 });
  const group = L.layerGroup();
  group.addLayer(renderer);

  interface LabelCandidate {
    readonly lat: number;
    readonly lon: number;
    readonly text: string;
    readonly ringLength: number; // 长环优先（同预算下大系统先得标注）
    readonly highlighted: boolean; // 特值线标注随线着色加粗（mw-contour-hl）
  }
  const labelQueue: LabelCandidate[] = [];
  const MAX_LABELS = 140; // 标注预算：真实场（中国域 2/4 hPa）常规线 ~10 条，长环多条标注

  for (const line of lines) {
    if (line.kind === "minor" && !withMinor) continue;
    const style = CONTOUR_STROKE[line.kind];
    // 特值线（档案 highlighted 点名）走独立基色——气象惯例红色加粗（如 5880 副高线）
    const strokeColor = line.kind === "highlighted" ? highlightColor : color;
    for (const ring of line.rings) {
      if (ring.length < 2) continue;
      const latlngs: Leaflet.LatLngExpression[] = ring.map(([lat, lon]) => [lat, lon]);
      L.polyline(latlngs, {
        color: strokeColor,
        weight: style.weight,
        opacity: style.opacity,
        interactive: false,
        pane: CONTOUR_PANE,
        renderer,
      }).addTo(group);
      // 数值标注只挂常规线与特值线（加密细线气象惯例不标值）：环足够长才标、沿程均匀取点；
      // 特值线必标（5880 一类认知锚不受 3° 起标门槛——小环也保一枚标注，线与值不可分）
      if (withLabels && line.kind !== "minor" && ring.length >= 4) {
        const length = ringLengthOf(ring);
        if (length >= 3 || line.kind === "highlighted") {
          const count = Math.min(3, Math.max(1, Math.floor(length / 10)));
          for (let k = 0; k < count; k++) {
            const [lat, lon] = pointAlongRing(ring, (k + 0.5) / count);
            labelQueue.push({
              lat,
              lon,
              text: fmtContourValue(line.value),
              ringLength: length,
              highlighted: line.kind === "highlighted",
            });
          }
        }
      }
    }
  }
  if (withLabels && labelQueue.length > MAX_LABELS) {
    labelQueue.sort((a, b) => b.ringLength - a.ringLength);
    labelQueue.length = MAX_LABELS; // 超预算时长环优先（小环碎片标注信息量低）
  }
  for (const cand of labelQueue) {
    // 标注色随本层选项内联携带（与 polyline 线色同源同色——异色多层同图不串色）
    const labelColor = cand.highlighted ? highlightColor : color;
    L.marker([cand.lat, cand.lon], {
      icon: L.divIcon({
        className: "mw-contour-icon",
        html: `<span${cand.highlighted ? ' class="mw-contour-hl"' : ""} style="color:${escapeAttrValue(labelColor)}">${cand.text}</span>`,
        iconSize: [0, 0],
      }),
      interactive: false,
      keyboard: false,
      pane: CONTOUR_PANE,
    }).addTo(group);
  }

  if (withCenters) {
    // 显著深度＝一条（次）密度等值线间隔：中心至少「值得」一条闭合加密/常规线才是系统
    const minDepth = spec.minorInterval ?? spec.interval / 2;
    for (const center of centersOf(grid, {
      convert: profile.toDisplay,
      minDepth,
    })) {
      const letter = center.kind === "low" ? "L" : "H";
      const aria = center.kind === "low" ? "低压中心" : "高压中心";
      L.marker([center.lat, center.lon], {
        icon: L.divIcon({
          className: `mw-center-icon mw-center-${center.kind}`,
          html:
            `<span role="img" aria-label="${aria} ${fmtContourValue(center.value)} ${escapeAttrValue(profile.displayUnit)}">` +
            `<span class="mw-center-letter">${letter}</span>` +
            `<span class="mw-center-val">${fmtContourValue(center.value)}</span></span>`,
          iconSize: [0, 0],
        }),
        interactive: false,
        keyboard: false,
        pane: CONTOUR_PANE,
      }).addTo(group);
    }
  }

  injectContourStyle();
  group.addTo(map);
  return group;
}

/** 环点取值（noUncheckedIndexedAccess 的窄化助手）。 */
const ringAt = (
  ring: readonly (readonly [number, number])[],
  i: number,
): readonly [number, number] => ring[i] ?? [0, 0];

/** 闭合环近似长度（度）：经度分量按纬度余弦折算（高纬不虚胖）。 */
function ringLengthOf(ring: readonly (readonly [number, number])[]): number {
  let total = 0;
  for (let i = 1; i < ring.length; i++) {
    const [lat0, lon0] = ringAt(ring, i - 1);
    const [lat1, lon1] = ringAt(ring, i);
    const k = Math.cos((lat0 * Math.PI) / 180);
    total += Math.hypot(lat1 - lat0, (lon1 - lon0) * k);
  }
  return total;
}

/** 沿闭合环取弧长分数处的点（线性插值；t ∈ [0,1)）。 */
function pointAlongRing(ring: readonly (readonly [number, number])[], t: number): [number, number] {
  const total = ringLengthOf(ring);
  if (total <= 0) return [...ringAt(ring, 0)] as [number, number];
  const frac = ((t % 1) + 1) % 1;
  const target = frac * total;
  let acc = 0;
  for (let i = 1; i < ring.length; i++) {
    const [lat0, lon0] = ringAt(ring, i - 1);
    const [lat1, lon1] = ringAt(ring, i);
    const k = Math.cos((lat0 * Math.PI) / 180);
    const seg = Math.hypot(lat1 - lat0, (lon1 - lon0) * k);
    if (seg > 0 && acc + seg >= target) {
      const f = (target - acc) / seg;
      return [lat0 + (lat1 - lat0) * f, lon0 + (lon1 - lon0) * f];
    }
    acc += seg;
  }
  return [...ringAt(ring, 0)] as [number, number];
}

// ---------------------------------------------------------------- 风向杆叠层（v0.3 风切片：双分量形态）

/** 风羽层专用 pane 名：等值线层（mw-grid-contour，z 360）之上、矢量/标记/弹窗层（≥400）之下 */
const BARB_PANE = "mw-grid-barb";
/** BARB_PANE 的 z-index：等值线 360 与 overlayPane 400 之间的空隙位 */
const BARB_PANE_Z = 365;

/** addWindBarbLayer 的合法选项键（运行时校验用——拼错的选项键静默忽略违反本库不静默纪律） */
const ADD_WIND_BARB_LAYER_OPTION_KEYS: ReadonlySet<string> = new Set(["color"]);

/**
 * Options for addWindBarbLayer: barb color.
 * addWindBarbLayer 的选项：风羽基色。
 */
export interface AddWindBarbLayerOptions {
  /** 风羽基色（缺省深灰蓝 #2c3e50——浅色斑上可辨、与站点站码标签同族深色） */
  color?: string;
}

/**
 * 风羽 glyph 几何常量（SVG 像素）：盒 32×32、站心＝旋转中心 (16,16)、杆恒向上（＝风向
 * 0°北）长 14 至 y=2、羽在杆左侧（北半球地面图惯例）。风向由层按 direction 施加
 * `<g transform="rotate(deg 16 16)">`（SVG rotate 正角＝屏幕顺时针，恰为罗盘向）。
 */
const BARB_BOX = 32;
const BARB_CX = 16;
const BARB_TIP_Y = 2;
const PENNANT_H = 8; // 三角旗（20 m/s）沿杆高
const PENNANT_W = 8; // 三角旗向左宽
const LONG_DX = -7.5; // 长划（4 m/s）梢偏移
const LONG_DY = 7;
const SHORT_DX = -4; // 短划（2 m/s）梢偏移
const SHORT_DY = 4;
const STROKE_GAP = 5; // 划沿杆排列间距

/**
 * 风羽 glyph 的 SVG path 数据（纯函数，m/s 中国口径：三角旗 20 m/s＋长划 4 m/s＋短划
 * 2 m/s——中国气象业务地面图填图规范，与 m/s 存储单位同源，不折节换算）。
 *
 * 返回 { stroke, fill }：stroke＝杆＋长/短划（描线子路径），fill＝三角旗（闭合填充
 * 子路径，风速 <20 m/s 时为空串）。杆恒画（静风杆已由内核 calmThreshold 过滤，到场
 * 的每根杆至少有方向语义）；羽从杆梢向站心侧排布（旗先、划后，气象读图惯例）。
 * 取舍（简化箭头弃用）：箭头只表方向、不表风速——方向色斑已有流向冗余的零增量；
 * 风羽的速度编码（旗/划计数）给色弱用户方向＋速度双通道冗余，且是纯几何 path
 * （无字体/位图），实现成本可控。
 */
export function windBarbPath(speed: number): { readonly stroke: string; readonly fill: string } {
  const x = BARB_CX;
  const strokeSegs: string[] = [`M${x} ${BARB_CX} L${x} ${BARB_TIP_Y}`]; // 杆：站心 → 梢（向上＝北）
  const fillSegs: string[] = [];
  let y = BARB_TIP_Y;
  let rest = Math.max(0, speed);
  const pennants = Math.floor(rest / 20);
  rest -= pennants * 20;
  const longs = Math.floor(rest / 4);
  rest -= longs * 4;
  const hasShort = rest >= 2 - 1e-6; // float32 派生值的舍入容差
  for (let i = 0; i < pennants; i++, y += PENNANT_H) {
    fillSegs.push(`M${x} ${y} L${x} ${y + PENNANT_H} L${x - PENNANT_W} ${y + PENNANT_H / 2} Z`);
  }
  for (let i = 0; i < longs; i++, y += STROKE_GAP) {
    strokeSegs.push(`M${x} ${y} L${x + LONG_DX} ${y + LONG_DY}`);
  }
  if (hasShort) strokeSegs.push(`M${x} ${y} L${x + SHORT_DX} ${y + SHORT_DY}`);
  return { stroke: strokeSegs.join(" "), fill: fillSegs.join(" ") };
}

/**
 * Put wind barbs of a paired u/v field onto a Leaflet map (constant-size SVG glyphs).
 * 把一对 u/v 分量场的风向杆（风羽）贴上 Leaflet 地图：内核 `windBarbsOf` 按档案
 * `barbs` 口径（step 抽稀／calmThreshold 静风阈）出杆位序列 → 每杆一枚 divIcon
 * marker，内联 SVG 风羽（m/s 中国口径：旗 20／长划 4／短划 2，恒定像素尺寸——缩放
 * 不失真不变形）按 `direction` 旋转（罗盘口径，SVG rotate 正角＝顺时针）。
 *
 * 与 `addGridLayer`（色斑栅格层）正交组合：风速合成色斑在下（pane mw-grid，z 350）、
 * 风羽在上（pane mw-grid-barb，z 365——等值线 360 之上、宿主矢量 ≥400 之下）——
 * 双分量形态（`renderForm: "filled+barbs"`）由调用方两函数先后装配（色斑吃
 * `windSpeedGrid` 合成场，本层直接吃 u/v 原场——方向 atan2 同源派生）。档案缺
 * `barbs` 口径显式抛错（不静默空层）。杆是恒定像素视觉件：zoom 下 marker 原地
 * 重定位、glyph 尺寸不变（divIcon 语义，无 canvas 重绘）；v1 无 LOD——密度只由
 * 档案 step 声明，不随缩放变。异步：leaflet 惰性装载（同 addGridLayer）。
 */
export async function addWindBarbLayer(
  map: Leaflet.Map,
  u: Grid,
  v: Grid,
  profile: ElementProfile,
  options: AddWindBarbLayerOptions = {},
): Promise<Leaflet.LayerGroup> {
  for (const key of Object.keys(options)) {
    if (!ADD_WIND_BARB_LAYER_OPTION_KEYS.has(key)) {
      throw new Error(`addWindBarbLayer 收到未知选项 "${key}"（可用项见 AddWindBarbLayerOptions）`);
    }
  }
  const spec = profile.barbs;
  if (spec === undefined) {
    throw new Error(
      `要素 ${profile.shortName} 档案缺风向杆口径（barbs）——filled+barbs 形态要素须声明，无法出杆`,
    );
  }
  const color = options.color ?? "#2c3e50";
  const barbs = windBarbsOf(u, v, spec);
  const L = await loadLeaflet();
  if (map.getPane(BARB_PANE) === undefined) {
    map.createPane(BARB_PANE).style.zIndex = String(BARB_PANE_Z);
  }
  const group = L.layerGroup();
  for (const barb of barbs) {
    const paths = windBarbPath(barb.speed);
    // 杆海是视觉密度件：aria-hidden（数百枚逐杆播报是读屏反可用性——速度已在色斑档
    // 有冗余通道，方向随杆形/色斑流向可读，不逐杆立可读名称）
    const html =
      `<svg width="${BARB_BOX}" height="${BARB_BOX}" viewBox="0 0 ${BARB_BOX} ${BARB_BOX}" aria-hidden="true">` +
      `<g transform="rotate(${barb.direction} ${BARB_CX} ${BARB_CX})">` +
      `<path d="${paths.stroke}" fill="none" stroke="${escapeAttrValue(color)}" stroke-width="1.4" stroke-linecap="round"/>` +
      (paths.fill === ""
        ? ""
        : `<path d="${paths.fill}" fill="${escapeAttrValue(color)}" stroke="${escapeAttrValue(color)}" stroke-width="1"/>`) +
      `</g></svg>`;
    L.marker([barb.lat, barb.lon], {
      icon: L.divIcon({
        className: "mw-barb-icon",
        html,
        iconSize: [BARB_BOX, BARB_BOX],
        iconAnchor: [BARB_CX, BARB_CX],
      }),
      interactive: false,
      keyboard: false,
      pane: BARB_PANE,
    }).addTo(group);
  }
  group.addTo(map);
  return group;
}
