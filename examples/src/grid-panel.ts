/**
 * 主示例页「格点图层」抽屉（v0.3.1 产品形态：顶栏「格点图层」按钮唤起、右侧滑出）。
 *
 * 抽屉结构（自上而下）：标题行（含收起钮）→「拉最新」＋不透明度滑杆（置顶）→头部
 * 状态行（只承载加载中/错误+重试/未选择提示——成功态溯源随选中行展开体展示，头部
 * 不重复）→要素行列表（**从所在位置到抽屉底的固定高度框**，超出
 * 上下滚动——flex 余高＋min-height:0＋overflow-y:auto）。每要素一行：行头（名称＋
 * 单位）点击选中，**再点选中行＝取消**（不选＝不展示图层，色斑/等值线/风杆整层摘除）；
 * 选中行展开体＝整合色卡（颜色渐变条＋刻度值在条下**对应位置**展示——首末锚定边缘、
 * 近值碰撞右让保可读）＋数据源行（直读容器头 meta）＋要素描述文案（demo 层 UI 文案
 * 单源，见 ELEMENT_DESCRIPTIONS——档案只管口径，面向读者的叙述不进内核包）。
 *
 * 预报时效（fhour）：抽屉头部「预报时效」**步进器**（◀ 值钮 ▶，不走下拉）——值钮
 * 点击切换「自动」（缺省）⇄手动定档、◀▶ 逐小时调档（f00–f72 边界禁用；自动态下
 * 步进即从当前档脱钩为手动）。自动＝初载 f000 后按容器头起报时次的时效龄探测最近档
 * （autoTrackFhour 纯函数：龄取整收敛 [0,72]），档在则跳、不在则诚实留在 f000；
 * 「拉最新」请求服务端 auto 定档、按应答回带的实际 fhour 构造产物名直载（客户端
 * 不猜文件名）。缓存键 element@fhour——切时效/切回零重复 fetch。
 *
 * 数据链复用 src/grid-data.ts（「最新」三层语义＋内存缓存 Map）：取消后再选走缓存
 * 零 fetch；「拉最新」dev 中间件在位才显示，取消选中期间禁用。三态自含于 #grid-meta
 * 行不占全局状态条。色斑层挂 @metweave/leaflet 独立 pane：底图之上、站点标记与弹窗
 * 之下，与实况/预报模式切换无关。等值线主导要素（renderForm "filled+contours"）在
 * 色斑之上叠等值线＋标注层（L/H 中心随档案 contours.centers 口径）；双分量要素
 * （"filled+barbs"）叠风向杆层——显隐随选中/切换同进退，面板零要素名特判。
 */
import { addContourLayer, addGridLayer, addWindBarbLayer } from "@metweave/leaflet";
import { buildColorScale } from "@metweave/grid";
import type * as LeafletNS from "leaflet";
import {
  GRID_ELEMENTS,
  loadGridElement,
  probeGenGridApi,
  pullLatestElement,
  resolveInitialElement,
  type GridElementSpec,
  type JsonFetch,
  type LoadedGrid,
  type UrlFetch,
} from "./grid-data";

/** 滑杆刻度：0.2–0.9、步进 0.05；缺省 0.6 与 addGridLayer 的 API 缺省一致 */
export const GRID_OPACITY_MIN = 0.2;
export const GRID_OPACITY_MAX = 0.9;
export const GRID_OPACITY_STEP = 0.05;
export const GRID_OPACITY_DEFAULT = 0.6;

/** 预报时效上限（面板可选档 f00–f72——owner 定案；GFS 0.25° 逐小时区到 f120） */
export const GRID_FHOUR_MAX = 72;

/** 缓存键 element@fhour（切时效不互踩；「拉最新」bust 重取覆写对应条目）。 */
const cacheKeyOf = (spec: GridElementSpec, fhour: number): string =>
  `${spec.profile.shortName}@f${fhour}`;

/**
 * 自动时效（纯函数）：起报时次的时效龄取整，收敛到 [0, 72]——「离当前时刻最近的
 * 预报时次」。0＝龄不足半点或时钟异常（不跳档）。now 注入可测。
 */
