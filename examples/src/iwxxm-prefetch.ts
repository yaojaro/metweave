/**
 * AWC IWXXM 备选视图预取管线（v0.3 第五期，主示例页 index.html 专用）。
 *
 * 主示例页实况数据面是 IEM TAC 流（getMetarReports），弹窗卡片主视图即 TAC 电码；owner 要求
 * 同卡可切 IWXXM——NOAA AWC data API 免鉴权按站单返回 IWXXM XML（2025-2），但端点无 CORS 头，
 * 浏览器不可直连：dev 环境走 vite 服务端代理（/aw-metar → aviationweather.gov，见 vite.config.ts）。
 *
 * 时序约束（预取而非现拉的原因）：renderCard 产静态 DOM，altRaws 函数形态在弹窗建卡时同步求值
 * ——异步 fetch 不能在渲染时现拉，须先落内存 Map、altRaws 闭包同步查。故预取与 IEM 整网拉取
 * 并行点火（同为后台静默、不阻塞主流程；AWC 批量单请求秒级返回，IEM 整网通常 10–40 秒，正常
 * 时序备选视图先于实况层就位）。预取未到/失败/代理不可用＝查不到该站＝空数组＝无 tab，自然降级。
 *
 * 失败语义：单次批量请求、重试 ×3（顺序退避）、单次超时 60s（与 scripts/gen-iwxxm.mjs
 * fetchWithRetry 同款纪律）；穷尽后 throw——本模块不吞错，静默降级（console 一条 info）由
 * main.ts 接线层定。时次口径：AWC 侧最新时次可能与 IEM 不同轮（如 IEM 已到 06Z 而 AWC 最新
 * 00Z，或中国站半点加发的半点差）——altRaws 的 label 已标「AWC」来源，卡片时间行以主视图
 * （IEM TAC）为准，不做事强行对齐。
 */
import { parseIwxxm, type MetarReport, type RenderCardAltRaw } from "metweave";

/** AWC METAR 端点的 dev 代理根（vite server.proxy 重写至 aviationweather.gov/api/data/metar） */
const AWC_METAR_PROXY_BASE = "/aw-metar";

/** fetchAwcIwxxm 的选项 */
export interface AwcIwxxmPrefetchOptions {
  /** 端点根覆盖（缺省 vite 代理根 /aw-metar；自建镜像/网关只换根，查询串由本层拼装） */
  readonly baseUrl?: string;
  /** 回看窗小时数（缺省 3——窗内取各站最新一份；AWC 实测同一请求返回多时次拼接） */
  readonly hours?: number;
  /** 单次尝试超时毫秒（缺省 60s） */
  readonly timeoutMs?: number;
  /** 尝试次数（缺省 3＝首试＋重试两次；与 gen-iwxxm 取数纪律同款） */
  readonly retries?: number;
}

/**
 * AWC METAR IWXXM 批量端点模板：ids=逗号站单、format=iwxxm、hours=回看窗。
 * ids=all 不支持 iwxxm 格式（第二期实证，HTTP 204 空体）——必须站单列表。
 */
export function awcMetarIwxxmUrl(
  stations: readonly string[],
  options: { baseUrl?: string; hours?: number } = {},
): string {
  const params = new URLSearchParams({
    ids: stations.join(","),
    format: "iwxxm",
    hours: String(options.hours ?? 3),
  });
  return `${options.baseUrl ?? AWC_METAR_PROXY_BASE}?${params.toString()}`;
}

/** 拆出响应内全部 iwxxm:METAR / iwxxm:SPECI 文档（METAR/SPECI 不嵌套，非贪婪配对安全）——
 *  判式与 scripts/gen-iwxxm.mjs 的 splitReports 同源；多站响应为 WMO collect 2014 包裹，
 *  正则直取内层文档、无视包裹层级 */
const splitDocs = (raw: string): string[] =>
  [...raw.matchAll(/<iwxxm:(METAR|SPECI)\b[\s\S]*?<\/iwxxm:\1>/g)].map((m) => m[0] ?? "");

