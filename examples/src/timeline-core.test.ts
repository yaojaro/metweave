import { describe, expect, it } from "vitest";
import { parseTaf } from "metweave";
import type { TafReport } from "@metweave/leaflet";
import {
  TL_STEPS,
  contAtOf,
  dayOffsetOf,
  fmtTl,
  monthAnchorOf,
  selectReport,
  sortTafPool,
  zonedDayHour,
} from "./timeline-core";

/** 2026-09-30 23:50Z——评测 P1 月界批的钉死边界（旧实现在此建窗滑杆 max=-4176） */
const NOW = Date.UTC(2026, 8, 30, 23, 50);
const CAL_9 = { year: 2026, month: 9 };

describe("时间轴窗（月界批）：真实毫秒序建窗，跨月不回绕", () => {
  it("9/30 23:50Z 建窗：格数恒 144（旧实现 to<from → max 为负死锁）；窗尾跨月落 10/1", () => {
    const anchorMs = Math.floor(NOW / 600_000) * 600_000;
    const endMs = anchorMs + TL_STEPS * 600_000;
    expect(TL_STEPS).toBe(144);
    const end = contAtOf(endMs, CAL_9);
    expect(end.day).toBe(31); // 9 月锚起第 31 天＝10 月 1 日（连续序不回绕）
    expect(end.hour).toBe(23);
    expect(end.minute).toBe(50);
  });

  it("fmtTl 北京时制跨月：9/30 16:00Z 显示「北京时10月1日 00:00」而非「31日」回绕", () => {
    expect(fmtTl(Date.UTC(2026, 8, 30, 16, 0), 480)).toBe("北京时10月1日 00:00");
    expect(fmtTl(Date.UTC(2026, 8, 30, 23, 50), 480)).toBe("北京时10月1日 07:50");
    // UTC 制同样带月位（跨月不歧义）
    expect(fmtTl(Date.UTC(2026, 8, 30, 23, 50), null)).toBe("9月30日 23:50Z");
    expect(fmtTl(Date.UTC(2026, 9, 1, 0, 5), null)).toBe("10月1日 00:05Z");
  });

  it("短月边界（2 月 28 天）：2/27 23:50Z 的 +1 天是 2/28、+2 天是 3/1（%31 折回会差一天）", () => {
    const now = Date.UTC(2027, 1, 27, 23, 50);
    expect(dayOffsetOf(28, now)).toBe(1);
    expect(dayOffsetOf(1, now)).toBe(2); // 3 月 1 日（2027 年 2 月 28 天）
    expect(fmtTl(Date.UTC(2027, 1, 27, 16, 0), 480)).toBe("北京时2月28日 00:00");
  });

  it("zonedDayHour（面板「下一变化」）：跨月窗 ddHH → M月D日HH时", () => {
    // 报文日号 01（10 月报的生效日），now=9/30 → 北京时 10 月 1 日
    expect(zonedDayHour(1, 6, 480, NOW)).toBe("10月1日14时");
    expect(zonedDayHour(30, 12, null, NOW)).toBe("9月30日12时");
  });
});

describe("报池（月界批）：日号经真实月历定位（%31 折回在月末短月差一天的根因收口）", () => {
  const sept = parseTaf("TAF ZBAA 291100Z 2912/3012 17004MPS 9999 SCT030=");
  const oct = parseTaf("TAF ZBAA 302300Z 0100/0206 17004MPS 0800 -SN OVC008=");

  it("dayOffsetOf：now=9/30 时报日号 01 定位 +1 天（10/1），非 %31 折回的 +2 天", () => {
    expect(dayOffsetOf(30, NOW)).toBe(0);
    expect(dayOffsetOf(1, NOW)).toBe(1);
    expect(dayOffsetOf(29, NOW)).toBe(-1);
  });

  it("sortTafPool：10 月报（startDay 01）排在 9 月报（startDay 29/30）之后（旧折回序 01 < 29 会倒挂）", () => {
    const pool: TafReport[] = [oct, sept];
    sortTafPool(pool, NOW);
    expect(pool[0]?.raw).toContain("2912/3012");
    expect(pool[1]?.raw).toContain("0100/0206");
  });

  it("selectReport：跨 00Z 换报——tMs=9/30 23:00 选 9 月报、tMs=10/1 06:00 选 10 月报（旧序回绕会把 10 月报判未生效）", () => {
    const pool: TafReport[] = [sept, oct];
    sortTafPool(pool, NOW);
    expect(selectReport(pool, Date.UTC(2026, 8, 30, 23, 0), NOW)?.raw).toContain("2912/3012");
    expect(selectReport(pool, Date.UTC(2026, 9, 1, 6, 0), NOW)?.raw).toContain("0100/0206");
  });

  it("monthAnchorOf：10 月报锚 2026-10、9 月报锚 2026-9（供 item.monthAnchor 与层归一）", () => {
    expect(monthAnchorOf(oct, NOW)).toEqual({ year: 2026, month: 10 });
    expect(monthAnchorOf(sept, NOW)).toEqual({ year: 2026, month: 9 });
  });

  it("contAtOf 连续序与层 calendarAnchor 协议：10/1 06:00Z 在 9 月锚下 day=31（喂 setTafLayerTime 不回绕）", () => {
    expect(contAtOf(Date.UTC(2026, 8, 30, 23, 50), CAL_9)).toEqual({
      day: 30,
      hour: 23,
      minute: 50,
    });
    expect(contAtOf(Date.UTC(2026, 9, 1, 6, 0), CAL_9)).toEqual({ day: 31, hour: 6, minute: 0 });
    expect(contAtOf(Date.UTC(2026, 9, 2, 0, 10), CAL_9)).toEqual({ day: 32, hour: 0, minute: 10 });
  });
});
