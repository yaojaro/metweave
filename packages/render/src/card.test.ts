// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { MetarReport, WarningCode } from "@metweave/core";
import { parse } from "@metweave/parser";
import type { RenderCardOptions } from "./card";
import { DECODE_CITES, DECODE_CITE_KEYS, renderCard } from "./card";

const visRowOf = (card: ReturnType<typeof renderCard>): string =>
  [...card.querySelectorAll("dd")]
    .map((d) => d.textContent ?? "")
    .find((t) => /m|km/.test(t) && !t.includes("°"))
    ?.trim() ?? "";

const RAW = "METAR ZBAA 110700Z VRB02MPS CAVOK 25/10 Q1019 NOSIG";
const DIRTY = "KCLT 091955Z AUTO /////KT 10SM CLR 32/16 A3020 RMK T03200160 MADISHF";
const CLOUD_MISSING = "METAR RJTT 080800Z 18012KT 9999 FEW010 BKN025 BKN/// 28/27 Q1005 NOSIG";

/** 天气组悬停术语取值：主表已是纯译文，按悬停 title 中的原码定位该组的 title */
const glossOf = (raw: string, code: string): string => {
  const card = renderCard(parse(raw));
  const span = [...card.querySelectorAll("dd span")].find((s) =>
    s.getAttribute("aria-label")?.includes(code),
  );
  return span?.getAttribute("aria-label") ?? "";
};

/** 点击卡片上一个带提示的元素，断言气泡弹出并返回气泡全文（转换说明 + 依据行的断言基底） */
const clickHintText = (
  card: ReturnType<typeof renderCard>,
  target: HTMLElement | undefined | null,
): string => {
  expect(target).toBeDefined();
  target!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  const bubble = card.querySelector(".mw-hint-pop")!;
  expect(bubble.classList.contains("mw-hint-on")).toBe(true);
  return bubble.textContent ?? "";
};

/** 在 RAW 视图中按悬停 title 前缀定位组 span */
const rawSpanByTitle = (
  card: ReturnType<typeof renderCard>,
  prefix: string,
): HTMLElement | undefined =>
  [...card.querySelectorAll<HTMLElement>(".mw-raw span.mw-hint")].find((s) =>
    s.getAttribute("aria-label")?.startsWith(prefix),
  );

describe("术语修订五条（已按专业评测修订）", () => {
  it("TCU 悬停「浓积云」（原「耸积云」废止）；CB 悬停「积雨云」（原「雷暴云」废止）", () => {
    const card = renderCard(
      parse("METAR ZGGG 120000Z 27008KT 9999 FEW020CB FEW030TCU 26/22 Q1009"),
    );
    const titles = [...card.querySelectorAll("dd span")].map(
      (s) => s.getAttribute("aria-label") ?? "",
    );
    expect(titles.some((t) => t.includes("浓积云"))).toBe(true);
    expect(titles.some((t) => t.includes("积雨云"))).toBe(true);
    expect(titles.some((t) => t.includes("耸积云"))).toBe(false);
    expect(titles.some((t) => t.includes("雷暴云"))).toBe(false);
  });

  it("强度+雨/雪：「小雨/大雨/小雪/大雪」（-RA/+RA/-SN/+SN 直出四词）", () => {
    expect(glossOf("ZGGG 120000Z 27008KT 9999 -RA 26/22 Q1009", "-RA")).toContain("小雨");
    expect(glossOf("ZGGG 120000Z 27008KT 9999 +RA 26/22 Q1009", "+RA")).toContain("大雨");
    expect(glossOf("ZGGG 120000Z 27008KT 9999 -SN 26/22 Q1009", "-SN")).toContain("小雪");
    expect(glossOf("ZGGG 120000Z 27008KT 9999 +SN 26/22 Q1009", "+SN")).toContain("大雪");
    // TS 族强度词不连坐：+TSRA 仍是「强雷暴伴雨」
    expect(glossOf("ZGGG 120000Z 27008KT 9999 +TSRA 26/22 Q1009", "+TSRA")).toContain("强雷暴伴雨");
  });

  it("SHRA 族 →「阵雨」（-SHRA 小阵雨；SHSN 阵雪——「阵性雨」废止）", () => {
    expect(glossOf("ZGGG 120000Z 27008KT 9999 -SHRA 26/22 Q1009", "-SHRA")).toContain("阵雨");
    expect(glossOf("ZGGG 120000Z 27008KT 9999 SHSN 26/22 Q1009", "SHSN")).toContain("阵雪");
    const shra = glossOf("ZGGG 120000Z 27008KT 9999 SHRA 26/22 Q1009", "SHRA");
    expect(shra).toContain("阵雨");
    expect(shra).not.toContain("阵性");
  });

  it("VCSH 悬停补全：「机场附近有阵性降水（类型不可辨）」", () => {
    expect(glossOf("ZGGG 120000Z 27008KT 9999 VCSH 26/22 Q1009", "VCSH")).toContain(
      "机场附近有阵性降水（类型不可辨）",
    );
  });

  it("CAVOK 悬停补：「且任意高度无积雨云/浓积云」", () => {
    const card = renderCard(parse(RAW));
    const cavok = [...card.querySelectorAll(".mw-badge")].find((b) =>
      b.textContent?.startsWith("CAVOK"),
    );
    expect(cavok?.getAttribute("aria-label")).toContain("任意高度无积雨云/浓积云");
  });

  it("en 同步：TCU towering cumulus 不回归、VCSH 含 type indistinguishable、CAVOK 补 no CB/TCU", () => {
    const card = renderCard(parse("ZGGG 120000Z 27008KT 9999 VCSH FEW030TCU 26/22 Q1009"), {
      locale: "en",
    });
    const titles = [...card.querySelectorAll("dd span")].map(
      (n) => n.getAttribute("aria-label") ?? "",
    );
    expect(titles.some((t) => t.includes("towering cumulus"))).toBe(true);
    expect(titles.some((t) => t.includes("type indistinguishable"))).toBe(true);
    const cavokCard = renderCard(parse(RAW), { locale: "en" });
    const cavok = [...cavokCard.querySelectorAll(".mw-badge")].find((b) =>
      b.textContent?.startsWith("CAVOK"),
    );
    expect(cavok?.getAttribute("aria-label")).toContain("no CB/TCU at any height");
    expect(cavokCard.outerHTML).not.toMatch(HAN);
    expect(card.outerHTML).not.toMatch(HAN);
  });
});

describe("renderCard", () => {
  it("干净报文：站名、CAVOK 徽章、要素行齐备且无告警列表", () => {
    const card = renderCard(parse(RAW), { raw: true });
    expect(card.classList.contains("mw-card")).toBe(true);
    expect(card.querySelector("h2")?.textContent).toContain("ZBAA");
    expect(card.querySelector(".mw-badge")?.textContent).toBe("例行报告");
    expect(card.textContent).toContain("CAVOK");
    expect(card.textContent).toContain("风向不定");
    expect(card.querySelector(".mw-warnings")).toBeNull();
    const rawBox = card.querySelector(".mw-raw");
    expect(rawBox?.textContent).toBe(RAW);
  });

  it("脏报文：AUTO 徽章、告警列表可见、RAW 对照高亮缺测风组", () => {
    const card = renderCard(parse(DIRTY), { raw: true });
    expect(card.textContent).toContain("自动观测");
    const warnings = card.querySelector(".mw-warnings");
    expect(warnings?.textContent).toContain("风组缺测");
    const highlighted = card.querySelectorAll(".mw-raw .mw-bad");
    expect(highlighted.length).toBeGreaterThan(0);
  });

  it("RAW 对照：云组缺测高亮 + 悬停解释（同 start 告警优先于组级 span）", () => {
    const card = renderCard(parse(CLOUD_MISSING), { raw: true });
    const bads = [...card.querySelectorAll(".mw-raw .mw-bad")];
    expect(bads.length).toBeGreaterThan(0);
    const bkn = bads.find((b) => b.textContent === "BKN///");
    expect(bkn).toBeDefined();
    expect(bkn?.getAttribute("aria-label")).toContain("云高缺测");
    // 悬停不再是裸组名「云」，而是缺测解释
    expect(bkn?.getAttribute("aria-label")).not.toBe("云");
  });

  it("SPECI + 更正报徽章（业务惯用语）：SPECI 不再双挂「例行报告」", () => {
    const card = renderCard(
      parse("SPECI OMDB 080801Z COR 28010KT CAVOK 42/17 Q1006", { kind: "speci" }),
    );
    const badges = [...card.querySelectorAll(".mw-badge")].map((b) => b.textContent);
    expect(badges).toContain("特殊天气报告");
    expect(badges).toContain("更正报");
    // 复评命中：SPECI 卡片曾无条件双挂「例行报告」+「特殊报告」（现文案为「特殊天气报告」）
    expect(badges).not.toContain("例行报告");
  });

  it("两态字段缺省时对应行不渲染（不出现「未编报」噪音）", () => {
    const card = renderCard(parse(RAW));
    expect(card.textContent).not.toContain("跑道视程");
    // 按 dd 行粒度断言「无天气行」——不能整卡 not.toContain("天气")：
    // CAVOK 徽章短译（能见度佳、低云与天气无碍）合法地含有这两个字
    const rows = [...card.querySelectorAll("dd")].map((d) => d.textContent ?? "");
    expect(rows.some((t) => t.includes("天气"))).toBe(false);
  });
});

describe("渲染 D 批：风组缺测行 / 术语微调 / 字段值人话悬停", () => {
  it("风向越界判缺测（73004MPS）：风行照常渲染——「风向缺测 | 4 mps」形态，风速不再连坐丢失", () => {
    const card = renderCard(parse("ZGGG 120000Z 73004MPS 9999 26/22 Q1009"), { raw: true });
    const text = card.textContent ?? "";
    expect(text).toContain("风向缺测");
    expect(text).toContain("4 mps");
  });

  it("CAVOK 徽章：原码在前 + 直白短译随行（≠晴空防歧义口径不变），完整语义放悬停", () => {
    const card = renderCard(parse(RAW));
    const badges = [...card.querySelectorAll(".mw-badge")].map((b) => b.textContent);
    expect(badges.some((t) => t?.startsWith("CAVOK"))).toBe(true);
    expect(card.textContent).not.toContain("晴空");
    const cavokBadge = [...card.querySelectorAll(".mw-badge")].find((b) =>
      b.textContent?.startsWith("CAVOK"),
    );
    expect(cavokBadge?.querySelector(".mw-badge-sub")?.textContent).toBe(
      "能见度佳、低云与天气无碍",
    );
    expect(cavokBadge?.getAttribute("aria-label")).toContain("5000ft 以下无云");
  });

  it("站名行：stationTitle 传入时渲染 muted 行，缺省不渲染（IR 无此信息不捏造）", () => {
    const card = renderCard(parse(RAW), { stationTitle: "Tianjin/Binhai Intl, TJ, CN" });
    const stationLine = card.querySelector(".mw-station");
    expect(stationLine?.textContent).toBe("Tianjin/Binhai Intl, TJ, CN");
    const bare = renderCard(parse(RAW));
    expect(bare.querySelector(".mw-station")).toBeNull();
  });

  it("en 卡片：CAVOK 短译随语言切换，整卡零中文字符不破", () => {
    const card = renderCard(parse(RAW), { locale: "en" });
    const cavokSub = card.querySelector(".mw-badge .mw-badge-sub")?.textContent;
    expect(cavokSub).toBe("good visibility; no low cloud or significant weather");
    expect(card.textContent).not.toMatch(/[\u4e00-\u9fa5]/);
  });

  it("云量人话悬停：SCT 层 title 含档位说明与米制换算（SCT033 → 疏云 + 约 1006 米），并声明米值为换算约值", () => {
    const card = renderCard(parse("METAR ZGGG 120000Z 27008KT 9999 SCT033 26/22 Q1009"));
    const piece = [...card.querySelectorAll("dd span")].find((s) =>
      s.getAttribute("aria-label")?.includes("SCT033"),
    );
    expect(piece).toBeDefined();
    expect(piece?.getAttribute("aria-label")?.length ?? 0).toBeGreaterThan(0);
    expect(piece?.getAttribute("aria-label")).toContain("疏云");
    // 3300 ft × 0.3048 = 1005.84 → 精确换算取整 1006（不再圆整到 50 米档位）
    expect(piece?.getAttribute("aria-label")).toContain("3300 英尺 ≈ 1006 米");
    // 米是本库换算所得（报文只编英尺）——悬停必须把这一点说出来
    expect(piece?.getAttribute("aria-label")).toContain("报文只编英尺");
  });

  it("云量四档悬停各有文案（FEW/SCT/BKN/OVC），对流云与缺测位不悬停崩溃", () => {
    const raw = "METAR ZGGG 120000Z 27008KT 9999 FEW030 SCT050 BKN080 OVC150 FEW020CB 26/22 Q1009";
    const card = renderCard(parse(raw));
    const titles = [...card.querySelectorAll("dd span")].map(
      (s) => s.getAttribute("aria-label") ?? "",
    );
    const cloudTitles = titles.filter((t) => t.includes("个量"));
    expect(cloudTitles.length).toBe(5);
    expect(cloudTitles.some((t) => t.includes("少云"))).toBe(true);
    expect(cloudTitles.some((t) => t.includes("疏云"))).toBe(true);
    expect(cloudTitles.some((t) => t.includes("多云"))).toBe(true);
    expect(cloudTitles.some((t) => t.includes("阴"))).toBe(true);
    expect(cloudTitles.some((t) => t.includes("雷暴"))).toBe(true);
    // 缺测位（BKN///）无档位可释但不抛错：主表给「云量缺测」，原码在悬停 title
    const withMissing = renderCard(parse(CLOUD_MISSING));
    const missingSpan = [...withMissing.querySelectorAll("dd span")].some((s) =>
      s.getAttribute("aria-label")?.includes("BKN///"),
    );
    expect(missingSpan).toBe(true);
  });

  it("风速单位人话悬停：风行 title 含单位说明（mps = 米/秒）", () => {
    const card = renderCard(parse(RAW)); // VRB02MPS
    const dd = [...card.querySelectorAll("dd")].find((d) => d.textContent?.includes("mps"));
    expect(dd?.querySelector("span[aria-label]")?.getAttribute("aria-label")).toContain("米/秒");
  });
});

