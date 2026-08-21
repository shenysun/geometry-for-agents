<script setup lang="ts">
import { useEventListener, useResizeObserver } from "@vueuse/core";
import { onMounted, onUnmounted, ref, watch } from "vue";
import {
  hitTest,
  type GridSnap,
  type Point2,
} from "../document/index.ts";
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
} from "./draw-gesture.ts";
import {
  createViewport2dProjector,
  type Viewport2dProjector,
} from "./projector.ts";

const hostRef = ref<HTMLDivElement | null>(null);
const documentStore = useDocumentStore();
const editor = useEditorStore();
let projector: Viewport2dProjector | null = null;
let gesture: DrawGestureState = idleDrawState();
let dragStart: Point2 | null = null;
let dragDistance = 0;

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
});

useResizeObserver(hostRef, (entries) => {
  const entry = entries[0];
  if (entry === undefined || projector === null) return;
  const { width, height } = entry.contentRect;
  projector.resize(width, height);
});

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
  },
);

watch(
  () => editor.tool,
  (tool) => {
    cancelPreview();
    projector?.setTool(tool);
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
  const context = drawContext(event);
  if (context === null || !isDragDrawTool(context.tool)) return;
  applyGesture(startDraw(gesture, context));
});

useEventListener(window, "pointermove", (event: PointerEvent) => {
  if (dragStart !== null) {
    dragDistance = Math.hypot(
      event.clientX - dragStart.x,
      event.clientY - dragStart.y,
    );
  }
  if (gesture.kind === "idle") return;
  const context = drawContext(event);
  if (context === null) return;
  applyGesture(moveDraw(gesture, context));
});

useEventListener(window, "pointerup", (event: PointerEvent) => {
  if (event.button !== 0) return;
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
  const world = eventWorld(event);
  if (world === null) return;

  if (isDrawTool(editor.tool) && !isDragDrawTool(editor.tool)) {
    const context = drawContext(event);
    if (context !== null) {
      applyGesture(clickDraw(gesture, context));
    }
    return;
  }

  if (editor.tool !== "select" && editor.tool !== null) return;
  const hit = hitTest(documentStore.current, world);
  editor.setSelectionId(hit?.id ?? null);
});

useEventListener(window, "keydown", (event: KeyboardEvent) => {
  if (isTypingTarget(event.target)) return;

  if (event.key === "Escape") {
    cancelPreview();
    return;
  }

  if (event.key !== "Delete" && event.key !== "Backspace") return;
  if (gesture.kind !== "idle") return;
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
