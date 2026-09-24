import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * 左上角悬浮层错位契约（owner 9/24 两次裁定：①「重叠了，需要错开」②「高度复原、只横向错开」）。
 * 量纲（1440px 视口实测）：缩放控件 (.leaflet-bar, topleft) 占 (10,10)–(44,75)；
 * 导览首版 top/left 10 与控件同角压叠、二版下移 83 被否——终版 top 回 10、left 52（控件右缘 44+8），
 * 占 52..418（宽 366＝max-width 340+padding 24+border 2）× 10..101（高约 91）。
 * 弹窗 autopan 左上避让区须整体罩住控件+导览：x ≥ 418+8、y ≥ 101+8 → (426, 110)。
 * 耦合锁：动 guide 顶边/左边或缩避让任一处，其余断言必须同步红——防回叠。
 * 注意：vitest 对 .css 模块（含 ?raw）返回空串，故这里用 node:fs 直读源文件。
 */
const readSrc = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8");

describe("左上角悬浮层错位（导览 vs 缩放控件）", () => {
  const css = readSrc("style.css");
  const mainTs = readSrc("main.ts");
  const guideTop = Number(/#guide\s*\{[^}]*?top:\s*(\d+)px/.exec(css)?.[1] ?? NaN);
  const guideLeft = Number(/#guide\s*\{[^}]*?left:\s*(\d+)px/.exec(css)?.[1] ?? NaN);
  const pan = /autoPanPaddingTopLeft:\s*L\.point\(\s*(\d+),\s*(\d+)\s*\)/.exec(mainTs) ?? [];
  const [panX, panY] = [Number(pan[1] ?? NaN), Number(pan[2] ?? NaN)];

  it("导览高度复原 top＝10（owner 二次裁定），左移横向错开 left ≥ 52（控件右缘 44 + 8）", () => {
    expect(guideTop).toBe(10);
    expect(Number.isFinite(guideLeft)).toBe(true);
    expect(guideLeft).toBeGreaterThanOrEqual(52);
  });

  it("弹窗左上避让区罩住控件+导览整块（x ≥ 左缘+宽 374、y ≥ 顶边+高 100）", () => {
    expect(Number.isFinite(panX)).toBe(true);
    expect(Number.isFinite(panY)).toBe(true);
    expect(panX).toBeGreaterThanOrEqual(guideLeft + 374); // 366 宽 + 8 间隙
    expect(panY).toBeGreaterThanOrEqual(guideTop + 100); // ≈91 高 + 余量
  });
});
