import {
  type GeometryDocument,
  type GridSnap,
  type Point3,
} from "../document/index.ts";
import type { VoxelPrimitive } from "./voxel-commit.ts";

/**
 * 3D 选择手势：体素只有整格平移——没有旋转、缩放、控制点（参数体拾取
 * 与手柄是票 11）。纯函数，不碰 Three：指针世界坐标由投影器换算好喂进来。
 */
export type Select3dState =
  | { kind: "idle" }
  | {
      kind: "drag";
      id: string;
      /** 按下时指针在拖动平面上的原始世界落点（未取整）。 */
      startWorld: Point3;
      /** 被拖体素的原整数角。 */
      startCorner: Point3;
    };

/** 一次 pointerup 至多一次提交：体素唯一的手势变换是整格平移。 */
export type Select3dCommit = {
  kind: "translate";
  id: string;
  dx: number;
  dy: number;
  dz: number;
};

/** 手势中的预览与放置预览同构：半透明块落在目标整数角。 */
export type Select3dPreview = { kind: "voxel"; corner: Point3 } | null;

export type Select3dResult = {
  state: Select3dState;
  preview: Select3dPreview;
  /** undefined = 选中不变；null = 取消选中。 */
  selectionId?: string | null;
  commit: Select3dCommit | null;
};

export type Select3dContext = {
  tool: "select";
  document: GeometryDocument;
  /** 指针原始世界落点（未吸附）。 */
  point: Point3;
  /** 声明在案但体素不吃：1、1/2、关都锁整数角。 */
  grid: GridSnap;
  /** Alt 对体素无效：修饰键写不出半格。 */
  alt?: boolean;
  selectionId?: string | null;
  /** 左键落点命中的体素 id（Three 拾取给的）；null = 空处。 */
  hitId?: string | null;
};

export function idleSelect3dState(): Select3dState {
  return { kind: "idle" };
}

function idleResult3d(): Select3dResult {
  return { state: idleSelect3dState(), preview: null, commit: null };
}

function hold(
  state: Select3dState,
  preview: Select3dPreview,
): Select3dResult {
  return { state, preview, commit: null };
}

function voxelById(
  document: GeometryDocument,
  id: string,
): VoxelPrimitive | null {
  if (document.space !== "3d") return null;
  const primitive = document.primitives.find((item) => item.id === id);
  return primitive !== undefined && primitive.type === "voxel"
    ? primitive
    : null;
}

/** 整数格位移：各轴四舍五入——与格步长和 Alt 无关，半格进不来。 */
function integerDelta(
  from: Point3,
  to: Point3,
): { dx: number; dy: number; dz: number } {
  return {
    dx: Math.round(to.x - from.x),
    dy: Math.round(to.y - from.y),
    dz: Math.round(to.z - from.z),
  };
}

/** 按下体素进入拖动态并选中；按在空处保持 idle（取消交给单击）。 */
export function startSelect3d(
  state: Select3dState,
  ctx: Select3dContext,
): Select3dResult {
  if (state.kind !== "idle") {
    return { state, preview: null, commit: null };
  }
  const hitId = ctx.hitId ?? null;
  const voxel = hitId === null ? null : voxelById(ctx.document, hitId);
  if (voxel === null) {
    return { state, preview: null, commit: null };
  }
  return {
    state: {
      kind: "drag",
      id: voxel.id,
      startWorld: ctx.point,
      startCorner: { x: voxel.x, y: voxel.y, z: voxel.z },
    },
    preview: null,
    selectionId: voxel.id,
    commit: null,
  };
}

/** 拖动中只预览目标整数格，说明书不动。位移不足一格不显示预览。 */
export function moveSelect3d(
  state: Select3dState,
  ctx: Select3dContext,
): Select3dResult {
  if (state.kind !== "drag") {
    return idleResult3d();
  }
  const { dx, dy, dz } = integerDelta(state.startWorld, ctx.point);
  if (dx === 0 && dy === 0 && dz === 0) {
    return hold(state, null);
  }
  return hold(state, {
    kind: "voxel",
    corner: {
      x: state.startCorner.x + dx,
      y: state.startCorner.y + dy,
      z: state.startCorner.z + dz,
    },
  });
}

/** 松手一次提交：位移不足一格不提交，选中已在按下时定下。 */
export function upSelect3d(
  state: Select3dState,
  ctx: Select3dContext,
): Select3dResult {
  if (state.kind !== "drag") {
    return idleResult3d();
  }
  const { dx, dy, dz } = integerDelta(state.startWorld, ctx.point);
  if (dx === 0 && dy === 0 && dz === 0) {
    return idleResult3d();
  }
  return {
    state: idleSelect3dState(),
    preview: null,
    commit: { kind: "translate", id: state.id, dx, dy, dz },
  };
}

/** 单击（无拖动）命中体素则选中，点空则取消。 */
export function clickSelect3d(
  state: Select3dState,
  ctx: Select3dContext,
): Select3dResult {
  if (state.kind !== "idle") {
    return { state, preview: null, commit: null };
  }
  const hitId = ctx.hitId ?? null;
  const voxel = hitId === null ? null : voxelById(ctx.document, hitId);
  return {
    state,
    preview: null,
    selectionId: voxel === null ? null : voxel.id,
    commit: null,
  };
}

export function escSelect3d(_state: Select3dState): Select3dResult {
  return idleResult3d();
}
