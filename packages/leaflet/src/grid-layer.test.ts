// @vitest-environment happy-dom
/**
 * addGridLayer 可测面：选项校验（不静默纪律）、贴图边界几何（纯函数）、
 * 无 Canvas 2D 宿主的显式报错；位图段打通（fake canvas）后的图层装配面——
 * 不透明度缺省与 setOpacity 原地调节、独立 pane 的层级位次。像素正确性不在此
 * 重复——渲染本体 renderToImageData 是零 DOM 纯函数，由 @metweave/grid 的
 * core.test.ts 逐像素与快照锁死。
 */
import { afterEach, describe, expect, it } from "vitest";
import * as L from "leaflet";
import { addGridLayer, gridOverlayBounds } from "./index";
import { tmpProfile, type Grid, type GridHeader } from "@metweave/grid";

/** 最小合法网格：3×3 中国域一角（K→°C 全档覆盖由档案负责，这里只关心几何与管线） */
const testGrid = (): Grid => ({
  header: {
    version: 1,
    variable: "TMP",
    level: "2m",
    unit: "K",
    grid: { nx: 3, ny: 3, la0: 55, lo0: 70, di: 0.25, dj: 0.25, order: "N2S,W2E,row-major" },
    stats: { min: 273.15, max: 283.15, p10: 275, p25: 276, p50: 278, p75: 280, p90: 282, p99: 283 },
    meta: {
      referenceTime: "2026-10-04T06:00Z",
      forecastHour: 0,
      source: "test",
      license: "",
      generated: "2026-10-04",
    },
  } satisfies GridHeader,
  values: Float32Array.from([273.15, 275, 277, 279, 281, 283.15, 278, 276, 274]),
});

/** 每例收尾摘除地图（happy-dom 里 map 容器是共享 document.body） */
const maps: L.Map[] = [];
afterEach(() => {
  for (const m of maps.splice(0)) m.remove();
});
const freshMap = (): L.Map => {
  document.body.innerHTML = '<div id="map" style="width: 400px; height: 300px"></div>';
  // 必须带初始视野：无 view 的 map 未 ready，addLayer 的 onAdd 被 whenReady 挂起
  // （imageOverlay 不建 img、getElement() 恒 undefined——之前实测踩坑）
  const m = L.map("map", { center: [40, 100], zoom: 4 });
  maps.push(m);
  return m;
};

/**
 * happy-dom 无位图后端（getContext("2d") 恒 null）：patch canvas 原型走通位图段，
 * 让 addGridLayer 走到 imageOverlay 装配——像素值不经过此处（内核测试负责），
 * PNG data URL 用哑元。返回还原函数。
 */
const installFakeCanvas = (): (() => void) => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  const origGetContext = proto.getContext;
  const origToDataURL = proto.toDataURL;
  proto.getContext = () => ({
    createImageData: (w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    }),
    putImageData: () => {},
  });
  proto.toDataURL = () => "data:image/png;base64,ZmFrZQ==";
  return () => {
    proto.getContext = origGetContext;
    proto.toDataURL = origToDataURL;
  };
};

describe("gridOverlayBounds（贴图边界几何）", () => {
  it("格点中心几何外延半格＝像元边界（西南/北东次序）", () => {
    const bounds = gridOverlayBounds(testGrid());
    // la0=55、ny=3、dj=0.25 → 北 55.125、南 55-0.5-0.125=54.375；lo0=70、nx=3、di=0.25 → 西 69.875、东 70.625
    expect(bounds).toEqual([
      [54.375, 69.875],
      [55.125, 70.625],
    ]);
  });

  it("单格点网格退化为以该点为中心的方格", () => {
    const g = testGrid();
    const single: Grid = {
      header: { ...g.header, grid: { ...g.header.grid, nx: 1, ny: 1 } },
      values: Float32Array.from([273.15]),
    };
    expect(gridOverlayBounds(single)).toEqual([
      [54.875, 69.875],
      [55.125, 70.125],
    ]);
  });
});

