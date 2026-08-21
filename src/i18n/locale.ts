export type AppLocale = "zh" | "en";

export function localeFromLanguages(languages: readonly string[]): AppLocale {
  const primary = languages[0]?.toLowerCase() ?? "";
  if (primary.startsWith("en")) {
    return "en";
  }
  return "zh";
}

export function browserLanguages(): readonly string[] {
  if (typeof navigator === "undefined") {
    return [];
  }
  return navigator.languages;
}
