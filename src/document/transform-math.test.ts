import { describe, expect, test } from "vitest";
import {
  previewTransformParamsOf,
  resolveTransformImage,
  transformImage,
  transformParamOf,
  transformParamsOf,
  transformPoint,
  withTransformParam,
  withTransformParams,
  type Transformable2d,
  type TransformParams,
} from "./transform-math.ts";
import {
  anchorRotatedVertex,
  baseHeightWorldVertices,
} from "./base-height-family.ts";
import { regularPolygonWorldVertices } from "./regular-polygon.ts";
import { angleSweepDeg } from "./measure-math.ts";
import type { Point2 } from "./snap.ts";

// ---------------------------------------------------------------------------
// 变换数学纯函数层（ticket 01 / ADR 0022）：只断言几何输出，不触实现细节。
// 期望值来源三类：手算坐标（防同义反复）、既有顶点目录（底/高族、正多边形，
// 与被测实现互相独立）、角度 sweep 复用（measure-math）。
// ---------------------------------------------------------------------------

function expectPointCloseTo(actual: Point2, expected: Point2): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(1e-9);
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(1e-9);
}

function expectCloseTo(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(1e-9);
}

/** 角度断言按模 360 等价：镜像公式的代表值（360 vs 0）不是几何事实。 */
function expectDegEquivalent(actual: number, expected: number): void {
  const normalized = ((actual - expected) % 360 + 360) % 360;
  expect(Math.min(normalized, 360 - normalized)).toBeLessThan(1e-9);
}

const translate = (dx: number, dy: number): TransformParams => ({
  kind: "translate",
  dx,
  dy,
});

const rotate = (
  centerX: number,
  centerY: number,
  angleDeg: number,
): TransformParams => ({ kind: "rotate", centerX, centerY, angleDeg });

const reflect = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): TransformParams => ({ kind: "reflect", x1, y1, x2, y2 });

const dilate = (
  centerX: number,
  centerY: number,
  ratio: number,
): TransformParams => ({ kind: "dilate", centerX, centerY, ratio });

describe("单点求像 transformPoint", () => {
  test("平移", () => {
    expectPointCloseTo(transformPoint({ x: 2, y: 3 }, translate(4, -1)), {
      x: 6,
      y: 2,
    });
  });

  test("旋转：绕原点逆时针 90°（正角逆时针，AC：世界坐标 Y 向上）", () => {
    expectPointCloseTo(transformPoint({ x: 1, y: 0 }, rotate(0, 0, 90)), {
      x: 0,
      y: 1,
    });
    expectPointCloseTo(transformPoint({ x: 0, y: 1 }, rotate(0, 0, 90)), {
      x: -1,
      y: 0,
    });
  });

  test("旋转：绕非原点中心", () => {
    expectPointCloseTo(transformPoint({ x: 2, y: 1 }, rotate(1, 1, 90)), {
      x: 1,
      y: 2,
    });
  });

  test("旋转：180°、负角（顺时针）、超 360°（AC：均正确）", () => {
    expectPointCloseTo(transformPoint({ x: 2, y: 1 }, rotate(0, 0, 180)), {
      x: -2,
      y: -1,
    });
    // -90° 即顺时针 90°：(1,0) → (0,-1)
    expectPointCloseTo(transformPoint({ x: 1, y: 0 }, rotate(0, 0, -90)), {
      x: 0,
      y: -1,
    });
    // 450° = 90° + 整周
    expectPointCloseTo(transformPoint({ x: 1, y: 0 }, rotate(0, 0, 450)), {
      x: 0,
      y: 1,
    });
  });

  test("轴对称：垂直轴、水平轴、斜率为 1 的轴（AC：任意斜率含特例）", () => {
    // y 轴：(x,y) → (−x,y)
    expectPointCloseTo(transformPoint({ x: 2, y: 3 }, reflect(0, 0, 0, 1)), {
      x: -2,
      y: 3,
    });
    // x 轴：(x,y) → (x,−y)
    expectPointCloseTo(transformPoint({ x: 2, y: 3 }, reflect(0, 0, 1, 0)), {
      x: 2,
      y: -3,
    });
    // 水平线 y=1：(2,3) → (2,−1)
    expectPointCloseTo(transformPoint({ x: 2, y: 3 }, reflect(0, 1, 1, 1)), {
      x: 2,
      y: -1,
    });
    // 对角线 y=x：(2,0) → (0,2)
    expectPointCloseTo(transformPoint({ x: 2, y: 0 }, reflect(0, 0, 1, 1)), {
      x: 0,
      y: 2,
    });
  });

  test("位似：比 >1、0~1、负比（中心另一侧）", () => {
    expectPointCloseTo(transformPoint({ x: 2, y: 0 }, dilate(1, 0, 2)), {
      x: 3,
      y: 0,
    });
    expectPointCloseTo(transformPoint({ x: 2, y: 0 }, dilate(0, 0, 0.5)), {
      x: 1,
      y: 0,
    });
    // 比 -1 是中心对称：(2,3) → (−2,−3)
    expectPointCloseTo(transformPoint({ x: 2, y: 3 }, dilate(0, 0, -1)), {
      x: -2,
      y: -3,
    });
  });
});

