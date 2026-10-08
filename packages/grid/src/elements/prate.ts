/**
 * 要素档案：降水率（prate）——格点线第五切片，引入内核能力 log₁₀ 前置变换
 * （ColorScale.logScale——对数偏态场的分级口径）的首个消费要素，与 CAPE 切片的
 * 阈值档/档级透明两能力正交组合（threshold＋log₁₀＋首档透明）。
 *
 * 口径依据（docs/10 十五节表 A/B 实测调研＋容器头实测核对 prate_cn.mwgrid）：
 * - 源场 GFS PRATE/sfc，存储单位 kg m-2 s-1（容器头原串），显示 mm/h（×3600——
 *   换算只在本档案与显示层，转换器不动数值语义）；断点直接写在显示空间（mm/h），
 *   与 equal 域同规约不经 toDisplay 反推；
 * - 分布对数偏态＋零值堆：全球场调研 0.003–48.4 mm/h、p50 0.0029、43% 零值堆；
 *   中国域窗实测（2026-10-06T18Z f000）更极端——0–14.1 mm/h、p50=0（零值堆 74.3%、
 *   0–0.1 mm/h 微量另占 13.5%，≥0.1 mm/h 仅 12.2%）——分位数档塌在零上（p75=0.0029）
 *   的失效实证，即 log₁₀ 前置变换的立档理由；
 * - 档位：阈值档 0.1/1/5/10 mm/h（小毛毛雨/中雨/大雨/暴雨量级——气象惯例，表 B 定案）
 *   ×5 档，断点声明留在显示（线性）空间、渲染定档前统一取 log₁₀（等价于对数空间
 *   −1/0/log₁₀5/1——跨量级档界不挤在色带一端）；不立等距/分位推荐（分位塌零失效
 *   实证、等距无惯例锚——单一推荐模式）；
 * - 首档透明：bin 0＝[0, 0.1) mm/h（零值堆＋微量毛毛雨以下）不上色——恰零值走
 *   log₁₀→−Inf 的非有限透明通道、非零微量走 transparentBins 档级透明，两通道同一
 *   像素形态（alpha 0），中国域窗实测约 88% 像素零绘制（底图可读性优先）；
 * - 色标：蓝紫系单色渐进（ColorBrewer PuBu 9 停靠，浅→深＝弱→强——降水惯例
 *   低值浅高值深；表 B「Blues/PuBu 族」取 PuBu：与 rh 的 YlGnBu 同家族不同序，
 *   面板切换区分度好）；首档虽透明仍占色带位（5 档取样 (bin+0.5)/5，可见四档
 *   t=0.3/0.5/0.7/0.9 单调加深，透明档不牵连取样位置）；
 * - 等值线 1 mm/h 留位（无特值线；绘制能力随等值线切片引入，此处不实现）。
 * 与其他要素档案零 import（垂直切片架构约束，见 element.ts 文件头）。
 */
import type { ElementProfile } from "../element";

export const prateProfile: ElementProfile = {
  shortName: "prate",
  labelZh: "降水率",
  variable: "PRATE",
  level: "sfc",
  storageUnit: "kg m-2 s-1",
  displayUnit: "mm/h",
  toDisplay: (value) => value * 3600,
  colorStops: [
    "#fff7fb",
    "#ece7f2",
    "#d0d1e6",
    "#a6bddb",
    "#74a9cf",
    "#3690c0",
    "#0570b0",
    "#045a8d",
    "#023858",
  ],
  thresholds: [0.1, 1, 5, 10],
  defaultMode: "threshold",
  renderForm: "filled",
  contours: { interval: 1, highlighted: [] },
  transparentBins: [0],
  logScale: true,
};
