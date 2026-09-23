import { describe, expect, it } from "vitest";
import { MetarParseError } from "@metweave/core";
import { parse } from "./index";
import { expandTaf } from "./expand";
import { parseTaf, tafDurationHours, tryParseTaf } from "./taf";
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

  it("正文组越界处理：非基况组 unknown-token 出声（METAR 语汇组不属 TAF）", () => {
    const r = parseTaf("TAF ZBAA 010340Z 0106/0206 R01/0200 Q1009 29/24=");
    expect(r.wind).toBeUndefined();
    expect(r.visibility).toBeUndefined();
    expect(r.warnings).toHaveLength(3); // R01/0200、Q1009、29/24 各一 token
    expect(r.warnings.every((w) => w.code === "unknown-token")).toBe(true);
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

describe("TAF 批 3.1：风单位随组（清单 C1★）", () => {
  it("MPS 实证（ogimet/aw 全量形态）与 KT 形态（合成——本地通道无美国站 TAF 实证，注记）单位各自落位", () => {
    const mps = parseTaf("TAF ZBAA 010340Z 0106/0206 17004MPS=");
    expect(mps.wind?.kind === "value" && mps.wind.value.speed.unit).toBe("mps");
    const kt = parseTaf("TAF KDEN 101100Z 1012/1112 27015G25KT 9999 SCT040=");
    expect(kt.wind?.kind === "value" && kt.wind.value.speed.unit).toBe("kt");
    expect(kt.wind?.kind === "value" && kt.wind.value.gust?.value).toBe(25);
  });

  it("禁全局默认：无单位风组不认（落 unknown-token），绝不按猜测单位收值——IEM KT→MPS 代际漂移教训（2006–2010 KT/2011+ MPS）入档", () => {
    const r = parseTaf("TAF ZBAA 010340Z 0106/0206 17004=");
    expect(r.wind).toBeUndefined();
    expect(r.warnings.some((w) => w.code === "unknown-token")).toBe(true);
  });
});

describe("TAF 批 3.2：天气强度三档逐元素读（清单 C4★）", () => {
  it("组合组逐元素读：-SHRASN＝弱阵性雨夹雪（-·SH·RA+SN）、-RASN＝弱雨夹雪、+SN＝大雪、无符号＝中", () => {
    const r = parseTaf("TAF ZBAA 010340Z 0106/0206 9999 -SHRASN -RASN +SN SN=");
    const groups = r.weather?.kind === "value" ? r.weather.value : [];
    expect(groups).toHaveLength(4);
    expect(groups[0]).toMatchObject({ intensity: "-", descriptor: "SH" });
    expect(groups[0]?.phenomena).toEqual(["RA", "SN"]);
    expect(groups[1]).toMatchObject({ intensity: "-" });
    expect(groups[1]?.phenomena).toEqual(["RA", "SN"]);
    expect(groups[2]).toMatchObject({ intensity: "+" });
    expect(groups[2]?.phenomena).toEqual(["SN"]);
    expect(groups[3]?.intensity).toBeUndefined();
    expect(groups[3]?.phenomena).toEqual(["SN"]);
  });

  it("五/六轮考核失分点实证：黄金样本里的 -SN（小雪）/SN（中雪）/+SN（大雪）三档并存（ZYTL 教材版）", () => {
    const r = parseTaf(fx("textbook-zytl-260848z-golden").raw);
    const intensities = new Set<string>();
    const collect = (list: readonly { intensity?: string }[] | undefined): void => {
      for (const g of list ?? []) intensities.add(g.intensity ?? "none");
    };
    collect(r.weather?.kind === "value" ? r.weather.value : []);
    for (const c of r.changes) collect(c.elements?.weather);
    expect(intensities.has("-")).toBe(true);
    expect(intensities.has("none")).toBe(true);
    expect(intensities.has("+")).toBe(true);
  });
});

describe("TAF 批 3.3：天气白名单双层（清单 C5★）", () => {
  it("ZBTJ 实证：HZ 中国扩展层收下 + invalid-format/info 出声；国际白名单组（TSRA 族）不出声", () => {
    const r = parseTaf(fx("ogimet-zbtj-20240601-0304z").raw);
    expect(wx(r.weather?.kind === "value" ? r.weather.value : [])).toBe("HZ");
    const cn = r.warnings.filter((w) => w.message.includes("中国扩展层"));
    expect(cn).toHaveLength(1);
    expect(cn[0]).toMatchObject({ code: "invalid-format", severity: "info" });
    const intl = parseTaf("TAF ZBAA 010340Z 0106/0206 9999 TSRA SCT030CB=");
    expect(intl.warnings.filter((w) => w.message.includes("中国扩展层"))).toHaveLength(0);
  });

  it("弱档 -SN/-RA 均标记（变化组内同样出声）；完整拒收语义归 /validate（注记）", () => {
    const r = parseTaf("TAF ZBAA 010340Z 0106/0206 9999 TEMPO 0106/0109 -SN=");
    expect(r.warnings.filter((w) => w.message.includes("中国扩展层"))).toHaveLength(1);
  });
});

describe("TAF 批 3.4：气温组可变长（清单 C6★）", () => {
  it("ZGSZ 实证（30h 版 2TX+1TN 搭配）：交错原序落位，负值 M 前缀由 ZPPP 实证（1TX+2TN）", () => {
    const r = parseTaf(fx("aw-amd-zgsz-20260910").raw);
    expect(r.temperatures).toHaveLength(3);
    expect(r.temperatures.map((x) => x.extremum)).toEqual(["max", "max", "min"]);
    expect(r.temperatures[0]).toMatchObject({ celsius: 32, at: { day: 10, hour: 6 } });
    const p = parseTaf(fx("ogimet-zppp-20250125-1518z").raw);
    expect(p.temperatures.map((x) => x.extremum)).toEqual(["max", "min", "min"]);
    expect(p.temperatures[1]).toMatchObject({ celsius: -2 }); // TNM02 → −2（M 前缀）
  });

  it("ZBTJ 实证（24h 版 1TX+1TN）与合成超限形态（第 5 组出声不丢弃）", () => {
    const r = parseTaf(fx("ogimet-zbtj-20240601-0304z").raw);
    expect(r.temperatures.map((x) => x.extremum)).toEqual(["max", "min"]);
    expect(r.warnings.filter((w) => w.message.includes("上限"))).toHaveLength(0);
    const over = parseTaf(
      "TAF ZBAA 010340Z 0106/0206 TX30/0107Z TX31/0207Z TN20/0121Z TN21/0221Z TN22/0122Z=",
    );
    expect(over.temperatures).toHaveLength(5);
    expect(over.warnings.filter((w) => w.message.includes("上限"))).toHaveLength(1);
  });
});

/** 天气组紧凑串（黄金表断言用）：-SHRASN / BR / SN 形态 */
const wx = (
  list:
    | readonly {
        intensity?: string;
        proximity: boolean;
        descriptor?: string;
        phenomena: readonly string[];
      }[]
    | undefined,
): string =>
  (list ?? [])
    .map(
      (g) =>
        `${g.intensity ?? ""}${g.proximity ? "VC" : ""}${g.descriptor ?? ""}${g.phenomena.join("")}`,
    )
    .join(" ");
/** 云组紧凑串：SCT023 BKN033 / NSC（晴空词）/ VV005——高度英尺折百英尺电码位 */
const cl = (c: import("@metweave/core").CloudCondition | undefined): string => {
  if (c === undefined) return "";
  if (c.clear !== undefined && c.elements.length === 0) return c.clear.code;
  return c.elements
    .map((e) =>
      e.kind === "layer"
        ? `${e.amount ?? "?"}${String(Math.round((e.heightFt.value ?? 0) / 100)).padStart(3, "0")}${e.convective ?? ""}`
        : `VV${String(Math.round((e.heightFt.value ?? 0) / 100)).padStart(3, "0")}`,
    )
    .join(" ");
};

/** 时长断言 helper：起有效期组 → tafDurationHours（wrap 可选月锚） */
const dur = (raw: string, wrap?: number): number | undefined => {
  const v = parseTaf(`TAF ZBAA 010340Z ${raw} 17004MPS=`).validity;
  return v === undefined ? undefined : tafDurationHours(v, wrap);
};

describe("TAF 批 2.1：有效期时长差值算术（清单 B1★/B2/B3）", () => {
  it("标准两制：24h 与 30h 判别只看有效期组差值（禁用发布钟点——v1.2 实证口径）", () => {
    expect(dur("0106/0206")).toBe(24);
    expect(dur("0306/0406")).toBe(24);
    expect(dur("1006/1112")).toBe(30);
    expect(dur("0306/0412")).toBe(30);
  });

  it("B2 止时 24＝午夜特例自然进算术；同日窗与 FC 型 9h", () => {
    expect(dur("0106/0115")).toBe(9); // FC 型（同日 06→15）
    expect(dur("0106/0224")).toBe(42); // 1 日 06Z → 2 日午夜（B2 编 24）
  });

  it("B3 跨月回绕：起日 > 止日按所跨月长度回绕（缺省 31，带月锚精确）", () => {
    expect(dur("3106/0112")).toBe(30); // 31 日 06Z → 次月 1 日 12Z（31 天月）
    expect(dur("3006/0106", 30)).toBe(24); // 30 天月锚：30 日 06Z → 次月 1 日 06Z
    expect(dur("2806/0106", 28)).toBe(24); // 2 月（28 天）：28 日 06Z → 次月 1 日 06Z = 24h
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

describe("TAF 批 1.4：AAA/CCA 族仅容错（清单 A3★）", () => {
  // D 层纪律：824 万条三语料 0 出现（2026-09-14 精读核对入档），无实证可溯源——不入 fixture，
  // 仅合成单元用例；条文依据 AP-117 第三十条（修订加注 AAA/AAB、更正加注 CCA/CCB，发布时组后位）
  it("AAA/AAB 消费放行置 amended，CCA/CCB 置 corrected，均 invalid-format/info 出声", () => {
    const a = parseTaf("TAF ZBAA 010340Z AAA 0106/0206 17004MPS=");
    expect(a.flags.amended).toBe(true);
    expect(a.warnings[0]).toMatchObject({ code: "invalid-format", severity: "info" });
    expect(a.warnings[0]?.message).toContain("AAA");
    const c = parseTaf("TAF ZBAA 010340Z CCA 0106/0206 17004MPS=");
    expect(c.flags.corrected).toBe(true);
    expect(c.warnings[0]?.message).toContain("CCA");
  });

  it("主路径不受影响：无加注报文零此类告警；正文深位 AAA 不容错（unknown-token 出声）", () => {
    const plain = parseTaf("TAF ZBAA 010340Z 0106/0206 17004MPS=");
    expect(plain.warnings.some((w) => w.code === "invalid-format")).toBe(false);
    const deep = parseTaf("TAF ZBAA 010340Z 0106/0206 AAA=");
    expect(deep.flags.amended).toBe(false);
    expect(deep.warnings).toHaveLength(1);
    expect(deep.warnings[0]?.code).toBe("unknown-token");
  });
});

describe("TAF 批 1.5：基况段四要素 + CAVOK", () => {
  it("ogimet 实证（ZBAA 例行报）：基况四要素落位，变化组界后全部 unknown-token", () => {
    const f = fx("ogimet-plain-zbaa-20090801");
    const r = parseTaf(f.raw);
    expect(r.wind?.kind).toBe("value");
    if (r.wind?.kind === "value") {
      expect(r.wind.value).toMatchObject({ direction: 170, variable: false });
      expect(r.wind.value.speed).toMatchObject({ value: 4, unit: "mps" });
    }
    expect(r.visibility?.kind).toBe("value");
    if (r.visibility?.kind === "value") {
      expect(r.visibility.value).toMatchObject({ value: 2400, unit: "m", exact: true });
    }
    expect(r.weather?.kind).toBe("value");
    if (r.weather?.kind === "value") expect(r.weather.value).toHaveLength(1); // BR
    expect(r.clouds?.elements).toHaveLength(1); // OVC033
    expect(r.cavok).toBe(false);
    // 批 2.2 起：三条变化组（TEMPO×2 + BECMG）全结构化零 unknown-token；
    // 批 3.3 起：基况 BR + TEMPO -TSRA 两枚中国扩展层 info 告警（C5 容错层标记）
    expect(r.changes.map((c) => c.kind)).toEqual(["TEMPO", "TEMPO", "BECMG"]);
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings.every((w) => w.message.includes("中国扩展层"))).toBe(true);
    expect(rawSlice(f.raw, r.clouds?.elements[0]?.span)).toBe("OVC033");
  });

  it("ogimet 实证（ZBTJ 修订报）：NSC 晴空词落位 clear.code", () => {
    const r = parseTaf(fx("ogimet-amd-zbtj-20090806").raw);
    expect(r.clouds?.elements).toHaveLength(0);
    expect(r.clouds?.clear).toMatchObject({ code: "NSC" });
    expect(r.weather?.kind).toBe("value"); // BR
  });

  it("aw 实证（ZGSZ 30h 报）：8000/SCT040 落位；TX/TN 与 TEMPO 分别由 C6/批 2.2 接管后零 unknown-token", () => {
    const r = parseTaf(fx("aw-amd-zgsz-20260910").raw);
    expect(r.visibility?.kind).toBe("value");
    expect(r.clouds?.elements?.[0]).toMatchObject({ amount: "SCT" });
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0]).toMatchObject({ kind: "TEMPO" });
    expect(r.temperatures).toHaveLength(3); // 3.4 接管
    expect(r.warnings.filter((w) => w.code === "unknown-token")).toHaveLength(0);
  });

  it("CAVOK：三关让位（vis/weather/clouds 为省略态）+ 词位标记", () => {
    const r = parseTaf("TAF ZBAA 010350Z 0106/0206 18004MPS CAVOK=");
    expect(r.cavok).toBe(true);
    expect(r.visibility).toBeUndefined();
    expect(r.weather).toBeUndefined();
    expect(r.clouds).toBeUndefined();
    expect(rawSlice(r.raw, r.cavokSpan)).toBe("CAVOK");
  });

  it("重复风组 last-wins + duplicate-group 出声；缺测电码不顶替在场值（沿 METAR 口径）", () => {
    const dup = parseTaf("TAF ZBAA 010340Z 0106/0206 17004MPS 20005MPS=");
    expect(dup.warnings.some((w) => w.code === "duplicate-group")).toBe(true);
    if (dup.wind?.kind === "value") {
      expect(dup.wind.value.direction).toBe(200);
      expect(dup.wind.value.speed.value).toBe(5);
    }
    const keep = parseTaf("TAF ZBAA 010340Z 0106/0206 17004MPS /////KT=");
    expect(keep.warnings.some((w) => w.code === "duplicate-group")).toBe(true);
    if (keep.wind?.kind === "value") expect(keep.wind.value.direction).toBe(170);
  });

  it("同码组与 METAR 侧语义对拍：17004MPS / 2400 在两解析器产出一致（紧凑模式免 span 位差）", () => {
    const taf = parseTaf("TAF ZBAA 010340Z 0106/0206 17004MPS 2400=", { spans: false });
    const metar = parse("METAR ZBAA 010340Z 17004MPS 2400 FEW030 29/24 Q1010", { spans: false });
    expect(taf.wind).toEqual(metar.wind);
    expect(taf.visibility).toEqual(metar.visibility);
  });
});

describe("TAF 批 2.3：时间线展开器黄金测试（清单 B4★–B7★，taf-timeline §3 三例 13 时刻逐格）", () => {
  const JAN31 = { daysIn: 31 };
  const zppp = () => parseTaf(fx("ogimet-zppp-20250125-1518z").raw);
  const zsof = () => parseTaf(fx("ogimet-zsof-20250125-0913z").raw);
  const zytl = () => parseTaf(fx("textbook-zytl-260848z-golden").raw); // 教材版＝黄金表权威源（ogimet 变体留结构测试）

  it("§3.1 ZPPP：双 BECMG 继承链（6 时刻）", () => {
    const r = zppp();
    // 25 日 19:00——TEMPO 20Z 才开窗：只有基况（自检三问之一）
    const t1900 = expandTaf(r, { day: 25, hour: 19, minute: 0 }, JAN31);
    expect(t1900.boundSegment).toEqual({ kind: "base" });
    expect(t1900.conditions.wind?.speed.value).toBe(9);
    expect(t1900.conditions.visibility?.value).toBe(9999);
    expect(wx(t1900.conditions.weather)).toBe("");
    expect(cl(t1900.conditions.clouds)).toBe("SCT023 BKN033");
    expect(t1900.tempo).toBeUndefined();
    // 25 日 21:00——TEMPO 窗内双态
    const t2100 = expandTaf(r, { day: 25, hour: 21, minute: 0 }, JAN31);
    expect(t2100.conditions.visibility?.value).toBe(9999);
    expect(t2100.tempo?.conditions.visibility?.value).toBe(2500);
    expect(wx(t2100.tempo?.conditions.weather)).toBe("-SHRASN BR");
    // 26 日 02:00——TEMPO 已关、BECMG 未开：基况
    const t0200 = expandTaf(r, { day: 26, hour: 2, minute: 0 }, JAN31);
    expect(t0200.boundSegment).toEqual({ kind: "base" });
    expect(t0200.conditions.visibility?.value).toBe(9999);
    expect(t0200.tempo).toBeUndefined();
    // 26 日 05:30——过渡带（2605/2606 窗内）：uncertain 置真、按前段（基况）值
    const t0530 = expandTaf(r, { day: 26, hour: 5, minute: 30 }, JAN31);
    expect(t0530.uncertain).toBe(true);
    expect(t0530.conditions.visibility?.value).toBe(9999);
    // 26 日 08:00——2605/2606 后段：vis/天气取本段，风/云沿链回溯
    const t0800 = expandTaf(r, { day: 26, hour: 8, minute: 0 }, JAN31);
    expect(t0800.boundSegment).toEqual({ kind: "BECMG", index: 1 });
    expect(t0800.conditions.visibility?.value).toBe(2000);
    expect(wx(t0800.conditions.weather)).toBe("-SN BR");
    expect(t0800.conditions.wind?.direction).toBe(40); // 基况风沿用（04009G16）
    expect(cl(t0800.conditions.clouds)).toBe("SCT023 BKN033");
    // 26 日 13:00——2611/2612 后段：风自 2609 接棒（04004），云一路沿用
    const t1300 = expandTaf(r, { day: 26, hour: 13, minute: 0 }, JAN31);
    expect(t1300.conditions.wind?.speed.value).toBe(4);
    expect(t1300.conditions.visibility?.value).toBe(4000);
    expect(wx(t1300.conditions.weather)).toBe("BR");
    expect(cl(t1300.conditions.clouds)).toBe("SCT023 BKN033");
  });

  it("§3.2 ZSOF：云例外双弹（5 时刻）", () => {
    const r = zsof();
    // 25 日 15:00 基况
    const t1500 = expandTaf(r, { day: 25, hour: 15, minute: 0 }, JAN31);
    expect(t1500.conditions.wind?.speed.value).toBe(4);
    expect(t1500.conditions.visibility?.value).toBe(6000);
    expect(cl(t1500.conditions.clouds)).toBe("BKN006 OVC020");
    // 25 日 18:30——2516/2517 后段 + TEMPO(18–20) 窗内
    const t1830 = expandTaf(r, { day: 25, hour: 18, minute: 30 }, JAN31);
    expect(t1830.conditions.wind?.direction).toBe(340);
    expect(t1830.conditions.visibility?.value).toBe(2500);
    expect(wx(t1830.conditions.weather)).toBe("-SN BR");
    expect(cl(t1830.conditions.clouds)).toBe("BKN006 OVC020");
    expect(t1830.tempo?.conditions.visibility?.value).toBe(700);
    expect(wx(t1830.tempo?.conditions.weather)).toBe("SN");
    // 25 日 20:30——2519/2520 云例外：BKN004 单层（此前云作废）
    const t2030 = expandTaf(r, { day: 25, hour: 20, minute: 30 }, JAN31);
    expect(cl(t2030.conditions.clouds)).toBe("BKN004");
    expect(t2030.conditions.visibility?.value).toBe(2500);
    // 26 日 00:30——过渡带（2600/2601）
    const t0030 = expandTaf(r, { day: 26, hour: 0, minute: 30 }, JAN31);
    expect(t0030.uncertain).toBe(true);
    expect(cl(t0030.conditions.clouds)).toBe("BKN004");
    // 26 日 03:30——2602/2603 云例外：BKN020 单层；vis 3000 与 BR 沿自前序 BECMG
    const t0330 = expandTaf(r, { day: 26, hour: 3, minute: 30 }, JAN31);
    expect(cl(t0330.conditions.clouds)).toBe("BKN020");
    expect(t0330.conditions.visibility?.value).toBe(3000);
    expect(wx(t0330.conditions.weather)).toBe("BR");
  });

  it("§3.3 ZYTL：强度三档 + 风-only 接棒（2 时刻）", () => {
    const r = zytl();
    // 26 日 16:00——2614/2615 后段 + TEMPO(15–19) 窗内：发作中雪/间歇小雪 BR
    const t1600 = expandTaf(r, { day: 26, hour: 16, minute: 0 }, JAN31);
    expect(t1600.conditions.wind?.direction).toBe(280);
    expect(t1600.conditions.visibility?.value).toBe(2000);
    expect(wx(t1600.conditions.weather)).toBe("-SN BR");
    expect(wx(t1600.tempo?.conditions.weather)).toBe("SN");
    expect(t1600.conditions.clouds && cl(t1600.conditions.clouds)).toBe("BKN010");
    // 26 日 20:30——2619/2620 风-only 接棒 + TEMPO(19–23)：发作 +SN/BKN007、间歇 -SN BR/BKN010
    const t2030 = expandTaf(r, { day: 26, hour: 20, minute: 30 }, JAN31);
    expect(t2030.conditions.wind?.direction).toBe(350);
    expect(t2030.conditions.wind?.gust?.value).toBe(15); // 教材版 G15（ogimet 变体为 G14，方言差异入档）
    expect(t2030.conditions.visibility?.value).toBe(2000);
    expect(t2030.tempo?.conditions.visibility?.value).toBe(300);
    expect(wx(t2030.tempo?.conditions.weather)).toBe("+SN");
    expect(cl(t2030.tempo?.conditions.clouds)).toBe("BKN007");
    expect(cl(t2030.conditions.clouds)).toBe("BKN010");
  });

  it("开窗前只有基况（勿预设双态）+ NIL/无有效期报展开即报错", () => {
    const r = zppp();
    const before = expandTaf(r, { day: 25, hour: 17, minute: 0 }, JAN31);
    expect(before.boundSegment).toEqual({ kind: "base" });
    expect(before.tempo).toBeUndefined();
    const nil = parseTaf(fx("textbook-nil-zsam").raw);
    expect(() => expandTaf(nil, { day: 10, hour: 12, minute: 0 }, JAN31)).toThrow();
  });
});

describe("TAF 批 2.2：变化组结构化（清单 B4★/B5★/B8/B9）", () => {
  it("ZSOF 实证：BECMG 只列变化要素，cloud-only BECMG 单层入册（B5 token 层）", () => {
    const r = parseTaf(fx("ogimet-zsof-20250125-0913z").raw);
    const kinds = r.changes.map((c) => c.kind);
    expect(kinds).toEqual(["BECMG", "TEMPO", "BECMG", "BECMG", "BECMG"]);
    const cloudOnly = r.changes[2];
    expect(cloudOnly?.window).toMatchObject({
      startDay: 25,
      startHour: 19,
      endDay: 25,
      endHour: 20,
    });
    expect(cloudOnly?.elements?.clouds?.elements).toHaveLength(1); // BKN004 单层
    expect(cloudOnly?.elements?.wind).toBeUndefined(); // 只列云
    expect(cloudOnly?.elements?.weather).toHaveLength(0);
  });

  it("ZYTL 实证：风-only BECMG 与 TEMPO 窗内组值（含阵风与云）落位", () => {
    const r = parseTaf(fx("ogimet-zytl-20250126-0848z").raw);
    const windOnly = r.changes.filter((c) => c.kind === "BECMG")[1]; // 2619/2620 风-only
    expect(windOnly?.window).toMatchObject({ startDay: 26, startHour: 19, endHour: 20 });
    expect(windOnly?.elements?.wind?.gust).toMatchObject({ value: 14, unit: "mps" });
    expect(windOnly?.elements?.visibility).toBeUndefined();
    const tempo = r.changes[0];
    expect(tempo?.elements?.visibility?.value).toBe(1000);
    expect(tempo?.elements?.clouds?.elements?.[0]).toMatchObject({ amount: "BKN" });
  });

  it("B9 中方四位短窗：无日位，日归属回有效期起日；0700 型前向时对方为窗、否则按要素", () => {
    const r = parseTaf("TAF ZSAM 100301Z 1006/1106 17004MPS 9999 TEMPO 1824 2500 -SHRA=");
    expect(r.changes[0]?.window).toMatchObject({
      startDay: 10,
      startHour: 18,
      endDay: 10,
      endHour: 24,
    });
    // TEMPO 后 0700 非前向时对（07→00）——按能见度要素处理，不误吞为窗
    const r2 = parseTaf("TAF ZSAM 100301Z 1006/1106 17004MPS TEMPO 0700 SN=");
    expect(r2.changes[0]?.window).toBeUndefined();
    expect(r2.changes[0]?.elements?.visibility?.value).toBe(700);
  });

  it("B8 组合规则：PROB TEMPO 合法连用；PROB BECMG 违例出声且后者独立成组；PROB50 越界省略概率", () => {
    const ok = parseTaf("TAF ZBAA 010340Z 0106/0206 PROB30 TEMPO 0106/0109 TSRA=");
    expect(ok.changes[0]).toMatchObject({ kind: "PROB", probability: 30, withTempo: true });
    const bad = parseTaf("TAF ZBAA 010340Z 0106/0206 PROB40 BECMG 0106/0107 4000=");
    expect(bad.warnings.some((w) => w.message.includes("组合违例"))).toBe(true);
    expect(bad.changes.map((c) => c.kind)).toEqual(["PROB", "BECMG"]);
    const p50 = parseTaf("TAF ZBAA 010340Z 0106/0206 PROB50 TEMPO 0106/0109 TSRA=");
    expect(p50.changes[0]?.probability).toBeUndefined();
    expect(p50.warnings.some((w) => w.message.includes("概率越界"))).toBe(true);
  });

  it("FM 硬时刻（B4 token 层）：GGgg 到分钟；ZGGG/ZGSG 方言样本（清单 fixture 依据）", () => {
    const r = parseTaf("TAF ZGGG 010000Z 0106/0206 17004MPS FM0730 9999 SCT030=");
    expect(r.changes[0]).toMatchObject({ kind: "FM", at: { hour: 7, minute: 30 } });
    expect(r.changes[0]?.elements?.clouds?.elements?.[0]).toMatchObject({ amount: "SCT" });
  });
});

/** 取 span 对应原文（本地 helper，等价 METAR 侧测试的原文回看）；定义先于使用（模块提升不适用于函数声明外的场景，此处前置） */
function rawSlice(raw: string, span: { start: number; end: number } | undefined): string {
  if (span === undefined) return "";
  return raw.slice(span.start, span.end);
}
