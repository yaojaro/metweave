/**
 * @metweave/grid — 等值线几何与场中心检测（气压切片、第八切片引入）。
 *
 * 两能力均为纯函数、零 DOM（Node 可测）：
 * - `contoursOf`：格点场 → 等值线几何（d3-contour 在显示空间值场上按 threshold 序列
 *   取闭合环——环的描边即等值线，宿主以 polyline/SVG 描环即得线）；
 * - `centersOf`：局部极值检测 → 低压「L」/高压「H」中心候选（气象读图惯例的内容锚）。
 *
 * d3-contour 是 @metweave/grid 的**唯一运行时外部依赖**（本仓首个引入内核的第三方库，
 * owner 2026-10-04 终批；此前其余能力全部标准库实现）：等值线追踪是 marching-squares
 * 型成熟算法（环提取、平滑、洞归属），自研的几何正确性成本远超收益。其缺测语义与
 * 本仓 viz-ready 容器对齐——NaN 格点按「低于一切阈值」处理，等值线环绕缺测孔不
 * 穿越（不跨缺测插值，与 renderToImageData 的缺测透明同一纪律）。
 *
 * 类型注：d3-contour@4 运行时不自带类型声明且 DefinitelyTyped 未跟进（@types/d3-contour
 * 止步 3.x）——以 @types/d3-contour@3 服务 v4 运行时，两者 API 面（contours() 工厂）
 * 兼容；DT 发布 v4 类型后应即切换。
 */
import { contours as d3Contours } from "d3-contour";
import { GridError } from "./errors";
import type { Grid } from "./format";
import type { ContourSpec } from "./element";

/** 等值线条目：值（显示单位）＋线种＋闭合环族（地理坐标，环已闭合＝首尾点相同）。 */
export interface ContourLine {
  /** 等值线值（显示单位空间，如 hPa 的整数倍） */
  readonly value: number;
  /** 线种：major＝常规间隔线（interval 倍数）、minor＝次密度线（minorInterval 倍数且非 interval 倍数）、highlighted＝特值线（档案点名） */
  readonly kind: "major" | "minor" | "highlighted";
  /**
   * 闭合环族（GeoJSON MultiPolygon 摊平——描线场景不需要多边形层级，外环/洞环
   * 同为待描闭合环）：每环为 [lat, lon] 点列（lat 北正、lon 东正），首尾点相同。
   */
  readonly rings: readonly (readonly (readonly [number, number])[])[];
}

/** 场中心条目：局部极小（low）/局部极大（high）——「L」「H」标注的数据面。 */
export interface FieldCenter {
  readonly kind: "low" | "high";
  /** 中心格点纬度（北正） */
  readonly lat: number;
  /** 中心格点经度（东正） */
  readonly lon: number;
  /** 中心值（显示单位空间） */
  readonly value: number;
}

/** convert 的缺省恒等（与 RenderOptions.convert 同口径）。 */
const identity = (v: number): number => v;

/** 滑窗最值取数（模块层小件：不捕获外层变量——consistent-function-scoping 纪律）。 */
const minOf = (a: number, b: number): number => (a < b ? a : b);
const maxOf = (a: number, b: number): number => (a > b ? a : b);

/** 浮点近似整倍数判定（threshold 序列经 k×interval 累计的舍入容差）。 */
const isMultipleOf = (value: number, interval: number): boolean =>
  Math.abs(value / interval - Math.round(value / interval)) < 1e-9;

/**
 * 校验等值线口径：interval/minorInterval 为正有限数（零/负/非有限在几何上无意义——
 * 显式抛错，与 assertBreaks 同一道关口纪律）。
 */
