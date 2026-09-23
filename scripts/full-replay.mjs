#!/usr/bin/env node
// 全量回放器：把任意规模的本地报文数据逐条过 @metweave/parser，产出逐文件统计与逐报文指纹。
// 与 replay-corpus.mjs 的分工：语料仓小体量看「unknown 形态分布」，本件看「全量逐报文等价」——
// 典型用途是重构/发版前的零漂移对拍：同一份数据跑两份 out JSON，逐文件比对 digest，全部相等
// 即逐报文级零行为变化（2026-09-23 批 0.1 重构即以此法在 803 万行上验证零漂移）。
//
// 用法:
//   node scripts/full-replay.mjs <文件或目录...> --out 结果.json
//   node scripts/full-replay.mjs <...> --out a.json --shard 0/6   # 分片并行（第 i/n 片，按文件序取模）
//   node scripts/full-replay.mjs <...> --out a.json --types METAR,SPECI   # jsonl 记录按 type 字段过滤（缺省同左）
//   node scripts/full-replay.mjs <...> --out a.json --parser ../别处/packages/parser/dist/index.js
//
// 对拍纪律（血的教训，2026-09-23）：
//   1. 抓取中的「活文件」（当月增量 jsonl）两次运行间会被 launchd 追加——对拍前先冻结快照
//      （复制为静态副本），否则行数差会误报为行为漂移；
//   2. dist 陈旧会产出「旧分布」假结果——本件带陈旧自检，但最稳是先 pnpm build；
//   3. 逐报文 digest 是 FNV-1a 53bit 异或累积：判「两份运行是否逐条等价」足够，不是密码学承诺。
//
// 输入格式（按扩展名识别，目录递归展开）:
//   .jsonl 每行一个 JSON 对象：有 type 字段者按 --types 过滤后取 raw；无 type 字段者直接取 raw
//   .json  IEM currents 形状 { data: [{ raw }] } 或同构数组，逐行同上
//   .txt   每行一条原始报文；空行与 tgftp 时间戳行（YYYY/MM/DD HH:MM）跳过
import {
  createReadStream,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import readline from "node:readline";

const args = process.argv.slice(2);
const positional = [];
let out = "";
let shardIdx = 0;
let shardCount = 1;
let types = new Set(["METAR", "SPECI"]);
let parserPath;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--out") out = args[++i];
  else if (a === "--shard") [shardIdx, shardCount] = args[++i].split("/").map(Number);
  else if (a === "--types") types = new Set(args[++i].split(","));
  else if (a === "--parser") parserPath = args[++i];
  else positional.push(a);
}
if (positional.length === 0 || out === "") {
  console.error(
    "用法: node scripts/full-replay.mjs <文件或目录...> --out 结果.json [--shard i/n] [--types ...] [--parser path]",
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

// 解析条件自举（同 replay-corpus.mjs）：core 开发期 exports 默认指 src，裸 node 不解析无扩展名
// 相对导入；按 --conditions=mw-dist 重启自身，保证 parser 与错误类是同一份类实体（instanceof 契约）。
const DIST_CONDITION = "mw-dist";
if (usesDefaultParser && !process.execArgv.includes(`--conditions=${DIST_CONDITION}`)) {
  const { spawnSync } = await import("node:child_process");
  const rerun = spawnSync(
    process.execPath,
    [`--conditions=${DIST_CONDITION}`, ...process.argv.slice(1)],
    {
      stdio: "inherit",
      env: process.env,
      cwd: process.cwd(),
    },
  );
  process.exit(rerun.status ?? 1);
}
// dist 陈旧自检：src 比 dist 新即提醒（假零漂移防线，理由见头部对拍纪律 2）。
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
    if (newest > distMtime)
      console.warn(
        `⚠ parser dist 可能陈旧：${newestFile} 比产物新——先 pnpm build，避免「旧分布」假结果。`,
      );
  } catch {
    /* 自检失败不阻断回放 */
  }
}

const { tryParse } = await import(pathToFileURL(parserModule).href);

// FNV-1a 53bit：判「同一构建两次跑 / 两构建同数据」的确定性对比足够，且远快于 md5（全量场景 800 万级）。
const fnv1a = (s) => {
  let h = 0n;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i) & 0xff);
    h = (h * 0x100000001b3n) & 0x1fffffffffffffn;
  }
  return h;
};

