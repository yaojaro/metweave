/**
 * @metweave/grid — 机读错误面：viz-ready 容器与 GRIB2 解码的错误类。
 *
 * 契约（与 @metweave/core 错误面同纪律）：code 稳定只增不改，消费方按 code 分流；
 * message 中文。扩展新 code / 新字段属 additive 变更。
 */
export type GridErrorCode =
  | "invalid-magic" /** .mwgrid 容器魔数不符（非 MWGRID1 或损坏） */
  | "truncated" /** 容器或 GRIB2 message 长度越界（截断文件） */
  | "header-json-invalid" /** 容器头 JSON 解析失败 */
  | "payload-size-mismatch" /** float32 payload 字节数与头网格声明不符 */
  | "unsupported-drt" /** GRIB2 数据表示模板不在支持集（本包：5.2/5.3 complex packing） */
  | "unsupported-bitmap" /** GRIB2 位图路径（Sec6 ≠ 255）——基线语料未覆盖，遇之显式报错不静默 */
  | "unsupported-missing-mgmt" /** GRIB2 复杂打包缺测替代管理（missMgmt ≠ 0）——同上，显式报错 */
  | "group-sum-mismatch" /** 5.2/5.3 组长和 ≠ 网格点数（结构损坏或布局不识别） */
  | "empty-input" /** 输入为空或非 GRIB/mwgrid 数据 */
  | "grid-mismatch" /** 双分量合成时两场网格几何/量纲不匹配（风切片引入） */
  | "invalid-scale"; /** 分级/色标参数非法（断点非严格递增、色值不合法、分位点不在预计算梯子等） */

/** viz-ready 容器与 GRIB2 解码的结构化失败（code 机读、message 中文）。 */
export class GridError extends Error {
  readonly code: GridErrorCode;

  constructor(code: GridErrorCode, message: string) {
    super(`[${code}] ${message}`);
    this.name = "GridError";
    this.code = code;
  }
}
