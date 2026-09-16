// fuzz 套件自身的行为锁（不是解析器测试——解析器契约由 fuzz 的十一项不变量在线断言）：
// 1) 冒烟：小例数跑通零违例（核心 runFuzz 注入 src 解析器，无需先 build）；
// 2) invalid-format 定向生成器可达性：构造「token 可识别但结构坏」的变异必须让
//    invalid-format 告警码在普查中出现（此前两轮 fuzz 零命中——生成器就是为此而建）；
// 3) 确定性：同种子同序列（--seed 复现承诺的机制基础）。
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MetarParseError, toValues } from "../packages/core/src/index";
import { parse } from "../packages/parser/src/index";
import { MUTATORS, mulberry32, mutate, runFuzz } from "./fuzz.mjs";

const corpusDir = fileURLToPath(new URL("../corpus/", import.meta.url));
const pool: string[] = [];
for (const f of readdirSync(corpusDir).filter((x) => x.endsWith(".txt"))) {
  for (const l of readFileSync(`${corpusDir}${f}`, "utf8").split("\n")) {
    const t = l.replace(/\r$/, "").trim();
    if (t !== "" && !/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/.test(t)) pool.push(t);
  }
}

describe("fuzz 套件自身锁", () => {
  it("七类变异器齐备（delete/duplicate/swap/corrupt/fuse/truncate/structured-invalid）", () => {
    expect(MUTATORS).toHaveLength(7);
    expect(MUTATORS).toContain("structured-invalid");
  });

  it("冒烟：3000 例零违例（src 注入；整体失败走 MetarParseError 是合法出路）", () => {
    const result = runFuzz({
      parse,
      toValues,
      MetarParseError,
      pool,
      cases: 3_000,
      seed: 20260912,
    });
    expect(result.timedOut).toBe(false);
    expect(result.parsed).toBeGreaterThan(2_000);
    expect(result.threw).toBeGreaterThan(0);
    expect(result.violations).toBe(0);
  });

  it("invalid-format 定向生成器可达：普查中必须出现（此前两轮 fuzz 零命中的补面）", () => {
    const result = runFuzz({
      parse,
      toValues,
      MetarParseError,
      pool,
      cases: 3_000,
      seed: 20260912,
    });
    expect(result.census.get("invalid-format") ?? 0).toBeGreaterThan(0);
    // 同批 census 里五类告警码至少四类可达（生成器覆盖面的下限锚，不是精确分布锁）
    expect(result.census.size).toBeGreaterThanOrEqual(4);
  });

  it("确定性：同种子两次 runFuzz 普查逐项相同（--seed 复现承诺）", () => {
    const opts = {
      parse,
      toValues,
      MetarParseError,
      pool,
      cases: 1_000,
      seed: 42,
    } as const;
    const a = runFuzz(opts);
    const b = runFuzz(opts);
    expect([...a.census.entries()]).toEqual([...b.census.entries()]);
    expect(a.parsed).toBe(b.parsed);
    expect(a.threw).toBe(b.threw);
    // 变异器单例级：同 rand 序列产出同形态
    const r1 = mulberry32(7);
    const r2 = mulberry32(7);
    const text = "ZGGG 120000Z 27008KT 9999 TSRA BKN030 26/22 Q1009 NOSIG";
    for (let i = 0; i < 50; i += 1) expect(mutate(r1, text)).toEqual(mutate(r2, text));
  });
});
