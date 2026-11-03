/**
 * 「0.3.2 七项验收台」（verify.html）：把 T1–T7 落成一页**可点、可切、可判定**的东西。
 *
 * 与 `wind.html` 的分工：那页讲「风怎么读」（面向读者/内容线），本页讲「这批交付了什么」
 * （面向验收，每项右上角徽标由断言决定，不看注释、不看文档）。
 *
 * 三个刻意的设计：
 * 1. **数据自带**：页内合成一对 u/v 场（20×16 网格，风速 2→30 m/s 带梯度），不 fetch、
 *    不依赖 `examples/data`——静态部署（无 dev 中间件）也能把七项全部跑出来。
 * 2. **判定用库的返回物**：编码来自 `windBarbOf`、path 来自 `windBarbPath`、牌的状态来自
 *    DOM 的 `data-state`、等值线条数来自层内 `querySelectorAll("path")`——页面不另写一份
 *    期望值（那会变成「测试实现」而不是「验收实现」）。
 * 3. **合成场也要真**：T5/T7 走的是真实的 `addWindBarbLayer` / `addGridLayer` +
 *    `addContourLayer`，唯一区别是数据来自内存而不是 .mwgrid 文件。
 */
import { parse } from "metweave";
import { renderWindChip, renderWindLegend, windDirFrequency, windRose } from "metweave";
import roseData from "../zspd-rose-data.json";
import {
  LEDGER_KEYS,
  isZspdRoseData,
  toSamples,
  type LedgerKey,
  type LedgerNumbers,
} from "./zspd-rose-data";
import { inputById } from "./shared";
import {
  WIND_LEGEND_UNITS,
  toKnots,
  windBarbOf,
  windBarbStepAt,
  windBarbsOf,
  windProfile,
  windSpeedGrid,
  streamlinesOf,
  arrowFieldOf,
  type WindSpeedUnit,
} from "@metweave/grid";
import {
  addArrowFieldLayer,
  addContourLayer,
  addGridLayer,
  addStreamlineLayer,
  addWindBarbGlyphs,
  addWindBarbLayer,
} from "@metweave/leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DENSITY_BARBS, DENSITY_PROFILE, sampleWindPair, swirlWindPair } from "./verify-sample";
import { arrowSvg, barbSvg } from "./wind-svg";
import "./style.css";

const PAIR = sampleWindPair();

// ---------------------------------------------------------------- 判定台

interface Verdict {
  readonly ok: boolean;
  readonly detail: string;
}

const verdicts = new Map<string, Verdict>();

const paintVerdict = (id: string): void => {
  const verdict = verdicts.get(id);
  const badge = document.querySelector<HTMLElement>(`[data-verdict="${id}"]`);
  if (badge === null || verdict === undefined) return;
  badge.textContent = `${verdict.ok ? "✅ 通过" : "❌ 失败"} · ${verdict.detail}`;
  badge.dataset.ok = String(verdict.ok);
  const passed = [...verdicts.values()].filter((v) => v.ok).length;
  const score = document.getElementById("vf-score");
  if (score !== null) {
    score.textContent = `${passed} / ${verdicts.size} 通过`;
    score.dataset.ok = String(passed === verdicts.size);
  }
};

const judge = (id: string, ok: boolean, detail: string): void => {
  verdicts.set(id, { ok, detail });
  paintVerdict(id);
};

const sameCode = (a: readonly number[] | null, b: readonly number[]): boolean =>
  a !== null && a.length === b.length && a.every((n, i) => n === b[i]);

const codeOf = (speed: number, unit: WindSpeedUnit): number[] | null => {
  const enc = windBarbOf(0, speed, { unit, calmThreshold: 0 });
  return enc === null ? null : [enc.pennants, enc.longs, enc.shorts];
};

// ---------------------------------------------------------------- T1

