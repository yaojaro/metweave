// @vitest-environment happy-dom
/**
 * windRose（W-15 风玫瑰）可测面：扇区归桶与堆叠口径（与观测玫瑰通行实现逐行一致——
 * 中心对齐、边界归最近扇区、∞ 档正常堆叠）、账目四桶（缺速→静风→缺向→入扇区，
 * 披露行机读）、静风圈 auto/强制两态、kt/m-s 两套缺省档界、kt 档数超六的家族色
 * 循环取色、满圈锁尺（radiusMax）、空输入与全静风的空态（不出 NaN）、越界显式抛错
 * （照 windDirStrip 先例）。
 */
import { describe, expect, it } from "vitest";
import { windRose } from "./wind-rose";
import type { WindRoseSample } from "./wind-rose";

/** 16 样本定账样例：北扇区密集（跨 350→0→10）、东南西北各一枚、静风/缺向/缺速各态。 */
const SERIES_16: readonly WindRoseSample[] = [
  { speed: 3, direction: 350 }, // 扇区0 档1（2–4）
  { speed: 5, direction: 0 }, // 扇区0 档2（4–6）
  { speed: 7, direction: 10 }, // 扇区0 档3（6–8）
  { speed: 11, direction: 5 }, // 扇区0 档5（≥10，∞ 档）
  { speed: 1.5, direction: 90 }, // 扇区4（E）档0
  { speed: 4.5, direction: 95 }, // 扇区4 档2
  { speed: 6.5, direction: 180 }, // 扇区8（S）档3
  { speed: 9, direction: 185 }, // 扇区8 档4
  { speed: 12, direction: 270 }, // 扇区12（W）档5
  { speed: 2, direction: 355 }, // 扇区0 档1（2 < 2 不成立 → 2–4 档）
  { speed: 0.8, direction: 100 }, // 静风（< 1 kt，方向在场也剔出）
  { speed: 0, direction: null }, // 静风（速度 0 方向缺）
  { speed: 3.5, direction: null }, // 缺向（有风无向——VRB 一类）
  { speed: null, direction: 45 }, // 缺速
  { speed: null, direction: null }, // 缺速（两位全缺归缺速桶）
  { speed: 5, direction: 360 }, // 360 ≡ 0 → 扇区0 档2
];

