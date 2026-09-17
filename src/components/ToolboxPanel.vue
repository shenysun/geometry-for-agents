<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useDocumentStore } from "../stores/document.ts";
import { catalogForSpace } from "./toolbox.ts";
import ToolboxButton from "./ToolboxButton.vue";

const { t } = useI18n();
const documentStore = useDocumentStore();

const catalog = computed(() => catalogForSpace(documentStore.current.space));
</script>

<template>
  <!--
    工具箱：纯渲染目录函数返回的「选择段 + 分组小节」结构，不做任何分组判断。
    选择工具置顶独立一段，细分隔线隔开分组区；小节标题是弱化灰字导航锚点，无交互、不可折叠。
  -->
  <div class="h-full overflow-auto bg-white py-1 text-sm" data-toolbox>
    <ToolboxButton :tool="catalog.select" />

    <div class="my-1.5 border-t border-zinc-200" aria-hidden="true"></div>

    <section
      v-for="group in catalog.groups"
      :key="group.id"
      class="mb-2 last:mb-0"
      :data-tool-group="group.id"
    >
      <h3 class="px-2.5 pb-0.5 pt-1 text-xs text-zinc-400">
        {{ t(group.labelKey) }}
      </h3>
      <ToolboxButton v-for="tool in group.tools" :key="tool.id" :tool="tool" />
    </section>
  </div>
</template>
