// 公共 API 面快照检查（绿区补网第一条，2026-10-22 立）
//
// 由来：0.3.1 施工里发生过「公共导出 TEMP_DEW_PATTERN 被移除，只在 CHANGELOG 里用文字追认」
// ——这类改动靠人眼审、靠红队事后抓。口径已经明确（v0.x：公共 API 只增不改删，删须如实记档），
// 但口径没有对应的机械检查，等于没有口径。本脚本把它变成 CI 断言：
//
//   ① 逐包逐子路径抽取公共导出名单（沿 `export *` / `export { … } from` 递归解析，含 type 导出）；
//   ② 与仓内快照 scripts/api-surface.snapshot.json 逐项比对：
//        · 新增导出 → 失败，提示跑 `pnpm check:api --update` 并把快照一起提交（新增是允许的，但要留痕）；
//        · 移除导出 → 失败，除非在 scripts/api-surface.removals.json 里逐条写明理由（删除必须有据）；
//   ③ 移除登记簿里的残留条目（已恢复或从未存在的项）同样失败——登记簿自己也会腐烂。
//
// 刻意选择的严格点：任何未被本脚本识别的 `export` 形态一律失败（而不是跳过）。
// 宁可让新形态逼人扩提取器，也不允许出现「加了导出但快照没看见」的静默盲区。
//
// 用法：node scripts/check-api-surface.mjs [--update]
// CI 门禁：pnpm check:api

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const packagesDir = join(root, "packages");
const snapshotPath = join(root, "scripts", "api-surface.snapshot.json");
const removalsPath = join(root, "scripts", "api-surface.removals.json");
const update = process.argv.includes("--update");

// ---------------------------------------------------------------- 包与入口

/** 读出工作区全部包：name → { dir, pkg }。 */
function readPackages() {
  const map = new Map();
  for (const dir of readdirSync(packagesDir)) {
    const pkgPath = join(packagesDir, dir, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    map.set(pkg.name, { dir: join(packagesDir, dir), pkg });
  }
  return map;
}

/** 从 exports 值里找出开发期源码入口（第一个 ./src/*.ts 字符串）。 */
function srcEntryOf(value) {
  if (typeof value === "string") return value.startsWith("./src/") ? value : null;
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      const hit = srcEntryOf(value[key]);
      if (hit) return hit;
    }
  }
  return null;
}

// ---------------------------------------------------------------- 源码解析

/** 去注释：块注释整体抹掉、行注释抹掉（保留行结构，便于残留行定位）。 */
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

const RE_STAR_AS = /export\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["']/g;
const RE_STAR = /export\s+\*\s+from\s+["']([^"']+)["']/g;
const RE_BRACE = /export\s+(?:type\s+)?\{([\s\S]*?)\}\s*(?:from\s+["']([^"']+)["'])?\s*;?/g;
const RE_DECL =
  /export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function|class|interface|type|enum|namespace)\s*\*?\s*([A-Za-z_$][\w$]*)/g;
const RE_DEFAULT = /export\s+default\b/g;

/** 解析 `{ a, b as c, type D }` 里的导出名（以别名为准）。 */
function namesInBraces(body) {
  const names = [];
  for (const raw of body.split(",")) {
    const token = raw.trim().replace(/^type\s+/, "");
    if (!token) continue;
    const m = /^([A-Za-z_$][\w$]*)(?:\s+as\s+(?:type\s+)?([A-Za-z_$][\w$]*))?$/.exec(token);
    if (m) names.push(m[2] ?? m[1]);
    else names.push(`?无法解析:${token}`);
  }
  return names;
}

/** 把某个源码文件解析成「导出名 + 需要递归的模块说明符 + 未识别形态」。 */
function parseFile(file) {
  const code = stripComments(readFileSync(file, "utf8"));
  let rest = code;
  const names = [];
  const specs = [];
  const unknown = [];

  const consume = (re, handler) => {
    rest = rest.replace(re, (...args) => {
      handler(...args);
      return " ";
    });
  };

  consume(RE_STAR_AS, (_m, name) => names.push(name));
  consume(RE_STAR, (_m, spec) => specs.push(spec));
  consume(RE_BRACE, (_m, body, spec) => {
    names.push(...namesInBraces(body));
    if (spec) specs.push(spec);
  });
  consume(RE_DECL, (_m, name) => names.push(name));
  consume(RE_DEFAULT, () => names.push("default"));

  rest.split("\n").forEach((line, i) => {
    if (/^\s*export\b/.test(line)) {
      unknown.push(`${relative(root, file)}:${i + 1} → ${line.trim().slice(0, 80)}`);
    }
  });

  return { names, specs, unknown };
}

