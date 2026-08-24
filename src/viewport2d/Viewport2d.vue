<script setup lang="ts">
import { useEventListener, useResizeObserver } from "@vueuse/core";
import { onMounted, onUnmounted, ref, watch } from "vue";
import {
  type GridSnap,
  type Point2,
} from "../document/index.ts";
import {
  moveControlPoint,
  rotatePrimitive,
  scalePrimitive,
  translatePrimitive,
} from "../document/update-document.ts";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";
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
import { controlPoints } from "./control-points.ts";
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
let projector: Viewport2dProjector | null = null;
let gesture: DrawGestureState = idleDrawState();
let selectGesture: SelectGestureState = idleSelectState();
let dragStart: Point2 | null = null;
let dragDistance = 0;
let panSuppressed = false;

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

function selectionMark(): DrawPreview {
  return selectPreview(documentStore.current, editor.selectionId);
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
        rotate =
          handles.rotate === null ? null : worldToScreen(handles.rotate);
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
  if (isDrawTool(editor.tool) || selectGesture.kind !== "idle") return;
  projector.setPreview(selectionMark());
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

function applySelectGesture(
  result: SelectGestureResult,
  grid: GridSnap,
): void {
  selectGesture = result.state;
  if (result.selectionId !== undefined) {
    editor.setSelectionId(result.selectionId);
  }
  if (result.commit !== null) {
    commitTransform(result.commit, grid);
  }
  projector?.setPreview(result.preview ?? selectionMark());
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

function applyGesture(result: DrawGestureResult): void {
  gesture = result.state;
  projector?.setPreview(result.preview);
  if (result.commit === null) return;
  const added = documentStore.addPrimitive(result.commit);
  if (added.success) {
    editor.setSelectionId(result.commit.id);
  }
}

function cancelPreview(): void {
  applyGesture(escDraw(gesture));
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
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
      !document.primitives.some((primitive) => primitive.id === editor.selectionId)
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
    gesture.kind === "circle" ||
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
  applySelectGesture(clickSelect(selectGesture, context), context.grid);
});

useEventListener(window, "keydown", (event: KeyboardEvent) => {
  if (isTypingTarget(event.target)) return;

  if (event.key === "Escape") {
    cancelPreview();
    applySelectGesture(escSelect(selectGesture), editor.grid);
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
        class="pointer-events-auto absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-700 bg-white"
        :style="{
          left: `${control.point.x}px`,
          top: `${control.point.y}px`,
          cursor: CONTROL_CURSOR,
        }"
        :data-control-point="control.id"
      />
      <div
        v-show="rotateHandleScreen !== null"
        class="pointer-events-auto absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-700 bg-white"
        :style="{
          left: `${rotateHandleScreen?.x ?? 0}px`,
          top: `${rotateHandleScreen?.y ?? 0}px`,
          cursor: HANDLE_CURSORS.rotate,
        }"
        data-rotate-handle
      />
      <div
        v-show="scaleHandleScreen !== null"
        class="pointer-events-auto absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-zinc-700 bg-white"
        :style="{
          left: `${scaleHandleScreen?.x ?? 0}px`,
          top: `${scaleHandleScreen?.y ?? 0}px`,
          cursor: HANDLE_CURSORS.scale,
        }"
        data-scale-handle
      />
    </div>
  </div>
</template>
