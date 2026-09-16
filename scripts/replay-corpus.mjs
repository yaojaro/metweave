#!/usr/bin/env node
// 语料回放器：对本地报文语料逐条过 @metweave/parser，产出统计报告（零网络依赖，只读本地文件）。
//
// 用法:
//   node scripts/replay-corpus.mjs corpus/*.txt                 # 人类可读摘要
//   node scripts/replay-corpus.mjs corpus/*.txt --json 快照.json # 写出完整统计（生成/更新基线快照）
//   node scripts/replay-corpus.mjs 语料.txt --baseline 快照.json # 对比模式：新增 unknown 形态逐条列出
//   node scripts/replay-corpus.mjs 语料.txt --parser ../别处/packages/parser/dist/index.js
//
// 输入格式（按扩展名自动识别）:
//   .txt   每行一条原始报文；空行与 tgftp 时间戳行（YYYY/MM/DD HH:MM）跳过；重复报文去重（均计入 lines）
//   .jsonl 每行一个 JSON 对象，取 raw 字段（站名缺失行按 station 字段归入失败样本）
//   .json  IEM currents 形状 { data: [{ station, raw }] } 或同构数组
//
// 统计口径:
//   - failures：整体解析失败（站名/时组缺失类）按错误类别归类并留样；
//   - unknownShapes：正文 unknown-token 按「形态」归并——数字串折叠为等长 #（QFE749 → QFE###），
//     频次+样例；这是防「形态盲区」复发的核心口径（与 corpus 快照测试同构，漂移会被测试拦截）；
//   - rmkHealth：trendRawsWithRMK = 趋势段吞 RMK 的签名计数（应恒为 0）。
//
// 对比模式退出码：发现新增 unknown 形态 → 1（可挂 CI/钩子）；无新增 → 0。
// 依赖：packages/parser/dist（先 pnpm build；vitest 冒烟锁走 src 不需要本脚本）。
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const files = [];
let jsonOut;
let baselinePath;
let parserPath;
for (let k = 0; k < args.length; k += 1) {
  const a = args[k];
  if (a === "--json") jsonOut = args[++k];
  else if (a === "--baseline") baselinePath = args[++k];
  else if (a === "--parser") parserPath = args[++k];
  else files.push(a);
}
if (files.length === 0) {
  console.error(
    "用法: node scripts/replay-corpus.mjs <语料文件...> [--json out] [--baseline base] [--parser path]",
  );
  process.exit(2);
}

const parserModule =
  parserPath ?? new URL("../packages/parser/dist/index.js", import.meta.url).pathname;
const usesDefaultParser = parserPath === undefined;
if (!existsSync(parserModule)) {
  console.error(
    `找不到 parser 产物（${parserModule}）——先 pnpm build，或用 --parser 指定 dist/index.js`,
  );
  process.exit(2);
}

// 解析条件自举：parser dist 以运行时 import 消费 @metweave/core（错误类等），而开发期
// core 的 exports 默认指向 src——裸 node 的类型剥离不解析无扩展名相对导入。此处按
// `--conditions=mw-dist` 重启自身（core 的开发期 exports 带 mw-dist 条件指向 dist，
// 发布面 publishConfig 不受影响），保证解析器与错误类在运行时是同一份类实体（instanceof 契约）。
const DIST_CONDITION = "mw-dist";
if (usesDefaultParser && !process.execArgv.includes(`--conditions=${DIST_CONDITION}`)) {
  const { spawnSync } = await import("node:child_process");
  const rerun = spawnSync(
    process.execPath,
    [`--conditions=${DIST_CONDITION}`, ...process.argv.slice(1)],
    { stdio: "inherit", env: process.env, cwd: process.cwd() },
  );
  process.exit(rerun.status ?? 1);
}
// dist 陈旧自检：默认产物比 parser/core 任一 src 文件旧即提醒。选择脚本自检而非仅改文档的
// 理由：文档提醒只护「读过文档的人」，脚本自护所有入口（CI/钩子/肌肉记忆直跑）——
// 陈旧 dist 回放会产出「旧分布」假快照，这是贡献链路里最隐蔽的坑。--parser 显式
// 指定时不检查（调用方自带产物责任）；自检自身失败（权限等）不阻断回放。
if (usesDefaultParser) {
  const repoRoot = new URL("..", import.meta.url).pathname;
  const srcRoots = ["packages/parser/src", "packages/core/src"];
  let newest = 0;
  let newestFile = "";
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith(".ts") && statSync(full).mtimeMs > newest) {
        newest = statSync(full).mtimeMs;
        newestFile = full;
      }
    }
  };
  try {
    const distMtime = statSync(parserModule).mtimeMs;
    for (const root of srcRoots) walk(join(repoRoot, root));
    if (newest > distMtime) {
      console.warn(
        `⚠ parser dist 可能陈旧：${newestFile} 比产物新（src mtime 晚于 dist）——` +
          "回放的是旧分布，先 `pnpm build` 再生成/对比快照，避免产出「旧分布」假快照。",
      );
    }
  } catch {
    /* 自检失败（如文件不可读）不阻断回放 */
  }
}