function assertContourSpec(spec: ContourSpec): void {
  if (!Number.isFinite(spec.interval) || spec.interval <= 0) {
    throw new GridError(
      "invalid-scale",
      `等值线间隔非法（interval=${String(spec.interval)}，须为正数）`,
    );
  }
  if (spec.minorInterval !== undefined) {
    if (!Number.isFinite(spec.minorInterval) || spec.minorInterval <= 0) {
      throw new GridError(
        "invalid-scale",
        `次密度等值线间隔非法（minorInterval=${String(spec.minorInterval)}，须为正数）`,
      );
    }
    if (spec.minorInterval >= spec.interval) {
      throw new GridError(
        "invalid-scale",
        `次密度等值线间隔（${spec.minorInterval}）须小于常规间隔（${spec.interval}）——次密度是加密线`,
      );
    }
  }
}

/**
 * 格点场 → 等值线几何（纯函数）。
 *
 * 值先经 convert 进显示单位空间（如 Pa→hPa ÷100——量纲换算只在档案层），threshold
 * 序列取**落在场值域开区间 (min, max) 内**的 interval 整数倍（及 minorInterval 整数倍，
 * 兼为 interval 倍数的值归 major 不重复出线）；恰在 min/max 上的倍数不出线（贴边环
 * 无信息量）。`highlighted`（特值线，如温度 0°C 冰点线、高度 5880 线）同样只在场值域
 * 内生效，场外的特值静默跳过（场内无该值即无线可描，非错误）。min/max 从场值现算
 * （NaN 排除）——不读容器头 stats（等值线几何直接依赖场真值，头 stats 属预计算缓存）。
 *
 * 返回按值升序的 ContourLine[]；值域退化（min ≥ max，如全等场/全缺测）返回空数组。
 * d3-contour 的行序约定与容器一致（行序北→南、行内西→东），点 (x, y)＝(列, 行) 经
 * 网格几何换算为 [lat, lon]。
 */
export function contoursOf(
  grid: Grid,
  spec: ContourSpec,
  convert: (value: number) => number = identity,
): ContourLine[] {
  assertContourSpec(spec);
  const { nx, ny, la0, lo0, di, dj } = grid.header.grid;
  // 显示空间值场（NaN 保留——d3-contour 按「低于一切阈值」环绕缺测不穿越）
  const values = new Float32Array(nx * ny);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < values.length; i++) {
    const v = convert(grid.values[i] ?? Number.NaN);
    values[i] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(min < max)) {
    return []; // 退化场（全等/全缺测）或换算后出现非有限极值：无等值线可出
  }

  // threshold 序列：minorInterval 倍数（无则 interval 倍数）∪ 场内特值线，去重升序
  const step = spec.minorInterval ?? spec.interval;
  const thresholds = new Set<number>();
  for (let k = Math.floor(min / step) + 1; k * step < max; k++) {
    thresholds.add(k * step);
  }
  for (const h of spec.highlighted) {
    if (h > min && h < max) thresholds.add(h);
  }
  const sorted = [...thresholds];
  sorted.sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const lines: ContourLine[] = [];
  // 环点 (x, y) → [lat, lon]：d3-contour 点约定 ⟨i+0.5, j+0.5⟩＝格点 (行 j, 列 i) 中心
  // （点坐标＝格点索引＋0.5 的「点空间」），换算先退半格再乘步距——与 renderToImageData
  // 的像素中心采样、gridOverlayBounds 的半格外延同一几何口径，等值线与色斑档界对齐
  const pointAt = (p: readonly number[]): [number, number] => {
    const x = p[0];
    const y = p[1];
    if (x === undefined || y === undefined) {
      throw new GridError("truncated", "等值线环点缺坐标（不可达路径守卫）");
    }
    return [la0 - (y - 0.5) * dj, lo0 + (x - 0.5) * di];
  };
  // d3-contour 类型面只收 number[]（实现只按下标读）——拷贝一份 plain array 喂入
  //（58k 值 ~0.2ms，免类型断言；显示值已在拷贝前算好）
  const field = Array.from(values);
  for (const multipolygon of d3Contours().size([nx, ny]).thresholds(sorted)(field)) {
    // 多边形层级摊平为环族：描线只逐环描，外环/洞环不区分
    const rings = multipolygon.coordinates.flatMap((polygon) =>
      polygon.map((ring) => ring.map(pointAt)),
    );
    const value = multipolygon.value;
    const kind: ContourLine["kind"] = spec.highlighted.some((h) => h === value)
      ? "highlighted"
      : isMultipleOf(value, spec.interval)
        ? "major"
        : "minor";
    lines.push({ value, kind, rings });
  }
  return lines;
}

