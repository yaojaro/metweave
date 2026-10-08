/**
 * 要素档案：850hPa 温度（t850，shortName 对齐 gen:grid CLI 的 ELEMENTS 键——「拉最新」
 * 中间件把 shortName 原样转发 CLI，键对齐即全链路直通〔gh≠hgt 键断裂的反例见十五节〕；
 * 备忘录表 A/B 行名 t＝温度，gen 键随层编码取 t850，导出名 t850Profile、文件名随
 * elements/<short-name>.ts 惯例）——格点线第十一切片，**零新能力**：与 tmp 同族的
 * 高空温度，色标/档位/等值线留位/渲染形态与 tmp 逐字段同构（内核/leaflet/面板零改动
 * ——「加要素＝加档案＋清单一行」主张的连续实证）。
 *
 * 口径依据（docs/10 十五节表 A/B 实测调研＋容器头实测核对 t850_cn.mwgrid）：
 * - 源场 GFS TMP/850mb（参数号 0-0——与 2m 温度同参数不同层），存储单位 K，显示 °C
 *   （−273.15——换算只在本档案与显示层，转换器不动数值语义）；中国域窗实测
 *   （2026-10-06T18Z f000）258.6–300.2K＝−14.6–27.1°C、p50 16.7°C（表 A 全球调研
 *   224.1–304.2K＝−49.1–31.1°C 同构——连续近高斯、无哨兵）；
 * - 色标与 tmp 同带：发散热带蓝-白-红（ColorBrewer RdBu 反向 9 停靠，蓝=冷低值、
 *   红=暖高值），白心钉 0°C。**等距域取与 tmp 同域 [-40, 40]°C×4°C×20 档**（表 B
 *   「同 2t 带」的字面继承）：对称域使 0°C 恰为档界兼色带白心（colorAt 按档心均匀
 *   取样，白停靠钉在域中心——非对称域〔如恰好罩住全球调研值域的 [-48,32]〕会把白心
 *   钉到域中心 −8°C，与「白心钉 0°C」冲突，弃）；与 tmp 同域另得**跨要素可比**——
 *   同一色＝同一温度，2m↔850hPa 垂直热结构在面板切换间直接可读；断点 −36…36 全为
 *   4 的整数倍，与留位等值线 interval 4 天然对齐（档界即线位）；全球调研极值
 *   −49.1°C 落下外延档、31.1°C 落域内（外延档即其设计语义；10 月窗实测用档 5–16/20）；
 * - 档位双模式（与 tmp 同构）：等距（固定域跨时次可比）＋分位数（p10/p25/p50/p75/p90
 *   五断点——连续近高斯场分位档不失效，对照 cape/prate 零值堆反例；「同 2t 带」的
 *   等距＋分位双模式一并继承）；
 * - 等值线：interval 4°C、0°C 特值线——**owner 2026-10-07 定案「只描等值线，不标注
 *   中心」**，renderForm 升 "filled+contours"、档案声明 contours.centers:false：
 *   addContourLayer 缺省的 L/H 中心标注是气压习语（红 L「低压中心」/蓝 H「高压
 *   中心」），落到温度场即语义错位（冷中心≠低压——冷坑会被标成一串「低压中心」），
 *   温度场读图按等温线走向与 0°C 零度层锚（降水形态判据常识、色带白心同钉 0°C），
 *   不引入冷暖中心新习语；0°C 走特值线红色加粗标注（认知锚线与值不可分）。
 * 与其他要素档案零 import（垂直切片架构约束，见 element.ts 文件头）。
 */
import type { ElementProfile } from "../element";

export const t850Profile: ElementProfile = {
  shortName: "t850",
  labelZh: "850hPa 温度",
  variable: "TMP",
  level: "850mb",
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
  renderForm: "filled+contours",
  contours: { interval: 4, highlighted: [0], centers: false },
};
