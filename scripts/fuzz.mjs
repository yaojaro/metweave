#!/usr/bin/env node
// fuzz 套件（仓内化）：对仓内语料做种子化变异回放，断言十一项不变量——「解析器永不崩、产物契约永不破」。
//
// CLI 用法:
//   pnpm fuzz                                    # 缺省 5 万例（--cases 50000），固定种子（可复现）
//   node scripts/fuzz.mjs --cases 100000         # CI 每夜档
//   node scripts/fuzz.mjs --cases 2000 --seed 42
//   node scripts/fuzz.mjs --parser ../别处/packages/parser/dist/index.js
//
// 结构：变异器与不变量检查器以纯函数导出（runFuzz 注入 parse/toValues/MetarParseError），
// CLI 外壳与 packages/parser/src/fuzz.test.ts 冒烟锁共用同一核心——测试走 src（无需先 build），
// CLI 走 dist（mw-dist 条件自举，与 replay-corpus.mjs 同款）。
//
// 七类变异器（精简版）: delete-token / duplicate-token / swap-tokens / corrupt-chars /
//   fuse-tokens / truncate-tail / structured-invalid（token 可识别但结构坏的定向生成——
//   描述符后置、组内乱序、关键组易位，保证 invalid-format 告警码可达）。
// 十一项不变量: 见 assertInvariants 内逐条注释。
//
// CLI 退出码: 0 = 零违例；1 = 有违例（逐条打印：例号/种子/变异器/输入/断言）；124 = 超时守护触发。
// 依赖: corpus/*.txt（只读语料池）；CLI 需 packages/parser/dist（先 pnpm build）。
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// ---------------------------------------------------------------- 种子化 PRNG（mulberry32：同种子同序列，跨平台可复现）

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- 七类变异器

export const MUTATORS = [
  "delete-token",
  "duplicate-token",
  "swap-tokens",
  "corrupt-chars",
  "fuse-tokens",
  "truncate-tail",
  "structured-invalid",
];

/** token 级 mutate 的公共底座：分词 → 变换 → 重组 */
const tokenize = (s) => s.split(/\s+/).filter(Boolean);

