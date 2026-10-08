// @vitest-environment happy-dom
/**
 * addContourLayer 可测面：选项校验（不静默纪律）、档案缺 contours 口径的显式报错、
 * 矢量装配面——独立 pane 的层级位次、SVG polyline 描线、常规线数值标注、L/H 中心
 * 标注（含中心值）、labels/centers 开关、特值线接线（highlighted 线种红色加粗＋
 * 标注同色加粗——500hPa 高度切片）。几何正确性不在此重复——contoursOf/centersOf
 * 是零 DOM 纯函数，由 @metweave/grid 的 contours.test.ts 手算锁死；此处只锁装配。
 */
import { afterEach, describe, expect, it } from "vitest";
import * as L from "leaflet";
import { addContourLayer } from "./index";
import { prmslProfile, ghProfile, tmpProfile, type Grid, type GridHeader } from "@metweave/grid";

/**
 * 8×8 坑场（Pa，切比雪夫距离定价 2 hPa/格）：显示空间 1000–1008 hPa——阈值 1002/1004/
 * 1006 三条常规线（2 hPa 间隔？不——prmsl 口径 4/2：1002/1006 为加密、1004 常规）＋
 * 中心 (4,4) 一个 low（1000）＋边框并列 high 吸收为一个 H。
 */
const testGrid = (): Grid => {
  const { nx, ny } = { nx: 8, ny: 8 };
  const values = new Float32Array(nx * ny);
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      values[y * nx + x] = (1000 + Math.max(Math.abs(y - 4), Math.abs(x - 4)) * 2) * 100;
    }
  }
  return {
    header: {
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
        source: "test",
        license: "",
        generated: "2026-10-07",
      },
    } satisfies GridHeader,
    values,
  };
};

const maps: L.Map[] = [];
afterEach(() => {
  for (const m of maps.splice(0)) m.remove();
  document.head.querySelectorAll("style").forEach((s) => s.remove()); // 样式注入幂等性跨例隔离
});
const freshMap = (): L.Map => {
  document.body.innerHTML = '<div id="map" style="width: 800px; height: 600px"></div>';
  const m = L.map("map", { center: [40, 104], zoom: 4 });
  maps.push(m);
  return m;
};

