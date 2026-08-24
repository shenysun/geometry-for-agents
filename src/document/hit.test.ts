import { describe, expect, test } from "vitest";
import {
  hitTest,
  parseDocument,
  type GeometryDocument,
} from "./index.ts";

function doc2d(primitives: unknown[]): GeometryDocument {
  const result = parseDocument({
    version: 1,
    space: "2d",
    underlay: null,
    primitives,
  });
  if (!result.success) throw new Error(result.error);
  return result.document;
}

function doc3d(primitives: unknown[]): GeometryDocument {
  const result = parseDocument({
    version: 1,
    space: "3d",
    underlay: null,
    primitives,
  });
  if (!result.success) throw new Error(result.error);
  return result.document;
}

describe("hitTest", () => {
  test("hits the smaller-area closed primitive when two closed shapes overlap", () => {
    const document = doc2d([
      {
        id: "outer",
        type: "circle",
        cx: 0,
        cy: 0,
        r: 4,
        fill: "none",
      },
      {
        id: "inner",
        type: "circle",
        cx: 0,
        cy: 0,
        r: 1,
        fill: "solid",
      },
    ]);

    const hit = hitTest(document, { x: 0.2, y: -0.3 });

    expect(hit?.id).toBe("inner");
  });

  test("hits the smaller nested closed primitive even if it is listed first", () => {
    const document = doc2d([
      {
        id: "small-poly",
        type: "polygon",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
        ],
        fill: "hatch",
      },
      {
        id: "big-poly",
        type: "polygon",
        points: [
          { x: -2, y: -2 },
          { x: 4, y: -2 },
          { x: 4, y: 4 },
          { x: -2, y: 4 },
        ],
        fill: "none",
      },
    ]);

    const hit = hitTest(document, { x: 0.2, y: 0.2 });

    expect(hit?.id).toBe("small-poly");
  });

  test("hits a ring in the annulus and the inner circle in the hole", () => {
    const document = doc2d([
      {
        id: "ring",
        type: "ring",
        cx: 0,
        cy: 0,
        rInner: 2,
        rOuter: 4,
        fill: "solid",
      },
      {
        id: "core",
        type: "circle",
        cx: 0,
        cy: 0,
        r: 1,
        fill: "solid",
      },
    ]);

    expect(hitTest(document, { x: 3, y: 0 })?.id).toBe("ring");
    expect(hitTest(document, { x: 0, y: 0 })?.id).toBe("core");
  });

  test("returns null when the point is outside every primitive", () => {
    const document = doc2d([
      {
        id: "circle",
        type: "circle",
        cx: 0,
        cy: 0,
        r: 1,
        fill: "solid",
      },
    ]);

    expect(hitTest(document, { x: 3, y: 3 })).toBeNull();
  });

  test("hits a smaller ellipse nested in a circle", () => {
    const document = doc2d([
      {
        id: "circle",
        type: "circle",
        cx: 0,
        cy: 0,
        r: 3,
        fill: "none",
      },
      {
        id: "ellipse",
        type: "ellipse",
        cx: 0,
        cy: 0,
        rx: 1,
        ry: 0.5,
        fill: "solid",
      },
    ]);

    expect(hitTest(document, { x: 0.4, y: 0.1 })?.id).toBe("ellipse");
  });

  test("hits a sector rather than the larger enclosing circle", () => {
    const document = doc2d([
      {
        id: "circle",
        type: "circle",
        cx: 0,
        cy: 0,
        r: 2,
        fill: "solid",
      },
      {
        id: "sector",
        type: "sector",
        cx: 0,
        cy: 0,
        r: 2,
        startDeg: 0,
        endDeg: 90,
        fill: "hatch",
      },
    ]);

    expect(hitTest(document, { x: 1, y: 0.2 })?.id).toBe("sector");
  });

  test("hits a bow rather than the larger enclosing circle", () => {
    const document = doc2d([
      {
        id: "circle",
        type: "circle",
        cx: 0,
        cy: 0,
        r: 2,
        fill: "solid",
      },
      {
        id: "bow",
        type: "bow",
        cx: 0,
        cy: 0,
        r: 2,
        startDeg: 0,
        endDeg: 90,
        fill: "hatch",
      },
    ]);

    const onCap = { x: Math.cos(Math.PI / 4) * 1.9, y: Math.sin(Math.PI / 4) * 1.9 };
    expect(hitTest(document, onCap)?.id).toBe("bow");
    expect(hitTest(document, { x: 0, y: 0 })?.id).toBe("circle");
  });

  test("treats a 0° to 360° sector as a full disk", () => {
    const document = doc2d([
      {
        id: "full",
        type: "sector",
        cx: 0,
        cy: 0,
        r: 2,
        startDeg: 0,
        endDeg: 360,
        fill: "solid",
      },
    ]);

    expect(hitTest(document, { x: -1, y: 0 })?.id).toBe("full");
  });

  test("hits the unit voxel whose occupancy cube contains the point", () => {
    const document = doc3d([
      { id: "a", type: "voxel", x: 0, y: 0, z: 0 },
      { id: "b", type: "voxel", x: 1, y: 0, z: 0 },
    ]);

    expect(hitTest(document, { x: 0.25, y: 0.5, z: 0.75 })?.id).toBe("a");
    expect(hitTest(document, { x: 1.25, y: 0.5, z: 0.75 })?.id).toBe("b");
    expect(hitTest(document, { x: 0.5, y: 2, z: 0.5 })).toBeNull();
  });
});

describe("hitTest 命中容差", () => {
  test("细线在容差内可命中，零容差保持精确", () => {
    const document = doc2d([
      {
        id: "line",
        type: "line",
        points: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
        ],
      },
    ]);
    const near = { x: 2, y: 0.3 };

    expect(hitTest(document, near, 0.5)?.id).toBe("line");
    expect(hitTest(document, near)).toBeNull();
    expect(hitTest(document, near, 0.2)).toBeNull();
  });

  test("弧在半径容差内可命中", () => {
    const document = doc2d([
      {
        id: "arc",
        type: "arc",
        cx: 0,
        cy: 0,
        r: 2,
        startDeg: 0,
        endDeg: 90,
      },
    ]);

    expect(hitTest(document, { x: 2.2, y: 0 }, 0.25)?.id).toBe("arc");
    expect(hitTest(document, { x: -2.2, y: 0 }, 0.25)).toBeNull();
    expect(hitTest(document, { x: 4, y: 4 }, 0.25)).toBeNull();
  });

  test("标签点在容差内可命中", () => {
    const document = doc2d([
      { id: "label", type: "label", x: 1, y: 1, text: "A" },
    ]);

    expect(hitTest(document, { x: 1.2, y: 1 }, 0.5)?.id).toBe("label");
    expect(hitTest(document, { x: 1.2, y: 1 })).toBeNull();
  });
});
