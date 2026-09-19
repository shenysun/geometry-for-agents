import { describe, expect, test } from "vitest";
import {
  clickPickTransform,
  escPickTransform,
  idlePickTransformState,
  movePickTransform,
  startPickTransformVector,
  upPickTransform,
  type PickTransformContext,
} from "./pick-transform-gesture.ts";
import { parseDocument, type GeometryDocument } from "../document/index.ts";

function transformDoc(): GeometryDocument {
  const result = parseDocument({
    version: 1,
    space: "2d",
    underlay: null,
    primitives: [
      { id: "circle-a", type: "circle", cx: 0, cy: 0, r: 4, fill: "none" },
      {
        id: "line-b",
        type: "line",
        points: [
          { x: 10, y: 0 },
          { x: 14, y: 0 },
        ],
      },
      {
        id: "f1",
        type: "functionCurve",
        kind: "linear",
        a: 1,
        b: 0,
      },
      {
        id: "m1",
        type: "measure",
        sourceId: "circle-a",
        kind: "perimeter",
      },
    ],
  });
  if (!result.success) throw new Error(result.error);
  return result.document;
}

function ctxAt(over: Partial<PickTransformContext> = {}): PickTransformContext {
  return {
    document: transformDoc(),
    point: { x: 0, y: 0 },
    tolerance: 0,
    grid: 1,
    id: "transform-new",
    ...over,
  };
}

describe("变换两步拾取手势（ADR 0022）：第一步点源锁定", () => {
  test("click on a whitelisted source locks it, no commit yet", () => {
    const result = clickPickTransform(idlePickTransformState(), ctxAt());

    expect(result.state).toEqual({ kind: "source", id: "circle-a" });
    expect(result.commit).toBeNull();
    expect(result.selectionId).toBeUndefined();
    expect(result.rejection).toBeNull();
  });

  test("stroke family is a legal source too", () => {
    const result = clickPickTransform(
      idlePickTransformState(),
      ctxAt({ point: { x: 12, y: 0 }, tolerance: 1 }),
    );

    expect(result.state).toEqual({ kind: "source", id: "line-b" });
  });

  test("function curve is rejected immediately with no state change", () => {
    // 曲线 y=x 过 (6,6)：远离圆与线段，带采样视口命中函数曲线（白名单外）。
    const result = clickPickTransform(
      idlePickTransformState(),
      ctxAt({
        point: { x: 6, y: 6 },
        tolerance: 0.5,
        curveViewport: { xMin: 0, xMax: 20, scale: 40, heightWorld: 20 },
      }),
    );

    expect(result.state).toEqual({ kind: "idle" });
    expect(result.commit).toBeNull();
    expect(result.rejection).toBe("not-transformable");
  });

  test("measure entry is rejected through the same whitelist", () => {
    // 周长文本悬在圆包围盒上方 (0,4)~(0,4.6)：点文本区命中标注条目，
    // 白名单同样拒绝。
    const result = clickPickTransform(
      idlePickTransformState(),
      ctxAt({ point: { x: 0, y: 4.3 }, worldPerPx: 0.05 }),
    );

    expect(result.state).toEqual({ kind: "idle" });
    expect(result.rejection).toBe("not-transformable");
  });

  test("clicking empty space is ignored", () => {
    const result = clickPickTransform(
      idlePickTransformState(),
      ctxAt({ point: { x: 100, y: 100 } }),
    );

    expect(result.state).toEqual({ kind: "idle" });
    expect(result.rejection).toBeNull();
  });

  test("3D document is ignored", () => {
    const result = parseDocument({
      version: 1,
      space: "3d",
      underlay: null,
      primitives: [{ id: "voxel-a", type: "voxel", x: 0, y: 0, z: 0 }],
    });
    if (!result.success) throw new Error(result.error);

    const pick = clickPickTransform(
      idlePickTransformState(),
      ctxAt({ document: result.document, point: { x: 0.5, y: 0.5 } }),
    );
    expect(pick.state).toEqual({ kind: "idle" });
    expect(pick.commit).toBeNull();
    expect(pick.rejection).toBeNull();
  });
});

