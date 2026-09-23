#!/usr/bin/env node
/**
 * 术语表单一源管控（terms governance）
 *
 * 单一事实源：terms/terms.zh.json 与 terms/terms.en.json（按语言各一份，key 对齐）。
 * 每条术语包含四要素：usage（出处=代码引用位置）、refs[].standard（依赖的规范）、
 * refs[].doc（文档名称）、refs[].clause（具体条款）；kind=official（有官方依据）/
 * product（产品显示文案）/ template（参数化拼装模板）。
 *
 * 命令：
 *   node scripts/terms.mjs gen [--write]  抽取代码文案并与在册术语合并；--write 落盘
 *                                         terms/*.json 并再生 glossary.*.md
 *   node scripts/terms.mjs check          门禁：代码文案必须与在册术语逐条一致
 *                                         （不一致=改动未经术语表入册）、zh/en key
 *                                         对齐、规范代号可解析、清单与源一致
 *
 * 抽取面（v1）：render/card.ts#LOCALE（词表常量在 render/gloss.ts，经作用域注入求值）、leaflet/index.ts#TIER_WORDS、
 * core/errors.ts#EN_MESSAGES、sources.ts 与 parser/index.ts 的 CJK 字符串字面量。
 * card.ts 内联拼装模板（龄期/日期/云底折米等）以 kind=template 在册，不参与自动比对。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TERMS_DIR = path.join(root, "terms");
const FILES = {
  zh: path.join(TERMS_DIR, "terms.zh.json"),
  en: path.join(TERMS_DIR, "terms.en.json"),
};
const GLOSSARY = {
  zh: path.join(TERMS_DIR, "glossary.zh.md"),
  en: path.join(TERMS_DIR, "glossary.en.md"),
};

export const STANDARDS = {
  WMO306: "WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI",
  WMO4678: "WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1)",
  ICAOANNEX3:
    "ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82)",
  FMH1: "美国《地面观测手册》FMH-1（Surface Weather Observations and Reports，FCM-H1-1995 第 5 版，NOAA/NWS）——美制形态与 RMK 国家附加组",
  AP117: "民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航）",
  CCAR117: "中国民用航空气象工作规则 CCAR-117R1",
  MAVIS: "UK Met Office MAVIS — How to decode a METAR（权威机构转述）",
  PRODUCT: "产品显示文案（无标准对应条款，措辞经 owner 术语终审）",
};

/**
 * 英文册的规范名显示文本（规范代号 → 英文表述）。
 * 只影响英文术语册「规范登记表」的渲染，不改 terms/*.json 里的 standards 字段
 *（那里保留官方原名，中文规范的中文名是它的正式名称）。
 * 键集必须与 STANDARDS 完全一致——缺一个就让英文册漏出中文，故在模块加载时即断言。
 */
const STANDARDS_EN = {
  WMO306: "WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI",
  WMO4678: "WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1)",
  ICAOANNEX3:
    "ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82)",
  FMH1: "US Federal Meteorological Handbook No. 1 — Surface Weather Observations and Reports (FCM-H1-1995, 5th ed., NOAA/NWS)",
  AP117:
    "CAAC Ground Observation Specifications AP-117-TM-2021-01R2 (Civil Aviation Administration of China)",
  CCAR117: "CCAR-117R1 — China Civil Aviation Meteorological Working Rules",
  MAVIS: "UK Met Office MAVIS — How to decode a METAR (as relayed by an authoritative body)",
  PRODUCT: "Product display copy (no matching standard clause; wording approved by the owner)",
};

for (const code of Object.keys(STANDARDS))
  if (STANDARDS_EN[code] === undefined)
    throw new Error(
      `STANDARDS_EN 缺 ${code} 的英文表述——新增规范必须同时给出英文名（否则英文册会漏出中文）`,
    );

const RULES_FILE = path.join(TERMS_DIR, "meta.rules.json");

/** 规范分层：international=国际根规范（每条 official 的第一依据）；domestic=国内对应规范（仅中文册引用）。 */
const DOMESTIC_STANDARDS = new Set(["AP117", "CCAR117"]);
const INTERNATIONAL_STANDARDS = new Set(["WMO306", "WMO4678", "ICAOANNEX3", "FMH1"]);

