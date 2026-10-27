/**
 * examples 页面共用小件（2026-10-27 评审收口：setStatus 三份／inputById 四份归一——
 * 此前各页手抄同构副本，改口径要改多处）。刻意只收「不挑页面」的纯 DOM 工具：
 * 页面语义（装载流程、错误文案）仍归各 main。
 */

/** 按类型守卫取 input（禁 as 断言）：非 input 元素返回 null，调用点各自判空。 */
export const inputById = (id: string): HTMLInputElement | null => {
  const node = document.getElementById(id);
  return node instanceof HTMLInputElement ? node : null;
};

/** 状态行 tone（与各页 #status[data-tone] 的 CSS 变体一一对应）。 */
export type StatusTone = "loading" | "ok" | "error";

/**
 * 状态行工厂：绑定 #status/#status-text（各页同 ID 约定），tone＝"ok" 时 dismissMs 后
 * 自动收起（loading/error 常驻——由下一次 setStatus 或流程终点改写）。元素缺席时为
 * 空操作（测试/裁剪页可无状态行调用）。
 */
export const statusLineOf = (dismissMs = 8000): ((text: string, tone: StatusTone) => void) => {
  const status = document.getElementById("status");
  const statusText = document.getElementById("status-text");
  return (text, tone) => {
    if (status === null || statusText === null) return;
    status.dataset.tone = tone;
    statusText.textContent = text;
    status.hidden = false;
    if (tone === "ok") {
      window.setTimeout(() => {
        status.hidden = true;
      }, dismissMs);
    }
  };
};
