/**
 * 「风的垂直与时间」演示页（v0.6 批次可看面）：把本批五个组件串在一页上——
 *
 * - `windProfileOf`（@metweave/grid）＋ `windProfileChart`（W-10）：合成多层场 →
 *   采样点廓线（10 层标准等压面、对数气压轴；500 hPa 缺测层演示断线形态）；
 * - `hodograph`（W-11）：同一廓线 → u/v 端点连线（切变矢量），0–3 km 低空段高亮；
 * - `windTimeHeightOf`（@metweave/grid）＋ `windTimeHeight`（W-12）：多层×多时刻
 *   二维剖面（风速当色＝10m 风档案同一份色卡，风向当标记，300 hPa 末时效缺测格）；
 * - `windObservationSeries` ＋ `gustBand`（W-13）：IEM 形态逐时行 → 折线＋包络带＋
 *   阵风事件标记（缺测时次断线、speed 缺而 gust 在的孤点）；
 * - `windDirStrip`（W-14）：同一序列 → 风向色环条（跨北接缝 350↔10 相邻不断裂）。
 *
 * 数据全部页内自备（vertical-data.ts），不加载地图、不拉外网——这是**看懂形态**的页。
 */
import {
  gustBand,
  hodograph,
  windDirStrip,
  windObservationSeries,
  windProfileChart,
  windTimeHeight,
} from "metweave";
import { WIND_BARB_SCALES, windProfile, windProfileOf, windTimeHeightOf } from "@metweave/grid";
import {
  ANALYSIS_FIELDS,
  HODO_HIGHLIGHT,
  HOURLY_ROWS,
  SYNTHETIC_FIELDS,
  VERTICAL_POINT,
  withDemoHeights,
} from "./vertical-data";
import "./style.css";

/** 10m 风档案 thresholds 的显式收窄（可选字段；缺席＝档案与页面不同步，不静默兜底）。 */
const windThresholds = (): readonly number[] => {
  const breaks = windProfile.thresholds;
  if (breaks === undefined) {
    throw new Error("10m 风档案缺 thresholds——演示页色卡接线失败（档案与页面不同步）");
  }
  return breaks;
};

/** 装配节点工厂（页骨架在 vertical.html；此处只挂内容）。 */
const slotOf = (id: string): HTMLElement | null => document.getElementById(id);

/** ① W-10 风廓线：合成多层场 → 采样点 → 廓线图（气压对数轴）。 */
const mountProfile = (): void => {
  const slot = slotOf("vp-profile");
  if (slot === null) return;
  const levels = windProfileOf(ANALYSIS_FIELDS, VERTICAL_POINT.lat, VERTICAL_POINT.lon);
  const title = `采样点 ${VERTICAL_POINT.lat}°N ${VERTICAL_POINT.lon}°E · 起报 f000`;
  const paint = (barb: boolean): void => {
    slot.replaceChildren(
      windProfileChart(levels, {
        title,
        // 风羽模式（Windy 风廓线面板形态）：着色色卡＝10m 风档案同一份、刻度＝
        // WIND_BARB_SCALES（两处数字均单源在 grid）；折线模式缺省零装饰
        ...(barb
          ? {
              glyph: "barb" as const,
              scale: { breaks: windThresholds(), colors: windProfile.colorStops },
              barbScale: WIND_BARB_SCALES,
            }
          : {}),
      }),
    );
  };
  paint(false);
  const toggle = document.getElementById("vp-pf-glyph");
  if (toggle instanceof HTMLInputElement) {
    toggle.addEventListener("change", () => {
      paint(toggle.checked);
    });
  }
};

/** ② W-11 高空风图：同一廓线（补示意高度）→ 端点连线与低空段高亮。 */
const mountHodograph = (): void => {
  const slot = slotOf("vp-hodograph");
  if (slot === null) return;
  const levels = windProfileOf(ANALYSIS_FIELDS, VERTICAL_POINT.lat, VERTICAL_POINT.lon);
  slot.replaceChildren(
    hodograph(withDemoHeights(levels), {
      title: "端点＝各层风矢量（u/v 平面），连线＝层间切变",
      highlight: HODO_HIGHLIGHT,
    }),
  );
};

/** ③ W-12 时间-高度剖面：多层×多时刻二维序列（色卡与 10m 风档案同一份；标记箭头/风羽可切）。 */
const mountTimeHeight = (): void => {
  const slot = slotOf("vp-timeheight");
  if (slot === null) return;
  const breaks = windProfile.thresholds;
  if (breaks === undefined) {
    throw new Error("10m 风档案缺 thresholds——演示页色卡接线失败（档案与页面不同步）");
  }
  // timeLabel:"short"（「日T时Z」）——列标签走 grid 侧短标签形态，组件估宽抽稀可示更多枚
  const series2d = windTimeHeightOf(SYNTHETIC_FIELDS, VERTICAL_POINT.lat, VERTICAL_POINT.lon, {
    timeLabel: "short",
  });
  const paint = (barb: boolean): void => {
    slot.replaceChildren(
      windTimeHeight(series2d, {
        scale: { breaks, colors: windProfile.colorStops },
        title: `多层×24h（每 3h × 8 时效）· 风速当色 · 风向当${barb ? "风羽" : "箭头"}`,
        // 风羽刻度直传 grid 的 WIND_BARB_SCALES（数字单源；组件按 unit 声明选档）；
        // 格尺寸与色斑形态两模式一致（W-12 保持热图形态——纯风羽剖面形态见 ① 风羽模式）
        ...(barb ? { windGlyph: "barb" as const, barbScale: WIND_BARB_SCALES } : {}),
      }),
    );
  };
  paint(false);
  const toggle = document.getElementById("vp-th-barb");
  if (toggle instanceof HTMLInputElement) {
    toggle.addEventListener("change", () => {
      paint(toggle.checked);
    });
  }
};

/** ④⑤ W-13/W-14：IEM 形态逐时行 → 归一序列 → 阵风带与风向条。 */
const mountHourly = (): void => {
  const series = windObservationSeries(HOURLY_ROWS);
  const gustSlot = slotOf("vp-gustband");
  if (gustSlot !== null) {
    gustSlot.replaceChildren(
      gustBand(series, { title: "24 时次观测：平均风速折线＋阵风事件标记" }),
    );
  }
  const dirSlot = slotOf("vp-dirstrip");
  if (dirSlot !== null) {
    dirSlot.replaceChildren(windDirStrip(series, { title: "风向色环条（跨北接缝相邻不断裂）" }));
  }
};

mountProfile();
mountHodograph();
mountTimeHeight();
mountHourly();
