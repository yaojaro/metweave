import { afterEach, describe, expect, it, vi } from "vitest";
import { MetarSourceError } from "@metweave/core";
import {
  awTafUrl,
  getMetarReports,
  getMetars,
  getTafReports,
  getTafs,
  iemCurrentsUrl,
} from "./sources";
import { MetarParseError, MetarSourceError as MetarSourceErrorFromSources } from "./sources";

/** 捕获 getMetars/getMetarReports 的失败实体（供机读码断言） */
const errorOf = async (p: Promise<unknown>): Promise<unknown> => p.catch((e: unknown) => e);

/** 模拟真实 fetch 的中止语义：以 signal.reason 拒绝（真实 fetch 同款） */
const hangingFetch = () =>
  vi.fn(
    (_url: unknown, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal === undefined) return;
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
  );

const okFetch = (body: unknown) =>
  vi.fn(async (_url: string) => ({ ok: true, status: 200, json: async () => body }));

const textFetch = (body: string) =>
  vi.fn(async (_url: string) => ({ ok: true, status: 200, text: async () => body }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("iemCurrentsUrl", () => {
  it("network 参数经 URL 编码（防注入查询串）", () => {
    const url = iemCurrentsUrl("A B&C");
    const encoded = url.split("network=")[1] ?? "";
    expect(encoded).not.toContain(" ");
    expect(decodeURIComponent(encoded)).toBe("A B&C");
  });
});

describe("getMetars 失败面（不静默：守卫失败一律 throw；五路失败均 MetarSourceError 机读码）", () => {
  it("正常路径返回观测数组（station/raw 透传）", async () => {
    vi.stubGlobal(
      "fetch",
      okFetch({
        data: [{ station: "ZGGG", raw: "ZGGG 120000Z 9999 26/22 Q1009", lat: 23.4, lon: 113.5 }],
      }),
    );
    const rows = await getMetars();
    expect(rows.length).toBe(1);
    expect(rows[0]?.station).toBe("ZGGG");
    expect(rows[0]?.raw).toContain("ZGGG 120000Z");
  });

  it("非 2xx → MetarSourceError{code:'http-error'}（含 HTTP 状态与网络名）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
    );
    await expect(getMetars("CN__ASOS")).rejects.toThrow(/503/);
    const err = await errorOf(getMetars("CN__ASOS"));
    expect(err).toBeInstanceOf(MetarSourceError);
    expect((err as MetarSourceError).code).toBe("http-error");
    expect((err as MetarSourceError).network).toBe("CN__ASOS");
  });

  it("坏 schema（无 data 数组）→ MetarSourceError{code:'bad-schema'}（不得静默返回空数组）", async () => {
    vi.stubGlobal("fetch", okFetch({ nonsense: true }));
    await expect(getMetars()).rejects.toThrow();
    const err = await errorOf(getMetars());
    expect(err).toBeInstanceOf(MetarSourceError);
    expect((err as MetarSourceError).code).toBe("bad-schema");
  });

  it("坏 schema（data 非数组）→ MetarSourceError{code:'bad-schema'}", async () => {
    vi.stubGlobal("fetch", okFetch({ data: "oops" }));
    const err = await errorOf(getMetars());
    expect(err).toBeInstanceOf(MetarSourceError);
    expect((err as MetarSourceError).code).toBe("bad-schema");
  });

  it("坏 schema（station 非字符串——只查键不查类型的旧洞）→ MetarSourceError{code:'bad-schema'}", async () => {
    vi.stubGlobal("fetch", okFetch({ data: [{ station: 42, raw: "x" }] }));
    const err = await errorOf(getMetars());
    expect(err).toBeInstanceOf(MetarSourceError);
    expect((err as MetarSourceError).code).toBe("bad-schema");
  });

  it("timeoutMs 超时中止 → MetarSourceError{code:'timeout'}（错误提示超时，不挂死）", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());
    const pending = getMetars("CN__ASOS", { timeoutMs: 5000 });
    const errP = errorOf(pending);
    await vi.advanceTimersByTimeAsync(5000);
    const err = await errP;
    expect(err).toBeInstanceOf(MetarSourceError);
    expect((err as MetarSourceError).code).toBe("timeout");
    expect((err as MetarSourceError).network).toBe("CN__ASOS");
    expect((err as Error).message).toMatch(/超时/);
  });

  it("外部 signal 已取消 → 立即失败（原因透传）", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const controller = new AbortController();
    controller.abort(new Error("用户取消"));
    await expect(getMetars("CN__ASOS", { signal: controller.signal })).rejects.toThrow(
      /^用户取消$/,
    );
  });

  it("中途取消：fetch 挂起中 abort 外部 signal → 以该 reason 拒绝（中止语义透传到已发出的请求）", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const controller = new AbortController();
    const pending = expect(getMetars("CN__ASOS", { signal: controller.signal })).rejects.toThrow(
      /^用户取消$/,
    );
    // 此刻 getMetars 已发起 fetch 并完成监听注册；abort 事件同步触发拒绝
    controller.abort(new Error("用户取消"));
    await pending;
  });

  it("无 options 时向后兼容（默认网，行为不变）", async () => {
    const fetchMock = okFetch({
      data: [{ station: "ZGGG", raw: "ZGGG 120000Z 9999 26/22 Q1009", lat: 23.4, lon: 113.5 }],
    });
    vi.stubGlobal("fetch", fetchMock);
    const rows = await getMetars();
    expect(rows.length).toBe(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("network=CN__ASOS");
  });
});

