<script setup lang="ts">
import { computed } from "vue";
import { ToggleGroupItem, ToggleGroupRoot } from "reka-ui";
import { useI18n } from "vue-i18n";
import { FILLS, withFill, type Fill } from "../document/index.ts";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";

const documentStore = useDocumentStore();
const editor = useEditorStore();
const { t } = useI18n();

const selected = computed(() => {
  const id = editor.selectionId;
  if (id === null) return null;
  return (
    documentStore.current.primitives.find((primitive) => primitive.id === id) ??
    null
  );
});

const fill = computed((): Fill | null => {
  const primitive = selected.value;
  if (primitive === null || !("fill" in primitive)) return null;
  return primitive.fill;
});

function onFillChange(value: string | string[] | undefined): void {
  if (value !== "none" && value !== "solid" && value !== "hatch") return;
  const primitive = selected.value;
  if (primitive === null) return;
  if ("fill" in primitive && primitive.fill === value) return;
  const next = withFill(primitive, value);
  if (next === null) return;
  documentStore.updatePrimitive(next.id, next);
}
</script>

<template>
  <div
    v-if="selected !== null"
    class="h-full space-y-3 overflow-auto px-3 py-3 text-sm"
  >
    <p class="font-medium">{{ selected.type }} · {{ selected.id }}</p>
    <div v-if="fill !== null">
      <p class="mb-1 text-zinc-500">{{ t("fill.label") }}</p>
      <ToggleGroupRoot
        type="single"
        :model-value="fill"
        class="inline-flex rounded-md border border-zinc-300 p-0.5"
        :aria-label="t('fill.label')"
        @update:model-value="onFillChange"
      >
        <ToggleGroupItem
          v-for="code in FILLS"
          :key="code"
          :value="code"
          class="rounded px-2 py-1 text-sm data-[state=on]:bg-zinc-800 data-[state=on]:text-white"
        >
          {{ t(`fill.${code}`) }}
        </ToggleGroupItem>
      </ToggleGroupRoot>
    </div>
  </div>
  <p v-else class="px-3 text-sm text-zinc-600">{{ t("properties.empty") }}</p>
</template>
