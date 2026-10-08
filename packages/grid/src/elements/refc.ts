/**
 * 要素档案：模拟反射率（refc）——格点线第七切片，复用既有阈值档＋档级透明两能力
 * （内核零改动），−20 无回波哨兵透明（「无信号」语义——与 vis 满量程哨兵「强信号」
 * 不透明的定案相对，见 grid-notes 十一节哨兵语义收窄）。
 *
 * 口径依据（docs/10 十五节表 A/B 实测调研＋容器头实测核对 refc_cn.mwgrid）：
 * - 源场 GFS REFC/atm（整层大气），存储单位 dB（容器头原串，=dBZ），显示 dBZ，
 *   无换算、toDisplay 恒等；
 * - −20 无回波哨兵（约 3/4 点，打包真值语义非缺测——GRIB 解码落值 −20.000004）：
 *   中国域窗实测（2026-10-06T18Z f000）−20.0–41.67 dBZ、p10=p25=p50=−20（哨兵堆）、
 *   p75=−19.95（真实弱回波）、p90=6.01、p99=30.13——分位数档塌在哨兵上即不立
 *   分位推荐的实证；哨兵与 <5 dBZ 极弱回波同落首档 [−∞,5) 整档透明
 *   （transparentBins: [0]，cape 同款）——NWS 显示下限即 5 dBZ，无回波区不画、
 *   底图透出（约 3/4 像素零绘制，性能与可读性双赢）；
 * - 档位：阈值档 5/10/…/70/75 dBZ——NWS 标准 5 dBZ 一档惯例（表 B「NWS 反射率
 *   标准色标（5–75 dBZ）」），15 断点×16 档、档界即 NWS 级界（bin k=[5k,5k+5)），
 *   顶档 [75,∞) 沿用 75 级白（NWS 显示上限以上不再分级，同色延伸无损）；断点写在
 *   显示空间（与 equal 域同规约不经 toDisplay）；不立等距/分位推荐（哨兵堆分位失效
 *   实证、等距无惯例锚——单一推荐模式，缺省即阈值）；
 * - 色标：NWS 反射率标准色标（业界认知最强：青→蓝→绿→黄→橙→红→紫→白 15 级）。
 *   色值核证（2026-10-06）：radar.weather.gov 站点代码不开源，取两处逐值一致的公开
 *   实现为权威——reinanbr/noaawc（noaawc/variables.py 的 _REFC_COLORS，levels 5–75
 *   步进 5）与「Using Python to get the latest NEXRAD Composite」笔记本（NWS Color
 *   Map 定义段）；结构佐证另见 nexrad-render Rust 库 nws_reflectivity_scale（同
 *   5–75 步进与色相进程，RGB 为近似值）。停靠色按低→高写，**每档色重复两次**
 *   （32 停靠＝16 档×2）：档中心取样 (bin+0.5)/16 × 31 恰落同色对内，逐档精确
 *   命中 NWS 原色（cape 的 4 档×9 停靠奇位精确命中同族手法）；首档停靠取 NWS
 *   无回波灰 #646464（地图上恒透明不渲染，图例左缘灰带即「<5 无回波」位）；
 * - 等值线 5 dBZ 留位（无特值线；绘制能力随等值线切片引入，此处不实现）。
 * 与其他要素档案零 import（垂直切片架构约束，见 element.ts 文件头）。
 */
import type { ElementProfile } from "../element";

/** NWS 标准反射率 15 级（5–75 dBZ 各级一色）＋首档无回波灰——低→高，每色重复两次。 */
const NWS_REFLECTIVITY_STOPS: readonly string[] = [
  // bin 0（[−∞,5) 透明档）：无回波灰（NWS 弱/无回波位，不参与着色）
  "#646464",
  "#646464",
  // 5 dBZ #04e9e7（青）→ 10 #019ff4 → 15 #0300f4（蓝）
  "#04e9e7",
  "#04e9e7",
  "#019ff4",
  "#019ff4",
  "#0300f4",
  "#0300f4",
  // 20 #02fd02 → 25 #01c501 → 30 #008e00（绿系渐深）
  "#02fd02",
  "#02fd02",
  "#01c501",
  "#01c501",
  "#008e00",
  "#008e00",
  // 35 #fdf802（黄）→ 40 #e5bc00 → 45 #fd9500（橙）
  "#fdf802",
  "#fdf802",
  "#e5bc00",
  "#e5bc00",
  "#fd9500",
  "#fd9500",
  // 50 #fd0000 → 55 #d40000 → 60 #bc0000（红系渐深）
  "#fd0000",
  "#fd0000",
  "#d40000",
  "#d40000",
  "#bc0000",
  "#bc0000",
  // 65 #f800fd（品红）→ 70 #9854c6（紫）→ 75 #fdfdfd（白）
  "#f800fd",
  "#f800fd",
  "#9854c6",
  "#9854c6",
  "#fdfdfd",
  "#fdfdfd",
];

export const refcProfile: ElementProfile = {
  shortName: "refc",
  labelZh: "模拟反射率",
  variable: "REFC",
  level: "atm",
  storageUnit: "dB",
  displayUnit: "dBZ",
  toDisplay: (value) => value,
  colorStops: NWS_REFLECTIVITY_STOPS,
  thresholds: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75],
  defaultMode: "threshold",
  renderForm: "filled",
  contours: { interval: 5, highlighted: [] },
  transparentBins: [0],
};
