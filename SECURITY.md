# Security Policy / 安全策略

> **中文**：发现安全问题请**不要**开公开 issue——优先用 GitHub 的私密漏洞报告（仓库 Security 标签页），或致信 <yaojaro@metweave.com>。我们会在 7 天内确认、30 天内给出修复或缓解。
>
> **English**: Found a security issue? Please do **not** open a public issue — use GitHub's private vulnerability reporting (the repository's Security tab), or email <yaojaro@metweave.com>. We will acknowledge within 7 days and aim for a fix or mitigation within 30 days.

## 中文

### 支持版本

| 版本  | 支持 |
| ----- | ---- |
| 0.1.x | ✅   |

v0.x 的各版本同步发布——请始终升级到最新的 patch。

### 报告漏洞

- **首选**：GitHub [私密漏洞报告](https://github.com/yaojaro/metweave/security/advisories/new)——细节不进入公开 tracker。
- **备选**：致信 <yaojaro@metweave.com>，主题请注明 `[metweave security]`。

请随报告附上：受影响的包（`metweave` / `@metweave/*`）及版本、一份最小复现（原始报文字符串加上调用代码）、以及你对影响的评估。我们会在 **7 天**内确认，力争 **30 天**内给出修复或缓解；欢迎你在变更日志中署名。

### 在范围内

- **解析器健壮性**：恶意输入导致的崩溃、ReDoS、无界内存或死循环（模糊测试套件已对这些做了断言——能绕过它们，正是我们最想听到的）；
- **注入**：任何报文内容（站名、备注文本、悬浮标题）未经转义就到达 `innerHTML`、`eval` 或 URL/属性拼接的路径——渲染层建立在 `createElement`/`textContent` 之上，Leaflet 适配器对插值字符串做了转义；欢迎来证明我们错了；
- **供应链**：被投毒的依赖，或与源码不一致的构建产物；
- **有安全影响的契约违约**：原文未逐字保留、span 指向原始字符串边界之外。

### 不在范围内

- 上游公开数据源（IEM、tgftp、瓦片服务）的可用性或准确性——README 的风险披露已说明它们是非官方、按现状提供的渠道；
- 气象观测数据本身的准确性；
- Leaflet、Vite 等依赖自身的漏洞——请报给上游；若锁定旧版本能规避，也请告诉我们；
- 文档声明的 Node ≥ 20 支持范围之外的非浏览器运行时中的问题。

### 测试授权（Safe Harbor）

我们认定：以善意方式对本项目开展的安全研究属于授权行为。只要不侵犯隐私、不破坏数据、不降低服务可用性，并通过上述渠道报告发现，我们不会对研究者采取追责行动。本授权仅覆盖本项目自身的代码与发布产物——不含上游数据源与第三方服务（IEM、NWS tgftp、瓦片服务商等），对其测试请先取得相应服务方的许可。

## English

### Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |

v0.x releases move in lockstep — always upgrade to the latest patch.

### Reporting a vulnerability

- **Preferred**: GitHub [private vulnerability reporting](https://github.com/yaojaro/metweave/security/advisories/new) — keeps details out of the public tracker.
- **Alternative**: email <yaojaro@metweave.com> with `[metweave security]` in the subject.

Please include: affected package(s) (`metweave` / `@metweave/*`) and version, a minimal reproduction (a raw report string plus the calling code), and your assessment of impact. We will acknowledge within **7 days** and aim for a fix or mitigation within **30 days**; you are welcome to be credited in the changelog.

### In scope

- **Parser hardening**: crashes, ReDoS, unbounded memory or infinite loops on hostile input (the fuzz suite already asserts these — a bypass is exactly what we want to hear about);
- **Injection**: any path where report content (station names, remark text, hover titles) reaches `innerHTML`, `eval`, or a URL/attribute without escaping — the render layer is built on `createElement`/`textContent` and the Leaflet adapter escapes interpolated strings; prove us wrong;
- **Supply chain**: a compromised dependency or a build artifact that diverges from its source;
- **Contract violations with security impact**: raw text not preserved verbatim, spans pointing outside the raw string.

### Out of scope

- Availability or accuracy of upstream public data sources (IEM, tgftp, tile providers) — the README's risk disclosure already states they are unofficial, as-is channels;
- The accuracy of the weather observations themselves;
- Vulnerabilities in Leaflet, Vite or other dependencies — report upstream, but let us know if a version pin helps;
- Reports from non-browser runtimes outside the documented Node ≥ 20 support.

### Safe harbor

We consider security research conducted in good faith on this project to be authorized: we will not pursue action against anyone who avoids privacy violations, data destruction, and service degradation, and who reports findings through the channels above. This authorization covers this project's own code and published artifacts only — not upstream data sources or third-party services (IEM, NWS tgftp, tile providers); obtain those providers' permission before testing them.
