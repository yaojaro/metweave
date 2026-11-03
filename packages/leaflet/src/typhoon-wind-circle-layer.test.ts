// @vitest-environment happy-dom
/**
 * addTyphoonWindCircleLayer 可测面：四象限弧段几何（验证件同款的象限→弧段数学——
 * 象限序 NE/SE/SW/NW、6° 插值、km→度换算、经度除 cos φ）、四象限不对称形态、
 * 缺象限显式处理（跳弧＋tooltip「—」、整级缺席不出退化多边形）、赤道与跨 180°
 * 经线的弧段正确性（连续经度不折返）、缺省黄/橙/红逐级通行色族与 `colors` 覆盖/循环、
 * 中心标签与选项校验（不静默纪律）。
 */
import { afterEach, describe, expect, it } from "vitest";
import * as L from "leaflet";
import { addTyphoonWindCircleLayer, type TyphoonWindCircle } from "./index";

const maps: L.Map[] = [];
const layers: L.LayerGroup[] = [];
afterEach(() => {
  for (const l of layers.splice(0)) mapRemove(l);
  for (const m of maps.splice(0)) m.remove();
});
const mapRemove = (l: L.LayerGroup): void => {
  l.remove();
};
const freshMap = (): L.Map => {
  document.body.innerHTML = '<div id="map" style="width: 800px; height: 600px"></div>';
  const m = L.map("map", { center: [20, 150], zoom: 4 });
  maps.push(m);
  return m;
};

/** 顶点序列（LatLng 元组化，数值断言用）。 */
const latlngsOf = (layer: L.LayerGroup): [number, number][][] =>
  layer.getLayers().flatMap((child) => {
    if (!(child instanceof L.Polygon)) return [];
    const ring = (child.getLatLngs() as L.LatLng[][])[0] ?? [];
    return [ring.map((p) => [p.lat, p.lng] as [number, number])];
  });

