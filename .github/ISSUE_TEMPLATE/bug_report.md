---
name: 缺陷报告
about: 报文解析或渲染异常
title: ""
labels: bug
assignees: ""
---

**报文原文（必填）。** 逐字粘贴 METAR/SPECI 原文——这是最有用的单一信息；请放入代码块保持原样：

```
ZSPD 120330Z 04004MPS 9999 SCT033 27/18 Q1020 NOSIG
```

**你的期望。** 最好是期望的 IR 片段（JSON）或卡片输出；否则一句话描述正确行为：

```json
{ "station": "ZSPD", "wind": { "kind": "value", "value": { "direction": 40 } } }
```

**实际结果。**

**版本。** metweave 包版本与运行时（浏览器 / Node）：

**数据源问题（如涉）。** IEM 网络名（如 `CN__ASOS`）与大致取数时间：
