import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cropGrid, fieldToGrid, CN_WINDOW } from "./convert";
import { decodeGrib2 } from "./grib2";

const here = dirname(fileURLToPath(import.meta.url));
const corpus = join(here, "..", "..", "..", "corpus", "grid");
const dataDir = process.env.METWEAVE_DATA_DIR ?? "";

const readFixtureGrib = (): Uint8Array =>
  new Uint8Array(readFileSync(join(corpus, "gfs-0p25-tmp-2m-20261004-f000.grib2")));

describe("GRIB2 5.3 解码（仓内 fixture：GFS tmp 2m 全球场）", () => {
  it("单 message、网格 1440×721、值域与 eccodes 基准一致", () => {
    const fields = decodeGrib2(readFixtureGrib());
    expect(fields.length).toBe(1);
    const f = fields[0]!;
    expect(f.ni).toBe(1440);
    expect(f.nj).toBe(721);
    expect(f.category).toBe(0);
    expect(f.number).toBe(0);
    expect(f.levelType).toBe(103);
    expect(f.levelValue).toBe(2);
    expect(f.referenceTime.year).toBe(2026);
    expect(f.referenceTime.month).toBe(10);
    expect(f.la1).toBeCloseTo(90, 6);
    expect(f.lo1).toBeCloseTo(0, 6);
    expect(f.di).toBeCloseTo(0.25, 9);
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const v of f.values) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    expect(min).toBeCloseTo(210.7745, 2);
    expect(max).toBeCloseTo(314.5745, 2);
  });

  it("消息总长 0（损坏文件）→ 显式 truncated 报错，不死循环", () => {
    // 回归锁：魔数合法但 total=0 时 pos 永不前进，旧实现死循环挂死
    const bad = new Uint8Array(24);
    bad.set([0x47, 0x52, 0x49, 0x42], 0); // "GRIB"；offset 8–15 的 total 已恒 0
    expect(() => decodeGrib2(bad)).toThrowError(/总长为 0/);
  });

  it("负经纬度按符号-幅值解码（WMO Reg 92.1.5——最高位为符号位，非补码）", () => {
    // 回归锁：la1/lo1 曾按补码解，lo1=−10° 的存储原码 0x80989680 被误读为 −2137.48°；
    // 符号-幅值＝最高位置 1 表负＋余 31 位幅值（10e6=0x00989680 → −10e6 → /1e6 = −10）
    const buf = readFixtureGrib().slice();
    // Sec3 内 la1||lo1 原码＝90e6(0x055D4A80)||0(0x00000000)，这 8 字节组合在全场唯一
    const pat = [0x05, 0x5d, 0x4a, 0x80, 0x00, 0x00, 0x00, 0x00];
    let hit = -1;
    for (let i = 0; i + pat.length <= buf.length; i++) {
      if (pat.every((byte, k) => buf[i + k] === byte)) {
        hit = i;
        break;
      }
    }
    expect(hit, "fixture 内未定位到 la1/lo1 原码字节").toBeGreaterThan(0);
    // 改写为负值网格：la1=−90°（0x855D4A80）、lo1=−10°（0x80989680）——负 lat 网格同锁
    buf.set([0x85, 0x5d, 0x4a, 0x80], hit);
    buf.set([0x80, 0x98, 0x96, 0x80], hit + 4);
    const f = decodeGrib2(buf)[0]!;
    expect(f.la1).toBeCloseTo(-90, 6);
    expect(f.lo1).toBeCloseTo(-10, 6);
    // 补码读法的错值显式排除（−2147483648−10000000 的补码解释 /1e6）
    expect(f.lo1).not.toBe((0x80989680 - 0x100000000) / 1e6);
  });

  it("尾部 1–3 字节残渣：已解出 ≥1 场时容忍并经 onWarning 记账；≥4 字节残渣仍报错", () => {
    const base = readFixtureGrib();
    const withJunk3 = new Uint8Array(base.length + 3);
    withJunk3.set(base);
    withJunk3.set([0x01, 0x02, 0x03], base.length);
    const warns: string[] = [];
    const fields = decodeGrib2(withJunk3, { onWarning: (m) => warns.push(m) });
    expect(fields.length).toBe(1); // 场数据完整解出，残渣不炸整包
    expect(warns.length).toBe(1);
    expect(warns[0]).toMatch(/尾部残渣 3 字节/);
    const withJunk4 = new Uint8Array(base.length + 4);
    withJunk4.set(base); // 4 字节零尾巴：放得下魔数位但非 GRIB——截断/拼接损坏不静默吞
    expect(() => decodeGrib2(withJunk4)).toThrowError(/非 GRIB 魔数/);
  });

  it("位流位宽 > 32 → 显式报错（曾静默截位错解）", () => {
    const buf = readFixtureGrib().slice();
    // 走 Sec5 段头定位：refBits 在 Sec5 偏移 19（单字节 0–255，可声明出 >32 的非法宽）
    let q = 16; // Sec0 固定 16B
    let sec5 = -1;
    for (let guard = 0; guard < 16; guard++) {
      const num = buf[q + 4];
      if (num === 5) {
        sec5 = q;
        break;
      }
      q +=
        (buf[q] ?? 0) * 2 ** 24 +
        (buf[q + 1] ?? 0) * 2 ** 16 +
        (buf[q + 2] ?? 0) * 2 ** 8 +
        (buf[q + 3] ?? 0);
    }
    expect(sec5, "fixture 内未定位到 Sec5").toBeGreaterThan(0);
    buf[sec5 + 19] = 33; // refBits=33：参考值数组首个读取即超宽
    expect(() => decodeGrib2(buf)).toThrowError(/位宽 33 超 32 位上限/);
  });

  it("中国域裁剪后与 eccodes 基准逐点相等（208×280 窗）", () => {
    const f = decodeGrib2(readFixtureGrib())[0]!;
    const grid = fieldToGrid(f, { variable: "TMP", level: "2m", unit: "K" });
    const cn = cropGrid(grid, CN_WINDOW);
    expect(cn.header.grid.nx).toBe(280);
    expect(cn.header.grid.ny).toBe(208);
    expect(cn.header.grid.la0).toBeCloseTo(55, 6);
    expect(cn.header.grid.lo0).toBeCloseTo(70, 6);
    const raw = readFileSync(join(corpus, "gfs-tmp-2m-cn.f32"));
    const expected = new Float32Array(raw.byteLength / 4);
    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    for (let i = 0; i < expected.length; i++) expected[i] = dv.getFloat32(i * 4);
    for (let i = 0; i < expected.length; i++) {
      expect(cn.values[i]).toBeCloseTo(expected[i] ?? Number.NaN, 4);
    }
  });
});

