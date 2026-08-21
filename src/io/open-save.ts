import { useFileDialog, useObjectUrl } from "@vueuse/core";
import { computed } from "vue";
import type { GeometryDocument } from "../document/index.ts";
import { useDocumentStore } from "../stores/document.ts";

export const DOCUMENT_JSON_FILENAME = "document.json";

export function serializeDocument(document: GeometryDocument): string {
  return JSON.stringify(document, null, 2);
}

export function useOpenSave() {
  const store = useDocumentStore();
  const { open, onChange, reset } = useFileDialog({
    accept: "application/json,.json",
    multiple: false,
  });

  onChange(async (files) => {
    const file = files?.[0];
    if (file === undefined) {
      return;
    }
    store.openFromText(await file.text());
    reset();
  });

  const saveBlob = computed(
    () =>
      new Blob([serializeDocument(store.current)], {
        type: "application/json",
      }),
  );
  const saveUrl = useObjectUrl(saveBlob);

  return {
    openFile: open,
    saveUrl,
    saveFilename: DOCUMENT_JSON_FILENAME,
  };
}
