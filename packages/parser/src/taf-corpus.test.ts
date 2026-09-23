import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tryParseTaf } from "./taf";

// TAF 语料回放锁（v0.2 批 4.1）——语料 corpus/taf/ogimet-sample.txt：ogimet 16 年回填分层抽样
// （13 个月度文件 × 24 条，种子 20260923，2026-09-23 生成），METAR 语料锁（corpus.test.ts）
// 只扫 corpus/*.txt 非递归，TAF 语料独立子目录互不干扰。分布有意变更须同步本锁数字。
const lines = readFileSync(
  new URL("../../../corpus/taf/ogimet-sample.txt", import.meta.url),
  "utf8",
)
  .split("\n")
  .filter(Boolean);

const stats = (() => {
  let ok = 0;
  const errs: Record<string, number> = {};
  const warns: Record<string, number> = {};
  let unknownTexts = "";
  for (const l of lines) {
    const r = tryParseTaf(l);
    if (!r.ok) {
      errs[r.error.code] = (errs[r.error.code] ?? 0) + 1;
      continue;
    }
    ok++;
    for (const w of r.report.warnings) {
      warns[w.code] = (warns[w.code] ?? 0) + 1;
      if (w.code === "unknown-token") unknownTexts += w.message;
    }
  }
  return { ok, errs, warns, unknownTexts };
})();

describe("TAF 语料回放锁（corpus/taf × 清单验收：无 unknown-token 风暴）", () => {
  it("抽样规模在册（312 行，ogimet 分层 13 月 × 24）", () => {
    expect(lines.length).toBe(312);
  });

  it("全量解析成功（312/312——含三条方言收编：无斜杠有效期/TX-TN 无日短形态/BECMG 短窗）", () => {
    expect(stats.ok).toBe(312);
    expect(stats.errs).toEqual({});
  });

  it("unknown-token 不风暴：全部语料仅 1 枚（BCEMG 传输错拼，出声不丢为正确行为）", () => {
    expect(stats.warns["unknown-token"] ?? 0).toBe(1);
    expect(stats.unknownTexts).toContain("BCEMG");
  });

  it("告警分布锁：C5 中国扩展层标记为主量（BR/HZ/-SN 等真实高频）、duplicate-group 少量、无越界告警", () => {
    expect((stats.warns["invalid-format"] ?? 0) > 150).toBe(true);
    expect(stats.warns["duplicate-group"] ?? 0).toBeLessThanOrEqual(5);
    expect(stats.warns["value-out-of-range"] ?? 0).toBe(0);
    expect(stats.warns["missing-expected"] ?? 0).toBe(0);
  });
});
