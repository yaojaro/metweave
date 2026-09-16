// 信息泄露检查（公开面前置门禁）——机制公开，模式私有（加载逻辑见 leak-patterns.mjs）。
//   强制策略：--staged（pre-commit）与 --msg-file（commit-msg）未设置或加载失败
//   METWEAVE_LEAK_PATTERNS 该变量即报错退出，不降级弱模式；--all（CI / 全仓）
//   未设置时降级内置通用模式并告警。
//   用法：node scripts/check-leaks.mjs [--staged|--all|--msg-file <file>]，默认 --staged。
//   行级豁免：在该行加 leak-ignore 并附理由。
//
// 两道防线（互补，2026-09-15 发布前审核增补第二道）：
//   ① 模式扫描：按「形状」查身份、黑话、疑似密钥（模式表见 leak-patterns.mjs）；
//   ② 本机密钥值扫描：读工作区里的 .env* 取真实密钥值，凡出现在任何被扫描文件（含构建产物）
//      即命中——零误报，且能抓住「没有任何标签」的形态：Vite 会把 import.meta.env.VITE_*
//      内联成裸字符串字面量（实测产物里就是 `fd50f28d…` 一串，既无 KEY= 也无 tk=）。
//   构建产物目录（examples/dist、packages/*/dist）被 .gitignore 覆盖，git ls-files 与暂存区
//   都看不见，但整目录打包/部署会把内联密钥一起带走——故 --all 同时扫这些目录。
import { readFileSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { GENERIC_PATTERNS, loadLeakPatterns } from "./leak-patterns.mjs";

const args = process.argv.slice(2);
const mode = args[0] ?? "--staged";
const msgFile = mode === "--msg-file" ? args[1] : undefined;
if (mode === "--msg-file" && msgFile === undefined) {
  console.error("check:leaks: --msg-file 需要提交信息文件路径参数（commit-msg 钩子传入）");
  process.exit(1);
}
if (!["--staged", "--all", "--msg-file"].includes(mode)) {
  console.error(`check:leaks: 未知模式 ${mode}（可用：--staged / --all / --msg-file <file>）`);
  process.exit(1);
}

// ---------------------------------------------------------------- 文件清单

/** 构建产物目录：gitignore 覆盖、git 看不见，却是最容易被整目录带走的一类。
 *  只取实际存在的目录（CI 的 check:leaks 跑在 build 之前，这里为空属正常）。 */
const BUILD_OUTPUT_DIRS = ["examples/dist", "node_modules/.artifacts", ...listPackageDistDirs()];
const MAX_SCAN_BYTES = 8 * 1024 * 1024; // 单个产物文件上限，防超大 bundle 拖垮门禁

function listPackageDistDirs() {
  try {
    return execSync("git ls-files -z -- 'packages/*/package.json'", { encoding: "utf8" })
      .split("\0")
      .filter(Boolean)
      .map((p) => join(dirname(p), "dist"))
      .toSorted();
  } catch {
    return [];
  }
}

/** 递归收集目录下的候选文件（是否文本由内容判据负责，见下方 \0 检查） */
function walkDir(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkDir(p, out);
    else if (e.isFile()) {
      try {
        if (statSync(p).size <= MAX_SCAN_BYTES) out.push(p);
      } catch {
        /* 读不到就跳过 */
      }
    }
  }
  return out;
}

const gitFiles =
  mode === "--msg-file"
    ? [msgFile]
    : execSync(
        `git ${mode === "--all" ? "ls-files" : "diff --cached --name-only --diff-filter=ACMR"}`,
        { encoding: "utf8" },
      )
        .split("\n")
        .filter(Boolean);

const buildFiles = mode === "--all" ? BUILD_OUTPUT_DIRS.flatMap((d) => walkDir(d)) : [];
const files = [...gitFiles, ...buildFiles];
const buildFileSet = new Set(buildFiles);

// ---------------------------------------------------------------- 本机密钥值（第二道防线）

/** 从工作区的 .env* 里取真实密钥值（.env.example 是空模板，跳过）。
 *  返回 [值, 出处] 列表——出处用于报错定位，值本身在输出里打码，绝不回显。 */
function loadLocalSecretValues() {
  const found = [];
  let envFiles;
  try {
    envFiles = execSync(
      "git ls-files --others --exclude-standard --ignored -- '.env*' '**/.env*'",
      {
        encoding: "utf8",
      },
    )
      .split("\n")
      .filter((f) => f && !f.endsWith(".env.example"));
  } catch {
    return found;
  }
  for (const f of envFiles) {
    let text;
    try {
      text = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      const m =
        /^\s*(?:export\s+)?[A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)\s*=\s*(.+?)\s*$/i.exec(
          line,
        );
      const value = m?.[1]?.replace(/^["']|["']$/g, "");
      // 太短的值（占位符、本地开关）不参与匹配，避免噪声
      if (value !== undefined && value.length >= 16) found.push([value, f]);
    }
  }
  return found;
}

const localSecrets = mode === "--all" || mode === "--staged" ? loadLocalSecretValues() : [];
const redact = (v) => `${v.slice(0, 4)}…${v.slice(-2)}（已打码）`;

// ---------------------------------------------------------------- 扫描

const envPath = process.env.METWEAVE_LEAK_PATTERNS;
const { patterns, source, failed } = await loadLeakPatterns(envPath);

if ((mode === "--staged" || mode === "--msg-file") && (!envPath || failed)) {
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
  const where = buildFileSet.has(file) ? "构建产物 " : "";
  text.split("\n").forEach((line, i) => {
    if (line.includes("leak-ignore")) return;
    for (const [name, re] of effective) {
      if (re.test(line))
        findings.push(`${where}${file}:${i + 1}  [${name}]  ${line.trim().slice(0, 80)}`);
    }
    for (const [value, origin] of localSecrets) {
      if (line.includes(value))
        findings.push(
          `${where}${file}:${i + 1}  [本机密钥值外泄（来自 ${origin}）]  ${redact(value)}`,
        );
    }
  });
}

if (findings.length > 0) {
  console.error(`check:leaks 失败（${findings.length} 处疑似信息泄露）:`);
  for (const f of findings) console.error(`  ✗ ${f}`);
  console.error("  确需公开时在该行行内加 leak-ignore 并附理由。");
  if (findings.some((f) => f.includes("构建产物"))) {
    console.error("  构建产物命中：产物是再生产物，交付/打包前删掉即可（rm -rf examples/dist）。");
    console.error("  若要根治，请到服务商控制台轮换该密钥——产物一旦外传，密钥即视为已泄露。");
  }
  process.exit(1);
}
console.log(
  `check:leaks 通过: ${mode} · ${source} · ${files.length} 文件${buildFiles.length > 0 ? `（含 ${buildFiles.length} 个构建产物文件）` : ""} · ${effective.length} 组模式 · ${localSecrets.length} 个本机密钥值`,
);
