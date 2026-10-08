/**
 * @metweave/grid — GRIB2 解码（complex packing 5.2/5.3，含二阶空间差分）。
 *
 * 算法蓝本：wgrib2 src/unpk_complex.c（Wesley Ebisuzaki，public domain），基线 14 要素
 * 语料逐点对账通过（eccodes 2.49 权威值，docs/10 十五节）。两个 NCEP 私有细节为实测
 * 锁定、纸面规范未载：
 *   1. Sec7 位流三个组数组（参考/组宽/组长）之间各自**字节对齐**（非连续位流）；
 *   2. 空间差分最小值描述符按**符号-幅度**编码（最高位为符号位），非补码。
 * 支持面：DRT 5.2/5.3、spd 0/1/2、E/D 双缩放（Y=(R+X·2^E)×10^-D）；位图与缺测替代
 * 管理显式报错不静默（基线语料未覆盖，遇之走 GridError 通道补充样本）。
 */
import { GridError } from "./errors";

/** GRIB2 message 解出的一个标量场（viz-ready 转换的输入）。 */
export interface GribField {
  /** WMO 参数（discipline/category/number）——要素档案的匹配键。 */
  discipline: number;
  category: number;
  number: number;
  /** 层（typeOfFixedSurface 的 GRIB2 码值 + 标定值，如 ltype=100/lval=50000 → 500hPa）。 */
  levelType: number;
  levelValue: number;
  referenceTime: { year: number; month: number; day: number; hour: number; minute: number };
  forecastTime: number;
  ni: number;
  nj: number;
  la1: number;
  lo1: number;
  di: number;
  dj: number;
  /** 物理值（GRIB 原量纲；N2S/W2E/row-major 与 viz-ready 同向）。 */
  values: Float32Array;
}

/** 位读取器：三数组间的字节对齐由调用方换新实例完成（对齐语义见文件头）。 */
class BitReader {
  private buf = 0;
  private cnt = 0;
  constructor(
    private readonly bytes: Uint8Array,
    private pos: number,
  ) {}
  read(n: number): number {
    // 位宽上限 32：buf 经 ToInt32 累积（(buf << 8) | byte）本就只持 32 位，>32 的宽读
    // 会静默丢高位错解（掩码对 n>32 恒全 1）——超限属损坏/不支持布局，显式报错不静默
    if (n > 32) throw new GridError("unsupported-drt", `位流读取位宽 ${n} 超 32 位上限`);
    while (this.cnt < n) {
      const byte = this.bytes[this.pos];
      if (byte === undefined) throw new GridError("truncated", `位流越界（pos=${this.pos}）`);
      this.buf = (this.buf << 8) | byte;
      this.pos++;
      this.cnt += 8;
    }
    this.cnt -= n;
    // n=32 时 (1<<n) 经 JS 位移取模归 1（掩码变 0、32 位组值恒读 0）——32 位位宽须全 1 掩码
    const mask = n >= 32 ? 0xffffffff : (1 << n) - 1;
    const v = (this.buf >>> this.cnt) & mask;
    // 位缓冲回收：保留 cnt 位以内有效位，防止长序列下 buf 无界增长
    this.buf &= (1 << this.cnt) - 1;
    return v;
  }
}

/** 带越界守卫的单字节读取（GRIB 头字段；截断文件走机读错误而非 undefined 传染）。 */
const byteAt = (b: Uint8Array, i: number): number => {
  const v = b[i];
  if (v === undefined) throw new GridError("truncated", `GRIB2 字节越界（offset=${i}）`);
  return v;
};
/** 有符号 32 位解释（经纬度定标值用）——WMO Manual on Codes Reg 92.1.5：负值＝最高位置 1
 *  ＋ 31 位幅值（符号-幅值编码，非补码；南界/西界网格实测锁定，与 Sec7 差分最小值的
 *  signMagnitude 同族不同宽）。 */
const signedLatLon32 = (raw: number): number => {
  const mag = raw & 0x7fffffff;
  return (raw >>> 31) & 1 ? -mag : mag;
};
/** 带越界守卫的组数组读取（Int32Array 索引在 noUncheckedIndexedAccess 下的安全通道）。 */
const gAt = (arr: Int32Array, j: number): number => {
  const v = arr[j];
  if (v === undefined) throw new GridError("truncated", `组数组越界（j=${j}）`);
  return v;
};
/** 位对齐换算：位数 → 字节数（三组数组间字节对齐用）。 */
const align = (bits: number): number => Math.ceil(bits / 8);
const beUint = (b: Uint8Array, o: number, n: number): number => {
  let v = 0;
  for (let i = 0; i < n; i++) {
    const byte = b[o + i];
    if (byte === undefined) throw new GridError("truncated", "GRIB2 section 越界");
    v = v * 256 + byte;
  }
  return v;
};
const beInt16 = (b: Uint8Array, o: number): number => {
  const v = beUint(b, o, 2);
  return v >= 0x8000 ? v - 0x10000 : v;
};
const beFloat32 = (b: Uint8Array, o: number): number =>
  new DataView(b.buffer, b.byteOffset + o, 4).getFloat32(0);
