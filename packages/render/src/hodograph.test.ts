// @vitest-environment happy-dom
/**
 * hodograph（W-11 高空风图）可测面：验收口径全量——≥8 层门槛、风矢量→u/v 端点的
 * 极坐标几何（西风端点在 +u、北风在 −v）、端点连线＝层间切变矢量（线数＝点数−1、
 * 线长与切变大小同构）、低空段（0–1 km）高亮分色、缺测层断线、速度环刻度随量纲、
 * 输入面防线。切变大小的「线长」语义由几何公式锁（等比缩放下线长∝切变）。
 */
import { describe, expect, it } from "vitest";
import { hodograph } from "./hodograph";
import type { WindProfile } from "./wind-profile";

/** 10 层低空廓线（含高度）：0–1 km 段风向顺转、其上逆转；中层一缺测层。 */
const SAMPLES_10: WindProfile = [
  { height: 0, speed: 4, direction: 180 },
  { height: 100, speed: 6, direction: 190 },
  { height: 300, speed: 8, direction: 200 },
  { height: 500, speed: 10, direction: 210 },
  { height: 800, speed: 12, direction: 220 },
  { height: 1000, speed: 14, direction: 230 },
  { height: 1500, speed: 15, direction: 240 },
  { height: 2000, speed: 16, direction: 235 },
  { height: 3000, speed: null, direction: null }, // 缺测层
  { height: 4000, speed: 18, direction: 250 },
];

/** 端点坐标对（跨缺口线段排查的取值地基；不捕获作用域，置模块层）。 */
const markXYOf = (el: SVGCircleElement | undefined): [string, string] => [
  el?.getAttribute("cx") ?? "",
  el?.getAttribute("cy") ?? "",
];

/** 线段长度（像素坐标直读——「线长＝切变大小」的断言地基；不捕获作用域，置模块层）。 */
const segLengthOf = (l: SVGLineElement): number =>
  Math.hypot(
    Number(l.getAttribute("x2")) - Number(l.getAttribute("x1")),
    Number(l.getAttribute("y2")) - Number(l.getAttribute("y1")),
  );

/** 8 层恒定切变锚：风矢量每层加同一增量（Δu=+2、Δv=+1.5），层间切变矢量恒等。 */
const UNIFORM_SHEAR_8: WindProfile = Array.from({ length: 8 }, (_, i) => {
  const u = i * 2;
  const v = -4 + i * 1.5;
  // u/v → 来向/风速（与 grid 的 windDirectionOf 同式，测试内复算锚点）
  const direction = (((270 - (Math.atan2(v, u) * 180) / Math.PI) % 360) + 360) % 360;
  return { height: i * 500, speed: Math.hypot(u, v), direction };
});

