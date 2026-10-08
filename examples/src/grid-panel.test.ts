// @vitest-environment happy-dom
/**
 * 主示例页「格点图层」控制面板测试（原独立演示页主流程测试的家——页面并入首页后的
 * 图层化集成面）：纯逻辑（滑杆解析/时次溯源行/图例刻度抽样）＋ happy-dom 装配面
 * （开关显隐与缓存复用、滑杆 setOpacity 原地调、拉最新三路、错误+重试、?element 直达、
 * index.html 接线 id 齐）。零网络零进程：fetch 全 mock，Canvas 2D patch 假件——像素
 * 正确性由 @metweave/grid 的快照锁负责，此处只锁面板行为。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as L from "leaflet";
import { serializeGrid, type Grid, type GridHeader } from "@metweave/grid";
import {
  GRID_OPACITY_DEFAULT,
  GRID_OPACITY_MAX,
  GRID_OPACITY_MIN,
  GRID_OPACITY_STEP,
  buildGridLegend,
  gridMetaLine,
  legendTickLayout,
  legendTickValues,
  mountGridLayerPanel,
  parseOpacityInput,
  GRID_FHOUR_MAX,
  autoTrackFhour,
} from "./grid-panel";
import { GRID_ELEMENTS, buildFallbackGrid, type LoadedGrid } from "./grid-data";

const here = dirname(fileURLToPath(import.meta.url));
const corpusF32 = (): Uint8Array =>
  new Uint8Array(readFileSync(join(here, "..", "..", "corpus", "grid", "gfs-tmp-2m-cn.f32")));

/** 最小合法 .mwgrid（2×2）：拉最新后重取路径的成功响应体 */
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
    const out = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(out).set(bytes);
    return out;
  },
});
const notFound = { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };

// ---------------------------------------------------------------- 纯逻辑

describe("parseOpacityInput（滑杆值解析）", () => {
  it("合法值直收；缺省 0.6 与 addGridLayer 的 API 缺省一致；滑杆域 [0.2, 0.9]", () => {
    expect(GRID_OPACITY_DEFAULT).toBe(0.6);
    expect(GRID_OPACITY_MIN).toBe(0.2);
    expect(GRID_OPACITY_MAX).toBe(0.9);
    expect(parseOpacityInput("0.6")).toBe(0.6);
    expect(parseOpacityInput("0.85")).toBe(0.85);
  });

  it("越界收敛、非法回落缺省", () => {
    expect(parseOpacityInput("0.05")).toBe(GRID_OPACITY_MIN);
    expect(parseOpacityInput("2")).toBe(GRID_OPACITY_MAX);
    expect(parseOpacityInput("")).toBe(GRID_OPACITY_DEFAULT);
    expect(parseOpacityInput("abc")).toBe(GRID_OPACITY_DEFAULT);
  });
});

describe("gridMetaLine / legendTickValues / buildGridLegend", () => {
  const spec = GRID_ELEMENTS[0]!;
  const loaded: LoadedGrid = { grid: buildFallbackGrid(corpusF32()), source: "gen" };

  it("时次/溯源行直读容器头 meta；非 gen 来源追加「非最新」标注", () => {
    expect(gridMetaLine(spec, loaded)).toContain("起报 2026-10-04T06:00Z");
    expect(gridMetaLine(spec, loaded)).toContain("f00");
    expect(gridMetaLine(spec, loaded)).not.toContain("非最新");
    expect(gridMetaLine(spec, { ...loaded, source: "baseline" })).toContain(
      "仓内冻结基线（非最新）",
    );
  });

  it("图例刻度＝域端点＋断点抽样（断点显示单位直读不换算——tmp 等距档即 °C 域），首末恒保留", () => {
    const ticks = legendTickValues(spec, loaded.grid.header.stats);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks.length).toBeLessThanOrEqual(10);
    expect(ticks[0]).toBe(-40); // tmp 档案等距域端点（°C，非 K）
    expect(ticks[ticks.length - 1]).toBe(40);
    expect(ticks).not.toContain(233.15); // 若误把 K 域当显示域即红
  });

  it("阈值档图例：刻度＝场最小值＋阈值本身（值少全标；无上缘、透明首档不标）", () => {
    // cape_cn.mwgrid 容器头实测 stats（0–3026、p50=1——零值堆），刻度恰为 0/1000/2500/4000
    const cape = GRID_ELEMENTS.find((s) => s.profile.shortName === "cape")!;
    const ticks = legendTickValues(cape, {
      min: 0,
      max: 3026,
      p10: 0,
      p25: 0,
      p50: 1,
      p75: 536,
      p90: 1128,
      p99: 1597,
    });
    expect(ticks).toEqual([0, 1000, 2500, 4000]); // 4 值全标（step=1），末档外延无上缘
  });

  it("log₁₀ 要素图例：刻度显示线性阈值原值（0.1/1/5/10，不出现对数断点 −1/0/0.7/1）", () => {
    // prate_cn.mwgrid 容器头实测 stats（2026-10-06T18Z f000：p50=0 零值堆 74%、max 14.1 mm/h）
    const prate = GRID_ELEMENTS.find((s) => s.profile.shortName === "prate")!;
    expect(prate).toBeDefined();
    const prateStats = {
      min: 0,
      max: 0.0039264000952243805,
      p10: 0,
      p25: 0,
      p50: 0,
      p75: 8.000000093488779e-7,
      p90: 0.00005279999822960235,
      p99: 0.0006504000048153102,
    };
    const ticks = legendTickValues(prate, prateStats);
    expect(ticks).toEqual([0, 0.1, 1, 5, 10]); // 场最小值（0，透明首档起点）＋线性阈值原值
    // 图例 DOM 刻度文本：0.1 保留一位小数不被取整吞位（与 0 重复即错档）
    const prateGrid: Grid = {
      header: {
        version: 1,
        variable: "PRATE",
        level: "sfc",
        unit: "kg m-2 s-1",
        grid: { nx: 2, ny: 2, la0: 40, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
        stats: prateStats,
        meta: {
          referenceTime: "2026-10-06T18:00Z",
          forecastHour: 0,
          source: "test",
          license: "",
          generated: "2026-10-07",
        },
      },
      values: new Float32Array(4),
    };
    const node = buildGridLegend(prate, { grid: prateGrid, source: "gen" });
    const texts = Array.from(node.querySelectorAll(".mw-grid-legend-ticks span")).map(
      (s) => s.textContent,
    );
    expect(texts).toEqual(["0", "0.1", "1", "5", "10"]);
    expect(node.querySelector(".mw-grid-legend-unit")?.textContent).toBe("mm/h");
  });

  it("满量程哨兵末档注记：vis 刻度 0/0.4/0.8/1.5/3/5/10 之外末缘渲染注记，既有要素零漂移", () => {
    // vis_cn.mwgrid 容器头实测 stats（2026-10-06T18Z f000：22.47 m–24134.87 m，
    // p25 起饱和在满量程哨兵 24.13 km——「≥24.1 km」语义）
    const vis = GRID_ELEMENTS.find((s) => s.profile.shortName === "vis")!;
    expect(vis).toBeDefined();
    const visStats = {
      min: 22.470609664916992,
      max: 24134.87109375,
      p10: 22970.0703125,
      p25: 24134.87109375,
      p50: 24134.87109375,
      p75: 24134.87109375,
      p90: 24134.87109375,
      p99: 24134.87109375,
    };
    // 刻度＝场最小值（0.02 km，一位小数显 0）＋航空阈值原值；满量程 24.13 不进刻度序列
    // （末档 [10,∞) 外延无上缘——注记是语义位，不是数值位）
    expect(legendTickValues(vis, visStats)).toEqual([
      0.022470609664916992, 0.4, 0.8, 1.5, 3, 5, 10,
    ]);
    const visGrid: Grid = {
      header: {
        version: 1,
        variable: "VIS",
        level: "sfc",
        unit: "m",
        grid: { nx: 2, ny: 2, la0: 40, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
        stats: visStats,
        meta: {
          referenceTime: "2026-10-06T18:00Z",
          forecastHour: 0,
          source: "test",
          license: "",
          generated: "2026-10-07",
        },
      },
      values: new Float32Array(4),
    };
    const node = buildGridLegend(vis, { grid: visGrid, source: "gen" });
    const tickTexts = Array.from(
      node.querySelectorAll(".mw-grid-legend-ticks span:not(.mw-grid-legend-note)"),
    ).map((s) => s.textContent);
    expect(tickTexts).toEqual(["0", "0.4", "0.8", "1.5", "3", "5", "10"]);
    expect(node.querySelector(".mw-grid-legend-note")?.textContent).toBe("≥24.1（满量程）");
    expect(node.querySelector(".mw-grid-legend-unit")?.textContent).toBe("km");
    // 零漂移：无 topBinNote 的既有要素（prate）图例不出现注记节点
    const prate = GRID_ELEMENTS.find((s) => s.profile.shortName === "prate")!;
    const prateGrid: Grid = {
      ...visGrid,
      header: {
        ...visGrid.header,
        variable: "PRATE",
        level: "sfc",
        unit: "kg m-2 s-1",
      },
    };
    expect(
      buildGridLegend(prate, { grid: prateGrid, source: "gen" }).querySelector(
        ".mw-grid-legend-note",
      ),
    ).toBeNull();
  });

  it("图例 DOM：渐变条（档案 colorStops 单源）＋刻度 span＋单位", () => {
    const node = buildGridLegend(spec, loaded);
    const bar = node.querySelector<HTMLElement>(".mw-grid-legend-bar");
    expect(bar?.style.background).toContain("linear-gradient(90deg");
    const ticks = node.querySelectorAll(".mw-grid-legend-ticks span");
    expect(ticks.length).toBe(legendTickValues(spec, loaded.grid.header.stats).length);
    expect(node.querySelector(".mw-grid-legend-unit")?.textContent).toBe("°C");
  });
});

// ---------------------------------------------------------------- happy-dom 装配面

/** 「拉最新」中间件客户端两路应答体（成功/失败——模块级零捕获件） */
const apiOk = async (): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> => ({
  ok: true,
  status: 200,
  json: async () => ({ ok: true }),
});
const apiFail = async (): Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}> => ({
  ok: false,
  status: 500,
  json: async () => ({ ok: false, error: "gen-grid 退出码 1" }),
});

