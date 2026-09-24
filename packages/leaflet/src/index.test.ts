// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import * as L from "leaflet";
import { parse, parseTaf } from "@metweave/parser";
import {
  addMetarLayer,
  addTafLayer,
  createTafTimeControl,
  setTafLayerTime,
  type AddTafLayerOptions,
  type TafLayerItem,
} from "./index";

const report = parse("METAR ZBAA 110700Z VRB02MPS CAVOK 25/10 Q1019 NOSIG");

describe("addMetarLayer 冒烟（真实 leaflet + happy-dom）", () => {
  it("marker 数量、tooltip 文案、弹窗内报文卡片", async () => {
    document.body.innerHTML = '<div id="map"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = await addMetarLayer(map, [
      { report, position: [40.0, 116.6], title: "ZBAA 北京" },
      { report, position: [31.2, 121.5] },
    ]);

    const layers = group.getLayers();
    expect(layers.length).toBe(2);

    const first = layers[0];
    if (!(first instanceof L.Marker)) throw new Error("图层成员应为 Marker");
    const firstContent = first.getTooltip()?.getContent();
    expect(firstContent).toBeInstanceOf(HTMLElement);
    if (firstContent instanceof HTMLElement) expect(firstContent.textContent).toBe("ZBAA 北京");
    // 缺省 title 回退 IR 站名
    const second = layers[1];
    if (!(second instanceof L.Marker)) throw new Error("图层成员应为 Marker");
    const secondContent = second.getTooltip()?.getContent();
    expect(secondContent).toBeInstanceOf(HTMLElement);
    if (secondContent instanceof HTMLElement) expect(secondContent.textContent).toBe("ZBAA");

    const popupContent = first.getPopup()?.getContent();
    expect(popupContent).toBeInstanceOf(HTMLElement);
    if (popupContent instanceof HTMLElement) {
      expect(popupContent.classList.contains("mw-card")).toBe(true);
      expect(popupContent.textContent).toContain("ZBAA");
      expect(popupContent.textContent).toContain("CAVOK");
    }

    map.remove();
  });

  it("popup:false 时不绑定弹窗", async () => {
    document.body.innerHTML = '<div id="map"></div>';
    const map = L.map("map");
    const group = await addMetarLayer(map, [{ report, position: [40, 116] }], { popup: false });
    const first = group.getLayers()[0];
    if (!(first instanceof L.Marker)) throw new Error("图层成员应为 Marker");
    expect(first.getPopup()).toBeUndefined();
    map.remove();
  });

  it("title 注入面：恶意串按字面文本渲染——非 HTML 路径，不产生元素节点", async () => {
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const evil = '<img src=x onerror="alert(1)"><script>alert(2)<\u002fscript>';
    const group = await addMetarLayer(map, [{ report, position: [40, 116], title: evil }]);
    const marker = group.getLayers()[0];
    if (!(marker instanceof L.Marker)) throw new Error("图层成员应为 Marker");

    // 渲染实证：打开 tooltip 后 DOM 内无 img/script 元素、原文以字面文本出现
    marker.openTooltip();
    const tooltipEl = marker.getTooltip()?.getElement();
    expect(tooltipEl?.querySelector("img")).toBeNull();
    expect(tooltipEl?.querySelector("script")).toBeNull();
    expect(tooltipEl?.textContent).toContain('<img src=x onerror="alert(1)">');
    map.remove();
  });
});

describe("A 批：marker 可访问名称（WCAG 4.1.2）", () => {
  it("marker 图标携带 alt=站点名——title 优先、缺省回落 IR 站名（role=button 获名）", async () => {
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = await addMetarLayer(map, [
      { report, position: [40.0, 116.6], title: "ZBAA 北京" },
      { report, position: [31.2, 121.5] },
    ]);
    const first = group.getLayers()[0];
    const second = group.getLayers()[1];
    if (!(first instanceof L.Marker) || !(second instanceof L.Marker)) {
      throw new Error("图层成员应为 Marker");
    }
    // Leaflet 把 options.alt 写入图标 img 的 alt 属性
    expect(first.getElement()?.getAttribute("alt")).toBe("ZBAA 北京");
    expect(second.getElement()?.getAttribute("alt")).toBe("ZBAA");
    map.remove();
  });
});

