import {
  snap2d,
  type GridSnap,
  type Point2,
  type Primitive,
} from "../document/index.ts";

export type DrawTool = "line" | "polygon";

export type DrawContext = {
  tool: DrawTool;
  point: Point2;
  grid: GridSnap;
  id: string;
};

export type DrawPreview =
  | { type: "line"; points: Point2[] }
  | { type: "polygon"; points: Point2[] }
  | null;

export type DrawGestureState =
  | { kind: "idle" }
  | { kind: "line"; start: Point2; cursor: Point2 }
  | { kind: "polygon"; vertices: Point2[]; cursor: Point2 };

export type DrawGestureResult = {
  state: DrawGestureState;
  preview: DrawPreview;
  commit: Primitive | null;
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

function previewFrom(state: DrawGestureState): DrawPreview {
  if (state.kind === "line") {
    return { type: "line", points: [state.start, state.cursor] };
  }
  if (state.kind === "polygon") {
    return { type: "polygon", points: [...state.vertices, state.cursor] };
  }
  return null;
}

function result(
  state: DrawGestureState,
  commit: Primitive | null = null,
): DrawGestureResult {
  return { state, preview: previewFrom(state), commit };
}

export function idleDrawState(): DrawGestureState {
  return { kind: "idle" };
}

export function startDraw(
  state: DrawGestureState,
  ctx: DrawContext,
): DrawGestureResult {
  if (state.kind !== "idle" || ctx.tool !== "line") {
    return result(state);
  }
  const start = snap2d(ctx.point, ctx.grid);
  return result({ kind: "line", start, cursor: start });
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
  return result(state);
}

export function upDraw(
  state: DrawGestureState,
  ctx: DrawContext,
): DrawGestureResult {
  if (state.kind !== "line") {
    return result(state);
  }
  const end = snap2d(ctx.point, ctx.grid);
  if (samePoint(state.start, end)) {
    return result(idleDrawState());
  }
  return {
    state: idleDrawState(),
    preview: null,
    commit: {
      id: ctx.id,
      type: "line",
      points: [state.start, end],
    },
  };
}

export function clickDraw(
  state: DrawGestureState,
  ctx: DrawContext,
): DrawGestureResult {
  if (state.kind === "idle") {
    if (ctx.tool !== "polygon") {
      return result(state);
    }
    const first = snap2d(ctx.point, ctx.grid);
    return result({ kind: "polygon", vertices: [first], cursor: first });
  }
  if (state.kind !== "polygon") {
    return result(state);
  }

  const point = snap2d(ctx.point, ctx.grid);
  const first = state.vertices[0];
  if (first !== undefined && samePoint(first, point)) {
    if (distinctVertexCount(state.vertices) < 3) {
      return result(state);
    }
    return {
      state: idleDrawState(),
      preview: null,
      commit: {
        id: ctx.id,
        type: "polygon",
        points: state.vertices,
        fill: "none",
      },
    };
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

export function escDraw(_state: DrawGestureState): DrawGestureResult {
  return result(idleDrawState());
}
