/**
 * @metweave/parser — TAF 时间线展开器（FM 51，v0.2 批 2.3）。
 * The TAF timeline expander — the derived layer on top of the structural IR.
 *
 * 五步算法（taf-timeline §2「最新段绑定」）：切段（FM 硬分页/BECMG 窗终切子段）→ 挂载
 * （TEMPO/PROB 挂段不切段）→ 绑段（时刻 t 绑到变化点已过的最近段）→ 合成（未列要素沿链
 * 回溯，云按例外整体取）→ 叠加（TEMPO 窗内双态：发作取组值、间歇回段值）。
 * B6 过渡带约定：t 落在 BECMG 窗内（含窗起、不含窗终）＝变化时刻不可精确，`uncertain`
 * 置真并按**窗终已到**的前段值返回（保守约定，双态展示由消费方叠加「或」文案）。
 * B7 间歇语义：发作每次 <1h、累计 <半窗是 WMO 语义约束（条文判据归 /validate），
 * 展开层只按窗口边界给出双态，不预设发作时刻。
 * B3 跨月回绕：有效期组不含月，展开须带月锚（anchor = 有效期起日所在月），
 * 日序按锚月长度回绕成绝对序。
 * 自检三问（判卷同源，taf-timeline §2）：窗开了吗（开窗前只有基况）？绑到最新完成段了吗？
 * 未列要素回溯了吗（云组落笔）？
 */
import type {
  CloudCondition,
  TafChangeGroup,
  TafReport,
  TrendElements,
  VisibilityGroup,
  WeatherGroup,
  WindGroup,
} from "@metweave/core";

