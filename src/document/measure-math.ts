import type { AnglePrimitive } from "./angle.ts";
import {
  anchorRotatedVertex,
  baseHeightWorldVertices,
} from "./base-height-family.ts";
import type { Primitive2d } from "./parse-document.ts";
import { regularPolygonWorldVertices } from "./regular-polygon.ts";
import type { Point2 } from "./snap.ts";

/**
 * 度量数学纯函数层（ADR 0020）：渲染期推导值的唯一出口。
 * 数值不进契约——输入是图元的几何字段，输出是推导数值与显示文本，
 * 与 `dimension` 距离同构。角度 sweep 与面积/周长公式在此收口。
 */

/** 圆族（角/弧/扇形/弓形）的逆时针 sweep，落在 [0°,360°]。
 *  起止重合是退化点弧（0°）；差整周是整圆（360°）。角的零角/周角
 *  在契约层被拒，弧族允许退化，函数对两者保持全。 */
export function angleSweepDeg(startDeg: number, endDeg: number): number {
  if (startDeg === endDeg) return 0;
  const raw = (endDeg - startDeg) % 360;
  const sweep = raw < 0 ? raw + 360 : raw;
  return sweep === 0 ? 360 : sweep;
}

/** 统一数字格式化：两位小数四舍五入再去尾零（45、12.5、3.14），
 *  与尺寸标注线的显示完全一致；度数带 ° 后缀，面积/周长不带单位。 */
export function formatMeasureNumber(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** 角的显示度数文本：推导 sweep 加 ° 后缀，随方向角实时联动。 */
export function angleDegreeText(angle: AnglePrimitive): string {
  return `${formatMeasureNumber(
    angleSweepDeg(angle.startDeg, angle.endDeg),
  )}°`;
}

/** 度量种类：kind 是 measure 图元（ADR 0020）的语义槽。"length"
 *  （折线/弧总长）是将来增量，类型结构预留、本期不实现。 */
export type MeasureKind = "area" | "perimeter" | "length";

/** 本期已实现的度量种类（白名单 refine 与公式表只接受这两种）。 */
export type ImplementedMeasureKind = Exclude<MeasureKind, "length">;

/** 可度量封闭图元（11 种 2D 参数封闭族）——schema 层白名单的数学层镜像；
 *  将来开放折线长度或重叠填充时在这里与 schema 同步单点增量。 */
export type MeasurableShape = Extract<
  Primitive2d,
  {
    type:
      | "polygon"
      | "rectangle"
      | "triangle"
      | "parallelogram"
      | "trapezoid"
      | "regularPolygon"
      | "circle"
      | "sector"
      | "bow"
      | "ring"
      | "ellipse";
  }
>;

const DEG = Math.PI / 180;

/** 鞋带公式：顶点逆时针为正、顺时针为负，面积取绝对值（凹形同样成立）。 */
function shoelaceArea(vertices: readonly Point2[]): number {
  let sum = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** 边长和：首尾相接的闭合边界全长。 */
function boundaryLength(vertices: readonly Point2[]): number {
  let sum = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}

/** 矩形世界顶点：四角按局部逆时针，走 ADR 0015 锚点旋转变换
 *  （与底/高族共用 anchorRotatedVertex，不再另写三角学）。 */
function rectangleWorldVertices(
  shape: Extract<MeasurableShape, { type: "rectangle" }>,
): Point2[] {
  const halfWidth = shape.width / 2;
  const halfHeight = shape.height / 2;
  return (
    [
      { x: halfWidth, y: halfHeight },
      { x: -halfWidth, y: halfHeight },
      { x: -halfWidth, y: -halfHeight },
      { x: halfWidth, y: -halfHeight },
    ] as const
  ).map((corner) => anchorRotatedVertex(shape, corner));
}

/** 多边形族（世界顶点路径的 6 种）：顶点目录各有唯一几何源，此处只做汇总分发。 */
type VertexFamilyShape = Extract<
  MeasurableShape,
  {
    type:
      | "polygon"
      | "rectangle"
      | "triangle"
      | "parallelogram"
      | "trapezoid"
      | "regularPolygon";
  }
>;

/** 多边形族的顶点目录分发：各自唯一几何源（points / 四角 / 局部顶点）。 */
function worldVertices(shape: VertexFamilyShape): Point2[] {
  switch (shape.type) {
    case "polygon":
      return shape.points;
    case "rectangle":
      return rectangleWorldVertices(shape);
    case "triangle":
    case "parallelogram":
    case "trapezoid":
      return baseHeightWorldVertices(shape);
    case "regularPolygon":
      return regularPolygonWorldVertices(shape);
  }
}

/** 各图元的 {面积, 周长} 推导：多边形族走世界顶点（鞋带/边长和，
 *  旋转自然吸收进顶点），圆族各有解析闭式。switch 对判别联合穷尽，
 *  新增可度量类型时 default 的 never 赋值编译期报错兜底。 */
function closedValues(shape: MeasurableShape): {
  area: number;
  perimeter: number;
} {
  switch (shape.type) {
    case "polygon":
    case "rectangle":
    case "triangle":
    case "parallelogram":
    case "trapezoid":
    case "regularPolygon": {
      const vertices = worldVertices(shape);
      return {
        area: shoelaceArea(vertices),
        perimeter: boundaryLength(vertices),
      };
    }
    case "circle":
      return {
        area: Math.PI * shape.r ** 2,
        perimeter: 2 * Math.PI * shape.r,
      };
    case "sector": {
      // 边界全长 = 弧长 + 两半径；整周 sweep 按公式保持全。
      const sweep = angleSweepDeg(shape.startDeg, shape.endDeg) * DEG;
      return {
        area: (shape.r ** 2 * sweep) / 2,
        perimeter: shape.r * sweep + 2 * shape.r,
      };
    }
    case "bow": {
      // 弓形 = 扇形 − 等腰三角形；边界全长 = 弧长 + 弦长。
      const sweep = angleSweepDeg(shape.startDeg, shape.endDeg) * DEG;
      return {
        area: (shape.r ** 2 * (sweep - Math.sin(sweep))) / 2,
        perimeter: shape.r * sweep + 2 * shape.r * Math.sin(sweep / 2),
      };
    }
    case "ring":
      // 边界全长 = 内外两圈之和（割补课件与课本定义一致）。
      return {
        area: Math.PI * (shape.rOuter ** 2 - shape.rInner ** 2),
        perimeter: 2 * Math.PI * (shape.rOuter + shape.rInner),
      };
    case "ellipse":
      // 面积 πab 旋转不变；周长无初等闭式，取 Ramanujan 第一近似
      // （相对误差量级 1e-5，远小于两位小数的显示精度）。
      return {
        area: Math.PI * shape.rx * shape.ry,
        perimeter:
          Math.PI *
          (3 * (shape.rx + shape.ry) -
            Math.sqrt(
              (3 * shape.rx + shape.ry) * (shape.rx + 3 * shape.ry),
            )),
      };
    default: {
      const unhandled: never = shape;
      throw new Error(`unhandled measurable type: ${String(unhandled)}`);
    }
  }
}

/** 度量推导值：按图元类型的解析闭式取面积或周长。 */
export function measureValue(
  shape: MeasurableShape,
  kind: ImplementedMeasureKind,
): number {
  return closedValues(shape)[kind];
}

/** 度量显示文本：两位小数去尾零、不带单位（spec Implementation Decisions）。 */
export function measureText(
  shape: MeasurableShape,
  kind: ImplementedMeasureKind,
): string {
  return formatMeasureNumber(measureValue(shape, kind));
}
