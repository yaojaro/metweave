/**
 * @metweave/grid — 渲染内核（微内核，随要素切片加法生长）。
 *
 * 温度切片（格点线第一切片）落地的最小能力面：双线性插值、分级函数（等距/分位数两模式）、
 * 逐像素色斑渲染 renderToImageData。全部为纯函数、零 DOM 依赖（Node 可测；输出与 ImageData
 * 同构的 {width,height,data}，浏览器侧直接喂 Canvas，Node 侧直接断言像素）。
 *
 * CAPE 切片（第四切片）加法生长两能力：阈值档（thresholdBreaks——显式业务阈值定档，
 * 与等距/分位并列）与档级透明（ColorScale.transparentBins——命中档 alpha 0 底图透出）。
 * 两者均缺省不介入，既有要素渲染路径与像素零漂移（快照锁死）。
 *
 * 降水率切片（第五切片）加法生长 log₁₀ 前置变换（ColorScale.logScale——对数偏态场的
 * 分级口径）：值与断点在定档前统一取 log₁₀，断点声明留在显示（线性）空间、图例直读
 * 原值；零值 log₁₀→−Inf 落 binIndexAt 的非有限透明通道。与档位模式正交（threshold＋
 * log₁₀＝降水率组合）。缺省不介入，既有要素渲染像素零漂移（快照锁死）。
 *
 * 分位数模式设计（免全量排序）：断点不现场排序场值，而是直读容器头预计算的八分位梯子
 * （GridStats 的 min/p10/p25/p50/p75/p90/p99/max——computeStats 在序列化时已算好）。
 * 这意味着分位数档的断点精度＝梯子级距（10 个百分点），对色斑图扫视够用；需要任意
 * 分位的要素（如零值堆场）应改用阈值档（随后续要素引入）。分位点必须是梯子上的合法
 * 级位，其余取值显式抛错（不静默近似——档位口径漂移比报错更难查）。
 *
 * 像素渲染的值采样＝逐像素对场值双线性插值（不是对已着色像素放大）：输出分辨率与网格
 * 分辨率解耦（超采样出平滑档界，降采样出抗锯齿聚合），NaN 缺测透出为 alpha 0。
 */
import { GridError } from "./errors";
import type { Grid, GridStats } from "./format";

// ---------------------------------------------------------------- 双线性插值

/**
 * 网格坐标系下的双线性采样（内部原语）：fx/fy 为列/行的小数索引（0 = 西/北首格点）。
 * 越界钳制到边缘格点（半像素外延属像元边界语义，见 renderToImageData）；
 * 权重非零的参与格点任一为 NaN → NaN（不跨缺测插值——缺测邻域的「推测值」比透明更糟；
 * 权重为零的格点不参与判定，精确落在格点上时读值恒为该点原值，不被缺测邻居牵连）。
 */
function bilinearAt(values: Float32Array, nx: number, ny: number, fy: number, fx: number): number {
  const cx = Math.min(Math.max(fx, 0), nx - 1);
  const cy = Math.min(Math.max(fy, 0), ny - 1);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const tx = cx - x0;
  const ty = cy - y0;
  const at = (y: number, x: number): number => values[y * nx + x] ?? Number.NaN;
  if (tx === 0 && ty === 0) return at(y0, x0);
  if (tx === 0) {
    // 单列（西/东缘或恰在列线上）：两行参与
    const a = at(y0, x0);
    const b = at(Math.min(y0 + 1, ny - 1), x0);
    return Number.isNaN(a) || Number.isNaN(b) ? Number.NaN : (1 - ty) * a + ty * b;
  }
  if (ty === 0) {
    const a = at(y0, x0);
    const b = at(y0, Math.min(x0 + 1, nx - 1));
    return Number.isNaN(a) || Number.isNaN(b) ? Number.NaN : (1 - tx) * a + tx * b;
  }
  const v00 = at(y0, x0);
  const v10 = at(y0, Math.min(x0 + 1, nx - 1));
  const v01 = at(Math.min(y0 + 1, ny - 1), x0);
  const v11 = at(Math.min(y0 + 1, ny - 1), Math.min(x0 + 1, nx - 1));
  if (Number.isNaN(v00) || Number.isNaN(v10) || Number.isNaN(v01) || Number.isNaN(v11)) {
    return Number.NaN;
  }
  return (1 - ty) * ((1 - tx) * v00 + tx * v10) + ty * ((1 - tx) * v01 + tx * v11);
}