/** 元数据入册：仅对 refs 为空的条目生效（人工已填的不覆盖）。keys 精确优先，prefixes 最长前缀，products 兜底。
 *  英文册自动剥除国内规范（引用层级模型：en 只引国际根）；剥除后 official 条目 refs 为空 = 规则书写错误。 */
/** PRODUCT 兜底条目的条款注（非规范来源，按册各自成文） */
const PRODUCT_CLAUSE = {
  zh: "显示自拟（无标准对应条款）",
  en: "Self-authored display copy (no matching standard clause)",
};

/** 按册取规范名：英文册走 STANDARDS_EN 的英文表述，中文册走官方原名（中文规范的正式名称即中文）。 */
const docFor = (standard, lang) =>
  lang === "en" ? (STANDARDS_EN[standard] ?? STANDARDS[standard]) : STANDARDS[standard];

/** 英文册的字符纯净判据：汉字与全角标点（CJK 标点 / 全角形式区）都判为「非英文册文本」。
 *  全角逗号、括号、冒号是中文排版标点，出现在英文册里是漏译或从中文册复制的痕迹。 */
export const NON_EN_TEXT = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/;

/** 按册取条款注：英文册优先取规则的 clauseEn；缺则回落中文注——由 validate 拦下并要求补全，
 *  不允许英文册悄悄漏出中文。 */
const clauseFor = (r, lang) => (lang === "en" ? (r.clauseEn ?? r.clause) : r.clause);

function applyRules(terms, rules, lang) {
  if (!rules) return;
  const exact = rules.keys ?? {};
  const prefixes = Object.entries(rules.prefixes ?? {}).toSorted(
    (x, y) => y[0].length - x[0].length,
  );
  const products = rules.products ?? [];
  for (const [k, e] of Object.entries(terms)) {
    if ((e.refs ?? []).length) continue;
    const rule = exact[k] ?? prefixes.find(([p]) => k.startsWith(p))?.[1];
    if (rule) {
      e.kind = rule.kind;
      let refs = rule.refs.map((r) => ({
        standard: r.standard,
        doc: r.doc ?? docFor(r.standard, lang),
        clause: clauseFor(r, lang),
      }));
      if (lang === "en") refs = refs.filter((r) => !DOMESTIC_STANDARDS.has(r.standard));
      if (rule.kind === "official" && refs.length === 0)
        throw new Error(
          `${lang}:${k} 规则剥除国内规范后无任何国际根引用——请为该规则补充 WMO/ICAO 根条款`,
        );
      e.refs = refs;
    } else if (products.some((p) => k === p || k.startsWith(p))) {
      e.kind = "product";
      e.refs = [
        { standard: "PRODUCT", doc: docFor("PRODUCT", lang), clause: PRODUCT_CLAUSE[lang] },
      ];
    }
  }
}

/** 零依赖括号平衡扫描：取出 `const NAME = { ... };` 的初始化表达式（正确跳过注释/字符串/模板） */
function scanInit(src, constName) {
  const declRe = new RegExp(`\\bconst\\s+${constName}\\b[^=]*=`);
  const dm = declRe.exec(src);
  if (!dm) throw new Error(`const ${constName} not found`);
  let i = dm.index + dm[0].length;
  while (/\s/.test(src[i])) i++;
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && src[i + 1] === "*") {
      i = src.indexOf("*/", i) + 1;
    } else if (c === '"' || c === "'") {
      i++;
      while (i < src.length && src[i] !== c) i += src[i] === "\\" ? 2 : 1;
    } else if (c === "`") {
      depth++; // 模板整体按一层括号计，`${}` 内的引号由递归态处理——简化：模板内禁用 `{`，本仓文案满足
      i++;
      while (i < src.length && src[i] !== "`") {
        if (src[i] === "\\") i++;
        i++;
      }
      depth--;
    } else if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") {
      depth--;
      if (depth === 0) {
        let end = i + 1;
        const tail = src.slice(end, end + 24);
        const asMatch = /^(?:\s+as\s+const|\s+satisfies\s+[^\s;]+)/.exec(tail);
        if (asMatch) end += asMatch[0].length;
        return src.slice(dm.index + dm[0].length, end).trim();
      }
    }
  }
  throw new Error(`const ${constName} unterminated`);
}