describe("addContourLayer", () => {
  it("未知选项运行时抛错（拼写错误不静默）", async () => {
    const map = freshMap();
    await expect(
      addContourLayer(map, testGrid(), prmslProfile, { labelled: true } as never),
    ).rejects.toThrow('addContourLayer 收到未知选项 "labelled"');
  });

  it("档案缺等值线口径显式报错（留位要素未接线，不静默空层）", async () => {
    const map = freshMap();
    const contourless = { ...tmpProfile, contours: undefined };
    await expect(addContourLayer(map, testGrid(), contourless)).rejects.toThrow(/缺等值线口径/);
  });

  it("装配：独立 pane mw-grid-contour 落 z 360（色斑 350 之上、矢量 400 之下）＋SVG 描线", async () => {
    const map = freshMap();
    const group = await addContourLayer(map, testGrid(), prmslProfile);
    const pane = map.getPane("mw-grid-contour");
    expect(pane).toBeDefined();
    expect(pane?.style.zIndex).toBe("360");
    expect(map.hasLayer(group)).toBe(true);
    // 阈值 1002/1004/1006（interval 4 常规＝1004、minorInterval 2 加密＝1002/1006）
    // ×各两道环（域外框＋内环——场在图缘以上出域，等值线沿图缘走＝真实行为）＝6 条 path
    expect(pane?.querySelectorAll("path").length).toBe(6);
    expect(map.getPane("mw-grid")).toBeUndefined(); // 等值线层不代建色斑 pane（两 API 正交）
  });

  it("层回收：removeLayer(group) 连带回收 SVG renderer（renderer 不随组回收会累积泄漏）", async () => {
    const map = freshMap();
    const group = await addContourLayer(map, testGrid(), prmslProfile);
    const pane = map.getPane("mw-grid-contour");
    expect(pane?.querySelectorAll("svg").length).toBeGreaterThan(0); // renderer 容器在场
    map.removeLayer(group);
    expect(pane?.querySelectorAll("svg").length).toBe(0); // 随组回收——反复 remove+add 不累积空 SVG
  });

  it("数值标注：常规线（1004）标注、加密线（1002/1006）按惯例不标注", async () => {
    const map = freshMap();
    await addContourLayer(map, testGrid(), prmslProfile);
    const pane = map.getPane("mw-grid-contour");
    const labels = Array.from(pane?.querySelectorAll(".mw-contour-icon > span") ?? []).map(
      (s) => s.textContent,
    );
    expect(labels).toEqual(["1004", "1004", "1004"]); // 唯一常规线两道环：外框 27° → 2 处＋内环 12° → 1 处
  });

  it("L/H 中心标注：坑心一个「L」＋边框吸收为一个「H」，含中心 hPa 值与可读名称", async () => {
    const map = freshMap();
    await addContourLayer(map, testGrid(), prmslProfile);
    const pane = map.getPane("mw-grid-contour");
    const low = pane?.querySelector(".mw-center-icon.mw-center-low");
    const high = pane?.querySelector(".mw-center-icon.mw-center-high");
    expect(low).not.toBeNull();
    expect(low?.querySelector(".mw-center-letter")?.textContent).toBe("L");
    expect(low?.querySelector(".mw-center-val")?.textContent).toBe("1000"); // 中心 hPa 值
    expect(low?.querySelector("span[role=img]")?.getAttribute("aria-label")).toContain("低压中心");
    expect(high).not.toBeNull();
    expect(high?.querySelector(".mw-center-letter")?.textContent).toBe("H");
    expect(high?.querySelector(".mw-center-val")?.textContent).toBe("1008");
  });

  it("displayUnit 含引号经属性转义：aria-label 完整闭合不断裂（宿主可传任意串）", async () => {
    const map = freshMap();
    // 档案 displayUnit 是宿主可覆写面（自定要素/改单位）——含 `"` 时未转义会把
    // aria-label 属性提前截断，`)"` 泄成游离文本；转义后 DOM 读回应为完整原串
    const hostile = { ...prmslProfile, displayUnit: 'hPa(")' };
    await addContourLayer(map, testGrid(), hostile);
    const pane = map.getPane("mw-grid-contour");
    const low = pane?.querySelector(".mw-center-icon.mw-center-low span[role=img]");
    expect(low?.getAttribute("aria-label")).toContain('hPa(")');
    expect(low?.querySelector(".mw-center-letter")?.textContent).toBe("L");
  });

  it("labels:false 只描线不出数值标注；centers:false 不出 L/H 标注（样式开关不特判要素）", async () => {
    const map = freshMap();
    await addContourLayer(map, testGrid(), prmslProfile, { labels: false, centers: false });
    const pane = map.getPane("mw-grid-contour");
    expect(pane?.querySelectorAll("path").length).toBe(6); // 线照描
    expect(pane?.querySelectorAll(".mw-contour-icon").length).toBe(0);
    expect(pane?.querySelectorAll(".mw-center-icon").length).toBe(0);
  });

  it("自定义基色：每层标注色内联跟随（异色多层不串色——注入样式纯结构、幂等单节点）", async () => {
    const map = freshMap();
    await addContourLayer(map, testGrid(), prmslProfile, { color: "#123456" });
    await addContourLayer(map, testGrid(), prmslProfile, { color: "#654321" });
    // 结构样式只注入一次（颜色不进 CSS——烤进 CSS 的色值在异色二次层上固化首色，即本回归锁所防）
    expect(document.querySelectorAll("#mw-contour-style").length).toBe(1);
    const pane = map.getPane("mw-grid-contour");
    const labelStyles = Array.from(pane?.querySelectorAll(".mw-contour-icon > span") ?? [])
      .map((s) => s.getAttribute("style") ?? "")
      // 本数组即 map 新建副本，sort 变异无外溢（本包 lib 目标无 toSorted）
      // oxlint-disable-next-line unicorn/no-array-sort
      .sort((a, b) => a.localeCompare(b));
    // 每层 3 枚「1004」标注，各自携带本层基色（polyline 线色本就内联正确——线与标注同源同色）
    expect(labelStyles).toEqual([
      "color:#123456",
      "color:#123456",
      "color:#123456",
      "color:#654321",
      "color:#654321",
      "color:#654321",
    ]);
  });
});