export function autoTrackFhour(referenceTime: string, now = Date.now()): number {
  const t = Date.parse(referenceTime);
  if (!Number.isFinite(t)) return 0;
  const ageH = (now - t) / 3_600_000;
  if (ageH < 0.5) return 0;
  return Math.min(GRID_FHOUR_MAX, Math.round(ageH));
}

/**
 * 滑杆值解析（纯函数）：非法/空输入回落缺省，越界收敛到滑杆域，浮点串直收。
 * 滑杆的 step 对齐值由浏览器保证，这里只兜 DOM 直改 value 与程序赋值的边界
 * （空串 Number() 得 0——须先判空，否则被误收敛到下界）。
 */
export function parseOpacityInput(raw: string): number {
  if (raw.trim() === "") return GRID_OPACITY_DEFAULT;
  const v = Number(raw);
  if (!Number.isFinite(v)) return GRID_OPACITY_DEFAULT;
  return Math.min(Math.max(v, GRID_OPACITY_MIN), GRID_OPACITY_MAX);
}

/** 时次/溯源行：直读容器头 meta（起报时次/预报时效/溯源行）＋数据层标注。 */
export function gridMetaLine(spec: GridElementSpec, loaded: LoadedGrid): string {
  const meta = loaded.grid.header.meta;
  const via = loaded.source === "gen" ? "" : " · 仓内冻结基线（非最新）";
  return `${spec.profile.labelZh}（${spec.profile.displayUnit}）· 起报 ${meta.referenceTime} · f${String(meta.forecastHour).padStart(2, "0")} · ${meta.source}${via}`;
}

/**
 * 图例刻度取值域（纯函数）：等距档用档案固定域端点，分位数档用场统计端点（经 toDisplay）；
 * 与断点（已是显示单位）拼成全档序列后抽样——首末恒保留、中间至多 ~9 档。
 * 阈值档刻度＝场最小值＋阈值本身（值少全标；无上缘——末档 [末阈值,∞) 外延无界，
 * 透明首档不标——透明无值可读）。log₁₀ 要素（如 prate）零适配：断点声明留在显示
 * （线性）空间（对数变换只在渲染定档空间），本函数直读 breaks 恒得线性阈值原值
 * （0.1/1/5/10 mm/h，不出现对数断点 −1/0/log₁₀5/1）。病态档案（模式缺推荐参数）
 * 由 buildColorScale 先抛错。
 */
export function legendTickValues(
  spec: GridElementSpec,
  stats: LoadedGrid["grid"]["header"]["stats"],
): number[] {
  const p = spec.profile;
  const scale = buildColorScale(p, stats);
  const eq = p.defaultMode === "equal" ? p.equal : undefined;
  const all =
    p.defaultMode === "threshold"
      ? [p.toDisplay(stats.min), ...scale.breaks]
      : [eq?.min ?? p.toDisplay(stats.min), ...scale.breaks, eq?.max ?? p.toDisplay(stats.max)];
  const step = Math.max(1, Math.ceil(all.length / 9));
  return all.filter((_, i) => i % step === 0 || i === all.length - 1);
}

/** 刻度值格式化：整数原样、非整数保留一位小数（log₁₀ 要素的线性阈值如 0.1 mm/h 不得被取整吞位）；非有限 → —。 */
const fmtValue = (v: number): string => {
  if (!Number.isFinite(v)) return "—";
  return Number.isInteger(v) ? `${v}` : `${Math.round(v * 10) / 10}`;
};

/** 整合色卡的刻度定位（纯函数输出）。 */
export interface LegendTickLayout {
  readonly value: number;
  /** 左缘百分比（0–100，色带宽度空间） */
  readonly pct: number;
  /** 首末锚定（防溢出）：left＝0% 左缘对齐、right＝100% 右缘对齐、center＝居中位移 */
  readonly anchor: "left" | "center" | "right";
}

/**
 * 刻度在色带下的对应位置（纯函数）：值按首末张成的域线性映射到 0–100%；**近值碰撞
 * 右让**——相邻中位刻度最小间距 6%（如 prate 的 0 与 0.1 mm/h 线性位置仅差 1%，
 * 按位硬放必重叠），首刻度恒锚 0%、末刻度恒锚 100%（域端点语义不因避让漂移）。
 */
