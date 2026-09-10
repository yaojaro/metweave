// 工作区契约检查：
//   ① 锁步版本——v0.x 阶段五包必须同版本；
//   ② core 零依赖——IR 包不得有任何运行时依赖 / peerDependencies；
//   ③ 依赖方向单向——parser→core←render，leaflet→core+render，伞包全依赖，禁止其他组合；
//   ④ publishConfig 替换就位——开发期 exports 指向 src，发布时必须替换为 dist。
// CI 门禁：pnpm check:workspace
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const packagesDir = join(root, "packages");

const EXPECTED_INTERNAL_DEPS = {
  "@metweave/core": [],
  "@metweave/parser": ["@metweave/core"],
  "@metweave/render": ["@metweave/core"],
  "@metweave/leaflet": ["@metweave/core", "@metweave/render"],
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
  if (JSON.stringify(pkg.files) !== JSON.stringify(["dist"]))
    fail(`${pkg.name} files 应为 ["dist"]`);
}

if (versions.size > 1) fail(`锁步版本破坏: ${[...versions].join(" / ")}——五包必须同版本`);

if (errors.length > 0) {
  console.error(`check:workspace 失败（${errors.length} 处）:`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(
  `check:workspace 通过: ${dirs.length} 包 · 版本锁步 ${[...versions][0]} · 依赖方向契约 · publishConfig 就位`,
);
