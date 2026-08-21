import { defineStore } from "pinia";
import { ref } from "vue";
import {
  parseDocument,
  type GeometryDocument,
} from "../document/index.ts";

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
  const current = ref<GeometryDocument>(empty2dDocument());

  function setDocument(next: GeometryDocument): void {
    current.value = next;
  }

  return { current, setDocument };
});