export function legendTickLayout(values: readonly number[]): LegendTickLayout[] {
  if (values.length === 0) return [];
  const lo = values[0] ?? 0;
  const hi = values.at(-1) ?? 0;
  const span = hi - lo;
  const MIN_GAP = 6;
  let prev = Number.NaN;
  return values.map((value, i): LegendTickLayout => {
    if (i === 0) {
      prev = 0;
      return { value, pct: 0, anchor: "left" };
    }
    if (i === values.length - 1) {
      return { value, pct: 100, anchor: "right" };
    }
    const raw = span <= 0 ? 50 : ((value - lo) / span) * 100;
    const floor = Number.isFinite(prev) ? prev + MIN_GAP : MIN_GAP;
    const pct = Math.min(Math.max(raw, floor), 100 - MIN_GAP);
    prev = pct;
    return { value, pct, anchor: "center" };
  });
}

/**
 * 整合色卡（颜色与值一体，档案 colorStops 单源）：渐变条＋刻度值在条下**对应位置**
 * （legendTickLayout 定位；threshold 档可选末档注记——档案 topBinNote，满量程哨兵
 * 等审查语义），返回新节点由调用方挂载。
 */
export function buildGridLegend(spec: GridElementSpec, loaded: LoadedGrid): HTMLElement {
  const box = document.createElement("div");
  box.className = "mw-grid-legend";
  const p = spec.profile;
  const bar = document.createElement("div");
  bar.className = "mw-grid-legend-bar";
  bar.style.background = `linear-gradient(90deg, ${p.colorStops.join(", ")})`;
  box.append(bar);
  const ticks = document.createElement("div");
  ticks.className = "mw-grid-legend-ticks";
  for (const { value, pct, anchor } of legendTickLayout(
    legendTickValues(spec, loaded.grid.header.stats),
  )) {
    const t = document.createElement("span");
    t.textContent = fmtValue(value);
    t.style.left = `${pct}%`;
    t.style.transform =
      anchor === "left" ? "none" : anchor === "right" ? "translateX(-100%)" : "translateX(-50%)";
    ticks.append(t);
  }
  box.append(ticks);
  // 末档注记（可选）：刻度行下方右缘语义位（标注最高档的量程顶），缺席＝零渲染
  if (p.topBinNote !== undefined) {
    const note = document.createElement("span");
    note.className = "mw-grid-legend-note";
    note.textContent = p.topBinNote;
    box.append(note);
  }
  const unit = document.createElement("span");
  unit.className = "mw-grid-legend-unit";
  unit.textContent = p.displayUnit;
  box.append(unit);
  return box;
}

/**
 * 要素描述文案（demo 层 UI 文案单源——档案只管口径与数值语义，面向读者的一句叙述
 * 不进内核包；新增要素在此补一行，缺席＝描述区不渲染）。
 */
const ELEMENT_DESCRIPTIONS: Readonly<Record<string, string>> = {
  tmp: "地表 2 米气温分析场——冷暖分布与梯度一眼可读，色带白心钉 0°C。",
  dpt: "地表 2 米露点温度——与气温的差值指示近地面湿度与结露潜力，色越深越湿。",
  rh: "地表 2 米相对湿度（0–100% 有界场）——干湿分布直读，蓝绿系越深越湿。",
  cape: "对流有效位能——对流潜势的能量指标：1000/2500/4000 J/kg 对应中/强/极强，零值区（无潜势）透明不画。",
  prate: "地面降水率（对数分级）——0.1/1/5/10 mm/h 量级阈值，零降水区透明不画。",
  vis: "地面能见度（航空阈值档 0.4/0.8/1.5/3/5/10 km）——红色端＝差能见度；≥24.1 km 为满量程。",
  refc: "模拟雷达反射率（NWS 标准 15 级色标）——色越深回波越强，−20 dBZ 无回波区透明。",
  prmsl: "海平面气压——4 hPa 等值线＋2 hPa 加密细线主导，L/H 中心标注天气系统位置。",
  gh: "500hPa 位势高度——60 gpm 等值线，5880 红色特值线＝西太平洋副热带高压锚。",
  pres: "地面气压（模式地面，含地形效应——高原极低值非天气低压）——淡紫底衬叠 16 hPa 稀疏参考线；细密度分析请切「海平面气压」。",
  t850: "850hPa 温度——4°C 等温线，0°C 红色特值线＝零度层（雨雪分界参考）。",
  tcdc: "总云量（整层大气）——业务 4 级制（晴/少云/多云/阴），灰白渐进越深云越厚。",
  wind: "10 米风——风速色斑＋风向杆（m/s 中国口径：三角旗 20、长划 4、短划 2），静风区不出杆。",
};

