import { describe, expect, it } from "vitest";
import { MetarParseError } from "@metweave/core";
import { parseTaf, tryParseTaf } from "./taf";
import tafFixtures from "./__fixtures__/taf.json";

interface TafFixture {
  id: string;
  raw: string;
  station: string;
  source: string;
  obsTime: string;
  hash: string;
  traps: string[];
  note: string;
}

const file = tafFixtures as { count: number; fixtures: TafFixture[] };
const byId = new Map(file.fixtures.map((f) => [f.id, f]));
const fx = (id: string): TafFixture => {
  const f = byId.get(id);
  if (f === undefined) throw new Error(`TAF 夹具缺失: ${id}`);
  return f;
};

const expectThrows = (raw: string, code: string) => {
  try {
    parseTaf(raw);
  } catch (err) {
    expect(err).toBeInstanceOf(MetarParseError);
    expect((err as MetarParseError).code).toBe(code);
    expect((err as MetarParseError).raw).toBe(raw);
    return;
  }
  throw new Error(`应抛 ${code} 而未抛: ${raw}`);
};

describe("TAF 批 1 骨架：电头与有效期（清单 A4）", () => {
  it("夹具自锁：count 与条目数一致，来源可溯源", () => {
    expect(file.fixtures.length).toBe(file.count);
    for (const f of file.fixtures) {
      expect(f.raw.startsWith("TAF")).toBe(true);
      expect(f.station).toMatch(/^[A-Z0-9]{4}$/);
      if (f.source === "ogimet" || f.source === "aw") expect(f.hash).toMatch(/^[0-9a-f]{12}$/);
    }
  });

  it("例行报（ogimet 实证）：裸电头 + 发布时组 + 跨日有效期", () => {
    const f = fx("ogimet-plain-zbaa-20090801");
    const r = parseTaf(f.raw);
    expect(r.kind).toBe("taf");
    expect(r.station).toBe("ZBAA");
    expect(r.issueTime).toEqual({ day: 1, hour: 3, minute: 40 });
    expect(r.validity).toMatchObject({ startDay: 1, startHour: 6, endDay: 2, endHour: 6 });
    expect(r.validity?.raw).toBe("0106/0206");
    expect(r.flags).toEqual({ amended: false, corrected: false });
    expect(r.cavok).toBe(false);
    expect(r.remarks).toEqual([]);
  });

  it("AMD 修订位（ogimet 实证）与 COR 类型词位（ogimet 实证）各自置位", () => {
    const amd = parseTaf(fx("ogimet-amd-zbtj-20090806").raw);
    expect(amd.flags).toEqual({ amended: true, corrected: false });
    const cor = parseTaf(fx("ogimet-cor-type-zbaa-20090814").raw);
    expect(cor.flags).toEqual({ amended: false, corrected: true });
  });

  it("COR 时组后位（中国 AFTN/ICAO 惯例）置 corrected——A4 不写死槽位", () => {
    const r = parseTaf("TAF ZBAA 010340Z COR 0106/0206 17004MPS=");
    expect(r.flags.corrected).toBe(true);
    expect(r.flags.amended).toBe(false);
  });

  it("电头词可省（剥词源形态）与 TAF AMD COR 连用", () => {
    const bare = parseTaf("ZBAA 010340Z 0106/0206 17004MPS=");
    expect(bare.station).toBe("ZBAA");
    expect(bare.validity?.startHour).toBe(6);
    const both = parseTaf("TAF AMD COR ZBAA 010340Z 0106/0206 17004MPS=");
    expect(both.flags).toEqual({ amended: true, corrected: true });
  });

  it("重复 AMD/COR 出声不静默（duplicate-group），首枚置位", () => {
    const r = parseTaf("TAF AMD AMD ZBAA 010340Z 0106/0206 17004MPS=");
    expect(r.flags.amended).toBe(true);
    const dups = r.warnings.filter((w) => w.code === "duplicate-group");
    expect(dups).toHaveLength(1);
    expect(dups[0]).toMatchObject({ severity: "warning" });
    expect(dups[0]?.span).toEqual({ start: 8, end: 11 });
  });

  it("止时 24＝午夜合法特例（B2 前置形态），越界值整体失败", () => {
    const midnight = parseTaf("TAF ZBAA 010340Z 0106/0224 17004MPS=");
    expect(midnight.validity).toMatchObject({ endDay: 2, endHour: 24 });
    expectThrows("TAF ZBAA 010340Z 0106/0225 17004MPS=", "invalid-validity");
    expectThrows("TAF ZBAA 010340Z 3206/0206 17004MPS=", "invalid-validity");
    // 有效期组位被非 ddHH/ddHH 组占据（此处为风组）＝组缺失
    expectThrows("TAF ZBAA 010340Z 17004MPS=", "missing-validity");
  });

  it("发布时组沿 METAR 契约：缺失/越界整体失败", () => {
    expectThrows("TAF ZBAA", "missing-time");
    expectThrows("TAF ZBAA 012530Z 0106/0206=", "invalid-time");
    expectThrows("TAF", "missing-station");
    expectThrows("TAF 7STATION 010340Z 0106/0206=", "missing-station");
  });

  it("批 1 正文未接管：正文 token 一律 unknown-token（info）出声且带 span（终止符已剥离不进结构）", () => {
    const raw = "TAF ZBAA 010340Z 0106/0206 17004MPS=";
    const r = parseTaf(raw);
    const tailTokens = ["17004MPS"];
    expect(r.warnings).toHaveLength(tailTokens.length);
    for (const [idx, text] of tailTokens.entries()) {
      expect(r.warnings[idx]).toMatchObject({ code: "unknown-token", severity: "info" });
      expect(rawSlice(raw, r.warnings[idx]?.span)).toBe(text);
    }
  });

  it("spans:false 紧凑模式剥除全部 span；strict 模式显式报错不静默降级", () => {
    const c = parseTaf(fx("ogimet-plain-zbaa-20090801").raw, { spans: false });
    expect(JSON.stringify(c)).not.toContain('"span"');
    try {
      parseTaf("TAF ZBAA 010340Z 0106/0206 17004MPS=", { mode: "strict" });
      throw new Error("strict 应抛 unsupported-mode");
    } catch (e) {
      expect(e).toBeInstanceOf(MetarParseError);
      expect((e as MetarParseError).code).toBe("unsupported-mode");
    }
  });

  it("非字符串输入走稳定契约；tryParseTaf 与 parseTaf 同语义", () => {
    expect(() => parseTaf(null as unknown as string)).toThrow(MetarParseError);
    const ok = tryParseTaf("TAF ZBAA 010340Z 0106/0206 17004MPS=");
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.report.station).toBe("ZBAA");
    const bad = tryParseTaf("TAF ZBAA 010340Z");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("missing-validity");
  });
});

