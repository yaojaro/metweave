/**
 * 要素档案：500hPa 高度（gh）——格点线第九切片，等值线主导形态的第二消费要素、
 * **特值线高亮的首个消费要素**（内核 contoursOf 的 highlighted 线种随本片接线
 * @metweave/leaflet 的 addContourLayer：5880 副高线红色加粗＋标注同色加粗）。
 *
 * 口径依据（docs/10 十五节表 A/B 实测调研＋容器头实测核对 gh_cn.mwgrid）：
 * - 源场 GFS HGT/500mb（500hPa 位势高度），存储单位 gpm（容器头原串）；中国域窗实测
 *   （2026-10-06T18Z f000）5109.5–5922.5 gpm、p50 5870.7（表 A 全球调研 4665–5951、
 *   p50 5641 同构）——连续场、**5880 线＝西太平洋副热带高压锚**（表 B 定案「等值线
 *   主导＋可选填色、5880 高亮、60 gpm 惯例间隔」）；
 * - 显示换算 gpm 恒等直读（表 B 另有「gpm→dam ÷10」候选——气象业务图两种口径并存，
 *   定 gpm：5880 是 gpm 口径的中文气象圈最强认知锚，标注直读 5880，÷10 成 588 反失锚；
 *   dam 不换算进本档案）；
 * - 档位：等距固定域 [5040, 5940] gpm×60 gpm×15 档（跨时次可比；域端点为 60 的整数倍，
 *   **全部档界恰为 60 gpm 等值线位、末断点恰为 5880——填色档界与特值线天然对齐**
 *   〔5880 以上即副高体，起最深档〕，照 prmsl 的「填色档界与等值线对齐」手法）；
 *   两端外延档兜冬季深槽/夏季副高核心的跨季极端值（同档同色，极端读数交给等值线与
 *   中心标注）；不立分位推荐（分位断点不落 60 gpm 整数倍，与等值线错位即失去对齐
 *   价值——等值线主导形态单一推荐模式）；
 * - 色标：浅渐进单色（等值线主导，填色只打底）——ColorBrewer Blues 九级裁去最深两档
 *   得七停靠：低高度（槽/冷涡）浅→高高度（脊/副高）深；单色渐进与 prmsl 的 RdBu 双极
 *   填色在视觉上区分两形态要素，5880 红线压蓝色填色上对比醒目；
 * - 等值线：interval 60 gpm（常规线，气象分析图惯例间隔、数值标注）、无加密线
 *   （500hPa 高度图惯例不加密；60 gpm 档界即线位，密度已足）、**highlighted [5880]**
 *   （特值线：5880 gpm＝副高线，中文气象圈最强认知锚——5880 兼为 60 的倍数，线种按
 *   特值优先归 highlighted 不重复出线）。
 * 与其他要素档案零 import（垂直切片架构约束，见 element.ts 文件头）。
 */
import type { ElementProfile } from "../element";

export const ghProfile: ElementProfile = {
  shortName: "gh",
  labelZh: "500hPa 高度",
  variable: "HGT",
  level: "500mb",
  storageUnit: "gpm",
  displayUnit: "gpm",
  toDisplay: (value) => value,
  colorStops: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5"],
  equal: { min: 5040, max: 5940, bins: 15 },
  defaultMode: "equal",
  renderForm: "filled+contours",
  contours: { interval: 60, highlighted: [5880] },
};
