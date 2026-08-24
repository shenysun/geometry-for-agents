<script setup lang="ts">
import { useEventListener, useResizeObserver } from "@vueuse/core";
import { onMounted, onUnmounted, ref, watch } from "vue";
import type { GridSnap, Point2, Point3 } from "../document/index.ts";
import {
  moveSolidControlPoint,
  rotateSolid,
  scaleSolid,
  translateSolid,
} from "../document/update-document.ts";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";
import {
  createViewport3dProjector,
  type Viewport3dPick,
  type Viewport3dProjector,
} from "./projector.ts";
import { solidPlacementPreview } from "./placement-preview.ts";
import { solidControlPoints } from "./solid-control-points.ts";
import { commitSolid, isSolidTool } from "./solid-commit.ts";
import {
  clickSelect3d,
  escSelect3d,
  idleSelect3dState,
  moveSelect3d,
  solidTransformHandles,
  startSelect3d,
  upSelect3d,
  type Select3dCommit,
  type Select3dContext,
  type Select3dResult,
  type Select3dState,
} from "./select-gesture-3d.ts";
import { commitVoxel, translateVoxel } from "./voxel-commit.ts";

const CLICK_PX = 4;

/** 柄命中半径（屏幕像素）：换算成该深度处的世界单位再喂给手势。 */
const HANDLE_HIT_PX = 10;
/** 控制点命中半径（屏幕像素）：与 2D 同宽，略大更好抓。 */
const CONTROL_HIT_PX = 10;
/** 拖旋转柄/缩放柄时的光标，与柄悬停光标一致（与 2D 同一套）。 */
const HANDLE_CURSORS = { rotate: "alias", scale: "ew-resize" } as const;
/** 控制点悬停与拖动光标：与柄（alias/ew-resize）、本体（grab）三者可区分。 */
const CONTROL_CURSOR = "move";

/** 三根旋转柄的屏幕位置：球无旋转柄时对应项为 null（不显示）。 */
type RotateHandleScreen = {
  axis: "rotateY" | "rotateX" | "rotateZ";
  point: Point2 | null;
};

const hostRef = ref<HTMLDivElement | null>(null);
const solidRotateHandleScreens = ref<RotateHandleScreen[]>([]);
const solidScaleHandleScreen = ref<Point2 | null>(null);
const solidControlScreens = ref<{ id: string; point: Point2 }[]>([]);
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

/** Alt 临时关吸附：参数体吃它；体素不吃（整格语义写不出半格）。 */
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
 * 选择手势上下文：指针投影到高度 planeY 的水平面取平移落点（拖动全程
 * 同一平面）；视线（ray）与像素换算的世界容差喂给控制点/柄的命中与量测。
 */
function selectContext(
  event: PointerEvent | MouseEvent,
  planeY?: number,
): Select3dContext | null {
  if (projector === null) return null;
  const screen = eventScreen(event);
  if (screen === null) return null;
  const pick = projector.pick(screen);
  const y =
    planeY ??
    (pick.kind === "voxel"
      ? pick.place.y
      : pick.kind === "solid"
        ? pick.world.y
        : 0);
  const point = projector.pickOnPlane(screen, y);
  const world = point ?? (pick.kind === "none" ? { x: 0, y: 0, z: 0 } : pick.world);
  const perPixel = projector.worldPerPixel(world);
  return {
    tool: "select",
    document: documentStore.current,
    point: world,
    grid: gridForEvent(event),
    selectionId: editor.selectionId,
    hitId: pick.kind === "voxel" || pick.kind === "solid" ? pick.id : null,
    ray: projector.rayAt(screen),
    handleTolerance: HANDLE_HIT_PX * perPixel,
    controlTolerance: CONTROL_HIT_PX * perPixel,
  };
}

