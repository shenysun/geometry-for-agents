<script setup lang="ts">
import { ToggleGroupItem, ToggleGroupRoot } from "reka-ui";
import { useI18n } from "vue-i18n";
import { useEditorStore } from "../stores/editor.ts";

const locales = ["zh", "en"] as const;
const editor = useEditorStore();
const { t } = useI18n();

function onLocaleChange(value: string | string[] | undefined): void {
  if (value === "zh" || value === "en") {
    editor.setLocale(value);
  }
}
</script>

<template>
  <ToggleGroupRoot
    type="single"
    :model-value="editor.locale"
    class="inline-flex rounded-md border border-zinc-300 p-0.5"
    @update:model-value="onLocaleChange"
  >
    <ToggleGroupItem
      v-for="code in locales"
      :key="code"
      :value="code"
      class="rounded px-2 py-1 text-sm data-[state=on]:bg-zinc-800 data-[state=on]:text-white"
    >
      {{ t(`locale.${code}`) }}
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>
