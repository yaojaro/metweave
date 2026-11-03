/**
 * 生成 examples/zspd-rose-data.json —— 验收台统计面板的数据（上海浦东 2024 全年逐时
 * 风观测的构建期派生 JSON，页面运行时零网络）。
 *
 * 数据源：IEM（Iowa Environmental Mesonet）ASOS 全球逐时存档——公有领域逐时观测
 * （station=ZSPD、2024 全年、UTC）。原始 CSV 不进仓（体积与授权外链考虑），本脚本
 * 从 CSV 派生紧凑 JSON 入库：逐月的风向/风速样本对（构建期已按组件口径容忍缺测——
 * "M"/空串/非数 → null）＋按同一口径实算的账目期望值（样本/静风/缺向/缺速/入扇区）。
 * 页面把样本喂给 windRose / windDirFrequency，期望值用于验收断言——组件输出与
 * 构建期实算不一致即页面判红。
 *
 * 账目口径（与 @metweave/render 的 windRose 统计单源一致，四桶恰一次划分）：
 *   缺速（speed 缺测）→ 静风（speed < 1 kt）→ 缺向（direction 缺测而风速可读）→ 入扇区。
 *   drct 为来向 0–360、sknt 已是 kt（IEM 口径），均不做换算。
 *
 * 用法：pnpm gen:zspd-rose [--csv=<iem-zspd-2024.csv 路径>]
 *       CSV 路径缺省读环境变量 ZSPD_CSV；两者皆缺省时显式报错退出（禁止无源生成）。
 */
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const CALM_THRESHOLD_KT = 1; // 静风阈（kt）——与 render windRose 的 kt 缺省档一致

const csvArg = process.argv.find((a) => a.startsWith("--csv="));
const csvPath = csvArg?.slice("--csv=".length) ?? process.env.ZSPD_CSV ?? "";
if (csvPath === "") {
  console.error(
    "缺 CSV 源路径：传 --csv=<iem-zspd-2024.csv> 或设环境变量 ZSPD_CSV（IEM ASOS 逐时存档，公有领域）",
  );
  process.exit(1);
}

const raw = await readFile(csvPath, "utf8");
const lines = raw.split("\n").filter((l) => l.trim() !== "" && !l.startsWith("#"));
const head = lines[0]?.split(",") ?? [];
const iDrct = head.indexOf("drct");
const iSknt = head.indexOf("sknt");
if (iDrct < 0 || iSknt < 0) {
  console.error("CSV 缺 drct/sknt 列——不是 IEM ASOS 逐时存档格式");
  process.exit(1);
}

/** IEM 缺测占位（"M"、空串）→ null；数值列原样解析（kt 不换算、来向不折算）。 */
function parseValue(cell) {
  if (cell === undefined) return null;
  const t = cell.trim();
  if (t === "" || t === "M" || t === "NULL") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** 按组件账目口径实算一份账（四桶恰一次划分）。 */
function account(rows) {
  let calm = 0;
  let missingDirection = 0;
  let missingSpeed = 0;
  for (const [direction, speed] of rows) {
    if (speed === null) missingSpeed += 1;
    else if (speed < CALM_THRESHOLD_KT) calm += 1;
    else if (direction === null) missingDirection += 1;
  }
  const inSector = rows.length - calm - missingDirection - missingSpeed;
  return {
    samples: rows.length,
    calm,
    missingDirection,
    missingSpeed,
    inSector,
  };
}

const byMonth = new Map();
for (const [index, line] of lines.slice(1).entries()) {
  const cells = line.split(",");
  const valid = cells[1] ?? "";
  const month = Number(valid.slice(5, 7));
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    console.error(`第 ${index + 2} 行 valid 列缺月份（${valid}）`);
    process.exit(1);
  }
  const row = [parseValue(cells[iDrct]), parseValue(cells[iSknt])];
  if (!byMonth.has(month)) byMonth.set(month, []);
  byMonth.get(month).push(row);
}

const months = [];
for (let m = 1; m <= 12; m++) {
  const rows = byMonth.get(m) ?? [];
  months.push({ month: m, samples: rows, account: account(rows) });
}

const totals = account(months.flatMap((m) => m.samples));
const payload = {
  station: "ZSPD",
  name: "上海浦东",
  year: 2024,
  source: "IEM（Iowa Environmental Mesonet）ASOS 全球逐时存档（公有领域），2024 全年、UTC",
  calmThresholdKt: CALM_THRESHOLD_KT,
  unit: "kt",
  months,
  expected: {
    totals,
    months: months.map((m) => ({
      month: m.month,
      samples: m.account.samples,
      calm: m.account.calm,
      missingDirection: m.account.missingDirection,
      missingSpeed: m.account.missingSpeed,
      inSector: m.account.inSector,
    })),
  },
};

const outPath = new URL("../examples/zspd-rose-data.json", import.meta.url);
// 落盘走格式化多行（仓内数据 JSON 惯例），序列化与 `oxfmt --write` 产物字节级一致：
// 2 空格缩进逐层展开、键序保持；唯「纯原子数组」整行内联（[310, 5.83]——逗号后带
// 空格），不满足则每元素一行；末尾换行。
/** oxfmt 同款 JSON 序列化（indent 为该值所在层的缩进串）。 */
function fmtJson(value, indent = "") {
  if (value === null) return "null";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.every((v) => v === null || typeof v !== "object")) {
      return `[${value.map((v) => fmtJson(v, indent)).join(", ")}]`; // 空数组亦内联为 []
    }
    const inner = `${indent}  `;
    return `[\n${value.map((v) => `${inner}${fmtJson(v, inner)}`).join(",\n")}\n${indent}]`;
  }
  const keys = Object.keys(value);
  if (keys.length === 0) return "{}";
  const inner = `${indent}  `;
  return `{\n${keys
    .map((k) => `${inner}${JSON.stringify(k)}: ${fmtJson(value[k], inner)}`)
    .join(",\n")}\n${indent}}`;
}
await writeFile(outPath, `${fmtJson(payload)}\n`, "utf8");
console.log(
  `examples/zspd-rose-data.json 已生成：样本 ${totals.samples} · 静风 ${totals.calm} · 缺向 ${totals.missingDirection} · 缺速 ${totals.missingSpeed} · 入扇区 ${totals.inSector}`,
);
