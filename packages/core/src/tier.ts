/**
 * @metweave/core — 显示档位判据单源：四档站点档位（conditionTierOf / metarTierOf）
 * 与要素级扫视色调（weatherGroupTone / visibilityGroupTone / cloudLayerTone）。
 *
 * **判据核心归位（2026-10-04 方案 C 立项，v0.3 落地）**：判据此前活在 @metweave/leaflet
 * （站点档位 conditionOf）与 @metweave/render（卡片行色 isDangerWeather 等两处分散消费，
 * 0.1.2 冻降水升红即「两包同改」）——本模块收口为单源：leaflet 与 render 双消费点归位至此，
 * 此后判据语义修订只改本文件、两包消费同批生效，根治两包漂移。
 *
 * **为何落 core 而非独立模块（依赖面论证）**：① render 与 leaflet 本就依赖 core——判据入 core
 * 零新增依赖边、零新包发布面；② core 是全仓唯一零依赖包，判据是 IR 上的纯函数（结构子集输入，
 * 无 DOM / 无 Leaflet），deck.gl 等不消费 Leaflet 的场景拿 `@metweave/core` 即得判据函数，
 * 不必为判据拖入地图适配器的 peer 依赖（前端评审实锤的痛点）；③ core 的自我定位即
 * 「IR 数据模型与语义工具」，本模块是纯语义工具，不引入任何显示实现。
 *
 * **诚实声明（随代码自 leaflet 迁移保留，README 同步）**：四档判据是本库自拟的扫视启发式，
 * 阈值由本库拟定，**不对应也不代表任何官方飞行天气分类；本库不提供飞行规则判定**。
 * 仅供「一眼扫视哪些站值得注意」，**不得作为任何运行判据**。承认不权威，所以给合法替换通道：
 * 渲染层 `addMetarLayer` / `renderCard` 的 `tierOf` 选项可整体注入自定判据（缺省走本模块）。
 *
 * **判据 semver 承诺**：本模块判据语义的变化今后一律走 minor 版本 + CHANGELOG 迁移说明，
 * 不在 patch 位漂移（回应 0.1.2 判据 patch 位变化、商用面板无预告升档的指摘）。
 */
import type {
  CloudCondition,
  CloudElement,
  MetarReport,
  Observed,
  RunwayStateGroup,
  VisibilityGroup,
  WeatherGroup,
  WeatherPhenomenon,
  WindGroup,
  WindShearGroup,
} from "./ir";
import { unwrap } from "./ir";

/**
 * 四档条件档位名（显示层语义；@metweave/leaflet 的 TIER_COLORS 以本类型为键——
 * 灰=unknown、红=poor、琥珀=caution、绿=good；宿主面板/图例直读）。
 */
export type ConditionTier = "unknown" | "poor" | "caution" | "good";

/**
 * ConditionTier 的合法值集合（注入判据返回值的运行时校验用——@metweave/leaflet 与
 * @metweave/render 对 tierOf 注入的返回值校验以此单源，非法档位串按注入抛错同口径失败）。
 */
export const CONDITION_TIERS: readonly ConditionTier[] = ["unknown", "poor", "caution", "good"];

/** 合法值集合（assertConditionTier 的运行时查表用——Set 免线性扫描）。 */
const CONDITION_TIER_SET: ReadonlySet<string> = new Set(CONDITION_TIERS);

/**
 * 注入判据返回值的运行时校验（tierOf 注入通道共用出口）：返回值必须 ∈ CONDITION_TIERS。
 * JS 调用方可绕过类型层注入任意返回值（如拼写残缺的 "por"），静默放行会破相——圆点
 * 背景/aria 双 undefined、data-tier 写入脏值；故按「注入函数抛错」同口径抛中文错误
 * （含非法值与合法值清单）。@metweave/leaflet（圆点层）与 @metweave/render（data-tier）消费。
 */
export function assertConditionTier(value: unknown): void {
  if (typeof value === "string" && CONDITION_TIER_SET.has(value)) return;
  const shown = typeof value === "string" ? value : `非字符串（${typeof value}）`;
  throw new Error(`tierOf 注入返回了非法档位 "${shown}"（合法值：${CONDITION_TIERS.join("/")}）`);
}

