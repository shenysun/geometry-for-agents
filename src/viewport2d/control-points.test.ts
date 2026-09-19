import { describe, expect, test } from "vitest";
import { parseDocument } from "../document/index.ts";
import type { Primitive2d } from "../document/index.ts";
import { controlPoints } from "./control-points.ts";

function primitive2d(primitive: unknown): Primitive2d {
  const result = parseDocument({
    version: 1,
    space: "2d",
    underlay: null,
    primitives: [primitive],
  });
  if (!result.success) throw new Error(result.error);
  const parsed = result.document.primitives[0];
  if (parsed === undefined) throw new Error("missing primitive");
  return parsed as Primitive2d;
}

function expectPointCloseTo(
  actual: { x: number; y: number },
  expected: { x: number; y: number },
): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(1e-9);
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(1e-9);
}

function idsOf(primitive: Primitive2d): string[] {
  return controlPoints(primitive).map((point) => point.id);
}

describe("controlPoints 顶点族", () => {
  test("折线每个顶点一个控制点，id 带下标", () => {
    const line = primitive2d({
      id: "line-1",
      type: "line",
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 1 },
        { x: 8, y: 0 },
      ],
    });

    const points = controlPoints(line);
    expect(points.map((point) => point.id)).toEqual([
      "vertex-0",
      "vertex-1",
      "vertex-2",
    ]);
    expect(points.map((point) => point.kind)).toEqual([
      "vertex",
      "vertex",
      "vertex",
    ]);
    expectPointCloseTo(points[1]!.point, { x: 4, y: 1 });
  });

  test("多边形顶点同样逐点列出，圆心类字段不存在", () => {
    const polygon = primitive2d({
      id: "poly-1",
      type: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 0, y: 2 },
      ],
      fill: "none",
    });

    expect(idsOf(polygon)).toEqual(["vertex-0", "vertex-1", "vertex-2"]);
  });
});

describe("controlPoints 圆族", () => {
  test("圆露出圆心与半径点，半径点在 0° 方向的圆周上", () => {
    const circle = primitive2d({
      id: "circle-1",
      type: "circle",
      cx: 3,
      cy: -1,
      r: 2,
      fill: "none",
    });

    const points = controlPoints(circle);
    expect(points.map((point) => point.id)).toEqual(["center", "radius"]);
    expectPointCloseTo(points[0]!.point, { x: 3, y: -1 });
    expectPointCloseTo(points[1]!.point, { x: 5, y: -1 });
    expect(points[1]!.kind).toBe("radius");
  });

  test("环露出圆心与内外两个半径点", () => {
    const ring = primitive2d({
      id: "ring-1",
      type: "ring",
      cx: 0,
      cy: 0,
      rInner: 1,
      rOuter: 3,
      fill: "none",
    });

    const points = controlPoints(ring);
    expect(points.map((point) => point.id)).toEqual([
      "center",
      "rInner",
      "rOuter",
    ]);
    expectPointCloseTo(points[1]!.point, { x: 1, y: 0 });
    expectPointCloseTo(points[2]!.point, { x: 3, y: 0 });
  });

  test("扇形露出圆心、半径点与起止角点，角点落在圆周上", () => {
    const sector = primitive2d({
      id: "sector-1",
      type: "sector",
      cx: 0,
      cy: 0,
      r: 2,
      startDeg: 0,
      endDeg: 90,
      fill: "none",
    });

    const points = controlPoints(sector);
    expect(points.map((point) => point.id)).toEqual([
      "center",
      "radius",
      "startDeg",
      "endDeg",
    ]);
    expectPointCloseTo(points[1]!.point, { x: 2, y: 0 });
    expectPointCloseTo(points[2]!.point, { x: 2, y: 0 });
    expectPointCloseTo(points[3]!.point, { x: 0, y: 2 });
  });

  test("弓与弧同扇形：同一套圆心/半径/起止角目录", () => {
    const bow = primitive2d({
      id: "bow-1",
      type: "bow",
      cx: 1,
      cy: 1,
      r: 2,
      startDeg: 45,
      endDeg: 135,
      fill: "none",
    });
    const arc = primitive2d({
      id: "arc-1",
      type: "arc",
      cx: 0,
      cy: 0,
      r: 1,
      startDeg: 10,
      endDeg: 80,
    });

    expect(idsOf(bow)).toEqual(["center", "radius", "startDeg", "endDeg"]);
    expect(idsOf(arc)).toEqual(["center", "radius", "startDeg", "endDeg"]);
    const bowEnd = controlPoints(bow).find((point) => point.id === "endDeg");
    expect(bowEnd).toBeDefined();
    if (bowEnd !== undefined) {
      expectPointCloseTo(bowEnd.point, { x: 1 - Math.SQRT2, y: 1 + Math.SQRT2 });
    }
  });
});

