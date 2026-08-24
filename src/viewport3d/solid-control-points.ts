import type { Point3 } from "../document/index.ts";
import {
  rotateEulerYxz,
  type SolidPrimitive,
} from "../document/update-document.ts";

/**
 * 参数体控制点的语义分类：目录顺序即命中优先级（重叠时先列出的先赢），
 * 与 2D 控制点目录同一套思路。体素没有控制点，不进这个目录。
 */
export type SolidControlPointKind = "size" | "radius" | "height" | "baseVertex";

export type SolidControlPoint = {
  /** 语义标识，即说明书里的尺寸字段（底面点带下标），拖动提交按它写几何。 */
  id: string;
  kind: SolidControlPointKind;
  /** 世界坐标：局部位置经参数体欧拉角（Y→X→Z）旋到世界。 */
  world: Point3;
};

/** 局部点 → 世界点：站立体过欧拉角，球无旋转只做平移。 */
function toWorld(solid: SolidPrimitive, local: Point3): Point3 {
  if (solid.type === "sphere") {
    return {
      x: solid.x + local.x,
      y: solid.y + local.y,
      z: solid.z + local.z,
    };
  }
  const rotated = rotateEulerYxz(
    solid.rotationDegY,
    solid.rotationDegX,
    solid.rotationDegZ,
    local,
  );
  return {
    x: solid.x + rotated.x,
    y: solid.y + rotated.y,
    z: solid.z + rotated.z,
  };
}

/**
 * 一条参数体的控制点目录（世界坐标）：宽/深/半径点躺在底面对应半尺寸
 * 处，高点在底面中心正上方 height（球的半径点从球心沿 +X 出发），三棱柱
 * 另有三个底面点。拖动语义见 update-document 的 moveSolidControlPointGeometry。
 */
export function solidControlPoints(solid: SolidPrimitive): SolidControlPoint[] {
  switch (solid.type) {
    case "box":
    case "pyramid":
      return [
        {
          id: "width",
          kind: "size",
          world: toWorld(solid, { x: solid.width / 2, y: 0, z: 0 }),
        },
        {
          id: "depth",
          kind: "size",
          world: toWorld(solid, { x: 0, y: 0, z: solid.depth / 2 }),
        },
        {
          id: "height",
          kind: "height",
          world: toWorld(solid, { x: 0, y: solid.height, z: 0 }),
        },
      ];
    case "cylinder":
    case "cone":
      return [
        {
          id: "r",
          kind: "radius",
          world: toWorld(solid, { x: solid.r, y: 0, z: 0 }),
        },
        {
          id: "height",
          kind: "height",
          world: toWorld(solid, { x: 0, y: solid.height, z: 0 }),
        },
      ];
    case "sphere":
      return [
        { id: "r", kind: "radius", world: toWorld(solid, { x: solid.r, y: 0, z: 0 }) },
      ];
    case "triangularPrism":
      return [
        {
          id: "height",
          kind: "height",
          world: toWorld(solid, { x: 0, y: solid.height, z: 0 }),
        },
        ...solid.base.map((point, index) => ({
          id: `base-${index}`,
          kind: "baseVertex" as const,
          world: toWorld(solid, { x: point.x, y: 0, z: point.z }),
        })),
      ];
  }
}
