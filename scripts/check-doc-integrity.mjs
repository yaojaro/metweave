// 文档完整性门禁（绿区补网第二至五条，2026-10-22 立）
//
// 由来：0.3.1 收尾时「卫生五项」里四项是文档层面的机械错误——CHANGELOG 尾部少了 0.1.2~0.3.1
// 六条引用定义（正文 [0.3.1] 悬空）、corpus 清单少了 prmsl_cn.mwgrid 的出处行、根 README 包结构
// 表 leaflet 行没跟上格点三件套、六包版本的文档侧口径未同步。它们全都不是判断失误，是**没人检查**。
// 判断失误可以靠审查兜，机械错误只能靠断言兜——本脚本收这四类：
//
//   ① CHANGELOG 引用式链接闭合：正文用到的 [label] 必须有 [label]: url 定义；每个 `## [x.y.z]`
//      版本小节必须有对应定义，且 URL 恰为 releases/tag/v<x.y.z>（版本与链接不得错配）；
//   ② CHANGELOG 顶部版本 == 六包版本（发版写了代码却忘了写日志，或日志领先于包，双向都拦）；
//   ③ corpus 样本记档：语料目录下的数据文件必须在 corpus/README.md 点名，且同行带出处线索
//      （cycle/源名/采集时间之一）——「文件进了仓、出处没进文档」是复现性事故的前置形态；
//   ④ 根 README 包结构表：六包各一行、链接指向的包目录真实存在、行内反引号标识符必须真实存在
//      （文档写不存在的 API 与漏写新 API，前者可机械拦、后者靠 review——本检查不假装能判「应该写什么」）。
//
// 用法：node scripts/check-doc-integrity.mjs
// CI 门禁：pnpm check:doc-integrity

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const failures = [];
const fail = (msg) => failures.push(msg);

const readText = (relPath) => readFileSync(join(root, relPath), "utf8");

// ---------------------------------------------------------------- 包清单

const packagesDir = join(root, "packages");
const packages = new Map();
for (const dir of readdirSync(packagesDir)) {
  const pkgPath = join(packagesDir, dir, "package.json");
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  packages.set(pkg.name, { dir, pkg });
}

// ---------------------------------------------------------------- ① CHANGELOG 链接闭合

const changelog = readText("CHANGELOG.md");
const definitions = new Map();
for (const m of changelog.matchAll(/^\[([^\]]+)\]:[ \t]*(\S+)[ \t]*$/gm))
  definitions.set(m[1], m[2]);

const bodyWithoutDefs = changelog.replace(/^\[[^\]]+\]:[ \t]*\S+[ \t]*$/gm, "");
const usedLabels = new Set();
for (const m of bodyWithoutDefs.matchAll(/(!?)\[([^\]\n]+)\](?!\()/g)) {
  const [, bang, label] = m;
  if (bang === "!") continue; // 图片引用（本仓 CHANGELOG 不用，留个口子）
  if (/^\d+$/.test(label)) continue; // 代码里的数组下标 arr[0] 形态
  usedLabels.add(label);
}

for (const label of usedLabels) {
  if (!definitions.has(label))
    fail(`CHANGELOG.md：正文引用了 [${label}]，但尾部没有对应的链接定义`);
}

