import { describe, expect, test } from "vitest";
import {
  clickPickMeasure,
  type PickMeasureContext,
} from "./pick-measure-gesture.ts";
import { parseDocument, type GeometryDocument } from "../document/index.ts";

function measureDoc(): GeometryDocument {
  const result = parseDocument({
    version: 1,
    space: "2d",
    underlay: null,
    primitives: [
      { id: "circle-a", type: "circle", cx: 0, cy: 0, r: 4, fill: "none" },
      { id: "rect-b", type: "rectangle", x: 2, y: 0, width: 4, height: 6, fill: "none" },
      {
        id: "line-c",
        type: "line",
        points: [
          { x: -10, y: -10 },
          { x: -9, y: -9 },
        ],
      },
    ],
  });
  if (!result.success) throw new Error(result.error);
  return result.document;
}

function ctxAt(over: Partial<PickMeasureContext> = {}): PickMeasureContext {
  return {
    document: measureDoc(),
    point: { x: 2, y: 0 },
    tolerance: 0,
    id: "measure-new",
    ...over,
  };
}

describe("clickPickMeasure 拾取（ADR 0020）", () => {
  test("click on a closed shape commits an area measure and reports selection", () => {
    // (-2,0) 在圆内、矩形（x∈[0,4]）外，命中无歧义。
    const result = clickPickMeasure(ctxAt({ point: { x: -2, y: 0 } }), "area");

    expect(result.commit).toEqual({
      id: "measure-new",
      type: "measure",
      sourceId: "circle-a",
      kind: "area",
    });
    expect(result.selectionId).toBe("measure-new");
    expect(result.rejection).toBeNull();
  });

  test("perimeter kind flows into the committed entry", () => {
    const result = clickPickMeasure(ctxAt({ point: { x: -2, y: 0 } }), "perimeter");

    expect(result.commit).toMatchObject({ kind: "perimeter" });
  });

  test("stroke-family pick is rejected without committing", () => {
    const result = clickPickMeasure(
      ctxAt({ point: { x: -9.5, y: -9.5 }, tolerance: 1 }),
      "area",
    );

    expect(result.commit).toBeNull();
    expect(result.rejection).toBe("not-measurable");
  });

  test("clicking empty space is ignored", () => {
    const result = clickPickMeasure(ctxAt({ point: { x: 100, y: 100 } }), "area");

    expect(result.commit).toBeNull();
    expect(result.selectionId).toBeUndefined();
    expect(result.rejection).toBeNull();
  });

  test("an overlapFill entry itself cannot be picked as a measure source", () => {
    const base = measureDoc();
    const result = parseDocument({
      ...base,
      primitives: [
        ...base.primitives,
        { id: "fill-old", type: "overlapFill", sources: ["circle-a", "rect-b"], fill: "solid" },
      ],
    });
    if (!result.success) throw new Error(result.error);

    // (2,0) 在两源交集内：命中引用条目，按白名单拒绝。
    const pick = clickPickMeasure(ctxAt({ document: result.document }), "area");
    expect(pick.commit).toBeNull();
    expect(pick.rejection).toBe("not-measurable");
  });

  test("3D document is ignored", () => {
    const result = parseDocument({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [{ id: "voxel-a", type: "voxel", x: 0, y: 0, z: 0 }],
    });
    if (!result.success) throw new Error(result.error);

    const pick = clickPickMeasure(
      ctxAt({ document: result.document, point: { x: 0.5, y: 0.5 } }),
      "area",
    );
    expect(pick.commit).toBeNull();
    expect(pick.rejection).toBeNull();
  });
});
