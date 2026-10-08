// AWC IWXXM 备选视图预取管线测试（v0.3 第五期，主示例页弹窗 tab 的数据面）——
// 零网络：fetch 全 mock；响应语料取仓内冻结副本（corpus/iwxxm/awc）拼 WMO collect 包裹，
// 与 AWC 实时流实测形态同构（多站 collect 包裹、同站多时次拼接、内嵌源 TAC 注释）。
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parse, type MetarReport } from "metweave";
import { altRawsFromAwc, awcMetarIwxxmUrl, fetchAwcIwxxm } from "./iwxxm-prefetch";

const awcDir = `${path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../corpus/iwxxm/awc")}/`;
/** 冻结 XML 文档（剥 `<?xml …?>` 声明与首尾空白——collect 拼包与拆分产物均以 <iwxxm:METAR 起、
 *  止于配对闭标签，raw 断言可全等） */
const docOf = (stem: string): string =>
  readFileSync(`${awcDir}${stem}.xml`, "utf8")
    .replace(/^<\?xml[^?]*\?>\s*/, "")
    .trimEnd();
/** 主视图 IR 用冻结 .tac（gen 按内嵌注释抽取的同源产物——保证可解析的站码对齐样本） */
const tacOf = (stem: string): string => readFileSync(`${awcDir}${stem}.tac`, "utf8").trim();

/** 冻结语料（06:00Z）改时次：两处 gml:timePosition 与内嵌 TAC 注释一并替换（时次自洽的合成变体） */
const retime = (doc: string, hhmm: string, ddhhmm: string): string =>
  doc.replaceAll("T06:00:00.000Z", `T${hhmm}:00.000Z`).replaceAll("050600Z", ddhhmm);

/** 根元素 METAR→SPECI（内层无同名标签，首尾各一处替换即变身——用于「SPECI 不入表」样本） */
const asSpeci = (doc: string): string =>
  doc.replace("<iwxxm:METAR ", "<iwxxm:SPECI ").replace("</iwxxm:METAR>", "</iwxxm:SPECI>");

