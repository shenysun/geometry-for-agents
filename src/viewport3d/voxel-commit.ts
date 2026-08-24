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

/** 目标角上已有的体素；exceptId 供平移时排除自己。 */
export function voxelOccupying(
  document: GeometryDocument,
  corner: Point3,
  exceptId?: string,
): VoxelPrimitive | null {
  if (document.space !== "3d") return null;
  const found = document.primitives.find(
    (primitive): primitive is VoxelPrimitive =>
      primitive.type === "voxel" &&
      primitive.id !== exceptId &&
      primitive.x === corner.x &&
      primitive.y === corner.y &&
      primitive.z === corner.z,
  );
  return found === undefined ? null : found;
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
  if (voxelOccupying(document, corner) !== null) {
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

/**
 * 整格平移提交：位移各轴取整——体素永远整数角，不理格的 1/2、「关」与
 * Alt；目标格被其它体素占用或位移为零则拒绝。返回移动后的体素，调用方
 * 走 updatePrimitive 一次提交（一次手势一步 Undo）。
 */
export function translateVoxel(
  document: GeometryDocument,
  id: string,
  delta: Point3,
): VoxelPrimitive | null {
  if (document.space !== "3d") {
    return null;
  }
  const current = document.primitives.find(
    (primitive): primitive is VoxelPrimitive =>
      primitive.type === "voxel" && primitive.id === id,
  );
  if (current === undefined) {
    return null;
  }
  const dx = Math.round(delta.x);
  const dy = Math.round(delta.y);
  const dz = Math.round(delta.z);
  const corner = {
    x: current.x + dx,
    y: current.y + dy,
    z: current.z + dz,
  };
  if (
    (dx === 0 && dy === 0 && dz === 0) ||
    voxelOccupying(document, corner, id) !== null
  ) {
    return null;
  }
  return { id, type: "voxel", x: corner.x, y: corner.y, z: corner.z };
}
