/**
 * 要素档案：对流有效位能（cape）——格点线第四切片，引入两个内核能力（阈值档＋档级透明）
 * 的首个消费要素。
 *
 * 口径依据（docs/10 十五节表 A/B 实测调研＋容器头实测核对 cape_cn.mwgrid）：
 * - 源场 GFS CAPE/sfc，存储单位 J kg-1（容器头原串），显示 J/kg，无换算、toDisplay 恒等；
 * - 值域重偏态＋零值堆：中国域窗实测 0–3026 J/kg（p50=1、p10=p25=0——约 45% 零值堆；
 *   全球场调研值 0–4951、p50=2 同构）——分位数档塌在零上的失效实证，即阈值档的立档理由；
 * - 档位：阈值档 1000/2500/4000 J/kg（4 档：无/中度/强/极强对流潜势——气象惯例，
 *   数据形态调研表 B 定案）；阈值直接写在显示空间（与 equal 域同规约）；不立等距/分位推荐
 *   （分位失效实证、等距无惯例锚——单一推荐模式，缺省即阈值）；
 * - 档级透明：首档（bin 0，[0,1000)＝无对流区/零值堆）不上色——alpha 0 底图透出，
 *   色斑图只画有对流信号的区域（信息密度与底图可读性双赢，约 45% 像素零绘制）；
 * - 色标：暖色渐进（ColorBrewer YlOrRd，浅→深＝弱→强——对流惯用黄→橙→红系）；首档虽
 *   透明仍占色带位（档数=breaks+1=4 决定取样位置，(bin+0.5)/4——可见三档取样
 *   t=0.375/0.625/0.875 落黄橙/红橙/深红，透明档不牵连相邻档取样）；
 * - 等值线 500 J/kg 留位（无特值线；绘制能力随等值线切片引入，此处不实现）。
 * 与其他要素档案零 import（垂直切片架构约束，见 element.ts 文件头）。
 */
import type { ElementProfile } from "../element";

export const capeProfile: ElementProfile = {
  shortName: "cape",
  labelZh: "对流有效位能",
  variable: "CAPE",
  level: "sfc",
  storageUnit: "J kg-1",
  displayUnit: "J/kg",
  toDisplay: (value) => value,
  colorStops: [
    "#ffffcc",
    "#ffeda0",
    "#fed976",
    "#feb24c",
    "#fd8d3c",
    "#fc4e2a",
    "#e31a1c",
    "#bd0026",
    "#800026",
  ],
  thresholds: [1000, 2500, 4000],
  defaultMode: "threshold",
  renderForm: "filled",
  contours: { interval: 500, highlighted: [] },
  transparentBins: [0],
};
