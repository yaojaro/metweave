#!/usr/bin/env node
// CI 本地预演（推送前必做，pre-push 钩子自动触发）：按 .github/workflows/ci.yml 的
// 步骤顺序在本地执行全部门禁——防「本地绿、CI 红」的反复（2026-09-16 实证两次：
// Node 20 矩阵失败、性能冒烟 CI 慢机超时，均在推送后才发现）。
//
// 与 CI 的两处已知差异（如实声明，均为本侧更严或已对齐）：
// ① Node 版本：CI 矩阵 [22]（浮动 latest 22.x）；test 步骤在此断言本机 Node 大版本 = 22 后
//    直接用本机 node 跑 vitest（2026-10-22 起弃用 `npx -p node@22.21.0` 钉小版本——npx 依赖
//    npm 包缓存的建删，缓存故障会被误判成测试失败而拦下推送；详见该步注释）；
// ② 泄露扫描：本机带私有模式清单（fail-closed），比 CI 无变量时的通用降级模式更严——
//    本机过则 CI 面必过。
// pnpm install --frozen-lockfile 保留：lockfile 与 package.json 漂移正是 CI 会抓的第一类错。

import { spawnSync } from "node:child_process";

// Node 大版本断言（与 ci.yml 矩阵同档）：单行内联，避免为一个断言新增脚本文件（knip 会判未用文件）。
const NODE_MAJOR_ASSERT =
  `node -e "const m=process.versions.node.split('.')[0];` +
  `if(m!=='22'){console.error('预演要求 Node 22.x 档位，当前 '+process.version);process.exit(1)}"`;

const steps = [
  // 第 0 步清构建产物：模拟 CI 全新 checkout——本地残留的 examples/dist 携带本机 key
  //（build:examples 会内联 .env.local 的 VITE_TIANDITU_KEY），不清会让本轮 check:leaks 误红
  ["clean 构建产物（模拟全新 checkout）", "rm -rf examples/dist node_modules/.artifacts"],
  ["install (frozen lockfile)", "pnpm install --frozen-lockfile"],
  ["lint (type-aware)", "pnpm lint"],
  ["typecheck", "pnpm typecheck"],
  [
    "test (Node 22，与 CI 同版)",
    // 2026-10-22 改：不再用 `npx -y -p node@22.21.0`。npx 要靠 npm 包缓存（`_npx/<hash>/
    // concurrency.lock` 的建与删）才能跑，缓存目录一旦不可写/不可删就以非零退出，预演会把
    // 「缓存故障」误判成「测试失败」并拦下推送（当日实测两次）。CI 矩阵本就只跑 22.x 浮动档
    // （check:workspace 断言⑨锁定），故改为：断言本机 Node 大版本 = 22，然后用本机 node 跑
    // vitest——门禁依赖的是代码与测试，不是包缓存的健康度。
    `${NODE_MAJOR_ASSERT} && node ./node_modules/vitest/vitest.mjs run`,
  ],
  ["format:check", "pnpm format:check"],
  ["check:workspace", "pnpm check:workspace"],
  // 2026-10-22 补：绿区补网新增的两道门禁也进预演——否则「预演绿、CI 红」的缺口正好开在
  // 新检查上（预演与 ci.yml 的步骤表必须同步增删，任何一侧漏项都等于没有这道门禁）
  ["check:api (公共 API 面快照)", "pnpm check:api"],
  ["check:doc-integrity (文档完整性四查)", "pnpm check:doc-integrity"],
  ["check:terms", "pnpm check:terms"],
  ["check:leaks", "pnpm check:leaks"],
  ["check:docs", "pnpm check:docs"],
  ["check:knip", "pnpm check:knip"],
  ["build (六包)", "pnpm build"],
  // 语料在仓内（corpus/），无网络依赖——与 CI quality job 的 replay:corpus 步同步
  ["replay:corpus (语料快照基线)", "pnpm replay:corpus"],
  // 空 VITE_TIANDITU_KEY 前缀强制走 keyless 分支（与 CI 无变量环境对齐，本机 .env.local 不内联）
  ["build:examples (keyless)", "VITE_TIANDITU_KEY= pnpm build:examples"],
  ["check:artifact (publint/attw/LICENSE)", "pnpm check:artifact"],
];

let failed = null;
for (const [name, cmd] of steps) {
  process.stdout.write(`▶ ${name}\n`);
  const r = spawnSync(cmd, { shell: true, stdio: "inherit" });
  if (r.status !== 0) {
    failed = name;
    break;
  }
}

if (failed !== null) {
  console.error(
    `\nci-rehearsal 未通过——失败步骤：${failed}\n推送已阻止：先修复再推（与 GitHub CI 同口径）。`,
  );
  process.exit(1);
}
console.log(`\nci-rehearsal 通过：${steps.length} 步全绿——与 CI 同口径，可推送。`);