/** 8×8 prmsl 坑场（Pa，切比雪夫定价 2 hPa/格 → 显示 1000–1008 hPa）：等值线层装配用。 */
const tinyPrmslMwgrid = (): Uint8Array => {
  const nx = 8;
  const ny = 8;
  const values: number[] = [];
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      values.push((1000 + Math.max(Math.abs(y - 4), Math.abs(x - 4)) * 2) * 100);
    }
  }
  return serializeGrid(
    {
      version: 1,
      variable: "PRMSL",
      level: "msl",
      unit: "Pa",
      grid: { nx, ny, la0: 44, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
      stats: {
        min: 100000,
        max: 100800,
        p10: 100200,
        p25: 100200,
        p50: 100400,
        p75: 100600,
        p90: 100600,
        p99: 100800,
      },
      meta: {
        referenceTime: "2026-10-06T18:00Z",
        forecastHour: 0,
        source: "GFS test",
        license: "",
        generated: "2026-10-07",
      },
    },
    values,
  );
};

/** happy-dom 无位图后端：patch canvas 原型走通 addGridLayer 位图段（像素不经过此处） */
const installFakeCanvas = (): (() => void) => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  const origGetContext = proto.getContext;
  const origToDataURL = proto.toDataURL;
  proto.getContext = () => ({
    createImageData: (w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    }),
    putImageData: () => {},
  });
  proto.toDataURL = () => "data:image/png;base64,ZmFrZQ==";
  return () => {
    proto.getContext = origGetContext;
    proto.toDataURL = origToDataURL;
  };
};

/** 面板 DOM 夹具（与 index.html 的抽屉结构同构；接线 id 由文末契约测试锁齐） */
const mountFixture = (): void => {
  document.body.innerHTML = `
    <div id="map" style="width: 800px; height: 600px"></div>
    <div id="top-right">
      <button type="button" id="mode-grid" class="mode-btn" aria-pressed="false">格点图层</button>
    </div>
    <aside id="grid-panel" aria-label="格点图层控制" hidden>
      <div class="gd-head">
        <div class="gd-title-row">
          <h3>格点图层</h3>
          <button type="button" id="grid-close" aria-label="收起抽屉">×</button>
        </div>
        <div class="gd-ctl-row">
          <button id="grid-pull" type="button" hidden>拉最新</button>
          <span>预报时效</span>
          <span class="gd-fhour">
            <button type="button" id="grid-fhour-prev" aria-label="上一时次">◀</button>
            <button type="button" id="grid-fhour" aria-pressed="true">自动</button>
            <button type="button" id="grid-fhour-next" aria-label="下一时次">▶</button>
          </span>
          <label for="grid-opacity">不透明度</label>
          <input id="grid-opacity" type="range" min="0.2" max="0.9" step="0.05" value="0.6" />
          <span id="grid-opacity-value">60%</span>
        </div>
        <p id="grid-meta" role="status" aria-live="polite"></p>
      </div>
      <nav id="grid-elements" aria-label="格点要素"></nav>
    </aside>`;
};

const restoreFns: (() => void)[] = [];
afterEach(() => {
  for (const fn of restoreFns.splice(0)) fn();
});

/** 起一套真实 Leaflet 地图＋挂载面板；fetchImpl 决定数据面（零网络） */
const boot = async (fetchImpl: (url: string) => Promise<unknown>): Promise<L.Map> => {
  restoreFns.push(installFakeCanvas());
  mountFixture();
  const map = L.map("map", { center: [35, 105], zoom: 4 });
  restoreFns.push(() => map.remove());
  mountGridLayerPanel(map, {
    search: "",
    fetchImpl: fetchImpl as never,
  });
  return map;
};

