/**
 * 生成 examples/iwxxm-data.json —— IWXXM 演示页数据（AWC 实时流报文 + 站点坐标 + 内嵌源 TAC）。
 *
 * 数据链兜底（按序降级，产物 payload 如实记录各层取数事实）：
 * ① AWC 实时流（首选）：aviationweather.gov 免鉴权端点 `?ids=<站单>&format=iwxxm`——
 *    IWXXM 2025-2（2025-2RC1 schema），单请求批量取站（并发 1 ≤ 2 门限）、重试 ×3、超时 60s；
 *    ids=all 不支持 iwxxm 格式（返回空），必须站单列表；端点无 CORS 头（浏览器不可直连，Node 侧取数）；
 *    多站响应为 WMO collect 2014 包裹，按站拆分；站坐标取报文 ARP gml:pos（AWC 输出为经度在前，
 *    与 2023-1 官方对的纬度在前相反——此处统一换序并做范围校验）；源 TAC 取报文内嵌注释；
 *    成功则逐站标注 fetchSource=awc-live；
 * ② 仓内语料副本：corpus/iwxxm/metar-pairs/（wmo-im/iwxxm-translation Amd79-80-2023 官方等价对
 *    34 站的入库副本，2023-1），逐站标注 fetchSource=corpus-local；
 * ③ 全部失败 → 非零退出（禁止带缺生成）。
 * 附：ECCC 真实流探测（dd.weather.gc.ca，现仅 TAF 无 METAR——探测结果记录在 payload.ecccProbe，
 * 上线 METAR IWXXM 后可再评估接入）。
 *
 * 用法：pnpm gen:iwxxm [--ids=KSEA,ZSPD,…]（站单可用 --ids 或环境变量 GEN_IWXXM_IDS 覆盖；
 *       缺省一批全球代表站 30 个）
 * 纪律：站数 ≥20、坐标可解析，缺一即退出非零。
 */
