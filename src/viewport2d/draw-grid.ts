import Konva from "konva";
import { readableGridStep } from "./grid-step.ts";
import {
  screenToWorld,
  worldToScreen,
  type ViewTransform,
} from "./transform.ts";

const GRID_COLOR = "#d4d4d8";
const AXIS_X = "#b91c1c";
const AXIS_Y = "#15803d";

function gridShape(
  view: ViewTransform,
  width: number,
  height: number,
): Konva.Shape {
  const step = readableGridStep(view.scale);
  const topLeft = screenToWorld({ x: 0, y: 0 }, view);
  const bottomRight = screenToWorld({ x: width, y: height }, view);
  const i0 = Math.floor(topLeft.x / step);
  const i1 = Math.ceil(bottomRight.x / step);
  const j0 = Math.floor(bottomRight.y / step);
  const j1 = Math.ceil(topLeft.y / step);

  return new Konva.Shape({
    listening: false,
    stroke: GRID_COLOR,
    strokeWidth: 1,
    sceneFunc: (ctx, shape) => {
      ctx.beginPath();
      for (let i = i0; i <= i1; i += 1) {
        const x = worldToScreen({ x: i * step, y: 0 }, view).x;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let j = j0; j <= j1; j += 1) {
        const y = worldToScreen({ x: 0, y: j * step }, view).y;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.strokeShape(shape);
    },
  });
}

function axisNodes(
  view: ViewTransform,
  width: number,
  height: number,
): Konva.Shape[] {
  const origin = worldToScreen({ x: 0, y: 0 }, view);
  return [
    new Konva.Line({
      points: [0, origin.y, width, origin.y],
      stroke: AXIS_X,
      strokeWidth: 1.5,
      listening: false,
    }),
    new Konva.Line({
      points: [origin.x, 0, origin.x, height],
      stroke: AXIS_Y,
      strokeWidth: 1.5,
      listening: false,
    }),
    new Konva.Text({
      x: width - 18,
      y: origin.y + 6,
      text: "X",
      fontSize: 12,
      fill: AXIS_X,
      listening: false,
    }),
    new Konva.Text({
      x: origin.x + 6,
      y: 6,
      text: "Y",
      fontSize: 12,
      fill: AXIS_Y,
      listening: false,
    }),
  ];
}

export function drawGridAndAxes(
  layer: Konva.Layer,
  view: ViewTransform,
  width: number,
  height: number,
): void {
  layer.destroyChildren();
  layer.add(gridShape(view, width, height));
  for (const node of axisNodes(view, width, height)) {
    layer.add(node);
  }
}
