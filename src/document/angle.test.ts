import { describe, expect, test } from "vitest";
import {
  ANGLE_ARC_RATIO,
  ANGLE_DEGREE_LABEL_RATIO,
  angleArcRadius,
  angleDegreeAnchor,
  angleEndPoint,
  angleStartPoint,
  type AnglePrimitive,
} from "./angle.ts";

function expectCloseTo(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(1e-9);
}

const angle: AnglePrimitive = {
  id: "angle-1",
  type: "angle",
  x: 1,
  y: 2,
  startDeg: 0,
  endDeg: 90,
  length: 4,
};

describe("角几何", () => {
  test("两边端点沿圆族度数惯例（0° 在 +X，逆时针）", () => {
    const start = angleStartPoint(angle);
    const end = angleEndPoint(angle);
    expectCloseTo(start.x, 5);
    expectCloseTo(start.y, 2);
    expectCloseTo(end.x, 1);
    expectCloseTo(end.y, 6);
  });

  test("弧标半径按边长比例", () => {
    expect(angleArcRadius(angle)).toBe(4 * ANGLE_ARC_RATIO);
  });

  test("度数锚点沿角平分线在弧标外侧", () => {
    // 0°→90° 的平分线是 45°，锚点半径按边长比例且大于弧标半径。
    const anchor = angleDegreeAnchor(angle);
    const radius = 4 * ANGLE_DEGREE_LABEL_RATIO;
    expectCloseTo(anchor.x, 1 + radius * Math.cos(Math.PI / 4));
    expectCloseTo(anchor.y, 2 + radius * Math.sin(Math.PI / 4));
    expect(ANGLE_DEGREE_LABEL_RATIO).toBeGreaterThan(ANGLE_ARC_RATIO);
  });
});
