/**
 * @metweave/render — 渲染层：自研内核与领域组件。
 * The rendering layer: the in-house kernel and domain weather components.
 *
 * 内核纪律：Canvas 2D 先行、context 注入式、零 DOM/框架依赖（服务端渲染与
 * 私有化部署的前提）；WebGL 仅为风场粒子阶段的可选后端。报文卡片为纯 DOM 组件、
 * 渐进式自定义，稳定性承诺只覆盖 CSS 变量名与分组函数签名，DOM 内部结构声明 unstable。
 */

/** 脚手架占位导出：验证跨包构建图，内核实装时移除。 */
export const renderEntry = { name: "@metweave/render", stage: "render" } as const;
