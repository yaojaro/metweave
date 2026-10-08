/**
 * @metweave/grid/convert — GRIB2 → viz-ready 转换管道（Node 侧；「GRIB 不进浏览器」是
 * 路线红线，本子路径只被 gen:grid CLI / 未来数据 API 服务端消费）。
 *
 * 管道职责（docs/10 十四节「七件事/三不做」的 P0 实装面）：
 *   做了：解码（5.2/5.3）→ 网格头组装（含 stats 预计算、溯源行内置）→ 裁域 → 容器序列化。
 *   不做：量纲换算（显示层职责，要素档案管）、数值语义加工（红线）、预报研判。
 */
import { computeStats, serializeGrid, type Grid, type GridHeader, type GridMeta } from "./format";
import { GridError } from "./errors";
import { decodeGrib2, type GribField } from "./grib2";
export { decodeGrib2 } from "./grib2";
export type { GribField, DecodeGrib2Options } from "./grib2";
export { serializeGrid, parseGrid, computeStats } from "./format";
export type { Grid, GridHeader, GridStats, GridMeta } from "./format";

/** 中国域裁剪窗（demo/仓内基线口径：55N–3N、70E–140E——南界盖到曾母暗沙以南海域，
 * 南海九段线全境囊括（2026-10-07 扩窗，原南界 15N 切掉南海大部）；与 corpus fixture 同窗）。 */
export const CN_WINDOW = { la0: 55, la1: 3, lo0: 70, lo1: 140 } as const;

export interface ConvertOptions {
  variable?: string;
  level?: string;
  unit?: string;
  meta?: Partial<GridMeta>;
}

const two = (n: number): string => String(n).padStart(2, "0");

/** 场 → viz-ready Grid（头含 stats 现算与溯源行）。 */
export function fieldToGrid(field: GribField, opts: ConvertOptions = {}): Grid {
  const meta: GridMeta = {
    referenceTime: `${two(field.referenceTime.year)}-${two(field.referenceTime.month)}-${two(field.referenceTime.day)}T${two(field.referenceTime.hour)}:${two(field.referenceTime.minute)}Z`,
    forecastHour: field.forecastTime,
    source: opts.meta?.source ?? "GRIB2",
    license: opts.meta?.license ?? "",
    generated: opts.meta?.generated ?? new Date().toISOString().slice(0, 10),
    ...opts.meta,
  };
  const header: GridHeader = {
    version: 1,
    variable: opts.variable ?? `${field.category}-${field.number}`,
    level: opts.level ?? `${field.levelType}/${field.levelValue}`,
    unit: opts.unit ?? "",
    grid: {
      nx: field.ni,
      ny: field.nj,
      la0: field.la1,
      lo0: field.lo1,
      di: field.di,
      dj: field.dj,
      order: "N2S,W2E,row-major",
    },
    stats: computeStats(field.values),
    meta,
  };
  return { header, values: field.values };
}

/** 裁域（等经纬网格按行列切窗；行序 N2S：la0 为北界；窗口为半开区间——la1 南界与 lo1 东界不含，
 *  与 corpus fixture/原型件 `[row0,row1)×[col0,col1)` 切片口径一致）。 */
export function cropGrid(
  grid: Grid,
  win: { la0: number; la1: number; lo0: number; lo1: number },
): Grid {
  const { nx, ny, la0, lo0, di, dj } = grid.header.grid;
  const rowStart = Math.max(0, Math.round((la0 - win.la0) / dj));
  const rowEnd = Math.min(ny, Math.round((la0 - win.la1) / dj));
  const colStart = Math.max(0, Math.round((win.lo0 - lo0) / di));
  const colEnd = Math.min(nx, Math.round((win.lo1 - lo0) / di));
  const ny2 = rowEnd - rowStart,
    nx2 = colEnd - colStart;
  if (ny2 <= 0 || nx2 <= 0) throw new GridError("empty-input", "裁剪窗与网格无交集");
  const values = new Float32Array(ny2 * nx2);
  for (let r = 0; r < ny2; r++) {
    values.set(
      grid.values.subarray((rowStart + r) * nx + colStart, (rowStart + r) * nx + colEnd),
      r * nx2,
    );
  }
  return {
    header: {
      ...grid.header,
      grid: {
        ...grid.header.grid,
        nx: nx2,
        ny: ny2,
        la0: la0 - rowStart * dj,
        lo0: lo0 + colStart * di,
      },
      stats: computeStats(values),
    },
    values,
  };
}

/** GRIB2 buffer → 逐场 viz-ready 容器字节（全量场直转；裁域用 cropGrid 后再 serializeGrid）。 */
export function convertGrib2(
  buffer: ArrayBuffer | Uint8Array,
  opts?: ConvertOptions,
): Uint8Array[] {
  return decodeGrib2(buffer).map((f) => serializeGrid(fieldToGrid(f, opts).header, f.values));
}