describe("controlPoints 椭圆", () => {
  test("轴对齐时两半轴点分别落在长轴端与短轴端", () => {
    const ellipse = primitive2d({
      id: "ellipse-1",
      type: "ellipse",
      cx: 0,
      cy: 0,
      rx: 2,
      ry: 1,
      rotationDeg: 0,
      fill: "none",
    });

    const points = controlPoints(ellipse);
    expect(points.map((point) => point.id)).toEqual(["center", "rx", "ry"]);
    expectPointCloseTo(points[1]!.point, { x: 2, y: 0 });
    expectPointCloseTo(points[2]!.point, { x: 0, y: 1 });
  });

  test("带 rotationDeg 时半轴点跟随长轴方向旋转", () => {
    const ellipse = primitive2d({
      id: "ellipse-1",
      type: "ellipse",
      cx: 5,
      cy: 5,
      rx: 3,
      ry: 1,
      rotationDeg: 90,
      fill: "none",
    });

    const points = controlPoints(ellipse);
    // 长轴转到 +Y，短轴转到 -X。
    expectPointCloseTo(points[1]!.point, { x: 5, y: 8 });
    expectPointCloseTo(points[2]!.point, { x: 4, y: 5 });
  });
});

describe("controlPoints 矩形", () => {
  test("四角控制点按局部逆时针排列，中心不进目录（平移靠拖本体）", () => {
    const rectangle = primitive2d({
      id: "rect-1",
      type: "rectangle",
      x: 1,
      y: 2,
      width: 4,
      height: 2,
      rotationDeg: 0,
      fill: "none",
    });

    const points = controlPoints(rectangle);
    expect(points.map((point) => point.id)).toEqual([
      "corner-0",
      "corner-1",
      "corner-2",
      "corner-3",
    ]);
    expect(points.map((point) => point.kind)).toEqual([
      "corner",
      "corner",
      "corner",
      "corner",
    ]);
    // 局部 (+x,+y) 起，逆时针：右上 → 左上 → 左下 → 右下。
    expectPointCloseTo(points[0]!.point, { x: 3, y: 3 });
    expectPointCloseTo(points[1]!.point, { x: -1, y: 3 });
    expectPointCloseTo(points[2]!.point, { x: -1, y: 1 });
    expectPointCloseTo(points[3]!.point, { x: 3, y: 1 });
  });

  test("带 rotationDeg 时四角跟随旋转", () => {
    const rectangle = primitive2d({
      id: "rect-1",
      type: "rectangle",
      x: 1,
      y: 2,
      width: 4,
      height: 2,
      rotationDeg: 90,
      fill: "none",
    });

    const points = controlPoints(rectangle);
    // 局部 (+2,+1) 转 90° 后落到世界中心左上方向 (0,4)。
    expectPointCloseTo(points[0]!.point, { x: 0, y: 4 });
    expectPointCloseTo(points[2]!.point, { x: 2, y: 0 });
  });
});

