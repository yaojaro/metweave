/**
 * @metweave/render — 风羽 glyph 几何层（W-12 `windGlyph:"barb"` 模式的内核，包内
 * 内部模块——不经 index 公开，公开面是 wind-time-height 的选项与本文件消费的
 * `WindBarbScaleInput` 契约）。
 *
 * **编码/几何分工（同 @metweave/leaflet `windBarbPath` 的既有分工，方向相反的接缝）**：
 * 旗/长划/短划各代表多少风速的**刻度数字只在 @metweave/grid 的 `WIND_BARB_SCALES`
 * 写一份**（单一事实来源），经 `barbScale` 选项整表流入（宿主一行直传）；本层只做
 * 「刻度数字＋风速 → 旗/划计数 → SVG 图元」的纯几何。计数算术（向下取整的贪心分解、
 * 短划至多一枚＋1e-6 容差）与 `windBarbOf` 同式——对**调用方传入的刻度**求值，不掺
 * 任何写死的档位常数（render 复制第二份刻度表＝两套口径从此分裂，禁止）。
 *
 * 静风口径：速度低于调用方给的静风阈（组件缺省 1，杆口径惯例）→ 圆圈静风符号、
 * 不画杆（与 `windBarbOf` 静风不出杆同口径）。尺寸降级阶梯见 `barbGlyphLevelOf`。
 *
 * 着色（v0.6 W-10 风羽廓线起）：`ink` 传入时以**内联样式**写进 glyph 根（子图元经
 * CSS 类定线宽、经继承取墨色——内联样式优先级最高，不与任何宿主样式表耦合）——
 * 「色斑长在风羽上」：调用方用 `wind-profile.ts` 的 `colorAt(speed, scale)` 把该层
 * 风速映射成墨色。样式表随本模块自足注入一次（类名为本模块所有，任何宿主组件可用）。
 */
import type { WindBarbScaleInput } from "./wind-profile";

/** 风羽的降级档（格宽不足时的显式定义，见 barbGlyphLevelOf）。 */
export type BarbGlyphLevel = "full" | "longs-only" | "staff-only";

/**
 * 风羽尺寸降级阶梯（显式定义＋测试锁）：格宽 ≥18 全要素（旗＋长划＋短划）；
 * 12–17 只画旗＋长划（短划在 <18px 的格里梢距不可辨，宁可少数不多画错读）；
 * 10–11 只画杆（速度不可数、方向仍可读——降级为方向杆）。格宽 <10 由组件入口
 * 直接拒收（连方向杆都摆不下，图例性失效）。
 */
export function barbGlyphLevelOf(cellWidth: number): BarbGlyphLevel {
  if (cellWidth >= 18) return "full";
  if (cellWidth >= 12) return "longs-only";
  return "staff-only";
}

/**
 * 风速 → 旗/长划/短划计数（贪心分解，**与 grid `windBarbOf` 同式**：向下取整到
 * 刻度、短划至多一枚、1e-6 浮点容差——算术对调用方传入的刻度求值，档位常数单源在
 * grid 的 `WIND_BARB_SCALES`）。
 */
function barbCountsOf(
  speed: number,
  scale: WindBarbScaleInput,
): { readonly pennants: number; readonly longs: number; readonly shorts: number } {
  let rest = speed;
  const pennants = Math.floor(rest / scale.pennant);
  rest -= pennants * scale.pennant;
  const longs = Math.floor(rest / scale.long);
  rest -= longs * scale.long;
  const shorts = rest >= scale.short - 1e-6 ? 1 : 0;
  return { pennants, longs, shorts };
}

const SVG_NS = "http://www.w3.org/2000/svg";

const STYLE_ID = "metweave-wind-barb-glyph-style";

const BARB_GLYPH_CSS = `
.mw-wth-barb { stroke: #1f2a37; fill: #1f2a37; opacity: 0.82; }
.mw-wth-barb-staff { stroke-width: 1.3; stroke-linecap: round; }
.mw-wth-barb-pennant { stroke-width: 0.8; }
.mw-wth-barb-long, .mw-wth-barb-short { stroke-width: 1.1; stroke-linecap: round; fill: none; }
.mw-wth-barb-calm { stroke-width: 1.2; fill: none; }
`;

/** 样式只注入一次（类名为本模块所有；宿主组件 W-10/W-12 共用同一份）。 */
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = BARB_GLYPH_CSS;
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