/** 把一次参数体手势的变换写进说明书：平移与控制点吃格，旋转缩放直接写角度与因子。 */
function commitSolidTransform(commit: Select3dCommit, grid: GridSnap): void {
  const current = documentStore.current;
  const transformed =
    commit.kind === "translateSolid"
      ? translateSolid(current, commit.id, commit.dx, commit.dy, commit.dz, grid)
      : commit.kind === "rotateSolid"
        ? rotateSolid(current, commit.id, commit.axis, commit.deg)
        : commit.kind === "scaleSolid"
          ? scaleSolid(current, commit.id, commit.factor)
          : moveSolidControlPoint(
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

/** 套用一次 3D 选择手势结果：选中、预览、至多一次提交。 */
function applySelectGesture3d(result: Select3dResult, grid: GridSnap): void {
  selectGesture = result.state;
  if (result.selectionId !== undefined) {
    editor.setSelectionId(result.selectionId);
  }
  projector?.setPreview(result.preview);
  const commit = result.commit;
  if (commit !== null) {
    if (commit.kind === "translate") {
      // 体素整格平移：锁整数、查占用，不理格步长与 Alt
      const moved = translateVoxel(documentStore.current, commit.id, {
        x: commit.dx,
        y: commit.dy,
        z: commit.dz,
      });
      if (moved !== null) {
        documentStore.updatePrimitive(commit.id, moved);
      }
    } else {
      commitSolidTransform(commit, grid);
    }
  }
  refreshSolidOverlays();
  syncCursor3d();
}

/** 选中参数体的柄与控制点屏幕位置：选择工具、无手势、选中是参数体时才有。 */
function refreshSolidOverlays(): void {
  solidRotateHandleScreens.value = [];
  solidScaleHandleScreen.value = null;
  solidControlScreens.value = [];
  const view = projector;
  if (view === null || !isSelectTool() || selectGesture.kind !== "idle") {
    return;
  }
  const document = documentStore.current;
  if (document.space !== "3d") return;
  const id = editor.selectionId;
  if (id === null) return;
  const primitive = document.primitives.find((item) => item.id === id);
  if (primitive === undefined || primitive.type === "voxel") return;

  const anchor: Point3 = { x: primitive.x, y: primitive.y, z: primitive.z };
  const handles = solidTransformHandles(
    primitive,
    HANDLE_HIT_PX * view.worldPerPixel(anchor),
  );
  const toScreen = (point: Point3 | null): Point2 | null =>
    point === null ? null : view.toScreen(point);
  solidRotateHandleScreens.value = [
    { axis: "rotateY", point: toScreen(handles.rotateY) },
    { axis: "rotateX", point: toScreen(handles.rotateX) },
    { axis: "rotateZ", point: toScreen(handles.rotateZ) },
  ];
  solidScaleHandleScreen.value = toScreen(handles.scale);
  solidControlScreens.value = solidControlPoints(primitive).flatMap(
    (point) => {
      const screen = view.toScreen(point.world);
      return screen === null ? [] : [{ id: point.id, point: screen }];
    },
  );
}

/** 拖柄/控制点期间宿主光标保持控件语义；选择工具本体是 grab，创建工具回默认。 */
function syncCursor3d(): void {
  const host = hostRef.value;
  if (host === null) return;
  if (!isSelectTool()) {
    host.style.cursor = "";
    return;
  }
  const kind = selectGesture.kind;
  host.style.cursor =
    kind === "solid-rotate"
      ? HANDLE_CURSORS.rotate
      : kind === "solid-scale"
        ? HANDLE_CURSORS.scale
        : kind === "solid-control"
          ? CONTROL_CURSOR
          : "grab";
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
  // 体素只落在地面或体素邻格：悬在参数体上没有整数角可放
  if (pick.kind !== "empty" && pick.kind !== "voxel") {
    projector?.setPreview(null);
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

/** 平移类手势的拖动平面高度：与按下时同高，位移才不会漂。 */
function gesturePlaneY(state: Select3dState): number | undefined {
  return state.kind === "drag" || state.kind === "solid-translate"
    ? state.startWorld.y
    : undefined;
}

onMounted(() => {
  const host = hostRef.value;
  if (host === null) return;
  projector = createViewport3dProjector(host);
  projector.render(documentStore.current);
  projector.setSelection(editor.selectionId);
  // 轨道/渲染后覆盖层的屏幕位置要跟着视图重算
  projector.onViewChange(() => {
    refreshSolidOverlays();
  });
  const { width, height } = host.getBoundingClientRect();
  if (width > 0 && height > 0) {
    projector.resize(width, height);
  }
  refreshSolidOverlays();
  syncCursor3d();
});

useResizeObserver(hostRef, (entries) => {
  const entry = entries[0];
  if (entry === undefined || projector === null) return;
  const { width, height } = entry.contentRect;
  projector.resize(width, height);
  refreshSolidOverlays();
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
    refreshSolidOverlays();
  },
);

watch(
  () => editor.selectionId,
  () => {
    projector?.setSelection(editor.selectionId);
    refreshSolidOverlays();
  },
);

watch(
  () => editor.tool,
  () => {
    selectGesture = idleSelect3dState();
    projector?.setPreview(null);
    refreshSolidOverlays();
    syncCursor3d();
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
      applySelectGesture3d(startSelect3d(selectGesture, context), context.grid);
    }
    return;
  }
  previewPlace(hoverPick);
});

useEventListener(window, "pointermove", (event: PointerEvent) => {
  hoverPick = pickAt(event);
  if (selectGesture.kind !== "idle") {
    // 参数体/体素的每种手势都跟着指针走：平移类用按下时同高的平面
    const context = selectContext(event, gesturePlaneY(selectGesture));
    if (context !== null) {
      applySelectGesture3d(
        moveSelect3d(selectGesture, context),
        context.grid,
      );
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

  // 选择工具：松手提交一次（整格平移/参数体变换）或单击选中/取消，绝不下放置
  if (isSelectTool()) {
    if (selectGesture.kind !== "idle") {
      const context = selectContext(event, gesturePlaneY(selectGesture));
      const result =
        context === null
          ? escSelect3d(selectGesture)
          : upSelect3d(selectGesture, context);
      applySelectGesture3d(result, context?.grid ?? editor.grid);
      return;
    }
    const context = selectContext(event);
    if (context !== null) {
      applySelectGesture3d(clickSelect3d(selectGesture, context), context.grid);
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
  const commit =
    pick.kind === "empty" || pick.kind === "voxel"
      ? commitVoxel(documentStore.current, pick.place, crypto.randomUUID())
      : null;
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
      applySelectGesture3d(escSelect3d(selectGesture), editor.grid);
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
    class="relative h-full min-h-0 w-full overflow-hidden bg-white"
    data-viewport-3d
  >
    <!-- 参数体控制点与变换手柄层：容器不接事件，只有控件本身可点，不挡视口。 -->
    <div class="pointer-events-none absolute inset-0 z-10">
      <div
        v-for="control in solidControlScreens"
        :key="control.id"
        class="pointer-events-auto absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-700 bg-white"
        :style="{
          left: `${control.point.x}px`,
          top: `${control.point.y}px`,
          cursor: CONTROL_CURSOR,
        }"
        :data-solid-control-point="control.id"
      />
      <div
        v-for="handle in solidRotateHandleScreens"
        :key="handle.axis"
        v-show="handle.point !== null"
        class="pointer-events-auto absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-700 bg-white"
        :style="{
          left: `${handle.point?.x ?? 0}px`,
          top: `${handle.point?.y ?? 0}px`,
          cursor: HANDLE_CURSORS.rotate,
        }"
        :data-solid-rotate-handle="handle.axis"
      />
      <div
        v-show="solidScaleHandleScreen !== null"
        class="pointer-events-auto absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-zinc-700 bg-white"
        :style="{
          left: `${solidScaleHandleScreen?.x ?? 0}px`,
          top: `${solidScaleHandleScreen?.y ?? 0}px`,
          cursor: HANDLE_CURSORS.scale,
        }"
        data-solid-scale-handle
      />
    </div>
  </div>
</template>
