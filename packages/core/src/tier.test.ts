import { describe, expect, it } from "vitest";
import {
  cloudLayerTone,
  conditionTierOf,
  isConditionUnknown,
  metarTierOf,
  visibilityGroupTone,
  weatherGroupTone,
} from "./index";
import type { ConditionInput, MetarReport, WeatherGroup } from "./index";

/** 手搭最小 MetarReport（core 不依赖 parser——判据测试自建 IR，不引入包间测试耦合） */
const minimalReport = (overrides: Partial<MetarReport> = {}): MetarReport => ({
  kind: "metar",
  raw: "METAR ZBAA 110700Z VRB02MPS CAVOK 25/10 Q1019 NOSIG",
  station: "ZBAA",
  time: { day: 11, hour: 7, minute: 0 },
  flags: { auto: false, corrected: false },
  cavok: true,
  trends: [],
  runwayStates: [],
  remarks: [],
  warnings: [],
  ...overrides,
});

const wxGroup = (
  phenomena: WeatherGroup["phenomena"],
  extra: Partial<WeatherGroup> = {},
): WeatherGroup => ({ proximity: false, phenomena, ...extra });

/** 判据输入基线（7000 m + BLDU + 阵风 14 m/s：不触任何红/琥珀线——WS/SQ 增补锁的干净底座） */
const calmBase: ConditionInput = {
  cavok: false,
  wind: {
    kind: "value",
    value: {
      variable: false,
      direction: 320,
      speed: { value: 9, unit: "mps" },
      gust: { value: 14, unit: "mps" },
    },
  },
  visibility: { kind: "value", value: { value: 7000, unit: "m", exact: true } },
  weather: { kind: "value", value: [wxGroup(["DU"], { descriptor: "BL" })] }, // BLDU 高吹尘
  clouds: { elements: [] },
};

describe("判据单源（v0.3 下沉）：四档内置判据", () => {
  it("基线口径回归：CAVOK good / NIL unknown / TS poor / 降水 caution（判据入 core 后与 0.2.x 语义零漂移）", () => {
    expect(conditionTierOf({ cavok: true })).toBe("good");
    expect(conditionTierOf({ cavok: false, nil: true })).toBe("unknown");
    expect(
      conditionTierOf({
        cavok: false,
        weather: { kind: "value", value: [wxGroup(["RA"], { descriptor: "TS" })] },
      }),
    ).toBe("poor");
    expect(
      conditionTierOf({
        cavok: false,
        weather: { kind: "value", value: [wxGroup(["RA"])] },
        clouds: { elements: [] },
      }),
    ).toBe("caution");
  });

  it("WS 红锁：报文含风切变组即 poor（v0.3 增补——此前 WS 不参与判档，只报 WS 无 TS/CB 的报文落绿）", () => {
    expect(conditionTierOf(calmBase)).toBe("good"); // 无 WS 基线＝good，锁「升红确由 WS 触发」
    expect(conditionTierOf({ ...calmBase, windShear: { runways: [], allRunways: true } })).toBe(
      "poor",
    ); // WS ALL RWY 形态
    expect(
      conditionTierOf({ ...calmBase, windShear: { runways: ["36R"], allRunways: false } }),
    ).toBe("poor"); // WS R36R 指定跑道形态
  });

  it("SQ 琥珀锁：飑单独出现给 caution（v0.3 增补，保守档——危害主要经阵风与对流传导，不过度告警）", () => {
    expect(conditionTierOf(calmBase)).toBe("good"); // 无 SQ 基线＝good
    expect(
      conditionTierOf({
        ...calmBase,
        weather: { kind: "value", value: [wxGroup(["SQ"])] },
      }),
    ).toBe("caution");
  });

  it("FC/+FC/SS/DS 红锁：漏斗云/龙卷与沙暴/尘暴报级入红（v0.3 增补——对起降运行的直接危害与 TS 同级；此前只报这些组的报文按「其余情况」落 good）", () => {
    expect(conditionTierOf(calmBase)).toBe("good"); // 无直害现象基线＝good，锁「升红确由该组触发」
    expect(
      conditionTierOf({ ...calmBase, weather: { kind: "value", value: [wxGroup(["FC"])] } }),
    ).toBe("poor"); // FC 漏斗云
    expect(
      conditionTierOf({
        ...calmBase,
        weather: { kind: "value", value: [wxGroup(["FC"], { intensity: "+" })] },
      }),
    ).toBe("poor"); // +FC 龙卷/水龙卷
    expect(
      conditionTierOf({ ...calmBase, weather: { kind: "value", value: [wxGroup(["SS"])] } }),
    ).toBe("poor"); // SS 沙暴
    expect(
      conditionTierOf({ ...calmBase, weather: { kind: "value", value: [wxGroup(["DS"])] } }),
    ).toBe("poor"); // DS 尘暴
  });

  it("metarTierOf：MetarReport 结构性满足 ConditionInput（直收全报 IR；windShear 一等字段进判据）", () => {
    expect(metarTierOf(minimalReport())).toBe("good");
    expect(
      metarTierOf(
        minimalReport({
          cavok: false,
          windShear: { runways: ["02L"], allRunways: false },
          clouds: { elements: [] },
        }),
      ),
    ).toBe("poor");
  });

  it("TAF 投影形态：runwayStates/windShear 缺省的 ConditionInput 照常判档（消费方投影构造面）", () => {
    // @metweave/leaflet 的 asConditionInput 投影形状：TAF 语汇无跑道状态与风切变组位，两字段恒缺席
    expect(
      conditionTierOf({
        cavok: false,
        visibility: { kind: "value", value: { value: 1200, unit: "m", exact: true } },
        clouds: { elements: [{ kind: "layer", amount: "OVC", heightFt: { value: 800 } }] },
      }),
    ).toBe("poor"); // BECMG 后 1200 m + OVC008 的经典形态
  });
});

