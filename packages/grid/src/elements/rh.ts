/**
 * 要素档案：2m 相对湿度（rh）——格点线第三切片，零新能力（纯加档案，有界场等距特例）。
 *
 * 口径依据（docs 数据形态调研实测＋容器头实测核对 rh_cn.mwgrid）：
 * - 源场 GFS RH/2m AGL，存储单位 %（有界 0–100，无换算、toDisplay 恒等）；
 * - 值域有界且上界饱和：全球场实测 6.9–100%（p50 79.3）、中国域窗实测 7.2–100%
 *   （p99 98.6、max 100 大量贴顶——饱和态是本要素的常态而非异常）；
 * - 色标：黄-绿-蓝单色渐进（ColorBrewer YlGnBu，浅→深＝干→湿——docs 表 B 口径
 *   「单色渐进（棕→绿或蓝）」取黄绿蓝一族：干燥端近白浅黄、饱和端深蓝，湿度语义
 *   单调递进可读，不需要 tmp 的发散双色）；
 * - 档位双模式：等距（0–100%×10%×10 档——**有界场特例**：固定域即物理全域，0 与 100
 *   恰为两端外延档界、断点为 10…90 共 9 个，binIndexAt 的两端外延档语义与物理边界
 *   天然重合，上界饱和的 100% 稳落最外档）＋分位数（p10/25/50/75/90 五断点×6 档，
 *   随场分布均衡）；
 * - 等值线 10%：留位口径字段（contours），绘制能力随等值线切片引入，此处不实现。
 * 与其他要素档案零 import（垂直切片架构约束，见 element.ts 文件头）。
 */
import type { ElementProfile } from "../element";

export const rhProfile: ElementProfile = {
  shortName: "rh",
  labelZh: "相对湿度",
  variable: "RH",
  level: "2m",
  storageUnit: "%",
  displayUnit: "%",
  toDisplay: (value) => value,
  colorStops: [
    "#ffffd9",
    "#edf8b1",
    "#c7e9b4",
    "#7fcdbb",
    "#41b6c4",
    "#1d91c0",
    "#225ea8",
    "#253494",
    "#081d58",
  ],
  equal: { min: 0, max: 100, bins: 10 },
  quantile: [0.1, 0.25, 0.5, 0.75, 0.9],
  defaultMode: "equal",
  renderForm: "filled",
  contours: { interval: 10, highlighted: [] },
};
