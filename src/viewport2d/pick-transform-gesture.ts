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
  type TransformParams,
} from "../document/transform-math.ts";
import type { FunctionCurveViewport } from "../document/function-curve.ts";
import type { EditorTool } from "../stores/editor.ts";
import type { TransformImagePreview } from "./draw-primitives.ts";

/** 变换图元条目：源 id + 变换种类与参数，像几何不进说明书（ADR 0022）。 */
export type TransformEntry = TransformPrimitive;

/** 已落地的变换种类：平移/旋转/位似（票 02/03）+ 轴对称（票 04）。 */
export type ImplementedTransformKind =
  | "translate"
  | "rotate"
  | "dilate"
  | "reflect";

/** 第二步以中心定参的两种变换：按下即中心、拖动微调、松手提交。 */
export type CenterKind = Extract<ImplementedTransformKind, "rotate" | "dilate">;

/** 创建手势的默认参数（spec Further Notes：常见题面取值，可调、非契约内容）。
 *  角度存储保留符号约定（正为逆时针），显示归一到 0–360° 属属性面板（票 05）。 */
export const ROTATE_DEFAULT_ANGLE_DEG = 90;
export const DILATE_DEFAULT_RATIO = 2;

export type PickTransformRejection = "not-transformable";

/** 两步拾取的状态：未开始、已锁源、第二步进行中——平移拖位移向量，
 *  旋转/位似拖中心（拖动即微调中心，松手按默认角度/比提交），轴对称点
 *  两点定轴（票 04：第一点落下后悬停即预览，第二点点击提交）。center 态
 *  随行起始工具的变换种类：kind 由创建工具定死、事后不改（spec 渲染条），
 *  拖动中换工具不改变本次提交。 */
export type PickTransformState =
  | { kind: "idle" }
  | { kind: "source"; id: string }
  | { kind: "vector"; id: string; start: Point2; cursor: Point2 }
  | { kind: "center"; centerKind: CenterKind; id: string; center: Point2 }
  | { kind: "axis"; id: string; first: Point2 };

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
  /** 当前变换工具的种类：第二步的形状由它分流（平移拖向量、旋转/位似点中心）。 */
  kind: ImplementedTransformKind;
};

export type PickTransformResult = {
  state: PickTransformState;
  /** 第二步松手时待提交的条目（一步 undo 的提交单元）。 */
  commit: TransformEntry | null;
  /** 成功时的新选中（画完即回选择由组件层换工具完成）。 */
  selectionId?: string;
  rejection: PickTransformRejection | null;
  /** 拖动中的像实时预览（ADR 0007）：像图元值由数学层推导，中心辅助点随预览。 */
  preview: TransformImagePreview | null;
};

export function idlePickTransformState(): PickTransformState {
  return { kind: "idle" };
}

/** 保持某状态的结果：无提交、无拒绝（可选随预览）——各通道「非本态
 *  不处理」与新态进入的统一出口（六字段字面量的收拢；命名沿
 *  select-gesture 的 hold）。 */
function hold(
  state: PickTransformState,
  preview: TransformImagePreview | null = null,
): PickTransformResult {
  return { state, commit: null, rejection: null, preview };
}

/** 两点是否重合：定轴分支的轴退化判据（契约拒绝的镜像判断）。 */
function samePoint(a: Point2, b: Point2): boolean {
  return a.x === b.x && a.y === b.y;
}

/** 上下文点的命中测试：第一步拾源与第二步线段吸附共用同一套容差。 */
function hitAt(ctx: PickTransformContext) {
  return hitTest(
    ctx.document,
    ctx.point,
    ctx.tolerance,
    ctx.worldPerPx ?? 0,
    ctx.curveViewport ?? null,
  );
}

/** 变换工具 id → 变换种类（ADR 0022）：M 平移、E 旋转、Shift+E 位似、
 *  Shift+M 轴对称；非变换工具返回 null。kind 由创建工具定死、事后不改
 *  （函数曲线先例）。 */
export function transformKindForTool(
  tool: EditorTool,
): ImplementedTransformKind | null {
  if (tool === "translate") return "translate";
  if (tool === "rotate") return "rotate";
  if (tool === "dilate") return "dilate";
  if (tool === "reflect") return "reflect";
  return null;
}

