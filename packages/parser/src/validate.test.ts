import { describe, expect, it } from "vitest";
import { MetarParseError } from "@metweave/core";
import { parseTaf } from "./taf";
import { validateTaf } from "./validate";
import type { TafViolationCode } from "./validate";

/** 违例码清单助手（按 code 分组，断言不依赖中文 message——机读契约） */
const codesOf = (raw: string, standard?: "wmo" | "caac"): TafViolationCode[] => {
  const report = parseTaf(raw);
  return validateTaf(report, standard === undefined ? undefined : { standard }).map((v) => v.code);
};

describe("C2 VRB 阈值（两源 1.5/2 m/s，严格不等式；逃逸条款不可判已入注释）", () => {
  it("VRB03KT ≈1.54 m/s：wmo 违例（≥1.5）、caac 合法（<2）——两源阈值互不卡", () => {
    expect(codesOf("TAF ZBAA 010340Z 0106/0206 VRB03KT 9999=")).toEqual(["vrb-over-threshold"]);
    expect(codesOf("TAF ZBAA 010340Z 0106/0206 VRB03KT 9999=", "caac")).toEqual([]);
  });

  it("VRB02MPS＝2 m/s：两源都违例（≥1.5 且 ≥2）；VRB01MPS 两源都合法；定向风不触发", () => {
    expect(codesOf("TAF ZBAA 010340Z 0106/0206 VRB02MPS 9999=")).toEqual(["vrb-over-threshold"]);
    expect(codesOf("TAF ZBAA 010340Z 0106/0206 VRB02MPS 9999=", "caac")).toEqual([
      "vrb-over-threshold",
    ]);
    expect(codesOf("TAF ZBAA 010340Z 0106/0206 VRB01MPS 9999=")).toEqual([]);
    expect(codesOf("TAF ZBAA 010340Z 0106/0206 17004MPS 9999=")).toEqual([]);
  });

  it("变化组内的 VRB 同判（TEMPO 段 where 指位）", () => {
    const report = parseTaf("TAF ZBAA 010340Z 0106/0206 17004MPS 9999 TEMPO 0609/0612 VRB04KT=");
    const v = validateTaf(report);
    expect(v.map((x) => x.code)).toEqual(["vrb-over-threshold"]);
    expect(v[0]?.where).toContain("TEMPO");
  });
});

describe("C3 阵风阈值（超出平均 ≥5 m/s 严格不等式——教材 ZSOF 34008G14MPS 实证基线）", () => {
  it("34008G14MPS（超出 6 m/s）合法；34008G12MPS（4 m/s）违例", () => {
    expect(codesOf("TAF ZSOF 200000Z 2000/2006 34008G14MPS 9999=")).toEqual([]);
    expect(codesOf("TAF ZSOF 200000Z 2000/2006 34008G12MPS 9999=")).toEqual([
      "gust-below-threshold",
    ]);
  });

  it("单位各自换算：08010G15KT 差 5 kt≈2.57 m/s 违例；08010G20KT 差 10 kt≈5.14 m/s 合法（10 kt 经验值）", () => {
    expect(codesOf("TAF ZBAA 010340Z 0106/0206 08010G15KT 9999=")).toEqual([
      "gust-below-threshold",
    ]);
    expect(codesOf("TAF ZBAA 010340Z 0106/0206 08010G20KT 9999=")).toEqual([]);
  });
});

describe("C5 天气白名单双层（国际基 + 中国扩展层按 standard 取舍）", () => {
  it("国际白名单各族合法：SHRA（中阵雨）/+SHSN/TSRA/FZFG/BLDU/DS/SQ/FC/RASN（中大组合）", () => {
    for (const wx of ["SHRA", "+SHSN", "TSRA", "TS", "FZFG", "BLDU", "DS", "SQ", "FC", "RASN"]) {
      expect(codesOf(`TAF ZBAA 010340Z 0106/0206 32004MPS 6000 ${wx}=`), wx).toEqual([]);
    }
  });

  it("中国扩展层（BR/HZ/弱档 -SHRA）：wmo 违例、caac 合法——双层语义", () => {
    for (const wx of ["BR", "HZ", "-SHRA", "-SN"]) {
      expect(codesOf(`TAF ZSPD 010340Z 0106/0206 32004MPS 5000 ${wx}=`), wx).toEqual([
        "wx-outside-list",
      ]);
      expect(codesOf(`TAF ZSPD 010340Z 0106/0206 32004MPS 5000 ${wx}=`, "caac"), wx).toEqual([]);
    }
  });

  it("两源都出层：DZ 毛毛雨（非中国扩展层、非国际白名单）与 VC 邻近组（METAR 语汇）", () => {
    expect(codesOf("TAF ZBAA 010340Z 0106/0206 32004MPS 6000 DZ=")).toEqual(["wx-outside-list"]);
    expect(codesOf("TAF ZBAA 010340Z 0106/0206 32004MPS 6000 DZ=", "caac")).toEqual([
      "wx-outside-list",
    ]);
    expect(codesOf("TAF ZBAA 010340Z 0106/0206 32004MPS 9999 VCSH=")).toEqual(["wx-outside-list"]);
  });

  it("变化组内天气同判（where 指位 TEMPO 窗）", () => {
    const v = validateTaf(
      parseTaf("TAF ZBAA 010340Z 0106/0206 17004MPS 9999 TEMPO 0609/0612 4000 BR="),
    );
    expect(v.map((x) => x.code)).toEqual(["wx-outside-list"]);
    expect(v[0]?.where).toContain("0609/0612");
  });
});

