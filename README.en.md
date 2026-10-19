<div align="center">

# metweave

**Weave public weather data into embeddable visuals.**

TypeScript toolchain: parse → normalize → render

**Put public weather reports on a map in a few lines of code (bring your own basemap).**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/yaojaro/metweave/actions/workflows/ci.yml/badge.svg)](https://github.com/yaojaro/metweave/actions/workflows/ci.yml)

English | [简体中文](README.md)

</div>

---

**metweave** is a TypeScript toolchain for public weather data: airport reports (METAR / SPECI observations and TAF forecasts) go through one pipeline — **parse → normalize → render** — and come out as report cards and map layers. SPECI is the special observation issued between routine METARs when significant weather changes occur; its format is identical to METAR. Data is fetched directly from public sources — the live endpoint of IEM (Iowa Environmental Mesonet, a public service of Iowa State University) sends open CORS headers, so the browser connects directly; parsing and rendering happen entirely client-side, reports never touch your own server, and no backend is required.

> **METAR in 30 seconds**: a METAR is the one-line hourly (some airports: half-hourly) weather observation in station model code — `ZSPD 120330Z 04004MPS 9999 SCT033 27/18 Q1020 NOSIG` reads, in order: station, time (UTC), wind, visibility, clouds, temperature/dewpoint, altimeter, trend. What metweave does is turn that line into structured data and UI.
> **TAF in 30 seconds**: a TAF is the airport forecast issued every 6 hours (same code family as METAR plus a validity period and change groups) — `TAF ZBAA 240000Z 2400/2506 32004MPS 9999 FEW030 TN14/2403Z TEMPO 2406/2409 4000 -SHRA=` reads: type word, issue time, validity (24th 00Z to 25th 06Z), base conditions (wind/visibility/clouds/temperature extremes) and change groups (TEMPO intermittent windows). metweave expands it into "the forecast state at any moment": drag the timeline and every dot on the map recolors with the forecast.

![metweave live demo: nationwide airport observations as condition-colored dots → zoom into the southwest (Chengdu/Chongqing/Guiyang cluster, amber stations stand out) → hover for a summary tooltip → click to open the Chongqing live report card (observation age, plain-language elements, amber highlighting and raw-code side-by-side)](docs/screenshots/00-demo-overview.gif)

The official examples (`pnpm --filter metweave-examples dev`, one command) offer live/forecast modes on one page with the gridded color-fill as a same-screen layer (GFS 2 m temperature as the default background), plus an IWXXM demo page (`/iwxxm.html`, v0.3 alpha):

- **Live mode (METAR)**: 39 stations as four-tier condition-colored dots, hover tooltips, click-to-open report cards (observation age, plain-language elements, RAW side-by-side with group-level linkage, code tooltips and decode bubbles). The raw section of the card offers a TAC⇄IWXXM (AWC) dual-encoding tab (v0.3 phase 5; the alternate encoding is prefetched in the background and the tab degrades away gracefully on failure). The station list sorts by observation state (tier dot + station + live summary; row click flies to the station and opens the card).
- **Grid layer (v0.3, element by element, same screen as the stations)**: GFS gridded fields rendered as a color-fill beneath the observation/forecast layers — the "Grid layer" panel (top right, on by default) controls: element (13 element profiles: 2 m temperature/dewpoint/relative humidity, CAPE, precipitation rate, visibility, simulated reflectivity, PRMSL, 500 hPa height, surface pressure, 850 hPa temperature, total cloud cover, wind; 2 m temperature uses a diverging blue-white-red scale, each element carries its own color scale and tier profile), opacity (default 0.6, live slider), color legend and time/source line. In dev, a "Pull latest" button fetches the newest NOMADS cycle through a Node-side CLI; without data it falls back to the frozen in-repo baseline (static deployments always render).
- **IWXXM demo page (alpha)**: the NOAA AWC real-time stream (IWXXM 2025-2), global stations on the map — XML is parsed client-side by `parseIwxxm` into the very same IR as TAC, then rendered as cards; the popup's raw section switches between IWXXM (XML) and TAC (source code, from the AWC message's embedded comment). Below the map, a "same-station dual-form comparison" cross-checks both official encodings field by field using official equivalent pairs (static 2023-1 samples).
- **Forecast mode (TAF)**: the same map becomes "forecast-as-observation" — a bottom timeline (next 24 hours, 10-minute steps) supports dragging, tick clicks and one-key playback across the whole span; every dot recolors instantly with the forecast state at that moment (including TEMPO escalation). UTC/Beijing time toggles page-wide. Stations that worsen relative to "now" get an amber outline plus a "view-time vs now" column in the station panel; the panel sorts by tier at the view time, row click flies to the card. Cards show segment details (dominant segment / gradual transition / intermittent windows), temperature extremes and FM rationale lines.

