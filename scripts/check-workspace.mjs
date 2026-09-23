// 工作区契约检查：
//   ① 锁步版本——v0.x 阶段五包必须同版本；
//   ② core 零依赖——IR 包不得有任何运行时依赖 / peerDependencies；
//   ③ 依赖方向单向——core←parser←render←leaflet（render/leaflet 消费展开器 tafSegments/expandTaf，
//      2026-09-23 随 TAF 分段明细落地改约；此前 leaflet 运行时 import parser 却只声明 devDep，
//      dist 外部化引用会令发布件解析失败——本批一并修正声明），伞包全依赖，禁止其他组合；
//   ④ publishConfig 替换就位——开发期 exports 指向 src，发布时必须替换为 dist；
//   ⑤ 子路径完整——开发期 exports 的每个子路径必须在 publishConfig.exports 有同键 dist 替换
//     （通用断言：新增子路径忘了发布面 → 发布即 404；产物缺失由 check:artifact 的 publint/attw 拦截）；
//   ⑥ README 十行承诺——已按 owner 裁决移除硬门禁（2026-09-12 第三轮评测）：十行承诺由 review 守，
//     不由 CI 守；此处仅 console.info 提示超限块，不再判失败。
//   ⑦ 五包 README 语言断言——已随文档语言政策（2026-09-15 双语 → 2026-09-16 中文单源）移交 `pnpm check:docs`。
// CI 门禁：pnpm check:workspace
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const packagesDir = join(root, "packages");

const EXPECTED_INTERNAL_DEPS = {
  "@metweave/core": [],
  "@metweave/parser": ["@metweave/core"],
  "@metweave/render": ["@metweave/core", "@metweave/parser"],
  "@metweave/leaflet": ["@metweave/core", "@metweave/parser", "@metweave/render"],
  metweave: ["@metweave/core", "@metweave/parser", "@metweave/render"],
};

const errors = [];
const fail = (msg) => errors.push(msg);
const readPkg = (dir) => JSON.parse(readFileSync(join(packagesDir, dir, "package.json"), "utf8"));

const dirs = readdirSync(packagesDir).filter((d) => !d.startsWith("."));
const found = new Set(dirs);
for (const name of Object.keys(EXPECTED_INTERNAL_DEPS)) {
  if (!found.has(name.split("/").pop())) {
    fail(`缺少包目录: ${name}`);
  }
}

const versions = new Set();
for (const dir of dirs) {
  const pkg = readPkg(dir);

  // ① 锁步版本
  versions.add(pkg.version);

  const internal = Object.keys(pkg.dependencies ?? {}).filter(
    (d) => d.startsWith("@metweave/") || d === "metweave",
  );
  const external = Object.keys(pkg.dependencies ?? {}).filter(
    (d) => !d.startsWith("@metweave/") && d !== "metweave",
  );
  const expected = EXPECTED_INTERNAL_DEPS[pkg.name];

  if (expected === undefined) {
    fail(`未知包: ${pkg.name}（EXPECTED_INTERNAL_DEPS 缺登记）`);
    continue;
  }

  // ② core 零依赖
  if (pkg.name === "@metweave/core") {
    if (internal.length + external.length > 0)
      fail(`@metweave/core 必须零运行时依赖，现有: ${[...internal, ...external].join(", ")}`);
    if (Object.keys(pkg.peerDependencies ?? {}).length > 0)
      fail(`@metweave/core 不得有 peerDependencies`);
  }

  // ③ 依赖方向单向
  for (const dep of internal) {
    if (!expected.includes(dep))
      fail(`${pkg.name} 依赖了 ${dep}，违反依赖方向契约（允许: ${expected.join(", ") || "无"}）`);
  }
  for (const dep of expected) {
    if (!internal.includes(dep)) fail(`${pkg.name} 缺少应声明的内部依赖: ${dep}`);
  }
  if (external.length > 0 && pkg.name !== "@metweave/leaflet") {
    fail(`${pkg.name} 出现外部运行时依赖: ${external.join(", ")}（如确需，先更新本契约脚本）`);
  }

  // ④ publishConfig 替换就位（开发期指向 src，发布替换为 dist；import/require 各带 types 子条件）
  const pc = pkg.publishConfig ?? {};
  if (pc.main !== "./dist/index.cjs" || pc.types !== "./dist/index.d.ts") {
    fail(`${pkg.name} publishConfig 缺少 dist 替换（main/types）`);
  }
  const devExports = pkg.exports?.["."];
  const pubExports = pc.exports?.["."];
  if (devExports?.import !== "./src/index.ts") fail(`${pkg.name} 开发期 exports.import 应指向 src`);
  // 顶层不得有 types 条件——否则 CJS 解析先命中它，拿到 ESM 类型（attw FalseESM）
  if ("types" in (pubExports ?? {}))
    fail(`${pkg.name} publishConfig.exports 顶层不得放 types 条件`);
  if (
    pubExports?.import?.types !== "./dist/index.d.ts" ||
    pubExports?.import?.default !== "./dist/index.js"
  ) {
    fail(`${pkg.name} publishConfig.exports.import 应为 { types: d.ts, default: index.js }`);
  }
  if (
    pubExports?.require?.types !== "./dist/index.d.cts" ||
    pubExports?.require?.default !== "./dist/index.cjs"
  ) {
    fail(
      `${pkg.name} publishConfig.exports.require 应为 { types: d.cts, default: index.cjs }（否则 CJS 消费者拿到 ESM 类型，attw FalseESM）`,
    );
  }
  if (JSON.stringify(pkg.files) !== JSON.stringify(["dist", "README.md", "LICENSE"]))
    fail(
      `${pkg.name} files 应为 ["dist", "README.md", "LICENSE"]（npm 包页需带 README；MIT 的随附许可声明必须随包分发，不得依赖打包工具自动补齐）`,
    );

  // ⑤ 子路径完整（通用断言，不针对特定包）：开发期 exports 的每个子路径，
  //    publishConfig.exports 必须有同键条目且指向 dist（import .d.ts/.js、require .d.cts/.cjs）
  const devSubpaths = Object.keys(pkg.exports ?? {}).filter((k) => k !== ".");
  for (const sub of devSubpaths) {
    const devSub = pkg.exports?.[sub];
    const pubSub = pc.exports?.[sub];
    if (pubSub === undefined) {
      fail(
        `${pkg.name} 开发期 exports 子路径 "${sub}" 在 publishConfig.exports 缺少对应条目——发布后该子路径 404`,
      );
      continue;
    }
    if ("types" in pubSub)
      fail(`${pkg.name} publishConfig.exports["${sub}"] 顶层不得放 types 条件（CJS 解析先命中）`);
    if (
      typeof pubSub.import?.types !== "string" ||
      !pubSub.import.types.startsWith("./dist/") ||
      !pubSub.import.types.endsWith(".d.ts") ||
      typeof pubSub.import.default !== "string" ||
      !pubSub.import.default.startsWith("./dist/")
    ) {
      fail(
        `${pkg.name} publishConfig.exports["${sub}"].import 应为 { types: dist/*.d.ts, default: dist/*.js }`,
      );
    }
    if (
      typeof pubSub.require?.types !== "string" ||
      !pubSub.require.types.startsWith("./dist/") ||
      !pubSub.require.types.endsWith(".d.cts") ||
      typeof pubSub.require.default !== "string" ||
      !pubSub.require.default.startsWith("./dist/")
    ) {
      fail(
        `${pkg.name} publishConfig.exports["${sub}"].require 应为 { types: dist/*.d.cts, default: dist/*.cjs }`,
      );
    }
    // 开发期子路径必须真实指向存在的 src 文件（防空挂导出）
    const devTarget =
      typeof devSub === "string"
        ? devSub
        : typeof devSub?.import === "string"
          ? devSub.import
          : undefined;
    if (typeof devTarget !== "string" || !devTarget.startsWith("./src/")) {
      fail(`${pkg.name} 开发期 exports["${sub}"] 应指向 ./src/ 下的文件`);
    } else if (!existsSync(join(packagesDir, dir, devTarget))) {
      fail(`${pkg.name} 开发期 exports["${sub}"] 指向的 ${devTarget} 不存在`);
    }
  }
  for (const sub of Object.keys(pc.exports ?? {}).filter((k) => k !== ".")) {
    if (!Object.keys(pkg.exports ?? {}).includes(sub)) {
      fail(`${pkg.name} publishConfig.exports 子路径 "${sub}" 在开发期 exports 无对应（两面漂移）`);
    }
  }
}

