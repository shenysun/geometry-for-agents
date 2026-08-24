import { describe, expect, test } from "vitest";
import { parseDocument } from "../document/index.ts";
import type { GeometryDocument, Point2 } from "../document/index.ts";
import {
  clickSelect,
  escSelect,
  idleSelectState,
  moveSelect,
  startSelect,
  upSelect,
  type SelectContext,
} from "./select-gesture.ts";

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

function lineAndCircleDoc(): GeometryDocument {
  return doc2d([
    {
      id: "line-1",
      type: "line",
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
    },
    { id: "circle-1", type: "circle", cx: 8, cy: 0, r: 2, fill: "none" },
  ]);
}

function ctx(
  point: Point2,
  overrides: Partial<SelectContext> = {},
): SelectContext {
  return {
    tool: "select",
    document: lineAndCircleDoc(),
    point,
    grid: 1,
    ...overrides,
  };
}

describe("select-gesture 命中", () => {
  test("按下图元本体即选中并进入拖动，不提交", () => {
    const result = startSelect(idleSelectState(), ctx({ x: 2, y: 0 }, { tolerance: 0.25 }));
    expect(result.state).toEqual({ kind: "drag", id: "line-1", start: { x: 2, y: 0 } });
    expect(result.selectionId).toBe("line-1");
    expect(result.commit).toBeNull();
    expect(result.preview).toBeNull();
  });

  test("按下空白保持 idle 且不动选中", () => {
    const result = startSelect(idleSelectState(), ctx({ x: -5, y: -5 }));
    expect(result.state).toEqual(idleSelectState());
    expect(result.selectionId).toBeUndefined();
    expect(result.commit).toBeNull();
  });

  test("命中容差让细线可点，零容差保持精确命中", () => {
    const point = { x: 2, y: 0.1 };
    const loose = startSelect(idleSelectState(), ctx(point, { tolerance: 0.25 }));
    expect(loose.state.kind).toBe("drag");
    const exact = startSelect(idleSelectState(), ctx(point));
    expect(exact.state).toEqual(idleSelectState());
  });

  test("单击命中图元选中、单击空白取消选中", () => {
    const hit = clickSelect(idleSelectState(), ctx({ x: 8, y: 0 }));
    expect(hit.selectionId).toBe("circle-1");
    expect(hit.commit).toBeNull();

    const miss = clickSelect(idleSelectState(), ctx({ x: -3, y: 4 }));
    expect(miss.selectionId).toBeNull();
    expect(miss.commit).toBeNull();
  });

  test("重叠闭合图元选面积小的那条", () => {
    const document = doc2d([
      { id: "big", type: "circle", cx: 0, cy: 0, r: 4, fill: "none" },
      { id: "small", type: "circle", cx: 0, cy: 0, r: 1, fill: "none" },
    ]);
    const result = startSelect(
      idleSelectState(),
      ctx({ x: 0.5, y: 0 }, { document }),
    );
    expect(result.state.kind).toBe("drag");
    if (result.state.kind !== "drag") return;
    expect(result.state.id).toBe("small");
  });
});

describe("select-gesture 拖动平移", () => {
  test("拖动只出吸附后的预览，说明书未变", () => {
    const document = lineAndCircleDoc();
    const snapshot = structuredClone(document);

    const down = startSelect(
      idleSelectState(),
      ctx({ x: 8, y: 0.2 }, { document }),
    );
    const moved = moveSelect(
      down.state,
      ctx({ x: 9.4, y: 0.8 }, { document }),
    );

    expect(moved.commit).toBeNull();
    expect(moved.preview).toEqual({
      type: "circle",
      cx: 9,
      cy: 1,
      r: 2,
    });
    expect(document).toEqual(snapshot);
  });

  test("半格与关两种格的预览分别落半格与原始位移", () => {
    const down = startSelect(
      idleSelectState(),
      ctx({ x: 8, y: 0 }, { grid: 0.5 }),
    );
    const half = moveSelect(down.state, ctx({ x: 8.7, y: 0.2 }, { grid: 0.5 }));
    expect(half.preview).toMatchObject({ cx: 8.5, cy: 0 });

    const downOff = startSelect(
      idleSelectState(),
      ctx({ x: 8, y: 0 }, { grid: "off" }),
    );
    const raw = moveSelect(downOff.state, ctx({ x: 8.7, y: 0.2 }, { grid: "off" }));
    expect(raw.preview).toMatchObject({ cx: 8.7, cy: 0.2 });
  });

  test("一次 pointerup 提交一次原始世界位移并回到 idle", () => {
    const down = startSelect(idleSelectState(), ctx({ x: 8, y: 0 }));
    const moved = moveSelect(down.state, ctx({ x: 9.4, y: 0.8 }));
    const up = upSelect(moved.state, ctx({ x: 9.5, y: 0.9 }));

    expect(up.commit).toEqual({ id: "circle-1", dx: 1.5, dy: 0.9 });
    expect(up.state).toEqual(idleSelectState());
    expect(up.preview).toBeNull();
  });

  test("整串手势只有松手这一次 commit", () => {
    const down = startSelect(idleSelectState(), ctx({ x: 8, y: 0 }));
    expect(down.commit).toBeNull();
    for (const point of [{ x: 8.3, y: 0 }, { x: 9, y: 0.4 }, { x: 10, y: 1 }]) {
      const moved = moveSelect(down.state, ctx(point));
      expect(moved.commit).toBeNull();
    }
    const up = upSelect(down.state, ctx({ x: 10, y: 1 }));
    expect(up.commit).toEqual({ id: "circle-1", dx: 2, dy: 1 });
  });

  test("吸附后位移为零的拖动不提交", () => {
    const down = startSelect(idleSelectState(), ctx({ x: 8, y: 0 }));
    const up = upSelect(down.state, ctx({ x: 8.4, y: 0.2 }));
    expect(up.commit).toBeNull();
    expect(up.state).toEqual(idleSelectState());
  });

  test("拖折线把位移写进每个点", () => {
    const down = startSelect(
      idleSelectState(),
      ctx({ x: 2, y: 0.1 }, { tolerance: 0.25 }),
    );
    expect(down.state.kind).toBe("drag");
    const moved = moveSelect(
      down.state,
      ctx({ x: 3.2, y: 1.1 }, { tolerance: 0.25 }),
    );
    expect(moved.preview).toEqual({
      type: "line",
      points: [
        { x: 1, y: 1 },
        { x: 5, y: 1 },
      ],
    });
    const up = upSelect(
      down.state,
      ctx({ x: 3, y: 1 }, { tolerance: 0.25 }),
    );
    expect(up.commit).toEqual({ id: "line-1", dx: 1, dy: 0.9 });
  });

  test("Esc 放弃拖动且不提交", () => {
    const down = startSelect(idleSelectState(), ctx({ x: 8, y: 0 }));
    const moved = moveSelect(down.state, ctx({ x: 9, y: 0 }));
    const cancelled = escSelect(moved.state);
    expect(cancelled.commit).toBeNull();
    expect(cancelled.preview).toBeNull();
    expect(cancelled.state).toEqual(idleSelectState());
  });

  test("拖动中图元被删则回 idle 不再出预览", () => {
    const down = startSelect(idleSelectState(), ctx({ x: 8, y: 0 }));
    const emptied = doc2d([]);
    const moved = moveSelect(
      down.state,
      ctx({ x: 9, y: 0 }, { document: emptied }),
    );
    expect(moved.state).toEqual(idleSelectState());
    expect(moved.preview).toBeNull();
    expect(moved.commit).toBeNull();
  });
});
