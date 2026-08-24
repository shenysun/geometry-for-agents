import { usePreferredLanguages } from "@vueuse/core";
import { defineStore } from "pinia";
import { ref } from "vue";
import type { GridSnap } from "../document/index.ts";
import { localeFromLanguages, type AppLocale } from "../i18n/locale.ts";
import { isDrawTool, type DrawTool } from "../viewport2d/draw-gesture.ts";
import type { SessionUnderlay } from "../viewport2d/draw-underlay.ts";

export type EditorTool = "select" | DrawTool | "voxel" | null;

export const useEditorStore = defineStore("editor", () => {
  const preferredLanguages = usePreferredLanguages();
  const locale = ref<AppLocale>(localeFromLanguages(preferredLanguages.value));
  const selectionId = ref<string | null>(null);
  const space = ref<"2d" | "3d">("2d");
  const tool = ref<EditorTool>("select");
  const grid = ref<GridSnap>(1);
  const sessionUnderlay = ref<SessionUnderlay | null>(null);

  function setLocale(next: AppLocale): void {
    locale.value = next;
  }

  function setSpace(next: "2d" | "3d"): void {
    space.value = next;
    // 别的空间的创建工具带不过去：2D 创建工具进 3D、体素进 2D 都退回选择
    const fromOtherSpace =
      (next === "3d" && isDrawTool(tool.value)) ||
      (next === "2d" && tool.value === "voxel");
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

  return {
    locale,
    selectionId,
    space,
    tool,
    grid,
    sessionUnderlay,
    setLocale,
    setSpace,
    setTool,
    setGrid,
    setSelectionId,
    setSessionUnderlay,
  };
});
