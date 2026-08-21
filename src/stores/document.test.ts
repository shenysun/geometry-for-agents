import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, test } from "vitest";
import { parseDocument } from "../document/index.ts";
import { useDocumentStore } from "./document.ts";
import { useEditorStore } from "./editor.ts";

function jsonKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(jsonKeys);
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, nested]) => [
      key,
      ...jsonKeys(nested),
    ]);
  }
  return [];
}

describe("document store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test("starts with a valid empty 2d 说明书", () => {
    const store = useDocumentStore();
    const empty = {
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [],
    };

    expect(store.current).toEqual(empty);
    expect(parseDocument(store.current).success).toBe(true);
  });

  test("serialized 说明书 JSON has no Chinese keys", () => {
    const store = useDocumentStore();
    const serialized = JSON.parse(JSON.stringify(store.current)) as unknown;
    const keys = jsonKeys(serialized);
    const chinese = /[\u4e00-\u9fff]/;

    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => chinese.test(key))).toEqual([]);
    expect(keys).toEqual(
      expect.arrayContaining(["version", "space", "underlay", "primitives"]),
    );
  });

  test("requestSpaceChange applies when the 说明书 has no 图元", () => {
    const store = useDocumentStore();
    const editor = useEditorStore();

    expect(store.requestSpaceChange("3d")).toBe("applied");
    expect(store.current.space).toBe("3d");
    expect(store.current.primitives).toEqual([]);
    expect(editor.space).toBe("3d");
  });

  test("requestSpaceChange refuses when 图元 exist and does not convert them", () => {
    const store = useDocumentStore();
    const line = {
      id: "line-1",
      type: "line" as const,
      points: [
        { x: 0, y: 0 },
        { x: 3, y: 1 },
      ],
    };
    expect(store.addPrimitive(line).success).toBe(true);

    expect(store.requestSpaceChange("3d")).toBe("refused");
    expect(store.current.space).toBe("2d");
    expect(store.current.primitives).toEqual([line]);
  });

  test("clearAndSetSpace empties 图元 then switches space and tools", () => {
    const store = useDocumentStore();
    const editor = useEditorStore();
    editor.setTool("line");
    expect(
      store.addPrimitive({
        id: "line-1",
        type: "line",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
      }).success,
    ).toBe(true);

    store.clearAndSetSpace("3d");

    expect(store.current.space).toBe("3d");
    expect(store.current.primitives).toEqual([]);
    expect(editor.space).toBe("3d");
    expect(editor.tool).toBe("select");
    expect(editor.selectionId).toBeNull();
  });

  test("opening a 3d 说明书 syncs editor space and drops 2d tools", () => {
    const store = useDocumentStore();
    const editor = useEditorStore();
    editor.setTool("line");

    const result = store.openFromText(
      JSON.stringify({
        version: 1,
        space: "3d",
        underlay: null,
        primitives: [{ id: "voxel-1", type: "voxel", x: 0, y: 1, z: 0 }],
      }),
    );

    expect(result.success).toBe(true);
    expect(store.current.space).toBe("3d");
    expect(editor.space).toBe("3d");
    expect(editor.tool).toBe("select");
    expect(editor.selectionId).toBeNull();
  });
});
