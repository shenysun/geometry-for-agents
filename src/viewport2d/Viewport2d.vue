<script setup lang="ts">
import { useEventListener, useResizeObserver } from "@vueuse/core";
import { onMounted, onUnmounted, ref, watch } from "vue";
import {
  type GridSnap,
  type Point2,
} from "../document/index.ts";
import { translatePrimitive } from "../document/update-document.ts";
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
  upSelect,
  type SelectContext,
  type SelectGestureResult,
  type SelectGestureState,
} from "./select-gesture.ts";

/** 命中容差（屏幕像素），换算成世界单位后传给命中测试，让细线可点。 */
const HIT_TOLERANCE_PX = 6;

const hostRef = ref<HTMLDivElement | null>(null);
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

/** 正交视口下按水平采样把像素容差换算成世界单位。 */
function hitToleranceWorld(): number {
  if (projector === null) return 0;
  const origin = projector.toWorld({ x: 0, y: 0 });
  const unit = projector.toWorld({ x: 100, y: 0 });
  const worldPerPx = Math.hypot(unit.x - origin.x, unit.y - origin.y) / 100;
  return worldPerPx === 0 ? 0 : HIT_TOLERANCE_PX * worldPerPx;
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
  };
}

function commitTranslate(
  commit: { id: string; dx: number; dy: number },
  grid: GridSnap,
): void {
  const translated = translatePrimitive(
    documentStore.current,
    commit.id,
    commit.dx,
    commit.dy,
    grid,
  );
  if (!translated.success) return;
  const moved = translated.document.primitives.find(
    (primitive) => primitive.id === commit.id,
  );
  if (moved !== undefined) {
    documentStore.updatePrimitive(commit.id, moved);
  }
}

function selectionMark(): DrawPreview {
  return selectPreview(documentStore.current, editor.selectionId);
}

function refreshSelectionMark(): void {
  if (projector === null) return;
  if (isDrawTool(editor.tool) || selectGesture.kind !== "idle") return;
  projector.setPreview(selectionMark());
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
    commitTranslate(result.commit, grid);
  }
  projector?.setPreview(result.preview ?? selectionMark());
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
    // 拖图元本体时压制投影器的空白平移手势。
    panSuppressed = selectGesture.kind === "drag";
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
  if (selectGesture.kind === "drag") {
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
  if (selectGesture.kind === "drag") {
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
    class="h-full min-h-0 w-full overflow-hidden bg-white"
    data-viewport-2d
  />
</template>
