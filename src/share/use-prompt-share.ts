import { useClipboard } from "@vueuse/core";
import { computed } from "vue";
import {
  documentToHash,
  documentToPrompt,
  type GeometryDocument,
} from "../document/index.ts";
import { useDocumentStore } from "../stores/document.ts";

export function shareUrlFor(
  document: GeometryDocument,
  location: Pick<Location, "origin" | "pathname" | "search">,
): string {
  return `${location.origin}${location.pathname}${location.search}#${documentToHash(document)}`;
}

function hashPayload(hash: string): string {
  return hash.startsWith("#") ? hash.slice(1) : hash;
}

export function usePromptShare() {
  const store = useDocumentStore();
  const { copy } = useClipboard({ legacy: true });

  const promptText = computed(() => documentToPrompt(store.current));
  const shareUrl = computed(() => shareUrlFor(store.current, window.location));

  function writeClipboard(text: string): void {
    try {
      void Promise.resolve(copy(text)).catch(() => undefined);
    } catch {
      return;
    }
  }

  function copyPrompt(): string {
    const text = promptText.value;
    writeClipboard(text);
    return text;
  }

  function copyShareUrl(): string {
    const url = shareUrl.value;
    writeClipboard(url);
    return url;
  }

  function loadHash(hash: string) {
    return store.openFromHash(hash);
  }

  function bootFromLocation(hash = window.location.hash) {
    if (hashPayload(hash) === "") {
      return { success: true as const };
    }
    return loadHash(hash);
  }

  return {
    promptText,
    shareUrl,
    copyPrompt,
    copyShareUrl,
    loadHash,
    bootFromLocation,
  };
}
