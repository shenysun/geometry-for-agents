import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, test } from "vitest";
import { parseDocument, type GeometryDocument } from "../document/index.ts";
import { useDocumentStore } from "../stores/document.ts";
import { serializeDocument } from "./open-save.ts";

const lineDocument = {
  version: 1,
  space: "2d",
  underlay: null,
  primitives: [
    {
      id: "line-1",
      type: "line",
      points: [
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ],
    },
  ],
} as const;

function mustParse(input: unknown): GeometryDocument {
  const result = parseDocument(input);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.document;
}

describe("serializeDocument", () => {
  test("saved JSON parses back through parseDocument", () => {
    const document = mustParse(lineDocument);
    const json = serializeDocument(document);
    const parsed = parseDocument(json);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.document).toEqual(document);
  });
});

describe("open and save through the document store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test("serializing the current 说明书 parses via parseDocument", () => {
    const store = useDocumentStore();
    const parsed = parseDocument(serializeDocument(store.current));

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.document).toEqual(store.current);
  });

  test("opening valid JSON puts primitives on the current 说明书", async () => {
    const store = useDocumentStore();
    const file = new File([JSON.stringify(lineDocument)], "line.json", {
      type: "application/json",
    });

    const result = store.openFromText(await file.text());

    expect(result.success).toBe(true);
    expect(store.current.primitives).toEqual(lineDocument.primitives);
    expect(store.current.primitives.map((primitive) => primitive.id)).toEqual([
      "line-1",
    ]);
    expect(store.openError).toBeNull();
  });

  test("serialized current 说明书 still parses", () => {
    const store = useDocumentStore();
    store.openFromText(JSON.stringify(lineDocument));

    const json = serializeDocument(store.current);
    const parsed = parseDocument(json);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.document).toEqual(store.current);
  });

  test("opening invalid JSON keeps the current 说明书 and reports the reason", () => {
    const store = useDocumentStore();
    store.openFromText(JSON.stringify(lineDocument));
    const before = structuredClone(store.current);

    const result = store.openFromText("{ not json");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.toLowerCase()).toMatch(/json/);
    expect(store.current).toEqual(before);
    expect(store.openError).toBe(result.error);
  });

  test("opening unknown type keeps the current 说明书 and reports the reason", () => {
    const store = useDocumentStore();
    store.openFromText(JSON.stringify(lineDocument));
    const before = structuredClone(store.current);
    const unknown = {
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [
        {
          id: "seg-1",
          type: "segment",
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
        },
      ],
    };

    const result = store.openFromText(JSON.stringify(unknown));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.toLowerCase()).toMatch(/type|segment/);
    expect(store.current).toEqual(before);
    expect(store.openError).toBe(result.error);
  });

  test("opening a space mismatch keeps the current 说明书 and reports the reason", () => {
    const store = useDocumentStore();
    store.openFromText(JSON.stringify(lineDocument));
    const before = structuredClone(store.current);
    const mismatched = {
      version: 1,
      space: "3d",
      underlay: null,
      primitives: lineDocument.primitives,
    };

    const result = store.openFromText(JSON.stringify(mismatched));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('type "line" is not allowed in space "3d"');
    expect(store.current).toEqual(before);
    expect(store.openError).toBe(result.error);
  });

  test("opening a valid file resets snapshot history to that 说明书", () => {
    const store = useDocumentStore();
    store.openFromText(JSON.stringify(lineDocument));

    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(false);
    expect(store.current.primitives).toHaveLength(1);
  });

  test("undo and redo drive snapshot history after a store mutation", () => {
    const store = useDocumentStore();
    const added = store.addPrimitive({
      id: "circle-1",
      type: "circle",
      cx: 0,
      cy: 0,
      r: 2,
      fill: "solid",
    });

    expect(added.success).toBe(true);
    expect(store.current.primitives.map((primitive) => primitive.id)).toEqual([
      "circle-1",
    ]);
    expect(store.canUndo).toBe(true);

    store.undo();
    expect(store.current.primitives).toEqual([]);
    expect(store.canRedo).toBe(true);

    store.redo();
    expect(store.current.primitives.map((primitive) => primitive.id)).toEqual([
      "circle-1",
    ]);
  });
});
