<script setup lang="ts">
import { useEventListener, useResizeObserver } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { onMounted, onUnmounted, ref, watch } from "vue";
import { type GridSnap, type Point2 } from "../document/index.ts";
import {
  moveControlPoint,
  rotatePrimitive,
  scalePrimitive,
  translatePrimitive,
} from "../document/update-document.ts";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";
import { isTypingTarget } from "../components/tool-shortcuts.ts";
import {
  clickDraw,
  escDraw,
  idleDrawState,
  isDragDrawTool,
  isDrawTool,
  moveDraw,
  startDraw,
  upDraw,
  type DrawContext,
  type DrawGestureResult,
  type DrawGestureState,
  type DrawPreview,
} from "./draw-gesture.ts";
import {
  clickPickOverlap,
  idlePickOverlapState,
  type PickOverlapResult,
  type PickOverlapState,
} from "./pick-overlap-gesture.ts";
import { clickPickMeasure, measureKindForTool } from "./pick-measure-gesture.ts";
import {
  SELECTION_STROKE,
  sourcesIntersect,
  type PreviewMark,
} from "./draw-primitives.ts";
import { controlPoints } from "./control-points.ts";
import { hitCandidates } from "../document/index.ts";
import {
  createViewport2dProjector,
  type Viewport2dProjector,
} from "./projector.ts";
import {
  clickSelect,
  escSelect,
  idleSelectState,
  moveSelect,
  selectPreview,
  startSelect,
  transformHandles,
  upSelect,
  type SelectCommit,
  type SelectContext,
  type SelectGestureResult,
  type SelectGestureState,
} from "./select-gesture.ts";

/** 命中容差（屏幕像素），换算成世界单位后传给命中测试，让细线可点。 */
const HIT_TOLERANCE_PX = 6;
/** 柄命中半径（屏幕像素）：柄方块 10px，命中圈同尺寸。 */
const HANDLE_HIT_PX = 10;
/** 控制点命中半径（屏幕像素）：控制点小圆 8px，命中圈略大更好抓。 */
const CONTROL_HIT_PX = 10;
/** 拖旋转柄/缩放柄时的光标，与柄悬停光标一致。 */
const HANDLE_CURSORS = { rotate: "alias", scale: "ew-resize" } as const;
/** 控制点悬停与拖动光标：与柄（alias/ew-resize）、本体（grab）三者可区分。 */
const CONTROL_CURSOR = "move";

const hostRef = ref<HTMLDivElement | null>(null);
const rotateHandleScreen = ref<Point2 | null>(null);
const scaleHandleScreen = ref<Point2 | null>(null);
const controlPointScreens = ref<{ id: string; point: Point2 }[]>([]);
const documentStore = useDocumentStore();
const editor = useEditorStore();
const { t } = useI18n();
let projector: Viewport2dProjector | null = null;
let gesture: DrawGestureState = idleDrawState();
let selectGesture: SelectGestureState = idleSelectState();
let pickOverlap: PickOverlapState = idlePickOverlapState();
let dragStart: Point2 | null = null;
let dragDistance = 0;
let panSuppressed = false;
// 同点循环选择：记上次点击位置与按下前的选中，连点时在候选列表里逐个换选。
let lastClickScreen: Point2 | null = null;
let selectionBeforeDown: string | null = null;

function gridForEvent(event: PointerEvent | MouseEvent): GridSnap {
  if (event.altKey) {
    return "off";
  }
  return editor.grid;
}

function eventWorld(event: PointerEvent | MouseEvent): Point2 | null {
  const host = hostRef.value;
  if (host === null || projector === null) return null;
  const rect = host.getBoundingClientRect();
  return projector.toWorld({
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  });
}

/** 正交视口无旋转：每个屏幕像素对应的世界长度，按水平采样换算。 */
function worldPerPx(): number {
  if (projector === null) return 0;
  const origin = projector.toWorld({ x: 0, y: 0 });
  const unit = projector.toWorld({ x: 100, y: 0 });
  const value = Math.hypot(unit.x - origin.x, unit.y - origin.y) / 100;
  return value === 0 ? 0 : value;
}

function hitToleranceWorld(): number {
  return HIT_TOLERANCE_PX * worldPerPx();
}

function handleToleranceWorld(): number {
  return HANDLE_HIT_PX * worldPerPx();
}

function controlToleranceWorld(): number {
  return CONTROL_HIT_PX * worldPerPx();
}