describe("变换两步拾取手势：第二步拖位移向量", () => {
  test("vector drag previews the image and commits one undoable entry on release", () => {
    const locked = clickPickTransform(idlePickTransformState(), ctxAt());
    const started = startPickTransformVector(
      locked.state,
      ctxAt({ point: { x: 1.2, y: -0.8 } }),
    );

    expect(started.state).toMatchObject({ kind: "vector", id: "circle-a" });
    // 起点落格：1.2 → 1，-0.8 → -1。
    expect(started.state).toMatchObject({ start: { x: 1, y: -1 } });

    const moved = movePickTransform(
      started.state,
      ctxAt({ point: { x: 4.6, y: 1.2 } }),
    );
    expect(moved.preview).not.toBeNull();
    if (moved.preview === null) return;
    // 像是源几何施加位移后的图元值：圆心 = (0,0) + 位移 (4,2)。
    expect(moved.preview.image).toMatchObject({
      type: "circle",
      cx: 4,
      cy: 2,
    });

    const released = upPickTransform(
      moved.state,
      ctxAt({ point: { x: 4.6, y: 1.2 } }),
    );
    // 松手点 4.6,1.2 落格 5,1；位移 = (5,1)−(1,−1) = (4,2)。
    expect(released.commit).toEqual({
      id: "transform-new",
      type: "transform",
      sourceId: "circle-a",
      kind: "translate",
      dx: 4,
      dy: 2,
    });
    expect(released.selectionId).toBe("transform-new");
    expect(released.state).toEqual({ kind: "idle" });
    expect(released.preview).toBeNull();
  });

  test("zero displacement on release commits nothing and returns to the locked source", () => {
    const locked = clickPickTransform(idlePickTransformState(), ctxAt());
    const started = startPickTransformVector(
      locked.state,
      ctxAt({ point: { x: 1.2, y: 1.2 } }),
    );
    const released = upPickTransform(
      started.state,
      ctxAt({ point: { x: 1.4, y: 1.4 } }),
    );

    // 起止同格：零位移触碰不提交（退化值不静默钳到端点）。
    expect(released.commit).toBeNull();
    expect(released.state).toEqual({ kind: "source", id: "circle-a" });
  });

  test("grid off keeps raw coordinates (Alt 暂不落格)", () => {
    const locked = clickPickTransform(idlePickTransformState(), ctxAt());
    const started = startPickTransformVector(
      locked.state,
      ctxAt({ point: { x: 1.25, y: 1.25 }, grid: "off" }),
    );
    const released = upPickTransform(
      started.state,
      ctxAt({ point: { x: 2.75, y: 3.25 }, grid: "off" }),
    );

    expect(released.commit).toMatchObject({ dx: 1.5, dy: 2 });
  });

  test("escape resets the gesture to idle", () => {
    const locked = clickPickTransform(idlePickTransformState(), ctxAt());
    const started = startPickTransformVector(
      locked.state,
      ctxAt({ point: { x: 1, y: 1 } }),
    );

    expect(escPickTransform(started.state).state).toEqual({ kind: "idle" });
    expect(escPickTransform(locked.state).state).toEqual({ kind: "idle" });
  });

  test("source vanishing mid-gesture neither previews nor commits", () => {
    const locked = clickPickTransform(idlePickTransformState(), ctxAt());
    const started = startPickTransformVector(
      locked.state,
      ctxAt({ point: { x: 1, y: 1 } }),
    );
    // 源被删：拖动与松手都安全返回，不产出悬空条目。
    const hollowDoc = parseDocument({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [
        {
          id: "line-b",
          type: "line",
          points: [
            { x: 10, y: 0 },
            { x: 14, y: 0 },
          ],
        },
      ],
    });
    if (!hollowDoc.success) throw new Error(hollowDoc.error);
    const hollow = ctxAt({ document: hollowDoc.document });

    const moved = movePickTransform(started.state, hollow);
    expect(moved.preview).toBeNull();
    const released = upPickTransform(started.state, hollow);
    expect(released.commit).toBeNull();
    expect(released.state).toEqual({ kind: "idle" });
  });
});