describe("渲染 B 批（第二轮复评）：静风 / SM 阈值 / RVR 保真 / 天气现象对照", () => {
  it("静风（00000KT）显示「静风」而非「0° 0 kt」", () => {
    const card = renderCard(parse("ZBAA 120000Z 00000KT 9999 NSC 05/04 Q1024"));
    const text = card.textContent ?? "";
    expect(text).toContain("静风");
    expect(text).not.toContain("0°");
    expect(text).not.toContain("0 kt");
  });

  it("SM 阈值语义由 beyond 驱动：M1/4SM → <0.25 SM、P6SM → >6 SM、9999 → ≥10 km", () => {
    const below = renderCard(parse("PANC 151253Z VRB03KT M1/4SM FG VV002 07/07 A2964"));
    expect(below.textContent).toContain("<0.25 SM");
    const above = renderCard(parse("KXYZ 151253Z VRB03KT P6SM SKC 07/07 A2964"));
    expect(above.textContent).toContain(">6 SM");
    const ceil = renderCard(parse("ZGGG 120000Z 00000KT 9999 26/22 Q1009"));
    expect(ceil.textContent).toContain("≥10 km");
  });

  it("RVR 行纯译文：P/M 超界与 U/D/N 趋势人话化（原码只在悬停与 RAW）", () => {
    const card = renderCard(
      parse("CYOW 041700Z 28015KT 1 1/2SM -SN R07/P6000FT/U VV002 M08/M12 A3006 RMK VIS 1/4V1/2"),
    );
    const rvrRow = [...card.querySelectorAll("dd")].find((d) => d.textContent?.includes("跑道 07"));
    expect(rvrRow?.textContent).toContain("高于 6000 英尺");
    expect(rvrRow?.textContent).toContain("趋势上升");
    const mForm = renderCard(parse("ZGGG 120000Z 00000KT 0800 R36/M0050D 26/22 Q1009"));
    const mRow = [...mForm.querySelectorAll("dd")].find((d) => d.textContent?.includes("跑道 36"));
    expect(mRow?.textContent).toContain("低于 50 米");
    expect(mRow?.textContent).toContain("趋势下降");
  });

  it("天气现象行纯译文 + 悬停原码全称（强雷暴伴雨 / 火山灰 / 冰雹）", () => {
    const card = renderCard(parse("ZGGG 120000Z 27008KT 9999 +TSRA VA GR 26/22 Q1009"));
    const weatherRow = [...card.querySelectorAll("dd")].find((d) =>
      d.textContent?.includes("雷暴"),
    );
    expect(weatherRow).toBeDefined();
    expect(weatherRow?.textContent).toContain("火山灰");
    expect(weatherRow?.textContent).toContain("冰雹");
    expect(weatherRow?.textContent).not.toContain("+TSRA");
    const pieces = [...(weatherRow?.querySelectorAll("span") ?? [])];
    const titleOf = (code: string): string =>
      pieces
        .find((p) => p.getAttribute("aria-label")?.includes(code))
        ?.getAttribute("aria-label") ?? "";
    expect(titleOf("+TSRA")).toContain("强雷暴伴雨");
    expect(titleOf("VA")).toContain("火山灰");
    expect(titleOf("GR")).toContain("冰雹");
    // 飞行威胁标注（VA/GR/TS 优先）
    expect(titleOf("VA")).toContain("飞行威胁");
    expect(titleOf("GR")).toContain("飞行威胁");
  });

  it("CB 悬停威胁表述：雷暴、冰雹、强颠簸风险", () => {
    const card = renderCard(parse("METAR ZGGG 120000Z 27008KT 9999 FEW020CB 26/22 Q1009"));
    const cbPiece = [...card.querySelectorAll("dd span")].find((p) =>
      p.textContent?.includes("CB"),
    );
    expect(cbPiece?.getAttribute("aria-label")).toContain("雷暴、冰雹、强颠簸风险");
  });
});

// ---------------------------------------------------------------- locale en 完整兑现

/** 硬断言：en 卡片全 DOM（文本 + 悬停 title，经 outerHTML 覆盖）零中文字符——防再次半兑现 */
const HAN = /[\u4e00-\u9fff]/;

describe("locale:'en' 完整兑现（半兑现比没有更糟——行标签/悬停/日期/告警/缺测全英文）", () => {
  /** 要素行齐备 + 风向越界缺测 + 未知组告警：覆盖行标签/日期/告警/缺测文案四类英文面 */
  const EN_FULL = "ZGGG 120000Z 73004MPS 9999 -TSRA FEW020CB 26/22 Q1009 BOGUSTOK";

  it("en 渲染：行标签/日期/缺测文案/告警列表全英文，且全 DOM 零中文字符", () => {
    const card = renderCard(parse(EN_FULL), { locale: "en", raw: true });
    const text = card.textContent ?? "";
    // 关键行标签（风/能见度/天气/云/气温/露点/QNH）
    for (const label of [
      "Wind",
      "Visibility",
      "Weather",
      "Clouds",
      "Temperature",
      "Dewpoint",
      "QNH",
    ]) {
      expect(text, `缺行标签 ${label}`).toContain(label);
    }
    // 日期格式：「12日 00:00 UTC」→ "Day 12, 00:00 UTC"
    expect(text).toContain("Day 12, 00:00 UTC");
    // 缺测文案（风向越界判缺测）与能见度上限编码
    expect(text).toContain("Wind direction missing 4 mps");
    expect(text).toContain("≥10 km");
    // 告警列表英文（WarningCode 映射：value-out-of-range / unknown-token）
    const warnings = card.querySelector(".mw-warnings");
    expect(warnings?.textContent).toContain("outside the plausible range");
    expect(warnings?.textContent).toContain("Unrecognized group");
    // 硬断言：整卡（含全部 title 悬停）零中文字符
    expect(card.outerHTML).not.toMatch(HAN);
  });

  it("en 徽章与 RAW 对照：METAR/AUTO 徽章、告警悬停全英文（KCLT 脏报文）", () => {
    const card = renderCard(parse(DIRTY), { locale: "en", raw: true });
    const badges = [...card.querySelectorAll(".mw-badge")].map((b) => b.textContent);
    expect(badges).toContain("METAR");
    expect(badges).toContain("AUTO");
    expect(card.querySelector(".mw-warnings")?.textContent).toContain("Missing-value code");
    // RAW 对照视图的告警悬停也走英文映射
    const badTitle = card.querySelector(".mw-raw .mw-bad")?.getAttribute("aria-label") ?? "";
    expect(badTitle).not.toMatch(HAN);
    expect(card.outerHTML).not.toMatch(HAN);
  });

  it("en 悬停术语表：云量八分量/云底折米/风速单位/天气现象全英文", () => {
    const card = renderCard(parse("METAR ZGGG 120000Z VRB08KT 9999 SCT033 +TSRA 26/22 Q1009"), {
      locale: "en",
    });
    const titles = [...card.querySelectorAll("dd, dd span")]
      .map((n) => n.getAttribute("aria-label") ?? "")
      .join("\n");
    expect(titles).toContain("Scattered: 3–4 oktas");
    expect(titles).toContain("base 3300 ft ≈ 1006 m");
    expect(titles).toContain("knots (nautical miles per hour)");
    expect(titles).toContain("variable direction (all sectors)");
    expect(titles).toContain("Heavy thunderstorm with rain");
    expect(titles).toContain("major flight hazard");
    expect(card.outerHTML).not.toMatch(HAN);
  });

  it("en 静风显示 Calm；CAVOK 悬停英文", () => {
    const card = renderCard(parse("METAR ZBAA 110700Z 00000KT CAVOK 25/1 Q1019 NOSIG"), {
      locale: "en",
    });
    expect(card.textContent).toContain("Calm");
    expect(card.textContent).not.toContain("0 kt");
    const cavok = [...card.querySelectorAll(".mw-badge")].find((b) =>
      b.textContent?.startsWith("CAVOK"),
    );
    expect(cavok?.getAttribute("aria-label")).toContain("no cloud below 5000 ft");
    expect(card.outerHTML).not.toMatch(HAN);
  });

  it("zh 缺省不受 en 影响（回归锁：默认 locale 仍中文）", () => {
    const card = renderCard(parse(RAW));
    expect(card.textContent).toContain("风");
    expect(card.textContent).toContain("风向不定");
    expect(card.querySelector(".mw-badge")?.textContent).toBe("例行报告");
  });
});

// ---------------------------------------------------------------- 跑道状态卡片渲染

/** UUDD 冬季实弹（夹具 target-rwystate-uudd 同源）：R13R/550237 = 湿雪/覆盖 26–50%/深度 2mm/摩擦 0.37 */
const UUDD_WINTER = "UUDD 150000Z 25001G07MPS 5000 -SN OVC015 M09/M11 Q1022 R13R/550237 NOSIG";

describe("跑道状态卡片渲染（解析了不让 UI 蒸发——签派员最大单点缺陷）", () => {
  it("UUDD 冬季实弹：跑道状态行在位——湿雪/覆盖 26–50%/深度 2 mm/摩擦系数 0.37，悬停带 WMO 语义", () => {
    const card = renderCard(parse(UUDD_WINTER), { raw: true });
    const labels = [...card.querySelectorAll("dt")].map((d) => d.textContent);
    expect(labels).toContain("跑道状态");
    const row = [...card.querySelectorAll("dd")].find((d) => d.textContent?.startsWith("R13R"));
    expect(row?.textContent).toContain("湿雪");
    expect(row?.textContent).toContain("26–50%");
    expect(row?.textContent).toContain("深度 2 mm");
    expect(row?.textContent).toContain("摩擦系数 0.37");
    const piece = row?.querySelector("span");
    expect(piece?.getAttribute("aria-label")).toContain("R13R/550237");
    expect(piece?.getAttribute("aria-label")).toContain("WMO 306 FM15 §15.13.6");
    expect(piece?.getAttribute("aria-label")).toContain("已按官方电码表核对");
    // RAW 对照视图跑道状态组也有高亮与悬停
    const rawPiece = [...card.querySelectorAll(".mw-raw span")].find((s) =>
      s.textContent?.startsWith("R13R/"),
    );
    expect(rawPiece?.getAttribute("aria-label")).toContain("跑道状态");
    expect(rawPiece?.getAttribute("aria-label")).toContain("R13R"); // 逐要素解码：不再只有行标签
  });

  it("深度 92–98 段折厘米显示 + 制动作用五档（R01/529295 → 深度 10 cm、制动作用 好）", () => {
    const card = renderCard(
      parse("METAR UUDD 120000Z 36001MPS 9999 SCT030 M02/M05 Q1019 R01/529295"),
    );
    const row = [...card.querySelectorAll("dd")].find((d) => d.textContent?.startsWith("R01"));
    expect(row?.textContent).toContain("湿雪");
    expect(row?.textContent).toContain("11–25%");
    expect(row?.textContent).toContain("深度 10 cm");
    expect(row?.textContent).toContain("制动作用 好");
  });

  it("深度位 99（R31L///99//）→ 醒目「跑道关闭」（mw-rwy-closed 样式类）；SNOCLO 全机场形态", () => {
    const card = renderCard(
      parse("UUDD 191500Z 29005MPS 9999 -SN FEW011 M07/M09 Q1029 R31L///99// NOSIG"),
    );
    const row = [...card.querySelectorAll("dd")].find((d) => d.textContent?.includes("R31L"));
    expect(row?.textContent).toContain("R31L 跑道关闭");
    const closedPiece = row?.querySelector("span");
    expect(closedPiece?.classList.contains("mw-rwy-closed")).toBe(true);
    expect(closedPiece?.getAttribute("aria-label")).toContain("不可用");
    const allClosed = renderCard(
      parse("METAR UUDD 150000Z 36001MPS 9999 SCT030 M02/M05 Q1019 R/SNOCLO"),
    );
    expect(allClosed.textContent).toContain("全机场跑道关闭");
  });

  it("CLRD 清除家族（corpus 实弹 R31L/CLRD65）：已清除 + 摩擦系数 0.65", () => {
    const card = renderCard(
      parse("UUDD 120930Z 29007MPS 9999 FEW037 16/08 Q1017 R31L/CLRD65 NOSIG"),
    );
    const row = [...card.querySelectorAll("dd")].find((d) => d.textContent?.startsWith("R31L"));
    expect(row?.textContent).toContain("已清除");
    expect(row?.textContent).toContain("摩擦系数 0.65");
    const piece = row?.querySelector("span");
    expect(piece?.getAttribute("aria-label")).toContain("CLRD");
  });

  it("无跑道状态组时不渲染该行（不出现空行噪音）", () => {
    const card = renderCard(parse(RAW));
    expect([...card.querySelectorAll("dt")].map((d) => d.textContent)).not.toContain("跑道状态");
  });

  it("locale en 跑道状态行：Runway state / wet snow / coverage 26–50% / depth 2 mm / friction 0.37，零中文", () => {
    const card = renderCard(parse(UUDD_WINTER), { locale: "en" });
    expect([...card.querySelectorAll("dt")].map((d) => d.textContent)).toContain("Runway state");
    const row = [...card.querySelectorAll("dd")].find((d) => d.textContent?.startsWith("R13R"));
    expect(row?.textContent).toContain("wet snow");
    expect(row?.textContent).toContain("coverage 26–50%");
    expect(row?.textContent).toContain("depth 2 mm");
    expect(row?.textContent).toContain("friction 0.37");
    const piece = row?.querySelector("span");
    expect(piece?.getAttribute("aria-label")).toContain("reviewed against the official WMO tables");
    expect(card.outerHTML).not.toMatch(HAN);
  });
});

// ---------------------------------------------------------------- C 批：可访问性 / 龄期 / 危险着色 / 行序

const THUNDERSTORM = "ZGGG 120000Z 00000KT 0800 R36/M0050D +TSRA BKN030CB 26/22 Q1009";

describe("C1：悬停解释可达契约（批2#6 后：零原生 title、aria-label 承载读屏）", () => {
  it("整卡零原生 title（双气泡收口——title 悬停与电码浮签不再同屏叠出）；aria-label 承载读屏通道", () => {
    const card = renderCard(parse(THUNDERSTORM), { raw: true });
    expect(card.querySelectorAll("[title]").length).toBe(0); // 原生 title 全量退役（突变回流即红）
    const labeled = [...card.querySelectorAll("[aria-label]")];
    expect(labeled.length).toBeGreaterThan(3); // 风行/天气/云/RAW 高亮均有读屏挂载点
  });

  it("en 卡片同规则成立（零原生 title，零中文）", () => {
    const card = renderCard(parse(THUNDERSTORM), { locale: "en", raw: true });
    expect(card.querySelectorAll("[title]").length).toBe(0);
    expect(card.outerHTML).not.toMatch(HAN);
  });
});

describe("C2：数据龄期（固定 now 的确定性三态）", () => {
  const METAR_TIME = "METAR ZBAA 110700Z VRB02MPS CAVOK 25/10 Q1019 NOSIG";

  it("新鲜：观测后 10 分钟——「（10 分钟前）」，无 mw-stale", () => {
    const card = renderCard(parse(METAR_TIME), { now: new Date("2026-09-11T07:10:00Z") });
    const time = card.querySelector(".mw-time");
    expect(time?.textContent).toContain("（10 分钟前）");
    expect(time?.classList.contains("mw-stale")).toBe(false);
  });

  it("陈旧：观测后 90 分钟——换档「（1 小时前）」（取整）+ mw-stale 橙色标记保留", () => {
    const card = renderCard(parse(METAR_TIME), { now: new Date("2026-09-11T08:30:00Z") });
    const time = card.querySelector(".mw-time");
    expect(time?.textContent).toContain("（1 小时前）");
    expect(time?.textContent).not.toContain("90 分钟前");
    expect(time?.classList.contains("mw-stale")).toBe(true);
  });

  it("跨日回绕：昨日 23:50 观测、now 为次日 00:10——按环绕取 20 分钟前（非 24 小时前）", () => {
    const card = renderCard(parse("ZBAA 102350Z VRB02MPS CAVOK 25/10 Q1019 NOSIG"), {
      now: new Date("2026-09-11T00:10:00Z"),
    });
    expect(card.querySelector(".mw-time")?.textContent).toContain("（20 分钟前）");
  });

  it("en：' (10 min ago)'；不注入 now 时缺省走当前时钟不炸", () => {
    const card = renderCard(parse(METAR_TIME), {
      locale: "en",
      now: new Date("2026-09-11T07:10:00Z"),
    });
    expect(card.querySelector(".mw-time")?.textContent).toContain("(10 min ago)");
    expect(renderCard(parse(METAR_TIME)).querySelector(".mw-time")).toBeDefined();
  });
});

