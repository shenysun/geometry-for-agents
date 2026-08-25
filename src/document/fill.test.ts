import { describe, expect, test } from "vitest";
import { withFill } from "./fill.ts";
import type { Primitive } from "./parse-document.ts";

const circle: Primitive = {
  id: "circle-1",
  type: "circle",
  cx: 0,
  cy: 0,
  r: 2,
  fill: "none",
};

describe("withFill", () => {
  test("returns a new closed primitive with the chosen fill", () => {
    const snapshot = structuredClone(circle);
    const next = withFill(circle, "hatch");

    expect(next).toEqual({ ...circle, fill: "hatch" });
    expect(next).not.toBe(circle);
    expect(circle).toEqual(snapshot);
  });

  test("returns a new rectangle with the chosen fill, keeping size and rotation", () => {
    const rectangle: Primitive = {
      id: "rect-1",
      type: "rectangle",
      x: 1,
      y: 2,
      width: 4,
      height: 2,
      rotationDeg: 30,
      fill: "none",
    };
    const snapshot = structuredClone(rectangle);

    const next = withFill(rectangle, "solid");

    expect(next).toEqual({ ...rectangle, fill: "solid" });
    expect(next).not.toBe(rectangle);
    expect(rectangle).toEqual(snapshot);
  });

  test("returns a new family shape with the chosen fill, keeping geometry", () => {
    const triangle: Primitive = {
      id: "tri-1",
      type: "triangle",
      x: 1,
      y: 2,
      width: 4,
      height: 3,
      apexOffset: 0.5,
      rotationDeg: 30,
      fill: "none",
    };
    const snapshot = structuredClone(triangle);

    const next = withFill(triangle, "hatch");

    expect(next).toEqual({ ...triangle, fill: "hatch" });
    expect(next).not.toBe(triangle);
    expect(triangle).toEqual(snapshot);
  });

  test("returns null for line, arc, and label", () => {
    const line: Primitive = {
      id: "line-1",
      type: "line",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    };
    const arc: Primitive = {
      id: "arc-1",
      type: "arc",
      cx: 0,
      cy: 0,
      r: 2,
      startDeg: 0,
      endDeg: 90,
    };
    const label: Primitive = {
      id: "label-1",
      type: "label",
      x: 0,
      y: 1,
      text: "A",
    };

    expect(withFill(line, "solid")).toBeNull();
    expect(withFill(arc, "solid")).toBeNull();
    expect(withFill(label, "hatch")).toBeNull();
  });

  test("returns null for angle (stroke family, no fill field)", () => {
    const angle: Primitive = {
      id: "angle-1",
      type: "angle",
      x: 0,
      y: 0,
      startDeg: 0,
      endDeg: 90,
      length: 3,
    };

    expect(withFill(angle, "solid")).toBeNull();
  });
});
