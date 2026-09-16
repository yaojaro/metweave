// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { EN_MESSAGES as EN_MESSAGES_CORE } from "@metweave/core";
import { parse, renderCard } from "./index";
import { EN_MESSAGES } from "./index";
import { iemCurrentsUrl } from "./sources";

describe("metweave umbrella", () => {
  it("单一入口覆盖 解析 → 渲染 全链", () => {
    const r = parse("METAR ZBAA 110700Z VRB02MPS CAVOK 25/10 Q1019 NOSIG");
    const card = renderCard(r);
    expect(card.classList.contains("mw-card")).toBe(true);
    expect(card.textContent).toContain("ZBAA");
    expect(card.textContent).toContain("CAVOK");
  });

  it("sources 端点模板", () => {
    expect(iemCurrentsUrl()).toContain("network=CN__ASOS");
  });

  it('伞包再导出 EN_MESSAGES（与 core 同一实体——消费方 import { EN_MESSAGES } from "metweave" 即得英文文案）', () => {
    expect(EN_MESSAGES).toBe(EN_MESSAGES_CORE);
    expect(EN_MESSAGES["missing-station"]).toMatch(/station group missing/);
  });
});