describe("取数健壮性（错误包装与取消语义分离）", () => {
  it("空 data → MetarSourceError{code:'empty-data'}：错误网络名返回 200+空数组的显式防线（含网络名与核对提示）", async () => {
    vi.stubGlobal("fetch", okFetch({ data: [] }));
    await expect(getMetars("XX__ASOS")).rejects.toThrow(/XX__ASOS/);
    await expect(getMetars("XX__ASOS")).rejects.toThrow(/请核对 IEM 网络名/);
    await expect(getMetars("XX__ASOS")).rejects.toThrow(/CN__ASOS/);
    await expect(getMetars("XX__ASOS")).rejects.toThrow(/networks\.php/);
    const err = await errorOf(getMetars("XX__ASOS"));
    expect(err).toBeInstanceOf(MetarSourceError);
    expect((err as MetarSourceError).code).toBe("empty-data");
    expect((err as MetarSourceError).network).toBe("XX__ASOS");
  });

  it("getMetarReports 同享空 data 防线（透传 MetarSourceError，不静默返回空图）", async () => {
    vi.stubGlobal("fetch", okFetch({ data: [] }));
    await expect(getMetarReports("XX__ASOS")).rejects.toThrow(/请核对 IEM 网络名/);
    const err = await errorOf(getMetarReports("XX__ASOS"));
    expect(err).toBeInstanceOf(MetarSourceError);
    expect((err as MetarSourceError).code).toBe("empty-data");
  });

  it("fetch 网络层拒绝（断网/DNS 的 TypeError）→ MetarSourceError{code:'network'}：源+网络名+原始 message 保留", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    await expect(getMetars("CN__ASOS")).rejects.toThrow(/网络请求失败/);
    await expect(getMetars("CN__ASOS")).rejects.toThrow(/IEM/);
    await expect(getMetars("CN__ASOS")).rejects.toThrow(/CN__ASOS/);
    await expect(getMetars("CN__ASOS")).rejects.toThrow(/fetch failed/);
    const err = await errorOf(getMetars("CN__ASOS"));
    expect(err).toBeInstanceOf(MetarSourceError);
    expect((err as MetarSourceError).code).toBe("network");
    expect((err as MetarSourceError).network).toBe("CN__ASOS");
    // cause 保留原始错误（供日志归因）
    expect((err as { cause?: unknown }).cause).toBeInstanceOf(TypeError);
  });

  it("超时与外部取消不包装：中止语义透传（超时提示/取消原因原样抛出）", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());
    const pending = expect(getMetars("CN__ASOS", { timeoutMs: 3000 })).rejects.toThrow(/超时/);
    await vi.advanceTimersByTimeAsync(3000);
    await pending;

    vi.stubGlobal("fetch", hangingFetch());
    const controller = new AbortController();
    const aborted = expect(getMetars("CN__ASOS", { signal: controller.signal })).rejects.toThrow(
      /^用户取消$/,
    );
    controller.abort(new Error("用户取消"));
    await aborted;
  });
});

