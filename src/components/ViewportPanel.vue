<script setup lang="ts">
import { computed } from "vue";
import { useDocumentStore } from "../stores/document.ts";
import Viewport2d from "../viewport2d/Viewport2d.vue";
import Viewport3d from "../viewport3d/Viewport3d.vue";

const documentStore = useDocumentStore();
const is3d = computed(() => documentStore.current.space === "3d");
</script>

<template>
  <!-- 停靠面板里的视口容器：面板内容区尺寸变化由视口自身的 ResizeObserver 跟随 -->
  <div class="h-full min-h-0 w-full overflow-hidden bg-zinc-100">
    <Viewport3d v-if="is3d" />
    <Viewport2d v-else />
  </div>
</template>
