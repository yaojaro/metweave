/**
 * @metweave/parser — TAF 解析层（FM 51，v0.2 批 1 骨架）。
 * The TAF parsing layer (FM 51): header + validity skeleton.
 *
 * 批 1 范围：电头 token 序列（清单 A4——TAF 词可省（剥词源同理）、AMD/COR 不写死槽位、
 * COR 时组后位）、发布时组 ddHHMMZ、有效期组 ddHH/ddHH（止时 24 = 午夜合法特例）、
 * 传输层终止符 `=` 剥离（A1）。正文 token 暂一律 unknown-token 出声（不静默纪律），
 * 基况段（1.5）、NIL/CNL（1.3）、AAA/CCA 容错（1.4）、变化组与气温组（批 2/3）随后逐组接管。
 * 纪律与 METAR 侧同源：不静默、span 保真、错误码只增不改（ParseError 别名自 v0.2 起）。
 */
import { MetarParseError } from "@metweave/core";
import type { ParseWarning, TafParseOptions, TafReport, TafValidityGroup } from "@metweave/core";
import { compactNode, spanOf, tokenize, type Token } from "./groups";

const STATION_PATTERN = /^[A-Z0-9]{4}$/;
const ISSUE_TIME_PATTERN = /^(\d{2})(\d{2})(\d{2})Z$/;
const VALIDITY_PATTERN = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/;

/**
 * Parse one TAF report (tolerant mode) into the TAF IR — the forecast-side entry.
 * 解析单条 TAF 报文（tolerant）为预报侧 IR。
 * 整体失败（输入非字符串/无站名/无发布时组/时组或有效期越界/未实现模式）抛 MetarParseError
 * （code 稳定契约，与 parse 同族；v0.2 起别名 ParseError）。
 */
