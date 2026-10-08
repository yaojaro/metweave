/**
 * 要素档案：2m 露点（dpt）——格点线第二切片，零新能力（纯加档案）。
 *
 * 口径依据（docs 与数据形态调研的实测结论）：
 * - 源场 GFS DPT/2m AGL，存储单位 K，值域 196–300.5K 连续近高斯、无哨兵
 *   （中国域窗实测含高原极值 −81°C，由两端外延档兜住，不拉宽固定域）；
 * - 显示换算 K→°C（−273.15）——只在本档案与显示层做；
 * - 色标：绿系单色渐进（ColorBrewer Greens，浅→深＝干→湿——露点的气象语义是
 *   「空气离饱和多远」，单色渐进即可读，不需要 tmp 的发散双色）；
 * - 档位双模式：等距（[-40, 30]°C×5°C×14 档，固定域跨时次可比——露点恒 ≤ 气温，
 *   上界 30°C 覆盖夏季华南极值、-40°C 以下落最外档）＋分位数（p10/25/50/75/90
 *   五断点×6 档，随场分布均衡）；
 * - 等值线 2°C：留位口径字段（contours），绘制能力随等值线切片引入，此处不实现。
 * 与其他要素档案零 import（垂直切片架构约束，见 element.ts 文件头）。
 */
import type { ElementProfile } from "../element";

export const dptProfile: ElementProfile = {
  shortName: "dpt",
  labelZh: "2m 露点",
  variable: "DPT",
  level: "2m",
  storageUnit: "K",
  displayUnit: "°C",
  toDisplay: (value) => value - 273.15,
  colorStops: [
    "#f7fcf5",
    "#e5f5e0",
    "#c7e9c0",
    "#a1d99b",
    "#74c476",
    "#41ab5d",
    "#238b45",
    "#006d2c",
    "#00441b",
  ],
  equal: { min: -40, max: 30, bins: 14 },
  quantile: [0.1, 0.25, 0.5, 0.75, 0.9],
  defaultMode: "equal",
  renderForm: "filled",
  contours: { interval: 2, highlighted: [] },
};
