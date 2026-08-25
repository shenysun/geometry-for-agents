<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";
import { displayNamesById } from "./display-name.ts";

const { t } = useI18n();
const documentStore = useDocumentStore();
const editor = useEditorStore();

const primitiveCount = computed(
  () => documentStore.current.primitives.length,
);

/** id → 显示名（圆、圆1……）：随说明书与当前语言实时推导 */
const displayNames = computed(() =>
  displayNamesById(documentStore.current.primitives, t),
);
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-auto bg-white text-sm">
    <p v-if="primitiveCount === 0" class="px-3 py-3 text-zinc-600">
      {{ t("objectList.empty") }}
    </p>
    <ul v-else class="min-h-0 flex-1 overflow-auto py-1">
      <li
        v-for="primitive in documentStore.current.primitives"
        :key="primitive.id"
      >
        <button
          type="button"
          :title="primitive.id"
          class="block w-full px-3 py-1.5 text-left"
          :class="
            primitive.id === editor.selectionId
              ? 'bg-zinc-100 font-medium'
              : undefined
          "
          :aria-pressed="primitive.id === editor.selectionId"
          @click="editor.setSelectionId(primitive.id)"
        >
          {{ displayNames.get(primitive.id) }}
        </button>
      </li>
    </ul>
  </div>
</template>
