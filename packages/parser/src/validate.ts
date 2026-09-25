/**
 * @metweave/parser — TAF 判据校验层（/validate，v0.2 补齐批：其他全部修复」指令）。
 * The TAF rule-validation layer:条文判据在解析层五处被显式移交至此（C2/C3/C5/B7 注释），本层收口。
 *
 * 判据清单（来源＝学习线补全清单 + taf-tac §3，条款号核自 WMO 306 FM 51）：
 * - C2 VRB 阈值两源（§51.3）：WMO 风速 <1.5 m/s 才可编 VRB / CAAC <2 m/s 或雷暴——机器只判风速侧，
 *   「无法预报单一风向/雷暴」逃逸条款不由电码承载，明示不可判；
 * - C3 阵风阈值（§51.3）：阵风超出平均 ≥5 m/s（10 kt）才合法编 Gfmfm——严格不等式按条文（D 节纪律）；
 * - C5 天气白名单双层（§51.5.1）：国际白名单为基（冻降水/中大降水含阵雨/尘沙暴/雷暴/冻雾/吹尘沙雪/飑/漏斗云），
 *   中国扩展层（弱档 -、BR、HZ——与 parser C5 注记同一判式）按 standard 取合法（caac）或违例（wmo）；
 * - C7 三层选取（§51.6.1.4）：第 1 组任意量、第 2 组 >2 oktas（SCT 起）、第 3 组起 >4 oktas（BKN 起）——
 *   仅全重报语境（基况段/FM 段）适用；BECMG/TEMPO 组内所列为局部清单不适用（B5）；CB/TCU 缺报侧不可判；
 * - B7 间歇判据为空集：发作每次 <1h、累计 <半窗不由电码承载，机器不可判（判卷场景靠出题纪律，明示）。
 */
import { MetarParseError } from "@metweave/core";
import type { CloudCondition, Span, TafReport, WeatherGroup, WindGroup } from "@metweave/core";

/** 判据阈值源：wmo（缺省）＝国际白名单/VRB<1.5；caac＝中国民航（中国扩展层天气合法/VRB<2） */
export type TafValidateStandard = "wmo" | "caac";

export interface TafValidateOptions {
  readonly standard?: TafValidateStandard;
}

/** 违例码（稳定契约，只增不改）：C2/C3/C5/C7 四判据各一 */
export type TafViolationCode =
  | "vrb-over-threshold" /** C2：VRB 风速 ≥ 阈值（wmo 1.5 / caac 2 m/s），不应编 VRB */
  | "gust-below-threshold" /** C3：阵风超出平均 <5 m/s（10 kt），G 组不合法 */
  | "wx-outside-list" /** C5：天气组不在预报白名单（国际层外；中国扩展层在 wmo 标准下违例） */
  | "cloud-layer-selection"; /** C7：三层选取违例（第 2 组 FEW / 第 3 组起 FEW·SCT） */

export interface TafViolation {
  readonly code: TafViolationCode;
  readonly severity: "warning";
  readonly message: string;
  /** 违例所在段（「基况段」/「FM 0100」/「TEMPO 0609/0612」——变化组以变化词+窗口/时刻指位） */
  readonly where: string;
  readonly span?: Span;
}

const MPS_OF = { mps: 1, kt: 0.514444, kmh: 1 / 3.6 } as const;
const mpsOf = (value: number, unit: keyof typeof MPS_OF): number => value * MPS_OF[unit];

/** 国际白名单内的中/大降水现象码（弱档 - 一律出层；DZ 毛毛雨不在 TAF 白名单——教材 §3.5） */
const INTL_PRECIP = new Set(["RA", "SN", "SG", "PL", "GS", "GR"]);
/** 独立成组即白名单的现象码：尘暴/沙暴/飑/漏斗云（任意强度含 +） */
const INTL_STANDALONE = new Set(["DS", "SS", "SQ", "FC"]);

/**
 * C5 国际白名单判定（§51.5.1 教材口径）：冻降水（FZRA/FZDZ）/ 雷暴族（TS 起头）/ 中大降水（含 SH 阵雨族，
 * 强度非弱档）/ 尘暴 DS / 沙暴 SS / 冻雾 FZFG / 吹尘沙雪（BLDU/BLSA/BLSN）/ 飑 SQ / 漏斗云 FC。
 * VC 邻近（METAR 语汇）一律出层。
 */
const inIntlWhitelist = (g: WeatherGroup): boolean => {
  if (g.proximity) return false;
  const codes = g.phenomena as readonly string[];
  const has = (p: string): boolean => codes.includes(p);

  if (g.descriptor === "TS") return true;
  if (g.descriptor === "FZ" && (has("RA") || has("DZ") || has("FG"))) return true;
  if (g.descriptor === "BL" && (has("DU") || has("SA") || has("SN"))) return true;
  if (codes.some((p) => INTL_STANDALONE.has(p))) return true;
  if (codes.length > 0 && codes.every((p) => INTL_PRECIP.has(p))) return g.intensity !== "-";
  return false;
};

/** 中国扩展层（与 parser C5 注记同一判式，单一真相）：弱档 - 或 BR/HZ */
const isCnExtension = (g: WeatherGroup): boolean => {
  const codes = g.phenomena as readonly string[];
  return g.intensity === "-" || codes.includes("BR") || codes.includes("HZ");
};

const weatherCodeOf = (g: WeatherGroup): string => {
  const i = g.intensity ?? "";
  const d = g.descriptor ?? "";
  return `${g.proximity ? "VC" : ""}${i}${d}${g.phenomena.join("")}`;
};

