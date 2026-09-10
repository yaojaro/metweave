/**
 * @metweave/core — 标准化层：IR 数据模型与语义工具。
 * The standardization layer: the IR data model and semantic utilities.
 *
 * 管道稳定契约：解析器（格式 → IR）与渲染内核（IR → 图）互不依赖，
 * 各自只面对本包定义的数据模型（解析告警与原文位置、flightRules 等语义工具、格点数据结构）。
 */

/** 脚手架占位导出：验证跨包构建图，IR 落地时移除。 */
export const coreEntry = { name: "@metweave/core", stage: "standardize" } as const;
