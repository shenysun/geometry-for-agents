import {
  hitTest,
  snap2d,
  type GeometryDocument,
  type GridSnap,
  type Point2,
} from "../document/index.ts";
import {
  primitiveAnchor,
  rotatePrimitiveGeometry,
  scalePrimitiveGeometry,
  translatePrimitiveGeometry,
  type TwoDPrimitive,
} from "../document/update-document.ts";
import type { DrawPreview } from "./draw-gesture.ts";

export type SelectGestureState =
  | { kind: "idle" }
  | { kind: "drag"; id: string; start: Point2 }
  | { kind: "rotate"; id: string; center: Point2; startDeg: number }
  | { kind: "scale"; id: string; center: Point2; startRadius: number };

/** 一次 pointerup 提交的原始变换量；吸附与几何写入由说明书模块负责。 */
export type SelectCommit =
  | { kind: "translate"; id: string; dx: number; dy: number }
  | { kind: "rotate"; id: string; deg: number }
  | { kind: "scale"; id: string; factor: number };

export type SelectGestureResult = {
  state: SelectGestureState;
  preview: DrawPreview;
  /** undefined = 选中不变；null = 取消选中。 */
  selectionId?: string | null;
  commit: SelectCommit | null;
};

export type SelectContext = {
  tool: "select";
  document: GeometryDocument;
  /** 指针原始世界坐标（未吸附）。 */
  point: Point2;
  grid: GridSnap;
  /** 世界单位的命中容差，让细线/弧/标签可点；缺省 0 为精确命中。 */
  tolerance?: number;
  /** 当前选中：变换手柄只对它布局与命中。 */
  selectionId?: string | null;
  /** 世界单位的柄命中半径；缺省 0 时柄不参与命中。 */
  handleTolerance?: number;
};

export function idleSelectState(): SelectGestureState {
  return { kind: "idle" };
}

function idleResult(): SelectGestureResult {
  return { state: idleSelectState(), preview: null, commit: null };
}

function hold(state: SelectGestureState, preview: DrawPreview): SelectGestureResult {
  return { state, preview, commit: null };
}

