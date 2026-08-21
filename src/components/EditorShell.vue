<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { serializeDocument, useOpenSave } from "../io/open-save.ts";
import { useDocumentStore } from "../stores/document.ts";
import Viewport2d from "../viewport2d/Viewport2d.vue";
import LocaleSwitch from "./LocaleSwitch.vue";

const { t } = useI18n();
const documentStore = useDocumentStore();
const { openFile, saveUrl, saveFilename } = useOpenSave();

const primitiveCount = computed(() => documentStore.current.primitives.length);
const serializedDocument = computed(() =>
  serializeDocument(documentStore.current),
);
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-zinc-50 text-zinc-900">
    <header
      class="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2"
    >
      <h1 class="text-base font-medium">{{ t("app.title") }}</h1>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded border border-zinc-300 bg-white px-2 py-1 text-sm hover:bg-zinc-100"
          @click="openFile()"
        >
          {{ t("file.open") }}
        </button>
        <a
          class="rounded border border-zinc-300 bg-white px-2 py-1 text-sm hover:bg-zinc-100"
          :href="saveUrl"
          :download="saveFilename"
        >
          {{ t("file.save") }}
        </a>
        <button
          type="button"
          class="rounded border border-zinc-300 bg-white px-2 py-1 text-sm hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="!documentStore.canUndo"
          @click="documentStore.undo()"
        >
          {{ t("history.undo") }}
        </button>
        <button
          type="button"
          class="rounded border border-zinc-300 bg-white px-2 py-1 text-sm hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="!documentStore.canRedo"
          @click="documentStore.redo()"
        >
          {{ t("history.redo") }}
        </button>
        <LocaleSwitch />
      </div>
    </header>

    <p
      v-if="documentStore.openError"
      role="alert"
      class="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800"
    >
      {{ t("file.openFailed") }}: {{ documentStore.openError }}
    </p>

    <div class="flex min-h-0 flex-1">
      <aside
        class="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white"
        :aria-label="t('objectList.label')"
      >
        <h2 class="border-b border-zinc-200 px-3 py-2 text-sm font-medium">
          {{ t("objectList.label") }}
        </h2>
        <p
          v-if="primitiveCount === 0"
          class="px-3 py-3 text-sm text-zinc-600"
        >
          {{ t("objectList.empty") }}
        </p>
        <ul v-else class="min-h-0 flex-1 overflow-auto py-1 text-sm">
          <li
            v-for="primitive in documentStore.current.primitives"
            :key="primitive.id"
            class="px-3 py-1.5"
          >
            {{ primitive.type }} · {{ primitive.id }}
          </li>
        </ul>
      </aside>

      <section
        class="flex min-w-0 flex-1 flex-col bg-zinc-100"
        :aria-label="t('viewport.label')"
      >
        <h2 class="border-b border-zinc-200 bg-white px-3 py-2 text-sm font-medium">
          {{ t("viewport.label") }}
        </h2>
        <div class="min-h-0 flex-1">
          <Viewport2d />
        </div>
      </section>

      <aside
        class="flex w-80 shrink-0 flex-col border-l border-zinc-200 bg-white"
        :aria-label="t('properties.label')"
      >
        <h2 class="border-b border-zinc-200 px-3 py-2 text-sm font-medium">
          {{ t("properties.label") }}
        </h2>
        <dl class="space-y-2 px-3 py-3 text-sm">
          <div class="flex justify-between gap-2">
            <dt class="text-zinc-500">{{ t("properties.space") }}</dt>
            <dd>{{ documentStore.current.space }}</dd>
          </div>
          <div class="flex justify-between gap-2">
            <dt class="text-zinc-500">{{ t("properties.primitiveCount") }}</dt>
            <dd>{{ primitiveCount }}</dd>
          </div>
        </dl>
        <p class="px-3 text-sm text-zinc-600">{{ t("properties.empty") }}</p>
        <pre
          class="m-3 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-2 text-xs leading-5"
        >{{ serializedDocument }}</pre>
      </aside>
    </div>
  </div>
</template>
