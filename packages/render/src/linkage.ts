/**
 * @metweave/render — 两卡联动浮层共享内核（owner 9/24 工程债批：card.ts 与 taf-card.ts 的
 * 联动代码收进单一模块）。此前两卡各写一份「卡内绝对定位 + 边界钳制」几何与 aria 开合生命周期，
 * 且 METAR 侧缺滚动补偿（卡滚动后浮签/气泡错位——潜在错位随统一修复，行为锁在 linkage.test.ts）。
 *
 * 语义约定（两卡同款）：
 * - 坐标系＝滚动容器内容原点：绝对定位子元素随内容滚动，视口矩形差须补 root.scrollLeft/Top；
 * - 浮签（chip）：悬浮于目标上方、右缘对齐目标、卡宽内钳制（先设内容与 display 再量宽高）；
 * - 气泡（bubble）：触发元下方优先，放不下翻到上方，卡宽内钳制；
 * - aria 生命周期：开＝气泡定 id + 触发元挂 aria-expanded/aria-describedby；关＝摘除（读屏）。
 */

/** 浮签落位：目标上方、右缘对齐、卡内钳制（滚动补偿版——调用方先设好内容与 display:inline-block） */
export const positionChipNear = (root: HTMLElement, chip: HTMLElement, near: HTMLElement): void => {
  const rr = root.getBoundingClientRect();
  const nr = near.getBoundingClientRect();
  const chipW = chip.offsetWidth;
  const left = Math.max(
    4,
    Math.min(nr.right - rr.left - chipW + root.scrollLeft, root.clientWidth - chipW - 4),
  );
  const top = Math.max(0, nr.top - rr.top - chip.offsetHeight - 2 + root.scrollTop);
  chip.style.left = `${left}px`;
  chip.style.top = `${top}px`;
};

/** 气泡落位：触发元下方优先、放不下翻上方、卡宽内钳制（调用方先 display:block——先落位再量宽高） */
export const positionBubbleAt = (
  root: HTMLElement,
  bubble: HTMLElement,
  trigger: HTMLElement,
  gap = 4,
): void => {
  const rr = root.getBoundingClientRect();
  const tr = trigger.getBoundingClientRect();
  const bw = Math.min(bubble.offsetWidth, root.clientWidth - 8);
  const bh = bubble.offsetHeight;
  const left = Math.max(
    4,
    Math.min(tr.left - rr.left + root.scrollLeft, root.clientWidth - bw - 4),
  );
  const below = tr.bottom - rr.top + gap + root.scrollTop;
  const top =
    below + bh <= root.clientHeight - 4
      ? below
      : Math.max(0, tr.top - rr.top - bh - 2 + root.scrollTop);
  bubble.style.left = `${left}px`;
  bubble.style.top = `${top}px`;
};

/** 气泡 aria 开：气泡定 id（幂等）+ 触发元挂 aria-expanded/aria-describedby（读屏接气泡） */
export const ariaOpen = (trigger: HTMLElement, bubble: HTMLElement, id: string): void => {
  bubble.id = id;
  trigger.setAttribute("aria-expanded", "true");
  trigger.setAttribute("aria-describedby", id);
};

/** 气泡 aria 关：摘除触发元的展开态标注（气泡本体由调用方按其显隐机制收） */
export const ariaClose = (trigger: HTMLElement | null): void => {
  trigger?.removeAttribute("aria-expanded");
  trigger?.removeAttribute("aria-describedby");
};
