// @vitest-environment happy-dom
/**
 * examples 共享小件测试（shared.ts——setStatus 三份/inputById 四份收口的回归锁）：
 * inputById 的类型守卫收窄、statusLineOf 的 tone 写入与 ok 态定时收起（假时钟）。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { inputById, statusLineOf } from "./shared";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("inputById（守卫取件）", () => {
  it("input 命中返回元素；他类元素/缺席返回 null（不用裸断言）", () => {
    document.body.innerHTML = '<input id="a"><div id="b"></div><input type="checkbox" id="c">';
    expect(inputById("a")?.id).toBe("a");
    expect(inputById("b")).toBeNull();
    expect(inputById("c")?.type).toBe("checkbox");
    expect(inputById("missing")).toBeNull();
  });
});

/** 状态行 DOM 装配（模块级——不捕获 describe 作用域）。 */
const mount = (): { status: HTMLElement; text: HTMLElement } => {
  document.body.innerHTML = '<div id="status" hidden><span id="status-text"></span></div>';
  return {
    status: document.getElementById("status") as HTMLElement,
    text: document.getElementById("status-text") as HTMLElement,
  };
};

describe("statusLineOf（状态行工厂）", () => {
  it("tone 入 data-tone、文本入 status-text、unhidden；loading/error 不自动收起", () => {
    vi.useFakeTimers();
    const { status, text } = mount();
    const setStatus = statusLineOf();
    setStatus("装载中…", "loading");
    expect(status.dataset.tone).toBe("loading");
    expect(text.textContent).toBe("装载中…");
    expect(status.hidden).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(status.hidden).toBe(false); // loading 常驻
    setStatus("失败", "error");
    vi.advanceTimersByTime(60_000);
    expect(status.hidden).toBe(false); // error 常驻
  });

  it("ok 态按 dismissMs 自动收起（各页时长差异经参数保留）", () => {
    vi.useFakeTimers();
    const { status } = mount();
    statusLineOf(6000)("已上图", "ok");
    expect(status.hidden).toBe(false);
    vi.advanceTimersByTime(5999);
    expect(status.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(status.hidden).toBe(true);
  });

  it("元素缺席为空操作不抛错（裁剪页可无状态行调用）", () => {
    const setStatus = statusLineOf();
    expect(() => setStatus("x", "ok")).not.toThrow();
  });
});
