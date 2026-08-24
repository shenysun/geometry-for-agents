import {
  hitTest,
  snap2d,
  type GeometryDocument,
  type GridSnap,
  type Point2,
} from "../document/index.ts";
import {
  translatePrimitiveGeometry,
  type TwoDPrimitive,
} from "../document/update-document.ts";
import type { DrawPreview } from "./draw-gesture.ts";

export type SelectGestureState =
  | { kind: "idle" }
  | { kind: "drag"; id: string; start: Point2 };

/** 一次 pointerup 提交的原始世界位移；吸附由说明书模块的 translatePrimitive 负责。 */
export type SelectCommit = { id: string; dx: number; dy: number };

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

/** 按下图元本体即选中并进入拖动；按空白保持 idle，取消选中交给单击。 */
export function startSelect(
  state: SelectGestureState,
  ctx: SelectContext,
): SelectGestureResult {
  if (state.kind !== "idle") {
    return { state, preview: null, commit: null };
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

/** 拖动中只出吸附后的平移预览，说明书不变。 */
export function moveSelect(
  state: SelectGestureState,
  ctx: SelectContext,
): SelectGestureResult {
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

/** 松手一次提交：吸附后位移为零则不提交。 */
export function upSelect(
  state: SelectGestureState,
  ctx: SelectContext,
): SelectGestureResult {
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
      id: state.id,
      dx: ctx.point.x - state.start.x,
      dy: ctx.point.y - state.start.y,
    },
  };
}

/** 单击（无拖动）命中图元则选中，单击空白则取消选中。 */
export function clickSelect(
  state: SelectGestureState,
  ctx: SelectContext,
): SelectGestureResult {
  if (state.kind !== "idle") {
    return { state, preview: null, commit: null };
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