### Why metweave

Excellent open-source parsing libraries already exist (avwx, MetPy, …). metweave does not rebuild those — the real gap is **after** parsing: today, drawing one METAR report card or one gridded color-fill layer on a map still means wrestling with format conversion, unrelated rendering plugins and hand-written glue code. What weather front-ends lack is not another layer library but the layer that connects **parse → normalize → render** into one complete pipeline. That is the layer metweave aims to be.

- The parsing discipline is **never silent**: groups the parser cannot understand go into `warnings[]` (with their span in the raw text); missing-data code groups (`//`, `////`, `/////KT`, `BKN///`) are explicitly modeled as a three-state, never dropped, never fabricated.
- Failures have a stable contract: parse/fetch failures throw `MetarParseError` / `MetarSourceError`; the `code` field is append-only, never changed, so consumers can branch on it. **`message` defaults to Chinese** (v0.1's primary audience) — English text is available via the `EN_MESSAGES[code]` table exported by `@metweave/core`; the full error-code list is in [docs/error-codes.md](docs/error-codes.md). Logging tip: the machine-readable details live on `raw` (e.g. per-station breakdowns for batch failures); `message` is the human-facing Chinese text — capturing only `message` loses the details.
- English display is built in: pass `locale: "en"` for a fully English card or map layer — `renderCard(report, { locale: "en" })` or `addMetarLayer(map, items, { locale: "en" })` (shorthand `card.locale`; card, tooltip and screen-reader tier words all switch). Alerts map to English templates by code. Cloud-base / vertical-visibility units follow the locale: metres in Chinese (CAAC convention), feet in English (the report's native encoding); override with the `heightUnit` option.

### Install

```bash
npm install metweave @metweave/leaflet leaflet
# TypeScript users, also: npm install -D @types/leaflet
```

**Build from source** (to contribute or hack):

```bash
git clone https://github.com/yaojaro/metweave.git
cd metweave && pnpm install && pnpm build
# Dev needs Node ≥ 22.13 (required by pnpm 11; the engines' >=20 is the promise to
# consumers of published artifacts — different scopes; CI runs a single Node 22 for
# this reason, see .github/workflows/ci.yml)
# See it running: one command starts the official examples
pnpm --filter metweave-examples dev
# To use it in your own project: pack the six packages as tgz and install them together with leaflet
pnpm -r --filter '!metweave-monorepo' --filter '!metweave-examples' pack --pack-destination ./dist-pkg/
cd your-project && npm install ~/metweave/dist-pkg/metweave-*.tgz leaflet
```

> Team tip: the tgz route writes `file:` paths into package.json (breaks if paths move) — prefer committing the tgz files to an internal registry, vendoring them, or installing from a fixed in-repo relative path.

### Quick start: bring your own basemap, a few lines to the map

The examples below run in a browser project (Vite/webpack); for Node, see "Thirty seconds in Node" below.

**The quick-start basemap is OpenStreetMap** — swap in any tile source you are licensed to use:

```ts
import * as L from "leaflet";
import "leaflet/dist/leaflet.css"; // required: without it the map renders broken
import { addMetarLayer } from "@metweave/leaflet";
import { getMetarReports } from "metweave/sources";
const map = L.map("map", { center: [35.5, 105], zoom: 4 });
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
  maxZoom: 19,
}).addTo(map);
await addMetarLayer(map, await getMetarReports(), { conditionColors: true });
```

- **Basemap is decoupled**: that `L.tileLayer(...)` line is just your basemap source — metweave binds to no vendor and obtains no licensing for you. For heavy traffic, follow the OSM tile usage policy (self-host or use a commercial provider). A complete two-layer basemap recipe with Chinese annotation layers lives in [`examples/src/basemaps.ts`](examples/src/basemaps.ts).
- **Why the examples default to `conditionColors: true`**: Leaflet's default marker icon URLs 404 under bundlers (icon paths are inferred from CSS and get scattered), while the dot mode is pure CSS with no icon assets. If you prefer default pins, pin the icon URLs once: `L.Icon.Default.mergeOptions({ iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png" })`.
- The default network is China's ASOS network (ASOS = Automated Surface Observing System; 39 stations). Pass another IEM network name to switch — national networks are ISO country code + `__ASOS` (e.g. `DE__ASOS`, `RU__ASOS`), US state networks use a single underscore (`IA_ASOS` / `CO_ASOS`); the full list is at [IEM](https://mesonet.agron.iastate.edu/sites/networks.php).
- Station coordinates: IEM's built-in China-station coordinates are city-level approximations — zoomed-in views should use actual airport positions via the `stations` parameter (join = matching reports to your station metadata table by ICAO code; see [`examples/stations.json`](examples/stations.json)). Note that GCJ-02 basemaps (commonly "Mars coordinates") offset several hundred meters from WGS-84 station coordinates; whether to correct is up to you — metweave ships no correction.
- A complete runnable example (station metadata positioning, RAW side-by-side cards) is in [`examples/`](examples/): `pnpm install && pnpm --filter metweave-examples dev`.

### Thirty seconds in Node

The browser runs the full pipeline (fetch → parse → card → map). Node ≥ 20 (ESM, top-level await — save scripts as `.mjs` or set `"type": "module"`) suits fetching, parsing and consuming the IR (the structured intermediate representation) — the render components need a DOM.

**Already have a report string** (offline/historical/self-fetched METAR), three lines via `parse`:

```ts
import { parse, toValues } from "metweave";
const report = parse("ZSPD 120330Z 04004MPS 9999 SCT033 27/18 Q1020 NOSIG");
console.log(toValues(report).temperature?.celsius, report.warnings); // values + parse warnings (never-silent discipline)
```

**Fetch live reports from the public source** — each item from `getMetarReports` is `{ report, position, title }` (coordinates `[lat, lon]` and station title; the raw text is preserved verbatim in `report.raw`). Wind speed carries its unit, so `4` is readable as 4 mps:

```ts
import { toValues } from "metweave";
import { getMetarReports } from "metweave/sources";
const items = await getMetarReports("CN__ASOS");
for (const { report, title } of items) {
  const { temperature, wind } = toValues(report);
  console.log(title, temperature?.celsius, wind && `${wind.speed.value} ${wind.speed.unit}`);
}
```

**Common fields** (`toValues(report)` gives a two-state view: omitted group and missing both read `undefined`; use the IR's three-state plus `warnings` to distinguish "explicitly missing" from "not reported"):

| You want         | Path                                                                                 | Notes                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Station / raw    | `report.station` / `report.raw`                                                      | ICAO code / verbatim raw text                                                             |
| Observation time | `report.time.{day,hour,minute}`                                                      | UTC; no year/month                                                                        |
| Temp / dewpoint  | `v.temperature?.celsius` / `v.dewpoint?.celsius`                                     | °C                                                                                        |
| Wind             | `v.wind?.direction` `v.wind?.speed.{value,unit}`                                     | unit follows the group (kt/mps/kmh); `direction:null` = variable                          |
| Gust             | `v.wind?.gust?.{value,unit}`                                                         | default: no gust                                                                          |
| Visibility       | `v.visibility?.{value,unit,exact,beyond}`                                            | `exact:false` = threshold code (9999 → ≥10 km etc., direction in `beyond`)                |
| Weather          | `v.weather` (array of `intensity/descriptor/phenomena`)                              | empty array = no significant weather                                                      |
| Clouds           | `v.clouds?.elements` (`amount` + `heightFt.value` in feet) / `v.clouds?.clear?.code` | `heightFt.value:null` = missing ceiling; CAVOK yields the three groups                    |
| Altimeter        | `v.altimeter?.{value,unit}`                                                          | hPa or inHg (unit follows the group)                                                      |
| Trends           | `v.trends` (`kind`/`period`/`raw`)                                                   | NOSIG/BECMG/TEMPO                                                                         |
| Warnings         | `report.warnings` (`code`/`severity`/`span`/`message`)                               | always present; branch on `code`, full list in [docs/error-codes.md](docs/error-codes.md) |

> The station titles above are still ICAO codes — no station metadata was passed. **Precise metadata for the 39 China stations ships with the package**: `import { CN_STATIONS } from "metweave/stations-cn"` and pass it via `getMetarReports("CN__ASOS", { stations: CN_STATIONS })`; `title` becomes "code + station name" and coordinates become exact airport positions (sourced from aviationweather.gov; regenerate with `pnpm gen:stations`; roll your own join from [`examples/stations.json`](examples/stations.json)).

### TAF fetching and CORS (a known trap)

The TAF fetch line (`getTafs` / `getTafReports`, source = aviationweather.gov `api/data/taf`) differs from METAR in one key way: **the upstream sends no CORS headers, so a direct browser fetch is always blocked** — the console shows only `TypeError: Failed to fetch`, with nothing suggesting cross-origin. That is upstream policy, not a bug.

Three ways out (this is why `getTafs` has a `baseUrl` override):

1. **Self-hosted reverse proxy** (easiest in dev): the demo uses a 5-line vite proxy — copy it and call `getTafs(ids, { baseUrl: "/aw-taf" })` (static deployments like GitHub Pages have no vite proxy; bring your own proxy or use the next option).

```ts
// vite.config.ts
server: {
  proxy: {
    "/aw-taf": {
      target: "https://aviationweather.gov",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/aw-taf/, "/api/data/taf"),
    },
  },
}
```

2. **Internal mirror / own gateway**: point `baseUrl` at the mirror's endpoint root (same for the IEM line — `getMetars`'s `baseUrl` is the site root).
3. **Different source**: survey result (tested 2026-09-24) — IEM has a TAF service (`api/1/nws/taf.json`, CORS open) but **US stations only** (KDSM has data, ZBAA returns 0 rows); ogimet/tgftp send no CORS headers. There is currently no CORS-open public TAF source covering Chinese stations, so use route 1/2 there.

`getTafs`'s `date` parameter means "the latest report published as of that moment" (upstream semantics) — useful for viewing the previous issuance cycle (the demo pool fetches `date=now-4h` in parallel and merges both cycles).

### Data sources and risk disclosure

metweave's fetch paths target public data sources, suited to **situational awareness, prototypes and teaching** — not for operational decision chains:

- **IEM (Iowa Environmental Mesonet) is a university-run public aggregator**, not an official distribution channel: data is provided as-is, no SLA, throttling policy unknown, latency per the source (typically 20–50 minutes old).
- The IEM path **cannot distinguish SPECI from METAR** (everything displays as routine); IEM's China-station coordinates are city-level approximations — use the `stations` join for precise positions in serious contexts.
- Basemap: the examples use OpenStreetMap (and optionally Tianditu, whose terms require your own per-app key — the project ships no key and proxies no basemap; you are responsible for basemap licensing and content compliance).
- **The observation data itself**: METAR reports redistributed via public channels (IEM / NWS tgftp etc.) — public-interest channels, not official redistribution; verify the data providers' distribution terms before commercial use.
- The TAF upstream (aviationweather.gov) is likewise as-is, no SLA; browsers need a proxy/mirror (above), and the demo has a single upstream with no failover — if the upstream fails the TAF face degrades (the gray-state tier exists; build your own fallback path).

### Display tiers (home-grown heuristics, fully injectable)

The four-tier condition grading behind the map dots, screen-reader tier words and card row colors (gray unknown / red poor / amber caution / green good) is **this library's own scan heuristic**: thresholds are ours, they neither correspond to nor represent any official flight-weather classification, and the library provides no flight-rules determination — it exists so "a glance shows which stations deserve attention", and it **must not be used as an operational criterion**. The core is a zero-dependency pure function published single-sourced in `@metweave/core` (`metarTierOf` takes a METAR report, `conditionTierOf` a structural subset — feed it the projection of a TAF expansion); `@metweave/leaflet` and `@metweave/render` consume the same source for tiers and row colors (`@metweave/leaflet` re-exports `metarTierOf` / `ConditionTier`).

| Tier            | Trigger (first match from the top wins; otherwise good)                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unknown (gray)  | NIL (no observation from the station); or visibility and clouds both missing and weather missing/none (key groups all missing — nothing to judge on)                                                                                                                                                                                                                                                                                                |
| poor (red)      | Visibility < 1500 m; BKN/OVC layer (incl. vertical visibility) with base < 1000 ft; thunderstorm TS family (incl. VC proximity); GR hail / VA volcanic ash; freezing precipitation (FZRA/FZDZ etc.); + heavy precipitation; funnel cloud / tornado (FC/+FC); sand/dust storm (SS/DS); gust ≥ 25 m/s; CB/TCU convective clouds; runway closure; wind-shear group in the report (WS, standard `WS ALL RWY` / `WS RDRDR` and practical variants alike) |
| caution (amber) | Visibility 1500–5000 m; BKN/OVC base 1000–3000 ft; any precipitation family (RA/SN etc.); squall (SQ, standalone); non-FZ icing phenomena; gust 15–25 m/s                                                                                                                                                                                                                                                                                           |
| good (green)    | everything else (incl. CAVOK)                                                                                                                                                                                                                                                                                                                                                                                                                       |

Missing elements don't constrain (judge on what's available). **Re-grade by your own standard (`tierOf` injection)**: since the built-in heuristic is admittedly not authoritative, there is a handle to replace it wholesale — `addMetarLayer(map, items, { tierOf })` and `renderCard(report, { tierOf })` accept a `(report) => ConditionTier` function; one injection takes effect at three layers (dot color / screen-reader tier word / popup tier badge — the card root carries `data-tier` for your own row-color mapping). Default is the built-in heuristic; a throwing inject fails the whole call — never a silent fallback. Card row-color criteria (group-level danger/caution marks) share the source in `@metweave/core` and evolve with the same table.

**Semver promise on tiers**: semantic changes to the grading always ship as a minor version with a [CHANGELOG](CHANGELOG.md) migration note, never drifting in a patch — WS→red / SQ→amber (v0.3) was the first such minor change; see the unreleased CHANGELOG section for upgrade impact and the customization channel.

### Specification compliance and data validation

The parser takes six specification texts **verbatim** as its encoding baseline; the METAR/SPECI encoding surface (106 clauses) and the TAF (FM 51) surface (24-item checklist: 4 structure / 9 time / 8 elements / 3 verification disciplines) have each passed a clause-level conformance audit (per-clause provenance, implementation site and regression locks in the [docs/compliance.md](docs/compliance.md) audit matrix); unmet items were fixed with zero tolerance:

| Specification                                                                  | Use in this library                                |
| ------------------------------------------------------------------------------ | -------------------------------------------------- |
| WMO No. 306 Vol I.1 (FM 15 METAR/SPECI) + code tables 0919/0519/1079/0366/4678 | International code backbone                        |
| ICAO Annex 3, Meteorological Service for International Air Navigation          | Report templates and element inventory             |
| CAAC surface observation specification (AP-117-TM-2021-01R2)                   | China-region encoding details, Chinese terminology |
| CAAC issuance & exchange measures (AP-117-TM-01R2)                             | Issuance- and exchange-related clauses             |
| US FMH-1, Surface Weather Observations                                         | RMK national supplement groups                     |
| Canada MANOPS-MET                                                              | Canadian forms (////SM etc.)                       |

Four reproducible lines of data validation:

- **Real-corpus replay**: 2,300+ real global reports (2,400+ lines, multi-country network sampling) as a snapshot baseline; drift in unknown forms or warning distribution turns CI red — `pnpm run replay:corpus`
- **Fuzzing**: seeded mutations, 50k cases per run (CI nightly at 100k) asserting eleven output invariants — never crashes, raw fidelity, spans never out of bounds, byte-identical re-parse, no non-finite IR numbers — `pnpm fuzz`
- **Unit tests and fixtures**: 850+ tests repo-wide (grows with versions; CI is the truth), at least one real fixture per anomalous form; every fix ships with a regression lock that must pass mutation verification (it counts only if it catches deliberate breakage)
- **Semantic cross-checks**: dewpoint > temperature, CAVOK contradicting visibility/weather/clouds, QNH beyond world extremes, duplicate groups, VV coexisting with cloud layers — all contradicting forms sound off

Parsing discipline (the IR contract, see [`packages/core/src/ir.ts`](packages/core/src/ir.ts)): the three missing states (group omitted ≠ missing ≠ present) are never conflated; out-of-range values are judged missing, never faked; incomprehensible groups go to `warnings[]` with their raw span; the original code is always recoverable.

Honesty note: the CAAC specifications are per the current official R2 editions; the latest FMH-1 and MANOPS texts are not fully publicly available — relevant clauses cite obtainable official text and are cross-verified against real corpora.

### Package structure

> Newcomers can skip this — `toValues()` alone gives the two-state field view. This section is for advanced scenarios needing the pipeline contract and package boundaries.

| Package                                 | Role                                                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@metweave/core`](packages/core)       | IR data model (the pipeline's stable contract): group-level three-state missing, raw spans, warnings, two-state value view                   |
| [`@metweave/parser`](packages/parser)   | METAR/SPECI tolerant parsing → IR; unknown groups and missing data are never silent                                                          |
| [`@metweave/render`](packages/render)   | Report cards: framework-free DOM components with built-in styles and RAW side-by-side view (missing/warning highlights + hover explanations) |
| [`@metweave/grid`](packages/grid)       | Grid line: GRIB2 decoding + gridded element profiles + contour/wind-barb data plane (d3-contour as the sole runtime dependency)              |
| [`@metweave/leaflet`](packages/leaflet) | Leaflet adapter: reports on a map (markers + tooltips + card popups)                                                                         |
| [`metweave`](packages/metweave)         | Umbrella: re-exports core/parser/render; `metweave/sources` provides fetch helpers                                                           |

### Status

Version policy (v0.x):

- During v0.x, semver pre-1.0 conventions apply: a minor (0.x) may introduce breaking changes; check the [CHANGELOG](CHANGELOG.md) before upgrading.
- All six packages release in lockstep: `@metweave/*` and `metweave` always share one version number (enforced by `pnpm check:workspace`).
- New optional IR fields are additive, not breaking (contract in [`packages/core/src/ir.ts`](packages/core/src/ir.ts)); warning/error `code`s are likewise append-only.

Delivered:

- METAR/SPECI tolerant parser — accepted against real public-report fixtures (at least one real sample per anomalous form): unknown groups into `warnings[]`, three-state missing codes (`//` weather, `////` visibility, `/////KT` wind, cloud-group `///` each in its place), unit-follows-group, out-of-range values (over-range QNH) judged missing with a warning, runway-state groups (WMO 15.13.6 six-digit code / CLRD / SNOCLO), semantic cross-checks (dewpoint inversion, CAVOK contradictions)
- Full TAF (FM 51) forecast side — `parseTaf` tolerant parsing (header / NIL·CNL / change groups / temperature group / dialect absorption), `expandTaf` timeline expansion (segment → mount → bind → merge → overlay), `tafSegments` segment details, `validateTaf` clause-based validation (C2 VRB two-source thresholds / C3 gust / C5 weather whitelist two layers / C7 three-layer selection), `parseTaf({ mode: "strict" })` strict mode (violations aggregate and throw `strict-violation`)
- IWXXM (2023-1/2025-2) XML→IR parsing (v0.3 alpha) — `parseIwxxm` (both METAR/SPECI **and** TAF, dispatched by kind into the two IRs): dual-channel acceptance on official equivalent pairs (METAR 34 stations, 30 exact-equal + TAF 6 stations, 3 of 7 pairs exact-equal, inherent divergences snapshot-locked), NOAA AWC 2025-2 live-stream 41-station corpus single-channel snapshot, ECCC TAF real-stream 6 bulletins screened, version dispatch (supported versions silent, unknown versions best-effort + warning), nilReason three-state placement, RVR trends/limits, runway-state round-trip isomorphism (2023-1 side — removed from the 2025-2 schema); the core IR contract unchanged (see [docs/iwxxm-notes.md](docs/iwxxm-notes.md))
- IWXXM generation (v0.3 alpha) — `serializeIwxxm` (the inverse of `parseIwxxm`; either side's IR written back to IWXXM XML): METAR/SPECI and TAF both sides, CNL/NIL round trips, 2023-1 default + 2025-2 both exits, explicit calendar context (IR has no year/month; we don't guess); official equivalent pairs and AWC corpus pass serialize→re-parse IR exact-equal round trips; outputs pass xmllint + the official XSD full dependency tree (both exits green); a core Schematron rule subset is captured as tests, full validation left to the official toolchain (see [docs/iwxxm-notes.md](docs/iwxxm-notes.md) §10)
- Grid line `@metweave/grid` (v0.3) — in-house GRIB2 decoder (complex packing 5.2/5.3 incl. second-order spatial differencing; point-exact against an eccodes baseline) + viz-ready container (MWGRID1 read/write) + render kernel (bilinear interpolation / graded coloring / per-pixel color-fill) + 13 element profiles (single source of truth for scales and tiers) + contour geometry / field-center detection / wind-barb data plane; the `pnpm gen:grid` CLI fetches GFS from NOMADS, crops to the China domain and lands an in-repo baseline
- Dual fetch lines in sources — `getMetars`/`getMetarReports` (IEM live, CORS-open browser-direct) and `getTafs`/`getTafReports` (aviationweather TAF, no upstream CORS headers, needs proxy/mirror — see "TAF fetching and CORS"); both lines keep a `baseUrl` override — internal mirror / own gateway changes only the root, paths and query strings are assembled here
- IR data model: the sole contract between parser and renderers, plain JSON-serializable, every artifact carries raw spans
- Report cards: ready-made default styling, RAW side-by-side view, built-in Chinese terminology
- Leaflet adapter and end-to-end examples: public reports → parse → map, runnable in [`examples/`](examples/)
- In-repo fuzz suite: seeded mutation replay + eleven output-contract invariants (`pnpm fuzz`, CI nightly at 100k)

Direction:

- Parsing coverage: strict validation for METAR (TAF strict and criterion validation have landed)
- Chart components: streamlines, meteograms (Canvas 2D-first render kernel)
- More map-library adapters (MapLibre etc.), basemap recipe tables

### Participating

The project is currently maintained solo by the author and **does not accept external code contributions** (PRs are closed for now); issues are welcome (templates in [`.github/`](.github/)); security issues go through the private channel in [SECURITY](SECURITY.md). When contributions open, [CONTRIBUTING](CONTRIBUTING.md) will become the full guide.

### Contact

Email [yaojaro@metweave.com](mailto:yaojaro@metweave.com) · GitHub [@yaojaro](https://github.com/yaojaro)

The author YaoJaro has long worked in civil-aviation weather data processing and WebGIS visualization.

### License

**Code**: [MIT](LICENSE) © 2026 YaoJaro — the grant covers **the source code and documentation of this repository only**.

**Data is not covered by the MIT license.** Report samples in `corpus/` and `packages/parser/src/__fixtures__/` are redistributed public-channel data whose rights are decided upstream; this project claims no copyright over them and the MIT grant does not extend to them:

- One source, **IEM (Iowa Environmental Mesonet, Iowa State University)**: its site statement says materials provided are in the public domain, free for anyone to use lawfully, with an ask to credit Iowa State University IEM.
- Another source, **US NOAA / NWS**: unless noted, its web information is public domain and free for lawful use; you may not claim it as your own, imply endorsement or affiliation with NOAA/NWS, or present modified versions as official.
- Another source, **WMO (World Meteorological Organization)**: the IWXXM official translation pairs in `corpus/iwxxm/metar-pairs/` come from the public wmo-im repository (iwxxm-translation, Amd79-80-2023) — technical material WMO opens to members and the public; follow WMO's reuse policy and attribution practice when using them (Source: World Meteorological Organization / wmo-im).
- Another source, **ECCC (Environment and Climate Change Canada)**: the TAF IWXXM live-stream samples in `corpus/iwxxm/eccc/` come from Canada's open government data channel (dd.weather.gc.ca / open.canada.ca) and are redistributed under the **Open Government Licence – Canada**, which requires **attribution**: use must carry "Source: Environment and Climate Change Canada" and comply with its licence terms (no implied ECCC endorsement).
- Samples are included only for the reproducibility of parser testing. **Verify each data provider's distribution terms yourself before commercial use** (see "Data sources and risk disclosure" above).

**No affiliation**: this project has no affiliation, cooperation or endorsement relationship with Iowa State University / IEM, NOAA / NWS, the China Meteorological Administration, the Civil Aviation Administration of China, or Tianditu operators; organization and product names appear only for identification and description.
