/**
 * 格点 demo 数据面：主示例页「格点图层」面板的要素清单＋「最新」三层语义装载（gen 产物
 * ＞仓内冻结基线＞报错）＋「拉最新」中间件客户端。
 *
 * 数据三层语义：
 * ① gen 产物（/grid/<file>，`pnpm gen:grid` 落盘 examples/data/grid/——dev 由 vite
 *    publicDir 直出，静态部署随构建拷贝）：最新 cycle 的实时场；
 * ② 仓内冻结基线（corpus/grid 的 tmp 中国域 f32 权威份）：gen 产物 404/损坏时前端拼装
 *    成 Grid 渲染。选型＝前端拼装而非仓内再存一份 .mwgrid：corpus f32 本就是入库冻结件，
 *    再放一份容器是同一数据的二进制双份；拼装走 computeStats 现算，与容器头同构（几何/溯源
 *    行以字面量立档于 FALLBACK_HEADER_TEMPLATE，时次来自语料文件名 20261004 f000）。
 *    静态部署（gh-pages）由此恒可渲染——f32 经 vite ?url 资产随构建带上。
 * ③ 穷尽报错：面板 meta 行显式失败＋重试按钮，不留空白假象。
 *
 * 预报时效（fhour）维度：f000 沿用 <el>_cn.mwgrid（冻结基线兼容）；f>0 产物名插段
 * <el>_fHHH_cn.mwgrid（gen CLI --fhour 产物）。f>0 **不落冻结基线**——基线是 f000 的
 * 语料，落回去会把别的时效静默换成 0 时效场（诚实优先：f>0 取不到就报错，dev 用
 * 「拉最新」按需生成）。「拉最新」auto 档由服务端定档并在应答回带 fhour，面板按它
 * 构造文件名直载（客户端不猜文件名）。
 *
 * 内存缓存 Map<element@fhour, LoadedGrid> 由调用方（grid-panel.ts）持有：切回要素/
 * 重开图层/切回时效不重复 fetch；不做预取。「拉最新」成功后带缓存戳重取并覆写缓存条目。
 */
import { parseGrid, computeStats, windSpeedGrid, type Grid, type GridHeader } from "@metweave/grid";
import type { ElementProfile } from "@metweave/grid";
import {
  tmpProfile,
  dptProfile,
  rhProfile,
  capeProfile,
  prateProfile,
  visProfile,
  refcProfile,
  prmslProfile,
  ghProfile,
  spProfile,
  t850Profile,
  tcdcProfile,
  windProfile,
} from "@metweave/grid";
import fixture from "../../corpus/grid/fixture.json";
import baselineF32Url from "../../corpus/grid/gfs-tmp-2m-cn.f32?url";

/** 装载来源标注（标题行/状态条显示「仓内冻结基线」用）。 */
type GridDataSource = "gen" | "baseline";

export interface LoadedGrid {
  /**
   * 主场：单场要素＝原值场；双分量要素（companionFile）＝**派生合成场**（如 10m 风速
   * √(u²+v²)，windSpeedGrid 装载期合成——色斑/图例/meta 直读合成口径；存储不动：
   * 磁盘上的 u/v 容器仍是原值）。
   */
  readonly grid: Grid;
  readonly source: GridDataSource;
  /**
   * 双分量要素的分量原值场（合成场的原料）：u＝主文件（file）、v＝伴生文件
   * （companionFile）——风向杆层（addWindBarbLayer）直接吃分量原场（方向 atan2
   * 派生），不经合成场。单场要素缺席。
   */
  readonly components?: { readonly u: Grid; readonly v: Grid };
}

/** 冻结基线档案：f32 字节资产 URL ＋ 拼装用的容器头模板（stats 现算补齐）。 */
interface FrozenBaselineSpec {
  readonly assetUrl: string;
  readonly headerTemplate: Omit<GridHeader, "stats">;
}

/** 切换器的一个要素位：档案（色标/档位/换算单一来源）＋ gen 产物文件名＋可选冻结基线。 */
export interface GridElementSpec {
  readonly profile: ElementProfile;
  /** gen 产物文件名（examples/data/grid/ 下；URL = /grid/<file>，publicDir 直出）。
   *  双分量要素此处为 u 分量文件（如 windu_cn.mwgrid）。 */
  readonly file: string;
  /**
   * 伴生场文件名（双分量要素，如 10m 风的 v 分量 windv_cn.mwgrid）：**两份都齐才算
   * 装载成功**（任一失败即报错——半套矢量无法合成）；「拉最新」走 CLI 的双文件条目
   * （`--element wind` 单请求产双文件），缓存/三态语义随双场整体走。此类要素无冻结
   * 基线（corpus 只冻结 tmp 单场份）——三层语义退化为 gen 双文件＞报错。
   */
  readonly companionFile?: string;
  readonly fallback?: FrozenBaselineSpec;
}