describe("controlPoints 底/高家族", () => {
  test("三角露出三个顶点：左底角、右底角、顶点；锚点不进目录", () => {
    const triangle = primitive2d({
      id: "tri-1",
      type: "triangle",
      x: 1,
      y: 2,
      width: 4,
      height: 3,
      apexOffset: 1,
      rotationDeg: 0,
      fill: "none",
    });

    const points = controlPoints(triangle);
    expect(points.map((point) => point.id)).toEqual([
      "corner-0",
      "corner-1",
      "corner-2",
    ]);
    expect(points.map((point) => point.kind)).toEqual([
      "corner",
      "corner",
      "corner",
    ]);
    expectPointCloseTo(points[0]!.point, { x: -1, y: 2 });
    expectPointCloseTo(points[1]!.point, { x: 3, y: 2 });
    expectPointCloseTo(points[2]!.point, { x: 2, y: 5 });
  });

  test("平四/梯形露出四角，底边中点锚点不进目录（平移靠拖本体）", () => {
    const parallelogram = primitive2d({
      id: "para-1",
      type: "parallelogram",
      x: 1,
      y: 2,
      width: 4,
      height: 2,
      skew: 1,
      rotationDeg: 0,
      fill: "none",
    });
    const trapezoid = primitive2d({
      id: "trap-1",
      type: "trapezoid",
      x: 1,
      y: 2,
      width: 4,
      topWidth: 2,
      height: 2,
      topOffset: 0.5,
      rotationDeg: 0,
      fill: "none",
    });

    const paraPoints = controlPoints(parallelogram);
    expect(paraPoints.map((point) => point.id)).toEqual([
      "corner-0",
      "corner-1",
      "corner-2",
      "corner-3",
    ]);
    // 底边两端 + 上底两端（上底整体平移 skew）。
    expectPointCloseTo(paraPoints[0]!.point, { x: -1, y: 2 });
    expectPointCloseTo(paraPoints[1]!.point, { x: 3, y: 2 });
    expectPointCloseTo(paraPoints[2]!.point, { x: 4, y: 4 });
    expectPointCloseTo(paraPoints[3]!.point, { x: 0, y: 4 });

    const trapPoints = controlPoints(trapezoid);
    expect(trapPoints.map((point) => point.id)).toEqual([
      "corner-0",
      "corner-1",
      "corner-2",
      "corner-3",
    ]);
    expectPointCloseTo(trapPoints[2]!.point, { x: 2.5, y: 4 });
    expectPointCloseTo(trapPoints[3]!.point, { x: 0.5, y: 4 });
  });

  test("带 rotationDeg 时顶点绕锚点旋到世界", () => {
    const triangle = primitive2d({
      id: "tri-1",
      type: "triangle",
      x: 1,
      y: 2,
      width: 4,
      height: 3,
      apexOffset: 0,
      rotationDeg: 90,
      fill: "none",
    });

    const points = controlPoints(triangle);
    // 顶点局部 (0,3) 转 90° 后世界 (1-3, 2)。
    expectPointCloseTo(points[2]!.point, { x: -2, y: 2 });
    // 左底角局部 (-2,0) 转 90° 后世界 (1, 0)。
    expectPointCloseTo(points[0]!.point, { x: 1, y: 0 });
  });
});

describe("controlPoints 角", () => {
  test("露出顶点与两边端点：顶点 kind vertex，端点 kind sweepAngle", () => {
    const angle = primitive2d({
      id: "angle-1",
      type: "angle",
      x: 1,
      y: 2,
      startDeg: 0,
      endDeg: 90,
      length: 4,
    });

    const points = controlPoints(angle);
    expect(points.map((point) => point.id)).toEqual([
      "apex",
      "startDeg",
      "endDeg",
    ]);
    expect(points.map((point) => point.kind)).toEqual([
      "vertex",
      "sweepAngle",
      "sweepAngle",
    ]);
    expectPointCloseTo(points[0]!.point, { x: 1, y: 2 });
    // startDeg 0 端点 (5,2)；endDeg 90 端点 (1,6)（cos(90°) 有 ε，容差断言）。
    expectPointCloseTo(points[1]!.point, { x: 5, y: 2 });
    expectPointCloseTo(points[2]!.point, { x: 1, y: 6 });
  });
});

