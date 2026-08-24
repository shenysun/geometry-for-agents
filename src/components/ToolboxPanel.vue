<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";
import { toolsForSpace } from "./toolbox.ts";

const { t } = useI18n();
const documentStore = useDocumentStore();
const editor = useEditorStore();

const tools = computed(() => toolsForSpace(documentStore.current.space));
</script>

<template>
  <!-- 工具箱：列出当前空间的选择与创建工具，图标加名称；点一项即切换当前工具 -->
  <div class="h-full overflow-auto bg-white py-1 text-sm" data-toolbox>
    <button
      v-for="tool in tools"
      :key="tool.id"
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
  </div>
</template>