const { parse } = await import(pathToFileURL(parserModule).href);

/** 读取一个语料文件 → 原始报文数组（含重复；.txt 保序，.json 按行序） */
function readCorpus(file) {
  const text = readFileSync(file, "utf8");
  if (file.endsWith(".jsonl")) {
    const rows = [];
    for (const line of text.split("\n")) {
      if (line.trim() === "") continue;
      const obj = JSON.parse(line);
      rows.push(obj);
    }
    return rows.map((o) => o.raw).filter((r) => typeof r === "string");
  }
  if (file.endsWith(".json")) {
    const body = JSON.parse(text);
    const rows = Array.isArray(body) ? body : body.data;
    if (!Array.isArray(rows)) throw new Error(`${file}: 非 IEM currents 形状（需要 data 数组）`);
    return rows.map((o) => o.raw).filter((r) => typeof r === "string");
  }
  // .txt：跳过空行与 tgftp 时间戳行
  return text
    .split("\n")
    .map((l) => l.replace(/\r$/, "").trim())
    .filter((l) => l !== "" && !/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/.test(l));
}

/** 形态归并：数字串折叠为等长 #（I1001 → I####、QFE749/750 → QFE###）——
 *  与 packages/parser/src/corpus.test.ts 的同名函数保持同构（漂移会被快照测试拦截） */
export const shapeOf = (token) => token.replace(/\d+/g, (d) => "#".repeat(d.length));

/** 失败归类（与 corpus.test.ts 同构）：按 MetarParseError.code 机读码归类（不匹配中文 message——错误面已机读化）；
 *  可解释类 = 站名/时组缺失（整体失败契约） */
export const classifyFailure = (err) => {
  const code = err !== null && typeof err === "object" ? err.code : undefined;
  if (code === "missing-station") return "站名";
  if (code === "missing-time" || code === "invalid-time") return "时组";
  return "其他";
};

/** @type {{ generatedAt: string, files: Record<string, { lines: number }>, total: { lines: number, unique: number },
 *    failures: { total: number, classes: Record<string, number>, samples: string[] },
 *    unknownShapes: Record<string, { count: number, samples: string[] }>,
 *    warningCodes: Record<string, number>, rmkHealth: { trendRawsWithRMK: number, remarksNonEmpty: number } }} */
const stats = {
  generatedAt: new Date().toISOString(),
  files: {},
  total: { lines: 0, unique: 0 },
  failures: { total: 0, classes: {}, samples: [] },
  unknownShapes: {},
  warningCodes: {},
  rmkHealth: { trendRawsWithRMK: 0, remarksNonEmpty: 0 },
};

