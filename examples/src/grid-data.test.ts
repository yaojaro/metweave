/**
 * 格点 demo 数据面测试（零网络：fetch 全 mock，仓内冻结语料直接读文件）：
 * 三层语义装载（gen 产物＞冻结基线＞报错）、URL/缓存戳、冻结基线拼装（真实 corpus 字节）、
 * 拉最新客户端与中间件探测、切换器纯逻辑。渲染像素正确性由 @metweave/grid 的
 * core.test.ts 快照锁死，此处只锁数据链。
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { serializeGrid, buildColorScale, renderToImageData } from "@metweave/grid";
import {
  GRID_ELEMENTS,
  fhourFile,
  buildFallbackGrid,
  genGridUrl,
  loadGridElement,
  probeGenGridApi,
  pullLatestElement,
  resolveInitialElement,
} from "./grid-data";
import { tmpProfile } from "@metweave/grid";

const here = dirname(fileURLToPath(import.meta.url));
const corpusF32 = (): ArrayBuffer => {
  const raw = readFileSync(join(here, "..", "..", "corpus", "grid", "gfs-tmp-2m-cn.f32"));
  return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
};

/** 最小合法 .mwgrid（2×2）：gen 产物路径的成功响应体 */
const tinyMwgrid = (): Uint8Array =>
  serializeGrid(
    {
      version: 1,
      variable: "TMP",
      level: "2m",
      unit: "K",
      grid: { nx: 2, ny: 2, la0: 40, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
      stats: { min: 0, max: 1, p10: 0, p25: 0, p50: 0, p75: 1, p90: 1, p99: 1 },
      meta: {
        referenceTime: "2026-10-06T06:00Z",
        forecastHour: 0,
        source: "GFS test",
        license: "",
        generated: "2026-10-06",
      },
    },
    [270, 280, 290, 300],
  );

const okBuf = (bytes: Uint8Array) => ({
  ok: true,
  status: 200,
  arrayBuffer: async () => {
    // 拷贝到独立 ArrayBuffer（不经 slice：视图 buffer 是 ArrayBufferLike，收窄要断言——拷贝零断言）
    const out = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(out).set(bytes);
    return out;
  },
});
const notFound = { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };

describe("loadGridElement（三层语义）", () => {
  it("gen 产物 200 → 解析容器、source=gen、URL 走 /grid/<file>", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toBe("/grid/tmp_cn.mwgrid");
      return okBuf(tinyMwgrid());
    });
    const loaded = await loadGridElement(GRID_ELEMENTS[0]!, { fetchImpl });
    expect(loaded.source).toBe("gen");
    expect(loaded.grid.header.variable).toBe("TMP");
    expect(loaded.grid.values).toHaveLength(4);
  });

  it("缓存戳透传（拉最新后绕 304）", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toBe("/grid/tmp_cn.mwgrid?v=1696627200000");
      return okBuf(tinyMwgrid());
    });
    await loadGridElement(GRID_ELEMENTS[0]!, { bust: "1696627200000", fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("gen 产物 404 → 前端拼装仓内冻结基线（真实 corpus 字节），source=baseline", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.startsWith("/grid/")) return notFound;
      expect(url.length).toBeGreaterThan(0); // ?url 资产路径由构建器给定
      return okBuf(new Uint8Array(corpusF32()));
    });
    const loaded = await loadGridElement(GRID_ELEMENTS[0]!, { fetchImpl });
    expect(loaded.source).toBe("baseline");
    const h = loaded.grid.header;
    expect(h.grid.nx).toBe(280);
    expect(h.grid.ny).toBe(208);
    expect(h.grid.la0).toBeCloseTo(55, 10);
    expect(h.grid.lo0).toBeCloseTo(70, 10);
    expect(h.unit).toBe("K");
    expect(h.stats.min).toBeCloseTo(264.27, 1); // 10 月中国域实测值域（冻结份）
    expect(h.stats.max).toBeCloseTo(311.87, 1);
    expect(h.meta.source).toContain("冻结基线");
  });

  it("gen 产物损坏（魔数错）→ 同样落到冻结基线（不因坏产物白屏）", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.startsWith("/grid/")
        ? okBuf(new Uint8Array([1, 2, 3]))
        : okBuf(new Uint8Array(corpusF32())),
    );
    const loaded = await loadGridElement(GRID_ELEMENTS[0]!, { fetchImpl });
    expect(loaded.source).toBe("baseline");
  });

  it("两层穷尽 → 抛最后错误（含两层原因）", async () => {
    const fetchImpl = vi.fn(async () => notFound);
    await expect(loadGridElement(GRID_ELEMENTS[0]!, { fetchImpl })).rejects.toThrow(
      /装载 tmp 失败（HTTP 404；冻结基线也失败：HTTP 404）/,
    );
  });
});

