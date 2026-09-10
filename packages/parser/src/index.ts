/**
 * @metweave/parser — 解析层：TAC（METAR/SPECI/TAF）→ IR。
 * The parsing layer: TAC (METAR/SPECI/TAF) → IR.
 *
 * 接口纪律：
 * - 签名 parse(raw, { mode: 'tolerant' | 'strict' })，v0.1 只实现 tolerant；
 * - 未知组不静默丢弃，进 warnings[]（原文 span + 原因 + 严重度）；
 * - IR 字段携带原文 span，供报文对照视图消费；
 * - strict 模式预留给将来的报文校验场景。
 */

/** 脚手架占位导出：验证跨包构建图，解析器实装时移除。 */
export const parserEntry = { name: "@metweave/parser", stage: "parse" } as const;
