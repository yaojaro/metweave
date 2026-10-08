import { describe, expect, it } from "vitest";
import { computeStats, parseGrid, serializeGrid, type GridHeader } from "./format";

const header: GridHeader = {
  version: 1,
  variable: "TMP",
  level: "2m",
  unit: "K",
  grid: { nx: 3, ny: 2, la0: 55, lo0: 70, di: 0.25, dj: 0.25, order: "N2S,W2E,row-major" },
  stats: { min: 0, max: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p99: 0 },
  meta: {
    referenceTime: "2026-10-04T06:00Z",
    forecastHour: 0,
    source: "test",
    license: "test",
    generated: "2026-10-06",
  },
};

describe("viz-ready 容器（MWGRID1）", () => {
  it("序列化→解析往返逐点相等，stats 现算覆盖", () => {
    const values = new Float32Array([210.5, 284.25, 300, Number.NaN, 250, 261.75]);
    const blob = serializeGrid(header, values);
    const back = parseGrid(blob);
    expect(back.header.variable).toBe("TMP");
    expect(back.header.grid.nx).toBe(3);
    // NaN 传染保真（缺测语义显式）
    expect(Number.isNaN(back.values[3])).toBe(true);
    for (let i = 0; i < values.length; i++) {
      if (i === 3) continue;
      expect(back.values[i]).toBe(values[i]);
    }
    // 分位数 NaN 排除后现算（5 有效值排序 [210.5,250,261.75,284.25,300]）
    expect(back.header.stats.min).toBeCloseTo(210.5, 6);
    expect(back.header.stats.max).toBeCloseTo(300, 6);
    expect(back.header.stats.p50).toBeCloseTo(261.75, 6);
  });

  it("魔数错误走机读 code", () => {
    expect(() => parseGrid(new Uint8Array(64).fill(0))).toThrowError(/\[invalid-magic\]/);
  });

  it("脏头就地报明确错误（version≠1 / nx·ny 非正整数——不再以 payload-size-mismatch 误导）", () => {
    const values = new Float32Array([210.5, 284.25, 300, Number.NaN, 250, 261.75]);
    const badVersion = serializeGrid({ ...header, version: 2 } as unknown as GridHeader, values);
    expect(() => parseGrid(badVersion)).toThrowError(/\[header-json-invalid\]/);
    expect(() => parseGrid(badVersion)).toThrowError(/version/);
    const badNx = serializeGrid(
      { ...header, grid: { ...header.grid, nx: "3" as unknown as number } },
      values,
    );
    expect(() => parseGrid(badNx)).toThrowError(/\[header-json-invalid\]/);
    expect(() => parseGrid(badNx)).toThrowError(/nx/);
  });

  it("字节布局锁定（规格叙述与实现对齐：7B magic＋4B 头长＠7＋1B 保留＠11 恒 0＋JSON＠12）", () => {
    const values = new Float32Array([210.5, 284.25, 300, Number.NaN, 250, 261.75]);
    const blob = serializeGrid(header, values);
    // magic 7 字节（"MWGRID1"——非 8B：v1 冻结布局的既有叙述笔误曾作 8B，本测试锁死实态）
    expect(String.fromCharCode(...blob.subarray(0, 7))).toBe("MWGRID1");
    const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
    const hlen = view.getUint32(7); // 头长 u32 big-endian 落偏移 7
    expect(blob[11]).toBe(0); // 偏移 11 为 1B 保留间隙（写侧恒 0、读侧跳过）
    const json: unknown = JSON.parse(new TextDecoder().decode(blob.subarray(12, 12 + hlen)));
    expect((json as { variable?: string }).variable).toBe("TMP"); // 头 JSON 起于偏移 12
    expect(blob.length).toBe(12 + hlen + values.length * 4); // payload 紧随 JSON、无尾隙
  });

  it("payload 尺寸不符走机读 code", () => {
    const values = new Float32Array([1, 2, 3, 4, 5, 6]);
    const blob = serializeGrid(header, values);
    expect(() => parseGrid(blob.subarray(0, blob.length - 4))).toThrowError(
      /\[payload-size-mismatch\]/,
    );
  });

  it("computeStats 全 NaN 场不抛（分布头仍可产出）", () => {
    const s = computeStats([Number.NaN, Number.NaN]);
    expect(Number.isNaN(s.p50)).toBe(true);
  });
});