/**
 * 任意经纬度取值（双线性插值）：读值探针/未来等值线与鼠标读值的地基。
 * 网格外（含半开边界外）返回 NaN；任一参与格点缺测同样返回 NaN（口径同 bilinearAt）。
 * 几何按 GridGeometry 惯例：la0 为北界、行序北→南，lo0 为西界、行内西→东。
 */
export function interpolateBilinear(grid: Grid, lat: number, lon: number): number {
  const { nx, ny, la0, lo0, di, dj } = grid.header.grid;
  if (!(di > 0) || !(dj > 0)) {
    throw new GridError("invalid-scale", `网格步距非正（di=${di}, dj=${dj}）`);
  }
  const fy = (la0 - lat) / dj;
  const fx = (lon - lo0) / di;
  if (fy < 0 || fy > ny - 1 || fx < 0 || fx > nx - 1) return Number.NaN;
  return bilinearAt(grid.values, nx, ny, fy, fx);
}

// ---------------------------------------------------------------- 分级函数

/**
 * 分级色标：断点（显示单位、严格递增）＋色带停靠色（低→高）。档数 = breaks.length + 1。
 *
 * `transparentBins`（可选）＝透明档：命中档不着色（alpha 0、RGB 0——与缺测透明同一像素
 * 形态），底图透出。缺省缺席＝无透明档，渲染行为不变。档序号相对本 scale 的 breaks
 * （0 起、含两端外延档）。档级透明是通用原语：CAPE 零值堆首档（本能力引入切片）与后续
 * 「哨兵独占某档」的形态（如反射率 −20 无回波哨兵落首档）共用同一机制——值级哨兵透明
 * 若将来出现（哨兵与真值同档的场景）再以加法引入独立字段，不占本字段。
 */
export interface ColorScale {
  readonly breaks: readonly number[];
  readonly colors: readonly string[];
  readonly transparentBins?: ReadonlySet<number>;
  /**
   * log₁₀ 前置变换（可选）：声明后**定档前**对值与断点统一取 log₁₀——断点（breaks）
   * 仍写在显示（线性）空间（人类可读阈值，如 prate 的 0.1/1/5/10 mm/h），对数变换由
   * 渲染入口一处复合，图例/外部直读 breaks 不受影响（恒显示线性原值）。对数偏态场
   * （降水率——值域跨多个量级）的分级口径，与档位模式正交组合（threshold＋log₁₀＝
   * prate；等距/分位同理可组合）。零值/负值 log₁₀ → −Inf/NaN → binIndexAt 非有限
   * 通道返回 −1（透明——既有语义，与档级透明同一像素形态）。断点须为正
   * （log₁₀(≤0) 无意义，渲染前显式抛错）。缺省缺席＝线性定档（既有要素行为不变）。
   */
  readonly logScale?: true;
}

/**
 * 值 → 档序号（0 起）。档 i = [breaks[i-1], breaks[i])（左闭右开）；
 * 低于首断点 → 0、≥ 末断点 → breaks.length（两端外延档）；NaN/非有限值 → -1（透明档）。
 * 前置契约：breaks 严格递增（renderToImageData 与 buildColorScale 负责校验，本函数走快路径）。
 */
export function binIndexAt(value: number, breaks: readonly number[]): number {
  if (!Number.isFinite(value)) return -1;
  for (let i = 0; i < breaks.length; i++) {
    const b = breaks[i];
    if (b === undefined || value < b) return i;
  }
  return breaks.length;
}

/** 校验断点表：非空、有限、严格递增（退化分布/脏档位显式报错，不出静默错档）。 */
function assertBreaks(breaks: readonly number[]): void {
  let prev = Number.NEGATIVE_INFINITY;
  for (const b of breaks) {
    if (!Number.isFinite(b)) {
      throw new GridError("invalid-scale", `档位断点含非有限值：${String(b)}`);
    }
    if (b <= prev) {
      throw new GridError("invalid-scale", `档位断点必须严格递增（${prev} 后出现 ${b}）`);
    }
    prev = b;
  }
}

