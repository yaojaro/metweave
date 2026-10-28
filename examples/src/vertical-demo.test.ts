// @vitest-environment happy-dom
/**
 * 「风的垂直与时间」演示页的渲染面（v0.6 批次确定性保障）：五块内容都要真的画出来，
 * 且关键口径不退化——W-10 的缺测层断线、W-11 的低空段高亮、W-12 的缺测格与档案色卡、
 * W-13 的阵风事件数、W-14 的跨北接缝相邻。数据来自页内合成场与 IEM 形态行，
 * 断言全部用库自身返回物（不写死页面文案数字）。单用例覆盖五块（import 即挂载的模块
 * 只求值一次——与 wind-demo.test.ts 同款纪律）。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** 色相角读取（接缝断言的地基；不捕获作用域，置模块层）。 */
const hueOfCell = (c: HTMLElement | undefined): number => {
  const m = /hsl\(\s*(\d+(?:\.\d+)?)/i.exec(c?.style.background ?? "");
  return m === null ? -1 : Number(m[1]);
};

describe("vertical.html 演示页（vertical-main）", () => {
  it("五块都画出来：廓线断线、高空风图高亮、剖面缺测格与档案色卡、阵风事件数、风向接缝", async () => {
    // 直接用真实的 vertical.html 当骨架（去掉 script 避免二次执行）——挂载点一改测试立刻知道
    const html = readFileSync("examples/vertical.html", "utf8");
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] ?? "";
    document.body.className = "vp-page";
    document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, "");
    await import("./vertical-main");

    // ① W-10 风廓线：10 层气压轴 + 500 hPa 缺测层（断线两段＋缺测短划）
    const profile = document.querySelector<HTMLElement>("#vp-profile .mw-wpc");
    expect(profile).not.toBeNull();
    expect(profile?.dataset.axis).toBe("pressure");
    expect(profile?.dataset.levels).toBe("10");
    expect(profile?.querySelectorAll("polyline.mw-wpc-curve")).toHaveLength(2);
    expect(profile?.querySelector("line.mw-wpc-missing")).not.toBeNull();

    // ①b 风羽模式切换：缺省折线 → 勾选后每层一枚居中着色风羽（10 层 − 500 hPa 缺测 ＝ 9 杆）
    const pfRoot = document.querySelector<HTMLElement>("#vp-profile");
    const curvesBefore = pfRoot?.querySelectorAll("polyline.mw-wpc-curve").length ?? 0;
    expect(curvesBefore).toBeGreaterThan(0);
    expect(pfRoot?.querySelector(".mw-wth-barb")).toBeNull();
    const pfToggle = document.getElementById("vp-pf-glyph") as HTMLInputElement;
    pfToggle.click();
    const pfBarb = document.querySelector<HTMLElement>("#vp-profile .mw-wpc"); // 组件根（slot 的子节点）
    expect(pfBarb?.dataset.glyph).toBe("barb");
    expect(pfBarb?.querySelectorAll("polyline.mw-wpc-curve")).toHaveLength(0);
    expect(pfBarb?.querySelectorAll("line.mw-wth-barb-staff")).toHaveLength(9);
    expect(pfBarb?.querySelectorAll("line.mw-wpc-missing")).toHaveLength(1); // 500 hPa 缺测短划照画
    // 着色在杆上：墨色随高度档位变化（高层 100 hPa 与低层 1000 hPa 不同色）
    const barbs = [...(pfBarb?.querySelectorAll<SVGGElement>("g.mw-wth-barb") ?? [])];
    expect(barbs.length).toBe(9);
    const inks = new Set(barbs.map((b) => b.style.stroke));
    expect(inks.size).toBeGreaterThan(1); // 「色斑长在风羽上」——不是单色列
    expect(pfBarb?.querySelector(".mw-csl")?.textContent ?? "").toContain("风羽着色");
    pfToggle.click(); // 切回折线（缺省形态回归）
    expect(
      document.querySelector<HTMLElement>("#vp-profile")?.querySelectorAll("polyline.mw-wpc-curve")
        .length,
    ).toBe(curvesBefore);

    // ② W-11 高空风图：10 层端点、0–3 km 低空段高亮（标准大气下 1000/925/850 三层）
    const hodo = document.querySelector<HTMLElement>("#vp-hodograph .mw-hodo");
    expect(hodo).not.toBeNull();
    expect(hodo?.dataset.points).toBe("9"); // 10 − 500 hPa 缺测层
    const low = hodo?.querySelectorAll("line.mw-hodo-seg.mw-hodo-low") ?? [];
    expect(low.length).toBeGreaterThanOrEqual(2);
    expect(hodo?.querySelector(".mw-hodo-note")?.textContent).toContain("0–3 km");

    // ③ W-12 时间-高度剖面：10 层 × 8 时效（每 3h 跨 24h）、缺测格两块（500 hPa 起报＋300 hPa 末时效）、
    // 色卡与档案同一份（七档七色分格图例＝档案 thresholds 6 断点 7 档的签名）
    const wth = document.querySelector<HTMLElement>("#vp-timeheight .mw-wth");
    expect(wth).not.toBeNull();
    expect(wth?.dataset.rows).toBe("10");
    expect(wth?.dataset.cols).toBe("8");
    expect(wth?.querySelectorAll("rect.mw-wth-cellmissing")).toHaveLength(2);
    expect(wth?.querySelectorAll(".mw-csl-seg")).toHaveLength(7);
    const legendTicks = [...(wth?.querySelectorAll<HTMLElement>(".mw-csl-tick") ?? [])].map(
      (t) => t.textContent,
    );
    expect(legendTicks).toEqual(["0", "3", "5", "10", "15", "20", "30", "+"]);

    // ③b 风羽切换：缺省箭头 → 勾选后每有向格一枚完整风羽（杆＝旗/划可数）、箭头消失
    const thRoot = document.querySelector<HTMLElement>("#vp-timeheight");
    const arrowsBefore = thRoot?.querySelectorAll("g.mw-wth-arrow").length ?? 0;
    expect(arrowsBefore).toBeGreaterThan(0);
    expect(thRoot?.querySelector(".mw-wth-barb")).toBeNull(); // 缺省无风羽元素
    const toggle = document.getElementById("vp-th-barb") as HTMLInputElement;
    toggle.click();
    const thBarb = document.querySelector<HTMLElement>("#vp-timeheight");
    expect(thBarb?.querySelectorAll("g.mw-wth-arrow")).toHaveLength(0);
    const staffs = thBarb?.querySelectorAll("line.mw-wth-barb-staff").length ?? 0;
    expect(staffs).toBe(arrowsBefore); // 同一批有向格：箭头数＝杆数
    expect(thBarb?.querySelectorAll("polygon.mw-wth-barb-pennant").length ?? 0).toBeGreaterThan(0); // 高层大编码有旗
    expect(thBarb?.querySelector(".mw-wth-glyphnote")?.textContent).toContain("风羽");
    toggle.click(); // 切回箭头（缺省形态回归）
    expect(
      document.querySelector<HTMLElement>("#vp-timeheight")?.querySelectorAll("g.mw-wth-arrow")
        .length,
    ).toBe(arrowsBefore);

    // ④ W-13 阵风：24 时次、缺测三时次断成两段、阵风只在编报时次（事件标记数＝data-gusts）
    const gb = document.querySelector<HTMLElement>("#vp-gustband .mw-gb");
    expect(gb).not.toBeNull();
    expect(gb?.dataset.samples).toBe("24");
    expect(gb?.querySelectorAll("polyline.mw-gb-curve")).toHaveLength(2);
    const gustCount = Number(gb?.dataset.gusts ?? 0);
    expect(gustCount).toBeGreaterThan(0);
    expect(gb?.querySelectorAll("circle.mw-gb-gust")).toHaveLength(gustCount);

    // ⑤ W-14 风向条：24 格、跨北接缝两格（356°/4°）色相相邻、缺测格与静风格在
    const wds = document.querySelector<HTMLElement>("#vp-dirstrip .mw-wds");
    expect(wds).not.toBeNull();
    expect(wds?.querySelectorAll(".mw-wds-cell")).toHaveLength(24);
    expect(wds?.querySelectorAll(".mw-wds-cell.mw-wds-calm").length).toBe(3); // 后半夜静风三时次
    expect(wds?.querySelectorAll(".mw-wds-cell.mw-wds-miss").length).toBe(4); // M/空串/缺席四时次
    const cells = [...(wds?.querySelectorAll<HTMLElement>(".mw-wds-cell") ?? [])];
    // 序列 i=15（355°）→ i=16（4°）：环上步进 9°，无跨带断裂
    const step = Math.abs(hueOfCell(cells[15]) - hueOfCell(cells[16]));
    expect(Math.min(step, 360 - step)).toBeCloseTo(9, 5);
  }, 30_000);
});
