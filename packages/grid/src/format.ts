/**
 * @metweave/grid — viz-ready 容器（v1 规格的唯一实现）。
 *
 * 规格（2026-10-06 冻结：网格头 JSON + float32——准确性+效率优先；改动走 header.version，
 * v1 内不动）：
 *   7B  magic "MWGRID1"
 *   4B  头长（big-endian u32，字节计——偏移 7）
 *   1B  保留（偏移 11，恒 0——v1 冻结布局的固有间隙：写侧零初始化不触碰、读侧跳过；
 *       早期叙述误作「8B magic」，实为 7B magic＋此 1B 间隙，字节布局锁定测试守）
 *   nB  头 JSON（UTF-8，GridHeader——偏移 12）
 *   nB  float32 payload（big-endian，行序：北→南、行内西→东，与 GFS 源场同向零重排）
 *
 * 缺测语义：float32 NaN（原生显式、d3-contour 原生按缺值跳过）；「哨兵值」（如 REFC −20
 * 无回波、VIS 24130 满量程）是打包真值，存储保留原值、由要素档案在显示层声明处理——
 * 两者不经同一通道（docs/10 十五节口径）。
 */
import { GridError } from "./errors";

export const MAGIC = "MWGRID1";
export const HEADER_VERSION = 1 as const;

/** 网格几何（等经纬；order 为行序约定，v1 恒 N2S,W2E,row-major）。 */
export interface GridGeometry {
  nx: number;
  ny: number;
  la0: number;
  lo0: number;
  di: number;
  dj: number;
  order: "N2S,W2E,row-major";
}

/** 分布统计（分位数定档与推荐色标预计算——分级函数直读，免前端全量排序）。 */
export interface GridStats {
  min: number;
  max: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p99: number;
}

/** 溯源与合规行（内置于头、组件展示端直读——docs/04 口径）。 */
export interface GridMeta {
  referenceTime: string;
  forecastHour: number;
  source: string;
  license: string;
  generated: string;
  generator?: string;
}

export interface GridHeader {
  version: 1;
  variable: string;
  level: string;
  unit: string;
  grid: GridGeometry;
  stats: GridStats;
  meta: GridMeta;
}

export interface Grid {
  header: GridHeader;
  values: Float32Array;
}

/** 分布统计：NaN 排除后取（哨兵/缺测不污染分位——docs/10 十五节实证口径）。 */
export function computeStats(values: Float32Array | number[]): GridStats {
  const nums: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i] ?? Number.NaN;
    if (!Number.isNaN(v)) nums.push(v);
  }
  if (nums.length === 0) {
    const nan = Number.NaN;
    return { min: nan, max: nan, p10: nan, p25: nan, p50: nan, p75: nan, p90: nan, p99: nan };
  }
  nums.sort((a, b) => a - b);
  const pick = (i: number): number => {
    const v = nums[i];
    if (v === undefined) throw new GridError("truncated", "分位索引越界（不可达路径守卫）");
    return v;
  };
  const at = (p: number): number =>
    pick(Math.min(nums.length - 1, Math.floor((p / 100) * nums.length)));
  return {
    min: pick(0),
    max: pick(nums.length - 1),
    p10: at(10),
    p25: at(25),
    p50: at(50),
    p75: at(75),
    p90: at(90),
    p99: at(99),
  };
}

/** 序列化为 .mwgrid 容器字节（header.meta.stats 与 values 现算不一致时以现算覆盖）。 */
export function serializeGrid(header: GridHeader, values: Float32Array | number[]): Uint8Array {
  const n = header.grid.nx * header.grid.ny;
  if (values.length !== n) {
    throw new GridError(
      "payload-size-mismatch",
      `values ${values.length} ≠ 网格声明 ${n}（nx×ny）`,
    );
  }
  const h: GridHeader = { ...header, stats: computeStats(values) };
  const enc = new TextEncoder();
  const hj = enc.encode(JSON.stringify(h));
  // 前缀 12B＝7B magic＋4B 头长＋1B 保留（v1 冻结布局，见文件头规格）
  const out = new Uint8Array(12 + hj.length + n * 4);
  out.set(enc.encode(MAGIC), 0);
  const view = new DataView(out.buffer);
  view.setUint32(7, hj.length);
  out.set(hj, 12);
  for (let i = 0; i < n; i++) view.setFloat32(12 + hj.length + i * 4, values[i] ?? Number.NaN);
  return out;
}

/** 解析 .mwgrid 容器（同构：浏览器与 Node 同一代码路径）。 */
export function parseGrid(buffer: ArrayBuffer | Uint8Array): Grid {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 12) throw new GridError("truncated", `容器 ${bytes.length}B 不足最小头 12B`);
  const magic = String.fromCharCode(...bytes.subarray(0, 7));
  if (magic !== MAGIC) throw new GridError("invalid-magic", `魔数 "${magic}" ≠ "${MAGIC}"`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const hlen = view.getUint32(7);
  if (12 + hlen > bytes.length) throw new GridError("truncated", `头长 ${hlen}B 越界`);
  let header: GridHeader;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + hlen)));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("grid" in parsed) ||
      !("version" in parsed)
    ) {
      throw new GridError("header-json-invalid", "头缺必需字段（version/grid）");
    }
    const p = parsed as { version?: unknown; grid?: unknown };
    // 头语义校验：version 须为 1（v1 容器唯一版本），grid.nx/ny 须正整数——脏头就地报
    // 明确错误，不以 payload ≠ NaN×4 这类风马牛不相及的错位误导排查
    if (p.version !== 1) {
      throw new GridError(
        "header-json-invalid",
        `头 version=${JSON.stringify(p.version)} 非法（当前容器版本恒为 1）`,
      );
    }
    // 守卫已验 grid 键在位（运行时窄化）；断言仅类型层收窄——与下方 GridHeader 断言同款
    // oxlint-disable-next-line no-unsafe-type-assertion
    const g = p.grid as { nx?: unknown; ny?: unknown } | undefined;
    const nx = g?.nx;
    const ny = g?.ny;
    if (
      typeof g !== "object" ||
      g === null ||
      typeof nx !== "number" ||
      typeof ny !== "number" ||
      !Number.isInteger(nx) ||
      !Number.isInteger(ny) ||
      nx <= 0 ||
      ny <= 0
    ) {
      throw new GridError(
        "header-json-invalid",
        `头 grid.nx/ny 非法（须正整数，实得 nx=${JSON.stringify(nx)}/ny=${JSON.stringify(ny)}）`,
      );
    }
    // 守卫已验 version/grid 在位（运行时窄化）；此处断言仅类型层收窄，结构契约由 parse 调用方测试锁
    // oxlint-disable-next-line no-unsafe-type-assertion
    header = parsed as GridHeader;
  } catch (e) {
    if (e instanceof GridError) throw e;
    throw new GridError(
      "header-json-invalid",
      `头 JSON 解析失败：${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const n = header.grid.nx * header.grid.ny;
  const payload = bytes.length - 12 - hlen;
  if (payload !== n * 4) {
    throw new GridError("payload-size-mismatch", `payload ${payload}B ≠ ${n * 4}B（nx×ny×4）`);
  }
  const values = new Float32Array(n);
  for (let i = 0; i < n; i++) values[i] = view.getFloat32(12 + hlen + i * 4);
  return { header, values };
}