// ---------------------------------------------------------------------------
// 平移（AC：对笔画族、封闭族、点名各几何施加位移向量）
// ---------------------------------------------------------------------------

describe("平移求像", () => {
  test("笔画族：折线逐点位移", () => {
    const line = transformImage(
      {
        id: "l1",
        type: "line",
        points: [
          { x: 0, y: 0 },
          { x: 2, y: 1 },
        ],
      },
      translate(3, -1),
    );
    expect(line).toEqual({
      id: "l1",
      type: "line",
      points: [
        { x: 3, y: -1 },
        { x: 5, y: 0 },
      ],
    });
  });

  test("封闭族：圆心位移、半径不动", () => {
    const circle = transformImage(
      { id: "c1", type: "circle", cx: 1, cy: 2, r: 3, fill: "none" },
      translate(-2, 5),
    );
    expect(circle).toEqual({
      id: "c1",
      type: "circle",
      cx: -1,
      cy: 7,
      r: 3,
      fill: "none",
    });
  });

  test("笔画族：角图元锚点位移、方向角与边长不动", () => {
    const image = transformImage(
      {
        id: "a1",
        type: "angle",
        x: 1,
        y: 1,
        startDeg: 30,
        endDeg: 90,
        length: 4,
      },
      translate(2, 3),
    );
    expect(image).toEqual({
      id: "a1",
      type: "angle",
      x: 3,
      y: 4,
      startDeg: 30,
      endDeg: 90,
      length: 4,
    });
  });

  test("笔画族：尺寸标注两点位移（显示数字是推导值，随点自动更新）", () => {
    const image = transformImage(
      {
        id: "d1",
        type: "dimension",
        points: [
          { x: 0, y: 0 },
          { x: 3, y: 0 },
        ],
      },
      translate(1, 2),
    );
    expect(image.points).toEqual([
      { x: 1, y: 2 },
      { x: 4, y: 2 },
    ]);
  });

  test("点名：锚点位移、文本不动", () => {
    const label = transformImage(
      { id: "t1", type: "label", x: 1, y: 2, text: "A" },
      translate(1, 1),
    );
    expect(label).toEqual({ id: "t1", type: "label", x: 2, y: 3, text: "A" });
  });
});

// ---------------------------------------------------------------------------
// 旋转（AC：正角逆时针；180°、负角、超 360° 均正确）
// ---------------------------------------------------------------------------

