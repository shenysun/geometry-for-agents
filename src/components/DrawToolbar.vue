<script setup lang="ts">
import { ToggleGroupItem, ToggleGroupRoot } from "reka-ui";
import { useI18n } from "vue-i18n";
import type { GridSnap } from "../document/index.ts";
import { useEditorStore } from "../stores/editor.ts";

const tools = ["select", "line", "polygon"] as const;
const grids = [
  { value: "1", grid: 1 as const, label: "grid.unit" },
  { value: "0.5", grid: 0.5 as const, label: "grid.half" },
  { value: "off", grid: "off" as const, label: "grid.off" },
] as const;

const editor = useEditorStore();
const { t } = useI18n();

function onToolChange(value: string | string[] | undefined): void {
  if (value === "select" || value === "line" || value === "polygon") {
    editor.setTool(value);
  }
}

function onGridChange(value: string | string[] | undefined): void {
  const match = grids.find((item) => item.value === value);
  if (match !== undefined) {
    editor.setGrid(match.grid);
  }
}

function gridValue(grid: GridSnap): string {
  return grid === "off" ? "off" : String(grid);
}
</script>

<template>
  <div class="flex items-center gap-3" data-draw-toolbar>
    <ToggleGroupRoot
      type="single"
      :model-value="editor.tool ?? undefined"
      class="inline-flex rounded-md border border-zinc-300 p-0.5"
      :aria-label="t('tool.select')"
      @update:model-value="onToolChange"
    >
      <ToggleGroupItem
        v-for="code in tools"
        :key="code"
        :value="code"
        class="rounded px-2 py-1 text-sm data-[state=on]:bg-zinc-800 data-[state=on]:text-white"
      >
        {{ t(`tool.${code}`) }}
      </ToggleGroupItem>
    </ToggleGroupRoot>
    <ToggleGroupRoot
      type="single"
      :model-value="gridValue(editor.grid)"
      class="inline-flex rounded-md border border-zinc-300 p-0.5"
      :aria-label="t('grid.label')"
      @update:model-value="onGridChange"
    >
      <ToggleGroupItem
        v-for="item in grids"
        :key="item.value"
        :value="item.value"
        class="rounded px-2 py-1 text-sm data-[state=on]:bg-zinc-800 data-[state=on]:text-white"
      >
        {{ t(item.label) }}
      </ToggleGroupItem>
    </ToggleGroupRoot>
  </div>
</template>
