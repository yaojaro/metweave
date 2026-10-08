/**
 * @metweave/grid — 要素档案层（element profile）：每要素一文件（elements/<short-name>.ts），
 * 色标与档位的单一事实来源（组件与渲染 API 共用一份口径——「一套口径两张出口」）。
 *
 * 架构约束（垂直切片）：要素档案之间零 import——加要素＝加档案文件，内核零改动；
 * 量纲换算只存在于档案与显示层（convert 不动数值语义是转换器红线）。
 * 本文件只承载共享类型与档案→色标的装配函数，不放任何具体要素。
 */
import { equalStepBreaks, quantileBreaks, thresholdBreaks, type ColorScale } from "./core";
import { GridError } from "./errors";
import type { GridStats } from "./format";

/** 等距档推荐参数：固定域 [min, max] 均分 bins 档（显示单位空间；跨时次可比是本模式的价值）。 */
export interface EqualScaleSpec {
  readonly min: number;
  readonly max: number;
  readonly bins: number;
}

/**
 * 等值线口径（绘制能力随气压切片引入——内核 contoursOf 消费，此前各档案的留位声明
 * 即时生效）：interval 为常规等值线间隔、highlighted 为特值线（如温度 0°C 冰点线、
 * 高度 5880 线）、minorInterval 为次密度加密线间隔（如气压 4 hPa 常规＋2 hPa 加密——
 * 气象惯例细线不标值；缺省无加密线）。
 */
export interface ContourSpec {
  readonly interval: number;
  readonly highlighted: readonly number[];
  /** 次密度加密线间隔（可选，须小于 interval）：兼为 interval 倍数的值归常规线不重复出线 */
  readonly minorInterval?: number;
  /**
   * L/H 中心标注开关（可选，缺省 true＝开启——气压场读图习语，prmsl 的内容锚）。
   * 中心语义不成立的场声明 false 只描线不出中心：如温度场（冷中心≠低压——
   * owner 2026-10-07 定案「只描等值线，不标注中心」，t850 首例）。
   */
  readonly centers?: boolean;
}

/**
 * 风向杆口径（绘制能力随风切片引入——内核 windBarbsOf 消费，@metweave/leaflet 的
 * addWindBarbLayer 装配）。杆密度＝固定步长抽稀（缩放无关，v1 无 LOD）。
 */
export interface BarbSpec {
  /**
   * 抽稀步长（格点数，两向同 steps）：每 step 格画一根杆、网格中心对齐起画。0.25°
   * 网格上 step 10＝2.5° 一根（地面分析图惯例密度——中国域 280×208 约 560 根）。
   */
  readonly step: number;
  /**
   * 静风阈值（显示单位 m/s）：合成风速低于此值的格点不画杆（静风无方向可读，画杆
   * 即噪音）。中国气象业务惯例 1 m/s 起画。
   */
  readonly calmThreshold: number;
}

/**
 * 单要素档案：短名/变量层/单位/显示换算/推荐色标/推荐档位/渲染形态。
 * 断点与域一律写在**显示单位**空间（toDisplay 之后），色标停靠色低→高。
 */