describe("getMetarReports（取数→解析→定位一步到位）", () => {
  it("返回解析后的报文项：IR、坐标、标题齐备（与图层项结构兼容）", async () => {
    vi.stubGlobal(
      "fetch",
      okFetch({
        data: [{ station: "ZGGG", raw: "ZGGG 120000Z 9999 26/22 Q1009", lat: 23.4, lon: 113.5 }],
      }),
    );
    const items = await getMetarReports();
    expect(items.length).toBe(1);
    expect(items[0]?.report.station).toBe("ZGGG");
    expect(items[0]?.report.temperature?.celsius).toBe(26);
    expect(items[0]?.position).toEqual([23.4, 113.5]);
    expect(items[0]?.title).toBe("ZGGG");
  });

  it("stations 联表优先：精确坐标覆盖源站粗坐标，站名进标题", async () => {
    vi.stubGlobal(
      "fetch",
      okFetch({
        data: [
          {
            station: "ZBAA",
            raw: "ZBAA 120000Z VRB02MPS CAVOK 25/10 Q1019",
            lat: 39.9,
            lon: 116.4,
          },
        ],
      }),
    );
    const items = await getMetarReports("CN__ASOS", {
      stations: [{ icao: "ZBAA", lat: 40.0801, lon: 116.5771, name: "北京首都" }],
    });
    expect(items[0]?.position).toEqual([40.0801, 116.5771]);
    expect(items[0]?.title).toBe("ZBAA 北京首都");
  });

  it("stations 未命中回落源站坐标；坐标为 null 且无元数据的行跳过", async () => {
    vi.stubGlobal(
      "fetch",
      okFetch({
        data: [
          { station: "ZGSZ", raw: "ZGSZ 120000Z 9999 30/24 Q1010", lat: 22.6, lon: 114.0 },
          { station: "XXXX", raw: "XXXX 120000Z 9999 30/24 Q1010", lat: null, lon: null },
        ],
      }),
    );
    const items = await getMetarReports();
    expect(items.length).toBe(1);
    expect(items[0]?.position).toEqual([22.6, 114.0]);
  });

  it("不静默：任一报文解析整体失败 → 聚合抛出（含站名与条数，绝不静默丢行）", async () => {
    vi.stubGlobal(
      "fetch",
      okFetch({
        data: [
          { station: "ZGGG", raw: "ZGGG 120000Z 9999 26/22 Q1009", lat: 23.4, lon: 113.5 },
          { station: "BAD1", raw: "没有站名的报文", lat: 1, lon: 2 },
          { station: "BAD2", raw: "BAD2 缺时组", lat: 3, lon: 4 },
        ],
      }),
    );
    await expect(getMetarReports()).rejects.toThrow(/2 条.*BAD1.*BAD2/s);
  });

  it("聚合错误机读化：MetarParseError{code:'batch-parse-failed'}——instanceof + code + 汇总信息完整（不再是裸 Error）", async () => {
    vi.stubGlobal(
      "fetch",
      okFetch({
        data: [
          { station: "ZGGG", raw: "ZGGG 120000Z 9999 26/22 Q1009", lat: 23.4, lon: 113.5 },
          { station: "BAD1", raw: "没有站名的报文", lat: 1, lon: 2 },
          { station: "BAD2", raw: "BAD2 缺时组", lat: 3, lon: 4 },
        ],
      }),
    );
    const err = (await errorOf(getMetarReports())) as MetarParseError;
    expect(err).toBeInstanceOf(MetarParseError);
    expect(err.code).toBe("batch-parse-failed");
    // 信息完整：失败条数、网络名、站名逐条在位（message 文案可改，机读字段与结构稳定）
    expect(err.message).toMatch(/2 条/);
    expect(err.message).toContain("BAD1");
    expect(err.message).toContain("BAD2");
    // raw 字段在此 code 下承载汇总信息（非单条报文原文——语义调整见 errors.ts 注释）
    expect(err.raw).toContain("BAD1");
    expect(err.raw).toContain("BAD2");
  });

  it("onUnparseable 容错：失败行跳过、好行照常返回（不因个别脏行整图失败）", async () => {
    vi.stubGlobal(
      "fetch",
      okFetch({
        data: [
          { station: "ZGGG", raw: "ZGGG 120000Z 9999 26/22 Q1009", lat: 23.4, lon: 113.5 },
          { station: "BAD1", raw: "没有站名的报文", lat: 1, lon: 2 },
          {
            station: "ZBAA",
            raw: "ZBAA 120000Z VRB02MPS CAVOK 25/10 Q1019",
            lat: 39.9,
            lon: 116.4,
          },
        ],
      }),
    );
    const items = await getMetarReports("CN__ASOS", { onUnparseable: () => {} });
    expect(items.length).toBe(2);
    expect(items.map((x) => x.report.station)).toEqual(["ZGGG", "ZBAA"]);
  });

  it("onUnparseable 可观测：逐条回调收到 station/raw/code/error 失败详情（跳过 ≠ 静默；code 机读不靠中文 message）", async () => {
    vi.stubGlobal(
      "fetch",
      okFetch({
        data: [
          { station: "ZGGG", raw: "ZGGG 120000Z 9999 26/22 Q1009", lat: 23.4, lon: 113.5 },
          { station: "BAD1", raw: "没有站名的报文", lat: 1, lon: 2 },
        ],
      }),
    );
    const failures: { station: string; raw: string; code: string; error: string }[] = [];
    await getMetarReports("CN__ASOS", { onUnparseable: (f) => failures.push(f) });
    expect(failures.length).toBe(1);
    expect(failures[0]?.station).toBe("BAD1");
    expect(failures[0]?.raw).toBe("没有站名的报文");
    expect(failures[0]?.code).toBe("missing-station");
  });

  it("取消语义透传（pre-aborted signal 立即失败）", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const controller = new AbortController();
    controller.abort(new Error("用户取消"));
    await expect(getMetarReports("CN__ASOS", { signal: controller.signal })).rejects.toThrow(
      /^用户取消$/,
    );
  });
});

