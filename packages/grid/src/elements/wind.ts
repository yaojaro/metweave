/**
 * 要素档案：10m 风（shortName "wind"——对齐 gen:grid CLI 的 ELEMENTS 键：「拉最新」
 * 中间件把 shortName 原样转发 CLI，键对齐即全链路直通〔CLI wind 条目单请求双 message
 * 产 windu/windv 双文件〕；备忘录表 A/B 行名 10u/10v）——格点线第十三切片（最后一个
 * 大件），**双分量合成＋风向杆形态**（`renderForm: "filled+barbs"`）：u/v 双场原值
 * 装载（存储不动），风速 √(u²+v²) 是显示侧派生量（内核 `windSpeedGrid`，渲染前合成
 * ——表 B「10u/10v 不作独立色斑、渲染目标=风速合成」的字面继承），色斑吃合成场、
 * 风向杆吃分量原场（内核 `windBarbsOf`，atan2 同源派生）。
 *
 * 口径依据（docs/10 十五节表 A/B＋容器头实测核对 windu/windv_cn.mwgrid）：
 * - 源场 GFS UGRD/VGRD、10m AGL、m s-1（容器头原串），**有符号分量**（本窗 u
 *   −13.88–15.87、v −20.14–11.46——表 A 全球 −39.0–36.05/−34.72–36.84 同族，
 *   中国域窗 u 约 52% 负值）——分量不作独立色斑正是为此：有符号场的色标无业务读法；
 * - 合成场口径：合成头 variable "WIND"（gen CLI wind 条目 label WIND/10m 同名——
 *   分量文件头为 UGRD/VGRD，档案 variable 字段对齐**合成场**）、level 10m、
 *   m s-1→m/s 恒等直读（显示单位斜杠是排版惯例，无换算）；中国域窗实测合成
 *   （2026-10-06T18Z f000）0.01–20.44 m/s、p50 2.56、p90 7.73、p99 12.13——
 *   非负连续右偏（无零值堆，min 0.01），静风（<1 m/s）约 14%；
 * - 档位：等距固定域 [0, 32] m/s×4 m/s×8 档（跨时次可比——同一色＝同一风速，与
 *   蒲福风级直觉挂钩）。**4 m/s 档宽的裁量**：风速业务粒度（4 m/s ≈ 蒲福中段一级
 *   的量级差，10 月窗 p10–p99 跨 0.8–12.1 m/s 恰落 4–5 个档）且断点全为 4 的整数
 *   倍图例直读（0/4/8/…/32 九刻度）；域端 0 恰为物理下界（首档 [0,4) 即微风，无
 *   负值外延档语义可漂）、上端 32 兜跨季极端（蒲福 12 级 32.7 m/s 落上外延档
 *   [32,∞)——台风极端同色兜底，本窗 max 20.44 在域内）。不立分位推荐：风速无
 *   业务分位口径（对照 tmp 连续近高斯的双模式惯例，风速的可比性锚是固定档界——
 *   单一推荐模式）；
 * - 色标：暖色渐进 ColorBrewer YlOrBr 九级裁去最深两档（#993404/#662506 近墨色）
 *   得七停靠：弱风浅黄→强风深橙棕——「风大＝警示色深」的直觉带；与 cape 的 YlOrRd
 *   同暖调不同族（棕主导 vs 红主导），面板要素族里的新一族色相，切换区分度好；
 * - 风向杆口径（进档案）：step 10（0.25° 网格即 2.5° 一根，地面分析图惯例密度，
 *   缩放无关固定步长）、calmThreshold 1 m/s（中国气象业务惯例静风阈，静风无方向
 *   可读不画杆）、形态＝**风羽**（m/s 中国口径：三角旗 20 m/s＋长划 4 m/s＋短划
 *   2 m/s——中文气象圈地面图认知最强形态；简化箭头的取舍弃用：箭头只表方向不表
 *   风速大小，色斑之外的冗余信息零增量，而风羽的速度编码是色斑色弱视用户的方向
 *   ＋速度双通道冗余；实现成本可控——纯几何 path，无字体无位图）；
 * - 等值线 4 m/s 留位（表 B 等值线列「无」：10m 风速等值线非业务惯例；若日后接线，
 *   4 m/s 恰与填色档界重合）；renderForm "filled+barbs"。
 * 与其他要素档案零 import（垂直切片架构约束，见 element.ts 文件头）。
 */
import type { ElementProfile } from "../element";

export const windProfile: ElementProfile = {
  shortName: "wind",
  labelZh: "10m 风",
  variable: "WIND",
  level: "10m",
  storageUnit: "m s-1",
  displayUnit: "m/s",
  toDisplay: (value) => value,
  colorStops: ["#ffffe5", "#fff7bc", "#fee391", "#fec44f", "#fe9929", "#ec7014", "#cc4c02"],
  equal: { min: 0, max: 32, bins: 8 },
  defaultMode: "equal",
  renderForm: "filled+barbs",
  barbs: { step: 10, calmThreshold: 1 },
  contours: { interval: 4, highlighted: [] },
};