describe("C5：四档气象着色与 tooltip 要素摘要（conditionColors）", () => {
  const tierCases = [
    // good（绿）：好天与 CAVOK
    { raw: "ZGGG 120000Z 27008KT 9999 SCT030 26/22 Q1009", tier: "good", color: "#3aa657" },
    { raw: "ZGGG 120000Z 27008KT CAVOK 26/22 Q1009", tier: "good", color: "#3aa657" },
    // caution（琥珀）：能见度 1500–5000（国内口径）/ 云底 1000–3000 / 降水族 / 阵风 15–25 m/s
    { raw: "ZGGG 120000Z 27008KT 3000 SCT030 26/22 Q1009", tier: "caution", color: "#e0a13c" },
    { raw: "ZGGG 120000Z 27008KT 4900 SCT030 26/22 Q1009", tier: "caution", color: "#e0a13c" },
    { raw: "ZGGG 120000Z 27008KT 9999 BKN020 26/22 Q1009", tier: "caution", color: "#e0a13c" },
    { raw: "ZGGG 120000Z 27008KT 9999 -RA SCT030 26/22 Q1009", tier: "caution", color: "#e0a13c" },
    { raw: "ZGGG 120000Z 27008G40KT 9999 SCT030 26/22 Q1009", tier: "caution", color: "#e0a13c" },
    // poor（红）：能见度 <1500 / 云底 <1000 / TS 族好能见度 / GR / FZ 冻降水族 / CB / + 显著降水 / 阵风 ≥25 m/s / 跑道关闭
    { raw: "ZGGG 120000Z 27008KT 0800 BKN030 26/22 Q1009", tier: "poor", color: "#d05656" },
    { raw: "ZGGG 120000Z 27008KT 9999 BKN005 26/22 Q1009", tier: "poor", color: "#d05656" },
    { raw: "ZGGG 120000Z 27008KT 9999 TSRA SCT030 26/22 Q1009", tier: "poor", color: "#d05656" },
    { raw: "ZGGG 120000Z 27008KT 9999 FZRA SCT030 26/22 Q1009", tier: "poor", color: "#d05656" },
    { raw: "ZGGG 120000Z 27008KT 9999 GR SCT030 26/22 Q1009", tier: "poor", color: "#d05656" },
    { raw: "ZGGG 120000Z 27008KT 9999 SCT030CB 26/22 Q1009", tier: "poor", color: "#d05656" },
    { raw: "ZGGG 120000Z 27008KT 9999 +SHRA SCT030 26/22 Q1009", tier: "poor", color: "#d05656" },
    { raw: "ZGGG 120000Z 27008G50KT 9999 SCT030 26/22 Q1009", tier: "poor", color: "#d05656" },
    {
      raw: "ZGGG 120000Z 27008KT 9999 SCT030 26/22 Q1009 R/SNOCLO",
      tier: "poor",
      color: "#d05656",
    },
    // unknown（灰）：NIL 与关键组全缺测（能见度与云均缺测且天气缺测/无）
    { raw: "METAR ZBAA 120300Z NIL=", tier: "unknown", color: "#8a94a0" },
    {
      raw: "CWLI 120900Z AUTO ///// ////SM ////// 09/08 A2961 RMK WND MISG VIS MISG CLD MISG",
      tier: "unknown",
      color: "#8a94a0",
    },
  ];

  it("四档判据落色（unknown/poor/caution/good 圆点 divIcon）——TS 好能见度不再绿、CB 红、阵风升档", async () => {
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = await addMetarLayer(
      map,
      tierCases.map((c) => ({ report: parse(c.raw), position: [40, 116] })),
      { conditionColors: true },
    );
    for (const [i, c] of tierCases.entries()) {
      const marker = group.getLayers()[i];
      if (!(marker instanceof L.Marker)) throw new Error("图层成员应为 Marker");
      const dot = marker.getElement()?.querySelector(".mw-dot");
      expect(dot, c.raw).toBeDefined();
      expect(dot?.classList.contains(`mw-dot-${c.tier}`), `${c.raw} 应判 ${c.tier}`).toBe(true);
      expect(dot?.getAttribute("style")).toContain(c.color);
    }
    map.remove();
  });

  it("good 判据回归锁：CAVOK 与好天仍绿；缺测单要素不误升灰（部分缺测按可得要素判）", async () => {
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = await addMetarLayer(
      map,
      [
        { report: parse("ZBAA 110700Z VRB02MPS CAVOK 25/10 Q1019 NOSIG"), position: [40, 116] },
        // 能见度缺测但云组在值（SCT030）——不属「关键组全缺测」，按可得要素判 good
        {
          report: parse("ZGGG 120000Z 00000KT //// SCT030 26/22 Q1009"),
          position: [41, 117],
        },
      ],
      { conditionColors: true },
    );
    const dots = group.getLayers().map((m) => {
      if (!(m instanceof L.Marker)) throw new Error("图层成员应为 Marker");
      return m.getElement()?.querySelector(".mw-dot")?.className ?? "";
    });
    expect(dots[0]).toContain("mw-dot-good");
    expect(dots[1]).toContain("mw-dot-good");
    map.remove();
  });

  it("aria-label 追加档位词（zh：站名 · 天气好/差；en：Weather poor）——a11y 1.4.1 颜色不只靠色", async () => {
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = await addMetarLayer(
      map,
      [
        {
          report: parse("ZBAA 110700Z VRB02MPS CAVOK 25/10 Q1019 NOSIG"),
          position: [40, 116],
          title: "ZBAA 北京",
        },
        {
          report: parse("ZGGG 120000Z 27008KT 0800 BKN030 26/22 Q1009"),
          position: [41, 117],
          title: "ZGGG 广州",
        },
        { report: parse("METAR ZBAA 120300Z NIL="), position: [42, 118], title: "ZBAA" },
      ],
      { conditionColors: true },
    );
    const labels = group.getLayers().map((m) => {
      if (!(m instanceof L.Marker)) throw new Error("图层成员应为 Marker");
      return m.getElement()?.querySelector(".mw-dot")?.getAttribute("aria-label") ?? "";
    });
    expect(labels[0]).toBe("ZBAA 北京 · 天气好");
    expect(labels[1]).toBe("ZGGG 广州 · 天气差");
    expect(labels[2]).toBe("ZBAA · 天气不明");
    // en：档位词随 card 选项的 locale（双语）
    const enGroup = await addMetarLayer(
      map,
      [
        {
          report: parse("ZGGG 120000Z 27008KT 0800 BKN030 26/22 Q1009"),
          position: [43, 119],
          title: "ZGGG",
        },
      ],
      { conditionColors: true, card: { locale: "en" } },
    );
    const enMarker = enGroup.getLayers()[0];
    if (!(enMarker instanceof L.Marker)) throw new Error("图层成员应为 Marker");
    expect(enMarker.getElement()?.querySelector(".mw-dot")?.getAttribute("aria-label")).toBe(
      "ZGGG · Weather poor",
    );
    map.remove();
  });

  it("着色圆点保持可访问名称（role=img + aria-label=站名+档位，divIcon 无 img 不丢名）", async () => {
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = await addMetarLayer(
      map,
      [
        {
          report: parse("ZGGG 120000Z 27008KT 0800 BKN030 26/22 Q1009"),
          position: [40, 116],
          title: "ZGGG 广州",
        },
      ],
      { conditionColors: true },
    );
    const marker = group.getLayers()[0];
    if (!(marker instanceof L.Marker)) throw new Error("图层成员应为 Marker");
    const dot = marker.getElement()?.querySelector(".mw-dot");
    expect(dot?.getAttribute("role")).toBe("img");
    // 恶意 title 不产生元素节点（HTML 转义）
    const evil = await addMetarLayer(
      map,
      [{ report, position: [41, 117], title: '<img src=x onerror="alert(1)">' }],
      { conditionColors: true },
    );
    const evilMarker = evil.getLayers()[0];
    if (!(evilMarker instanceof L.Marker)) throw new Error("图层成员应为 Marker");
    expect(evilMarker.getElement()?.querySelector("img")).toBeNull();
    map.remove();
  });

  it("tooltip 追加要素摘要行：2500 m +TSRA BKN030CB（vis/天气/最差云）", async () => {
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = await addMetarLayer(
      map,
      [
        {
          report: parse("ZGGG 120000Z 00000KT 2500 +TSRA BKN030CB 26/22 Q1009"),
          position: [40, 116],
          title: "ZGGG",
        },
      ],
      { conditionColors: true },
    );
    const marker = group.getLayers()[0];
    if (!(marker instanceof L.Marker)) throw new Error("图层成员应为 Marker");
    marker.openTooltip();
    const tipEl = marker.getTooltip()?.getElement();
    expect(tipEl?.textContent).toContain("ZGGG");
    expect(tipEl?.textContent).toContain("2500 m +TSRA BKN030CB");
    map.remove();
  });

  it("tooltip 摘要：NIL 站显示「缺报（NIL，WMO＝missed report）」、关键组全缺测站显示「数据缺测」（不再是空摘要行）", async () => {
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = await addMetarLayer(
      map,
      [
        { report: parse("METAR ZBAA 120300Z NIL="), position: [40, 116], title: "ZBAA" },
        {
          report: parse(
            "CWLI 120900Z AUTO ///// ////SM ////// 09/08 A2961 RMK WND MISG VIS MISG CLD MISG",
          ),
          position: [41, 117],
          title: "CWLI",
        },
      ],
      { conditionColors: true },
    );
    for (const layer of group.getLayers()) {
      if (!(layer instanceof L.Marker)) throw new Error("图层成员应为 Marker");
      layer.openTooltip();
    }
    const texts = [
      ...(document.querySelectorAll(".leaflet-tooltip") as NodeListOf<HTMLElement>),
    ].map((n) => n.textContent ?? "");
    expect(texts.some((t) => t.includes("缺报"))).toBe(true);
    expect(texts.some((t) => t.includes("数据缺测"))).toBe(true);
    map.remove();
  });

  it("conditionColors 缺省 false：保持默认图钉（无圆点、无摘要行为回归）", async () => {
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = await addMetarLayer(map, [{ report, position: [40, 116] }]);
    const marker = group.getLayers()[0];
    if (!(marker instanceof L.Marker)) throw new Error("图层成员应为 Marker");
    expect(marker.getElement()?.querySelector(".mw-dot")).toBeNull();
    expect(marker.getElement()?.tagName).toBe("IMG");
    map.remove();
  });
});

