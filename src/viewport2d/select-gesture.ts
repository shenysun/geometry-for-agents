import {
  hitCandidates,
  hitTest,
  snap2d,
  type GeometryDocument,
  type GridSnap,
  type Point2,
  type Primitive2d,
} from "../document/index.ts";
import {
  moveControlPointGeometry,
  primitiveAnchor,
  rotatePrimitiveGeometry,
  scalePrimitiveGeometry,
  translatePrimitiveGeometry,
} from "../document/update-document.ts";
import { controlPoints } from "./control-points.ts";
import { baseHeightWorldVertices } from "../document/base-height-family.ts";
import {
  resolveTransformImage,
  transformAxisOf,
  transformCenterOf,
} from "../document/transform-math.ts";
import type { FunctionCurveViewport } from "../document/function-curve.ts";
import { functionCurveParamsOf } from "../document/function-curve.ts";
import type { DrawPreview } from "./draw-gesture.ts";
import type { PreviewMark } from "./draw-primitives.ts";

export type SelectGestureState =
  | { kind: "idle" }
  | { kind: "drag"; id: string; start: Point2 }
  | { kind: "rotate"; id: string; center: Point2; startDeg: number }
  | { kind: "scale"; id: string; center: Point2; startRadius: number }
  | { kind: "control"; id: string; pointId: string };

/** 一次 pointerup 提交的原始变换量；吸附与几何写入由说明书模块负责。 */
export type SelectCommit =
  | { kind: "translate"; id: string; dx: number; dy: number }
  | { kind: "rotate"; id: string; deg: number }
  | { kind: "scale"; id: string; factor: number }
  | { kind: "controlPoint"; id: string; pointId: string; point: Point2 };

export type SelectGestureResult = {
  state: SelectGestureState;
  /** 拖动中的手势预览：普通图元重画自身几何，变换图元画随参数更新的像。 */
  preview: PreviewMark;
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
  /** 世界单位的控制点命中半径；缺省 0 时控制点不参与命中。 */
  controlTolerance?: number;
  /** 每屏幕像素的世界长度；标注文本的命中区随缩放变化，缺省 0 不参与。 */
  worldPerPx?: number;
  /** 函数曲线的采样视口（渲染同一条折线）；缺省 null 时函数曲线不参与命中。 */
  curveViewport?: FunctionCurveViewport | null;
  /** 同点连点的循环目标：须在该点候选列表内，否则回退首位胜者。 */
  preferId?: string;
};

export function idleSelectState(): SelectGestureState {
  return { kind: "idle" };
}

function idleResult(): SelectGestureResult {
  return { state: idleSelectState(), preview: null, commit: null };
}

