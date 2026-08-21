import { describe, expect, test } from "vitest";
import {
  addPrimitive,
  parseDocument,
  removePrimitive,
  updatePrimitive,
} from "./index.ts";
import type { GeometryDocument, Primitive } from "./index.ts";

function mustParse(input: unknown): GeometryDocument {
  const result = parseDocument(input);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.document;
}

const empty2d = (): GeometryDocument =>
  mustParse({ version: 1, space: "2d", underlay: null, primitives: [] });

const circle = (id: string, r = 2): Primitive => ({
  id,
  type: "circle",
  cx: 0,
  cy: 0,
  r,
  fill: "solid",
});

const bow = (id: string): Primitive => ({
  id,
  type: "bow",
  cx: 1,
  cy: 1,
  r: 3,
  startDeg: 45,
  endDeg: 135,
  fill: "hatch",
});

describe("addPrimitive", () => {
  test("returns a new document and leaves the original unchanged", () => {
    const original = empty2d();
    const snapshot = structuredClone(original);
    const primitive = circle("circle-1");

    const result = addPrimitive(original, primitive);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document).not.toBe(original);
    expect(result.document.primitives).not.toBe(original.primitives);
    expect(original).toEqual(snapshot);
    expect(original.primitives).toEqual([]);
    expect(result.document.primitives).toEqual([primitive]);
  });

  test("does not let later mutation of the returned document change the original", () => {
    const original = mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [circle("circle-1")],
    });
    const snapshot = structuredClone(original);
    const result = addPrimitive(original, bow("bow-1"));
    expect(result.success).toBe(true);
    if (!result.success) return;

    result.document.primitives.length = 0;

    expect(original).toEqual(snapshot);
    expect(original.primitives).toHaveLength(1);
  });
});

describe("removePrimitive", () => {
  test("returns a new document without the primitive and leaves the original unchanged", () => {
    const keep = circle("keep");
    const gone = bow("gone");
    const original = mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [keep, gone],
    });
    const snapshot = structuredClone(original);

    const result = removePrimitive(original, "gone");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document).not.toBe(original);
    expect(result.document.primitives).not.toBe(original.primitives);
    expect(original).toEqual(snapshot);
    expect(result.document.primitives).toEqual([keep]);
  });
});

describe("updatePrimitive", () => {
  test("returns a new document with updated properties and leaves the original unchanged", () => {
    const originalPrimitive = circle("circle-1", 2);
    const original = mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [originalPrimitive],
    });
    const snapshot = structuredClone(original);
    const updated = circle("circle-1", 5);

    const result = updatePrimitive(original, "circle-1", updated);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document).not.toBe(original);
    expect(result.document.primitives).not.toBe(original.primitives);
    expect(original).toEqual(snapshot);
    expect(original.primitives[0]).toEqual(originalPrimitive);
    expect(result.document.primitives).toEqual([updated]);
  });
});