const mountT1 = (): void => {
  const dirInput = inputById("vf-t1-dir");
  const spdInput = inputById("vf-t1-spd");
  const dirOut = document.getElementById("vf-t1-dir-out");
  const spdOut = document.getElementById("vf-t1-spd-out");
  const glyph = document.getElementById("vf-t1-glyph");
  const read = document.getElementById("vf-t1-read");
  if (dirInput === null || spdInput === null || glyph === null || read === null) return;

  const render = (): void => {
    const direction = Number(dirInput.value);
    const speed = Number(spdInput.value);
    if (dirOut !== null) dirOut.textContent = `${direction}°`;
    if (spdOut !== null) spdOut.textContent = `${speed} m/s`;
    const enc = windBarbOf(direction, speed);
    glyph.replaceChildren(barbSvg(direction, speed, "m/s"));
    read.textContent =
      enc === null
        ? "静风（低于缺省静风阈 1 m/s）→ 不出杆"
        : `旗 ${enc.pennants} · 长划 ${enc.longs} · 短划 ${enc.shorts} ｜ 编码 ${enc.encodedSpeed} m/s`;
  };
  dirInput.addEventListener("input", render);
  spdInput.addEventListener("input", render);
  render();

  // 判定：行业锚点（20 m/s 恰 1 面旗；静风缺省返回 null；0 风速传 calmThreshold:0 才有杆）
  const onePennant = sameCode(codeOf(20, "m/s"), [1, 0, 0]);
  const calmIsNull = windBarbOf(0, 0) === null;
  const zeroWithThreshold = sameCode(codeOf(0, "m/s"), [0, 0, 0]);
  judge(
    "T1",
    onePennant && calmIsNull && zeroWithThreshold,
    `20 m/s＝1 旗 ${onePennant ? "✓" : "✗"} · 静风出 null ${calmIsNull ? "✓" : "✗"} · 阈 0 出光杆 ${zeroWithThreshold ? "✓" : "✗"}`,
  );
};

// ---------------------------------------------------------------- T2

const mountT2 = (): void => {
  const mpsBox = document.getElementById("vf-t2-mps");
  const ktBox = document.getElementById("vf-t2-kt");
  const read = document.getElementById("vf-t2-read");
  if (mpsBox === null || ktBox === null || read === null) return;

  const knots = toKnots(20); // 20 m/s ＝ 38.88 kt（kt 填图口径下按 5 kt 刻度编码）
  mpsBox.replaceChildren(barbSvg(270, 20, "m/s"));
  ktBox.replaceChildren(barbSvg(270, knots, "kt"));
  read.textContent = `20 m/s（m/s 口径）→ 旗 ${codeOf(20, "m/s")?.join("/")}；同一阵风 ${knots.toFixed(1)} kt（kt 口径）→ 旗 ${codeOf(knots, "kt")?.join("/")}（顺序：旗/长划/短划）`;

  const mpsArr = codeOf(20, "m/s");
  const ktArr = codeOf(knots, "kt");
  const mpsCode = sameCode(mpsArr, [1, 0, 0]);
  const ktCode = sameCode(ktArr, [0, 3, 1]);
  const shapesDiffer = JSON.stringify(mpsArr) !== JSON.stringify(ktArr);
  judge(
    "T2",
    mpsCode && ktCode && shapesDiffer,
    `m/s 口径 1 旗 ${mpsCode ? "✓" : "✗"} · kt 口径 3 长+1 短 ${ktCode ? "✓" : "✗"} · 两口径形态不同 ${shapesDiffer ? "✓" : "✗"}`,
  );
};

// ---------------------------------------------------------------- T3

const mountT3 = (): void => {
  const row = document.getElementById("vf-t3-row");
  const read = document.getElementById("vf-t3-read");
  if (row === null || read === null) return;

  const cells: HTMLElement[] = [];
  for (const direction of [0, 90, 240]) {
    for (const pointing of ["from", "to"] as const) {
      const cell = document.createElement("figure");
      const glyph = document.createElement("div");
      glyph.className = "vf-glyph";
      glyph.append(arrowSvg(direction, pointing));
      const cap = document.createElement("figcaption");
      cap.textContent = `${direction}° ${pointing === "from" ? "来向" : "去向"}`;
      cell.append(glyph, cap);
      cells.push(cell);
    }
  }
  row.replaceChildren(...cells);

  // 判定：to ＝ from + 180°（几何反向）；且两者字符串不同（真的反了，不是同一张图）
  const fromNorth = windArrowPathStroke(0, "from");
  const toNorth = windArrowPathStroke(0, "to");
  const equalsSouth = toNorth === windArrowPathStroke(180, "from");
  const differ = fromNorth !== toNorth;
  read.textContent = `0° 来向：${fromNorth} ｜ 0° 去向：${toNorth}`;
  judge(
    "T3",
    differ && equalsSouth,
    `来向≠去向 ${differ ? "✓" : "✗"} · 去向＝来向+180° ${equalsSouth ? "✓" : "✗"}`,
  );
};

