import type { Point3 } from "../document/index.ts";
import type { SolidPrimitive } from "../document/update-document.ts";

/** 底面局部 XZ 点 */
type BasePoint = { x: number; z: number };

/**
 * 跟随指针/手势的放置与变换预览：体素给最小角，参数体给锚点、尺寸与
 * 姿态（三个欧拉角，预览同样按 Y→X→Z 合成）。纯数据，不依赖 three。
 */
export type PlacementPreview =
  | { kind: "voxel"; corner: Point3 }
  | {
      kind: "box";
      anchor: Point3;
      width: number;
      depth: number;
      height: number;
      rotationDegY: number;
      rotationDegX: number;
      rotationDegZ: number;
    }
  | {
      kind: "cylinder" | "cone";
      anchor: Point3;
      r: number;
      height: number;
      rotationDegY: number;
      rotationDegX: number;
      rotationDegZ: number;
    }
  | { kind: "sphere"; center: Point3; r: number }
  | {
      kind: "pyramid";
      anchor: Point3;
      width: number;
      depth: number;
      height: number;
      rotationDegY: number;
      rotationDegX: number;
      rotationDegZ: number;
    }
  | {
      kind: "prism";
      anchor: Point3;
      height: number;
      base: readonly BasePoint[];
      rotationDegY: number;
      rotationDegX: number;
      rotationDegZ: number;
    }
  | null;

/**
 * 把一条参数体形态（已提交或手势中的变换预览）映射成预览数据：
 * 位置、尺寸、欧拉角原样照搬，球只带球心与半径。
 */
export function solidPlacementPreview(
  solid: SolidPrimitive,
): Exclude<PlacementPreview, null> {
  switch (solid.type) {
    case "box":
      return {
        kind: "box",
        anchor: { x: solid.x, y: solid.y, z: solid.z },
        width: solid.width,
        depth: solid.depth,
        height: solid.height,
        rotationDegY: solid.rotationDegY,
        rotationDegX: solid.rotationDegX,
        rotationDegZ: solid.rotationDegZ,
      };
    case "cylinder":
    case "cone":
      return {
        kind: solid.type,
        anchor: { x: solid.x, y: solid.y, z: solid.z },
        r: solid.r,
        height: solid.height,
        rotationDegY: solid.rotationDegY,
        rotationDegX: solid.rotationDegX,
        rotationDegZ: solid.rotationDegZ,
      };
    case "sphere":
      return {
        kind: "sphere",
        center: { x: solid.x, y: solid.y, z: solid.z },
        r: solid.r,
      };
    case "pyramid":
      return {
        kind: "pyramid",
        anchor: { x: solid.x, y: solid.y, z: solid.z },
        width: solid.width,
        depth: solid.depth,
        height: solid.height,
        rotationDegY: solid.rotationDegY,
        rotationDegX: solid.rotationDegX,
        rotationDegZ: solid.rotationDegZ,
      };
    case "triangularPrism":
      return {
        kind: "prism",
        anchor: { x: solid.x, y: solid.y, z: solid.z },
        height: solid.height,
        base: solid.base,
        rotationDegY: solid.rotationDegY,
        rotationDegX: solid.rotationDegX,
        rotationDegZ: solid.rotationDegZ,
      };
  }
}
