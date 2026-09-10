/**
 * @metweave/leaflet — Leaflet 适配器：把渲染内核挂接为 Leaflet canvas 图层。
 * The Leaflet adapter: bridges the metweave render kernel onto a Leaflet canvas layer.
 *
 * v0.1 唯一地图适配器；MapLibre 第二，高德/百度只预留适配器接口
 * （GCJ-02 坐标对齐在实现相应适配器时处理）。
 */

/** 脚手架占位导出：适配器实装时移除。 */
export const leafletEntry = { name: "@metweave/leaflet", adapter: "leaflet" } as const;
