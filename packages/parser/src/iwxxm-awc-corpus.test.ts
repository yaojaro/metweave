// AWC 2025-2 实时流语料测试：corpus/iwxxm/awc/（41 站，NOAA AWC aviationweather.gov 免鉴权
// 端点 2026-10-05 单次拉取冻结；.tac 取自 AWC 报文内嵌的源 TAC 注释——同一份电报的两种编码，
// 与 wmo-im 官方等价对同源关系，但非「官方翻译」而是 AWC 转换中心（KKCI/NWS AWC）输出）。
//
// 快照口径（单通道，逐站理由）：
// - AWC 转换器把一切能见度统一经英里折算再回米（实测：9999→9994、5000→5005、4000→4007、
//   P6SM→9994、10SM→16093），数值面与任何 TAC 原文不可能逐位相等——双通道 deep-equal 对
//   AWC 通道结构性不可行，全量走 XML 单通道 IR 快照（排除 raw/warnings，warnings 另行断言关键条）；
//   第三期起快照含 span 字段（源元素/属性在冻结语料中的确定性区间）——快照即 span 基线，
//   解析器或定位逻辑漂移会在此处红；
// - AWC 转换的其余有损处（趋势组/NOSIG 不转、RVR 不转、RMK 入 iwxxm-us 扩展、VRB 风向丢失、
//   CLR/NSC/CAVOK 落空云容器、VV 落 OVX 层、气温取 RMK T 组十分位精度）如实入快照——快照锁定
//   的是「解析器对 AWC 形态的输出」，不是「两通道等价」；
// - 版本面：AWC 流命名空间 2025-2（schemaLocation 指 schemas.wmo.int/iwxxm/2025-2RC1），
//   属支持版本——全部站点断言不出 invalid-format 版本告警。
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "./index";
import type { MetarReport } from "@metweave/core";
import { parseIwxxm as parseIwxxmRaw, type IwxxmReport } from "./iwxxm";

/** 观测侧收窄：AWC 语料恒为 METAR/SPECI 根（TAF 根见 iwxxm-corpus.test.ts 的 taf-pairs 组）。 */
const asMetar = (r: IwxxmReport): MetarReport => {
  if (r.kind === "taf") throw new Error("预期 METAR/SPECI IR，实得 TAF IR——夹具错置");
  return r;
};
const parseIwxxm = (xml: string): MetarReport => asMetar(parseIwxxmRaw(xml));

const corpusDir = fileURLToPath(new URL("../../../corpus/iwxxm/awc/", import.meta.url));

interface Pair {
  readonly stem: string;
  readonly tac: string;
  readonly xml: string;
}

const readPairs = (): Pair[] => {
  const files = readdirSync(corpusDir).filter((f) => f.endsWith(".xml"));
  return files.map((file) => {
    const stem = file.replace(/\.xml$/, "");
    return {
      stem,
      tac: readFileSync(`${corpusDir}${stem}.tac`, "utf8").trim(),
      xml: readFileSync(`${corpusDir}${file}`, "utf8"),
    };
  });
};

/** 快照可比形态：剥离 raw 与 warnings（warnings 的关键条另行断言——版本/空云容器口径见文件头）。 */
function comparable(report: MetarReport): Omit<MetarReport, "raw" | "warnings"> {
  const { raw: _raw, warnings: _warnings, ...rest } = report;
  return rest;
}

