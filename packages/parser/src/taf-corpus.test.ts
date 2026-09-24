import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTaf, tryParseTaf } from "./taf";
import { MetarParseError as _MPE } from "@metweave/core";

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

// fuzz 冒烟锁（批 4.2）：内联最小变异器（与 scripts/fuzz.mjs 同族三招），完整七类变异与
// 十一项不变量归 CLI（pnpm fuzz，TAF 池已接线）——本锁只守「永不崩/双跑确定/契约字段/strict 恒报错」
const smokeRand = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

describe("TAF fuzz 冒烟锁（内联变异回放，2000 例）", () => {
  it("零违例（永不崩/双跑确定/契约字段在位/strict 错误面恒为 strict-violation）", () => {
    const rand = smokeRand(20260923);
    let violations = 0;
    let ok = 0;
    let threw = 0;
    for (let n = 0; n < 2000; n++) {
      const base = lines[Math.floor(rand() * lines.length)] ?? lines[0] ?? "";
      const toks = base.split(" ");
      const op = Math.floor(rand() * 3);
      if (op === 0) toks.splice(Math.floor(rand() * toks.length), 1);
      else if (op === 1)
        toks[Math.floor(rand() * toks.length)] =
          toks[Math.floor(rand() * toks.length)]?.replace(/[03-9]/, "O") ?? "///";
      else toks.push(toks[Math.floor(rand() * toks.length)] ?? "9999");
      const text = toks.join(" ");
      const r = tryParseTaf(text);
      if (!r.ok) {
        threw++;
        continue;
      }
      ok++;
      if (JSON.stringify(parseTaf(text)) !== JSON.stringify(r.report)) violations++;
      if (r.report.raw !== text) violations++;
      if (r.report.changes === undefined || r.report.temperatures === undefined) violations++;
      if (r.report.nil === true && r.report.validity !== undefined) violations++;
      // strict 新契约（v0.2 补齐批）：干净报文通过、违例整体拒绝且错误面恒为 strict-violation
      try {
        parseTaf(text, { mode: "strict" });
      } catch (e) {
        if (!(e instanceof _MPE) || e.code !== "strict-violation") violations++;
      }
    }
    expect(violations).toBe(0);
    expect(ok + threw).toBe(2000);
  });
});
