import { describe, expect, test } from "vitest";
import type { GeometryDocument } from "../document/index.ts";
import {
  clickDraw,
  escDraw,
  idleDrawState,
  moveDraw,
  nextLabelText,
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
  labelTexts: readonly string[] = [],
): DrawContext {
  return { tool, point, grid, id, labelTexts };
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
    expect(c.preview).toEqual({
      type: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 2 },
        { x: 1, y: 2 },
      ],
    });

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

  test("closing with fewer than 3 distinct vertices does not commit", () => {
    const a = clickDraw(
      idleDrawState(),
      ctx("polygon", { x: 0, y: 0 }, 1, polygonId),
    );
    const b = clickDraw(a.state, ctx("polygon", { x: 2, y: 0 }, 1, polygonId));
    const backToA = clickDraw(
      b.state,
      ctx("polygon", { x: 0, y: 0 }, 1, polygonId),
    );
    expect(backToA.commit).toBeNull();

    const closed = clickDraw(
      backToA.state,
      ctx("polygon", { x: 0, y: 0 }, 1, polygonId),
    );
    expect(closed.commit).toBeNull();
    expect(closed.state.kind).toBe("polygon");
    expect(closed.preview).not.toBeNull();
  });
});

describe("curve, label, and fill gestures", () => {
  test("drag circle from center to radius point commits fill none", () => {
    const started = startDraw(idleDrawState(), ctx("circle", { x: 0, y: 0 }, 1, "circle-1"));
    expect(started.commit).toBeNull();
    const moved = moveDraw(started.state, ctx("circle", { x: 3, y: 4 }, 1, "circle-1"));
    expect(moved.commit).toBeNull();
    expect(moved.preview).toEqual({ type: "circle", cx: 0, cy: 0, r: 5 });

    const committed = upDraw(moved.state, ctx("circle", { x: 3, y: 4 }, 1, "circle-1"));
    expect(committed.commit).toEqual({
      id: "circle-1",
      type: "circle",
      cx: 0,
      cy: 0,
      r: 5,
      fill: "none",
    });
    expect(committed.preview).toBeNull();
    expect(committed.state).toEqual(idleDrawState());
  });

  test("zero-radius circle on up does not commit", () => {
    const started = startDraw(idleDrawState(), ctx("circle", { x: 1, y: 1 }, 1, "circle-1"));
    const committed = upDraw(started.state, ctx("circle", { x: 1.2, y: 0.6 }, 1, "circle-1"));
    expect(committed.commit).toBeNull();
    expect(committed.state).toEqual(idleDrawState());
  });

  test("ellipse drag uses an axis-aligned bbox", () => {
    const started = startDraw(
      idleDrawState(),
      ctx("ellipse", { x: 4, y: 2 }, 1, "ellipse-1"),
    );
    const moved = moveDraw(
      started.state,
      ctx("ellipse", { x: 0, y: 0 }, 1, "ellipse-1"),
    );
    expect(moved.preview).toEqual({
      type: "ellipse",
      cx: 2,
      cy: 1,
      rx: 2,
      ry: 1,
      rotationDeg: 0,
    });
    const committed = upDraw(
      moved.state,
      ctx("ellipse", { x: 0, y: 0 }, 1, "ellipse-1"),
    );
    expect(committed.commit).toEqual({
      id: "ellipse-1",
      type: "ellipse",
      cx: 2,
      cy: 1,
      rx: 2,
      ry: 1,
      rotationDeg: 0,
      fill: "none",
    });
  });

  test("degenerate ellipse does not commit", () => {
    const started = startDraw(
      idleDrawState(),
      ctx("ellipse", { x: 0, y: 0 }, 1, "ellipse-1"),
    );
    const committed = upDraw(
      started.state,
      ctx("ellipse", { x: 3, y: 0 }, 1, "ellipse-1"),
    );
    expect(committed.commit).toBeNull();
    expect(committed.state).toEqual(idleDrawState());
  });

  test("ring two drags commit rInner < rOuter", () => {
    const outerStart = startDraw(
      idleDrawState(),
      ctx("ring", { x: 0, y: 0 }, 1, "ring-1"),
    );
    const outerMoved = moveDraw(
      outerStart.state,
      ctx("ring", { x: 4, y: 0 }, 1, "ring-1"),
    );
    const afterOuter = upDraw(
      outerMoved.state,
      ctx("ring", { x: 4, y: 0 }, 1, "ring-1"),
    );
    expect(afterOuter.commit).toBeNull();
    expect(afterOuter.preview).toEqual({
      type: "ring",
      cx: 0,
      cy: 0,
      rInner: 4,
      rOuter: 4,
    });

    const innerMoved = moveDraw(
      afterOuter.state,
      ctx("ring", { x: 0, y: 2 }, 1, "ring-1"),
    );
    const committed = upDraw(
      innerMoved.state,
      ctx("ring", { x: 0, y: 2 }, 1, "ring-1"),
    );
    expect(committed.commit).toEqual({
      id: "ring-1",
      type: "ring",
      cx: 0,
      cy: 0,
      rInner: 2,
      rOuter: 4,
      fill: "none",
    });
    expect(committed.state).toEqual(idleDrawState());
  });

  test("ring with inner radius not smaller than outer does not commit", () => {
    const outerStart = startDraw(
      idleDrawState(),
      ctx("ring", { x: 0, y: 0 }, 1, "ring-1"),
    );
    const afterOuter = upDraw(
      moveDraw(outerStart.state, ctx("ring", { x: 3, y: 0 }, 1, "ring-1")).state,
      ctx("ring", { x: 3, y: 0 }, 1, "ring-1"),
    );
    const tooBig = upDraw(
      moveDraw(afterOuter.state, ctx("ring", { x: 5, y: 0 }, 1, "ring-1")).state,
      ctx("ring", { x: 5, y: 0 }, 1, "ring-1"),
    );
    expect(tooBig.commit).toBeNull();
    expect(tooBig.state.kind).toBe("ring");
  });

  test("sector clicks center, start angle, then end angle with Y-up degrees", () => {
    const center = clickDraw(
      idleDrawState(),
      ctx("sector", { x: 0, y: 0 }, 1, "sector-1"),
    );
    expect(center.commit).toBeNull();
    const start = clickDraw(
      center.state,
      ctx("sector", { x: 2, y: 0 }, 1, "sector-1"),
    );
    expect(start.commit).toBeNull();
    const committed = clickDraw(
      start.state,
      ctx("sector", { x: 0, y: 4 }, 1, "sector-1"),
    );
    expect(committed.commit).toEqual({
      id: "sector-1",
      type: "sector",
      cx: 0,
      cy: 0,
      r: 2,
      startDeg: 0,
      endDeg: 90,
      fill: "none",
    });
  });

  test("bow commits type bow not segment", () => {
    const center = clickDraw(idleDrawState(), ctx("bow", { x: 1, y: 1 }, 1, "bow-1"));
    const start = clickDraw(center.state, ctx("bow", { x: 4, y: 1 }, 1, "bow-1"));
    const committed = clickDraw(start.state, ctx("bow", { x: 1, y: 4 }, 1, "bow-1"));
    expect(committed.commit).toEqual({
      id: "bow-1",
      type: "bow",
      cx: 1,
      cy: 1,
      r: 3,
      startDeg: 0,
      endDeg: 90,
      fill: "none",
    });
    expect(committed.commit).not.toHaveProperty("type", "segment");
  });

  test("arc commits without a fill field", () => {
    const center = clickDraw(idleDrawState(), ctx("arc", { x: 0, y: 0 }, 1, "arc-1"));
    const start = clickDraw(center.state, ctx("arc", { x: 2, y: 0 }, 1, "arc-1"));
    const committed = clickDraw(start.state, ctx("arc", { x: 0, y: 2 }, 1, "arc-1"));
    expect(committed.commit).toEqual({
      id: "arc-1",
      type: "arc",
      cx: 0,
      cy: 0,
      r: 2,
      startDeg: 0,
      endDeg: 90,
    });
    expect(committed.commit).not.toHaveProperty("fill");
  });

  test("label click places the next letter on a grid point", () => {
    const first = clickDraw(
      idleDrawState(),
      ctx("label", { x: 1.4, y: -1.6 }, 1, "label-1"),
    );
    expect(first.commit).toEqual({
      id: "label-1",
      type: "label",
      x: 1,
      y: -2,
      text: "A",
    });
    expect(first.commit).not.toHaveProperty("fill");

    const second = clickDraw(
      idleDrawState(),
      ctx("label", { x: 2, y: 0 }, 1, "label-2", ["A"]),
    );
    expect(second.commit).toMatchObject({ type: "label", text: "B" });
  });

  test("esc cancels circle and sweep previews without committing", () => {
    const circle = moveDraw(
      startDraw(idleDrawState(), ctx("circle", { x: 0, y: 0 }, 1, "circle-1")).state,
      ctx("circle", { x: 2, y: 0 }, 1, "circle-1"),
    );
    expect(escDraw(circle.state).commit).toBeNull();
    expect(escDraw(circle.state).preview).toBeNull();

    const sweep = clickDraw(
      idleDrawState(),
      ctx("sector", { x: 0, y: 0 }, 1, "sector-1"),
    );
    expect(escDraw(sweep.state).commit).toBeNull();
    expect(escDraw(sweep.state).state).toEqual(idleDrawState());
  });

  test("circle points snap to the editor grid", () => {
    const started = startDraw(
      idleDrawState(),
      ctx("circle", { x: 0.4, y: -0.4 }, 1, "circle-1"),
    );
    const moved = moveDraw(
      started.state,
      ctx("circle", { x: 3.4, y: 3.6 }, 1, "circle-1"),
    );
    expect(moved.preview).toEqual({ type: "circle", cx: 0, cy: 0, r: 5 });
  });
});

