/**
 * IWXXM 演示页主流程（v0.3 alpha）：AWC 实时流 XML（2025-2）→ parseIwxxm → renderCard 中文卡 +
 * addMetarLayer 多站上图 + 同站双形态对照（TAC 卡 vs IWXXM 卡并排，官方等价对静态样例）。
 *
 * 数据三层兜底：① gen:iwxxm 产物（examples/iwxxm-data.json，动态 import——首选 NOAA AWC 实时流
 * （2025-2，fetchSource=awc-live；AWC 侧不可用时降级仓内官方等价对副本，产物 payload 如实记录），
 * 构建期即冻结）＞② 源码内嵌样例（2023-1 官方等价对 ZSPD/EKCH/EETN 三对，产物文件缺失时兜底）＞
 * ③ 报错提示（状态条显式失败，不留空白假象）。
 *
 * 对照区说明：实时流（AWC）的转换有损（趋势/RVR 不转、能见度经英里折算、RMK 入国家扩展），
 * 不适用「两通道应完全一致」的逐字段对照——对照区改用官方等价对（wmo-im 翻译中心，2023-1）
 * 静态样例演示两通道 IR 一致性；实时流的口径差异见 corpus/iwxxm/awc/README.md。
 *
 * 对照区联动（第三期）：IWXXM 侧 IR 携带源 span（XML 元素/属性区间）——卡片 RAW 视图按
 * span 高亮 XML 原文，与 TAC 侧词组高亮同一套 renderCard 联动（悬停卡片字段 ↔ 源文本
 * 高亮双向点亮 + XML 区间滚动揭示），不挑源格式。
 *
 * 原文区双编码切换（第四期）：地图弹窗卡的原文区为 tab 组（IWXXM（XML）↔ TAC（源电码），
 * 源 TAC 自 AWC XML 内嵌注释抽取——altRaws 供给见 iwxxm-alt-raw.ts）；对照区维持两卡并排不动。
 */
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { parse, parseIwxxm, renderCard } from "metweave";
import { addMetarLayer, TIER_COLORS, type ConditionTier } from "@metweave/leaflet";
import { setupBasemap } from "./basemaps";
import { altRawsOfIwxxm } from "./iwxxm-alt-raw";
import { COMPARE_STATIONS, EMBEDDED } from "./iwxxm-samples";
import "./style.css";

/** 档名字符串守卫（DOM 回读值收窄到 ConditionTier，免类型断言） */
const isTier = (x: string): x is ConditionTier =>
  x === "good" || x === "caution" || x === "poor" || x === "unknown";

interface StationRow {
  readonly icao: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly tac: string;
  readonly xml: string;
}

const map = L.map("map", { center: [30, 10], zoom: 2, worldCopyJump: true });
const hasBasemap = setupBasemap(map);

const status = document.getElementById("status");
const statusText = document.getElementById("status-text");
const setStatus = (text: string, tone: "loading" | "ok" | "error"): void => {
  if (status === null || statusText === null) return;
  status.dataset.tone = tone;
  statusText.textContent = text;
  status.hidden = false;
  if (tone === "ok") window.setTimeout(() => (status.hidden = true), 8000);
};

const guideBox = document.getElementById("guide");
if (guideBox !== null) {
  guideBox.textContent =
    "IWXXM 演示（alpha）：把 NOAA AWC 实时流（IWXXM 2025-2）的 XML 电报在浏览器本地解析成与 TAC 完全同一份的中间表示，再渲染成中文卡片；下方对照区用官方等价对（2023-1）逐字段核对两种官方编码的一致性——悬停卡片字段可见原文（TAC 词组 / XML 区间）高亮联动。弹窗卡原文区可在 IWXXM（XML）与 TAC（源电码）间切换（源电码取自 AWC 报文内嵌注释）。";
}

const legendBox = document.getElementById("map-legend");
if (legendBox !== null) {
  for (const item of Array.from(legendBox.querySelectorAll<HTMLElement>(".lg-item"))) {
    const chip = item.querySelector("i");
    const tier = chip?.getAttribute("data-tier") ?? null;
    if (chip instanceof HTMLElement && tier !== null && isTier(tier)) {
      chip.style.background = TIER_COLORS[tier];
    }
  }
}

/** 数据装载（三层兜底：gen 产物＞内嵌样例＞报错）。 */
const loadStations = async (): Promise<readonly StationRow[]> => {
  try {
    const mod = (await import("../iwxxm-data.json")) as { stations?: StationRow[] };
    if (Array.isArray(mod.stations) && mod.stations.length >= 20) return mod.stations;
    throw new Error(`产物站数异常（${mod.stations?.length ?? 0}）`);
  } catch (err) {
    setStatus(
      `gen 产物不可用（${err instanceof Error ? err.message : String(err)}）——已回退源码内嵌样例`,
      "error",
    );
    return EMBEDDED;
  }
};

