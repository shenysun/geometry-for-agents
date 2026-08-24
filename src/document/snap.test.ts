import { describe, expect, test } from "vitest";
import { snap2d, snap3d, snapVoxel } from "./index.ts";

describe("snap2d", () => {
  test("snaps each axis to the nearest integer when grid is 1", () => {
    expect(snap2d({ x: 1.4, y: -1.6 }, 1)).toEqual({ x: 1, y: -2 });
    expect(snap2d({ x: 2.5, y: 0 }, 1)).toEqual({ x: 3, y: 0 });
  });

  test("snaps each axis to the nearest half unit when grid is 1/2", () => {
    expect(snap2d({ x: 1.24, y: -1.26 }, 0.5)).toEqual({ x: 1, y: -1.5 });
    expect(snap2d({ x: 0.25, y: 1.75 }, 0.5)).toEqual({ x: 0.5, y: 2 });
  });

  test("leaves the point unchanged when snap is off", () => {
    const point = { x: 1.37, y: -0.11 };
    expect(snap2d(point, "off")).toEqual(point);
  });
});

describe("snapVoxel", () => {
  test("snaps 3D voxel corners to integers only", () => {
    expect(snapVoxel({ x: 1.4, y: 2.6, z: -0.5 })).toEqual({
      x: 1,
      y: 3,
      z: 0,
    });
    expect(snapVoxel({ x: -1.2, y: 0.49, z: 4.5 })).toEqual({
      x: -1,
      y: 0,
      z: 5,
    });
  });
});

describe("snap3d", () => {
  test("整格 1 把 x/y/z 各自四舍五入到整数格点", () => {
    expect(snap3d({ x: 1.4, y: 0.2, z: 0.6 }, 1)).toEqual({
      x: 1,
      y: 0,
      z: 1,
    });
  });

  test("半格 1/2 吸附到 0.5 的倍数", () => {
    expect(snap3d({ x: 0.3, y: 1.2, z: -0.7 }, 0.5)).toEqual({
      x: 0.5,
      y: 1,
      z: -0.5,
    });
  });

  test("关：原样返回落点，不吸附", () => {
    expect(snap3d({ x: 0.3, y: 1.2, z: -0.7 }, "off")).toEqual({
      x: 0.3,
      y: 1.2,
      z: -0.7,
    });
  });

  test("返回新对象，不改动输入落点", () => {
    const point = { x: 0.4, y: 0, z: 0 };
    const snapped = snap3d(point, 1);

    expect(snapped).not.toBe(point);
    expect(point).toEqual({ x: 0.4, y: 0, z: 0 });
  });
});
