import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ParseOptions } from "@metweave/core";
import { MetarParseError, toValues, unwrap } from "@metweave/core";
import { parse, TEMP_DEW_PATTERN, tryParse } from "./index";
import fixturesFile from "./__fixtures__/metar.json";

interface Fixture {
  id: string;
  raw: string;
  station: string;
  source: string;
  obsTime: string | null;
  traps: string[];
  note: string;
}

interface FixturesFile {
  count: number;
  fixtures: Fixture[];
  /** 雷点人类可读说明（键集 = 全部雷点；统计数字的权威源） */
  trapsLegend: Record<string, string>;
}

const remarkKindsOf = (raw: string): string[] => parse(raw).remarks?.map((x) => x.kind) ?? [];
const file: FixturesFile = fixturesFile;
const byId = new Map(file.fixtures.map((f) => [f.id, f]));
const fx = (id: string): Fixture => {
  const f = byId.get(id);
  if (f === undefined) throw new Error(`夹具缺失: ${id}`);
  return f;
};
/** 跑道状态深度解码取值（模块级 helper，供 92–98 段断言复用） */
const runwayDepthOf = (code: string): number | null | undefined =>
  parse(`METAR UUDD 120000Z 36001MPS 9999 SCT030 M02/M05 Q1019 R01/${code}`).runwayStates[0]?.depth;

const byTrap = (trap: string): Fixture => {
  const f = file.fixtures.find((x) => x.traps.includes(trap));
  if (f === undefined) throw new Error(`无实弹夹具: ${trap}`);
  return f;
};

/** parse 整体失败的机读断言入口：必须抛 MetarParseError（错误面契约），返回它供 code/raw 断言 */
const parseErrorOf = (raw: string, options?: Parameters<typeof parse>[1]): MetarParseError => {
  try {
    parse(raw, options);
  } catch (err) {
    if (err instanceof MetarParseError) return err;
    throw new Error(`预期 MetarParseError，实得 ${String(err)}`, { cause: err });
  }
  throw new Error("预期 parse 整体失败，但解析成功了");
};

/** 零分母断言入口：visibility 必为 missing + value-out-of-range 告警（span 指该组） */
const zeroDenominator = (reportLine: string, groupText: string): void => {
  const r = parse(reportLine);
  expect(r.visibility?.kind, `${reportLine} 应判缺测`).toBe("missing");
  const warn = r.warnings.find((w) => w.code === "value-out-of-range");
  expect(warn, `${reportLine} 应带 value-out-of-range 告警`).toBeDefined();
  expect(warn?.severity).toBe("warning");
  expect(r.raw.slice(warn?.span!.start ?? 0, warn?.span!.end ?? 0)).toBe(groupText);
  if (r.visibility?.kind === "missing") {
    expect(r.raw.slice(r.visibility.span!.start, r.visibility.span!.end)).toBe(groupText);
  }
};

describe("夹具全量冒烟", () => {
  it("统计口径一致性：count 字段 = fixtures.length，trapsLegend 覆盖全部在用雷点（文档数字防漂移的权威源）", () => {
    expect(file.count).toBe(file.fixtures.length);
    const usedTraps = new Set(file.fixtures.flatMap((f) => f.traps));
    for (const trap of usedTraps) {
      expect(file.trapsLegend, `雷点 ${trap} 缺 trapsLegend 说明`).toHaveProperty(trap);
    }
  });

  it("全部真实报文无异常解析出合法 IR（站名/时组齐、无 error 级告警）", () => {
    expect(file.fixtures.length).toBe(file.count);
    for (const f of file.fixtures) {
      const r = parse(f.raw);
      expect(r.raw, f.id).toBe(f.raw);
      expect(r.station.length, f.id).toBe(4);
      expect(r.time.day, f.id).toBeGreaterThan(0);
      expect(Array.isArray(r.warnings), f.id).toBe(true);
      expect(
        r.warnings.filter((w) => w.severity === "error").length,
        `${f.id} 出现 error 级告警: ${JSON.stringify(r.warnings)}`,
      ).toBe(0);
    }
  });

  it("strict 模式未实现时明确报错", () => {
    expect(() => parse(file.fixtures[0]!.raw, { mode: "strict" })).toThrow();
  });
});

describe("雷点定点断言", () => {
  it("VRB 全向风 + CAVOK + NOSIG（零告警的干净报文）", () => {
    const r = parse(fx("verified-a2").raw);
    const wind = unwrap(r.wind);
    expect(wind?.variable).toBe(true);
    expect(wind?.direction).toBeNull();
    expect(wind?.speed.unit).toBe("mps");
    expect(r.cavok).toBe(true);
    expect(r.trends[0]?.kind).toBe("nosig");
    expect(r.warnings).toHaveLength(0);
  });

  it("风组实值 + 变化组（33002MPS 260V050）", () => {
    const r = parse(fx("verified-a1").raw);
    const wind = unwrap(r.wind);
    expect(wind?.direction).toBe(330);
    expect(wind?.speed).toMatchObject({ value: 2, unit: "mps" });
    expect(wind?.variation).toMatchObject({ min: 260, max: 50 });
  });

  it("混分数能见度跨 token 合并（1 1/4SM = 1.25）", () => {
    const r = parse(byTrap("vis-mixed-fraction").raw);
    const vis = unwrap(r.visibility);
    expect(vis?.unit).toBe("sm");
    expect(vis?.value).toBeCloseTo(1.25);
  });

  it("RVR 带 FT 英尺后缀 + V 波动 + 趋势", () => {
    const r = parse(byTrap("rvr-ft-suffix").raw);
    const rvr = unwrap(r.runwayVisualRange);
    const first = rvr?.[0];
    expect(first?.unit).toBe("ft");
    expect(first?.min).toBe(1800);
    expect(first?.max).toBe(2200);
  });

  it("RVRNO = 显式缺测（不是组省略）", () => {
    const r = parse(byTrap("rvrno-explicit").raw);
    expect(r.runwayVisualRange?.kind).toBe("missing");
  });

  it("脏 QNH Q10054：值不可信 → missing + 超界告警（绝不留假值）", () => {
    const r = parse(byTrap("qnh-dirty").raw);
    expect(r.altimeter).toBeUndefined();
    expect(r.warnings.some((w) => w.code === "value-out-of-range")).toBe(true);
    expect(r.warnings.some((w) => w.span!.end - w.span!.start === 6)).toBe(true);
  });

  it("正常 QNH：Q1008 → 1008 hPa；A 组 → inHg 十进制", () => {
    const a2 = parse(fx("verified-a2").raw);
    expect(a2.altimeter).toMatchObject({ value: 1019, unit: "hPa" });
    const inHg = file.fixtures.find((f) => / A\d{4} /.test(f.raw));
    const r = parse(inHg!.raw);
    expect(r.altimeter?.unit).toBe("inHg");
    expect(r.altimeter?.value).toBeLessThan(40);
  });

  it("云高缺测不捏造（BKN/// → null）；云型位缺测不丢高度（SCT040/// → 4000）", () => {
    const r = parse(fx("verified-a5").raw);
    const clouds = r.clouds;
    const bknMissing = clouds?.elements.find(
      (e) => e.kind === "layer" && e.amount === "BKN" && e.heightFt.value === null,
    );
    expect(bknMissing).toBeDefined();
    expect(
      clouds?.elements.find((e) => e.kind === "layer" && e.amount === "FEW")?.heightFt.value,
    ).toBe(1000);

    const nz = parse(fx("corpus-063").raw);
    const nzClouds = nz.clouds;
    const sct = nzClouds?.elements.find((e) => e.kind === "layer" && e.amount === "SCT");
    if (sct?.kind === "layer") expect(sct.heightFt.value).toBe(4000);
    // 云型位缺测（SCT040///：云量/云高在位、型位 ///）——按 code + 原文形态断言，不匹配中文 message
    expect(
      nz.warnings.some(
        (w) =>
          w.code === "missing-expected" &&
          /^[A-Z]{3}\d{3}\/{3}$/.test(nz.raw.slice(w.span!.start, w.span!.end)),
      ),
    ).toBe(true);
  });

  it("MADIS 假报文：/////KT 风组缺测 + MADISHF 落 RMK unknown", () => {
    const r = parse(byTrap("madis-junk-row").raw);
    expect(r.wind?.kind).toBe("missing");
    expect(r.flags.auto).toBe(true);
    expect(r.remarks.some((m) => m.kind === "unknown" && m.raw.includes("MADISHF"))).toBe(true);
    expect(r.warnings.some((w) => w.code === "missing-expected")).toBe(true);
  });

  it("CLRD 摩擦系数解码（CLRD62 → 0.62）", () => {
    const r = parse(byTrap("clrd-friction").raw);
    expect(r.runwayStates[0]?.cleared).toBe(true);
    expect(r.runwayStates[0]?.frictionCoefficient).toBeCloseTo(0.62);
  });

  it("三正交标志位：AUTO / COR / SPECI 各就各位", () => {
    const eddf = parse(fx("verified-a3").raw);
    expect(eddf.flags.auto).toBe(true);
    expect(eddf.flags.corrected).toBe(false);
    expect(eddf.kind).toBe("metar");

    const omdb = parse(fx("verified-b7").raw);
    expect(omdb.kind).toBe("speci");

    const cor = file.fixtures.find((f) => f.raw.includes(" COR "));
    const r = parse(cor!.raw);
    expect(r.flags.corrected).toBe(true);
  });

  it("类型词双形态：IEM 剥词后由 options.kind 外部注入 SPECI", () => {
    const stripped = parse(byTrap("flags-type-auto-cor").raw);
    expect(stripped.kind).toBe("metar");
    const injected = parse(byTrap("flags-type-auto-cor").raw, { kind: "speci" });
    expect(injected.kind).toBe("speci");
  });

  it("温度负值与缺测（M10/M12 与 //）", () => {
    const r = parse(byTrap("vv-replaces-clouds").raw);
    expect(r.temperature?.celsius).toBe(-10);
    expect(r.dewpoint?.celsius).toBe(-12);
  });

  it("RE 近期天气组有家且不入 trends", () => {
    const re = file.fixtures.find((f) => /\sRE[A-Z]{2,}\s/.test(f.raw));
    const r = parse(re!.raw);
    expect(r.recentWeather?.length ?? 0).toBeGreaterThan(0);
    expect(r.trends.some((t) => t.raw.includes("RE"))).toBe(false);
  });

  it("BECMG 带 AT 时段（半结构化）", () => {
    const r = parse(fx("arc-zgsz-616e8960").raw);
    const becmg = r.trends.find((t) => t.kind === "becmg");
    expect(becmg?.period?.text).toBe("AT0040");
    expect(becmg?.raw).toContain("20005MPS");
  });

  it("US RMK 认组：PK WND / 维护符 / SLP 各有归处", () => {
    const maint = parse(byTrap("maintenance-indicator").raw);
    expect(maint.remarks.some((m) => m.kind === "maintenance")).toBe(true);
    const peak = file.fixtures.find((f) => f.raw.includes("PK WND"));
    const r = parse(peak!.raw);
    expect(r.remarks.some((m) => m.kind === "peak-wind")).toBe(true);
  });

  it("天气组强度与描述符（-FZDZ → 强度- + 描述符 FZ + 现象 DZ）", () => {
    const r = parse(byTrap("wx-fzdz").raw);
    const wx = unwrap(r.weather);
    const fzdz = wx?.find((g) => g.phenomena.includes("DZ"));
    expect(fzdz?.intensity).toBe("-");
    expect(fzdz?.descriptor).toBe("FZ");
  });

  it("REFC 判定为近期天气（漏斗云 RE 形态合法）", () => {
    const r = parse(fx("arc-zgsz-616e8960").raw);
    expect(r.recentWeather?.some((g) => g.phenomena.includes("FC") || g.proximity)).toBe(true);
  });

  it("冰雹 GR 与雷暴组实测命中", () => {
    const gr = parse(byTrap("wx-gr").raw);
    const grWx = unwrap(gr.weather)?.some(
      (g) => g.phenomena.includes("GR") || g.descriptor === "TS",
    );
    expect(grWx).toBe(true);
  });

  it("VV 顶替云组且与能见度正交", () => {
    const r = parse(byTrap("vv-replaces-clouds").raw);
    const clouds = r.clouds;
    expect(clouds?.elements.some((e) => e.kind === "vertical-visibility")).toBe(true);
    const vis = unwrap(r.visibility);
    expect(vis?.value).toBeGreaterThan(0);
  });

  it("未知 token 不静默（info 级告警 + 原文 span）", () => {
    const r = parse("METAR ZBAA 110700Z 30008MPS CAVOK 25/10 Q1010 XYZQ NOSIG");
    const unknown = r.warnings.find((w) => w.code === "unknown-token");
    expect(unknown?.severity).toBe("info");
    expect(r.raw.slice(unknown!.span!.start, unknown!.span!.end)).toBe("XYZQ");
  });

  it("美式 SLP 与 T 组进 RMK 认组（不告警）", () => {
    const r = parse(fx("verified-a4").raw);
    expect(r.remarks.some((m) => m.kind === "sea-level-pressure")).toBe(true);
    expect(r.warnings).toHaveLength(0);
  });
});

describe("整体失败契约（无站名/无时组 = 整体 throw，不是字段级三态）", () => {
  // 错误面已机读化：按 MetarParseError.code 断言（instanceof + code + raw），不匹配中文 message
  it("空输入与纯空白 → MetarParseError{code:'missing-station'}（raw 原样保留）", () => {
    expect(parseErrorOf("")).toBeInstanceOf(MetarParseError);
    expect(parseErrorOf("").code).toBe("missing-station");
    expect(parseErrorOf("   ").code).toBe("missing-station");
    expect(parseErrorOf("").raw).toBe("");
  });

  it("类型词后无合法站名 → MetarParseError{code:'missing-station'}", () => {
    const err = parseErrorOf("METAR 120000Z VRB02MPS CAVOK Q1009");
    expect(err.code).toBe("missing-station");
    expect(err.raw).toBe("METAR 120000Z VRB02MPS CAVOK Q1009");
  });

  it("站名后无时组 → MetarParseError{code:'missing-time'}", () => {
    expect(parseErrorOf("ZGGG VRB02MPS 9999 26/22 Q1009").code).toBe("missing-time");
  });
});

describe("天气组三态边界（回归锁）", () => {
  it("RE-only 报文：近期天气不参与当前天气三态——weather=undefined 且零告警", () => {
    const r = parse("ZGGG 120000Z VRB02MPS 9990 RESHRA 26/22 Q1009 NOSIG");
    expect(r.weather).toBeUndefined();
    expect(r.recentWeather?.some((g) => g.phenomena.includes("RA"))).toBe(true);
    expect(r.warnings).toHaveLength(0);
  });

  it("裸 // 天气缺测组 → weather missing + missing-expected 告警（温度正则不得吞掉）", () => {
    const r = parse(fx("arc-urwi-c15e35a0").raw);
    expect(r.weather?.kind).toBe("missing");
    if (r.weather?.kind === "missing") {
      expect(r.raw.slice(r.weather.span!.start, r.weather.span!.end)).toBe("//");
    }
    expect(
      r.warnings.some(
        (w) => w.code === "missing-expected" && r.raw.slice(w.span!.start, w.span!.end) === "//",
      ),
    ).toBe(true);
    expect(r.temperature?.celsius).toBe(22);
    expect(r.dewpoint?.celsius).toBe(0);
    // 同报 ///////// 云组三段全缺测也应如实收下
    expect(r.clouds?.elements.some((e) => e.heightFt.value === null)).toBe(true);
  });
});

