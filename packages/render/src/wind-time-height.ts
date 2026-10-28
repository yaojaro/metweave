/**
 * @metweave/render — 时间-高度剖面（W-12）：多层×多时刻风场热图。
 *
 * 形态：行＝层（自上而下＝高度升序，对数气压/线性高度轴选型同 windProfileChart）、
 * 列＝时刻；**风速当色、风向当标记**——格色来自调用方传入的分级色标（与场图家族
 * 同一份口径：色斑图例 `renderColorScaleLegend` 被本组件内嵌复用，断点/停靠色与
 * 色斑图层同源；render 不存口径，缺省不猜——不传 `scale` 显式报错并指向 grid 的
 * 要素档案）。每格一枚方向标记，缺省**箭头**（箭杆指去向）；`windGlyph:"barb"` 切
 * **风羽**模式——杆指来向、旗/长划/短划＝可数风速、静风＝圆圈（时间-高度风羽剖面
 * 图形态；刻度数字经 `barbScale` 从 grid 的 `WIND_BARB_SCALES` 流入，render 只做
 * 几何——编码/口径单源纪律同 ColorScaleLegendInput）。
 *
 * 缺测可辨：speed null 的格**不着色**——浅灰底＋对角短划的专属形态（与「着了色的
 * 弱风格」一眼可分）；direction null 的格无箭头。时间维逐格独立缺测（某层某时刻断
 * 观不连坐整行）。
 *
 * 列标签按估宽抽稀（长标签自动稀疏示出，ISO 全标可读）；格阵过窄＋超长标签时首尾
 * 两枚可能紧挤——宿主可传短标签（grid 适配器 `windTimeHeightOf` 的 `timeLabel:
 * "short"` 直出「日T时Z」形态）。
 *
 * 层行按层锚自排；层锚混装或某行两锚皆缺 → 显式抛错（同 windProfileChart 的轴纪律）。
 */
import type {
  WindBarbScaleInput,
  WindDisplayUnitInput,
  WindTimeHeightLevel,
  WindTimeHeightSeries,
} from "./wind-profile";
import { colorAt, normalizeWindDisplayUnit } from "./wind-profile";
import { barbGlyphEl, barbGlyphLevelOf, calmGlyphEl } from "./wind-barb-glyph";
import { renderColorScaleLegend } from "./color-scale-legend";
import type { ColorScaleLegendInput } from "./color-scale-legend";

/** windTimeHeight 的选项。 */
export interface WindTimeHeightOptions {
  /**
   * 分级色标（**必传**）：`breaks` 断点＋`colors` 停靠色，与色斑图层/图例同一份
   * （10m 风家族即 `@metweave/grid` 的 `windProfile` 档案 thresholds/colorStops——
   * render 不存口径，色阶单一来源在档案）。
   */
  readonly scale: ColorScaleLegendInput;
  /** 风速量纲声明（缺省 `"m/s"`；数值必须已是该单位——本组件不换算） */
  readonly unit?: WindDisplayUnitInput;
  /**
   * 风向标记形态（缺省 `"arrow"`——箭头指去向，**行为与既有版本零变化**）；
   * `"barb"` 时每格画一枚**完整风羽**（杆指来向、旗/长划/短划＝可数风速、静风＝
   * 圆圈）——时间-高度风羽剖面图的形态。
   */
  readonly windGlyph?: "arrow" | "barb";
  /**
   * 风羽刻度（`windGlyph:"barb"` 时**必传**）：按量纲键给出旗/长划/短划各代表的
   * 风速——宿主一行直传 `@metweave/grid` 的 `WIND_BARB_SCALES`（数字单一来源在
   * grid，render 不复制第二份；组件按 `unit` 声明自动选档：kt 用 kt 档、m/s 用
   * m/s 档）。条目结构见 `WindBarbScaleInput`（包间配对纪律同 ColorScaleLegendInput）。
   */
  readonly barbScale?: Readonly<Record<"m/s" | "kt", WindBarbScaleInput>>;
  /**
   * 风羽静风阈（同 unit 量纲，缺省 1＝杆口径惯例）：格风速低于此值画圆圈静风符号、
   * 不画杆（与 `windBarbOf` 静风不出杆同口径）。
   */
  readonly barbCalmThreshold?: number;
  /**
   * 格宽（px，缺省 22、格高＝格宽＋4）：风羽尺寸随格宽自适应降级——≥18 全要素、
   * 12–17 只画旗＋长划、10–11 只画杆（方向可读速度不可数）；<10 显式抛错。
   */
  readonly cellWidth?: number;
  /**
   * 风速色斑底（缺省 `true`＝色斑热图形态，**行为零变化**）；`false`＝**符号主导
   * 形态**——格底透明（不画色斑色块）、内嵌色标图例不画（无色斑＝色条无对应读法），
   * 风羽/箭头/静风圈/缺测斜纹全部保留。业务「时间-高度风羽剖面图」的纯风羽版
   * （大格子＋`windGlyph:"barb"` 组合即参照形态）。
   */
  readonly shaded?: boolean;
  /** 色标图例标题（缺席用 locale 缺省「风速（单位）」） */
  readonly legendTitle?: string;
  /** 标题行（缺席不画） */
  readonly title?: string;
  /** 文案语言（缺省 zh） */
  readonly locale?: "zh" | "en";
  /** 叠加到根元素的类名（宿主样式钩子） */
  readonly className?: string;
}

