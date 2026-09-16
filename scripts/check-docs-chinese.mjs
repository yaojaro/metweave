#!/usr/bin/env node
// 文档语言门禁：所有 .md 文档一律**中文单源**（2026-09-16 起反转原「中英双语」规则——
// 双源维护已被实证为人肉同步税：v0.1.0 给中文段新增「30 秒认识 METAR」而英文段从未跟上，
// 散文的跨语言语义等价又不可静态校验，根治办法是消灭双源、中文成为唯一权威版本）。
// 政策成文于仓库本地 AGENTS.md（不入库）；本脚本自动拦截三类破窗：
//   ① 纯英文/无中文文档混入；② 英文镜像章节（`## English` 类标题复辟）；
//   ③ 英文正文段落（代码块外一段连续英文词串，即旧段级双语的三种复活形态之一）。
// 判据是内容级启发式：跳过标题行计数、围栏代码块、行内代码、HTML 注释/标签、
// frontmatter、链接与徽章（URL 与图标名不是正文）；「英文正文」指一段连续且非纯电码的
// 英文词串（沿用 2026-09-15 校准的判据——只数词总量会被电码与专名凑数骗过）。

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MIN_HAN = 10; // 中文存在性阈值：正文汉字数
const MIN_EN_RUN = 8; // 英文正文阈值：一段连续英文词的最小长度
const MIN_EN_HEADING_WORDS = 2; // 英文标题阈值：非电码英文词数
const HAN = /\p{Script=Han}/gu;
const WORD = /[A-Za-z][A-Za-z'’-]+/g;
const ACRONYM = /^[A-Z]{2,}$/; // 全大写词：METAR 文档里几乎都是电码/缩写（BR/RVR/CLRD/QNH…）

/** 豁免清单（显式列举，新增人工文档一律进不了这个集合）：
 *  - SECURITY.md：按 2026-09-16 决策保持双语——安全报告是全球入站通道，内容静态不随功能漂移；
 *  - terms/glossary.*.md：按设计一册一语言的生成术语册，守它们的是 check:terms 逐条比对。 */
const EXEMPT_DOCS = new Set(["SECURITY.md", "terms/glossary.zh.md", "terms/glossary.en.md"]);

/**
 * 英文正文判据：正文里存在一段「连续且非纯电码」的英文词串。
 * - 连续 = 不被汉字或代码片段打断（有英文段落的文档自然满足，中英混排的短句也满足）；
 * - 非纯电码 = 该串里过半的词不是全大写。
 * 只数「英文词总量」不够：纯中文文档顺着电码与专名就能凑够词数——
 * 2026-09-15 发布前审核实测漏网一例（fixtures README 的 48 个「英文词」几乎全是电码与专名，
 * 最长连续串是 `FZRA FZDZ FZFG GR GS SG IC PL PO SQ FC` 一串全大写电码）。
 * 返回首个违规段的行号与样例，未命中返回 null。
 */
function findEnglishProse(body) {
  let offset = 0;
  for (const segment of body.split(HAN)) {
    const start = offset;
    offset += segment.length + 1; // +1：split 消耗掉的分隔汉字
    const words = segment.match(WORD) ?? [];
    if (words.length < MIN_EN_RUN) continue;
    const prose = words.filter((w) => !ACRONYM.test(w));
    if (prose.length * 2 > words.length) {
      const line = body.slice(0, start).split("\n").length;
      return { line, sample: words.slice(0, 8).join(" ") };
    }
  }
  return null;
}

/**
 * 英文镜像章节判据：标题行不含汉字，且（含 standalone「English」一词，或多词标题里
 * 非电码英文词 ≥ 2）。`## English` / `### Quick start` / `# Error & Warning Codes (English)`
 * 均命中；「## ROADMAP」「# @metweave/core」类纯 token 标题（无空格：包名/缩写/路径）
 * 与含汉字标题不受影响——它们是标识符，其语言属性由正文段落判据守。
 */
function findEnglishHeading(text) {
  for (const [i, raw] of text.split("\n").entries()) {
    const match = raw.match(/^\s*#{1,6}\s+(.*?)\s*$/);
    if (!match) continue;
    const heading = match[1];
    if (countHan(heading) > 0) continue;
    if (/\bEnglish\b/i.test(heading)) return { line: i + 1, heading };
    if (!/\s/.test(heading)) continue; // 纯 token 标题：标识符而非英文句子
    const words = heading.match(WORD) ?? [];
    const prose = words.filter((w) => !ACRONYM.test(w));
    if (prose.length >= MIN_EN_HEADING_WORDS) return { line: i + 1, heading };
  }
  return null;
}

function listMarkdownFiles() {
  return execSync("git ls-files '*.md'", { encoding: "utf8" }).split("\n").filter(Boolean);
}

function stripFrontmatter(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n/, "");
}

/**
 * 剥除代码与链接：围栏代码块 + 行内代码 + HTML 注释/标签 + 图片徽章 + 链接（留文字）+ 裸 URL。
 * 行内代码必须剥除——否则纯中文文档里几个 API 名就能凑出「英文正文」假阳性；
 * 链接 URL 必须剥除——徽章块与外链的路径词（shields/github/svg）不是正文（假阳性另一来源）。
 */
function stripCodeAndLinks(text) {
  return text
    .replace(/^```.*\n[\s\S]*?^```.*$/gm, "")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>\n]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\bhttps?:\/\/\S+/g, " ");
}

function countHan(text) {
  return (text.match(HAN) || []).length;
}

const failures = [];
const files = listMarkdownFiles();
let exempted = 0;
for (const file of files) {
  if (EXEMPT_DOCS.has(file)) {
    exempted += 1;
    continue;
  }
  const raw = readFileSync(file, "utf8");
  const body = stripCodeAndLinks(stripFrontmatter(raw));

  const hanChars = countHan(body);
  if (hanChars < MIN_HAN) {
    failures.push(`${file}：缺中文（正文汉字 ${hanChars} < ${MIN_HAN}）——文档政策：一律中文单源`);
    continue;
  }

  const enHeading = findEnglishHeading(body);
  if (enHeading) {
    failures.push(
      `${file}：行 ${enHeading.line}：英文章节标题「${enHeading.heading}」——文档政策：中文单源，英文镜像章节仅限豁免清单（SECURITY.md）`,
    );
    continue;
  }

  const enProse = findEnglishProse(body);
  if (enProse) {
    failures.push(
      `${file}：行 ${enProse.line}：英文正文段落（「${enProse.sample} …」）——文档政策：中文单源，英文对照段落一律删除`,
    );
  }
}

if (failures.length > 0) {
  console.error("check:docs 未通过——所有文档一律中文单源：");
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}
console.log(
  `check:docs 通过: ${files.length - exempted} 篇文档 · 中文单源` +
    (exempted > 0
      ? `（豁免 ${exempted}：双语安全页 SECURITY.md + 生成术语册两册，后者由 check:terms 守）`
      : ""),
);