describe("C7 三层选取（§51.6.1.4：第2组 >2 oktas、第3组起 >4 oktas；仅全重报语境）", () => {
  it("基况段：SCT020 FEW030（第2组 FEW）违例；FEW012 SCT020 BKN030 合法；FEW012 SCT020 SCT030（第3组 SCT）违例", () => {
    expect(codesOf("TAF ZBAA 010340Z 0106/0206 17004MPS 9999 SCT020 FEW030=")).toEqual([
      "cloud-layer-selection",
    ]);
    expect(codesOf("TAF ZBAA 010340Z 0106/0206 17004MPS 9999 FEW012 SCT020 BKN030=")).toEqual([]);
    expect(codesOf("TAF ZBAA 010340Z 0106/0206 17004MPS 9999 FEW012 SCT020 SCT030=")).toEqual([
      "cloud-layer-selection",
    ]);
  });

  it("语境边界：FM 段全重报同判；TEMPO/BECMG 局部清单不判（B5——组内所列非全天空报告）", () => {
    const fm = validateTaf(
      parseTaf(
        "TAF ZBAA 010340Z 0106/0206 17004MPS 9999 FEW012 SCT020 FM0100 18005MPS 9999 SCT030 FEW040=",
      ),
    );
    expect(fm.map((v) => v.code)).toEqual(["cloud-layer-selection"]);
    expect(fm[0]?.where).toContain("FM");
    expect(
      codesOf("TAF ZBAA 010340Z 0106/0206 17004MPS 9999 TEMPO 0609/0612 4000 SCT020 FEW030="),
    ).toEqual([]);
  });
});

describe("strict 模式（parseTaf mode:'strict'——判据 + warning 级告警聚合为 strict-violation）", () => {
  it("干净报文通过（含 info 级方言注记不拦：无斜杠有效期方言 + strict 照常解析）", () => {
    const r = parseTaf("TAF ZWWW 160000Z 160024 32004MPS 9999=", { mode: "strict" });
    expect(r.station).toBe("ZWWW");
    expect(r.warnings.length).toBeGreaterThan(0); // 方言 info 在位但未拦
  });

  it("违例报文抛 strict-violation（code 机读、message 聚合）", async () => {
    let caught: MetarParseError | undefined;
    try {
      parseTaf("TAF ZSPD 010340Z 0106/0206 32004MPS 5000 BR=", { mode: "strict" });
    } catch (e) {
      caught = e as MetarParseError;
    }
    expect(caught).toBeInstanceOf(MetarParseError);
    expect(caught?.code).toBe("strict-violation");
    expect(String(caught?.message)).toContain("BR");
  });

  it("validateStandard 透传：同一份中国扩展层报文 caac strict 通过", () => {
    const r = parseTaf("TAF ZSPD 010340Z 0106/0206 32004MPS 5000 BR=", {
      mode: "strict",
      validateStandard: "caac",
    });
    expect(r.station).toBe("ZSPD");
  });

  it("warning 级解析告警也拦 strict（重复风组）；NIL 报文 strict 平凡通过", () => {
    let caught: MetarParseError | undefined;
    try {
      parseTaf("TAF ZBAA 010340Z 0106/0206 17004MPS 17005MPS 9999=", { mode: "strict" });
    } catch (e) {
      caught = e as MetarParseError;
    }
    expect(caught).toBeInstanceOf(MetarParseError);
    expect(caught?.code).toBe("strict-violation");
    expect(String(caught?.message)).toContain("strict 校验未通过");
    expect(parseTaf("TAF ZSAM NIL=", { mode: "strict" }).nil).toBe(true);
  });
});