describe("旋转求像", () => {
  test("多边形顶点绕原点逆时针 90°", () => {
    const image = transformImage(
      {
        id: "p1",
        type: "polygon",
        points: [
          { x: 1, y: 0 },
          { x: 2, y: 0 },
          { x: 1, y: 1 },
        ],
        fill: "none",
      },
      rotate(0, 0, 90),
    );
    expectPointCloseTo(image.points[0]!, { x: 0, y: 1 });
    expectPointCloseTo(image.points[1]!, { x: 0, y: 2 });
    expectPointCloseTo(image.points[2]!, { x: -1, y: 1 });
  });

  test("矩形：锚点随变换、旋转角累加、宽高不动", () => {
    const image = transformImage(
      {
        id: "r1",
        type: "rectangle",
        x: 1,
        y: 0,
        width: 4,
        height: 2,
        rotationDeg: 30,
        fill: "none",
      },
      rotate(0, 0, 90),
    );
    expectCloseTo(image.x, 0);
    expectCloseTo(image.y, 1);
    expectCloseTo(image.width, 4);
    expectCloseTo(image.height, 2);
    expectCloseTo(image.rotationDeg, 120);
  });

  test("角图元：锚点旋转、起止方向角加旋转角", () => {
    const image = transformImage(
      {
        id: "a1",
        type: "angle",
        x: 1,
        y: 0,
        startDeg: 30,
        endDeg: 90,
        length: 4,
      },
      rotate(0, 0, 90),
    );
    expectCloseTo(image.x, 0);
    expectCloseTo(image.y, 1);
    expectCloseTo(image.startDeg, 120);
    expectCloseTo(image.endDeg, 180);
    expectCloseTo(image.length, 4);
  });

  test("180°：矩形绕中心外一点转成中心对称", () => {
    const image = transformImage(
      { id: "c1", type: "circle", cx: 3, cy: 0, r: 2, fill: "none" },
      rotate(1, 0, 180),
    );
    expectCloseTo(image.cx, -1);
    expectCloseTo(image.cy, 0);
    expectCloseTo(image.r, 2);
  });

  test("负角（顺时针）：矩形旋转角累加负值", () => {
    const image = transformImage(
      {
        id: "r1",
        type: "rectangle",
        x: 1,
        y: 0,
        width: 4,
        height: 2,
        rotationDeg: 30,
        fill: "none",
      },
      rotate(0, 0, -90),
    );
    expectCloseTo(image.x, 0);
    expectCloseTo(image.y, -1);
    expectCloseTo(image.rotationDeg, -60);
  });

  test("扇形与弓形：中心旋转、起止角加转角、半径不动", () => {
    const sector = transformImage(
      {
        id: "s1",
        type: "sector",
        cx: 1,
        cy: 0,
        r: 2,
        startDeg: 30,
        endDeg: 90,
        fill: "none",
      },
      rotate(0, 0, 90),
    );
    expectCloseTo(sector.cx, 0);
    expectCloseTo(sector.cy, 1);
    expectCloseTo(sector.r, 2);
    expectCloseTo(sector.startDeg, 120);
    expectCloseTo(sector.endDeg, 180);
    const bow = transformImage(
      {
        id: "b1",
        type: "bow",
        cx: 1,
        cy: 0,
        r: 2,
        startDeg: 30,
        endDeg: 90,
        fill: "none",
      },
      rotate(0, 0, 90),
    );
    expectCloseTo(bow.cx, 0);
    expectCloseTo(bow.cy, 1);
    expectCloseTo(bow.startDeg, 120);
    expectCloseTo(bow.endDeg, 180);
    expectCloseTo(angleSweepDeg(bow.startDeg, bow.endDeg), 60);
  });

  test("点名：锚点照旋转、文本不动（特例对四 kind 通用）", () => {
    const image = transformImage(
      { id: "t1", type: "label", x: 1, y: 0, text: "A" },
      rotate(0, 0, 90),
    );
    expectPointCloseTo({ x: image.x, y: image.y }, { x: 0, y: 1 });
    expect(image.text).toBe("A");
  });
});

// ---------------------------------------------------------------------------
// 轴对称（AC：以两点定轴求像，轴为任意斜率直线含水平/垂直特例）
// ---------------------------------------------------------------------------

