import Konva from "konva";
import type { GeometryDocument } from "../document/index.ts";
import { drawGridAndAxes } from "./draw-grid.ts";
import { drawDocumentPrimitives } from "./draw-primitives.ts";
import { panView, zoomViewAt, type ViewTransform } from "./transform.ts";

const MIN_SCALE = 4;
const MAX_SCALE = 400;
const DEFAULT_SCALE = 40;

export type Viewport2dProjector = {
  render: (document: GeometryDocument) => void;
  setPreview: (gesture: unknown) => void;
  resize: (width: number, height: number) => void;
  destroy: () => void;
};

function clampZoomFactor(scale: number, factor: number): number {
  const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
  return next / scale;
}

export function createViewport2dProjector(
  container: HTMLDivElement,
): Viewport2dProjector {
  const stage = new Konva.Stage({
    container,
    width: Math.max(1, container.clientWidth),
    height: Math.max(1, container.clientHeight),
  });
  const gridLayer = new Konva.Layer({ listening: false });
  const primitiveLayer = new Konva.Layer({ listening: false });
  const previewLayer = new Konva.Layer({ listening: false });
  stage.add(gridLayer, primitiveLayer, previewLayer);

  let view: ViewTransform = {
    originX: stage.width() / 2,
    originY: stage.height() / 2,
    scale: DEFAULT_SCALE,
  };
  let currentDocument: GeometryDocument | null = null;
  let lastPointer: { x: number; y: number } | null = null;

  container.style.cursor = "grab";
  container.style.touchAction = "none";

  function preventWheelScroll(event: WheelEvent): void {
    event.preventDefault();
  }
  container.addEventListener("wheel", preventWheelScroll, { passive: false });

  function redraw(): void {
    drawGridAndAxes(gridLayer, view, stage.width(), stage.height());
    if (currentDocument !== null) {
      drawDocumentPrimitives(primitiveLayer, currentDocument, view);
    }
    gridLayer.batchDraw();
    primitiveLayer.batchDraw();
    previewLayer.batchDraw();
  }

  function onWheel(event: Konva.KonvaEventObject<WheelEvent>): void {
    event.evt.preventDefault();
    const pointer = stage.getPointerPosition();
    if (pointer === null) return;
    const factor = clampZoomFactor(
      view.scale,
      Math.exp(-event.evt.deltaY * 0.001),
    );
    if (factor === 1) return;
    view = zoomViewAt(view, pointer, factor);
    redraw();
  }

  function onMouseDown(event: Konva.KonvaEventObject<MouseEvent>): void {
    if (event.evt.button !== 0) return;
    lastPointer = stage.getPointerPosition();
    container.style.cursor = "grabbing";
  }

  function onMouseMove(): void {
    if (lastPointer === null) return;
    const pointer = stage.getPointerPosition();
    if (pointer === null) return;
    view = panView(view, pointer.x - lastPointer.x, pointer.y - lastPointer.y);
    lastPointer = pointer;
    redraw();
  }

  function endPan(): void {
    lastPointer = null;
    container.style.cursor = "grab";
  }

  stage.on("wheel", onWheel);
  stage.on("mousedown", onMouseDown);
  stage.on("mousemove", onMouseMove);
  stage.on("mouseup", endPan);
  stage.on("mouseleave", endPan);

  redraw();

  return {
    render(document: GeometryDocument): void {
      currentDocument = document;
      redraw();
    },
    setPreview(_gesture: unknown): void {
      previewLayer.destroyChildren();
      previewLayer.batchDraw();
    },
    resize(width: number, height: number): void {
      const nextWidth = Math.max(1, Math.floor(width));
      const nextHeight = Math.max(1, Math.floor(height));
      const prevWidth = stage.width();
      const prevHeight = stage.height();
      stage.size({ width: nextWidth, height: nextHeight });
      view = panView(
        view,
        (nextWidth - prevWidth) / 2,
        (nextHeight - prevHeight) / 2,
      );
      redraw();
    },
    destroy(): void {
      container.removeEventListener("wheel", preventWheelScroll);
      stage.off("wheel", onWheel);
      stage.off("mousedown", onMouseDown);
      stage.off("mousemove", onMouseMove);
      stage.off("mouseup", endPan);
      stage.off("mouseleave", endPan);
      stage.destroy();
    },
  };
}
