/**
 * 等值线内核单测（气压切片两能力）：contoursOf 的 threshold 序列/线种/几何换算/
 * 缺测环绕/退化场（小场手算断言），centersOf 的滑窗极值/深度护栏/贪心吸收/缺测邻域。
 * 几何全部在已知小场上手工推演（la0=40、lo0=100、di=dj=1：cell (行 r, 列 c) →
 * lat 40−r、lon 100+c；d3-contour 的点约定 ⟨c+0.5, r+0.5⟩＝格点中心）。
 */
import { describe, expect, it } from "vitest";
import { contoursOf, centersOf } from "./contours";
import { GridError } from "./errors";
import type { Grid } from "./format";

/** 最小网格工厂（几何约定见文件头）。 */
const tinyGrid = (values: number[], nx = 2, ny = 2): Grid => ({
  header: {
    version: 1,
    variable: "TEST",
    level: "msl",
    unit: "Pa",
    grid: { nx, ny, la0: 40, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
    stats: {
      min: Math.min(...values),
      max: Math.max(...values),
      p10: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p99: 0,
    },
    meta: { referenceTime: "", forecastHour: 0, source: "test", license: "", generated: "" },
  },
  values: Float32Array.from(values),
});

describe("contoursOf（等值线几何）", () => {
  it("线性斜坡：恰一条 interval 倍数线，iso 边界落在格点间半格处", () => {
    // 2×5 场 v=列号（0..4）：threshold (0,4) 内的 2 倍数＝{2}——线沿 x=1.5（格 1/2 之间）
    const grid = tinyGrid([0, 1, 2, 3, 4, 0, 1, 2, 3, 4], 5, 2);
    const lines = contoursOf(grid, { interval: 2, highlighted: [] });
    expect(lines.map((l) => l.value)).toEqual([2]);
    expect(lines[0]?.kind).toBe("major");
    expect(lines[0]?.rings.length).toBeGreaterThanOrEqual(1);
    const ring = lines[0]?.rings[0] ?? [];
    expect(ring.length).toBeGreaterThanOrEqual(4);
    // 环闭合（首尾点相同）；iso 边界＝格 1/2 之间的过心线 x=2.0（值恰等于 2 的格列）
    // ——d3 点空间 ⟨i+0.5⟩＝格心，坐标换算已退半格（与色斑栅格同一几何口径）
    const first = ring[0] ?? [0, 0];
    const last = ring[ring.length - 1] ?? [1, 1];
    expect(first[0]).toBe(last[0]);
    expect(first[1]).toBe(last[1]);
    expect(ring.some(([, lon]) => lon === 102)).toBe(true);
  });

  it("坑场：环绕坑心的闭合菱形环恰在半格中点（插值 t=0.5）", () => {
    // 3×3 场中心 0、周圈 4：threshold (0,4) 内 2 倍数＝{2}——≥2 域＝周圈八字，摊平环族
    // ＝域外框＋坑心孔环两道；孔环为绕中心格（lat 39、lon 101）的闭合菱形，四顶点在
    // 曼哈顿距离恰 0.5 处（过心插值 t=0.5）
    const grid = tinyGrid([4, 4, 4, 4, 0, 4, 4, 4, 4], 3, 3);
    const lines = contoursOf(grid, { interval: 2, highlighted: [] });
    expect(lines.map((l) => l.value)).toEqual([2]);
    const rings = lines[0]?.rings ?? [];
    expect(rings.length).toBe(2); // 域外框＋坑心孔环（GeoJSON 外环/洞环摊平）
    const hole = rings[1] ?? [];
    expect(hole.length).toBeGreaterThanOrEqual(4);
    const first = hole[0] ?? [0, 0];
    const last = hole[hole.length - 1] ?? [1, 1];
    expect(first[0]).toBe(last[0]); // 孔环同样闭合
    expect(first[1]).toBe(last[1]);
    for (const [lat, lon] of hole) {
      expect(Math.abs(lat - 39) + Math.abs(lon - 101)).toBeCloseTo(0.5, 9);
    }
  });

  it("双密度线种：interval 倍数＝major、minorInterval 倍数非 interval 倍数＝minor、特值线优先", () => {
    // 2×11 场 v=0..10：threshold (0,10) 内 2 倍数＝{2,4,6,8}；interval 4 → 8 为 major、
    // 2/6 为 minor；highlighted [4] 把 4（本为 interval 倍数）点名为特值线
    const grid = tinyGrid(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      11,
      2,
    );
    const spec = { interval: 4, minorInterval: 2, highlighted: [4] };
    const kindOf = new Map(contoursOf(grid, spec).map((l) => [l.value, l.kind]));
    expect(kindOf.get(2)).toBe("minor");
    expect(kindOf.get(4)).toBe("highlighted");
    expect(kindOf.get(6)).toBe("minor");
    expect(kindOf.get(8)).toBe("major");
    // 无特值线时 4 回落 major（interval 倍数）
    const plain = new Map(
      contoursOf(grid, { interval: 4, minorInterval: 2, highlighted: [] }).map((l) => [
        l.value,
        l.kind,
      ]),
    );
    expect(plain.get(4)).toBe("major");
  });

  it("值域端点上的倍数不出线（贴边环无信息量）", () => {
    // 2×2 全 4：min=max=4 退化 → 空；2×4 [2,4,6,8]：threshold (2,8) 内 2 倍数＝{4,6}
    expect(contoursOf(tinyGrid([4, 4, 4, 4]), { interval: 2, highlighted: [] })).toEqual([]);
    const lines = contoursOf(tinyGrid([2, 4, 6, 8, 2, 4, 6, 8], 4, 2), {
      interval: 2,
      highlighted: [],
    });
    expect(lines.map((l) => l.value)).toEqual([4, 6]);
  });

  it("convert 进显示空间定 threshold（Pa 场 ÷100 → hPa 倍数）", () => {
    const grid = tinyGrid([99600, 100000, 100400, 100800, 99600, 100000, 100400, 100800], 4, 2);
    const lines = contoursOf(grid, { interval: 4, highlighted: [] }, (v) => v / 100);
    expect(lines.map((l) => l.value)).toEqual([1000, 1004]); // (996, 1008) 内 4 倍数；1008=max 不出
  });

  it("缺测孔：等值线环绕 NaN 格不穿越（孔沿缺测方界绕行）", () => {
    // 5×5 坑场（中心 (2,2) 值 10、切比雪夫距离每格 −2），(2,3) 置 NaN：有限值域 6–10，
    // threshold 8 的 ≥8 域＝切比雪夫 ≤1 的十字形（缺测格本属其中、被挖去）——单道环
    // 沿缺测格方界绕行（d3-contour 把 NaN 按「低于一切阈值」处理，不跨缺测插值）
    const vals: number[] = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const v = 10 - Math.max(Math.abs(x - 2), Math.abs(y - 2)) * 2;
        vals.push(y === 2 && x === 3 ? Number.NaN : v);
      }
    }
    const lines = contoursOf(tinyGrid(vals, 5, 5), { interval: 2, highlighted: [] });
    expect(lines.map((l) => l.value)).toEqual([8]);
    const rings = lines[0]?.rings ?? [];
    expect(rings.length).toBe(1);
    const ring = rings[0] ?? [];
    expect(ring.length).toBeGreaterThanOrEqual(8);
    // 环点无一严格落入缺测格 (行 2, 列 3) 的方界内（lat (38±0.5)、lon (103±0.5)）
    for (const [lat, lon] of ring) {
      const inside = Math.abs(lat - 38) < 0.5 && Math.abs(lon - 103) < 0.5;
      expect(inside).toBe(false);
    }
  });

  it("口径非法显式抛错（interval 非正/minorInterval ≥ interval）", () => {
    const grid = tinyGrid([0, 1, 2, 3]);
    expect(() => contoursOf(grid, { interval: 0, highlighted: [] })).toThrow(GridError);
    expect(() => contoursOf(grid, { interval: -2, highlighted: [] })).toThrow(GridError);
    expect(() => contoursOf(grid, { interval: 2, minorInterval: 4, highlighted: [] })).toThrow(
      GridError,
    );
    expect(() => contoursOf(grid, { interval: 2, minorInterval: 0, highlighted: [] })).toThrow(
      GridError,
    );
  });

  it("场外特值线静默跳过（场内无该值即无线可描，非错误）", () => {
    const grid = tinyGrid([0, 1, 2, 3, 0, 1, 2, 3], 4, 2);
    const lines = contoursOf(grid, { interval: 2, highlighted: [99] });
    expect(lines.map((l) => l.value)).toEqual([2]);
    expect(lines.every((l) => l.kind !== "highlighted")).toBe(true);
  });
});

