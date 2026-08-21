import { parseDocument } from "./parse-document.ts";
import type { GeometryDocument, Primitive } from "./parse-document.ts";

export type DocumentUpdateResult =
  | { success: true; document: GeometryDocument }
  | { success: false; error: string };

function replaceDocument(
  document: GeometryDocument,
  patch: {
    underlay: GeometryDocument["underlay"];
    primitives: Primitive[];
  },
): DocumentUpdateResult {
  return parseDocument(
    structuredClone({
      version: document.version,
      space: document.space,
      underlay: patch.underlay,
      primitives: patch.primitives,
    }),
  );
}

function replacePrimitives(
  document: GeometryDocument,
  primitives: Primitive[],
): DocumentUpdateResult {
  return replaceDocument(document, {
    underlay: document.underlay,
    primitives,
  });
}

export function setUnderlay(
  document: GeometryDocument,
  underlay: GeometryDocument["underlay"],
): DocumentUpdateResult {
  return replaceDocument(document, {
    underlay,
    primitives: document.primitives,
  });
}

function missingId(id: string): DocumentUpdateResult {
  return { success: false, error: `primitive id "${id}" not found` };
}

export function addPrimitive(
  document: GeometryDocument,
  primitive: Primitive,
): DocumentUpdateResult {
  return replacePrimitives(document, [...document.primitives, primitive]);
}

export function removePrimitive(
  document: GeometryDocument,
  id: string,
): DocumentUpdateResult {
  if (!document.primitives.some((primitive) => primitive.id === id)) {
    return missingId(id);
  }
  return replacePrimitives(
    document,
    document.primitives.filter((primitive) => primitive.id !== id),
  );
}

export function updatePrimitive(
  document: GeometryDocument,
  id: string,
  primitive: Primitive,
): DocumentUpdateResult {
  if (!document.primitives.some((current) => current.id === id)) {
    return missingId(id);
  }
  return replacePrimitives(
    document,
    document.primitives.map((current) =>
      current.id === id ? { ...primitive, id } : current,
    ),
  );
}