/** 把 TS 源码中某个 const 的初始化表达式取出来并求值为 JS 对象（scope 提供其引用的其他模块级常量） */
function extractConst(file, constName, scope = {}) {
  const src = readFileSync(path.join(root, file), "utf8");
  const initText = scanInit(src, constName);
  return vm.runInNewContext(`(${initText})`, scope);
}

/** 从源码里抽取含 CJK 的字符串字面量（双引号/反引号；撇号等注释内引号不再误收） */
function extractCjkLiterals(file) {
  const src = readFileSync(path.join(root, file), "utf8");
  const out = [];
  // 块注释区间表：匹配起点落在 /* */ 内的「字符串」是注释文本而非代码字面量
  //（2026-09-16 实测事故：注释里 source's 的撇号被当引号起配，把整段接口注释吞成文案入册）
  const commentRanges = [];
  const commentRe = /\/\*[\s\S]*?\*\//g;
  let cm;
  while ((cm = commentRe.exec(src))) commentRanges.push([cm.index, cm.index + cm[0].length]);
  const inComment = (idx) => commentRanges.some(([s, e]) => idx > s && idx < e);
  const re = /(["'`])((?:\\.|(?!\1)[^\\])*?)\1/gs;
  let m;
  while ((m = re.exec(src))) {
    if (inComment(m.index)) continue;
    const line = src.slice(0, m.index).split("\n").length;
    const raw = m[2];
    if (!/[一-龥]/.test(raw)) continue;
    out.push({ text: raw, line });
  }
  return out;
}

function flatten(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, key, out);
    else out[key] = String(v);
  }
  return out;
}

/** 抽取全部在册文案：返回 { key: { text, usage } }，按语言分账 */
function harvest() {
  const zh = {};
  const en = {};
  // LOCALE 引用模块级 DECODE_CITES（转换说明气泡的规范依据行，单一来源）——先取后者再入作用域
  const decodeCites = extractConst("packages/render/src/card.ts", "DECODE_CITES");
  // LOCALE 另引用 gloss.ts 的共享词表常量（wind/cloud/wx/CAVOK 短译单一来源）——同 DECODE_CITES 先例入作用域
  const glossScope = {};
  for (const name of ["WIND_GLOSS", "CLOUD_GLOSS", "WX_GLOSS", "CAVOK_SHORT"]) {
    glossScope[name] = extractConst("packages/render/src/gloss.ts", name);
  }
  const cardLocale = extractConst("packages/render/src/card.ts", "LOCALE", {
    DECODE_CITES: decodeCites,
    ...glossScope,
  });
  const zhFlat = flatten(cardLocale.zh, "card", {});
  const enFlat = flatten(cardLocale.en, "card", {});
  const usageCard = ["packages/render/src/card.ts#LOCALE"];
  for (const [k, text] of Object.entries(zhFlat)) zh[k] = { text, usage: usageCard };
  for (const [k, text] of Object.entries(enFlat)) en[k] = { text, usage: usageCard };

  const tiers = extractConst("packages/leaflet/src/index.ts", "TIER_WORDS");
  const usageTier = ["packages/leaflet/src/index.ts#TIER_WORDS"];
  const tierTexts = new Set();
  for (const [tier, text] of Object.entries(tiers.zh)) {
    zh[`leaflet.tier.${tier}`] = { text, usage: usageTier };
    tierTexts.add(text);
  }
  for (const [tier, text] of Object.entries(tiers.en))
    en[`leaflet.tier.${tier}`] = { text, usage: usageTier };
  // leaflet 其余散装 CJK 文案（tooltip 摘要等）同样入册，排除 TIER_WORDS 已收部分
  const usageLeaflet = ["packages/leaflet/src/index.ts"];
  extractCjkLiterals("packages/leaflet/src/index.ts")
    .filter((x) => !tierTexts.has(x.text))
    .forEach((x, i) => {
      zh[`leaflet.msg${String(i + 1).padStart(2, "0")}`] = {
        text: x.text,
        usage: usageLeaflet,
        zhOnly: true,
        line: x.line,
      };
    });

  const enMessages = extractConst("packages/core/src/errors.ts", "EN_MESSAGES");
  const usageErr = ["packages/core/src/errors.ts#EN_MESSAGES"];
  for (const [code, text] of Object.entries(enMessages))
    en[`errors.${code}`] = { text, usage: usageErr, enOnly: true };

  const usageSrc = ["packages/metweave/src/sources.ts"];
  extractCjkLiterals("packages/metweave/src/sources.ts").forEach((x, i) => {
    zh[`sources.msg${String(i + 1).padStart(2, "0")}`] = {
      text: x.text,
      usage: usageSrc,
      zhOnly: true,
      line: x.line,
    };
  });
  const usageParser = ["packages/parser/src/index.ts"];
  extractCjkLiterals("packages/parser/src/index.ts").forEach((x, i) => {
    zh[`parser.msg${String(i + 1).padStart(3, "0")}`] = {
      text: x.text,
      usage: usageParser,
      zhOnly: true,
      line: x.line,
    };
  });
  return { zh, en };
}

