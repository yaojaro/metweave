/**
 * demo 时间轴与报池的纯函数内核（2026-09-24 评测 P1 月界批）：
 * 全部「现在」来源以参数注入（nowMs），单测可把系统时间钉在月末边界（如 9/30 23:50Z）锁死行为。
 * 根因收口：旧实现把日号折算成 (day-1)*1440 的绝对分钟序——跨月时 to.day 回绕使窗跨度为负
 * （滑杆 max 为负、刻度循环恒假、播放停 0），北京时换算 %31 折回错显「31日」。
 * 修法：窗口/刻度/播放全走真实毫秒序（Date 真月历），报文日号经「相对现在的日偏移定位」
 * （±3 天窗口内按真实月历找吻合日号）归一到同一毫秒序；TafExpandAt 的 day 采用
 * 「自层锚月 1 日起的连续日序」（可超月长），与 @metweave/leaflet 的 calendarAnchor 归一协议对接。
 */
import type { TafExpandAt, TafReport } from "@metweave/leaflet";

/** 展示月锚（与 @metweave/render 的 TafCalendarAnchor 同形：month 1–12） */
export interface CalendarAnchor {
  readonly year: number;
  readonly month: number;
}

const DAY_MS = 86_400_000;
/** 时间轴窗：现在起 24 小时、10 分钟一格（owner 9/24 定口径）＝144 格 */
export const TL_STEPS = 144;

/** UTC 某日的 00:00 毫秒序 */
const utcDayStart = (ms: number): number => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

/**
 * 报文日号（1–31）→ 相对「现在」UTC 当日的真实天数偏移（数据定位，真月历）：
 * 在 -2..+3 天窗口内按真实月历找 getUTCDate 吻合的偏移（TAF 报池距现在 ±1 天内）；
 * 无吻合（病态日号）兜底 ±31 折回——仅数据定位位，窗口远大于实际报龄，无害。
 */
export const dayOffsetOf = (day: number, nowMs: number): number => {
  const base = utcDayStart(nowMs);
  for (let off = -2; off <= 3; off += 1) {
    if (new Date(base + off * DAY_MS).getUTCDate() === day) return off;
  }
  const nowDay = new Date(nowMs).getUTCDate();
  const folded = (day - nowDay + 31) % 31;
  return folded > 15 ? folded - 31 : folded;
};

/** 报文日号 + 时 → 毫秒序（相对 now 真月历定位；报池排序/在效选择的统一序） */
export const dayHourMs = (day: number, hour: number, minute: number, nowMs: number): number =>
  utcDayStart(nowMs) + dayOffsetOf(day, nowMs) * DAY_MS + hour * 3_600_000 + minute * 60_000;

/** 报文生效起点归属的真实月（层 item.monthAnchor 用；无有效期回退「现在」所在月） */
export const monthAnchorOf = (r: TafReport, nowMs: number): CalendarAnchor => {
  const v = r.validity;
  if (v === undefined) {
    const d = new Date(nowMs);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  }
  const at = new Date(dayHourMs(v.startDay, v.startHour, 0, nowMs));
  return { year: at.getUTCFullYear(), month: at.getUTCMonth() + 1 };
};

/**
 * 毫秒 → TafExpandAt：day 为「自锚月 1 日起的连续日序」（可超月长，跨月不回绕——
 * 与 addTafLayer/setTafLayerTime 的 calendarAnchor 归一协议对接，见 @metweave/leaflet）。
 */
export const contAtOf = (ms: number, cal: CalendarAnchor): TafExpandAt => {
  const d = new Date(ms);
  const anchorStart = Date.UTC(cal.year, cal.month - 1, 1);
  const day = Math.round((utcDayStart(ms) - anchorStart) / DAY_MS) + 1;
  return { day, hour: d.getUTCHours(), minute: d.getUTCMinutes() };
};

