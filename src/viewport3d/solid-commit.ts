import type {
  GeometryDocument,
  GridSnap,
  Point3,
  Primitive,
} from "../document/index.ts";
import { commitBox, type BoxPrimitive } from "./box-commit.ts";
import { snap3d } from "./snap3d.ts";

export type CylinderPrimitive = Extract<Primitive, { type: "cylinder" }>;
export type ConePrimitive = Extract<Primitive, { type: "cone" }>;
export type SpherePrimitive = Extract<Primitive, { type: "sphere" }>;
export type PyramidPrimitive = Extract<Primitive, { type: "pyramid" }>;
export type TriangularPrismPrimitive = Extract<
  Primitive,
  { type: "triangularPrism" }
>;

/** 三棱柱底面：三个局部 XZ 点 */
export type PrismBase = TriangularPrismPrimitive["base"];

/** 参数体创建工具 id：工具箱、editor 工具类型与放置提交共用这一份名单 */
export type SolidToolId =
  | "box"
  | "cylinder"
  | "cone"
  | "sphere"
  | "pyramid"
  | "triangularPrism";

export const SOLID_TOOLS: readonly SolidToolId[] = [
  "box",
  "cylinder",
  "cone",
  "sphere",
  "pyramid",
  "triangularPrism",
];

/** 参数体图元的联合：单击放置与属性面板都按这一份收窄 */
export type SolidPrimitive =
  | BoxPrimitive
  | CylinderPrimitive
  | ConePrimitive
  | SpherePrimitive
  | PyramidPrimitive
  | TriangularPrismPrimitive;

/** 单击落下的默认尺寸：圆柱/圆锥 r=0.5、height=1；球 r=0.5 */
export const CYLINDER_DEFAULTS = { r: 0.5, height: 1 } as const;
export const CONE_DEFAULTS = { r: 0.5, height: 1 } as const;
export const SPHERE_DEFAULTS = { r: 0.5 } as const;
/** 四棱锥默认正方形底 1×1、高 1；三棱柱默认高 1、底边 1 正三角 */
export const PYRAMID_DEFAULTS = { width: 1, depth: 1, height: 1 } as const;
export const TRIANGULAR_PRISM_DEFAULTS = { height: 1 } as const;

/**
 * 边长 1 的正三角形底（局部 XZ，一顶点朝 +Z）：外接圆半径 √3/3，
 * 三顶点到形心的距离相同，形心恰在局部原点。
 */
export function equilateralTriangleBase(): PrismBase {
  return [
    { x: 0, z: Math.sqrt(3) / 3 },
    { x: -0.5, z: -Math.sqrt(3) / 6 },
    { x: 0.5, z: -Math.sqrt(3) / 6 },
  ];
}

/** 参数体锚点：世界落点吸附当前格后的位置（站立体是底面中心，球是球心）。 */
export function solidAnchorFromWorld(point: Point3, grid: GridSnap): Point3 {
  return snap3d(point, grid);
}

function solidRotation() {
  return { rotationDegY: 0, rotationDegX: 0, rotationDegZ: 0 } as const;
}

/**
 * 单击提交圆柱：落点吸附当前格后一次生成——底面中心、r=0.5、height=1、
 * 三欧拉角为 0；仅 3D 说明书合法。
 */
export function commitCylinder(
  document: GeometryDocument,
  world: Point3,
  grid: GridSnap,
  id: string,
): CylinderPrimitive | null {
  if (document.space !== "3d") {
    return null;
  }
  const anchor = solidAnchorFromWorld(world, grid);
  return {
    id,
    type: "cylinder",
    x: anchor.x,
    y: anchor.y,
    z: anchor.z,
    r: CYLINDER_DEFAULTS.r,
    height: CYLINDER_DEFAULTS.height,
    ...solidRotation(),
  };
}

