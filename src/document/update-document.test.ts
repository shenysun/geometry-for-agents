import { describe, expect, test } from "vitest";
import {
  addPrimitive,
  parseDocument,
  removePrimitive,
  setUnderlay,
  updatePrimitive,
} from "./index.ts";
import type { GeometryDocument, Primitive } from "./index.ts";
import {
  translatePrimitive,
  translatePrimitiveGeometry,
} from "./update-document.ts";

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

describe("translatePrimitiveGeometry", () => {
  test("moves every line point and keeps the id", () => {
    const line: Primitive = {
      id: "line-1",
      type: "line",
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 1 },
      ],
    };

    const moved = translatePrimitiveGeometry(line, 1, 2);

    expect(moved).toEqual({
      id: "line-1",
      type: "line",
      points: [
        { x: 1, y: 2 },
        { x: 3, y: 3 },
      ],
    });
    expect(line.points[0]).toEqual({ x: 0, y: 0 });
  });

  test("moves a sweep center keeping r and angles", () => {
    const sector: Primitive = {
      id: "sector-1",
      type: "sector",
      cx: 1,
      cy: -1,
      r: 3,
      startDeg: 45,
      endDeg: 135,
      fill: "hatch",
    };

    const moved = translatePrimitiveGeometry(sector, -1, 1);

    expect(moved).toEqual({
      id: "sector-1",
      type: "sector",
      cx: 0,
      cy: 0,
      r: 3,
      startDeg: 45,
      endDeg: 135,
      fill: "hatch",
    });
  });

  test("moves polygon points keeping fill, and label x y keeping text", () => {
    const polygon: Primitive = {
      id: "poly-1",
      type: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
      fill: "solid",
    };
    expect(translatePrimitiveGeometry(polygon, 2, 3)).toEqual({
      id: "poly-1",
      type: "polygon",
      points: [
        { x: 2, y: 3 },
        { x: 3, y: 3 },
        { x: 2, y: 4 },
      ],
      fill: "solid",
    });

    const label: Primitive = { id: "label-1", type: "label", x: 0, y: 0, text: "A" };
    expect(translatePrimitiveGeometry(label, 1, 1)).toEqual({
      id: "label-1",
      type: "label",
      x: 1,
      y: 1,
      text: "A",
    });
  });
});

describe("translatePrimitive", () => {
  const lineDoc = () =>
    mustParse({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [
        {
          id: "line-1",
          type: "line",
          points: [
            { x: 0, y: 0 },
            { x: 2, y: 1 },
          ],
        },
        { id: "circle-1", type: "circle", cx: 5, cy: 0, r: 1, fill: "none" },
      ],
    });

  test("把吸附后的世界位移写进几何字段并保持原说明书不变", () => {
    const original = lineDoc();
    const snapshot = structuredClone(original);

    const result = translatePrimitive(original, "line-1", 0.4, 1.6, 1);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.primitives[0]).toEqual({
      id: "line-1",
      type: "line",
      points: [
        { x: 0, y: 2 },
        { x: 2, y: 3 },
      ],
    });
    expect(result.document.primitives[1]).toEqual(
      original.primitives[1],
    );
    expect(original).toEqual(snapshot);
  });

  test("半格与关：位移分别落半格与保留原始值", () => {
    const original = lineDoc();

    const half = translatePrimitive(original, "circle-1", 0.3, 0.1, 0.5);
    expect(half.success).toBe(true);
    if (!half.success) return;
    expect(half.document.primitives[1]).toEqual({
      id: "circle-1",
      type: "circle",
      cx: 5.5,
      cy: 0,
      r: 1,
      fill: "none",
    });

    const off = translatePrimitive(original, "circle-1", 0.3, 0.1, "off");
    expect(off.success).toBe(true);
    if (!off.success) return;
    expect(off.document.primitives[1]).toEqual({
      id: "circle-1",
      type: "circle",
      cx: 5.3,
      cy: 0.1,
      r: 1,
      fill: "none",
    });
  });

  test("零位移返回原文档相等的说明书且不产生变化", () => {
    const original = lineDoc();
    const result = translatePrimitive(original, "circle-1", 0.4, -0.4, 1);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document).toEqual(original);
  });

  test("id 不存在时报错", () => {
    const result = translatePrimitive(lineDoc(), "ghost", 1, 1, 1);
    expect(result.success).toBe(false);
  });

  test("3D 体素说明书拒绝平移（体素整格平移另有序号）", () => {
    const voxelDoc = mustParse({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [{ id: "vox-1", type: "voxel", x: 0, y: 0, z: 0 }],
    });
    const result = translatePrimitive(voxelDoc, "vox-1", 1, 0, 1);
    expect(result.success).toBe(false);
  });

  test("平移后的说明书仍能通过契约解析", () => {
    const result = translatePrimitive(lineDoc(), "line-1", 2, -1, 1);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const parsed = parseDocument(JSON.stringify(result.document));
    expect(parsed.success).toBe(true);
  });
});

describe("setUnderlay", () => {
  test("writes https alignment immutably and roundtrips opacity x y scale", () => {
    const original = empty2d();
    const snapshot = structuredClone(original);
    const underlay = {
      url: "https://example.com/problem.png",
      opacity: 0.4,
      x: 1,
      y: -2,
      scale: 1.5,
    };

    const result = setUnderlay(original, underlay);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document).not.toBe(original);
    expect(original).toEqual(snapshot);
    expect(result.document.underlay).toEqual(underlay);

    const parsed = parseDocument(JSON.stringify(result.document));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.document.underlay).toEqual(underlay);
  });

  test("rejects a file URL so it cannot enter the 说明书", () => {
    const original = empty2d();
    const result = setUnderlay(original, {
      url: "file:///tmp/problem.png",
      opacity: 0.5,
      x: 0,
      y: 0,
      scale: 1,
    });

    expect(result.success).toBe(false);
    expect(original.underlay).toBeNull();
  });
});