export interface ElementProfile {
  /** 短名（gen:grid CLI 的要素键，如 tmp） */
  readonly shortName: string;
  /** 中文显示名（切换器/图例用） */
  readonly labelZh: string;
  /** 变量名/层（与 .mwgrid 头 variable/level 对齐的入档口径） */
  readonly variable: string;
  readonly level: string;
  /** 存储单位（.mwgrid 头 unit，如 K） */
  readonly storageUnit: string;
  /** 显示单位（如 °C） */
  readonly displayUnit: string;
  /** 存储 → 显示换算（如 K→°C 的 −273.15；只在本层与显示层，转换器不做数值语义变换） */
  readonly toDisplay: (value: number) => number;
  /** 推荐色标停靠色（低→高；#rgb/#rgba/#rrggbb/#rrggbbaa） */
  readonly colorStops: readonly string[];
  /** 等距档推荐参数（threshold 为缺省模式的要素可缺席——推荐参数只在所属模式下必填，
   *  缺省模式缺对应参数由 buildColorScale 显式抛错兜底） */
  readonly equal?: EqualScaleSpec;
  /** 分位数档推荐分位点（升序；须取自容器头八分位梯子，见 core.ts quantileBreaks）；
   *  threshold 为缺省模式的要素可缺席（零值堆场的分位数档失效，不立推荐） */
  readonly quantile?: readonly number[];
  /**
   * 阈值档推荐阈值（显示单位空间、严格递增——与 equal 域同规约直接写在显示空间，
   * 经 toDisplay 换算不需要；thresholdBreaks 校验）。档位语义＝显式业务阈值
   * （气象惯例定档，如 CAPE 1000/2500/4000 J/kg），不做均分/分位近似。
   */
  readonly thresholds?: readonly number[];
  /** 缺省档位模式（demo/组件不传档时的口径）：等距／分位数／阈值三模式 */
  readonly defaultMode: "equal" | "quantile" | "threshold";
  /** 渲染形态口径：filled＝色斑图（既有形态）；filled+contours＝色斑底＋等值线主导
   *  （等值线＋数值标注＋L/H 中心标注，随气压切片引入——宿主按此装配叠层）；filled+barbs
   *  ＝色斑底＋风向杆叠加（合成风速色斑＋风羽杆，随风切片引入——双分量要素的形态） */
  readonly renderForm: "filled" | "filled+contours" | "filled+barbs";
  /** 等值线口径（留位：档案先立口径，绘制能力后续引入，本切片不实现） */
  readonly contours?: ContourSpec;
  /**
   * 风向杆口径（"filled+barbs" 形态消费；内核 windBarbsOf 按此出杆位序列，宿主
   * addWindBarbLayer 装配）。缺省缺席＝无杆（filled/filled+contours 要素不声明）。
   */
  readonly barbs?: BarbSpec;
  /**
   * 透明档（档序号、0 起、相对缺省模式 breaks——含两端外延档；与显示单位无关，序号即档位）。
   * 命中档 alpha 0 不着色、底图透出（如 CAPE 首档 [0,1000)＝无对流区/零值堆）。
   * 缺省缺席＝无透明档（行为不变）。档级语义的通用原语，见 core.ts ColorScale.transparentBins。
   */
  readonly transparentBins?: readonly number[];
  /**
   * log₁₀ 前置变换（可选，对数偏态场的分级口径——首个消费要素 prate：降水率值域跨
   * 多个量级，线性空间 0.1–10 mm/h 的档界挤在色带一端）。声明后断点（thresholds/
   * equal 域/分位断点）仍写在**显示（线性）空间**（人类可读阈值，如 0.1/1/5/10 mm/h），
   * 渲染在定档前对值与断点统一取 log₁₀（档界等价于对数空间语义）；与档位模式正交
   * （threshold＋log₁₀＝prate 组合）。零值 log₁₀→−Inf 走 binIndexAt 非有限透明通道
   * （与档级透明同一像素形态）；断点须为正（渲染关口校验）。缺省缺席＝线性定档。
   */
  readonly logScale?: true;
  /**
   * 末档注记（可选）：threshold 档图例的末缘文字标注（显示单位语境的纯文字，如 vis 的
   * 「≥24.1（满量程）」）。审查语义：末档 [末阈值,∞) 外延无界（图例不标上缘的既定理由），
   * 但源场可能在量程顶饱和（满量程哨兵＝打包真值非缺测，正常着色不透明——与 transparentBins
   * 的「无信号透明」语义相反），注记让「末档颜色实为满量程及以上、量程顶以上不可分辨」
   * 在图例可读（数据诚实口径）。机制与具体要素解耦：任何 threshold 档要素均可声明；
   * 图例端渲染在刻度序列之外（刻度是数值位、注记是语义位，不参与抽样）。缺席＝不渲染。
   */
  readonly topBinNote?: string;
}

/**
 * 档案 + 场统计 → 缺省模式的分级色标（demo/适配器直用）。
 * equal 模式用档案固定域；quantile 模式直读 stats 八分位梯子（断点随场分布走，各时次
 * 自动均衡但不可跨时次比较——两模式的取舍本就如此）；threshold 模式用档案显式阈值
 * （跨时次可比，且不受零值堆/偏态分布牵连——分位数档在这类场上塌在零上）。
 * 缺省模式缺对应推荐参数（equal 域/quantile 分位点/thresholds 阈值）显式抛错——
 * 类型面三组推荐参数均可选（threshold 要素不背不用的等距域），运行时兜底防笔误。
 */
export function buildColorScale(profile: ElementProfile, stats: GridStats): ColorScale {
  // ColorScale.breaks 契约＝显示单位空间（见 core.ts）：等距断点由档案显示域直接构造，
  // 分位断点直读梯子得到的是存储单位，须经 toDisplay 进显示单位，阈值断点与等距域同规约
  // 直接写在显示空间——三分支统一空间，渲染（convert 后定档）与图例（直读断点）才能
  // 共用同一份 breaks 不再各自换算。
  const breaks = breaksOfMode(profile, stats);
  if (profile.colorStops.length === 0) {
    throw new GridError("invalid-scale", `要素 ${profile.shortName} 档案色带为空`);
  }
  return {
    breaks,
    colors: profile.colorStops,
    // 档案声明用数组（字面量立档友好），进色标转 Set（渲染逐像素 O(1) 成员判定）
    ...(profile.transparentBins === undefined
      ? {}
      : { transparentBins: new Set(profile.transparentBins) }),
    // log₁₀ 前置变换口径随档案装配进色标（渲染入口复合变换，breaks 仍线性表达）
    ...(profile.logScale === undefined ? {} : { logScale: true }),
  };
}

/** 缺省模式的断点装配（三分支）：模式与推荐参数的配对校验在此统一把守。 */
function breaksOfMode(profile: ElementProfile, stats: GridStats): number[] {
  const mode = profile.defaultMode;
  if (mode === "equal") {
    if (profile.equal === undefined) {
      throw new GridError(
        "invalid-scale",
        `要素 ${profile.shortName} 缺省档位为 equal，但档案缺 equal 推荐参数`,
      );
    }
    return equalStepBreaks(profile.equal.min, profile.equal.max, profile.equal.bins);
  }
  if (mode === "quantile") {
    if (profile.quantile === undefined) {
      throw new GridError(
        "invalid-scale",
        `要素 ${profile.shortName} 缺省档位为 quantile，但档案缺 quantile 推荐分位点`,
      );
    }
    return quantileBreaks(stats, profile.quantile).map(profile.toDisplay);
  }
  if (profile.thresholds === undefined) {
    throw new GridError(
      "invalid-scale",
      `要素 ${profile.shortName} 缺省档位为 threshold，但档案缺 thresholds 推荐阈值`,
    );
  }
  return thresholdBreaks(profile.thresholds);
}