/** 取箭头杆身 path（判定用；走的是同一条公开函数，页面上不另存期望值）。 */
const windArrowPathStroke = (direction: number, pointing: "from" | "to"): string =>
  arrowSvg(direction, pointing).querySelectorAll("path")[0]?.getAttribute("d") ?? "";

// ---------------------------------------------------------------- T4

const SAMPLE_REPORTS = [
  "METAR ZUUU 231200Z 24005G12MPS 3000 BR SCT020 18/16 Q1013",
  "METAR ZUUU 231200Z 00000MPS 0800 FG SCT002 12/11 Q1015",
  "METAR ZUUU 231200Z /////MPS 3000 BR SCT020 18/16 Q1013",
] as const;

const mountT4 = (): void => {
  const box = document.getElementById("vf-t4-chips");
  if (box === null) return;
  box.replaceChildren(...SAMPLE_REPORTS.map((raw) => renderWindChip(parse(raw))));
  const chips = [...box.querySelectorAll<HTMLElement>(".mw-wind-chip")];
  const states = chips.map((c) => c.dataset.state);
  const ok =
    states.length === 3 && states[0] === "value" && states[1] === "calm" && states[2] === "missing";
  judge("T4", ok, `三态顺序 ${states.join(" / ")} ${ok ? "✓" : "✗"}`);
};

// ---------------------------------------------------------------- T5

const mountT5 = (): void => {
  const host = document.getElementById("vf-t5-map");
  const status = document.getElementById("vf-t5-status");
  const outBtn = document.getElementById("vf-t5-out");
  const inBtn = document.getElementById("vf-t5-in");
  if (host === null || status === null || outBtn === null || inBtn === null) return;

  const map = L.map(host, {
    center: [37, 111],
    zoom: 4,
    zoomControl: false,
    attributionControl: false,
  });
  const counts = new Map<number, number>();
  const measure = (): void => {
    const zoom = map.getZoom();
    const step = windBarbStepAt(DENSITY_BARBS, zoom);
    const total = host.querySelectorAll(".mw-barb-icon").length;
    counts.set(zoom, total);
    status.textContent = `zoom ${zoom} · step ${step} · ${total} 根`;
  };

  outBtn.addEventListener("click", () => {
    map.setZoom(Math.max(3, map.getZoom() - 1), { animate: false });
    measure();
  });
  inBtn.addEventListener("click", () => {
    map.setZoom(Math.min(8, map.getZoom() + 1), { animate: false });
    measure();
  });

  // 验收台不该静默失败：任何一步抛错都要显示出来（否则「空地图」会被当成通过）
  void addWindBarbLayer(map, PAIR.u, PAIR.v, DENSITY_PROFILE)
    .catch((error: unknown) => {
      status.textContent = `渲染失败：${error instanceof Error ? error.message : String(error)}`;
      judge("T5", false, "addWindBarbLayer 抛错（见状态行）");
      return undefined;
    })
    .then(() => {
      measure();
      // 判定分两层（别拿「总数随缩放递增」当判据——视口一变小，再密的档也会少杆）：
      // ① 密度：档位越高步长越小（同面积内杆更多）；② 渲染：层真的画出杆，且放大后步长确实换档
      const [far, mid, near] = [3, 5, 7].map((z) => windBarbStepAt(DENSITY_BARBS, z));
      const monotone =
        far !== undefined && mid !== undefined && near !== undefined && far > mid && mid > near;
      const drawnAtDefault = counts.get(4) ?? 0;
      const stepBefore = windBarbStepAt(DENSITY_BARBS, 4);
      const shrinkOnZoom = windBarbStepAt(DENSITY_BARBS, 7) < stepBefore;
      judge(
        "T5",
        monotone && drawnAtDefault > 0 && shrinkOnZoom,
        `步长 ${far}→${mid}→${near} ${monotone ? "✓" : "✗"} · 地图实绘 ${drawnAtDefault} 根 ${drawnAtDefault > 0 ? "✓" : "✗"} · 放大后步长变小 ${shrinkOnZoom ? "✓" : "✗"}`,
      );
    });
};

// ---------------------------------------------------------------- T6

