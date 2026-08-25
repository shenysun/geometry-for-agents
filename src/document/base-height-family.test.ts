import { describe, expect, test } from "vitest";
import {
  baseHeightLocalOffset,
  baseHeightLocalVertices,
  baseHeightWorldVertices,
  type BaseHeightShape,
} from "./base-height-family.ts";

function expectCloseTo(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(1e-9);
}

const triangle: BaseHeightShape = {
  id: "tri-1",
  type: "triangle",
  x: 1,
  y: 2,
  width: 4,
  height: 3,
  apexOffset: 1,
  rotationDeg: 0,
  fill: "none",
};

const parallelogram: BaseHeightShape = {
  id: "para-1",
  type: "parallelogram",
  x: 1,
  y: 2,
  width: 4,
  height: 2,
  skew: 1.5,
  rotationDeg: 0,
  fill: "none",
};

const trapezoid: BaseHeightShape = {
  id: "trap-1",
  type: "trapezoid",
  x: 1,
  y: 2,
  width: 4,
  topWidth: 2,
  height: 2,
  topOffset: 0.5,
  rotationDeg: 0,
  fill: "none",
};

describe("baseHeightLocalVertices", () => {
  test("三角：左底角、右底角、顶点，底边在局部 y=0", () => {
    expect(baseHeightLocalVertices(triangle)).toEqual([
      { x: -2, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 3 },
    ]);
  });

  test("平四：底边两端加上底两端（上底整体平移 skew）", () => {
    expect(baseHeightLocalVertices(parallelogram)).toEqual([
      { x: -2, y: 0 },
      { x: 2, y: 0 },
      { x: 3.5, y: 2 },
      { x: -0.5, y: 2 },
    ]);
  });

  test("梯形：下底两端加上底两端（上底中点平移 topOffset）", () => {
    expect(baseHeightLocalVertices(trapezoid)).toEqual([
      { x: -2, y: 0 },
      { x: 2, y: 0 },
      { x: 1.5, y: 2 },
      { x: -0.5, y: 2 },
    ]);
  });
});

describe("baseHeightWorldVertices", () => {
  test("零旋转时局部顶点直接加锚点", () => {
    expect(baseHeightWorldVertices(triangle)).toEqual([
      { x: -1, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 5 },
    ]);
  });

  test("旋转绕锚点把顶点旋到世界（逆时针为正）", () => {
    // 顶点 (2,5) 绕锚点 (1,2) 转 90°：偏移 (1,3) → (-3,1)，即 (-2,3)。
    const rotated = baseHeightWorldVertices({ ...triangle, rotationDeg: 90 });
    expectCloseTo(rotated[2].x, -2);
    expectCloseTo(rotated[2].y, 3);
  });
});

describe("baseHeightLocalOffset", () => {
  test("世界点逆旋转回锚点原点的局部系", () => {
    const rotated = { ...triangle, rotationDeg: 90 };
    // 世界 (-2,3) 是旋转后顶点：局部偏移应为 (1,3)。
    const local = baseHeightLocalOffset(rotated, { x: -2, y: 3 });
    expectCloseTo(local.x, 1);
    expectCloseTo(local.y, 3);
  });
});
