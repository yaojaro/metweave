/**
 * @metweave/render — 风玫瑰统计单源（内部模块，不入公共 API 面）：windRose 与
 * windDirFrequency 共用的账目与扇区×档矩阵计算。
 *
 * **账目四桶（披露行的分桶次序，每样本恰落一桶）**：缺速（speed 缺测）→ 静风
 * （speed 在场且 < 静风阈——方向有无不影响，静风无方向可读）→ 缺向（方向缺测而
 * 风速可读——不定风向 VRB 一类）→ 入扇区。四桶之和恒等于样本总数 n；两组件的
 * 披露行数字由此恒等（一致性由测试断言锁死，不靠眼验）。
 *
 * **扇区归桶口径**（与观测玫瑰的通行实现逐行一致）：扇区中心对齐——
 * `floor(((direction + 半格) % 360) / 格宽)`，边界值归最近扇区；**档位归桶**：
 * 「首个 speed < 档上界」的档、全部越顶归末档（∞ 末档正常堆叠）。
 */
import type { WindRoseSample } from "./wind-rose-sample";

/** 风玫瑰/风向频率的账目（统计单源的产物；不入公共 API 面）。 */
export interface WindRoseAccount {
  /** 样本总数 n（全部输入行，含缺测行） */
  readonly samples: number;
  /** 入扇区样本数（n − 静风 − 缺向 − 缺速） */
  readonly inSector: number;
  /** 静风样本数（speed 在场且 < 静风阈） */
  readonly calm: number;
  /** 缺向样本数（方向缺测而风速可读——VRB 一类） */
  readonly missingDirection: number;
  /** 缺速样本数（speed 缺测） */
  readonly missingSpeed: number;
  /** 扇区×档频数矩阵（扇区 0＝正北、顺时针增；档自低到高——入扇区样本之和＝inSector） */
  readonly matrix: readonly (readonly number[])[];
}

/**
 * 统计单源：样本 → 账目＋扇区×档频数矩阵（windRose 与 windDirFrequency 共用，
 * 两组件的披露行数字由此恒等）。
 *
 * @throws direction 非法（越界/非有限数）或 speed 非法（负值/非有限数）时——与
 *         windDirStrip 的值域先例同口径，循环量的归一由供数方负责。
 */
export function windRoseAccount(
  samples: readonly WindRoseSample[],
  options: {
    readonly sectors: number;
    /** 档上界串（不含收尾 ∞——末档无界由实现补） */
    readonly edges: readonly number[];
    readonly calmThreshold: number;
    readonly caller: string;
  },
): WindRoseAccount {
  const { sectors, edges, calmThreshold, caller } = options;
  const half = 360 / sectors / 2;
  const width = 360 / sectors;
  // 列数＝档数＝有限档界数＋1（末档无界——档位合法落点 0..edges.length 全有格）
  const matrix: number[][] = Array.from({ length: sectors }, () =>
    Array.from({ length: edges.length + 1 }, () => 0),
  );
  let calm = 0;
  let missingDirection = 0;
  let missingSpeed = 0;
  for (const [index, sample] of samples.entries()) {
    const at = `第 ${index + 1} 个样本`;
    const speed = sample.speed;
    if (speed !== undefined && speed !== null && !(Number.isFinite(speed) && speed >= 0)) {
      throw new Error(
        `${caller} ${at}的 speed 非法（${String(speed)}，须为 ≥0 的有限数或缺测 null）`,
      );
    }
    const direction = sample.direction;
    if (
      direction !== undefined &&
      direction !== null &&
      !(Number.isFinite(direction) && direction >= 0 && direction <= 360)
    ) {
      throw new Error(
        `${caller} ${at}的 direction 非法（${String(direction)}，须为 0–360 的有限数：北 0／东 90／南 180／西 270；循环量的归一由供数方负责）`,
      );
    }
    if (speed === undefined || speed === null) {
      missingSpeed += 1; // 桶一：缺速（方向有无不影响）
      continue;
    }
    if (speed < calmThreshold) {
      calm += 1; // 桶二：静风（速度在场但低于阈——无方向可读）
      continue;
    }
    if (direction === undefined || direction === null) {
      missingDirection += 1; // 桶三：缺向（有风无向——VRB 一类）
      continue;
    }
    // 桶四：入扇区（扇区中心对齐＋边界归最近扇区；档取首个 speed < 上界，越顶归末档）
    const sector = Math.floor(((direction + half) % 360) / width);
    let band = edges.findIndex((edge) => speed < edge);
    if (band < 0) band = edges.length; // ∞ 末档正常堆叠
    const row = matrix[sector];
    if (row !== undefined) {
      const cell = row[band];
      if (cell !== undefined) row[band] = cell + 1;
    }
  }
  const inSector = samples.length - calm - missingDirection - missingSpeed;
  return {
    samples: samples.length,
    inSector,
    calm,
    missingDirection,
    missingSpeed,
    matrix,
  };
}
