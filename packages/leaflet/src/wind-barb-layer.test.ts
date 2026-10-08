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
import { addWindBarbLayer, windBarbPath } from "./index";
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
});
