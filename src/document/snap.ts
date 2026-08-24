export type Point2 = { x: number; y: number };
export type Point3 = { x: number; y: number; z: number };
export type GridSnap = 1 | 0.5 | "off";

function snapCoord(value: number, step: number): number {
  return Math.round(value / step) * step + 0;
}

export function snap2d(point: Point2, grid: GridSnap): Point2 {
  if (grid === "off") {
    return { x: point.x, y: point.y };
  }
  return {
    x: snapCoord(point.x, grid),
    y: snapCoord(point.y, grid),
  };
}

export function snapVoxel(point: Point3): Point3 {
  return {
    x: snapCoord(point.x, 1),
    y: snapCoord(point.y, 1),
    z: snapCoord(point.z, 1),
  };
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
    x: snapCoord(point.x, grid),
    y: snapCoord(point.y, grid),
    z: snapCoord(point.z, grid),
  };
}
