import type { AnglePrimitive } from "./angle.ts";
import {
  anchorRotatedVertex,
  baseHeightWorldVertices,
} from "./base-height-family.ts";
import type { Primitive } from "./parse-document.ts";
import { measurable2dTypes } from "./parse-document.ts";
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
  Primitive,
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

/** 图元是否属可度量封闭白名单：schema 层白名单（measurable2dTypes）的
 *  数学层入口，渲染与手势据此把源收窄成 MeasurableShape（白名单只含
 *  2D 类型，对全联合判别即收窄）。 */
export function isMeasurableShape(
  primitive: Primitive,
): primitive is MeasurableShape {
  return measurable2dTypes.has(primitive.type);
}

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

/** 顶点均值：退化多边形（共线，面积形心公式分母为零）的回退锚点。 */
function verticesCentroid(vertices: readonly Point2[]): Point2 {
  const sum = vertices.reduce(
    (total, point) => ({ x: total.x + point.x, y: total.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / vertices.length, y: sum.y / vertices.length };
}

/** 多边形族的面积形心（鞋带质心公式）：梯形等一般多边形的真形心，
 *  不是顶点均值；顶点已随 rotationDeg 旋到世界，公式与坐标系无关。 */
function polygonAreaCentroid(vertices: readonly Point2[]): Point2 {
  let twiceArea = 0;
  let xMoment = 0;
  let yMoment = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const cross = a.x * b.y - b.x * a.y;
    twiceArea += cross;
    xMoment += (a.x + b.x) * cross;
    yMoment += (a.y + b.y) * cross;
  }
  if (twiceArea === 0) {
    return verticesCentroid(vertices);
  }
  return { x: xMoment / (3 * twiceArea), y: yMoment / (3 * twiceArea) };
}

/** 圆心沿起止角平分线方向的偏移点：扇形/弓形形心都在平分线上。 */
function bisectorPoint(
  cx: number,
  cy: number,
  distance: number,
  startDeg: number,
  endDeg: number,
): Point2 {
  const mid = (startDeg + angleSweepDeg(startDeg, endDeg) / 2) * DEG;
  return { x: cx + distance * Math.cos(mid), y: cy + distance * Math.sin(mid) };
}

/** 面积文本的锚点：源的面积形心（spec Implementation Decisions）——
 *  多边形族走鞋带质心，扇形/弓形沿平分线取解析形心，圆/环/椭圆的中心
 *  即形心。 */
export function measureAreaAnchor(shape: MeasurableShape): Point2 {
  switch (shape.type) {
    case "polygon":
    case "rectangle":
    case "triangle":
    case "parallelogram":
    case "trapezoid":
    case "regularPolygon":
      return polygonAreaCentroid(worldVertices(shape));
    case "circle":
    case "ring":
    case "ellipse":
      return { x: shape.cx, y: shape.cy };
    case "sector": {
      // 扇形形心离圆心距离：4r·sin(θ/2) / 3θ（θ 为弧度）。
      const theta = angleSweepDeg(shape.startDeg, shape.endDeg) * DEG;
      const distance = (4 * shape.r * Math.sin(theta / 2)) / (3 * theta);
      return bisectorPoint(
        shape.cx,
        shape.cy,
        distance,
        shape.startDeg,
        shape.endDeg,
      );
    }
    case "bow": {
      // 弓形（圆缺）形心离圆心距离：4r·sin³(θ/2) / 3(θ − sinθ)。
      const theta = angleSweepDeg(shape.startDeg, shape.endDeg) * DEG;
      const distance =
        (4 * shape.r * Math.sin(theta / 2) ** 3) /
        (3 * (theta - Math.sin(theta)));
      return bisectorPoint(
        shape.cx,
        shape.cy,
        distance,
        shape.startDeg,
        shape.endDeg,
      );
    }
  }
}

/** 轴对齐世界包围盒（世界系 y 向上，maxY 即「上方」）。 */
type WorldBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function boundsOfPoints(points: readonly Point2[]): WorldBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y } of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