const mountT6 = (): void => {
  const box = document.getElementById("vf-t6-legend");
  const read = document.getElementById("vf-t6-read");
  if (box === null || read === null) return;

  const firstMark = (): string => box.querySelector("li")?.textContent ?? "";
  const legend = renderWindLegend({
    units: WIND_LEGEND_UNITS,
    unit: "m/s",
    onUnitChange: (id) => {
      read.textContent = `切到 ${id}：刻度首档 ${firstMark()}`;
      const switched = firstMark().includes(id === "kt" ? "50" : "20");
      judge(
        "T6",
        switched,
        `切到 ${id} 后首档 ${id === "kt" ? "50" : "20"} ${switched ? "✓" : "✗"}`,
      );
    },
  });
  box.replaceChildren(legend);

  const initialOk = firstMark().includes("20");
  read.textContent = `缺省 m/s：刻度首档 ${firstMark()}`;
  judge("T6", initialOk, `缺省 m/s 首档 20 ${initialOk ? "✓" : "✗"}（切换按钮可点，切后复判）`);
};

// ---------------------------------------------------------------- T7

const mountT7 = (): void => {
  const host = document.getElementById("vf-t7-map");
  const toggle = inputById("vf-t7-on");
  const status = document.getElementById("vf-t7-status");
  if (host === null || toggle === null || status === null) return;

  const map = L.map(host, {
    center: [37, 111],
    zoom: 4,
    zoomControl: false,
    attributionControl: false,
  });
  const contourPaths = (): number =>
    map.getPane("mw-grid-contour")?.querySelectorAll("path").length ?? 0;

  let contourLayer: L.LayerGroup | undefined;
  const apply = async (on: boolean): Promise<void> => {
    if (contourLayer !== undefined) {
      map.removeLayer(contourLayer);
      contourLayer = undefined;
    }
    if (on) {
      contourLayer = await addContourLayer(map, windSpeedGrid(PAIR.u, PAIR.v), windProfile, {
        centers: false,
        labels: false,
      });
    }
    status.textContent = on ? `等值线：已叠（${contourPaths()} 段 path）` : "等值线：未叠";
  };
  toggle.addEventListener("change", () => void apply(toggle.checked));

  void addGridLayer(map, windSpeedGrid(PAIR.u, PAIR.v), windProfile)
    .catch((error: unknown) => {
      status.textContent = `渲染失败：${error instanceof Error ? error.message : String(error)}`;
      judge("T7", false, "addGridLayer 抛错（见状态行）");
      return undefined;
    })
    .then(async () => {
      const before = contourPaths();
      await apply(true);
      const after = contourPaths();
      await apply(false);
      const cleared = contourPaths();
      judge(
        "T7",
        before === 0 && after > 0 && cleared === 0,
        `缺省不叠 ${before === 0 ? "✓" : "✗"} · 勾上出线 ${after > 0 ? "✓" : "✗"} · 取消即摘 ${cleared === 0 ? "✓" : "✗"}`,
      );
    });
};

// ---------------------------------------------------------------- V1（0.3.4 矢量批次·流线）

const mountV1 = (): void => {
  const host = document.getElementById("vf-v1-map");
  const status = document.getElementById("vf-v1-status");
  const seedSel = document.getElementById("vf-v1-seed");
  if (host === null || status === null || !(seedSel instanceof HTMLSelectElement)) return;

  // 涡旋场是「看弯」的对照场（平直西风看直、涡旋看弯）；色斑铺底给流线一个量级参照
  const SWIRL = swirlWindPair();
  const map = L.map(host, {
    center: [36.5, 109.5],
    zoom: 4,
    zoomControl: false,
    attributionControl: false,
  });

  let layer: L.LayerGroup | undefined;
  const draw = async (): Promise<void> => {
    if (layer !== undefined) {
      map.removeLayer(layer);
      layer = undefined;
    }
    const seedSpacing = Number(seedSel.value);
    const lines = streamlinesOf(SWIRL.u, SWIRL.v, { seedSpacing, maxSteps: 400, step: 0.5 });
    layer = await addStreamlineLayer(map, lines);
    // 判定用库返回物：出线、每条 ≥2 点、全部点在场界内（网格头几何，页内不另写边界）
    const { la0, lo0, nx, ny, di, dj } = SWIRL.u.header.grid;
    const south = la0 - (ny - 1) * dj;
    const east = lo0 + (nx - 1) * di;
    let points = 0;
    let inBounds = true;
    for (const line of lines) {
      points += line.points.length;
      for (const p of line.points) {
        if (p.lat > la0 || p.lat < south || p.lon < lo0 || p.lon > east) inBounds = false;
      }
    }
    const ok = lines.length > 0 && inBounds;
    judge("V1", ok, `${lines.length} 条 · ${points} 点 · 场界内 ${inBounds ? "✓" : "✗"}`);
    status.textContent = `种子间隔 ${seedSpacing}：${lines.length} 条流线（中心静风核不出线；换密度形态不变、线数变）`;
  };

  seedSel.addEventListener("change", () => void draw());
  void addGridLayer(map, windSpeedGrid(SWIRL.u, SWIRL.v), windProfile)
    .catch((error: unknown) => {
      status.textContent = `渲染失败：${error instanceof Error ? error.message : String(error)}`;
      judge("V1", false, "色斑底图抛错（见状态行）");
      return undefined;
    })
    .then(() => draw())
    .catch((error: unknown) => {
      status.textContent = `渲染失败：${error instanceof Error ? error.message : String(error)}`;
      judge("V1", false, "流线层抛错（见状态行）");
    });
};

