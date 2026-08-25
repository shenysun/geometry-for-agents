import Konva from "konva";
import type {
  Fill,
  GeometryDocument,
  Primitive2d,
} from "../document/index.ts";
import { baseHeightWorldVertices } from "../document/base-height-family.ts";
import {
  angleArcRadius,
  angleEndPoint,
  angleStartPoint,
} from "../document/angle.ts";
import type { DrawPreview } from "./draw-gesture.ts";
import { worldToScreen, type Point2, type ViewTransform } from "./transform.ts";

const STROKE = "#18181b";
const FILL_SOLID = "rgba(24, 24, 27, 0.14)";
const DEG = Math.PI / 180;
const STROKE_WIDTH = 1.5;

type Sweep = {
  cx: number;
  cy: number;
  r: number;
  startDeg: number;
  endDeg: number;
};

function sweepDeg(startDeg: number, endDeg: number): number {
  if (startDeg === endDeg) return 0;
  const raw = (endDeg - startDeg) % 360;
  const sweep = raw < 0 ? raw + 360 : raw;
  return sweep === 0 ? 360 : sweep;
}

function polar(cx: number, cy: number, r: number, deg: number): Point2 {
  const rad = deg * DEG;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcWorldPoints(sweep: Sweep): Point2[] {
  const span = sweepDeg(sweep.startDeg, sweep.endDeg);
  const steps = Math.max(12, Math.ceil((span / 360) * 64));
  return Array.from({ length: steps + 1 }, (_, i) =>
    polar(
      sweep.cx,
      sweep.cy,
      sweep.r,
      sweep.startDeg + (span * i) / steps,
    ),
  );
}

function toScreenPoints(points: Point2[], view: ViewTransform): number[] {
  return points.flatMap((point) => {
    const screen = worldToScreen(point, view);
    return [screen.x, screen.y];
  });
}

function hatchCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return canvas;
  ctx.strokeStyle = "rgba(24, 24, 27, 0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(8, 0);
  ctx.stroke();
  return canvas;
}

let hatchImage: HTMLCanvasElement | undefined;

function fillConfig(fill: Fill | undefined): Konva.ShapeConfig {
  if (fill === "solid") {
    return { fill: FILL_SOLID };
  }
  if (fill === "hatch") {
    hatchImage ??= hatchCanvas();
    return {
      fillPatternImage: hatchImage as unknown as HTMLImageElement,
      fillPatternRepeat: "repeat",
      fillPriority: "pattern",
    };
  }
  return { fillEnabled: false };
}

function strokeLine(
  points: number[],
  closed: boolean,
  fill?: Fill,
  dash?: number[],
): Konva.Line {
  return new Konva.Line({
    points,
    closed,
    stroke: STROKE,
    strokeWidth: STROKE_WIDTH,
    lineJoin: "round",
    lineCap: "round",
    listening: false,
    dash,
    ...fillConfig(fill),
  });
}

function centerScreen(
  cx: number,
  cy: number,
  view: ViewTransform,
): Point2 {
  return worldToScreen({ x: cx, y: cy }, view);
}

function drawDisk(
  cx: number,
  cy: number,
  radius: number,
  fill: Fill,
  view: ViewTransform,
): Konva.Circle {
  const center = centerScreen(cx, cy, view);
  return new Konva.Circle({
    x: center.x,
    y: center.y,
    radius: radius * view.scale,
    stroke: STROKE,
    strokeWidth: STROKE_WIDTH,
    listening: false,
    ...fillConfig(fill),
  });
}

function drawSweepPath(
  sweep: Sweep,
  view: ViewTransform,
  closed: boolean,
  prefix: Point2[] = [],
  fill?: Fill,
): Konva.Line {
  return strokeLine(
    toScreenPoints([...prefix, ...arcWorldPoints(sweep)], view),
    closed,
    fill,
  );
}

