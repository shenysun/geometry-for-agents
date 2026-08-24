<script setup lang="ts">
import { useEventListener, useResizeObserver } from "@vueuse/core";
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";
import {
  createViewport3dProjector,
  type Viewport3dPick,
  type Viewport3dProjector,
} from "./projector.ts";
import { commitBox } from "./box-commit.ts";
import { commitVoxel } from "./voxel-commit.ts";

const CLICK_PX = 4;

const hostRef = ref<HTMLDivElement | null>(null);
const documentStore = useDocumentStore();
const editor = useEditorStore();
let projector: Viewport3dProjector | null = null;
let pointerStart: { x: number; y: number; button: number } | null = null;
let dragging = false;
let hoverPick: Viewport3dPick = { kind: "none" };

function eventScreen(
  event: PointerEvent | MouseEvent,
): { x: number; y: number } | null {
  const host = hostRef.value;
  if (host === null) return null;
  const rect = host.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function pickAt(event: PointerEvent | MouseEvent): Viewport3dPick {
  if (projector === null) return { kind: "none" };
  const screen = eventScreen(event);
  if (screen === null) return { kind: "none" };
  return projector.pick(screen);
}

/** 预览跟随指针但不写说明书：长方体吃吸附当前格的原始落点，体素吃整数角 */
function previewPlace(pick: Viewport3dPick): void {
  if (pick.kind === "none") {
    projector?.setPreview(null);
    return;
  }
  if (editor.tool === "box") {
    const commit = commitBox(
      documentStore.current,
      pick.world,
      editor.grid,
      "preview",
    );
    projector?.setPreview(
      commit === null
        ? null
        : {
            kind: "box",
            anchor: { x: commit.x, y: commit.y, z: commit.z },
            width: commit.width,
            depth: commit.depth,
            height: commit.height,
          },
    );
    return;
  }
  const commit = commitVoxel(documentStore.current, pick.place, "preview");
  projector?.setPreview(
    commit === null ? null : { kind: "voxel", corner: commit },
  );
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
  projector = createViewport3dProjector(host);
  projector.render(documentStore.current);
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

useEventListener(hostRef, "pointerdown", (event: PointerEvent) => {
  pointerStart = { x: event.clientX, y: event.clientY, button: event.button };
  dragging = false;
  hoverPick = pickAt(event);
  if (event.button === 0) {
    previewPlace(hoverPick);
  }
});

useEventListener(hostRef, "pointermove", (event: PointerEvent) => {
  hoverPick = pickAt(event);
  if (pointerStart !== null) {
    const distance = Math.hypot(
      event.clientX - pointerStart.x,
      event.clientY - pointerStart.y,
    );
    if (distance > CLICK_PX) {
      dragging = true;
      projector?.setPreview(null);
      return;
    }
  }
  if (!dragging) {
    previewPlace(hoverPick);
  }
});

useEventListener(window, "pointerup", (event: PointerEvent) => {
  if (pointerStart === null || projector === null) return;
  const wasDragging = dragging;
  const button = pointerStart.button;
  pointerStart = null;
  dragging = false;
  projector.setPreview(null);
  if (wasDragging) return;

  const pick = pickAt(event);
  if (button === 2) {
    if (pick.kind !== "voxel") return;
    const removed = documentStore.removePrimitive(pick.id);
    if (removed.success && editor.selectionId === pick.id) {
      editor.setSelectionId(null);
    }
    return;
  }
  if (button !== 0) return;
  if (pick.kind === "none") return;
  // 长方体工具：单击落点吸附当前格后一次提交；体素路径保持点格放置
  if (editor.tool === "box") {
    const commit = commitBox(
      documentStore.current,
      pick.world,
      editor.grid,
      crypto.randomUUID(),
    );
    if (commit === null) return;
    const placed = documentStore.addPrimitive(commit);
    if (placed.success) {
      editor.setSelectionId(commit.id);
    }
    return;
  }
  const commit = commitVoxel(
    documentStore.current,
    pick.place,
    crypto.randomUUID(),
  );
  if (commit === null) return;
  const added = documentStore.addPrimitive(commit);
  if (added.success) {
    editor.setSelectionId(commit.id);
  }
});

useEventListener(hostRef, "contextmenu", (event: MouseEvent) => {
  event.preventDefault();
});

useEventListener(window, "keydown", (event: KeyboardEvent) => {
  if (isTypingTarget(event.target)) return;
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  const selected = editor.selectionId;
  if (selected !== null) {
    event.preventDefault();
    const removed = documentStore.removePrimitive(selected);
    if (removed.success) {
      editor.setSelectionId(null);
    }
    return;
  }
  if (hoverPick.kind !== "voxel") return;
  event.preventDefault();
  documentStore.removePrimitive(hoverPick.id);
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
    data-viewport-3d
  />
</template>
