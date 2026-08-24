import type { GridSnap, Point3 } from "../document/index.ts";

/** 单轴吸附：四舍五入到格步长；+0 把 -0 归一成 0（与 2D snap2d 同一约定）。 */
function snapAxis(value: number, step: number): number {
  return Math.round(value / step) * step + 0;
}

/**
 * 3D 参数体的落点吸附：x/y/z 各自吃同一套格（1 / 1/2 / 关）。
 * 体素不走这里，体素永远整数格（见 snapVoxel）。
 */
export function snap3d(point: Point3, grid: GridSnap): Point3 {
  if (grid === "off") {
    return { x: point.x, y: point.y, z: point.z };
  }
  return {
    x: snapAxis(point.x, grid),
    y: snapAxis(point.y, grid),
    z: snapAxis(point.z, grid),
  };
}
