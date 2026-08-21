import { defineStore } from "pinia";
import { computed, ref, shallowRef } from "vue";
import {
  addPrimitive as addPrimitiveToDocument,
  commitSnapshot,
  createHistory,
  hashToDocument,
  parseDocument,
  redo as redoHistory,
  removePrimitive as removePrimitiveFromDocument,
  setUnderlay as setDocumentUnderlay,
  undo as undoHistory,
  updatePrimitive as updatePrimitiveInDocument,
  type DocumentUpdateResult,
  type GeometryDocument,
  type Primitive,
} from "../document/index.ts";
import { useEditorStore } from "./editor.ts";

type OpenResult =
  | { success: true }
  | { success: false; error: string };

function empty2dDocument(): GeometryDocument {
  const parsed = parseDocument({
    version: 1,
    space: "2d",
    underlay: null,
    primitives: [],
  });
  if (!parsed.success) {
    throw new Error(parsed.error);
  }
  return parsed.document;
}

export const useDocumentStore = defineStore("document", () => {
  const history = shallowRef(createHistory(empty2dDocument()));
  const openError = ref<string | null>(null);
  const hashError = ref<string | null>(null);

  const current = computed(() => history.value.present);
  const canUndo = computed(() => history.value.past.length > 0);
  const canRedo = computed(() => history.value.future.length > 0);

  function applyParsed(
    parsed: ReturnType<typeof parseDocument>,
    failure: "open" | "hash",
  ): OpenResult {
    if (!parsed.success) {
      if (failure === "hash") {
        hashError.value = parsed.error;
      } else {
        openError.value = parsed.error;
      }
      return parsed;
    }
    history.value = createHistory(parsed.document);
    openError.value = null;
    hashError.value = null;
    useEditorStore().setSessionUnderlay(null);
    return { success: true };
  }

  function openFromText(text: string): OpenResult {
    return applyParsed(parseDocument(text), "open");
  }

  function openFromHash(hash: string): OpenResult {
    return applyParsed(hashToDocument(hash), "hash");
  }

  function undo(): void {
    history.value = undoHistory(history.value);
  }

  function redo(): void {
    history.value = redoHistory(history.value);
  }

  function applyUpdate(result: DocumentUpdateResult): DocumentUpdateResult {
    if (!result.success) {
      return result;
    }
    history.value = commitSnapshot(history.value, result.document);
    return result;
  }

  function addPrimitive(primitive: Primitive): DocumentUpdateResult {
    return applyUpdate(addPrimitiveToDocument(current.value, primitive));
  }

  function removePrimitive(id: string): DocumentUpdateResult {
    return applyUpdate(removePrimitiveFromDocument(current.value, id));
  }

  function updatePrimitive(
    id: string,
    primitive: Primitive,
  ): DocumentUpdateResult {
    return applyUpdate(
      updatePrimitiveInDocument(current.value, id, primitive),
    );
  }

  function setUnderlay(
    underlay: GeometryDocument["underlay"],
  ): DocumentUpdateResult {
    if (JSON.stringify(current.value.underlay) === JSON.stringify(underlay)) {
      return { success: true, document: current.value };
    }
    return applyUpdate(setDocumentUnderlay(current.value, underlay));
  }

  return {
    current,
    openError,
    hashError,
    canUndo,
    canRedo,
    openFromText,
    openFromHash,
    undo,
    redo,
    addPrimitive,
    removePrimitive,
    updatePrimitive,
    setUnderlay,
  };
});
