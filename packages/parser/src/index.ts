/**
 * @metweave/parser — 解析层：METAR/SPECI（tolerant）→ IR；TAF（FM 51）自 v0.2 起同入口供给（./taf）。
 * The parsing layer: METAR/SPECI (tolerant mode) → IR; TAF (FM 51) served from the same entry since v0.2 (./taf).
 *
 * v0.1 实现范围：METAR 正文 + 趋势组半结构化 + RMK 认组 + 跑道状态最小形。
 * v0.2 批 1 起：TAF 电头与有效期骨架（基况段/变化组随后续批次），组级纯函数共享层在 ./groups。
 * 纪律：不静默——看不懂的 token 一律进 warnings[]（unknown-token，info 级），绝不丢弃；
 * 缺测电码（////、/////KT、//）与不可信值（5 位数 QNH）→ Observed missing + 告警；
 * 单位跟组走；一切产物携带原文 span。strict 模式预留给报文校验场景。
 */
import type {
  AltimeterReading,
  CloudCondition,
  CloudElement,
  MetarReport,
  WindShearGroup,
  Observed,
  ParseOptions,
  ParseWarning,
  RemarkGroup,
  ReportKind,
  RunwayStateGroup,
  RunwayVisualRange,
  Span,
  TemperatureReading,
  TrendGroup,
  VisibilityGroup,
  WeatherGroup,
  WindGroup,
} from "@metweave/core";
import { MetarParseError } from "@metweave/core";

// IR 类型就近供给：本包 API 的返回/告警类型即 core 的 IR 类型（唯一来源在 core，此处仅转发）——
// 免去消费方猜测「parse 的返回类型去哪 import」（2026-09-16 五方实测评测反馈）
export type {
  AltimeterReading,
  CloudCondition,
  CloudElement,
  MetarReport,
  Observed,
  ParseWarning,
  ReportKind,
  RunwayStateGroup,
  RunwayVisualRange,
  Span,
  TafChangeAt,
  TafChangeGroup,
  TafChangeKind,
  TafChangeWindow,
  TafParseOptions,
  TafTemperatureGroup,
  TafReport,
  TafValidityGroup,
  TemperatureReading,
  TrendElements,
  TrendGroup,
  TrendKind,
  VisibilityGroup,
  WeatherGroup,
  WindGroup,
} from "@metweave/core";
// TAF 解析层（v0.2 批 1 起）：parseTaf / tryParseTaf 与其结果类型——与 parse 同入口供给
export { parseTaf, tafDurationHours, tryParseTaf } from "./taf";
export type { TryParseTafResult } from "./taf";
// TAF 时间线展开器（v0.2 批 2.3 起）：五步算法的派生层（B4–B7）
export { expandTaf, tafSegments } from "./expand";
// TAF 判据校验层（v0.2 补齐批）：C2/C3/C5/C7 四判据——解析期移交至此的条文判据收口
export { validateTaf } from "./validate";
export type {
  TafValidateOptions,
  TafValidateStandard,
  TafViolation,
  TafViolationCode,
} from "./validate";
export type {
  TafExpandAt,
  TafExpansion,
  TafMonthAnchor,
  TafResolvedConditions,
  TafSegmentRow,
  TafTempoOverlay,
} from "./expand";
import {
  TREND_KINDS,
  VIS_V_RANGE,
  TX_TN_PATTERN,
  M_WIND,
  M_VIS,
  M_R,
  M_WEATHER,
  M_CLOUD,
  M_VV,
  M_SKY_CLEAR,
  M_TEMP,
  M_QNH,
  M_ALTIMETER_A,
  M_VIS_RANGE,
  M_DOLLAR,
  M_WS_RWY,
  maskOf,
  isSkyClear,
  tokenize,
  spanOf,
  compactNode,
  tryWeatherToken,
  parseVisibilityToken,
  parseWindToken,
  parseTempDewToken,
  parseRvrToken,
  parseRunwayStateToken,
  warnDuplicateGroup,
  applyAltimeterReading,
  parseQnhToken,
  parseAltimeterAToken,
  validateWindGroup,
  applyVisibilityToken,
  applyTempDewToken,
  warnTrendClose,
  collectTrendSegment,
  buildTrendGroup,
  cloudLayerElementOf,
  verticalVisibilityElementOf,
  parseWindShearSequence,
  applyRvrNoBodyToken,
  warnRvrNoThenValues,
  applyRvrSlashToken,
  observedWeatherOf,
  cavokCrossCheck,
  parseRemarkSegment,
} from "./groups";
import type { Token } from "./groups";
export { TEMP_DEW_PATTERN } from "./groups";

/**
 * Parse one METAR/SPECI report (tolerant mode) into the IR — the package's single entry.
 * 解析单条 METAR/SPECI 报文（tolerant）为 IR——本包唯一入口。
 *
 * Throws MetarParseError (stable machine-readable `code`) on whole-report failure
 * (non-string input / missing station / missing time / invalid time / unsupported mode); anything the
 * parser does not recognize lands in `warnings[]` with its span — never dropped.
 * 整体失败（输入非字符串/无站名/无时组/时组越界/未实现模式）抛 MetarParseError（code 稳定契约）；
 * 看不懂的组带 span 进 warnings[]，绝不丢弃。
 * @param raw - Report text, verbatim (kept on report.raw). 报文原文（原样保真于 report.raw）。
 * @param options - See ParseOptions (kind override, compact spans). 见 ParseOptions（类型位注入、紧凑模式）。
 */
