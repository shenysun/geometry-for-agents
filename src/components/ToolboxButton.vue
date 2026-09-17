<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useEditorStore } from "../stores/editor.ts";
import type { ToolboxTool } from "./toolbox.ts";

defineProps<{ tool: ToolboxTool }>();

const { t } = useI18n();
const editor = useEditorStore();
</script>

<template>
  <!-- 工具箱里的一项：图标加名称，点一下即切换当前工具；选中态常驻提示 -->
  <button
    type="button"
    class="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-zinc-700 hover:bg-zinc-100"
    :class="editor.tool === tool.id ? 'bg-zinc-100 font-medium' : undefined"
    :aria-pressed="editor.tool === tool.id"
    @click="editor.setTool(tool.id)"
  >
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
      class="h-4 w-4 shrink-0 text-zinc-500"
      aria-hidden="true"
    >
      <path v-for="(path, index) in tool.icon.paths" :key="index" :d="path" />
    </svg>
    {{ t(tool.labelKey) }}
  </button>
</template>
