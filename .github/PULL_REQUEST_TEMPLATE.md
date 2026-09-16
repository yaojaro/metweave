> **提示**：项目暂不接受外部代码贡献，本模板保留待重开贡献时使用。

## 改了什么、为什么

<!-- 一段话说清：改动内容，以及背后的根因 / 动机。 -->

## 行为证据

<!-- 如何验证的：失败的测试 → 修复 → 通过（本仓的回归锁纪律）；
     解析器改动请附语料回放的前后对比摘要。 -->

## 语料 / 快照变更

<!-- 快照（corpus/snapshot.json）变更与夹具新增必须在此写明原因
     （同一原因也写进 commit message）——这是解析器改动可观察的机制。未动请写「无」。 -->

- [ ] 快照变更已说明原因（或未动快照）
- [ ] 新解析形态已配新夹具（尽量取公开通路的真实样本）

## 门禁

<!-- 外部贡献者提示：未设置 METWEAVE_LEAK_PATTERNS 时 `pnpm check:leaks`
     会提示回退内置通用模式，该警告属预期。 -->

- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm format:check`
- [ ] `pnpm build` + `pnpm check:workspace` + `pnpm check:leaks` + `pnpm replay:corpus` + `pnpm check:knip` + `pnpm check:artifact`（如有跳过，写明是哪些及原因）
