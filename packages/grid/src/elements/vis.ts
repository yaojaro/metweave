/**
 * 要素档案：能见度（vis）——格点线第六切片，复用既有阈值档能力（内核零改动），
 * 本片唯一新小件在显示层：满量程哨兵的「≥24.1km」末档注记（topBinNote——threshold
 * 档图例的泛化末缘标注机制，本要素是首个消费方）。
 *
 * 口径依据（docs/10 十五节表 A/B 实测调研＋容器头实测核对 vis_cn.mwgrid）：
 * - 源场 GFS VIS/sfc，存储单位 m，显示 km（÷1000——换算只在本档案与显示层，转换器
 *   不动数值语义）；断点直接写在显示空间（km），与 equal 域同规约不经 toDisplay 反推；
 * - 满量程哨兵：源场量程顶 24130 m（调研口径；中国域窗实测解码落值 24134.87 m＝
 *   24.13 km，p25 起全档饱和——约 88% 像素在哨兵上）是「≥24.1 km」的打包真值而非
 *   缺测：落最高档 [10,∞) 正常着色**不透明**（与 cape/prate 首档透明相反的方向——
 *   「极好能见度」是强信号，透明即丢内容；档案不声明 transparentBins），图例末档
 *   注记「≥24.1（满量程）」补审查语义：末档颜色实为满量程以上真值，24.1 km 以上
 *   不可分辨（数据诚实口径，不进刻度序列——刻度是数值位、注记是语义位）；
 * - 档位：阈值档 0.4/0.8/1.5/3/5/10 km（升序 6 断点×7 档：METAR 能见度 tier 同族
 *   ——≥10/≥5/<3/<1.5/<0.8/<0.4 km 六档语义，与第一组件判据联动的最强内容点；
 *   气象惯例定档，表 B 定案）；不立等距/分位推荐（p25 起饱和的分位档全塌最高档
 *   失效、等距无惯例锚——单一推荐模式，缺省即阈值）；
 * - 色标：逆向发散渐进（ColorBrewer RdYlBu，低→高＝差→好：红→橙→黄→近白→浅蓝→
 *   深蓝——能见度差=红/橙警示醒目、好=蓝，与 tmp 的 RdBu 反向（蓝=冷）同族对偶）；
 *   7 档取样 (bin+0.5)/7，首档 t≈0.07 深红、末档 t≈0.93 深蓝；档案 colorStops 仍按
 *   低→高写（内核契约）；
 * - 等值线 1 km 留位（无特值线；绘制能力随等值线切片引入，此处不实现）。
 * 与其他要素档案零 import（垂直切片架构约束，见 element.ts 文件头）。
 */
import type { ElementProfile } from "../element";

export const visProfile: ElementProfile = {
  shortName: "vis",
  labelZh: "能见度",
  variable: "VIS",
  level: "sfc",
  storageUnit: "m",
  displayUnit: "km",
  toDisplay: (value) => value / 1000,
  colorStops: [
    "#d73027",
    "#f46d43",
    "#fdae61",
    "#fee090",
    "#ffffbf",
    "#e0f3f8",
    "#abd9e9",
    "#74add1",
    "#4575b4",
  ],
  thresholds: [0.4, 0.8, 1.5, 3, 5, 10],
  defaultMode: "threshold",
  renderForm: "filled",
  contours: { interval: 1, highlighted: [] },
  topBinNote: "≥24.1（满量程）",
};