describe("buildFallbackGrid（冻结基线拼装）", () => {
  it("big-endian f32 → Float32Array 与 stats 现算（与容器头同构）", () => {
    const grid = buildFallbackGrid(corpusF32());
    expect(grid.values).toHaveLength(280 * 208);
    let min = Number.POSITIVE_INFINITY;
    for (const v of grid.values) if (v < min) min = v;
    expect(min).toBeCloseTo(264.27, 1);
    expect(grid.header.stats.min).toBeCloseTo(min, 6);
  });

  it("字节数与声明网格不符 → 显式报错", () => {
    expect(() => buildFallbackGrid(new ArrayBuffer(8))).toThrow(/字节数不符/);
  });
});

describe("冻结基线渲染链（demo 级像素快照锁）", () => {
  it("拼装 Grid × tmp 档案缺省档 × renderToImageData 像素 sha 快照", () => {
    const grid = buildFallbackGrid(corpusF32());
    const scale = buildColorScale(tmpProfile, grid.header.stats);
    const img = renderToImageData(grid, scale, {
      convert: tmpProfile.toDisplay,
      width: 280,
      opacity: 0.85,
    });
    expect(img.width).toBe(280);
    expect(img.height).toBe(208);
    const sha = createHash("sha256").update(img.data).digest("hex");
    // 与 @metweave/grid 侧快照互证：同一数据同一档案同一档位，两处 sha 必须一致
    expect(sha).toMatchInlineSnapshot(
      `"9c08011f9c7d1fcc58a2e4cf13e5c83f18aa458a6f3840772b1856faa1790098"`,
    );
  });
});