describe("数值越界与 CAVOK 让位（发布前审查回归锁）", () => {
  it("时组数值越界（990099Z：日 99、分 99）→ MetarParseError{code:'invalid-time'}：时组两态必填无缺测形态，绝不把假值留在 IR", () => {
    expect(parseErrorOf("ZGGG 990099Z 27008KT 9999 26/22 Q1009").code).toBe("invalid-time");
    expect(parseErrorOf("ZGGG 312460Z 27008KT 9999 26/22 Q1009").code).toBe("invalid-time"); // 时 24、分 60
    // 边界内合法值不受影响
    expect(parse("ZGGG 310023Z 27008KT 9999 26/22 Q1009").time).toEqual({
      day: 31,
      hour: 0,
      minute: 23,
    });
  });

  it("风向越界（73015KT）：组内子项级判缺测——direction=null + value-out-of-range 告警，风速保留", () => {
    const r = parse("ZGGG 120000Z 73015KT 9999 26/22 Q1009");
    const wind = unwrap(r.wind);
    expect(r.wind?.kind).toBe("value");
    expect(wind?.direction).toBeNull();
    expect(unwrap(r.wind)?.variable).toBe(false);
    expect(unwrap(r.wind)?.speed.value).toBe(15);
    const warn = r.warnings.find((w) => w.code === "value-out-of-range");
    expect(warn).toBeDefined();
    expect(r.raw.slice(warn?.span!.start ?? 0, warn?.span!.end ?? 0)).toBe("73015KT");
  });

  it("风向变化组端点越界（30015KT 990V120）：变化组判缺测 + value-out-of-range 告警", () => {
    const r = parse("ZGGG 120000Z 30015KT 990V120 9999 26/22 Q1009");
    expect(unwrap(r.wind)?.variation).toBeUndefined();
    const warn = r.warnings.find((w) => w.code === "value-out-of-range");
    expect(warn).toBeDefined();
    expect(r.raw.slice(warn?.span!.start ?? 0, warn?.span!.end ?? 0)).toBe("990V120");
  });

  it("visibility.exact 语义统一：分数即精确值 exact=true，仅 M 前缀（小于阈值）与 9999 上限为 false", () => {
    const half = parse(fx("verified-c10").raw); // 实弹：单 token 分数 1/2SM
    expect(unwrap(half.visibility)?.exact).toBe(true);
    const mixed = parse(byTrap("vis-mixed-fraction").raw); // 实弹：跨 token 混分数 1 1/4SM
    expect(unwrap(mixed.visibility)?.exact).toBe(true);
    const below = parse("PANC 151253Z VRB03KT M1/4SM FG VV002 07/07 A2964");
    expect(unwrap(below.visibility)?.exact).toBe(false);
    const ceil = parse("ZGGG 120000Z 27008KT 9999 26/22 Q1009");
    expect(unwrap(ceil.visibility)?.exact).toBe(false);
  });

  it("乱序天气组（RATS）：切解进 weather + invalid-format 告警；正序 TSRA 零告警", () => {
    const rats = parse("ZGGG 120000Z 27008KT 9999 RATS 26/22 Q1009");
    expect(
      unwrap(rats.weather)?.some((g) => g.descriptor === "TS" && g.phenomena.includes("RA")),
    ).toBe(true);
    const warn = rats.warnings.find((w) => w.code === "invalid-format");
    expect(warn).toBeDefined();
    expect(rats.raw.slice(warn?.span!.start ?? 0, warn?.span!.end ?? 0)).toBe("RATS");

    const tsra = parse("ZGGG 120000Z 27008KT 9999 TSRA 26/22 Q1009");
    expect(
      unwrap(tsra.weather)?.some((g) => g.descriptor === "TS" && g.phenomena.includes("RA")),
    ).toBe(true);
    expect(tsra.warnings).toHaveLength(0);
  });

  it("IR v0.1 现状锁定：seaLevelPressure / preciseTemperature / preciseDewpoint 暂不填充，数值在 remarks 可取", () => {
    const r = parse(fx("corpus-048").raw); // RMK AO2 SLP231 T01940167 $
    expect(r.seaLevelPressure).toBeUndefined();
    expect(r.preciseTemperature).toBeUndefined();
    expect(r.preciseDewpoint).toBeUndefined();
    expect(r.remarks.some((m) => m.kind === "sea-level-pressure")).toBe(true);
    expect(r.remarks.some((m) => m.kind === "precise-temperature")).toBe(true);
  });

  it("前序组+CAVOK 共存（9999 CAVOK）：vis/weather/cloud 三组让位为 undefined，cavok=true", () => {
    const r = parse(byTrap("cavok-preceding-yields").raw);
    expect(r.cavok).toBe(true);
    expect(r.visibility).toBeUndefined();
    expect(r.weather).toBeUndefined();
    expect(r.clouds).toBeUndefined();
    expect(r.raw.slice(r.cavokSpan?.start ?? 0, r.cavokSpan?.end ?? 0)).toBe("CAVOK");
  });

  it("温度/露点形态直接断言：裸 // 与 /// 不得被匹配（// 是天气缺测组，不是温度缺测）", () => {
    // 红线：若本形态吞掉裸 //，天气缺测组会被误判为温度组（// 天气缺测三态随之丢失）
    expect(TEMP_DEW_PATTERN.test("//")).toBe(false);
    expect(TEMP_DEW_PATTERN.test("///")).toBe(false);
    // 合法形态：双值 / 负值 / 单侧缺测（缺测侧为完整 //，配分隔斜杠成 26///、///09）
    expect(TEMP_DEW_PATTERN.test("26/22")).toBe(true);
    expect(TEMP_DEW_PATTERN.test("M05/M10")).toBe(true);
    expect(TEMP_DEW_PATTERN.test("26///")).toBe(true);
    expect(TEMP_DEW_PATTERN.test("///09")).toBe(true);
  });
});

describe("解析形态回归（七项高频真实报文形态）", () => {
  it("VCSH 机场附近阵性降水：VC + SH 无现象形态放行为天气组（WMO 4678 特批）；VCTS 行为不变", () => {
    const r = parse(byTrap("wx-vcsh").raw);
    const vcsh = unwrap(r.weather)?.find((g) => g.proximity && g.descriptor === "SH");
    expect(vcsh).toBeDefined();
    expect(vcsh?.phenomena).toHaveLength(0);
    expect(vcsh?.intensity).toBeUndefined();

    const vcts = parse("ZGGG 120000Z 27008KT 9999 VCTS 26/22 Q1009");
    const ts = unwrap(vcts.weather)?.find((g) => g.proximity && g.descriptor === "TS");
    expect(ts).toBeDefined();
    expect(vcts.warnings).toHaveLength(0);

    // 非 VC 的裸 SH（缺现象）仍不合法——不得因 VCSH 放行而漏水
    const bare = parse("ZGGG 120000Z 27008KT 9999 SH 26/22 Q1009");
    expect(bare.warnings.some((w) => w.code === "unknown-token")).toBe(true);
  });

  it("能见度 NDV 后缀剥离：9999NDV / 6000NDV 正常解析，不落 unknown", () => {
    const skmd = parse(fx("target-ndv-skmd").raw);
    expect(unwrap(skmd.visibility)).toMatchObject({ value: 9999, unit: "m", exact: false });
    const skui = parse(fx("target-ndv-skui").raw);
    expect(unwrap(skui.visibility)).toMatchObject({ value: 6000, unit: "m", exact: true });
    expect(skmd.warnings.some((w) => w.code === "unknown-token")).toBe(false);
  });

  it("P6SM 美式超上限能见度：解析为 6SM、exact=false（阈值性编码，与 9999/M 前缀同族）", () => {
    const r = parse(fx("synth-p6sm").raw);
    expect(unwrap(r.visibility)).toMatchObject({ value: 6, unit: "sm", exact: false });
    expect(r.warnings.some((w) => w.code === "unknown-token")).toBe(false);
  });

  it("FAA/加式斜杠趋势 RVR：FT/斜杠/趋势三合一进既有 RVR 模型；无斜杠老形态不回归", () => {
    const cyqr = parse(fx("target-rvrslash-cyqr").raw);
    expect(unwrap(cyqr.runwayVisualRange)?.[0]).toMatchObject({
      runway: "13",
      min: 2400,
      max: 3000,
      unit: "ft",
      trend: "no-change",
    });
    const cyow = parse(fx("target-rvrslash-cyow").raw);
    expect(unwrap(cyow.runwayVisualRange)?.[0]).toMatchObject({
      runway: "07",
      value: 6000,
      unit: "ft",
      beyondRange: "above",
      trend: "up",
    });
    // 数值形 VV010 顺带断言（1000 ft）
    const vv = cyow.clouds?.elements.find((e) => e.kind === "vertical-visibility");
    expect(vv?.heightFt.value).toBe(1000);
    // 无斜杠形态维持
    const plain = parse("ZGGG 120000Z 27008KT 1000 R36/0500V0800D 26/22 Q1009");
    expect(unwrap(plain.runwayVisualRange)?.[0]).toMatchObject({
      min: 500,
      max: 800,
      trend: "down",
    });
  });

  it("报尾 = 终结符剥离：Q1006= 与 NOSIG= 都不再把前组拖进 unknown；raw 保真含 =", () => {
    const q = parse(fx("synth-equals-q").raw);
    expect(q.altimeter).toMatchObject({ value: 1006, unit: "hPa" });
    expect(q.warnings).toHaveLength(0);
    expect(q.raw.endsWith("=")).toBe(true);
    const nosig = parse(fx("synth-equals-nosig").raw);
    expect(nosig.trends[0]?.kind).toBe("nosig");
    expect(nosig.warnings).toHaveLength(0);
  });

  it("CLRD 标准形态 R11/CLRD//（清除 + 两位斜杠摩擦缺测）：进 runwayStates，摩擦 undefined", () => {
    const r = parse(fx("target-clrd-unkl").raw);
    expect(r.runwayStates[0]).toMatchObject({ runway: "11", cleared: true });
    expect(r.runwayStates[0]?.frictionCoefficient).toBeUndefined();
    expect(r.warnings.some((w) => w.code === "unknown-token")).toBe(false);
  });

  it("VV/// 垂直能见度缺测：收下为 null 基高 + missing-expected 告警（裸 VV 兼容保留）", () => {
    const r = parse(fx("synth-vv-solidi").raw);
    const vv = r.clouds?.elements.find((e) => e.kind === "vertical-visibility");
    expect(vv?.heightFt.value).toBeNull();
    // 按 code + span 原文（VV 词）断言缺测告警，不匹配中文 message
    expect(
      r.warnings.some(
        (w) =>
          w.code === "missing-expected" && r.raw.slice(w.span!.start, w.span!.end).startsWith("VV"),
      ),
    ).toBe(true);
    const bare = parse("ZBAA 120000Z 00000MPS 0800 FG VV 05/04 Q1024");
    expect(
      bare.clouds?.elements.find((e) => e.kind === "vertical-visibility")?.heightFt.value,
    ).toBeNull();
  });
});

describe("语义级交叉校验（cross-check-conflict 告警）", () => {
  it("温露倒挂（22/25）物理不可能：保留两组值 + cross-check-conflict 告警（span 指温度组）", () => {
    const r = parse("ZGGG 120000Z 27008KT 9999 22/25 Q1009");
    expect(r.temperature?.celsius).toBe(22);
    expect(r.dewpoint?.celsius).toBe(25);
    const warn = r.warnings.find((w) => w.code === "cross-check-conflict");
    expect(warn?.severity).toBe("warning");
    expect(warn?.message).toContain("22/25");
    expect(warn?.message).toContain("传感器故障");
    expect(r.raw.slice(warn?.span!.start ?? 0, warn?.span!.end ?? 0)).toBe("22/25");
  });

  it("温露相等（24/24 饱和态）与正常差值（26/22）不告警", () => {
    expect(parse("ZGGG 120000Z 27008KT 9999 24/24 Q1009").warnings).toHaveLength(0);
    expect(parse("ZGGG 120000Z 27008KT 9999 26/22 Q1009").warnings).toHaveLength(0);
  });

  it("CAVOK 与前序低能见度矛盾（0500 CAVOK）：让位行为保持 + cross-check-conflict 告警（span 指 CAVOK 词）", () => {
    const r = parse("ZGGG 120000Z 27008KT 0500 CAVOK 26/22 Q1009");
    expect(r.cavok).toBe(true);
    expect(r.visibility).toBeUndefined(); // 让位契约不变
    const warn = r.warnings.find((w) => w.code === "cross-check-conflict");
    expect(warn).toBeDefined();
    expect(warn?.message).toContain("0500");
    expect(r.raw.slice(warn?.span!.start ?? 0, warn?.span!.end ?? 0)).toBe("CAVOK");
  });

  it("自洽共存不告警：9999 CAVOK（下界语义相容）与无前序能见度的 CAVOK", () => {
    expect(parse(byTrap("cavok-preceding-yields").raw).warnings).toHaveLength(0);
    expect(parse(fx("verified-a2").raw).warnings).toHaveLength(0);
    // P6SM（>6SM 下界语义）与 CAVOK 相容——不下界误报
    expect(parse("ZGGG 120000Z 27008KT P6SM CAVOK 26/22 Q1009").warnings).toHaveLength(0);
  });
});

describe("跑道状态完整建模（WMO 15.13.6 三形态）", () => {
  it("深度电码 92–98 段：10–40cm 段记下限毫米（92→100 … 98→400，WMO 表 1079）", () => {
    for (const [code, mm] of [
      ["92", 100],
      ["95", 250],
      ["98", 400],
    ] as const) {
      expect(runwayDepthOf(`29${code}95`)).toBe(mm);
    }
  });

  it("六位状态电码（R21/490160）：沉积 4 干雪 / 覆盖 9 / 深度 1mm / 摩擦 0.60，进 runwayStates", () => {
    const r = parse(fx("target-rwystate-uspp").raw);
    expect(r.runwayStates[0]).toMatchObject({
      runway: "21",
      cleared: false,
      deposit: 4,
      coverage: 9,
      depth: 1,
      frictionCoefficient: 0.6,
    });
    expect(r.warnings.some((w) => w.code === "unknown-token")).toBe(false);
  });

  it("带方位字母的六位电码（R13R/550237）：湿雪 / 26–50% / 2mm / 摩擦 0.37", () => {
    const r = parse(fx("target-rwystate-uudd").raw);
    expect(r.runwayStates[0]).toMatchObject({
      runway: "13R",
      deposit: 5,
      coverage: 5,
      depth: 2,
      frictionCoefficient: 0.37,
    });
  });

  it("缺测位与深度 99（R31L///99//）：deposit/coverage null、closed=true（跑道不可用）、摩擦缺报", () => {
    const r = parse(fx("target-rwystate-uudd-99").raw);
    expect(r.runwayStates[0]).toMatchObject({
      runway: "31L",
      deposit: null,
      coverage: null,
      depth: null,
      closed: true,
    });
    expect(r.runwayStates[0]?.frictionCoefficient).toBeUndefined();
    expect(r.warnings.some((w) => w.code === "unknown-token")).toBe(false);
  });

  it("摩擦位 91–95 制动作用五档与 99 不可靠（与摩擦系数互斥）", () => {
    const good = parse("UUDD 150000Z 25001MPS 5000 -SN OVC015 M09/M11 Q1022 R13R/550295 NOSIG");
    expect(good.runwayStates[0]?.brakingAction).toBe("good");
    expect(good.runwayStates[0]?.frictionCoefficient).toBeUndefined();
    const poor = parse("UUDD 150000Z 25001MPS 5000 -SN OVC015 M09/M11 Q1022 R13R/550291 NOSIG");
    expect(poor.runwayStates[0]?.brakingAction).toBe("poor");
    const un = parse("UUDD 150000Z 25001MPS 5000 -SN OVC015 M09/M11 Q1022 R13R/550299 NOSIG");
    expect(un.runwayStates[0]?.brakingAction).toBe("unreliable");
  });

  it("SNOCLO 迁移：R24L/SNOCLO（逐跑道）与 R/SNOCLO（全机场）→ runwayStates.closed，不再落 runwayVisualRange missing", () => {
    const r = parse(fx("synth-snoclo").raw);
    expect(r.runwayStates[0]).toMatchObject({ runway: "24L", closed: true, cleared: false });
    expect(r.runwayVisualRange).toBeUndefined();
    const all = parse("UUDD 030000Z 12003MPS 9999 -SN OVC010 M05/M06 Q1029 R/SNOCLO NOSIG");
    expect(all.runwayStates[0]).toMatchObject({ runway: "", closed: true });
    expect(all.runwayVisualRange).toBeUndefined();
    // RVRNO 语义不受迁移牵连（设备明示不可用仍是 rvr missing）
    const rvrno = parse(byTrap("rvrno-explicit").raw);
    expect(rvrno.runwayVisualRange?.kind).toBe("missing");
  });
});