/** 从 toWorld 反解世界→屏幕：screen = (world - origin) / 每像素世界增量。 */
function worldToScreen(point: Point2): Point2 | null {
  if (projector === null) return null;
  const origin = projector.toWorld({ x: 0, y: 0 });
  const step = projector.toWorld({ x: 1, y: 1 });
  const perPxX = step.x - origin.x;
  const perPxY = step.y - origin.y;
  if (perPxX === 0 || perPxY === 0) return null;
  return {
    x: (point.x - origin.x) / perPxX,
    y: (point.y - origin.y) / perPxY,
  };
}

function selectContext(event: PointerEvent | MouseEvent): SelectContext | null {
  const point = eventWorld(event);
  if (point === null) return null;
  return {
    tool: "select",
    document: documentStore.current,
    point,
    grid: gridForEvent(event),
    tolerance: hitToleranceWorld(),
    selectionId: editor.selectionId,
    handleTolerance: handleToleranceWorld(),
    controlTolerance: controlToleranceWorld(),
  };
}

/** 把一次手势的变换写进说明书：平移与控制点吃格，旋转缩放直接写角度与因子。 */
function commitTransform(commit: SelectCommit, grid: GridSnap): void {
  const current = documentStore.current;
  const transformed =
    commit.kind === "translate"
      ? translatePrimitive(current, commit.id, commit.dx, commit.dy, grid)
      : commit.kind === "rotate"
        ? rotatePrimitive(current, commit.id, commit.deg)
        : commit.kind === "scale"
          ? scalePrimitive(current, commit.id, commit.factor)
          : moveControlPoint(
              current,
              commit.id,
              commit.pointId,
              commit.point,
              grid,
            );
  if (!transformed.success) return;
  const moved = transformed.document.primitives.find(
    (primitive) => primitive.id === commit.id,
  );
  if (moved !== undefined) {
    documentStore.updatePrimitive(commit.id, moved);
  }
}

function selectionMark(): PreviewMark {
  return selectPreview(documentStore.current, editor.selectionId);
}

/** 选中标记统一上屏：强调色让「选中了哪条」一眼可辨（含拾取态第一源高亮）。 */
function showSelectionMark(mark: PreviewMark): void {
  projector?.setPreview(mark, SELECTION_STROKE);
}

/** 柄与控制点只在选择工具、有选中、无手势时出现；位置随视图换算更新。 */
function refreshOverlays(): void {
  let rotate: Point2 | null = null;
  let scale: Point2 | null = null;
  let controls: { id: string; point: Point2 }[] = [];
  const document = documentStore.current;
  const selectionId = editor.selectionId;
  if (
    projector !== null &&
    (editor.tool === "select" || editor.tool === null) &&
    selectGesture.kind === "idle" &&
    selectionId !== null &&
    document.space === "2d"
  ) {
    const primitive = document.primitives.find(
      (item) => item.id === selectionId,
    );
    if (primitive !== undefined) {
      const handles = transformHandles(primitive, handleToleranceWorld());
      if (handles !== null) {
        rotate = handles.rotate === null ? null : worldToScreen(handles.rotate);
        scale = worldToScreen(handles.scale);
      }
      controls = controlPoints(primitive).flatMap((point) => {
        const screen = worldToScreen(point.point);
        return screen === null ? [] : [{ id: point.id, point: screen }];
      });
    }
  }
  rotateHandleScreen.value = rotate;
  scaleHandleScreen.value = scale;
  controlPointScreens.value = controls;
}

function refreshSelectionMark(): void {
  refreshOverlays();
  if (projector === null) return;
  if (editor.tool === "overlapFill") {
    // 拾取态的预览（第一源高亮）随视图换算重画。
    showSelectionMark(pickOverlapPreview());
    return;
  }
  if (isDrawTool(editor.tool) || selectGesture.kind !== "idle") return;
  showSelectionMark(selectionMark());
}

/** 拖柄/控制点期间宿主光标保持控件语义，结束回到选择工具的 grab。 */
function syncHandleCursor(): void {
  const host = hostRef.value;
  if (host === null) return;
  if (selectGesture.kind === "rotate") {
    host.style.cursor = HANDLE_CURSORS.rotate;
    return;
  }
  if (selectGesture.kind === "scale") {
    host.style.cursor = HANDLE_CURSORS.scale;
    return;
  }
  if (selectGesture.kind === "control") {
    host.style.cursor = CONTROL_CURSOR;
    return;
  }
  host.style.cursor = "grab";
}