const versionSections = [...changelog.matchAll(/^##[ \t]+\[([0-9][^\]]*)\]/gm)].map((m) => m[1]);
for (const version of versionSections) {
  const url = definitions.get(version);
  if (!url) {
    fail(
      `CHANGELOG.md：版本小节 [${version}] 缺少链接定义（版本号小节必须有对应 releases/tag 定义）`,
    );
    continue;
  }
  if (!url.endsWith(`/tag/v${version}`)) {
    fail(
      `CHANGELOG.md：[${version}] 的链接指向 ${url}，与版本号不一致（应为 …/releases/tag/v${version}）`,
    );
  }
}

// ---------------------------------------------------------------- ② 顶部版本与包版本一致

const pkgVersions = new Set([...packages.values()].map(({ pkg }) => pkg.version));
if (pkgVersions.size > 1) {
  fail(
    `六包版本不一致：${[...pkgVersions].join(" / ")}（锁步由 check:workspace 把关，此处不重复报，但文档侧无从对齐）`,
  );
}
const topVersion = versionSections[0];
const workspaceVersion = [...pkgVersions][0];
if (!topVersion) fail("CHANGELOG.md：找不到任何 `## [x.y.z]` 版本小节");
else if (topVersion !== workspaceVersion) {
  fail(
    `CHANGELOG.md 顶部版本 ${topVersion} 与包版本 ${workspaceVersion} 不一致：发版必须同时更新日志与六包版本`,
  );
}

// ---------------------------------------------------------------- ③ corpus 样本记档

const corpusReadme = readText("corpus/README.md");
const dataExt = /\.(mwgrid|grib2|f32|txt|tac|xml|json)$/;
const exemptFromProvenance = /^(fixture|snapshot)\./; // 声明/快照件本身不承载出处

const corpusDir = join(root, "corpus");
const listed = [];
for (const entry of readdirSync(corpusDir)) {
  const full = join(corpusDir, entry);
  if (statSync(full).isDirectory()) {
    // 子目录（iwxxm/ taf/ 等）按集合记档：README 点名目录即可
    if (!corpusReadme.includes(`${entry}/`))
      fail(`corpus/README.md：子目录 ${entry}/ 未在清单中记档`);
    continue;
  }
  if (/^README\.md$/.test(entry)) continue;
  if (dataExt.test(entry)) listed.push(join("corpus", entry));
}
for (const entry of readdirSync(join(corpusDir, "grid"))) {
  if (dataExt.test(entry)) listed.push(join("corpus", "grid", entry));
}

const provenanceHint =
  /(cycle|GFS|IEM|AWC|OGIMET|tgftp|eccodes|WMO|wmo|官方|采集|归档|淘选|20\d{2})/;
for (const rel of listed) {
  const name = rel.split("/").pop();
  const line = corpusReadme.split("\n").find((l) => l.includes(name));
  if (!line) {
    fail(`corpus/README.md：样本 ${rel} 未记档（语料进仓必须同时写清单与出处）`);
    continue;
  }
  if (exemptFromProvenance.test(name)) continue;
  if (!provenanceHint.test(line)) {
    fail(
      `corpus/README.md：${name} 的记档行没有出处线索（需含 cycle/源名/采集时间之一）：${line.trim().slice(0, 60)}…`,
    );
  }
}

// ---------------------------------------------------------------- ④ 根 README 包结构表

const readme = readText("README.md");
const sectionMatch = /^### 包结构[ \t]*$/m.exec(readme);
if (!sectionMatch) {
  fail("README.md：找不到「### 包结构」小节（包表是读者理解包边界的入口，不得删除）");
} else {
  const after = readme.slice(sectionMatch.index + sectionMatch[0].length);
  const endIdx = after.search(/^###[ \t]/m);
  const section = endIdx >= 0 ? after.slice(0, endIdx) : after;
  const rows = [...section.matchAll(/^\|[^\n]*$/gm)].map((m) => m[0]);
  const rowNames = new Set();
  for (const row of rows) {
    const link = /\]\(packages\/([^)]+)\)/.exec(row);
    if (!link) continue; // 表头与分隔行
    const dir = link[1];
    if (!existsSync(join(root, "packages", dir))) {
      fail(`README.md：包结构表链接 packages/${dir} 不存在`);
      continue;
    }
    const name = [...packages.entries()].find(([, v]) => v.dir === dir)?.[0];
    if (!name) {
      fail(`README.md：包结构表里的 packages/${dir} 不对应任何已登记包`);
      continue;
    }
    rowNames.add(name);
    // 行内反引号标识符：必须真实存在于某个包的源码（否则文档在描述不存在的 API）
    for (const m of row.matchAll(/`([A-Za-z_$][\w$]*)`/g)) {
      const ident = m[1];
      if (!/[A-Z]/.test(ident.slice(1))) continue; // 纯小写词（如 leaflet）不是 API 名
      const inDeclared = occursInPackage(dir, ident);
      if (!inDeclared && ![...packages.values()].some((v) => occursInPackage(v.dir, ident))) {
        fail(
          `README.md：${name} 行提到的 \`${ident}\` 在任何包源码中都找不到（文档不得描述不存在的 API）`,
        );
      }
    }
  }
  for (const name of packages.keys()) {
    if (!rowNames.has(name))
      fail(`README.md：包结构表缺 ${name} 一行（新包上线或改版后必须同步本表）`);
  }
  if (rowNames.size !== packages.size) {
    fail(
      `README.md：包结构表有 ${rowNames.size} 行，实际包数 ${packages.size}（多余行指向已移除的包）`,
    );
  }
}

function occursInPackage(dir, ident) {
  const srcDir = join(root, "packages", dir, "src");
  if (!existsSync(srcDir)) return false;
  const re = new RegExp(`\\b${ident}\\b`);
  const walk = (d) =>
    readdirSync(d).some((entry) => {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) return walk(full);
      return full.endsWith(".ts") && re.test(readFileSync(full, "utf8"));
    });
  return walk(srcDir);
}

// ---------------------------------------------------------------- 汇报

if (failures.length) {
  console.error("check:doc-integrity 失败：");
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}

console.log(
  `check:doc-integrity 通过：CHANGELOG ${versionSections.length} 个版本小节链接闭合（顶部 ${topVersion}）· ` +
    `corpus 样本 ${listed.length} 项出处齐 · 包结构表 ${packages.size} 行与源码对得上`,
);
