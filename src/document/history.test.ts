import { describe, expect, test } from "vitest";
import {
  addPrimitive,
  commitSnapshot,
  createHistory,
  parseDocument,
  redo,
  undo,
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

function mustAdd(
  document: GeometryDocument,
  primitive: Primitive,
): GeometryDocument {
  const result = addPrimitive(document, primitive);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.document;
}

function mustUpdate(
  document: GeometryDocument,
  id: string,
  primitive: Primitive,
): GeometryDocument {
  const result = updatePrimitive(document, id, primitive);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.document;
}

describe("document history snapshots", () => {
  test("undo restores the previous snapshot", () => {
    const start = empty2d();
    const afterAdd = mustAdd(start, circle("circle-1"));
    let history = createHistory(start);
    history = commitSnapshot(history, afterAdd);

    history = undo(history);

    expect(history.present).toEqual(start);
    expect(history.present.primitives).toEqual([]);
  });

  test("redo restores the snapshot undone by undo", () => {
    const start = empty2d();
    const afterAdd = mustAdd(start, circle("circle-1"));
    let history = createHistory(start);
    history = commitSnapshot(history, afterAdd);

    history = undo(history);
    history = redo(history);

    expect(history.present).toEqual(afterAdd);
    expect(history.present.primitives).toEqual([circle("circle-1")]);
  });

  test("one commit is one history step so one undo does not skip the first of two updates", () => {
    const start = empty2d();
    const first = mustAdd(start, circle("circle-1", 2));
    const second = mustUpdate(first, "circle-1", circle("circle-1", 5));
    let history = createHistory(start);
    history = commitSnapshot(history, first);
    history = commitSnapshot(history, second);

    history = undo(history);

    expect(history.present).toEqual(first);
    expect(history.present.primitives).toEqual([circle("circle-1", 2)]);
    expect(history.present).not.toEqual(start);
  });
});
