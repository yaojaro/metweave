/**
 * demo 内嵌 ICAO → 中文城市/机场名映射（2026-09-24 三角色评测批2#5：小白「机场名全英文，
 * ZWSH 毫无意义」）。39 站与 examples/stations.json 一一对应；缺省回退英文站名（元数据更新
 * 出现新站时不静默丢失）。中文在前、英文括注在后（「北京首都（Beijing Intl）」）。
 */
const ZH_NAMES: Readonly<Record<string, string>> = {
  ZBAA: "北京首都",
  ZBAD: "北京大兴",
  ZBTJ: "天津滨海",
  ZBSJ: "石家庄正定",
  ZBHH: "呼和浩特白塔",
  ZBYN: "太原武宿",
  ZSPD: "上海浦东",
  ZSSS: "上海虹桥",
  ZSHC: "杭州萧山",
  ZSNJ: "南京禄口",
  ZSNB: "宁波栎社",
  ZSQD: "青岛胶东",
  ZSAM: "厦门高崎",
  ZSFZ: "福州长乐",
  ZSOF: "合肥新桥",
  ZGGG: "广州白云",
  ZGSZ: "深圳宝安",
  ZGOW: "揭阳潮汕",
  ZGKL: "桂林两江",
  ZGNN: "南宁吴圩",
  ZGHA: "长沙黄花",
  ZHCC: "郑州新郑",
  ZHEC: "鄂州花湖",
  ZHHH: "武汉天河",
  ZJHK: "海口美兰",
  ZJSY: "三亚凤凰",
  ZUUU: "成都双流",
  ZUTF: "成都天府",
  ZUCK: "重庆江北",
  ZUGY: "贵阳龙洞堡",
  ZPPP: "昆明长水",
  ZLLL: "兰州中川",
  ZLXY: "西安咸阳",
  ZWWW: "乌鲁木齐地窝堡",
  ZWSH: "喀什",
  ZYHB: "哈尔滨太平",
  ZYCC: "长春龙嘉",
  ZYTL: "大连周水子",
  ZYTX: "沈阳桃仙",
};

/** 站点显示名：中文在前、英文括注（无映射的站回退英文——不静默丢名） */
export const stationTitleOf = (icao: string, englishName: string): string => {
  const zh = ZH_NAMES[icao];
  return zh === undefined ? englishName : `${zh}（${englishName}）`;
};