describe("C3：危险项视觉突出 + 行序对齐电码判读序", () => {
  it("行序：风→能见度→RVR→天气→云→气温→露点→QNH（电码判读序，RVR 紧随能见度）", () => {
    const card = renderCard(parse(THUNDERSTORM), { raw: true });
    const labels = [...card.querySelectorAll("dt")].map((d) => d.textContent);
    expect(labels.indexOf("风")).toBeLessThan(labels.indexOf("能见度"));
    expect(labels.indexOf("能见度")).toBeLessThan(labels.indexOf("跑道视程"));
    expect(labels.indexOf("跑道视程")).toBeLessThan(labels.indexOf("天气"));
    expect(labels.indexOf("天气")).toBeLessThan(labels.indexOf("云"));
    expect(labels.indexOf("云")).toBeLessThan(labels.indexOf("气温"));
    expect(labels.indexOf("露点")).toBeLessThan(labels.indexOf("修正海压"));
  });

  it("雷雨报文：天气与 BKN030CB 值加 mw-danger；能见度 0800 与 RVR M0050 行同样着红", () => {
    const card = renderCard(parse(THUNDERSTORM));
    const weatherRow = [...card.querySelectorAll("dd")].find((d) =>
      d.textContent?.includes("强雷暴伴雨"),
    );
    expect(weatherRow?.querySelector("span.mw-danger")).toBeDefined();
    const cloudRow = [...card.querySelectorAll("dd")].find((d) =>
      d.textContent?.includes("（CB 积雨云"),
    );
    expect(cloudRow?.querySelector("span.mw-danger")).toBeDefined();
    const visRow = [...card.querySelectorAll("dd")].find((d) => d.textContent === "800 m");
    expect(visRow?.classList.contains("mw-danger")).toBe(true);
    const rvrRow = [...card.querySelectorAll("dd")].find((d) => d.textContent?.includes("跑道 36"));
    expect(rvrRow?.classList.contains("mw-danger")).toBe(true);
  });

  it("正常报文零着色（CAVOK 干净报文无 mw-danger / mw-caution）", () => {
    const card = renderCard(parse(RAW), { raw: true });
    expect(card.querySelectorAll(".mw-danger")).toHaveLength(0);
    expect(card.querySelectorAll(".mw-caution")).toHaveLength(0);
  });

  it("中档按强度橙系：-RA 与 3000 m 能见度 → mw-caution（不误升红）", () => {
    const card = renderCard(parse("ZGGG 120000Z 27008KT 3000 -RA SCT030 26/22 Q1009"));
    const weatherRow = [...card.querySelectorAll("dd")].find((d) =>
      d.textContent?.includes("小雨"),
    );
    expect(weatherRow?.querySelector("span.mw-caution")).toBeDefined();
    expect(weatherRow?.querySelector("span.mw-danger")).toBeNull();
    const visRow = [...card.querySelectorAll("dd")].find((d) => d.textContent === "3000 m");
    expect(visRow?.classList.contains("mw-caution")).toBe(true);
  });

  it("冻降水升红（2026-09-22 运行视角评审）：FZRA 天气行加 mw-danger", () => {
    const card = renderCard(parse("ZGGG 120000Z 27008KT 9999 FZRA SCT030 26/22 Q1009"));
    const weatherRow = [...card.querySelectorAll("dd")].find((d) =>
      d.textContent?.includes("冻雨"),
    );
    expect(weatherRow?.querySelector("span.mw-danger")).toBeDefined();
    expect(weatherRow?.querySelector("span.mw-caution")).toBeNull();
  });

  it("样式表锁定新对比度色值：dashed #7f8c9a 在位、旧 dashed #b6c2ce 消失（防回退）", () => {
    renderCard(parse(RAW)); // 触发样式注入
    const css = document.getElementById("mw-card-style")?.textContent ?? "";
    expect(css).toContain("dashed #7f8c9a");
    expect(css).not.toContain("dashed #b6c2ce");
    expect(css).toContain(".mw-danger");
    expect(css).toContain(".mw-caution");
    expect(css).toContain(".mw-stale");
  });
});

describe("C4：风向变化范围行内显示（IR variation 在位时）", () => {
  it("33002MPS 260V010 → 「330° 2 mps（风向在 260° 与 010° 间变动）」，悬停含变化范围说明", () => {
    const card = renderCard(parse("USPP 120930Z 33002MPS 260V010 8000 -SHRA SCT005 14/14 Q1009"));
    const windRow = [...card.querySelectorAll("dd")].find((d) => d.textContent?.includes("mps"));
    // 变化组为独立点击单元（basic 与 variation 各自 affordance 与 aria-label）
    expect(windRow?.textContent).toContain("（风向在 260° 与 010° 间变动）");
    const variationSpan = [...(windRow?.querySelectorAll("span[aria-label]") ?? [])].find((s) =>
      s.getAttribute("aria-label")?.includes("风向变化"),
    );
    expect(variationSpan?.getAttribute("aria-label")).toContain("风向变化范围");
  });

  it("无常程组不显示括号尾缀（回归锁）；en 用半角括号", () => {
    const plain = renderCard(parse("ZGGG 120000Z 27008KT 9999 26/22 Q1009"));
    const windRow = [...plain.querySelectorAll("dd")].find((d) => d.textContent?.includes("kt"));
    expect(windRow?.textContent).not.toContain("V");
    const en = renderCard(parse("USPP 120930Z 33002MPS 260V010 8000 SCT005 14/14 Q1009"), {
      locale: "en",
    });
    const enRow = [...en.querySelectorAll("dd")].find((d) => d.textContent?.includes("mps"));
    expect(enRow?.textContent).toContain("(wind varying between 260° and 010°)");
    expect(en.outerHTML).not.toMatch(HAN);
  });
});

describe("C6：en 告警信息等价（模板+切片插值；未映射 code 回退 原文切片，信息不丢）", () => {
  it("B 样例三条不同缺测（已映射 missing-expected）：en 下互不相同且各自含原文切片（既有锁收紧升级）", () => {
    const card = renderCard(parse("ZGGG 120000Z /////KT //// // 26/22 Q1009"), {
      locale: "en",
      raw: true,
    });
    const texts = [...card.querySelectorAll(".mw-warnings li")].map((li) => li.textContent ?? "");
    expect(texts.length).toBeGreaterThanOrEqual(3);
    const missing = texts.filter((t) => t.includes("Missing-value code"));
    expect(new Set(missing).size, "三条缺测告警英文互不相同").toBe(missing.length);
    expect(missing.some((t) => t.includes("(/////KT)"))).toBe(true);
    expect(missing.some((t) => t.includes("(////)"))).toBe(true);
    expect(missing.some((t) => t.includes("(//)"))).toBe(true);
    expect(card.outerHTML).not.toMatch(HAN);
  });

  it("已映射 code 同报同码不同切片互不相同（value-out-of-range 双组：风向越界 + 零分母）", () => {
    const card = renderCard(parse("ZGGG 120000Z 73015KT 1/0SM 26/22 Q1009"), {
      locale: "en",
      raw: true,
    });
    const texts = [...card.querySelectorAll(".mw-warnings li")]
      .map((li) => li.textContent ?? "")
      .filter((t) => t.includes("outside the plausible range"));
    expect(texts.length).toBe(2);
    expect(new Set(texts).size).toBe(2);
    expect(texts.some((t) => t.includes("(73015KT)"))).toBe(true);
    expect(texts.some((t) => t.includes("(1/0SM)"))).toBe(true);
    expect(card.outerHTML).not.toMatch(HAN);
  });

  it("三条同 code 不同 span 的告警在 en 下各不相同（不再同一句泛化英文）", () => {
    const base = parse("ZGGG 120000Z 00000KT 9999 26/22 Q1009");
    // 模拟未来新增的未映射 code（WarningCode 只增不改——渲染层对未知 code 必须优雅回退）
    const futureCode = "future-code" as WarningCode;
    const withWarnings: MetarReport = {
      ...base,
      warnings: [
        { code: futureCode, severity: "info", message: "未映射甲", span: { start: 5, end: 12 } },
        { code: futureCode, severity: "info", message: "未映射乙", span: { start: 13, end: 20 } },
        { code: futureCode, severity: "info", message: "未映射丙", span: { start: 21, end: 25 } },
      ],
    };
    const card = renderCard(withWarnings, { locale: "en", raw: true });
    const texts = [...card.querySelectorAll(".mw-warnings li")].map((li) => li.textContent ?? "");
    expect(texts).toHaveLength(3);
    expect(new Set(texts).size).toBe(3); // 三条互不相同
    expect(texts.some((t) => t.includes("future-code: 120000Z"))).toBe(true);
    expect(texts.some((t) => t.includes("future-code: 00000KT"))).toBe(true);
    expect(texts.some((t) => t.includes("future-code: 9999"))).toBe(true);
    expect(card.outerHTML).not.toMatch(HAN);
  });
});

describe("C7：整组缺测行占位（显式缺测电码 ≠ 组省略）", () => {
  it("/////KT 报文：风行在位显示「风组缺测」（不再消失）", () => {
    const card = renderCard(parse(DIRTY), { raw: true });
    const labels = [...card.querySelectorAll("dt")].map((d) => d.textContent);
    expect(labels).toContain("风");
    const windRow = [...card.querySelectorAll("dd")][labels.indexOf("风")];
    expect(windRow?.textContent).toContain("风组缺测");
  });

  it("//// 能见度 / // 天气 / RVRNO 各自占位；组省略仍不渲染（口径区分）", () => {
    const card = renderCard(parse("ZGGG 120000Z 00000KT //// // 26/22 Q1009"));
    const text = card.textContent ?? "";
    expect(text).toContain("能见度组缺测");
    expect(text).toContain("天气组缺测");
    expect(text).not.toContain("跑道视程"); // RVR 组省略——不渲染
    const rvrno = renderCard(parse("KXYZ 120953Z AUTO 00000KT 10SM CLR 10/05 A3000 RMK RVRNO"));
    expect(rvrno.textContent).toContain("跑道视程缺测");
  });

  it("en 占位文案零中文", () => {
    const card = renderCard(parse(DIRTY), { locale: "en", raw: true });
    expect(card.textContent).toContain("Wind group missing");
    expect(card.outerHTML).not.toMatch(HAN);
  });
});

describe("E1：紧凑模式（spans:false）渲染优雅降级——不炸、行值由 IR 回退重建", () => {
  it("RAW 对照视图在位但无高亮 span；天气/云行值由 IR 重建原码（+TSRA / BKN030CB）", () => {
    const compact = parse("ZGGG 120000Z 27008KT 800 +TSRA BKN030CB 26/22 Q1009", { spans: false });
    const card = renderCard(compact, { raw: true });
    expect(card.classList.contains("mw-card")).toBe(true);
    const rawBox = card.querySelector(".mw-raw");
    expect(rawBox).not.toBeNull();
    expect(rawBox?.textContent).toContain("+TSRA"); // 整段无高亮（无 span 可定位）
    expect(card.querySelectorAll(".mw-raw span").length).toBe(0);
    expect(card.textContent).toContain("+TSRA");
    expect(card.textContent).toContain("BKN030CB");
  });

  it("紧凑模式完整卡片冒烟：要素行/危险着色/悬停/告警列表全部在位（缺测占位同）", () => {
    const card = renderCard(
      parse("ZGGG 120000Z 00000KT 1/0SM +TSRA BKN030CB 26/22 Q1009 NOSIG", { spans: false }),
      {
        raw: true,
      },
    );
    expect(card.textContent).toContain("能见度组缺测"); // 零分母判缺测的占位行
    expect(card.querySelector(".mw-warnings")).not.toBeNull();
    const weatherRow = [...card.querySelectorAll("dd")].find((d) =>
      d.textContent?.includes("强雷暴伴雨"),
    );
    expect(weatherRow?.querySelector("span.mw-danger")).toBeDefined();
  });
});

describe("下阶段：风切变行（WS RWY——危险级着色 + 双语悬停）", () => {
  it("实弹（ZBAA WS RWY36R）：行在位、mw-danger 着色、悬停含「低空风切变」", () => {
    const card = renderCard(
      parse("ZBAA 111630Z 32009G14MPS 290V350 7000 BLDU NSC 19/M12 Q1010 WS RWY36R NOSIG"),
      { raw: true },
    );
    const labels = [...card.querySelectorAll("dt")].map((d) => d.textContent);
    expect(labels).toContain("风切变");
    const row = [...card.querySelectorAll("dd")][labels.indexOf("风切变")];
    expect(row?.textContent).toContain("跑道 36R 受影响");
    expect(row?.classList.contains("mw-danger")).toBe(true);
    expect(row?.querySelector("span")?.getAttribute("aria-label")).toContain(
      "低空风切变——起降阶段重大危害",
    );
    // 行序：跑道状态之后、趋势之前
    expect(labels.indexOf("风切变")).toBeLessThan(labels.indexOf("趋势"));
    // RAW 对照视图风切变组有高亮
    const rawPiece = [...card.querySelectorAll(".mw-raw span")].find((s) =>
      s.textContent?.includes("WS RWY36R"),
    );
    expect(rawPiece).toBeDefined();
  });

  it("ALL 形态与多组累积：WS RWY ALL / 双组各自人话渲染", () => {
    const all = renderCard(parse("ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 WS RWY ALL NOSIG"));
    expect(all.textContent).toContain("全部跑道受影响");
    const dual = renderCard(
      parse("ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 WS RWY02L WS RWY20R NOSIG"),
    );
    expect(dual.textContent).toContain("跑道 02L 20R 受影响");
  });

  it("locale en：Wind shear 行 + 悬停英文，零中文", () => {
    const card = renderCard(
      parse("ZBAA 111630Z 32009G14MPS 290V350 7000 BLDU NSC 19/M12 Q1010 WS RWY36R NOSIG"),
      { locale: "en", raw: true },
    );
    expect([...card.querySelectorAll("dt")].map((d) => d.textContent)).toContain("Wind shear");
    const row = [...card.querySelectorAll("dd")].find(
      (d) => d.textContent === "runways 36R affected",
    );
    expect(row?.querySelector("span")?.getAttribute("aria-label")).toContain(
      "major hazard during takeoff and landing",
    );
    expect(card.outerHTML).not.toMatch(HAN);
  });

  it("紧凑模式（spans:false）风切变行由 IR 重建纯译文，不炸", () => {
    const card = renderCard(
      parse("ZBAA 111630Z 32009G14MPS 290V350 7000 BLDU NSC 19/M12 Q1010 WS RWY36R NOSIG", {
        spans: false,
      }),
    );
    expect(card.textContent).toContain("跑道 36R 受影响");
  });
});

