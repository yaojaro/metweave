/**
 * @metweave/core — 标准化层：IR 数据模型与语义工具。
 * The standardization layer: the IR data model and semantic utilities.
 *
 * 管道稳定契约：解析器（格式 → IR）与渲染内核（IR → 图）互不依赖，
 * 各自只面对本包定义的数据模型（解析告警与原文位置、三态缺测、原文 span、格点数据结构）。
 */
export * from "./errors";
export * from "./ir";
