import { describe, expect, test } from "vitest";
import type { GeometryDocument } from "../document/index.ts";
import {
  clickDraw,
  escDraw,
  idleDrawState,
  moveDraw,
  startDraw,
  upDraw,
  type DrawContext,
} from "./draw-gesture.ts";

const lineId = "line-1";
const polygonId = "polygon-1";

function ctx(
  tool: DrawContext["tool"],
  point: { x: number; y: number },
  grid: DrawContext["grid"] = 1,
  id = lineId,
): DrawContext {
  return { tool, point, grid, id };
}

describe("draw-gesture reducer", () => {
  test("drag line commits a 2-point line on up", () => {
    const start = startDraw(
      idleDrawState(),
      ctx("line", { x: 0, y: 0 }),
    );
    expect(start.commit).toBeNull();
    expect(start.preview).toEqual({
      type: "line",
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ],
    });

    const moved = moveDraw(start.state, ctx("line", { x: 3, y: 2 }));
    expect(moved.commit).toBeNull();
    expect(moved.preview).toEqual({
      type: "line",
      points: [
        { x: 0, y: 0 },
        { x: 3, y: 2 },
      ],
    });

    const committed = upDraw(moved.state, ctx("line", { x: 3, y: 2 }));
    expect(committed.commit).toEqual({
      id: lineId,
      type: "line",
      points: [
        { x: 0, y: 0 },
        { x: 3, y: 2 },
      ],
    });
    expect(committed.preview).toBeNull();
    expect(committed.state).toEqual(idleDrawState());
  });

  test("polygon clicks then a click on the first vertex closes and commits", () => {
    const a = clickDraw(idleDrawState(), ctx("polygon", { x: 0, y: 0 }, 1, polygonId));
    expect(a.commit).toBeNull();

    const b = clickDraw(a.state, ctx("polygon", { x: 2, y: 0 }, 1, polygonId));
    expect(b.commit).toBeNull();

    const c = clickDraw(b.state, ctx("polygon", { x: 1, y: 2 }, 1, polygonId));
    expect(c.commit).toBeNull();
    expect(c.preview?.type).toBe("polygon");
    expect(c.preview?.points).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 2 },
      { x: 1, y: 2 },
    ]);

    const closed = clickDraw(
      c.state,
      ctx("polygon", { x: 0, y: 0 }, 1, polygonId),
    );
    expect(closed.commit).toEqual({
      id: polygonId,
      type: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 2 },
      ],
      fill: "none",
    });
    expect(closed.preview).toBeNull();
    expect(closed.state).toEqual(idleDrawState());
  });

  test("esc cancels line preview and does not commit", () => {
    const started = startDraw(
      idleDrawState(),
      ctx("line", { x: 1, y: 1 }),
    );
    const moved = moveDraw(started.state, ctx("line", { x: 4, y: -1 }));
    expect(moved.preview).not.toBeNull();

    const cancelled = escDraw(moved.state);
    expect(cancelled.commit).toBeNull();
    expect(cancelled.preview).toBeNull();
    expect(cancelled.state).toEqual(idleDrawState());
  });

  test("esc cancels polygon preview and does not commit", () => {
    const a = clickDraw(idleDrawState(), ctx("polygon", { x: 0, y: 0 }, 1, polygonId));
    const b = clickDraw(a.state, ctx("polygon", { x: 1, y: 0 }, 1, polygonId));
    const cancelled = escDraw(b.state);
    expect(cancelled.commit).toBeNull();
    expect(cancelled.preview).toBeNull();
  });

  test("mid-gesture results do not touch a 说明书", () => {
    const document: GeometryDocument = {
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [],
    };
    const snapshot = structuredClone(document);

    const started = startDraw(idleDrawState(), ctx("line", { x: 0.4, y: -0.4 }));
    const moved = moveDraw(started.state, ctx("line", { x: 2.2, y: 1.6 }));
    const cancelled = escDraw(moved.state);

    expect(started.commit).toBeNull();
    expect(moved.commit).toBeNull();
    expect(cancelled.commit).toBeNull();
    expect(document).toEqual(snapshot);
  });

  test("line and polygon points snap to the editor grid", () => {
    const started = startDraw(
      idleDrawState(),
      ctx("line", { x: 1.4, y: -1.6 }, 1),
    );
    const moved = moveDraw(started.state, ctx("line", { x: 2.5, y: 0.2 }, 1));
    expect(moved.preview).toEqual({
      type: "line",
      points: [
        { x: 1, y: -2 },
        { x: 3, y: 0 },
      ],
    });

    const committed = upDraw(moved.state, ctx("line", { x: 2.5, y: 0.2 }, 1));
    expect(committed.commit).toEqual({
      id: lineId,
      type: "line",
      points: [
        { x: 1, y: -2 },
        { x: 3, y: 0 },
      ],
    });

    const half = startDraw(
      idleDrawState(),
      ctx("line", { x: 1.24, y: -1.26 }, 0.5, "line-half"),
    );
    const halfMoved = moveDraw(
      half.state,
      ctx("line", { x: 0.25, y: 1.75 }, 0.5, "line-half"),
    );
    expect(halfMoved.preview).toEqual({
      type: "line",
      points: [
        { x: 1, y: -1.5 },
        { x: 0.5, y: 2 },
      ],
    });
  });

  test("grid off keeps raw world points", () => {
    const started = startDraw(
      idleDrawState(),
      ctx("line", { x: 1.4, y: -1.6 }, "off"),
    );
    const committed = upDraw(
      started.state,
      ctx("line", { x: 2.2, y: 0.1 }, "off"),
    );
    expect(committed.commit).toEqual({
      id: lineId,
      type: "line",
      points: [
        { x: 1.4, y: -1.6 },
        { x: 2.2, y: 0.1 },
      ],
    });
  });

  test("zero-length line on up does not commit", () => {
    const started = startDraw(idleDrawState(), ctx("line", { x: 2, y: 2 }));
    const committed = upDraw(started.state, ctx("line", { x: 2.2, y: 1.6 }));
    expect(committed.commit).toBeNull();
    expect(committed.preview).toBeNull();
    expect(committed.state).toEqual(idleDrawState());
  });
});
