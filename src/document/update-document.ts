import { parseDocument } from "./parse-document.ts";
import type { GeometryDocument, Primitive } from "./parse-document.ts";
import { snap2d, type GridSnap } from "./snap.ts";

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

type TwoDType =
  | "line"
  | "polygon"
  | "circle"
  | "sector"
  | "bow"
  | "arc"
  | "ring"
  | "ellipse"
  | "label";

export type TwoDPrimitive = Extract<Primitive, { type: TwoDType }>;

/** 把已吸附的位移写进图元的几何字段（points / cx cy / x y），不可变。 */
export function translatePrimitiveGeometry(
  primitive: TwoDPrimitive,
  dx: number,
  dy: number,
): TwoDPrimitive {
  switch (primitive.type) {
    case "line":
    case "polygon":
      return {
        ...primitive,
        points: primitive.points.map((point) => ({
          x: point.x + dx,
          y: point.y + dy,
        })),
      };
    case "label":
      return { ...primitive, x: primitive.x + dx, y: primitive.y + dy };
    case "circle":
    case "sector":
    case "bow":
    case "arc":
    case "ring":
    case "ellipse":
      return { ...primitive, cx: primitive.cx + dx, cy: primitive.cy + dy };
  }
}

/** 平移一条 2D 图元：先把世界位移吸附到格，再写入几何字段，返回新说明书。 */
export function translatePrimitive(
  document: GeometryDocument,
  id: string,
  dx: number,
  dy: number,
  grid: GridSnap,
): DocumentUpdateResult {
  if (document.space !== "2d") {
    return {
      success: false,
      error: "translate is only defined for 2D primitives",
    };
  }
  const current = document.primitives.find((primitive) => primitive.id === id);
  if (current === undefined) {
    return missingId(id);
  }
  const delta = snap2d({ x: dx, y: dy }, grid);
  if (delta.x === 0 && delta.y === 0) {
    return { success: true, document };
  }
  return replacePrimitives(
    document,
    document.primitives.map((primitive) =>
      primitive.id === id
        ? translatePrimitiveGeometry(primitive, delta.x, delta.y)
        : primitive,
    ),
  );
}