describe("nextLabelText", () => {
  test("walks A, B, C and skips used letters", () => {
    expect(nextLabelText([])).toBe("A");
    expect(nextLabelText(["A"])).toBe("B");
    expect(nextLabelText(["A", "C"])).toBe("B");
  });
});

describe("rectangle 工具", () => {
  test("拖对角线提交矩形：中心=对角中点，宽高=对角投影", () => {
    const started = startDraw(
      idleDrawState(),
      ctx("rectangle", { x: 0, y: 0 }, 1, "rect-1"),
    );
    expect(started.commit).toBeNull();
    const moved = moveDraw(
      started.state,
      ctx("rectangle", { x: 4, y: 2 }, 1, "rect-1"),
    );
    expect(moved.commit).toBeNull();
    expect(moved.preview).toEqual({
      type: "rectangle",
      x: 2,
      y: 1,
      width: 4,
      height: 2,
      rotationDeg: 0,
    });

    const committed = upDraw(
      moved.state,
      ctx("rectangle", { x: 4, y: 2 }, 1, "rect-1"),
    );
    expect(committed.commit).toEqual({
      id: "rect-1",
      type: "rectangle",
      x: 2,
      y: 1,
      width: 4,
      height: 2,
      rotationDeg: 0,
      fill: "none",
    });
    expect(committed.preview).toBeNull();
    expect(committed.state).toEqual(idleDrawState());
  });

  test("反向拖（右上→左下）同样成立：中心与宽高取绝对值", () => {
    const started = startDraw(
      idleDrawState(),
      ctx("rectangle", { x: 2, y: 3 }, 1, "rect-1"),
    );
    const committed = upDraw(
      started.state,
      ctx("rectangle", { x: -2, y: 1 }, 1, "rect-1"),
    );
    expect(committed.commit).toEqual({
      id: "rect-1",
      type: "rectangle",
      x: 0,
      y: 2,
      width: 4,
      height: 2,
      rotationDeg: 0,
      fill: "none",
    });
  });

  test("零宽或零高的退化拖动不提交", () => {
    const started = startDraw(
      idleDrawState(),
      ctx("rectangle", { x: 0, y: 0 }, 1, "rect-1"),
    );
    const flat = upDraw(
      started.state,
      ctx("rectangle", { x: 3, y: 0 }, 1, "rect-1"),
    );
    expect(flat.commit).toBeNull();
    expect(flat.state).toEqual(idleDrawState());
  });

  test("起点与终点都吃当前格", () => {
    const started = startDraw(
      idleDrawState(),
      ctx("rectangle", { x: 1.4, y: -1.6 }, 1, "rect-1"),
    );
    const moved = moveDraw(
      started.state,
      ctx("rectangle", { x: 3.5, y: 0.2 }, 1, "rect-1"),
    );
    expect(moved.preview).toEqual({
      type: "rectangle",
      x: 2.5,
      y: -1,
      width: 3,
      height: 2,
      rotationDeg: 0,
    });
  });

  test("Alt 不落格（grid off 保留原始点）", () => {
    const started = startDraw(
      idleDrawState(),
      ctx("rectangle", { x: 0.5, y: -0.5 }, "off", "rect-1"),
    );
    const moved = moveDraw(
      started.state,
      ctx("rectangle", { x: 2.25, y: 1 }, "off", "rect-1"),
    );
    expect(moved.preview).toEqual({
      type: "rectangle",
      x: 1.375,
      y: 0.25,
      width: 1.75,
      height: 1.5,
      rotationDeg: 0,
    });
  });

  test("esc 取消矩形预览且不提交", () => {
    const started = startDraw(
      idleDrawState(),
      ctx("rectangle", { x: 0, y: 0 }, 1, "rect-1"),
    );
    const moved = moveDraw(
      started.state,
      ctx("rectangle", { x: 4, y: 2 }, 1, "rect-1"),
    );
    expect(moved.preview).not.toBeNull();

    const cancelled = escDraw(moved.state);
    expect(cancelled.commit).toBeNull();
    expect(cancelled.preview).toBeNull();
    expect(cancelled.state).toEqual(idleDrawState());
  });
});

