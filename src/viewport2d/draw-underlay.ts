import Konva from "konva";
import type { GeometryDocument } from "../document/index.ts";
import { worldToScreen, type ViewTransform } from "./transform.ts";

export type UnderlayAlignment = {
  opacity: number;
  x: number;
  y: number;
  scale: number;
};

export type SessionUnderlay = UnderlayAlignment & {
  url: string;
};

export type DocumentUnderlay = GeometryDocument["underlay"];

export const DEFAULT_UNDERLAY_ALIGNMENT: UnderlayAlignment = {
  opacity: 0.4,
  x: 0,
  y: 0,
  scale: 1,
};

export function isHttpUnderlayUrl(source: string): boolean {
  try {
    const parsed = new URL(source);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function assignUnderlaySource(
  source: string,
  alignment: UnderlayAlignment,
): {
  documentUnderlay: NonNullable<DocumentUnderlay> | null;
  sessionUnderlay: SessionUnderlay | null;
} {
  if (isHttpUnderlayUrl(source)) {
    return {
      documentUnderlay: {
        url: source,
        opacity: alignment.opacity,
        x: alignment.x,
        y: alignment.y,
        scale: alignment.scale,
      },
      sessionUnderlay: null,
    };
  }
  return {
    documentUnderlay: null,
    sessionUnderlay: {
      url: source,
      opacity: alignment.opacity,
      x: alignment.x,
      y: alignment.y,
      scale: alignment.scale,
    },
  };
}

export function resolveUnderlayDisplay(
  documentUnderlay: DocumentUnderlay,
  sessionUnderlay: SessionUnderlay | null,
): SessionUnderlay | null {
  if (sessionUnderlay !== null) {
    return sessionUnderlay;
  }
  if (documentUnderlay?.url === undefined) {
    return null;
  }
  return {
    url: documentUnderlay.url,
    opacity: documentUnderlay.opacity,
    x: documentUnderlay.x,
    y: documentUnderlay.y,
    scale: documentUnderlay.scale,
  };
}

const imageCache = new Map<string, HTMLImageElement>();

function underlayImageNode(
  image: HTMLImageElement,
  underlay: SessionUnderlay,
  view: ViewTransform,
): Konva.Image {
  const worldWidth = image.naturalWidth * underlay.scale;
  const worldHeight = image.naturalHeight * underlay.scale;
  const topLeft = worldToScreen(
    { x: underlay.x, y: underlay.y + worldHeight },
    view,
  );
  return new Konva.Image({
    image,
    x: topLeft.x,
    y: topLeft.y,
    width: worldWidth * view.scale,
    height: worldHeight * view.scale,
    opacity: underlay.opacity,
    listening: false,
  });
}

export function drawUnderlay(
  layer: Konva.Layer,
  display: SessionUnderlay | null,
  view: ViewTransform,
  onLoaded: () => void,
): void {
  layer.destroyChildren();
  if (display === null) {
    return;
  }
  const cached = imageCache.get(display.url);
  if (cached !== undefined && cached.complete && cached.naturalWidth > 0) {
    layer.add(underlayImageNode(cached, display, view));
    return;
  }
  if (cached !== undefined) {
    return;
  }
  const image = new Image();
  imageCache.set(display.url, image);
  image.onload = () => {
    onLoaded();
  };
  image.onerror = () => {
    imageCache.delete(display.url);
  };
  if (isHttpUnderlayUrl(display.url)) {
    image.crossOrigin = "anonymous";
  }
  image.src = display.url;
}