describe("下阶段：判读链四项（龄期换档 / RVR 悬停解码 / 趋势悬停 / 低云底着色）", () => {
  const METAR_TIME = "METAR ZBAA 110700Z VRB02MPS CAVOK 25/10 Q1019 NOSIG";

  it("龄期换档：10 分钟→「分钟前」；90 分钟→「1 小时前」；47.5 小时→「47 小时前」；3 天→「3 天前」；超 60 分钟仍 mw-stale", () => {
    const at = (iso: string) => renderCard(parse(METAR_TIME), { now: new Date(iso) });
    expect(at("2026-09-11T07:10:00Z").querySelector(".mw-time")?.textContent).toContain(
      "（10 分钟前）",
    );
    expect(at("2026-09-13T06:00:00Z").querySelector(".mw-time")?.textContent).toContain(
      "（47 小时前）",
    );
    const days = at("2026-09-14T07:00:00Z").querySelector(".mw-time");
    expect(days?.textContent).toContain("（3 天前）");
    expect(days?.classList.contains("mw-stale")).toBe(true);
  });

  it("龄期换档 en：'1 h ago' / '3 d ago'", () => {
    const at = (iso: string) => renderCard(parse(METAR_TIME), { locale: "en", now: new Date(iso) });
    expect(at("2026-09-11T08:30:00Z").querySelector(".mw-time")?.textContent).toContain(
      "(1 h ago)",
    );
    expect(at("2026-09-14T07:00:00Z").querySelector(".mw-time")?.textContent).toContain(
      "(3 d ago)",
    );
  });

  it("RVR 行悬停解码：V 波动 / U·D·N 趋势 / P·M 超界前缀（按在场要素拼装）", () => {
    const varying = renderCard(
      parse("CYOW 041700Z 28015KT 1 1/2SM -SN R07R/1800V2200FT VV002 M08/M12 A3006"),
    );
    const vSpan = [...varying.querySelectorAll("dd span")].find((s) =>
      s.getAttribute("aria-label")?.startsWith("R07R/"),
    );
    expect(vSpan?.getAttribute("aria-label")).toContain("两极值间波动");
    const trend = renderCard(parse("ZGGG 120000Z 00000KT 0800 R36/M0050D 26/22 Q1009"));
    const tSpan = [...trend.querySelectorAll("dd span")].find((s) =>
      s.getAttribute("aria-label")?.startsWith("R36/"),
    );
    expect(tSpan?.getAttribute("aria-label")).toContain("上升/下降/无变化");
    expect(tSpan?.getAttribute("aria-label")).toContain("超出上限/低于下限");
    // 无 RVR 要素提示的纯值组悬停不带趋势/超界句
    const plain = renderCard(parse("ZGGG 120000Z 00000KT 0800 R36/0500 26/22 Q1009"));
    const pSpan = [...plain.querySelectorAll("dd span")].find((s) =>
      s.getAttribute("aria-label")?.startsWith("R36/"),
    );
    expect(pSpan?.getAttribute("aria-label") ?? "").not.toContain("上升/下降");
  });

  it("RVR 悬停 en：varying trend beyond 英文，零中文", () => {
    const card = renderCard(
      parse("ZGGG 120000Z 00000KT 0800 R36/M0050D R07R/1800V2200FT 26/22 Q1009"),
      { locale: "en" },
    );
    const span = [...card.querySelectorAll("dd span")].find((s) =>
      s.getAttribute("aria-label")?.startsWith("R36/"),
    );
    expect(span?.getAttribute("aria-label")).toContain("up/down/no change");
    expect(span?.getAttribute("aria-label")).toContain("above the upper / below the lower limit");
    expect(card.outerHTML).not.toMatch(HAN);
  });

  it("趋势行悬停：NOSIG 无重要变化 / BECMG 渐变 + AT 具体时刻 / TEMPO 短时波动 + 组内要素人话；WS RWY 内嵌提示", () => {
    const card = renderCard(
      parse(
        "ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 NOSIG BECMG AT0130 4000 -SHRA TEMPO 3000 TSRA",
      ),
    );
    const trendRow = [...card.querySelectorAll("dd")].find((d) =>
      d.querySelector("span")?.getAttribute("aria-label")?.startsWith("NOSIG"),
    );
    const pieces = [...(trendRow?.querySelectorAll("span") ?? [])];
    const titleOf = (code: string): string =>
      pieces
        .find((p) => p.getAttribute("aria-label")?.startsWith(code))
        ?.getAttribute("aria-label") ?? "";
    expect(titleOf("NOSIG")).toContain("无重要变化");
    expect(titleOf("BECMG")).toContain("渐变");
    // 预计时刻 = 具体时间点（HHMM 折 HH:MM，不重复 AT/TL/FM 原词）
    expect(titleOf("BECMG")).toContain("预计时刻 01:30");
    expect(titleOf("BECMG")).not.toContain("AT0130；");
    // 渐变内容人话：组内要素逐族解释（能见度 + 天气），不再只给 kind/时段语义
    expect(titleOf("BECMG")).toContain("趋向：能见度 4000 m");
    expect(titleOf("BECMG")).toContain("小阵雨");
    expect(titleOf("TEMPO")).toContain("短时波动");
    expect(titleOf("TEMPO")).toContain("雷暴伴雨");
    // 趋势后 WS RWY（2026-09-14 趋势收窄改约）：WS 交回正文认组，渲染为独立风切变行（mw-danger）；
    // BECMG 趋势行不再含 WS（行标签在 dt，悬停语义按词级 span 的 aria-label 查找）
    const wsTrend = renderCard(
      parse("ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 BECMG AT0130 4000 WS RWY02L"),
    );
    const wsRow = [...wsTrend.querySelectorAll("dd")].find((d) =>
      d.querySelector("span")?.getAttribute("aria-label")?.includes("风切变"),
    );
    expect(wsRow?.querySelector("span")?.getAttribute("aria-label")).toContain("风切变");
    const becmgRow = [...wsTrend.querySelectorAll("dd")].find((d) =>
      d.textContent?.includes("BECMG"),
    );
    expect(becmgRow?.textContent ?? "").not.toContain("WS");
  });

  it("趋势悬停 en：NOSIG/BECMG/TEMPO 英文，零中文", () => {
    const card = renderCard(
      parse("ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 NOSIG BECMG AT0130 4000"),
      { locale: "en" },
    );
    const trendRow = [...card.querySelectorAll("dd")].find((d) =>
      d.querySelector("span")?.getAttribute("aria-label")?.startsWith("NOSIG"),
    );
    const titles = [...(trendRow?.querySelectorAll("span") ?? [])]
      .map((p) => p.getAttribute("aria-label") ?? "")
      .join("\n");
    expect(titles).toContain("no significant change expected");
    expect(titles).toContain("gradual change");
    expect(titles).toContain("at 01:30");
    expect(titles).toContain("expected: Visibility 4000 m");
    expect(card.outerHTML).not.toMatch(HAN);
  });

  it("趋势云组人话：FEW023CB/BKN033 逐层短译（云量 + 云底折米 + CB 威胁注）；NSW/NSC/CAVOK 趋势专属电码各给一词", () => {
    const card = renderCard(
      parse("ZGOW 120700Z 14006MPS SCT040 32/25 Q1011 BECMG AT0730 FEW023CB BKN033"),
    );
    const trendRow = [...card.querySelectorAll("dd")].find((d) =>
      d.querySelector("span")?.getAttribute("aria-label")?.startsWith("BECMG"),
    );
    const title = trendRow?.querySelector("span")?.getAttribute("aria-label") ?? "";
    expect(title).toContain("预计时刻 07:30");
    expect(title).toContain("少云，云底约 701 米（CB 积雨云：雷暴、冰雹、强颠簸风险）");
    expect(title).toContain("多云，云底约 1006 米");
    // NSW（趋势时段内无重要天气）/ NSC（无显著云）/ CAVOK（趋势内顶替三族）
    const nsw = renderCard(parse("ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 BECMG AT0840 NSW"));
    const nswTitle = [...nsw.querySelectorAll("dd span")]
      .find((p) => p.getAttribute("aria-label")?.includes("BECMG"))
      ?.getAttribute("aria-label");
    expect(nswTitle).toContain("无重要天气");
    const nsc = renderCard(parse("ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 BECMG TL1700 NSC"));
    const nscTitle = [...nsc.querySelectorAll("dd span")]
      .find((p) => p.getAttribute("aria-label")?.includes("BECMG"))
      ?.getAttribute("aria-label");
    expect(nscTitle).toContain("持续至 17:00");
    expect(nscTitle).toContain("无显著云");
    const cavok = renderCard(
      parse("ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 BECMG AT0600 CAVOK"),
    );
    const cavokTitle = [...cavok.querySelectorAll("dd span")]
      .find((p) => p.getAttribute("aria-label")?.includes("BECMG"))
      ?.getAttribute("aria-label");
    expect(cavokTitle).toContain("CAVOK：能见度 ≥10km");
  });

  it("趋势风组人话：unspecified 磨损段的风组照样解释（原词保留 + 风向风速人话）", () => {
    const card = renderCard(parse("ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 TL0730 11005MPS"));
    const trendRow = [...card.querySelectorAll("dd")].find((d) =>
      d.querySelector("span")?.getAttribute("aria-label")?.startsWith("TL0730"),
    );
    const title = trendRow?.querySelector("span")?.getAttribute("aria-label") ?? "";
    expect(title).toContain("趋向：风 110° 5 mps");
  });

  it("低云底着色（判据初稿待审）：BKN008 → danger；BKN020 → caution；OVC150 → 不着色；VV002 → danger；VV010 → caution", () => {
    const card = renderCard(
      parse("ZGGG 120000Z 27008KT 9999 BKN008 BKN020 OVC150 VV002 26/22 Q1009"),
    );
    const cloudRow = [...card.querySelectorAll("dd")].find((d) =>
      d.querySelector("span")?.getAttribute("aria-label")?.includes("BKN008"),
    );
    const pieceOf = (code: string): HTMLElement | null =>
      [...(cloudRow?.querySelectorAll("span") ?? [])].find(
        (p) => p.getAttribute("aria-label")?.includes(code) ?? false,
      ) ?? null;
    expect(pieceOf("BKN008")?.classList.contains("mw-danger")).toBe(true);
    expect(pieceOf("BKN020")?.classList.contains("mw-caution")).toBe(true);
    expect(pieceOf("OVC150")?.classList.contains("mw-danger")).toBe(false);
    expect(pieceOf("OVC150")?.classList.contains("mw-caution")).toBe(false);
    expect(pieceOf("VV002")?.classList.contains("mw-danger")).toBe(true);
    const vvCaution = renderCard(parse("ZGGG 120000Z 27008KT 9999 VV010 26/22 Q1009"));
    const vvRow = [...vvCaution.querySelectorAll("dd")].find((d) =>
      d.querySelector("span")?.getAttribute("aria-label")?.includes("VV010"),
    );
    expect(vvRow?.querySelector("span")?.classList.contains("mw-caution")).toBe(true);
    // CB/TCU 仍红不回归；SCT/FEW 不按云底着色
    const cb = renderCard(parse("ZGGG 120000Z 27008KT 9999 SCT030CB FEW008 26/22 Q1009"));
    const cbRow = [...cb.querySelectorAll("dd")].find((d) =>
      d.textContent?.includes("（CB 积雨云"),
    );
    expect(cbRow?.querySelector("span")?.classList.contains("mw-danger")).toBe(true);
    const few = cbRow
      ? [...cb.querySelectorAll("dd span")].find(
          (p) => p.getAttribute("aria-label")?.includes("FEW008") ?? false,
        )
      : null;
    expect(few?.classList.contains("mw-caution")).toBe(false);
  });
});

// ---------------------------------------------------------------- 官方标准核对修订（2026-09-13）

describe("官方标准核对修订（WMO 306 卷 I.1（2019）FM15 原文 + 民航观测规范 AP-117-TM-2021-01）", () => {
  it("风切变悬停引用条款更正为 WMO 306 FM15 §15.13.3（§15.4 实为 AUTO 码字条款）", () => {
    const card = renderCard(
      parse("ZBAA 111630Z 32009G14MPS 290V350 7000 BLDU NSC 19/M12 Q1010 WS RWY36R NOSIG"),
    );
    const row = [...card.querySelectorAll("dd")].find((d) =>
      d.querySelector("span")?.getAttribute("aria-label")?.includes("WS RWY36R"),
    );
    expect(row?.querySelector("span")?.getAttribute("aria-label")).toContain(
      "WMO 306 FM15 §15.13.3",
    );
    expect(row?.querySelector("span")?.getAttribute("aria-label") ?? "").not.toContain("15.4");
    const en = renderCard(
      parse("ZBAA 111630Z 32009G14MPS 290V350 7000 NSC 19/M12 Q1010 WS RWY36R NOSIG"),
      { locale: "en" },
    );
    const enRow = [...en.querySelectorAll("dd")].find((d) =>
      d.querySelector("span")?.getAttribute("aria-label")?.includes("WS RWY36R"),
    );
    expect(enRow?.querySelector("span")?.getAttribute("aria-label")).toContain(
      "WMO 306 FM15 §15.13.3",
    );
  });

  it("RVR 的 V 悬停更正：观测时段内在两极值间波动（非「两跑段间」）", () => {
    const zh = renderCard(
      parse("CYOW 041700Z 28015KT 1 1/2SM -SN R07R/1800V2200FT VV002 M08/M12 A3006"),
    );
    const vSpan = [...zh.querySelectorAll("dd span")].find((s) =>
      s.getAttribute("aria-label")?.startsWith("R07R/"),
    );
    expect(vSpan?.getAttribute("aria-label")).toContain("V = 观测时段内在两极值间波动");
    const en = renderCard(
      parse("ZGGG 120000Z 00000KT 0800 R36/M0050D R07R/1800V2200FT 26/22 Q1009"),
      { locale: "en" },
    );
    // 逐跑道按在场要素拼装：R36 只有 U/D/N 与 P/M；V 波动句归 R07R（own-elements 口径）
    const enSpan36 = [...en.querySelectorAll("dd span")].find((s) =>
      s.getAttribute("aria-label")?.startsWith("R36/"),
    );
    expect(enSpan36?.getAttribute("aria-label")).toContain("up/down/no change");
    expect(enSpan36?.getAttribute("aria-label")).not.toContain("varying");
    const enSpan07 = [...en.querySelectorAll("dd span")].find((s) =>
      s.getAttribute("aria-label")?.startsWith("R07R/"),
    );
    expect(enSpan07?.getAttribute("aria-label")).toContain("varying between two extreme values");
  });

  it("趋势时段词按官方语义分述 + 折具体时刻：AT 预计时刻 / TL 持续至 / FM 自…起（WMO §15.14.3 + 观测规范附录六）", () => {
    const tl = renderCard(
      parse("ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 BECMG TL1700 0800 FG"),
    );
    const tlRow = [...tl.querySelectorAll("dd")].find((d) =>
      d.querySelector("span")?.getAttribute("aria-label")?.includes("BECMG"),
    );
    expect(tlRow?.querySelector("span")?.getAttribute("aria-label")).toContain("持续至 17:00");
    expect(tlRow?.querySelector("span")?.getAttribute("aria-label")).toContain(
      "趋向：能见度 800 m",
    );
    const fm = renderCard(parse("ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 BECMG FM1030 4000"));
    const fmRow = [...fm.querySelectorAll("dd")].find((d) =>
      d.querySelector("span")?.getAttribute("aria-label")?.includes("BECMG"),
    );
    expect(fmRow?.querySelector("span")?.getAttribute("aria-label")).toContain("自 10:30 起");
    const en = renderCard(
      parse("ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 BECMG TL1700 0800 FG"),
      { locale: "en" },
    );
    const enRow = [...en.querySelectorAll("dd")].find((d) =>
      d.querySelector("span")?.getAttribute("aria-label")?.includes("BECMG"),
    );
    expect(enRow?.querySelector("span")?.getAttribute("aria-label")).toContain("until 17:00");
    const enFm = renderCard(
      parse("ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 BECMG FM1030 4000"),
      { locale: "en" },
    );
    const enFmRow = [...enFm.querySelectorAll("dd")].find((d) =>
      d.querySelector("span")?.getAttribute("aria-label")?.includes("BECMG"),
    );
    expect(enFmRow?.querySelector("span")?.getAttribute("aria-label")).toContain("from 10:30");
  });

  it("天气现象表对齐观测规范附录十五：GS 小雹和/或霰、PO 尘/沙旋风（尘卷风）；PY 浪花（无民航官方对应）", () => {
    expect(glossOf("ZGGG 120000Z 27008KT 9999 GS 26/22 Q1009", "GS")).toContain("小雹和/或霰");
    expect(glossOf("ZGGG 120000Z 27008KT 9999 PO 26/22 Q1009", "PO")).toContain("尘/沙旋风");
    expect(glossOf("ZGGG 120000Z 27008KT 9999 PY 26/22 Q1009", "PY")).toContain("浪花");
    const en = renderCard(parse("ZGGG 120000Z 27008KT 9999 GS PO 26/22 Q1009"), { locale: "en" });
    const titles = [...en.querySelectorAll("dd span")].map(
      (s) => s.getAttribute("aria-label") ?? "",
    );
    expect(titles.some((t) => t.includes("small hail and/or snow pellets"))).toBe(true);
    expect(titles.some((t) => t.includes("dust devils"))).toBe(true);
  });

  it("跑道状态表对齐 WMO 电码表 0919/0366：沉积 0＝清洁且干燥（clear and dry）、制动 99＝不可靠", () => {
    const zh = renderCard(
      parse("METAR UUDD 120000Z 36001MPS 9999 SCT030 M02/M05 Q1019 R01/020593"),
    );
    const zhRow = [...zh.querySelectorAll("dd")].find((d) => d.textContent?.startsWith("R01"));
    expect(zhRow?.textContent).toContain("清洁且干燥");
    const unrel = renderCard(
      parse("METAR UUDD 120000Z 36001MPS 9999 SCT030 M02/M05 Q1019 R01/520199"),
    );
    const unrelRow = [...unrel.querySelectorAll("dd")].find((d) =>
      d.textContent?.startsWith("R01"),
    );
    expect(unrelRow?.textContent).toContain("制动作用 不可靠");
    const en = renderCard(
      parse("METAR UUDD 120000Z 36001MPS 9999 SCT030 M02/M05 Q1019 R01/020593"),
      {
        locale: "en",
      },
    );
    const enRow = [...en.querySelectorAll("dd")].find((d) => d.textContent?.startsWith("R01"));
    expect(enRow?.textContent).toContain("clear and dry");
  });

  it("跑道状态 en 沉积表对齐 0919 官方措辞：2＝wet and water patches、3＝rime and frost covered", () => {
    const en = renderCard(
      parse("METAR UUDD 120000Z 36001MPS 9999 SCT030 M02/M05 Q1019 R13R/291593 R26/391593"),
      { locale: "en" },
    );
    const text = en.textContent ?? "";
    expect(text).toContain("wet and water patches");
    expect(text).toContain("rime and frost covered");
  });

  it("关闭注记对齐 §15.13.6.1 + 表 1079：SNOCLO＝机场因大量积雪关闭；深度位 99＝因雪/雪浆/冰/雪堆/清雪关闭", () => {
    const card = renderCard(
      parse("METAR UUDD 150000Z 36001MPS 9999 SCT030 M02/M05 Q1019 R/SNOCLO"),
    );
    const closedRow = [...card.querySelectorAll("dd")].find((d) => d.textContent?.includes("关闭"));
    expect(closedRow?.querySelector("span")?.getAttribute("aria-label")).toContain("大量积雪关闭");
    expect(closedRow?.querySelector("span")?.getAttribute("aria-label")).toContain("深度位 99");
    const en = renderCard(parse("METAR UUDD 150000Z 36001MPS 9999 SCT030 M02/M05 Q1019 R/SNOCLO"), {
      locale: "en",
    });
    const enRow = [...en.querySelectorAll("dd")].find((d) => d.textContent?.includes("closed"));
    expect(enRow?.querySelector("span")?.getAttribute("aria-label")).toContain(
      "extreme deposit of snow",
    );
  });
});

