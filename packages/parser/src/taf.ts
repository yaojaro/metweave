/**
 * @metweave/parser — TAF 解析层（FM 51，v0.2 批 1 骨架）。
 * The TAF parsing layer (FM 51): header + validity skeleton.
 *
 * 批 1 范围：电头 token 序列（清单 A4——TAF 词可省（剥词源同理）、AMD/COR 不写死槽位、
 * COR 时组后位）、发布时组 ddHHMMZ、有效期组 ddHH/ddHH（止时 24 = 午夜合法特例）、
 * 传输层终止符 `=` 剥离（A1）、NIL/CNL 位置判别（A2）、AAA/CCA 族仅容错（A3）、
 * 基况段四要素 + CAVOK（复用 groups 共享件，组装语义沿 METAR）。
 * 变化组与气温组（批 2/3.4）界后 token 暂一律 unknown-token 出声（不静默纪律）。
 * 纪律与 METAR 侧同源：不静默、span 保真、错误码只增不改（ParseError 别名自 v0.2 起）。
 */
import { MetarParseError } from "@metweave/core";
import type {
  CloudCondition,
  CloudElement,
  ParseWarning,
  SkyClearCode,
  Span,
  TafParseOptions,
  TafReport,
  TafValidityGroup,
  WeatherGroup,
} from "@metweave/core";
import {
  applyVisibilityToken,
  cloudLayerElementOf,
  compactNode,
  isSkyClear,
  observedWeatherOf,
  parseVisibilityToken,
  parseWindToken,
  spanOf,
  tokenize,
  tryWeatherToken,
  validateWindGroup,
  verticalVisibilityElementOf,
  warnDuplicateGroup,
  type Token,
} from "./groups";

const STATION_PATTERN = /^[A-Z0-9]{4}$/;
const ISSUE_TIME_PATTERN = /^(\d{2})(\d{2})(\d{2})Z$/;
const VALIDITY_PATTERN = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/;

/** 基况段右界（批 2/3.4 接管前的停靠点）：变化组 FM####/BECMG/TEMPO/PROB30|40 与气温组 TX/TN */
const isChangeBoundary = (text: string): boolean =>
  /^FM\d{4}$/.test(text) ||
  text === "BECMG" ||
  text === "TEMPO" ||
  /^PROB[34]0$/.test(text) ||
  text.startsWith("TX") ||
  text.startsWith("TN");

/**
 * 有效期时长（小时）＝有效期组差值（清单 B1★）：`(止日−起日)×24 + (止时−起时)`，
 * **只看有效期组，禁用发布钟点**（钟点 03/09/15/21Z 与版本解耦、代际切换——taf-tac §3.1 v1.2）。
 * 止时 24（B2 午夜特例）自然进算术；起日 > 止日（B3 跨月回绕）按所跨月长度回绕天数——
 * 有效期组不含月信息，缺省按 31 天（保守缺省），带月锚的精确回绕由展开层（B3）负责。
 * 注意：wrapDaysInMonth 须 ≥ 起日（2 月锚 + 31 日组属不自洽输入，算术结果为负由调用方甄别）。
 */