const emptyStats = () => ({
  rows: 0,
  fed: 0,
  ok: 0,
  nil: 0,
  byType: {},
  errCodes: {},
  warnCodes: {},
  digest: "0",
});
const xorIn = (stats, h) => {
  stats.digest = (BigInt(stats.digest) ^ h).toString();
};

function feed(raw, stats) {
  if (typeof raw !== "string") {
    stats.errCodes["__noraw__"] = (stats.errCodes["__noraw__"] ?? 0) + 1;
    return;
  }
  stats.fed++;
  let r;
  try {
    r = tryParse(raw);
  } catch (e) {
    const k = "__throw__:" + (e?.constructor?.name ?? "?");
    stats.errCodes[k] = (stats.errCodes[k] ?? 0) + 1;
    return;
  }
  if (!r.ok) {
    stats.errCodes[r.error.code] = (stats.errCodes[r.error.code] ?? 0) + 1;
    xorIn(stats, fnv1a("E:" + r.error.code + ":" + raw));
    return;
  }
  stats.ok++;
  if (r.report.nil === true) stats.nil++;
  for (const w of r.report.warnings) stats.warnCodes[w.code] = (stats.warnCodes[w.code] ?? 0) + 1;
  xorIn(stats, fnv1a(JSON.stringify(r.report)));
}

async function processJsonl(file, stats) {
  const rl = readline.createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    stats.rows++;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      stats.errCodes["__badjson__"] = (stats.errCodes["__badjson__"] ?? 0) + 1;
      continue;
    }
    const t = rec.type ?? "(none)";
    stats.byType[t] = (stats.byType[t] ?? 0) + 1;
    // type 缺省（无字段）直接喂；type 在白名单喂；其余（含 null 与别的报文类型）只计数不喂
    if (rec.type === undefined || types.has(rec.type)) feed(rec.raw, stats);
  }
}

function processJson(file, stats) {
  const d = JSON.parse(readFileSync(file, "utf8"));
  for (const row of d.data ?? d) {
    stats.rows++;
    const t = row.type ?? "(none)";
    stats.byType[t] = (stats.byType[t] ?? 0) + 1;
    if (row.type === undefined || types.has(row.type)) feed(row.raw, stats);
  }
}

async function processTxt(file, stats) {
  const rl = readline.createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  const tgftpStamp = /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/;
  for await (const line of rl) {
    if (!line.trim() || tgftpStamp.test(line)) continue;
    stats.rows++;
    stats.byType["(txt)"] = (stats.byType["(txt)"] ?? 0) + 1;
    feed(line, stats);
  }
}

const collect = (p) => {
  const st = statSync(p);
  if (st.isFile()) return [p];
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir).sort()) {
      const full = join(dir, e);
      statSync(full).isDirectory() ? walk(full) : out.push(full);
    }
  };
  walk(p);
  return out;
};

const allFiles = positional
  .flatMap(collect)
  .filter((f) => /\.(jsonl|json|txt)$/.test(f))
  .sort();
const mine = allFiles.filter((_, idx) => idx % shardCount === shardIdx);

const perFile = {};
const grand = emptyStats();
const t0 = Date.now();
for (const f of mine) {
  const stats = emptyStats();
  if (f.endsWith(".jsonl")) await processJsonl(f, stats);
  else if (f.endsWith(".json")) processJson(f, stats);
  else await processTxt(f, stats);
  perFile[f] = stats;
  for (const k of ["rows", "fed", "ok", "nil"]) grand[k] += stats[k];
  for (const [t, n] of Object.entries(stats.byType)) grand.byType[t] = (grand.byType[t] ?? 0) + n;
  for (const [c, n] of Object.entries(stats.errCodes))
    grand.errCodes[c] = (grand.errCodes[c] ?? 0) + n;
  for (const [c, n] of Object.entries(stats.warnCodes))
    grand.warnCodes[c] = (grand.warnCodes[c] ?? 0) + n;
}
writeFileSync(
  out,
  JSON.stringify(
    {
      parser: parserModule,
      ms: Date.now() - t0,
      shard: `${shardIdx}/${shardCount}`,
      grand,
      perFile,
    },
    null,
    1,
  ),
);
console.log(
  `done in ${((Date.now() - t0) / 1000).toFixed(1)}s — rows=${grand.rows} fed=${grand.fed} ok=${grand.ok} nil=${grand.nil} errs=${JSON.stringify(grand.errCodes)} -> ${out}`,
);
