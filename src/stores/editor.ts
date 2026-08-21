import { usePreferredLanguages } from "@vueuse/core";
import { defineStore } from "pinia";
import { ref } from "vue";
import { localeFromLanguages, type AppLocale } from "../i18n/locale.ts";

export const useEditorStore = defineStore("editor", () => {
  const preferredLanguages = usePreferredLanguages();
  const locale = ref<AppLocale>(localeFromLanguages(preferredLanguages.value));
  const selectionId = ref<string | null>(null);
  const space = ref<"2d" | "3d">("2d");
  const tool = ref<string | null>(null);

  function setLocale(next: AppLocale): void {
    locale.value = next;
  }

  return { locale, selectionId, space, tool, setLocale };
});
