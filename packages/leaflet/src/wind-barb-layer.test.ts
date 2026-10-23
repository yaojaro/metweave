// @vitest-environment happy-dom
/**
 * addWindBarbLayer 可测面：选项校验（不静默纪律）、档案缺 barbs 口径的显式报错、
 * 矢量装配面——独立 pane 的层级位次、杆数与内核 windBarbsOf 一致、风羽 glyph 的
 * m/s 中国口径编码（旗 20／长划 4／短划 2——windBarbPath 纯函数直测）、方向旋转
 * （罗盘口径 rotate）、基色覆盖。几何/抽稀数学不在此重复——windBarbsOf 是零 DOM
 * 纯函数，由 @metweave/grid 的 wind.test.ts 锁死；此处只锁装配。
 */
import { afterEach, describe, expect, it } from "vitest";
import * as L from "leaflet";
import { addWindBarbLayer, windArrowPath, windBarbPath } from "./index";
import { windProfile, type Grid, type GridHeader } from "@metweave/grid";

/** u/v 成对网格工厂（2×2）：(3,0) 西风 3、(0,3) 南分量 3、(0,0.5) 静风、(−20,0) 东风 20（旗）。 */
const testPair = (): [Grid, Grid] => {
  const geometry = {
    nx: 2,
    ny: 2,
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
    stats: { min: 0, max: 20, p10: 1, p25: 2, p50: 3, p75: 5, p90: 12, p99: 20 },
    meta: {
      referenceTime: "2026-10-06T18:00Z",
      forecastHour: 0,
      source: "test",
      license: "",
      generated: "2026-10-07",
    },
  });
  return [
    { header: headerOf("UGRD"), values: Float32Array.from([3, 0, 0, -20]) },
    { header: headerOf("VGRD"), values: Float32Array.from([0, 3, 0.5, 0]) },
  ];
};

/** step 1 口径（小场全格出杆——档案 step 10 是中国域密度，装配测试用密度无关口径）。 */
const denseProfile = { ...windProfile, barbs: { step: 1, calmThreshold: 1 } };

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

describe("windBarbPath（风羽 glyph，m/s 中国口径）", () => {
  it("纯杆：风速 <2 m/s 只画杆（方向语义在、速度不足一短划）", () => {
    const p = windBarbPath(1.5);
    expect(p.stroke).toBe("M16 16 L16 2"); // 站心 → 梢（恒向上＝北）
    expect(p.fill).toBe("");
  });

  it("短划 2 m/s：1.5–6 m/s 落 1 长划＋（≥6 再加）1 短划", () => {
    expect(windBarbPath(2).stroke).toBe("M16 16 L16 2 M16 2 L12 6"); // 杆＋1 短划
    expect(windBarbPath(5).stroke).toBe("M16 16 L16 2 M16 2 L8.5 9"); // 4＋余 1：1 长划
    expect(windBarbPath(6).stroke).toBe("M16 16 L16 2 M16 2 L8.5 9 M16 7 L12 11"); // 4＋2：长＋短
  });

  it("三角旗 20 m/s：闭合填充子路径（Z 收尾），旗后余量继续长/短划", () => {
    const p20 = windBarbPath(20);
    expect(p20.fill).toMatch(/ L16 10 L8 6 Z$/); // 旗：杆点 (16,2)→(16,10)→左 apex (8,6) 闭合
    expect(p20.stroke).toBe("M16 16 L16 2"); // 恰 20：旗吃满、无划
    const p26 = windBarbPath(26); // 20＋4＋2：旗＋长划＋短划
    expect(p26.fill).not.toBe("");
    expect(p26.stroke).toContain("M16 10 L8.5 17"); // 旗后 4 m/s 长划（旗底 y=10 起）
    expect(p26.stroke).toContain("M16 15 L12 19"); // 再 2 m/s 短划
  });
});