/** 站码（aixm:locationIndicatorICAO 元素——gen-iwxxm 的 grab 同式）；剥不出为 null */
const stationOf = (doc: string): string | null =>
  /<aixm:locationIndicatorICAO>([A-Z0-9]{4})<\/aixm:locationIndicatorICAO>/.exec(doc)?.[1] ?? null;

/** 报文时次（文档内首个 gml:timePosition：AWC 输出 issueTime 与 observationTime 同值，首现即观测时刻）。
 *  ISO-8601 UTC 定宽字符串，字典序即时间序——同站多份取 max 即最新，不依赖响应顺序；
 *  不用 IR 的 ddHHMM（无年月位，跨月窗会错序） */
const timeOf = (doc: string): string =>
  /<gml:timePosition>([^<]+)<\/gml:timePosition>/.exec(doc)?.[1] ?? "";

/** 单请求顺序重试取数（gen-iwxxm fetchWithRetry 同款：单次超时 AbortController、500ms×n 退避；
 *  穷尽后抛末次错误——批量单请求无并发问题，失败整体降级由调用方定） */
async function fetchTextWithRetry(
  url: string,
  timeoutMs: number,
  retries: number,
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- 重试语义本就是顺序的
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // oxlint-disable-next-line eslint/no-await-in-loop -- 重试语义本就是顺序的
      return await response.text();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- 顺序退避（500ms×n，重试间隔）
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr; // retries ≥1 保证非 undefined；穷尽即抛末次
}

/**
 * 预拉 AWC 批量 IWXXM 并解析为按站 Map（弹窗备选视图的数据面）。
 * 单次批量请求（39 站一单）→ 拆分 → 逐份 parseIwxxm → 站码入键、窗内时次最新者胜。
 * 只收 iwxxm:METAR 根：SPECI 是两次定时观测之间的特殊观测、与卡片主视图（例行 METAR）非同一
 * 观测，入表反而制造时次错位；个别文档站码缺失/解析失败跳过不拖垮整批（该站无备选视图＝自然降级）。
 */
export async function fetchAwcIwxxm(
  stations: readonly string[],
  options: AwcIwxxmPrefetchOptions = {},
): Promise<Map<string, MetarReport>> {
  const raw = await fetchTextWithRetry(
    awcMetarIwxxmUrl(stations, options),
    options.timeoutMs ?? 60_000,
    options.retries ?? 3,
  );
  const byStation = new Map<string, MetarReport>();
  const latestTime = new Map<string, string>();
  for (const doc of splitDocs(raw)) {
    if (!doc.startsWith("<iwxxm:METAR")) continue; // SPECI 不入表（见函数注释）
    const station = stationOf(doc);
    if (station === null) continue;
    const time = timeOf(doc);
    if (byStation.has(station) && time <= (latestTime.get(station) ?? "")) continue;
    try {
      const report = parseIwxxm(doc);
      // metar 端点响应不含 TAF——kind 收窄防御未来端点行为变化（TAF 备选视图不在本管线范围）
      if (report.kind === "taf") continue;
      byStation.set(station, report);
      latestTime.set(station, time);
    } catch {
      // 单份解析失败跳过（非目标产品族/畸形文档）：已入表的旧时次保留，不被失败的新时次顶掉
    }
  }
  return byStation;
}

/**
 * renderCard 的 card.altRaws 供给（函数形态，按本卡站码同步查预取 Map）：
 * 有则单表项——label 标「AWC」来源（该侧时次可能与 IEM 主视图差半点到一小时，卡片时间行以
 * 主视图为准）；无则空数组＝无 tab（预取未到/失败/该站缺数）。传活引用 Map（预取完成后原地
 * 填充）则后续建卡（时区切换/模式回切重建实况层）即取到新数据。
 */
export const altRawsFromAwc =
  (byStation: ReadonlyMap<string, MetarReport>) =>
  (report: MetarReport): readonly RenderCardAltRaw[] => {
    const alt = byStation.get(report.station);
    return alt === undefined ? [] : [{ label: "IWXXM（AWC）", report: alt }];
  };