/** 冻结基线容器头模板（GFS 0.25° 中国域窗，corpus fixture 的 tmp 份）。 */
const FALLBACK_HEADER_TEMPLATE: Omit<GridHeader, "stats"> = {
  version: 1,
  variable: "TMP",
  level: "2m",
  unit: "K",
  // 网格几何与 di/dj：GFS 0.25° 全球场族（fixture 只记窗口行列，步距为该网格族常数）
  grid: {
    nx: fixture.window.nx,
    ny: fixture.window.ny,
    la0: fixture.window.la0,
    lo0: fixture.window.lo0,
    di: 0.25,
    dj: 0.25,
    order: "N2S,W2E,row-major",
  },
  meta: {
    referenceTime: "2026-10-04T06:00Z",
    forecastHour: 0,
    source: "GFS 0.25° f000 cycle 2026100406（仓内冻结基线 corpus/grid）",
    license: "U.S. Government public domain",
    generated: "2026-10-04",
    generator: "corpus/grid 冻结基线（前端拼装）",
  },
};

/**
 * 图层面板要素清单（组件结构按多要素设计，数据随切片逐个进——加要素＝此处加一行＋
 * 档案文件，内核与页面结构零改动）。
 */
export const GRID_ELEMENTS: readonly GridElementSpec[] = [
  {
    profile: tmpProfile,
    file: "tmp_cn.mwgrid",
    fallback: { assetUrl: baselineF32Url, headerTemplate: FALLBACK_HEADER_TEMPLATE },
  },
  {
    // 露点无仓内冻结基线（corpus 只冻结了 tmp 份）：三层语义退化为 gen 产物＞报错，
    // 静态部署选此要素会显式报错+重试——诚实行为，基线随需扩 corpus 时再补。
    profile: dptProfile,
    file: "dpt_cn.mwgrid",
  },
  {
    // 相对湿度同露点：无仓内冻结基线（corpus 只冻结了 tmp 份），三层语义退化为
    // gen 产物＞报错——静态部署选此要素显式报错+重试，基线随需扩 corpus 时再补。
    profile: rhProfile,
    file: "rh_cn.mwgrid",
  },
  {
    // 对流有效位能同露点/湿度：无仓内冻结基线（corpus 只冻结了 tmp 份），三层语义退化为
    // gen 产物＞报错——静态部署选此要素显式报错+重试，基线随需扩 corpus 时再补。
    // 首档（[0,1000) 零值堆）透明不画：内核档级透明能力的首个消费要素。
    profile: capeProfile,
    file: "cape_cn.mwgrid",
  },
  {
    // 降水率同前述要素：无仓内冻结基线，三层语义退化为 gen 产物＞报错。对数偏态场
    // （中国域窗实测 74% 零值堆＋13.5% 微量）＝内核 log₁₀ 前置变换的首个消费要素：
    // threshold＋log₁₀＋首档（[0,0.1) mm/h）透明三能力正交组合。
    profile: prateProfile,
    file: "prate_cn.mwgrid",
  },
  {
    // 能见度同前述要素：无仓内冻结基线，三层语义退化为 gen 产物＞报错。航空阈值档
    // （0.4/0.8/1.5/3/5/10 km 六断点七档，METAR 能见度 tier 同族）＋满量程哨兵不透明
    // （24130 m＝「≥24.1 km」打包真值，落最高档正常着色）＝图例末档注记机制
    // （档案 topBinNote）的首个消费要素；内核零改动（纯加档案＋清单一行）。
    profile: visProfile,
    file: "vis_cn.mwgrid",
  },
  {
    // 模拟反射率同前述要素：无仓内冻结基线，三层语义退化为 gen 产物＞报错。−20 无回波
    // 哨兵（打包真值，约 3/4 点）落首档 [−∞,5) 透明（「无信号」语义——与 vis 满量程
    // 哨兵不透明相对）；阈值档＝NWS 标准 5 dBZ 一档 5–75×16 档＋NWS 标准色标
    // （复用阈值档＋档级透明两能力，内核零改动）。
    profile: refcProfile,
    file: "refc_cn.mwgrid",
  },
  {
    // 海平面气压同前述要素：无仓内冻结基线，三层语义退化为 gen 产物＞报错。等值线主导
    // 形态的首个消费要素（renderForm "filled+contours"）：色斑浅填色打底＋4 hPa 常规
    // 等值线标值＋2 hPa 加密细线＋低压「L」/高压「H」中心标注（内核 contoursOf/
    // centersOf 两能力＋addContourLayer 叠层，d3-contour 为 grid 包唯一运行时外部依赖）。
    profile: prmslProfile,
    file: "prmsl_cn.mwgrid",
  },
  {
    // 500hPa 高度同前述要素：无仓内冻结基线，三层语义退化为 gen 产物＞报错。等值线主导
    // 形态第二要素＋特值线高亮的首个消费要素：60 gpm 常规等值线标值＋**5880 副高线红色
    // 加粗、标注同色**（内核 contoursOf 的 highlighted 线种随本片接线 addContourLayer）；
    // gpm 直读（5880 即 gpm 口径的中文气象圈最强认知锚）。
    profile: ghProfile,
    file: "gh_cn.mwgrid",
  },
  {
    // 地面气压同前述要素：无仓内冻结基线，三层语义退化为 gen 产物＞报错。等值线主导
    // 形态第三要素（复用三件套，内核/leaflet/面板零改动——「零改动路径」第二证）：
    // 短名 pres 对齐 gen:grid CLI 的 ELEMENTS 键（「拉最新」链路直通）；PRES/sfc 场含
    // 地形效应（高原 500 hPa 级极值，非天气低压），填色域容纳地形极值、等值线高地形区
    // 如实密集（不做地形平滑）；16 hPa 常规等值线无加密线（4→16 hPa 可读性裁量——真实场
    // 4 hPa 间隔下高原坡面约每 2 像素一线不可读；细密度分析由 prmsl 的 4/2 hPa 承担）。
    profile: spProfile,
    file: "pres_cn.mwgrid",
  },
  {
    // 850hPa 温度同前述要素：无仓内冻结基线，三层语义退化为 gen 产物＞报错。零新能力
    // 切片（与 tmp 同族同色带口径的高空温度，内核/leaflet/面板零改动）：短名 t850 对齐
    // gen:grid CLI 的 ELEMENTS 键（「拉最新」链路直通）；TMP/850mb/K→°C；色标/档位与
    // tmp 逐字段同构（RdBu 反向白心钉 0°C、等距 [-40,40]×4°C×20 档＋分位双模式——
    // 同域即跨要素可比：同一色＝同一温度，2m↔850hPa 垂直热结构切换可读）；renderForm
    // "filled+contours"：等温线 4°C 间隔上图、0°C 特值线红色加粗（零度层＝降水形态判据
    // 常识锚）、centers:false 关闭 L/H 中心标注（气压习语落温度场语义错位——冷中心≠低压）。
    profile: t850Profile,
    file: "t850_cn.mwgrid",
  },
  {
    // 总云量同前述要素：无仓内冻结基线，三层语义退化为 gen 产物＞报错。零新能力切片
    // （与 rh 同为 0–100% 有界场的纯加档案，内核/leaflet/面板零改动）：短名 tcdc 对齐
    // gen:grid CLI 的 ELEMENTS 键（「拉最新」链路直通）；TCDC/整层大气/% 恒等；灰白
    // 渐进（晴→阴＝浅白→深灰，Greys 裁墨七停靠）；等距 [0,100]×25%×4 档＝云量业务
    // 4 级制（晴/少云/多云/阴，图例五刻度 0/25/50/75/100）；分位不立（p75=p90=100
    // 饱和退化——GFS 云量偏差向两端堆积，demo 上一眼「满屏多云」即其直观形态，内容
    // 叙事点如实渲染）；等值线 25% 留位、renderForm 纯色斑（表 B 主形态）。
    profile: tcdcProfile,
    file: "tcdc_cn.mwgrid",
  },
  {
    // 10m 风：格点线首个**双分量要素**（一个面板要素位 ↔ 两个数据文件）：file＝u 分量
    // （windu_cn.mwgrid，UGRD/10m）、companionFile＝v 分量（windv_cn.mwgrid，VGRD/10m）
    // ——两份都齐才算装载成功；装载期合成风速场 √(u²+v²)（windSpeedGrid，色斑/图例
    // 直读合成口径），分量原值留在 components 供风向杆（addWindBarbLayer，风向 atan2
    // 同源派生）。短名 wind 对齐 gen:grid CLI 的 ELEMENTS 键（「拉最新」→ --element
    // wind 单请求产双文件）；无仓内冻结基线（corpus 只冻结 tmp 单场份），三层语义退化
    // 为 gen 双文件＞报错。renderForm "filled+barbs"：合成风速色斑（YlOrBr 七停靠
    // 浅→深＝弱→强、等距 [0,32]×4 m/s×8 档）＋风羽杆（m/s 中国口径旗 20/长划 4/
    // 短划 2、step 10＝2.5° 一根、静风 <1 m/s 不画）。
    profile: windProfile,
    file: "windu_cn.mwgrid",
    companionFile: "windv_cn.mwgrid",
  },
];

