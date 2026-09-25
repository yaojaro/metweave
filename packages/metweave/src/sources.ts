/**
 * metweave/sources — 取数 helper（伞包子路径）。双线：IEM METAR 实况 + aviationweather TAF 预报（主）+ ogimet TAF 报池补充（次）。
 *
 * 纪律：只做端点模板 + fetch + 取数侧整理（解析、定位联表）——缓存/质控/归档等
 * 数据管理逻辑永不进入开源包；核心包（core/parser/render）零网络代码。
 * 换源口径（内网的人切换到自己的数据源」指令）：两条线各留 baseUrl 覆盖位
 * （IEM＝站点根、TAF＝端点根）——内网镜像/自建网关只换根、路径与查询串由本层拼装。
 * 不静默：HTTP 失败、响应 schema 不符、报文解析失败一律 throw，绝不吞错返回空数组。
 * 错误面机读化：五路失败一律抛 MetarSourceError（code 稳定契约 + network 网络名字段；
 * message 权威文案为中文；英文用 @metweave/core 导出的 EN_MESSAGES[code] 查表，
 * 或渲染层 locale:"en" 整卡切换（card locale 已内置 code→英文映射））。
 */
import type { MetarReport, TafReport } from "@metweave/core";
import type { MetarParseErrorCode } from "@metweave/core";
import { MetarParseError, MetarSourceError } from "@metweave/core";
import { parse, parseTaf } from "@metweave/parser";

// 错误类复出（API 完整性）：消费方从 sources 子路径 import 即可 catch 两类错误，
// 不必再从伞包主入口双入口引入（类实体与 core 同一，instanceof 双向成立）。
export { MetarParseError, MetarSourceError } from "@metweave/core";

/**
 * One fetched observation row: station, verbatim raw report, and source-provided coordinates (city-level for IEM China rows).
 * 单条取数观测行：站名、原样报文、源站坐标（IEM 中国行为城市级粗坐标）。
 */
export interface MetarObservation {
  /** 站名（ICAO） */
  station: string;
  /** 报文原文（IEM 通路无类型词，IEM 自带坐标为城市级粗坐标——定位请使用站点元数据） */
  raw: string;
  lat: number | null;
  lon: number | null;
}

/**
 * Options for getMetars: external abort signal and request timeout (either firing aborts).
 * getMetars 的选项：外部取消信号与请求超时（任一触发即中止）。
 */
export interface GetMetarsOptions {
  /** 外部取消信号（与超时组合，任一触发即中止） */
  signal?: AbortSignal;
  /** 请求超时毫秒数（触发即中止并抛出超时错误） */
  timeoutMs?: number;
  /**
   * IEM 站点根覆盖（缺省官方 https://mesonet.agron.iastate.edu）：内网镜像/自建网关
   * 只换根——/api/1/currents.json 路径与查询串由本层拼装（换源口径，见文件头）。
   */
  baseUrl?: string;
}

/**
 * Station metadata for lookup joins: authoritative coordinates overriding the source's city-level ones.
 * 站点元数据（联表用）：坐标为权威定位源，覆盖源站的城市级粗坐标。
 */
export interface StationRef {
  /** 站名（ICAO） */
  icao: string;
  /** 纬度（WGS-84） */
  lat: number;
  /** 经度（WGS-84） */
  lon: number;
  /** 站点名称（进 tooltip 标题） */
  name?: string;
}

/**
 * Per-row failure detail (the onUnparseable callback argument): one observation row failed to parse wholesale (missing station/time etc.).
 * 逐行容错的失败详情（onUnparseable 回调入参）：一行观测报文解析整体失败（站名/时组缺失等）。
 * `code` is the machine-readable failure code (MetarParseError's stable contract); `error` is the narrative message.
 * code 是机读失败码（MetarParseError 的稳定契约），error 是中文 message。
 */
export interface UnparseableReport {
  /** 源站站名（IEM 行的 station 字段） */
  station: string;
  /** 报文原文 */
  raw: string;
  /** 机读失败码（missing-station / missing-time / invalid-time） */
  code: MetarParseErrorCode;
  /** 解析失败原因（Error.message，中文） */
  error: string;
}

/**
 * Options for getMetarReports: fetch options plus station metadata and the per-row tolerance callback.
 * getMetarReports 的选项：取数选项 + 站点联表元数据 + 逐行容错回调。
 */
