import type { Point2, Primitive2d } from "../document/index.ts";
import { baseHeightWorldVertices } from "../document/base-height-family.ts";
import { regularPolygonWorldVertices } from "../document/regular-polygon.ts";
import {
  angleEndPoint,
  angleStartPoint,
} from "../document/angle.ts";

/**
 * 控制点的语义分类：目录顺序即命中优先级（重叠时先列出的先赢）。
 * 顶点只是折线/多边形的控制点，圆族露出圆心/半径/角度，矩形露出四角。
 */
export type ControlPointKind =
  | "vertex"
  | "corner"
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
    case "overlapFill":
    case "measure":
      // 引用条目没有可拖的几何锚点。
      return [];
    case "line":
    case "polygon":
    case "dimension":
      return vertexPoints(primitive.points);
    case "rectangle": {
      // 四角按局部逆时针排列，随 rotationDeg 旋到世界；拖角改宽高（中心不动），
      // 平移走拖本体，故中心不进目录。
      const center = { x: primitive.x, y: primitive.y };
      const offsets: Point2[] = [
        { x: primitive.width / 2, y: primitive.height / 2 },
        { x: -primitive.width / 2, y: primitive.height / 2 },
        { x: -primitive.width / 2, y: -primitive.height / 2 },
        { x: primitive.width / 2, y: -primitive.height / 2 },
      ];
      return offsets.map((offset, index) => {
        const rotated = rotateOffset(offset, primitive.rotationDeg);
        return {
          id: `corner-${index}`,
          kind: "corner" as const,
          point: { x: center.x + rotated.x, y: center.y + rotated.y },
        };
      });
    }
    case "triangle":
    case "parallelogram":
    case "trapezoid": {
      // 顶点目录与世界顶点同源（三角 3 个、平四/梯 4 个）；底边中点锚点
      // 不进目录，平移走拖本体。
      return baseHeightWorldVertices(primitive).map((point, index) => ({
        id: `corner-${index}`,
        kind: "corner" as const,
        point,
      }));
    }
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
    case "angle": {
      // 顶点 + 两边端点；拖端点改方向角与公共边长（见 update-document）。
      const vertex = { x: primitive.x, y: primitive.y };
      return [
        { id: "apex", kind: "vertex" as const, point: vertex },
        {
          id: "startDeg",
          kind: "sweepAngle" as const,
          point: angleStartPoint(primitive),
        },
        {
          id: "endDeg",
          kind: "sweepAngle" as const,
          point: angleEndPoint(primitive),
        },
      ];
    }
    case "regularPolygon": {
      // n 个顶点与世界顶点同源；拖顶点改外接圆半径。中心（外接圆心）
      // 不进目录，平移走拖本体。
      return regularPolygonWorldVertices(primitive).map((point, index) => ({
        id: `vertex-${index}`,
        kind: "vertex" as const,
        point,
      }));
    }
    case "label":
      return [];
  }
}