/** 单例变异：rand 显式注入（CLI 与测试共用同一确定性序列） */
export function mutate(rand, text) {
  const kind = MUTATORS[Math.floor(rand() * MUTATORS.length)];
  const toks = tokenize(text);
  if (toks.length === 0) return { kind, text };
  const at = Math.floor(rand() * toks.length);
  switch (kind) {
    case "delete-token":
      toks.splice(at, 1);
      return { kind, text: toks.join(" ") };
    case "duplicate-token":
      toks.splice(at, 0, toks[at]);
      return { kind, text: toks.join(" ") };
    case "swap-tokens": {
      // 语序反转：相邻两 token 交换（组序打乱的主通道）
      const b = Math.min(at + 1, toks.length - 1);
      [toks[at], toks[b]] = [toks[b] ?? "", toks[at] ?? ""];
      return { kind, text: toks.join(" ") };
    }
    case "corrupt-chars": {
      // 字符磨损：数字→斜杠 / 大写字母→O / 随机位插 ? 或 =
      const chars = [...text];
      const i = Math.floor(rand() * chars.length);
      const c = chars[i] ?? " ";
      chars[i] = /\d/.test(c) ? "/" : /[A-Z]/.test(c) ? "O" : c;
      if (rand() < 0.3) chars.splice(i, 0, rand() < 0.5 ? "?" : "=");
      return { kind, text: chars.join("") };
    }
    case "fuse-tokens": {
      // 相邻 token 粘连（丢空格——BECMGTL0350 / RMKQFE749 同族磨损机制）
      const b = Math.min(at + 1, toks.length - 1);
      if (b === at) return { kind, text };
      const fused = (toks[at] ?? "") + (toks[b] ?? "");
      toks.splice(at, 2, fused);
      return { kind, text: toks.join(" ") };
    }
    case "truncate-tail": {
      const cut = 1 + Math.floor(rand() * text.length);
      return { kind, text: text.slice(0, cut) };
    }
    case "structured-invalid": {
      // 定向生成「token 可识别但结构坏」：描述符后置 / 组内乱序 / 关键组易位
      // ——目标：让 invalid-format 告警码在 fuzz 里可达（此前两轮 fuzz 零命中）
      const wxAt = toks.findIndex((t) =>
        /^(TS|SH|FZ|MI|BC|BL|DR|PR)?(RA|SN|DZ|SG|BR|FG)(CB)?$/.test(t),
      );
      if (wxAt !== -1) {
        const t = toks[wxAt];
        const chunks = [t.slice(0, 2), t.slice(2)];
        toks[wxAt] = (chunks[1] ?? "") + (chunks[0] ?? ""); // TSRA → RATS（描述符后置）
        return { kind, text: toks.join(" ") };
      }
      const tempAt = toks.findIndex((t) => /^M?\d{1,2}\/M?\d{1,2}$/.test(t));
      if (tempAt !== -1) {
        const t = toks[tempAt];
        const [l, r] = t.split("/");
        toks[tempAt] = `${r}/${l}`; // 26/22 → 22/26（温露倒挂——cross-check 面）
        return { kind, text: toks.join(" ") };
      }
      const rwyAt = toks.findIndex((t) => /^R\d{2}[RLC]?\//.test(t));
      if (rwyAt !== -1) {
        const t = toks[rwyAt];
        const slash = t.indexOf("/");
        toks[rwyAt] = `${t.slice(slash + 1)}/${t.slice(0, slash)}`; // R07R/1800 → 1800/R07R
        return { kind, text: toks.join(" ") };
      }
      const cavokAt = toks.indexOf("CAVOK");
      if (cavokAt > 2) {
        toks.splice(cavokAt, 1);
        toks.splice(1, 0, "CAVOK"); // CAVOK 易位到风组之前（前序让位判据面）
        return { kind, text: toks.join(" ") };
      }
      const windAt = toks.findIndex((t) => /^\d{3}\d{2,3}(G\d{2,3})?(KT|MPS|KMH)$/.test(t));
      if (windAt !== -1) {
        const t = toks[windAt];
        const m = /^(\d{3})(\d{2,3})(.*)$/.exec(t);
        if (m !== null) toks[windAt] = (m[2] ?? "") + (m[1] ?? "") + (m[3] ?? ""); // 31015KT → 15310KT
        return { kind, text: toks.join(" ") };
      }
      return { kind, text };
    }
    default:
      return { kind, text };
  }
}

// ---------------------------------------------------------------- 十一项不变量断言

const WARNING_CODES = new Set([
  "unknown-token",
  "invalid-format",
  "value-out-of-range",
  "missing-expected",
  "duplicate-group", // 2026-09-15 五角色评测批：重复组专用码（从 cross-check-conflict 分流）
  "cross-check-conflict",
]);
const SEVERITIES = new Set(["info", "warning", "error"]);

/** 剥 span/cavokSpan 的结构副本（紧凑/全模式值语义比对用） */
const stripSpans = (node) => {
  if (Array.isArray(node)) return node.map(stripSpans);
  if (node !== null && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "span" || k === "cavokSpan") continue;
      out[k] = stripSpans(v);
    }
    return out;
  }
  return node;
};