export function parseTaf(raw: string, options?: TafParseOptions): TafReport {
  if (typeof raw !== "string") {
    throw new MetarParseError(
      "invalid-input",
      raw,
      `parseTaf 需要一个 TAF 报文字符串，收到 ${raw === null ? "null" : typeof raw}`,
    );
  }
  if (options?.mode === "strict") {
    throw new MetarParseError(
      "unsupported-mode",
      raw,
      "strict 模式在 v0.2 尚未实现——省略 mode 或传 'tolerant'",
    );
  }

  const compact = options?.spans === false;
  const compactIfEnabled = <T>(node: T): T => (compact ? compactNode(node) : node);

  // —— 传输层终止符（A1★）：中国站/AFTN 通道报尾带 `=`、tgftp 与 aviationweather 通道不带——
  // 传输层惯例而非报文结构，剥离后不进 IR（span 只到末组电码；report.raw 仍原文保真）。
  // 只剥报尾（含贴末组 `6000=` 与独立 `=` 两种真实形态）；中串 `=` 属传输磨损而非终止符，不剥。
  const body = raw.replace(/[=\s]+$/, "");
  const tokens = tokenize(body);
  const warnings: ParseWarning[] = [];
  let i = 0;
  const peek = (ahead = 0): Token | undefined => tokens[i + ahead];

  let amended = false;
  let corrected = false;

  // —— 电头（A4）：TAF 类型词可省；AMD/COR 在站名前不写死相对序（WMO/ICAO 与美式槽位并存）
  if (peek()?.text === "TAF") i += 1;
  for (let guard = 0; guard < 4; guard++) {
    const t = peek();
    if (t === undefined) break;
    if (t.text === "AMD") {
      if (amended) {
        warnings.push({
          code: "duplicate-group",
          severity: "warning",
          message: "电头 AMD 重复出现——首枚已置修订位，重复枚出声不静默",
          span: spanOf(t),
        });
      }
      amended = true;
      i += 1;
    } else if (t.text === "COR") {
      if (corrected) {
        warnings.push({
          code: "duplicate-group",
          severity: "warning",
          message: "电头 COR 重复出现——首枚已置更正位，重复枚出声不静默",
          span: spanOf(t),
        });
      }
      corrected = true;
      i += 1;
    } else break;
  }

  const stTok = peek();
  if (stTok === undefined || !STATION_PATTERN.test(stTok.text)) {
    throw new MetarParseError(
      "missing-station",
      raw,
      `无法识别站名组——输入不是 TAF 报文（${stTok?.text ?? "空输入"}）`,
    );
  }
  const station: string = stTok.text;
  i += 1;

  const tmTok = peek();
  const tm = tmTok !== undefined ? ISSUE_TIME_PATTERN.exec(tmTok.text) : null;
  if (tmTok === undefined || tm === null) {
    throw new MetarParseError(
      "missing-time",
      raw,
      `无法识别发布时组——输入不是完整的 TAF 报文（${tmTok?.text ?? "时组缺失"}）`,
    );
  }
  const day = Number(tm[1]);
  const hour = Number(tm[2]);
  const minute = Number(tm[3]);
  if (day < 1 || day > 31 || hour > 23 || minute > 59) {
    throw new MetarParseError(
      "invalid-time",
      raw,
      `发布时组数值越界（${tmTok.text}）——日 01–31 / 时 00–23 / 分 00–59`,
    );
  }
  const issueTime = { day, hour, minute };
  i += 1;

  // COR 时组后位（A4 序列第二槽位：中国 AFTN/ICAO 惯例；美式 COR 在类型词位已在上方消费）
  const corAfterTime = peek();
  if (corAfterTime !== undefined && corAfterTime.text === "COR") {
    if (corrected) {
      warnings.push({
        code: "duplicate-group",
        severity: "warning",
        message: "COR 更正位重复出现（类型词位已置）——重复枚出声不静默",
        span: spanOf(corAfterTime),
      });
    }
    corrected = true;
    i += 1;
  }

  // —— 有效期组 ddHH/ddHH（NIL 占位属 A2/1.3，届时在此分叉）
  const vTok = peek();
  const v = vTok !== undefined ? VALIDITY_PATTERN.exec(vTok.text) : null;
  if (vTok === undefined || v === null) {
    throw new MetarParseError(
      "missing-validity",
      raw,
      `无法识别有效期组——TAF 发布时组后须为 ddHH/ddHH（NIL 缺报除外）（${vTok?.text ?? "组缺失"}）`,
    );
  }
  const startDay = Number(v[1]);
  const startHour = Number(v[2]);
  const endDay = Number(v[3]);
  const endHour = Number(v[4]);
  if (
    startDay < 1 ||
    startDay > 31 ||
    startHour > 23 ||
    endDay < 1 ||
    endDay > 31 ||
    endHour > 24
  ) {
    throw new MetarParseError(
      "invalid-validity",
      raw,
      `有效期组数值越界（${vTok.text}）——日 01–31 / 起时 00–23 / 止时 00–24（24＝午夜合法特例）`,
    );
  }
  const validity: TafValidityGroup = {
    startDay,
    startHour,
    endDay,
    endHour,
    raw: vTok.text,
    span: spanOf(vTok),
  };
  i += 1;

  // —— 正文（批 1 骨架）：一律 unknown-token 出声保原文，后续批次逐组接管
  for (; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === undefined) break;
    warnings.push({
      code: "unknown-token",
      severity: "info",
      message: `TAF 正文组暂未解析（${t.text}）——批 1 骨架覆盖电头与有效期，该组保留原文待后续版本`,
      span: spanOf(t),
    });
  }

  return compactIfEnabled({
    kind: "taf" as const,
    raw,
    station,
    issueTime,
    validity,
    flags: { amended, corrected },
    cavok: false,
    remarks: [],
    warnings,
  });
}

/**
 * Result-style variant of `parseTaf` (same contract as `tryParse`): whole-report failures come back
 * as `{ ok:false, error }`; unexpected non-MetarParseError exceptions still throw.
 * parseTaf 的问题式变体（契约同 tryParse）：整体失败返回 { ok:false, error }；
 * 仅编程性意外（非 MetarParseError 的内部异常）原样抛出——不吞实现缺陷。
 */
export type TryParseTafResult =
  | { readonly ok: true; readonly report: TafReport }
  | { readonly ok: false; readonly error: MetarParseError };

export function tryParseTaf(raw: string, options?: TafParseOptions): TryParseTafResult {
  try {
    return { ok: true, report: parseTaf(raw, options) };
  } catch (err) {
    if (err instanceof MetarParseError) return { ok: false, error: err };
    throw err;
  }
}
