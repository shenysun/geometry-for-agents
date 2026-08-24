<script setup lang="ts">
import { ref } from "vue";
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
import { useOpenSave } from "../io/open-save.ts";
import PromptShareBar from "../share/PromptShareBar.vue";
import { useDocumentStore } from "../stores/document.ts";
import DockHost from "./DockHost.vue";
import DrawToolbar from "./DrawToolbar.vue";
import LocaleSwitch from "./LocaleSwitch.vue";

const { t } = useI18n();
const documentStore = useDocumentStore();
const { openFile, saveUrl, saveFilename } = useOpenSave();

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
    <!-- 顶栏是整页铬：空间切换、工具、文件、撤销/重做、分享/Prompt、语言都不进停靠区 -->
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

    <!-- 停靠区：工具箱/对象列表/视口/属性面板/垫图的五块可停靠面板 -->
    <main class="min-h-0 flex-1">
      <DockHost />
    </main>

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