describe("hodograph（W-11 高空风图）", () => {
  it("≥8 层门槛与端点几何：西风端点在 +u（右）、北风端点在 −v（下）", () => {
    const west: WindProfile = Array.from({ length: 8 }, (_, i) => ({
      height: i * 100,
      speed: 5 + i,
      direction: 270,
    }));
    const root = hodograph(west);
    expect(root.dataset.points).toBe("8");
    const marks = [...root.querySelectorAll<SVGCircleElement>("circle.mw-hodo-mark")];
    expect(marks).toHaveLength(8);
    const cx0 = Number(marks[0]?.getAttribute("cx"));
    const cy0 = Number(marks[0]?.getAttribute("cy"));
    const center = 320 / 2; // viewBox 320、原点居中
    expect(cx0).toBeGreaterThan(center); // 西风（来向 270）→ u=+ → 原点右侧
    expect(cy0).toBeCloseTo(center, 6); // v=0 → 同高
    expect(() => hodograph(west.slice(0, 7))).toThrow(/层数不足（7 < 8）/);
  });

  it("端点连线＝层间切变矢量：恒定切变锚的 7 条线段等长（线长∝切变大小）", () => {
    const root = hodograph(UNIFORM_SHEAR_8);
    const segs = [...root.querySelectorAll<SVGLineElement>("line.mw-hodo-seg")];
    expect(segs).toHaveLength(7); // 8 点 7 段
    const lens = segs.map(segLengthOf);
    // 每层间切变矢量相同 → 线长相同（容差 0.5：像素坐标一位小数的舍入余量）
    for (const len of lens) expect(len).toBeCloseTo(lens[0] ?? 0, 0);
  });

  it("低空段高亮（缺省 0–1 km）：低端层落区的线段与端点强调色、其上中性色", () => {
    const root = hodograph(SAMPLES_10);
    const segs = [...root.querySelectorAll<SVGLineElement>("line.mw-hodo-seg")];
    // 9 个成点、原始层序相邻 7 对（跨缺测的 1 对不连）→ 7 段；低端层 height∈[0,1000) 的段共 5 段强调
    expect(segs).toHaveLength(7);
    const low = segs.filter((s) => s.classList.contains("mw-hodo-low"));
    expect(low).toHaveLength(5);
    // 图例行带区间标签
    expect(root.querySelector(".mw-hodo-note")?.textContent).toContain("0–1000 m");
  });

  it("缺测层：端点不出、两侧线段同断——10 层挖 1 层 → 7 段（跨缺测不连线的行为锁）", () => {
    const root = hodograph(SAMPLES_10);
    expect(root.dataset.points).toBe("9"); // 10 − 缺测 1（3000 m 层）
    // 9 个成点在成点序列里相邻的共 8 对，但其中跨缺测层的 1 对（2000 m ↔ 4000 m，
    // 原始层下标差 2）**不连线**——连线冒充「大层间切变」会虚增线长（切变语义失真）。
    // 真实段数＝层下标相邻的成点对数＝7（前 4 对＋后 3 对）
    const segs = [...root.querySelectorAll<SVGLineElement>("line.mw-hodo-seg")];
    expect(segs).toHaveLength(7);
    // 逐段验证无任何线段横跨缺测口：每段起终点几何与「相邻成点对」逐一对应——
    // 用成点坐标表反查：所有线段的两端都在成点上，且不存在两端为缺口两侧（2000 m
    // 与 4000 m 端点）的那条线
    const marks = [...root.querySelectorAll<SVGCircleElement>("circle.mw-hodo-mark")];
    expect(marks).toHaveLength(9);
    const gapLeft = marks[7]; // 缺口下侧端点（2000 m，成点序 7）
    const gapRight = marks[8]; // 缺口上侧端点（4000 m，成点序 8——3000 m 缺测跳位）
    const [lx, ly] = markXYOf(gapLeft);
    const [rx, ry] = markXYOf(gapRight);
    const crossing = segs.find((seg) => {
      const x1 = seg.getAttribute("x1") ?? "";
      const y1 = seg.getAttribute("y1") ?? "";
      const x2 = seg.getAttribute("x2") ?? "";
      const y2 = seg.getAttribute("y2") ?? "";
      return (
        (x1 === lx && y1 === ly && x2 === rx && y2 === ry) ||
        (x1 === rx && y1 === ry && x2 === lx && y2 === ly)
      );
    });
    expect(crossing).toBeUndefined(); // 跨缺口的那条线不存在
  });

  it("静风端点在原点：speed 0 的层成点于原点（位置有意义、方向无意义）", () => {
    const withCalm: WindProfile = [
      { height: 0, speed: 0, direction: null },
      ...SAMPLES_10.slice(1),
    ];
    const root = hodograph(withCalm);
    const marks = [...root.querySelectorAll<SVGCircleElement>("circle.mw-hodo-mark")];
    expect(marks).toHaveLength(9); // 静风 1 ＋ SAMPLES_10.slice(1) 的 8 个成点（3000 m 层缺测不出）
    expect(Number(marks[0]?.getAttribute("cx"))).toBeCloseTo(160, 6);
    expect(Number(marks[0]?.getAttribute("cy"))).toBeCloseTo(160, 6);
  });

  it("速度环刻度随量纲：m/s 步长 5、kt 步长 10；unit 是声明不换算", () => {
    const ms = hodograph(SAMPLES_10);
    const ringTexts = [...ms.querySelectorAll<SVGElement>(".mw-hodo-ringtext")]
      .map((t) => t.textContent)
      .filter((t): t is string => t !== null && /^\d+$/.test(t));
    expect(ringTexts).toContain("5");
    expect(ms.dataset.unit).toBe("m/s");
    const kt = hodograph(
      SAMPLES_10.map((s) => ({
        ...s,
        speed: s.speed === undefined || s.speed === null ? null : s.speed * 1.94,
      })),
      { unit: "kt" },
    );
    expect(kt.dataset.unit).toBe("kt");
    const ktRings = [...kt.querySelectorAll<SVGElement>(".mw-hodo-ringtext")]
      .map((t) => t.textContent)
      .filter((t): t is string => t !== null && /^\d+$/.test(t));
    expect(ktRings).toContain("10");
    expect(ktRings).not.toContain("5");
  });

  it("自定高亮区间与标签：highlight 覆盖缺省，区间标签用传入文案", () => {
    const root = hodograph(UNIFORM_SHEAR_8, {
      highlight: [{ fromHeightM: 0, toHeightM: 1500, label: "0–1.5 km 低空急流段" }],
    });
    expect(root.querySelector(".mw-hodo-note")?.textContent).toContain("0–1.5 km 低空急流段");
    const segs = [...root.querySelectorAll<SVGLineElement>("line.mw-hodo-seg")];
    const low = segs.filter((s) => s.classList.contains("mw-hodo-low"));
    expect(low).toHaveLength(3); // 低端层 0/500/1000 的三段
  });

  it("层序自排与无锚容许：高度锚自动升序；锚全缺时按输入序（几何不依赖锚）", () => {
    const noAnchor: WindProfile = Array.from({ length: 8 }, (_, i) => ({
      speed: i + 1,
      direction: 180 + i * 10,
    }));
    expect(() => hodograph(noAnchor)).not.toThrow();
    const shuffled = [...SAMPLES_10];
    shuffled.reverse();
    const root = hodograph(shuffled);
    // 排序后首段低端层 height 0（强调色），末层 4000/3000 在上
    const segs = [...root.querySelectorAll<SVGLineElement>("line.mw-hodo-seg")];
    expect(segs[0]?.classList.contains("mw-hodo-low")).toBe(true);
  });

  it("单位注记右对齐收在 viewBox 内（P2-4 行为锁）：x ≤ 317 且 anchor＝end，不再越界裁切", () => {
    const root = hodograph(SAMPLES_10);
    const svg = root.querySelector("svg");
    expect(svg).not.toBeNull();
    const unitLabel = [...(svg?.querySelectorAll<SVGElement>(".mw-hodo-ringtext") ?? [])].find(
      (t) => t.textContent === "(m/s)",
    );
    expect(unitLabel).toBeDefined();
    expect(Number(unitLabel?.getAttribute("x"))).toBeLessThanOrEqual(317);
    expect(unitLabel?.getAttribute("text-anchor")).toBe("end");
  });

  it("aria-label 走 locale 表（P2-6 行为锁）：缺省中文、en 英文——不再硬编码英文", () => {
    const zh = hodograph(SAMPLES_10);
    expect(zh.querySelector("svg")?.getAttribute("aria-label")).toBe("高空风图");
    const en = hodograph(SAMPLES_10, { locale: "en" });
    expect(en.querySelector("svg")?.getAttribute("aria-label")).toBe("Hodograph");
  });

  it("输入面防线：层数/值域/highlight 区间/未知选项显式抛错", () => {
    expect(() => hodograph(SAMPLES_10.slice(0, 7))).toThrow(/层数不足/);
    expect(() => hodograph(SAMPLES_10, { bad: 1 } as never)).toThrow(/未知选项 "bad"/);
    expect(() =>
      hodograph([...SAMPLES_10.slice(0, 9), { height: 5000, speed: -2, direction: 250 }]),
    ).toThrow(/speed 非法/);
    expect(() =>
      hodograph([...SAMPLES_10.slice(0, 9), { height: 5000, speed: 10, direction: 400 }]),
    ).toThrow(/direction 非法/);
    expect(() =>
      hodograph(SAMPLES_10, { highlight: [{ fromHeightM: 1000, toHeightM: 100 }] }),
    ).toThrow(/highlight 第 1 段非法/);
  });
});