function applySelectGesture(result: SelectGestureResult, grid: GridSnap): void {
  selectGesture = result.state;
  if (result.selectionId !== undefined) {
    editor.setSelectionId(result.selectionId);
  }
  if (result.commit !== null) {
    commitTransform(result.commit, grid);
  }
  // 手势自带预览（拖动变换）用默认色；回落到选中标记时用强调色。
  if (result.preview === null) {
    showSelectionMark(selectionMark());
  } else {
    projector?.setPreview(result.preview);
  }
  refreshOverlays();
  syncHandleCursor();
}

function drawContext(
  event: PointerEvent | MouseEvent,
  id = crypto.randomUUID(),
): DrawContext | null {
  const tool = editor.tool;
  if (!isDrawTool(tool)) return null;
  const point = eventWorld(event);
  if (point === null) return null;
  const labelTexts = documentStore.current.primitives.flatMap((primitive) =>
    primitive.type === "label" ? [primitive.text] : [],
  );
  return { tool, point, grid: gridForEvent(event), id, labelTexts };
}

/** 提交一条新图元：成功才选中它并切回选择（ADR 0018 画完即回选择）。 */
function commitPrimitive(primitive: Parameters<typeof documentStore.addPrimitive>[0]): void {
  const added = documentStore.addPrimitive(primitive);
  if (added.success) {
    editor.setSelectionId(primitive.id);
    // ADR 0018：画完即回选择，刚画的图元保持选中可立即调整。
    editor.setTool("select");
  }
}

function applyGesture(result: DrawGestureResult): void {
  gesture = result.state;
  projector?.setPreview(result.preview);
  if (result.commit === null) return;
  commitPrimitive(result.commit);
}

function cancelPreview(): void {
  applyGesture(escDraw(gesture));
}

/** 重叠填充两步拾取：进度/契约拒绝提示（模板直读），第一拾取高亮复用选中标记画法。 */
const pickHint = ref<string | null>(null);

function pickOverlapPreview(): PreviewMark {
  return pickOverlap.kind === "first"
    ? selectPreview(documentStore.current, pickOverlap.id)
    : selectionMark();
}

function resetPickOverlap(): void {
  pickOverlap = idlePickOverlapState();
  pickHint.value = null;
}

function applyPickHint(state: PickOverlapState, rejection: string | null): void {
  if (rejection === "not-fillable") {
    pickHint.value = t("pickHint.notFillable");
  } else if (rejection === "same-source") {
    pickHint.value = t("pickHint.sameSource");
  } else if (rejection === "no-intersection") {
    pickHint.value = t("pickHint.noIntersection");
  } else {
    pickHint.value =
      state.kind === "first" ? t("pickHint.first") : null;
  }
}

function handlePickOverlapClick(event: MouseEvent): void {
  const point = eventWorld(event);
  if (point === null) return;
  const result = clickPickOverlap(
    pickOverlap,
    {
      document: documentStore.current,
      point,
      tolerance: hitToleranceWorld(),
      id: crypto.randomUUID(),
    },
    sourcesIntersect,
  );
  pickOverlap = result.state;
  applyPickHint(result.state, result.rejection);
  if (result.commit !== null) {
    // 成功分支里提交并回选择；工具切换的 watch 会复位拾取态与预览。
    commitPrimitive(result.commit);
    return;
  }
  showSelectionMark(pickOverlapPreview());
}

/** 度量标注拾取（面积/周长同构）：单步点白名单源即挂标注（ADR 0020），
 *  拒绝给提示不切工具。 */
function handlePickMeasureClick(event: MouseEvent): void {
  const kind = measureKindForTool(editor.tool);
  if (kind === null) return;
  const point = eventWorld(event);
  if (point === null) return;
  const result = clickPickMeasure(
    {
      document: documentStore.current,
      point,
      tolerance: hitToleranceWorld(),
      id: crypto.randomUUID(),
    },
    kind,
  );
  if (result.rejection === "not-measurable") {
    pickHint.value = t("pickHint.notMeasurable");
    return;
  }
  if (result.commit !== null) {
    // 提交并回选择；工具切换的 watch 会清掉提示。
    commitPrimitive(result.commit);
    return;
  }
  pickHint.value = null;
}

onMounted(() => {
  const host = hostRef.value;
  if (host === null) return;
  projector = createViewport2dProjector(host);
  projector.setTool(editor.tool);
  projector.render(documentStore.current);
  projector.setSessionUnderlay(editor.sessionUnderlay);
  const { width, height } = host.getBoundingClientRect();
  if (width > 0 && height > 0) {
    projector.resize(width, height);
  }
  refreshSelectionMark();
});

