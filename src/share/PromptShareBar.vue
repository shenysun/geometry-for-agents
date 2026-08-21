<script setup lang="ts">
import { onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useDocumentStore } from "../stores/document.ts";
import { usePromptShare } from "./use-prompt-share.ts";

const { t } = useI18n();
const documentStore = useDocumentStore();
const { copyPrompt, copyShareUrl, bootFromLocation } = usePromptShare();

onMounted(() => {
  bootFromLocation();
});
</script>

<template>
  <div class="flex items-center gap-2">
    <button
      type="button"
      class="rounded border border-zinc-300 bg-white px-2 py-1 text-sm hover:bg-zinc-100"
      @click="copyPrompt()"
    >
      {{ t("prompt.copy") }}
    </button>
    <button
      type="button"
      class="rounded border border-zinc-300 bg-white px-2 py-1 text-sm hover:bg-zinc-100"
      @click="copyShareUrl()"
    >
      {{ t("share.copy") }}
    </button>
    <span
      v-if="documentStore.hashError"
      role="alert"
      class="text-sm text-red-800"
    >
      {{ t("share.restoreFailed") }}: {{ documentStore.hashError }}
    </span>
  </div>
</template>
