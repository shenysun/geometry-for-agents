import { usePreferredLanguages } from "@vueuse/core";
import { defineStore } from "pinia";
import { ref } from "vue";
import type { GridSnap } from "../document/index.ts";
import { localeFromLanguages, type AppLocale } from "../i18n/locale.ts";
import { isDrawTool, type DrawTool } from "../viewport2d/draw-gesture.ts";
import type { SessionUnderlay } from "../viewport2d/draw-underlay.ts";
import type { ClosablePanelId } from "../components/layout.ts";

export type EditorTool = "select" | DrawTool | "voxel" | "box" | null;

/** 顶栏发给停靠宿主的布局指令；nonce 保证重复点同一项也触发 */
export type LayoutCommand =
  | { kind: "open"; panel: ClosablePanelId; nonce: number }
  | { kind: "close"; panel: ClosablePanelId; nonce: number }
  | { kind: "reset"; nonce: number };

/** 只属于 3D 空间的创建工具：带进 2D 时退回选择 */
const threeDTools: ReadonlySet<EditorTool> = new Set(["voxel", "box"]);

export const useEditorStore = defineStore("editor", () => {
  const preferredLanguages = usePreferredLanguages();
  const locale = ref<AppLocale>(localeFromLanguages(preferredLanguages.value));
  const selectionId = ref<string | null>(null);
  const space = ref<"2d" | "3d">("2d");
  const tool = ref<EditorTool>("select");
  const grid = ref<GridSnap>(1);
  const sessionUnderlay = ref<SessionUnderlay | null>(null);
  const closedPanelIds = ref<ClosablePanelId[]>([]);
  const layoutCommand = ref<LayoutCommand | null>(null);
  let layoutCommandNonce = 0;

  function setLocale(next: AppLocale): void {
    locale.value = next;
  }

  function setSpace(next: "2d" | "3d"): void {
    space.value = next;
    // 别的空间的创建工具带不过去：2D 创建工具进 3D、3D 工具进 2D 都退回选择
    const fromOtherSpace =
      (next === "3d" && isDrawTool(tool.value)) ||
      (next === "2d" && threeDTools.has(tool.value));
    if (fromOtherSpace) {
      tool.value = "select";
    }
  }

  function setTool(next: EditorTool): void {
    tool.value = next;
  }

  function setGrid(next: GridSnap): void {
    grid.value = next;
  }

  function setSelectionId(next: string | null): void {
    selectionId.value = next;
  }

  function setSessionUnderlay(next: SessionUnderlay | null): void {
    const previous = sessionUnderlay.value;
    if (
      previous !== null &&
      previous.url.startsWith("blob:") &&
      previous.url !== next?.url
    ) {
      URL.revokeObjectURL(previous.url);
    }
    sessionUnderlay.value = next === null ? null : { ...next };
  }

  function setClosedPanelIds(ids: readonly ClosablePanelId[]): void {
    closedPanelIds.value = [...ids];
  }

  function openPanel(panel: ClosablePanelId): void {
    layoutCommand.value = { kind: "open", panel, nonce: ++layoutCommandNonce };
  }

  function closePanel(panel: ClosablePanelId): void {
    layoutCommand.value = { kind: "close", panel, nonce: ++layoutCommandNonce };
  }

  function resetLayout(): void {
    layoutCommand.value = { kind: "reset", nonce: ++layoutCommandNonce };
  }

  return {
    locale,
    selectionId,
    space,
    tool,
    grid,
    sessionUnderlay,
    closedPanelIds,
    layoutCommand,
    setLocale,
    setSpace,
    setTool,
    setGrid,
    setSelectionId,
    setSessionUnderlay,
    setClosedPanelIds,
    openPanel,
    closePanel,
    resetLayout,
  };
});
