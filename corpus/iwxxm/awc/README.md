# AWC 2025-2 实时流语料

NOAA AWC（航空气象中心）实时流 IWXXM 报文样本，41 站单次拉取冻结（2026-10-05 06Z 时段观测）。

## 来源与取数方式

- 端点：`https://aviationweather.gov/api/data/metar?ids=<逗号分隔站单>&format=iwxxm`（免鉴权 HTTP，
  Node 侧取数——该端点无 CORS 头，浏览器不可直连）。
- 限制：`ids=all` 不支持 `format=iwxxm`（返回空），必须用站单列表；多站响应为 WMO collect 2014
  `MeteorologicalBulletin` 包裹，内含多份 `iwxxm:METAR` / `iwxxm:SPECI` 文档（本目录按站拆分入库）。
- 版本：命名空间 `http://icao.int/iwxxm/2025-2`，schemaLocation 指向 schemas.wmo.int 的 2025-2RC1
  XSD；转换中心 KKCI（NWS/AWC），报头带 `translationCentre*` / `automatedStation` 属性，且每份报文
  头部内嵌源 TAC 注释（`<!--TAC: …-->`）。
- `.tac` 文件即从该内嵌注释提取——与 XML 是同一份电报的两种编码（AWC 自己的转换对照）。

## 命名与形态覆盖

- 文件名：`{ICAO 站码}-{DDHHMM}Z.xml/.tac`（时组取自 TAC 电头，与文件名互校）。
- 覆盖形态（拉取时点实测）：METAR 33 份 + SPECI 8 份；现在天气 18 份（-RA/-DZ/BR/FG/HZ 等）；
  云层 24 份（含 BKN300 高层）；空 AerodromeCloud 容器 17 份（TAC 的 CLR/NSC/CAVOK 在 AWC 转换下
  的形态）；VV 经 OVX 云量层承载 6 份（TAC VV001→OVX+100ft）；阵风 1 份；美制 RMK 入
  `iwxxm-us` 国家扩展 26 份。
- 未覆盖（AWC 现行转换器不输出，非样本时点问题）：RVR（TAC 在场也不转，KBOI 实证）、趋势组/
  NOSIG（EFHK/VIDP/RJAA 的 TAC 在场也不转）、跑道状态组（2025-2 XSD 已整体删除该建模）、
  NIL、风切变、海况、风向扇区（TAC 080V140 族不转）、CAVOK 布尔（恒 false，CAVOK 报转成
  vis=9994+空云容器）。

## 转换口径要点（与 TAC 原文的固有数值分歧，非解析器缺陷）

- 能见度统一经英里折算再回米：9999→9994、5000→5005、4000→4007、P6SM→9994、10SM→16093、
  1/2SM→805——与任何 TAC 原文不可能逐位相等，故本目录只做 XML 单通道 IR 快照
  （`packages/parser/src/iwxxm-awc-corpus.test.ts`），不做双通道 deep-equal。
- 气压恒 hPa（A 组 inHg 折算，A3008→1018.7）；风速恒 `[kn_i]`（MPS 组折 kt，26004MPS→8kt）；
  美制站气温取 RMK T 组十分位精度（16/12→15.6/12.2）。
