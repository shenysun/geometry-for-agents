import type { Point2, Primitive2d } from "../document/index.ts";

/**
 * 控制点的语义分类：目录顺序即命中优先级（重叠时先列出的先赢）。
 * 顶点只是折线/多边形的控制点，圆族露出圆心/半径/角度。
 */
export type ControlPointKind =
  | "vertex"
  | "center"
  | "radius"
  | "innerRadius"
  | "outerRadius"
  | "semiAxis"
  | "sweepAngle";

export type ControlPoint = {
  /** 语义标识，即说明书里的字段名（顶点带下标），拖动提交按它写几何。 */
  id: string;
  kind: ControlPointKind;
  /** 世界坐标。 */
  point: Point2;
};

const DEG = Math.PI / 180;

/** 圆周上某角度的点：0° 在 +X，逆时针为正（Y 向上）。 */
function pointOnCircle(
  center: Point2,
  r: number,
  deg: number,
): Point2 {
  return {
    x: center.x + r * Math.cos(deg * DEG),
    y: center.y + r * Math.sin(deg * DEG),
  };
}

/** 椭圆局部偏移按 rotationDeg 旋到世界（逆时针为正，与几何字段同一约定）。 */
function rotateOffset(
  offset: Point2,
  rotationDeg: number,
): Point2 {
  const rad = rotationDeg * DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: offset.x * cos - offset.y * sin,
    y: offset.x * sin + offset.y * cos,
  };
}

function vertexPoints(
  points: readonly Point2[],
): ControlPoint[] {
  return points.map((point, index) => ({
    id: `vertex-${index}`,
    kind: "vertex",
    point,
  }));
}

/**
 * 一条 2D 图元的控制点目录（世界坐标）。标签没有控制点，位置靠拖本体。
 */
export function controlPoints(primitive: Primitive2d): ControlPoint[] {
  switch (primitive.type) {
    case "line":
    case "polygon":
      return vertexPoints(primitive.points);
    case "circle": {
      const center = { x: primitive.cx, y: primitive.cy };
      return [
        { id: "center", kind: "center", point: center },
        {
          id: "radius",
          kind: "radius",
          point: pointOnCircle(center, primitive.r, 0),
        },
      ];
    }
    case "ring": {
      const center = { x: primitive.cx, y: primitive.cy };
      return [
        { id: "center", kind: "center", point: center },
        {
          id: "rInner",
          kind: "innerRadius",
          point: pointOnCircle(center, primitive.rInner, 0),
        },
        {
          id: "rOuter",
          kind: "outerRadius",
          point: pointOnCircle(center, primitive.rOuter, 0),
        },
      ];
    }
    case "ellipse": {
      const center = { x: primitive.cx, y: primitive.cy };
      const semi = (id: string, offset: Point2): ControlPoint => {
        const rotated = rotateOffset(offset, primitive.rotationDeg);
        return {
          id,
          kind: "semiAxis",
          point: { x: center.x + rotated.x, y: center.y + rotated.y },
        };
      };
      return [
        { id: "center", kind: "center", point: center },
        semi("rx", { x: primitive.rx, y: 0 }),
        semi("ry", { x: 0, y: primitive.ry }),
      ];
    }
    case "sector":
    case "bow":
    case "arc": {
      const center = { x: primitive.cx, y: primitive.cy };
      return [
        { id: "center", kind: "center", point: center },
        {
          id: "radius",
          kind: "radius",
          point: pointOnCircle(center, primitive.r, 0),
        },
        {
          id: "startDeg",
          kind: "sweepAngle",
          point: pointOnCircle(center, primitive.r, primitive.startDeg),
        },
        {
          id: "endDeg",
          kind: "sweepAngle",
          point: pointOnCircle(center, primitive.r, primitive.endDeg),
        },
      ];
    }
    case "label":
      return [];
  }
}