describe("趋势后 WS 四形态渲染（2026-09-14 趋势收窄改约：WS 交回正文，一等风切变行回归锁）", () => {
  it("标准 WS ALL RWY / WS R18 与变体 WS RWY ALL / WS RWY02L 均渲染独立风切变行；悬停含风切变语义", () => {
    for (const tail of ["WS ALL RWY", "WS R18", "WS RWY ALL", "WS RWY02L"]) {
      const card = renderCard(
        parse(`ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 TEMPO 3000 TSRA ${tail}`),
      );
      const wsRow = [...card.querySelectorAll("dd")].find((d) =>
        d.querySelector("span")?.getAttribute("aria-label")?.includes("风切变"),
      );
      expect(wsRow, `形态 ${tail} 缺风切变行`).toBeDefined();
      expect(wsRow?.querySelector("span")?.getAttribute("aria-label")).toContain("风切变");
      // TEMPO 趋势行不再吞 WS（raw 截于 WS 前）
      const tempoRow = [...card.querySelectorAll("dd")].find((d) =>
        d.textContent?.includes("TEMPO"),
      );
      expect(tempoRow?.textContent ?? "").not.toContain("WS");
    }
    const zh = renderCard(
      parse("ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 TEMPO 3000 TSRA WS ALL RWY"),
    );
    const title =
      [...zh.querySelectorAll("dd")]
        .find((d) => d.querySelector("span")?.getAttribute("aria-label")?.includes("风切变"))
        ?.querySelector("span")
        ?.getAttribute("aria-label") ?? "";
    expect(title).toContain("风切变");
    expect(title).toContain("起降");
  });
});

describe("0000 能见度渲染口径（六规范审计批：米制 beyond below 反向错误回归锁）", () => {
  it("0000 → <50 m（非 ≥10 km）；9999 → ≥10 km 不回归；最低能见度方向组随行显示", () => {
    const visRow = visRowOf;
    const below = renderCard(parse("ZBAA 121253Z 30015KT 0000 BKN010 12/02 Q1013"));
    expect(visRow(below)).toBe("<50 m");
    const above = renderCard(parse("ZBAA 121253Z 30015KT 9999 BKN010 12/02 Q1013"));
    expect(visRow(above)).toBe("≥10 km");
    const min = renderCard(parse("ZBAA 121253Z 30015KT 8000 1200NW BKN010 12/02 Q1013"));
    expect(visRow(min)).toContain("8000 m");
    expect(visRow(min)).toContain("1200 米（NW 方向）");
  });
});

describe("RAW/卡片提示点击通道（触屏与键盘可达：title 悬停之外的气泡切换）", () => {
  it("点 RAW 已知组出气泡（含 data-hint 文案 + 转换说明表）、再点收起、点别的换文案、点空白全收、Esc 收起", () => {
    const card = renderCard(parse("ZBAA 121253Z 30015KT 9999 FEW010 SCT020 21/12 Q1013"), {
      raw: true,
    });
    const bubble = card.querySelector(".mw-hint-pop")!;
    const tokens = [...card.querySelectorAll<HTMLElement>(".mw-raw span.mw-hint")];
    expect(tokens.length).toBeGreaterThan(0);
    expect(bubble.classList.contains("mw-hint-on")).toBe(false);

    const first = tokens[0]!;
    first.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(first.classList.contains("mw-hint-on")).toBe(true);
    expect(bubble.classList.contains("mw-hint-on")).toBe(true);
    // 点击 = 转换说明：表头 + 逐 token 原码 → 含义（首个 token 的含义即该组人话值）
    expect(bubble.textContent).toContain("转换说明");
    expect(bubble.textContent).toContain(first.dataset.hint?.split("：")[0] ?? "");
    expect(first.getAttribute("tabindex")).toBe("0");

    first.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(bubble.classList.contains("mw-hint-on")).toBe(false);

    const second = tokens[1]!;
    second.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(bubble.classList.contains("mw-hint-on")).toBe(true);
    expect(bubble.textContent).not.toBe(first.dataset.hint);
    // 历史转换表不残留：气泡只含本次点击那一份（first 风组解码行已被清空）
    expect(bubble.textContent).not.toContain("风速 15 kt");

    card.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(bubble.classList.contains("mw-hint-on")).toBe(false);

    first.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    bubble.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(bubble.classList.contains("mw-hint-on")).toBe(false);
    // 主表行提示同通道（attachHint 统一升级到内联 span）：风行 span 亦可点击出气泡
    const windSpan = card.querySelector("dd span.mw-hint"); // 风行是首个带提示的要素行
    expect(windSpan).toBeDefined();
    windSpan!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(bubble.classList.contains("mw-hint-on")).toBe(true);
  });

  it("转换说明去重：NOSIG 单 token 趋势只出一行（raw 与指示组同词不重复）", () => {
    const card = renderCard(parse("METAR ZBAA 110700Z VRB02MPS CAVOK 25/10 Q1019 NOSIG"), {
      raw: true,
    });
    const trendSpan = [...card.querySelectorAll("dd span.mw-hint")].find((s) =>
      s.getAttribute("aria-label")?.startsWith("NOSIG"),
    );
    expect(trendSpan).toBeDefined();
    trendSpan!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const bubble = card.querySelector(".mw-hint-pop")!;
    const hits = (bubble.textContent ?? "").split("无重要变化").length - 1;
    expect(hits).toBe(1);
  });
});

describe("RAW 报文天气颜色标注（主表判读链同色带到原文）", () => {
  it("危险/注意天气组、对流云、低 RVR、风切变在 RAW 中与主表同色；普通组不着色", () => {
    const card = renderCard(
      parse("ZUTF 140600Z VRB01MPS 9999 +TSRA FEW014 SCT020CB 21/20 Q1022 NOSIG"),
      { raw: true },
    );
    const spans = [...card.querySelectorAll(".mw-raw span")];
    const tone = (text: string): string | null =>
      spans.find((s) => s.textContent === text)?.className ?? null;
    expect(tone("+TSRA")).toContain("mw-danger"); // 强度 + → danger
    expect(tone("SCT020CB")).toContain("mw-danger"); // 对流云 → danger
    expect(tone("FEW014")).toBe("mw-hint"); // 普通云层不着色
    const caution = renderCard(
      parse("ZUTF 140600Z VRB01MPS 9999 -SHRA FEW014 SCT020 21/20 Q1022 NOSIG"),
      { raw: true },
    );
    const cautionSpans = [...caution.querySelectorAll(".mw-raw span")];
    expect(cautionSpans.find((s) => s.textContent === "-SHRA")?.className).toContain("mw-caution"); // 降水族 → caution
    const rvr = renderCard(parse("ZBAA 121253Z 30015KT 0800 R18/0350 BKN010 12/02 Q1013"), {
      raw: true,
    });
    expect(
      [...rvr.querySelectorAll(".mw-raw span")].find((s) => s.textContent === "R18/0350")
        ?.className,
    ).toContain("mw-danger"); // 低 RVR → danger
    const shear = renderCard(
      parse("METAR KDEN 121253Z 30015G22KT 3SM WS ALL RWY BKN010 OVC020 12/02 A3010"),
      { raw: true },
    );
    expect(
      [...shear.querySelectorAll(".mw-raw span")].find((s) => s.textContent === "WS ALL RWY")
        ?.className,
    ).toContain("mw-danger");
  });
});

describe("RAW 词组逐要素解码（问号气泡从行标签升级为具体解读）", () => {
  it("FEW014 → 云量档位释义 + 云底英尺折米；主表云行同文案（英尺+米都在）", () => {
    const card = renderCard(parse("ZUTF 140600Z VRB01MPS 9999 FEW014 SCT020 21/20 Q1022 NOSIG"), {
      raw: true,
    });
    const few = [...card.querySelectorAll<HTMLElement>(".mw-raw span.mw-hint")].find(
      (s) => s.textContent === "FEW014",
    );
    const hint = few?.dataset.hint ?? "";
    expect(hint).toContain("少云"); // 云量档位释义
    expect(hint).toContain("1400 英尺"); // 英尺原值
    expect(hint).toMatch(/≈ \d+ 米/); // 折米
    // 主表云行同文案（点击气泡同源）——主表纯译文后按悬停 title 中的原码定位
    const cloudDd = [...card.querySelectorAll("dd span.mw-hint")].find((s) =>
      s.getAttribute("aria-label")?.startsWith("FEW014"),
    );
    expect(cloudDd?.getAttribute("aria-label")).toContain("1400 英尺");
    // ftToMeters = 1 ft × 0.3048 精确换算取整（426.72 → 427），不再按 50 米档位圆整；
    // 米值是本库换算所得，悬停同时说明来源口径
    expect(cloudDd?.getAttribute("aria-label")).toContain("≈ 427 米");
    expect(cloudDd?.getAttribute("aria-label")).toContain("报文只编英尺");
  });

  it("风/能见度/温露/QNH 逐 token 解码 + 最低能见度方向组独立标注", () => {
    const card = renderCard(parse("ZBAA 121253Z 30015KT 8000 1200NW BKN010 12/02 Q1013"), {
      raw: true,
    });
    const hintOf = (text: string): string =>
      [...card.querySelectorAll<HTMLElement>(".mw-raw span.mw-hint")].find(
        (s) => s.textContent === text,
      )?.dataset.hint ?? "";
    expect(hintOf("30015KT")).toContain("风");
    expect(hintOf("30015KT")).toContain("300°");
    expect(hintOf("8000")).toContain("能见度");
    expect(hintOf("1200NW")).toContain("最低能见度 1200 米（NW 方向）");
    expect(hintOf("12/02")).toContain("气温");
    expect(hintOf("Q1013")).toContain("修正海压");
  });

  it("en 卡同构：FEW014 解码含 Few / 1400 ft ≈ 427 m，零中文", () => {
    const card = renderCard(parse("ZUTF 140600Z VRB01MPS 9999 FEW014 SCT020 21/20 Q1022 NOSIG"), {
      raw: true,
      locale: "en",
    });
    const few = [...card.querySelectorAll<HTMLElement>(".mw-raw span.mw-hint")].find(
      (s) => s.textContent === "FEW014",
    );
    const hint = few?.dataset.hint ?? "";
    expect(hint).toContain("Few");
    expect(hint).toContain("1400 ft");
    expect(hint).toContain("≈ 427 m");
    expect(hint).toContain("converted by this library");
    expect(card.outerHTML).not.toMatch(/[\u4e00-\u9fa5]/);
  });
});

describe("温露组标注合并 + 气泡单行优先（用户实测反馈修正）", () => {
  it("18/10 点哪边都是完整解读：气温与露点同条标注不互相覆盖", () => {
    const card = renderCard(parse("ZBAA 121253Z 30015KT 8000 BKN010 18/10 Q1013"), { raw: true });
    const token = [...card.querySelectorAll<HTMLElement>(".mw-raw span.mw-hint")].find(
      (s) => s.textContent === "18/10",
    );
    const hint = token?.dataset.hint ?? "";
    expect(hint).toContain("气温");
    expect(hint).toContain("18°C");
    expect(hint).toContain("露点");
    expect(hint).toContain("10°C");
  });

  it("气泡样式契约：max-content 单行优先 + 无 break-all（数字不再被拦腰截断）", () => {
    renderCard(parse("ZBAA 121253Z 30015KT 8000 BKN010 18/10 Q1013"), { raw: true });
    const style = document.querySelector("#mw-card-style");
    const css = style?.textContent ?? "";
    // 只约束气泡规则本身（RAW 原文框的 break-all 合法保留）
    const popRule = css.split(".mw-hint-pop {")[1]?.split("}")[0] ?? "";
    expect(popRule).toContain("width: max-content");
    expect(popRule).not.toContain("break-all");
    expect(popRule).toContain("max-width: 480px");
    // 可点击性统一视觉语言：mw-hint 与 RAW 词组同款 affordance（虚线 + 问号光标）
    const hintRule = css.split(".mw-card .mw-hint {")[1]?.split("}")[0] ?? "";
    expect(hintRule).toContain("cursor: help");
    expect(hintRule).toContain("dashed");
  });

  it("电码浮签：悬停主表词点亮两侧并随行显 RAW 侧电码，离开即隐", () => {
    const card = renderCard(parse("METAR ZBAA 110700Z 04009G16MPS 9999 SCT033 25/10 Q1019 NOSIG"), {
      raw: true,
    });
    // 主表风值 span 的提示语形如「风：40° 9 m/s…」（人话格式，电码在 RAW 侧同组 token）
    const windSpan = [...card.querySelectorAll<HTMLElement>("dd [data-hint]")].find((h) =>
      (h.dataset.hint ?? "").startsWith("风："),
    );
    if (windSpan === undefined) throw new Error("应有风组提示词");
    windSpan.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    const chip = card.querySelector<HTMLElement>(".mw-codechip");
    expect(chip).not.toBeNull();
    expect(chip?.style.display).not.toBe("none");
    expect(chip?.textContent).toContain("04009G16MPS"); // 浮签显组电码（丢 showChip 接线即红）
    expect(card.querySelectorAll(".mw-raw .mw-link").length).toBeGreaterThanOrEqual(1); // RAW 侧同组点亮
    card.dispatchEvent(new MouseEvent("mouseleave"));
    expect(chip?.style.display).toBe("none");
    expect(card.querySelectorAll(".mw-link").length).toBe(0);
  });
});