describe("C13：popup 体验（maxWidth / 焦点 / Escape / 触屏双浮层）", () => {
  it("popup maxWidth 420（卡片设计宽不再被 300 压）", async () => {
    document.body.innerHTML = '<div id="map" style="width: 600px; height: 400px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = await addMetarLayer(map, [{ report, position: [40, 116] }]);
    const marker = group.getLayers()[0];
    if (!(marker instanceof L.Marker)) throw new Error("图层成员应为 Marker");
    expect(marker.getPopup()?.options.maxWidth).toBe(420);
    map.remove();
  });

  it("Escape 关闭已开弹窗（地图容器键盘路径）", async () => {
    document.body.innerHTML = '<div id="map" style="width: 600px; height: 400px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = await addMetarLayer(map, [{ report, position: [40, 116] }]);
    const marker = group.getLayers()[0];
    if (!(marker instanceof L.Marker)) throw new Error("图层成员应为 Marker");
    marker.openPopup();
    expect(document.querySelector(".leaflet-popup")).not.toBeNull();
    map
      .getContainer()
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.querySelector(".leaflet-popup")).toBeNull();
    map.remove();
  });

  it("popup 打开：焦点移入关闭按钮（首个可聚焦元素）并收起 tooltip（触屏双浮层消除）", async () => {
    document.body.innerHTML = '<div id="map" style="width: 600px; height: 400px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = await addMetarLayer(map, [{ report, position: [40, 116], title: "ZBAA" }]);
    const marker = group.getLayers()[0];
    if (!(marker instanceof L.Marker)) throw new Error("图层成员应为 Marker");
    marker.openTooltip();
    expect(marker.isTooltipOpen()).toBe(true);
    marker.openPopup();
    expect(marker.isTooltipOpen()).toBe(false);
    const active = document.activeElement as HTMLElement | null;
    expect(active?.classList.contains("leaflet-popup-close-button")).toBe(true);
    map.remove();
  });
});

describe("条件色注入安全锁（前导引号载荷——转义被删时必红）", () => {
  it('divIcon aria-label 上下文："> 逃逸载荷不产生任何元素与事件属性，aria-label 字面等于原文', async () => {
    const evil = '"><img src=x onerror=alert(1)><svg onload=alert(2)>';
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const cardiReport = parse("ZBAA 120000Z 36004MPS 9999 FEW030 18/09 Q1019");
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    await addMetarLayer(map, [{ report: cardiReport, position: [40, 116], title: evil }], {
      conditionColors: true,
    });
    const icons = document.querySelectorAll(".mw-cond-icon");
    expect(icons.length).toBe(1);
    const host = icons[0];
    if (host === undefined) throw new Error("条件色图标未渲染");
    // 断言一：载荷未逃逸出属性——无任何 img/svg 元素、无 onerror/onload 属性
    expect(host.querySelectorAll("img, svg, iframe, script").length).toBe(0);
    expect(host.querySelector("[onerror]")).toBeNull();
    expect(host.querySelector("[onload]")).toBeNull();
    // 断言二：aria-label 字面等于原文+档位词后缀（转义后回读一致；档位词追加见 conditionOf 注释）
    const el = host.querySelector("[aria-label]");
    expect(el?.getAttribute("aria-label")).toBe(`${evil} · 天气好`);
    map.remove();
  });
});

// ---------------------------------------------------------------- 五角色评测修复批（2026-09-15）

describe("addMetarLayer 顶层 locale 速记与未知选项校验", () => {
  it("顶层 locale:'en'——tooltip 档位词与弹窗卡片全英文（此前顶层 locale 被静默忽略）", async () => {
    document.body.innerHTML = '<div id="map-locale-shorthand"></div>';
    const map = L.map("map-locale-shorthand", { center: [35.5, 105], zoom: 4 });
    const group = await addMetarLayer(
      map,
      [{ report, position: [40.0, 116.6], title: "ZBAA Beijing" }],
      {
        locale: "en",
        conditionColors: true,
      },
    );
    const marker = group.getLayers()[0] as L.Marker;
    // 档位词随速记切英文（CAVOK 报文 → good）
    const iconHost = marker.getElement() as HTMLElement;
    expect(iconHost.querySelector("[aria-label]")?.getAttribute("aria-label")).toContain(
      "Weather good",
    );
    // 弹窗卡片整卡英文（修正海压行 → QNH）
    const card = marker.getPopup()?.getContent() as HTMLElement;
    expect(card.textContent).toContain("QNH");
    expect(card.textContent).not.toContain("修正海压");
    map.remove();
  });

  it("card.locale 优先于顶层速记；未知选项运行时抛错", async () => {
    document.body.innerHTML = '<div id="map-locale-precedence"></div>';
    const map = L.map("map-locale-precedence", { center: [35.5, 105], zoom: 4 });
    const group = await addMetarLayer(map, [{ report, position: [40.0, 116.6] }], {
      locale: "en",
      card: { locale: "zh" },
    });
    const marker = group.getLayers()[0] as L.Marker;
    const card = marker.getPopup()?.getContent() as HTMLElement;
    expect(card.textContent).toContain("修正海压");
    map.remove();

    document.body.innerHTML = '<div id="map-bad-option"></div>';
    const map2 = L.map("map-bad-option", { center: [35.5, 105], zoom: 4 });
    const bad = { colour: true } as unknown as Parameters<typeof addMetarLayer>[2];
    await expect(addMetarLayer(map2, [{ report, position: [40.0, 116.6] }], bad)).rejects.toThrow(
      /colour/,
    );
    map2.remove();
  });
});

// ---------------------------------------------------------------- TAF 图层（渲染层①：预报当观测渲）

const freshMap = (): L.Map => {
  document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
  return L.map("map", { center: [35.5, 105], zoom: 4 });
};
const firstDot = (g: L.LayerGroup): string | null | undefined =>
  (g.getLayers()[0] as L.Marker | undefined)?.getElement()?.querySelector(".mw-dot")?.className ??
  null;
const firstTipText = (g: L.LayerGroup): string =>
  (
    (g.getLayers()[0] as L.Marker | undefined)?.getTooltip()?.getContent() as
      | HTMLElement
      | undefined
  )?.textContent ?? "";

