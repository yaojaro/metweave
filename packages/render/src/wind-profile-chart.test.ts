// @vitest-environment happy-dom
/**
 * windProfileChart（W-10 风廓线图）可测面：验收口径全量——≥6 层起画的门槛与 16 层
 * 不挤（同一画布内布点）、气压对数轴/线性高度轴的选型规则、缺测层断线＋「缺测」短划、
 * 方向箭头的有无口径（direction null 不出箭）、量纲声明（unit 不换算只声明）、
 * 输入面防线（层数/锚混装/值域/未知选项）。像素观感是浏览器面的验证对象，此处锁
 * DOM 结构与几何映射。
 */
import { describe, expect, it } from "vitest";
import { windProfileChart } from "./wind-profile-chart";
import type { WindProfile } from "./wind-profile";

/** 风羽着色色标样例（七档七色，与 10m 风档案同构——测试自备）。 */
const INK_SCALE = {
  breaks: [3, 5, 10, 15, 20, 30],
  colors: ["#6271b8", "#3d6ea3", "#4a939f", "#4c9964", "#84963b", "#98565c", "#974b91"],
};

/** 风羽刻度样例（结构对齐 grid 的 WIND_BARB_SCALES——测试自备，不复制产线常数）。 */
const BARB_SCALES = {
  "m/s": { pennant: 20, long: 4, short: 2 },
  kt: { pennant: 50, long: 10, short: 5 },
} as const;

/** glyph 墨色读取（着色断言的取值地基；不捕获作用域，置模块层）。 */
const inkOf = (g: SVGGElement | null | undefined): string => g?.style.stroke ?? "";

/** PROFILE_16 的 barb 形态期望：13 杆（16 − 缺测 1 − 静风 1 − 有速无向 1）＋静风圈 1。 */
const BARB_PROFILE_OPTS = {
  scale: INK_SCALE,
  glyph: "barb" as const,
  barbScale: BARB_SCALES,
};

/** 16 层标准气压廓线（1000→100 hPa，风速随高度增大、中层夹一缺测层与一静风层）。 */
const PROFILE_16: WindProfile = [
  { pressure: 1000, speed: 3, direction: 240 },
  { pressure: 925, speed: 5, direction: 245 },
  { pressure: 850, speed: 7, direction: 250 },
  { pressure: 700, speed: 9, direction: 260 },
  { pressure: 600, speed: null, direction: null }, // 缺测层
  { pressure: 500, speed: 14, direction: 270 },
  { pressure: 400, speed: 17, direction: 275 },
  { pressure: 300, speed: 21, direction: 280 },
  { pressure: 250, speed: 24, direction: 285 },
  { pressure: 200, speed: 28, direction: 290 },
  { pressure: 150, speed: 32, direction: 295 },
  { pressure: 100, speed: 36, direction: 300 },
  { pressure: 70, speed: 0, direction: null }, // 静风层（无方向）
  { pressure: 50, speed: 30, direction: null }, // 有风无向（方向缺测）
  { pressure: 30, speed: 26, direction: 305 },
  { pressure: 20, speed: 22, direction: 310 },
];

/** 8 层高度廓线（近地面 AGL——线性高度轴的样例族）。 */
const HEIGHT_PROFILE: WindProfile = [10, 80, 120, 180, 300, 500, 750, 1000].map((h, i) => ({
  height: h,
  speed: 2 + i,
  direction: 200 + i * 5,
}));

