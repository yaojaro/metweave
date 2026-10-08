# 错误与告警码清单

> 消费方按 `code` 分流、自行映射界面文案；本文是全部机读码的一页式清单，与代码同步维护。
> 计数总览：解析告警 6 码 + 解析失败 10 码 + 取数失败 5 码 + 格点 11 码。
> 稳定契约：所有 `code` **只增不改**（add-only）。抛错级 `message` 默认中文（v0.1 主受众），
> 英文文案用 `@metweave/core` 导出的 `EN_MESSAGES[code]` 查表（覆盖解析失败与取数失败两族；
> `@metweave/grid` 的 `GridError` 自带中文 message、无英文表）；解析告警（warning）的英文
> 模板已内置于卡片（`renderCard(report, { locale: "en" })` 自动切换）。

## 解析告警码（ParseWarning.code，共 6 个）

`warnings[]` 挂在解析成功的 IR 上（`report.warnings`，恒存在、可为空数组），每条含
`code` / `severity` / `message` / `span?`。severity 三档：`info`＝如实收下的反常、
`warning`＝可疑但可用、`error`＝严重存疑（预留档，解析器当前不产出）。

| code                   | severity | 含义                                                                    |
| ---------------------- | -------- | ----------------------------------------------------------------------- |
| `unknown-token`        | info     | 正文里不认识的组——原样保留进告警（带原文位置），绝不丢弃                |
| `invalid-format`       | info     | 认出组但内容不合语法（如趋势段收口于非趋势组）                          |
| `value-out-of-range`   | warning  | 数值超物理或条文范围（如 Q10054）——判缺测，绝不留假值                   |
| `missing-expected`     | info     | 组内必有部分缺测（如 `BKN///`、`/////KT`、`////`）                      |
| `duplicate-group`      | warning  | 同族组重复出现——以末组为准，前值后值原文都在 message，前值经原文回溯    |
| `cross-check-conflict` | warning  | 语义交叉校验失败（温露倒挂、CAVOK 与云/能见度矛盾、RMK T 组与正文不符） |

## 解析失败码（MetarParseError.code，共 10 个）

整体失败（非字段级三态）：`tryParse` 返回 `{ ok: false, error }`，`parse` 直接 throw，
`error.raw` 保留输入原文。

| code                 | 含义                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `invalid-input`      | 输入非字符串（收到 null / 数字等）                                                                                            |
| `missing-station`    | 首个 token 不是四字符站名组（含空输入）                                                                                       |
| `missing-time`       | 站名后无 ddHHMMZ 时组                                                                                                         |
| `invalid-time`       | 时组在位但数值越界（日/时/分超范围）——值不可信等同无效                                                                        |
| `missing-validity`   | TAF：发布时组后无 ddHH/ddHH 有效期组（NIL 占该位＝合法缺报，见 `TafReport.nil`）                                              |
| `invalid-validity`   | TAF：有效期组数值越界（日起 01–31 / 起时 00–23 / 止时 00–24——24 为午夜合法特例）                                              |
| `unsupported-mode`   | `mode: "strict"` METAR 侧未实现（显式传即明确报错）；TAF 侧 `parseTaf` 已支持 strict                                          |
| `strict-violation`   | TAF strict 严判未通过：`validateTaf` 条文违例（C2/C3/C5/C7）或 warning 级解析告警——聚合为整体拒绝，逐项在 message             |
| `batch-parse-failed` | 批量聚合失败（`getMetarReports` 缺省模式）——`raw` 字段此时承载汇总信息，单条原文在 message 与 `onUnparseable` 回调            |
| `taf-not-expandable` | TAF 派生层（`expandTaf` / `tafSegments`）：报文无时间线可展开——NIL/CNL 报或缺有效期组；派生层前置条件不满足属可判定的整体失败 |

## 取数失败码（MetarSourceError.code，共 5 个）

`getMetars` / `getMetarReports`（IEM）与 `getTafs` / `getTafReports`（aviationweather TAF）的取数失败；`error.network` 标注出错的网络名/源名（IEM 网络名或 `aviationweather`）。

| code         | 含义                                                                 |
| ------------ | -------------------------------------------------------------------- |
| `http-error` | 源站返回非 2xx                                                       |
| `bad-schema` | 响应体不合约定 schema（缺 data 数组 / 字段类型不符）                 |
| `empty-data` | HTTP 200 + 空 data——典型形态是网络名拼写错误（显式判错，不静默空图） |
| `timeout`    | 超过 `timeoutMs` 中止（外部 AbortSignal 取消不在此列，取消原样透传） |
| `network`    | 网络层失败（断网 / DNS / fetch 拒绝）                                |

## 格点失败码（@metweave/grid 的 GridError.code，共 11 个）

viz-ready 容器（`.mwgrid`）读写、GRIB2 解码与分级设色的结构化失败——`code` 机读、
`message` 中文，契约与上述两族同纪律（只增不改）。按子系统分节列出。

### viz-ready 容器（format.ts）

| code                    | 含义                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `invalid-magic`         | 容器魔数不符（非 `MWGRID1` 或损坏）                        |
| `truncated`             | 容器或 GRIB2 message 长度越界（截断文件）                  |
| `header-json-invalid`   | 容器头 JSON 解析失败（或头 `version` / `grid.nx/ny` 非法） |
| `payload-size-mismatch` | float32 payload 字节数与头网格声明不符                     |

### GRIB2 解码（grib2.ts / convert.ts）

| code                       | 含义                                                                    |
| -------------------------- | ----------------------------------------------------------------------- |
| `unsupported-drt`          | 数据表示模板不在支持集（本包：5.2/5.3 complex packing；含位宽超 32 位） |
| `unsupported-bitmap`       | GRIB2 位图路径（Sec6 ≠ 255）——显式报错不静默                            |
| `unsupported-missing-mgmt` | 复杂打包缺测替代管理（missMgmt ≠ 0）——同上                              |
| `group-sum-mismatch`       | 5.2/5.3 组长和 ≠ 网格点数（结构损坏或布局不识别）                       |
| `empty-input`              | 输入为空或非 GRIB/mwgrid 数据                                           |

### 渲染内核与场合成（core.ts / wind.ts）

| code            | 含义                                                                    |
| --------------- | ----------------------------------------------------------------------- |
| `grid-mismatch` | 双分量合成时两场网格几何/量纲不匹配（风切片引入）                       |
| `invalid-scale` | 分级/色标参数非法（断点非严格递增、色值不合法、分位点不在预计算梯子等） |