/** 面板挂载选项：fetchImpl 注入可测（真实 fetch 结构满足 UrlFetch/JsonFetch 两面）。 */
export interface GridPanelOptions {
  /** ?element=<短名> 直达的查询串（缺省读当前地址） */
  readonly search?: string;
  readonly fetchImpl?: UrlFetch & JsonFetch;
}

/** 按类型守卫取元素（免类型断言）：类型不符/缺席返回 null，调用点各自判空 */
const elById = (id: string): HTMLElement | null => {
  const el = document.getElementById(id);
  return el instanceof HTMLElement ? el : null;
};
const btnById = (id: string): HTMLButtonElement | null => {
  const el = document.getElementById(id);
  return el instanceof HTMLButtonElement ? el : null;
};
const inputById = (id: string): HTMLInputElement | null => {
  const el = document.getElementById(id);
  return el instanceof HTMLInputElement ? el : null;
};

/**
 * 把格点图层抽屉接到地图上（DOM 元素由 index.html 提供，id 见实现内查询）。
 * 幂等假设：每页一次。数据/缓存/竞态语义见 grid-data.ts 与文件头注。
 */
export function mountGridLayerPanel(map: LeafletNS.Map, opts: GridPanelOptions = {}): void {
  const fetchImpl = opts.fetchImpl;
  const drawer = elById("grid-panel");
  const openBtn = btnById("mode-grid");
  const closeBtn = btnById("grid-close");
  const rowsBox = elById("grid-elements");
  const pullBtn = btnById("grid-pull");
  /** 预报时效步进器：◀（上一档）/值钮（自动⇄手动切换）/▶（下一档）——不走下拉 */
  const fhourPrevBtn = btnById("grid-fhour-prev");
  const fhourDisplay = btnById("grid-fhour");
  const fhourNextBtn = btnById("grid-fhour-next");
  const opacityInput = inputById("grid-opacity");
  const opacityValue = elById("grid-opacity-value");
  const metaLine = elById("grid-meta");

  const cache = new Map<string, LoadedGrid>();
  let currentSpec: GridElementSpec | undefined;
  /** 时效选择：「auto」（缺省）或具体档位；currentFhour＝当前已装载场的实际时效 */
  let fhourMode: number | "auto" = "auto";
  let currentFhour = 0;
  /** 自动跳档的落空记忆（spec@fhour）：同要素同档探测过 404 即不再重复发（拉最新绕开） */
  const autoProbeMissed = new Set<string>();
  let overlay: LeafletNS.ImageOverlay | undefined;
  /** 等值线叠层（档案 renderForm "filled+contours" 的要素才有；随色斑层同建同摘） */
  let contourLayer: LeafletNS.LayerGroup | undefined;
  /** 风向杆叠层（档案 renderForm "filled+barbs" 的要素才有；随色斑层同建同摘） */
  let barbLayer: LeafletNS.LayerGroup | undefined;
  let opacity = GRID_OPACITY_DEFAULT;
  let bust: string | undefined;
  /** 逐次自增的换代令牌：慢响应回来时若已切走/已取消，丢弃不渲染 */
  let generation = 0;

  // —— 抽屉开合：顶栏「格点图层」按钮与抽屉内 × 双入口；图层显隐与抽屉开合正交 ——
  const setDrawerOpen = (open: boolean): void => {
    if (drawer !== null) drawer.hidden = !open;
    if (openBtn !== null) {
      openBtn.setAttribute("aria-pressed", String(open));
      openBtn.classList.toggle("active", open);
    }
  };
  openBtn?.addEventListener("click", () =>
    setDrawerOpen(drawer === null || drawer.hidden === true),
  );
  closeBtn?.addEventListener("click", () => setDrawerOpen(false));

  const setMeta = (text: string, tone: "loading" | "ok" | "error"): void => {
    if (metaLine === null) return;
    metaLine.dataset.tone = tone;
    metaLine.textContent = text;
    // 成功态溯源信息在选中行展开体的数据源行展示（owner 2026-10-07：头部不再重复），
    // 头部状态行只承载装载中/错误/未选择提示——空文本即整行隐藏不占位
    metaLine.hidden = text === "";
  };
  /** 错误态：原因一行＋可选重试按钮（重试入口与三态其余两态同一行，不打断页外功能） */
  const showError = (message: string, retry: (() => void) | undefined): void => {
    if (metaLine === null) return;
    metaLine.dataset.tone = "error";
    metaLine.hidden = false;
    metaLine.replaceChildren();
    const text = document.createElement("span");
    text.textContent = message;
    metaLine.append(text);
    if (retry !== undefined) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mw-grid-retry";
      btn.textContent = "重试";
      btn.addEventListener("click", retry);
      metaLine.append(btn);
    }
  };

  // —— 要素行（单选可取消：点选中行＝取消＝摘层；加载中禁用防竞态） ——
  interface RowParts {
    readonly head: HTMLButtonElement;
    readonly body: HTMLDivElement;
  }
  const rows = new Map<string, RowParts>();
  if (rowsBox !== null) {
    for (const spec of GRID_ELEMENTS) {
      const item = document.createElement("div");
      item.className = "gd-item";
      const head = document.createElement("button");
      head.type = "button";
      head.className = "gd-item-head";
      const name = document.createElement("span");
      name.textContent = spec.profile.labelZh;
      const unit = document.createElement("span");
      unit.className = "gd-item-unit";
      unit.textContent = spec.profile.displayUnit;
      head.append(name, unit);
      head.setAttribute("aria-pressed", "false");
      const body = document.createElement("div");
      body.className = "gd-item-body";
      body.hidden = true;
      head.addEventListener("click", () => {
        if (head.disabled) return;
        if (currentSpec?.profile.shortName === spec.profile.shortName) {
          deselect();
          return;
        }
        // 时效沿用当前模式：自动→f000 起再跳档；显式档→直接装载该档
        void showElement(spec, false, fhourMode === "auto" ? 0 : fhourMode);
      });
      item.append(head, body);
      rowsBox.append(item);
      rows.set(spec.profile.shortName, { head, body });
    }
  }
  const setRows = (spec: GridElementSpec | undefined, disabled: boolean): void => {
    for (const [name, { head }] of rows) {
      head.setAttribute("aria-pressed", name === spec?.profile.shortName ? "true" : "false");
      head.disabled = disabled;
    }
  };

  /** 选中行展开体：整合色卡＋数据源＋描述（其余行收起——单选展开语义）。 */
  const applyRowContent = (spec: GridElementSpec, loaded: LoadedGrid): void => {
    for (const [name, row] of rows) {
      if (name === spec.profile.shortName) {
        const src = document.createElement("p");
        src.className = "gd-src";
        src.textContent = gridMetaLine(spec, loaded);
        const children: HTMLElement[] = [buildGridLegend(spec, loaded), src];
        const desc = ELEMENT_DESCRIPTIONS[spec.profile.shortName];
        if (desc !== undefined) {
          const p = document.createElement("p");
          p.className = "gd-desc";
          p.textContent = desc;
          children.push(p);
        }
        row.body.replaceChildren(...children);
        row.body.hidden = false;
      } else {
        row.body.replaceChildren();
        row.body.hidden = true;
      }
    }
  };

  const removeLayers = (): void => {
    if (overlay !== undefined) map.removeLayer(overlay);
    if (contourLayer !== undefined) map.removeLayer(contourLayer);
    if (barbLayer !== undefined) map.removeLayer(barbLayer);
    overlay = undefined;
    contourLayer = undefined;
    barbLayer = undefined;
  };

  /** 取消选中（不选＝不展示）：摘层＋收行＋在途装载作废；缓存保留（再选零 fetch）。 */
  const deselect = (): void => {
    generation++;
    currentSpec = undefined;
    removeLayers();
    setRows(undefined, false);
    for (const { body } of rows.values()) {
      body.replaceChildren();
      body.hidden = true;
    }
    setMeta("未选择要素——点选列表中的要素上图（再点一次取消）", "ok");
    if (pullBtn !== null) pullBtn.disabled = true;
    setFhourBusy(false);
  };

  /**
   * 建新层成功后才摘旧层（渲染失败旧图保留）；透明度随滑杆现值。
   * 等值线主导形态（档案 renderForm "filled+contours"，如 prmsl）在色斑之上再叠
   * 等值线＋数值标注层（addContourLayer；L/H 中心标注随档案 contours.centers 缺省
   * 开——温度场一类声明 false 只描线不出中心）——显隐/样式全由档案驱动，面板
   * 不对具体要素做特判；滑杆只调色斑不透明度（等值线与标注是形态主导，不随滑杆淡出）。
   * 双分量形态（renderForm "filled+barbs"，如 wind）同构：色斑之上再叠风向杆层
   * （addWindBarbLayer——色斑吃 loaded.grid 合成风速场，杆层吃 components 分量原场，
   * 两层零交涉）；无伴生分量（数据面异常缺席）即不叠杆——形态声明与数据形态对齐。
   */
  const buildOverlay = async (spec: GridElementSpec, loaded: LoadedGrid): Promise<void> => {
    const built = await addGridLayer(map, loaded.grid, spec.profile, { opacity });
    if (overlay !== undefined) map.removeLayer(overlay);
    overlay = built;
    if (spec.profile.renderForm === "filled+contours") {
      // L/H 中心标注随档案口径（气压习语缺省开；温度场一类声明 centers:false 只描线）
      const builtContours = await addContourLayer(map, loaded.grid, spec.profile, {
        centers: spec.profile.contours?.centers ?? true,
      });
      if (contourLayer !== undefined) map.removeLayer(contourLayer);
      contourLayer = builtContours;
    } else if (contourLayer !== undefined) {
      map.removeLayer(contourLayer);
      contourLayer = undefined;
    }
    if (spec.profile.renderForm === "filled+barbs" && loaded.components !== undefined) {
      const builtBarbs = await addWindBarbLayer(
        map,
        loaded.components.u,
        loaded.components.v,
        spec.profile,
      );
      if (barbLayer !== undefined) map.removeLayer(barbLayer);
      barbLayer = builtBarbs;
    } else if (barbLayer !== undefined) {
      map.removeLayer(barbLayer);
      barbLayer = undefined;
    }
  };

  /** 装载＋渲染一个要素（三态入口；force＝拉最新后的强刷带缓存戳；fhour＝目标时效档）。 */
  async function showElement(spec: GridElementSpec, force = false, fhour = 0): Promise<void> {
    const gen = ++generation;
    currentSpec = spec;
    setRows(spec, true);
    setFhourBusy(true);
    if (pullBtn !== null) pullBtn.disabled = false;
    const cached = force ? undefined : cache.get(cacheKeyOf(spec, fhour));
    if (cached === undefined)
      setMeta(
        `正在装载 ${spec.profile.labelZh}${fhour > 0 ? ` f${String(fhour).padStart(2, "0")}` : ""} 场数据…`,
        "loading",
      );
    // 「拉最新」后的强制重取可能撞上 dev 静态服务的新文件 404 窗（实测 ~1–2s——目录
    // 缓存刷新滞后）：force 且 404 时退避重试（1.5s ×3），仍败才走错误态
    let loaded: LoadedGrid | undefined = cached;
    let lastErr: unknown;
    const maxAttempts = force ? 4 : 1;
    for (let attempt = 1; attempt <= maxAttempts && loaded === undefined; attempt++) {
      if (attempt > 1) {
        // oxlint-disable-next-line no-await-in-loop -- 退避重试本就是顺序等待
        await new Promise((r) => setTimeout(r, 1500));
        if (gen !== generation) return; // 重试等待期间被切走/取消：静默丢弃
      }
      try {
        const loadOpts: { fhour?: number; bust?: string; fetchImpl?: UrlFetch } = force
          ? { fhour, bust }
          : { fhour };
        if (fetchImpl !== undefined) loadOpts.fetchImpl = fetchImpl;
        // oxlint-disable-next-line eslint/no-await-in-loop -- 退避重试本就是顺序等待（并行无意义）
        loaded = await loadGridElement(spec, loadOpts);
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        const retryable = force && msg.includes("HTTP 404") && attempt < maxAttempts;
        if (!retryable) break;
      }
    }
    if (loaded === undefined) {
      if (gen !== generation) return; // 已切走/已取消，错误不覆盖新界面
      setRows(spec, false);
      setFhourBusy(false);
      showError(
        `${spec.profile.labelZh} 数据不可用：${lastErr instanceof Error ? lastErr.message : String(lastErr)}——可点重试，或 dev 下用「拉最新」先生成数据`,
        () => void showElement(spec, force, fhour),
      );
      return;
    }
    cache.set(cacheKeyOf(spec, fhour), loaded);
    if (gen !== generation) return; // 慢响应竞态：丢弃
    setRows(spec, false);
    currentFhour = loaded.grid.header.meta.forecastHour;
    setFhourBusy(false); // currentFhour 先行——值钮/边界态随新档刷新
    try {
      await buildOverlay(spec, loaded);
      if (gen !== generation) {
        // 渲染期间被切走/取消：即刻清掉刚挂的层
        removeLayers();
        return;
      }
    } catch (err) {
      if (gen !== generation) return;
      showError(
        `渲染失败：${err instanceof Error ? err.message : String(err)}`,
        () => void showElement(spec, force, fhour),
      );
      return;
    }
    applyRowContent(spec, loaded);
    // 成功态：溯源信息只进选中行展开体的数据源行——头部状态行清空隐藏（owner 指令去重）
    setMeta("", "ok");
    // 「自动」时效：f000 装载后按起报龄后台探测最近档，档在则升级（不在则诚实留在 f000）
    if (fhourMode === "auto" && loaded.grid.header.meta.forecastHour === 0) {
      const h = autoTrackFhour(loaded.grid.header.meta.referenceTime);
      const probeKey = `${spec.profile.shortName}@f${h}`;
      if (h > 0 && !autoProbeMissed.has(probeKey)) {
        try {
          // 面板缓存优先（切回自动等重复场景零 fetch），缺席才走网络探测
          const upgraded =
            cache.get(cacheKeyOf(spec, h)) ??
            (await loadGridElement(spec, { fhour: h, fetchImpl }));
          if (gen !== generation) return; // 探测期间被切走/取消：丢弃
          cache.set(cacheKeyOf(spec, h), upgraded);
          currentFhour = upgraded.grid.header.meta.forecastHour;
          syncFhourControl(); // 自动跳档后值钮文案刷新（自动·fXX）
          await buildOverlay(spec, upgraded);
          if (gen !== generation) {
            removeLayers();
            return;
          }
          applyRowContent(spec, upgraded);
        } catch {
          // 最近档产物缺席（静态部署/未拉过）——记落空防重复探测，留在 f000 不报错
          autoProbeMissed.add(probeKey);
        }
      }
    }
  }

  // —— 预报时效步进器：值钮（自动⇄手动）/◀▶（逐小时，边界禁用）；装载中禁用防竞态 ——
  let fhourBusy = false;
  const syncFhourControl = (): void => {
    if (fhourDisplay !== null) {
      fhourDisplay.textContent =
        fhourMode === "auto"
          ? `自动·f${String(currentFhour).padStart(2, "0")}`
          : `f${String(fhourMode).padStart(2, "0")}`;
      fhourDisplay.setAttribute("aria-pressed", String(fhourMode === "auto"));
    }
    const base = fhourMode === "auto" ? currentFhour : fhourMode;
    if (fhourPrevBtn !== null) fhourPrevBtn.disabled = fhourBusy || base <= 0;
    if (fhourNextBtn !== null) fhourNextBtn.disabled = fhourBusy || base >= GRID_FHOUR_MAX;
  };
  const setFhourBusy = (busy: boolean): void => {
    fhourBusy = busy;
    syncFhourControl();
  };
  /** 步进 ±1 小时：自动态下步进＝从当前档脱钩为手动定档（f00–f72 收敛）。 */
  const stepFhour = (delta: number): void => {
    if (fhourBusy) return;
    const base = fhourMode === "auto" ? currentFhour : fhourMode;
    const target = Math.min(GRID_FHOUR_MAX, Math.max(0, base + delta));
    if (target === base && fhourMode !== "auto") return; // 已在边界
    fhourMode = target;
    syncFhourControl();
    const spec = currentSpec;
    if (spec !== undefined) void showElement(spec, false, target);
  };
  fhourPrevBtn?.addEventListener("click", () => stepFhour(-1));
  fhourNextBtn?.addEventListener("click", () => stepFhour(1));
  // 值钮点击＝「自动」⇄手动定档切换（手动切自动：f000 起重装载并按龄跳档）
  fhourDisplay?.addEventListener("click", () => {
    if (fhourBusy) return;
    if (fhourMode === "auto") {
      fhourMode = currentFhour; // 脱钩：钉在当前档
    } else {
      fhourMode = "auto";
      const spec = currentSpec;
      if (spec !== undefined) void showElement(spec, false, 0);
    }
    syncFhourControl();
  });
  syncFhourControl();

  // —— 不透明度滑杆：setOpacity 原地调，不重建层（层未建时只记账，建层时生效） ——
  if (opacityInput !== null) {
    opacity = parseOpacityInput(opacityInput.value);
    opacityInput.addEventListener("input", () => {
      opacity = parseOpacityInput(opacityInput.value);
      if (opacityValue !== null) opacityValue.textContent = `${Math.round(opacity * 100)}%`;
      overlay?.setOpacity(opacity);
    });
  }

  // —— 「拉最新」（dev 中间件在位才显示；进行中禁用＋进度提示；失败保留旧数据不白屏；
  //    取消选中期间禁用——无当前要素可拉） ——
  if (pullBtn !== null) {
    void probeGenGridApi(fetchImpl).then((present) => {
      if (!present) {
        pullBtn.hidden = true; // 静态部署无中间件：按钮自隐藏（与 iwxxm 预取同纪律）
        // oxlint-disable-next-line eslint/no-console -- 静默降级口径：探测结果仅 console 一条 info、不弹 UI
        console.info("格点图层：无「拉最新」中间件（静态部署），按钮已隐藏");
        return;
      }
      pullBtn.hidden = false;
      pullBtn.addEventListener("click", () => {
        const spec = currentSpec;
        if (spec === undefined || pullBtn.disabled) return;
        pullBtn.disabled = true;
        pullBtn.textContent = "拉取中…（取数+解码约需 5–60 秒）";
        setMeta(
          `正在拉取 ${spec.profile.labelZh} 最新场（NOMADS 取数＋GRIB2 解码在服务端进行；时效${
            fhourMode === "auto" ? "自动＝离现在最近" : ` f${String(fhourMode).padStart(2, "0")}`
          }）…`,
          "loading",
        );
        void pullLatestElement(spec.profile.shortName, fhourMode, fetchImpl)
          .then((result): Promise<void> | undefined => {
            pullBtn.textContent = "拉最新";
            pullBtn.disabled = false;
            if (!result.ok) {
              setMeta(`拉取失败：${result.message}——旧图保留`, "error");
              return undefined;
            }
            // auto 定档由服务端裁决并回带——面板按它构造产物文件名直载（不猜名）
            const h = result.fhour ?? (fhourMode === "auto" ? 0 : fhourMode);
            bust = String(Date.now()); // 缓存戳：重取刚落盘的 .mwgrid
            setMeta("最新场已落盘，正在重取渲染…", "loading");
            return showElement(spec, true, h);
          })
          .catch(() => {
            pullBtn.textContent = "拉最新";
            pullBtn.disabled = false;
          });
      });
    });
  }

  // —— 启动：?element=<short-name> 直达（未知要素回落首项并提示）；抽屉缺省收起 ——
  const [initial, matched] = resolveInitialElement(
    opts.search ?? window.location.search,
    GRID_ELEMENTS,
  );
  if (!matched) {
    setMeta(
      `未知要素参数（${new URLSearchParams(opts.search ?? window.location.search).get("element")}），已回落 ${initial.profile.labelZh}`,
      "error",
    );
  }
  void showElement(initial);
}
