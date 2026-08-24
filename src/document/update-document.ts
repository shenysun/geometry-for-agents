import { parseDocument } from "./parse-document.ts";
import type { GeometryDocument, Primitive } from "./parse-document.ts";
import { snap2d, type GridSnap, type Point2 } from "./snap.ts";

export type DocumentUpdateResult =
  | { success: true; document: GeometryDocument }
  | { success: false; error: string };

function replaceDocument(
  document: GeometryDocument,
  patch: {
    underlay: GeometryDocument["underlay"];
    primitives: Primitive[];
  },
): DocumentUpdateResult {
  return parseDocument(
    structuredClone({
      version: document.version,
      space: document.space,
      underlay: patch.underlay,
      primitives: patch.primitives,
    }),
  );
}

function replacePrimitives(
  document: GeometryDocument,
  primitives: Primitive[],
): DocumentUpdateResult {
  return replaceDocument(document, {
    underlay: document.underlay,
    primitives,
  });
}

export function setUnderlay(
  document: GeometryDocument,
  underlay: GeometryDocument["underlay"],
): DocumentUpdateResult {
  return replaceDocument(document, {
    underlay,
    primitives: document.primitives,
  });
}

function missingId(id: string): DocumentUpdateResult {
  return { success: false, error: `primitive id "${id}" not found` };
}

export function addPrimitive(
  document: GeometryDocument,
  primitive: Primitive,
): DocumentUpdateResult {
  return replacePrimitives(document, [...document.primitives, primitive]);
}

export function removePrimitive(
  document: GeometryDocument,
  id: string,
): DocumentUpdateResult {
  if (!document.primitives.some((primitive) => primitive.id === id)) {
    return missingId(id);
  }
  return replacePrimitives(
    document,
    document.primitives.filter((primitive) => primitive.id !== id),
  );
}

export function updatePrimitive(
  document: GeometryDocument,
  id: string,
  primitive: Primitive,
): DocumentUpdateResult {
  if (!document.primitives.some((current) => current.id === id)) {
    return missingId(id);
  }
  return replacePrimitives(
    document,
    document.primitives.map((current) =>
      current.id === id ? { ...primitive, id } : current,
    ),
  );
}

type TwoDType =
  | "line"
  | "polygon"
  | "circle"
  | "sector"
  | "bow"
  | "arc"
  | "ring"
  | "ellipse"
  | "label";

export type TwoDPrimitive = Extract<Primitive, { type: TwoDType }>;

/** 把已吸附的位移写进图元的几何字段（points / cx cy / x y），不可变。 */
export function translatePrimitiveGeometry(
  primitive: TwoDPrimitive,
  dx: number,
  dy: number,
): TwoDPrimitive {
  switch (primitive.type) {
    case "line":
    case "polygon":
      return {
        ...primitive,
        points: primitive.points.map((point) => ({
          x: point.x + dx,
          y: point.y + dy,
        })),
      };
    case "label":
      return { ...primitive, x: primitive.x + dx, y: primitive.y + dy };
    case "circle":
    case "sector":
    case "bow":
    case "arc":
    case "ring":
    case "ellipse":
      return { ...primitive, cx: primitive.cx + dx, cy: primitive.cy + dy };
  }
}

/** 平移一条 2D 图元：先把世界位移吸附到格，再写入几何字段，返回新说明书。 */
export function translatePrimitive(
  document: GeometryDocument,
  id: string,
  dx: number,
  dy: number,
  grid: GridSnap,
): DocumentUpdateResult {
  if (document.space !== "2d") {
    return {
      success: false,
      error: "translate is only defined for 2D primitives",
    };
  }
  const current = document.primitives.find((primitive) => primitive.id === id);
  if (current === undefined) {
    return missingId(id);
  }
  const delta = snap2d({ x: dx, y: dy }, grid);
  if (delta.x === 0 && delta.y === 0) {
    return { success: true, document };
  }
  return replacePrimitives(
    document,
    document.primitives.map((primitive) =>
      primitive.id === id
        ? translatePrimitiveGeometry(primitive, delta.x, delta.y)
        : primitive,
    ),
  );
}

