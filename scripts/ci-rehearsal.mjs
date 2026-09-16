#!/usr/bin/env node
// CI 本地预演（推送前必做，pre-push 钩子自动触发）：按 .github/workflows/ci.yml 的
// 步骤顺序在本地执行全部门禁——防「本地绿、CI 红」的反复（2026-09-16 实证两次：
// Node 20 矩阵失败、性能冒烟 CI 慢机超时，均在推送后才发现）。
//
// 与 CI 的两处已知差异（如实声明，均为本侧更严或已对齐）：
// ① Node 版本：CI 矩阵 [22]；test 步骤在此以 npx node@22.21.0 执行（与 CI 同版），
//    其余步骤本机 Node 执行（无版本敏感行为）；
// ② 泄露扫描：本机带私有模式清单（fail-closed），比 CI 无变量时的通用降级模式更严——
//    本机过则 CI 面必过。
// pnpm install --frozen-lockfile 保留：lockfile 与 package.json 漂移正是 CI 会抓的第一类错。

import { spawnSync } from "node:child_process";

const steps = [
  // 第 0 步清构建产物：模拟 CI 全新 checkout——本地残留的 examples/dist 携带本机 key
  //（build:examples 会内联 .env.local 的 VITE_TIANDITU_KEY），不清会让本轮 check:leaks 误红
  ["clean 构建产物（模拟全新 checkout）", "rm -rf examples/dist node_modules/.artifacts"],
  ["install (frozen lockfile)", "pnpm install --frozen-lockfile"],
  ["lint (type-aware)", "pnpm lint"],
  ["typecheck", "pnpm typecheck"],
  [
    "test (Node 22，与 CI 同版)",
    "npx -y -p node@22.21.0 node ./node_modules/vitest/vitest.mjs run",
  ],
  ["format:check", "pnpm format:check"],
  ["check:workspace", "pnpm check:workspace"],
  ["check:terms", "pnpm check:terms"],
  ["check:leaks", "pnpm check:leaks"],
  ["check:docs", "pnpm check:docs"],
  ["check:knip", "pnpm check:knip"],
  ["build (五包)", "pnpm build"],
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