const meta = (): string => document.getElementById("grid-meta")?.textContent ?? "";
/** 选中行展开体的数据源行（成功态溯源信息的所在——头部状态行成功态已去重隐藏） */
const srcLine = (): string =>
  document.querySelector(".gd-item-head[aria-pressed='true'] + .gd-item-body .gd-src")
    ?.textContent ?? "";

describe("面板装配：装载三态与默认上图", () => {
  it("冻结基线路径：meta 落时次/溯源行、选中行展开（色卡＋数据源＋描述）、色斑上图且不透明度缺省 0.6", async () => {
    const dataFetch = vi.fn(async (url: string) =>
      url.startsWith("/grid/") ? notFound : okBuf(corpusF32()),
    );
    const map = await boot(dataFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
    expect(srcLine()).toContain("仓内冻结基线（非最新）");
    // 抽屉缺省收起；选中行（tmp 启动缺省）展开体含整合色卡＋数据源＋描述文案
    expect(document.getElementById("grid-panel")?.hidden).toBe(true);
    const body = document.querySelector(".gd-item-head[aria-pressed='true'] + .gd-item-body");
    expect(body).not.toBeNull();
    expect(body?.querySelector(".mw-grid-legend")).not.toBeNull();
    expect(body?.querySelector(".gd-src")?.textContent).toContain("起报");
    expect(body?.querySelector(".gd-desc")?.textContent).toContain("气温");
    const img = map.getPane("mw-grid")?.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.style.opacity).toBe("0.6");
  });

  it("两层穷尽：错误行＋重试按钮，不抛不白屏", async () => {
    const dataFetch = vi.fn(async () => notFound);
    await boot(dataFetch);
    await vi.waitFor(() => expect(meta()).toContain("数据不可用"));
    const retry = document.querySelector<HTMLButtonElement>("#grid-meta .mw-grid-retry");
    expect(retry).not.toBeNull();
    expect(meta()).toContain("HTTP 404");
  });

  it("?element= 未知要素回落首项，装载照常走通", async () => {
    restoreFns.push(installFakeCanvas());
    mountFixture();
    const map = L.map("map", { center: [35, 105], zoom: 4 });
    restoreFns.push(() => map.remove());
    const dataFetch = vi.fn(async (url: string) =>
      url.startsWith("/grid/") ? notFound : okBuf(corpusF32()),
    );
    mountGridLayerPanel(map, {
      search: "?element=notanelement",
      fetchImpl: dataFetch as never,
    });
    // 回落判定的纯逻辑由 grid-data.test 的 resolveInitialElement 锁定——这里只锁面板照常装载
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
  });
});

