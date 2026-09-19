import {
  hitTest,
  snap2d,
  transformable2dTypes,
  type GeometryDocument,
  type GridSnap,
  type Point2,
  type TransformPrimitive,
} from "../document/index.ts";
import {
  transformImage,
  type Transformable2d,
} from "../document/transform-math.ts";
import type { FunctionCurveViewport } from "../document/function-curve.ts";
import type { EditorTool } from "../stores/editor.ts";
import type { TransformImagePreview } from "./draw-primitives.ts";

/** 变换图元条目：源 id + 变换种类与参数，像几何不进说明书（ADR 0022）。 */
export type TransformEntry = TransformPrimitive;

/** 本票落地的变换种类：平移先行，旋转/位似/轴对称由后续票在骨架上补齐。 */
export type ImplementedTransformKind = "translate";

export type PickTransformRejection = "not-transformable";

/** 两步拾取的状态：未开始、已锁源、正在拖位移向量（第二步）。 */
export type PickTransformState =
  | { kind: "idle" }
  | { kind: "source"; id: string }
  | { kind: "vector"; id: string; start: Point2; cursor: Point2 };

export type PickTransformContext = {
  document: GeometryDocument;
  point: Point2;
  tolerance: number;
  /** 每屏幕像素的世界长度：标注文本命中区随缩放变化，缺省 0 不参与。 */
  worldPerPx?: number;
  /** 函数曲线采样视口：点中函数曲线同样给「不可变换」拒绝（互斥清单），
   *  缺省 null 时函数曲线不参与命中。 */
  curveViewport?: FunctionCurveViewport | null;
  /** 取点落格（Alt 暂不落格由调用方折算成 "off" 传入）。 */
  grid: GridSnap;
  /** 新条目的 id，与绘制手势同例由调用方生成。 */
  id: string;
};

export type PickTransformResult = {
  state: PickTransformState;
  /** 第二步松手时待提交的条目（一步 undo 的提交单元）。 */
  commit: TransformEntry | null;
  /** 成功时的新选中（画完即回选择由组件层换工具完成）。 */
  selectionId?: string;
  rejection: PickTransformRejection | null;
  /** 拖动中的像实时预览（ADR 0007）：像图元值由数学层推导。 */
  preview: TransformImagePreview | null;
};

export function idlePickTransformState(): PickTransformState {
  return { kind: "idle" };
}

/** 变换工具 id → 变换种类：M 平移先行（ADR 0022）；非变换工具返回 null。 */
export function transformKindForTool(
  tool: EditorTool,
): ImplementedTransformKind | null {
  if (tool === "translate") return "translate";
  return null;
}

/** 已锁源（或拖动中）的源图元：不存在或掉出白名单时返回 null。 */
function lockedSource(
  document: GeometryDocument,
  state: Extract<PickTransformState, { kind: "source" | "vector" }>,
): Transformable2d | null {
  if (document.space !== "2d") return null;
  const primitive = document.primitives.find((item) => item.id === state.id);
  return primitive !== undefined && transformable2dTypes.has(primitive.type)
    ? (primitive as Transformable2d)
    : null;
}

/** 拖动中参数：位移向量 = 松手点 − 起点（两点都已落格）。 */
function vectorParamsOf(
  state: Extract<PickTransformState, { kind: "vector" }>,
): { kind: "translate"; dx: number; dy: number } {
  return {
    kind: "translate",
    dx: state.cursor.x - state.start.x,
    dy: state.cursor.y - state.start.y,
  };
}

function imagePreview(
  document: GeometryDocument,
  state: PickTransformState,
): TransformImagePreview | null {
  if (state.kind !== "vector") return null;
  const source = lockedSource(document, state);
  if (source === null) return null;
  return {
    type: "transformImage",
    image: transformImage(source, vectorParamsOf(state)),
  };
}

/**
 * 变换工具第一步的一次点击：点白名单图元即锁定源（ADR 0022）。契约拒绝：
 * 函数曲线（世界坐标身份冲突）、引用型条目（重叠填充/度量标注/transform
 * 自身）——即时反馈不切工具。空点忽略；已锁源后点击不再改状态（第二步
 * 归拖动手势）。
 */
export function clickPickTransform(
  state: PickTransformState,
  ctx: PickTransformContext,
): PickTransformResult {
  if (state.kind !== "idle") {
    return { state, commit: null, rejection: null, preview: null };
  }
  const doc = ctx.document;
  if (doc.space !== "2d") {
    return { state, commit: null, rejection: null, preview: null };
  }
  const hit = hitTest(
    doc,
    ctx.point,
    ctx.tolerance,
    ctx.worldPerPx ?? 0,
    ctx.curveViewport ?? null,
  );
  if (hit === null) {
    return { state, commit: null, rejection: null, preview: null };
  }
  if (!transformable2dTypes.has(hit.type)) {
    return { state, commit: null, rejection: "not-transformable", preview: null };
  }
  return {
    state: { kind: "source", id: hit.id },
    commit: null,
    rejection: null,
    preview: null,
  };
}

/** 第二步开始：已锁源后按下，从落格起点拖出位移向量。 */
export function startPickTransformVector(
  state: PickTransformState,
  ctx: PickTransformContext,
): PickTransformResult {
  if (state.kind !== "source" || lockedSource(ctx.document, state) === null) {
    return { state, commit: null, rejection: null, preview: null };
  }
  const start = snap2d(ctx.point, ctx.grid);
  return {
    state: { kind: "vector", id: state.id, start, cursor: start },
    commit: null,
    rejection: null,
    preview: null,
  };
}

/** 拖动中：光标落格跟随，像实时预览（说明书不动）。 */
export function movePickTransform(
  state: PickTransformState,
  ctx: PickTransformContext,
): PickTransformResult {
  if (state.kind !== "vector") {
    return { state, commit: null, rejection: null, preview: null };
  }
  const next: PickTransformState = {
    ...state,
    cursor: snap2d(ctx.point, ctx.grid),
  };
  return {
    state: next,
    commit: null,
    rejection: null,
    preview: imagePreview(ctx.document, next),
  };
}

/**
 * 松手一次提交：位移向量写入契约（一步 undo）。零位移不提交、退回已锁源
 * 状态（退化值不静默钳到端点，先例滑块零位移触碰）；源已消失则整体复位。
 */
export function upPickTransform(
  state: PickTransformState,
  ctx: PickTransformContext,
): PickTransformResult {
  if (state.kind !== "vector") {
    return { state, commit: null, rejection: null, preview: null };
  }
  const released: PickTransformState = {
    ...state,
    cursor: snap2d(ctx.point, ctx.grid),
  };
  if (lockedSource(ctx.document, released) === null) {
    return {
      state: idlePickTransformState(),
      commit: null,
      rejection: null,
      preview: null,
    };
  }
  const { dx, dy } = vectorParamsOf(released);
  if (dx === 0 && dy === 0) {
    return {
      state: { kind: "source", id: state.id },
      commit: null,
      rejection: null,
      preview: null,
    };
  }
  const entry: TransformEntry = {
    id: ctx.id,
    type: "transform",
    sourceId: state.id,
    kind: "translate",
    dx,
    dy,
  };
  return {
    state: idlePickTransformState(),
    commit: entry,
    selectionId: ctx.id,
    rejection: null,
    preview: null,
  };
}

/** Escape 取消：两步任意状态回到 idle，预览清空。 */
export function escPickTransform(
  state: PickTransformState,
): PickTransformResult {
  return {
    state: idlePickTransformState(),
    commit: null,
    rejection: null,
    preview: null,
  };
}