export interface GetMetarReportsOptions extends GetMetarsOptions {
  /** 按 icao 联表的站点元数据：命中则用其精确坐标与名称，未命中回落源站坐标 */
  stations?: readonly StationRef[];
  /**
   * 逐行容错（缺省关闭）：传入时解析失败的行跳过并逐条回调——失败可观测，不静默；
   * 不传时任一失败仍聚合抛出（默认行为不变，全有或全无）。
   */
  onUnparseable?: (failure: UnparseableReport) => void;
  /**
   * 紧凑模式：parse 产物剥除全部 span 字段（存储体积约 -32%，入库供屏场景推荐）；
   * 缺省 undefined = 完整模式（span 在位，原文回溯用）。
   */
  spans?: false;
}

/**
 * A map-ready report item (structurally compatible with MetarLayerItem): the { report, position, title } triple —
 * report is the parsed IR (raw text preserved verbatim on report.raw; field values via toValues(report)),
 * position is WGS-84 [lat, lon], title is the hover title.
 * 可直接喂给地图适配器（如 addMetarLayer）的报文项（与 MetarLayerItem 结构兼容）：
 * `{ report, position, title }` 三件套——report 是已解析的 IR（报文原文在 report.raw 原样保真，
 * 需要字段值走 toValues(report)），position 是 WGS-84 [lat, lon]，title 是悬浮提示标题。
 */
export interface MetarReportItem {
  /** 已解析的报文 IR（原文经 report.raw 原样保真回溯） */
  report: MetarReport;
  /** 站点坐标（WGS-84 [lat, lon]） */
  position: [number, number];
  /** 站点提示（「ICAO 站名」；适配器缺省回落 IR 站名） */
  title: string;
}

const IEM_BASE = "https://mesonet.agron.iastate.edu";

/**
 * The IEM whole-network currents endpoint (CORS-open, direct browser access). Defaults to the China ASOS network (39 stations).
 * IEM 整网实况端点（CORS 全开，浏览器可直连）。缺省中国 ASOS 网（39 站）。
 * @param network - IEM network name (e.g. CN__ASOS, RU__ASOS, IA_ASOS). IEM 网络名。
 * @param baseUrl - IEM 站点根覆盖（内网镜像/自建网关——换源口径，见 GetMetarsOptions.baseUrl）。
 */
export function iemCurrentsUrl(network = "CN__ASOS", baseUrl = IEM_BASE): string {
  return `${baseUrl}/api/1/currents.json?network=${encodeURIComponent(network)}`;
}

/** 观测记录守卫：station/raw 均须为字符串（只查键不查类型是旧洞）。 */
function isObservation(v: unknown): v is MetarObservation {
  if (typeof v !== "object" || v === null) return false;
  const rec = v as { station?: unknown; raw?: unknown };
  return typeof rec.station === "string" && typeof rec.raw === "string";
}

/**
 * Fetch IEM whole-network current observations (station/raw/coordinates passed through).
 * 拉取 IEM 整网实况观测（station/raw/坐标透传）。
 * No-silent-failure discipline on the fetch side / 不静默纪律的取数面：
 * - 空数组是错误网络名的典型形态（IEM 对未知 network 返回 200 + 空 data，合法网络不会返回空）——显式 throw；
 * - fetch 网络层失败（断网/DNS）包装为中文可读错误（原始 message 保留在文末与 cause）；
 * - 超时/外部 AbortSignal 触发的拒绝不包装、原样透传（保持取消语义）。
 */
