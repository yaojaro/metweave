/**
 * @metweave/render — 渲染层：领域天气组件。
 * The rendering layer: domain weather components.
 *
 * 当前交付：报文卡片——纯 DOM 组件、零框架依赖（浏览器与带 DOM shim 的环境可用：
 * 组件直接调用 document API，纯 Node 环境（无 DOM polyfill）不可用——SSR 流水线请配
 * happy-dom 一类 DOM 实现后再渲染），渐进式自定义：默认样式开箱即用（样式随组件注入），
 * 宿主可用 className 叠加，或绕过组件直接消费 IR 自建 UI。
 * 路线图（planned）：图表组件计划采用 Canvas 2D 优先、context 注入式内核
 * （零 DOM 依赖；WebGL 为风场粒子阶段的可选后端）。
 * v0.6「垂直与时间」批次新增五个风序列图组件（windProfileChart / hodograph /
 * windTimeHeight / gustBand / windDirStrip，SVG/DOM 直构）与它们的共享输入类型
 * （wind-profile.ts——多层廓线/二维剖面/逐时观测三形态，与 grid 侧适配器结构配对）。
 */
export * from "./card";
export * from "./taf-card";
export * from "./wind-chip";
export * from "./wind-legend";
export * from "./color-scale-legend";
export * from "./wind-profile";
export * from "./wind-profile-chart";
export * from "./hodograph";
export * from "./wind-time-height";
export * from "./gust-band";
export * from "./wind-dir-strip";