describe("天气/云行纯译文（原码只在 RAW 视图与悬停提示）", () => {
  it("天气行：-SHRA → 「小阵雨」（纯译文，语义色保留）；云行：SCT014 → 「疏云，云底约 427 米」", () => {
    const card = renderCard(parse("ZUTF 140600Z VRB01MPS 9999 -SHRA SCT014 21/20 Q1022 NOSIG"));
    const wxRow = [...card.querySelectorAll("dd")].find((d) => d.textContent?.includes("小阵雨"));
    expect(wxRow?.textContent).toContain("小阵雨");
    expect(wxRow?.textContent).not.toContain("-SHRA");
    const cloudRow = [...card.querySelectorAll("dd")].find((d) => d.textContent?.includes("疏云"));
    expect(cloudRow?.textContent).toContain("疏云，云底约 427 米");
    // 原码锚点仍在：悬停 title 以原码开头（桥接 RAW 对照视图）
    const codeSpan = [...(cloudRow?.querySelectorAll("span") ?? [])].find((s) =>
      s.getAttribute("aria-label")?.startsWith("SCT014"),
    );
    expect(codeSpan?.classList.contains("mw-hint")).toBe(true);
  });

  it("en 卡纯译文同构且零中文（云底正面缺省英尺 = 报文原生编码；heightUnit 可折回米）", () => {
    const card = renderCard(parse("ZUTF 140600Z VRB01MPS 9999 -SHRA SCT014 21/20 Q1022 NOSIG"), {
      locale: "en",
    });
    const wxRow = [...card.querySelectorAll("dd")].find((d) =>
      d.textContent?.toLowerCase().includes("light rain showers"),
    );
    expect(wxRow?.textContent?.toLowerCase()).not.toContain("-shra");
    const cloudRow = [...card.querySelectorAll("dd")].find((d) =>
      d.textContent?.includes("scattered"),
    );
    // en 缺省英尺（原码直读，无「≈」）；heightUnit:"m" 折回换算米值
    expect(cloudRow?.textContent).toContain("scattered, base 1400 ft");
    const metersCard = renderCard(
      parse("ZUTF 140600Z VRB01MPS 9999 -SHRA SCT014 21/20 Q1022 NOSIG"),
      { locale: "en", heightUnit: "m" },
    );
    const metersRow = [...metersCard.querySelectorAll("dd")].find((d) =>
      d.textContent?.includes("scattered"),
    );
    expect(metersRow?.textContent).toContain("scattered, base ≈ 427 m");
    expect(card.outerHTML).not.toMatch(/[\u4e00-\u9fa5]/);
  });

  it("对流云行内风险直出（威胁零点击可见）：FEW030CB/TCU 值带风险注；云量/云底缺测不拦风险词", () => {
    // 与天气行行内直出同口径：探测到对流云本身就是威胁，纯译文亦不削弱
    const card = renderCard(parse("ZGGG 120000Z 27008MPS 9999 FEW030CB 26/22 Q1009"));
    const cloudRow = [...card.querySelectorAll("dd")].find((d) =>
      d.textContent?.includes("（CB 积雨云"),
    );
    expect(cloudRow?.textContent).toContain(
      "少云，云底约 914 米（CB 积雨云：雷暴、冰雹、强颠簸风险）",
    );
    const tcu = renderCard(parse("ZGGG 120000Z 27008MPS 9999 SCT018TCU 26/22 Q1009"));
    const tcuRow = [...tcu.querySelectorAll("dd")].find((d) =>
      d.textContent?.includes("（TCU 浓积云"),
    );
    expect(tcuRow?.textContent).toContain("疏云，云底约 549 米（TCU 浓积云：强颠簸与积冰风险）");
    // 缺测位不拦风险词：FEW///CB 云底缺测、///025CB 云量缺测——风险注照样随行
    const wornHeight = renderCard(parse("ZGGG 120000Z 27008MPS 9999 FEW///CB 26/22 Q1009"));
    const wornHeightRow = [...wornHeight.querySelectorAll("dd")].find((d) =>
      d.textContent?.includes("（CB 积雨云"),
    );
    expect(wornHeightRow?.textContent).toContain("少云（CB 积雨云");
    const wornAmount = renderCard(parse("ZGGG 120000Z 27008MPS 9999 ///025CB 26/22 Q1009"));
    const wornAmountRow = [...wornAmount.querySelectorAll("dd")].find((d) =>
      d.textContent?.includes("（CB 积雨云"),
    );
    expect(wornAmountRow?.textContent).toContain("云量缺测，云底约 762 米（CB 积雨云");
    // 非对流云缺测位不凭空造词：///025 云量缺测显示「云量缺测」（悬停承载细节）
    const plainWorn = renderCard(parse("ZGGG 120000Z 27008MPS 9999 ///025 26/22 Q1009"));
    const plainWornRow = [...plainWorn.querySelectorAll("dd")].find((d) =>
      d.textContent?.includes("云量缺测"),
    );
    expect(plainWornRow?.textContent).not.toContain("少云");
    // en 同构（云底正面缺省英尺 = 报文原生编码）
    const en = renderCard(parse("ZGGG 120000Z 27008MPS 9999 FEW030CB 26/22 Q1009"), {
      locale: "en",
    });
    const enRow = [...en.querySelectorAll("dd")].find((d) =>
      d.textContent?.includes("(CB cumulonimbus"),
    );
    expect(enRow?.textContent).toContain(
      "few, base 3000 ft (CB cumulonimbus: thunderstorm, hail, severe turbulence risk)",
    );
  });

  it("趋势悬停的云组内容与纯译文同口径：对流云风险注不受缺测拦截", () => {
    const card = renderCard(
      parse("ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 BECMG AT0730 FEW///CB"),
    );
    const title = [...card.querySelectorAll("dd span")]
      .find((p) => p.getAttribute("aria-label")?.includes("BECMG"))
      ?.getAttribute("aria-label");
    expect(title).toContain("少云（CB 积雨云：雷暴、冰雹、强颠簸风险）");
  });
});

// ---------------------------------------------------------------- 主表/RAW 提示语一致性（单一来源回归锁）

describe("主表/RAW 提示语一致性（2026-09-14 复评：两边各拼一套已漂移——单一来源后集合恒等）", () => {
  it("全组报文：主表可点提示语集合 == RAW 标注提示语集合（风/变化/能见度/最低能见度/RVR/天气/云/温露/QNH/风切变/趋势）", () => {
    const card = renderCard(
      parse(
        "ZGGG 220400Z 01009MPS 220V310 3000 1200NW R36/M0050D R07R/1800V2200FT -TSRA SCT016 BKN033CB 08/04 Q1021 WS ALL RWY BECMG AT0230 0800 FG TEMPO 1500 SN",
      ),
      { raw: true },
    );
    const ddTitles = new Set(
      [...card.querySelectorAll<HTMLElement>("dd span[data-hint]")].map((n) => n.dataset.hint),
    );
    const rawTitles = new Set(
      [...card.querySelectorAll<HTMLElement>(".mw-raw span[data-hint]")].map((n) => n.dataset.hint),
    );
    // 集合恒等 = 覆盖率与文案双重一致：主表可点的 RAW 必标，RAW 标的主表必可点，文案逐字相同
    expect(ddTitles.size).toBeGreaterThan(10);
    expect(rawTitles).toEqual(ddTitles);
  });

  it("无云电码与 CAVOK 词位同锁：NSC 主表可点（不再是裸文本）、CAVOK 徽章与 RAW 标注同文案", () => {
    const nsc = renderCard(parse("ZGGG 120000Z 27008MPS 9999 NSC 26/22 Q1009 NOSIG"), {
      raw: true,
    });
    const ddTitles = new Set(
      [...nsc.querySelectorAll<HTMLElement>("dd span[data-hint]")].map((n) => n.dataset.hint),
    );
    const rawTitles = new Set(
      [...nsc.querySelectorAll<HTMLElement>(".mw-raw span[data-hint]")].map((n) => n.dataset.hint),
    );
    expect([...ddTitles].some((t) => t?.startsWith("NSC："))).toBe(true);
    expect(rawTitles).toEqual(ddTitles);
    const cavok = renderCard(parse("METAR USTR 120930Z 17006MPS CAVOK 23/10 Q1008"), {
      raw: true,
    });
    const cavokDdTitles = new Set(
      [...cavok.querySelectorAll<HTMLElement>("dd span[data-hint], h2 span[data-hint]")].map(
        (n) => n.dataset.hint,
      ),
    );
    const cavokRawTitles = new Set(
      [...cavok.querySelectorAll<HTMLElement>(".mw-raw span[data-hint]")].map(
        (n) => n.dataset.hint,
      ),
    );
    expect(cavokRawTitles).toEqual(cavokDdTitles);
    // CAVOK 标注提示语 = 徽章同一句（cavokHint）
    expect([...cavokRawTitles].some((t) => t?.startsWith("CAVOK："))).toBe(true);
  });
});

describe("转换说明气泡的规范依据行（每组族标注规范名称/版本/条款号/简要内容，供用户核查原文）", () => {
  it("风组气泡：逐行解码后附「依据：… FM 15 §15.5.1」；换组点击依据随组切换不串行", () => {
    const card = renderCard(
      parse("METAR ZBAA 121253Z 30015KT 9999 FEW010 SCT020 21/12 Q1013 NOSIG"),
      { raw: true },
    );
    const windText = clickHintText(card, rawSpanByTitle(card, "风："));
    expect(windText).toContain("依据：");
    expect(windText).toContain("2019 年版");
    expect(windText).toContain("FM 15 §15.5.1");
    expect(windText).toContain("10 分钟平均风向");
    // 历史依据不残留：换点趋势组后只带本组依据（§15.14），风组依据（§15.5.1）已清空
    expect(windText).not.toContain("§15.14");
    const trendText = clickHintText(
      card,
      [...card.querySelectorAll<HTMLElement>("dd span.mw-hint")].find((s) =>
        s.getAttribute("aria-label")?.startsWith("NOSIG"),
      ),
    );
    expect(trendText).toContain("FM 15 §15.14");
    expect(trendText).not.toContain("§15.5.1");
  });

  it("CAVOK 徽章引 §15.10、能见度组引 §15.6——各族依据各归其位", () => {
    const cavok = renderCard(parse("METAR ZBAA 110700Z VRB02MPS CAVOK 25/10 Q1019"), {});
    expect(clickHintText(cavok, cavok.querySelector<HTMLElement>("h2 .mw-hint"))).toContain(
      "§15.10",
    );
    const vis = renderCard(parse("ZBAA 121253Z 30015KT 8000 FEW010 12/02 Q1013"), {
      raw: true,
    });
    const visText = clickHintText(vis, rawSpanByTitle(vis, "能见度："));
    expect(visText).toContain("§15.6.1");
    expect(visText).toContain("9999＝10 km 或以上");
  });

  it("locale:'en' 依据行同步英文化（Basis: … FM 15 §15.5.1）", () => {
    const card = renderCard(parse("ZBAA 121253Z 30015G45KT 9999 FEW010 21/12 Q1013"), {
      locale: "en",
      raw: true,
    });
    const text = clickHintText(card, rawSpanByTitle(card, "Wind:"));
    expect(text).toContain("Basis: ");
    expect(text).toContain("FM 15 §15.5.1");
    expect(text).not.toContain("依据：");
  });

  it("完整性锁：DECODE_CITE_KEYS × 双语全部非空且含规范名与条款号（新组族漏登记依据即红）", () => {
    for (const key of DECODE_CITE_KEYS) {
      expect(DECODE_CITES.zh[key]).toContain("WMO 306");
      expect(DECODE_CITES.zh[key]).toContain("§");
      expect(DECODE_CITES.zh[key].length).toBeGreaterThan(30);
      expect(DECODE_CITES.en[key]).toContain("306");
      expect(DECODE_CITES.en[key]).toContain("§");
      expect(DECODE_CITES.en[key].length).toBeGreaterThan(30);
    }
  });
});

// ---------------------------------------------------------------- 五角色评测修复批（2026-09-15）

describe("renderCard 云底单位（heightUnit / en 缺省英尺）与未知选项校验", () => {
  const BKN = "METAR ZBAA 121253Z 30015KT 9999 BKN035 VV002 12/02 Q1013";

  it("zh 缺省米（民航口径）不回归；显式 heightUnit:'ft' 折英尺", () => {
    const zh = renderCard(parse(BKN));
    const zhRow = [...zh.querySelectorAll("dd")].find((d) => d.textContent?.includes("多云"));
    expect(zhRow?.textContent).toContain("云底约 1067 米");
    const zhFt = renderCard(parse(BKN), { heightUnit: "ft" });
    const zhFtRow = [...zhFt.querySelectorAll("dd")].find((d) => d.textContent?.includes("多云"));
    expect(zhFtRow?.textContent).toContain("云底 3500 英尺");
  });

  it("en 缺省英尺且 VV 随单位；悬停恒双语对照（ft ≈ m）不回归", () => {
    const card = renderCard(parse(BKN), { locale: "en" });
    const vvRow = [...card.querySelectorAll("dd")].find((d) =>
      d.textContent?.includes("vertical visibility"),
    );
    expect(vvRow?.textContent).toContain("vertical visibility 200 ft");
    const hint = [...card.querySelectorAll("dd span")]
      .find((s) => s.getAttribute("aria-label")?.startsWith("BKN035"))
      ?.getAttribute("aria-label");
    expect(hint).toContain("base 3500 ft ≈ 1067 m");
  });

  it("未知选项运行时抛错（拼写错误不静默）", () => {
    expect(() =>
      renderCard(parse(BKN), { heigthUnit: "ft" } as unknown as RenderCardOptions),
    ).toThrow(/heigthUnit/);
    expect(() => renderCard(parse(BKN), { locale: "jp" } as unknown as RenderCardOptions)).toThrow(
      /locale/,
    );
  });

  it("时区单制：缺省 UTC 原样；utcOffsetMinutes:480 观测时刻行显京钟（真实月历带月位，龄期仍按 UTC 观测算）", () => {
    const T = "METAR ZBAA 110700Z VRB02MPS CAVOK 25/10 Q1019 NOSIG";
    const utc = renderCard(parse(T));
    expect(utc.querySelector(".mw-time")?.textContent).toContain("11日 07:00 UTC");
    const bj = renderCard(parse(T), {
      utcOffsetMinutes: 480,
      now: new Date(Date.UTC(2026, 8, 11, 7, 40)),
    });
    const timeText = bj.querySelector(".mw-time")?.textContent ?? "";
    expect(timeText).toContain("北京时9月11日 15:00");
    expect(timeText).toContain("40 分钟前"); // 观测 07:00Z、now 07:40Z——龄期不随展示时区换算
  });

  it("月界批（2026-09-24 评测 P1）：北京时制经真实月历换算——9/30 16:00Z 显示「北京时10月1日 00:00」而非「31日」回绕", () => {
    const T = "METAR ZBAA 301600Z VRB02MPS CAVOK 25/10 Q1019 NOSIG";
    const bj = renderCard(parse(T), {
      utcOffsetMinutes: 480,
      now: new Date(Date.UTC(2026, 8, 30, 16, 10)),
    });
    expect(bj.querySelector(".mw-time")?.textContent).toContain(
      "北京时10月1日 00:00（UTC 9月30日）",
    );
  });

  it("双日界引用：METAR 观测行 BJ 跨日括注 UTC 日号；同日不括注", () => {
    const same = renderCard(parse("METAR ZBAA 110700Z VRB02MPS CAVOK 25/10 Q1019 NOSIG"), {
      utcOffsetMinutes: 480,
      now: new Date(Date.UTC(2026, 8, 11, 7, 40)),
    });
    expect(same.querySelector(".mw-time")?.textContent).not.toContain("UTC");
  });
});

describe("renderCard 严重度钩子与斜杠时段展示（2026-09-16 五方评测反馈回归锁）", () => {
  it("告警 li 按严重度携带 mw-info / mw-warning class（下游 CSS 分流挂点）", () => {
    const r = parse("ZSSS 120900Z 00000KT /////KT BKN/// 15/12 Q10054");
    const card = renderCard(r, { raw: true });
    expect(card.querySelector(".mw-warnings li.mw-warning")).not.toBeNull();
  });

  it("斜杠时段（DDHH/DDHH）趋势行展示「自 X 日 X 时至 X 日 X 时」；en 为 from/to", () => {
    const r = parse(
      "ZBAA 121200Z 32005KT 9999 FEW030 18/09 Q1013 TEMPO 1616/1618 3000 TSRA BKN020CB",
    );
    const zh = renderCard(r, { locale: "zh" });
    expect(zh.textContent).toContain("自 16 日 16:00 至 16 日 18:00");
    const en = renderCard(r, { locale: "en" });
    expect(en.textContent).toContain("from day 16 16:00 to day 16 18:00");
  });
});

// ---------------------------------------------------------------- TAF 卡片（渲染层②）

import { renderTafCard } from "./taf-card";
import { parseTaf } from "@metweave/parser";