describe("controlPoints 正多边形", () => {
  test("n 个顶点带下标，中心不进目录（平移靠拖本体）", () => {
    const pentagon = primitive2d({
      id: "pent-1",
      type: "regularPolygon",
      x: 1,
      y: 2,
      sides: 5,
      r: 2,
      rotationDeg: 0,
      fill: "none",
    });

    const points = controlPoints(pentagon);
    expect(points.map((point) => point.id)).toEqual([
      "vertex-0",
      "vertex-1",
      "vertex-2",
      "vertex-3",
      "vertex-4",
    ]);
    expect(points.every((point) => point.kind === "vertex")).toBe(true);
    // 房顶尖（局部 90°）：世界 (1, 4)。
    expectPointCloseTo(points[2]!.point, { x: 1, y: 4 });
    // 底边右端（局部 -54°）：(1+2cos(-54°), 2+2sin(-54°))。
    expectPointCloseTo(points[0]!.point, {
      x: 1 + 2 * Math.cos((-54 * Math.PI) / 180),
      y: 2 + 2 * Math.sin((-54 * Math.PI) / 180),
    });
  });
});

describe("controlPoints 尺寸标注线", () => {
  test("两端点即控制点（沿 line 先例）", () => {
    const dimension = primitive2d({
      id: "dim-1",
      type: "dimension",
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 3 },
      ],
    });

    const points = controlPoints(dimension);
    expect(points.map((point) => point.id)).toEqual(["vertex-0", "vertex-1"]);
    expect(points.every((point) => point.kind === "vertex")).toBe(true);
    expect(points[0]!.point).toEqual({ x: 0, y: 0 });
    expect(points[1]!.point).toEqual({ x: 4, y: 3 });
  });
});

describe("controlPoints 标签", () => {  test("标签没有控制点（位置靠拖本体平移）", () => {
    const label = primitive2d({
      id: "label-1",
      type: "label",
      x: 2,
      y: 2,
      text: "A",
    });
    expect(controlPoints(label)).toEqual([]);
  });
});

describe("controlPoints 变换图元（票 03）", () => {
  function transform2d(entry: unknown): Primitive2d {
    const result = parseDocument({
      version: 1,
      space: "2d",
      underlay: null,
      primitives: [
        { id: "src", type: "circle", cx: 0, cy: 0, r: 2, fill: "none" },
        entry,
      ],
    });
    if (!result.success) throw new Error(result.error);
    const parsed = result.document.primitives.find(
      (primitive) => primitive.id === "t-1",
    );
    if (parsed === undefined) throw new Error("missing transform");
    return parsed as Primitive2d;
  }

  test("旋转/位似各露出一个中心控制点（选中后可拖，参数字段同步）", () => {
    const rotate = transform2d({
      id: "t-1",
      type: "transform",
      sourceId: "src",
      kind: "rotate",
      centerX: 3,
      centerY: -2,
      angleDeg: 90,
    });
    const dilate = transform2d({
      id: "t-1",
      type: "transform",
      sourceId: "src",
      kind: "dilate",
      centerX: -1,
      centerY: 4,
      ratio: 2,
    });

    expect(controlPoints(rotate)).toEqual([
      { id: "center", kind: "center", point: { x: 3, y: -2 } },
    ]);
    expect(controlPoints(dilate)).toEqual([
      { id: "center", kind: "center", point: { x: -1, y: 4 } },
    ]);
  });

  test("平移变换没有控制点（位移向量靠属性面板，票 05）", () => {
    const translate = transform2d({
      id: "t-1",
      type: "transform",
      sourceId: "src",
      kind: "translate",
      dx: 1,
      dy: 2,
    });

    expect(idsOf(translate)).toEqual([]);
  });
});
