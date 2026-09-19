import { watch, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { selectPreview } from "./select-gesture.ts";
import type { PreviewMark } from "./draw-primitives.ts";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";
import type {
  GridSnap,
  Point2,
  Primitive,
} from "../document/index.ts";
import type { FunctionCurveViewport } from "../document/function-curve.ts";
import type { Viewport2dProjector } from "./projector.ts";
import {
  clickPickTransform,
  escPickTransform,
  idlePickTransformState,
  movePickTransform,
  startPickTransformStep,
  transformKindForTool,
  upPickTransform,
  type ImplementedTransformKind,
  type PickTransformContext,
  type PickTransformResult,
  type PickTransformState,
} from "./pick-transform-gesture.ts";

/** 已锁源后的下一步提示：按变换种类分流（平移拖向量、旋转/位似点中心）。 */
const SOURCE_HINT_KEY: Record<ImplementedTransformKind, string> = {
  translate: "pickHint.transformSource",
  rotate: "pickHint.rotateCenter",
  dilate: "pickHint.dilateCenter",
};

/**
 * 变换两步拾取的视口接线（ADR 0022，票 02/03）：纯状态机在
 * pick-transform-gesture.ts，本组合式只持接线胶水——上下文拼装、提示
 * 文案、预览上屏、事件路由。轴对称 tracer（票 04）在同一骨架上补工具
 * 与状态，胶水在此单点扩展。
 */
export function usePickTransformGesture(deps: {
  /** 指针事件 → 世界坐标（视口本地换算）。 */
  eventWorld: (event: PointerEvent | MouseEvent) => Point2 | null;
  /** 指针事件 → 落格设置（Alt 暂不落格在此折算成 "off"）。 */
  gridForEvent: (event: PointerEvent | MouseEvent) => GridSnap;
  hitToleranceWorld: () => number;
  worldPerPx: () => number;
  curveViewport: () => FunctionCurveViewport | null;
  projector: () => Viewport2dProjector | null;
  /** 提交新图元的唯一入口（成功才选中并回选择，ADR 0018）。 */
  commitPrimitive: (primitive: Primitive) => void;
  /** 源高亮上屏（强调色选中标记画法）。 */
  showSelectionMark: (mark: PreviewMark) => void;
  /** 拾取提示条（与重叠填充/度量标注共用同一条）。 */
  pickHint: Ref<string | null>;
}) {
  const documentStore = useDocumentStore();
  const editor = useEditorStore();
  const { t } = useI18n();
  let state: PickTransformState = idlePickTransformState();

  function enabled(): boolean {
    return transformKindForTool(editor.tool) !== null;
  }

  function context(
    event: PointerEvent | MouseEvent,
  ): PickTransformContext | null {
    const kind = transformKindForTool(editor.tool);
    if (kind === null) return null;
    const point = deps.eventWorld(event);
    if (point === null) return null;
    return {
      document: documentStore.current,
      point,
      tolerance: deps.hitToleranceWorld(),
      worldPerPx: deps.worldPerPx(),
      curveViewport: deps.curveViewport(),
      grid: deps.gridForEvent(event),
      id: crypto.randomUUID(),
      kind,
    };
  }

  function apply(result: PickTransformResult): void {
    state = result.state;
    if (result.rejection === "not-transformable") {
      deps.pickHint.value = t("pickHint.notTransformable");
    } else {
      const kind = transformKindForTool(editor.tool);
      deps.pickHint.value =
        result.state.kind === "source" && kind !== null
          ? t(SOURCE_HINT_KEY[kind])
          : null;
    }
    // 提交分支也先清预览（applyGesture 同例）：不让最后一次拖动预览的
    // 虚线像残留到提交后的画面。
    deps.projector()?.setPreview(result.preview);
    if (result.commit !== null) {
      deps.commitPrimitive(result.commit);
      return;
    }
    if (result.state.kind === "source") {
      deps.showSelectionMark(sourceMark());
    }
  }

  /** 已锁源的高亮标记；未锁源返回 undefined（区别于「无标记」的 null）。 */
  function sourceMark(): PreviewMark {
    return state.kind === "source"
      ? selectPreview(documentStore.current, state.id)
      : null;
  }

  /** 拾取态源 id：视口重画（平移缩放）时据此重画源高亮。 */
  function activeSourceId(): string | null {
    return state.kind === "source" ? state.id : null;
  }

  /** 是否正在第二步拖动（拖向量或拖中心）：视口指针路由的判据。 */
  function activeDrag(): boolean {
    return state.kind === "vector" || state.kind === "center";
  }

  /** 第一步：点击锁定源（拒绝给提示不切工具）。 */
  function handleClick(event: MouseEvent): void {
    const ctx = context(event);
    if (ctx === null) return;
    apply(clickPickTransform(state, ctx));
  }

  /** 第二步开始：已锁源后按下——平移拖位移向量，旋转/位似点中心。 */
  function handlePointerDown(event: PointerEvent): void {
    const ctx = context(event);
    if (ctx !== null && state.kind === "source") {
      apply(startPickTransformStep(state, ctx));
    }
  }

  /** 拖动中：像实时预览，说明书不动（ADR 0007）。 */
  function handlePointerMove(event: PointerEvent): void {
    if (!activeDrag()) return;
    const ctx = context(event);
    if (ctx !== null) {
      apply(movePickTransform(state, ctx));
    }
  }

  /** 松手一次提交（一步 undo）；平移零位移退回已锁源态。 */
  function handlePointerUp(event: PointerEvent): void {
    if (!activeDrag()) return;
    const ctx = context(event);
    apply(ctx === null ? escPickTransform(state) : upPickTransform(state, ctx));
  }

  /** Escape / 工具切换：回到 idle、清提示与预览。 */
  function reset(): void {
    state = idlePickTransformState();
    deps.pickHint.value = null;
    deps.projector()?.setPreview(null);
  }

  // 工具切换复位拾取态与预览（overlapFill 同例）。
  watch(
    () => editor.tool,
    () => {
      if (state.kind !== "idle") {
        reset();
      }
    },
  );

  return {
    handleClick,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    reset,
    enabled,
    activeSourceId,
    activeDrag,
    sourceMark,
  };
}