describe("windBarbPath（kt 国际航空口径，0.3.2 T2）", () => {
  it("kt 刻度：旗 50／长划 10／短划 5——39 kt 无旗、3 长划＋1 短划（与 20 m/s 的 1 旗形成对照）", () => {
    const p39 = windBarbPath(39, { unit: "kt" });
    expect(p39.fill).toBe(""); // 39 < 50：无旗
    expect(p39.stroke).toBe("M16 16 L16 2 M16 2 L8.5 9 M16 7 L8.5 14 M16 12 L8.5 19 M16 17 L12 21");
    // 同一根杆在 m/s 口径下是 1 旗 + 4 长划 + 1 短划（39 m/s）
    const p39mps = windBarbPath(39);
    expect(p39mps.fill).not.toBe("");
  });

  it("kt 三角旗 50：闭合填充子路径，恰 50 无划", () => {
    const p50 = windBarbPath(50, { unit: "kt" });
    expect(p50.fill).toMatch(/ L16 10 L8 6 Z$/);
    expect(p50.stroke).toBe("M16 16 L16 2");
  });

  it("默认 m/s 口径逐字节冻结（v0.3.1 输出表——重构后不得漂移）", () => {
    // 本表由 v0.3.1 的 windBarbPath 原实现生成（独立审查要求：不能拿「默认＝显式 m/s」
    // 这种恒真断言给零破坏背书）。含浮点边界（19.999999 不出旗、3.999999 落短划）、
    // 负数与 NaN 的钳零行为（v0.3.1 是 Math.max(0, speed)）。
    const FROZEN: ReadonlyArray<readonly [number, string, string]> = [
      [0, "M16 16 L16 2", ""],
      [1.5, "M16 16 L16 2", ""],
      [1.9999999, "M16 16 L16 2 M16 2 L12 6", ""],
      [2, "M16 16 L16 2 M16 2 L12 6", ""],
      [3.999999, "M16 16 L16 2 M16 2 L12 6", ""],
      [5, "M16 16 L16 2 M16 2 L8.5 9", ""],
      [6, "M16 16 L16 2 M16 2 L8.5 9 M16 7 L12 11", ""],
      [
        19.999999,
        "M16 16 L16 2 M16 2 L8.5 9 M16 7 L8.5 14 M16 12 L8.5 19 M16 17 L8.5 24 M16 22 L12 26",
        "",
      ],
      [20, "M16 16 L16 2", "M16 2 L16 10 L8 6 Z"],
      [26, "M16 16 L16 2 M16 10 L8.5 17 M16 15 L12 19", "M16 2 L16 10 L8 6 Z"],
      [33, "M16 16 L16 2 M16 10 L8.5 17 M16 15 L8.5 22 M16 20 L8.5 27", "M16 2 L16 10 L8 6 Z"],
      [
        39,
        "M16 16 L16 2 M16 10 L8.5 17 M16 15 L8.5 22 M16 20 L8.5 27 M16 25 L8.5 32 M16 30 L12 34",
        "M16 2 L16 10 L8 6 Z",
      ],
      [
        65,
        "M16 16 L16 2 M16 26 L8.5 33",
        "M16 2 L16 10 L8 6 Z M16 10 L16 18 L8 14 Z M16 18 L16 26 L8 22 Z",
      ],
      [-5, "M16 16 L16 2", ""],
      [Number.NaN, "M16 16 L16 2", ""],
    ];
    for (const [speed, stroke, fill] of FROZEN) {
      expect(windBarbPath(speed)).toEqual({ stroke, fill });
    }
  });

  it("负数/非有限钳到 0（v0.3.1 已发版行为，本版不改）", () => {
    expect(windBarbPath(-5)).toEqual(windBarbPath(0));
    expect(windBarbPath(Number.NaN)).toEqual(windBarbPath(0));
  });

  it('未知选项与非法 unit 显式抛错；"mps" 是合法别名（IR 的写法直接用）', () => {
    expect(() => windBarbPath(5, { units: "kt" } as never)).toThrow(/未知选项/);
    expect(() => windBarbPath(5, { unit: "kmh" as never })).toThrow(/不受支持/);
    expect(windBarbPath(20, { unit: "mps" })).toEqual(windBarbPath(20));
  });
});

/** 反解 path 里的全部数字（长度线性断言用）。 */
const numsOf = (s: string): number[] => s.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];

/** 风羽/箭头 glyph 盒边长（32×32，站心 16,16）——坐标越界即被 SVG 裁掉。 */
const BOX_LIMIT = 32;

/** 一根杆身 path 的终点相对站心 (16,16) 的距离（长度线性断言用）。 */
const shaftLengthOf = (path: string): number => {
  const [, , x1, y1] = numsOf(path);
  return Math.hypot((x1 ?? 16) - 16, (y1 ?? 16) - 16);
};

