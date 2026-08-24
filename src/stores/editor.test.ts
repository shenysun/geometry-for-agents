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

    store.setTool("circle");
    expect(store.tool).toBe("circle");
    store.setTool("label");
    expect(store.tool).toBe("label");
  });

  test("voxel 是工具；跨空间的创建工具在切换空间时退回选择", () => {
    const store = useEditorStore();

    store.setTool("voxel");
    expect(store.tool).toBe("voxel");
    // 3D 的单位立方体带不进 2D
    store.setSpace("2d");
    expect(store.tool).toBe("select");

    // 2D 的创建工具带不进 3D
    store.setTool("circle");
    store.setSpace("3d");
    expect(store.tool).toBe("select");

    // 选择工具跨空间保持
    store.setSpace("2d");
    expect(store.tool).toBe("select");
  });

  test("box 是 3D 创建工具；带不进 2D，留在 3D 保持", () => {
    const store = useEditorStore();

    store.setTool("box");
    expect(store.tool).toBe("box");

    // 3D 的长方体工具带不进 2D
    store.setSpace("2d");
    expect(store.tool).toBe("select");

    // 回到 3D 重新拿起长方体，同空间切换保持
    store.setSpace("3d");
    store.setTool("box");
    store.setSpace("3d");
    expect(store.tool).toBe("box");
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
