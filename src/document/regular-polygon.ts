import type { Primitive2d } from "./parse-document.ts";
import type { Point2 } from "./snap.ts";

/**
 * 正多边形（ADR 0017）：锚点是中心（即外接圆心），r 是外接圆半径，
 * 缺省朝向平底——一条边平行局部 X 且在下方（正五边形房子形、正六边形
 * 平底卧放）。局部顶点是命中、渲染、控制点共用的唯一几何源。
 */
export type RegularPolygonPrimitive = Extract<
  Primitive2d,
  { type: "regularPolygon" }
>;

const DEG = Math.PI / 180;

/**
 * 局部顶点（逆时针）：第 k 个顶点在 -90° + 180°/n + k·360°/n——
 * 偏移 180°/n 使一条边（而非一个顶点）落在正下方。
 */
export function regularPolygonLocalVertices(
  shape: RegularPolygonPrimitive,
): Point2[] {
  const startDeg = -90 + 180 / shape.sides;
  return Array.from({ length: shape.sides }, (_, k) => {
    const deg = startDeg + (360 / shape.sides) * k;
    const rad = deg * DEG;
    return { x: shape.r * Math.cos(rad), y: shape.r * Math.sin(rad) };
  });
}

/** 世界顶点目录：局部顶点随 rotationDeg 绕中心旋到世界。 */
export function regularPolygonWorldVertices(
  shape: RegularPolygonPrimitive,
): Point2[] {
  const rad = shape.rotationDeg * DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return regularPolygonLocalVertices(shape).map((vertex) => ({
    x: shape.x + vertex.x * cos - vertex.y * sin,
    y: shape.y + vertex.x * sin + vertex.y * cos,
  }));
}
