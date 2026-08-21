import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, test } from "vitest";
import { useDocumentStore } from "./document.ts";
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

  test("current tool and grid snap live on the editor store", () => {
    const store = useEditorStore();
    expect(store.tool).toBe("select");
    expect(store.grid).toBe(1);
    expect(store.selectionId).toBeNull();

    store.setTool("line");
    store.setGrid(0.5);
    store.setSelectionId("line-1");
    expect(store.tool).toBe("line");
    expect(store.grid).toBe(0.5);
    expect(store.selectionId).toBe("line-1");

    store.setTool("polygon");
    store.setGrid("off");
    expect(store.tool).toBe("polygon");
    expect(store.grid).toBe("off");
  });

  test("selecting a primitive by id then removePrimitive deletes it", () => {
    const document = useDocumentStore();
    const editor = useEditorStore();
    const line = {
      id: "line-1",
      type: "line" as const,
      points: [
        { x: 0, y: 0 },
        { x: 3, y: 1 },
      ],
    };

    const added = document.addPrimitive(line);
    expect(added.success).toBe(true);
    expect(document.current.primitives).toEqual([line]);

    editor.setSelectionId(line.id);
    const selectedId = editor.selectionId;
    expect(selectedId).toBe("line-1");
    if (selectedId === null) {
      throw new Error("selectionId should be the selected 图元");
    }

    const removed = document.removePrimitive(selectedId);
    expect(removed.success).toBe(true);
    expect(document.current.primitives).toEqual([]);
  });
});