/**
 * 判据输入面（结构子集）：METAR 报结构性满足本接口（metarTierOf 直收）；
 * TAF 展开结果由消费方投影构造（@metweave/leaflet 的 asConditionInput——runwayStates 与
 * windShear 恒缺省：TAF 语汇无跑道状态与风切变组位）。
 */
export interface ConditionInput {
  readonly nil?: boolean;
  readonly cavok: boolean;
  readonly wind?: Observed<WindGroup>;
  readonly visibility?: Observed<VisibilityGroup>;
  readonly weather?: Observed<readonly WeatherGroup[]>;
  readonly clouds?: CloudCondition;
  readonly runwayStates?: readonly RunwayStateGroup[];
  /** 风切变组（§15.13.3）——报文出现即红档（v0.3 增补，见 conditionTierOf poor 判据） */
  readonly windShear?: WindShearGroup;
}

/** 降水类现象（判据用，与 WMO 4678 降水族对应——RA/SN/SG/PL/GS/IC/DZ/UP） */
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

/** 对起降运行直接危害的现象（判据用，报级入红/组级 danger 共用——FC 含漏斗云与龙卷
 *  +FC、SS 沙暴、DS 尘暴：与 TS 同级，对起降运行的直接危害不亚于雷暴；v0.3 增补）。 */
const DIRECT_HAZARD_PHENOMENA: ReadonlySet<WeatherPhenomenon> = new Set(["FC", "SS", "DS"]);

/** 风速折米/秒（阵风判据统一单位：kt ×0.514444、kmh ÷3.6、mps ×1） */
const toMps = (value: number, unit: "kt" | "mps" | "kmh"): number =>
  unit === "kt" ? value * 0.514444 : unit === "kmh" ? value / 3.6 : value;

/**
 * 四档气象条件分级（判据本库自拟、初稿待审——显示层扫视启发式，诚实声明见模块头）：
 * - unknown（灰）= NIL（台站无观测）或关键组全缺测（能见度与云均缺测且天气缺测/无——按可得要素无从判读）
 * - poor（红）= 能见度 < 1500 m，或 BKN/OVC 云层（含垂直能见度）云底 < 1000 ft，或天气含 TS 族（任何雷暴，含 VC 邻近）
 *   或现象含 GR/VA，或冻降水（FZ 描述符族，冻雨/冻毛雨），或 + 强度显著降水，或阵风 ≥ 25 m/s，
 *   或云组含 CB/TCU，或跑道关闭，或报文含风切变组（WS 任一形态——v0.3 增补：低空风切变对起降
 *   运行危害与雷暴同级，沿 0.1.2 冻降水升红同一逻辑；现报组与趋势后交回正文的形态都汇于
 *   windShear 字段），
 *   或现象含 FC/SS/DS（漏斗云/龙卷/沙暴/尘暴——v0.3 增补，与 TS 同级：对起降运行的直接危害）
 * - caution（琥珀）= 能见度 1500–5000 m（能见度分档取国内通行 1500/5000 m 口径），或 BKN/OVC 云底 1000 ft–
 *   < 3000 ft（报级口径：云底 < 3000 即琥珀；与行级 cloudLayerTone 的 ≤ 3000 为既有口径差，
 *   两处各自维持——见两函数内注），
 *   或任何降水族（RA/SN 等），或飑（SQ——v0.3 增补，保守档：飑的运行危害主要经阵风与对流传导，
 *   阵风已有档、对流走 TS/CB 红，SQ 单独出现提示「风况突变」给琥珀足够，避免过度告警稀释红档扫视价值），
 *   或 FZ 描述符以外的结冰现象，或阵风 15–25 m/s
 * - good（绿）= 其余（含 CAVOK）
 * 缺测要素不参与限制（按可得要素判，见函数内 unknown 判据的例外）；阈值细则随口径审定后修订。
 */