/** centersOf 的选项。 */
export interface CentersOptions {
  /** 存储单位 → 显示单位换算（缺省恒等；如 prmsl 的 Pa→hPa ÷100） */
  readonly convert?: (value: number) => number;
  /**
   * 极值判定与吸收半径（格点数，缺省 16——0.25° 网格即 4°，天气系统尺度量级）：
   * 候选须为该方形窗内的最值；同窗并列/邻近极值按深度贪心吸收为单标记（双中心
   * 系统收敛到一个 L/H）。窗小（如 4 格＝1°）即热带弱梯度区的涟漪极值也成候选
   * （实测中国域 prmsl：1° 窗出千级标记），窗大则相近的独立系统合并——缺省取
   * 4° 折中（真实场上系统级标记 ~20 个量级）。
   */
  readonly radius?: number;
  /**
   * 显著深度（显示单位，缺省 0＝不设槛）：候选与窗内反向极值的差须 ≥ 此值——
   * 平坦背景场（理想化合成场、强高区的准平坦腹地）上「恰好并列窗最值」的角点
   * 假阳性护栏；气压惯例取一条次密度等值线间隔（2 hPa）。真实场上窗内环境梯度
   * 常已超此槛（实测中国域 prmsl 滤前滤后同数）——它是护栏不是过滤器。
   */
  readonly minDepth?: number;
}

/**
 * 格点场 → 低压/高压中心（滑窗极值＋深度贪心吸收，纯函数）。
 *
 * 候选＝半径 radius 方形窗内的最值（NaN 不参与——与 bilinearAt 的缺测纪律同口径，
 * 全 NaN 窗无候选），候选按深度排序（low 值升序、high 值降序）贪心保留——与已保留
 * 中心切比雪夫距离不足 radius 的吸收掉（同系统并列极值收敛单标记）。返回 low 在前
 * （值升序）、high 在后（值降序）。气象读图惯例：low＝「L」、high＝「H」＋中心值
 * （prmsl 的内容锚）；机理通用，任何标量场可用（「中心」语义只在有 L/H 惯例的
 * 要素上消费）。
 *
 * 选型注（真实场实证，docs/grid-notes 十三节）：纯八邻域极值在中国域 prmsl 热带
 * 海区出千级涟漪候选；「d 深度盆地闭合」的显著性判据会把槽嵌系统（台风联入季风
 * 槽）与窗口截断系统（东北角深低压）误杀——滑窗极值不漏任何天气尺度系统，涟漪
 * 假阳性由吸收半径控制，是两条失败模式权衡后的务实解。
 */