describe("windArrowPath（纯方向件，0.3.2 T3）", () => {
  it("方向＝气象来向：0° 指北（y 减小）、90° 指东（x 增大）、180° 指南", () => {
    expect(windArrowPath(0).stroke).toBe("M16 16 L16 8.85");
    expect(windArrowPath(90).stroke).toBe("M16 16 L23.15 16");
    expect(windArrowPath(180).stroke).toBe("M16 16 L16 23.15");
    // 箭镞是闭合填充三角（fill），杆身是描线（stroke）——与风羽同构
    expect(windArrowPath(0).fill).toBe("M16 5 L17.925 8.85 L14.075 8.85 Z");
    expect(windArrowPath(90).fill).toBe("M27 16 L23.15 17.925 L23.15 14.075 Z");
  });

  it("pointing：to ＝ 来向 +180°（去向），from 为缺省（与风羽杆同向）", () => {
    expect(windArrowPath(0, { pointing: "to" })).toEqual(windArrowPath(180));
    expect(windArrowPath(90, { pointing: "to" })).toEqual(windArrowPath(270));
    expect(() => windArrowPath(0, { pointing: "up" } as never)).toThrow(/pointing/);
  });

  it("缺省长度不出 32×32 glyph 盒（四正方向 + 45° 斜向的坐标全在 [0,32]）", () => {
    for (const direction of [0, 45, 90, 135, 180, 225, 270, 315, 360]) {
      const paths = windArrowPath(direction);
      for (const value of numsOf(`${paths.stroke} ${paths.fill}`)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(BOX_LIMIT);
      }
    }
  });

  it("长度线性：全长翻倍，杆身与箭镞同比例", () => {
    const a = windArrowPath(45, { length: 20 });
    const b = windArrowPath(45, { length: 40 });
    // path 坐标保留三位小数，故用 3 位精度比较（不是实现误差）
    expect(shaftLengthOf(b.stroke) / shaftLengthOf(a.stroke)).toBeCloseTo(2, 3);
  });

  it("校验：方向越界/非有限、length 非正、未知选项键", () => {
    expect(() => windArrowPath(-1)).toThrow(/方向非法/);
    expect(() => windArrowPath(361)).toThrow(/方向非法/);
    expect(() => windArrowPath(Number.NaN)).toThrow(/方向非法/);
    expect(() => windArrowPath(0, { length: 0 })).toThrow(/length 非法/);
    expect(() => windArrowPath(0, { length: -3 })).toThrow(/length 非法/);
    expect(() => windArrowPath(0, { size: 10 } as never)).toThrow(/未知选项/);
  });
});

