import {
  snap2d,
  type GridSnap,
  type Point2,
  type Primitive2d,
} from "../document/index.ts";

export const DRAW_TOOLS = [
  "line",
  "polygon",
  "rectangle",
  "square",
  "triangle",
  "parallelogram",
  "trapezoid",
  "regularPolygon",
  "angle",
  "dimension",
  "circle",
  "sector",
  "bow",
  "arc",
  "ring",
  "ellipse",
  "label",
] as const;

export type DrawTool = (typeof DRAW_TOOLS)[number];

/** 底/高家族与正方形共用 box 手势：对角拖出包围盒，工具决定产出类型。 */
type BoxTool = "square" | "triangle" | "parallelogram" | "trapezoid";

function isBoxTool(tool: DrawTool): tool is BoxTool {
  return (
    tool === "square" ||
    tool === "triangle" ||
    tool === "parallelogram" ||
    tool === "trapezoid"
  );
}

const DRAG_TOOLS: ReadonlySet<DrawTool> = new Set([
  "line",
  "rectangle",
  "square",
  "triangle",
  "parallelogram",
  "trapezoid",
  "regularPolygon",
  "dimension",
  "circle",
  "ellipse",
  "ring",
]);

export function isDrawTool(tool: string | null | undefined): tool is DrawTool {
  return DRAW_TOOLS.some((item) => item === tool);
}

export function isDragDrawTool(tool: DrawTool): boolean {
  return DRAG_TOOLS.has(tool);
}

export type DrawContext = {
  tool: DrawTool;
  point: Point2;
  grid: GridSnap;
  id: string;
  labelTexts?: readonly string[];
};

export type DrawPreview =
  | { type: "line"; points: Point2[] }
  | { type: "dimension"; points: Point2[] }
  | { type: "polygon"; points: Point2[] }
  | {
      type: "rectangle";
      x: number;
      y: number;
      width: number;
      height: number;
      rotationDeg: number;
    }
  | {
      type: "triangle";
      x: number;
      y: number;
      width: number;
      height: number;
      apexOffset: number;
      rotationDeg: number;
    }
  | {
      type: "parallelogram";
      x: number;
      y: number;
      width: number;
      height: number;
      skew: number;
      rotationDeg: number;
    }
  | {
      type: "trapezoid";
      x: number;
      y: number;
      width: number;
      topWidth: number;
      height: number;
      topOffset: number;
      rotationDeg: number;
    }
  | {
      type: "angle";
      x: number;
      y: number;
      startDeg: number;
      endDeg: number;
      length: number;
    }
  | {
      type: "regularPolygon";
      x: number;
      y: number;
      sides: number;
      r: number;
      rotationDeg: number;
    }
  | { type: "circle"; cx: number; cy: number; r: number }
  | {
      type: "ellipse";
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      rotationDeg: number;
    }
  | { type: "ring"; cx: number; cy: number; rInner: number; rOuter: number }
  | {
      type: "arc";
      cx: number;
      cy: number;
      r: number;
      startDeg: number;
      endDeg: number;
    }
  | {
      type: "sector";
      cx: number;
      cy: number;
      r: number;
      startDeg: number;
      endDeg: number;
    }
  | {
      type: "bow";
      cx: number;
      cy: number;
      r: number;
      startDeg: number;
      endDeg: number;
    }
  | { type: "label"; x: number; y: number; text: string }
  | { type: "guide"; points: Point2[] }
  | null;

export type DrawGestureState =
  | { kind: "idle" }
  | { kind: "line"; start: Point2; cursor: Point2 }
  | { kind: "polygon"; vertices: Point2[]; cursor: Point2 }
  | { kind: "rectangle"; start: Point2; cursor: Point2 }
  | { kind: "box"; tool: BoxTool; start: Point2; cursor: Point2 }
  | { kind: "regularPolygon"; center: Point2; cursor: Point2 }
  | { kind: "circle"; center: Point2; cursor: Point2 }
  | { kind: "ellipse"; start: Point2; cursor: Point2 }
  | { kind: "ring"; center: Point2; rOuter: number | null; cursor: Point2 }
  | {
      kind: "sweep";
      tool: "sector" | "bow" | "arc" | "angle";
      center: Point2;
      start: Point2 | null;
      cursor: Point2;
    };

