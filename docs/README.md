# docs

metweave 的合规与数据文档（仓库内 Markdown，无独立文档站）。

- [compliance.md](compliance.md)：编码面符合性审计矩阵（METAR/SPECI 106 条 + TAF/FM 51 24 条清单）——逐条给出条款、规范出处、实现位置与回归锁。
- [error-codes.md](error-codes.md)：机读错误码全表（解析告警 6 码 + parse 10 码 + source 5 码 + grid 11 码，含英文文案入口）。
- [unknown-shapes.md](unknown-shapes.md)：解析器当前保留为 `unknown-token` 告警的形态看板（METAR 语料快照机械再生 + TAF 语料活算）。
- [iwxxm-notes.md](iwxxm-notes.md)：IWXXM 施工底档（v0.3 alpha）——schema 复核结论表（2023-1 XSD + 官方等价对实证）、语义难点落位决策、TAF 解析与 IR→IWXXM 生成侧（序列化出口 + 合规验证层级）、ECCC 真实流探测记录与遗留项。
- [grid-notes.md](grid-notes.md)：格点填色施工底档（v0.3 起）——垂直切片×微内核架构、温度切片设计选型表（分位数直读八分位梯子/超采样/冻结基线前端拼装/拉最新防抖）、格点图层并入主示例页的形态调整记录、逐要素生长口径。
