// @vitest-environment happy-dom
/**
 * addHazardPolygonLayer 可测面：装配面（半透明多边形＋标签）、形心标签的落点
 * （鞋带公式形心）、persistent/tooltip 双形态、tooltip 类别行、输入面防线
 * （顶点数/坐标/选项校验——不静默纪律）。数据边界（只做呈现接口）见组件文档。
 */
import { afterEach, describe, expect, it } from "vitest";
import * as L from "leaflet";
import { addHazardPolygonLayer, type HazardPolygon } from "./index";

const maps: L.Map[] = [];
const layers: L.LayerGroup[] = [];
afterEach(() => {
  for (const l of layers.splice(0)) l.remove();
  for (const m of maps.splice(0)) m.remove();
});
const freshMap = (): L.Map => {
  document.body.innerHTML = '<div id="map" style="width: 800px; height: 600px"></div>';
  const m = L.map("map", { center: [30, 110], zoom: 5 });
  maps.push(m);
  return m;
};

describe("addHazardPolygonLayer（告警多边形层）", () => {
  it("装配：半透明多边形＋常驻形心标签；多边形顶点与输入一一对应", async () => {
    const map = freshMap();
    const square: HazardPolygon = {
      coords: [
        [30, 110],
        [30, 112],
        [32, 112],
        [32, 110],
      ],
      label: "示例告警区",
      kind: "样例",
    };
    const layer = await addHazardPolygonLayer(map, [square]);
    layers.push(layer);
    const polygon = layer.getLayers().find((c): c is L.Polygon => c instanceof L.Polygon);
    expect(polygon).toBeDefined();
    // Polygon.getLatLngs()＝环数组（外环为首环）——首环顶点与输入一一对应
    const rings = (polygon?.getLatLngs() ?? []) as L.LatLng[][];
    const ring = rings[0] ?? [];
    expect(ring).toHaveLength(4);
    expect(ring[0]?.lat).toBe(30);
    expect(ring[0]?.lng).toBe(110);
    // 半透明填充（fillOpacity 缺省 0.18）与描边色可读
    expect(polygon?.options.fillOpacity).toBe(0.18);
    expect(polygon?.options.color).toBe("#d05656");
    // 常驻标签：一枚 marker，文本含 label（kind 进标签副行）
    const markers = layer.getLayers().filter((c): c is L.Marker => c instanceof L.Marker);
    expect(markers).toHaveLength(1);
    expect(markers[0]?.getElement()?.textContent ?? "").toContain("示例告警区");
  });

  it("形心落点：矩形顶点的鞋带形心＝几何中心（[1,1]）", async () => {
    const map = freshMap();
    const layer = await addHazardPolygonLayer(map, [
      {
        coords: [
          [30, 110],
          [30, 112],
          [32, 112],
          [32, 110],
        ],
        label: "区",
      },
    ]);
    layers.push(layer);
    const marker = layer.getLayers().find((c): c is L.Marker => c instanceof L.Marker);
    const ll = marker?.getLatLng();
    expect(ll?.lat).toBeCloseTo(31, 6);
    expect(ll?.lng).toBeCloseTo(111, 6);
  });

  it("labelMode tooltip：不画常驻标签、悬停 tooltip 含 label 与类别行；label 缺省不画标签", async () => {
    const map = freshMap();
    const layer = await addHazardPolygonLayer(
      map,
      [
        {
          coords: [
            [30, 110],
            [30, 111],
            [31, 111],
          ],
          label: "区",
          kind: "大风蓝色",
        },
      ],
      { labelMode: "tooltip" },
    );
    layers.push(layer);
    expect(layer.getLayers().filter((c) => c instanceof L.Marker)).toHaveLength(0);
    const polygon = layer.getLayers().find((c): c is L.Polygon => c instanceof L.Polygon);
    const tip = (polygon?.getTooltip()?.getContent() as HTMLElement | undefined)?.textContent ?? "";
    expect(tip).toContain("区");
    expect(tip).toContain("类别：大风蓝色");
    const noLabel = await addHazardPolygonLayer(map, [
      {
        coords: [
          [30, 110],
          [30, 111],
          [31, 111],
        ],
      },
    ]);
    layers.push(noLabel);
    expect(noLabel.getLayers().filter((c) => c instanceof L.Marker)).toHaveLength(0);
    expect(noLabel.getLayers().filter((c) => c instanceof L.Polygon)).toHaveLength(1);
  });

  it("en locale：tooltip 类别行走英文词表", async () => {
    const map = freshMap();
    const layer = await addHazardPolygonLayer(
      map,
      [
        {
          coords: [
            [30, 110],
            [30, 111],
            [31, 111],
          ],
          label: "Zone",
          kind: "Sample",
        },
      ],
      { labelMode: "tooltip", locale: "en" },
    );
    layers.push(layer);
    const polygon = layer.getLayers().find((c): c is L.Polygon => c instanceof L.Polygon);
    const tip = (polygon?.getTooltip()?.getContent() as HTMLElement | undefined)?.textContent ?? "";
    expect(tip).toContain("Category: Sample");
  });

  it("输入面防线：顶点不足/坐标非法/未知选项/非法透明度与 labelMode 显式抛错", async () => {
    const map = freshMap();
    await expect(
      addHazardPolygonLayer(map, [
        {
          coords: [
            [30, 110],
            [30, 111],
          ],
        },
      ]),
    ).rejects.toThrow(/边界顶点不足/);
    await expect(
      addHazardPolygonLayer(map, [
        {
          coords: [
            [30, 110],
            [30, Number.NaN],
            [31, 111],
          ],
        },
      ]),
    ).rejects.toThrow(/坐标非法/);
    await expect(addHazardPolygonLayer(map, [], { colour: "#000" } as never)).rejects.toThrow(
      /未知选项/,
    );
    await expect(addHazardPolygonLayer(map, [], { fillOpacity: -1 })).rejects.toThrow(
      /fillOpacity 非法/,
    );
    await expect(
      addHazardPolygonLayer(map, [], { labelMode: "floating" as never }),
    ).rejects.toThrow(/labelMode 选项值/);
    await expect(addHazardPolygonLayer(map, [], { weight: -2 })).rejects.toThrow(/weight 非法/);
  });
});
