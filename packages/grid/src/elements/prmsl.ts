/**
 * 要素档案：海平面气压（prmsl）——格点线第八切片，**等值线主导形态**的首个消费要素：
 * 色斑浅填色打底＋等值线（4 hPa 常规线标值、2 hPa 加密细线）＋低压「L」/高压「H」
 * 中心标注（内核 contoursOf/centersOf 两能力＋@metweave/leaflet 的 addContourLayer 叠层）。
 *
 * 口径依据（docs/10 十五节表 A/B 实测调研＋容器头实测核对 prmsl_cn.mwgrid）：
 * - 源场 GFS PRMSL/msl（mean sea level），存储单位 Pa（容器头原串），显示 hPa（÷100
 *   ——换算只在本档案与显示层，转换器不动数值语义）；中国域窗实测
 *   （2026-10-06T18Z f000）1000.6–1039.7 hPa、p50 1015.3（表 A 全球调研 941–1047、
 *   p50 1013 同构）——连续场、**低压中心＝内容锚**（表 B 定案「等值线主导＋浅填色＋
 *   低中心标注；等值线 2/4 hPa」）；
 * - 档位：等距固定域 [984, 1044] hPa×4 hPa×15 档（跨时次可比；域取 4 的整数倍端点，
 *   **全部档界恰为 4 hPa 等值线位**——填色档界与等值线天然对齐，色斑边界即等值线的
 *   预读）；两端外延档兜台风低压/大陆强高压的极端值（同档同色，极端读数交给等值线与
 *   中心标注）；不立分位推荐（分位断点不落 4 hPa 整数倍，与等值线错位即失去对齐价值
 *   ——等值线主导形态单一推荐模式）；
 * - 色标：浅填色（等值线主导，填色只打底）——ColorBrewer RdBu 内七段（裁去外侧两对
 *   深色停靠）：低＝浅蓝→白→高＝浅红，七停靠中位 #f7f7f7 恰落档 7 中心 1014 hPa
 *   （9 段取样 t=0.5），气压 polarity（低蓝高红）与 tmp 家族同构、饱和度浅一档；
 * - 等值线：interval 4 hPa（常规线，数值标注）、minorInterval 2 hPa（加密细线，
 *   气象惯例不标值——兼为 4 的倍数的值归常规线不重复出线）、无特值线（气压无
 *   tmp 0°C/gh 5880 类认知锚线）；
 * - 低压/高压中心：内核 centersOf 局部极值检测＋间距吸收（L＝local min、H＝local max
 *   顺带，气象读图惯例 L/H 成对），中心标字母＋中心 hPa 值。
 * 与其他要素档案零 import（垂直切片架构约束，见 element.ts 文件头）。
 */
import type { ElementProfile } from "../element";

export const prmslProfile: ElementProfile = {
  shortName: "prmsl",
  labelZh: "海平面气压",
  variable: "PRMSL",
  level: "msl",
  storageUnit: "Pa",
  displayUnit: "hPa",
  toDisplay: (value) => value / 100,
  colorStops: ["#4393c3", "#92c5de", "#d1e5f0", "#f7f7f7", "#fddbc7", "#f4a582", "#d6604d"],
  equal: { min: 984, max: 1044, bins: 15 },
  defaultMode: "equal",
  renderForm: "filled+contours",
  contours: { interval: 4, minorInterval: 2, highlighted: [] },
};