describe("addTafLayer（v0.2 渲染层①）", () => {
  const goodBase =
    "TAF ZBAA 010340Z 0106/0206 17004MPS 9999 SCT030 BECMG 0110/0111 1200 -SN OVC008=";
  const tempoRaw =
    "TAF ZPPP 251518Z 2518/2624 04009G16MPS 9999 SCT023 BKN033 TEMPO 2520/2524 2500 -SHRASN BR BECMG 2605/2606 2000 -SN BR=";

  it("预报当观测渲：基况时刻绿档；BECMG 生效时刻升红（与 METAR 同一判据管线）", async () => {
    const r = parseTaf(goodBase);
    const map1 = freshMap();
    const g1 = await addTafLayer(map1, [{ report: r, position: [40, 116] }], {
      at: { day: 1, hour: 8, minute: 0 },
    });
    expect(firstDot(g1)).toContain("mw-dot-good");
    map1.remove();
    const map2 = freshMap();
    const g2 = await addTafLayer(map2, [{ report: r, position: [40, 116] }], {
      at: { day: 1, hour: 12, minute: 0 },
    });
    expect(firstDot(g2)).toContain("mw-dot-poor"); // BECMG 后 1200 m + OVC008 → 红
    map2.remove();
  });

  it("TEMPO 发作窗内圆点升档（owner 9/24 实测批：发作窗只进提示不升档＝图上看不到危险窗），窗前窗后回主导档", async () => {
    // 基况 8000 BKN040＝好；TEMPO 18–22Z TSRA+CB＝差（实测 ZGGG 样形）
    const raw =
      "TAF ZGGG 240303Z 2406/2512 14003MPS 8000 BKN040 TEMPO 2418/2422 TSRA FEW030CB BKN033=";
    const r = parseTaf(raw);
    const dotAt = async (hour: number, minute = 0): Promise<string | null | undefined> => {
      const map = freshMap();
      const g = await addTafLayer(map, [{ report: r, position: [23, 113] }], {
        at: { day: 24, hour, minute },
      });
      const d = firstDot(g);
      map.remove();
      return d;
    };
    expect(await dotAt(12)).toContain("mw-dot-good"); // 窗前：主导段绿
    expect(await dotAt(19)).toContain("mw-dot-poor"); // 发作中：叠加态红（丢合成即回绿必红）
    expect(await dotAt(22)).toContain("mw-dot-good"); // 窗终（含窗终不含）回主导段
    // 摘要同合成态：发作中 tooltip 摘要含雷暴电码，aria-label 档位词随升
    const map = freshMap();
    const g = await addTafLayer(map, [{ report: r, position: [23, 113] }], {
      at: { day: 24, hour: 19, minute: 0 },
    });
    // 批2#4：tooltip 摘要/TEMPO 提示改人话（电码浓汤退役——「雷暴伴雨（飞行威胁大）」）
    expect(firstTipText(g)).toContain("雷暴伴雨");
    const label = (g.getLayers()[0] as L.Marker)
      .getElement()
      ?.querySelector('[role="img"]')
      ?.getAttribute("aria-label");
    expect(label).toContain("预报天气差");
    map.remove();
  });

  it("换报数据面（owner 9/24 方案B）：宿主原位换 item.report 后 setTafLayerTime 圆点与已开弹窗即时跟随新报", async () => {
    // 旧周期报（00Z 生效、全程好）建层开卡 → 原位换新周期报（06Z 生效、TEMPO 18–22Z 雷雨）→ 同层换时刻重渲
    const item: TafLayerItem = {
      report: parseTaf("TAF ZGGG 232106Z 2400/2506 13003MPS 8000 BKN040="),
      position: [23, 113],
    };
    const map = freshMap();
    const g = await addTafLayer(map, [item], { at: { day: 24, hour: 2, minute: 0 } });
    const marker = g.getLayers()[0];
    if (!(marker instanceof L.Marker)) throw new Error("应为 Marker");
    marker.openPopup();
    const pane = map.getPane?.("popupPane");
    const cardText = (): string => pane?.querySelector(".mw-taf-card")?.textContent ?? "";
    expect(cardText()).toContain("发布 23日21:06Z"); // 旧报
    expect(cardText()).toContain("自 24日 00:00Z");
    expect(firstDot(g)).toContain("mw-dot-good");
    // 原位换新报（同站、6 小时后周期）——弹窗刷新闭包现读 item.report（捕获建层旧报即红）
    item.report = parseTaf(
      "TAF ZGGG 240303Z 2406/2512 14003MPS 8000 BKN040 TEMPO 2418/2422 TSRA FEW030CB BKN033=",
    );
    await setTafLayerTime(map, g, [item], { at: { day: 24, hour: 19, minute: 0 } });
    expect(cardText()).toContain("发布 24日03:03Z"); // 已开弹窗即时跟随新报
    expect(cardText()).toContain("自 24日 06:00Z");
    expect(firstDot(g)).toContain("mw-dot-poor"); // 圆点按新报发作窗升红
    map.remove();
  });

  it("缺省展开时刻＝有效期起点；aria-label 带「预报」标注", async () => {
    const map = freshMap();
    const g = await addTafLayer(map, [{ report: parseTaf(goodBase), position: [40, 116] }]);
    expect(firstDot(g)).toContain("mw-dot-good");
    expect(
      (g.getLayers()[0] as L.Marker)
        .getElement()
        ?.querySelector('[role="img"]')
        ?.getAttribute("aria-label"),
    ).toContain("预报");
    map.remove();
  });

  it("TEMPO 发作可能入 tooltip；BECMG 窗内时刻带「过渡带」", async () => {
    const map1 = freshMap();
    const g1 = await addTafLayer(map1, [{ report: parseTaf(tempoRaw), position: [25, 102] }], {
      at: { day: 25, hour: 21, minute: 0 },
    });
    expect(firstTipText(g1)).toContain("TEMPO 发作可能");
    expect(firstTipText(g1)).toContain("2500");
    map1.remove();
    const map2 = freshMap();
    const g2 = await addTafLayer(map2, [{ report: parseTaf(tempoRaw), position: [25, 102] }], {
      at: { day: 26, hour: 5, minute: 30 },
    });
    expect(firstTipText(g2)).toContain("过渡带");
    map2.remove();
  });

  it("NIL 不展开：灰 unknown + 缺报提示；未知选项运行时抛错（不静默纪律）", async () => {
    const map = freshMap();
    const g = await addTafLayer(map, [{ report: parseTaf("TAF ZSAM NIL="), position: [24, 113] }]);
    expect(firstDot(g)).toContain("mw-dot-unknown");
    expect(firstTipText(g)).toContain("缺报");
    map.remove();
    const map2 = freshMap();
    await expect(
      addTafLayer(map2, [], { conditonColors: true } as unknown as AddTafLayerOptions),
    ).rejects.toThrow("未知选项");
    map2.remove();
  });
});

