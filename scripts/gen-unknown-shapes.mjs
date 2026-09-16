#!/usr/bin/env node
// 从 corpus/snapshot.json 生成 docs/unknown-shapes.md —— 未识别形态任务板（贡献者的任务池入口）。
// 纪律：文档的形态清单与频次不手写——全部由快照生成，本脚本是唯一写入口；
// packages/parser/src/corpus.test.ts 锁文档与快照的形态键一致（漂移即红，防手改）。
// 难度提示为人工标注的内置映射表（初稿，未标注的标「待评估」）——
// 快照出现新形态时重跑本脚本即可带上「待评估」行，再由维护者补注。
// 用法：node scripts/gen-unknown-shapes.mjs   （快照更新后重跑；package.json: pnpm gen:unknown）
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const snapshotPath = join(root, "corpus/snapshot.json");
const outPath = join(root, "docs/unknown-shapes.md");

/** 难度展示值（中文单源政策下看板不出现英文散文；键保持脚本内部稳定值）。 */
const DIFFICULTY_ZH = { easy: "易", medium: "中", "to be assessed": "待评估" };

/** 人工标注的难度提示映射（初稿；键 = 形态。未列出的形态标「待评估」）。 */
const HINTS = {
  "##/": {
    difficulty: "to be assessed",
    note: "`05/` 一类碎片——疑似跑道状态/RVR token 被拆断；建模前先核对语料原文行。",
  },
  M: {
    difficulty: "easy",
    note: "紧随温度组的孤立 `M`（加拿大自动站）；疑似露点缺测标记——见加拿大 MANOBS。",
  },
  "RE//": {
    difficulty: "easy",
    note: "近期天气缺测形态 `RE//`（WMO 4678）；考虑为 recentWeather 增设缺测变体。",
  },
  "Q////": {
    difficulty: "easy",
    note: "QNH 全斜杠缺测形态；考虑高度计缺测态 + 告警（与脏 QNH 同一纪律）。",
  },
  "W///S#": {
    difficulty: "medium",
    note: "北欧跑道冬季状态码（W 组家族）；建模前需核对国家附编出处。",
  },
  "W///H#": {
    difficulty: "medium",
    note: "北欧跑道冬季状态码（W 组家族）；建模前需核对国家附编出处。",
  },
  "W##/H##": {
    difficulty: "medium",
    note: "北欧跑道冬季状态码（W 组家族）；建模前需核对国家附编出处。",
  },
  "W##/H#": {
    difficulty: "medium",
    note: "北欧跑道冬季状态码（W 组家族）；建模前需核对国家附编出处。",
  },
  "W##/S#": {
    difficulty: "medium",
    note: "北欧跑道冬季状态码（W 组家族）；建模前需核对国家附编出处。",
  },
  GRN: {
    difficulty: "easy",
    note: "英国机场颜色状态（BLU/GRN/WHT 家族）；见英国气象局机场颜色状态电码。",
  },
  BLU: {
    difficulty: "easy",
    note: "英国机场颜色状态（BLU/GRN/WHT 家族）；见英国气象局机场颜色状态电码。",
  },
  "BLU+": {
    difficulty: "easy",
    note: "英国机场颜色状态的加强形态；与 BLU 同族。",
  },
  "R///////": {
    difficulty: "to be assessed",
    note: "全域七斜杠 R 形态（无跑道编号）；跑道限定的 R##/////（RVR 缺测）与 R##///////（跑道状态全缺）已建模——此残留无规范出处，留板待议。",
  },
  "##KM": {
    difficulty: "to be assessed",
    note: "带 KM 后缀的能见度（`20KM`）；增补单位形态前先核实发报国。",
  },
  AUTO: {
    difficulty: "to be assessed",
    note: "`AUTO` 在靠后位置再现；决定忽略还是标注。",
  },
  "#####": {
    difficulty: "to be assessed",
    note: "五零组 `00000`；疑似与风相关——查语料原文行。",
  },
  "///": {
    difficulty: "to be assessed",
    note: "正文三斜杠 token；结合上下文判断是天气还是风的缺测变体。",
  },
  "-VCTSRA": {
    difficulty: "medium",
    note: "强度符号与 VC 邻近组合（非标准排序）；决定按 invalid-format 还是 unknown 处理。",
  },
  "####W": {
    difficulty: "to be assessed",
    note: "`1000W`——建模前先核实语义（浪高？风？）。",
  },
  "Q####=?TD": {
    difficulty: "easy",
    note: "传输杂质（`Q1017=?TD`）；决定：剥除杂质后缀还是保持 unknown。",
  },
  "######Z": {
    difficulty: "easy",
    note: "重复时组（转报残留）；考虑 duplicate-group 告警。",
  },
  CB: {
    difficulty: "easy",
    note: "孤立 CB token（美国 RMK `CB DSNT` 家族场景）。",
  },
  S: {
    difficulty: "to be assessed",
    note: "孤立 `S`；查语料原文行看上下文。",
  },
};

const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
const shapes = Object.entries(snapshot.unknownShapes).toSorted(
  (a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]),
);

const rows = shapes
  .map(([shape, entry]) => {
    const hint = HINTS[shape] ?? {
      difficulty: "to be assessed",
      note: "尚未评估——先看样本与语料原文行。",
    };
    const difficulty = DIFFICULTY_ZH[hint.difficulty] ?? hint.difficulty;
    const samples = entry.samples.map((s) => "`" + s + "`").join(", ");
    return `| \`${shape}\` | ${entry.count} | ${samples} | ${difficulty} | ${hint.note} |`;
  })
  .join("\n");

const doc = `# 未知形态看板

本看板由 \`pnpm gen:unknown\`（\`scripts/gen-unknown-shapes.mjs\`）从 \`corpus/snapshot.json\` 生成——
勿手改形态清单与计数：\`packages/parser/src/corpus.test.ts\` 把它们锁定到快照，看板是构建产物的输出面。

每行是解析器当前保持 \`unknown-token\` 告警的一个 token「形态」（原样保留、绝不丢弃）。
外部代码贡献暂停期间本看板保留现状；重开贡献后，这里是首批 issue 的任务池。

难度标签与提示为维护者草案注记（未评估的形态标「待评估」）；计数来自当前语料快照。

| 形态 | 计数 | 样本 | 难度（草案） | 提示 |
| --- | --- | --- | --- | --- |
${rows}
`;

writeFileSync(outPath, doc + "\n");

// 产物自动过 oxfmt（表格列宽对齐由 oxfmt 统一）：消灭「生成后还需手动 pnpm format」两步操作。
// 直接调仓内 node_modules/.bin/oxfmt（pnpm run 会注入 PATH，直跑 node 也稳）；幂等——
// 连跑两遍产物零差异（oxfmt 对已格式化文件是恒等变换）。格式化失败不阻断（保留未格式化产物并提示）。
const oxfmtBin = join(root, "node_modules", ".bin", "oxfmt");
const fmt = spawnSync(oxfmtBin, ["--write", outPath], { stdio: "ignore" });
if (fmt.error !== undefined || fmt.status !== 0) {
  console.log(
    `docs/unknown-shapes.md 已生成：${shapes.length} 种形态（来源 ${snapshotPath}）——` +
      `oxfmt 自动格式化未成功（${fmt.error?.message ?? `exit ${fmt.status}`}` +
      "），请手动执行 pnpm format",
  );
} else {
  console.log(
    `docs/unknown-shapes.md 已生成并经 oxfmt 格式化：${shapes.length} 种形态（来源 ${snapshotPath}，幂等可重复执行）`,
  );
}
