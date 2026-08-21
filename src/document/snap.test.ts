import { describe, expect, test } from "vitest";
import { snap2d, snapVoxel } from "./index.ts";

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