const STYLE_ID = "metweave-wind-time-height-style";
const SVG_NS = "http://www.w3.org/2000/svg";

const WTH_CSS = `
.mw-wth { display: inline-block; padding: 8px 10px; border: 1px solid #d8dee6; border-radius: 8px; background: #fbfcfd; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2a37; }
.mw-wth-title { font-size: 13px; font-weight: 600; color: #33506b; margin: 0 0 4px; }
.mw-wth svg { display: block; }
.mw-wth .mw-wth-cellmissing { fill: #e8ecf1; }
.mw-wth .mw-wth-slash { stroke: #aab6c2; stroke-width: 1; }
.mw-wth .mw-wth-arrow { stroke: #1f2a37; stroke-width: 1.2; stroke-linecap: round; fill: #1f2a37; opacity: 0.78; }
.mw-wth .mw-wth-glyphnote { margin: 4px 0 0; font-size: 10.5px; color: #8a94a3; }
.mw-wth .mw-wth-rowlabel { font: 10px system-ui, sans-serif; fill: #6b7785; }
.mw-wth .mw-wth-collabel { font: 9.5px system-ui, sans-serif; fill: #6b7785; }
.mw-wth .mw-wth-legend { margin: 6px 0 0; }
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = WTH_CSS;
  document.head.append(style);
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string>>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

/** 标签估宽（px）：ASCII ≈5.5／CJK ≈9.5（9.5px 字号的近似——抽稀只求不重叠不求精确；
 *  不捕获作用域，置模块层）。 */
const labelWidthOf = (t: string): number => {
  let w = 0;
  for (const ch of t) w += ch.charCodeAt(0) > 0xff ? 9.5 : 5.5;
  return w;
};

/** 时间-高度剖面的文案表（zh / en；同本包纪律）。 */
interface WindTimeHeightLocale {
  readonly ariaLabel: string;
  readonly legendTitle: (unit: string) => string;
  /** barb 模式的标记说明行（随模式切换——arrow 缺省模式不画此行，保持既有 DOM 零变化） */
  readonly glyphNoteBarb: string;
}

const LOCALE: Record<"zh" | "en", WindTimeHeightLocale> = {
  zh: {
    ariaLabel: "时间-高度剖面",
    legendTitle: (unit) => `风速（${unit}）`,
    glyphNoteBarb: "风向标记：风羽——杆指来向，旗/长划/短划＝可数风速；静风＝圆圈",
  },
  en: {
    ariaLabel: "Wind time-height cross section",
    legendTitle: (unit) => `Wind speed (${unit})`,
    glyphNoteBarb:
      "Glyph: wind barb — staff points upwind; pennant/full/half barbs encode speed; calm = circle",
  },
};

/** 行校验：值域与锚纪律（与 windProfileChart 同口径；cells 长度须等于 times）。 */
function assertRow(level: WindTimeHeightLevel, index: number, timeCount: number): void {
  const at = `第 ${index + 1} 行`;
  const { pressure, height } = level;
  if (pressure !== undefined && pressure !== null && !(Number.isFinite(pressure) && pressure > 0)) {
    throw new Error(
      `windTimeHeight ${at}的 pressure 非法（${String(pressure)}，须为正有限数〔hPa〕或缺测 null）`,
    );
  }
  if (height !== undefined && height !== null && !(Number.isFinite(height) && height >= 0)) {
    throw new Error(
      `windTimeHeight ${at}的 height 非法（${String(height)}，须为 ≥0 的有限数〔m〕或缺测 null）`,
    );
  }
  if ((pressure === undefined || pressure === null) && (height === undefined || height === null)) {
    throw new Error(`windTimeHeight ${at}缺层锚（pressure 与 height 至少其一在场）`);
  }
  if (level.cells.length !== timeCount) {
    throw new Error(
      `windTimeHeight ${at}的 cells 长度 ${level.cells.length} ≠ times 长度 ${timeCount}——二维序列必须逐位对齐`,
    );
  }
  for (const [ci, cell] of level.cells.entries()) {
    const speed = cell.speed;
    const direction = cell.direction;
    if (speed !== undefined && speed !== null && !(Number.isFinite(speed) && speed >= 0)) {
      throw new Error(
        `windTimeHeight ${at}第 ${ci + 1} 格的 speed 非法（${String(speed)}，须为 ≥0 的有限数或缺测 null）`,
      );
    }
    if (
      direction !== undefined &&
      direction !== null &&
      !(Number.isFinite(direction) && direction >= 0 && direction <= 360)
    ) {
      throw new Error(
        `windTimeHeight ${at}第 ${ci + 1} 格的 direction 非法（${String(direction)}，须为 0–360 的有限数）`,
      );
    }
  }
}

/**
 * 画一张时间-高度剖面（W-12）：多层×多时刻热图——风速当色（调用方传入的场图家族
 * 色标）、风向当标记（逐格箭头）、缺测格不着色（浅灰底＋对角短划，可辨）。
 *
 * @param series2d - 多层×多时刻二维序列（levels 每行 cells 与 times 对齐）
 * @param options - 见 WindTimeHeightOptions；`scale` 必传。
 */
export function windTimeHeight(
  series2d: WindTimeHeightSeries,
  options: WindTimeHeightOptions,
): HTMLElement {
  for (const key of Object.keys(options)) {
    if (
      key !== "scale" &&
      key !== "unit" &&
      key !== "windGlyph" &&
      key !== "barbScale" &&
      key !== "barbCalmThreshold" &&
      key !== "cellWidth" &&
      key !== "shaded" &&
      key !== "legendTitle" &&
      key !== "title" &&
      key !== "locale" &&
      key !== "className"
    ) {
      throw new Error(
        `windTimeHeight 收到未知选项 "${key}"（可用项：scale、unit、windGlyph、barbScale、barbCalmThreshold、cellWidth、shaded、legendTitle、title、locale、className）——拼错的选项不会生效`,
      );
    }
  }
  const shaded = options.shaded ?? true;
  if (typeof shaded !== "boolean") {
    throw new Error(
      `windTimeHeight 的 shaded 选项值须为布尔（true＝色斑热图、false＝符号主导无色斑）`,
    );
  }
  const windGlyph = options.windGlyph ?? "arrow";
  if (windGlyph !== "arrow" && windGlyph !== "barb") {
    const badGlyph: string = windGlyph; // never 收窄后的宽化中转（同 card.ts）
    throw new Error(
      `windTimeHeight 的 windGlyph 选项值 "${badGlyph}" 不受支持（可用："arrow" | "barb"）`,
    );
  }
  if (options.locale !== undefined && options.locale !== "zh" && options.locale !== "en") {
    const badLocale: string = options.locale; // never 收窄后的宽化中转（同 card.ts）
    throw new Error(`windTimeHeight 的 locale 选项值 "${badLocale}" 不受支持（可用："zh" | "en"）`);
  }
  const T = LOCALE[options.locale ?? "zh"];
  const unit = normalizeWindDisplayUnit(options.unit, "windTimeHeight");
  if (unit !== "m/s" && unit !== "kt") {
    throw new Error(
      `windTimeHeight 的 unit 选项值 "${String(options.unit)}" 不受支持（可用："m/s" | "kt"；"mps" 为别名）`,
    );
  }
  if (options.scale === undefined) {
    throw new Error(
      "windTimeHeight 缺 scale 选项（分级色标必传——与场图家族同一份：断点/停靠色取自 @metweave/grid 的要素档案，render 不存口径）",
    );
  }
  if (options.scale.colors.length === 0) {
    throw new Error("windTimeHeight 的 scale.colors 为空——色标至少一色");
  }
  // 风羽刻度：barb 模式必传（数字单源在 grid 的 WIND_BARB_SCALES——render 不存口径）；
  // 结构校验位权（短划 < 长划 < 旗，反着写＝图在教错误的读法，同 renderWindLegend 纪律）
  const barbScales = options.barbScale;
  if (windGlyph === "barb") {
    if (barbScales === undefined) {
      throw new Error(
        'windTimeHeight 的 windGlyph:"barb" 缺 barbScale 选项（风羽刻度必传——直传 @metweave/grid 的 WIND_BARB_SCALES，按 unit 声明自动选档）',
      );
    }
    const ids: readonly ("m/s" | "kt")[] = ["m/s", "kt"];
    for (const id of ids) {
      const entry = barbScales[id];
      if (entry === undefined) continue; // 缺当前档由下方 activeBarbScale 守卫点名
      for (const field of ["pennant", "long", "short"] as const) {
        if (!Number.isFinite(entry[field]) || entry[field] <= 0) {
          throw new Error(
            `windTimeHeight 的 barbScale.${id}.${field} 非法（${String(entry[field])}，须为正有限数）`,
          );
        }
      }
      if (!(entry.short < entry.long && entry.long < entry.pennant)) {
        throw new Error(
          `windTimeHeight 的 barbScale.${id} 位权反了（short ${entry.short} / long ${entry.long} / pennant ${entry.pennant}）——须满足 短划 < 长划 < 旗`,
        );
      }
    }
  }
  // 当前量纲档的刻度（kt 用 kt 档、m/s 用 m/s 档——与 windBarbOf 的 unit 选档同口径；
  // JS 调用方可能只传单键 Record，缺当前量纲档显式抛错而非静默跳画）
  const activeBarbScale = barbScales?.[unit];
  if (windGlyph === "barb" && activeBarbScale === undefined) {
    throw new Error(
      `windTimeHeight 的 barbScale 缺 "${unit}" 档（须按量纲键给全旗/长划/短划刻度——直传 @metweave/grid 的 WIND_BARB_SCALES 即两档齐）`,
    );
  }
  const barbCalmThreshold = options.barbCalmThreshold ?? 1; // 缺省 1＝杆口径惯例（同 windBarbOf）
  if (!Number.isFinite(barbCalmThreshold) || barbCalmThreshold < 0) {
    throw new Error(
      `windTimeHeight 的 barbCalmThreshold 非法（${String(options.barbCalmThreshold)}，须 ≥0 的有限数，同 unit 量纲）`,
    );
  }
  const cellWidthOpt = options.cellWidth ?? 22;
  if (!Number.isFinite(cellWidthOpt) || cellWidthOpt < 10) {
    throw new Error(
      `windTimeHeight 的 cellWidth 非法（${String(options.cellWidth)}，须 ≥10 的有限数〔px〕——10 以下连方向杆都摆不下）`,
    );
  }
  if (series2d.times.length < 2) {
    throw new Error(
      `windTimeHeight 时刻数不足（${series2d.times.length} < 2）——剖面至少两个时刻起画`,
    );
  }
  if (series2d.levels.length < 2) {
    throw new Error(`windTimeHeight 层数不足（${series2d.levels.length} < 2）——剖面至少两层起画`);
  }
  for (const t of series2d.times) {
    if (typeof t !== "string" || t === "") {
      throw new Error("windTimeHeight 的 times 含空标签——每列需要可读的时刻标签");
    }
  }
  for (const [index, level] of series2d.levels.entries())
    assertRow(level, index, series2d.times.length);
  const allPressure = series2d.levels.every((l) => l.pressure !== undefined && l.pressure !== null);
  const allHeight = series2d.levels.every((l) => l.height !== undefined && l.height !== null);
  if (!allPressure && !allHeight) {
    throw new Error(
      "windTimeHeight 的层锚混装（部分行只带 pressure、部分只带 height）——行排序无从谈起，请统一层锚",
    );
  }
  const axis: "pressure" | "height" = allPressure ? "pressure" : "height";
  // 行自上而下＝高度升序：气压升序（300 在上、850 在下）／高度降序（12000 在上、10 在下）
  const rows = [...series2d.levels];
  rows.sort((a, b) => {
    if (allPressure) return (a.pressure ?? 0) - (b.pressure ?? 0);
    return (b.height ?? 0) - (a.height ?? 0);
  });

  ensureStyle();
  const root = document.createElement("div");
  root.className = "mw-wth";
  if (options.className !== undefined) root.classList.add(options.className);
  root.dataset.axis = axis;
  root.dataset.rows = String(rows.length);
  root.dataset.cols = String(series2d.times.length);
  root.dataset.unit = unit;
  root.dataset.shaded = String(shaded);
  if (options.title !== undefined) {
    const title = document.createElement("p");
    title.className = "mw-wth-title";
    title.textContent = options.title;
    root.append(title);
  }

  // 画布几何：格阵（列＝时刻、行＝层；行序已按自上而下＝高度升序排好）
  const cellW = cellWidthOpt;
  const cellH = cellWidthOpt + 4;
  const left = 46;
  const rightPad = 10;
  const top = 16;
  const bottom = 26;
  const cols = series2d.times.length;
  const plotW = cols * cellW;
  const plotH = rows.length * cellH;
  const width = left + plotW + rightPad;
  const height = top + plotH + bottom;
  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width: `${width}`,
    height: `${height}`,
    role: "img",
    "aria-label": T.ariaLabel,
  });

  rows.forEach((level, ri) => {
    const y = top + ri * cellH;
    // 行标签（层锚值；气压取整、高度按值）
    const rowLabel = svgEl("text", {
      x: `${left - 6}`,
      y: (y + cellH / 2 + 3.5).toFixed(1),
      "text-anchor": "end",
      class: "mw-wth-rowlabel",
    });
    const anchor = axis === "pressure" ? level.pressure : level.height;
    rowLabel.textContent = anchor === undefined || anchor === null ? "—" : `${anchor}`;
    svg.append(rowLabel);

    level.cells.forEach((cell, ci) => {
      const x = left + ci * cellW;
      const speed = cell.speed;
      const direction = cell.direction;
      if (speed === undefined || speed === null) {
        // 缺测格：浅灰底＋对角短划（不着色＝与弱风格一眼可分）
        svg.append(
          svgEl("rect", {
            x: `${x + 1}`,
            y: `${y + 1}`,
            width: `${cellW - 2}`,
            height: `${cellH - 2}`,
            rx: "2",
            class: "mw-wth-cellmissing",
          }),
          svgEl("line", {
            x1: `${x + 3}`,
            y1: `${y + cellH - 3}`,
            x2: `${x + cellW - 3}`,
            y2: `${y + 3}`,
            class: "mw-wth-slash",
          }),
        );
        return;
      }
      if (shaded) {
        svg.append(
          svgEl("rect", {
            x: `${x + 1}`,
            y: `${y + 1}`,
            width: `${cellW - 2}`,
            height: `${cellH - 2}`,
            rx: "2",
            fill: colorAt(speed, options.scale),
          }),
        );
      }
      // shaded:false＝符号主导形态：不画色斑色块（格底透明），风羽/箭头/静风圈照画
      const cx = x + cellW / 2;
      const cy = y + cellH / 2;
      if (windGlyph === "barb") {
        // 风羽模式：静风阈下画圆圈静风符号（不画杆）；有向格画完整风羽（杆指来向）
        if (speed < barbCalmThreshold) {
          const holder = svgEl("g", { transform: `translate(${cx} ${cy})` });
          holder.append(calmGlyphEl(Math.min(cellW, cellH) - 6));
          svg.append(holder);
          return;
        }
        if (direction !== undefined && direction !== null && activeBarbScale !== undefined) {
          const holder = svgEl("g", { transform: `translate(${cx} ${cy})` });
          holder.append(
            barbGlyphEl({
              direction,
              speed,
              scale: activeBarbScale,
              level: barbGlyphLevelOf(cellW),
              size: Math.min(cellW, cellH) - 6,
            }),
          );
          svg.append(holder);
        }
        return;
      }
      if (direction !== undefined && direction !== null) {
        // 风向标记（缺省 arrow）：箭杆指去向（来向 +180°）
        const g = svgEl("g", {
          transform: `translate(${cx} ${cy}) rotate(${((direction + 180) % 360).toFixed(1)})`,
          class: "mw-wth-arrow",
        });
        g.append(
          svgEl("line", { x1: "0", y1: "6", x2: "0", y2: "-3" }),
          svgEl("polygon", { points: "0,-8 -2.4,-2.4 2.4,-2.4" }),
        );
        svg.append(g);
      }
    });
  });

  // 列标签：按**标签估宽**抽稀（不再按个数——grid 适配器直出的 ISO 标签约 17 字符，
  // 按个数抽稀在 8 列 3 小时间隔的标准 24h 剖面上重叠约 3.6 倍）。估宽：ASCII ≈5.5px、
  // CJK ≈9.5px（9.5px 字号的近似——抽稀只求不重叠，不求精确）；相邻示签的列距 × 格宽
  // ≥ 最大标签宽 + 8px 间隙；末列恒示，倒数第二枚与末列列距不足时隔掉倒数第二枚。
  // 残余边界：格阵过窄＋标签超长时首尾两枚仍可能紧挤——宿主可传短标签（grid 适配器
  // 的 `timeLabel: "short"` 直出「日T时Z」形态）。
  const maxLabelW = series2d.times.reduce((m, t) => Math.max(m, labelWidthOf(t)), 0);
  const labelStep = Math.max(1, Math.ceil((maxLabelW + 8) / cellW));
  const shownCols: number[] = [];
  for (let ci = 0; ci < cols; ci += labelStep) shownCols.push(ci);
  if (shownCols[shownCols.length - 1] !== cols - 1) shownCols.push(cols - 1);
  while (shownCols.length >= 3) {
    const beforeLast = shownCols[shownCols.length - 2];
    if (beforeLast === undefined || beforeLast === 0) break;
    if (cols - 1 - beforeLast >= labelStep) break;
    shownCols.splice(shownCols.length - 2, 1); // 与末列挤：隔掉倒数第二枚（首末恒保）
  }
  for (const ci of shownCols) {
    const t = series2d.times[ci];
    if (t === undefined) continue;
    const label = svgEl("text", {
      x: `${left + ci * cellW + cellW / 2}`,
      y: `${top + plotH + 15}`,
      "text-anchor": ci === 0 ? "start" : ci === cols - 1 ? "end" : "middle",
      class: "mw-wth-collabel",
    });
    label.textContent = t;
    svg.append(label);
  }
  // 行轴单位（左上）
  const unitLabel = svgEl("text", {
    x: `${left - 6}`,
    y: `${top - 4}`,
    "text-anchor": "end",
    class: "mw-wth-rowlabel",
  });
  unitLabel.textContent = axis === "pressure" ? "hPa" : "m";
  svg.append(unitLabel);
  root.append(svg);

  // barb 模式的标记说明行（随模式切换；arrow 缺省模式不画——既有 DOM 零变化）
  if (windGlyph === "barb") {
    const glyphNote = document.createElement("p");
    glyphNote.className = "mw-wth-glyphnote";
    glyphNote.textContent = T.glyphNoteBarb;
    root.append(glyphNote);
  }

  // 色标图例：内嵌 renderColorScaleLegend（categorical 形态）——与场图家族同一读法；
  // shaded:false 不画（无色斑＝色条无对应读法，画出来误导读图）
  if (shaded) {
    const legend = renderColorScaleLegend(options.scale, {
      mode: "categorical",
      title: options.legendTitle ?? T.legendTitle(unit),
      firstEdgeLabel: "0",
    });
    legend.classList.add("mw-wth-legend");
    root.append(legend);
  }
  return root;
}