describe("A 批：取数与子路径错误面", () => {
  it("非 JSON 体（代理/防火墙 HTML 错误页）→ MetarSourceError{code:'bad-schema'}，不再是裸 SyntaxError", async () => {
    const syntaxErr = new SyntaxError("Unexpected token '<', \"<html>\" is not valid JSON");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw syntaxErr;
        },
      })),
    );
    const err = await errorOf(getMetars("CN__ASOS"));
    expect(err).toBeInstanceOf(MetarSourceError);
    expect((err as MetarSourceError).code).toBe("bad-schema");
    expect((err as Error).message).toContain("响应不是合法 JSON");
    expect((err as Error).message).toContain("代理");
    expect((err as Error).message).toContain(syntaxErr.message);
    // cause 保留原始 SyntaxError（供日志归因）
    expect((err as { cause?: unknown }).cause).toBe(syntaxErr);
    // getMetarReports 同享该防线（透传，不静默返回空图）
    const err2 = await errorOf(getMetarReports("CN__ASOS"));
    expect((err2 as MetarSourceError).code).toBe("bad-schema");
  });

  it("sources 子路径复出错误类（类型+值）：与 core 同一类实体，catch 不再双入口 import", async () => {
    expect(MetarSourceErrorFromSources).toBe(MetarSourceError);
    expect(new MetarSourceErrorFromSources("http-error", "X", "m")).toBeInstanceOf(
      MetarSourceError,
    );
    expect(MetarParseError).toBeInstanceOf(Function);
    // 实战形态：用 sources 子路径 import 的类 catch 取数失败
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
    );
    const caught = await getMetars("CN__ASOS").catch((e: unknown) => e);
    expect(caught).toBeInstanceOf(MetarSourceErrorFromSources);
  });
});