export function parse(raw: string, options?: ParseOptions): MetarReport {
  // 紧凑模式（E1）：spans === false 时在出口以重建式剥除全部 span（见 compactNode 注释）
  const compact = options?.spans === false;
  const compactIfEnabled = <T>(report: T): T => (compact ? compactNode(report) : report);
  // 输入校验：非字符串走 MetarParseError 稳定契约（code: "invalid-input"）——code 是
  // 消费方分流的稳定面、EN_MESSAGES 查表英化的键，裸 Error 会同时绕过两者（此前为裸 Error）
  if (typeof raw !== "string") {
    throw new MetarParseError(
      "invalid-input",
      String(raw),
      `parse 需要一个 METAR/SPECI 报文字符串，收到 ${raw === null ? "null" : typeof raw}`,
    );
  }
  if ((options?.mode ?? "tolerant") === "strict") {
    // 错误面契约：strict 留在类型上（路线图项），但 v0.1 未实现——调用方 catch 不漏接裸 Error
    throw new MetarParseError(
      "unsupported-mode",
      raw,
      "METAR 侧 strict 模式尚未实现（TAF 侧 parseTaf 已支持 strict）——请省略 mode 或显式传 'tolerant'",
    );
  }
  const warnings: ParseWarning[] = [];
  // 报尾 = 终结符剥离（GTS/AFTN 通路报文行以 = 定界，常粘连末组如 Q1006= / NOSIG=）——
  // 仅剥尾部空白与 =，正文 token 偏移不变，span 仍对应原 raw（raw 保真含 =）。
  // 末字符预判（E2 性能项）：语料大头无报尾，尾字符既非 = 也非空白时跳过整串正则——
  // 预判用单字符 \s 测试（与 [\s=] 字符类完全同域，行为等价），省一次全文回溯扫描
  const tail = raw.at(-1);
  const body =
    tail === undefined || tail === "=" || /\s/.test(tail) ? raw.replace(/[\s=]+$/, "") : raw;
  const tokens = tokenize(body);
  // 输入规模护栏（只告警不截断——截断破坏 raw 保真与「不丢弃」纪律）：语料单行最大 30 token，
  // 上限 128 = 4 倍余量；超限报文照常完整解析，仅以一条聚合告警标记异常输入
  //（span 缺省 = 报文级；整体失败路径不经过此处，失败契约不受影响）
  const TOKEN_COUNT_LIMIT = 128;
  if (tokens.length > TOKEN_COUNT_LIMIT) {
    warnings.push({
      code: "invalid-format",
      severity: "warning",
      message: `输入 token 数超上限（${tokens.length} > ${TOKEN_COUNT_LIMIT}）——按异常输入标记，解析照常完整，原文经 raw 保真`,
    });
  }
  let i = 0;
  const peek = (ahead = 0): Token | undefined => tokens[i + ahead];

  const externalKind = options?.kind;
  let kind: ReportKind = externalKind ?? "metar";
  let corrected = false;
  let auto = false;

  // —— 头部：类型词 / COR（WMO 形态）/ 站名 / 时组 / AUTO / COR（美式时组后形态）
  const head = peek();
  if (head !== undefined && (head.text === "METAR" || head.text === "SPECI")) {
    if (externalKind === undefined) kind = head.text === "SPECI" ? "speci" : "metar";
    i += 1; // 类型词 token 无论由谁决定 kind 都要消费
  }
  if (peek()?.text === "COR") {
    corrected = true;
    i += 1;
  }
  // AMD（修订发布标志，部分 CAA 用于 METAR 标题位，TAF 更常见）：标题元数据词，
  // 语义为「本报告取代此前发布」——消费之不进站名位；是否置 corrected 不越权代判
  //（修订 ≠ 更正），IR 无 amended 位故仅放行不标注
  if (peek()?.text === "AMD") {
    i += 1;
  }
  const stTok = peek();
  if (stTok === undefined || !/^[A-Z0-9]{4}$/.test(stTok.text)) {
    // 契约：无站名组 = 整体解析失败（不是字段级三态）；code 是稳定契约，message 中文为权威
    // 文案——英文经 @metweave/core EN_MESSAGES[code] 查表或渲染层 locale:"en" 切换
    throw new MetarParseError(
      "missing-station",
      raw,
      `无法识别站名组——输入不是 METAR/SPECI 报文（${stTok?.text ?? "空输入"}）`,
    );
  }
  const station: string = stTok.text;
  i += 1;
  // CCA/CCB/CCC 与 COR 槽位磨损兜底（站名后/时组前——规范槽位：BBB 系列在时组后（见下方
  // BBB 消费位）、COR 在类型词位（见报头 COR 位））：部分 feed 的更正标记出现在此槽——此前
  // 直接 throw missing-time，「合法更正报整体失败」是最恶性失败模式。后随 token 为合法时组时
  // 消费放行并置 corrected + 出声（槽位漂移本身须可观测——不静默，2026-09-14 独立复评补
  // COR 对称缺口与出声）；后随非时组则照旧走 missing-time。已知留案：标记若出现在 AUTO
  // 之前的其他相对序（如 CCA AUTO），AUTO 会落正文 unknown——语料无实证，暂不设防
  const driftTok = peek();
  if (driftTok !== undefined && /^(CC[A-Z]|COR)$/.test(driftTok.text)) {
    const afterDrift = peek(1);
    if (afterDrift !== undefined && /^\d{2}\d{2}\d{2}Z$/.test(afterDrift.text)) {
      corrected = true;
      i += 1;
      warnings.push({
        code: "invalid-format",
        severity: "info",
        message: `更正标记槽位漂移（${driftTok.text} 出现在站名后/时组前——已消费并置更正标志）`,
        span: spanOf(driftTok),
      });
    }
  }
  const tmTok = peek();
  const tm = tmTok !== undefined ? /^(\d{2})(\d{2})(\d{2})Z$/.exec(tmTok.text) : null;
  if (tmTok === undefined || tm === null) {
    throw new MetarParseError(
      "missing-time",
      raw,
      `无法识别时组——输入不是完整的 METAR/SPECI 报文（${tmTok?.text ?? "时组缺失"}）`,
    );
  }
  const time: MetarReport["time"] = {
    day: Number.parseInt(tm[1] ?? "0", 10),
    hour: Number.parseInt(tm[2] ?? "0", 10),
    minute: Number.parseInt(tm[3] ?? "0", 10),
  };
  // 契约：时组为两态必填（无缺测形态，无 Observed）——数值越界即不可信时组，等同无效时组整体失败，
  // 绝不把假值（日 99、时 24、分 60）留在 IR（同 Q10054 脏 QNH 的「值不可信」纪律，时组无处判缺测故整体失败）
  if (time.day < 1 || time.day > 31 || time.hour > 23 || time.minute > 59) {
    throw new MetarParseError(
      "invalid-time",
      raw,
      `时组数值越界（${tmTok.text}：须日 01–31 / 时 00–23 / 分 00–59）——输入不是完整的 METAR/SPECI 报文`,
    );
  }
  i += 1;
  if (peek()?.text === "AUTO") {
    auto = true;
    i += 1;
  }
  if (peek()?.text === "COR") {
    corrected = true;
    i += 1;
  }
  // RRA/RRB/RRC 迟到报标记（AP-117-TM-01R2 第 21 条：报头时间组后）——标题元数据，消费放行
  if (/^RR[ABC]$/.test(peek()?.text ?? "")) {
    i += 1;
  }
  // CCA/CCB/CCC 更正指示符（WMO FM15 §1.3.3 BBB 系列：第一次更正 CCA、第二次 CCB 顺延；
  // 规范槽位即本位——时组后。加拿大 NAV CANADA 明文采用，中国 AFTN 实务沿用；仓库声明的
  // 编码基准含 MANOPS-MET）。语义即更正报——与 COR 同义异位（COR 在类型词位、BBB 在时组后位），
  // 消费并置 corrected；此前落 unknown-token，更正语义丢失（2026-09-14 复评：基准内形态未实现）
  if (/^CC[A-Z]$/.test(peek()?.text ?? "")) {
    corrected = true;
    i += 1;
  }

  // —— NIL：台站无观测（FM15 代码形注 2 的 NIL 码词；§15.4 是 AUTO 条款）——最小形态：站名/时组凭据保留，正文组不解析（本就无正文），零告警
  if (peek()?.text === "NIL") {
    return compactIfEnabled({
      kind,
      raw,
      nil: true,
      station,
      time,
      flags: { auto, corrected },
      cavok: false,
      trends: [],
      runwayStates: [],
      remarks: [],
      warnings,
    });
  }

  // —— 正文状态
  let cavok = false;
  let cavokSpan: Span | undefined;
  let wind: Observed<WindGroup> | undefined;
  let visibility: Observed<VisibilityGroup> | undefined;
  // 脱离主导能见度的方向组被按主导收下的局部标记（见正文循环方向组分支注释；非 IR 字段）
  let directionalAsPrimary = false;
  let rvr: Observed<readonly RunwayVisualRange[]> | undefined;
  const rvrList: RunwayVisualRange[] = [];
  // 多组 RVR 的组级 span 首组至末组（与天气组同口径——单组 span 在各自元素上）
  let rvrSpan: Span | undefined;
  let weather: Observed<readonly WeatherGroup[]> | undefined;
  const weatherList: WeatherGroup[] = [];
  const recentList: WeatherGroup[] = [];
  let clouds: CloudCondition | undefined;
  let cloudSeen = false;
  const cloudElements: CloudElement[] = [];
  let clearCode: CloudCondition["clear"];
  let temperature: TemperatureReading | undefined;
  let dewpoint: TemperatureReading | undefined;
  let altimeter: AltimeterReading | undefined;
  // 双气压组口径（tolerant 惯例）：末组为准（保持既有 last-wins 行为），重复组追加 info 告警不静默
  let altimeterSeen = false;
  const trends: TrendGroup[] = [];
  const runwayStates: RunwayStateGroup[] = [];
  const remarks: RemarkGroup[] = [];
  // 重复组口径（与双气压组同款 tolerant 惯例）：末组为准（保持既有 last-wins 行为），
  // 重复组出声不静默——专用码 duplicate-group（2026-09-15 五角色评测定案：此前借用
  // cross-check-conflict+info，消费方无法按「重复」分流；severity 升 warning）。
  // 前值后值原文都进 message：last-wins 会覆盖 IR 里的前值 span，前值唯一可回溯通道就是这条告警
  // 风切变组累积器（同报多组 WS 合一：runways 连接、span 首组至末组）
  let windShear: WindShearGroup | undefined;
  let wsRunways: string[] | undefined;
  let wsAll = false;
  let wsSpan: Span | undefined;

  // —— 正文循环（RMK 交段外处理）
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === undefined) break;
    const text = t.text;

    if (text === "RMK") {
      i += 1;
      break;
    }
    // RMK 磨损粘连（RMKQFE749/0998 = RMK 与后组丢空格，fuzz 实弹 35/5 万例命中）：进 RMK 段
    // 但不跳过 token 本身——由 RMK 段按认组粒度收下（多为 unknown，raw 保真不蒸发）
    if (text.startsWith("RMK")) {
      break;
    }

    // 趋势指示组：NOSIG / BECMG / TEMPO（吞到下一个指示组、RMK 或结尾）
    if (TREND_KINDS.has(text)) {
      const kindText = text;
      const collected: Token[] = [t];
      i += 1;
      let period: TrendGroup["period"];
      const periodTok = peek();
      if (
        kindText !== "NOSIG" &&
        periodTok !== undefined &&
        // 时段词双形态：AT/TL/FM+DDHH（WMO 306 FM15 §15.14.3）与 DDHH/DDHH 斜杠时段
        //（ICAO Annex 3 模板 / 中国民航主流编法，2026-09-16 五方实测评测发现的缺失形态）
        (/^(?:AT|FM|TL)\d{4}$/.test(periodTok.text) || /^\d{4}\/\d{4}$/.test(periodTok.text))
      ) {
        period = { text: periodTok.text, span: spanOf(periodTok) };
        collected.push(periodTok);
        i += 1;
      }
      // 收口语义见 isTrendCollectible：仅趋势合法要素族可收，其余收口交回正文（warnTrendClose 出声）
      i = collectTrendSegment(tokens, i, collected);
      warnTrendClose(tokens, i, warnings);
      trends.push(
        buildTrendGroup(
          kindText === "NOSIG" ? "nosig" : kindText === "BECMG" ? "becmg" : "tempo",
          period,
          collected,
          period !== undefined ? 2 : 1,
        ),
      );
      continue;
    }

    // 指示组缺失趋势段两形态——传输磨损所致（WMO 306 FM15 §15.14.3 时段词 AT/TL/FM 不得脱离指示组）：
    // ①粘连——指示组与时段词丢空格（BECMGTL0350，IEM 归档实弹 10 次）：宽容拆分，语义完整可恢复；
    // ②裸时段词——指示组整组丢失（Q1009 TL0730 …，IEM 归档实弹 128 次）：按 kind 'unspecified'
    //   收段（要素组不再散落正文——尤其防趋势风组以 last-wins 覆盖正文真风组），告警标注指示组不可辨。
    //   NOSIG 粘连不拆（NOSIG 语义上不配时段词）；标准位置的时段词已在上方指示组分支内消费，此处不重复触达。
    if (
      (text.length === 6 &&
        (text.charCodeAt(0) === 65 || text.charCodeAt(0) === 84 || text.charCodeAt(0) === 70)) ||
      text.startsWith("BECMG") ||
      text.startsWith("TEMPO")
    ) {
      const fused = /^(BECMG|TEMPO)((?:AT|TL|FM)\d{4}|\d{4}\/\d{4})$/.exec(text);
      if (fused !== null) {
        const indicator = fused[1] ?? "";
        const collected: Token[] = [t];
        i += 1;
        i = collectTrendSegment(tokens, i, collected);
        warnTrendClose(tokens, i, warnings);
        trends.push(
          buildTrendGroup(
            indicator === "BECMG" ? "becmg" : "tempo",
            {
              text: text.slice(indicator.length),
              span: { start: t.start + indicator.length, end: t.end },
            },
            collected,
            1,
          ),
        );
        warnings.push({
          code: "invalid-format",
          severity: "info",
          message: `趋势指示组与时段词粘连（${text}——传输磨损丢空格，BECMG/TEMPO 与 AT/TL/FM 时段语义完整可恢复）`,
          span: spanOf(t),
        });
        continue;
      }
      if (/^(AT|TL|FM)\d{4}$/.test(text)) {
        const collected: Token[] = [t];
        i += 1;
        i = collectTrendSegment(tokens, i, collected);
        warnTrendClose(tokens, i, warnings);
        trends.push(buildTrendGroup("unspecified", { text, span: spanOf(t) }, collected, 1));
        warnings.push({
          code: "invalid-format",
          severity: "warning",
          message: `趋势时段词缺指示组（${text}——§15.14.3 时段词须随 BECMG/TEMPO 出现）——按指示组缺失的趋势段收下，指示组类型不可辨`,
          span: spanOf(t),
        });
        continue;
      }
    }
    // 裸斜杠时段词（1616/1618——ICAO Annex 3 模板 / 中国民航主流趋势时段编法，指示组缺失）：
    // 与 AT/TL/FM 裸词同纪律——kind 'unspecified' 收段出声，要素组不再散落正文
    //（2026-09-16 五方实测评测发现：此前该形态散落正文，趋势能见度以 last-wins 顶掉正文能见度）。
    // 前置守卫（长度 9 + 第 5 字符为斜杠）保正文热路径不为逐 token 正则付费
    if (text.length === 9 && text.charCodeAt(4) === 47 && /^\d{4}\/\d{4}$/.test(text)) {
      const collected: Token[] = [t];
      i += 1;
      i = collectTrendSegment(tokens, i, collected);
      warnTrendClose(tokens, i, warnings);
      trends.push(buildTrendGroup("unspecified", { text, span: spanOf(t) }, collected, 1));
      warnings.push({
        code: "invalid-format",
        severity: "warning",
        message: `趋势时段词缺指示组（${text}——ICAO Annex 3 模板趋势时段须随 BECMG/TEMPO 出现）——按指示组缺失的趋势段收下，指示组类型不可辨`,
        span: spanOf(t),
      });
      continue;
    }

    if (text === "CAVOK") {
      cavok = true;
      cavokSpan = spanOf(t);
      // 交叉校验（三面：能见度/天气/云，判据见 cavokCrossCheck 注）——CAVOK 语义要求能见度
      // ≥10km、无重要天气、5000ft 以下无云且无 CB/TCU；前序组确定矛盾即出声。
      // 下界语义的编码（9999 ≥10km、P6SM >9.6km）与 CAVOK 相容不告警；M 前缀（小于下界）必矛盾。
      // 让位契约照旧（vis/weather/cloud 三组让位），矛盾仅追加 cross-check-conflict 告警
      cavokCrossCheck(
        { cavokSpan, visibility, weatherList, rvr, cloudElements },
        "前序",
        raw,
        warnings,
      );
      // 契约（IR）：CAVOK = 能见度 ≥10km + 无低云 + 无天气，前序 vis/weather/cloud 三组让位为 undefined
      // （让位是契约行为不发告警；词位以 cavokSpan 标记，前序组原码仍可从 raw 回溯）
      visibility = undefined;
      directionalAsPrimary = false;
      weather = undefined;
      weatherList.length = 0;
      cloudSeen = false;
      cloudElements.length = 0;
      clearCode = undefined;
      i += 1;
      continue;
    }

    // E3 性能项——首字符位掩码分流：每轮按首字符一次 switch 得「可能匹配的分支」位集，
    // 各分支先做一次位测试再进正则——不可能匹配的分支零正则尝试。分支相对顺序与原
    // 全试链完全一致（行为等价由全量语料回放快照锁定）。可达首字符推导：
    // 风 V/数字//；能见度 数字//M/P；RVRNO 与 R 组 R；天气 = 现象/描述符首字母
    // （B D F G H I M P R S T U）+ -/+/V（VC）；裸 // 与云 /；云 F/S/B/O//；
    // VV 与 VIS 的 V；晴空词 S/N/C；温露 M/数字//；QNH 的 Q；A 组的 A；维护符 $。
    const mask = maskOf(text.charCodeAt(0));

    // 风（含 /////KT 缺测与 260V050 变化组）
    const windParsed = (mask & M_WIND) !== 0 ? parseWindToken(t, peek(1)) : null;
    if (windParsed !== null) {
      if (wind !== undefined) warnDuplicateGroup(raw, warnings, "风组", wind.span, spanOf(t));
      if (windParsed === "missing") {
        if (wind === undefined) {
          wind = { kind: "missing", span: spanOf(t) };
          warnings.push({
            code: "missing-expected",
            severity: "info",
            // 全缺测 /////KT（自动站假报文形态）与部分缺测（180//KT 风速位缺）同口径出声
            message: t.text.startsWith("/////")
              ? "风组缺测（/////KT，疑似自动站假报文形态）"
              : `风组缺测（${t.text}，风速位缺测）`,
            span: spanOf(t),
          });
        }
        // 已有风组时：缺测电码不顶替在场值（duplicate-group 已出声）——
        // 零信息量的缺测码按 last-wins 覆盖真实观测是纯信息损失（2026-09-15 五角色评测批）
        i += 1;
      } else {
        // 值域门（NaN 终结防线 / >199 上限 / 越界 findings / 阵风缺测 / VRB 变化组并存）
        // 迁至 validateWindGroup——判据与告警顺序见其注释
        const applied = validateWindGroup(t, windParsed, raw);
        wind = applied.wind;
        warnings.push(...applied.warnings);
        i += windParsed.consumed;
      }
      continue;
    }

    // 能见度（//// 显式缺测补 info 告警——对齐风/天气缺测口径；零分母判缺测补超界告警）
    const visParsed = (mask & M_VIS) !== 0 ? parseVisibilityToken(t, peek(1)) : null;
    if (visParsed !== null) {
      // 方向组挂靠/脱离主导、缺测不顶替在场值、零分母判缺测等落位规则迁至 applyVisibilityToken
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

    // RVRNO：RVR 设备存在但明示不可用（显式缺测，区别于组省略）。
    // 正文位与 RMK 位行为统一（2026-09-15 方案一，专业判读定案）：一律进 remarks（kind
    // 'rvr-no'）——站级状态声明 typed 可见，原正文位不留痕的双标消除；RVRNO 单独出现
    //（此前无值组）仍 = rvr 显式缺测（既有 IR 契约不变）。
    // 值组与 RVRNO 并存 = 自相矛盾形态（规范未定义并存）：值组按跑道级明细保留——具体
    // 值组是逐道运行信息、可信度高于无道号的站级状态码（预报员/塔台标准判读；NWS 官方
    // 解码器即「值组 + RVRNO 旗标并存不复算」），矛盾出声、文案描述矛盾本身不预言终态。
    if ((mask & M_R) !== 0 && text === "RVRNO") {
      rvr = applyRvrNoBodyToken(t, rvr, raw, warnings, remarks);
      i += 1;
      continue;
    }

    // RVR 与跑道状态（同为 R 前缀组，先按 RVR 语法试解、再按跑道状态电码试解）
    if ((mask & M_R) !== 0 && text.startsWith("R") && text.includes("/")) {
      const rvrParsed = parseRvrToken(t);
      if (rvrParsed !== null) {
        // 反向次序对称口径：RVRNO 在前、值组在后同样出声（方案一：可解读为传感器恢复，
        // 值组按明细保留——与正序矛盾并存同一文案口径，见 RVRNO 位注释）
        if (rvr?.kind === "missing") {
          warnRvrNoThenValues(t, rvr.span, raw, warnings);
        }
        rvrList.push(rvrParsed);
        const s = spanOf(t);
        rvrSpan = rvrSpan === undefined ? s : { start: rvrSpan.start, end: s.end };
        rvr = { kind: "value", value: [...rvrList], span: rvrSpan };
        i += 1;
        continue;
      }
      const runwayState = parseRunwayStateToken(t);
      if (runwayState !== null) {
        runwayStates.push(runwayState.group);
        for (const finding of runwayState.findings) {
          warnings.push({
            code: "invalid-format",
            severity: "warning",
            message: finding.message,
            span: finding.span,
          });
        }
        i += 1;
        continue;
      }
      // RVR 全斜杠缺测：R## + / + ////（分离符 + 四位值位斜杠 = 5 斜杠，标准缺测形态）。
      // 4 斜杠（R10////）为磨损短一段——按缺测收下，另附 invalid-format info（tgftp/IEM 实弹均见）
      const rvrMissing = applyRvrSlashToken(t, warnings);
      if (rvrMissing !== null) {
        rvr = rvrMissing;
        i += 1;
        continue;
      }
    }

    // 风切变组（WMO 306 FM15 §15.13.3 / ICAO Annex 3 模板）：标准形态 WS ALL RWY（全部跑道）
    // 与 WS R##[RLC]（WS RDRDR，如 WS R24——IEM 归档实弹 544 次、中国区多发且为近月主流形态）。
    // 中国区实务变体 WS RWY##[RLC]（RWY 前缀 + 设计器，教材常用）与 WS RWY ALL（词序倒置）
    // 同样语义无损一等收下——四形态正文组（跑道状态之后、趋势之前）。
    // 低空风切变对起降阶段是重大危害，IR 一等字段不蒸发。
    if ((mask & M_WS_RWY) !== 0 && text === "WS") {
      const wsMatch = parseWindShearSequence(t, peek(1), peek(2));
      if (wsMatch !== null) {
        wsRunways ??= [];
        if (wsMatch.runway !== null) wsRunways.push(wsMatch.runway);
        if (wsMatch.all) wsAll = true;
        wsSpan =
          wsSpan === undefined ? wsMatch.span : { start: wsSpan.start, end: wsMatch.span.end };
        windShear = { runways: wsRunways, allRunways: wsAll, span: wsSpan };
        i += wsMatch.consumed;
        continue;
      }
    }

    // 温度预告组（TAF TX/TN 混入 METAR 通路，IEM 归档实弹 26 次——中国区 TAF 行混入 METAR 流）：
    // TX25/0907Z = 最高 25°C、09 日 07Z 到达（ICAO Annex 3 附录五温度预告组，M 前缀 = 负值）。
    // 认组收下进 remarks（kind 'temperature-forecast'，raw 保真）——TAF 语义不属于 METAR 趋势段，
    // 与既有 temp-extrema-6h/24h 同款认组粒度，不解码数值（RemarkGroup 无值槽，数值化留待后续 additive 扩展）
    const txTnMatch = (mask & M_WEATHER) !== 0 && TX_TN_PATTERN.test(text);
    if (txTnMatch) {
      remarks.push({ kind: "temperature-forecast", raw: text, span: spanOf(t) });
      i += 1;
      continue;
    }

    // 天气组（RE 近期天气一并识别——不参与当前天气三态判定）
    const weatherParsed =
      (mask & M_WEATHER) !== 0 ? tryWeatherToken(t, weatherList, recentList) : false;
    if (weatherParsed !== false) {
      if (weatherParsed.outOfOrder) {
        // 能完整切解但语序反常（描述符在现象之后，如 RATS）：按切解结果收下 + invalid-format 告警，
        // 不静默也不拒收；完全无法切解的仍走下方 unknown-token
        warnings.push({
          code: "invalid-format",
          severity: "warning",
          message: `天气组语序不合电码表（${text}：描述符须先于现象）——已按切解结果收下`,
          span: spanOf(t),
        });
      }
      if (weatherParsed.signWithVc) {
        // 强度符与 VC 并存（-VCTSRA 家族，NWS 自动站实弹）：互斥是明文条款（4678 限定槽
        // 四选一、FAA AIM「Intensity and 'VC' will not appear together」），语义可无损恢复
        //（强度+邻近+现象俱全）故容忍切解收下并出声——此前整体落 unknown-token 语义全丢
        warnings.push({
          code: "invalid-format",
          severity: "info",
          message: `强度符与 VC 邻近指示并存（${text}——强度符不与 VC 同组）——已按切解结果收下`,
          span: spanOf(t),
        });
      }
      if (weatherParsed.intensityMisuse === true) {
        warnings.push({
          code: "invalid-format",
          severity: "info",
          message:
            weatherParsed.kind === "recent"
              ? `RE 近期天气组带强度符（${text}——15.13.2.1 RE 组无强度位）——已收下`
              : `强度符超适用面（${text}——表 4678 注 4：-/+ 仅限降水族，非降水唯 +SS/+FC/+DS）——已收下`,
          span: spanOf(t),
        });
      }
      i += 1;
      continue;
    }

    // 裸 // 天气缺测组（自动站无法观测天气；IR 口径 = weather missing，绝不捏造也不吞进温度组）
    if ((mask & M_WEATHER) !== 0 && text === "//") {
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

    // 云：云量位 /// 与云高 /// 双缺测形态（绝不捏造）——缺测位告警随构造直出（cloudLayerElementOf）
    const cloudElem = (mask & M_CLOUD) !== 0 ? cloudLayerElementOf(t, warnings) : null;
    if (cloudElem !== null) {
      cloudSeen = true;
      cloudElements.push(cloudElem);
      i += 1;
      continue;
    }
    const vvElem = (mask & M_VV) !== 0 ? verticalVisibilityElementOf(t, warnings) : null;
    if (vvElem !== null) {
      cloudSeen = true;
      cloudElements.push(vvElem);
      i += 1;
      continue;
    }
    if ((mask & M_SKY_CLEAR) !== 0 && isSkyClear(text)) {
      cloudSeen = true;
      clearCode = { code: text, span: spanOf(t) };
      i += 1;
      continue;
    }

    // 温度/露点
    const tempParsed = (mask & M_TEMP) !== 0 ? parseTempDewToken(t) : null;
    if (tempParsed !== null) {
      // 重复组/物理极值门/缺测出声/温露倒挂等落位规则迁至 applyTempDewToken
      const applied = applyTempDewToken(t, tempParsed, { temperature, dewpoint }, raw, warnings);
      temperature = applied.temperature;
      dewpoint = applied.dewpoint;
      i += 1;
      continue;
    }

    // 气压：Q（hPa）/ A（inHg，隐含小数点）；5 位数 QNH 与物理范围外值 = 脏值（Q10054 家族）
    const qnhParsed = (mask & M_QNH) !== 0 ? parseQnhToken(t) : null;
    if (qnhParsed !== null) {
      if (qnhParsed.kind === "out-of-range") {
        altimeter = undefined;
        warnings.push({
          code: "value-out-of-range",
          severity: "warning",
          message: qnhParsed.message,
          span: qnhParsed.span,
        });
      } else {
        ({ altimeter, altimeterSeen } = applyAltimeterReading(
          altimeter,
          altimeterSeen,
          qnhParsed.reading,
          raw,
          warnings,
        ));
      }
      i += 1;
      continue;
    }
    const altAParsed = (mask & M_ALTIMETER_A) !== 0 ? parseAltimeterAToken(t) : null;
    if (altAParsed !== null) {
      if (altAParsed.kind === "out-of-range") {
        altimeter = undefined;
        warnings.push({
          code: "value-out-of-range",
          severity: "warning",
          message: altAParsed.message,
          span: altAParsed.span,
        });
      } else {
        ({ altimeter, altimeterSeen } = applyAltimeterReading(
          altimeter,
          altimeterSeen,
          altAParsed.reading,
          raw,
          warnings,
        ));
      }
      i += 1;
      continue;
    }

    // 变化能见度（FAA 正文位形态：主能见度组后跟「VIS 1/4V1/2」变化区间）——
    // IR 建模为 RemarkKind 'variable-visibility'（不占 visibility 槽），与 RMK 段同族同 kind
    if ((mask & M_VIS_RANGE) !== 0 && text === "VIS" && VIS_V_RANGE.test(peek(1)?.text ?? "")) {
      const nextTok = peek(1);
      if (nextTok !== undefined) {
        remarks.push({
          kind: "variable-visibility",
          raw: `${text} ${nextTok.text}`,
          span: { start: t.start, end: nextTok.end },
        });
        i += 2;
        continue;
      }
    }

    // 维护指示符（正文级孤例）
    if ((mask & M_DOLLAR) !== 0 && text === "$") {
      remarks.push({ kind: "maintenance", raw: "$", span: spanOf(t) });
      i += 1;
      continue;
    }

    // 不静默：看不懂的 token 进 warnings，绝不丢弃
    warnings.push({
      code: "unknown-token",
      severity: "info",
      message: `未识别的组（${text}）——已如实收下`,
      span: spanOf(t),
    });
    i += 1;
  }

  // 当前天气组：仅有实组时给值；RE-only 报文 weather 保持 undefined（组省略 ≠ 缺测）——
  // 组级 span 首组至末组的收口规则迁至 observedWeatherOf
  weather = observedWeatherOf(weatherList) ?? weather;
  if (cloudSeen) {
    clouds = { elements: cloudElements, clear: clearCode };
  }

  // CAVOK 词后矛盾校验：词位让位后，其后新出现的能见度/天气/云组若与 CAVOK 语义确定矛盾，
  // 此前静默并存——同三面判据出声（趋势段已被围栏隔离，不会流入此处的正文状态）
  if (cavok) {
    cavokCrossCheck(
      { cavokSpan, visibility, weatherList, rvr, cloudElements },
      "后续",
      raw,
      warnings,
    );
  }

  // 云组自洽（WMO 15.9.2 / 15.9.1）：VV 顶替整个云组、NSC/SKC/NCD/CLR 为无云电码——
  // 与层组并存均互斥矛盾形态，出声不静默（规范外容错照旧收下）
  const hasVvElement = cloudElements.some((e) => e.kind === "vertical-visibility");
  const hasLayerElement = cloudElements.some((e) => e.kind === "layer");
  if (hasVvElement && hasLayerElement) {
    warnings.push({
      code: "cross-check-conflict",
      severity: "warning",
      message: "VV 组与云层组并存（WMO 15.9.2：VV 顶替整个云组）——报文自洽性存疑",
      span: cloudElements[0]?.span,
    });
  }
  if (clearCode !== undefined && hasLayerElement) {
    warnings.push({
      code: "cross-check-conflict",
      severity: "warning",
      message: `${clearCode.code}（无云电码）与云层组并存——互斥形态，报文自洽性存疑`,
      span: clearCode.span,
    });
  }

  // —— RMK 段（认组粒度；未知 ≠ 错误，不进 warnings）——段循环整体迁至 parseRemarkSegment
  const rmk = parseRemarkSegment(tokens, i, raw, remarks, warnings, rvr);
  rvr = rmk.rvr;

  return compactIfEnabled({
    kind,
    raw,
    station,
    time,
    flags: { auto, corrected },
    cavok,
    cavokSpan,
    wind,
    visibility,
    runwayVisualRange: rvr,
    weather,
    recentWeather: recentList.length > 0 ? recentList : undefined,
    clouds,
    temperature,
    dewpoint,
    altimeter,
    seaLevelPressure: undefined,
    trends,
    runwayStates,
    windShear,
    remarks,
    warnings,
  });
}

/** Result-style parse outcome: never throws for parse-level failures — branch on `ok` instead of try/catch.
 *  结果式解析出口：解析层失败不抛出，按 ok 分流——批量回放/管道消费免 try/catch 控制流。 */
export type TryParseResult =
  | { readonly ok: true; readonly report: MetarReport }
  | { readonly ok: false; readonly error: MetarParseError };

/**
 * `parse` 的问题式变体：整体失败返回 `{ ok:false, error }`（MetarParseError，code 契约同 parse），
 * 成功返回 `{ ok:true, report }`。仅编程性意外（非 MetarParseError 的内部异常）原样抛出——
 * 不吞实现缺陷。语义与 parse 完全一致（同一实现，确定性继承）。
 * Result-style variant of `parse`: whole-report failures come back as `{ ok:false, error }`
 * with the same stable `code` contract; unexpected non-MetarParseError exceptions still throw.
 */
export function tryParse(raw: string, options?: ParseOptions): TryParseResult {
  try {
    return { ok: true, report: parse(raw, options) };
  } catch (err) {
    if (err instanceof MetarParseError) return { ok: false, error: err };
    throw err;
  }
}