/**
 * 等距档断点：[min, max] 域均分 bins 档，返回中间 bins-1 个断点（两端外延档由 binIndexAt 兜）。
 * min ≥ max 或 bins < 2 抛错（空域/单档无意义——单档恒等色不需要分级）。
 */
export function equalStepBreaks(min: number, max: number, bins: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(min < max)) {
    throw new GridError("invalid-scale", `等距档域非法（min=${min}, max=${max}，须 min < max）`);
  }
  if (!Number.isInteger(bins) || bins < 2) {
    throw new GridError("invalid-scale", `等距档数非法（bins=${bins}，须 ≥2 的整数）`);
  }
  const breaks: number[] = [];
  const step = (max - min) / bins;
  for (let i = 1; i < bins; i++) breaks.push(min + i * step);
  assertBreaks(breaks);
  return breaks;
}

/**
 * 八分位梯子（quantileBreaks 的合法分位点集）：0→min、1→max，其余为容器头预计算分位。
 * 键为分位水平（0–1），值为 GridStats 字段名——一处登记，映射与校验共用。
 */
const QUANTILE_LADDER: Readonly<Record<string, keyof GridStats>> = {
  "0": "min",
  "0.1": "p10",
  "0.25": "p25",
  "0.5": "p50",
  "0.75": "p75",
  "0.9": "p90",
  "0.99": "p99",
  "1": "max",
};

/**
 * 分位数档断点：直读容器头八分位梯子（免全量排序——见文件头「分位数模式设计」）。
 * points 为分位水平（升序），每个都必须取自梯子合法级位 {0, .1, .25, .5, .75, .9, .99, 1}，
 * 其余取值抛错（不静默近似）；映射出的断点须严格递增且有限——退化分布（如大面积饱和场
 * 的相邻分位同值）在此显式报错，提示该要素改用其他档位模式。
 * 返回值为**存储单位**（stats 原值）——进 ColorScale（显示单位契约）由 buildColorScale
 * 经 profile.toDisplay 换算，调用方不得把本函数返回值直接当显示空间用。
 */
export function quantileBreaks(stats: GridStats, points: readonly number[]): number[] {
  const breaks = points.map((p) => {
    const field = QUANTILE_LADDER[String(p)];
    if (field === undefined) {
      throw new GridError(
        "invalid-scale",
        `分位点 ${String(p)} 不在预计算八分位梯子上（合法：${Object.keys(QUANTILE_LADDER).join("/")}）`,
      );
    }
    return stats[field];
  });
  // 非有限值（stats 缺测 NaN）走 assertBreaks 的有限值检查给出统一口径
  assertBreaks(breaks);
  return breaks;
}

/**
 * 自定义阈值档断点：校验严格递增（assertBreaks 口径——非有限/非递增显式抛错）后原样
 * 返回，返回新数组（不别名入参）。档位语义＝显式业务阈值（如 CAPE 1000/2500/4000 J/kg
 * 的无/中度/强/极强对流潜势），不做均分或分位近似——与等距/分位并列的第三种分级模式：
 * 零值堆/重偏态场（分位数断点塌在零上——cape p50=2、prate p50≈0.003 mm/h 的实证）与
 * 气象惯例阈值要素（CAPE/反射率/能见度）的定档方式。空表合法（恒单档＝等色场，
 * 与 quantileBreaks 的空分位点口径一致）。
 */
export function thresholdBreaks(thresholds: readonly number[]): number[] {
  assertBreaks(thresholds);
  return [...thresholds];
}

/**
 * log₁₀ 模式的断点变换（内部）：显示（线性）空间 → 对数空间。断点须为正——
 * log₁₀(≤0) 无意义（−Inf/NaN 断点使档位不可判），配置笔误在渲染前显式抛错
 * （与断点/色带/透明档校验同一道关口，不静默纪律）。log₁₀ 单调递增，线性空间
 * 严格递增的断点变换后仍严格递增，无需二次校验。
 */