if (versions.size > 1) fail(`锁步版本破坏: ${[...versions].join(" / ")}——五包必须同版本`);

// ⑥ README 十行承诺（owner 裁决降级，2026-09-12）：ts 示例块行数超 10 仅提示不失败——
//    「十行代码」口号由 code review 守，不由 CI 硬门禁守（裁决来源：第三轮多角色评测，
//    采纳「十行硬上限催生压缩噪音示例」的同行意见；将来需要恢复硬门禁时把 info 换回 fail 即可）
{
  const readme = readFileSync(join(root, "README.md"), "utf-8");
  const tsBlocks = [...readme.matchAll(/```ts\r?\n(.*?)```/gs)].map((m) => m[1] ?? "");
  for (const [i, body] of tsBlocks.entries()) {
    const lineCount = body.replace(/\n$/, "").split("\n").length;
    if (lineCount > 10)
      console.info(
        `提示: README 第 ${i + 1} 个 ts 代码块 ${lineCount} 行，超过十行承诺——review 时请确认是否有意为之`,
      );
  }
}

// ⑦ 五包 README 语言断言（2026-09-15 移交）：语言政策历经两次反转（英文优先 → 双语中文在前
//    → 2026-09-16 中文单源），存在性与镜像章节检查统一由 `pnpm check:docs`
//    （scripts/check-docs-chinese.mjs）承担，此处不再重复断言。

// ⑧ CI 最小权限锁：workflow 必须显式声明 permissions: contents: read（删除即红——防回退）
{
  const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf-8");
  if (!/^permissions:\s*\n\s*contents:\s*read\b/m.test(ci))
    fail("ci.yml 缺少 permissions: contents: read 最小权限声明");
}

// ⑨ CI 矩阵单档锁：node-version 必须是 [22]（2026-09-16 实证回归锁）——
//    pnpm 11（packageManager 锁定）engines >=22.13，Node 20 档在 setup-node 的
//    cache: pnpm 解析 store 路径时即失败；多档矩阵改宽即红，防「20 档验证消费端
//    承诺」式好心回归（消费端承诺由 ES2022 产物 + engines 字段 + attw 守）。
{
  const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf-8");
  if (!/^[ \t]*node-version: \[22\]$/m.test(ci))
    fail("ci.yml 矩阵必须为单档 node-version: [22]（pnpm 11 不支持更低的 Node，见 ci.yml 注释）");
}

if (errors.length > 0) {
  console.error(`check:workspace 失败（${errors.length} 处）:`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(
  `check:workspace 通过: ${dirs.length} 包 · 版本锁步 ${[...versions][0]} · 依赖方向契约 · publishConfig 就位 · 文档语言由 check:docs 把关`,
);
