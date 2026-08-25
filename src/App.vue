<script setup lang="ts">
import { useEventListener, useTitle } from "@vueuse/core";
import { watch } from "vue";
import { useI18n } from "vue-i18n";
import EditorShell from "./components/EditorShell.vue";
import {
  isTypingTarget,
  toolFromShortcut,
} from "./components/tool-shortcuts.ts";
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

useEventListener(window, "keydown", (event: KeyboardEvent) => {
  if (isTypingTarget(event.target)) return;
  const tool = toolFromShortcut(event, editor.space);
  if (tool !== null) {
    editor.setTool(tool);
  }
});

useTitle(() => t("app.title"));
</script>

<template>
  <EditorShell />
</template>