function logBreaksOf(breaks: readonly number[]): number[] {
  return breaks.map((b, i) => {
    if (!(b > 0)) {
      throw new GridError(
        "invalid-scale",
        `log₁₀ 模式断点须为正数（第 ${i} 项 ${String(b)}——log₁₀(≤0) 无意义）`,
      );
    }
    return Math.log10(b);
  });
}

// ---------------------------------------------------------------- 色带取样

/** 单个 RGBA 色（0–255；与 ImageData 同构）。 */
export interface RgbaColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

const HEX_RE = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** 十六进制色解析（#rgb/#rgba/#rrggbb/#rrggbbaa；非法色值显式报错不静默）。 */
function parseHex(color: string, index: number): RgbaColor {
  const m = HEX_RE.exec(color);
  if (m === null) {
    throw new GridError(
      "invalid-scale",
      `色带第 ${index} 项 "${color}" 不是合法十六进制色（#rgb/#rgba/#rrggbb/#rrggbbaa）`,
    );
  }
  const hex = (m[1] ?? "").toLowerCase();
  const pick = (i: number): number => Number.parseInt(hex.slice(i, i + 2), 16);
  if (hex.length === 3 || hex.length === 4) {
    const s = (i: number): number => Number.parseInt(hex[i] ?? "0", 16) * 17;
    return {
      r: s(0),
      g: s(1),
      b: s(2),
      a: hex.length === 4 ? s(3) : 255,
    };
  }
  return { r: pick(0), g: pick(2), b: pick(4), a: hex.length === 8 ? pick(6) : 255 };
}

/**
 * 色带取样（内部）：t ∈ [0,1]（0=最低档、1=最高档），在停靠色间线性插值（straight sRGB，
 * 色斑档级差下与感知均匀空间的差异不可辨）。t 自动钳制；colors 须已校验非空。
 * 单停靠色（length===1）＝纯色填充：无插值伙伴，t 无关恒取该色。
 */
function colorAt(colors: readonly string[], t: number): RgbaColor {
  if (colors.length === 1) {
    const c = parseHex(colors[0] ?? "", 0);
    return { r: c.r, g: c.g, b: c.b, a: c.a };
  }
  const clamped = Math.min(Math.max(t, 0), 1);
  const scaled = clamped * (colors.length - 1);
  const i = Math.min(Math.floor(scaled), colors.length - 2);
  const frac = scaled - i;
  const c0 = parseHex(colors[i] ?? "", i);
  const c1 = parseHex(colors[i + 1] ?? "", i + 1);
  return {
    r: c0.r + (c1.r - c0.r) * frac,
    g: c0.g + (c1.g - c0.g) * frac,
    b: c0.b + (c1.b - c0.b) * frac,
    a: c0.a + (c1.a - c0.a) * frac,
  };
}

// ---------------------------------------------------------------- 逐像素渲染

/** renderToImageData 的选项。 */
export interface RenderOptions {
  /** 输出宽（像素列数）；缺省 = 网格列数（原生分辨率）。高度按网格纵横比自适应取整。 */
  width?: number;
  /** 值 → 显示单位换算（缺省恒等）。量纲换算只在要素档案层做（转换器不动数值语义）。 */
  convert?: (value: number) => number;
  /** 整体不透明度乘子（0–1，缺省 1；乘进像素 alpha——NaN 透明档不受影响恒为 0）。 */
  opacity?: number;
}

/** 渲染产物：与浏览器 ImageData 同构（RGBA、行序北→南、行内西→东——与网格同向）。 */
export interface RenderedImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/**
 * 格点场 → RGBA 像素阵列（色斑图逐像素渲染，纯函数零 DOM）。
 *
 * 每个输出像素先按像元几何映射回网格小数坐标、对场值双线性取样（见文件头：超采样/降采样
 * 均按场值插值而非像素放大），再经换算（convert）进显示单位、按 scale.breaks 定档、按档
 * 中心在 scale.colors 色带上取样着色；scale.logScale 声明时定档前对值与断点统一取 log₁₀
 * （breaks 仍以线性值表达，断点正值校验在此关口）；缺测 NaN 恒为 alpha 0（透明，与 opacity
 * 无关），命中 scale.transparentBins 的档同样 alpha 0（档级透明，与 opacity 无关——透明档不因
 * 整体不透明度而复活；透明档仍占色带取样位，档数＝breaks+1 不变，相邻档取样无副作用）。
 * scale 校验（断点严格递增、色带非空合法、透明档序号在档范围内）失败抛 GridError("invalid-scale")。
 */