it("层②：弹窗接 renderTafCard（分段明细 + RAW 联动），展开时刻摘要行置顶", async () => {
  const map = freshMap();
  const raw =
    "TAF ZPPP 251518Z 2518/2624 04009G16MPS 9999 SCT023 BKN033 TEMPO 2520/2524 2500 -SHRASN BR=";
  const g = await addTafLayer(map, [{ report: parseTaf(raw), position: [25, 102] }], {
    at: { day: 25, hour: 21, minute: 0 },
  });
  const marker = g.getLayers()[0];
  if (!(marker instanceof L.Marker)) throw new Error("应为 Marker");
  // 惰性弹窗（评测 P2-1）：内容在 popupopen 时渲染——openPopup 后从地图弹窗取卡
  marker.openPopup();
  const popupEl = map.getPane?.("popupPane")?.querySelector(".mw-taf-card") ?? null;
  if (popupEl === null) throw new Error("弹窗未渲染卡片");
  expect(popupEl.querySelectorAll(".mw-taf-period").length).toBe(2); // 基况 + TEMPO（四轮后时间线条已移除）
  expect(popupEl.querySelector(".mw-taf-raw")).not.toBeNull(); // RAW 对照默认开
  // 六轮：展开时刻入卡片「发布|查看时刻」双列行；七批：stationTitle 站名行（title 剥 ICAO 前缀）
  const metaRow = popupEl.querySelector(".mw-taf-meta-row");
  expect(metaRow?.textContent ?? "").toContain("发布 25日15:18Z");
  expect(metaRow?.textContent ?? "").toContain("查看时刻 25日21:00Z");
  map.remove();
});

it("层③：setTafLayerTime 全图换时刻（同一图层实例原地重建，档位随 BECMG 翻红）；滑杆控件拨动驱动重展开", async () => {
  const raw = "TAF ZBAA 010340Z 0106/0206 17004MPS 9999 SCT030 BECMG 0110/0111 1200 -SN OVC008=";
  const items = [{ report: parseTaf(raw), position: [40, 116] as [number, number] }];
  const map = freshMap();
  const g = await addTafLayer(map, items, { at: { day: 1, hour: 8, minute: 0 } });
  expect(firstDot(g)).toContain("mw-dot-good");
  // 换到 BECMG 之后：同实例重建、档位翻红
  const g2 = await setTafLayerTime(map, g, items, { at: { day: 1, hour: 12, minute: 0 } });
  expect(g2).toBe(g);
  expect(firstDot(g)).toContain("mw-dot-poor");
  // 滑杆控件：零点自动锚有效期起点（01日 06Z），第 6 格 × 60 分 → 01日 12:00Z 翻红
  const ctrl = createTafTimeControl(map, { layer: g, items, onTime: undefined });
  const input = ctrl.querySelector("input");
  expect(input).not.toBeNull();
  await new Promise((r) => setTimeout(r, 20)); // 控件初始 apply 的异步重建先落定（06Z 绿档）
  expect(firstDot(g)).toContain("mw-dot-good");
  (input as HTMLInputElement).value = "6";
  input?.dispatchEvent(new Event("input"));
  await new Promise((r) => setTimeout(r, 20));
  expect(firstDot(g)).toContain("mw-dot-poor");
  expect(ctrl.querySelector("span")?.textContent ?? "").toContain("01日 12:00");
  map.remove();
});

it("评测批 B：常显站码标签（zoom≥5）/card 透传/滑杆窗对齐+京时+aria-valuetext/换时刻不清弹窗", async () => {
  const map = freshMap();
  map.setZoom(6);
  const raw = "TAF ZBAA 010340Z 0106/0206 17004MPS 9999 SCT030 BECMG 0110/0111 1200 -SN OVC008=";
  const g = await addTafLayer(map, [{ report: parseTaf(raw), position: [40, 116] }], {
    at: { day: 1, hour: 8, minute: 0 },
    card: { raw: false },
  });
  // 站码标签随 icon 注入，缩放门控类由 zoomend 维护（zoom6 ≥5 → 不隐藏）
  const iconHtml = (g.getLayers()[0] as L.Marker).getElement()?.innerHTML ?? "";
  expect(iconHtml).toContain("mw-code-label");
  expect(iconHtml).toContain("ZBAA");
  expect(map.getContainer().classList.contains("mw-hide-codes")).toBe(false);
  map.setZoom(4);
  map.fire("zoomend");
  expect(map.getContainer().classList.contains("mw-hide-codes")).toBe(true);
  map.setZoom(6);
  // card 透传：raw:false → 弹窗卡无 RAW 区
  const marker = g.getLayers()[0] as L.Marker;
  marker.openPopup();
  const pane = map.getPane?.("popupPane");
  expect(pane?.querySelector(".mw-taf-raw")).toBeNull();
  // 换时刻不清弹窗：开着弹窗 setTafLayerTime → 同一弹窗元素在位、内容即时换
  await setTafLayerTime(map, g, [{ report: parseTaf(raw), position: [40, 116] }], {
    at: { day: 1, hour: 12, minute: 0 },
    card: { raw: false },
  });
  const popupAfter = pane?.querySelector(".mw-taf-card");
  expect(popupAfter).not.toBeNull();
  expect(popupAfter?.textContent ?? "").toContain("查看时刻 01日12:00Z");
  // 滑杆：窗对齐（0106→0206=24 格）+ aria-valuetext——时区单制（owner 9/24）缺省 UTC、无括注；
  // 显式 480＝京时单制（整段京钟，无 Z 无括号）
  const ctrl = createTafTimeControl(map, {
    layer: g,
    items: [{ report: parseTaf(raw), position: [40, 116] }],
    layerOptions: { card: { raw: false } },
  });
  const input = ctrl.querySelector("input");
  expect(input?.max).toBe("24");
  const utcLabel = input?.getAttribute("aria-valuetext") ?? "";
  expect(utcLabel).toContain("01日 06:00Z");
  expect(utcLabel).not.toContain("京");
  const ctrlBj = createTafTimeControl(map, {
    layer: g,
    items: [{ report: parseTaf(raw), position: [40, 116] }],
    utcOffsetMinutes: 480,
  });
  const bjLabel = ctrlBj.querySelector("input")?.getAttribute("aria-valuetext") ?? "";
  expect(bjLabel).toContain("北京时01日14:00");
  expect(bjLabel).not.toMatch(/Z|（/);
  map.remove();
});

