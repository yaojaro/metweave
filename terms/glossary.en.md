# metweave terminology glossary (English)

> Generated mechanically by `pnpm gen:terms` from `terms/terms.en.json` — do not edit by hand;
> the single hand-editing entry point is `terms/terms.en.json`. Except for entries marked
> `zhOnly` / `enOnly`, the English and Chinese glossaries have one-to-one keys, and metadata must match.

## Standards registry

- **WMO306** — WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI
- **WMO4678** — WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1)
- **ICAOANNEX3** — ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82)
- **FMH1** — US Federal Meteorological Handbook No. 1 — Surface Weather Observations and Reports (FCM-H1-1995, 5th ed., NOAA/NWS)
- **AP117** — CAAC Ground Observation Specifications AP-117-TM-2021-01R2 (Civil Aviation Administration of China)
- **CCAR117** — CCAR-117R1 — China Civil Aviation Meteorological Working Rules
- **MAVIS** — UK Met Office MAVIS — How to decode a METAR (as relayed by an authoritative body)
- **PRODUCT** — Product display copy (no matching standard clause; wording approved by the owner)

## card.label (11 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.label.wind | Wind | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5 (wind direction and speed group dddff) |
| card.label.visibility | Visibility | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.6 (prevailing visibility group VVVV) |
| card.label.weather | Weather | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.8 (present weather group w'w') |
| card.label.clouds | Clouds | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.9 (cloud group NsNsNshshshs) |
| card.label.temperature | Temperature | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.11 (air temperature group T'T') |
| card.label.dewpoint | Dewpoint | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.11 (dewpoint temperature group T'dT'd) |
| card.label.altimeter | QNH | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.12 (QNH group) |
| card.label.rvr | RVR | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7 (RVR group RDRDR/VRVRVRVRi) |
| card.label.trend | Trend | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.14 (Trend forecast) |
| card.label.runwayState | Runway state | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.6 (State of the runway) |
| card.label.windShear | Wind shear | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.3 (Wind shear in the lower layers) |

## card.badge (5 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.badge.speci | SPECI | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.1 template note (1) (aerodrome special meteorological report) |
| card.badge.metar | METAR | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.1 template note (1) (aerodrome routine meteorological report) |
| card.badge.corrected | COR | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.1 template note (2) (COR for corrected reports) |
| card.badge.auto | AUTO | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.4 (Code word AUTO) |
| card.badge.cavokShort | good visibility; no low cloud or significant weather | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## card.missingGroup (4 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.missingGroup.wind | Wind group missing | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.missingGroup.visibility | Visibility group missing | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.missingGroup.weather | Weather group missing | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.missingGroup.rvr | RVR unavailable (RVRNO) | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## card.cavokHint (1 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.cavokHint | CAVOK: visibility ≥10 km, no cloud below 5000 ft, no significant weather, and no CB/TCU at any height | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.10 (Code word CAVOK) |

## card.windShearNote (1 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.windShearNote | Low-level wind shear — a major hazard during takeoff and landing (WS, WMO 306 FM15 §15.13.3) | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.3 (take-off/approach path, runway surface up to 500 m/1600 ft) |