/** 十一项不变量（成功产物面；整体失败契约由调用方的 instanceof 判据守门） */
export function assertInvariants(parse, toValues, input, report) {
  const v = [];
  // 1) 整体失败只允许 MetarParseError（调用方处理 throw；这里只查成功产物的契约）
  // 2) raw 保真：产物原文与输入逐字符一致
  if (report.raw !== input) v.push(`raw 不保真: ${JSON.stringify(report.raw.slice(0, 80))}`);
  // 3) 全部告警 span 落在 [0, raw.length] 且 start ≤ end
  for (const w of report.warnings) {
    if (w.span !== undefined) {
      const { start, end } = w.span;
      if (!(start >= 0 && end <= report.raw.length && start <= end))
        v.push(`告警 span 越界 [${start},${end}) / len ${report.raw.length} (${w.code})`);
    }
  }
  // 4) 告警 code/severity 属枚举（稳定契约面）
  for (const w of report.warnings) {
    if (!WARNING_CODES.has(w.code)) v.push(`未知告警码 ${w.code}`);
    if (!SEVERITIES.has(w.severity)) v.push(`未知严重度 ${w.severity}`);
  }
  // 5) cavokSpan 指向原文 CAVOK 词；CAVOK 前的真值组让位（span 相对判据——CAVOK 之后
  //    再现的组属另一回事，不作违约）
  if (report.cavok) {
    const cs = report.cavokSpan;
    if (cs === undefined || report.raw.slice(cs.start, cs.end) !== "CAVOK")
      v.push("cavokSpan 不指向 CAVOK 词");
    const before = (s) => s !== undefined && s.end <= (cs?.start ?? 0);
    if (report.visibility?.kind === "value" && before(report.visibility.span))
      v.push("CAVOK 前能见度未让位");
    if (report.weather?.kind === "value" && before(report.weather.span))
      v.push("CAVOK 前天气组未让位");
    for (const layer of report.clouds?.elements ?? [])
      if (before(layer.span)) v.push("CAVOK 前云层未让位");
  }
  // 6) 站名 4 字符、时组数值在域内（整体失败契约的补面）
  if (!/^[A-Z0-9]{4}$/.test(report.station)) v.push(`站名形态坏: ${report.station}`);
  const { day, hour, minute } = report.time;
  if (!(day >= 1 && day <= 31 && hour <= 23 && minute <= 59))
    v.push(`时组越界: ${day}/${hour}/${minute}`);
  // 7) 紧凑模式零 span 泄露（JSON 面不含 "span"/"cavokSpan"）
  const compact = parse(input, { spans: false });
  const compactJson = JSON.stringify(compact);
  if (compactJson.includes('"span"') || compactJson.includes('"cavokSpan"'))
    v.push("紧凑模式 span 泄露");
  // 8) 紧凑与全模式值语义一致（toValues 剥 span 深相等）
  if (
    JSON.stringify(stripSpans(toValues(compact))) !== JSON.stringify(stripSpans(toValues(report)))
  )
    v.push("紧凑/全模式值语义漂移");
  // 9) 同输入两次解析产物完全一致（确定性——无隐藏随机态）
  if (JSON.stringify(parse(input)) !== JSON.stringify(report)) v.push("两次解析产物不一致");
  // 10) 趋势段不吞 RMK（第二轮复评根因修复的全量回归锁；RMK 粘连形态 2026-09-12 fuzz 实弹命中后扩防）
  for (const t of report.trends) if (/\sRMK/.test(t.raw)) v.push(`趋势段吞 RMK: ${t.raw}`);
  // 11) IR 数值域无非有限值（NaN/Infinity 不许存活）。终结不变量（2026-09-14 实弹 G/// 后新增）：
  //     NaN 恰是断言体系的盲区——JSON.stringify 消 NaN 为 null（紧凑/全模式两态一致）、数值范围门
  //     对 NaN 恒 false，此前十项对 NaN 全绿不构成无缺陷证据
  const nonFinite = (node, path) => {
    if (typeof node === "number") {
      if (!Number.isFinite(node)) v.push(`IR 数值域出现非有限值 ${node} @ ${path}`);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((x, idx) => nonFinite(x, `${path}[${idx}]`));
      return;
    }
    if (node !== null && typeof node === "object") {
      for (const [k, val] of Object.entries(node)) nonFinite(val, path ? `${path}.${k}` : k);
    }
  };
  nonFinite(report, "");
  return v;
}

/**
 * fuzz 核心：注入解析器与语料池跑 N 例，返回违例与告警码普查。
 * 确定性：同 { seed, pool } 同序列（mutberry32 显式注入 rand）。
 */
export function runFuzz({ parse, toValues, MetarParseError, pool, cases, seed }) {
  const rand = mulberry32(seed);
  const startedAt = Date.now();
  const budgetMs = Math.max(60_000, cases * 3) + 15_000; // 超时守护预算（例均 3ms + 常数）
  let violations = 0;
  let parsed = 0;
  let threw = 0;
  let timedOut = false;
  const census = new Map();
  const samples = [];
  for (let n = 0; n < cases; n += 1) {
    if ((n & 0x3ff) === 0x3ff && Date.now() - startedAt > budgetMs) {
      timedOut = true;
      break;
    }
    const base = pool[Math.floor(rand() * pool.length)];
    const { kind, text } = mutate(rand, base);
    let report;
    try {
      report = parse(text);
    } catch (err) {
      if (err instanceof MetarParseError) {
        threw += 1;
        continue; // 整体失败是合法出路（缺站名/时组的变异必然走到这里）
      }
      violations += 1;
      samples.push({
        case: n,
        mutator: kind,
        input: text,
        problem: `非 MetarParseError 异常: ${String(err?.stack ?? err).split("\n")[0]}`,
      });
      continue;
    }
    parsed += 1;
    for (const w of report.warnings) census.set(w.code, (census.get(w.code) ?? 0) + 1);
    for (const problem of assertInvariants(parse, toValues, text, report)) {
      violations += 1;
      if (samples.length < 20) samples.push({ case: n, mutator: kind, input: text, problem });
    }
  }
  return {
    violations,
    parsed,
    threw,
    timedOut,
    census,
    samples,
    elapsedMs: Date.now() - startedAt,
  };
}