const blankEntry = (x) => ({ kind: "product", refs: [], ...x });

/** 与在册文件合并：保元数据（refs/kind），更新文案与出处 */
function merge(disk, fresh) {
  const out = {};
  for (const [key, x] of Object.entries(fresh)) {
    const prev = disk?.terms?.[key];
    out[key] = prev
      ? {
          ...blankEntry(prev),
          text: x.text,
          usage: x.usage ?? prev.usage,
          line: x.line ?? prev.line,
        }
      : blankEntry(x);
  }
  return out;
}

function validate(zhTerms, enTerms) {
  const errs = [];
  const zk = Object.keys(zhTerms);
  const ek = Object.keys(enTerms);
  const zhShared = zk.filter((k) => !zhTerms[k].zhOnly);
  const enShared = ek.filter((k) => !enTerms[k].enOnly);
  for (const k of zhShared) if (!enTerms[k]) errs.push(`zh 独有未标注 zhOnly: ${k}`);
  for (const k of enShared) if (!zhTerms[k]) errs.push(`en 独有未标注 enOnly: ${k}`);
  for (const [lang, terms] of [
    ["zh", zhTerms],
    ["en", enTerms],
  ]) {
    for (const [k, e] of Object.entries(terms)) {
      if (!["official", "product", "template"].includes(e.kind))
        errs.push(`${lang}:${k} kind 非法`);
      if (e.kind === "official" && !e.refs?.length) errs.push(`${lang}:${k} official 缺 refs`);
      for (const r of e.refs ?? []) {
        if (!STANDARDS[r.standard]) errs.push(`${lang}:${k} 规范代号不可解析: ${r.standard}`);
        if (e.kind === "official" && (!r.doc || !r.clause))
          errs.push(`${lang}:${k} official 条目缺 doc/clause`);
      }
      // 引用层级模型：en 只引国际根；official 必须有国际根，确无者须显式 scope=domestic（国内独有）
      if (lang === "en" && (e.refs ?? []).some((r) => DOMESTIC_STANDARDS.has(r.standard)))
        errs.push(`${lang}:${k} 英文册不得引用国内规范（AP117/CCAR117）`);
      if (
        e.kind === "official" &&
        !(e.refs ?? []).some((r) => INTERNATIONAL_STANDARDS.has(r.standard)) &&
        e.scope !== "domestic"
      )
        errs.push(
          `${lang}:${k} official 缺国际根规范（WMO306/WMO4678/ICAOANNEX3）；若确为国内独有，请显式标注 scope:"domestic"`,
        );
      if (e.kind !== "official" && (e.refs ?? []).some((r) => r.standard !== "PRODUCT"))
        errs.push(`${lang}:${k} 非 official 条目不得引 PRODUCT 之外的规范`);
      // 依据完备：product/template 条目必须恰有一条 PRODUCT 引用——不许出现「refs 为空」
      // 的第三态（空 refs 在术语册里渲染成「—」，读起来像「未登记依据」，而 PRODUCT 行
      // 表达的是「自拟、无标准条款、措辞经 owner 终审」，信息量更大且是唯一诚实归类）。
      // 2026-09-15 发布前审核实测：35 条显示「—」，其中 25 条实有条款可依（应升 official）、
      // 10 条真自拟（应进 products 列表）——两类都不该停在第三态。
      if (e.kind !== "official") {
        const refs = e.refs ?? [];
        if (refs.length !== 1 || refs[0].standard !== "PRODUCT")
          errs.push(
            `${lang}:${k} ${e.kind} 条目必须恰有一条 PRODUCT 引用（当前 ${refs.length} 条${refs[0] ? `，首条 ${refs[0].standard}` : ""}）——进 rules 的 products 列表或升 official`,
          );
      }
      // 语言纯净：英文册的规范名与条款注不得含汉字或全角标点——英文册是英文文档，
      // 中文表述与中文排版标点只属于中文册。规则文件（meta.rules.json）只写中文条款注，
      // 故新增条目若由规则带入中文，这条会红，逼作者补 clauseEn／英文表述；否则英文册会
      // 悄悄漏出中文（2026-09-15 发布前审核实测：条款注 146 处、规范名 53 处、全角标点 16 处）。
      if (lang === "en")
        for (const r of e.refs ?? [])
          for (const [field, value] of [
            ["doc", r.doc],
            ["clause", r.clause],
          ])
            if (NON_EN_TEXT.test(value ?? ""))
              errs.push(`${lang}:${k} ${field} 含非英文册文本（汉字/全角标点）：${value}`);
    }
  }
  return errs;
}

