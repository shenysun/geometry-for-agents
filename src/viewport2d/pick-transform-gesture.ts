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

/** 已落地的变换种类：平移/旋转/位似（票 02/03），轴对称由票 04 补齐。 */
export type ImplementedTransformKind = "translate" | "rotate" | "dilate";

/** 第二步以中心定参的两种变换：按下即中心、拖动微调、松手提交。 */
export type CenterKind = Extract<ImplementedTransformKind, "rotate" | "dilate">;

/** 创建手势的默认参数（spec Further Notes：常见题面取值，可调、非契约内容）。
 *  角度存储保留符号约定（正为逆时针），显示归一到 0–360° 属属性面板（票 05）。 */
export const ROTATE_DEFAULT_ANGLE_DEG = 90;
export const DILATE_DEFAULT_RATIO = 2;

export type PickTransformRejection = "not-transformable";

/** 两步拾取的状态：未开始、已锁源、第二步进行中——平移拖位移向量，
 *  旋转/位似拖中心（拖动即微调中心，松手按默认角度/比提交）。center 态
 *  随行起始工具的变换种类：kind 由创建工具定死、事后不改（spec 渲染条），
 *  拖动中换工具不改变本次提交。 */
export type PickTransformState =
  | { kind: "idle" }
  | { kind: "source"; id: string }
  | { kind: "vector"; id: string; start: Point2; cursor: Point2 }
  | { kind: "center"; centerKind: CenterKind; id: string; center: Point2 };

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

/** 变换工具 id → 变换种类（ADR 0022）：M 平移、E 旋转、Shift+E 位似；
 *  非变换工具返回 null。kind 由创建工具定死、事后不改（函数曲线先例）。 */
export function transformKindForTool(
  tool: EditorTool,
): ImplementedTransformKind | null {
  if (tool === "translate") return "translate";
  if (tool === "rotate") return "rotate";
  if (tool === "dilate") return "dilate";
  return null;
}

/** 已锁源（或拖动中）的源图元：不存在或掉出白名单时返回 null。 */
function lockedSource(
  document: GeometryDocument,
  state: Extract<PickTransformState, { kind: "source" | "vector" | "center" }>,
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

/**
 * 第二步开始：已锁源后按下——平移从落格起点拖出位移向量（零向量暂无像
 * 可预览）；旋转/位似以落格按下点为中心，按下即出像（全程实时预览，
 * US 8），拖动微调中心、纯点击也是合法的「点中心一步定参」。
 */
export function startPickTransformStep(
  state: PickTransformState,
  ctx: PickTransformContext,
): PickTransformResult {
  if (state.kind !== "source" || lockedSource(ctx.document, state) === null) {
    return { state, commit: null, rejection: null, preview: null };
  }
  const snapped = snap2d(ctx.point, ctx.grid);
  const next: PickTransformState =
    ctx.kind === "translate"
      ? { kind: "vector", id: state.id, start: snapped, cursor: snapped }
      : { kind: "center", centerKind: ctx.kind, id: state.id, center: snapped };
  return {
    state: next,
    commit: null,
    rejection: null,
    preview: imagePreview(ctx.document, next),
  };
}

/** 拖动中：光标落格跟随（平移挪光标、旋转/位似挪中心），像实时预览（说明书不动）。 */
export function movePickTransform(
  state: PickTransformState,
  ctx: PickTransformContext,
): PickTransformResult {
  if (state.kind !== "vector" && state.kind !== "center") {
    return { state, commit: null, rejection: null, preview: null };
  }
  const next = snapDragState(state, ctx.point, ctx.grid);
  return {
    state: next,
    commit: null,
    rejection: null,
    preview: imagePreview(ctx.document, next),
  };
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
    return { state, commit: null, rejection: null, preview: null };
  }
  const released = snapDragState(state, ctx.point, ctx.grid);
  if (lockedSource(ctx.document, released) === null) {
    return {
      state: idlePickTransformState(),
      commit: null,
      rejection: null,
      preview: null,
    };
  }
  const params = draggingParamsOf(released);
  if (params.kind === "translate" && params.dx === 0 && params.dy === 0) {
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
