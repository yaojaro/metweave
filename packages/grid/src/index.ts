/**
 * @metweave/grid — 格点标量场包（内核主入口，P0 基建面）。
 *
 * P0（2026-10-06 基建收口）：viz-ready v1 容器读写（MWGRID1）+ 类型面；
 * 温度切片起生长内核能力（双线性插值/分级设色/renderToImageData/等值线）——加法生长
 * 不改旧路径（垂直切片：按要素逐个生长）。GRIB2 转换走 ./convert 子路径。
 *
 * 温度切片（格点线第一切片）新增：渲染内核 core（插值/分级/逐像素渲染）+ 要素档案层
 * element/elements（色标与档位单一事实来源；每要素一文件，档案间零 import）。
 *
 * 气压切片（第八切片）新增：等值线几何 contours（contoursOf——d3-contour 在显示空间
 * 值场上取 threshold 序列出闭合环，本包唯一运行时外部依赖，owner 2026-10-04 终批）与
 * 场中心检测（centersOf——局部极值＋间距吸收，L/H 标注的数据面）。既有色斑渲染路径
 * 零改动（快照锁死）。
 *
 * 500hPa 高度切片（第九切片）内核零改动：gh 档案消费 contoursOf 的 highlighted 特值
 * 线种（5880 副高线），接线在 @metweave/leaflet 的 addContourLayer。
 *
 * 风切片（第十三切片）新增：双分量合成 windSpeedGrid（u/v 双场→风速 √(u²+v²)——
 * 显示侧派生量，存储不动）与风向杆位序列 windBarbsOf（抽稀步长×静风阈→
 * [{lat,lon,direction,speed}]）。既有色斑渲染路径零改动（快照锁死）。
 */
export { GridError } from "./errors";
export type { GridErrorCode } from "./errors";
export { MAGIC, HEADER_VERSION, parseGrid, serializeGrid, computeStats } from "./format";
export type { Grid, GridHeader, GridGeometry, GridStats, GridMeta } from "./format";
export {
  interpolateBilinear,
  equalStepBreaks,
  quantileBreaks,
  thresholdBreaks,
  binIndexAt,
  renderToImageData,
} from "./core";
export type { ColorScale, RenderOptions, RenderedImage, RgbaColor } from "./core";
export { contoursOf, centersOf } from "./contours";
export type { ContourLine, FieldCenter, CentersOptions } from "./contours";
export { windSpeedGrid, windBarbsOf } from "./wind";
export type { WindBarb } from "./wind";
export { buildColorScale } from "./element";
export type { ElementProfile, EqualScaleSpec, ContourSpec, BarbSpec } from "./element";
export { tmpProfile } from "./elements/tmp";
export { dptProfile } from "./elements/dpt";
export { rhProfile } from "./elements/rh";
export { capeProfile } from "./elements/cape";
export { prateProfile } from "./elements/prate";
export { visProfile } from "./elements/vis";
export { refcProfile } from "./elements/refc";
export { prmslProfile } from "./elements/prmsl";
export { ghProfile } from "./elements/gh";
export { spProfile } from "./elements/pres";
export { t850Profile } from "./elements/t850";
export { tcdcProfile } from "./elements/tcdc";
export { windProfile } from "./elements/wind";
