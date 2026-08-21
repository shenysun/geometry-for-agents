<script setup lang="ts">
import { useFileDialog } from "@vueuse/core";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useDocumentStore } from "../stores/document.ts";
import { useEditorStore } from "../stores/editor.ts";
import {
  assignUnderlaySource,
  DEFAULT_UNDERLAY_ALIGNMENT,
  isHttpUnderlayUrl,
  type UnderlayAlignment,
} from "../viewport2d/draw-underlay.ts";

const { t } = useI18n();
const documentStore = useDocumentStore();
const editorStore = useEditorStore();

const urlInput = ref("");
const urlError = ref(false);

const { open, onChange, reset } = useFileDialog({
  accept: "image/*,.png,.jpg,.jpeg,.gif,.webp,.svg",
  multiple: false,
});

const alignment = computed((): UnderlayAlignment => {
  const session = editorStore.sessionUnderlay;
  if (session !== null) {
    return {
      opacity: session.opacity,
      x: session.x,
      y: session.y,
      scale: session.scale,
    };
  }
  const documentUnderlay = documentStore.current.underlay;
  if (documentUnderlay !== null) {
    return {
      opacity: documentUnderlay.opacity,
      x: documentUnderlay.x,
      y: documentUnderlay.y,
      scale: documentUnderlay.scale,
    };
  }
  return DEFAULT_UNDERLAY_ALIGNMENT;
});

const hasUnderlay = computed(
  () =>
    editorStore.sessionUnderlay !== null ||
    documentStore.current.underlay !== null,
);

function applySource(source: string): void {
  const assignment = assignUnderlaySource(source, alignment.value);
  editorStore.setSessionUnderlay(assignment.sessionUnderlay);
  documentStore.setUnderlay(assignment.documentUnderlay);
}

function applyUrl(): void {
  const source = urlInput.value.trim();
  if (!isHttpUnderlayUrl(source)) {
    urlError.value = true;
    return;
  }
  urlError.value = false;
  applySource(source);
}

function applyAlignment(next: UnderlayAlignment): void {
  const session = editorStore.sessionUnderlay;
  if (session !== null) {
    editorStore.setSessionUnderlay({ url: session.url, ...next });
    return;
  }
  const current = documentStore.current.underlay;
  if (current === null) {
    return;
  }
  documentStore.setUnderlay(
    current.url === undefined
      ? { ...next }
      : { url: current.url, ...next },
  );
}

function parseNumber(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function onOpacity(event: Event): void {
  const value = parseNumber((event.target as HTMLInputElement).value);
  if (value === null) return;
  applyAlignment({
    ...alignment.value,
    opacity: Math.min(1, Math.max(0, value)),
  });
}

function onX(event: Event): void {
  const value = parseNumber((event.target as HTMLInputElement).value);
  if (value === null) return;
  applyAlignment({ ...alignment.value, x: value });
}

function onY(event: Event): void {
  const value = parseNumber((event.target as HTMLInputElement).value);
  if (value === null) return;
  applyAlignment({ ...alignment.value, y: value });
}

function onScale(event: Event): void {
  const value = parseNumber((event.target as HTMLInputElement).value);
  if (value === null || value <= 0) return;
  applyAlignment({ ...alignment.value, scale: value });
}

function clearUnderlay(): void {
  editorStore.setSessionUnderlay(null);
  documentStore.setUnderlay(null);
  urlInput.value = "";
  urlError.value = false;
}

onChange((files) => {
  const file = files?.[0];
  if (file === undefined) {
    return;
  }
  applySource(URL.createObjectURL(file));
  reset();
});
</script>

<template>
  <section class="space-y-3 border-t border-zinc-200 px-3 py-3 text-sm">
    <h3 class="font-medium">{{ t("underlay.label") }}</h3>
    <div class="flex flex-col gap-2">
      <label class="text-zinc-500" for="underlay-url">{{ t("underlay.url") }}</label>
      <input
        id="underlay-url"
        v-model="urlInput"
        type="url"
        class="rounded border border-zinc-300 px-2 py-1"
        @keydown.enter.prevent="applyUrl"
      />
      <button
        type="button"
        class="rounded border border-zinc-300 bg-white px-2 py-1 hover:bg-zinc-100"
        @click="applyUrl"
      >
        {{ t("underlay.applyUrl") }}
      </button>
      <p v-if="urlError" role="alert" class="text-red-800">
        {{ t("underlay.httpOnly") }}
      </p>
    </div>
    <button
      type="button"
      class="rounded border border-zinc-300 bg-white px-2 py-1 hover:bg-zinc-100"
      @click="open()"
    >
      {{ t("underlay.importFile") }}
    </button>
    <p
      v-if="editorStore.sessionUnderlay !== null"
      class="text-zinc-600"
    >
      {{ t("underlay.localOnly") }}
    </p>
    <div v-if="hasUnderlay" class="space-y-2">
      <label class="flex items-center justify-between gap-2">
        <span class="text-zinc-500">{{ t("underlay.opacity") }}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="alignment.opacity"
          @change="onOpacity"
        />
      </label>
      <label class="flex items-center justify-between gap-2">
        <span class="text-zinc-500">{{ t("underlay.x") }}</span>
        <input
          type="number"
          step="0.5"
          class="w-24 rounded border border-zinc-300 px-2 py-1"
          :value="alignment.x"
          @change="onX"
        />
      </label>
      <label class="flex items-center justify-between gap-2">
        <span class="text-zinc-500">{{ t("underlay.y") }}</span>
        <input
          type="number"
          step="0.5"
          class="w-24 rounded border border-zinc-300 px-2 py-1"
          :value="alignment.y"
          @change="onY"
        />
      </label>
      <label class="flex items-center justify-between gap-2">
        <span class="text-zinc-500">{{ t("underlay.scale") }}</span>
        <input
          type="number"
          min="0.01"
          step="0.05"
          class="w-24 rounded border border-zinc-300 px-2 py-1"
          :value="alignment.scale"
          @change="onScale"
        />
      </label>
      <button
        type="button"
        class="rounded border border-zinc-300 bg-white px-2 py-1 hover:bg-zinc-100"
        @click="clearUnderlay"
      >
        {{ t("underlay.clear") }}
      </button>
    </div>
  </section>
</template>
