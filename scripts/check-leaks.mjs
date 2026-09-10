// 信息泄露检查（公开面前置门禁）——机制公开，模式私有：
//   真实敏感词清单（身份、凭证邮箱、内部黑话）不进仓库，路径通过环境变量
//   METWEAVE_LEAK_PATTERNS 提供（私有工作区持有清单文件，仓库零路径泄漏）。
//   强制策略：--staged（pre-commit）未设置或加载失败该变量即报错退出，不降级弱模式；
//   --all（CI / 全仓）未设置时降级内置通用模式并告警。
//   用法：node scripts/check-leaks.mjs [--staged|--all]，默认 --staged。
//   行级豁免：在该行加 leak-ignore 并附理由。
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const mode = process.argv[2] ?? "--staged";
const envPath = process.env.METWEAVE_LEAK_PATTERNS;
const gitArgs = mode === "--all" ? "ls-files" : "diff --cached --name-only --diff-filter=ACMR";
const files = execSync(`git ${gitArgs}`, { encoding: "utf8" }).split("\n").filter(Boolean);

// 内置通用模式（公开安全）：占位内部标记 + 疑似硬编码密钥兜底
const GENERIC_PATTERNS = [
  ["内部标记", /INTERNAL[ -]ONLY|DO[ -]NOT[ -](COMMIT|PUBLISH)/],
  ["疑似硬编码密钥", /(?:api[_-]?key|secret|token)\s*[:=]\s*["'][A-Za-z0-9/_-]{20,}["']/i],
];

async function loadPatterns() {
  if (!envPath) return { patterns: null, source: "内置通用模式", failed: false };
  try {
    const mod = await import(pathToFileURL(envPath).href);
    return { patterns: mod.default, source: "私有模式清单", failed: false };
  } catch {
    return { patterns: null, source: "内置通用模式", failed: true };
  }
}

const { patterns, source, failed } = await loadPatterns();

if (mode === "--staged" && (!envPath || failed)) {
  console.error(
    !envPath
      ? "check:leaks: 未设置 METWEAVE_LEAK_PATTERNS，拒绝以弱模式提交。"
      : `check:leaks: 私有敏感词清单不可读（METWEAVE_LEAK_PATTERNS=${envPath}），拒绝以弱模式提交。`,
  );
  console.error("  设置：~/.zshrc 加入 export METWEAVE_LEAK_PATTERNS=<私有敏感词清单绝对路径>");
  process.exit(1);
}
if (!patterns) {
  console.error("⚠ 未设置/未能加载私有敏感词清单，本次仅用内置通用模式。");
}
const effective = patterns ?? GENERIC_PATTERNS;

const findings = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // 暂存后又被删除的文件
  }
  if (text.includes("\0")) continue; // 二进制文件
  text.split("\n").forEach((line, i) => {
    if (line.includes("leak-ignore")) return;
    for (const [name, re] of effective) {
      if (re.test(line)) findings.push(`${file}:${i + 1}  [${name}]  ${line.trim().slice(0, 80)}`);
    }
  });
}

if (findings.length > 0) {
  console.error(`check:leaks 失败（${findings.length} 处疑似信息泄露）:`);
  for (const f of findings) console.error(`  ✗ ${f}`);
  console.error("  确需公开时在该行行内加 leak-ignore 并附理由。");
  process.exit(1);
}
console.log(
  `check:leaks 通过: ${mode} · ${source} · ${files.length} 文件 · ${effective.length} 组模式`,
);