describe("第二轮复评修复：趋势段收口（RMK / 跑道状态不被吞）", () => {
  // RU__ASOS 实弹：61/65 条、KZ__ASOS 18/18 条命中本雷（2026-09-12 09Z 采样）
  it("NOSIG 后 RMK 不再被趋势段吞（RU 实弹 UNOO）：QFE 进 remarks、趋势 raw 截在 NOSIG、零告警", () => {
    const r = parse("UNOO 120930Z 17006MPS CAVOK 30/08 Q1010 R07/CLRD63 NOSIG RMK QFE749");
    expect(r.trends).toHaveLength(1);
    expect(r.trends[0]?.raw).toBe("NOSIG");
    expect(r.remarks.some((m) => m.raw === "QFE749")).toBe(true);
    expect(r.warnings).toHaveLength(0);
  });

  it("同族词序防御：趋势后跟跑道状态组（NOSIG R01/290150）不吞，runwayStates 各归其位", () => {
    const r = parse(
      "UUDD 120900Z 30003MPS 8000 -SHRA BKN024CB 14/14 Q1009 NOSIG R01/290150 RMK QFE746",
    );
    expect(r.trends[0]?.raw).toBe("NOSIG");
    expect(r.runwayStates[0]).toMatchObject({
      runway: "01",
      deposit: 2,
      coverage: 9,
      depth: 1,
      frictionCoefficient: 0.5,
    });
    expect(r.remarks.some((m) => m.raw === "QFE746")).toBe(true);
    // 收口分家照旧；2026-09 二轮复评后补一条趋势收口 info 提示（语境存疑出声，不静默）
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]?.code).toBe("invalid-format");
    expect(r.raw.slice(r.warnings[0]!.span!.start, r.warnings[0]!.span!.end)).toBe("R01/290150");
  });

  it("NOSIG 后 RMK 多组国家附加段（USPP 实弹）：R03/32002MPS QBB150 QFE746/0995 全进 remarks", () => {
    const r = parse(
      "USPP 120930Z 33002MPS 260V010 8000 -SHRA SCT005 BKN024CB 14/14 Q1009 R03/290150 NOSIG RMK R03/32002MPS QBB150 QFE746/0995",
    );
    expect(r.trends[0]?.raw).toBe("NOSIG");
    expect(r.remarks.some((m) => m.raw === "QBB150")).toBe(true);
    expect(r.remarks.some((m) => m.raw === "QFE746/0995")).toBe(true);
    expect(r.warnings).toHaveLength(0);
  });

  it("RMK 词身粘连（NOSIG RMKQFE749/0998，fuzz 实弹 35/5 万例命中）：趋势段不吞、粘连 token 进 remarks", () => {
    // 根因：收口与段入口原为等值判据 text === "RMK"，粘连形态绕过两处——趋势段整吞 RMK 段
    const r = parse("URMT 120930Z 15003MPS 100V220 CAVOK 28/03 Q1019 R07/010070 NOSIG RMKQFE724");
    expect(r.trends[0]?.raw).toBe("NOSIG");
    expect(r.trends[0]?.raw).not.toContain("RMK");
    expect(r.remarks.some((m) => m.raw === "RMKQFE724")).toBe(true);
    // 磨损词身不猜语义：粘连 token 认 unknown（RMK 段的诚实归宿），后续正规组照常认组
    expect(r.remarks.find((m) => m.raw === "RMKQFE724")?.kind).toBe("unknown");
    const tail = parse("UUOL 120900Z 27004MPS 9999 SCT047 19/08 Q1019 NOSIG RMKQFE749/0998 QBB150");
    expect(tail.trends[0]?.raw).toBe("NOSIG");
    expect(tail.remarks.find((m) => m.raw === "RMKQFE749/0998")?.kind).toBe("unknown");
    expect(tail.remarks.some((m) => m.raw === "QBB150")).toBe(true);
  });
});

describe("第二轮复评修复：QNH/A 物理范围校验", () => {
  it("Q 组越界（Q0000→0hPa、Q1087）判缺测 + value-out-of-range 告警（与 Q10054 同纪律）", () => {
    const q0 = parse("ZGGG 120000Z 00000KT 9999 26/22 Q0000");
    expect(q0.altimeter).toBeUndefined();
    const w0 = q0.warnings.find((x) => x.code === "value-out-of-range");
    expect(w0).toBeDefined();
    expect(q0.raw.slice(w0?.span!.start ?? 0, w0?.span!.end ?? 0)).toBe("Q0000");

    const qHi = parse("ZGGG 120000Z 00000KT 9999 26/22 Q1087");
    expect(qHi.altimeter).toBeUndefined();
    expect(qHi.warnings.some((x) => x.code === "value-out-of-range")).toBe(true);
  });

  it("Q 组边界合法（Q0800/Q1084，覆盖世界气压极值邻域），不误伤正常值", () => {
    expect(parse("ZGGG 120000Z 00000KT 9999 26/22 Q0800").altimeter).toMatchObject({
      value: 800,
      unit: "hPa",
    });
    expect(parse("ZGGG 120000Z 00000KT 9999 26/22 Q1084").altimeter).toMatchObject({
      value: 1084,
    });
    expect(parse("ZGGG 120000Z 00000KT 9999 26/22 Q1009").warnings).toHaveLength(0);
  });

  it("A 组越界（A9999→99.99inHg）判缺测 + 告警；A2992 正常", () => {
    const a = parse("KCLT 120955Z AUTO 16012KT 10SM FEW018 29/24 A9999");
    expect(a.altimeter).toBeUndefined();
    expect(a.warnings.some((x) => x.code === "value-out-of-range")).toBe(true);
    const ok = parse("KCLT 120955Z AUTO 16012KT 10SM FEW018 29/24 A2992");
    expect(ok.altimeter).toMatchObject({ value: 29.92, unit: "inHg" });
    expect(ok.warnings).toHaveLength(0);
  });
});

describe("第二轮复评修复：NIL 一等建模", () => {
  it("NIL 报文：nil=true、正文组不解析、remarks 空、零告警（站名/时组凭据保留）", () => {
    const r = parse("METAR ZBAA 120300Z NIL=");
    expect(r.station).toBe("ZBAA");
    expect(r.time).toEqual({ day: 12, hour: 3, minute: 0 });
    expect(r.nil).toBe(true);
    expect(r.raw).toBe("METAR ZBAA 120300Z NIL=");
    expect(r.wind).toBeUndefined();
    expect(r.trends).toHaveLength(0);
    expect(r.remarks).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
  });

  it("E5 夹具锁（降级如实记录）：tgftp 当日 00–13Z 共 14 个全量 cycle 约 87 万行实测零 NIL——按夹具锁定形态", () => {
    const r = parse(fx("synth-nil-report").raw);
    expect(r.nil).toBe(true);
    expect(r.station).toBe("ZGGG");
    expect(r.warnings).toHaveLength(0);
    // 紧凑模式与 NIL 正交（出口剥除不触碰 nil 凭据）
    const compact = parse(fx("synth-nil-report").raw, { spans: false });
    expect(compact.nil).toBe(true);
  });
});

describe("第二轮复评修复：三态告警口径统一", () => {
  it("//// 能见度显式缺测补 info 告警（对齐风/天气缺测口径）", () => {
    const r = parse("ZGGG 120000Z 00000KT //// 26/22 Q1009");
    expect(r.visibility?.kind).toBe("missing");
    const w = r.warnings.find((x) => x.code === "missing-expected");
    expect(w?.severity).toBe("info");
    expect(r.raw.slice(w?.span!.start ?? 0, w?.span!.end ?? 0)).toBe("////");
  });

  it("合法 VV002 零告警（missing-expected 只配缺测电码形态）；VV/// 仍告警", () => {
    const ok = parse("ZBAA 120000Z 00000MPS 0800 FG VV002 05/04 Q1024");
    const vv = ok.clouds?.elements[0];
    expect(vv?.kind).toBe("vertical-visibility");
    expect(vv?.kind === "vertical-visibility" ? vv.heightFt.value : null).toBe(200);
    expect(ok.warnings).toHaveLength(0);
    const miss = parse(fx("synth-vv-solidi").raw);
    expect(
      miss.warnings.some(
        (x) =>
          x.code === "missing-expected" &&
          miss.raw.slice(x.span!.start, x.span!.end).startsWith("VV"),
      ),
    ).toBe(true);
  });
});

describe("第二轮复评修复：RMK 识别面补齐", () => {
  it("A01/A02 数字形态（tgftp 实弹 268 站次）进 remarks auto-type；字母 AO1/AO2 不回归", () => {
    const r = parse("KOYE 120750Z AUTO 16012KT 10SM FEW018 29/24 A2992 RMK A01");
    expect(r.remarks.some((m) => m.kind === "auto-type" && m.raw === "A01")).toBe(true);
    const ao2 = parse("KCNC 120915Z AUTO 20011KT 10SM CLR 20/20 A2981 RMK AO2");
    expect(ao2.remarks.some((m) => m.kind === "auto-type" && m.raw === "AO2")).toBe(true);
  });

  it("冰积组 FMH-1 形态 I+间隔位+3 位量值（I1001）进 ice-accretion（原正则多吞一位）", () => {
    const r = parse("KXYZ 120953Z AUTO 00000KT 10SM CLR 10/05 A3000 RMK I1001");
    expect(r.remarks.some((m) => m.kind === "ice-accretion" && m.raw === "I1001")).toBe(true);
  });

  it("began/ended 合并形态 FZRAB43E50 进 phenomenon-began-ended；拆分形态 RAB42/RAE50 不回归", () => {
    const r = parse("KXYZ 121253Z AUTO 00000KT 2SM FZRA OVC010 05/04 A2995 RMK FZRAB43E50");
    expect(
      r.remarks.some((m) => m.kind === "phenomenon-began-ended" && m.raw === "FZRAB43E50"),
    ).toBe(true);
    const split = parse("KXYZ 121253Z AUTO 00000KT 2SM RA OVC010 15/14 A2995 RMK RAB42 RAE50");
    expect(split.remarks.filter((m) => m.kind === "phenomenon-began-ended")).toHaveLength(2);
  });

  it("变化能见度 VIS 1/4V1/2：两 token 合并进 variable-visibility（IR 声明补实现）", () => {
    const r = parse("PANC 151253Z VRB03KT 1/4SM FG VV002 07/07 A2964 RMK VIS 1/4V1/2");
    const vis = r.remarks.find((m) => m.kind === "variable-visibility");
    expect(vis?.raw).toBe("VIS 1/4V1/2");
  });

  it("SNINCR 6/2（积雪增率）两 token 认组进 snow-increase", () => {
    const r = parse("KXYZ 121453Z AUTO 00000KT 1/2SM SN OVC008 00/M03 A3001 RMK SNINCR 6/2");
    expect(r.remarks.some((m) => m.kind === "snow-increase" && m.raw === "SNINCR 6/2")).toBe(true);
  });

  it("LTG 多 token 聚合：LTG IC CG OHD NE / LTG ALQDS 一并收进 lightning，方位词不再散落", () => {
    const r = parse("KXYZ 121953Z AUTO 21010KT 6SM -RA BR OVC010 22/20 A3005 RMK LTG IC CG OHD NE");
    expect(r.remarks.find((m) => m.kind === "lightning")?.raw).toBe("LTG IC CG OHD NE");
    const alqds = parse("KXYZ 121953Z AUTO 21010KT 6SM VCTS OVC010 22/20 A3005 RMK LTG ALQDS");
    expect(alqds.remarks.find((m) => m.kind === "lightning")?.raw).toBe("LTG ALQDS");
    // 词表外 token 不越界吞噬（RWY 不在雷电视词表）
    const bounded = parse("KXYZ 121953Z AUTO 21010KT 6SM VCTS OVC010 22/20 A3005 RMK LTG DSNT RWY");
    expect(bounded.remarks.find((m) => m.kind === "lightning")?.raw).toBe("LTG DSNT");
    expect(bounded.remarks.some((m) => m.kind === "unknown" && m.raw === "RWY")).toBe(true);
  });
});

describe("第二轮复评修复：双气压组", () => {
  it("双 Q 组：末组为准 + duplicate-group/warning（重复组专用码，前值后值都在 message）", () => {
    const r = parse("ZGGG 120000Z 00000KT 9999 26/22 Q1009 Q1013");
    expect(r.altimeter).toMatchObject({ value: 1013, unit: "hPa" });
    const w = r.warnings.find((x) => x.code === "duplicate-group");
    expect(w?.severity).toBe("warning");
    expect(w?.message).toContain("Q1009");
    expect(w?.message).toContain("Q1013");
    expect(r.raw.slice(w?.span!.start ?? 0, w?.span!.end ?? 0)).toBe("Q1013");
  });

  it("Q/A 混形重复同理告警；单组零告警不回归", () => {
    const mixed = parse("ZGGG 120000Z 00000KT 9999 26/22 Q1009 A3022");
    expect(mixed.altimeter).toMatchObject({ value: 30.22, unit: "inHg" });
    expect(mixed.warnings.some((x) => x.code === "duplicate-group")).toBe(true);
    expect(parse("ZGGG 120000Z 00000KT 9999 26/22 Q1009").warnings).toHaveLength(0);
  });
});

describe("parse 输入校验（取数层错误质量对齐）", () => {
  it("非字符串输入 → 人话错误（undefined / null / number）", () => {
    expect(() => parse(undefined as unknown as string)).toThrow(
      "parse 需要一个 METAR/SPECI 报文字符串，收到 undefined",
    );
    expect(() => parse(null as unknown as string)).toThrow("收到 null");
    expect(() => parse(123 as unknown as string)).toThrow("收到 number");
  });
});

describe("A 批：混分数零分母（1/0SM 家族）——值不可信判缺测，绝不留 Infinity/NaN", () => {
  it("单 token 零分母：1/0SM / 0/0SM / M1/0SM → missing + 超界告警（QNH 超界同款纪律）", () => {
    zeroDenominator("ZSPD 120000Z 00000KT 1/0SM 26/22 Q1009", "1/0SM");
    zeroDenominator("ZSPD 120000Z 00000KT 0/0SM 26/22 Q1009", "0/0SM");
    zeroDenominator("ZSPD 120000Z 00000KT M1/0SM 26/22 Q1009", "M1/0SM");
  });

  it("混合整数形态零分母：1 0/0SM → missing + 告警，span 覆盖整数与分数两个 token", () => {
    zeroDenominator("ZSPD 120000Z 00000KT 1 0/0SM 26/22 Q1009", "1 0/0SM");
  });

  it("合法分数回归锁：1/2SM 精确值不受影响（零告警）", () => {
    const r = parse("ZSPD 120000Z 00000KT 1/2SM 26/22 Q1009");
    expect(unwrap(r.visibility)).toMatchObject({ value: 0.5, unit: "sm", exact: true });
    expect(r.warnings).toHaveLength(0);
    const mixed = parse("CYOW 041700Z 28015KT 1 1/2SM -SN M08/M12 A3006");
    expect(unwrap(mixed.visibility)?.value).toBeCloseTo(1.5);
    expect(mixed.warnings).toHaveLength(0);
  });
});

describe("A 批：strict 模式错误契约（错误面机读化）", () => {
  it("mode:'strict' → MetarParseError{code:'unsupported-mode'}（不再是裸 Error）", () => {
    const raw = "METAR ZBAA 110700Z VRB02MPS CAVOK 25/10 Q1019 NOSIG";
    const err = parseErrorOf(raw, { mode: "strict" });
    expect(err).toBeInstanceOf(MetarParseError);
    expect(err.code).toBe("unsupported-mode");
    expect(err.raw).toBe(raw);
  });

  it("缺省与显式 tolerant 不受影响（回归锁）", () => {
    const raw = "METAR ZBAA 110700Z VRB02MPS CAVOK 25/10 Q1019 NOSIG";
    expect(parse(raw).station).toBe("ZBAA");
    expect(parse(raw, { mode: "tolerant" }).station).toBe("ZBAA");
  });
});

describe("D 批：////SM 英里制能见度缺测（与米制 //// 正交）", () => {
  it("加拿大实弹（CYUS）：////SM → visibility missing + missing-expected 告警（span 指 ////SM）", () => {
    const r = parse(fx("target-solidism-cyus").raw);
    expect(r.visibility?.kind).toBe("missing");
    if (r.visibility?.kind === "missing") {
      expect(r.raw.slice(r.visibility.span!.start, r.visibility.span!.end)).toBe("////SM");
    }
    const w = r.warnings.find((x) => x.code === "missing-expected");
    expect(w?.severity).toBe("info");
    expect(r.raw.slice(w?.span!.start ?? 0, w?.span!.end ?? 0)).toBe("////SM");
    // 同报 ////// 云组量/高双缺测不受牵连（各归其位）
    expect(r.clouds?.elements.some((e) => e.heightFt.value === null)).toBe(true);
  });

  it("米制 //// 行为不变（正交回归锁）；风缺测报文（CWLI 实弹）能见度/云组各归其位", () => {
    const m = parse("ZGGG 120000Z 00000KT //// 26/22 Q1009");
    expect(m.visibility?.kind).toBe("missing");
    if (m.visibility?.kind === "missing") {
      expect(m.raw.slice(m.visibility.span!.start, m.visibility.span!.end)).toBe("////");
    }
    // CWLI 的裸 /////（无单位后缀）在既有行为里匹配温度组双缺测形态（后被 09/08 覆盖）——
    // 本测试锁定 ////SM 引入后该行各组的既有归属不变：能见度/云缺测在位、温露取实值、零 unknown
    const cwli = parse(
      "CWLI 120900Z AUTO ///// ////SM ////// 09/08 A2961 RMK WND MISG VIS MISG CLD MISG T00860083 SLP030",
    );
    expect(cwli.visibility?.kind).toBe("missing");
    expect(cwli.clouds?.elements.some((e) => e.heightFt.value === null)).toBe(true);
    expect(cwli.temperature?.celsius).toBe(9);
    expect(cwli.dewpoint?.celsius).toBe(8);
    expect(cwli.warnings.some((x) => x.code === "unknown-token")).toBe(false);
    expect(
      cwli.warnings.filter((x) => x.code === "missing-expected").length,
    ).toBeGreaterThanOrEqual(3);
  });
});

