// @vitest-environment happy-dom
/**
 * addArrowFieldLayer 可测面：选项校验（不静默纪律）、装配面——独立 pane 层级位次、
 * canvas 挂载、静态绘制在替身 context 上不炸、remove 清理幂等。等长/定向/与内核
 * arrowFieldOf 的格位对拍由 @metweave/grid 的 wind.test.ts 锁死（对拍契约测试）；
 * 像素面归真浏览器审查轮——happy-dom 无 canvas 2d，同 Proxy 替身法。
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as L from "leaflet";
import { addArrowFieldLayer, type ArrowFieldLayer } from "./index";
import { arrowFieldOf, type Grid, type GridHeader } from "@metweave/grid";

/** happy-dom 无 canvas 2d——吸收一切调用的 Proxy 替身（同 streamline/particle 层测试）。 */
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

/** 均匀西风对场工厂（5×4，u=5、v=0）：全场来向 270，箭头阵抽稀可预期。 */
const uniformPair = (): [Grid, Grid] => {
  const geometry = {
    nx: 5,
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
    { header: headerOf("UGRD"), values: Float32Array.from({ length: 20 }, () => 5) },
    { header: headerOf("VGRD"), values: Float32Array.from({ length: 20 }, () => 0) },
  ];
};

const maps: L.Map[] = [];
const layers: ArrowFieldLayer[] = [];
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

describe("addArrowFieldLayer（等长箭头 canvas 层装配）", () => {
  it("选项校验：未知选项键与非法 length/width 显式抛错", async () => {
    const map = freshMap();
    const [u, v] = uniformPair();
    const arrows = arrowFieldOf(u, v, { step: 2, calmThreshold: 1 });
    await expect(addArrowFieldLayer(map, arrows, { colour: "#000" } as never)).rejects.toThrow(
      /未知选项/,
    );
    await expect(addArrowFieldLayer(map, arrows, { length: 0 })).rejects.toThrow(/length 非法/);
    await expect(addArrowFieldLayer(map, arrows, { width: -1 })).rejects.toThrow(/width 非法/);
  });

  it("装配与静态绘制：pane mw-grid-arrow（z 356）、canvas 挂其下、remove 幂等", async () => {
    const map = freshMap();
    const [u, v] = uniformPair();
    const arrows = arrowFieldOf(u, v, { step: 2, calmThreshold: 1 });
    expect(arrows.length).toBeGreaterThan(0);
    const layer = await addArrowFieldLayer(map, arrows); // 创建即绘制一遍（替身 context 上不炸）
    layers.push(layer);
    const pane = map.getPane("mw-grid-arrow");
    expect(pane).toBeDefined();
    expect(pane?.style.zIndex).toBe("356");
    expect(pane?.contains(layer.canvas)).toBe(true);
    layer.remove();
    expect(pane?.contains(layer.canvas)).toBe(false);
    expect(() => layer.remove()).not.toThrow(); // 幂等
  });

  it("pointing 两态与空箭头阵：不抛错、canvas 在位（空阵＝清画布的合法态）", async () => {
    const map = freshMap();
    const [u, v] = uniformPair();
    const arrows = arrowFieldOf(u, v, { step: 2, calmThreshold: 1 });
    const from = await addArrowFieldLayer(map, arrows, { pointing: "from" });
    layers.push(from);
    const to = await addArrowFieldLayer(map, arrows, { pointing: "to" });
    layers.push(to);
    const empty = await addArrowFieldLayer(map, []);
    layers.push(empty);
    expect(map.getPane("mw-grid-arrow")).toBeDefined();
  });
});
