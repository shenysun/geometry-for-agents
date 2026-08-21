export type Point2 = { x: number; y: number };

/** Screen placement of the world origin and pixels per world unit. */
export type ViewTransform = {
  originX: number;
  originY: number;
  scale: number;
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
    originX: view.originX + dx,
    originY: view.originY + dy,
    scale: view.scale,
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
    originX: screenPoint.x - world.x * scale,
    originY: screenPoint.y + world.y * scale,
    scale,
  };
}