function distance(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 指针相对锚点的方位角（度，逆时针为正）。 */
function pointerDeg(center: Point2, point: Point2): number {
  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
}

/** 柄心离锚点的额外间距 = 命中半径的该倍数，让柄浮在图元之外。 */
const HANDLE_GAP_FACTOR = 4;

export type TransformHandles = {
  id: string;
  center: Point2;
  /** 旋转柄（锚点上方）；旋转对称的图元（圆、环）为 null。 */
  rotate: Point2 | null;
  /** 缩放柄（锚点右侧），凡有变换手柄的图元必有。 */
  scale: Point2;
};

/** 锚点到图元最远处的距离：柄的布放半径。 */
function handleReach(primitive: TwoDPrimitive, center: Point2): number {
  switch (primitive.type) {
    case "line":
    case "polygon":
      return Math.max(
        ...primitive.points.map((point) => distance(point, center)),
      );
    case "circle":
    case "sector":
    case "bow":
    case "arc":
      return primitive.r;
    case "ring":
      return primitive.rOuter;
    case "ellipse":
      return Math.max(primitive.rx, primitive.ry);
    case "label":
      return 0;
  }
}

/**
 * 选中图元的变换手柄布局（世界坐标）。旋转缩放的锚点与说明书模块的
 * 旋转缩放锚点是同一个，柄在哪里，绕哪里转就在哪里。
 */
export function transformHandles(
  primitive: TwoDPrimitive,
  handleTolerance: number,
): TransformHandles | null {
  if (primitive.type === "label") return null;
  const center = primitiveAnchor(primitive);
  const offset =
    handleReach(primitive, center) + HANDLE_GAP_FACTOR * handleTolerance;
  const rotatable =
    primitive.type !== "circle" && primitive.type !== "ring";
  return {
    id: primitive.id,
    center,
    rotate: rotatable ? { x: center.x, y: center.y + offset } : null,
    scale: { x: center.x + offset, y: center.y },
  };
}

type HandleHit = { handle: "rotate" | "scale"; id: string; center: Point2 };

/** 柄命中只认当前选中的图元；柄优先于本体命中。 */
function hitTransformHandle(ctx: SelectContext): HandleHit | null {
  const handleTolerance = ctx.handleTolerance ?? 0;
  if (handleTolerance <= 0 || ctx.selectionId == null) return null;
  if (ctx.document.space !== "2d") return null;
  const primitive = ctx.document.primitives.find(
    (item) => item.id === ctx.selectionId,
  );
  if (primitive === undefined) return null;
  const handles = transformHandles(primitive, handleTolerance);
  if (handles === null) return null;
  if (
    handles.rotate !== null &&
    distance(ctx.point, handles.rotate) <= handleTolerance
  ) {
    return { handle: "rotate", id: handles.id, center: handles.center };
  }
  if (distance(ctx.point, handles.scale) <= handleTolerance) {
    return { handle: "scale", id: handles.id, center: handles.center };
  }
  return null;
}

function previewFromPrimitive(primitive: TwoDPrimitive): DrawPreview {
  switch (primitive.type) {
    case "line":
      return { type: "line", points: primitive.points };
    case "polygon":
      return { type: "polygon", points: primitive.points };
    case "circle":
      return {
        type: "circle",
        cx: primitive.cx,
        cy: primitive.cy,
        r: primitive.r,
      };
    case "ellipse":
      return {
        type: "ellipse",
        cx: primitive.cx,
        cy: primitive.cy,
        rx: primitive.rx,
        ry: primitive.ry,
        rotationDeg: primitive.rotationDeg,
      };
    case "ring":
      return {
        type: "ring",
        cx: primitive.cx,
        cy: primitive.cy,
        rInner: primitive.rInner,
        rOuter: primitive.rOuter,
      };
    case "arc":
    case "sector":
    case "bow":
      return {
        type: primitive.type,
        cx: primitive.cx,
        cy: primitive.cy,
        r: primitive.r,
        startDeg: primitive.startDeg,
        endDeg: primitive.endDeg,
      };
    case "label":
      return {
        type: "label",
        x: primitive.x,
        y: primitive.y,
        text: primitive.text,
      };
  }
}

/** 选中图元的虚线标记：拖动结束后仍能看出当前选中哪一条。 */
export function selectPreview(
  document: GeometryDocument,
  id: string | null,
): DrawPreview {
  if (id === null || document.space !== "2d") return null;
  const primitive = document.primitives.find((item) => item.id === id);
  return primitive === undefined ? null : previewFromPrimitive(primitive);
}

function draggedPrimitive(
  ctx: SelectContext,
  id: string,
): TwoDPrimitive | null {
  if (ctx.document.space !== "2d") return null;
  const primitive = ctx.document.primitives.find((item) => item.id === id);
  return primitive ?? null;
}

function snappedDelta(
  state: Extract<SelectGestureState, { kind: "drag" }>,
  ctx: SelectContext,
): Point2 {
  return snap2d(
    {
      x: ctx.point.x - state.start.x,
      y: ctx.point.y - state.start.y,
    },
    ctx.grid,
  );
}

/** 按下柄先于本体：柄进入旋转/缩放手势；本体命中进入拖动；空白保持 idle。 */
export function startSelect(
  state: SelectGestureState,
  ctx: SelectContext,
): SelectGestureResult {
  if (state.kind !== "idle") {
    return { state, preview: null, commit: null };
  }
  const handleHit = hitTransformHandle(ctx);
  if (handleHit !== null) {
    if (handleHit.handle === "rotate") {
      return {
        state: {
          kind: "rotate",
          id: handleHit.id,
          center: handleHit.center,
          startDeg: pointerDeg(handleHit.center, ctx.point),
        },
        preview: null,
        selectionId: handleHit.id,
        commit: null,
      };
    }
    const startRadius = distance(handleHit.center, ctx.point);
    if (startRadius > 0) {
      return {
        state: {
          kind: "scale",
          id: handleHit.id,
          center: handleHit.center,
          startRadius,
        },
        preview: null,
        selectionId: handleHit.id,
        commit: null,
      };
    }
  }
  const hit = hitTest(ctx.document, ctx.point, ctx.tolerance ?? 0);
  if (hit === null) {
    return idleResult();
  }
  return {
    state: { kind: "drag", id: hit.id, start: ctx.point },
    preview: null,
    selectionId: hit.id,
    commit: null,
  };
}

/** 拖动中只出变换预览（平移/旋转/缩放），说明书不变。 */
export function moveSelect(
  state: SelectGestureState,
  ctx: SelectContext,
): SelectGestureResult {
  if (state.kind === "rotate" || state.kind === "scale") {
    const primitive = draggedPrimitive(ctx, state.id);
    if (primitive === null) {
      return idleResult();
    }
    if (state.kind === "rotate") {
      const deg = pointerDeg(state.center, ctx.point) - state.startDeg;
      return hold(
        state,
        previewFromPrimitive(rotatePrimitiveGeometry(primitive, deg)),
      );
    }
    const factor = distance(state.center, ctx.point) / state.startRadius;
    return hold(
      state,
      previewFromPrimitive(scalePrimitiveGeometry(primitive, factor)),
    );
  }
  if (state.kind !== "drag") {
    return idleResult();
  }
  const primitive = draggedPrimitive(ctx, state.id);
  if (primitive === null) {
    return idleResult();
  }
  const delta = snappedDelta(state, ctx);
  return hold(
    state,
    previewFromPrimitive(
      translatePrimitiveGeometry(primitive, delta.x, delta.y),
    ),
  );
}

/** 松手一次提交：平移吸附后为零、旋转角为零、缩放因子为 1 都不提交。 */
export function upSelect(
  state: SelectGestureState,
  ctx: SelectContext,
): SelectGestureResult {
  if (state.kind === "rotate") {
    const deg = pointerDeg(state.center, ctx.point) - state.startDeg;
    if (deg === 0) {
      return idleResult();
    }
    return {
      state: idleSelectState(),
      preview: null,
      commit: { kind: "rotate", id: state.id, deg },
    };
  }
  if (state.kind === "scale") {
    const factor = distance(state.center, ctx.point) / state.startRadius;
    if (factor === 1) {
      return idleResult();
    }
    return {
      state: idleSelectState(),
      preview: null,
      commit: { kind: "scale", id: state.id, factor },
    };
  }
  if (state.kind !== "drag") {
    return idleResult();
  }
  const delta = snappedDelta(state, ctx);
  if (delta.x === 0 && delta.y === 0) {
    return idleResult();
  }
  return {
    state: idleSelectState(),
    preview: null,
    commit: {
      kind: "translate",
      id: state.id,
      dx: ctx.point.x - state.start.x,
      dy: ctx.point.y - state.start.y,
    },
  };
}

/** 单击（无拖动）命中柄或图元则选中，单击空白则取消选中。 */
export function clickSelect(
  state: SelectGestureState,
  ctx: SelectContext,
): SelectGestureResult {
  if (state.kind !== "idle") {
    return { state, preview: null, commit: null };
  }
  const handleHit = hitTransformHandle(ctx);
  if (handleHit !== null) {
    return { state, preview: null, selectionId: handleHit.id, commit: null };
  }
  const hit = hitTest(ctx.document, ctx.point, ctx.tolerance ?? 0);
  return {
    state,
    preview: null,
    selectionId: hit === null ? null : hit.id,
    commit: null,
  };
}

export function escSelect(_state: SelectGestureState): SelectGestureResult {
  return idleResult();
}
