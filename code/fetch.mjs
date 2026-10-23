/**
 * fetch.mjs — 《风不是一个数》一篇的两份实时数据
 *
 * 跑法：node fetch.mjs
 * 产出：profile.json（16 层廓线）、field.json（850 hPa 华东 10×8 格点）
 *
 * 数据源：Open-Meteo 免费层（api.open-meteo.com）
 *   · 免费层仅限非商用、约 1 万次/天（商用走付费订阅）；数据许可 CC-BY 4.0
 *   · 等压面风是**模式值**，不是探空实测
 *   · 格点间隔 1.5° 即**模型分辨率量级**，不要插值加密冒充高分辨率
 *
 * ⚠️ 实时拉的数字与文章正文里印的数字不同——正文用的是**写作时点的固化快照**
 *    （2026-10-22 00:00 UTC），你拉到的是当下的最新值。数值会变，代码不会。
 *
 * ⚠️ latitude / longitude 必须**等长配对**，API 不做笛卡尔积：
 *    8 个纬度 × 10 个经度要展成 80 对（lat[0],lon[0]),(lat[0],lon[1]),…
 *    直接传 "latitude=24,25.5&longitude=112,113.5" 会报 400
 *    "Parameter 'latitude' and 'longitude' must have the same number of elements"。
 */
import { writeFileSync } from "node:fs";

const LAT = 31.14,
  LON = 121.8; // 上海浦东
const LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200, 150, 100];

// ── ① 廓线：16 个等压面的风速与风向 ────────────────────────────────
const lv = LEVELS.map((p) => `wind_speed_${p}hPa,wind_direction_${p}hPa`).join(",");
const prof = /** @type {OmForecast} */ (
  await (
    await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
        `&hourly=${lv}&wind_speed_unit=kn&forecast_days=1`,
    )
  ).json()
);

writeFileSync(
  "profile.json",
  JSON.stringify(
    {
      time: prof.hourly.time[0],
      levels: LEVELS.map((p) => ({
        p,
        sp: prof.hourly[`wind_speed_${p}hPa`][0],
        dr: prof.hourly[`wind_direction_${p}hPa`][0],
      })),
    },
    null,
    1,
  ),
);
console.log("profile.json ✓ 16 层");

// ── ② 风场：850 hPa 华东 10×8 格点（80 点） ─────────────────────────
const lats = [24, 25.5, 27, 28.5, 30, 31.5, 33, 34.5];
const lons = [112, 113.5, 115, 116.5, 118, 119.5, 121, 122.5, 124, 125.5];

// 等长配对：先展平成 80 对，再分别拼成两个等长串
const laQ = lats.flatMap((la) => lons.map(() => la)).join(",");
const loQ = lats.flatMap(() => lons.map((lo) => lo)).join(",");

const fld = /** @type {OmFieldBatch} */ (
  await (
    await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${laQ}&longitude=${loQ}` +
        `&hourly=wind_speed_850hPa,wind_direction_850hPa&wind_speed_unit=kn&forecast_days=1`,
    )
  ).json()
);

const pts = fld.map((r, i) => ({
  la: lats[Math.floor(i / lons.length)], // 存请求坐标（不是 API 返回的吸附坐标），
  lo: lons[i % lons.length], // 正文 §五 的 indexOf 靠它精确命中
  sp: r.hourly.wind_speed_850hPa[0], // 风速标量（speed），与 profile.json 同名
  d: r.hourly.wind_direction_850hPa[0],
}));

writeFileSync(
  "field.json",
  JSON.stringify(
    { time: fld[0].hourly.time[0], nx: lons.length, ny: lats.length, lats, lons, pts },
    null,
    1,
  ),
);
console.log(`field.json ✓ ${pts.length} 点`);
