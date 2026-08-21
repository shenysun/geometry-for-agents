import {
  snapVoxel,
  type GeometryDocument,
  type Point3,
  type Primitive,
} from "../document/index.ts";

export type VoxelPrimitive = Extract<Primitive, { type: "voxel" }>;

export function voxelCornerFromWorld(point: Point3): Point3 {
  return snapVoxel({
    x: Math.floor(point.x),
    y: Math.floor(point.y),
    z: Math.floor(point.z),
  });
}

function occupies(primitive: Primitive, corner: Point3): boolean {
  return (
    primitive.type === "voxel" &&
    primitive.x === corner.x &&
    primitive.y === corner.y &&
    primitive.z === corner.z
  );
}

export function commitVoxel(
  document: GeometryDocument,
  point: Point3,
  id: string,
): VoxelPrimitive | null {
  if (document.space !== "3d") {
    return null;
  }
  const corner = voxelCornerFromWorld(point);
  if (document.primitives.some((primitive) => occupies(primitive, corner))) {
    return null;
  }
  return {
    id,
    type: "voxel",
    x: corner.x,
    y: corner.y,
    z: corner.z,
  };
}