function drawPrimitive(
  primitive: Primitive2d,
  view: ViewTransform,
): Konva.Shape[] {
  switch (primitive.type) {
    case "line":
      return [strokeLine(toScreenPoints(primitive.points, view), false)];
    case "polygon":
      return [
        strokeLine(toScreenPoints(primitive.points, view), true, primitive.fill),
      ];
    case "rectangle": {
      const center = centerScreen(primitive.x, primitive.y, view);
      const width = primitive.width * view.scale;
      const height = primitive.height * view.scale;
      return [
        new Konva.Rect({
          x: center.x,
          y: center.y,
          width,
          height,
          // 矩形以中心定位：offset 把局部原点挪到左上角，旋转绕中心。
          offsetX: width / 2,
          offsetY: height / 2,
          // 世界系逆时针为正，Konva 屏幕系顺时针为正，符号取反。
          rotation: -primitive.rotationDeg,
          stroke: STROKE,
          strokeWidth: STROKE_WIDTH,
          listening: false,
          ...fillConfig(primitive.fill),
        }),
      ];
    }
    case "circle":
      return [
        drawDisk(primitive.cx, primitive.cy, primitive.r, primitive.fill, view),
      ];
    case "triangle":
    case "parallelogram":
    case "trapezoid":
      // 家族顶点已随 rotationDeg 旋到世界：闭合折线即形，无需 Konva rotation。
      return [
        strokeLine(
          toScreenPoints(baseHeightWorldVertices(primitive), view),
          true,
          primitive.fill,
        ),
      ];
    case "ellipse": {
      const center = centerScreen(primitive.cx, primitive.cy, view);
      return [
        new Konva.Ellipse({
          x: center.x,
          y: center.y,
          radiusX: primitive.rx * view.scale,
          radiusY: primitive.ry * view.scale,
          // 世界系逆时针为正，Konva 屏幕系顺时针为正，符号取反。
          rotation: -primitive.rotationDeg,
          stroke: STROKE,
          strokeWidth: STROKE_WIDTH,
          listening: false,
          ...fillConfig(primitive.fill),
        }),
      ];
    }
    case "ring": {
      const center = centerScreen(primitive.cx, primitive.cy, view);
      return [
        new Konva.Ring({
          x: center.x,
          y: center.y,
          innerRadius: primitive.rInner * view.scale,
          outerRadius: primitive.rOuter * view.scale,
          stroke: STROKE,
          strokeWidth: STROKE_WIDTH,
          listening: false,
          ...fillConfig(primitive.fill),
        }),
      ];
    }
    case "arc":
      return [drawSweepPath(primitive, view, false)];
    case "angle": {
      // 笔画族：两边是共享顶点的折线，弧标总是画出（半径按边长比例）。
      const vertex = { x: primitive.x, y: primitive.y };
      const sides = [
        angleStartPoint(primitive),
        vertex,
        angleEndPoint(primitive),
      ];
      return [
        strokeLine(toScreenPoints(sides, view), false),
        drawSweepPath(
          {
            cx: primitive.x,
            cy: primitive.y,
            r: angleArcRadius(primitive),
            startDeg: primitive.startDeg,
            endDeg: primitive.endDeg,
          },
          view,
          false,
        ),
      ];
    }
    case "sector":
      return [
        drawSweepPath(
          primitive,
          view,
          true,
          [{ x: primitive.cx, y: primitive.cy }],
          primitive.fill,
        ),
      ];
    case "bow":
      return [drawSweepPath(primitive, view, true, [], primitive.fill)];
    case "label": {
      const point = worldToScreen({ x: primitive.x, y: primitive.y }, view);
      return [
        new Konva.Circle({
          x: point.x,
          y: point.y,
          radius: 3,
          fill: STROKE,
          listening: false,
        }),
        new Konva.Text({
          x: point.x + 6,
          y: point.y - 16,
          text: primitive.text,
          fontSize: 14,
          fontFamily: "sans-serif",
          fill: STROKE,
          listening: false,
        }),
      ];
    }
  }
}