/** 时刻显示（单制，带月位——跨月不歧义）：UTC＝M月D日 HH:MMZ；京＝北京时M月D日 HH:MM */
export const fmtTl = (ms: number, tzOffset: number | null): string => {
  const z = new Date(ms + (tzOffset ?? 0) * 60_000);
  const md = `${z.getUTCMonth() + 1}月${z.getUTCDate()}日`;
  const hm = `${String(z.getUTCHours()).padStart(2, "0")}:${String(z.getUTCMinutes()).padStart(2, "0")}`;
  return tzOffset === null ? `${md} ${hm}Z` : `北京时${md} ${hm}`;
};

/** 变化窗 ddHH → 展示时区「M月D日HH时」（真月历；面板「下一变化」列用） */
export const zonedDayHour = (
  day: number,
  hour: number,
  tzOffset: number | null,
  nowMs: number,
): string => {
  const ms = dayHourMs(day, hour, 0, nowMs) + (tzOffset ?? 0) * 60_000;
  const z = new Date(ms);
  return `${z.getUTCMonth() + 1}月${z.getUTCDate()}日${String(z.getUTCHours()).padStart(2, "0")}时`;
};

/**
 * 「现在」锚漂移重锚（评测批3#13）：真实当前时刻越过窗尾（长会话）或锚漂移超 30 分钟时重算窗，
 * 返回新窗零点；未触发返回 undefined。格位语义＝「相对现在的偏移格数」——重锚不打断观看
 * （用户在看 +3h，重锚后仍是新「现在」+3h；index 天然保持，无需平移）。
 */
export const reanchorOf = (anchorMs: number, nowMs: number): number | undefined => {
  if (!(nowMs > anchorMs + 24 * DAY_MS || Math.abs(nowMs - anchorMs) > 30 * 60_000)) {
    return undefined;
  }
  return Math.floor(nowMs / 600_000) * 600_000;
};

// ---------------------------------------------------------------- 报池（owner 9/24 方案B：现在永远有在效报）

/** 报文发布毫秒序（次序键；无发布时刻排最前） */
const issueMsOf = (r: TafReport, nowMs: number): number =>
  r.issueTime === undefined
    ? Number.NEGATIVE_INFINITY
    : dayHourMs(r.issueTime.day, r.issueTime.hour, r.issueTime.minute, nowMs);

/**
 * 报池按生效起点升序整理（真月历毫秒序，同起点晚发布在后；NIL/CNL 无有效期排尾）。
 * 旧版 ±31 折回在月末短月（9 月 30 天）会差一天——现按真实月历定位（2026-09-24 评测 P1）。
 */
export const sortTafPool = (pool: TafReport[], nowMs: number): void => {
  const keyOf = (r: TafReport): number => {
    const v = r.validity;
    if (v === undefined || r.nil === true || r.cancelled === true) return Number.POSITIVE_INFINITY;
    return dayHourMs(v.startDay, v.startHour, 0, nowMs) * 10_000 + issueMsOf(r, nowMs);
  };
  pool.sort((a, b) => keyOf(a) - keyOf(b));
};

/**
 * 按查看时刻选在效报文：生效起点 ≤ tMs 的最新一份；最新为 NIL/CNL＝权威「无预报」；
 * 全部未生效 → 最新一份（灰「未生效」语义保留——上一周期也缺时的诚实降级）。
 */
export const selectReport = (
  pool: readonly TafReport[] | undefined,
  tMs: number,
  nowMs: number,
): TafReport | undefined => {
  const last = pool?.[pool.length - 1];
  if (pool === undefined || last === undefined) return undefined;
  if (last.nil === true || last.cancelled === true) return last;
  let sel: TafReport | undefined;
  for (const r of pool) {
    const v = r.validity;
    if (v === undefined || r.nil === true || r.cancelled === true) continue;
    if (dayHourMs(v.startDay, v.startHour, 0, nowMs) <= tMs) sel = r; // 池已升序，留最晚命中
  }
  return sel ?? last;
};