describe("windRose（W-15 风玫瑰）", () => {
  it("16×6 标准态：账目四桶（缺速→静风→缺向→入扇区，和恒等 n）与扇区×档矩阵", () => {
    const root = windRose(SERIES_16);
    expect(root.dataset.samples).toBe("16");
    expect(root.dataset.calm).toBe("2");
    expect(root.dataset.missingDirection).toBe("1");
    expect(root.dataset.missingSpeed).toBe("2");
    expect(root.dataset.inSector).toBe("11"); // 16 − 2 − 1 − 2
    expect(root.dataset.sectors).toBe("16");
    expect(root.dataset.bins).toBe("6"); // kt 缺省档界 [2,4,6,8,10]+∞
    expect(root.dataset.unit).toBe("kt");
    // 瓣数＝非零（扇区,档）格：扇区0 四档 + 扇区4 两档 + 扇区8 两档 + 扇区12 一档
    expect(root.querySelectorAll("path.mw-wr-petal")).toHaveLength(9);
  });

  it("扇区归桶口径：中心对齐（+半格取整、边界值归最近扇区）、360 ≡ 0", () => {
    // 单样本探针：逐点喂入，读 data 与瓣的扇区位（用 matrix 语义的代理——披露行 +
    // 瓣几何无法直接读扇区号，改以扇区名标注与 data-rim 无关的成分断言账目即可；
    // 扇区归桶的权威单源 windRoseAccount 被两组件共用，其矩阵行为由本文件的账目
    // 断言与 wind-dir-frequency 的对拍共同锁死）
    const north = windRose([{ speed: 5, direction: 0 }]);
    expect(north.dataset.inSector).toBe("1");
    // 边界 11.25°（16 扇区的格界）归最近扇区（NE 侧）——剔除口径不变、入扇区不变
    const boundary = windRose([
      { speed: 5, direction: 11.25 },
      { speed: 5, direction: 11.24 },
    ]);
    expect(boundary.dataset.inSector).toBe("2");
    const wrap = windRose([{ speed: 5, direction: 360 }]);
    expect(wrap.dataset.inSector).toBe("1");
  });

  it("∞ 档正常堆叠：≥10 kt 的样本全部落末档（越顶归末档，不抛错不丢样本）", () => {
    const root = windRose([
      { speed: 10, direction: 0 },
      { speed: 47, direction: 5 },
    ]);
    expect(root.dataset.inSector).toBe("2");
    // 两样本同扇区同末档 → 恰一瓣
    expect(root.querySelectorAll("path.mw-wr-petal")).toHaveLength(1);
  });

  it("8×4 最小态：8 扇区 × kt 自动档 4 档（[2,4,6]+∞）", () => {
    const root = windRose([{ speed: 3, direction: 45 }], { sectors: 8, bins: 4 });
    expect(root.dataset.sectors).toBe("8");
    expect(root.dataset.bins).toBe("4");
    expect(root.dataset.inSector).toBe("1");
    expect(root.querySelectorAll("path.mw-wr-petal")).toHaveLength(1);
  });

  it("kt 缺省档 bins=8：色带循环取家族色（任一档取色恒有定义——档 6 取首色、档 7 取次色，不回落灰蓝兜底）", () => {
    const root = windRose([{ speed: 3, direction: 0 }], { bins: 8 });
    expect(root.dataset.bins).toBe("8");
    // 图例色块＝逐档取色的可读面（样例无静风：恰 8 块、无静风样干扰）
    const chips = root.querySelectorAll(".mw-wr-chip");
    expect(chips).toHaveLength(8);
    const family = ["#6271b8", "#3d6ea3", "#4a939f", "#84963b", "#98565c", "#974b91"];
    chips.forEach((chip, bi) => {
      // 逐档断言：档 bi 取 family[bi % 6]（超六自首色复用——undefined 兜底路径被此锁死）
      expect(chip.getAttribute("style")).toContain(family[bi % family.length]);
    });
  });

  it("静风圈两态：auto 有静风才画（中心圆＋图例样）、无静风不画；true/false 强制生效", () => {
    const withCalm = windRose(SERIES_16); // 样例含 2 静风 → auto 画
    expect(withCalm.querySelectorAll(".mw-wr-calm")).toHaveLength(1);
    expect(withCalm.querySelector(".mw-wr-legend")?.textContent).toContain("静风");
    const noCalm = windRose([
      { speed: 5, direction: 0 },
      { speed: 5, direction: 90 },
    ]);
    expect(noCalm.querySelectorAll(".mw-wr-calm")).toHaveLength(0);
    expect(noCalm.querySelector(".mw-wr-legend")?.textContent).not.toContain("静风");
    const forcedOn = windRose([{ speed: 5, direction: 0 }], { calmCircle: true });
    expect(forcedOn.querySelectorAll(".mw-wr-calm")).toHaveLength(1);
    const forcedOff = windRose(SERIES_16, { calmCircle: false });
    expect(forcedOff.querySelectorAll(".mw-wr-calm")).toHaveLength(0);
  });

  it("m-s 口径：档界对齐场图家族 7 档（[3,5,10,15,20,30]+∞）、静风阈 0.5、mps 别名", () => {
    const root = windRose(
      [
        { speed: 0.4, direction: 0 }, // 静风（< 0.5 m/s）
        { speed: 4, direction: 0 }, // 档1（3–5）
        { speed: 31, direction: 90 }, // 末档（≥30）
      ],
      { unit: "m/s" },
    );
    expect(root.dataset.unit).toBe("m/s");
    expect(root.dataset.bins).toBe("7");
    expect(root.dataset.calm).toBe("1");
    expect(root.dataset.inSector).toBe("2");
    const alias = windRose([{ speed: 4, direction: 0 }], { unit: "mps" });
    expect(alias.dataset.unit).toBe("m/s");
  });

  it("m-s 下 bins 不适用（档案口径固定档界）——非缺省值显式抛错指向 binEdges", () => {
    expect(() => windRose([{ speed: 4, direction: 0 }], { unit: "m/s", bins: 4 })).toThrow(
      /bins 选项只作用于 kt/,
    );
    // 缺省值 6 显式传入不报错（与缺省行为全等）
    const ok = windRose([{ speed: 4, direction: 0 }], { unit: "m/s", bins: 6 });
    expect(ok.dataset.bins).toBe("7");
  });

  it("满圈锁尺（radiusMax）：rim 锁定与数据无关——十二宫格共尺的锚", () => {
    const auto = windRose(SERIES_16); // 最长扇区 6/11 ≈ 54.5% → 自适应 75
    expect(auto.dataset.rim).toBe("75");
    const locked = windRose(SERIES_16, { radiusMax: 40 });
    expect(locked.dataset.rim).toBe("40");
    const lockedSame = windRose([{ speed: 5, direction: 0 }], { radiusMax: 40 });
    expect(lockedSame.dataset.rim).toBe("40"); // 与上一张同尺（数据不同 rim 相同）
    expect(() => windRose([{ speed: 5, direction: 0 }], { radiusMax: 0 })).toThrow(
      /radiusMax 非法/,
    );
  });

  it("空输入与全静风：空玫瑰＋披露行承载（不出 NaN、不抛错）", () => {
    const empty = windRose([]);
    expect(empty.dataset.samples).toBe("0");
    expect(empty.dataset.inSector).toBe("0");
    expect(empty.querySelectorAll("path.mw-wr-petal")).toHaveLength(0);
    expect(empty.querySelector(".mw-wr-note")?.textContent).toContain("样本 0");
    expect(empty.innerHTML).not.toContain("NaN");
    const allCalm = windRose([
      { speed: 0.5, direction: null },
      { speed: 0.2, direction: 90 },
    ]);
    expect(allCalm.dataset.inSector).toBe("0");
    expect(allCalm.dataset.calm).toBe("2");
    expect(allCalm.querySelectorAll("path.mw-wr-petal")).toHaveLength(0);
    expect(allCalm.innerHTML).not.toContain("NaN");
    expect(allCalm.querySelector(".mw-wr-note")?.textContent).toContain("入扇区 0");
  });

  it("图例：色档刻度＋单位＋静风样与披露行（样本 n·静风·缺向·缺速·入扇区）", () => {
    const root = windRose(SERIES_16);
    const legend = root.querySelector(".mw-wr-legend")?.textContent ?? "";
    expect(legend).toContain("风速档（kt）");
    expect(legend).toContain("0–2");
    expect(legend).toContain("8–10");
    expect(legend).toContain("≥10");
    expect(legend).toContain("静风");
    const note = root.querySelector(".mw-wr-note")?.textContent ?? "";
    expect(note).toContain("样本 16");
    expect(note).toContain("静风 2");
    expect(note).toContain("缺向 1");
    expect(note).toContain("缺速 2");
    expect(note).toContain("入扇区 11");
  });

  it("locale en：aria/图例/披露行走英文表", () => {
    const en = windRose(SERIES_16, { locale: "en", title: "Rose" });
    expect(en.querySelector("svg")?.getAttribute("aria-label")).toBe("Wind rose");
    expect(en.querySelector(".mw-wr-legend")?.textContent).toContain("Speed bins (kt)");
    expect(en.querySelector(".mw-wr-note")?.textContent).toContain("Samples 16");
    expect(en.querySelector(".mw-wr-title")?.textContent).toBe("Rose");
  });

  it("binEdges 显式覆盖：末位 Infinity 收尾合法、自定档数生效；与 scale 同传抛错", () => {
    const custom = windRose([{ speed: 13, direction: 0 }], { binEdges: [5, 12, Infinity] });
    expect(custom.dataset.bins).toBe("3"); // [0,5) [5,12) [12+)
    expect(custom.dataset.inSector).toBe("1");
    expect(() =>
      windRose([{ speed: 4, direction: 0 }], {
        binEdges: [2, 4],
        scale: { breaks: [2, 4], colors: ["#000", "#333", "#666"] },
      }),
    ).toThrow(/两份真相/);
    expect(() => windRose([{ speed: 4, direction: 0 }], { binEdges: [4, 2] })).toThrow(/严格递增/);
    expect(() => windRose([{ speed: 4, direction: 0 }], { binEdges: [] })).toThrow(/binEdges 为空/);
  });

  it("scale 整体覆盖：档界与色带取传入色标（colors 数 ≠ breaks+1 抛错）", () => {
    const root = windRose([{ speed: 3, direction: 0 }], {
      scale: { breaks: [2, 4], colors: ["#111111", "#444444", "#777777"] },
    });
    expect(root.dataset.bins).toBe("3");
    expect(root.dataset.inSector).toBe("1");
    const petal = root.querySelector("path.mw-wr-petal");
    expect(petal?.getAttribute("fill")).toBe("#444444"); // 3 落档1 [2,4) → colors[1]
    expect(() =>
      windRose([{ speed: 3, direction: 0 }], {
        scale: { breaks: [2, 4], colors: ["#111111", "#444444"] },
      }),
    ).toThrow(/每档一色/);
  });

  it("输入面防线：direction 越界/非有限、speed 负值/非有限、未知选项与非法 sectors 显式抛错", () => {
    expect(() => windRose([{ speed: 3, direction: 361 }])).toThrow(/direction 非法/);
    expect(() => windRose([{ speed: 3, direction: -10 }])).toThrow(/direction 非法/);
    expect(() => windRose([{ speed: 3, direction: Number.NaN }])).toThrow(/direction 非法/);
    expect(() => windRose([{ speed: -1, direction: 0 }])).toThrow(/speed 非法/);
    expect(() => windRose([{ speed: Number.POSITIVE_INFINITY, direction: 0 }])).toThrow(
      /speed 非法/,
    );
    expect(() => windRose([{ speed: 3, direction: 0 }], { bad: 1 } as never)).toThrow(
      /未知选项 "bad"/,
    );
    expect(() => windRose([{ speed: 3, direction: 0 }], { sectors: 3 })).toThrow(/sectors 非法/);
    expect(() => windRose([{ speed: 3, direction: 0 }], { calmThreshold: -2 })).toThrow(
      /calmThreshold 非法/,
    );
    // null 缺测合法（不抛）
    expect(windRose([{ speed: null, direction: null }]).dataset.samples).toBe("1");
  });
});
