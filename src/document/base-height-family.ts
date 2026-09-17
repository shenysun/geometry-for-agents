import type { Primitive2d } from "./parse-document.ts";
import type { Point2 } from "./snap.ts";

/**
 * 底/高家族（三角形、平行四边形、梯形，ADR 0017）：锚点是底边中点
 * （梯形为下底中点），底沿局部 X，高沿局部 +Y，旋转绕锚点。
 * 局部顶点与世界顶点是命中、渲染、控制点三个模块共用的唯一几何源。
 */
export type BaseHeightShape = Extract<
  Primitive2d,
  { type: "triangle" | "parallelogram" | "trapezoid" }
>;

const DEG = Math.PI / 180;

/** 局部顶点（逆时针，底边在局部 y=0）：三角 3 个、平四/梯 4 个，下标即 corner-i。 */
export function baseHeightLocalVertices(shape: BaseHeightShape): Point2[] {
  switch (shape.type) {
    case "triangle":
      return [
        { x: -shape.width / 2, y: 0 },
        { x: shape.width / 2, y: 0 },
        { x: shape.apexOffset, y: shape.height },
      ];
    case "parallelogram":
      return [
        { x: -shape.width / 2, y: 0 },
        { x: shape.width / 2, y: 0 },
        { x: shape.width / 2 + shape.skew, y: shape.height },
        { x: -shape.width / 2 + shape.skew, y: shape.height },
      ];
    case "trapezoid":
      return [
        { x: -shape.width / 2, y: 0 },
        { x: shape.width / 2, y: 0 },
        { x: shape.topWidth / 2 + shape.topOffset, y: shape.height },
        { x: -shape.topWidth / 2 + shape.topOffset, y: shape.height },
      ];
  }
}

/** ADR 0015 锚点旋转变换：局部偏移随 rotationDeg 绕锚点 (x,y) 旋到世界
 *  （逆时针为正，与几何字段同一约定）。底/高族与矩形的度量层共用——
 *  参数取结构锚点契约，凡「锚点 + rotationDeg」的图元皆可传入。 */
export function anchorRotatedVertex(
  shape: { readonly x: number; readonly y: number; readonly rotationDeg: number },
  offset: Point2,
): Point2 {
  const rad = shape.rotationDeg * DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: shape.x + offset.x * cos - offset.y * sin,
    y: shape.y + offset.x * sin + offset.y * cos,
  };
}

/** 世界顶点目录：局部顶点旋到世界，渲染与命中直接消费。 */
export function baseHeightWorldVertices(shape: BaseHeightShape): Point2[] {
  return baseHeightLocalVertices(shape).map((vertex) =>
    anchorRotatedVertex(shape, vertex),
  );
}

/** 世界点逆旋转回锚点原点的局部系：拖控制点与局部度量的入口。 */
export function baseHeightLocalOffset(
  shape: BaseHeightShape,
  world: Point2,
): Point2 {
  const rad = -shape.rotationDeg * DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = world.x - shape.x;
  const dy = world.y - shape.y;
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}