// ---------------------------------------------------------------- V2（0.3.4 矢量批次·箭头场）

const mountV2 = (): void => {
  const host = document.getElementById("vf-v2-map");
  const status = document.getElementById("vf-v2-status");
  if (host === null || status === null) return;

  const map = L.map(host, {
    center: [36.5, 109.5],
    zoom: 4,
    zoomControl: false,
    attributionControl: false,
  });
  // 判定核心＝对拍契约：arrowFieldOf 与 windBarbsOf 同 step 同格位、方向逐点同值
  const spec = { step: 8, calmThreshold: 1 };
  const arrows = arrowFieldOf(PAIR.u, PAIR.v, spec);
  const barbs = windBarbsOf(PAIR.u, PAIR.v, spec);
  let aligned = arrows.length === barbs.length && arrows.length > 0;
  if (aligned) {
    for (let i = 0; i < arrows.length; i++) {
      const a = arrows[i];
      const b = barbs[i];
      if (
        a === undefined ||
        b === undefined ||
        a.lat !== b.lat ||
        a.lon !== b.lon ||
        Math.abs(a.direction - b.direction) > 1e-9
      ) {
        aligned = false;
        break;
      }
    }
  }
  judge(
    "V2",
    aligned,
    `${String(arrows.length)} 支 · 与杆同格同向 ${aligned ? "✓" : "✗"}（来向口径一致）`,
  );
  status.textContent = `等长箭头 ${String(arrows.length)} 支（蓝灰）＋对照风羽 ${String(barbs.length)} 根（深灰）——箭头只表方向，读数值看杆`;

  void addGridLayer(map, windSpeedGrid(PAIR.u, PAIR.v), windProfile, { opacity: 0.5 })
    .catch((error: unknown) => {
      status.textContent = `渲染失败：${error instanceof Error ? error.message : String(error)}`;
      judge("V2", false, "色斑底图抛错（见状态行）");
      return undefined;
    })
    .then(async () => {
      await addArrowFieldLayer(map, arrows);
      await addWindBarbGlyphs(map, barbs);
    })
    .catch((error: unknown) => {
      status.textContent = `渲染失败：${error instanceof Error ? error.message : String(error)}`;
      judge("V2", false, "箭头/风羽层抛错（见状态行）");
    });
};

// ---------------------------------------------------------------- V3（0.7 统计批次·风玫瑰与风向频率）

/** 构建期派生数据（gen-zspd-rose.mjs 产物）——守卫核对后才消费（unknown 收窄靠守卫
 *  不靠断言，守卫与类型在 ./zspd-rose-data 单源）。 */
if (!isZspdRoseData(roseData)) {
  throw new Error("验收台统计面板的数据形态不符（重跑 pnpm gen:zspd-rose 可再生）");
}
const ROSE_DATA = roseData;

/** 组件披露行的机读账（dataset 键与 windRose/windDirFrequency 两组件同名同义）。 */
const readLedger = (el: HTMLElement): Record<LedgerKey, string> => ({
  samples: el.dataset.samples ?? "",
  inSector: el.dataset.inSector ?? "",
  calm: el.dataset.calm ?? "",
  missingDirection: el.dataset.missingDirection ?? "",
  missingSpeed: el.dataset.missingSpeed ?? "",
});

const matchesExpected = (ledger: Record<LedgerKey, string>, expected: LedgerNumbers): boolean =>
  LEDGER_KEYS.every((key) => ledger[key] === String(expected[key]));

