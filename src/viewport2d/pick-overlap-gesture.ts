import {
  fillable2dTypes,
  hitTest,
  type GeometryDocument,
  type HitPoint,
  type Primitive,
  type Primitive2d,
} from "../document/index.ts";
import type { FunctionCurveViewport } from "../document/function-curve.ts";

/** 可作重叠填充源的图元：封闭可填充的 2D 几何（名单从 schema 推导）。 */
function isFillableSource(
  primitive: Primitive,
): primitive is Primitive2d {
  return (
    primitive.type !== "overlapFill" && fillable2dTypes.has(primitive.type)
  );
}

/** 重叠填充条目：两源 id + 填充样式，几何不进说明书（ADR 0019 引用式）。 */
export type OverlapFillEntry = Extract<Primitive2d, { type: "overlapFill" }>;

/** 两步拾取的状态：未开始，或已拾第一个源。 */
export type PickOverlapState =
  | { kind: "idle" }
  | { kind: "first"; id: string };

export type PickOverlapRejection =
  | "not-fillable"
  | "same-source"
  | "no-intersection";

export type PickOverlapContext = {
  document: GeometryDocument;
  point: HitPoint;
  tolerance: number;
  /** 函数曲线采样视口：点中函数曲线同样给「非封闭」拒绝（互斥清单），
   *  缺省 null 时函数曲线不参与命中。 */
  curveViewport?: FunctionCurveViewport | null;
  /** 新条目的 id，与绘制手势同例由调用方生成。 */
  id: string;
};

export type PickOverlapResult = {
  state: PickOverlapState;
  /** 第二拾取成功时待提交的条目。 */
  commit: OverlapFillEntry | null;
  /** 成功时的新选中（画完即回选择由组件层换工具完成）。 */
  selectionId?: string;
  rejection: PickOverlapRejection | null;
};

export function idlePickOverlapState(): PickOverlapState {
  return { kind: "idle" };
}

/**
 * 重叠填充工具的一次点击：点封闭图元两次成一条。契约拒绝（ADR 0019）：
 * 非封闭图元、同一图元两次、两源不相交；拒绝不改状态，空点忽略。
 * 相交判定与渲染同源（离屏合成），由调用方注入保持本模块纯函数。
 */
export function clickPickOverlap(
  state: PickOverlapState,
  ctx: PickOverlapContext,
  sourcesIntersect: (a: Primitive2d, b: Primitive2d) => boolean,
): PickOverlapResult {
  const doc = ctx.document;
  if (doc.space !== "2d") {
    return { state, commit: null, rejection: null };
  }
  const hit = hitTest(
    doc,
    ctx.point,
    ctx.tolerance,
    0,
    ctx.curveViewport ?? null,
  );
  if (hit === null) {
    return { state, commit: null, rejection: null };
  }
  const fillable = isFillableSource(hit);
  if (!fillable) {
    return { state, commit: null, rejection: "not-fillable" };
  }

  if (state.kind === "idle") {
    return { state: { kind: "first", id: hit.id }, commit: null, rejection: null };
  }
  if (hit.id === state.id) {
    return { state, commit: null, rejection: "same-source" };
  }

  const first = doc.primitives.find(
    (primitive): primitive is Primitive2d => primitive.id === state.id,
  );
  if (first === undefined || !sourcesIntersect(first, hit)) {
    return { state, commit: null, rejection: "no-intersection" };
  }

  const entry: OverlapFillEntry = {
    id: ctx.id,
    type: "overlapFill",
    sources: [state.id, hit.id],
    fill: "hatch",
  };
  return {
    state: idlePickOverlapState(),
    commit: entry,
    selectionId: ctx.id,
    rejection: null,
  };
}
