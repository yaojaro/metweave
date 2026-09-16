/**
 * 由 `pnpm gen:stations` 机械再生——单一来源 = aviationweather.gov/api/data/metar 一次拉取
 * （采集纪律与字段口径见 scripts/generate-stations.mjs）；请勿手改。
 * 生成时刻：2026-09-11T08:29:45.262Z
 */

export interface CnStationRaw {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  elevM: number;
}

export const CN_STATIONS_SOURCE = "aviationweather.gov/api/data/metar";

export const CN_STATIONS_GENERATED_AT = "2026-09-11T08:29:45.262Z";

export const CN_STATIONS_DATA: readonly CnStationRaw[] = [
  {
    icao: "ZBAA",
    name: "Beijing Intl, BJ, CN",
    lat: 40.082,
    lon: 116.603,
    elevM: 31,
  },
  {
    icao: "ZBAD",
    name: "Beijing/Daxing Arpt, BJ, CN",
    lat: 39.501,
    lon: 116.412,
    elevM: 25,
  },
  {
    icao: "ZBTJ",
    name: "Tianjin/Binhai Intl, TJ, CN",
    lat: 39.124,
    lon: 117.346,
    elevM: 4,
  },
  {
    icao: "ZBSJ",
    name: "Zhengding Arpt, HA, CN",
    lat: 38.281,
    lon: 114.697,
    elevM: 70,
  },
  {
    icao: "ZBHH",
    name: "Hohhot/Baita Intl, NM, CN",
    lat: 40.854,
    lon: 111.827,
    elevM: 1081,
  },
  {
    icao: "ZBYN",
    name: "Taiyuan/Wusu Intl, SX, CN",
    lat: 37.747,
    lon: 112.628,
    elevM: 778,
  },
  {
    icao: "ZSPD",
    name: "Shanghai/Pudong Intl, SH, CN",
    lat: 31.146,
    lon: 121.8,
    elevM: 4,
  },
  {
    icao: "ZSSS",
    name: "Shanghai/Hongqiao Intl, SH, CN",
    lat: 31.209,
    lon: 121.337,
    elevM: 2,
  },
  {
    icao: "ZSHC",
    name: "Hangzhou/Xiaoshan Intl, ZJ, CN",
    lat: 30.229,
    lon: 120.434,
    elevM: 8,
  },
  {
    icao: "ZSNJ",
    name: "Nanjing/Lukou Intl, JS, CN",
    lat: 31.739,
    lon: 118.863,
    elevM: 27,
  },
  {
    icao: "ZSNB",
    name: "Ningbo/Lishe Intl, ZJ, CN",
    lat: 29.827,
    lon: 121.462,
    elevM: 5,
  },
  {
    icao: "ZSQD",
    name: "Qingdao/Jiaodong Arpt, SD, CN",
    lat: 36.362,
    lon: 120.087,
    elevM: 2,
  },
  {
    icao: "ZSAM",
    name: "Xiamen-Gaoqi Intl, FJ, CN",
    lat: 24.546,
    lon: 118.131,
    elevM: 13,
  },
  {
    icao: "ZSFZ",
    name: "Fuzhou/Changle Intl, FJ, CN",
    lat: 25.936,
    lon: 119.666,
    elevM: 14,
  },
  {
    icao: "ZSOF",
    name: "Hefei/Xinqiao Intl, AH, CN",
    lat: 31.99,
    lon: 116.965,
    elevM: 64,
  },
  {
    icao: "ZGGG",
    name: "Guangzhou/Baiyun Intl, GD, CN",
    lat: 23.392,
    lon: 113.307,
    elevM: 11,
  },
  {
    icao: "ZGSZ",
    name: "Shenzhen/Boan Intl, GD, CN",
    lat: 22.639,
    lon: 113.803,
    elevM: 18,
  },
  {
    icao: "ZGOW",
    name: "Jieyang/Chaoshan Intl, GD, CN",
    lat: 23.55,
    lon: 116.505,
    elevM: 4,
  },
  {
    icao: "ZGKL",
    name: "Guilin/Liangjiang Intl, GX, CN",
    lat: 25.22,
    lon: 110.04,
    elevM: 151,
  },
  {
    icao: "ZGNN",
    name: "Nanning/Wuwei Intl, GX, CN",
    lat: 22.609,
    lon: 108.173,
    elevM: 128,
  },
  {
    icao: "ZGHA",
    name: "Changsha/Huanghua Arpt, HN, CN",
    lat: 28.18,
    lon: 113.219,
    elevM: 61,
  },
  {
    icao: "ZHCC",
    name: "Zhengzhou/Xinzheng Arpt, HA, CN",
    lat: 34.52,
    lon: 113.834,
    elevM: 149,
  },
  {
    icao: "ZHEC",
    name: "Ezhou Huahu Arpt, HB, CN",
    lat: 30.3424,
    lon: 115.0389,
    elevM: 21,
  },
  {
    icao: "ZHHH",
    name: "Wuhan/Tianhe Intl, HB, CN",
    lat: 30.783,
    lon: 114.205,
    elevM: 33,
  },
  {
    icao: "ZJHK",
    name: "Haikou/Meilan Intl, HI, CN",
    lat: 19.934,
    lon: 110.445,
    elevM: 21,
  },
  {
    icao: "ZJSY",
    name: "Sanya/Phoenix Intl, HN, CN",
    lat: 18.303,
    lon: 109.412,
    elevM: 27,
  },
  {
    icao: "ZUUU",
    name: "Chengdu/Shuangliu Intl, CQ, CN",
    lat: 30.576,
    lon: 103.95,
    elevM: 494,
  },
  {
    icao: "ZUTF",
    name: "Chengdu/Tianfu Arpt, CQ, CN",
    lat: 30.304,
    lon: 104.436,
    elevM: 443,
  },
  {
    icao: "ZUCK",
    name: "Chongqing/Jiangbei Intl, CQ, CN",
    lat: 29.718,
    lon: 106.639,
    elevM: 416,
  },
  {
    icao: "ZUGY",
    name: "Guizhou/Longdongbao Arpt, GZ, CN",
    lat: 26.538,
    lon: 106.801,
    elevM: 1130,
  },
  {
    icao: "ZPPP",
    name: "Kunming/Changshui Intl, YN, CN",
    lat: 25.107,
    lon: 102.934,
    elevM: 2104,
  },
  {
    icao: "ZLLL",
    name: "Lanzhou/Zhongchuan Arpt, GS, CN",
    lat: 36.513,
    lon: 103.623,
    elevM: 1939,
  },
  {
    icao: "ZLXY",
    name: "Xianyang Intl, SN, CN",
    lat: 34.449,
    lon: 108.752,
    elevM: 478,
  },
  {
    icao: "ZWWW",
    name: "\u00dcr\u00fcmqi/Diwopu Arpt, XJ, CN",
    lat: 43.907,
    lon: 87.474,
    elevM: 654,
  },
  {
    icao: "ZWSH",
    name: "Kashgar Arpt, XJ, CN",
    lat: 39.542,
    lon: 76.019,
    elevM: 1374,
  },
  {
    icao: "ZYHB",
    name: "Harbin/Taiping Arpt, HL, CN",
    lat: 45.628,
    lon: 126.259,
    elevM: 134,
  },
  {
    icao: "ZYCC",
    name: "Changchun/Longjia Intl, JL, CN",
    lat: 43.993,
    lon: 125.682,
    elevM: 211,
  },
  {
    icao: "ZYTL",
    name: "Dalian/Zhoushuizi Intl, LN, CN",
    lat: 38.961,
    lon: 121.556,
    elevM: 33,
  },
  {
    icao: "ZYTX",
    name: "Shenyang/Taoxian Intl, LN, CN",
    lat: 41.639,
    lon: 123.485,
    elevM: 56,
  },
];
