import { describe, expect, test } from "vitest";
import {
  regularPolygonLocalVertices,
  regularPolygonWorldVertices,
  type RegularPolygonPrimitive,
} from "./regular-polygon.ts";

function expectCloseTo(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(1e-9);
}

const hexagon: RegularPolygonPrimitive = {
  id: "hex-1",
  type: "regularPolygon",
  x: 0,
  y: 0,
  sides: 6,
  r: 2,
  rotationDeg: 0,
  fill: "none",
};

describe("regularPolygonLocalVertices", () => {
  test("正六边形平底卧放：底边平行局部 X 且在下方，顶点逆时针", () => {
    const vertices = regularPolygonLocalVertices(hexagon);

    expect(vertices).toHaveLength(6);
    // 第 0 个顶点在 -60°：(1, -√3)。
    expectCloseTo(vertices[0]!.x, 1);
    expectCloseTo(vertices[0]!.y, -Math.sqrt(3));
    // 底边两端 v0/v5 (±1, -√3)；最左 v4 (-2, 0)；顶点逆时针推进。
    expectCloseTo(vertices[4]!.x, -2);
    expectCloseTo(vertices[4]!.y, 0);
    expectCloseTo(vertices[5]!.x, -1);
    expectCloseTo(vertices[5]!.y, -Math.sqrt(3));
  });

  test("正五边形房子形：底边平行 X 在下、顶点朝上", () => {
    const pentagon = { ...hexagon, sides: 5 };
    const vertices = regularPolygonLocalVertices(pentagon);

    expect(vertices).toHaveLength(5);
    // 顶点在 90° 方向：(0, r)。
    expectCloseTo(vertices[2]!.x, 0);
    expectCloseTo(vertices[2]!.y, 2);
    // 底边两端同高（-90°±36° 的 sin 值）。
    expectCloseTo(vertices[0]!.y, vertices[4]!.y);
    expect(vertices[0]!.y).toBeLessThan(0);
  });
});

describe("regularPolygonWorldVertices", () => {
  test("零旋转直接加中心；旋转绕中心把顶点旋到世界", () => {
    const moved = { ...hexagon, x: 1, y: 2 };
    const vertices = regularPolygonWorldVertices(moved);
    expectCloseTo(vertices[0]!.x, 2);
    expectCloseTo(vertices[0]!.y, 2 - Math.sqrt(3));

    // 旋 90°：局部 (1, -√3) → 世界 (1+√3, 2+1)。
    const rotated = { ...moved, rotationDeg: 90 };
    const rotatedVertices = regularPolygonWorldVertices(rotated);
    expectCloseTo(rotatedVertices[0]!.x, 1 + Math.sqrt(3));
    expectCloseTo(rotatedVertices[0]!.y, 3);
  });
});