/** 单击提交圆锥：字段与圆柱同构，只是顶点收在底面中心上方 height 处。 */
export function commitCone(
  document: GeometryDocument,
  world: Point3,
  grid: GridSnap,
  id: string,
): ConePrimitive | null {
  if (document.space !== "3d") {
    return null;
  }
  const anchor = solidAnchorFromWorld(world, grid);
  return {
    id,
    type: "cone",
    x: anchor.x,
    y: anchor.y,
    z: anchor.z,
    r: CONE_DEFAULTS.r,
    height: CONE_DEFAULTS.height,
    ...solidRotation(),
  };
}

/** 单击提交球：球心 = 吸附后的落点，r=0.5，无旋转字段。 */
export function commitSphere(
  document: GeometryDocument,
  world: Point3,
  grid: GridSnap,
  id: string,
): SpherePrimitive | null {
  if (document.space !== "3d") {
    return null;
  }
  const center = solidAnchorFromWorld(world, grid);
  return {
    id,
    type: "sphere",
    x: center.x,
    y: center.y,
    z: center.z,
    r: SPHERE_DEFAULTS.r,
  };
}

/**
 * 单击提交四棱锥：底面中心吸附落点，默认正方形底 1×1、高 1，
 * 顶点在底面中心上方 height；拉开 width/depth 可变长方形底。
 */
export function commitPyramid(
  document: GeometryDocument,
  world: Point3,
  grid: GridSnap,
  id: string,
): PyramidPrimitive | null {
  if (document.space !== "3d") {
    return null;
  }
  const anchor = solidAnchorFromWorld(world, grid);
  return {
    id,
    type: "pyramid",
    x: anchor.x,
    y: anchor.y,
    z: anchor.z,
    width: PYRAMID_DEFAULTS.width,
    depth: PYRAMID_DEFAULTS.depth,
    height: PYRAMID_DEFAULTS.height,
    ...solidRotation(),
  };
}

/** 单击提交三棱柱：底面中心吸附落点，默认高 1、正三角底（形心在局部原点）。 */
export function commitTriangularPrism(
  document: GeometryDocument,
  world: Point3,
  grid: GridSnap,
  id: string,
): TriangularPrismPrimitive | null {
  if (document.space !== "3d") {
    return null;
  }
  const anchor = solidAnchorFromWorld(world, grid);
  return {
    id,
    type: "triangularPrism",
    x: anchor.x,
    y: anchor.y,
    z: anchor.z,
    height: TRIANGULAR_PRISM_DEFAULTS.height,
    base: equilateralTriangleBase(),
    ...solidRotation(),
  };
}

/**
 * 按工具分发到各参数体的单击提交：视口只认识「工具 id + 落点」，
 * 具体字段由这里一次生成；非 3D 说明书返回 null。
 */
export function commitSolid(
  document: GeometryDocument,
  tool: SolidToolId,
  world: Point3,
  grid: GridSnap,
  id: string,
): SolidPrimitive | null {
  switch (tool) {
    case "box":
      return commitBox(document, world, grid, id);
    case "cylinder":
      return commitCylinder(document, world, grid, id);
    case "cone":
      return commitCone(document, world, grid, id);
    case "sphere":
      return commitSphere(document, world, grid, id);
    case "pyramid":
      return commitPyramid(document, world, grid, id);
    case "triangularPrism":
      return commitTriangularPrism(document, world, grid, id);
  }
}

/** 参数体工具的运行时守卫：视口接线用它把工具收窄到放置路径。 */
export function isSolidTool(tool: unknown): tool is SolidToolId {
  return (
    tool === "box" ||
    tool === "cylinder" ||
    tool === "cone" ||
    tool === "sphere" ||
    tool === "pyramid" ||
    tool === "triangularPrism"
  );
}

/** 图元侧的同款守卫：属性面板等处用它把选中项收窄到参数体。 */
export function isSolidPrimitive(
  primitive: Primitive,
): primitive is SolidPrimitive {
  return isSolidTool(primitive.type);
}