/** 紧凑模式断言用：递归校验 span/cavokSpan 键值一律 undefined */
const assertNoSpans = (node: unknown): void => {
  if (Array.isArray(node)) {
    for (const item of node) assertNoSpans(item);
    return;
  }
  if (node !== null && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "span" || key === "cavokSpan") {
        expect(value, `紧凑模式的 ${key} 必须为 undefined`).toBeUndefined();
      } else {
        assertNoSpans(value);
      }
    }
  }
};

/** 剥 span 深度对比用：返回去除 span/cavokSpan 的结构副本 */
const stripSpansOf = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(stripSpansOf);
  if (node !== null && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "span" || key === "cavokSpan") continue;
      out[key] = stripSpansOf(value);
    }
    return out;
  }
  return node;
};

describe("E 批：紧凑模式 spans:false（JSON 体积优化——值语义与默认完全一致）", () => {
  const RICH =
    "USPP 120930Z 33002MPS 260V010 8000 -SHRA SCT005 BKN024CB 14/14 Q1009 R03/290150 NOSIG RMK QFE746/0995";

  it("全部 span 字段为 undefined（递归遍历：span/cavokSpan 键值一律 undefined；JSON 序列化零 span）", () => {
    const r = parse(RICH, { spans: false });
    assertNoSpans(r);
    const cav = parse("ZGGG 120000Z 27008KT 0500 CAVOK 26/22 Q1009", { spans: false });
    expect(JSON.stringify(cav)).not.toContain("span");
    expect(JSON.stringify(r)).not.toContain('"span"');
  });

  it("值语义与默认模式完全一致（同报文双模式 toValues 剥 span 后深度相等）", () => {
    const full = toValues(parse(RICH));
    const compact = toValues(parse(RICH, { spans: false }));
    expect(stripSpansOf(compact)).toEqual(stripSpansOf(full));
    // 含告警报文同理（告警 span 剥离后 code/severity/message 一致）
    const dirtyFull = toValues(parse("ZGGG 120000Z 73015KT 1/0SM 26/22 Q1009"));
    const dirtyCompact = toValues(
      parse("ZGGG 120000Z 73015KT 1/0SM 26/22 Q1009", { spans: false }),
    );
    expect(stripSpansOf(dirtyCompact.warnings)).toEqual(stripSpansOf(dirtyFull.warnings));
  });

  it("raw 原样保真不随模式变化；缺省（不传 spans）行为与旧版一致仍带 span", () => {
    const compact = parse(RICH, { spans: false });
    expect(compact.raw).toBe(RICH);
    const full = parse(RICH);
    expect(full.wind).toMatchObject({ kind: "value" });
    if (full.wind?.kind === "value") {
      expect(full.wind.span).toBeDefined();
    }
  });
});

describe("E 批：紧凑模式性能冒烟（重建式剥除的性能回归锁）", () => {
  // 语料池：仓内 corpus 全量去重后重复到 6 万行（与 corpus.test.ts 同款读取口径）
  const corpusDir = fileURLToPath(new URL("../../../corpus/", import.meta.url));
  const pool: string[] = [];
  for (const f of readdirSync(corpusDir).filter((x) => x.endsWith(".txt"))) {
    for (const l of readFileSync(`${corpusDir}${f}`, "utf8").split("\n")) {
      const t = l.replace(/\r$/, "").trim();
      if (t !== "" && !/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/.test(t)) pool.push(t);
    }
  }
  while (pool.length < 20_000) pool.push(...pool);

  const runOnce = (opts: ParseOptions | undefined): number => {
    const t0 = performance.now();
    for (let i = 0; i < pool.length; i++) parse(pool[i] ?? "", opts);
    return pool.length / (performance.now() - t0);
  };

  it("紧凑吞吐不低于全模式 36%（中位）——阈值理由（2026-09-12 实测）：重建式剥除 vitest 五轮中位实测 0.40–0.41（独立 node 基准 40.6 万 vs 72.8 万行/秒 = 0.56，环境差来自测试运行器 GC 节奏）；旧 Reflect.deleteProperty 剥除同口径中位实测 0.32–0.33（V8 dictionary mode，独立基准 23.0 万行/秒）——低于 0.36 即性能回退到 deletion 量级", () => {
    // JIT 预热（两种模式都热身，GC 欠账在测量前清偿）
    for (let i = 0; i < 10_000; i++) {
      parse(pool[i] ?? "");
      parse(pool[i] ?? "", { spans: false });
    }
    // 交替测量五轮取「轮内比值的中位数」：轮内同时同环境，比值对机器负载最不敏感；
    // 中位数比最优值更稳（单轮尖峰会把旧实现误抬过线——deletion 式实测单轮可达 0.347）
    const ratios: number[] = [];
    for (let round = 0; round < 5; round += 1) {
      const full = runOnce(undefined);
      const compact = runOnce({ spans: false });
      ratios.push(compact / full);
    }
    ratios.sort((a, b) => a - b);
    const median = ratios[2] ?? 0;
    expect(
      median,
      `紧凑/全模式吞吐比五轮中位（各轮 ${ratios.map((r) => r.toFixed(2)).join("/")}）`,
    ).toBeGreaterThanOrEqual(0.36);
  });
});

describe("E 批：报尾剥离末字符预判（行为等价三态）", () => {
  it("尾部 = / 尾部空白 / 无尾缀 三态与既有行为等价（token 消费与告警全同）", () => {
    // 尾部 =（粘连末组）
    const q = parse("ZGGG 120000Z 00000KT 9999 26/22 Q1006=");
    expect(q.altimeter).toMatchObject({ value: 1006, unit: "hPa" });
    expect(q.warnings).toHaveLength(0);
    // 尾部空白（空格/换行混合）
    const sp = parse("ZGGG 120000Z 00000KT 9999 26/22 Q1006 \n");
    expect(sp.altimeter).toMatchObject({ value: 1006, unit: "hPa" });
    expect(sp.warnings).toHaveLength(0);
    // 无尾缀（预判跳过正则的快路径）
    const none = parse("ZGGG 120000Z 00000KT 9999 26/22 Q1006");
    expect(none.altimeter).toMatchObject({ value: 1006, unit: "hPa" });
    expect(none.warnings).toHaveLength(0);
    // 末组后的报尾 = 不产生 unknown；NOSIG= 同理（夹具回归）
    const nosig = parse(fx("synth-equals-nosig").raw);
    expect(nosig.trends[0]?.kind).toBe("nosig");
    expect(nosig.warnings).toHaveLength(0);
  });
});

describe("E 批：LTG 数字距离聚合（FMH-1 实况形态）", () => {
  it("LTG ALQDS CG 12 OHD——1–2 位数字距离 token 归入聚合，不再碎落", () => {
    const r = parse(
      "KXYZ 121953Z AUTO 21010KT 6SM VCTS OVC010 22/20 A3005 RMK LTG ALQDS CG 12 OHD",
    );
    expect(r.remarks.find((m) => m.kind === "lightning")?.raw).toBe("LTG ALQDS CG 12 OHD");
  });

  it("词表外 token 仍截断聚合（RWY 不被吞）；纯词表形态不回归；数值组不被误吞", () => {
    const bounded = parse("KXYZ 121953Z AUTO 21010KT 6SM VCTS OVC010 22/20 A3005 RMK LTG DSNT RWY");
    expect(bounded.remarks.find((m) => m.kind === "lightning")?.raw).toBe("LTG DSNT");
    expect(bounded.remarks.some((m) => m.kind === "unknown" && m.raw === "RWY")).toBe(true);
    const plain = parse(
      "KXYZ 121953Z AUTO 21010KT 6SM VCTS OVC010 22/20 A3005 RMK LTG IC CG OHD NE",
    );
    expect(plain.remarks.find((m) => m.kind === "lightning")?.raw).toBe("LTG IC CG OHD NE");
    // 紧随的数值组（T 组）不被数字吸收误吞
    const tGroup = parse(
      "KGEZ 120845Z AUTO 17004KT 9SM SCT020 21/21 A2991 RMK LTG DSNT W T02110206",
    );
    expect(tGroup.remarks.find((m) => m.kind === "lightning")?.raw).toBe("LTG DSNT W");
    expect(
      tGroup.remarks.some((m) => m.kind === "precise-temperature" && m.raw === "T02110206"),
    ).toBe(true);
  });
});

describe("能见度阈值方向建模（visibility.beyond，卡片显示口径驱动）", () => {
  it("M 前缀 below / P 前缀 above / 9999 above；实测值无 beyond", () => {
    const below = parse("PANC 151253Z VRB03KT M1/4SM FG VV002 07/07 A2964");
    expect(unwrap(below.visibility)?.beyond).toBe("below");
    const above = parse("KXYZ 151253Z VRB03KT P6SM SKC 07/07 A2964");
    expect(unwrap(above.visibility)?.beyond).toBe("above");
    const ceil = parse("ZGGG 120000Z 00000KT 9999 26/22 Q1009");
    expect(unwrap(ceil.visibility)?.beyond).toBe("above");
    const exact = parse(fx("verified-c10").raw); // 实弹：1/2SM 实测值
    expect(unwrap(exact.visibility)?.beyond).toBeUndefined();
  });
});
describe("下阶段：WS RWY 风切变组（WMO 306 FM15 §15.13.3——正文组一等字段）", () => {
  it("三形态解析：WS RWY02L（数字+方位字母）/ WS RWY21（纯数字）/ WS RWY ALL（全部跑道，synth）", () => {
    const zggg = parse(fx("arc-ws-rwy-zggg-20110506").raw);
    expect(zggg.windShear).toMatchObject({ runways: ["02L"], allRunways: false });
    expect(zggg.raw.slice(zggg.windShear!.span!.start, zggg.windShear!.span!.end)).toBe(
      "WS RWY02L",
    );
    // 零 unknown（原两 token 各落一条 unknown-token 告警）；趋势不被吞
    expect(zggg.warnings).toHaveLength(0);
    expect(zggg.trends[0]?.kind).toBe("becmg");
    expect(zggg.trends[0]?.raw).not.toContain("WS");

    const zppp = parse(fx("arc-ws-rwy-zppp-20110514").raw);
    expect(zppp.windShear).toMatchObject({ runways: ["21"], allRunways: false });
    expect(zppp.trends[0]?.kind).toBe("tempo");

    const all = parse(fx("synth-ws-rwy-all").raw);
    expect(all.windShear).toMatchObject({ runways: [], allRunways: true });
    expect(all.raw.slice(all.windShear!.span!.start, all.windShear!.span!.end)).toBe("WS RWY ALL");
    expect(all.warnings).toHaveLength(0);
  });

  it("同报多组累积：runways 连接、span 覆盖首组至末组", () => {
    const r = parse("ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 WS RWY02L WS RWY20R NOSIG");
    expect(r.windShear).toMatchObject({ runways: ["02L", "20R"], allRunways: false });
    expect(r.raw.slice(r.windShear!.span!.start, r.windShear!.span!.end)).toBe(
      "WS RWY02L WS RWY20R",
    );
    expect(r.warnings).toHaveLength(0);
  });

  it("趋势后 WS RWY（2026-09-14 趋势收窄改约）：交回正文认组为 windShear 一等字段 + 收口提示出声", () => {
    const r = parse("ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 BECMG AT0130 4000 WS RWY02L");
    // WS 不属趋势要素族——收窄后交回正文认组（typed 语义一等字段），趋势 raw 截于 WS 前
    expect(r.windShear).toMatchObject({ runways: ["02L"], allRunways: false });
    expect(r.trends[0]?.raw).not.toContain("WS");
    // 收口出声不静默（span 指 WS 词位）
    expect(
      r.warnings.some(
        (w) => w.code === "invalid-format" && r.raw.slice(w.span!.start, w.span!.end) === "WS",
      ),
    ).toBe(true);
  });

  it("裸 WS（无 RWY 后继）仍落 unknown-token——分支不越界吞噬", () => {
    const r = parse("ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 WS");
    expect(r.windShear).toBeUndefined();
    const unknown = r.warnings.find((w) => w.code === "unknown-token");
    expect(r.raw.slice(unknown!.span!.start, unknown!.span!.end)).toBe("WS");
  });
});

describe("下阶段：TSNO 雷暴传感器组（美网高频，认组不再 unknown）", () => {
  it("AK 网实弹（PAYA）：RMK TSNO → remarks kind thunderstorm-sensor", () => {
    const r = parse(fx("target-tsno-paya").raw);
    expect(r.remarks.some((m) => m.kind === "thunderstorm-sensor" && m.raw === "TSNO")).toBe(true);
  });
});

describe("下阶段：QBB 俄区云底高度组（began-ended 误吞修正）", () => {
  it("QFE 组归类俄区场面气压（RemarkKind aerodrome-pressure，认组收下不解码数值）", () => {
    const r = parse(fx("ru-trend-rmk-qfe").raw);
    const qfe = r.remarks.find((rm) => rm.raw === "QFE749");
    expect(qfe?.kind).toBe("aerodrome-pressure");
    // 双单位形态 QFE746/0995（746 mmHg / 995 hPa——760 mmHg = 1013.25 hPa 标准大气互证）
    const dual = parse(
      "USPP 120930Z 33002MPS 8000 -SHRA SCT005 BKN024CB 14/14 Q1009 NOSIG RMK QFE746/0995",
    );
    const qfeDual = dual.remarks.find((rm) => rm.raw === "QFE746/0995");
    expect(qfeDual?.kind).toBe("aerodrome-pressure");
    // 四位 hPa 直读形态（QFE1003）同族收下；非数字词身（QFE746/0995/QX）不越界吞噬
    const four = parse("OOSH 120850Z AUTO 07010KT 9999 SCT025 34/27 Q1006 RMK QFE1003");
    expect(four.remarks.some((m) => m.kind === "aerodrome-pressure" && m.raw === "QFE1003")).toBe(
      true,
    );
    const junk = parse("UUEE 120900Z 30003MPS 8000 -SHRA BKN024CB 14/14 Q1009 NOSIG RMK QFEQ");
    expect(junk.remarks.some((m) => m.raw === "QFEQ")).toBe(true);
    expect(junk.remarks.find((m) => m.raw === "QFEQ")?.kind).toBe("unknown");
  });

  it("RU 网实弹（UHMD）：RMK QBB060 → remarks kind cloud-base-height（不再 phenomenon-began-ended）", () => {
    const r = parse(fx("target-qbb-uhmd").raw);
    expect(r.remarks.some((m) => m.kind === "cloud-base-height" && m.raw === "QBB060")).toBe(true);
    expect(r.remarks.some((m) => m.kind === "phenomenon-began-ended")).toBe(false);
  });

  it("began-ended 边界收紧回归锁：FZRAB43E50 / RAB42 / RAE50 / TSB30 / B43 家族不回归", () => {
    const family = parse(
      "KXYZ 121253Z AUTO 00000KT 2SM FZRA OVC010 05/04 A2995 RMK FZRAB43E50 RAB42 RAE50 TSB30 B43",
    );
    const began = family.remarks.filter((m) => m.kind === "phenomenon-began-ended");
    expect(began.map((m) => m.raw)).toEqual(["FZRAB43E50", "RAB42", "RAE50", "TSB30", "B43"]);
  });
});

describe("趋势斜杠时段（DDHH/DDHH——ICAO Annex 3 模板 / 中国民航主流编法；2026-09-16 五方实测评测 P0 回归锁）", () => {
  it("TEMPO 1616/1618 3000 TSRA BKN020CB：趋势内容关进趋势段，正文能见度不再被 last-wins 顶掉", () => {
    const r = parse(
      "ZBAA 121200Z 32005KT 9999 FEW030 18/09 Q1013 TEMPO 1616/1618 3000 TSRA BKN020CB",
    );
    expect(r.trends).toHaveLength(1);
    const tr = r.trends[0];
    expect(tr?.kind).toBe("tempo");
    expect(tr?.period?.text).toBe("1616/1618");
    expect(tr?.elements?.visibility?.value).toBe(3000);
    expect(tr?.elements?.weather?.[0]?.phenomena).toContain("RA");
    const trendCloud0 = tr?.elements?.clouds?.elements[0];
    expect(trendCloud0?.kind === "layer" ? trendCloud0.amount : undefined).toBe("BKN");
    // 正文四组各归其位（修复前：正文能见度被趋势 3000 顶掉、TSRA/BKN020CB 污染正文）
    expect(r.visibility?.kind).toBe("value");
    expect(r.weather).toBeUndefined();
    expect(r.clouds?.elements).toHaveLength(1);
    expect(r.warnings.some((w) => w.code === "cross-check-conflict")).toBe(false);
  });

  it("BECMG 1606/1608 04004MPS CAVOK：趋势 CAVOK 不与正文云组出假矛盾", () => {
    const r = parse("ZSPD 160600Z 18003MPS 9999 SCT025 24/19 Q1010 BECMG 1606/1608 04004MPS CAVOK");
    expect(r.trends[0]?.kind).toBe("becmg");
    expect(r.trends[0]?.period?.text).toBe("1606/1608");
    expect(r.trends[0]?.elements?.cavok).toBeDefined();
    expect(r.trends[0]?.elements?.wind?.speed.value).toBe(4);
    // 正文原位 + 假矛盾不出声（修复前：趋势 CAVOK 与正文 SCT025 出 cross-check-conflict）
    const bodyCloud0 = r.clouds?.elements?.[0];
    expect(bodyCloud0?.kind === "layer" ? bodyCloud0.amount : undefined).toBe("SCT");
    expect(r.warnings).toHaveLength(0);
  });

  it("裸斜杠时段（指示组缺失）：kind unspecified 收段出声，正文不受牵连", () => {
    const r = parse("ZSFZ 161500Z 09005MPS 8000 -RA BKN010 OVC025 17/14 Q1012 1618/1620 3000 TSRA");
    expect(r.trends).toHaveLength(1);
    expect(r.trends[0]?.kind).toBe("unspecified");
    expect(r.trends[0]?.period?.text).toBe("1618/1620");
    expect(r.trends[0]?.elements?.visibility?.value).toBe(3000);
    expect(unwrap(r.visibility)?.value).toBe(8000);
    const warn = r.warnings.find((w) => w.code === "invalid-format");
    expect(warn?.severity).toBe("warning");
  });
});

