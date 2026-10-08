/**
 * AWC IWXXM 报文的源 TAC 抽取与卡片 altRaws 供给（v0.3 第四期）。
 *
 * AWC 转换中心输出 IWXXM XML 时在报文头部内嵌 `<!--TAC: …-->` 注释保留源电码——
 * `pnpm gen:iwxxm` 即按此注释抽取 .tac 语料（corpus/iwxxm/awc 的 .tac 文件与本抽取同源同式），
 * 地图弹窗卡的原文区据此在「IWXXM（XML）」与「TAC（源电码）」两种编码间切换：
 * 有 IWXXM 数据且抽得出源 TAC 才出现切换；抽不出（无内嵌注释——如 2023-1 官方等价对语料/
 * 非 AWC 源，或抽出后 TAC 解析失败）返回空数组＝无 tab，原文区维持单 XML 视图。
 */
import { parse, type MetarReport, type RenderCardAltRaw } from "metweave";

/** 内嵌源 TAC 注释抽取判式（与 scripts/gen-iwxxm.mjs 的 `grab(doc, /<!--TAC: ([^>]*?)\s*-->/)`
 *  同式：注释体到首个 `>` 止、尾随空白剥除——AWC 注释体为纯 TAC 电码不含 `>`） */
const TAC_COMMENT = /<!--TAC: ([^>]*?)\s*-->/;

/** 从 IWXXM 报文原文（XML）抽内嵌源 TAC；无注释返回 null（非 AWC 源如实降级） */
export const tacOfIwxxmRaw = (raw: string): string | null => TAC_COMMENT.exec(raw)?.[1] ?? null;

/** renderCard 的 card.altRaws 供给（函数形态，按卡内 IR 现取）：本卡 raw 内抽源 TAC → parse 得
 *  TAC IR → 单表项；抽不出或 TAC 解析失败（畸形源）降级空数组——不炸卡、不出现半成品 tab */
export const altRawsOfIwxxm = (report: MetarReport): readonly RenderCardAltRaw[] => {
  const tac = tacOfIwxxmRaw(report.raw);
  if (tac === null) return [];
  try {
    return [{ label: "TAC（源电码）", report: parse(tac) }];
  } catch {
    return [];
  }
};