it("复测修复锁 N1/N2/N5：键盘拖滑杆不抢焦、弹窗置顶提示随时刻重算、缺省 at 保持层当前时刻", async () => {
  const raw = "TAF ZPPP 251518Z 2518/2624 04009G16MPS 9999 SCT023 TEMPO 2520/2524 2500 -SHRA BR=";
  const items = [{ report: parseTaf(raw), position: [25, 102] as [number, number] }];
  const map = freshMap();
  const g = await addTafLayer(map, items, { at: { day: 25, hour: 19, minute: 0 } });
  const marker = g.getLayers()[0] as L.Marker;
  marker.openPopup();
  const pane = map.getPane?.("popupPane");
  // 19Z 在 TEMPO 窗（20-24）前：无「TEMPO 发作可能」提示
  expect(pane?.querySelector(".mw-taf-card")?.textContent ?? "").not.toContain("TEMPO 发作可能");
  // 滑杆聚焦后拨动（键盘路径）：换时刻不抢焦（N1）、弹窗提示即时更新（N2）
  const ctrl = createTafTimeControl(map, { layer: g, items });
  document.body.append(ctrl); // 控件需在文档内 focus 才生效（happy-dom 语义）
  const input = ctrl.querySelector("input");
  input?.focus();
  if (input !== null) input.value = "5"; // 18+5=23Z 落 TEMPO 窗（属性赋值，非 setAttribute 默认值）
  input?.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 80));
  expect(document.activeElement).toBe(input); // N1：焦点仍在滑杆
  expect(pane?.querySelector(".mw-taf-card")?.textContent ?? "").toContain("TEMPO 发作可能"); // N2：提示重算
  // N5：不传 at 的 setTafLayerTime 保持层当前时刻（不回退 0 日）
  await setTafLayerTime(map, g, items, {});
  expect(pane?.querySelector(".mw-taf-meta-row")?.textContent ?? "").toContain(
    "查看时刻 25日23:00Z",
  );
  map.remove();
});

it("复测修复：出窗灰态（超有效期＝unknown 灰点+「已过期」提示）与滑杆端点标注", async () => {
  const raw = "TAF ZBAA 010340Z 0106/0206 17004MPS 9999 SCT030 BECMG 0110/0111 1200 -SN OVC008=";
  const items = [{ report: parseTaf(raw), position: [40, 116] as [number, number] }];
  const map = freshMap();
  const g = await addTafLayer(map, items, { at: { day: 1, hour: 8, minute: 0 } });
  const dotOf = (): string | undefined =>
    (g.getLayers()[0] as L.Marker).getElement()?.querySelector(".mw-dot")?.className;
  expect(dotOf()).toContain("mw-dot-good");
  // 窗后：03日 → 灰 unknown + tooltip 已过期
  await setTafLayerTime(map, g, items, { at: { day: 3, hour: 0, minute: 0 } });
  expect(dotOf()).toContain("mw-dot-unknown");
  const marker = g.getLayers()[0] as L.Marker;
  marker.openTooltip();
  const tip1 = marker.getTooltip()?.getContent();
  expect((tip1 instanceof HTMLElement ? tip1.textContent : "") ?? "").toContain("预报已过期");
  // 窗前：0105 → 「未生效」
  await setTafLayerTime(map, g, items, { at: { day: 1, hour: 5, minute: 0 } });
  const tip2 = marker.getTooltip()?.getContent();
  expect((tip2 instanceof HTMLElement ? tip2.textContent : "") ?? "").toContain("预报尚未生效");
  // 滑杆端点标注（小白#11）：两端起止时刻；时区单制（owner 9/24）——缺省 UTC 直读，显式 480＝京钟
  const ctrl = createTafTimeControl(map, { layer: g, items });
  const ticks = Array.from(ctrl.querySelectorAll("div")).find((d) => d.children.length === 2);
  expect(ticks?.textContent ?? "").toContain("01日 06:00Z");
  expect(ticks?.textContent ?? "").toContain("02日 06:00Z");
  expect(ticks?.textContent ?? "").not.toContain("京");
  const ctrlBj = createTafTimeControl(map, { layer: g, items, utcOffsetMinutes: 480 });
  const ticksBj = Array.from(ctrlBj.querySelectorAll("div")).find((d) => d.children.length === 2);
  expect(ticksBj?.textContent ?? "").toContain("北京时01日14:00");
  expect(ticksBj?.textContent ?? "").toContain("北京时02日14:00");
  map.remove();
});

it("层③竞态回归：同步连拨两次不叠点（clearLayers 与 populate 之间的 await 窗口），末次拨动生效", async () => {
  const raw = "TAF ZBAA 010340Z 0106/0206 17004MPS 9999 SCT030 BECMG 0110/0111 1200 -SN OVC008=";
  const items = [{ report: parseTaf(raw), position: [40, 116] as [number, number] }];
  const map = freshMap();
  const g = await addTafLayer(map, items);
  const ctrl = createTafTimeControl(map, { layer: g, items, onTime: undefined });
  const input = ctrl.querySelector("input");
  await new Promise((r) => setTimeout(r, 20)); // 控件初始 apply 先落定
  (input as HTMLInputElement).value = "2"; // 08Z：BECMG 前，绿档（旧代）
  input?.dispatchEvent(new Event("input"));
  (input as HTMLInputElement).value = "6"; // 12:00Z：BECMG 后，红档（末代）
  input?.dispatchEvent(new Event("input"));
  await new Promise((r) => setTimeout(r, 20));
  expect(g.getLayers()).toHaveLength(1); // 叠加点＝旧代 populate 未作废（38→114 实测同型）
  expect(firstDot(g)).toContain("mw-dot-poor");
  map.remove();
});

describe("C14：超高卡版式（owner 9/24 指令——卡不占满屏/不压固定悬浮层/段间距）", () => {
  const tall =
    "TAF ZPPP 251518Z 2518/2624 04009G16MPS 9999 SCT023 BKN033 TEMPO 2520/2524 2500 -SHRASN BR BECMG 2605/2606 2000 -SN BR=";

  it("TAF 弹窗 maxWidth 480（卡片加宽后的设计宽）+ popupOptions 透传（宿主避让边直达 bindPopup；METAR 缺省 420 不变）", async () => {
    const map = freshMap();
    const g = await addTafLayer(map, [{ report: parseTaf(tall), position: [25, 102] }], {
      popupOptions: {
        autoPanPaddingTopLeft: L.point(12, 84),
        autoPanPaddingBottomRight: L.point(16, 92),
      },
    });
    const marker = g.getLayers()[0];
    if (!(marker instanceof L.Marker)) throw new Error("应为 Marker");
    expect(marker.getPopup()?.options.maxWidth).toBe(480);
    expect(marker.getPopup()?.options.autoPanPaddingTopLeft).toEqual(L.point(12, 84));
    expect(marker.getPopup()?.options.autoPanPaddingBottomRight).toEqual(L.point(16, 92));
    map.remove();
    const map2 = freshMap();
    const g2 = await addMetarLayer(map2, [{ report, position: [40, 116] }], {
      popupOptions: { autoPanPaddingBottomRight: L.point(16, 92) },
    });
    const m2 = g2.getLayers()[0];
    if (!(m2 instanceof L.Marker)) throw new Error("应为 Marker");
    expect(m2.getPopup()?.options.maxWidth).toBe(420);
    expect(m2.getPopup()?.options.autoPanPaddingBottomRight).toEqual(L.point(16, 92));
    map2.remove();
  });

  it("卡内滚轮不冒泡地图容器（行为锁：限高内滚的卡滚动时地图不跟着缩放——Leaflet 弹窗内建 disableScrollPropagation 提供，升级/重构破坏即红）", async () => {
    const map = freshMap();
    const g = await addTafLayer(map, [{ report: parseTaf(tall), position: [25, 102] }], {
      at: { day: 25, hour: 21, minute: 0 },
    });
    const marker = g.getLayers()[0];
    if (!(marker instanceof L.Marker)) throw new Error("应为 Marker");
    marker.openPopup();
    const card = document.querySelector(".leaflet-popup .mw-taf-card");
    if (!(card instanceof HTMLElement)) throw new Error("弹窗内应有 TAF 卡");
    let reached = 0;
    map.getContainer().addEventListener("wheel", () => {
      reached += 1;
    });
    card.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    expect(reached).toBe(0); // 冒泡到容器即地图被缩放（产品行为红线；实测断点在 .leaflet-popup-content）
    map.remove();
  });
});