/** 轴向极值点（0°/90°/180°/270° 方向的弧上点）：落在扫过弧内才存在。
 *  扇形/弓形的紧包络由这些点决定——整圆包络会把小弧的标注推得太远。 */
function axisExtremumOnArc(
  shape: Extract<MeasurableShape, { type: "sector" | "bow" }>,
  axisDeg: 0 | 90 | 180 | 270,
  sweepDeg: number,
): Point2 | null {
  const offset = (((axisDeg - shape.startDeg) % 360) + 360) % 360;
  if (offset >= sweepDeg) return null;
  return {
    x: shape.cx + shape.r * Math.cos(axisDeg * DEG),
    y: shape.cy + shape.r * Math.sin(axisDeg * DEG),
  };
}

/** 扇形/弓形的包络点集：弧两端点 + 扫到的轴向极值点，圆心按图形是否
 *  含它补入——扇形恒含圆心，弓形仅大弓（sweep ≥ 180°）含（小弓在弦的
 *  另一侧，弦本身在弧端点的凸包内，不另贡献边界）。 */
function arcFamilyBoundsPoints(
  shape: Extract<MeasurableShape, { type: "sector" | "bow" }>,
): Point2[] {
  const sweep = angleSweepDeg(shape.startDeg, shape.endDeg);
  const arcEnds: readonly Point2[] = [
    {
      x: shape.cx + shape.r * Math.cos(shape.startDeg * DEG),
      y: shape.cy + shape.r * Math.sin(shape.startDeg * DEG),
    },
    {
      x: shape.cx + shape.r * Math.cos(shape.endDeg * DEG),
      y: shape.cy + shape.r * Math.sin(shape.endDeg * DEG),
    },
  ];
  const extrema = ([0, 90, 180, 270] as const)
    .map((axisDeg) => axisExtremumOnArc(shape, axisDeg, sweep))
    .filter((point): point is Point2 => point !== null);
  const center: readonly Point2[] =
    shape.type === "sector" || sweep >= 180 ? [{ x: shape.cx, y: shape.cy }] : [];
  return [...center, ...arcEnds, ...extrema];
}

/** 圆心 + 半径的轴对称包络：圆与环（取外半径）共用。 */
function radialBounds(cx: number, cy: number, r: number): WorldBounds {
  return {
    minX: cx - r,
    minY: cy - r,
    maxX: cx + r,
    maxY: cy + r,
  };
}

/** 各可度量图元的世界紧包围盒：多边形族走世界顶点（旋转已吸收），
 *  椭圆按半轴旋转投影，扇形/弓形按弧点集，圆/环取解析包络。 */
function measurableBounds(shape: MeasurableShape): WorldBounds {
  switch (shape.type) {
    case "polygon":
    case "rectangle":
    case "triangle":
    case "parallelogram":
    case "trapezoid":
    case "regularPolygon":
      return boundsOfPoints(worldVertices(shape));
    case "circle":
      return radialBounds(shape.cx, shape.cy, shape.r);
    case "sector":
    case "bow":
      return boundsOfPoints(arcFamilyBoundsPoints(shape));
    case "ring":
      return radialBounds(shape.cx, shape.cy, shape.rOuter);
    case "ellipse": {
      // 旋转椭圆的包围半径：半轴按旋转角投影取包络。
      const cos = Math.cos(shape.rotationDeg * DEG);
      const sin = Math.sin(shape.rotationDeg * DEG);
      const ex = Math.hypot(shape.rx * cos, shape.ry * sin);
      const ey = Math.hypot(shape.rx * sin, shape.ry * cos);
      return {
        minX: shape.cx - ex,
        minY: shape.cy - ey,
        maxX: shape.cx + ex,
        maxY: shape.cy + ey,
      };
    }
  }
}

/** 周长文本的锚点：源紧包围盒的上方中点（spec Implementation
 *  Decisions——世界系 y 向上，区别于面积标注的源形心）。 */
export function measurePerimeterAnchor(shape: MeasurableShape): Point2 {
  const bounds = measurableBounds(shape);
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: bounds.maxY,
  };
}