describe("addGridLayer", () => {
  it("未知选项运行时抛错（拼写错误不静默）", async () => {
    const map = freshMap();
    await expect(
      addGridLayer(map, testGrid(), tmpProfile, { opacityy: 0.5 } as never),
    ).rejects.toThrow('addGridLayer 收到未知选项 "opacityy"');
  });

  it("无 Canvas 2D 能力的宿主显式报错（不静默空图层）", async () => {
    const map = freshMap();
    // happy-dom 的 canvas.getContext("2d") 返回 null（无位图后端）——正是要锁的行为面：
    // 渲染先走零 DOM 的 renderToImageData（成功），位图封装失败必须清晰报错
    await expect(addGridLayer(map, testGrid(), tmpProfile)).rejects.toThrow(/Canvas 2D/);
  });

  it("坏档案在渲染前抛错（GridError 透传，不进位图段）", async () => {
    const map = freshMap();
    const broken = {
      ...tmpProfile,
      equal: { min: 40, max: -40, bins: 20 }, // 域倒置
    };
    await expect(addGridLayer(map, testGrid(), broken)).rejects.toThrow(/等距档域非法/);
  });

  it("自定义 scale 覆盖档案缺省：坏断点在渲染前抛错（证明覆盖介入，非档案路径）", async () => {
    const map = freshMap();
    // 断点非严格递增——若 addGridLayer 仍走档案缺省就不会触碰这个坏 scale
    await expect(
      addGridLayer(map, testGrid(), tmpProfile, {
        scale: { breaks: [5, 2], colors: ["#000000", "#ffffff"] },
      }),
    ).rejects.toThrow(/严格递增/);
  });

  it("自定义 scale 合法时正常装配（显示单位断点空间，业务定制位）", async () => {
    const restore = installFakeCanvas();
    try {
      const map = freshMap();
      // testGrid 场值 0–10°C（K 经档案换算）：自定义三档双色（显示单位断点）
      const overlay = await addGridLayer(map, testGrid(), tmpProfile, {
        scale: { breaks: [2, 5, 8], colors: ["#101010", "#f0f0f0", "#505050"] },
      });
      expect(overlay.getElement()).not.toBeNull();
      expect(map.hasLayer(overlay)).toBe(true);
    } finally {
      restore();
    }
  });
});

describe("addGridLayer 图层装配面（fake canvas 走通位图段）", () => {
  it("opacity 缺省 0.6 经图层不透明度生效，setOpacity 原地调不重建层", async () => {
    const restore = installFakeCanvas();
    try {
      const map = freshMap();
      const overlay = await addGridLayer(map, testGrid(), tmpProfile);
      const img = overlay.getElement();
      expect(img).not.toBeNull();
      expect(overlay.options.opacity).toBe(0.6);
      expect(img?.style.opacity).toBe("0.6");
      overlay.setOpacity(0.35);
      expect(img?.style.opacity).toBe("0.35");
      expect(map.hasLayer(overlay)).toBe(true); // 原地调：层始终在场
    } finally {
      restore();
    }
  });

  it("显式 opacity 透传到图层（超界收敛 [0,1]）", async () => {
    const restore = installFakeCanvas();
    try {
      const map = freshMap();
      const a = await addGridLayer(map, testGrid(), tmpProfile, { opacity: 0.9 });
      expect(a.options.opacity).toBe(0.9);
      expect(a.getElement()?.style.opacity).toBe("0.9");
      // 收敛到 1：Leaflet 对满档不透明不写 style（opacity<1 才落 style）——空串即满档
      const b = await addGridLayer(map, testGrid(), tmpProfile, { opacity: 1.5 });
      expect(b.options.opacity).toBe(1);
      expect(b.getElement()?.style.opacity).toBe("");
    } finally {
      restore();
    }
  });

  it("色斑层挂独立 pane mw-grid：瓦片(200)之上、矢量/标记(≥400)之下，幂等建 pane", async () => {
    const restore = installFakeCanvas();
    try {
      const map = freshMap();
      const overlay = await addGridLayer(map, testGrid(), tmpProfile);
      // 内置 pane 的层级来自 leaflet.css（tilePane 200 / overlayPane 400 / markerPane 600），
      // happy-dom 未加载样式表读不到——锁 mw-grid 的内联 z 落在 200 与 400 的空隙位即可
      const pane = map.getPane("mw-grid");
      expect(pane).toBeDefined();
      expect(pane?.style.zIndex).toBe("350");
      expect(map.getPane("tilePane")).toBeDefined();
      expect(map.getPane("overlayPane")).toBeDefined();
      expect(map.getPane("markerPane")).toBeDefined();
      expect(overlay.getElement()?.parentElement).toBe(pane);
      expect(overlay.getElement()?.parentElement).not.toBe(map.getPane("overlayPane"));
      // 换层数据（remove+add 再来一层）：pane 幂等复用，两个叠加层同 pane
      const second = await addGridLayer(map, testGrid(), tmpProfile);
      expect(map.getPane("mw-grid")).toBe(pane);
      expect(second.getElement()?.parentElement).toBe(pane);
      map.removeLayer(overlay);
      map.removeLayer(second);
    } finally {
      restore();
    }
  });
});
