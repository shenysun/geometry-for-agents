<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
  ToggleGroupItem,
  ToggleGroupRoot,
} from "reka-ui";
import type { Space } from "../document/index.ts";
import { serializeDocument, useOpenSave } from "../io/open-save.ts";
import PromptShareBar from "../share/PromptShareBar.vue";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";
import Viewport2d from "../viewport2d/Viewport2d.vue";
import Viewport3d from "../viewport3d/Viewport3d.vue";
import DrawToolbar from "./DrawToolbar.vue";
import LocaleSwitch from "./LocaleSwitch.vue";
import PropertiesPanel from "./PropertiesPanel.vue";
import UnderlayPanel from "./UnderlayPanel.vue";

const { t } = useI18n();
const documentStore = useDocumentStore();
const editor = useEditorStore();
const { openFile, saveUrl, saveFilename } = useOpenSave();

const primitiveCount = computed(() => documentStore.current.primitives.length);
const serializedDocument = computed(() =>
  serializeDocument(documentStore.current),
);
const is3d = computed(() => documentStore.current.space === "3d");
const confirmOpen = ref(false);
const requestedSpace = ref<Space>("3d");

function onSpaceChange(value: string | string[] | undefined): void {
  if (value !== "2d" && value !== "3d") return;
  const result = documentStore.requestSpaceChange(value);
  if (result === "refused") {
    requestedSpace.value = value;
    confirmOpen.value = true;
  }
}

function confirmSpaceChange(): void {
  documentStore.clearAndSetSpace(requestedSpace.value);
  confirmOpen.value = false;
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-zinc-50 text-zinc-900">
    <header
      class="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-2"
    >
      <h1 class="text-base font-medium">{{ t("app.title") }}</h1>
      <ToggleGroupRoot
        type="single"
        :model-value="documentStore.current.space"
        class="inline-flex rounded-md border border-zinc-300 p-0.5"
        :aria-label="t('space.label')"
        @update:model-value="onSpaceChange"
      >
        <ToggleGroupItem
          value="2d"
          class="rounded px-2 py-1 text-sm data-[state=on]:bg-zinc-800 data-[state=on]:text-white"
        >
          {{ t("space.twoD") }}
        </ToggleGroupItem>
        <ToggleGroupItem
          value="3d"
          class="rounded px-2 py-1 text-sm data-[state=on]:bg-zinc-800 data-[state=on]:text-white"
        >
          {{ t("space.threeD") }}
        </ToggleGroupItem>
      </ToggleGroupRoot>
      <DrawToolbar />
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
        <PromptShareBar />
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
          >
            <button
              type="button"
              class="block w-full px-3 py-1.5 text-left"
              :class="
                primitive.id === editor.selectionId
                  ? 'bg-zinc-100 font-medium'
                  : undefined
              "
              :aria-pressed="primitive.id === editor.selectionId"
              @click="editor.setSelectionId(primitive.id)"
            >
              {{ primitive.type }} · {{ primitive.id }}
            </button>
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
          <Viewport3d v-if="is3d" />
          <Viewport2d v-else />
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
        <PropertiesPanel />
        <UnderlayPanel />
        <pre
          class="m-3 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-2 text-xs leading-5"
        >{{ serializedDocument }}</pre>
      </aside>
    </div>

    <AlertDialogRoot v-model:open="confirmOpen">
      <AlertDialogPortal>
        <AlertDialogOverlay class="fixed inset-0 z-40 bg-black/40" />
        <AlertDialogContent
          class="fixed left-1/2 top-1/2 z-50 w-96 -translate-x-1/2 -translate-y-1/2 rounded border border-zinc-200 bg-white p-4 shadow-lg"
        >
          <AlertDialogTitle class="text-base font-medium">
            {{ t("space.confirmTitle") }}
          </AlertDialogTitle>
          <AlertDialogDescription class="mt-2 text-sm text-zinc-600">
            {{ t("space.confirmBody") }}
          </AlertDialogDescription>
          <div class="mt-4 flex justify-end gap-2">
            <AlertDialogCancel
              class="rounded border border-zinc-300 bg-white px-2 py-1 text-sm hover:bg-zinc-100"
            >
              {{ t("space.cancel") }}
            </AlertDialogCancel>
            <AlertDialogAction
              class="rounded bg-zinc-800 px-2 py-1 text-sm text-white hover:bg-zinc-700"
              @click="confirmSpaceChange"
            >
              {{ t("space.confirm") }}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>
  </div>
</template>