/** 模块说明符 → 源码文件（相对路径 / 工作区包 / 子路径三种）。 */
function resolveSpecifier(spec, fromFile, packages) {
  const candidates = [];
  if (spec.startsWith(".")) {
    const base = join(dirname(fromFile), spec);
    candidates.push(`${base}.ts`, join(base, "index.ts"));
  } else {
    const [, pkgName, sub] = /^((?:@[^/]+\/)?[^/]+)(?:\/(.+))?$/.exec(spec) ?? [];
    const entry = packages.get(pkgName);
    if (entry) {
      const key = sub ? `./${sub}` : ".";
      const src = entry.pkg.exports?.[key] ? srcEntryOf(entry.pkg.exports[key]) : null;
      if (src) candidates.push(join(entry.dir, src));
    }
  }
  return candidates.find((p) => existsSync(p) && statSync(p).isFile()) ?? null;
}

/** 递归收集一个入口文件的公共导出名。 */
function collectExports(entryFile, packages) {
  const names = new Set();
  const unknown = [];
  const visited = new Set();
  const walk = (file) => {
    if (visited.has(file)) return;
    visited.add(file);
    const parsed = parseFile(file);
    for (const n of parsed.names) names.add(n);
    unknown.push(...parsed.unknown);
    for (const spec of parsed.specs) {
      const next = resolveSpecifier(spec, file, packages);
      if (next) walk(next);
      else unknown.push(`${relative(root, file)} → 无法解析模块 ${spec}（公共面不完整即为失败）`);
    }
  };
  walk(entryFile);
  return { names: [...names].toSorted((x, y) => x.localeCompare(y)), unknown };
}

// ---------------------------------------------------------------- 主流程

const packages = readPackages();
const current = {};
const problems = [];

for (const [name, { dir, pkg }] of packages) {
  for (const spec of Object.keys(pkg.exports ?? {})) {
    const src = srcEntryOf(pkg.exports[spec]);
    if (!src) {
      problems.push(`${name}#${spec}：exports 未指向 ./src 源码入口，公共面无法抽取`);
      continue;
    }
    const { names, unknown } = collectExports(join(dir, src), packages);
    if (unknown.length) problems.push(...unknown.map((u) => `未识别导出形态：${u}`));
    if (names.length === 0) problems.push(`${name}#${spec}：抽取到 0 个导出，疑似提取器失效`);
    current[`${name}#${spec}`] = names;
  }
}

if (problems.length) {
  console.error("check:api 失败——公共面抽取不完整：");
  for (const p of problems) console.error(`  · ${p}`);
  process.exit(1);
}

if (update) {
  writeFileSync(snapshotPath, `${JSON.stringify(current, null, 2)}\n`);
  console.log(
    `check:api：快照已更新（${Object.keys(current).length} 个入口，${countAll(current)} 个导出）`,
  );
  process.exit(0);
}

const previous = existsSync(snapshotPath) ? JSON.parse(readFileSync(snapshotPath, "utf8")) : {};
const removals = existsSync(removalsPath) ? JSON.parse(readFileSync(removalsPath, "utf8")) : {};

const added = [];
const removed = [];
for (const key of new Set([...Object.keys(previous), ...Object.keys(current)])) {
  const before = new Set(previous[key] ?? []);
  const after = new Set(current[key] ?? []);
  for (const n of after) if (!before.has(n)) added.push(`${key} :: ${n}`);
  for (const n of before) if (!after.has(n)) removed.push(`${key} :: ${n}`);
}

const allowed = new Set();
for (const [key, entries] of Object.entries(removals)) {
  for (const item of entries) allowed.add(`${key} :: ${item.name}`);
}

const unregistered = removed.filter((r) => !allowed.has(r));
const stale = [...allowed].filter((a) => !removed.includes(a));

if (added.length) {
  console.error("check:api 失败——公共面新增导出未入快照：");
  for (const a of added) console.error(`  + ${a}`);
  console.error(
    "  新增是允许的（v0.x 口径：只增不改删），但必须留痕：pnpm check:api --update 后把快照一起提交。",
  );
}

if (unregistered.length) {
  console.error("check:api 失败——公共面移除导出未登记理由：");
  for (const r of unregistered) console.error(`  - ${r}`);
  console.error(
    `  移除属破坏性变更，须在 ${relative(root, removalsPath)} 逐条写明理由（形如 {"<包名>#<子路径>": [{"name": "...", "reason": "..."}]}）。`,
  );
}

if (stale.length) {
  console.error("check:api 失败——移除登记簿有残留条目（该项并未被移除，或已恢复）：");
  for (const s of stale) console.error(`  ? ${s}`);
}

if (added.length || unregistered.length || stale.length) process.exit(1);

console.log(
  `check:api 通过：${Object.keys(current).length} 个公共入口 · ${countAll(current)} 个导出 · 与快照逐项一致` +
    (allowed.size ? ` · 已登记移除 ${allowed.size} 项` : ""),
);

function countAll(map) {
  return Object.values(map).reduce((sum, arr) => sum + arr.length, 0);
}