describe("面板装配：取消选中与抽屉开合", () => {
  it("取消选中（再点选中行）＝整层摘除；再选＝挂回同一层不重复 fetch（缓存复用）", async () => {
    const dataFetch = vi.fn(async (url: string) =>
      url.startsWith("/grid/") ? notFound : okBuf(corpusF32()),
    );
    const map = await boot(dataFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
    // 中间件探测＋gen 产物 404＋冻结基线＋自动时效档探测（tmp_fXXX 404）＝4 次
    expect(dataFetch).toHaveBeenCalledTimes(4);

    const head = rowBtnOf("2m 温度"); // 启动缺省选中 tmp——再点一次＝取消（不选＝不展示）
    expect(head.getAttribute("aria-pressed")).toBe("true");
    head.click();
    expect(head.getAttribute("aria-pressed")).toBe("false");
    expect(map.getPane("mw-grid")?.querySelector("img")).toBeNull();
    expect(meta()).toContain("未选择要素");
    expect((document.getElementById("grid-pull") as HTMLButtonElement).disabled).toBe(true);

    head.click();
    expect(head.getAttribute("aria-pressed")).toBe("true"); // 选中态即时
    await vi.waitFor(() => expect(map.getPane("mw-grid")?.querySelector("img")).not.toBeNull());
    expect(dataFetch).toHaveBeenCalledTimes(4); // 再选零新请求（缓存复用＋探测落空记忆）
  });

  it("抽屉开合：顶栏按钮唤起/再点收起、抽屉内 × 收起；开合不摘图层", async () => {
    const dataFetch = vi.fn(async (url: string) =>
      url.startsWith("/grid/") ? notFound : okBuf(corpusF32()),
    );
    const map = await boot(dataFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
    const drawer = document.getElementById("grid-panel") as HTMLElement;
    const openBtn = document.getElementById("mode-grid") as HTMLButtonElement;
    expect(drawer.hidden).toBe(true); // 缺省收起

    openBtn.click();
    expect(drawer.hidden).toBe(false);
    expect(openBtn.getAttribute("aria-pressed")).toBe("true");
    expect(map.getPane("mw-grid")?.querySelector("img")).not.toBeNull(); // 图层不受开合影响

    (document.getElementById("grid-close") as HTMLButtonElement).click();
    expect(drawer.hidden).toBe(true);
    expect(openBtn.getAttribute("aria-pressed")).toBe("false");
    expect(map.getPane("mw-grid")?.querySelector("img")).not.toBeNull();

    openBtn.click();
    expect(drawer.hidden).toBe(false);
    openBtn.click(); // 再点同一按钮＝收起
    expect(drawer.hidden).toBe(true);
  });

  it("滑杆 input：setOpacity 原地调（不重建层）＋百分比联动", async () => {
    const dataFetch = vi.fn(async (url: string) =>
      url.startsWith("/grid/") ? notFound : okBuf(corpusF32()),
    );
    const map = await boot(dataFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
    const img = map.getPane("mw-grid")?.querySelector("img");

    const slider = document.getElementById("grid-opacity") as HTMLInputElement;
    slider.value = "0.4";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    expect(img?.style.opacity).toBe("0.4");
    expect(document.getElementById("grid-opacity-value")?.textContent).toBe("40%");
    expect(map.getPane("mw-grid")?.querySelectorAll("img").length).toBe(1); // 原地：仍一层
  });

  it("取消选中期间滑杆再动：再选按现值生效", async () => {
    const dataFetch = vi.fn(async (url: string) =>
      url.startsWith("/grid/") ? notFound : okBuf(corpusF32()),
    );
    const map = await boot(dataFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
    rowBtnOf("2m 温度").click(); // 取消
    const slider = document.getElementById("grid-opacity") as HTMLInputElement;
    slider.value = "0.85";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    rowBtnOf("2m 温度").click(); // 再选（缓存）
    await vi.waitFor(() =>
      expect(map.getPane("mw-grid")?.querySelector("img")?.style.opacity).toBe("0.85"),
    );
  });
});

describe("面板装配：拉最新", () => {
  it("成功：中间件探测显按钮 → 拉取 → 带缓存戳重取 → 图例与溯源行换 gen 场", async () => {
    const urls: string[] = [];
    const dataFetch = vi.fn(async (url: string) => {
      urls.push(url);
      if (url === "/api/gen-grid") return { ok: false, status: 400, json: async () => ({}) };
      if (url.startsWith("/api/gen-grid")) return apiOk();
      if (url.startsWith("/grid/") && url.includes("v=")) return okBuf(tinyMwgrid());
      return url.startsWith("/grid/") ? notFound : okBuf(corpusF32());
    });
    const map = await boot(dataFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
    const pull = document.getElementById("grid-pull") as HTMLButtonElement;
    await vi.waitFor(() => expect(pull.hidden).toBe(false));

    pull.click();
    await vi.waitFor(() => expect(srcLine()).toContain("2026-10-06T06:00Z")); // 重取的 gen 场时次
    expect(srcLine()).not.toContain("冻结基线");
    expect(urls.some((u) => u.startsWith("/api/gen-grid?element=tmp"))).toBe(true);
    expect(urls.some((u) => u.startsWith("/grid/tmp_cn.mwgrid?v="))).toBe(true);
    expect(map.getPane("mw-grid")?.querySelector("img")).not.toBeNull();
  });

  it("失败：meta 行报原因、旧图保留", async () => {
    const dataFetch = vi.fn(async (url: string) => {
      if (url === "/api/gen-grid") return { ok: false, status: 400, json: async () => ({}) };
      if (url.startsWith("/api/gen-grid")) return apiFail();
      return url.startsWith("/grid/") ? notFound : okBuf(corpusF32());
    });
    const map = await boot(dataFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
    const pull = document.getElementById("grid-pull") as HTMLButtonElement;
    await vi.waitFor(() => expect(pull.hidden).toBe(false));
    pull.click();
    await vi.waitFor(() => expect(meta()).toContain("拉取失败"));
    expect(meta()).toContain("旧图保留");
    expect(map.getPane("mw-grid")?.querySelector("img")).not.toBeNull();
  });
});

/** prmsl 场 mock（gen 产物直出：200＋合法容器）。 */
const prmslFetch = async (url: string): Promise<unknown> => {
  if (url === "/api/gen-grid") return { ok: false, status: 400, json: async () => ({}) };
  if (url.startsWith("/grid/prmsl_cn.mwgrid")) return okBuf(tinyPrmslMwgrid());
  return url.startsWith("/grid/") ? notFound : okBuf(corpusF32());
};

/** gh 场 mock（同 prmsl 形态：8×8 穹顶场——值域 (5740,5900) 内 60 gpm 倍数三条线，
 *  5880 兼特值线〔highlighted〕；中心 high 5900）。 */
const tinyGhMwgrid = (): Uint8Array => {
  const nx = 8;
  const ny = 8;
  const values: number[] = [];
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      values.push(5900 - Math.max(Math.abs(y - 4), Math.abs(x - 4)) * 40);
    }
  }
  return serializeGrid(
    {
      version: 1,
      variable: "HGT",
      level: "500mb",
      unit: "gpm",
      grid: { nx, ny, la0: 44, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
      stats: {
        min: 5740,
        max: 5900,
        p10: 5780,
        p25: 5820,
        p50: 5860,
        p75: 5860,
        p90: 5900,
        p99: 5900,
      },
      meta: {
        referenceTime: "2026-10-06T18:00Z",
        forecastHour: 0,
        source: "GFS test",
        license: "",
        generated: "2026-10-07",
      },
    },
    values,
  );
};

const ghFetch = async (url: string): Promise<unknown> => {
  if (url === "/api/gen-grid") return { ok: false, status: 400, json: async () => ({}) };
  if (url.startsWith("/grid/gh_cn.mwgrid")) return okBuf(tinyGhMwgrid());
  return url.startsWith("/grid/") ? notFound : okBuf(corpusF32());
};

/** sp（地面气压）场 mock（同形态：8×8 穹顶场 Pa 存储——切比雪夫定价 8 hPa/格，
 *  显示值域 [1004,1036] hPa：16 倍数两条线 1008/1024 全 major〔无加密线，interval 16
 *  可读性裁量〕且两线区域各 ≥3×3（环长过 3° 起标门槛——1024 若区域仅单格，其菱形
 *  环折叠长 ~2.5° 属碎片环不标值，mock 须避开该形态才能双线双标）；中心 high 1036）。 */
const tinySpMwgrid = (): Uint8Array => {
  const nx = 8;
  const ny = 8;
  const values: number[] = [];
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      values.push((1036 - Math.max(Math.abs(y - 4), Math.abs(x - 4)) * 8) * 100);
    }
  }
  return serializeGrid(
    {
      version: 1,
      variable: "PRES",
      level: "sfc",
      unit: "Pa",
      grid: { nx, ny, la0: 44, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
      stats: {
        min: 100400,
        max: 103600,
        p10: 101200,
        p25: 102000,
        p50: 102000,
        p75: 102800,
        p90: 103600,
        p99: 103600,
      },
      meta: {
        referenceTime: "2026-10-06T18:00Z",
        forecastHour: 0,
        source: "GFS test",
        license: "",
        generated: "2026-10-07",
      },
    },
    values,
  );
};

const spFetch = async (url: string): Promise<unknown> => {
  if (url === "/api/gen-grid") return { ok: false, status: 400, json: async () => ({}) };
  if (url.startsWith("/grid/pres_cn.mwgrid")) return okBuf(tinySpMwgrid());
  return url.startsWith("/grid/") ? notFound : okBuf(corpusF32());
};

/** t850（850hPa 温度）场 mock（同形态：8×8 暖穹顶场 K 存储——切比雪夫定价 4°C/格、
 * 相位 1.9 使值域端点远离 4 的倍数（浮点噪声不生贴边环）：显示值域 [−8.4, 7.6]°C，
 * 等温线 −8/−4/0/+4 四条全内部闭合环〔0 兼特值线 highlighted〕；暖穹顶心 +7.6°C
 * 若中心开启会被误标「H 高压中心」——本要素声明 contours.centers:false 验证不出）。 */
const tinyT850Mwgrid = (): Uint8Array => {
  const nx = 8;
  const ny = 8;
  const values: number[] = [];
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      values.push(273.15 + (1.9 - Math.max(Math.abs(y - 4), Math.abs(x - 4))) * 4);
    }
  }
  return serializeGrid(
    {
      version: 1,
      variable: "TMP",
      level: "850mb",
      unit: "K",
      grid: { nx, ny, la0: 44, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
      stats: {
        min: 265.15,
        max: 281.15,
        p10: 269.15,
        p25: 273.15,
        p50: 277.15,
        p75: 277.15,
        p90: 281.15,
        p99: 281.15,
      },
      meta: {
        referenceTime: "2026-10-06T18:00Z",
        forecastHour: 0,
        source: "GFS test",
        license: "",
        generated: "2026-10-07",
      },
    },
    values,
  );
};

const t850Fetch = async (url: string): Promise<unknown> => {
  if (url === "/api/gen-grid") return { ok: false, status: 400, json: async () => ({}) };
  if (url.startsWith("/grid/t850_cn.mwgrid")) return okBuf(tinyT850Mwgrid());
  return url.startsWith("/grid/") ? notFound : okBuf(corpusF32());
};

/** 按显示名找要素行头按钮（行装配用例的公共小件）。 */
const rowBtnOf = (label: string): HTMLButtonElement => {
  const btn = Array.from(
    document.querySelectorAll<HTMLButtonElement>("#grid-elements .gd-item-head"),
  ).find((b) => (b.textContent ?? "").startsWith(label));
  expect(btn).toBeDefined();
  return btn as HTMLButtonElement;
};

describe("面板装配：等值线主导要素（prmsl，档案 renderForm 驱动）", () => {
  it("要素清单含 prmsl 位（清单一行即接入，面板结构零特判）", () => {
    expect(GRID_ELEMENTS.map((s) => s.profile.shortName)).toContain("prmsl");
    mountFixture();
    restoreFns.push(installFakeCanvas());
    const map = L.map("map", { center: [35, 105], zoom: 4 });
    restoreFns.push(() => map.remove());
    mountGridLayerPanel(map, { search: "", fetchImpl: prmslFetch as never });
    expect(document.querySelectorAll("#grid-elements .gd-item-head").length).toBe(
      GRID_ELEMENTS.length,
    );
    expect(rowBtnOf("海平面气压")).toBeDefined();
  });

  it("选 prmsl：色斑＋等值线叠层成套上图（pane/描线/数值标注/L·H 中心），meta 联动", async () => {
    const map = await boot(prmslFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
    rowBtnOf("海平面气压").click();
    await vi.waitFor(() => expect(srcLine()).toContain("海平面气压（hPa）"));
    // 色斑与等值线两 pane 各自就位（z 350 / z 360）
    expect(map.getPane("mw-grid")?.querySelector("img")).not.toBeNull();
    const pane = map.getPane("mw-grid-contour");
    expect(pane?.style.zIndex).toBe("360");
    expect(pane?.querySelectorAll("path").length).toBe(6); // 三条线×两道环（域外框＋内环）
    expect(
      Array.from(pane?.querySelectorAll(".mw-contour-icon > span") ?? []).map((s) => s.textContent),
    ).toEqual(["1004", "1004", "1004"]);
    expect(pane?.querySelector(".mw-center-low .mw-center-letter")?.textContent).toBe("L");
    expect(pane?.querySelector(".mw-center-low .mw-center-val")?.textContent).toBe("1000");
    expect(pane?.querySelector(".mw-center-high .mw-center-letter")?.textContent).toBe("H");
  });

  it("prmsl → tmp 切换：等值线叠层整层摘除（filled 要素不背等值线层）", async () => {
    const map = await boot(prmslFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
    rowBtnOf("海平面气压").click();
    await vi.waitFor(() =>
      expect(map.getPane("mw-grid-contour")?.querySelectorAll("path").length).toBe(6),
    );
    rowBtnOf("2m 温度").click();
    await vi.waitFor(() => expect(srcLine()).toContain("2m 温度（°C）"));
    await vi.waitFor(() =>
      expect(map.getPane("mw-grid-contour")?.querySelectorAll("path").length).toBe(0),
    );
    // 再切回 prmsl：走内存缓存（零新 fetch），等值线层重建
    rowBtnOf("海平面气压").click();
    await vi.waitFor(() =>
      expect(map.getPane("mw-grid-contour")?.querySelectorAll("path").length).toBe(6),
    );
  });

  it("取消选中随等值线叠层同进退（不选＝色斑＋等值线全摘，再选＝缓存重建两层）", async () => {
    const map = await boot(prmslFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
    rowBtnOf("海平面气压").click();
    await vi.waitFor(() =>
      expect(map.getPane("mw-grid-contour")?.querySelectorAll("path").length).toBe(6),
    );
    const head = rowBtnOf("海平面气压");
    head.click(); // 再点选中行＝取消
    expect(map.getPane("mw-grid")?.querySelector("img")).toBeNull();
    expect(map.getPane("mw-grid-contour")?.querySelectorAll("path").length).toBe(0);
    head.click();
    await vi.waitFor(() => {
      expect(map.getPane("mw-grid")?.querySelector("img")).not.toBeNull();
      expect(map.getPane("mw-grid-contour")?.querySelectorAll("path").length).toBe(6);
    });
  });
});

describe("面板装配：500hPa 高度（gh，等值线主导第二要素——renderForm 零特判复用）", () => {
  it("清单含 gh 位；选 gh 成套上图：5880 特值线红色加粗＋标注同色，H 中心在", async () => {
    const map = await boot(ghFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
    expect(GRID_ELEMENTS.map((s) => s.profile.shortName)).toContain("gh");
    rowBtnOf("500hPa 高度").click();
    await vi.waitFor(() => expect(srcLine()).toContain("500hPa 高度（gpm）"));
    // 色斑与等值线两 pane 成套（renderForm 档案驱动——面板对 gh 零特判）
    expect(map.getPane("mw-grid")?.querySelector("img")).not.toBeNull();
    const pane = map.getPane("mw-grid-contour");
    const paths = Array.from(pane?.querySelectorAll("path") ?? []);
    expect(paths).toHaveLength(3); // 5760/5820 常规＋5880 特值各一条环
    const red = paths.filter((p) => p.getAttribute("stroke") === "#c0392b");
    expect(red).toHaveLength(1); // 5880 副高线红色（缺省 highlightColor）
    expect(red[0]?.getAttribute("stroke-width")).toBe("2.2");
    const hlLabel = pane?.querySelector(".mw-contour-icon > span.mw-contour-hl");
    expect(hlLabel?.textContent).toBe("5880"); // 特值线标注同色加粗类
    expect(pane?.querySelector(".mw-center-high .mw-center-val")?.textContent).toBe("5900");
  });
});

describe("面板装配：等温线要素（t850——centers 档案驱动关闭：只描线不出中心）", () => {
  it("清单含 t850 位；选 t850 成套上图：等温线 −4/0/+4 在、0°C 特值线红字、无任何 L/H 中心标注", async () => {
    const map = await boot(t850Fetch);
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
    expect(GRID_ELEMENTS.map((s) => s.profile.shortName)).toContain("t850");
    rowBtnOf("850hPa 温度").click();
    await vi.waitFor(() => expect(srcLine()).toContain("850hPa 温度（°C）"));
    // 色斑与等值线两 pane 成套（renderForm 档案驱动——面板对 t850 零特判）
    expect(map.getPane("mw-grid")?.querySelector("img")).not.toBeNull();
    const pane = map.getPane("mw-grid-contour");
    expect(pane?.style.zIndex).toBe("360");
    // 等温线 −8/−4/0/+4 四条各一道内部闭合环（暖穹顶场、相位避开倍数端点——owner
    // 定案：温度场只描等值线）
    expect(pane?.querySelectorAll("path").length).toBe(4);
    const labels = Array.from(pane?.querySelectorAll(".mw-contour-icon > span") ?? []).map(
      (s) => s.textContent,
    );
    expect(labels).toEqual(["-8", "-8", "-4", "0", "4"]); // 升序线值；−8 最外环 ~28° 长环出双标（沿程每 10° 一处的标注规则）
    const hl = pane?.querySelector(".mw-contour-icon > span.mw-contour-hl");
    expect(hl?.textContent).toBe("0"); // 0°C 兼特值线（红字加粗——零度层降水形态锚）
    expect(hl?.getAttribute("style")).toContain("#c0392b");
    // L/H 中心标注零枚（档案 contours.centers:false——暖穹顶心不会被误标「高压中心」）
    expect(pane?.querySelectorAll(".mw-center-icon").length).toBe(0);
  });
});

describe("面板装配：地面气压（sp，等值线主导第三要素——零改动路径第二证）", () => {
  it("清单含 pres 位（短名对齐 gen CLI 键）；选 sp 成套上图：常规线标值无加密线，H 中心在", async () => {
    const map = await boot(spFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
    expect(GRID_ELEMENTS.map((s) => s.profile.shortName)).toContain("pres");
    rowBtnOf("地面气压").click();
    await vi.waitFor(() => expect(srcLine()).toContain("地面气压（hPa）"));
    // 色斑与等值线两 pane 成套（renderForm 档案驱动——面板对 sp 零特判，内核/leaflet 零改动）
    expect(map.getPane("mw-grid")?.querySelector("img")).not.toBeNull();
    const pane = map.getPane("mw-grid-contour");
    expect(pane?.style.zIndex).toBe("360");
    const paths = Array.from(pane?.querySelectorAll("path") ?? []);
    expect(paths).toHaveLength(2); // 1008/1024 各一条环（16 hPa 常规线——可读性两步裁量）
    // 无特值线：无红线（highlighted 空表）且全线走缺省基色
    expect(paths.filter((p) => p.getAttribute("stroke") === "#c0392b")).toHaveLength(0);
    expect(paths.every((p) => p.getAttribute("stroke") === "#33506b")).toBe(true);
    const labels = Array.from(pane?.querySelectorAll(".mw-contour-icon > span") ?? []).map(
      (s) => s.textContent,
    );
    // 常规线数值标注（hPa 直读）；长环沿程多枚（每环至多 3 处）——按值集合断言
    expect(new Set(labels)).toEqual(new Set(["1008", "1024"]));
    expect(labels.length).toBeGreaterThanOrEqual(2);
    expect(pane?.querySelectorAll(".mw-contour-icon > span.mw-contour-hl").length).toBe(0);
    expect(pane?.querySelector(".mw-center-high .mw-center-letter")?.textContent).toBe("H");
    expect(pane?.querySelector(".mw-center-high .mw-center-val")?.textContent).toBe("1036");
  });
});

/** wind 容器头工厂（模块层小件：不捕获外层变量——consistent-function-scoping 纪律）。 */
const windHeaderOf = (variable: string): GridHeader => ({
  version: 1,
  variable,
  level: "10m",
  unit: "m s-1",
  grid: { nx: 8, ny: 8, la0: 44, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
  stats: { min: 5, max: 5, p10: 5, p25: 5, p50: 5, p75: 5, p90: 5, p99: 5 },
  meta: {
    referenceTime: "2026-10-06T18:00Z",
    forecastHour: 0,
    source: "GFS test",
    license: "",
    generated: "2026-10-07",
  },
});

/** 8×8 u/v 成对容器（m s-1、全场西风 5 m/s：u=5、v=0）——双分量要素装配用。 */
const tinyWindPair = (): [Uint8Array, Uint8Array] => {
  const values = Array.from({ length: 64 }, () => 5);
  return [
    serializeGrid(windHeaderOf("UGRD"), values),
    serializeGrid(
      windHeaderOf("VGRD"),
      Array.from({ length: 64 }, () => 0),
    ),
  ];
};

/** wind 场 mock：双文件直出（200＋合法容器），其余回落冻结基线。 */
const windFetch = async (url: string): Promise<unknown> => {
  if (url === "/api/gen-grid") return { ok: false, status: 400, json: async () => ({}) };
  if (url.startsWith("/grid/windu_cn.mwgrid")) return okBuf(tinyWindPair()[0]);
  if (url.startsWith("/grid/windv_cn.mwgrid")) return okBuf(tinyWindPair()[1]);
  return url.startsWith("/grid/") ? notFound : okBuf(corpusF32());
};

describe("面板装配：双分量要素（wind，renderForm filled+barbs 档案驱动）", () => {
  it("清单含 wind 位（第十三位）；选 wind：合成风速色斑＋风羽杆成套上图（pane z 365、方向旋转），meta 联动", async () => {
    const map = await boot(windFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
    expect(GRID_ELEMENTS.map((s) => s.profile.shortName)).toContain("wind");
    rowBtnOf("10m 风").click();
    await vi.waitFor(() => expect(srcLine()).toContain("10m 风（m/s）"));
    // 色斑层：loaded.grid 已是合成场（windSpeedGrid 装载期合成——面板零合成代码）
    expect(map.getPane("mw-grid")?.querySelector("img")).not.toBeNull();
    // 杆层：pane mw-grid-barb（等值线 360 之上、矢量 400 之下）；8×8 场 step 10 格位恰 (3,3) 一杆
    const pane = map.getPane("mw-grid-barb");
    expect(pane?.style.zIndex).toBe("365");
    const svgs = Array.from(pane?.querySelectorAll(".mw-barb-icon svg") ?? []);
    expect(svgs).toHaveLength(1);
    // 全场西风（u=5,v=0）→ 来向 270；速度 5 m/s＝1 长划（4）＋1 短划（2 缺——5=4+1 只长划）
    expect(svgs[0]?.querySelector("g")?.getAttribute("transform")).toBe("rotate(270 16 16)");
    expect(map.getPane("mw-grid-contour")?.querySelectorAll("path").length ?? 0).toBe(0); // 不背等值线层
  });

  it("wind → tmp 切换：杆层整层摘除（filled 要素不背杆层），再切回缓存重建", async () => {
    const map = await boot(windFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
    rowBtnOf("10m 风").click();
    await vi.waitFor(() =>
      expect(map.getPane("mw-grid-barb")?.querySelectorAll(".mw-barb-icon svg").length).toBe(1),
    );
    rowBtnOf("2m 温度").click();
    await vi.waitFor(() => expect(srcLine()).toContain("2m 温度（°C）"));
    await vi.waitFor(() =>
      expect(map.getPane("mw-grid-barb")?.querySelectorAll(".mw-barb-icon svg").length).toBe(0),
    );
    // 再切回 wind：走内存缓存（缓存复用计数由 grid-data.test 的数据面测试负责），杆层重建
    rowBtnOf("10m 风").click();
    await vi.waitFor(() =>
      expect(map.getPane("mw-grid-barb")?.querySelectorAll(".mw-barb-icon svg").length).toBe(1),
    );
  });

  it("取消选中随杆层同进退（不选＝色斑＋杆全摘，再选＝缓存重建两层）", async () => {
    const map = await boot(windFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
    rowBtnOf("10m 风").click();
    await vi.waitFor(() =>
      expect(map.getPane("mw-grid-barb")?.querySelectorAll(".mw-barb-icon svg").length).toBe(1),
    );
    const head = rowBtnOf("10m 风");
    head.click(); // 再点选中行＝取消
    expect(map.getPane("mw-grid")?.querySelector("img")).toBeNull();
    expect(map.getPane("mw-grid-barb")?.querySelectorAll(".mw-barb-icon svg").length).toBe(0);
    head.click();
    await vi.waitFor(() => {
      expect(map.getPane("mw-grid")?.querySelector("img")).not.toBeNull();
      expect(map.getPane("mw-grid-barb")?.querySelectorAll(".mw-barb-icon svg").length).toBe(1);
    });
  });
});

// ---------------------------------------------------------------- 接线契约

describe("index.html 接线契约（面板 id 漂移即红）", () => {
  const html = (): string => readFileSync(join(here, "..", "index.html"), "utf8");

  it("首页含抽屉全套 id（顶栏入口/收起钮/行列表/控件）；旧开关与旧图例位已退役", () => {
    for (const id of [
      "mode-grid",
      "grid-panel",
      "grid-close",
      "grid-elements",
      "grid-pull",
      "grid-fhour",
      "grid-fhour-prev",
      "grid-fhour-next",
      "grid-opacity",
      "grid-opacity-value",
      "grid-meta",
      "top-right",
    ]) {
      expect(html().includes(`id="${id}"`), `index.html 应含 #${id}`).toBe(true);
    }
    // v0.3.1 抽屉化退役：旧图层开关、旧独立图例容器不再接线（图例入选中行展开体）
    expect(html().includes('id="grid-toggle"')).toBe(false);
    expect(html().includes('id="grid-legend"')).toBe(false);
    // 独立 grid 页已删：构建入口不再引用
    expect(html().includes("grid-main.ts")).toBe(false);
  });

  it("滑杆 HTML 属性与面板常量一致（min/max/step/缺省漂移即红）", () => {
    const attr = (name: string): string => {
      const m = new RegExp(`id="grid-opacity"[^>]*?${name}="([\\d.]+)"`).exec(html());
      expect(m).not.toBeNull();
      return m![1]!;
    };
    expect(Number(attr("min"))).toBe(GRID_OPACITY_MIN);
    expect(Number(attr("max"))).toBe(GRID_OPACITY_MAX);
    expect(Number(attr("step"))).toBe(GRID_OPACITY_STEP);
    expect(Number(attr("value"))).toBe(GRID_OPACITY_DEFAULT);
  });
});

describe("整合色卡：刻度值在色带下的对应位置（legendTickLayout）", () => {
  const spec = GRID_ELEMENTS[0]!;
  const loaded: LoadedGrid = { grid: buildFallbackGrid(corpusF32()), source: "gen" };

  it("线性映射：首刻度锚 0%、末刻度锚 100%、中位按值比例定位", () => {
    // tmp 等距档抽样刻度 [-40,-28,-16,-4,8,20,32,40]：域 [-40,40]
    const layout = legendTickLayout([-40, -28, -16, -4, 8, 20, 32, 40]);
    expect(layout[0]).toMatchObject({ value: -40, pct: 0, anchor: "left" });
    expect(layout.at(-1)).toMatchObject({ value: 40, pct: 100, anchor: "right" });
    const at8 = layout.find((t) => t.value === 8);
    expect(at8?.pct).toBeCloseTo(60, 10); // (8+40)/80＝60%
    expect(at8?.anchor).toBe("center");
  });

  it("近值碰撞右让：prate 的 0 与 0.1（线性位差 1%）拉开最小间距，首末锚定不漂", () => {
    const layout = legendTickLayout([0, 0.1, 1, 5, 10]);
    expect(layout[0]?.pct).toBe(0);
    expect(layout[1]?.pct).toBeGreaterThanOrEqual(6); // 0.1 右让
    expect(layout[2]?.pct ?? 0).toBeGreaterThanOrEqual((layout[1]?.pct ?? 0) + 6); // 1 继续让
    expect(layout.at(-1)?.pct).toBe(100);
  });

  it("图例 DOM：刻度 span 按 pct 定位（style.left）＋首末防溢出位移＋单位右上", () => {
    const node = buildGridLegend(spec, loaded);
    const spans = Array.from(node.querySelectorAll<HTMLElement>(".mw-grid-legend-ticks span"));
    const values = legendTickValues(spec, loaded.grid.header.stats);
    expect(spans.map((s) => s.textContent)).toEqual(values.map((v) => `${v}`));
    const first = spans[0];
    const last = spans.at(-1);
    expect(first?.style.left).toBe("0%");
    expect(first?.style.transform).toBe("none"); // 首刻度左缘对齐（防左溢出）
    expect(last?.style.left).toBe("100%");
    expect(last?.style.transform).toBe("translateX(-100%)"); // 末刻度右缘对齐（防右溢出）
    const mid = spans[Math.floor(spans.length / 2)];
    expect(mid?.style.transform).toBe("translateX(-50%)"); // 中位置居中
    expect(node.querySelector(".mw-grid-legend-unit")?.textContent).toBe("°C");
  });
});

// ---------------------------------------------------------------- 预报时效（fhour）装配

/** 时效场工厂：tiny 场带指定 forecastHour 与动态起报（自动跳档用例须龄确定）。 */
const tinyFhourField = (fhour: number, referenceTime: string): Uint8Array =>
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

describe("面板装配：预报时效（选择器/自动跳档/显式档/拉最新回带）", () => {
  it("autoTrackFhour 纯函数：起报龄取整收敛 [0,72]、不足半点不跳、坏串零", () => {
    const now = Date.parse("2026-10-07T12:00Z");
    expect(autoTrackFhour("2026-10-07T06:00Z", now)).toBe(6);
    expect(autoTrackFhour("2026-10-07T11:45Z", now)).toBe(0); // 15min < 半点阈值
    expect(autoTrackFhour("2026-09-01T00:00Z", now)).toBe(GRID_FHOUR_MAX); // 收敛上限 72
    expect(autoTrackFhour("not-a-time", now)).toBe(0);
  });

  it("步进器：◀ 值钮 ▶ 三件在位、值钮显「自动·f00」、f00 下界禁 ◀；探测 404 诚实留 f000", async () => {
    const dataFetch = vi.fn(async (url: string) =>
      url.startsWith("/grid/") ? notFound : okBuf(corpusF32()),
    );
    await boot(dataFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
    const display = document.getElementById("grid-fhour") as HTMLButtonElement;
    const prev = document.getElementById("grid-fhour-prev") as HTMLButtonElement;
    const next = document.getElementById("grid-fhour-next") as HTMLButtonElement;
    expect(display.textContent).toBe("自动·f00"); // 自动态＝「自动·」前缀＋当前档
    expect(display.getAttribute("aria-pressed")).toBe("true");
    expect(prev.disabled).toBe(true); // f00 下界
    expect(next.disabled).toBe(false);
    // 自动探测：发了 tmp_fXXX_cn 一次（404），装载中禁用、终态解禁，留在 f000 不报错
    await vi.waitFor(() =>
      expect(dataFetch.mock.calls.some(([u]) => /\/grid\/tmp_f\d{3}_cn\.mwgrid$/.test(u))).toBe(
        true,
      ),
    );
    expect(srcLine()).toContain("f00");
    expect(display.disabled).toBe(false);
  });

  it("自动跳档命中：起报龄 5h 且 f005 产物在——装载后升级到 f05（选择器保持「自动」）", async () => {
    const ref = new Date(Date.now() - 5 * 3600_000).toISOString().replace(/\.\d{3}Z$/, "Z");
    const dataFetch = vi.fn(async (url: string) => {
      if (url.startsWith("/grid/tmp_cn.mwgrid")) return okBuf(tinyFhourField(0, ref));
      if (url.startsWith("/grid/tmp_f005_cn.mwgrid")) return okBuf(tinyFhourField(5, ref));
      if (url.startsWith("/grid/")) return notFound;
      return okBuf(corpusF32());
    });
    await boot(dataFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("f05")); // 跳档后的场（meta 直读头）
    expect(srcLine()).not.toContain("f00·");
    const display = document.getElementById("grid-fhour") as HTMLButtonElement;
    expect(display.textContent).toBe("自动·f05"); // 模式仍是自动（档位是探测结果）
    expect((document.getElementById("grid-fhour-prev") as HTMLButtonElement).disabled).toBe(false); // f05 非边界
  });

  it("步进：▶ 从自动·f05 脱钩为手动 f06（取 _f006 产物）、◀ 回 f05 走缓存、值钮切回自动零新请求", async () => {
    const ref = new Date(Date.now() - 5 * 3600_000).toISOString().replace(/\.\d{3}Z$/, "Z");
    const dataFetch = vi.fn(async (url: string) => {
      if (url.startsWith("/grid/tmp_cn.mwgrid")) return okBuf(tinyFhourField(0, ref));
      if (url.startsWith("/grid/tmp_f005_cn.mwgrid")) return okBuf(tinyFhourField(5, ref));
      if (url.startsWith("/grid/tmp_f006_cn.mwgrid"))
        return okBuf(tinyFhourField(6, "2026-10-07T06:00Z"));
      if (url.startsWith("/grid/")) return notFound;
      return okBuf(corpusF32());
    });
    const map = await boot(dataFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("f05")); // 自动跳档到 f05
    const display = document.getElementById("grid-fhour") as HTMLButtonElement;
    const prev = document.getElementById("grid-fhour-prev") as HTMLButtonElement;

    (document.getElementById("grid-fhour-next") as HTMLButtonElement).click(); // ▶ → f06 手动
    await vi.waitFor(() => expect(srcLine()).toContain("f06"));
    expect(display.textContent).toBe("f06"); // 手动态无「自动·」前缀
    expect(display.getAttribute("aria-pressed")).toBe("false");
    expect(map.getPane("mw-grid")?.querySelector("img")).not.toBeNull();

    const callsBefore = dataFetch.mock.calls.length;
    prev.click(); // ◀ → f05（自动跳档时已缓存 tmp@f5）零新请求
    await vi.waitFor(() => expect(srcLine()).toContain("f05"));
    expect(dataFetch.mock.calls.length).toBe(callsBefore);

    display.click(); // 值钮 → 切回自动：f000（缓存）＋自动跳档 f05（缓存）零新请求
    await vi.waitFor(() => expect(display.textContent).toBe("自动·f05"));
    expect(dataFetch.mock.calls.length).toBe(callsBefore);
  });

  it("拉最新后重取撞新文件 404 窗：退避重试（1.5s）后成功上图——静态服务目录缓存滞后根治", async () => {
    let vFetchCount = 0;
    const dataFetch = vi.fn(async (url: string) => {
      if (url === "/api/gen-grid") return { ok: false, status: 400, json: async () => ({}) };
      if (url.startsWith("/api/gen-grid")) return apiOkFhour(6);
      if (url.includes("v=") && url.includes("tmp_f006_cn.mwgrid")) {
        vFetchCount += 1;
        if (vFetchCount === 1) return notFound; // 首取撞 404 窗（实测 ~1–2s）
        return okBuf(tinyFhourField(6, "2026-10-07T06:00Z"));
      }
      if (url.startsWith("/grid/tmp_cn.mwgrid")) return okBuf(tinyMwgrid());
      return url.startsWith("/grid/") ? notFound : okBuf(corpusF32());
    });
    await boot(dataFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
    const pull = document.getElementById("grid-pull") as HTMLButtonElement;
    await vi.waitFor(() => expect(pull.hidden).toBe(false));
    pull.click();
    await vi.waitFor(() => expect(srcLine()).toContain("f06"), { timeout: 8000 }); // 含 1.5s 退避
    expect(vFetchCount).toBe(2); // 重试恰一次
  });

  it("拉最新 auto：请求带 fhour=auto，按应答回带档直载（缓存戳重取 _f006）", async () => {
    const urls: string[] = [];
    const dataFetch = vi.fn(async (url: string) => {
      urls.push(url);
      if (url === "/api/gen-grid") return { ok: false, status: 400, json: async () => ({}) };
      if (url.startsWith("/api/gen-grid")) return apiOkFhour(6);
      if (url.includes("v=") && url.includes("tmp_f006_cn.mwgrid"))
        return okBuf(tinyFhourField(6, "2026-10-07T06:00Z"));
      if (url.startsWith("/grid/tmp_cn.mwgrid")) return okBuf(tinyMwgrid());
      return url.startsWith("/grid/") ? notFound : okBuf(corpusF32());
    });
    await boot(dataFetch);
    await vi.waitFor(() => expect(srcLine()).toContain("起报"));
    const pull = document.getElementById("grid-pull") as HTMLButtonElement;
    await vi.waitFor(() => expect(pull.hidden).toBe(false));
    pull.click();
    await vi.waitFor(() => expect(srcLine()).toContain("f06"));
    expect(urls.some((u) => u.startsWith("/api/gen-grid?element=tmp&fhour=auto"))).toBe(true);
    expect(urls.some((u) => u.startsWith("/grid/tmp_f006_cn.mwgrid?v="))).toBe(true); // 回带档＋缓存戳
  });
});

/** 拉最新应答（带回带 fhour 形态）。 */
const apiOkFhour = (
  fhour: number,
): { ok: boolean; status: number; json: () => Promise<unknown> } => ({
  ok: true,
  status: 200,
  json: async () => ({ ok: true, fhour }),
});
