/**
 * @metweave/render — 风统计组件的单样本输入类型（windRose / windDirFrequency 共用）。
 *
 * 独立成文件只为让统计单源（wind-rose-account.ts，内部模块）与公共组件共享同一
 * 份形状定义而不生环：组件与统计单源都从这里 import type。
 */
export interface WindRoseSample {
  /** 风速（量纲由组件的 unit 选项声明；≥0 有限数或 null/undefined＝缺测） */
  readonly speed?: number | null;
  /** 风向（气象口径**来向**，0–360°，北 0／东 90；null/undefined＝缺测或不定风向） */
  readonly direction?: number | null;
}