const UNIT_WORD = { mps: "MPS", kt: "KT", kmh: "KMH" } as const;

/** 风组两判据（C2/C3）：VRB 阈值与阵风增量（各自单位换算米/秒后比较） */
const windViolations = (
  wind: WindGroup,
  where: string,
  standard: TafValidateStandard,
): TafViolation[] => {
  const out: TafViolation[] = [];
  const threshold = standard === "caac" ? 2 : 1.5;
  if (wind.variable && mpsOf(wind.speed.value, wind.speed.unit) >= threshold) {
    out.push({
      code: "vrb-over-threshold",
      severity: "warning",
      where,
      span: wind.speed.span,
      message: `VRB 风速 ${wind.speed.value}${UNIT_WORD[wind.speed.unit]} ≥ ${threshold} m/s（${standard === "caac" ? "CAAC" : "WMO"} 口径）——不应编 VRB（C2；「无法预报单一风向/雷暴」逃逸条款不由电码承载，本判不覆盖）`,
    });
  }
  const gust = wind.gust;
  if (
    gust !== undefined &&
    mpsOf(gust.value, gust.unit) - mpsOf(wind.speed.value, wind.speed.unit) < 5
  ) {
    out.push({
      code: "gust-below-threshold",
      severity: "warning",
      where,
      span: gust.span,
      message: `阵风超出平均不足 5 m/s（10 kt）——G 组不合法（C3，严格 ≥5 m/s 才可编）`,
    });
  }
  return out;
};

/** C7 三层选取（§51.6.1.4，仅全重报语境）：第 2 组须 >2 oktas、第 3 组起须 >4 oktas（CB/TCU 缺报侧不可判） */
const cloudViolations = (clouds: CloudCondition | undefined, where: string): TafViolation[] => {
  if (clouds === undefined) return [];
  const layers = clouds.elements.filter((e) => e.kind === "layer");
  const out: TafViolation[] = [];
  layers.forEach((layer, idx) => {
    if (layer.amount === null) return;
    const illegal =
      idx === 1 && layer.amount === "FEW"
        ? "第 2 组须 >2 oktas（SCT 起步）"
        : idx >= 2 && (layer.amount === "FEW" || layer.amount === "SCT")
          ? "第 3 组起须 >4 oktas（BKN 起步）"
          : undefined;
    if (illegal !== undefined) {
      out.push({
        code: "cloud-layer-selection",
        severity: "warning",
        where,
        span: layer.span,
        message: `三层选取违例：第 ${idx + 1} 组编 ${layer.amount}——${illegal}（C7/§51.6.1.4；CB/TCU「未入前三必补」的缺报侧不由电码承载）`,
      });
    }
  });
  return out;
};

/**
 * 校验一份已解析的 TAF：返回全部条文违例（空数组＝通过）。
 * 判据与边界见模块头注（C2/C3/C5/C7；B7 机器判据空集）。不修改报告、不抛错——
 * 严判入口是 parseTaf({mode:"strict"})，本函数供质控/判卷侧按需取用。
 */
export function validateTaf(
  report: TafReport,
  options: TafValidateOptions = {},
): readonly TafViolation[] {
  const standard = options.standard ?? "wmo";
  const out: TafViolation[] = [];
  // 风组三态解包（Observed<WindGroup>）：缺测/未知无判据意义，只有在场值参与判卷
  const baseWind = report.wind?.kind === "value" ? report.wind.value : undefined;
  if (baseWind !== undefined) out.push(...windViolations(baseWind, "基况段", standard));
  out.push(...cloudViolations(report.clouds, "基况段"));

  const wxCheck = (g: WeatherGroup, where: string): void => {
    if (inIntlWhitelist(g)) return;
    if (standard === "caac" && isCnExtension(g)) return;
    const layer = isCnExtension(g) ? "中国扩展层，非 WMO 白名单" : "国际白名单外";
    out.push({
      code: "wx-outside-list",
      severity: "warning",
      where,
      span: g.span,
      message: `天气组 ${weatherCodeOf(g)} 不在 TAF 预报白名单（${layer}；C5/§51.5.1——caac 标准下中国扩展层合法）`,
    });
  };
  if (report.weather?.kind === "value") for (const g of report.weather.value) wxCheck(g, "基况段");

  for (const change of report.changes) {
    const where = change.window !== undefined ? `${change.kind} ${change.window.raw}` : change.kind;
    const e = change.elements;
    if (e === undefined) continue;
    if (e.wind !== undefined) out.push(...windViolations(e.wind, where, standard));
    if (change.kind === "FM") out.push(...cloudViolations(e.clouds, where)); // C7 仅全重报语境（B4）
    for (const g of e.weather) wxCheck(g, where);
  }
  return out;
}

/**
 * strict 门（parseTaf mode:"strict" 的判卷侧）：任一条文违例（validateTaf）或 warning 级解析告警
 * （重复组/概率越界/组合违例等）即整体不通过——聚合为稳定错误码 strict-violation。
 * info 级（方言收编/缺测注记/中国扩展注记）不拦：真实世界被接受的形态。
 */
export function strictGate(
  report: TafReport,
  raw: string,
  standard: TafValidateStandard = "wmo",
): void {
  const violations = validateTaf(report, { standard }).map((v) => `${v.where}：${v.message}`);
  const warnings = report.warnings.filter((w) => w.severity === "warning").map((w) => w.message);
  const all = [...violations, ...warnings];
  if (all.length === 0) return;
  throw new MetarParseError(
    "strict-violation",
    raw,
    `strict 校验未通过（${all.length} 项）——${all.slice(0, 3).join("；")}${all.length > 3 ? "……" : ""}`,
  );
}