describe("IEM 形态长尾第二批：TX/TN 组、指示组缺失趋势段、WS 缺词、RVR 全斜杠", () => {
  it("TX/TN 温度预告组（TAF 混入通路，ICAO Annex 3 附录五）：认组进 remarks temperature-forecast，不再 unknown", () => {
    const r = parse(fx("target-txtn-zhhh").raw);
    const tx = r.remarks.find((m) => m.raw === "TX25/0907Z");
    const tn = r.remarks.find((m) => m.raw === "TN16/0922Z");
    expect(tx?.kind).toBe("temperature-forecast");
    expect(tn?.kind).toBe("temperature-forecast");
    // span 指向原文；M 负值形态（TXM05/1809Z）同族收下
    expect(r.raw.slice(tx?.span?.start ?? 0, tx?.span?.end ?? 0)).toBe("TX25/0907Z");
    const neg = parse("ZHHH 090302Z 0906/1006 20003MPS 6000 NSC TXM05/1809Z TN16/0922Z");
    expect(
      neg.remarks.some((m) => m.kind === "temperature-forecast" && m.raw === "TXM05/1809Z"),
    ).toBe(true);
    // 正文主体不受牵连：风/能见度/温露/QNH 各归其位
    // 斜杠时段行（0906/1006，ICAO Annex 3 / 中国民航口径，2026-09-16 起按趋势段收口）：
    // 趋势内容（风 20003MPS / 能见度 6000）关进趋势段，正文风/能见度不再被牵连
    expect(unwrap(r.wind)).toBeUndefined();
    expect(r.trends).toHaveLength(1);
    expect(r.trends[0]?.kind).toBe("unspecified");
    expect(r.trends[0]?.period?.text).toBe("0906/1006");
    expect(r.trends[0]?.elements?.wind?.speed.value).toBe(3);
    expect(r.trends[0]?.elements?.visibility?.value).toBe(6000);
    // TX/TN 仍在 remarks（趋势收组封闭清单把 TX/TN 交回正文认组）
    expect(r.remarks.some((m) => m.kind === "temperature-forecast" && m.raw === "TN16/0922Z")).toBe(
      true,
    );
    expect(r.altimeter).toBeUndefined(); // 本行无 QNH
    // 粘连变体（TEMPO1616/1618）与裸斜杠变体同族收口（无指示组 → kind unspecified 出声）
    const fused = parse("ZBAA 121200Z 32005KT 9999 FEW030 18/09 Q1013 TEMPO1616/1618 3000 TSRA");
    expect(fused.trends).toHaveLength(1);
    expect(fused.trends[0]?.period?.text).toBe("1616/1618");
    expect(fused.trends[0]?.elements?.visibility?.value).toBe(3000);
  });

  it("裸趋势时段词（缺指示组）：收为 kind unspecified 指示组缺失趋势段，趋势风组不再以 last-wins 覆盖正文风组", () => {
    const r = parse(fx("target-bareperiod-zsam").raw);
    expect(r.trends).toHaveLength(1);
    expect(r.trends[0]?.kind).toBe("unspecified");
    expect(r.trends[0]?.period?.text).toBe("TL0730");
    expect(r.trends[0]?.raw).toBe("TL0730 11005MPS");
    // 根因修复前：TL0730 落 unknown、11005MPS 覆盖正文真风组（02004MPS）
    expect(unwrap(r.wind)?.direction).toBe(20);
    expect(unwrap(r.wind)?.speed.value).toBe(4);
    const warn = r.warnings.find((w) => w.code === "invalid-format");
    expect(warn?.severity).toBe("warning");
    expect(r.raw.slice(warn?.span?.start ?? 0, warn?.span?.end ?? 0)).toBe("TL0730");
    // RMK 收口不受磨损段牵连（磨损段同按 isTrendBoundary 收口）
    const withRmk = parse(
      "ZSAM 250600Z 02004MPS 9999 BKN050 31/22 Q1009 TL0730 11005MPS RMK QFE749",
    );
    expect(withRmk.trends[0]?.raw).toBe("TL0730 11005MPS");
    expect(withRmk.remarks.some((m) => m.raw === "QFE749")).toBe(true);
  });

  it("指示组与时段词粘连（BECMGTL0350）：宽容拆分——kind becmg + period TL0350（span 仅时段词部分）+ info 告警", () => {
    const r = parse(fx("target-fused-trend-zbaa").raw);
    expect(r.trends).toHaveLength(1);
    expect(r.trends[0]?.kind).toBe("becmg");
    expect(r.trends[0]?.period?.text).toBe("TL0350");
    expect(
      r.raw.slice(r.trends[0]?.period?.span?.start ?? 0, r.trends[0]?.period?.span?.end ?? 0),
    ).toBe("TL0350");
    expect(r.trends[0]?.raw).toBe("BECMGTL0350 FEW030");
    const warn = r.warnings.find((w) => w.code === "invalid-format");
    expect(warn?.severity).toBe("info");
    expect(r.raw.slice(warn?.span?.start ?? 0, warn?.span?.end ?? 0)).toBe("BECMGTL0350");
    // NOSIG 粘连不拆（NOSIG 语义不配时段词）——保持 unknown 不越界
    const nosigFused = parse("ZGGG 120000Z 27008KT 9999 SCT030 26/22 Q1009 NOSIGTL0350");
    expect(nosigFused.trends).toHaveLength(0);
    expect(
      nosigFused.warnings.some(
        (w) =>
          w.code === "unknown-token" &&
          nosigFused.raw.slice(w.span!.start, w.span!.end) === "NOSIGTL0350",
      ),
    ).toBe(true);
  });

  it("标准位置时段词不回归：BECMG AT1230 / TEMPO TL1000 单告警零（磨损分支不得误吞既有路径）", () => {
    const std = parse(
      "ZGGG 061200Z 29005MPS 220V310 3000 +TSRA BR SCT009 SCT026CB BKN026 24/24 Q1008 BECMG AT1230 -SHRA SCT011",
    );
    expect(std.trends).toHaveLength(1);
    expect(std.trends[0]?.kind).toBe("becmg");
    expect(std.trends[0]?.period?.text).toBe("AT1230");
    expect(std.warnings).toHaveLength(0);
    // 双时段词（FM#### TL####）：第二个时段词随段收下不落 unknown
    const dual = parse(
      "ZGGG 220400Z 01009MPS 9999 SCT016 OVC033 08/04 Q1021 TEMPO FM0430 TL0530 2800 RA",
    );
    expect(dual.trends[0]?.period?.text).toBe("FM0430");
    expect(dual.trends[0]?.raw).toContain("TL0530");
    expect(dual.warnings).toHaveLength(0);
  });

  it("风切变标准形态（WS R15，ICAO/WMO 模板 WS RDRDR）：windShear 零告警一等认组；实务变体 WS RWY02L 不回归", () => {
    const r = parse(fx("target-ws-worn-zgsz").raw);
    expect(r.windShear).toMatchObject({ runways: ["15"], allRunways: false });
    expect(r.raw.slice(r.windShear?.span?.start ?? 0, r.windShear?.span?.end ?? 0)).toBe("WS R15");
    // 标准形态不得再按「磨损」出 invalid-format（2026-09 复核纠偏：WS RDRDR 是 ICAO/WMO 标准形态）
    expect(r.warnings.find((w) => w.code === "invalid-format")).toBeUndefined();
    // 后随 TEMPO 不受牵连
    expect(r.trends[0]?.kind).toBe("tempo");
    // 变体形态零告警（既有回归）
    const std = parse(fx("arc-ws-rwy-zggg-20110506").raw);
    expect(std.warnings).toHaveLength(0);
    // WS R36 RWY（设计器后拖词）：R36 收下、拖词 RWY 如实落 unknown
    const stray = parse(
      "ZLLL 140800Z VRB02G13MPS 9999 SCT020 FEW033CB 17/M08 Q1018 WS R36 RWY BECMG TL0920 03005MPS",
    );
    expect(stray.windShear).toMatchObject({ runways: ["36"] });
    expect(
      stray.warnings.some(
        (w) => w.code === "unknown-token" && stray.raw.slice(w.span!.start, w.span!.end) === "RWY",
      ),
    ).toBe(true);
  });

  it("RVR 值位全斜杠缺测：标准五位（R35/////）→ missing + missing-expected；磨损四位（R10////）另附 invalid-format info", () => {
    const five = parse(fx("target-rvr-solidi5-scvd").raw);
    expect(five.runwayVisualRange?.kind).toBe("missing");
    if (five.runwayVisualRange?.kind === "missing") {
      expect(
        five.raw.slice(five.runwayVisualRange.span!.start, five.runwayVisualRange.span!.end),
      ).toBe("R35/////");
    }
    const w5 = five.warnings.find((x) => x.code === "missing-expected");
    expect(w5?.severity).toBe("info");
    expect(five.warnings.some((x) => x.code === "invalid-format")).toBe(false);

    const four = parse(fx("target-rvr-solidi4-zytl").raw);
    expect(four.runwayVisualRange?.kind).toBe("missing");
    expect(
      four.warnings.some(
        (x) =>
          x.code === "invalid-format" && four.raw.slice(x.span!.start, x.span!.end) === "R10////",
      ),
    ).toBe(true);
    // 跑道状态七位全斜杠（R33/////// = 分离符 + 六位电码全缺）不回归：仍进 runwayStates
    const state = parse(
      "UUOL 120900Z 27004MPS 240V300 9999 SCT047 19/08 Q1019 R33/////// NOSIG RMK QFE749/0998",
    );
    expect(state.runwayStates[0]).toMatchObject({ runway: "33", deposit: null, coverage: null });
    expect(state.runwayVisualRange).toBeUndefined();
  });
});

describe("交叉校验扩展：覆盖位非法码 + CAVOK 与前序天气/云矛盾", () => {
  it("覆盖位非法电码（R24/000062 位 2 = 0，表 0519 仅 1/2/5/9 与 /）：该位判缺测 + invalid-format 告警（实弹 UUWW）", () => {
    const r = parse(fx("target-rwystate-illegal-coverage-uuww").raw);
    expect(r.runwayStates[0]).toMatchObject({
      runway: "24",
      deposit: 0, // 沉积 0（干燥）合法保留——不连坐
      coverage: null, // 非法电码判缺测
      depth: 0,
      frictionCoefficient: 0.62,
    });
    const warn = r.warnings.find((w) => w.code === "invalid-format");
    expect(warn?.severity).toBe("warning");
    expect(r.raw.slice(warn?.span?.start ?? 0, warn?.span?.end ?? 0)).toBe("R24/000062");
    expect(warn?.message).toContain("表 0519");
    // 构造：表外数字 3/4/6/7/8 同判；表内 1/2/5/9 不误伤（零告警）
    for (const bad of ["3", "4", "6", "7", "8"]) {
      const c = parse(`UUDD 150000Z 25001MPS 5000 -SN OVC015 M09/M11 Q1022 R13R/2${bad}0995 NOSIG`);
      expect(c.runwayStates[0]?.coverage, `覆盖位 ${bad} 应判缺测`).toBeNull();
      expect(
        c.warnings.some((w) => w.code === "invalid-format"),
        `覆盖位 ${bad} 应告警`,
      ).toBe(true);
    }
    for (const ok of ["1", "2", "5", "9"]) {
      const c = parse(`UUDD 150000Z 25001MPS 5000 -SN OVC015 M09/M11 Q1022 R13R/2${ok}0995 NOSIG`);
      expect(c.runwayStates[0]?.coverage, `覆盖位 ${ok} 应保留`).toBe(Number(ok));
      expect(c.warnings).toHaveLength(0);
    }
  });

  it("CAVOK 与前序天气组矛盾（TSRA CAVOK）：让位照旧 + cross-check-conflict 告警（span 指 CAVOK 词）", () => {
    const r = parse("ZGGG 120000Z 27008KT 9999 TSRA CAVOK 26/22 Q1009");
    expect(r.cavok).toBe(true);
    expect(r.weather).toBeUndefined(); // 让位契约不变
    const warn = r.warnings.find((w) => w.code === "cross-check-conflict");
    expect(warn).toBeDefined();
    expect(warn?.message).toContain("TSRA");
    expect(r.raw.slice(warn?.span?.start ?? 0, warn?.span?.end ?? 0)).toBe("CAVOK");
  });

  it("CAVOK 与前序云组矛盾（BKN030 / FEW040CB / VV002 CAVOK）：5000ft 以下或 CB/TCU 必矛盾；其上层与缺测高不误报", () => {
    const bkn = parse("ZGGG 120000Z 27008KT 9999 BKN030 CAVOK 26/22 Q1009");
    const bknWarn = bkn.warnings.find((w) => w.code === "cross-check-conflict");
    expect(bknWarn?.message).toContain("BKN030");
    // CB 任意高度矛盾（FEW040CB 在 4000ft——双判据皆命中）
    const cb = parse("ZGGG 120000Z 27008KT 9999 FEW040CB CAVOK 26/22 Q1009");
    expect(cb.warnings.some((w) => w.code === "cross-check-conflict")).toBe(true);
    // 高于阈值的 CB 仍矛盾（任意高度无 CB/TCU）
    const cbHigh = parse("ZGGG 120000Z 27008KT 9999 FEW250CB CAVOK 26/22 Q1009");
    expect(cbHigh.warnings.some((w) => w.code === "cross-check-conflict")).toBe(true);
    // VV 有值（天空遮蔽）矛盾
    const vv = parse("ZGGG 120000Z 27008KT 9999 VV002 CAVOK 26/22 Q1009");
    expect(vv.warnings.some((w) => w.code === "cross-check-conflict")).toBe(true);
    // 相容回归一：5000ft 及以上非对流层不告警（CAVOK ≠ 晴空，其上可有云）
    const high = parse("ZGGG 120000Z 27008KT 9999 FEW200 CAVOK 26/22 Q1009");
    expect(high.warnings).toHaveLength(0);
    const sct100 = parse("ZGGG 120000Z 27008KT 9999 SCT100 CAVOK 26/22 Q1009");
    expect(sct100.warnings).toHaveLength(0);
    // 相容回归二：云高缺测无从判定不告警；晴空码与 CAVOK 语义一致不告警
    const missingH = parse("ZGGG 120000Z 27008KT 9999 BKN/// CAVOK 26/22 Q1009");
    expect(missingH.warnings.some((w) => w.code === "cross-check-conflict")).toBe(false);
    const skc = parse("ZGGG 120000Z 27008KT 9999 SKC CAVOK 26/22 Q1009");
    expect(skc.warnings).toHaveLength(0);
    // 相容回归三：9999 CAVOK / 无前序组 CAVOK / RE 近期天气不参与（近期 ≠ 当前）
    expect(parse("ZGGG 120000Z 27008KT 9999 CAVOK 26/22 Q1009").warnings).toHaveLength(0);
    expect(parse(fx("verified-a2").raw).warnings).toHaveLength(0);
    const re = parse(
      "ZYTX 301130Z 24006MPS 6000 -SHRA FEW010 FEW026CB 11/07 Q1000 RETS BECMG TL1200 03005MPS",
    );
    expect(re.warnings.some((w) => w.code === "cross-check-conflict")).toBe(false);
  });
});