export function centersOf(grid: Grid, options: CentersOptions = {}): FieldCenter[] {
  const { nx, ny, la0, lo0, di, dj } = grid.header.grid;
  const convert = options.convert ?? identity;
  const radius = options.radius ?? 16;
  const minDepth = options.minDepth ?? 0;
  if (!Number.isInteger(radius) || radius < 1) {
    throw new GridError(
      "invalid-scale",
      `中心判定半径非法（radius=${String(radius)}，须 ≥1 的整数）`,
    );
  }
  if (!Number.isFinite(minDepth) || minDepth < 0) {
    throw new GridError("invalid-scale", `中心显著深度非法（minDepth=${String(minDepth)}，须 ≥0）`);
  }
  const values = grid.values;
  // 检测与输出全程显示单位空间（语义以显示单位表达；convert 须单调，全部既有档案
  // 均为仿射单调——极值结构在单调换算下不变）
  const display = new Float64Array(nx * ny);
  for (let i = 0; i < display.length; i++) display[i] = convert(values[i] ?? Number.NaN);

  /** 沿 x 的逐窗最值（NaN 不参与；unit＝恒等哨兵：min→+Inf、max→−Inf）。两趟分离
   *  （先 x 后 y 复合）把方形窗暴力 O(n·r²) 降为 O(n·r)——radius 缺省 16 下中国域
   *  ~5.8 万点约 1500 万次比较属可接受；网格升密或 radius 调大时再上单调队列 O(n)。 */
  const slideX = (pick: (a: number, b: number) => number, unit: number): Float64Array => {
    const out = new Float64Array(nx * ny);
    for (let y = 0; y < ny; y++) {
      const row = y * nx;
      for (let x = 0; x < nx; x++) {
        let acc = unit;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= nx) continue;
          const v = display[row + xx] ?? Number.NaN;
          if (!Number.isFinite(v)) continue;
          acc = pick(acc, v);
        }
        out[row + x] = acc;
      }
    }
    return out;
  };
  /** 沿 y 的滑窗最值（与 slideX 复合得方形窗最值——min/max 结合律）。 */
  const slideY = (
    src: Float64Array,
    pick: (a: number, b: number) => number,
    unit: number,
  ): Float64Array => {
    const out = new Float64Array(nx * ny);
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        let acc = unit;
        for (let dy = -radius; dy <= radius; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= ny) continue;
          const v = src[yy * nx + x] ?? Number.NaN;
          if (!Number.isFinite(v)) continue;
          acc = pick(acc, v);
        }
        out[y * nx + x] = acc;
      }
    }
    return out;
  };
  const windowMin = slideY(
    slideX(minOf, Number.POSITIVE_INFINITY),
    minOf,
    Number.POSITIVE_INFINITY,
  );
  const windowMax = slideY(
    slideX(maxOf, Number.NEGATIVE_INFINITY),
    maxOf,
    Number.NEGATIVE_INFINITY,
  );

  interface Candidate {
    y: number;
    x: number;
    value: number;
  }
  /** 单种中心：滑窗最值候选→深度排序→贪心吸收（切比雪夫距离 < radius 即并）。 */
  const collect = (wantMin: boolean): Candidate[] => {
    const candidates: Candidate[] = [];
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const v = display[y * nx + x] ?? Number.NaN;
        if (!Number.isFinite(v)) continue;
        const wMin = windowMin[y * nx + x] ?? Number.NaN;
        const wMax = windowMax[y * nx + x] ?? Number.NaN;
        if (!Number.isFinite(wMin) || !Number.isFinite(wMax)) continue; // 全 NaN 窗
        if (wantMin ? v > wMin : v < wMax) continue; // 非窗内最值
        // 严格性＋显著深度：窗内反向极值须严格越过本值至少 minDepth（缺省 0 时仍要求
        // 严格越过——完全平坦的窗〔背景精确等值平台〕既是窗最小又是窗最大，不算极值）
        const depth = wantMin ? wMax - v : v - wMin;
        if (!(depth > 0) || depth < minDepth) continue;
        candidates.push({ y, x, value: v });
      }
    }
    candidates.sort((a, b) => (wantMin ? a.value - b.value : b.value - a.value));
    const kept: Candidate[] = [];
    for (const c of candidates) {
      const alone = kept.every((k) => Math.max(Math.abs(k.x - c.x), Math.abs(k.y - c.y)) >= radius);
      if (alone) kept.push(c);
    }
    return kept;
  };

  const toCenter = (c: Candidate, kind: FieldCenter["kind"]): FieldCenter => ({
    kind,
    lat: la0 - c.y * dj,
    lon: lo0 + c.x * di,
    value: c.value, // 已在显示空间（检测场即换算后场）
  });

  return [
    ...collect(true).map((c) => toCenter(c, "low")),
    ...collect(false).map((c) => toCenter(c, "high")),
  ];
}