/** 符号-幅度编码（NCEP spd 最小值描述符实测口径，见文件头注）。 */
const signMagnitude = (raw: number, bytes: number): number => {
  const bits = bytes * 8;
  const mag = raw & ((1 << (bits - 1)) - 1);
  return (raw >>> (bits - 1)) & 1 ? -mag : mag;
};

interface Message {
  secs: Map<number, Uint8Array>;
}

const parseMessage = (b: Uint8Array, pos: number): Message => {
  const secs = new Map<number, Uint8Array>();
  let q = pos + 16; // Sec0 固定 16B
  for (let guard = 0; guard < 16; guard++) {
    if (String.fromCharCode(...b.subarray(q, q + 4)) === "7777") return { secs };
    const len = beUint(b, q, 4);
    const num = b[q + 4];
    if (num === undefined || len < 5) throw new GridError("truncated", "section 头损坏");
    secs.set(num, b.subarray(q, q + len));
    q += len;
  }
  throw new GridError("truncated", "section 数超界（未遇 Sec8）");
};

const decodeComplex = (s5: Uint8Array, s7: Uint8Array, npts: number): Float32Array => {
  const drt = beUint(s5, 9, 2);
  if (drt !== 2 && drt !== 3) {
    throw new GridError("unsupported-drt", `数据表示模板 5.${drt} 不在支持集（5.2/5.3）`);
  }
  const missMgmt = byteAt(s5, 22);
  if (missMgmt !== 0) {
    throw new GridError(
      "unsupported-missing-mgmt",
      `缺测替代管理 missMgmt=${missMgmt} 未支持（基线语料未覆盖）`,
    );
  }
  const R = beFloat32(s5, 11);
  const E = beInt16(s5, 15);
  const D = beInt16(s5, 17);
  const refBits = byteAt(s5, 19);
  const NG = beUint(s5, 31, 4);
  const gwRef = byteAt(s5, 35);
  const gwBits = byteAt(s5, 36);
  const glRef = beUint(s5, 37, 4);
  const glIncr = byteAt(s5, 41);
  const glLast = beUint(s5, 42, 4);
  const glBits = byteAt(s5, 46);
  const spd = drt === 3 ? byteAt(s5, 47) : 0;
  const extraOct = drt === 3 ? byteAt(s5, 48) : 0;
  if (spd !== 0 && spd !== 1 && spd !== 2) {
    throw new GridError("unsupported-drt", `空间差分阶数 ${spd} 越界（合法 0/1/2）`);
  }

  // Sec7：5B 头（长度 4 + section number 1）→ 描述符区（spd n 阶 = n+1 个，g1..gn 无符号 + min 符号-幅度）
  const ndesc = spd > 0 ? spd + 1 : 0;
  const d0 = 5 + ndesc * extraOct;
  let g1 = 0,
    g2 = 0,
    hmin = 0;
  if (spd === 1) {
    g1 = beUint(s7, 5, extraOct);
    hmin = signMagnitude(beUint(s7, 5 + extraOct, extraOct), extraOct);
  } else if (spd === 2) {
    g1 = beUint(s7, 5, extraOct);
    g2 = beUint(s7, 5 + extraOct, extraOct);
    hmin = signMagnitude(beUint(s7, 5 + 2 * extraOct, extraOct), extraOct);
  }

  // 三组数组各自字节对齐（NCEP 私有细节之一）
  const o1 = d0 + align(refBits * NG);
  const o2 = o1 + align(gwBits * NG);
  const o3 = o2 + align(glBits * NG);

  let br = new BitReader(s7, d0);
  const refs = new Int32Array(NG);
  for (let j = 0; j < NG; j++) refs[j] = br.read(refBits);
  br = new BitReader(s7, o1);
  const widths = new Int32Array(NG);
  for (let j = 0; j < NG; j++) widths[j] = br.read(gwBits) + gwRef;
  br = new BitReader(s7, o2);
  const lengths = new Int32Array(NG);
  let total = 0;
  for (let j = 0; j < NG; j++) {
    lengths[j] = j === NG - 1 ? glLast : br.read(glBits) * glIncr + glRef;
    total += gAt(lengths, j);
  }
  if (total !== npts) {
    throw new GridError("group-sum-mismatch", `组长和 ${total} ≠ 网格点数 ${npts}`);
  }

  br = new BitReader(s7, o3);
  const f = new Int32Array(npts);
  let w = 0;
  for (let j = 0; j < NG; j++) {
    const width = gAt(widths, j);
    const ref = gAt(refs, j);
    const len = gAt(lengths, j);
    if (width === 0) {
      for (let k = 0; k < len; k++) f[w + k] = ref;
    } else {
      for (let k = 0; k < len; k++) f[w + k] = ref + br.read(width);
    }
    w += len;
  }

  // 空间差分还原（wgrib2 口径：order2 递推 f_i = h_i + 2f_{i-1} − f_{i-2}）
  const f2 = 2 ** E;
  const f10 = 10 ** -D;
  const out = new Float32Array(npts);
  const at = (i: number): number => {
    const v = f[i];
    if (v === undefined) throw new GridError("truncated", `差分域越界（i=${i}）`);
    return v;
  };
  if (spd === 0) {
    for (let i = 0; i < npts; i++) out[i] = (R + at(i) * f2) * f10;
  } else if (spd === 1) {
    let last = g1;
    out[0] = (R + g1 * f2) * f10;
    for (let i = 1; i < npts; i++) {
      last += at(i) + hmin;
      out[i] = (R + last * f2) * f10;
    }
  } else {
    let last = g2;
    let pen = g1;
    out[0] = (R + g1 * f2) * f10;
    out[1] = (R + g2 * f2) * f10;
    for (let i = 2; i < npts; i++) {
      const cur = at(i) + hmin + last + last - pen;
      pen = last;
      last = cur;
      out[i] = (R + cur * f2) * f10;
    }
  }
  return out;
};

