import type {
  GeometryDocument,
  GridSnap,
  Point3,
  Primitive,
} from "../document/index.ts";
import { snap3d } from "./snap3d.ts";

export type BoxPrimitive = Extract<Primitive, { type: "box" }>;

/** 单击落下的默认尺寸：1×1×1（看起来是正方体），后续靠属性面板/手柄改 */
export const BOX_DEFAULTS = { width: 1, depth: 1, height: 1 } as const;

/** 长方体锚点：世界落点吸附当前格后的底面中心（y 即底面高度）。 */
export function boxAnchorFromWorld(point: Point3, grid: GridSnap): Point3 {
  return snap3d(point, grid);
}

/**
 * 单击提交：落点吸附当前格后一次生成一条默认长方体——
 * 位置为底面中心、1×1×1、三个欧拉角为 0；仅 3D 说明书合法。
 */
export function commitBox(
  document: GeometryDocument,
  world: Point3,
  grid: GridSnap,
  id: string,
): BoxPrimitive | null {
  if (document.space !== "3d") {
    return null;
  }
  const anchor = boxAnchorFromWorld(world, grid);
  return {
    id,
    type: "box",
    x: anchor.x,
    y: anchor.y,
    z: anchor.z,
    width: BOX_DEFAULTS.width,
    depth: BOX_DEFAULTS.depth,
    height: BOX_DEFAULTS.height,
    rotationDegY: 0,
    rotationDegX: 0,
    rotationDegZ: 0,
  };
}