## card.wind (13 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.wind.gust | Gust | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.5 (Gust) |
| card.wind.variable | Variable | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.2 (VRB conditions) |
| card.wind.missing | Wind direction missing | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.wind.calm | Calm | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.4 (calm reported as 00000) |
| card.wind.vrbNote | VRB = variable direction (all sectors) | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.2 (VRB conditions) |
| card.wind.calmNote | Calm = wind speed zero | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.4 (calm reported as 00000) |
| card.wind.variationNote | wind direction variation = the two extreme directions between which the wind varied (clockwise order) | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.3 (two extreme directions, clockwise order) |
| card.wind.hintSep | ;  | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.wind.unit.kt | kt = knots (nautical miles per hour) | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5 (wind speed unit KT) |
| card.wind.unit.mps | mps = meters per second | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5 (wind speed unit MPS) |
| card.wind.unit.kmh | kmh = kilometers per hour | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · FM 15 codes wind speed in KT/MPS only; KMH is accepted tolerantly (used by WMO code families such as FM 50) |
| card.wind.gustOf | (value) => ` (Gust ${value})` | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.wind.variationOf | (min, max) => `(wind varying between ${deg3(min)}° and ${deg3(max)}°)` | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## card.cloud (26 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.cloud.amount.FEW | Few: 1–2 oktas (1/8–2/8) | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · Annex 3 METAR/SPECI template (FEW = 1–2 oktas, abbreviation scheme) |
| card.cloud.amount.SCT | Scattered: 3–4 oktas (3/8–4/8) | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · Annex 3 METAR/SPECI template (SCT = 3–4 oktas) |
| card.cloud.amount.BKN | Broken: 5–7 oktas (5/8–7/8) | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · Annex 3 METAR/SPECI template (BKN = 5–7 oktas) |
| card.cloud.amount.OVC | Overcast: 8 oktas (8/8, sky fully covered) | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · Annex 3 METAR/SPECI template (OVC = 8 oktas) |
| card.cloud.shortAmount.FEW | few | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.cloud.shortAmount.SCT | scattered | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.cloud.shortAmount.BKN | broken | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.cloud.shortAmount.OVC | overcast | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.cloud.baseShortMeters | (meters) => `, base ≈ ${meters} m` | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.cloud.metersShort | (meters) => ` ≈ ${meters} m` | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.cloud.baseShortFeet | (feet) => `, base ${feet} ft` | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.cloud.feetShort | (feet) => ` ${feet} ft` | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.cloud.metersDerivedNote |  (metres are converted by this library at 1 ft = 0.3048 m; the report codes cloud base in feet in 100 ft steps, so the metre value is approximate) | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.cloud.amountUnknown | cloud amount not reported | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.cloud.vvMissing | vertical visibility not reported | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.cloud.heightUnknown | cloud base not reported | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.cloud.vvShort | vertical visibility | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.cloud.baseFtMeters | (feet, meters) => `, base ${feet} ft ≈ ${meters} m` | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.cloud.minimumOf | (meters, direction) => `minimum visibility ${meters} m (${direction})` | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.cloud.skyClear.SKC | no clouds (manual observation) | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · Annex 3 METAR/SPECI template (NSC = no significant cloud; NCD = nil cloud detected; SKC/CLR are North American practice codes) |
| card.cloud.skyClear.NSC | no significant clouds | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · Annex 3 METAR/SPECI template (NSC = no significant cloud; NCD = nil cloud detected; SKC/CLR are North American practice codes) |
| card.cloud.skyClear.NCD | no clouds detected (automatic station) | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · Annex 3 METAR/SPECI template (NSC = no significant cloud; NCD = nil cloud detected; SKC/CLR are North American practice codes) |
| card.cloud.skyClear.CLR | no clouds (automatic observation) | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · Annex 3 METAR/SPECI template (NSC = no significant cloud; NCD = nil cloud detected; SKC/CLR are North American practice codes) |
| card.cloud.cbNote |  (CB cumulonimbus: thunderstorm, hail, severe turbulence risk) | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.9.1.3 (CB abbreviation and reporting requirement) |
| card.cloud.tcuNote |  (TCU towering cumulus: severe turbulence and icing risk) | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.9.1.3 (TCU abbreviation note) |
| card.cloud.vv | VV = vertical visibility: height visible when the sky is fully obscured | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.9.2 note 1 (vertical visibility) |

