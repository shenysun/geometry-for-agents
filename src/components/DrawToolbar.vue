<script setup lang="ts">
import { computed } from "vue";
import { ToggleGroupItem, ToggleGroupRoot } from "reka-ui";
import { useI18n } from "vue-i18n";
import type { GridSnap } from "../document/index.ts";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";

// 创建工具已搬进工具箱面板；顶栏只留格开关
const documentStore = useDocumentStore();
const is2d = computed(() => documentStore.current.space === "2d");
const grids = [
  { value: "1", grid: 1 as const, label: "grid.unit" },
  { value: "0.5", grid: 0.5 as const, label: "grid.half" },
  { value: "off", grid: "off" as const, label: "grid.off" },
] as const;

const editor = useEditorStore();
const { t } = useI18n();

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
      v-if="is2d"
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