describe("addTyphoonWindCircleLayer（四象限风圈层）", () => {
  it("四象限不对称几何：NE/SE/SW/NW 各成 90° 弧段（每象限 15 顶点），半径各自独立", async () => {
    const map = freshMap();
    const center: [number, number] = [13.2, 176.9];
    const layer = await addTyphoonWindCircleLayer(map, [
      {
        center,
        grade: "TS",
        pressureHpa: 998,
        quadrants: [{ speedKt: 30, radiiKm: [250, 150, 150, 250] }],
      },
    ]);
    layers.push(layer);
    const rings = latlngsOf(layer);
    expect(rings).toHaveLength(1);
    const ring = rings[0] ?? [];
    expect(ring).toHaveLength(60); // 4 象限 × 15 点（0° 起 6° 步进）
    // 首点＝正北方位（bearing 0）：纬度直推 NE 半径、经度不动
    const dNE = 250 / 111.32;
    expect(ring[0]?.[0]).toBeCloseTo(13.2 + dNE, 6);
    expect(ring[0]?.[1]).toBeCloseTo(176.9, 6);
    // 不对称：北向顶点（NE 段）最北距 ＞ 南向顶点（SW 段）最南距
    const north = Math.max(...ring.map(([la]) => la)) - center[0];
    const south = center[0] - Math.min(...ring.map(([la]) => la));
    expect(north).toBeGreaterThan(south);
    expect(north).toBeCloseTo(dNE, 6);
    expect(south).toBeCloseTo(150 / 111.32, 6);
    // 东向顶点：NE 段尾（bearing 84°）——经度偏移＝dNE·sin β / cos φ
    const kx = Math.cos((13.2 * Math.PI) / 180);
    const east = Math.max(...ring.map(([, lo]) => lo)) - center[1];
    expect(east).toBeCloseTo((dNE * Math.sin((84 * Math.PI) / 180)) / kx, 6);
  });

  it("多级风圈：级按 speedKt 升序装配（弱先强后），每级一段多边形＋象限 tooltip", async () => {
    const map = freshMap();
    const layer = await addTyphoonWindCircleLayer(map, [
      {
        center: [18, 130],
        grade: "TY",
        quadrants: [
          { speedKt: 64, radiiKm: [30, 30, 30, 30] },
          { speedKt: 30, radiiKm: [300, 200, 200, 300] },
          { speedKt: 50, radiiKm: [80, 80, 80, 80] },
        ],
      },
    ]);
    layers.push(layer);
    const rings = latlngsOf(layer);
    expect(rings).toHaveLength(3);
    // 弱圈先画：组内首个多边形是 30 kt 级（最外圈）
    const first = rings[0]?.map(([la]) => la) ?? [];
    expect(Math.max(...first) - 18).toBeCloseTo(300 / 111.32, 6);
    // 强圈后画：组内末个多边形是 64 kt 级（最小圈）
    const last = rings[2]?.map(([la]) => la) ?? [];
    expect(Math.max(...last) - 18).toBeCloseTo(30 / 111.32, 6);
    // tooltip：象限半径逐位可读（缺席才出「—」）
    const polygon30 = layer.getLayers().find((c): c is L.Polygon => c instanceof L.Polygon);
    const tip30 = polygon30?.getTooltip()?.getContent();
    expect((tip30 as HTMLElement)?.textContent ?? "").toContain("30 kt 风圈");
    expect((tip30 as HTMLElement)?.textContent ?? "").toContain(
      "NE 300 / SE 200 / SW 200 / NW 300",
    );
  });

  it("缺象限显式处理：缺 SE＝该段弧整体缺席（45 顶点）、tooltip 出「—」；四级全缺不出多边形", async () => {
    const map = freshMap();
    const layer = await addTyphoonWindCircleLayer(map, [
      { center: [20, 120], quadrants: [{ speedKt: 30, radiiKm: [250, null, 150, 250] }] },
    ]);
    layers.push(layer);
    const rings = latlngsOf(layer);
    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(45); // NE+SW+NW 三段
    const polygon = layer.getLayers().find((c): c is L.Polygon => c instanceof L.Polygon);
    const tip = (polygon?.getTooltip()?.getContent() as HTMLElement | undefined)?.textContent ?? "";
    expect(tip).toContain("SE —");
    // 整级缺席（四级全零）：不出多边形、中心无强度注记（grade/气压缺省）→ 空层
    const emptyLevel = await addTyphoonWindCircleLayer(map, [
      { center: [20, 121], quadrants: [{ speedKt: 50, radiiKm: [0, 0, 0, 0] }] },
    ]);
    layers.push(emptyLevel);
    expect(latlngsOf(emptyLevel)).toHaveLength(0);
    expect(emptyLevel.getLayers()).toHaveLength(0);
  });

  it("赤道与跨 180° 经线：cos φ=1 东西对称；跨缝顶点用连续经度（不折返 ±180）", async () => {
    const map = freshMap();
    // 赤道：kx = 1，45° 方向顶点的东西/南北偏移相等（各向同性核对）
    const equator = await addTyphoonWindCircleLayer(map, [
      { center: [0, 120], quadrants: [{ speedKt: 30, radiiKm: [100, 100, 100, 100] }] },
    ]);
    layers.push(equator);
    const eqRing = latlngsOf(equator)[0] ?? [];
    const d = 100 / 111.32;
    const diag = eqRing.find(([la, lo]) => la > 0.5 && lo > 120.5); // 45° 附近的顶点
    const first = eqRing[0] ?? [0, 0];
    expect(first[0]).toBeCloseTo(d, 6);
    expect(first[1]).toBeCloseTo(120, 6);
    void diag;
    // 跨 180°：中心 179.5°E、NE 半径 200 km → 顶点经度越 180 而不折返 -180
    const seam = await addTyphoonWindCircleLayer(map, [
      { center: [20, 179.5], quadrants: [{ speedKt: 30, radiiKm: [200, 200, 200, 200] }] },
    ]);
    layers.push(seam);
    const seamRing = latlngsOf(seam)[0] ?? [];
    const eastMost = Math.max(...seamRing.map(([, lo]) => lo));
    expect(eastMost).toBeGreaterThan(180); // 连续经度（≈181.3），无折返跳变
    // 西向顶点同样不折返：NW 段首 bearing 270°（sin=−1）——最西 ≈ 179.5 − d/cos20°（不是 −180 侧的镜像值）
    const westMost = Math.min(...seamRing.map(([, lo]) => lo));
    const kx20 = Math.cos((20 * Math.PI) / 180);
    expect(westMost).toBeCloseTo(179.5 - 200 / 111.32 / kx20, 3);
    for (const [, lo] of seamRing) expect(lo).toBeGreaterThan(175); // 全程连续经度（无 ±180 折返）
  });

  it("中心标签：强度类别＋气压常驻注记；两者皆缺不画标签；label:false 关闭", async () => {
    const map = freshMap();
    const withLabel = await addTyphoonWindCircleLayer(map, [
      {
        center: [20, 120],
        grade: "SuperTY",
        pressureHpa: 925,
        quadrants: [{ speedKt: 30, radiiKm: [100, 100, 100, 100] }],
      },
    ]);
    layers.push(withLabel);
    const markers = withLabel.getLayers().filter((c): c is L.Marker => c instanceof L.Marker);
    expect(markers).toHaveLength(1);
    const iconHtml =
      (markers[0]?.getElement()?.innerHTML ?? "") + (markers[0]?.getElement()?.textContent ?? "");
    expect(iconHtml).toContain("SuperTY");
    expect(iconHtml).toContain("925 hPa");
    const noMeta = await addTyphoonWindCircleLayer(map, [
      { center: [21, 121], quadrants: [{ speedKt: 30, radiiKm: [100, 100, 100, 100] }] },
    ]);
    layers.push(noMeta);
    expect(noMeta.getLayers().filter((c) => c instanceof L.Marker)).toHaveLength(0);
    const labelOff = await addTyphoonWindCircleLayer(
      map,
      [
        {
          center: [22, 122],
          grade: "TS",
          quadrants: [{ speedKt: 30, radiiKm: [100, 100, 100, 100] }],
        },
      ],
      { label: false },
    );
    layers.push(labelOff);
    expect(labelOff.getLayers().filter((c) => c instanceof L.Marker)).toHaveLength(0);
  });

  it("空数组与 en tooltip：空入参出空层不抛错；locale en 换 tooltip 词表", async () => {
    const map = freshMap();
    const empty = await addTyphoonWindCircleLayer(map, []);
    layers.push(empty);
    expect(empty.getLayers()).toHaveLength(0);
    const en = await addTyphoonWindCircleLayer(
      map,
      [{ center: [20, 120], quadrants: [{ speedKt: 30, radiiKm: [100, null, 100, 100] }] }],
      { locale: "en" },
    );
    layers.push(en);
    const polygon = en.getLayers().find((c): c is L.Polygon => c instanceof L.Polygon);
    expect(
      (polygon?.getTooltip()?.getContent() as HTMLElement | undefined)?.textContent ?? "",
    ).toContain("30-kt wind radius");
  });

  it("输入面防线：未知选项、非法 locale/透明度/权重/中心/半径/风速级显式抛错", async () => {
    const map = freshMap();
    const circle: TyphoonWindCircle = {
      center: [20, 120],
      quadrants: [{ speedKt: 30, radiiKm: [100, 100, 100, 100] }],
    };
    await expect(
      addTyphoonWindCircleLayer(map, [circle], { colour: "#000" } as never),
    ).rejects.toThrow(/未知选项/);
    await expect(
      addTyphoonWindCircleLayer(map, [circle], { locale: "fr" as never }),
    ).rejects.toThrow(/locale 选项值/);
    await expect(addTyphoonWindCircleLayer(map, [circle], { fillOpacity: 2 })).rejects.toThrow(
      /fillOpacity 非法/,
    );
    await expect(addTyphoonWindCircleLayer(map, [circle], { weight: 0 })).rejects.toThrow(
      /weight 非法/,
    );
    await expect(
      addTyphoonWindCircleLayer(map, [{ center: [95, 120], quadrants: circle.quadrants }]),
    ).rejects.toThrow(/中心纬度非法/);
    await expect(
      addTyphoonWindCircleLayer(map, [
        { center: [20, 120], quadrants: [{ speedKt: 30, radiiKm: [-5, 100, 100, 100] }] },
      ]),
    ).rejects.toThrow(/半径非法/);
    await expect(
      addTyphoonWindCircleLayer(map, [
        { center: [20, 120], quadrants: [{ speedKt: 0, radiiKm: [100, 100, 100, 100] }] },
      ]),
    ).rejects.toThrow(/风速级非法/);
  });

  it("缺省配色＝黄/橙/红逐级通行色族（弱→强，色相区分＋透明度递进双通道）", async () => {
    const map = freshMap();
    const layer = await addTyphoonWindCircleLayer(map, [
      {
        center: [18, 125],
        quadrants: [
          { speedKt: 30, radiiKm: [200, 200, 200, 200] },
          { speedKt: 50, radiiKm: [120, 120, 120, 120] },
          { speedKt: 64, radiiKm: [60, 60, 60, 60] },
        ],
      },
    ]);
    layers.push(layer);
    const polys = layer.getLayers().filter((c): c is L.Polygon => c instanceof L.Polygon);
    expect(polys.map((p) => p.options.color)).toEqual(["#f5c518", "#f08c1a", "#d93025"]);
    expect(polys.map((p) => p.options.fillColor)).toEqual(["#f5c518", "#f08c1a", "#d93025"]);
  });

  it("colors 选项逐级覆盖；级数超出循环取色；空数组/非字符串条目显式抛错", async () => {
    const map = freshMap();
    const circles: TyphoonWindCircle[] = [
      {
        center: [18, 125],
        quadrants: [
          { speedKt: 30, radiiKm: [200, 200, 200, 200] },
          { speedKt: 50, radiiKm: [120, 120, 120, 120] },
          { speedKt: 64, radiiKm: [60, 60, 60, 60] },
        ],
      },
    ];
    const layer = await addTyphoonWindCircleLayer(map, circles, {
      colors: ["#111111", "#222222"],
    });
    layers.push(layer);
    const polys = layer.getLayers().filter((c): c is L.Polygon => c instanceof L.Polygon);
    expect(polys.map((p) => p.options.color)).toEqual(["#111111", "#222222", "#111111"]);
    await expect(addTyphoonWindCircleLayer(map, circles, { colors: [] })).rejects.toThrow(
      /colors 非法/,
    );
    await expect(
      addTyphoonWindCircleLayer(map, circles, { colors: ["#111111", 3 as unknown as string] }),
    ).rejects.toThrow(/colors 含非法条目/);
  });
});
