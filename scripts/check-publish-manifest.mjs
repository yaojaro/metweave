#!/usr/bin/env node
// 发布面守卫（prepublishOnly，0.3.1 安全红队 P1 卫生项）：防「误用 npm publish 发出坏包」。
//
// 本仓六包的发布面契约 = package.json 的 publishConfig 覆盖（main/exports 指向 ./dist）+
// pnpm 的 workspace: 协议改写。npm publish 两者都不施加——会原样发出 main 指 ./src 源码、
// 依赖带 workspace:* 不可解析的坏包。守卫三闸：
//   ①发布通道闸：非 pnpm 通道（npm publish）一律非零退出——npm 不会施加 publishConfig 覆盖
//     与 workspace: 改写，包面必然是坏的；
//   ②发布面 main 闸：pnpm 发布面（publishConfig.main 覆盖后的 main）必须以 ./dist 开头——
//     publishConfig 缺失或漂移（main 仍指 src）即拒绝发布；
//   ③发布面依赖闸：publishConfig.dependencies（如显式声明）不得残留 workspace: 前缀。
// 三闸同式（0.3.1 安全审查定式）：整体失败非零退出，绝不静默放行。
//
// 六包 prepublishOnly 各自引用本脚本（node ../../scripts/check-publish-manifest.mjs）；
// 生命周期脚本的工作目录 = 包目录，一切以 cwd 的 package.json 为准。
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fail = (message) => {
  console.error(`[publish-guard] ${message}`);
  process.exit(1);
};

// ① 发布通道闸：npm_config_user_agent 是各客户端自报的稳定面（pnpm/11 npm/? node/20 …）
const userAgent = process.env.npm_config_user_agent ?? "";
if (!userAgent.startsWith("pnpm")) {
  fail(
    `发布须走 pnpm publish（当前通道 user-agent=${userAgent || "未知"}）——npm publish 不施加 publishConfig 覆盖、不改写 workspace: 协议，会原样发出 main 指 src、依赖不可解析的坏包`,
  );
}

let pkg;
try {
  pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
} catch (err) {
  fail(`package.json 不可读（cwd=${process.cwd()}：${String(err)}）`);
}

// ② 发布面 main 闸
const publishMain = pkg.publishConfig?.main ?? pkg.main;
if (typeof publishMain !== "string" || !publishMain.startsWith("./dist")) {
  fail(
    `发布面 main（${String(publishMain)}）不以 ./dist 开头——publishConfig 缺失或漂移（开发面 main 指 ./src 仅供 monorepo 内联），拒绝发布`,
  );
}

// ③ 发布面依赖闸：publishConfig.dependencies（如显式声明）不得残留 workspace:
const publishDeps = pkg.publishConfig?.dependencies;
if (publishDeps !== undefined) {
  const leaked = Object.entries(publishDeps).filter(
    ([, value]) => typeof value === "string" && value.startsWith("workspace:"),
  );
  if (leaked.length > 0) {
    fail(
      `publishConfig.dependencies 残留 workspace: 前缀（${leaked
        .map(([name]) => name)
        .join("、")}）——发布面依赖不可解析，拒绝发布`,
    );
  }
}
// 双保险：非 pnpm 通道下原 dependencies 的 workspace: 亦不放行（①变动的防静默漏放）
const rawDeps = pkg.dependencies ?? {};
const workspaceDeps = Object.entries(rawDeps).filter(
  ([, value]) => typeof value === "string" && value.startsWith("workspace:"),
);
if (!userAgent.startsWith("pnpm") && workspaceDeps.length > 0) {
  fail(
    `dependencies 残留 workspace: 前缀（${workspaceDeps
      .map(([name]) => name)
      .join("、")}）且非 pnpm 通道——发布面依赖不可解析`,
  );
}

console.log(
  `[publish-guard] ${pkg.name ?? "（未知名）"} 发布面校验通过（main=${publishMain}，workspace 依赖 ${
    workspaceDeps.length
  } 项由 pnpm 打包期改写）`,
);