describe("AWC 2025-2 实时流语料（corpus/iwxxm/awc）", () => {
  const all = readPairs();

  it("语料齐备（41 站，.tac/.xml 成对）", () => {
    expect(all.length).toBe(41);
    expect(all.every((p) => p.stem.match(/^[A-Z0-9]{4}-\d{6}Z$/))).toBe(true);
  });

  it("全站：XML 可解析、站名/时组与文件名一致、kind 与 TAC 电头一致、不出版本告警", () => {
    for (const pair of all) {
      const r = parseIwxxm(pair.xml);
      const [station, stamp] = pair.stem.split("-");
      if (station === undefined || stamp === undefined) throw new Error(`文件名异常: ${pair.stem}`);
      expect(r.station, pair.stem).toBe(station);
      expect(r.time, pair.stem).toEqual({
        day: Number(stamp.slice(0, 2)),
        hour: Number(stamp.slice(2, 4)),
        minute: Number(stamp.slice(4, 6)),
      });
      const tacRoot = pair.tac.split(" ")[0];
      expect(r.kind, pair.stem).toBe(tacRoot === "SPECI" ? "speci" : "metar");
      // 2025-2 属支持版本——版本告警不再出声（识别的版本不出 invalid-format）
      expect(
        r.warnings.some((w) => w.code === "invalid-format" && w.message.includes("非支持版本")),
        pair.stem,
      ).toBe(false);
      // TAC 通道（内嵌源电码）同站同时组——两通道对同一份电报的站名/时组必须一致
      const tac = parse(pair.tac);
      expect(tac.station, pair.stem).toBe(r.station);
      expect(tac.time, pair.stem).toEqual(r.time);
    }
  });

  it("全站：观测字段面无 unknown-token（AWC 形态全部可落位或显式 info 出声）", () => {
    for (const pair of all) {
      const r = parseIwxxm(pair.xml);
      expect(
        r.warnings.filter((w) => w.code === "unknown-token"),
        pair.stem,
      ).toEqual([]);
    }
  });

  // —— 代表站全量 IR 快照（覆盖 AWC 形态各特征类；快照值即 AWC 转换口径，理由见文件头）——
  const snapshots: Readonly<Record<string, Omit<MetarReport, "raw" | "warnings">>> = {
    // CAVOK 报的 AWC 形态：vis 9994（P6SM 折算）+ 空云容器 + 无趋势（TAC 的 NOSIG/CAVOK 不转）
    "ZSPD-050600Z": {
      kind: "metar",
      station: "ZSPD",
      time: {
        day: 5,
        hour: 6,
        minute: 0,
      },
      flags: {
        auto: false,
        corrected: false,
      },
      cavok: false,
      wind: {
        kind: "value",
        value: {
          variable: false,
          direction: 340,
          speed: {
            value: 16,
            unit: "kt",
            span: {
              start: 2195,
              end: 2253,
            },
          },
        },
        span: {
          start: 2054,
          end: 2302,
        },
      },
      visibility: {
        kind: "value",
        value: {
          value: 9994,
          unit: "m",
          exact: true,
          span: {
            start: 2357,
            end: 2426,
          },
        },
        span: {
          start: 2302,
          end: 2483,
        },
      },
      temperature: {
        celsius: 24,
        span: {
          start: 1893,
          end: 1950,
        },
      },
      dewpoint: {
        celsius: 12,
        span: {
          start: 1950,
          end: 2017,
        },
      },
      altimeter: {
        value: 1018,
        unit: "hPa",
        span: {
          start: 2017,
          end: 2054,
        },
      },
      trends: [],
      runwayStates: [],
      remarks: [],
    },
    // 美制站：CLR 落空云容器、10SM→16093、A3008→1018.7 hPa、气温取 RMK T 组十分位（15.6/12.2）
    "KSEA-050553Z": {
      kind: "metar",
      station: "KSEA",
      time: {
        day: 5,
        hour: 5,
        minute: 53,
      },
      flags: {
        auto: false,
        corrected: false,
      },
      cavok: false,
      wind: {
        kind: "value",
        value: {
          variable: false,
          direction: 360,
          speed: {
            value: 3,
            unit: "kt",
            span: {
              start: 2250,
              end: 2307,
            },
          },
        },
        span: {
          start: 2109,
          end: 2356,
        },
      },
      visibility: {
        kind: "value",
        value: {
          value: 16093,
          unit: "m",
          exact: true,
          span: {
            start: 2411,
            end: 2481,
          },
        },
        span: {
          start: 2356,
          end: 2538,
        },
      },
      temperature: {
        celsius: 15.6,
        span: {
          start: 1942,
          end: 2001,
        },
      },
      dewpoint: {
        celsius: 12.2,
        span: {
          start: 2001,
          end: 2070,
        },
      },
      altimeter: {
        value: 1018.7,
        unit: "hPa",
        span: {
          start: 2070,
          end: 2109,
        },
      },
      trends: [],
      runwayStates: [],
      remarks: [],
    },
    // 双天气组 + 双云层（-DZ BR / BKN003 OVC017），6SM→9656
    "KATL-050552Z": {
      kind: "metar",
      station: "KATL",
      time: {
        day: 5,
        hour: 5,
        minute: 52,
      },
      flags: {
        auto: false,
        corrected: false,
      },
      cavok: false,
      wind: {
        kind: "value",
        value: {
          variable: false,
          direction: 20,
          speed: {
            value: 7,
            unit: "kt",
            span: {
              start: 2304,
              end: 2361,
            },
          },
        },
        span: {
          start: 2164,
          end: 2410,
        },
      },
      visibility: {
        kind: "value",
        value: {
          value: 9656,
          unit: "m",
          exact: true,
          span: {
            start: 2465,
            end: 2534,
          },
        },
        span: {
          start: 2410,
          end: 2591,
        },
      },
      weather: {
        kind: "value",
        value: [
          {
            intensity: "-",
            proximity: false,
            phenomena: ["DZ"],
            span: {
              start: 2591,
              end: 2661,
            },
          },
          {
            proximity: false,
            phenomena: ["BR"],
            span: {
              start: 2661,
              end: 2730,
            },
          },
        ],
        span: {
          start: 2591,
          end: 2730,
        },
      },
      clouds: {
        elements: [
          {
            kind: "layer",
            amount: "BKN",
            heightFt: {
              value: 300,
              span: {
                start: 2885,
                end: 2926,
              },
            },
            span: {
              start: 2778,
              end: 2945,
            },
          },
          {
            kind: "layer",
            amount: "OVC",
            heightFt: {
              value: 1700,
              span: {
                start: 3079,
                end: 3121,
              },
            },
            span: {
              start: 2972,
              end: 3140,
            },
          },
        ],
      },
      temperature: {
        celsius: 21.1,
        span: {
          start: 1999,
          end: 2058,
        },
      },
      dewpoint: {
        celsius: 20.6,
        span: {
          start: 2058,
          end: 2127,
        },
      },
      altimeter: {
        value: 1019,
        unit: "hPa",
        span: {
          start: 2127,
          end: 2164,
        },
      },
      trends: [],
      runwayStates: [],
      remarks: [],
    },
    // VV001 的 AWC 形态：OVX 云量层 → IR vertical-visibility（KCRW METAR，1/2SM→805）
    "KCRW-050554Z": {
      kind: "metar",
      station: "KCRW",
      time: {
        day: 5,
        hour: 5,
        minute: 54,
      },
      flags: {
        auto: false,
        corrected: false,
      },
      cavok: false,
      wind: {
        kind: "value",
        value: {
          variable: false,
          direction: 0,
          speed: {
            value: 0,
            unit: "kt",
            span: {
              start: 2256,
              end: 2313,
            },
          },
        },
        span: {
          start: 2117,
          end: 2362,
        },
      },
      visibility: {
        kind: "value",
        value: {
          value: 805,
          unit: "m",
          exact: true,
          span: {
            start: 2417,
            end: 2485,
          },
        },
        span: {
          start: 2362,
          end: 2542,
        },
      },
      weather: {
        kind: "value",
        value: [
          {
            proximity: false,
            phenomena: ["FG"],
            span: {
              start: 2542,
              end: 2611,
            },
          },
        ],
        span: {
          start: 2542,
          end: 2611,
        },
      },
      clouds: {
        elements: [
          {
            kind: "vertical-visibility",
            heightFt: {
              value: 100,
              span: {
                start: 2766,
                end: 2807,
              },
            },
            span: {
              start: 2659,
              end: 2826,
            },
          },
        ],
      },
      temperature: {
        celsius: 14.4,
        span: {
          start: 1950,
          end: 2009,
        },
      },
      dewpoint: {
        celsius: 14.4,
        span: {
          start: 2009,
          end: 2078,
        },
      },
      altimeter: {
        value: 1021.1,
        unit: "hPa",
        span: {
          start: 2078,
          end: 2117,
        },
      },
      trends: [],
      runwayStates: [],
      remarks: [],
    },
    // SPECI 根（kind=speci、auto=true）+ OVX 形态
    "KDAN-050615Z": {
      kind: "speci",
      station: "KDAN",
      time: {
        day: 5,
        hour: 6,
        minute: 15,
      },
      flags: {
        auto: true,
        corrected: false,
      },
      cavok: false,
      wind: {
        kind: "value",
        value: {
          variable: false,
          direction: 0,
          speed: {
            value: 0,
            unit: "kt",
            span: {
              start: 2220,
              end: 2277,
            },
          },
        },
        span: {
          start: 2081,
          end: 2326,
        },
      },
      visibility: {
        kind: "value",
        value: {
          value: 805,
          unit: "m",
          exact: true,
          span: {
            start: 2381,
            end: 2449,
          },
        },
        span: {
          start: 2326,
          end: 2506,
        },
      },
      weather: {
        kind: "value",
        value: [
          {
            proximity: false,
            phenomena: ["FG"],
            span: {
              start: 2506,
              end: 2575,
            },
          },
        ],
        span: {
          start: 2506,
          end: 2575,
        },
      },
      clouds: {
        elements: [
          {
            kind: "vertical-visibility",
            heightFt: {
              value: 100,
              span: {
                start: 2730,
                end: 2771,
              },
            },
            span: {
              start: 2623,
              end: 2790,
            },
          },
        ],
      },
      temperature: {
        celsius: 15,
        span: {
          start: 1918,
          end: 1975,
        },
      },
      dewpoint: {
        celsius: 15,
        span: {
          start: 1975,
          end: 2042,
        },
      },
      altimeter: {
        value: 1019.7,
        unit: "hPa",
        span: {
          start: 2042,
          end: 2081,
        },
      },
      trends: [],
      runwayStates: [],
      remarks: [],
    },
    // 阵风（30008G18KT→gust 18）+ NSC 落空云容器 + 5000→5005
    "VIDP-050600Z": {
      kind: "metar",
      station: "VIDP",
      time: {
        day: 5,
        hour: 6,
        minute: 0,
      },
      flags: {
        auto: false,
        corrected: false,
      },
      cavok: false,
      wind: {
        kind: "value",
        value: {
          variable: false,
          direction: 300,
          speed: {
            value: 8,
            unit: "kt",
            span: {
              start: 2207,
              end: 2264,
            },
          },
          gust: {
            value: 18,
            unit: "kt",
            span: {
              start: 2264,
              end: 2322,
            },
          },
        },
        span: {
          start: 2066,
          end: 2371,
        },
      },
      visibility: {
        kind: "value",
        value: {
          value: 5005,
          unit: "m",
          exact: true,
          span: {
            start: 2426,
            end: 2495,
          },
        },
        span: {
          start: 2371,
          end: 2552,
        },
      },
      weather: {
        kind: "value",
        value: [
          {
            proximity: false,
            phenomena: ["HZ"],
            span: {
              start: 2552,
              end: 2621,
            },
          },
        ],
        span: {
          start: 2552,
          end: 2621,
        },
      },
      temperature: {
        celsius: 32,
        span: {
          start: 1905,
          end: 1962,
        },
      },
      dewpoint: {
        celsius: 20,
        span: {
          start: 1962,
          end: 2029,
        },
      },
      altimeter: {
        value: 1012,
        unit: "hPa",
        span: {
          start: 2029,
          end: 2066,
        },
      },
      trends: [],
      runwayStates: [],
      remarks: [],
    },
    // 9999→9994 + -RA + FEW009（TAC 侧 TEMPO 趋势不转，trends 恒空）
    "EFHK-050550Z": {
      kind: "metar",
      station: "EFHK",
      time: {
        day: 5,
        hour: 5,
        minute: 50,
      },
      flags: {
        auto: false,
        corrected: false,
      },
      cavok: false,
      wind: {
        kind: "value",
        value: {
          variable: false,
          direction: 210,
          speed: {
            value: 7,
            unit: "kt",
            span: {
              start: 2214,
              end: 2271,
            },
          },
        },
        span: {
          start: 2073,
          end: 2320,
        },
      },
      visibility: {
        kind: "value",
        value: {
          value: 9994,
          unit: "m",
          exact: true,
          span: {
            start: 2375,
            end: 2444,
          },
        },
        span: {
          start: 2320,
          end: 2501,
        },
      },
      weather: {
        kind: "value",
        value: [
          {
            intensity: "-",
            proximity: false,
            phenomena: ["RA"],
            span: {
              start: 2501,
              end: 2571,
            },
          },
        ],
        span: {
          start: 2501,
          end: 2571,
        },
      },
      clouds: {
        elements: [
          {
            kind: "layer",
            amount: "FEW",
            heightFt: {
              value: 2000,
              span: {
                start: 2726,
                end: 2768,
              },
            },
            span: {
              start: 2619,
              end: 2787,
            },
          },
        ],
      },
      temperature: {
        celsius: 11,
        span: {
          start: 1912,
          end: 1969,
        },
      },
      dewpoint: {
        celsius: 10,
        span: {
          start: 1969,
          end: 2036,
        },
      },
      altimeter: {
        value: 1008,
        unit: "hPa",
        span: {
          start: 2036,
          end: 2073,
        },
      },
      trends: [],
      runwayStates: [],
      remarks: [],
    },
    // BKN300（30000ft 高层）+ 5000→5005；TAC 的 100V260 风向扇区 AWC 不转（无 variation）
    "WSSS-050600Z": {
      kind: "metar",
      station: "WSSS",
      time: {
        day: 5,
        hour: 6,
        minute: 0,
      },
      flags: {
        auto: false,
        corrected: false,
      },
      cavok: false,
      wind: {
        kind: "value",
        value: {
          variable: false,
          direction: 150,
          speed: {
            value: 5,
            unit: "kt",
            span: {
              start: 2220,
              end: 2277,
            },
          },
        },
        span: {
          start: 2079,
          end: 2326,
        },
      },
      visibility: {
        kind: "value",
        value: {
          value: 5005,
          unit: "m",
          exact: true,
          span: {
            start: 2381,
            end: 2450,
          },
        },
        span: {
          start: 2326,
          end: 2507,
        },
      },
      weather: {
        kind: "value",
        value: [
          {
            proximity: false,
            phenomena: ["HZ"],
            span: {
              start: 2507,
              end: 2576,
            },
          },
        ],
        span: {
          start: 2507,
          end: 2576,
        },
      },
      clouds: {
        elements: [
          {
            kind: "layer",
            amount: "FEW",
            heightFt: {
              value: 2000,
              span: {
                start: 2731,
                end: 2773,
              },
            },
            span: {
              start: 2624,
              end: 2792,
            },
          },
          {
            kind: "layer",
            amount: "BKN",
            heightFt: {
              value: 30000,
              span: {
                start: 2926,
                end: 2969,
              },
            },
            span: {
              start: 2819,
              end: 2988,
            },
          },
        ],
      },
      temperature: {
        celsius: 32,
        span: {
          start: 1918,
          end: 1975,
        },
      },
      dewpoint: {
        celsius: 24,
        span: {
          start: 1975,
          end: 2042,
        },
      },
      altimeter: {
        value: 1010,
        unit: "hPa",
        span: {
          start: 2042,
          end: 2079,
        },
      },
      trends: [],
      runwayStates: [],
      remarks: [],
    },
    // 26004MPS→8kt（单位跟组走）+ CAVOK 落 vis 9994；TAC 的 180V330 扇区 AWC 不转
    "ZBAA-050600Z": {
      kind: "metar",
      station: "ZBAA",
      time: {
        day: 5,
        hour: 6,
        minute: 0,
      },
      flags: {
        auto: false,
        corrected: false,
      },
      cavok: false,
      wind: {
        kind: "value",
        value: {
          variable: false,
          direction: 260,
          speed: {
            value: 8,
            unit: "kt",
            span: {
              start: 2199,
              end: 2256,
            },
          },
        },
        span: {
          start: 2058,
          end: 2305,
        },
      },
      visibility: {
        kind: "value",
        value: {
          value: 9994,
          unit: "m",
          exact: true,
          span: {
            start: 2360,
            end: 2429,
          },
        },
        span: {
          start: 2305,
          end: 2486,
        },
      },
      temperature: {
        celsius: 23,
        span: {
          start: 1897,
          end: 1954,
        },
      },
      dewpoint: {
        celsius: -4,
        span: {
          start: 1954,
          end: 2021,
        },
      },
      altimeter: {
        value: 1017,
        unit: "hPa",
        span: {
          start: 2021,
          end: 2058,
        },
      },
      trends: [],
      runwayStates: [],
      remarks: [],
    },
  };

  it("代表站全量 IR 快照（排除 raw/warnings——AWC 转换口径的锁定值）", () => {
    const byStem = new Map(all.map((p) => [p.stem, p]));
    for (const [stem, expected] of Object.entries(snapshots)) {
      const pair = byStem.get(stem);
      if (pair === undefined) throw new Error(`语料缺失: ${stem}`);
      expect(comparable(parseIwxxm(pair.xml)), stem).toEqual(expected);
    }
  });

  it("空云容器（AWC 的 CLR/NSC/CAVOK 形态）→ info 出声不静默", () => {
    for (const stem of ["ZSPD-050600Z", "KSEA-050553Z", "VIDP-050600Z", "ZBAA-050600Z"]) {
      const pair = all.find((p) => p.stem === stem);
      if (pair === undefined) throw new Error(`语料缺失: ${stem}`);
      const r = parseIwxxm(pair.xml);
      expect(
        r.warnings.some((w) => w.code === "invalid-format" && w.message.includes("云容器为空")),
        stem,
      ).toBe(true);
      expect(r.clouds, stem).toBeUndefined();
    }
  });

  it("TAC 侧含趋势/RVR 的站：AWC 通道如实缺组（trends 恒空、RVR 不转——转换器有损，非解析器缺陷）", () => {
    const efhk = all.find((p) => p.stem === "EFHK-050550Z");
    if (efhk === undefined) throw new Error("语料缺失: EFHK-050550Z");
    expect(parse(efhk.tac).trends.length).toBeGreaterThan(0);
    expect(parseIwxxm(efhk.xml).trends).toEqual([]);
    const kboi = all.find((p) => p.stem.startsWith("KBOI"));
    if (kboi === undefined) throw new Error("语料缺失: KBOI");
    expect(parse(kboi.tac).runwayVisualRange).toBeDefined();
    expect(parseIwxxm(kboi.xml).runwayVisualRange).toBeUndefined();
  });
});
