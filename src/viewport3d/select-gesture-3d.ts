import {
  type GeometryDocument,
  type GridSnap,
  type Point3,
} from "../document/index.ts";
import {
  moveSolidControlPointGeometry,
  rotateEulerYxz,
  rotateSolidGeometry,
  scaleSolidGeometry,
  solidAnchor,
  translateSolidGeometry,
  type SolidAxis,
  type SolidPrimitive,
} from "../document/update-document.ts";
import { solidPlacementPreview, type PlacementPreview } from "./placement-preview.ts";
import { solidControlPoints } from "./solid-control-points.ts";
import { snap3d } from "./snap3d.ts";
import type { VoxelPrimitive } from "./voxel-commit.ts";

/**
 * 3D 选择手势：体素只有整格平移（票 07）；参数体（票 11）有完整的一套
 * 变换——拖本体平移、三根旋转柄、一根缩放柄与控制点，命中顺序与 2D
 * 相同：控制点 → 旋转/缩放柄 → 本体。纯函数，不碰 Three：指针的世界
 * 落点与视线（ray）由投影器换算好喂进来。
 */

/** 指针视线：origin 出发、direction 为单位方向，世界系。 */
export type Ray3 = { origin: Point3; direction: Point3 };

export type Select3dState =
  | { kind: "idle" }
  | {
      kind: "drag";
      id: string;
      /** 按下时指针在拖动平面上的原始世界落点（未取整）。 */
      startWorld: Point3;
      /** 被拖体素的原整数角。 */
      startCorner: Point3;
    }
  | {
      kind: "solid-translate";
      id: string;
      /** 按下时指针在拖动平面上的原始世界落点。 */
      startWorld: Point3;
      /** 按下时参数体的锚点（底面中心或球心）。 */
      startAnchor: Point3;
    }
  | {
      kind: "solid-rotate";
      id: string;
      axis: SolidAxis;
      /** 按下时指针在旋转平面（过锚点、法线为轴）内的方位角（度）。 */
      startDeg: number;
    }
  | {
      kind: "solid-scale";
      id: string;
      /** 按下时视线到锚点的垂距：缩放因子的分母。 */
      startRadius: number;
    }
  | {
      kind: "solid-control";
      id: string;
      pointId: string;
      /** 控制点拖动平面：过按下时的控制点位置、法线朝屏幕（视线方向）。 */
      planeOrigin: Point3;
      planeNormal: Point3;
    };

/** 一次 pointerup 至多一次提交：体素整格平移，参数体平移/旋转/缩放/控制点。 */
export type Select3dCommit =
  | { kind: "translate"; id: string; dx: number; dy: number; dz: number }
  | {
      /** 参数体平移：位移未吸附，提交函数（translateSolid）里吃格。 */
      kind: "translateSolid";
      id: string;
      dx: number;
      dy: number;
      dz: number;
    }
  | { kind: "rotateSolid"; id: string; axis: SolidAxis; deg: number }
  | { kind: "scaleSolid"; id: string; factor: number }
  | {
      kind: "solidControlPoint";
      id: string;
      pointId: string;
      /** 已吸附到格的目标世界点。 */
      point: Point3;
    };

/** 手势中的预览与放置预览同构：体素给目标整数角，参数体给变换后的形态。 */
export type Select3dPreview = PlacementPreview;

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
  /** 指针原始世界落点（未吸附）：体素与参数体平移都在水平面里度量。 */
  point: Point3;
  /** 参数体吃 1 / 1/2 / 关；体素声明在案但不吃（永远锁整数角）。 */
  grid: GridSnap;
  /** Alt 临时关吸附：对参数体有效，对体素无效。 */
  alt?: boolean;
  selectionId?: string | null;
  /** 左键落点命中的图元 id（Three 拾取给的，含体素与参数体）；null = 空处。 */
  hitId?: string | null;
  /** 指针视线：控制点/柄命中与旋转、缩放、控制点的量测都吃它。 */
  ray?: Ray3;
  /** 世界单位的柄命中半径；缺省 0 时柄不参与命中。 */
  handleTolerance?: number;
  /** 世界单位的控制点命中半径；缺省 0 时控制点不参与命中。 */
  controlTolerance?: number;
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

// ---- 视线的小几何：纯函数，测试直接吃构造好的 ray ----

