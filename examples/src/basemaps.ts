import * as L from "leaflet";

/**
 * 天地图浏览器端 key：只从 examples/.env.local 的 VITE_TIANDITU_KEY 读取（构建期内联）。
 * 刻意不开 URL 传参通道——key 一旦进地址栏，就会留在浏览器历史、Referer 头与中间层日志里。
 */
function tiandituKey(): string {
  return import.meta.env.VITE_TIANDITU_KEY ?? "";
}

/**
 * 天地图 WMTS 底图（矢量底图 + 中文注记两层叠加），走官方文档的 `/{layer}_w/wmts` 形式。
 * `_w` = Web Mercator 网格（与 OSM 同一套瓦片数学）。
 * 天地图服务条款要求按应用申请 key 后方可使用——示例不自带 key，请自行申请。
 */
function tiandituLayers(key: string): L.LayerGroup {
  const wmts = (layer: "vec" | "cva"): string =>
    `https://t{s}.tianditu.gov.cn/${layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0` +
    `&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles` +
    `&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${key}`;
  const opts = {
    subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
    maxZoom: 18,
  };
  const vec = L.tileLayer(wmts("vec"), { ...opts, attribution: "底图 © 天地图" });
  const cva = L.tileLayer(wmts("cva"), opts);
  return L.layerGroup([vec, cva]);
}

/**
 * 底图装配：天地图按 key 门控——未配置时不上底图，就地提示配置方式（不静默退化成另一种底图）。
 * 换底图不动业务代码：底图只在图层工厂这一层。
 * 返回值 = 底图是否就位：false = 无 key 门控态（主流程可据此挂预览内容，见 main.ts）。
 */
export function setupBasemap(map: L.Map): boolean {
  const key = tiandituKey();
  const hint = document.getElementById("basemap-hint");
  if (hint === null) throw new Error("底图提示元素 DOM 缺失");

  if (key === "") {
    hint.textContent =
      "本示例不自带底图 key：请到 console.tianditu.gov.cn 申请浏览器端 key，" +
      "写入 examples/.env.local 的 VITE_TIANDITU_KEY=… 后重启 dev server。";
    hint.hidden = false;
    return false;
  }
  tiandituLayers(key).addTo(map);
  return true;
}