/** AWC 多站批量响应形态：collect 2014 包裹、逐报 meteorologicalInformation（拆分正则无视包裹层级） */
const collect = (docs: readonly string[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?><collect:MeteorologicalBulletin xmlns:collect="http://def.wmo.int/collect/2014">${docs
    .map((d) => `<collect:meteorologicalInformation>${d}</collect:meteorologicalInformation>`)
    .join("")}</collect:MeteorologicalBulletin>`;

const textFetch = (body: string) =>
  vi.fn(async (_url: string) => ({ ok: true, status: 200, text: async () => body }));

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

/** 捕获失败实体（供重试穷尽后的断言，不让测试因未处理拒绝而炸） */
const errorOf = async (p: Promise<unknown>): Promise<unknown> => p.catch((e: unknown) => e);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("awcMetarIwxxmUrl（批量端点模板）", () => {
  it("缺省走 /aw-metar 代理根，ids 逗号站单 + format=iwxxm + hours 回看窗（与 vite.config.ts 的代理键对齐——漂移即红）", () => {
    expect(awcMetarIwxxmUrl(["ZBAA", "ZSPD"])).toBe(
      "/aw-metar?ids=ZBAA%2CZSPD&format=iwxxm&hours=3",
    );
  });

  it("hours 与 baseUrl 可覆盖（自建镜像只换根，查询串仍由本层拼装）", () => {
    expect(awcMetarIwxxmUrl(["ZBAA"], { hours: 6, baseUrl: "/my-mirror" })).toBe(
      "/my-mirror?ids=ZBAA&format=iwxxm&hours=6",
    );
  });
});

describe("fetchAwcIwxxm（批量拆分与 Map 产出）", () => {
  it("collect 包裹多站响应：单次批量请求、逐站入 Map、IR 站码与 raw 逐字保真（弹窗 RAW 视图即显示该 XML）", async () => {
    const zb = docOf("ZBAA-050600Z");
    const zs = docOf("ZSPD-050600Z");
    const fetchMock = textFetch(collect([zb, zs]));
    vi.stubGlobal("fetch", fetchMock);
    const map = await fetchAwcIwxxm(["ZBAA", "ZSPD"]);
    expect(fetchMock).toHaveBeenCalledTimes(1); // 单请求批量（并发纪律：一次拿全）
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("ids=ZBAA%2CZSPD");
    // 展开即新建副本，sort 变异无外溢（examples lib ES2022 无 toSorted）
    // oxlint-disable-next-line unicorn/no-array-sort
    expect([...map.keys()].sort()).toEqual(["ZBAA", "ZSPD"]);
    expect(map.get("ZBAA")?.station).toBe("ZBAA");
    expect(map.get("ZSPD")?.station).toBe("ZSPD");
    expect(map.get("ZBAA")?.raw).toBe(zb); // 拆分产物原文＝parseIwxxm 的 raw 契约
    expect(map.get("ZBAA")?.time).toEqual({ day: 5, hour: 6, minute: 0 });
  });

  it("同站多时次取窗内最新（最新在前——AWC 实测顺序；按 gml:timePosition 择优，不依赖响应顺序、非 last-wins）", async () => {
    const zb = docOf("ZBAA-050600Z");
    const newer = retime(zb, "07:30", "050730Z");
    vi.stubGlobal("fetch", textFetch(collect([newer, zb])));
    const map = await fetchAwcIwxxm(["ZBAA"]);
    expect(map.size).toBe(1);
    expect(map.get("ZBAA")?.time).toEqual({ day: 5, hour: 7, minute: 30 });
    expect(map.get("ZBAA")?.raw).toBe(newer);
  });

  it("SPECI 文档不入表（特殊观测非卡片主视图的同一观测，时次再新也不顶掉 METAR）", async () => {
    const zb = docOf("ZBAA-050600Z");
    const metar = retime(zb, "07:30", "050730Z");
    const speci = asSpeci(retime(zb, "08:00", "050800Z")); // 比 METAR 更新的 SPECI
    vi.stubGlobal("fetch", textFetch(collect([metar, speci])));
    const map = await fetchAwcIwxxm(["ZBAA"]);
    expect(map.get("ZBAA")?.time).toEqual({ day: 5, hour: 7, minute: 30 });
  });

  it("单份站码缺失/解析失败跳过，不拖垮整批（该站无备选视图＝自然降级）", async () => {
    const zb = docOf("ZBAA-050600Z");
    const zs = docOf("ZSPD-050600Z");
    // 有站码但无 IWXXM 命名空间声明 → parseIwxxm invalid-input；无站码 → 拆分后站码层即跳过
    const noNs =
      "<iwxxm:METAR><aixm:locationIndicatorICAO>ZTST</aixm:locationIndicatorICAO><gml:timePosition>2026-10-05T09:00:00.000Z</gml:timePosition></iwxxm:METAR>";
    const noStation = '<iwxxm:METAR xmlns:iwxxm="http://icao.int/iwxxm/2025-2"></iwxxm:METAR>';
    vi.stubGlobal("fetch", textFetch(collect([zb, zs, noNs, noStation])));
    const map = await fetchAwcIwxxm(["ZBAA", "ZSPD", "ZTST"]);
    // 展开即新建副本，sort 变异无外溢（examples lib ES2022 无 toSorted）
    // oxlint-disable-next-line unicorn/no-array-sort
    expect([...map.keys()].sort()).toEqual(["ZBAA", "ZSPD"]);
  });

  it("网络失败重试 3 次后抛末次错误（不吞错——静默降级由调用方定）", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetchMock);
    const errP = errorOf(fetchAwcIwxxm(["ZBAA"], { timeoutMs: 1000 }));
    await vi.advanceTimersByTimeAsync(10_000); // 覆盖 3 次尝试 + 500/1000ms 退避
    const err = await errP;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(err).toBeInstanceOf(Error);
  });

  it("HTTP 非 ok 同族重试后抛（带状态码）", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => ({ ok: false, status: 503, text: async () => "" }));
    vi.stubGlobal("fetch", fetchMock);
    const errP = errorOf(fetchAwcIwxxm(["ZBAA"], { timeoutMs: 1000 }));
    await vi.advanceTimersByTimeAsync(10_000);
    const err = await errP;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("HTTP 503");
  });

  it("单次超时中止同样计入重试（挂死上游不死等：3 次尝试后失败）", async () => {
    vi.useFakeTimers();
    const fetchMock = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    const errP = errorOf(fetchAwcIwxxm(["ZBAA"], { timeoutMs: 1000 }));
    await vi.advanceTimersByTimeAsync(10_000);
    const err = await errP;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(err).toBeTruthy(); // 中止原因透传（AbortController 默认 reason）
  });
});

describe("altRawsFromAwc（弹窗备选视图查表）", () => {
  it("Map 有本站 → 单表项：label 标 AWC 来源、report 即 Map 值同一引用（RAW 视图由其 raw/span 驱动）", async () => {
    const zb = docOf("ZBAA-050600Z");
    vi.stubGlobal("fetch", textFetch(collect([zb])));
    const map = await fetchAwcIwxxm(["ZBAA"]);
    const alt = map.get("ZBAA");
    if (alt === undefined) throw new Error("预取产物缺 ZBAA");
    const main = parse(tacOf("ZBAA-050600Z")); // 主视图＝IEM TAC 侧 IR（站码对齐即可）
    const entries = altRawsFromAwc(map)(main);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.label).toBe("IWXXM（AWC）");
    expect(entries[0]?.report).toBe(alt);
  });

  it("Map 无本站 → 空数组＝无 tab（预取未到/失败/该站缺数的降级形态）", () => {
    const main = parse(tacOf("ZBAA-050600Z"));
    expect(altRawsFromAwc(new Map<string, MetarReport>())(main)).toEqual([]);
    const other = parse(tacOf("ZSPD-050600Z")); // 他站命中不算（查表键＝本卡站码）
    const map = new Map([[other.station, other]]);
    expect(altRawsFromAwc(map)(main)).toEqual([]);
  });

  it("活引用契约：空 Map 建函数、后填充 → 同一函数现查得 tab（预取后到时，时区切换/模式回切重建实况层即生效）", () => {
    const map = new Map<string, MetarReport>();
    const altRaws = altRawsFromAwc(map);
    const main = parse(tacOf("ZBAA-050600Z"));
    expect(altRaws(main)).toEqual([]);
    map.set(main.station, main); // 原地填充（main.ts 接线形态：clear+set 同一 Map）
    expect(altRaws(main)).toHaveLength(1);
  });
});