export type DrawGestureResult = {
  state: DrawGestureState;
  preview: DrawPreview;
  commit: Primitive2d | null;
};

function samePoint(a: Point2, b: Point2): boolean {
  return a.x === b.x && a.y === b.y;
}

function distinctVertexCount(points: Point2[]): number {
  return points.filter(
    (point, index) =>
      points.findIndex((other) => samePoint(other, point)) === index,
  ).length;
}

function distance(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleDeg(center: Point2, point: Point2): number {
  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
}

function ellipseFromBox(
  a: Point2,
  b: Point2,
): { cx: number; cy: number; rx: number; ry: number } {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    rx: (maxX - minX) / 2,
    ry: (maxY - minY) / 2,
  };
}

/** 拖对角线画矩形：起止点为对角，中心取中点，宽高为对角在两轴上的投影。 */
function rectangleFromDiagonal(
  a: Point2,
  b: Point2,
): { x: number; y: number; width: number; height: number } {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/** 拖对角线画正方形：取主轴分量为边长，起点为一角，方向沿拖拽象限。 */
function squareFromDiagonal(
  a: Point2,
  b: Point2,
): { x: number; y: number; width: number; height: number } {
  const side = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  const dirX = b.x >= a.x ? 1 : -1;
  const dirY = b.y >= a.y ? 1 : -1;
  return rectangleFromDiagonal(a, {
    x: a.x + dirX * side,
    y: a.y + dirY * side,
  });
}

/** 底/高家族几何的判别形状：预览与提交共用。 */
type FamilyGeometry =
  | {
      type: "triangle";
      x: number;
      y: number;
      width: number;
      height: number;
      apexOffset: number;
    }
  | {
      type: "parallelogram";
      x: number;
      y: number;
      width: number;
      height: number;
      skew: number;
    }
  | {
      type: "trapezoid";
      x: number;
      y: number;
      width: number;
      topWidth: number;
      height: number;
      topOffset: number;
    };

/** 拖 box 的底/高家族几何：底边取包围盒下边（Y 向上），等腰缺省。 */
function familyFromBox(
  tool: Exclude<BoxTool, "square">,
  a: Point2,
  b: Point2,
): FamilyGeometry {
  const width = Math.abs(b.x - a.x);
  const height = Math.abs(b.y - a.y);
  const base = {
    x: (a.x + b.x) / 2,
    y: Math.min(a.y, b.y),
    width,
    height,
  };
  if (tool === "triangle") {
    return { type: tool, ...base, apexOffset: 0 };
  }
  if (tool === "parallelogram") {
    // 斜移取高：拖出的斜边恒为 45°，提交值天然非零。
    return { type: tool, ...base, skew: height };
  }
  // 梯形上底取下底一半、等腰：topWidth = width/2 ≠ width（width > 0 时）。
  return { type: tool, ...base, topWidth: width / 2, topOffset: 0 };
}

/** box 手势的预览与提交几何：正方形复用 rectangle（已钳等宽高）。 */
function boxGeometry(
  tool: BoxTool,
  a: Point2,
  b: Point2,
): { type: "rectangle"; x: number; y: number; width: number; height: number } | FamilyGeometry {
  if (tool === "square") {
    return { type: "rectangle", ...squareFromDiagonal(a, b) };
  }
  return familyFromBox(tool, a, b);
}

function columnName(index: number): string {
  let n = index + 1;
  let text = "";
  while (n > 0) {
    n -= 1;
    text = String.fromCharCode(65 + (n % 26)) + text;
    n = Math.floor(n / 26);
  }
  return text;
}

export function nextLabelText(existing: readonly string[]): string {
  const used = new Set(existing);
  let index = 0;
  while (true) {
    const text = columnName(index);
    if (!used.has(text)) return text;
    index += 1;
  }
}

function previewFrom(state: DrawGestureState): DrawPreview {
  if (state.kind === "line") {
    return { type: "line", points: [state.start, state.cursor] };
  }
  if (state.kind === "polygon") {
    return { type: "polygon", points: [...state.vertices, state.cursor] };
  }
  if (state.kind === "rectangle") {
    return {
      type: "rectangle",
      rotationDeg: 0,
      ...rectangleFromDiagonal(state.start, state.cursor),
    };
  }
  if (state.kind === "box") {
    return {
      rotationDeg: 0,
      ...boxGeometry(state.tool, state.start, state.cursor),
    };
  }
  if (state.kind === "circle") {
    return {
      type: "circle",
      cx: state.center.x,
      cy: state.center.y,
      r: distance(state.center, state.cursor),
    };
  }
  if (state.kind === "regularPolygon") {
    // 拖出的边数缺省 6（平底六边形），边数靠属性面板改。
    return {
      type: "regularPolygon",
      x: state.center.x,
      y: state.center.y,
      sides: 6,
      r: distance(state.center, state.cursor),
      rotationDeg: 0,
    };
  }
  if (state.kind === "ellipse") {
    return {
      type: "ellipse",
      rotationDeg: 0,
      ...ellipseFromBox(state.start, state.cursor),
    };
  }
  if (state.kind === "ring") {
    const outer =
      state.rOuter ?? distance(state.center, state.cursor);
    const inner =
      state.rOuter === null ? outer : distance(state.center, state.cursor);
    return {
      type: "ring",
      cx: state.center.x,
      cy: state.center.y,
      rInner: inner,
      rOuter: outer,
    };
  }
  if (state.kind === "sweep") {
    if (state.start === null) {
      return { type: "guide", points: [state.center, state.cursor] };
    }
    if (state.tool === "angle") {
      return {
        type: "angle",
        x: state.center.x,
        y: state.center.y,
        length: distance(state.center, state.start),
        startDeg: angleDeg(state.center, state.start),
        endDeg: angleDeg(state.center, state.cursor),
      };
    }
    return {
      type: state.tool,
      cx: state.center.x,
      cy: state.center.y,
      r: distance(state.center, state.start),
      startDeg: angleDeg(state.center, state.start),
      endDeg: angleDeg(state.center, state.cursor),
    };
  }
  return null;
}

function result(
  state: DrawGestureState,
  commit: Primitive2d | null = null,
): DrawGestureResult {
  return { state, preview: previewFrom(state), commit };
}

function commitAndIdle(commit: Primitive2d): DrawGestureResult {
  return { state: idleDrawState(), preview: null, commit };
}

export function idleDrawState(): DrawGestureState {
  return { kind: "idle" };
}

export function startDraw(
  state: DrawGestureState,
  ctx: DrawContext,
): DrawGestureResult {
  const point = snap2d(ctx.point, ctx.grid);
  if (state.kind === "ring" && state.rOuter !== null && ctx.tool === "ring") {
    return result({ ...state, cursor: point });
  }
  if (state.kind !== "idle") {
    return result(state);
  }
  if (ctx.tool === "line" || ctx.tool === "dimension") {
    return result({ kind: "line", start: point, cursor: point });
  }
  if (ctx.tool === "rectangle") {
    return result({ kind: "rectangle", start: point, cursor: point });
  }
  if (isBoxTool(ctx.tool)) {
    return result({ kind: "box", tool: ctx.tool, start: point, cursor: point });
  }
  if (ctx.tool === "circle") {
    return result({ kind: "circle", center: point, cursor: point });
  }
  if (ctx.tool === "regularPolygon") {
    return result({ kind: "regularPolygon", center: point, cursor: point });
  }
  if (ctx.tool === "ellipse") {
    return result({ kind: "ellipse", start: point, cursor: point });
  }
  if (ctx.tool === "ring") {
    return result({
      kind: "ring",
      center: point,
      rOuter: null,
      cursor: point,
    });
  }
  return result(state);
}

export function moveDraw(
  state: DrawGestureState,
  ctx: DrawContext,
): DrawGestureResult {
  const cursor = snap2d(ctx.point, ctx.grid);
  if (state.kind === "line") {
    return result({ kind: "line", start: state.start, cursor });
  }
  if (state.kind === "polygon") {
    return result({
      kind: "polygon",
      vertices: state.vertices,
      cursor,
    });
  }
  if (state.kind === "rectangle") {
    return result({ kind: "rectangle", start: state.start, cursor });
  }
  if (state.kind === "box") {
    return result({ ...state, cursor });
  }
  if (state.kind === "circle") {
    return result({ kind: "circle", center: state.center, cursor });
  }
  if (state.kind === "regularPolygon") {
    return result({ kind: "regularPolygon", center: state.center, cursor });
  }
  if (state.kind === "ellipse") {
    return result({ kind: "ellipse", start: state.start, cursor });
  }
  if (state.kind === "ring") {
    return result({ ...state, cursor });
  }
  if (state.kind === "sweep") {
    return result({ ...state, cursor });
  }
  return result(state);
}

function upRing(
  state: Extract<DrawGestureState, { kind: "ring" }>,
  end: Point2,
  id: string,
): DrawGestureResult {
  const radius = distance(state.center, end);
  if (state.rOuter === null) {
    if (radius === 0) {
      return result(idleDrawState());
    }
    return result({
      kind: "ring",
      center: state.center,
      rOuter: radius,
      cursor: end,
    });
  }
  if (radius === 0 || radius >= state.rOuter) {
    return result({ ...state, cursor: end });
  }
  return commitAndIdle({
    id,
    type: "ring",
    cx: state.center.x,
    cy: state.center.y,
    rInner: radius,
    rOuter: state.rOuter,
    fill: "none",
  });
}

export function upDraw(
  state: DrawGestureState,
  ctx: DrawContext,
): DrawGestureResult {
  const end = snap2d(ctx.point, ctx.grid);
  if (state.kind === "line") {
    if (samePoint(state.start, end)) {
      return result(idleDrawState());
    }
    // 标注线复用 line 手势，提交定长二元组（箭头数字是渲染细节）。
    if (ctx.tool === "dimension") {
      return commitAndIdle({
        id: ctx.id,
        type: "dimension",
        points: [state.start, end],
      });
    }
    return commitAndIdle({
      id: ctx.id,
      type: "line",
      points: [state.start, end],
    });
  }
  if (state.kind === "circle") {
    const r = distance(state.center, end);
    if (r === 0) {
      return result(idleDrawState());
    }
    return commitAndIdle({
      id: ctx.id,
      type: "circle",
      cx: state.center.x,
      cy: state.center.y,
      r,
      fill: "none",
    });
  }
  if (state.kind === "regularPolygon") {
    const r = distance(state.center, end);
    if (r === 0) {
      return result(idleDrawState());
    }
    return commitAndIdle({
      id: ctx.id,
      type: "regularPolygon",
      x: state.center.x,
      y: state.center.y,
      sides: 6,
      r,
      rotationDeg: 0,
      fill: "none",
    });
  }
  if (state.kind === "ellipse") {
    const box = ellipseFromBox(state.start, end);
    if (box.rx === 0 || box.ry === 0) {
      return result(idleDrawState());
    }
    return commitAndIdle({
      id: ctx.id,
      type: "ellipse",
      ...box,
      rotationDeg: 0,
      fill: "none",
    });
  }
  if (state.kind === "rectangle") {
    const box = rectangleFromDiagonal(state.start, end);
    if (box.width === 0 || box.height === 0) {
      return result(idleDrawState());
    }
    return commitAndIdle({
      id: ctx.id,
      type: "rectangle",
      ...box,
      rotationDeg: 0,
      fill: "none",
    });
  }
  if (state.kind === "ring") {
    return upRing(state, end, ctx.id);
  }
  if (state.kind === "box") {
    const geometry = boxGeometry(state.tool, state.start, end);
    if (geometry.width <= 0 || geometry.height <= 0) {
      return result(idleDrawState());
    }
    return commitAndIdle({
      id: ctx.id,
      ...geometry,
      rotationDeg: 0,
      fill: "none",
    });
  }
  return result(state);
}

function isSweepTool(
  tool: DrawTool,
): tool is "sector" | "bow" | "arc" | "angle" {
  return (
    tool === "sector" || tool === "bow" || tool === "arc" || tool === "angle"
  );
}

function commitSweep(
  tool: "sector" | "bow" | "arc" | "angle",
  center: Point2,
  start: Point2,
  end: Point2,
  id: string,
): Primitive2d {
  // 角的字段是顶点 (x,y) 与边长 length，其余 sweep 族是圆心 (cx,cy) 与半径 r。
  if (tool === "angle") {
    return {
      id,
      type: "angle",
      x: center.x,
      y: center.y,
      length: distance(center, start),
      startDeg: angleDeg(center, start),
      endDeg: angleDeg(center, end),
    };
  }
  const sweep = {
    id,
    cx: center.x,
    cy: center.y,
    r: distance(center, start),
    startDeg: angleDeg(center, start),
    endDeg: angleDeg(center, end),
  };
  if (tool === "arc") {
    return { ...sweep, type: "arc" };
  }
  return { ...sweep, type: tool, fill: "none" };
}

function clickIdle(ctx: DrawContext, point: Point2): DrawGestureResult {
  if (ctx.tool === "polygon") {
    return result({ kind: "polygon", vertices: [point], cursor: point });
  }
  if (ctx.tool === "label") {
    return commitAndIdle({
      id: ctx.id,
      type: "label",
      x: point.x,
      y: point.y,
      text: nextLabelText(ctx.labelTexts ?? []),
    });
  }
  if (isSweepTool(ctx.tool)) {
    return result({
      kind: "sweep",
      tool: ctx.tool,
      center: point,
      start: null,
      cursor: point,
    });
  }
  return result(idleDrawState());
}

function clickPolygon(
  state: Extract<DrawGestureState, { kind: "polygon" }>,
  ctx: DrawContext,
  point: Point2,
): DrawGestureResult {
  const first = state.vertices[0];
  if (first !== undefined && samePoint(first, point)) {
    if (distinctVertexCount(state.vertices) < 3) {
      return result(state);
    }
    return commitAndIdle({
      id: ctx.id,
      type: "polygon",
      points: state.vertices,
      fill: "none",
    });
  }

  const last = state.vertices[state.vertices.length - 1];
  if (last !== undefined && samePoint(last, point)) {
    return result(state);
  }

  return result({
    kind: "polygon",
    vertices: [...state.vertices, point],
    cursor: point,
  });
}

function clickSweep(
  state: Extract<DrawGestureState, { kind: "sweep" }>,
  ctx: DrawContext,
  point: Point2,
): DrawGestureResult {
  if (state.start === null) {
    if (samePoint(state.center, point)) {
      return result(state);
    }
    return result({ ...state, start: point, cursor: point });
  }
  if (
    samePoint(state.start, point) ||
    angleDeg(state.center, state.start) === angleDeg(state.center, point)
  ) {
    return result({ ...state, cursor: point });
  }
  return commitAndIdle(
    commitSweep(state.tool, state.center, state.start, point, ctx.id),
  );
}

export function clickDraw(
  state: DrawGestureState,
  ctx: DrawContext,
): DrawGestureResult {
  const point = snap2d(ctx.point, ctx.grid);
  if (state.kind === "idle") {
    return clickIdle(ctx, point);
  }
  if (state.kind === "polygon") {
    return clickPolygon(state, ctx, point);
  }
  if (state.kind === "sweep") {
    return clickSweep(state, ctx, point);
  }
  return result(state);
}

export function escDraw(_state: DrawGestureState): DrawGestureResult {
  return result(idleDrawState());
}
