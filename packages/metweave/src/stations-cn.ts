/**
 * `metweave/stations-cn` —— 中国 39 站静态元数据（ICAO / 名称 / WGS-84 坐标 / 标高米）。
 *
 * 数据来源 aviationweather.gov（一次采集，`pnpm gen:stations` 单源再生，见 stations-cn.data.ts 头注）；
 * 用途：`getMetarReports(network, { stations })` 联表——IEM 自带的站点坐标是城市级粗定位，
 * 传入本表即得精确机场坐标与站名（「四字码 → 站名」开箱即用）。
 * 事实性元数据，随包分发；观测报文数据不在此列（许可边界见主 README「许可」）。
 */
import type { StationRef } from "./sources.js";
import { CN_STATIONS_DATA } from "./stations-cn.data.js";

/** 一个中国站点的静态元数据（StationRef 联表形态 + 标高） */
export interface CnStation extends StationRef {
  /** 标高（米，上游即米制口径） */
  elevM: number;
}

/** 中国 39 站整网元数据（可直接传给 `getMetarReports` 的 `stations` 参数） */
export const CN_STATIONS: readonly CnStation[] = CN_STATIONS_DATA;