describe("独立评测复核批：风切变 ICAO 标准形态 + 重复组告警 + CAVOK 词后矛盾 + 阈值/极值语义", () => {
  it("高：WS ALL RWY（ICAO/WMO 标准全跑道形态）一等认组，不再散落 unknown", () => {
    const r = parse("METAR KDEN 121253Z 30015G22KT 3SM WS ALL RWY BKN010 OVC020 12/02 A3010");
    expect(r.windShear).toMatchObject({ runways: [], allRunways: true });
    expect(r.raw.slice(r.windShear?.span?.start ?? 0, r.windShear?.span?.end ?? 0)).toBe(
      "WS ALL RWY",
    );
    expect(r.warnings.filter((w) => w.code === "unknown-token")).toHaveLength(0);
    // 词序倒置变体 WS RWY ALL 不回归（变体与标准同等收下）
    const alt = parse("METAR ZBAD 121253Z 30015G22KT 3SM WS RWY ALL BKN010 OVC020 12/02 A3010");
    expect(alt.windShear).toMatchObject({ runways: [], allRunways: true });
  });

  it("高：标准 WS RDRDR 带方位字母（WS R15C）零告警；标准与变体多组累积 span 首至末", () => {
    const r = parse("METAR ZBAA 121253Z 30015G22KT 8000 WS R15C BKN010 12/02 Q1013");
    expect(r.windShear).toMatchObject({ runways: ["15C"], allRunways: false });
    expect(r.warnings).toHaveLength(0);
    const mix = parse("METAR ZBAA 121253Z 30015KT 8000 WS R36 WS R01L BKN010 12/02 Q1013");
    expect(mix.windShear).toMatchObject({ runways: ["36", "01L"], allRunways: false });
    expect(mix.raw.slice(mix.windShear?.span?.start ?? 0, mix.windShear?.span?.end ?? 0)).toBe(
      "WS R36 WS R01L",
    );
  });

  it("中：重复风组/能见度组/温度组——末组为准 + duplicate-group/warning（专用码对齐双气压组口径）", () => {
    const dupWind = parse("METAR ZBAA 121253Z 22010KT 24015KT 8000 BKN010 12/02 Q1013");
    expect(dupWind.wind?.kind === "value" && dupWind.wind.value.direction).toBe(240);
    expect(
      dupWind.warnings.some(
        (w) =>
          w.code === "duplicate-group" &&
          w.severity === "warning" &&
          dupWind.raw.slice(w.span!.start, w.span!.end) === "24015KT",
      ),
    ).toBe(true);
    const dupVis = parse("METAR ZBAA 121253Z 30015KT 9999 5000 BKN010 12/02 Q1013");
    expect(dupVis.visibility?.kind === "value" && dupVis.visibility.value.value).toBe(5000);
    expect(dupVis.warnings.some((w) => w.code === "duplicate-group")).toBe(true);
    const dupTemp = parse("METAR ZBAA 121253Z 30015KT 8000 BKN010 12/06 15/08 Q1013");
    expect(dupTemp.temperature?.celsius).toBe(15);
    expect(dupTemp.warnings.some((w) => w.code === "duplicate-group")).toBe(true);
  });

  it("中：CAVOK 词后矛盾组（能见度/天气/云三面）出声；相容组（9999/NSC/高云）静默", () => {
    const cloud = parse("METAR ZBAA 121253Z 30015KT CAVOK BKN012 12/02 Q1013");
    expect(cloud.cavok).toBe(true);
    expect(
      cloud.warnings.some((w) => w.code === "cross-check-conflict" && w.message.includes("BKN012")),
    ).toBe(true);
    const vis = parse("METAR ZBAA 121253Z 30015KT CAVOK 3000 12/02 Q1013");
    expect(vis.warnings.some((w) => w.code === "cross-check-conflict")).toBe(true);
    const wx = parse("METAR ZBAA 121253Z 30015KT CAVOK -TSRA 12/02 Q1013");
    expect(wx.warnings.some((w) => w.code === "cross-check-conflict")).toBe(true);
    // 相容：9999（下界语义 ≥10km）；NSC 与层组并存属互斥矛盾，由云组自洽校验出声（另测）
    const ok = parse("METAR ZBAA 121253Z 30015KT CAVOK 9999 NSC 12/02 Q1013");
    expect(ok.warnings).toHaveLength(0);
    // 趋势段围栏不误伤：CAVOK 后随趋势组（BECMG 带云组）属正常形态
    const trend = parse("METAR ZUUU 080800Z 33002MPS 260V050 CAVOK 29/22 Q1008 NOSIG");
    expect(trend.warnings).toHaveLength(0);
  });

  it("低：0000 为下限编码（exact=false + beyond below），且与 CAVOK 组合必出声", () => {
    const r = parse("METAR ZBAA 121253Z 30015KT 0000 BKN010 12/02 Q1013");
    expect(r.visibility?.kind === "value" && r.visibility.value.exact).toBe(false);
    expect(r.visibility?.kind === "value" && r.visibility.value.beyond).toBe("below");
    const cavokDup = parse("METAR ZBAA 121253Z 30015KT 0000 CAVOK 12/02 Q1013");
    expect(cavokDup.warnings.some((w) => w.code === "cross-check-conflict")).toBe(true);
  });

  it("低：RVR 多组组级 span 首组至末组（与天气组同口径，单组 span 不回归）", () => {
    const r = parse("METAR ZSPD 121253Z 30015KT 0800 R36/0500 R01/0450 FG BKN010 12/02 Q1013");
    expect(
      r.raw.slice(r.runwayVisualRange?.span?.start ?? 0, r.runwayVisualRange?.span?.end ?? 0),
    ).toBe("R36/0500 R01/0450");
  });

  it("低：温度世界极值门（89/85 判缺测 + value-out-of-range）；正常值与 M00 不回归", () => {
    const hot = parse("METAR ZBAA 121253Z 30015KT 8000 BKN010 89/85 Q1013");
    expect(hot.temperature).toBeUndefined();
    expect(hot.dewpoint).toBeUndefined();
    expect(hot.warnings.some((w) => w.code === "value-out-of-range")).toBe(true);
    const normal = parse("METAR ZBAA 121253Z 30015KT 8000 BKN010 52/23 Q1013");
    expect(normal.temperature?.celsius).toBe(52);
    expect(normal.warnings).toHaveLength(0);
    const negZero = parse("METAR ZBAA 121253Z 30015KT 8000 BKN010 M00/M00 Q1013");
    expect(Object.is(negZero.temperature?.celsius, -0)).toBe(false);
    expect(negZero.temperature?.celsius).toBe(0);
  });

  it("低：风速三位数合法（≤199，WMO 15.5.6/FMH-1 12.6.5.a 原文裁决，纠正上轮两位数门）；>199 仍整组判缺测", () => {
    const legal = parse("METAR ZBAA 121253Z 270199KT 8000 BKN010 12/02 Q1013");
    expect(legal.wind?.kind === "value" && legal.wind.value.speed.value).toBe(199);
    expect(legal.warnings).toHaveLength(0);
    const mt = parse("METAR KMWN 121253Z 270105G130KT 8000 12/02 Q1013");
    expect(mt.wind?.kind === "value" && mt.wind.value.speed.value).toBe(105);
    expect(mt.wind?.kind === "value" && mt.wind.value.gust?.value).toBe(130);
    const over = parse("METAR ZBAA 121253Z 270250KT 8000 BKN010 12/02 Q1013");
    expect(over.wind?.kind).toBe("missing");
    expect(over.warnings.some((w) => w.code === "value-out-of-range")).toBe(true);
    const dir = parse("METAR ZBAA 121253Z 73015KT 8000 BKN010 12/02 Q1013");
    expect(dir.wind?.kind === "value" && dir.wind.value.direction).toBeNull();
  });
});

describe("独立评测复核批补充：RVR 超界前缀是标准编报形态（定点锁，非仅快照间接覆盖）", () => {
  it("P/M 单端与 V 形态单端超界：beyondRange 正确且零告警（P/M 属标准形态，不得出声）", () => {
    for (const raw of [
      "METAR ZBAA 121253Z 30015KT R36/P2000 BKN010 12/02 Q1013",
      "METAR ZBAA 121253Z 30015KT R36/M0050 BKN010 12/02 Q1013",
      "METAR ZBAA 121253Z 30015KT R36/1400VP2000 BKN010 12/02 Q1013",
    ]) {
      const r = parse(raw);
      expect(r.runwayVisualRange?.kind).toBe("value");
      expect(r.warnings).toHaveLength(0);
    }
  });
});

describe("第二轮复评确认批：RMK 9 位温度极值/降水缺测分类 + 部分缺测风组 + 趋势 R 收口提示 + AMD/VRB", () => {
  it("中：24h 温度极值组 9 位现行形态（401280089）认组不再 unknown；8 位旧形态兼容；6//// 缺测分类", () => {
    const r = parse(
      "METAR PATA 120852Z 09006KT 10SM FEW018 04/M01 A3005 RMK AO2 SLP148 401280089 56005",
    );
    const kinds = r.remarks?.map((x) => x.kind);
    expect(kinds).toContain("temp-extrema-24h");
    expect(r.remarks?.some((x) => x.kind === "unknown")).toBe(false);
    const legacy = parse("METAR ZBAA 121253Z 30015KT 8000 BKN010 12/02 Q1013 RMK 40128008");
    expect(legacy.remarks?.map((x) => x.kind)).toContain("temp-extrema-24h");
    const precip = parse(
      "METAR PATA 120852Z 09006KT 10SM FEW018 04/M01 A3005 RMK AO2 6//// SLP148",
    );
    expect(precip.remarks?.map((x) => x.kind)).toContain("precip-window");
  });

  it("低：部分缺测风组（180//KT / 27010G//KT）组级 missing + missing-expected，不再落 unknown", () => {
    const half = parse("METAR ZBAA 121253Z 180//KT 8000 12/02 Q1013");
    expect(half.wind?.kind).toBe("missing");
    expect(half.warnings.some((w) => w.code === "missing-expected")).toBe(true);
    expect(half.warnings.some((w) => w.code === "unknown-token")).toBe(false);
    const gust = parse("METAR ZBAA 121253Z 27010G//KT 8000 12/02 Q1013");
    expect(gust.wind?.kind === "value" && gust.wind.value.speed.value).toBe(10);
    expect(gust.wind?.kind === "value" && gust.wind.value.gust).toBeUndefined();
    expect(gust.warnings.some((w) => w.code === "missing-expected")).toBe(true);
  });

  it("低：趋势段收口于 R 组补 info 提示（按正文处理但趋势语境存疑）；RMK 收口不误伤", () => {
    const r = parse(
      "METAR ZBAA 121130Z 22010KT 8000 12/11 Q1010 TEMPO 1015 25015G30KT 2000 R18/0500",
    );
    expect(
      r.warnings.some(
        (w) =>
          w.code === "invalid-format" && r.raw.slice(w.span!.start, w.span!.end) === "R18/0500",
      ),
    ).toBe(true);
    expect(r.runwayVisualRange?.kind).toBe("value");
    // RMK 收口不触发该提示
    const rmk = parse("METAR ZBAA 121253Z 22010KT 8000 12/11 Q1010 TEMPO 1015 25015G30KT RMK AO2");
    expect(rmk.warnings.some((w) => w.message.includes("趋势段收口"))).toBe(false);
  });

  it("低：温度双侧同时超界合并为一条 value-out-of-range（M91/M95 不重复出声）", () => {
    const r = parse("METAR ZBAA 121253Z 30015KT 8000 BKN010 M91/M95 Q1013");
    expect(r.warnings.filter((w) => w.code === "value-out-of-range")).toHaveLength(1);
    expect(r.temperature).toBeUndefined();
    expect(r.dewpoint).toBeUndefined();
  });

  it("低：METAR AMD 前缀不再整报失败（站名/时组照常识别）；VRB 与变化组并存补 info", () => {
    const amd = parse("METAR AMD ZBAA 121253Z 30015KT 8000 BKN010 12/02 Q1013");
    expect(amd.station).toBe("ZBAA");
    const vrb = parse("METAR ZBAA 121253Z VRB02KT 300V090 8000 12/02 Q1013");
    expect(
      vrb.warnings.some((w) => w.code === "cross-check-conflict" && w.message.includes("VRB")),
    ).toBe(true);
  });
});

describe("六规范符合性审计批：0000 渲染口径 + 三位数风速 + P 超上限 + 方向组 + RMK 尾部组 + 云组自洽", () => {
  it("高：P 超上限形态（P99KT/P49MPS、P99G49KT）认组，speed.beyond=above 存原码值", () => {
    const r = parse("METAR ZBAA 121253Z 270P99KT 8000 BKN010 12/02 Q1013");
    expect(r.wind?.kind === "value" && r.wind.value.speed.value).toBe(99);
    expect(r.wind?.kind === "value" && r.wind.value.speed.beyond).toBe("above");
    const mps = parse("METAR ZUUU 121253Z 270P49MPS 8000 BKN010 12/02 Q1013");
    expect(mps.wind?.kind === "value" && mps.wind.value.speed.beyond).toBe("above");
    const g = parse("METAR KMWN 121253Z 270105G99KT 8000 12/02 Q1013");
    expect(g.wind?.kind === "value" && g.wind.value.gust?.value).toBe(99);
  });

  it("高：0000 语义（IR beyond below）+ 露点缺测 24/ + 强度越用提示", () => {
    const vis = parse("METAR ZBAA 121253Z 30015KT 0000 BKN010 12/02 Q1013");
    expect(vis.visibility?.kind === "value" && vis.visibility.value.beyond).toBe("below");
    const dew = parse("METAR ZBAA 121253Z 30015KT 8000 BKN010 24/ Q1013");
    expect(dew.temperature?.celsius).toBe(24);
    expect(dew.dewpoint).toBeUndefined();
    expect(
      dew.warnings.some((w) => w.code === "missing-expected" && w.message.includes("24/")),
    ).toBe(true);
    // 红线不回归：裸 // 仍不得被温度组吞
    expect(TEMP_DEW_PATTERN.exec("//")).toBeNull();
    const br = parse("METAR ZBAA 121253Z 30015KT 8000 -BR BKN010 12/02 Q1013");
    expect(
      br.warnings.some((w) => w.code === "invalid-format" && w.message.includes("强度符")),
    ).toBe(true);
    const tsra = parse("METAR ZBAA 121253Z 30015KT 8000 +TSRA BKN010 12/02 Q1013");
    expect(tsra.warnings.some((w) => w.message.includes("强度符"))).toBe(false);
    const rera = parse("METAR ZBAA 121253Z 30015KT 8000 BKN010 12/02 Q1013 RE-RA");
    expect(rera.warnings.some((w) => w.code === "invalid-format" && w.message.includes("RE"))).toBe(
      true,
    );
  });

  it("中：最低能见度方向组（8000 1200NW）挂 minimum 不出重复告警；脱离主导能见度出声", () => {
    const r = parse("METAR ZBAA 121253Z 30015KT 8000 1200NW BKN010 12/02 Q1013");
    expect(r.visibility?.kind === "value" && r.visibility.value.value).toBe(8000);
    expect(r.visibility?.kind === "value" && r.visibility.value.minimum?.value).toBe(1200);
    expect(r.visibility?.kind === "value" && r.visibility.value.minimum?.direction).toBe("NW");
    expect(r.warnings.some((w) => w.code === "cross-check-conflict")).toBe(false);
    const lone = parse("METAR ZBAA 121253Z 30015KT 1200NW BKN010 12/02 Q1013");
    expect(lone.visibility?.kind === "value" && lone.visibility.value.value).toBe(1200);
    expect(lone.warnings.some((w) => w.code === "invalid-format")).toBe(true);
  });

  it("中：CAVOK×RVR 交叉校验（AP-117 140 条）；VV/NSC 与层组并存互斥出声", () => {
    const cavokRvr = parse("METAR ZBAA 121253Z 30015KT CAVOK R18/0350 12/02 Q1013");
    expect(
      cavokRvr.warnings.some((w) => w.code === "cross-check-conflict" && w.message.includes("RVR")),
    ).toBe(true);
    const vv = parse("METAR ZBAD 121253Z 30015KT 9999 VV002 SCT020 12/02 Q1013");
    expect(
      vv.warnings.some((w) => w.code === "cross-check-conflict" && w.message.includes("VV")),
    ).toBe(true);
    const nsc = parse("METAR ZBAA 121253Z 30015KT NSC BKN012 12/02 Q1013");
    expect(nsc.warnings.some((w) => w.code === "cross-check-conflict")).toBe(true);
    // 相容形态零告警不回归：VV 单独、层组单独
    const ok = parse("METAR ZBAA 121253Z 30015KT 9999 SCT020 BKN040 12/02 Q1013");
    expect(ok.warnings).toHaveLength(0);
  });

  it("中：RMK 尾部组认组（CIG 族/8组/933RRR/TWR VIS/分区 VIS/PNO/FZRANO/CHINO/SFC VIS 分数）", () => {
    const kindsOf = remarkKindsOf;
    expect(
      kindsOf("METAR KVPS 121253Z 27005KT 10SM FEW010 21/12 A3005 RMK AO2 CHINO SLP132"),
    ).toContain("chino");
    expect(kindsOf("METAR KVPS 121253Z 27005KT 10SM FEW010 21/12 A3005 RMK AO2 FZRANO")).toContain(
      "fzr-not-available",
    );
    expect(kindsOf("METAR KVPS 121253Z 27005KT 10SM FEW010 21/12 A3005 RMK AO2 PNO")).toContain(
      "precip-not-available",
    );
    expect(kindsOf("METAR KDEN 121253Z 27005KT 10SM FEW010 21/12 A3005 RMK AO2 CIGNO")).toContain(
      "cig-not-available",
    );
    expect(
      kindsOf("METAR KDEN 121253Z 27005KT 10SM FEW010 21/12 A3005 RMK AO2 CIG 015V025"),
    ).toContain("ceiling-variation");
    expect(
      kindsOf("METAR KDEN 121253Z 27005KT 10SM FEW010 21/12 A3005 RMK AO2 CIG 015 LOC"),
    ).toContain("ceiling-at-location");
    expect(kindsOf("METAR KDEN 121253Z 27005KT 10SM FEW010 21/12 A3005 RMK AO2 8/57X")).toContain(
      "cloud-type-8group",
    );
    expect(kindsOf("METAR KDEN 121253Z 27005KT 10SM FEW010 21/12 A3005 RMK AO2 933012")).toContain(
      "snow-water-equivalent",
    );
    expect(
      kindsOf("METAR KDEN 121253Z 27005KT 10SM FEW010 21/12 A3005 RMK AO2 TWR VIS 2"),
    ).toContain("twr-visibility");
    const sfc = parse("METAR KDEN 121253Z 27005KT 10SM FEW010 21/12 A3005 RMK AO2 SFC VIS 2 1/2");
    const sfcRemark = sfc.remarks?.find((x) => x.kind === "surface-visibility");
    expect(sfcRemark?.raw).toBe("SFC VIS 2 1/2");
    const sec = parse("METAR KDEN 121253Z 27005KT 10SM FEW010 21/12 A3005 RMK AO2 VIS NE 3");
    expect(sec.remarks?.map((x) => x.kind)).toContain("sectoral-visibility");
  });

  it("多扇区分区能见度整段并组（PANC 实弹形态：VIS E 10 SE 10 S 10，回归锁=尾段不再散落 unknown）", () => {
    const panc = parse(
      "METAR PANC 121153Z 25005KT 10SM FEW045 SCT200 15/09 A3014 RMK AO2 VIS E 10 SE 10 S 10",
    );
    const groups = panc.remarks?.filter((x) => x.kind === "sectoral-visibility") ?? [];
    expect(groups).toHaveLength(1);
    expect(groups[0]?.raw).toBe("VIS E 10 SE 10 S 10");
    expect(panc.remarks?.some((x) => x.kind === "unknown")).toBe(false);

    const fracPair = parse(
      "METAR KDEN 121253Z 27005KT 10SM FEW010 21/12 A3005 RMK AO2 VIS NE 2 1/2 SE 1",
    );
    const fracGroups = fracPair.remarks?.filter((x) => x.kind === "sectoral-visibility") ?? [];
    expect(fracGroups).toHaveLength(1);
    expect(fracGroups[0]?.raw).toBe("VIS NE 2 1/2 SE 1");

    // 非方位词截断：组到「VIS E 10」为止，FOO 落 RMK unknown 组（RMK 未知 ≠ 错误，不进 warnings）
    const stops = parse("METAR KDEN 121253Z 27005KT 10SM FEW010 21/12 A3005 RMK AO2 VIS E 10 FOO");
    const stopGroups = stops.remarks?.filter((x) => x.kind === "sectoral-visibility") ?? [];
    expect(stopGroups[0]?.raw).toBe("VIS E 10");
    expect(stops.remarks?.some((x) => x.kind === "unknown" && x.raw === "FOO")).toBe(true);

    // 量值在前的变体（FMH-1 12.7.1.h 另一词序；PANC 实弹：VIS 1 1/2 N）
    const valFirst = parse("METAR PANC 142211Z 32004KT 8SM BKN003 12/10 A3017 RMK AO2 VIS 1 1/2 N");
    const valGroups = valFirst.remarks?.filter((x) => x.kind === "sectoral-visibility") ?? [];
    expect(valGroups).toHaveLength(1);
    expect(valGroups[0]?.raw).toBe("VIS 1 1/2 N");
    expect(valFirst.remarks?.some((x) => x.kind === "unknown")).toBe(false);
  });

  it("低：RRA 迟到报标记（AP-117-TM-01R2 第 21 条）报头放行，不再落 unknown", () => {
    const r = parse("METAR ZBAA 121253Z RRA 30015KT 8000 BKN010 12/02 Q1013");
    expect(r.station).toBe("ZBAA");
    expect(r.warnings.some((w) => w.code === "unknown-token")).toBe(false);
  });
});

