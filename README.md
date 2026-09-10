<div align="center">

# metweave

**把公开气象数据编织成可嵌入产品的图。**
**Weaving public weather data into charts you can embed.**

TypeScript 工具链：解析 → 标准化 → 渲染
A TypeScript toolkit: parse → standardize → render

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Status](https://img.shields.io/badge/status-WIP-orange)

</div>

---

## 中文

**metweave** 是一套处理全球公开气象数据的 TypeScript 工具链：机场报文（METAR / SPECI / TAF）与开放格点数据，经「解析 → 标准化 → 渲染」一条管道，变成格点填色图、等值线、风羽与流线、meteogram 趋势图、报文卡片——无需 API key，全部计算在浏览器端完成，数据不出你的系统。

### 为什么是 metweave

气象报文的解析层已经有很多优秀的开源库（avwx、MetPy……）。metweave 不重复造这些轮子——真正的缺口在解析之后：今天要把一张 METAR 报文卡片或一层格点填色画到地图上，你仍然要在格式转换、互不相干的渲染插件和自写胶水代码之间挣扎。气象前端缺的不是又一个图层库，而是把**解析 → 标准化 → 渲染**连成一条完整链路的那一层。metweave 想做的，就是这一层。

### 特性（规划中）

- 🗺️ 渲染组件：格点填色 / 等值线 / 风羽与流线 / 雷达拼图 / meteogram 趋势图 / 报文卡片
- 🧵 内置解析管道：METAR / SPECI / TAF → 标准化数据结构
- 🌍 数据源：全球公开报文与开放格点数据（NOAA、Iowa Environmental Mesonet、GFS / ECMWF 开放数据）
- 🔌 与 Leaflet / MapLibre / OpenLayers 等主流地图库集成
- 🇨🇳 中文文档

### 当前状态

项目处于早期开发中。首个端到端示例——公开 METAR 报文 → 解析 → 地图渲染——构建中，示例与 demo 将收在 [`examples/`](examples/)；文档站建设中。

### 方向

- 解析覆盖面扩展：TAF / SPECI
- IWXXM ↔ TAC 双向转换
- 数据 API 与渲染 API

### 联系

邮箱 [yaojaro@metweave.com](mailto:yaojaro@metweave.com) · GitHub [@yaojaro](https://github.com/yaojaro)

作者 YaoJaro，长期从事民航气象数据处理与 WebGIS 可视化。

---

## English

**metweave** is a TypeScript toolkit for globally available weather data: airport reports (METAR / SPECI / TAF) and open gridded data flow through one pipeline — parse → standardize → render — into gridded fill plots, isolines, wind barbs and streamlines, meteograms, and report cards. No API key, everything computed in the browser, your data never leaves your system.

### Why metweave

Weather report parsing is already well served by excellent open-source libraries (avwx, MetPy, …). metweave doesn't rebuild those — the real gap is what comes after parsing: today, drawing a METAR report card or a gridded fill layer onto a map still means wrestling with format conversion, fragmented rendering plugins, and hand-written glue code. What weather on the frontend lacks is not another layer library, but the layer that connects **parse → standardize → render** into one complete pipeline. That's the layer metweave builds.

### Features (planned)

- 🗺️ Rendering components: gridded fill / isolines / wind barbs & streamlines / radar mosaics / meteograms / report cards
- 🧵 Built-in parsing pipeline: METAR / SPECI / TAF → standardized data structures
- 🌍 Data sources: global public reports and open gridded data (NOAA, Iowa Environmental Mesonet, GFS / ECMWF open data)
- 🔌 Integrations with mainstream map libraries: Leaflet / MapLibre / OpenLayers
- 🇨🇳 Chinese documentation

### Status

Early development. The first end-to-end example — a public METAR report parsed and rendered on a map — is in the works and will land in [`examples/`](examples/); documentation site under construction.

### Direction

- Broader parsing coverage: TAF / SPECI
- IWXXM ↔ TAC conversion
- Data & rendering APIs

### Contact

Email [yaojaro@metweave.com](mailto:yaojaro@metweave.com) · GitHub [@yaojaro](https://github.com/yaojaro)

YaoJaro has years of hands-on experience in aviation weather data processing and WebGIS visualization.

---

## License

[MIT](LICENSE) © 2026 YaoJaro
