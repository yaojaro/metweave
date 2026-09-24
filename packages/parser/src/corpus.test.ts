// 语料回放冒烟锁：仓内全球静态样本（corpus/）逐条过解析器，分布必须与快照完全一致。
// 这是防「形态盲区」复发的机制——任何让新 unknown 形态静默出现的改动都会被本测试拦下；
// 有意的分布变更须重生成快照（node scripts/replay-corpus.mjs corpus/*.txt --json corpus/snapshot.json）
// 并在 commit message 说明。样本来源与抽样算法见 corpus/README.md。
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MetarParseError } from "@metweave/core";
import { parse } from "./index";

const corpusDir = fileURLToPath(new URL("../../../corpus/", import.meta.url));

/** 形态归并：数字串折叠为等长 #（I1001 → I####、QFE749/750 → QFE###）——
 *  与 scripts/replay-corpus.mjs 的 shapeOf 保持同构（漂移会表现为快照不匹配，测试即红） */
const shapeOf = (token: string): string => token.replace(/\d+/g, (d) => "#".repeat(d.length));

/** 失败归类：按 MetarParseError.code 机读码归类（不匹配中文 message——错误面已机读化）；
 *  可解释类 = 站名/时组缺失（整体失败契约），其余 = 意外异常 */
const classifyFailure = (err: unknown): "站名" | "时组" | "其他" => {
  if (err instanceof MetarParseError) {
    if (err.code === "missing-station") return "站名";
    if (err.code === "missing-time" || err.code === "invalid-time") return "时组";
  }
  return "其他";
};

interface Snapshot {
  files: Record<string, { lines: number }>;
  total: { lines: number; unique: number };
  failures: { total: number; classes: Record<string, number> };
  unknownShapes: Record<string, { count: number; samples: string[] }>;
  warningCodes: Record<string, number>;
  rmkHealth: { trendRawsWithRMK: number; remarksNonEmpty: number };
}

const readCorpusFile = (file: string): string[] =>
  readFileSync(`${corpusDir}${file}`, "utf8")
    .split("\n")
    .map((l) => l.replace(/\r$/, "").trim())
    .filter((l) => l !== "" && !/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/.test(l));

describe("全球语料回放冒烟锁（corpus/ × snapshot.json）", () => {
  const snapshot: Snapshot = JSON.parse(
    readFileSync(`${corpusDir}snapshot.json`, "utf8"),
  ) as Snapshot;
  // 顺序无关（断言逐文件比对）；目录里所有 .txt 都必须参与回放
  const corpusFiles = readdirSync(corpusDir).filter((f) => f.endsWith(".txt"));

  // 与快照相同的统计口径（回放器同构复刻；快照由回放器生成，两者漂移会被下方断言暴露）
  const unknownShapes: Record<string, number> = {};
  const warningCodes: Record<string, number> = {};
  const failureClasses: Record<string, number> = {};
  let failures = 0;
  let unique = 0;
  let remarksNonEmpty = 0;
  let trendRawsWithRMK = 0;
  const seen = new Set<string>();
  const lineCounts: Record<string, number> = {};
  const unexpectedFailures: string[] = [];

  for (const file of corpusFiles) {
    const rows = readCorpusFile(file);
    lineCounts[file] = rows.length;
    for (const raw of rows) {
      if (seen.has(raw)) continue;
      seen.add(raw);
      unique += 1;
      let report;
      try {
        report = parse(raw);
      } catch (err) {
        const cls = classifyFailure(err);
        const message = err instanceof Error ? err.message : String(err);
        failures += 1;
        failureClasses[cls] = (failureClasses[cls] ?? 0) + 1;
        if (cls === "其他" && unexpectedFailures.length < 5)
          unexpectedFailures.push(`${raw}  ⟵  ${message}`);
        continue;
      }
      if (report.remarks.length > 0) remarksNonEmpty += 1;
      if (report.trends.some((t) => t.raw.includes("RMK"))) trendRawsWithRMK += 1;
      for (const w of report.warnings) {
        warningCodes[w.code] = (warningCodes[w.code] ?? 0) + 1;
        if (w.code === "unknown-token") {
          const shape = shapeOf(raw.slice(w.span!.start, w.span!.end));
          unknownShapes[shape] = (unknownShapes[shape] ?? 0) + 1;
        }
      }
    }
  }

  it("语料文件齐备且行数与快照一致（样本不被静默改动）", () => {
    expect(Object.keys(lineCounts).length, "corpus/*.txt 数量与快照不符").toBe(
      Object.keys(snapshot.files).length,
    );
    for (const [file, meta] of Object.entries(snapshot.files)) {
      // 快照键形如 corpus/<name>.txt（由回放器 CLI 路径决定），测试按同名比对
      expect(lineCounts[file.replace(/^corpus\//, "")], `${file} 行数与快照不符`).toBe(meta.lines);
    }
  });

  it("零意外异常：整体失败仅限可解释类（站名/时组）且总数不超快照", () => {
    expect(unexpectedFailures, `意外异常样例：${unexpectedFailures.join("；")}`).toHaveLength(0);
    expect(failures).toBeLessThanOrEqual(snapshot.failures.total);
    for (const cls of Object.keys(failureClasses)) {
      expect(["站名", "时组"], `失败类别 ${cls} 不属可解释类`).toContain(cls);
    }
  });

  it("unknown 形态分布与快照完全一致（新增形态或频次漂移 = 红，须显式处理或更新快照）", () => {
    expect(unknownShapes).toEqual(
      Object.fromEntries(Object.entries(snapshot.unknownShapes).map(([k, v]) => [k, v.count])),
    );
  });

  it("告警码分布与快照一致（分布变化须随快照说明）", () => {
    expect(warningCodes).toEqual(snapshot.warningCodes);
  });

  it("RMK 健康锁：趋势段吞 RMK 签名恒为 0（第二轮复评根因修复的全语料级回归锁）", () => {
    expect(trendRawsWithRMK).toBe(0);
    expect(remarksNonEmpty).toBe(snapshot.rmkHealth.remarksNonEmpty);
  });

  it("unknown 形态任务板（docs/unknown-shapes.md）与快照形态键完全一致——数字与清单不手写，生成脚本是唯一写入口", () => {
    const doc = readFileSync(
      fileURLToPath(new URL("../../../docs/unknown-shapes.md", import.meta.url)),
      "utf8",
    );
    // 表格首列 = 形态键（oxfmt 会做列宽对齐填充，正则不锚定尾随空白）；
    // 只取 METAR 节（v0.2 补齐批起文末另有 TAF 语料节——形态来自 corpus/taf 活算，
    // 由 taf-corpus.test.ts 锁定，不在本快照比对范围）
    const metarSection = doc.split("## TAF 语料")[0] ?? doc;
    const docShapes = [...metarSection.matchAll(/^\| `([^`]+)`/gm)].map((m) => m[1] ?? "");
    expect(docShapes.length, "任务板应为非空（快照存在 unknown 形态）").toBeGreaterThan(0);
    expect(new Set(docShapes).size, "任务板形态不得重复").toBe(docShapes.length);
    const snapshotShapes = Object.keys(snapshot.unknownShapes);
    expect(docShapes.length, "任务板与快照形态数一致").toBe(snapshotShapes.length);
    expect(new Set(docShapes), "任务板与快照形态键集一致（防手改/漏生成）").toEqual(
      new Set(snapshotShapes),
    );
  });
});
