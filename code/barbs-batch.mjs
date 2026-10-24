/**
 * barbs-batch.mjs — 《一根杆与一张场》多站批量取数与出杆（IEM ASOS 四站 13Z 批次）
 *
 * 两步跑：
 *   1) curl 取当日多站观测（IEM 爱荷华州立大学环境 mesonet，一单请求四站）：
 *
 *      curl -o iem.csv "https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py\
 *        ?station=ZUUU,ZBAA,ZGGG,ZSSS&data=all&year1=2026&month1=10&day1=24\
 *        &year2=2026&month2=10&day2=24&tz=UTC&format=comma&latlon=yes\
 *        &missing=M&trace=T&report_type=3"
 *
 *   2) npm i @metweave/parser @metweave/grid   （本脚本比 fetch/rose 多这两个依赖）
 *   3) node barbs-batch.mjs
 *
 * 产出：杆位序列（可直接交给 @metweave/leaflet 的 addWindBarbGlyphs）＋三态统计。
 *
 * 口径要点：
 *   · 换机场：只改 curl 里 station= 参数（ICAO 代码逗号分隔）
 *   · 换批次：改代码里 BATCH 常量（如 "241200Z"）——正文用 13Z
 *   · 静风（speed 0）与 VRB（direction null）都拦在上图之前：前者画光杆、后者画假杆
 *   · report_type=3 是「只取例行 METAR」的过滤器；去掉它 SPECI 会混进「同一时刻」
 *   · IEM 的列序跟着请求参数走——一律按列名取，不数位置（lon 在 lat 前）
 *   · 时间窗：METAR 整点发布、风组是观测前 10 分钟平均——图上标「13Z ±30 min」才诚实
 *
 * ⚠️ 你拉到的数字会和正文印的不一样（正文是 2026-10-24 13Z 时次的快照）。
 *    数值会变，代码不会。
 */
import { readFileSync } from "node:fs";
import { parse } from "@metweave/parser";
import { windBarbOf } from "@metweave/grid";

const BATCH = " 241300Z "; // 取哪个整点批次（前后留空格防误匹配）

const lines = readFileSync("./iem.csv", "utf8")
  .split("\n")
  .filter((l) => l.trim() && !l.startsWith("#")); // IEM 文件头有 #DEBUG 注释行
const head = lines[0].split(",");
const iLat = head.indexOf("lat"),
  iLon = head.indexOf("lon"),
  iRaw = head.indexOf("metar");

const barbs = [];
const tally = { calm: 0, vrb: 0, missing: 0, ok: 0 };

for (const row of lines.slice(1)) {
  const col = row.split(",");
  if (!col[iRaw]?.includes(BATCH)) continue;
  const w = parse(col[iRaw]).wind; // 判别联合：可能整个 undefined
  if (w?.value !== undefined) {
    const { direction, speed } = w.value;
    if (speed.value < 1) tally.calm++; // 静风：00000（编码层 windBarbOf 也返回 null）
    else if (direction === null) tally.vrb++; // VRB：方向不定，画不了杆
    else {
      tally.ok++;
      barbs.push({
        lat: +col[iLat],
        lon: +col[iLon],
        direction,
        speed: speed.value,
        encoding: windBarbOf(direction, speed.value, { unit: speed.unit }),
      });
    }
  } else tally.missing++; // 风组缺测
}

console.log("杆位序列（交给 addWindBarbGlyphs(map, barbs)）：");
for (const b of barbs)
  console.log(
    `  ${b.lat.toFixed(2)}N ${b.lon.toFixed(2)}E  ${String(b.direction).padStart(3)}° ${b.speed} m/s  ` +
      `旗${b.encoding.pennants}/长${b.encoding.longs}/短${b.encoding.shorts}（编码 ${b.encoding.encodedSpeed}）`,
  );
console.log(
  `\n13Z 批次统计：出杆 ${tally.ok}｜静风 ${tally.calm}｜风向不定 ${tally.vrb}｜缺测 ${tally.missing}`,
);
