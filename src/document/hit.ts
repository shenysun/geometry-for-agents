import type {
  GeometryDocument,
  Primitive,
  Primitive2d,
  Primitive3d,
} from "./parse-document.ts";
import { baseHeightWorldVertices } from "./base-height-family.ts";
import {
  angleArcRadius,
  angleEndPoint,
  angleStartPoint,
} from "./angle.ts";
import { regularPolygonWorldVertices } from "./regular-polygon.ts";
import type { Point2 } from "./snap.ts";

const DEG = Math.PI / 180;

export type HitPoint = Point2 & { z?: number };

type CircleLike = { cx: number; cy: number; r: number };
type SweepLike = CircleLike & { startDeg: number; endDeg: number };

function hypot2(dx: number, dy: number): number {
  return dx * dx + dy * dy;
}

function normalizeDeg(deg: number): number {
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function sweepDeg(startDeg: number, endDeg: number): number {
  if (startDeg === endDeg) return 0;
  const raw = (endDeg - startDeg) % 360;
  const sweep = raw < 0 ? raw + 360 : raw;
  return sweep === 0 ? 360 : sweep;
}

function angleDeg(dx: number, dy: number): number {
  return normalizeDeg(Math.atan2(dy, dx) / DEG);
}

function inSweep(deg: number, startDeg: number, endDeg: number): boolean {
  const sweep = sweepDeg(startDeg, endDeg);
  if (sweep === 0) return false;
  if (sweep >= 360) return true;
  const angle = normalizeDeg(deg);
  const start = normalizeDeg(startDeg);
  const end = normalizeDeg(endDeg);
  if (start <= end) return angle >= start && angle <= end;
  return angle >= start || angle <= end;
}

function polar(cx: number, cy: number, r: number, deg: number): Point2 {
  const rad = deg * DEG;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function sameSide(point: Point2, other: Point2, a: Point2, b: Point2): boolean {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const crossPoint = abx * (point.y - a.y) - aby * (point.x - a.x);
  const crossOther = abx * (other.y - a.y) - aby * (other.x - a.x);
  return crossPoint * crossOther >= 0;
}

function inDisk(point: Point2, circle: CircleLike): boolean {
  return hypot2(point.x - circle.cx, point.y - circle.cy) <= circle.r * circle.r;
}

function onSegment(point: Point2, a: Point2, b: Point2): boolean {
  return distanceToSegment(point, a, b) === 0;
}

function nearPolyline(
  point: Point2,
  points: Point2[],
  tolerance: number,
): boolean {
  return points.some((a, i) => {
    const b = points[i + 1];
    return b !== undefined && distanceToSegment(point, a, b) <= tolerance;
  });
}

function nearArc(point: Point2, arc: SweepLike, tolerance: number): boolean {
  const dist = Math.hypot(point.x - arc.cx, point.y - arc.cy);
  if (Math.abs(dist - arc.r) > tolerance) return false;
  return inSweep(
    angleDeg(point.x - arc.cx, point.y - arc.cy),
    arc.startDeg,
    arc.endDeg,
  );
}

function inEllipse(
  point: Point2,
  ellipse: { cx: number; cy: number; rx: number; ry: number },
): boolean {
  const nx = (point.x - ellipse.cx) / ellipse.rx;
  const ny = (point.y - ellipse.cy) / ellipse.ry;
  return nx * nx + ny * ny <= 1;
}

/** 旋转矩形命中：把点绕中心反旋转 rotationDeg 到局部系，再按半宽半高判定。 */
function inRectangle(
  point: Point2,
  rectangle: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotationDeg: number;
  },
): boolean {
  const rad = -rectangle.rotationDeg * DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - rectangle.x;
  const dy = point.y - rectangle.y;
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  return (
    Math.abs(localX) <= rectangle.width / 2 &&
    Math.abs(localY) <= rectangle.height / 2
  );
}

function inRing(
  point: Point2,
  ring: { cx: number; cy: number; rInner: number; rOuter: number },
): boolean {
  const distSq = hypot2(point.x - ring.cx, point.y - ring.cy);
  return distSq >= ring.rInner * ring.rInner && distSq <= ring.rOuter * ring.rOuter;
}

function inVoxel(
  point: HitPoint,
  voxel: { x: number; y: number; z: number },
): boolean {
  if (point.z === undefined) return false;
  return (
    point.x >= voxel.x &&
    point.x <= voxel.x + 1 &&
    point.y >= voxel.y &&
    point.y <= voxel.y + 1 &&
    point.z >= voxel.z &&
    point.z <= voxel.z + 1
  );
}

function distanceToSegment(point: Point2, a: Point2, b: Point2): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lengthSq = hypot2(vx, vy);
  if (lengthSq === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.min(
    1,
    Math.max(0, ((point.x - a.x) * vx + (point.y - a.y) * vy) / lengthSq),
  );
  return Math.hypot(point.x - (a.x + t * vx), point.y - (a.y + t * vy));
}

function closedEdges(points: Point2[]): [Point2, Point2][] {
  return points.flatMap((a, i) => {
    const b = points[(i + 1) % points.length];
    return b === undefined ? [] : [[a, b]];
  });
}

function pointInPolygon(point: Point2, points: Point2[]): boolean {
  const edges = closedEdges(points);
  if (edges.some(([a, b]) => onSegment(point, a, b))) return true;

  let inside = false;
  for (const [pi, pj] of edges) {
    const intersects =
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function polygonArea(points: Point2[]): number {
  const sum = closedEdges(points).reduce(
    (total, [a, b]) => total + a.x * b.y - b.x * a.y,
    0,
  );
  return Math.abs(sum) / 2;
}

function inBow(point: Point2, bow: SweepLike): boolean {
  if (!inDisk(point, bow)) return false;
  const sweep = sweepDeg(bow.startDeg, bow.endDeg);
  if (sweep === 0) return false;
  if (sweep >= 360) return true;
  const start = polar(bow.cx, bow.cy, bow.r, bow.startDeg);
  const end = polar(bow.cx, bow.cy, bow.r, bow.endDeg);
  const mid = polar(bow.cx, bow.cy, bow.r, bow.startDeg + sweep / 2);
  return sameSide(point, mid, start, end);
}

function inSector(point: Point2, sector: SweepLike): boolean {
  if (!inDisk(point, sector)) return false;
  const dx = point.x - sector.cx;
  const dy = point.y - sector.cy;
  if (dx === 0 && dy === 0) return true;
  return inSweep(angleDeg(dx, dy), sector.startDeg, sector.endDeg);
}

function contains(
  primitive: Primitive2d,
  point: HitPoint,
  tolerance: number,
): boolean {
  switch (primitive.type) {
    case "overlapFill":
      // 引用条目自身无几何：区域命中（点在两源交集内）由 hitTest 顶层特判。
      return false;
    case "circle":
      return inDisk(point, primitive);
    case "ellipse":
      return inEllipse(point, primitive);
    case "rectangle":
      return inRectangle(point, primitive);
    case "triangle":
    case "parallelogram":
    case "trapezoid":
    case "regularPolygon":
      // 顶点已随 rotationDeg 旋到世界：点在多边形判定与坐标系无关。
      return pointInPolygon(
        point,
        primitive.type === "regularPolygon"
          ? regularPolygonWorldVertices(primitive)
          : baseHeightWorldVertices(primitive),
      );
    case "ring":
      return inRing(point, primitive);
    case "polygon":
      return pointInPolygon(point, primitive.points);
    case "sector":
      return inSector(point, primitive);
    case "bow":
      return inBow(point, primitive);
    case "line":
    case "dimension":
      return nearPolyline(point, primitive.points, tolerance);
    case "arc":
      return nearArc(point, primitive, tolerance);
    case "angle": {
      // 笔画族：两条边（共享顶点的折线）+ 弧标，容差内即命中。
      const vertex = { x: primitive.x, y: primitive.y };
      const sides = [
        angleStartPoint(primitive),
        vertex,
        angleEndPoint(primitive),
      ];
      if (nearPolyline(point, sides, tolerance)) return true;
      return nearArc(
        point,
        {
          cx: primitive.x,
          cy: primitive.y,
          r: angleArcRadius(primitive),
          startDeg: primitive.startDeg,
          endDeg: primitive.endDeg,
        },
        tolerance,
      );
    }
    case "label":
      return Math.hypot(point.x - primitive.x, point.y - primitive.y) <= tolerance;
  }
}

const closedTypes = new Set<Primitive2d["type"]>([
  "polygon",
  "rectangle",
  "triangle",
  "parallelogram",
  "trapezoid",
  "regularPolygon",
  "circle",
  "sector",
  "bow",
  "ring",
  "ellipse",
]);

function isClosed(primitive: Primitive2d): boolean {
  return closedTypes.has(primitive.type);
}

function area(primitive: Primitive2d): number {
  switch (primitive.type) {
    case "circle":
      return Math.PI * primitive.r * primitive.r;
    case "ellipse":
      return Math.PI * primitive.rx * primitive.ry;
    case "rectangle":
      return primitive.width * primitive.height;
    case "triangle":
      return (primitive.width * primitive.height) / 2;
    case "parallelogram":
      return primitive.width * primitive.height;
    case "trapezoid":
      return ((primitive.width + primitive.topWidth) / 2) * primitive.height;
    case "regularPolygon":
      return (
        (primitive.sides / 2) *
        primitive.r *
        primitive.r *
        Math.sin((2 * Math.PI) / primitive.sides)
      );
    case "ring":
      return Math.PI * (primitive.rOuter ** 2 - primitive.rInner ** 2);
    case "polygon":
      return polygonArea(primitive.points);
    case "sector":
      return (sweepDeg(primitive.startDeg, primitive.endDeg) / 360) *
        Math.PI *
        primitive.r *
        primitive.r;
    case "bow": {
      const theta = sweepDeg(primitive.startDeg, primitive.endDeg) * DEG;
      return 0.5 * primitive.r * primitive.r * (theta - Math.sin(theta));
    }
    case "line":
    case "arc":
    case "angle":
    case "dimension":
    case "label":
    case "overlapFill":
      return Number.POSITIVE_INFINITY;
  }
}

/**
 * 3D 说明书里只有体素做点命中（box 等参数体的拾取走 3D 视口的射线）。
 * 体素体积恒为 1，并列命中取列表靠后者，与 2D 面积比小的并列规则一致。
 */
function hitVoxels(
  primitives: Primitive3d[],
  point: HitPoint,
): Primitive3d | null {
  const hits = primitives.filter(
    (primitive) => primitive.type === "voxel" && inVoxel(point, primitive),
  );
  if (hits.length === 0) return null;
  return hits.reduce((_, candidate) => candidate);
}

/** 世界单位的命中容差：细线/弧/标签在容差内即视为命中；缺省 0 为精确命中。 */
export function hitTest(
  document: GeometryDocument,
  point: HitPoint,
  tolerance = 0,
): Primitive | null {
  if (document.space === "3d") {
    return hitVoxels(document.primitives, point);
  }

  // 几何命中沿用现行规则：封闭面优先于笔画，并列取面积小者。
  // overlapFill 自身 contains 恒 false，不进几何通道。
  const hits = document.primitives.filter((primitive) =>
    contains(primitive, point, tolerance),
  );
  const geometricWinner =
    hits.length === 0
      ? null
      : hits.reduce((best, candidate) => {
          if (isClosed(candidate) !== isClosed(best)) {
            return isClosed(candidate) ? candidate : best;
          }
          return area(candidate) <= area(best) ? candidate : best;
        });

  // 重叠填充（ADR 0019）：点在两源交集内即命中条目本身，并列取列表靠后者。
  // 让位规则是「面积小者优先」的延伸：几何胜者是面积严格小于两源的嵌套小面
  // （交集里可见的更小目标）时它赢，否则引用条目赢——源自身不劫走自己的条目。
  for (let i = document.primitives.length - 1; i >= 0; i--) {
    const entry = document.primitives[i];
    if (entry === undefined || entry.type !== "overlapFill") continue;
    const [a, b] = entry.sources.map((id) =>
      document.primitives.find((primitive) => primitive.id === id),
    );
    if (
      a === undefined ||
      b === undefined ||
      !contains(a, point, tolerance) ||
      !contains(b, point, tolerance)
    ) {
      continue;
    }
    if (
      geometricWinner !== null &&
      isClosed(geometricWinner) &&
      area(geometricWinner) < Math.min(area(a), area(b))
    ) {
      break;
    }
    return entry;
  }

  return geometricWinner;
}

/**
 * 同点循环候选：视口里同一位置连点时逐个换选的排名列表（ADR 0019 后续——
 * 交集内点击永远命中引用条目，另一个源原本无法通过视口选中）。
 * 首位恒等于 hitTest 胜者（首击行为不变），其余依次为：引用条目（目录倒序）→
 * 封闭命中（面积升序，延续「小者优先」）→ 笔画命中（目录序）。
 */
export function hitCandidates(
  document: GeometryDocument,
  point: HitPoint,
  tolerance = 0,
): Primitive[] {
  if (document.space === "3d") {
    const voxel = hitVoxels(document.primitives, point);
    return voxel === null ? [] : [voxel];
  }
  const winner = hitTest(document, point, tolerance);
  const rest: Primitive2d[] = [];
  for (let i = document.primitives.length - 1; i >= 0; i--) {
    const entry = document.primitives[i];
    if (entry?.type !== "overlapFill") continue;
    const [a, b] = entry.sources.map((id) =>
      document.primitives.find((primitive) => primitive.id === id),
    );
    if (
      a !== undefined &&
      b !== undefined &&
      contains(a, point, tolerance) &&
      contains(b, point, tolerance)
    ) {
      rest.push(entry);
    }
  }
  const hits = document.primitives.filter((primitive) =>
    contains(primitive, point, tolerance),
  );
  const closed = hits.filter(isClosed).sort((x, y) => area(x) - area(y));
  const strokes = hits.filter((primitive) => !isClosed(primitive));
  const ranked = [...rest, ...closed, ...strokes].filter(
    (primitive) => primitive !== winner,
  );
  return winner === null ? ranked : [winner, ...ranked];
}