## card.wx (42 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.wx.phenomena.DZ | drizzle | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.phenomena.RA | rain | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.phenomena.SN | snow | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.phenomena.SG | snow grains | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.phenomena.IC | ice crystals | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · No WMO TAC 4678 / AP-117 table entry (US practice; NWS decode key and FAA JO 7340.2: ice crystals) |
| card.wx.phenomena.PL | ice pellets | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.phenomena.GR | hail | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.phenomena.GS | small hail and/or snow pellets | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.phenomena.UP | unknown precipitation | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.phenomena.BR | mist | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.phenomena.FG | fog | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.phenomena.FU | smoke | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.phenomena.VA | volcanic ash | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.phenomena.DU | widespread dust | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.phenomena.SA | sand | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.phenomena.HZ | haze | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.phenomena.PY | spray | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · No WMO TAC 4678 / AP-117 table entry (US FMH-1 usage); "spray" is the common rendering |
| card.wx.phenomena.PO | dust/sand whirls (dust devils) | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.phenomena.SQ | squalls | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.phenomena.FC | funnel cloud (tornado or waterspout) | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.phenomena.SS | sandstorm | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.phenomena.DS | duststorm | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (present-weather abbreviations) |
| card.wx.descriptors.MI | shallow | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (descriptors) |
| card.wx.descriptors.PR | partial | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (descriptors) |
| card.wx.descriptors.BC | patches | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (descriptors) |
| card.wx.descriptors.DR | low drifting | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (descriptors) |
| card.wx.descriptors.BL | blowing | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (descriptors) |
| card.wx.descriptors.SH | showers | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (descriptors) |
| card.wx.descriptors.TS | thunderstorm | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (descriptors) |
| card.wx.descriptors.FZ | freezing | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (descriptors) |
| card.wx.heavy | Heavy | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (+ intensity indicator); WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.8.1 (intensity indicators per Code table 4678) |
| card.wx.light | Light | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (- light intensity indicator); WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.8.1 (intensity indicators per Code table 4678) |
| card.wx.heavyPlain | Heavy | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (+ intensity indicator); WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.8.1 (intensity indicators per Code table 4678) |
| card.wx.lightPlain | Light | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (- light intensity indicator); WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.8.1 (intensity indicators per Code table 4678) |
| card.wx.proximityPrefix | null | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (VC proximity qualifier) |
| card.wx.proximitySuffix |  in vicinity | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (VC proximity qualifier) |
| card.wx.thunderstorm | thunderstorm | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (TS) |
| card.wx.thunderstormWith | (phenom) => `thunderstorm with ${phenom}` | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · Code table 4678 (TS combined with precipitation) |
| card.wx.descCompose | (descriptor, phenom) =>
        descriptor === "showers"
          ? phenom === ""
            ? "showers (type indistinguishable)"
            : `${phenom} showers`
          : phenom === ""
            ? descriptor
            : `${descriptor} ${phenom}` | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.wx.join |  and  | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.wx.joinParts |   | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.wx.hazard |  (major flight hazard) | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## card.timeText (1 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.timeText | (t) =>
      `Day ${t.day}, ${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")} UTC` | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## card.ago (1 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.ago | (minutes) =>
      minutes < 60
        ? ` (${minutes} min ago)`
        : minutes < 48 * 60
          ? ` (${Math.floor(minutes / 60)} h ago)`
          : ` (${Math.floor(minutes / 1440)} d ago)` | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## card.rvrNote (3 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.rvrNote.varying | V = varying between two extreme values during the period | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · Annex 3 METAR/SPECI template (varying form RvvvVvvv); WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.4 (in the context of the ten-minute observation period); MAVIS · UK Met Office MAVIS — How to decode a METAR (as relayed by an authoritative body) · METAR decode — meaning of the RVR V group (varying between two values) |
| card.rvrNote.trend | U/D/N = up/down/no change | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.4.3 (tendency U/D/N) |
| card.rvrNote.beyond | P/M prefix = above the upper / below the lower limit | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.5 (Extreme values: P/M indicators) |

## card.rvr (9 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.rvr.runway | (runway) => `Runway ${runway}` | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.1 (the runway designator RDRDR) |
| card.rvr.above | above  | official | packages/render/src/card.ts#LOCALE | FMH1 · US Federal Meteorological Handbook No. 1 — Surface Weather Observations and Reports (FCM-H1-1995, 5th ed., NOAA/NWS) · ch.12 (the P prefix = above the maximum reportable value) |
| card.rvr.below | below  | official | packages/render/src/card.ts#LOCALE | FMH1 · US Federal Meteorological Handbook No. 1 — Surface Weather Observations and Reports (FCM-H1-1995, 5th ed., NOAA/NWS) · ch.12 (the M prefix = below the minimum reportable value) |
| card.rvr.varying | (min, max, unit) => `varying between ${min} and ${max} ${unit}` | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.4 (the V varying form) |
| card.rvr.unit.m | m | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.1–§15.7.3 (RVR coded in metres) |
| card.rvr.unit.ft | ft | official | packages/render/src/card.ts#LOCALE | FMH1 · US Federal Meteorological Handbook No. 1 — Surface Weather Observations and Reports (FCM-H1-1995, 5th ed., NOAA/NWS) · ch.12 (the FT suffix = feet) |
| card.rvr.trendUp | , trend up | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.4.3 (U = upward tendency) |
| card.rvr.trendDown | , trend down | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.4.3 (D = downward tendency) |
| card.rvr.trendNoChange | , no change | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.4.3 (N = no change) |

## card.ws (2 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.ws.all | all runways affected | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.3 (the WS ALL RWY all-runways form) |
| card.ws.runways | (runways) => `runways ${runways} affected` | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.3 (the WS RDRDR runway form) |

