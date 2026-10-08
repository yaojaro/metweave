#!/usr/bin/env node
/**
 * gen-grid —— GFS 格点取数 CLI（viz-ready 管道的用户本地入口）。
 *
 * 用法：
 *   pnpm gen:grid                        默认集 6 要素（tmp dpt prmsl prate refc wind）
 *   pnpm gen:grid --element tmp          单要素
 *   pnpm gen:grid --element tmp,cape     多要素
 *   pnpm gen:grid --all                  全 14 要素
 *   pnpm gen:grid --cycle 2026100606     显式指定 cycle（默认自动找最近可用，最多回溯 4 档 ×6h）
 *   pnpm gen:grid --fhour 24             预报时效 f024（0–120 整数——GFS 0.25° 逐小时区）
 *   pnpm gen:grid --fhour auto           时效＝离当前时刻最近（cycle 定出后按龄取整，0–120 收敛）
 *   pnpm gen:grid --out-dir <dir>        中国域产物目录（默认 examples/data/grid/）
 *
 * 时效与产物名：f000 沿用 <el>_cn.mwgrid（冻结基线/demo 既有链路兼容）；f>0 产物名
 * 插段 <el>_fHHH_cn.mwgrid（如 tmp_f024_cn.mwgrid——HHH 三位零填）。缺省 --fhour 0
 * （批产工作流语义不变）；「离现在最近」的 auto 由面板「拉最新」显式请求。
 *
 * 产物：
 *   中国域 .mwgrid（55–15N、70–140E 半开窗）→ out-dir（demo 直吃）
 *   全球场 .mwgrid → $METWEAVE_DATA_DIR/grid/latest/（数据区；未设则跳过并提示）
 *
 * 取数参数为五轮实测定案（docs/10 十四节）：并发 ≤2、失败指数退避重试 ×3、
 * 单请求超时 75s、逐要素进度输出。NOMADS 随机甩连接是常态、重试即愈、非封禁。
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

// 走 dist 直引（full-replay.mjs 同款）：包名 import 在根 scripts/ 无解析链，且 dist 为发布同源产物
const distEntry = new URL("../packages/grid/dist/convert.js", import.meta.url);
// dist 前置检查：未构建即跑 CLI 只会炸出难读的 ERR_MODULE_NOT_FOUND——就地给可行动提示
if (!existsSync(distEntry)) {
  console.error(
    "packages/grid/dist/convert.js 不存在——请先 `pnpm build` 再运行 gen:grid（CLI 消费发布同源的 dist 产物）",
  );
  process.exit(2);
}
const { decodeGrib2, fieldToGrid, cropGrid, serializeGrid, CN_WINDOW } = await import(
  distEntry.href
);

const DEFAULT_SET = ["tmp", "dpt", "prmsl", "prate", "refc", "wind"];
/** 14 要素请求表（NOMADS filter 参数号与 docs/10 十四节要素矩阵一致；wind 双分量单请求）。 */
const ELEMENTS = {
  tmp: {
    vars: "var_TMP=on",
    lev: "lev_2_m_above_ground=on",
    label: "TMP/2m",
    variable: "TMP",
    level: "2m",
    unit: "K",
  },
  dpt: {
    vars: "var_DPT=on",
    lev: "lev_2_m_above_ground=on",
    label: "DPT/2m",
    variable: "DPT",
    level: "2m",
    unit: "K",
  },
  rh: {
    vars: "var_RH=on",
    lev: "lev_2_m_above_ground=on",
    label: "RH/2m",
    variable: "RH",
    level: "2m",
    unit: "%",
  },
  prate: {
    vars: "var_PRATE=on",
    lev: "lev_surface=on",
    label: "PRATE/sfc",
    variable: "PRATE",
    level: "sfc",
    unit: "kg m-2 s-1",
  },
  gust: {
    vars: "var_GUST=on",
    lev: "lev_surface=on",
    label: "GUST/sfc",
    variable: "GUST",
    level: "sfc",
    unit: "m s-1",
  },
  pres: {
    vars: "var_PRES=on",
    lev: "lev_surface=on",
    label: "PRES/sfc",
    variable: "PRES",
    level: "sfc",
    unit: "Pa",
  },
  prmsl: {
    vars: "var_PRMSL=on",
    lev: "lev_mean_sea_level=on",
    label: "PRMSL/MSL",
    variable: "PRMSL",
    level: "msl",
    unit: "Pa",
  },
  gh: {
    vars: "var_HGT=on",
    lev: "lev_500_mb=on",
    label: "HGT/500mb",
    variable: "HGT",
    level: "500mb",
    unit: "gpm",
  },
  t850: {
    vars: "var_TMP=on",
    lev: "lev_850_mb=on",
    label: "TMP/850mb",
    variable: "TMP",
    level: "850mb",
    unit: "K",
  },
  tcdc: {
    vars: "var_TCDC=on",
    lev: "lev_entire_atmosphere=on",
    label: "TCDC/atm",
    variable: "TCDC",
    level: "atm",
    unit: "%",
  },
  cape: {
    vars: "var_CAPE=on",
    lev: "lev_surface=on",
    label: "CAPE/sfc",
    variable: "CAPE",
    level: "sfc",
    unit: "J kg-1",
  },
  refc: {
    vars: "var_REFC=on",
    lev: "lev_entire_atmosphere=on",
    label: "REFC/atm",
    variable: "REFC",
    level: "atm",
    unit: "dB",
  },
  vis: {
    vars: "var_VIS=on",
    lev: "lev_surface=on",
    label: "VIS/sfc",
    variable: "VIS",
    level: "sfc",
    unit: "m",
  },
  wind: {
    vars: "var_UGRD=on&var_VGRD=on",
    lev: "lev_10_m_above_ground=on",
    label: "WIND/10m",
    variable: "WIND",
    level: "10m",
    unit: "m s-1",
  },
};