export async function getMetars(
  network = "CN__ASOS",
  options: GetMetarsOptions = {},
): Promise<MetarObservation[]> {
  // 手工组合超时与外部信号（不依赖 AbortSignal.any：兼容 Node 20 全系；setTimeout 可被测试假时钟接管）
  const controller = new AbortController();
  const external = options.signal;
  const forward = (): void => {
    controller.abort(external?.reason);
  };
  if (external !== undefined) {
    if (external.aborted) forward();
    else external.addEventListener("abort", forward, { once: true });
  }
  const timer =
    options.timeoutMs === undefined
      ? undefined
      : setTimeout(
          () =>
            controller.abort(
              // 超时中止原因即最终抛出的错误：code "timeout"（外部 signal 取消不在此列，reason 原样透传）
              new MetarSourceError(
                "timeout",
                network,
                `IEM 请求超时（>${options.timeoutMs}ms，network=${network}）`,
              ),
            ),
          options.timeoutMs,
        );
  try {
    let res: Response;
    try {
      res = await fetch(iemCurrentsUrl(network, options.baseUrl), { signal: controller.signal });
    } catch (err) {
      // 取消/超时引发的拒绝（controller 已中止）原样透传——保持 AbortSignal 语义
      //（超时场景透传的即上方 MetarSourceError "timeout"）；
      // 其余（断网/DNS 的 TypeError 等）包装为 MetarSourceError "network"，原始 message 保留在文末与 cause
      if (controller.signal.aborted) throw err;
      const reason = err instanceof Error ? err.message : String(err);
      throw new MetarSourceError(
        "network",
        network,
        `网络请求失败（源：IEM，network=${network}）：请检查网络连通性后重试（${reason}）`,
        { cause: err },
      );
    }
    if (!res.ok) {
      throw new MetarSourceError(
        "http-error",
        network,
        `IEM HTTP ${res.status}（network=${network}）`,
      );
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch (err) {
      // HTTP 200 但响应体不是 JSON（企业代理/防火墙拦截页的典型形态）——裸 SyntaxError 打穿属错误面缺口；
      // 归入 bad-schema 机读码，人话提示指向代理环境。中止引发的拒绝不在此列（保持取消语义透传）
      if (controller.signal.aborted) throw err;
      const reason = err instanceof Error ? err.message : String(err);
      throw new MetarSourceError(
        "bad-schema",
        network,
        `IEM 响应不是合法 JSON（可能被代理/防火墙拦截，network=${network}）：${reason}`,
        { cause: err },
      );
    }
    if (
      typeof body !== "object" ||
      body === null ||
      !("data" in body) ||
      !Array.isArray(body.data)
    ) {
      throw new MetarSourceError(
        "bad-schema",
        network,
        `IEM 响应异常：缺少 data 数组（network=${network}，schema 不符）`,
      );
    }
    const rows = body.data;
    if (!rows.every(isObservation)) {
      throw new MetarSourceError(
        "bad-schema",
        network,
        `IEM 响应异常：data 存在 station/raw 非字符串的记录（network=${network}，schema 不符）`,
      );
    }
    if (rows.length === 0) {
      // 合法网络不会返回空（整网实况端点）——空 data 几乎必然是网络名写错（IEM 对未知网络名返回 200 + 空数组）
      throw new MetarSourceError(
        "empty-data",
        network,
        `IEM 返回空数据（network=${network}）——请核对 IEM 网络名（如 CN__ASOS/RU__ASOS，参考 https://mesonet.agron.iastate.edu/sites/networks.php）`,
      );
    }
    return rows;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    external?.removeEventListener("abort", forward);
  }
}

/**
 * Fetch → parse → locate in one step: returns map-ready report items.
 * 取数 → 解析 → 定位一步到位：返回可直接喂给地图适配器的报文项数组。
 *
 * 定位规则：stations 命中的站用元数据精确坐标（并带站名），未命中的回落源站坐标
 * （IEM 中国站为城市级粗坐标，严肃场景请传站点元数据——见 examples 的 stations.json 用法）；
 * 源站坐标为 null 且无元数据的行跳过。
 * 失败语义（不静默，两种模式）：缺省任一报文解析整体失败（站名/时组缺失）即聚合抛出，绝不静默丢行；
 * 传 options.onUnparseable 则逐行容错——失败行跳过并逐条回调（可观测），好行照常返回。
 */
export async function getMetarReports(
  network = "CN__ASOS",
  options: GetMetarReportsOptions = {},
): Promise<MetarReportItem[]> {
  const { stations, onUnparseable, spans, ...fetchOptions } = options;
  const table = new Map((stations ?? []).map((s) => [s.icao, s] as const));
  const observations = await getMetars(network, fetchOptions);
  const items: MetarReportItem[] = [];
  const failures: string[] = [];
  for (const obs of observations) {
    const station = table.get(obs.station);
    const lat = station?.lat ?? obs.lat;
    const lon = station?.lon ?? obs.lon;
    if (lat === null || lon === null) continue;
    try {
      items.push({
        report: parse(obs.raw, spans === false ? { spans: false } : undefined),
        position: [lat, lon],
        title: `${obs.station}${station?.name ? ` ${station.name}` : ""}`,
      });
    } catch (err) {
      // parse 对字符串输入只抛 MetarParseError（code 稳定契约）；其他异常属编程错误，直接上抛不降级
      if (!(err instanceof MetarParseError)) throw err;
      if (onUnparseable !== undefined) {
        onUnparseable({ station: obs.station, raw: obs.raw, code: err.code, error: err.message });
        continue;
      }
      failures.push(`${obs.station}: ${err.message}`);
    }
  }
  if (failures.length > 0) {
    // 聚合错误机读化（原裸 Error）：code 'batch-parse-failed' 稳定契约；raw 字段在此承载
    // 汇总信息（网络名/条数/逐条站名与原因）而非单条报文原文——语义调整见 core/errors.ts 注释
    const summary = `network=${network}; failures=${failures.length}; ${failures.join("; ")}`;
    throw new MetarParseError(
      "batch-parse-failed",
      summary,
      `报文解析失败 ${failures.length} 条（network=${network}）——${failures.slice(0, 3).join("；")}${failures.length > 3 ? "……" : ""}`,
    );
  }
  return items;
}

// ---------------------------------------------------------------- TAF 取数线（收进 sources」指令）

/** aviationweather TAF 数据端点（上游无 CORS 头：浏览器直连须自建代理/镜像——baseUrl 覆盖即为此用） */
export const AW_TAF_ENDPOINT = "https://aviationweather.gov/api/data/taf";

/**
 * One fetched TAF row: station (best-effort) and the verbatim report (continuation lines already merged).
 * 单条 TAF 取数行：站码（best-effort）与报文原文（续行已归并）。
 */
export interface TafObservation {
  /** 站码：剥 TAF/AMD/COR 电头词后的首枚 4 位码；剥不出为 ""（解析层 missing-station 兜底出声） */
  station: string;
  /** 报文原文（上游 raw 格式的缩进续行已并回所属报文；report.raw 语义一致——原文保真） */
  raw: string;
}

/** Options for getTafs: fetch options plus the TAF endpoint-root override and the as-of date. */
export interface GetTafsOptions {
  /** 外部取消信号（与超时组合，任一触发即中止） */
  signal?: AbortSignal;
  /** 请求超时毫秒数（触发即中止并抛出超时错误） */
  timeoutMs?: number;
  /**
   * TAF 端点根覆盖（缺省官方 https://aviationweather.gov/api/data/taf）：内网镜像/自建代理
   * 只换根——?ids=&format=raw 查询串由本层拼装（换源口径，见文件头；examples 即用 /aw-taf 代理根）。
   */
  baseUrl?: string;
  /**
   * 「该时刻已发布的最新报」（上游 date 参数语义）：回看上一发布周期用（examples 报池即 date=now-4h）。
   * Date 转 ISO；字符串原样透传（上游亦收相对形态）。
   */
  date?: Date | string;
}

/**
 * The aviationweather TAF endpoint (raw format). ids joined as given; date serialized when present.
 * aviationweather TAF 端点模板（format=raw）。ids 数组逗号连接；date 存在时序列化为查询参数。
 */
export function awTafUrl(
  ids: string | readonly string[],
  options: { baseUrl?: string; date?: Date | string } = {},
): string {
  const idList = typeof ids === "string" ? ids : ids.join(",");
  const params = new URLSearchParams({ ids: idList, format: "raw" });
  const d = options.date;
  if (d !== undefined) params.set("date", d instanceof Date ? d.toISOString() : d);
  return `${options.baseUrl ?? AW_TAF_ENDPOINT}?${params.toString()}`;
}

/** raw 文本 → 整份报文行（缩进续行并回上一份；与报池语义同源）+ best-effort 站码提取 */
function mergeTafLines(text: string): TafObservation[] {
  const merged: string[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    if (/^\s/.test(line) && merged.length > 0) merged[merged.length - 1] += ` ${line.trim()}`;
    else merged.push(line.trim());
  }
  return merged.map((raw) => {
    const toks = raw.split(/\s+/);
    let k = toks[0] === "TAF" ? 1 : 0;
    while (toks[k] === "AMD" || toks[k] === "COR") k += 1;
    const head = toks[k] ?? "";
    return { station: /^[A-Z0-9]{4}$/.test(head) ? head : "", raw };
  });
}

/**
 * Fetch aviationweather TAFs (raw format) with station extracted and continuation lines merged.
 * 拉取 aviationweather TAF（raw 格式）：续行归并 + 站码提取的取数侧整理。
 * 失败语义与 getMetars 同族（不静默）：timeout/network/http-error/empty-data 一律 MetarSourceError
 * 机读码；上游对未知 ids 也返回 200 + 空体，空数据显式 throw 而非空数组静默。
 */
export async function getTafs(
  ids: string | readonly string[],
  options: GetTafsOptions = {},
): Promise<TafObservation[]> {
  // 手工组合超时与外部信号（与 getMetars 同款：不依赖 AbortSignal.any，兼容 Node 20；假时钟可测）
  const controller = new AbortController();
  const external = options.signal;
  const forward = (): void => {
    controller.abort(external?.reason);
  };
  if (external !== undefined) {
    if (external.aborted) forward();
    else external.addEventListener("abort", forward, { once: true });
  }
  const timer =
    options.timeoutMs === undefined
      ? undefined
      : setTimeout(
          () =>
            controller.abort(
              new MetarSourceError(
                "timeout",
                "aviationweather",
                `aviationweather TAF 请求超时（>${options.timeoutMs}ms）`,
              ),
            ),
          options.timeoutMs,
        );
  try {
    let res: Response;
    try {
      res = await fetch(awTafUrl(ids, options), { signal: controller.signal });
    } catch (err) {
      // 取消/超时引发的拒绝原样透传（AbortSignal 语义）；断网/DNS 包装为 network（原始 message 留文末与 cause）
      if (controller.signal.aborted) throw err;
      const reason = err instanceof Error ? err.message : String(err);
      throw new MetarSourceError(
        "network",
        "aviationweather",
        `网络请求失败（源：aviationweather TAF）：请检查网络连通性后重试（${reason}）`,
        { cause: err },
      );
    }
    if (!res.ok) {
      throw new MetarSourceError(
        "http-error",
        "aviationweather",
        `aviationweather TAF HTTP ${res.status}`,
      );
    }
    let text: string;
    try {
      text = await res.text();
    } catch (err) {
      if (controller.signal.aborted) throw err;
      const reason = err instanceof Error ? err.message : String(err);
      throw new MetarSourceError(
        "network",
        "aviationweather",
        `aviationweather TAF 响应读取失败：${reason}`,
        { cause: err },
      );
    }
    const rows = mergeTafLines(text);
    if (rows.length === 0) {
      throw new MetarSourceError(
        "empty-data",
        "aviationweather",
        "aviationweather TAF 返回空数据——请核对 ids 站码（如 ZBAA,ZBAD；端点 format=raw）",
      );
    }
    return rows;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    external?.removeEventListener("abort", forward);
  }
}

/** Options for getTafReports: fetch options plus station metadata and the per-row tolerance callback. */
export interface GetTafReportsOptions extends GetTafsOptions {
  /** 按 icao 联表的站点元数据（TAF 端点不提供坐标——stations 是定位的唯一来源，缺省将得空数组） */
  stations?: readonly StationRef[];
  /** 逐行容错（缺省关闭）：传入时解析失败的行跳过并逐条回调；不传时聚合抛出（全有或全无） */
  onUnparseable?: (failure: UnparseableReport) => void;
  /** 紧凑模式：parseTaf 产物剥除全部 span 字段（存储场景推荐）；缺省完整模式 */
  spans?: false;
}

/**
 * A map-ready TAF item (structurally compatible with TafLayerItem's report/position/title triple).
 * 可直接喂给地图适配器（如 addTafLayer）的预报项：{ report, position, title } 三件套。
 */
export interface TafReportItem {
  /** 已解析的 TAF IR（原文经 report.raw 原样保真） */
  report: TafReport;
  /** 站点坐标（WGS-84 [lat, lon]；TAF 端点无坐标，来自 stations 联表） */
  position: [number, number];
  /** 站点提示（「ICAO 站名」；适配器缺省回落 IR 站名） */
  title: string;
}

/**
 * TAF 版的取数 → 解析 → 定位一步到位（契约沿 getMetarReports）：stations 命中的站带精确坐标与站名，
 * 未命中跳过（TAF 端点无坐标可回落，与 getMetarReports 的无坐标跳行同规则）；解析失败两种模式
 * （缺省聚合抛出 batch-parse-failed、传 onUnparseable 逐行容错）。报池等数据管理逻辑不进本层。
 */
export async function getTafReports(
  ids: string | readonly string[],
  options: GetTafReportsOptions = {},
): Promise<TafReportItem[]> {
  const { stations, onUnparseable, spans, ...fetchOptions } = options;
  const table = new Map((stations ?? []).map((s) => [s.icao, s] as const));
  const observations = await getTafs(ids, fetchOptions);
  const items: TafReportItem[] = [];
  const failures: string[] = [];
  for (const obs of observations) {
    try {
      const report = parseTaf(obs.raw, spans === false ? { spans: false } : undefined);
      const station = table.get(report.station);
      if (station === undefined) continue; // 站表未命中（端点无坐标可回落）——跳过，规则同 getMetarReports
      items.push({
        report,
        position: [station.lat, station.lon],
        title: `${report.station}${station.name ? ` ${station.name}` : ""}`,
      });
    } catch (err) {
      // parseTaf 对字符串输入只抛 MetarParseError；其他异常属编程错误直接上抛
      if (!(err instanceof MetarParseError)) throw err;
      if (onUnparseable !== undefined) {
        onUnparseable({ station: obs.station, raw: obs.raw, code: err.code, error: err.message });
        continue;
      }
      failures.push(`${obs.station}: ${err.message}`);
    }
  }
  if (failures.length > 0) {
    const summary = `source=aviationweather; failures=${failures.length}; ${failures.join("; ")}`;
    throw new MetarParseError(
      "batch-parse-failed",
      summary,
      `TAF 解析失败 ${failures.length} 条（aviationweather）——${failures.slice(0, 3).join("；")}${failures.length > 3 ? "……" : ""}`,
    );
  }
  return items;
}

// ---------------------------------------------------------------- ogimet TAF 补充线（指令：aviationweather 取最新，ogimet 取最新/次新合并补充）

/** ogimet display_metars2.php 端点（tipo=FT＝TAF；无 CORS 头：浏览器直连须代理/镜像——baseUrl 覆盖即为此用） */
export const OGIMET_TAF_ENDPOINT = "https://www.ogimet.com/display_metars2.php";

/** ogimet 查询窗（UTC 起止） */
export interface OgimetTafWindow {
  readonly from: Date;
  readonly to: Date;
}

/**
 * ogimet TAF 端点模板（配方＝私有管线 backfill_ogimet.py 同源）：tipo=FT、txt 形、
 * 服务端按 <pre> 区回 HTML（解析见 parseOgimetTafs）。免费公益服务——调用方自行节制频率。
 */
/** UTC 日期字段补零组（ogimet 查询串的 ano/mes/day/hora/min 族） */
const ogimetFields = (
  d: Date,
): { ano: string; mes: string; day: string; hora: string; min: string } => ({
  ano: `${d.getUTCFullYear()}`,
  mes: `${d.getUTCMonth() + 1}`.padStart(2, "0"),
  day: `${d.getUTCDate()}`.padStart(2, "0"),
  hora: `${d.getUTCHours()}`.padStart(2, "0"),
  min: `${d.getUTCMinutes()}`.padStart(2, "0"),
});

export function ogimetTafUrl(
  station: string,
  window: OgimetTafWindow,
  options: { baseUrl?: string } = {},
): string {
  const a = ogimetFields(window.from);
  const b = ogimetFields(window.to);
  const qs = new URLSearchParams({
    lang: "en",
    lugar: station,
    tipo: "FT",
    ord: "DIR",
    nil: "SI",
    fmt: "txt",
    ano: a.ano,
    mes: a.mes,
    day: a.day,
    hora: a.hora,
    min: a.min,
    anof: b.ano,
    mesf: b.mes,
    dayf: b.day,
    horaf: b.hora,
    minf: b.min,
    send: "send",
    nohtmlo: "yes",
    annot: "yes",
    leng: "0",
  });
  return `${options.baseUrl ?? OGIMET_TAF_ENDPOINT}?${qs.toString()}`;
}

/** 电头站码 best-effort 提取（TAF/AMD/COR 剥词；剥不出返回空串）——与 mergeTafLines 同判式（aviationweather 取数线） */
const stationHeadOf = (raw: string): string => {
  const toks = raw.split(/\s+/);
  let k = toks[0] === "TAF" ? 1 : 0;
  while (toks[k] === "AMD" || toks[k] === "COR") k += 1;
  const head = toks[k] ?? "";
  return /^[A-Z0-9]{4}$/.test(head) ? head : "";
};

/**
 * ogimet 响应解析（<pre> 区）：12 位时间戳前缀行（YYYYMMDDHHmm，收报序）起新记录、无前缀行并入上一条
 * （多行报文并单——与私有管线 parse_tafs 同协议）；# 注释/空行跳过；只收 TAF 起头报文。
 * 站码 best-effort 取自电头（query 站名兜底）；空模板（无 <pre> 或零报文）返回空数组——
 * 由调用方判空（ogimet 缺数常见，属正常降级而非错误面）。
 */
export function parseOgimetTafs(html: string, fallbackStation = ""): TafObservation[] {
  const pre = /<pre>([\s\S]*?)<\/pre>/.exec(html);
  if (pre === null) return [];
  const PREFIX = /^(\d{12})\s+(.*)$/;
  const merged: string[] = [];
  for (const line of (pre[1] ?? "").split("\n")) {
    const t = line.trim();
    if (t === "" || t.startsWith("#")) continue;
    const pm = PREFIX.exec(t);
    if (pm !== null) merged.push(pm[2] ?? "");
    else if (merged.length > 0) merged[merged.length - 1] += ` ${t}`;
  }
  return merged
    .filter((raw) => raw.startsWith("TAF"))
    .map((raw) => ({ station: stationHeadOf(raw) || fallbackStation, raw }));
}

/** Options for getTafsOgimet: fetch options plus the ogimet endpoint-root override. */
export interface GetTafsOgimetOptions {
  /** 外部取消信号（与超时组合，任一触发即中止） */
  signal?: AbortSignal;
  /** 请求超时毫秒数（触发即中止并抛出超时错误） */
  timeoutMs?: number;
  /** ogimet 端点根覆盖（内网镜像/自建代理；examples 走 /ogimet-taf 代理根） */
  baseUrl?: string;
}

/**
 * Fetch one station's recent TAFs from ogimet (latest + previous publication cycles).
 * 拉取单站的 ogimet 近窗 TAF（最新与上一发布周期——报池补充线，供与 aviationweather 线合并去重）。
 * 失败语义与 getTafs 同族（timeout/network/http-error 机读码）；空数据返回空数组而非抛错
 * （ogimet 站点级缺数常见——它是补充线，空窗属正常降级，不静默丢整批）。
 */
export async function getTafsOgimet(
  station: string,
  window: OgimetTafWindow,
  options: GetTafsOgimetOptions = {},
): Promise<TafObservation[]> {
  const controller = new AbortController();
  const external = options.signal;
  const forward = (): void => {
    controller.abort(external?.reason);
  };
  if (external !== undefined) {
    if (external.aborted) forward();
    else external.addEventListener("abort", forward, { once: true });
  }
  const timer =
    options.timeoutMs === undefined
      ? undefined
      : setTimeout(
          () =>
            controller.abort(
              new MetarSourceError(
                "timeout",
                "ogimet",
                `ogimet TAF 请求超时（>${options.timeoutMs}ms，站=${station}）`,
              ),
            ),
          options.timeoutMs,
        );
  try {
    let res: Response;
    try {
      res = await fetch(ogimetTafUrl(station, window, options), { signal: controller.signal });
    } catch (err) {
      if (controller.signal.aborted) throw err;
      const reason = err instanceof Error ? err.message : String(err);
      throw new MetarSourceError(
        "network",
        "ogimet",
        `网络请求失败（源：ogimet TAF，站=${station}）：${reason}`,
        { cause: err },
      );
    }
    if (!res.ok) {
      throw new MetarSourceError(
        "http-error",
        "ogimet",
        `ogimet TAF HTTP ${res.status}（站=${station}）`,
      );
    }
    return parseOgimetTafs(await res.text(), station);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    external?.removeEventListener("abort", forward);
  }
}
