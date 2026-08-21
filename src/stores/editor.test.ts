import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, test } from "vitest";
import { useEditorStore } from "./editor.ts";

function stubBrowserLanguages(languages: string[]): void {
  Object.defineProperty(globalThis.navigator, "languages", {
    configurable: true,
    get: () => languages,
  });
}

describe("editor store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test("default locale follows browser en*", () => {
    stubBrowserLanguages(["en-US", "en"]);
    const store = useEditorStore();
    expect(store.locale).toBe("en");
  });

  test("default locale follows browser zh*", () => {
    stubBrowserLanguages(["zh-CN"]);
    const store = useEditorStore();
    expect(store.locale).toBe("zh");
  });

  test("default locale is zh when browser language is neither en nor zh", () => {
    stubBrowserLanguages(["ja-JP"]);
    const store = useEditorStore();
    expect(store.locale).toBe("zh");
  });

  test("locale can be switched manually between zh and en", () => {
    stubBrowserLanguages(["zh-CN"]);
    const store = useEditorStore();

    store.setLocale("en");
    expect(store.locale).toBe("en");

    store.setLocale("zh");
    expect(store.locale).toBe("zh");
  });
});