describe("TAF 批 1.2：传输层终止符 = 剥离（清单 A1★）", () => {
  it("双通道等价：ogimet 带 = 与去 = 后解析结果除 raw 外逐字段一致", () => {
    const f = fx("ogimet-plain-zbaa-20090801");
    const withEq = parseTaf(f.raw);
    const withoutEq = parseTaf(f.raw.replace(/=+$/, ""));
    const { raw: _w, ...withRest } = withEq;
    const { raw: _o, ...withoutRest } = withoutEq;
    expect(withRest).toEqual(withoutRest);
    expect(withEq.raw).toBe(f.raw);
  });

  it("两种真实形态等价：贴末组（6000=）与独立 token（6000 =）", () => {
    const attached = parseTaf("TAF ZBAA 010340Z 0106/0206 6000=");
    const separate = parseTaf("TAF ZBAA 010340Z 0106/0206 6000 =");
    const { raw: _a, ...a } = attached;
    const { raw: _s, ...s } = separate;
    expect(a).toEqual(s);
  });

  it("aw 实证（aviationweather 通道本无 =）：解析成功且尾 token 不含终止符", () => {
    const f = fx("aw-amd-zgsz-20260910");
    const r = parseTaf(f.raw);
    expect(r.flags.amended).toBe(true);
    expect(r.validity).toMatchObject({ startDay: 10, startHour: 6, endDay: 11, endHour: 12 });
    expect(JSON.stringify(r.warnings)).not.toContain('"="');
  });

  it("中串 = 属传输磨损非终止符：不剥，随所在 token 出声", () => {
    const r = parseTaf("TAF ZBAA 010340Z 0106/0206 AAA=BBB=");
    const texts = r.warnings.filter((w) => w.code === "unknown-token");
    expect(texts).toHaveLength(1);
    expect(texts[0]?.message).toContain("AAA=BBB");
  });
});

describe("TAF 批 1.3：NIL/CNL 位置判别（清单 A2★）", () => {
  it("NIL 占时组位（实测形态 TAF ZSAM NIL=，无时组）：缺报最小形态，无有效期无正文零告警", () => {
    const f = fx("textbook-nil-zsam");
    const r = parseTaf(f.raw);
    expect(r).toMatchObject({
      kind: "taf",
      station: "ZSAM",
      nil: true,
      flags: { amended: false, corrected: false },
      cavok: false,
    });
    expect(r.issueTime).toBeUndefined();
    expect(r.validity).toBeUndefined();
    expect(r.cancelled).toBeUndefined();
    expect(r.warnings).toEqual([]);
  });

  it("NIL 占有效期位（带时组形态）：nil 最小形态，时组凭据保留", () => {
    const r = parseTaf("TAF ZSAM 010000Z NIL=");
    expect(r.nil).toBe(true);
    expect(r.issueTime).toEqual({ day: 1, hour: 0, minute: 0 });
    expect(r.validity).toBeUndefined();
    expect(r.warnings).toEqual([]);
  });

  it("NIL 后零期待：多余 token 出声不静默", () => {
    const r = parseTaf("TAF ZSAM 010000Z NIL TEMPO 0106/0109=");
    expect(r.nil).toBe(true);
    expect(r.warnings).toHaveLength(2); // TEMPO 与 0106/0109 两个 token（终止符已剥离）
    expect(r.warnings.every((w) => w.code === "unknown-token")).toBe(true);
  });

  it("CNL 占风组位（教材实证）：cancelled 置位，有效期保留，正文截断零告警", () => {
    const f = fx("textbook-amd-cnl-zbad");
    const r = parseTaf(f.raw);
    expect(r.cancelled).toBe(true);
    expect(r.flags.amended).toBe(true);
    expect(r.validity).toMatchObject({ startDay: 3, startHour: 6, endDay: 4, endHour: 6 });
    expect(r.nil).toBeUndefined();
    expect(r.warnings).toEqual([]);
  });

  it("CNL 后零期待：多余 token 出声；CNL 占有效期位属结构违规 → missing-validity", () => {
    const r = parseTaf("TAF ZBAD 030800Z 0306/0406 CNL 9999=");
    expect(r.cancelled).toBe(true);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]?.code).toBe("unknown-token");
    expectThrows("TAF ZBAD 030800Z CNL=", "missing-validity");
  });
});

/** 取 span 对应原文（本地 helper，等价 METAR 侧测试的原文回看）；定义先于使用（模块提升不适用于函数声明外的场景，此处前置） */
function rawSlice(raw: string, span: { start: number; end: number } | undefined): string {
  if (span === undefined) return "";
  return raw.slice(span.start, span.end);
}
