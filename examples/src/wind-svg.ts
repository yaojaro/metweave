/**
 * 演示页共用的两枚 SVG 装配器（wind.html 与 verify.html）。
 *
 * 这两段本来是各页自己写的 30 行样板——抽出来既少一处重复，也把「库只给 path、成品要自己拼」
 * 这件事的成本摆明：真要做产品，`windBarbSvg(direction, speed, { unit })` 应该是库里的一件
 * （已记进 docs/19 §6.2 的待办），而不是每个宿主重写一遍。
 *
 * 几何契约（与 `@metweave/leaflet` 的 divIcon 完全一致）：32×32 盒、站心 (16,16)、杆恒向上，
 * 方向靠 `rotate(dir 16 16)` 施加；`windBarbPath` 出来的杆必须自己转，`windArrowPath` 自带朝向。
 */
import { windArrowPath, windBarbPath } from "@metweave/leaflet";
import type { WindSpeedUnit } from "@metweave/grid";

const SVG_NS = "http://www.w3.org/2000/svg";
/** 与 leaflet 层的风羽盒一致（32×32、站心 16,16） */
const BARB_BOX = 32;
const CX = 16;

const el = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string>>,
): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
};

/** 一枚风羽（方向＋速度编码）。`direction` 是气象来向，杆会转到该方向。 */
export const barbSvg = (
  direction: number,
  speed: number,
  unit: WindSpeedUnit,
  color = "#2c3e50",
): SVGSVGElement => {
  const paths = windBarbPath(speed, { unit });
  const root = el("svg", {
    width: String(BARB_BOX),
    height: String(BARB_BOX),
    viewBox: `0 0 ${BARB_BOX} ${BARB_BOX}`,
    "aria-hidden": "true",
  });
  const group = el("g", { transform: `rotate(${direction} ${CX} ${CX})` });
  group.append(
    el("path", {
      d: paths.stroke,
      fill: "none",
      stroke: color,
      "stroke-width": "1.4",
      "stroke-linecap": "round",
    }),
  );
  if (paths.fill !== "") {
    group.append(el("path", { d: paths.fill, fill: color, stroke: color, "stroke-width": "1" }));
  }
  root.append(group);
  return root;
};

/** 一枚箭头（只方向）。`pointing` 缺省 "from"＝指向来向（与风羽杆同向）。 */
export const arrowSvg = (
  direction: number,
  pointing: "from" | "to" = "from",
  color = "#b3541e",
): SVGSVGElement => {
  const paths = windArrowPath(direction, { pointing });
  const root = el("svg", {
    width: String(BARB_BOX),
    height: String(BARB_BOX),
    viewBox: `0 0 ${BARB_BOX} ${BARB_BOX}`,
    "aria-hidden": "true",
  });
  root.append(
    el("path", {
      d: paths.stroke,
      fill: "none",
      stroke: color,
      "stroke-width": "1.4",
      "stroke-linecap": "round",
    }),
    el("path", { d: paths.fill, fill: color, stroke: color, "stroke-width": "1" }),
  );
  return root;
};