describe("要素级扫视色调（卡片行色判据，与报级档位同文件对照）", () => {
  it("weatherGroupTone：SQ 入琥珀为 v0.3 增补；+ 强度组级恒 danger；普通组不着色", () => {
    expect(weatherGroupTone(wxGroup(["SQ"]))).toBe("caution");
    expect(weatherGroupTone(wxGroup(["SQ"], { intensity: "+" }))).toBe("danger"); // +SQ：组级 + 强度恒红
    expect(weatherGroupTone(wxGroup(["RA"], { descriptor: "TS" }))).toBe("danger");
    expect(weatherGroupTone(wxGroup(["RA"], { descriptor: "FZ" }))).toBe("danger"); // FZRA
    expect(weatherGroupTone(wxGroup(["RA"], { intensity: "-" }))).toBe("caution"); // -RA
    expect(weatherGroupTone(wxGroup(["HZ"]))).toBeUndefined(); // 霾不着色
  });

  it("weatherGroupTone：FC/SS/DS 组级 danger（v0.3 增补，与报级入红同批）；+FC 已恒 danger（+ 强度）", () => {
    expect(weatherGroupTone(wxGroup(["FC"]))).toBe("danger"); // 漏斗云
    expect(weatherGroupTone(wxGroup(["SS"]))).toBe("danger"); // 沙暴
    expect(weatherGroupTone(wxGroup(["DS"]))).toBe("danger"); // 尘暴
    expect(weatherGroupTone(wxGroup(["FC"], { intensity: "+" }))).toBe("danger"); // +FC：组级 + 强度恒红（既有）
  });

  it("visibilityGroupTone：<1500 danger、1500–5000 caution（边界值锁：1500 落 caution、5000 起无色）", () => {
    expect(visibilityGroupTone({ value: 1499, unit: "m", exact: true })).toBe("danger");
    expect(visibilityGroupTone({ value: 1500, unit: "m", exact: true })).toBe("caution");
    expect(visibilityGroupTone({ value: 4999, unit: "m", exact: true })).toBe("caution");
    expect(visibilityGroupTone({ value: 5000, unit: "m", exact: true })).toBeUndefined();
  });

  it("cloudLayerTone：BKN/OVC 云底 <1000 danger、1000–3000 caution（行级 ≤3000 口径边界锁：3000 落 caution、3001 起无色；与报级 <3000 的既有口径差如实锁）", () => {
    expect(cloudLayerTone({ kind: "layer", amount: "BKN", heightFt: { value: 999 } })).toBe(
      "danger",
    );
    expect(cloudLayerTone({ kind: "layer", amount: "OVC", heightFt: { value: 1000 } })).toBe(
      "caution",
    );
    expect(cloudLayerTone({ kind: "layer", amount: "OVC", heightFt: { value: 3000 } })).toBe(
      "caution",
    ); // 行级 ≤3000：恰 3000 仍琥珀
    expect(
      cloudLayerTone({ kind: "layer", amount: "OVC", heightFt: { value: 3001 } }),
    ).toBeUndefined();
    expect(
      cloudLayerTone({ kind: "layer", amount: "SCT", heightFt: { value: 500 } }),
    ).toBeUndefined(); // 疏云不判云底
  });

  it("cloudLayerTone：VV 组任意 caution、<400 danger（400 边界落 caution）", () => {
    expect(cloudLayerTone({ kind: "vertical-visibility", heightFt: { value: 399 } })).toBe(
      "danger",
    );
    expect(cloudLayerTone({ kind: "vertical-visibility", heightFt: { value: 400 } })).toBe(
      "caution",
    );
  });
});

