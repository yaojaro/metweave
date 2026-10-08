/**
 * 要素档案：2m 温度（tmp）——格点线第一切片（温度切片）的立档件。
 *
 * 口径依据（docs 与数据形态调研的实测结论）：
 * - 源场 GFS TMP/2m AGL，存储单位 K，值域 210.8–314.6K 连续近高斯、无哨兵；
 * - 显示换算 K→°C（−273.15）——只在本档案与显示层做；
 * - 色标：发散热带蓝-白-红（ColorBrewer RdBu 反向，蓝=冷低值、红=暖高值），
 *   白心钉在 0°C（等距域取对称 [-40, 40] 使 0°C 恰为档界——未来 0°C 冰点线高亮
 *   与档界天然对齐）；
 * - 档位双模式：等距（4°C 一档 ×20 档，固定域跨时次可比）＋分位数（直读容器头
 *   p10/p25/p50/p75/p90 五断点 ×6 档，随场分布均衡）；
 * - 等值线（2/4°C）与 0°C 冰点线高亮：本切片只立口径字段（contours），绘制能力
 *   随等值线要素引入，此处不实现。
 * 与其他要素档案零 import（垂直切片架构约束，见 element.ts 文件头）。
 */
import type { ElementProfile } from "../element";

export const tmpProfile: ElementProfile = {
  shortName: "tmp",
  labelZh: "2m 温度",
  variable: "TMP",
  level: "2m",
  storageUnit: "K",
  displayUnit: "°C",
  toDisplay: (value) => value - 273.15,
  colorStops: [
    "#2166ac",
    "#4393c3",
    "#92c5de",
    "#d1e5f0",
    "#f7f7f7",
    "#fddbc7",
    "#f4a582",
    "#d6604d",
    "#b2182b",
  ],
  equal: { min: -40, max: 40, bins: 20 },
  quantile: [0.1, 0.25, 0.5, 0.75, 0.9],
  defaultMode: "equal",
  renderForm: "filled",
  contours: { interval: 4, highlighted: [0] },
};
