import { describe, expect, test } from "vitest";
import {
  panView,
  screenToWorld,
  worldToScreen,
  zoomViewAt,
  type ViewTransform,
} from "./transform.ts";

const view: ViewTransform = { originX: 100, originY: 200, scale: 10 };

describe("worldToScreen Y-up", () => {
  test("maps world origin to the view origin on screen", () => {
    expect(worldToScreen({ x: 0, y: 0 }, view)).toEqual({ x: 100, y: 200 });
  });

  test("maps +X to the right", () => {
    expect(worldToScreen({ x: 1, y: 0 }, view)).toEqual({ x: 110, y: 200 });
  });

  test("maps +Y up, so screen y decreases", () => {
    expect(worldToScreen({ x: 0, y: 1 }, view)).toEqual({ x: 100, y: 190 });
  });

  test("scales both axes by pixels per world unit", () => {
    expect(worldToScreen({ x: 2, y: 3 }, view)).toEqual({ x: 120, y: 170 });
  });
});

describe("screenToWorld Y-up", () => {
  test("inverts worldToScreen for a point above and to the right of origin", () => {
    expect(screenToWorld({ x: 120, y: 170 }, view)).toEqual({ x: 2, y: 3 });
  });

  test("round-trips a point in the lower-left quadrant", () => {
    const world = { x: -4, y: -1.5 };
    expect(screenToWorld(worldToScreen(world, view), view)).toEqual(world);
  });
});

describe("view pan and zoom", () => {
  test("pan shifts the screen origin without changing scale", () => {
    expect(panView(view, 15, -8)).toEqual({
      originX: 115,
      originY: 192,
      scale: 10,
    });
  });

  test("zoom keeps the world point under the cursor", () => {
    const cursor = { x: 130, y: 180 };
    const worldUnderCursor = screenToWorld(cursor, view);
    const zoomed = zoomViewAt(view, cursor, 2);

    expect(zoomed.scale).toBe(20);
    expect(screenToWorld(cursor, zoomed)).toEqual(worldUnderCursor);
    expect(worldToScreen(worldUnderCursor, zoomed)).toEqual(cursor);
  });
});