/**
 * 关键组全缺测判据（unknown 档谓词单源）：能见度与云均缺测（云组每个体均为全缺测形态）
 * 且天气缺测/无——档位判据（conditionTierOf 灰档）与渲染层「数据缺测」占位
 * （@metweave/leaflet 的摘要行）共用同一判式，2026-10-08 单源化（此前两处逐行同构副本）。
 */
export function isConditionUnknown(report: ConditionInput): boolean {
  const visMissing = report.visibility?.kind === "missing";
  const elements = report.clouds?.elements ?? [];
  const cloudsAllMissing =
    !report.cavok &&
    elements.every(
      (e) => e.heightFt.value === null && (e.kind === "vertical-visibility" || e.amount === null),
    );
  const weatherMissingOrNone =
    report.weather === undefined ||
    report.weather.kind === "missing" ||
    (report.weather.kind === "value" && report.weather.value.length === 0);
  return visMissing && cloudsAllMissing && weatherMissingOrNone;
}

export function conditionTierOf(report: ConditionInput): ConditionTier {
  if (report.nil === true) return "unknown";
  const v = {
    wind: unwrap(report.wind),
    visibility: unwrap(report.visibility),
    weather: unwrap(report.weather),
    clouds: report.clouds,
    runwayStates: report.runwayStates ?? [],
  };
  // 关键组全缺测：判读无从下手，灰而非绿（谓词单源见 isConditionUnknown）
  if (isConditionUnknown(report)) return "unknown";

  // —— poor 判据（任一命中即红）
  const vis = v.visibility;
  if (vis !== undefined) {
    const visMeters = vis.unit === "m" ? vis.value : vis.value * 1609.344;
    if (visMeters < 1500) return "poor";
  }
  const elements = v.clouds?.elements ?? [];
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
    // 漏斗云/龙卷（FC/+FC）与沙暴/尘暴（SS/DS）：对起降运行的直接危害与 TS 同级（v0.3 增补，
    // 与 WS/SQ 增补同一逻辑——此前只报 FC/SS/DS 的报文按「其余情况」落绿，判据盲区）；
    // SS/DS 常伴低能见度，能见度判据另行兜住，此处只补天气组
    const directHazard = g.phenomena.some((p) => DIRECT_HAZARD_PHENOMENA.has(p));
    const heavyPrecip =
      g.intensity === "+" &&
      (g.descriptor === "SH" || g.phenomena.some((p) => PRECIP_PHENOMENA.has(p)));
    if (thunderstorm || hailOrAsh || freezing || directHazard || heavyPrecip) return "poor";
  }
  const gust = v.wind?.gust;
  if (gust !== undefined && toMps(gust.value, gust.unit) >= 25) return "poor";
  const convective = elements.some(
    (e): e is Extract<CloudElement, { kind: "layer" }> =>
      e.kind === "layer" && e.convective !== undefined,
  );
  if (convective) return "poor";
  if (v.runwayStates.some((st) => st.closed === true)) return "poor";
  // 风切变组出现即红（v0.3 增补：报文内风切变组出现即红——对起降运行危害与雷暴同级，
  // 沿 0.1.2 冻降水升红同一逻辑；此前只报 WS 无 TS/CB 的报文按「其余情况」落绿，运行级缺口）
  if (report.windShear !== undefined) return "poor";

  // —— caution 判据（任一命中即琥珀）
  if (vis !== undefined) {
    const visMeters = vis.unit === "m" ? vis.value : vis.value * 1609.344;
    if (visMeters < 5000) return "caution";
  }
  // 报级云底琥珀口径＝< 3000（与行级 cloudLayerTone 的 ≤ 3000 为既有口径差——历史如此、
  // 各自维持不动；两处阈值若要统一属判据语义修订，走 minor + CHANGELOG 迁移说明）
  if (ceiling < 3000) return "caution";
  for (const g of v.weather ?? []) {
    // 降水族入琥珀之外，飑（SQ）单独出现同样给琥珀（v0.3 增补，保守档理由见上方档位表）——
    // 此前 SQ 完全不参与判档，靠同报的 +SHRA/+TSRA 兜住才没露馅
    const precip = g.phenomena.some((p) => PRECIP_PHENOMENA.has(p) || p === "SQ");
    if (precip) return "caution";
  }
  if (gust !== undefined && toMps(gust.value, gust.unit) >= 15) return "caution";
  return "good";
}

