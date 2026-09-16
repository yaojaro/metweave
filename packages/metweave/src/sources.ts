/**
 * metweave/sources — 取数 helper（伞包子路径）。
 *
 * 纪律：只做端点模板 + fetch + 取数侧整理（解析、定位联表）——缓存/质控/归档等
 * 数据管理逻辑永不进入开源包；核心包（core/parser/render）零网络代码。
 * 不静默：HTTP 失败、响应 schema 不符、报文解析失败一律 throw，绝不吞错返回空数组。
 * 错误面机读化：五路失败一律抛 MetarSourceError（code 稳定契约 + network 网络名字段；
 * message 权威文案为中文；英文用 @metweave/core 导出的 EN_MESSAGES[code] 查表，
 * 或渲染层 locale:"en" 整卡切换（card locale 已内置 code→英文映射））。
 */
import type { MetarReport } from "@metweave/core";
import type { MetarParseErrorCode } from "@metweave/core";
import { MetarParseError, MetarSourceError } from "@metweave/core";
import { parse } from "@metweave/parser";

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
 */
export function iemCurrentsUrl(network = "CN__ASOS"): string {
  return `${IEM_BASE}/api/1/currents.json?network=${encodeURIComponent(network)}`;
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
      res = await fetch(iemCurrentsUrl(network), { signal: controller.signal });
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