// ---------------------------------------------------------------- CLI 外壳（node scripts/fuzz.mjs 直跑时才生效；被 import 时跳过）

const invokedAsCli =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsCli) {
  const args = process.argv.slice(2);
  const num = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    if (i === -1) return fallback;
    const v = Number.parseInt(args[i + 1] ?? "", 10);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  const CASES = num("cases", 50_000);
  const SEED = num("seed", 20260912);
  const PARSER_IDX = args.indexOf("--parser");
  const usesDefaultParser = PARSER_IDX === -1;
  const PARSER = usesDefaultParser
    ? join(import.meta.dirname, "..", "packages/parser/dist/index.js")
    : args[PARSER_IDX + 1];

  if (!existsSync(PARSER)) {
    console.error(
      `fuzz: 找不到 parser 产物（${PARSER}）——先 pnpm build，或用 --parser 指定 dist/index.js`,
    );
    process.exit(2);
  }

  // 解析条件自举（与 replay-corpus.mjs 同款）：parser dist 运行时 import @metweave/core，
  // 开发期 core exports 默认指向 src（裸 node 不解析无扩展名相对导入）。按 --conditions=mw-dist
  // 重启自身，保证解析器与错误类是同一份类实体（instanceof 契约——不变量 1 依赖它）。
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

  // 语料池：真实报文做变异基底（与 corpus.test.ts 同款读取口径）
  const corpusDir = join(import.meta.dirname, "..", "corpus");
  const pool = [];
  for (const f of readdirSync(corpusDir).filter((x) => x.endsWith(".txt"))) {
    for (const line of readFileSync(join(corpusDir, f), "utf8").split("\n")) {
      const t = line.replace(/\r$/, "").trim();
      if (t !== "" && !/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/.test(t)) pool.push(t);
    }
  }
  if (pool.length === 0) {
    console.error("fuzz: corpus/*.txt 为空——先放语料");
    process.exit(2);
  }

  const { parse } = await import(pathToFileURL(PARSER));
  // MetarParseError 与 toValues 自 core dist 取：错误类实体必须与 parser dist 内部用例同一份
  //（不变量 1 的 instanceof 判据），mw-dist 自举 + 文件 URL 直引保证同一模块实例；
  // toValues 为纯函数（值语义投影，无实体同一性要求）
  const { MetarParseError, toValues } = await import(
    pathToFileURL(join(import.meta.dirname, "..", "packages/core/dist/index.js"))
  );

  const result = runFuzz({ parse, toValues, MetarParseError, pool, cases: CASES, seed: SEED });
  for (const s of result.samples)
    console.error(`[违例] 例 ${s.case} · 变异 ${s.mutator} · ${s.problem}\n  ${s.input}`);
  if (result.timedOut) {
    console.error(`fuzz: 超时守护触发（预算耗尽）——疑似退化或挂死`);
    process.exit(124);
  }
  console.log(
    `fuzz 完成: ${CASES} 例（解析成功 ${result.parsed} · 整体失败 ${result.threw}）· 种子 ${SEED} · ${(result.elapsedMs / 1000).toFixed(1)}s · 违例 ${result.violations}`,
  );
  console.log(
    "告警码普查:",
    [...result.census.entries()]
      .toSorted((a, b) => b[1] - a[1])
      .map(([k, c]) => `${k}=${c}`)
      .join(" "),
  );
  if (result.violations > 0) {
    console.error("fuzz: 存在违约——用同 --seed 复现，逐条修复后重跑");
    process.exit(1);
  }
}