// ---------------------------------------------------------------- 趋势段内要素结构化（TrendElements additive 扩展）

describe("趋势段内要素结构化（§15.14.3 四族 + NSW/CAVOK；best-effort 静默，告警面稳定）", () => {
  const BASE = "ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009";

  it("标准支路：BECMG AT0730 FEW023CB BKN033 → clouds 双层（云量/云底/对流型逐位结构化）", () => {
    const r = parse(`${BASE} BECMG AT0730 FEW023CB BKN033`);
    const el = r.trends[0]?.elements;
    expect(el?.clouds?.elements).toMatchObject([
      {
        kind: "layer",
        amount: "FEW",
        heightFt: { value: 2300 },
        convective: "CB",
      },
      { kind: "layer", amount: "BKN", heightFt: { value: 3300 } },
    ]);
    expect(el?.weather).toEqual([]);
    expect(r.warnings).toHaveLength(0);
  });

  it("四族全上：风（含阵风）/能见度/天气（强度+描述符+现象）/VV 全结构化；认不出的拖词静默留原文", () => {
    const r = parse(`${BASE} BECMG AT0550 22015G25MPS 1000 +TSRA VV002 SKC TO NE AND`);
    const el = r.trends[0]?.elements;
    expect(el?.wind).toMatchObject({ direction: 220, speed: { value: 15 }, gust: { value: 25 } });
    expect(el?.visibility).toMatchObject({ value: 1000, unit: "m", exact: true });
    expect(el?.weather).toMatchObject([
      { intensity: "+", proximity: false, descriptor: "TS", phenomena: ["RA"] },
    ]);
    expect(el?.clouds?.elements).toMatchObject([
      { kind: "vertical-visibility", heightFt: { value: 200 } },
    ]);
    expect(el?.clouds?.clear).toMatchObject({ code: "SKC" });
    // 拖词（TO NE AND）不进 elements 也不告警——趋势段整体收进 raw 是既有契约，best-effort 静默
    expect(r.trends[0]?.raw).toContain("TO NE AND");
    expect(r.warnings.filter((w) => w.code === "unknown-token")).toHaveLength(0);
  });

  it("趋势专属电码：NSW/NSC/CAVOK 各就各位（NSW=趋势时段内无重要天气；CAVOK 顶替三族）", () => {
    const nsw = parse(`${BASE} BECMG AT0840 NSW`);
    expect(nsw.trends[0]?.elements?.nsw).toBeDefined();
    expect(nsw.trends[0]?.elements?.weather).toEqual([]);
    const nsc = parse(`${BASE} BECMG TL1700 NSC`);
    expect(nsc.trends[0]?.elements?.clouds?.clear).toMatchObject({ code: "NSC" });
    expect(nsc.trends[0]?.elements?.clouds?.elements).toEqual([]);
    const cavok = parse(`${BASE} BECMG AT0600 CAVOK`);
    expect(cavok.trends[0]?.elements?.cavok).toBeDefined();
  });

  it("粘连支路（BECMGTL0350 FEW030）与裸时段支路（TL0730 11005MPS）同样结构化；NOSIG 永无 elements", () => {
    const fused = parse(`${BASE} BECMGTL0350 FEW030`);
    expect(fused.trends[0]?.elements?.clouds?.elements).toMatchObject([
      { amount: "FEW", heightFt: { value: 3000 } },
    ]);
    const bare = parse(`${BASE} TL0730 11005MPS`);
    expect(bare.trends[0]?.kind).toBe("unspecified");
    expect(bare.trends[0]?.elements?.wind).toMatchObject({
      direction: 110,
      speed: { value: 5, unit: "mps" },
    });
    const nosig = parse(`${BASE} NOSIG`);
    expect(nosig.trends[0]?.elements).toBeUndefined();
  });

  it("紧凑模式 spans:false：elements 内的 span 一并剥除（值语义与默认模式一致）", () => {
    const raw = `${BASE} BECMG AT0550 22015G25MPS 1000 -SHRA FEW023CB`;
    const full = parse(raw);
    const compact = parse(raw, { spans: false });
    // 值语义逐位一致（span 剥除由键不存在承载）
    expect(compact.trends[0]?.elements).toEqual({
      wind: {
        variable: false,
        direction: 220,
        speed: { value: 15, unit: "mps" },
        gust: { value: 25, unit: "mps" },
        variation: undefined,
      },
      visibility: { value: 1000, unit: "m", exact: true },
      weather: [{ intensity: "-", proximity: false, descriptor: "SH", phenomena: ["RA"] }],
      clouds: {
        elements: [{ kind: "layer", amount: "FEW", heightFt: { value: 2300 }, convective: "CB" }],
      },
    });
    expect(JSON.stringify(compact.trends[0]?.elements)).not.toContain('"span"');
    expect(JSON.stringify(full.trends[0]?.elements)).toContain('"span"');
  });
});

