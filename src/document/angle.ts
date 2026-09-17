import type { Primitive2d } from "./parse-document.ts";
import type { Point2 } from "./snap.ts";
import { angleSweepDeg } from "./measure-math.ts";

/**
 * 角图元（笔画族，ADR 0017）：顶点是锚点，两条边沿圆族度数惯例
 * （0° 在 +X、逆时针）等长，弧标是身份、总是渲染。度数不进图元——
 * 那是方向角的推导值。
 */
export type AnglePrimitive = Extract<Primitive2d, { type: "angle" }>;

/** 弧标半径占边长的比例（渲染细节，不进契约）。 */
export const ANGLE_ARC_RATIO = 0.25;

/** 度数锚点半径占边长的比例：大于弧标比例，数字落在弧标外侧。 */
export const ANGLE_DEGREE_LABEL_RATIO = 0.35;

const DEG = Math.PI / 180;

/** 圆族度数惯例下的极坐标点。 */
function polar(center: Point2, r: number, deg: number): Point2 {
  const rad = deg * DEG;
  return {
    x: center.x + r * Math.cos(rad),
    y: center.y + r * Math.sin(rad),
  };
}

/** 起始边的端点。 */
export function angleStartPoint(angle: AnglePrimitive): Point2 {
  return polar({ x: angle.x, y: angle.y }, angle.length, angle.startDeg);
}

/** 终止边的端点。 */
export function angleEndPoint(angle: AnglePrimitive): Point2 {
  return polar({ x: angle.x, y: angle.y }, angle.length, angle.endDeg);
}

/** 弧标半径：按边长比例。 */
export function angleArcRadius(angle: AnglePrimitive): number {
  return angle.length * ANGLE_ARC_RATIO;
}

/** 度数显示锚点：顶点沿角平分线方向、弧标外侧偏移处（spec 钉死，纯函数）。 */
export function angleDegreeAnchor(angle: AnglePrimitive): Point2 {
  const bisectorDeg =
    angle.startDeg +
    angleSweepDeg(angle.startDeg, angle.endDeg) / 2;
  return polar(
    { x: angle.x, y: angle.y },
    angle.length * ANGLE_DEGREE_LABEL_RATIO,
    bisectorDeg,
  );
}