describe("addWindBarbLayer", () => {
  it("未知选项运行时抛错（拼写错误不静默）", async () => {
    const map = freshMap();
    const [u, v] = testPair();
    await expect(
      addWindBarbLayer(map, u, v, denseProfile, { colour: "#000" } as never),
    ).rejects.toThrow('addWindBarbLayer 收到未知选项 "colour"');
  });

  it("档案缺风向杆口径显式报错（filled 要素不背杆，不静默空层）", async () => {
    const map = freshMap();
    const [u, v] = testPair();
    const barbless = { ...windProfile, barbs: undefined, renderForm: "filled" as const };
    await expect(addWindBarbLayer(map, u, v, barbless)).rejects.toThrow(/缺风向杆口径/);
  });

  it("装配：独立 pane mw-grid-barb 落 z 365（等值线 360 之上、矢量 400 之下）；杆数＝内核口径（静风滤除）", async () => {
    const map = freshMap();
    const [u, v] = testPair();
    const group = await addWindBarbLayer(map, u, v, denseProfile);
    const pane = map.getPane("mw-grid-barb");
    expect(pane).toBeDefined();
    expect(pane?.style.zIndex).toBe("365");
    expect(map.hasLayer(group)).toBe(true);
    // 4 格中静风 (0,0.5) 滤除 → 3 杆（windBarbsOf 数学由 grid 包测试锁死，此处锁装配等数）
    expect(pane?.querySelectorAll(".mw-barb-icon svg").length).toBe(3);
    expect(map.getPane("mw-grid")).toBeUndefined(); // 杆层不代建色斑 pane（两 API 正交）
  });

  it("风羽 glyph 与方向旋转：杆＋划按速度编码、g transform 按罗盘方向旋转、svg aria-hidden", async () => {
    const map = freshMap();
    const [u, v] = testPair();
    await addWindBarbLayer(map, u, v, denseProfile);
    const pane = map.getPane("mw-grid-barb");
    const svgs = Array.from(pane?.querySelectorAll(".mw-barb-icon svg") ?? []);
    expect(svgs.length).toBe(3);
    for (const svg of svgs) expect(svg.getAttribute("aria-hidden")).toBe("true");
    // 方向：西风 270（u=3,v=0）、南风 180（u=0,v=3 向北吹）、东风 20 m/s 来向 90（u=−20 带旗）
    const rotations = svgs.map((s) => s.querySelector("g")?.getAttribute("transform") ?? "");
    expect(rotations.filter((r) => r.startsWith("rotate(270 "))).toHaveLength(1);
    expect(rotations.filter((r) => r.startsWith("rotate(180 "))).toHaveLength(1);
    expect(rotations.filter((r) => r.startsWith("rotate(90 "))).toHaveLength(1);
    // 20 m/s 杆带旗（fill 子路径在）与杆划（stroke 子路径在）；3 m/s 杆只有杆＋短划无旗
    const filled = svgs.filter(
      (s) => s.querySelectorAll("path[fill]:not([fill='none'])").length > 0,
    );
    expect(filled).toHaveLength(1);
    const strokePaths = Array.from(pane?.querySelectorAll("path[stroke]") ?? []);
    expect(strokePaths.length).toBeGreaterThanOrEqual(3); // 每杆至少一根描线 path
  });

  it("基色选项：描线与旗填充随色（缺省深灰蓝可覆盖）", async () => {
    const map = freshMap();
    const [u, v] = testPair();
    await addWindBarbLayer(map, u, v, denseProfile, { color: "#123456" });
    const pane = map.getPane("mw-grid-barb");
    expect(
      Array.from(pane?.querySelectorAll("path") ?? []).every(
        (p) => p.getAttribute("stroke") === "#123456" || p.getAttribute("fill") === "#123456",
      ),
    ).toBe(true);
  });

  it("unit kt：场是 m/s 时层内换算（20 m/s → 39 kt → 无旗），缺省口径不受影响", async () => {
    const mapKt = freshMap();
    const [uk, vk] = testPair();
    await addWindBarbLayer(mapKt, uk, vk, denseProfile, { unit: "kt" });
    const ktSvgs = Array.from(
      mapKt.getPane("mw-grid-barb")?.querySelectorAll(".mw-barb-icon svg") ?? [],
    );
    const ktFilled = ktSvgs.filter(
      (s) => s.querySelectorAll("path[fill]:not([fill='none'])").length > 0,
    );
    // 20 m/s ≈ 38.9 kt：不足一面 50 kt 旗（m/s 口径下同一根杆有旗——见上一个测试）
    expect(ktFilled).toHaveLength(0);
    expect(ktSvgs).toHaveLength(3);
  });

  it("LOD：档案声明 lod 时按当前 zoom 抽稀，zoomend 重绘（放大更密）；移除层后解绑监听", async () => {
    document.body.innerHTML = '<div id="map" style="width: 800px; height: 600px"></div>';
    const map2 = L.map("map", { center: [40, 104], zoom: 4 });
    maps.push(map2);
    const [u, v] = testPair();
    const lodProfile = {
      ...windProfile,
      barbs: {
        step: 1,
        calmThreshold: 1,
        lod: [
          { zoom: 0, step: 2 },
          { zoom: 6, step: 1 },
        ],
      },
    };
    const group = await addWindBarbLayer(map2, u, v, lodProfile);
    const count = (): number =>
      map2.getPane("mw-grid-barb")?.querySelectorAll(".mw-barb-icon svg").length ?? 0;
    // zoom 4 命中 step 2：2×2 场只出 (0,0) 一格 1 杆
    expect(count()).toBe(1);
    map2.setZoom(8, { animate: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    // zoom 8 命中 step 1：4 格去静风 → 3 杆
    expect(count()).toBe(3);
    // 移层后 zoom 不再重绘（handler 已解绑，不留悬空监听）
    map2.removeLayer(group);
    map2.setZoom(4, { animate: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(count()).toBe(0);
    // 重新挂回：监听必须回来（once 绑法会在第二段生命周期静默失效——独立审查 P1-2）
    group.addTo(map2);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(count()).toBe(1); // 当前 zoom 4 → step 2
    map2.setZoom(8, { animate: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(count()).toBe(3); // zoom 8 → step 1，LOD 仍生效
  });
});