const args = process.argv.slice(2);
/** 带值参数读取：末参无值/紧跟下一选项 → 用法错退出（静默回退默认值＝参数悄悄不生效）。
 *  值本身以 `--` 开头按缺失处理（--element --all 这类笔误同样给用法错）。 */
const val = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const next = args[i + 1];
  if (next === undefined || next.startsWith("--")) {
    console.error(`参数 ${name} 缺值（末参无值或后随另一选项）——用法：${name} <值>`);
    process.exit(2);
  }
  return next;
};

let elements;
if (args.includes("--all")) elements = Object.keys(ELEMENTS);
else if (val("--element")) {
  elements = val("--element")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (elements.length === 0) {
    console.error(`--element "${val("--element")}" 过滤后为空（如只传了逗号）——请至少给一个要素`);
    process.exit(2);
  }
} else elements = DEFAULT_SET;
const unknown = elements.filter((e) => !(e in ELEMENTS));
if (unknown.length) {
  console.error(`未知要素：${unknown.join(", ")}（可用：${Object.keys(ELEMENTS).join(" ")}）`);
  process.exit(2);
}

/** 预报时效：0–120 整数（GFS 0.25° 逐小时区）或 "auto"（cycle 定出后按龄取整）。缺省 0。 */
const FHOUR_ARG = val("--fhour") ?? "0";
const parseFhourArg = (raw) => {
  if (raw === "auto") return { auto: true };
  if (!/^\d{1,3}$/.test(raw)) return { err: `"${raw}"（须为 0–120 整数或 auto）` };
  const n = Number(raw);
  if (n > 120) return { err: `${n} 超出逐小时区（0–120；f123 起为 3 小时隔）` };
  return { fhour: n };
};
const fhourParsed = parseFhourArg(FHOUR_ARG);
if ("err" in fhourParsed) {
  console.error(`--fhour 参数非法：${fhourParsed.err}`);
  process.exit(2);
}

const outDir =
  val("--out-dir") ??
  join(dirname(fileURLToPath(import.meta.url)), "..", "examples", "data", "grid");
const dataDir = process.env.METWEAVE_DATA_DIR ?? "";

/** --cycle 值格式校验：本脚本的 cycle 形态恒为 YYYYMMDDHH 十位数字（candidateCycles 的
 *  fmt 出口，urlOf/autoFhourOf 逐段直切），其余写法（如 06z 简写）会在切片时静默产出错 URL。 */
const CYCLE_ARG = val("--cycle");
if (CYCLE_ARG !== undefined && !/^\d{10}$/.test(CYCLE_ARG)) {
  console.error(`--cycle "${CYCLE_ARG}" 格式非法（须 YYYYMMDDHH 十位数字，如 2026100606）`);
  process.exit(2);
}