## card.decode (17 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.decode.title | How this was decoded (code → meaning) | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.decode.code | Code | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.decode.basisLabel | Basis:  | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.decode.cite.cavok | WMO No. 306 Vol I.1 (2019), FM 15 §15.10 — CAVOK replaces visibility/weather/cloud groups: vis ≥10 km, no low cloud or CB/TCU, no significant weather | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.10 (CAVOK replaces the visibility, weather and cloud groups) |
| card.decode.cite.wind | WMO No. 306 Vol I.1 (2019), FM 15 §15.5.1–15.5.6 — dddff = 10-min mean wind direction and speed, unit suffix follows the group (§15.5.1); VRB variable, 00000 calm, G gust, P above-range (same section) | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.1–§15.5.6 (wind direction and speed group dddff) |
| card.decode.cite.windVariation | WMO No. 306 Vol I.1 (2019), FM 15 §15.5.3 — dndndnVdxdxdx = the two extreme directions when variation is ≥60° and <180° (clockwise) | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.3 (direction variation group dndndnVdxdxdx) |
| card.decode.cite.visibility | WMO No. 306 Vol I.1 (2019), FM 15 §15.6.1, §15.6.3 — VVVV = prevailing visibility, 4 digits in metres; 9999 = 10 km or more (ceiling code) | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.6.1, §15.6.3 (prevailing visibility VVVV; the 9999 upper-limit code) |
| card.decode.cite.visMinimum | WMO No. 306 Vol I.1 (2019), FM 15 §15.6.2 — VNVNVNVNDv = minimum visibility and its compass direction (when markedly different from prevailing) | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.6.2 (minimum visibility with compass direction) |
| card.decode.cite.rvr | WMO No. 306 Vol I.1 (2019), FM 15 §15.7.1–15.7.5 — RVR group: 4-digit metre value (up to 4 runways), P/M beyond-range, V fluctuation, U/D/N trend; FT suffix = feet (US FMH-1) | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.1–§15.7.5 (RVR group); FMH1 · US Federal Meteorological Handbook No. 1 — Surface Weather Observations and Reports (FCM-H1-1995, 5th ed., NOAA/NWS) · ch.12 (RVR coding: the FT suffix and P/M indicators) |
| card.decode.cite.weather | WMO No. 306 Vol I.1 (2019), FM 15 §15.8 and Code table 4678 — up to three groups; order = intensity/proximity → descriptor → phenomenon; UP = precipitation unidentified by automatic station (§15.8.6) | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.8 (present weather w'w'); WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · the present-weather abbreviation table |
| card.decode.cite.clouds | WMO No. 306 Vol I.1 (2019), FM 15 §15.9.1 — amount FEW/SCT/BKN/OVC (oktas) + base height in hundreds of feet (30 m/100 ft steps); CB/TCU convective appendix (§15.9.1.7) | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.9.1, §15.9.1.7 (the cloud group; CB/TCU appendages) |
| card.decode.cite.skyClear | WMO No. 306 Vol I.1 (2019), FM 15 §15.9.1.1 — NSC/NCD no-cloud codes (NCD = automatic, none detected); CLR is the US code (FMH-1, FCM-H1-1995) | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.9.1.1 (the NSC/NCD no-cloud codes); FMH1 · US Federal Meteorological Handbook No. 1 — Surface Weather Observations and Reports (FCM-H1-1995, 5th ed., NOAA/NWS) · ch.12 (CLR, the US code; FCM-H1-1995) |
| card.decode.cite.tempDew | WMO No. 306 Vol I.1 (2019), FM 15 §15.11 — T'T'/T'dT'd = whole-°C temperature/dewpoint, M prefix for negative (M00 = −0.5 °C); US form in FMH-1 §12.6.10 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.11 (the T'T'/T'dT'd temperature-dewpoint group); FMH1 · US Federal Meteorological Handbook No. 1 — Surface Weather Observations and Reports (FCM-H1-1995, 5th ed., NOAA/NWS) · §12.6.10 (the US form) |
| card.decode.cite.qnh | WMO No. 306 Vol I.1 (2019), FM 15 §15.12 — Qxxxx = QNH in whole hPa (leading 0 below 1000); Axxxx = US altimeter setting (implied 2 decimals, inHg; FMH-1) | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.12 (the Qxxxx QNH group); FMH1 · US Federal Meteorological Handbook No. 1 — Surface Weather Observations and Reports (FCM-H1-1995, 5th ed., NOAA/NWS) · ch.12 (the Axxxx altimeter setting) |
| card.decode.cite.runwayState | WMO No. 306 Vol I.1 (2019), FM 15 §15.13.6 — runway-state codes per code tables 0919/0519/1079/0366; R/SNOCLO = closed, CLRD = cleared | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.6 (runway state; code tables 0919/0519/1079/0366) |
| card.decode.cite.windShear | WMO No. 306 Vol I.1 (2019), FM 15 §15.13.3 — WS RDRDR / WS ALL RWY = low-level wind shear on the takeoff/approach path | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.3 (low-level wind shear WS) |
| card.decode.cite.trend | WMO No. 306 Vol I.1 (2019), FM 15 §15.14 — BECMG gradual, TEMPO temporary, NOSIG no significant change (§15.14.15); period FM/TL/AT (§15.14.3) | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.14 (the trend section; NOSIG §15.14.15, period words §15.14.3) |