/** 风羽 glyph 的构建入参。 */
export interface BarbGlyphArgs {
  /** 风向（气象口径**来向**，0–360°——杆指向来向，与箭头标记的去向口径相反） */
  readonly direction: number;
  /** 风速（量纲须与刻度一致——量纲匹配由调用方声明纪律承担） */
  readonly speed: number;
  /** 填图刻度（单源在 grid 的 WIND_BARB_SCALES，经组件 barbScale 选项流入） */
  readonly scale: WindBarbScaleInput;
  /** 降级档（组件按可用尺寸现算，见 barbGlyphLevelOf） */
  readonly level: BarbGlyphLevel;
  /** glyph 可用边长（px，组件按格宽/层距自适应给出） */
  readonly size: number;
  /**
   * 墨色（可选）：传入时以内联样式写到 glyph 根（子图元继承）——「色斑长在风羽上」
   * 的着色通道（如 `colorAt(speed, scale)` 的产物）；缺席时走样式表缺省墨色。
   */
  readonly ink?: string;
}

/**
 * 构建一枚完整风羽（`<g class="mw-wth-barb">`，杆指来向、旗/长划/短划＝可数风速）。
 * 羽画在杆的 x＞0 侧（顺来向看的右手边——北半球业务惯例：羽指向低压，与
 * `@metweave/leaflet` 的 `windBarbPath` 同侧）；旗在杆头、长划次之、短划靠杆根。
 * 纯 DOM 构造、零副作用，静风形态（`<circle class="mw-wth-barb-calm">`）由组件
 * 分流后单独画。
 */
export function barbGlyphEl(args: BarbGlyphArgs): SVGGElement {
  const { direction, speed, scale, level, size, ink } = args;
  ensureStyle();
  // 只带 rotate（杆指来向）；格心/列位平移由组件外层 <g transform="translate(cx cy)"> 承担
  const g = svgEl("g", {
    class: "mw-wth-barb",
    transform: `rotate(${direction})`,
  });
  if (ink !== undefined) {
    g.style.stroke = ink; // 内联优先于样式表——子图元经继承取墨色（线类 fill:none 不受影响）
    g.style.fill = ink;
  }
  const half = size / 2;
  g.append(
    svgEl("line", {
      x1: "0",
      y1: `${half}`,
      x2: "0",
      y2: `${-half}`,
      class: "mw-wth-barb-staff",
    }),
  );
  if (level === "staff-only") return g;
  const { pennants, longs, shorts } = barbCountsOf(speed, scale);
  const feather = 0.36 * size; // 羽展长（旗/长划梢到杆的距离）
  const pennantH = 0.24 * size; // 旗高
  const markGap = 0.17 * size; // 划与划的杆向间距
  let y = -half;
  for (let i = 0; i < pennants; i += 1) {
    const top = y;
    g.append(
      svgEl("polygon", {
        points: `0,${top.toFixed(2)} ${feather.toFixed(2)},${(top + pennantH / 2).toFixed(2)} 0,${(top + pennantH).toFixed(2)}`,
        class: "mw-wth-barb-pennant",
      }),
    );
    y += pennantH;
  }
  for (let i = 0; i < longs; i += 1) {
    g.append(
      svgEl("line", {
        x1: "0",
        y1: y.toFixed(2),
        x2: (feather * 0.86).toFixed(2),
        y2: (y + markGap * 0.95).toFixed(2),
        class: "mw-wth-barb-long",
      }),
    );
    y += markGap;
  }
  if (level === "full") {
    for (let i = 0; i < shorts; i += 1) {
      g.append(
        svgEl("line", {
          x1: "0",
          y1: y.toFixed(2),
          x2: (feather * 0.52).toFixed(2),
          y2: (y + markGap * 0.55).toFixed(2),
          class: "mw-wth-barb-short",
        }),
      );
      y += markGap;
    }
  }
  return g;
}

/** 静风符号：圆圈（气象惯例——有观测、无方向；不画杆）；ink 传入时内联着色。 */
export function calmGlyphEl(size: number, ink?: string): SVGCircleElement {
  ensureStyle();
  const circle = svgEl("circle", {
    r: (size * 0.22).toFixed(2),
    class: "mw-wth-barb-calm",
  });
  if (ink !== undefined) circle.style.stroke = ink;
  return circle;
}
