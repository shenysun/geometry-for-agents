import { describe, expect, test } from "vitest";
import type { SolidPrimitive } from "../document/update-document.ts";
import { solidControlPoints } from "./solid-control-points.ts";

/** 默认 0 姿态的三欧拉角，站立体共用。 */
const STANDING = { rotationDegY: 0, rotationDegX: 0, rotationDegZ: 0 } as const;

const box: SolidPrimitive = {
  id: "box-1",
  type: "box",
  x: 0.5,
  y: 1,
  z: -0.5,
  width: 1,
  depth: 2,
  height: 3,
  ...STANDING,
};

const cylinder: SolidPrimitive = {
  id: "cyl-1",
  type: "cylinder",
  x: 0,
  y: 0,
  z: 0,
  r: 0.5,
  height: 1,
  ...STANDING,
};

const sphere: SolidPrimitive = {
  id: "sphere-1",
  type: "sphere",
  x: 0,
  y: 2,
  z: 0,
  r: 0.5,
};

const prism: SolidPrimitive = {
  id: "prism-1",
  type: "triangularPrism",
  x: 1,
  y: 0,
  z: 1,
  height: 2,
  base: [
    { x: 1, z: 0 },
    { x: 0, z: 1 },
    { x: -1, z: -1 },
  ],
  ...STANDING,
};

describe("solidControlPoints", () => {
  test("长方体/四棱锥：宽、深、高三个控制点落在对应半尺寸处", () => {
    expect(solidControlPoints(box)).toEqual([
      { id: "width", kind: "size", world: { x: 1, y: 1, z: -0.5 } },
      { id: "depth", kind: "size", world: { x: 0.5, y: 1, z: 0.5 } },
      { id: "height", kind: "height", world: { x: 0.5, y: 4, z: -0.5 } },
    ]);

    const pyramid: SolidPrimitive = {
      id: "pyramid-1",
      type: "pyramid",
      x: 0,
      y: 0,
      z: 0,
      width: 2,
      depth: 2,
      height: 1,
      ...STANDING,
    };
    expect(solidControlPoints(pyramid)).toEqual([
      { id: "width", kind: "size", world: { x: 1, y: 0, z: 0 } },
      { id: "depth", kind: "size", world: { x: 0, y: 0, z: 1 } },
      { id: "height", kind: "height", world: { x: 0, y: 1, z: 0 } },
    ]);
  });

  test("圆柱/圆锥：半径点在底面 +X 边缘，高点在底面中心正上方 height 处", () => {
    expect(solidControlPoints(cylinder)).toEqual([
      { id: "r", kind: "radius", world: { x: 0.5, y: 0, z: 0 } },
      { id: "height", kind: "height", world: { x: 0, y: 1, z: 0 } },
    ]);

    const cone: SolidPrimitive = { ...cylinder, id: "cone-1", type: "cone" };
    expect(solidControlPoints(cone)).toEqual([
      { id: "r", kind: "radius", world: { x: 0.5, y: 0, z: 0 } },
      { id: "height", kind: "height", world: { x: 0, y: 1, z: 0 } },
    ]);
  });

  test("球：只有一个半径点，从球心沿 +X 出发", () => {
    expect(solidControlPoints(sphere)).toEqual([
      { id: "r", kind: "radius", world: { x: 0.5, y: 2, z: 0 } },
    ]);
  });

  test("三棱柱：高点在局部原点上方，三个底面点落在各自局部 XZ 位置", () => {
    expect(solidControlPoints(prism)).toEqual([
      { id: "height", kind: "height", world: { x: 1, y: 2, z: 1 } },
      { id: "base-0", kind: "baseVertex", world: { x: 2, y: 0, z: 1 } },
      { id: "base-1", kind: "baseVertex", world: { x: 1, y: 0, z: 2 } },
      { id: "base-2", kind: "baseVertex", world: { x: 0, y: 0, z: 0 } },
    ]);
  });

  test("旋转过的参数体：控制点位置随欧拉角 Y→X→Z 转到世界（Y 90° 时局部 +X 落在 −Z）", () => {
    const rotated: SolidPrimitive = {
      ...box,
      x: 0,
      y: 0,
      z: 0,
      rotationDegY: 90,
    };
    const [width, depth] = solidControlPoints(rotated);
    // 局部 width/2 沿 +X：Y 90° 后世界 (0, 0, −0.5)；三角函数带浮点尘埃，按分量近似
    expect(width.id).toBe("width");
    expect(Math.abs(width.world.x)).toBeLessThan(1e-9);
    expect(width.world.y).toBe(0);
    expect(Math.abs(width.world.z - -0.5)).toBeLessThan(1e-9);
    // 局部 depth/2 沿 +Z：Y 90° 后世界 (+1, 0, 0)
    expect(depth.id).toBe("depth");
    expect(Math.abs(depth.world.x - 1)).toBeLessThan(1e-9);
    expect(depth.world.y).toBe(0);
    expect(Math.abs(depth.world.z)).toBeLessThan(1e-9);
  });
});