/**
 * 8×8 穹顶场（gpm，切比雪夫距离定价 40 gpm/格）：值域 (5740, 5900)——60 gpm 倍数
 * 5760/5820/5880 各一条闭合环（5880 兼为 60 的倍数，线种仍归 highlighted 特值优先）＋
 * 中心 (4,4) 一个 high（5900）＋边框并列 low 吸收为一个 L。gh 档案口径直用。
 */
const domeGrid = (): Grid => {
  const { nx, ny } = { nx: 8, ny: 8 };
  const values = new Float32Array(nx * ny);
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      values[y * nx + x] = 5900 - Math.max(Math.abs(y - 4), Math.abs(x - 4)) * 40;
    }
  }
  return {
    header: {
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
        source: "test",
        license: "",
        generated: "2026-10-07",
      },
    } satisfies GridHeader,
    values,
  };
};

describe("addContourLayer 特值线接线（gh——highlighted 线种红色加粗＋标注同色）", () => {
  it("5880 线副高红加粗（stroke≠基色、weight 2.2），常规线 5760/5820 走基色标值", async () => {
    const map = freshMap();
    await addContourLayer(map, domeGrid(), ghProfile);
    const pane = map.getPane("mw-grid-contour");
    const paths = Array.from(pane?.querySelectorAll("path") ?? []);
    expect(paths).toHaveLength(3); // 5760/5820/5880 各一条闭合环
    const byStroke = new Map<string, Element[]>();
    for (const p of paths) {
      const key = p.getAttribute("stroke") ?? "";
      byStroke.set(key, [...(byStroke.get(key) ?? []), p]);
    }
    expect(byStroke.get("#33506b")).toHaveLength(2); // 常规线基色
    const highlighted = byStroke.get("#c0392b"); // 特值线缺省副高红（气象惯例）
    expect(highlighted).toHaveLength(1);
    expect(highlighted?.[0]?.getAttribute("stroke-width")).toBe("2.2"); // 加粗
    expect(byStroke.get("#33506b")?.[0]?.getAttribute("stroke-width")).toBe("1.4");
  });

  it("特值线数值标注同色加粗类（mw-contour-hl 只挂 5880，常规线标注不带）", async () => {
    const map = freshMap();
    await addContourLayer(map, domeGrid(), ghProfile);
    const pane = map.getPane("mw-grid-contour");
    const spans = Array.from(pane?.querySelectorAll(".mw-contour-icon > span") ?? []);
    // 5760 长环 2 处、5820 中环 1 处（≥3° 起标、每 10° 一处至多 3 处）＋5880 小环 1 处
    // （特值线必标：不受 3° 起标门槛——认知锚线与值不可分）
    expect(spans.map((s) => s.textContent)).toEqual(["5760", "5760", "5820", "5880"]);
    const hl = spans.filter((s) => s.classList.contains("mw-contour-hl"));
    expect(hl).toHaveLength(1);
    expect(hl[0]?.textContent).toBe("5880");
    expect(hl[0]?.getAttribute("style")).toContain("#c0392b"); // 特值线标注随线着色（span 内联携带）
    expect(
      spans.find((s) => !s.classList.contains("mw-contour-hl"))?.getAttribute("style"),
    ).toContain("#33506b"); // 常规线标注走基色（同内联）
  });

  it("highlightColor 选项自定义：特值线与标注样式随色（缺省副高红可覆盖）", async () => {
    const map = freshMap();
    await addContourLayer(map, domeGrid(), ghProfile, { highlightColor: "#9b59b6" });
    const pane = map.getPane("mw-grid-contour");
    expect(
      Array.from(pane?.querySelectorAll("path") ?? []).some(
        (p) => p.getAttribute("stroke") === "#9b59b6",
      ),
    ).toBe(true);
    const hl = pane?.querySelector(".mw-contour-icon > span.mw-contour-hl");
    expect(hl?.getAttribute("style")).toContain("#9b59b6"); // 特值线标注随选项着色（span 内联携带）
  });

  it("labels:false 特值线也不标注（开关语义与常规线一致，样式开关不特判线种）", async () => {
    const map = freshMap();
    await addContourLayer(map, domeGrid(), ghProfile, { labels: false });
    const pane = map.getPane("mw-grid-contour");
    expect(pane?.querySelectorAll("path").length).toBe(3); // 线照描（含特值线）
    expect(pane?.querySelectorAll(".mw-contour-icon").length).toBe(0);
  });
});