export function renderToImageData(
  grid: Grid,
  scale: ColorScale,
  options: RenderOptions = {},
): RenderedImage {
  assertBreaks(scale.breaks);
  if (scale.colors.length === 0) {
    throw new GridError("invalid-scale", "色带为空（colors 至少一色）");
  }
  scale.colors.forEach((c, i) => parseHex(c, i)); // 逐色预检——坏色在渲染前报错（含具体值），不在半途
  // 透明档序号校验：整数且落在 [0, breaks.length]（末档序号＝档数-1）——越界序号是配置
  // 笔误，静默不生效比报错更难查（不静默纪律；与断点/色带校验同一道关口）
  if (scale.transparentBins !== undefined) {
    const topBin = scale.breaks.length;
    for (const bin of scale.transparentBins) {
      if (!Number.isInteger(bin) || bin < 0 || bin > topBin) {
        throw new GridError(
          "invalid-scale",
          `透明档序号 ${String(bin)} 非法（须为 0–${topBin} 的整数，档数共 ${topBin + 1}）`,
        );
      }
    }
  }
  const { nx, ny, di } = grid.header.grid;
  if (di <= 0 || grid.header.grid.dj <= 0) {
    throw new GridError("invalid-scale", "网格步距非正，无法渲染");
  }
  // log₁₀ 前置变换（可选）：值与断点在定档前统一进对数空间——两侧变换必须原子地
  // 同处一处（若靠调用方分别复合 convert 与断点，忘一侧即静默错档）；断点声明仍留
  // 线性显示空间（图例直读原值），此处循环外一次预变换。非 log 色标走原 breaks
  // 引用（undefined 短路，既有算术路径零漂移）
  const logScale = scale.logScale === true;
  const breaks = logScale ? logBreaksOf(scale.breaks) : scale.breaks;
  const width = options.width ?? nx;
  if (!Number.isInteger(width) || width < 1) {
    throw new GridError("invalid-scale", `渲染宽度非法（width=${width}，须 ≥1 的整数）`);
  }
  const height = Math.max(1, Math.round((width * ny) / nx));
  const convert = options.convert ?? ((v: number) => v);
  const opacity = Math.min(Math.max(options.opacity ?? 1, 0), 1);
  const bins = scale.breaks.length + 1;
  const transparentBins = scale.transparentBins; // 缺省 undefined → 逐像素检查短路（既有路径零漂移）
  const data = new Uint8ClampedArray(width * height * 4);
  for (let py = 0; py < height; py++) {
    const fy = ((py + 0.5) / height) * ny - 0.5;
    for (let px = 0; px < width; px++) {
      const fx = ((px + 0.5) / width) * nx - 0.5;
      const value = convert(bilinearAt(grid.values, nx, ny, fy, fx));
      // log 模式：log₁₀(0)=−Inf、log₁₀(负)=NaN——binIndexAt 非有限通道兜为 −1（透明）
      const bin = binIndexAt(logScale ? Math.log10(value) : value, breaks);
      const o = (py * width + px) * 4;
      if (bin < 0 || (transparentBins !== undefined && transparentBins.has(bin))) {
        // 缺测/换算后非有限/命中透明档 → 透明（RGB 保持 0，与缺测同一像素形态）
        data[o + 3] = 0;
        continue;
      }
      const c = colorAt(scale.colors, (bin + 0.5) / bins);
      data[o] = c.r;
      data[o + 1] = c.g;
      data[o + 2] = c.b;
      data[o + 3] = c.a * opacity;
    }
  }
  return { width, height, data };
}