describe("renderTafCard（v0.2 渲染层②）", () => {
  const golden =
    "TAF ZPPP 251518Z 2518/2624 04009G16MPS 9999 SCT023 BKN033 TX02/2518Z TNM02/2523Z TNM04/2623Z TEMPO 2520/2524 2500 -SHRASN BR BECMG 2605/2606 2000 -SN BR BECMG 2609/2610 04004MPS BECMG 2611/2612 4000 BR=";

  it("双日界引用：BJ 制下跨日端点括注 UTC 日号（有效期起端 25日18Z→北京时 26 日，引 UTC 25 日）；止端 26日24Z≡27日00Z 同 UTC 日不括注；发布行同日不括注；UTC 制恒无", () => {
    const bj = renderTafCard(parseTaf(golden), {
      utcOffsetMinutes: 480,
      monthAnchor: { year: 2026, month: 9 },
    });
    const text = bj.textContent ?? "";
    expect(text).toContain("北京时9月26日 02:00（UTC 9月25日）"); // 有效期起端（25 日 18Z，BJ 已跨到 26 日）
    expect(text).toContain("至 北京时9月27日 08:00（北京时"); // 止端（26日24Z≡27日00Z）同 UTC 日——不带括注
    expect(text).toContain("发布 北京时9月25日 23:18有效期"); // 发布行同日——不带括注
    const utc = renderTafCard(parseTaf(golden));
    expect(utc.textContent ?? "").not.toContain("UTC 9月");
  });

  it("头行与元信息：站名/TAF 徽章/有效期+42h 时长/发布时刻", () => {
    const card = renderTafCard(parseTaf(golden));
    const text = card.textContent ?? "";
    expect(card.querySelector("h2")?.textContent).toContain("ZPPP");
    expect(card.querySelector(".mw-taf-badge")?.textContent).toContain("TAF");
    // 五轮：发布在前（报文语序）、有效期区间化（26日24时→27日00:00 午夜特例换算）、时长保留；
    // 时区单制：缺省 UTC，不再有京时括注
    expect(text.indexOf("发布 25日15:18Z")).toBeLessThan(text.indexOf("有效期"));
    expect(text).toContain("自 25日 18:00Z");
    expect(text).toContain("至 27日 00:00Z");
    expect(text).toContain("（UTC，30 小时）");
    expect(text).toContain("30 小时"); // 2518→2624：(26-25)×24+(24-18)=30h（B2 止时 24 进算术）
  });

  it("发布|预报双列行：at 在位时同行左右两列，at 缺席仅发布单行", () => {
    const two = renderTafCard(parseTaf(golden), { at: { day: 25, hour: 21, minute: 0 } });
    const row = two.querySelector(".mw-taf-meta-row");
    expect(row).not.toBeNull();
    const spans = Array.from(row?.querySelectorAll("span") ?? []);
    expect(spans.length).toBe(2);
    expect(spans[0]?.textContent).toContain("发布 25日15:18Z");
    expect(spans[1]?.textContent).toBe("查看时刻 25日21:00Z");
    const one = renderTafCard(parseTaf(golden));
    expect(one.querySelectorAll(".mw-taf-meta-row span")).toHaveLength(1); // 无 at 仅发布单列
    expect(one.textContent).toContain("发布 25日15:18Z");
    expect(one.textContent).not.toContain("查看时刻");
  });

  it("气温极值：置于分段上方，高温/低温分行（多组并列一行），负值 M 前缀", () => {
    const card = renderTafCard(parseTaf(golden));
    expect(card.querySelectorAll(".mw-taf-strip")).toHaveLength(0); // 四轮移除
    const lines = Array.from(card.querySelectorAll(".mw-taf-temp-line"));
    expect(lines.length).toBe(3); // 复测修复：多组逐值一行——TX02 一行、TNM02/TNM04 各一行
    const labels = lines.map((x) => x.querySelector(".mw-taf-item-label")?.textContent);
    expect(labels).toEqual(["高温", "低温", ""]);
    expect(lines[0]?.textContent).toContain("2°C @ 25日18Z");
    expect(lines[1]?.textContent).toContain("-2°C @ 25日23Z");
    expect(lines[2]?.textContent).toContain("-4°C @ 26日23Z"); // 双 TN 各占一行
    // 位置：气温区在分段天气之前
    const children = Array.from(card.children);
    expect(children.findIndex((c) => c.classList.contains("mw-taf-temps"))).toBeLessThan(
      children.findIndex((c) => c.classList.contains("mw-taf-periods")),
    );
  });

  it("分段天气明细：基况/TEMPO/渐变中/转变后逐段人话，电码入悬停（专业/小白双受众）", () => {
    const card = renderTafCard(parseTaf(golden));
    const rows = Array.from(card.querySelectorAll(".mw-taf-period"));
    expect(card.textContent).toContain("分段天气");
    // 1 基况 + 1 TEMPO + 3×(渐变中+转变后) = 8 段
    expect(rows.length).toBe(8);
    const chips = rows.map((r) => r.querySelector(".mw-taf-k")?.textContent ?? "");
    expect(chips).toEqual([
      "主要天气",
      "TEMPO·间歇（概率≥40%）",
      "BECMG·渐变中",
      "BECMG·转变后",
      "BECMG·渐变中",
      "BECMG·转变后",
      "BECMG·渐变中",
      "BECMG·转变后",
    ]);
    const text = card.textContent ?? "";
    // 人话：TEMPO 发作态（2500 m 小阵雨夹雪轻雾）/ 过渡带「转为」+ 不确定注 / 未列要素回溯
    expect(text).toContain("2500 m");
    expect(text).toContain("小阵雨、雪");
    expect(text).toContain("转为：");
    expect(text).toContain("2000 m");
    expect(text).toContain("转变时刻不确定");
    // 电码通道改行头浮签（2026-09-24 评测 P1 键盘批：title 原生气泡键盘不可达且与浮签双气泡，退役）；
    // 行头带 data-code（focus/悬停浮签显电码——键盘 Tab 可达），读屏读人话正文不变
    expect(rows[0]?.getAttribute("title")).toBeNull();
    const head0 = rows[0]?.querySelector<HTMLElement>(".mw-taf-period-head");
    expect(head0?.dataset.code ?? "").toContain("04009G16MPS");
    expect(head0?.dataset.code ?? "").toContain("9999");
    const head1 = rows[1]?.querySelector<HTMLElement>(".mw-taf-period-head");
    expect(head1?.dataset.code ?? "").toContain("2500 -SHRASN BR");
    expect(rows[0]?.getAttribute("aria-label")).toBeNull(); // 电码只走 data-code 浮签（读屏读人话正文——评测工程 P0-2）
  });

  it("就地电码浮签", () => {
    const card = renderTafCard(parseTaf(golden), { raw: true });
    // 基况「风」条目 → 风组整组 token 跨度；「能见度」→ 9999
    const items = Array.from(card.querySelectorAll<HTMLElement>(".mw-taf-item[data-code]"));
    const codeOf = (label: string): string | undefined =>
      items.find((x) => x.querySelector(".mw-taf-item-label")?.textContent === label)?.dataset.code;
    expect(codeOf("风")).toBe("04009G16MPS");
    expect(codeOf("能见度")).toBe("9999");
    // 行为锁：悬停带 data-code 的条目 → 浮签显示其电码；离开 → 隐藏（丢 showCodeChip 接线即红）
    const chip = card.querySelector<HTMLElement>(".mw-taf-codechip");
    expect(chip).not.toBeNull();
    expect(chip?.style.display ?? "").toBe(""); // 静息由 CSS 类隐藏（display:none 在样式表），内联未动
    const wind = items.find(
      (x) => x.querySelector(".mw-taf-item-label")?.textContent === "风",
    ) as HTMLElement;
    wind.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
    expect(chip?.style.display).not.toBe("none");
    expect(chip?.textContent).toBe("04009G16MPS");
    wind.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
    expect(chip?.style.display).toBe("none");
    // 样式契约：浮签绝对定位（不进文档流——零占位零回流）、挡不住悬停链
    const css = document.querySelector("#mw-taf-card-style")?.textContent ?? "";
    const chipRule = css.split(".mw-taf-codechip {")[1]?.split("}")[0] ?? "";
    expect(chipRule).toContain("position: absolute");
    expect(chipRule).toContain("pointer-events: none");
    expect(css).not.toContain("[data-code]:hover::after"); // 旧内联显码方案不得回流
    // 联动语言契约：点亮＋浮签、不做压暗——mw-taf-dim 不得回流
    expect(css).not.toContain("mw-taf-dim");
  });

  it("点击解码气泡：条目点击弹「电码→人话」逐行 + FM 51 依据行，再点收起、点空白处收起", () => {
    const card = renderTafCard(parseTaf(golden), { raw: true });
    const bubble = card.querySelector<HTMLElement>(".mw-taf-decode");
    expect(bubble).not.toBeNull();
    const items = Array.from(card.querySelectorAll<HTMLElement>(".mw-taf-item[data-code]"));
    const byLabel = (label: string): HTMLElement => {
      const hit = items.find((x) => x.querySelector(".mw-taf-item-label")?.textContent === label);
      if (hit === undefined) throw new Error(`无 ${label} 条目`);
      return hit;
    };
    // 风：单行「04009G16MPS → 东北风 5 级…」+ §51.3 依据
    byLabel("风").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const windText = bubble?.textContent ?? "";
    expect(bubble?.style.display).toBe("block");
    expect(windText).toContain("04009G16MPS");
    expect(windText).toContain("东北风 5 级");
    expect(windText).toContain("§51.3");
    // 再点同条目 → 收起
    byLabel("风").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(bubble?.style.display).toBe("none");
    // 云：逐层行（SCT023/BKN033 各一行）+ §51.6 依据
    byLabel("云").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const cloudText = bubble?.textContent ?? "";
    expect(bubble?.style.display).toBe("block");
    expect(cloudText).toContain("SCT023");
    expect(cloudText).toContain("BKN033");
    expect(cloudText).toContain("§51.6");
    // 点空白处（分段标题）→ 收起
    card
      .querySelector(".mw-taf-periods-title")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(bubble?.style.display).toBe("none");
  });

  it("RAW 对照（独立盒区置底、气温行在其上）+ 组级联动：悬停「天气」只点亮天气组片，反向亦然", () => {
    const card = renderTafCard(parseTaf(golden), { raw: true });
    const rawP = card.querySelector(".mw-taf-raw");
    expect(rawP).not.toBeNull();
    const segs = Array.from(card.querySelectorAll(".mw-taf-rawseg"));
    // 有效期 1 + 基况 4 + 变化组 4 整组 + 变化组内要素子片 9（TEMPO 3/BECMG1 3/BECMG2 1/BECMG3 2）+ 气温 3
    expect(segs.length).toBe(21);
    // 版式序：气温极值行在 RAW 之前
    const children = Array.from(card.children);
    const tempsAt = children.findIndex((c) => c.classList.contains("mw-taf-temps"));
    const rawAt = children.findIndex((c) => c.classList.contains("mw-taf-raw"));
    expect(tempsAt).toBeGreaterThanOrEqual(0);
    expect(tempsAt).toBeLessThan(rawAt);
    // 组级联动：TEMPO 行「天气」条目悬停 → 只点亮该组天气子片（-SHRASN/BR），不点亮基况风组
    const rows = Array.from(card.querySelectorAll(".mw-taf-period"));
    const tempoWxItem = Array.from(rows[1]?.querySelectorAll(".mw-taf-item") ?? []).find(
      (x) => (x.querySelector(".mw-taf-item-label")?.textContent ?? "") === "天气",
    );
    expect(tempoWxItem).toBeDefined();
    const shrasn = segs.find((x) => (x.textContent ?? "") === "-SHRASN"); // 精确匹配子片（整组 span 文本也含 SHRASN）
    const brInTempo = segs.filter((x) => (x.textContent ?? "") === "BR");
    const baseWind = segs.find((x) => (x.textContent ?? "").startsWith("04009"));
    expect(shrasn).toBeDefined();
    expect(baseWind).toBeDefined();
    tempoWxItem?.dispatchEvent(new MouseEvent("mouseenter"));
    expect(shrasn?.classList.contains("mw-taf-hl")).toBe(true);
    expect(brInTempo.every((x) => x.classList.contains("mw-taf-hl"))).toBe(false); // 基况 BR ≠ TEMPO 组内 BR，不串亮
    expect(baseWind?.classList.contains("mw-taf-hl")).toBe(false);
    tempoWxItem?.dispatchEvent(new MouseEvent("mouseleave"));
    expect(shrasn?.classList.contains("mw-taf-hl")).toBe(false);
    // 反向：悬停 -SHRASN 片 → 点亮 TEMPO 行「天气」条目
    shrasn?.dispatchEvent(new MouseEvent("mouseenter"));
    expect(tempoWxItem?.classList.contains("mw-taf-hl")).toBe(true);
    shrasn?.dispatchEvent(new MouseEvent("mouseleave"));
    // 行头悬停 → 该行全部片（整组+子片）点亮
    const tempoGroup = segs.find((x) => (x.textContent ?? "").startsWith("TEMPO"));
    rows[1]?.querySelector(".mw-taf-period-head")?.dispatchEvent(new MouseEvent("mouseenter"));
    expect(tempoGroup?.classList.contains("mw-taf-hl")).toBe(true);
    // 悬停原文片的人话（title——TAF RAW 片保留原生气泡，专业通道既有决策）＝该组行文本
    expect(shrasn?.getAttribute("title") ?? "").toContain("小阵雨、雪");
  });

  it("分段色点与要素标签（小白直观面）：TEMPO 雷雨行红点、基况行绿点，要素带标签", () => {
    const card = renderTafCard(
      parseTaf(
        "TAF ZGSZ 230303Z 2306/2412 21004MPS 8000 BKN040 TEMPO 2306/2309 TSRA FEW020CB BKN040=",
      ),
    );
    const rows = Array.from(card.querySelectorAll(".mw-taf-period"));
    expect(rows[0]?.querySelector(".mw-taf-dot")?.classList.contains("mw-taf-dot-good")).toBe(true);
    expect(rows[1]?.querySelector(".mw-taf-dot")?.classList.contains("mw-taf-dot-danger")).toBe(
      true,
    );
    const labels = Array.from(rows[0]?.querySelectorAll(".mw-taf-item-label") ?? []).map(
      (x) => x.textContent,
    );
    expect(labels).toEqual(["风", "能见度", "云"]);
  });

  it("评测批新增：站名行/出界提示/风险摘要行/行档位左边条/京时括注链（三角色共识①③⑤+签派 P1-3）", () => {
    const raw =
      "TAF ZGSZ 230303Z 2306/2412 21004MPS 8000 BKN040 TEMPO 2306/2309 TSRA FEW020CB BKN040=";
    const card = renderTafCard(parseTaf(raw), {
      at: { day: 23, hour: 3, minute: 0 },
      stationTitle: "ZGSZ 深圳/宝安",
    });
    expect(card.querySelector(".mw-taf-station")?.textContent).toBe("ZGSZ 深圳/宝安");
    // 出界：03Z 早于有效期 06Z → 琥珀提示
    expect(card.textContent).toContain("查看时刻早于本预报开始时间");
    expect(card.textContent).toContain("（所示为 23日03:03Z 发布的报文）"); // 时间倒错过渡说明（复测签派 N1）
    // 风险摘要：TEMPO 雷暴段置顶
    const risk = card.querySelector(".mw-taf-risk");
    expect(risk?.textContent).toContain("关键风险");
    expect(risk?.textContent).toContain("雷暴伴雨");
    expect(risk?.textContent).toContain("23日06Z–23日09Z");
    // TEMPO 行档位左边条（TSRA+CB → danger）
    const rows = Array.from(card.querySelectorAll(".mw-taf-period"));
    expect(rows[1]?.classList.contains("mw-taf-period-danger")).toBe(true);
    expect(rows[0]?.classList.contains("mw-taf-period")).toBe(true);
    // 京时单制链：传 480 时全卡只显京时——发布/查看/有效期/风险行/分段行头同一维度
    const bj = renderTafCard(parseTaf(raw), {
      at: { day: 23, hour: 3, minute: 0 },
      utcOffsetMinutes: 480,
    });
    const bjText = bj.textContent ?? "";
    expect(bjText).toContain("发布 北京时23日11:03");
    expect(bjText).toContain("查看时刻 北京时23日11:00");
    expect(bjText).toContain("自 北京时23日14:00 至 北京时24日20:00（北京时，30 小时）");
    expect(bjText).toContain("北京时23日14:00–23日17:00"); // TEMPO 段头（风险行同格式；批4#18 尾端前缀收敛）
    expect(bjText).not.toMatch(/\d{2}Z/); // 无 UTC 残留（单制互斥锁）
    // UTC 缺省卡：无任何京字
    const text = card.textContent ?? "";
    expect(text).toContain("查看时刻 23日03:00Z");
    expect(text).not.toContain("京");
  });

  it("复测修复：条目不入 Tab 序（行头代表段），行头/原文片可聚焦（工程 N3 简版）", () => {
    const card = renderTafCard(parseTaf(golden), { raw: true });
    const items = Array.from(card.querySelectorAll(".mw-taf-item"));
    expect(items.length).toBeGreaterThan(4);
    for (const item of items) expect(item.getAttribute("tabindex")).toBeNull(); // 条目仅悬停通道
    const head = card.querySelector(".mw-taf-period-head");
    expect(head?.getAttribute("tabindex")).toBe("0"); // 行头＝段聚焦点
    const seg = card.querySelector(".mw-taf-rawseg");
    expect(seg?.getAttribute("tabindex")).toBe("0"); // 原文片保留（专业面反向通道）
  });

  it("评测批新增：小白人话包——风向方位+蒲福风级、云底台阶化逐层分行（小白#6/#7）", () => {
    const card = renderTafCard(
      parseTaf("TAF ZLXY 230301Z 2306/2406 06003MPS 3000 BR FEW030 OVC060="),
    );
    const text = card.textContent ?? "";
    expect(text).toContain("东北风 2 级（60° 3 mps）");
    // G 阵风（评测签派 P2-3 样例覆盖：阵风直接关系侧风标准）
    const g = renderTafCard(parseTaf("TAF ZBAA 230301Z 2306/2412 04009G16MPS 9999 SCT030="));
    expect(g.textContent).toContain("（阵风 16）");
    expect(text).toContain("少云，云底约 900 米");
    expect(text).toContain("阴，云底约 1800 米"); // 1829 → 台阶化 1800，两层各一条
    const cloudItems = Array.from(card.querySelectorAll(".mw-taf-item")).filter(
      (x) => (x.querySelector(".mw-taf-item-label")?.textContent ?? "") === "云",
    );
    expect(cloudItems.length).toBe(2);
  });

  it("评测批新增：PROB 徽章双标与概率、CNL 卡、CAVOK 段、未知选项运行时抛错（签派 P1-2/工程 P1-4/P2-3）", () => {
    const prob = renderTafCard(
      parseTaf(
        "TAF ZPPP 251518Z 2518/2624 04009MPS 9999 SCT023 PROB30 TEMPO 2520/2524 2500 -SHRA=",
      ),
    );
    expect(prob.textContent).toContain("PROB30 TEMPO·概率间歇");
    const probOnly = renderTafCard(
      parseTaf("TAF ZPPP 251518Z 2518/2624 04009MPS 9999 SCT023 PROB40 2520/2524 2500 RA="),
    );
    expect(probOnly.textContent).toContain("PROB40·概率40%");
    const cnl = renderTafCard(parseTaf("TAF ZWWW 231200Z 2312/2412 CNL="));
    expect(cnl.querySelector(".mw-taf-outrange")?.textContent).toContain("预报取消");
    const cavok = renderTafCard(parseTaf("TAF ZBAA 230301Z 2306/2412 18004MPS CAVOK="));
    expect(cavok.textContent).toContain("能见度佳、低云与天气无碍（CAVOK）");
    expect(() =>
      renderTafCard(parseTaf("TAF ZBAA 230301Z 2306/2412 18004MPS="), { locael: "zh" } as never),
    ).toThrow("未知选项");
  });

  it("分段人话与 METAR 卡同源（gloss 词表单一来源）：TSRA 两卡同短语、无变化组报文也给基况行", () => {
    const tafCard = renderTafCard(
      parseTaf(
        "TAF ZGSZ 230303Z 2306/2412 21004MPS 8000 BKN040 TEMPO 2306/2309 TSRA FEW020CB BKN040=",
      ),
    );
    expect(tafCard.textContent).toContain("雷暴伴雨（飞行威胁大）");
    const metarCard = renderCard(
      parse("METAR ZGSZ 230300Z 21004MPS 8000 TSRA FEW020CB BKN040 27/22 Q1010="),
    );
    expect(metarCard.textContent).toContain("雷暴伴雨");
    // 无变化组：单基况行 + 具体天气（9999 → ≥10 km）
    const plain = renderTafCard(parseTaf("TAF ZBAA 230301Z 2306/2412 18004MPS 3500 BR NSC="));
    const rows = plain.querySelectorAll(".mw-taf-period");
    expect(rows.length).toBe(1);
    expect(rows[0]?.textContent).toContain("3500 m");
    expect(rows[0]?.textContent).toContain("轻雾");
    expect(rows[0]?.textContent).toContain("无显著云");
  });

  it("AMD/COR 标志、NIL 最小卡、en locale 与 RAW 对照", () => {
    const amd = renderTafCard(parseTaf("TAF AMD ZBAA 010340Z 0106/0206 17004MPS="));
    expect(amd.querySelector(".mw-taf-flag")?.textContent).toContain("修订");
    const nil = renderTafCard(parseTaf("TAF ZSAM NIL="));
    expect(nil.textContent).toContain("缺报（NIL）");
    expect(nil.querySelector(".mw-taf-periods")).toBeNull();
    const en = renderTafCard(parseTaf(golden), { locale: "en", raw: true });
    expect(en.querySelector(".mw-taf-badge")?.textContent).toContain("Forecast");
    expect(en.textContent).toContain("30 h");
    expect(en.querySelector(".mw-taf-raw")?.textContent).toContain(golden.slice(0, 20));
  });

  it("版式契约：卡宽 480 / 卡高上限 min(65vh, 680px) 内滚 / 分段行间距 7px", () => {
    renderTafCard(parseTaf(golden), { raw: true });
    const css = document.querySelector("#mw-taf-card-style")?.textContent ?? "";
    // 卡片本体：加宽 + 限高（超高不再占满整屏/被视口裁顶）+ 超高内容卡内上下滚动
    const cardRule = css.split(".mw-taf-card {")[1]?.split("}")[0] ?? "";
    expect(cardRule).toContain("max-width: 480px");
    expect(cardRule).toContain("max-height: min(65vh, 680px)");
    expect(cardRule).toContain("overflow-y: auto");
    // 分段行：段与段保留间距不贴死；首段无分隔线沿旧例，末段不吃尾距
    const periodRule = css.split(".mw-taf-period {")[1]?.split("}")[0] ?? "";
    expect(periodRule).toContain("margin-bottom: 7px");
    const lastRule = css.split(".mw-taf-period:last-child {")[1]?.split("}")[0] ?? "";
    expect(lastRule).toContain("margin-bottom: 0");
  });
});