## card.trendNote (8 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.trendNote.nosig | no significant change expected | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.14.15 (NOSIG = no significant change) |
| card.trendNote.becmg | gradual change | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.14.4 (BECMG) |
| card.trendNote.tempo | temporary fluctuations | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.14.5 (TEMPO temporary fluctuations) |
| card.trendNote.unspecified | worn trend segment (change indicator lost; gradual vs temporary indistinguishable) | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.trendNote.periodAt | (text) => {
        const m = /^(AT\|TL\|FM)(\d{2})(\d{2})$/.exec(text);
        if (m === null) return `expected at ${text}`;
        const hm = `${m[2]}:${m[3]}`;
        return m[1] === "TL" ? `until ${hm}` : m[1] === "FM" ? `from ${hm}` : `at ${hm}`;
      } | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.14.3 (FM from / TL until / AT at) |
| card.trendNote.contentLead | expected:  | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.trendNote.nsw | NSW = no significant weather in the trend period | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · NSW = No significant weather (code table 4678 note: trend forecasts only) |
| card.trendNote.windShear | wind shear embedded in the trend (WS) — caution on takeoff/landing | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## card.warningText (1 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.warningText | (code, _message, rawSlice) =>
      WARNINGS_EN[code] !== undefined
        ? WARNINGS_EN[code](rawSlice ?? "")
        : rawSlice !== undefined && rawSlice !== ""
          ? `${code}: ${rawSlice}`
          : code | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## card.sep (1 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.sep |  ·  | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## card.rwy (32 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.rwy.closed | Runway closed | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 1079 (99 runway non-operational due to snow, slush, ice, large drifts or runway clearance, but depth not reported) |
