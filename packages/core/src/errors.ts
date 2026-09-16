/**
 * @metweave/core — 机读错误面：解析整体失败与取数失败的错误类。
 *
 * 契约（与 WarningCode 同纪律）：
 * 1. code 是稳定契约——命名只增不改，消费方按 code 分流（机读）；
 *    message 保持中文（v0.1 主受众），将来本地化 message 文案不算破坏性变更。
 * 2. 错误类挂 @metweave/core（零依赖、与 IR 同级），parser 与伞包（sources）按依赖方向引用；
 *    伞包 metweave 对 core 全量再导出，消费方 `import { MetarParseError } from "metweave"` 即得。
 * 3. 扩展新 code / 新字段属 additive 变更（v0.x 版本政策见根 README）。
 */

/**
 * The six whole-report parse failure codes (IR contract: non-string input / missing station / missing time / out-of-range time = whole-report failure, not field-level three states).
 * parse 整体失败的六路（IR 契约：输入非字符串/无站名/无时组/时组越界 = 整体失败，不是字段级三态）。
 */
export type MetarParseErrorCode =
  | "invalid-input" /** 输入非字符串（parse(raw: string) 收到 null/数字等）——走稳定契约而非裸 Error，EN_MESSAGES 可查表 */
  | "missing-station" /** 首个 token 不是四字符站名组（含空输入） */
  | "missing-time" /** 站名后无 ddHHMMZ 时组 */
  | "invalid-time" /** 时组在位但数值越界（日/时/分超范围）——值不可信，等同无效时组 */
  | "unsupported-mode" /** mode:'strict' 在 v0.1 未实现（路线图项）——类型已预留，调用即明确报错而非静默降级 */
  /** 批量聚合解析失败（伞包 getMetarReports 缺省模式：任一行整体失败即聚合抛出）。
   *  注意 raw 字段语义在本 code 下的调整：承载汇总信息（网络名/失败条数/逐条站名与原因）而非单条报文原文——
   *  单条原文仍可经 message 与 onUnparseable 回调取得，语义差异在本注释声明。 */
  | "batch-parse-failed";

/**
 * Whole-report parse failure for a METAR/SPECI report.
 * METAR/SPECI 报文整体解析失败。
 * The `raw` field keeps the input verbatim (failure samples can be stored for review without extra capture).
 * raw 字段保留输入原文（失败样本可直接落库复盘，无需额外捕获）。
 */
export class MetarParseError extends Error {
  readonly code: MetarParseErrorCode;
  /** 解析失败的输入原文（原样保真） */
  readonly raw: string;

  constructor(code: MetarParseErrorCode, raw: string, message: string) {
    super(message);
    this.name = "MetarParseError";
    this.code = code;
    this.raw = raw;
  }
}

/**
 * The five fetch failure codes for getMetars / getMetarReports.
 * getMetars / getMetarReports 的五路取数失败。
 */
export type MetarSourceErrorCode =
  | "http-error" /** 源站返回非 2xx */
  | "bad-schema" /** 响应体不合约定 schema（缺 data 数组 / 记录字段类型不符） */
  | "empty-data" /** 200 + 空 data（错误网络名的典型形态，显式判错不静默） */
  | "timeout" /** timeoutMs 超时中止（外部 AbortSignal 取消不在此列——取消原样透传） */
  | "network"; /** 网络层失败（断网 / DNS 等 fetch 拒绝） */

/**
 * Fetch failure (IEM and other public sources): the `network` field names the failing network for per-network branching and messaging.
 * 取数失败（IEM 等公开源）：network 字段标注出错网络名，供按网分流与提示。
 */
export class MetarSourceError extends Error {
  readonly code: MetarSourceErrorCode;
  /** 出错的 IEM 网络名（如 CN__ASOS） */
  readonly network: string;

  constructor(
    code: MetarSourceErrorCode,
    network: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "MetarSourceError";
    this.code = code;
    this.network = network;
  }
}

/**
 * English messages for every error code (parse 6 + source 5), for consumers that
 * map `code` to their own UI copy.
 * 全部错误码的英文文案（parse 6 码 + source 5 码），供消费方按 code 映射自己的界面文案。
 *
 * Keyed by the stable machine-readable `code` (add-only contract); the bundled
 * Chinese `message` on each error remains the default narrative.
 * 键为稳定机读 `code`（只增不改）；错误实体上的中文 `message` 仍是默认叙述。
 */
export const EN_MESSAGES: Record<MetarParseErrorCode | MetarSourceErrorCode, string> = {
  "invalid-input": "Parse expects a METAR/SPECI report string, received a non-string value",
  "missing-station": "Not a METAR/SPECI report: station group missing or unrecognized",
  "missing-time": "Not a complete METAR/SPECI report: observation-time group missing",
  "invalid-time": "Observation-time group out of range (day 01–31 / hour 00–23 / minute 00–59)",
  "unsupported-mode": "Strict mode is not implemented in v0.1 — omit `mode` or pass 'tolerant'",
  "batch-parse-failed":
    "Some reports in the batch failed to parse entirely (see the summary for per-station reasons)",
  "http-error": "Source returned a non-2xx HTTP status",
  "bad-schema": "Response body does not match the agreed schema",
  "empty-data": "HTTP 200 with empty data — typically a wrong network name",
  timeout: "Request aborted after the configured timeout",
  network: "Network-level failure (offline, DNS, fetch refused)",
};
