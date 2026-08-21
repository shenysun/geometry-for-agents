import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, test } from "vitest";
import { parseDocument } from "../document/index.ts";
import { useDocumentStore } from "./document.ts";

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
});