import { readFile, writeFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import process from "node:process";

const AWC_ENDPOINT = "https://aviationweather.gov/api/data/metar";
/** 缺省站单：全球代表 30 站（美国大机场 15 + 中国 4 + 亚洲 5 + 欧洲 6）。 */
const DEFAULT_IDS =
  "KSEA,KATL,KORD,KDEN,KLAX,KSFO,KJFK,KIAH,KDTW,KMIA,KSLC,KPHX,KSDF,KANC,KPDX," +
  "ZSPD,ZBAA,ZGGG,ZUUU," +
  "RJTT,RJAA,VIDP,WSSS,VHHH," +
  "EFHK,EGLL,LFPG,EDDF,EHAM,BIAR";
const ECCC_IWXXM_INDEX = "https://dd.weather.gc.ca/today/aviation/iwxxm/";
const UA = "metweave-iwxxm-gen/0.3 (yaojaro@metweave.com)";
const RETRIES = 3;
const TIMEOUT_MS = 60_000;
const MIN_STATIONS = 20;

/** 站单参数化：--ids= 优先，其次 GEN_IWXXM_IDS，缺省全球代表站。 */
const idsArg = process.argv.find((a) => a.startsWith("--ids="));
const stationIds = (idsArg?.slice("--ids=".length) ?? process.env.GEN_IWXXM_IDS ?? DEFAULT_IDS)
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter((s) => /^[A-Z0-9]{3,4}$/.test(s));
if (stationIds.length === 0) {
  console.error("站单为空（--ids 或 GEN_IWXXM_IDS 至少一站）");
  process.exit(1);
}

/** fetch 包装：超时 + 重试（网络抖动容错；顺序重试，无并发——远低于并发 ≤2 门限）。 */
async function fetchWithRetry(url) {
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- 重试语义本就是顺序的
      const response = await fetch(url, {
        headers: { "user-agent": UA },
        signal: controller.signal,
      });
      if (response.ok) return response;
      throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      if (attempt === RETRIES) throw err;
      // oxlint-disable-next-line eslint/no-await-in-loop -- 重试退避
      await new Promise((r) => setTimeout(r, 500 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("unreachable");
}

// —— ECCC 真实流探测（结果只记录，不阻塞——METAR IWXXM 上线前本层恒空）
const ecccProbe = { url: ECCC_IWXXM_INDEX, metarAvailable: false, note: "" };
try {
  const page = await (await fetchWithRetry(ECCC_IWXXM_INDEX)).text();
  ecccProbe.metarAvailable = /href="metar\/"/.test(page);
  ecccProbe.note = ecccProbe.metarAvailable
    ? "目录含 metar/——可评估接 ECCC 真实流（当前首选通道已为 AWC 实时流）"
    : "目录仅 taf/（schema/code-ca/doc 为辅助目录）——ECCC 现不发布 METAR IWXXM，实时流走 AWC";
} catch (err) {
  ecccProbe.note = `探测失败（${err instanceof Error ? err.message : String(err)}）——按不可用处理`;
}

// —— ① AWC 实时流：单请求批量取站 → 拆 collect 包裹 → 逐站抽取元数据
/** 拆出报文内全部 iwxxm:METAR / iwxxm:SPECI 文档（METAR/SPECI 不嵌套，非贪婪配对即安全）。 */
const splitReports = (raw) =>
  [...raw.matchAll(/<iwxxm:(METAR|SPECI)\b[\s\S]*?<\/iwxxm:\1>/g)].map((m) => m[0]);

const grab = (doc, re) => re.exec(doc)?.[1];

/** AWC 报文 ARP 坐标：gml:pos 输出为经度在前（2026-10-05 对 KSEA/ZSPD/EGLL 等 30 站普查一致）——
 *  换序为纬度在前；若经前序非法则回退纬前序再校验，两序都出界即判不可解析。 */
function awcLatLon(doc) {
  const m = /<gml:pos>(-?[\d.]+) (-?[\d.]+)<\/gml:pos>/.exec(doc);
  if (m === null) return undefined;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (Math.abs(b) <= 90 && Math.abs(a) <= 180) return { lat: b, lon: a };
  if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return { lat: a, lon: b };
  return undefined;
}

let awcStations = null;
const awcInfo = {
  url: `${AWC_ENDPOINT}?ids=${stationIds.join(",")}&format=iwxxm`,
  requested: stationIds.length,
  received: 0,
  note: "",
};
try {
  const response = await fetchWithRetry(`${AWC_ENDPOINT}?ids=${stationIds.join(",")}&format=iwxxm`);
  const raw = await response.text();
  const docs = splitReports(raw);
  const rows = [];
  for (const doc of docs) {
    const icao = grab(
      doc,
      /<aixm:locationIndicatorICAO>([A-Z0-9]{4})<\/aixm:locationIndicatorICAO>/,
    );
    const name = grab(doc, /<aixm:name>([^<]+)<\/aixm:name>/);
    const tac = grab(doc, /<!--TAC: ([^>]*?)\s*-->/);
    const ll = awcLatLon(doc);
    if (icao === undefined || name === undefined || tac === undefined || ll === undefined) {
      console.warn(`AWC 报文元数据不完整，跳过一站（icao=${icao ?? "无"}）`);
      continue;
    }
    rows.push({ icao, name, lat: ll.lat, lon: ll.lon, fetchSource: "awc-live", tac, xml: doc });
  }
  if (rows.length < MIN_STATIONS) throw new Error(`可用站仅 ${rows.length} < ${MIN_STATIONS}`);
  awcStations = rows;
  awcInfo.received = rows.length;
  awcInfo.note = `实时取数成功（IWXXM 2025-2，转换中心 NWS/AWC）——${rows.length}/${stationIds.length} 站`;
} catch (err) {
  awcInfo.note = `取数失败（${err instanceof Error ? err.message : String(err)}）——降级仓内语料副本`;
  console.warn(`AWC 实时流取数失败（${awcInfo.note}）`);
}

// —— ② 兜底：仓内语料副本（官方等价对，2023-1）
let stations = awcStations;
let fetchSourceTop = "awc-live";
let sourceText = "NOAA AWC 实时流（aviationweather.gov/api/data/metar?format=iwxxm，IWXXM 2025-2）";
if (stations === null) {
  const corpusDir = new URL("../corpus/iwxxm/metar-pairs/", import.meta.url);
  const names = readdirSync(corpusDir).filter((n) => n.endsWith(".xml"));
  const rows = [];
  for (const name of names) {
    const stem = name.replace(/\.xml$/, "");
    // oxlint-disable-next-line eslint/no-await-in-loop -- 本地文件顺序读，无并发收益
    const [xml, tac] = await Promise.all([
      readFile(new URL(`${stem}.xml`, corpusDir), "utf8"),
      readFile(new URL(`${stem}.tac`, corpusDir), "utf8"),
    ]);
    const pos = /<gml:pos>(-?[\d.]+) (-?[\d.]+)<\/gml:pos>/.exec(xml);
    const icao = /<aixm:locationIndicatorICAO>([A-Z0-9]{4})<\/aixm:locationIndicatorICAO>/.exec(
      xml,
    )?.[1];
    const stationName = /<aixm:name>([^<]+)<\/aixm:name>/.exec(xml)?.[1] ?? stem;
    if (pos === null || icao === undefined) {
      console.error(`${stem} 坐标或站名不可解析`);
      process.exit(1);
    }
    // 官方等价对 gml:pos 为纬度在前（与 AWC 相反，见 ① 注释）
    rows.push({
      icao,
      name: stationName,
      lat: Number(pos[1]),
      lon: Number(pos[2]),
      fetchSource: "corpus-local",
      tac: tac.trim(),
      xml,
    });
  }
  // 同站多报（EDDH/ENFB/NTAA 各两份官方对）：一站一点，保留首份
  const seen = new Set();
  stations = rows.filter((s) => (seen.has(s.icao) ? false : seen.add(s.icao)));
  if (stations.length < MIN_STATIONS) {
    console.error(`兜底层站数异常（${stations.length} < ${MIN_STATIONS}）——两层取数全部失败，退出`);
    process.exit(1);
  }
  fetchSourceTop = "corpus-local";
  sourceText = "wmo-im/iwxxm-translation Amd79-80-2023/metar 官方等价对仓内副本（IWXXM 2023-1）";
}

const payload = {
  source: sourceText,
  fetchSource: fetchSourceTop,
  generatedAt: new Date().toISOString(),
  awc: awcInfo,
  ecccProbe,
  fetchLayers: {
    preferred: "awc-live（AWC 实时流，2025-2；单请求批量、重试 ×3、超时 60s）",
    fallback: "corpus-local（仓内官方等价对副本，2023-1）",
  },
  count: stations.length,
  stations,
};

await writeFile(
  new URL("../examples/iwxxm-data.json", import.meta.url),
  `${JSON.stringify(payload, null, 2)}\n`,
);
console.log(
  `已写出 ${stations.length} 站 → examples/iwxxm-data.json（fetchSource=${fetchSourceTop}；AWC：${awcInfo.note}；ECCC 探测：${ecccProbe.note}）`,
);
