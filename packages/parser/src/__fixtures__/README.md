# 解析器测试夹具（fixtures）

> 报文集按「解析雷点」类别组织——每条报文的 `traps` 字段标注它踩中的雷点，`trapsLegend` 是全部雷点的人类可读说明。**条数与雷点数以 `metar.json` 的 `count` 字段与 `trapsLegend` 为准，本文件不写死数字**（手写统计已两次与 JSON 漂移，2026-09-12 起移除；`count` 与 `fixtures.length` 的一致性由测试锁定）。条目含 `source` 字段（`aw`＝aviationweather.gov / `iem`＝Iowa Environmental Mesonet 采集 / `tgftp`＝NWS tgftp 全球报文切片，`synth` 为真实通道暂未采到的合规电码构造形态，note 注明）。

## 用途

- `@metweave/parser` 的验收断言基础：解析器的目标不是「能跑」，而是对这些真实世界的反常形态给出正确、不静默的处理（未知组进 `warnings[]`、缺测三态、单位跟组走）。
- v0.1 范围 = METAR tolerant 路径（类型词双形态兼容、COR 组）；SPECI/TAF 完整夹具随 v0.2 扩充。

## 结构

```jsonc
{
  "fixtures": [
    {
      "id": "verified-c3", // 稳定 ID（verified=人工逐组核验基准 / target=定向补采 / corpus=常规语料 / arc=归档淘选）
      "raw": "KOKC 35013KT 1 1/4SM -SN BR ...",
      "station": "KOKC",
      "source": "iem", // aw＝aviationweather.gov | iem＝Iowa Environmental Mesonet | tgftp＝NWS tgftp
      "obsTime": null, // 归档条目带 ISO 时刻
      "traps": ["vis-mixed-fraction"],
      "note": "混分数能见度含组内空格……",
    },
  ],
}
```

## 覆盖

绝大多数雷点有真实实弹（公开数据通道采集）；暂无实弹的以 synth 构造形态补位（note 已标注），实弹补采后回写。覆盖面包括但不限于：

- **数据违反条文**：BR 超区间、`1 1/4SM` 组内空格、RVR 的 FT 英尺后缀
- **区域惯例**：趋势组可选、CLRD 带摩擦系数、RMK 国家附加段
- **合法反常**：solidi 占位缺测（`//` `///` `////`）、报尾 `$`；类型词 / AUTO / COR 三个标志位各有独立实弹（**尚无三者同现的报文**——位与位的正交性由「报头标志位正交装配」的定点断言覆盖，不靠同现样本）
- **工程陷阱**：RVRNO 显式缺测、降水窗口组、正文/RMK 温度气压双轨、VV 顶替云组、`/////KT` 与 MADIS 一分钟假报文、5 位数脏 QNH
- **现象覆盖**：FZRA/FZDZ/FZFG、GR/GS/SG/IC/PL、PO/SQ/FC（含 2013 年俄克拉荷马漏斗云实报）、VA（2009 年安克雷奇 Redoubt 火山喷发实报）、SS/DS、TS/SH 家族、UP 自动站未知降水

## 纪律

- 夹具是纯静态文本，不随版本重建变化语义；新增雷点时按「每雷 ≥1 条真实实弹」原则扩充。
- 统计数字只写在 `metar.json`（`count` / `trapsLegend`），文档不复制数字——要引用就说「以 JSON 为准」。
- 报文本身为公开气象数据；`note` 只描述解析语义，不含任何采集管线内部信息。