// ---------------------------------------------------------------- TAF 取数线（owner 9/24「收进 sources」指令）

describe("awTafUrl（端点模板：内网镜像只换根，路径与查询由本层拼装）", () => {
  it("缺省官方端点：ids 逗号连接 + format=raw；数组与字符串 ids 等价", () => {
    const byArray = awTafUrl(["ZBAA", "ZBAD"]);
    const byString = awTafUrl("ZBAA,ZBAD");
    expect(byArray).toBe(byString);
    const u = new URL(byArray);
    expect(`${u.origin}${u.pathname}`).toBe("https://aviationweather.gov/api/data/taf");
    expect(u.searchParams.get("ids")).toBe("ZBAA,ZBAD");
    expect(u.searchParams.get("format")).toBe("raw");
    expect(u.searchParams.has("date")).toBe(false);
  });

  it("baseUrl 覆盖（内网代理根，如 examples 的 /aw-taf）；date：Date→ISO、字符串原样透传", () => {
    const s = awTafUrl("ZBAA", { baseUrl: "/aw-taf" });
    expect(s.startsWith("/aw-taf?")).toBe(true);
    const iso = awTafUrl("ZBAA", { date: new Date(Date.UTC(2026, 8, 24, 1, 2, 3)) });
    expect(iso).toContain("date=2026-09-24T01%3A02%3A03.000Z"); // ISO 经查询串编码
    const raw = awTafUrl("ZBAA", { date: "202609240000" });
    expect(raw).toContain("date=202609240000");
  });
});