useResizeObserver(hostRef, (entries) => {
  const entry = entries[0];
  if (entry === undefined || projector === null) return;
  const { width, height } = entry.contentRect;
  projector.resize(width, height);
  refreshSelectionMark();
});

// 滚轮缩放后选中标记要跟着新的视图换算重画。
useEventListener(
  hostRef,
  "wheel",
  () => {
    refreshSelectionMark();
  },
  { passive: true },
);

watch(
  () => documentStore.current,
  (document) => {
    projector?.render(document);
    if (
      editor.selectionId !== null &&
      !document.primitives.some(
        (primitive) => primitive.id === editor.selectionId,
      )
    ) {
      editor.setSelectionId(null);
    }
    refreshSelectionMark();
  },
);

watch(
  () => editor.selectionId,
  () => {
    refreshSelectionMark();
  },
);

watch(
  () => editor.tool,
  (tool) => {
    cancelPreview();
    selectGesture = idleSelectState();
    resetPickOverlap();
    projector?.setTool(tool);
    refreshSelectionMark();
  },
);

watch(
  () => editor.sessionUnderlay,
  (underlay) => {
    projector?.setSessionUnderlay(underlay);
  },
);

useEventListener(hostRef, "pointerdown", (event: PointerEvent) => {
  if (event.button !== 0) return;
  dragStart = { x: event.clientX, y: event.clientY };
  dragDistance = 0;
  if (editor.tool === "select" || editor.tool === null) {
    const context = selectContext(event);
    if (context === null) return;
    selectionBeforeDown = editor.selectionId;
    applySelectGesture(startSelect(selectGesture, context), context.grid);
    // 任一选择手势（本体/柄/控制点）期间压制投影器的空白平移手势。
    panSuppressed = selectGesture.kind !== "idle";
    return;
  }
  const context = drawContext(event);
  if (context === null || !isDragDrawTool(context.tool)) return;
  applyGesture(startDraw(gesture, context));
});

// pointerdown 先于 mousedown 派发：capture 阶段拦下这次按下，投影器就不会平移视口。
useEventListener(
  hostRef,
  "mousedown",
  (event: MouseEvent) => {
    if (!panSuppressed) return;
    panSuppressed = false;
    if (event.button === 0) {
      event.stopPropagation();
    }
  },
  { capture: true },
);

useEventListener(window, "pointermove", (event: PointerEvent) => {
  if (dragStart !== null) {
    dragDistance = Math.hypot(
      event.clientX - dragStart.x,
      event.clientY - dragStart.y,
    );
  }
  if (selectGesture.kind !== "idle") {
    const context = selectContext(event);
    if (context !== null) {
      applySelectGesture(moveSelect(selectGesture, context), context.grid);
    }
    return;
  }
  if (gesture.kind === "idle") {
    // 空白按住拖动是投影器在平移视口：标记随视图换算重画。
    if (dragStart !== null) {
      refreshSelectionMark();
    }
    return;
  }
  const context = drawContext(event);
  if (context === null) return;
  applyGesture(moveDraw(gesture, context));
});

useEventListener(window, "pointerup", (event: PointerEvent) => {
  if (event.button !== 0) return;
  panSuppressed = false;
  if (selectGesture.kind !== "idle") {
    const context = selectContext(event);
    const result =
      context === null
        ? escSelect(selectGesture)
        : upSelect(selectGesture, context);
    applySelectGesture(result, context?.grid ?? editor.grid);
    dragStart = null;
    return;
  }
  if (
    gesture.kind === "line" ||
    gesture.kind === "rectangle" ||
    gesture.kind === "box" ||
    gesture.kind === "circle" ||
    gesture.kind === "regularPolygon" ||
    gesture.kind === "ellipse" ||
    gesture.kind === "ring"
  ) {
    const context = drawContext(event);
    if (context !== null) {
      applyGesture(upDraw(gesture, context));
    }
  }
  dragStart = null;
});

useEventListener(hostRef, "click", (event: MouseEvent) => {
  if (dragDistance > 4) return;
  if (editor.tool === "overlapFill") {
    handlePickOverlapClick(event);
    return;
  }
  if (measureKindForTool(editor.tool) !== null) {
    handlePickMeasureClick(event);
    return;
  }
  if (isDrawTool(editor.tool)) {
    if (!isDragDrawTool(editor.tool)) {
      const context = drawContext(event);
      if (context !== null) {
        applyGesture(clickDraw(gesture, context));
      }
    }
    return;
  }

  const context = selectContext(event);
  if (context === null) return;
  context.preferId = cyclePreferId(event, context);
  lastClickScreen = { x: event.clientX, y: event.clientY };
  applySelectGesture(clickSelect(selectGesture, context), context.grid);
});

