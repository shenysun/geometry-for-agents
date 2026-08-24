<script setup lang="ts">
import { computed } from "vue";
import type { CheckedState } from "reka-ui";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  ToggleGroupItem,
  ToggleGroupRoot,
} from "reka-ui";
import { useI18n } from "vue-i18n";
import type { GridSnap } from "../document/index.ts";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";
import {
  CLOSABLE_PANEL_IDS,
  PANEL_TITLE_KEYS,
  type ClosablePanelId,
} from "./layout.ts";

// 创建工具在工具箱面板里；顶栏只留格开关、面板勾选与恢复默认布局
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

// 视口永不可关，不出现在勾选里；其余四块勾上即开、取消即关
function isPanelOpen(panel: ClosablePanelId): boolean {
  return !editor.closedPanelIds.includes(panel);
}

function onPanelToggle(panel: ClosablePanelId, checked: CheckedState): void {
  if (checked === true) {
    editor.openPanel(panel);
  } else {
    editor.closePanel(panel);
  }
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

    <DropdownMenuRoot>
      <DropdownMenuTrigger
        class="rounded border border-zinc-300 bg-white px-2 py-1 text-sm hover:bg-zinc-100"
      >
        {{ t("layout.panels") }}
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          class="z-50 min-w-36 rounded border border-zinc-200 bg-white p-1 shadow-lg"
          :side-offset="4"
        >
          <DropdownMenuCheckboxItem
            v-for="panel in CLOSABLE_PANEL_IDS"
            :key="panel"
            :model-value="isPanelOpen(panel)"
            class="flex cursor-default select-none items-center gap-2 rounded px-2 py-1 text-sm outline-none data-[highlighted]:bg-zinc-100"
            @update:model-value="onPanelToggle(panel, $event)"
          >
            <DropdownMenuItemIndicator class="w-4 text-center">
              ✓
            </DropdownMenuItemIndicator>
            {{ t(PANEL_TITLE_KEYS[panel]) }}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>

    <button
      type="button"
      class="rounded border border-zinc-300 bg-white px-2 py-1 text-sm hover:bg-zinc-100"
      @click="editor.resetLayout()"
    >
      {{ t("layout.reset") }}
    </button>
  </div>
</template>
