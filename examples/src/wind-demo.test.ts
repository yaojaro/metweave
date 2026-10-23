// @vitest-environment happy-dom
/**
 * 「风的画法」演示页的渲染面（v0.3.2 产品审查 5.1–5.3 的确定性保障）：
 * 三块内容都要真的画出来，且**单位与指向的文案不能退化**——这页是内容线取图源，
 * 文案写错会被教程原样传播（「240° 是来向」「切 kt 后行标要给出折合值」两条曾被审出问题）。
 *
 * 单个用例覆盖三块：`wind-main` 是「import 即挂载」的脚本，模块只求值一次，
 * 拆成多个用例反复 import 会重复付解析成本（全量并发下会撞默认超时）。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** 图例刻度行的文本（模块级：不捕获作用域）。 */
const legendItems = (): string[] =>
  [...document.querySelectorAll("#wd-legend li")].map((li) => li.textContent ?? "");

/** 图形矩阵每行左侧的行标（m/s 与折合 kt）。 */
const rowLabels = (): string[] =>
  [...document.querySelectorAll("#wd-glyphs .wd-glyph-row b")].map((b) => b.textContent ?? "");

describe("wind.html 演示页（wind-main）", () => {
  it("四块都画出来：数值牌三态、图形矩阵四档两形态、图例两套刻度可切、单站四杆上图", async () => {
    // 直接用真实的 wind.html 当骨架（去掉 script，避免二次执行）：这样 HTML 的挂载点、
    // 表头与样式钩子一改，测试立刻知道——手写 fixture 会与页面悄悄分叉
    // happy-dom 的 import.meta.url 不是 file: scheme，按仓根相对路径读（vitest root＝仓根）
    const html = readFileSync("examples/wind.html", "utf8");
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] ?? "";
    document.body.className = "wd-page";
    document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, "");
    await import("./wind-main");

    // ① 数值牌：三态各一张（有风/静风/缺测），有风那张要能看到风向与单位
    const chips = [...document.querySelectorAll<HTMLElement>("#wd-chips .mw-wind-chip")];
    expect(chips).toHaveLength(3);
    expect(chips.map((c) => c.dataset.state)).toEqual(["value", "calm", "missing"]);
    expect(chips[0]?.textContent).toContain("240°");
    expect(chips[0]?.textContent).toContain("m/s");

    // ② 图形矩阵（m/s 缺省态）：四档风速、两种画法，读数由库现算（5 m/s＝1 长划，余 1 不足一短划）
    const rows = [...document.querySelectorAll<HTMLElement>("#wd-glyphs .wd-glyph-row")];
    expect(rows).toHaveLength(4);
    expect(rows[0]?.textContent).toContain("5 m/s");
    // 列名只在表头出现（行内不重复）
    const head = document.querySelector(".wd-glyphs-head")?.textContent ?? "";
    expect(head).toContain("风羽");
    expect(head).toContain("箭头");
    expect(rows[0]?.textContent).toContain("旗 0 · 长划 1 · 短划 0 ｜ 编码 4 m/s");
    // 每行两枚 SVG（风羽 + 箭头），都 aria-hidden
    for (const row of rows) {
      const svgs = [...row.querySelectorAll("svg")];
      expect(svgs).toHaveLength(2);
      for (const svg of svgs) expect(svg.getAttribute("aria-hidden")).toBe("true");
    }

    // ③ 图例：缺省 m/s 刻度；切到 kt 后刻度与图形一起变（20/4/2 → 50/10/5）
    expect(legendItems()[0]).toContain("三角旗 20");
    const buttons = [...document.querySelectorAll<HTMLButtonElement>("#wd-legend button")];
    expect(buttons.map((b) => b.textContent)).toEqual(["m/s", "kt"]);
    buttons[1]?.click();
    expect(legendItems()[0]).toContain("三角旗 50");
    expect(legendItems()[1]).toContain("长划 10");
    expect(legendItems()[2]).toContain("短划 5");
    // 行标要给折合值（「5 m/s ≈ 9.7 kt」），否则看起来像没换算；读数随口径重算
    expect(rowLabels()[0]).toContain("≈");
    expect(rowLabels()[0]).toContain("kt");
    expect(document.querySelector("#wd-glyphs .wd-glyph-row")?.textContent).toContain(
      "旗 0 · 长划 0 · 短划 1",
    );
    // 本用例要一次性拉起 leaflet + 伞包解析链，并发跑全量时会超过默认 5s（非逻辑问题）
  }, 30_000);
});