/**
 * 术语册的书写脚手架，按册各自成文——英文册是英文文档，不是「中文册的骨架 + 英文字段」。
 * 改这里的措辞等于同时改两份生成物，改完必须 `pnpm gen:terms` 重生成。
 * 注：两册都在 check:docs 的语言豁免清单里（生成物、按设计一册一语言，且 check:terms
 * 对本目录的约束严格强于语言门禁——逐条比对在册文案与磁盘内容）。
 */
const GLOSSARY_COPY = {
  zh: {
    title: "# metweave 术语清单（中文）",
    generated: (file) => [
      `> 本文件由 \`pnpm gen:terms\` 从 ${file} 机械再生，请勿手改；`,
      `> 术语的唯一人工编辑入口是 ${file}。除标记 \`zhOnly\` / \`enOnly\` 的条目外，`,
      "> 中文册与英文册的 key 一一对应，元数据须一致。",
    ],
    standards: "## 规范登记表",
    group: (g, n) => `## ${g}（${n} 条）`,
    table: ["| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |", "|---|---|---|---|---|"],
    domesticOnly: "国内独有，无 WMO 规范",
    /** 多条规范引用之间的连接符（中文册用全角分号，英文册用半角分号加空格） */
    refSep: "；",
  },
  en: {
    title: "# metweave terminology glossary (English)",
    generated: (file) => [
      `> Generated mechanically by \`pnpm gen:terms\` from ${file} — do not edit by hand;`,
      `> the single hand-editing entry point is ${file}. Except for entries marked`,
      "> `zhOnly` / `enOnly`, the English and Chinese glossaries have one-to-one keys, and metadata must match.",
    ],
    standards: "## Standards registry",
    group: (g, n) => `## ${g} (${n} entries)`,
    table: [
      "| key | Text | kind | Usage | Standard · Document · Clause |",
      "|---|---|---|---|---|",
    ],
    domesticOnly: "domestic-only; no WMO standard applies",
    refSep: "; ",
  },
};

