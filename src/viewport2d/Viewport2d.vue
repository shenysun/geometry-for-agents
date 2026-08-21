<script setup lang="ts">
import { useResizeObserver } from "@vueuse/core";
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useDocumentStore } from "../stores/document.ts";
import {
  createViewport2dProjector,
  type Viewport2dProjector,
} from "./projector.ts";

const hostRef = ref<HTMLDivElement | null>(null);
const documentStore = useDocumentStore();
let projector: Viewport2dProjector | null = null;

onMounted(() => {
  const host = hostRef.value;
  if (host === null) return;
  projector = createViewport2dProjector(host);
  projector.render(documentStore.current);
  const { width, height } = host.getBoundingClientRect();
  if (width > 0 && height > 0) {
    projector.resize(width, height);
  }
});

useResizeObserver(hostRef, (entries) => {
  const entry = entries[0];
  if (entry === undefined || projector === null) return;
  const { width, height } = entry.contentRect;
  projector.resize(width, height);
});

watch(
  () => documentStore.current,
  (document) => {
    projector?.render(document);
  },
);

onUnmounted(() => {
  projector?.destroy();
  projector = null;
});
</script>

<template>
  <div
    ref="hostRef"
    class="h-full min-h-0 w-full overflow-hidden bg-white"
    data-viewport-2d
  />
</template>
