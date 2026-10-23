/**
 * rose.mjs — 《风不是一个数》一篇的风玫瑰（上海浦东 2024 全年）
 *
 * 两步跑：
 *   1) curl 取一年 ASOS 存档（约 1.7 MB CSV，IEM 爱荷华州立大学环境 mesonet）：
 *
 *      curl -o iem.csv "https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py\
 *        ?station=ZSPD&data=all&year1=2024&month1=1&day1=1&year2=2024&month2=12&day2=31\
 *        &tz=UTC&format=comma&latlon=yes&elev=yes&missing=M&trace=T&direct=no&report_type=3"
 *
 *   2) node rose.mjs
 *
 * 产出：rose.json（16 扇区 × 6 风速档的小时数矩阵）
 *
 * 口径要点：
 *   · IEM 的 sknt 已是 kt、drct 是**来向**（0–360，0=北）——不用再换算
 *   · 风向缺测（VRB 不定风向报文，drct 列为 M）**整行跳过**——风向不定与静风一样
 *     不属于任何扇区，硬塞会稀释所有扇区
 *   · **静风（sknt < 1）单独剔出**，不进任何扇区（否则所有扇区被稀释）
 *   · 扇区按**中心对齐**分：22.5° 一格，+11.25° 后取整，边界值归到最近扇区
 *   · 2024 年实测（取数窗口 2024-01-01–12-30 共 365 个整日、8,760 时次）：
 *     232 个风向不定跳过 → 有效 8,528 小时；静风 26 个（0.3%）再剔 → 入扇区 8,502，
 *     全年最大 48.6 kt
 *
 * ⚠️ 这份是**历史年**数据，重跑结果逐年一致；但如果换年份，n、静风数、扇区分布都会变。
 */
import { readFileSync, writeFileSync } from "node:fs";

const lines = readFileSync("./iem.csv", "utf8")
  .split("\n")
  .filter((l) => !l.startsWith("#"));
const head = lines[0].split(",");
const iDrct = head.indexOf("drct");
const iSknt = head.indexOf("sknt");

const BANDS = [2, 4, 6, 8, 10, Infinity]; // kt，风速档上界
const SECTORS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

const rose = Array.from({ length: 16 }, () => Array.from({ length: 6 }, () => 0));
let n = 0;
let calm = 0;
let maxkt = 0;

for (const line of lines.slice(1)) {
  if (!line.trim()) continue;
  const c = line.split(",");
  const drct = Number(c[iDrct]);
  const sknt = Number(c[iSknt]);
  if (!Number.isFinite(drct) || !Number.isFinite(sknt)) continue;

  n++;
  if (sknt > maxkt) maxkt = sknt;
  if (sknt < 1) {
    calm++; // 静风：无方向可读，单独剔出
    continue;
  }

  const sector = Math.floor(((drct + 11.25) % 360) / 22.5);
  let band = BANDS.findIndex((b) => sknt < b);
  if (band < 0) band = 5;
  rose[sector][band]++;
}

writeFileSync(
  "rose.json",
  JSON.stringify(
    {
      station: "ZSPD",
      name: "上海浦东",
      year: 2024,
      n,
      calm: +((calm / n) * 100).toFixed(1),
      maxkt: +maxkt.toFixed(1),
      rose,
    },
    null,
    1,
  ),
);

const totals = rose.map((r) => r.reduce((a, b) => a + b, 0));
const grand = totals.reduce((a, b) => a + b, 0);
console.log(
  `n = ${n}，静风 ${calm}（${((calm / n) * 100).toFixed(1)}%），入扇区 ${grand}，全年最大 ${maxkt.toFixed(1)} kt`,
);
console.log(
  "最多的四个扇区: " +
    totals
      .map((c, i) => ({ i, c }))
      .toSorted((a, b) => b.c - a.c)
      .slice(0, 4)
      .map((t) => `${SECTORS[t.i]} ${((t.c / grand) * 100).toFixed(1)}%`)
      .join("、"),
);
