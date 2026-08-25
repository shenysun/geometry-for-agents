import { describe, expect, test } from "vitest";
import { parseDocument } from "../document/index.ts";
import type { GeometryDocument, Point2 } from "../document/index.ts";
import {
  clickSelect,
  escSelect,
  idleSelectState,
  moveSelect,
  selectPreview,
  startSelect,
  transformHandles,
  upSelect,
  type SelectContext,
  type SelectGestureState,
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

    expect(up.commit).toEqual({ kind: "translate", id: "circle-1", dx: 1.5, dy: 0.9 });
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
    expect(up.commit).toEqual({ kind: "translate", id: "circle-1", dx: 2, dy: 1 });
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
    expect(up.commit).toEqual({ kind: "translate", id: "line-1", dx: 1, dy: 0.9 });
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

const ellipseDoc = (): GeometryDocument =>
  doc2d([
    {
      id: "ellipse-1",
      type: "ellipse",
      cx: 0,
      cy: 0,
      rx: 2,
      ry: 1,
      rotationDeg: 0,
      fill: "none",
    },
  ]);

const sectorDoc = (): GeometryDocument =>
  doc2d([
    {
      id: "sector-1",
      type: "sector",
      cx: 0,
      cy: 0,
      r: 2,
      startDeg: 0,
      endDeg: 90,
      fill: "none",
    },
  ]);

function primitiveOf(document: GeometryDocument, id: string) {
  if (document.space !== "2d") throw new Error("expected a 2d document");
  const primitive = document.primitives.find((item) => item.id === id);
  if (primitive === undefined) throw new Error(`missing primitive ${id}`);
  return primitive;
}

function handleCtx(
  point: Point2,
  overrides: Partial<SelectContext> = {},
): SelectContext {
  return ctx(point, { handleTolerance: 0.5, ...overrides });
}

describe("transformHandles 柄布局", () => {
  test("椭圆有旋转柄与缩放柄，分别在锚点上方与右侧、柄距为 reach 加四倍命中半径", () => {
    const handles = transformHandles(primitiveOf(ellipseDoc(), "ellipse-1"), 0.5);

    expect(handles?.center).toEqual({ x: 0, y: 0 });
    expect(handles?.rotate).toEqual({ x: 0, y: 4 });
    expect(handles?.scale).toEqual({ x: 4, y: 0 });
  });

  test("圆与环只有缩放柄（旋转对称，不旋转），标签没有变换手柄", () => {
    const document = doc2d([
      { id: "circle-1", type: "circle", cx: 0, cy: 0, r: 1, fill: "none" },
      {
        id: "ring-1",
        type: "ring",
        cx: 5,
        cy: 0,
        rInner: 1,
        rOuter: 2,
        fill: "none",
      },
      { id: "label-1", type: "label", x: 9, y: 0, text: "A" },
    ]);

    const circle = transformHandles(primitiveOf(document, "circle-1"), 0.5);
    expect(circle?.rotate).toBeNull();
    expect(circle?.scale).toEqual({ x: 3, y: 0 });

    const ring = transformHandles(primitiveOf(document, "ring-1"), 0.5);
    expect(ring?.rotate).toBeNull();
    expect(ring?.scale).toEqual({ x: 9, y: 0 });

    expect(
      transformHandles(primitiveOf(document, "label-1"), 0.5),
    ).toBeNull();
  });

  test("扇形两柄齐备，锚点即圆心", () => {
    const handles = transformHandles(primitiveOf(sectorDoc(), "sector-1"), 0.5);

    expect(handles?.center).toEqual({ x: 0, y: 0 });
    expect(handles?.rotate).toEqual({ x: 0, y: 4 });
    expect(handles?.scale).toEqual({ x: 4, y: 0 });
  });

  test("底/高家族两柄齐备：reach 取顶点到锚点的最大距离，锚点即底边中点", () => {
    const document = doc2d([
      {
        id: "tri-1",
        type: "triangle",
        x: 0,
        y: 0,
        width: 4,
        height: 3,
        apexOffset: 0,
        rotationDeg: 0,
        fill: "none",
      },
      {
        id: "para-1",
        type: "parallelogram",
        x: 0,
        y: 0,
        width: 2,
        height: 1,
        skew: 3,
        rotationDeg: 0,
        fill: "none",
      },
    ]);

    // 三角顶点 (-2,0),(2,0),(0,3)：reach=3 → 柄距 3+4×0.5=5。
    const triangle = transformHandles(
      primitiveOf(document, "tri-1"),
      0.5,
    );
    expect(triangle?.center).toEqual({ x: 0, y: 0 });
    expect(triangle?.rotate).toEqual({ x: 0, y: 5 });
    expect(triangle?.scale).toEqual({ x: 5, y: 0 });

    // 平四顶点 (-1,0),(1,0),(4,1),(-2,1)：reach=√17 ≈ 4.123。
    const parallelogram = transformHandles(
      primitiveOf(document, "para-1"),
      0.5,
    );
    expect(parallelogram?.rotate?.y).toBeCloseTo(Math.sqrt(17) + 2);
  });
});

describe("select-gesture 家族预览", () => {
  test("selectPreview 携带家族全部几何字段", () => {
    const document = doc2d([
      {
        id: "tri-1",
        type: "triangle",
        x: 1,
        y: 2,
        width: 4,
        height: 3,
        apexOffset: 0.5,
        rotationDeg: 30,
        fill: "none",
      },
      {
        id: "trap-1",
        type: "trapezoid",
        x: 1,
        y: 2,
        width: 4,
        topWidth: 2,
        height: 3,
        topOffset: -0.5,
        rotationDeg: 0,
        fill: "none",
      },
    ]);

    expect(selectPreview(document, "tri-1")).toEqual({
      type: "triangle",
      x: 1,
      y: 2,
      width: 4,
      height: 3,
      apexOffset: 0.5,
      rotationDeg: 30,
    });
    expect(selectPreview(document, "trap-1")).toEqual({
      type: "trapezoid",
      x: 1,
      y: 2,
      width: 4,
      topWidth: 2,
      height: 3,
      topOffset: -0.5,
      rotationDeg: 0,
    });
  });

  test("角：reach 取边长（端点即最远点），预览携带两角与边长", () => {
    const document = doc2d([
      {
        id: "angle-1",
        type: "angle",
        x: 0,
        y: 0,
        startDeg: 30,
        endDeg: 120,
        length: 4,
      },
    ]);

    expect(selectPreview(document, "angle-1")).toEqual({
      type: "angle",
      x: 0,
      y: 0,
      startDeg: 30,
      endDeg: 120,
      length: 4,
    });

    // reach = length = 4，柄距 = 4 + 4×0.5 = 6。
    const handles = transformHandles(
      primitiveOf(document, "angle-1"),
      0.5,
    );
    expect(handles?.center).toEqual({ x: 0, y: 0 });
    expect(handles?.rotate).toEqual({ x: 0, y: 6 });
    expect(handles?.scale).toEqual({ x: 6, y: 0 });
  });
});

describe("select-gesture 柄命中", () => {
  test("按下旋转柄进入旋转手势并保持选中，不提交", () => {
    const document = ellipseDoc();
    const handles = transformHandles(
      primitiveOf(document, "ellipse-1"),
      0.5,
    );
    if (handles === null || handles.rotate === null) {
      throw new Error("no rotate handle");
    }

    const down = startSelect(
      idleSelectState(),
      handleCtx(handles.rotate, { document, selectionId: "ellipse-1" }),
    );

    expect(down.state).toEqual({
      kind: "rotate",
      id: "ellipse-1",
      center: { x: 0, y: 0 },
      startDeg: 90,
    });
    expect(down.selectionId).toBe("ellipse-1");
    expect(down.commit).toBeNull();
    expect(down.preview).toBeNull();
  });

  test("按下缩放柄进入缩放手势，记下初始半径", () => {
    const document = doc2d([
      { id: "circle-1", type: "circle", cx: 0, cy: 0, r: 1, fill: "none" },
    ]);
    const handles = transformHandles(
      primitiveOf(document, "circle-1"),
      0.5,
    );
    if (handles?.scale === undefined) throw new Error("no scale handle");

    const down = startSelect(
      idleSelectState(),
      handleCtx(handles.scale, { document, selectionId: "circle-1" }),
    );

    expect(down.state).toEqual({
      kind: "scale",
      id: "circle-1",
      center: { x: 0, y: 0 },
      startRadius: 3,
    });
  });

  test("柄命中优先于下方图元的本体命中", () => {
    const document = doc2d([
      { id: "circle-1", type: "circle", cx: 0, cy: 0, r: 1, fill: "none" },
      {
        id: "cover-1",
        type: "polygon",
        points: [
          { x: -2, y: -4 },
          { x: 8, y: -4 },
          { x: 8, y: 4 },
          { x: -2, y: 4 },
        ],
        fill: "none",
      },
    ]);

    const down = startSelect(
      idleSelectState(),
      handleCtx({ x: 3, y: 0 }, { document, selectionId: "circle-1" }),
    );

    expect(down.state.kind).toBe("scale");
    if (down.state.kind !== "scale") return;
    expect(down.state.id).toBe("circle-1");
  });

  test("未选中或零柄容差时柄不干扰本体与空白命中", () => {
    const document = doc2d([
      { id: "circle-1", type: "circle", cx: 0, cy: 0, r: 1, fill: "none" },
    ]);

    const noSelection = startSelect(
      idleSelectState(),
      handleCtx({ x: 3, y: 0 }, { document }),
    );
    expect(noSelection.state.kind).toBe("idle");

    const noTolerance = startSelect(
      idleSelectState(),
      ctx({ x: 3, y: 0 }, { document, selectionId: "circle-1" }),
    );
    expect(noTolerance.state.kind).toBe("idle");
  });

  test("单击柄保持选中，不取消也不提交", () => {
    const document = ellipseDoc();
    const handles = transformHandles(
      primitiveOf(document, "ellipse-1"),
      0.5,
    );
    if (handles === null || handles.rotate === null) {
      throw new Error("no rotate handle");
    }

    const clicked = clickSelect(
      idleSelectState(),
      handleCtx(handles.rotate, { document, selectionId: "ellipse-1" }),
    );

    expect(clicked.selectionId).toBe("ellipse-1");
    expect(clicked.commit).toBeNull();
  });
});

describe("select-gesture 旋转", () => {
  const rotateState = (): SelectGestureState => ({
    kind: "rotate",
    id: "sector-1",
    center: { x: 0, y: 0 },
    startDeg: 90,
  });

  test("拖旋转柄只出预览：扇形改起止角，圆心半径不动，说明书未变", () => {
    const document = sectorDoc();
    const snapshot = structuredClone(document);

    const moved = moveSelect(
      rotateState(),
      handleCtx({ x: 4, y: 0 }, { document }),
    );

    expect(moved.commit).toBeNull();
    expect(moved.preview).toEqual({
      type: "sector",
      cx: 0,
      cy: 0,
      r: 2,
      startDeg: 270,
      endDeg: 0,
    });
    expect(document).toEqual(snapshot);
  });

  test("椭圆旋转的预览携带新的 rotationDeg", () => {
    const moved = moveSelect(
      { kind: "rotate", id: "ellipse-1", center: { x: 0, y: 0 }, startDeg: 90 },
      handleCtx({ x: 2, y: 0 }, { document: ellipseDoc() }),
    );

    if (moved.preview === null || moved.preview.type !== "ellipse") {
      throw new Error("expected ellipse preview");
    }
    expect(moved.preview.rotationDeg).toBe(270);
    expect(moved.preview.cx).toBe(0);
    expect(moved.preview.rx).toBe(2);
  });

  test("松手一次提交旋转角，转回原位不提交", () => {
    const document = sectorDoc();

    const up = upSelect(
      rotateState(),
      handleCtx({ x: 0, y: -2 }, { document }),
    );
    expect(up.commit).toEqual({ kind: "rotate", id: "sector-1", deg: -180 });
    expect(up.state).toEqual(idleSelectState());

    const back = upSelect(
      rotateState(),
      handleCtx({ x: 0, y: 4 }, { document }),
    );
    expect(back.commit).toBeNull();
    expect(back.state).toEqual(idleSelectState());
  });

  test("Esc 放弃旋转且不提交", () => {
    const moved = moveSelect(
      rotateState(),
      handleCtx({ x: 4, y: 0 }, { document: sectorDoc() }),
    );
    const cancelled = escSelect(moved.state);
    expect(cancelled.commit).toBeNull();
    expect(cancelled.state).toEqual(idleSelectState());
  });
});

describe("select-gesture 缩放", () => {
  const circleScaleDoc = (): GeometryDocument =>
    doc2d([
      { id: "circle-1", type: "circle", cx: 0, cy: 0, r: 1, fill: "none" },
    ]);

  const scaleState = (): SelectGestureState => ({
    kind: "scale",
    id: "circle-1",
    center: { x: 0, y: 0 },
    startRadius: 3,
  });

  test("拖缩放柄只出预览：圆等比缩放，圆心不动，说明书未变", () => {
    const document = circleScaleDoc();
    const snapshot = structuredClone(document);

    const moved = moveSelect(
      scaleState(),
      handleCtx({ x: 1.5, y: 0 }, { document }),
    );

    expect(moved.commit).toBeNull();
    expect(moved.preview).toEqual({
      type: "circle",
      cx: 0,
      cy: 0,
      r: 0.5,
    });
    expect(document).toEqual(snapshot);
  });

  test("椭圆缩放预览 rx ry 等比收放", () => {
    const moved = moveSelect(
      { kind: "scale", id: "ellipse-1", center: { x: 0, y: 0 }, startRadius: 4 },
      handleCtx({ x: 2, y: 0 }, { document: ellipseDoc() }),
    );

    if (moved.preview === null || moved.preview.type !== "ellipse") {
      throw new Error("expected ellipse preview");
    }
    expect(moved.preview.rx).toBe(1);
    expect(moved.preview.ry).toBe(0.5);
    expect(moved.preview.rotationDeg).toBe(0);
  });

  test("松手一次提交缩放因子，因子为 1 不提交", () => {
    const document = circleScaleDoc();

    const up = upSelect(
      scaleState(),
      handleCtx({ x: 1.5, y: 0 }, { document }),
    );
    expect(up.commit).toEqual({ kind: "scale", id: "circle-1", factor: 0.5 });
    expect(up.state).toEqual(idleSelectState());

    const same = upSelect(
      scaleState(),
      handleCtx({ x: 3, y: 0 }, { document }),
    );
    expect(same.commit).toBeNull();
    expect(same.state).toEqual(idleSelectState());
  });

  test("整串缩放手势只有松手这一次 commit", () => {
    const state = scaleState();
    for (const point of [{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 6, y: 0 }]) {
      const moved = moveSelect(
        state,
        handleCtx(point, { document: circleScaleDoc() }),
      );
      expect(moved.commit).toBeNull();
    }
    const up = upSelect(
      state,
      handleCtx({ x: 6, y: 0 }, { document: circleScaleDoc() }),
    );
    expect(up.commit).toEqual({ kind: "scale", id: "circle-1", factor: 2 });
  });
});

const circlePointDoc = (): GeometryDocument =>
  doc2d([
    { id: "circle-1", type: "circle", cx: 0, cy: 0, r: 1, fill: "none" },
  ]);

const sectorPointDoc = (): GeometryDocument =>
  doc2d([
    {
      id: "sector-1",
      type: "sector",
      cx: 0,
      cy: 0,
      r: 2,
      startDeg: 0,
      endDeg: 90,
      fill: "none",
    },
  ]);

function controlCtx(
  point: Point2,
  overrides: Partial<SelectContext> = {},
): SelectContext {
  return ctx(point, {
    handleTolerance: 0.5,
    controlTolerance: 0.5,
    ...overrides,
  });
}

describe("select-gesture 控制点命中顺序", () => {
  test("同一位置同时命中控制点与缩放柄时控制点赢", () => {
    const document = circlePointDoc();
    // 半径点在 (1,0)；缩放柄在 reach(1) + 4*0.5 = (3,0)。放宽控制点
    // 命中半径到 2.5，让指针压在缩放柄上时也够得着半径点。
    const down = startSelect(
      idleSelectState(),
      controlCtx({ x: 3, y: 0 }, {
        document,
        selectionId: "circle-1",
        controlTolerance: 2.5,
      }),
    );

    expect(down.state).toEqual({
      kind: "control",
      id: "circle-1",
      pointId: "radius",
    });
    expect(down.selectionId).toBe("circle-1");
    expect(down.commit).toBeNull();
  });

  test("控制点赢本体：按下线段端点进入控制点手势而非拖动", () => {
    const document = lineAndCircleDoc();
    const down = startSelect(
      idleSelectState(),
      controlCtx({ x: 0, y: 0 }, { document, selectionId: "line-1" }),
    );

    expect(down.state).toEqual({
      kind: "control",
      id: "line-1",
      pointId: "vertex-0",
    });
  });

  test("柄仍赢本体：控制点容差外、柄容差内进入缩放", () => {
    const document = circlePointDoc();
    const down = startSelect(
      idleSelectState(),
      controlCtx({ x: 3, y: 0 }, { document, selectionId: "circle-1" }),
    );

    expect(down.state.kind).toBe("scale");
  });

  test("未选中或零控制点容差时控制点不干扰本体命中", () => {
    const document = lineAndCircleDoc();

    const noSelection = startSelect(
      idleSelectState(),
      controlCtx({ x: 0, y: 0 }, { document }),
    );
    expect(noSelection.state.kind).toBe("drag");

    const noTolerance = startSelect(
      idleSelectState(),
      ctx({ x: 0, y: 0 }, { document, selectionId: "line-1" }),
    );
    expect(noTolerance.state.kind).toBe("drag");
  });

  test("单击控制点保持选中，不取消也不提交", () => {
    const document = circlePointDoc();
    const clicked = clickSelect(
      idleSelectState(),
      controlCtx({ x: 1, y: 0 }, { document, selectionId: "circle-1" }),
    );

    expect(clicked.selectionId).toBe("circle-1");
    expect(clicked.commit).toBeNull();
  });
});

describe("select-gesture 拖控制点", () => {
  test("拖半径点只改半径：预览圆心不动，说明书未变", () => {
    const document = circlePointDoc();
    const snapshot = structuredClone(document);

    const down = startSelect(
      idleSelectState(),
      controlCtx({ x: 1, y: 0 }, { document, selectionId: "circle-1" }),
    );
    const moved = moveSelect(
      down.state,
      controlCtx({ x: 0, y: 4.6 }, { document, selectionId: "circle-1" }),
    );

    expect(moved.commit).toBeNull();
    expect(moved.preview).toEqual({
      type: "circle",
      cx: 0,
      cy: 0,
      r: 5,
    });
    expect(document).toEqual(snapshot);
  });

  test("拖端点只改该端点，另一端不动", () => {
    const document = lineAndCircleDoc();
    const down = startSelect(
      idleSelectState(),
      controlCtx({ x: 4, y: 0 }, { document, selectionId: "line-1" }),
    );
    const moved = moveSelect(
      down.state,
      controlCtx({ x: 5.2, y: 1.1 }, { document, selectionId: "line-1" }),
    );

    expect(moved.preview).toEqual({
      type: "line",
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 1 },
      ],
    });
  });

  test("拖起止角点只改角度：半径与另一端角度不动", () => {
    const document = sectorPointDoc();
    const down = startSelect(
      idleSelectState(),
      controlCtx({ x: 0, y: 2 }, { document, selectionId: "sector-1" }),
    );
    const moved = moveSelect(
      down.state,
      controlCtx({ x: 0, y: -2.3 }, { document, selectionId: "sector-1" }),
    );

    expect(moved.preview).toEqual({
      type: "sector",
      cx: 0,
      cy: 0,
      r: 2,
      startDeg: 0,
      endDeg: 270,
    });
  });

  test("拖圆心只挪圆心，半径角度原样", () => {
    const document = sectorPointDoc();
    const down = startSelect(
      idleSelectState(),
      controlCtx({ x: 0, y: 0 }, { document, selectionId: "sector-1" }),
    );
    const moved = moveSelect(
      down.state,
      controlCtx({ x: 1.2, y: 0.9 }, { document, selectionId: "sector-1" }),
    );

    expect(moved.preview).toEqual({
      type: "sector",
      cx: 1,
      cy: 1,
      r: 2,
      startDeg: 0,
      endDeg: 90,
    });
  });

  test("松手一次提交吸附后的目标点，整串手势只有这一次 commit", () => {
    const document = circlePointDoc();

    const down = startSelect(
      idleSelectState(),
      controlCtx({ x: 1, y: 0 }, { document, selectionId: "circle-1" }),
    );
    expect(down.commit).toBeNull();
    for (const point of [{ x: 0, y: 2.4 }, { x: 2, y: 2 }, { x: 0, y: 4.6 }]) {
      const moved = moveSelect(
        down.state,
        controlCtx(point, { document, selectionId: "circle-1" }),
      );
      expect(moved.commit).toBeNull();
    }
    const up = upSelect(
      down.state,
      controlCtx({ x: 0, y: 4.6 }, { document, selectionId: "circle-1" }),
    );

    expect(up.commit).toEqual({
      kind: "controlPoint",
      id: "circle-1",
      pointId: "radius",
      point: { x: 0, y: 5 },
    });
    expect(up.state).toEqual(idleSelectState());
    expect(up.preview).toBeNull();
  });

  test("拖回原位（吸附后与控制点同格）不提交", () => {
    const document = circlePointDoc();
    const down = startSelect(
      idleSelectState(),
      controlCtx({ x: 1, y: 0 }, { document, selectionId: "circle-1" }),
    );
    const up = upSelect(
      down.state,
      controlCtx({ x: 1.4, y: 0.2 }, { document, selectionId: "circle-1" }),
    );

    expect(up.commit).toBeNull();
    expect(up.state).toEqual(idleSelectState());
  });

  test("Esc 放弃控制点拖动且不提交", () => {
    const document = circlePointDoc();
    const down = startSelect(
      idleSelectState(),
      controlCtx({ x: 1, y: 0 }, { document, selectionId: "circle-1" }),
    );
    const moved = moveSelect(
      down.state,
      controlCtx({ x: 0, y: 4 }, { document, selectionId: "circle-1" }),
    );
    const cancelled = escSelect(moved.state);

    expect(cancelled.commit).toBeNull();
    expect(cancelled.state).toEqual(idleSelectState());
  });

  test("拖动中图元被删则回 idle 不再出预览", () => {
    const document = circlePointDoc();
    const down = startSelect(
      idleSelectState(),
      controlCtx({ x: 1, y: 0 }, { document, selectionId: "circle-1" }),
    );
    const moved = moveSelect(
      down.state,
      controlCtx({ x: 0, y: 4 }, { document: doc2d([]) }),
    );

    expect(moved.state).toEqual(idleSelectState());
    expect(moved.preview).toBeNull();
    expect(moved.commit).toBeNull();
  });
});