function previewPrimitive(preview: DrawPreview): Primitive2d | null {
  if (preview === null || preview.type === "guide") {
    return null;
  }
  if (preview.type === "line") {
    if (preview.points.length < 2) return null;
    return { id: "preview", type: "line", points: preview.points };
  }
  if (preview.type === "polygon") {
    if (preview.points.length < 3) {
      if (preview.points.length < 2) return null;
      return { id: "preview", type: "line", points: preview.points };
    }
    return {
      id: "preview",
      type: "polygon",
      points: preview.points,
      fill: "none",
    };
  }
  if (preview.type === "circle") {
    if (preview.r <= 0) return null;
    return { id: "preview", ...preview, fill: "none" };
  }
  if (preview.type === "rectangle") {
    if (preview.width <= 0 || preview.height <= 0) return null;
    return { id: "preview", ...preview, fill: "none" };
  }
  if (preview.type === "triangle") {
    if (preview.width <= 0 || preview.height <= 0) return null;
    return { id: "preview", ...preview, fill: "none" };
  }
  if (preview.type === "parallelogram") {
    // 预览态允许 skew 过零（ADR 0007）：退化只挡非正尺寸。
    if (preview.width <= 0 || preview.height <= 0) return null;
    return { id: "preview", ...preview, fill: "none" };
  }
  if (preview.type === "trapezoid") {
    if (
      preview.width <= 0 ||
      preview.topWidth <= 0 ||
      preview.height <= 0
    ) {
      return null;
    }
    return { id: "preview", ...preview, fill: "none" };
  }
  if (preview.type === "ellipse") {
    if (preview.rx <= 0 || preview.ry <= 0) return null;
    return { id: "preview", ...preview, fill: "none" };
  }
  if (preview.type === "ring") {
    if (preview.rOuter <= 0) return null;
    if (preview.rInner <= 0 || preview.rInner >= preview.rOuter) {
      return {
        id: "preview",
        type: "circle",
        cx: preview.cx,
        cy: preview.cy,
        r: preview.rOuter,
        fill: "none",
      };
    }
    return { id: "preview", ...preview, fill: "none" };
  }
  if (preview.type === "angle") {
    if (preview.length <= 0) return null;
    return { id: "preview", ...preview };
  }
  if (preview.type === "label") {
    return { id: "preview", ...preview };
  }
  if (preview.r <= 0) return null;
  if (preview.type === "arc") {
    return { id: "preview", ...preview };
  }
  if (preview.type === "sector") {
    return { id: "preview", ...preview, fill: "none" };
  }
  return { id: "preview", ...preview, fill: "none" };
}

function previewGuidePoints(preview: DrawPreview): Point2[] {
  if (preview === null) return [];
  if (preview.type === "line" || preview.type === "polygon" || preview.type === "guide") {
    return preview.points;
  }
  if (
    preview.type === "label" ||
    preview.type === "rectangle" ||
    preview.type === "triangle" ||
    preview.type === "parallelogram" ||
    preview.type === "trapezoid" ||
    preview.type === "angle"
  ) {
    return [{ x: preview.x, y: preview.y }];
  }
  return [{ x: preview.cx, y: preview.cy }];
}

export function drawGesturePreview(
  layer: Konva.Layer,
  preview: DrawPreview,
  view: ViewTransform,
): void {
  layer.destroyChildren();
  if (preview === null) {
    return;
  }
  const primitive = previewPrimitive(preview);
  if (primitive !== null) {
    for (const node of drawPrimitive(primitive, view)) {
      node.dash([6, 4]);
      layer.add(node);
    }
  } else if (
    (preview.type === "line" || preview.type === "polygon" || preview.type === "guide") &&
    preview.points.length >= 2
  ) {
    layer.add(
      strokeLine(toScreenPoints(preview.points, view), false, undefined, [6, 4]),
    );
  }
  for (const point of previewGuidePoints(preview)) {
    const screen = worldToScreen(point, view);
    layer.add(
      new Konva.Circle({
        x: screen.x,
        y: screen.y,
        radius: 3,
        fill: STROKE,
        listening: false,
      }),
    );
  }
}

export function drawDocumentPrimitives(
  layer: Konva.Layer,
  document: GeometryDocument,
  view: ViewTransform,
): void {
  layer.destroyChildren();
  if (document.space !== "2d") {
    return;
  }
  for (const primitive of document.primitives) {
    for (const node of drawPrimitive(primitive, view)) {
      layer.add(node);
    }
  }
}