/** 顶点质心：折线/多边形的旋转缩放锚点。 */
function centroid(points: readonly Point2[]): Point2 {
  const sum = points.reduce(
    (total, point) => ({ x: total.x + point.x, y: total.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/** 图元自身锚点：折线/多边形取顶点质心，圆族取圆心，标签取其位置。 */
export function primitiveAnchor(primitive: TwoDPrimitive): Point2 {
  switch (primitive.type) {
    case "line":
    case "polygon":
      return centroid(primitive.points);
    case "label":
      return { x: primitive.x, y: primitive.y };
    default:
      return { x: primitive.cx, y: primitive.cy };
  }
}

const DEG = Math.PI / 180;

/** 把任意度数折进 [0,360)，避免反复旋转把角度滚出可读区间。 */
function normalizeDeg(deg: number): number {
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** 点绕锚点旋转 deg 度（逆时针为正，Y 向上）。 */
function rotatePoint(
  point: { x: number; y: number },
  center: { x: number; y: number },
  deg: number,
): { x: number; y: number } {
  const rad = deg * DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

/** 点朝锚点按 factor 缩放。 */
function scalePoint(
  point: { x: number; y: number },
  center: { x: number; y: number },
  factor: number,
): { x: number; y: number } {
  return {
    x: center.x + (point.x - center.x) * factor,
    y: center.y + (point.y - center.y) * factor,
  };
}

/**
 * 绕图元自身锚点旋转，直接写几何字段：折线/多边形转顶点，椭圆转
 * rotationDeg，扇/弓/弧转 startDeg/endDeg；圆、环、标签旋转对称，恒等。
 */
export function rotatePrimitiveGeometry(
  primitive: TwoDPrimitive,
  deg: number,
): TwoDPrimitive {
  switch (primitive.type) {
    case "line":
    case "polygon": {
      const center = primitiveAnchor(primitive);
      return {
        ...primitive,
        points: primitive.points.map((point) =>
          rotatePoint(point, center, deg),
        ),
      };
    }
    case "ellipse":
      return {
        ...primitive,
        rotationDeg: normalizeDeg(primitive.rotationDeg + deg),
      };
    case "sector":
    case "bow":
    case "arc":
      return {
        ...primitive,
        startDeg: normalizeDeg(primitive.startDeg + deg),
        endDeg: normalizeDeg(primitive.endDeg + deg),
      };
    case "circle":
    case "ring":
    case "label":
      return primitive;
  }
}

/**
 * 以图元自身锚点为不动点等比缩放：半径类字段乘因子，顶点朝锚点收放。
 * 圆只有一个半径字段，天然保持圆形。
 */
export function scalePrimitiveGeometry(
  primitive: TwoDPrimitive,
  factor: number,
): TwoDPrimitive {
  switch (primitive.type) {
    case "line":
    case "polygon": {
      const center = primitiveAnchor(primitive);
      return {
        ...primitive,
        points: primitive.points.map((point) =>
          scalePoint(point, center, factor),
        ),
      };
    }
    case "circle":
    case "sector":
    case "bow":
    case "arc":
      return { ...primitive, r: primitive.r * factor };
    case "ring":
      return {
        ...primitive,
        rInner: primitive.rInner * factor,
        rOuter: primitive.rOuter * factor,
      };
    case "ellipse":
      return {
        ...primitive,
        rx: primitive.rx * factor,
        ry: primitive.ry * factor,
      };
    case "label":
      return primitive;
  }
}

/** 图元几何是否一致（恒等变换检测，避免写入无变化快照）。 */
function samePrimitive(left: Primitive, right: Primitive): boolean {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}

function transformPrimitive(
  document: GeometryDocument,
  id: string,
  verb: string,
  apply: (primitive: TwoDPrimitive) => TwoDPrimitive,
): DocumentUpdateResult {
  if (document.space !== "2d") {
    return {
      success: false,
      error: `${verb} is only defined for 2D primitives`,
    };
  }
  const current = document.primitives.find((primitive) => primitive.id === id);
  if (current === undefined) {
    return missingId(id);
  }
  const transformed = apply(current);
  if (samePrimitive(current, transformed)) {
    return { success: true, document };
  }
  return replacePrimitives(
    document,
    document.primitives.map((primitive) =>
      primitive.id === id ? transformed : primitive,
    ),
  );
}

/** 旋转一条 2D 图元：角度直接写进几何字段，不引入矩阵。 */
export function rotatePrimitive(
  document: GeometryDocument,
  id: string,
  deg: number,
): DocumentUpdateResult {
  return transformPrimitive(document, id, "rotate", (primitive) =>
    rotatePrimitiveGeometry(primitive, deg),
  );
}

/** 缩放一条 2D 图元：正因子等比缩放，圆保持圆形。 */
export function scalePrimitive(
  document: GeometryDocument,
  id: string,
  factor: number,
): DocumentUpdateResult {
  if (factor <= 0) {
    return { success: false, error: "scale factor must be positive" };
  }
  return transformPrimitive(document, id, "scale", (primitive) =>
    scalePrimitiveGeometry(primitive, factor),
  );
}

/** 指针相对圆心的方位角（度，逆时针为正）。 */
function pointDegFrom(center: Point2, world: Point2): number {
  return (Math.atan2(world.y - center.y, world.x - center.x) * 180) / Math.PI;
}

function distanceBetween(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 世界点转进椭圆局部系（逆旋转 rotationDeg）后的轴上偏移。 */
function ellipseLocalOffset(
  primitive: Extract<TwoDPrimitive, { type: "ellipse" }>,
  world: Point2,
): Point2 {
  const center = { x: primitive.cx, y: primitive.cy };
  const local = rotatePoint(world, center, -primitive.rotationDeg);
  return { x: local.x - center.x, y: local.y - center.y };
}

const VERTEX_ID = /^vertex-(\d+)$/;

/**
 * 拖控制点只改那一处几何（已吸附的世界坐标），不可变：端点/顶点只动
 * 那个下标，半径点只改半径，起止角点只改角度，半轴点沿局部轴度量。
 * pointId 与控制点目录同源（即字段名），未知 id 是恒等。
 */
export function moveControlPointGeometry(
  primitive: TwoDPrimitive,
  pointId: string,
  world: Point2,
): TwoDPrimitive {
  switch (primitive.type) {
    case "line":
    case "polygon": {
      const match = VERTEX_ID.exec(pointId);
      if (match === null) return primitive;
      const index = Number(match[1]);
      if (index >= primitive.points.length) return primitive;
      return {
        ...primitive,
        points: primitive.points.map((point, at) =>
          at === index ? world : point,
        ),
      };
    }
    case "label":
      return primitive;
    case "circle": {
      if (pointId === "center") {
        return { ...primitive, cx: world.x, cy: world.y };
      }
      if (pointId === "radius") {
        return {
          ...primitive,
          r: distanceBetween({ x: primitive.cx, y: primitive.cy }, world),
        };
      }
      return primitive;
    }
    case "sector":
    case "bow":
    case "arc": {
      const center = { x: primitive.cx, y: primitive.cy };
      if (pointId === "center") {
        return { ...primitive, cx: world.x, cy: world.y };
      }
      if (pointId === "radius") {
        return { ...primitive, r: distanceBetween(center, world) };
      }
      const deg = normalizeDeg(pointDegFrom(center, world));
      if (pointId === "startDeg") return { ...primitive, startDeg: deg };
      if (pointId === "endDeg") return { ...primitive, endDeg: deg };
      return primitive;
    }
    case "ring": {
      const center = { x: primitive.cx, y: primitive.cy };
      if (pointId === "center") {
        return { ...primitive, cx: world.x, cy: world.y };
      }
      const radius = distanceBetween(center, world);
      if (pointId === "rInner") return { ...primitive, rInner: radius };
      if (pointId === "rOuter") return { ...primitive, rOuter: radius };
      return primitive;
    }
    case "ellipse": {
      if (pointId === "center") {
        return { ...primitive, cx: world.x, cy: world.y };
      }
      if (pointId === "rx") {
        return {
          ...primitive,
          rx: Math.abs(ellipseLocalOffset(primitive, world).x),
        };
      }
      if (pointId === "ry") {
        return {
          ...primitive,
          ry: Math.abs(ellipseLocalOffset(primitive, world).y),
        };
      }
      return primitive;
    }
  }
}

/** 拖控制点提交：目标点先吸附到格，再只写那一处几何，非法几何被契约拒绝。 */
export function moveControlPoint(
  document: GeometryDocument,
  id: string,
  pointId: string,
  world: Point2,
  grid: GridSnap,
): DocumentUpdateResult {
  return transformPrimitive(document, id, "moveControlPoint", (primitive) =>
    moveControlPointGeometry(primitive, pointId, snap2d(world, grid)),
  );
}
