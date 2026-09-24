import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * 悬浮层错位契约（owner 9/24「重叠了，需要错开」：导览卡原 top 10/10 与 Leaflet 缩放控件同角压叠）。
 * 量纲：缩放控件（.leaflet-bar，topleft 默认位）实测占 (10,10)–(44,75)；
 * 导览下移至 83＝控件底 75 + 8 间隙；导览高约 91（340px 宽换行后）→ 弹窗 autopan 左上避让须 ≥ 83+91。
 * 两值耦合锁：动 guide 顶边或缩导览避让任一处，另一处必须同步——防止回叠。
 * 注意：vitest 对 .css 模块（含 ?raw）返回空串，故这里用 node:fs 直读源文件。
 */
const readSrc = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8");

describe("左上角悬浮层错位（导览 vs 缩放控件）", () => {
  const guideTop = Number(/#guide\s*\{[^}]*?top:\s*(\d+)px/.exec(readSrc("style.css"))?.[1] ?? NaN);
  const panTopLeftY = Number(
    /autoPanPaddingTopLeft:\s*L\.point\(\s*\d+,\s*(\d+)\s*\)/.exec(readSrc("main.ts"))?.[1] ?? NaN,
  );

  it("导览顶边 ≥ 83（缩放控件底 75 + 8 间隙——不再同角压叠）", () => {
    expect(Number.isFinite(guideTop)).toBe(true);
    expect(guideTop).toBeGreaterThanOrEqual(83);
  });

  it("弹窗左上避让 ≥ 导览底边（guideTop+91，导览下移后卡片不得滑入其下）", () => {
    expect(Number.isFinite(panTopLeftY)).toBe(true);
    expect(panTopLeftY).toBeGreaterThanOrEqual(guideTop + 91);
  });
});