describe("C15：时区单制切换（owner 9/24——一个开关控全图时间，缺省 UTC）", () => {
  const raw =
    "TAF ZPPP 251518Z 2518/2624 04009G16MPS 9999 SCT023 TEMPO 2520/2524 2500 -SHRASN BR BECMG 2605/2606 2000 -SN BR=";
  const mkItems = (): Array<{
    report: ReturnType<typeof parseTaf>;
    position: [number, number];
  }> => [{ report: parseTaf(raw), position: [25, 102] }];

  it("setTafLayerTime 带 card 时区：已开弹窗原地换制（UTC→京）且随后滑杆换时刻不回退（可变覆盖合并语义锁）", async () => {
    const map = freshMap();
    const items = mkItems();
    const g = await addTafLayer(map, items, { at: { day: 25, hour: 21, minute: 0 } });
    const marker = g.getLayers()[0];
    if (!(marker instanceof L.Marker)) throw new Error("应为 Marker");
    marker.openPopup();
    const pane = map.getPane?.("popupPane");
    const cardText = (): string => pane?.querySelector(".mw-taf-card")?.textContent ?? "";
    expect(cardText()).toContain("查看时刻 25日21:00Z"); // 缺省 UTC 单制
    // 切京时：不清层不重开——可变 card 覆盖即时生效（丢 WeakMap 合并即红）；
    // 人话行全京钟无 Z（RAW 原文区是 UTC 电码本体，不随展示时区换算——设计口径）
    await setTafLayerTime(map, g, items, { card: { utcOffsetMinutes: 480 } });
    const metaRow = (): string => pane?.querySelector(".mw-taf-meta-row")?.textContent ?? "";
    const validityLine = (): string =>
      Array.from(pane?.querySelectorAll(".mw-taf-meta") ?? [])
        .map((x) => x.textContent ?? "")
        .find((x) => x.includes("有效期")) ?? "";
    expect(metaRow()).toContain("查看时刻 北京时26日05:00");
    expect(metaRow()).not.toContain("Z");
    expect(validityLine()).toContain("自 北京时26日02:00 至 北京时27日08:00（北京时，30 小时）");
    // 滑杆换时刻（不带 card）：京制保持不回退——覆盖被 at-only 调用清掉即红
    await setTafLayerTime(map, g, items, { at: { day: 25, hour: 22, minute: 0 } });
    expect(metaRow()).toContain("查看时刻 北京时26日06:00");
    map.remove();
  });

  it("initialAt：重建控件落到当前时刻格（时区切换不丢拨动位置）", async () => {
    const map = freshMap();
    const items = mkItems();
    const g = await addTafLayer(map, items, { at: { day: 25, hour: 21, minute: 0 } });
    // 窗 2518→2624：25日21:00 ＝ 第 3 格（18→19→20→21）；京钟 21:00+8＝次日 05:00
    const ctrl = createTafTimeControl(map, {
      layer: g,
      items,
      utcOffsetMinutes: 480,
      initialAt: { day: 25, hour: 21, minute: 0 },
    });
    const input = ctrl.querySelector("input");
    expect(input?.value).toBe("3");
    expect(input?.getAttribute("aria-valuetext") ?? "").toContain("北京时26日05:00");
    map.remove();
  });

  it("时间轴批（owner 9/24）：显式 from/to 接线（10 分钟步 24h＝144 格，默认锚窗零点）+ tickEveryMinutes 整点刻度与日界标注", async () => {
    const map = freshMap();
    const items = mkItems();
    const g = await addTafLayer(map, items);
    // 窗：24日14:30（现在向下取整 10 分钟）→ 25日14:30；to 此前有文档无接线（静默忽略），丢接线即本断言红
    const ctrl = createTafTimeControl(map, {
      layer: g,
      items,
      stepMinutes: 10,
      from: { day: 24, hour: 14, minute: 30 },
      to: { day: 25, hour: 14, minute: 30 },
      tickEveryMinutes: 180,
    });
    const input = ctrl.querySelector("input");
    expect(input?.max).toBe("144");
    expect(input?.value).toBe("0"); // 默认锚「现在」（＝窗零点）
    expect(input?.getAttribute("aria-valuetext") ?? "").toContain("24日 14:30Z");
    // 刻度：自窗内首个 3h 对齐整点（15:00）起等距；UTC 00 时＝日界标 dd日；终点恒标注（右锚防溢出）
    const labels = Array.from(ctrl.querySelectorAll("div span")).map((s) => s.textContent ?? "");
    expect(labels).toContain("15:00");
    expect(labels).toContain("21:00");
    expect(labels).toContain("25日"); // 25日00:00Z 日界
    expect(labels).toContain("03:00"); // 25日03:00Z
    expect(labels).toContain("14:30"); // 终点
    // 京时：刻度随展示时区换算（15:00Z→北京时23:00、终点→北京时22:30），UTC 式裸标签不再出现
    const ctrlBj = createTafTimeControl(map, {
      layer: g,
      items,
      stepMinutes: 10,
      from: { day: 24, hour: 14, minute: 30 },
      to: { day: 25, hour: 14, minute: 30 },
      tickEveryMinutes: 180,
      utcOffsetMinutes: 480,
    });
    const bjLabels = Array.from(ctrlBj.querySelectorAll("div span")).map(
      (s) => s.textContent ?? "",
    );
    expect(bjLabels).toContain("北京时23:00");
    expect(bjLabels).toContain("北京时02:00"); // 24日18:00Z → 北京时25日02:00（跨日换算正确、非日界不打日号）
    expect(bjLabels).toContain("北京时22:30"); // 终点 25日14:30Z → 北京时22:30
    expect(bjLabels.every((x) => x.startsWith("北京时"))).toBe(true);
    map.remove();
  });
});

// ---------------------------------------------------------------- 月界批（2026-09-24 评测 P1：跨月报池）