const main = async (): Promise<void> => {
  setStatus("正在装载 AWC 实时流 IWXXM 数据…", "loading");
  const stations = await loadStations();
  const items = stations
    .map((s) => {
      try {
        const report = parseIwxxm(s.xml);
        // 实况层只上图观测侧（METAR/SPECI）——TAF IWXXM 是预报产品族，本层不消费
        if (report.kind === "taf") return undefined;
        return {
          report,
          position: [s.lat, s.lon] as [number, number],
          title: `${s.icao} ${s.name}`,
        };
      } catch {
        return undefined;
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== undefined);
  if (items.length === 0) {
    setStatus("IWXXM 数据全部解析失败（数据异常）", "error");
    return;
  }
  await addMetarLayer(map, items, {
    // 原文区双编码视图（第四期）：AWC XML 内嵌源 TAC 注释抽出另一编码，弹窗卡原文区 tab 切换
    //（IWXXM（XML）/ TAC（源电码）；对照区维持两卡并排不动——同屏比对是它的价值）
    card: { raw: true, altRaws: altRawsOfIwxxm },
    conditionColors: true,
    popupOptions: { maxWidth: 420 },
  });
  // 双形态对照区：每站一行（左 TAC 卡 / 右 IWXXM 卡）——用官方等价对内嵌样例（2023-1）：
  // 实时流（AWC）的转换有损（趋势/RVR 不转、能见度经英里折算），不适用逐字段一致对照（见文件头）
  const body = document.getElementById("iwxxm-compare-body");
  if (body !== null) {
    for (const sample of EMBEDDED.filter((s) =>
      (COMPARE_STATIONS as readonly string[]).includes(s.icao),
    )) {
      const row = document.createElement("div");
      row.className = "iwxxm-compare-row";
      const tacCard = renderCard(parse(sample.tac), { raw: true });
      // 对照区语料恒为 METAR 官方对（COMPARE_STATIONS 全观测侧）——TAF 即夹具错置，跳过该行
      const xmlSample = parseIwxxm(sample.xml);
      if (xmlSample.kind === "taf") continue;
      const xmlCard = renderCard(xmlSample, { raw: true });
      const tacBox = document.createElement("div");
      tacBox.className = "iwxxm-compare-cell";
      const tacLabel = document.createElement("p");
      tacLabel.className = "iwxxm-compare-label";
      tacLabel.textContent = `${sample.icao} · TAC（字符电码 → parse）`;
      tacBox.append(tacLabel, tacCard);
      const xmlBox = document.createElement("div");
      xmlBox.className = "iwxxm-compare-cell";
      const xmlLabel = document.createElement("p");
      xmlLabel.className = "iwxxm-compare-label";
      xmlLabel.textContent = `${sample.icao} · IWXXM（XML → parseIwxxm）`;
      xmlBox.append(xmlLabel, xmlCard);
      row.append(tacBox, xmlBox);
      body.append(row);
    }
  }
  const skipped = stations.length - items.length;
  setStatus(
    `IWXXM 已上图 ${items.length} 站（AWC 实时流${skipped > 0 ? `，${skipped} 站解析失败跳过` : ""}）——点击圆点看中文卡，下方对照区核对双形态一致性`,
    "ok",
  );
  if (!hasBasemap) {
    const hint = document.getElementById("basemap-hint");
    if (hint !== null) {
      hint.textContent = "未配置底图 key（VITE_TIANDITU_KEY）——圆点与卡片仍可正常交互。";
      hint.hidden = false;
    }
  }
};

main().catch((err: unknown) => {
  setStatus(`IWXXM 演示装载失败：${err instanceof Error ? err.message : String(err)}`, "error");
});

// 报文原文区收起/展开：点卡片「报文原文」标题条切换（事件委托，地图弹窗卡与对照卡同享；
// 组件层不掺交互——renderCard 产静态 DOM，宿主管视图切换）。原文区的下一节随形态二择：
// 单视图 .mw-raw（对照卡/抽不出 altRaws 的弹窗卡）或 tab 组包裹 .mw-raw-group（双编码卡）——
// 收起的都是整个原文区（tab 切的是区内编码视图，两层操作正交）
document.addEventListener("click", (e: MouseEvent) => {
  const title = e.target instanceof Element ? e.target.closest(".mw-raw-title") : null;
  if (!(title instanceof HTMLElement)) return;
  const body = title.nextElementSibling;
  if (
    !(body instanceof HTMLElement) ||
    !(body.classList.contains("mw-raw") || body.classList.contains("mw-raw-group"))
  )
    return;
  const collapsed = body.toggleAttribute("hidden");
  title.setAttribute("aria-expanded", collapsed ? "false" : "true");
});
