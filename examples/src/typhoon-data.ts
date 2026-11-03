/**
 * 台风固化快照的消费件（typhoon-dolphin-2613.json 的类型与守卫单源）：
 * typhoon-main（页面）与 typhoon-demo.test（演示测试）共用——unknown 收窄靠守卫
 * 不靠断言（同 lowalt-profile 纪律）。
 */

/** 快照的一行（中央气象台台风网公开接口形态——固化快照逐字段对齐）。 */
export interface DolphinPoint {
  /** 时次 YYYYMMDDHHmm（UTC） */
  readonly t: string;
  /** 强度类别（TD/TS/STS/TY/STY/SuperTY） */
  readonly g: string;
  readonly lon: number;
  readonly lat: number;
  /** 中心气压 hPa */
  readonly p: number;
  /** 最大风速 m/s */
  readonly w: number;
  /** 移向（十六方位缩写） */
  readonly mv: string;
  /** 移速 km/h */
  readonly ms: number;
  /** 风圈半径表："30KTS"/"50KTS"/"64KTS" → 四象限半径 km（序 NE/SE/SW/NW）；消散段空表 */
  readonly r: Record<string, number[]>;
}

/** 快照行守卫：核对承重字段——标量形＋r 表（字符串键 → 数值数组）；键值不深检。 */
const isDolphinPoint = (x: unknown): x is DolphinPoint => {
  if (typeof x !== "object" || x === null) return false;
  if (
    !("t" in x) ||
    !("g" in x) ||
    !("lon" in x) ||
    !("lat" in x) ||
    !("p" in x) ||
    !("w" in x) ||
    !("mv" in x) ||
    !("ms" in x) ||
    !("r" in x)
  ) {
    return false;
  }
  if (
    typeof x.t !== "string" ||
    typeof x.g !== "string" ||
    typeof x.mv !== "string" ||
    typeof x.lon !== "number" ||
    typeof x.lat !== "number" ||
    typeof x.p !== "number" ||
    typeof x.w !== "number" ||
    typeof x.ms !== "number"
  ) {
    return false;
  }
  const radiiTable: unknown = x.r;
  if (typeof radiiTable !== "object" || radiiTable === null) return false;
  return Object.values(radiiTable).every(
    (radii) => Array.isArray(radii) && radii.every((n) => typeof n === "number"),
  );
};

/** 顶层守卫：pts 数组逐行核对（不符显式抛错——固化快照是构建期资产，坏形态不静默）。 */
export const readDolphinPts = (root: unknown): readonly DolphinPoint[] => {
  if (typeof root !== "object" || root === null || !("pts" in root)) {
    throw new Error("台风固化快照形态不符（缺 pts）");
  }
  const pts: unknown = root.pts;
  if (!Array.isArray(pts) || !pts.every((p) => isDolphinPoint(p))) {
    throw new Error("台风固化快照形态不符（pts 行缺承重字段）");
  }
  return pts;
};
