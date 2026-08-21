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
