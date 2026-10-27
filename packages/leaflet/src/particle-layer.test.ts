// @vitest-environment happy-dom
/**
 * addParticleLayer 可测面：选项校验（不静默纪律）、装配面——独立 pane 层级位次、
 * canvas 挂载与尺寸、rAF 帧循环在替身 context 上跑若干帧不炸、remove 停帧清理幂等。
 * 平流数学（位移度量/重生条件/尾迹）是浏览器面的视觉验证对象，不在 happy-dom 里假装
 * 能验——数据面由内核与 interpolateBilinear 各自的测试锁死，此处只锁装配与生命周期。
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as L from "leaflet";
import { addParticleLayer, type ParticleLayer } from "./index";
import { type Grid, type GridHeader } from "@metweave/grid";

/**
 * happy-dom 未实现 canvas 2d（getContext 返回 null），粒子层在创建时即取 context——
 * 与 streamline-layer.test 同法：吸收一切方法调用与属性写入的 Proxy 替身。
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

/** 均匀对场工厂（4×3，u=5、v=2——全场 5.4 m/s 有风，粒子可持续平流）。 */
const uniformPair = (): [Grid, Grid] => {
  const geometry = {
    nx: 4,
    ny: 3,
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
    stats: { min: 0, max: 5, p10: 5, p25: 5, p50: 5, p75: 5, p90: 5, p99: 5 },
    meta: {
      referenceTime: "2026-10-27T00:00Z",
      forecastHour: 0,
      source: "test",
      license: "",
      generated: "2026-10-27",
    },
  });
  return [
    { header: headerOf("UGRD"), values: gridFill(12, 5) },
    { header: headerOf("VGRD"), values: gridFill(12, 2) },
  ];
};

const maps: L.Map[] = [];
const layers: ParticleLayer[] = [];
afterEach(() => {
  for (const l of layers.splice(0)) l.remove();
  for (const m of maps.splice(0)) m.remove();
});
const freshMap = (): L.Map => {
  document.body.innerHTML = '<div id="map" style="width: 800px; height: 600px"></div>';
  const m = L.map("map", { center: [40, 104], zoom: 4 });
  maps.push(m);
  return m;
};

describe("addParticleLayer（粒子动画层装配与生命周期）", () => {
  it("选项校验：未知选项键与各参数非法值显式抛错", async () => {
    const map = freshMap();
    const [u, v] = uniformPair();
    await expect(addParticleLayer(map, u, v, { colour: "#000" } as never)).rejects.toThrow(
      /未知选项/,
    );
    await expect(addParticleLayer(map, u, v, { count: 0 })).rejects.toThrow(/count 非法/);
    await expect(addParticleLayer(map, u, v, { count: 1.5 })).rejects.toThrow(/count 非法/);
    await expect(addParticleLayer(map, u, v, { speedFactor: 0 })).rejects.toThrow(
      /speedFactor 非法/,
    );
    await expect(addParticleLayer(map, u, v, { fade: 0 })).rejects.toThrow(/fade 非法/);
    await expect(addParticleLayer(map, u, v, { fade: 1 })).rejects.toThrow(/fade 非法/);
    await expect(addParticleLayer(map, u, v, { width: 0 })).rejects.toThrow(/width 非法/);
    await expect(addParticleLayer(map, u, v, { calmThreshold: -1 })).rejects.toThrow(
      /calmThreshold 非法/,
    );
  });

  it("装配：pane mw-particle（z 358）、canvas 挂其下（尺寸面归真浏览器——happy-dom 无布局）", async () => {
    const map = freshMap();
    const [u, v] = uniformPair();
    const layer = await addParticleLayer(map, u, v, { count: 16 });
    layers.push(layer);
    const pane = map.getPane("mw-particle");
    expect(pane).toBeDefined();
    expect(pane?.style.zIndex).toBe("358");
    expect(layer.canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(pane?.contains(layer.canvas)).toBe(true);
    expect(Number.isInteger(layer.canvas.width)).toBe(true);
    expect(Number.isInteger(layer.canvas.height)).toBe(true);
  });

  it("生命周期：帧循环在替身 context 上跑不炸；remove 停帧清 DOM 且幂等", async () => {
    const map = freshMap();
    const [u, v] = uniformPair();
    const layer = await addParticleLayer(map, u, v, { count: 32 });
    layers.push(layer);
    await new Promise((resolve) => setTimeout(resolve, 60)); // 让 rAF 真跑几帧
    const pane = map.getPane("mw-particle");
    expect(pane?.contains(layer.canvas)).toBe(true);
    layer.remove();
    expect(pane?.contains(layer.canvas)).toBe(false);
    expect(() => layer.remove()).not.toThrow(); // 幂等
    await new Promise((resolve) => setTimeout(resolve, 30)); // remove 后无残留帧
  });

  it("scale 风速定档着色：色标选项被接受，帧循环照跑不炸", async () => {
    const map = freshMap();
    const [u, v] = uniformPair();
    const layer = await addParticleLayer(map, u, v, {
      count: 16,
      scale: { breaks: [1, 5, 10], colors: ["#0000ff", "#00ff00", "#ffff00", "#ff0000"] },
    });
    layers.push(layer);
    await new Promise((resolve) => setTimeout(resolve, 40));
    layer.remove();
  });

  it("respawnInViewport 视口感知重生：选项被接受，帧循环与地图平移照跑不炸", async () => {
    const map = freshMap();
    const [u, v] = uniformPair();
    const layer = await addParticleLayer(map, u, v, { count: 16, respawnInViewport: true });
    layers.push(layer);
    await new Promise((resolve) => setTimeout(resolve, 40));
    map.panBy([30, -20], { animate: false }); // moveend 触发重生域重算（happy-dom 无真布局，只锁不炸）
    await new Promise((resolve) => setTimeout(resolve, 40));
    layer.remove();
  });
});
