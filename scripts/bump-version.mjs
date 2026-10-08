#!/usr/bin/env node
// bump-version.mjs —— 六包版本锁步 bump（防手工改六份 package.json 漏一份）。
//
// 用法：node scripts/bump-version.mjs <version> [--dry-run]
//   <version>  目标版本号（semver 三段；v 前缀容忍剥除）
//   --dry-run  只打印计划不写盘（测试与预览用）
//
// 做什么：改 packages/*（六包：core/parser/render/grid/leaflet/metweave）的 version 字段
//   为同一值。不做什么：不动 examples（private 0.1.0 不参与锁步）、不碰 CHANGELOG、不
//   commit、不 tag、不 publish——后续步骤是人工纪律（见下方清单提示），本脚本只根治
//   「六包锁步漏改」这一机械易错点；版本一致性本身仍由 check:workspace ②把关（本脚本
//   产物跑一遍即证）。
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const version = args.find((a) => !a.startsWith("--"))?.replace(/^v/, "");

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
if (version === undefined || !SEMVER.test(version)) {
  console.error("用法: node scripts/bump-version.mjs <x.y.z> [--dry-run]");
  console.error("  版本号须为 semver 三段（预发布后缀容忍）");
  process.exit(2);
}

const root = fileURLToPath(new URL("..", import.meta.url));
const pkgDir = join(root, "packages");
const names = readdirSync(pkgDir)
  .filter((d) => existsSync(join(pkgDir, d, "package.json")))
  .toSorted();

if (names.length === 0) {
  console.error("未发现任何包——请在仓库根运行");
  process.exit(1);
}

const plans = [];
for (const dir of names) {
  const file = join(pkgDir, dir, "package.json");
  const pkg = JSON.parse(readFileSync(file, "utf-8"));
  plans.push({ dir, name: pkg.name, from: pkg.version, to: version, file });
}

console.log(`版本锁步 bump 计划（${names.length} 包 → ${version}）：`);
for (const p of plans) console.log(`  ${p.name}: ${p.from} → ${p.to}`);

if (dryRun) {
  console.log("dry-run：未写盘");
} else {
  for (const p of plans) {
    const pkg = JSON.parse(readFileSync(p.file, "utf-8"));
    pkg.version = version;
    // 末尾换行保持（JSON.stringify 不带换行，pnpm/oxfmt 约定文件以 \n 结尾）
    writeFileSync(p.file, `${JSON.stringify(pkg, null, 2)}\n`);
  }
  console.log("已写盘。后续人工步骤：");
  console.log("  1. CHANGELOG「未发布」段改版本标题并补日期；");
  console.log("  2. pnpm check:all 全绿后 commit；");
  console.log(`  3. git tag v${version}（不自动 tag——tag 与推送须本人当次同意）；`);
  console.log("  4. pnpm publish:all（build → check:artifact → 逐包 publish）。");
}
