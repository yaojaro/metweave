/**
 * @metweave/render — 渲染层：领域天气组件。
 * The rendering layer: domain weather components.
 *
 * 当前交付：报文卡片——纯 DOM 组件、零框架依赖（服务端渲染与私有化部署友好），
 * 渐进式自定义：默认样式开箱即用（样式随组件注入），宿主可用 className 叠加，
 * 或绕过组件直接消费 IR 自建 UI。
 * 路线图（planned）：图表组件计划采用 Canvas 2D 优先、context 注入式内核
 * （零 DOM 依赖；WebGL 为风场粒子阶段的可选后端）。
 */
export * from "./card";
export * from "./taf-card";