// ---------------------------------------------------------------- 2026-09-24 评测 P1 修复批：键盘通道与月界

describe("键盘通道（2026-09-24 评测 P1：两卡契约一致——可聚焦元素 Enter/Space 开合气泡、Esc 关闭、aria 接线）", () => {
  it("METAR 卡：主表词 Enter 开合解码气泡（aria-expanded/aria-describedby 接线）、Space 不再滚动页面、Esc 关闭", () => {
    const card = renderCard(parse("ZBAA 121253Z 30015KT 9999 FEW010 SCT020 21/12 Q1013"), {
      raw: true,
    });
    const bubble = card.querySelector<HTMLElement>(".mw-hint-pop")!;
    const wind = card.querySelector<HTMLElement>("dd span.mw-hint")!;
    expect(wind.getAttribute("tabindex")).toBe("0");
    // Enter 开：span 无原生 click 合成，keydown 显式触发（此前注释宣称 focus 显示气泡、实际无实现）
    wind.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(bubble.classList.contains("mw-hint-on")).toBe(true);
    expect(wind.getAttribute("aria-expanded")).toBe("true");
    expect(wind.getAttribute("aria-describedby")).toBe(bubble.id);
    expect(bubble.id).not.toBe(""); // 气泡经 id 接入读屏
    expect(bubble.textContent).toContain("转换说明");
    // Enter 再按＝收起；aria 状态随关闭摘除
    wind.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(bubble.classList.contains("mw-hint-on")).toBe(false);
    expect(wind.getAttribute("aria-expanded")).toBeNull();
    expect(wind.getAttribute("aria-describedby")).toBeNull();
    // Space 开（默认行为被拦截——不滚动页面）
    const ev = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    wind.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(bubble.classList.contains("mw-hint-on")).toBe(true);
    // Esc 关（焦点在触发元素上）
    wind.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(bubble.classList.contains("mw-hint-on")).toBe(false);
  });

  it("METAR 卡：focusin 联动等价（mouseover 委托之外的键盘通道）——Tab 聚焦词即点亮两侧并显电码浮签", () => {
    const card = renderCard(parse("ZBAA 121253Z 30015KT 9999 FEW010 SCT020 21/12 Q1013"), {
      raw: true,
    });
    const chip = card.querySelector<HTMLElement>(".mw-codechip")!;
    const wind = card.querySelector<HTMLElement>("dd span.mw-hint")!;
    wind.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(wind.classList.contains("mw-link")).toBe(true);
    expect(chip.style.display).not.toBe("none");
    expect(chip.textContent).toContain("30015KT"); // 浮签显 RAW 侧组电码
    wind.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    expect(wind.classList.contains("mw-link")).toBe(false);
    expect(chip.style.display).toBe("none");
  });

  it("TAF 卡：行头 focus 显段电码浮签、Enter 开该行合并解码表（含依据行）、Esc 关闭（条目保持不入 Tab 序）", () => {
    const goldenK =
      "TAF ZPPP 251518Z 2518/2624 04009G16MPS 9999 SCT023 BKN033 TX02/2518Z TNM02/2523Z TNM04/2623Z TEMPO 2520/2524 2500 -SHRASN BR BECMG 2605/2606 2000 -SN BR BECMG 2609/2610 04004MPS BECMG 2611/2612 4000 BR=";
    const card = renderTafCard(parseTaf(goldenK), { raw: true });
    const chip = card.querySelector<HTMLElement>(".mw-taf-codechip")!;
    const bubble = card.querySelector<HTMLElement>(".mw-taf-decode")!;
    const head = card.querySelector<HTMLElement>(".mw-taf-period-head")!;
    const firstItem = card.querySelector<HTMLElement>(".mw-taf-item")!;
    expect(firstItem.getAttribute("tabindex")).toBeNull(); // 条目不入 Tab 序（复测工程 N3 决策保留）
    // focus 行头 → 浮签显该段电码（键盘看得到电码浮签——原 head.title 键盘不可达）
    head.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(chip.style.display).not.toBe("none");
    expect(chip.textContent).toContain("04009G16MPS");
    head.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    expect(chip.style.display).toBe("none");
    // Enter 开合并解码表：本行各条目的「电码→人话」逐行 + FM 51 依据行
    head.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(bubble.style.display).toBe("block");
    expect(bubble.textContent).toContain("04009G16MPS");
    expect(bubble.textContent).toContain("9999");
    expect(bubble.textContent).toContain("FM 51");
    expect(head.getAttribute("aria-expanded")).toBe("true");
    expect(head.getAttribute("aria-describedby")).toBe(bubble.id);
    // Esc 关闭
    head.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(bubble.style.display).toBe("none");
    expect(head.getAttribute("aria-expanded")).toBeNull();
    // 鼠标点击条目仍开其单条气泡（点击契约不变）
    const windItem = [...card.querySelectorAll<HTMLElement>(".mw-taf-item[data-code]")].find((x) =>
      x.textContent?.startsWith("风"),
    )!;
    windItem.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(bubble.style.display).toBe("block");
    expect(bubble.textContent).toContain("04009G16MPS");
    expect(windItem.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("TAF 卡月锚（2026-09-24 评测 P1 月界批：monthAnchor 在位时北京时制走真实月历）", () => {
  it("9 月锚跨月：25日18Z +8h 显示「北京时9月26日 02:00」；30日16Z +8h 显示「北京时10月1日 00:00」而非「31日」回绕", () => {
    const anchor = { year: 2026, month: 9 };
    const a = renderTafCard(parseTaf("TAF ZPPP 251518Z 2518/2624 04009G16MPS 9999 SCT023="), {
      utcOffsetMinutes: 480,
      monthAnchor: anchor,
    });
    // 25日18Z 起效 → 北京时 9月26日 02:00（9 月锚真月历）
    expect(a.textContent).toContain("北京时9月26日 02:00");
    // 连续日序 day=31（锚月起第 31 天＝10 月 1 日）→ 真月历进位不回绕「31日」
    const b = renderTafCard(parseTaf("TAF ZPPP 291518Z 2918/3024 04009G16MPS 9999 SCT023="), {
      utcOffsetMinutes: 480,
      monthAnchor: anchor,
      at: { day: 30, hour: 16, minute: 0 },
    });
    expect(b.textContent).toContain("北京时10月1日 00:00"); // 查看 30日16Z +8h
  });

  it("缺席月锚保持 31 天折回近似（显示位残余，公开面兼容不变）；病态日号（2 月 30 日）守卫回退不静默滑月", () => {
    const noAnchor = renderTafCard(
      parseTaf("TAF ZPPP 251518Z 2518/2624 04009G16MPS 9999 SCT023="),
      {
        utcOffsetMinutes: 480,
      },
    );
    expect(noAnchor.textContent).toContain("北京时26日02:00"); // 旧口径（%31 折回、无月位、无空格）不变
    const feb = renderTafCard(parseTaf("TAF ZPPP 251518Z 2518/2624 04009G16MPS 9999 SCT023="), {
      utcOffsetMinutes: 480,
      monthAnchor: { year: 2027, month: 2 },
    });
    expect(feb.textContent).toContain("北京时2月26日 02:00"); // 合法日号（26 ≤ 28）走真月历
    expect(feb.textContent).not.toContain("3月"); // 越界日号守卫回退折回、不静默滑到下月
  });
});

describe("METAR 卡限高契约（评测批3#10：对齐 TAF 卡——多跑道状态组长卡不超视口）", () => {
  it("样式锁：max-height: min(65vh, 680px) + overflow-y: auto（卡片根已有 position:relative 定位上下文）", () => {
    renderCard(parse("ZBAA 121253Z 30015KT 9999 FEW010 21/12 Q1013"), { raw: true });
    const css = document.querySelector("#mw-card-style")?.textContent ?? "";
    const cardRule = css.split(".mw-card {")[1]?.split("}")[0] ?? "";
    expect(cardRule).toContain("max-height: min(65vh, 680px)");
    expect(cardRule).toContain("overflow-y: auto");
    expect(cardRule).toContain("position: relative");
  });
});

describe("METAR 卡 RAW 区身份行（评测批4#19：与 TAF 卡统一——裸贴电码像乱码报错）", () => {
  it("raw:true 时原文区上方带「报文原文（专业人员核对用）」标题与提示；en 同款；raw 缺省无此行", () => {
    const card = renderCard(parse("ZBAA 121253Z 30015KT 9999 FEW010 21/12 Q1013"), { raw: true });
    expect(card.querySelector(".mw-raw-title")?.textContent).toContain(
      "报文原文（专业人员核对用）",
    );
    expect(card.querySelector(".mw-raw-title")?.textContent).toContain("悬停或 Tab 聚焦");
    const en = renderCard(parse("ZBAA 121253Z 30015KT 9999 FEW010 21/12 Q1013"), {
      locale: "en",
      raw: true,
    });
    expect(en.querySelector(".mw-raw-title")?.textContent).toContain(
      "Raw report (for professional cross-check)",
    );
    const none = renderCard(parse("ZBAA 121253Z 30015KT 9999 FEW010 21/12 Q1013"));
    expect(none.querySelector(".mw-raw-title")).toBeNull();
    expect(none.querySelector(".mw-raw")).toBeNull();
  });
});

describe("月锚进位（2026-09-24 UI 复验收口：连续序 day 超锚月长度曾被月吻合守卫误判病态回退折回）", () => {
  it("9 月锚 day=31（连续序第 31 天＝10 月 1 日）显示「10月1日」而非回退「31日」无月位折回", () => {
    const card = renderTafCard(parseTaf("TAF ZPPP 251518Z 2518/2624 04009G16MPS 9999 SCT023="), {
      utcOffsetMinutes: 480,
      monthAnchor: { year: 2026, month: 9 },
      at: { day: 31, hour: 10, minute: 0 },
    });
    expect(card.textContent).toContain("查看时刻 北京时10月1日 18:00");
  });
});