const seen = new Set();
for (const file of files) {
  const rows = readCorpus(file);
  stats.files[file] = { lines: rows.length };
  stats.total.lines += rows.length;
  for (const raw of rows) {
    if (seen.has(raw)) continue;
    seen.add(raw);
    stats.total.unique += 1;
    let report;
    try {
      report = parse(raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const cls = classifyFailure(err);
      stats.failures.total += 1;
      stats.failures.classes[cls] = (stats.failures.classes[cls] ?? 0) + 1;
      if (stats.failures.samples.length < 8) stats.failures.samples.push(`${raw}  ⟵  ${message}`);
      continue;
    }
    if (report.remarks.length > 0) stats.rmkHealth.remarksNonEmpty += 1;
    if (report.trends.some((t) => t.raw.includes("RMK"))) stats.rmkHealth.trendRawsWithRMK += 1;
    for (const w of report.warnings) {
      stats.warningCodes[w.code] = (stats.warningCodes[w.code] ?? 0) + 1;
      if (w.code === "unknown-token") {
        const token = raw.slice(w.span.start, w.span.end);
        const shape = shapeOf(token);
        const entry = stats.unknownShapes[shape] ?? { count: 0, samples: [] };
        entry.count += 1;
        if (entry.samples.length < 3 && !entry.samples.includes(token)) entry.samples.push(token);
        stats.unknownShapes[shape] = entry;
      }
    }
  }
}

// —— 人类可读摘要
const top = (obj, n) =>
  Object.entries(obj)
    .toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n);
console.log(
  `语料回放：${files.length} 个文件 · ${stats.total.lines} 行 · ${stats.total.unique} 条唯一报文`,
);
console.log(`整体失败：${stats.failures.total}（按类：${JSON.stringify(stats.failures.classes)}）`);
console.log(
  `RMK 健康：remarks 非空 ${stats.rmkHealth.remarksNonEmpty} · 趋势吞 RMK 签名 ${stats.rmkHealth.trendRawsWithRMK}（应恒为 0）`,
);
console.log(`告警码分布：${JSON.stringify(stats.warningCodes)}`);
console.log(`unknown 形态（${Object.keys(stats.unknownShapes).length} 种，top 25）：`);
for (const [shape] of top(
  Object.fromEntries(Object.entries(stats.unknownShapes).map(([k, v]) => [k, v.count])),
  25,
)) {
  const e = stats.unknownShapes[shape];
  console.log(`  ${String(e.count).padStart(5)}  ${shape}   样例: ${e.samples.join(" / ")}`);
}
if (stats.failures.samples.length > 0) {
  console.log("失败样例：");
  for (const s of stats.failures.samples) console.log(`  ${s}`);
}

// —— 基线对比：新增 unknown 形态逐条列出（退出码 1）
if (baselinePath !== undefined) {
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const newShapes = Object.keys(stats.unknownShapes).filter((k) => !(k in baseline.unknownShapes));
  const goneShapes = Object.keys(baseline.unknownShapes).filter((k) => !(k in stats.unknownShapes));
  const changed = Object.entries(stats.unknownShapes)
    .filter(
      ([k, v]) =>
        baseline.unknownShapes[k] !== undefined && baseline.unknownShapes[k].count !== v.count,
    )
    .map(([k, v]) => `${k}: ${baseline.unknownShapes[k].count} → ${v.count}`);
  console.log(
    `\n基线对比（${baselinePath}）：新增形态 ${newShapes.length} · 消失 ${goneShapes.length} · 频次变化 ${changed.length}`,
  );
  for (const s of newShapes) {
    const e = stats.unknownShapes[s];
    console.log(`  + ${s}（${e.count} 次）样例: ${e.samples.join(" / ")}`);
  }
  for (const c of changed) console.log(`  ~ ${c}`);
  if (newShapes.length > 0) {
    console.log(
      "\n发现新增 unknown 形态：请解析器显式处理，或重生成快照并在 commit message 说明。",
    );
    process.exit(1);
  }
}

if (jsonOut !== undefined) {
  writeFileSync(jsonOut, `${JSON.stringify(stats, null, 2)}\n`);
  console.log(`\n统计已写出：${jsonOut}`);
}