function subtract(a: Point3, b: Point3): Point3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a: Point3, b: Point3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function distance3(a: Point3, b: Point3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** 视线上离 target 最近的点（t 钳到 0，不看身后）。 */
function closestOnRay(ray: Ray3, target: Point3): Point3 {
  const offset = subtract(target, ray.origin);
  const t = Math.max(0, dot(offset, ray.direction));
  return {
    x: ray.origin.x + ray.direction.x * t,
    y: ray.origin.y + ray.direction.y * t,
    z: ray.origin.z + ray.direction.z * t,
  };
}

/** 点到视线的垂距：柄/控制点命中的度量（等价于屏幕距离换算到世界）。 */
function rayDistance(ray: Ray3, target: Point3): number {
  return distance3(closestOnRay(ray, target), target);
}

/** 视线与平面（过 origin、法线 normal）的交点；平行或在身后返回 null。 */
function intersectRayPlane(
  ray: Ray3,
  origin: Point3,
  normal: Point3,
): Point3 | null {
  const denom = dot(ray.direction, normal);
  if (Math.abs(denom) < 1e-9) return null;
  const t = dot(subtract(origin, ray.origin), normal) / denom;
  if (t < 0) return null;
  return {
    x: ray.origin.x + ray.direction.x * t,
    y: ray.origin.y + ray.direction.y * t,
    z: ray.origin.z + ray.direction.z * t,
  };
}

/** 欧拉轴的单位向量与旋转平面内的角度基准（u 转向 v 为该轴正方向）。 */
function axisFrame(
  axis: SolidAxis,
): { unit: Point3; u: Point3; v: Point3 } {
  switch (axis) {
    case "x":
      // 绕 +X：+Y 转向 +Z
      return {
        unit: { x: 1, y: 0, z: 0 },
        u: { x: 0, y: 1, z: 0 },
        v: { x: 0, y: 0, z: 1 },
      };
    case "y":
      // 绕 +Y：+X 转向 −Z
      return {
        unit: { x: 0, y: 1, z: 0 },
        u: { x: 1, y: 0, z: 0 },
        v: { x: 0, y: 0, z: -1 },
      };
    case "z":
      // 绕 +Z：+X 转向 +Y
      return {
        unit: { x: 0, y: 0, z: 1 },
        u: { x: 1, y: 0, z: 0 },
        v: { x: 0, y: 1, z: 0 },
      };
  }
}

/** 指针在旋转平面（过锚点、法线为轴）内的方位角（度，atan2 值域）。 */
function pointerAngleAroundAxis(
  ray: Ray3,
  anchor: Point3,
  axis: SolidAxis,
): number | null {
  const { unit, u, v } = axisFrame(axis);
  const point = intersectRayPlane(ray, anchor, unit);
  if (point === null) return null;
  const offset = subtract(point, anchor);
  return (Math.atan2(dot(offset, v), dot(offset, u)) * 180) / Math.PI;
}

/** 两个方位角之差折回 (−180, 180]。 */
function degDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

// ---- 参数体的目录与柄布局 ----

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

function solidById(
  document: GeometryDocument,
  id: string,
): SolidPrimitive | null {
  if (document.space !== "3d") return null;
  const primitive = document.primitives.find((item) => item.id === id);
  return primitive !== undefined && primitive.type !== "voxel"
    ? primitive
    : null;
}

/** 参数体柄布放的局部包络：hx/hz 是底面半宽，h 是顶高。 */
function solidExtents(solid: SolidPrimitive): {
  hx: number;
  h: number;
  hz: number;
} {
  switch (solid.type) {
    case "box":
    case "pyramid":
      return { hx: solid.width / 2, h: solid.height, hz: solid.depth / 2 };
    case "cylinder":
    case "cone":
      return { hx: solid.r, h: solid.height, hz: solid.r };
    case "sphere":
      return { hx: solid.r, h: solid.r, hz: solid.r };
    case "triangularPrism":
      return {
        hx: Math.max(...solid.base.map((point) => Math.abs(point.x))),
        h: solid.height,
        hz: Math.max(...solid.base.map((point) => Math.abs(point.z))),
      };
  }
}

/** 柄心离参数体表面的额外间距 = 命中半径的该倍数，让柄浮在体外。 */
const HANDLE_GAP_FACTOR = 4;

/** 参数体变换手柄的语义标识：三根旋转轴柄加一根等比缩放柄。 */
export type SolidHandleId = "rotateY" | "rotateX" | "rotateZ" | "scale";

export type SolidTransformHandles = {
  id: string;
  /** 旋转缩放绕的锚点（底面中心或球心）。 */
  anchor: Point3;
  /** 头顶的 Y 轴旋转柄；球无旋转，为 null。 */
  rotateY: Point3 | null;
  /** +Z 侧的 X 轴旋转柄（把圆柱放倒用它）；球为 null。 */
  rotateX: Point3 | null;
  /** +X 侧的 Z 轴旋转柄；球为 null。 */
  rotateZ: Point3 | null;
  /** 地面斜角上的等比缩放柄，凡参数体必有。 */
  scale: Point3;
};

/**
 * 选中参数体的变换手柄布局（世界坐标）：柄位在参数体局部系里布放后经
 * 欧拉角（Y→X→Z）转到世界，跟着姿态走；间距 = 4×柄命中容差。
 */
export function solidTransformHandles(
  solid: SolidPrimitive,
  handleTolerance: number,
): SolidTransformHandles {
  const anchor = solidAnchor(solid);
  const { hx, h, hz } = solidExtents(solid);
  const gap = HANDLE_GAP_FACTOR * handleTolerance;
  const isSphere = solid.type === "sphere";
  const local = {
    rotateY: { x: 0, y: h + gap, z: 0 },
    rotateX: { x: 0, y: h / 2, z: hz + gap },
    rotateZ: { x: hx + gap, y: h / 2, z: 0 },
    scale: { x: hx + gap, y: 0, z: hz + gap },
  };
  const world = (point: Point3): Point3 => {
    if (isSphere) {
      return {
        x: anchor.x + point.x,
        y: anchor.y + point.y,
        z: anchor.z + point.z,
      };
    }
    const rotated = rotateEulerYxz(
      solid.rotationDegY,
      solid.rotationDegX,
      solid.rotationDegZ,
      point,
    );
    return {
      x: anchor.x + rotated.x,
      y: anchor.y + rotated.y,
      z: anchor.z + rotated.z,
    };
  };
  return {
    id: solid.id,
    anchor,
    rotateY: isSphere ? null : world(local.rotateY),
    rotateX: isSphere ? null : world(local.rotateX),
    rotateZ: isSphere ? null : world(local.rotateZ),
    scale: world(local.scale),
  };
}

type SolidHandleHit = { id: string; handle: SolidHandleId; anchor: Point3 };

type SolidControlHit = {
  id: string;
  pointId: string;
  world: Point3;
};

/**
 * 控制点命中只认当前选中的参数体，视线垂距最近者赢；目录顺序（宽深高、
 * 半径高、底面点……）作为同距并列时的次序。控制点优先于柄与本体。
 */
function hitSolidControl(ctx: Select3dContext): SolidControlHit | null {
  const controlTolerance = ctx.controlTolerance ?? 0;
  if (controlTolerance <= 0 || ctx.ray === undefined) return null;
  const solid = selectedSolid(ctx);
  if (solid === null) return null;
  let best: SolidControlHit | null = null;
  let bestDistance = controlTolerance;
  for (const point of solidControlPoints(solid)) {
    const d = rayDistance(ctx.ray, point.world);
    if (d <= bestDistance) {
      best = { id: solid.id, pointId: point.id, world: point.world };
      bestDistance = d;
    }
  }
  return best;
}

/** 柄命中只认当前选中的参数体；先查三根旋转柄，再查缩放柄。 */
function hitSolidHandle(ctx: Select3dContext): SolidHandleHit | null {
  const handleTolerance = ctx.handleTolerance ?? 0;
  if (handleTolerance <= 0 || ctx.ray === undefined) return null;
  const solid = selectedSolid(ctx);
  if (solid === null) return null;
  const handles = solidTransformHandles(solid, handleTolerance);
  const order: { handle: SolidHandleId; at: Point3 | null }[] = [
    { handle: "rotateY", at: handles.rotateY },
    { handle: "rotateX", at: handles.rotateX },
    { handle: "rotateZ", at: handles.rotateZ },
    { handle: "scale", at: handles.scale },
  ];
  for (const { handle, at } of order) {
    if (at !== null && rayDistance(ctx.ray, at) <= handleTolerance) {
      return { id: handles.id, handle, anchor: handles.anchor };
    }
  }
  return null;
}

function selectedSolid(ctx: Select3dContext): SolidPrimitive | null {
  if (ctx.selectionId == null || ctx.document.space !== "3d") return null;
  const primitive = ctx.document.primitives.find(
    (item) => item.id === ctx.selectionId,
  );
  if (primitive === undefined || primitive.type === "voxel") return null;
  return primitive;
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

/** 按下：控制点 → 旋转/缩放柄 → 本体（体素整格拖、参数体平移）。 */
export function startSelect3d(
  state: Select3dState,
  ctx: Select3dContext,
): Select3dResult {
  if (state.kind !== "idle") {
    return { state, preview: null, commit: null };
  }
  const controlHit = hitSolidControl(ctx);
  if (controlHit !== null && ctx.ray !== undefined) {
    return {
      state: {
        kind: "solid-control",
        id: controlHit.id,
        pointId: controlHit.pointId,
        planeOrigin: controlHit.world,
        planeNormal: ctx.ray.direction,
      },
      preview: null,
      selectionId: controlHit.id,
      commit: null,
    };
  }
  const handleHit = hitSolidHandle(ctx);
  if (handleHit !== null && ctx.ray !== undefined) {
    if (handleHit.handle !== "scale") {
      const axis: SolidAxis =
        handleHit.handle === "rotateY"
          ? "y"
          : handleHit.handle === "rotateX"
            ? "x"
            : "z";
      const startDeg =
        pointerAngleAroundAxis(ctx.ray, handleHit.anchor, axis) ?? 0;
      return {
        state: { kind: "solid-rotate", id: handleHit.id, axis, startDeg },
        preview: null,
        selectionId: handleHit.id,
        commit: null,
      };
    }
    const startRadius = rayDistance(ctx.ray, handleHit.anchor);
    if (startRadius > 0) {
      return {
        state: { kind: "solid-scale", id: handleHit.id, startRadius },
        preview: null,
        selectionId: handleHit.id,
        commit: null,
      };
    }
  }
  const hitId = ctx.hitId ?? null;
  const voxel = hitId === null ? null : voxelById(ctx.document, hitId);
  if (voxel !== null) {
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
  const solid = hitId === null ? null : solidById(ctx.document, hitId);
  if (solid !== null) {
    return {
      state: {
        kind: "solid-translate",
        id: solid.id,
        startWorld: ctx.point,
        startAnchor: solidAnchor(solid),
      },
      preview: null,
      selectionId: solid.id,
      commit: null,
    };
  }
  return { state, preview: null, commit: null };
}

/** 拖动中只出变换预览，说明书不动；不足一格/零角度/单位因子不出预览。 */
export function moveSelect3d(
  state: Select3dState,
  ctx: Select3dContext,
): Select3dResult {
  if (state.kind === "idle") {
    return idleResult3d();
  }
  if (state.kind === "drag") {
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
  if (state.kind === "solid-translate") {
    const solid = solidById(ctx.document, state.id);
    if (solid === null) {
      return idleResult3d();
    }
    const delta = snap3d(subtract(ctx.point, state.startWorld), ctx.grid);
    if (delta.x === 0 && delta.y === 0 && delta.z === 0) {
      return hold(state, null);
    }
    return hold(
      state,
      solidPlacementPreview(
        translateSolidGeometry(solid, delta.x, delta.y, delta.z),
      ),
    );
  }
  if (state.kind === "solid-rotate") {
    if (ctx.ray === undefined) {
      return hold(state, null);
    }
    const solid = solidById(ctx.document, state.id);
    if (solid === null) {
      return idleResult3d();
    }
    const deg = rotateDelta(state, ctx);
    if (deg === null || deg === 0) {
      return hold(state, null);
    }
    return hold(
      state,
      solidPlacementPreview(rotateSolidGeometry(solid, state.axis, deg)),
    );
  }
  if (state.kind === "solid-scale") {
    if (ctx.ray === undefined) {
      return hold(state, null);
    }
    const solid = solidById(ctx.document, state.id);
    if (solid === null) {
      return idleResult3d();
    }
    const factor = scaleFactor(state, ctx);
    if (factor === null || factor <= 0 || factor === 1) {
      return hold(state, null);
    }
    return hold(state, solidPlacementPreview(scaleSolidGeometry(solid, factor)));
  }
  // state.kind === "solid-control"
  if (ctx.ray === undefined) {
    return hold(state, null);
  }
  const solid = solidById(ctx.document, state.id);
  if (solid === null) {
    return idleResult3d();
  }
  const target = controlTarget(state, ctx);
  if (target === null) {
    return hold(state, null);
  }
  return hold(
    state,
    solidPlacementPreview(
      moveSolidControlPointGeometry(solid, state.pointId, snap3d(target, ctx.grid)),
    ),
  );
}

/** 旋转柄增量：当前方位角减按下时的方位角，折回 (−180, 180]。 */
function rotateDelta(
  state: Extract<Select3dState, { kind: "solid-rotate" }>,
  ctx: Select3dContext,
): number | null {
  if (ctx.ray === undefined) return null;
  const solid = solidById(ctx.document, state.id);
  if (solid === null) return null;
  const now = pointerAngleAroundAxis(ctx.ray, solidAnchor(solid), state.axis);
  return now === null ? null : degDelta(state.startDeg, now);
}

/** 缩放因子：视线到锚点的垂距相对按下时的比值（屏幕上拉远即放大）。 */
function scaleFactor(
  state: Extract<Select3dState, { kind: "solid-scale" }>,
  ctx: Select3dContext,
): number | null {
  if (ctx.ray === undefined) return null;
  const solid = solidById(ctx.document, state.id);
  if (solid === null) return null;
  return rayDistance(ctx.ray, solidAnchor(solid)) / state.startRadius;
}

/** 控制点拖动的目标世界点：视线与按下时过控制点、朝屏幕的平面的交点。 */
function controlTarget(
  state: Extract<Select3dState, { kind: "solid-control" }>,
  ctx: Select3dContext,
): Point3 | null {
  if (ctx.ray === undefined) return null;
  return intersectRayPlane(ctx.ray, state.planeOrigin, state.planeNormal);
}

/** 几何意义上的同点：视线求交带浮点尘埃，不能按位比较（关格时尤其）。 */
function samePoint3(a: Point3, b: Point3): boolean {
  return (
    Math.abs(a.x - b.x) < 1e-9 &&
    Math.abs(a.y - b.y) < 1e-9 &&
    Math.abs(a.z - b.z) < 1e-9
  );
}

/** 松手一次提交：吸附后零位移、零角度、单位因子、控制点拖回原位都不提交。 */
export function upSelect3d(
  state: Select3dState,
  ctx: Select3dContext,
): Select3dResult {
  if (state.kind === "idle") {
    return idleResult3d();
  }
  if (state.kind === "drag") {
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
  if (state.kind === "solid-translate") {
    const raw = subtract(ctx.point, state.startWorld);
    const delta = snap3d(raw, ctx.grid);
    if (delta.x === 0 && delta.y === 0 && delta.z === 0) {
      return idleResult3d();
    }
    return {
      state: idleSelect3dState(),
      preview: null,
      commit: {
        kind: "translateSolid",
        id: state.id,
        dx: raw.x,
        dy: raw.y,
        dz: raw.z,
      },
    };
  }
  if (state.kind === "solid-rotate") {
    const deg = rotateDelta(state, ctx);
    if (deg === null || deg === 0) {
      return idleResult3d();
    }
    return {
      state: idleSelect3dState(),
      preview: null,
      commit: { kind: "rotateSolid", id: state.id, axis: state.axis, deg },
    };
  }
  if (state.kind === "solid-scale") {
    const factor = scaleFactor(state, ctx);
    if (factor === null || factor <= 0 || factor === 1) {
      return idleResult3d();
    }
    return {
      state: idleSelect3dState(),
      preview: null,
      commit: { kind: "scaleSolid", id: state.id, factor },
    };
  }
  // state.kind === "solid-control"
  if (ctx.ray === undefined) {
    return idleResult3d();
  }
  const solid = solidById(ctx.document, state.id);
  if (solid === null) {
    return idleResult3d();
  }
  const target = controlTarget(state, ctx);
  if (target === null) {
    return idleResult3d();
  }
  const snapped = snap3d(target, ctx.grid);
  const current = solidControlPoints(solid).find(
    (point) => point.id === state.pointId,
  );
  if (current === undefined || samePoint3(current.world, snapped)) {
    return idleResult3d();
  }
  return {
    state: idleSelect3dState(),
    preview: null,
    commit: {
      kind: "solidControlPoint",
      id: state.id,
      pointId: state.pointId,
      point: snapped,
    },
  };
}

/** 单击（无拖动）命中控制点、柄或图元本体则选中，点空则取消。 */
export function clickSelect3d(
  state: Select3dState,
  ctx: Select3dContext,
): Select3dResult {
  if (state.kind !== "idle") {
    return { state, preview: null, commit: null };
  }
  const controlHit = hitSolidControl(ctx);
  if (controlHit !== null) {
    return { state, preview: null, selectionId: controlHit.id, commit: null };
  }
  const handleHit = hitSolidHandle(ctx);
  if (handleHit !== null) {
    return { state, preview: null, selectionId: handleHit.id, commit: null };
  }
  const hitId = ctx.hitId ?? null;
  const hit =
    hitId !== null &&
    ctx.document.primitives.some((item) => item.id === hitId)
      ? hitId
      : null;
  return {
    state,
    preview: null,
    selectionId: hit,
    commit: null,
  };
}

export function escSelect3d(_state: Select3dState): Select3dResult {
  return idleResult3d();
}