function hold(state: SelectGestureState, preview: PreviewMark): SelectGestureResult {
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
function handleReach(primitive: Primitive2d, center: Point2): number {
  switch (primitive.type) {
    case "overlapFill":
    case "measure":
    case "functionCurve":
    case "transform":
      // transformHandles 已对其返回 null，此处不可达。
      return 0;
    case "line":
    case "polygon":
    case "dimension":
      return Math.max(
        ...primitive.points.map((point) => distance(point, center)),
      );
    case "rectangle":
      return Math.hypot(primitive.width / 2, primitive.height / 2);
    case "triangle":
    case "parallelogram":
    case "trapezoid":
      return Math.max(
        ...baseHeightWorldVertices(primitive).map((vertex) =>
          distance(vertex, center),
        ),
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
    case "angle":
      return primitive.length;
    case "regularPolygon":
      return primitive.r;
    case "label":
      return 0;
  }
}

/**
 * 选中图元的变换手柄布局（世界坐标）。旋转缩放的锚点与说明书模块的
 * 旋转缩放锚点是同一个，柄在哪里，绕哪里转就在哪里。
 */
export function transformHandles(
  primitive: Primitive2d,
  handleTolerance: number,
): TransformHandles | null {
  if (primitive.type === "label") return null;
  // 重叠填充与度量标注不可变换（引用式，ADR 0019 / ADR 0020）：
  // 选中可删，但不布柄——度量数值纯跟随源。
  // 函数曲线无拖动/缩放/旋转手柄（ADR 0021）：形状由参数决定，编辑走
  // 属性面板，不布柄误导操作员去「挪动」一条参数图像。
  // 变换图元同样不布柄（ADR 0022）：像由参数推导纯跟随，参数编辑走
  // 属性面板；选中可删。
  if (
    primitive.type === "overlapFill" ||
    primitive.type === "measure" ||
    primitive.type === "functionCurve" ||
    primitive.type === "transform"
  ) {
    return null;
  }
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

type ControlHit = { id: string; pointId: string; center: Point2 };

/**
 * 控制点命中只认当前选中的图元，重叠时取最近的；目录顺序（圆心、半径、
 * 起止角……）作为同距并列时的次序。控制点优先于柄，柄优先于本体。
 */
function hitControlPoint(ctx: SelectContext): ControlHit | null {
  const controlTolerance = ctx.controlTolerance ?? 0;
  if (controlTolerance <= 0 || ctx.selectionId == null) return null;
  if (ctx.document.space !== "2d") return null;
  const primitive = ctx.document.primitives.find(
    (item) => item.id === ctx.selectionId,
  );
  if (primitive === undefined) return null;
  let best: ControlHit | null = null;
  let bestDistance = controlTolerance;
  for (const point of controlPoints(primitive)) {
    const d = distance(ctx.point, point.point);
    if (d <= bestDistance) {
      best = { id: primitive.id, pointId: point.id, center: point.point };
      bestDistance = d;
    }
  }
  return best;
}

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

function previewFromPrimitive(primitive: Primitive2d): DrawPreview | null {
  switch (primitive.type) {
    case "overlapFill":
    case "measure":
      // 引用条目无自身几何可预览，也不可拖（变换恒等已兜底）。
      return null;
    case "transform":
      // 变换条目同样无自身几何可预览：选中态高亮它的源（measure 单源
      // 先例）——像本身已是虚线推导画法，无需再高亮。
      return null;
    case "functionCurve": {
      // 选中态高亮同笔画族画法：按采样折线重画一遍换强调色。
      return { type: "functionCurve", ...functionCurveParamsOf(primitive) };
    }
    case "line":
      return { type: "line", points: primitive.points };
    case "dimension":
      return { type: "dimension", points: primitive.points };
    case "polygon":
      return { type: "polygon", points: primitive.points };
    case "rectangle":
      return {
        type: "rectangle",
        x: primitive.x,
        y: primitive.y,
        width: primitive.width,
        height: primitive.height,
        rotationDeg: primitive.rotationDeg,
      };
    case "triangle":
      return {
        type: "triangle",
        x: primitive.x,
        y: primitive.y,
        width: primitive.width,
        height: primitive.height,
        apexOffset: primitive.apexOffset,
        rotationDeg: primitive.rotationDeg,
      };
    case "parallelogram":
      return {
        type: "parallelogram",
        x: primitive.x,
        y: primitive.y,
        width: primitive.width,
        height: primitive.height,
        skew: primitive.skew,
        rotationDeg: primitive.rotationDeg,
      };
    case "trapezoid":
      return {
        type: "trapezoid",
        x: primitive.x,
        y: primitive.y,
        width: primitive.width,
        topWidth: primitive.topWidth,
        height: primitive.height,
        topOffset: primitive.topOffset,
        rotationDeg: primitive.rotationDeg,
      };
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
    case "angle":
      return {
        type: "angle",
        x: primitive.x,
        y: primitive.y,
        startDeg: primitive.startDeg,
        endDeg: primitive.endDeg,
        length: primitive.length,
      };
    case "regularPolygon":
      return {
        type: "regularPolygon",
        x: primitive.x,
        y: primitive.y,
        sides: primitive.sides,
        r: primitive.r,
        rotationDeg: primitive.rotationDeg,
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

/** 选中图元的虚线标记：拖动结束后仍能看出当前选中哪一条。
 * 重叠填充条目无自身几何——高亮它的两个源，否则画面零反馈。 */
export function selectPreview(
  document: GeometryDocument,
  id: string | null,
): PreviewMark {
  if (id === null || document.space !== "2d") return null;
  const primitive = document.primitives.find((item) => item.id === id);
  if (primitive === undefined) return null;
  if (primitive.type === "overlapFill") {
    const marks = primitive.sources.flatMap((sourceId) => {
      const source = document.primitives.find((item) => item.id === sourceId);
      const mark = source === undefined ? null : previewFromPrimitive(source);
      return mark === null ? [] : [mark];
    });
    return marks.length === 0 ? null : marks;
  }
  if (primitive.type === "measure") {
    // 度量标注选中态高亮它的源（重叠填充高亮源先例，单源）：
    // 从视口就能确认「这个数标的是谁」。
    const source = document.primitives.find(
      (item) => item.id === primitive.sourceId,
    );
    return source === undefined ? null : previewFromPrimitive(source);
  }
  if (primitive.type === "transform") {
    // 变换图元选中态高亮它的源（measure 单源先例）：像自身是虚线推导
    // 画法，选中反馈落在源上即可分辨。
    const source = document.primitives.find(
      (item) => item.id === primitive.sourceId,
    );
    return source === undefined ? null : previewFromPrimitive(source);
  }
  return previewFromPrimitive(primitive);
}

function draggedPrimitive(
  ctx: SelectContext,
  id: string,
): Primitive2d | null {
  if (ctx.document.space !== "2d") return null;
  const primitive = ctx.document.primitives.find((item) => item.id === id);
  return primitive ?? null;
}

/** 控制点拖动的预览：普通图元重画自身几何；变换图元预览随参数更新的像
 *  （票 03——拖中心像实时跟随；票 04——拖轴端点像与轴虚线实时跟随），
 *  画法与提交后的像层一致、中心辅助点与对称轴随行。 */
function controlDragPreview(
  document: GeometryDocument,
  edited: Primitive2d,
): PreviewMark {
  if (edited.type !== "transform") {
    return previewFromPrimitive(edited);
  }
  if (document.space !== "2d") return null;
  const image = resolveTransformImage(document.primitives, edited);
  if (image === null) return null;
  return {
    type: "transformImage",
    image,
    center: transformCenterOf(edited) ?? undefined,
    axis: transformAxisOf(edited) ?? undefined,
  };
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

/** 按下控制点先于柄、柄先于本体：控制点手势只改那一处几何。 */
export function startSelect(
  state: SelectGestureState,
  ctx: SelectContext,
): SelectGestureResult {
  if (state.kind !== "idle") {
    return { state, preview: null, commit: null };
  }
  const controlHit = hitControlPoint(ctx);
  if (controlHit !== null) {
    return {
      state: { kind: "control", id: controlHit.id, pointId: controlHit.pointId },
      preview: null,
      selectionId: controlHit.id,
      commit: null,
    };
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
  const hit = hitTest(
    ctx.document,
    ctx.point,
    ctx.tolerance ?? 0,
    ctx.worldPerPx ?? 0,
    ctx.curveViewport ?? null,
  );
  if (hit === null) {
    return idleResult();
  }
  // 函数曲线不可拖（无几何身份，ADR 0021）：点中只选中，按下后的拖动
  // 不进拖动态——交还投影器平移视口，不产生恒等变换的空 undo 步。
  // 变换图元同样只选中不可拖（ADR 0022）：像纯跟随，无本体位移交互。
  if (hit.type === "functionCurve" || hit.type === "transform") {
    return {
      state: idleSelectState(),
      preview: null,
      selectionId: hit.id,
      commit: null,
    };
  }
  return {
    state: { kind: "drag", id: hit.id, start: ctx.point },
    preview: null,
    selectionId: hit.id,
    commit: null,
  };
}

/** 拖动中只出变换预览（平移/旋转/缩放/控制点），说明书不变。 */
export function moveSelect(
  state: SelectGestureState,
  ctx: SelectContext,
): SelectGestureResult {
  if (state.kind === "control") {
    const primitive = draggedPrimitive(ctx, state.id);
    if (primitive === null) {
      return idleResult();
    }
    const target = snap2d(ctx.point, ctx.grid);
    return hold(
      state,
      controlDragPreview(
        ctx.document,
        moveControlPointGeometry(primitive, state.pointId, target),
      ),
    );
  }
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

/** 松手一次提交：平移吸附后为零、旋转角为零、缩放因子为 1、控制点拖回原位都不提交。 */
export function upSelect(
  state: SelectGestureState,
  ctx: SelectContext,
): SelectGestureResult {
  if (state.kind === "control") {
    const primitive = draggedPrimitive(ctx, state.id);
    if (primitive === null) {
      return idleResult();
    }
    const target = snap2d(ctx.point, ctx.grid);
    const current = controlPoints(primitive).find(
      (point) => point.id === state.pointId,
    );
    if (
      current === undefined ||
      (current.point.x === target.x && current.point.y === target.y)
    ) {
      return idleResult();
    }
    return {
      state: idleSelectState(),
      preview: null,
      commit: { kind: "controlPoint", id: state.id, pointId: state.pointId, point: target },
    };
  }
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

/** 单击（无拖动）命中控制点或柄或图元则选中，单击空白则取消选中。 */
export function clickSelect(
  state: SelectGestureState,
  ctx: SelectContext,
): SelectGestureResult {
  if (state.kind !== "idle") {
    return { state, preview: null, commit: null };
  }
  const controlHit = hitControlPoint(ctx);
  if (controlHit !== null) {
    return { state, preview: null, selectionId: controlHit.id, commit: null };
  }
  const handleHit = hitTransformHandle(ctx);
  if (handleHit !== null) {
    return { state, preview: null, selectionId: handleHit.id, commit: null };
  }
  const candidates = hitCandidates(
    ctx.document,
    ctx.point,
    ctx.tolerance ?? 0,
    ctx.worldPerPx ?? 0,
    ctx.curveViewport ?? null,
  );
  const hit = ctx.preferId === undefined
    ? candidates[0]
    : candidates.find((candidate) => candidate.id === ctx.preferId) ??
      candidates[0];
  return {
    state,
    preview: null,
    selectionId: hit === undefined ? null : hit.id,
    commit: null,
  };
}

export function escSelect(_state: SelectGestureState): SelectGestureResult {
  return idleResult();
}
