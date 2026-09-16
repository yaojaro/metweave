# 更新日志

本项目的显著变更记录于此。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本语义遵循 [SemVer](https://semver.org/lang/zh-CN/)——v0.x 期间 minor 即可能引入破坏性变更，五个包锁步同版本发布。

## [未发布]

### 变更

- 文档语言政策反转为**中文单源**：根 README、CHANGELOG、CONTRIBUTING、`docs/`、`corpus/`、`examples/`、五包 README 与 `.github/` 模板统一为全中文（英文全文保存于 git 历史）。豁免两项保持原状——[SECURITY.md](SECURITY.md) 双语（安全报告是全球入站通道）、`terms/` 术语册一册一语言（产品多语言资产）。配套门禁 `check:docs` 由「双语强制」反转为「中文单源强制」：英文镜像章节与英文正文段落一律拦截（`scripts/check-docs-chinese.mjs`）。

## [0.1.0]

首版：机场报文（METAR / SPECI）的「解析 → 标准化 → 渲染」一条完整管道。

### 新增

- **tolerant METAR/SPECI 解析器**（`@metweave/parser`）：以真实公开报文夹具验收——未知组进 `warnings[]` 不静默、缺测电码三态显式建模、单位跟组走、超界值判缺测并告警、跑道状态组、RMK 附加段、趋势段要素结构化、语义交叉校验（温露倒挂、CAVOK 矛盾等）。
- **IR 数据模型**（`@metweave/core`）：解析器与渲染组件之间的唯一契约——纯 JSON 可序列化、一切产物携带原文 span、组级三态缺测、`toValues()` 两态取值视图、机读告警与错误码（code 只增不改）。
- **报文卡片**（`@metweave/render`）：零框架 DOM 组件——RAW 对照视图（缺测/告警高亮 + 悬停解释）、分组「转换说明」弹窗（原码 → 含义，附规范依据）、zh / en 双语 locale、云底正面单位随语言（en 英尺 / zh 米，`heightUnit` 可覆盖）、站名行与跑道状态行。
- **Leaflet 适配器**（`@metweave/leaflet`）：报文卡片上图（marker + tooltip + 卡片弹窗）。
- **伞包与取数**（`metweave`）：再导出 core / parser / render；`metweave/sources` 取数 helper（IEM currents 端点、超时/取消语义、机读错误码）。
- **质量基建**：2,300+ 条全球真实报文语料回放、种子化模糊测试（十一项产物不变量）、290+ 单元测试、全量静态门禁；[docs/compliance.md](docs/compliance.md) 收录 METAR/SPECI 编码面 105 条符合性审计矩阵。
- **端到端示例**（`examples/`）：公开报文 → 解析 → 地图，含站点元数据联表、条件色图层、实况获取状态反馈与页面免责声明；底图用天地图官方 WMTS 端点，按 key 门控（key 自备，仅经环境变量注入）。

### 修复

- 同族组重复改用专用告警 `duplicate-group`（warning 级，被顶替值与保留值原文都在 message）；后位零信息量缺测形态（`////` 等）不再按 last-wins 顶替在场观测。
- `addMetarLayer` 顶层 `locale` 生效（等价 `card.locale` 速记）；`renderCard` / `addMetarLayer` 对未知选项键与非法取值运行时报清晰错误，不再静默忽略。

[0.1.0]: https://github.com/yaojaro/metweave/releases/tag/v0.1.0
