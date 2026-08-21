import { createI18n } from "vue-i18n";
import { browserLanguages, localeFromLanguages } from "./locale.ts";
import { messages } from "./messages.ts";

export function createAppI18n(languages: readonly string[] = browserLanguages()) {
  return createI18n({
    legacy: false,
    locale: localeFromLanguages(languages),
    fallbackLocale: "zh",
    messages,
  });
}

export { localeFromLanguages } from "./locale.ts";
export type { AppLocale } from "./locale.ts";