/** 已锁源（或拖动中）的源图元：不存在或掉出白名单时返回 null。 */
function lockedSource(
  document: GeometryDocument,
  state: Extract<
    PickTransformState,
    { kind: "source" | "vector" | "center" | "axis" }
  >,
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

/** 第二步拖动中参数：平移取位移向量；旋转/位似取落格中心 + 默认角度/比
 *  （默认值是可调取值，不是契约内容；负比与任意角度走属性面板，票 05）。
 *  参数由状态自述（center 态随行起始 kind），不读实时工具。 */
function draggingParamsOf(
  state: Extract<PickTransformState, { kind: "vector" | "center" }>,
): TransformParams {
  if (state.kind === "vector") {
    return vectorParamsOf(state);
  }
  return state.centerKind === "rotate"
    ? {
        kind: "rotate",
        centerX: state.center.x,
        centerY: state.center.y,
        angleDeg: ROTATE_DEFAULT_ANGLE_DEG,
      }
    : {
        kind: "dilate",
        centerX: state.center.x,
        centerY: state.center.y,
        ratio: DILATE_DEFAULT_RATIO,
      };
}

/** 拖动态的光标落格：平移挪光标、旋转/位似挪中心（同形收拢，move/up 共用）。 */
function snapDragState(
  state: Extract<PickTransformState, { kind: "vector" | "center" }>,
  point: Point2,
  grid: GridSnap,
): Extract<PickTransformState, { kind: "vector" | "center" }> {
  const snapped = snap2d(point, grid);
  return state.kind === "vector"
    ? { ...state, cursor: snapped }
    : { ...state, center: snapped };
}

function imagePreview(
  document: GeometryDocument,
  state: PickTransformState,
): TransformImagePreview | null {
  if (state.kind !== "vector" && state.kind !== "center") return null;
  const source = lockedSource(document, state);
  if (source === null) return null;
  const params = draggingParamsOf(state);
  // 零位移的恒等像会虚线叠在源上（按下瞬间、未出格的拖动）：不预览。
  if (params.kind === "translate" && params.dx === 0 && params.dy === 0) {
    return null;
  }
  return {
    type: "transformImage",
    image: transformImage(source, params),
    center: state.kind === "center" ? state.center : undefined,
  };
}

/** 定轴中的预览（票 04）：轴 = 第一点 → 落格光标，像与轴虚线实时跟随
 *  （US 8 悬停即预览）；两点重合（轴退化无定义）不预览。 */
function axisImagePreview(
  document: GeometryDocument,
  state: Extract<PickTransformState, { kind: "axis" }>,
  second: Point2,
): TransformImagePreview | null {
  const source = lockedSource(document, state);
  if (source === null) return null;
  if (samePoint(second, state.first)) return null;
  return {
    type: "transformImage",
    image: transformImage(source, {
      kind: "reflect",
      x1: state.first.x,
      y1: state.first.y,
      x2: second.x,
      y2: second.y,
    }),
    axis: [state.first, second],
  };
}

/** 一次提交的结果（一步 undo 的提交单元，move/up/click 三通道共用）。 */
function commitResult(
  ctx: PickTransformContext,
  sourceId: string,
  params: TransformParams,
): PickTransformResult {
  const entry: TransformEntry = {
    id: ctx.id,
    type: "transform",
    sourceId,
    ...params,
  };
  return {
    state: idlePickTransformState(),
    commit: entry,
    selectionId: ctx.id,
    rejection: null,
    preview: null,
  };
}

/** 第二步点中现成线段：直接取其两端点为轴（US 4，一次点击完成定轴）。
 *  线段可含中间顶点（addVertex），轴取首末两端；端点原样入契约、不落格
 *  （吸附会让轴脱离实际线段）；首末重合的退化线段不吸附，走普通取点。
 *  其余图元命中不吸附，返回 null 走普通取点。 */
function segmentAxisAt(ctx: PickTransformContext): TransformParams | null {
  if (ctx.document.space !== "2d") return null;
  const hit = hitAt(ctx);
  if (hit === null || hit.type !== "line") return null;
  const first = hit.points[0];
  const last = hit.points[hit.points.length - 1];
  if (first === undefined || last === undefined || samePoint(first, last)) {
    return null;
  }
  return {
    kind: "reflect",
    x1: first.x,
    y1: first.y,
    x2: last.x,
    y2: last.y,
  };
}

/**
 * 轴对称第二步的点击通道（票 04）：点两点定轴——第一次点击落第一点
 * （悬停即预览），第二次点击提交；任一次点击点中现成线段则直接取其两端
 * 为轴、一次完成。第二点与第一点同格是退化轴，不提交、继续等待。
 */
function clickReflectAxis(
  state: Extract<PickTransformState, { kind: "source" | "axis" }>,
  ctx: PickTransformContext,
): PickTransformResult {
  if (lockedSource(ctx.document, state) === null) {
    return hold(idlePickTransformState());
  }
  const segment = segmentAxisAt(ctx);
  if (segment !== null) {
    return commitResult(ctx, state.id, segment);
  }
  const point = snap2d(ctx.point, ctx.grid);
  if (state.kind === "source") {
    return hold({ kind: "axis", id: state.id, first: point });
  }
  if (samePoint(point, state.first)) {
    return hold(state);
  }
  return commitResult(ctx, state.id, {
    kind: "reflect",
    x1: state.first.x,
    y1: state.first.y,
    x2: point.x,
    y2: point.y,
  });
}

/**
 * 变换工具第一步的一次点击：点白名单图元即锁定源（ADR 0022）。契约拒绝：
 * 函数曲线（世界坐标身份冲突）、引用型条目（重叠填充/度量标注/transform
 * 自身）——即时反馈不切工具。空点忽略；已锁源后点击不再改状态（第二步
 * 归拖动手势——轴对称除外：定轴走本点击通道）。
 */
export function clickPickTransform(
  state: PickTransformState,
  ctx: PickTransformContext,
): PickTransformResult {
  if (state.kind === "idle") {
    if (ctx.document.space !== "2d") {
      return hold(state);
    }
    const hit = hitAt(ctx);
    if (hit === null) {
      return hold(state);
    }
    if (!transformable2dTypes.has(hit.type)) {
      return { state, commit: null, rejection: "not-transformable", preview: null };
    }
    return hold({ kind: "source", id: hit.id });
  }
  if (
    state.kind === "axis" ||
    (ctx.kind === "reflect" && state.kind === "source")
  ) {
    // 定轴态随行起始 kind（axis 即轴对称）：点击通道按状态分流，不读实时
    // 工具——定轴中换工具不改变本次提交的变换种类。
    return clickReflectAxis(state, ctx);
  }
  return hold(state);
}

/**
 * 第二步开始：已锁源后按下——平移从落格起点拖出位移向量（零向量暂无像
 * 可预览）；旋转/位似以落格按下点为中心，按下即出像（全程实时预览，
 * US 8），拖动微调中心、纯点击也是合法的「点中心一步定参」。轴对称
 * （票 04）不走本通道：定轴是两次点击，提交在 clickPickTransform——
 * 按下保持已锁源态，拖动留给悬停预览。
 */
export function startPickTransformStep(
  state: PickTransformState,
  ctx: PickTransformContext,
): PickTransformResult {
  if (ctx.kind === "reflect" || state.kind !== "source" ||
    lockedSource(ctx.document, state) === null
  ) {
    return hold(state);
  }
  const snapped = snap2d(ctx.point, ctx.grid);
  const next: PickTransformState =
    ctx.kind === "translate"
      ? { kind: "vector", id: state.id, start: snapped, cursor: snapped }
      : { kind: "center", centerKind: ctx.kind, id: state.id, center: snapped };
  return hold(next, imagePreview(ctx.document, next));
}

/** 拖动中：光标落格跟随（平移挪光标、旋转/位似挪中心），像实时预览
 *  （说明书不动）；定轴中（票 04）第一点已定、悬停光标即轴第二点，像与
 *  轴虚线预览、状态不动。 */
export function movePickTransform(
  state: PickTransformState,
  ctx: PickTransformContext,
): PickTransformResult {
  if (state.kind === "axis") {
    return hold(
      state,
      axisImagePreview(ctx.document, state, snap2d(ctx.point, ctx.grid)),
    );
  }
  if (state.kind !== "vector" && state.kind !== "center") {
    return hold(state);
  }
  const next = snapDragState(state, ctx.point, ctx.grid);
  return hold(next, imagePreview(ctx.document, next));
}

/**
 * 松手一次提交（一步 undo）。平移零位移不提交、退回已锁源状态（退化值不
 * 静默钳到端点，先例滑块零位移触碰）；旋转/位似的中心取值无退化（默认
 * 90°/比 2 非退化），点击即提交。源已消失则整体复位。
 */
export function upPickTransform(
  state: PickTransformState,
  ctx: PickTransformContext,
): PickTransformResult {
  if (state.kind !== "vector" && state.kind !== "center") {
    return hold(state);
  }
  const released = snapDragState(state, ctx.point, ctx.grid);
  if (lockedSource(ctx.document, released) === null) {
    return hold(idlePickTransformState());
  }
  const params = draggingParamsOf(released);
  if (params.kind === "translate" && params.dx === 0 && params.dy === 0) {
    return hold({ kind: "source", id: state.id });
  }
  return commitResult(ctx, state.id, params);
}

/** Escape 取消：两步任意状态回到 idle，预览清空。 */
export function escPickTransform(
  state: PickTransformState,
): PickTransformResult {
  return hold(idlePickTransformState());
}