/**
 * 冻结基线拼装（纯函数）：big-endian f32 字节 → Float32Array → stats 现算 → Grid。
 * 与 .mwgrid 容器同构（同字节序、同几何口径），下游渲染链无感。
 */
export function buildFallbackGrid(
  buffer: ArrayBuffer | Uint8Array,
  headerTemplate: Omit<GridHeader, "stats"> = FALLBACK_HEADER_TEMPLATE,
): Grid {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const n = bytes.byteLength / 4;
  const expected = headerTemplate.grid.nx * headerTemplate.grid.ny;
  if (n !== expected) {
    throw new Error(`冻结基线字节数不符（${n} 点 ≠ 声明 ${expected}）——资产损坏`);
  }
  const values = new Float32Array(n);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < n; i++) values[i] = dv.getFloat32(i * 4);
  return { header: { ...headerTemplate, stats: computeStats(values) }, values };
}

/** gen 产物的 dev/部署 URL（publicDir=examples/data，目录内 grid/ 映射到 /grid/）。 */
const gridFileUrl = (file: string, bust?: string): string =>
  `/grid/${file}${bust === undefined ? "" : `?v=${encodeURIComponent(bust)}`}`;

/** 时效产物名：f000 沿用原名（<el>_cn.mwgrid）；f>0 插段 <el>_fHHH_cn.mwgrid。 */
export const fhourFile = (file: string, fhour: number): string =>
  fhour <= 0 ? file : file.replace(/_cn\.mwgrid$/, `_f${String(fhour).padStart(3, "0")}_cn.mwgrid`);