/**
 * 同点循环：同一位置连点（≤4px，与拖动判定阈值一致）且按下前的选中在该点
 * 候选列表里，就换选下一个候选（环绕）。首次点击或换位置不干预——
 * clickSelect 无 preferId 时走 hitTest 胜者的现行行为。
 */
function cyclePreferId(event: MouseEvent, context: SelectContext): string | undefined {
  const sameSpot = lastClickScreen !== null &&
    Math.hypot(
      event.clientX - lastClickScreen.x,
      event.clientY - lastClickScreen.y,
    ) <= 4;
  if (!sameSpot || selectionBeforeDown === null) return undefined;
  const candidates = hitCandidates(
    context.document,
    context.point,
    context.tolerance ?? 0,
  );
  const current = candidates.findIndex(
    (candidate) => candidate.id === selectionBeforeDown,
  );
  if (current < 0) return undefined;
  return candidates[(current + 1) % candidates.length]?.id;
}

useEventListener(window, "keydown", (event: KeyboardEvent) => {
  if (isTypingTarget(event.target)) return;

  if (event.key === "Escape") {
    cancelPreview();
    applySelectGesture(escSelect(selectGesture), editor.grid);
    if (editor.tool === "overlapFill") {
      resetPickOverlap();
      showSelectionMark(pickOverlapPreview());
    }
    if (measureKindForTool(editor.tool) !== null) {
      pickHint.value = null;
    }
    return;
  }

  if (event.key !== "Delete" && event.key !== "Backspace") return;
  if (gesture.kind !== "idle" || selectGesture.kind !== "idle") return;
  const id = editor.selectionId;
  if (id === null) return;
  event.preventDefault();
  const removed = documentStore.removePrimitive(id);
  if (removed.success) {
    editor.setSelectionId(null);
  }
});

onUnmounted(() => {
  projector?.destroy();
  projector = null;
});
</script>

<template>
  <div class="relative h-full min-h-0 w-full">
    <!-- 提示条不进宿主容器：Konva 舞台 div 是命令式插进去的，Vue 不能在
         同一容器里增删兄弟节点（否则 patch 锚点错乱，ADR 0008 的边界）。 -->
    <div
      v-if="pickHint !== null"
      class="pointer-events-none absolute bottom-2 left-2 z-20 rounded bg-zinc-900/85 px-2 py-1 text-xs text-white"
      data-pick-hint
    >
      {{ pickHint }}
    </div>
    <div
      ref="hostRef"
      class="relative h-full min-h-0 w-full overflow-hidden bg-white"
      data-viewport-2d
    >
    <!-- 控制点与变换手柄层：容器不接事件，只有控件本身可点，不会挡住底下的视口平移。 -->
    <div class="pointer-events-none absolute inset-0 z-10">
      <div
        v-for="control in controlPointScreens"
        :key="control.id"
        class="pointer-events-auto absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-indigo-500 bg-white shadow-[0_1px_4px_rgba(99,102,241,0.45)]"
        :style="{
          left: `${control.point.x}px`,
          top: `${control.point.y}px`,
          cursor: CONTROL_CURSOR,
        }"
        :data-control-point="control.id"
      />
      <div
        v-show="rotateHandleScreen !== null"
        class="pointer-events-auto absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-indigo-500 bg-white shadow-[0_1px_4px_rgba(99,102,241,0.45)]"
        :style="{
          left: `${rotateHandleScreen?.x ?? 0}px`,
          top: `${rotateHandleScreen?.y ?? 0}px`,
          cursor: HANDLE_CURSORS.rotate,
        }"
        data-rotate-handle
      />
      <div
        v-show="scaleHandleScreen !== null"
        class="pointer-events-auto absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-indigo-500 bg-white shadow-[0_1px_4px_rgba(99,102,241,0.45)]"
        :style="{
          left: `${scaleHandleScreen?.x ?? 0}px`,
          top: `${scaleHandleScreen?.y ?? 0}px`,
          cursor: HANDLE_CURSORS.scale,
        }"
        data-scale-handle
      />
    </div>
    </div>
  </div>
</template>