function renderGlossary(lang, terms) {
  const copy = GLOSSARY_COPY[lang];
  const file = `\`terms/terms.${lang}.json\``;
  const groups = {};
  for (const [k, e] of Object.entries(terms)) {
    const g = k.split(".").slice(0, 2).join(".");
    (groups[g] ??= []).push([k, e]);
  }
  const lines = [
    copy.title,
    "",
    ...copy.generated(file),
    "",
    copy.standards,
    "",
    ...Object.entries(STANDARDS).map(
      ([code, name]) => `- **${code}** — ${lang === "en" ? (STANDARDS_EN[code] ?? name) : name}`,
    ),
    "",
  ];
  for (const [g, rows] of Object.entries(groups)) {
    lines.push(copy.group(g, rows.length), "");
    lines.push(...copy.table);
    for (const [k, e] of rows) {
      const ref =
        (e.refs ?? []).map((r) => `${r.standard} · ${r.doc} · ${r.clause}`).join(copy.refSep) ||
        (e.scope === "domestic" ? copy.domesticOnly : "—");
      lines.push(
        `| ${k} | ${String(e.text).replace(/\|/g, "\\|")} | ${e.kind} | ${(e.usage ?? []).join(", ")} | ${ref} |`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

const mode = process.argv[2] ?? "check";
const diskZh = existsSync(FILES.zh) ? JSON.parse(readFileSync(FILES.zh, "utf8")) : null;
const diskEn = existsSync(FILES.en) ? JSON.parse(readFileSync(FILES.en, "utf8")) : null;
const fresh = harvest();
const forceRules = process.argv.includes("--force-rules");
const zhTerms = merge(forceRules ? null : diskZh, fresh.zh);
const enTerms = merge(forceRules ? null : diskEn, fresh.en);

if (mode === "gen") {
  mkdirSync(TERMS_DIR, { recursive: true });
  const rules = existsSync(RULES_FILE) ? JSON.parse(readFileSync(RULES_FILE, "utf8")) : null;
  applyRules(zhTerms, rules, "zh");
  applyRules(enTerms, rules, "en");
  // 册内的一切都按册本地化：规范名登记块与 meta.note 也一样——
  // 英文册的数据文件不该是「英文字段 + 中文框架」（正文渲染见 renderGlossary）。
  const metaDefault = {
    zh: { version: 1, note: "唯一人工编辑入口；gen --write 再生清单" },
    en: {
      version: 1,
      note: "single hand-editing entry point; gen --write regenerates the glossary",
    },
  };
  for (const [lang, terms] of [
    ["zh", zhTerms],
    ["en", enTerms],
  ]) {
    const disk = lang === "zh" ? diskZh : diskEn;
    writeFileSync(
      FILES[lang],
      JSON.stringify(
        {
          meta: disk?.meta ?? metaDefault[lang],
          standards: lang === "en" ? STANDARDS_EN : STANDARDS,
          terms,
        },
        null,
        1,
      ) + "\n",
    );
    writeFileSync(GLOSSARY[lang], renderGlossary(lang, terms));
  }
  console.log(
    `terms: ${Object.keys(zhTerms).length} zh / ${Object.keys(enTerms).length} en 条目已入册并再生清单`,
  );
} else {
  const errs = [];
  if (!diskZh || !diskEn)
    errs.push("terms/terms.zh.json / terms.en.json 不存在，先运行 pnpm gen:terms");
  else {
    for (const [lang, freshTerms, disk] of [
      ["zh", fresh.zh, diskZh.terms],
      ["en", fresh.en, diskEn.terms],
    ]) {
      for (const [k, x] of Object.entries(freshTerms)) {
        if (!disk[k])
          errs.push(
            `${lang}: 代码存在未入册文案 ${k}（"${x.text.slice(0, 24)}…"）→ 先 pnpm gen:terms 入册并补元数据`,
          );
        else if (disk[k].text !== x.text)
          errs.push(`${lang}: ${k} 文案已改但术语表未更新 → pnpm gen:terms`);
      }
      for (const k of Object.keys(disk)) {
        if (!freshTerms[k] && !disk[k].templateSkip)
          errs.push(`${lang}: 在册术语 ${k} 已无对应代码文案（删除需同步再生）`);
      }
    }
    errs.push(...validate(diskZh.terms, diskEn.terms));
    for (const [lang, file] of [
      ["zh", GLOSSARY.zh],
      ["en", GLOSSARY.en],
    ]) {
      if (existsSync(file)) {
        const want = renderGlossary(lang, lang === "zh" ? diskZh.terms : diskEn.terms);
        if (readFileSync(file, "utf8") !== want)
          errs.push(`terms/glossary.${lang}.md 与术语源不一致 → pnpm gen:terms`);
      }
    }
  }
  if (errs.length) {
    console.error(`terms check FAILED（${errs.length}）:\n- ` + errs.slice(0, 30).join("\n- "));
    process.exit(1);
  }
  console.log(
    `terms check ok：zh ${Object.keys(diskZh.terms).length} / en ${Object.keys(diskEn.terms).length} 条，代码与术语表一致`,
  );
}