export const genGridUrl = (spec: GridElementSpec, bust?: string, fhour = 0): string =>
  gridFileUrl(fhourFile(spec.file, fhour), bust);

/**
 * 装载一个要素（三层语义，fetch 注入可测）：
 * gen 产物 ok（200 且容器可解析）→ 用之；否则有冻结基线则拼装；穷尽抛最后错误。
 *
 * 双分量要素（companionFile）：主/伴生两文件**并行拉取、两份都齐才算成功**——
 * 主场装载为派生合成场（windSpeedGrid），分量原值留在 components（风向杆用）；
 * 任一失败即报错（半套矢量无法合成），无冻结基线（单场语料不适用双分量）。
 */
export async function loadGridElement(
  spec: GridElementSpec,
  opts: { fhour?: number; bust?: string; fetchImpl?: UrlFetch } = {},
): Promise<LoadedGrid> {
  const doFetch = opts.fetchImpl ?? fetch;
  const fhour = opts.fhour ?? 0;
  if (spec.companionFile !== undefined) {
    const failures: string[] = [];
    const uFile = fhourFile(spec.file, fhour);
    const vFile = fhourFile(spec.companionFile, fhour); // 分支头解构防闭包内窄化失效
    const parts = await Promise.allSettled([
      doFetch(gridFileUrl(uFile, opts.bust)).then(async (res) => {
        if (!res.ok) throw new Error(`${uFile} HTTP ${res.status}`);
        return parseGrid(await res.arrayBuffer());
      }),
      doFetch(gridFileUrl(vFile, opts.bust)).then(async (res) => {
        if (!res.ok) throw new Error(`${vFile} HTTP ${res.status}`);
        return parseGrid(await res.arrayBuffer());
      }),
    ]);
    const grids: (Grid | undefined)[] = [];
    for (const part of parts) {
      if (part.status === "fulfilled") {
        grids.push(part.value);
      } else {
        failures.push(part.reason instanceof Error ? part.reason.message : String(part.reason));
        grids.push(undefined);
      }
    }
    const uGrid = grids[0];
    const vGrid = grids[1];
    if (uGrid === undefined || vGrid === undefined) {
      throw new Error(
        `装载 ${spec.profile.shortName} 失败（双分量须两份都齐：${failures.join("；")}）`,
      );
    }
    return {
      grid: windSpeedGrid(uGrid, vGrid),
      source: "gen",
      components: { u: uGrid, v: vGrid },
    };
  }
  const genFailures: string[] = [];
  try {
    const res = await doFetch(genGridUrl(spec, opts.bust, fhour));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { grid: parseGrid(await res.arrayBuffer()), source: "gen" };
  } catch (err) {
    genFailures.push(err instanceof Error ? err.message : String(err));
  }
  if (fhour > 0) {
    // 冻结基线是 f000 语料：f>0 落基线＝静默换时效场，诚实优先直接报错
    throw new Error(
      `装载 ${spec.profile.shortName} f${String(fhour).padStart(2, "0")} 失败（${genFailures.join("；")}）——dev 下可点「拉最新」按当前时效生成`,
    );
  }
  if (spec.fallback !== undefined) {
    try {
      const res = await doFetch(spec.fallback.assetUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return {
        grid: buildFallbackGrid(await res.arrayBuffer(), spec.fallback.headerTemplate),
        source: "baseline",
      };
    } catch (err) {
      genFailures.push(`冻结基线也失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`装载 ${spec.profile.shortName} 失败（${genFailures.join("；")}）`);
}

// ---------------------------------------------------------------- 拉最新（中间件客户端）

/** fetch 的最小结构面（二进制体）：真实 fetch 结构满足，测试注入部分形态假件。 */
export interface UrlFetch {
  (url: string): Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;
}

/** fetch 的最小结构面（JSON 体）：同上。 */
export interface JsonFetch {
  (url: string): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
}

/** 应答体的 fhour 字段读取（auto 定档后面板按它构造产物名直载）。 */
const fhourOfBody = (b: object): number | undefined =>
  "fhour" in b && typeof b.fhour === "number" ? b.fhour : undefined;

/** 「拉最新」结果：fhour＝应答回带的实际时效档（auto 定档后才有；显式档恒等于请求值）。 */
export interface PullResult {
  readonly ok: boolean;
  readonly message: string;
  readonly fhour?: number;
}

/**
 * 「拉最新」：调 dev 中间件触发服务端 gen-grid（NOMADS 取数＋GRIB 解码全在 Node）。
 * 永不抛——一切失败转 {ok:false, message}（旧数据保留、状态条提示原因由调用方定）。
 */
export async function pullLatestElement(
  element: string,
  fhour: number | "auto" = 0,
  fetchImpl: JsonFetch = fetch,
): Promise<PullResult> {
  try {
    const res = await fetchImpl(
      `/api/gen-grid?element=${encodeURIComponent(element)}&fhour=${
        fhour === "auto" ? "auto" : Math.max(0, Math.min(120, Math.round(fhour)))
      }`,
    );
    const body: unknown = await res.json();
    if (
      body !== null &&
      typeof body === "object" &&
      "ok" in body &&
      typeof body.ok === "boolean" &&
      ("error" in body ? typeof body.error === "string" : true)
    ) {
      const message =
        "error" in body && typeof body.error === "string" ? body.error : `HTTP ${res.status}`;
      return body.ok
        ? { ok: true, message: "已取到最新场", fhour: fhourOfBody(body) }
        : { ok: false, message };
    }
    return { ok: false, message: `中间件应答异常（HTTP ${res.status}）` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * 中间件存在性探测（启动一次）：GET /api/gen-grid（无参）——中间件在位返回可分辨的
 * 400（缺参应答），静态部署为 404。404/网络错 → 隐藏按钮（与 iwxxm 预取静默降级同纪律）。
 */
export async function probeGenGridApi(fetchImpl: JsonFetch = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl("/api/gen-grid");
    return res.status !== 404;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- 图层面板纯逻辑

/** URL ?element=<short-name> → 清单内要素；缺席/未知 → 清单首项。返回 [要素, 是否命中]。 */
export function resolveInitialElement(
  search: string,
  elements: readonly GridElementSpec[],
): [GridElementSpec, boolean] {
  const first = elements[0];
  if (first === undefined) throw new Error("要素清单为空");
  const param = new URLSearchParams(search).get("element");
  const hit = param === null ? undefined : elements.find((e) => e.profile.shortName === param);
  return hit === undefined ? [first, param === null] : [hit, true];
}