// ==================================================================
// 2026-09-14 六规范符合性复评批：全部修复的回归锁
// 每把锁配套「突变验证」——修复点被临时破坏时对应锁必须变红（铁律二）。
// ==================================================================
describe("2026-09-14 复评批回归锁（温露收紧/阵风缺测/覆写出声/趋势收窄/CCA/输入面）", () => {
  const BASE = "METAR ZBAA 121253Z 30015KT 9999 SCT030 12/02 Q1013";

  it("温露收紧（红：两位是形态定义）：裸分数不匹配形态正则、解析落 unknown 零假值", () => {
    expect(TEMP_DEW_PATTERN.test("12/14")).toBe(true);
    expect(TEMP_DEW_PATTERN.test("M01/M12")).toBe(true);
    expect(TEMP_DEW_PATTERN.test("//")).toBe(false); // 红线：裸 // 是天气缺测组
    expect(TEMP_DEW_PATTERN.test("////")).toBe(false);
    // 收紧本体：任何规范版本无一位数形态（电码表符号位映射 T'十位/T个位）
    expect(TEMP_DEW_PATTERN.test("1/2")).toBe(false);
    expect(TEMP_DEW_PATTERN.test("2/1")).toBe(false);
    expect(TEMP_DEW_PATTERN.test("9/18")).toBe(false);
    const asc = parse("METAR ZBAA 121253Z 30015KT 9999 SCT030 1/2 Q1013");
    expect(asc.temperature).toBeUndefined();
    expect(asc.dewpoint).toBeUndefined();
    expect(asc.warnings.some((w) => w.code === "cross-check-conflict")).toBe(false);
    expect(asc.warnings.filter((w) => w.code === "unknown-token")).toHaveLength(1);
    // 降序分数此前完全静默捏造假值（温 2/露 1）——收紧后同落 unknown
    const desc = parse("METAR ZBAA 121253Z 30015KT 9999 SCT030 2/1 Q1013");
    expect(desc.temperature).toBeUndefined();
    expect(desc.dewpoint).toBeUndefined();
    expect(desc.warnings.some((w) => w.code === "cross-check-conflict")).toBe(false);
    expect(desc.warnings.filter((w) => w.code === "unknown-token")).toHaveLength(1);
    // 两位标准形态不回归（含 FMH-1 24/ 露点缺测尾形）
    const real = parse("METAR ZBAA 121253Z 30015KT 9999 SCT030 12/ Q1013");
    expect(real.temperature?.celsius).toBe(12);
    expect(real.dewpoint).toBeUndefined();
    expect(real.warnings.some((w) => w.code === "missing-expected")).toBe(true);
  });

  it("阵风位三斜杠缺测（G///）：组照常成立、gust 不设、missing-expected 出声——NaN 不再入 IR", () => {
    const r = parse("METAR ZBAA 121253Z 31015G///KT 9999 SCT030 12/02 Q1013");
    expect(r.wind?.kind).toBe("value");
    expect(r.wind?.kind === "value" && r.wind.value.gust).toBeUndefined();
    expect(r.wind?.kind === "value" && r.wind.value.speed.value).toBe(15);
    expect(r.warnings.some((w) => w.code === "missing-expected")).toBe(true);
    expect(r.warnings.some((w) => w.code === "unknown-token")).toBe(false);
    expect(r.warnings.some((w) => w.code === "value-out-of-range")).toBe(false);
    // 双斜杠标准形态不回归
    const two = parse("METAR ZBAA 121253Z 27010G//KT 9999 SCT030 12/02 Q1013");
    expect(two.wind?.kind === "value" && two.wind.value.gust).toBeUndefined();
    expect(two.warnings.some((w) => w.code === "missing-expected")).toBe(true);
  });

  it("RVRNO 与值组并存（方案一，2026-09-15 专业判读定案）：值组明细保留 + RVRNO 留痕 remarks + 矛盾出声", () => {
    // 正文位：值组在前 RVRNO 在后——终态保留值组明细（不覆写），RVRNO 进 remarks
    const body = parse("METAR ZSPD 120330Z 04004MPS 9999 R07/2000 Q1020 RVRNO NOSIG");
    expect(body.runwayVisualRange?.kind).toBe("value");
    expect(
      body.runwayVisualRange?.kind === "value" && body.runwayVisualRange.value.map((x) => x.runway),
    ).toEqual(["07"]);
    expect(body.remarks.map((x) => x.kind)).toContain("rvr-no");
    const bodyConflict = body.warnings.find((w) => w.code === "cross-check-conflict");
    expect(bodyConflict).toBeDefined();
    expect(bodyConflict?.message).toContain("R07/2000");
    expect(bodyConflict?.message).toContain("并存");
    expect(bodyConflict?.message).not.toContain("以末组");
    // RMK 位：值组在前 RVRNO 在 RMK——同口径（明细保留 + 出声 + 留痕）
    const rmk = parse("METAR ZSPD 120330Z 04004MPS 9999 R07/2000 Q1020 NOSIG RMK RVRNO");
    expect(rmk.runwayVisualRange?.kind).toBe("value");
    const rmkConflict = rmk.warnings.find((w) => w.code === "cross-check-conflict");
    expect(rmkConflict).toBeDefined();
    expect(rmkConflict?.message).toContain("并存");
    expect(rmk.remarks.map((x) => x.kind)).toContain("rvr-no");
    // 反向次序：RVRNO 在前值组在后（可解读为传感器恢复）——同样出声，终态落值组明细
    const rev = parse("METAR ZSPD 120330Z 04004MPS 9999 RVRNO R07/2000 Q1020 NOSIG");
    expect(rev.runwayVisualRange?.kind).toBe("value");
    const revConflict = rev.warnings.find((w) => w.code === "cross-check-conflict");
    expect(revConflict?.message).toContain("并存");
    expect(rev.remarks.map((x) => x.kind)).toContain("rvr-no");
    // 无冲突的常规 RVRNO：rvr = 显式缺测（既有 IR 契约不变），零 cross-check-conflict
    const plain = parse("METAR KUUU 281104Z 23007KT 1/4SM RVRNO FG OVC001 RMK RVRNO");
    expect(plain.runwayVisualRange?.kind).toBe("missing");
    expect(plain.warnings.filter((w) => w.code === "cross-check-conflict")).toHaveLength(0);
  });

  it("RVRNO 正文位/RMK 位双标根治（2026-09-15 方案一）：正文位单独出现也留痕 remarks", () => {
    const body = parse("METAR KUUU 281104Z 23007KT 1/4SM RVRNO FG OVC001");
    expect(body.runwayVisualRange?.kind).toBe("missing");
    expect(body.remarks.map((x) => x.kind)).toContain("rvr-no");
    expect(body.remarks[0]?.raw).toBe("RVRNO");
  });

  it("最低能见度方向组重复：last-wins + duplicate-group 出声（有主导组时不再全静默）", () => {
    const r = parse("METAR ZSPC 120330Z 04004MPS 8000 1200NW 1200NE 27/18 Q1020 NOSIG");
    expect(r.visibility?.kind === "value" && r.visibility.value.minimum?.direction).toBe("NE");
    expect(r.warnings.filter((w) => w.code === "duplicate-group")).toHaveLength(1);
    // 单方向组（规范形态）零告警不回归
    const single = parse("METAR ZSPC 120330Z 04004MPS 8000 1200NW 27/18 Q1020 NOSIG");
    expect(single.warnings.filter((w) => w.code === "duplicate-group")).toHaveLength(0);
  });

  it("趋势收窄：正文专属组交回正文认组 + 收口提示（温露/QNH 双丢实弹例）", () => {
    const r = parse("ZSPD 120330Z 04004MPS 9999 SCT033 Q1008 TEMPO 2000 RA 12/14 Q1010");
    // 温露/QHN typed 语义恢复（此前静默蒸发）
    expect(r.temperature?.celsius).toBe(12);
    expect(r.dewpoint?.celsius).toBe(14);
    expect(r.altimeter?.value).toBe(1010);
    // 出声：收口提示（span 指 12/14）+ 温露倒挂交叉校验 + QNH 重复组（last-wins）
    expect(
      r.warnings.some(
        (w) => w.code === "invalid-format" && r.raw.slice(w.span!.start, w.span!.end) === "12/14",
      ),
    ).toBe(true);
    expect(r.warnings.some((w) => w.code === "cross-check-conflict")).toBe(true);
    // 趋势本身不吞 12/14/Q1010
    expect(r.trends[0]?.raw).toBe("TEMPO 2000 RA");
  });

  it("趋势收窄：规范报尾位 $（FMH-1 整报最后一组）落 maintenance remark，趋势 raw 截于 $ 前", () => {
    const r = parse("ZSPD 120330Z 04004MPS 9999 SCT033 27/18 Q1020 TEMPO RA $");
    expect(r.remarks.map((x) => x.kind)).toContain("maintenance");
    expect(r.trends[0]?.raw).toBe("TEMPO RA");
    // $ 是规范位置——收口不出声
    expect(r.warnings).toHaveLength(0);
  });

  it("趋势收窄：TX/TN（TAF 温度预告组混入）交回正文落 remarks + 收口提示", () => {
    const r = parse("ZGGG 120000Z 27008MPS 9999 SCT030 26/22 Q1009 TEMPO 3000 TSRA TX30/1212Z");
    expect(r.remarks.map((x) => x.kind)).toContain("temperature-forecast");
    expect(
      r.warnings.some(
        (w) =>
          w.code === "invalid-format" && r.raw.slice(w.span!.start, w.span!.end) === "TX30/1212Z",
      ),
    ).toBe(true);
  });

  it("趋势收窄：拖词容忍集（语料实弹 VNKT CB TO NE AND E）保持静默原文保真零告警", () => {
    const r = parse(
      "VNKT 120930Z 23010KT 7000 VCRA FEW020 FEW025CB SCT030 28/20 Q1017 NOSIG CB TO NE AND E",
    );
    expect(r.trends[0]?.raw).toContain("CB TO NE AND E");
    expect(r.warnings).toHaveLength(0);
  });

  it("趋势收窄：RE 近期天气交回正文落 recentWeather typed 字段", () => {
    const r = parse("ZBAA 121253Z 30015KT 9999 SCT030 12/02 Q1013 TEMPO 3000 RETSRA");
    expect(r.recentWeather?.map((x) => x.phenomena)).toContainEqual(["RA"]);
    expect(r.trends[0]?.raw).toBe("TEMPO 3000");
    expect(r.warnings.some((w) => w.code === "invalid-format")).toBe(true);
  });

  it("CCA/CCB/CCC 更正指示符（时组后规范槽位）：消费并置 flags.corrected", () => {
    for (const bbb of ["CCA", "CCB", "CCC"]) {
      const r = parse(`METAR ZSPD 120330Z ${bbb} 04004MPS 9999 SCT033 27/18 Q1020 NOSIG`);
      expect(r.flags.corrected, `${bbb} 应置 corrected`).toBe(true);
      expect(r.warnings.some((w) => w.code === "unknown-token")).toBe(false);
    }
    // RRA 迟到报不置 corrected（语义不同，既有口径）
    const rra = parse("METAR ZSPD 120330Z RRA 04004MPS 9999 SCT033 27/18 Q1020 NOSIG");
    expect(rra.flags.corrected).toBe(false);
  });

  it("CCA 槽位磨损（站名后/时组前）：消费放行不再整体失败，corrected 置位", () => {
    const r = parse("METAR ZSPD CCA 120330Z 04004MPS 9999 SCT033 27/18 Q1020 NOSIG");
    expect(r.station).toBe("ZSPD");
    expect(r.time.hour).toBe(3);
    expect(r.flags.corrected).toBe(true);
    expect(r.warnings.some((w) => w.code === "unknown-token")).toBe(false);
    // 后随非时组仍走 missing-time 契约（不误吞）
    expect(() => parse("METAR ZSPD CCA 999999Z")).toThrow(MetarParseError);
  });

  it("输入面：非字符串走 invalid-input 稳定契约（MetarParseError，code 可分流/可查表）", () => {
    for (const bad of [null, 42, undefined, { raw: "METAR" }]) {
      try {
        // 类型面收 string——运行时脏输入的契约锁（调用方传错类型时的错误质量）
        parse(bad as unknown as string);
        expect.unreachable("应抛出");
      } catch (err) {
        expect(err).toBeInstanceOf(MetarParseError);
        expect((err as MetarParseError).code).toBe("invalid-input");
      }
    }
  });

  it("输入面：token 数超上限只告警不截断（解析照常完整，raw 保真）", () => {
    const flood = `METAR ZFLT 121200Z ${Array.from({ length: 130 }, () => "RA").join(" ")}`;
    const r = parse(flood);
    expect(r.station).toBe("ZFLT");
    expect(r.raw).toBe(flood);
    const cap = r.warnings.find((w) => w.message.includes("token 数超上限"));
    expect(cap).toBeDefined();
    expect(cap?.code).toBe("invalid-format");
    expect(cap?.severity).toBe("warning");
    expect(cap?.span).toBeUndefined();
    // 常规报文零上限告警
    expect(parse(BASE).warnings.some((w) => w.message.includes("token 数超上限"))).toBe(false);
  });

  it("tryParse 结果式出口：成功 ok 面/整体失败 err 面均不抛出，code 契约同 parse", () => {
    const ok = tryParse(BASE);
    expect(ok.ok).toBe(true);
    if (!ok.ok) throw new Error("unreachable: BASE 应解析成功");
    expect(ok.report.station).toBe("ZBAA");
    const err = tryParse("");
    expect(err.ok).toBe(false);
    if (!err.ok) {
      expect(err.error.code).toBe("missing-station");
    } else throw new Error("unreachable: 空串应失败");
    const bad = tryParse(null as unknown as string);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.error.code).toBe("invalid-input");
    } else throw new Error("unreachable: 非字符串应失败");
  });

  it("-VCTSRA（强度符+VC，NWS 自动站实弹）：切解收下 + invalid-format 出声，不再整体丢语义", () => {
    const r = parse("METAR KGPC 120915Z AUTO 00000KT 10SM -VCTSRA SCT100 BKN120");
    expect(r.weather?.kind).toBe("value");
    const wx = r.weather?.kind === "value" ? r.weather.value[0] : undefined;
    expect(wx?.intensity).toBe("-");
    expect(wx?.proximity).toBe(true);
    expect(wx?.descriptor).toBe("TS");
    expect(wx?.phenomena).toEqual(["RA"]);
    expect(r.warnings.some((w) => w.code === "invalid-format")).toBe(true);
    expect(r.warnings.some((w) => w.code === "unknown-token")).toBe(false);
    // -VCSH 同族（VC 裸 SH 带强度符）
    const sh = parse("METAR ZBAA 121253Z 30015KT 9999 -VCSH SCT030 12/02 Q1013");
    expect(sh.weather?.kind === "value" && sh.weather.value[0]?.proximity).toBe(true);
    expect(sh.warnings.some((w) => w.code === "invalid-format")).toBe(true);
  });

  it("+DS（4678 表内合法电码 heavy duststorm）：收下零告警——正锁防按旧注释误改为出声/拒收", () => {
    const r = parse("METAR ZBAA 121253Z 30015KT 3000 +DS SCT030 12/02 Q1013");
    expect(r.weather?.kind).toBe("value");
    const wx = r.weather?.kind === "value" ? r.weather.value[0] : undefined;
    expect(wx?.intensity).toBe("+");
    expect(wx?.phenomena).toEqual(["DS"]);
    expect(r.warnings).toHaveLength(0);
  });

  it("组级 span 外包络契约钉子：包络自首组至末组，精确段在各元素 span", () => {
    const r = parse("METAR ZSPD 120330Z 04004MPS R07/2000 9999 R25/3000 27/18 Q1020 NOSIG");
    expect(r.runwayVisualRange?.kind).toBe("value");
    if (r.runwayVisualRange?.kind === "value") {
      expect(r.raw.slice(r.runwayVisualRange.span!.start, r.runwayVisualRange.span!.end)).toBe(
        "R07/2000 9999 R25/3000",
      );
      const first = r.runwayVisualRange.value[0];
      expect(r.raw.slice(first!.span!.start, first!.span!.end)).toBe("R07/2000");
    }
  });

  it("单数跑道号 R8L/2000（规范外：跑道号恒两位）：现状锁——unknown-token 出声、RVR 不捏造", () => {
    const r = parse("METAR ZBAA 121253Z 30015KT 9999 R8L/2000 12/02 Q1013");
    expect(r.runwayVisualRange).toBeUndefined();
    const unknown = r.warnings.filter((w) => w.code === "unknown-token");
    expect(unknown).toHaveLength(1);
    expect(r.raw.slice(unknown[0]!.span!.start, unknown[0]!.span!.end)).toBe("R8L/2000");
  });

  it("LTG 数字吸收收紧：词表词后单数字吸收（FMH-1 自动站海里距离），LTG 直连数字/双数字不吸收", () => {
    const vocabNoDigit = parse(
      "METAR ZBAA 121253Z 30015KT 9999 SCT030 12/02 Q1013 RMK LTG DSNT SW",
    );
    expect(remarkRawOf(vocabNoDigit, "lightning")).toBe("LTG DSNT SW");
    const autoNm = parse("METAR ZBAA 121253Z 30015KT 9999 SCT030 12/02 Q1013 RMK LTG CG 12 OHD");
    expect(remarkRawOf(autoNm, "lightning")).toBe("LTG CG 12 OHD");
    const bareDigit = parse("METAR ZBAA 121253Z 30015KT 9999 SCT030 12/02 Q1013 RMK LTG 12");
    expect(remarkRawOf(bareDigit, "lightning")).toBe("LTG");
    const twoDigits = parse("METAR ZBAA 121253Z 30015KT 9999 SCT030 12/02 Q1013 RMK LTG CG 12 13");
    expect(remarkRawOf(twoDigits, "lightning")).toBe("LTG CG 12");
  });
});

/** RMK 段指定 kind 的 raw 提取（LTG 聚合锁用） */
function remarkRawOf(r: ReturnType<typeof parse>, kind: string): string | undefined {
  return r.remarks.find((x) => x.kind === kind)?.raw;
}

describe("2026-09-14 独立复评批收尾回归锁（粘连豁免/方向组连挂/COR 漂移槽）", () => {
  it("粘连趋势指示组（BECMGAT0130）收口不误响：只有粘连 info，无『不属趋势要素族』收口告警", () => {
    const r = parse("ZBAA 121253Z 30015KT 9999 SCT030 12/02 Q1013 NOSIG BECMGAT0130 4000");
    expect(r.trends).toHaveLength(2); // NOSIG + 粘连 BECMG（由粘连分支认领）
    expect(r.trends[1]?.kind).toBe("becmg");
    const fusedInfo = r.warnings.filter(
      (w) => w.code === "invalid-format" && w.message.includes("粘连"),
    );
    expect(fusedInfo).toHaveLength(1);
    expect(r.warnings.some((w) => w.message.includes("不属趋势要素族"))).toBe(false);
  });

  it("方向组连挂（无主导组）：第二枚出声不静默；真主导组介入后旗标复位（后续方向组静默挂载）", () => {
    // 连挂：1200NW（脱离主导，按主导收下）+ 1200NE（连挂第二枚——此前静默覆写）
    const hang = parse("METAR ZSPC 120330Z 04004MPS 1200NW 1200NE 27/18 Q1020 NOSIG");
    expect(hang.visibility?.kind === "value" && hang.visibility.value.minimum?.direction).toBe(
      "NE",
    );
    expect(
      hang.warnings.filter(
        (w) => w.code === "duplicate-group" && w.message.includes("最低能见度方向组"),
      ),
    ).toHaveLength(1);
    // 旗标复位：NW（脱离收下）→ 8000（真主导组，重复能见度告警）→ NE（静默正常挂载）
    const reset = parse("METAR ZSPC 120330Z 04004MPS 1200NW 8000 1200NE 27/18 Q1020 NOSIG");
    expect(reset.visibility?.kind === "value" && reset.visibility.value.value).toBe(8000);
    expect(reset.visibility?.kind === "value" && reset.visibility.value.minimum?.direction).toBe(
      "NE",
    );
    // 告警面：NW 脱离 info + 8000 重复能见度组 duplicate-group；NE 不出方向组告警
    expect(
      reset.warnings.filter(
        (w) => w.code === "duplicate-group" && w.message.includes("最低能见度方向组"),
      ),
    ).toHaveLength(0);
    expect(
      reset.warnings.filter((w) => w.code === "duplicate-group" && w.message.includes("能见度组")),
    ).toHaveLength(1);
  });

  it("COR 槽位漂移（站名后/时组前）：消费置 corrected + 出声，不再整体失败；后随非时组照旧 missing-time", () => {
    const r = parse("METAR ZSPD COR 120330Z 30015KT 9999 SCT030 12/02 Q1013 NOSIG");
    expect(r.station).toBe("ZSPD");
    expect(r.time.hour).toBe(3);
    expect(r.flags.corrected).toBe(true);
    expect(
      r.warnings.some((w) => w.code === "invalid-format" && w.message.includes("槽位漂移")),
    ).toBe(true);
    expect(r.warnings.some((w) => w.code === "unknown-token")).toBe(false);
    // CCA 漂移同样出声（对称）
    const cca = parse("METAR ZSPD CCA 120330Z 30015KT 9999 SCT030 12/02 Q1013 NOSIG");
    expect(cca.warnings.some((w) => w.message.includes("槽位漂移"))).toBe(true);
    // 后随非时组仍走 missing-time 契约
    expect(() => parse("METAR ZSPD COR 999999Z")).toThrow(MetarParseError);
  });

  it("温露缺测消息形态判别：12///（标准 // 缺测形）不再误述为 24/ 形态", () => {
    const r = parse("METAR ZBAA 121253Z 30015KT 9999 SCT030 12/// Q1013");
    expect(r.temperature?.celsius).toBe(12);
    expect(r.dewpoint).toBeUndefined();
    const info = r.warnings.find((w) => w.code === "missing-expected");
    expect(info?.message).toContain("//");
    expect(info?.message).not.toContain("24/");
  });
});

describe("五角色评测修复批：缺测电码不顶替在场值（重复组 last-wins 的信息损失防线）", () => {
  it("后位 //// 不顶替已有能见度：9999 保留 + duplicate-group 前后值都进 message", () => {
    const r = parse("ZBAA 111100Z 22005KT 9999 FEW020 //// Q1005");
    expect(r.visibility?.kind === "value" && r.visibility.value.value).toBe(9999);
    const w = r.warnings.find((x) => x.code === "duplicate-group");
    expect(w?.severity).toBe("warning");
    expect(w?.message).toContain("9999");
    expect(w?.message).toContain("////");
    expect(r.raw.slice(w?.span!.start ?? 0, w?.span!.end ?? 0)).toBe("////");
  });

  it("后位 ////SM（英里制缺测）同理不顶替", () => {
    const r = parse("METAR KDSM 121953Z 34010KT 10SM //// BKN035 18/14 A3005");
    expect(r.visibility?.kind === "value" && r.visibility.value.value).toBe(10);
    expect(r.warnings.some((x) => x.code === "duplicate-group")).toBe(true);
  });

  it("后位 /////KT 不顶替已有风组", () => {
    const r = parse("ZBAA 111100Z 22005KT /////KT 9999 25/20 Q1005");
    expect(r.wind?.kind === "value" && r.wind.value.direction).toBe(220);
    expect(r.warnings.some((x) => x.code === "duplicate-group")).toBe(true);
  });

  it("后位 ///// 不顶替已有温露组", () => {
    const r = parse("ZBAA 111100Z 22005KT 9999 FEW020 25/20 ///// Q1005");
    expect(r.temperature?.celsius).toBe(25);
    expect(r.dewpoint?.celsius).toBe(20);
    expect(r.warnings.some((x) => x.code === "duplicate-group")).toBe(true);
  });

  it("能见度槽位正规缺测（无前值）行为不变：missing + missing-expected 不回归", () => {
    const r = parse("METAR RJTT 080800Z 18012KT //// FEW010 28/27 Q1005");
    expect(r.visibility?.kind).toBe("missing");
    expect(r.warnings.some((x) => x.code === "missing-expected")).toBe(true);
  });

  it("带部分值的重复温露（12/// 形态，温度在位露点缺测）仍 last-wins：值→值口径不回归", () => {
    const r = parse("METAR ZBAA 121253Z 30015KT 9999 SCT030 25/20 12/// Q1013");
    expect(r.temperature?.celsius).toBe(12);
    expect(r.dewpoint).toBeUndefined();
    expect(r.warnings.some((x) => x.code === "duplicate-group")).toBe(true);
  });
});
