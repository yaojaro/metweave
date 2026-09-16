/**
 * 生成 examples/stations.json —— demo 中国 39 站静态元数据（ICAO / 名称 / 经纬度 / 标高米）。
 *
 * 定位：元数据兜底——运行时主通路 IEM currents.json 已带经纬度，本文件服务两个场景：
 * ① 内置样例报文的离线兜底模式（无网络时样例仍可上图）；
 * ② 卡片展示机场全名与标高，免去运行时第二次请求。
 * 数据源：aviationweather.gov METAR API，开发期一次性命令行调用——浏览器运行时零外部请求依赖（该 API 无 CORS，浏览器不可直连）。
 * 名称字段为上游官方写法（如 "Beijing Intl, BJ, CN"）；标高上游即米（ZBAA 31 / ZSPD 4 实测核对）。
 *
 * 用法：pnpm gen:stations
 * 纪律：39/39 缺一或字段不全或坐标越界，一律退出非零，禁止带缺生成。
 */
import { writeFile } from "node:fs/promises";
import process from "node:process";

const ICAOS = [
  // 华北 ZB
  "ZBAA",
  "ZBAD",
  "ZBTJ",
  "ZBSJ",
  "ZBHH",
  "ZBYN",
  // 华东 ZS
  "ZSPD",
  "ZSSS",
  "ZSHC",
  "ZSNJ",
  "ZSNB",
  "ZSQD",
  "ZSAM",
  "ZSFZ",
  "ZSOF",
  // 中南 ZG / ZH / ZJ
  "ZGGG",
  "ZGSZ",
  "ZGOW",
  "ZGKL",
  "ZGNN",
  "ZGHA",
  "ZHCC",
  "ZHEC",
  "ZHHH",
  "ZJHK",
  "ZJSY",
  // 西南 ZU
  "ZUUU",
  "ZUTF",
  "ZUCK",
  "ZUGY",
  "ZPPP",
  // 西北 ZL
  "ZLLL",
  "ZLXY",
  // 新疆 ZW
  "ZWWW",
  "ZWSH",
  // 东北 ZY
  "ZYHB",
  "ZYCC",
  "ZYTL",
  "ZYTX",
];

const API = "https://aviationweather.gov/api/data/metar";
const UA = "metweave-stations-gen/0.1 (yaojaro@metweave.com)";
// 中国粗粒度包围盒（含台站坐标容差），拦截上游明显脏坐标
const BBOX = { latMin: 15, latMax: 55, lonMin: 73, lonMax: 136 };

const response = await fetch(`${API}?ids=${ICAOS.join(",")}&format=json`, {
  headers: { "user-agent": UA },
});
if (!response.ok) {
  console.error(`aviationweather.gov HTTP ${response.status}`);
  process.exit(1);
}

/** @type {Array<{icaoId?: string, name?: string, lat?: number, lon?: number, elev?: number}>} */
const rows = await response.json();

// 同站多行取首行（API 默认每站返回最新一条，此处仅防御性去重）
const byIcao = new Map();
for (const row of rows) {
  const icao = row.icaoId;
  if (typeof icao === "string" && !byIcao.has(icao)) byIcao.set(icao, row);
}

const invalid = ICAOS.filter((icao) => {
  const row = byIcao.get(icao);
  return (
    row === undefined ||
    typeof row.name !== "string" ||
    typeof row.lat !== "number" ||
    typeof row.lon !== "number" ||
    typeof row.elev !== "number"
  );
});
if (invalid.length > 0) {
  console.error(`缺少或字段不全 ${invalid.length} 站：${invalid.join(",")}`);
  process.exit(1);
}

const stations = ICAOS.map((icao) => {
  const row = byIcao.get(icao);
  return { icao, name: row.name, lat: row.lat, lon: row.lon, elevM: row.elev };
});

for (const { icao, lat, lon } of stations) {
  if (lat < BBOX.latMin || lat > BBOX.latMax || lon < BBOX.lonMin || lon > BBOX.lonMax) {
    console.error(`坐标越界：${icao} lat=${lat} lon=${lon}`);
    process.exit(1);
  }
}

const payload = {
  source: "aviationweather.gov/api/data/metar",
  generatedAt: new Date().toISOString(),
  count: stations.length,
  stations,
};

await writeFile(
  new URL("../examples/stations.json", import.meta.url),
  `${JSON.stringify(payload, null, 2)}\n`,
);

// 双写产物之二：伞包子路径 `metweave/stations-cn` 的数据文件（npm 分发面——
// 让「精确站名/坐标联表」开箱即用，不再要求用户去仓库翻 examples/stations.json）。
// 本脚本是该文件唯一写入口（2026-09-16 起）；两份产物同源同批，勿手改任一份。
const dataTs = `/**
 * 由 \\\`pnpm gen:stations\\\` 机械再生——单一来源 = aviationweather.gov/api/data/metar 一次拉取
 * （采集纪律与字段口径见 scripts/generate-stations.mjs）；请勿手改。
 * 生成时刻：${payload.generatedAt}
 */

export interface CnStationRaw {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  elevM: number;
}

export const CN_STATIONS_SOURCE = ${JSON.stringify(payload.source)};

export const CN_STATIONS_GENERATED_AT = ${JSON.stringify(payload.generatedAt)};

export const CN_STATIONS_DATA: readonly CnStationRaw[] = ${JSON.stringify(stations, null, 2)};
`;
await writeFile(new URL("../packages/metweave/src/stations-cn.data.ts", import.meta.url), dataTs);
console.log(
  `已写出 ${stations.length} 站 → examples/stations.json + packages/metweave/src/stations-cn.data.ts`,
);