describe("月界批：calendarAnchor + item.monthAnchor（层连续序 at 归一到各报锚月，跨月报池展开/显示各报正确）", () => {
  const poorSept = "TAF ZBAA 291100Z 2912/3012 17004MPS 0800 -SN OVC008="; // 9 月报（29 日 12Z 起，差天）
  const poorOct = "TAF ZBAA 302300Z 0100/0206 17004MPS 0800 -SN OVC008="; // 10 月报（10/1 00Z 起）
  const octItem = (popup = false): TafLayerItem => ({
    report: parseTaf(poorOct),
    position: [40, 116],
    monthAnchor: { year: 2026, month: 10 },
    ...(popup ? {} : {}),
  });
  const septItem = (): TafLayerItem => ({
    report: parseTaf(poorSept),
    position: [39, 116],
    monthAnchor: { year: 2026, month: 9 },
  });

  it("9 月锚层 + 连续序 at 跨月（day=31＝10 月 1 日）：10 月报在生效窗内红点、9 月报出窗灰（旧 %31 回绕会把 10 月报判未生效）", async () => {
    const map = freshMap();
    const items = [septItem(), octItem()];
    const g = await addTafLayer(map, items, {
      calendarAnchor: { year: 2026, month: 9 },
      at: { day: 31, hour: 6, minute: 0 }, // 连续序：9 月锚起第 31 天＝10 月 1 日 06Z
    });
    // 9 月报有效期至 30 日 12Z → 连续序 10/1 06Z 已出窗＝灰 unknown；10 月报 10/1 00Z 起在效＝红 poor
    expect(firstDot(g)).toContain("mw-dot-unknown");
    const octDot = (g.getLayers()[1] as L.Marker).getElement()?.querySelector(".mw-dot")?.className;
    expect(octDot).toContain("mw-dot-poor");
    map.remove();
  });

  it("无锚（anchorDays 兼容路径）行为不变：连续序大日号按 %31 折回（残余近似路径回归锁）", async () => {
    const map = freshMap();
    const g = await addTafLayer(map, [octItem()], {
      at: { day: 31, hour: 6, minute: 0 },
    });
    expect(firstDot(g)).toContain("mw-dot-unknown"); // 31 折回＝1 日 → 06Z 早于 10/1 00Z 起点判未生效（旧近似口径）
    map.remove();
  });

  it("弹窗卡显示真月历：连续序 at 经归一后卡片「查看时刻」显示北京时 10月1日（不回绕 31 日）", async () => {
    const map = freshMap();
    const g = await addTafLayer(map, [octItem()], {
      calendarAnchor: { year: 2026, month: 9 },
      at: { day: 31, hour: 10, minute: 0 },
      card: { utcOffsetMinutes: 480 },
    });
    const marker = g.getLayers()[0] as L.Marker;
    marker.fire("popupopen", { popup: marker.getPopup()! });
    const content = marker.getPopup()?.getContent() as HTMLElement;
    expect(content.textContent).toContain("查看时刻 北京时10月1日 18:00"); // 连续序 31日10Z＝10/1 10Z，+8h
    map.remove();
  });

  it("createTafTimeControl calendarAnchor：京时标签走真月历（from 9/30 23:50 连续序、跨月显 10月1日）", () => {
    const map = freshMap();
    const ctrl = createTafTimeControl(map, {
      layer: L.layerGroup(),
      items: [octItem()],
      stepMinutes: 10,
      from: { day: 30, hour: 23, minute: 50 },
      to: { day: 31, hour: 23, minute: 50 },
      utcOffsetMinutes: 480,
      calendarAnchor: { year: 2026, month: 9 },
    });
    const val = ctrl.querySelector("input")?.getAttribute("aria-valuetext") ?? "";
    expect(val).toContain("北京时10月1日07:50"); // 9/30 23:50Z +8h（真月历跨月、无回绕）
    map.remove();
  });
});

describe("TIER_COLORS 单一来源导出（评测批2#3：图例/面板与圆点同表）", () => {
  it("四档色值锁定（宿主图例引用此表；值漂移即红）", async () => {
    const { TIER_COLORS } = await import("./index");
    expect(TIER_COLORS.poor).toBe("#d05656");
    expect(TIER_COLORS.caution).toBe("#e0a13c");
    expect(TIER_COLORS.good).toBe("#3aa657");
    expect(TIER_COLORS.unknown).toBe("#8a94a0");
  });
});

describe("tafTierOf 数据直读（评测批3#14：面板不再从 marker DOM className 正则回读）", () => {
  const r = parseTaf(
    "TAF ZGGG 230303Z 2306/2412 21004MPS 8000 BKN040 TEMPO 2306/2309 TSRA FEW020CB BKN040=",
  );
  const item: TafLayerItem = { report: r, position: [23, 113] };

  it("与圆点同一判据管线：发作窗内 poor、窗前窗后回主导档；跨月连续序经 calendarAnchor 归一", async () => {
    const { tafTierOf } = await import("./index");
    expect(tafTierOf(item, { day: 23, hour: 7, minute: 0 })).toBe("poor"); // TEMPO 窗内升档
    expect(tafTierOf(item, { day: 23, hour: 12, minute: 0 })).toBe("good"); // 回主导段（8000 m/BKN040 均好档）
    // 跨月：10 月报（item 锚 10 月）+ 层锚 9 月，连续序 31＝10/1 06Z——归一到报锚内 day=1，poor 判据正常落地
    const octR = parseTaf("TAF ZBAA 302300Z 0100/0206 17004MPS 0800 -SN OVC008=");
    const octItem: TafLayerItem = {
      report: octR,
      position: [40, 116],
      monthAnchor: { year: 2026, month: 10 },
    };
    expect(
      tafTierOf(
        octItem,
        { day: 31, hour: 6, minute: 0 },
        { calendarAnchor: { year: 2026, month: 9 } },
      ),
    ).toBe("poor");
  });
});

describe("控件月锚进位（UI 复验收口：day=31 在 9 月锚＝10/1，不得回退折回）", () => {
  it("createTafTimeControl 京时标签：连续序 31 日 23:50（9 月锚）显示「北京时10月1日07:50」", () => {
    const map = freshMap();
    const ctrl = createTafTimeControl(map, {
      layer: L.layerGroup(),
      items: [
        {
          report: parseTaf("TAF ZBAA 291100Z 2912/3012 17004MPS 9999 SCT030="),
          position: [40, 116],
        },
      ],
      stepMinutes: 10,
      from: { day: 30, hour: 23, minute: 50 },
      utcOffsetMinutes: 480,
      calendarAnchor: { year: 2026, month: 9 },
    });
    const input = ctrl.querySelector("input");
    expect(input).not.toBeNull();
    if (input === null) return;
    input.value = "6"; // 30日23:50 + 60min = 31日00:50（连续序）
    input.dispatchEvent(new Event("input", { bubbles: true }));
    // 拨动后标签经 rAF 合帧更新（happy-dom 即时）——进位日号不得回退折回
    expect(input.getAttribute("aria-valuetext") ?? "").toMatch(/北京时10月1日/);
    map.remove();
  });
});
