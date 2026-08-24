<script setup lang="ts">
import { useEventListener, useResizeObserver } from "@vueuse/core";
import { onMounted, onUnmounted, ref, watch } from "vue";
import type { GridSnap } from "../document/index.ts";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";
import {
  createViewport3dProjector,
  solidPlacementPreview,
  type Viewport3dPick,
  type Viewport3dProjector,
} from "./projector.ts";
import { commitSolid, isSolidTool } from "./solid-commit.ts";
import {
  clickSelect3d,
  escSelect3d,
  idleSelect3dState,
  moveSelect3d,
  startSelect3d,
  upSelect3d,
  type Select3dContext,
  type Select3dResult,
  type Select3dState,
} from "./select-gesture-3d.ts";
import { commitVoxel, translateVoxel } from "./voxel-commit.ts";

const CLICK_PX = 4;

const hostRef = ref<HTMLDivElement | null>(null);
const documentStore = useDocumentStore();
const editor = useEditorStore();
let projector: Viewport3dProjector | null = null;
let pointerStart: { x: number; y: number; button: number } | null = null;
let dragging = false;
let hoverPick: Viewport3dPick = { kind: "none" };
let selectGesture: Select3dState = idleSelect3dState();

/** 选择工具的口径与 2D 一致：select 或未拿工具都走选择手势。 */
function isSelectTool(): boolean {
  return editor.tool === "select" || editor.tool === null;
}

/** 3D 创建工具：单位立方体与参数体（长方体、圆柱、圆锥、球、四棱锥、三棱柱）。 */
function isCreateTool(): boolean {
  return editor.tool === "voxel" || isSolidTool(editor.tool);
}

/** 体素不吃格与 Alt：传进手势只为在纯函数里证明「被忽略」。 */
function gridForEvent(event: PointerEvent | MouseEvent): GridSnap {
  if (event.altKey) {
    return "off";
  }
  return editor.grid;
}

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

/**
 * 选择手势上下文：指针投影到高度 planeY 的水平面取世界落点——拖动全程
 * 同一平面，位移才只会是整格。planeY 缺省取当前拾取格的高度。
 */
function selectContext(
  event: PointerEvent | MouseEvent,
  planeY?: number,
): Select3dContext | null {
  if (projector === null) return null;
  const screen = eventScreen(event);
  if (screen === null) return null;
  const pick = projector.pick(screen);
  const y = planeY ?? (pick.kind === "none" ? 0 : pick.place.y);
  const point = projector.pickOnPlane(screen, y);
  return {
    tool: "select",
    document: documentStore.current,
    point: point ?? (pick.kind === "none" ? { x: 0, y: 0, z: 0 } : pick.world),
    grid: gridForEvent(event),
    alt: event.altKey,
    selectionId: editor.selectionId,
    hitId: pick.kind === "voxel" ? pick.id : null,
  };
}

/** 套用一次 3D 选择手势结果：选中、预览、至多一次整格平移提交。 */
function applySelectGesture3d(result: Select3dResult): void {
  selectGesture = result.state;
  if (result.selectionId !== undefined) {
    editor.setSelectionId(result.selectionId);
  }
  projector?.setPreview(result.preview);
  const commit = result.commit;
  if (commit === null) return;
  const moved = translateVoxel(documentStore.current, commit.id, {
    x: commit.dx,
    y: commit.dy,
    z: commit.dz,
  });
  if (moved !== null) {
    documentStore.updatePrimitive(commit.id, moved);
  }
}

/** 预览跟随指针但不写说明书：参数体吃吸附当前格的原始落点，体素吃整数角 */
function previewPlace(pick: Viewport3dPick): void {
  if (pick.kind === "none" || !isCreateTool()) {
    projector?.setPreview(null);
    return;
  }
  const tool = editor.tool;
  if (isSolidTool(tool)) {
    const solid = commitSolid(
      documentStore.current,
      tool,
      pick.world,
      editor.grid,
      "preview",
    );
    projector?.setPreview(
      solid === null ? null : solidPlacementPreview(solid),
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
  projector.setSelection(editor.selectionId);
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
  () => editor.selectionId,
  (id) => {
    projector?.setSelection(id);
  },
);

watch(
  () => editor.tool,
  () => {
    selectGesture = idleSelect3dState();
    projector?.setPreview(null);
  },
);

useEventListener(hostRef, "pointerdown", (event: PointerEvent) => {
  pointerStart = { x: event.clientX, y: event.clientY, button: event.button };
  dragging = false;
  hoverPick = pickAt(event);
  if (event.button !== 0) return;
  if (isSelectTool()) {
    // 选择工具左键只选择/拖动，不放置
    const context = selectContext(event);
    if (context !== null) {
      applySelectGesture3d(startSelect3d(selectGesture, context));
    }
    return;
  }
  previewPlace(hoverPick);
});

useEventListener(window, "pointermove", (event: PointerEvent) => {
  hoverPick = pickAt(event);
  if (selectGesture.kind === "drag") {
    // 拖动全程用按下时同高的平面，保证位移只会是整格
    const context = selectContext(event, selectGesture.startWorld.y);
    if (context !== null) {
      applySelectGesture3d(moveSelect3d(selectGesture, context));
    }
    return;
  }
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

  if (button === 2) {
    // 右键拖是转镜头，让路；单击删除拾取到的体素
    if (wasDragging) return;
    const pick = pickAt(event);
    if (pick.kind !== "voxel") return;
    const removed = documentStore.removePrimitive(pick.id);
    if (removed.success && editor.selectionId === pick.id) {
      editor.setSelectionId(null);
    }
    return;
  }
  if (button !== 0) return;

  // 选择工具：松手提交整格平移或单击选中/取消，绝不下放置
  if (isSelectTool()) {
    if (selectGesture.kind !== "idle") {
      const planeY =
        selectGesture.kind === "drag" ? selectGesture.startWorld.y : undefined;
      const context = selectContext(event, planeY);
      const result =
        context === null
          ? escSelect3d(selectGesture)
          : upSelect3d(selectGesture, context);
      applySelectGesture3d(result);
      return;
    }
    const context = selectContext(event);
    if (context !== null) {
      applySelectGesture3d(clickSelect3d(selectGesture, context));
    }
    return;
  }

  // 创建工具：点格放置；拖动是转镜头，不放置
  projector.setPreview(null);
  const pick = pickAt(event);
  if (wasDragging || pick.kind === "none") return;
  const tool = editor.tool;
  if (isSolidTool(tool)) {
    const solid = commitSolid(
      documentStore.current,
      tool,
      pick.world,
      editor.grid,
      crypto.randomUUID(),
    );
    if (solid === null) return;
    const placed = documentStore.addPrimitive(solid);
    if (placed.success) {
      editor.setSelectionId(solid.id);
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

  if (event.key === "Escape") {
    if (selectGesture.kind !== "idle") {
      applySelectGesture3d(escSelect3d(selectGesture));
    }
    return;
  }

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
