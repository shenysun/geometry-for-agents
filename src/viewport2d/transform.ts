import type { FunctionCurveViewport } from "../document/function-curve.ts";

export type Point2 = { x: number; y: number };

/** Screen placement of the world origin and pixels per world unit.
 *  width/height 是画布尺寸（屏幕像素，可选）：函数曲线采样等需要知道
 *  可见范围的消费者用，老调用方不带也不受影响。 */
export type ViewTransform = {
  originX: number;
  originY: number;
  scale: number;
  width?: number;
  height?: number;
};

export function worldToScreen(world: Point2, view: ViewTransform): Point2 {
  return {
    x: view.originX + world.x * view.scale,
    y: view.originY - world.y * view.scale,
  };
}

export function screenToWorld(screen: Point2, view: ViewTransform): Point2 {
  return {
    x: (screen.x - view.originX) / view.scale,
    y: (view.originY - screen.y) / view.scale,
  };
}

export function panView(
  view: ViewTransform,
  dx: number,
  dy: number,
): ViewTransform {
  return {
    ...view,
    originX: view.originX + dx,
    originY: view.originY + dy,
  };
}

export function zoomViewAt(
  view: ViewTransform,
  screenPoint: Point2,
  factor: number,
): ViewTransform {
  const world = screenToWorld(screenPoint, view);
  const scale = view.scale * factor;
  return {
    ...view,
    originX: screenPoint.x - world.x * scale,
    originY: screenPoint.y + world.y * scale,
    scale,
  };
}

/** 从视图变换推导函数曲线采样视口（可见世界 x 范围 + 缩放 + 可见世界高）。
 *  画布尺寸缺失（无头测试等）时返回 null：渲染为空、命中不参与。 */
export function curveViewportOf(
  view: ViewTransform,
): FunctionCurveViewport | null {
  const { width, height } = view;
  if (width === undefined || height === undefined) return null;
  return {
    xMin: -view.originX / view.scale,
    xMax: (width - view.originX) / view.scale,
    scale: view.scale,
    heightWorld: height / view.scale,
  };
}
