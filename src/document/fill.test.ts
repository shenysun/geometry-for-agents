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
});