describe("windProfileChart（W-10 风廓线图）", () => {
  it("16 层气压廓线：对数气压轴、标准等压面刻度、逐层标记与方向箭头", () => {
    const root = windProfileChart(PROFILE_16);
    expect(root.dataset.axis).toBe("pressure");
    expect(root.dataset.levels).toBe("16");
    expect(root.dataset.unit).toBe("m/s");
    const svg = root.querySelector("svg");
    expect(svg).not.toBeNull();
    // 标准等压面刻度在数据范围内逐个在场——含平流层低层 70/50/30/20（P2-5 行为锁：
    // 此前刻度表止于 100，100 以下的层画点不画标）
    const tickTexts = [...root.querySelectorAll<SVGElement>(".mw-wpc-ticktext")].map(
      (t) => t.textContent,
    );
    for (const p of [
      "1000",
      "925",
      "850",
      "700",
      "500",
      "300",
      "200",
      "100",
      "70",
      "50",
      "30",
      "20",
    ]) {
      expect(tickTexts).toContain(p);
    }
    expect(tickTexts).toContain("hPa");
    // 逐层标记：有风速的 14 层各一枚点（16 − 缺测 1 − …静风层也有点：speed 0 也是点）
    const marks = root.querySelectorAll("circle.mw-wpc-mark");
    expect(marks).toHaveLength(15); // 16 − 1 缺测层
    // 方向箭头：direction 在场的 13 层（静风层与「有风无向」层不出箭）
    const arrows = root.querySelectorAll("g.mw-wpc-arrow");
    expect(arrows).toHaveLength(13);
  });

  it("气压对数轴的映射锚：1000 hPa 刻度在最下、100 hPa 刻度靠上（探空读法）", () => {
    const root = windProfileChart(PROFILE_16);
    const yOfTick = (p: string): number | undefined => {
      const tick = [...root.querySelectorAll<SVGElement>(".mw-wpc-ticktext")].find(
        (t) => t.textContent === p,
      );
      const y = tick?.getAttribute("y");
      return y === undefined || y === null ? undefined : Number(y);
    };
    const y1000 = yOfTick("1000");
    const y100 = yOfTick("100");
    expect(y1000).toBeDefined();
    expect(y100).toBeDefined();
    expect(y1000 ?? 0).toBeGreaterThan(y100 ?? 0); // SVG y 向下增长：1000 在下、100 在上
  });

  it("缺测层：折线断开成两段、该高度一枚「缺测」短划（空缺可辨）", () => {
    const root = windProfileChart(PROFILE_16);
    const curves = root.querySelectorAll("polyline.mw-wpc-curve");
    expect(curves).toHaveLength(2); // 600 hPa 缺测把 16 层分成 4＋11 两段
    const dash = root.querySelector("line.mw-wpc-missing");
    expect(dash).not.toBeNull();
    expect(dash?.querySelector("title")?.textContent).toBe("缺测");
    // 段内点数：缺测层不进任何折线
    const pts = [...curves].map(
      (c) => (c.getAttribute("points") ?? "").split(" ").filter((s) => s !== "").length,
    );
    expect(pts).toEqual([4, 11]);
  });

  it("静风层与「有风无向」层：点在、箭头无（静风无方向可读——与 windBarbOf 同口径）", () => {
    const root = windProfileChart(PROFILE_16);
    const svg = root.querySelector("svg");
    expect(svg).not.toBeNull();
    // 静风层 speed 0：点落在 x 轴原点（left＝48）
    const marks = [...root.querySelectorAll<SVGCircleElement>("circle.mw-wpc-mark")];
    const calmMark = marks.find((m) => m.getAttribute("cx") === "48.0");
    expect(calmMark).toBeDefined();
  });

  it("高度轴选型：层数据全带 height → 线性高度轴（m 刻度）；气压/高度混装 → 显式抛错", () => {
    const root = windProfileChart(HEIGHT_PROFILE);
    expect(root.dataset.axis).toBe("height");
    const tickTexts = [...root.querySelectorAll<SVGElement>(".mw-wpc-ticktext")].map(
      (t) => t.textContent,
    );
    expect(tickTexts).toContain("m");
    const mixed: WindProfile = [
      ...HEIGHT_PROFILE.slice(0, 7),
      { pressure: 500, speed: 5, direction: 270 },
    ];
    expect(() => windProfileChart(mixed)).toThrow(/层锚混装/);
  });

  it("层序自排：乱序输入按气压降序绘制（地面点在最下、高空点在最上）", () => {
    const shuffled = [...PROFILE_16];
    shuffled.reverse();
    const root = windProfileChart(shuffled);
    const marks = [...root.querySelectorAll<SVGCircleElement>("circle.mw-wpc-mark")];
    const ys = marks.map((m) => Number(m.getAttribute("cy")));
    const ascending = [...ys];
    ascending.sort((a, b) => b - a);
    expect(ys).toEqual(ascending); // 首点（1000 hPa）y 最大＝最下，单调向上
  });

  it("量纲声明：unit kt 只改声明不改数值（data-unit 与轴注记），mps 为别名", () => {
    const ktRoot = windProfileChart(
      PROFILE_16.map((l) => ({
        ...l,
        speed: l.speed === undefined || l.speed === null ? null : l.speed * 1.94,
      })),
      { unit: "kt" },
    );
    expect(ktRoot.dataset.unit).toBe("kt");
    const unitNote = ktRoot.querySelector(".mw-wpc-unittext")?.textContent ?? "";
    expect(unitNote).toContain("kt");
    const alias = windProfileChart(HEIGHT_PROFILE, { unit: "mps" });
    expect(alias.dataset.unit).toBe("m/s");
  });

  it("输入面防线：层数不足/值域非法/未知选项显式抛错", () => {
    const five: WindProfile = PROFILE_16.slice(0, 5);
    expect(() => windProfileChart(five)).toThrow(/层数不足（5 < 6）/);
    expect(() => windProfileChart(PROFILE_16, { bad: 1 } as never)).toThrow(/未知选项 "bad"/);
    expect(() =>
      windProfileChart([...PROFILE_16.slice(0, 15), { pressure: 10, speed: -1, direction: 200 }]),
    ).toThrow(/speed 非法/);
    expect(() =>
      windProfileChart([...PROFILE_16.slice(0, 15), { pressure: 10, speed: 5, direction: 361 }]),
    ).toThrow(/direction 非法/);
    expect(() =>
      windProfileChart([...PROFILE_16.slice(0, 15), { pressure: -5, speed: 5, direction: 200 }]),
    ).toThrow(/pressure 非法/);
    const noAnchor: WindProfile = [...PROFILE_16.slice(0, 15), { speed: 5, direction: 200 }];
    expect(() => windProfileChart(noAnchor)).toThrow(/缺层锚/);
  });

  it("glyph barb：垂直风羽列——每层一枚居中着色风羽、折线/箭头让位、静风＝着色圆圈", () => {
    const root = windProfileChart(PROFILE_16, BARB_PROFILE_OPTS);
    expect(root.dataset.glyph).toBe("barb");
    // 16 层收支：13 杆＋1 静风圈（70 hPa speed 0）＋1 缺测短划（600 hPa）＋1 有速无向（50 hPa 不出符号）
    expect(root.querySelectorAll("line.mw-wth-barb-staff")).toHaveLength(13);
    expect(root.querySelectorAll("circle.mw-wth-barb-calm")).toHaveLength(1);
    expect(root.querySelectorAll("line.mw-wpc-missing")).toHaveLength(1);
    expect(root.querySelectorAll("polyline.mw-wpc-curve")).toHaveLength(0); // 折线让位
    expect(root.querySelectorAll("g.mw-wpc-arrow")).toHaveLength(0);
    // 风羽列水平居中：杆组的平移 x 全等（left 48 ＋ plotW 278 ÷ 2 ＝ 187）
    const holders = [...root.querySelectorAll<SVGGElement>("g")].filter((g) =>
      (g.getAttribute("transform") ?? "").startsWith("translate("),
    );
    expect(holders.length).toBe(14); // 13 杆＋1 圈
    for (const h of holders) {
      expect(h.getAttribute("transform")?.startsWith("translate(187.0")).toBe(true);
    }
  });

  it("glyph barb 着色＝色标映射抽查（同档同色、跨档变色、静风圈取低速档色）", () => {
    const root = windProfileChart(PROFILE_16, BARB_PROFILE_OPTS);
    const glyphs = [...root.querySelectorAll<SVGGElement>("g.mw-wth-barb")];
    // 逐层核：925 hPa（5 m/s）与 700 hPa（9 m/s）同落 [5,10) 档（bin2）→ 同墨色
    // 层序（气压降序）：[1000,925,850,700,600缺,500,400,300,250,200,150,100,70静,50无向,30,20]
    // 杆序（跳过缺测/静风/无向）：1000,925,850,700,500,400,300,250,200,150,100,30,20
    const g925 = glyphs[1];
    const g700 = glyphs[3];
    const g100 = glyphs[10]; // 36 m/s ≥30 → 末档品红
    const g1000 = glyphs[0]; // 3 m/s ≥3 → bin1 钴蓝
    expect(inkOf(g925)).not.toBe("");
    expect(inkOf(g925)).toBe(inkOf(g700)); // 同档同色
    expect(inkOf(g1000)).not.toBe(inkOf(g100)); // 跨档变色
    // 静风圈：着色（墨色通道同一映射，低速档色）而非无色
    const calm = root.querySelector<SVGCircleElement>("circle.mw-wth-barb-calm");
    expect(calm?.style.stroke).not.toBe("");
  });

  it("glyph barb 等行距图高（行为锁）：行距＝max(尺寸×1.15, 26)，16 层缺省尺寸 → 高 494.5；尺寸更大图更高", () => {
    const base = windProfileChart(PROFILE_16, BARB_PROFILE_OPTS);
    // 缺省 barbSize 26 → pitch 29.9；16 层 15 行距 → 高 14＋448.5＋32＝494.5（折线模式 380）
    expect(base.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 340 494.5");
    const big = windProfileChart(PROFILE_16, { ...BARB_PROFILE_OPTS, barbSize: 44 });
    const vb = big.querySelector("svg")?.getAttribute("viewBox") ?? "";
    expect(Number(vb.split(" ")[3])).toBeCloseTo(14 + 15 * 44 * 1.15 + 32, 1); // 图高随尺寸长（划与旗可数优先）
    expect(base.querySelectorAll("line.mw-wth-barb-short").length).toBeGreaterThan(0); // 缺省尺寸全要素
    // 逐行标签：每层一行的行标签＝层锚值（16 行含 1000/925/…/20 与缺测层锚）
    const labels = [...base.querySelectorAll<SVGElement>(".mw-wpc-ticktext")].map(
      (t) => t.textContent,
    );
    expect(labels).toContain("1000");
    expect(labels).toContain("20");
  });

  it("glyph barb 图例与防线：内嵌色标（折线模式不画）、scale/barbScale 缺席与非法值显式抛错", () => {
    const root = windProfileChart(PROFILE_16, BARB_PROFILE_OPTS);
    expect(root.querySelector(".mw-csl")?.textContent ?? "").toContain("风羽着色");
    expect(windProfileChart(HEIGHT_PROFILE).querySelector(".mw-csl")).toBeNull(); // 折线模式无图例
    expect(() =>
      windProfileChart(PROFILE_16, { glyph: "barb" as const, barbScale: BARB_SCALES }),
    ).toThrow(/glyph:"barb" 缺 scale/);
    expect(() =>
      windProfileChart(PROFILE_16, { glyph: "barb" as const, scale: INK_SCALE }),
    ).toThrow(/glyph:"barb" 缺 barbScale/);
    expect(() =>
      windProfileChart(PROFILE_16, {
        ...BARB_PROFILE_OPTS,
        barbScale: { "m/s": { pennant: 2, long: 4, short: 20 }, kt: BARB_SCALES.kt },
      }),
    ).toThrow(/位权反了/);
    expect(() => windProfileChart(PROFILE_16, { ...BARB_PROFILE_OPTS, barbSize: 9 })).toThrow(
      /barbSize 非法/,
    );
    expect(() =>
      windProfileChart(PROFILE_16, { ...BARB_PROFILE_OPTS, glyph: "dot" as never }),
    ).toThrow(/glyph 选项值 "dot" 不受支持/);
  });

  it("glyph line 显式声明与缺省同构（回归锁）：折线/箭头在、风羽元素与图例不在", () => {
    const def = windProfileChart(HEIGHT_PROFILE);
    const line = windProfileChart(HEIGHT_PROFILE, { glyph: "line" });
    expect(def.dataset.glyph).toBe("line");
    expect(line.dataset.glyph).toBe("line");
    expect(def.querySelectorAll("polyline.mw-wpc-curve").length).toBe(
      line.querySelectorAll("polyline.mw-wpc-curve").length,
    );
    expect(line.querySelector(".mw-wth-barb")).toBeNull();
    expect(line.querySelector(".mw-csl")).toBeNull();
  });

  it("坐标退化显式报错（P2-2 行为锁）：全同压/全零高不画 NaN 空图", () => {
    const samePressure: WindProfile = Array.from({ length: 6 }, (_, i) => ({
      pressure: 500,
      speed: i + 1,
      direction: 200,
    }));
    expect(() => windProfileChart(samePressure)).toThrow(/垂直坐标退化（全部层同气压 500 hPa）/);
    const zeroHeights: WindProfile = Array.from({ length: 6 }, (_, i) => ({
      height: 0,
      speed: i + 1,
      direction: 200,
    }));
    expect(() => windProfileChart(zeroHeights)).toThrow(/垂直坐标退化（全部层高度 0 m）/);
  });

  it("可选件：title 在场画标题行、缺席不画；className 叠加；en 文案走 locale 表", () => {
    const titled = windProfileChart(HEIGHT_PROFILE, {
      title: "近地面廓线",
      className: "demo-hook",
    });
    expect(titled.querySelector(".mw-wpc-title")?.textContent).toBe("近地面廓线");
    expect(titled.className).toContain("demo-hook");
    expect(windProfileChart(HEIGHT_PROFILE).querySelector(".mw-wpc-title")).toBeNull();
    const en = windProfileChart(HEIGHT_PROFILE, { locale: "en" });
    expect(en.querySelector(".mw-wpc-unittext")?.textContent ?? "").toContain("Wind speed");
    expect(() => windProfileChart(HEIGHT_PROFILE, { locale: "fr" as never })).toThrow(/不受支持/);
  });
});
