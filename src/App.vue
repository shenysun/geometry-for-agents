<script setup lang="ts">
import { useTitle } from "@vueuse/core";
import { watch } from "vue";
import { useI18n } from "vue-i18n";
import EditorShell from "./components/EditorShell.vue";
import { useEditorStore } from "./stores/editor.ts";

const editor = useEditorStore();
const { locale, t } = useI18n();

watch(
  () => editor.locale,
  (next) => {
    locale.value = next;
    document.documentElement.lang = next;
  },
  { immediate: true },
);

useTitle(() => t("app.title"));
</script>

<template>
  <EditorShell />
</template>