const mountV3 = (): void => {
  const pair = document.getElementById("vf-v3-pair");
  const read = document.getElementById("vf-v3-read");
  const monthsBox = document.getElementById("vf-v3-months");
  if (pair === null || read === null || monthsBox === null) return;

  // 全年一图：windRose 与 windDirFrequency 并排吃同一份数据（披露行逐字对拍）
  const yearSamples = toSamples(ROSE_DATA.months.flatMap((m) => m.samples));
  const rose = windRose(yearSamples, { title: "风玫瑰 · ZSPD 2024（来向 × kt 档）" });
  const freq = windDirFrequency(yearSamples, { form: "ring", title: "风向频率 · 同一份数据" });
  const roseFig = document.createElement("figure");
  const freqFig = document.createElement("figure");
  roseFig.append(rose);
  freqFig.append(freq);
  pair.replaceChildren(roseFig, freqFig);

  // 判定一：披露行与构建期实算期望逐项全等（组件账 vs gen 脚本独立实算账）
  const yearOk = matchesExpected(readLedger(rose), ROSE_DATA.expected.totals);
  // 判定二：两组件同输入的披露行逐字对拍（统计单源的机械保证，不只靠快照眼验）
  const parityOk = LEDGER_KEYS.every((key) => readLedger(freq)[key] === readLedger(rose)[key]);

  // 月度玫瑰阵：同一组件 12 次调用＋宿主侧共尺——radiusMax 由宿主从数据算出
  // （各月最长瓣占比向上取整到 5 的倍数；7 月 48.2% → 50%），组件不新增 API
  const half = 11.25;
  const width = 22.5; // 16 扇区：中心对齐归桶（＋半格取整）
  let maxShare = 0;
  for (const m of ROSE_DATA.months) {
    const tally = Array.from({ length: 16 }, () => 0);
    let inSector = 0;
    for (const [direction, speed] of m.samples) {
      if (
        speed === null ||
        speed === undefined ||
        speed < 1 ||
        direction === null ||
        direction === undefined
      )
        continue; // 与组件同剔除口径
      const si = Math.floor(((direction + half) % 360) / width);
      const cell = tally[si];
      if (cell !== undefined) tally[si] = cell + 1;
      inSector += 1;
    }
    maxShare = Math.max(maxShare, (Math.max(...tally) / inSector) * 100);
  }
  const sharedRadiusMax = Math.ceil(maxShare / 5) * 5;
  const monthPanels = ROSE_DATA.months.map((m, i) => {
    const panel = windRose(toSamples(m.samples), {
      radiusMax: sharedRadiusMax,
      title: `${m.month} 月`,
    });
    const fig = document.createElement("figure");
    fig.append(panel);
    const cap = document.createElement("figcaption");
    cap.textContent = `${m.month} 月 · 入扇区 n=${panel.dataset.inSector}`;
    fig.append(cap);
    const expected = ROSE_DATA.expected.months[i];
    if (expected === undefined) throw new Error(`V3 期望账缺 ${m.month} 月`);
    return { fig, panel, expected };
  });
  monthsBox.replaceChildren(...monthPanels.map((m) => m.fig));
  // 判定三：逐月披露行对期望全等＋共尺落位（12 张 data-rim 逐张相同）
  const monthsOk =
    monthPanels.every((m) => matchesExpected(readLedger(m.panel), m.expected)) &&
    monthPanels.every((m) => m.panel.dataset.rim === String(sharedRadiusMax));

  judge(
    "V3",
    yearOk && parityOk && monthsOk,
    `全年账对期望 ${yearOk ? "✓" : "✗"} · 两组件披露行对拍 ${parityOk ? "✓" : "✗"} · 逐月账＋共尺 ${monthsOk ? "✓" : "✗"}`,
  );
  const ledger = readLedger(rose);
  read.textContent = `样本 ${ledger.samples}＝静风 ${ledger.calm}＋缺向 ${ledger.missingDirection}＋缺速 ${ledger.missingSpeed}＋入扇区 ${ledger.inSector}（与 IEM 原始 CSV 的构建期实算逐项全等；满圈 ${String(sharedRadiusMax)}% 共尺）`;
};

// ---------------------------------------------------------------- 启动

mountT1();
mountT2();
mountT3();
mountT4();
mountT5();
mountT6();
mountT7();
mountV1();
mountV2();
mountV3();