| card.rwy.closedAll | All runways closed | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.6 (R/SNOCLO: aerodrome closed due to extreme deposit of snow) |
| card.rwy.cleared | Cleared | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.6 (CLRD//: contaminations ceased to exist) |
| card.rwy.deposit.0 | clear and dry | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0919 (0: clear and dry) |
| card.rwy.deposit.1 | damp | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0919 (1: damp) |
| card.rwy.deposit.2 | wet and water patches | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0919 (2: wet and water patches) |
| card.rwy.deposit.3 | rime and frost covered | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0919 (3: rime and frost covered) |
| card.rwy.deposit.4 | dry snow | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0919 (4: dry snow) |
| card.rwy.deposit.5 | wet snow | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0919 (5: wet snow) |
| card.rwy.deposit.6 | slush | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0919 (6: slush) |
| card.rwy.deposit.7 | ice | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0919 (7: ice) |
| card.rwy.deposit.8 | compacted or rolled snow | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0919 (8: compacted or rolled snow) |
| card.rwy.deposit.9 | frozen ruts or ridges | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0919 (9: frozen ruts or ridges) |
| card.rwy.coverage.1 | <10% | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0519 (1: less than 10%) |
| card.rwy.coverage.2 | 11–25% | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0519 (2: 11–25%) |
| card.rwy.coverage.5 | 26–50% | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0519 (5: 26–50%) |
| card.rwy.coverage.9 | 51–100% | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0519 (9: 51–100%) |
| card.rwy.coverageLabel | coverage  | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.rwy.depthLabel | depth  | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.rwy.depthText | (mm) =>
        mm === 0 ? "<1 mm" : mm === 400 ? "≥40 cm" : mm >= 100 ? `${mm / 10} cm` : `${mm} mm` | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 1079 (00 = less than 1 mm; 01–90 = millimetres; 92–98 = 10–40 cm; 98 = 40 cm or more) |
| card.rwy.friction | (coeff) => `friction ${coeff.toFixed(2)}` | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0366 (00–90 friction coefficient 0.00–0.90) |
| card.rwy.brakingLabel | braking  | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.rwy.braking.poor | poor | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0366 (91 braking action poor) |
| card.rwy.braking.medium-poor | medium/poor | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0366 (92 braking action medium/poor) |
| card.rwy.braking.medium | medium | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0366 (93 braking action medium) |
| card.rwy.braking.medium-good | medium/good | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0366 (94 braking action medium/good) |
| card.rwy.braking.good | good | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0366 (95 braking action good) |
| card.rwy.braking.unreliable | unreliable | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 0366 (99 unreliable) |
| card.rwy.closedNote | runway non-operational (depth digit 99 = closed due to snow/slush/ice/large drifts/runway clearance, depth not reported; SNOCLO = aerodrome closed due to extreme deposit of snow) | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · Code table 1079 code 99 and §15.13.6 (SNOCLO) are modelled as distinct semantics |
| card.rwy.clearedNote | CLRD: contamination cleared (followed by two friction digits or //) | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.6 (CLRD followed by a two-digit friction figure or //) |
| card.rwy.wmoNote | WMO 306 FM15 §15.13.6 runway state code (code tables 0919/0519/1079/0366; verified against official WMO tables 2026-09-13, pending owner review) | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| card.rwy.itemSep | ,  | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## card.colon (1 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.colon | :  | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## card.dash (1 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| card.dash |  —  | product | packages/render/src/card.ts#LOCALE | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## leaflet.tier (4 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| leaflet.tier.unknown | Weather unknown | product | packages/leaflet/src/index.ts#TIER_WORDS | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| leaflet.tier.poor | Weather poor | product | packages/leaflet/src/index.ts#TIER_WORDS | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| leaflet.tier.caution | Weather caution | product | packages/leaflet/src/index.ts#TIER_WORDS | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
| leaflet.tier.good | Weather good | product | packages/leaflet/src/index.ts#TIER_WORDS | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## errors.invalid-input (1 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| errors.invalid-input | Parse expects a METAR/SPECI report string, received a non-string value | product | packages/core/src/errors.ts#EN_MESSAGES | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## errors.missing-station (1 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| errors.missing-station | Not a METAR/SPECI report: station group missing or unrecognized | product | packages/core/src/errors.ts#EN_MESSAGES | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## errors.missing-time (1 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| errors.missing-time | Not a complete METAR/SPECI report: observation-time group missing | product | packages/core/src/errors.ts#EN_MESSAGES | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## errors.invalid-time (1 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| errors.invalid-time | Observation-time group out of range (day 01–31 / hour 00–23 / minute 00–59) | product | packages/core/src/errors.ts#EN_MESSAGES | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## errors.unsupported-mode (1 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| errors.unsupported-mode | Strict mode is not implemented in v0.1 — omit `mode` or pass 'tolerant' | product | packages/core/src/errors.ts#EN_MESSAGES | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## errors.batch-parse-failed (1 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| errors.batch-parse-failed | Some reports in the batch failed to parse entirely (see the summary for per-station reasons) | product | packages/core/src/errors.ts#EN_MESSAGES | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## errors.http-error (1 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| errors.http-error | Source returned a non-2xx HTTP status | product | packages/core/src/errors.ts#EN_MESSAGES | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## errors.bad-schema (1 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| errors.bad-schema | Response body does not match the agreed schema | product | packages/core/src/errors.ts#EN_MESSAGES | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## errors.empty-data (1 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| errors.empty-data | HTTP 200 with empty data — typically a wrong network name | product | packages/core/src/errors.ts#EN_MESSAGES | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## errors.timeout (1 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| errors.timeout | Request aborted after the configured timeout | product | packages/core/src/errors.ts#EN_MESSAGES | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |

## errors.network (1 entries)

| key | Text | kind | Usage | Standard · Document · Clause |
|---|---|---|---|---|
| errors.network | Network-level failure (offline, DNS, fetch refused) | product | packages/core/src/errors.ts#EN_MESSAGES | PRODUCT · Product display copy (no matching standard clause; wording approved by the owner) · Self-authored display copy (no matching standard clause) |
