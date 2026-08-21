import { usePreferredLanguages } from "@vueuse/core";
import { defineStore } from "pinia";
import { ref } from "vue";
import type { GridSnap } from "../document/index.ts";
import { localeFromLanguages, type AppLocale } from "../i18n/locale.ts";

export type EditorTool = "select" | "line" | "polygon" | null;

export const useEditorStore = defineStore("editor", () => {
  const preferredLanguages = usePreferredLanguages();
  const locale = ref<AppLocale>(localeFromLanguages(preferredLanguages.value));
  const selectionId = ref<string | null>(null);
  const space = ref<"2d" | "3d">("2d");
  const tool = ref<EditorTool>("select");
  const grid = ref<GridSnap>(1);

  function setLocale(next: AppLocale): void {
    locale.value = next;
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

  return {
    locale,
    selectionId,
    space,
    tool,
    grid,
    setLocale,
    setTool,
    setGrid,
    setSelectionId,
  };
});