/** decodeGrib2 的选项（纯加法）：onWarning＝非致命异常（如尾部残渣）的告警出口——
 *  grid 包无报文级 warnings 通道，CLI/上层经此回调记账，缺省静默（行为面不变）。 */
export interface DecodeGrib2Options {
  onWarning?: (message: string) => void;
}

/** 解析 GRIB2 buffer 的全部 message（多 message=多场，如 UGRD+VGRD 双分量）。
 *  尾部 1–3 字节残渣（消息长度字节对齐粒度所致、已解出 ≥1 场）容忍跳过并经 onWarning
 *  记一笔；残渣 ≥4 字节仍按魔数缺失报错（截断/拼接损坏不静默吞）。 */
export function decodeGrib2(
  buffer: ArrayBuffer | Uint8Array,
  options: DecodeGrib2Options = {},
): GribField[] {
  const b = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (b.length === 0) throw new GridError("empty-input", "GRIB2 输入为空");
  const fields: GribField[] = [];
  let pos = 0;
  while (pos < b.length) {
    if (b.length - pos < 4 || String.fromCharCode(...b.subarray(pos, pos + 4)) !== "GRIB") {
      // 已解出 ≥1 场且残渣不足 4 字节（放不下魔数）＝消息边界对齐残渣而非损坏：容忍跳过
      if (fields.length > 0 && b.length - pos < 4) {
        options.onWarning?.(
          `GRIB2 尾部残渣 ${b.length - pos} 字节（已解出 ${fields.length} 场，跳过）`,
        );
        break;
      }
      throw new GridError(
        "empty-input",
        fields.length > 0
          ? `偏移 ${pos} 处非 GRIB 魔数（已解出 ${fields.length} 场后遇损坏尾巴）`
          : `偏移 ${pos} 处无 GRIB 魔数`,
      );
    }
    const discipline = byteAt(b, pos + 6);
    const total = beUint(b, pos + 8, 8);
    // 消息总长 0（损坏/恶意文件）会让 pos += total 永不前进——显式报错而非死循环
    if (total === 0) {
      throw new GridError("truncated", `偏移 ${pos} 处消息总长为 0（文件损坏）——无法前进`);
    }
    const { secs } = parseMessage(b, pos);
    const s1 = secs.get(1);
    const s3 = secs.get(3);
    const s4 = secs.get(4);
    const s5 = secs.get(5);
    const s6 = secs.get(6);
    const s7 = secs.get(7);
    if (!s1 || !s3 || !s4 || !s5 || !s7)
      throw new GridError("truncated", "缺必需 section（1/3/4/5/7）");
    if (s6 && s6[5] !== undefined && s6[5] !== 255) {
      throw new GridError(
        "unsupported-bitmap",
        `位图指示 ${s6[5]} 未支持（基线语料为 255 无位图）`,
      );
    }
    const npts = beUint(s3, 6, 4);
    const values = decodeComplex(s5, s7, npts);
    const la1Raw = beUint(s3, 46, 4);
    const lo1Raw = beUint(s3, 50, 4);
    const diRaw = beUint(s3, 63, 4);
    const djRaw = beUint(s3, 67, 4);
    const scale = 1e6; // basicAngle=0/missing 的 GFS 定标（基线语料实证）
    fields.push({
      discipline,
      category: byteAt(s4, 9),
      number: byteAt(s4, 10),
      levelType: byteAt(s4, 22),
      levelValue: beUint(s4, 24, 4),
      referenceTime: {
        year: beUint(s1, 12, 2),
        month: byteAt(s1, 14),
        day: byteAt(s1, 15),
        hour: byteAt(s1, 16),
        minute: byteAt(s1, 17),
      },
      forecastTime: beUint(s4, 18, 4),
      ni: beUint(s3, 30, 4),
      nj: beUint(s3, 34, 4),
      la1: signedLatLon32(la1Raw) / scale,
      lo1: signedLatLon32(lo1Raw) / scale,
      di: diRaw / scale,
      dj: djRaw / scale,
      values,
    });
    pos += total;
  }
  return fields;
}
