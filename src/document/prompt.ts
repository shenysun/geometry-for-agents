import { formatFunctionExpression, functionCurveParamsOf } from "./function-curve.ts";
import type {
  FunctionCurvePrimitive,
  GeometryDocument,
  Primitive,
} from "./parse-document.ts";

const CONVENTIONS = [
  "Coordinate conventions:",
  "- Y is up in 2D and 3D.",
  "- Angles are in degrees; 0° is at +X, counterclockwise positive.",
  "- In 3D, Y is height and the ground is the XZ plane.",
  "- A voxel occupies the unit cube [x,x+1]×[y,y+1]×[z,z+1]; the integer (x,y,z) is the minimum corner.",
  "- Standing solids are anchored at the bottom-face center: y is the base height and the solid grows along +Y.",
  "- Solid rotations are euler degrees in fields rotationDegY, rotationDegX, rotationDegZ composed in Y→X→Z order; 0/0/0 = base facing down.",
].join("\n");

const SYNTAX = [
  "Primitive syntax (closed set):",
  "- line: 2+ {x,y} points",
  "- polygon: 3+ {x,y} points, fill none|solid|hatch",
  "- rectangle: x, y (center), width (X), height (Y), rotationDeg (optional, defaults to 0 = axis-aligned; counterclockwise), fill",
  "- triangle: x, y (base midpoint), width (base along X), height along +Y, apexOffset (apex X offset from the base midpoint; 0 = isosceles), rotationDeg (optional, defaults to 0; counterclockwise), fill",
  "- parallelogram: x, y (base midpoint), width (base along X), height along +Y, skew (top-base X shift, nonzero), rotationDeg (optional, defaults to 0; counterclockwise), fill",
  "- trapezoid: x, y (bottom-base midpoint), width (bottom base along X), topWidth (top base, differs from width), height along +Y, topOffset (top-base midpoint X offset; 0 = isosceles), rotationDeg (optional, defaults to 0; counterclockwise), fill",
  "- angle: x, y (vertex), startDeg, endDeg (side directions in degrees; 0° at +X, counterclockwise; sweep within (0°,360°)), length (both sides equal), showDeg (optional boolean, defaults to false; when true the derived degree measure is displayed beside the arc — the number is derived at render time, never stored)",
  "- regularPolygon: x, y (circumcenter), sides (integer ≥ 5), r (circumradius), rotationDeg (optional, defaults to 0 = flat-bottom: one edge parallel to X at the bottom), fill",
  "- dimension: exactly 2 {x,y} points (must not coincide); the displayed number is the derived distance between them (no text field, no unit)",
  "- circle: cx, cy, r, fill",
  "- sector: cx, cy, r, startDeg, endDeg, fill",
  "- bow: circular segment, cx, cy, r, startDeg, endDeg, fill",
  "- arc: cx, cy, r, startDeg, endDeg",
  "- ring: cx, cy, rInner < rOuter, fill",
  "- ellipse: cx, cy, rx, ry, rotationDeg (optional, defaults to 0 = axis-aligned; counterclockwise), fill",
  "- label: named point at x, y with text",
  "- functionCurve: analytic function graph in world coordinates (Y up, no axis primitive); kind linear {a, b} (y = ax + b), quadratic {a, b, c} (y = ax² + bx + c), or inverse {k} (y = k/x), with a and k nonzero; inverse breaks into two branches at x = 0 and never crosses the asymptote (no asymptote line is drawn); the parameters are the exact definition of the shape — the graph spans the whole visible x range at render time and no sampled points are stored",
  "- overlapFill: shades the intersection of the two closed primitives named in sources (by id); only the relation is stored, not geometry — the intersection may be empty after later edits",
  "- measure: reference-style measure label on the closed primitive named in sourceId (by id), kind area|perimeter; the displayed number is derived at render time and never stored — compute it yourself from the source geometry",
  "- voxel: 3D unit cube at integer min corner x, y, z",
  "- box: 3D cuboid anchored at the bottom-face center x, y, z; width (X), depth (Z), height (Y) along +Y; rotationDegY, rotationDegX, rotationDegZ",
  "- cylinder: 3D cylinder anchored at the bottom-face center x, y, z; r (radius), height along +Y; rotationDegY, rotationDegX, rotationDegZ",
  "- cone: 3D cone anchored at the bottom-face center x, y, z; r (base radius), height along +Y; rotationDegY, rotationDegX, rotationDegZ",
  "- sphere: 3D sphere centered at x, y, z with radius r (no rotation fields)",
  "- pyramid: 3D rectangular pyramid anchored at the bottom-face center x, y, z; width (X), depth (Z), height (Y) along +Y; rotationDegY, rotationDegX, rotationDegZ",
  "- triangularPrism: 3D prism anchored at the bottom-face center x, y, z; height along +Y; base = 3 local {x,z} points (default equilateral triangle of side 1, centroid at the local origin); rotationDegY, rotationDegX, rotationDegZ",
].join("\n");

function compareId(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortKeys(record[key])]),
    );
  }
  return value;
}

function sortedById<T extends { id: string }>(primitives: readonly T[]): T[] {
  return [...primitives].sort((left, right) => compareId(left.id, right.id));
}

function listedPrimitives(primitives: readonly Primitive[]): unknown[] {
  return sortedById(primitives).map((primitive) => sortKeys(primitive));
}

/** 函数曲线的一句解析式描述（ADR 0021）：Agent 拿精确函数语义而非
 *  视口相关采样点——解析式由 function-curve.ts 的格式化器产出，
 *  与属性面板单点同源。 */
function functionCurveSentences(primitives: readonly Primitive[]): string[] {
  return sortedById(
    primitives.filter(
      (primitive): primitive is FunctionCurvePrimitive =>
        primitive.type === "functionCurve",
    ),
  ).map(
    (curve) =>
      `- ${curve.id}: the graph of ${formatFunctionExpression(
        functionCurveParamsOf(curve),
      )}`,
  );
}

export function documentToPrompt(document: GeometryDocument): string {
  const listed = listedPrimitives(document.primitives);
  const curveSentences = functionCurveSentences(document.primitives);
  return [
    "Geometry document projection for an Agent. Reconstruct the figure from the primitives below. This text is a readable projection, not the source of truth.",
    "",
    CONVENTIONS,
    "",
    SYNTAX,
    "",
    `version: ${document.version}`,
    `space: ${document.space}`,
    `S = ${JSON.stringify(listed)}`,
    ...(curveSentences.length > 0
      ? [
          "",
          "Function curves (exact analytic meaning; reconstruct from the formula, never from sampled coordinates):",
          ...curveSentences,
        ]
      : []),
  ].join("\n");
}