export function tafDurationHours(validity: TafValidityGroup, wrapDaysInMonth = 31): number {
  const dayDiff =
    validity.endDay >= validity.startDay
      ? validity.endDay - validity.startDay
      : validity.endDay + wrapDaysInMonth - validity.startDay;
  return dayDiff * 24 + (validity.endHour - validity.startHour);
}

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

  // —— A2★ NIL（其一）：站名后直接 NIL（实测无时组形态 `TAF ZSAM NIL=`，教材 §2）＝缺报。
  // 最小形态与 METAR 侧 NIL 同语义：无有效期、无正文；其后零期待，多余 token 出声不静默
  if (peek()?.text === "NIL") {
    i += 1;
    collectTailAsUnknown(tokens, i, warnings);
    return compactIfEnabled({
      kind: "taf" as const,
      raw,
      station,
      nil: true,
      flags: { amended, corrected },
      cavok: false,
      remarks: [],
      warnings,
    });
  }

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

  // —— A3★ AAA/CCA 族仅容错（AP-117 第三十条自有形态：修订加注 AAA/AAB、更正加注 CCA/CCB，
  // 出现在发布时组后如 `160000Z AAA`）。主解析路径不支持——824 万条三语料实测 0 出现
  // （2026-09-14 精读核对已入档，公开通路走 ICAO 惯例 TAF AMD / 时组后 COR）——
  // 消费放行不报错，按族置位（A 族→amended、C 族→corrected）+ 出声（非主路径形态须可观测）
  for (let guard = 0; guard < 2; guard++) {
    const annotation = peek();
    if (annotation === undefined || !/^(AAA|AAB|CCA|CCB)$/.test(annotation.text)) break;
    if (annotation.text.startsWith("A")) amended = true;
    else corrected = true;
    i += 1;
    warnings.push({
      code: "invalid-format",
      severity: "info",
      message: `AP-117 加注形态（${annotation.text} 于发布时组后——主路径为 TAF AMD/时组后 COR，条文自有形态已消费并按族置位）`,
      span: spanOf(annotation),
    });
  }

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

  // —— 有效期组 ddHH/ddHH
  const vTok = peek();
  // —— A2★ NIL（其二）：带时组形态的 NIL 占**有效期组位**＝缺报（同上最小形态，时组凭据保留）
  if (vTok?.text === "NIL") {
    i += 1;
    collectTailAsUnknown(tokens, i, warnings);
    return compactIfEnabled({
      kind: "taf" as const,
      raw,
      station,
      issueTime,
      nil: true,
      flags: { amended, corrected },
      cavok: false,
      remarks: [],
      warnings,
    });
  }
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

  // —— A2★ CNL：占**风组位**（有效期之后）＝预报取消——有效期保留（发布与覆盖窗信息不丢），
  // 正文到此截断；其后零期待，多余 token 出声。CNL 出现在有效期位属结构违规 → missing-validity
  if (peek()?.text === "CNL") {
    i += 1;
    collectTailAsUnknown(tokens, i, warnings);
    return compactIfEnabled({
      kind: "taf" as const,
      raw,
      station,
      issueTime,
      validity,
      cancelled: true,
      flags: { amended, corrected },
      cavok: false,
      remarks: [],
      warnings,
    });
  }

  // —— 基况段（1.5）：有效期后、首个变化组/气温组前——风/能见度/天气/云（含 NSC 晴空词族）
  // 四要素 + CAVOK。组装语义沿 METAR 侧（重复组 last-wins 出声、缺测不顶替在场值、
  // 三态 Observed、span 保真）；TAF 无 RVR/温露对/QNH/RMK/NOSIG（教材 §1 电码格式）——
  // 此类组落入 unknown-token 出声。变化组/气温组（FM####/BECMG/TEMPO/PROB/TX/TN）属批 2/3.4：
  // 停在界上，其后暂一律 unknown-token。
  let wind: TafReport["wind"];
  let visibility: TafReport["visibility"];
  let weather: TafReport["weather"];
  const weatherList: WeatherGroup[] = [];
  let directionalAsPrimary = false;
  const cloudElements: CloudElement[] = [];
  let clearCode: { code: SkyClearCode; span: Span } | undefined;
  let cavok = false;
  let cavokSpan: Span | undefined;

  for (; i < tokens.length;) {
    const t = tokens[i];
    if (t === undefined || isChangeBoundary(t.text)) break;
    const text = t.text;

    if (text === "CAVOK") {
      // CAVOK 三关让位契约同 METAR（vis/weather/clouds 让位为省略态，词位以 cavokSpan 标记）；
      // 前序矛盾交叉校验（cavokCrossCheck）为 METAR 三态快照工具，TAF 侧语义待批 2 变化组接入后统一
      cavok = true;
      cavokSpan = spanOf(t);
      visibility = undefined;
      directionalAsPrimary = false;
      weather = undefined;
      weatherList.length = 0;
      cloudElements.length = 0;
      clearCode = undefined;
      i += 1;
      continue;
    }

    const windParsed = parseWindToken(t, tokens[i + 1]);
    if (windParsed !== null) {
      if (wind !== undefined) warnDuplicateGroup(raw, warnings, "风组", wind.span, spanOf(t));
      if (windParsed === "missing") {
        // 缺测电码不顶替在场值（同 METAR：零信息量缺测按 last-wins 覆盖真实值是纯信息损失）
        if (wind === undefined) {
          wind = { kind: "missing", span: spanOf(t) };
          warnings.push({
            code: "missing-expected",
            severity: "info",
            message: `风组缺测（${t.text}）`,
            span: spanOf(t),
          });
        }
        i += 1;
      } else {
        const applied = validateWindGroup(t, windParsed, raw);
        wind = applied.wind;
        warnings.push(...applied.warnings);
        i += windParsed.consumed;
      }
      continue;
    }

    const visParsed = parseVisibilityToken(t, tokens[i + 1]);
    if (visParsed !== null) {
      const applied = applyVisibilityToken(
        t,
        visParsed,
        { visibility, directionalAsPrimary },
        raw,
        warnings,
      );
      visibility = applied.visibility;
      directionalAsPrimary = applied.directionalAsPrimary;
      i += visParsed.consumed;
      continue;
    }

    const weatherParsed = tryWeatherToken(t, weatherList, []);
    if (weatherParsed !== false) {
      if (weatherParsed.outOfOrder) {
        warnings.push({
          code: "invalid-format",
          severity: "warning",
          message: `天气组语序不合电码表（${text}：描述符须先于现象）——已按切解结果收下`,
          span: spanOf(t),
        });
      }
      if (weatherParsed.signWithVc) {
        warnings.push({
          code: "invalid-format",
          severity: "info",
          message: `强度符与 VC 邻近指示并存（${text}——强度符不与 VC 同组）——已按切解结果收下`,
          span: spanOf(t),
        });
      }
      i += 1;
      continue;
    }

    if (text === "//") {
      weather = { kind: "missing", span: spanOf(t) };
      warnings.push({
        code: "missing-expected",
        severity: "info",
        message: "天气组缺测（//，无法观测天气）",
        span: spanOf(t),
      });
      i += 1;
      continue;
    }

    const cloudElem = cloudLayerElementOf(t, warnings);
    if (cloudElem !== null) {
      cloudElements.push(cloudElem);
      i += 1;
      continue;
    }
    const vvElem = verticalVisibilityElementOf(t, warnings);
    if (vvElem !== null) {
      cloudElements.push(vvElem);
      i += 1;
      continue;
    }
    if (isSkyClear(text)) {
      clearCode = { code: text, span: spanOf(t) };
      cloudElements.length = 0;
      i += 1;
      continue;
    }

    warnings.push({
      code: "unknown-token",
      severity: "info",
      message: `TAF 基况段未识别组（${text}）——TAF 无此组位（RVR/温露对/QNH/RMK 属 METAR 语汇），保留原文`,
      span: spanOf(t),
    });
    i += 1;
  }

  // 变化组/气温组界之后的 token：批 2/3.4 接管前一律 unknown-token 出声
  collectTailAsUnknown(tokens, i, warnings);

  const clouds: CloudCondition | undefined =
    cloudElements.length > 0 || clearCode !== undefined
      ? { elements: [...cloudElements], ...(clearCode !== undefined ? { clear: clearCode } : {}) }
      : undefined;

  return compactIfEnabled({
    kind: "taf" as const,
    raw,
    station,
    issueTime,
    validity,
    flags: { amended, corrected },
    wind,
    visibility,
    weather: weather ?? observedWeatherOf(weatherList),
    clouds,
    cavok,
    cavokSpan,
    remarks: [],
    warnings,
  });
}

/** NIL/CNL/批 1 骨架共用的尾部处理：剩余 token 一律 unknown-token 出声（不静默纪律） */
function collectTailAsUnknown(
  tokens: readonly Token[],
  from: number,
  warnings: ParseWarning[],
): void {
  for (let k = from; k < tokens.length; k++) {
    const t = tokens[k];
    if (t === undefined) break;
    warnings.push({
      code: "unknown-token",
      severity: "info",
      message: `TAF 正文组暂未解析（${t.text}）——批 1 骨架覆盖电头与有效期，该组保留原文待后续版本`,
      span: spanOf(t),
    });
  }
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