describe("getTafs 取数侧整理（raw 格式续行归并 + 站码提取）与失败面", () => {
  it("续行归并回所属报文；站码剥离 TAF/AMD/COR 电头词；剥不出站码的行 station 为空串", async () => {
    const body = [
      "TAF ZBAA 240000Z 2400/2506 32004MPS 9999 FEW030 TX25/2412Z TN14/2403Z=",
      "      TEMPO 2406/2409 4000 -SHRA=", // 缩进续行 → 并回上一份
      "",
      "TAF AMD ZBAD 240000Z 2400/2506 33003MPS 9999 SCT020=",
      "NOT A TAF REPORT", // 无 4 位站码 → station=""
    ].join("\n");
    vi.stubGlobal("fetch", textFetch(body));
    const rows = await getTafs("ZBAA,ZBAD");
    expect(rows.length).toBe(3);
    expect(rows[0]?.station).toBe("ZBAA");
    expect(rows[0]?.raw).toContain("TEMPO 2406/2409"); // 续行已并回（不再丢在行外）
    expect(rows[1]?.station).toBe("ZBAD"); // TAF AMD 前缀剥除
    expect(rows[2]?.station).toBe("");
  });

  it("date 选项进查询串（上一发布周期回看——examples 报池方案B 的取数面）", async () => {
    const f = textFetch("TAF ZBAA 240000Z 2400/2506 32004MPS 9999=");
    vi.stubGlobal("fetch", f);
    await getTafs(["ZBAA"], { date: new Date(0) });
    expect(String(f.mock.calls[0]?.[0])).toContain("date=1970-01-01");
  });

  it("空文本 → MetarSourceError{code:'empty-data'}（200 + 空体＝ids 写错的典型形态，不静默）", async () => {
    vi.stubGlobal("fetch", textFetch("  \n  "));
    const err = (await errorOf(getTafs("ZZZZ"))) as MetarSourceError;
    expect(err).toBeInstanceOf(MetarSourceError);
    expect(err.code).toBe("empty-data");
  });

  it("非 2xx → MetarSourceError{code:'http-error'}（含状态码）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, text: async () => "" })),
    );
    const err = (await errorOf(getTafs("ZBAA"))) as MetarSourceError;
    expect(err.code).toBe("http-error");
    expect(err.message).toMatch(/503/);
  });

  it("断网 → MetarSourceError{code:'network'}（原始 message 保留在文末）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const err = (await errorOf(getTafs("ZBAA"))) as MetarSourceError;
    expect(err.code).toBe("network");
    expect(err.message).toMatch(/fetch failed/);
  });

  it("timeoutMs 超时中止 → MetarSourceError{code:'timeout', network:'aviationweather'}；外部取消原因透传", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());
    const pending = getTafs("ZBAA", { timeoutMs: 5000 });
    const errP = errorOf(pending);
    await vi.advanceTimersByTimeAsync(5000);
    const err = (await errP) as MetarSourceError;
    expect(err).toBeInstanceOf(MetarSourceError);
    expect(err.code).toBe("timeout");
    expect(err.network).toBe("aviationweather");
  });
});

describe("getTafReports（取数→解析→定位一步到位，契约沿 getMetarReports）", () => {
  const stations = [{ icao: "ZBAA", lat: 40.07, lon: 116.58, name: "北京首都" }];
  const body = [
    "TAF ZBAA 240000Z 2400/2506 32004MPS 9999 FEW030 TN14/2403Z=",
    "TAF ZZZZ 240000Z 2400/2506 32004MPS 9999=", // 站表未命中 → 跳过（端点无坐标可回落）
  ].join("\n");

  it("stations 联表定位与标题；未命中站表跳过", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, text: async () => body })),
    );
    const items = await getTafReports(["ZBAA", "ZZZZ"], { stations });
    expect(items.length).toBe(1);
    expect(items[0]?.report.station).toBe("ZBAA");
    expect(items[0]?.position).toEqual([40.07, 116.58]);
    expect(items[0]?.title).toBe("ZBAA 北京首都");
  });

  it("解析失败：缺省聚合抛 batch-parse-failed；onUnparseable 逐行容错回调", async () => {
    const dirty = "TAF ZBAA 240000Z 2400/2506 32004MPS 9999=\n这是一份坏报文";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, text: async () => dirty })),
    );
    await expect(getTafReports("ZBAA", { stations })).rejects.toThrow(/TAF 解析失败 1 条/);
    const seen: string[] = [];
    const items = await getTafReports("ZBAA", {
      stations,
      onUnparseable: (f) => seen.push(f.code),
    });
    expect(items.length).toBe(1);
    expect(seen).toContain("missing-station");
  });
});

describe("getMetars 换源（baseUrl 覆盖——owner 9/24「内网切换自有数据源」指令）", () => {
  it("baseUrl 生效：请求打到覆盖根，路径与查询串仍由本层拼装", async () => {
    const f = okFetch({
      data: [{ station: "ZGGG", raw: "ZGGG 120000Z 9999 26/22 Q1009", lat: 23.4, lon: 113.5 }],
    });
    vi.stubGlobal("fetch", f);
    await getMetars("CN__ASOS", { baseUrl: "https://iem-mirror.internal" });
    expect(String(f.mock.calls[0]?.[0])).toBe(
      "https://iem-mirror.internal/api/1/currents.json?network=CN__ASOS",
    );
  });
});