/** 双分量容器的头模板（2×2，wind 装载测试用；variable 按分量注入）。 */
const tinyWindHeader = (variable: string) =>
  ({
    version: 1,
    variable,
    level: "10m",
    unit: "m s-1",
    grid: { nx: 2, ny: 2, la0: 40, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
    stats: { min: 0, max: 3, p10: 0, p25: 0, p50: 0, p75: 3, p90: 3, p99: 3 },
    meta: {
      referenceTime: "2026-10-06T18:00Z",
      forecastHour: 0,
      source: "GFS test",
      license: "",
      generated: "2026-10-07",
    },
  }) as const;

/** 2×2 u/v 成对容器：u=[3,0,0,3]、v=[0,3,0,0] → 合成风速 [3,3,0,3]。 */
const tinyWindU = (): Uint8Array => serializeGrid(tinyWindHeader("UGRD"), [3, 0, 0, 3]);
const tinyWindV = (): Uint8Array => serializeGrid(tinyWindHeader("VGRD"), [0, 3, 0, 0]);

describe("双分量装载（wind——一个面板要素位 ↔ 两个数据文件）", () => {
  it("清单含 wind 位：file＝u 分量、companionFile＝v 分量（gen CLI 双文件条目）", () => {
    const wind = GRID_ELEMENTS.find((s) => s.profile.shortName === "wind");
    expect(wind).toBeDefined();
    expect(wind?.file).toBe("windu_cn.mwgrid");
    expect(wind?.companionFile).toBe("windv_cn.mwgrid");
  });

  it("两份都齐：并行拉取双文件 → 主场＝派生合成场（variable WIND/stats 现算）、分量原值留在 components", async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(url);
      if (url === "/grid/windu_cn.mwgrid") return okBuf(tinyWindU());
      return okBuf(tinyWindV());
    });
    const wind = GRID_ELEMENTS.find((s) => s.profile.shortName === "wind")!;
    const loaded = await loadGridElement(wind, { fetchImpl });
    expect(loaded.source).toBe("gen");
    expect(urls).toEqual(["/grid/windu_cn.mwgrid", "/grid/windv_cn.mwgrid"]);
    // 主场＝合成场（色斑/图例/meta 直读合成口径）
    expect(loaded.grid.header.variable).toBe("WIND");
    expect(loaded.grid.header.stats.min).toBeCloseTo(0, 6);
    expect(loaded.grid.header.stats.max).toBeCloseTo(3, 6);
    expect([...loaded.grid.values].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([3, 3, 0, 3]);
    // 分量原值在（风向杆层的原料——存储不动）
    expect(loaded.components?.u.header.variable).toBe("UGRD");
    expect(loaded.components?.v.header.variable).toBe("VGRD");
    expect([...(loaded.components?.u.values ?? [])]).toEqual([3, 0, 0, 3]);
  });

  it("伴生分量失败 → 装载失败（两份都齐才算成功，报错含分量原因）", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url === "/grid/windu_cn.mwgrid" ? okBuf(tinyWindU()) : notFound,
    );
    const wind = GRID_ELEMENTS.find((s) => s.profile.shortName === "wind")!;
    await expect(loadGridElement(wind, { fetchImpl })).rejects.toThrow(
      /装载 wind 失败（双分量须两份都齐：windv_cn\.mwgrid HTTP 404）/,
    );
  });

  it("缓存戳透传到两份文件（拉最新后双文件同步绕缓存）", async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(url);
      return okBuf(url.includes("windu") ? tinyWindU() : tinyWindV());
    });
    const wind = GRID_ELEMENTS.find((s) => s.profile.shortName === "wind")!;
    await loadGridElement(wind, { bust: "1696627200000", fetchImpl });
    expect(urls).toEqual([
      "/grid/windu_cn.mwgrid?v=1696627200000",
      "/grid/windv_cn.mwgrid?v=1696627200000",
    ]);
  });

  it("双分量要素无冻结基线路径：主伴生双 404 直接报错（不落单场基线拼装）", async () => {
    const fetchImpl = vi.fn(async () => notFound);
    const wind = GRID_ELEMENTS.find((s) => s.profile.shortName === "wind")!;
    await expect(loadGridElement(wind, { fetchImpl })).rejects.toThrow(/双分量须两份都齐/);
  });
});

describe("拉最新客户端", () => {
  it("成功：调 /api/gen-grid?element=tmp 且 ok:true 转达", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toBe("/api/gen-grid?element=tmp&fhour=0"); // fhour 恒显式（缺省 0）
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    });
    expect(await pullLatestElement("tmp", 0, fetchImpl)).toEqual({
      ok: true,
      message: "已取到最新场",
    });
  });

  it("进行中 409：error 文案透传（不抛——旧数据保留由调用方）", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ ok: false, error: "上一次拉取仍在进行中（稍候再试）" }),
    }));
    const r = await pullLatestElement("tmp", 0, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("进行中");
  });

  it("网络失败：转 message 不抛", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("boom");
    });
    expect(await pullLatestElement("tmp", 0, fetchImpl)).toEqual({ ok: false, message: "boom" });
  });

  it("探测：中间件在位（缺参 400）→ true；静态部署 404 → false；网络错 → false", async () => {
    const present = vi.fn(async () => ({ ok: false, status: 400 }));
    expect(await probeGenGridApi(present as unknown as typeof fetch)).toBe(true);
    const absent = vi.fn(async () => ({ ok: false, status: 404 }));
    expect(await probeGenGridApi(absent as unknown as typeof fetch)).toBe(false);
    const broken = vi.fn(async () => {
      throw new Error("net");
    });
    expect(await probeGenGridApi(broken as unknown as typeof fetch)).toBe(false);
  });
});

