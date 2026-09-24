// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { ariaClose, ariaOpen, positionBubbleAt, positionChipNear } from "./linkage";
import { utcDayRefText } from "./gloss";

/**
 * 几何内核行为锁（owner 9/24 工程债批）：jsdom 无布局，度量全部以属性桩注入
 * （getBoundingClientRect/offsetWidth/clientWidth/scrollTop/Left），断言纯数学——
 * 滚动补偿、下方优先翻上方、卡内钳制三契约各有突变必红的定点。
 */
const stub = (
  tag: string,
  m: {
    rect?: { left?: number; top?: number; right?: number; bottom?: number };
    offsetWidth?: number;
    offsetHeight?: number;
    clientWidth?: number;
    clientHeight?: number;
    scrollTop?: number;
    scrollLeft?: number;
  },
): HTMLElement => {
  const d = document.createElement(tag);
  Object.defineProperty(d, "getBoundingClientRect", {
    value: () => ({
      left: m.rect?.left ?? 0,
      top: m.rect?.top ?? 0,
      right: m.rect?.right ?? 0,
      bottom: m.rect?.bottom ?? 0,
      ...(m.rect as object),
    }),
  });
  for (const [k, v] of Object.entries({
    offsetWidth: m.offsetWidth ?? 0,
    offsetHeight: m.offsetHeight ?? 0,
    clientWidth: m.clientWidth ?? 0,
    clientHeight: m.clientHeight ?? 0,
  })) {
    Object.defineProperty(d, k, { value: v, configurable: true });
  }
  d.scrollTop = m.scrollTop ?? 0;
  d.scrollLeft = m.scrollLeft ?? 0;
  document.body.append(d);
  return d;
};

afterEach(() => {
  document.body.replaceChildren();
});

describe("浮签落位（目标上方、右缘对齐、卡内钳制 + 滚动补偿）", () => {
  it("零滚动基线：left＝目标右缘−签宽，top＝目标顶−签高−2", () => {
    const root = stub("div", { clientWidth: 400, clientHeight: 300, rect: { left: 0, top: 0 } });
    const chip = stub("span", { offsetWidth: 50, offsetHeight: 20 });
    const near = stub("span", { rect: { right: 200, top: 100 } });
    positionChipNear(root, chip, near);
    expect(chip.style.left).toBe("150px");
    expect(chip.style.top).toBe("78px");
  });

  it("滚动补偿：卡滚下去 scrollTop 60/scrollLeft 20 → 坐标随内容原点平移（丢补偿即错位——工程债根因）", () => {
    const root = stub("div", {
      clientWidth: 400,
      clientHeight: 300,
      scrollTop: 60,
      scrollLeft: 20,
    });
    const chip = stub("span", { offsetWidth: 50, offsetHeight: 20 });
    const near = stub("span", { rect: { right: 200, top: 100 } });
    positionChipNear(root, chip, near);
    expect(chip.style.top).toBe("138px"); // 78 + scrollTop 60
    expect(chip.style.left).toBe("170px"); // 150 + scrollLeft 20
  });

  it("右缘钳制：目标贴近卡右缘时左移到卡内（clientWidth−签宽−4）", () => {
    const root = stub("div", { clientWidth: 120, clientHeight: 300 });
    const chip = stub("span", { offsetWidth: 50, offsetHeight: 20 });
    const near = stub("span", { rect: { right: 400, top: 100 } });
    positionChipNear(root, chip, near);
    expect(chip.style.left).toBe("66px"); // min(350, 120-50-4=66)
  });
});

describe("气泡落位（下方优先、放不下翻上方、卡宽钳制 + 滚动补偿）", () => {
  it("下方优先：放得下即落触发元下方 +4（含滚动补偿）", () => {
    const root = stub("div", { clientWidth: 400, clientHeight: 300, scrollTop: 40 });
    const bubble = stub("div", { offsetWidth: 200, offsetHeight: 80 });
    const trigger = stub("span", { rect: { left: 10, top: 120, bottom: 160 } });
    positionBubbleAt(root, bubble, trigger);
    expect(bubble.style.top).toBe("204px"); // 160 + 4 + scrollTop 40
    expect(bubble.style.left).toBe("10px"); // max(4, min(10+scrollLeft 0, 400-192-4=204))
  });

  it("翻上方：下方放不下（below+高 > 卡高−4）→ 落触发元上方", () => {
    const root = stub("div", { clientWidth: 400, clientHeight: 300 });
    const bubble = stub("div", { offsetWidth: 200, offsetHeight: 80 });
    const trigger = stub("span", { rect: { left: 10, top: 200, bottom: 250 } });
    positionBubbleAt(root, bubble, trigger);
    expect(bubble.style.top).toBe("118px"); // 200 − 80 − 2
  });

  it("宽度钳制：气泡宽超卡宽余量时按 clientWidth−8 收（左移到卡内）", () => {
    const root = stub("div", { clientWidth: 120, clientHeight: 300 });
    const bubble = stub("div", { offsetWidth: 200, offsetHeight: 80 });
    const trigger = stub("span", { rect: { left: 10, top: 20, bottom: 60 } });
    positionBubbleAt(root, bubble, trigger);
    expect(bubble.style.left).toBe("4px"); // bw=min(200,112)=112 → max(4, min(10, 120-112-4=4))=4
  });
});

describe("aria 开合生命周期", () => {
  it("开＝气泡定 id + 触发元挂 expanded/describedby；关＝摘除（读屏接气泡）", () => {
    const trigger = stub("span", {});
    const bubble = stub("div", {});
    ariaOpen(trigger, bubble, "mw-pop-1");
    expect(bubble.id).toBe("mw-pop-1");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-describedby")).toBe("mw-pop-1");
    ariaClose(trigger);
    expect(trigger.hasAttribute("aria-expanded")).toBe(false);
    expect(trigger.hasAttribute("aria-describedby")).toBe(false);
    ariaClose(null); // 空触发元（未开态）不炸
  });
});

describe("双日界引用（owner 9/24：BJ 制跨日括注 UTC 日号）", () => {
  it("同日空串；跨日 zh「（UTC 9月24日）」/ en「 (UTC 9/24)」", () => {
    const shifted = new Date(Date.UTC(2026, 8, 25, 2, 0)); // 北京时 9月25日 02:00（墙钟存 UTC 字段）
    expect(utcDayRefText(shifted, 2026, 9, 25, "zh")).toBe("");
    expect(utcDayRefText(shifted, 2026, 9, 24, "zh")).toBe("（UTC 9月24日）");
    expect(utcDayRefText(shifted, 2026, 9, 24, "en")).toBe(" (UTC 9/24)");
  });
});
