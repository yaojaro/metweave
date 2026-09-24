import { describe, expect, it } from "vitest";
import stations from "../stations.json";
import html from "../index.html?raw";
import { stationTitleOf } from "./zh-stations";

describe("中文站名（评测批2#5）", () => {
  it("39 站全量映射（stations.json 每站都有中文名——元数据新增站不静默丢名由回退兜底）", () => {
    for (const s of stations.stations) {
      const title = stationTitleOf(s.icao, s.name);
      expect(title, `${s.icao} 应有中文站名`).toMatch(/^[\u4e00-\u9fa5]/);
    }
  });

  it("输出格式：中文在前、英文括注；未知站回退英文（不静默丢名）", () => {
    expect(stationTitleOf("ZBAA", "Beijing Intl, BJ, CN")).toBe("北京首都（Beijing Intl, BJ, CN）");
    expect(stationTitleOf("ZXXX", "Nowhere Intl")).toBe("Nowhere Intl");
  });
});

describe("图例色值单一来源（评测批2#3：图例/面板与圆点同表取色）", () => {
  it("index.html 图例区零内联色值（内联回流即红——色值只允许来自 TIER_COLORS 注入）", () => {
    const legendBlock = html.split('id="map-legend"')[1]?.split("</div>")[0] ?? "";
    expect(legendBlock).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(legendBlock).toContain('data-tier="good"'); // 注入挂点在位
  });
});
