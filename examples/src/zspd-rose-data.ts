/**
 * 验收台统计面板的数据面（gen-zspd-rose.mjs 产物 zspd-rose-data.json 的消费件）：
 * 类型与守卫单源——verify-main（页面）与 verify-rose.test（数据面测试）共用，
 * unknown 收窄靠守卫不靠断言（同 lowalt-profile 纪律）。
 */
/** 构建期 JSON 的顶层形状（gen 脚本产物——字段说明见 scripts/gen-zspd-rose.mjs）。 */
export interface LedgerNumbers {
  readonly samples: number;
  readonly inSector: number;
  readonly calm: number;
  readonly missingDirection: number;
  readonly missingSpeed: number;
}

/** 账目五键（组件披露行的机读 dataset 键——与构建期实算期望逐项对账的判面）。 */
export const LEDGER_KEYS = [
  "samples",
  "inSector",
  "calm",
  "missingDirection",
  "missingSpeed",
] as const;
export type LedgerKey = (typeof LEDGER_KEYS)[number];

/** 一个月的样本：逐时 [来向|null, 风速kt|null] 对（内部形状——经 ZspdRoseData 结构透出）。 */
interface ZspdMonth {
  readonly month: number;
  readonly samples: readonly (readonly (number | null)[])[];
  readonly account: LedgerNumbers;
}

export interface ZspdRoseData {
  readonly months: readonly ZspdMonth[];
  readonly expected: {
    readonly totals: LedgerNumbers;
    readonly months: readonly (LedgerNumbers & { readonly month: number })[];
  };
}

/** 账目形状守卫：五键齐且全为数值。 */
const isLedger = (x: unknown): x is LedgerNumbers => {
  if (typeof x !== "object" || x === null) return false;
  if (
    !("samples" in x) ||
    !("inSector" in x) ||
    !("calm" in x) ||
    !("missingDirection" in x) ||
    !("missingSpeed" in x)
  ) {
    return false;
  }
  return (
    typeof x.samples === "number" &&
    typeof x.inSector === "number" &&
    typeof x.calm === "number" &&
    typeof x.missingDirection === "number" &&
    typeof x.missingSpeed === "number"
  );
};

/** 带月号的账目行（expected.months 项）。 */
const isLedgerMonth = (x: unknown): x is LedgerNumbers & { readonly month: number } =>
  isLedger(x) && "month" in x && typeof x.month === "number";

/** 样本对守卫：恰两位、每位 null 或非负数值。 */
const isSamplePair = (x: unknown): x is readonly (number | null)[] =>
  Array.isArray(x) &&
  x.length === 2 &&
  x.every((n) => n === null || (typeof n === "number" && Number.isFinite(n)));

const isZspdMonth = (x: unknown): x is ZspdMonth => {
  if (typeof x !== "object" || x === null || !("month" in x) || !("samples" in x)) return false;
  if (typeof x.month !== "number" || !(x.month >= 1 && x.month <= 12)) return false;
  const samples: unknown = x.samples;
  return Array.isArray(samples) && samples.every((row) => isSamplePair(row));
};

/** 顶层守卫：逐月样本＋期望账（totals 与逐月账目）。 */
export const isZspdRoseData = (x: unknown): x is ZspdRoseData => {
  if (typeof x !== "object" || x === null || !("months" in x) || !("expected" in x)) return false;
  const months: unknown = x.months;
  if (!Array.isArray(months) || !months.every((m) => isZspdMonth(m))) return false;
  const expected: unknown = x.expected;
  if (typeof expected !== "object" || expected === null) return false;
  if (!("totals" in expected) || !("months" in expected)) return false;
  if (!isLedger(expected.totals)) return false;
  const monthAccounts: unknown = expected.months;
  return Array.isArray(monthAccounts) && monthAccounts.every((m) => isLedgerMonth(m));
};

/** JSON 样本对 → 组件输入（[来向|null, 风速kt|null] → { direction, speed } 逐字对应）。 */
export const toSamples = (
  pairs: readonly (readonly (number | null)[])[],
): { direction: number | null; speed: number | null }[] =>
  pairs.map((pair) => ({
    direction: pair[0] ?? null,
    speed: pair[1] ?? null,
  }));