describe("isConditionUnknown（unknown 档谓词单源：三条件合成）", () => {
  const visMissing = { kind: "missing" as const };
  const cloudsAllMissing = {
    elements: [{ kind: "layer" as const, amount: null, heightFt: { value: null } }],
  };
  const weatherMissing = { kind: "missing" as const };

  it("三条件齐备 → true；任一缺席 → false（能见度有值/云有值/天气有值/CAVOK 各自短路）", () => {
    expect(
      isConditionUnknown({
        cavok: false,
        visibility: visMissing,
        clouds: cloudsAllMissing,
        weather: weatherMissing,
      }),
    ).toBe(true);
    expect(
      isConditionUnknown({
        cavok: false,
        visibility: visMissing,
        clouds: cloudsAllMissing,
        weather: { kind: "value", value: [wxGroup(["RA"])] },
      }),
    ).toBe(false); // 天气有值
    expect(
      isConditionUnknown({
        cavok: false,
        visibility: visMissing,
        clouds: { elements: [{ kind: "layer", amount: "SCT", heightFt: { value: 3000 } }] },
        weather: weatherMissing,
      }),
    ).toBe(false); // 云组有值
    expect(
      isConditionUnknown({
        cavok: false,
        visibility: { kind: "value", value: { value: 7000, unit: "m", exact: true } },
        clouds: cloudsAllMissing,
        weather: weatherMissing,
      }),
    ).toBe(false); // 能见度有值
    expect(
      isConditionUnknown({
        cavok: true,
        visibility: visMissing,
        clouds: cloudsAllMissing,
        weather: weatherMissing,
      }),
    ).toBe(false); // CAVOK 云判据短路（全缺测判据不含 CAVOK 报）
    expect(isConditionUnknown({ cavok: false, weather: weatherMissing })).toBe(false); // 云组省略（≠全缺测）
  });

  it("与 conditionTierOf 灰档同判：谓词真即 unknown、NIL 恒 unknown", () => {
    const allMissing: ConditionInput = {
      cavok: false,
      visibility: visMissing,
      clouds: cloudsAllMissing,
      weather: weatherMissing,
    };
    expect(conditionTierOf(allMissing)).toBe("unknown");
    expect(conditionTierOf({ ...allMissing, nil: true })).toBe("unknown"); // NIL 恒灰（先于谓词）
  });
});