describe("centersOf（低压/高压中心检测）", () => {
  /** 8×8 坑场（cheb 距离定价）：中心 (4,4)、值随距离升——单一低压。 */
  const bowl = (base: number, step: number): Grid => {
    const vals: number[] = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        vals.push(base + Math.max(Math.abs(y - 4), Math.abs(x - 4)) * step);
      }
    }
    return tinyGrid(vals, 8, 8);
  };

  it("单一坑场出一个 low：位置/值精确，中心值即格点原值", () => {
    const centers = centersOf(bowl(1000, 2), { radius: 3 });
    const lows = centers.filter((c) => c.kind === "low");
    expect(lows).toHaveLength(1);
    expect(lows[0]?.lat).toBe(36); // 行 4 → 40−4
    expect(lows[0]?.lon).toBe(104); // 列 4 → 100+4
    expect(lows[0]?.value).toBe(1000);
  });

  it("convert 进显示空间检测（Pa 场 ÷100 → hPa 中心值）", () => {
    const centers = centersOf(bowl(100000, 200), { radius: 3, convert: (v) => v / 100 });
    const lows = centers.filter((c) => c.kind === "low");
    expect(lows).toHaveLength(1);
    expect(lows[0]?.value).toBe(1000);
  });

  it("纯斜坡无极值（minDepth 护栏拦掉域边缘的窗最小值带）", () => {
    const vals: number[] = [];
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) vals.push(1015 + y * 0.05);
    // 全场高差 0.95 < minDepth 1：边缘窗最小值带深度不足，不出中心
    expect(centersOf(tinyGrid(vals, 20, 20), { radius: 6, minDepth: 1 })).toEqual([]);
  });

  it("双独立系统：小半径各自成中心、大半径吸收合一（贪心按深度）", () => {
    const vals: number[] = [];
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 30; x++) {
        vals.push(
          1020 -
            8 * Math.exp(-(Math.hypot(y - 6, x - 8) ** 2 / 8)) -
            6 * Math.exp(-(Math.hypot(y - 6, x - 22) ** 2 / 8)),
        );
      }
    }
    const grid = tinyGrid(vals, 30, 12);
    const apart = centersOf(grid, { radius: 4, minDepth: 2 }).filter((c) => c.kind === "low");
    expect(apart).toHaveLength(2); // 相距 14 格 ≥ 半径 4：各自成中心
    expect(apart[0]?.value).toBeLessThan(apart[1]?.value ?? 0); // 深者在前（升序）
    const merged = centersOf(grid, { radius: 16, minDepth: 2 }).filter((c) => c.kind === "low");
    expect(merged).toHaveLength(1); // 半径 16 > 14：吸收合一、留深者
  });

  it("缺测邻域：NaN 不参与判定，坑心缺测时邻近环格接棒", () => {
    const vals: number[] = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const v = 1000 + Math.max(Math.abs(y - 2), Math.abs(x - 2)) * 3;
        vals.push(y === 2 && x === 2 ? Number.NaN : v);
      }
    }
    // 半径 4 吸收整圈并列极小（NaN 邻点不参与判定，坑心缺测时邻近环格接棒成唯一中心）
    const lows = centersOf(tinyGrid(vals, 5, 5), { radius: 4 }).filter((c) => c.kind === "low");
    expect(lows).toHaveLength(1);
    expect(lows[0]?.value).toBe(1003);
    expect(Number.isFinite(lows[0]?.lat)).toBe(true);
  });

  it("排序契约：low 值升序在前、high 值降序在后", () => {
    const vals: number[] = [];
    for (let y = 0; y < 25; y++) {
      for (let x = 0; x < 25; x++) {
        vals.push(
          1020 -
            6 * Math.exp(-(Math.hypot(y - 6, x - 6) ** 2 / 6)) -
            4 * Math.exp(-(Math.hypot(y - 6, x - 19) ** 2 / 6)) +
            5 * Math.exp(-(Math.hypot(y - 19, x - 12) ** 2 / 6)),
        );
      }
    }
    const centers = centersOf(tinyGrid(vals, 25, 25), { radius: 6, minDepth: 2 });
    const lowValues = centers.filter((c) => c.kind === "low").map((c) => c.value);
    const highValues = centers.filter((c) => c.kind === "high").map((c) => c.value);
    expect(lowValues.length).toBeGreaterThanOrEqual(2);
    expect(highValues.length).toBeGreaterThanOrEqual(1);
    const ascCopy = [...lowValues];
    ascCopy.sort((a, b) => a - b);
    expect(ascCopy).toEqual(lowValues);
    const descCopy = [...highValues];
    descCopy.sort((a, b) => b - a);
    expect(descCopy).toEqual(highValues);
  });

  it("口径非法显式抛错（radius 非正整数/minDepth 负）", () => {
    const grid = tinyGrid([0, 1, 2, 3]);
    expect(() => centersOf(grid, { radius: 0 })).toThrow(GridError);
    expect(() => centersOf(grid, { radius: 1.5 })).toThrow(GridError);
    expect(() => centersOf(grid, { minDepth: -1 })).toThrow(GridError);
  });
});