describe("轴对称求像", () => {
  test("三角形：x 轴镜像翻转顶点侧——apexOffset 翻号、旋转角加 180°", () => {
    // 源：锚点 (0,0)、底 4、高 3、顶点偏右 2（顶点在 (2,3)）；
    // 镜像后顶点在 (2,−3)：底边代表方向翻转即 rotationDeg 180、偏移翻号。
    const image = transformImage(
      {
        id: "tri1",
        type: "triangle",
        x: 0,
        y: 0,
        width: 4,
        height: 3,
        apexOffset: 2,
        rotationDeg: 0,
        fill: "none",
      },
      reflect(0, 0, 1, 0),
    );
    expectCloseTo(image.x, 0);
    expectCloseTo(image.y, 0);
    expectCloseTo(image.width, 4);
    expectCloseTo(image.height, 3);
    expectCloseTo(image.apexOffset, -2);
    expectCloseTo(image.rotationDeg, 180);
    // 像的世界顶点 = 源顶点的镜像：(2,3) → (2,−3)（顶点目录独立佐证）。
    expectSamePointSet(baseHeightWorldVertices(image), [
      { x: -2, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: -3 },
    ]);
  });

  test("平行四边形：镜像翻 skew", () => {
    // 底沿 X、顶边右移 skew=1；绕 y 轴镜像后顶边左移 1。
    const image = transformImage(
      {
        id: "pa1",
        type: "parallelogram",
        x: 0,
        y: 0,
        width: 4,
        height: 2,
        skew: 1,
        rotationDeg: 0,
        fill: "none",
      },
      reflect(0, 0, 0, 1),
    );
    expectCloseTo(image.skew, -1);
    expectDegEquivalent(image.rotationDeg, 0);
    expectSamePointSet(baseHeightWorldVertices(image), [
      { x: -2, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 2 },
      { x: -3, y: 2 },
    ]);
  });

  test("梯形：镜像翻 topOffset", () => {
    const image = transformImage(
      {
        id: "tz1",
        type: "trapezoid",
        x: 0,
        y: 0,
        width: 4,
        topWidth: 2,
        height: 2,
        topOffset: 1,
        rotationDeg: 0,
        fill: "none",
      },
      reflect(0, 0, 0, 1),
    );
    expectCloseTo(image.topOffset, -1);
    expectDegEquivalent(image.rotationDeg, 0);
    expectSamePointSet(baseHeightWorldVertices(image), [
      { x: -2, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
      { x: -2, y: 2 },
    ]);
  });

  test("椭圆：镜像翻转旋转角（旋转 30° 绕 y 轴 → 150°）", () => {
    const image = transformImage(
      {
        id: "e1",
        type: "ellipse",
        cx: 3,
        cy: 1,
        rx: 2,
        ry: 1,
        rotationDeg: 30,
        fill: "none",
      },
      reflect(0, 0, 0, 1),
    );
    expectCloseTo(image.cx, -3);
    expectCloseTo(image.cy, 1);
    expectCloseTo(image.rx, 2);
    expectCloseTo(image.ry, 1);
    expectCloseTo(image.rotationDeg, 150);
  });

  test("弧族：镜像换向——起止角映到轴的另一侧并交换", () => {
    // 上右象限弧（30°→90° 逆时针）绕 y 轴镜像成上左象限（90°→150°）。
    const image = transformImage(
      {
        id: "arc1",
        type: "arc",
        cx: 1,
        cy: 1,
        r: 2,
        startDeg: 30,
        endDeg: 90,
      },
      reflect(0, 0, 0, 1),
    );
    expectCloseTo(image.startDeg, 90);
    expectCloseTo(image.endDeg, 150);
    expectCloseTo(angleSweepDeg(image.startDeg, image.endDeg), 60);
    expectCloseTo(image.cx, -1);
    expectCloseTo(image.cy, 1);
    expectCloseTo(image.r, 2);
  });

  test("正多边形：镜像后顶点集是源顶点集的镜像（奇数边最严）", () => {
    const source: Transformable2d = {
      id: "rp1",
      type: "regularPolygon",
      x: 1,
      y: 1,
      sides: 5,
      r: 2,
      rotationDeg: 20,
      fill: "none",
    };
    const image = transformImage(source, reflect(0, 0, 0, 1));
    expectSamePointSet(
      regularPolygonWorldVertices(image),
      regularPolygonWorldVertices(source).map((vertex) =>
        transformPoint(vertex, reflect(0, 0, 0, 1)),
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// 位似（AC：比 >1 / 0~1 / 负值均正确）
// ---------------------------------------------------------------------------

describe("位似求像", () => {
  test("比 2：三角形整体系数放大、锚点随变换", () => {
    const image = transformImage(
      {
        id: "tri1",
        type: "triangle",
        x: 1,
        y: 0,
        width: 4,
        height: 3,
        apexOffset: 2,
        rotationDeg: 0,
        fill: "none",
      },
      dilate(0, 0, 2),
    );
    expectCloseTo(image.x, 2);
    expectCloseTo(image.y, 0);
    expectCloseTo(image.width, 8);
    expectCloseTo(image.height, 6);
    expectCloseTo(image.apexOffset, 4);
  });

  test("比 0.5：圆心向中心收拢、半径减半", () => {
    const image = transformImage(
      { id: "c1", type: "circle", cx: 4, cy: 0, r: 2, fill: "none" },
      dilate(0, 0, 0.5),
    );
    expectCloseTo(image.cx, 2);
    expectCloseTo(image.cy, 0);
    expectCloseTo(image.r, 1);
  });

  test("负比：像在中心另一侧，尺寸按绝对值缩放（环）", () => {
    const image = transformImage(
      {
        id: "rg1",
        type: "ring",
        cx: 3,
        cy: 0,
        rInner: 1,
        rOuter: 2,
        fill: "none",
      },
      dilate(0, 0, -2),
    );
    expectCloseTo(image.cx, -6);
    expectCloseTo(image.cy, 0);
    expectCloseTo(image.rInner, 2);
    expectCloseTo(image.rOuter, 4);
  });

  test("负比保定向：顶点偏移不翻号、旋转角加 180°", () => {
    const image = transformImage(
      {
        id: "tri1",
        type: "triangle",
        x: 1,
        y: 0,
        width: 4,
        height: 3,
        apexOffset: 2,
        rotationDeg: 10,
        fill: "none",
      },
      dilate(0, 0, -1),
    );
    expectCloseTo(image.x, -1);
    expectCloseTo(image.y, 0);
    expectCloseTo(image.apexOffset, 2);
    expectCloseTo(image.rotationDeg, 190);
  });

  test("点名特例：锚点照变换（含负比）、字形不缩放——文本原样", () => {
    const image = transformImage(
      { id: "t1", type: "label", x: 2, y: 0, text: "A′" },
      dilate(0, 0, -2),
    );
    expect(image).toEqual({ id: "t1", type: "label", x: -4, y: 0, text: "A′" });
  });
});

// ---------------------------------------------------------------------------
// 顶点一致性：像图元经既有顶点目录解出的顶点 == 源顶点逐点求像。
// 覆盖带 rotationDeg 的全部参数族 × 四 kind（公式正误的独立佐证）。
// ---------------------------------------------------------------------------

function expectSamePointSet(actual: Point2[], expected: Point2[]): void {
  expect(actual.length).toBe(expected.length);
  const remaining = [...expected];
  for (const point of actual) {
    const index = remaining.findIndex(
      (candidate) =>
        Math.abs(candidate.x - point.x) < 1e-9 &&
        Math.abs(candidate.y - point.y) < 1e-9,
    );
    expect(index, `多出未预期的点 (${point.x}, ${point.y})`).toBeGreaterThan(-1);
    remaining.splice(index, 1);
  }
}

/** 带世界顶点目录的参数族（矩形四角 / 底高三族 / 正多边形）。 */
type VertexFamilySource = Extract<
  Transformable2d,
  {
    type:
      | "rectangle"
      | "triangle"
      | "parallelogram"
      | "trapezoid"
      | "regularPolygon";
  }
>;

const rotationFamilySource: VertexFamilySource[] = [
  {
    id: "rect",
    type: "rectangle",
    x: 3,
    y: 1,
    width: 4,
    height: 2,
    rotationDeg: 25,
    fill: "none",
  },
  {
    id: "tri",
    type: "triangle",
    x: 2,
    y: 1,
    width: 4,
    height: 3,
    apexOffset: 1,
    rotationDeg: -40,
    fill: "none",
  },
  {
    id: "para",
    type: "parallelogram",
    x: -1,
    y: 2,
    width: 5,
    height: 2,
    skew: 2,
    rotationDeg: 65,
    fill: "none",
  },
  {
    id: "trap",
    type: "trapezoid",
    x: 1,
    y: -1,
    width: 6,
    topWidth: 3,
    height: 2,
    topOffset: -1,
    rotationDeg: 110,
    fill: "none",
  },
  {
    id: "penta",
    type: "regularPolygon",
    x: 1,
    y: 2,
    sides: 5,
    r: 2,
    rotationDeg: 20,
    fill: "none",
  },
];

/** 矩形四角（世界系）：与 measure-math 的顶点推导同式、独立于被测实现。 */
function rectangleCorners(
  shape: Extract<Transformable2d, { type: "rectangle" }>,
): Point2[] {
  return (
    [
      { x: shape.width / 2, y: shape.height / 2 },
      { x: -shape.width / 2, y: shape.height / 2 },
      { x: -shape.width / 2, y: -shape.height / 2 },
      { x: shape.width / 2, y: -shape.height / 2 },
    ] as const
  ).map((corner) => anchorRotatedVertex(shape, corner));
}

const allParams: TransformParams[] = [
  translate(2, -3),
  rotate(1, 1, 137),
  reflect(0, 0, 2, 1),
  dilate(1, -1, -2),
];

describe("顶点一致性：参数族求像与逐点求像吻合", () => {
  for (const source of rotationFamilySource) {
    for (const params of allParams) {
      test(`${source.type} × ${params.kind}`, () => {
        const image = transformImage(source, params);
        const verticesOf = (shape: VertexFamilySource): Point2[] => {
          switch (shape.type) {
            case "rectangle":
              return rectangleCorners(shape);
            case "regularPolygon":
              return regularPolygonWorldVertices(shape);
            default:
              return baseHeightWorldVertices(shape);
          }
        };
        expectSamePointSet(
          verticesOf(image),
          verticesOf(source).map((vertex) => transformPoint(vertex, params)),
        );
      });
    }
  }
});

// ---------------------------------------------------------------------------
// 通用性质：像不改源（不可变）、样式与文本字段原样保留给渲染层。
// ---------------------------------------------------------------------------

describe("不可变与字段保留", () => {
  test("求像不改源图元", () => {
    const source: Transformable2d = {
      id: "tri1",
      type: "triangle",
      x: 1,
      y: 0,
      width: 4,
      height: 3,
      apexOffset: 2,
      rotationDeg: 0,
      fill: "solid",
    };
    const snapshot = structuredClone(source);
    transformImage(source, rotate(0, 0, 90));
    transformImage(source, dilate(2, 2, 3));
    expect(source).toEqual(snapshot);
  });

  test("像保留源的样式与文本字段（渲染层据此叠加虚线/半透明）", () => {
    const polygon = transformImage(
      {
        id: "p1",
        type: "polygon",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
        ],
        fill: "hatch",
      },
      translate(1, 1),
    );
    if (polygon.type !== "polygon") throw new Error("像应保持源类型");
    expect(polygon.fill).toBe("hatch");
    const angle = transformImage(
      {
        id: "a1",
        type: "angle",
        x: 0,
        y: 0,
        startDeg: 0,
        endDeg: 45,
        length: 4,
        showDeg: true,
      },
      translate(1, 1),
    );
    if (angle.type !== "angle") throw new Error("像应保持源类型");
    expect(angle.showDeg).toBe(true);
  });

  test("退化取值函数保持全：契约层拒绝，数学层原样返回", () => {
    const source: Transformable2d = {
      id: "c1",
      type: "circle",
      cx: 1,
      cy: 2,
      r: 3,
      fill: "none",
    };
    expect(transformImage(source, translate(0, 0))).toEqual(source);
    expect(transformImage(source, rotate(0, 0, 0))).toEqual(source);
    expect(transformImage(source, dilate(0, 0, 1))).toEqual(source);
  });
});

describe("transform-math 参数读写与预览合并（票 05 属性面板）", () => {
  const rotateEntry = {
    id: "t1",
    type: "transform",
    sourceId: "s1",
    kind: "rotate",
    centerX: 1,
    centerY: 2,
    angleDeg: 90,
  } as const;
  const translateEntry = {
    id: "t2",
    type: "transform",
    sourceId: "s1",
    kind: "translate",
    dx: 3,
    dy: -4,
  } as const;
  const reflectEntry = {
    id: "t3",
    type: "transform",
    sourceId: "s1",
    kind: "reflect",
    x1: 0,
    y1: 0,
    x2: 2,
    y2: 2,
  } as const;
  const dilateEntry = {
    id: "t4",
    type: "transform",
    sourceId: "s1",
    kind: "dilate",
    centerX: 0,
    centerY: 0,
    ratio: 2,
  } as const;

  test("transformParamOf：按 key 读参数，字段同名同义", () => {
    expect(transformParamOf(transformParamsOf(rotateEntry), "angleDeg")).toBe(90);
    expect(transformParamOf(transformParamsOf(rotateEntry), "centerY")).toBe(2);
    expect(transformParamOf(transformParamsOf(translateEntry), "dx")).toBe(3);
    expect(transformParamOf(transformParamsOf(reflectEntry), "x2")).toBe(2);
    expect(transformParamOf(transformParamsOf(dilateEntry), "ratio")).toBe(2);
  });

  test("withTransformParam：只写该键、其余字段原样（不可变）", () => {
    const edited = withTransformParam(rotateEntry, "angleDeg", -45);
    expect(edited).toEqual({ ...rotateEntry, angleDeg: -45 });
    expect(rotateEntry.angleDeg).toBe(90);
    expect(withTransformParam(translateEntry, "dy", 0)).toEqual({
      ...translateEntry,
      dy: 0,
    });
    expect(withTransformParam(reflectEntry, "y1", 1)).toEqual({
      ...reflectEntry,
      y1: 1,
    });
    expect(withTransformParam(dilateEntry, "ratio", -2)).toEqual({
      ...dilateEntry,
      ratio: -2,
    });
  });

  test("previewTransformParamsOf：预览活跃取预览参数，id 不匹配回落契约", () => {
    const preview = {
      id: "t1",
      params: transformParamsOf(
        withTransformParam(rotateEntry, "angleDeg", 180),
      ),
    };
    expect(
      transformParamOf(previewTransformParamsOf(preview, rotateEntry), "angleDeg"),
    ).toBe(180);
    expect(
      transformParamOf(previewTransformParamsOf(preview, translateEntry), "dx"),
    ).toBe(3);
    expect(
      transformParamOf(previewTransformParamsOf(null, rotateEntry), "angleDeg"),
    ).toBe(90);
  });

  test("withTransformParams：整组参数写回图元（滑块预览拼装用）", () => {
    const params = transformParamsOf(
      withTransformParam(dilateEntry, "ratio", -1.5),
    );
    expect(withTransformParams(dilateEntry, params)).toEqual({
      ...dilateEntry,
      ratio: -1.5,
    });
    // kind 定死：参数组与图元 kind 不一致时原样返回（防御，调用方不会触发）。
    expect(withTransformParams(rotateEntry, params)).toBe(rotateEntry);
  });
});

describe("查源求像的退化轴守卫（票 07）", () => {
  const source: Transformable2d = {
    id: "s1",
    type: "circle",
    cx: 0,
    cy: 0,
    r: 2,
    fill: "none",
  };
  const degenerateEntry = {
    id: "t1",
    type: "transform",
    sourceId: "s1",
    kind: "reflect",
    x1: -4,
    y1: -2,
    x2: -4,
    y2: -2,
  } as const;

  test("轴两端点重合：像无定义，返回 null 而非 NaN 几何", () => {
    expect(resolveTransformImage([source], degenerateEntry)).toBeNull();
  });

  test("源不存在照旧 null；非退化 reflect 照常出像", () => {
    expect(resolveTransformImage([], degenerateEntry)).toBeNull();
    const image = resolveTransformImage([source], {
      ...degenerateEntry,
      y2: 3,
    });
    // x = -4 竖直轴：圆心 (0,0) 的像是 (−8,0)，半径不变。
    expect(image).toMatchObject({ type: "circle", cx: -8, cy: 0, r: 2 });
  });
});