/** 数据区全量对账：15 场（14 要素，wind 双 message）逐场 sha256 与 eccodes 基准相等。
 *  本机跑（METWEAVE_DATA_DIR 指向数据区）即「零漂移」验收；CI 无数据区自动跳过。 */
describe.skipIf(!dataDir || !existsSync(join(dataDir, "grid/baseline-expected/meta.json")))(
  "eccodes 基准全量对账（数据区）",
  () => {
    it("15 场 sha256 逐场相等", () => {
      const meta = JSON.parse(
        readFileSync(join(dataDir, "grid/baseline-expected/meta.json"), "utf8"),
      ) as Record<string, { sha256: string }>;
      let count = 0;
      for (const fn of readdirSync(join(dataDir, "grid/baseline"))) {
        if (!fn.endsWith(".grib2")) continue;
        const key0 = fn.split("_")[3] as string;
        const fields = decodeGrib2(readFileSync(join(dataDir, "grid/baseline", fn)));
        fields.forEach((f, mi) => {
          const key = `${key0}#${mi}`;
          const m = meta[key];
          expect(m, `基准缺失 ${key}`).toBeDefined();
          const bytes = new Uint8Array(f.values.length * 4);
          const dv = new DataView(bytes.buffer);
          for (let i = 0; i < f.values.length; i++) dv.setFloat32(i * 4, f.values[i] ?? Number.NaN);
          const sha = createHash("sha256").update(bytes).digest("hex");
          expect(sha, `${key} sha 不匹配`).toBe(m!.sha256);
          count++;
        });
      }
      expect(count).toBe(15);
    });
  },
);