describe("切换器纯逻辑", () => {
  it("?element=tmp 直达命中；缺席 → 首项；未知 → 首项＋未命中标记", () => {
    const [hit, ok1] = resolveInitialElement("?element=tmp", GRID_ELEMENTS);
    expect(hit.profile.shortName).toBe("tmp");
    expect(ok1).toBe(true);
    const [def, ok2] = resolveInitialElement("", GRID_ELEMENTS);
    expect(def.profile.shortName).toBe("tmp");
    expect(ok2).toBe(true); // 无参数＝正常缺省，不是错误
    const [fb, ok3] = resolveInitialElement("?element=notanelement", GRID_ELEMENTS);
    expect(fb.profile.shortName).toBe("tmp");
    expect(ok3).toBe(false); // 未知要素：回落首项，页面提示
  });

  it("genGridUrl：文件名拼装与缓存戳编码", () => {
    expect(genGridUrl(GRID_ELEMENTS[0]!)).toBe("/grid/tmp_cn.mwgrid");
    expect(genGridUrl(GRID_ELEMENTS[0]!, "1696627200000")).toBe(
      "/grid/tmp_cn.mwgrid?v=1696627200000",
    );
  });
});

// ---------------------------------------------------------------- 预报时效维度

/** 时效产物工厂：tiny 场带指定 forecastHour/referenceTime（时效装载用例）。 */
const tinyFhourMwgrid = (fhour: number, referenceTime: string): Uint8Array =>
  serializeGrid(
    {
      version: 1,
      variable: "TMP",
      level: "2m",
      unit: "K",
      grid: { nx: 2, ny: 2, la0: 40, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
      stats: { min: 0, max: 1, p10: 0, p25: 0, p50: 0, p75: 1, p90: 1, p99: 1 },
      meta: {
        referenceTime,
        forecastHour: fhour,
        source: `GFS 0.25° f${String(fhour).padStart(3, "0")} cycle test`,
        license: "",
        generated: "2026-10-07",
      },
    },
    new Float32Array(4),
  );

describe("预报时效维度（fhourFile / loadGridElement / pullLatestElement）", () => {
  const tmpSpec = GRID_ELEMENTS[0]!;

  it("fhourFile：f000 沿用原名（基线/demo 链路兼容）、f>0 插段 _fHHH（含风分量名）", () => {
    expect(fhourFile("tmp_cn.mwgrid", 0)).toBe("tmp_cn.mwgrid");
    expect(fhourFile("tmp_cn.mwgrid", 6)).toBe("tmp_f006_cn.mwgrid");
    expect(fhourFile("tmp_cn.mwgrid", 72)).toBe("tmp_f072_cn.mwgrid");
    expect(fhourFile("windu_cn.mwgrid", 12)).toBe("windu_f012_cn.mwgrid");
  });

  it("loadGridElement fhour=6：取 _f006 产物文件且容器头 forecastHour 直读", async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(url);
      if (url.includes("tmp_f006_cn.mwgrid"))
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => tinyFhourMwgrid(6, "2026-10-07T06:00Z"),
        };
      return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
    });
    const loaded = await loadGridElement(tmpSpec, { fhour: 6, fetchImpl: fetchImpl as never });
    expect(loaded.source).toBe("gen");
    expect(loaded.grid.header.meta.forecastHour).toBe(6);
    expect(urls).toEqual(["/grid/tmp_f006_cn.mwgrid"]);
  });

  it("loadGridElement f>0 失败不落冻结基线（f000 语料不得静默换档——诚实报错含拉最新指引）", async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(url);
      return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
    });
    await expect(loadGridElement(tmpSpec, { fhour: 6, fetchImpl })).rejects.toThrow(/f06.*拉最新/);
    expect(urls).toEqual(["/grid/tmp_f006_cn.mwgrid"]); // 只试时效产物，不回退 f000
  });

  it("pullLatestElement：fhour 串接（auto 直传/数值收敛）与应答回带 fhour 透出", async () => {
    const f1 = vi.fn(async (url: string) => {
      expect(url).toBe("/api/gen-grid?element=tmp&fhour=auto");
      return { ok: true, status: 200, json: async () => ({ ok: true, fhour: 7 }) };
    });
    expect(await pullLatestElement("tmp", "auto", f1)).toEqual({
      ok: true,
      message: "已取到最新场",
      fhour: 7,
    });
    const f2 = vi.fn(async (url: string) => {
      expect(url).toBe("/api/gen-grid?element=tmp&fhour=6"); // 5.5 收敛到 6
      return { ok: true, status: 200, json: async () => ({ ok: true, fhour: 6 }) };
    });
    expect(await pullLatestElement("tmp", 5.5, f2)).toEqual({
      ok: true,
      message: "已取到最新场",
      fhour: 6,
    });
  });
});
