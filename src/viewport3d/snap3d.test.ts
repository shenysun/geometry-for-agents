import { describe, expect, test } from "vitest";
import { snap3d } from "./snap3d.ts";

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
