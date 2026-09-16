// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import * as L from "leaflet";
import { parse } from "@metweave/parser";
import { addMetarLayer } from "./index";

const report = parse("METAR ZBAA 110700Z VRB02MPS CAVOK 25/10 Q1019 NOSIG");

describe("addMetarLayer 冒烟（真实 leaflet + happy-dom）", () => {
  it("marker 数量、tooltip 文案、弹窗内报文卡片", () => {
    document.body.innerHTML = '<div id="map"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = addMetarLayer(map, [
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

  it("popup:false 时不绑定弹窗", () => {
    document.body.innerHTML = '<div id="map"></div>';
    const map = L.map("map");
    const group = addMetarLayer(map, [{ report, position: [40, 116] }], { popup: false });
    const first = group.getLayers()[0];
    if (!(first instanceof L.Marker)) throw new Error("图层成员应为 Marker");
    expect(first.getPopup()).toBeUndefined();
    map.remove();
  });

  it("title 注入面：恶意串按字面文本渲染——非 HTML 路径，不产生元素节点", () => {
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const evil = '<img src=x onerror="alert(1)"><script>alert(2)<\u002fscript>';
    const group = addMetarLayer(map, [{ report, position: [40, 116], title: evil }]);
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
  it("marker 图标携带 alt=站点名——title 优先、缺省回落 IR 站名（role=button 获名）", () => {
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = addMetarLayer(map, [
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
    // caution（琥珀）：能见度 1500–4800 / 云底 1000–3000 / 降水族 / 阵风 15–25 m/s
    { raw: "ZGGG 120000Z 27008KT 3000 SCT030 26/22 Q1009", tier: "caution", color: "#e0a13c" },
    { raw: "ZGGG 120000Z 27008KT 9999 BKN020 26/22 Q1009", tier: "caution", color: "#e0a13c" },
    { raw: "ZGGG 120000Z 27008KT 9999 -RA SCT030 26/22 Q1009", tier: "caution", color: "#e0a13c" },
    { raw: "ZGGG 120000Z 27008G40KT 9999 SCT030 26/22 Q1009", tier: "caution", color: "#e0a13c" },
    // poor（红）：能见度 <1500 / 云底 <1000 / TS 族好能见度 / GR / CB / + 显著降水 / 阵风 ≥25 m/s / 跑道关闭
    { raw: "ZGGG 120000Z 27008KT 0800 BKN030 26/22 Q1009", tier: "poor", color: "#d05656" },
    { raw: "ZGGG 120000Z 27008KT 9999 BKN005 26/22 Q1009", tier: "poor", color: "#d05656" },
    { raw: "ZGGG 120000Z 27008KT 9999 TSRA SCT030 26/22 Q1009", tier: "poor", color: "#d05656" },
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

  it("四档判据落色（unknown/poor/caution/good 圆点 divIcon）——TS 好能见度不再绿、CB 红、阵风升档", () => {
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = addMetarLayer(
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

  it("good 判据回归锁：CAVOK 与好天仍绿；缺测单要素不误升灰（部分缺测按可得要素判）", () => {
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = addMetarLayer(
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

  it("aria-label 追加档位词（zh：站名 · 天气好/差；en：Weather poor）——a11y 1.4.1 颜色不只靠色", () => {
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = addMetarLayer(
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
    const enGroup = addMetarLayer(
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

  it("着色圆点保持可访问名称（role=img + aria-label=站名+档位，divIcon 无 img 不丢名）", () => {
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = addMetarLayer(
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
    const evil = addMetarLayer(
      map,
      [{ report, position: [41, 117], title: '<img src=x onerror="alert(1)">' }],
      { conditionColors: true },
    );
    const evilMarker = evil.getLayers()[0];
    if (!(evilMarker instanceof L.Marker)) throw new Error("图层成员应为 Marker");
    expect(evilMarker.getElement()?.querySelector("img")).toBeNull();
    map.remove();
  });

  it("tooltip 追加要素摘要行：2500 m +TSRA BKN030CB（vis/天气/最差云）", () => {
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = addMetarLayer(
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

  it("tooltip 摘要：NIL 站显示「缺报（NIL，WMO＝missed report）」、关键组全缺测站显示「数据缺测」（不再是空摘要行）", () => {
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = addMetarLayer(
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

  it("conditionColors 缺省 false：保持默认图钉（无圆点、无摘要行为回归）", () => {
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = addMetarLayer(map, [{ report, position: [40, 116] }]);
    const marker = group.getLayers()[0];
    if (!(marker instanceof L.Marker)) throw new Error("图层成员应为 Marker");
    expect(marker.getElement()?.querySelector(".mw-dot")).toBeNull();
    expect(marker.getElement()?.tagName).toBe("IMG");
    map.remove();
  });
});

describe("C13：popup 体验（maxWidth / 焦点 / Escape / 触屏双浮层）", () => {
  it("popup maxWidth 420（卡片设计宽不再被 300 压）", () => {
    document.body.innerHTML = '<div id="map" style="width: 600px; height: 400px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = addMetarLayer(map, [{ report, position: [40, 116] }]);
    const marker = group.getLayers()[0];
    if (!(marker instanceof L.Marker)) throw new Error("图层成员应为 Marker");
    expect(marker.getPopup()?.options.maxWidth).toBe(420);
    map.remove();
  });

  it("Escape 关闭已开弹窗（地图容器键盘路径）", () => {
    document.body.innerHTML = '<div id="map" style="width: 600px; height: 400px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = addMetarLayer(map, [{ report, position: [40, 116] }]);
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

  it("popup 打开：焦点移入关闭按钮（首个可聚焦元素）并收起 tooltip（触屏双浮层消除）", () => {
    document.body.innerHTML = '<div id="map" style="width: 600px; height: 400px"></div>';
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    const group = addMetarLayer(map, [{ report, position: [40, 116], title: "ZBAA" }]);
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
  it('divIcon aria-label 上下文："> 逃逸载荷不产生任何元素与事件属性，aria-label 字面等于原文', () => {
    const evil = '"><img src=x onerror=alert(1)><svg onload=alert(2)>';
    document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
    const cardiReport = parse("ZBAA 120000Z 36004MPS 9999 FEW030 18/09 Q1019");
    const map = L.map("map", { center: [35.5, 105], zoom: 4 });
    addMetarLayer(map, [{ report: cardiReport, position: [40, 116], title: evil }], {
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
  it("顶层 locale:'en'——tooltip 档位词与弹窗卡片全英文（此前顶层 locale 被静默忽略）", () => {
    document.body.innerHTML = '<div id="map-locale-shorthand"></div>';
    const map = L.map("map-locale-shorthand", { center: [35.5, 105], zoom: 4 });
    const group = addMetarLayer(map, [{ report, position: [40.0, 116.6], title: "ZBAA Beijing" }], {
      locale: "en",
      conditionColors: true,
    });
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

  it("card.locale 优先于顶层速记；未知选项运行时抛错", () => {
    document.body.innerHTML = '<div id="map-locale-precedence"></div>';
    const map = L.map("map-locale-precedence", { center: [35.5, 105], zoom: 4 });
    const group = addMetarLayer(map, [{ report, position: [40.0, 116.6] }], {
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
    expect(() => addMetarLayer(map2, [{ report, position: [40.0, 116.6] }], bad)).toThrow(/colour/);
    map2.remove();
  });
});
