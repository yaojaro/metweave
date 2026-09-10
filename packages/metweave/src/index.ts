/**
 * metweave — 伞包：解析 → 标准化 → 渲染的单一入口。
 * The umbrella package: one entry for the parse → standardize → render pipeline.
 *
 * 只 re-export core / parser / render，不含地图适配器（@metweave/leaflet 独立安装）。
 * 取数 helper 位于 `metweave/sources` 子路径——端点模板 + fetch，核心包零网络。
 */
export * from "@metweave/core";
export * from "@metweave/parser";
export * from "@metweave/render";