/** 展开时刻：日（锚月内，可跨月回绕）+ 时分 */
export interface TafExpandAt {
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

/** 月锚（B3）：有效期起日所在月——`daysIn` 供给跨月回绕的天数表（大小月/闰年由调用方算好） */
export interface TafMonthAnchor {
  readonly daysIn: number;
}

/** 合成后的四要素（展开层两态视图：cavok 让位语义同解析层） */
export interface TafResolvedConditions {
  readonly wind?: WindGroup;
  readonly visibility?: VisibilityGroup;
  readonly weather: readonly WeatherGroup[];
  readonly clouds?: CloudCondition;
  readonly cavok: boolean;
}

/** TEMPO/PROB 发作态：只携带组内所列要素（覆盖语义：天气整列替换、云整体替换、未列继承段值） */
export interface TafTempoOverlay {
  readonly conditions: Pick<
    TafResolvedConditions,
    "wind" | "visibility" | "weather" | "clouds" | "cavok"
  >;
  /** PROB 组携带；TEMPO 无概率 */
  readonly probability?: 30 | 40;
  readonly withTempo: boolean;
}

/** 一次展开的完整结果 */
export interface TafExpansion {
  /** 间歇态/段值（B7：窗内非发作时刻的基线） */
  readonly conditions: TafResolvedConditions;
  /** 发作态（t 落在 TEMPO/PROB 窗内时在位；间歇态仍在 conditions） */
  readonly tempo?: TafTempoOverlay;
  /** B6 过渡带：t 在某 BECMG 窗内，变化时刻不可精确（保守按前段值返回） */
  readonly uncertain: boolean;
  /** 绑定段：base 或变化组序号（changes 下标） */
  readonly boundSegment:
    | { readonly kind: "base" }
    | { readonly kind: string; readonly index: number };
}

interface Segment {
  /** 段起始绝对分（变化点已过即切到本段） */
  readonly from: number;
  /** 段来源：base=报文基况；FM/BECMG=changes[i]（TEMPO/PROB 不切段，见挂载） */
  readonly source: { kind: "base" } | { kind: "FM" | "BECMG"; index: number };
  /** FM 段＝硬分页（此前一切作废——回溯不越过 FM）；BECMG 段沿链回溯 */
  readonly hard: boolean;
  readonly elements: TrendElements | undefined;
}

const minutesOf = (day: number, hour: number, minute: number): number =>
  day * 1440 + hour * 60 + minute;

/** 未列要素沿链回溯合成（云例外：最近一次列云处整体取——BECMG 云必全重报，天然满足） */
function resolveConditions(chain: readonly Segment[], upto: number): TafResolvedConditions {
  let wind: WindGroup | undefined;
  let visibility: VisibilityGroup | undefined;
  let weather: readonly WeatherGroup[] | undefined;
  let clouds: CloudCondition | undefined;
  let cavok = false;
  let sawWeather = false;
  // CAVOK 让位语义（同解析层三关契约）：回溯途中遇 CAVOK，其前未定值的 vis/weather/clouds 作废
  let visVoid = false;
  let weatherVoid = false;
  let cloudsVoid = false;
  // 从绑定段向前回溯（链序：越靠后越新）——FM 段为硬界，回溯止于其前
  for (let k = upto; k >= 0; k--) {
    const seg = chain[k];
    if (seg === undefined) continue;
    const e = seg.elements;
    if (e === undefined) continue;
    if (wind === undefined && e.wind !== undefined) wind = e.wind;
    if (visibility === undefined && e.visibility !== undefined) visibility = e.visibility;
    if (!sawWeather && (e.weather.length > 0 || e.nsw !== undefined)) {
      weather = e.nsw !== undefined && e.weather.length === 0 ? [] : e.weather;
      sawWeather = true;
    }
    if (clouds === undefined && (e.clouds !== undefined || e.cavok !== undefined)) {
      if (e.cavok !== undefined) cavok = true;
      clouds = e.clouds;
    }
    if (e.cavok !== undefined) {
      // 该段编 CAVOK：其前的未定要素按三关让位作废（已定值——如 CAVOK 后 BECMG 重编——不回退）
      if (visibility === undefined) visVoid = true;
      if (!sawWeather) {
        weatherVoid = true;
        sawWeather = true;
      }
      if (clouds === undefined) cloudsVoid = true;
    }
    if (seg.hard) break; // FM 硬分页：此前一切作废
  }
  return {
    ...(wind !== undefined ? { wind } : {}),
    ...(visibility !== undefined && !visVoid ? { visibility } : {}),
    weather: weatherVoid ? [] : (weather ?? []),
    ...(clouds !== undefined && !cloudsVoid ? { clouds } : {}),
    cavok,
  };
}

/** 变化组窗口/时刻 → 绝对分（跨月回绕按锚月天数折算日序） */
function absOfChange(
  change: TafChangeGroup,
  anchorDay: number,
  daysIn: number,
): { from: number; end: number } | undefined {
  const wrap = (day: number): number => (day < anchorDay ? day + daysIn : day);
  if (change.at !== undefined) {
    // FM 的日按「不早于前段起点」推断：时刻小于锚日起点时刻则视为次日
    const sameDay = minutesOf(anchorDay, change.at.hour, change.at.minute);
    return { from: sameDay, end: sameDay };
  }
  const w = change.window;
  if (w === undefined) return undefined;
  const from = minutesOf(wrap(w.startDay), w.startHour, 0);
  const end = minutesOf(wrap(w.endDay), w.endHour, 0);
  return { from, end };
}

/** 主导段切点构建（expandTaf 与 tafSegments 共用——切段规则单一来源）：
 *  base 起步；FM 硬分页（日归属按「不早于当前页起点」推断）；BECMG 以窗终为段起点（保守约定） */
function prevailingSegments(report: TafReport, daysIn: number, validFrom: number): Segment[] {
  const v = report.validity;
  const segments: Segment[] = [
    { from: validFrom, source: { kind: "base" }, hard: false, elements: baseElements(report) },
  ];
  let pageStart = validFrom; // 当前 FM 页起点（FM 的日归属在其页语境内推断）
  for (const [idx, change] of report.changes.entries()) {
    const kind = change.kind;
    if (kind === "TEMPO" || kind === "PROB") continue; // 挂载项：不切段
    if (kind === "FM" && change.at !== undefined) {
      // FM 日归属：不早于当前页起点——时刻倒挂视为次日
      let from = v !== undefined ? minutesOf(v.startDay, change.at.hour, change.at.minute) : 0;
      while (from < pageStart) from += 1440;
      pageStart = from;
      segments.push({ from, source: { kind, index: idx }, hard: true, elements: change.elements });
    } else if (kind === "BECMG") {
      const abs = v !== undefined ? absOfChange(change, v.startDay, daysIn) : undefined;
      if (abs === undefined) continue;
      segments.push({
        from: abs.end,
        source: { kind, index: idx },
        hard: false,
        elements: change.elements,
      });
    }
  }
  return segments;
}

/**
 * Expand a parsed TAF at one instant — the five-step algorithm (切段→挂载→绑段→合成→叠加).
 * 在给定时刻展开已解析的 TAF（五步算法，黄金基准＝taf-timeline §3 三例逐时刻表）。
 * `anchor` 为有效期起日所在月的天数（大小月/闰年由调用方给定，B3）；`at.day` 为锚月内日序
 * （跨月后的日按小日号传入，内部回绕）。
 */
export function expandTaf(
  report: TafReport,
  at: TafExpandAt,
  anchor: TafMonthAnchor,
): TafExpansion {
  if (report.validity === undefined || report.nil === true || report.cancelled === true) {
    throw new Error("expandTaf 需要带有效期的完整 TAF（NIL/CNL 报无可展开时间线）");
  }
  const v = report.validity;
  const wrapDay = (day: number): number => (day < v.startDay ? day + anchor.daysIn : day);
  const t = minutesOf(wrapDay(at.day), at.hour, at.minute);
  const validFrom = minutesOf(v.startDay, v.startHour, 0);

  // —— ① 切段（与 tafSegments 同一规则）：base 起步；FM 硬分页；BECMG 按窗终切子段
  const segments = prevailingSegments(report, anchor.daysIn, validFrom);
  if (t < validFrom) {
    // 自检三问之一：窗开了吗——开窗前只有基况（勿预设双态），此处返回基段且不挂 TEMPO
    const baseSeg = segments[0] ?? {
      from: validFrom,
      source: { kind: "base" } as const,
      hard: false,
      elements: undefined,
    };
    return {
      conditions: resolveConditions([baseSeg], 0),
      uncertain: false,
      boundSegment: { kind: "base" },
    };
  }

  // —— ③ 绑段：变化点已过的最近一段（BECMG 的 from=窗终）；t 落任何 BECMG 窗内 → 过渡带
  let bound = 0;
  let uncertain = false;
  for (const [k, seg] of segments.entries()) {
    if (seg.from <= t) bound = k;
  }
  for (const change of report.changes) {
    if (change.kind !== "BECMG") continue;
    const abs = absOfChange(change, v.startDay, anchor.daysIn);
    if (abs !== undefined && t >= abs.from && t < abs.end) uncertain = true; // B6（含窗起不含窗终）
  }

  // —— ④ 合成 + ② 挂载叠加：t 落 TEMPO/PROB 窗内 → 发作态（覆盖所列要素）
  const conditions = resolveConditions(segments, bound);
  let tempo: TafTempoOverlay | undefined;
  for (const change of report.changes) {
    if (change.kind !== "TEMPO" && change.kind !== "PROB") continue;
    const abs = absOfChange(change, v.startDay, anchor.daysIn);
    if (abs === undefined || t < abs.from || t >= abs.end) continue;
    const e = change.elements;
    if (e === undefined) continue;
    tempo = {
      conditions: {
        ...(e.wind !== undefined ? { wind: e.wind } : {}),
        ...(e.visibility !== undefined ? { visibility: e.visibility } : {}),
        weather: e.nsw !== undefined && e.weather.length === 0 ? [] : e.weather,
        ...(e.clouds !== undefined ? { clouds: e.clouds } : {}),
        cavok: e.cavok !== undefined,
      },
      ...(change.probability !== undefined ? { probability: change.probability } : {}),
      withTempo: change.withTempo === true,
    };
    break; // 同刻多窗取首个（报文原序）；叠加多窗属极端形态，消费方可按需扩展
  }

  return {
    conditions,
    ...(tempo !== undefined ? { tempo } : {}),
    uncertain,
    boundSegment: segments[bound]?.source ?? { kind: "base" },
  };
}

/** 绝对分 → 时刻（日为绝对序，可直接喂 expandTaf——≥有效期起日不再回绕） */
const atOfAbs = (abs: number): TafExpandAt => ({
  day: Math.floor(abs / 1440),
  hour: Math.floor((abs % 1440) / 60),
  minute: abs % 60,
});

/** 分段视图行窗口：绝对分 → 时刻（显示序）——日按锚月回绕折回小日号（绝对日 32 在 31 天锚月 → 01） */
const atOfDisplay = (abs: number, daysIn: number): TafExpandAt => {
  const raw = atOfAbs(abs);
  return { ...raw, day: ((raw.day - 1) % daysIn) + 1 };
};

/** 分段视图行（渲染层②「分段天气明细」的数据面，v0.2）：一行 = 一个时段的具体天气 */
export interface TafSegmentRow {
  /** 行类型：base=基况段；FM=自该时刻起（硬切）；BECMG=渐变（过渡带行 uncertain=true）或转变后段（false）；TEMPO/PROB=短暂/概率挂载行 */
  readonly kind: "base" | "FM" | "BECMG" | "TEMPO" | "PROB";
  /** 行窗口起点/终点（显示序：日按锚月回绕，跨月折回小日号） */
  readonly from: TafExpandAt;
  readonly to: TafExpandAt;
  /** BECMG 过渡带行：变化时刻不可精确（B6） */
  readonly uncertain: boolean;
  /** 该窗口的展开四要素（段中点口径；BECMG 过渡带行=转变前值，TEMPO/PROB 行=所在主导段值） */
  readonly conditions: TafResolvedConditions;
  /** 挂载行组内所列要素与概率（仅 TEMPO/PROB 行在位） */
  readonly overlay?: TafTempoOverlay;
  /** 来源变化组下标（changes 序；base 行无） */
  readonly sourceIndex?: number;
}

/**
 * Derive the period-by-period view of a TAF: prevailing rows (base / FM / after-BECMG) with the
 * BECMG transition band as its own uncertain row, plus TEMPO/PROB overlay rows — chronological.
 * 把 TAF 切成分段明细行（指令「按拆分时间段给具体天气」）：主导段行 + BECMG 过渡带行 +
 * TEMPO/PROB 挂载行，按窗口起点升序稳定合并（同刻主导段在前）；每行携带段中点展开结果——
 * 切段规则与 expandTaf 同一来源（prevailingSegments），黄金基准互通。
 */
export function tafSegments(
  report: TafReport,
  anchor: TafMonthAnchor = { daysIn: 31 },
): readonly TafSegmentRow[] {
  if (report.validity === undefined || report.nil === true || report.cancelled === true) {
    throw new Error("tafSegments 需要带有效期的完整 TAF（NIL/CNL 报无可分段）");
  }
  const v = report.validity;
  const validFrom = minutesOf(v.startDay, v.startHour, 0);
  const validEnd = minutesOf(
    v.endDay < v.startDay ? v.endDay + anchor.daysIn : v.endDay,
    v.endHour,
    0,
  );

  const rows: { abs: number; row: TafSegmentRow }[] = [];

  // —— 主导段行：切点 → 下一切点（末段到有效期止），行值取段中点展开
  const segments = prevailingSegments(report, anchor.daysIn, validFrom);
  for (const [k, seg] of segments.entries()) {
    const next = segments[k + 1];
    const to = next !== undefined ? next.from : validEnd;
    if (to <= seg.from) continue; // 零长段（同刻多变化点）：无展示窗，后段顶上
    const mid = seg.from + Math.floor((to - seg.from) / 2);
    const exp = expandTaf(report, atOfAbs(mid), anchor);
    rows.push({
      abs: seg.from,
      row: {
        kind: seg.source.kind,
        from: atOfDisplay(seg.from, anchor.daysIn),
        to: atOfDisplay(to, anchor.daysIn),
        uncertain: false,
        conditions: exp.conditions,
        ...(seg.source.kind !== "base" ? { sourceIndex: seg.source.index } : {}),
      },
    });
  }

  // —— BECMG 过渡带行（转变前值 + uncertain）与 TEMPO/PROB 挂载行
  for (const [idx, change] of report.changes.entries()) {
    if (change.kind === "FM") continue;
    const abs = absOfChange(change, v.startDay, anchor.daysIn);
    if (abs === undefined || abs.end <= abs.from) continue;
    const mid = abs.from + Math.floor((abs.end - abs.from) / 2);
    const exp = expandTaf(report, atOfAbs(mid), anchor);
    if (change.kind === "BECMG") {
      rows.push({
        abs: abs.from,
        row: {
          kind: "BECMG",
          from: atOfDisplay(abs.from, anchor.daysIn),
          to: atOfDisplay(abs.end, anchor.daysIn),
          uncertain: true,
          conditions: exp.conditions,
          sourceIndex: idx,
        },
      });
      continue;
    }
    const e = change.elements;
    if (e === undefined) continue;
    rows.push({
      abs: abs.from,
      row: {
        kind: change.kind,
        from: atOfDisplay(abs.from, anchor.daysIn),
        to: atOfDisplay(abs.end, anchor.daysIn),
        uncertain: false,
        conditions: exp.conditions,
        overlay: {
          conditions: {
            ...(e.wind !== undefined ? { wind: e.wind } : {}),
            ...(e.visibility !== undefined ? { visibility: e.visibility } : {}),
            weather: e.nsw !== undefined && e.weather.length === 0 ? [] : e.weather,
            ...(e.clouds !== undefined ? { clouds: e.clouds } : {}),
            cavok: e.cavok !== undefined,
          },
          ...(change.probability !== undefined ? { probability: change.probability } : {}),
          withTempo: change.withTempo === true,
        },
        sourceIndex: idx,
      },
    });
  }

  // —— 稳定合并：按窗口起点升序（同刻主导段在前；插入序天然稳定，n 极小无需排序库）
  const sorted: { abs: number; row: TafSegmentRow }[] = [];
  for (const item of rows) {
    let pos = sorted.length;
    while (pos > 0) {
      const prev = sorted[pos - 1];
      if (prev === undefined || prev.abs <= item.abs) break;
      pos -= 1;
    }
    sorted.splice(pos, 0, item);
  }
  return sorted.map((x) => x.row);
}

/** 基况段 → TrendElements 形态（展开链的统一要素视图） */
function baseElements(report: TafReport): TrendElements | undefined {
  const has =
    report.wind?.kind === "value" ||
    report.visibility?.kind === "value" ||
    report.weather?.kind === "value" ||
    report.clouds !== undefined ||
    report.cavok;
  if (!has) return undefined;
  return {
    ...(report.wind?.kind === "value" ? { wind: report.wind.value } : {}),
    ...(report.visibility?.kind === "value" ? { visibility: report.visibility.value } : {}),
    weather: report.weather?.kind === "value" ? report.weather.value : [],
    ...(report.clouds !== undefined ? { clouds: report.clouds } : {}),
    ...(report.cavok
      ? { cavok: report.cavokSpan !== undefined ? { span: report.cavokSpan } : {} }
      : {}),
  };
}