/** 候选 cycle：当前 UTC 的 6h 整档起回退 1–4 档（最新整档不保证 ≥4h 龄，首档即回退一档）。 */
const candidateCycles = () => {
  const now = new Date();
  const floor6 = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    Math.floor(now.getUTCHours() / 6) * 6,
  );
  return Array.from({ length: 4 }, (_, i) => new Date(floor6 - (i + 1) * 6 * 3600_000));
};
const fmt = (d) =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}${String(d.getUTCHours()).padStart(2, "0")}`;
const pad3 = (n) => String(n).padStart(3, "0");
const urlOf = (cycle, el, fhour) => {
  const ymd = cycle.slice(0, 8),
    hh = cycle.slice(8, 10),
    spec = ELEMENTS[el];
  return `https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?file=gfs.t${hh}z.pgrb2.0p25.f${pad3(fhour)}&${spec.lev}&${spec.vars}&dir=%2Fgfs.${ymd}%2F${hh}%2Fatmos`;
};

const fetchWithRetry = async (url, label) => {
  // UA 同 gen-iwxxm.mjs 口径（含仓库名）：NOMADS 侧无 UA 的匿名请求在部分网关被当机器人拒
  const UA = "metweave-grid-gen/0.3 (github.com/yaojaro/metweave)";
  for (let attempt = 1; attempt <= 4; attempt++) {
    const t0 = Date.now();
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- 单次尝试内的顺序步骤，非循环并发语义
      const res = await fetch(url, {
        signal: AbortSignal.timeout(75_000),
        headers: { "User-Agent": UA },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // oxlint-disable-next-line eslint/no-await-in-loop -- 同上（响应体读取）
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length < 1000) throw new Error(`空文件 ${buf.length}B`);
      return { buf, ms: Date.now() - t0 };
    } catch (e) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- 重试退避语义本就是顺序的
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt === 4)
        throw new Error(`${label} 下载失败（重试 3 次后放弃）：${msg}`, { cause: e });
      const wait = 1000 * 2 ** (attempt - 1);
      console.log(`  ${label} 第 ${attempt} 次失败（${msg}），${wait / 1000}s 后重试`);
      // oxlint-disable-next-line eslint/no-await-in-loop -- 退避等待，顺序语义
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error("unreachable");
};

const convertElement = (el, buf, cycle, fhour) => {
  const spec = ELEMENTS[el];
  const fields = decodeGrib2(buf);
  const tag = fhour > 0 ? `_f${pad3(fhour)}` : ""; // f000 沿用旧名（基线/demo 链路兼容）
  // 场数与参数号断言：wind 恰 2 场（UGRD 参数号 2＋VGRD 参数号 3），其余要素恰 1 场——
  // NOMADS filter 应答异常（缺场/多场/参数号不符）即报错失败该要素，不再单场冒充合成场
  // 或多场覆盖写（suffix 按参数号指派，与报文顺序解耦）
  const entries = [];
  if (el === "wind") {
    const numbers = fields.map((f) => f.number);
    if (
      fields.length !== 2 ||
      !numbers.includes(2) ||
      !numbers.includes(3) ||
      numbers[0] === numbers[1]
    ) {
      throw new Error(
        `wind 应恰为 2 场（UGRD 参数号 2＋VGRD 参数号 3），实得 ${fields.length} 场（参数号 ${numbers.join("/")}）——filter 应答异常，该要素放弃`,
      );
    }
    const u = fields.find((f) => f.number === 2);
    const v = fields.find((f) => f.number === 3);
    entries.push({ f: u, suffix: "u", variable: "UGRD" });
    entries.push({ f: v, suffix: "v", variable: "VGRD" });
  } else {
    if (fields.length !== 1) {
      throw new Error(
        `${el} 应恰为 1 场，实得 ${fields.length} 场（参数号 ${fields.map((f) => f.number).join("/")}）——filter 应答异常，该要素放弃`,
      );
    }
    const first = fields[0];
    if (first === undefined) throw new Error(`${el} 场解出为空——filter 应答异常，该要素放弃`);
    entries.push({ f: first, suffix: "", variable: spec.variable });
  }
  const written = [];
  for (const { f, suffix, variable } of entries) {
    const grid = fieldToGrid(f, {
      variable,
      level: spec.level,
      unit: spec.unit,
      meta: {
        source: `GFS 0.25° f${pad3(fhour)} cycle ${cycle} via NOMADS filter_gfs_0p25`,
        license: "U.S. Government public domain",
      },
    });
    const cn = cropGrid(grid, CN_WINDOW);
    const cnBlob = serializeGrid(cn.header, cn.values);
    writeFileSync(join(outDir, `${el}${suffix}${tag}_cn.mwgrid`), cnBlob);
    if (dataDir)
      writeFileSync(
        join(dataDir, "grid", "latest", `${el}${suffix}${tag}_globe.mwgrid`),
        serializeGrid(grid.header, grid.values),
      );
    written.push(`${el}${suffix}${tag}_cn.mwgrid ${Math.round(cnBlob.length / 1024)}KB`);
  }
  return written;
};

/** auto 时效：cycle 龄取整收敛到 [0,120]（离当前时刻最近的逐小时档）。 */
const autoFhourOf = (cycle) => {
  const cycleMs = Date.UTC(
    Number(cycle.slice(0, 4)),
    Number(cycle.slice(4, 6)) - 1,
    Number(cycle.slice(6, 8)),
    Number(cycle.slice(8, 10)),
  );
  const ageH = (Date.now() - cycleMs) / 3600_000;
  return Math.max(0, Math.min(120, Math.round(ageH)));
};

const run = async () => {
  const cycles = CYCLE_ARG ? [CYCLE_ARG] : candidateCycles().map(fmt);
  // cycle 探测：下载首要素真实数据，失败即换下一档。auto 档未知前以 f000 探测（cycle
  // 可用性与时效档同源 staging，f000 在位即该 run 已上 NOMADS），定档后首要素按需重取
  const probeFhour =
    "fhour" in fhourParsed && fhourParsed.fhour !== undefined ? fhourParsed.fhour : 0;
  let cycle = null,
    firstBuf = null;
  for (const c of cycles) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- cycle 逐档探测，后档依赖前档失败
      const { buf } = await fetchWithRetry(
        urlOf(c, elements[0], probeFhour),
        `cycle ${c} 探测(${elements[0]} f${pad3(probeFhour)})`,
      );
      cycle = c;
      firstBuf = buf;
      break;
    } catch (e) {
      console.log(`cycle ${c} 不可用：${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (!cycle) {
    console.error("4 档候选 cycle 均不可用（NOMADS 服务异常？稍后再试或 --cycle 显式指定）");
    process.exit(1);
  }
  const fhour = "auto" in fhourParsed ? autoFhourOf(cycle) : (fhourParsed.fhour ?? 0);
  // 探测缓存只在同档时可复用（auto 且定档 ≠0 时首要素按定档重取）
  const probeBufReusable = probeFhour === fhour ? firstBuf : null;
  console.log(`FHOUR ${pad3(fhour)}`);
  console.log(`cycle=${cycle} fhour=${fhour} 要素 ${elements.length} 个 → ${outDir}`);
  mkdirSync(outDir, { recursive: true });
  if (dataDir) mkdirSync(join(dataDir, "grid", "latest"), { recursive: true });
  else console.log("（未设 METWEAVE_DATA_DIR，全球场不落盘）");

  const queue = [...elements];
  const cache = probeBufReusable === null ? {} : { [elements[0]]: probeBufReusable };
  let done = 0;
  const failed = [];
  const worker = async () => {
    while (queue.length > 0) {
      const el = queue.shift();
      const t0 = Date.now();
      try {
        // oxlint-disable-next-line eslint/no-await-in-loop -- 并发 ≤2 的队列消费（worker ×2 已并行）
        const buf = cache[el] ?? (await fetchWithRetry(urlOf(cycle, el, fhour), el)).buf;
        const written = convertElement(el, buf, cycle, fhour);
        done++;
        console.log(
          `[${done}/${elements.length}] ${el.padEnd(6)} ${ELEMENTS[el].label.padEnd(15)} ${((Date.now() - t0) / 1000).toFixed(1)}s → ${written.join(" + ")}`,
        );
      } catch (e) {
        failed.push(el);
        console.error(`✗ ${el}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, elements.length) }, worker));
  if (failed.length) {
    console.error(`完成 ${done}，失败 ${failed.length}：${failed.join(", ")}`);
    process.exit(1);
  }
  console.log(`全部完成：${done}/${elements.length}`);
};

await run();
