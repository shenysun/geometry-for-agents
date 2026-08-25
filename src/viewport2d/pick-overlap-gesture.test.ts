import { describe, expect, test } from "vitest";
import {
  clickPickOverlap,
  idlePickOverlapState,
  type PickOverlapContext,
} from "./pick-overlap-gesture.ts";
import { parseDocument, type GeometryDocument } from "../document/index.ts";

function overlapDoc(): GeometryDocument {
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

function ctxAt(over: Partial<PickOverlapContext> = {}): PickOverlapContext {
  return {
    document: overlapDoc(),
    point: { x: 2, y: 0 },
    tolerance: 0,
    id: "fill-new",
    ...over,
  };
}

/** 相交判定注入：默认按点位置粗略给出，个别用例显式覆盖。 */
const always = (value: boolean) => () => value;

describe("clickPickOverlap 两步拾取（ADR 0019）", () => {
  test("first pick on a closed shape records it and highlights", () => {
    // (-2,0) 在圆内、矩形（x∈[0,4]）外，命中无歧义。
    const result = clickPickOverlap(
      idlePickOverlapState(),
      ctxAt({ point: { x: -2, y: 0 } }),
      always(true),
    );

    expect(result.state).toEqual({ kind: "first", id: "circle-a" });
    expect(result.commit).toBeNull();
    expect(result.rejection).toBeNull();
  });

  test("first pick on a stroke-family shape is rejected", () => {
    const result = clickPickOverlap(
      idlePickOverlapState(),
      ctxAt({ point: { x: -9.5, y: -9.5 }, tolerance: 1 }),
      always(true),
    );

    expect(result.state.kind).toBe("idle");
    expect(result.rejection).toBe("not-fillable");
  });

  test("clicking empty space is ignored and keeps progress", () => {
    const first = clickPickOverlap(idlePickOverlapState(), ctxAt(), always(true));
    const result = clickPickOverlap(first.state, ctxAt({ point: { x: 100, y: 100 } }), always(true));

    expect(result.state).toEqual(first.state);
    expect(result.rejection).toBeNull();
    expect(result.commit).toBeNull();
  });

  test("second pick on the same shape is rejected", () => {
    const first = clickPickOverlap(idlePickOverlapState(), ctxAt(), always(true));
    const result = clickPickOverlap(first.state, ctxAt(), always(true));

    expect(result.state).toEqual(first.state);
    expect(result.rejection).toBe("same-source");
  });

  test("non-intersecting pair is rejected", () => {
    const first = clickPickOverlap(
      idlePickOverlapState(),
      ctxAt({ point: { x: -2, y: 0 } }),
      always(true),
    );
    const result = clickPickOverlap(
      first.state,
      ctxAt({ point: { x: 3.8, y: 2.8 } }),
      always(false),
    );

    expect(result.rejection).toBe("no-intersection");
    expect(result.commit).toBeNull();
  });

  test("second pick commits the entry, resets to idle and reports selection", () => {
    const first = clickPickOverlap(
      idlePickOverlapState(),
      ctxAt({ point: { x: -2, y: 0 } }),
      always(true),
    );
    const result = clickPickOverlap(first.state, ctxAt(), always(true));

    expect(result.state.kind).toBe("idle");
    expect(result.commit).toEqual({
      id: "fill-new",
      type: "overlapFill",
      sources: ["circle-a", "rect-b"],
      fill: "hatch",
    });
    expect(result.selectionId).toBe("fill-new");
  });

  test("an overlapFill entry itself cannot be picked as a source", () => {
    const withEntry = overlapDoc();
    // 直接注入一条已有重叠填充，点它的区域命中条目而非源。
    const result = parseDocument({
      ...withEntry,
      primitives: [
        ...withEntry.primitives,
        { id: "fill-old", type: "overlapFill", sources: ["circle-a", "rect-b"], fill: "solid" },
      ],
    });
    if (!result.success) throw new Error(result.error);

    const pick = clickPickOverlap(
      idlePickOverlapState(),
      ctxAt({ document: result.document }),
      always(true),
    );
    expect(pick.rejection).toBe("not-fillable");
  });
});