const rectangleDoc = (): GeometryDocument =>
  doc2d([
    {
      id: "rect-1",
      type: "rectangle",
      x: 1,
      y: 2,
      width: 4,
      height: 2,
      rotationDeg: 30,
      fill: "none",
    },
  ]);

describe("select-gesture 矩形", () => {
  test("命中矩形本体进入拖动，平移预览只改中心", () => {
    const document = rectangleDoc();
    const snapshot = structuredClone(document);

    const down = startSelect(idleSelectState(), ctx({ x: 1, y: 2 }, { document }));
    expect(down.state).toEqual({
      kind: "drag",
      id: "rect-1",
      start: { x: 1, y: 2 },
    });

    const moved = moveSelect(
      down.state,
      ctx({ x: 2.2, y: 3.1 }, { document }),
    );
    expect(moved.commit).toBeNull();
    expect(moved.preview).toEqual({
      type: "rectangle",
      x: 2,
      y: 3,
      width: 4,
      height: 2,
      rotationDeg: 30,
    });
    expect(document).toEqual(snapshot);
  });

  test("selectPreview 携带 x/y/width/height/rotationDeg", () => {
    expect(selectPreview(rectangleDoc(), "rect-1")).toEqual({
      type: "rectangle",
      x: 1,
      y: 2,
      width: 4,
      height: 2,
      rotationDeg: 30,
    });
  });

  test("变换柄：reach 为半对角线长，矩形旋转缩放两柄齐备", () => {
    const handles = transformHandles(
      primitiveOf(rectangleDoc(), "rect-1"),
      0.5,
    );

    const offset = Math.hypot(2, 1) + 4 * 0.5;
    expect(handles?.center).toEqual({ x: 1, y: 2 });
    expect(handles?.rotate).toEqual({ x: 1, y: 2 + offset });
    expect(handles?.scale).toEqual({ x: 1 + offset, y: 2 });
  });

  test("拖角控制点：预览只改宽高，松手一次提交吸附后的目标点", () => {
    const document = doc2d([
      {
        id: "rect-1",
        type: "rectangle",
        x: 1,
        y: 2,
        width: 4,
        height: 2,
        rotationDeg: 0,
        fill: "none",
      },
    ]);

    // corner-0 在世界 (3,3)。
    const down = startSelect(
      idleSelectState(),
      controlCtx({ x: 3, y: 3 }, { document, selectionId: "rect-1" }),
    );
    expect(down.state).toEqual({
      kind: "control",
      id: "rect-1",
      pointId: "corner-0",
    });

    const moved = moveSelect(
      down.state,
      controlCtx({ x: 3.2, y: 4.6 }, { document, selectionId: "rect-1" }),
    );
    expect(moved.commit).toBeNull();
    expect(moved.preview).toEqual({
      type: "rectangle",
      x: 1,
      y: 2,
      width: 4,
      height: 6,
      rotationDeg: 0,
    });

    const up = upSelect(
      down.state,
      controlCtx({ x: 3.2, y: 4.6 }, { document, selectionId: "rect-1" }),
    );
    expect(up.commit).toEqual({
      kind: "controlPoint",
      id: "rect-1",
      pointId: "corner-0",
      point: { x: 3, y: 5 },
    });
    expect(up.state).toEqual(idleSelectState());
  });
});