/**
 * METAR/SPECI 报的四档档位（conditionTierOf 薄包装）：报文结构性满足 ConditionInput，
 * 直收即可。与渲染层的圆点色 / aria 档位词 / 卡片档位标识同一判据管线；
 * 宿主按自身运行标准重分档请走渲染层 `tierOf` 注入通道，本函数恒为内置缺省判据。
 */
export function metarTierOf(report: MetarReport): ConditionTier {
  return conditionTierOf(report);
}

// ---------------------------------------------------------------- 要素级扫视色调（卡片行色判据）

/** 要素级扫视色调：danger（红系）/ caution（橙系）；undefined = 不着色 */
export type ElementTone = "danger" | "caution";

/**
 * 天气组扫视色调（卡片天气行与 TAF 分段明细共用的行色判据，与 conditionTierOf 同源同文件）：
 * - danger：TS 族（雷暴）/ FZ 冻降水族（2026-09-22 运行视角评审升红）/ GR 冰雹 / + 强度，
 *   及 FC/SS/DS（漏斗云/龙卷/沙暴/尘暴——v0.3 增补，与报级入红同批：对起降运行的直接危害）；
 * - caution：降水族（RA/SN 等）；飑 SQ 单独出现亦给 caution（v0.3 增补，保守档理由
 *   同 conditionTierOf——飑的危害主要经阵风与对流传导，避免过度告警）。
 * 与报级档位的粒度差：+ 强度在本判据恒 danger（组级「值得注意」标注），报级档位的
 * heavy 判据另见 conditionTierOf——两档粒度的阈值以本文件为唯一对照面。
 */
export function weatherGroupTone(g: WeatherGroup): ElementTone | undefined {
  const danger =
    g.descriptor === "TS" ||
    g.descriptor === "FZ" ||
    g.phenomena.includes("GR") ||
    g.phenomena.some((p) => DIRECT_HAZARD_PHENOMENA.has(p)) ||
    g.intensity === "+";
  if (danger) return "danger";
  const caution = g.phenomena.some((p) => PRECIP_PHENOMENA.has(p) || p === "SQ");
  return caution ? "caution" : undefined;
}

/**
 * 能见度组扫视色调：< 1500 m danger；1500–5000 m caution（国内通行 1500/5000 m 分档口径，
 * 与 conditionTierOf 同阈值）。输入为结构子集（VisibilityGroup 满足）。
 */
export function visibilityGroupTone(
  vis: Pick<VisibilityGroup, "value" | "unit" | "exact" | "beyond">,
): ElementTone | undefined {
  const meters = vis.unit === "m" ? vis.value : vis.value * 1609.344;
  if (meters < 1500) return "danger";
  if (meters < 5000) return "caution";
  return undefined;
}

/**
 * 云组元素扫视色调（判据本库自拟、初稿待审——显示层扫视口径，非标准分级、非运行判据）：
 * BKN/OVC 云底 < 1000 ft → danger；1000–3000 ft（≤ 3000）→ caution；
 * VV 组任意 → caution，VV < 400 ft → danger。
 * 对流云（CB/TCU）恒 danger（威胁优先于云底档位，由消费方先行判定）；缺测云高不捏造档位不着色。
 * 行级琥珀口径＝≤ 3000（与报级 conditionTierOf 的 < 3000 为既有口径差——历史如此、各自维持；
 * 统一属判据语义修订，走 minor + CHANGELOG 迁移说明）。
 */
export function cloudLayerTone(layer: CloudElement): ElementTone | undefined {
  if (layer.kind === "vertical-visibility") {
    const v = layer.heightFt.value;
    return v !== null && v < 400 ? "danger" : "caution";
  }
  if (layer.amount !== "BKN" && layer.amount !== "OVC") return undefined;
  const h = layer.heightFt.value;
  if (h === null) return undefined;
  if (h < 1000) return "danger";
  if (h <= 3000) return "caution";
  return undefined;
}
