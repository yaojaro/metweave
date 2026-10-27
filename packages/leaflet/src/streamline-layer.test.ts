// @vitest-environment happy-dom
/**
 * addStreamlineLayer 可测面：选项校验（不静默纪律）、装配面——独立 pane 的层级位次、
 * canvas 渲染器（矢量批次口径：流线不走 SVG/DOM 节点）、折线数与内核 streamlinesOf
 * 一致、坐标逐点对拍、单点线防御、重复挂载幂等。积分/终止数学不在此重复——
 * streamlinesOf 是零 DOM 纯函数，由 @metweave/grid 的 wind.test.ts 锁死；此处只锁装配。
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as L from "leaflet";
import { addStreamlineLayer } from "./index";
import { streamlinesOf, type Grid, type GridHeader } from "@metweave/grid";

/**
 * happy-dom 未实现 canvas 2d（getContext 返回 null），L.Canvas 在 onAdd 即崩——
 * 这也是仓内等值线层选 SVG 渲染器的原因之一。流线按矢量批次既定口径走 canvas，
 * 此处给 canvas 2d context 装一个**吸收一切方法调用与属性写入的 Proxy 替身**
 * （只服务装配断言——pane/渲染器/折线数/坐标；像素层面的验证归真浏览器审查轮，
 * 不在 happy-dom 里假装能验）。
 */
beforeAll(() => {
  const ctxStub = new Proxy(
    {},
    {
      get: () => () => undefined,
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  const proto = HTMLCanvasElement.prototype as {
    getContext: (...args: unknown[]) => CanvasRenderingContext2D | null;
  };
  proto.getContext = () => ctxStub;
});

/** 常值填充工具（模块层——不捕获父级变量的闭包不留在函数体内）。 */
const gridFill = (length: number, value: number): Float32Array =>
  Float32Array.from({ length }, () => value);

/** 均匀西风对场工厂（6×4，u=4 m/s、v=0）：流线＝一族东行平直线，装配测试用。 */
const uniformPair = (): [Grid, Grid] => {
  const geometry = {
    nx: 6,
    ny: 4,
    la0: 44,
    lo0: 100,
    di: 1,
    dj: 1,
    order: "N2S,W2E,row-major",
  } as const;
  const headerOf = (variable: string): GridHeader => ({
    version: 1,
    variable,
    level: "10m",
    unit: "m s-1",
    grid: geometry,
    stats: { min: 0, max: 4, p10: 4, p25: 4, p50: 4, p75: 4, p90: 4, p99: 4 },
    meta: {
      referenceTime: "2026-10-27T00:00Z",
      forecastHour: 0,
      source: "test",
      license: "",
      generated: "2026-10-27",
    },
  });
  return [
    { header: headerOf("UGRD"), values: gridFill(24, 4) },
    { header: headerOf("VGRD"), values: gridFill(24, 0) },
  ];
};

const sampleLines = () => {
  const [u, v] = uniformPair();
  return streamlinesOf(u, v, { seedSpacing: 2, maxSteps: 10, step: 1, calmThreshold: 1 });
};

const maps: L.Map[] = [];
afterEach(() => {
  for (const m of maps.splice(0)) m.remove();
});
const freshMap = (): L.Map => {
  document.body.innerHTML = '<div id="map" style="width: 800px; height: 600px"></div>';
  const m = L.map("map", { center: [40, 104], zoom: 4 });
  maps.push(m);
  return m;
};

describe("addStreamlineLayer（流线 canvas 层装配）", () => {
  it("选项校验：未知选项键与非法 width 显式抛错", async () => {
    const map = freshMap();
    await expect(
      addStreamlineLayer(map, sampleLines(), { colour: "#000" } as never),
    ).rejects.toThrow(/未知选项/);
    await expect(addStreamlineLayer(map, sampleLines(), { width: 0 })).rejects.toThrow(
      /width 非法/,
    );
    await expect(addStreamlineLayer(map, sampleLines(), { width: -1 })).rejects.toThrow(
      /width 非法/,
    );
    await expect(addStreamlineLayer(map, sampleLines(), { width: Number.NaN })).rejects.toThrow(
      /width 非法/,
    );
  });

  it("装配：折线数＝内核出线数、逐条 polyline、坐标逐点对拍", async () => {
    const map = freshMap();
    const lines = sampleLines();
    expect(lines.length).toBeGreaterThan(0);
    const group = await addStreamlineLayer(map, lines);
    const layers = group.getLayers();
    expect(layers).toHaveLength(lines.length);
    for (const layer of layers) expect(layer).toBeInstanceOf(L.Polyline);
    // 坐标对拍：第 i 条折线的第 j 个 latlng 与内核第 i 条线的第 j 点一致（同序装配）
    const first = layers[0] as L.Polyline;
    const ll = first.getLatLngs() as L.LatLng[];
    expect(ll.length).toBe(lines[0]?.points.length);
    for (let j = 0; j < ll.length; j++) {
      expect(ll[j]?.lat).toBeCloseTo(lines[0]?.points[j]?.lat as number, 10);
      expect(ll[j]?.lng).toBeCloseTo(lines[0]?.points[j]?.lon as number, 10);
    }
  });

  it("canvas 口径与 pane 层级：共享 L.Canvas 渲染器、挂 mw-grid-streamline（z 355）", async () => {
    const map = freshMap();
    const group = await addStreamlineLayer(map, sampleLines());
    const pane = map.getPane("mw-grid-streamline");
    expect(pane).toBeDefined();
    expect(pane?.style.zIndex).toBe("355");
    const renderers = new Set<unknown>();
    for (const layer of group.getLayers()) {
      const renderer = (layer as L.Polyline).options.renderer;
      expect(renderer).toBeInstanceOf(L.Canvas);
      renderers.add(renderer);
    }
    expect(renderers.size).toBe(1); // 全层共享一张画布，不是每线一个渲染器
  });

  it("单点线防御跳过；重复挂载幂等（pane 不重建、不抛错）", async () => {
    const map = freshMap();
    const lines = sampleLines();
    const withStub = [{ points: [{ lat: 40, lon: 100 }], steps: 0 }, ...lines];
    const group = await addStreamlineLayer(map, withStub);
    expect(group.getLayers()).toHaveLength(lines.length); // 单点桩被跳过
    const again = await addStreamlineLayer(map, lines);
    expect(again.getLayers()).toHaveLength(lines.length);
    expect(map.getPane("mw-grid-streamline")).toBeDefined();
  });
});
