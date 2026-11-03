// @vitest-environment happy-dom
/**
 * 台风回放页的渲染面（0.7 批次确定性保障）：固化快照 → 风圈层逐时次选点渲染
 * （有圈时次出多边形、空 r 时次只出中心标签）、告警多边形样例层的常驻标签、
 * 读数与边界声明在位。断言全部用库自身返回物（层内多边形/marker DOM），不写死
 * 页面文案。import 即挂载的模块只求值一次——全文件单用例（vertical-demo 同款纪律）。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import dolphin from "../typhoon-dolphin-2613.json";
import { readDolphinPts, type DolphinPoint } from "./typhoon-data";

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** 填充 path＝多边形（风圈 0.08/0.14/0.22、告警 0.18）；轨迹 polyline 不带 fill 属性。 */
const filledPaths = (): number =>
  document.querySelectorAll("#ty-map .leaflet-overlay-pane path[fill-opacity]").length;
const typhoonLabels = (): number => document.querySelectorAll("#ty-map .mw-typhoon-label").length;

describe("typhoon.html 演示页（typhoon-main）", () => {
  it("逐时次选点渲染＋告警样例＋读数与边界声明（单用例：模块只求值一次）", async () => {
    const html = readFileSync("examples/typhoon.html", "utf8");
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] ?? "";
    document.body.className = "ty-page";
    document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, "");
    await import("./typhoon-main");
    await tick(); // 首帧风圈层（leaflet 惰性装载的微任务链）

    const pts: readonly DolphinPoint[] = readDolphinPts(dolphin);
    expect(pts).toHaveLength(178);

    // 首时次（只有 30KTS 级）：风圈 1 段＋告警样例 1 段＝2 个多边形；中心标签 1 枚
    expect(filledPaths()).toBe(2);
    expect(typhoonLabels()).toBe(1);
    expect(document.getElementById("ty-stamp")?.textContent ?? "").toContain("1/178");
    const readout = document.getElementById("ty-readout")?.textContent ?? "";
    expect(readout).toContain("中心气压");
    expect(readout).toContain("七级风圈 NE/SE/SW/NW");

    // 三级时次（快照首个 30+50+64 全级点）：风圈 3 段＋告警 1 段＝4 个多边形
    const triple = pts.findIndex((p) => Object.keys(p.r).length >= 3);
    expect(triple).toBeGreaterThan(0);
    const slider = document.getElementById("ty-slider") as HTMLInputElement;
    slider.value = String(triple);
    slider.dispatchEvent(new Event("input"));
    await tick();
    expect(filledPaths()).toBe(4);
    // 中心标签＝强度类别＋气压注记（快照该点 g/p 直读——202607280600：TY、970 hPa）
    const label = document.querySelector<HTMLElement>("#ty-map .mw-typhoon-label");
    expect(label?.textContent ?? "").toContain("TY");
    expect(label?.textContent ?? "").toContain("970 hPa");

    // 空 r 时次（临消散）：风圈整级缺席＝只剩告警样例 1 个多边形；中心标签照画
    const emptyIdx = pts.findIndex((p) => Object.keys(p.r).length === 0);
    expect(emptyIdx).toBeGreaterThan(triple);
    slider.value = String(emptyIdx);
    slider.dispatchEvent(new Event("input"));
    await tick();
    expect(filledPaths()).toBe(1);
    expect(typhoonLabels()).toBe(1);
    // 滑杆量程对齐数据（178 时次）
    expect(slider.max).toBe("177");

    // 边界声明：告警样例点名「样例数据」、来源与不可用于运行的声明在位
    const note = document.querySelector(".ty-note")?.textContent ?? "";
    expect(note).toContain("样例数据");
    expect(note).toContain("中央气象台台风网");
    expect(note).toContain("addHazardPolygonLayer");
    expect(note).toContain("不得用于运行决策");
    // 告警多边形样例的常驻形心标签在位
    const hazardLabel = document.querySelector<HTMLElement>("#ty-map .mw-hazard-label");
    expect(hazardLabel?.textContent ?? "").toContain("样例警戒区");
  });
});
